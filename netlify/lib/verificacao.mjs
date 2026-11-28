// Confirmação do número de WhatsApp por código (cadastro, primeiro acesso, nova senha e troca de número).
// O acesso ao sistema é pelo número de WhatsApp; ninguém consegue usar um número sem receber o código nele.
//
// Provedores (variável WHATSAPP_PROVIDER no Netlify):
//   meta    WhatsApp Cloud API oficial da Meta, com um modelo de mensagem de AUTENTICAÇÃO aprovado.
//           WHATSAPP_TOKEN (token permanente de usuário do sistema), WHATSAPP_PHONE_ID (ID do número),
//           WHATSAPP_TEMPLATE (nome do modelo, padrão "codigo_de_acesso") e WHATSAPP_TEMPLATE_LANG (padrão "pt_BR").
//   twilio  Twilio Verify, canal WhatsApp (a Twilio cria e confere o código).
//           TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_VERIFY_SID.
//   teste   não envia nada: o código fica no registro (só para testes; OTP_TEST=1 também liga).
// OTP_COUNTRIES: códigos de país que podem receber o código, separados por vírgula (padrão "55", só o Brasil).
// Sem provedor configurado, o cadastro e a confirmação ficam indisponíveis (nada é liberado sem código).
//
// Registro guardado (otp/<hash do propósito e do número>):
//   { phone, purpose, codeHash, exp, tries, sends: [ms...], data }   data = o que fica esperando a confirmação
import crypto from "node:crypto";
import { env, rootDb } from "./store.mjs";

const TTL = 10 * 60e3;          // o código vale 10 minutos
const COOLDOWN = 45e3;          // espera mínima entre dois envios para o mesmo número
const MAX_SENDS_HOUR = 5;       // envios por número a cada hora
const MAX_TRIES = 5;            // tentativas de digitar o código
export const otpLog = [];       // modo de teste: últimos códigos (lidos só em /api/public/__codes com OTP_TEST=1)

// Número em formato internacional, só dígitos: Brasil sem o 55 ganha o 55; com + ou 00, outro país.
export function normPhone(v) {
  const raw = String(v ?? "").trim();
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+") || raw.startsWith("00")) { d = d.replace(/^00/, ""); return d.length >= 10 && d.length <= 15 ? d : ""; }
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (/^55\d{10,11}$/.test(d) && Number(d.slice(2, 4)) >= 11) return d;
  return d.length >= 12 && d.length <= 15 && !d.startsWith("55") ? d : "";
}
export const maskPhone = (d) => (d && d.startsWith("55") && d.length >= 12 ? `(${d.slice(2, 4)}) ${"•".repeat(d.length - 8)}${d.slice(-4)}` : d ? `+${d.slice(0, 2)} •••• ${d.slice(-4)}` : "");
export const fmtPhone = (d) => (d && d.startsWith("55") && d.length >= 12 ? `(${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}` : d ? "+" + d : "");

