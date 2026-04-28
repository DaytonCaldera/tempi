'use server'
import mongo from "@/lib/mongodb";
/**
 * Checks if a specific role has a required permission.
 * In a real-world scenario, you might fetch this from the DB and cache it.
 * For now, we use the session data which will contain the role's permission set.
 */


export async function getRolePermissions(roleSlug: string) {
    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);
    
    // Look up the role document you seeded in the 'roles' collection
    const roleDoc = await db.collection('roles').findOne({ slug: roleSlug });
    
    // Return the permissions object (e.g., { manage_users: true, ... }) or an empty object
    return roleDoc?.permissions || {};
}