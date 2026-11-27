// E-mail opcional. Duas formas, configuradas por variáveis de ambiente no Netlify:
// 1) Gmail: GMAIL_USER (ex.: propostas.suaempresa@gmail.com) e GMAIL_APP_PASSWORD (senha de app do Google, 16 letras).
// 2) Resend (https://resend.com): RESEND_API_KEY e EMAIL_FROM.
// Sem nenhuma delas, nada é enviado e o sistema segue funcionando com link, WhatsApp e download do PDF.
import nodemailer from "nodemailer";
import { env } from "./store.mjs";
import { brand } from "./brand.mjs";

const gmailOn = () => !!(env("GMAIL_USER") && env("GMAIL_APP_PASSWORD"));
const resendOn = () => !!(env("RESEND_API_KEY") && env("EMAIL_FROM"));
const testOn = () => env("EMAIL_TEST") === "1";
export const emailEnabled = () => gmailOn() || resendOn() || testOn();
export const emailSender = () => (gmailOn() ? env("GMAIL_USER") : resendOn() ? env("EMAIL_FROM") : "");
// avisos internos vão para o e-mail da própria empresa (Dados da empresa); o remetente do sistema é só quem envia
export const notifyAddress = (settings) => settings?.agency?.email || "";
export const sentLog = [];
let transport = null;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Layout dos e-mails com o nome e as cores da empresa (Dados da empresa)
export function layout(title, bodyHtml, cta) {
  const b = brand(), c = b.colors;
  return `<!doctype html><html><body style="margin:0;background:${c.light};font-family:Helvetica,Arial,sans-serif;color:${c.dark}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${c.light};padding:32px 12px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${c.dark};color:${c.light};border-radius:4px">
  <tr><td style="padding:28px 32px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${c.accent}">${esc(b.name)}</td></tr>
  <tr><td style="padding:0 32px 8px;font-size:24px;line-height:1.2;text-transform:uppercase">${esc(title)}</td></tr>
  <tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6;color:${c.light};opacity:.9">${bodyHtml}</td></tr>
  ${cta ? `<tr><td style="padding:0 32px 32px"><a href="${esc(cta.url)}" style="display:inline-block;background:${c.primary};color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 24px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;border:1px solid ${c.light}">${esc(cta.label)}</a></td></tr>` : ""}
  </table>
  <p style="font-size:11px;color:#6b6b6b">${esc(b.name)}${b.tagline ? " · " + esc(b.tagline) : ""}</p>
  </td></tr></table></body></html>`;
}
// Nome do remetente: o definido em Dados da empresa ou o nome da empresa
const fromName = () => String(brand().emailFromName || brand().name).replace(/["<>\r\n]/g, "");

export async function sendEmail({ to, subject, html, attachments, replyTo }) {
  if (!emailEnabled() || !to || (Array.isArray(to) && !to.length)) return { sent: false, reason: "disabled" };
  const list = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))];
  if (testOn() && !gmailOn() && !resendOn()) { sentLog.push({ to: list, subject, html, attachments: (attachments || []).map((a) => a.filename) }); return { sent: true }; }
  if (gmailOn()) {
    try {
      transport ||= nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: env("GMAIL_USER"), pass: String(env("GMAIL_APP_PASSWORD")).replace(/\s+/g, "") } });
      await transport.sendMail({
        from: `"${fromName()}" <${env("GMAIL_USER")}>`, to: list.join(", "), subject, html, replyTo: replyTo || undefined,
        attachments: (attachments || []).map((a) => ({ filename: a.filename, content: a.content, encoding: "base64" })),
      });
      return { sent: true };
    } catch (e) {
      transport = null;
      const msg = String((e && (e.response || e.message)) || e);
      console.error("Gmail", msg);
      const why = /535|Username and Password not accepted|BadCredentials/i.test(msg) ? "O Gmail recusou o login: confira GMAIL_USER e se GMAIL_APP_PASSWORD é a senha de app de 16 letras (não a senha normal)." : msg.slice(0, 200);
      return { sent: false, reason: "error", error: why };
    }
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: /</.test(env("EMAIL_FROM")) ? env("EMAIL_FROM") : `"${fromName()}" <${env("EMAIL_FROM")}>`, to: list, subject, html, attachments, reply_to: replyTo || undefined }),
    });
    if (!r.ok) { console.error("Resend", r.status, await r.text()); return { sent: false, reason: "error" }; }
    return { sent: true };
  } catch (e) {
    console.error("Resend", e);
    return { sent: false, reason: "error" };
  }
}

export { esc };
