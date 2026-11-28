// Carrega as cores e fontes da empresa (/api/public/brand.css) antes de desenhar a página.
document.write('<link rel="stylesheet" href="/api/public/brand.css?ref='+encodeURIComponent(location.pathname+location.search)+'&e='+encodeURIComponent((function(){try{return JSON.parse(localStorage.getItem("rp.empresa"))||""}catch(e){return""}})())+'">')
