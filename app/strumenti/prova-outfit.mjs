/* Prova del profumo per l'outfit di CheMetto (ponte/outfit.ts), senza rete e senza ponte.

   Si lancia dalla cartella app/:   node strumenti/prova-outfit.mjs

   1. PRIMA/DOPO: con un outfit neutro (nessun colore, o solo grigi) la classifica deve essere IDENTICA a quella
      di Consigliami (candidati di app/src/consiglio.ts, come la chiama l'app di Sillage), con gli stessi
      punteggi. Casi: 4 date × 3 ore × 7 occasioni × oggi/domani × con e senza meteo.
   2. L'OUTFIT NON RIBALTA: con outfit di colori diversi un profumo passa davanti a un altro solo se i due
      punteggi di Sillage distano meno di SOGLIA; nessun profumo sparisce o si aggiunge.
   3. Le situazioni di CheMetto, l'ora del telefono (fuso) e i toni dei colori.
   4. I consigli: fino a QUANTI, il primo sempre, gli altri solo se validi (non fuori stagione, ecc.). Il profumo di
      ogni proposta (campo outfit): sempre uno dei consigli, il primo per le proposte neutre. In palestra d'autunno
      un solo valido: un solo consiglio.
   Esce con codice 1 se qualcosa non torna. */
process.env.TZ = "UTC"; // come il Worker di Cloudflare (ponte/outfit.ts, «L'ORA»)
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = join(QUI, "..");
const REPO = join(APP, "..");
const profumi = JSON.parse(readFileSync(join(REPO, "data", "profumi.json"), "utf8"))
  .filter((p) => String(p.attivo ?? "si") !== "no")
  .map((p) => ({ ...p, accordi: Array.isArray(p.accordi) ? p.accordi : [], note: p.note ?? "" }));

const uscita = await build({
  stdin: { contents: `export * from "../ponte/outfit"; export { candidati, OCCASIONI } from "./src/consiglio";`, resolveDir: APP, loader: "ts" },
  bundle: true, format: "esm", platform: "node", write: false,
  define: { "import.meta.env.BASE_URL": '"./"' }
});
const cartella = mkdtempSync(join(tmpdir(), "prova-outfit-"));
writeFileSync(join(cartella, "outfit.mjs"), uscita.outputFiles[0].text);
const M = await import(pathToFileURL(join(cartella, "outfit.mjs")).href);

// ── l'orologio finto: new Date() e Date.now() rispondono con l'ora del caso ──
const VeraData = Date;
let ORA = VeraData.now();
globalThis.Date = class extends VeraData {
  constructor(...a) { if (a.length) super(...a); else super(ORA); }
  static now() { return ORA; }
};

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
function meteoFinto(inizio, base, umid, pioggiaDalle) {
  const ore = [], tramonti = [], d0 = new VeraData(inizio);
  d0.setHours(0, 0, 0, 0);
  for (let g = 0; g < 8; g++) {
    for (let h = 0; h < 24; h++) {
      const d = new VeraData(d0); d.setDate(d0.getDate() + g); d.setHours(h);
      const T = Math.round(base + 6 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + (g % 3) - 1);
      const piove = pioggiaDalle !== null && h >= pioggiaDalle && h < pioggiaDalle + 4;
      ore.push({ t: iso(d), T, P: T - 1, u: umid, pp: piove ? 70 : 10, mm: piove ? 0.6 : 0, c: piove ? 61 : 2 });
    }
    const s = new VeraData(d0); s.setDate(d0.getDate() + g); s.setHours(17, 0);
    tramonti.push(iso(s).slice(0, 14) + "00");
  }
  const o = ore.find((x) => new VeraData(x.t).getTime() <= inizio && new VeraData(x.t).getTime() > inizio - 36e5) ?? ore[0];
  return { quando: inizio, temperatura: o.T, percepita: o.P, umidita: o.u, precipitazioni: o.mm, codice: o.c, tramonto: tramonti[0], tramonti, ore };
}

let errori = 0, casi = 0;
const no = (cosa, d = "") => { errori++; if (errori <= 15) console.log("  NO!  " + cosa + (d ? " — " + d : "")); };
const ids = (l) => l.map((c) => c.p.id).join(",");

// Le situazioni di CheMetto che danno ogni occasione di Sillage, per provarle tutte
const PER_OCC = {};
for (const [sit, [occ, mo]] of Object.entries(M.DA_CHEMETTO)) (PER_OCC[occ] ??= []).push([sit, mo]);
PER_OCC.casa = [[null, "giorno"]]; // «casa» CheMetto non ce l'ha: la si chiede come occasione
PER_OCC.festivita = [[null, "sera"]];