export function otpProvider() {
  const want = String(env("WHATSAPP_PROVIDER") || "").toLowerCase();
  if (want === "meta" && env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID")) return "meta";
  if (want === "twilio" && env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_VERIFY_SID")) return "twilio";
  if (want === "teste" || env("OTP_TEST") === "1") return "teste";
  return null;
}
export const otpLabel = (p = otpProvider()) => ({ meta: "WhatsApp oficial (Meta)", twilio: "Twilio Verify (WhatsApp)", teste: "modo de teste (nada é enviado)" })[p] || "não configurada";

const key = (purpose, phone) => "otp/" + crypto.createHash("sha256").update(purpose + "|" + phone).digest("hex").slice(0, 40);
const hashCode = (code, phone) => crypto.createHash("sha256").update(`${phone}:${code}:${env("ADMIN_PASSWORD") || ""}`).digest("hex");
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// Envia um código novo. data fica guardado e volta em checkOtp quando o código estiver certo.
export async function sendOtp(phone, purpose, data = null) {
  const prov = otpProvider();
  if (!prov) return { sent: false, status: 503, error: "A confirmação por WhatsApp ainda não está configurada no sistema. Fale com o suporte." };
  // países que podem receber código (OTP_COUNTRIES, padrão só o Brasil): evita gasto com envios a números de fora
  const allowed = String(env("OTP_COUNTRIES") || "55").split(",").map((x) => x.trim()).filter(Boolean);
  if (!allowed.some((c) => phone.startsWith(c))) return { sent: false, status: 400, error: "Por enquanto o cadastro aceita só números de WhatsApp do Brasil." };
  const root = await rootDb(), k = key(purpose, phone), now = Date.now();
  const old = (await root.get(k)) || {};
  const sends = (old.sends || []).filter((t) => now - t < 3600e3);
  if (sends.length && now - sends[sends.length - 1] < COOLDOWN) return { sent: false, status: 429, wait: Math.ceil((COOLDOWN - (now - sends[sends.length - 1])) / 1000), error: "Aguarde alguns segundos antes de pedir outro código." };
  if (sends.length >= MAX_SENDS_HOUR) return { sent: false, status: 429, error: "Muitos códigos pedidos para este número. Tente de novo daqui a 1 hora." };
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
  const r = await deliver(prov, phone, code);
  if (!r.ok) return { sent: false, status: 502, error: r.error || "Não foi possível enviar o código pelo WhatsApp. Confira o número." };
  await root.set(k, { phone, purpose, codeHash: prov === "twilio" ? null : hashCode(code, phone), exp: now + TTL, tries: 0, sends: [...sends, now], data: data ?? old.data ?? null });
  return { sent: true, masked: maskPhone(phone), cooldown: Math.ceil(COOLDOWN / 1000) };
}

// Confere o código. Certo: apaga o registro e devolve { ok, data }. Errado: conta a tentativa.
export async function checkOtp(phone, purpose, code) {
  const prov = otpProvider();
  if (!prov) return { ok: false, status: 503, error: "A confirmação por WhatsApp ainda não está configurada no sistema." };
  const root = await rootDb(), k = key(purpose, phone), rec = await root.get(k);
  const c = String(code ?? "").replace(/\D/g, "");
  if (!rec || !(rec.exp > Date.now())) return { ok: false, status: 400, error: "O código venceu ou não foi pedido. Peça um código novo." };
  if (rec.tries >= MAX_TRIES) return { ok: false, status: 429, error: "Muitas tentativas com este código. Peça um código novo." };
  let good = false;
  if (c.length === 6) good = prov === "twilio" ? await twilioCheck(phone, c) : !!rec.codeHash && eq(hashCode(c, phone), rec.codeHash);
  if (!good) { rec.tries = (rec.tries || 0) + 1; await root.set(k, rec); return { ok: false, status: 400, error: `Código incorreto.${MAX_TRIES - rec.tries > 0 ? ` Restam ${MAX_TRIES - rec.tries} tentativa(s).` : " Peça um código novo."}` }; }
  await root.del(k);
  return { ok: true, data: rec.data || null };
}

/* ---------- envio ---------- */
async function deliver(prov, phone, code) {
  try {
    if (prov === "teste") { otpLog.unshift({ phone, code, at: new Date().toISOString() }); otpLog.length = Math.min(otpLog.length, 50); console.log("código de teste", phone, code); return { ok: true }; }
    if (prov === "meta") return await metaSend(phone, code);
    if (prov === "twilio") return await twilioStart(phone);
  } catch (e) { console.error("whatsapp", prov, e); }
  return { ok: false };
}

// Meta: modelo de autenticação com botão "Copiar código" (o código vai no corpo e no botão)
async function metaSend(phone, code) {
  const v = env("WHATSAPP_API_VERSION") || "v25.0";
  const r = await fetch(`https://graph.facebook.com/${v}/${env("WHATSAPP_PHONE_ID")}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "template",
      template: {
        name: env("WHATSAPP_TEMPLATE") || "codigo_de_acesso", language: { code: env("WHATSAPP_TEMPLATE_LANG") || "pt_BR" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (r.ok) return { ok: true };
  const e = await r.json().catch(() => ({}));
  console.error("meta whatsapp", r.status, JSON.stringify(e).slice(0, 400));
  const m = (e.error && e.error.code) || 0;
  return { ok: false, error: m === 131026 || m === 131030 ? "Este número não recebe mensagens no WhatsApp. Confira o número com DDD." : "Não foi possível enviar o código pelo WhatsApp agora. Tente de novo em instantes." };
}

const twAuth = () => "Basic " + Buffer.from(`${env("TWILIO_ACCOUNT_SID")}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64");
async function twilioStart(phone) {
  const r = await fetch(`https://verify.twilio.com/v2/Services/${env("TWILIO_VERIFY_SID")}/Verifications`, {
    method: "POST", headers: { authorization: twAuth(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: "+" + phone, Channel: "whatsapp", Locale: "pt-BR" }),
  });
  if (!r.ok) console.error("twilio verify", r.status, (await r.text()).slice(0, 300));
  return { ok: r.ok };
}
async function twilioCheck(phone, code) {
  const r = await fetch(`https://verify.twilio.com/v2/Services/${env("TWILIO_VERIFY_SID")}/VerificationCheck`, {
    method: "POST", headers: { authorization: twAuth(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: "+" + phone, Code: code }),
  });
  const d = await r.json().catch(() => ({}));
  return r.ok && d.status === "approved";
}
