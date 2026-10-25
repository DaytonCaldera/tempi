import { after } from "next/server";
import type { ObjectId } from "mongodb";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/lib/api";
import { PERMISSIONS } from "@/lib/constants";
import { roleSlugsWith } from "@/lib/roles";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { labelOf } from "@/i18n/labels";
import type { Organization, StockItem, User } from "@/types/models";

/**
 * Server only: low stock alerts. When a product's quantity drops to its minimum (quantity <= minStock), the
 * organization's admins (and the extra addresses in its settings) get one email. The product is marked with
 * lowStockAlertedAt so it isn't emailed again on every move while it stays low; the mark is cleared once its
 * quantity is back above the minimum, so the next drop emails again.
 * Products already low when this shipped get their email on their next move.
 */

export const MAX_EXTRA_EMAILS = 5;

/**
 * Whether alerts go out by email. In `next dev` they are only logged, so testing stock moves against a database
 * with real admins can't email them; SEND_ALERT_EMAILS=true sends them anyway (to try the email itself).
 */
const sendsAlertEmails = () => process.env.NODE_ENV === "production" || process.env.SEND_ALERT_EMAILS === "true";

/** An organization's alert settings, with the defaults for organizations that never changed them. */
export type AlertSettings = { lowStockEmail: boolean; extraEmails: string[] };

export const alertSettingsOf = (organization: Pick<Organization, "alerts"> | null | undefined): AlertSettings => ({
    lowStockEmail: organization?.alerts?.lowStockEmail ?? true,
    extraEmails: organization?.alerts?.extraEmails ?? [],
});

/** Where the email's links point and the language it's written in: taken from the request that moved the stock. */
export type AlertContext = { origin: string; locale: Locale };

/** The AlertContext of a route handler's request. Read it before `after`, while the request is still in scope. */
export async function alertContext(req: Request): Promise<AlertContext> {
    const locale = await getLocale();
    return { origin: new URL(req.url).origin, locale: isLocale(locale) ? locale : defaultLocale };
}

/**
 * For route handlers: checks the products after the response is sent, so moving stock never waits for an email.
 * @example
 * await afterStockChange(req, [itemId]);
 */
export async function afterStockChange(req: Request, itemIds: ObjectId[]) {
    if (itemIds.length === 0) return;
    const context = await alertContext(req);
    after(() => checkLowStock(itemIds, context));
}

/**
 * Checks products whose quantity just changed. Meant to run after the response (next/server `after`): it never
 * throws, a failure is logged and the move it follows already happened.
 */
export async function checkLowStock(itemIds: ObjectId[], context: AlertContext) {
    try {
        if (itemIds.length === 0) return;
        const db = await getDb();
        const stock = db.collection<StockItem>("department_stock");
        const items = await stock.find({ _id: { $in: itemIds } }).toArray();

        const recovered = items.filter(item => item.lowStockAlertedAt && (item.isDeleted || item.quantity > item.minStock));
        if (recovered.length > 0) {
            await stock.updateMany({ _id: { $in: recovered.map(i => i._id) } }, { $unset: { lowStockAlertedAt: "" } });
        }

        // Marked one by one, only if still unmarked: two moves at once can't both email
        const now = new Date();
        const dropped: StockItem[] = [];
        for (const item of items) {
            if (item.isDeleted || item.lowStockAlertedAt || item.quantity > item.minStock) continue;
            const { modifiedCount } = await stock.updateOne({ _id: item._id, lowStockAlertedAt: { $exists: false } }, { $set: { lowStockAlertedAt: now } });
            if (modifiedCount === 1) dropped.push(item);
        }
        if (dropped.length === 0 || !emailConfigured()) return;

        // Products without clientId (before scripts/backfill-stock-fields.js) take it from their department
        const departmentIds = [...new Set(dropped.map(i => i.departmentId.toString()))];
        const departments = await db.collection("departments")
            .find({ _id: { $in: dropped.map(i => i.departmentId) } }, { projection: { clientId: 1 } })
            .toArray();
        const clientOf = new Map(departments.map(d => [d._id.toString(), d.clientId as ObjectId]));
        const byOrganization = new Map<string, { clientId: ObjectId; items: StockItem[] }>();
        for (const item of dropped) {
            const clientId = item.clientId ?? clientOf.get(item.departmentId.toString());
            if (!clientId) continue;
            const group = byOrganization.get(clientId.toString()) ?? { clientId, items: [] };
            group.items.push(item);
            byOrganization.set(clientId.toString(), group);
        }

        for (const { clientId, items: lowItems } of byOrganization.values()) {
            await emailOrganization(clientId, lowItems, context, departmentIds.length === 1 ? departmentIds[0] : null);
        }
    } catch (error) {
        console.error("Low stock alert failed:", error);
    }
}

