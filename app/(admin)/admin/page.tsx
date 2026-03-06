'use client'
import auth from "next-auth/react";
import { SignOut } from "@/components/auth-components";
import { useEffect, useState } from "react";

export default function Page() {
    const session = auth.useSession();
    const [name, setName] = useState("");
    useEffect(() => {
        if (session?.data?.user?.name) {
            setName(session.data.user.name);
        }
    }, [session]);

    return (
        <main>
            <h1>hello from dev</h1>
            {
                session?.data?.user?.name !== "" ? (
                    <>
                        <p>Logged in as {session?.data?.user?.name}</p>
                        <SignOut /></>
                ) : <p>Not logged in</p>
            }
        </main>
    );
}