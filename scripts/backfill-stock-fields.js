// Prepares department_stock for the unique SKU index (scripts/create-indexes.js). Run it before that script.
//
// For each product, this script:
//   - Sets clientId from its department when it's missing (products created before the app stored it).
//   - Sets isDeleted: false when the field is missing: the unique index only covers documents with
//     isDeleted: false (a partial index can't say "not true"), so deleted products don't hold on to their SKU.
//   - Gives a new SKU to products that repeat one already used in their department (deleted ones aside).
//     The oldest product keeps the SKU; past movements keep the SKU they were recorded with.
// Products whose department no longer exists are only listed.
// Running it again finds nothing to do.
//
// Usage:
//   node scripts/backfill-stock-fields.js          -> only shows what would change
//   node scripts/backfill-stock-fields.js --apply  -> applies the changes

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Use public DNS servers to avoid the querySrv ECONNREFUSED error
dns.setServers(['8.8.8.8', '1.1.1.1']);

const APPLY = process.argv.includes('--apply');

const MONGO_URI = process.env.MONGODB_URI;
// Same as the app: without MONGODB_DB, the database named in the URI is used
const DB_NAME = process.env.MONGODB_DB;
if (!MONGO_URI) {
    console.error(chalk.red.bold('\n[FATAL] MONGODB_URI was not found in .env.local\n'));
    process.exit(1);
}

/** Same format as generateUniqueSKU in lib/sku.ts: the department prefix and a number not in `taken`. */
function uniqueSku(departmentName, taken) {
    const prefix = (departmentName || 'SKU').substring(0, 3).toUpperCase().replace(/\s/g, 'X');
    for (let attempt = 0; ; attempt++) {
        const min = attempt < 20 ? 1000 : 100000;
        const sku = `${prefix}-${Math.floor(min + Math.random() * 9 * min)}`;
        if (!taken.has(sku)) {
            taken.add(sku);
            return sku;
        }
    }
}

async function main() {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    console.log(chalk.cyan(`Database: ${db.databaseName}${APPLY ? '' : chalk.gray(' (dry run, nothing is written)')}\n`));

    try {
        const departments = new Map((await db.collection('departments').find({}, { projection: { name: 1, clientId: 1 } }).toArray())
            .map(d => [d._id.toString(), d]));
        const stock = db.collection('department_stock');
        const items = await stock.find({}, { projection: { departmentId: 1, clientId: 1, isDeleted: 1, sku: 1, productName: 1, createdAt: 1 } })
            .sort({ createdAt: 1, _id: 1 })
            .toArray();

        const updates = [];
        const orphans = [];
        const takenByDepartment = new Map();
        let clientIds = 0, deletedFlags = 0, newSkus = 0;

        // Every SKU in use, so the new ones don't collide with any (deleted products included, to be safe)
        for (const item of items) {
            const key = item.departmentId?.toString();
            if (!takenByDepartment.has(key)) takenByDepartment.set(key, new Set());
            if (item.sku) takenByDepartment.get(key).add(item.sku);
        }

        const liveSkus = new Map(); // departmentId -> Set of SKUs already kept by an older live product
        for (const item of items) {
            const department = departments.get(item.departmentId?.toString());
            if (!department) {
                orphans.push(item);
                continue;
            }
            const set = {};
            if (!item.clientId && department.clientId) {
                set.clientId = department.clientId;
                clientIds++;
            }
            if (item.isDeleted === undefined || item.isDeleted === null) {
                set.isDeleted = false;
                deletedFlags++;
            }
            if (item.isDeleted !== true) {
                const key = department._id.toString();
                if (!liveSkus.has(key)) liveSkus.set(key, new Set());
                const kept = liveSkus.get(key);
                if (!item.sku || kept.has(item.sku)) {
                    set.sku = uniqueSku(department.name, takenByDepartment.get(key));
                    newSkus++;
                    console.log(chalk.yellow('  ~'), `${department.name}: "${item.productName}" ${item.sku || '(no SKU)'} -> ${set.sku}`);
                }
                kept.add(set.sku ?? item.sku);
            }
            if (Object.keys(set).length > 0) updates.push({ updateOne: { filter: { _id: item._id }, update: { $set: set } } });
        }

        for (const item of orphans) {
            console.log(chalk.red('  !'), `"${item.productName}" (${item._id}) belongs to a department that no longer exists`);
        }

        console.log(`\n${items.length} products checked.`);
        console.log(`  clientId to set:      ${clientIds}`);
        console.log(`  isDeleted to set:     ${deletedFlags}`);
        console.log(`  repeated SKUs to fix: ${newSkus}`);
        console.log(`  without a department: ${orphans.length}`);

        if (updates.length === 0) {
            console.log(chalk.green.bold('\nNothing to change.'));
        } else if (APPLY) {
            const result = await stock.bulkWrite(updates, { ordered: false });
            console.log(chalk.green.bold(`\n${result.modifiedCount} products updated.`));
        } else {
            console.log(chalk.gray(`\n${updates.length} products would change. Run with --apply to update them.`));
        }
    } finally {
        await mongoClient.close();
    }
}

main().catch((error) => {
    console.error(chalk.red.bold('\n[ERROR]'), error);
    process.exit(1);
});
