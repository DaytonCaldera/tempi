import { SignOut } from "../auth-components";
import TaskTable from "../TaskTable";

export default function TestDashboard({ session }: { session: any }) {
    return (
        <div className="space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                        Command Center
                    </h2>
                    <p className="text-gray-400">Welcome back, {session.user?.name}</p>
                </div>
                <div className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-400 font-mono">
                    ROLE: {session.user?.role?.toUpperCase()}
                    <pre>{JSON.stringify(session, null, 2)}</pre>
                </div>
            </header>

            <div className="grid gap-6">
                <TaskTable />
            </div>
            <div><SignOut /></div>
        </div>
    )
}