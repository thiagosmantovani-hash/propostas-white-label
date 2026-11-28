/* Página de divulgação: preços e dias de teste vêm das Configurações do sistema (painel do dono),
   para a página dizer sempre o mesmo que o cadastro e a tela Plano e pagamento. */
(function () {
  "use strict";
  const brl = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/\s/g, " ");
  };
  const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => (el.textContent = text));
  fetch("/api/public/system", { headers: { accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((y) => {
      if (!y || !y.plans) return;
      const p = y.plans;
      set("[data-trial]", String(p.trialDays));
      set("[data-trial-badge]", `${p.trialDays} dias grátis`);
      set("[data-price-m]", brl(p.mensal));
      set("[data-price-a]", brl(p.anual));
      set("[data-price-am]", brl(Math.round((p.anual / 12) * 100) / 100));
    })
    .catch(() => {});
})();
