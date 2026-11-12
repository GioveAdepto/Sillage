/* Sillage — il ponte tra l'app e il database (Cloudflare Worker + D1).

   Parla esattamente come il Web App di Apps Script, così per l'app cambia solo
   l'indirizzo:
     GET  /api                         tutto, senza il diario (diarioChiuso: true)
     POST /api?azione=leggi            tutto, diario compreso, con la chiave
     POST /api?azione=diario&op=...    metti, togli o nota, con la chiave
     POST /api?azione=residuo&id&valore  quanto resta in una boccetta, con la chiave
     POST /api?azione=sincronizza      rilegge subito il foglio, con la chiave
     GET  /api?stato=1                 chi comanda e quando si è sincronizzato
   La chiave arriva nel corpo della richiesta (chiave=...), mai nell'indirizzo.

   Chi comanda (PADRONE in wrangler.jsonc):
   - "foglio": il foglio è l'originale di tutto. Ogni 5 minuti il ponte lo
     rilegge e copia nel database catalogo, diario e residuo. Le scritture
     dall'app vengono rifiutate: si fanno ancora sul foglio.
   - "database": il catalogo arriva ancora dal foglio (lì lo modifichi tu), ma
     diario e residuo li comanda il database. Dopo ogni scrittura il ponte ne
     manda una copia al foglio, attraverso il Web App; se il foglio non
     risponde, riprova al giro successivo.

   Le tabelle nascono da sole alla prima richiesta (CREATE TABLE IF NOT EXISTS):
   nessuna migrazione da lanciare a mano. */

const OCCASIONI = ["ufficio", "quotidiano", "appuntamento", "formale", "casa", "festivita", "palestra"];
const RESIDUI = [100, 90, 75, 50, 25, 10, 0];
const CATALOGO = ["profumi", "note", "layering", "consigli"];
const MAX_GIORNO = 10;          // come il Web App: più di dieci voci in un giorno sono un errore
const INVII_PER_GIRO = 8;       // voci mandate al foglio per giro: il piano gratuito concede 50 richieste esterne

// ── RISPOSTE ──────────────────────────────────────────────────────────────
const INTESTAZIONI = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*"
};
const testo = (corpo, stato = 200) => new Response(corpo, { status: stato, headers: INTESTAZIONI });
const json = (o, stato = 200) => testo(JSON.stringify(o), stato);
// "sconosciuta:" come nel Web App: le versioni dell'app tengono in coda una voce rifiutata con questa parola
const SENZA_CHIAVE = { errore: "chiave sconosciuta: manca o non e' quella giusta" };

