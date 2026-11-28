# Sistema de propostas (white label)

Sistema de montagem, envio e assinatura de propostas para empresas e freelancers de qualquer área de prestação de serviços. Nada da marca fica fixo no código: nome, logo, cores, fontes, textos e dados do contrato vêm da tela **Dados da empresa** do painel. Roda no Netlify com Functions e Blobs; não precisa de banco de dados externo.

## Contas (várias empresas no mesmo sistema)

- Qualquer empresa ou freelancer cria a conta em `/admin#/criar-conta` (ou no botão **Criar conta** da página inicial): nome, nome da empresa, **WhatsApp** e senha. A conta só nasce depois de digitar o código de 6 números que chega no WhatsApp informado (vale 10 minutos), então ninguém cria conta com o número de outra pessoa. Já entra no painel dela, vazio, começando por **Empresa**.
- Cada conta tem a sua "gaveta" de dados (`e/<id da empresa>/...` no Blobs): propostas, contratos, clientes, pastas, catálogo, consultores, marca e contrato. Uma empresa nunca lê nem grava os dados de outra (ver `netlify/lib/store.mjs`).
- Login com **WhatsApp e senha** em `/entrar` (o responsável e os consultores usam a mesma tela). O WhatsApp é único no sistema todo. **Esqueci minha senha** manda um código no WhatsApp para criar a senha nova. Em **Conta e plano** (ou **Meu perfil**, para o consultor) a pessoa troca o número, também com código no número novo. Contas criadas pelo dono e consultores confirmam o número com código no primeiro acesso. Contas antigas e a conta modelo de teste ainda entram com o e-mail.
- Em **Minha conta** o responsável troca o nome e a senha. Trocar a senha encerra os acessos abertos com a senha antiga.
- Os links do cliente (`/p/...`, `/c/...`) continuam iguais e mostram a marca da empresa certa. O link aberto fica em `/p/aberta?e=<id da empresa>` (aparece pronto em Configurações).
- **Três endereços**: `/` página de divulgação e cadastro; `/entrar` login das contas (empresas e consultores); `/dono` login exclusivo do dono do sistema (o login das contas não mostra esse acesso).
- **Painel do dono** (`/dono`, senha `ADMIN_PASSWORD`): visão geral (contas, novas e ativas em 7 dias, propostas, contratos); configurações do sistema (nome do sistema, cadastro aberto/fechado, limite de consultores por conta, validade padrão das propostas das contas novas, aviso no topo do painel de todas as contas); links prontos para copiar; conta modelo de teste; e a lista de contas com busca, filtro e as ações criar conta (com o WhatsApp do responsável), editar (empresa, responsável, WhatsApp de acesso, limite de consultores, anotação interna), entrar no painel, nova senha, bloquear/liberar e excluir (pede o nome da conta; apaga dados, logins e links). Empresa bloqueada não entra no painel, mas os links já enviados aos clientes continuam abrindo.
- **Conta modelo de teste**: login `conta.teste@example.com`, senha `teste1234` (compartilhado com quem for testar; nome e senha não mudam). Nasce no primeiro login e o dono pode recriar do zero no painel.
- `SIGNUP_CLOSED=1` fecha o cadastro de novas empresas.

## Dados da empresa (white label)

No painel, em **Empresa** (`/admin#/empresa`), o administrador define:

- identificação para o contrato: nome que o cliente vê, razão social ou nome completo, CNPJ ou CPF (freelancer), endereço, cidade do foro, representante legal e Pix;
- contato: WhatsApp, Instagram e site (rodapé e botões de WhatsApp);
- logo para fundo escuro e para fundo claro (PNG; sem logo, o nome aparece em texto). O de fundo claro também vai para o PDF do contrato;
- cores (principal, destaque, fundo escuro e fundo claro) e fontes dos títulos e dos textos, servidas em `/api/public/brand.css`;
- assinatura padrão (o sistema não vem com nenhuma assinatura): desenhada ou só com nome completo e CPF/CNPJ.

Em **Página da proposta** (`/admin#/pagina`) ficam o modelo, as cores, as fontes, os textos (slogan, apresentação, quem somos, número em destaque, como trabalhamos e próximos passos) e a **galeria de trabalhos** (aparece nas propostas quando tem pelo menos uma imagem). Os e-mails saem com o nome da empresa.

