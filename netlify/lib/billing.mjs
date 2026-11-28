// Cobrança das contas (empresas e freelancers que usam o sistema).
// Planos: mensal e anual, com teste grátis no começo. Os preços e o teste ficam em Configurações do sistema
// (painel do dono) e valem para a página de divulgação, para a tela Plano e pagamento e para a cobrança.
//
// Estado guardado em cada empresa (companies/<id>.billing):
//   plan             "mensal" | "anual" | null      plano escolhido
//   trialEndsAt      AAAA-MM-DD                      último dia do teste grátis
//   paidUntil        AAAA-MM-DD | null               último dia já pago
//   exempt           true                            cortesia (sem cobrança), marcada pelo dono
//   canceledAt       ISO | null                      pediu para não renovar (continua até paidUntil)
//   requested        { plan, at } | null             pediu para assinar e espera a confirmação do pagamento
//   provider         "manual" | "asaas" | "stripe"   quem cobra
//   customerId, subscriptionId                       ids no provedor de pagamento (quando houver integração)
//   history          [{ at, type, plan, amount, until, note, by }]   pagamentos e mudanças (últimos 60)
//
// Provedores: "manual" funciona hoje (a conta escolhe o plano, o dono confirma o pagamento no painel).
// Asaas e Stripe ficam prontos para ligar: cada um implementa checkout() e webhook() e chama applyPayment().
import crypto from "node:crypto";
import { env } from "./store.mjs";
import { addDays, todayBR, nowISO, clean } from "./util.mjs";

export const BILLING_DEFAULTS = { trialDays: 7, monthly: 19.9, annual: 199, currency: "BRL", enforce: false };
export const PLANS = {
  mensal: { label: "Mensal", months: 1, period: "mês" },
  anual: { label: "Anual", months: 12, period: "ano" },
};
const money2 = (v, d) => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) && n > 0 ? n : d; };

// preços e regras do sistema (vêm de system.billing, com os padrões acima)
export function billingConfig(sys) {
  const b = (sys && sys.billing) || {};
  return {
    trialDays: Math.max(0, Math.min(90, Math.round(Number(b.trialDays ?? BILLING_DEFAULTS.trialDays)))),
    monthly: money2(b.monthly ?? BILLING_DEFAULTS.monthly, BILLING_DEFAULTS.monthly),
    annual: money2(b.annual ?? BILLING_DEFAULTS.annual, BILLING_DEFAULTS.annual),
    currency: "BRL",
    enforce: !!b.enforce,
    provider: activeProvider(),
  };
}
export function cleanBillingConfig(input, cur = {}) {
  const out = { ...cur };
  const n = (v) => Number(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  if ("trialDays" in input) out.trialDays = Math.max(0, Math.min(90, Math.round(Number(input.trialDays) || 0)));
  if ("monthly" in input) out.monthly = money2(n(input.monthly), BILLING_DEFAULTS.monthly);
  if ("annual" in input) out.annual = money2(n(input.annual), BILLING_DEFAULTS.annual);
  if ("enforce" in input) out.enforce = !!input.enforce;
  return out;
}
export const planPrice = (cfg, plan) => (plan === "anual" ? cfg.annual : cfg.monthly);

// estado inicial de uma conta nova: teste grátis contando o dia de hoje
export function newBilling(cfg, extra = {}) {
  return { plan: null, trialEndsAt: addDays(todayBR(), Math.max(0, cfg.trialDays - 1)), paidUntil: null, exempt: false, canceledAt: null, requested: null, provider: cfg.provider, history: [], ...extra };
}

// Situação da assinatura, calculada na hora a partir do que está guardado
//   isenta    cortesia do dono (ou conta modelo de teste)
//   teste     dentro do teste grátis
//   ativa     paga até paidUntil
//   vencida   o teste ou o período pago acabou
export function subscriptionOf(company, cfg) {
  const b = company.billing || {};
  const today = todayBR();
  // contas criadas antes da cobrança: o teste conta a partir de hoje (ninguém perde acesso de surpresa)
  const trialEndsAt = b.trialEndsAt || addDays(today, Math.max(0, cfg.trialDays - 1));
  const paidUntil = b.paidUntil || null;
  let status;
  if (company.demo || b.exempt) status = "isenta";
  else if (paidUntil && paidUntil >= today) status = "ativa";
  else if (!paidUntil && trialEndsAt >= today) status = "teste";
  else status = "vencida";
  const until = status === "ativa" ? paidUntil : status === "teste" ? trialEndsAt : null;
  const daysLeft = until ? Math.max(0, Math.round((Date.parse(until) - Date.parse(today)) / 864e5) + 1) : 0;
  return {
    status, plan: b.plan || null, trialEndsAt, paidUntil, daysLeft,
    canceled: !!b.canceledAt, canceledAt: b.canceledAt || null,
    requested: b.requested || null, provider: b.provider || cfg.provider,
    // pode usar tudo? (com a cobrança ligada, conta vencida fica só para consulta)
    allowed: status !== "vencida" || !cfg.enforce,
    prices: { mensal: cfg.monthly, anual: cfg.annual }, trialDays: cfg.trialDays, enforce: cfg.enforce,
  };
}
// grava o teste nas contas antigas na primeira vez que a situação é consultada
export function ensureBilling(company, cfg) {
  if (company.billing && company.billing.trialEndsAt) return false;
  company.billing = { ...newBilling(cfg), ...(company.billing || {}) };
  if (!company.billing.trialEndsAt) company.billing.trialEndsAt = newBilling(cfg).trialEndsAt;
  return true;
}

const pushHistory = (b, item) => { b.history = [{ at: nowISO(), ...item }, ...(b.history || [])].slice(0, 60); };

// Registra um pagamento: soma 1 mês (mensal) ou 12 meses (anual) a partir do fim do período atual (ou de hoje)
export function applyPayment(company, { plan, amount, note, by, provider, paymentId }) {
  const p = PLANS[plan] ? plan : "mensal";
  const b = (company.billing ||= {});
  if (paymentId && (b.history || []).some((h) => h.paymentId === paymentId)) return company; // aviso repetido do provedor
  const today = todayBR();
  const start = b.paidUntil && b.paidUntil >= today ? addDays(b.paidUntil, 1) : today;
  const [y, m, d] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + PLANS[p].months, d - 1)).toISOString().slice(0, 10);
  b.plan = p; b.paidUntil = end; b.requested = null; b.canceledAt = null;
  if (provider) b.provider = provider;
  pushHistory(b, { type: "pagamento", plan: p, amount: Number(amount) || 0, until: end, note: clean(note, 200), by: by || "sistema", ...(paymentId ? { paymentId: clean(paymentId, 120) } : {}) });
  return company;
}
export function requestPlan(company, plan, by) {
  const b = (company.billing ||= {});
  b.requested = { plan: PLANS[plan] ? plan : "mensal", at: nowISO() };
  b.canceledAt = null;
  pushHistory(b, { type: "pedido", plan: b.requested.plan, by: by || "conta" });
  return company;
}
export function cancelRenewal(company, by) {
  const b = (company.billing ||= {});
  b.canceledAt = nowISO(); b.requested = null;
  pushHistory(b, { type: "cancelamento", plan: b.plan, by: by || "conta" });
  return company;
}
export function setExempt(company, on, by) {
  const b = (company.billing ||= {});
  b.exempt = !!on;
  pushHistory(b, { type: on ? "cortesia" : "fim da cortesia", by: by || "dono" });
  return company;
}
export function extendTrial(company, days, by) {
  const b = (company.billing ||= {});
  const n = Math.max(1, Math.min(90, Math.round(Number(days) || 7)));
  const base = b.trialEndsAt && b.trialEndsAt >= todayBR() ? b.trialEndsAt : todayBR();
  b.trialEndsAt = addDays(base, n);
  pushHistory(b, { type: "teste estendido", note: `+${n} dias, até ${b.trialEndsAt}`, by: by || "dono" });
  return company;
}
export const billingHistory = (company) => (company.billing && company.billing.history) || [];

