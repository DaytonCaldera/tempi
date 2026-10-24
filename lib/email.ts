/**
 * Server only: emails sent through Resend (the sign-in links of lib/magic-link.ts and the low stock alerts of
 * lib/stock-alerts.ts). Uses AUTH_RESEND_KEY and EMAIL_FROM, the same settings as email sign-in.
 */

/** Whether emails can be sent: without the settings, features that email just skip it. */
export const emailConfigured = () => !!process.env.AUTH_RESEND_KEY && !!process.env.EMAIL_FROM;

/** Sends one email (to up to 50 addresses, Resend's limit). Throws when Resend refuses it. */
export async function sendEmail({ to, subject, html, text, apiKey = process.env.AUTH_RESEND_KEY, from = process.env.EMAIL_FROM }: {
    to: string | string[]; subject: string; html: string; text: string; apiKey?: string; from?: string;
}) {
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) throw new Error("Resend error: " + JSON.stringify(await res.json().catch(() => res.status)));
}

export function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * The page every email is laid out in: a title, the body (HTML the caller already escaped), a button and a
 * footnote. Table layout and inline styles: email clients ignore stylesheets.
 */
export function emailLayout({ title, body = "", button, footer }: { title: string; body?: string; button: { label: string; url: string }; footer: string }) {
    return `<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px">
<h1 style="margin:0 0 24px;font-size:20px;font-weight:600;color:#18181b">${escapeHtml(title)}</h1>
${body}
<a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(button.label)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#71717a">${footer}</p>
</td></tr>
</table>
</body>`;
}
