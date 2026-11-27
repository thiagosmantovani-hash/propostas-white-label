import crypto from "node:crypto";

export const TZ = "America/Sao_Paulo";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const nowISO = () => new Date().toISOString();

// Data de hoje (AAAA-MM-DD) no fuso de Brasília
export function todayBR() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA já sai como AAAA-MM-DD
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
export function dateLong(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}
export function dateTimeBR(isoTs) {
  if (!isoTs) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "medium" }).format(new Date(isoTs)) + " (horário de Brasília)";
}

export const LOCALES = { pt: "pt-BR", es: "es-AR", en: "en-US" };
export function money(n, currency = "BRL", lang = "pt") {
  const v = Number(n) || 0;
  const loc = currency === "BRL" ? "pt-BR" : LOCALES[lang] || "pt-BR";
  const dec = currency === "PYG" ? 0 : v % 1 ? 2 : 0;
  return v.toLocaleString(loc, { style: "currency", currency, minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/\u00a0/g, " ");
}
// Preenche o modelo da forma de pagamento: {total}, {entrada}, {parcela}, {n}
export function fillSchedule(o, currency = "BRL", lang = "pt") {
  const n = Number(o.n) || 0;
  const parcela = n ? (Number(o.total) - Number(o.upfront)) / n : 0;
  return String(o.schedule || "").replace(/\{(total|entrada|parcela|n)\}/g, (m, k) => k === "n" ? String(n) : money(k === "total" ? o.total : k === "entrada" ? o.upfront : parcela, currency, lang));
}
const MONTHS_I18N = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
export function dateLongL(iso, lang = "pt") {
  if (!iso) return "";
  if (lang === "pt" || !MONTHS_I18N[lang]) return dateLong(iso);
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return lang === "en" ? `${MONTHS_I18N.en[m - 1]} ${d}, ${y}` : `${d} de ${MONTHS_I18N.es[m - 1]} de ${y}`;
}
export function dateTimeL(isoTs, lang = "pt") {
  if (!isoTs) return "";
  if (lang === "pt") return dateTimeBR(isoTs);
  const s = new Intl.DateTimeFormat(LOCALES[lang], { timeZone: TZ, dateStyle: "short", timeStyle: "medium" }).format(new Date(isoTs));
  return s + (lang === "es" ? " (hora de Brasilia)" : " (Brasília time)");
}

export const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");

export const token = (bytes = 18) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

export const clean = (v, max = 400) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
export const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
export const fail = (msg, status = 400) => json({ error: msg }, status);

export function clientIP(req, context) {
  return context?.ip || req.headers.get("x-nf-client-connection-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "";
}

// CPF/CNPJ com dígitos verificadores
export function validDoc(v) {
  const d = onlyDigits(v);
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false;
    const calc = (len) => { let s = 0; for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false;
    const calc = (len) => { const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < len; i++) s += Number(d[i]) * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  return false;
}
export function fmtDoc(v) {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return clean(v, 30);
}

// Totais de um pedido a partir dos serviços da proposta e das escolhas do cliente
export function computeTotals(services, items, currency = "BRL", lang = "pt") {
  const t = { once: 0, onceFull: 0, monthly: 0, upfront: 0, minMonths: 0, minTerm: 0, lines: [] };
  for (const it of items || []) {
    const s = services.find((x) => x.id === it.serviceId);
    if (!s) continue;
    const opt = (s.payment || []).find((o) => o.id === it.optionId) || (s.payment || [])[0];
    if (!opt) continue;
    const full = Math.max(...(s.payment || []).map((o) => Number(o.total) || 0), Number(opt.total) || 0);
    if (s.kind === "mensal") {
      t.monthly += Number(opt.total) || 0;
      t.minMonths = Math.max(t.minMonths, Number(s.minMonths) || 0);
      t.minTerm += (Number(opt.total) || 0) * (Number(s.minMonths) || 1);
    } else {
      t.once += Number(opt.total) || 0;
      t.onceFull += full;
    }
    t.upfront += Number(opt.upfront) || 0;
    t.lines.push({ serviceId: s.id, name: s.name, kind: s.kind, minMonths: s.minMonths || 0, optionId: opt.id, optionLabel: opt.label, schedule: fillSchedule(opt, currency, lang), total: Number(opt.total) || 0, upfront: Number(opt.upfront) || 0 });
  }
  t.savings = Math.max(0, t.onceFull - t.once);
  return t;
}
