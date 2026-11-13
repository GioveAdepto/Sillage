/* Verifica delle viste della tappa 4: i numeri e le liste della nuova app (src/viste/calcoli.ts, similiA,
   rinumera) contro quelli che l'app di oggi (js/viste.js e i pezzi che usa) mette davvero a schermo.

   Si lancia dalla cartella app/:
     node strumenti/verifica-viste.mjs            profumi, layering e consigli da data/*.json
     node strumenti/verifica-viste.mjs --ponte    gli stessi letti adesso dal ponte (sola lettura)

   L'app di oggi gira in una sandbox con un DOM finto: si chiamano le sue funzioni di disegno (Numeri, Guida,
   Acquisti, Confronto) e dal loro HTML si leggono i numeri e gli id dei profumi, nell'ordine in cui compaiono.
   Le funzioni pure (partiRicetta, indiceStrati, giaInCasa, similiA, posizioneOlfattiva, rinumera) si
   chiamano direttamente. Il diario è finto, uguale per le due app, con l'orologio fermo al 13/11/2026 ore 12.
   Esce con codice 1 se trova una differenza non dichiarata.

   Differenze volute (normalizzate prima del confronto):
   - i numeri con la virgola («4,3») dove l'app di oggi scriveva «4.3»;
   - «Nº 7» invece di «№ 7» nei testi rinumerati. */
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(APP, "..");

// ── dati ──
let dati;
if (process.argv.includes("--ponte")) dati = await (await fetch("https://sillage.danilo-moro96.workers.dev/api")).json();
else dati = Object.fromEntries(["profumi", "layering", "consigli", "note"].map((n) => [n, JSON.parse(readFileSync(join(REPO, "data", n + ".json"), "utf8"))]));
const { profumi, layering, consigli } = dati;
const note = dati.note || [];

// ── orologio fermo ──
const VeraData = Date;
let ORA = new VeraData(2026, 10, 13, 12, 0).getTime();
class DataFinta extends VeraData {
  constructor(...a) {
    if (a.length) super(...a);
    else super(ORA);
  }
  static now() {
    return ORA;
  }
}

// ── un diario finto, uguale per le due app: mesi diversi, un layering, campioni, una voce futura ──
const pad = (n) => String(n).padStart(2, "0");
const ids = profumi.map((p) => p.id);
const diario = [];
let t = 1760000000000;
const giorni = [
  ["2026-11-13", [24]], ["2026-11-12", [ids[2], ids[5]]], ["2026-11-10", [24]], ["2026-11-05", [ids[29]]],
  ["2026-10-30", [ids[7]]], ["2026-10-02", [24]], ["2026-09-01", [ids[10]]], ["2026-07-15", [ids[3]]],
  ["2026-04-01", [ids[12], ids[33]]], ["2026-01-20", [ids[20]]], ["2026-03-20", [ids[4]]], ["2026-03-21", [ids[6]]], ["2026-06-21", [ids[8]]], ["2026-09-23", [ids[9]]], ["2026-11-20", [ids[1]]]
];
for (const [data, lista] of giorni) for (const id of lista) diario.push({ data, id, t: String(t++), nota: "", voto: null, occasione: "", momento: "" });
const base = String(t++); // un layering
diario.push({ data: "2026-11-08", id: ids[14], t: base + "1" }, { data: "2026-11-08", id: ids[16], t: base + "2" });

