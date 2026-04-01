"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StatusToggle({
    userId,
    isActive,
    availableDepartments,
    userDepartments
}: {
    userId: string;
    isActive: boolean;
    availableDepartments: any[];
    userDepartments: string[];
}) {
    const [isPending, setIsPending] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [selectedDepts, setSelectedDepts] = useState<string[]>(userDepartments);
    const router = useRouter();

    const handleUpdate = async (newState: boolean) => {
        setIsPending(true);
        try {
            const res = await fetch("/api/admin/users/toggle-status", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    isActive: !isActive, // Toggle
                    departments: selectedDepts // Send the selected departments
                }),
            });

            if (res.ok) {
                setShowPicker(false);
                router.refresh();
            }
        } finally {
            setIsPending(false);
        }
    };

    const toggleDept = (id: string) => {
        setSelectedDepts(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    return (
        <div className="relative">
            {!isActive ? (
                <div className="flex flex-col gap-2">
                    {!showPicker ? (
                        <button
                            onClick={() => setShowPicker(true)}
                            className="text-xs font-bold px-4 py-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100"
                        >
                            Aprobar Usuario
                        </button>
                    ) : (
                        <div className="bg-white border p-3 rounded-xl shadow-xl absolute right-0 top-0 z-10 w-64 space-y-3">
                            <p className="text-[10px] font-bold uppercase text-gray-400">Asignar Departamentos</p>
                            <div className="flex flex-wrap gap-1">
                                {availableDepartments.map(dept => (
                                    <button
                                        key={dept._id}
                                        onClick={() => toggleDept(dept._id)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${selectedDepts.includes(dept._id)
                                                ? "bg-[#0070f3] text-white"
                                                : "bg-gray-100 text-gray-500"
                                            }`}
                                    >
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdate(true)}
                                    className="flex-1 bg-green-600 text-white text-[10px] py-2 rounded-lg font-bold"
                                >
                                    Confirmar
                                </button>
                                <button
                                    onClick={() => setShowPicker(false)}
                                    className="px-3 bg-gray-100 text-gray-500 text-[10px] py-2 rounded-lg"
                                >
                                    X
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => handleUpdate(false)}
                    disabled={isPending}
                    className="text-xs font-bold px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl"
                >
                    Desactivar
                </button>
            )}
        </div>
    );
}