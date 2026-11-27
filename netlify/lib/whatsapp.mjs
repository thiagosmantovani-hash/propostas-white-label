// Avisos automáticos no WhatsApp via Z-API (https://z-api.io), que envia pelo número de WhatsApp conectado a ela.
// Variáveis no Netlify: ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN. Sem elas, nada é enviado.
// WA_TEST=1 registra os envios sem mandar nada (testes locais).
import { env } from "./store.mjs";
import { brand } from "./brand.mjs";

const on = () => !!(env("ZAPI_INSTANCE") && env("ZAPI_TOKEN") && env("ZAPI_CLIENT_TOKEN"));
const testOn = () => env("WA_TEST") === "1";
export const waEnabled = () => on() || testOn();
export const waLog = [];

// Número no formato internacional só com dígitos. Números brasileiros sem DDI recebem 55.
export function waNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d.length >= 11 && d.length <= 15 ? d : "";
}

export async function sendWa(phone, message) {
  const n = waNumber(phone);
  if (!waEnabled() || !n || !message) return { sent: false, reason: n ? "disabled" : "number" };
  if (!on()) { waLog.push({ to: n, message }); return { sent: true }; }
  try {
    const r = await fetch(`https://api.z-api.io/instances/${env("ZAPI_INSTANCE")}/token/${env("ZAPI_TOKEN")}/send-text`, {
      method: "POST",
      headers: { "content-type": "application/json", "client-token": env("ZAPI_CLIENT_TOKEN") },
      body: JSON.stringify({ phone: n, message }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body.error) return { sent: false, reason: "error", error: String(body.error || body.message || `HTTP ${r.status}`).slice(0, 200) };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: "error", error: String(e && e.message || e).slice(0, 200) };
  }
}

// Envia para vários números sem repetir e sem deixar um erro travar a etapa
export async function sendWaMany(phones, message) {
  const seen = new Set(), out = [];
  for (const ph of phones) {
    const n = waNumber(ph);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(await sendWa(n, message));
  }
  return out;
}

// Textos de cada etapa, no idioma da proposta
export const WA = {
  orderClient: {
    pt: (n, num, link) => `Olá, ${n}! Recebemos o seu pedido da proposta nº ${num} de {A}. Em breve enviamos o contrato para assinatura on-line.\n\nAcompanhe por aqui: ${link}`,
    es: (n, num, link) => `¡Hola, ${n}! Recibimos tu pedido de la propuesta nº ${num} de {A}. En breve te enviamos el contrato para firmar en línea.\n\nSíguelo aquí: ${link}`,
    en: (n, num, link) => `Hi ${n}! We received your order for {A}'s proposal no. ${num}. We'll send you the agreement to sign online shortly.\n\nTrack it here: ${link}`,
  },
  contractClient: {
    pt: (n, num, link) => `Olá, ${n}! O contrato nº ${num} com os serviços que você escolheu está pronto e já assinado por {A}. Falta só a sua assinatura, por aqui: ${link}`,
    es: (n, num, link) => `¡Hola, ${n}! El contrato nº ${num} con los servicios que elegiste está listo y ya firmado por {A}. Solo falta tu firma, aquí: ${link}`,
    en: (n, num, link) => `Hi ${n}! Agreement no. ${num} with the services you chose is ready and already signed by {A}. It only needs your signature, here: ${link}`,
  },
  signedClient: {
    pt: (n, num, link) => `Obrigado, ${n}! O contrato nº ${num} foi assinado por todas as partes. Baixe a sua cópia em PDF: ${link}\n\nEm breve entramos em contato para começar o projeto.`,
    es: (n, num, link) => `¡Gracias, ${n}! El contrato nº ${num} fue firmado por todas las partes. Descarga tu copia en PDF: ${link}\n\nPronto te contactamos para empezar el proyecto.`,
    en: (n, num, link) => `Thank you, ${n}! Agreement no. ${num} has been signed by all parties. Download your PDF copy: ${link}\n\nWe'll be in touch soon to get the project started.`,
  },
  proposalClient: {
    pt: (n, who, link) => `Olá${n ? ", " + n : ""}! Preparei a proposta de {A} para ${who}. Pelo link você vê os serviços, escolhe as opções e já envia o pedido: ${link}`,
    es: (n, who, link) => `¡Hola${n ? ", " + n : ""}! Preparé la propuesta de {A} para ${who}. En el enlace ves los servicios, eliges las opciones y envías tu pedido: ${link}`,
    en: (n, who, link) => `Hi${n ? " " + n : ""}! I've prepared {A}'s proposal for ${who}. At the link you can see the services, pick the options and send your order: ${link}`,
  },
};
// {A} vira o nome da empresa (Dados da empresa)
export const waText = (key, lang, ...args) => (WA[key][lang] || WA[key].pt)(...args).replaceAll("{A}", brand().name);
