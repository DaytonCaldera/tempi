import mongo from '@/lib/mongodb';
import { ROLES } from '@/lib/constants';
import * as authModule from "@/auth";

export async function POST(request: Request) {
    console.log(Object.keys(authModule));
    
    const { auth } = authModule; 
    console.log(typeof auth);
    
    if (typeof auth !== 'function') {
        console.error("Auth is still not a function:", auth);
        return Response.json({ message: "Auth initialization failed" }, { status: 500 });
    }

    const session = await authModule.auth();
    try {
        console.log('Current user:', session?.user);
        
        const client = await mongo;
        const { code } = await request.json();

        if (!code) {
            return Response.json(
                { message: errorMessages[400] },
                { status: 400 }
            );
        }

        await client.connect();
        const db = client.db(process.env.MONGODB_DB);
        const collection = db.collection('clients');

        const result = await collection.findOne({ code });

        if (!result) {
            return Response.json(
                { message: errorMessages[404] },
                { status: 404 }
            );
        }
        
        db.collection('users').updateOne(
            { email: session.user.email },
            {
                $set: {
                    clientCode: code,
                    role: ROLES.PENDING_USER,
                    clientId: result._id.toString()
                }
            }
        );

        return Response.json(
            { success: true },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return Response.json(
            { message: errorMessages[500] },
            { status: 500 }
        );
    }
}

const errorMessages = {
    404: 'Código no encontrado. Por favor, verifica el código proporcionado.',
    400: 'Código inválido. Asegúrate de ingresar un código válido.',
    500: 'Error del servidor. Por favor, intenta nuevamente más tarde.'
}