const DATE = ["2026-01-15", "2026-04-20", "2026-07-20", "2026-10-25"];
const BASE = { "01": [3, 75, null], "04": [15, 60, 14], "07": [29, 75, null], "10": [13, 80, 9] };
const ORE = [8, 13, 20];
const GRIGI = ["#8a8b8d", "#55565a"];

// ── 1. prima/dopo con l'outfit neutro ──
for (const data of DATE) for (const ora of ORE) for (const conMeteo of [false, true]) {
  ORA = new VeraData(`${data}T${pad(ora)}:00:00Z`).getTime();
  const [b, u, pd] = BASE[data.slice(5, 7)];
  const meteo = conMeteo ? meteoFinto(ORA, b, u, pd) : null;
  for (const [occ] of M.OCCASIONI) for (const quando of ["oggi", "domani"]) for (const [sit, mo] of PER_OCC[occ]) {
    // come lo chiede l'app di Sillage: «Oggi» = adesso, «Stasera» = dalle 19, «Domani» = l'ora dell'occasione
    const qSillage = quando === "domani" ? "domani" : mo === "sera" && ora < 19 ? "stasera" : "oggi";
    if (quando === "domani" && mo === "sera") continue; // Consigliami non ha «domani sera»: provato sotto, al punto 3
    const sillage = M.candidati(profumi, occ, qSillage, { meteo });
    const r = { situazione: sit, occasione: sit ? null : occ, momento: sit ? null : mo, quando, fuso: 0 };
    for (const colori of [undefined, [], GRIGI]) {
      casi++;
      const fuori = M.consiglioPerOutfit(profumi, { ...r, colori }, meteo, ORA);
      const att = ids(sillage);
      if (fuori.occasione !== occ) no(`${data} ${ora}:00 ${sit}: occasione ${fuori.occasione}, attesa ${occ}`);
      if (fuori.classifica.join(",") !== att) no(`${data} ${ora}:00 ${occ} ${quando} ${sit ?? ""} colori=${JSON.stringify(colori)}`, `${fuori.classifica.slice(0, 5)} ≠ ${att.split(",").slice(0, 5)}`);
      const s1 = sillage.filter((c, i) => i === 0 || c.valido).slice(0, M.QUANTI).map((c) => Math.round(c.s * 100) / 100).join(",");
      if (fuori.consigli.map((c) => c.punteggio).join(",") !== s1) no(`${data} ${ora}:00 ${occ}: punteggi diversi`);
      if (fuori.consigli.some((c) => c.abbinamento)) no(`${data} ${ora}:00 ${occ}: frase d'abbinamento con un outfit neutro`);
    }
  }
}
console.log(`1. outfit neutro: ${casi} casi confrontati con Consigliami`);

// ── 2. con i colori l'outfit decide solo i pari merito ──
const PALETTE = ["#1c1c1c", "#34373a", "#f4f4f2", "#ece3cf", "#d3c2a0", "#b08857", "#8e4f2c", "#5e4232", "#3a2a23", "#1f2b47",
  "#33496b", "#3a5f96", "#7f9bbd", "#9cc3e6", "#24452f", "#6b6c3e", "#a9dcc5", "#6a1f2d", "#c03a2e", "#ef7b65", "#f2c6cf", "#c9b6e4"];
let seme = 7;
const caso = () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
let cambiati = 0, primoCambiato = 0, giri = 0, frasi = 0;
for (const data of DATE) for (const ora of ORE) {
  ORA = new VeraData(`${data}T${pad(ora)}:00:00Z`).getTime();
  const [b, u, pd] = BASE[data.slice(5, 7)];
  const meteo = meteoFinto(ORA, b, u, pd);
  for (const [occ] of M.OCCASIONI) for (let k = 0; k < 25; k++) {
    giri++;
    const colori = Array.from({ length: 3 + Math.floor(caso() * 3) }, () => PALETTE[Math.floor(caso() * PALETTE.length)]);
    const sillage = M.candidati(profumi, occ, "oggi", { meteo });
    const fuori = M.consiglioPerOutfit(profumi, { occasione: occ, momento: ora >= 19 ? "sera" : "giorno", quando: "oggi", fuso: 0, colori }, meteo, ORA);
    const s = new Map(sillage.map((c) => [c.p.id, c.s]));
    const pos = new Map(sillage.map((c, i) => [c.p.id, i]));
    if ([...fuori.classifica].sort().join() !== [...sillage.map((c) => c.p.id)].sort().join()) no(`${data} ${occ}: profumi diversi da Consigliami`);
    // per ogni coppia ribaltata: i due punteggi devono essere a pari merito
    for (let i = 0; i < fuori.classifica.length; i++) for (let j = i + 1; j < fuori.classifica.length; j++) {
      const a = fuori.classifica[i], bb = fuori.classifica[j];
      if (pos.get(a) > pos.get(bb) && s.get(bb) - s.get(a) >= M.SOGLIA) no(`${data} ${occ}: ${a} passa davanti a ${bb} con ${(s.get(bb) - s.get(a)).toFixed(2)} punti di distacco`);
    }
    if (fuori.classifica.join() !== sillage.map((c) => c.p.id).join()) cambiati++;
    if (fuori.classifica[0] !== sillage[0]?.p.id) {
      primoCambiato++;
      if (s.get(sillage[0].p.id) - s.get(fuori.classifica[0]) >= M.SOGLIA) no(`${data} ${occ}: il primo cambia oltre la soglia`);
    }
    if (fuori.consigli.some((c) => c.abbinamento)) frasi++;
  }
}
console.log(`2. ${giri} outfit a caso: classifica ritoccata ${cambiati} volte, primo diverso ${primoCambiato} volte (solo a pari merito), frase d'abbinamento ${frasi} volte`);

