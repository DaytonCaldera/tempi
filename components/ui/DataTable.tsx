import React from "react";

interface DataTableProps {
  headers: { title: string; hideOnMobile?: boolean }[];
  children: React.ReactNode;
}

export function DataTable({ headers, children }: DataTableProps) {
  return (
    <div className="w-full bg-card rounded-3xl border border-line overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-subtle/60 border-b border-line">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className={`px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle${header.hideOnMobile ? " hidden md:block" : ""}`}
                >
                  {header.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataTableRow({  children,  onClick, className = ""}: {  children: React.ReactNode;  onClick?: () => void;  className?: string;}) {
  return (
    <tr
      onClick={onClick}
      className={`hover:bg-subtle/60 transition-colors duration-150 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-6 py-4 text-sm text-ink ${className}`}>
      {children}
    </td>
  );
}