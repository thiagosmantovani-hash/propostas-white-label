// Acesso ao painel.
// Administrador: senha na variável ADMIN_PASSWORD. Consultores: e-mail e senha cadastrados pelo administrador.
// Sessão assinada com HMAC (30 dias) contendo o papel e, para consultores, o id.
import crypto from "node:crypto";
import { env } from "./store.mjs";

const DAYS = 30;

function secret() {
  const pw = env("ADMIN_PASSWORD");
  if (!pw) return null;
  return crypto.createHash("sha256").update(pw + "|" + (env("SESSION_SECRET") || "propostas")).digest();
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

export function issueToken(session = { role: "admin" }) {
  const key = secret();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DAYS * 864e5, role: session.role, uid: session.uid || null })).toString("base64url");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return payload + "." + sig;
}

// Devolve {role, uid} ou null
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
    return { role: p.role === "seller" ? "seller" : "admin", uid: p.uid || null };
  } catch { return null; }
}
