import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Card, hrefWith, PageHeader, Segmented } from "@/components/superadmin/ui";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/DataTable";
import { labelOf, movementReasonLabel } from "@/i18n/labels";
import { getDb, toObjectId } from "@/lib/api";
import { buildConsumptionReport } from "@/lib/consumption";
import { requireSuperadmin } from "@/lib/superadmin";
import { getOrganizationInventory, getRecentMovements, logViewAs, reportRange, zonedDayBoundary } from "@/lib/superadmin-view";
import type { Organization } from "@/types/models";

const TABS = ["inventory", "report", "movements"] as const;
type Tab = typeof TABS[number];

type SearchParams = { tab?: string; start?: string; end?: string; dept?: string };

/**
 * "View as", read-only: the organization's inventory, consumption report and movements as its admin sees them.
 * Everything is rendered here on the server from reads; there is nothing on the page that can change data.
 * Opening it is written to the audit log (lib/superadmin-view.ts).
 */
export default async function SuperadminViewAsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
    const session = await requireSuperadmin();
    const [{ id }, query] = await Promise.all([params, searchParams]);
    const clientId = toObjectId(id);
    if (!clientId) notFound();

    const db = await getDb();
    const organization = await db.collection<Organization>("clients").findOne({ _id: clientId }, { projection: { name: 1 } });
    if (!organization) notFound();
    await logViewAs(session, clientId, organization.name);

    const tab: Tab = (TABS as readonly string[]).includes(query.tab ?? "") ? query.tab as Tab : "inventory";
    const t = await getTranslations("superadmin.viewAs");
    const base = `/superadmin/organizations/${id}/view`;

    return (
        <>
            <Link href={`/superadmin/organizations/${id}`} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-subtle hover:text-ink">
                <ArrowLeft size={14} aria-hidden /> {organization.name}
            </Link>
            <PageHeader title={t("title", { name: organization.name })}>
                <Segmented label={t("tabsLabel")} current={tab} options={TABS.map(value => ({ value, label: t(`tabs.${value}`) }))} hrefFor={value => hrefWith(base, { tab: value === "inventory" ? undefined : value })} />
            </PageHeader>

            <p role="note" className="mb-8 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-ink">
                <Eye size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {t("banner")}
            </p>

            {tab === "inventory" && <Inventory clientId={clientId} />}
            {tab === "report" && <Report clientId={clientId} base={base} query={query} />}
            {tab === "movements" && <Movements clientId={clientId} />}
        </>
    );
}

async function Inventory({ clientId }: { clientId: NonNullable<ReturnType<typeof toObjectId>> }) {
    const [t, tUnits, format, departments] = await Promise.all([
        getTranslations("superadmin.viewAs"), getTranslations("units"), getFormatter(), getOrganizationInventory(clientId),
    ]);
    if (departments.length === 0) return <p className="text-sm text-ink-muted">{t("noDepartments")}</p>;

    return (
        <div className="space-y-6">
            {departments.map(dept => (
                <section key={dept._id}>
                    <h2 className="mb-3 text-sm font-semibold text-ink">{dept.name} · {t("products", { count: dept.items.length })}</h2>
                    {dept.items.length === 0 ? <p className="text-sm text-ink-muted">{t("emptyDepartment")}</p> : (
                        <DataTable headers={["product", "quantity", "minStock", "status", "updated"].map(key => ({ title: t(`inventory.${key}`) }))}>
                            {dept.items.map(item => (
                                <DataTableRow key={item._id}>
                                    <DataTableCell><p className="font-semibold">{item.productName}</p><p className="text-[11px] text-ink-subtle">{item.sku}</p></DataTableCell>
                                    <DataTableCell className="tabular-nums">{format.number(item.quantity)} {labelOf(tUnits, item.unit)}</DataTableCell>
                                    <DataTableCell className="tabular-nums text-ink-muted">{format.number(item.minStock)}</DataTableCell>
                                    <DataTableCell><Badge tone={item.low ? "warning" : "success"}>{t(item.low ? "inventory.low" : "inventory.ok")}</Badge></DataTableCell>
                                    <DataTableCell className="whitespace-nowrap text-ink-muted">{item.updatedAt ? format.relativeTime(item.updatedAt) : "—"}</DataTableCell>
                                </DataTableRow>
                            ))}
                        </DataTable>
                    )}
                </section>
            ))}
        </div>
    );
}

