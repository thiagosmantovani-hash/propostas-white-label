# Testes

`e2e.py` percorre o sistema inteiro no navegador, do jeito que as pessoas usam:

0. Criação de conta pela tela Criar conta (cada execução cria uma empresa nova).
1. Administrador: login, configurações, catálogo em PT/ES/EN, cadastro de consultor.
2. Consultor: login, CPF, assinatura, troca de senha, pasta de cliente, proposta no Brasil e para o Paraguai (com conversão de moeda), edição.
3. Administrador: proposta com consultor responsável e proposta direta.
4. Cliente: capa, CEP com endereço automático, lista de cidades, pedido em português e em espanhol, recusa e reabertura.
5. Contratos: consultor gera, edita o texto, assina como intermediador e libera; cliente assina; PDF com três assinaturas; contrato em espanhol; contrato direto com a assinatura padrão; administrador segue sem o consultor.
6. Permissões: consultor só vê as propostas dele.
7. Pastas, arrastar para a pasta, arquivar, desarquivar, excluir (assinadas ficam protegidas).
8. Separação entre empresas (outra conta não vê nada) e painel do dono do sistema.
9. Modelo de teste das Configurações e telas no celular.

## Como rodar

```
pip install playwright && python3 -m playwright install chromium
node dev/server.mjs                 # terminal 1 (senha local do dono do sistema: teste123)
python3 tests/e2e.py                # terminal 2
```

No site publicado (cria contas "[E2E]" e apaga as propostas no fim; use KEEP=1 para manter; ADMIN_PASSWORD é a senha do dono do sistema):

```
BASE_URL=https://seu-site.netlify.app ADMIN_PASSWORD='sua senha' python3 tests/e2e.py
```

O resultado fica em `tests/output/relatorio.md`, com capturas de tela e os PDFs assinados.

## Modelo de teste no painel

Em Configurações › Modelo de teste, o botão cria a pasta “Modelo de teste” com um consultor fictício e cinco propostas, uma em cada etapa. O botão ao lado remove tudo.
