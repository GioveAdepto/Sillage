/* Un Web App del foglio finto, per provare il ponte in locale senza toccare il foglio vero
   (ponte/LEGGIMI.md, «Provarlo in locale»). Risponde solo a quello che il ponte gli chiede:
   - azione=grezzo   il catalogo nelle colonne del foglio, ricostruito da data/*.json del repo
   - azione=specchio la copia del ponte: la conta e risponde ok, senza salvare niente

   Si lancia dalla cartella app/:   node strumenti/foglio-finto.mjs   (porta 8899)
   poi, dalla radice del repo:
     npx wrangler@4 dev --var FOGLIO_URL:http://127.0.0.1:8899/exec --var SILLAGE_CHIAVE:prova */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const leggi = (n) => JSON.parse(readFileSync(join(REPO, "data", n + ".json"), "utf8"));

// l'inverso di RINOMINA in ponte/ponte.js: dal nome dell'app alla colonna del foglio
const COLONNA = {
  brand: "marchio", name: "profumo", conc: "concentrazione", longevita: "longevita_h", note: "piramide",
  noteElenco: "note", dupe: "clone_di", cloneStato: "clone_stato", desc: "descrizione", giornoPct: "giorno_pct",
  formatoMl: "formato_ml", tipoPossesso: "tipo_possesso", numFlaconi: "num_flaconi", residuoPct: "residuo_pct",
  notePersonali: "note_personali"
};
const testo = (v) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join("|") : String(v));
function tab(righe) {
  const colonne = [...new Set(righe.flatMap((r) => Object.keys(r)))];
  return { colonne, righe: righe.map((r) => Object.fromEntries(colonne.map((c) => [c, testo(r[c])]))) };
}
function catalogo() {
  const profumi = leggi("profumi").map((p) => {
    const r = {};
    for (const [k, v] of Object.entries(p)) {
      if (k === "stagioni") Object.assign(r, v || {});
      else if (k === "nuovo") r.nuovo = v ? "si" : "";
      else r[COLONNA[k] || k] = v;
    }
    if (!("residuo_pct" in r)) r.residuo_pct = "";
    return r;
  });
  const layering = leggi("layering").map((l) => ({
    gruppo: l.g, tag: l.t, nome: l.n, sommario: l.s, come: l.come, risultato: l.ris, perche: l.perche, quando: l.quando
  }));
  const consigli = leggi("consigli");
  return {
    Profumi: tab(profumi),
    Layering: tab(layering),
    Consigli: tab(consigli.map((c) => ({ gruppo: c.g, nome: c.n, lacuna: c.gap }))),
    ConsigliVoci: tab(consigli.flatMap((c) => (c.voci || []).map((v) => ({ consiglio: c.n, titolo: v.t, dettaglio: v.d })))),
    Note: tab(leggi("note").map((n) => ({ nota: n })))
  };
}

createServer(async (req, res) => {
  let corpo = "";
  for await (const pezzo of req) corpo += pezzo;
  const p = new URLSearchParams(new URL(req.url, "http://x").search);
  new URLSearchParams(corpo).forEach((v, k) => p.set(k, v));
  const azione = p.get("azione");
  let risposta;
  if (azione === "grezzo") risposta = { tabs: catalogo() };
  else if (azione === "specchio") {
    const d = JSON.parse(p.get("dati") || "{}");
    console.log("specchio:", Object.entries(d.tabs || {}).map(([n, t]) => `${n} ${t.righe?.length ?? 0}`).join(", "));
    risposta = { ok: true };
  } else risposta = { errore: "azione sconosciuta: " + azione };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(risposta));
}).listen(8899, "127.0.0.1", () => console.log("foglio finto su http://127.0.0.1:8899/exec"));
