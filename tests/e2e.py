"""
Pente fino do sistema de propostas (white label): percorre todas as etapas no navegador
(criação de conta, administrador, consultor, cliente no Brasil e no exterior, contrato, PDF, pastas, arquivo,
separação entre empresas e painel do dono do sistema).
Cada execução cria uma conta nova (empresa "[E2E] ..."), então não mexe nos dados de nenhuma empresa real.

Uso (servidor local):
    node dev/server.mjs            # em outro terminal
    python3 tests/e2e.py

Contra outro endereço:
    BASE_URL=https://seu-site.netlify.app ADMIN_PASSWORD=... python3 tests/e2e.py
    (ADMIN_PASSWORD é a senha do dono do sistema; cria contas "[E2E]"; no fim, apaga as propostas que criou, exceto se KEEP=1)

Saída: tests/output/relatorio.md, capturas de tela e o PDF assinado de cada fluxo.
Requer: pip install playwright && python3 -m playwright install chromium
"""
import asyncio, json, os, re, subprocess, sys, time, traceback, urllib.request, urllib.error
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8888").rstrip("/")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "teste123")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
KEEP = os.environ.get("KEEP") == "1"
OUT = Path(__file__).parent / "output"
OUT.mkdir(exist_ok=True)
TAG = "[E2E]"
STAMP = str(int(time.time()))
OWNER = {"name": "Responsável E2E", "company": f"{TAG} Empresa {STAMP[-5:]}", "email": f"e2e.dono.{STAMP}@exemplo.com", "password": "SenhaDono123"}

results, problems = [], []
created = {"proposals": [], "users": [], "folders": []}


def api(path, body=None, tok=None, method=None):
    req = urllib.request.Request(BASE + "/api/" + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method or ("POST" if body is not None else "GET"),
                                 headers={"content-type": "application/json", **({"authorization": "Bearer " + tok} if tok else {})})
    try:
        with urllib.request.urlopen(req) as r:
            ct = r.headers.get("content-type", "")
            data = r.read()
            return r.status, (json.loads(data) if "json" in ct else data)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None


class Step:
    def __init__(self, name):
        self.name = name

    async def __aenter__(self):
        self.t = time.time()
        print("…", self.name, flush=True)
        return self

    async def __aexit__(self, et, ev, tb):
        ok = et is None
        results.append((self.name, ok, f"{time.time() - self.t:.1f}s", "" if ok else f"{et.__name__}: {str(ev).splitlines()[0][:300]}"))
        print("  ok" if ok else f"  FALHOU: {ev}", flush=True)
        if not ok:
            traceback.print_exception(et, ev, tb, limit=2)
        return True  # segue para a próxima etapa


def watch(page, who):
    page.on("pageerror", lambda e: problems.append(f"[{who}] erro de script: {e}"))
    page.on("console", lambda m: m.type == "error" and "favicon" not in m.text and "404" not in m.text and "410" not in m.text and problems.append(f"[{who}] console: {m.text[:200]}"))

    def resp(r):
        if r.status >= 500 or (r.status >= 400 and "/api/" in r.url and r.status not in (401, 404, 409, 410)):
            problems.append(f"[{who}] HTTP {r.status} {r.request.method} {r.url.replace(BASE, '')}")
    page.on("response", resp)


