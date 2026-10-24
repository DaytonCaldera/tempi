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
                <div className="w-1.5 h-4 bg-inverse rounded-full" />
                <p className="text-xs font-semibold text-ink uppercase tracking-[0.2em]">{t("title")}</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {details.length === 0 ? (
                    <p className="text-sm font-bold text-ink-subtle p-4">{t("empty")}</p>
                ) : (
                    details.map(log => (
                        <div key={log._id} className="flex items-center justify-between bg-card p-5 rounded-3xl border border-line hover:border-line-strong transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-semibold bg-inverse text-on-inverse">
                                    {log.type === 'IN' ? <ArrowUpRight size={24} strokeWidth={3} /> : <ArrowDownRight size={24} strokeWidth={3} />}
                                </div>
                                <div>
                                    <p className="text-xl font-semibold text-ink leading-tight">
                                        {log.amount} <span className="text-xs text-ink-subtle uppercase font-semibold">{t("units")}</span>
                                    </p>
                                    <p className="text-[11px] text-ink-muted font-semibold uppercase tracking-tight">
                                        {log.user?.name || tCommon("system")} • {format.dateTime(new Date(log.createdAt), { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-subtle text-ink-muted text-[10px] font-semibold uppercase tracking-wider rounded-xl">
                                {movementReasonLabel(tReasons, log.reason)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
