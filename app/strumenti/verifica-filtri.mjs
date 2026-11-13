/* Verifica di filtri, scelte rapide e ordinamenti della Collezione: la nuova (src/viste/filtri.ts) contro l'app di
   oggi (js/collezione.js disegna(), selezione(), disegnaRapidi()), sugli stessi profumi.

   Si lancia dalla cartella app/:
     node strumenti/verifica-filtri.mjs            profumi da data/*.json
     node strumenti/verifica-filtri.mjs --ponte    profumi letti adesso dal ponte (sola lettura)

   Per ogni combinazione (vetrina × filtri × note × ricerca × ordinamento) si chiama disegna() dell'app di oggi e
   si leggono dall'HTML l'ordine delle teche, quante «Anche tra i campioni» e i contatori delle scelte rapide;
   poi si chiede lo stesso alla nuova. Orologio fermo (13/11/2026 alle 12, e alle 21 per «Adatti adesso»),
   niente meteo. Esce con codice 1 se trova una differenza. */
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(APP, "..");
let dati;
if (process.argv.includes("--ponte")) dati = await (await fetch("https://sillage.danilo-moro96.workers.dev/api")).json();
else dati = Object.fromEntries(["profumi", "layering", "consigli", "note"].map((n) => [n, JSON.parse(readFileSync(join(REPO, "data", n + ".json"), "utf8"))]));
const { profumi } = dati;

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

// ── l'app di oggi, con un DOM di cartone ──
const cartone = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "matches" ? false : cartone),
  apply: () => cartone,
  construct: () => cartone
});
const elementi = new Map();
const elemento = (id) => {
  if (!elementi.has(id))
    elementi.set(id, {
      id, innerHTML: "", textContent: "", style: {}, dataset: {}, disabled: false, offsetHeight: 0, offsetLeft: 0, offsetWidth: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {}, removeAttribute() {}, appendChild() {}, querySelector: (s) => elemento(id + " " + s), querySelectorAll: () => [],
      scrollIntoView() {}, focus() {}, closest: () => null, addEventListener() {},
      get firstChild() { return elemento(id + " primo"); }
    });
  return elementi.get(id);
};
const memoria = new Map();
const sandbox = {
  Date: DataFinta, console,
  document: new Proxy({}, {
    get: (_t, k) =>
      k === "getElementById" ? elemento : k === "querySelector" ? () => null : k === "querySelectorAll" ? () => [] : k === "addEventListener" ? () => {} : k === "documentElement" ? { style: { setProperty() {} } } : cartone
  }),
  window: cartone, navigator: cartone, location: cartone, history: cartone,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  addEventListener() {}, getComputedStyle: () => ({ getPropertyValue: () => "" }),
  requestAnimationFrame: () => 0, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {},
  fetch: () => Promise.reject(new Error("niente rete")),
  localStorage: { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) },
  IntersectionObserver: class { observe() {} }, ResizeObserver: class { observe() {} },
  recensioni: (n) => String(n) // sta in js/app.js, che qui non si carica: serve solo al testo delle teche
};
vm.createContext(sandbox);
const vecchio = ["dati.js", "collezione.js", "consigliami.js", "viste.js", "diario.js"].map((f) => readFileSync(join(REPO, "js", f), "utf8")).join("\n;\n");
vm.runInContext(vecchio, sandbox, { filename: "app-di-oggi.js" });
Object.assign(sandbox, { __p: profumi, __l: dati.layering, __c: dati.consigli, __n: dati.note || [] });
vm.runInContext("profumi=__p; layering=__l; consigli=__c; noteChips=__n; diarioFoglio=[];", sandbox);
const V = (codice) => vm.runInContext(codice, sandbox);