def make_docx(path, paras):
    """Word mínimo (.docx) com parágrafos (estilo, texto), para testar o envio de contrato próprio."""
    import zipfile
    from xml.sax.saxutils import escape
    body = "".join(f'<w:p>{f"<w:pPr><w:pStyle w:val=\"{st}\"/></w:pPr>" if st else ""}<w:r><w:t>{escape(t)}</w:t></w:r></w:p>' for st, t in paras)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("word/document.xml", f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>')


def make_png(w, h, rgba):
    """PNG de cor sólida, para testar o envio do logo"""
    import struct, zlib
    raw = b"".join(b"\x00" + bytes(rgba) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


async def draw(page, sel):
    el = page.locator(sel)
    await el.scroll_into_view_if_needed()
    box = await el.bounding_box()
    x, y = box["x"] + 30, box["y"] + box["height"] * 0.55
    await page.mouse.move(x, y)
    await page.mouse.down()
    for i in range(24):
        await page.mouse.move(x + i * 11, y - 18 + (i % 4) * 12)
    await page.mouse.up()


async def go(page, hash_):
    """Abre uma tela do painel; força a troca mesmo se já estiver no mesmo endereço."""
    if "/admin" in page.url:
        await page.evaluate("h => { location.hash = '#/__'; location.hash = h; }", hash_)
        await page.wait_for_timeout(150)
    else:
        await page.goto(BASE + "/admin" + hash_)


async def toast(page):
    t = await page.query_selector(".toast")
    return (await t.text_content()) if t else ""


async def shot(page, name, full=True):
    await page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


async def must(page, sel, timeout=12000):
    try:
        return await page.wait_for_selector(sel, timeout=timeout)
    except Exception:
        msg = await toast(page)
        raise AssertionError(f"não apareceu {sel}" + (f" · aviso na tela: {msg}" if msg else ""))


async def admin_login(page):
    await page.goto(BASE + "/admin")
    await page.evaluate("localStorage.clear()")
    await page.reload()
    await must(page, "#em")
    await page.fill("#em", OWNER["email"])
    await page.fill("#pw", OWNER["password"])
    await page.click("button[type=submit]")
    await must(page, ".tiles, .card .empty")


async def seller_login(page, email, pw):
    await page.goto(BASE + "/admin")
    await page.evaluate("localStorage.clear()")
    await page.reload()
    await must(page, "#em")
    await page.fill("#em", email)
    await page.fill("#pw", pw)
    await page.click("button[type=submit]")
    await must(page, ".with-side")


async def new_proposal(page, name, sids, country=None, rate=None, seller_name=None, folder=None):
    await go(page, "#/nova")
    await must(page, "#spList")
    if country:
        await page.select_option("#eCountry", country)
        await page.wait_for_timeout(200)
    await page.fill('[data-k="client.name"]', name)
    for sid in sids:
        await page.click(f'.sp[data-sid="{sid}"] input[data-a=toggle]')
    if rate:
        await page.fill("#eRate", rate)
        await page.click("#eConv")
    if seller_name and await page.query_selector("#eSeller"):
        await page.select_option("#eSeller", label=seller_name)
    if folder:
        await page.select_option('[data-k="folderId"]', label=folder)
    await page.click("#edSave")
    await must(page, ".share")
    pid = page.url.rstrip("/").split("/")[-1]
    created["proposals"].append(pid)
    return pid


async def client_order_br(page, pid, doc="11.222.333/0001-81"):
    if BASE.startswith("http://localhost"):
        await page.route("https://viacep.com.br/**", lambda r: r.fulfill(json={"cep": "01310-100", "logradouro": "Avenida Paulista", "complemento": "", "bairro": "Bela Vista", "localidade": "São Paulo", "uf": "SP"}))
    await page.goto(f"{BASE}/p/{pid}")
    await must(page, "#orderForm")
    if not await page.query_selector(".svc-card.on"):
        await page.click(".svc-card .toggle >> nth=0")
    await page.fill("#f-doc", doc)
    await page.fill("#f-representative", "Maria Teste da Silva")
    await page.fill("#f-email", "cliente.teste@exemplo.com")
    await page.fill("#f-phone", "11999998888")
    await page.locator("#f-cep").scroll_into_view_if_needed()
    await page.type("#f-cep", "01310100")
    await page.wait_for_function("document.querySelector('#f-street').value.length > 2", timeout=10000)
    assert re.search(r"São Paulo", await page.input_value("#f-city")), "CEP não preencheu a cidade"
    await page.fill("#f-number", "1000")
    await page.fill("#f-city", "")
    await page.type("#f-city", "sao paul")
    await must(page, '#cityList li[data-v="São Paulo - SP"]')
    await page.click('#cityList li[data-v="São Paulo - SP"]')
    await page.check("#orderForm input[name=accept]")
    await page.click("#sendBtn")
    await must(page, ".done-box")


async def client_sign(page, cid, doc):
    await page.goto(f"{BASE}/c/{cid}")
    await must(page, "#signForm")
    await page.fill("#s-doc", doc)
    await draw(page, "#pad canvas")
    await page.check("#signForm input[name=accept]")
    await page.click("#signBtn")
    await must(page, "#signInner .done-box")
    st, pdf = api(f"public/contract/{cid}/pdf")
    assert st == 200 and isinstance(pdf, (bytes, bytearray)) and pdf[:4] == b"%PDF", "PDF não gerado"
    return pdf


async def contract_id(page):
    return await page.eval_on_selector("[data-copy*='/c/']", "e => e.dataset.copy.split('/').pop()")


async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, args=["--no-sandbox"])
        ctx = lambda: br.new_context(viewport={"width": 1320, "height": 900}, locale="pt-BR")
        A = await (await ctx()).new_page(); watch(A, "admin")
        V = await (await ctx()).new_page(); watch(V, "consultor")
        C = await (await ctx()).new_page(); watch(C, "cliente")
        st = {}

        async with Step("00 Empresa cria a conta pela tela Criar conta"):
            await A.goto(BASE + "/admin#/criar-conta")
            await A.evaluate("localStorage.clear()")
            await A.reload()
            await must(A, "#nm")
            await shot(A, "00-criar-conta")
            await A.fill("#nm", OWNER["name"]); await A.fill("#co", OWNER["company"])
            await A.fill("#em", OWNER["email"]); await A.fill("#pw", OWNER["password"])
            await A.click("button[type=submit]")
            await must(A, "#aName, .adm-top")
            assert "#/empresa" in A.url, A.url
            TOKEN["admin"] = await A.evaluate('R.store.get("adm", "")')
            s_, d_ = api("admin/bootstrap", tok=TOKEN["admin"])
            assert s_ == 200 and d_["company"]["name"] == OWNER["company"] and not d_["proposals"], d_
            COMPANY["id"] = d_["company"]["id"]
            await shot(A, "00-empresa-nova")

        async with Step("01 Admin entra no painel"):
            await admin_login(A)
            await shot(A, "01-admin-lista")

        async with Step("01a Catálogo começa vazio; o teste cadastra o catálogo de exemplo"):
            if "localhost" in BASE or "127.0.0.1" in BASE:  # no site publicado não mexe no catálogo real
                cat = await A.evaluate('''() => { const H = { "content-type": "application/json", authorization: "Bearer " + R.store.get("adm", "") }; return fetch("/api/admin/bootstrap", { headers: H }).then((r) => r.json()).then((d) => d.catalog.length).catch(() => -1); }''')
                if cat == 0:
                    await go(A, "#/servicos"); await must(A, "#catList .empty")
                    await shot(A, "01a-catalogo-vazio")
                ex = subprocess.run(["node", "--input-type=module", "-e", "import { EXEMPLO_CATALOG } from './netlify/lib/catalogo-exemplo.mjs'; process.stdout.write(JSON.stringify(EXEMPLO_CATALOG))"], cwd=Path(__file__).parent.parent, capture_output=True, text=True, check=True).stdout
                if cat <= 0:
                    n = await A.evaluate('''(c) => { const H = { "content-type": "application/json", authorization: "Bearer " + R.store.get("adm", "") }; return fetch("/api/admin/catalog", { method: "PUT", headers: H, body: JSON.stringify({ catalog: JSON.parse(c) }) }).then((r) => r.json()).then((d) => d.catalog.length); }''', ex)
                    assert n >= 4, n
                    await A.reload(); await must(A, "#catList .sp")

        async with Step("02a Dados da empresa: identificação, cores, logo e assinatura padrão"):
            await go(A, "#/empresa"); await must(A, "#bizSave")
            local = "localhost" in BASE or "127.0.0.1" in BASE
            if local:  # no site publicado não sobrescreve os dados reais da empresa
                for k, v in {"name": "Estúdio Exemplo", "legalName": "Estúdio Exemplo Ltda", "cnpj": "11222333000181", "email": "contato@exemplo.com", "address": "Rua Exemplo, 100, Centro, CEP 01001-000", "city": "São Paulo - SP", "representative": "Ana Exemplo da Silva", "representativeDoc": "52998224725"}.items():
                    await A.fill(f'[data-ag="{k}"]', v)
                await A.fill("#cWa", "5511999990000")
                await A.click("#bizSave"); await A.wait_for_timeout(900)
                assert "salvos" in (await toast(A)), await toast(A)
                png = OUT / "logo-teste.png"
                png.write_bytes(make_png(240, 60, (15, 118, 110, 255)))
                await A.set_input_files('[data-logo="claro"]', str(png)); await A.wait_for_timeout(1200)
                await must(A, ".logo-slot.claro img")
            if await A.query_selector("#cfgPad"):
                await draw(A, "#cfgPad canvas"); await A.click("#sgSave"); await must(A, ".sig-saved img")
            await shot(A, "02a-dados-da-empresa")
            assert await A.query_selector('a.page-cta[href="#/pagina"]'), "falta o atalho para Página da proposta"

        async with Step("02b Página da proposta: modelo, cores, ajustes, textos e prévia"):
            await A.click('.adm-top nav a[href="#/pagina"]'); await must(A, "#pageSave")
            assert await A.query_selector('[data-tpl="saude"]') and await A.query_selector('[data-tpl="construcao"]') and await A.query_selector('[data-tpl="neutro"]'), "faltam modelos"
            await A.click('[data-tpl="tecnologia"]')
            assert await A.input_value('[data-colhex="primary"]') == "#5b5ff0", "o modelo não trocou as cores"
            assert not await A.is_checked("#pgCaps"), "o modelo de tecnologia usa títulos sem maiúsculas"
            await A.fill('[data-colhex="primary"]', "#0f766e"); await A.fill('[data-colhex="accent"]', "#d97706")
            await A.click('.seg label:has-text("Suaves")')
            await A.fill('[data-tx="hero_label"]', "Orçamento personalizado")
            await A.fill('[data-tx="hero_blur"]', "Frase inicial do teste para o seu")
            await A.fill('[data-tx="hero_sharp"]', "projeto")
            await A.click("details.tx-group:has-text('Agradecimento') summary")
            await A.fill('[data-tx="thanks"]', "Obrigado por *confiar* no teste")
            await A.click("details.tx-group:has-text('Rodapé') summary"); await A.fill("#bTag", "Serviços sob medida")
            await A.click("#pageSave"); await A.wait_for_timeout(900)
            assert "salva" in (await toast(A)), await toast(A)
            await go(A, "#/pagina"); await must(A, '[data-tx="hero_blur"]')
            assert await A.input_value('[data-tx="hero_blur"]') == "Frase inicial do teste para o seu"
            assert await A.get_attribute('[data-tpl="tecnologia"]', "aria-pressed") == "true", "modelo escolhido não ficou salvo"
            frame = A.frame_locator("#pgFrame")
            await frame.locator(".hero").wait_for(timeout=15000)
            assert "Frase inicial do teste" in await frame.locator(".hero").text_content(), "a prévia não mostra o texto salvo"
            await A.wait_for_timeout(600)
            await shot(A, "02b-pagina-da-proposta")
            css = urllib.request.urlopen(BASE + "/api/public/brand.css?e=" + COMPANY["id"]).read().decode()
            assert "#0f766e" in css and "--tt:none" in css and "--r-card:14px" in css and "--on-primary:" in css, css
            # a prévia só abre com a chave do painel
            try:
                urllib.request.urlopen(BASE + "/api/public/proposal/exemplo?e=" + COMPANY["id"] + "&k=errada"); raise AssertionError("prévia aberta sem chave")
            except urllib.error.HTTPError as err:
                assert err.code == 404, err.code

        async with Step("02 Configurações: modelo único de contrato e contrato próprio em arquivo"):
            await go(A, "#/config"); await must(A, "#cfgSave")
            assert not await A.query_selector("[data-ct]"), "ainda há modelos de contrato por tipo"
            assert "qualquer tipo de serviço" in await A.text_content("#ctrCard"), "falta o aviso do modelo genérico"
            await A.click("#ctrPrev"); await must(A, "#ctrDoc:not([hidden]) p")
            doc = await A.text_content("#ctrDoc")
            assert "Contrato de prestação de serviços" in doc and "Execução, entregas e aprovações" in doc, doc[:300]
            await shot(A, "02-modelo-contrato")
            await A.click("#ctrPrev")
            # contrato próprio enviado em Word (.docx): o texto vai para a caixa e o anexo do pedido entra sozinho
            await A.click('[data-cm="own"]'); await must(A, ".ctr-up")
            docx = OUT / "contrato-proprio.docx"
            make_docx(docx, [("Heading1", "Contrato de Serviços do Teste"), ("", "CLÁUSULA PRIMEIRA. O contratado executará os serviços com zelo."), ("", "CLÁUSULA SEGUNDA. As partes elegem o foro da cidade do contratado.")])
            await A.set_input_files("#ctrFile", str(docx)); await A.wait_for_function("document.querySelector('#tpl').value.includes('CLÁUSULA SEGUNDA')")
            assert (await A.input_value("#tpl")).startswith("## Contrato de Serviços do Teste"), await A.input_value("#tpl")
            await A.click("#ctrPrev"); await must(A, "#ctrDoc:not([hidden]) p")
            assert "Anexo: dados do pedido" in await A.text_content("#ctrDoc"), "contrato próprio sem o anexo do pedido"
            await shot(A, "02-contrato-proprio")
            await A.click("#ctrPrev")
            if local:
                await A.click("#cfgSave"); await A.wait_for_timeout(800)
                assert "salvas" in (await toast(A)), await toast(A)
                st["own_contract"] = True
            # volta ao modelo do sistema para o resto do teste
            await A.click('[data-cm="sys"]'); await must(A, "#tpl[readonly]")
            await A.click("#cfgSave"); await A.wait_for_timeout(800)
            assert "salvas" in (await toast(A)), await toast(A)

        async with Step("03 Catálogo abre em PT/ES/EN"):
            await go(A, "#/servicos"); await must(A, "#catList")
            for l in ("es", "en", "pt"):
                await A.click(f'[data-l="{l}"]'); await must(A, f'[data-l="{l}"].on')
            await A.click(".sp-head >> nth=0"); await must(A, ".sp-body")
            await shot(A, "03-catalogo")

        async with Step("04 Admin cadastra consultor"):
            await go(A, "#/equipe"); await must(A, "#nName")
            st["seller_email"] = f"e2e.{STAMP}@exemplo.com"
            st["seller_name"] = f"Consultor E2E {STAMP[-4:]}"
            await A.fill("#nName", st["seller_name"]); await A.fill("#nEmail", st["seller_email"]); await A.fill("#nPhone", "44988887777")
            await A.click("#nSave"); el = await must(A, "code.pw")
            st["seller_pw"] = (await el.text_content()).strip()
            await shot(A, "04-equipe")

        async with Step("05 Consultor entra, completa CPF, assinatura e troca a senha"):
            await seller_login(V, st["seller_email"], st["seller_pw"])
            await go(V, "#/perfil"); await must(V, "#pDoc")
            await V.fill("#pDoc", "529.982.247-25"); await V.click("#pSave"); await V.wait_for_timeout(600)
            await draw(V, "#mePad canvas"); await V.click("#meSigSave"); await must(V, "#mySig")
            await V.fill("#pwCur", st["seller_pw"]); await V.fill("#pwNew", "SenhaNova123"); await V.click("#pwSave"); await V.wait_for_timeout(700)
            assert "trocada" in (await toast(V)), await toast(V)
            st["seller_pw"] = "SenhaNova123"
            await seller_login(V, st["seller_email"], st["seller_pw"])

        async with Step("06 Consultor cria pasta de cliente"):
            await V.click("#fNew"); await V.fill("#fNewName", f"{TAG} Cliente do consultor {STAMP[-4:]}"); await V.click("#fNewForm button[type=submit]")
            await must(V, ".sb-item.on[data-view]:not([data-view=all])")
            created["folders"].append(await V.eval_on_selector(".sb-item.on[data-view]", "e => e.dataset.view"))

        async with Step("07 Consultor monta proposta no Brasil (na pasta)"):
            st["p_seller"] = await new_proposal(V, f"{TAG} Barbearia do consultor", ["projeto-avulso", "acompanhamento-mensal"], folder=f"{TAG} Cliente do consultor {STAMP[-4:]}")
            await shot(V, "07-consultor-proposta")

        async with Step("08 Consultor edita a proposta"):
            await go(V, f"#/proposta/{st['p_seller']}/editar"); await must(V, "#edSave")
            assert not await V.query_selector('[data-k="message"]'), "ainda há o campo de mensagem antes das boas-vindas"
            await V.fill('[data-k="title"]', "Título editado pelo teste")
            await V.click("#edSave"); await must(V, ".share")

        async with Step("09 Consultor monta proposta para o Paraguai em dólar"):
            st["p_py"] = await new_proposal(V, f"{TAG} Ferretería Prueba", ["pacote-completo"], country="PY", rate="5,4")

        async with Step("10 Admin monta proposta com consultor responsável"):
            st["p_admin_seller"] = await new_proposal(A, f"{TAG} Clínica com consultor", ["pacote-essencial", "projeto-avulso"], seller_name=st["seller_name"])

        async with Step("11 Admin monta proposta direta (sem consultor)"):
            st["p_admin"] = await new_proposal(A, f"{TAG} Loja direta", ["projeto-avulso"])

        async with Step("12 Link marcado como enviado"):
            await go(A, f"#/proposta/{st['p_admin']}"); await must(A, "[data-share=manual]")
            await A.click("[data-share=manual]"); await A.wait_for_timeout(700)

        async with Step("13 Cliente BR abre a proposta (capa, CEP, cidade) e envia o pedido"):
            await C.goto(f"{BASE}/p/{st['p_admin_seller']}"); await must(C, ".hero-flat")
            assert not await C.query_selector(".hero .cols, .hero canvas"), "capa ainda tem linhas"
            hero = await C.text_content(".hero")
            assert "Frase inicial do teste para o seu" in hero and "projeto" in hero and "Orçamento personalizado" in hero, hero
            assert "nº" not in hero and "nº" not in await C.title(), "número da proposta aparece para o cliente"
            assert "<em>confiar</em>" in await C.inner_html(".statement"), await C.inner_html(".statement")
            assert not await C.query_selector(".star, .msg-row"), "ainda há o símbolo antigo ou a mensagem antes das boas-vindas"
            await shot(C, "13-cliente-capa", full=False)
            await client_order_br(C, st["p_admin_seller"])
            await shot(C, "13-cliente-pedido")

        async with Step("14 Cliente envia pedido da proposta do consultor"):
            await client_order_br(C, st["p_seller"], doc="529.982.247-25")

        async with Step("15 Cliente do Paraguai faz o pedido em espanhol"):
            await C.goto(f"{BASE}/p/{st['p_py']}"); await must(C, "#orderForm")
            assert "para ti" in (await C.text_content(".pick-head")).lower(), "proposta não saiu em espanhol"  # texto do modelo de tecnologia
            assert not await C.query_selector("#heroCta"), "botão do topo ainda aparece"
            assert not await C.is_visible(".svc-card .toggle"), "cliente ainda pode tirar serviços"
            await C.fill("#f-doc", "RUC 80012345-6"); await C.fill("#f-representative", "Juan Prueba"); await C.fill("#f-email", "juan@prueba.com.py")
            await C.fill("#f-phone", "+595 981 123456"); await C.fill("#f-address", "Av. Mcal. López 1234"); await C.fill("#f-city", "Asunción")
            await C.check("#orderForm input[name=accept]"); await C.click("#sendBtn"); await must(C, ".done-box")

        async with Step("16 Cliente responde 'não é o momento' e o admin reabre"):
            await C.goto(f"{BASE}/p/{st['p_admin']}"); await must(C, "[data-act=decline]")
            await C.click("[data-act=decline]"); await C.fill("#f-reason", "Teste de recusa"); await C.click("[data-act=decline-send]"); await must(C, ".done-box")
            await go(A, f"#/proposta/{st['p_admin']}"); await must(A, "#reopenBtn"); await A.click("#reopenBtn"); await A.wait_for_timeout(700)
            await client_order_br(C, st["p_admin"])

        async with Step("17 Consultor gera contrato, edita texto, assina como intermediador e libera"):
            await go(V, f"#/proposta/{st['p_admin_seller']}"); await must(V, "#genBtn"); await V.click("#genBtn")
            await must(V, "#iSign")
            await V.click("#toggleText"); await must(V, "#cText")
            await V.fill("#cText", (await V.input_value("#cText")) + "\n\nCláusula adicionada pelo teste."); await V.click("#saveText"); await must(V, "#cPrev")
            prev = await V.text_content("#cPrev")
            assert "Execução, entregas e aprovações" in prev and "Contrato de prestação de serviços" in prev, "contrato sem o modelo genérico"
            await V.click("#iSign"); await must(V, "#sendC:not([disabled])")
            await shot(V, "17-consultor-rascunho")
            await V.click("#sendC"); await must(V, ".st.contrato")
            st["c_admin_seller"] = await contract_id(V)

        async with Step("18 Cliente assina (3 assinaturas) e baixa o PDF"):
            pdf = await client_sign(C, st["c_admin_seller"], "529.982.247-25")
            assert await C.locator(".sigs.three img").count() == 3, "faltam assinaturas na página"
            (OUT / "18-contrato-consultor.pdf").write_bytes(pdf)
            await shot(C, "18-contrato-assinado")
            st["c_url"] = C.url

        async with Step("19 Consultor: contrato do Paraguai em espanhol, assinatura salva, liberar"):
            await go(V, f"#/proposta/{st['p_py']}"); await must(V, "#genBtn"); await V.click("#genBtn")
            await must(V, "#iSign")
            assert "CONTRATO DE PRESTACIÓN" in (await V.text_content("#cPrev")).upper(), "contrato não saiu em espanhol"
            await V.click("#iSign"); await must(V, "#sendC:not([disabled])"); await V.click("#sendC"); await must(V, ".st.contrato")
            st["c_py"] = await contract_id(V)
            pdf = await client_sign(C, st["c_py"], "CI 4.123.456")
            (OUT / "19-contrato-paraguai.pdf").write_bytes(pdf)

        async with Step("20 Admin: contrato sem consultor, assinatura padrão da empresa"):
            await go(A, f"#/proposta/{st['p_admin']}"); await must(A, "#genBtn"); await A.click("#genBtn")
            await must(A, "#sendC")
            assert await A.query_selector(".sig-auto img"), "assinatura padrão não apareceu"
            assert not await A.query_selector("#aPad"), "ainda pede para desenhar a assinatura"
            await A.click("#sendC"); await must(A, ".st.contrato")
            st["c_admin"] = await contract_id(A)
            pdf = await client_sign(C, st["c_admin"], "529.982.247-25")
            (OUT / "20-contrato-direto.pdf").write_bytes(pdf)

        async with Step("21 Admin vê a pendência do consultor e segue sem ele"):
            await go(V, f"#/proposta/{st['p_seller']}"); await must(V, "#genBtn"); await V.click("#genBtn"); await must(V, "#iSign")
            await go(A, f"#/proposta/{st['p_seller']}"); await must(A, "#cDraft")
            assert await A.query_selector("#sendC[disabled]"), "admin conseguiria liberar sem a assinatura do consultor"
            await A.click("#dropInter"); await A.click("#dropInter"); await must(A, "#sendC:not([disabled])")
            assert "INTERMEDI" not in (await A.text_content("#cPrev")).upper(), "texto ainda cita o intermediador"
            await go(V, f"#/proposta/{st['p_seller']}"); await must(V, "#cDraft .okbox")
            await V.click("#cancelC"); await V.click("#cancelC"); await must(V, "#genBtn")

        async with Step("22 Consultor só vê as propostas dele"):
            await go(V, "#/"); await must(V, ".tbl"); await V.click('.adm-top nav a[href="#/"]'); await must(V, '[data-view="all"].on')
            ids = await V.eval_on_selector_all(".tbl tbody tr[data-id]", "rs => rs.map(r => r.dataset.id)")
            assert st["p_admin"] not in ids, "consultor vê proposta que não é dele"
            assert st["p_admin_seller"] in ids, "consultor não vê a proposta atribuída a ele"
            s, _ = api("admin/settings", {"intro": "x"}, None, "PUT")
            assert s == 401

        async with Step("23 Pastas: criar, mover em lote, arrastar para a pasta"):
            await go(A, "#/"); await must(A, "#fNew")
            await A.click('[data-view="all"]')
            await A.click("#fNew"); await A.fill("#fNewName", f"{TAG} Pasta admin {STAMP[-4:]}"); await A.click("#fNewForm button[type=submit]")
            await must(A, ".sb-item.on[data-drop]")
            fid = await A.eval_on_selector(".sb-item.on[data-drop]", "e => e.dataset.view")
            created["folders"].append(fid)
            await A.click('[data-view="all"]'); await must(A, f'[data-sel="{st["p_admin"]}"]')
            await A.check(f'[data-sel="{st["p_admin"]}"]'); await A.check(f'[data-sel="{st["p_py"]}"]')
            await A.select_option("#bulkFolder", fid); await A.wait_for_timeout(900)
            await A.click(f'[data-view="{fid}"]'); await must(A, f'tr[data-id="{st["p_py"]}"]')
            await A.click('[data-view="all"]'); await must(A, f'tr[data-id="{st["p_admin_seller"]}"]')
            await A.drag_and_drop(f'tr[data-id="{st["p_admin_seller"]}"]', f'.sb-item[data-drop="{fid}"]'); await A.wait_for_timeout(900)
            await A.click(f'[data-view="{fid}"]'); await must(A, f'tr[data-id="{st["p_admin_seller"]}"]')
            await shot(A, "23-pastas")

        async with Step("24 Arquivar e desarquivar (lote e detalhe)"):
            await go(A, "#/"); await must(A, ".with-side"); await A.click('[data-view="all"]')
            await must(A, f'[data-sel="{st["p_admin"]}"]')
            await A.check(f'[data-sel="{st["p_admin"]}"]'); await A.click("[data-bulk=archive]"); await A.wait_for_timeout(900)
            assert not await A.query_selector(f'tr[data-id="{st["p_admin"]}"]'), "arquivada continua na lista"
            await A.click('[data-view="archived"]'); await must(A, f'tr[data-id="{st["p_admin"]}"]')
            await A.check(f'[data-sel="{st["p_admin"]}"]'); await A.click("[data-bulk=unarchive]"); await A.wait_for_timeout(900)
            await go(A, f"#/proposta/{st['p_py']}"); await must(A, "#archBtn"); await A.click("#archBtn"); await A.wait_for_timeout(900)
            await go(A, f"#/proposta/{st['p_py']}"); await must(A, "#archBtn")
            assert "Desarquivar" in await A.text_content("#archBtn"); await A.click("#archBtn"); await A.wait_for_timeout(700)

        async with Step("25 Excluir rascunho com confirmação na tela"):
            p_tmp = await new_proposal(A, f"{TAG} Para excluir", ["projeto-avulso"])
            await go(A, "#/"); await must(A, ".with-side"); await A.click('[data-view="all"]')
            await A.check(f'[data-sel="{p_tmp}"]'); await A.click("[data-bulk=delete]")
            await must(A, ".modal #mdYes"); await A.click("#mdYes"); await A.wait_for_timeout(1000)
            s_, d_ = api(f"admin/proposals/{p_tmp}", tok=TOKEN["admin"])
            assert s_ == 404, "rascunho não foi excluído"

        async with Step("26 Link aberto (se ligado) e página de contrato inexistente"):
            await C.goto(BASE + "/c/naoexiste123"); await must(C, ".state, h1")
            s, _ = api("public/proposal/aberta")
            if s == 200:
                await C.goto(BASE + "/p/aberta"); await must(C, "#orderForm")

        async with Step("26a Outra empresa não vê nada desta"):
            s_, d_ = api("admin/signup", {"name": "Outra Pessoa", "company": f"{TAG} Outra {STAMP[-5:]}", "email": f"e2e.outra.{STAMP}@exemplo.com", "password": "SenhaOutra123"})
            assert s_ == 200, d_
            t2 = d_["token"]
            s_, b2 = api("admin/bootstrap", tok=t2)
            assert s_ == 200 and not b2["proposals"] and not b2["catalog"] and not b2["users"], "outra empresa enxergou dados"
            s_, _ = api(f"admin/proposals/{st['p_admin']}", tok=t2)
            assert s_ == 404, f"outra empresa abriu a proposta ({s_})"
            s_, _ = api("admin/users", {"name": "Copia Consultor", "email": st["seller_email"]}, t2)
            assert s_ == 400, "e-mail de consultor repetido em outra empresa"
            s_, b1 = api("admin/bootstrap", tok=TOKEN["admin"])
            COMPANY["name"] = b1["company"]["name"]  # acompanha o nome salvo em Dados da empresa
            assert COMPANY["name"] == b1["settings"]["agency"]["name"], "nome da empresa não acompanhou Dados da empresa"
            s_, pb = api(f"public/proposal/{st['p_admin']}")
            assert s_ in (200, 410) and (s_ == 410 or (pb["agency"]["name"] == COMPANY["name"] and pb["agency"]["e"] == COMPANY["id"])), "link público com a marca errada"

        async with Step("26b Dono do sistema vê as empresas e entra no painel de uma"):
            await A.goto(BASE + "/entrar")
            await A.evaluate("localStorage.clear()")
            await A.reload()
            await must(A, "#em")
            assert not await A.query_selector('[data-mode="dono"]'), "o login das contas não deve mostrar o acesso do dono"
            await A.goto(BASE + "/dono")
            await A.evaluate("localStorage.clear()")
            await A.reload()
            await must(A, "#pw")
            assert not await A.query_selector("#em"), "o login do dono não pede e-mail"
            await A.fill("#pw", ADMIN_PW); await A.click("button[type=submit]")
            await must(A, "[data-enter]")
            await must(A, "#sSave")
            assert COMPANY["name"] in await A.text_content("main"), "empresa não aparece na lista do dono"
            await shot(A, "26b-painel-do-dono")
            await A.click(f'[data-enter="{COMPANY["id"]}"]')
            await must(A, "#suBack")
            await must(A, ".tiles")
            await A.click("#suBack"); await must(A, "[data-enter]")
            await A.click("#demoAcc")
            await A.wait_for_timeout(400)
            if await A.query_selector("#mdYes"):  # já existia: confirmar recriar
                await A.click("#mdYes")
            await must(A, "#supOut .okbox", 30000)
            await shot(A, "26b-conta-de-teste")
            s_, d_ = api("admin/login", {"email": "conta.teste@example.com", "password": "teste1234"})
            assert s_ == 200, d_
            s_, b_ = api("admin/bootstrap", tok=d_["token"])
            assert len(b_["proposals"]) == 5, f"conta de teste com {len(b_['proposals'])} propostas"
            await admin_login(A)

        async with Step("26c Tema claro e escuro: painel e página do cliente"):
            # o painel abre no tema claro; o botão troca para o escuro e o navegador lembra a escolha
            await go(A, "#/"); await must(A, "#themeBtn")
            assert await A.evaluate("document.documentElement.dataset.theme") == "claro", "o painel não abriu no tema claro"
            await shot(A, "26c-painel-tema-claro", full=False)
            await A.click("#themeBtn"); await A.wait_for_timeout(300)
            assert not await A.evaluate("document.documentElement.dataset.theme"), "o painel não trocou para o tema escuro"
            await A.reload(); await must(A, "#themeBtn")
            assert not await A.evaluate("document.documentElement.dataset.theme"), "o painel não lembrou o tema escuro"
            await shot(A, "26c-painel-tema-escuro", full=False)
            # página do cliente no tema claro
            await go(A, "#/pagina"); await must(A, "#pageSave")
            await A.click('.seg label:has-text("Claro")'); await A.click("#pageSave"); await A.wait_for_timeout(900)
            await C.goto(st["c_url"]); await must(C, ".paper")
            assert await C.evaluate("document.documentElement.dataset.theme") == "claro", "o contrato não abriu no tema claro"
            # o papel do contrato segue claro com texto escuro
            lum = await C.evaluate("""() => { const c = document.createElement('canvas').getContext('2d'); const L = (v) => { c.fillStyle = '#000'; c.fillStyle = v; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; return (r + g + b) / 3; }; const s = getComputedStyle(document.querySelector('.paper')); return [L(s.color), L(s.backgroundColor)]; }""")
            assert lum[0] + 80 < lum[1], f"texto do contrato sem contraste no tema claro: {lum}"
            await shot(C, "26c-contrato-tema-claro")
            # volta tudo para o escuro
            await go(A, "#/pagina"); await must(A, "#pageSave")
            await A.click('.seg label:has-text("Escuro")'); await A.click("#pageSave"); await A.wait_for_timeout(900)
            await A.click("#themeBtn"); await A.wait_for_timeout(300)
            assert await A.evaluate("document.documentElement.dataset.theme") == "claro", "o painel não voltou ao tema claro"

        async with Step("27 Modelo de teste: criar e conferir as cinco etapas"):
            await go(A, "#/config"); await must(A, "#demoMake")
            await A.click("#demoMake"); await must(A, "#demoOut .okbox", 20000)
            await shot(A, "27-modelo-de-teste")
            s, d = api("admin/bootstrap", tok=TOKEN["admin"])
            demo = [p for p in d["proposals"] if p["client"]["name"].startswith(("1. Teste", "2. Teste", "3. Teste", "4. Teste", "5. Teste"))]
            assert len(demo) == 5, f"modelo criou {len(demo)} propostas"
            for p in demo:
                s1, _ = api(f"public/proposal/{p['id']}?preview=1")
                assert s1 == 200, f"proposta {p['client']['name']} não abre"
                if p.get("contract") and p["contract"]["status"] != "rascunho":
                    s2, pdf = api(f"public/contract/{p['contract']['id']}/pdf")
                    assert s2 == 200 and pdf[:4] == b"%PDF", f"PDF do {p['client']['name']}"

        async with Step("28 Celular: proposta, contrato e painel sem erros"):
            M = await br.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); watch(M, "celular")
            await M.goto(f"{BASE}/p/{st['p_admin_seller']}"); await must(M, "#pedido")
            await shot(M, "28-celular-proposta")
            await M.goto(f"{BASE}/c/{st['c_admin_seller']}"); await must(M, "#sigs")
            await M.goto(BASE + "/admin"); await M.evaluate("localStorage.clear()"); await M.reload(); await must(M, "#pw")

        async with Step("29 Baixar arquivo .zip da proposta assinada"):
            import io, zipfile
            req = urllib.request.Request(f"{BASE}/api/admin/proposals/{st['p_admin_seller']}/archive", headers={"authorization": "Bearer " + TOKEN["admin"]})
            data = urllib.request.urlopen(req).read()
            z = zipfile.ZipFile(io.BytesIO(data)); names = z.namelist()
            (OUT / "29-arquivo.zip").write_bytes(data)
            assert any(n.startswith("proposta-") and n.endswith(".pdf") for n in names), names
            assert any(n.startswith("contrato-") and "assinado" in n for n in names), names
            assert sum(1 for n in names if n.startswith("assinaturas/")) == 3, names
            assert "dados.json" in names and "LEIA-ME.txt" in names, names
            await go(A, f"#/proposta/{st['p_admin_seller']}"); await must(A, "#zipBtn")

        async with Step("30 Excluir contrato assinado com confirmação na tela"):
            await go(A, f"#/proposta/{st['p_admin']}"); await must(A, "#delBtn")
            await A.click("#delBtn"); await must(A, ".modal #mdChk")
            assert await A.is_disabled("#mdYes"), "botão de excluir liberado sem confirmar"
            await A.wait_for_timeout(400); await shot(A, "30-confirmar-exclusao", full=False)
            await A.check("#mdChk"); await A.click("#mdYes"); await A.wait_for_timeout(1200)
            s_, _ = api(f"admin/proposals/{st['p_admin']}", tok=TOKEN["admin"])
            assert s_ == 404, "proposta assinada não foi excluída"
            s_, _ = api(f"public/contract/{st['c_admin']}")
            assert s_ == 404, "contrato continua acessível"

        async with Step("31 WhatsApp automático em cada etapa (modo de teste)"):
            s_, d_ = api("admin/__wa", tok=TOKEN["admin"])
            if s_ == 200:
                msgs = d_["sent"]
                txt = "\n".join(m["message"] for m in msgs)
                for frag in ("Recebemos o seu pedido", "Recibimos tu pedido", "Falta só a sua assinatura", "foi assinado por todas as partes", "Novo pedido na proposta", "assinou como intermediador", "Contrato nº"):
                    assert frag in txt, f"faltou mensagem: {frag}"
                assert all(m["to"].isdigit() and len(m["to"]) >= 12 for m in msgs), "número em formato inválido"
                print(f"  {len(msgs)} mensagens de WhatsApp registradas")
            else:
                print("  WhatsApp de teste desligado (rode o servidor com WA_TEST=1)")

        async with Step("32 Despublicar e publicar a proposta"):
            pid = await new_proposal(A, f"{TAG} Publicação", ["projeto-avulso"])
            s_, _ = api(f"public/proposal/{pid}"); assert s_ == 200
            await A.click("#pubBtn"); await must(A, ".modal #mdYes"); await A.click("#mdYes"); await must(A, ".warnbox #pubBtn2")
            s_, d_ = api(f"public/proposal/{pid}"); assert s_ == 410 and d_.get("offline"), "proposta despublicada continua no ar"
            await C.goto(f"{BASE}/p/{pid}"); await must(C, ".state, h1")
            assert "indisponível" in (await C.text_content("body")).lower(), "cliente não vê o aviso de indisponível"
            await shot(C, "32-proposta-indisponivel", full=False)
            prev = await A.get_attribute('a[href*="preview=1"]', "href")
            s_, _ = api(prev.lstrip("/").replace("p/", "public/proposal/", 1)); assert s_ == 200, "prévia do admin não abre fora do ar"
            await A.click("#pubBtn"); await must(A, "#pubBtn:has-text('Despublicar')")
            s_, _ = api(f"public/proposal/{pid}"); assert s_ == 200, "não voltou ao ar"

        async with Step("33 Vencida sai do ar sozinha e o admin publica com nova validade"):
            await go(A, f"#/proposta/{pid}/editar"); await must(A, "#edSave")
            await A.fill('[data-k="validUntil"]', "2026-01-10"); await A.click("#edSave"); await must(A, ".share")
            s_, _ = api(f"public/proposal/{pid}"); assert s_ == 410, "proposta vencida continua no ar"
            await must(A, "#pubBtn:has-text('Publicar')")
            await A.click("#pubBtn"); await must(A, ".modal #mdDate")
            await A.wait_for_timeout(300); await shot(A, "33-publicar-de-novo", full=False)
            await A.click("#mdYes"); await must(A, "#pubBtn:has-text('Despublicar')")
            s_, _ = api(f"public/proposal/{pid}"); assert s_ == 200, "não voltou ao ar com a nova validade"
            api("admin/proposals/bulk", {"action": "delete", "ids": [pid]}, TOKEN["admin"])

        await br.close()


