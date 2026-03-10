import mongo from '@/lib/mongodb';

const client = mongo();

export async function POST(request) {
    try {
        const { code } = await request.json();

        if (!code) {
            return Response.json(
                { error: 'Code is required' },
                { status: 400 }
            );
        }

        await client.connect();
        const db = client.db(process.env.MONGODB_DB);
        const collection = db.collection('clients');

        const result = await collection.findOne({ code });

        if (!result) {
            return Response.json(
                { error: 'Code not found' },
                { status: 404 }
            );
        }

        return Response.json(
            { success: true, data: result },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return Response.json(
            { error: 'Server error' },
            { status: 500 }
        );
    } finally {
        await client.close();
    }
}