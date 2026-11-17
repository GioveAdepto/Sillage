/* Prova la lettura della piramide (src/cartolina/scritte.ts, preparaSchermata + capisciPiramide) col lettore vero
   (Tesseract, in Node) su schermate vere della piramide di Fragrantica, fuori da git. Scrive accanto a ogni schermata
   la versione «-pronta.png» (senza icone, sfondo bianco) e stampa le note lette per livello.

   Dalla cartella app/:  node strumenti/tara-piramide.mjs <schermata.png | cartella> [--parole] */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { leggiImmagine, carica, lettoreNode, comePng } from "./cartolina-node.mjs";

const dove = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!dove) throw new Error("serve una schermata o una cartella");
const file = statSync(dove).isDirectory()
  ? readdirSync(dove).filter((f) => /\.(png|jpe?g)$/i.test(f) && !/-pronta\.png$/.test(f)).map((f) => join(dove, f))
  : [dove];
const { preparaSchermata, capisciPiramide } = await carica();
const lettore = await lettoreNode(join(tmpdir(), "sillage-tesseract"));
for (const f of file) {
  const p = preparaSchermata(leggiImmagine(f));
  writeFileSync(f.replace(/\.(png|jpe?g)$/i, "-pronta.png"), comePng(p));
  const l = await lettore.riconosci(p, "sparso");
  if (process.argv.includes("--parole")) console.log(l.parole.map((w) => `${w.testo}(${Math.round(w.conf)})`).join(" "));
  const n = capisciPiramide(l, [], p.icone);
  console.log(`${f}\n  icone ${p.icone.length}\n  testa: ${n.testa.join(", ")}\n  cuore: ${n.cuore.join(", ")}\n  fondo: ${n.fondo.join(", ")}`);
}
await lettore.chiudi();
