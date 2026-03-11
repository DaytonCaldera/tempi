import React from "react";

// Define the available looks
type CardVariant = "default" | "primary" | "outline" | "ghost";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
}

export function Card({ children, className = "", variant = "default" }: CardProps) {
  // Logic for variant-based styles
  const variantStyles = {
    default: "bg-white border-gray-200/60 shadow-sm text-black/80",
    primary: "bg-[#0070f3] text-white shadow-blue-200"
  };

  return (
    <div className={`rounded-xl shadow-sm border flex flex-col transition-all ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, className = "" }: { title: string; subtitle?: string; className?: string }) {
  return (
    <div className={`p-6 pb-2 ${className}`}>
      <h3 className="text-lg font-bold leading-tight">{title}</h3>
      {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 flex-1 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "", separator = true }: { children: React.ReactNode; className?: string; separator?: boolean }) {
  return (
    <div className={`p-6 pt-2 flex items-center justify-center ${separator ? 'border-t border-black/5' : ''} ${className}`}>
      {children}
    </div>
  );
}