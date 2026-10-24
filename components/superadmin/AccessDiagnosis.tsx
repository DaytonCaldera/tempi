import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { labelOf } from "@/i18n/labels";
import type { getAccessDiagnosis } from "@/lib/superadmin-insights";
import { Badge, Card } from "./ui";

type Diagnosis = NonNullable<Awaited<ReturnType<typeof getAccessDiagnosis>>>;

const DEPARTMENT_TONE = { ok: "success", otherOrganization: "danger", missing: "warning" } as const;

/** The result of getAccessDiagnosis: where the user lands, their role, permissions, departments and warnings. */
export default async function AccessDiagnosis({ diagnosis }: { diagnosis: Diagnosis }) {
    const t = await getTranslations("superadmin.diagnosis");
    const tRoles = await getTranslations("roles");
    const { state, organization, role, permissions, departments, notes } = diagnosis;

    return (
        <Card title={t("title")}>
            <p className="-mt-2 mb-4 text-xs text-ink-subtle">{t("subtitle")}</p>
            <p className="mb-4 text-sm font-semibold text-ink">
                {t(`states.${state}`, { organization: organization?.name || "—", role: role ? labelOf(tRoles, role) : "—" })}
                {organization && <Link href={`/superadmin/organizations/${organization._id}`} className="ml-2 text-xs font-normal text-ink-muted hover:text-accent">→</Link>}
            </p>

            {state === "member" && (
                <dl className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <dt className="mb-1 text-xs text-ink-subtle">{t("permissions")}</dt>
                        <dd className="flex flex-wrap gap-1.5">
                            {permissions.length === 0 ? <span className="text-sm text-ink-muted">{t("noPermissions")}</span>
                                : permissions.map(p => <code key={p} className="rounded-lg bg-subtle px-2 py-0.5 text-[11px] text-ink-muted">{p}</code>)}
                        </dd>
                    </div>
                    <div>
                        <dt className="mb-1 text-xs text-ink-subtle">{t("departments")}</dt>
                        <dd className="space-y-1">
                            {departments.length === 0 ? <span className="text-sm text-ink-muted">—</span> : departments.map(d => (
                                <p key={d._id} className="flex items-center gap-2 text-sm">
                                    <span className="text-ink">{d.name || d._id}</span>
                                    <Badge tone={DEPARTMENT_TONE[d.status]}>{t(`departmentStatus.${d.status}`)}</Badge>
                                </p>
                            ))}
                        </dd>
                    </div>
                </dl>
            )}

            {notes.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 size={16} aria-hidden /> {t("allGood")}</p>
            ) : (
                <ul className="space-y-1.5">
                    {notes.map(note => (
                        <li key={note} className="flex items-start gap-2 text-sm text-warning">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                            <span className="text-ink">{t(`notes.${note}`)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
