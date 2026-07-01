import mongo from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function getCurrentClientName(clientId: string) {
    const client = await mongo;
    const db = client.db(process.env.MONGODB_DB);
    
    // Look up the role document you seeded in the 'roles' collection
    const roleDoc = await db.collection('clients').findOne({ '_id': new ObjectId(clientId) });
    console.log(clientId, roleDoc);
    
    
    // Return the client name or an empty string 
    return roleDoc?.name || "";
}