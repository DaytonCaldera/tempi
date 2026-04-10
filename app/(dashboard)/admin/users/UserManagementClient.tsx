"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";
import { Modal } from "@/components/ui/Modal";
import { UserCheck, Shield, MapPin, Edit3, Trash2, UserPlus } from "lucide-react";
import { ROLES } from "@/lib/constants";

export default function UserManagementClient({ users: initialUsers, departments }: { users: any[], departments: any[] }) {
    const router = useRouter();
    const [users, setUsers] = useState(initialUsers);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Sync state with server props
    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);

    const openEditModal = (user: any) => {
        setSelectedUser(user);
        // Ensure we handle the array of strings correctly
        setSelectedDepts(user.departments || []);
    };

    const handleConfirm = async () => {
        setLoading(true);
        const res = await fetch("/api/admin/users/toggle-status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: selectedUser._id,
                isActive: true, // Approving or keeping active
                departments: selectedDepts
            }),
        });

        if (res.ok) {
            setSelectedUser(null);
            router.refresh();
        }
        setLoading(false);
    };

    const handleApprove = async (userId: string) => {
        // You would ideally show a Modal here to pick the Department
        const res = await fetch('/api/admin/users/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                deptId: departments[0]._id // Defaulting to the first dept for now
            })
        });

        if (res.ok) {
            // Refresh local state or router.refresh()
            router.refresh();
        }
    };

    const tableHeaders = [
        { title: "Usuario" },
        { title: "Rol & Áreas" },
        { title: "Estado" },
        { title: "Acciones" }
    ];

    return (
        <>
            <DataTable headers={tableHeaders}>
                {users.map((user) => (
                    <DataTableRow key={user._id}>
                        {/* 1. USER IDENTITY */}
                        <DataTableCell>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold border border-gray-200">
                                    {user.name?.charAt(0) || "U"}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[#171717] leading-tight">{user.name}</span>
                                    <span className="text-[10px] text-[#0070f3] font-bold mt-1 uppercase tracking-wider">
                                        {user.clientCode}
                                    </span>
                                </div>
                            </div>
                        </DataTableCell>

                        {/* 2. ROLE & DEPARTMENTS */}
                        <DataTableCell>
                            <div className="flex flex-col gap-2 min-w-50">
                                {/* Role label - Small and clean */}
                                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                    <Shield size={10} strokeWidth={3} />
                                    {user.role}
                                </div>

                                {/* Departments - Bigger and colorful */}
                                <div className="flex flex-wrap gap-1.5">
                                    {user.departments?.length > 0 ? (
                                        <>
                                            {user.departments.slice(0, 2).map((deptId: string) => {
                                                const dept = departments.find(d => d._id === deptId);
                                                console.log(departments, dept);

                                                return (
                                                    <span
                                                        key={deptId}
                                                        className="px-3 py-1 bg-blue-50 text-[#0070f3] border border-blue-100 rounded-lg text-[10px] font-bold whitespace-nowrap"
                                                    >
                                                        {dept?.name || 'Dept'}
                                                    </span>
                                                );
                                            })}
                                            {user.departments.length > 2 && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold">
                                                    +{user.departments.length - 2}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-[10px] font-medium text-gray-300 italic">
                                            Sin asignar
                                        </span>
                                    )}
                                </div>
                            </div>
                        </DataTableCell>

                        {/* 3. STATUS BADGE */}
                        <DataTableCell>
                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${user.isActive ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-orange-500'}`} />
                                <span className="text-[10px] font-bold uppercase tracking-wide">
                                    {user.isActive ? "Activo" : "Pendiente"}
                                </span>
                            </div>
                        </DataTableCell>

                        {/* 4. ACTIONS (Department UI Style) */}
                        <DataTableCell>
                            <div className="flex items-center justify-end gap-1">
                                {!user.isActive || (user.role === ROLES.PENDING_USER) ? (
                                    <button
                                        onClick={() => openEditModal(user)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-bold hover:bg-green-700 transition-all shadow-sm"
                                    >
                                        <UserCheck size={14} />
                                        APROBAR
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="p-2 text-gray-400 hover:text-[#0070f3] hover:bg-blue-50 rounded-lg transition-all"
                                            title="Editar Departamentos"
                                        >
                                            <MapPin size={18} />
                                        </button>
                                        <button
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Desactivar Usuario"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </DataTableCell>
                    </DataTableRow>
                ))}
            </DataTable>

            {/* MODAL - Consistent with Department Style */}
            <Modal
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                title={selectedUser?.isActive ? "Gestionar Usuario" : "Aprobar Usuario"}
            >
                <div className="space-y-6">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Usuario seleccionado</p>
                        <p className="text-sm font-bold text-black">{selectedUser?.name}</p>
                        <p className="text-xs text-gray-500">{selectedUser?.email}</p>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-4 tracking-widest">
                            Asignación de Áreas
                        </p>

                        {/* 2-Column Grid for better readability */}
                        <div className="grid grid-cols-2 gap-3">
                            {departments.map((dept) => {
                                const isSelected = selectedDepts.includes(dept._id);
                                return (
                                    <button
                                        key={dept._id}
                                        type="button"
                                        onClick={() => setSelectedDepts(prev =>
                                            prev.includes(dept._id) ? prev.filter(id => id !== dept._id) : [...prev, dept._id]
                                        )}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all ${isSelected
                                            ? "bg-blue-50 border-[#0070f3] text-[#0070f3] shadow-sm"
                                            : "bg-white border-gray-100 text-gray-500 hover:border-gray-300 shadow-sm"
                                            }`}
                                    >
                                        <span className="truncate mr-2">{dept.name}</span>

                                        {/* Visual Checkmark for Selected State */}
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected
                                            ? "bg-[#0070f3] border-[#0070f3]"
                                            : "border-gray-200"
                                            }`}>
                                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={loading || selectedDepts.length === 0}
                        className="w-full bg-[#171717] text-white py-4 rounded-2xl font-bold disabled:opacity-50 transition-all hover:bg-black shadow-lg"
                    >
                        {loading ? "Procesando..." : selectedUser?.isActive ? "Actualizar" : "Confirmar y Activar"}
                    </button>
                </div>
            </Modal>
        </>
    );
}