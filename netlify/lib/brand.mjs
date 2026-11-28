// Marca da empresa (white label): nome, cores, fontes, logos e galeria de trabalhos.
// Tudo vem de "Dados da empresa" no painel (settings.agency + settings.brand) e das imagens salvas em brand/*.
// Nada da marca fica fixo no código: sem dados, as páginas usam uma identidade neutra.
import { db } from "./store.mjs";

export const BRAND_DEFAULTS = {
  tagline: "",
  about: "Trabalho feito com qualidade, atenção a cada detalhe e foco total nos objetivos do seu negócio.",
  statValue: "",
  statLabel: "",
  principles: ["Ouvir antes de propor.", "Planejar antes de executar.", "Cumprir o combinado.", "Acompanhar de perto."],
  colors: { primary: "#1f6049", accent: "#d4f26a", dark: "#0e2a20", light: "#f4f7f1" },
  fontTitle: "alexandria",
  fontText: "alexandria",
  layout: "neutro", // modelo da página da proposta (LAYOUTS)
  style: { caps: false, corners: "redondo", hero: "marca", hide: [], theme: "escuro" }, // ajustes finos do modelo; theme = tema da página do cliente
  logos: { escuro: null, claro: null }, // versão da imagem salva (ou null): escuro = logo para fundo escuro, claro = para fundo claro
  portfolio: [], // [{ id, name, v }]
};

// Textos da página da proposta que a empresa pode trocar em Dados da empresa › Página da proposta.
// Em branco, vale o texto padrão do sistema (já traduzido para espanhol e inglês).
export const PAGE_TEXT_KEYS = [
  "hero_label", "hero_blur", "hero_sharp", "welcome", "team",
  "pick_label", "pick_h", "note_fixed", "steps_label", "steps_h", "steps_p", "after_order",
  "pf_label", "pf_h", "pf_p", "thanks",
  "your_order", "h_review", "lead_review", "fine", "accept", "send", "thanks_p", "signed_p",
];
export function cleanPageTexts(v) {
  const out = {};
  if (!v || typeof v !== "object") return out;
  for (const k of PAGE_TEXT_KEYS) {
    const x = String(v[k] ?? "").replace(/\r/g, "").replace(/[<>]/g, "").trim().slice(0, 600);
    if (x) out[k] = x;
  }
  return out;
}

