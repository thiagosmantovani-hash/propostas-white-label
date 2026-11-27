// Armazenamento: Netlify Blobs em produção; pasta local quando LOCAL_BLOBS_DIR estiver definida (testes).
// Cada empresa cadastrada tem a sua "gaveta": tudo o que db() lê ou grava fica em e/<id da empresa>/...
// A empresa da requisição é definida uma vez (withCompany) e vale para todo o código chamado dentro dela,
// então uma empresa nunca lê nem grava os dados de outra. Sem empresa definida, db() recusa.
// rootDb() guarda o que é do sistema todo: empresas, logins (e-mail -> empresa), links públicos e pedidos de nova senha.
import { promises as fs } from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

const scope = new AsyncLocalStorage();
export const withCompany = (cid, fn) => scope.run({ cid }, fn);
export const currentCompany = () => (scope.getStore() || {}).cid || null;
export const okCompanyId = (id) => /^[\w-]{6,64}$/.test(id || "");

let cached = null;

const env = (k) => {
  try { if (globalThis.Netlify?.env?.get) { const v = globalThis.Netlify.env.get(k); if (v != null) return v; } } catch {}
  return process.env[k];
};

function fileStore(dir) {
  const file = (key) => path.join(dir, key.replace(/[^a-zA-Z0-9/_-]/g, "_") + ".json");
  return {
    async get(key) {
      try { return JSON.parse(await fs.readFile(file(key), "utf8")); } catch { return null; }
    },
    async set(key, value) {
      const f = file(key);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, JSON.stringify(value, null, 2));
    },
    async del(key) { try { await fs.unlink(file(key)); } catch {} },
    // lista também as subpastas, como o Netlify Blobs faz com um prefixo
    async list(prefix) {
      const walk = async (rel) => {
        let ents = [];
        try { ents = await fs.readdir(path.join(dir, rel), { withFileTypes: true }); } catch { return []; }
        const out = [];
        for (const e of ents) {
          if (e.isDirectory()) out.push(...(await walk(rel + e.name + "/")));
          else if (e.name.endsWith(".json")) out.push(rel + e.name.slice(0, -5));
        }
        return out;
      };
      return walk(prefix);
    },
  };
}

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  // Nome do armazenamento: BLOBS_STORE no Netlify (padrão "propostas"). Um nome separado evita que uma cópia
  // de teste ou de outra empresa leia ou grave os dados de um site que já está no ar com outro nome.
  const s = getStore({ name: env("BLOBS_STORE") || "propostas", consistency: "strong" });
  return {
    async get(key) { return s.get(key, { type: "json" }); },
    async set(key, value) { await s.setJSON(key, value); },
    async del(key) { await s.delete(key); },
    async list(prefix) { const { blobs } = await s.list({ prefix }); return blobs.map((b) => b.key); },
  };
}

export async function rootDb() {
  if (cached) return cached;
  const local = env("LOCAL_BLOBS_DIR");
  cached = local ? fileStore(local) : await blobStore();
  return cached;
}

function prefixed(base, pre) {
  return {
    get: (key) => base.get(pre + key),
    set: (key, value) => base.set(pre + key, value),
    del: (key) => base.del(pre + key),
    async list(prefix) { return (await base.list(pre + prefix)).map((k) => k.slice(pre.length)); },
  };
}

// dados da empresa da requisição atual
export async function db() {
  const cid = currentCompany();
  if (!okCompanyId(cid)) throw new Error("empresa não definida para esta requisição");
  return prefixed(await rootDb(), "e/" + cid + "/");
}

export async function listDocs(prefix) {
  const s = await db();
  const keys = await s.list(prefix);
  const docs = await Promise.all(keys.map((k) => s.get(k)));
  return docs.filter(Boolean);
}

export { env };
