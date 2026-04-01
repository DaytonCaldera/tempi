'use client';
import { useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Label from '@/components/ui/label';
import { useSession } from 'next-auth/react';
import { ROLES } from '@/lib/constants';
// import Label from '@/components/ui/label';



interface DepartmentFormProps {
    initialData?: {
        id?: string;
        clientId?: string;
        name: string;
    };
    onSubmit: (data: { clientId?: string; name: string }) => Promise<void>;
    isLoading?: boolean;
}

export default function DepartmentForm({
    initialData,
    onSubmit,
    isLoading = false,
}: DepartmentFormProps) {
    const [formData, setFormData] = useState({
        clientId: initialData?.clientId || '',
        name: initialData?.name || '',
    });
    const [error, setError] = useState<string>('');
    const isSuperAdmin = useSession().data?.user?.role === ROLES.SUPERADMIN;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }

        try {
            await onSubmit(formData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    return (
        <form action="#">
            <div className="p-6.5">
                <div className="mb-4.5">
                    <label className="mb-2.5 block text-black dark:text-white">
                        Client ID
                    </label>
                    <div className="relative z-20 bg-transparent dark:bg-form-input">
                        {isSuperAdmin ? (<></>) : (<select className="relative z-20 w-full appearance-none rounded border border-stroke bg-transparent py-3 px-5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary">
                            
                        </select>)}
                        <span className="absolute top-1/2 right-4 z-30 -translate-y-1/2">
                            <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10l5 5 5-5H7z" />
                            </svg>
                        </span>
                    </div>
                </div>

                <div className="mb-4.5">
                    <label className="mb-2.5 block text-black dark:text-white">
                        Department ID <span className="text-meta-1">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="Enter Department ID (e.g., DEPT-01)"
                        className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                    />
                </div>

                <button className="flex w-full justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90">
                    Save Assignment
                </button>
            </div>
        </form>
    );
}