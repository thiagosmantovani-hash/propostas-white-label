// Acesso ao painel.
// Dono do sistema (superadmin): senha na variável ADMIN_PASSWORD.
// Cada empresa: o responsável cria a conta com e-mail e senha (papel "admin" da empresa) e cadastra os consultores ("seller").
// Sessão assinada com HMAC (30 dias) contendo o papel, a empresa (cid), o usuário (uid) e uma marca da senha (pv),
// para que trocar a senha encerre os acessos abertos com a senha antiga.
import crypto from "node:crypto";
import { env, rootDb } from "./store.mjs";

const DAYS = 30;

// Chave das sessões: ADMIN_PASSWORD + SESSION_SECRET. Sem SESSION_SECRET no Netlify, usa uma chave aleatória
// criada uma vez e guardada no armazenamento (nunca um texto fixo no código), para ninguém conseguir forjar
// um acesso só sabendo a senha do dono. Trocar ADMIN_PASSWORD encerra todos os acessos abertos.
let randomKey = null;
export async function initAuth() {
  if (env("SESSION_SECRET") || randomKey) return;
  const root = await rootDb();
  let k = await root.get("system-key");
  if (!k || typeof k.key !== "string" || k.key.length < 40) { k = { key: crypto.randomBytes(32).toString("base64url"), at: new Date().toISOString() }; await root.set("system-key", k); }
  randomKey = k.key;
}
export function secretMaterial() {
  const pw = env("ADMIN_PASSWORD");
  const extra = env("SESSION_SECRET") || randomKey;
  if (!pw || !extra) return null;
  return pw + "|" + extra;
}
function secret() {
  const m = secretMaterial();
  return m ? crypto.createHash("sha256").update(m).digest() : null;
}

export const adminConfigured = () => !!env("ADMIN_PASSWORD");

const eq = (a, b) => { const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };

export function checkPassword(pw) {
  const real = env("ADMIN_PASSWORD");
  if (!real || typeof pw !== "string") return false;
  return eq(pw, real);
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return { salt, hash };
}
export function verifyPassword(pw, user) {
  if (!user || !user.salt || !user.hash || typeof pw !== "string") return false;
  const h = crypto.scryptSync(pw, user.salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(user.hash, "hex"));
}
export function newPassword() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", d = "23456789", a = "abcdefghijkmnpqrstuvwxyz23456789";
  const pick = (s, n) => Array.from({ length: n }, () => s[crypto.randomInt(s.length)]).join("");
  return `${pick(A, 2)}${pick(d, 2)}-${pick(a, 6)}`;
}

// marca curta da senha atual (muda quando a senha muda)
export const pwMark = (u) => (u && u.salt ? crypto.createHash("sha256").update(u.salt + u.hash).digest("base64url").slice(0, 10) : "");

const ROLES = ["super", "admin", "seller"];
export function issueToken(session = { role: "admin" }) {
  const key = secret();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DAYS * 864e5, role: session.role, cid: session.cid || null, uid: session.uid || null, pv: session.pv || "", su: !!session.su })).toString("base64url");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return payload + "." + sig;
}

// Devolve {role, cid, uid, pv, su} ou null (su: dono do sistema vendo o painel de uma empresa)
export function session(req) {
  const key = secret();
  if (!key) return null;
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = tok.split(".");
  if (!payload || !sig) return null;
  const good = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!(p.exp > Date.now())) return null;
    if (!ROLES.includes(p.role)) return null;
    return { role: p.role, cid: p.cid || null, uid: p.uid || null, pv: p.pv || "", su: !!p.su };
  } catch { return null; }
}
