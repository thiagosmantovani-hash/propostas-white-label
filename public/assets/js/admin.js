/* Painel: propostas, pedidos, contratos, consultores, catálogo e dados da empresa */
(function () {
  "use strict";
  const { $, $$, esc } = R;
  const app = $("#app");
  // /dono: login exclusivo do dono do sistema; /entrar e /admin: login das contas
  const DONO = /^\/dono\/?$/.test(location.pathname);
  const S = { token: R.store.get("adm", ""), data: null, filter: "todas", q: "", seller: "", edit: null, cat: null, catOpen: null, catLang: "pt", detail: null, padAgency: null, padInter: null, padCfg: null, padMe: null, showText: false, loginAs: R.store.get("admAs", "admin"), userOpen: null, newPw: null };
  const ST = { rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", pedido: "Pedido recebido", contrato: "Aguardando assinatura", assinada: "Assinada", recusada: "Recusada", vencida: "Vencida" };
  const LANG = { pt: "Português", es: "Espanhol", en: "Inglês" };
  const stKey = (p) => (p.expired ? "vencida" : p.status);
  const stPill = (p) => `<span class="st ${stKey(p)}">${ST[stKey(p)] || p.status}</span>`;
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const origin = location.origin;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isAdm = () => S.data && S.data.role === "admin";
  const me = () => S.data && S.data.me;
  const mny = (n, cur = "BRL") => { const v = Number(n) || 0; const dec = cur === "PYG" ? 0 : v % 1 ? 2 : 0; return v.toLocaleString("pt-BR", { style: "currency", currency: cur, minimumFractionDigits: dec, maximumFractionDigits: dec }); };
  const brl = (n) => mny(n, "BRL");
  const fillSch = (o, cur) => { const n = Number(o.n) || 0, parc = n ? (Number(o.total) - Number(o.upfront)) / n : 0; return String(o.schedule || "").replace(/\{(total|entrada|parcela|n)\}/g, (m, k) => (k === "n" ? String(n) : mny(k === "total" ? o.total : k === "entrada" ? o.upfront : parc, cur))); };
  const isBRp = (p) => !p.country || p.country === "BR";
  const countryName = (code) => ((S.data.countries || []).find((c) => c[0] === code) || [code, code])[1];
  const docFmt = (d, br) => (br ? R.maskDoc(d || "") : d || "");

  /* ---------- API ---------- */
  async function api(path, opts = {}) {
    const r = await fetch("/api/admin/" + path, { ...opts, headers: { "content-type": "application/json", authorization: "Bearer " + S.token, ...(opts.headers || {}) } });
    let d = null;
    try { d = await r.json(); } catch (e) {}
    if (r.status === 401) { const msg = (d && d.error) || "Sessão expirada. Entre de novo."; logout(msg); throw new Error(msg); }
    if (!r.ok) throw new Error((d && d.error) || "Não foi possível falar com o servidor.");
    return d;
  }
  const post = (p, body) => api(p, { method: "POST", body: JSON.stringify(body || {}) });
  const put = (p, body) => api(p, { method: "PUT", body: JSON.stringify(body || {}) });
  async function reload() {
    S.data = await api("bootstrap");
    if (S.data.role === "super") return;
    const st = S.data.settings;
    R.store.set("empresa", S.data.company.id);
    R.setBrand({ ...st.agency, e: S.data.company.id, whatsapp: st.whatsapp, logos: (st.brand && st.brand.logos) || {} });
  }
  function logout(msg) { if (DONO) { S.token = ""; S.data = null; R.store.set("adm", ""); R.store.set("admSuper", ""); R.store.set("empresa", ""); R.setBrand({}); history.replaceState(null, "", "/dono"); return login("dono", typeof msg === "string" ? msg : ""); } S.token = ""; S.data = null; R.store.set("adm", ""); R.store.set("admSuper", ""); R.store.set("empresa", ""); R.setBrand({}); if (location.hash && !/^#\/?$/.test(location.hash)) history.replaceState(null, "", "#/"); login("entrar", typeof msg === "string" ? msg : ""); }

  async function copy(text, ok = "Link copiado.") {
    try { await navigator.clipboard.writeText(text); R.toast(ok); }
    catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); R.toast(ok); } catch (x) { R.toast("Selecione e copie o texto."); } t.remove(); }
  }
  function armed(btn, label = "Clique de novo para confirmar") {
    if (btn.dataset.armed) return true;
    const old = btn.innerHTML; btn.dataset.armed = "1"; btn.textContent = label; btn.classList.add("danger");
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = old; btn.classList.remove("danger"); } }, 3500);
    return false;
  }
  const busy = (btn, on, txt) => { if (!btn) return; if (on) { btn.dataset.t = btn.innerHTML; btn.classList.add("is-busy"); if (txt) btn.textContent = txt; } else { btn.classList.remove("is-busy"); if (btn.dataset.t) btn.innerHTML = btn.dataset.t; } };
  const waLink = (phone, text) => { let d = R.digits(phone); if (d && d.length <= 11) d = "55" + d; return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; };

  // janela de confirmação na tela (para ações que não podem ser desfeitas)
  function confirmModal({ title, html, confirm = "Confirmar", check, extra, getValue, tone = "danger", eyebrow = "Atenção" }) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal-bg";
      wrap.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mdT"><span class="label" style="color:var(--accent-soft)">${eyebrow}</span><h2 id="mdT">${title}</h2><div class="md-body">${html}</div>${check ? `<label class="check"><input type="checkbox" id="mdChk"><span>${check}</span></label>` : ""}<div class="row-acts">${extra ? `<button type="button" class="pill pill-cream" id="mdExtra">${extra.label}</button>` : ""}<span style="flex:1"></span><button type="button" class="pill pill-line" id="mdNo">Cancelar</button><button type="button" class="pill ${tone === "danger" ? "pill-danger" : "pill-green"}" id="mdYes"${check ? " disabled" : ""}>${confirm}</button></div></div>`;
      document.body.appendChild(wrap);
      const done = (v) => { wrap.remove(); document.removeEventListener("keydown", esc_); resolve(v); };
      const esc_ = (e) => { if (e.key === "Escape") done(false); };
      document.addEventListener("keydown", esc_);
      wrap.addEventListener("click", (e) => { if (e.target === wrap) done(false); });
      $("#mdNo", wrap).addEventListener("click", () => done(false));
      $("#mdYes", wrap).addEventListener("click", () => done(getValue ? getValue(wrap) : true));
      const ck = $("#mdChk", wrap); if (ck) ck.addEventListener("change", () => ($("#mdYes", wrap).disabled = !ck.checked));
      if (extra) $("#mdExtra", wrap).addEventListener("click", extra.onClick);
      $("#mdNo", wrap).focus();
    });
  }
  async function downloadZip(pid, btn) {
    busy(btn, true, "Gerando…");
    try {
      const r = await fetch(`/api/admin/proposals/${pid}/archive`, { headers: { authorization: "Bearer " + S.token } });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Não foi possível gerar o arquivo."); }
      const name = ((r.headers.get("content-disposition") || "").match(/filename="([^"]+)"/) || [])[1] || `proposta-${pid}.zip`;
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      R.toast("Arquivo .zip baixado.");
    } catch (e) { R.toast(e.message); }
    busy(btn, false);
  }

  /* ---------- entrar, criar conta e nova senha ---------- */
  // modos: entrar | criar | esqueci | dono (dono do sistema) | nova (link de nova senha)
  function login(mode, msg) {
    mode = mode || "entrar";
    const resetTok = mode === "nova" ? (location.hash.match(/^#\/nova-senha\/([\w-]+)/) || [])[1] || "" : "";
    const tabs = mode === "entrar" || mode === "criar";
    const H = {
      entrar: ["Acesso ao painel", "Entrar"],
      criar: ["Comece agora", "Criar conta"],
      esqueci: ["Esqueci minha senha", "Nova senha"],
      dono: ["Dono do sistema", "Painel do dono"],
      nova: ["Nova senha", "Criar nova senha"],
    }[mode] || ["", ""];
    const fld = (id, label, type, ac, extra = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" autocomplete="${ac}" required${extra}></div>`;
    const body = {
      entrar: fld("em", "E-mail", "email", "username") + fld("pw", "Senha", "password", "current-password"),
      criar: fld("nm", "Seu nome", "text", "name", ' maxlength="120"') + fld("co", "Nome da empresa (ou o seu, se for freelancer)", "text", "organization", ' maxlength="120"') + fld("em", "E-mail", "email", "username") + fld("pw", "Senha (mínimo 8 caracteres)", "password", "new-password", ' minlength="8"') +
        '<div style="position:absolute;left:-9999px" aria-hidden="true"><label>Site <input id="ws" tabindex="-1" autocomplete="off"></label></div>',
      esqueci: '<p class="muted small" style="margin:0">Informe o e-mail de acesso. Se ele estiver cadastrado, você recebe um link para criar uma senha nova.</p>' + fld("em", "E-mail", "email", "username"),
      dono: fld("pw", "Senha do dono do sistema", "password", "current-password"),
      nova: fld("pw", "Nova senha (mínimo 8 caracteres)", "password", "new-password", ' minlength="8"'),
    }[mode];
    const btn = { entrar: "Entrar", criar: "Criar minha conta", esqueci: "Enviar link", dono: "Entrar", nova: "Salvar e entrar" }[mode];
    const foot = {
      entrar: '<p class="muted small" style="margin:0"><button type="button" class="link-btn" data-mode="esqueci">Esqueci minha senha</button></p>',
      criar: '<p class="muted small" style="margin:0">Cada conta tem o seu próprio painel: propostas, contratos, clientes e equipe só da sua empresa.</p>',
      esqueci: '<p class="muted small" style="margin:0"><button type="button" class="link-btn" data-mode="entrar">Voltar para Entrar</button></p>',
      dono: '<p class="muted small" style="margin:0">Acesso exclusivo do dono do sistema.</p>',
      nova: '<p class="muted small" style="margin:0"><button type="button" class="link-btn" data-mode="entrar">Voltar para Entrar</button></p>',
    }[mode];
    app.innerHTML = `<section class="login">
      <form id="loginForm" novalidate><div id="loginLogo"><span class="wordmark">Propostas</span></div>
        <div><span class="label" style="color:var(--primary-glow)">${H[0]}</span><h1 style="margin-top:10px">${H[1]}</h1></div>
        ${tabs ? `<div class="seg" role="tablist" aria-label="Entrar ou criar conta"><button type="button" role="tab" data-mode="entrar" aria-selected="${mode === "entrar"}" class="${mode === "entrar" ? "on" : ""}">Entrar</button><button type="button" role="tab" data-mode="criar" aria-selected="${mode === "criar"}" class="${mode === "criar" ? "on" : ""}">Criar conta</button></div>` : ""}
        ${body}
        <p class="form-msg" id="lmsg" role="alert" style="margin:0">${esc(msg || "")}</p>
        <button class="pill pill-green pill-lg" type="submit">${btn}</button>
        ${foot}
        </form></section>`;
    // nome do sistema e cadastro aberto/fechado (painel do dono)
    R.api("public/system").then((y) => {
      const l = $("#loginLogo"); if (l) l.innerHTML = `<span class="wordmark">${esc(y.productName)}</span>`;
      if (!y.signupOpen) { const t = $('[data-mode="criar"]'); if (t) t.remove(); if (mode === "criar") login("entrar", "O cadastro de novas contas está fechado no momento."); }
    }).catch(() => {});
    const f0 = $("#loginForm input:not([tabindex='-1'])"); if (f0) f0.focus();
    $$("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (mode === "nova") history.replaceState(null, "", "#/"); login(b.dataset.mode); }));
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = e.target.querySelector("button[type=submit]");
      const val = (id) => ($("#" + id) ? $("#" + id).value.trim() : "");
      const pw = $("#pw") ? $("#pw").value : "";
      const out = $("#lmsg");
      let path, payload;
      if (mode === "entrar") { path = "login"; payload = { email: val("em"), password: pw }; if (!payload.email) { out.textContent = "Informe o e-mail."; return; } }
      else if (mode === "dono") { path = "login"; payload = { password: pw }; }
      else if (mode === "criar") {
        path = "signup"; payload = { name: val("nm"), company: val("co"), email: val("em"), password: pw, website: val("ws") };
        if (payload.name.length < 3) { out.textContent = "Informe o seu nome."; return; }
        if (payload.company.length < 2) { out.textContent = "Informe o nome da empresa."; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) { out.textContent = "Informe um e-mail válido."; return; }
        if (pw.length < 8) { out.textContent = "A senha precisa de pelo menos 8 caracteres."; return; }
      } else if (mode === "esqueci") { path = "forgot"; payload = { email: val("em") }; }
      else { path = "reset"; payload = { token: resetTok, password: pw }; if (pw.length < 8) { out.textContent = "A senha precisa de pelo menos 8 caracteres."; return; } }
      busy(b, true, "Aguarde…");
      try {
        const r = await fetch("/api/admin/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Não foi possível concluir agora.");
        if (mode === "esqueci") {
          busy(b, false);
          out.className = "form-msg ok";
          out.textContent = d.emailEnabled === false ? "O envio de e-mail ainda não está ativo no sistema. Fale com o suporte para receber uma senha nova." : "Pronto. Se o e-mail estiver cadastrado, o link chega em alguns minutos (confira também o spam).";
          return;
        }
        S.token = d.token; R.store.set("adm", d.token); R.store.set("admSuper", "");
        R.store.set("empresa", d.company || "");
        if (mode === "nova" || mode === "criar") history.replaceState(null, "", mode === "criar" ? "#/empresa" : "#/");
        await start();
        if (mode === "criar") R.toast("Conta criada. Comece pelos dados da sua empresa.");
      } catch (err) { out.className = "form-msg"; out.textContent = err.message; busy(b, false); }
    });
  }

  /* ---------- painel do dono do sistema ---------- */
  // visão geral, configurações do sistema e ações rápidas vêm antes da lista de contas
  function superPanel() {
    const D = S.data, sys = D.system, st = D.stats;
    const cs = D.companies || [];
    const q = (S.supQ || "").trim().toLowerCase();
    const f = S.supF || "todas";
    const rows = cs.filter((c) => (f === "ativas" ? !c.blocked : f === "bloqueadas" ? c.blocked : true)).filter((c) => !q || `${c.name} ${c.owner.name} ${c.owner.email} ${c.note}`.toLowerCase().includes(q));
    const dt = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "nunca");
    const host = location.host;
    const lim = (c) => (c.maxSellers ? `${c.sellers} de ${c.maxSellers}` : `${c.sellers}`);
    app.innerHTML = `<header class="adm-top wrap"><div class="inner">
        <a class="brand" href="/dono"><span class="wordmark">${esc(sys.productName)}</span></a><span class="tag">Painel do dono</span>
        <nav><a class="pill pill-line" href="#sup-cfg">Configurações</a><a class="pill pill-line" href="#sup-contas">Contas</a><button class="pill pill-line" type="button" id="logout">Sair</button></nav>
      </div></header><main class="adm-main wrap"><div class="inner">
      <div class="pgh"><div><span class="label">Dono do sistema</span><h1>Painel do dono</h1><p class="sub">Controle o sistema todo: regras para as contas novas, avisos, cadastro aberto ou fechado e cada conta cadastrada.</p></div>
        <div class="acts"><button type="button" class="pill pill-green pill-lg" id="supNewBtn">Criar conta</button></div></div>
      <div class="tiles" style="margin-bottom:24px">
        <div class="tile"><span>Contas</span><b>${st.companies}</b><small>${st.active} ativas · ${st.blocked} bloqueadas</small></div>
        <div class="tile"><span>Novas em 7 dias</span><b>${st.new7}</b><small>${st.active7} entraram nos últimos 7 dias</small></div>
        <div class="tile"><span>Propostas</span><b>${st.proposals}</b><small>somando todas as contas</small></div>
        <div class="tile"><span>Contratos</span><b>${st.contracts}</b><small>gerados em todas as contas</small></div>
      </div>
      <div id="supOut"></div>
      <div class="cols" id="sup-cfg">
        <div class="stack">
          <div class="card"><h2>Configurações do sistema</h2>
            <label class="fl"><span>Nome do sistema (aparece no login e neste painel)</span><input class="inp" id="sName" maxlength="60" value="${esc(sys.productName)}"></label>
            <label class="check"><input type="checkbox" id="sOpen"${sys.signupOpen !== false ? " checked" : ""}${D.signupEnvClosed ? " disabled" : ""}><span>Cadastro aberto: qualquer pessoa pode criar conta pela página de divulgação${D.signupEnvClosed ? " (fechado pela variável SIGNUP_CLOSED no Netlify)" : ""}</span></label>
            <div class="grid2">
              <label class="fl"><span>Consultores por conta (0 = sem limite)</span><input class="inp" id="sMax" type="number" min="0" max="500" value="${esc(sys.defaultMaxSellers)}"></label>
              <label class="fl"><span>Validade das propostas nas contas novas (dias)</span><input class="inp" id="sDays" type="number" min="1" max="365" value="${esc(sys.defaultValidityDays)}"></label>
            </div>
            <label class="fl"><span>Aviso para todas as contas (aparece no topo do painel delas; deixe vazio para não mostrar)</span><textarea class="inp" id="sNotice" rows="2" maxlength="400">${esc(sys.notice || "")}</textarea></label>
            <div class="row-acts"><button type="button" class="pill pill-green" id="sSave">Salvar configurações</button></div>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h2>Links</h2>
            <p class="muted small" style="margin:0">Página de divulgação e cadastro</p><div class="linkbox"><input class="inp" readonly value="${location.protocol}//${esc(host)}/"><button type="button" class="pill pill-cream" data-copy="${location.protocol}//${esc(host)}/">Copiar</button></div>
            <p class="muted small" style="margin:0">Login das contas (empresas e consultores)</p><div class="linkbox"><input class="inp" readonly value="${location.protocol}//${esc(host)}/entrar"><button type="button" class="pill pill-cream" data-copy="${location.protocol}//${esc(host)}/entrar">Copiar</button></div>
            <p class="muted small" style="margin:0">Login do dono (só você)</p><div class="linkbox"><input class="inp" readonly value="${location.protocol}//${esc(host)}/dono"><button type="button" class="pill pill-cream" data-copy="${location.protocol}//${esc(host)}/dono">Copiar</button></div>
          </div>
          <div class="card"><h2>Conta modelo de teste</h2>
            <p class="muted small" style="margin:0">Conta pronta para quem for testar: dados da empresa, catálogo de exemplo, um consultor e cinco propostas, uma em cada etapa. Entre em /entrar com:</p>
            <p style="margin:0">E-mail <code class="pw">${esc(D.demoEmail)}</code> · senha <code class="pw">${esc(D.demoPassword)}</code></p>
            <div class="row-acts"><button type="button" class="pill pill-cream" id="demoAcc">${cs.some((c) => c.demo) ? "Recriar do zero" : "Criar conta de teste"}</button></div>
          </div>
          <div class="card"><h2>Situação do sistema</h2>
            <p class="small" style="margin:0">E-mail automático: <b>${D.emailEnabled ? "ativo" : "desligado"}</b>${D.emailEnabled ? "" : " (sem ele, “Esqueci minha senha” não envia o link; use Nova senha na conta)"}</p>
            <p class="small" style="margin:0">WhatsApp automático: <b>${D.waEnabled ? "ativo" : "desligado"}</b></p>
          </div>
        </div>
      </div>
      <div class="pgh" id="sup-contas" style="margin-top:32px"><div><span class="label">Contas</span><h2 style="margin:6px 0 0">Contas cadastradas</h2></div></div>
      <div class="row-acts" style="margin-bottom:12px;flex-wrap:wrap"><input class="inp" id="supQ" placeholder="Buscar por empresa, responsável, e-mail ou anotação" value="${esc(S.supQ || "")}" style="flex:1;min-width:220px">
        ${[["todas", "Todas"], ["ativas", "Ativas"], ["bloqueadas", "Bloqueadas"]].map(([k, t]) => `<button type="button" class="pill ${f === k ? "on" : "pill-line"} pill-sm" data-supf="${k}">${t}</button>`).join("")}</div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Conta</th><th>Responsável</th><th>Criada</th><th>Último acesso</th><th>Propostas</th><th>Consultores</th><th>Situação</th><th class="r">Ações</th></tr></thead><tbody>
        ${rows.map((c) => `<tr><td><b>${esc(c.name)}</b>${c.demo ? ' <span class="muted small">(teste)</span>' : ""}${c.note ? `<br><span class="muted small">${esc(c.note)}</span>` : ""}</td><td>${esc(c.owner.name)}<br><span class="muted small">${esc(c.owner.email)}</span></td><td>${dt(c.createdAt)}<br><span class="muted small">${c.createdBy === "dono" ? "por você" : "cadastro"}</span></td><td>${dt(c.lastLoginAt)}</td><td>${c.proposals}</td><td>${lim(c)}</td><td><span class="st ${c.blocked ? "recusada" : "assinada"}">${c.blocked ? "Bloqueada" : "Ativa"}</span></td>
          <td class="r"><div class="row-acts" style="justify-content:flex-end;flex-wrap:wrap"><button type="button" class="pill pill-green pill-sm" data-enter="${esc(c.id)}">Entrar</button><button type="button" class="pill pill-line pill-sm" data-edit="${esc(c.id)}">Editar</button><button type="button" class="pill pill-line pill-sm" data-reset="${esc(c.id)}">Nova senha</button><button type="button" class="pill ${c.blocked ? "pill-cream" : "pill-line"} pill-sm" data-block="${esc(c.id)}" data-on="${c.blocked ? 0 : 1}">${c.blocked ? "Liberar" : "Bloquear"}</button><button type="button" class="pill pill-line pill-sm" data-del="${esc(c.id)}">Excluir</button></div></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="card"><div class="empty"><b>${cs.length ? "Nenhuma conta com esse filtro" : "Nenhuma conta ainda"}</b><span>${cs.length ? "Mude a busca ou o filtro." : "Quando alguém criar a conta pela página de divulgação, ela aparece aqui. Você também pode criar em Criar conta."}</span></div></div>`}
      </div></main>`;
    $("#logout").addEventListener("click", () => logout());
    const byId = (id) => cs.find((c) => c.id === id) || {};
    const out = (html) => { $("#supOut").innerHTML = html; $("#supOut").scrollIntoView({ behavior: "smooth", block: "center" }); };
    const refresh = async (msg) => { await reload(); superPanel(); if (msg) R.toast(msg); };
    $$("[data-copy]").forEach((b) => b.addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy); R.toast("Link copiado."); }));
    $("#supQ").addEventListener("input", (e) => { S.supQ = e.target.value; const pos = e.target.selectionStart; superPanel(); const i = $("#supQ"); i.focus(); i.setSelectionRange(pos, pos); });
    $$("[data-supf]").forEach((b) => b.addEventListener("click", () => { S.supF = b.dataset.supf; superPanel(); }));
    $("#sSave").addEventListener("click", async (e) => {
      busy(e.currentTarget, true, "Salvando…");
      try { await put("system", { productName: $("#sName").value.trim(), signupOpen: $("#sOpen").checked, defaultMaxSellers: $("#sMax").value, defaultValidityDays: $("#sDays").value, notice: $("#sNotice").value.trim() }); await refresh("Configurações salvas."); }
      catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
    $("#demoAcc").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (cs.some((c) => c.demo) && !(await confirmModal({ title: "Recriar a conta de teste?", html: "<p>Tudo o que foi feito na conta de teste é apagado e ela volta ao modelo inicial. O login continua o mesmo.</p>", confirm: "Recriar" }))) return;
      busy(btn, true, "Criando…");
      try { const r = await post("demo-account"); await refresh("Conta de teste pronta."); out(`<div class="okbox"><span>Conta de teste pronta. Entre em <b>/entrar</b> com <code class="pw">${esc(r.email)}</code> e a senha <code class="pw">${esc(r.password)}</code>.</span></div>`); }
      catch (err) { R.toast(err.message); busy(btn, false); }
    });
    $("#supNewBtn").addEventListener("click", async () => {
      const v = await confirmModal({ eyebrow: "Nova conta", title: "Criar conta", tone: "green", confirm: "Criar conta",
        html: `<p class="muted small">A senha é gerada e aparece aqui para você enviar ao responsável. Ele pode trocar depois em Minha conta.</p>
          <label class="fl"><span>Nome do responsável</span><input class="inp" id="nwName"></label>
          <label class="fl"><span>Nome da empresa</span><input class="inp" id="nwCo"></label>
          <label class="fl"><span>E-mail de acesso</span><input class="inp" id="nwEm" type="email"></label>
          <label class="fl"><span>Anotação interna (só você vê)</span><input class="inp" id="nwNote" maxlength="400"></label>`,
        getValue: (w) => ({ name: $("#nwName", w).value.trim(), company: $("#nwCo", w).value.trim(), email: $("#nwEm", w).value.trim(), note: $("#nwNote", w).value.trim() }) });
      if (!v) return;
      try { const r = await post("companies", v); await refresh("Conta criada."); out(`<div class="okbox"><span>Conta <b>${esc(r.company.name)}</b> criada. Login em /entrar com <code class="pw">${esc(r.company.owner.email)}</code> e a senha <code class="pw">${esc(r.password)}</code>.</span></div>`); }
      catch (err) { R.toast(err.message); }
    });
    $$("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
      const c = byId(b.dataset.edit);
      const v = await confirmModal({ eyebrow: "Conta", title: "Editar " + esc(c.name), tone: "green", confirm: "Salvar",
        html: `<label class="fl"><span>Nome da empresa</span><input class="inp" id="edCo" value="${esc(c.name)}"></label>
          <label class="fl"><span>Nome do responsável</span><input class="inp" id="edName" value="${esc(c.owner.name)}"></label>
          <label class="fl"><span>E-mail de acesso do responsável</span><input class="inp" id="edEm" type="email" value="${esc(c.owner.email)}"></label>
          <label class="fl"><span>Limite de consultores (vazio = padrão do sistema; 0 = sem limite)</span><input class="inp" id="edMax" type="number" min="0" max="500" value="${c.maxSellersOwn != null ? esc(c.maxSellersOwn) : ""}"></label>
          <label class="fl"><span>Anotação interna (só você vê)</span><input class="inp" id="edNote" maxlength="400" value="${esc(c.note || "")}"></label>`,
        getValue: (w) => ({ company: $("#edCo", w).value.trim(), ownerName: $("#edName", w).value.trim(), ownerEmail: $("#edEm", w).value.trim(), maxSellers: $("#edMax", w).value === "" ? null : $("#edMax", w).value, note: $("#edNote", w).value.trim() }) });
      if (!v) return;
      try { await put(`companies/${c.id}`, v); await refresh("Conta atualizada."); } catch (err) { R.toast(err.message); }
    }));
    $$("[data-enter]").forEach((b) => b.addEventListener("click", async () => {
      busy(b, true, "Entrando…");
      try { const r = await post(`companies/${b.dataset.enter}/enter`); R.store.set("admSuper", S.token); S.token = r.token; R.store.set("adm", r.token); R.store.set("empresa", r.company); location.hash = "#/"; await start(); }
      catch (e) { R.toast(e.message); busy(b, false); }
    }));
    $$("[data-reset]").forEach((b) => b.addEventListener("click", async () => {
      const c = byId(b.dataset.reset);
      const ok = await confirmModal({ title: "Gerar nova senha?", html: `<p>A senha atual de <b>${esc(c.name)}</b> deixa de valer e a nova aparece aqui para você enviar ao responsável.</p>`, confirm: "Gerar nova senha", tone: "green" });
      if (!ok) return;
      busy(b, true, "Gerando…");
      try { const r = await post(`companies/${c.id}/reset`); out(`<div class="okbox"><span>Nova senha de <b>${esc(c.name)}</b> (${esc(r.company.owner.email)}): <code class="pw">${esc(r.password)}</code>. Envie para o responsável; a senha antiga deixou de valer.</span></div>`); }
      catch (e) { R.toast(e.message); }
      busy(b, false);
    }));
    $$("[data-block]").forEach((b) => b.addEventListener("click", async () => {
      const on = b.dataset.on === "1";
      busy(b, true, "Salvando…");
      try { await put(`companies/${b.dataset.block}`, { blocked: on }); await refresh(on ? "Conta bloqueada: a equipe dela não consegue mais entrar. Os links já enviados aos clientes continuam abrindo." : "Acesso liberado."); }
      catch (e) { R.toast(e.message); busy(b, false); }
    }));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const c = byId(b.dataset.del);
      const v = await confirmModal({ title: "Excluir " + esc(c.name) + "?", html: `<p>Apaga a conta e tudo o que é dela: propostas, contratos, clientes, consultores, marca e catálogo. Os links já enviados aos clientes param de abrir. <b>Não dá para desfazer.</b></p><label class="fl"><span>Para confirmar, digite: ${esc(c.name)}</span><input class="inp" id="delName" autocomplete="off"></label>`, confirm: "Excluir para sempre", getValue: (w) => $("#delName", w).value.trim() });
      if (!v) return;
      try { await api(`companies/${c.id}`, { method: "DELETE", body: JSON.stringify({ confirm: v }) }); await refresh("Conta excluída."); } catch (err) { R.toast(err.message); }
    }));
  }
  async function backToSuper() {
    const t = R.store.get("admSuper", "");
    if (!t) return logout();
    S.token = t; R.store.set("adm", t); R.store.set("admSuper", ""); R.store.set("empresa", "");
    R.setBrand({}); location.hash = "#/";
    await start();
  }

  /* ---------- minha conta (responsável pela empresa) ---------- */
  async function account() {
    shell("acc", R.loadingHTML("Carregando…"));
    let c = null;
    try { c = (await api("account")).company; } catch (e) { R.toast(e.message); return; }
    shell("acc", `
      <div class="pgh"><div><span class="label">Administrador</span><h1>Minha conta</h1><p class="sub">Dados de acesso do responsável pela conta de ${esc(c.name)}. Os dados que aparecem nas propostas e contratos ficam em Empresa.</p></div></div>
      <div class="cols">
        <div class="stack"><div class="card"><h2>Dados de acesso</h2>
          <label class="fl"><span>Seu nome</span><input class="inp" id="aName" value="${esc(c.owner.name)}"></label>
          <p class="muted small" style="margin:0">E-mail de acesso: ${esc(c.owner.email)}</p>
          <div class="row-acts"><button type="button" class="pill pill-green" id="aSave">Salvar</button></div>
        </div></div>
        <div class="stack"><div class="card"><h2>Trocar senha</h2>
          <label class="fl"><span>Senha atual</span><input class="inp" type="password" id="aCur" autocomplete="current-password"></label>
          <label class="fl"><span>Nova senha (mínimo 8 caracteres)</span><input class="inp" type="password" id="aNew" autocomplete="new-password"></label>
          <div class="row-acts"><button type="button" class="pill pill-line" id="aPw">Trocar senha</button></div>
        </div></div>
      </div>`);
    $("#aSave").addEventListener("click", async (e) => {
      busy(e.currentTarget, true, "Salvando…");
      try { await put("account", { name: $("#aName").value.trim() }); await reload(); R.toast("Dados salvos."); } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
    $("#aPw").addEventListener("click", async (e) => {
      const cur = $("#aCur").value, nw = $("#aNew").value;
      if (nw.length < 8) { R.toast("A nova senha precisa de pelo menos 8 caracteres."); return; }
      busy(e.currentTarget, true, "Trocando…");
      try { const r = await put("account", { currentPassword: cur, newPassword: nw }); if (r.token) { S.token = r.token; R.store.set("adm", r.token); } $("#aCur").value = ""; $("#aNew").value = ""; R.toast("Senha trocada."); } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
  }

  /* ---------- casca ---------- */
  function shell(active, html) {
    const nav = isAdm()
      ? [["#/", "Propostas", "list"], ["#/servicos", "Serviços", "cat"], ["#/equipe", "Equipe", "team"], ["#/empresa", "Empresa", "biz"], ["#/config", "Configurações", "cfg"], ...(S.data.su ? [] : [["#/conta", "Minha conta", "acc"]])]
      : [["#/", "Propostas", "list"], ["#/perfil", "Meu perfil", "me"]];
    app.innerHTML = `${S.data.notice ? `<div class="warnbox" style="margin:0;border-radius:0;justify-content:center"><span>${esc(S.data.notice)}</span></div>` : ""}${S.data.su ? `<div class="warnbox" style="margin:0;border-radius:0;justify-content:center"><span>Você está no painel de <b>${esc(S.data.company.name)}</b> como dono do sistema.</span><button type="button" class="pill pill-cream pill-sm" id="suBack">Voltar à lista de empresas</button></div>` : ""}<header class="adm-top wrap"><div class="inner">
        <a class="brand" href="#/">${R.logoHTML("escuro")}</a><span class="tag">${isAdm() ? "Propostas" : "Consultor · " + esc(first(me().name))}</span>
        <nav>${nav.map(([h, t, k]) => `<a class="pill ${active === k ? "on" : "pill-line"}" href="${h}">${t}</a>`).join("")}<a class="pill pill-green" href="#/nova">Nova proposta</a><button class="pill pill-line" type="button" id="logout">Sair</button></nav>
      </div></header><main class="adm-main wrap"><div class="inner">${html}</div></main>`;
    $("#logout").addEventListener("click", () => (S.data.su ? backToSuper() : logout()));
    const sb = $("#suBack"); if (sb) sb.addEventListener("click", backToSuper);
    $$('.adm-top nav a[href="#/"], .adm-top .brand').forEach((a) => a.addEventListener("click", () => { S.view = "all"; S.sel && S.sel.clear(); if (location.hash === "#/" || !location.hash) list(); }));
    window.scrollTo(0, 0);
  }

  async function start() {
    app.innerHTML = R.loadingHTML("Carregando o painel…");
    try { await reload(); } catch (e) { if (S.token) app.innerHTML = R.stateHTML("Não foi possível carregar", esc(e.message), '<button class="pill pill-green pill-lg" onclick="location.reload()">Tentar de novo</button>'); return; }
    if (S.data.role === "super") { R.store.set("empresa", ""); refreshBrandCss(); return superPanel(); } // painel do dono com a identidade neutra
    if (DONO && !S.data.su) return login("dono"); // /dono é só do dono do sistema
    refreshBrandCss();
    route();
  }
  window.addEventListener("hashchange", () => {
    if (/^#\/nova-senha\//.test(location.hash)) return login("nova");
    if (/^#\/criar-conta/.test(location.hash) && !S.token) return login("criar");
    if (S.token && S.data && S.data.role !== "super") route();
  });
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const m = h.match(/^proposta\/([\w-]+)(\/editar)?$/);
    if (h === "nova") return editor(null);
    if (m && m[2]) return editor(m[1]);
    if (m) return detail(m[1]);
    if (isAdm()) {
      if (h === "servicos") return catalog();
      if (h === "config") return config();
      if (h === "empresa") return empresa();
      if (h === "equipe") return team();
      if (h === "conta" && !S.data.su) return account();
    } else if (h === "perfil") return profile();
    return list();
  }

  /* ---------- lista ---------- */
  const sumBy = (arr, key) => { const by = {}; arr.forEach((p) => { if (p.order && p.order.totals[key]) by[p.currency || "BRL"] = (by[p.currency || "BRL"] || 0) + p.order.totals[key]; }); return Object.entries(by).map(([c, v]) => mny(v, c)); };
  const folders = () => S.data.folders || [];
  const folderName = (id) => (folders().find((f) => f.id === id) || {}).name || "";
  S.view = S.view || "all";
  S.sel = S.sel || new Set();

  function sideHTML(all) {
    const live = all.filter((p) => !p.archived);
    const cnt = (fn) => all.filter(fn).length;
    const item = (v, label, n, extra = "") => `<li><button type="button" class="sb-item${S.view === v ? " on" : ""}" data-view="${esc(v)}"${extra}><span>${label}</span><i>${n}</i></button></li>`;
    return `<aside class="sidebar" aria-label="Organização das propostas">
      <ul class="sb-list">
        ${item("all", "Todas as propostas", live.length)}
        ${item("none", "Sem pasta", cnt((p) => !p.archived && !p.folderId))}
        ${item("archived", "Arquivadas", cnt((p) => p.archived), ' data-drop="archive"')}
      </ul>
      <div class="sb-h"><span>Pastas de clientes</span><button type="button" class="icon-btn sm" id="fNew" aria-label="Nova pasta" title="Nova pasta">+</button></div>
      <form class="sb-new" id="fNewForm" hidden><input class="inp" id="fNewName" placeholder="Nome do cliente ou da pasta" maxlength="80"><div class="row-acts"><button type="submit" class="pill pill-cream pill-sm">Criar</button><button type="button" class="link-btn" id="fNewCancel">Cancelar</button></div></form>
      <ul class="sb-list" id="fList">${folders().map((f) => `<li class="sb-folder" data-fid="${f.id}">
          <button type="button" class="sb-item${S.view === f.id ? " on" : ""}" data-view="${f.id}" data-drop="${f.id}"><span>${esc(f.name)}${isAdm() && f.ownerName ? `<small>${esc(first(f.ownerName))}</small>` : ""}</span><i>${cnt((p) => !p.archived && p.folderId === f.id)}</i></button>
          <span class="sb-acts"><button type="button" class="link-btn" data-fa="rename" title="Renomear">Renomear</button><button type="button" class="link-btn" data-fa="delete" title="Excluir pasta">Excluir</button></span>
        </li>`).join("") || '<li class="muted small sb-empty">Crie uma pasta por cliente para agrupar as propostas. Arraste as linhas da tabela para dentro dela.</li>'}</ul>
    </aside>`;
  }

  function list() {
    const all = S.data.proposals;
    let ps = all.filter((p) => (S.view === "archived" ? p.archived : !p.archived));
    if (S.view === "none") ps = ps.filter((p) => !p.folderId);
    else if (!["all", "archived"].includes(S.view)) { if (!folders().some((f) => f.id === S.view)) S.view = "all"; else ps = ps.filter((p) => p.folderId === S.view); }
    if (isAdm() && S.seller) ps = ps.filter((p) => (S.seller === "-" ? !p.sellerId : p.sellerId === S.seller));
    [...S.sel].forEach((id) => { if (!all.some((p) => p.id === id)) S.sel.delete(id); });
    const pend = ps.filter((p) => p.status === "pedido");
    const wait = ps.filter((p) => p.status === "contrato");
    const open = ps.filter((p) => ["rascunho", "enviada", "visualizada"].includes(p.status) && !p.offline);
    const signed = ps.filter((p) => p.status === "assinada");
    const once = sumBy(signed, "once"), mon = sumBy(signed, "monthly");
    const F = [["todas", "Todas", () => true], ["abertas", "Em aberto", (p) => ["rascunho", "enviada", "visualizada"].includes(p.status) && !p.offline], ["pedido", "Pedidos", (p) => p.status === "pedido"], ["contrato", "Aguardando assinatura", (p) => p.status === "contrato"], ["assinada", "Assinadas", (p) => p.status === "assinada"], ["outras", "Recusadas e vencidas", (p) => p.status === "recusada" || p.expired], ["fora", "Fora do ar", (p) => p.offline]];
    const f = F.find((x) => x[0] === S.filter) || F[0];
    const q = S.q.trim().toLowerCase();
    const rows = ps.filter(f[2]).filter((p) => !q || `${p.number} ${p.client.name} ${p.title} ${p.order ? p.order.client.name : ""} ${p.sellerName || ""} ${folderName(p.folderId)}`.toLowerCase().includes(q));
    const users = S.data.users || [];
    const showSeller = isAdm() && users.length > 0;
    const cols = showSeller ? 8 : 7;
    const title = S.view === "archived" ? "Arquivadas" : S.view === "none" ? "Sem pasta" : S.view !== "all" ? folderName(S.view) : isAdm() ? "Propostas" : "Minhas propostas";
    const allSel = rows.length && rows.every((p) => S.sel.has(p.id));
    shell("list", `
      <div class="with-side">
      ${sideHTML(all)}
      <div class="side-main">
      <div class="pgh"><div><span class="label">${S.view !== "all" ? "Pasta" : isAdm() ? "Painel" : "Painel do consultor"}</span><h1>${esc(title)}</h1><p class="sub">${S.view === "archived" ? "Propostas guardadas fora da lista principal. Desarquive para voltar a acompanhar." : "Monte, envie e acompanhe cada proposta até o contrato assinado."}</p></div><div class="acts">${!["all", "none", "archived"].includes(S.view) ? `<a class="pill pill-line pill-lg" href="#/nova" data-newin="${S.view}">Nova proposta nesta pasta</a>` : ""}<a class="pill pill-green pill-lg" href="#/nova">Nova proposta</a></div></div>
      ${!isAdm() && (!me().doc || !me().hasSignature) ? `<div class="warnbox"><span>Complete o seu CPF${me().hasSignature ? "" : " e salve a sua assinatura"} para assinar contratos como intermediador e testemunha.</span><a class="pill pill-cream pill-sm" href="#/perfil">Completar meu perfil</a></div>` : ""}
      ${S.view !== "archived" ? `<div class="tiles">
        <div class="tile${pend.length ? " hot" : ""}"><span>Pedidos para responder</span><b>${pend.length}</b><small>${pend.length ? "Gere o contrato de cada um" : "Nenhum pedido parado"}</small></div>
        <div class="tile"><span>Aguardando assinatura</span><b>${wait.length}</b><small>Contratos enviados</small></div>
        <div class="tile"><span>Em aberto</span><b>${open.length}</b><small>${open.filter((p) => p.views).length} já visualizada(s)</small></div>
        <div class="tile"><span>Assinadas</span><b>${signed.length}</b><small>${once.length ? once.join(" + ") + " em projetos" : "Nenhum projeto ainda"}${mon.length ? ` · ${mon.join(" + ")}/mês` : ""}</small></div>
      </div>` : ""}
      <div class="bar"><div class="seg">${F.map(([k, l, fn]) => `<button type="button" data-f="${k}" class="${S.filter === k ? "on" : ""}">${l}<i>${ps.filter(fn).length}</i></button>`).join("")}</div>
        <div class="bar" style="margin-left:auto">${showSeller ? `<select class="sel" id="sellerF" style="width:auto"><option value="">Todos os consultores</option><option value="-"${S.seller === "-" ? " selected" : ""}>Sem consultor</option>${users.map((u) => `<option value="${u.id}"${S.seller === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select>` : ""}<input class="inp search" id="q" placeholder="Buscar cliente, número ou pasta" value="${esc(S.q)}"></div></div>
      <div class="bulk" id="bulk"${S.sel.size ? "" : " hidden"}><b id="bulkN">${S.sel.size} selecionada(s)</b>
        <select class="sel" id="bulkFolder" style="width:auto"><option value="">Mover para pasta…</option><option value="-">Tirar da pasta</option>${folders().map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select>
        ${S.view === "archived" ? '<button type="button" class="pill pill-line pill-sm" data-bulk="unarchive">Desarquivar</button>' : '<button type="button" class="pill pill-line pill-sm" data-bulk="archive">Arquivar</button>'}
        <button type="button" class="pill pill-line pill-sm" data-bulk="delete">Excluir</button>
        <button type="button" class="link-btn" id="bulkClear">Limpar seleção</button></div>
      ${all.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="ck"><input type="checkbox" id="selAll" aria-label="Selecionar todas"${allSel ? " checked" : ""}></th><th>Nº</th><th>Cliente</th>${showSeller ? "<th>Consultor</th>" : ""}<th>Situação</th><th>Vistas</th><th>Atualizada</th><th class="r">Pedido</th></tr></thead><tbody>
        ${rows.map((p) => `<tr data-id="${p.id}" draggable="true"${S.sel.has(p.id) ? ' class="sel"' : ""}><td class="ck"><input type="checkbox" data-sel="${p.id}" aria-label="Selecionar proposta ${esc(p.number)}"${S.sel.has(p.id) ? " checked" : ""}></td><td class="n">${esc(p.number)}</td><td><b>${esc(p.client.name || (p.order && p.order.client.name) || "Sem nome")}</b>${p.country && p.country !== "BR" ? ` <span class="flag">${esc(p.country)}</span>` : ""}${p.folderId && S.view !== p.folderId ? ` <span class="fchip">${esc(folderName(p.folderId))}</span>` : ""}${p.source ? ` <span class="muted small">· ${esc(p.source)}</span>` : ""}<div class="svcs">${esc(p.services.join(" · "))}</div></td>${showSeller ? `<td>${p.sellerName ? esc(p.sellerName) : '<span class="muted">-</span>'}</td>` : ""}<td>${stPill(p)}${p.offline ? ' <span class="st off" title="O cliente vê o aviso de proposta indisponível">Fora do ar</span>' : ""}</td><td class="n"${p.views ? ` title="Última em ${esc(R.dateTime(p.lastViewAt))}"` : ""}>${p.views ? `${p.views}×` : "Não abriu"}</td><td class="n" title="${esc(R.dateTime(p.updatedAt))}">${esc(new Date(p.updatedAt || p.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }))}</td><td class="r">${p.order ? `${p.order.totals.once ? mny(p.order.totals.once, p.currency) : ""}${p.order.totals.once && p.order.totals.monthly ? "<br>" : ""}${p.order.totals.monthly ? mny(p.order.totals.monthly, p.currency) + "/mês" : ""}` : '<span class="muted">-</span>'}</td></tr>`).join("") || `<tr><td colspan="${cols}"><div class="empty">${S.view === "archived" ? "Nenhuma proposta arquivada." : S.view !== "all" && S.view !== "none" ? "Esta pasta está vazia. Selecione propostas e use “Mover para pasta”, ou arraste as linhas para cá." : "Nenhuma proposta neste filtro."}</div></td></tr>`}
      </tbody></table></div>` : `<div class="card"><div class="empty"><b>Nenhuma proposta ainda</b><span>Monte a primeira escolhendo os serviços do catálogo. O cliente recebe um link, escolhe as opções e envia o pedido.</span><a class="pill pill-green pill-lg" href="#/nova">Montar a primeira proposta</a></div></div>`}
      </div></div>`);
    bindList(rows);
  }

  async function bulk(action, ids, folderId) {
    const r = await post("proposals/bulk", { action, ids, folderId });
    await reload();
    return r;
  }

  function bindList(rows) {
    $$(".seg [data-f]").forEach((b) => b.addEventListener("click", () => { S.filter = b.dataset.f; list(); }));
    $$("[data-view]").forEach((b) => b.addEventListener("click", () => { S.view = b.dataset.view; S.sel.clear(); list(); }));
    $$("[data-newin]").forEach((a) => a.addEventListener("click", () => (S.newFolder = a.dataset.newin)));
    $$(".tbl tbody tr[data-id]").forEach((tr) => tr.addEventListener("click", (e) => { if (e.target.closest(".ck")) return; location.hash = "#/proposta/" + tr.dataset.id; }));
    const refreshBulk = () => { $("#bulk").hidden = !S.sel.size; $("#bulkN").textContent = `${S.sel.size} selecionada(s)`; };
    $$("[data-sel]").forEach((c) => c.addEventListener("change", () => { c.checked ? S.sel.add(c.dataset.sel) : S.sel.delete(c.dataset.sel); c.closest("tr").classList.toggle("sel", c.checked); refreshBulk(); }));
    const sa = $("#selAll"); if (sa) sa.addEventListener("change", () => { rows.forEach((p) => (sa.checked ? S.sel.add(p.id) : S.sel.delete(p.id))); list(); });
    $("#bulkClear").addEventListener("click", () => { S.sel.clear(); list(); });
    $("#bulkFolder").addEventListener("change", async (e) => {
      const v = e.target.value; if (!v) return;
      try { const r = await bulk("move", [...S.sel], v === "-" ? null : v); S.sel.clear(); list(); R.toast(v === "-" ? `${r.done} proposta(s) fora da pasta.` : `${r.done} proposta(s) movida(s) para ${folderName(v)}.`); } catch (err) { R.toast(err.message); }
    });
    $$("[data-bulk]").forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.bulk;
      let force = false;
      if (a === "delete") {
        const ids = [...S.sel], signedN = S.data.proposals.filter((p) => ids.includes(p.id) && p.status === "assinada").length;
        if (signedN && isAdm()) {
          const ok = await confirmModal({ title: `Excluir ${ids.length} proposta(s)?`, html: `<p><b>${signedN} delas têm contrato assinado.</b> Excluir apaga a proposta, o pedido, o contrato, as assinaturas e o registro de auditoria. Os links enviados aos clientes deixam de funcionar.</p><p>Antes, baixe o arquivo .zip de cada uma na página da proposta para guardar uma cópia.</p>`, check: "Entendo que a exclusão não pode ser desfeita.", confirm: "Excluir definitivamente" });
          if (!ok) return;
          force = true;
        } else if (!(await confirmModal({ title: `Excluir ${ids.length} proposta(s)?`, html: `<p>A exclusão não pode ser desfeita.${signedN ? " Propostas com contrato assinado só podem ser excluídas pelo administrador e serão mantidas." : ""}</p>`, confirm: "Excluir" }))) return;
      }
      try {
        const r = a === "delete" ? await post("proposals/bulk", { action: a, ids: [...S.sel], force }).then(async (x) => { await reload(); return x; }) : await bulk(a, [...S.sel]); S.sel.clear(); list();
        R.toast(a === "archive" ? `${r.done} proposta(s) arquivada(s).` : a === "unarchive" ? `${r.done} proposta(s) de volta à lista.` : `${r.done} proposta(s) excluída(s)${r.skipped ? `. ${r.skipped} com contrato assinado não podem ser excluídas; arquive-as.` : "."}`);
      } catch (err) { R.toast(err.message); }
    }));
    // pastas
    const nf = $("#fNewForm");
    $("#fNew").addEventListener("click", () => { nf.hidden = !nf.hidden; if (!nf.hidden) $("#fNewName").focus(); });
    $("#fNewCancel").addEventListener("click", () => (nf.hidden = true));
    nf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#fNewName").value.trim(); if (name.length < 2) { R.toast("Dê um nome para a pasta."); return; }
      try { const r = await post("folders", { name }); if (S.sel.size) await bulk("move", [...S.sel], r.folder.id); else await reload(); S.sel.clear(); S.view = r.folder.id; list(); R.toast(`Pasta “${name}” criada.`); } catch (err) { R.toast(err.message); }
    });
    $$("#fList [data-fa]").forEach((b) => b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const fid = b.closest("[data-fid]").dataset.fid, fn = folderName(fid);
      try {
        if (b.dataset.fa === "rename") { const name = prompt("Novo nome da pasta", fn); if (!name || name.trim() === fn) return; await put("folders/" + fid, { name }); await reload(); list(); R.toast("Pasta renomeada."); }
        if (b.dataset.fa === "delete") { if (!armed(b, "Confirmar")) return; const r = await api("folders/" + fid, { method: "DELETE" }); await reload(); if (S.view === fid) S.view = "all"; list(); R.toast(`Pasta excluída. ${r.moved} proposta(s) ficaram sem pasta.`); }
      } catch (err) { R.toast(err.message); }
    }));
    // arrastar linhas para pastas ou para Arquivadas
    $$(".tbl tbody tr[draggable]").forEach((tr) => tr.addEventListener("dragstart", (e) => { const ids = S.sel.has(tr.dataset.id) ? [...S.sel] : [tr.dataset.id]; e.dataTransfer.setData("text/plain", JSON.stringify(ids)); e.dataTransfer.effectAllowed = "move"; }));
    $$("[data-drop]").forEach((t) => {
      t.addEventListener("dragover", (e) => { e.preventDefault(); t.classList.add("drop"); });
      t.addEventListener("dragleave", () => t.classList.remove("drop"));
      t.addEventListener("drop", async (e) => {
        e.preventDefault(); t.classList.remove("drop");
        let ids = []; try { ids = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (x) { return; }
        try { const d = t.dataset.drop; const r = d === "archive" ? await bulk("archive", ids) : await bulk("move", ids, d); S.sel.clear(); list(); R.toast(d === "archive" ? `${r.done} proposta(s) arquivada(s).` : `${r.done} proposta(s) movida(s) para ${folderName(d)}.`); } catch (err) { R.toast(err.message); }
      });
    });
    const sf = $("#sellerF"); if (sf) sf.addEventListener("change", () => { S.seller = sf.value; list(); });
    const qi = $("#q");
    if (qi) qi.addEventListener("input", () => { S.q = qi.value; const pos = qi.selectionStart; list(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); });
  }

  /* ---------- idiomas e moedas ---------- */
  function loc(s, lang) {
    if (!s || !lang || lang === "pt" || !s.i18n || !s.i18n[lang]) return s ? clone(s) : s;
    const t = s.i18n[lang], out = clone(s);
    for (const k of ["name", "tagline", "description", "includes", "steps", "deadline", "notes"]) if (t[k] != null && (!Array.isArray(t[k]) || t[k].length) && t[k] !== "") out[k] = clone(t[k]);
    if (s.anchor && t.anchor) out.anchor = { title: t.anchor.title || s.anchor.title, rows: s.anchor.rows.map((r, i) => [((t.anchor.rows || [])[i] || [])[0] || r[0], r[1]]) };
    if (Array.isArray(t.payment)) out.payment = s.payment.map((o, i) => ({ ...o, ...Object.fromEntries(Object.entries(t.payment[i] || {}).filter(([, v]) => v)) }));
    delete out.i18n;
    return out;
  }
  const STEP = { USD: 5, PYG: 5000, ARS: 1000, BRL: 10 };
  const roundStep = (v, cur) => { const st = STEP[cur] || 1; return Math.max(st, Math.round(v / st) * st); };

  /* ---------- montagem / edição ---------- */
  async function editor(id) {
    let p = null;
    if (id) {
      shell("list", R.loadingHTML("Carregando…"));
      try { p = (await api("proposals/" + id)).proposal; } catch (e) { shell("list", `<div class="card"><div class="empty"><b>${esc(e.message)}</b><a class="pill pill-line" href="#/">Voltar</a></div></div>`); return; }
    }
    const today = S.data.today;
    const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
    S.edit = {
      id, number: p ? p.number : "", locked: p && ["contrato", "assinada"].includes(p.status), hasOrder: !!(p && p.order),
      client: p ? { ...p.client } : { name: "", company: "", contact: "", phone: "", email: "" },
      title: p ? p.title : "", message: p ? p.message : "", validUntil: p ? p.validUntil : addDays(today, S.data.settings.validityDays || 15),
      folderId: p ? p.folderId || "" : S.newFolder || "", country: (p && p.country) || "BR", lang: (p && p.lang) || "pt", currency: (p && p.currency) || "BRL", sellerId: (p && p.sellerId) || "", rate: R.store.get("rate." + ((p && p.currency) || "USD"), ""),
      services: {}, order: [],
    };
    const cat = S.data.catalog;
    const ids = [...cat.filter((s) => s.active !== false).map((s) => s.id)];
    if (p) p.services.forEach((s) => { S.edit.services[s.id] = clone(s); if (!ids.includes(s.id)) ids.push(s.id); });
    S.edit.order = ids;
    S.newFolder = null;
    renderEditor();
  }

  const catalogSvc = (sid) => S.data.catalog.find((s) => s.id === sid);
  const baseSvc = (sid) => S.edit.services[sid] || loc(catalogSvc(sid), S.edit.lang);
  const priceRange = (s, cur = "BRL") => { const v = s.payment.map((o) => o.total); const mn = Math.min(...v), mx = Math.max(...v); return (mn === mx ? mny(mn, cur) : `${mny(mn, cur)} a ${mny(mx, cur)}`) + (s.kind === "mensal" ? "/mês" : ""); };
  const SCH_HINT = `<p class="muted small" style="margin:0">Em “Como o cliente paga”, use {total}, {entrada}, {parcela} e {n} para os valores aparecerem formatados. “Parcelas” é o número de pagamentos depois da entrada.</p>`;

  function renderEditor() {
    const E = S.edit;
    const dis = E.locked ? " disabled" : "";
    const users = (S.data.users || []).filter((u) => u.active || u.id === E.sellerId);
    shell("list", `
      <a class="back" href="${E.id ? "#/proposta/" + E.id : "#/"}">← ${E.id ? "Voltar para a proposta" : "Voltar"}</a>
      <div class="pgh"><div><span class="label">${E.id ? "Proposta nº " + esc(E.number) : "Montagem"}</span><h1>${E.id ? "Editar proposta" : "Nova proposta"}</h1><p class="sub">Escolha os serviços e ajuste os valores. O cliente decide no link o que vai contratar e como vai pagar.</p></div></div>
      ${E.locked ? `<div class="warnbox">O contrato desta proposta já foi enviado. Você pode ajustar os dados e a mensagem, mas não os serviços, o país ou a moeda.</div>` : E.hasOrder ? `<div class="warnbox">O cliente já enviou um pedido. Se mudar os serviços, confira o pedido antes de gerar o contrato.</div>` : ""}
      <div class="cols">
        <div class="stack">
          <div class="card"><h2>País, idioma e moeda</h2>
            <div class="grid3">
              <label class="fl"><span>País do cliente</span><select class="sel" id="eCountry"${dis}>${S.data.countries.map((c) => `<option value="${c[0]}"${c[0] === E.country ? " selected" : ""}>${esc(c[1])}</option>`).join("")}</select></label>
              <label class="fl"><span>Idioma da proposta</span><select class="sel" id="eLang"${dis}>${Object.entries(LANG).map(([k, v]) => `<option value="${k}"${k === E.lang ? " selected" : ""}>${v}</option>`).join("")}</select></label>
              <label class="fl"><span>Moeda</span><select class="sel" id="eCur"${dis}>${S.data.currencies.map((c) => `<option value="${c[0]}"${c[0] === E.currency ? " selected" : ""}>${esc(c[1])}</option>`).join("")}</select></label>
            </div>
            ${E.currency !== "BRL" && !E.locked ? `<div class="conv"><label class="fl"><span>1 ${E.currency} vale quantos reais?</span><input class="inp" id="eRate" inputmode="decimal" value="${esc(E.rate)}" placeholder="${E.currency === "USD" ? "Ex.: 5,40" : E.currency === "PYG" ? "Ex.: 0,00072" : "Ex.: 0,0055"}"></label><button type="button" class="pill pill-cream" id="eConv">Converter valores do catálogo</button><small class="muted">Converte os valores em reais dos serviços marcados e arredonda. Depois, ajuste o que quiser à mão.</small></div>` : ""}
            ${E.country !== "BR" ? `<p class="muted small" style="margin:0">Para fora do Brasil, o cliente informa documento e endereço livres, e o contrato sai no idioma escolhido, com pagamento por transferência internacional.</p>` : ""}
          </div>
          <div class="card"><h2>Serviços da proposta</h2><p class="muted small" style="margin-top:-6px">Marque os serviços que vão na proposta e, em cada um, os itens que entram. O cliente recebe a proposta já montada e escolhe só a forma de pagamento. Das identidades, vai apenas uma por proposta.${E.lang !== "pt" ? ` Textos em ${LANG[E.lang].toLowerCase()} vêm do catálogo.` : ""}</p>
            <div class="svc-pick" id="spList">${E.order.length ? E.order.map((sid) => spHTML(sid)).join("") : `<div class="card"><div class="empty"><b>Nenhum serviço no catálogo</b><span>${isAdm() ? 'Cadastre seus serviços em <a href="#/servicos">Serviços</a> para montar propostas.' : "Peça ao administrador para cadastrar os serviços no catálogo."}</span></div></div>`}</div>${SCH_HINT}</div>
        </div>
        <div class="stack">
          <div class="card"><h2>Cliente</h2>
            <label class="fl"><span>Cliente ou empresa *</span><input class="inp" data-k="client.name" value="${esc(E.client.name)}" placeholder="Ex.: Padaria Exemplo"></label>
            <label class="fl"><span>Pessoa de contato</span><input class="inp" data-k="client.contact" value="${esc(E.client.contact)}"></label>
            <div class="grid2"><label class="fl"><span>WhatsApp${E.country !== "BR" ? " (com código do país)" : ""}</span><input class="inp" data-k="client.phone" inputmode="tel" value="${esc(E.client.phone)}"></label><label class="fl"><span>E-mail</span><input class="inp" data-k="client.email" type="email" value="${esc(E.client.email)}"></label></div>
          </div>
          <div class="card"><h2>Proposta</h2>
            <label class="fl"><span>Título</span><input class="inp" data-k="title" value="${esc(E.title)}" placeholder="Gerado pelos serviços, se ficar vazio"></label>
            <label class="fl"><span>Mensagem para o cliente</span><textarea class="ta" data-k="message" rows="4" placeholder="Opcional. Aparece em destaque no início da proposta.">${esc(E.message)}</textarea></label>
            <label class="fl"><span>Válida até</span><input class="inp" type="date" data-k="validUntil" value="${esc(E.validUntil)}"></label>
            <label class="fl"><span>Pasta do cliente</span><select class="sel" data-k="folderId"><option value="">Sem pasta</option>${folders().map((f) => `<option value="${f.id}"${f.id === E.folderId ? " selected" : ""}>${esc(f.name)}</option>`).join("")}</select>${folders().length ? "" : "<small>Crie pastas na lateral da lista de propostas.</small>"}</label>
            ${isAdm() ? `<label class="fl"><span>Consultor responsável</span><select class="sel" id="eSeller"><option value="">Nenhum (direto com a empresa)</option>${users.map((u) => `<option value="${u.id}"${u.id === E.sellerId ? " selected" : ""}>${esc(u.name)}${u.active ? "" : " (desativado)"}</option>`).join("")}</select><small>O consultor vê a proposta no acesso dele e assina o contrato como intermediador e testemunha.</small></label>` : `<p class="muted small" style="margin:0">Você fica como consultor desta proposta e assina o contrato como intermediador e testemunha.</p>`}
          </div>
        </div>
      </div>
      <div class="savebar"><div class="inner"><span class="sb-sum" id="edSum"></span><a class="pill pill-line pill-lg" href="${E.id ? "#/proposta/" + E.id : "#/"}">Cancelar</a><button class="pill pill-green pill-lg" type="button" id="edSave">${E.id ? "Salvar alterações" : "Criar proposta e gerar link"}</button></div></div>`);
    bindEditor();
    edSummary();
  }

  function optRowsHTML(s, dis, idxAttr, cur) {
    return `<div class="opt-rows"><div class="opt-row h"><span>Forma de pagamento</span><span>Valor${s.kind === "mensal" ? "/mês" : " total"}</span><span>Para começar</span><span>Parcelas</span><span>Como o cliente paga</span><span></span></div>
      ${s.payment.map((o, i) => `<div class="opt-row" ${idxAttr}="${i}"><input class="inp" data-o="label" value="${esc(o.label)}"${dis}><input class="inp" data-o="total" inputmode="decimal" value="${esc(o.total)}"${dis}><input class="inp" data-o="upfront" inputmode="decimal" value="${esc(o.upfront)}"${dis}><input class="inp" data-o="n" type="number" min="0" max="24" value="${esc(o.n || 0)}"${dis}><input class="inp" data-o="schedule" value="${esc(o.schedule)}" title="${esc(fillSch(o, cur))}"${dis}><button type="button" class="icon-btn" data-a="delopt" aria-label="Remover forma de pagamento"${s.payment.length < 2 || dis ? " disabled" : ""}>×</button></div>`).join("")}
    </div>`;
  }

  // itens do "o que está incluso", com caixas de seleção: o que fica marcado vai para a proposta e para o contrato
  function incPickHTML(sid, s, dis) {
    const base = ((loc(catalogSvc(sid), S.edit.lang) || {}).includes) || [];
    const cur = s.includes || [];
    const groups = base.map((g) => ({ title: g.title, items: [...g.items] }));
    for (const g of cur) {
      let t = groups.find((x) => x.title === g.title);
      if (!t) { t = { title: g.title, items: [] }; groups.push(t); }
      for (const it of g.items) if (!t.items.includes(it)) t.items.push(it);
    }
    const on = (title, it) => cur.some((g) => g.title === title && g.items.includes(it));
    const total = groups.reduce((a, g) => a + g.items.length, 0), marked = groups.reduce((a, g) => a + g.items.filter((it) => on(g.title, it)).length, 0);
    return `<div class="inc-pick"><div class="ip-h"><b>O que está incluso</b><span class="muted small">${marked} de ${total} itens · os marcados aparecem para o cliente e entram no contrato</span>${dis ? "" : '<span class="ip-all"><button type="button" class="link-btn" data-a="incall">Marcar todos</button><button type="button" class="link-btn" data-a="incnone">Desmarcar todos</button></span>'}</div>
      <div class="ip-groups">${groups.map((g, gi) => `<fieldset class="ip-g" data-gt="${esc(g.title)}"><legend>${esc(g.title || "Itens")}</legend>
        ${g.items.map((it) => `<label class="ip-it"><input type="checkbox" data-inc value="${esc(it)}"${on(g.title, it) ? " checked" : ""}${dis}><span>${esc(it)}</span></label>`).join("")}
        ${dis ? "" : `<div class="ip-add"><input class="inp" data-incnew placeholder="Adicionar item específico"><button type="button" class="icon-btn" data-a="incadd" aria-label="Adicionar item">+</button></div>`}
      </fieldset>`).join("")}</div></div>`;
  }
  function readIncludes(row) {
    return [...row.querySelectorAll(".ip-g")].map((fs) => ({ title: fs.dataset.gt, items: [...fs.querySelectorAll("input[data-inc]:checked")].map((x) => x.value) })).filter((g) => g.items.length);
  }

  function spHTML(sid) {
    const E = S.edit, on = !!E.services[sid], s = baseSvc(sid);
    if (!s) return "";
    const dis = E.locked ? " disabled" : "";
    return `<div class="sp${on ? " on" : ""}" data-sid="${esc(sid)}">
      <label class="sp-head"><input type="checkbox" data-a="toggle"${on ? " checked" : ""}${dis}><span><b>${esc(s.name)}</b><small>${esc(s.category || "")} · ${s.kind === "mensal" ? `mensal, mínimo ${s.minMonths || 1} meses` : "projeto único"}${s.group ? " · grupo " + esc(s.group) : ""}</small></span><span class="pr">${on || E.currency === "BRL" ? priceRange(s, on ? E.currency : "BRL") : priceRange(s, "BRL") + " (catálogo)"}</span></label>
      ${on ? `<div class="sp-body">
        <div class="row-acts"><label class="switch"><input type="checkbox" data-a="rec"${s.recommended ? " checked" : ""}${dis}>Marcar como recomendado (já vem escolhido para o cliente)</label></div>
        ${s.kind === "mensal" ? `<label class="fl" style="max-width:220px"><span>Contrato mínimo (meses)</span><input class="inp" type="number" min="1" max="60" data-a="min" value="${esc(s.minMonths || 1)}"${dis}></label>` : ""}
        ${optRowsHTML(s, dis, "data-i", E.currency)}
        ${incPickHTML(sid, s, dis)}
        ${E.locked ? "" : `<div class="row-acts"><button type="button" class="pill pill-line pill-sm" data-a="addopt">Adicionar forma de pagamento</button>${catalogSvc(sid) ? '<button type="button" class="pill pill-line pill-sm" data-a="reset">Voltar aos valores do catálogo</button>' : ""}</div>`}
      </div>` : ""}
    </div>`;
  }

  const num = (v) => { const s = String(v ?? "").trim(); if (!s) return 0; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };

  function edSummary() {
    const sel = Object.values(S.edit.services);
    $("#edSum").textContent = sel.length ? `${sel.length} serviço(s): ${sel.map((s) => s.name).join(", ")}` : "Nenhum serviço marcado";
  }

  // troca o idioma dos serviços marcados, mantendo os valores editados
  function relocalize() {
    const E = S.edit;
    Object.keys(E.services).forEach((sid) => {
      const c = catalogSvc(sid); if (!c) return;
      const cur = E.services[sid], fresh = loc(c, E.lang);
      fresh.payment = fresh.payment.map((o, i) => (cur.payment[i] ? { ...o, total: cur.payment[i].total, upfront: cur.payment[i].upfront, n: cur.payment[i].n } : o));
      if (cur.payment.length > fresh.payment.length) fresh.payment.push(...cur.payment.slice(fresh.payment.length));
      if (cur.anchor && fresh.anchor) fresh.anchor.rows = fresh.anchor.rows.map((r, i) => [r[0], (cur.anchor.rows[i] || r)[1]]);
      fresh.minMonths = cur.minMonths; if (cur.recommended) fresh.recommended = true;
      E.services[sid] = fresh;
    });
  }

  function convert() {
    const E = S.edit, rate = num(E.rate);
    if (!(rate > 0)) { R.toast("Informe quanto vale 1 " + E.currency + " em reais."); $("#eRate").focus(); return; }
    const sids = Object.keys(E.services);
    if (!sids.length) { R.toast("Marque os serviços antes de converter."); return; }
    sids.forEach((sid) => {
      const s = E.services[sid], c = catalogSvc(sid);
      s.payment.forEach((o, i) => {
        const base = c && c.payment[i] ? c.payment[i] : o;
        o.total = roundStep(base.total / rate, E.currency);
        o.upfront = base.upfront >= base.total ? o.total : Math.min(o.total, roundStep(base.upfront / rate, E.currency));
        if (o.n && o.total > o.upfront) { const step = STEP[E.currency] || 1; const parc = Math.round((o.total - o.upfront) / o.n / step) * step || step; o.total = o.upfront + parc * o.n; }
      });
      if (s.anchor) s.anchor.rows = s.anchor.rows.map((r, i) => [r[0], roundStep(((c && c.anchor && c.anchor.rows[i]) || r)[1] / rate, E.currency)]);
    });
    R.store.set("rate." + E.currency, E.rate);
    renderEditor();
    R.toast(`Valores convertidos para ${E.currency}. Confira cada forma de pagamento.`);
  }

  function bindEditor() {
    const E = S.edit;
    $$("[data-k]").forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      const k = el.dataset.k;
      if (k.startsWith("client.")) E.client[k.slice(7)] = el.value; else E[k] = el.value;
    }));
    const cSel = $("#eCountry"), lSel = $("#eLang"), curSel = $("#eCur");
    if (cSel) cSel.addEventListener("change", () => {
      const c = S.data.countries.find((x) => x[0] === cSel.value);
      const oldCur = E.currency;
      E.country = c[0];
      if (c[2] !== E.lang) { E.lang = c[2]; relocalize(); }
      E.currency = c[3];
      if (E.currency !== oldCur) E.rate = R.store.get("rate." + E.currency, "");
      renderEditor();
      if (E.currency !== oldCur && E.currency !== "BRL" && Object.keys(E.services).length) R.toast(`Moeda trocada para ${E.currency}. Use “Converter valores do catálogo” para ajustar os valores.`);
    });
    if (lSel) lSel.addEventListener("change", () => { E.lang = lSel.value; relocalize(); renderEditor(); });
    if (curSel) curSel.addEventListener("change", () => { E.currency = curSel.value; E.rate = R.store.get("rate." + E.currency, ""); renderEditor(); });
    const rate = $("#eRate"); if (rate) rate.addEventListener("input", () => (E.rate = rate.value));
    const conv = $("#eConv"); if (conv) conv.addEventListener("click", convert);
    const sSel = $("#eSeller"); if (sSel) sSel.addEventListener("change", () => (E.sellerId = sSel.value));
    const list = $("#spList");
    const rerow = (sid) => { const old = list.querySelector(`[data-sid="${CSS.escape(sid)}"]`); old.outerHTML = spHTML(sid); edSummary(); };
    list.addEventListener("change", (e) => {
      const row = e.target.closest(".sp"); if (!row) return;
      const sid = row.dataset.sid, a = e.target.dataset.a;
      if (e.target.matches("input[data-inc]")) { E.services[sid].includes = readIncludes(row); const y = window.scrollY; rerow(sid); window.scrollTo(0, y); return; }
      if (a === "toggle") {
        if (e.target.checked) {
          E.services[sid] = clone(baseSvc(sid));
          const g = E.services[sid].group;
          if (g) Object.keys(E.services).forEach((o) => { if (o !== sid && E.services[o].group === g) { const nm = E.services[o].name; delete E.services[o]; rerow(o); R.toast(`Vai só uma identidade por proposta: ${nm} saiu.`); } });
        } else delete E.services[sid];
        rerow(sid);
        if (e.target.checked && E.currency !== "BRL") R.toast("Valores do catálogo estão em reais. Converta ou ajuste para " + E.currency + ".");
      }
      if (a === "rec") { E.services[sid].recommended = e.target.checked; if (!e.target.checked) delete E.services[sid].recommended; }
    });
    list.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-incnew]")) { e.preventDefault(); e.target.closest(".ip-g").querySelector('[data-a="incadd"]').click(); } });
    list.addEventListener("input", (e) => {
      if (e.target.matches("[data-incnew]")) return;
      const row = e.target.closest(".sp"); if (!row || !E.services[row.dataset.sid]) return;
      const s = E.services[row.dataset.sid];
      if (e.target.dataset.a === "min") s.minMonths = Math.max(1, Math.round(num(e.target.value)) || 1);
      const o = e.target.dataset.o;
      if (o) {
        const op = s.payment[+e.target.closest(".opt-row").dataset.i];
        op[o] = o === "total" || o === "upfront" ? num(e.target.value) : o === "n" ? Math.max(0, Math.min(24, Math.round(num(e.target.value)))) : e.target.value;
        const pr = row.querySelector(".pr"); if (pr) pr.textContent = priceRange(s, E.currency);
      }
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]"); if (!b) return;
      const sid = b.closest(".sp").dataset.sid, s = E.services[sid];
      const row0 = b.closest(".sp");
      if (b.dataset.a === "incadd") {
        const fs = b.closest(".ip-g"), inp = fs.querySelector("[data-incnew]"), v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        const g = (s.includes = s.includes || []).find((x) => x.title === fs.dataset.gt) || (s.includes.push({ title: fs.dataset.gt, items: [] }), s.includes[s.includes.length - 1]);
        if (!g.items.includes(v)) g.items.push(v);
        const y = window.scrollY; rerow(sid); window.scrollTo(0, y);
        const nx = list.querySelector(`[data-sid="${CSS.escape(sid)}"] .ip-g[data-gt="${CSS.escape(fs.dataset.gt)}"] [data-incnew]`); if (nx) nx.focus();
        return;
      }
      if (b.dataset.a === "incall" || b.dataset.a === "incnone") {
        row0.querySelectorAll("input[data-inc]").forEach((x) => (x.checked = b.dataset.a === "incall"));
        s.includes = readIncludes(row0); const y = window.scrollY; rerow(sid); window.scrollTo(0, y); return;
      }
      if (b.dataset.a === "addopt") s.payment.push({ id: "", label: "Nova opção", total: s.payment[0] ? s.payment[0].total : 0, upfront: 0, n: 0, schedule: "" });
      if (b.dataset.a === "delopt") s.payment.splice(+b.closest(".opt-row").dataset.i, 1);
      if (b.dataset.a === "reset") { const rec = s.recommended; E.services[sid] = loc(catalogSvc(sid), E.lang); if (rec) E.services[sid].recommended = true; if (E.currency !== "BRL") R.toast("Valores do catálogo em reais. Converta para " + E.currency + "."); }
      rerow(sid);
    });
    $("#edSave").addEventListener("click", async (ev) => {
      if (!E.client.name.trim()) { R.toast("Informe o nome do cliente."); $('[data-k="client.name"]').focus(); return; }
      const services = E.order.filter((sid) => E.services[sid]).map((sid) => E.services[sid]);
      if (!services.length) { R.toast("Marque pelo menos um serviço."); return; }
      const bad = services.find((s) => s.payment.some((o) => !(o.total > 0)));
      if (bad) { R.toast(`Confira os valores de ${bad.name}.`); return; }
      const body = { client: E.client, title: E.title, message: E.message, validUntil: E.validUntil, folderId: E.folderId || null };
      if (!E.locked) Object.assign(body, { services, country: E.country, lang: E.lang, currency: E.currency });
      if (isAdm()) body.sellerId = E.sellerId || null;
      busy(ev.currentTarget, true, "Salvando…");
      try {
        const r = E.id ? await put("proposals/" + E.id, body) : await post("proposals", body);
        const pid = E.id || r.id;
        await reload();
        R.toast(E.id ? "Proposta salva." : "Proposta criada. O link está pronto para enviar.");
        location.hash = "#/proposta/" + pid;
      } catch (err) { R.toast(err.message); busy(ev.currentTarget, false); }
    });
  }

  /* ---------- detalhe ---------- */
  async function detail(id) {
    if (!S.detail || S.detail.proposal.id !== id) { shell("list", R.loadingHTML("Carregando a proposta…")); S.showText = false; S.otherSig = false; }
    try { S.detail = await api("proposals/" + id); } catch (e) { shell("list", `<div class="card"><div class="empty"><b>${esc(e.message)}</b><a class="pill pill-line" href="#/">Voltar</a></div></div>`); return; }
    renderDetail();
  }

  const MSG = {
    pt: { prop: (n, c, l) => `Olá${n ? ", " + n : ""}! Preparei a proposta de ${R.B.name} para ${c}. Pelo link você vê os serviços, escolhe as opções e já envia o pedido: ${l}`, ctr: (n, l) => `Olá, ${n}! O contrato com os serviços que você escolheu está pronto e já assinado por ${R.B.name}. Falta só a sua assinatura, por aqui: ${l}`, ord: (n, k) => `Olá, ${n}! Recebi o seu pedido da proposta nº ${k}.`, sp: `Proposta comercial · ${R.B.name}`, sc: `Contrato para assinatura · ${R.B.name}` },
    es: { prop: (n, c, l) => `¡Hola${n ? ", " + n : ""}! Preparé la propuesta de ${R.B.name} para ${c}. En el enlace ves los servicios, eliges las opciones y envías tu pedido: ${l}`, ctr: (n, l) => `¡Hola, ${n}! El contrato con los servicios que elegiste está listo y ya firmado por ${R.B.name}. Solo falta tu firma, aquí: ${l}`, ord: (n, k) => `¡Hola, ${n}! Recibí tu pedido de la propuesta nº ${k}.`, sp: `Propuesta comercial · ${R.B.name}`, sc: `Contrato para firmar · ${R.B.name}` },
    en: { prop: (n, c, l) => `Hi${n ? " " + n : ""}! I've prepared ${R.B.name}'s proposal for ${c}. At the link you can see the services, pick the options and send your order: ${l}`, ctr: (n, l) => `Hi ${n}! The agreement with the services you chose is ready and already signed by ${R.B.name}. It only needs your signature, here: ${l}`, ord: (n, k) => `Hi ${n}! I received your order for proposal no. ${k}.`, sp: `Commercial proposal · ${R.B.name}`, sc: `Agreement to sign · ${R.B.name}` },
  };
  const msgs = (p) => MSG[p.lang] || MSG.pt;

  function renderDetail() {
    const { proposal: p, contract: c, seller } = S.detail;
    const link = `${origin}/p/${p.id}`;
    const off = !!S.detail.offline, unpub = p.published === false;
    const ps = { ...p, expired: (S.data.proposals.find((x) => x.id === p.id) || {}).expired };
    const M = msgs(p);
    const msg = M.prop(first(p.client.contact), p.client.name, link);
    const o = p.order;
    shell("list", `
      <a class="back" href="#/">← Todas as propostas</a>
      <div class="pgh"><div><span class="label">Proposta nº ${esc(p.number)} · criada em ${esc(R.dateTime(p.createdAt))}</span><h1>${esc(p.client.name || (o && o.client.name) || "Sem nome")}</h1><p class="sub">${esc(p.title)}</p></div>
        <div class="acts">${stPill(ps)}${p.archived ? '<span class="st recusada">Arquivada</span>' : ""}<select class="sel" id="dFolder" style="width:auto" aria-label="Pasta do cliente"><option value="">Sem pasta</option>${folders().map((f) => `<option value="${f.id}"${f.id === p.folderId ? " selected" : ""}>${esc(f.name)}</option>`).join("")}</select><button type="button" class="pill pill-line" id="archBtn">${p.archived ? "Desarquivar" : "Arquivar"}</button><button type="button" class="pill ${off ? "pill-green" : "pill-line"}" id="pubBtn">${off ? "Publicar" : "Despublicar"}</button><a class="pill pill-line" href="/p/${p.id}?preview=1&k=${S.detail.previewKey || ""}" target="_blank" rel="noopener">Ver como o cliente</a><a class="pill pill-line" href="#/proposta/${p.id}/editar">Editar</a><button type="button" class="pill pill-line" id="zipBtn" title="Proposta, contratos, assinaturas e histórico">Baixar arquivo .zip</button>${c && c.status === "assinado" && !isAdm() ? "" : '<button type="button" class="pill pill-line" id="delBtn">Excluir</button>'}</div></div>
      <div class="cols">
        <div class="stack">
          ${contractBlock(p, c)}
          ${o ? orderBlock(o, p, c) : `<div class="card"><h2>Pedido do cliente</h2><p class="muted">${p.status === "recusada" ? `O cliente avisou que não é o momento${p.declined && p.declined.reason ? `: “${esc(p.declined.reason)}”` : "."}` : p.views ? `O cliente abriu a proposta ${p.views} vez(es), a última em ${esc(R.dateTime(p.lastViewAt))}. O pedido aparece aqui assim que ele enviar.` : "Assim que o cliente escolher os serviços e enviar, o pedido aparece aqui com os dados para o contrato."}</p>${p.status === "recusada" ? '<div class="row-acts"><button type="button" class="pill pill-line" id="reopenBtn">Reabrir para o cliente</button></div>' : ""}</div>`}
          <div class="card"><h2>Serviços oferecidos</h2><ul class="lines">${p.services.map((s) => `<li><span>${esc(s.name)}${s.recommended ? ' <span class="muted small">· recomendado</span>' : ""}</span><span class="v">${priceRange(s, p.currency)}</span><small>${s.payment.map((x) => `${esc(x.label)}: ${mny(x.total, p.currency)}`).join(" · ")}</small></li>`).join("")}</ul></div>
        </div>
        <div class="stack">
          ${off ? `<div class="warnbox"><span><b>Proposta fora do ar.</b> ${unpub ? "Ela foi despublicada" : `A validade venceu em ${esc(R.dateLong(p.validUntil))} sem pedido do cliente`}; quem abrir o link vê o aviso de proposta indisponível.${!unpub && !isAdm() ? " Só o administrador pode publicá-la de novo." : ""}</span>${!unpub && !isAdm() ? "" : '<button type="button" class="pill pill-cream pill-sm" id="pubBtn2">Publicar de novo</button>'}</div>` : ""}
          <div class="card share"><div class="ch"><h2>Link da proposta</h2>${p.sentAt ? `<span class="muted small">Enviada em ${esc(R.dateTime(p.sentAt))}</span>` : ""}</div>
            <div class="linkbox"><input class="inp" readonly value="${esc(link)}" id="plink"><button type="button" class="pill pill-cream" data-share="copiar">Copiar</button></div>
            <div class="row-acts">${S.data.waEnabled ? `<button type="button" class="pill pill-green" id="waProp">Enviar no WhatsApp (automático)</button><a class="pill pill-line" data-share="whatsapp" href="${waLink(p.client.phone, msg)}" target="_blank" rel="noopener">Abrir no meu WhatsApp</a>` : `<a class="pill pill-green" data-share="whatsapp" href="${waLink(p.client.phone, msg)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>`}${S.data.emailEnabled ? `<button type="button" class="pill pill-line" id="mailProp">${p.client.email ? "Enviar por e-mail" : "Enviar por e-mail…"}</button>` : p.client.email ? `<a class="pill pill-line" data-share="e-mail" href="mailto:${esc(p.client.email)}?subject=${encodeURIComponent(M.sp)}&body=${encodeURIComponent(msg)}">Enviar por e-mail</a>` : ""}${!p.sentAt ? '<button type="button" class="pill pill-line" data-share="manual">Marcar como enviada</button>' : ""}</div>
            <dl class="kv"><dt>Visualizações</dt><dd>${p.views ? `${p.views} · última em ${esc(R.dateTime(p.lastViewAt))}` : "Ainda não abriu"}</dd><dt>Válida até</dt><dd>${esc(R.dateLong(p.validUntil))}${ps.expired ? ' <span class="st vencida">Vencida</span>' : ""}</dd><dt>País</dt><dd>${esc(countryName(p.country || "BR"))} · ${LANG[p.lang || "pt"]} · ${esc(p.currency || "BRL")}</dd>${seller ? `<dt>Consultor</dt><dd>${esc(seller.name)}${seller.phone ? " · " + esc(seller.phone) : ""}</dd>` : ""}${p.client.contact ? `<dt>Contato</dt><dd>${esc(p.client.contact)}</dd>` : ""}${p.client.phone ? `<dt>WhatsApp</dt><dd>${esc(p.client.phone)}</dd>` : ""}</dl>
          </div>
          <div class="card"><h2>Histórico</h2><ol class="timeline">${(p.history || []).slice().reverse().map((h) => `<li><time>${esc(R.dateTime(h.at))}</time><span>${esc(h.text)}</span></li>`).join("")}</ol></div>
        </div>
      </div>`);
    bindDetail();
  }

  function orderBlock(o, p, c) {
    const t = o.totals, cl = o.client, cur = p.currency || "BRL", br = isBRp(p);
    return `<div class="card${!c ? " accent" : ""}"><div class="ch"><h2>Pedido do cliente</h2><span class="muted small">Recebido em ${esc(R.dateTime(o.submittedAt))}</span></div>
      <ul class="lines">${t.lines.map((l) => `<li><span>${esc(l.name)}</span><span class="v">${mny(l.total, cur)}${l.kind === "mensal" ? "/mês" : ""}</span><small>${esc(l.optionLabel)} · ${esc(l.schedule)}${l.kind === "mensal" ? ` · mínimo ${l.minMonths} meses` : ""}</small></li>`).join("")}</ul>
      <div class="tot">${t.once ? `<span>Projetos <b>${mny(t.once, cur)}</b></span>` : ""}${t.monthly ? `<span>Mensal <b>${mny(t.monthly, cur)}</b></span>` : ""}<span>Para começar <b>${mny(t.upfront, cur)}</b></span></div>
      <dl class="kv"><dt>Contratante</dt><dd>${esc(cl.name)}</dd><dt>${br ? "CPF/CNPJ" : "Documento"}</dt><dd>${esc(docFmt(cl.doc, br))}</dd>${cl.representative ? `<dt>Responsável</dt><dd>${esc(cl.representative)}</dd>` : ""}<dt>E-mail</dt><dd>${esc(cl.email)}</dd><dt>WhatsApp</dt><dd><a href="${waLink(cl.phone, msgs(p).ord(first(cl.representative || cl.name), p.number))}" target="_blank" rel="noopener">${esc(cl.phone)}</a></dd><dt>Endereço</dt><dd>${esc(cl.address)}, ${esc(cl.city)}${!br && cl.country ? ", " + esc(cl.country) : ""}</dd></dl>
      ${o.notes ? `<p class="note">${esc(o.notes)}</p>` : ""}
      ${!c ? '<div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="genBtn">Gerar contrato</button></div>' : ""}
    </div>`;
  }

  function docPreview(text) {
    let firstH = true;
    return String(text || "").split(/\n{2,}/).map((b) => {
      const hl = (s) => esc(s).replace(/⟦([a-z_]+)⟧/g, '<span class="var">$1</span>');
      if (b.startsWith("## ")) { const [h, ...r] = b.split("\n"); const tag = firstH ? "h1" : "h4"; firstH = false; return `<${tag}>${esc(h.slice(3))}</${tag}>` + (r.length ? `<p>${hl(r.join("\n"))}</p>` : ""); }
      firstH = false; return `<p>${hl(b)}</p>`;
    }).join("");
  }
  function numberClauses(text) {
    let n = 0, k = 0, firstH = true;
    return String(text).split("\n").map((l) => {
      if (l.startsWith("## ")) { if (firstH) { firstH = false; return l; } n++; k = 0; return `## ${n}. ${l.slice(3)}`; }
      if (l.startsWith("§ ")) { k++; return `${n}.${k}. ${l.slice(2)}`; }
      return l;
    }).join("\n").replace(/\n{3,}/g, "\n\n");
  }
  const VAR_LABEL = { empresa_cnpj: "CPF ou CNPJ da empresa", empresa_endereco: "endereço da empresa", empresa_email: "e-mail da empresa", empresa_razao: "razão social ou nome completo", empresa_representante: "representante da empresa", empresa_cidade: "cidade (foro)" };

  function interLine(c) {
    const it = c.signatures && c.signatures.intermediary;
    if (!c.seller) return "";
    return it ? `<p class="muted small" style="margin:0">Intermediador e testemunha: <b>${esc(it.name)}</b>, assinado em ${esc(R.dateTime(it.at))}.</p>` : "";
  }

  function contractBlock(p, c) {
    if (!c) return "";
    const st = S.data.settings;
    const link = `${origin}/c/${c.id}`;
    const cl = c.client, M = msgs(p);
    if (c.status === "assinado") {
      const s = c.signatures.client;
      return `<div class="card ok"><div class="ch"><h2>Contrato assinado</h2><span class="st assinada">Assinado</span></div>
        <div class="okbox">Assinado por <b>${esc(s.name)}</b> em ${esc(R.dateTime(s.at))}. A cópia com as assinaturas e o registro de auditoria está no PDF.</div>
        ${interLine(c)}
        <div class="row-acts"><a class="pill pill-green" href="/api/public/contract/${c.id}/pdf?download=1">Baixar PDF</a><a class="pill pill-line" href="/c/${c.id}" target="_blank" rel="noopener">Abrir página do contrato</a></div>
        <p class="muted small">Código de verificação: ${esc(c.hash)}</p></div>`;
    }
    if (c.status === "aguardando") {
      const msg = M.ctr(first(cl.representative || cl.name), link);
      const ag = c.signatures.agency;
      return `<div class="card accent"><div class="ch"><h2>Contrato aguardando o cliente</h2><span class="st contrato">Aguardando</span></div>
        <p class="muted small">Assinado pela empresa em ${esc(R.dateTime(ag.at))}${ag.appliedBy ? `, aplicado por ${esc(ag.appliedBy)}` : ""}. Envie o link para o cliente assinar.</p>
        ${interLine(c)}
        <div class="linkbox"><input class="inp" readonly value="${esc(link)}"><button type="button" class="pill pill-cream" data-copy="${esc(link)}">Copiar</button></div>
        <div class="row-acts"><a class="pill pill-green" href="${waLink(cl.phone, msg)}" target="_blank" rel="noopener">Enviar no WhatsApp</a><a class="pill pill-line" href="mailto:${esc(cl.email)}?subject=${encodeURIComponent(M.sc)}&body=${encodeURIComponent(msg)}">Enviar por e-mail</a><a class="pill pill-line" href="/c/${c.id}" target="_blank" rel="noopener">Abrir</a><button type="button" class="pill pill-line" id="cancelC">Cancelar contrato</button></div></div>`;
    }
    // rascunho
    const miss = [...new Set((c.text.match(/⟦([a-z_]+)⟧/g) || []).map((m) => m.slice(1, -1)))];
    const inter = c.signatures && c.signatures.intermediary;
    const needInter = !!c.seller && !inter;
    const head = `<div class="card accent" id="cDraft"><div class="ch"><h2>Contrato · rascunho${c.lang && c.lang !== "pt" ? ` · ${LANG[c.lang].toLowerCase()}` : ""}</h2><div class="row-acts"><button type="button" class="pill pill-line pill-sm" id="regenC">Atualizar com os dados atuais</button><button type="button" class="pill pill-line pill-sm" id="pdfC">Prévia em PDF</button><button type="button" class="pill pill-line pill-sm" id="cancelC">Descartar</button></div></div>
      ${miss.length ? `<div class="warnbox"><span>Faltam dados no contrato: ${miss.map((m) => VAR_LABEL[m] || m).join(", ")}.</span>${isAdm() ? '<a class="pill pill-cream pill-sm" href="#/empresa">Completar em Dados da empresa</a>' : "<span>Peça ao administrador para completar.</span>"}</div>` : `<div class="okbox">Contrato preenchido com os dados do pedido. Revise o texto antes de assinar.</div>`}
      <div class="preview-doc" id="cPrev"${S.showText ? " hidden" : ""}>${docPreview(c.text)}</div>
      <div id="cEdit"${S.showText ? "" : " hidden"}><textarea class="ta mono" id="cText" rows="22">${esc(c.text)}</textarea><div class="row-acts" style="margin-top:10px"><button type="button" class="pill pill-cream" id="saveText">Salvar texto</button><span class="muted small">Linhas que começam com ## viram títulos.${c.seller ? " Mudar o texto apaga a assinatura do intermediador." : ""}</span></div></div>
      <div class="row-acts"><button type="button" class="pill pill-line pill-sm" id="toggleText">${S.showText ? "Ver como documento" : "Editar o texto deste contrato"}</button></div>`;
    const emailSw = (S.data.emailEnabled ? `<label class="switch"><input type="checkbox" id="aEmail" checked>Enviar o link por e-mail para ${esc(cl.email)}</label>` : "") + (S.data.waEnabled && cl.phone ? `<label class="switch"><input type="checkbox" id="aWa"${st.waClient !== false ? " checked" : ""}>Enviar o link no WhatsApp do cliente (${esc(cl.phone)})</label>` : "");

    if (!isAdm()) {
      const m0 = me(), sg = st.agencySignature, canSend = st.sellersUseAgencySignature && sg;
      const interPanel = !c.seller
        ? `<div class="okbox">O administrador seguiu sem intermediador neste contrato. Não é preciso assinar.</div>`
        : inter
        ? `<div class="okbox">Você assinou como intermediador e testemunha em ${esc(R.dateTime(inter.at))}.</div>`
        : !m0.doc ? `<div class="warnbox"><span>Cadastre o seu CPF para assinar como intermediador.</span><a class="pill pill-cream pill-sm" href="#/perfil">Ir para Meu perfil</a></div>`
        : `${m0.hasSignature ? `<label class="switch"><input type="checkbox" id="iSaved" checked>Usar a assinatura salva no meu perfil</label>` : ""}
           <div id="iPadWrap"${m0.hasSignature ? " hidden" : ""}><div id="iPad"></div><div class="row-acts" style="margin-top:8px"><button type="button" class="link-btn" id="iClear">Limpar</button>${m0.hasSignature ? "" : '<label class="switch" style="margin-left:auto"><input type="checkbox" id="iKeep" checked>Salvar no meu perfil</label>'}</div></div>
           <p class="muted small" style="margin:0">${esc(m0.name)} · CPF ${esc(R.maskDoc(m0.doc))}</p>
           <div class="row-acts"><button type="button" class="pill pill-cream pill-lg" id="iSign">Assinar como intermediador e testemunha</button></div>`;
      return `${head}
        <h2 style="margin-top:8px">1. Sua assinatura · intermediador e testemunha</h2>${interPanel}
        <h2 style="margin-top:8px">2. Liberar para o cliente</h2>
        ${canSend ? `<p class="muted small" style="margin:0">A assinatura padrão da empresa (${esc(sg.name)}) é aplicada ao liberar, com o registro de que foi você quem liberou.</p>${emailSw}<div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="sendC"${miss.length || (c.seller && !inter) ? " disabled" : ""}>Liberar contrato para o cliente</button></div>` : `<div class="warnbox">A liberação com a assinatura da empresa está restrita ao administrador. Depois de assinar como intermediador, avise o administrador para liberar o contrato.</div>`}
      </div>`;
    }

    const sig = st.agencySignature;
    return `${head}
      ${c.seller ? (inter ? `<div class="okbox">Intermediador e testemunha: <b>${esc(inter.name)}</b> assinou em ${esc(R.dateTime(inter.at))}.</div>` : `<div class="warnbox"><span>O consultor <b>${esc(c.seller.name)}</b> ainda precisa assinar como intermediador e testemunha, no acesso dele (Painel do consultor › esta proposta). Depois disso você libera o contrato.</span><button type="button" class="pill pill-cream pill-sm" id="dropInter">Seguir sem o consultor neste contrato</button></div>`) : ""}
      <h2 style="margin-top:8px">Assinatura da empresa</h2>
      ${sig && sig.image && !S.otherSig ? `<div class="sig-auto"><img src="${sig.image}" alt="Assinatura padrão da empresa"><div><b>${esc(sig.name)}</b><small>${esc(R.maskDoc(sig.doc || ""))} · aplicada automaticamente</small><button type="button" class="link-btn" id="sigOther">Usar outra assinatura só neste contrato</button></div></div>` : `<div class="grid2"><label class="fl"><span>Quem assina pela empresa *</span><input class="inp" id="aName" value="${esc((sig && sig.name) || st.agency.representative || "")}"></label><label class="fl"><span>CPF ou CNPJ *</span><input class="inp" id="aDoc" inputmode="numeric" value="${esc(R.maskDoc((sig && sig.doc) || st.agency.representativeDoc || st.agency.cnpj || ""))}"></label></div>
      <div id="aPadWrap"><div id="aPad"></div><div class="row-acts" style="margin-top:8px"><button type="button" class="link-btn" id="aClear">Limpar</button>${sig && sig.image ? '<button type="button" class="link-btn" id="sigBack">Voltar para a assinatura padrão</button>' : ""}</div></div>
      <label class="switch"><input type="checkbox" id="aSave">Salvar esta assinatura como padrão</label>`}
      ${emailSw}
      <div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="sendC"${miss.length || needInter ? " disabled" : ""}>Liberar contrato para o cliente</button></div>
    </div>`;
  }

  const sentMsg = (what, r) => { const via = [r.emailed && "e-mail", r.whatsapped && "WhatsApp"].filter(Boolean); return via.length ? `${what} e enviado ao cliente por ${via.join(" e ")}.` : `${what}. Envie o link ao cliente.`; };

  function bindDetail() {
    const { proposal: p, contract: c } = S.detail;
    $$("[data-share]").forEach((b) => b.addEventListener("click", async (e) => {
      const via = b.dataset.share;
      if (via === "copiar") { e.preventDefault(); copy($("#plink").value); }
      try { await post(`proposals/${p.id}/sent`, { via: via === "manual" ? "" : via }); S.detail = await api("proposals/" + p.id); await reload(); renderDetail(); } catch (err) {}
    }));
    $$("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy)));
    const wp = $("#waProp");
    if (wp) wp.addEventListener("click", async () => {
      let phone = p.client.phone;
      if (!phone) { phone = (prompt("WhatsApp do cliente (com DDD):") || "").trim(); if (!phone) return; }
      else if (!armed(wp, `Enviar para ${phone}?`)) return;
      busy(wp, true, "Enviando…");
      try { S.detail = await post(`proposals/${p.id}/whatsapp`, { phone }); await reload(); renderDetail(); R.toast(`Proposta enviada no WhatsApp ${phone}.`); }
      catch (err) { R.toast(err.message); busy(wp, false); }
    });
    const mp = $("#mailProp");
    if (mp) mp.addEventListener("click", async () => {
      let to = p.client.email;
      if (!to) { to = (prompt("E-mail do cliente para enviar a proposta:") || "").trim(); if (!to) return; }
      else if (!armed(mp, `Enviar para ${to}?`)) return;
      busy(mp, true, "Enviando…");
      try { S.detail = await post(`proposals/${p.id}/email`, { to }); await reload(); renderDetail(); R.toast(`Proposta enviada para ${to}.`); }
      catch (err) { R.toast(err.message); busy(mp, false); }
    });
    const del = $("#delBtn");
    $("#zipBtn").addEventListener("click", (e) => downloadZip(p.id, e.currentTarget));
    const publish = async (btn) => {
      const off = !!S.detail.offline, expired = p.validUntil && p.validUntil < S.data.today;
      let body;
      if (!off) {
        const ok = await confirmModal({ title: `Tirar a proposta nº ${esc(p.number)} do ar?`, html: `<p>Quem abrir o link passa a ver “Proposta indisponível”, com um botão para falar com vocês no WhatsApp. Nada é apagado, e você pode publicar de novo quando quiser.</p>`, confirm: "Despublicar" });
        if (!ok) return;
        body = { published: false };
      } else if (expired) {
        if (!isAdm()) { R.toast("Esta proposta venceu. Só o administrador pode publicá-la de novo."); return; }
        const def = (() => { const [y, m, d] = S.data.today.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + (S.data.settings.validityDays || 15))).toISOString().slice(0, 10); })();
        const v = await confirmModal({ eyebrow: "Publicar de novo", tone: "go", title: `A proposta nº ${esc(p.number)} venceu em ${esc(R.dateLong(p.validUntil))}`, html: `<p>Para voltar ao ar, defina a nova validade. Os valores e serviços continuam os mesmos; se quiser mudar algo, edite a proposta antes.</p><label class="fl"><span>Válida até</span><input class="inp" type="date" id="mdDate" min="${S.data.today}" value="${def}"></label>`, confirm: "Publicar", getValue: (w) => $("#mdDate", w).value || def });
        if (!v) return;
        body = { published: true, validUntil: v };
      } else body = { published: true };
      busy(btn, true, body.published ? "Publicando…" : "Despublicando…");
      try { S.detail = await post(`proposals/${p.id}/publish`, body); await reload(); renderDetail(); R.toast(body.published ? "Proposta publicada. O link voltou a funcionar." : "Proposta fora do ar."); }
      catch (err) { R.toast(err.message); busy(btn, false); }
    };
    $("#pubBtn").addEventListener("click", (e) => publish(e.currentTarget));
    const pb2 = $("#pubBtn2"); if (pb2) pb2.addEventListener("click", (e) => publish(e.currentTarget));
    if (del) del.addEventListener("click", async () => {
      const signed = c && c.status === "assinado";
      const ok = await confirmModal(signed
        ? { title: `Excluir a proposta nº ${esc(p.number)} com contrato assinado?`, html: `<p>Isso apaga a proposta, o pedido, o <b>contrato assinado</b>, as assinaturas e o registro de auditoria de <b>${esc(p.client.name || "")}</b>. O link do contrato enviado ao cliente deixa de funcionar.</p><p>Recomendado: baixe o arquivo .zip antes, para guardar uma cópia com valor de comprovação.</p>`, check: "Entendo que a exclusão não pode ser desfeita.", confirm: "Excluir definitivamente", extra: { label: "Baixar arquivo .zip antes", onClick: (ev) => downloadZip(p.id, ev.currentTarget) } }
        : { title: `Excluir a proposta nº ${esc(p.number)}?`, html: `<p>A proposta${c ? " e o contrato em andamento" : ""} de <b>${esc(p.client.name || "")}</b> serão apagados, e o link enviado ao cliente deixa de funcionar. A exclusão não pode ser desfeita.</p>`, confirm: "Excluir" });
      if (!ok) return;
      try { await api("proposals/" + p.id + (signed ? "?force=1" : ""), { method: "DELETE" }); await reload(); R.toast("Proposta excluída."); location.hash = "#/"; } catch (e) { R.toast(e.message); }
    });
    $("#dFolder").addEventListener("change", async (e) => { try { await bulk("move", [p.id], e.target.value || null); S.detail = await api("proposals/" + p.id); renderDetail(); R.toast(e.target.value ? `Movida para ${folderName(e.target.value)}.` : "Proposta fora da pasta."); } catch (err) { R.toast(err.message); } });
    $("#archBtn").addEventListener("click", async () => { try { await bulk(p.archived ? "unarchive" : "archive", [p.id]); R.toast(p.archived ? "Proposta de volta à lista." : "Proposta arquivada."); if (p.archived) { S.detail = await api("proposals/" + p.id); renderDetail(); } else location.hash = "#/"; } catch (err) { R.toast(err.message); } });
    const reopen = $("#reopenBtn");
    if (reopen) reopen.addEventListener("click", async () => { try { S.detail = await post(`proposals/${p.id}/reopen`); await reload(); renderDetail(); R.toast("Proposta reaberta."); } catch (e) { R.toast(e.message); } });
    const gen = $("#genBtn");
    if (gen) gen.addEventListener("click", async () => { busy(gen, true, "Gerando…"); try { S.detail = await post(`proposals/${p.id}/contract`); await reload(); renderDetail(); $("#cDraft").scrollIntoView({ behavior: "smooth" }); } catch (e) { R.toast(e.message); busy(gen, false); } });
    if (!c) return;
    const setC = (r) => { S.detail.contract = r.contract; if (r.proposal) S.detail.proposal = r.proposal; };
    const cancel = $("#cancelC");
    if (cancel) cancel.addEventListener("click", async () => { if (!armed(cancel, c.status === "rascunho" ? "Clique de novo para descartar" : "Clique de novo para cancelar")) return; try { S.detail = await post(`contracts/${c.id}/cancel`); S.detail.contract = null; await reload(); renderDetail(); R.toast("Contrato cancelado. O pedido continua salvo."); } catch (e) { R.toast(e.message); } });
    if (c.status !== "rascunho") return;
    $("#toggleText").addEventListener("click", () => { S.showText = !S.showText; renderDetail(); });
    $("#saveText").addEventListener("click", async (e) => { busy(e.currentTarget, true, "Salvando…"); try { setC(await put(`contracts/${c.id}`, { text: $("#cText").value })); S.showText = false; renderDetail(); R.toast("Texto do contrato salvo."); } catch (err) { R.toast(err.message); busy(e.currentTarget, false); } });
    $("#regenC").addEventListener("click", async (e) => { if ((S.showText || (c.signatures && c.signatures.intermediary)) && !armed(e.currentTarget, "Isso refaz o texto e apaga assinaturas do rascunho. Confirmar?")) return; busy(e.currentTarget, true, "Atualizando…"); try { setC(await post(`contracts/${c.id}/regenerate`)); await reload(); renderDetail(); R.toast("Contrato atualizado."); } catch (err) { R.toast(err.message); busy(e.currentTarget, false); } });
    $("#pdfC").addEventListener("click", async (e) => {
      busy(e.currentTarget, true, "Gerando…");
      try {
        const r = await fetch(`/api/admin/contracts/${c.id}/pdf`, { headers: { authorization: "Bearer " + S.token } });
        if (!r.ok) throw new Error("Não foi possível gerar a prévia.");
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement("a"); a.href = url; a.download = `previa-contrato-${c.number}.pdf`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 20000);
      } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
    const textDirty = () => S.showText && $("#cText").value !== c.text;

    if (!isAdm()) {
      const iSaved = $("#iSaved"), iWrap = $("#iPadWrap");
      const mount = () => { if (S.padInter || !$("#iPad")) return; S.padInter = R.SignPad($("#iPad")); $("#iClear").addEventListener("click", () => S.padInter.clear()); };
      S.padInter = null;
      if (iWrap && !iWrap.hidden) mount();
      if (iSaved) iSaved.addEventListener("change", () => { iWrap.hidden = iSaved.checked; if (!iSaved.checked) mount(); });
      const iSign = $("#iSign");
      if (iSign) iSign.addEventListener("click", async () => {
        if (textDirty()) { R.toast("Salve o texto editado antes de assinar."); return; }
        const body = {};
        if (iSaved && iSaved.checked) body.useSaved = true;
        else { if (!S.padInter || S.padInter.isEmpty()) { R.toast("Desenhe a sua assinatura."); return; } body.image = S.padInter.toPNG(); body.saveSignature = $("#iKeep") ? $("#iKeep").checked : false; }
        busy(iSign, true, "Assinando…");
        try { setC(await post(`contracts/${c.id}/intermediary`, body)); if (body.saveSignature) await reload(); renderDetail(); R.toast("Assinatura de intermediador registrada."); } catch (err) { R.toast(err.message); busy(iSign, false); }
      });
      const send = $("#sendC");
      if (send) send.addEventListener("click", async () => {
        if (textDirty()) { R.toast("Salve o texto editado antes de liberar."); return; }
        busy(send, true, "Liberando…");
        try { const r = await post(`contracts/${c.id}/send`, { emailClient: $("#aEmail") ? $("#aEmail").checked : false, waClient: $("#aWa") ? $("#aWa").checked : false }); S.detail = { ...S.detail, proposal: r.proposal, contract: r.contract, seller: r.seller }; await reload(); renderDetail(); R.toast(sentMsg("Contrato liberado", r)); }
        catch (err) { R.toast(err.message); busy(send, false); }
      });
      return;
    }

    const drop = $("#dropInter");
    if (drop) drop.addEventListener("click", async () => { if (!armed(drop, "Refaz o texto sem o consultor. Confirmar?")) return; try { setC(await post(`contracts/${c.id}/drop-intermediary`)); renderDetail(); R.toast("Contrato refeito sem o consultor. Já pode assinar e liberar."); } catch (err) { R.toast(err.message); } });
    const sig = S.data.settings.agencySignature;
    const useSaved = !!(sig && sig.image && !S.otherSig);
    const other = $("#sigOther"); if (other) other.addEventListener("click", () => { S.otherSig = true; renderDetail(); });
    const back = $("#sigBack"); if (back) back.addEventListener("click", () => { S.otherSig = false; renderDetail(); });
    if (!useSaved) {
      const docIn = $("#aDoc"); docIn.addEventListener("input", () => (docIn.value = R.maskDoc(docIn.value)));
      S.padAgency = R.SignPad($("#aPad")); $("#aClear").addEventListener("click", () => S.padAgency.clear());
    }
    $("#sendC").addEventListener("click", async (e) => {
      let signature = { useSaved: true };
      if (!useSaved) {
        const name = $("#aName").value.trim(), doc = R.digits($("#aDoc").value);
        if (name.length < 5) { R.toast("Informe o nome de quem assina pela empresa."); return; }
        if (!R.validDoc(doc)) { R.toast("CPF ou CNPJ de quem assina pela empresa é inválido."); return; }
        if (!S.padAgency || S.padAgency.isEmpty()) { R.toast("Desenhe a assinatura da empresa."); return; }
        signature = { name, doc, image: S.padAgency.toPNG() };
      }
      if (textDirty()) { R.toast("Salve o texto editado antes de assinar."); return; }
      busy(e.currentTarget, true, "Assinando…");
      try {
        const r = await post(`contracts/${c.id}/send`, { signature, saveSignature: !useSaved && $("#aSave") && $("#aSave").checked, emailClient: $("#aEmail") ? $("#aEmail").checked : false, waClient: $("#aWa") ? $("#aWa").checked : false });
        S.detail = { ...S.detail, proposal: r.proposal, contract: r.contract, seller: r.seller };
        await reload();
        renderDetail();
        R.toast(sentMsg("Contrato liberado", r));
      } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  /* ---------- equipe (consultores) ---------- */
  function team() {
    const users = S.data.users || [];
    const count = (uid) => S.data.proposals.filter((p) => p.sellerId === uid).length;
    const signedCount = (uid) => S.data.proposals.filter((p) => p.sellerId === uid && p.status === "assinada").length;
    const np = S.newPw;
    shell("team", `
      <div class="pgh"><div><span class="label">Equipe</span><h1>Consultores</h1><p class="sub">Vendedores e consultores entram com e-mail e senha, montam propostas, geram contratos e assinam como intermediadores e testemunhas.</p></div></div>
      ${np ? credBox(np) : ""}
      <div class="cols">
        <div class="stack">
          ${users.length ? `<div class="svc-pick" id="uList">${users.map((u) => userRow(u, count(u.id), signedCount(u.id))).join("")}</div>` : `<div class="card"><div class="empty"><b>Nenhum consultor ainda</b><span>Cadastre ao lado. Você recebe a senha de acesso para enviar a ele.</span></div></div>`}
        </div>
        <div class="stack">
          <div class="card"><h2>Novo consultor</h2>
            <label class="fl"><span>Nome completo *</span><input class="inp" id="nName" autocomplete="off"></label>
            <label class="fl"><span>E-mail de acesso *</span><input class="inp" id="nEmail" type="email" autocomplete="off"></label>
            <div class="grid2"><label class="fl"><span>WhatsApp</span><input class="inp" id="nPhone" inputmode="tel"></label><label class="fl"><span>CPF</span><input class="inp" id="nDoc" inputmode="numeric"><small>O consultor também pode completar depois.</small></label></div>
            <div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="nSave">Cadastrar e gerar senha</button></div>
          </div>
          <div class="card"><h2>Como funciona</h2>
            <ol class="timeline">
              <li><time>Acesso</time><span>O consultor entra em ${esc(origin)}/admin, aba Consultor, com o e-mail e a senha.</span></li>
              <li><time>Perfil</time><span>No primeiro acesso, ele completa o CPF e salva a assinatura em Meu perfil.</span></li>
              <li><time>Propostas</time><span>Ele monta e envia propostas. Só vê as dele. O cliente vê o nome e o WhatsApp dele.</span></li>
              <li><time>Contrato</time><span>Ele gera o contrato, assina como intermediador e testemunha e ${S.data.settings.sellersUseAgencySignature ? "libera para o cliente com a assinatura padrão da empresa" : "você libera com a assinatura da empresa"}.</span></li>
            </ol>
          </div>
        </div>
      </div>`);
    bindTeam();
  }

  function credBox(np) {
    const msg = `Olá, ${first(np.user.name)}! Seu acesso ao painel de propostas de ${R.B.name}:\n${origin}/admin (aba Consultor)\nE-mail: ${np.user.email}\nSenha: ${np.password}\n\nNo primeiro acesso, complete o seu CPF e salve a sua assinatura em Meu perfil. Depois, troque a senha por uma sua.`;
    return `<div class="card ok"><div class="ch"><h2>${np.reset ? "Nova senha gerada" : "Consultor cadastrado"}</h2><button type="button" class="pill pill-line pill-sm" id="credClose">Fechar</button></div>
      <p class="small" style="margin:0">Senha de <b>${esc(np.user.name)}</b>: <code class="pw">${esc(np.password)}</code>. Ela aparece só agora. Envie ao consultor:</p>
      <textarea class="ta" readonly rows="6" id="credMsg">${esc(msg)}</textarea>
      <div class="row-acts">${np.user.phone ? `<a class="pill pill-green" href="${waLink(np.user.phone, msg)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : ""}<a class="pill pill-line" href="mailto:${esc(np.user.email)}?subject=${encodeURIComponent("Acesso ao painel de propostas · " + R.B.name)}&body=${encodeURIComponent(msg)}">Enviar por e-mail</a><button type="button" class="pill pill-cream" id="credCopy">Copiar mensagem</button></div></div>`;
  }

  function userRow(u, n, sgn) {
    const open = S.userOpen === u.id;
    return `<div class="sp${open ? " on" : ""}" data-uid="${u.id}">
      <div class="sp-head" data-a="open" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${esc(u.name)}${u.active ? "" : ' <span class="st recusada">Desativado</span>'}</b><small>${esc(u.email)}${u.phone ? " · " + esc(u.phone) : ""} · ${u.doc ? "CPF ok" : "sem CPF"} · ${u.hasSignature ? "assinatura salva" : "sem assinatura"}</small></span><span class="pr">${n} proposta(s)${sgn ? ` · ${sgn} assinada(s)` : ""}</span></div>
      ${open ? `<div class="sp-body">
        <div class="grid3"><label class="fl"><span>Nome completo</span><input class="inp" data-u="name" value="${esc(u.name)}"></label><label class="fl"><span>WhatsApp</span><input class="inp" data-u="phone" value="${esc(u.phone || "")}"></label><label class="fl"><span>CPF</span><input class="inp" data-u="doc" inputmode="numeric" value="${esc(R.maskDoc(u.doc || ""))}"></label></div>
        <p class="muted small" style="margin:0">E-mail de acesso: ${esc(u.email)} · cadastrado em ${esc(R.dateTime(u.createdAt))}</p>
        <div class="row-acts"><button type="button" class="pill pill-cream pill-sm" data-a="save">Salvar</button><button type="button" class="pill pill-line pill-sm" data-a="reset">Gerar nova senha</button><button type="button" class="pill pill-line pill-sm" data-a="active" style="margin-left:auto">${u.active ? "Desativar acesso" : "Reativar acesso"}</button></div>
      </div>` : ""}
    </div>`;
  }

  function bindTeam() {
    const cc = $("#credClose"); if (cc) cc.addEventListener("click", () => { S.newPw = null; team(); });
    const cp = $("#credCopy"); if (cp) cp.addEventListener("click", () => copy($("#credMsg").value, "Mensagem copiada."));
    const nd = $("#nDoc"); nd.addEventListener("input", () => (nd.value = R.maskDoc(nd.value)));
    $("#nSave").addEventListener("click", async (e) => {
      const body = { name: $("#nName").value.trim(), email: $("#nEmail").value.trim(), phone: $("#nPhone").value.trim(), doc: R.digits($("#nDoc").value) };
      if (body.name.length < 5 || !body.name.includes(" ")) { R.toast("Informe o nome completo."); $("#nName").focus(); return; }
      if (!R.validEmail(body.email)) { R.toast("Informe um e-mail válido."); $("#nEmail").focus(); return; }
      if (body.doc && !R.validDoc(body.doc)) { R.toast("CPF inválido."); $("#nDoc").focus(); return; }
      busy(e.currentTarget, true, "Cadastrando…");
      try { const r = await post("users", body); S.newPw = { user: r.user, password: r.password }; await reload(); team(); }
      catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
    const list = $("#uList"); if (!list) return;
    list.addEventListener("input", (e) => { if (e.target.dataset.u === "doc") e.target.value = R.maskDoc(e.target.value); });
    list.addEventListener("click", async (e) => {
      const row = e.target.closest(".sp"); if (!row) return;
      const uid = row.dataset.uid, u = S.data.users.find((x) => x.id === uid);
      const b = e.target.closest("[data-a]"); if (!b) return;
      const a = b.dataset.a;
      if (a === "open") { S.userOpen = S.userOpen === uid ? null : uid; team(); return; }
      try {
        if (a === "save") {
          const g = (k) => row.querySelector(`[data-u="${k}"]`).value.trim();
          const doc = R.digits(g("doc"));
          if (doc && !R.validDoc(doc)) { R.toast("CPF inválido."); return; }
          busy(b, true, "Salvando…"); await put("users/" + uid, { name: g("name"), phone: g("phone"), doc }); await reload(); team(); R.toast("Consultor atualizado.");
        }
        if (a === "reset") { if (!armed(b, "A senha atual deixa de valer. Confirmar?")) return; const r = await post(`users/${uid}/reset`); S.newPw = { user: r.user, password: r.password, reset: true }; await reload(); team(); }
        if (a === "active") { if (u.active && !armed(b, "Clique de novo para desativar")) return; await put("users/" + uid, { active: !u.active }); await reload(); team(); R.toast(u.active ? "Acesso desativado." : "Acesso reativado."); }
      } catch (err) { R.toast(err.message); busy(b, false); }
    });
  }

  /* ---------- meu perfil (consultor) ---------- */
  async function profile() {
    shell("me", R.loadingHTML("Carregando o perfil…"));
    let sig = null;
    try { const r = await api("me"); S.data.me = r.me; sig = r.signature; } catch (e) { R.toast(e.message); }
    const u = me();
    shell("me", `
      <div class="pgh"><div><span class="label">Consultor</span><h1>Meu perfil</h1><p class="sub">Seus dados entram nos contratos em que você é intermediador e testemunha. O cliente vê o seu nome e o seu WhatsApp na proposta.</p></div></div>
      <div class="cols">
        <div class="stack">
          <div class="card"><h2>Dados</h2>
            <label class="fl"><span>Nome completo *</span><input class="inp" id="pName" value="${esc(u.name)}"></label>
            <div class="grid2"><label class="fl"><span>CPF *</span><input class="inp" id="pDoc" inputmode="numeric" value="${esc(R.maskDoc(u.doc || ""))}"></label><label class="fl"><span>WhatsApp</span><input class="inp" id="pPhone" inputmode="tel" value="${esc(u.phone || "")}"></label></div>
            <p class="muted small" style="margin:0">E-mail de acesso: ${esc(u.email)}</p>
            <div class="row-acts"><button type="button" class="pill pill-green" id="pSave">Salvar dados</button></div>
          </div>
          <div class="card"><h2>Minha assinatura</h2>
            ${sig ? `<div class="sig-saved" id="mySig"><img src="${sig}" alt="Sua assinatura salva"><button type="button" class="pill pill-line pill-sm" style="color:var(--ink)" id="sigNew">Desenhar outra</button></div>` : '<p class="muted small" style="margin:0">Desenhe uma vez e use em todos os contratos.</p>'}
            <div id="mePadWrap"${sig ? " hidden" : ""}><div id="mePad"></div><div class="row-acts" style="margin-top:8px"><button type="button" class="link-btn" id="meClear">Limpar</button><button type="button" class="pill pill-cream pill-sm" id="meSigSave" style="margin-left:auto">Salvar assinatura</button></div></div>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h2>Trocar senha</h2>
            <label class="fl"><span>Senha atual</span><input class="inp" type="password" id="pwCur" autocomplete="current-password"></label>
            <label class="fl"><span>Nova senha (mínimo 8 caracteres)</span><input class="inp" type="password" id="pwNew" autocomplete="new-password"></label>
            <div class="row-acts"><button type="button" class="pill pill-line" id="pwSave">Trocar senha</button></div>
          </div>
        </div>
      </div>`);
    const d = $("#pDoc"); d.addEventListener("input", () => (d.value = R.maskDoc(d.value)));
    $("#pSave").addEventListener("click", async (e) => {
      const name = $("#pName").value.trim(), doc = R.digits($("#pDoc").value);
      if (name.length < 5 || !name.includes(" ")) { R.toast("Informe o nome completo."); return; }
      if (!R.validDoc(doc) || doc.length !== 11) { R.toast("Informe um CPF válido."); return; }
      busy(e.currentTarget, true, "Salvando…");
      try { const r = await put("me", { name, doc, phone: $("#pPhone").value.trim() }); S.data.me = r.me; R.toast("Dados salvos."); } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
    const mount = () => { if (S.padMe) return; S.padMe = R.SignPad($("#mePad")); $("#meClear").addEventListener("click", () => S.padMe.clear()); };
    S.padMe = null;
    if (!sig) mount();
    const sn = $("#sigNew"); if (sn) sn.addEventListener("click", () => { $("#mySig").hidden = true; $("#mePadWrap").hidden = false; mount(); });
    $("#meSigSave").addEventListener("click", async (e) => {
      if (!S.padMe || S.padMe.isEmpty()) { R.toast("Desenhe a assinatura."); return; }
      busy(e.currentTarget, true, "Salvando…");
      try { const r = await put("me", { signature: S.padMe.toPNG() }); S.data.me = r.me; R.toast("Assinatura salva."); profile(); } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
    $("#pwSave").addEventListener("click", async (e) => {
      const cur = $("#pwCur").value, nw = $("#pwNew").value;
      if (nw.length < 8) { R.toast("A nova senha precisa de pelo menos 8 caracteres."); return; }
      busy(e.currentTarget, true, "Trocando…");
      try { const r = await put("me", { currentPassword: cur, newPassword: nw }); if (r.token) { S.token = r.token; R.store.set("adm", r.token); } $("#pwCur").value = ""; $("#pwNew").value = ""; R.toast("Senha trocada."); } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
  }

  /* ---------- catálogo de serviços ---------- */
  const incToText = (inc) => (inc || []).map((g) => (g.title ? `## ${g.title}\n` : "") + g.items.join("\n")).join("\n");
  const textToInc = (t) => { const out = []; let cur = null; String(t).split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => { if (l.startsWith("## ")) { cur = { title: l.slice(3).trim(), items: [] }; out.push(cur); } else { if (!cur) { cur = { title: "", items: [] }; out.push(cur); } cur.items.push(l.replace(/^[-•]\s*/, "")); } }); return out; };
  const stepsToText = (st) => (st || []).map((s) => `${s.title}: ${s.text}`).join("\n");
  const textToSteps = (t) => String(t).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i > 0 ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { title: l, text: "" }; });

  function catalog() {
    if (!S.cat) S.cat = clone(S.data.catalog);
    const L = S.catLang;
    shell("cat", `
      <div class="pgh"><div><span class="label">Catálogo</span><h1>Serviços</h1><p class="sub">Base para montar as propostas. Mudanças aqui valem para as próximas propostas; as já enviadas guardam os valores da época.</p></div>
        <div class="acts"><button type="button" class="pill pill-cream" id="catNew">Novo serviço</button></div></div>
      <div class="bar"><span class="muted small">Idioma dos textos:</span><div class="seg">${Object.entries(LANG).map(([k, v]) => `<button type="button" data-l="${k}" class="${L === k ? "on" : ""}">${v}</button>`).join("")}</div>${L !== "pt" ? `<span class="muted small">Valores são os mesmos do português. Campos vazios usam o texto em português.</span>` : ""}</div>
      <div class="svc-pick" id="catList">${S.cat.length ? S.cat.map((s, i) => catRow(s, i)).join("") : `<div class="card"><div class="empty"><b>Nenhum serviço cadastrado ainda</b><span>Clique em Novo serviço para cadastrar o primeiro. Ele passa a aparecer na hora de montar as propostas.</span></div></div>`}</div>
      ${SCH_HINT}
      <div class="savebar"><div class="inner"><span class="sb-sum">${S.cat.length} serviço(s) no catálogo</span><button type="button" class="pill pill-line pill-lg" id="catUndo">Descartar mudanças</button><button type="button" class="pill pill-green pill-lg" id="catSave">Salvar catálogo</button></div></div>`);
    bindCatalog();
  }

  const tr = (s) => { const L = S.catLang; if (L === "pt") return s; s.i18n = s.i18n || {}; s.i18n[L] = s.i18n[L] || {}; return s.i18n[L]; };
  const trGet = (s, k) => (S.catLang === "pt" ? s[k] : ((s.i18n || {})[S.catLang] || {})[k]);

  function catRow(s, i) {
    const open = S.catOpen === i, L = S.catLang, pt = L === "pt";
    const nm = (!pt && trGet(s, "name")) || s.name;
    const v = (k) => esc(trGet(s, k) || "");
    const ph = (k) => (pt ? "" : ` placeholder="${esc(s[k] || "")}"`);
    const tp = (s.i18n && s.i18n[L] && s.i18n[L].payment) || [];
    const dis = pt ? "" : " disabled";
    return `<div class="sp${open ? " on" : ""}" data-i="${i}">
      <div class="sp-head" data-a="open" style="grid-template-columns:auto minmax(0,1fr) auto"><label class="switch" title="Ativo nas novas propostas"><input type="checkbox" data-a="active"${s.active !== false ? " checked" : ""}></label><span><b>${esc(nm || "Sem nome")}</b><small>${esc(s.category || "")} · ${s.kind === "mensal" ? `mensal, mínimo ${s.minMonths || 1} meses` : "projeto único"}${s.group ? " · grupo " + esc(s.group) : ""}${s.active === false ? " · inativo" : ""}${!pt && !trGet(s, "name") ? " · sem tradução" : ""}</small></span><span class="pr">${s.payment.length ? priceRange(s) : "sem valor"}</span></div>
      ${open ? `<div class="sp-body">
        <div class="grid3"><label class="fl"><span>Nome</span><input class="inp" data-f="name" value="${v("name")}"${ph("name")}></label><label class="fl"><span>Categoria</span><input class="inp" data-f="category" value="${esc(s.category)}"${dis}></label><label class="fl"><span>Grupo de escolha única</span><input class="inp" data-f="group" value="${esc(s.group)}" placeholder="Ex.: pacotes"${dis}><small>Serviços com o mesmo grupo: o cliente escolhe só um.</small></label></div>
        <div class="grid3"><label class="fl"><span>Tipo</span><select class="sel" data-f="kind"${dis}><option value="unico"${s.kind !== "mensal" ? " selected" : ""}>Projeto único</option><option value="mensal"${s.kind === "mensal" ? " selected" : ""}>Mensal</option></select></label><label class="fl"><span>Contrato mínimo (meses)</span><input class="inp" type="number" min="1" data-f="minMonths" value="${esc(s.minMonths || 1)}"${s.kind === "mensal" && pt ? "" : " disabled"}></label><label class="fl"><span>Prazo</span><input class="inp" data-f="deadline" value="${v("deadline")}"${pt ? ' placeholder="Ex.: Até 65 dias úteis"' : ph("deadline")}></label></div>
        <label class="fl"><span>Chamada</span><input class="inp" data-f="tagline" value="${v("tagline")}"${ph("tagline")}></label>
        <label class="fl"><span>Descrição</span><textarea class="ta" data-f="description" rows="4"${ph("description")}>${v("description")}</textarea></label>
        <div class="grid2"><label class="fl"><span>O que está incluso</span><textarea class="ta" data-f="includes" rows="9" placeholder="${pt ? "## Título do grupo&#10;Item&#10;Item" : esc(incToText(s.includes))}">${esc(incToText(trGet(s, "includes")))}</textarea><small>Uma linha por item. Linhas com ## criam um grupo.</small></label><label class="fl"><span>Etapas</span><textarea class="ta" data-f="steps" rows="9" placeholder="${pt ? "Título: explicação" : esc(stepsToText(s.steps))}">${esc(stepsToText(trGet(s, "steps")))}</textarea><small>Uma etapa por linha, no formato Título: explicação.</small></label></div>
        <label class="fl"><span>Observação</span><input class="inp" data-f="notes" value="${v("notes")}"${ph("notes")}></label>
        ${pt ? optRowsHTML(s, "", "data-k", "BRL") : `<div class="opt-rows"><div class="opt-row h tr"><span>Forma de pagamento</span><span>Valor</span><span>Como o cliente paga</span></div>${s.payment.map((o, k) => `<div class="opt-row tr" data-k="${k}"><input class="inp" data-t="label" value="${esc((tp[k] || {}).label || "")}" placeholder="${esc(o.label)}"><span class="muted small">${brl(o.total)}</span><input class="inp" data-t="schedule" value="${esc((tp[k] || {}).schedule || "")}" placeholder="${esc(o.schedule)}"></div>`).join("")}</div>`}
        ${pt ? `<div class="row-acts"><button type="button" class="pill pill-line pill-sm" data-a="addopt">Adicionar forma de pagamento</button><button type="button" class="pill pill-line pill-sm" data-a="del" style="margin-left:auto">Excluir serviço</button></div>` : ""}
      </div>` : ""}
    </div>`;
  }

  function bindCatalog() {
    $$("[data-l]").forEach((b) => b.addEventListener("click", () => { S.catLang = b.dataset.l; catalog(); }));
    const list = $("#catList");
    const rerow = (i) => { const old = list.querySelector(`[data-i="${i}"]`); old.outerHTML = catRow(S.cat[i], i); };
    list.addEventListener("click", (e) => {
      const row = e.target.closest(".sp"); if (!row) return;
      const i = +row.dataset.i, s = S.cat[i];
      if (e.target.closest(".switch")) return;
      const b = e.target.closest("[data-a]");
      if (!b) return;
      if (b.dataset.a === "open" && !e.target.closest("input")) { const prev = S.catOpen; S.catOpen = prev === i ? null : i; if (prev != null && prev !== i) rerow(prev); rerow(i); return; }
      if (b.dataset.a === "addopt") { s.payment.push({ id: "", label: "Nova opção", total: 0, upfront: 0, n: 0, schedule: "" }); rerow(i); }
      if (b.dataset.a === "delopt") { const k = +b.closest(".opt-row").dataset.k; s.payment.splice(k, 1); if (s.i18n) Object.values(s.i18n).forEach((t) => t.payment && t.payment.splice(k, 1)); rerow(i); }
      if (b.dataset.a === "del") { if (!armed(b, "Clique de novo para excluir")) return; S.cat.splice(i, 1); S.catOpen = null; catalog(); }
    });
    list.addEventListener("change", (e) => {
      const row = e.target.closest(".sp"); if (!row) return;
      const i = +row.dataset.i, s = S.cat[i];
      if (e.target.dataset.a === "active") { s.active = e.target.checked; rerow(i); }
      if (e.target.dataset.f === "kind") { s.kind = e.target.value; if (s.kind === "mensal" && !s.minMonths) s.minMonths = 6; rerow(i); }
    });
    list.addEventListener("input", (e) => {
      const row = e.target.closest(".sp"); if (!row) return;
      const s = S.cat[+row.dataset.i], f = e.target.dataset.f, o = e.target.dataset.o, t = e.target.dataset.t;
      const pt = S.catLang === "pt";
      const tgt = ["name", "tagline", "description", "includes", "steps", "deadline", "notes"].includes(f) ? tr(s) : s;
      if (f === "includes") tgt.includes = textToInc(e.target.value);
      else if (f === "steps") tgt.steps = textToSteps(e.target.value);
      else if (f === "minMonths") s.minMonths = Math.max(1, Math.round(num(e.target.value)) || 1);
      else if (f && f !== "kind") tgt[f] = e.target.value;
      if (o && pt) { const op = s.payment[+e.target.closest(".opt-row").dataset.k]; op[o] = o === "total" || o === "upfront" ? num(e.target.value) : o === "n" ? Math.max(0, Math.min(24, Math.round(num(e.target.value)))) : e.target.value; }
      if (t) { const k = +e.target.closest(".opt-row").dataset.k, x = tr(s); x.payment = x.payment || []; while (x.payment.length <= k) x.payment.push({ label: "", schedule: "" }); x.payment[k][t] = e.target.value; }
      if (f === "name" || o) { const b = row.querySelector(".sp-head b"); if (b) b.textContent = (pt ? s.name : tr(s).name || s.name) || "Sem nome"; const pr = row.querySelector(".pr"); if (pr && s.payment.length) pr.textContent = priceRange(s); }
    });
    $("#catNew").addEventListener("click", () => { S.catLang = "pt"; S.cat.push({ id: "", active: true, category: "", group: "", name: "Novo serviço", kind: "unico", minMonths: 0, tagline: "", description: "", includes: [], steps: [], deadline: "", notes: "", payment: [{ id: "", label: "À vista", total: 0, upfront: 0, n: 0, schedule: "{total} pagos no início do projeto" }] }); S.catOpen = S.cat.length - 1; catalog(); $(`[data-i="${S.catOpen}"]`).scrollIntoView({ behavior: "smooth" }); });
    $("#catUndo").addEventListener("click", () => { S.cat = null; S.catOpen = null; catalog(); R.toast("Mudanças descartadas."); });
    $("#catSave").addEventListener("click", async (e) => {
      const bad = S.cat.find((s) => !s.name.trim() || !s.payment.length || s.payment.some((o) => !(o.total > 0)));
      if (bad) { R.toast(`Confira o nome e os valores de “${bad.name || "serviço sem nome"}”.`); return; }
      busy(e.currentTarget, true, "Salvando…");
      try { await put("catalog", { catalog: S.cat }); await reload(); S.cat = null; catalog(); R.toast("Catálogo salvo."); } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  /* ---------- configurações ---------- */
  /* ---------- dados da empresa (white label) ---------- */
  // Tudo que identifica a empresa: dados do contrato, contato, logo, cores, fontes, textos, remetente dos e-mails,
  // assinatura padrão e galeria de trabalhos. Logos e imagens são salvos na hora; o resto no botão Salvar.
  const DEF_COLORS = { primary: "#3b63d9", accent: "#e07b39", dark: "#111318", light: "#f2f0ea" };
  const COLOR_LABEL = { primary: ["Cor principal", "Botões e destaques"], accent: ["Cor de destaque", "Títulos em destaque e detalhes"], dark: ["Fundo escuro", "Fundo das páginas e textos sobre fundo claro"], light: ["Fundo claro", "Textos sobre fundo escuro e áreas claras"] };
  function empresa() {
    const st = S.data.settings, a = st.agency, b = st.brand || {};
    if (!S.biz) S.biz = { colors: { ...DEF_COLORS, ...(b.colors || {}) }, fontTitle: b.fontTitle || "archivo", fontText: b.fontText || "alexandria" };
    const C = S.biz.colors, fonts = S.data.fonts || [];
    const fld = (k, l, ph = "", hint = "") => `<label class="fl"><span>${l}</span><input class="inp" data-ag="${k}" value="${esc(/cnpj|Doc/.test(k) ? R.maskDoc(a[k] || "") : a[k] || "")}" placeholder="${esc(ph)}"${/cnpj|Doc/.test(k) ? ' inputmode="numeric"' : ""}>${hint ? `<small>${hint}</small>` : ""}</label>`;
    const logoSlot = (kind, title, hint) => {
      const v = b.logos && b.logos[kind];
      return `<div class="logo-slot ${kind}"><div class="logo-prev">${v ? `<img src="/api/public/logo/${kind}${R.imgQ(v)}" alt="">` : `<span class="wordmark">${esc(a.name || "Sua empresa")}</span>`}</div>
        <div><b>${title}</b><small>${hint}</small><div class="row-acts"><label class="pill pill-cream pill-sm">${v ? "Trocar" : "Enviar logo"}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-logo="${kind}" hidden></label>${v ? `<button type="button" class="link-btn" data-logo-del="${kind}">Remover</button>` : ""}</div></div></div>`;
    };
    const fontSel = (id, cur) => `<select class="sel" id="${id}">${fonts.map(([k, l]) => `<option value="${k}"${k === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const pf = b.portfolio || [];
    shell("biz", `
      <div class="pgh"><div><span class="label">White label</span><h1>Dados da empresa</h1><p class="sub">Nome, logo, cores, fontes e textos que aparecem nas propostas, nos contratos, nos e-mails e no WhatsApp. Serve para empresas e para freelancers.</p></div></div>
      <div class="cols">
        <div class="stack">
          <div class="card"><h2>Identificação e contrato</h2>
            <div class="grid2">${fld("name", "Nome que o cliente vê *", "Ex.: Estúdio Aurora ou Ana Souza Fotografia")}${fld("legalName", "Razão social ou nome completo *", "Como deve sair no contrato")}${fld("cnpj", "CNPJ ou CPF *", "", "Freelancer sem CNPJ pode usar o CPF.")}${fld("email", "E-mail *")}</div>
            ${fld("address", "Endereço completo *", "Rua, número, bairro e CEP")}
            <div class="grid3">${fld("city", "Cidade do foro *", "Ex.: Curitiba - PR")}${fld("representative", "Representante legal *", "Quem assina pela empresa")}${fld("representativeDoc", "CPF do representante")}</div>
            ${fld("pix", "Chave Pix", "", "Opcional. Aparece na cláusula de pagamento dos contratos em português.")}
          </div>
          <div class="card"><h2>Contato</h2>
            <div class="grid3"><label class="fl"><span>WhatsApp</span><input class="inp" id="cWa" inputmode="tel" value="${esc(st.whatsapp || "")}" placeholder="5511999990000"></label><label class="fl"><span>Instagram</span><input class="inp" id="cIg" value="${esc(st.instagram || "")}" placeholder="@suaempresa"></label><label class="fl"><span>Site</span><input class="inp" id="cSite" value="${esc(st.site || "")}" placeholder="https://"></label></div>
            <p class="muted small" style="margin:0">Aparecem no rodapé das propostas e nos botões de WhatsApp. O WhatsApp também recebe os avisos de pedido e assinatura.</p>
          </div>
          <div class="card"><h2>Textos da proposta</h2>
            <label class="fl"><span>Slogan</span><input class="inp" id="bTag" maxlength="160" value="${esc(b.tagline || "")}" placeholder="Ex.: Fotografia de casamento em todo o Brasil"><small>Rodapé das páginas, dos e-mails e do PDF.</small></label>
            <label class="fl"><span>Texto de apresentação</span><textarea class="ta" id="cIntro" rows="4">${esc(st.intro)}</textarea></label>
            <label class="fl"><span>Quem somos</span><textarea class="ta" id="bAbout" rows="4">${esc(b.about || "")}</textarea></label>
            <div class="grid2"><label class="fl"><span>Número em destaque</span><input class="inp" id="bStatV" maxlength="12" value="${esc(b.statValue || "")}" placeholder="Ex.: +10"></label><label class="fl"><span>Legenda do número</span><input class="inp" id="bStatL" maxlength="60" value="${esc(b.statLabel || "")}" placeholder="Ex.: anos de experiência"></label></div>
            <label class="fl"><span>Como trabalhamos</span><textarea class="ta" id="bPrin" rows="4">${esc((b.principles || []).join("\n"))}</textarea><small>Uma frase por linha, até 6. Em branco, o bloco não aparece.</small></label>
            <label class="fl"><span>Próximos passos</span><textarea class="ta" id="cNext" rows="5">${esc(stepsToText(st.nextSteps))}</textarea><small>Um passo por linha, no formato Título: explicação. Textos editados aparecem iguais em todos os idiomas; os padrão já têm tradução.</small></label>
          </div>
          <div class="card"><div class="ch"><h2>Galeria de trabalhos</h2><label class="pill pill-cream pill-sm">Adicionar imagens<input type="file" accept="image/png,image/jpeg,image/webp" id="pfAdd" multiple hidden></label></div>
            <p class="muted small" style="margin:0">Aparece nas propostas quando tiver pelo menos uma imagem. As fotos são reduzidas para 1600 px antes de enviar.</p>
            ${pf.length ? `<ul class="pf-list">${pf.map((x, i) => `<li data-pf="${esc(x.id)}"><img src="/api/public/portfolio/${encodeURIComponent(x.id)}${R.imgQ(x.v)}" alt=""><input class="inp" data-pf-name value="${esc(x.name || "")}" placeholder="Legenda (opcional)"><div class="row-acts"><button type="button" class="link-btn" data-pf-up="${i}"${i ? "" : " disabled"}>↑</button><button type="button" class="link-btn" data-pf-del="${esc(x.id)}">Remover</button></div></li>`).join("")}</ul>` : `<div class="empty"><span>Nenhuma imagem ainda.</span></div>`}
          </div>
        </div>
        <div class="stack">
          <div class="card"><h2>Logo</h2>
            ${logoSlot("escuro", "Para fundo escuro", "Topo das páginas e do painel. De preferência PNG claro com fundo transparente.")}
            ${logoSlot("claro", "Para fundo claro", "Rodapé, contrato e PDF. De preferência PNG escuro com fundo transparente.")}
            <p class="muted small" style="margin:0">Sem logo, o nome da empresa aparece em texto.</p>
          </div>
          <div class="card"><div class="ch"><h2>Cores</h2><button type="button" class="pill pill-line pill-sm" id="colReset">Cores padrão</button></div>
            ${Object.keys(DEF_COLORS).map((k) => `<label class="color-row"><input type="color" data-col="${k}" value="${esc(C[k])}"><span><b>${COLOR_LABEL[k][0]}</b><small>${COLOR_LABEL[k][1]}</small></span><input class="inp mono" data-colhex="${k}" value="${esc(C[k])}" maxlength="7" spellcheck="false"></label>`).join("")}
            <div class="brand-prev"><span class="label">${esc(b.tagline || "Prévia")}</span><b>Proposta <em>comercial</em></b><span class="pill pill-green">Enviar pedido</span></div>
            <p class="muted small" style="margin:0">A prévia e o painel mudam na hora; as propostas mudam ao salvar.</p>
          </div>
          <div class="card"><h2>Fontes</h2>
            <div class="grid2"><label class="fl"><span>Títulos</span>${fontSel("fTitle", S.biz.fontTitle)}</label><label class="fl"><span>Textos</span>${fontSel("fText", S.biz.fontText)}</label></div>
            <p class="muted small" style="margin:0">Fontes do Google são carregadas pelo navegador do cliente. O PDF do contrato usa sempre a fonte Alexandria.</p>
          </div>
          <div class="card"><h2>Remetente dos e-mails</h2>
            <label class="fl"><span>Nome do remetente</span><input class="inp" id="bFrom" maxlength="80" value="${esc(b.emailFromName || "")}" placeholder="${esc(a.name || "")}"><small>Em branco, usa o nome da empresa. O endereço vem de GMAIL_USER ou EMAIL_FROM no Netlify${S.data.emailSender ? ` (hoje: ${esc(S.data.emailSender)})` : ""}.</small></label>
          </div>
          <div class="card"><h2>Assinatura padrão da empresa</h2>
            ${st.agencySignature && !S.cfgSigNew ? `<div class="sig-saved"><img src="${st.agencySignature.image}" alt="Assinatura padrão"></div><p class="muted small" style="margin:0">${esc(st.agencySignature.name)} · ${esc(R.maskDoc(st.agencySignature.doc))}. Entra sozinha em todos os contratos, sem precisar assinar de novo.</p><div class="row-acts"><button type="button" class="pill pill-line pill-sm" id="sigNewCfg">Desenhar outra</button><button type="button" class="pill pill-line pill-sm" id="sigDel">Apagar assinatura</button></div>` :
            `${st.agencySignature ? '<div class="row-acts"><button type="button" class="link-btn" id="sigCancelCfg">Cancelar</button></div>' : '<p class="muted small" style="margin:0">Desenhe uma vez e ela entra sozinha em todos os contratos.</p>'}<label class="fl"><span>Nome</span><input class="inp" id="sgName" value="${esc(a.representative || "")}"></label><label class="fl"><span>CPF ou CNPJ</span><input class="inp" id="sgDoc" value="${esc(R.maskDoc(a.representativeDoc || a.cnpj || ""))}"></label><div id="cfgPad"></div><div class="row-acts"><button type="button" class="link-btn" id="sgClear">Limpar</button><button type="button" class="pill pill-cream pill-sm" id="sgSave" style="margin-left:auto">Salvar assinatura</button></div>`}
          </div>
        </div>
      </div>
      <div class="savebar"><div class="inner"><span class="sb-sum">Os dados entram nas propostas na hora e nos contratos gerados a partir de agora.</span><button type="button" class="pill pill-green pill-lg" id="bizSave">Salvar dados da empresa</button></div></div>`);
    bindEmpresa();
  }

  // aplica cores e fontes no painel aberto (prévia) e recarrega o CSS da marca depois de salvar
  const applyColors = (c) => { const r = document.documentElement.style; r.setProperty("--primary", c.primary); r.setProperty("--accent", c.accent); r.setProperty("--ink", c.dark); r.setProperty("--cream", c.light); };
  function refreshBrandCss() { const l = document.querySelector('link[href^="/api/public/brand.css"]'); const e = (S.data && S.data.company && S.data.company.id) || ""; if (l) l.href = "/api/public/brand.css?e=" + encodeURIComponent(e) + "&t=" + Date.now(); document.documentElement.removeAttribute("style"); }

  // lê um arquivo de imagem e devolve um data URL reduzido (PNG para logos, JPEG para fotos)
  function shrinkImage(file, { max, type, quality }) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Formato de imagem não reconhecido."));
        img.onload = () => {
          const w0 = img.naturalWidth || 800, h0 = img.naturalHeight || 400, k = Math.min(1, max / Math.max(w0, h0));
          const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
          const cx = cv.getContext("2d");
          if (type === "image/jpeg") { cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); }
          cx.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL(type, quality));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function bindEmpresa() {
    const rerender = () => { const y = window.scrollY; empresa(); window.scrollTo(0, y); };
    $$('[data-ag="cnpj"],[data-ag="representativeDoc"]').forEach((i) => i.addEventListener("input", () => (i.value = R.maskDoc(i.value))));
    // cores
    const setCol = (k, v) => { S.biz.colors[k] = v; const c = $(`[data-col="${k}"]`), h = $(`[data-colhex="${k}"]`); if (c.value !== v) c.value = v; if (h.value !== v) h.value = v; applyColors(S.biz.colors); };
    $$("[data-col]").forEach((i) => i.addEventListener("input", () => setCol(i.dataset.col, i.value.toLowerCase())));
    $$("[data-colhex]").forEach((i) => i.addEventListener("input", () => { const v = i.value.trim().toLowerCase(); if (/^#[0-9a-f]{6}$/.test(v)) setCol(i.dataset.colhex, v); }));
    $("#colReset").addEventListener("click", () => Object.entries(DEF_COLORS).forEach(([k, v]) => setCol(k, v)));
    applyColors(S.biz.colors);
    $("#fTitle").addEventListener("change", (e) => (S.biz.fontTitle = e.target.value));
    $("#fText").addEventListener("change", (e) => (S.biz.fontText = e.target.value));
    // logos
    $$("[data-logo]").forEach((inp) => inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const image = await shrinkImage(f, { max: 1200, type: "image/png" });
        await post("brand-image", { slot: "logo-" + inp.dataset.logo, image }); await reload(); rerender(); R.toast("Logo salvo.");
      } catch (err) { R.toast(err.message); }
    }));
    $$("[data-logo-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!armed(b, "Remover?")) return;
      try { await api("brand-image/logo-" + b.dataset.logoDel, { method: "DELETE" }); await reload(); rerender(); } catch (err) { R.toast(err.message); }
    }));
    // galeria
    $("#pfAdd").addEventListener("change", async (e) => {
      const files = [...(e.target.files || [])]; if (!files.length) return;
      R.toast(`Enviando ${files.length} ${files.length > 1 ? "imagens" : "imagem"}…`);
      for (const f of files) {
        try { await post("brand-image", { slot: "portfolio", name: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), image: await shrinkImage(f, { max: 1600, type: "image/jpeg", quality: 0.84 }) }); }
        catch (err) { R.toast(`${f.name}: ${err.message}`); }
      }
      await reload(); rerender(); R.toast("Galeria atualizada.");
    });
    const pfList = () => $$("[data-pf]").map((li) => ({ id: li.dataset.pf, name: li.querySelector("[data-pf-name]").value.trim() }));
    $$("[data-pf-up]").forEach((b) => b.addEventListener("click", async () => {
      const L = pfList(), i = Number(b.dataset.pfUp); [L[i - 1], L[i]] = [L[i], L[i - 1]];
      try { await put("brand-image", { portfolio: L }); await reload(); rerender(); } catch (err) { R.toast(err.message); }
    }));
    $$("[data-pf-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!armed(b, "Remover?")) return;
      try { await api("brand-image/" + encodeURIComponent(b.dataset.pfDel), { method: "DELETE" }); await reload(); rerender(); } catch (err) { R.toast(err.message); }
    }));
    // assinatura padrão
    if ($("#cfgPad")) {
      S.padCfg = R.SignPad($("#cfgPad"));
      $("#sgClear").addEventListener("click", () => S.padCfg.clear());
      const d = $("#sgDoc"); d.addEventListener("input", () => (d.value = R.maskDoc(d.value)));
      $("#sgSave").addEventListener("click", async () => {
        const name = $("#sgName").value.trim(), doc = R.digits($("#sgDoc").value);
        if (name.length < 5 || !R.validDoc(doc)) { R.toast("Informe nome completo e CPF ou CNPJ válido."); return; }
        if (S.padCfg.isEmpty()) { R.toast("Desenhe a assinatura."); return; }
        try { await put("settings", { agencySignature: { name, doc, image: S.padCfg.toPNG() } }); await reload(); S.cfgSigNew = false; rerender(); R.toast("Assinatura salva."); } catch (err) { R.toast(err.message); }
      });
    }
    const sn = $("#sigNewCfg"); if (sn) sn.addEventListener("click", () => { S.cfgSigNew = true; rerender(); });
    const sc = $("#sigCancelCfg"); if (sc) sc.addEventListener("click", () => { S.cfgSigNew = false; rerender(); });
    const sd = $("#sigDel");
    if (sd) sd.addEventListener("click", async () => { if (!armed(sd, "Apagar a assinatura?")) return; try { await put("settings", { agencySignature: null }); await reload(); rerender(); } catch (err) { R.toast(err.message); } });
    // salvar
    $("#bizSave").addEventListener("click", async (e) => {
      const agency = {}; $$("[data-ag]").forEach((i) => (agency[i.dataset.ag] = i.dataset.ag.match(/cnpj|Doc/) ? R.digits(i.value) : i.value.trim()));
      if (!agency.name) { R.toast("Informe o nome que o cliente vê."); $('[data-ag="name"]').focus(); return; }
      if (agency.cnpj && !R.validDoc(agency.cnpj)) { R.toast("CNPJ ou CPF inválido."); $('[data-ag="cnpj"]').focus(); return; }
      const brand = {
        tagline: $("#bTag").value.trim(), about: $("#bAbout").value.trim(), statValue: $("#bStatV").value.trim(), statLabel: $("#bStatL").value.trim(),
        principles: $("#bPrin").value.split("\n").map((x) => x.trim()).filter(Boolean), colors: S.biz.colors, fontTitle: S.biz.fontTitle, fontText: S.biz.fontText, emailFromName: $("#bFrom").value.trim(),
      };
      // nomes da galeria editados na lista
      const L = $$("[data-pf]").length ? pfList() : null;
      busy(e.currentTarget, true, "Salvando…");
      try {
        await put("settings", { agency, brand, whatsapp: $("#cWa").value, instagram: $("#cIg").value, site: $("#cSite").value.trim(), intro: $("#cIntro").value.trim(), nextSteps: textToSteps($("#cNext").value) });
        if (L) await put("brand-image", { portfolio: L });
        await reload(); S.biz = null; refreshBrandCss(); empresa(); R.toast("Dados da empresa salvos.");
      } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  function config() {
    const st = S.data.settings, a = st.agency;
    if (!S.ctr) S.ctr = { own: !!st.contractText, text: st.contractText || S.data.defaultTemplate };
    const own = S.ctr.own;
    const fld = (k, l, ph = "", hint = "") => `<label class="fl"><span>${l}</span><input class="inp" data-ag="${k}" value="${esc(/cnpj|Doc/.test(k) ? R.maskDoc(a[k] || "") : a[k] || "")}" placeholder="${esc(ph)}"${/cnpj|Doc/.test(k) ? ' inputmode="numeric"' : ""}>${hint ? `<small>${hint}</small>` : ""}</label>`;
    shell("cfg", `
      <div class="pgh"><div><span class="label">Ajustes</span><h1>Configurações</h1><p class="sub">Modelo de contrato, consultores, link aberto, WhatsApp e e-mails automáticos.</p></div></div>
      <div class="cols">
        <div class="stack">
          <div class="card"><h2>Dados da empresa</h2>
            <p class="muted small" style="margin:0">Nome, CNPJ ou CPF, endereço, logo, cores, fontes, textos da proposta, remetente dos e-mails e assinatura padrão ficam em Dados da empresa.</p>
            <a class="pill pill-cream pill-sm" href="#/empresa" style="justify-self:start">Abrir Dados da empresa</a>
          </div>
          <div class="card" id="ctrCard"><div class="ch"><h2>Modelo de contrato</h2><div class="row-acts"><button type="button" class="pill pill-line pill-sm" id="ctrPrev">${S.ctrPrev ? "Voltar ao texto" : "Ver contrato completo"}</button></div></div>
            <div class="okbox ctr-note"><b>Um único modelo, para qualquer tipo de serviço.</b> O sistema traz um contrato genérico de prestação de serviços, que serve para serviços pontuais ou mensais de qualquer área. Ele recebe sozinho os dados do cliente, os serviços escolhidos, os valores, os prazos e a forma de pagamento de cada pedido. É um ponto de partida: revise com seu advogado e ajuste ao seu negócio.</div>
            <div class="seg ctr-mode"><button type="button" data-cm="sys" class="${own ? "" : "on"}">Usar o modelo do sistema</button><button type="button" data-cm="own" class="${own ? "on" : ""}">Usar meu próprio contrato</button></div>
            ${own ? `<div class="ctr-up"><label class="pill pill-cream pill-sm" for="ctrFile">Enviar arquivo do contrato</label><input type="file" id="ctrFile" accept=".docx,.odt,.pdf,.txt,.md,.rtf,.html,.htm,.doc" hidden><button type="button" class="pill pill-line pill-sm" id="ctrClear">Limpar a caixa</button><button type="button" class="pill pill-line pill-sm" id="tplReset">Começar do modelo do sistema</button></div>
            <p class="muted small" style="margin:0">Envie em Word (.docx), PDF, OpenDocument (.odt) ou texto (.txt, .rtf), ou digite e cole o contrato direto na caixa. O texto do arquivo aparece na caixa para você conferir antes de salvar. Arquivo .doc antigo: abra no Word e salve como .docx ou PDF.</p>
            ${S.data.templateVars.map(([g, vs]) => `<div class="fl"><span>${esc(g)}</span><div class="vars">${vs.map((v) => `<button type="button" data-var="${v}">{{${v}}}</button>`).join("")}</div></div>`).join("")}
            <p class="muted small" style="margin:0">Clique num campo para inserir no ponto do cursor; ele é trocado pelos dados de cada pedido. Se o seu contrato não tiver {{cliente_nome}}, {{servicos}} ou {{investimento}}, o sistema coloca no fim um anexo com os dados do cliente, os serviços e os valores do pedido.</p>` : `<p class="muted small" style="margin:0">Este é o texto do modelo do sistema. Para alterar ou usar o seu, escolha “Usar meu próprio contrato”.</p>`}
            <div class="preview-doc" id="ctrDoc"${S.ctrPrev ? "" : " hidden"}></div>
            <textarea class="ta mono" id="tpl" rows="24"${own ? ' placeholder="Cole ou digite aqui o seu contrato"' : " readonly"}${S.ctrPrev ? " hidden" : ""}>${esc(own ? S.ctr.text : S.data.defaultTemplate)}</textarea>
            <p class="muted small" style="margin:0">Linhas que começam com ## viram títulos de cláusula e linhas que começam com § viram itens numerados. Contratos em espanhol e inglês usam o modelo do sistema traduzido. Vale para os próximos contratos gerados.</p>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h2>Consultores</h2>
            <label class="switch"><input type="checkbox" id="cSellers"${st.sellersUseAgencySignature ? " checked" : ""}>Consultores podem liberar contratos com a assinatura padrão da empresa</label>
            <p class="muted small" style="margin:0">Ligado: depois de assinar como intermediador, o consultor libera o contrato e a assinatura padrão é aplicada, com registro de quem liberou. Desligado: só você libera.</p>
            <a class="pill pill-line pill-sm" href="#/equipe" style="justify-self:start">Gerenciar consultores</a>
          </div>
          <div class="card"><h2>Propostas</h2>
            <label class="fl" style="max-width:220px"><span>Validade padrão (dias)</span><input class="inp" type="number" min="1" id="cVal" value="${esc(st.validityDays)}"></label>
          </div>
          <div class="card"><h2>Link aberto</h2>
            <label class="switch"><input type="checkbox" id="cOpen"${st.openLink ? " checked" : ""}>Permitir pedidos por um link geral, com todos os serviços ativos</label>
            <p class="muted small">Útil para bio do Instagram ou para quem pede “a tabela”. Cada pedido feito por ele vira uma proposta no painel.</p>
            <div class="linkbox"><input class="inp" readonly value="${origin}/p/aberta?e=${esc(S.data.company.id)}"><button type="button" class="pill pill-cream" data-copy="${origin}/p/aberta?e=${esc(S.data.company.id)}">Copiar</button></div>
          </div>
          <div class="card" id="demoCard"><h2>Modelo de teste</h2>
            <p class="muted small" style="margin:0">Cria a pasta “Modelo de teste” com um consultor fictício e cinco propostas, uma em cada etapa: aberta, pedido recebido, contrato em rascunho, Paraguai aguardando assinatura e contrato assinado. Serve para conferir o sistema de ponta a ponta. Criar de novo substitui o modelo anterior.</p>
            <div class="row-acts"><button type="button" class="pill pill-cream" id="demoMake">Criar modelo de teste</button><button type="button" class="pill pill-line" id="demoDel">Remover modelo de teste</button></div>
            <div id="demoOut"></div>
          </div>
          <div class="card"><h2>WhatsApp automático</h2>
            ${S.data.waEnabled ? `<div class="okbox">Ativo. As mensagens saem pelo número conectado à Z-API.</div>` : `<p class="small" style="margin:0">Desativado. Os botões de WhatsApp abrem o seu WhatsApp com a mensagem pronta, e você envia.</p>`}
            <label class="switch"><input type="checkbox" id="cWaClient"${st.waClient !== false ? " checked" : ""}>Avisar o cliente: pedido recebido, contrato para assinar e cópia assinada</label>
            <label class="switch"><input type="checkbox" id="cWaAgency"${st.waAgency !== false ? " checked" : ""}>Avisar a empresa (WhatsApp de Dados da empresa) e o consultor: novo pedido, recusa, assinatura do intermediador e contrato assinado</label>
            ${S.data.waEnabled ? `<div class="linkbox"><input class="inp" id="waTestTo" inputmode="tel" placeholder="WhatsApp para o teste" value="${esc(st.whatsapp || "")}"><button type="button" class="pill pill-cream" id="waTest">Enviar mensagem de teste</button></div>` : `<p class="small" style="margin:0"><b>Para ativar (Z-API, serviço pago à parte):</b></p>
            <ol class="small steps-list"><li>Crie uma conta em z-api.io e uma instância.</li><li>Leia o QR Code da instância com o WhatsApp do número que vai enviar as mensagens (de preferência um WhatsApp Business só da empresa).</li><li>Copie o ID da instância, o Token da instância e o Client-Token (em Segurança, no painel da Z-API).</li><li>No Netlify, em Environment variables, crie ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN com esses valores e faça um novo deploy.</li></ol>`}
          </div>
          <div class="card"><h2>E-mails automáticos</h2>
            ${S.data.emailEnabled ? `<div class="okbox">Ativos${S.data.emailSender ? `, enviados por ${esc(S.data.emailSender)}` : ""}. O cliente recebe a confirmação do pedido, o link do contrato e a cópia assinada em PDF. Você e o consultor recebem os avisos de pedido e de assinatura.</div>
            <div class="linkbox"><input class="inp" id="mailTestTo" type="email" placeholder="E-mail para o teste" value="${esc(S.data.settings.agency.email || "")}"><button type="button" class="pill pill-cream" id="mailTest">Enviar e-mail de teste</button></div>` : `<p class="small" style="margin:0">Desativados. Tudo funciona por link e WhatsApp, e o cliente baixa a cópia em PDF ao assinar.</p>
            <p class="small" style="margin:0"><b>Para enviar pelo Gmail:</b></p>
            <ol class="small steps-list"><li>Na conta Google, ative a verificação em duas etapas.</li><li>Em myaccount.google.com/apppasswords, crie uma senha de app com o nome “Propostas”. O Google mostra 16 letras.</li><li>No Netlify, em Project configuration › Environment variables, crie GMAIL_USER com o e-mail e GMAIL_APP_PASSWORD com as 16 letras.</li><li>Faça um novo deploy (Deploys › Trigger deploy). Este quadro passa a mostrar “Ativos”.</li></ol>
            <p class="muted small" style="margin:0">A senha normal da conta não funciona para envio automático e não deve ser colocada no sistema.</p>`}
          </div>
        </div>
      </div>
      <div class="savebar"><div class="inner"><span class="sb-sum">O modelo de contrato vale para os contratos gerados a partir de agora.</span><button type="button" class="pill pill-green pill-lg" id="cfgSave">Salvar configurações</button></div></div>`);
    bindConfig();
  }

  function bindConfig() {
    $$("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy)));
    const tpl = $("#tpl");
    const keepTpl = () => { if (S.ctr.own && !S.ctrPrev) S.ctr.text = tpl.value; };
    tpl.addEventListener("input", keepTpl);
    const rerenderCtr = () => { const y = window.scrollY; config(); window.scrollTo(0, y); };
    $$("[data-cm]").forEach((b) => b.addEventListener("click", () => { keepTpl(); S.ctr.own = b.dataset.cm === "own"; S.ctrPrev = false; rerenderCtr(); }));
    if (S.ctrPrev) post("contract-preview", { text: S.ctr.own ? S.ctr.text : "" }).then((r) => { $("#ctrDoc").innerHTML = docPreview(r.text.replace(/\{\{([a-z_]+)\}\}/g, "⟦$1⟧")); }).catch((err) => R.toast(err.message));
    $("#ctrPrev").addEventListener("click", () => { keepTpl(); S.ctrPrev = !S.ctrPrev; rerenderCtr(); });
    $$("[data-var]").forEach((b) => b.addEventListener("click", () => { const v = `{{${b.dataset.var}}}`; const s = tpl.selectionStart, e = tpl.selectionEnd; tpl.setRangeText(v, s, e, "end"); tpl.focus(); keepTpl(); }));
    const reset = $("#tplReset");
    if (reset) reset.addEventListener("click", (e) => { if (!armed(e.currentTarget, "Clique de novo para trocar o texto")) return; S.ctr.text = S.data.defaultTemplate; rerenderCtr(); R.toast("Texto do modelo do sistema na caixa. Ajuste e salve."); });
    const clear = $("#ctrClear");
    if (clear) clear.addEventListener("click", () => { S.ctr.text = ""; rerenderCtr(); $("#tpl").focus(); });
    const file = $("#ctrFile");
    if (file) file.addEventListener("change", async () => {
      const f = file.files[0]; if (!f) return;
      R.toast("Lendo o arquivo…");
      try {
        const t = await readContractFile(f);
        if (!t.trim()) throw new Error("Não encontrei texto no arquivo. Se for um PDF escaneado (imagem), digite ou cole o texto na caixa.");
        S.ctr.text = t; S.ctrPrev = false; rerenderCtr(); R.toast("Contrato carregado. Confira o texto e salve.");
      } catch (err) { R.toast(err.message); }
      file.value = "";
    });
    $("#demoMake").addEventListener("click", async (e) => {
      busy(e.currentTarget, true, "Criando…");
      try {
        const r = await post("demo");
        await reload();
        $("#demoOut").innerHTML = `<div class="okbox" style="display:grid;gap:8px"><span>Modelo criado. Acesso do consultor fictício (Entrar, com este e-mail): <b>${esc(r.seller.email)}</b> · senha <code class="pw">${esc(r.seller.password)}</code></span>
          <ul class="lines">${r.proposals.map((p) => `<li><a href="#/proposta/${p.id}">${esc(p.name)}</a><a class="small" href="/p/${p.id}" target="_blank" rel="noopener">abrir como cliente</a></li>`).join("")}</ul></div>`;
        R.toast("Modelo de teste criado na pasta “Modelo de teste”.");
      } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
    $("#demoDel").addEventListener("click", async (e) => {
      if (!armed(e.currentTarget, "Remover tudo do modelo?")) return;
      try { await post("demo", { remove: true }); await reload(); $("#demoOut").innerHTML = ""; R.toast("Modelo de teste removido."); } catch (err) { R.toast(err.message); }
    });
    const wt = $("#waTest");
    if (wt) wt.addEventListener("click", async () => {
      busy(wt, true, "Enviando…");
      try { await post("wa-test", { phone: $("#waTestTo").value.trim() }); R.toast("Mensagem de teste enviada. Confira o WhatsApp."); } catch (err) { R.toast(err.message); }
      busy(wt, false);
    });
    const mt = $("#mailTest");
    if (mt) mt.addEventListener("click", async () => {
      busy(mt, true, "Enviando…");
      try { const r = await post("email-test", { to: $("#mailTestTo").value.trim() }); R.toast(`E-mail de teste enviado para ${r.to}. Confira a caixa de entrada e o spam.`); }
      catch (err) { R.toast(err.message); }
      busy(mt, false);
    });
    $("#cfgSave").addEventListener("click", async (e) => {
      const body = { validityDays: $("#cVal").value, openLink: $("#cOpen").checked, sellersUseAgencySignature: $("#cSellers").checked, waClient: $("#cWaClient").checked, waAgency: $("#cWaAgency").checked };
      keepTpl();
      if (S.ctr.own && !S.ctr.text.trim()) { R.toast("A caixa do contrato está vazia. Envie um arquivo, cole o texto ou volte ao modelo do sistema."); return; }
      body.contractText = S.ctr.own && S.ctr.text.trim() !== S.data.defaultTemplate.trim() ? S.ctr.text : null;
      busy(e.currentTarget, true, "Salvando…");
      try { await put("settings", body); await reload(); S.ctr = null; config(); R.toast("Configurações salvas."); } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  /* ---------- leitura do contrato enviado (Word, OpenDocument, PDF, texto) ---------- */
  async function unzipEntry(buf, name) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Arquivo inválido ou corrompido.");
    let p = dv.getUint32(eocd + 16, true);
    const n = dv.getUint16(eocd + 10, true), dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      if (dec.decode(u8.subarray(p + 46, p + 46 + nl)) === name) {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(start, start + size);
        if (method === 0) return dec.decode(data);
        if (typeof DecompressionStream === "undefined") throw new Error("Este navegador não lê esse arquivo. Atualize o navegador ou cole o texto na caixa.");
        return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      }
      p += 46 + nl + el + cl;
    }
    throw new Error("Não encontrei o texto do documento no arquivo.");
  }
  const tidy = (t) => t.replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  function docxText(xml) {
    const d = new DOMParser().parseFromString(xml, "application/xml");
    return tidy([...d.getElementsByTagName("w:p")].map((p) => {
      let t = "";
      p.querySelectorAll("*").forEach((n) => { if (n.nodeName === "w:t") t += n.textContent; else if (n.nodeName === "w:tab") t += " "; else if (n.nodeName === "w:br") t += "\n"; });
      const st = p.getElementsByTagName("w:pStyle")[0], sv = st ? st.getAttribute("w:val") || "" : "";
      return t.trim() && /heading|t[ií]tulo|title/i.test(sv) ? "## " + t.trim() : t.trim();
    }).join("\n\n"));
  }
  function odtText(xml) {
    const d = new DOMParser().parseFromString(xml, "application/xml");
    const out = [];
    const walk = (el) => { for (const n of el.children) { if (n.nodeName === "text:h") out.push("## " + n.textContent.trim()); else if (n.nodeName === "text:p") out.push(n.textContent.trim()); else walk(n); } };
    walk(d.documentElement);
    return tidy(out.join("\n\n"));
  }
  const htmlText = (h) => { const t = document.createElement("textarea"); t.innerHTML = h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<h[1-6][^>]*>/gi, "\n\n## ").replace(/<\/(p|div|h[1-6]|li|tr)>|<br\s*\/?>/gi, "\n\n").replace(/<[^>]+>/g, ""); return tidy(t.value); };
  const rtfText = (r) => tidy(r.replace(/\\par[d]?\b/g, "\n\n").replace(/\{\\\*[^{}]*\}/g, "").replace(/\\'([0-9a-f]{2})/gi, (m, h) => new TextDecoder("windows-1252").decode(new Uint8Array([parseInt(h, 16)]))).replace(/\\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, ""));
  function loadScript(src) { return new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = src; sc.onload = ok; sc.onerror = () => no(new Error("Não foi possível carregar o leitor de PDF. Confira a conexão ou cole o texto na caixa.")); document.head.appendChild(sc); }); }
  async function pdfText(buf) {
    const CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
    if (!window.pdfjsLib) await loadScript(CDN + "pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + "pdf.worker.min.js";
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let t = "";
    for (let i = 1; i <= pdf.numPages; i++) { const c = await (await pdf.getPage(i)).getTextContent(); c.items.forEach((it) => { t += it.str + (it.hasEOL ? "\n" : ""); }); t += "\n"; }
    // linhas quebradas no meio da frase voltam a ser um parágrafo só
    return tidy(t.replace(/([^.:;!?\n])\n(?=[a-zà-ú0-9(])/g, "$1 ").replace(/\n/g, "\n\n"));
  }
  async function readContractFile(f) {
    if (f.size > 10 * 1024 * 1024) throw new Error("Arquivo grande demais (máximo 10 MB).");
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (ext === "doc") throw new Error("Arquivo .doc antigo: abra no Word e salve como .docx ou PDF, ou cole o texto na caixa.");
    if (ext === "docx") return docxText(await unzipEntry(await f.arrayBuffer(), "word/document.xml"));
    if (ext === "odt") return odtText(await unzipEntry(await f.arrayBuffer(), "content.xml"));
    if (ext === "pdf") return pdfText(await f.arrayBuffer());
    const raw = await f.text();
    if (ext === "rtf") return rtfText(raw);
    if (ext === "html" || ext === "htm") return htmlText(raw);
    return tidy(raw.replace(/\r\n?/g, "\n"));
  }

  /* ---------- início ---------- */
  if (/^#\/nova-senha\//.test(location.hash)) login("nova");
  else if (DONO && !S.token) login("dono");
  else if (S.token) start();
  else login(/^#\/criar-conta/.test(location.hash) ? "criar" : "entrar");
})();
