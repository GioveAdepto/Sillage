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
import { leggiImmagine, carica } from "./cartolina-node.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = join(QUI, "..", "..");
const cartella = process.argv.slice(2).find((a) => !a.startsWith("--")) || "C:\\Projects\\Sillage\\SchedeProfumiFragrantica";
const dettagli = process.argv.includes("--dettagli");
const { misuraCartolina } = await carica();
const profumi = JSON.parse(readFileSync(join(REPO, "data", "profumi.json"), "utf8"));

const norm = (s) => String(s).normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const CONC = [[/eaudeparfum|edp/, "EDP"], [/eaudetoilette|edt/, "EDT"], [/parfum$/, "Parfum"]];
/** Il profumo del database che corrisponde al nome del file (Marchio_NomeProfumo). */
// i nomi dei file che non contengono il nome del database (scelti a mano, una volta)
const A_MANO = {
  "AlHaramain_OudGoldEdition.png": 27, "Armaf_ClubDeNuitIntense.png": 17, "DolceGabbana_TheOneEauDeParfum.png": 12,
  "FrenchAvenue_AzzureOud.png": 38, "Gucci_GuiltyEauDeParfum.png": 19, "Lalique_OmbreNoir.png": 32,
  "Rasasi_HawasLaYuqawam.png": 23, "RueBroca_TheoremeEauDeParfum.png": 7
};
function trova(file) {
  if (A_MANO[file]) return profumi.find((p) => p.id === A_MANO[file]);
  const [marca, ...resto] = file.replace(/\.[a-z]+$/i, "").split("_");
  const m = norm(marca), n = norm(resto.join(""));
  const candidati = profumi
    .filter((p) => m.startsWith(norm(p.brand).slice(0, 5)) || norm(p.brand).startsWith(m.slice(0, 5)))
    .filter((p) => n.startsWith(norm(p.name)) || n.includes(norm(p.name)))
    .sort((a, b) => norm(b.name).length - norm(a.name).length);
  if (candidati.length <= 1) return candidati[0];
  const lunghi = candidati.filter((p) => norm(p.name).length === norm(candidati[0].name).length);
  const conc = CONC.find(([re]) => re.test(n.slice(norm(lunghi[0].name).length)));
  return (conc && lunghi.find((p) => p.conc === conc[1])) || lunghi[0];
}

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
