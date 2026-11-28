// Tema do painel (claro ou escuro) aplicado antes de desenhar a página, sem piscar.
try{if(JSON.parse(localStorage.getItem("rp.tema"))!=="escuro")document.documentElement.dataset.theme="claro"}catch(e){document.documentElement.dataset.theme="claro"}
