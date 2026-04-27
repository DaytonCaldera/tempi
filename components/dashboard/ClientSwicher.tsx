// components/dashboard/SuperAdminSwitcher.tsx
'use client';
import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { Globe, Search, Building2, Check, ChevronsUpDown } from "lucide-react";

export default function SuperAdminSwitcher({ className }: { className?: string }) {
    const { data: session, update } = useSession();
    const [clients, setClients] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (session?.user?.role === 'superadmin') {
            fetch('/api/admin/clients')
                .then(res => res.json())
                .then(data => setClients(data));
        }
    }, [session]);

    // Cerrar el dropdown si haces click afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (session?.user?.role !== 'superadmin') return null;

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const currentClientName = clients.find(c => c._id === session?.user?.clientId)?.name || "Global (Ver Todo)";

    const handleSelect = async (clientId: string) => {
        setIsOpen(false);
        await update({ clientId: clientId });
        window.location.reload();
    };

    return (
        <div className={`mx-4 mb-6 relative ${className}`} ref={dropdownRef}>
            <label className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest px-1">
                <Globe size={12} /> God Mode
            </label>
            
            {/* Botón Principal (Trigger) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:border-indigo-300 transition-all group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Building2 size={16} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 truncate">
                        {session?.user?.clientId === 'all' || session?.user?.clientId === 'sup' ? "🌍 Global View" : currentClientName}
                    </span>
                </div>
                <ChevronsUpDown size={16} className="text-gray-400" />
            </button>

            {/* Dropdown Flotante */}
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
                        <Search size={14} className="text-gray-400" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm w-full font-medium text-gray-600"
                        />
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar">
                        <button
                            onClick={() => handleSelect('all')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-colors ${!session?.user?.clientId || session?.user?.clientId === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span className="flex items-center gap-2">🌍 Ver Todo (Global)</span>
                            {(!session?.user?.clientId || session?.user?.clientId === 'all') && <Check size={14} />}
                        </button>

                        <div className="h-px bg-gray-100 my-2" />

                        {filteredClients.map(client => (
                            <button
                                key={client._id}
                                onClick={() => handleSelect(client._id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-colors mb-1 ${session?.user?.clientId === client._id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <span className="truncate">{client.name}</span>
                                {session?.user?.clientId === client._id && <Check size={14} />}
                            </button>
                        ))}

                        {filteredClients.length === 0 && (
                            <p className="text-center py-4 text-xs text-gray-400 font-medium">No se encontraron clientes</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}