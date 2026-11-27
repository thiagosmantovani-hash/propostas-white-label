// Modelo de contrato de prestação de serviços (pt, es, en), genérico para qualquer tipo de serviço,
// e montagem do texto a partir do pedido do cliente. A empresa pode trocar o modelo em português pelo próprio
// contrato (Configurações). Linhas que começam com "## " viram títulos de cláusula. {{variavel}} é trocada pelos dados.
import { money, dateLongL, fmtDoc, todayBR } from "./util.mjs";

export const DEFAULT_TEMPLATE = `## {{titulo_contrato}}

Pelo presente instrumento particular, de um lado {{cliente_nome}}, inscrito(a) no CPF/CNPJ sob o nº {{cliente_documento}}{{cliente_representante_frase}}, com endereço em {{cliente_endereco}}, {{cliente_cidade}}, e-mail {{cliente_email}} e telefone {{cliente_telefone}}, doravante chamado(a) CONTRATANTE; e de outro lado {{empresa_razao}}, inscrito(a) no {{empresa_doc_tipo}} sob o nº {{empresa_cnpj}}, com sede em {{empresa_endereco}}, {{empresa_cidade}}, e-mail {{empresa_email}}, neste ato representada por {{empresa_representante}}, doravante chamada CONTRATADA, têm entre si justo e contratado o presente contrato, que se rege pelas cláusulas a seguir e pela proposta comercial nº {{proposta_numero}}, aceita pela CONTRATANTE e que faz parte deste contrato.

## Objeto
§ A CONTRATADA prestará à CONTRATANTE os serviços abaixo, no escopo descrito na proposta comercial:

{{servicos}}

§ Qualquer serviço ou entrega fora do escopo acima será considerado extra, orçado à parte e iniciado somente depois de aprovado por escrito pela CONTRATANTE.

## Valores e forma de pagamento
§ Pelos serviços, a CONTRATANTE pagará à CONTRATADA:

{{investimento}}

§ Os pagamentos serão feitos por Pix ou transferência bancária{{empresa_pix_frase}}. A CONTRATADA enviará as instruções de cada cobrança; se a CONTRATANTE não as receber até 5 (cinco) dias antes do vencimento, deverá avisar a CONTRATADA.
§ O início dos trabalhos depende da confirmação do pagamento da entrada ou da primeira parcela.
§ O atraso sujeita a CONTRATANTE a multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês sobre o valor devido. Com mais de 7 (sete) dias de atraso, a CONTRATADA poderá suspender os trabalhos até a regularização, e os prazos ficarão suspensos pelo mesmo período. Com mais de 30 (trinta) dias de atraso, a CONTRATADA poderá rescindir o contrato, aplicando-se as regras de encerramento.
{{reajuste}}

## Início, prazos e comunicação
§ Os trabalhos começam depois da assinatura deste contrato, da confirmação do pagamento inicial e do envio, pela CONTRATANTE, das informações e dos materiais solicitados.
{{prazos}}
§ Os prazos são contados em dias úteis e ficam suspensos enquanto a CONTRATADA aguardar informações, materiais, acessos, pagamentos ou aprovações da CONTRATANTE. Também serão estendidos quando a CONTRATANTE pedir trabalhos além do contratado, alterar conteúdos já enviados ou aprovados ou pedir recursos extras.
§ A comunicação oficial entre as partes será feita por e-mail ou pelo grupo de WhatsApp do projeto. Pedidos de ajuste feitos por outros meios, ou sem registro por escrito, não serão considerados.
§ Reuniões serão agendadas com antecedência, em horário comercial (segunda a sexta-feira, das 9h às 18h, exceto feriados), on-line ou presencialmente em {{empresa_cidade}}. Quando a CONTRATANTE pedir atendimento em outra cidade, as despesas de viagem serão pagas por ela.

## Execução, entregas e aprovações
§ Os serviços serão executados conforme o escopo, as etapas e os prazos descritos na proposta comercial.
§ Quando houver entregas sujeitas a aprovação, a CONTRATANTE responderá em até 3 (três) dias úteis, aprovando ou pedindo ajustes por escrito, reunidos numa única mensagem. Sem resposta nesse prazo, a CONTRATADA poderá considerar a entrega aprovada e seguir para a etapa seguinte.
§ Cada entrega inclui até 2 (duas) rodadas de ajustes dentro do escopo contratado. Mudanças de escopo, de direção ou em etapas já aprovadas serão orçadas à parte.
§ Quando o serviço for prestado em local indicado pela CONTRATANTE, ela garantirá o acesso, as condições de segurança e a estrutura necessárias.
§ Custos de terceiros necessários à execução, como materiais, deslocamentos, taxas, licenças, ferramentas ou fornecedores externos, não estão incluídos, salvo se constarem do escopo ou da proposta, e dependem de aprovação prévia da CONTRATANTE.

## Obrigações das partes
§ A CONTRATADA se obriga a executar os serviços com qualidade técnica e dentro dos prazos, a manter a CONTRATANTE informada sobre o andamento e a zelar pelos acessos, dados e informações que receber.
§ A CONTRATANTE se obriga a fornecer em tempo hábil as informações, materiais e acessos necessários, a participar das reuniões combinadas, a responder às solicitações de aprovação nos prazos deste contrato e a pagar os valores em dia.
§ A CONTRATANTE declara ter direito de uso sobre os textos, imagens, marcas e demais materiais que fornecer, e responde por eles perante terceiros.
§ Serviços feitos pela CONTRATADA por iniciativa própria, além do escopo, são mera liberalidade e não criam obrigação de continuidade.
§ Não há vínculo empregatício, subordinação ou exclusividade entre as partes e seus colaboradores. Cada parte responde por suas próprias obrigações trabalhistas, fiscais e previdenciárias.

## Propriedade intelectual e divulgação
§ Quando os serviços resultarem em materiais, documentos, projetos ou outras criações, os direitos patrimoniais sobre as versões finais aprovadas passam à CONTRATANTE depois da quitação integral dos valores, para uso por tempo indeterminado, inclusive após o fim deste contrato. Antes da quitação, o uso depende de autorização da CONTRATADA.
§ Estudos, rascunhos, arquivos de trabalho e alternativas não aprovadas, assim como a metodologia, as técnicas e o conhecimento da CONTRATADA, continuam sendo de propriedade exclusiva dela.
§ A CONTRATADA poderá citar a CONTRATANTE como cliente e mostrar os trabalhos realizados em seu portfólio, site e redes sociais, salvo pedido contrário da CONTRATANTE por escrito.
§ A CONTRATADA não se responsabiliza pelo uso que a CONTRATANTE fizer dos materiais depois da entrega, nem por alterações feitas por terceiros.

## Confidencialidade e dados pessoais
§ As partes manterão sigilo sobre as informações, estratégias, dados e documentos recebidos uma da outra durante este contrato e por 5 (cinco) anos depois do seu término, salvo obrigação legal ou informação já pública.
§ As partes tratarão os dados pessoais envolvidos somente para executar este contrato e cumprir obrigações legais, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

## Vigência e encerramento
{{vigencia}}

## Disposições gerais
§ Este contrato não pode ser cedido a terceiros sem a concordância por escrito da outra parte.
§ Alterações neste contrato só valem se feitas por escrito e aceitas pelas duas partes.
§ A tolerância de uma parte com o descumprimento da outra não significa renúncia ao direito de exigir o cumprimento.
§ Se alguma cláusula for considerada inválida, as demais continuam válidas.

## Assinatura eletrônica
§ As partes reconhecem a validade da assinatura eletrônica deste contrato, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020, e concordam que o registro de data, hora, endereço IP e código de verificação gerado pela plataforma comprova a autoria e a integridade deste documento.{{intermediador_frase}}

## Foro
§ Fica eleito o foro da comarca de {{empresa_cidade}} para resolver qualquer questão oriunda deste contrato.

{{empresa_cidade}}, {{data}}.`;