/* ---------- provedores de pagamento ---------- */
// Cada provedor: configured() diz se as variáveis estão no Netlify; checkout() devolve { url } para a conta pagar
// (ou { manual: true }); webhook(req) confere a origem e devolve [{ companyId, plan, amount, paymentId }] pagos.
const PROVIDERS = {
  manual: {
    label: "Confirmação manual",
    configured: () => true,
    async checkout() { return { manual: true }; },
    async webhook() { return null; },
  },
  // Asaas (Pix, boleto e cartão): ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN.
  // A fazer ao ligar: criar cliente (/v3/customers) e assinatura (/v3/subscriptions, cycle MONTHLY ou YEARLY)
  // com externalReference = id da empresa; o webhook PAYMENT_RECEIVED/PAYMENT_CONFIRMED vira applyPayment.
  asaas: {
    label: "Asaas",
    configured: () => !!(env("ASAAS_API_KEY") && env("ASAAS_WEBHOOK_TOKEN")),
    async checkout() { throw new Error("A integração com o Asaas ainda não foi ligada."); },
    async webhook(req) {
      if (!safeEq(req.headers.get("asaas-access-token") || "", env("ASAAS_WEBHOOK_TOKEN") || "")) return null;
      return []; // ler o evento e devolver os pagamentos confirmados quando a integração for ligada
    },
  },
  // Stripe (cartão): STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET.
  // A fazer ao ligar: Checkout Session em modo subscription com client_reference_id = id da empresa;
  // o webhook invoice.paid (assinatura conferida com STRIPE_WEBHOOK_SECRET) vira applyPayment.
  stripe: {
    label: "Stripe",
    configured: () => !!(env("STRIPE_SECRET_KEY") && env("STRIPE_WEBHOOK_SECRET")),
    async checkout() { throw new Error("A integração com o Stripe ainda não foi ligada."); },
    async webhook() { return null; },
  },
};
// BILLING_PROVIDER escolhe o provedor (padrão: manual). Se as variáveis dele faltarem, fica o manual.
export function activeProvider() {
  const want = String(env("BILLING_PROVIDER") || "manual").toLowerCase();
  return PROVIDERS[want] && PROVIDERS[want].configured() ? want : "manual";
}
export const provider = (name) => PROVIDERS[name] || PROVIDERS.manual;
export const providerLabel = (name) => provider(name).label;
const safeEq = (a, b) => { if (!b) return false; const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
