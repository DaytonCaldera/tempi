'use client';

import auth from 'next-auth/react';
import { SignIn } from '@/components/auth-components';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {

    const session = auth.useSession();



    useEffect(() => {

        // if (session?.user?.email) {
        //     // redirect('/activar');
        // }
        console.log(session);
        
    }, [session]);

    return (
        <main className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* {!session ? ( */}
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
                        Monitoreo de inventario
                    </h2>
                    <div className="space-y-4">

                        <SignIn />

                        <div className="g-signin2" data-onsuccess="onSignIn" data-clientid="341305238542-5inlvdk7s28rk6lh5vna7gpml2quc2fm.apps.googleusercontent.com"></div>
                    </div>
                </div>
            </div>
            {/* ) : <></>} */}
        </main>
    );
}