export const DEFAULT_TEMPLATE_ES = `## {{titulo_contrato}}

Por el presente instrumento privado, por una parte {{cliente_nome}}, con documento nº {{cliente_documento}}{{cliente_representante_frase}}, con domicilio en {{cliente_endereco}}, {{cliente_cidade}}, correo electrónico {{cliente_email}} y teléfono {{cliente_telefone}}, en adelante el CONTRATANTE; y por otra parte {{empresa_razao}}, inscrita en el {{empresa_doc_tipo}} (Brasil) bajo el nº {{empresa_cnpj}}, con sede en {{empresa_endereco}}, {{empresa_cidade}}, Brasil, correo electrónico {{empresa_email}}, representada en este acto por {{empresa_representante}}, en adelante la CONTRATADA, acuerdan lo siguiente, de conformidad con la propuesta comercial nº {{proposta_numero}}.

## Objeto
§ La CONTRATADA prestará al CONTRATANTE los servicios indicados a continuación, elegidos por el CONTRATANTE en la propuesta comercial:

{{servicos}}

§ Las entregas fuera de este alcance se presupuestarán por separado y solo comenzarán después de ser aprobadas por escrito por el CONTRATANTE.

## Valores y forma de pago
§ Por los servicios, el CONTRATANTE pagará a la CONTRATADA:

{{investimento}}

§ Los pagos se realizarán por transferencia bancaria internacional u otro medio acordado entre las partes. Las tasas bancarias y de cambio del envío corren por cuenta del CONTRATANTE.
§ El atraso en el pago genera una multa del 2% e intereses del 1% mensual sobre el monto adeudado. Con más de 15 días de atraso, la CONTRATADA podrá pausar las entregas hasta la regularización.

## Inicio y plazos
§ Los trabajos comienzan después de la firma de este contrato, el pago del anticipo (que asegura la agenda y garantiza los plazos) y el envío, por el CONTRATANTE, de la información y los materiales solicitados.
{{prazos}}
§ Los plazos quedan suspendidos mientras la CONTRATADA espere información, materiales, accesos o aprobaciones del CONTRATANTE.

## Ejecución, entregas y aprobaciones
§ Los servicios se ejecutarán según el alcance, las etapas y los plazos descritos en la propuesta comercial.
§ Cuando haya entregas sujetas a aprobación, el CONTRATANTE responderá en hasta 3 (tres) días hábiles, aprobando o pidiendo ajustes por escrito, reunidos en un único mensaje.
§ Cada entrega incluye hasta 2 (dos) rondas de ajustes dentro del alcance contratado. Cambios de alcance, de dirección o en etapas ya aprobadas se presupuestarán aparte.
§ Los costos de terceros necesarios para la ejecución, como materiales, traslados, tasas, licencias o proveedores externos, no están incluidos, salvo que consten en el alcance o en la propuesta.

## Obligaciones de las partes
§ La CONTRATADA ejecutará los servicios con calidad técnica, cumplirá los plazos acordados, mantendrá informado al CONTRATANTE y cuidará los accesos e información que reciba.
§ El CONTRATANTE proporcionará a tiempo la información, materiales y accesos necesarios, participará de las reuniones acordadas y garantiza tener derecho de uso sobre los materiales que proporcione.

## Propiedad intelectual y divulgación
§ Cuando los servicios generen materiales, documentos, proyectos u otras creaciones, una vez pagados íntegramente los valores, los derechos patrimoniales sobre las versiones finales aprobadas pertenecerán al CONTRATANTE. Los estudios, archivos de trabajo y alternativas no aprobadas permanecen con la CONTRATADA.
§ La CONTRATADA podrá citar al CONTRATANTE como cliente y mostrar los trabajos realizados en su portafolio, salvo solicitud contraria por escrito del CONTRATANTE.

## Confidencialidad y datos personales
§ Las partes mantendrán la confidencialidad de la información recibida de la otra y tratarán los datos personales conforme a la legislación de protección de datos aplicable.

## Vigencia y terminación
{{vigencia}}

## Firma electrónica
§ Las partes reconocen la validez de la firma electrónica de este contrato y acuerdan que el registro de fecha, hora, dirección IP y código de verificación generado por la plataforma acredita la autoría y la integridad de este documento.{{intermediador_frase}}

## Ley aplicable y jurisdicción
§ Este contrato se rige por las leyes de la República Federativa de Brasil. Para resolver cualquier cuestión derivada de él, se elige la jurisdicción de la comarca de {{empresa_cidade}}, Brasil.

{{empresa_cidade}}, {{data}}.`;

