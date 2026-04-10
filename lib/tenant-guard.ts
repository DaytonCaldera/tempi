import { ROLES } from "./constants";
import { ObjectId } from "mongodb";

export const getTenantQuery = (session: any) => {
    // If Superadmin, return an empty object to fetch EVERYTHING
    if (session?.user?.role === ROLES.SUPERADMIN) {
        return {};
    }

    // If regular Admin, filter by their clientId
    if (session?.user?.clientId) {
        return { clientId: new ObjectId(session.user.clientId) };
    }

    // Safety fallback: if no client is found, return a query that matches nothing
    return { _id: new ObjectId("000000000000000000000000") };
};