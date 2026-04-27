import { ROLES } from "./constants";
import { ObjectId } from "mongodb";

export const getTenantQuery = (session: any) => {
    if (session?.user?.role === ROLES.SUPERADMIN) {
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

    return { _id: new ObjectId("000000000000000000000000") };
};