/* Prova della misura delle barre e del ritaglio della boccetta su cartoline SINTETICHE (strumenti/cartolina-finta.mjs):
   accordi, stagioni e giorno devono tornare entro un punto, la boccetta va trovata. Gira a ogni push (prova.yml).
   La taratura sulle cartoline vere di Danilo (fuori da git) è in strumenti/tara-cartoline.mjs.

   Dalla cartella app/: node strumenti/prova-cartolina.mjs */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { carica, leggiImmagine } from "./cartolina-node.mjs";
import { disegna, ESEMPI } from "./cartolina-finta.mjs";

const { misuraCartolina, ritagliaBoccetta, aCento } = await carica();
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "prove", "cartoline");
let errori = 0, controlli = 0;
const verifica = (cosa, ok, d = "") => {
  controlli++;
  if (!ok) { errori++; console.log("  NO!  " + cosa + " — " + d); }
};

const casi = [
  // quella nel repo (passata da PNG, come nel telefono) e le altre disegnate al volo
  ...ESEMPI.map((e) => ({ ...e, img: existsSync(join(DIR, e.nome)) ? leggiImmagine(join(DIR, e.nome)) : null, da: e.nome })),
  // altre combinazioni, disegnate al volo
  { lato: 1092, accordi: [100, 100, 92, 84, 82], stagioni: { inverno: 45, primavera: 10, estate: 5, autunno: 40 }, giorno: 38, da: "al volo 1" },
  { lato: 1200, accordi: [100, 66, 66, 62, 61], stagioni: { inverno: 25, primavera: 27, estate: 22, autunno: 26 }, giorno: 100, da: "al volo 2" },
  { lato: 1092, accordi: [100, 90, 70], stagioni: { inverno: 20, primavera: 30, estate: 40, autunno: 10 }, giorno: 0, da: "al volo 3 (tre accordi)" }
];
for (const c of casi) {
  const img = c.img ?? disegna(c);
  const m = misuraCartolina(img);
  verifica(`${c.da}: ${c.accordi.length} accordi`, m.accordi.length === c.accordi.length, JSON.stringify(m.accordi));
  c.accordi.forEach((v, i) => verifica(`${c.da}: accordo ${i + 1}`, Math.abs((m.accordi[i] ?? -99) - v) <= 1, `${m.accordi[i]} invece di ${v}`));
  const attese = aCento(c.stagioni);
  for (const k of Object.keys(attese)) verifica(`${c.da}: ${k}`, m.stagioni && Math.abs(m.stagioni[k] - attese[k]) <= 1, `${m.stagioni?.[k]} invece di ${attese[k]}`);
  verifica(`${c.da}: giorno`, m.giornoPct !== null && Math.abs(m.giornoPct - c.giorno) <= 1, `${m.giornoPct} invece di ${c.giorno}`);
  const b = ritagliaBoccetta(img, m.boccetta);
  const k = img.width / 1092;
  verifica(`${c.da}: boccetta ritagliata`, b && Math.abs(b.width - 265 * k) < 20 * k && Math.abs(b.height - 410 * k) < 20 * k, b ? `${b.width}×${b.height}` : "niente");
}
// un'immagine qualunque (non una cartolina) non deve rompere niente
const vuota = { width: 600, height: 400, data: new Uint8ClampedArray(600 * 400 * 4).fill(255) };
const mv = misuraCartolina(vuota);
verifica("un'immagine che non è una cartolina: lo dice", mv.dubbi.length > 0 && mv.accordi.length === 0, JSON.stringify(mv.dubbi));

console.log(`${controlli} controlli sulla misura delle cartoline sintetiche, ${errori} falliti.`);
if (errori) process.exit(1);
