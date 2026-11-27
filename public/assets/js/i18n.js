/* Textos das páginas do cliente em português, espanhol e inglês */
(function () {
  "use strict";
  const D = {
    pt: {
      menu: "Menu", talk_wa: "Falar no WhatsApp",       home: "início", foot_talk: "Fale com a gente", foot_rights: "Todos os direitos reservados.", foot_top: "Voltar ao topo",
      countries: { BR: "Brasil", PY: "Paraguai", AR: "Argentina", UY: "Uruguai", CL: "Chile", US: "Estados Unidos", XX: "" },
      loading_prop: "Carregando a sua proposta…", prop_nf: "Proposta não encontrada", prop_nf_p: "O link pode estar incompleto ou a proposta foi removida. Fale com a gente para receber um novo link.", cant_open: "Não foi possível abrir", wa_cant_prop: "Olá! Tentei abrir a minha proposta e não consegui.",
      nav_prop: "A proposta", nav_svc: "Serviços", nav_steps: "Etapas", nav_order: "Meu pedido",
      hero_label: "Proposta comercial", hero_blur: "Uma proposta feita sob medida para o seu", hero_sharp: "negócio",
      prepared: "Preparada para {w}.", open_sub: "Escolha os serviços que fazem sentido para você, veja os valores na hora e envie o seu pedido.",
      cta_build: "Montar meu pedido", cta_view: "Ver o meu pedido", cta_doubt: "Tirar dúvidas no WhatsApp",
      wa_doubt: "Olá! Estou vendo a proposta de {a} e tenho uma dúvida.", wa_doubt_open: "Olá! Estou vendo a proposta on-line e tenho uma dúvida.",
      welcome: "Seja bem-vindo. Preparamos esta proposta pensando no que o seu negócio precisa agora.",
      who: "Trabalho feito com qualidade, atenção a cada detalhe e foco total nos objetivos do seu negócio.",
      team: "Pode ter a certeza de que vamos trabalhar com <strong>foco total nos objetivos do seu negócio.</strong>",
      principles_aria: "Como trabalhamos",
      principles: ["Ouvir antes de propor.", "Planejar antes de executar.", "Cumprir o combinado.", "Acompanhar de perto."],
      fixed_label_n: "Os serviços desta proposta", fixed_label_1: "O serviço desta proposta", fixed_hint: "Escolha a forma de pagamento de cada um", fixed_hint_1: "Escolha a forma de pagamento", note_fixed: "Selecionamos os serviços certos para o momento do seu negócio. Você só escolhe a forma de pagamento de cada um: os valores se atualizam na hora e você confirma o pedido no fim da página.", off_h: "Proposta indisponível", off_talk: "Pedir uma proposta atualizada", wa_off: "Olá! Recebi a proposta de {a} e gostaria de uma versão atualizada.", pick_label: "Sua proposta", pick_h: "A melhor escolha <em>para você</em>",
      note_default: "Escolha os serviços que fazem sentido agora e a forma de pagamento de cada um. Os valores se atualizam na hora e você envia o pedido no fim da página.",
      note_contract: "Este é o seu pedido, que já virou contrato. Qualquer ajuste, fale com a gente.", note_order: "Este é o pedido que você enviou. Se quiser mudar algo antes do contrato, use “Alterar pedido” no fim da página.",
      note_declined: "Você nos avisou que não é o momento. Se mudar de ideia, é só reabrir o pedido no fim da página.", note_expired: "Esta proposta era válida até {d}. Fale com a gente para atualizar os valores.",
      choose_one: "Escolha uma das opções", add_also: "Adicione também", services: "Serviços", service: "Serviço", add_many: "Inclua quantos fizerem sentido",
      monthly: "mensal", once: "projeto único", recommended: "Recomendado", deadline: "Prazo: {d}", min_contract: "Contrato mínimo de {m} meses", included: "O que está incluso",
      investment: "Investimento", per_month: "/mês", pay_method: "Escolha sua forma de pagamento", save: "economize {v} ({p}%)",
      b_chosen: "Opção escolhida", b_in: "Incluído no pedido", b_choose: "Escolher esta opção", b_add: "Incluir no pedido", t_added: "{s} incluído no pedido.",
      anchor_h: "Um time inteiro pelo valor de <em>um profissional</em>", anchor_p: "{t}, com alta performance, o investimento mensal seria este.", anchor_p2: "Para ter a mesma estrutura contratando um profissional para cada função, o custo mensal da sua empresa seria este:", anchor_them: "Contratando a equipe", anchor_them_s: "{n} profissionais", anchor_us: "Com {a}", anchor_us_s: "o time inteiro", anchor_save: "Você economiza", anchor_save_v: "{v} por mês", anchor_save_s: "{p}% a menos · {y} em 12 meses", anchor_team_h: "Quem você teria de contratar", anchor_fine: "Valores mensais de referência por profissional, ainda sem encargos trabalhistas, férias, 13º salário, benefícios e equipamentos.", anchor_team: "Equipe contratada", anchor_you: "Seu investimento",
      steps_label: "Etapas", steps_h: "Como vai <em>funcionar</em>", steps_p: "O passo a passo dos serviços escolhidos, do pedido até a entrega. Tudo combinado com você em cada etapa.", after_order: "Depois do pedido",
      pf_label: "Portfólio", pf_h: "Trabalhos que já <em>realizamos</em>", pf_p: "Alguns trabalhos de {a}.",
      thanks: "Agradecemos pelo seu tempo e esperamos que, <em>juntos</em>, possamos conquistar seus objetivos.", thanks_aria: "Agradecimento",
      valid_until: "Válida até {d}", expired_on: "Venceu em {d}", chip_signed: "Contrato assinado", chip_wait: "Contrato aguardando sua assinatura", chip_order: "Pedido enviado", chip_preview: "Pré-visualização da empresa", chip_consultant: "Consultor: {n}",
      once_1: "Projeto único", once_n: "Projetos únicos", monthly_t: "Mensal", min_months: "Contrato mínimo de {m} meses", savings: "Economia no pagamento à vista", to_start: "Para começar", to_start_s: "Entrada e primeiros pagamentos", min_of: "mínimo de {m} meses",
      sum_empty: "Nenhum serviço escolhido ainda. <a href=\"#servicos\">Escolha acima</a> e o resumo aparece aqui.",
      tr1: "Pedido enviado", tr2: "Contrato preparado", tr3: "Assinatura", tr4: "Início do projeto", tr_done: "Concluído", tr_now: "Agora", tr_next: "Em seguida", tr_aria: "Andamento",
      your_order: "Seu pedido", h_received: "Pedido<br>recebido", h_review: "Revise e<br>envie", lead_received: "Acompanhe abaixo cada etapa até o início do projeto.", lead_review: "Confira os serviços e as formas de pagamento escolhidas. Depois, preencha os dados para o contrato.",
      fine_valid: "Valores válidos até {d}. ", fine: "Ao enviar o pedido, preparamos o contrato com estes serviços e enviamos o link para assinatura on-line.",
      signed_h: "Contrato assinado", signed_p: "Tudo certo! O contrato está assinado pelas partes. Em breve entraremos em contato com os próximos passos.", see_contract: "Ver contrato e baixar cópia",
      ready_h: "Seu contrato está pronto", ready_p: "Preparamos o contrato com os serviços que você escolheu. Ele já está assinado por {a}. Falta só a sua assinatura, que leva menos de um minuto.", read_sign: "Ler e assinar o contrato",
      thanks_h: "Obrigado{n}!", thanks_p: "Recebemos o seu pedido em {d}. Agora vamos preparar o contrato com os serviços escolhidos e enviar o link para assinatura.", notify_wa: "Avisar no WhatsApp", wa_ordered: "Olá! Acabei de enviar o meu pedido pela proposta de {a}.", edit_order: "Alterar pedido",
      declined_h: "Obrigado pelo retorno", declined_p: "Recebemos o seu aviso. Se mudar de ideia ou quiser ajustar algo na proposta, estamos por aqui.", review_again: "Quero rever a proposta", wa_talk: "Olá! Quero conversar sobre a proposta de {a}.",
      expired_h: "Proposta vencida", expired_p: "Esta proposta era válida até {d}. Fale com a gente e enviamos uma versão atualizada.", ask_update: "Pedir atualização", wa_expired: "Olá! A proposta de {a} venceu. Podem me enviar uma atualizada?",
      form_note: "Dados para o contrato. Campos com * são obrigatórios.", form_note_x: "Dados para o contrato ({c}). Campos com * são obrigatórios.",
      f_name: "Nome completo ou razão social *", f_doc: "CPF ou CNPJ *", f_doc_x: "Documento (RUC, CUIT, CI, EIN ou outro) *", f_rep: "Responsável (se for empresa)", f_email: "E-mail *", f_phone: "WhatsApp *", f_phone_x: "WhatsApp com código do país *",
      f_cep: "CEP *", cep_hint: "Digite o CEP e o endereço aparece sozinho", cep_loading: "Buscando o endereço…", cep_nf: "CEP não encontrado. Preencha o endereço abaixo.", cep_ok: "Endereço encontrado. Confira e complete.",
      f_street: "Rua / logradouro *", f_number: "Número *", f_compl: "Complemento", f_district: "Bairro *", f_city: "Cidade e estado *", city_hint: "Comece a digitar e escolha na lista", city_none: "Nenhuma cidade encontrada",
      f_address_x: "Endereço (rua, número e complemento) *", f_postal_x: "Código postal", f_city_x: "Cidade e estado/província *",
      f_notes: "Observações", notes_ph: "Algo que devemos saber antes de preparar o contrato?", accept: "Li e estou de acordo com os serviços, valores e condições desta proposta.",
      send: "Enviar pedido", update: "Atualizar pedido", sending: "Enviando…", cancel_edit: "Cancelar alteração", decline: "Não é o momento? Conte para nós", decline_l: "Se puder, conte o motivo. Isso nos ajuda a melhorar.", decline_send: "Enviar resposta",
      e_name: "Informe o nome completo ou a razão social.", e_doc: "CPF ou CNPJ inválido.", e_doc_x: "Informe o documento.", e_rep: "Informe quem responde pela empresa.", e_email: "Informe um e-mail válido.", e_phone: "Informe o WhatsApp com DDD.", e_phone_x: "Informe o telefone com o código do país.",
      e_cep: "Informe um CEP válido.", e_street: "Informe a rua.", e_number: "Informe o número (ou s/n).", e_district: "Informe o bairro.", e_city: "Informe a cidade e o estado.", e_city_list: "Escolha uma cidade da lista.", e_address: "Informe o endereço completo.",
      m_pick: "Escolha pelo menos um serviço acima.", m_accept: "Marque que está de acordo com as condições para enviar.",
      t_edit: "Ajuste os serviços e envie de novo no fim da página.", t_prev_decline: "Na pré-visualização, as respostas do cliente não são enviadas.", t_prev_order: "Pré-visualização: o pedido do cliente não é enviado daqui.",
      d_service: "serviço", d_services: "serviços", d_once: "Projeto único", d_monthly: "Mensal", d_start: "Para começar", d_review: "Revisar pedido",
      // contrato
      loading_c: "Carregando o contrato…", c_nf: "Contrato não encontrado", c_nf_p: "O link pode estar incompleto ou o contrato foi substituído. Fale com a gente para receber o link certo.", wa_cant_c: "Olá! Não consegui abrir o link do meu contrato.",
      c_cancel_h: "Contrato cancelado", c_cancel_p: "Este contrato foi substituído ou cancelado por {a}. Se você recebeu um novo link, use o mais recente.", wa_c_cancel: "Olá! O contrato nº {n} aparece como cancelado.",
      nav_contract: "Contrato", nav_sign: "Assinar", nav_copy: "Baixar cópia", c_label: "Contrato nº {n}",
      c_blur_ok: "Contrato", c_sharp_ok: "assinado", c_blur_wait: "Falta só a sua", c_sharp_wait: "assinatura",
      c_sub_ok: "<b>Obrigado, {n}.</b> O contrato está assinado pelas partes e a sua cópia está disponível abaixo.", c_sub_wait: "<b>Olá, {n}.</b> Leia o contrato com os serviços que você escolheu. Ele já está assinado por {a}.",
      c_chip_ok: "Assinado pelas partes", c_chip_wait: "Aguardando a sua assinatura", c_chip_sent: "Enviado em {d}",
      c_dl: "Baixar cópia em PDF", c_read: "Ler o contrato", c_go: "Ir para a assinatura",
      r_agency: "Contratada", r_client: "Contratante", r_inter: "Intermediador e testemunha", w_yours: "Aguardando a sua assinatura", w_sig: "Aguardando assinatura", signed_at: "Assinado eletronicamente em {d}", sig_of: "Assinatura de {n}",
      verify: "Código de verificação:", view_pdf: "Ver em PDF",
      s_eyebrow: "Assinatura eletrônica", s_h: "Assine<br>on-line", s_lead: "Confira os seus dados, desenhe a sua assinatura e confirme. Leva menos de um minuto e você recebe a cópia em PDF na hora.",
      s_legal: "A assinatura eletrônica tem validade entre as partes (MP nº 2.200-2/2001, art. 10, § 2º, e Lei nº 14.063/2020). Registramos data, hora, endereço IP e o código de verificação do texto que você leu.",
      f_signer: "Nome completo de quem assina *", f_sdoc: "CPF de quem assina *", sdoc_hint: "Ou o CNPJ, se assinar em nome da empresa", f_sdoc_x: "Documento de quem assina *", sdoc_hint_x: "CI, DNI, passaporte ou outro", f_copy: "E-mail para a cópia *",
      your_sig: "Sua assinatura *", clear: "Limpar", pad_ph: "Desenhe a sua assinatura aqui", s_accept: "Li o contrato na íntegra e concordo com todos os termos. Entendo que esta assinatura eletrônica tem a mesma validade da assinatura em papel.",
      sign: "Assinar contrato", signing: "Assinando…", s_doubt: "Tenho uma dúvida antes de assinar", wa_c_doubt: "Olá! Tenho uma dúvida sobre o contrato nº {n}.",
      ok_eyebrow: "Tudo certo", ok_h: "Contrato<br>assinado", ok_mailed: "Enviamos a sua cópia para <b>{e}</b>. ", ok_lead: "Guarde a cópia em PDF: ela traz as assinaturas e o registro com data, hora e código de verificação.", next_h: "Próximos passos", next_default: "Em breve entraremos em contato para iniciar o projeto.", wa_signed: "Olá! Assinei o contrato nº {n}.",
      e_full: "Informe o nome completo.", e_pad: "Desenhe a sua assinatura no quadro.", m_accept_c: "Marque que leu e concorda com o contrato para assinar.", t_signed: "Contrato assinado. Obrigado!", c_foot_r: "{a}",
    },
    es: {
      menu: "Menú", talk_wa: "Hablar por WhatsApp", 
      home: "inicio", foot_talk: "Hablemos", foot_rights: "Todos los derechos reservados.", foot_top: "Volver arriba",
      countries: { BR: "Brasil", PY: "Paraguay", AR: "Argentina", UY: "Uruguay", CL: "Chile", US: "Estados Unidos", XX: "" },
      loading_prop: "Cargando tu propuesta…", prop_nf: "Propuesta no encontrada", prop_nf_p: "El enlace puede estar incompleto o la propuesta fue eliminada. Escríbenos para recibir un nuevo enlace.", cant_open: "No se pudo abrir", wa_cant_prop: "¡Hola! Intenté abrir mi propuesta y no pude.",
      nav_prop: "La propuesta", nav_svc: "Servicios", nav_steps: "Etapas", nav_order: "Mi pedido",
      hero_label: "Propuesta comercial", hero_blur: "Una propuesta hecha a la medida de tu", hero_sharp: "negocio",
      prepared: "Preparada para {w}.", open_sub: "Elige los servicios que tienen sentido para ti, mira los valores al instante y envía tu pedido.",
      cta_build: "Armar mi pedido", cta_view: "Ver mi pedido", cta_doubt: "Consultas por WhatsApp",
      wa_doubt: "¡Hola! Estoy viendo la propuesta de {a} y tengo una consulta.", wa_doubt_open: "¡Hola! Estoy viendo la propuesta en línea y tengo una consulta.",
      welcome: "Bienvenido. Preparamos esta propuesta pensando en lo que tu negocio necesita ahora.",
      who: "Trabajo hecho con calidad, atención a cada detalle y foco total en los objetivos de tu negocio.",
      team: "Puedes tener la certeza de que trabajaremos con <strong>foco total en los objetivos de tu negocio.</strong>",
      principles_aria: "Cómo trabajamos",
      principles: ["Escuchar antes de proponer.", "Planificar antes de ejecutar.", "Cumplir lo acordado.", "Acompañar de cerca."],
      fixed_label_n: "Los servicios de esta propuesta", fixed_label_1: "El servicio de esta propuesta", fixed_hint: "Elige la forma de pago de cada uno", fixed_hint_1: "Elige la forma de pago", note_fixed: "Seleccionamos los servicios adecuados para el momento de tu negocio. Solo eliges la forma de pago de cada uno: los valores se actualizan al instante y confirmas el pedido al final de la página.", off_h: "Propuesta no disponible", off_talk: "Pedir una propuesta actualizada", wa_off: "¡Hola! Recibí la propuesta de {a} y me gustaría una versión actualizada.", pick_label: "Tu propuesta", pick_h: "La mejor elección <em>para ti</em>",
      note_default: "Elige los servicios que tienen sentido ahora y la forma de pago de cada uno. Los valores se actualizan al instante y envías el pedido al final de la página.",
      note_contract: "Este es tu pedido, que ya se convirtió en contrato. Para cualquier ajuste, escríbenos.", note_order: "Este es el pedido que enviaste. Si quieres cambiar algo antes del contrato, usa “Modificar pedido” al final de la página.",
      note_declined: "Nos avisaste que no es el momento. Si cambias de idea, puedes reabrir el pedido al final de la página.", note_expired: "Esta propuesta era válida hasta el {d}. Escríbenos para actualizar los valores.",
      choose_one: "Elige una de las opciones", add_also: "Agrega también", services: "Servicios", service: "Servicio", add_many: "Incluye todos los que tengan sentido",
      monthly: "mensual", once: "proyecto único", recommended: "Recomendado", deadline: "Plazo: {d}", min_contract: "Contrato mínimo de {m} meses", included: "Qué incluye",
      investment: "Inversión", per_month: "/mes", pay_method: "Elige tu forma de pago", save: "ahorra {v} ({p}%)",
      b_chosen: "Opción elegida", b_in: "Incluido en el pedido", b_choose: "Elegir esta opción", b_add: "Incluir en el pedido", t_added: "{s} incluido en el pedido.",
      anchor_h: "Un equipo completo por el valor de <em>un profesional</em>", anchor_p: "{t}, con alto rendimiento, la inversión mensual sería esta.", anchor_p2: "Para tener la misma estructura contratando un profesional para cada función, el costo mensual de tu empresa sería este:", anchor_them: "Contratando el equipo", anchor_them_s: "{n} profesionales", anchor_us: "Con {a}", anchor_us_s: "el equipo completo", anchor_save: "Ahorras", anchor_save_v: "{v} por mes", anchor_save_s: "{p}% menos · {y} en 12 meses", anchor_team_h: "A quién tendrías que contratar", anchor_fine: "Valores mensuales de referencia por profesional, sin contar cargas laborales, vacaciones, aguinaldo, beneficios y equipos.", anchor_team: "Equipo contratado", anchor_you: "Tu inversión",
      steps_label: "Etapas", steps_h: "Cómo va a <em>funcionar</em>", steps_p: "El paso a paso de los servicios elegidos, del pedido a la entrega. Todo acordado contigo en cada etapa.", after_order: "Después del pedido",
      pf_label: "Portafolio", pf_h: "Trabajos que ya <em>realizamos</em>", pf_p: "Algunos trabajos de {a}.",
      thanks: "Gracias por tu tiempo. Esperamos que, <em>juntos</em>, podamos alcanzar tus objetivos.", thanks_aria: "Agradecimiento",
      valid_until: "Válida hasta el {d}", expired_on: "Venció el {d}", chip_signed: "Contrato firmado", chip_wait: "Contrato pendiente de tu firma", chip_order: "Pedido enviado", chip_preview: "Vista previa de la empresa", chip_consultant: "Consultor: {n}",
      once_1: "Proyecto único", once_n: "Proyectos únicos", monthly_t: "Mensual", min_months: "Contrato mínimo de {m} meses", savings: "Ahorro por pago al contado", to_start: "Para empezar", to_start_s: "Anticipo y primeros pagos", min_of: "mínimo de {m} meses",
      sum_empty: "Todavía no elegiste ningún servicio. <a href=\"#servicos\">Elige arriba</a> y el resumen aparecerá aquí.",
      tr1: "Pedido enviado", tr2: "Contrato preparado", tr3: "Firma", tr4: "Inicio del proyecto", tr_done: "Listo", tr_now: "Ahora", tr_next: "Después", tr_aria: "Avance",
      your_order: "Tu pedido", h_received: "Pedido<br>recibido", h_review: "Revisa y<br>envía", lead_received: "Sigue aquí cada etapa hasta el inicio del proyecto.", lead_review: "Revisa los servicios y las formas de pago elegidas. Después, completa los datos para el contrato.",
      fine_valid: "Valores válidos hasta el {d}. ", fine: "Al enviar el pedido, preparamos el contrato con estos servicios y te enviamos el enlace para firmarlo en línea.",
      signed_h: "Contrato firmado", signed_p: "¡Todo listo! El contrato está firmado por las partes. Pronto nos pondremos en contacto con los próximos pasos.", see_contract: "Ver contrato y descargar copia",
      ready_h: "Tu contrato está listo", ready_p: "Preparamos el contrato con los servicios que elegiste. Ya está firmado por {a}. Solo falta tu firma, que toma menos de un minuto.", read_sign: "Leer y firmar el contrato",
      thanks_h: "¡Gracias{n}!", thanks_p: "Recibimos tu pedido el {d}. Ahora vamos a preparar el contrato con los servicios elegidos y te enviaremos el enlace para firmarlo.", notify_wa: "Avisar por WhatsApp", wa_ordered: "¡Hola! Acabo de enviar mi pedido por la propuesta de {a}.", edit_order: "Modificar pedido",
      declined_h: "Gracias por tu respuesta", declined_p: "Recibimos tu aviso. Si cambias de idea o quieres ajustar algo de la propuesta, aquí estamos.", review_again: "Quiero revisar la propuesta", wa_talk: "¡Hola! Quiero conversar sobre la propuesta de {a}.",
      expired_h: "Propuesta vencida", expired_p: "Esta propuesta era válida hasta el {d}. Escríbenos y te enviamos una versión actualizada.", ask_update: "Pedir actualización", wa_expired: "¡Hola! La propuesta de {a} venció. ¿Me pueden enviar una actualizada?",
      form_note: "Datos para el contrato. Los campos con * son obligatorios.", form_note_x: "Datos para el contrato ({c}). Los campos con * son obligatorios.",
      f_name: "Nombre completo o razón social *", f_doc: "CPF o CNPJ *", f_doc_x: "Documento (RUC, CUIT, CI, DNI u otro) *", f_rep: "Responsable (si es empresa)", f_email: "Correo electrónico *", f_phone: "WhatsApp *", f_phone_x: "WhatsApp con código de país *",
      f_cep: "CEP *", cep_hint: "Escribe el CEP y la dirección aparece sola", cep_loading: "Buscando la dirección…", cep_nf: "CEP no encontrado. Completa la dirección abajo.", cep_ok: "Dirección encontrada. Revisa y completa.",
      f_street: "Calle *", f_number: "Número *", f_compl: "Complemento", f_district: "Barrio *", f_city: "Ciudad y estado *", city_hint: "Empieza a escribir y elige de la lista", city_none: "No se encontró la ciudad",
      f_address_x: "Dirección (calle, número y complemento) *", f_postal_x: "Código postal", f_city_x: "Ciudad y departamento/provincia *",
      f_notes: "Observaciones", notes_ph: "¿Algo que debamos saber antes de preparar el contrato?", accept: "Leí y estoy de acuerdo con los servicios, valores y condiciones de esta propuesta.",
      send: "Enviar pedido", update: "Actualizar pedido", sending: "Enviando…", cancel_edit: "Cancelar cambios", decline: "¿No es el momento? Cuéntanos", decline_l: "Si puedes, cuéntanos el motivo. Nos ayuda a mejorar.", decline_send: "Enviar respuesta",
      e_name: "Indica el nombre completo o la razón social.", e_doc: "CPF o CNPJ inválido.", e_doc_x: "Indica el documento.", e_rep: "Indica quién responde por la empresa.", e_email: "Indica un correo válido.", e_phone: "Indica el WhatsApp con código de área.", e_phone_x: "Indica el teléfono con código de país.",
      e_cep: "Indica un CEP válido.", e_street: "Indica la calle.", e_number: "Indica el número (o s/n).", e_district: "Indica el barrio.", e_city: "Indica la ciudad.", e_city_list: "Elige una ciudad de la lista.", e_address: "Indica la dirección completa.",
      m_pick: "Elige al menos un servicio arriba.", m_accept: "Marca que estás de acuerdo con las condiciones para enviar.",
      t_edit: "Ajusta los servicios y envía de nuevo al final de la página.", t_prev_decline: "En la vista previa no se envían respuestas del cliente.", t_prev_order: "Vista previa: el pedido del cliente no se envía desde aquí.",
      d_service: "servicio", d_services: "servicios", d_once: "Proyecto único", d_monthly: "Mensual", d_start: "Para empezar", d_review: "Revisar pedido",
      loading_c: "Cargando el contrato…", c_nf: "Contrato no encontrado", c_nf_p: "El enlace puede estar incompleto o el contrato fue reemplazado. Escríbenos para recibir el enlace correcto.", wa_cant_c: "¡Hola! No pude abrir el enlace de mi contrato.",
      c_cancel_h: "Contrato cancelado", c_cancel_p: "Este contrato fue reemplazado o cancelado por {a}. Si recibiste un nuevo enlace, usa el más reciente.", wa_c_cancel: "¡Hola! El contrato nº {n} aparece como cancelado.",
      nav_contract: "Contrato", nav_sign: "Firmar", nav_copy: "Descargar copia", c_label: "Contrato nº {n}",
      c_blur_ok: "Contrato", c_sharp_ok: "firmado", c_blur_wait: "Solo falta tu", c_sharp_wait: "firma",
      c_sub_ok: "<b>Gracias, {n}.</b> El contrato está firmado por las partes y tu copia está disponible abajo.", c_sub_wait: "<b>Hola, {n}.</b> Lee el contrato con los servicios que elegiste. Ya está firmado por {a}.",
      c_chip_ok: "Firmado por las partes", c_chip_wait: "Pendiente de tu firma", c_chip_sent: "Enviado el {d}",
      c_dl: "Descargar copia en PDF", c_read: "Leer el contrato", c_go: "Ir a la firma",
      r_agency: "Contratada", r_client: "Contratante", r_inter: "Intermediario y testigo", w_yours: "Pendiente de tu firma", w_sig: "Pendiente de firma", signed_at: "Firmado electrónicamente el {d}", sig_of: "Firma de {n}",
      verify: "Código de verificación:", view_pdf: "Ver en PDF",
      s_eyebrow: "Firma electrónica", s_h: "Firma<br>en línea", s_lead: "Revisa tus datos, dibuja tu firma y confirma. Toma menos de un minuto y recibes la copia en PDF al instante.",
      s_legal: "La firma electrónica es válida entre las partes. Registramos fecha, hora, dirección IP y el código de verificación del texto que leíste.",
      f_signer: "Nombre completo de quien firma *", f_sdoc: "CPF de quien firma *", sdoc_hint: "O el CNPJ, si firmas en nombre de la empresa", f_sdoc_x: "Documento de quien firma *", sdoc_hint_x: "CI, DNI, pasaporte u otro", f_copy: "Correo para la copia *",
      your_sig: "Tu firma *", clear: "Borrar", pad_ph: "Dibuja tu firma aquí", s_accept: "Leí el contrato completo y estoy de acuerdo con todos los términos. Entiendo que esta firma electrónica tiene la misma validez que la firma en papel.",
      sign: "Firmar contrato", signing: "Firmando…", s_doubt: "Tengo una duda antes de firmar", wa_c_doubt: "¡Hola! Tengo una duda sobre el contrato nº {n}.",
      ok_eyebrow: "Todo listo", ok_h: "Contrato<br>firmado", ok_mailed: "Enviamos tu copia a <b>{e}</b>. ", ok_lead: "Guarda la copia en PDF: incluye las firmas y el registro con fecha, hora y código de verificación.", next_h: "Próximos pasos", next_default: "Pronto nos pondremos en contacto para iniciar el proyecto.", wa_signed: "¡Hola! Firmé el contrato nº {n}.",
      e_full: "Indica el nombre completo.", e_pad: "Dibuja tu firma en el recuadro.", m_accept_c: "Marca que leíste el contrato y estás de acuerdo para firmar.", t_signed: "Contrato firmado. ¡Gracias!", c_foot_r: "{a}",
    },
    en: {
      menu: "Menu", talk_wa: "Chat on WhatsApp", 
      home: "home", foot_talk: "Get in touch", foot_rights: "All rights reserved.", foot_top: "Back to top",
      countries: { BR: "Brazil", PY: "Paraguay", AR: "Argentina", UY: "Uruguay", CL: "Chile", US: "United States", XX: "" },
      loading_prop: "Loading your proposal…", prop_nf: "Proposal not found", prop_nf_p: "The link may be incomplete or the proposal was removed. Contact us to get a new link.", cant_open: "Couldn't open it", wa_cant_prop: "Hi! I tried to open my proposal but couldn't.",
      nav_prop: "Proposal", nav_svc: "Services", nav_steps: "Steps", nav_order: "My order",
      hero_label: "Commercial proposal", hero_blur: "A proposal tailored to your", hero_sharp: "business",
      prepared: "Prepared for {w}.", open_sub: "Choose the services that make sense for you, see the prices right away and send your order.",
      cta_build: "Build my order", cta_view: "See my order", cta_doubt: "Questions on WhatsApp",
      wa_doubt: "Hi! I'm looking at {a}'s proposal and I have a question.", wa_doubt_open: "Hi! I'm looking at the online proposal and I have a question.",
      welcome: "Welcome. We prepared this proposal around what your business needs right now.",
      who: "Quality work, with attention to every detail and full focus on your business goals.",
      team: "You can be sure we'll work with <strong>full focus on your business goals.</strong>",
      principles_aria: "How we work",
      principles: ["We listen before we propose.", "We plan before we execute.", "We keep our word.", "We stay close."],
      fixed_label_n: "The services in this proposal", fixed_label_1: "The service in this proposal", fixed_hint: "Choose how to pay for each one", fixed_hint_1: "Choose how to pay", note_fixed: "We have selected the right services for where your business is now. You only choose how to pay for each one: prices update instantly and you confirm the order at the end of the page.", off_h: "Proposal unavailable", off_talk: "Ask for an updated proposal", wa_off: "Hi! I received {a}'s proposal and would like an updated version.", pick_label: "Your proposal", pick_h: "The best choice <em>for you</em>",
      note_default: "Choose the services that make sense now and how you want to pay for each one. Prices update instantly, and you send the order at the end of the page.",
      note_contract: "This is your order, and it's already a contract. For any changes, get in touch.", note_order: "This is the order you sent. To change something before the contract, use “Change order” at the end of the page.",
      note_declined: "You told us now isn't the right time. If you change your mind, you can reopen the order at the end of the page.", note_expired: "This proposal was valid until {d}. Get in touch and we'll update the prices.",
      choose_one: "Choose one option", add_also: "Add on", services: "Services", service: "Service", add_many: "Add as many as you need",
      monthly: "monthly", once: "one-time project", recommended: "Recommended", deadline: "Timeline: {d}", min_contract: "{m}-month minimum term", included: "What's included",
      investment: "Investment", per_month: "/mo", pay_method: "Choose how to pay", save: "save {v} ({p}%)",
      b_chosen: "Option selected", b_in: "Added to order", b_choose: "Choose this option", b_add: "Add to order", t_added: "{s} added to your order.",
      anchor_h: "A whole team for the price of <em>one professional</em>", anchor_p: "{t}, at a high level, this is what you'd invest every month.", anchor_p2: "To have the same structure by hiring one professional for each role, your company's monthly cost would be:", anchor_them: "Hiring the team", anchor_them_s: "{n} professionals", anchor_us: "With {a}", anchor_us_s: "the whole team", anchor_save: "You save", anchor_save_v: "{v} a month", anchor_save_s: "{p}% less · {y} over 12 months", anchor_team_h: "Who you would need to hire", anchor_fine: "Reference monthly costs per professional, not including payroll taxes, vacation, bonuses, benefits or equipment.", anchor_team: "In-house team", anchor_you: "Your investment",
      steps_label: "Steps", steps_h: "How it <em>works</em>", steps_p: "Step by step for the services you chose, from order to delivery. Agreed with you at every stage.", after_order: "After your order",
      pf_label: "Portfolio", pf_h: "Work we've <em>done</em>", pf_p: "Some of {a}'s work.",
      thanks: "Thank you for your time. We hope that, <em>together</em>, we can reach your goals.", thanks_aria: "Thank you",
      valid_until: "Valid until {d}", expired_on: "Expired on {d}", chip_signed: "Agreement signed", chip_wait: "Agreement awaiting your signature", chip_order: "Order sent", chip_preview: "Company preview", chip_consultant: "Consultant: {n}",
      once_1: "One-time project", once_n: "One-time projects", monthly_t: "Monthly", min_months: "{m}-month minimum term", savings: "Savings for paying upfront", to_start: "To get started", to_start_s: "Down payment and first payments", min_of: "{m}-month minimum",
      sum_empty: "No services chosen yet. <a href=\"#servicos\">Choose above</a> and your summary will show up here.",
      tr1: "Order sent", tr2: "Agreement prepared", tr3: "Signature", tr4: "Project kickoff", tr_done: "Done", tr_now: "Now", tr_next: "Next", tr_aria: "Progress",
      your_order: "Your order", h_received: "Order<br>received", h_review: "Review and<br>send", lead_received: "Follow each step below until the project kicks off.", lead_review: "Check the services and payment options you chose. Then fill in your details for the agreement.",
      fine_valid: "Prices valid until {d}. ", fine: "Once you send the order, we prepare the agreement with these services and send you a link to sign it online.",
      signed_h: "Agreement signed", signed_p: "All set! The agreement is signed by the parties. We'll be in touch soon with the next steps.", see_contract: "View agreement and download a copy",
      ready_h: "Your agreement is ready", ready_p: "We've prepared the agreement with the services you chose, and {a} has already signed it. It only needs your signature, which takes less than a minute.", read_sign: "Read and sign the agreement",
      thanks_h: "Thank you{n}!", thanks_p: "We received your order on {d}. We'll now prepare the agreement with the services you chose and send you the link to sign it.", notify_wa: "Let us know on WhatsApp", wa_ordered: "Hi! I just sent my order through {a}'s proposal.", edit_order: "Change order",
      declined_h: "Thanks for letting us know", declined_p: "We got your message. If you change your mind or want to adjust anything in the proposal, we're here.", review_again: "I want to review the proposal", wa_talk: "Hi! I'd like to talk about {a}'s proposal.",
      expired_h: "Proposal expired", expired_p: "This proposal was valid until {d}. Get in touch and we'll send you an updated version.", ask_update: "Request an update", wa_expired: "Hi! {a}'s proposal has expired. Could you send me an updated one?",
      form_note: "Details for the agreement. Fields marked * are required.", form_note_x: "Details for the agreement ({c}). Fields marked * are required.",
      f_name: "Full name or company name *", f_doc: "CPF or CNPJ *", f_doc_x: "ID (EIN, tax ID, passport or other) *", f_rep: "Representative (if a company)", f_email: "E-mail *", f_phone: "WhatsApp *", f_phone_x: "Phone/WhatsApp with country code *",
      f_cep: "CEP *", cep_hint: "Type the CEP and the address fills in", cep_loading: "Looking up the address…", cep_nf: "CEP not found. Fill in the address below.", cep_ok: "Address found. Check and complete it.",
      f_street: "Street *", f_number: "Number *", f_compl: "Unit / suite", f_district: "Neighborhood *", f_city: "City and state *", city_hint: "Start typing and pick from the list", city_none: "No city found",
      f_address_x: "Address (street, number and unit) *", f_postal_x: "ZIP / postal code", f_city_x: "City and state *",
      f_notes: "Notes", notes_ph: "Anything we should know before preparing the agreement?", accept: "I have read and agree with the services, prices and conditions of this proposal.",
      send: "Send order", update: "Update order", sending: "Sending…", cancel_edit: "Cancel changes", decline: "Not the right time? Let us know", decline_l: "If you can, tell us why. It helps us improve.", decline_send: "Send reply",
      e_name: "Enter your full name or company name.", e_doc: "Invalid CPF or CNPJ.", e_doc_x: "Enter your ID.", e_rep: "Enter the company's representative.", e_email: "Enter a valid e-mail.", e_phone: "Enter your WhatsApp with area code.", e_phone_x: "Enter your phone with country code.",
      e_cep: "Enter a valid CEP.", e_street: "Enter the street.", e_number: "Enter the number.", e_district: "Enter the neighborhood.", e_city: "Enter the city.", e_city_list: "Pick a city from the list.", e_address: "Enter the full address.",
      m_pick: "Choose at least one service above.", m_accept: "Tick the box to confirm you agree with the conditions.",
      t_edit: "Adjust the services and send again at the end of the page.", t_prev_decline: "In preview mode, client replies aren't sent.", t_prev_order: "Preview: the client's order isn't sent from here.",
      d_service: "service", d_services: "services", d_once: "One-time", d_monthly: "Monthly", d_start: "To start", d_review: "Review order",
      loading_c: "Loading the agreement…", c_nf: "Agreement not found", c_nf_p: "The link may be incomplete or the agreement was replaced. Contact us to get the right link.", wa_cant_c: "Hi! I couldn't open the link to my agreement.",
      c_cancel_h: "Agreement cancelled", c_cancel_p: "This agreement was replaced or cancelled by {a}. If you received a new link, use the most recent one.", wa_c_cancel: "Hi! Agreement no. {n} shows as cancelled.",
      nav_contract: "Agreement", nav_sign: "Sign", nav_copy: "Download copy", c_label: "Agreement no. {n}",
      c_blur_ok: "Agreement", c_sharp_ok: "signed", c_blur_wait: "It only needs your", c_sharp_wait: "signature",
      c_sub_ok: "<b>Thank you, {n}.</b> The agreement is signed by the parties and your copy is available below.", c_sub_wait: "<b>Hi {n}.</b> Read the agreement with the services you chose. {a} has already signed it.",
      c_chip_ok: "Signed by the parties", c_chip_wait: "Awaiting your signature", c_chip_sent: "Sent on {d}",
      c_dl: "Download PDF copy", c_read: "Read the agreement", c_go: "Go to signature",
      r_agency: "Service provider", r_client: "Client", r_inter: "Intermediary and witness", w_yours: "Awaiting your signature", w_sig: "Awaiting signature", signed_at: "Signed electronically on {d}", sig_of: "Signature of {n}",
      verify: "Verification code:", view_pdf: "View PDF",
      s_eyebrow: "Electronic signature", s_h: "Sign<br>online", s_lead: "Check your details, draw your signature and confirm. It takes less than a minute, and you get the PDF copy right away.",
      s_legal: "The electronic signature is valid between the parties. We record the date, time, IP address and the verification code of the text you read.",
      f_signer: "Full name of the signer *", f_sdoc: "Signer's CPF *", sdoc_hint: "Or the CNPJ, if signing on behalf of the company", f_sdoc_x: "Signer's ID *", sdoc_hint_x: "Passport, national ID or other", f_copy: "E-mail for your copy *",
      your_sig: "Your signature *", clear: "Clear", pad_ph: "Draw your signature here", s_accept: "I have read the entire agreement and agree with all its terms. I understand this electronic signature is as valid as a signature on paper.",
      sign: "Sign agreement", signing: "Signing…", s_doubt: "I have a question before signing", wa_c_doubt: "Hi! I have a question about agreement no. {n}.",
      ok_eyebrow: "All set", ok_h: "Agreement<br>signed", ok_mailed: "We sent your copy to <b>{e}</b>. ", ok_lead: "Keep the PDF copy: it includes the signatures and the record with date, time and verification code.", next_h: "Next steps", next_default: "We'll be in touch soon to kick off the project.", wa_signed: "Hi! I signed agreement no. {n}.",
      e_full: "Enter the full name.", e_pad: "Draw your signature in the box.", m_accept_c: "Tick the box to confirm you've read and agree with the agreement.", t_signed: "Agreement signed. Thank you!", c_foot_r: "{a}",
    },
  };
  const MONTHS = {
    pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
    es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };
  const LOC = { pt: "pt-BR", es: "es-AR", en: "en-US" };
  R.lang = "pt";
  R.cur = "BRL";
  R.setLocale = (lang, cur) => { R.lang = D[lang] ? lang : "pt"; R.cur = cur || "BRL"; document.documentElement.lang = LOC[R.lang]; };
  // Textos de exemplo de cada modelo de página (saúde, construção e tecnologia); o neutro usa os textos acima.
  // Valem quando a empresa deixa o campo em branco em Página da proposta.
  const LAYOUT_TEXTS = {
    saude: {
      pt: { hero_blur: "Cuidado e atenção em cada", hero_sharp: "detalhe", welcome: "Seja bem-vindo. Preparamos esta proposta com atenção ao que você precisa e ao seu bem-estar.", team: "Conte com um atendimento <strong>próximo, humano e responsável.</strong>", pick_h: "O cuidado certo <em>para você</em>", thanks: "Obrigado pela confiança. Estamos prontos para <em>cuidar</em> de você." },
      es: { hero_blur: "Cuidado y atención en cada", hero_sharp: "detalle", welcome: "Bienvenido. Preparamos esta propuesta con atención a lo que necesitas y a tu bienestar.", team: "Cuenta con una atención <strong>cercana, humana y responsable.</strong>", pick_h: "El cuidado adecuado <em>para ti</em>", thanks: "Gracias por tu confianza. Estamos listos para <em>cuidarte</em>." },
      en: { hero_blur: "Care and attention in every", hero_sharp: "detail", welcome: "Welcome. We prepared this proposal with attention to what you need and to your well-being.", team: "Count on <strong>close, caring and responsible service.</strong>", pick_h: "The right care <em>for you</em>", thanks: "Thank you for your trust. We're ready to <em>take care</em> of you." },
    },
    construcao: {
      pt: { hero_blur: "Do projeto à entrega, uma obra feita com", hero_sharp: "solidez", welcome: "Seja bem-vindo. Preparamos esta proposta com escopo claro, prazos definidos e execução bem feita.", team: "Pode contar com <strong>organização, segurança e o prazo cumprido.</strong>", pick_h: "O que vamos <em>construir</em>", thanks: "Obrigado pela confiança. Vamos <em>construir</em> juntos." },
      es: { hero_blur: "Del proyecto a la entrega, una obra hecha con", hero_sharp: "solidez", welcome: "Bienvenido. Preparamos esta propuesta con alcance claro, plazos definidos y una ejecución bien hecha.", team: "Cuenta con <strong>organización, seguridad y plazos cumplidos.</strong>", pick_h: "Lo que vamos a <em>construir</em>", thanks: "Gracias por tu confianza. Vamos a <em>construir</em> juntos." },
      en: { hero_blur: "From plan to handover, a project built with", hero_sharp: "solidity", welcome: "Welcome. We prepared this proposal with a clear scope, set deadlines and quality execution.", team: "Count on <strong>organization, safety and deadlines met.</strong>", pick_h: "What we'll <em>build</em>", thanks: "Thank you for your trust. Let's <em>build</em> it together." },
    },
    tecnologia: {
      pt: { hero_blur: "Tecnologia para o seu negócio", hero_sharp: "avançar", welcome: "Seja bem-vindo. Preparamos esta proposta com as soluções certas para o momento do seu negócio.", team: "Conte com <strong>agilidade, segurança e suporte de verdade.</strong>", pick_h: "A solução certa <em>para você</em>", thanks: "Obrigado pelo seu tempo. Vamos <em>evoluir</em> juntos." },
      es: { hero_blur: "Tecnología para que tu negocio", hero_sharp: "avance", welcome: "Bienvenido. Preparamos esta propuesta con las soluciones adecuadas para el momento de tu negocio.", team: "Cuenta con <strong>agilidad, seguridad y soporte real.</strong>", pick_h: "La solución adecuada <em>para ti</em>", thanks: "Gracias por tu tiempo. Vamos a <em>evolucionar</em> juntos." },
      en: { hero_blur: "Technology to move your business", hero_sharp: "forward", welcome: "Welcome. We prepared this proposal with the right solutions for where your business is now.", team: "Count on <strong>speed, security and real support.</strong>", pick_h: "The right solution <em>for you</em>", thanks: "Thank you for your time. Let's <em>grow</em> together." },
    },
  };
  R.LAYOUT_TEXTS = LAYOUT_TEXTS;
  // Textos padrão em português (o painel mostra como exemplo nos campos de "Página da proposta")
  R.T_PT = D.pt;
  // Texto personalizado pela empresa (Dados da empresa › Página da proposta): vale em todos os idiomas.
  // Vem como texto simples; *palavra* vira destaque e a quebra de linha é mantida.
  const ALIAS = { note_default: "note_fixed" };
  const custom = (k) => { const T = R.B && R.B.texts; if (!T) return null; const c = T[k] != null ? T[k] : ALIAS[k] ? T[ALIAS[k]] : null; return typeof c === "string" && c.trim() ? c : null; };
  R.fmtText = (c) => R.esc(c.trim()).replace(/\*([^*\n]+)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
  R.t = (k, v) => {
    const c = custom(k);
    const L = LAYOUT_TEXTS[R.B && R.B.layout], lt = L && ((L[R.lang] && L[R.lang][k]) ?? (L.pt && L.pt[k]));
    let s = c != null ? R.fmtText(c) : lt != null ? lt : (D[R.lang] && D[R.lang][k] != null ? D[R.lang][k] : D.pt[k]);
    if (s == null) return k;
    if (typeof s === "string") { const vv = { a: R.esc((R.B && R.B.name) || ""), ...(v || {}) }; s = s.replace(/\{(\w+)\}/g, (m, x) => (vv[x] != null ? vv[x] : m)); }
    return s;
  };
  R.money = (n) => {
    const v = Number(n) || 0, cur = R.cur || "BRL";
    const dec = cur === "PYG" ? 0 : v % 1 ? 2 : 0;
    return v.toLocaleString(cur === "BRL" ? "pt-BR" : LOC[R.lang], { style: "currency", currency: cur, minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  R.brl = R.money;
  R.fillSchedule = (o) => {
    const n = Number(o.n) || 0, parcela = n ? (Number(o.total) - Number(o.upfront)) / n : 0;
    return String(o.schedule || "").replace(/\{(total|entrada|parcela|n)\}/g, (m, k) => (k === "n" ? String(n) : R.money(k === "total" ? o.total : k === "entrada" ? o.upfront : parcela)));
  };
  R.dateLong = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return R.lang === "en" ? `${MONTHS.en[m - 1]} ${d}, ${y}` : `${d} de ${MONTHS[R.lang][m - 1]} de ${y}`;
  };
  R.dateTime = (ts) => (ts ? new Date(ts).toLocaleString(LOC[R.lang], { dateStyle: "short", timeStyle: "short" }) : "");
  R.dateShort = (ts) => (ts ? new Date(ts).toLocaleDateString(LOC[R.lang]) : "");
})();
