// Gera o PDF de exemplo do modelo de contrato do sistema (docs/modelos-de-contrato/), com dados fictícios.
// Uso: node tests/gerar-modelos-pdf.mjs
import fs from "fs";
import { TEMPLATES, contractVars, fillTemplate, numberClauses, withEssentials } from "../netlify/lib/contract.mjs";
import { DEFAULT_SETTINGS } from "../netlify/lib/catalog.mjs";
import { computeTotals } from "../netlify/lib/util.mjs";
import { contractPdf } from "../netlify/lib/pdf.mjs";
import { useBrand } from "../netlify/lib/brand.mjs";

const services = [
  { id: "projeto", name: "Projeto sob medida", category: "Serviços", kind: "unico", deadline: "Até 30 dias úteis", includes: [{ title: "", items: ["Levantamento das necessidades", "Execução do serviço", "Entrega final"] }], payment: [{ id: "a", label: "Parcelado", total: 6000, upfront: 2000, n: 2, schedule: "Entrada de {entrada} + {n}x de {parcela}" }] },
  { id: "mensal", name: "Acompanhamento mensal", category: "Serviços", kind: "mensal", minMonths: 3, includes: [{ title: "", items: ["Atendimento recorrente", "Relatório mensal"] }], payment: [{ id: "a", label: "Mensal", total: 1500, upfront: 1500, n: 0, schedule: "{total} por mês" }] },
];
const client = { name: "Cliente Exemplo Ltda", doc: "11222333000181", representative: "Maria Exemplo", address: "Rua Exemplo, 100, Centro", city: "São Paulo - SP", email: "cliente@exemplo.com", phone: "(11) 99999-0000" };
// dados fictícios da empresa, só para o PDF de exemplo
const settings = { ...DEFAULT_SETTINGS, agency: { ...DEFAULT_SETTINGS.agency, name: "Sua Empresa", legalName: "Sua Empresa Ltda", cnpj: "11222333000181", address: "Rua Exemplo, 200, Centro, CEP 01001-000", city: "São Paulo - SP", email: "contato@suaempresa.com.br", representative: "Nome do Representante" } };
useBrand(settings);

const p = { number: "MODELO", services, lang: "pt", currency: "BRL", country: "BR" };
const totals = computeTotals(services, services.map((s) => ({ serviceId: s.id, optionId: s.payment[0].id })), "BRL", "pt");
const text = numberClauses(fillTemplate(withEssentials(TEMPLATES.pt, "pt"), contractVars({ settings, proposal: p, client, lines: totals.lines, totals, seller: null })));
const c = { id: "modelo", number: "MODELO", lang: "pt", currency: "BRL", status: "rascunho", client, lines: totals.lines, totals, agencyName: settings.agency.legalName, signatures: {}, text, hash: "" };
fs.mkdirSync("docs/modelos-de-contrato", { recursive: true });
fs.writeFileSync("docs/modelos-de-contrato/contrato-de-prestacao-de-servicos.pdf", await contractPdf(c));
console.log("docs/modelos-de-contrato/contrato-de-prestacao-de-servicos.pdf");
