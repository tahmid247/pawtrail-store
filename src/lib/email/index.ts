import "server-only";
import { prisma } from "../db";
import { env } from "../env";
import { getSettings } from "../settings";
import { defaultEmailTemplates, type EmailTemplateKey } from "./templates";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Replaces {{var}} placeholders. Values are HTML-escaped; template text is admin-authored plain text. */
export function renderTemplate(template: string, vars: Record<string, string>, html: boolean): string {
  const text = html ? escapeHtml(template) : template;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key] ?? "";
    return html ? escapeHtml(v) : v;
  });
}

function wrapHtml(body: string, brandName: string, primary: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  // Linkify absolute URLs we generated (already escaped, so no markup injection is possible).
  const linked = paragraphs.replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" style="color:${primary};font-weight:600">$1</a>`,
  );
  return `<!doctype html><html><body style="margin:0;background:#F8F5FF;font-family:Inter,Arial,sans-serif;color:#211B30">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:${primary};padding-bottom:24px">${escapeHtml(brandName)}</td></tr>
<tr><td style="font-size:15px">${linked}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function getTemplate(key: EmailTemplateKey) {
  const stored = await prisma.emailTemplate.findUnique({ where: { key } });
  return stored ?? { key, ...defaultEmailTemplates[key] };
}

/**
 * Sends a transactional email via Resend. Without RESEND_API_KEY (development/testing),
 * the email is logged to the console instead. Every attempt is recorded in EmailLog (without the body).
 */
export async function sendEmail(key: EmailTemplateKey, to: string, vars: Record<string, string>) {
  const settings = await getSettings();
  const tpl = await getTemplate(key);
  const allVars = {
    brandName: settings.brand.name,
    supportEmail: settings.brand.supportEmail,
    siteUrl: env.siteUrl,
    ...vars,
  };
  const subject = renderTemplate(tpl.subject, allVars, false);
  const text = renderTemplate(tpl.body, allVars, false);
  const html = wrapHtml(renderTemplate(tpl.body, allVars, true), settings.brand.name, settings.theme.primary);

  if (!env.resendApiKey) {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email:dev] to=${to} subject="${subject}"\n${text}\n`);
    }
    await prisma.emailLog.create({ data: { to, template: key, subject, status: "logged" } });
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    await prisma.emailLog.create({
      data: {
        to,
        template: key,
        subject,
        status: res.ok ? "sent" : "failed",
        providerId: data.id,
        error: res.ok ? null : (data.message ?? `HTTP ${res.status}`).slice(0, 500),
      },
    });
    return { ok: res.ok };
  } catch (err) {
    await prisma.emailLog.create({
      data: { to, template: key, subject, status: "failed", error: String(err).slice(0, 500) },
    });
    return { ok: false };
  }
}

/** Best-effort admin alert (low stock, fulfillment failures, payments needing attention). */
export async function alertAdmin(subject: string, message: string) {
  const to = env.adminAlertEmail;
  if (!to) {
    console.warn(`[admin-alert] ${subject}: ${message}`);
    return;
  }
  await sendEmail("admin_alert", to, { alertSubject: subject, alertMessage: message });
}
