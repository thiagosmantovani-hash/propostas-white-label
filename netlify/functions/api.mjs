// API do sistema de propostas (white label: a marca vem de Dados da empresa).
// Rotas públicas (cliente, por link único) em /api/public/... e rotas do painel em /api/admin/...
// Várias empresas usam o mesmo sistema: cada uma cria a conta em /admin e só enxerga os próprios dados (ver lib/store.mjs).
// Perfis: dono do sistema (super, senha ADMIN_PASSWORD), administrador da empresa (vê tudo da empresa)
// e consultor (vê e assina as próprias propostas).
import { db, rootDb, listDocs, withCompany, currentCompany, okCompanyId, env } from "../lib/store.mjs";
import { DEFAULT_CATALOG, DEFAULT_SETTINGS, AGENCY_I18N, COUNTRIES, CURRENCIES, localizeService } from "../lib/catalog.mjs";
import { TEMPLATES, TEMPLATE_VARS, contractVars, fillTemplate, missingVars, numberClauses, withEssentials } from "../lib/contract.mjs";
import { contractPdf, documentPdf } from "../lib/pdf.mjs";
import { waEnabled, sendWa, sendWaMany, waText, waLog } from "../lib/whatsapp.mjs";
import { zipSync, strToU8 } from "fflate";
import { demo_signature } from "../lib/brand/demo-signature.mjs";
import { EXEMPLO_CATALOG } from "../lib/catalogo-exemplo.mjs";
import { brand, brandOf, useBrand, brandCss, fontList, okColor, parseImage, getImage, putImage, delImage, BRAND_DEFAULTS } from "../lib/brand.mjs";
import { emailEnabled, emailSender, notifyAddress, sendEmail, layout, esc, sentLog } from "../lib/email.mjs";
import { adminConfigured, checkPassword, issueToken, session, hashPassword, verifyPassword, newPassword, pwMark } from "../lib/auth.mjs";
import { json, fail, token, sha256, nowISO, todayBR, addDays, clean, onlyDigits, validDoc, fmtDoc, computeTotals, clientIP, money, dateLongL } from "../lib/util.mjs";

const LOCKED = ["contrato", "assinada"];
const LANGS = ["pt", "es", "en"];
const CUR = CURRENCIES.map((c) => c[0]);
const CTRY = Object.fromEntries(COUNTRIES.map((c) => [c[0], c]));

/* ---------- leitura e gravação ---------- */
async function getSettings() {
  // sem empresa (ex.: tela de login), as páginas usam a identidade neutra
  const s = currentCompany() ? (await (await db()).get("settings")) || {} : {};
  const ag = Object.fromEntries(Object.entries(s.agency || {}).filter(([, v]) => v != null && String(v).trim() !== ""));
  // assinatura padrão da empresa: só a desenhada no painel (não há assinatura fixa no sistema)
  const sig = s.agencySignature && s.agencySignature.custom && s.agencySignature.image ? s.agencySignature : null;
  const out = { ...DEFAULT_SETTINGS, ...s, agency: { ...DEFAULT_SETTINGS.agency, ...ag }, agencySignature: sig };
  out.brand = brandOf(out);
  useBrand(out);
  return out;
}
// catálogo de serviços da empresa (começa vazio; é cadastrado em Serviços no painel)
async function getCatalog() {
  const saved = await (await db()).get("catalog");
  return Array.isArray(saved) ? saved : DEFAULT_CATALOG;
}
const okId = (id) => /^[\w-]{6,64}$/.test(id || "");
const getProposal = async (id) => (okId(id) ? (await db()).get("proposals/" + id) : null);
const getContract = async (id) => (okId(id) ? (await db()).get("contracts/" + id) : null);
const getUser = async (id) => (okId(id) ? (await db()).get("users/" + id) : null);
// links públicos (/p/... e /c/...): o índice links/<id> diz de qual empresa é a proposta ou o contrato
async function linkDoc(x) { if (x.cid) return; x.cid = currentCompany(); await (await rootDb()).set("links/" + x.id, { cid: x.cid, at: nowISO() }); }
async function companyOfLink(id) { if (!okId(id)) return null; const l = await (await rootDb()).get("links/" + id); return l && okCompanyId(l.cid) ? l.cid : null; }
async function saveProposal(p) { await linkDoc(p); p.updatedAt = nowISO(); await (await db()).set("proposals/" + p.id, p); return p; }
async function saveContract(c) { await linkDoc(c); c.updatedAt = nowISO(); await (await db()).set("contracts/" + c.id, c); return c; }

/* ---------- empresas e logins (dados do sistema todo) ---------- */
const getCompany = async (cid) => (okCompanyId(cid) ? (await rootDb()).get("companies/" + cid) : null);
async function saveCompany(c) { c.updatedAt = nowISO(); await (await rootDb()).set("companies/" + c.id, c); return c; }
// e-mail é único no sistema: logins/<hash do e-mail> -> { cid, uid } (uid vazio = responsável pela empresa)
const loginKey = (email) => "logins/" + sha256(String(email || "").trim().toLowerCase()).slice(0, 40);
const getLogin = async (email) => (await rootDb()).get(loginKey(email));
const setLogin = async (email, v) => (await rootDb()).set(loginKey(email), { ...v, email: String(email).toLowerCase() });
const delLogin = async (email) => (await rootDb()).del(loginKey(email));
async function saveUser(u) { u.updatedAt = nowISO(); await (await db()).set("users/" + u.id, u); return u; }
const log = (p, type, text) => { (p.history ||= []).push({ at: nowISO(), type, text }); };
const userPublic = (u) => u && ({ id: u.id, name: u.name, doc: u.doc, email: u.email, phone: u.phone, active: u.active !== false, hasSignature: !!u.signature, createdAt: u.createdAt });

async function nextNumber() {
  const year = todayBR().slice(0, 4);
  const all = await listDocs("proposals/");
  const max = all.map((p) => String(p.number || "")).filter((n) => n.startsWith(year + "-")).map((n) => Number(n.split("-")[1]) || 0).reduce((a, b) => Math.max(a, b), 0);
  return `${year}-${String(max + 1).padStart(3, "0")}`;
}

/* ---------- saneamento ---------- */
const num = (v) => { if (typeof v === "number") return Math.round(v * 100) / 100; const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const slug = (s) => clean(s, 60).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function cleanService(s, keepI18n = false) {
  const kind = s.kind === "mensal" ? "mensal" : "unico";
  const payment = (Array.isArray(s.payment) ? s.payment : []).slice(0, 6).map((o, i) => ({
    id: slug(o.id || o.label || "opcao-" + (i + 1)) || "opcao-" + (i + 1),
    label: clean(o.label, 60) || "Opção " + (i + 1),
    total: num(o.total), upfront: num(o.upfront ?? o.total), n: Math.max(0, Math.min(24, Math.round(num(o.n)))),
    schedule: clean(o.schedule, 200),
  })).filter((o) => o.total > 0);
  const out = {
    id: slug(s.id || s.name) || token(6), active: s.active !== false, category: clean(s.category, 40), group: slug(s.group || ""),
    name: clean(s.name, 120), kind, minMonths: kind === "mensal" ? Math.max(1, Math.min(60, Math.round(num(s.minMonths) || 1))) : 0,
    tagline: clean(s.tagline, 160), description: clean(s.description, 2000),
    includes: cleanIncludes(s.includes), steps: cleanSteps(s.steps), deadline: clean(s.deadline, 200), notes: clean(s.notes, 400), payment,
  };
  if (s.anchor && Array.isArray(s.anchor.rows)) out.anchor = { title: clean(s.anchor.title, 160), rows: s.anchor.rows.slice(0, 20).map((r) => [clean(r[0], 60), num(r[1])]) };
  if (keepI18n && s.i18n && typeof s.i18n === "object") {
    out.i18n = {};
    for (const l of ["es", "en"]) {
      const t = s.i18n[l]; if (!t) continue;
      out.i18n[l] = { name: clean(t.name, 120), tagline: clean(t.tagline, 160), description: clean(t.description, 2000), includes: cleanIncludes(t.includes), steps: cleanSteps(t.steps), deadline: clean(t.deadline, 200), notes: clean(t.notes, 400), payment: (Array.isArray(t.payment) ? t.payment : []).slice(0, 6).map((o) => ({ label: clean(o && o.label, 60), schedule: clean(o && o.schedule, 200) })) };
      if (t.anchor && Array.isArray(t.anchor.rows)) out.i18n[l].anchor = { title: clean(t.anchor.title, 160), rows: t.anchor.rows.slice(0, 20).map((r) => [clean(r[0], 60)]) };
    }
  }
  if (s.recommended) out.recommended = true;
  return out;
}
function cleanIncludes(v) { return (Array.isArray(v) ? v : []).slice(0, 8).map((g) => ({ title: clean(g.title, 80), items: (Array.isArray(g.items) ? g.items : []).map((x) => clean(x, 160)).filter(Boolean).slice(0, 30) })).filter((g) => g.items.length || g.title); }
function cleanSteps(v) { return (Array.isArray(v) ? v : []).slice(0, 8).map((x) => ({ title: clean(x.title, 80), text: clean(x.text, 600) })).filter((x) => x.title); }

// números que recebem os avisos internos (empresa e consultor da proposta)
const teamPhones = (settings, seller) => (settings.waAgency === false ? [] : [settings.whatsapp, seller?.phone]);
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const pngData = (s) => typeof s === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 400000;
const isBR = (x) => !x.country || x.country === "BR";
// Documento: CPF/CNPJ válido no Brasil; no exterior, texto livre (RUC, CUIT, EIN, passaporte...)
const docOk = (doc, br) => (br ? validDoc(doc) : clean(doc, 40).length >= 4);
const docClean = (doc, br) => (br ? onlyDigits(doc).slice(0, 14) : clean(doc, 40));

const MSG = {
  pt: { offline: "Esta proposta não está mais disponível. Fale com a gente para receber uma proposta atualizada.", items: "Escolha pelo menos um serviço.", notIn: "Um dos serviços escolhidos não faz parte desta proposta.", pay: (n) => `Escolha a forma de pagamento de ${n}.`, group: "Escolha apenas uma opção de identidade de marca.", name: "Informe o nome completo ou a razão social.", doc: "CPF ou CNPJ inválido.", docX: "Informe o documento (RUC, CUIT, EIN ou outro).", rep: "Informe o nome do responsável pela empresa.", email: "Informe um e-mail válido.", phone: "Informe um WhatsApp com DDD.", addr: "Informe o endereço completo.", city: "Informe a cidade.", accept: "Confirme que está de acordo com as condições da proposta.", locked: "O contrato desta proposta já foi gerado. Para mudar algo, fale com a gente.", expired: "Esta proposta passou da validade. Fale com a gente para atualizá-la.", signed: "Este contrato já foi assinado.", notAvail: "Este contrato não está disponível para assinatura.", acceptC: "Confirme que leu e concorda com o contrato.", fullName: "Informe o nome completo de quem assina.", draw: "Desenhe a sua assinatura no quadro.", changed: "O contrato foi atualizado. Recarregue a página e confira o texto antes de assinar." },
  es: { offline: "Esta propuesta ya no está disponible. Escríbenos para recibir una propuesta actualizada.", items: "Elige al menos un servicio.", notIn: "Uno de los servicios elegidos no forma parte de esta propuesta.", pay: (n) => `Elige la forma de pago de ${n}.`, group: "Elige solo una opción de identidad de marca.", name: "Indica el nombre completo o la razón social.", doc: "Documento inválido.", docX: "Indica el documento (RUC, CUIT, CI u otro).", rep: "Indica el nombre del responsable de la empresa.", email: "Indica un correo electrónico válido.", phone: "Indica un WhatsApp con código de país.", addr: "Indica la dirección completa.", city: "Indica la ciudad.", accept: "Confirma que estás de acuerdo con las condiciones de la propuesta.", locked: "El contrato de esta propuesta ya fue generado. Para cambiar algo, escríbenos.", expired: "Esta propuesta venció. Escríbenos para actualizarla.", signed: "Este contrato ya fue firmado.", notAvail: "Este contrato no está disponible para firma.", acceptC: "Confirma que leíste el contrato y estás de acuerdo.", fullName: "Indica el nombre completo de quien firma.", draw: "Dibuja tu firma en el recuadro.", changed: "El contrato fue actualizado. Recarga la página y revisa el texto antes de firmar." },
  en: { offline: "This proposal is no longer available. Contact us to get an updated proposal.", items: "Choose at least one service.", notIn: "One of the chosen services is not part of this proposal.", pay: (n) => `Choose how to pay for ${n}.`, group: "Choose only one brand identity option.", name: "Enter your full name or company name.", doc: "Invalid ID.", docX: "Enter your ID (EIN, tax ID, passport or other).", rep: "Enter the name of the company's representative.", email: "Enter a valid e-mail.", phone: "Enter a phone number with country code.", addr: "Enter the full address.", city: "Enter the city.", accept: "Confirm that you agree with the proposal's conditions.", locked: "The contract for this proposal has already been created. To change anything, contact us.", expired: "This proposal has expired. Contact us to update it.", signed: "This agreement has already been signed.", notAvail: "This agreement is not available for signing.", acceptC: "Confirm that you have read and agree with the agreement.", fullName: "Enter the full name of the signer.", draw: "Draw your signature in the box.", changed: "The agreement was updated. Reload the page and review the text before signing." },
};
const M = (lang) => MSG[lang] || MSG.pt;

/* ---------- visões públicas ---------- */
function agencyPublic(settings, lang = "pt") {
  const t = lang !== "pt" ? AGENCY_I18N[lang] || {} : {};
  const b = settings.brand || brandOf(settings);
  const custom = (k) => JSON.stringify(b[k]) !== JSON.stringify(BRAND_DEFAULTS[k]); // textos editados valem em todos os idiomas; os padrão têm tradução no site
  return {
    e: currentCompany() || "", name: settings.agency.name, whatsapp: settings.whatsapp, instagram: settings.instagram, site: settings.site, city: settings.agency.city || "",
    intro: t.intro || settings.intro, nextSteps: t.nextSteps || settings.nextSteps,
    tagline: b.tagline, about: custom("about") ? b.about : "", statValue: b.statValue, statLabel: b.statLabel, principles: custom("principles") ? b.principles : null,
    logos: b.logos, portfolio: b.portfolio.map((x) => ({ id: x.id, name: x.name, v: x.v })),
  };
}
// proposta fora do ar: despublicada pelo painel ou vencida sem pedido
const isOffline = (p) => p.published === false || isExpired(p);
const previewKey = (id) => sha256(`${process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "propostas"}:preview:${id}`).slice(0, 20);
const isExpired = (p) => !!p.validUntil && p.validUntil < todayBR() && !["pedido", ...LOCKED].includes(p.status);

async function sellerPublic(id) {
  if (!id) return null;
  const u = await getUser(id);
  return u && u.active !== false ? { name: u.name, phone: u.phone, email: u.email } : null;
}

async function proposalPublic(p, settings, contract) {
  const lang = p.lang || "pt";
  return {
    id: p.id, number: p.number, open: !!p.open, title: p.title, message: p.message, validUntil: p.validUntil, status: p.status, expired: isExpired(p),
    lang, currency: p.currency || "BRL", country: p.country || "BR",
    client: { name: p.client?.name || "", company: p.client?.company || "", contact: p.client?.contact || "" },
    services: p.services,
    order: p.order ? { items: p.order.items, client: p.order.client, notes: p.order.notes, totals: p.order.totals, submittedAt: p.order.submittedAt } : null,
    declined: p.declined ? { at: p.declined.at } : null,
    contract: contract && contract.status !== "rascunho" && contract.status !== "cancelado" ? { id: contract.id, status: contract.status } : null,
    seller: await sellerPublic(p.sellerId),
    agency: agencyPublic(settings, lang),
  };
}

function contractPublic(c, settings) {
  const sig = (s) => (s ? { name: s.name, doc: s.doc ? (/^\d{11}$|^\d{14}$/.test(s.doc) ? fmtDoc(s.doc) : s.doc) : "", image: s.image, at: s.at } : null);
  return {
    id: c.id, number: c.number, status: c.status, text: c.text, hash: c.hash, sentAt: c.sentAt, proposalId: c.proposalId,
    lang: c.lang || "pt", currency: c.currency || "BRL", country: c.country || "BR",
    client: { name: c.client?.name, doc: c.client?.doc ? (isBR(c) ? fmtDoc(c.client.doc) : c.client.doc) : "", email: c.client?.email, representative: c.client?.representative },
    agencyName: c.agencyName, seller: c.seller ? { name: c.seller.name, phone: c.seller.phone } : null,
    signatures: { agency: sig(c.signatures?.agency), client: sig(c.signatures?.client), intermediary: sig(c.signatures?.intermediary) },
    agency: agencyPublic(settings, c.lang || "pt"), emailEnabled: emailEnabled(),
  };
}

function summary(p, contracts, users) {
  const c = contracts.find((x) => x.id === p.contractId);
  const u = users.find((x) => x.id === p.sellerId);
  return {
    id: p.id, number: p.number, title: p.title, status: p.status, expired: isExpired(p), offline: isOffline(p), published: p.published !== false, client: p.client, source: p.source || "",
    createdAt: p.createdAt, updatedAt: p.updatedAt, sentAt: p.sentAt, validUntil: p.validUntil, lang: p.lang || "pt", currency: p.currency || "BRL", country: p.country || "BR",
    views: p.views || 0, lastViewAt: p.lastViewAt, services: (p.services || []).map((s) => s.name),
    sellerId: p.sellerId || null, sellerName: u ? u.name : "", folderId: p.folderId || null, archived: !!p.archived,
    order: p.order ? { submittedAt: p.order.submittedAt, totals: { once: p.order.totals.once, monthly: p.order.totals.monthly }, client: { name: p.order.client.name } } : null,
    contract: c ? { id: c.id, status: c.status, signedAt: c.signatures?.client?.at } : null,
  };
}

/* ---------- roteador ---------- */
export default async (req, context) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  try {
    if (parts[0] === "public") return await publicEntry(req, context, url, parts.slice(1));
    if (parts[0] === "admin") return await adminEntry(req, context, url, parts.slice(1));
    return fail("Rota não encontrada.", 404);
  } catch (e) {
    console.error(e);
    return fail(`Erro interno (${String((e && e.message) || e).slice(0, 160)}). Tente de novo; se continuar, envie esta mensagem para o suporte.`, 500);
  }
};

