/* Sillage — il ponte tra l'app e il database (Cloudflare Worker + D1).

   Il database è l'originale di tutto: catalogo, diario, residuo. Il foglio
   Google ne è una copia da guardare, riscritta dopo ogni modifica.

   Parla come il Web App di Apps Script, così l'app non ha dovuto cambiare:
     GET  /api                         tutto, senza il diario (diarioChiuso: true)
     POST /api?azione=leggi            tutto, diario compreso, con la chiave
     POST /api?azione=diario&op=...    metti, togli o nota, con la chiave
     POST /api?azione=residuo&id&valore  quanto resta in una boccetta, con la chiave
     POST /api?azione=modifica         aggiunte e correzioni al catalogo (dati=JSON), con la chiave
     POST /api?azione=sincronizza      riscrive subito la copia nel foglio, con la chiave
     POST /api?azione=importa&conferma=si  ricopia il catalogo DAL foglio (solo per rimediare), con la chiave
     GET  /api?stato=1                 a che punto è la copia nel foglio
   La chiave arriva nel corpo della richiesta (chiave=...), mai nell'indirizzo.

   Il catalogo sta nel database con le stesse colonne del foglio (tab Profumi,
   Layering, Consigli, ConsigliVoci, Note), una riga per tab con tutte le sue
   righe: il piano gratuito concede 50 operazioni per richiesta, e così ne
   bastano poche. Da lì il ponte ricava il JSON per l'app, con le stesse
   regole di Codice.gs, e lo tiene pronto in `stato.vista`.

   Le tabelle nascono da sole alla prima richiesta, e la prima volta il
   catalogo viene copiato dal foglio: nessun passo a mano. */

const OCCASIONI = ["ufficio", "quotidiano", "appuntamento", "formale", "casa", "festivita", "palestra"];
const RESIDUI = [100, 90, 75, 50, 25, 10, 0];
const TABS = ["Profumi", "Layering", "Consigli", "ConsigliVoci", "Note"];
const COLONNE_DIARIO = ["data", "id", "profumo", "t", "nota", "voto", "occasione", "momento"];
const MAX_GIORNO = 10;          // come il Web App: più di dieci voci in un giorno sono un errore

// ── RISPOSTE ──────────────────────────────────────────────────────────────
const INTESTAZIONI = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*"
};
const testo = (corpo, stato = 200) => new Response(corpo, { status: stato, headers: INTESTAZIONI });
const json = (o, stato = 200) => testo(JSON.stringify(o), stato);
// "sconosciuta:" come nel Web App: l'app tiene in coda una voce rifiutata con questa parola
const SENZA_CHIAVE = { errore: "chiave sconosciuta: manca o non e' quella giusta" };

