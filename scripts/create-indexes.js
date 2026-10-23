// Creates the indexes the app's queries rely on. Without them every poll from the runner and stock pages,
// and every session check, scans whole collections.
// Safe to run again: indexes that already exist are left as they are.
//
// Usage:
//   node scripts/create-indexes.js

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

/** [collection, keys, what uses it] */
const INDEXES = [
    // Session check on every request (auth.ts), and the users list of an organization
    ['users', { email: 1 }, 'session lookup by email'],
    ['users', { 'organizations.clientId': 1 }, 'users of an organization'],
    ['roles', { slug: 1 }, 'role permissions'],
    ['clients', { clientCode: 1 }, 'join by code'],
    ['departments', { clientId: 1 }, 'departments of an organization'],
    // Runner and department stock pages (polled), and the consumption report
    ['department_stock', { departmentId: 1, productName: 1 }, 'stock of a department, sorted by name'],
    // Consumption report and movement drill-down
    ['stock_movements', { inventoryId: 1, createdAt: 1 }, 'movements of an item by date'],
    ['stock_movements', { clientId: 1, createdAt: -1 }, 'movements of an organization'],
];

async function main() {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);

    try {
        for (const [collection, keys, purpose] of INDEXES) {
            const name = await db.collection(collection).createIndex(keys);
            console.log(chalk.green('✓'), `${collection}.${name}`, chalk.gray(`(${purpose})`));
        }
        console.log(chalk.green.bold(`\n${INDEXES.length} indexes in place.`));
    } finally {
        await mongoClient.close();
    }
}

main().catch((error) => {
    console.error(chalk.red.bold('\n[ERROR]'), error);
    process.exit(1);
});
