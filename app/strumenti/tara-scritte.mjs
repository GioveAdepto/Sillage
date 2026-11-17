/* Taratura della lettura delle scritte (src/cartolina/scritte.ts) sulle cartoline vere di Danilo, con il lettore
   vero (Tesseract, in Node), contro il catalogo (data/profumi.json). Le cartoline restano fuori da git; la lingua
   del lettore si scarica la prima volta (≈ 2 MB, nella cartella della cache di sistema).

   Dalla cartella app/:
     node strumenti/tara-scritte.mjs                    cartella C:\Projects\Sillage\SchedeProfumiFragrantica
     node strumenti/tara-scritte.mjs <cartella> [--tutto]   (--tutto stampa anche quello che torna) */
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { leggiImmagine, carica, trovaProfumo, lettoreNode } from "./cartolina-node.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = join(QUI, "..", "..");
const cartella = process.argv.slice(2).find((a) => !a.startsWith("--")) || "C:\\Projects\\Sillage\\SchedeProfumiFragrantica";
const tutto = process.argv.includes("--tutto");
const { misuraCartolina, leggiCartolina } = await carica();
const profumi = JSON.parse(readFileSync(join(REPO, "data", "profumi.json"), "utf8"));
const cache = join(tmpdir(), "sillage-tesseract");
mkdirSync(cache, { recursive: true });
const lettore = await lettoreNode(cache);

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const conti = {};
const segna = (cosa, ok) => {
  conti[cosa] ??= [0, 0];
  conti[cosa][ok ? 0 : 1]++;
  return ok;
};
// le parole note: quelle del catalogo SENZA il profumo che si sta leggendo (come per un profumo nuovo)
const noteDi = (escluso) => [...new Set(profumi.filter((p) => p !== escluso).flatMap((p) => p.noteElenco || []))];
const accordiDi = (escluso) => [...new Set(profumi.filter((p) => p !== escluso).flatMap((p) => p.accordi || []))];
// i marchi: tutti quelli del catalogo (un marchio torna spesso), ma la prova dice anche quanti senza
const marchiDi = (escluso) => [...new Set(profumi.filter((p) => p !== escluso).map((p) => p.brand))];

let t0 = Date.now(), n = 0;
for (const file of readdirSync(cartella).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()) {
  const p = trovaProfumo(file, profumi);
  if (!p) continue;
  n++;
  const img = leggiImmagine(join(cartella, file));
  const s = await leggiCartolina(img, misuraCartolina(img), lettore.riconosci, { accordi: accordiDi(p), note: noteDi(p), marchi: marchiDi(p) });
  const no = [];
  const prova = (cosa, letto, atteso, uguale = (a, b) => norm(a) === norm(b)) => {
    if (atteso === null || atteso === undefined || atteso === "") return;
    if (!segna(cosa, uguale(letto, atteso)) || tutto) no.push(`${cosa}: «${letto ?? "—"}» / «${atteso}»`);
  };
  prova("nome", s.nome, p.name);
  prova("marchio", s.marchio, p.brand);
  prova("genere", s.genere, p.genere);
  if (s.conc) prova("conc", s.conc, p.conc);
  prova("voto", s.voto, p.rating, (a, b) => a !== null && Math.abs(a - b) < 0.051);
  prova("voti", s.voti, p.voti, (a, b) => a === b);
  prova("durata", s.durata, p.longevita, (a, b) => a === b);
  prova("scia", s.scia, p.sillage);
  (p.accordi || []).slice(0, 5).forEach((a, i) => prova("accordo", s.accordi[i], a));
  // le note del catalogo non sono sempre tutte quelle della cartolina: si contano quelle ritrovate
  for (const x of p.noteElenco || []) prova("nota", s.note.find((y) => norm(y) === norm(x)) ?? s.note.join(", "), x);
  console.log(`${no.length ? "≠" : "="} ${String(p.id).padStart(2)} ${(p.brand + " " + p.name).padEnd(42)} ${no.join(" · ")}`);
}
await lettore.chiudi();
console.log(`\n${n} cartoline in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const [k, [ok, ko]] of Object.entries(conti)) console.log(`${k.padEnd(8)} ${ok}/${ok + ko} giusti`);
