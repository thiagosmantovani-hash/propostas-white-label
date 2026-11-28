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
  // Tema claro ou escuro do painel: escolha de cada pessoa, guardada neste navegador
  R.setTheme(R.store.get("tema", "claro")); // o painel abre no tema claro, como o site; o botão no topo troca
  // símbolo do sistema (documento com visto), usado no login e no painel do dono
  const FX_MARK = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#0e3b2c"/><path d="M21 15h16l8 8v25a2 2 0 0 1-2 2H21a2 2 0 0 1-2-2V17a2 2 0 0 1 2-2z" fill="none" stroke="#d4f26a" stroke-width="3.5" stroke-linejoin="round"/><path d="M36 15v9h9M25.5 36l4.5 4.5 8.5-9.5" stroke="#d4f26a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
  const themeBtn = () => { const to = R.theme() === "claro" ? "escuro" : "claro"; return `<button class="pill pill-line theme-btn" type="button" id="themeBtn" title="Usar o tema ${to}" aria-label="Usar o tema ${to}">${to === "claro" ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'}</button>`; };
  const bindTheme = (redraw) => { const b = $("#themeBtn"); if (b) b.addEventListener("click", () => { const t = R.theme() === "claro" ? "escuro" : "claro"; R.setTheme(t); R.store.set("tema", t); redraw(); }); };
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
    R.setBrand({ ...st.agency, theme: "", e: S.data.company.id, whatsapp: st.whatsapp, logos: (st.brand && st.brand.logos) || {} });
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
  // assinatura: desenhada (imagem) ou só com nome completo e CPF/CNPJ
  const sigModeSeg = (name, cur, opts = [["desenho", "Desenhar"], ["dados", "Só nome e CPF/CNPJ"]]) => `<div class="seg" role="radiogroup" aria-label="Forma de assinar">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}"${cur === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
  const sigView = (sg) => (sg.image ? `<img src="${sg.image}" alt="Assinatura de ${esc(sg.name)}">` : `<span class="sig-typed"><small>Assinado eletronicamente por</small>${esc(sg.name)}</span>`);
  const DATA_HINT = "Sem desenho: a assinatura fica registrada com o nome completo e o CPF/CNPJ, com data, hora, IP e o código do texto. Tem a mesma validade entre as partes.";
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
  // Acesso pelo WhatsApp: entrar (WhatsApp + senha), criar conta e nova senha, sempre com código enviado no WhatsApp.
  // S.otp guarda a etapa do código: { flow: "criar" | "entrar" | "esqueci", login, masked, payload }
  function login(mode, msg) {
    mode = mode || "entrar";
    if (mode === "nova") mode = "esqueci"; // links antigos de nova senha por e-mail
    const tabs = mode === "entrar" || mode === "criar";
    const O = S.otp || {};
    const H = {
      entrar: ["Acesso ao painel", "Entrar"],
      criar: ["Comece agora", "Criar conta"],
      esqueci: ["Esqueci minha senha", "Nova senha"],
      dono: ["Dono do sistema", "Painel do dono"],
      codigo: ["Confirmação no WhatsApp", O.flow === "esqueci" ? "Criar nova senha" : "Digite o código"],
    }[mode] || ["", ""];
    const fld = (id, label, type, ac, extra = "", hint = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" autocomplete="${ac}" required${extra}>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
    const tel = (label, hint = "") => fld("tel", label, "tel", "tel", ' inputmode="tel" placeholder="(44) 99999-0000"', hint);
    const body = {
      entrar: tel("WhatsApp", "Conta antiga ou de teste? Use o e-mail.").replace('type="tel"', 'type="text"') + fld("pw", "Senha", "password", "current-password"),
      criar: fld("nm", "Seu nome", "text", "name", ' maxlength="120"') + fld("co", "Nome da empresa (ou o seu, se for freelancer)", "text", "organization", ' maxlength="120"') + tel("Seu WhatsApp", "Você recebe um código nele para confirmar a conta.") + fld("pw", "Senha (mínimo 8 caracteres)", "password", "new-password", ' minlength="8"') +
        '<div style="position:absolute;left:-9999px" aria-hidden="true"><label>Site <input id="ws" tabindex="-1" autocomplete="off"></label></div>',
      esqueci: '<p class="muted small" style="margin:0">Informe o WhatsApp da conta. Se ele estiver cadastrado, você recebe um código para criar uma senha nova.</p>' + tel("WhatsApp"),
      dono: fld("pw", "Senha do dono do sistema", "password", "current-password"),
      codigo: `<p class="muted small" style="margin:0">Enviamos um código de 6 números para o WhatsApp <b>${esc(O.masked || "")}</b>. Ele vale por 10 minutos.</p>` + fld("code", "Código", "text", "one-time-code", ' inputmode="numeric" maxlength="6" pattern="[0-9]*"') + (O.flow === "esqueci" ? fld("pw", "Nova senha (mínimo 8 caracteres)", "password", "new-password", ' minlength="8"') : ""),
    }[mode];
    const btn = { entrar: "Entrar", criar: "Criar minha conta", esqueci: "Enviar código", dono: "Entrar", codigo: O.flow === "criar" ? "Confirmar e criar a conta" : O.flow === "esqueci" ? "Salvar e entrar" : "Confirmar e entrar" }[mode];
    const foot = {
      entrar: '<p class="muted small" style="margin:0"><button type="button" class="link-btn" data-mode="esqueci">Esqueci minha senha</button></p>',
      criar: '<p class="muted small" style="margin:0" id="trialNote">Comece grátis por 7 dias, depois só R$ 19,90 por mês. A conta só é criada depois de confirmar o código no seu WhatsApp.</p>',
      esqueci: '<p class="muted small" style="margin:0"><button type="button" class="link-btn" data-mode="entrar">Voltar para Entrar</button></p>',
      dono: '<p class="muted small" style="margin:0">Acesso exclusivo do dono do sistema.</p>',
      codigo: `<p class="muted small" style="margin:0;display:flex;gap:14px;flex-wrap:wrap"><button type="button" class="link-btn" id="resend" disabled>Reenviar código</button><button type="button" class="link-btn" data-mode="${O.flow === "esqueci" ? "esqueci" : O.flow || "entrar"}">Trocar o número</button></p>`,
    }[mode];
    app.innerHTML = `<section class="login">
      <aside class="login-side">
        <a class="back" href="/">← Voltar ao site</a>
        <div><span class="tagp">Para empresas e freelancers</span><h2>Propostas que viram <mark>contrato assinado.</mark></h2><p>Monte a proposta com a sua marca, mande o link e acompanhe até a assinatura, tudo num lugar só.</p></div>
        <ul><li>Propostas com a sua marca</li><li>Contrato fácil e assinatura online</li><li>Acesso protegido pelo seu WhatsApp</li><li>Resumo do mês com o que foi fechado</li></ul>
      </aside>
      <div class="login-main">
      <form id="loginForm" novalidate><div id="loginLogo" class="fx-logo">${FX_MARK}<span class="wordmark">Fechaí</span></div>
        <div><span class="label" style="color:var(--primary-glow)">${H[0]}</span><h1 style="margin-top:10px">${H[1]}</h1></div>
        ${tabs ? `<div class="seg" role="tablist" aria-label="Entrar ou criar conta"><button type="button" role="tab" data-mode="entrar" aria-selected="${mode === "entrar"}" class="${mode === "entrar" ? "on" : ""}">Entrar</button><button type="button" role="tab" data-mode="criar" aria-selected="${mode === "criar"}" class="${mode === "criar" ? "on" : ""}">Criar conta</button></div>` : ""}
        ${body}
        <p class="form-msg" id="lmsg" role="alert" style="margin:0">${esc(msg || "")}</p>
        <button class="pill pill-green pill-lg" type="submit">${btn}</button>
        ${foot}
        </form></div></section>`;
    // nome do sistema, preço e cadastro aberto/fechado (painel do dono)
    R.api("public/system").then((y) => {
      const l = $("#loginLogo"); if (l) l.innerHTML = `${FX_MARK}<span class="wordmark">${esc(y.productName)}</span>`;
      const tn = $("#trialNote"); if (tn && y.plans) tn.textContent = `Comece grátis por ${y.plans.trialDays} dias, depois só ${mny(y.plans.mensal)} por mês. A conta só é criada depois de confirmar o código no seu WhatsApp.`;
      if (!y.signupOpen) { const t = $('[data-mode="criar"]'); if (t) t.remove(); if (mode === "criar") login("entrar", "O cadastro de novas contas está fechado no momento."); }
    }).catch(() => {});
    const f0 = $("#loginForm input:not([tabindex='-1'])"); if (f0) f0.focus();
    $$("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.mode !== "codigo") S.otp = null; login(b.dataset.mode); }));
    const telIn = $("#tel"); if (telIn && mode !== "entrar") telIn.addEventListener("input", () => (telIn.value = maskTel(telIn.value)));
    const out = $("#lmsg");
    const post0 = async (path, payload) => {
      const r = await fetch("/api/admin/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(d.error || "Não foi possível concluir agora."); e.wait = d.wait; throw e; }
      return d;
    };
    const toCode = (flow, loginV, d, payload) => { S.otp = { flow, login: loginV, masked: d.phone, payload, cooldown: d.cooldown || 45 }; login("codigo"); };
    // reenviar o código: mesmo pedido de novo, com espera entre os envios
    const rs = $("#resend");
    if (rs) {
      let left = O.cooldown || 45; const tick = () => { rs.disabled = left > 0; rs.textContent = left > 0 ? `Reenviar código (${left}s)` : "Reenviar código"; if (left-- > 0) S.otpT = setTimeout(tick, 1000); };
      clearTimeout(S.otpT); tick();
      rs.addEventListener("click", async () => {
        try { const d = await post0(O.flow === "criar" ? "signup" : O.flow === "esqueci" ? "forgot" : "login", O.payload); O.cooldown = d.cooldown || 45; left = O.cooldown; tick(); out.className = "form-msg ok"; out.textContent = "Código reenviado."; }
        catch (err) { out.className = "form-msg"; out.textContent = err.message; if (err.wait) { left = err.wait; tick(); } }
      });
    }
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = e.submitter || $("#loginForm button[type=submit]");
      const val = (id) => ($("#" + id) ? $("#" + id).value.trim() : "");
      const pw = $("#pw") ? $("#pw").value : "";
      out.className = "form-msg"; out.textContent = "";
      const telOk = (v) => { const d = R.digits(v); return /^\+/.test(v.trim()) ? d.length >= 10 : d.length === 10 || d.length === 11 || (d.startsWith("55") && (d.length === 12 || d.length === 13)); };
      let path, payload;
      if (mode === "entrar") { path = "login"; payload = { login: val("tel"), password: pw }; if (!payload.login) { out.textContent = "Informe o seu WhatsApp."; return; } }
      else if (mode === "dono") { path = "login"; payload = { password: pw }; }
      else if (mode === "criar") {
        path = "signup"; payload = { name: val("nm"), company: val("co"), phone: val("tel"), password: pw, website: val("ws") };
        if (payload.name.length < 3) { out.textContent = "Informe o seu nome."; return; }
        if (payload.company.length < 2) { out.textContent = "Informe o nome da empresa."; return; }
        if (!telOk(payload.phone)) { out.textContent = "Informe um WhatsApp válido, com DDD."; return; }
        if (pw.length < 8) { out.textContent = "A senha precisa de pelo menos 8 caracteres."; return; }
      } else if (mode === "esqueci") { path = "forgot"; payload = { phone: val("tel") }; if (!telOk(payload.phone)) { out.textContent = "Informe um WhatsApp válido, com DDD."; return; } }
      else {
        const code = R.digits(val("code"));
        if (code.length !== 6) { out.textContent = "Digite os 6 números do código."; return; }
        if (O.flow === "esqueci") { if (pw.length < 8) { out.textContent = "A senha precisa de pelo menos 8 caracteres."; return; } path = "reset"; payload = { phone: O.login, code, password: pw }; }
        else { path = O.flow === "criar" ? "signup-confirm" : "login-verify"; payload = { phone: O.login, code }; }
      }
      busy(b, true, "Aguarde…");
      try {
        const d = await post0(path, payload);
        if (mode === "criar" && d.verify) return toCode("criar", payload.phone, d, payload);
        if (mode === "entrar" && d.verify) return toCode("entrar", payload.login, d, payload);
        if (mode === "esqueci") return toCode("esqueci", payload.phone, d, payload);
        const flow = O.flow;
        S.otp = null; clearTimeout(S.otpT);
        S.token = d.token; R.store.set("adm", d.token); R.store.set("admSuper", "");
        R.store.set("empresa", d.company || "");
        history.replaceState(null, "", flow === "criar" ? "#/empresa" : "#/");
        await start();
        if (flow === "criar") R.toast("Conta criada. Comece pelos dados da sua empresa.");
        else if (flow === "esqueci") R.toast("Senha nova salva.");
      } catch (err) { out.className = "form-msg"; out.textContent = err.message; busy(b, false); }
    });
  }
  // máscara do WhatsApp brasileiro: (44) 99999-0000 (com + fica livre, para outro país)
  const maskTel = (v) => { if (/^\s*\+/.test(v)) return v; let d = R.digits(v); if (d.length > 11 && d.startsWith("55")) d = d.slice(2); d = d.slice(0, 11); return d.length <= 2 ? d : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
  const fmtTel = (d) => { d = R.digits(d); if (!d) return ""; return d.startsWith("55") && d.length >= 12 ? maskTel(d.slice(2)) : "+" + d; };

  /* ---------- painel do dono do sistema ---------- */
  // visão geral, configurações do sistema e ações rápidas vêm antes da lista de contas
  function superPanel() {
    const D = S.data, sys = D.system, st = D.stats;
    const cs = D.companies || [];
    const q = (S.supQ || "").trim().toLowerCase();
    const f = S.supF || "todas";
    const rows = cs.filter((c) => (f === "ativas" ? !c.blocked : f === "bloqueadas" ? c.blocked : true)).filter((c) => !q || `${c.name} ${c.owner.name} ${c.owner.phone} ${c.owner.phoneFmt} ${c.owner.email} ${c.note}`.toLowerCase().includes(q));
    const dt = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "nunca");
    const host = location.host;
    const lim = (c) => (c.maxSellers ? `${c.sellers} de ${c.maxSellers}` : `${c.sellers}`);
    const subCell = (sb) => `<span class="st ${sb.status === "vencida" ? "recusada" : sb.status === "teste" ? "contrato" : "assinada"}">${SUB_LABEL[sb.status]}</span><br><span class="muted small">${sb.status === "ativa" ? `${PLAN_LABEL[sb.plan] || ""} até ${dBR(sb.paidUntil)}${sb.canceled ? " · não renova" : ""}` : sb.status === "teste" ? `até ${dBR(sb.trialEndsAt)}` : sb.status === "vencida" ? (sb.paidUntil ? `desde ${dBR(sb.paidUntil)}` : `teste até ${dBR(sb.trialEndsAt)}`) : ""}${sb.requested ? `<br><b>Pediu o ${PLAN_LABEL[sb.requested.plan].toLowerCase()}</b>` : ""}</span>`;
    app.innerHTML = `<header class="adm-top wrap"><div class="inner">
        <a class="brand fx-logo" href="/dono">${FX_MARK}<span class="wordmark">${esc(sys.productName)}</span></a><span class="tag">Painel do dono</span>
        <nav><a class="pill pill-line" href="#sup-cfg">Configurações</a><a class="pill pill-line" href="#sup-contas">Contas</a>${themeBtn()}<button class="pill pill-line" type="button" id="logout">Sair</button></nav>
      </div></header><main class="adm-main wrap"><div class="inner">
      <div class="pgh"><div><span class="label">Dono do sistema</span><h1>Painel do dono</h1><p class="sub">Controle o sistema todo: regras para as contas novas, avisos, cadastro aberto ou fechado e cada conta cadastrada.</p></div>
        <div class="acts"><button type="button" class="pill pill-green pill-lg" id="supNewBtn">Criar conta</button></div></div>
      <div class="tiles" style="margin-bottom:24px">
        <div class="tile"><span>Contas</span><b>${st.companies}</b><small>${st.active} ativas · ${st.blocked} bloqueadas</small></div>
        <div class="tile"><span>Novas em 7 dias</span><b>${st.new7}</b><small>${st.active7} entraram nos últimos 7 dias</small></div>
        <div class="tile"><span>Propostas</span><b>${st.proposals}</b><small>somando todas as contas</small></div>
        <div class="tile"><span>Contratos</span><b>${st.contracts}</b><small>gerados em todas as contas</small></div>
      </div>
      <div class="tiles" style="margin-bottom:24px">
        <div class="tile"><span>Em teste grátis</span><b>${st.trial}</b><small>${D.billing.trialDays} dias de teste</small></div>
        <div class="tile"><span>Pagantes</span><b>${st.paying}</b><small>${st.expired} vencida(s)</small></div>
        <div class="tile"><span>Receita mensal estimada</span><b>${esc(brl(st.mrr))}</b><small>anual dividido por 12</small></div>
        <div class="tile"><span>Pedidos de plano</span><b>${st.requests}</b><small>aguardando confirmar o pagamento</small></div>
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
          <div class="card"><h2>Planos e cobrança</h2>
            <div class="grid3">
              <label class="fl"><span>Teste grátis (dias)</span><input class="inp" id="bTrial" type="number" min="0" max="90" value="${esc(D.billing.trialDays)}"></label>
              <label class="fl"><span>Plano mensal (R$)</span><input class="inp" id="bMonthly" inputmode="decimal" value="${esc(String(D.billing.monthly).replace(".", ","))}"></label>
              <label class="fl"><span>Plano anual (R$)</span><input class="inp" id="bAnnual" inputmode="decimal" value="${esc(String(D.billing.annual).replace(".", ","))}"></label>
            </div>
            <label class="check"><input type="checkbox" id="bEnforce"${D.billing.enforce ? " checked" : ""}><span>Exigir plano depois do teste: conta vencida fica só para consulta (não cria nem envia propostas). Os links já enviados aos clientes continuam funcionando.</span></label>
            <p class="muted small" style="margin:0">Os preços aparecem na página de divulgação e na tela Plano e pagamento das contas. Pagamento: <b>${esc(D.billingProvider)}</b>. Com a confirmação manual, a conta escolhe o plano e você registra o pagamento em Cobrança, na lista de contas. Para cobrar automático, ligue o Asaas ou o Stripe (BILLING_PROVIDER no Netlify).</p>
            <div class="row-acts"><button type="button" class="pill pill-green" id="bSave">Salvar planos</button></div>
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
            <p class="small" style="margin:0">Confirmação por WhatsApp: <b>${esc(D.whatsappOtp)}</b>${D.whatsappOtpOn ? "" : " (sem ela, ninguém consegue criar conta nem pedir senha nova; contas criadas por você entram normalmente só depois que a confirmação estiver ligada)"}</p>
          </div>
        </div>
      </div>
      <div class="pgh" id="sup-contas" style="margin-top:32px"><div><span class="label">Contas</span><h2 style="margin:6px 0 0">Contas cadastradas</h2></div></div>
      <div class="row-acts" style="margin-bottom:12px;flex-wrap:wrap"><input class="inp" id="supQ" placeholder="Buscar por empresa, responsável, WhatsApp ou anotação" value="${esc(S.supQ || "")}" style="flex:1;min-width:220px">
        ${[["todas", "Todas"], ["ativas", "Ativas"], ["bloqueadas", "Bloqueadas"]].map(([k, t]) => `<button type="button" class="pill ${f === k ? "on" : "pill-line"} pill-sm" data-supf="${k}">${t}</button>`).join("")}</div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Conta</th><th>Responsável</th><th>Criada</th><th>Último acesso</th><th>Propostas</th><th>Consultores</th><th>Plano</th><th>Situação</th><th class="r">Ações</th></tr></thead><tbody>
        ${rows.map((c) => `<tr><td><b>${esc(c.name)}</b>${c.demo ? ' <span class="muted small">(teste)</span>' : ""}${c.note ? `<br><span class="muted small">${esc(c.note)}</span>` : ""}</td><td>${esc(c.owner.name)}<br><span class="muted small">${c.owner.phone ? `${esc(c.owner.phoneFmt)}${c.owner.phoneVerified ? "" : " · a confirmar"}` : esc(c.owner.email)}</span></td><td>${dt(c.createdAt)}<br><span class="muted small">${c.createdBy === "dono" ? "por você" : "cadastro"}</span></td><td>${dt(c.lastLoginAt)}</td><td>${c.proposals}</td><td>${lim(c)}</td><td>${subCell(c.sub)}</td><td><span class="st ${c.blocked ? "recusada" : "assinada"}">${c.blocked ? "Bloqueada" : "Ativa"}</span></td>
          <td class="r"><div class="row-acts" style="justify-content:flex-end;flex-wrap:wrap"><button type="button" class="pill pill-green pill-sm" data-enter="${esc(c.id)}">Entrar</button><button type="button" class="pill pill-line pill-sm" data-edit="${esc(c.id)}">Editar</button><button type="button" class="pill ${c.sub.requested ? "pill-cream" : "pill-line"} pill-sm" data-bill="${esc(c.id)}">Cobrança</button><button type="button" class="pill pill-line pill-sm" data-reset="${esc(c.id)}">Nova senha</button><button type="button" class="pill ${c.blocked ? "pill-cream" : "pill-line"} pill-sm" data-block="${esc(c.id)}" data-on="${c.blocked ? 0 : 1}">${c.blocked ? "Liberar" : "Bloquear"}</button><button type="button" class="pill pill-line pill-sm" data-del="${esc(c.id)}">Excluir</button></div></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="card"><div class="empty"><b>${cs.length ? "Nenhuma conta com esse filtro" : "Nenhuma conta ainda"}</b><span>${cs.length ? "Mude a busca ou o filtro." : "Quando alguém criar a conta pela página de divulgação, ela aparece aqui. Você também pode criar em Criar conta."}</span></div></div>`}
      </div></main>`;
    $("#logout").addEventListener("click", () => logout());
    bindTheme(superPanel);
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
    $("#bSave").addEventListener("click", async (e) => {
      busy(e.currentTarget, true, "Salvando…");
      try { await put("system", { billing: { trialDays: $("#bTrial").value, monthly: $("#bMonthly").value, annual: $("#bAnnual").value, enforce: $("#bEnforce").checked } }); await refresh("Planos salvos."); }
      catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
    $$("[data-bill]").forEach((b) => b.addEventListener("click", async () => {
      const c = byId(b.dataset.bill), sb = c.sub, rq = sb.requested;
      const H = { pagamento: "Pagamento", pedido: "Pedido de plano", cancelamento: "Renovação cancelada", cortesia: "Cortesia", "fim da cortesia": "Fim da cortesia", "teste estendido": "Teste estendido" };
      const v = await confirmModal({ eyebrow: "Cobrança", tone: "green", title: esc(c.name), confirm: "Aplicar",
        html: `<p class="small" style="margin:0">Situação: <b>${SUB_LABEL[sb.status]}</b>${sb.status === "ativa" ? ` · ${PLAN_LABEL[sb.plan] || ""} pago até ${dBR(sb.paidUntil)}` : sb.status === "teste" ? ` · teste até ${dBR(sb.trialEndsAt)}` : ""}${rq ? ` · pediu o plano ${PLAN_LABEL[rq.plan].toLowerCase()} em ${esc(R.dateTime(rq.at))}` : ""}</p>
          <label class="fl"><span>O que fazer</span><select class="sel" id="blAct"><option value="pay">Registrar pagamento recebido</option><option value="trial">Estender o teste grátis</option><option value="exempt">${sb.status === "isenta" && !c.demo ? "Tirar a cortesia" : "Dar cortesia (sem cobrança)"}</option>${sb.status === "ativa" && !sb.canceled ? '<option value="cancel">Cancelar a renovação</option>' : ""}</select></label>
          <div class="grid2"><label class="fl"><span>Plano pago</span><select class="sel" id="blPlan"><option value="mensal"${(rq ? rq.plan : sb.plan) !== "anual" ? " selected" : ""}>Mensal · ${esc(brl(D.billing.monthly))}</option><option value="anual"${(rq ? rq.plan : sb.plan) === "anual" ? " selected" : ""}>Anual · ${esc(brl(D.billing.annual))}</option></select></label>
          <label class="fl"><span>Valor recebido (R$, vazio = preço do plano)</span><input class="inp" id="blAmt" inputmode="decimal"></label></div>
          <div class="grid2"><label class="fl"><span>Dias a mais de teste</span><input class="inp" id="blDays" type="number" min="1" max="90" value="7"></label><label class="fl"><span>Anotação (ex.: Pix de 28/11)</span><input class="inp" id="blNote" maxlength="200"></label></div>
          ${c.billingHistory.length ? `<ul class="lines small">${c.billingHistory.map((h) => `<li><span>${esc(H[h.type] || h.type)}${h.plan ? " · " + esc(PLAN_LABEL[h.plan] || h.plan) : ""}${h.amount ? " · " + esc(brl(h.amount)) : ""}${h.until ? ` · até ${dBR(h.until)}` : ""}${h.note ? " · " + esc(h.note) : ""}</span><span class="muted">${esc(R.dateTime(h.at))}</span></li>`).join("")}</ul>` : ""}`,
        getValue: (w) => ({ action: $("#blAct", w).value, plan: $("#blPlan", w).value, amount: $("#blAmt", w).value.replace(",", "."), days: $("#blDays", w).value, note: $("#blNote", w).value.trim(), on: !(sb.status === "isenta" && !c.demo) }) });
      if (!v) return;
      try { await post(`companies/${c.id}/billing`, v); await refresh(v.action === "pay" ? "Pagamento registrado. O plano está ativo." : "Cobrança atualizada."); } catch (err) { R.toast(err.message); }
    }));
    $("#demoAcc").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (cs.some((c) => c.demo) && !(await confirmModal({ title: "Recriar a conta de teste?", html: "<p>Tudo o que foi feito na conta de teste é apagado e ela volta ao modelo inicial. O login continua o mesmo.</p>", confirm: "Recriar" }))) return;
      busy(btn, true, "Criando…");
      try { const r = await post("demo-account"); await refresh("Conta de teste pronta."); out(`<div class="okbox"><span>Conta de teste pronta. Entre em <b>/entrar</b> com <code class="pw">${esc(r.email)}</code> e a senha <code class="pw">${esc(r.password)}</code>.</span></div>`); }
      catch (err) { R.toast(err.message); busy(btn, false); }
    });
    $("#supNewBtn").addEventListener("click", async () => {
      const v = await confirmModal({ eyebrow: "Nova conta", title: "Criar conta", tone: "green", confirm: "Criar conta",
        html: `<p class="muted small">A senha é gerada e aparece aqui para você enviar ao responsável. No primeiro acesso ele confirma o WhatsApp com um código e pode trocar a senha em Conta e plano.</p>
          <label class="fl"><span>Nome do responsável</span><input class="inp" id="nwName"></label>
          <label class="fl"><span>Nome da empresa</span><input class="inp" id="nwCo"></label>
          <label class="fl"><span>WhatsApp do responsável (é o acesso dele)</span><input class="inp" id="nwTel" inputmode="tel" placeholder="(44) 99999-0000"></label>
          <label class="fl"><span>Anotação interna (só você vê)</span><input class="inp" id="nwNote" maxlength="400"></label>`,
        getValue: (w) => ({ name: $("#nwName", w).value.trim(), company: $("#nwCo", w).value.trim(), phone: $("#nwTel", w).value.trim(), note: $("#nwNote", w).value.trim() }) });
      if (!v) return;
      try { const r = await post("companies", v); await refresh("Conta criada."); out(`<div class="okbox"><span>Conta <b>${esc(r.company.name)}</b> criada. Acesso em /entrar com o WhatsApp <code class="pw">${esc(r.company.owner.phoneFmt)}</code> e a senha <code class="pw">${esc(r.password)}</code>.</span></div>`); }
      catch (err) { R.toast(err.message); }
    });
    $$("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
      const c = byId(b.dataset.edit);
      const v = await confirmModal({ eyebrow: "Conta", title: "Editar " + esc(c.name), tone: "green", confirm: "Salvar",
        html: `<label class="fl"><span>Nome da empresa</span><input class="inp" id="edCo" value="${esc(c.name)}"></label>
          <label class="fl"><span>Nome do responsável</span><input class="inp" id="edName" value="${esc(c.owner.name)}"></label>
          ${c.demo ? "" : `<label class="fl"><span>WhatsApp de acesso do responsável${c.owner.email && !c.owner.phone ? ` (hoje entra com ${esc(c.owner.email)})` : ""}</span><input class="inp" id="edTel" inputmode="tel" value="${esc(c.owner.phoneFmt)}"><small>Trocar o número pede um código no próximo acesso.</small></label>`}
          <label class="fl"><span>Limite de consultores (vazio = padrão do sistema; 0 = sem limite)</span><input class="inp" id="edMax" type="number" min="0" max="500" value="${c.maxSellersOwn != null ? esc(c.maxSellersOwn) : ""}"></label>
          <label class="fl"><span>Anotação interna (só você vê)</span><input class="inp" id="edNote" maxlength="400" value="${esc(c.note || "")}"></label>`,
        getValue: (w) => ({ company: $("#edCo", w).value.trim(), ownerName: $("#edName", w).value.trim(), ...($("#edTel", w) && $("#edTel", w).value.trim() ? { ownerPhone: $("#edTel", w).value.trim() } : {}), maxSellers: $("#edMax", w).value === "" ? null : $("#edMax", w).value, note: $("#edNote", w).value.trim() }) });
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
      try { const r = await post(`companies/${c.id}/reset`); out(`<div class="okbox"><span>Nova senha de <b>${esc(c.name)}</b> (${esc(r.company.owner.phoneFmt || r.company.owner.email)}): <code class="pw">${esc(r.password)}</code>. Envie para o responsável; a senha antiga deixou de valer.</span></div>`); }
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

  /* ---------- WhatsApp de acesso (responsável e consultor): trocar com código ---------- */
  function phoneCardHTML(who, locked) {
    const has = who.phone, ok = has && who.phoneVerified;
    return `<div class="fl" id="phCard"><span>WhatsApp de acesso</span>
      <p class="small" style="margin:0">${has ? `<b>${esc(fmtTel(who.phone))}</b> ${ok ? '<span class="st assinada">Confirmado</span>' : '<span class="st contrato">A confirmar</span>'}` : `Hoje você entra com o e-mail ${esc(who.email || "")}. Cadastre o seu WhatsApp para entrar e recuperar a senha por ele.`}</p>
      ${locked ? '<small>Na conta modelo de teste o acesso não muda.</small>' : `<div class="linkbox" id="phStep1"><input class="inp" id="phNew" inputmode="tel" placeholder="${has ? "Novo WhatsApp" : "Seu WhatsApp"}, com DDD"><button type="button" class="pill pill-cream" id="phSend">Enviar código</button></div>
      <div class="linkbox" id="phStep2" hidden><input class="inp" id="phCode" inputmode="numeric" maxlength="6" placeholder="Código de 6 números" autocomplete="one-time-code"><button type="button" class="pill pill-green" id="phOk">Confirmar</button></div>
      <small id="phMsg">O código chega no número novo e vale por 10 minutos.</small>`}</div>`;
  }
  function bindPhoneCard(after) {
    const send = $("#phSend"); if (!send) return;
    const inp = $("#phNew"); inp.addEventListener("input", () => (inp.value = maskTel(inp.value)));
    let phone = "";
    send.addEventListener("click", async () => {
      phone = inp.value.trim();
      if (R.digits(phone).length < 10) { R.toast("Informe o WhatsApp com DDD."); return; }
      busy(send, true, "Enviando…");
      try { const r = await post("phone", { phone }); $("#phStep2").hidden = false; $("#phMsg").textContent = `Código enviado para ${r.phone}. Digite os 6 números.`; $("#phCode").focus(); }
      catch (err) { R.toast(err.message); }
      busy(send, false);
    });
    $("#phOk").addEventListener("click", async (e) => {
      busy(e.currentTarget, true, "Confirmando…");
      try { await post("phone/confirm", { phone, code: $("#phCode").value.trim() }); await reload(); R.toast("WhatsApp confirmado. Use este número para entrar."); after(); }
      catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  /* ---------- minha conta (responsável pela empresa) ---------- */
  async function account() {
    shell("acc", R.loadingHTML("Carregando…"));
    let c = null;
    try { c = (await api("account")).company; } catch (e) { R.toast(e.message); return; }
    shell("acc", `
      <div class="pgh"><div><span class="label">Administrador</span><h1>Conta e plano</h1><p class="sub">Dados de acesso do responsável pela conta de ${esc(c.name)} e o plano do sistema. Os dados que aparecem nas propostas e contratos ficam em Empresa.</p></div></div>
      ${(() => { const sb = S.data.sub || {}; return `<a class="card accent page-cta" href="#/plano" style="margin-bottom:16px"><span><b>Plano e pagamento · ${esc(SUB_LABEL[sb.status] || "")}</b><small>${sb.status === "teste" ? `Teste grátis até ${dBR(sb.trialEndsAt)}. Depois, ${brl((sb.prices || {}).mensal)} por mês ou ${brl((sb.prices || {}).anual)} por ano.` : sb.status === "ativa" ? `Plano ${(PLAN_LABEL[sb.plan] || "").toLowerCase()} pago até ${dBR(sb.paidUntil)}.` : sb.status === "isenta" ? "Esta conta não tem cobrança." : "O plano venceu. Escolha um plano para continuar."}</small></span><span class="pill pill-green">Ver planos</span></a>`; })()}
      <div class="cols">
        <div class="stack"><div class="card"><h2>Dados de acesso</h2>
          <label class="fl"><span>Seu nome</span><input class="inp" id="aName" value="${esc(c.owner.name)}"></label>
          ${phoneCardHTML(c.owner, !!c.demo)}
          <div class="row-acts"><button type="button" class="pill pill-green" id="aSave">Salvar</button></div>
        </div></div>
        <div class="stack"><div class="card"><h2>Trocar senha</h2>
          <label class="fl"><span>Senha atual</span><input class="inp" type="password" id="aCur" autocomplete="current-password"></label>
          <label class="fl"><span>Nova senha (mínimo 8 caracteres)</span><input class="inp" type="password" id="aNew" autocomplete="new-password"></label>
          <div class="row-acts"><button type="button" class="pill pill-line" id="aPw">Trocar senha</button></div>
        </div></div>
      </div>`);
    bindPhoneCard(account);
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

  /* ---------- plano e pagamento (responsável pela empresa) ---------- */
  const PLAN_LABEL = { mensal: "Mensal", anual: "Anual" };
  const SUB_LABEL = { teste: "Teste grátis", ativa: "Ativo", vencida: "Vencido", isenta: "Cortesia" };
  const dBR = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
  // faixa no topo do painel: dias de teste, plano vencido ou pedido aguardando confirmação
  function planBanner(active) {
    const sb = S.data.sub;
    if (!sb || active === "plan") return "";
    const bar = (cls, html, cta) => `<div class="${cls}" style="margin:0;border-radius:0;justify-content:center"><span>${html}</span>${cta && isAdm() ? `<a class="pill pill-cream pill-sm" href="#/plano">${cta}</a>` : ""}</div>`;
    if (sb.status === "vencida") return bar("warnbox", isAdm() ? `<b>${sb.paidUntil ? "O seu plano venceu." : "O teste grátis terminou."}</b> ${sb.enforce ? "Escolha um plano para voltar a criar e enviar propostas. Os links já enviados continuam funcionando." : "Escolha um plano para continuar usando sem interrupção."}` : "O plano da sua empresa venceu. Fale com o administrador da conta.", "Escolher plano");
    if (!isAdm()) return "";
    if (sb.requested) return bar("okbox", `Pedido do plano ${PLAN_LABEL[sb.requested.plan] || ""} recebido. O plano fica ativo assim que o pagamento for confirmado.`);
    if (sb.status === "teste") return bar("okbox", `Teste grátis: ${sb.daysLeft === 1 ? "último dia" : `faltam ${sb.daysLeft} dias`} (até ${dBR(sb.trialEndsAt)}). Depois, ${brl(sb.prices.mensal)} por mês.`, "Ver planos");
    if (sb.status === "ativa" && sb.daysLeft <= 5) return bar("warnbox", sb.canceled ? `O seu plano termina em ${dBR(sb.paidUntil)} e não será renovado.` : `O seu plano ${PLAN_LABEL[sb.plan] ? PLAN_LABEL[sb.plan].toLowerCase() : ""} vence em ${dBR(sb.paidUntil)}.`, "Renovar");
    return "";
  }
  async function plan() {
    shell("plan", R.loadingHTML("Carregando…"));
    let d;
    try { d = await api("billing"); } catch (e) { R.toast(e.message); return; }
    const sb = d.sub, pr = sb.prices, annualMonth = pr.anual / 12, save = Math.max(0, Math.round((1 - pr.anual / (pr.mensal * 12)) * 100));
    const statusLine = sb.status === "isenta" ? "Esta conta não tem cobrança."
      : sb.status === "teste" ? `Teste grátis até ${dBR(sb.trialEndsAt)} (${sb.daysLeft === 1 ? "último dia" : `${sb.daysLeft} dias`}). Escolha um plano para continuar depois disso.`
      : sb.status === "ativa" ? `Plano ${PLAN_LABEL[sb.plan] ? PLAN_LABEL[sb.plan].toLowerCase() : ""} pago até ${dBR(sb.paidUntil)}.${sb.canceled ? " A renovação foi cancelada: o acesso continua até essa data." : ""}`
      : `${sb.paidUntil ? `O plano venceu em ${dBR(sb.paidUntil)}.` : `O teste grátis terminou em ${dBR(sb.trialEndsAt)}.`} ${sb.enforce ? "Até escolher um plano, a conta fica só para consulta; os links já enviados continuam funcionando." : ""}`;
    const card = (k, price, per, note, best) => `<div class="card plan-card${best ? " best" : ""}${sb.plan === k && sb.status === "ativa" ? " cur" : ""}"><div class="ch"><h2>${PLAN_LABEL[k]}</h2>${best ? '<span class="st assinada">Mais econômico</span>' : ""}</div>
        <p class="plan-price"><b>${brl(price)}</b><span>/${per}</span></p><p class="muted small" style="margin:0">${note}</p>
        <div class="row-acts"><button type="button" class="pill ${best ? "pill-green" : "pill-line"} pill-lg" data-plan="${k}"${sb.status === "isenta" || S.data.su ? " disabled" : ""}>${sb.status === "ativa" && sb.plan === k ? "Renovar" : sb.status === "ativa" ? `Mudar para o ${PLAN_LABEL[k].toLowerCase()}` : `Assinar o ${PLAN_LABEL[k].toLowerCase()}`}</button></div></div>`;
    const TYPE = { pagamento: "Pagamento", pedido: "Pedido de plano", cancelamento: "Renovação cancelada", cortesia: "Cortesia", "fim da cortesia": "Fim da cortesia", "teste estendido": "Teste estendido" };
    shell("plan", `
      <div class="pgh"><div><span class="label">Assinatura do sistema</span><h1>Plano e pagamento</h1><p class="sub">${esc(statusLine)}</p></div><span class="st ${sb.status === "vencida" ? "recusada" : sb.status === "teste" ? "contrato" : "assinada"}">${SUB_LABEL[sb.status]}</span></div>
      ${sb.requested ? `<div class="okbox" style="margin-bottom:16px">Pedido do plano <b>${PLAN_LABEL[sb.requested.plan]}</b> feito em ${esc(R.dateTime(sb.requested.at))}. Você recebe as instruções de pagamento no seu WhatsApp, e o plano fica ativo assim que o pagamento for confirmado.</div>` : ""}
      <div class="cols">
        ${card("mensal", pr.mensal, "mês", "Pago todo mês. Cancele quando quiser.", false)}
        ${card("anual", pr.anual, "ano", `Equivale a ${brl(annualMonth)} por mês${save ? `, ${save}% a menos que o mensal` : ""}. Pago uma vez por ano.`, true)}
      </div>
      <div class="cols" style="margin-top:16px">
        <div class="stack"><div class="card"><h2>O que está incluso</h2>
          <ul class="small steps-list"><li>Propostas e contratos ilimitados, com a sua marca</li><li>Assinatura online (desenhada ou com nome e CPF/CNPJ)</li><li>Consultores na mesma conta${sb.status !== "isenta" ? "" : ""}</li><li>Resumo do mês com valores fechados</li><li>Links que continuam funcionando para os seus clientes</li></ul>
          ${sb.status === "ativa" && !sb.canceled ? '<div class="row-acts"><button type="button" class="pill pill-line pill-sm" id="planCancel">Cancelar a renovação</button></div>' : ""}
        </div></div>
        <div class="stack"><div class="card"><h2>Histórico</h2>
          ${d.history.length ? `<ul class="lines">${d.history.map((h) => `<li><span>${esc(TYPE[h.type] || h.type)}${h.plan ? " · " + esc(PLAN_LABEL[h.plan] || h.plan) : ""}${h.amount ? " · " + brl(h.amount) : ""}${h.until ? ` · até ${dBR(h.until)}` : ""}</span><span class="muted small">${esc(R.dateTime(h.at))}</span></li>`).join("")}</ul>` : '<p class="muted small" style="margin:0">Nenhum pagamento ainda.</p>'}
          <p class="muted small" style="margin:0">Pagamento: ${esc(d.provider)}.</p>
        </div></div>
      </div>`);
    $$("[data-plan]").forEach((b) => b.addEventListener("click", async () => {
      const k = b.dataset.plan;
      const ok = await confirmModal({ eyebrow: "Plano", tone: "green", title: `Assinar o plano ${PLAN_LABEL[k].toLowerCase()}?`, html: `<p>${k === "anual" ? `${brl(pr.anual)} por ano` : `${brl(pr.mensal)} por mês`}. ${sb.status === "ativa" ? "O novo período começa quando o atual terminar." : "O plano fica ativo assim que o pagamento for confirmado."}</p>`, confirm: "Confirmar" });
      if (!ok) return;
      busy(b, true, "Enviando…");
      try { const r = await post("billing/checkout", { plan: k }); if (r.url) { location.href = r.url; return; } await reload(); plan(); R.toast("Pedido registrado. As instruções de pagamento chegam no seu WhatsApp."); }
      catch (err) { R.toast(err.message); busy(b, false); }
    }));
    const pc = $("#planCancel");
    if (pc) pc.addEventListener("click", async () => { if (!armed(pc, "O acesso continua até o fim do período. Confirmar?")) return; try { await post("billing/cancel"); await reload(); plan(); R.toast("Renovação cancelada."); } catch (err) { R.toast(err.message); } });
  }

  /* ---------- resumo do mês ---------- */
  const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const monthName = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} de ${y}`; };
  const shiftMonth = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  // soma por moeda: R$ primeiro; outras moedas ao lado
  const mm = (o) => { const e = Object.entries(o || {}).filter(([, v]) => v); if (!e.length) return mny(0); e.sort(([a], [b]) => (a === "BRL" ? -1 : b === "BRL" ? 1 : a.localeCompare(b))); return e.map(([c, v]) => mny(v, c)).join(" + "); };
  const brlOf = (o) => (o && o.BRL) || 0;
  const delta = (now, before) => { if (!before && !now) return ""; if (!before) return '<small class="up">novo</small>'; const d = Math.round(((now - before) / before) * 100); return `<small class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : ""}${d}% sobre o mês anterior</small>`; };
  const EV = { fechada: ["Fechada", "assinada"], aceita: ["Aceita", "pedido"], recusada: ["Recusada", "recusada"], vencida: ["Vencida", "vencida"], criada: ["Em aberto", "enviada"], enviada: ["Enviada", "enviada"] };
  async function report(ym) {
    const month = ym || S.repMonth || S.data.today.slice(0, 7);
    S.repMonth = month;
    shell("rep", R.loadingHTML("Montando o resumo…"));
    let r;
    try { r = await api("report?month=" + encodeURIComponent(month)); } catch (e) { shell("rep", `<div class="card"><div class="empty"><b>${esc(e.message)}</b></div></div>`); return; }
    const C = r.counts, M = r.money, P = r.previous;
    const closedTxt = [brlOf(M.signedOnce) || !brlOf(M.signedMonthly) ? mm(M.signedOnce) : "", brlOf(M.signedMonthly) ? mm(M.signedMonthly) + "/mês" : ""].filter(Boolean).join(" + ");
    const rate = (v) => (v == null ? "-" : v + "%");
    shell("rep", `
      <div class="pgh rep-head"><div><span class="label">${r.seller ? "Suas propostas" : "Todas as propostas"}</span><h1>Resumo de ${esc(monthName(r.month))}</h1><p class="sub">Propostas criadas, aceitas, recusadas e fechadas no mês, com os serviços e os valores. Conta pela data de cada acontecimento (horário de Brasília).</p></div>
        <div class="acts no-print"><button type="button" class="pill pill-line" id="repPrev"${r.month <= r.firstMonth ? " disabled" : ""}>← Mês anterior</button><input class="inp" type="month" id="repMonth" value="${esc(r.month)}" min="${esc(r.firstMonth)}" max="${esc(r.currentMonth)}" style="width:auto"><button type="button" class="pill pill-line" id="repNext"${r.month >= r.currentMonth ? " disabled" : ""}>Próximo mês →</button><button type="button" class="pill pill-line" id="repCsv">Baixar planilha (.csv)</button><button type="button" class="pill pill-green" id="repPrint">Imprimir ou salvar PDF</button></div></div>
      <div class="tiles">
        <div class="tile"><span>Valor fechado</span><b>${esc(closedTxt)}</b>${delta(brlOf(M.signedOnce) + brlOf(M.signedMonthly), brlOf(P.money.signedOnce) + brlOf(P.money.signedMonthly))}</div>
        <div class="tile"><span>Contratos assinados</span><b>${C.signed}</b><small>${P.counts.signed} no mês anterior</small></div>
        <div class="tile"><span>Propostas criadas</span><b>${C.created}</b><small>${C.sent} enviadas · ${C.viewed} abertas pelo cliente</small></div>
        <div class="tile"><span>Aceitas · recusadas</span><b>${C.ordered} · ${C.declined}</b><small>${C.expired} vencida(s) sem resposta</small></div>
      </div>
      <div class="cols" style="margin-top:16px">
        <div class="stack"><div class="card"><h2>Finanças do mês</h2>
          <dl class="kv">
            <dt>Projetos fechados</dt><dd>${esc(mm(M.signedOnce))}</dd>
            <dt>Mensalidades fechadas</dt><dd>${esc(mm(M.signedMonthly))}/mês</dd>
            <dt>Valor total dos contratos</dt><dd>${esc(mm(M.signedTerm))} <span class="muted small">(projetos + mensalidades pelo prazo mínimo)</span></dd>
            <dt>Entradas a receber</dt><dd>${esc(mm(M.signedUpfront))} <span class="muted small">(para começar)</span></dd>
            <dt>Aceitas, sem contrato assinado</dt><dd>${esc(mm(M.pendingOnce))}${brlOf(M.pendingMonthly) || Object.keys(M.pendingMonthly).length ? " + " + esc(mm(M.pendingMonthly)) + "/mês" : ""}</dd>
            <dt>Valor recusado (estimado)</dt><dd>${esc(mm(M.declinedMin))} <span class="muted small">(menor opção de cada serviço)</span></dd>
          </dl>
        </div></div>
        <div class="stack"><div class="card"><h2>Desempenho</h2>
          <dl class="kv">
            <dt>Taxa de aceite</dt><dd>${rate(r.rates.acceptance)} <span class="muted small">das propostas criadas no mês já têm pedido</span></dd>
            <dt>Taxa de fechamento</dt><dd>${rate(r.rates.closing)} <span class="muted small">assinadas entre as decididas no mês (assinadas + recusadas)</span></dd>
            <dt>Em aberto</dt><dd>${C.open} proposta(s) criada(s) no mês ainda sem resposta</dd>
            <dt>Valor proposto</dt><dd>${esc(mm(M.offeredMin))} <span class="muted small">(menor opção de cada serviço, nas propostas criadas)</span></dd>
          </dl>
        </div></div>
      </div>
      <div class="card" style="margin-top:16px"><h2>Serviços</h2>
        ${r.services.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Serviço</th><th class="n">Oferecido</th><th class="n">Escolhido</th><th class="n">Fechado</th><th class="r">Valor fechado</th></tr></thead><tbody>${r.services.map((x) => `<tr><td><b>${esc(x.name)}</b><div class="svcs">${x.kind === "mensal" ? "Mensal" : "Projeto"}</div></td><td class="n">${x.offered}</td><td class="n">${x.chosen}</td><td class="n">${x.signed}</td><td class="r">${x.signed ? esc(x.kind === "mensal" ? mm(x.monthly) + "/mês" : mm(x.once)) : '<span class="muted">-</span>'}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted small" style="margin:0">Nenhum serviço oferecido ou fechado neste mês.</p>'}
      </div>
      ${!r.seller && r.sellers.length > 1 ? `<div class="card" style="margin-top:16px"><h2>Por consultor</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quem</th><th class="n">Criadas</th><th class="n">Aceitas</th><th class="n">Recusadas</th><th class="n">Fechadas</th><th class="r">Valor fechado</th></tr></thead><tbody>${r.sellers.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td class="n">${x.created}</td><td class="n">${x.ordered}</td><td class="n">${x.declined}</td><td class="n">${x.signed}</td><td class="r">${x.signed ? esc([Object.keys(x.once).length ? mm(x.once) : "", Object.keys(x.monthly).length ? mm(x.monthly) + "/mês" : ""].filter(Boolean).join(" + ")) : '<span class="muted">-</span>'}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
      <div class="card" style="margin-top:16px"><h2>Propostas do mês</h2>
        ${r.rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="n">Nº</th><th>Cliente</th>${r.seller ? "" : "<th>Consultor</th>"}<th>No mês</th><th class="r">Valor</th></tr></thead><tbody>${r.rows.map((x) => `<tr data-id="${esc(x.id)}"><td class="n">${esc(x.number)}</td><td><b>${esc(x.client || "Sem nome")}</b><div class="svcs">${esc(x.services.join(" · "))}</div>${x.reason ? `<div class="svcs">Motivo: ${esc(x.reason)}</div>` : ""}</td>${r.seller ? "" : `<td>${x.seller ? esc(x.seller) : '<span class="muted">-</span>'}</td>`}<td><span class="st ${EV[x.event][1]}">${EV[x.event][0]}</span></td><td class="r">${x.once || x.monthly ? `${x.once ? mny(x.once, x.currency) : ""}${x.once && x.monthly ? "<br>" : ""}${x.monthly ? mny(x.monthly, x.currency) + "/mês" : ""}` : '<span class="muted">-</span>'}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty"><span>Nenhuma proposta criada, aceita, recusada ou fechada neste mês.</span></div>'}
      </div>`);
    const go = (v) => { if (v) location.hash = "#/resumo/" + v; };
    $("#repMonth").addEventListener("change", (e) => go(e.target.value));
    $("#repPrev").addEventListener("click", () => go(shiftMonth(r.month, -1)));
    $("#repNext").addEventListener("click", () => go(shiftMonth(r.month, 1)));
    $("#repPrint").addEventListener("click", () => window.print());
    $$(".tbl tr[data-id]").forEach((tr) => tr.addEventListener("click", () => (location.hash = "#/proposta/" + tr.dataset.id)));
    $("#repCsv").addEventListener("click", () => {
      // planilha com ponto e vírgula (abre direto no Excel em português); campos que começam com = + - @ ganham um apóstrofo
      const cell = (v) => { let x = String(v ?? ""); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
      const num = (v) => (Number(v) || 0).toFixed(2).replace(".", ",");
      const head = ["Número", "Cliente", "Serviços", ...(r.seller ? [] : ["Consultor"]), "No mês", "Moeda", "Projetos", "Mensal", "Criada em", "Assinada em", "Recusada em", "Motivo da recusa"];
      const lines = r.rows.map((x) => [x.number, x.client, x.services.join(" | "), ...(r.seller ? [] : [x.seller]), EV[x.event][0], x.currency, num(x.once), num(x.monthly), x.createdAt ? R.dateTime(x.createdAt) : "", x.signedAt ? R.dateTime(x.signedAt) : "", x.declinedAt ? R.dateTime(x.declinedAt) : "", x.reason]);
      const csv = "\ufeff" + [head, ...lines].map((l) => l.map(cell).join(";")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `resumo-${r.month}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    });
  }

  /* ---------- casca ---------- */
  function shell(active, html) {
    const nav = isAdm()
      ? [["#/", "Propostas", "list"], ["#/resumo", "Resumo", "rep"], ["#/pagina", "Página da proposta", "page"], ["#/servicos", "Serviços", "cat"], ["#/equipe", "Equipe", "team"], ["#/empresa", "Empresa", "biz"], ["#/config", "Configurações", "cfg"], S.data.su ? ["#/plano", "Plano", "plan"] : ["#/conta", "Conta e plano", "acc"]]
      : [["#/", "Propostas", "list"], ["#/resumo", "Resumo do mês", "rep"], ["#/perfil", "Meu perfil", "me"]];
    const banner = planBanner(active);
    if (active === "plan" && !S.data.su) active = "acc";
    app.innerHTML = `${S.data.notice ? `<div class="warnbox" style="margin:0;border-radius:0;justify-content:center"><span>${esc(S.data.notice)}</span></div>` : ""}${banner}${S.data.su ? `<div class="warnbox" style="margin:0;border-radius:0;justify-content:center"><span>Você está no painel de <b>${esc(S.data.company.name)}</b> como dono do sistema.</span><button type="button" class="pill pill-cream pill-sm" id="suBack">Voltar à lista de empresas</button></div>` : ""}<header class="adm-top wrap"><div class="inner">
        <a class="brand" href="#/">${R.logoHTML("escuro")}</a><span class="tag">${isAdm() ? "Propostas" : "Consultor · " + esc(first(me().name))}</span>
        <nav>${nav.map(([h, t, k]) => `<a class="pill ${active === k ? "on" : "pill-line"}" href="${h}">${t}</a>`).join("")}<a class="pill pill-green" href="#/nova">Nova proposta</a>${themeBtn()}<button class="pill pill-line" type="button" id="logout">Sair</button></nav>
      </div></header><main class="adm-main wrap"><div class="inner">${html}</div></main>`;
    $("#logout").addEventListener("click", () => (S.data.su ? backToSuper() : logout()));
    bindTheme(route);
    const sb = $("#suBack"); if (sb) sb.addEventListener("click", backToSuper);
    $$('.adm-top nav a[href="#/"], .adm-top .brand').forEach((a) => a.addEventListener("click", () => { S.view = "all"; S.sel && S.sel.clear(); if (location.hash === "#/" || !location.hash) list(); }));
    window.scrollTo(0, 0);
  }

  async function start() {
    app.innerHTML = R.loadingHTML("Carregando o painel…");
    try { await reload(); } catch (e) { if (S.token) { app.innerHTML = R.stateHTML("Não foi possível carregar", esc(e.message), '<button type="button" class="pill pill-green pill-lg" id="retryBtn">Tentar de novo</button>'); $("#retryBtn").addEventListener("click", () => location.reload()); } return; }
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
    if (h === "resumo" || /^resumo\/\d{4}-\d{2}$/.test(h)) return report(h.split("/")[1]);
    if (isAdm()) {
      if (h === "servicos") return catalog();
      if (h === "config") return config();
      if (h === "empresa") return empresa();
      if (h === "pagina") return pagina();
      if (h === "equipe") return team();
      if (h === "conta" && !S.data.su) return account();
      if (h === "plano") return plan();
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
      title: p ? p.title : "", validUntil: p ? p.validUntil : addDays(today, S.data.settings.validityDays || 15),
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
      const body = { client: E.client, title: E.title, validUntil: E.validUntil, folderId: E.folderId || null };
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
            <div class="row-acts"><a class="pill pill-green" data-share="whatsapp" href="${waLink(p.client.phone, msg)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>${p.client.email ? `<a class="pill pill-line" data-share="e-mail" href="mailto:${esc(p.client.email)}?subject=${encodeURIComponent(M.sp)}&body=${encodeURIComponent(msg)}">Enviar por e-mail</a>` : ""}${!p.sentAt ? '<button type="button" class="pill pill-line" data-share="manual">Marcar como enviada</button>' : ""}</div>
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
    const emailSw = "";

    if (!isAdm()) {
      const m0 = me(), sg = st.agencySignature, canSend = st.sellersUseAgencySignature && sg;
      const interPanel = !c.seller
        ? `<div class="okbox">O administrador seguiu sem intermediador neste contrato. Não é preciso assinar.</div>`
        : inter
        ? `<div class="okbox">Você assinou como intermediador e testemunha em ${esc(R.dateTime(inter.at))}.</div>`
        : !m0.doc ? `<div class="warnbox"><span>Cadastre o seu CPF para assinar como intermediador.</span><a class="pill pill-cream pill-sm" href="#/perfil">Ir para Meu perfil</a></div>`
        : `${sigModeSeg("iMode", m0.hasSignature ? "salva" : "desenho", [...(m0.hasSignature ? [["salva", "Assinatura salva no perfil"]] : []), ["desenho", "Desenhar agora"], ["dados", "Só nome e CPF"]])}
           <div id="iPadWrap"${m0.hasSignature ? " hidden" : ""}><div id="iPad"></div><div class="row-acts" style="margin-top:8px"><button type="button" class="link-btn" id="iClear">Limpar</button>${m0.hasSignature ? "" : '<label class="switch" style="margin-left:auto"><input type="checkbox" id="iKeep" checked>Salvar no meu perfil</label>'}</div></div>
           <p class="muted small" id="iHint" style="margin:0" hidden>${DATA_HINT}</p>
           <p class="muted small" style="margin:0">${esc(m0.name)} · CPF ${esc(R.maskDoc(m0.doc))}</p>
           <div class="row-acts"><button type="button" class="pill pill-cream pill-lg" id="iSign">Assinar como intermediador e testemunha</button></div>`;
      return `${head}
        <h2 style="margin-top:8px">1. Sua assinatura · intermediador e testemunha</h2>${interPanel}
        <h2 style="margin-top:8px">2. Liberar para o cliente</h2>
        ${canSend ? `<p class="muted small" style="margin:0">A assinatura padrão da empresa (${esc(sg.name)}${sg.method === "dados" ? ", por nome e CPF/CNPJ" : ""}) é aplicada ao liberar, com o registro de que foi você quem liberou.</p>${emailSw}<div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="sendC"${miss.length || (c.seller && !inter) ? " disabled" : ""}>Liberar contrato para o cliente</button></div>` : `<div class="warnbox">A liberação com a assinatura da empresa está restrita ao administrador. Depois de assinar como intermediador, avise o administrador para liberar o contrato.</div>`}
      </div>`;
    }

    const sig = st.agencySignature;
    return `${head}
      ${c.seller ? (inter ? `<div class="okbox">Intermediador e testemunha: <b>${esc(inter.name)}</b> assinou em ${esc(R.dateTime(inter.at))}.</div>` : `<div class="warnbox"><span>O consultor <b>${esc(c.seller.name)}</b> ainda precisa assinar como intermediador e testemunha, no acesso dele (Painel do consultor › esta proposta). Depois disso você libera o contrato.</span><button type="button" class="pill pill-cream pill-sm" id="dropInter">Seguir sem o consultor neste contrato</button></div>`) : ""}
      <h2 style="margin-top:8px">Assinatura da empresa</h2>
      ${sig && !S.otherSig ? `<div class="sig-auto">${sigView(sig)}<div><b>${esc(sig.name)}</b><small>${esc(R.maskDoc(sig.doc || ""))} · ${sig.image ? "" : "por nome e CPF/CNPJ · "}aplicada automaticamente</small><button type="button" class="link-btn" id="sigOther">Usar outra assinatura só neste contrato</button></div></div>` : `<div class="grid2"><label class="fl"><span>Quem assina pela empresa *</span><input class="inp" id="aName" value="${esc((sig && sig.name) || st.agency.representative || "")}"></label><label class="fl"><span>CPF ou CNPJ *</span><input class="inp" id="aDoc" inputmode="numeric" value="${esc(R.maskDoc((sig && sig.doc) || st.agency.representativeDoc || st.agency.cnpj || ""))}"></label></div>
      <div class="fl"><span>Forma de assinar</span>${sigModeSeg("aMode", S.aMode || "desenho")}</div>
      <div id="aPadWrap"${S.aMode === "dados" ? " hidden" : ""}><div id="aPad"></div><div class="row-acts" style="margin-top:8px"><button type="button" class="link-btn" id="aClear">Limpar</button></div></div>
      <p class="muted small" id="aHint" style="margin:0"${S.aMode === "dados" ? "" : " hidden"}>${DATA_HINT}</p>
      <div class="row-acts">${sig ? '<button type="button" class="link-btn" id="sigBack">Voltar para a assinatura padrão</button>' : ""}<label class="switch"><input type="checkbox" id="aSave">Salvar esta assinatura como padrão</label></div>`}
      ${emailSw}
      <div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="sendC"${miss.length || needInter ? " disabled" : ""}>Liberar contrato para o cliente</button></div>
    </div>`;
  }

  const sentMsg = (what) => `${what}. Envie o link ao cliente pelo WhatsApp.`;

  function bindDetail() {
    const { proposal: p, contract: c } = S.detail;
    $$("[data-share]").forEach((b) => b.addEventListener("click", async (e) => {
      const via = b.dataset.share;
      if (via === "copiar") { e.preventDefault(); copy($("#plink").value); }
      try { await post(`proposals/${p.id}/sent`, { via: via === "manual" ? "" : via }); S.detail = await api("proposals/" + p.id); await reload(); renderDetail(); } catch (err) {}
    }));
    $$("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy)));
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
      const iWrap = $("#iPadWrap");
      const iMode = () => (($$('[name="iMode"]').find((r) => r.checked) || {}).value || "desenho");
      const mount = () => { if (S.padInter || !$("#iPad")) return; S.padInter = R.SignPad($("#iPad")); $("#iClear").addEventListener("click", () => S.padInter.clear()); };
      S.padInter = null;
      if (iWrap && !iWrap.hidden) mount();
      $$('[name="iMode"]').forEach((r) => r.addEventListener("change", () => { const m = iMode(); iWrap.hidden = m !== "desenho"; $("#iHint").hidden = m !== "dados"; if (m === "desenho") mount(); }));
      const iSign = $("#iSign");
      if (iSign) iSign.addEventListener("click", async () => {
        if (textDirty()) { R.toast("Salve o texto editado antes de assinar."); return; }
        const body = {}, md = iMode();
        if (md === "salva") body.useSaved = true;
        else if (md === "dados") body.method = "dados";
        else { if (!S.padInter || S.padInter.isEmpty()) { R.toast("Desenhe a sua assinatura."); return; } body.method = "desenho"; body.image = S.padInter.toPNG(); body.saveSignature = $("#iKeep") ? $("#iKeep").checked : false; }
        busy(iSign, true, "Assinando…");
        try { setC(await post(`contracts/${c.id}/intermediary`, body)); if (body.saveSignature) await reload(); renderDetail(); R.toast("Assinatura de intermediador registrada."); } catch (err) { R.toast(err.message); busy(iSign, false); }
      });
      const send = $("#sendC");
      if (send) send.addEventListener("click", async () => {
        if (textDirty()) { R.toast("Salve o texto editado antes de liberar."); return; }
        busy(send, true, "Liberando…");
        try { const r = await post(`contracts/${c.id}/send`, {}); S.detail = { ...S.detail, proposal: r.proposal, contract: r.contract, seller: r.seller }; await reload(); renderDetail(); R.toast(sentMsg("Contrato liberado", r)); }
        catch (err) { R.toast(err.message); busy(send, false); }
      });
      return;
    }

    const drop = $("#dropInter");
    if (drop) drop.addEventListener("click", async () => { if (!armed(drop, "Refaz o texto sem o consultor. Confirmar?")) return; try { setC(await post(`contracts/${c.id}/drop-intermediary`)); renderDetail(); R.toast("Contrato refeito sem o consultor. Já pode assinar e liberar."); } catch (err) { R.toast(err.message); } });
    const sig = S.data.settings.agencySignature;
    const useSaved = !!(sig && !S.otherSig);
    const other = $("#sigOther"); if (other) other.addEventListener("click", () => { S.otherSig = true; renderDetail(); });
    const back = $("#sigBack"); if (back) back.addEventListener("click", () => { S.otherSig = false; renderDetail(); });
    if (!useSaved) {
      const docIn = $("#aDoc"); docIn.addEventListener("input", () => (docIn.value = R.maskDoc(docIn.value)));
      S.padAgency = R.SignPad($("#aPad")); $("#aClear").addEventListener("click", () => S.padAgency.clear());
      $$('[name="aMode"]').forEach((r) => r.addEventListener("change", () => { S.aMode = r.value; $("#aPadWrap").hidden = r.value === "dados"; $("#aHint").hidden = r.value !== "dados"; if (r.value === "desenho") window.dispatchEvent(new Event("resize")); }));
    }
    $("#sendC").addEventListener("click", async (e) => {
      let signature = { useSaved: true };
      if (!useSaved) {
        const name = $("#aName").value.trim(), doc = R.digits($("#aDoc").value);
        if (name.length < 5) { R.toast("Informe o nome de quem assina pela empresa."); return; }
        if (!R.validDoc(doc)) { R.toast("CPF ou CNPJ de quem assina pela empresa é inválido."); return; }
        const method = S.aMode === "dados" ? "dados" : "desenho";
        if (method === "desenho" && (!S.padAgency || S.padAgency.isEmpty())) { R.toast("Desenhe a assinatura da empresa ou escolha assinar só com nome e CPF/CNPJ."); return; }
        signature = { name, doc, method, image: method === "desenho" ? S.padAgency.toPNG() : undefined };
      }
      if (textDirty()) { R.toast("Salve o texto editado antes de assinar."); return; }
      busy(e.currentTarget, true, "Assinando…");
      try {
        const r = await post(`contracts/${c.id}/send`, { signature, saveSignature: !useSaved && $("#aSave") && $("#aSave").checked});
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
      <div class="pgh"><div><span class="label">Equipe</span><h1>Consultores</h1><p class="sub">Vendedores e consultores entram com o WhatsApp e a senha, montam propostas, geram contratos e assinam como intermediadores e testemunhas.</p></div></div>
      ${np ? credBox(np) : ""}
      <div class="cols">
        <div class="stack">
          ${users.length ? `<div class="svc-pick" id="uList">${users.map((u) => userRow(u, count(u.id), signedCount(u.id))).join("")}</div>` : `<div class="card"><div class="empty"><b>Nenhum consultor ainda</b><span>Cadastre ao lado. Você recebe a senha de acesso para enviar a ele.</span></div></div>`}
        </div>
        <div class="stack">
          <div class="card"><h2>Novo consultor</h2>
            <label class="fl"><span>Nome completo *</span><input class="inp" id="nName" autocomplete="off"></label>
            <div class="grid2"><label class="fl"><span>WhatsApp *</span><input class="inp" id="nPhone" inputmode="tel" placeholder="(44) 99999-0000"><small>É o acesso dele. No primeiro acesso ele confirma com um código.</small></label><label class="fl"><span>CPF</span><input class="inp" id="nDoc" inputmode="numeric"><small>O consultor também pode completar depois.</small></label></div>
            <div class="row-acts"><button type="button" class="pill pill-green pill-lg" id="nSave">Cadastrar e gerar senha</button></div>
          </div>
          <div class="card"><h2>Como funciona</h2>
            <ol class="timeline">
              <li><time>Acesso</time><span>O consultor entra em ${esc(origin)}/entrar com o WhatsApp e a senha, e confirma o número com o código que chega no WhatsApp.</span></li>
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
    const msg = `Olá, ${first(np.user.name)}! Seu acesso ao painel de propostas de ${R.B.name}:\n${origin}/entrar\nWhatsApp: ${fmtTel(np.user.phone)}\nSenha: ${np.password}\n\nNo primeiro acesso, você recebe um código neste WhatsApp para confirmar. Depois, complete o seu CPF e salve a sua assinatura em Meu perfil. Depois, troque a senha por uma sua.`;
    return `<div class="card ok"><div class="ch"><h2>${np.reset ? "Nova senha gerada" : "Consultor cadastrado"}</h2><button type="button" class="pill pill-line pill-sm" id="credClose">Fechar</button></div>
      <p class="small" style="margin:0">Senha de <b>${esc(np.user.name)}</b>: <code class="pw">${esc(np.password)}</code>. Ela aparece só agora. Envie ao consultor:</p>
      <textarea class="ta" readonly rows="6" id="credMsg">${esc(msg)}</textarea>
      <div class="row-acts">${np.user.phone ? `<a class="pill pill-green" href="${waLink(np.user.phone, msg)}" target="_blank" rel="noopener">Enviar no WhatsApp</a>` : ""}<button type="button" class="pill pill-cream" id="credCopy">Copiar mensagem</button></div></div>`;
  }

  function userRow(u, n, sgn) {
    const open = S.userOpen === u.id;
    return `<div class="sp${open ? " on" : ""}" data-uid="${u.id}">
      <div class="sp-head" data-a="open" style="grid-template-columns:minmax(0,1fr) auto"><span><b>${esc(u.name)}${u.active ? "" : ' <span class="st recusada">Desativado</span>'}</b><small>${u.phone ? esc(fmtTel(u.phone)) + (u.phoneVerified ? "" : " (a confirmar)") : esc(u.email)} · ${u.doc ? "CPF ok" : "sem CPF"} · ${u.hasSignature ? "assinatura salva" : "sem assinatura"}</small></span><span class="pr">${n} proposta(s)${sgn ? ` · ${sgn} assinada(s)` : ""}</span></div>
      ${open ? `<div class="sp-body">
        <div class="grid3"><label class="fl"><span>Nome completo</span><input class="inp" data-u="name" value="${esc(u.name)}"></label><label class="fl"><span>WhatsApp (acesso)</span><input class="inp" data-u="phone" inputmode="tel" value="${esc(fmtTel(u.phone || ""))}"></label><label class="fl"><span>CPF</span><input class="inp" data-u="doc" inputmode="numeric" value="${esc(R.maskDoc(u.doc || ""))}"></label></div>
        <p class="muted small" style="margin:0">O WhatsApp é o acesso do consultor; trocar o número pede um código no próximo acesso dele. Cadastrado em ${esc(R.dateTime(u.createdAt))}.</p>
        <div class="row-acts"><button type="button" class="pill pill-cream pill-sm" data-a="save">Salvar</button><button type="button" class="pill pill-line pill-sm" data-a="reset">Gerar nova senha</button><button type="button" class="pill pill-line pill-sm" data-a="active" style="margin-left:auto">${u.active ? "Desativar acesso" : "Reativar acesso"}</button></div>
      </div>` : ""}
    </div>`;
  }

  function bindTeam() {
    const cc = $("#credClose"); if (cc) cc.addEventListener("click", () => { S.newPw = null; team(); });
    const cp = $("#credCopy"); if (cp) cp.addEventListener("click", () => copy($("#credMsg").value, "Mensagem copiada."));
    const nd = $("#nDoc"); nd.addEventListener("input", () => (nd.value = R.maskDoc(nd.value)));
    const np0 = $("#nPhone"); np0.addEventListener("input", () => (np0.value = maskTel(np0.value)));
    $("#nSave").addEventListener("click", async (e) => {
      const body = { name: $("#nName").value.trim(), phone: $("#nPhone").value.trim(), doc: R.digits($("#nDoc").value) };
      if (body.name.length < 5 || !body.name.includes(" ")) { R.toast("Informe o nome completo."); $("#nName").focus(); return; }
      if (R.digits(body.phone).length < 10) { R.toast("Informe o WhatsApp do consultor, com DDD."); $("#nPhone").focus(); return; }
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
            <label class="fl"><span>CPF *</span><input class="inp" id="pDoc" inputmode="numeric" value="${esc(R.maskDoc(u.doc || ""))}"></label>
            <div class="row-acts"><button type="button" class="pill pill-green" id="pSave">Salvar dados</button></div>
            ${phoneCardHTML(u, false)}
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
    bindPhoneCard(profile);
    $("#pSave").addEventListener("click", async (e) => {
      const name = $("#pName").value.trim(), doc = R.digits($("#pDoc").value);
      if (name.length < 5 || !name.includes(" ")) { R.toast("Informe o nome completo."); return; }
      if (!R.validDoc(doc) || doc.length !== 11) { R.toast("Informe um CPF válido."); return; }
      busy(e.currentTarget, true, "Salvando…");
      try { const r = await put("me", { name, doc }); S.data.me = r.me; R.toast("Dados salvos."); } catch (err) { R.toast(err.message); }
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
  // Tudo que identifica a empresa: dados do contrato, contato, logo e assinatura padrão.
  // Logos são salvos na hora; o resto no botão Salvar. Cores, fontes, galeria e textos ficam em Página da proposta.
  const DEF_COLORS = { primary: "#1f6049", accent: "#d4f26a", dark: "#0e2a20", light: "#f4f7f1" };
  const COLOR_LABEL = { primary: ["Cor principal", "Botões e destaques"], accent: ["Cor de destaque", "Títulos em destaque e detalhes"], dark: ["Fundo escuro", "Fundo das páginas e textos sobre fundo claro"], light: ["Fundo claro", "Textos sobre fundo escuro e áreas claras"] };
  // Textos da página da proposta (Dados da empresa): o exemplo de cada campo é o texto padrão do sistema
  const TX_LABEL = {
    hero_label: "Etiqueta do topo", hero_blur: "Frase inicial", hero_sharp: "Final da frase, em destaque",
    welcome: "Título das boas-vindas", team: "Frase de fechamento",
    pick_label: "Etiqueta", pick_h: "Título", note_fixed: "Explicação ao lado do título",
    steps_label: "Etiqueta", steps_h: "Título", steps_p: "Explicação", after_order: "Título dos próximos passos",
    pf_label: "Etiqueta", pf_h: "Título", pf_p: "Explicação",
    thanks: "Mensagem de agradecimento",
    your_order: "Etiqueta", h_review: "Título", lead_review: "Explicação", fine: "Aviso abaixo do resumo", accept: "Frase de concordância (caixa de marcar)", send: "Texto do botão de enviar",
    thanks_p: "Mensagem depois que o cliente envia o pedido", signed_p: "Mensagem depois que o contrato é assinado",
  };
  const txDefault = (k) => String((S.pg && R.LAYOUT_TEXTS && R.LAYOUT_TEXTS[S.pg.layout] && R.LAYOUT_TEXTS[S.pg.layout].pt[k]) || (R.T_PT && R.T_PT[k]) || "").replace(/<em>(.*?)<\/em>|<strong>(.*?)<\/strong>/g, (m, x, y) => `*${x || y}*`).replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").replace(/\{a\}/g, S.data.settings.agency.name || "sua empresa").replace(/\{d\}/g, "[data]").replace(/\{n\}/g, "");
  function tx(k) {
    const v = (S.data.settings.pageTexts || {})[k] || "", ph = txDefault(k), long = ph.length > 70 || ph.includes("\n");
    return `<label class="fl"><span>${TX_LABEL[k]}</span>${long ? `<textarea class="ta" data-tx="${k}" rows="3" placeholder="${esc(ph)}">${esc(v)}</textarea>` : `<input class="inp" data-tx="${k}" value="${esc(v)}" placeholder="${esc(ph)}">`}</label>`;
  }
  const txGroup = (title, body, open) => `<details class="tx-group"${open ? " open" : ""}><summary>${title}</summary><div class="stack">${body}</div></details>`;
  function empresa() {
    const st = S.data.settings, a = st.agency, b = st.brand || {};
    const fld = (k, l, ph = "", hint = "") => `<label class="fl"><span>${l}</span><input class="inp" data-ag="${k}" value="${esc(/cnpj|Doc/.test(k) ? R.maskDoc(a[k] || "") : a[k] || "")}" placeholder="${esc(ph)}"${/cnpj|Doc/.test(k) ? ' inputmode="numeric"' : ""}>${hint ? `<small>${hint}</small>` : ""}</label>`;
    const logoSlot = (kind, title, hint) => {
      const v = b.logos && b.logos[kind];
      return `<div class="logo-slot ${kind}"><div class="logo-prev">${v ? `<img src="/api/public/logo/${kind}${R.imgQ(v)}" alt="">` : `<span class="wordmark">${esc(a.name || "Sua empresa")}</span>`}</div>
        <div><b>${title}</b><small>${hint}</small><div class="row-acts"><label class="pill pill-cream pill-sm">${v ? "Trocar" : "Enviar logo"}<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-logo="${kind}" hidden></label>${v ? `<button type="button" class="link-btn" data-logo-del="${kind}">Remover</button>` : ""}</div></div></div>`;
    };
    shell("biz", `
      <div class="pgh"><div><span class="label">White label</span><h1>Dados da empresa</h1><p class="sub">Nome, contato, logo e assinatura que aparecem nas propostas e nos contratos. Serve para empresas e para freelancers.</p></div></div>
      <div class="cols">
        <div class="stack">
          <a class="card accent page-cta" href="#/pagina"><span><b>Página da proposta</b><small>Modelo, cores, fontes, galeria de trabalhos e todos os textos que o cliente vê ficam em Página da proposta, com prévia ao lado.</small></span><span class="pill pill-green">Abrir</span></a>
          <div class="card"><h2>Identificação e contrato</h2>
            <div class="grid2">${fld("name", "Nome que o cliente vê *", "Ex.: Estúdio Aurora ou Ana Souza Fotografia")}${fld("legalName", "Razão social ou nome completo *", "Como deve sair no contrato")}${fld("cnpj", "CNPJ ou CPF *", "", "Freelancer sem CNPJ pode usar o CPF.")}${fld("email", "E-mail *")}</div>
            ${fld("address", "Endereço completo *", "Rua, número, bairro e CEP")}
            <div class="grid3">${fld("city", "Cidade do foro *", "Ex.: Curitiba - PR")}${fld("representative", "Representante legal *", "Quem assina pela empresa")}${fld("representativeDoc", "CPF do representante")}</div>
            ${fld("pix", "Chave Pix", "", "Opcional. Aparece na cláusula de pagamento dos contratos em português.")}
          </div>
          <div class="card"><h2>Contato</h2>
            <div class="grid3"><label class="fl"><span>WhatsApp</span><input class="inp" id="cWa" inputmode="tel" value="${esc(st.whatsapp || "")}" placeholder="5511999990000"></label><label class="fl"><span>Instagram</span><input class="inp" id="cIg" value="${esc(st.instagram || "")}" placeholder="@suaempresa"></label><label class="fl"><span>Site</span><input class="inp" id="cSite" value="${esc(st.site || "")}" placeholder="https://"></label></div>
            <p class="muted small" style="margin:0">Aparecem no rodapé das propostas e nos botões de WhatsApp que o cliente usa para falar com você.</p>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h2>Logo</h2>
            ${logoSlot("escuro", "Para fundo escuro", "Aparece sobre fundos escuros (no tema escuro, o topo das páginas e do painel). De preferência PNG claro com fundo transparente.")}
            ${logoSlot("claro", "Para fundo claro", "Aparece sobre fundos claros (rodapé, contrato, PDF e o topo no tema claro). De preferência PNG escuro com fundo transparente.")}
            <p class="muted small" style="margin:0">Sem logo, o nome da empresa aparece em texto.</p>
          </div>
          <div class="card"><h2>Assinatura padrão da empresa</h2>
            ${st.agencySignature && !S.cfgSigNew ? `<div class="sig-saved">${sigView(st.agencySignature)}</div><p class="muted small" style="margin:0">${esc(st.agencySignature.name)} · ${esc(R.maskDoc(st.agencySignature.doc))}${st.agencySignature.image ? "" : " · por nome e CPF/CNPJ"}. Entra sozinha em todos os contratos, sem precisar assinar de novo.</p><div class="row-acts"><button type="button" class="pill pill-line pill-sm" id="sigNewCfg">Trocar assinatura</button><button type="button" class="pill pill-line pill-sm" id="sigDel">Apagar assinatura</button></div>` :
            `${st.agencySignature ? '<div class="row-acts"><button type="button" class="link-btn" id="sigCancelCfg">Cancelar</button></div>' : '<p class="muted small" style="margin:0">Salve uma vez e ela entra sozinha em todos os contratos.</p>'}<label class="fl"><span>Nome completo</span><input class="inp" id="sgName" value="${esc(a.representative || "")}"></label><label class="fl"><span>CPF ou CNPJ</span><input class="inp" id="sgDoc" value="${esc(R.maskDoc(a.representativeDoc || a.cnpj || ""))}"></label>
            <div class="fl"><span>Forma de assinar</span>${sigModeSeg("sgMode", S.sgMode || "desenho")}</div>
            <div id="sgPadWrap"${S.sgMode === "dados" ? " hidden" : ""}><div id="cfgPad"></div><div class="row-acts" style="margin-top:8px"><button type="button" class="link-btn" id="sgClear">Limpar</button></div></div>
            <p class="muted small" id="sgHint" style="margin:0"${S.sgMode === "dados" ? "" : " hidden"}>${DATA_HINT}</p>
            <div class="row-acts"><button type="button" class="pill pill-cream pill-sm" id="sgSave" style="margin-left:auto">Salvar assinatura</button></div>`}
          </div>
        </div>
      </div>
      <div class="savebar"><div class="inner"><span class="sb-sum">Os dados entram nas propostas na hora e nos contratos gerados a partir de agora.</span><button type="button" class="pill pill-green pill-lg" id="bizSave">Salvar dados da empresa</button></div></div>`);
    bindEmpresa();
  }

  /* ---------- página da proposta (modelo, aparência e textos) ---------- */
  const LAYOUT_INFO = {
    neutro: ["Neutro", "O visual padrão do sistema. Serve para qualquer negócio: verde escuro, verde-limão e cantos arredondados."],
    saude: ["Saúde", "Clínicas, consultórios e bem-estar. Tons suaves e cantos arredondados."],
    construcao: ["Construção", "Obras, reformas e engenharia. Contraste forte e cantos retos."],
    tecnologia: ["Tecnologia", "Software, TI e serviços digitais. Moderno, com degradê no topo."],
  };
  const SECTION_LABEL = [["boas-vindas", "Boas-vindas"], ["principios", "Número em destaque e Como trabalhamos"], ["etapas", "Etapas"], ["galeria", "Galeria de trabalhos"], ["agradecimento", "Agradecimento"]];
  const CORNER_PX = { reto: ["3px", "0px", "0px", "0px"], suave: ["10px", "14px", "18px", "10px"], redondo: ["14px", "24px", "32px", "14px"] };
  const galleryHTML = (pf) => pf.length ? `<ul class="pf-list">${pf.map((x, i) => `<li data-pf="${esc(x.id)}"><img src="/api/public/portfolio/${encodeURIComponent(x.id)}${R.imgQ(x.v)}" alt=""><input class="inp" data-pf-name value="${esc(x.name || "")}" placeholder="Legenda (opcional)"><div class="row-acts"><button type="button" class="link-btn" data-pf-up="${i}"${i ? "" : " disabled"}>↑</button><button type="button" class="link-btn" data-pf-del="${esc(x.id)}">Remover</button></div></li>`).join("")}</ul>` : `<div class="empty"><span>Nenhuma imagem ainda.</span></div>`;
  const exampleUrl = () => `/p/exemplo?e=${encodeURIComponent(S.data.company.id)}&k=${encodeURIComponent(S.data.exampleKey || "")}`;
  function pagina() {
    const st = S.data.settings, b = st.brand || {}, LY = S.data.layouts || {}, pf = b.portfolio || [];
    if (!S.pg) S.pg = { layout: b.layout || "neutro", colors: { ...DEF_COLORS, ...(b.colors || {}) }, fontTitle: b.fontTitle || "alexandria", fontText: b.fontText || "alexandria", style: { caps: false, corners: "redondo", hero: "marca", hide: [], ...(b.style || {}) } };
    const G = S.pg, C = G.colors, fonts = S.data.fonts || [];
    const fontSel = (id, cur) => `<select class="sel" id="${id}">${fonts.map(([k, l]) => `<option value="${k}"${k === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const tpl = (k) => { const L = LY[k] || { colors: DEF_COLORS }, c = L.colors; return `<button type="button" class="tpl${G.layout === k ? " on" : ""}" data-tpl="${k}" aria-pressed="${G.layout === k}">
        <span class="tpl-mock" style="background:${c.dark};color:${c.light}"><i style="background:${c.primary}"></i><b style="color:${c.light}">Proposta</b><em style="color:${c.accent}">para você</em><span style="background:${c.light}"></span><u style="background:${c.primary};border-radius:${CORNER_PX[(L.style || {}).corners || "redondo"][0]}"></u></span>
        <b>${LAYOUT_INFO[k][0]}</b><small>${LAYOUT_INFO[k][1]}</small></button>`; };
    const seg = (name, opts, cur) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}"${cur === v ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
    shell("page", `
      <div class="pgh"><div><span class="label">O que o cliente vê</span><h1>Página da proposta</h1><p class="sub">Escolha um modelo, ajuste cores, fontes e detalhes se quiser, e escreva os seus textos. A prévia ao lado mostra como o cliente vai ver.</p></div><a class="pill pill-line" href="${exampleUrl()}" target="_blank" rel="noopener" id="pgOpen">Abrir prévia em nova aba</a></div>
      <div class="cols page-cols">
        <div class="stack">
          <div class="card"><h2>1. Modelo</h2>
            <div class="tpl-grid">${Object.keys(LAYOUT_INFO).map(tpl).join("")}</div>
            <p class="muted small" style="margin:0">Trocar de modelo muda cores, fontes, ajustes e os textos de exemplo. Os textos que você escreveu continuam.</p>
          </div>
          <div class="card"><div class="ch"><h2>2. Cores e fontes</h2><button type="button" class="pill pill-line pill-sm" id="colReset">Cores do modelo</button></div>
            ${Object.keys(DEF_COLORS).map((k) => `<label class="color-row"><input type="color" data-col="${k}" value="${esc(C[k])}"><span><b>${COLOR_LABEL[k][0]}</b><small>${COLOR_LABEL[k][1]}</small></span><input class="inp mono" data-colhex="${k}" value="${esc(C[k])}" maxlength="7" spellcheck="false"></label>`).join("")}
            <div class="grid2"><label class="fl"><span>Fonte dos títulos</span>${fontSel("fTitle", G.fontTitle)}</label><label class="fl"><span>Fonte dos textos</span>${fontSel("fText", G.fontText)}</label></div>
            <p class="muted small" style="margin:0">Fontes do Google são carregadas pelo navegador do cliente. O PDF do contrato usa sempre a fonte Alexandria.</p>
          </div>
          <div class="card"><h2>3. Ajustes finos</h2>
            <div class="grid2"><div class="fl"><span>Cantos</span>${seg("pgCorners", [["reto", "Retos"], ["suave", "Suaves"], ["redondo", "Redondos"]], G.style.corners)}</div>
            <div class="fl"><span>Fundo do topo</span>${seg("pgHero", [["escuro", "Cor de fundo"], ["marca", "Degradê da marca"]], G.style.hero)}</div></div>
            <div class="fl"><span>Tema da página do cliente</span>${seg("pgTheme", [["escuro", "Escuro"], ["claro", "Claro"]], G.style.theme || "escuro")}<small>Vale para a proposta e o contrato que o cliente abre.</small></div>
            <label class="check"><input type="checkbox" id="pgCaps"${G.style.caps ? " checked" : ""}><span>Títulos em letras maiúsculas</span></label>
            <div class="fl"><span>Partes que aparecem na proposta</span><div class="sec-list">${SECTION_LABEL.map(([k, l]) => `<label class="check"><input type="checkbox" data-sec="${k}"${G.style.hide.includes(k) ? "" : " checked"}><span>${l}</span></label>`).join("")}</div><small>Serviços, valores e o formulário do pedido sempre aparecem.</small></div>
          </div>
          <div class="card"><div class="ch"><h2>4. Galeria de trabalhos</h2><label class="pill pill-cream pill-sm">Adicionar imagens<input type="file" accept="image/png,image/jpeg,image/webp" id="pfAdd" multiple hidden></label></div>
            <p class="muted small" style="margin:0">Aparece nas propostas quando tiver pelo menos uma imagem (e a parte “Galeria de trabalhos” estiver marcada acima). As fotos são reduzidas para 1600 px antes de enviar. A galeria salva na hora; as legendas, ao salvar a página.</p>
            <div id="pfBox">${galleryHTML(pf)}</div>
          </div>
          <div class="card"><h2>5. Textos</h2>
            <p class="muted small" style="margin:0">Campo em branco usa o texto de exemplo do modelo (que já tem versão em espanhol e inglês); o que você escrever aparece igual em todos os idiomas. Para destacar uma palavra, coloque entre asteriscos: *assim*.</p>
            ${txGroup("Topo da página", tx("hero_label") + tx("hero_blur") + tx("hero_sharp"), true)}
            ${txGroup("Boas-vindas", tx("welcome") + `<label class="fl"><span>Texto de apresentação</span><textarea class="ta" id="cIntro" rows="4">${esc(st.intro)}</textarea></label>
            <label class="fl"><span>Quem somos</span><textarea class="ta" id="bAbout" rows="4">${esc(b.about || "")}</textarea></label>` + tx("team") + `
            <div class="grid2"><label class="fl"><span>Número em destaque</span><input class="inp" id="bStatV" maxlength="12" value="${esc(b.statValue || "")}" placeholder="Ex.: +10"></label><label class="fl"><span>Legenda do número</span><input class="inp" id="bStatL" maxlength="60" value="${esc(b.statLabel || "")}" placeholder="Ex.: anos de experiência"></label></div>
            <label class="fl"><span>Como trabalhamos</span><textarea class="ta" id="bPrin" rows="4">${esc((b.principles || []).join("\n"))}</textarea><small>Uma frase por linha, até 6. Em branco, o bloco não aparece.</small></label>`)}
            ${txGroup("Serviços", tx("pick_label") + tx("pick_h") + tx("note_fixed"))}
            ${txGroup("Etapas", tx("steps_label") + tx("steps_h") + tx("steps_p") + tx("after_order") + `<label class="fl"><span>Próximos passos</span><textarea class="ta" id="cNext" rows="5">${esc(stepsToText(st.nextSteps))}</textarea><small>Um passo por linha, no formato Título: explicação.</small></label>`)}
            ${txGroup("Galeria de trabalhos", tx("pf_label") + tx("pf_h") + tx("pf_p"))}
            ${txGroup("Agradecimento", tx("thanks"))}
            ${txGroup("Pedido", tx("your_order") + tx("h_review") + tx("lead_review") + tx("fine") + tx("accept") + tx("send"))}
            ${txGroup("Depois do pedido", tx("thanks_p") + tx("signed_p"))}
            ${txGroup("Rodapé", `<label class="fl"><span>Slogan</span><input class="inp" id="bTag" maxlength="160" value="${esc(b.tagline || "")}" placeholder="Ex.: Fotografia de casamento em todo o Brasil"><small>Rodapé das páginas, dos e-mails e do PDF.</small></label>`)}
          </div>
        </div>
        <div class="stack page-prev">
          <div class="card"><div class="ch"><h2>Prévia</h2><button type="button" class="pill pill-line pill-sm" id="pgReload">Atualizar</button></div>
            <div class="prev-frame"><iframe id="pgFrame" title="Prévia da página da proposta" src="${exampleUrl()}" loading="lazy"></iframe></div>
            <p class="muted small" style="margin:0">Cores, cantos, fundo e partes mudam na hora. Textos e fontes aparecem na prévia depois de salvar.</p>
          </div>
        </div>
      </div>
      <div class="savebar"><div class="inner"><span class="sb-sum">Vale para todas as propostas, inclusive as que já foram enviadas.</span><button type="button" class="pill pill-green pill-lg" id="pageSave">Salvar página da proposta</button></div></div>`);
    bindPagina();
  }

  // CSS dos ajustes finos: o mesmo que /api/public/brand.css gera (netlify/lib/brand.mjs, styleCss)
  // contraste automático (o mesmo de netlify/lib/brand.mjs, contrastVars)
  function contrastVars(c) {
    const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const dark = lum(c.dark) < 0.2 ? c.dark : "#111111", on = (x) => (lum(x) > 0.4 ? dark : "#ffffff"), ink = (x) => (lum(x) > 0.4 ? `color-mix(in srgb,${x} 42%,${dark})` : x);
    return `--on-primary:${on(c.primary)};--on-accent:${on(c.accent)};--accent-ink:${ink(c.accent)};--primary-ink:${ink(c.primary)};`;
  }
  function pageStyleCss(G) {
    const c = CORNER_PX[G.style.corners] || CORNER_PX.redondo, st = G.style;
    const hide = { "boas-vindas": '#boas-vindas,a[href="#boas-vindas"]', principios: ".about-side", etapas: '#etapas,a[href="#etapas"]', galeria: ".brands", agradecimento: ".statement" };
    let css = `:root{--c-dark:${G.colors.dark};--c-light:${G.colors.light};--primary:${G.colors.primary};--accent:${G.colors.accent};${contrastVars(G.colors)}--tt:${st.caps ? "uppercase" : "none"};--r-pill:${c[0]};--r-card:${c[1]};--r-sec:${c[2]};--sec-gap:${c[3]};--hero-bg:${st.hero === "marca" ? "linear-gradient(135deg,var(--primary-deep),var(--night) 75%)" : "var(--night)"}}\n`;
    const h = st.hide.map((k) => hide[k]).filter(Boolean);
    if (h.length) css += `${h.join(",")}{display:none!important}\n`;
    return css;
  }
  function livePreview() {
    const f = $("#pgFrame"); let d; try { d = f && f.contentDocument; } catch (e) { return; }
    if (!d || !d.head) return;
    let el = d.getElementById("live-style"); if (!el) { el = d.createElement("style"); el.id = "live-style"; d.head.appendChild(el); }
    el.textContent = pageStyleCss(S.pg);
    if (S.pg.style.theme === "claro") d.documentElement.dataset.theme = "claro"; else delete d.documentElement.dataset.theme;
  }

  function bindPagina() {
    const G = S.pg, LY = S.data.layouts || {};
    const syncColors = () => Object.entries(G.colors).forEach(([k, v]) => { const c = $(`[data-col="${k}"]`), h = $(`[data-colhex="${k}"]`); if (c && c.value !== v) c.value = v; if (h && h.value !== v) h.value = v; });
    const setCol = (k, v) => { G.colors[k] = v; syncColors(); livePreview(); };
    $$("[data-col]").forEach((i) => i.addEventListener("input", () => setCol(i.dataset.col, i.value.toLowerCase())));
    $$("[data-colhex]").forEach((i) => i.addEventListener("input", () => { const v = i.value.trim().toLowerCase(); if (/^#[0-9a-f]{6}$/.test(v)) setCol(i.dataset.colhex, v); }));
    $("#colReset").addEventListener("click", () => { G.colors = { ...((LY[G.layout] || {}).colors || DEF_COLORS) }; syncColors(); livePreview(); });
    $("#fTitle").addEventListener("change", (e) => (G.fontTitle = e.target.value));
    $("#fText").addEventListener("change", (e) => (G.fontText = e.target.value));
    $$('[name="pgCorners"]').forEach((r) => r.addEventListener("change", () => { G.style.corners = r.value; livePreview(); }));
    $$('[name="pgHero"]').forEach((r) => r.addEventListener("change", () => { G.style.hero = r.value; livePreview(); }));
    $$('[name="pgTheme"]').forEach((r) => r.addEventListener("change", () => { G.style.theme = r.value; livePreview(); }));
    $("#pgCaps").addEventListener("change", (e) => { G.style.caps = e.target.checked; livePreview(); });
    $$("[data-sec]").forEach((c) => c.addEventListener("change", () => { G.style.hide = $$("[data-sec]").filter((x) => !x.checked).map((x) => x.dataset.sec); livePreview(); }));
    // modelo: troca cores, fontes e ajustes (mantém as partes escolhidas e os textos escritos)
    $$("[data-tpl]").forEach((btn) => btn.addEventListener("click", () => {
      const k = btn.dataset.tpl, L = LY[k]; if (!L) return;
      G.layout = k; G.colors = { ...L.colors }; G.fontTitle = L.fontTitle; G.fontText = L.fontText; G.style = { ...G.style, ...L.style };
      $$("[data-tpl]").forEach((b) => { const on = b.dataset.tpl === k; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      syncColors(); $("#fTitle").value = G.fontTitle; $("#fText").value = G.fontText;
      $$('[name="pgCorners"]').forEach((r) => (r.checked = r.value === G.style.corners));
      $$('[name="pgHero"]').forEach((r) => (r.checked = r.value === G.style.hero));
      $("#pgCaps").checked = G.style.caps;
      $$("[data-tx]").forEach((i) => (i.placeholder = txDefault(i.dataset.tx)));
      livePreview();
      R.toast(`Modelo ${LAYOUT_INFO[k][0]} aplicado. Ajuste o que quiser e salve.`);
    }));
    // galeria de trabalhos: salva na hora e redesenha só o quadro da galeria (os textos ainda não salvos continuam na tela)
    const pfList = () => $$("[data-pf]").map((li) => ({ id: li.dataset.pf, name: li.querySelector("[data-pf-name]").value.trim() }));
    const rerender = () => { const names = Object.fromEntries(pfList().map((x) => [x.id, x.name])); $("#pfBox").innerHTML = galleryHTML((S.data.settings.brand.portfolio || []).map((x) => (x.id in names ? { ...x, name: names[x.id] } : x))); bindGallery(); refreshFrame(); };
    const refreshFrame = () => { const f = $("#pgFrame"); if (f) f.src = exampleUrl() + "&t=" + Date.now(); };
    $("#pfAdd").addEventListener("change", async (e) => {
      const files = [...(e.target.files || [])]; if (!files.length) return;
      R.toast(`Enviando ${files.length} ${files.length > 1 ? "imagens" : "imagem"}…`);
      for (const f of files) {
        try { await post("brand-image", { slot: "portfolio", name: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), image: await shrinkImage(f, { max: 1600, type: "image/jpeg", quality: 0.84 }) }); }
        catch (err) { R.toast(`${f.name}: ${err.message}`); }
      }
      e.target.value = "";
      await reload(); rerender(); R.toast("Galeria atualizada.");
    });
    const bindGallery = () => {
      $$("[data-pf-up]").forEach((b) => b.addEventListener("click", async () => {
        const L = pfList(), i = Number(b.dataset.pfUp); [L[i - 1], L[i]] = [L[i], L[i - 1]];
        try { await put("brand-image", { portfolio: L }); await reload(); rerender(); } catch (err) { R.toast(err.message); }
      }));
      $$("[data-pf-del]").forEach((b) => b.addEventListener("click", async () => {
        if (!armed(b, "Remover?")) return;
        try { await api("brand-image/" + encodeURIComponent(b.dataset.pfDel), { method: "DELETE" }); await reload(); rerender(); } catch (err) { R.toast(err.message); }
      }));
    };
    bindGallery();
    const fr = $("#pgFrame");
    fr.addEventListener("load", () => { livePreview(); setTimeout(livePreview, 400); });
    $("#pgReload").addEventListener("click", () => { fr.src = exampleUrl() + "&t=" + Date.now(); });
    $("#pageSave").addEventListener("click", async (e) => {
      const brand = {
        layout: G.layout, colors: G.colors, fontTitle: G.fontTitle, fontText: G.fontText, style: G.style,
        tagline: $("#bTag").value.trim(), about: $("#bAbout").value.trim(), statValue: $("#bStatV").value.trim(), statLabel: $("#bStatL").value.trim(),
        principles: $("#bPrin").value.split("\n").map((x) => x.trim()).filter(Boolean),
      };
      busy(e.currentTarget, true, "Salvando…");
      try {
        await put("settings", { brand, intro: $("#cIntro").value.trim(), nextSteps: textToSteps($("#cNext").value), pageTexts: Object.fromEntries($$("[data-tx]").map((i) => [i.dataset.tx, i.value.trim()])) });
        if ($$("[data-pf]").length) await put("brand-image", { portfolio: pfList() });
        await reload(); S.pg = null; refreshBrandCss(); pagina(); R.toast("Página da proposta salva.");
      } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  // aplica cores e fontes no painel aberto (prévia) e recarrega o CSS da marca depois de salvar
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
    // assinatura padrão
    if ($("#cfgPad")) {
      S.padCfg = R.SignPad($("#cfgPad"));
      $("#sgClear").addEventListener("click", () => S.padCfg.clear());
      const d = $("#sgDoc"); d.addEventListener("input", () => (d.value = R.maskDoc(d.value)));
      $$('[name="sgMode"]').forEach((r) => r.addEventListener("change", () => { S.sgMode = r.value; $("#sgPadWrap").hidden = r.value === "dados"; $("#sgHint").hidden = r.value !== "dados"; if (r.value === "desenho") window.dispatchEvent(new Event("resize")); }));
      $("#sgSave").addEventListener("click", async () => {
        const name = $("#sgName").value.trim(), doc = R.digits($("#sgDoc").value), method = S.sgMode === "dados" ? "dados" : "desenho";
        if (name.length < 5 || !name.includes(" ") || !R.validDoc(doc)) { R.toast("Informe nome completo e CPF ou CNPJ válido."); return; }
        if (method === "desenho" && S.padCfg.isEmpty()) { R.toast("Desenhe a assinatura ou escolha assinar só com nome e CPF/CNPJ."); return; }
        try { await put("settings", { agencySignature: { name, doc, method, image: method === "desenho" ? S.padCfg.toPNG() : undefined } }); await reload(); S.cfgSigNew = false; rerender(); R.toast("Assinatura salva."); } catch (err) { R.toast(err.message); }
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
      busy(e.currentTarget, true, "Salvando…");
      try {
        await put("settings", { agency, whatsapp: $("#cWa").value, instagram: $("#cIg").value, site: $("#cSite").value.trim() });
        await reload(); refreshBrandCss(); empresa(); R.toast("Dados da empresa salvos.");
      } catch (err) { R.toast(err.message); busy(e.currentTarget, false); }
    });
  }

  function config() {
    const st = S.data.settings, a = st.agency;
    if (!S.ctr) S.ctr = { own: !!st.contractText, text: st.contractText || S.data.defaultTemplate };
    const own = S.ctr.own;
    const fld = (k, l, ph = "", hint = "") => `<label class="fl"><span>${l}</span><input class="inp" data-ag="${k}" value="${esc(/cnpj|Doc/.test(k) ? R.maskDoc(a[k] || "") : a[k] || "")}" placeholder="${esc(ph)}"${/cnpj|Doc/.test(k) ? ' inputmode="numeric"' : ""}>${hint ? `<small>${hint}</small>` : ""}</label>`;
    shell("cfg", `
      <div class="pgh"><div><span class="label">Ajustes</span><h1>Configurações</h1><p class="sub">Modelo de contrato, consultores, validade das propostas, link aberto e modelo de teste.</p></div></div>
      <div class="cols">
        <div class="stack">
          <div class="card"><h2>Dados da empresa</h2>
            <p class="muted small" style="margin:0">Nome, CNPJ ou CPF, endereço, contato, logo e assinatura padrão ficam em Dados da empresa. Cores, fontes, galeria e textos ficam em Página da proposta.</p>
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
        $("#demoOut").innerHTML = `<div class="okbox" style="display:grid;gap:8px"><span>Modelo criado. Acesso do consultor fictício (Entrar, no campo WhatsApp use este e-mail de teste): <b>${esc(r.seller.email)}</b> · senha <code class="pw">${esc(r.seller.password)}</code></span>
          <ul class="lines">${r.proposals.map((p) => `<li><a href="#/proposta/${p.id}">${esc(p.name)}</a><a class="small" href="/p/${p.id}" target="_blank" rel="noopener">abrir como cliente</a></li>`).join("")}</ul></div>`;
        R.toast("Modelo de teste criado na pasta “Modelo de teste”.");
      } catch (err) { R.toast(err.message); }
      busy(e.currentTarget, false);
    });
    $("#demoDel").addEventListener("click", async (e) => {
      if (!armed(e.currentTarget, "Remover tudo do modelo?")) return;
      try { await post("demo", { remove: true }); await reload(); $("#demoOut").innerHTML = ""; R.toast("Modelo de teste removido."); } catch (err) { R.toast(err.message); }
    });
    $("#cfgSave").addEventListener("click", async (e) => {
      const body = { validityDays: $("#cVal").value, openLink: $("#cOpen").checked, sellersUseAgencySignature: $("#cSellers").checked };
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