TOKEN = {}
COMPANY = {}


def cleanup():
    if KEEP:
        return
    t = TOKEN.get("admin")
    if not t:
        return
    for pid in created["proposals"]:
        api("admin/proposals/bulk", {"action": "delete", "ids": [pid]}, t)
    for fid in created["folders"]:
        api(f"admin/folders/{fid}", None, t, "DELETE")


if __name__ == "__main__":
    s, d = api("admin/login", {"password": ADMIN_PW})
    if s != 200:
        sys.exit(f"Não entrou como dono do sistema em {BASE} (confira ADMIN_PASSWORD): {d}")
    t0 = time.time()
    asyncio.run(main())
    cleanup()
    ok = sum(1 for r in results if r[1])
    lines = [f"# Relatório do pente fino · {time.strftime('%d/%m/%Y %H:%M')}", "", f"Endereço: {BASE}", f"Resultado: **{ok} de {len(results)} etapas ok** em {time.time() - t0:.0f}s", "",
             "| Etapa | Situação | Tempo | Detalhe |", "|---|---|---|---|"]
    lines += [f"| {n} | {'ok' if o else 'FALHOU'} | {tm} | {det.replace('|', '/')} |" for n, o, tm, det in results]
    lines += ["", "## Erros vistos nas páginas", ""] + ([f"- {p}" for p in dict.fromkeys(problems)] or ["Nenhum."])
    (OUT / "relatorio.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    sys.exit(0 if ok == len(results) and not problems else 1)
