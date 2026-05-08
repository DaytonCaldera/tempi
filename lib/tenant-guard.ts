import { ObjectId } from "mongodb";
import { ROLES } from "./constants";

export const getTenantQuery = (session: any) => {
    if (session?.user?.role === ROLES.SUPERADMIN) {
        console.log(session.user.clientId);
        
        // Si el superadmin eligió un cliente en el switcher, filtramos por ese.
        // Si no (clientId es 'all' o null), devolvemos {} para ver todo.
        if (session.user.clientId && session.user.clientId !== 'all' && session.user.clientId !== 'sup') {
            return { clientId: new ObjectId(session.user.clientId) };
        }
        return {}; 
    }

    // 2. Si es Admin regular, forzamos su clientId
    if (session?.user?.clientId) {
        return { clientId: new ObjectId(session.user.clientId) };
    }

    return { _id: new ObjectId("000000000000000000000000")   };
};


export const getUserTenantQuery = (session: any) => {
    // 1. Logic for SUPERADMIN
    if (session?.user?.role === ROLES.SUPERADMIN) {
        // If superadmin selected a specific client in the switcher
        if (
            session.user.clientId && 
            session.user.clientId !== 'all' && 
            session.user.clientId !== 'sup'
        ) {
            return { "organizations.clientId": new ObjectId(session.user.clientId) };
        }
        
        // If 'all' or 'sup', return empty query to see all users across all orgs
        return {}; 
    }

    // 2. Logic for Regular Admin / User
    // We filter users who belong to the same organization as the current user
    if (session?.user?.clientId) {
        return { "organizations.clientId": new ObjectId(session.user.clientId) };
    }

    // 3. Fallback: return a query that matches nothing if session is invalid
    return { _id: new ObjectId("000000000000000000000000") };
};

/**
 * Returns a filter query specifically for the "clients" collection.
 * This is used to restrict which client/organization documents a user can see.
 */
export const getClientTenantQuery = (session: any) => {
    // 1. Logic for SUPERADMIN
    if (session?.user?.role === ROLES.SUPERADMIN) {
        
        // If the superadmin has a specific client selected in the switcher
        if (
            session.user.clientId && 
            session.user.clientId !== 'all' && 
            session.user.clientId !== 'sup'
        ) {
            // In the clients collection, we match against the document's _id
            return { _id: new ObjectId(session.user.clientId) };
        }
        
        // If 'all' or 'sup', return empty query to allow access to all client documents
        return {}; 
    }

    // 2. Logic for Regular Admin / User
    // They should only ever be able to see/access their own client document
    if (session?.user?.clientId) {
        return { _id: new ObjectId(session.user.clientId) };
    }

    // 3. Fallback: match a non-existent ID if the session is invalid
    return { _id: new ObjectId("000000000000000000000000") };
};