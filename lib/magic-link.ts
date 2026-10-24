import type { EmailConfig } from "next-auth/providers"
import { getTranslations } from "next-intl/server"
import { getDb } from "@/lib/api"

/** Sign-in emails one address can be sent per window: stops the form from being used to flood someone's inbox. */
const MAX_EMAILS_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60_000;

/** How long a sign-in link works (Auth.js deletes the token on use, so each link works once). */
export const MAGIC_LINK_MAX_AGE_SECONDS = 15 * 60;

/**
 * Sends the sign-in link through Resend, in the visitor's language (next-intl reads it from the request).
 * Throwing makes Auth.js redirect to the login page with error=EmailSignin.
 */
export const sendMagicLink: EmailConfig["sendVerificationRequest"] = async ({ identifier: to, provider, url }) => {
    await throttle(to);

    const t = await getTranslations("magicLink");
    const { host } = new URL(url);
    const minutes = MAGIC_LINK_MAX_AGE_SECONDS / 60;

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: provider.from,
            to,
            subject: t("subject", { host }),
            html: html({ url, title: t("title"), button: t("button"), expires: t("expires", { minutes }), ignore: t("ignore") }),
            text: `${t("title")}\n\n${url}\n\n${t("expires", { minutes })}\n${t("ignore")}\n`,
        }),
    });
    if (!res.ok) throw new Error("Resend error: " + JSON.stringify(await res.json()));
};

/** Records the send in magic_link_requests (expired by a TTL index, see scripts/create-indexes.js). */
async function throttle(email: string) {
    const db = await getDb();
    const requests = db.collection("magic_link_requests");
    const recent = await requests.countDocuments({ email, createdAt: { $gt: new Date(Date.now() - WINDOW_MS) } });
    if (recent >= MAX_EMAILS_PER_WINDOW) throw new Error(`Too many sign-in emails requested for ${email}`);
    await requests.insertOne({ email, createdAt: new Date() });
}

function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Table layout and inline styles: email clients ignore stylesheets. */
function html({ url, title, button, expires, ignore }: Record<string, string>) {
    const href = escapeHtml(url);
    return `<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px">
<h1 style="margin:0 0 24px;font-size:20px;font-weight:600;color:#18181b">${escapeHtml(title)}</h1>
<a href="${href}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(button)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#71717a">${escapeHtml(expires)}<br>${escapeHtml(ignore)}</p>
</td></tr>
</table>
</body>`;
}
