// Creates or updates the plan catalog (Free, Pro, Business) in the "plans" collection.
// Safe to run again: plans are matched by key, so their _id (and every clients.planId pointing to them) is kept.
// Plans from before the catalog are adopted by name ("Plan Gratuito" → free, "Profesional" → pro,
// "Enterprise" → business) instead of creating duplicates.
// Limits edited later from /superadmin/plans are overwritten by a new run, unless --keep-limits is passed.
//
// Usage:
//   node scripts/seed-plans.js                  # catalog only
//   node scripts/seed-plans.js --keep-limits    # only add plans that are missing, keep the limits of the rest
//   node scripts/seed-plans.js --grant-trial    # also give every open organization 90 days of Pro (once)

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Use public DNS servers to avoid the querySrv ECONNREFUSED error
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI = process.env.MONGODB_URI;
// Same as the app: without MONGODB_DB, the database named in the URI is used
const DB_NAME = process.env.MONGODB_DB;
if (!MONGO_URI) {
    console.error(chalk.red.bold('\n[FATAL] MONGODB_URI was not found in .env.local\n'));
    process.exit(1);
}

const TRIAL_DAYS = 90;

// Same values as PLAN_FEATURES in lib/constants.ts. Limits of 0 are unlimited (lib/plans.ts)
const CATALOG = [
    {
        key: 'free', name: 'Plan Gratuito', legacyNames: ['Plan Gratuito'],
        price: 0, priceYearly: 0, maxUsers: 3, maxDepartments: 2, maxItems: 100, historyDays: 30,
        features: [],
    },
    {
        key: 'pro', name: 'Pro', legacyNames: ['Profesional'],
        price: 19, priceYearly: 190, maxUsers: 15, maxDepartments: 10, maxItems: 2000, historyDays: 365,
        features: ['department_assignment'],
    },
    {
        key: 'business', name: 'Business', legacyNames: ['Enterprise'],
        price: 49, priceYearly: 490, maxUsers: 0, maxDepartments: 0, maxItems: 20000, historyDays: 0,
        features: ['department_assignment', 'priority_support'],
    },
];

const LIMIT_FIELDS = ['price', 'priceYearly', 'maxUsers', 'maxDepartments', 'maxItems', 'historyDays', 'features'];

async function main() {
    const keepLimits = process.argv.includes('--keep-limits');
    const grantTrial = process.argv.includes('--grant-trial');

    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const plans = db.collection('plans');
    console.log(chalk.gray(`Database: ${db.databaseName}`));

    try {
        const ids = {};
        for (const { legacyNames, ...plan } of CATALOG) {
            const existing = await plans.findOne({ key: plan.key })
                || await plans.findOne({ key: { $exists: false }, isCustom: { $ne: true }, name: { $in: legacyNames } });
            const now = new Date();

            if (!existing) {
                const { insertedId } = await plans.insertOne({ ...plan, isActive: true, billingMode: 'lemonsqueezy', createdAt: now, updatedAt: now });
                ids[plan.key] = insertedId;
                console.log(chalk.green('+'), `${plan.key} created`);
                continue;
            }

            const update = { key: plan.key, name: plan.name, isActive: true, updatedAt: now };
            if (!keepLimits || !existing.key) for (const field of LIMIT_FIELDS) update[field] = plan[field];
            if (!existing.billingMode) update.billingMode = 'lemonsqueezy';
            await plans.updateOne({ _id: existing._id }, { $set: update });
            ids[plan.key] = existing._id;
            console.log(chalk.green('✓'), `${plan.key} ${existing.key ? 'updated' : `adopted from "${existing.name}"`}`, chalk.gray(existing._id.toString()));
        }

        // Variant ids come from the Lemon Squeezy dashboard (Products → the plan → variants)
        for (const key of ['pro', 'business']) {
            const prefix = `LEMONSQUEEZY_${key.toUpperCase()}`;
            const monthlyVariantId = process.env[`${prefix}_MONTHLY_VARIANT_ID`];
            const yearlyVariantId = process.env[`${prefix}_YEARLY_VARIANT_ID`];
            if (monthlyVariantId || yearlyVariantId) {
                await plans.updateOne({ _id: ids[key] }, { $set: { billing: { monthlyVariantId, yearlyVariantId } } });
                console.log(chalk.green('✓'), `${key} linked to its Lemon Squeezy variants`);
            }
        }

        if (grantTrial) {
            const endsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
            // Only once per organization, and never to one that already pays
            const { modifiedCount } = await db.collection('clients').updateMany(
                { status: { $ne: 'closed' }, trial: { $exists: false }, subscription: { $exists: false } },
                { $set: { trial: { planId: ids.pro, endsAt } } }
            );
            console.log(chalk.green('✓'), `${modifiedCount} organizations get Pro until ${endsAt.toISOString().slice(0, 10)}`);
        }

        console.log(chalk.green.bold('\nPlan catalog in place.'));
    } finally {
        await mongoClient.close();
    }
}

main().catch((error) => {
    console.error(chalk.red.bold('\n[ERROR]'), error);
    process.exit(1);
});