// ── la nuova ──
const uscita = await build({
  stdin: { contents: `export * from "./src/viste/filtri"; export { adesso } from "./src/profumo";`, resolveDir: APP, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false, define: { "import.meta.env.BASE_URL": '"./"' }
});
const file = join(mkdtempSync(join(tmpdir(), "sillage-filtri-")), "filtri.mjs");
writeFileSync(file, uscita.outputFiles[0].text);
const N = await import(pathToFileURL(file).href);
globalThis.Date = DataFinta;

// ── le combinazioni ──
const tuttiFiltri = [...N.FILTRI_VALIDI];
const insiemi = [
  [], ...tuttiFiltri.map((f) => [f]),
  ["verde", "ufficio"], ["adesso", "dupe"], ["pe", "sera"], ["rosso", "appuntamento"], ["ai", "formale"], ["blu", "verde"], ["giorno", "quotidiano", "pe"]
];
const conNote = [
  [[], ["vetiver"]], [[], ["cuoio", "vaniglia"]], [["ufficio"], ["ambra"]], [["rosso"], ["oud", "tabacco"]]
];
const ricerche = ["hermes", "gio", "vetiver", "sauvage", "encre", "NOIRE", "xyz"];
const casi = [];
for (const v of ["boccette", "campioni"])
  for (const o of N.ORDINAMENTI.map((x) => x.k)) {
    for (const f of insiemi) casi.push({ v, f, n: [], q: "", o });
    for (const [f, n] of conNote) casi.push({ v, f, n, q: "", o });
    for (const q of ricerche) casi.push({ v, f: [], n: [], q, o });
  }

let controlli = 0,
  differenze = 0;
const uguale = (nome, a, b) => {
  controlli++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    differenze++;
    if (differenze <= 15) console.log(`✗ ${nome}\n    prima: ${JSON.stringify(a).slice(0, 300)}\n    dopo:  ${JSON.stringify(b).slice(0, 300)}`);
  }
};
for (const ora of [12, 21]) {
  ORA = new VeraData(2026, 10, 13, ora, 0).getTime();
  for (const c of casi) {
    if (ora === 21 && !c.f.includes("adesso") && c.f.length) continue; // la sera conta solo per «Adatti adesso»
    V(`vetrina=${JSON.stringify(c.v)}; filtriAttivi=new Set(${JSON.stringify(c.f)}); noteAttive=new Set(${JSON.stringify(c.n)}); testoCerca=${JSON.stringify(c.q)}; ordine=${JSON.stringify(c.o)}; disegna();`);
    const h = elemento("vista-collezione").innerHTML;
    const ids = [...h.matchAll(/id="teca-(\d+)"/g)].map((m) => +m[1]);
    const nExtra = +(h.match(/Anche tra i campioni · (\d+)/) || [0, 0])[1];
    const rap = Object.fromEntries([...elemento("rapidi").innerHTML.matchAll(/commutaFiltro\('(\w+)'\)" aria-pressed="(true|false)">[\s\S]*?<span class="q">(\d+)<\/span>/g)].map((m) => [m[1], +m[3]]));
    const s = { filtri: new Set(c.f), note: new Set(c.n), cerca: c.q };
    const a = N.adesso(new DataFinta(), null);
    const r = N.selezione(profumi, c.v, s, c.o, a);
    const nome = `${c.v} · filtri ${c.f.join("+") || "—"} · note ${c.n.join("+") || "—"} · «${c.q}» · ${c.o} · ore ${ora}`;
    uguale(nome, { ids, nExtra }, { ids: [...r.lista, ...r.extra].map((p) => p.id), nExtra: r.extra.length });
    const rapidi = ["adesso", "ufficio", "appuntamento", "sera", "dupe", "recenti"];
    if (!("ufficio" in rap)) uguale(nome + " · contatori letti", "letti", "mancanti"); // le scelte rapide devono esserci sempre
    uguale(nome + " · contatori", Object.fromEntries(rapidi.filter((k) => k in rap).map((k) => [k, rap[k]])), Object.fromEntries(rapidi.filter((k) => k in rap).map((k) => [k, N.quantiCon(profumi, c.v, s, a, k)])));
  }
}
console.log(`\n${controlli} controlli, ${differenze} differenze (${casi.length} combinazioni per ora, ${profumi.length} profumi, ${process.argv.includes("--ponte") ? "dal ponte" : "da data/*.json"}).`);
process.exit(differenze ? 1 : 0);
