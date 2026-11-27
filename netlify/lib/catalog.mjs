// Catálogo de serviços: começa vazio. Cada empresa cadastra os próprios serviços em Serviços no painel.
// Formas de pagamento: "schedule" é um modelo com {total}, {entrada}, {parcela} e {n}, preenchido na moeda da proposta.
// "i18n" traz os textos em espanhol (es) e inglês (en) para propostas internacionais.
import { BRAND_DEFAULTS } from "./brand.mjs";

export const DEFAULT_CATALOG = [];

// Monta o serviço no idioma da proposta (mantém valores e ids)
export function localizeService(s, lang) {
  if (!lang || lang === "pt" || !s.i18n || !s.i18n[lang]) return s;
  const t = s.i18n[lang];
  const out = { ...s };
  for (const k of ["name", "tagline", "description", "includes", "steps", "deadline", "notes"]) if (t[k] != null) out[k] = t[k];
  if (s.anchor && t.anchor) out.anchor = { title: t.anchor.title, rows: s.anchor.rows.map((r, i) => [(t.anchor.rows[i] || [])[0] || r[0], r[1]]) };
  if (Array.isArray(t.payment)) out.payment = s.payment.map((o, i) => ({ ...o, ...(t.payment[i] || {}) }));
  return out;
}

export const COUNTRIES = [
  ["BR", "Brasil", "pt", "BRL"],
  ["PY", "Paraguai", "es", "USD"],
  ["AR", "Argentina", "es", "USD"],
  ["UY", "Uruguai", "es", "USD"],
  ["CL", "Chile", "es", "USD"],
  ["US", "Estados Unidos", "en", "USD"],
  ["XX", "Outro país", "en", "USD"],
];
export const CURRENCIES = [["BRL", "Real (R$)"], ["USD", "Dólar (US$)"], ["PYG", "Guarani (₲)"], ["ARS", "Peso argentino ($)"]];

export const DEFAULT_SETTINGS = {
  // Dados da empresa (tela "Dados da empresa" no painel). O nome interno "agency" foi mantido para não perder dados já salvos.
  agency: {
    name: "Sua empresa",
    legalName: "",
    cnpj: "",
    address: "",
    city: "",
    email: "",
    representative: "",
    representativeDoc: "",
    pix: "",
  },
  brand: BRAND_DEFAULTS,
  whatsapp: "",
  instagram: "",
  site: "",
  validityDays: 15,
  openLink: false,
  sellersUseAgencySignature: true,
  waClient: true,
  waAgency: true,
  agencySignature: null, // desenhada em Dados da empresa
  contractTemplate: null, // null = modelo padrão
  intro:
    "Cada cliente tem necessidades e desafios próprios. Por isso, preparamos esta proposta sob medida, com os serviços e as condições que fazem sentido para o seu momento.",
  nextSteps: [
    { title: "Confirmação", text: "Você escolhe os serviços e envia o pedido por esta página." },
    { title: "Contrato", text: "Preparamos o contrato com o que você escolheu e enviamos o link para assinatura on-line." },
    { title: "Alinhamento", text: "Após a assinatura, reunimos as informações de que precisamos para começar." },
    { title: "Início", text: "Agendamos a reunião inicial de alinhamento. O pagamento da entrada assegura a agenda e garante os prazos de entrega." },
  ],
};

// Textos da empresa nos outros idiomas (a versão em português é editável no painel)
export const AGENCY_I18N = {
  es: {
    intro: "Cada cliente tiene necesidades y desafíos propios. Por eso, preparamos esta propuesta a la medida, con los servicios y las condiciones que tienen sentido para tu momento.",
    nextSteps: [
      { title: "Confirmación", text: "Eliges los servicios y envías el pedido por esta página." },
      { title: "Contrato", text: "Preparamos el contrato con lo que elegiste y te enviamos el enlace para firmarlo en línea." },
      { title: "Alineación", text: "Después de la firma, reunimos la información que necesitamos para empezar." },
      { title: "Inicio", text: "Agendamos la reunión inicial de alineación. El pago del anticipo asegura la agenda y garantiza los plazos de entrega." },
    ],
  },
  en: {
    intro: "Every client has its own needs and challenges. That's why we tailored this proposal to you, with the services and terms that make sense right now.",
    nextSteps: [
      { title: "Confirmation", text: "You choose the services and send your order through this page." },
      { title: "Contract", text: "We prepare the contract with what you chose and send you a link to sign it online." },
      { title: "Alignment", text: "After signing, we gather the information we need to get started." },
      { title: "Kickoff", text: "We schedule the kickoff meeting. The down payment secures the schedule and the delivery dates." },
    ],
  },
};