export const config = { path: "/api/*" };

/* ---------- rotas públicas ---------- */
// Descobre a empresa: pelo id da proposta/contrato; ou por ?e=<empresa>; ou por ?ref=<caminho da página> (brand.css)
async function publicCompany(url, kind, id) {
  if ((kind === "proposal" && id !== "aberta") || kind === "contract") return companyOfLink(id);
  let e = url.searchParams.get("e") || "";
  const ref = url.searchParams.get("ref") || "";
  if (!e && ref) {
    const m = ref.match(/^\/(p|c)\/([\w-]+)/);
    if (m && m[2] !== "aberta") return companyOfLink(m[2]);
    const q = ref.split("?")[1];
    if (q) e = new URLSearchParams(q).get("e") || "";
  }
  const c = await getCompany(e);
  return c ? c.id : null;
}

async function publicEntry(req, context, url, parts) {
  const [kind, id] = parts;
  if (kind === "__emails" && process.env.EMAIL_TEST === "1") return json({ sent: sentLog });
  if (kind === "system" && req.method === "GET") { const sys = await getSystem(); return json({ productName: sys.productName, signupOpen: signupOpen(sys) }); }
  const cid = await publicCompany(url, kind, id);
  if (!cid) {
    if (kind === "proposal") return fail("Proposta não encontrada.", 404);
    if (kind === "contract") return fail("Contrato não encontrado.", 404);
    if (kind === "brand" || kind === "brand.css") return publicRoutes(req, context, url, parts); // identidade neutra
    return fail("Não encontrado.", 404);
  }
  return withCompany(cid, () => publicRoutes(req, context, url, parts));
}