// ── SCHEMA ────────────────────────────────────────────────────────────────
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tabelle (tab TEXT PRIMARY KEY, colonne TEXT NOT NULL, righe TEXT NOT NULL, aggiornato INTEGER)`,
  `CREATE TABLE IF NOT EXISTS diario (t TEXT PRIMARY KEY, data TEXT NOT NULL, id INTEGER NOT NULL,
     nota TEXT NOT NULL DEFAULT '', voto INTEGER, occasione TEXT NOT NULL DEFAULT '', momento TEXT NOT NULL DEFAULT '',
     tolta INTEGER NOT NULL DEFAULT 0, inviato INTEGER NOT NULL DEFAULT 1, aggiornato INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stato (chiave TEXT PRIMARY KEY, valore TEXT)`,
  // dalla versione di prima: le voci tolte aspettavano lì di essere mandate al foglio
  `DELETE FROM diario WHERE tolta = 1`
];
let schemaPronto = false;
async function schema(env) {
  if (schemaPronto) return;
  await env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)));
  schemaPronto = true;
}
const leggiStato = async (db, k) => (await db.prepare("SELECT valore FROM stato WHERE chiave = ?").bind(k).first("valore")) ?? null;
const scriviStato = (db, k, v) => db.prepare("INSERT INTO stato (chiave, valore) VALUES (?, ?) ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore").bind(k, String(v));

// ── LA CHIAVE ─────────────────────────────────────────────────────────────
function chiaveGiusta(env, parametri) {
  const vera = String(env.SILLAGE_CHIAVE || "").trim();
  const data = String(parametri.get("chiave") || "").trim();
  if (!vera || !data || vera.length !== data.length) return false;
  let diversi = 0;                       // confronto a tempo costante
  for (let i = 0; i < vera.length; i++) diversi |= vera.charCodeAt(i) ^ data.charCodeAt(i);
  return diversi === 0;
}

// ── DALLE RIGHE DEL FOGLIO AL JSON DELL'APP (come Codice.gs) ──────────────
const RINOMINA = {
  marchio: "brand", profumo: "name", concentrazione: "conc", longevita_h: "longevita", piramide: "note",
  note: "noteElenco", clone_di: "dupe", clone_stato: "cloneStato", descrizione: "desc", giorno_pct: "giornoPct",
  formato_ml: "formatoMl", tipo_possesso: "tipoPossesso", num_flaconi: "numFlaconi", residuo_pct: "residuoPct",
  note_personali: "notePersonali"
};
const ELENCHI = ["accordi", "note"];
const NUMERICI = ["id", "longevita_h", "rating", "voti", "giorno_pct", "inverno", "primavera", "estate", "autunno",
                  "formato_ml", "num_flaconi", "residuo_pct"];
const TRISTATO = ["ufficio", "palestra", "serata", "quotidiano", "formale", "informale", "appuntamento", "casa", "festivita"];
const numero = v => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};
const tristato = v => {
  v = String(v).toLowerCase().trim();
  if (v === "moderazione" || v === "si-mod") return "si-mod";
  return v === "si" ? "si" : "no";
};
// le righe vuote non contano, come nel foglio
const piene = righe => righe.filter(r => Object.values(r).join("").trim() !== "");

function profumiPerApp(righe) {
  return piene(righe).filter(r => String(r.attivo).toLowerCase() !== "no").map(r => {
    const p = {};
    for (const col of Object.keys(r)) {
      const chiave = RINOMINA[col] || col, v = r[col];
      if (ELENCHI.includes(col)) p[chiave] = v ? v.split("|").map(x => x.trim()).filter(Boolean) : [];
      else if (NUMERICI.includes(col)) p[chiave] = numero(v);
      else if (TRISTATO.includes(col)) p[chiave] = tristato(v);
      else p[chiave] = v;
    }
    p.stagioni = { inverno: numero(r.inverno), primavera: numero(r.primavera), estate: numero(r.estate), autunno: numero(r.autunno) };
    ["inverno", "primavera", "estate", "autunno"].forEach(s => delete p[s]);
    if (!p.note && p.noteElenco && p.noteElenco.length) p.note = p.noteElenco.join(" · ");
    p.nuovo = String(r.nuovo).toLowerCase() === "si";
    if (!p.nuovo) delete p.nuovo;
    if (!p.dupe) delete p.dupe;
    if (!p.colore) p.colore = "verde";
    if (!p.stagione) p.stagione = "tutto";
    if (!p.momento) p.momento = "entrambi";
    return p;
  });
}
const layeringPerApp = righe => piene(righe).map(r =>
  ({ g: r.gruppo, t: r.tag, n: r.nome, s: r.sommario, come: r.come, ris: r.risultato, perche: r.perche, quando: r.quando }));
function consigliPerApp(consigli, voci) {
  const per = {};
  piene(voci).forEach(r => (per[r.consiglio] = per[r.consiglio] || []).push({ t: r.titolo, d: r.dettaglio }));
  return piene(consigli).map(r => ({ g: r.gruppo, n: r.nome, gap: r.lacuna, voci: per[r.nome] || [] }));
}
const notePerApp = righe => piene(righe).map(r => r.nota).filter(Boolean);

/* Il catalogo per l'app, pronto da incollare nella risposta. Si ricalcola
   solo quando il catalogo cambia. */
function vista(t) {
  const profumi = profumiPerApp(t.Profumi.righe);
  return {
    pezzo: '"profumi":' + JSON.stringify(profumi) + ',"note":' + JSON.stringify(notePerApp(t.Note.righe)) +
           ',"layering":' + JSON.stringify(layeringPerApp(t.Layering.righe)) +
           ',"consigli":' + JSON.stringify(consigliPerApp(t.Consigli.righe, t.ConsigliVoci.righe)),
    ids: profumi.map(p => p.id)
  };
}

// ── IL CATALOGO NEL DATABASE ──────────────────────────────────────────────
async function leggiTabs(db) {
  const righe = (await db.prepare("SELECT tab, colonne, righe FROM tabelle").all()).results;
  const t = {};
  righe.forEach(r => { t[r.tab] = { colonne: JSON.parse(r.colonne), righe: JSON.parse(r.righe) }; });
  TABS.forEach(n => { t[n] = t[n] || { colonne: [], righe: [] }; });
  return t;
}
/* Salva le tab cambiate, ricalcola la vista e segna che il foglio va
   ricopiato: tutto in un colpo solo. */
async function salvaTabs(db, t, cambiate) {
  const ora = Date.now(), v = vista(t), passi = cambiate.map(n => db.prepare(
    `INSERT INTO tabelle (tab, colonne, righe, aggiornato) VALUES (?, ?, ?, ?)
     ON CONFLICT(tab) DO UPDATE SET colonne = excluded.colonne, righe = excluded.righe, aggiornato = excluded.aggiornato`)
    .bind(n, JSON.stringify(t[n].colonne), JSON.stringify(t[n].righe), ora));
  passi.push(scriviStato(db, "vista", v.pezzo), scriviStato(db, "ids", JSON.stringify(v.ids)), scriviStato(db, "da-copiare", ora));
  await db.batch(passi);
}

/* La prima volta (o per rimediare) il catalogo viene preso dal foglio così
   com'è, colonna per colonna. Il diario no: quello il database l'ha già. */
async function importa(env) {
  const d = await alFoglio(env, { azione: "grezzo" });
  if (!d.tabs || !d.tabs.Profumi || !d.tabs.Profumi.righe.length) throw new Error("il foglio non ha dato il catalogo: " + (d.errore || "risposta vuota"));
  const t = {};
  TABS.forEach(n => { t[n] = d.tabs[n] ? { colonne: d.tabs[n].colonne, righe: d.tabs[n].righe } : { colonne: [], righe: [] }; });
  await salvaTabs(env.DB, t, TABS);
  await env.DB.batch([scriviStato(env.DB, "importato", new Date().toISOString()), scriviStato(env.DB, "da-copiare", "")]);
  return { profumi: t.Profumi.righe.length };
}
async function pronto(env) {
  await schema(env);
  if (await leggiStato(env.DB, "vista")) return true;
  await importa(env);
  return true;
}

// ── LETTURA ───────────────────────────────────────────────────────────────
const vocePerApp = r => ({ data: r.data, id: r.id, t: r.t, nota: r.nota, voto: r.voto, occasione: r.occasione, momento: r.momento });
async function corpo(db, conDiario) {
  const pezzo = await leggiStato(db, "vista");
  if (!pezzo) return null;
  let s = "{" + pezzo;
  if (conDiario) {
    const voci = (await db.prepare("SELECT * FROM diario ORDER BY t").all()).results;
    s += ',"diario":' + JSON.stringify(voci.map(vocePerApp));
  } else s += ',"diarioChiuso":true';
  return s + ',"aggiornato":' + JSON.stringify(new Date().toISOString()) + "}";
}

// ── SCRITTURE DALL'APP ────────────────────────────────────────────────────
async function idValidi(db) {
  const s = await leggiStato(db, "ids");
  return new Set(s ? JSON.parse(s) : []);
}

/* Le stesse regole del Web App (Diario.gs), con le stesse risposte. */
async function scriviDiario(db, p) {
  const id = Number(p.get("id")), data = String(p.get("data") || ""), t = String(p.get("t") || ""), op = p.get("op");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{10,16}$/.test(t)) return { errore: "voce non valida" };
  if (!(await idValidi(db)).has(id)) return { errore: "profumo sconosciuto: " + id };
  const ora = Date.now();
  const v = await db.prepare("SELECT * FROM diario WHERE t = ?").bind(t).first();
  const segna = scriviStato(db, "da-copiare", ora);

  if (op === "togli") {
    if (!v) return { ok: true, assente: true };
    await db.batch([db.prepare("DELETE FROM diario WHERE t = ?").bind(t), segna]);
    return { ok: true, tolta: true };
  }
  const uso = {
    occasione: OCCASIONI.includes(p.get("occasione")) ? p.get("occasione") : "",
    momento: ["giorno", "sera"].includes(p.get("momento")) ? p.get("momento") : ""
  };
  if (op === "nota") {
    if (!v) return { errore: "voce non trovata" };
    const nota = String(p.get("nota") || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const voto = Number(p.get("voto")), vv = voto >= 1 && voto <= 5 ? Math.round(voto) : null;
    await db.batch([db.prepare("UPDATE diario SET nota = ?, voto = ?, occasione = ?, momento = ?, aggiornato = ? WHERE t = ?")
      .bind(nota, vv, uso.occasione, uso.momento, ora, t), segna]);
    return { ok: true, nota: true, uso: true };
  }
  if (v) return { ok: true, gia: true };
  const nelGiorno = await db.prepare("SELECT COUNT(*) AS n FROM diario WHERE data = ?").bind(data).first("n");
  if (nelGiorno >= MAX_GIORNO) return { errore: "troppe voci per il " + data };
  await db.batch([db.prepare("INSERT INTO diario (t, data, id, occasione, momento, aggiornato) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(t, data, id, uso.occasione, uso.momento, ora), segna]);
  return { ok: true, uso: true };
}

async function segnaResiduo(db, p) {
  const id = Number(p.get("id")), v = Number(p.get("valore"));
  if (!id || !RESIDUI.includes(v)) return { errore: "valore non valido" };
  const t = await leggiTabs(db);
  const r = t.Profumi.righe.find(x => Number(x.id) === id);
  if (!r) return { errore: "profumo sconosciuto: " + id };
  if (!t.Profumi.colonne.includes("residuo_pct")) return { errore: "manca la colonna residuo_pct" };
  r.residuo_pct = String(v);
  await salvaTabs(db, t, ["Profumi"]);
  return { ok: true };
}

// ── AGGIUNTE E CORREZIONI (lo stesso formato di data/aggiunte.json e correzioni.json) ──
const breve = x => { x = String(x); return x.length > 64 ? x.slice(0, 61) + "…" : x; };
// nel foglio i decimali andavano scritti "'3.78"; nel database l'apostrofo non serve
const pulito = v => { const s = v === null || v === undefined ? "" : String(v); return s.startsWith("'") ? s.slice(1) : s; };

/* Le regole di Aggiunte.gs e Correzioni.gs: una riga che c'è già non si
   duplica, una correzione si applica solo se la cella contiene ancora il
   valore che si aspettava (`da`). Rilanciare non fa danni. */
function applicaModifiche(t, m, soloProva) {
  const esiti = [], cambiate = new Set();
  let aggiunte = 0, colonne = 0, scritte = 0, saltate = 0;
  const tab = n => { if (!TABS.includes(n)) throw new Error('tab sconosciuta "' + n + '"'); return t[n]; };

  (m.aggiunte || []).filter(v => v.colonna).forEach(v => {
    const et = v.tab + " colonna «" + v.colonna + "»";
    try {
      const x = tab(v.tab);
      if (x.colonne.includes(v.colonna)) { saltate++; esiti.push(et + ": c'è già, salto"); return; }
      x.colonne.push(v.colonna); x.righe.forEach(r => { r[v.colonna] = ""; });
      cambiate.add(v.tab); colonne++; esiti.push(et + ": creata — " + (v.perche || ""));
    } catch (e) { esiti.push(et + ": " + e.message); }
  });
  (m.aggiunte || []).filter(v => v.riga).forEach(v => {
    const et = v.tab + " «" + breve(v.valore) + "»";
    try {
      const x = tab(v.tab);
      if (!x.colonne.includes(v.chiave)) { esiti.push(et + ': manca la colonna "' + v.chiave + '"'); return; }
      if (x.righe.some(r => String(r[v.chiave]).trim() === String(v.valore).trim())) { saltate++; esiti.push(et + ": c'è già, salto"); return; }
      const ignote = Object.keys(v.riga).filter(c => !x.colonne.includes(c));
      if (ignote.length) { esiti.push(et + ": colonne che il catalogo non ha — " + ignote.join(", ")); return; }
      x.righe.push(Object.fromEntries(x.colonne.map(c => [c, v.riga[c] !== undefined ? pulito(v.riga[c]) : ""])));
      cambiate.add(v.tab); aggiunte++; esiti.push(et + ": aggiunta — " + (v.perche || ""));
    } catch (e) { esiti.push(et + ": " + e.message); }
  });
  (m.correzioni || []).forEach(c => {
    const nome = c.tab || "Profumi", chiave = c.chiave || "id", valore = c.valore !== undefined ? c.valore : c.id;
    const et = nome + " «" + breve(valore) + "» " + c.colonna;
    try {
      const x = tab(nome);
      if (!x.colonne.includes(chiave)) { esiti.push(et + ': manca la colonna "' + chiave + '"'); return; }
      const r = x.righe.find(r => String(r[chiave]).trim() === String(valore).trim());
      if (!r) { esiti.push(et + ": nessuna riga con questa chiave"); return; }
      if (!x.colonne.includes(c.colonna)) { esiti.push(et + ": colonna assente"); return; }
      const attuale = String(r[c.colonna] ?? "").trim(), a = pulito(c.a), da = pulito(c.da);
      if (attuale.toLowerCase() === a.toLowerCase()) { esiti.push(et + ": già a posto"); return; }
      if (attuale.toLowerCase() !== da.toLowerCase()) {
        saltate++; esiti.push(et + ': SALTATA — mi aspettavo "' + breve(da) + '", trovo "' + breve(attuale) + '"'); return;
      }
      r[c.colonna] = a; cambiate.add(nome); scritte++;
      esiti.push(et + ': "' + breve(attuale) + '" → "' + breve(a) + '" — ' + (c.perche || ""));
    } catch (e) { esiti.push(et + ": " + e.message); }
  });
  const riassunto = (soloProva ? "PROVA A VUOTO, niente è stato scritto · " : "") +
    (colonne ? colonne + " colonne, " : "") + aggiunte + " righe aggiunte, " + scritte + " celle corrette" +
    (saltate ? " · " + saltate + " saltate o già presenti" : "");
  return { ok: true, aggiunte, colonne, correzioni: scritte, saltate, cambiate: [...cambiate], testo: riassunto + "\n" + esiti.join("\n") };
}

// ── LA COPIA NEL FOGLIO ───────────────────────────────────────────────────
async function alFoglio(env, campi) {
  const r = await fetch(env.FOGLIO_URL, {
    method: "POST", redirect: "follow",
    body: new URLSearchParams({ ...campi, chiave: env.SILLAGE_CHIAVE || "" })
  });
  if (!r.ok) throw new Error("il foglio risponde HTTP " + r.status);
  const s = await r.text();
  try { return JSON.parse(s); } catch (e) { throw new Error("il foglio non risponde in JSON: lo script è aggiornato?"); }
}

/* Riscrive nel foglio tutto il catalogo e il diario. Si segna fatta solo se
   nel frattempo non è arrivata un'altra modifica. */
async function copiaNelFoglio(env, sempre) {
  const db = env.DB;
  const daCopiare = await leggiStato(db, "da-copiare");
  if (!sempre && !daCopiare) return { copiata: false };
  const t = await leggiTabs(db);
  if (!t.Profumi.righe.length) throw new Error("catalogo vuoto: non copio niente");
  const nomi = new Map(t.Profumi.righe.map(r => [Number(r.id), (r.marchio + " " + r.profumo).trim()]));
  const voci = (await db.prepare("SELECT * FROM diario ORDER BY t").all()).results.map(v => ({
    data: v.data, id: String(v.id), t: v.t, nota: v.nota, voto: v.voto ?? "", occasione: v.occasione, momento: v.momento,
    profumo: (nomi.get(v.id) || "") + (v.t.length === 14 ? (v.t.endsWith("1") ? " (layering, sotto)" : " (layering, sopra)") : "")
  }));
  const tabs = { Diario: { colonne: COLONNE_DIARIO, righe: voci } };
  TABS.forEach(n => { tabs[n] = t[n]; });
  const e = await alFoglio(env, { azione: "specchio", dati: JSON.stringify({ tabs }) });
  if (!e || !e.ok) throw new Error("il foglio non ha accettato la copia: " + ((e && e.errore) || "risposta vuota"));
  await db.batch([
    db.prepare("UPDATE stato SET valore = '' WHERE chiave = 'da-copiare' AND valore = ?").bind(String(daCopiare ?? "")),
    scriviStato(db, "ultima-copia", new Date().toISOString())
  ]);
  return { copiata: true, tab: e.tab };
}
const copiaDopo = (env, ctx) => ctx.waitUntil(copiaNelFoglio(env).catch(e => console.log("copia nel foglio rimandata:", e.message)));

// ── L'INGRESSO ────────────────────────────────────────────────────────────
async function rispondi(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    ...INTESTAZIONI, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" } });
  // tutto il resto sono i file del sito, serviti da Cloudflare senza passare di qui
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return new Response("Non trovato", { status: 404 });
  const db = env.DB;
  await pronto(env);

  if (request.method === "GET") {
    if (url.searchParams.has("stato")) {
      const [ultima, daCopiare, importato, ids] = await Promise.all(
        ["ultima-copia", "da-copiare", "importato", "ids"].map(k => leggiStato(db, k)));
      return json({ originale: "database", profumi: ids ? JSON.parse(ids).length : 0, catalogoDalFoglio: importato,
                    ultimaCopiaNelFoglio: ultima, copiaInAttesa: !!daCopiare });
    }
    return testo(await corpo(db, false));
  }
  if (request.method !== "POST") return json({ errore: "metodo non previsto" }, 405);

  // i parametri arrivano sia nell'indirizzo sia nel corpo, come per il Web App
  const p = new URLSearchParams(url.search);
  const ct = request.headers.get("Content-Type") || "";
  if (!ct || /x-www-form-urlencoded|text\/plain/.test(ct)) new URLSearchParams(await request.text()).forEach((v, k) => p.set(k, v));
  const azione = p.get("azione");

  if (azione === "leggi") return testo(await corpo(db, chiaveGiusta(env, p)));
  if (!["diario", "residuo", "modifica", "sincronizza", "importa"].includes(azione)) return json({ errore: "azione sconosciuta: " + azione });
  if (!chiaveGiusta(env, p)) return json(SENZA_CHIAVE);

  if (azione === "sincronizza") {
    try { return json({ ok: true, ...(await copiaNelFoglio(env, true)) }); }
    catch (e) { return json({ errore: e.message }); }
  }
  if (azione === "importa") {
    if (p.get("conferma") !== "si") return json({ errore: "importa riscrive il catalogo dal foglio: aggiungi conferma=si" });
    try { return json({ ok: true, ...(await importa(env)) }); }
    catch (e) { return json({ errore: e.message }); }
  }
  if (azione === "modifica") {
    let m;
    try { m = JSON.parse(p.get("dati") || "{}"); } catch (e) { return json({ errore: "dati non validi: serve un JSON {aggiunte, correzioni}" }); }
    const t = await leggiTabs(db), prova = p.get("prova") === "1";
    const esito = applicaModifiche(t, m, prova);
    if (!prova && esito.cambiate.length) { await salvaTabs(db, t, esito.cambiate); copiaDopo(env, ctx); }
    return json(esito);
  }
  const esito = azione === "diario" ? await scriviDiario(db, p) : await segnaResiduo(db, p);
  if (esito.ok && !esito.gia && !esito.assente) copiaDopo(env, ctx);
  return json(esito);
}

export default {
  async fetch(request, env, ctx) {
    try { return await rispondi(request, env, ctx); }
    catch (e) { console.log("errore:", e.stack || e.message); return json({ errore: "il ponte ha avuto un problema: " + e.message }, 500); }
  },
  /* Ogni 5 minuti: se una copia nel foglio non è andata (foglio lento o
     giù), si riprova. Una volta al giorno, verso le 3 di notte UTC, la copia
     si rifà comunque, così un foglio ritoccato a mano torna in riga. */
  async scheduled(evento, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await pronto(env);
        const d = new Date(evento.scheduledTime || Date.now());
        const ogniGiorno = d.getUTCHours() === 3 && d.getUTCMinutes() < 5;
        console.log("copia nel foglio:", JSON.stringify(await copiaNelFoglio(env, ogniGiorno)));
      } catch (e) { console.log("copia nel foglio rimandata:", e.message); }
    })());
  }
};
