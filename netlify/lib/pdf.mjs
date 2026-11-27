// Gera o PDF do contrato (texto, assinaturas e registro de auditoria) com o logo e as cores de Dados da empresa.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { font_light, font_regular, font_semibold } from "./brand/assets.mjs";
import { brand, pdfLogo, rgb01 } from "./brand.mjs";
import { dateTimeL, fmtDoc } from "./util.mjs";

const INK = rgb(0.047, 0.047, 0.039);
const MUTED = rgb(0.38, 0.37, 0.33);
const LINE = rgb(0.82, 0.79, 0.7);

const W = 595.28, H = 841.89, ML = 62, MR = 62, MT = 78, MB = 70;
const B64 = (s) => Uint8Array.from(Buffer.from(s, "base64"));

const TX = {
  pt: { contract: "Contrato nº", proposal: "Proposta comercial nº", sigs: "Assinaturas", agency: "CONTRATADA", client: "CONTRATANTE", inter: "INTERMEDIADOR E TESTEMUNHA", signedAt: "Assinado eletronicamente em", tz: "Horário de Brasília", waiting: "Aguardando assinatura", audit: "Registro de assinatura eletrônica", auditLead: "Este registro integra o contrato e comprova a autoria e a integridade do documento assinado pela plataforma de propostas de {A}.", doc: "Documento", hash: "Código de verificação (SHA-256 do texto)", created: "Gerado em", sent: "Enviado para assinatura em", status: "Situação", stSigned: "Assinado", stCancel: "Cancelado", stWait: "Aguardando assinatura do contratante", hAgency: "Contratada", hClient: "Contratante", hInter: "Intermediador e testemunha", notYet: "Ainda não assinou.", name: "Nome", id: "CPF/CNPJ", email: "E-mail", when: "Data e hora", ip: "Endereço IP", ua: "Navegador", method: "Método", methodV: "Assinatura desenhada na tela, com aceite expresso dos termos", applied: "Aplicada por", notReg: "não registrado", page: "Página", of: "de", verify: "Verificação" },
  es: { contract: "Contrato nº", proposal: "Propuesta comercial nº", sigs: "Firmas", agency: "CONTRATADA", client: "CONTRATANTE", inter: "INTERMEDIARIO Y TESTIGO", signedAt: "Firmado electrónicamente el", tz: "Hora de Brasilia", waiting: "Pendiente de firma", audit: "Registro de firma electrónica", auditLead: "Este registro forma parte del contrato y acredita la autoría y la integridad del documento firmado en la plataforma de propuestas de {A}.", doc: "Documento", hash: "Código de verificación (SHA-256 del texto)", created: "Generado el", sent: "Enviado para firma el", status: "Estado", stSigned: "Firmado", stCancel: "Cancelado", stWait: "Pendiente de firma del contratante", hAgency: "Contratada", hClient: "Contratante", hInter: "Intermediario y testigo", notYet: "Aún no firmó.", name: "Nombre", id: "Documento", email: "Correo electrónico", when: "Fecha y hora", ip: "Dirección IP", ua: "Navegador", method: "Método", methodV: "Firma dibujada en pantalla, con aceptación expresa de los términos", applied: "Aplicada por", notReg: "no registrado", page: "Página", of: "de", verify: "Verificación" },
  en: { contract: "Agreement no.", proposal: "Commercial proposal no.", sigs: "Signatures", agency: "SERVICE PROVIDER", client: "CLIENT", inter: "INTERMEDIARY AND WITNESS", signedAt: "Signed electronically on", tz: "Brasília time", waiting: "Awaiting signature", audit: "Electronic signature record", auditLead: "This record is part of the agreement and proves the authorship and integrity of the document signed on {A}'s proposal platform.", doc: "Document", hash: "Verification code (SHA-256 of the text)", created: "Created on", sent: "Sent for signature on", status: "Status", stSigned: "Signed", stCancel: "Cancelled", stWait: "Awaiting the client's signature", hAgency: "Service provider", hClient: "Client", hInter: "Intermediary and witness", notYet: "Has not signed yet.", name: "Name", id: "ID", email: "E-mail", when: "Date and time", ip: "IP address", ua: "Browser", method: "Method", methodV: "Signature drawn on screen, with express acceptance of the terms", applied: "Applied by", notReg: "not recorded", page: "Page", of: "of", verify: "Verification" },
};