/**
 * Active members whose role edits stock (admins, and the organization's own roles that do, like a manager)
 * and the extra addresses, without repeats.
 */
async function recipients(clientId: ObjectId, settings: AlertSettings) {
    const db = await getDb();
    const roles = await roleSlugsWith(PERMISSIONS.EDIT_STOCK, clientId);
    const admins = await db.collection<User>("users").find(
        { organizations: { $elemMatch: { clientId: { $in: [clientId, clientId.toString()] }, status: "active", role: { $in: roles } } }, isActive: { $ne: false } },
        { projection: { email: 1 } }
    ).toArray();
    const emails = [...admins.map(a => a.email), ...settings.extraEmails].filter(Boolean).map(e => e.trim().toLowerCase());
    return [...new Set(emails)].slice(0, 50);
}

async function emailOrganization(clientId: ObjectId, items: StockItem[], { origin, locale }: AlertContext, departmentId: string | null) {
    const db = await getDb();
    const organization = await db.collection<Organization>("clients").findOne(
        { _id: clientId, status: { $ne: "closed" } }, { projection: { name: 1, alerts: 1 } }
    );
    if (!organization) return;
    const settings = alertSettingsOf(organization);
    if (!settings.lowStockEmail) return;
    const to = await recipients(clientId, settings);
    if (to.length === 0) return;

    const t = await getTranslations({ locale, namespace: "stockAlerts" });
    const tUnits = await getTranslations({ locale, namespace: "units" });
    const number = new Intl.NumberFormat(locale);
    const amount = (value: number, unit: string) => `${number.format(value)} ${labelOf(tUnits, unit).toLowerCase()}`;
    const status = (item: StockItem) => item.quantity <= 0 ? t("outOfStock") : t("left", { amount: amount(item.quantity, item.unit) });

    const subject = items.length === 1
        ? t("subjectOne", { product: items[0].productName })
        : t("subjectMany", { count: items.length });
    const url = `${origin}${departmentId ? `/admin/departments/${departmentId}/stock` : "/dashboard"}`;
    const rows = items.map(item => `<tr>
<td style="padding:8px 0;border-top:1px solid #e4e4e7;font-size:14px;color:#18181b"><strong>${escapeHtml(item.productName)}</strong><br><span style="font-size:12px;color:#71717a">${escapeHtml(item.departmentName)}</span></td>
<td style="padding:8px 0;border-top:1px solid #e4e4e7;font-size:13px;text-align:right;color:#b45309;white-space:nowrap">${escapeHtml(status(item))}<br><span style="font-size:12px;color:#71717a">${escapeHtml(t("minimum", { amount: amount(item.minStock, item.unit) }))}</span></td>
</tr>`).join("");

    if (!sendsAlertEmails()) {
        console.info(`[stock-alerts] Not sent in development (SEND_ALERT_EMAILS=true sends it): "${subject}" to ${to.length} recipient(s)`);
        return;
    }
    await sendEmail({
        to,
        subject,
        html: emailLayout({
            title: subject,
            body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${rows}</table>`,
            button: { label: t("button"), url },
            footer: escapeHtml(t("footer", { organization: organization.name })),
        }),
        text: [
            subject, "",
            ...items.map(item => `- ${item.productName} (${item.departmentName}): ${status(item)}. ${t("minimum", { amount: amount(item.minStock, item.unit) })}`),
            "", url, "", t("footer", { organization: organization.name }),
        ].join("\n"),
    });
}
