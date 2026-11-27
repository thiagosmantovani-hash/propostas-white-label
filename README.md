# Sistema de propostas (white label)

Sistema de montagem, envio e assinatura de propostas para empresas e freelancers de qualquer área de prestação de serviços. Nada da marca fica fixo no código: nome, logo, cores, fontes, textos e dados do contrato vêm da tela **Dados da empresa** do painel. Roda no Netlify com Functions e Blobs; não precisa de banco de dados externo.

## Contas (várias empresas no mesmo sistema)

- Qualquer empresa ou freelancer cria a conta em `/admin#/criar-conta` (ou no botão **Criar conta** da página inicial): nome, nome da empresa, e-mail e senha. Já entra no painel dela, vazio, começando por **Empresa**.
- Cada conta tem a sua "gaveta" de dados (`e/<id da empresa>/...` no Blobs): propostas, contratos, clientes, pastas, catálogo, consultores, marca e contrato. Uma empresa nunca lê nem grava os dados de outra (ver `netlify/lib/store.mjs`).
- Login com e-mail e senha em `/admin` (o responsável e os consultores usam a mesma tela). O e-mail é único no sistema todo. **Esqueci minha senha** manda um link válido por 1 hora (precisa do e-mail do sistema configurado, abaixo).
- Em **Minha conta** o responsável troca o nome e a senha. Trocar a senha encerra os acessos abertos com a senha antiga.
- Os links do cliente (`/p/...`, `/c/...`) continuam iguais e mostram a marca da empresa certa. O link aberto fica em `/p/aberta?e=<id da empresa>` (aparece pronto em Configurações).
- **Três endereços**: `/` página de divulgação e cadastro; `/entrar` login das contas (empresas e consultores); `/dono` login exclusivo do dono do sistema (o login das contas não mostra esse acesso).
- **Painel do dono** (`/dono`, senha `ADMIN_PASSWORD`): visão geral (contas, novas e ativas em 7 dias, propostas, contratos); configurações do sistema (nome do sistema, cadastro aberto/fechado, limite de consultores por conta, validade padrão das propostas das contas novas, aviso no topo do painel de todas as contas); links prontos para copiar; conta modelo de teste; e a lista de contas com busca, filtro e as ações criar conta, editar (empresa, responsável, e-mail de acesso, limite de consultores, anotação interna), entrar no painel, nova senha, bloquear/liberar e excluir (pede o nome da conta; apaga dados, logins e links). Empresa bloqueada não entra no painel, mas os links já enviados aos clientes continuam abrindo.
- **Conta modelo de teste**: login `conta.teste@example.com`, senha `teste1234` (compartilhado com quem for testar; nome e senha não mudam). Nasce no primeiro login e o dono pode recriar do zero no painel.
- `SIGNUP_CLOSED=1` fecha o cadastro de novas empresas.

## Dados da empresa (white label)

No painel, em **Empresa** (`/admin#/empresa`), o administrador define:

- identificação para o contrato: nome que o cliente vê, razão social ou nome completo, CNPJ ou CPF (freelancer), endereço, cidade do foro, representante legal e Pix;
- contato: WhatsApp, Instagram e site (rodapé e botões de WhatsApp);
- logo para fundo escuro e para fundo claro (PNG; sem logo, o nome aparece em texto). O de fundo claro também vai para o PDF do contrato;
- cores (principal, destaque, fundo escuro e fundo claro) e fontes dos títulos e dos textos, servidas em `/api/public/brand.css`;
- textos da proposta: slogan, apresentação, quem somos, número em destaque, como trabalhamos e próximos passos;
- nome do remetente dos e-mails;
- assinatura padrão (o sistema não vem com nenhuma assinatura);
- galeria de trabalhos (aparece nas propostas quando tem pelo menos uma imagem).

Sem nada preenchido, o sistema usa uma identidade neutra ("Sua empresa").

## Como funciona

1. **Painel** (`/admin`, com senha): monte a proposta escolhendo os serviços do catálogo, ajuste valores e formas de pagamento, gere o link e envie por WhatsApp, e-mail ou cópia. O painel mostra quantas vezes o cliente abriu.
2. **Proposta** (`/p/<código>`): página interativa. O cliente escolhe os serviços e a forma de pagamento de cada um, vê os totais na hora e envia o pedido com os dados para o contrato. Também pode avisar que não é o momento.
3. **Contrato**: no painel, o pedido vira contrato preenchido pelo modelo. Você revisa, assina desenhando na tela e libera o link.
4. **Assinatura** (`/c/<código>`): o cliente lê, assina desenhando e baixa a cópia em PDF com as duas assinaturas e o registro de auditoria (data, hora, IP, navegador e código SHA-256 do texto).
5. **Link aberto** (opcional, `/p/aberta`): todos os serviços ativos; cada pedido vira uma proposta no painel. Começa desligado.

