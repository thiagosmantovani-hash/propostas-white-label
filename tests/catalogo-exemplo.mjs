// Catálogo de exemplo, usado só nos testes (tests/e2e.py).
// O sistema começa com o catálogo vazio: cada empresa cadastra os próprios serviços em Serviços no painel.
// Serviços e preços abaixo são fictícios.

const ONCE = { pt: "{total} pagos no início", es: "{total} pagados al inicio", en: "{total} paid at the start" };
const INST = {
  pt: "Entrada de {entrada} + {n}x de {parcela}",
  es: "Anticipo de {entrada} + {n} cuotas de {parcela}",
  en: "Down payment of {entrada} + {n} installments of {parcela}",
};
const LBL = {
  once: { pt: "À vista", es: "Al contado", en: "Paid upfront" },
  inst: (n) => ({ pt: `Entrada + ${n} parcelas`, es: `Anticipo + ${n} cuotas`, en: `Down payment + ${n} installments` }),
};

// opções de pagamento de um serviço único: à vista (com 10% de desconto) e entrada + n parcelas
const pay = (total, n) => [
  { id: "avista", label: LBL.once.pt, total: Math.round(total * 0.9), upfront: Math.round(total * 0.9), n: 0, schedule: ONCE.pt },
  { id: "parcelado", label: LBL.inst(n).pt, total, upfront: Math.round(total / (n + 1)), n, schedule: INST.pt },
];
const payI18n = (lang, n) => [{ label: LBL.once[lang], schedule: ONCE[lang] }, { label: LBL.inst(n)[lang], schedule: INST[lang] }];

