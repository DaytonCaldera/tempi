// Repairs stock_movements so the consumption report adds up for every past date.
//
// The report works backwards from each item's current quantity, so every quantity change needs exactly
// one movement. Old data breaks that in three ways; for each one, this script:
//   - "Sincronización inicial del sistema" movements (from /api/admin/reports/sync): never changed the
//     quantity and are dated on the day the sync ran. They are backed up to .mongodb/backups and deleted.
//   - Items created with a quantity but no movement: inserts an "Inventario inicial" IN dated when the
//     item was created (or just before its first movement).
//   - Gaps in the movement chain (a movement whose previousBalance isn't the newBalance of the one before,
//     e.g. two moves at the same time, or a quantity that doesn't match the last movement): inserts a
//     "Conciliación de inventario" movement for the difference, dated inside the gap.
// Movements are walked in date order; the inserted ones carry previousBalance/newBalance, so running the
// script again finds nothing to do.
//
// Usage:
//   node scripts/repair-stock-movements.js          -> only shows what would change
//   node scripts/repair-stock-movements.js --apply  -> applies the changes

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { MongoClient, BSON } = require('mongodb');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Use public DNS servers to avoid the querySrv ECONNREFUSED error
dns.setServers(['8.8.8.8', '1.1.1.1']);

// Same values as MOVEMENT_REASONS in lib/constants.ts
const REASONS = {
    INITIAL_SYNC: 'Sincronización inicial del sistema',
    INITIAL_STOCK: 'Inventario inicial',
    RECONCILIATION: 'Conciliación de inventario',
};
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = path.resolve(__dirname, '..', '.mongodb', 'backups');

const MONGO_URI = process.env.MONGODB_URI;
// Same as the app: without MONGODB_DB, the database named in the URI is used
const DB_NAME = process.env.MONGODB_DB;
if (!MONGO_URI) {
    console.error(chalk.red.bold('\n[FATAL] MONGODB_URI was not found in .env.local\n'));
    process.exit(1);
}

const signedAmount = (m) => (m.type === 'IN' ? 1 : -1) * (Number(m.amount) || 0);
const addMs = (date, ms) => new Date(date.getTime() + ms);

/**
 * Walks an item's movements (oldest first) and returns the movements missing from its history.
 * `running` is the quantity the history explains so far, starting at 0 before the item existed.
 */
function findMissingMovements(item, movements) {
    const createdAt = item.createdAt ? new Date(item.createdAt) : item._id.getTimestamp();
    const firstDate = movements.length > 0 ? new Date(movements[0].createdAt) : null;
    const openingDate = !firstDate || createdAt < firstDate ? createdAt : addMs(firstDate, -1);
    const missing = [];
    let running = 0;
    // Older movements have no previousBalance. Until the first balance is known, any difference is
    // stock the item started with; after that, it's a change that was never logged.
    let anchored = false;

    const addGap = (actual, gapDate) => {
        const difference = actual - running;
        if (difference !== 0) {
            const opening = !anchored;
            missing.push({
                type: difference > 0 ? 'IN' : 'OUT',
                amount: Math.abs(difference),
                // Opening stock goes before every movement: previousBalance 0
                previousBalance: opening ? 0 : running,
                newBalance: opening ? difference : actual,
                reason: opening ? REASONS.INITIAL_STOCK : REASONS.RECONCILIATION,
                createdAt: opening ? openingDate : gapDate,
            });
        }
        running = actual;
        anchored = true;
    };

    movements.forEach((movement, index) => {
        if (typeof movement.previousBalance === 'number') {
            // Somewhere between the previous movement and this one
            const date = new Date(movement.createdAt);
            const previousDate = index > 0 ? new Date(movements[index - 1].createdAt) : openingDate;
            addGap(movement.previousBalance, addMs(date, -1) > previousDate ? addMs(date, -1) : previousDate);
        }
        running += signedAmount(movement);
    });

    // The current quantity must match the end of the history
    const lastDate = movements.length > 0 ? addMs(new Date(movements[movements.length - 1].createdAt), 1) : createdAt;
    addGap(Number(item.quantity) || 0, lastDate);

    return missing;
}

async function main() {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const movementsCol = db.collection('stock_movements');

    try {
        console.log(chalk.cyan.bold(`\n${APPLY ? 'APPLYING CHANGES' : 'DRY RUN (use --apply to save)'} on ${db.databaseName}\n`));

        // 1. Sync movements: back up, then delete
        const syncMovements = await movementsCol.find({ reason: REASONS.INITIAL_SYNC }).toArray();
        console.log(chalk.white(`Sync movements to delete: `) + chalk.yellow.bold(syncMovements.length));
        if (APPLY && syncMovements.length > 0) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            const backupFile = path.join(BACKUP_DIR, `initial-sync-movements-${Date.now()}.json`);
            fs.writeFileSync(backupFile, BSON.EJSON.stringify(syncMovements, null, 2, { relaxed: false }));
            console.log(chalk.gray(`   Backup: ${backupFile}`));
            await movementsCol.deleteMany({ _id: { $in: syncMovements.map(m => m._id) } });
        }

        // 2. Missing movements of every item (deleted ones too: their history is still reported)
        const departments = new Map(
            (await db.collection('departments').find().toArray()).map(d => [d._id.toString(), d])
        );
        const items = await db.collection('department_stock').find().toArray();

        let itemsFixed = 0;
        let inserted = 0;
        for (const item of items) {
            const movements = await movementsCol
                .find({ inventoryId: item._id, reason: { $ne: REASONS.INITIAL_SYNC } })
                .sort({ createdAt: 1, _id: 1 })
                .toArray();

            const missing = findMissingMovements(item, movements);
            if (missing.length === 0) continue;

            itemsFixed++;
            inserted += missing.length;
            const department = departments.get(item.departmentId?.toString());
            console.log(chalk.yellow(`${department?.name ?? item.departmentName ?? '?'} / ${item.productName} (${item._id})`) +
                chalk.gray(`  quantity ${item.quantity ?? 0}, ${movements.length} movements`));
            for (const m of missing) {
                console.log(chalk.gray(`   + ${m.type} ${m.amount}  ${m.reason}  ${m.createdAt.toISOString()}  (${m.previousBalance} -> ${m.newBalance})`));
            }

            if (APPLY) {
                await movementsCol.insertMany(missing.map(m => ({
                    inventoryId: item._id,
                    departmentId: item.departmentId,
                    departmentName: department?.name ?? item.departmentName,
                    clientId: department?.clientId ?? item.clientId,
                    productName: item.productName,
                    sku: item.sku,
                    ...m,
                    user: { id: null, name: null },
                })));
            }
        }

        console.log(chalk.green.bold(`\n${itemsFixed} of ${items.length} items ${APPLY ? 'fixed' : 'to fix'}, ${inserted} movements ${APPLY ? 'inserted' : 'to insert'}.`));
    } finally {
        await mongoClient.close();
    }
}

main().catch((error) => {
    console.error(chalk.red.bold('\n[ERROR]'), error);
    process.exit(1);
});