// ── l'app di oggi in una sandbox ──
const cartone = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "matches" ? false : cartone),
  apply: () => cartone,
  construct: () => cartone
});
const elementi = new Map();
const elemento = (id) => {
  if (!elementi.has(id))
    elementi.set(id, {
      id, innerHTML: "", textContent: "", style: {}, dataset: {}, disabled: false,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [],
      scrollIntoView() {}, focus() {}, closest: () => null
    });
  return elementi.get(id);
};
const memoria = new Map();
const sandbox = {
  Date: DataFinta, console,
  document: new Proxy({}, {
    get: (_t, k) =>
      k === "getElementById" ? elemento : k === "querySelector" ? () => null : k === "querySelectorAll" ? () => [] : k === "addEventListener" ? () => {} : cartone
  }),
  window: cartone, navigator: cartone, location: cartone, history: cartone,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  addEventListener() {}, getComputedStyle: () => ({ getPropertyValue: () => "" }),
  requestAnimationFrame: () => 0, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {},
  fetch: () => Promise.reject(new Error("niente rete")),
  localStorage: { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) },
  IntersectionObserver: class { observe() {} }, ResizeObserver: class { observe() {} }
};
vm.createContext(sandbox);
const vecchio = ["dati.js", "collezione.js", "consigliami.js", "viste.js", "diario.js"].map((f) => readFileSync(join(REPO, "js", f), "utf8")).join("\n;\n");
vm.runInContext(vecchio, sandbox, { filename: "app-di-oggi.js" });
Object.assign(sandbox, { __p: profumi, __l: layering, __c: consigli, __n: note, __d: diario });
vm.runInContext("profumi=__p; layering=__l; consigli=__c; noteChips=__n; diarioFoglio=__d; strati=indiceStrati();", sandbox);
const V = (codice) => vm.runInContext(codice, sandbox);

// ── la nuova, compilata al volo ──
const uscita = await build({
  stdin: {
    contents: `export * from "./src/viste/calcoli"; export { similiA, rinumera, numeraCatalogo } from "./src/profumo";`,
    resolveDir: APP, loader: "ts"
  },
  bundle: true, format: "esm", platform: "node", write: false, define: { "import.meta.env.BASE_URL": '"./"' }
});
const file = join(mkdtempSync(join(tmpdir(), "sillage-viste-")), "viste.mjs");
writeFileSync(file, uscita.outputFiles[0].text);
const N = await import(pathToFileURL(file).href);
globalThis.Date = DataFinta; // la nuova legge l'ora come la vecchia
const perId = new Map(profumi.map((p) => [p.id, p]));

// ── confronto ──
let controlli = 0,
  differenze = 0;
const uguale = (nome, prima, dopo) => {
  controlli++;
  const a = JSON.stringify(prima),
    b = JSON.stringify(dopo);
  if (a !== b) {
    differenze++;
    console.log(`✗ ${nome}\n    prima: ${a.slice(0, 400)}\n    dopo:  ${b.slice(0, 400)}`);
  }
};
const tutti = (s, re) => [...s.matchAll(re)];
const tra = (s, da, a) => {
  const i = s.indexOf(da);
  if (i < 0) return "";
  const j = a ? s.indexOf(a, i + da.length) : -1;
  return s.slice(i, j < 0 ? undefined : j);
};
const idsIn = (s) => tutti(s, /vaiAlProfumo\((\d+)\)/g).map((m) => +m[1]);
const virgola = (s) => String(s).replace(/(\d)\.(\d)/g, "$1,$2");

