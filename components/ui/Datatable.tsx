import React from "react";

interface DataTableProps {
  headers: string[];
  children: React.ReactNode;
}

export function DataTable({ headers, children }: DataTableProps) {
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              {headers.map((header) => (
                <th 
                  key={header} 
                  className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataTableRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors duration-150">
      {children}
    </tr>
  );
}

export function DataTableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-6 py-4 text-sm text-[#171717] ${className}`}>
      {children}
    </td>
  );
}