export const DEFAULT_TEMPLATE_EN = `## {{titulo_contrato}}

This private agreement is entered into by {{cliente_nome}}, document no. {{cliente_documento}}{{cliente_representante_frase}}, with address at {{cliente_endereco}}, {{cliente_cidade}}, e-mail {{cliente_email}} and phone {{cliente_telefone}}, hereinafter the CLIENT; and {{empresa_razao}}, registered in Brazil under {{empresa_doc_tipo}} no. {{empresa_cnpj}}, with offices at {{empresa_endereco}}, {{empresa_cidade}}, Brazil, e-mail {{empresa_email}}, represented by {{empresa_representante}}, hereinafter the PROVIDER, who agree as follows, in accordance with commercial proposal no. {{proposta_numero}}.

## Scope
§ The PROVIDER will provide the CLIENT with the services below, chosen by the CLIENT in the commercial proposal:

{{servicos}}

§ Deliverables outside this scope will be quoted separately and will only start after written approval by the CLIENT.

## Fees and payment
§ For the services, the CLIENT will pay the PROVIDER:

{{investimento}}

§ Payments will be made by international bank transfer or another method agreed between the parties. Bank and exchange fees for sending payments are borne by the CLIENT.
§ Late payments incur a 2% penalty plus 1% interest per month on the amount due. After 15 days of delay, the PROVIDER may pause deliveries until payment is made.

## Start and deadlines
§ Work starts after this agreement is signed, the down payment is made (securing the schedule and deadlines) and the CLIENT sends the requested information and materials.
{{prazos}}
§ Deadlines are suspended while the PROVIDER is waiting for information, materials, access or approvals from the CLIENT.

## Delivery and approvals
§ The services will be performed according to the scope, stages and deadlines described in the commercial proposal.
§ When deliverables require approval, the CLIENT will reply within 3 (three) business days, approving or requesting adjustments in writing, gathered in a single message.
§ Each deliverable includes up to 2 (two) rounds of adjustments within the contracted scope. Changes of scope, of direction or to approved stages will be quoted separately.
§ Third-party costs needed to perform the services, such as materials, travel, fees, licenses or outside suppliers, are not included unless stated in the scope or the proposal.

## Obligations
§ The PROVIDER will deliver the services with technical quality, meet the agreed deadlines, keep the CLIENT informed and safeguard any access and information it receives.
§ The CLIENT will provide the necessary information, materials and access in a timely manner, attend the agreed meetings and warrants it holds the rights to use any materials it provides.

## Intellectual property and publicity
§ When the services result in materials, documents, projects or other creations, once all fees are paid in full the economic rights to the approved final versions belong to the CLIENT. Studies, working files and unapproved alternatives remain with the PROVIDER.
§ The PROVIDER may name the CLIENT as a client and show the work in its portfolio unless the CLIENT requests otherwise in writing.

## Confidentiality and personal data
§ The parties will keep confidential the information received from each other and will handle personal data in accordance with applicable data protection law.

## Term and termination
{{vigencia}}

## Electronic signature
§ The parties recognize the validity of the electronic signature of this agreement and agree that the date, time, IP address and verification code recorded by the platform prove the authorship and integrity of this document.{{intermediador_frase}}

## Governing law and jurisdiction
§ This agreement is governed by the laws of the Federative Republic of Brazil. The courts of {{empresa_cidade}}, Brazil, shall have jurisdiction over any dispute arising from it.

{{empresa_cidade}}, {{data}}.`;

