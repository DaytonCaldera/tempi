import Link from "next/link";
import { ArchiveRestore, KeyRound, Stethoscope, UserCog, Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge, Card, PageHeader, SearchForm } from "@/components/superadmin/ui";
import { requireSuperadmin } from "@/lib/superadmin";
import { universalSearch } from "@/lib/superadmin-insights";

/**
 * Starting point for helping someone: one search over users and organizations, and what each tool does.
 * The tools act on one user or organization, so they live on those pages: the cards and results link there.
 */
export default async function SuperadminSupportPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    await requireSuperadmin();
    const { q = "" } = await searchParams;
    const [t, results] = await Promise.all([getTranslations("superadmin.support"), universalSearch(q)]);
    const hasResults = results.users.length + results.organizations.length > 0;

    const tools = [
        { key: "diagnosis", icon: Stethoscope, href: "/superadmin/users" },
        { key: "regenerate", icon: KeyRound, href: "/superadmin/organizations" },
        { key: "transfer", icon: UserCog, href: "/superadmin/organizations" },
        { key: "repair", icon: Wrench, href: "/superadmin/health#stockMismatches" },
        { key: "restore", icon: ArchiveRestore, href: "/superadmin/organizations?filter=closed" },
    ] as const;
    const quickLink = "shrink-0 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-line-strong hover:text-ink";

    return (
        <>
            <PageHeader title={t("title")} subtitle={t("subtitle")} />
            <div className="mb-8">
                <SearchForm action="/superadmin/support" q={q} placeholder={t("searchPlaceholder")} />
            </div>

            {q.trim() && (
                <div className="mb-8">
                    {!hasResults ? <p className="text-sm text-ink-muted">{t("noResults", { q: q.trim() })}</p> : (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <Card title={t("users")}>
                                {results.users.length === 0 ? <p className="text-sm text-ink-muted">—</p> : (
                                    <ul className="divide-y divide-line">
                                        {results.users.map(user => (
                                            <li key={user._id} className="flex items-center justify-between gap-4 py-2">
                                                <div className="min-w-0">
                                                    <Link href={`/superadmin/users/${user._id}`} className="text-sm font-semibold text-ink hover:text-accent">{user.name || user.email}</Link>
                                                    <p className="truncate text-xs text-ink-subtle">{user.email}</p>
                                                </div>
                                                <Link href={`/superadmin/users/${user._id}#diagnosis`} className={quickLink}>{t("openDiagnosis")}</Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                            <Card title={t("organizations")}>
                                {results.organizations.length === 0 ? <p className="text-sm text-ink-muted">—</p> : (
                                    <ul className="divide-y divide-line">
                                        {results.organizations.map(org => (
                                            <li key={org._id} className="flex items-center justify-between gap-4 py-2">
                                                <div className="min-w-0">
                                                    <Link href={`/superadmin/organizations/${org._id}`} className="text-sm font-semibold text-ink hover:text-accent">{org.name}</Link>
                                                    <p className="truncate text-xs text-ink-subtle">{org.ownerEmail ?? "—"}</p>
                                                </div>
                                                {org.closed ? <Badge tone="neutral">{t("closed")}</Badge>
                                                    : <Link href={`/superadmin/organizations/${org._id}#tools`} className={quickLink}>{t("openTools")}</Link>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>
                    )}
                </div>
            )}

            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">{t("toolsTitle")}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {tools.map(({ key, icon: Icon, href }) => (
                    <Link key={key} href={href} className="group flex flex-col rounded-3xl border border-line bg-card p-5 transition-colors hover:border-line-strong">
                        <Icon size={20} className="mb-3 text-accent" aria-hidden />
                        <p className="text-sm font-semibold text-ink">{t(`tools.${key}`)}</p>
                        <p className="mt-1 flex-1 text-xs text-ink-muted">{t(`tools.${key}Hint`)}</p>
                        <p className="mt-4 text-xs font-semibold text-ink-muted group-hover:text-ink">{t(`tools.${key}Cta`)} →</p>
                    </Link>
                ))}
            </div>
        </>
    );
}