## Catálogo de serviços

O sistema começa com o catálogo vazio. Cada empresa cadastra os próprios serviços em **Serviços** no painel (botão **Novo serviço**): nome, descrição, o que está incluso, etapas, prazo e formas de pagamento. Enquanto o catálogo estiver vazio, a tela de nova proposta, o link aberto e o modelo de teste avisam que falta cadastrar serviços.

A conta modelo de teste e os testes usam um catálogo de exemplo fictício (`netlify/lib/catalogo-exemplo.mjs`); as contas novas começam vazias.

## Consultores

- O administrador cadastra consultores em Equipe (#/equipe) e recebe uma senha gerada para enviar a eles.
- O consultor entra em /admin com e-mail e senha. Ele vê só as propostas dele, completa CPF e assinatura em Meu perfil, gera o contrato e assina como intermediador e testemunha.
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

## E-mails pelo Gmail

Com `GMAIL_USER` (ex.: propostas.suaempresa@gmail.com) e `GMAIL_APP_PASSWORD` (senha de app do Google, criada em myaccount.google.com/apppasswords com a verificação em duas etapas ativa), o sistema envia:
- ao cliente: confirmação do pedido, link do contrato e cópia assinada em PDF;
- à empresa (e-mail salvo em Dados da empresa) e ao consultor: avisos de pedido, recusa e assinatura;
- a quem pediu: o link de **Esqueci minha senha**.
O remetente é do sistema todo; o nome que aparece é o da empresa de cada conta.
Nunca use a senha normal da conta. `EMAIL_TEST=1` registra os envios sem mandar nada (para testes; lista em /api/public/__emails).

## WhatsApp automático (Z-API)

Com `ZAPI_INSTANCE`, `ZAPI_TOKEN` e `ZAPI_CLIENT_TOKEN` (painel da z-api.io, serviço pago), o sistema envia pelo número conectado:
- ao cliente: proposta (botão "Enviar no WhatsApp (automático)"), pedido recebido, contrato para assinar e cópia assinada;
- à empresa (WhatsApp de Dados da empresa) e ao consultor: novo pedido, recusa, assinatura do intermediador e contrato assinado.
As duas frentes ligam e desligam em Configurações › WhatsApp automático, que tem botão de teste. `WA_TEST=1` registra os envios sem mandar nada.

## Arquivo e exclusão

- Cada proposta tem "Baixar arquivo .zip": PDF da proposta (pedido, dados do cliente, histórico), PDFs dos contratos com auditoria, imagens das assinaturas, dados.json e LEIA-ME.
- O administrador pode excluir propostas com contrato assinado, com confirmação na tela; a janela oferece baixar o .zip antes.

## Variáveis de ambiente (Netlify > Project configuration > Environment variables)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `ADMIN_PASSWORD` | sim | Senha do dono do sistema (painel com todas as empresas) |
| `SESSION_SECRET` | recomendada | Texto aleatório longo; reforça a sessão do painel |
| `RESEND_API_KEY` | não | Liga os e-mails automáticos (resend.com) |
| `EMAIL_FROM` | não | Remetente verificado no Resend, ex.: `propostas@seudominio.com.br` (o nome vem de Dados da empresa) |
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
netlify/lib/            catálogo, modelo de contrato, PDF, e-mail, login, armazenamento
dev/server.mjs          servidor local para testes
```

## Rodar no computador

```bash
npm install
npm run dev          # http://localhost:8888  · crie uma conta em /admin; senha local do dono do sistema: teste123
```

Os dados locais ficam em `dev/.data` (ignorado pelo git).

## Publicar

Conecte o repositório no Netlify (build command vazio; publish e functions já vêm do `netlify.toml`), defina `ADMIN_PASSWORD` e faça o deploy.

## Observações

- A assinatura é eletrônica simples, com aceite expresso e trilha de auditoria (MP nº 2.200-2/2001, art. 10, § 2º; Lei nº 14.063/2020). Para exigência de certificado ICP-Brasil, integre um serviço como Clicksign ou D4Sign.
- O modelo de contrato é um ponto de partida. Revise com um advogado antes de usar.
- Propostas enviadas guardam uma cópia dos serviços e valores; mudar o catálogo não altera o que o cliente já recebeu.