async function publicRoutes(req, context, url, [kind, id, action]) {
  const settings = await getSettings();
  const m = req.method;

  // marca da empresa: cores e fontes (CSS), logos e galeria de trabalhos
  if (kind === "brand" && m === "GET") return json(agencyPublic(settings));
  if (kind === "brand.css" && m === "GET") return new Response(brandCss(settings), { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" } });
  if ((kind === "logo" || kind === "portfolio") && m === "GET" && currentCompany()) {
    const slot = kind === "logo" ? (["escuro", "claro"].includes(id) ? "logo-" + id : "") : okId(id) ? "portfolio-" + id : "";
    const img = slot ? await getImage(slot) : null;
    if (!img) return fail("Imagem não encontrada.", 404);
    return new Response(Buffer.from(img.b64, "base64"), { headers: { "content-type": img.type, "cache-control": "public, max-age=31536000, immutable" } });
  }

  if (kind === "proposal") {
    if (id === "aberta") {
      if (!settings.openLink) return fail("Este link não está disponível.", 404);
      const catalog = (await getCatalog()).filter((s) => s.active !== false).map((s) => cleanService(s));
      if (!catalog.length) return fail("Este link não está disponível.", 404);
      if (m === "GET" && !action) return json(await proposalPublic({ id: "aberta", number: "", open: true, title: "Monte a sua proposta", message: "", status: "aberta", services: catalog, client: {}, lang: "pt", currency: "BRL", country: "BR" }, settings));
      if (m === "POST" && action === "order") {
        const p = { id: token(), number: await nextNumber(), createdAt: nowISO(), status: "rascunho", source: "link aberto", title: "Pedido pelo link aberto", message: "", validUntil: addDays(todayBR(), settings.validityDays || 15), services: catalog, client: {}, lang: "pt", currency: "BRL", country: "BR", views: 1, history: [] };
        log(p, "criada", "Pedido feito pelo link aberto");
        const res = await placeOrder(p, await req.json().catch(() => ({})), settings, req, context);
        if (res.error) return fail(res.error, 400);
        p.client = { name: p.order.client.name, company: "", contact: p.order.client.representative, phone: p.order.client.phone, email: p.order.client.email };
        await saveProposal(p);
        return json({ ok: true, id: p.id });
      }
      return fail("Método não permitido.", 405);
    }

    const p = await getProposal(id);
    if (!p || p.deleted) return fail("Proposta não encontrada.", 404);
    const contract = p.contractId ? await getContract(p.contractId) : null;
    const T = M(p.lang);

    const preview = url.searchParams.get("preview") === "1" && url.searchParams.get("k") === previewKey(p.id);
    if (isOffline(p) && !preview) {
      const sl = p.sellerId ? await getUser(p.sellerId) : null;
      return json({ error: T.offline, offline: true, number: p.number, lang: p.lang || "pt", whatsapp: (sl && sl.phone) || settings.whatsapp, name: settings.agency.name }, 410);
    }
    if (m === "GET" && !action) {
      if (!preview) {
        p.views = (p.views || 0) + 1;
        p.lastViewAt = nowISO();
        if (!p.firstViewAt) { p.firstViewAt = p.lastViewAt; log(p, "visualizada", "Cliente abriu a proposta pela primeira vez"); }
        if (["rascunho", "enviada"].includes(p.status)) p.status = "visualizada";
        await saveProposal(p);
      }
      return json(await proposalPublic(p, settings, contract));
    }
    if (m === "POST" && action === "order") {
      if (LOCKED.includes(p.status) || (contract && contract.status !== "cancelado" && contract.status !== "rascunho")) return fail(T.locked, 409);
      if (isExpired(p)) return fail(T.expired, 409);
      const res = await placeOrder(p, await req.json().catch(() => ({})), settings, req, context);
      if (res.error) return fail(res.error, 400);
      await saveProposal(p);
      return json(await proposalPublic(p, settings, contract));
    }
    if (m === "POST" && action === "decline") {
      if (LOCKED.includes(p.status)) return fail(T.locked, 409);
      const body = await req.json().catch(() => ({}));
      p.declined = { at: nowISO(), reason: clean(body.reason, 600) };
      p.status = "recusada";
      log(p, "recusada", "Cliente informou que não é o momento" + (p.declined.reason ? `: ${p.declined.reason}` : ""));
      await saveProposal(p);
      const to = notifyAddress(settings);
      if (waEnabled()) { const sl = p.sellerId ? await getUser(p.sellerId) : null; await sendWaMany(teamPhones(settings, sl), `Proposta nº ${p.number} (${p.client?.name || ""}) recusada pelo cliente${p.declined.reason ? `: "${p.declined.reason}"` : "."}`); }
      if (to) await sendEmail({ to, subject: `Proposta ${p.number} recusada · ${p.client?.name || ""}`, html: layout("Proposta recusada", `<p>${esc(p.client?.name)} informou que não é o momento.</p>${p.declined.reason ? `<p>Motivo: ${esc(p.declined.reason)}</p>` : ""}`) });
      return json(await proposalPublic(p, settings, contract));
    }
    return fail("Método não permitido.", 405);
  }

  if (kind === "contract") {
    const c = await getContract(id);
    if (!c || c.status === "rascunho") return fail("Contrato não encontrado.", 404);
    const T = M(c.lang);
    if (m === "GET" && !action) return json(contractPublic(c, settings));
    if (m === "GET" && action === "pdf") {
      const bytes = await contractPdf(c);
      return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="contrato-${c.number}.pdf"`, "cache-control": "no-store" } });
    }
    if (m === "POST" && action === "sign") {
      if (c.status === "assinado") return fail(T.signed, 409);
      if (c.status !== "aguardando") return fail(T.notAvail, 409);
      const b = await req.json().catch(() => ({}));
      const br = isBR(c);
      const name = clean(b.name, 160), doc = docClean(b.doc, br), email = clean(b.email, 160).toLowerCase();
      if (!b.accept) return fail(T.acceptC);
      if (name.length < 5 || !name.includes(" ")) return fail(T.fullName);
      if (!docOk(doc, br)) return fail(br ? T.doc : T.docX);
      if (!validEmail(email)) return fail(T.email);
      if (!pngData(b.image)) return fail(T.draw);
      if (b.hash !== c.hash) return fail(T.changed, 409);
      c.signatures.client = { name, doc, email, image: b.image, at: nowISO(), ip: clientIP(req, context), ua: clean(req.headers.get("user-agent"), 300) };
      c.status = "assinado";
      c.signedAt = c.signatures.client.at;
      await saveContract(c);
      const p = await getProposal(c.proposalId);
      if (p) { p.status = "assinada"; log(p, "assinada", `Contrato assinado por ${name}`); await saveProposal(p); }
      let emailed = false;
      if (emailEnabled()) {
        const pdf = Buffer.from(await contractPdf(c)).toString("base64");
        const att = [{ filename: `contrato-${c.number}.pdf`, content: pdf }];
        const link = `${url.origin}/c/${c.id}`;
        const E = { pt: [`Sua cópia do contrato · ${brand().name}`, "Contrato assinado", `Olá, ${esc(name.split(" ")[0])}. Obrigado pela confiança. Segue em anexo a sua cópia do contrato nº ${esc(c.number)}, assinado pelas partes.`, "Ver contrato"], es: [`Tu copia del contrato · ${brand().name}`, "Contrato firmado", `Hola, ${esc(name.split(" ")[0])}. Gracias por tu confianza. Adjuntamos tu copia del contrato nº ${esc(c.number)}, firmado por las partes.`, "Ver contrato"], en: [`Your copy of the agreement · ${brand().name}`, "Agreement signed", `Hi ${esc(name.split(" ")[0])}, thank you for your trust. Attached is your copy of agreement no. ${esc(c.number)}, signed by the parties.`, "View agreement"] }[c.lang || "pt"];
        const r = await sendEmail({ to: email, subject: E[0], html: layout(E[1], `<p>${E[2]}</p>`, { url: link, label: E[3] }), attachments: att });
        emailed = r.sent;
        const to = [notifyAddress(settings), c.seller?.email].filter(Boolean);
        if (to.length) await sendEmail({ to, subject: `Contrato ${c.number} assinado · ${c.client?.name}`, html: layout("Contrato assinado", `<p>${esc(name)} assinou o contrato nº ${esc(c.number)}.</p>`, { url: link, label: "Abrir contrato" }), attachments: att });
      }
      if (waEnabled()) {
        const link = `${url.origin}/c/${c.id}`, pdfLink = `${url.origin}/api/public/contract/${c.id}/pdf?download=1`;
        if (settings.waClient !== false) await sendWa(c.client?.phone, waText("signedClient", c.lang || "pt", firstName(name), c.number, pdfLink));
        await sendWaMany(teamPhones(settings, c.seller), `✅ Contrato nº ${c.number} assinado por ${name} (${c.client?.name || ""}).\n${link}`);
      }
      return json({ ...contractPublic(c, settings), emailed });
    }
    return fail("Método não permitido.", 405);
  }
  return fail("Rota não encontrada.", 404);
}

async function placeOrder(p, body, settings, req, context, opts = {}) {
  const T = M(p.lang);
  const br = isBR(p);
  const items = (Array.isArray(body.items) ? body.items : []).map((x) => ({ serviceId: clean(x.serviceId, 80), optionId: clean(x.optionId, 80) }));
  if (!items.length) return { error: T.items };
  const groups = new Set();
  for (const it of items) {
    const s = p.services.find((x) => x.id === it.serviceId);
    if (!s) return { error: T.notIn };
    if (!s.payment.some((o) => o.id === it.optionId)) return { error: T.pay(s.name) };
    if (s.group) { if (groups.has(s.group)) return { error: T.group }; groups.add(s.group); }
  }
  // proposta fechada pela empresa: todos os serviços entram, o cliente escolhe só como pagar
  const fixedP = p.source !== "link aberto" && !p.services.some((s, i) => s.group && p.services.findIndex((x) => x.group === s.group) !== i);
  if (fixedP) { const miss = p.services.find((s) => !items.some((it) => it.serviceId === s.id)); if (miss) return { error: T.pay(miss.name) }; }
  const c = body.client || {};
  const client = {
    name: clean(c.name, 160), doc: docClean(c.doc, br), representative: clean(c.representative, 120),
    email: clean(c.email, 160).toLowerCase(), phone: clean(c.phone, 30),
    cep: br ? onlyDigits(c.cep).slice(0, 8) : clean(c.cep, 20), street: clean(c.street, 160), number: clean(c.number, 20), complement: clean(c.complement, 80), district: clean(c.district, 80),
    city: clean(c.city, 80), country: br ? "Brasil" : clean(c.country || (CTRY[p.country] || [])[1], 60),
  };
  client.address = clean(c.address, 240) || [client.street, client.number, client.complement, client.district, client.cep ? (br ? `CEP ${client.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : client.cep) : ""].filter(Boolean).join(", ");
  if (client.name.length < 3) return { error: T.name };
  if (!docOk(client.doc, br)) return { error: br ? T.doc : T.docX };
  if (br && client.doc.length === 14 && client.representative.length < 3) return { error: T.rep };
  if (!validEmail(client.email)) return { error: T.email };
  if (onlyDigits(client.phone).length < (br ? 10 : 7)) return { error: T.phone };
  if (client.address.length < 5) return { error: T.addr };
  if (client.city.length < 2) return { error: T.city };
  if (!body.accept) return { error: T.accept };
  const totals = computeTotals(p.services, items, p.currency || "BRL", p.lang || "pt");
  const again = !!p.order;
  p.order = { items, client, notes: clean(body.notes, 1200), totals, submittedAt: nowISO(), ip: clientIP(req, context) };
  p.status = "pedido";
  p.declined = null;
  log(p, "pedido", `${again ? "Pedido atualizado" : "Pedido enviado"} por ${client.name}: ${totals.lines.map((l) => l.name).join(", ")}`);
  const seller = p.sellerId ? await getUser(p.sellerId) : null;
  // confirmação automática para o cliente
  if (!opts.silent && emailEnabled() && client.email) {
    const origin0 = new URL(req.url).origin, lang = p.lang || "pt", mm0 = (v) => money(v, p.currency || "BRL", lang);
    const first = esc(String(client.representative || client.name).split(" ")[0]);
    const CF = {
      pt: [`Recebemos seu pedido · proposta ${p.number}`, "Pedido recebido", `Olá, ${first}! Recebemos o seu pedido da proposta nº ${esc(p.number)}. Em breve enviamos o contrato para assinatura on-line.`, "Ver meu pedido", "Serviços escolhidos"],
      es: [`Recibimos tu pedido · propuesta ${p.number}`, "Pedido recibido", `¡Hola, ${first}! Recibimos tu pedido de la propuesta nº ${esc(p.number)}. En breve te enviamos el contrato para firmar en línea.`, "Ver mi pedido", "Servicios elegidos"],
      en: [`We received your order · proposal ${p.number}`, "Order received", `Hi ${first}! We received your order for proposal no. ${esc(p.number)}. We'll send you the agreement to sign online shortly.`, "View my order", "Chosen services"],
    }[lang] || null;
    if (CF) await sendEmail({ to: client.email, replyTo: seller?.email || undefined, subject: CF[0], html: layout(CF[1], `<p>${CF[2]}</p><p><b>${CF[4]}</b></p><ul>${totals.lines.map((l) => `<li>${esc(l.name)}: ${esc(l.optionLabel)} · ${esc(l.kind === "mensal" ? mm0(l.total) + ({ pt: "/mês", es: "/mes", en: "/mo" }[lang] || "") : mm0(l.total))}</li>`).join("")}</ul>`, { url: `${origin0}/p/${p.id}#pedido`, label: CF[3] }) });
  }
  if (!opts.silent && waEnabled()) {
    const origin1 = new URL(req.url).origin, mmw = (v) => money(v, p.currency || "BRL", "pt");
    if (settings.waClient !== false) await sendWa(client.phone, waText("orderClient", p.lang || "pt", firstName(client.representative || client.name), p.number, `${origin1}/p/${p.id}#pedido`));
    await sendWaMany(teamPhones(settings, seller), `🛎️ ${again ? "Pedido atualizado" : "Novo pedido"} na proposta nº ${p.number}\n${client.name}${client.phone ? " · " + client.phone : ""}\n${totals.lines.map((l) => `• ${l.name}: ${l.optionLabel} (${l.kind === "mensal" ? mmw(l.total) + "/mês" : mmw(l.total)})`).join("\n")}\n\nGerar o contrato: ${origin1}/admin#/proposta/${p.id}`);
  }
  const to = [notifyAddress(settings), seller?.email].filter(Boolean);
  if (to.length && !opts.silent) {
    const origin = new URL(req.url).origin;
    const mm = (v) => money(v, p.currency || "BRL", "pt");
    await sendEmail({
      to, subject: `${again ? "Pedido atualizado" : "Novo pedido"} · ${client.name} · proposta ${p.number}`,
      html: layout(again ? "Pedido atualizado" : "Novo pedido recebido", `<p><b>${esc(client.name)}</b> escolheu:</p><ul>${totals.lines.map((l) => `<li>${esc(l.name)}: ${esc(l.optionLabel)} (${esc(l.kind === "mensal" ? mm(l.total) + "/mês" : mm(l.total))})</li>`).join("")}</ul>${p.order.notes ? `<p>Observações: ${esc(p.order.notes)}</p>` : ""}`, { url: `${origin}/admin#/proposta/${p.id}`, label: "Abrir no painel" }),
    });
  }
  return { ok: true };
}

/* ---------- rotas do painel ---------- */
const slow = () => new Promise((r) => setTimeout(r, 700)); // atrasa respostas de senha errada (dificulta tentativas em massa)
const companyPublic = (c) => ({ id: c.id, name: c.name, createdAt: c.createdAt, blocked: !!c.blocked, demo: !!c.demo, createdBy: c.createdBy || "cadastro", note: c.note || "", lastLoginAt: c.lastLoginAt || null, owner: { name: c.owner.name, email: c.owner.email } });

async function adminEntry(req, context, url, parts) {
  const [kind] = parts;
  const m = req.method;
  if (["login", "signup", "forgot", "reset"].includes(kind) && m === "POST") {
    if (!adminConfigured()) return fail("Defina a variável ADMIN_PASSWORD no Netlify para liberar o sistema.", 503);
    return accountRoutes(req, url, kind, context);
  }
  const sess = session(req);
  if (!sess) return fail("Sessão expirada. Entre de novo.", 401);
  if (sess.role === "super") return superRoutes(req, url, parts, context);
  const company = await getCompany(sess.cid);
  if (!company) return fail("Conta não encontrada. Entre de novo.", 401);
  if (company.blocked && !sess.su) return fail("O acesso desta empresa está suspenso. Fale com o suporte do sistema.", 401);
  if (sess.role === "admin" && !sess.su && sess.pv !== pwMark(company.owner)) return fail("A senha foi trocada. Entre de novo.", 401);
  return withCompany(company.id, () => adminRoutes(req, context, url, parts, sess, company));
}

// login, criação de conta e nova senha
async function accountRoutes(req, url, kind, context) {
  const b = await req.json().catch(() => ({}));
  const email = clean(b.email, 160).toLowerCase();
  const pw = typeof b.password === "string" ? b.password : "";

  if (kind === "login") {
    if (!email) {
      // dono do sistema: só a senha (ADMIN_PASSWORD)
      if (!checkPassword(pw)) { await slow(); return fail("Senha incorreta.", 401); }
      return json({ token: issueToken({ role: "super" }), role: "super" });
    }
    if (email === DEMO_EMAIL) await ensureDemoAccount(url, context); // a conta modelo de teste nasce no primeiro acesso
    const l = await getLogin(email);
    const c = l && (await getCompany(l.cid));
    if (!c) { await slow(); return fail("E-mail ou senha incorretos.", 401); }
    const seen = async () => { c.lastLoginAt = nowISO(); await saveCompany(c); };
    if (!l.uid) {
      if (!verifyPassword(pw, c.owner)) { await slow(); return fail("E-mail ou senha incorretos.", 401); }
      if (c.blocked) return fail("O acesso desta empresa está suspenso. Fale com o suporte do sistema.", 403);
      await seen();
      return json({ token: issueToken({ role: "admin", cid: c.id, pv: pwMark(c.owner) }), role: "admin", company: c.id });
    }
    const u = await withCompany(c.id, () => getUser(l.uid));
    if (!u || u.active === false || !verifyPassword(pw, u)) { await slow(); return fail("E-mail ou senha incorretos.", 401); }
    if (c.blocked) return fail("O acesso desta empresa está suspenso. Fale com o administrador da sua empresa.", 403);
    await seen();
    return json({ token: issueToken({ role: "seller", cid: c.id, uid: u.id, pv: pwMark(u) }), role: "seller", company: c.id });
  }

  if (kind === "signup") {
    if (b.website) return fail("Não foi possível criar a conta.", 400); // campo escondido: só robôs preenchem
    const sys = await getSystem();
    if (!signupOpen(sys)) return fail("O cadastro de novas contas está fechado no momento.", 403);
    const name = clean(b.name, 120), companyName = clean(b.company, 120);
    if (name.length < 3) return fail("Informe o seu nome.");
    if (companyName.length < 2) return fail("Informe o nome da empresa (ou o seu nome, se você trabalha como freelancer).");
    if (!validEmail(email)) return fail("Informe um e-mail válido.");
    if (pw.length < 8) return fail("A senha precisa de pelo menos 8 caracteres.");
    if (await getLogin(email)) { await slow(); return fail("Já existe uma conta com esse e-mail. Use Entrar ou Esqueci minha senha."); }
    const c = await createCompany({ name, companyName, email, password: pw, by: "cadastro", sys });
    c.lastLoginAt = nowISO(); await saveCompany(c);
    return json({ token: issueToken({ role: "admin", cid: c.id, pv: pwMark(c.owner) }), role: "admin", company: c.id });
  }

  if (kind === "forgot") {
    // resposta igual exista ou não a conta, para não revelar quais e-mails estão cadastrados
    if (!emailEnabled()) return json({ ok: true, emailEnabled: false });
    const l = validEmail(email) ? await getLogin(email) : null;
    const c = l && (await getCompany(l.cid));
    if (c) {
      const tok = token(24);
      await (await rootDb()).set("resets/" + sha256(tok).slice(0, 40), { email, exp: Date.now() + 3600e3 });
      await withCompany(c.id, async () => {
        await getSettings(); // usa a marca da empresa no e-mail
        await sendEmail({ to: email, subject: "Crie uma nova senha", html: layout("Nova senha", `<p>Recebemos um pedido para criar uma nova senha de acesso ao painel de propostas de <b>${esc(c.name)}</b>.</p><p>O link vale por 1 hora. Se não foi você, ignore este e-mail: a senha atual continua valendo.</p>`, { url: `${url.origin}/admin#/nova-senha/${tok}`, label: "Criar nova senha" }) });
      });
    }
    return json({ ok: true, emailEnabled: true });
  }

  if (kind === "reset") {
    const tok = clean(b.token, 80);
    const key = "resets/" + sha256(tok).slice(0, 40);
    const r = tok ? await (await rootDb()).get(key) : null;
    if (!r || !(r.exp > Date.now())) return fail("Este link de nova senha venceu ou já foi usado. Peça um novo em Esqueci minha senha.", 400);
    if (pw.length < 8) return fail("A senha precisa de pelo menos 8 caracteres.");
    const l = await getLogin(r.email);
    const c = l && (await getCompany(l.cid));
    if (!c) return fail("Conta não encontrada.", 404);
    await (await rootDb()).del(key);
    if (!l.uid) {
      Object.assign(c.owner, hashPassword(pw));
      await saveCompany(c);
      return json({ token: issueToken({ role: "admin", cid: c.id, pv: pwMark(c.owner) }), role: "admin", company: c.id });
    }
    return withCompany(c.id, async () => {
      const u = await getUser(l.uid);
      if (!u || u.active === false) return fail("Acesso desativado. Fale com o administrador da sua empresa.", 403);
      Object.assign(u, hashPassword(pw));
      await saveUser(u);
      return json({ token: issueToken({ role: "seller", cid: c.id, uid: u.id, pv: pwMark(u) }), role: "seller", company: c.id });
    });
  }
  return fail("Rota não encontrada.", 404);
}

// configurações do sistema todo (painel do dono): system
const SYSTEM_DEFAULTS = { productName: "Propostas", signupOpen: true, notice: "", defaultMaxSellers: 0, defaultValidityDays: 15 };
async function getSystem() { return { ...SYSTEM_DEFAULTS, ...((await (await rootDb()).get("system")) || {}) }; }
const signupOpen = (sys) => sys.signupOpen !== false && env("SIGNUP_CLOSED") !== "1";
const maxSellersOf = (c, sys) => { const n = c.maxSellers != null ? c.maxSellers : sys.defaultMaxSellers; return Number(n) > 0 ? Number(n) : 0; };

// conta modelo de teste: login fixo para enviar a quem for testar; o dono pode recriar do zero no painel
const DEMO_EMAIL = "conta.teste@example.com";
const DEMO_PASSWORD = "teste1234";

// cria uma empresa nova com o responsável, o índice de login e os dados iniciais
async function createCompany({ name, companyName, email, password, by, sys, extra = {} }) {
  const c = { id: token(9), name: companyName, createdAt: nowISO(), blocked: false, createdBy: by || "cadastro", owner: { name, email, ...hashPassword(password) }, ...extra };
  await saveCompany(c);
  await setLogin(email, { cid: c.id, uid: null });
  await withCompany(c.id, async () => (await db()).set("settings", { agency: { name: companyName, email, representative: name }, validityDays: sys.defaultValidityDays || 15 }));
  return c;
}

// apaga a empresa e tudo o que é dela: dados, logins (responsável e consultores) e links públicos
async function deleteCompany(c) {
  const root = await rootDb();
  const pre = `e/${c.id}/`;
  const keys = await root.list(pre);
  for (const k of keys) {
    const sub = k.slice(pre.length);
    if (/^(proposals|contracts)\//.test(sub)) await root.del("links/" + sub.split("/")[1]);
    if (/^users\//.test(sub)) { const u = await root.get(k); if (u && u.email) { const l = await getLogin(u.email); if (l && l.cid === c.id) await delLogin(u.email); } }
    await root.del(k);
  }
  const l = await getLogin(c.owner.email);
  if (l && l.cid === c.id) await delLogin(c.owner.email);
  await root.del("companies/" + c.id);
}

// (re)cria a conta modelo de teste com dados da empresa, catálogo de exemplo e as cinco propostas do modelo de teste
async function ensureDemoAccount(url, context, recreate = false) {
  const l = await getLogin(DEMO_EMAIL);
  const old = l && (await getCompany(l.cid));
  if (old && !recreate) return old;
  if (old) await deleteCompany(old);
  else if (l) await delLogin(DEMO_EMAIL);
  const sys = await getSystem();
  const c = await createCompany({ name: "Maria Modelo", companyName: "Estúdio Modelo", email: DEMO_EMAIL, password: DEMO_PASSWORD, by: "dono", sys, extra: { demo: true, note: "Conta modelo de teste (login compartilhado com quem for testar)." } });
  await withCompany(c.id, async () => {
    const s = await db();
    await s.set("settings", {
      agency: { name: "Estúdio Modelo", legalName: "Estúdio Modelo Serviços Ltda", cnpj: "11222333000181", address: "Avenida Paulista, 1000, Bela Vista", city: "São Paulo - SP", email: DEMO_EMAIL, representative: "Maria Modelo", representativeDoc: "52998224725" },
      whatsapp: "11999990000", site: "exemplo.com.br", validityDays: 15,
      brand: { tagline: "Projetos sob medida para o seu negócio", colors: { primary: "#0f766e", accent: "#f59e0b", dark: "#111827", light: "#f5f3ee" } },
      agencySignature: { name: "Maria Modelo", doc: "52998224725", image: demo_signature, custom: true },
      sellersUseAgencySignature: true,
    });
    await s.set("catalog", EXEMPLO_CATALOG);
    const r = await adminRoutes(new Request(url.origin + "/api/admin/demo", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), context, url, ["demo"], { role: "admin" }, c);
    if (r.status !== 200) throw new Error("conta de teste: " + (await r.text()).slice(0, 200));
  });
  return c;
}

// painel do dono do sistema: visão geral, configurações, contas (criar, editar, bloquear, nova senha, entrar, excluir) e conta de teste
async function superRoutes(req, url, [kind, id, action], context) {
  const m = req.method;
  const root = await rootDb();
  const sys = await getSystem();
  const body = async () => (m === "GET" ? {} : await req.json().catch(() => ({})));

  if ((kind === "bootstrap" || kind === "companies") && m === "GET" && !id) {
    const keys = await root.list("companies/");
    const all = (await Promise.all(keys.map((k) => root.get(k)))).filter(Boolean);
    const rows = await Promise.all(all.map(async (c) => {
      const [ps, cs, us] = await Promise.all([root.list(`e/${c.id}/proposals/`), root.list(`e/${c.id}/contracts/`), root.list(`e/${c.id}/users/`)]);
      return { ...companyPublic(c), proposals: ps.length, contracts: cs.length, sellers: us.length, maxSellers: maxSellersOf(c, sys), maxSellersOwn: c.maxSellers != null ? c.maxSellers : null };
    }));
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const stats = {
      companies: rows.length, active: rows.filter((c) => !c.blocked).length, blocked: rows.filter((c) => c.blocked).length,
      new7: rows.filter((c) => c.createdAt >= week).length, active7: rows.filter((c) => c.lastLoginAt && c.lastLoginAt >= week).length,
      proposals: rows.reduce((a, c) => a + c.proposals, 0), contracts: rows.reduce((a, c) => a + c.contracts, 0),
    };
    return json({ role: "super", companies: rows, stats, system: sys, signupOpen: signupOpen(sys), signupEnvClosed: env("SIGNUP_CLOSED") === "1", emailEnabled: emailEnabled(), waEnabled: waEnabled(), demoEmail: DEMO_EMAIL, demoPassword: DEMO_PASSWORD });
  }

  if (kind === "system" && m === "PUT") {
    const b = await body();
    const cur = (await root.get("system")) || {};
    if ("productName" in b) cur.productName = clean(b.productName, 60) || SYSTEM_DEFAULTS.productName;
    if ("signupOpen" in b) cur.signupOpen = !!b.signupOpen;
    if ("notice" in b) cur.notice = clean(b.notice, 400);
    if ("defaultMaxSellers" in b) cur.defaultMaxSellers = Math.max(0, Math.min(500, Math.round(num(b.defaultMaxSellers))));
    if ("defaultValidityDays" in b) cur.defaultValidityDays = Math.max(1, Math.min(365, Math.round(num(b.defaultValidityDays)) || 15));
    await root.set("system", cur);
    return json({ system: await getSystem() });
  }

  if (kind === "demo-account" && m === "POST") {
    const c = await ensureDemoAccount(url, context, true);
    return json({ company: companyPublic(c), email: DEMO_EMAIL, password: DEMO_PASSWORD });
  }

  if (kind !== "companies") return fail("Disponível no painel de uma empresa. Use Entrar no painel na lista de contas.", 403);

  // criar conta pelo painel do dono (a senha gerada aparece para você enviar ao responsável)
  if (m === "POST" && !id) {
    const b = await body();
    const name = clean(b.name, 120), companyName = clean(b.company, 120), email = clean(b.email, 160).toLowerCase();
    if (name.length < 3) return fail("Informe o nome do responsável.");
    if (companyName.length < 2) return fail("Informe o nome da empresa.");
    if (!validEmail(email)) return fail("Informe um e-mail válido.");
    if (await getLogin(email)) return fail("Já existe uma conta (ou consultor) com esse e-mail.");
    const pw = newPassword();
    const c = await createCompany({ name, companyName, email, password: pw, by: "dono", sys, extra: { note: clean(b.note, 400) } });
    return json({ company: companyPublic(c), password: pw });
  }

  const c = await getCompany(id);
  if (!c) return fail("Conta não encontrada.", 404);
  if (m === "PUT" && !action) {
    const b = await body();
    if ("blocked" in b) c.blocked = !!b.blocked;
    if ("company" in b && clean(b.company, 120).length >= 2) {
      c.name = clean(b.company, 120);
      await withCompany(c.id, async () => { const s = await db(); const cur = (await s.get("settings")) || {}; cur.agency = { ...(cur.agency || {}), name: c.name }; await s.set("settings", cur); });
    }
    if ("ownerName" in b && clean(b.ownerName, 120).length >= 3) c.owner.name = clean(b.ownerName, 120);
    if ("ownerEmail" in b) {
      const email = clean(b.ownerEmail, 160).toLowerCase();
      if (email !== c.owner.email) {
        if (!validEmail(email)) return fail("Informe um e-mail válido.");
        if (await getLogin(email)) return fail("Esse e-mail já está em uso no sistema.");
        await delLogin(c.owner.email);
        await setLogin(email, { cid: c.id, uid: null });
        c.owner.email = email;
      }
    }
    if ("maxSellers" in b) c.maxSellers = b.maxSellers === null || b.maxSellers === "" ? null : Math.max(0, Math.min(500, Math.round(num(b.maxSellers))));
    if ("note" in b) c.note = clean(b.note, 400);
    await saveCompany(c);
    return json({ company: companyPublic(c) });
  }
  if (m === "DELETE" && !action) {
    const b = await body();
    if (clean(b.confirm, 120).toLowerCase() !== String(c.name).toLowerCase()) return fail("Digite o nome da conta exatamente como aparece para confirmar a exclusão.");
    await deleteCompany(c);
    return json({ deleted: true });
  }
  if (m === "POST" && action === "reset") {
    const pw = newPassword();
    Object.assign(c.owner, hashPassword(pw));
    await saveCompany(c);
    return json({ company: companyPublic(c), password: pw });
  }
  if (m === "POST" && action === "enter") return json({ token: issueToken({ role: "admin", cid: c.id, su: true }), company: c.id });
  return fail("Método não permitido.", 405);
}

async function adminRoutes(req, context, url, [kind, id, action], sess, company) {
  const m = req.method;
  const s = await db();
  const isAdm = sess.role === "admin";
  let me = null;
  if (!isAdm) {
    me = await getUser(sess.uid);
    if (!me || me.active === false) return fail("Acesso desativado. Fale com o administrador.", 401);
    if (sess.pv !== pwMark(me)) return fail("A senha foi trocada. Entre de novo.", 401);
  }
  const settings = await getSettings();

  // conta do responsável pela empresa: nome e senha
  if (kind === "account") {
    if (!isAdm) return fail("Disponível para o administrador da empresa.", 403);
    if (m === "PUT") {
      if (sess.su) return fail("Entre com o e-mail da empresa para mudar estes dados.", 403);
      if (company.demo) return fail("Na conta modelo de teste o nome e a senha não mudam (o login é compartilhado).", 403);
      const b = await req.json().catch(() => ({}));
      if ("name" in b) { if (clean(b.name, 120).length < 3) return fail("Informe o seu nome."); company.owner.name = clean(b.name, 120); }
      let tok = null;
      if (b.newPassword) {
        if (!verifyPassword(b.currentPassword, company.owner)) return fail("Senha atual incorreta.");
        if (String(b.newPassword).length < 8) return fail("A nova senha precisa de pelo menos 8 caracteres.");
        Object.assign(company.owner, hashPassword(b.newPassword));
        tok = issueToken({ role: "admin", cid: company.id, pv: pwMark(company.owner) });
      }
      await saveCompany(company);
      return json({ company: companyPublic(company), token: tok });
    }
    return json({ company: companyPublic(company) });
  }
  const owns = (p) => isAdm || (p && p.sellerId === me.id);
  const adminOnly = () => (isAdm ? null : fail("Somente o administrador pode fazer isso.", 403));

  if (kind === "bootstrap" && m === "GET") {
    const [proposals, contracts, catalog, users, folders] = await Promise.all([listDocs("proposals/"), listDocs("contracts/"), getCatalog(), listDocs("users/"), listDocs("folders/")]);
    const pub = isAdm ? settings : { agency: settings.agency, brand: settings.brand, whatsapp: settings.whatsapp, validityDays: settings.validityDays, sellersUseAgencySignature: settings.sellersUseAgencySignature, agencySignature: settings.agencySignature ? { name: settings.agencySignature.name } : null, openLink: false };
    return json({
      role: sess.role, me: me ? userPublic(me) : null, company: isAdm ? companyPublic(company) : { id: company.id, name: company.name }, su: !!sess.su, notice: (await getSystem()).notice || "",
      settings: pub, catalog, fonts: fontList(), emailEnabled: emailEnabled(), waEnabled: waEnabled(), emailSender: isAdm ? emailSender() : "", defaultTemplate: TEMPLATES.pt, templateVars: TEMPLATE_VARS, today: todayBR(),
      countries: COUNTRIES, currencies: CURRENCIES,
      users: isAdm ? users.map(userPublic) : [],
      folders: folders.filter((f) => isAdm || f.ownerId === me.id).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((f) => ({ id: f.id, name: f.name, ownerId: f.ownerId || null, ownerName: f.ownerId ? (users.find((u) => u.id === f.ownerId) || {}).name || "" : "" })),
      proposals: proposals.filter((p) => !p.deleted && owns(p)).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).map((p) => summary(p, contracts, users)),
    });
  }

  if (kind === "me") {
    if (isAdm) return fail("Disponível para consultores.", 400);
    if (m === "PUT") {
      const b = await req.json().catch(() => ({}));
      if ("name" in b && clean(b.name, 120).length >= 5) me.name = clean(b.name, 120);
      if ("phone" in b) me.phone = clean(b.phone, 30);
      if ("doc" in b && validDoc(b.doc)) me.doc = onlyDigits(b.doc);
      if ("signature" in b) me.signature = b.signature && pngData(b.signature) ? b.signature : null;
      if (b.newPassword) {
        if (!verifyPassword(b.currentPassword, me)) return fail("Senha atual incorreta.");
        if (String(b.newPassword).length < 8) return fail("A nova senha precisa de pelo menos 8 caracteres.");
        Object.assign(me, hashPassword(b.newPassword));
        await saveUser(me);
        // a senha nova encerra os outros acessos; este continua com um token novo
        return json({ me: userPublic(me), signature: me.signature || null, token: issueToken({ role: "seller", cid: company.id, uid: me.id, pv: pwMark(me) }) });
      }
      await saveUser(me);
    }
    return json({ me: userPublic(me), signature: me.signature || null });
  }

  if (kind === "users") {
    const deny = adminOnly(); if (deny) return deny;
    if (m === "POST" && !id) {
      const b = await req.json().catch(() => ({}));
      const email = clean(b.email, 160).toLowerCase();
      if (clean(b.name, 120).length < 5) return fail("Informe o nome completo do consultor.");
      if (!validEmail(email)) return fail("Informe um e-mail válido.");
      if (b.doc && !validDoc(b.doc)) return fail("CPF inválido.");
      // o e-mail é o login, então vale para o sistema todo (não pode repetir em outra empresa)
      if (await getLogin(email)) return fail("Esse e-mail já está em uso no sistema. Use outro e-mail para este consultor.");
      const max = maxSellersOf(company, await getSystem());
      if (max && (await listDocs("users/")).filter((x) => !x.demo).length >= max) return fail(`O seu plano permite até ${max} consultor${max > 1 ? "es" : ""}. Fale com o suporte para aumentar.`, 403);
      const pw = newPassword();
      const u = { id: token(), name: clean(b.name, 120), doc: onlyDigits(b.doc), email, phone: clean(b.phone, 30), active: true, signature: null, createdAt: nowISO(), ...hashPassword(pw) };
      await saveUser(u);
      await setLogin(email, { cid: company.id, uid: u.id });
      return json({ user: userPublic(u), password: pw });
    }
    const u = await getUser(id);
    if (!u) return fail("Consultor não encontrado.", 404);
    if (m === "PUT") {
      const b = await req.json().catch(() => ({}));
      if ("name" in b && clean(b.name, 120).length >= 5) u.name = clean(b.name, 120);
      if ("phone" in b) u.phone = clean(b.phone, 30);
      if ("doc" in b) { if (b.doc && !validDoc(b.doc)) return fail("CPF inválido."); u.doc = onlyDigits(b.doc); }
      if ("active" in b) u.active = !!b.active;
      await saveUser(u);
      return json({ user: userPublic(u) });
    }
    if (m === "POST" && action === "reset") { const pw = newPassword(); Object.assign(u, hashPassword(pw)); await saveUser(u); return json({ user: userPublic(u), password: pw }); }
    return fail("Método não permitido.", 405);
  }

  // pastas de clientes: o administrador vê todas; o consultor, só as dele
  if (kind === "folders") {
    if (m === "POST" && !id) {
      const b = await req.json().catch(() => ({}));
      const name = clean(b.name, 80);
      if (name.length < 2) return fail("Dê um nome para a pasta.");
      const all = await listDocs("folders/");
      const mine = all.filter((f) => (f.ownerId || null) === (isAdm ? null : me.id));
      if (mine.some((f) => f.name.toLowerCase() === name.toLowerCase())) return fail("Já existe uma pasta com esse nome.");
      const f = { id: token(), name, ownerId: isAdm ? null : me.id, createdAt: nowISO() };
      await s.set("folders/" + f.id, f);
      return json({ folder: f });
    }
    const f = okId(id) ? await s.get("folders/" + id) : null;
    if (!f || (!isAdm && f.ownerId !== me.id)) return fail("Pasta não encontrada.", 404);
    if (m === "PUT") {
      const b = await req.json().catch(() => ({}));
      const name = clean(b.name, 80);
      if (name.length < 2) return fail("Dê um nome para a pasta.");
      f.name = name; await s.set("folders/" + f.id, f);
      return json({ folder: f });
    }
    if (m === "DELETE") {
      const ps = (await listDocs("proposals/")).filter((p) => p.folderId === f.id);
      for (const p of ps) { p.folderId = null; await saveProposal(p); }
      await s.del("folders/" + f.id);
      return json({ ok: true, moved: ps.length });
    }
    return fail("Método não permitido.", 405);
  }

  // ações em lote: arquivar, desarquivar, mover para pasta, excluir
  if (kind === "proposals" && id === "bulk" && m === "POST") {
    const b = await req.json().catch(() => ({}));
    const ids = Array.isArray(b.ids) ? b.ids.filter(okId).slice(0, 200) : [];
    if (!ids.length) return fail("Selecione pelo menos uma proposta.");
    let folder = null;
    if (b.action === "move" && b.folderId) {
      folder = okId(b.folderId) ? await s.get("folders/" + b.folderId) : null;
      if (!folder || (!isAdm && folder.ownerId !== me.id)) return fail("Pasta não encontrada.", 404);
    }
    if (!["archive", "unarchive", "move", "delete"].includes(b.action)) return fail("Ação inválida.");
    let done = 0, skipped = 0;
    for (const pid of ids) {
      const p = await getProposal(pid);
      if (!p || p.deleted || !owns(p)) { skipped++; continue; }
      if (b.action === "delete") {
        const c = p.contractId ? await getContract(p.contractId) : null;
        if (c && c.status === "assinado" && !(b.force && isAdm)) { skipped++; continue; }
        if (c) await s.del("contracts/" + c.id);
        await s.del("proposals/" + p.id);
      } else {
        if (b.action === "archive") { p.archived = true; p.archivedAt = nowISO(); log(p, "arquivada", `Proposta arquivada${me ? " por " + me.name : ""}`); }
        if (b.action === "unarchive") { p.archived = false; log(p, "arquivada", "Proposta desarquivada"); }
        if (b.action === "move") p.folderId = folder ? folder.id : null;
        await saveProposal(p);
      }
      done++;
    }
    return json({ done, skipped });
  }

  if (kind === "proposals") {
    if (!id && m === "POST") {
      const b = await req.json().catch(() => ({}));
      const p = { id: token(), number: await nextNumber(), createdAt: nowISO(), status: "rascunho", views: 0, history: [], sellerId: isAdm ? null : me.id };
      const err = await applyProposalEdits(p, b, settings, isAdm);
      if (err) return fail(err);
      if (!p.services.length) return fail("Inclua pelo menos um serviço.");
      log(p, "criada", `Proposta criada${me ? " por " + me.name : ""}`);
      await saveProposal(p);
      return json(p);
    }
    const p = await getProposal(id);
    if (!p || p.deleted || !owns(p)) return fail("Proposta não encontrada.", 404);
    const contract = p.contractId ? await getContract(p.contractId) : null;
    const seller = p.sellerId ? userPublic(await getUser(p.sellerId)) : null;
    const out = (extra = {}) => json({ proposal: p, contract, seller, previewKey: previewKey(p.id), offline: isOffline(p), ...extra });
    if (m === "GET" && !action) return out();
    if (m === "PUT" && !action) {
      const b = await req.json().catch(() => ({}));
      if (LOCKED.includes(p.status) && b.services) return fail("Esta proposta já tem contrato enviado. Os serviços não podem mudar.", 409);
      const err = await applyProposalEdits(p, b, settings, isAdm);
      if (err) return fail(err);
      if (!p.services.length) return fail("Inclua pelo menos um serviço.");
      log(p, "editada", `Proposta editada${me ? " por " + me.name : ""}`);
      await saveProposal(p);
      return json({ proposal: p, contract, seller: p.sellerId ? userPublic(await getUser(p.sellerId)) : null });
    }
    if (m === "DELETE" && !action) {
      if (contract && contract.status === "assinado" && !(isAdm && url.searchParams.get("force") === "1")) return fail(isAdm ? "Proposta com contrato assinado: confirme a exclusão." : "Só o administrador pode excluir propostas com contrato assinado.", 409);
      if (contract) await s.del("contracts/" + contract.id);
      await s.del("proposals/" + p.id);
      return json({ ok: true });
    }
    if (m === "POST" && action === "sent") {
      if (!p.sentAt) p.sentAt = nowISO();
      if (p.status === "rascunho") p.status = "enviada";
      const b = await req.json().catch(() => ({}));
      log(p, "enviada", `Link enviado${b.via ? " por " + clean(b.via, 30) : ""}${me ? " (" + me.name + ")" : ""}`);
      await saveProposal(p);
      return out();
    }
    // publicar e despublicar o link da proposta
    if (m === "POST" && action === "publish") {
      const b = await req.json().catch(() => ({}));
      if (b.published === false) {
        p.published = false; p.unpublishedAt = nowISO();
        log(p, "publicacao", `Proposta tirada do ar${me ? " por " + me.name : " pelo administrador"}`);
      } else {
        if (isExpired(p)) {
          if (!isAdm) return fail("Esta proposta venceu. Só o administrador pode publicá-la de novo.", 403);
          const nv = /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil || "") ? b.validUntil : addDays(todayBR(), settings.validityDays || 15);
          if (nv < todayBR()) return fail("A nova validade precisa ser hoje ou uma data futura.");
          p.validUntil = nv;
        }
        p.published = true; delete p.unpublishedAt;
        log(p, "publicacao", `Proposta publicada${me ? " por " + me.name : " pelo administrador"}, válida até ${p.validUntil.split("-").reverse().join("/")}`);
      }
      await saveProposal(p);
      return out();
    }
    // arquivo .zip com a proposta, os contratos e as assinaturas, para guardar
    if (m === "GET" && action === "archive") {
      const contracts = (await listDocs("contracts/")).filter((c) => c.proposalId === p.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const seller = p.sellerId ? await getUser(p.sellerId) : null;
      const files = {};
      const slug2 = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40);
      const base = `proposta-${p.number}${p.client?.name ? "-" + slug2(p.client.name) : ""}`;
      const lang = p.lang || "pt", mm = (v) => money(v, p.currency || "BRL", lang);
      const L = [];
      L.push(`## Proposta comercial nº ${p.number}`);
      L.push([`Cliente: ${p.client?.name || "-"}`, p.client?.contact && `Contato: ${p.client.contact}`, p.client?.phone && `WhatsApp: ${p.client.phone}`, p.client?.email && `E-mail: ${p.client.email}`, `Criada em: ${dateLongL(p.createdAt, "pt")}`, p.validUntil && `Válida até: ${dateLongL(p.validUntil, "pt")}`, seller && `Consultor: ${seller.name}${seller.phone ? " · " + seller.phone : ""}`, `Situação: ${p.status}${p.archived ? " (arquivada)" : ""}`].filter(Boolean).join("\n"));
      if (p.message) L.push(`## Mensagem ao cliente\n${p.message}`);
      L.push("## Serviços oferecidos");
      for (const sv of p.services) L.push(`${sv.name} (${sv.kind === "mensal" ? `mensal, mínimo ${sv.minMonths || 1} meses` : "projeto único"})\n${sv.payment.map((o) => `• ${o.label}: ${mm(o.total)}${sv.kind === "mensal" ? "/mês" : ""}`).join("\n")}`);
      if (p.order) {
        const o = p.order, cl = o.client, tt = o.totals;
        L.push(`## Pedido do cliente\nRecebido em ${dateLongL(o.submittedAt, "pt")}\n${tt.lines.map((l) => `• ${l.name}: ${l.optionLabel}, ${mm(l.total)}${l.kind === "mensal" ? "/mês" : ""} (${l.schedule})`).join("\n")}\n${tt.once ? `Projetos: ${mm(tt.once)}\n` : ""}${tt.monthly ? `Mensal: ${mm(tt.monthly)}\n` : ""}Para começar: ${mm(tt.upfront)}`);
        L.push(`## Dados do contratante\n${[`Nome: ${cl.name}`, `Documento: ${/^\d{11}$|^\d{14}$/.test(cl.doc || "") ? fmtDoc(cl.doc) : cl.doc || "-"}`, cl.representative && `Responsável: ${cl.representative}`, `E-mail: ${cl.email}`, `Telefone: ${cl.phone}`, `Endereço: ${cl.address}, ${cl.city}${cl.country ? ", " + cl.country : ""}`, o.notes && `Observações: ${o.notes}`].filter(Boolean).join("\n")}`);
      }
      if (p.declined) L.push(`## Recusa\n${dateLongL(p.declined.at, "pt")}${p.declined.reason ? ": " + p.declined.reason : ""}`);
      L.push(`## Histórico\n${(p.history || []).map((h) => `${new Date(h.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${h.text}`).join("\n")}`);
      files[`${base}.pdf`] = await documentPdf({ number: p.number, lang: "pt", text: L.join("\n\n"), client: p.client, tag: `Proposta nº ${p.number}`, subtitle: `Arquivo gerado em ${dateLongL(nowISO(), "pt")}` });
      for (const c of contracts) {
        const tag = c.status === "assinado" ? "assinado" : c.status === "cancelado" ? "cancelado" : c.status === "aguardando" ? "aguardando-assinatura" : "rascunho";
        files[`contrato-${c.number}-${tag}.pdf`] = await contractPdf(c);
        for (const [role, sg] of Object.entries(c.signatures || {})) {
          if (sg && /^data:image\/png;base64,/.test(sg.image || "")) files[`assinaturas/${tag}-${role === "agency" ? "empresa" : role === "client" ? "cliente" : "intermediador"}.png`] = Uint8Array.from(Buffer.from(sg.image.split(",")[1], "base64"));
        }
      }
      const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === "image" && typeof v === "string" && v.startsWith("data:") ? "(ver pasta assinaturas)" : v)));
      files["dados.json"] = strToU8(JSON.stringify({ geradoEm: nowISO(), proposta: strip(p), contratos: contracts.map(strip), consultor: seller ? userPublic(seller) : null }, null, 2));
      files["LEIA-ME.txt"] = strToU8(`Arquivo da proposta nº ${p.number} · ${p.client?.name || ""}\nGerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} pelo sistema de propostas de ${brand().name}.\n\n${base}.pdf: proposta, pedido, dados do cliente e histórico.\ncontrato-*.pdf: contratos com assinaturas e registro de auditoria (código de verificação SHA-256 no rodapé).\nassinaturas/: imagens das assinaturas.\ndados.json: todos os dados em formato aberto.\n`);
      const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v instanceof Uint8Array ? v : new Uint8Array(v), { level: 6 }]])));
      return new Response(zip, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${base}.zip"`, "cache-control": "no-store" } });
    }
    // envia o link da proposta no WhatsApp do cliente, pelo número conectado à Z-API
    if (m === "POST" && action === "whatsapp") {
      if (!waEnabled()) return fail("O WhatsApp automático não está ativo.", 409);
      const b = await req.json().catch(() => ({}));
      const phone = clean(b.phone || p.client.phone, 40);
      if (onlyDigits(phone).length < 10) return fail("Informe o WhatsApp do cliente com DDD.");
      const r = await sendWa(phone, waText("proposalClient", p.lang || "pt", firstName(p.client.contact), p.client.name, `${url.origin}/p/${p.id}`));
      if (!r.sent) return fail(r.error ? `Não foi possível enviar: ${r.error}` : "Não foi possível enviar pelo WhatsApp.", 502);
      if (!p.client.phone) p.client.phone = phone;
      if (!p.sentAt) p.sentAt = nowISO();
      if (p.status === "rascunho") p.status = "enviada";
      log(p, "enviada", `Proposta enviada no WhatsApp automático${me ? " (" + me.name + ")" : ""}`);
      await saveProposal(p);
      return out();
    }
    // envia o link da proposta direto para o e-mail do cliente
    if (m === "POST" && action === "email") {
      if (!emailEnabled()) return fail("Os e-mails automáticos não estão ativos.", 409);
      const b = await req.json().catch(() => ({}));
      const to = clean(b.to || p.client.email, 160);
      if (!validEmail(to)) return fail("Informe um e-mail válido para o cliente.");
      const lang = p.lang || "pt", link = `${url.origin}/p/${p.id}`;
      const nm = esc(String(p.client.contact || p.client.name || "").split(" ")[0]);
      const E = {
        pt: [`Proposta comercial · ${brand().name}`, "Sua proposta está pronta", `Olá${nm ? ", " + nm : ""}! Preparamos a proposta de ${esc(brand().name)} para ${esc(p.client.name)}. Pelo link você vê os serviços, escolhe as opções e já envia o pedido.`, "Abrir a proposta"],
        es: [`Propuesta comercial · ${brand().name}`, "Tu propuesta está lista", `¡Hola${nm ? ", " + nm : ""}! Preparamos la propuesta de ${esc(brand().name)} para ${esc(p.client.name)}. En el enlace ves los servicios, eliges las opciones y envías tu pedido.`, "Abrir la propuesta"],
        en: [`Commercial proposal · ${brand().name}`, "Your proposal is ready", `Hi${nm ? " " + nm : ""}! We've prepared ${esc(brand().name)}'s proposal for ${esc(p.client.name)}. At the link you can see the services, pick the options and send your order.`, "Open the proposal"],
      }[lang] || null;
      const seller = p.sellerId ? await getUser(p.sellerId) : null;
      const r = await sendEmail({ to, replyTo: seller?.email || undefined, subject: E[0], html: layout(E[1], `<p>${E[2]}</p>${p.message ? `<p>${esc(p.message)}</p>` : ""}`, { url: link, label: E[3] }) });
      if (!r.sent) return fail(r.error ? `Não foi possível enviar: ${r.error}` : "Não foi possível enviar o e-mail.", 502);
      if (!p.client.email) p.client.email = to;
      if (!p.sentAt) p.sentAt = nowISO();
      if (p.status === "rascunho") p.status = "enviada";
      log(p, "enviada", `Proposta enviada por e-mail para ${to}${me ? " (" + me.name + ")" : ""}`);
      await saveProposal(p);
      return out();
    }
    if (m === "POST" && action === "reopen") {
      if (contract && contract.status !== "cancelado") return fail("Cancele o contrato antes de reabrir a proposta.", 409);
      p.status = p.firstViewAt ? "visualizada" : p.sentAt ? "enviada" : "rascunho";
      p.declined = null;
      log(p, "reaberta", "Proposta reaberta para o cliente");
      await saveProposal(p);
      return out();
    }
    if (m === "POST" && action === "contract") {
      if (!p.order) return fail("O cliente ainda não enviou o pedido.", 409);
      if (contract && contract.status !== "cancelado") return json({ proposal: p, contract, seller, missing: missingVars(contract.text) });
      const c = await buildContract(p, settings);
      await saveContract(c);
      p.contractId = c.id;
      log(p, "contrato", `Contrato gerado (rascunho)${me ? " por " + me.name : ""}`);
      await saveProposal(p);
      return json({ proposal: p, contract: c, seller, missing: missingVars(c.text) });
    }
    return fail("Método não permitido.", 405);
  }

  if (kind === "contracts") {
    const c = await getContract(id);
    if (!c) return fail("Contrato não encontrado.", 404);
    const p = await getProposal(c.proposalId);
    if (!owns(p)) return fail("Contrato não encontrado.", 404);
    const seller = p && p.sellerId ? userPublic(await getUser(p.sellerId)) : null;
    const out = (extra = {}) => json({ proposal: p, contract: c, seller, missing: missingVars(c.text), ...extra });
    if (m === "GET" && action === "pdf") {
      const bytes = await contractPdf(c);
      return new Response(bytes, { headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
    }
    if (m === "PUT" && !action) {
      if (c.status !== "rascunho") return fail("Só é possível editar o texto antes de enviar para assinatura.", 409);
      const b = await req.json().catch(() => ({}));
      const text = String(b.text ?? c.text).slice(0, 60000);
      if (text !== c.text && c.signatures?.intermediary) delete c.signatures.intermediary;
      c.text = text;
      await saveContract(c);
      return out();
    }
    if (m === "POST" && action === "regenerate") {
      if (c.status !== "rascunho") return fail("O contrato já foi enviado.", 409);
      const fresh = await buildContract(p, settings, c, { noSeller: !!c.noSeller });
      Object.assign(c, { text: fresh.text, agencyName: fresh.agencyName, seller: fresh.seller, signatures: {} });
      await saveContract(c);
      return out();
    }
    // Administrador segue sem o consultor neste contrato (refaz o texto sem a cláusula do intermediador)
    if (m === "POST" && action === "drop-intermediary") {
      const deny = adminOnly(); if (deny) return deny;
      if (c.status !== "rascunho") return fail("O contrato já foi enviado.", 409);
      const fresh = await buildContract(p, settings, c, { noSeller: true });
      Object.assign(c, { text: fresh.text, agencyName: fresh.agencyName, seller: null, signatures: {}, noSeller: true });
      await saveContract(c);
      log(p, "contrato", "Contrato refeito sem o consultor como intermediador");
      await saveProposal(p);
      return out();
    }
    // Consultor assina o rascunho como intermediador e testemunha
    if (m === "POST" && action === "intermediary") {
      if (isAdm) return fail("A assinatura de intermediador é feita pelo consultor no próprio acesso.", 403);
      if (c.status !== "rascunho") return fail("O contrato já foi enviado.", 409);
      if (!c.seller || c.seller.id !== me.id) return fail("Você não é o consultor desta proposta.", 403);
      const b = await req.json().catch(() => ({}));
      const image = b.useSaved ? me.signature : b.image;
      if (!pngData(image)) return fail("Desenhe a sua assinatura.");
      if (!validDoc(me.doc)) return fail("Cadastre o seu CPF em Meu perfil antes de assinar.");
      c.signatures = { ...(c.signatures || {}), intermediary: { name: me.name, doc: me.doc, email: me.email, image, at: nowISO(), ip: clientIP(req, context), ua: clean(req.headers.get("user-agent"), 300) } };
      if (b.saveSignature) { me.signature = image; await saveUser(me); }
      await saveContract(c);
      if (p) { log(p, "contrato", `${me.name} assinou o contrato como intermediador e testemunha`); await saveProposal(p); }
      if (waEnabled() && settings.waAgency !== false) await sendWa(settings.whatsapp, `✍️ ${me.name} assinou como intermediador o contrato nº ${c.number} (${c.client?.name || ""}).${settings.sellersUseAgencySignature ? "" : " Falta você liberar para o cliente."}\n${url.origin}/admin#/proposta/${c.proposalId}`);
      return out();
    }
    if (m === "POST" && action === "send") {
      if (c.status !== "rascunho") return fail("Este contrato já foi enviado.", 409);
      const miss = missingVars(c.text);
      if (miss.length) return fail(`Complete os dados em falta antes de enviar: ${miss.join(", ")}.`, 409);
      if (c.seller && !c.signatures?.intermediary) return fail(isAdm ? `O consultor ${c.seller.name} ainda não assinou como intermediador. Peça para ele assinar no acesso dele, ou tire o consultor da proposta e atualize o contrato.` : "Assine como intermediador antes de liberar o contrato.", 409);
      const b = await req.json().catch(() => ({}));
      let agencySig;
      if (isAdm) {
        const sig = b.signature || {}, saved = settings.agencySignature || {};
        const name = clean(sig.name || saved.name, 160), doc = onlyDigits(sig.doc || saved.doc);
        const image = !sig.image || sig.useSaved ? saved.image : sig.image;
        if (name.length < 5) return fail("Informe o nome de quem assina pela empresa.");
        if (!validDoc(doc)) return fail("CPF ou CNPJ de quem assina pela empresa é inválido.");
        if (!pngData(image)) return fail("Desenhe a assinatura da empresa.");
        agencySig = { name, doc, image };
        if (b.saveSignature) { const cur = (await s.get("settings")) || {}; cur.agencySignature = { name, doc, image, custom: true }; await s.set("settings", cur); }
      } else {
        const sg = settings.agencySignature;
        if (!settings.sellersUseAgencySignature || !sg || !pngData(sg.image)) return fail("A assinatura padrão da empresa não está liberada para consultores. Peça ao administrador para liberar o contrato.", 403);
        agencySig = { name: sg.name, doc: sg.doc, image: sg.image, appliedBy: `${me.name} (consultor)` };
      }
      c.hash = sha256(c.text);
      c.sentAt = nowISO();
      c.signatures = { ...(c.signatures || {}), agency: { ...agencySig, at: c.sentAt, ip: clientIP(req, context), ua: clean(req.headers.get("user-agent"), 300) } };
      c.status = "aguardando";
      await saveContract(c);
      if (p) { p.status = "contrato"; log(p, "contrato", `Contrato assinado pela empresa e enviado ao cliente${me ? " por " + me.name : ""}`); await saveProposal(p); }
      let emailed = false;
      if (b.emailClient && emailEnabled() && c.client?.email) {
        const E = { pt: [`Contrato para assinatura · ${brand().name}`, "Seu contrato está pronto", `O contrato com os serviços que você escolheu já está assinado por ${esc(brand().name)}. Falta só a sua assinatura.`, "Ler e assinar"], es: [`Contrato para firmar · ${brand().name}`, "Tu contrato está listo", `El contrato con los servicios que elegiste ya está firmado por ${esc(brand().name)}. Solo falta tu firma.`, "Leer y firmar"], en: [`Agreement to sign · ${brand().name}`, "Your agreement is ready", `The agreement with the services you chose has been signed by ${esc(brand().name)}. It only needs your signature.`, "Read and sign"] }[c.lang || "pt"];
        const r = await sendEmail({ to: c.client.email, subject: E[0], html: layout(E[1], `<p>${E[2]}</p>`, { url: `${url.origin}/c/${c.id}`, label: E[3] }) });
        emailed = r.sent;
      }
      let whatsapped = false;
      if (waEnabled() && b.waClient !== false && settings.waClient !== false && c.client?.phone) {
        const r = await sendWa(c.client.phone, waText("contractClient", c.lang || "pt", firstName(c.client.representative || c.client.name), c.number, `${url.origin}/c/${c.id}`));
        whatsapped = r.sent;
        if (p && r.sent) { log(p, "contrato", "Link do contrato enviado no WhatsApp do cliente"); await saveProposal(p); }
      }
      return out({ emailed, whatsapped });
    }
    if (m === "POST" && action === "cancel") {
      if (c.status === "assinado") return fail("Contratos assinados não podem ser cancelados por aqui.", 409);
      c.status = "cancelado";
      await saveContract(c);
      if (p) { p.status = "pedido"; p.contractId = null; log(p, "contrato", "Contrato cancelado"); await saveProposal(p); }
      return json({ proposal: p, contract: null, seller });
    }
    return fail("Método não permitido.", 405);
  }

  // prévia do modelo de contrato (Configurações): texto do modelo com o anexo automático, se faltar
  if (kind === "contract-preview" && m === "POST") {
    const deny = adminOnly(); if (deny) return deny;
    const b = await req.json().catch(() => ({}));
    const t = b.text && String(b.text).trim() ? String(b.text).slice(0, 60000) : TEMPLATES.pt;
    return json({ text: numberClauses(withEssentials(t, "pt")).replace(/\{\{\s*titulo_contrato\s*\}\}/g, contractVars({ settings, proposal: { lang: "pt" }, client: {}, lines: [], totals: {}, seller: null }).titulo_contrato) });
  }
  // modelo de teste: cria (ou remove) consultor, pasta e propostas em todas as etapas, marcados com demo: true
  if (kind === "demo" && m === "POST") {
    const deny = adminOnly(); if (deny) return deny;
    const b = await req.json().catch(() => ({}));
    const [ps, cs, us, fs] = await Promise.all([listDocs("proposals/"), listDocs("contracts/"), listDocs("users/"), listDocs("folders/")]);
    for (const x of ps.filter((x) => x.demo)) await s.del("proposals/" + x.id);
    for (const x of cs.filter((x) => x.demo)) await s.del("contracts/" + x.id);
    for (const x of us.filter((x) => x.demo)) { await s.del("users/" + x.id); if (x.email) { const l = await getLogin(x.email); if (l && l.uid === x.id) await delLogin(x.email); } }
    for (const x of fs.filter((x) => x.demo)) await s.del("folders/" + x.id);
    if (b.remove) return json({ removed: true });
    const catalog = (await getCatalog()).filter((x) => x.active !== false);
    if (!catalog.length) return fail("Cadastre pelo menos um serviço em Serviços antes de criar o modelo de teste.");
    // serviços do catálogo da empresa, por posição; um só por grupo de escolha única
    const pool = catalog.filter((x, i, a) => !x.group || a.findIndex((y) => y.group === x.group) === i);
    const byId = (i) => pool[i % pool.length];
    const pw = newPassword();
    // e-mail fictício e único (o login vale para o sistema todo)
    const seller = { id: token(), demo: true, name: "Consultor de Teste", doc: "52998224725", email: `consultor.teste.${token(4).toLowerCase().replace(/[^a-z0-9]/g, "x")}@exemplo.com`, phone: "11999990000", active: true, signature: demo_signature, createdAt: nowISO(), ...hashPassword(pw) };
    await saveUser(seller);
    await setLogin(seller.email, { cid: company.id, uid: seller.id });
    const folder = { id: token(), demo: true, name: "Modelo de teste", ownerId: null, createdAt: nowISO() };
    await s.set("folders/" + folder.id, folder);
    const fake = { headers: req.headers, url: req.url };
    const mk = async (o) => {
      const svcs = [...new Map(o.services.map((sid) => byId(sid)).map((x) => [x.id, x])).values()].map((x) => cleanService(localizeService(x, o.lang || "pt")));
      if (o.rate) svcs.forEach((x) => { x.payment.forEach((op) => { op.total = Math.max(5, Math.round(op.total / o.rate / 5) * 5); op.upfront = Math.min(op.total, Math.max(5, Math.round(op.upfront / o.rate / 5) * 5)); }); if (x.anchor) x.anchor.rows = x.anchor.rows.map((r) => [r[0], Math.round(r[1] / o.rate / 5) * 5]); });
      const p = { id: token(), demo: true, number: await nextNumber(), createdAt: nowISO(), status: "rascunho", views: 0, history: [], sellerId: o.seller ? seller.id : null, folderId: folder.id, client: { name: o.name, company: "", contact: o.contact || "", phone: o.phone || "", email: o.email || "" }, title: "", message: "Proposta criada pelo modelo de teste. Pode abrir, pedir e assinar à vontade.", validUntil: addDays(todayBR(), 15), services: svcs, country: o.country || "BR", lang: o.lang || "pt", currency: o.currency || "BRL" };
      p.title = svcs.map((x) => x.name).join(", ").slice(0, 140);
      log(p, "criada", "Proposta criada pelo modelo de teste");
      if (o.order) { const r = await placeOrder(p, { items: [...new Set(o.order.map((sid) => byId(sid).id))].map((sid) => ({ serviceId: sid, optionId: svcs.find((x) => x.id === sid).payment[0].id })), client: o.client, accept: true }, settings, fake, context, { silent: true }); if (r.error) throw new Error("modelo de teste: " + r.error); }
      if (o.stage >= 2) {
        const c = await buildContract(p, settings); c.demo = true; p.contractId = c.id;
        if (o.stage >= 3) {
          const at = nowISO();
          if (c.seller) c.signatures.intermediary = { name: seller.name, doc: seller.doc, email: seller.email, image: demo_signature, at, ip: "teste", ua: "modelo de teste" };
          const sg = settings.agencySignature;
          if (!sg || !sg.image) throw new Error("salve a assinatura padrão em Dados da empresa antes de criar o modelo de teste");
          c.signatures.agency = { name: sg.name, doc: sg.doc, image: sg.image, at, ip: "teste", ua: "modelo de teste", ...(c.seller ? { appliedBy: seller.name + " (consultor)" } : {}) };
          c.hash = sha256(c.text); c.sentAt = at; c.status = "aguardando"; p.status = "contrato";
        }
        if (o.stage >= 4) { c.signatures.client = { name: o.client.representative || o.client.name, doc: o.signDoc, email: o.client.email, image: demo_signature, at: nowISO(), ip: "teste", ua: "modelo de teste" }; c.status = "assinado"; c.signedAt = c.signatures.client.at; p.status = "assinada"; }
        await saveContract(c);
      }
      await saveProposal(p);
      return p;
    };
    const brClient = (n) => ({ name: n, doc: "11222333000181", representative: "Maria Teste da Silva", email: "cliente.teste@exemplo.com", phone: "11999998888", cep: "01310100", street: "Avenida Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo - SP" });
    const pyClient = { name: "Ferretería Prueba SA", doc: "RUC 80012345-6", representative: "Juan Prueba", email: "cliente.py@exemplo.com", phone: "+595 981 123456", address: "Av. Mcal. López 1234, 1209", city: "Asunción", country: "Paraguai" };
    const out = [];
    out.push(await mk({ name: "1. Teste · aberta para o cliente", contact: "Maria", services: [0, 1], seller: false }));
    out.push(await mk({ name: "2. Teste · pedido recebido (consultor)", contact: "Maria", services: [1, 2], seller: true, order: [1, 2], client: brClient("Barbearia Teste Ltda") }));
    out.push(await mk({ name: "3. Teste · contrato em rascunho (consultor)", services: [0], seller: true, order: [0], client: brClient("Clínica Teste Ltda"), stage: 2 }));
    out.push(await mk({ name: "4. Teste · Paraguai aguardando assinatura", services: [0], seller: true, order: [0], client: pyClient, country: "PY", lang: "es", currency: "USD", rate: 5.4, stage: 3 }));
    out.push(await mk({ name: "5. Teste · contrato assinado", services: [1], seller: false, order: [1], client: brClient("Loja Teste Ltda"), stage: 4, signDoc: "52998224725" }));
    return json({ seller: { email: seller.email, password: pw }, folderId: folder.id, proposals: out.map((p) => ({ id: p.id, number: p.number, name: p.client.name })) });
  }

  // mensagem de teste no WhatsApp
  if (kind === "wa-test" && m === "POST") {
    const deny = adminOnly(); if (deny) return deny;
    if (!waEnabled()) return fail("O WhatsApp automático não está ativo: faltam ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN no Netlify (ou um novo deploy).", 409);
    const b = await req.json().catch(() => ({}));
    const phone = clean(b.phone, 40) || settings.whatsapp;
    const r = await sendWa(phone, `✅ Teste do sistema de propostas de ${brand().name}: o WhatsApp automático está funcionando.`);
    if (!r.sent) return fail(r.reason === "number" ? "Número inválido. Use DDD e número, ex.: 11 99999-9999." : `Falhou: ${r.error || "sem resposta da Z-API"}`, 502);
    return json({ ok: true });
  }
  if (kind === "__wa" && process.env.WA_TEST === "1") return json({ sent: waLog });

  // e-mail de teste, para conferir a configuração do Gmail
  if (kind === "email-test" && m === "POST") {
    const deny = adminOnly(); if (deny) return deny;
    if (!emailEnabled()) return fail("Os e-mails automáticos não estão ativos: faltam GMAIL_USER e GMAIL_APP_PASSWORD no Netlify (ou um novo deploy).", 409);
    const b = await req.json().catch(() => ({}));
    const to = clean(b.to, 160) || notifyAddress(settings);
    if (!validEmail(to)) return fail("Informe um e-mail válido.");
    const r = await sendEmail({ to, subject: `Teste de e-mail · Sistema de propostas de ${brand().name}`, html: layout("E-mail funcionando", `<p>Se você recebeu esta mensagem, o sistema de propostas já consegue enviar e-mails para os clientes.</p>`) });
    if (!r.sent) return fail(r.error ? `Falhou: ${r.error}` : "Falhou ao enviar.", 502);
    return json({ ok: true, to });
  }

  // imagens da marca: logo-escuro, logo-claro ou portfolio (nova imagem da galeria). Chegam já reduzidas pelo painel.
  if (kind === "brand-image") {
    const deny = adminOnly(); if (deny) return deny;
    const cur = (await s.get("settings")) || {};
    const br = { ...BRAND_DEFAULTS, ...(cur.brand || {}) };
    br.logos = { ...BRAND_DEFAULTS.logos, ...(br.logos || {}) };
    br.portfolio = Array.isArray(br.portfolio) ? [...br.portfolio] : [];
    if (m === "POST") {
      const b = await req.json().catch(() => ({}));
      const img = parseImage(b.image);
      if (!img) return fail("Envie uma imagem PNG ou JPG de até 1 MB.");
      const v = token(8);
      if (b.slot === "logo-escuro" || b.slot === "logo-claro") {
        if (img.type !== "image/png") return fail("O logo precisa estar em PNG.");
        await putImage(b.slot, img);
        br.logos[b.slot.slice(5)] = v;
      } else if (b.slot === "portfolio") {
        if (br.portfolio.length >= 24) return fail("A galeria aceita até 24 imagens.");
        const pid = token(10);
        await putImage("portfolio-" + pid, img);
        br.portfolio.push({ id: pid, name: clean(b.name, 80), v });
      } else return fail("Tipo de imagem inválido.");
    } else if (m === "PUT") {
      // reordenar e renomear a galeria
      const list = (await req.json().catch(() => ({}))).portfolio;
      if (!Array.isArray(list)) return fail("Lista inválida.");
      br.portfolio = list.map((x) => { const o = br.portfolio.find((y) => y.id === x.id); return o ? { ...o, name: clean(x.name, 80) } : null; }).filter(Boolean);
    } else if (m === "DELETE") {
      if (id === "logo-escuro" || id === "logo-claro") { await delImage(id); br.logos[id.slice(5)] = null; }
      else if (okId(id) && br.portfolio.some((x) => x.id === id)) { await delImage("portfolio-" + id); br.portfolio = br.portfolio.filter((x) => x.id !== id); }
      else return fail("Imagem não encontrada.", 404);
    } else return fail("Método não permitido.", 405);
    cur.brand = br;
    await s.set("settings", cur);
    return json({ settings: await getSettings() });
  }

  if (kind === "settings" && m === "PUT") {
    const deny = adminOnly(); if (deny) return deny;
    const b = await req.json().catch(() => ({}));
    const cur = (await s.get("settings")) || {};
    if (b.agency) cur.agency = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.agency).map((k) => [k, clean(b.agency[k], 240)]));
    if (b.brand && typeof b.brand === "object") {
      const x = b.brand, old = cur.brand || {};
      const colors = {};
      for (const k of Object.keys(BRAND_DEFAULTS.colors)) colors[k] = okColor(x.colors && x.colors[k]) ? x.colors[k].toLowerCase() : (old.colors && old.colors[k]) || BRAND_DEFAULTS.colors[k];
      cur.brand = {
        ...old,
        tagline: clean(x.tagline, 160), about: clean(x.about, 1500) || BRAND_DEFAULTS.about,
        statValue: clean(x.statValue, 12), statLabel: clean(x.statLabel, 60),
        principles: (Array.isArray(x.principles) ? x.principles : []).map((p) => clean(p, 120)).filter(Boolean).slice(0, 6),
        colors, fontTitle: clean(x.fontTitle, 30), fontText: clean(x.fontText, 30), emailFromName: clean(x.emailFromName, 80),
      };
    }
    if ("whatsapp" in b) cur.whatsapp = onlyDigits(b.whatsapp).slice(0, 15);
    if ("instagram" in b) cur.instagram = clean(b.instagram, 60).replace(/^@/, "");
    if ("site" in b) cur.site = clean(b.site, 200);
    if ("validityDays" in b) cur.validityDays = Math.max(1, Math.min(120, Math.round(num(b.validityDays)) || 15));
    if ("openLink" in b) cur.openLink = !!b.openLink;
    if ("sellersUseAgencySignature" in b) cur.sellersUseAgencySignature = !!b.sellersUseAgencySignature;
    if ("waClient" in b) cur.waClient = !!b.waClient;
    if ("waAgency" in b) cur.waAgency = !!b.waAgency;
    if ("intro" in b) cur.intro = clean(b.intro, 1500);
    if ("nextSteps" in b && Array.isArray(b.nextSteps)) cur.nextSteps = b.nextSteps.slice(0, 6).map((x) => ({ title: clean(x.title, 60), text: clean(x.text, 400) })).filter((x) => x.title);
    // contrato da empresa (em português): null volta ao modelo genérico do sistema
    if ("contractText" in b) cur.contractText = b.contractText && String(b.contractText).trim() ? String(b.contractText).slice(0, 60000) : null;
    if ("agencySignature" in b) cur.agencySignature = b.agencySignature && pngData(b.agencySignature.image) ? { name: clean(b.agencySignature.name, 160), doc: onlyDigits(b.agencySignature.doc), image: b.agencySignature.image, custom: true } : null;
    await s.set("settings", cur);
    // nome da empresa na lista do dono do sistema acompanha Dados da empresa
    if (cur.agency && cur.agency.name && cur.agency.name !== company.name) { company.name = cur.agency.name; await saveCompany(company); }
    return json({ settings: await getSettings() });
  }

  if (kind === "catalog") {
    const deny = adminOnly(); if (deny) return deny;
    if (m === "PUT") {
      const b = await req.json().catch(() => ({}));
      if (!Array.isArray(b.catalog)) return fail("Catálogo inválido.");
      const seen = new Set();
      const list = b.catalog.slice(0, 60).map((x) => cleanService(x, true)).filter((x) => x.name && x.payment.length).map((x) => { let id = x.id; let i = 2; while (seen.has(id)) id = `${x.id}-${i++}`; seen.add(id); delete x.recommended; return { ...x, id }; });
      await s.set("catalog", list);
      return json({ catalog: list });
    }
  }
  return fail("Rota não encontrada.", 404);
}

