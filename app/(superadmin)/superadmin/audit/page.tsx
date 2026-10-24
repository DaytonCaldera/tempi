import { getTranslations } from "next-intl/server";
import AuditTable from "@/components/superadmin/AuditTable";
import { hrefWith, PageHeader, Pagination } from "@/components/superadmin/ui";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { listAudit, pageOf, requireSuperadmin } from "@/lib/superadmin";

const ACTIONS: string[] = Object.values(AUDIT_ACTIONS);

/** The whole audit log, newest first, filtered by action and searched by who did it or to whom. */
export default async function SuperadminAuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; page?: string }> }) {
    await requireSuperadmin();
    const params = await searchParams;
    const action = ACTIONS.includes(params.action ?? "") ? params.action : undefined;
    const page = pageOf(params.page);

    const [t, tPanel, { rows, pages }] = await Promise.all([
        getTranslations("superadmin.audit"), getTranslations("superadmin"), listAudit({ action, q: params.q, page }),
    ]);

    return (
        <>
            <PageHeader title={t("title")} subtitle={t("subtitle")} />

            {/* A GET form: the filtered log is a shareable URL */}
            <form action="/superadmin/audit" method="get" className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <select name="action" defaultValue={action ?? ""} aria-label={t("columns.action")} className="rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none focus:border-line-strong">
                    <option value="">{t("allActions")}</option>
                    {ACTIONS.map(value => <option key={value} value={value}>{t(`actions.${value.split(".").pop()}`)}</option>)}
                </select>
                <input name="q" defaultValue={params.q} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} className="w-full max-w-md rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-line-strong" />
                <button type="submit" className="rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse">{tPanel("search")}</button>
            </form>

            <AuditTable rows={rows} />
            <Pagination page={page} pages={pages} hrefFor={p => hrefWith("/superadmin/audit", { action, q: params.q, page: p })} />
        </>
    );
}
