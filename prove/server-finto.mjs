/* Un server per le prove: serve una cartella (l'app costruita, o la radice del repo per l'app di prima) anche
   sotto un prefisso come /Sillage/ (GitHub Pages), e finge il ponte su /api con le stesse risposte di
   ponte/ponte.js, in memoria. Nessuna richiesta esce verso il ponte pubblicato.
   - GET /api: catalogo da data/*.json, diario chiuso;
   - POST /api azione=leggi | diario | residuo: chiave «prova», altrimenti «chiave sconosciuta» come il ponte;
   - riscriviPonte: nei .js serviti l'indirizzo del ponte pubblicato diventa questo server (per l'app di prima);
   - cambiaCartella(): la stessa porta passa a servire un'altra cartella (il passaggio tra le due app). */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIPI = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon"
};
const PONTE_PUBBLICATO = "https://sillage.danilo-moro96.workers.dev/api";
const leggiDati = (n) => JSON.parse(readFileSync(join(REPO, "data", n + ".json"), "utf8"));

export function avvia({ porta = 8800, cartella, prefisso = "/", riscriviPonte = false } = {}) {
  const stato = { cartella, riscriviPonte, diario: new Map(), invii: [], residui: [] };
  const catalogo = () => ({ profumi: leggiDati("profumi"), note: leggiDati("note"), layering: leggiDati("layering"), consigli: leggiDati("consigli") });
  const base = `http://127.0.0.1:${porta}`;
  const json = (res, o, s = 200) => {
    res.writeHead(s, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
    res.end(JSON.stringify(o));
  };

  function ponte(req, res, corpo) {
    const p = new URLSearchParams(new URL(req.url, base).search);
    new URLSearchParams(corpo).forEach((v, k) => p.set(k, v));
    if (req.method === "OPTIONS") return json(res, {});
    if (req.method === "GET") return json(res, { ...catalogo(), diarioChiuso: true, aggiornato: new Date().toISOString() });
    const azione = p.get("azione"),
      giusta = p.get("chiave") === "prova";
    if (azione === "leggi") return json(res, { ...catalogo(), ...(giusta ? { diario: [...stato.diario.values()] } : { diarioChiuso: true }), aggiornato: new Date().toISOString() });
    if (!giusta) return json(res, { errore: "chiave sconosciuta: manca o non e' quella giusta" });
    if (azione === "residuo") {
      stato.residui.push({ id: +p.get("id"), valore: +p.get("valore") });
      return json(res, { ok: true });
    }
    if (azione !== "diario") return json(res, { errore: "azione sconosciuta: " + azione });
    const t = String(p.get("t")),
      op = p.get("op"),
      v = stato.diario.get(t);
    stato.invii.push({ op, t, id: +p.get("id") });
    const uso = { occasione: p.get("occasione") || "", momento: p.get("momento") || "" };
    if (op === "togli") {
      stato.diario.delete(t);
      return json(res, { ok: true, ...(v ? { tolta: true } : { assente: true }) });
    }
    if (op === "nota") {
      if (!v) return json(res, { errore: "voce non trovata" });
      Object.assign(v, { nota: p.get("nota") || "", voto: Number(p.get("voto")) || null, ...uso });
      return json(res, { ok: true, nota: true, uso: true });
    }
    if (v) return json(res, { ok: true, gia: true });
    stato.diario.set(t, { data: p.get("data"), id: +p.get("id"), t, nota: "", voto: null, ...uso });
    return json(res, { ok: true, uso: true });
  }

  const server = createServer(async (req, res) => {
    let corpo = "";
    for await (const pezzo of req) corpo += pezzo;
    const u = new URL(req.url, base);
    if (u.pathname === "/api") return ponte(req, res, corpo);
    if (prefisso !== "/" && (u.pathname === "/" || u.pathname === prefisso.slice(0, -1))) {
      res.writeHead(302, { Location: prefisso });
      return res.end();
    }
    if (!u.pathname.startsWith(prefisso)) {
      res.writeHead(404);
      return res.end("fuori dal sito");
    }
    let rel = decodeURIComponent(u.pathname.slice(prefisso.length)) || "index.html";
    if (rel.endsWith("/")) rel += "index.html";
    const f = normalize(join(stato.cartella, rel));
    if (!f.startsWith(normalize(stato.cartella)) || !existsSync(f) || statSync(f).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("non trovato");
    }
    let dati = readFileSync(f);
    const tipo = TIPI[extname(f)] || "application/octet-stream";
    if (stato.riscriviPonte && /javascript/.test(tipo)) dati = Buffer.from(dati.toString("utf8").split(PONTE_PUBBLICATO).join(base + "/api"));
    res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-cache" });
    res.end(dati);
  });
  return new Promise((r) =>
    server.listen(porta, "127.0.0.1", () =>
      r({
        stato,
        url: base + prefisso,
        cambiaCartella: (c, riscrivi = false) => {
          stato.cartella = c;
          stato.riscriviPonte = riscrivi;
        },
        chiudi: () => new Promise((f) => server.close(f))
      })
    )
  );
}