// Modelos de página da proposta: cada um traz cores, fontes e ajustes próprios.
// A empresa escolhe um modelo e pode trocar qualquer item depois (Página da proposta no painel).
export const LAYOUTS = {
  // Neutro = visual padrão do sistema (verde escuro e verde-limão, cantos arredondados)
  neutro: { colors: { primary: "#1f6049", accent: "#d4f26a", dark: "#0e2a20", light: "#f4f7f1" }, fontTitle: "alexandria", fontText: "alexandria", style: { caps: false, corners: "redondo", hero: "marca" } },
  saude: { colors: { primary: "#1f8a8a", accent: "#3fa98c", dark: "#0f3b3c", light: "#f3f8f7" }, fontTitle: "nunito", fontText: "lato", style: { caps: false, corners: "redondo", hero: "marca" } },
  construcao: { colors: { primary: "#e0a019", accent: "#d9561f", dark: "#1b1b1b", light: "#f2eee6" }, fontTitle: "montserrat", fontText: "roboto", style: { caps: true, corners: "reto", hero: "escuro" } },
  tecnologia: { colors: { primary: "#5b5ff0", accent: "#14b8d4", dark: "#0b1020", light: "#eef1fb" }, fontTitle: "inter", fontText: "inter", style: { caps: false, corners: "suave", hero: "marca" } },
};
export const SECTIONS = ["boas-vindas", "principios", "etapas", "galeria", "agradecimento"];
// [botões, cartões, faixas da página, espaço entre as faixas]
const CORNERS = { reto: ["3px", "0px", "0px", "0px"], suave: ["10px", "14px", "18px", "10px"], redondo: ["14px", "24px", "32px", "14px"] };
export function cleanStyle(x, old) {
  const o = { ...BRAND_DEFAULTS.style, ...(old || {}) }, v = x && typeof x === "object" ? x : {};
  return {
    caps: "caps" in v ? !!v.caps : o.caps === true,
    corners: CORNERS[v.corners] ? v.corners : CORNERS[o.corners] ? o.corners : "redondo",
    hero: ["escuro", "marca"].includes(v.hero) ? v.hero : ["escuro", "marca"].includes(o.hero) ? o.hero : "escuro",
    hide: (Array.isArray(v.hide) ? v.hide : Array.isArray(o.hide) ? o.hide : []).filter((k) => SECTIONS.includes(k)),
    theme: ["escuro", "claro"].includes(v.theme) ? v.theme : o.theme === "claro" ? "claro" : "escuro",
  };
}
// Regras de CSS dos ajustes finos (as mesmas o painel aplica na prévia ao vivo)
export function styleCss(st) {
  const c = CORNERS[st.corners] || CORNERS.redondo;
  const hide = { "boas-vindas": "#boas-vindas,a[href=\"#boas-vindas\"]", principios: ".about-side", etapas: "#etapas,a[href=\"#etapas\"]", galeria: ".brands", agradecimento: ".statement" };
  let css = `:root{--tt:${st.caps ? "uppercase" : "none"};--r-pill:${c[0]};--r-card:${c[1]};--r-sec:${c[2]};--sec-gap:${c[3]};--hero-bg:${st.hero === "marca" ? "linear-gradient(135deg,var(--primary-deep),var(--night) 75%)" : "var(--night)"}}\n`;
  const h = (st.hide || []).map((k) => hide[k]).filter(Boolean);
  if (h.length) css += `${h.join(",")}{display:none!important}\n`;
  return css;
}

