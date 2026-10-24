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

/** [collection, keys, what uses it, options?] */
const INDEXES = [
    // Session check on every request (auth.ts), and the users list of an organization
    ['users', { email: 1 }, 'session lookup by email'],
    ['users', { 'organizations.clientId': 1 }, 'users of an organization'],
    // Sign-in looks the account up by provider id (Auth.js getUserByAccount): unique, so a sign-in can't
    // store a second copy that findOne might pick over the right one
    ['accounts', { provider: 1, providerAccountId: 1 }, 'sign-in by provider account', { unique: true }],
    ['roles', { slug: 1 }, 'role permissions'],
    ['clients', { clientCode: 1 }, 'join by code'],
    ['departments', { clientId: 1 }, 'departments of an organization'],
    // Runner and department stock pages (polled), and the consumption report
    ['department_stock', { departmentId: 1, productName: 1 }, 'stock of a department, sorted by name'],
    // One SKU per department among products that aren't deleted (the routes also check it first, for a clear error).
    // Run scripts/backfill-stock-fields.js before: it sets isDeleted: false and fixes repeated SKUs
    ['department_stock', { departmentId: 1, sku: 1 }, 'unique SKU in a department', { unique: true, partialFilterExpression: { isDeleted: false } }],
    // Same for barcodes, among the products that have one (the runner finds a scanned product by it)
    ['department_stock', { departmentId: 1, barcode: 1 }, 'unique barcode in a department', { unique: true, partialFilterExpression: { isDeleted: false, barcode: { $exists: true } } }],
    // Consumption report and movement drill-down
    ['stock_movements', { inventoryId: 1, createdAt: 1 }, 'movements of an item by date'],
    ['stock_movements', { clientId: 1, createdAt: -1 }, 'movements of an organization'],
    // Moves made without connection (lib/offline-sync.ts): each id the device gave applies or is held once
    ['stock_movements', { offlineId: 1 }, 'offline move applied once', { unique: true, partialFilterExpression: { offlineId: { $exists: true } } }],
    ['held_movements', { offlineId: 1 }, 'offline move held once', { unique: true }],
    ['held_movements', { clientId: 1, status: 1, heldAt: 1 }, 'pending held moves of an organization'],
    ['held_movements', { 'user.email': 1, status: 1 }, 'pending held moves of a runner'],
    // Dashboard (lib/dashboard.ts): movements and consumption of some departments in a period
    ['stock_movements', { departmentId: 1, createdAt: -1 }, 'movements of departments by date'],
    // Superadmin panel (lib/superadmin.ts): activity by period, and the audit log
    ['stock_movements', { createdAt: -1 }, 'movements of a period (superadmin overview)'],
    ['users', { lastSeenAt: -1 }, 'active users (superadmin overview)'],
    ['clients', { createdAt: -1 }, 'organizations registry, newest first'],
    ['audit_log', { createdAt: -1 }, 'audit log, newest first'],
    ['audit_log', { action: 1, createdAt: -1 }, 'audit log filtered by action'],
    ['audit_log', { clientId: 1, createdAt: -1 }, 'history of an organization'],
    ['audit_log', { 'actor.email': 1, createdAt: -1 }, 'history of a user'],
    ['audit_log', { 'target.id': 1, createdAt: -1 }, 'actions done to a user'],
    // One document per user per day (lib/activity.ts): unique, so the daily upsert can't duplicate it
    ['user_activity', { email: 1, day: 1 }, 'daily activity of a user', { unique: true }],
    ['user_activity', { day: 1 }, 'active users per day'],
    ['stock_movements', { 'user.email': 1, createdAt: 1 }, 'first movement of a user (onboarding funnel)'],
    // Sign-in email throttle (lib/magic-link.ts): the TTL deletes requests once they are outside its window
    ['magic_link_requests', { email: 1, createdAt: -1 }, 'recent sign-in emails of an address'],
    ['magic_link_requests', { createdAt: 1 }, 'expire old sign-in email requests', { expireAfterSeconds: 3600 }],
];

async function main() {
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);

    try {
        for (const [collection, keys, purpose, options] of INDEXES) {
            const name = await db.collection(collection).createIndex(keys, options);
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