async function buildContract(p, settings, prev, opts = {}) {
  const lang = p.lang || "pt";
  const totals = computeTotals(p.services, p.order.items, p.currency || "BRL", lang);
  const u = p.sellerId && !opts.noSeller ? await getUser(p.sellerId) : null;
  const seller = u && u.active !== false ? { id: u.id, name: u.name, doc: u.doc, email: u.email, phone: u.phone } : null;
  const tpl = withEssentials(lang === "pt" ? settings.contractText || TEMPLATES.pt : TEMPLATES[lang] || TEMPLATES.pt, lang);
  return {
    id: prev ? prev.id : token(), proposalId: p.id, number: p.number, createdAt: prev ? prev.createdAt : nowISO(), status: "rascunho",
    lang, currency: p.currency || "BRL", country: p.country || "BR",
    client: p.order.client, lines: totals.lines, totals, agencyName: settings.agency.legalName || settings.agency.name, seller, signatures: {},
    text: numberClauses(fillTemplate(tpl, contractVars({ settings, proposal: p, client: p.order.client, lines: totals.lines, totals, seller }))),
  };
}

async function applyProposalEdits(p, b, settings, isAdm) {
  if (b.client) p.client = { name: clean(b.client.name, 160), company: clean(b.client.company, 160), contact: clean(b.client.contact, 120), phone: clean(b.client.phone, 30), email: clean(b.client.email, 160) };
  if ("title" in b) p.title = clean(b.title, 140);
  if ("message" in b) p.message = clean(b.message, 2000);
  if ("validUntil" in b) p.validUntil = /^\d{4}-\d{2}-\d{2}$/.test(b.validUntil) ? b.validUntil : "";
  if (!p.validUntil) p.validUntil = addDays(todayBR(), settings.validityDays || 15);
  if (!(LOCKED.includes(p.status))) {
    if ("country" in b) p.country = CTRY[b.country] ? b.country : "BR";
    if ("lang" in b) p.lang = LANGS.includes(b.lang) ? b.lang : "pt";
    if ("currency" in b) p.currency = CUR.includes(b.currency) ? b.currency : "BRL";
  }
  p.country ||= "BR"; p.lang ||= "pt"; p.currency ||= "BRL";
  if (isAdm && "sellerId" in b) {
    if (!b.sellerId) p.sellerId = null;
    else { const u = await getUser(b.sellerId); if (!u || u.active === false) return "Consultor não encontrado ou desativado."; p.sellerId = u.id; }
  }
  if ("folderId" in b) {
    if (!b.folderId) p.folderId = null;
    else { const f = okId(b.folderId) ? await (await db()).get("folders/" + b.folderId) : null; if (f && (isAdm || f.ownerId === p.sellerId)) p.folderId = f.id; }
  }
  if ("archived" in b) p.archived = !!b.archived;
  if (Array.isArray(b.services)) p.services = b.services.slice(0, 20).map((x) => cleanService(x)).filter((x) => x.name && x.payment.length);
  p.services ||= [];
  if (!p.title) p.title = p.services.map((x) => x.name).join(", ").slice(0, 140);
  return null;
}

