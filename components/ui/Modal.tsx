"use client";

export function Modal({ isOpen, onClose, title, children, footer }: { 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            
            {/* Modal Content */}
            <div className="relative bg-card border border-line w-full max-w-md max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                <div className="p-6 border-b border-line flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-ink-subtle hover:text-ink hover:bg-subtle text-xl">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
                {footer && (
                    <div className="p-6 border-t border-line shrink-0 bg-card">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}