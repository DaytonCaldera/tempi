// Cleans up users affected by the lobby redirect loop.
//
// Sign-up used to give every user a fake "sup22" organization that stayed as their active
// organization. On the next sign-in that entry won over the real organization and sent the user
// back to the lobby. For each user, this script:
//   - removes the "sup22" entries from organizations
//   - removes duplicate entries of the same organization (keeping the one that isn't pending)
//   - fixes activeOrganization when it points to "sup22" or to an organization the user doesn't have
//   - removes the top-level "sup22" clientId
// It also lists owners with several created organizations (possible duplicates from the loop),
// but deletes NONE of them: review those by hand.
//
// Usage:
//   node scripts/cleanup-placeholder-orgs.js          -> only shows what would change
//   node scripts/cleanup-placeholder-orgs.js --apply  -> applies the changes

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Use public DNS servers to avoid the querySrv ECONNREFUSED error
dns.setServers(['8.8.8.8', '1.1.1.1']);

const PLACEHOLDER_CLIENT_ID = 'sup22';
const PENDING_ROLE = 'pending_user';
const APPLY = process.argv.includes('--apply');

const MONGO_URI = process.env.MONGODB_URI;
// Same as the app: without MONGODB_DB, the database named in the URI is used
const DB_NAME = process.env.MONGODB_DB;
if (!MONGO_URI) {
    console.error(chalk.red.bold('\n[FATAL] MONGODB_URI was not found in .env.local\n'));
    process.exit(1);
}

const idToString = (id) => (id == null ? null : id.toString());
const isPlaceholder = (org) => !org?.clientId || idToString(org.clientId) === PLACEHOLDER_CLIENT_ID;

/**
 * Works out the fixed state of a user. Returns null when there is nothing to change.
 */
function buildFix(user) {
    const organizations = user.organizations || [];

    // One entry per organization, preferring the one that was already approved
    const byClient = new Map();
    for (const org of organizations) {
        if (isPlaceholder(org)) continue;
        const key = idToString(org.clientId);
        const current = byClient.get(key);
        if (!current || (current.role === PENDING_ROLE && org.role !== PENDING_ROLE)) {
            byClient.set(key, org);
        }
    }
    const cleanOrgs = [...byClient.values()];

    const activeId = idToString(user.activeOrganization);
    const activeIsValid = cleanOrgs.some(o => idToString(o.clientId) === activeId && o.status === 'active');
    const fallback = cleanOrgs.find(o => o.status === 'active') || null;
    const newActive = activeIsValid ? user.activeOrganization : (fallback ? fallback.clientId : null);

    const orgsChanged = cleanOrgs.length !== organizations.length;
    const activeChanged = idToString(newActive) !== activeId;
    const clientIdIsPlaceholder = idToString(user.clientId) === PLACEHOLDER_CLIENT_ID;

    if (!orgsChanged && !activeChanged && !clientIdIsPlaceholder) return null;

    const update = { $set: { organizations: cleanOrgs, activeOrganization: newActive } };
    if (clientIdIsPlaceholder) update.$unset = { clientId: '' };

    return {
        update,
        summary: `orgs ${organizations.length} -> ${cleanOrgs.length}, activeOrganization ${activeId} -> ${idToString(newActive)}` +
            (clientIdIsPlaceholder ? ', removes clientId "sup22"' : '')
    };
}

async function main() {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);

    try {
        console.log(chalk.cyan.bold(`\n${APPLY ? 'APPLYING CHANGES' : 'DRY RUN (use --apply to save)'} on ${db.databaseName}\n`));

        const users = await db.collection('users').find({
            $or: [
                { organizations: { $exists: true } },
                { clientId: PLACEHOLDER_CLIENT_ID },
                { activeOrganization: PLACEHOLDER_CLIENT_ID }
            ]
        }).toArray();

        let changed = 0;
        for (const user of users) {
            const fix = buildFix(user);
            if (!fix) continue;
            changed++;
            console.log(`${chalk.yellow(user.email)}: ${fix.summary}`);
            if (APPLY) {
                await db.collection('users').updateOne({ _id: user._id }, fix.update);
            }
        }
        console.log(chalk.green.bold(`\n${changed} of ${users.length} users ${APPLY ? 'fixed' : 'to fix'}.`));

        // Organizations created several times by the same owner: only reported
        const duplicates = await db.collection('clients').aggregate([
            { $match: { ownerEmail: { $exists: true } } },
            { $group: { _id: '$ownerEmail', count: { $sum: 1 }, orgs: { $push: { id: '$_id', name: '$name', createdAt: '$createdAt' } } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicates.length > 0) {
            console.log(chalk.cyan.bold('\nOwners with several organizations (review by hand, nothing is deleted):'));
            for (const owner of duplicates) {
                console.log(chalk.yellow(owner._id));
                for (const org of owner.orgs) {
                    console.log(chalk.gray(`   ${org.id}  ${org.name}  ${org.createdAt ? new Date(org.createdAt).toISOString() : ''}`));
                }
            }
        }
    } finally {
        await mongoClient.close();
    }
}

main().catch((error) => {
    console.error(chalk.red.bold('\n[ERROR]'), error);
    process.exit(1);
});
