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
  colors: { primary: "#3b63d9", accent: "#e07b39", dark: "#111318", light: "#f2f0ea" },
  fontTitle: "archivo",
  fontText: "alexandria",
  emailFromName: "",
  logos: { escuro: null, claro: null }, // versão da imagem salva (ou null): escuro = logo para fundo escuro, claro = para fundo claro
  portfolio: [], // [{ id, name, v }]
};

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
    name: (settings && settings.agency && settings.agency.name) || "Sua empresa",
  };
}

// Marca em uso nesta requisição, para os textos de e-mail, WhatsApp e PDF.
// Cada site publicado atende uma empresa (passo 1 do plano), então um valor por instância basta.
let current = brandOf({});
export const useBrand = (settings) => { current = brandOf(settings); return current; };
export const brand = () => current;

// CSS com as cores e fontes da empresa, carregado por todas as páginas depois de base.css
export function brandCss(settings) {
  const b = brandOf(settings);
  const fams = [...new Set([b.fontTitle, b.fontText])].map((k) => FONTS[k]).filter((f) => f.google);
  const imp = fams.length ? `@import url("https://fonts.googleapis.com/css2?${fams.map((f) => "family=" + f.google).join("&")}&display=swap");\n` : "";
  return `${imp}:root{--ink:${b.colors.dark};--cream:${b.colors.light};--primary:${b.colors.primary};--accent:${b.colors.accent};--f-display:${FONTS[b.fontTitle].stack};--f-sans:${FONTS[b.fontText].stack}}\n`;
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
