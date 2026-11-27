// Armazenamento: Netlify Blobs em produção; pasta local quando LOCAL_BLOBS_DIR estiver definida (testes).
import { promises as fs } from "node:fs";
import path from "node:path";

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
    async list(prefix) {
      const d = path.join(dir, prefix);
      try {
        const names = await fs.readdir(d);
        return names.filter((n) => n.endsWith(".json")).map((n) => prefix + n.slice(0, -5));
      } catch { return []; }
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

export async function db() {
  if (cached) return cached;
  const local = env("LOCAL_BLOBS_DIR");
  cached = local ? fileStore(local) : await blobStore();
  return cached;
}

export async function listDocs(prefix) {
  const s = await db();
  const keys = await s.list(prefix);
  const docs = await Promise.all(keys.map((k) => s.get(k)));
  return docs.filter(Boolean);
}

export { env };
