/* Prima/dopo del punteggio di Consigliami: la classifica dell'app di oggi (js/consigliami.js) e quella
   della nuova (app/src/consiglio.ts), con gli stessi profumi, la stessa ora e lo stesso meteo finto.

   Si lancia dalla cartella app/:
     node strumenti/prima-dopo.mjs            profumi da data/profumi.json (la copia notturna del repo)
     node strumenti/prima-dopo.mjs --ponte    profumi letti adesso dal ponte

   Casi: 4 date in stagioni diverse × mattina e sera × tutte e 7 le occasioni × oggi/domani × con e senza
   meteo. Per ogni caso confronta l'ordine, il punteggio e i motivi di ogni profumo. Esce con codice 1 se
   trova una differenza non dichiarata. Differenze volute (dichiarate qui sotto, VOLUTE):
   - il voto nei motivi si scrive con la virgola («★ 4,3») come nel resto della nuova app; prima «★ 4.3». */
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { build } from "esbuild";

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = join(QUI, "..");
const REPO = join(APP, "..");

const VOLUTE = [[/★ (\d),(\d)/g, "★ $1.$2"]];
const normalizza = (t) => VOLUTE.reduce((s, [re, a]) => s.replace(re, a), t);

// ── i dati ────────────────────────────────────────────────────────────────
let profumi;
if (process.argv.includes("--ponte")) {
  profumi = (await (await fetch("https://sillage.danilo-moro96.workers.dev/api")).json()).profumi;
} else profumi = JSON.parse(readFileSync(join(REPO, "data", "profumi.json"), "utf8"));

// ── l'orologio finto: new Date() e Date.now() rispondono con l'ora del caso ──
const VeraData = Date;
let ORA = VeraData.now();
class DataFinta extends VeraData {
  constructor(...a) {
    if (a.length) super(...a);
    else super(ORA);
  }
  static now() {
    return ORA;
  }
}

// ── il meteo finto: otto giorni ora per ora, con caldo umido d'estate e pioggia d'autunno ──
const pad = (n) => String(n).padStart(2, "0");
const isoLocale = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
function meteoFinto(inizio, base, umid, pioggiaDalle, tramontoOra) {
  const ore = [],
    tramonti = [];
  const d0 = new VeraData(inizio);
  d0.setHours(0, 0, 0, 0);
  for (let g = 0; g < 8; g++) {
    for (let h = 0; h < 24; h++) {
      const d = new VeraData(d0);
      d.setDate(d0.getDate() + g);
      d.setHours(h);
      const T = Math.round(base + 6 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + (g % 3) - 1);
      const piove = pioggiaDalle !== null && h >= pioggiaDalle && h < pioggiaDalle + 4;
      ore.push({ t: isoLocale(d), T, P: T - 1, u: umid, pp: piove ? 70 : 10, mm: piove ? 0.6 : 0, c: piove ? 61 : 2 });
    }
    const s = new VeraData(d0);
    s.setDate(d0.getDate() + g);
    s.setHours(Math.floor(tramontoOra), Math.round((tramontoOra % 1) * 60));
    tramonti.push(`${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}T${pad(s.getHours())}:${pad(s.getMinutes())}`);
  }
  const adessoOra = ore.find((o) => new VeraData(o.t).getTime() <= inizio && new VeraData(o.t).getTime() > inizio - 36e5) ?? ore[0];
  return {
    quando: inizio,
    temperatura: adessoOra.T,
    percepita: adessoOra.P,
    umidita: adessoOra.u,
    precipitazioni: adessoOra.mm,
    codice: adessoOra.c,
    tramonto: tramonti[0],
    tramonti,
    ore
  };
}

// ── l'app di oggi, caricata così com'è in una sandbox con un DOM di cartone ──
const cartone = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "matches" ? false : cartone),
  apply: () => cartone,
  construct: () => cartone
});
const memoria = new Map();
const sandbox = {
  Date: DataFinta,
  console,
  document: cartone,
  window: cartone,
  navigator: cartone,
  location: cartone,
  history: cartone,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  addEventListener() {},
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  requestAnimationFrame: () => 0,
  setTimeout: () => 0,
  setInterval: () => 0,
  clearTimeout() {},
  fetch: () => Promise.reject(new Error("niente rete nel prima/dopo")),
  localStorage: { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, String(v)), removeItem: (k) => memoria.delete(k) },
  IntersectionObserver: class { observe() {} },
  ResizeObserver: class { observe() {} }
};
vm.createContext(sandbox);
const vecchio = ["dati.js", "collezione.js", "consigliami.js"].map((f) => readFileSync(join(REPO, "js", f), "utf8")).join("\n;\n");
vm.runInContext(vecchio, sandbox, { filename: "app-di-oggi.js" });
sandbox.__profumi = profumi;
vm.runInContext("profumi = __profumi; diarioFoglio = [];", sandbox);
const prima = (occ, quando, meteo) => {
  sandbox.__meteo = meteo;
  vm.runInContext("meteo = __meteo", sandbox);
  return {
    probabile: vm.runInContext(`occasioneProbabile(${JSON.stringify(quando)})`, sandbox),
    lista: sandbox.candidatiOggi(occ, quando).map((c) => ({ id: c.p.id, s: c.s, pro: [...c.pro], contro: [...c.contro] }))
  };
};

