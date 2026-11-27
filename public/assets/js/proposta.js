/* Página da proposta: landing interativa em que o cliente monta e envia o pedido */
(function () {
  "use strict";
  const { $, $$, esc } = R;
  const t = (k, v) => R.t(k, v);
  const money = (n) => R.money(n);
  const app = $("#app");
  const id = location.pathname.split("/").filter(Boolean)[1] || "";
  const qs = new URLSearchParams(location.search);
  // "exemplo": prévia da aparência aberta pelo painel (Página da proposta), sem enviar nada
  const preview = qs.get("preview") === "1" || id === "exemplo";
  const pkey = qs.get("k") || "";

  let P = null;
  const choice = {}, picked = new Set(), openInc = new Set();
  let editing = false, declining = false, sending = false;
  let draft = {};
  const br = () => !P.country || P.country === "BR";
  // proposta fechada: a empresa já escolheu os serviços; o cliente escolhe só a forma de pagamento.
  // Link aberto e propostas antigas com mais de uma opção no mesmo grupo continuam com escolha de serviços.
  const fixed = () => !P.open && !P.services.some((s, i) => s.group && P.services.findIndex((x) => x.group === s.group) !== i);

  const svc = (sid) => P.services.find((s) => s.id === sid);
  const optOf = (s) => s.payment.find((o) => o.id === choice[s.id]) || s.payment[0];
  const maxTotal = (s) => Math.max(...s.payment.map((o) => o.total));
  const hasContract = () => !!P.contract;
  const readOnly = () => hasContract() || (!!P.order && !editing) || (P.status === "recusada" && !editing) || (P.expired && !P.order);
  const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const contactPhone = () => (P.seller && P.seller.phone) || P.agency.whatsapp;

  init();

  async function init() {
    R.setLocale("pt", "BRL");
    app.innerHTML = R.loadingHTML(t("loading_prop"));
    try {
      P = await R.api(`public/proposal/${encodeURIComponent(id)}${id === "exemplo" ? `?e=${encodeURIComponent(R.E)}&k=${encodeURIComponent(pkey)}` : preview ? `?preview=1&k=${encodeURIComponent(pkey)}` : id === "aberta" ? `?e=${encodeURIComponent(R.E)}` : ""}`);
    } catch (e) {
      if (e.status === 410 && e.data) {
        R.setLocale(e.data.lang || "pt", "BRL");
        R.setBrand({ name: e.data.name || "", whatsapp: e.data.whatsapp || "" });
        document.title = t("off_h") + (e.data.name ? " · " + e.data.name : "");
        app.innerHTML = R.stateHTML(t("off_h"), esc(e.message), `<a class="pill pill-green pill-lg" href="${R.wa(e.data.whatsapp || "", t("wa_off", { a: R.esc(e.data.name || "") }))}" target="_blank" rel="noopener">${t("off_talk")}</a>`);
        return;
      }
      try { R.setBrand(await R.api("public/brand" + R.ref())); } catch (e2) {}
      const nf = e.status === 404;
      app.innerHTML = R.stateHTML(nf ? t("prop_nf") : t("cant_open"), nf ? t("prop_nf_p") : esc(e.message), `<a class="pill pill-green pill-lg" href="${R.wa("", t("wa_cant_prop"))}" target="_blank" rel="noopener">${t("talk_wa")}</a>`);
      return;
    }
    R.setLocale(P.lang, P.currency);
    R.setBrand(P.agency);
    // o número da proposta é só para controle interno da empresa: o cliente não vê
    document.title = `${t("hero_label")}${!P.open && (P.client.company || P.client.name) ? " · " + (P.client.company || P.client.name) : ""} · ${P.agency.name}`;
    initSelection();
    renderAll();
  }

  function initSelection() {
    P.services.forEach((s) => (choice[s.id] = s.payment[0] && s.payment[0].id));
    if (fixed()) {
      picked.clear();
      P.services.forEach((s) => picked.add(s.id));
      const prev = (P.order && P.order.items) || R.store.get("sel." + id, null) || [];
      if (Array.isArray(prev)) prev.forEach((it) => { const s0 = svc(it.serviceId); if (s0 && s0.payment.some((o) => o.id === it.optionId)) choice[s0.id] = it.optionId; });
    }
    const groups = new Set();
    const add = (sid, oid) => {
      const s = svc(sid); if (!s) return;
      if (s.group) { if (groups.has(s.group)) return; groups.add(s.group); }
      picked.add(sid);
      if (oid && s.payment.some((o) => o.id === oid)) choice[sid] = oid;
    };
    if (fixed()) { /* serviços já definidos pela empresa, acima */ }
    else if ((picked.clear(), P.order)) P.order.items.forEach((it) => add(it.serviceId, it.optionId));
    else {
      const saved = R.store.get("sel." + id, null);
      if (saved && Array.isArray(saved)) saved.forEach((it) => add(it.serviceId, it.optionId));
      else {
        P.services.filter((s) => s.recommended).forEach((s) => add(s.id));
        if (!picked.size && P.services.length === 1) add(P.services[0].id);
      }
    }
    const c = (P.order && P.order.client) || {};
    draft = {
      name: c.name || P.client.company || P.client.name || "", doc: c.doc ? (br() ? R.maskDoc(c.doc) : c.doc) : "", representative: c.representative || P.client.contact || "",
      email: c.email || "", phone: c.phone || "", cep: c.cep ? (br() ? String(c.cep).replace(/(\d{5})(\d{3})/, "$1-$2") : c.cep) : "", street: c.street || "", number: c.number || "", complement: c.complement || "", district: c.district || "",
      city: c.city || "", address: "", notes: (P.order && P.order.notes) || "", accept: false,
    };
    if (!br() && c.address) draft.address = c.cep && String(c.address).endsWith(", " + c.cep) ? String(c.address).slice(0, -(c.cep.length + 2)) : c.address;
  }

  function totals() {
    const tt = { once: 0, onceFull: 0, monthly: 0, upfront: 0, minMonths: 0, lines: [] };
    P.services.forEach((s) => {
      if (!picked.has(s.id)) return;
      const o = optOf(s);
      if (s.kind === "mensal") { tt.monthly += o.total; tt.minMonths = Math.max(tt.minMonths, s.minMonths || 0); }
      else { tt.once += o.total; tt.onceFull += maxTotal(s); }
      tt.upfront += o.upfront;
      tt.lines.push({ s, o });
    });
    tt.savings = Math.max(0, tt.onceFull - tt.once);
    return tt;
  }

  /* ---------------- página ---------------- */
  function renderAll() {
    const ag = P.agency;
    const who = P.client.company || P.client.name;
    // galeria de trabalhos e "como trabalhamos" vêm de Dados da empresa; sem itens, a seção não aparece
    const gallery = Array.isArray(ag.portfolio) ? ag.portfolio : [];
    const principles = Array.isArray(ag.principles) ? ag.principles.map(esc) : t("principles");
    const anchorSvc = P.services.find((s) => s.anchor && s.anchor.rows && s.anchor.rows.length);
    app.innerHTML = `
    ${R.headerHTML([["#boas-vindas", t("nav_prop")], ["#servicos", t("nav_svc")], ["#etapas", t("nav_steps")]], ["#pedido", t("nav_order")])}
    <main>
      <section class="hero hero-flat wrap" id="inicio">
        <div class="inner hero-copy">
          <div class="hero-mark">
            <span class="label">${t("hero_label")}</span>
            <h1 class="focus-title"><span class="blur">${t("hero_blur")}</span> <span class="sharp">${t("hero_sharp")}</span></h1>
          </div>
          <p class="hero-sub">${who ? `<b>${t("prepared", { w: esc(who) })}</b> ` : `<b>${esc(ag.name)}.</b> `}${P.open ? t("open_sub") : esc(P.title || "")}</p>
          <div class="hero-meta" id="heroMeta"></div>
${P.open ? `          <div class="hero-ctas"><a class="pill pill-green pill-lg" href="#servicos" id="heroCta">${t("cta_build")}</a></div>
` : ""}        </div>
        <div class="hero-foot wrap label"><div class="inner"><span>${esc(ag.tagline || "")}</span><span>${esc(ag.city || "")}</span></div></div>
      </section>

      <section class="about wrap" id="boas-vindas">
        <div class="grain"></div>
        <div class="inner">
          <h2>${t("welcome")}</h2>
          <div class="about-text">
            <p>${esc(ag.intro)}</p>
            <p>${ag.about ? esc(ag.about) : t("who")}</p>
            <p>${t("team")}</p>
          </div>
          <div class="about-side">
            ${ag.statValue ? `<div class="stat"><b>${esc(ag.statValue)}</b><span>${esc(ag.statLabel || "")}</span></div>` : ""}
            ${principles.length ? `<ol class="principles" aria-label="${t("principles_aria")}">${principles.map((x, i) => `<li><small>${String(i + 1).padStart(2, "0")}</small>${x}</li>`).join("")}</ol>` : ""}
          </div>
        </div>
      </section>

      <section class="pick wrap on-light" id="servicos">
        <div class="inner">
          <div class="pick-head">
            <div><span class="label" style="color:var(--accent)">${t("pick_label")}</span><h2 class="h-sec">${t("pick_h")}</h2></div>
            <p id="pickNote"></p>
          </div>
          ${groupsHTML()}
        </div>
      </section>

      ${anchorSvc ? anchorHTML(anchorSvc) : ""}

      <section class="journey wrap" id="etapas">
        <div class="inner">
          <div class="journey-head">
            <div><span class="label" style="color:var(--accent-soft)">${t("steps_label")}</span><h2 class="h-sec">${t("steps_h")}</h2></div>
            <p>${t("steps_p")}</p>
          </div>
          <div id="journeyBody"></div>
        </div>
      </section>

      ${gallery.length ? `<section class="brands wrap on-light" aria-labelledby="pf">
        <div class="inner">
          <div class="brands-head"><div><span class="label" style="color:var(--accent)">${t("pf_label")}</span><h2 class="h-sec" id="pf" style="margin-top:16px">${t("pf_h")}</h2></div><p>${t("pf_p")}</p></div>
          <ul class="logo-grid">${gallery.map((g) => `<li><figure><img src="/api/public/portfolio/${encodeURIComponent(g.id)}${R.imgQ(g.v)}" alt="${esc(g.name || "")}" loading="lazy" decoding="async" width="400" height="300">${g.name ? `<figcaption>${esc(g.name)}</figcaption>` : ""}</figure></li>`).join("")}</ul>
        </div>
      </section>` : ""}

      <section class="statement wrap" aria-label="${t("thanks_aria")}">
        <div class="inner"><p>${t("thanks")}</p></div>
      </section>

      <section class="order wrap" id="pedido">
        <div class="grain"></div>
        <div class="inner" id="orderInner"></div>
      </section>
    </main>
    ${R.footerHTML({ ...ag, whatsapp: contactPhone() })}
    <div class="dock wrap" id="dock" aria-hidden="true"><div class="inner" id="dockInner"></div></div>`;

    R.initHeader();
    const anc = $(".anc-compare");
    if (anc) { if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { anc.classList.add("in"); io.disconnect(); } }), { threshold: 0.4 }); io.observe(anc); } else anc.classList.add("in"); }
    bindPick();
    refresh(true);
    observeDock();
    if (window.matchMedia("(hover: none)").matches && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("on", e.isIntersecting)), { rootMargin: "-42% 0px -42% 0px" });
      $$(".logo-grid li").forEach((li) => io.observe(li));
    }
    R.reveal([[".hero-mark .label", "up", 0, 0.05], [".hero-sub", "up", 0, 0.8], [".hero-meta", "up", 0, 0.95], [".hero-ctas", "up", 0, 1.05], [".about h2", "up"], [".about-text", "left", 0, 0.1], [".stat", "right", 0, 0.15], [".principles li", "right", 0.08, 0.25], [".pick-head > *", "up", 0.1], [".svc-card", "up", 0.06], [".anc > div", "up", 0.12], [".journey-head > *", "up", 0.1], [".brands-head > *", "up", 0.1], [".logo-grid li", "zoom", 0.04], [".statement p", "left"]]);
    if (location.hash && location.hash.length > 1) { const tg = $(location.hash); if (tg) setTimeout(() => tg.scrollIntoView(), 60); }
  }

  function groupsHTML() {
    if (fixed()) return `<div class="pick-group"><div class="group-head"><span class="label">${P.services.length > 1 ? t("fixed_label_n") : t("fixed_label_1")}</span><small>${P.services.length > 1 ? t("fixed_hint") : t("fixed_hint_1")}</small></div><div class="svc-list">${P.services.map((s) => cardHTML(s, false)).join("")}</div></div>`;
    const blocks = [], byKey = {};
    P.services.forEach((s) => {
      const key = s.group ? "g:" + s.group : "rest";
      if (!byKey[key]) { byKey[key] = { key, group: s.group, list: [] }; blocks.push(byKey[key]); }
      byKey[key].list.push(s);
    });
    const hasGroups = blocks.some((b) => b.group && b.list.length > 1);
    return blocks.map((b) => {
      const multi = b.group && b.list.length > 1;
      const gName = R.t("g_" + b.group);
      const title = b.group ? (gName !== "g_" + b.group ? gName : b.group.replace(/-/g, " ")) : hasGroups ? t("add_also") : P.services.length > 1 ? t("services") : t("service");
      const hint = multi ? t("choose_one") : b.group ? "" : P.services.length > 1 ? t("add_many") : "";
      return `<div class="pick-group"><div class="group-head"><span class="label">${esc(title)}</span>${hint ? `<small>${hint}</small>` : ""}</div><div class="svc-list">${b.list.map((s) => cardHTML(s, multi)).join("")}</div></div>`;
    }).join("");
  }

  function cardHTML(s, inGroup) {
    const mx = maxTotal(s);
    const per = s.kind === "mensal" ? `<small>${t("per_month")}</small>` : "";
    const facts = [];
    if (s.deadline) facts.push(t("deadline", { d: esc(s.deadline) }));
    if (s.kind === "mensal" && s.minMonths) facts.push(t("min_contract", { m: s.minMonths }));
    if (s.notes) facts.push(esc(s.notes));
    return `<article class="svc-card" data-id="${esc(s.id)}" data-group="${esc(inGroup ? s.group : "")}">
      <div class="info">
        <div class="meta"><span class="label">${esc(s.category || t("service"))} · ${s.kind === "mensal" ? t("monthly") : t("once")}</span>${s.recommended && !fixed() ? `<span class="badge">${t("recommended")}</span>` : ""}</div>
        <h3>${esc(s.name)}</h3>
        ${s.tagline ? `<p class="tagline">${esc(s.tagline)}</p>` : ""}
        ${s.description ? String(s.description).split(/\n\s*\n/).map((x) => `<p class="desc">${esc(x.trim())}</p>`).join("") : ""}
        ${facts.length ? `<div class="facts">${facts.map((f) => `<span>${f}</span>`).join("")}</div>` : ""}
        ${s.includes && s.includes.length ? `<button type="button" class="inc-btn" aria-expanded="${openInc.has(s.id)}" aria-controls="inc-${esc(s.id)}">${t("included")}<i aria-hidden="true"></i></button>
        <div class="inc" id="inc-${esc(s.id)}"${openInc.has(s.id) ? "" : " hidden"}>${s.includes.map((g) => `<div>${g.title ? `<h4>${esc(g.title)}</h4>` : ""}<ul>${g.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>` : ""}
      </div>
      <div class="price-col">
        <span class="label">${t("investment")}</span>
        <div class="price"><span class="pv">${money(optOf(s).total)}</span>${per}</div>
        <p class="price-sub"></p>
        <fieldset class="opts"><legend class="label">${t("pay_method")}</legend>
          ${s.payment.map((o) => `<label class="opt"><input type="radio" name="opt-${esc(s.id)}" value="${esc(o.id)}"${o.id === choice[s.id] ? " checked" : ""}><span class="dot" aria-hidden="true"></span><b>${esc(o.label)}${s.kind !== "mensal" && o.total < mx ? `<span class="save">${t("save", { v: money(mx - o.total), p: Math.round((1 - o.total / mx) * 100) })}</span>` : ""}</b><span class="v">${money(o.total)}${s.kind === "mensal" ? t("per_month") : ""}</span><span class="s">${esc(R.fillSchedule(o))}</span></label>`).join("")}
        </fieldset>
        <button type="button" class="pill pill-lg pill-line toggle" aria-pressed="false"><span class="ck" aria-hidden="true">✓</span><span class="tl"></span></button>
      </div>
    </article>`;
  }

  function anchorHTML(s) {
    const rows = s.anchor.rows.filter((r) => Number(r[1]) > 0);
    const total = rows.reduce((a, r) => a + (Number(r[1]) || 0), 0);
    const price = Math.min(...s.payment.map((o) => o.total));
    const save = Math.max(0, total - price), pct = total ? Math.round((save / total) * 100) : 0;
    const share = total ? Math.max(6, Math.round((price / total) * 1000) / 10) : 100;
    const pm = `<small>${t("per_month")}</small>`;
    return `<section class="anchor wrap" id="comparativo"><div class="grain"></div><div class="inner anc">
      <div class="anc-head"><span class="label" style="color:var(--accent-soft)">${esc(s.name)}</span><h2 class="h-sec">${t("anchor_h")}</h2><p class="body">${t("anchor_p2")}</p></div>
      <div class="anc-compare">
        <div class="anc-row them"><div class="anc-meta"><span><b>${t("anchor_them")}</b>${t("anchor_them_s", { n: rows.length })}</span><strong>${money(total)}${pm}</strong></div><div class="anc-bar"><i style="--w:100%"></i></div></div>
        <div class="anc-row you"><div class="anc-meta"><span><b>${t("anchor_us")}</b>${t("anchor_us_s")}</span><strong>${money(price)}${pm}</strong></div><div class="anc-bar"><i style="--w:${share}%"></i></div></div>
        ${save ? `<div class="anc-save"><span>${t("anchor_save")}</span><strong>${t("anchor_save_v", { v: money(save) })}</strong><em>${t("anchor_save_s", { p: pct, y: money(save * 12) })}</em></div>` : ""}
      </div>
      <div class="anc-team"><h3>${t("anchor_team_h")}</h3><ul>${rows.map((r) => `<li><span>${esc(r[0])}</span><b>${money(r[1])}${pm}</b></li>`).join("")}</ul><p class="fine">${t("anchor_fine")}</p></div>
    </div></section>`;
  }

  /* ---------------- estado ---------------- */
  function refresh(first) {
    updateCards(); updatePickNote(); updateHeroMeta(); renderJourney(); renderOrder(); renderDock();
    if (!first && !P.order) R.store.set("sel." + id, [...picked].map((sid) => ({ serviceId: sid, optionId: choice[sid] })));
  }

  function updateCards() {
    const ro = readOnly();
    $$(".svc-card").forEach((card) => {
      const s = svc(card.dataset.id); if (!s) return;
      const on = picked.has(s.id), o = optOf(s);
      card.classList.toggle("on", on);
      $(".pv", card).textContent = money(o.total);
      $(".price-sub", card).textContent = R.fillSchedule(o);
      $$("input[type=radio]", card).forEach((r) => { r.checked = r.value === o.id; r.disabled = ro; });
      const tg = $(".toggle", card);
      tg.hidden = ro || fixed();
      tg.setAttribute("aria-pressed", on);
      $(".tl", tg).textContent = on ? (card.dataset.group ? t("b_chosen") : t("b_in")) : card.dataset.group ? t("b_choose") : t("b_add");
      $(".opts", card).hidden = ro && !on;
      card.style.opacity = ro && !on ? ".55" : "";
    });
  }

  function updatePickNote() {
    let txt = fixed() ? t("note_fixed") : t("note_default");
    if (hasContract()) txt = t("note_contract");
    else if (P.order && !editing) txt = t("note_order");
    else if (P.status === "recusada" && !editing) txt = t("note_declined");
    else if (P.expired && !P.order) txt = t("note_expired", { d: R.dateLong(P.validUntil) });
    $("#pickNote").textContent = txt;
  }

  function updateHeroMeta() {
    const c = [];
    if (P.validUntil && !P.open) c.push(`<span class="chip${P.expired ? " warn" : ""}">${t(P.expired ? "expired_on" : "valid_until", { d: R.dateLong(P.validUntil) })}</span>`);
    if (P.contract && P.contract.status === "assinado") c.push(`<span class="chip ok">${t("chip_signed")}</span>`);
    else if (P.contract) c.push(`<span class="chip warn">${t("chip_wait")}</span>`);
    else if (P.order) c.push(`<span class="chip ok">${t("chip_order")}</span>`);
    if (P.seller) c.push(`<span class="chip">${t("chip_consultant", { n: esc(P.seller.name) })}</span>`);
    if (preview) c.push(`<span class="chip">${t("chip_preview")}</span>`);
    $("#heroMeta").innerHTML = c.join("");
    const cta = $("#heroCta"); if (cta) cta.textContent = P.order ? t("cta_view") : t("cta_build");
  }

  function renderJourney() {
    const list = P.services.filter((s) => s.steps && s.steps.length && (picked.size ? picked.has(s.id) : true));
    const step = (st, i) => `<li><small>0${i + 1}</small><b>${esc(st.title)}</b><p>${esc(st.text)}</p></li>`;
    const blocks = list.map((s) => `<div class="journey-block"><h3>${esc(s.name)}</h3><ol class="steps">${s.steps.map(step).join("")}</ol></div>`);
    const ns = P.agency.nextSteps || [];
    if (ns.length) blocks.push(`<div class="journey-block"><h3>${t("after_order")}</h3><ol class="steps">${ns.map(step).join("")}</ol></div>`);
    $("#journeyBody").innerHTML = `<div style="display:grid;gap:clamp(32px,4vw,52px)">${blocks.join("")}</div>`;
  }

  function summaryHTML() {
    const tt = totals();
    const onceCount = tt.lines.filter((l) => l.s.kind !== "mensal").length;
    const rows = tt.lines.map(({ s, o }) => `<li><b>${esc(s.name)}</b><span class="v">${money(o.total)}${s.kind === "mensal" ? t("per_month") : ""}</span><small>${esc(o.label)} · ${esc(R.fillSchedule(o))}${s.kind === "mensal" && s.minMonths ? ` · ${t("min_of", { m: s.minMonths })}` : ""}</small></li>`).join("");
    const tot = [];
    if (tt.once) tot.push(`<div><span>${onceCount > 1 ? t("once_n") : t("once_1")}</span><b>${money(tt.once)}</b></div>`);
    if (tt.monthly) tot.push(`<div><span>${t("monthly_t")}${tt.minMonths ? `<small>${t("min_months", { m: tt.minMonths })}</small>` : ""}</span><b>${money(tt.monthly)}<small style="display:inline;font-size:13px">${t("per_month")}</small></b></div>`);
    if (tt.savings) tot.push(`<div class="sv"><span>${t("savings")}</span><b>${money(tt.savings)}</b></div>`);
    if (tt.lines.length && Math.abs(tt.upfront - (tt.once + tt.monthly)) > 0.009) tot.push(`<div class="hl"><span>${t("to_start")}<small style="color:color-mix(in srgb,var(--cream) 80%,transparent)">${t("to_start_s")}</small></span><b>${money(tt.upfront)}</b></div>`);
    if (tot.length && !tot.some((x) => x.includes('class="hl"'))) tot[0] = tot[0].replace("<div>", '<div class="hl">');
    return `<ul class="sum">${rows || `<li><span class="empty">${t("sum_empty")}</span></li>`}</ul>${tot.length ? `<div class="totals">${tot.join("")}</div>` : ""}`;
  }

  function trackHTML() {
    const c = P.contract;
    const st = [[t("tr1"), P.order ? "done" : "now"], [t("tr2"), c ? "done" : P.order ? "now" : ""], [t("tr3"), c && c.status === "assinado" ? "done" : c ? "now" : ""], [t("tr4"), c && c.status === "assinado" ? "now" : ""]];
    return `<ol class="track" aria-label="${t("tr_aria")}">${st.map(([x, k]) => `<li class="${k}"><b>${x}</b>${k === "done" ? t("tr_done") : k === "now" ? t("tr_now") : t("tr_next")}</li>`).join("")}</ol>`;
  }

  const doneBox = (h, p, acts) => `<div class="done-box"><h3>${h}</h3><p>${p}</p><div class="acts">${acts}</div></div>`;

  function renderOrder() {
    const el = $("#orderInner");
    const received = P.order && !editing;
    const left = `<div>
      <span class="label eyebrow">${t("your_order")}</span>
      <h2>${received ? t("h_received") : t("h_review")}</h2>
      <p class="lead">${received ? t("lead_received") : t("lead_review")}</p>
      ${summaryHTML()}
      ${received ? trackHTML() : `<p class="fine">${P.validUntil && !P.open ? t("fine_valid", { d: R.dateLong(P.validUntil) }) : ""}${t("fine")}</p>`}
    </div>`;
    const c = P.contract, wa = contactPhone();
    let right;
    if (c && c.status === "assinado") right = doneBox(t("signed_h"), t("signed_p"), `<a class="pill pill-green pill-lg" href="/c/${esc(c.id)}">${t("see_contract")}</a>`);
    else if (c) right = doneBox(t("ready_h"), t("ready_p"), `<a class="pill pill-green pill-lg" href="/c/${esc(c.id)}">${t("read_sign")}</a>`);
    else if (received) {
      const nm = firstName(P.order.client.representative || P.order.client.name);
      right = doneBox(t("thanks_h", { n: nm ? ", " + esc(nm) : "" }), t("thanks_p", { d: R.dateTime(P.order.submittedAt) }), `<a class="pill pill-green pill-lg" href="${R.wa(wa, t("wa_ordered"))}" target="_blank" rel="noopener">${t("notify_wa")}</a><button type="button" class="pill pill-line pill-lg" data-act="edit">${t("edit_order")}</button>`);
    } else if (P.status === "recusada" && !editing) right = doneBox(t("declined_h"), t("declined_p"), `<button type="button" class="pill pill-green pill-lg" data-act="edit">${t("review_again")}</button><a class="pill pill-line pill-lg" href="${R.wa(wa, t("wa_talk"))}" target="_blank" rel="noopener">${t("talk_wa")}</a>`);
    else if (P.expired && !P.order) right = doneBox(t("expired_h"), t("expired_p", { d: R.dateLong(P.validUntil) }), `<a class="pill pill-green pill-lg" href="${R.wa(wa, t("wa_expired"))}" target="_blank" rel="noopener">${t("ask_update")}</a>`);
    else right = formHTML();
    el.innerHTML = left + right;
    bindOrder();
  }

  function formHTML() {
    const d = draft;
    const f = (name, label, attrs = "", cls = "", hint = "") => `<div class="field${cls ? " " + cls : ""}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(d[name])}" ${attrs}>${hint ? `<span class="hint" id="h-${name}">${hint}</span>` : ""}<span class="err" id="e-${name}" aria-live="polite"></span></div>`;
    const country = t("countries")[P.country] || "";
    const addr = br()
      ? `${f("cep", t("f_cep"), 'inputmode="numeric" autocomplete="postal-code" maxlength="9"', "", t("cep_hint"))}
         <div class="field spacer" aria-hidden="true"></div>
         ${f("street", t("f_street"), 'autocomplete="address-line1"', "full")}
         ${f("number", t("f_number"), 'autocomplete="off"')}
         ${f("complement", t("f_compl"), 'autocomplete="address-line2"')}
         ${f("district", t("f_district"), 'autocomplete="off"')}
         <div class="field combo-field"><label for="f-city">${t("f_city")}</label><div class="combo"><input id="f-city" name="city" value="${esc(d.city)}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="cityList"><ul class="combo-list" id="cityList" role="listbox" hidden></ul></div><span class="hint">${t("city_hint")}</span><span class="err" id="e-city" aria-live="polite"></span></div>`
      : `${f("address", t("f_address_x"), 'autocomplete="street-address"', "full")}
         ${f("city", t("f_city_x"), 'autocomplete="address-level2"')}
         ${f("cep", t("f_postal_x"), 'autocomplete="postal-code"')}`;
    return `<form class="form" id="orderForm" novalidate>
      <p class="form-note">${br() ? t("form_note") : t("form_note_x", { c: esc(country) })}</p>
      ${f("name", t("f_name"), 'autocomplete="organization" required', "full")}
      ${f("doc", br() ? t("f_doc") : t("f_doc_x"), br() ? 'inputmode="numeric" autocomplete="off"' : 'autocomplete="off"')}
      ${f("representative", t("f_rep"), 'autocomplete="name"')}
      ${f("email", t("f_email"), 'type="email" autocomplete="email"')}
      ${f("phone", br() ? t("f_phone") : t("f_phone_x"), 'inputmode="tel" autocomplete="tel"')}
      ${addr}
      <div class="field full"><label for="f-notes">${t("f_notes")}</label><textarea id="f-notes" name="notes" rows="3" placeholder="${esc(t("notes_ph"))}">${esc(d.notes)}</textarea><span class="err"></span></div>
      <label class="check"><input type="checkbox" name="accept"${d.accept ? " checked" : ""}><span>${t("accept")}</span></label>
      <p class="form-msg" id="formMsg" role="alert"></p>
      <div class="form-actions">
        <button type="submit" class="pill pill-green pill-lg" id="sendBtn">${P.order ? t("update") : t("send")}</button>
        ${editing && P.order ? `<button type="button" class="link-btn" data-act="cancel-edit">${t("cancel_edit")}</button>` : P.open ? "" : `<button type="button" class="link-btn" data-act="decline">${t("decline")}</button>`}
      </div>
      <div class="field full" id="declineBox"${declining ? "" : " hidden"}>
        <label for="f-reason">${t("decline_l")}</label>
        <textarea id="f-reason" rows="3"></textarea>
        <div class="form-actions" style="margin-top:12px"><button type="button" class="pill pill-line" data-act="decline-send">${t("decline_send")}</button></div>
      </div>
    </form>`;
  }

  /* ---------------- cidades e CEP (Brasil) ---------------- */
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  let CITY_INDEX = null;
  function cityIndex() {
    if (CITY_INDEX) return CITY_INDEX;
    CITY_INDEX = [];
    const C = window.CIDADES || {};
    for (const uf of Object.keys(C)) for (const n of C[uf]) CITY_INDEX.push({ label: `${n} - ${uf}`, key: norm(n), full: norm(`${n} ${uf}`) });
    return CITY_INDEX;
  }
  const isKnownCity = (v) => { const k = norm(v).replace(/\s*-\s*/, " "); return cityIndex().some((c) => c.full === k); };
  function bindCity() {
    const inp = $("#f-city"), list = $("#cityList");
    if (!inp || !list) return;
    let items = [], active = -1;
    const close = () => { list.hidden = true; inp.setAttribute("aria-expanded", "false"); active = -1; };
    const choose = (label) => { inp.value = label; draft.city = label; close(); $("#e-city").textContent = ""; inp.removeAttribute("aria-invalid"); };
    const paint = () => {
      list.innerHTML = items.length ? items.map((c, i) => `<li role="option" id="city-${i}" aria-selected="${i === active}" class="${i === active ? "on" : ""}" data-v="${esc(c.label)}">${esc(c.label)}</li>`).join("") : `<li class="none">${t("city_none")}</li>`;
      if (active >= 0) inp.setAttribute("aria-activedescendant", "city-" + active); else inp.removeAttribute("aria-activedescendant");
    };
    const search = () => {
      const q = norm(inp.value).replace(/\s*-\s*/, " ");
      if (q.length < 2) { close(); return; }
      const starts = [], has = [];
      for (const c of cityIndex()) { if (c.key.startsWith(q) || c.full.startsWith(q)) starts.push(c); else if (has.length < 8 && c.key.includes(q)) has.push(c); }
      starts.sort((a, b) => a.key.length - b.key.length);
      items = starts.concat(has).slice(0, 8);
      active = items.length ? 0 : -1;
      list.hidden = false; inp.setAttribute("aria-expanded", "true");
      paint();
    };
    inp.addEventListener("input", search);
    inp.addEventListener("focus", () => { if (inp.value.length >= 2 && !isKnownCity(inp.value)) search(); });
    inp.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
      else if (e.key === "Enter") { if (active >= 0 && items[active]) { e.preventDefault(); choose(items[active].label); } }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-v]"); if (li) { e.preventDefault(); choose(li.dataset.v); } });
    inp.addEventListener("blur", () => setTimeout(close, 120));
  }
  let lastCep = "";
  async function lookupCep(v) {
    const d = R.digits(v);
    if (d.length !== 8 || d === lastCep) return;
    lastCep = d;
    const hint = $("#h-cep");
    hint.textContent = t("cep_loading");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (j.erro) throw new Error("nf");
      const set = (k, val) => { if (!val) return; draft[k] = val; const el = $("#f-" + k); if (el) { el.value = val; el.removeAttribute("aria-invalid"); const er = $("#e-" + k); if (er) er.textContent = ""; } };
      set("street", j.logradouro); set("district", j.bairro); set("city", j.localidade && j.uf ? `${j.localidade} - ${j.uf}` : "");
      if (j.complemento && !draft.complement) set("complement", j.complemento);
      hint.textContent = t("cep_ok");
      const next = !draft.street ? $("#f-street") : $("#f-number");
      if (next) next.focus();
    } catch (e) { hint.textContent = t("cep_nf"); }
  }

  /* ---------------- dock ---------------- */
  let heroIn = true, orderIn = false;
  function renderDock() {
    const tt = totals(), dock = $("#dock");
    const show = picked.size > 0 && !readOnly() && !heroIn && !orderIn;
    dock.classList.toggle("show", show);
    dock.setAttribute("aria-hidden", !show);
    const figs = [];
    if (tt.once) figs.push(`<div class="fig"><span>${t("d_once")}</span><b>${money(tt.once)}</b></div>`);
    if (tt.monthly) figs.push(`<div class="fig"><span>${t("d_monthly")}</span><b>${money(tt.monthly)}</b></div>`);
    if (tt.once && tt.monthly) figs.push(`<div class="fig opt-fig"><span>${t("d_start")}</span><b>${money(tt.upfront)}</b></div>`);
    $("#dockInner").innerHTML = `<span class="count"><i>${picked.size}</i><span>${picked.size > 1 ? t("d_services") : t("d_service")}</span></span>${figs.join("")}<span class="sp"></span><a class="pill pill-green pill-lg" href="#pedido" tabindex="${show ? 0 : -1}">${t("d_review")}</a>`;
  }
  function observeDock() {
    if (!("IntersectionObserver" in window)) { heroIn = false; renderDock(); return; }
    new IntersectionObserver((e) => { heroIn = e[0].isIntersecting; renderDock(); }, { rootMargin: "-30% 0px 0px 0px" }).observe($("#inicio"));
    new IntersectionObserver((e) => { orderIn = e[0].isIntersecting; renderDock(); }, { rootMargin: "0px 0px -35% 0px" }).observe($("#pedido"));
  }

  /* ---------------- eventos ---------------- */
  function pick(sid, on) {
    const s = svc(sid);
    if (on) { if (s.group) P.services.forEach((x) => { if (x.group === s.group && x.id !== sid) picked.delete(x.id); }); picked.add(sid); }
    else picked.delete(sid);
  }

  function bindPick() {
    const root = $("#servicos");
    root.addEventListener("click", (e) => {
      const inc = e.target.closest(".inc-btn");
      if (inc) {
        const card = inc.closest(".svc-card"), sid = card.dataset.id, open = inc.getAttribute("aria-expanded") !== "true";
        inc.setAttribute("aria-expanded", open); $(".inc", card).hidden = !open;
        open ? openInc.add(sid) : openInc.delete(sid);
        return;
      }
      const tg = e.target.closest(".toggle");
      if (tg && !readOnly()) {
        const sid = tg.closest(".svc-card").dataset.id, was = picked.has(sid);
        pick(sid, !was); refresh();
        if (!was) R.toast(t("t_added", { s: svc(sid).name }));
      }
    });
    root.addEventListener("change", (e) => {
      const r = e.target.closest("input[type=radio]");
      if (!r || readOnly()) return;
      const sid = r.closest(".svc-card").dataset.id;
      choice[sid] = r.value;
      if (!picked.has(sid)) pick(sid, true);
      refresh();
    });
  }

  function bindOrder() {
    $("#orderInner").querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act)));
    const form = $("#orderForm");
    if (!form) return;
    form.addEventListener("input", (e) => {
      const x = e.target;
      if (x.name === "doc" && br()) x.value = R.maskDoc(x.value);
      if (x.name === "phone" && br()) x.value = R.maskPhone(x.value);
      if (x.name === "cep" && br()) { x.value = R.digits(x.value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"); if (R.digits(x.value).length === 8) lookupCep(x.value); else lastCep = ""; }
      if (x.name in draft) draft[x.name] = x.type === "checkbox" ? x.checked : x.value;
      if (x.id === "f-" + x.name) { const er = $("#e-" + x.name); if (er) er.textContent = ""; x.removeAttribute("aria-invalid"); }
    });
    form.addEventListener("change", (e) => { if (e.target.name === "accept") draft.accept = e.target.checked; });
    form.addEventListener("submit", submitOrder);
    bindCity();
  }

  async function act(a) {
    if (a === "edit") { editing = true; declining = false; refresh(); $("#servicos").scrollIntoView(); R.toast(t("t_edit")); return; }
    if (a === "cancel-edit") { editing = false; initSelection(); refresh(); return; }
    if (a === "decline") { declining = !declining; $("#declineBox").hidden = !declining; if (declining) $("#f-reason").focus(); return; }
    if (a === "decline-send") {
      if (preview) { R.toast(t("t_prev_decline")); return; }
      try { P = await R.api(`public/proposal/${encodeURIComponent(id)}/decline`, { method: "POST", body: JSON.stringify({ reason: $("#f-reason").value }) }); declining = false; editing = false; refresh(); }
      catch (e) { R.toast(e.message); }
    }
  }

  function validate() {
    const e = {}, d = draft;
    if (d.name.trim().length < 3) e.name = t("e_name");
    if (br()) {
      if (!R.validDoc(d.doc)) e.doc = t("e_doc");
      if (R.digits(d.doc).length === 14 && d.representative.trim().length < 3) e.representative = t("e_rep");
    } else if (d.doc.trim().length < 4) e.doc = t("e_doc_x");
    if (!R.validEmail(d.email)) e.email = t("e_email");
    if (R.digits(d.phone).length < (br() ? 10 : 7)) e.phone = br() ? t("e_phone") : t("e_phone_x");
    if (br()) {
      if (R.digits(d.cep).length !== 8) e.cep = t("e_cep");
      if (d.street.trim().length < 3) e.street = t("e_street");
      if (!d.number.trim()) e.number = t("e_number");
      if (d.district.trim().length < 2) e.district = t("e_district");
      if (d.city.trim().length < 2) e.city = t("e_city"); else if (!isKnownCity(d.city)) e.city = t("e_city_list");
    } else {
      if (d.address.trim().length < 5) e.address = t("e_address");
      if (d.city.trim().length < 2) e.city = t("e_city");
    }
    return e;
  }

  async function submitOrder(ev) {
    ev.preventDefault();
    if (sending) return;
    const msg = $("#formMsg");
    msg.textContent = "";
    $$("#orderForm .err").forEach((x) => (x.textContent = ""));
    $$("#orderForm [aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    if (!picked.size) { msg.textContent = t("m_pick"); return; }
    const errs = validate(), keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach((k) => { const er = $("#e-" + k); if (er) er.textContent = errs[k]; const inp = $("#f-" + k); if (inp) inp.setAttribute("aria-invalid", "true"); });
      const f = $("#f-" + keys[0]); if (f) f.focus();
      return;
    }
    if (!draft.accept) { msg.textContent = t("m_accept"); return; }
    if (preview) { R.toast(t("t_prev_order")); return; }
    sending = true;
    const btn = $("#sendBtn"); btn.classList.add("is-busy"); btn.textContent = t("sending");
    const d = draft;
    const client = br()
      ? { name: d.name, doc: R.digits(d.doc), representative: d.representative, email: d.email, phone: d.phone, cep: R.digits(d.cep), street: d.street, number: d.number, complement: d.complement, district: d.district, city: d.city }
      : { name: d.name, doc: d.doc, representative: d.representative, email: d.email, phone: d.phone, cep: d.cep, address: [d.address, d.cep].filter((x) => x && x.trim()).join(", "), city: d.city, country: t("countries")[P.country] || "" };
    const body = { items: [...picked].map((sid) => ({ serviceId: sid, optionId: choice[sid] })), client, notes: d.notes, accept: true };
    try {
      if (P.open) {
        const r = await R.api(`public/proposal/aberta/order?e=${encodeURIComponent(R.E)}`, { method: "POST", body: JSON.stringify(body) });
        location.href = `/p/${r.id}#pedido`;
        return;
      }
      P = await R.api(`public/proposal/${encodeURIComponent(id)}/order`, { method: "POST", body: JSON.stringify(body) });
      editing = false;
      R.store.set("sel." + id, null);
      refresh();
      $("#pedido").scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      msg.textContent = err.message;
      btn.classList.remove("is-busy"); btn.textContent = P.order ? t("update") : t("send");
    } finally { sending = false; }
  }
})();