// ── SCHEMA ────────────────────────────────────────────────────────────────
const SCHEMA = [
  // il catalogo così come lo restituisce il foglio, già nella forma dell'app
  `CREATE TABLE IF NOT EXISTS catalogo (chiave TEXT PRIMARY KEY, json TEXT NOT NULL, impronta TEXT, aggiornato INTEGER)`,
  // inviato: 0 da mandare al foglio, 1 mandata, -1 rifiutata dal foglio (non si riprova)
  `CREATE TABLE IF NOT EXISTS diario (t TEXT PRIMARY KEY, data TEXT NOT NULL, id INTEGER NOT NULL,
     nota TEXT NOT NULL DEFAULT '', voto INTEGER, occasione TEXT NOT NULL DEFAULT '', momento TEXT NOT NULL DEFAULT '',
     tolta INTEGER NOT NULL DEFAULT 0, inviato INTEGER NOT NULL DEFAULT 1, aggiornato INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS diario_data ON diario (data)`,
  `CREATE TABLE IF NOT EXISTS residui (id INTEGER PRIMARY KEY, pct INTEGER NOT NULL, inviato INTEGER NOT NULL DEFAULT 1, aggiornato INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stato (chiave TEXT PRIMARY KEY, valore TEXT)`
];
let schemaPronto = false;
async function schema(db) {
  if (schemaPronto) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
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

// ── LETTURA ───────────────────────────────────────────────────────────────
const vocePerApp = r => ({ data: r.data, id: r.id, t: r.t, nota: r.nota, voto: r.voto,
                           occasione: r.occasione, momento: r.momento });

/* Il JSON per l'app, montato dai pezzi già pronti nel database: il catalogo
   non si rilegge né si riscrive, si incolla. Il residuo è già dentro i
   profumi (vedi segnaResiduo). */
async function corpo(db, conDiario) {
  const righe = (await db.prepare("SELECT chiave, json FROM catalogo").all()).results;
  const pezzi = Object.fromEntries(righe.map(r => [r.chiave, r.json]));
  if (!pezzi.profumi) return null;
  let s = "{" + CATALOGO.filter(k => pezzi[k]).map(k => JSON.stringify(k) + ":" + pezzi[k]).join(",");
  if (conDiario) {
    const voci = (await db.prepare("SELECT * FROM diario WHERE tolta = 0 ORDER BY t").all()).results;
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

  if (op === "togli") {
    if (!v || v.tolta) return { ok: true, assente: true };
    await db.prepare("UPDATE diario SET tolta = 1, inviato = 0, aggiornato = ? WHERE t = ?").bind(ora, t).run();
    return { ok: true, tolta: true };
  }
  const uso = {
    occasione: OCCASIONI.includes(p.get("occasione")) ? p.get("occasione") : "",
    momento: ["giorno", "sera"].includes(p.get("momento")) ? p.get("momento") : ""
  };
  if (op === "nota") {
    if (!v || v.tolta) return { errore: "voce non trovata" };
    const nota = String(p.get("nota") || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const voto = Number(p.get("voto")), vv = voto >= 1 && voto <= 5 ? Math.round(voto) : null;
    await db.prepare("UPDATE diario SET nota = ?, voto = ?, occasione = ?, momento = ?, inviato = 0, aggiornato = ? WHERE t = ?")
      .bind(nota, vv, uso.occasione, uso.momento, ora, t).run();
    return { ok: true, nota: true, uso: true };
  }
  // metti
  if (v && !v.tolta) return { ok: true, gia: true };
  const nelGiorno = await db.prepare("SELECT COUNT(*) AS n FROM diario WHERE data = ? AND tolta = 0").bind(data).first("n");
  if (nelGiorno >= MAX_GIORNO) return { errore: "troppe voci per il " + data };
  await db.prepare(`INSERT INTO diario (t, data, id, occasione, momento, tolta, inviato, aggiornato) VALUES (?, ?, ?, ?, ?, 0, 0, ?)
                    ON CONFLICT(t) DO UPDATE SET data = excluded.data, id = excluded.id, nota = '', voto = NULL,
                      occasione = excluded.occasione, momento = excluded.momento, tolta = 0, inviato = 0, aggiornato = excluded.aggiornato`)
    .bind(t, data, id, uso.occasione, uso.momento, ora).run();
  return { ok: true, uso: true };
}

/* Il residuo sta dentro il JSON dei profumi, così la lettura non deve
   rimontarlo: si cambia lì e si segna nella tabella residui, che dice al
   giro di sincronia di non riprenderlo dal foglio e di mandarlo al foglio. */
async function segnaResiduo(db, p) {
  const id = Number(p.get("id")), v = Number(p.get("valore"));
  if (!id || !RESIDUI.includes(v)) return { errore: "valore non valido" };
  const riga = await db.prepare("SELECT json FROM catalogo WHERE chiave = 'profumi'").first("json");
  const profumi = riga ? JSON.parse(riga) : [];
  const pr = profumi.find(x => x.id === id);
  if (!pr) return { errore: "profumo sconosciuto: " + id };
  pr.residuoPct = v;
  const ora = Date.now();
  await db.batch([
    db.prepare("UPDATE catalogo SET json = ?, aggiornato = ? WHERE chiave = 'profumi'").bind(JSON.stringify(profumi), ora),
    db.prepare(`INSERT INTO residui (id, pct, inviato, aggiornato) VALUES (?, ?, 0, ?)
                ON CONFLICT(id) DO UPDATE SET pct = excluded.pct, inviato = 0, aggiornato = excluded.aggiornato`).bind(id, v, ora)
  ]);
  return { ok: true };
}

// ── IL FOGLIO ─────────────────────────────────────────────────────────────
async function alFoglio(env, query, corpo) {
  const r = await fetch(env.FOGLIO_URL + (query ? "?" + new URLSearchParams(query) : ""), {
    method: "POST", redirect: "follow",
    body: new URLSearchParams({ ...corpo, chiave: env.SILLAGE_CHIAVE || "" })
  });
  if (!r.ok) throw new Error("il foglio risponde HTTP " + r.status);
  const testo = await r.text();
  try { return JSON.parse(testo); } catch (e) { throw new Error("il foglio non risponde in JSON"); }
}

const impronta = async s => {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
};

/* Rilegge il foglio e aggiorna il database. Il catalogo viene sempre dal
   foglio; diario e residuo solo finché comanda il foglio. Con il database
   al comando, il residuo deciso dall'app vince su quello del foglio. */
async function sincronizza(env) {
  const db = env.DB;
  await schema(db);
  const d = await alFoglio(env, { fresco: "1" }, { azione: "leggi" });
  if (!Array.isArray(d.profumi) || !d.profumi.length) throw new Error("il foglio ha risposto senza profumi");
  const comandaIlFoglio = env.PADRONE !== "database";
  const ora = Date.now(), passi = [], esito = { profumi: d.profumi.length, catalogo: 0 };

  if (comandaIlFoglio) {
    if (!Array.isArray(d.diario)) throw new Error("il foglio non ha dato il diario: la chiave del ponte e quella dello script sono diverse?");
    const voci = d.diario.filter(v => v && /^\d{10,16}$/.test(String(v.t)) && /^\d{4}-\d{2}-\d{2}$/.test(v.data) && Number(v.id));
    const imp = await impronta(JSON.stringify(voci));
    if (imp !== await leggiStato(db, "impronta-diario")) {
      passi.push(db.prepare("DELETE FROM diario"));
      voci.forEach(v => passi.push(db.prepare(
        "INSERT OR REPLACE INTO diario (t, data, id, nota, voto, occasione, momento, tolta, inviato, aggiornato) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)")
        .bind(String(v.t), v.data, Number(v.id), v.nota || "", Number(v.voto) >= 1 ? Math.round(v.voto) : null,
              v.occasione || "", v.momento || "", ora)));
      passi.push(scriviStato(db, "impronta-diario", imp));
      esito.diario = voci.length;
    }
    passi.push(db.prepare("DELETE FROM residui"));
  } else {
    // il residuo scelto nell'app resta quello, finché il foglio non lo ha ricevuto e poi sempre
    const residui = (await db.prepare("SELECT id, pct FROM residui").all()).results;
    const m = new Map(residui.map(r => [r.id, r.pct]));
    d.profumi.forEach(p => { if (m.has(p.id)) p.residuoPct = m.get(p.id); });
  }

  for (const k of CATALOGO) {
    if (!(k in d)) continue;
    const s = JSON.stringify(d[k]), imp = await impronta(s);
    const prima = await db.prepare("SELECT impronta FROM catalogo WHERE chiave = ?").bind(k).first("impronta");
    if (prima === imp) continue;
    passi.push(db.prepare(`INSERT INTO catalogo (chiave, json, impronta, aggiornato) VALUES (?, ?, ?, ?)
                           ON CONFLICT(chiave) DO UPDATE SET json = excluded.json, impronta = excluded.impronta, aggiornato = excluded.aggiornato`)
      .bind(k, s, imp, ora));
    esito.catalogo++;
  }
  passi.push(scriviStato(db, "ids", JSON.stringify(d.profumi.map(p => p.id))));
  passi.push(scriviStato(db, "ultima-sincronia", new Date(ora).toISOString()));
  await db.batch(passi);
  return esito;
}

/* Manda al foglio quello che il database ha e il foglio ancora no. Solo con
   il database al comando. Una voce cambiata mentre viaggiava resta da
   mandare: si segna come inviata solo se `aggiornato` non è cambiato. */
async function inviaAlFoglio(env) {
  if (env.PADRONE !== "database") return { inviate: 0 };
  const db = env.DB;
  await schema(db);
  const voci = (await db.prepare("SELECT * FROM diario WHERE inviato = 0 ORDER BY aggiornato LIMIT ?").bind(INVII_PER_GIRO).all()).results;
  let inviate = 0;
  for (const v of voci) {
    let esito;
    if (v.tolta) {
      esito = await alFoglio(env, { azione: "diario", op: "togli", id: v.id, data: v.data, t: v.t }, {});
    } else {
      esito = await alFoglio(env, { azione: "diario", op: "metti", id: v.id, data: v.data, t: v.t,
                                    occasione: v.occasione, momento: v.momento }, {});
      if (esito && esito.ok && (esito.gia || v.nota || v.voto))
        esito = await alFoglio(env, { azione: "diario", op: "nota", id: v.id, data: v.data, t: v.t, nota: v.nota,
                                      voto: v.voto ?? "", occasione: v.occasione, momento: v.momento }, {});
    }
    if (esito && /^chiave/.test(esito.errore || "")) throw new Error("il foglio non riconosce la chiave del ponte");
    const stato = esito && esito.ok ? 1 : esito && esito.errore ? -1 : null;
    if (stato === null) continue;
    if (stato === 1 && v.tolta) await db.prepare("DELETE FROM diario WHERE t = ? AND aggiornato = ?").bind(v.t, v.aggiornato).run();
    else await db.prepare("UPDATE diario SET inviato = ? WHERE t = ? AND aggiornato = ?").bind(stato, v.t, v.aggiornato).run();
    inviate++;
  }
  const residui = (await db.prepare("SELECT * FROM residui WHERE inviato = 0 LIMIT ?").bind(INVII_PER_GIRO).all()).results;
  for (const r of residui) {
    const esito = await alFoglio(env, { azione: "residuo", id: r.id, valore: r.pct }, {});
    if (esito && /^chiave/.test(esito.errore || "")) throw new Error("il foglio non riconosce la chiave del ponte");
    if (!esito || (!esito.ok && !esito.errore)) continue;
    await db.prepare("UPDATE residui SET inviato = ? WHERE id = ? AND aggiornato = ?").bind(esito.ok ? 1 : -1, r.id, r.aggiornato).run();
    inviate++;
  }
  return { inviate };
}

// ── L'INGRESSO ────────────────────────────────────────────────────────────
async function rispondi(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    ...INTESTAZIONI, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" } });
  // tutto il resto sono i file del sito, serviti da Cloudflare senza passare di qui
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return new Response("Non trovato", { status: 404 });
  const db = env.DB;
  await schema(db);

  if (request.method === "GET") {
    if (url.searchParams.has("stato")) {
      const [ultima, pendenti] = await Promise.all([leggiStato(db, "ultima-sincronia"),
        db.prepare("SELECT (SELECT COUNT(*) FROM diario WHERE inviato = 0) + (SELECT COUNT(*) FROM residui WHERE inviato = 0) AS n").first("n")]);
      return json({ padrone: env.PADRONE === "database" ? "database" : "foglio", ultimaSincronia: ultima, daMandareAlFoglio: pendenti });
    }
    const s = await corpo(db, false);
    return s ? testo(s) : json({ errore: "il database e' ancora vuoto: aspetta la prima sincronia col foglio" }, 503);
  }
  if (request.method !== "POST") return json({ errore: "metodo non previsto" }, 405);

  // i parametri arrivano sia nell'indirizzo sia nel corpo, come per il Web App
  const p = new URLSearchParams(url.search);
  const ct = request.headers.get("Content-Type") || "";
  if (!ct || /x-www-form-urlencoded|text\/plain/.test(ct)) new URLSearchParams(await request.text()).forEach((v, k) => p.set(k, v));
  const azione = p.get("azione");

  if (azione === "leggi") {
    const s = await corpo(db, chiaveGiusta(env, p));
    return s ? testo(s) : json({ errore: "il database e' ancora vuoto: aspetta la prima sincronia col foglio" }, 503);
  }
  if (!["diario", "residuo", "sincronizza"].includes(azione)) return json({ errore: "azione sconosciuta: " + azione });
  if (!chiaveGiusta(env, p)) return json(SENZA_CHIAVE);
  if (azione === "sincronizza") {
    try { return json({ ok: true, ...(await sincronizza(env)), ...(await inviaAlFoglio(env)) }); }
    catch (e) { return json({ errore: e.message }); }
  }
  // finché comanda il foglio, l'app scrive sul foglio: qui niente, o il giro dopo lo cancellerebbe
  if (env.PADRONE !== "database") return json({ errore: "azione sconosciuta: il database non comanda ancora" });
  const esito = azione === "diario" ? await scriviDiario(db, p) : await segnaResiduo(db, p);
  if (esito.ok) ctx.waitUntil(inviaAlFoglio(env).catch(e => console.log("copia nel foglio rimandata:", e.message)));
  return json(esito);
}

export default {
  async fetch(request, env, ctx) {
    try { return await rispondi(request, env, ctx); }
    catch (e) { console.log("errore:", e.stack || e.message); return json({ errore: "il ponte ha avuto un problema: " + e.message }, 500); }
  },
  async scheduled(evento, env, ctx) {
    ctx.waitUntil((async () => {
      try { console.log("sincronia:", JSON.stringify(await sincronizza(env))); }
      catch (e) { console.log("sincronia non riuscita:", e.message); }
      try { console.log("copia nel foglio:", JSON.stringify(await inviaAlFoglio(env))); }
      catch (e) { console.log("copia nel foglio rimandata:", e.message); }
    })());
  }
};