export const TEMPLATES = { pt: DEFAULT_TEMPLATE, es: DEFAULT_TEMPLATE_ES, en: DEFAULT_TEMPLATE_EN };

export const TEMPLATE_VARS = [
  ["Cliente", ["cliente_nome", "cliente_documento", "cliente_representante_frase", "cliente_endereco", "cliente_cidade", "cliente_email", "cliente_telefone"]],
  ["Empresa", ["empresa_razao", "empresa_cnpj", "empresa_doc_tipo", "empresa_endereco", "empresa_email", "empresa_representante", "empresa_cidade", "empresa_pix_frase"]],
  ["Gerados do pedido", ["titulo_contrato", "servicos", "investimento", "reajuste", "prazos", "vigencia", "intermediador_frase", "proposta_numero", "data"]],
];

const L = {
  pt: {
    title: "Contrato de prestação de serviços",
    annex: "## Anexo: dados do pedido",
    annexParties: "Contratante: {{cliente_nome}}, CPF/CNPJ {{cliente_documento}}{{cliente_representante_frase}}, {{cliente_endereco}}, {{cliente_cidade}}, e-mail {{cliente_email}}, telefone {{cliente_telefone}}.\nContratada: {{empresa_razao}}, {{empresa_doc_tipo}} {{empresa_cnpj}}, {{empresa_endereco}}, {{empresa_cidade}}, e-mail {{empresa_email}}.\nProposta comercial nº {{proposta_numero}}.",
    annexServices: "Serviços contratados:\n\n{{servicos}}", annexValues: "Valores e forma de pagamento:\n\n{{investimento}}",
    monthly: (m) => `(serviço mensal, prazo mínimo de ${m} meses)`, once: "(projeto único)", scope: "Escopo", deadline: "Prazo", note: "Observação",
    perMonth: "por mês", totalOf: "valor total de", total: "Total", onceT: "Projetos únicos", monthlyT: "Serviços mensais",
    noDeadline: "§ Os prazos de cada etapa serão combinados na reunião inicial de alinhamento e registrados por escrito.", deadlines: "§ Prazos de entrega: ",
    termOnce: (n) => `os projetos (${n}) se encerram com a entrega final aprovada e a quitação dos valores.`,
    termOnceCancel: "se a CONTRATANTE desistir de um projeto depois do início dos trabalhos, os valores já pagos não serão devolvidos e será devido o maior valor entre as etapas já executadas e 50% (cinquenta por cento) do valor total do projeto.",
    termOnceStall: "se o projeto ficar parado por mais de 45 (quarenta e cinco) dias por falta de materiais, respostas ou aprovações da CONTRATANTE, a CONTRATADA poderá dá-lo por encerrado no estágio em que estiver, sendo devidas as parcelas restantes, ou retomá-lo com novo prazo combinado entre as partes.",
    termMonthly: (n) => `os serviços mensais (${n}) vigoram pelo prazo mínimo indicado, a contar do início dos trabalhos, e se renovam automaticamente por períodos iguais, salvo aviso por escrito com 30 (trinta) dias de antecedência do fim do período.`,
    termAfter: "o encerramento dos serviços mensais deve ser comunicado por escrito com 30 (trinta) dias de antecedência. Se a CONTRATANTE encerrar antes do fim do prazo mínimo, pagará multa de 20% (vinte por cento) sobre o valor das mensalidades restantes até o fim desse prazo.",
    termAny: "qualquer parte pode rescindir este contrato, sem multa, se a outra descumprir suas obrigações e não corrigir a falha em até 10 (dez) dias depois de avisada por escrito. A CONTRATADA também poderá encerrá-lo, sem ônus, diante de conduta ilegal, discriminatória ou ofensiva da CONTRATANTE.",
    termPaid: "em qualquer encerramento, a CONTRATANTE pagará pelos serviços já executados até a data. Se a CONTRATADA ficar impossibilitada de concluir os serviços, indicará profissional qualificado para concluí-los ou devolverá os valores pagos por etapas não executadas.",
    minOf: (m) => `prazo mínimo de ${m} meses`, rep: (r) => `, representado(a) por ${r}`, pix: (p) => ` (chave Pix ${p})`,
    inter: (n, d) => `\n§ Este contrato foi intermediado por ${n}${d ? `, CPF ${d}` : ""}, consultor(a) comercial da CONTRATADA, que o assina também como testemunha.`,
  },
  es: {
    title: "Contrato de prestación de servicios", annex: "## Anexo: datos del pedido",
    annexParties: "Contratante: {{cliente_nome}}, documento {{cliente_documento}}, {{cliente_endereco}}, {{cliente_cidade}}.\nContratada: {{empresa_razao}}, {{empresa_doc_tipo}} {{empresa_cnpj}}, {{empresa_cidade}}.\nPropuesta comercial nº {{proposta_numero}}.",
    annexServices: "Servicios contratados:\n\n{{servicos}}", annexValues: "Valores y forma de pago:\n\n{{investimento}}",
    monthly: (m) => `(servicio mensual, plazo mínimo de ${m} meses)`, once: "(proyecto único)", scope: "Alcance", deadline: "Plazo", note: "Observación",
    perMonth: "por mes", totalOf: "valor total de", total: "Total", onceT: "Proyectos únicos", monthlyT: "Servicios mensuales",
    noDeadline: "§ Los plazos de cada etapa se acordarán en la reunión inicial de alineación y se registrarán por escrito.", deadlines: "§ Plazos de entrega: ",
    termOnce: (n) => `los proyectos únicos (${n}) finalizan con la entrega final y el pago total de los valores.`,
    termMonthly: (n) => `los servicios mensuales (${n}) rigen por el plazo mínimo indicado, a partir de la fecha de inicio, y se renuevan automáticamente por períodos iguales, salvo aviso en contrario.`,
    termAfter: "después del plazo mínimo, cualquiera de las partes puede finalizar los servicios mensuales con aviso por escrito de 30 días.",
    termAny: "cualquiera de las partes puede rescindir este contrato en caso de incumplimiento de la otra, mediante aviso por escrito. En cualquier terminación, el CONTRATANTE pagará los servicios ya realizados hasta la fecha.",
    minOf: (m) => `plazo mínimo de ${m} meses`, rep: (r) => `, representado(a) por ${r}`, pix: () => "",
    inter: (n, d) => `\n§ Este contrato fue intermediado por ${n}${d ? `, documento ${d}` : ""}, consultor(a) comercial de la CONTRATADA, quien también lo firma como testigo.`,
  },
  en: {
    title: "Services agreement", annex: "## Annex: order details",
    annexParties: "Client: {{cliente_nome}}, document {{cliente_documento}}, {{cliente_endereco}}, {{cliente_cidade}}.\nProvider: {{empresa_razao}}, {{empresa_doc_tipo}} {{empresa_cnpj}}, {{empresa_cidade}}.\nCommercial proposal no. {{proposta_numero}}.",
    annexServices: "Services:\n\n{{servicos}}", annexValues: "Fees and payment:\n\n{{investimento}}",
    monthly: (m) => `(monthly service, minimum term of ${m} months)`, once: "(one-time project)", scope: "Scope", deadline: "Deadline", note: "Note",
    perMonth: "per month", totalOf: "total of", total: "Total", onceT: "One-time projects", monthlyT: "Monthly services",
    noDeadline: "§ The deadlines for each stage will be agreed at the kickoff meeting and recorded in writing.", deadlines: "§ Delivery deadlines: ",
    termOnce: (n) => `one-time projects (${n}) end with the final delivery and full payment.`,
    termMonthly: (n) => `monthly services (${n}) run for the minimum term indicated from the start date and renew automatically for equal periods unless either party gives notice.`,
    termAfter: "after the minimum term, either party may end the monthly services with 30 days' written notice.",
    termAny: "either party may terminate this agreement if the other party breaches it, by written notice. In any termination, the CLIENT will pay for the services performed up to that date.",
    minOf: (m) => `minimum term of ${m} months`, rep: (r) => `, represented by ${r}`, pix: () => "",
    inter: (n, d) => `\n§ This agreement was brokered by ${n}${d ? `, ID ${d}` : ""}, a sales consultant for the PROVIDER, who also signs it as a witness.`,
  },
};
const letter = (i) => String.fromCharCode(97 + i);