Sem nada preenchido, o sistema usa uma identidade neutra ("Sua empresa").

## Como funciona

1. **Painel** (`/admin`, com senha): monte a proposta escolhendo os serviços do catálogo, ajuste valores e formas de pagamento, gere o link e envie por WhatsApp, e-mail ou cópia. O painel mostra quantas vezes o cliente abriu.
2. **Proposta** (`/p/<código>`): página interativa. O cliente escolhe os serviços e a forma de pagamento de cada um, vê os totais na hora e envia o pedido com os dados para o contrato. Também pode avisar que não é o momento.
3. **Contrato**: no painel, o pedido vira contrato preenchido pelo modelo. Você revisa, assina (desenhando ou só com nome e CPF/CNPJ) e libera o link.
4. **Assinatura** (`/c/<código>`): o cliente lê e escolhe como assinar: desenhando na tela ou só com o nome completo e o CPF/CNPJ. Baixa a cópia em PDF com as assinaturas e o registro de auditoria (data, hora, IP, navegador, forma de assinatura e código SHA-256 do texto).
5. **Link aberto** (opcional, `/p/aberta`): todos os serviços ativos; cada pedido vira uma proposta no painel. Começa desligado.

## Catálogo de serviços

O sistema começa com o catálogo vazio. Cada empresa cadastra os próprios serviços em **Serviços** no painel (botão **Novo serviço**): nome, descrição, o que está incluso, etapas, prazo e formas de pagamento. Enquanto o catálogo estiver vazio, a tela de nova proposta, o link aberto e o modelo de teste avisam que falta cadastrar serviços.

A conta modelo de teste e os testes usam um catálogo de exemplo fictício (`netlify/lib/catalogo-exemplo.mjs`); as contas novas começam vazias.

## Consultores

