/* Página do contrato: leitura, assinatura eletrônica desenhada e cópia em PDF */
(function () {
  "use strict";
  const { $, esc } = R;
  const t = (k, v) => R.t(k, v);
  const app = $("#app");
  const id = location.pathname.split("/").filter(Boolean)[1] || "";
  let C = null, pad = null, sending = false, emailed = false, mode = "desenho";
  const br = () => !C.country || C.country === "BR";

  init();

  async function init() {
    R.setLocale("pt", "BRL");
    app.innerHTML = R.loadingHTML(t("loading_c"));
    try { C = await R.api(`public/contract/${encodeURIComponent(id)}`); }
    catch (e) {
      try { R.setBrand(await R.api("public/brand" + R.ref())); } catch (e2) {}
      const nf = e.status === 404;
      app.innerHTML = R.stateHTML(nf ? t("c_nf") : t("cant_open"), nf ? t("c_nf_p") : esc(e.message), `<a class="pill pill-green pill-lg" href="${R.wa("", t("wa_cant_c"))}" target="_blank" rel="noopener">${t("talk_wa")}</a>`);
      return;
    }
    R.setLocale(C.lang, C.currency);
    R.setBrand(C.agency);
    document.title = `${t("c_label", { n: C.number })} · ${C.agency.name}`;
    if (C.status === "cancelado") {
      app.innerHTML = R.stateHTML(t("c_cancel_h"), t("c_cancel_p"), `<a class="pill pill-green pill-lg" href="${R.wa(contactPhone(), t("wa_c_cancel", { n: C.number }))}" target="_blank" rel="noopener">${t("talk_wa")}</a>`);
      return;
    }
    render();
  }

  const signed = () => C.status === "assinado";
  const contactPhone = () => (C.seller && C.seller.phone) || C.agency.whatsapp;
  const pdfUrl = (dl) => `/api/public/contract/${encodeURIComponent(id)}/pdf${dl ? "?download=1" : ""}`;
  const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

  function docHTML(text) {
    let first = true;
    return String(text || "").split(/\n{2,}/).map((block) => {
      const hl = (s) => esc(s).replace(/⟦([a-z_]+)⟧/g, '<span class="var">$1</span>');
      if (block.startsWith("## ")) {
        const [h, ...rest] = block.split("\n");
        const tag = first ? "h1" : "h4"; first = false;
        return `<${tag}>${esc(h.slice(3))}</${tag}>` + (rest.length ? `<p>${hl(rest.join("\n"))}</p>` : "");
      }
      first = false;
      return `<p>${hl(block)}</p>`;
    }).join("");
  }

  const sigHTML = (role, s, fallback, mine) => `<div><span class="label">${role}</span>
    <div class="img">${s && s.image ? `<img src="${s.image}" alt="${esc(t("sig_of", { n: s.name }))}">` : s && s.at ? `<span class="typed"><small>${t("typed_by")}</small>${esc(s.name)}</span>` : `<em>${mine ? t("w_yours") : t("w_sig")}</em>`}</div>
    <b>${esc((s && s.name) || fallback || "")}</b>${s && s.doc ? `<small>${esc(s.doc)}</small>` : ""}${s && s.at ? `<small>${esc(t("signed_at", { d: R.dateTime(s.at) }))}</small>` : ""}</div>`;

  function sigsHTML() {
    const S = C.signatures, inter = S.intermediary || C.seller;
    let h = sigHTML(t("r_agency"), S.agency, C.agencyName) + sigHTML(t("r_client"), S.client, C.client.name, true);
    if (inter) h += sigHTML(t("r_inter"), S.intermediary, C.seller && C.seller.name);
    return { h, cls: inter ? "sigs three" : "sigs" };
  }

  function render() {
    const ag = C.agency;
    const who = C.client.representative || C.client.name;
    const sg = sigsHTML();
    app.innerHTML = `
    ${R.headerHTML([["#contrato", t("nav_contract")]], signed() ? [pdfUrl(true), t("nav_copy")] : ["#assinar", t("nav_sign")])}
    <main>
      <section class="hero hero-flat wrap" id="inicio" style="padding-block:clamp(140px,16vw,200px) clamp(110px,12vw,150px)">
        <div class="inner hero-copy">
          <div class="hero-mark">
            <span class="label">${t("c_label", { n: esc(C.number) })}</span>
            <h1 class="focus-title" id="heroTitle">${titleHTML()}</h1>
          </div>
          <p class="hero-sub" id="heroSub">${t(signed() ? "c_sub_ok" : "c_sub_wait", { n: esc(firstName(who)) })}</p>
          <div class="hero-meta" id="heroMeta">${chipsHTML()}</div>
          <div class="hero-ctas" id="heroCtas">${ctasHTML()}</div>
        </div>
        <div class="hero-foot wrap label"><div class="inner"><span>${esc(C.client.name || "")}</span><span>${t("c_foot_r")}</span></div></div>
      </section>

      <section class="doc-sec wrap" id="contrato">
        <article class="paper">
          <div class="ph">${R.logoHTML("claro", true)}<span>${t("c_label", { n: esc(C.number) })}</span></div>
          ${docHTML(C.text)}
          <div class="${sg.cls}" id="sigs">${sg.h}</div>
        </article>
        <div class="verify"><span>${t("verify")} <code>${esc(C.hash || "")}</code></span><a href="${pdfUrl(false)}" target="_blank" rel="noopener">${t("view_pdf")}</a></div>
      </section>

      <section class="sign wrap" id="assinar"><div class="grain"></div><div class="inner" id="signInner"></div></section>
    </main>
    ${R.footerHTML({ ...ag, whatsapp: contactPhone() })}`;
    R.initHeader();
    renderSign();
    R.reveal([[".hero-mark .label", "up", 0, 0.05], [".hero-sub", "up", 0, 0.7], [".hero-meta", "up", 0, 0.85], [".hero-ctas", "up", 0, 0.95]]);
  }

  const titleHTML = () => signed() ? `<span class="blur">${t("c_blur_ok")}</span> <span class="sharp">${t("c_sharp_ok")}</span>` : `<span class="blur">${t("c_blur_wait")}</span> <span class="sharp">${t("c_sharp_wait")}</span>`;

  function chipsHTML() {
    const c = [];
    c.push(signed() ? `<span class="chip ok">${t("c_chip_ok")}</span>` : `<span class="chip warn">${t("c_chip_wait")}</span>`);
    if (C.sentAt) c.push(`<span class="chip">${t("c_chip_sent", { d: esc(R.dateShort(C.sentAt)) })}</span>`);
    if (C.seller) c.push(`<span class="chip">${t("chip_consultant", { n: esc(C.seller.name) })}</span>`);
    return c.join("");
  }
  function ctasHTML() {
    return signed()
      ? `<a class="pill pill-green pill-lg" href="${pdfUrl(true)}">${t("c_dl")}</a><a class="pill pill-line pill-lg" href="#contrato">${t("c_read")}</a>`
      : `<a class="pill pill-green pill-lg" href="#contrato">${t("c_read")}</a><a class="pill pill-line pill-lg" href="#assinar">${t("c_go")}</a>`;
  }

  function renderSign() {
    const el = $("#signInner");
    const ag = C.agency, wa = contactPhone();
    if (signed()) {
      el.innerHTML = `<div><span class="label eyebrow">${t("ok_eyebrow")}</span><h2>${t("ok_h")}</h2>
        <p class="lead">${emailed ? t("ok_mailed", { e: esc(C.client.email || "") }) : ""}${t("ok_lead")}</p></div>
        <div class="done-box"><h3>${t("next_h")}</h3>
          <p>${(ag.nextSteps || []).slice(2).map((s) => esc(s.text)).join(" ") || t("next_default")}</p>
          <div class="acts"><a class="pill pill-green pill-lg" href="${pdfUrl(true)}">${t("c_dl")}</a><a class="pill pill-line pill-lg" href="${R.wa(wa, t("wa_signed", { n: C.number }))}" target="_blank" rel="noopener">${t("talk_wa")}</a></div>
        </div>`;
      return;
    }
    const docDefault = br() ? (R.digits(C.client.doc).length === 11 ? C.client.doc : "") : "";
    el.innerHTML = `<div><span class="label eyebrow">${t("s_eyebrow")}</span><h2>${t("s_h")}</h2>
        <p class="lead">${t("s_lead")}</p>
        <p class="fine" style="max-width:44ch;margin-top:22px">${t("s_legal")}</p></div>
      <form class="form" id="signForm" novalidate>
        <div class="field full"><label for="s-name">${t("f_signer")}</label><input id="s-name" name="name" autocomplete="name" value="${esc(C.client.representative || C.client.name || "")}"><span class="err" id="e-name"></span></div>
        <div class="field full"><label for="s-doc">${br() ? t("f_sdoc") : t("f_sdoc_x")}</label><input id="s-doc" name="doc"${br() ? ' inputmode="numeric"' : ""} value="${esc(docDefault)}"><span class="hint">${br() ? t("sdoc_hint") : t("sdoc_hint_x")}</span><span class="err" id="e-doc"></span></div>
        <div class="pad-wrap"><div class="bar"><span>${t("how_sign")}</span></div>
          <div class="sig-mode" role="radiogroup"><label><input type="radio" name="smode" value="desenho"${mode === "desenho" ? " checked" : ""}><span>${t("m_draw")}</span></label><label><input type="radio" name="smode" value="dados"${mode === "dados" ? " checked" : ""}><span>${br() ? t("m_data") : t("m_data_x")}</span></label></div>
          <div id="padBox"${mode === "dados" ? " hidden" : ""}><div class="bar"><span>${t("your_sig")}</span><button type="button" class="link-btn" id="padClear">${t("clear")}</button></div><div id="pad"></div></div>
          <p class="fine" id="dataHint"${mode === "dados" ? "" : " hidden"}>${t("data_hint")}</p>
          <span class="err" id="e-pad" style="font-size:12px;color:var(--accent-soft);min-height:1.2em"></span></div>
        <label class="check"><input type="checkbox" name="accept"><span>${t("s_accept")}</span></label>
        <p class="form-msg" id="signMsg" role="alert"></p>
        <div class="form-actions"><button type="submit" class="pill pill-green pill-lg" id="signBtn">${t("sign")}</button><a class="link-btn" href="${R.wa(wa, t("wa_c_doubt", { n: C.number }))}" target="_blank" rel="noopener">${t("s_doubt")}</a></div>
      </form>`;
    pad = R.SignPad($("#pad"), () => ($("#e-pad").textContent = ""), t("pad_ph"));
    $("#padClear").addEventListener("click", () => pad.clear());
    const f = $("#signForm");
    f.querySelectorAll('[name="smode"]').forEach((r) => r.addEventListener("change", () => {
      mode = r.value === "dados" ? "dados" : "desenho";
      $("#padBox").hidden = mode === "dados"; $("#dataHint").hidden = mode !== "dados"; $("#e-pad").textContent = "";
      if (mode === "desenho") window.dispatchEvent(new Event("resize"));
    }));
    f.addEventListener("input", (e) => {
      if (e.target.name === "doc" && br()) e.target.value = R.maskDoc(e.target.value);
      const er = $("#e-" + e.target.name); if (er) er.textContent = "";
    });
    f.addEventListener("submit", submit);
  }

  async function submit(e) {
    e.preventDefault();
    if (sending) return;
    const f = $("#signForm"), msg = $("#signMsg");
    msg.textContent = "";
    const name = f.name.value.trim(), doc = f.doc.value.trim();
    let bad = null;
    const err = (k, x) => { $("#e-" + k).textContent = x; bad = bad || k; };
    if (name.length < 5 || !name.includes(" ")) err("name", t("e_full"));
    if (br() ? !R.validDoc(doc) : doc.length < 4) err("doc", br() ? t("e_doc") : t("e_doc_x"));
    if (mode === "desenho" && pad.isEmpty()) err("pad", t("e_pad"));
    if (bad) { const el = bad === "pad" ? $("#pad") : f[bad]; el.scrollIntoView({ block: "center" }); if (el.focus) el.focus(); return; }
    if (!f.accept.checked) { msg.textContent = t("m_accept_c"); return; }
    sending = true;
    const btn = $("#signBtn"); btn.classList.add("is-busy"); btn.textContent = t("signing");
    try {
      const r = await R.api(`public/contract/${encodeURIComponent(id)}/sign`, { method: "POST", body: JSON.stringify({ name, doc: br() ? R.digits(doc) : doc, method: mode, image: mode === "desenho" ? pad.toPNG() : undefined, accept: true, hash: C.hash }) });
      C = r;
      const sg = sigsHTML(), box = $("#sigs"); box.className = sg.cls; box.innerHTML = sg.h;
      $("#heroTitle").innerHTML = titleHTML();
      $("#heroSub").innerHTML = t("c_sub_ok", { n: esc(firstName(name)) });
      $("#heroMeta").innerHTML = chipsHTML();
      $("#heroCtas").innerHTML = ctasHTML();
      const nav = $("#menu .pill-green"); if (nav) { nav.href = pdfUrl(true); nav.textContent = t("nav_copy"); }
      renderSign();
      $("#assinar").scrollIntoView({ behavior: "smooth" });
      R.toast(t("t_signed"));
    } catch (err2) {
      msg.textContent = err2.message;
      btn.classList.remove("is-busy"); btn.textContent = t("sign");
    } finally { sending = false; }
  }
})();