async function Report({ clientId, base, query }: { clientId: NonNullable<ReturnType<typeof toObjectId>>; base: string; query: SearchParams }) {
    const { startDay, endDay } = reportRange(query.start, query.end);
    const departmentId = toObjectId(query.dept);

    const db = await getDb();
    const [t, tReports, format, departments, report] = await Promise.all([
        getTranslations("superadmin.viewAs"), getTranslations("reports"), getFormatter(),
        db.collection("departments").find({ clientId }, { projection: { name: 1 } }).sort({ name: 1 }).toArray(),
        buildConsumptionReport({ clientId, ...(departmentId && { _id: departmentId }) }, zonedDayBoundary(startDay, "start")!, zonedDayBoundary(endDay, "end")!),
    ]);
    const field = "rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink outline-none focus:border-line-strong";

    return (
        <>
            {/* A GET form: it only chooses what to read */}
            <form action={base} method="get" className="mb-6 flex flex-col gap-3 md:flex-row md:items-end">
                <input type="hidden" name="tab" value="report" />
                <label className="text-xs font-semibold text-ink-muted">{t("report.from")}<input type="date" name="start" defaultValue={startDay} className={`mt-1 block ${field}`} /></label>
                <label className="text-xs font-semibold text-ink-muted">{t("report.to")}<input type="date" name="end" defaultValue={endDay} className={`mt-1 block ${field}`} /></label>
                <label className="text-xs font-semibold text-ink-muted">{t("report.department")}
                    <select name="dept" defaultValue={departmentId?.toString() ?? ""} className={`mt-1 block ${field}`}>
                        <option value="">{t("report.allDepartments")}</option>
                        {departments.map(d => <option key={d._id.toString()} value={d._id.toString()}>{d.name as string}</option>)}
                    </select>
                </label>
                <button type="submit" className="rounded-2xl bg-inverse px-5 py-2.5 text-xs font-semibold text-on-inverse">{t("report.apply")}</button>
            </form>

            {report.every(d => d.items.length === 0) ? <p className="text-sm text-ink-muted">{t("report.empty")}</p> : (
                <div className="space-y-6">
                    {report.filter(d => d.items.length > 0).map(dept => (
                        <section key={dept._id}>
                            <h2 className="mb-3 text-sm font-semibold text-ink">{dept.departmentName}</h2>
                            <DataTable headers={["product", "initialRange", "in", "out", "transfers", "balance", "currentFinal"].map(key => ({ title: tReports(`columns.${key}`) }))}>
                                {dept.items.map(item => (
                                    <DataTableRow key={item.inventoryId}>
                                        <DataTableCell><p className="font-semibold">{item.productName}</p><p className="text-[11px] text-ink-subtle">{item.sku}</p></DataTableCell>
                                        <DataTableCell className="tabular-nums">{format.number(item.initialQuantity)}</DataTableCell>
                                        <DataTableCell className="tabular-nums text-success">+{format.number(item.totalIn)}</DataTableCell>
                                        <DataTableCell className="tabular-nums text-danger">−{format.number(item.totalOut)}</DataTableCell>
                                        <DataTableCell className="tabular-nums text-ink-muted">{item.transferIn || item.transferOut ? `+${format.number(item.transferIn)} / −${format.number(item.transferOut)}` : "—"}</DataTableCell>
                                        <DataTableCell className="tabular-nums">{item.finalBalance > 0 ? "+" : ""}{format.number(item.finalBalance)}</DataTableCell>
                                        <DataTableCell className="tabular-nums font-semibold">{format.number(item.finalQuantity)}</DataTableCell>
                                    </DataTableRow>
                                ))}
                            </DataTable>
                        </section>
                    ))}
                </div>
            )}
        </>
    );
}

async function Movements({ clientId }: { clientId: NonNullable<ReturnType<typeof toObjectId>> }) {
    const [t, tReasons, format, movements] = await Promise.all([
        getTranslations("superadmin.viewAs"), getTranslations("movementReasons"), getFormatter(), getRecentMovements(clientId),
    ]);
    if (movements.length === 0) return <p className="text-sm text-ink-muted">{t("movements.empty")}</p>;

    return (
        <Card title={t("movements.title", { count: movements.length })}>
            <DataTable headers={["when", "product", "movement", "balance", "reason", "user"].map(key => ({ title: t(`movements.${key}`) }))}>
                {movements.map(m => (
                    <DataTableRow key={m._id}>
                        <DataTableCell className="whitespace-nowrap text-ink-muted">
                            <time dateTime={m.createdAt.toISOString()} title={format.dateTime(m.createdAt, { dateStyle: "medium", timeStyle: "short" })}>{format.relativeTime(m.createdAt)}</time>
                        </DataTableCell>
                        <DataTableCell><p className="font-semibold">{m.productName}</p><p className="text-[11px] text-ink-subtle">{m.departmentName}</p></DataTableCell>
                        <DataTableCell className={`tabular-nums font-semibold ${m.type === "IN" ? "text-success" : "text-danger"}`}>
                            {m.type === "IN" ? "+" : "−"}{format.number(m.amount)} <span className="font-normal text-ink-subtle">{t(m.type === "IN" ? "movements.in" : "movements.out")}</span>
                        </DataTableCell>
                        <DataTableCell className="tabular-nums">{m.newBalance === null ? "—" : format.number(m.newBalance)}</DataTableCell>
                        <DataTableCell className="text-ink-muted">{movementReasonLabel(tReasons, m.reason)}</DataTableCell>
                        <DataTableCell className="text-ink-muted">{m.userName ?? t("movements.system")}</DataTableCell>
                    </DataTableRow>
                ))}
            </DataTable>
        </Card>
    );
}
