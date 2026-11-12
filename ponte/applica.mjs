// Applica al database le aggiunte e le correzioni che stanno nel repo:
// data/aggiunte.json e data/correzioni.json, nello stesso formato di sempre.
//
//   node ponte/applica.mjs          applica
//   node ponte/applica.mjs --prova  dice cosa farebbe, senza scrivere
//
// Rilanciare non fa danni: una riga che c'è già viene saltata, e una
// correzione si applica solo se la cella ha ancora il valore `da`.
// Dopo, il ponte ricopia da solo il catalogo nel foglio.
//
// La chiave di Sillage si prende dalla variabile SILLAGE_CHIAVE oppure dal
// file .dev.vars nella cartella del repo (riga SILLAGE_CHIAVE=...), che git
// ignora. Con --ponte <indirizzo> si prova contro un altro ponte.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const qui = path.dirname(fileURLToPath(import.meta.url)), radice = path.join(qui, "..");
const arg = process.argv.slice(2), prova = arg.includes("--prova");
const ponte = arg.includes("--ponte") ? arg[arg.indexOf("--ponte") + 1] : "https://sillage.danilo-moro96.workers.dev/api";

function chiave() {
  if (process.env.SILLAGE_CHIAVE) return process.env.SILLAGE_CHIAVE.trim();
  for (const f of [path.join(radice, ".dev.vars"), "C:/Projects/Sillage/.dev.vars"]) {
    try {
      const m = fs.readFileSync(f, "utf8").match(/^SILLAGE_CHIAVE\s*=\s*"?([^"\r\n]+)"?/m);
      if (m) return m[1].trim();
    } catch (e) { /* si prova il prossimo */ }
  }
  throw new Error("manca la chiave: SILLAGE_CHIAVE nell'ambiente o in .dev.vars");
}
const leggi = n => { try { return JSON.parse(fs.readFileSync(path.join(radice, "data", n), "utf8")); } catch (e) { return []; } };

const dati = { aggiunte: leggi("aggiunte.json"), correzioni: leggi("correzioni.json") };
const r = await fetch(ponte + "?azione=modifica" + (prova ? "&prova=1" : ""),
  { method: "POST", body: new URLSearchParams({ chiave: chiave(), dati: JSON.stringify(dati) }) });
const e = await r.json();
if (e.errore) { console.error("il ponte dice: " + e.errore); process.exit(1); }
console.log(e.testo);