export function contractVars({ settings, proposal, client, lines, totals, seller }) {
  const a = settings.agency || {};
  const lang = proposal.lang || "pt", cur = proposal.currency || "BRL";
  const T = L[lang] || L.pt;
  const services = proposal.services || [];
  const m = (v) => money(v, cur, lang);
  const servicos = lines.map((l, i) => {
    const s = services.find((x) => x.id === l.serviceId) || {};
    const scope = (s.includes || []).flatMap((g) => g.items || []);
    const parts = [`${letter(i)}) ${l.name} ${l.kind === "mensal" ? T.monthly(l.minMonths || 1) : T.once}`];
    if (scope.length) parts.push(`${T.scope}: ${scope.join("; ")}.`);
    if (s.deadline) parts.push(`${T.deadline}: ${s.deadline}.`);
    if (s.notes) parts.push(`${T.note}: ${s.notes}`);
    return parts.join("\n");
  }).join("\n\n");
  const sum = [];
  if (totals.once) sum.push(`${T.onceT}: ${m(totals.once)}`);
  if (totals.monthly) sum.push(`${T.monthlyT}: ${m(totals.monthly)} ${T.perMonth}`);
  const investimento = lines.map((l, i) => `${letter(i)}) ${l.name}: ${l.optionLabel}, ${l.kind === "mensal" ? `${m(l.total)} ${T.perMonth}` : `${T.totalOf} ${m(l.total)}`}. ${l.schedule}.`.replace(/\.\./g, ".")).join("\n") + (sum.length ? `\n\n${T.total}: ${sum.join("; ")}.` : "");
  const ds = lines.map((l) => [l.name, (services.find((x) => x.id === l.serviceId) || {}).deadline]).filter((x) => x[1]);
  const prazos = ds.length ? T.deadlines + ds.map(([n, d]) => `${n}, ${d.charAt(0).toLowerCase() + d.slice(1)}`).join("; ") + "." : T.noDeadline;
  const monthly = lines.filter((l) => l.kind === "mensal"), once = lines.filter((l) => l.kind !== "mensal");
  const term = [];
  if (once.length) { term.push(T.termOnce(once.map((l) => l.name).join(", "))); if (T.termOnceCancel) term.push(T.termOnceCancel, T.termOnceStall); }
  if (monthly.length) { term.push(T.termMonthly(monthly.map((l) => `${l.name}, ${T.minOf(l.minMonths || 1)}`).join("; "))); term.push(T.termAfter); }
  term.push(T.termAny);
  if (T.termPaid) term.push(T.termPaid);
  const vigencia = term.map((t) => `§ ${t.charAt(0).toUpperCase() + t.slice(1)}`).join("\n");
  const foreign = lang !== "pt" || (proposal.country && proposal.country !== "BR");
  return {
    titulo_contrato: T.title,
    cliente_nome: client.name,
    cliente_documento: foreign ? client.doc : fmtDoc(client.doc),
    cliente_representante_frase: client.representative ? T.rep(client.representative) : "",
    cliente_endereco: client.address,
    cliente_cidade: client.city + (foreign && client.country ? `, ${client.country}` : ""),
    cliente_email: client.email,
    cliente_telefone: client.phone,
    empresa_razao: a.legalName || a.name,
    empresa_cnpj: a.cnpj ? fmtDoc(a.cnpj) : "",
    empresa_doc_tipo: String(a.cnpj || "").replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ", // freelancer com CPF ou empresa com CNPJ
    empresa_endereco: a.address,
    empresa_email: a.email,
    empresa_representante: a.representative,
    empresa_cidade: a.city,
    empresa_pix_frase: a.pix ? T.pix(a.pix) : "",
    servicos, investimento, prazos, vigencia,
    reajuste: monthly.length && lang === "pt" ? "§ Os valores dos serviços mensais serão reajustados a cada 12 (doze) meses pelo IPCA acumulado no período." : "",
    intermediador_frase: seller ? T.inter(seller.name, seller.doc ? fmtDoc(seller.doc) : "") : "",
    proposta_numero: proposal.number,
    data: dateLongL(todayBR(), lang),
  };
}