- O administrador cadastra consultores em Equipe (#/equipe) e recebe uma senha gerada para enviar a eles.
- O consultor entra em /entrar com o WhatsApp e a senha (no primeiro acesso confirma o número com o código). Ele vê só as propostas dele, completa CPF e assinatura em Meu perfil, gera o contrato e assina como intermediador e testemunha.
- Com a opção "Consultores podem liberar contratos com a assinatura padrão da empresa" ligada, ele libera o contrato e a assinatura padrão é aplicada, com registro de quem liberou. Desligada, só o administrador libera.

## Contrato

- O sistema traz um único modelo de contrato de prestação de serviços, genérico, que serve para serviços pontuais ou mensais de qualquer área (`netlify/lib/contract.mjs`). Ele recebe sozinho os dados do cliente, os serviços, os valores, os prazos e a forma de pagamento de cada pedido.
- Em Configurações › Modelo de contrato, a empresa escolhe entre o modelo do sistema e o próprio contrato: envia um arquivo (Word .docx, PDF, OpenDocument .odt, .txt, .rtf) ou digita e cola o texto. Os campos entre chaves, como `{{cliente_nome}}` e `{{servicos}}`, são trocados pelos dados do pedido; se o contrato não tiver os dados das partes, dos serviços ou dos valores, o sistema coloca um anexo com eles no fim.
- Numeração automática: `## ` abre cláusula, `§ ` abre item. Contratos em espanhol e inglês usam o modelo do sistema traduzido.
- PDF de exemplo: `docs/modelos-de-contrato/contrato-de-prestacao-de-servicos.pdf` (gerado por `node tests/gerar-modelos-pdf.mjs`).

## Organização das propostas

- Na lateral da lista: Todas, Sem pasta, Arquivadas e as pastas de clientes. Crie uma pasta pelo botão +.
- Marque as propostas na tabela para mover para uma pasta, arquivar ou excluir em lote. Também dá para arrastar as linhas até a pasta ou até Arquivadas.
- Propostas com contrato assinado não podem ser excluídas; arquive-as.
- O consultor vê e cria só as pastas dele; o administrador vê todas.

## Testes

Veja `tests/README.md`. O pente fino completo roda com `python3 tests/e2e.py`, e o painel tem o botão Configurações › Modelo de teste.

## Propostas internacionais

- No editor, escolha o país (Brasil, Paraguai, Argentina, Uruguai, Chile, Estados Unidos, outro). Idioma (pt/es/en) e moeda (BRL/USD/PYG/ARS) vêm sugeridos e podem ser trocados.
- "Converter valores do catálogo" converte os valores em reais pela cotação informada e arredonda.
- Fora do Brasil, o cliente informa documento e endereço livres; o contrato sai em espanhol ou inglês, com pagamento por transferência internacional e foro no Brasil. Esses dois modelos são fixos no código (netlify/lib/contract.mjs).
- No Brasil, o CEP preenche o endereço (ViaCEP) e a cidade é escolhida numa lista com os 5.570 municípios.

## Confirmação por WhatsApp (cadastro, primeiro acesso e nova senha)

O sistema não envia e-mails. O acesso é pelo número de WhatsApp, confirmado por um código de 6 números (10 minutos de validade, 5 tentativas, 45 segundos entre reenvios, até 5 códigos por hora por número; por padrão só números do Brasil, `OTP_COUNTRIES=55`).

**Recomendado: WhatsApp Cloud API oficial da Meta** (`WHATSAPP_PROVIDER=meta`). Passo a passo:
1. Em business.facebook.com, tenha um Portfólio empresarial verificado (CNPJ) e, em developers.facebook.com, crie um app do tipo Empresa com o produto WhatsApp.
2. Cadastre um número só para o sistema (não pode estar em uso no aplicativo do WhatsApp) e adicione uma forma de pagamento na conta do WhatsApp Business.
3. Em Gerenciador do WhatsApp › Modelos de mensagem, crie um modelo da categoria **Autenticação**, nome `codigo_de_acesso`, idioma Português (BR), com o botão **Copiar código** e o aviso de segurança. A Meta aprova em minutos ou horas.
4. Crie um usuário do sistema com permissão no app e na conta do WhatsApp e gere um token permanente (`whatsapp_business_messaging`).
5. No Netlify: `WHATSAPP_PROVIDER=meta`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` (ID do número, não o número) e, se mudar, `WHATSAPP_TEMPLATE` e `WHATSAPP_TEMPLATE_LANG`. Faça um novo deploy e confira no painel do dono (Situação do sistema).

Custo: a Meta cobra por mensagem de autenticação entregue (no Brasil, alguns centavos de real por código).

**Alternativa: Twilio Verify** (`WHATSAPP_PROVIDER=twilio`, com `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_VERIFY_SID`): a Twilio cuida do número e do modelo; custa US$ 0,05 por confirmação feita, mais a tarifa da Meta.

**Testes:** `OTP_TEST=1` (ou `WHATSAPP_PROVIDER=teste`) não envia nada; os códigos ficam em `/api/public/__codes`. Nunca ligue isso no site no ar. Sem nenhum provedor configurado, ninguém consegue criar conta nem pedir senha nova.

## Resumo do mês

Em **Resumo** (`/admin#/resumo`), mês a mês: valor fechado (projetos e mensalidades), contratos assinados, propostas criadas, aceitas, recusadas e vencidas, taxas de aceite e de fechamento, aceitas ainda sem contrato, tabela por serviço (oferecido, escolhido, fechado e valor), por consultor e a lista das propostas do mês. Compara com o mês anterior, imprime ou salva em PDF e baixa a planilha (.csv). Cada acontecimento conta no mês em que aconteceu (horário de Brasília). O consultor vê só as propostas dele.

## Planos e cobrança

- Toda conta nova começa com o **teste grátis** (7 dias). Depois, **plano mensal** (R$ 19,90) ou **anual** (R$ 199). Dias de teste e preços ficam no painel do dono (Planos e cobrança) e aparecem na página de divulgação, no cadastro e na tela **Conta e plano › Plano e pagamento** de cada conta.
- Hoje a cobrança é por **confirmação manual**: a conta escolhe o plano, o pedido aparece no painel do dono (botão Cobrança), e o dono registra o pagamento. O plano soma 1 mês ou 12 meses a partir do fim do período atual. O dono também estende o teste, dá cortesia ou cancela a renovação.
- **Exigir plano depois do teste** (painel do dono, desligado por padrão): conta vencida fica só para consulta, sem criar nem enviar propostas. Os links já enviados aos clientes continuam funcionando.
- Pronto para integrar: `netlify/lib/billing.mjs` tem a camada de provedores (manual, Asaas, Stripe) com `checkout()` e `webhook()`, e o endereço `/api/public/billing/webhook/<provedor>` registra os pagamentos confirmados. Para ligar um provedor, implemente as duas funções dele e defina `BILLING_PROVIDER`.

## Segurança

- Sessões assinadas com uma chave que junta `ADMIN_PASSWORD` com `SESSION_SECRET` (ou, sem ela, uma chave aleatória criada uma vez e guardada no armazenamento). Trocar `ADMIN_PASSWORD` encerra todos os acessos.
- Limite de tentativas: 8 senhas erradas por número (ou na senha do dono) e 30 por IP em 15 minutos; cadastro, “Esqueci minha senha”, nova senha, códigos do WhatsApp e pedidos pelo link aberto também têm limite.
- Cadastro, primeiro acesso, nova senha e troca de número só com o código que chega no WhatsApp; o código não fica guardado (só o resumo criptográfico dele).
- Cabeçalhos em `netlify.toml`: política de conteúdo (só scripts do próprio site), proibido abrir as páginas dentro de outros sites, HTTPS obrigatório, sem câmera, microfone e localização.
- Erros internos mostram só um código; o detalhe fica no registro do Netlify.

## Arquivo e exclusão

- Cada proposta tem "Baixar arquivo .zip": PDF da proposta (pedido, dados do cliente, histórico), PDFs dos contratos com auditoria, imagens das assinaturas, dados.json e LEIA-ME.
- O administrador pode excluir propostas com contrato assinado, com confirmação na tela; a janela oferece baixar o .zip antes.

## Variáveis de ambiente (Netlify > Project configuration > Environment variables)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `ADMIN_PASSWORD` | sim | Senha do dono do sistema (painel com todas as empresas) |
| `SESSION_SECRET` | recomendada | Texto aleatório longo; reforça a sessão do painel |
| `WHATSAPP_PROVIDER` | sim, para cadastrar | `meta` (recomendado), `twilio` ou `teste` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | com `meta` | Token permanente e ID do número na Meta (`WHATSAPP_TEMPLATE` padrão `codigo_de_acesso`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | com `twilio` | Twilio Verify |
| `OTP_COUNTRIES` | não | Países que recebem código (padrão `55`) |
| `BILLING_PROVIDER` | não | `manual` (padrão), `asaas` ou `stripe`, quando a integração estiver feita |
| `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | não | Cobrança pelo Asaas (quando ligada) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | não | Cobrança pelo Stripe (quando ligada) |
| `SIGNUP_CLOSED` | não | `1` fecha o cadastro de novas empresas |
| `BLOBS_STORE` | não | Nome do armazenamento no Netlify Blobs. Padrão `propostas` |

Marque o escopo **Functions** nas variáveis. Depois de mudar uma variável, faça um novo deploy.

## Estrutura

```
public/                 páginas e arquivos estáticos (publish)
  admin.html            painel
  proposta.html         página da proposta  (/p/*)
  contrato.html         página do contrato  (/c/*)
  assets/css, js, fonts, logo, portfolio
netlify/functions/api.mjs   API única em /api/*
netlify/lib/            catálogo, modelo de contrato, PDF, confirmação por WhatsApp, cobrança, login, armazenamento
dev/server.mjs          servidor local para testes
```

## Rodar no computador

```bash
npm install
OTP_TEST=1 npm run dev   # http://localhost:8888  · crie uma conta em /admin; senha local do dono do sistema: teste123
```

Os dados locais ficam em `dev/.data` (ignorado pelo git).

## Publicar

Conecte o repositório no Netlify (build command vazio; publish e functions já vêm do `netlify.toml`), defina `ADMIN_PASSWORD` e faça o deploy.

## Observações

- A assinatura é eletrônica simples, com aceite expresso e trilha de auditoria (MP nº 2.200-2/2001, art. 10, § 2º; Lei nº 14.063/2020). Para exigência de certificado ICP-Brasil, integre um serviço como Clicksign ou D4Sign.
- O modelo de contrato é um ponto de partida. Revise com um advogado antes de usar.
- Propostas enviadas guardam uma cópia dos serviços e valores; mudar o catálogo não altera o que o cliente já recebeu.