// Fontes disponíveis. "local" vem de /assets/fonts; "google" é carregada do Google Fonts; "system" é a do aparelho.
export const FONTS = {
  alexandria: { label: "Alexandria", stack: '"Alexandria","Helvetica Neue",Arial,sans-serif', local: true },
  archivo: { label: "Archivo", stack: '"Archivo","Arial Black","Helvetica Neue",Arial,sans-serif', local: true },
  inter: { label: "Inter", stack: '"Inter","Helvetica Neue",Arial,sans-serif', google: "Inter:wght@300;400;500;600;700;800" },
  montserrat: { label: "Montserrat", stack: '"Montserrat","Helvetica Neue",Arial,sans-serif', google: "Montserrat:wght@300;400;500;600;700;800" },
  poppins: { label: "Poppins", stack: '"Poppins","Helvetica Neue",Arial,sans-serif', google: "Poppins:wght@300;400;500;600;700;800" },
  roboto: { label: "Roboto", stack: '"Roboto","Helvetica Neue",Arial,sans-serif', google: "Roboto:wght@300;400;500;700;900" },
  lato: { label: "Lato", stack: '"Lato","Helvetica Neue",Arial,sans-serif', google: "Lato:wght@300;400;700;900" },
  nunito: { label: "Nunito", stack: '"Nunito","Helvetica Neue",Arial,sans-serif', google: "Nunito:wght@300;400;500;600;700;800" },
  playfair: { label: "Playfair Display", stack: '"Playfair Display",Georgia,serif', google: "Playfair+Display:wght@400;500;600;700;800" },
  lora: { label: "Lora", stack: '"Lora",Georgia,serif', google: "Lora:wght@400;500;600;700" },
  system: { label: "Do aparelho (sem download)", stack: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif' },
};
export const fontList = () => Object.entries(FONTS).map(([k, f]) => [k, f.label]);

const HEX = /^#[0-9a-f]{6}$/i;
export const okColor = (c) => typeof c === "string" && HEX.test(c);

export function brandOf(settings) {
  const b = (settings && settings.brand) || {};
  const colors = { ...BRAND_DEFAULTS.colors };
  for (const k of Object.keys(colors)) if (okColor(b.colors && b.colors[k])) colors[k] = b.colors[k].toLowerCase();
  return {
    ...BRAND_DEFAULTS,
    ...b,
    colors,
    fontTitle: FONTS[b.fontTitle] ? b.fontTitle : BRAND_DEFAULTS.fontTitle,
    fontText: FONTS[b.fontText] ? b.fontText : BRAND_DEFAULTS.fontText,
    logos: { ...BRAND_DEFAULTS.logos, ...(b.logos || {}) },
    portfolio: Array.isArray(b.portfolio) ? b.portfolio : [],
    principles: Array.isArray(b.principles) ? b.principles : BRAND_DEFAULTS.principles,
    layout: LAYOUTS[b.layout] ? b.layout : "neutro",
    style: cleanStyle(b.style),
    name: (settings && settings.agency && settings.agency.name) || "Sua empresa",
  };
}

// Marca em uso nesta requisição, para os textos de e-mail, WhatsApp e PDF.
// É definida a cada requisição por getSettings() da empresa atendida (cada função atende uma requisição por vez).
let current = brandOf({});
export const useBrand = (settings) => { current = brandOf(settings); return current; };
export const brand = () => current;

// CSS com as cores e fontes da empresa, carregado por todas as páginas depois de base.css
export function brandCss(settings) {
  const b = brandOf(settings);
  const fams = [...new Set([b.fontTitle, b.fontText])].map((k) => FONTS[k]).filter((f) => f.google);
  const imp = fams.length ? `@import url("https://fonts.googleapis.com/css2?${fams.map((f) => "family=" + f.google).join("&")}&display=swap");\n` : "";
  return `${imp}:root{--c-dark:${b.colors.dark};--c-light:${b.colors.light};--primary:${b.colors.primary};--accent:${b.colors.accent};${contrastVars(b.colors)}--f-display:${FONTS[b.fontTitle].stack};--f-sans:${FONTS[b.fontText].stack}}\n${styleCss(b.style)}`;
}

// Contraste automático: cor do texto sobre a cor principal e sobre a de destaque, e uma versão legível
// do destaque para texto em fundo claro (ex.: verde-limão vira verde-oliva). O painel repete esta conta na prévia.
const lum = (hex) => { const [r, g, b] = rgb01(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function contrastVars(c) {
  const dark = lum(c.dark) < 0.2 ? c.dark : "#111111";
  const on = (x) => (lum(x) > 0.4 ? dark : "#ffffff");
  const ink = (x) => (lum(x) > 0.4 ? `color-mix(in srgb,${x} 42%,${dark})` : x);
  return `--on-primary:${on(c.primary)};--on-accent:${on(c.accent)};--accent-ink:${ink(c.accent)};--primary-ink:${ink(c.primary)};`;
}

/* ---------- imagens (logos e galeria) ---------- */
const IMG = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;
export const MAX_IMG = 1_500_000; // caracteres do data URL (~1,1 MB)
export function parseImage(dataUrl) {
  const m = typeof dataUrl === "string" && dataUrl.length <= MAX_IMG && dataUrl.match(IMG);
  return m ? { type: "image/" + m[1], b64: m[2] } : null;
}
export const imageKey = (slot) => "brand/" + slot;
export async function getImage(slot) { return (await db()).get(imageKey(slot)); }
export async function putImage(slot, img) { await (await db()).set(imageKey(slot), img); }
export async function delImage(slot) { await (await db()).del(imageKey(slot)); }

// Logo para fundo claro em bytes, para o PDF do contrato (PNG ou JPEG). null quando não houver.
export async function pdfLogo() {
  try {
    if (!current.logos.claro) return null;
    const img = await getImage("logo-claro");
    return img ? { type: img.type, bytes: Uint8Array.from(Buffer.from(img.b64, "base64")) } : null;
  } catch { return null; }
}

// "#rrggbb" -> [r,g,b] de 0 a 1 (para o PDF)
export const rgb01 = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