// Contrato próprio da empresa: se o texto não tiver os campos das partes, dos serviços ou dos valores,
// eles entram num anexo no fim, para o contrato sempre trazer o que o cliente pediu.
const has = (t, k) => new RegExp("\\{\\{\\s*" + k + "\\s*\\}\\}").test(t);
export function withEssentials(tpl, lang = "pt") {
  const t = String(tpl || "").trim();
  const T = L[lang] || L.pt;
  const add = [];
  if (!has(t, "cliente_nome")) add.push(T.annexParties);
  if (!has(t, "servicos")) add.push(T.annexServices);
  if (!has(t, "investimento")) add.push(T.annexValues);
  return add.length ? `${t}\n\n${T.annex}\n\n${add.join("\n\n")}` : t;
}

// Numera cláusulas ("## ") e itens ("§ "). O primeiro título é o nome do contrato e fica sem número.
export function numberClauses(text) {
  const t = String(text || "");
  if (!/(^|\n)§ /.test(t)) return t;
  let n = 0, k = 0, first = true;
  return t.split("\n").map((line) => {
    if (line.startsWith("## ")) { if (first) { first = false; return line; } n++; k = 0; return `## ${n}. ${line.slice(3).replace(/^\d+\.\s*/, "")}`; }
    if (line.startsWith("§ ")) { k++; return `${n}.${k}. ${line.slice(2)}`; }
    return line;
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}

// Campos opcionais: se vazios, somem do texto em vez de virar pendência
const OPTIONAL = new Set(["reajuste", "cliente_representante_frase", "empresa_pix_frase", "intermediador_frase", "clausulas_especificas"]); // clausulas_especificas: textos antigos

export function fillTemplate(tpl, vars) {
  return String(tpl || DEFAULT_TEMPLATE).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => {
    k = k.replace(/^agencia_/, "empresa_"); // nome antigo dos campos da empresa
    const v = vars[k];
    if (v != null && v !== "") return String(v);
    return OPTIONAL.has(k) ? "" : `⟦${k}⟧`;
  });
}

export const missingVars = (text) => [...new Set((String(text).match(/⟦([a-z_]+)⟧/g) || []).map((m) => m.slice(1, -1)))];