// ── 3. situazioni, ora del telefono, toni ──
const ok = (cosa, v, d = "") => (v ? null : no(cosa, d));
ORA = VeraData.parse("2026-11-17T17:30:00Z"); // in Italia le 18:30
let c = M.contesto({ situazione: "aperitivo", fuso: 60 }, ORA);
ok("aperitivo alle 18:30: dalle 19, quotidiano, sera", c.occ === "quotidiano" && c.mo === "sera" && c.da.getHours() === 19 && c.oggi === "2026-11-17", JSON.stringify(c));
c = M.contesto({ situazione: "lavoro", fuso: 60 }, ORA);
ok("lavoro alle 18:30: adesso, ufficio", c.occ === "ufficio" && c.da.getHours() === 18 && c.da.getMinutes() === 30, JSON.stringify(c));
c = M.contesto({ situazione: "lavoro", quando: "domani", fuso: 60 }, ORA);
ok("lavoro domani: alle 8 del 18", c.da.getHours() === 8 && c.da.getDate() === 18, JSON.stringify(c));
c = M.contesto({ situazione: "ristorante", quando: "domani", fuso: 60 }, ORA);
ok("ristorante domani: alle 19 del 18, appuntamento", c.occ === "appuntamento" && c.da.getHours() === 19 && c.da.getDate() === 18, JSON.stringify(c));
c = M.contesto({ situazione: "sconosciuta", fuso: 60 }, VeraData.parse("2026-11-17T23:30:00Z"));
ok("dopo mezzanotte in Italia è già il 18; situazione sconosciuta = quotidiano", c.oggi === "2026-11-18" && c.occ === "quotidiano", JSON.stringify(c));
c = M.contesto({ occasione: "casa", momento: "sera", fuso: 120 }, VeraData.parse("2026-07-01T21:00:00Z"));
ok("d'estate (fuso 120) alle 23: adesso, casa", c.occ === "casa" && c.da.getHours() === 23, JSON.stringify(c));
const TONI = { "#1c1c1c": "scuro", "#1f2b47": "scuro", "#5e4232": "scuro-caldo", "#6a1f2d": "scuro-caldo", "#f4f4f2": "chiaro",
  "#9cc3e6": "chiaro", "#d3c2a0": "chiaro-caldo", "#ece3cf": "chiaro-caldo", "#f2c6cf": "pastello", "#2f7a4d": "verde",
  "#3a5f96": "blu", "#b08857": "caldo", "#8a8b8d": null, "rosso": null };
for (const [hex, t] of Object.entries(TONI)) ok(`tono di ${hex}: ${t}`, M.tonoDi(hex) === t, String(M.tonoDi(hex)));
ok("solo grigi: outfit neutro", M.richiestaOutfit(GRIGI) === null);
const vuoto = M.consiglioPerOutfit([], { situazione: "lavoro", fuso: 60 }, null, ORA);
ok("nessun profumo: nessun consiglio, nessun errore", vuoto.consigli.length === 0 && vuoto.classifica.length === 0);

