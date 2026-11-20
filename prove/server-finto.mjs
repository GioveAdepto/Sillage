/* Un server per le prove: serve una cartella (l'app costruita, o la radice del repo per l'app di prima) anche
   sotto un prefisso come /Sillage/ (GitHub Pages), e finge il ponte su /api con le stesse risposte di
   ponte/ponte.js, in memoria. Nessuna richiesta esce verso il ponte pubblicato.
   - GET /api: catalogo da data/*.json, diario chiuso;
   - POST /api azione=leggi | diario | residuo: chiave «prova», altrimenti «chiave sconosciuta» come il ponte;
     azione=leggi dice chi ha riconosciuto (`chi`): con la chiave giusta Danilo, altrimenti nessuno;
   - riscriviPonte: nei .js serviti l'indirizzo del ponte pubblicato diventa questo server (per l'app di prima);
   - cambiaCartella(): la stessa porta passa a servire un'altra cartella (il passaggio tra le due app);
   - azione=scheda: la scheda pubblica di un profumo, senza credenziali e senza i dati di chi lo ha;
   - «Aggiungi profumo»: azione=catalogo, aggiungi (il profumo nuovo entra nel catalogo in memoria), GET /api/foto/<id>.
     Le scritte della cartolina le legge il telefono: nelle prove l'app è costruita col lettore finto (VITE_LETTORE=finto). */
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
  const stato = { cartella, riscriviPonte, diario: new Map(), invii: [], residui: [], aggiunte: [], nuovi: [], foto: new Map(), clienti: new Map() };
  const catalogo = () => ({ profumi: [...leggiDati("profumi"), ...stato.nuovi], note: leggiDati("note"), layering: leggiDati("layering"), consigli: leggiDati("consigli") });
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
    if (azione === "leggi")
      return json(res, {
        ...catalogo(),
        ...(giusta ? { diario: [...stato.diario.values()] } : { diarioChiuso: true }),
        chi: giusta ? { persona: "danilo", nome: "Danilo", da: "chiave" } : {},
        aggiornato: new Date().toISOString()
      });
    // la scheda pubblica (#/p/24, il link da CheMetto): senza credenziali, solo i dati comuni, come il ponte
    if (azione === "scheda") {
      const x = catalogo().profumi.find((q) => q.id === Number(p.get("id")));
      if (!x) return json(res, { errore: "profumo sconosciuto: " + p.get("id") });
      const privati = ["notePersonali", "residuoPct", "tipoPossesso", "formatoMl", "numFlaconi", "aggiunto", "attivo", "nuovo"];
      return json(res, { ok: true, profumo: Object.fromEntries(Object.entries(x).filter(([k]) => !privati.includes(k))) });
    }
    if (!giusta) return json(res, { errore: "chiave sconosciuta: manca o non e' quella giusta" });
    if (azione === "catalogo")
      return json(res, { ok: true, profumi: catalogo().profumi.map((x) => ({ id: x.id, brand: x.brand, name: x.name, conc: x.conc, img: x.img, accordi: (x.accordi || []).slice(0, 3) })) });
    if (azione === "aggiungi") {
      const d = JSON.parse(p.get("dati") || "{}");
      stato.aggiunte.push(d);
      if (stato.clienti.has(d.cliente)) return json(res, { ok: true, gia: true, ...stato.clienti.get(d.cliente) });
      const s = d.scheda || {}, chiave = (a, b, c) => [a, b, c].map((x) => String(x || "").toLowerCase()).join("|");
      const c = catalogo().profumi.find((x) => chiave(x.brand, x.name, x.conc) === chiave(s.marchio, s.profumo, s.concentrazione));
      if (c) {
        stato.clienti.set(d.cliente, { id: c.id, esistente: true });
        return json(res, { ok: true, id: c.id, esistente: true });
      }
      const id = Math.max(...catalogo().profumi.map((x) => x.id)) + 1, n = (k) => (s[k] === "" || s[k] === undefined ? null : Number(s[k]));
      if (d.foto) stato.foto.set(id, { tipo: d.foto.tipo, byte: Buffer.from(d.foto.dati, "base64") });
      const stagioni = { inverno: n("inverno"), primavera: n("primavera"), estate: n("estate"), autunno: n("autunno") };
      stato.nuovi.push({
        id, brand: s.marchio, name: s.profumo, conc: s.concentrazione, genere: s.genere, famiglia: s.famiglia || "",
        accordi: s.accordi ? s.accordi.split("|") : [], accordi_forza: s.accordi_forza, noteElenco: s.note ? s.note.split("|") : [],
        note: s.piramide || "", longevita: n("longevita_h"), sillage: s.sillage, giornoPct: n("giorno_pct"), rating: n("rating"), voti: n("voti"),
        stagioni: Object.values(stagioni).every((v) => v === null) ? null : stagioni, stagione: s.stagione || "tutto", momento: s.momento || "entrambi",
        colore: s.colore || "verde", ...Object.fromEntries(["ufficio", "serata", "palestra", "quotidiano", "formale", "informale", "appuntamento", "casa", "festivita"].map((o) => [o, s[o] || "no"])),
        tipoPossesso: d.possesso?.tipo || "full", formatoMl: d.possesso?.ml || null, notePersonali: d.possesso?.note || "",
        img: d.foto ? `api/foto/${id}.webp` : "", attivo: "si", nuovo: true, aggiunto: new Date().toISOString().slice(0, 10)
      });
      stato.clienti.set(d.cliente, { id, nuovo: true });
      return json(res, { ok: true, id, nuovo: true });
    }
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
    if (u.pathname.startsWith("/api/foto/")) {
      const f = stato.foto.get(Number(u.pathname.match(/(\d+)/)[1]));
      res.writeHead(f ? 200 : 404, { "Content-Type": f ? f.tipo : "text/plain", "Access-Control-Allow-Origin": "*" });
      return res.end(f ? f.byte : "non trovata");
    }
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