// ── la nuova, compilata al volo con esbuild (lo stesso di Vite) ──
const uscita = await build({
  entryPoints: [join(APP, "src", "consiglio.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  define: { "import.meta.env.BASE_URL": '"./"' }
});
const cartella = mkdtempSync(join(tmpdir(), "sillage-prima-dopo-"));
const file = join(cartella, "consiglio.mjs");
writeFileSync(file, uscita.outputFiles[0].text);
const nuovo = await import(pathToFileURL(file).href);
const dopo = (occ, quando, meteo) => {
  globalThis.Date = DataFinta;
  try {
    return {
      probabile: nuovo.occasioneProbabile(quando, meteo),
      lista: nuovo.candidati(profumi, occ, quando, { meteo, maiIndossato: () => true }).map((c) => ({
        id: c.p.id,
        s: c.s,
        pro: c.pro.map(normalizza),
        contro: c.contro.map(normalizza)
      }))
    };
  } finally {
    globalThis.Date = VeraData;
  }
};

// ── i casi ────────────────────────────────────────────────────────────────
const DATE = [
  { nome: "inverno, 15 gennaio", g: [2026, 0, 15], base: 4, umid: 80, pioggia: null, tramonto: 17.0 },
  { nome: "primavera, 22 aprile", g: [2026, 3, 22], base: 15, umid: 60, pioggia: 16, tramonto: 20.1 },
  { nome: "estate, 16 luglio", g: [2026, 6, 16], base: 28, umid: 75, pioggia: null, tramonto: 21.2 },
  { nome: "autunno, 21 ottobre", g: [2026, 9, 21], base: 16, umid: 70, pioggia: 14, tramonto: 18.4 }
];
const ORE = [
  ["mattina", 9, 0],
  ["sera", 20, 30]
];
const OCCASIONI = ["ufficio", "quotidiano", "appuntamento", "formale", "casa", "festivita", "palestra"];

let casi = 0,
  differenze = 0;
const righe = [];
for (const d of DATE)
  for (const [nomeOra, h, m] of ORE) {
    ORA = new VeraData(d.g[0], d.g[1], d.g[2], h, m).getTime();
    const finto = meteoFinto(ORA, d.base, d.umid, d.pioggia, d.tramonto);
    for (const [nomeMeteo, meteo] of [
      ["meteo finto", finto],
      ["senza meteo", null]
    ])
      for (const quando of ["oggi", "domani"])
        for (const occ of OCCASIONI) {
          casi++;
          const a = prima(occ, quando, meteo),
            b = dopo(occ, quando, meteo);
          const caso = `${d.nome}, ${nomeOra} · ${quando} · ${occ} · ${nomeMeteo}`;
          const errori = [];
          if (a.probabile !== b.probabile) errori.push(`occasione probabile: prima ${a.probabile}, dopo ${b.probabile}`);
          if (a.lista.length !== b.lista.length) errori.push(`quanti: prima ${a.lista.length}, dopo ${b.lista.length}`);
          a.lista.forEach((x, i) => {
            const y = b.lista[i];
            if (!y || x.id !== y.id) return errori.push(`posto ${i + 1}: prima id ${x.id}, dopo id ${y?.id}`);
            if (Math.abs(x.s - y.s) > 1e-9) errori.push(`id ${x.id}: punteggio ${x.s} contro ${y.s}`);
            if (JSON.stringify(x.pro) !== JSON.stringify(y.pro)) errori.push(`id ${x.id}: motivi a favore diversi`);
            if (JSON.stringify(x.contro) !== JSON.stringify(y.contro)) errori.push(`id ${x.id}: motivi contro diversi`);
          });
          if (errori.length) {
            differenze++;
            righe.push(`✗ ${caso}\n    ${errori.slice(0, 5).join("\n    ")}`);
          } else if (occ === "ufficio" || occ === "appuntamento")
            righe.push(`✓ ${caso}: ${a.lista.slice(0, 3).map((x) => profumi.find((p) => p.id === x.id).name).join(", ")}`);
        }
  }

console.log(righe.join("\n"));
console.log(`\n${casi} casi, ${differenze} con differenze (${profumi.length} profumi, ${process.argv.includes("--ponte") ? "dal ponte" : "da data/profumi.json"}).`);
console.log("Differenze volute, escluse dal confronto: il voto nei motivi con la virgola («★ 4,3»).");
process.exit(differenze ? 1 : 0);
