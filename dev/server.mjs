// Servidor local para testar o sistema sem o Netlify: arquivos de public/ + a função /api/* com armazenamento em pasta.
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.env.LOCAL_BLOBS_DIR ||= path.join(root, ".data");
process.env.ADMIN_PASSWORD ||= "teste123";
globalThis.Netlify = { env: { get: (k) => process.env[k] } };
const { default: api } = await import("../netlify/functions/api.mjs");

const PUB = path.join(root, "..", "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon" };
const REWRITES = [[/^\/$/, "/inicio.html"], [/^\/p\/.+/, "/proposta.html"], [/^\/c\/.+/, "/contrato.html"], [/^\/admin\/?$/, "/admin.html"]];

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await api(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }), { ip: req.socket.remoteAddress, params: {} });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = url.pathname;
    for (const [re, to] of REWRITES) if (re.test(p)) p = to;
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(PUB, path.normalize(p));
    if (!file.startsWith(PUB)) throw new Error("fora");
    const data = await fs.readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404");
  }
}).listen(process.env.PORT || 8888, () => console.log("http://localhost:" + (process.env.PORT || 8888)));
