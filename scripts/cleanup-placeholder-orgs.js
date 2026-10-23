// Limpieza de usuarios afectados por el bucle del lobby.
//
// Antes, al registrarse, cada usuario recibía una organización falsa "sup22" que quedaba como
// organización activa. Al volver a iniciar sesión, esa entrada ganaba sobre la organización real
// y el usuario regresaba al lobby. Este script, por cada usuario:
//   - quita las entradas "sup22" de organizations
//   - quita entradas duplicadas de la misma organización (se queda con la que no está pendiente)
//   - corrige activeOrganization si apunta a "sup22" o a una organización que el usuario no tiene
//   - quita el clientId "sup22" de nivel superior
// También lista los dueños con varias organizaciones creadas (posibles duplicados del bucle),
// pero NO borra ninguna: revísalas a mano.
//
// Uso:
//   node scripts/cleanup-placeholder-orgs.js          -> solo muestra lo que cambiaría
//   node scripts/cleanup-placeholder-orgs.js --apply  -> aplica los cambios

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const chalk = require('chalk');
const dns = require('node:dns/promises');

// Forzar el uso de servidores DNS públicos para evitar el error querySrv ECONNREFUSED
dns.setServers(['8.8.8.8', '1.1.1.1']);

const PLACEHOLDER_CLIENT_ID = 'sup22';
const PENDING_ROLE = 'pending_user';
const APPLY = process.argv.includes('--apply');

const URI_MONGO = process.env.MONGODB_URI;
const NOMBRE_BD = process.env.MONGODB_DB;
if (!URI_MONGO || !NOMBRE_BD) {
    console.error(chalk.red.bold('\n[ERROR CRÍTICO] Faltan MONGODB_URI o MONGODB_DB en el archivo .env.local\n'));
    process.exit(1);
}

const idToString = (id) => (id == null ? null : id.toString());
const isPlaceholder = (org) => !org?.clientId || idToString(org.clientId) === PLACEHOLDER_CLIENT_ID;

/**
 * Calcula el estado corregido de un usuario. Devuelve null si no hay nada que cambiar.
 */
function buildFix(user) {
    const organizations = user.organizations || [];

    // Una entrada por organización, prefiriendo la que ya fue aprobada
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
            (clientIdIsPlaceholder ? ', quita clientId "sup22"' : '')
    };
}

async function main() {
    const clienteMongo = new MongoClient(URI_MONGO);
    await clienteMongo.connect();
    const db = clienteMongo.db(NOMBRE_BD);

    try {
        console.log(chalk.cyan.bold(`\n${APPLY ? 'APLICANDO CAMBIOS' : 'SIMULACIÓN (usa --apply para guardar)'} en ${NOMBRE_BD}\n`));

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
        console.log(chalk.green.bold(`\n${changed} de ${users.length} usuarios ${APPLY ? 'corregidos' : 'por corregir'}.`));

        // Organizaciones creadas varias veces por el mismo dueño: solo se reportan
        const duplicates = await db.collection('clients').aggregate([
            { $match: { ownerEmail: { $exists: true } } },
            { $group: { _id: '$ownerEmail', count: { $sum: 1 }, orgs: { $push: { id: '$_id', name: '$name', createdAt: '$createdAt' } } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicates.length > 0) {
            console.log(chalk.cyan.bold('\nDueños con varias organizaciones (revisar a mano, no se borran):'));
            for (const owner of duplicates) {
                console.log(chalk.yellow(owner._id));
                for (const org of owner.orgs) {
                    console.log(chalk.gray(`   ${org.id}  ${org.name}  ${org.createdAt ? new Date(org.createdAt).toISOString() : ''}`));
                }
            }
        }
    } finally {
        await clienteMongo.close();
    }
}

main().catch((error) => {
    console.error(chalk.red.bold('\n[ERROR]'), error);
    process.exit(1);
});
