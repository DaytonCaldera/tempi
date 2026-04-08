"use client";
import { useEffect, useState } from "react";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/Datatable";
import { Modal } from "@/components/ui/Modal";
import { ROLES } from "@/lib/constants";
import { Users, Package, Edit3, Plus, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DepartmentManagementClient({
    initialDepartments,
    clients,
    userRole,
    userClientId
}: any) {
    const [depts, setDepts] = useState(initialDepartments);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<any>(null);

    const [viewingPersonnel, setViewingPersonnel] = useState<any[] | null>(null);
    const [activeDeptName, setActiveDeptName] = useState("");

    const handleViewPersonnel = async (deptId: string, deptName: string) => {
        setActiveDeptName(deptName);
        // Fetch users filtered by this specific department
        const res = await fetch(`/api/admin/departments/personnel?deptId=${deptId}`);
        const data = await res.json();
        setViewingPersonnel(data.users);
    };

    const tableHeaders = [
        { title: "Departamento" },
        { title: "Info", hideOnMobile: true },
        { title: "Acciones" }
    ];

    // Form State
    const [formData, setFormData] = useState({ name: "", clientId: userClientId || "" });

    const openModal = (dept: any = null) => {
        if (dept) {
            setEditingDept(dept);
            setFormData({ name: dept.name, clientId: dept.clientId });
        } else {
            setEditingDept(null);
            setFormData({ name: "", clientId: userClientId || "" });
        }
        setIsModalOpen(true);
    };

    useEffect(() => {
        setDepts(initialDepartments);
    }, [initialDepartments]);

    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();

    const fetchEditingDept = async (deptId: string, formData: any) => {
        return await fetch("/api/admin/departments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: deptId,
                name: formData.name,
                clientId: formData.clientId
            }),
        });
    }

    const fetchInsertDept = async (formData: any) => {
        return await fetch("/api/admin/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: formData.name,
                clientId: formData.clientId
            }),
        });
    }

    const handleSave = async () => {
        // Validation
        if (!formData.name || !formData.clientId) {
            alert("Por favor completa todos los campos");
            return;
        }

        setIsSaving(true);
        try {
            let res: any;
            if (editingDept) {
                res = await fetchEditingDept(editingDept._id, formData);
            } else {
                res = await fetchInsertDept(formData);
            }

            if (res.ok) {
                setIsModalOpen(false);
                setFormData({ name: "", clientId: userClientId || "" });
                router.refresh();
            } else {
                const data = await res.json();
                alert(data.error || "Error al guardar");
            }
        } catch (err) {
            alert("Error de conexión");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between mb-4 sm:flex-row sm:items-center">
                <h1 className="text-2xl font-bold text-[#171717]">Departamentos</h1>
                <button
                    onClick={() => openModal()}
                    className="bg-[#0070f3] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all"
                >
                    + Añadir Departamento
                </button>
            </div>

            <DataTable headers={tableHeaders}>
                {depts.map((dept: any) => (
                    <DataTableRow key={dept._id}>
                        <DataTableCell>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-[#0070f3]">
                                    <Building2 size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[#171717] leading-none">{dept.name}</span>
                                    <span className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">ID: {dept._id.slice(-6)}</span>
                                </div>
                            </div>
                        </DataTableCell>
                        <DataTableCell className="hidden sm:block">
                            <div className="flex -space-x-2">
                                {/* Placeholder for user avatars if you have them */}
                                <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                    +8
                                </div>
                                <span className="ml-4 text-xs font-medium text-gray-500 flex items-center">Miembros</span>
                            </div>
                        </DataTableCell>
                        <DataTableCell>
                            <div className="flex items-center justify-start gap-1">
                                <button
                                    onClick={() => handleViewPersonnel(dept._id, dept.name)}
                                    className="p-2 text-gray-400 hover:text-[#0070f3] hover:bg-blue-50 rounded-lg transition-all"
                                >
                                    <Users size={18} />
                                </button>
                                <Link
                                    href={`/admin/departments/${dept._id}/stock`}
                                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                    title="Revisar Stock"
                                >
                                    <Package size={18} />
                                </Link>
                                <div className="w-px h-4 bg-gray-200 mx-2" />
                                <button
                                    onClick={() => openModal(dept)}
                                    className="px-3 py-1.5 bg-gray-50 text-[#171717] hover:bg-gray-100 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                                >
                                    <Edit3 size={14} />
                                    Editar
                                </button>
                            </div>
                        </DataTableCell>
                    </DataTableRow>
                ))}
            </DataTable>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDept ? "Editar Departamento" : "Nuevo Departamento"}
            >
                <div className="space-y-4">
                    {userRole === ROLES.SUPERADMIN && !editingDept && (
                        <div>
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Cliente</label>
                            <select
                                className="w-full p-3 bg-gray-50 border rounded-xl text-sm"
                                value={formData.clientId}
                                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                            >
                                <option value="">Seleccionar Cliente</option>
                                {clients.map((c: any) => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Nombre del Departamento</label>
                        <input
                            type="text"
                            placeholder="Ej. Logística"
                            className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-[#0070f3]"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-[#171717] text-white py-4 rounded-2xl font-bold mt-6 hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            editingDept ? "Guardar Cambios" : "Crear Departamento"
                        )}
                    </button>
                </div>
            </Modal>

            <Modal
                isOpen={viewingPersonnel !== null}
                onClose={() => setViewingPersonnel(null)}
                title={`Personal: ${activeDeptName}`}
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {viewingPersonnel?.length === 0 && (
                        <p className="text-center py-10 text-gray-400 text-sm italic">
                            No hay personal asignado a este departamento.
                        </p>
                    )}

                    {viewingPersonnel?.map((user) => (
                        <div key={user._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-transparent hover:border-gray-200 transition-all">
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-[#171717]">{user.name}</span>
                                <span className="text-[10px] text-gray-500 uppercase font-semibold">{user.role}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-[10px] font-bold text-gray-400">
                                    {user.isActive ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
}