export async function contractPdf(contract, opts = {}) {
  const lang = TX[contract.lang] ? contract.lang : "pt";
  const t = TX[lang];
  const dt = (ts) => dateTimeL(ts, lang);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${t.contract} ${contract.number} · ${contract.client?.name || ""}`);
  const B = brand();
  const TERRA = rgb(...rgb01(B.colors.accent)), GREEN = rgb(...rgb01(B.colors.primary));
  pdf.setAuthor(B.name);
  pdf.setCreator(B.name);
  const fL = await pdf.embedFont(B64(font_light), { subset: true });
  const fR = await pdf.embedFont(B64(font_regular), { subset: true });
  const fS = await pdf.embedFont(B64(font_semibold), { subset: true });
  const lg = await pdfLogo();
  const logo = lg ? await (lg.type === "image/png" ? pdf.embedPng(lg.bytes) : pdf.embedJpg(lg.bytes)).catch(() => null) : null;
  const charset = new Set(fR.getCharacterSet());
  const safe = (s) => [...String(s ?? "")].map((c) => (c === "\n" || charset.has(c.codePointAt(0)) ? c : c === "⟦" ? "[" : c === "⟧" ? "]" : c === "₲" ? "G" : "?")).join("");
  const docOf = (s) => (s && s.doc ? (/^\d{11}$|^\d{14}$/.test(s.doc) ? fmtDoc(s.doc) : s.doc) : "");

  let page, y;
  const pages = [];
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    if (logo) {
      let lh = 16, lw = lh * logo.width / logo.height;
      if (lw > 160) { lw = 160; lh = lw * logo.height / logo.width; }
      page.drawImage(logo, { x: ML, y: H - 48 + (16 - lh) / 2, width: lw, height: lh });
    } else page.drawText(safe(B.name).toUpperCase(), { x: ML, y: H - 44, size: 9, font: fS, color: INK });
    const tag = safe(opts.tag || `${t.contract} ${contract.number}`);
    page.drawText(tag, { x: W - MR - fR.widthOfTextAtSize(tag, 7.5), y: H - 44, size: 7.5, font: fR, color: MUTED });
    page.drawLine({ start: { x: ML, y: H - 56 }, end: { x: W - MR, y: H - 56 }, thickness: 0.6, color: LINE });
    y = H - MT;
  };
  const ensure = (h) => { if (y - h < MB) newPage(); };
  const wrap = (text, font, size, width) => {
    const out = [];
    for (const para of safe(text).split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(""); continue; }
      let line = "";
      for (const w of words) {
        const tt = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(tt, size) <= width) line = tt;
        else { if (line) out.push(line); line = w; while (font.widthOfTextAtSize(line, size) > width) { let k = line.length - 1; while (k > 1 && font.widthOfTextAtSize(line.slice(0, k), size) > width) k--; out.push(line.slice(0, k)); line = line.slice(k); } }
      }
      out.push(line);
    }
    return out;
  };
  const para = (text, { font = fL, size = 9.3, lead = 13.8, color = INK, gap = 6, indent = 0 } = {}) => {
    for (const ln of wrap(text, font, size, W - ML - MR - indent)) {
      ensure(lead);
      if (ln) page.drawText(ln, { x: ML + indent, y, size, font, color });
      y -= lead;
    }
    y -= gap;
  };

  newPage();
  let first = true;
  for (const block of String(contract.text || "").split(/\n{2,}/)) {
    if (block.startsWith("## ")) {
      const [h, ...rest] = block.split("\n");
      const title = h.slice(3).trim();
      if (first) {
        para(title.toUpperCase(), { font: fS, size: 15, lead: 19, gap: 4 });
        para(opts.subtitle || `${t.proposal} ${contract.number}`, { font: fR, size: 8.5, color: MUTED, gap: 14 });
      } else {
        y -= 6; ensure(40);
        para(title, { font: fS, size: 10.2, lead: 14, color: TERRA, gap: 3 });
      }
      if (rest.length) para(rest.join("\n"));
    } else para(block);
    first = false;
  }

  if (opts.plain) return await finish();
  // Assinaturas (2 ou 3 colunas)
  const sg = contract.signatures || {};
  const blocks = [[t.agency, sg.agency, contract.agencyName], [t.client, sg.client, contract.client?.name]];
  if (sg.intermediary || contract.seller) blocks.push([t.inter, sg.intermediary, contract.seller?.name]);
  y -= 10; ensure(185);
  para(t.sigs, { font: fS, size: 10.2, lead: 14, color: TERRA, gap: 8 });
  const cols = blocks.length, gapX = 18;
  const colW = (W - ML - MR - gapX * (cols - 1)) / cols;
  const top = y;
  for (let i = 0; i < cols; i++) {
    const [role, s, fallback] = blocks[i];
    const x = ML + i * (colW + gapX);
    let yy = top;
    page.drawText(safe(role), { x, y: yy, size: 6.8, font: fS, color: MUTED });
    yy -= 8;
    if (s?.image) {
      try {
        const img = await pdf.embedPng(B64(s.image.split(",")[1]));
        const sc = Math.min(colW / img.width, 50 / img.height);
        page.drawImage(img, { x, y: yy - img.height * sc, width: img.width * sc, height: img.height * sc });
      } catch {}
    }
    yy -= 56;
    page.drawLine({ start: { x, y: yy }, end: { x: x + colW, y: yy }, thickness: 0.6, color: INK });
    yy -= 12;
    for (const ln of wrap(s?.name || fallback || "", fR, 8.6, colW)) { page.drawText(ln, { x, y: yy, size: 8.6, font: fR, color: INK }); yy -= 11; }
    if (s?.doc) { page.drawText(safe(docOf(s)), { x, y: yy, size: 7.8, font: fL, color: MUTED }); yy -= 10; }
    if (s?.at) {
      for (const ln of wrap(`${t.signedAt} ${dt(s.at).replace(/ \(.*\)$/, "")}`, fL, 7, colW)) { page.drawText(ln, { x, y: yy, size: 7, font: fL, color: GREEN }); yy -= 9; }
      page.drawText(safe(t.tz), { x, y: yy, size: 7, font: fL, color: GREEN });
    } else page.drawText(safe(t.waiting), { x, y: yy, size: 7, font: fL, color: TERRA });
  }

  // Registro de auditoria
  newPage();
  para(t.audit, { font: fS, size: 13, lead: 18, gap: 4 });
  para(t.auditLead.replaceAll("{A}", B.name), { size: 8.6, color: MUTED, gap: 14 });
  const row = (k, v) => {
    const lines = wrap(v || "-", fR, 8.6, W - ML - MR - 150);
    const klines = wrap(k, fS, 7.6, 136);
    const n = Math.max(lines.length, klines.length);
    ensure(n * 12 + 8);
    klines.forEach((ln, i) => page.drawText(ln, { x: ML, y: y - i * 11, size: 7.6, font: fS, color: MUTED }));
    lines.forEach((ln, i) => page.drawText(ln, { x: ML + 150, y: y - i * 12, size: 8.6, font: fR, color: INK }));
    y -= n * 12 + 6;
    page.drawLine({ start: { x: ML, y: y + 2 }, end: { x: W - MR, y: y + 2 }, thickness: 0.4, color: LINE });
    y -= 6;
  };
  row(t.doc, `${t.contract} ${contract.number}`);
  row(t.hash, contract.hash ? contract.hash.slice(0, 32) + " " + contract.hash.slice(32) : "");
  row(t.created, dt(contract.createdAt));
  row(t.sent, dt(contract.sentAt));
  row(t.status, contract.status === "assinado" ? t.stSigned : contract.status === "cancelado" ? t.stCancel : t.stWait);
  const people = [[t.hAgency, sg.agency], [t.hClient, sg.client]];
  if (sg.intermediary || contract.seller) people.push([t.hInter, sg.intermediary]);
  for (const [label, s] of people) {
    y -= 8;
    para(label, { font: fS, size: 10, lead: 14, color: TERRA, gap: 4 });
    if (!s) { para(t.notYet, { size: 8.6, color: MUTED }); continue; }
    row(t.name, s.name);
    row(t.id, docOf(s));
    if (s.email) row(t.email, s.email);
    row(t.when, dt(s.at));
    row(t.ip, s.ip || t.notReg);
    row(t.ua, s.ua || "");
    row(t.method, t.methodV);
    if (s.appliedBy) row(t.applied, s.appliedBy);
  }

  return await finish();
  async function finish() {
  const total = pages.length;
  pages.forEach((p, i) => {
    const left = safe(B.name + (B.tagline ? " · " + B.tagline : ""));
    const right = safe(opts.plain ? `${t.page} ${i + 1} ${t.of} ${total}` : `${t.verify} ${String(contract.hash || "").slice(0, 16)} · ${t.page} ${i + 1} ${t.of} ${total}`);
    p.drawRectangle({ x: 0, y: 0, width: W, height: 4, color: GREEN });
    p.drawText(left, { x: ML, y: 34, size: 6.8, font: fL, color: MUTED });
    p.drawText(right, { x: W - MR - fL.widthOfTextAtSize(right, 6.8), y: 34, size: 6.8, font: fL, color: MUTED });
  });
  return await pdf.save();
  }
}

// Documento simples (sem assinaturas e auditoria), usado no arquivo da proposta
export const documentPdf = (doc) => contractPdf(doc, { plain: true, tag: doc.tag, subtitle: doc.subtitle });
