/* Prova della misura delle barre e del ritaglio della boccetta su cartoline SINTETICHE (strumenti/cartolina-finta.mjs):
   accordi, stagioni e giorno devono tornare entro un punto, la boccetta va trovata. Gira a ogni push (prova.yml).
   La taratura sulle cartoline vere di Danilo (fuori da git) è in strumenti/tara-cartoline.mjs.

   Dalla cartella app/: node strumenti/prova-cartolina.mjs */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { carica, leggiImmagine } from "./cartolina-node.mjs";
import { disegna, ESEMPI } from "./cartolina-finta.mjs";

const { misuraCartolina, ritagliaBoccetta, aCento, capisciTestata, capisciVoto, capisciProfilo, capisciAccordo, capisciNote, capisciPiramide } = await carica();
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

// ── come si capisce il testo letto (il lettore vero si tara a parte: strumenti/tara-scritte.mjs) ──
const parole = (righe) => ({ testo: righe.map((r) => r.map((p) => p[0]).join(" ")).join("\n"), parole: righe.flatMap((r) => r.map(([testo, x0, y0, x1, y1, conf = 95]) => ({ testo, x0, y0, x1, y1, conf }))) });
const t = capisciTestata([{ testo: "Gentleman Eau de Parfum Reserve", alta: 70 }, { testo: "Privée", alta: 68 }, { testo: "Givenchy", alta: 30 }, { testo: "da uomo", alta: 25 }], ["Givenchy"]);
verifica("titolo su due righe, «Eau de Parfum» tolto: EDP", t.nome === "Gentleman Reserve Privée" && t.conc === "EDP" && t.marchio === "Givenchy" && t.genere === "uomo", JSON.stringify(t));
const t2 = capisciTestata([{ testo: "Prada L'Homme Intense", alta: 70 }, { testo: "Prada", alta: 30 }, { testo: "da uomo", alta: 25 }]);
verifica("il marchio davanti al nome si toglie", t2.nome === "L'Homme Intense" && t2.conc === "", JSON.stringify(t2));
const t3 = capisciTestata([{ testo: "Island", alta: 70 }, { testo: "Khadlaj Perfumes", alta: 30 }, { testo: "unisex", alta: 25 }], ["Khadlaj", "Lattafa"]);
verifica("«Khadlaj Perfumes» come nel catalogo: Khadlaj", t3.marchio === "Khadlaj" && t3.genere === "unisex", JSON.stringify(t3));
const t4 = capisciTestata([{ testo: "Absolutely", alta: 70 }, { testo: "Emporio Armani", alta: 30 }], ["Giorgio Armani"]);
verifica("un marchio solo simile non si corregge", t4.marchio === "Emporio Armani", t4.marchio);
verifica("voto", capisciVoto({ testo: "4.3 *k ks", parole: [] }).voto === 4.3);
verifica("voti fra parentesi", capisciVoto({ testo: "4.3 ★★★\n(10143)", parole: [] }).voti === 10143);
const pr = capisciProfilo({ testo: "profilo olfattivo\nX 7 h Longevità == Moderata Scia", parole: [] });
verifica("durata e scia (al maschile, come nel catalogo)", pr.durata === 7 && pr.scia === "Moderato", JSON.stringify(pr));
verifica("accordo letto quasi giusto: corretto", capisciAccordo({ testo: "| Speziat0 Fresco |", parole: [] }) === "Speziato Fresco");
verifica("accordo sconosciuto: resta com'è", capisciAccordo({ testo: "Zuccheroso", parole: [] }) === "Zuccheroso");
const note = capisciNote(parole([
  [["note", 30, 38, 90, 64]],
  [["Cedro", 47, 274, 140, 306], ["Bacche", 266, 274, 380, 306], ["di", 416, 275, 450, 306], ["Note", 485, 275, 560, 306]],
  [["Ginepro", 265, 324, 390, 363], ["Minerali", 485, 324, 600, 355, 50]],
  [["Legno", 48, 562, 140, 607], ["Frutto", 265, 566, 370, 597], ["Legno", 485, 566, 560, 597], ["di", 570, 566, 600, 597]],
  [["Legnose", 48, 615, 170, 655], ["Agar...", 485, 615, 590, 650, 34]]
]), 690, ["Legno di Agar"]);
verifica("le note: tre colonne, nomi a capo, troncati completati", note.join("|") === "Cedro|Bacche di Ginepro|Note Minerali|Legno Legnose|Frutto|Legno di Agar", note.join("|"));
const pir = capisciPiramide(parole([
  [["Piramide", 100, 10, 300, 50], ["olfattiva", 320, 10, 500, 50]],
  [["Note", 100, 100, 180, 130], ["di", 190, 100, 220, 130], ["testa", 230, 100, 320, 130]],
  [["Bergamotto", 50, 250, 220, 280], ["Limone", 400, 250, 520, 280]],
  [["Note", 100, 350, 180, 380], ["di", 190, 350, 220, 380], ["cuore", 230, 350, 320, 380]],
  [["Fiore", 50, 500, 140, 530], ["d'Arancio", 30, 540, 170, 570]],
  [["Note", 100, 650, 180, 680], ["di", 190, 650, 220, 680], ["fondo", 230, 650, 320, 680]],
  [["Fava", 50, 800, 120, 830], ["Tonka", 130, 800, 220, 830], ["Muschio", 400, 800, 520, 830]]
]), ["Bergamotto"]);
// come la schermata del sito in italiano (Danilo, 2026-11-17): «Note di apertura / centrali / di base», nomi vicini
// sulla stessa riga divisi dalle icone sopra
const pir2 = capisciPiramide(parole([
  [["NOTE", 620, 60, 680, 76], ["DI", 696, 60, 716, 76], ["APERTURA", 730, 60, 853, 76]],
  [["Lampone", 680, 262, 797, 290]],
  [["NOTE", 644, 344, 705, 362], ["CENTRALI", 717, 344, 830, 362]],
  [["Betulla", 550, 579, 635, 602], ["Ambra", 716, 579, 801, 602], ["Benzoino", 846, 580, 964, 602, 29]],
  [["NOTE", 656, 662, 716, 680], ["DI", 730, 662, 750, 680], ["BASE", 764, 662, 819, 680]],
  [["Muschio", 720, 880, 826, 902], ["Muschio", 850, 876, 957, 913], ["Vegetale", 970, 876, 1082, 913], ["Patchouli", 1100, 880, 1216, 902]]
]), [], [{ x: 736, y0: 112, y1: 240 }, { x: 592, y0: 400, y1: 560 }, { x: 760, y0: 432, y1: 560 }, { x: 904, y0: 440, y1: 560 },
  { x: 772, y0: 744, y1: 864 }, { x: 960, y0: 752, y1: 864 }, { x: 1156, y0: 752, y1: 864 }]);
verifica("la piramide del sito: apertura / centrali / di base, nomi divisi dalle icone",
  JSON.stringify(pir2) === JSON.stringify({ testa: ["Lampone"], cuore: ["Betulla", "Ambra", "Benzoino"], fondo: ["Muschio", "Muschio Vegetale", "Patchouli"] }), JSON.stringify(pir2));
verifica("la piramide da una schermata",JSON.stringify(pir) === JSON.stringify({ testa: ["Bergamotto", "Limone"], cuore: ["Fiore d'Arancio"], fondo: ["Fava Tonka", "Muschio"] }), JSON.stringify(pir));

console.log(`${controlli} controlli sulla misura e sulle scritte delle cartoline sintetiche, ${errori} falliti.`);
if (errori) process.exit(1);
