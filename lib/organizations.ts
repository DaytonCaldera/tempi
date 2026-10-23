import { getDb, toObjectId } from "@/lib/api";

/** Name of an organization ("clients" collection), or "" if it doesn't exist. */
export async function getOrganizationName(clientId: string): Promise<string> {
    const _id = toObjectId(clientId);
    if (!_id) return "";

    const db = await getDb();
    const organization = await db.collection('clients').findOne({ _id }, { projection: { name: 1 } });
    return organization?.name || "";
}