export const EXEMPLO_CATALOG = [
  {
    id: "pacote-completo", active: true, category: "Pacotes", group: "pacote", kind: "unico",
    name: "Pacote Completo",
    tagline: "Tudo o que você precisa, do começo ao fim.",
    description: "O pacote mais completo: levantamento das necessidades, planejamento, execução, ajustes e entrega final, com acompanhamento depois da entrega.",
    includes: [
      { title: "Planejamento", items: ["Reunião inicial", "Levantamento das necessidades", "Plano de trabalho"] },
      { title: "Execução e entrega", items: ["Execução do serviço", "Duas rodadas de ajustes", "Entrega final", "30 dias de acompanhamento"] },
    ],
    steps: [
      { title: "Entendimento", text: "Conversa inicial para entender o que você precisa e o que espera do resultado." },
      { title: "Execução", text: "Realização do serviço conforme o plano combinado, com ciclos de aprovação." },
      { title: "Entrega", text: "Entrega final organizada e acompanhamento nos primeiros 30 dias." },
    ],
    deadline: "Até 30 dias úteis", notes: "",
    payment: pay(6000, 2),
    i18n: {
      es: {
        name: "Paquete Completo", tagline: "Todo lo que necesitas, de principio a fin.",
        description: "El paquete más completo: relevamiento de necesidades, planificación, ejecución, ajustes y entrega final, con acompañamiento después de la entrega.",
        includes: [
          { title: "Planificación", items: ["Reunión inicial", "Relevamiento de necesidades", "Plan de trabajo"] },
          { title: "Ejecución y entrega", items: ["Ejecución del servicio", "Dos rondas de ajustes", "Entrega final", "30 días de acompañamiento"] },
        ],
        steps: [
          { title: "Entendimiento", text: "Conversación inicial para entender lo que necesitas y lo que esperas del resultado." },
          { title: "Ejecución", text: "Realización del servicio según el plan acordado, con ciclos de aprobación." },
          { title: "Entrega", text: "Entrega final organizada y acompañamiento en los primeros 30 días." },
        ],
        payment: payI18n("es", 2),
      },
      en: {
        name: "Complete Package", tagline: "Everything you need, from start to finish.",
        description: "The most complete package: needs assessment, planning, execution, revisions and final delivery, with follow-up after delivery.",
        includes: [
          { title: "Planning", items: ["Kickoff meeting", "Needs assessment", "Work plan"] },
          { title: "Execution and delivery", items: ["Service execution", "Two rounds of revisions", "Final delivery", "30 days of follow-up"] },
        ],
        steps: [
          { title: "Understanding", text: "A first conversation to understand what you need and what you expect from the result." },
          { title: "Execution", text: "We carry out the service according to the agreed plan, with approval cycles." },
          { title: "Delivery", text: "Organized final delivery and follow-up during the first 30 days." },
        ],
        payment: payI18n("en", 2),
      },
    },
  },
  {
    id: "pacote-essencial", active: true, category: "Pacotes", group: "pacote", kind: "unico",
    name: "Pacote Essencial",
    tagline: "O essencial, bem feito.",
    description: "Uma versão enxuta do serviço, com o necessário para começar: planejamento rápido, execução e entrega final.",
    includes: [{ title: "", items: ["Reunião inicial", "Execução do serviço", "Uma rodada de ajustes", "Entrega final"] }],
    steps: [
      { title: "Entendimento", text: "Conversa rápida para alinhar o que será feito." },
      { title: "Execução e entrega", text: "Realização do serviço e entrega final." },
    ],
    deadline: "Até 15 dias úteis", notes: "",
    payment: pay(3000, 1),
    i18n: {
      es: {
        name: "Paquete Esencial", tagline: "Lo esencial, bien hecho.",
        description: "Una versión compacta del servicio, con lo necesario para empezar: planificación rápida, ejecución y entrega final.",
        includes: [{ title: "", items: ["Reunión inicial", "Ejecución del servicio", "Una ronda de ajustes", "Entrega final"] }],
        steps: [
          { title: "Entendimiento", text: "Conversación rápida para alinear lo que se hará." },
          { title: "Ejecución y entrega", text: "Realización del servicio y entrega final." },
        ],
        payment: payI18n("es", 1),
      },
      en: {
        name: "Essential Package", tagline: "The essentials, done well.",
        description: "A lean version of the service with what you need to get started: quick planning, execution and final delivery.",
        includes: [{ title: "", items: ["Kickoff meeting", "Service execution", "One round of revisions", "Final delivery"] }],
        steps: [
          { title: "Understanding", text: "A quick conversation to agree on what will be done." },
          { title: "Execution and delivery", text: "We carry out the service and deliver the final result." },
        ],
        payment: payI18n("en", 1),
      },
    },
  },
  {
    id: "projeto-avulso", active: true, category: "Serviços", group: "", kind: "unico",
    name: "Projeto Avulso",
    tagline: "Um serviço pontual, com começo, meio e fim.",
    description: "Para quem precisa de uma entrega específica, sem compromisso de longo prazo.",
    includes: [{ title: "", items: ["Alinhamento do escopo", "Execução", "Entrega final"] }],
    steps: [],
    deadline: "Até 10 dias úteis", notes: "",
    payment: pay(1500, 1),
    i18n: {
      es: {
        name: "Proyecto Puntual", tagline: "Un servicio puntual, con principio, desarrollo y fin.",
        description: "Para quien necesita una entrega específica, sin compromiso a largo plazo.",
        includes: [{ title: "", items: ["Alineación del alcance", "Ejecución", "Entrega final"] }],
        payment: payI18n("es", 1),
      },
      en: {
        name: "One-off Project", tagline: "A one-off service with a clear start and finish.",
        description: "For when you need a specific deliverable without a long-term commitment.",
        includes: [{ title: "", items: ["Scope alignment", "Execution", "Final delivery"] }],
        payment: payI18n("en", 1),
      },
    },
  },
  {
    id: "acompanhamento-mensal", active: true, category: "Recorrentes", group: "", kind: "mensal", minMonths: 3,
    name: "Acompanhamento Mensal",
    tagline: "Atendimento contínuo, todo mês.",
    description: "Serviço recorrente com atendimento mensal, ajustes de rota e relatório dos resultados.",
    includes: [{ title: "", items: ["Atendimento recorrente", "Reunião mensal", "Relatório mensal"] }],
    steps: [],
    deadline: "", notes: "",
    payment: [
      { id: "integral", label: "Mensal integral", total: 1200, upfront: 1200, n: 0, schedule: "{total} por mês" },
      { id: "quinzena", label: "Mensal em 2 vezes", total: 1200, upfront: 600, n: 1, schedule: "{entrada} no início + {parcela} em 15 dias, todo mês" },
    ],
    i18n: {
      es: {
        name: "Acompañamiento Mensual", tagline: "Atención continua, todos los meses.",
        description: "Servicio recurrente con atención mensual, ajustes de rumbo e informe de resultados.",
        includes: [{ title: "", items: ["Atención recurrente", "Reunión mensual", "Informe mensual"] }],
        payment: [{ label: "Mensual completo", schedule: "{total} por mes" }, { label: "Mensual en 2 pagos", schedule: "{entrada} al inicio + {parcela} a los 15 días, cada mes" }],
      },
      en: {
        name: "Monthly Support", tagline: "Ongoing support, every month.",
        description: "A recurring service with monthly support, course corrections and a results report.",
        includes: [{ title: "", items: ["Ongoing support", "Monthly meeting", "Monthly report"] }],
        payment: [{ label: "Monthly, in full", schedule: "{total} per month" }, { label: "Monthly, in 2 payments", schedule: "{entrada} upfront + {parcela} 15 days later, every month" }],
      },
    },
  },
];