// NUMERI
for (const conCampioni of [false, true]) {
  V(`mappaCampioni=${conCampioni}; disegnaNumeri()`);
  const h = elemento("vista-numeri").innerHTML;
  const n = N.numeri(profumi, diario, new DataFinta());
  const etichetta = conCampioni ? " (mappa con i campioni)" : "";
  if (!conCampioni) {
    uguale("cifre principali", {
      boccette: +h.match(/eroe-n">(\d+)</)[1],
      campioni: +(h.match(/<b>(\d+)<\/b> campioni/) || [0, 0])[1],
      cloni: +h.match(/<b>(\d+)<\/b> cloni e dupe/)[1],
      marchi: +h.match(/<b>(\d+)<\/b> marchi/)[1],
      medie: tutti(h, /numero-n">([^<]+)/g).map((m) => m[1].trim())
    }, { boccette: n.boccette, campioni: n.campioni, cloni: n.cloni, marchi: n.marchi, medie: [n.mediaRating, n.mediaDurata, String(n.giornoESera)] });
    const leg = tutti(tra(h, ">Stagione<", "Occasione d'uso"), /<span><i style="background:[^"]*"><\/i>([^<]+)<b>(\d+)<\/b><em>(\d+)%<\/em><\/span>/g).map((m) => [m[1], +m[2], +m[3]]);
    uguale("stagioni e famiglie", leg, [...n.stagioni, ...n.famiglie].map((x) => [x.l, x.n, x.pct]));
    const usi = tutti(tra(h, "Occasione d'uso", "Accordi più presenti"), /<span class="asta-nome">(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/span><span>(\d+)(?: <em>\+(\d+)<\/em>)?<\/span>/g).map((m) => [m[1], +m[2], +(m[3] || 0)]);
    uguale("occasioni d'uso", usi, n.usi.map((u) => [u.l, u.n, u.m]));
    const acc = tutti(tra(h, "Accordi più presenti", "Rating Fragrantica"), /<span style="color:[^"]*">([^<]+)<\/span><span>(\d+)<\/span>/g).map((m) => [m[1], +m[2]]);
    uguale("accordi più presenti", acc, n.accordi.map((x) => [x.a, x.n]));
    const cl = (seg) => ({ ids: tutti(seg, /cl-riga[^"]*" onclick="vaiAlProfumo\((\d+)\)/g).map((m) => +m[1]), val: tutti(seg, /cl-val">([^<]+)/g).map((m) => virgola(m[1])) });
    uguale("classifica per rating", cl(tra(h, "Rating Fragrantica", "Durata dichiarata")), { ids: n.perRating.map((p) => p.id), val: n.perRating.map((p) => "★ " + p.rating.toFixed(1).replace(".", ",")) });
    uguale("classifica per durata", cl(tra(h, "Durata dichiarata", 'class="tavola')), { ids: n.perDurata.map((p) => p.id), val: n.perDurata.map((p) => p.longevita + "h") });
    const cloni = tra(h, "Cloni e i loro originali", 'id="storico"').split('<button class="clone"').slice(1).map((b) => [idsIn(b)[0], (b.match(/<em>([^<]+)<\/em>/) || [0, null])[1]]);
    uguale("cloni e originali", cloni, n.elencoCloni.map((c) => [c.p.id, c.orig]));
    const st = tra(h, 'id="storico"', "diario-tavola");
    const mesi = st.split('storico-mese">').slice(1).map((b) => [b.match(/^([^<]+)<span>(\d+)/)[1], idsIn(b)]);
    uguale("storico delle aggiunte", { mesi, partenza: +(st.match(/Più (\d+) dalla collezione/) || [0, 0])[1], novita: +(st.match(/Le (\d+) novità/) || [0, 0])[1] },
      { mesi: n.storico.map((m) => [m.mese, m.lista.map((p) => p.id)]), partenza: n.partenza, novita: n.novita });
    const d = tra(h, "diario-tavola");
    uguale("diario: cifre", tutti(tra(d, "diario-cifre", "Le più indossate"), /<b>(\d+)<\/b>/g).map((m) => +m[1]), [n.diario.questoMese, n.diario.usati, n.diario.maiSegnate]);
    uguale("diario: le più indossate", cl(tra(d, "Le più indossate", "Da riprendere")), { ids: n.diario.usate.map((x) => x.p.id), val: n.diario.usate.map((x) => x.n + "×") });
    const quandoFu = (g) => (g === 0 ? "oggi" : g === 1 ? "ieri" : g < 45 ? `${g} giorni fa` : g < 365 ? `${Math.round(g / 30)} mesi fa` : "più di un anno fa");
    const rip = tra(d, "Da riprendere", "Per stagione");
    uguale("diario: da riprendere", { ids: idsIn(rip), nota: tutti(rip, /tessera-sotto">([^<]+)/g).map((m) => m[1]) },
      { ids: n.diario.dimenticate.map((x) => x.p.id), nota: n.diario.dimenticate.map((x) => (x.g === null ? "mai" : quandoFu(x.g))) });
    const ps = tra(d, "Per stagione", "Rotazione").split("stag-riga").slice(1).map((r) => [r.match(/stag-nome">([^<]+)<small>(\d+)/).slice(1).join(" "), idsIn(r), tutti(r, /<small>(\d+)×/g).map((m) => +m[1])]);
    uguale("diario: per stagione", ps, n.diario.perStagione.map((x) => [x.s.replace(/^./, (c) => c.toUpperCase()) + " " + x.tot, x.top.map((y) => y.id), x.top.map((y) => y.n)]));
    const rot = d.match(/(\d+) boccette diverse su (\d+)/);
    uguale("diario: rotazione del mese", [+rot[1], +rot[2]], [n.diario.rotazione.diverse, n.diario.rotazione.su]);
  }
  const mp = tra(h, "mappa-tavola", "</svg>");
  const m = N.mappa(profumi, conCampioni);
  uguale("mappa olfattiva: punti" + etichetta, tutti(mp, /onclick="vaiAlProfumo\((\d+)\)"><title>[^<]*<\/title>\s*<circle cx="([\d.-]+)" cy="([\d.-]+)"/g).map((x) => [+x[1], x[2], x[3]]),
    m.punti.map((x) => [x.p.id, x.x.toFixed(1), x.y.toFixed(1)]));
  const nota = h.match(/mappa-nota">(.*?) Tocca/)[1];
  uguale("mappa olfattiva: zone vuote" + etichetta, nota, m.vuote.length ? `Nessuna boccetta tra le ${m.vuote.join(", tra le ")}.` : "Ogni zona ha almeno una boccetta.");
}

// GUIDA, per ogni occasione e per le due stagioni
for (const stagione of ["ai", "pe"]) {
  // la stagione in corso la decide l'orologio: per primavera/estate lo si sposta al 15 maggio
  ORA = new VeraData(2026, stagione === "pe" ? 4 : 10, stagione === "pe" ? 15 : 13, 12, 0).getTime();
  for (const s of N.SEZIONI_GUIDA) {
    V(`occasioneGuida=${JSON.stringify(s.k)}; disegnaGuida()`);
    const h = elemento("vista-guida").innerHTML;
    const g = N.guida(profumi, s.k, stagione);
    const gruppi = h.split(/<(?:div|details) class="os-gruppo[" ]/).slice(1).map((b) => [b.match(/<span class="incisa">([^<]+)<\/span>/)[1], idsIn(b), tutti(b, /tessera-sotto">([^<]+)/g).map((m) => m[1])]);
    uguale(`guida ${s.k} (${stagione})`, { conta: tutti(h, /occasione-q">(\d+)</g).map((m) => +m[1]), si: +h.match(/os-conto"><b>(\d+)/)[1], gruppi },
      { conta: g.conta.map((x) => x.n), si: g.si, gruppi: g.gruppi.map((x) => [x.etichetta, x.lista.map((y) => y.p.id), x.lista.map((y) => y.nota)]) });
  }
}

ORA = new VeraData(2026, 10, 13, 12, 0).getTime();

// LAYERING
const numeri = N.numeraCatalogo(profumi);
layering.forEach((l, i) => {
  const a = V(`(r=>({sotto:r.sotto&&r.sotto.id,sopra:r.sopra&&r.sopra.id,dSotto:r.dSotto,dSopra:r.dSopra,desc:r.desc}))(partiRicetta(layering[${i}]))`);
  const b = N.partiRicetta(l, perId);
  uguale(`ricetta ${i + 1}`, a, { sotto: b.sotto && b.sotto.id, sopra: b.sopra && b.sopra.id, dSotto: b.dSotto, dSopra: b.dSopra, desc: b.desc });
  for (const campo of ["s", "come", "ris", "perche", "quando"])
    uguale(`ricetta ${i + 1}: ${campo} rinumerato`, V(`rinumera(layering[${i}].${campo})`), N.rinumera(l[campo], numeri).replace(/Nº /g, "№ "));
});
uguale("indice delle ricette per profumo", JSON.stringify([...V("indiceStrati()").entries()]), JSON.stringify([...N.indiceStrati(layering).entries()]));

// ACQUISTI
V("disegnaAcquisti()");
{
  const h = elemento("vista-acquisti").innerHTML;
  const a = N.acquisti(consigli, profumi);
  const fin = tra(h, "Stanno finendo", "riepilogo");
  uguale("acquisti: stanno finendo", { ids: idsIn(fin), nota: tutti(fin, /tessera-sotto">([^<]+)/g).map((m) => m[1]) },
    { ids: a.finendo.map((p) => p.id), nota: a.finendo.map((p) => ({ 100: "piena", 90: "usata poco", 75: "tre quarti", 50: "mezza", 25: "un quarto", 10: "in fine", 0: "finita" })[[100, 90, 75, 50, 25, 10, 0].reduce((x, y) => (Math.abs(y - p.residuoPct) < Math.abs(x - p.residuoPct) ? y : x))]) });
  uguale("acquisti: riepilogo", tutti(tra(h, "riepilogo", "divisorio"), /<b>(\d+)<\/b>/g).map((m) => +m[1]), [a.lacune, a.idee, a.nChiusi]);
  uguale("acquisti: lacune aperte", tutti(h, /id="acq-(\d+)"/g).map((m) => +m[1]), a.aperte.map((c) => consigli.indexOf(c)));
  consigli.forEach((c, i) => c.voci.forEach((v, j) => uguale(`acquisti: ${i + 1}.${j + 1} già in casa`, V(`(p=>p&&p.id)(giaInCasa(consigli[${i}].voci[${j}].t))`) ?? null, N.giaInCasa(v.t, profumi)?.id ?? null)));
  consigli.forEach((c, i) => {
    uguale(`acquisti: ${i + 1} lacuna rinumerata`, V(`rinumera(consigli[${i}].gap)`), N.rinumera(c.gap, numeri).replace(/Nº /g, "№ "));
  });
}

// SOMIGLIANZE e MAPPA (posizioni grezze)
profumi.forEach((p, i) => {
  const a = V(`similiA(profumi[${i}]).map(x=>[x.q.id,Math.round(x.v*1e9)])`);
  uguale(`somiglia a: ${p.name}`, a, N.similiA(p, profumi).map((x) => [x.q.id, Math.round(x.v * 1e9)]));
  uguale(`posizione olfattiva: ${p.name}`, V(`posizioneOlfattiva(profumi[${i}])`), N.posizioneOlfattiva(p));
});

// CONFRONTO: coppie e terne
const terne = [[ids[0], ids[1]], [ids[16], ids[33]], [ids[2], ids[10], ids[25]], [ids[26], ids[32], ids[23]], [ids[13], ids[14], ids[15]]];
for (const tr of terne) {
  V(`insiemeConfronto=new Set(${JSON.stringify(tr)}); disegnaConfronto()`);
  const h = elemento("cf-contenuto").innerHTML;
  const lista = tr.map((id) => perId.get(id));
  const c = N.confronto(lista);
  const com = tra(h, "cf-comune", "cf-ruota");
  const righe = (eti, dopo) => tutti(tra(h, `cf-eti">${eti}</div>`, `cf-eti">${dopo}</div>`), /cf-cella( meglio)?"/g).map((m) => !!m[1]);
  uguale(`confronto ${tr.join("+")}`, {
    acc: tutti(com, /class="accordo"[^>]*>([^<]+)</g).map((m) => m[1]),
    note: tutti(com, /nota-c"><i>[^<]*<\/i>([^<]+)</g).map((m) => m[1]),
    rating: righe("Rating", "Longevità"),
    durata: righe("Longevità", "Stagione"),
    noteRiga: tra(h, 'cf-eti">Note</div>', "Quando indossarlo").split('cf-cella cf-note').slice(1).map((b) => tutti(b, /<\/i>([^<]+)</g).map((m) => m[1]))
  }, {
    acc: c.accComuni, note: c.noteComuni,
    rating: lista.map((p) => !!(p.rating && p.rating === c.megR)),
    durata: lista.map((p) => !!(p.longevita && p.longevita === c.megL)),
    noteRiga: lista.map((p) => N.notePerConfronto(p))
  });
}

console.log(`\n${controlli} controlli, ${differenze} differenze (${profumi.length} profumi, ${layering.length} ricette, ${consigli.length} consigli, ${process.argv.includes("--ponte") ? "dal ponte" : "da data/*.json"}).`);
console.log("Differenze volute, normalizzate: virgola nei numeri, «Nº» invece di «№».");
process.exit(differenze ? 1 : 0);
