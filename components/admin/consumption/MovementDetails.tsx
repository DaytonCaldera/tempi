import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { movementReasonLabel } from "@/i18n/labels";
import type { MovementLog } from "./useConsumptionReport";

/** Movement log of one product, shown when its report row is expanded. */
export function MovementDetails({ details }: { details: MovementLog[] }) {
    const t = useTranslations("reports.movements");
    const tCommon = useTranslations("common");
    const tReasons = useTranslations("movementReasons");
    const format = useFormatter();

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-4 bg-brand rounded-full" />
                <p className="text-xs font-black text-brand uppercase tracking-[0.2em]">{t("title")}</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {details.length === 0 ? (
                    <p className="text-sm font-bold text-brand/40 p-4">{t("empty")}</p>
                ) : (
                    details.map(log => (
                        <div key={log._id} className="flex items-center justify-between bg-white p-5 rounded-3xl shadow-sm hover:shadow-lg transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black bg-brand text-brand-accent">
                                    {log.type === 'IN' ? <ArrowUpRight size={24} strokeWidth={3} /> : <ArrowDownRight size={24} strokeWidth={3} />}
                                </div>
                                <div>
                                    <p className="text-xl font-black text-black leading-tight">
                                        {log.amount} <span className="text-xs text-brand/30 uppercase font-black">{t("units")}</span>
                                    </p>
                                    <p className="text-[11px] text-brand/60 font-black uppercase tracking-tighter">
                                        {log.user?.name || tCommon("system")} • {format.dateTime(new Date(log.createdAt), { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-surface text-brand/60 text-[10px] font-black uppercase tracking-wider rounded-xl">
                                {movementReasonLabel(tReasons, log.reason)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