// ── 4. i consigli mandati e il profumo di ogni proposta: sempre uno dei consigli, i colori scelgono per ultimi ──
let proposte = 0, diversi = 0;
const quanti = {};
for (const data of DATE) for (const ora of ORE) {
  ORA = new VeraData(`${data}T${pad(ora)}:00:00Z`).getTime();
  const [b, u, pd] = BASE[data.slice(5, 7)];
  const meteo = meteoFinto(ORA, b, u, pd);
  for (const [occ] of M.OCCASIONI) {
    const outfit = Array.from({ length: 6 }, (_, i) => i === 0 ? [] : i === 1 ? GRIGI :
      Array.from({ length: 3 + Math.floor(caso() * 3) }, () => PALETTE[Math.floor(caso() * PALETTE.length)]));
    const r = { occasione: occ, momento: ora >= 19 ? "sera" : "giorno", quando: "oggi", fuso: 0 };
    const senza = M.consiglioPerOutfit(profumi, r, meteo, ORA);
    const con = M.consiglioPerOutfit(profumi, { ...r, outfit }, meteo, ORA);
    const tre = senza.consigli.map((c) => c.id);
    // i consigli: il primo di Sillage, poi solo i validi, al più QUANTI
    const lista = M.candidati(profumi, occ, M.contesto(r, ORA).da, { meteo });
    const attesi = lista.filter((c, i) => i === 0 || c.valido).slice(0, M.QUANTI).map((c) => c.p.id);
    if (tre.join() !== attesi.join()) no(`${data} ${ora}:00 ${occ}: consigli ${tre} invece di ${attesi}`);
    if (!tre.length || tre.length > M.QUANTI) no(`${data} ${occ}: ${tre.length} consigli`);
    if (tre.length < M.QUANTI && lista.filter((c, i) => i > 0 && c.valido).length >= M.QUANTI) no(`${data} ${occ}: meno consigli dei validi`);
    for (const c of lista) {
      const fuoriStagione = c.contro.some((t) => t.includes("fuori stagione")),
        sottoIVestiti = c.contro.some((t) => t.includes("solo 1 spray")),
        denso = c.contro.some((t) => t.includes("un denso pesa"));
      if (c.valido !== (c.s > 0 && !fuoriStagione && !sottoIVestiti && !denso)) no(`${data} ${occ}: id ${c.p.id} valido=${c.valido}`, c.contro.join("; "));
    }
    (quanti[occ] ??= []).push(tre.length);
    if (senza.perOutfit.length !== 0) no(`${data} ${occ}: perOutfit senza proposte`);
    if (con.consigli.map((c) => c.id).join() !== tre.join()) no(`${data} ${occ}: le proposte cambiano i consigli`);
    if (con.perOutfit.length !== outfit.length) no(`${data} ${occ}: perOutfit non ha una voce per proposta`);
    con.perOutfit.forEach((x, i) => {
      proposte++;
      if (!tre.includes(x.id)) no(`${data} ${occ}: proposta ${i} con un profumo fuori dai consigli`, String(x.id));
      if (i < 2 && (x.id !== tre[0] || x.abbinamento)) no(`${data} ${occ}: proposta neutra ${i} senza il primo di Sillage`, JSON.stringify(x));
      if (x.id !== tre[0]) diversi++;
    });
  }
}
console.log(`4. consigli mandati per occasione (12 momenti): ${Object.entries(quanti).map(([o, l]) => `${o} ${Math.min(...l)}–${Math.max(...l)}`).join(", ")}`);
console.log(`   ${proposte} proposte: profumo sempre tra i consigli mandati, diverso dal primo ${diversi} volte`);
{
  // meno di QUANTI validi: in palestra d'autunno (25 ottobre, ore 18, senza meteo) uno solo
  ORA = VeraData.parse("2026-10-25T08:00:00Z");
  const pal = M.consiglioPerOutfit(profumi, { situazione: "sport", quando: "domani", fuso: 0, outfit: [["#1c1c1c", "#5e4232"], ["#f4f4f2"]] }, null, ORA);
  const validi = M.candidati(profumi, "palestra", M.contesto({ situazione: "sport", quando: "domani", fuso: 0 }, ORA).da).filter((c) => c.valido).length;
  ok("palestra d'autunno: meno di 5 validi, solo quelli (il primo sempre)", validi < M.QUANTI && pal.consigli.length === Math.max(1, validi) &&
    pal.perOutfit.every((x) => pal.consigli.some((c) => c.id === x.id)), `${validi} validi, ${pal.consigli.map((c) => c.id)}`);
  console.log(`   palestra d'autunno: ${pal.consigli.length} consigli (${pal.consigli.map((c) => c.id)}), ${validi} validi`);
}
const nessunProfumo = M.consiglioPerOutfit([], { situazione: "lavoro", fuso: 60, outfit: [["#1c1c1c"]] }, null, ORA);
ok("nessun profumo: nessuna proposta con profumo", nessunProfumo.perOutfit.length === 0);

console.log(errori ? `ERRORI: ${errori}` : "prova del profumo per l'outfit: tutto ok");
process.exitCode = errori ? 1 : 0;
