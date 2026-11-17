/* Taratura della misura delle barre (src/cartolina/misura.ts) sulle cartoline vere di Danilo, contro i valori
   del database (la copia notturna data/profumi.json). Le cartoline di Fragrantica restano fuori da git.

   Dalla cartella app/:
     node strumenti/tara-cartoline.mjs                          cartelle C:\Projects\Sillage\SchedeProfumiFragrantica
     node strumenti/tara-cartoline.mjs <cartella> [--dettagli]

   Per ogni cartolina trova il profumo (marchio e nome nel nome del file), misura e confronta: accordi,
   stagioni (riportate a 100) e giorno. Stampa le differenze e la più grande. */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leggiImmagine, carica, trovaProfumo } from "./cartolina-node.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = join(QUI, "..", "..");
const cartella = process.argv.slice(2).find((a) => !a.startsWith("--")) || "C:\\Projects\\Sillage\\SchedeProfumiFragrantica";
const dettagli = process.argv.includes("--dettagli");
const { misuraCartolina } = await carica();
const profumi = JSON.parse(readFileSync(join(REPO, "data", "profumi.json"), "utf8"));

const trova = (file) => trovaProfumo(file, profumi);

let peggiore = 0, confronti = 0, fuori = 0;
const righe = [];
for (const file of readdirSync(cartella).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()) {
  const p = trova(file);
  if (!p) { righe.push(`?? ${file}: nessun profumo corrispondente`); continue; }
  const m = misuraCartolina(leggiImmagine(join(cartella, file)));
  const db = {
    accordi: String(p.accordi_forza || "").split("|").filter(Boolean).map(Number),
    stagioni: p.stagioni, giorno: p.giornoPct
  };
  const diff = [];
  const confronta = (cosa, a, b) => {
    if (b === null || b === undefined || Number.isNaN(b)) return;
    confronti++;
    const d = a === null || a === undefined ? 99 : Math.abs(a - b);
    peggiore = Math.max(peggiore, d);
    if (d > 1) fuori++;
    if (d > 1 || dettagli) diff.push(`${cosa} ${a ?? "—"}/${b}`);
  };
  db.accordi.forEach((v, i) => confronta("acc" + (i + 1), m.accordi[i], v));
  if (m.accordi.length !== db.accordi.length) diff.push(`accordi trovati ${m.accordi.length} invece di ${db.accordi.length}`);
  for (const s of ["inverno", "primavera", "estate", "autunno"]) confronta(s.slice(0, 3), m.stagioni?.[s], db.stagioni?.[s]);
  confronta("giorno", m.giornoPct, db.giorno);
  const somma = m.stagioniGrezze ? Object.values(m.stagioniGrezze).reduce((a, b) => a + b, 0).toFixed(1) : "—";
  righe.push(`${diff.length ? "≠ " : "= "}${String(p.id).padStart(2)} ${(p.brand + " " + p.name + " " + p.conc).padEnd(40)} somma stagioni ${somma}` +
    (diff.length ? "  " + diff.join(", ") : "") + (m.dubbi.length ? "  [" + m.dubbi.join(" ") + "]" : "") + (dettagli ? "\n     " + JSON.stringify(m.traccia) + " " + JSON.stringify(m.stagioniGrezze) : ""));
}
console.log(righe.join("\n"));
console.log(`\n${confronti} valori confrontati, ${fuori} fuori di più di un punto, differenza più grande ${peggiore}.`);
