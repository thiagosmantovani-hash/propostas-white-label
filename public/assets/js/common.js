/* Utilidades compartilhadas pelas páginas do cliente (proposta e contrato) */
(function () {
  "use strict";
  const R = (window.R = {});
  try { if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("anim"); } catch (e) {}

  R.$ = (s, r = document) => r.querySelector(s);
  R.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  R.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  R.brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  R.dateLong = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}`; };
  R.dateTime = (ts) => ts ? new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  R.digits = (v) => String(v ?? "").replace(/\D/g, "");
  R.wa = (num, text) => `https://wa.me/${R.digits(num) || (R.B && R.digits(R.B.whatsapp)) || ""}${text ? "?text=" + encodeURIComponent(text) : ""}`;

  // Marca da empresa (Dados da empresa), recebida da API junto com a proposta ou o contrato
  R.B = { name: "", logos: {} };
  // empresa da página: vem com a marca (R.B.e); no link aberto, também pelo ?e= do endereço
  R.E = new URLSearchParams(location.search).get("e") || "";
  R.ref = () => "?ref=" + encodeURIComponent(location.pathname + location.search);
  R.imgQ = (v) => `?e=${encodeURIComponent(R.B.e || R.E)}&v=${encodeURIComponent(v || "")}`;
  R.setBrand = (ag) => { R.B = { logos: {}, ...(ag || {}) }; if (R.B.theme) R.setTheme(R.B.theme); };
  // Tema claro ou escuro: no painel é escolha de cada pessoa (salva no navegador); nas páginas do cliente vem da empresa
  R.theme = () => (document.documentElement.dataset.theme === "claro" ? "claro" : "escuro");
  R.setTheme = (t) => { if (t === "claro") document.documentElement.dataset.theme = "claro"; else delete document.documentElement.dataset.theme; };
  // logo "escuro" vai sobre fundo escuro; "claro" sobre fundo claro. Sem imagem, o nome vira o logo.
  R.logoHTML = (kind, fixed) => {
    if (!fixed && R.theme() === "claro") kind = kind === "escuro" ? "claro" : "escuro"; // no tema claro os fundos se invertem (o papel do contrato não)
    const v = R.B.logos && R.B.logos[kind];
    return v ? `<img src="/api/public/logo/${kind}${R.imgQ(v)}" alt="${R.esc(R.B.name)}">` : `<span class="wordmark">${R.esc(R.B.name)}</span>`;
  };
  R.store = {
    get(k, d) { try { const v = localStorage.getItem("rp." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("rp." + k, JSON.stringify(v)); } catch (e) {} },
  };

  R.api = async (path, opts = {}) => {
    const r = await fetch("/api/" + path, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((data && data.error) || "Não foi possível concluir agora. Confira a conexão e tente de novo."); err.status = r.status; err.data = data; throw err; }
    return data;
  };

  let toastT;
  R.toast = (msg) => {
    let t = R.$("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3600);
  };

  // CPF / CNPJ
  R.validDoc = (v) => {
    const d = R.digits(v);
    if (d.length === 11) {
      if (/^(\d)\1{10}$/.test(d)) return false;
      const c = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
      return c(9) === +d[9] && c(10) === +d[10];
    }
    if (d.length === 14) {
      if (/^(\d)\1{13}$/.test(d)) return false;
      const c = (n) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
      return c(12) === +d[12] && c(13) === +d[13];
    }
    return false;
  };
  R.maskDoc = (v) => {
    const d = R.digits(v).slice(0, 14);
    if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  };
  R.maskPhone = (v) => {
    const d = R.digits(v).slice(0, 11);
    if (d.length <= 2) return d ? "(" + d : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  R.validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());

  // indicador neutro de carregamento (círculo girando)
  R.SPIN = '<svg class="spin" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="90 150"/></svg>';

  R.stateHTML = (title, text, actions = "") => `<section class="state"><div class="box"><h1>${title}</h1>${text ? `<p>${text}</p>` : ""}${actions ? `<div class="hero-ctas">${actions}</div>` : ""}</div></section>`;
  R.loadingHTML = (txt) => `<section class="state"><div class="box">${R.SPIN}<p>${txt}</p></div></section>`;

  const T = (k, d) => (R.t ? R.t(k) : d);
  R.headerHTML = (links, cta) => `
  <header class="top wrap" id="top"><div class="inner">
    <a class="brand" href="#inicio" aria-label="${R.esc(R.B.name)}, ${T("home", "início")}">${R.logoHTML("escuro")}</a>
    <button class="pill pill-cream menu-toggle" id="menuToggle" aria-expanded="false" aria-controls="menu">${T("menu", "Menu")}</button>
    <nav class="menu" id="menu" aria-label="Principal">${links.map(([h, t]) => `<a class="pill pill-cream" href="${h}">${t}</a>`).join("")}${cta ? `<a class="pill pill-green" href="${cta[0]}">${cta[1]}</a>` : ""}</nav>
  </div></header>`;

  R.footerHTML = (ag) => {
    ag = ag || R.B;
    const wa = R.digits(ag.whatsapp), ig = String(ag.instagram || "").replace(/^@/, ""), site = String(ag.site || "");
    const waFmt = wa.replace(/^55(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    const siteHref = site && !/^https?:\/\//i.test(site) ? "https://" + site : site;
    const contact = [
      wa ? `<a href="${R.wa(wa)}" target="_blank" rel="noopener">WhatsApp ${R.esc(waFmt)}</a>` : "",
      ig ? `<a href="https://www.instagram.com/${encodeURIComponent(ig)}/" target="_blank" rel="noopener">Instagram @${R.esc(ig)}</a>` : "",
      siteHref ? `<a href="${R.esc(siteHref)}" target="_blank" rel="noopener">${R.esc(site.replace(/^https?:\/\//i, "").replace(/\/$/, ""))}</a>` : "",
    ].filter(Boolean).join("");
    return `<footer class="foot wrap"><div class="inner">
      <div class="foot-row">
        <p>${R.esc(ag.tagline || "")}</p>
        <span></span>
        ${contact ? `<div class="foot-contact"><span class="label" style="color:var(--accent)">${T("foot_talk", "Fale com a gente")}</span>${contact}</div>` : ""}
      </div>
      <a class="foot-logo" href="#inicio" aria-label="${T("foot_top", "Voltar ao topo")}">${R.logoHTML("claro")}</a>
      <div class="foot-legal"><span>© ${new Date().getFullYear()} ${R.esc(ag.name)}. ${T("foot_rights", "Todos os direitos reservados.")}</span><span>${R.esc(ag.city || "")}</span></div>
    </div></footer>`;
  };

  // Cabeçalho que fica sólido ao rolar + menu no celular
  R.initHeader = () => {
    const top = R.$("#top"), menu = R.$("#menu"), tog = R.$("#menuToggle");
    if (!top) return;
    const onScroll = () => top.classList.toggle("solid", window.scrollY > 60 || menu.classList.contains("open"));
    tog.addEventListener("click", () => { const o = menu.classList.toggle("open"); tog.setAttribute("aria-expanded", o); onScroll(); });
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) { menu.classList.remove("open"); tog.setAttribute("aria-expanded", false); onScroll(); } });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  };

  // Quadro de assinatura desenhada (mouse, dedo ou caneta). Exporta PNG transparente recortado.
  R.SignPad = function (host, onChange, placeholder) {
    host.classList.add("pad");
    host.innerHTML = `<canvas aria-label="${R.esc(placeholder || "Desenhe a sua assinatura aqui")}" role="img"></canvas><span class="base" aria-hidden="true"></span><span class="ph">${R.esc(placeholder || "Desenhe a sua assinatura aqui")}</span>`;
    const cv = host.querySelector("canvas"), cx = cv.getContext("2d");
    let strokes = [], cur = null, dpr = 1;
    const size = () => {
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      const r = host.getBoundingClientRect();
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      redraw();
    };
    const drawStroke = (ctx, pts, k) => {
      if (!pts.length) return;
      ctx.lineWidth = 2.6 * k; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0c0c0a";
      ctx.beginPath(); ctx.moveTo(pts[0][0] * k, pts[0][1] * k);
      if (pts.length === 1) { ctx.lineTo(pts[0][0] * k + 0.1, pts[0][1] * k); }
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0] * k, pts[i][1] * k, mx * k, my * k);
      }
      if (pts.length > 1) { const l = pts[pts.length - 1]; ctx.lineTo(l[0] * k, l[1] * k); }
      ctx.stroke();
    };
    const redraw = () => { cx.clearRect(0, 0, cv.width, cv.height); strokes.forEach((s) => drawStroke(cx, s, dpr)); host.classList.toggle("has", strokes.length > 0); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pos(e)]; strokes.push(cur); redraw(); });
    cv.addEventListener("pointermove", (e) => { if (!cur) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; evs.forEach((x) => cur.push(pos(x))); redraw(); });
    const end = () => { if (cur) { cur = null; onChange && onChange(); } };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(size, 120); });
    size();
    return {
      clear() { strokes = []; redraw(); onChange && onChange(); },
      isEmpty() { const n = strokes.reduce((a, s) => a + s.length, 0); return n < 6; },
      toPNG() {
        const all = strokes.flat(); if (!all.length) return "";
        let x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
        const pad = 8, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
        const k = Math.min(3, 600 / w, 220 / h);
        const out = document.createElement("canvas"); out.width = Math.max(1, Math.round(w * k)); out.height = Math.max(1, Math.round(h * k));
        const oc = out.getContext("2d");
        oc.translate((pad - x0) * k, (pad - y0) * k);
        strokes.forEach((s) => drawStroke(oc, s, k));
        return out.toDataURL("image/png");
      },
    };
  };

  // Revelação ao rolar
  R.reveal = (pairs) => {
    if (!document.documentElement.classList.contains("anim")) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    pairs.forEach(([sel, dir, step = 0, base = 0]) => R.$$(sel).forEach((el, i) => {
      if (el.dataset.reveal) return;
      el.dataset.reveal = dir; el.style.setProperty("--d", base + i * step + "s"); io.observe(el);
    }));
  };
})();
