import type { EmailConfig } from "next-auth/providers"
import { getTranslations } from "next-intl/server"
import { getDb } from "@/lib/api"
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email"

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

    await sendEmail({
        apiKey: provider.apiKey,
        from: provider.from,
        to,
        subject: t("subject", { host }),
        html: emailLayout({
            title: t("title"),
            button: { label: t("button"), url },
            footer: `${escapeHtml(t("expires", { minutes }))}<br>${escapeHtml(t("ignore"))}`,
        }),
        text: `${t("title")}\n\n${url}\n\n${t("expires", { minutes })}\n${t("ignore")}\n`,
    });
};

/** Records the send in magic_link_requests (expired by a TTL index, see scripts/create-indexes.js). */
async function throttle(email: string) {
    const db = await getDb();
    const requests = db.collection("magic_link_requests");
    const recent = await requests.countDocuments({ email, createdAt: { $gt: new Date(Date.now() - WINDOW_MS) } });
    if (recent >= MAX_EMAILS_PER_WINDOW) throw new Error(`Too many sign-in emails requested for ${email}`);
    await requests.insertOne({ email, createdAt: new Date() });
}
