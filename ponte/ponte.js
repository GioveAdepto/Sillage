/* Sillage — il ponte tra l'app e il database (Cloudflare Worker + D1).

   Il database è l'originale di tutto: catalogo, diario, residuo. Il foglio
   Google ne è una copia da guardare, riscritta dopo ogni modifica.

   Parla come il Web App di Apps Script, così l'app non ha dovuto cambiare:
     GET  /api                         tutto, senza il diario (diarioChiuso: true)
     POST /api?azione=leggi            tutto, diario compreso, con la chiave o con l'accesso
     POST /api?azione=diario&op=...    metti, togli o nota, con la chiave o con l'accesso
     POST /api?azione=residuo&id&valore  quanto resta in una boccetta, con la chiave o con l'accesso
     POST /api?azione=collega          collega l'account (accesso) a Danilo, con la chiave; scollega=si lo toglie
     POST /api?azione=registrati&nome  un account nuovo diventa una persona, con la vetrina vuota (accesso)
     POST /api?azione=catalogo         tutte le schede, per «Aggiungi profumo» (accesso o chiave)
     POST /api?azione=possesso&op=aggiungi|togli&id[&tipo&ml]  aggiungi una scheda già in Sillage / «Togli dalla vetrina» (accesso o chiave)
     POST /api?azione=vetrine          chi c'è in Sillage; azione=vetrina&di=… la sua collezione, senza privati
     POST /api?azione=modifica         aggiunte e correzioni al catalogo (dati=JSON), con la chiave
     POST /api?azione=sincronizza      riscrive subito la copia nel foglio, con la chiave
     POST /api?azione=importa&conferma=si  ricopia il catalogo DAL foglio (solo per rimediare), con la chiave
     POST /api?azione=confronta        le tabelle per persona danno lo stesso di quelle di prima?, con la chiave
     POST /api?azione=riporta&conferma=si  riscrive le tabelle di prima con quelle per persona (per tornare indietro), con la chiave
     GET  /api?stato=1                 a che punto è la copia nel foglio
   La chiave (chiave=...) e l'accesso dell'account (accesso=<token>) arrivano nel corpo della richiesta,
   mai nell'indirizzo.

   Dalla tappa 2 degli account i dati stanno nelle tabelle per persona:
   schede (i profumi, uguali per tutti), possessi, voci del diario e tab di
   ciascuno (Layering, Consigli, ConsigliVoci); la tab Note è comune. Il
   ponte le ricompone nelle tab del foglio, con le stesse colonne, e ne ricava
   il JSON per l'app con le stesse regole di Codice.gs, tenuto pronto in
   `stato.vista:<persona>`. Il piano gratuito concede 50 operazioni per
   richiesta: ogni richiesta ne usa poche. Per ora c'è una persona sola, Danilo.
   Le tabelle di prima (tabelle, diario) restano come erano al passaggio.

   Le tabelle nascono da sole alla prima richiesta; la prima volta il
   catalogo viene copiato dal foglio, e un database di prima della tappa 2 fa
   da solo il passaggio: nessun passo a mano. */

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
  `DELETE FROM diario WHERE tolta = 1`,
  /* Le tabelle per persona (account): dalla tappa 2 sono l'originale; quelle qui sopra restano come
     erano al passaggio (vedi «IL PASSAGGIO»). Le colonne di possessi non hanno tipo apposta: tengono i
     valori come arrivano dal catalogo (testo o numero), senza convertirli. */
  `CREATE TABLE IF NOT EXISTS persone (id TEXT PRIMARY KEY, account TEXT UNIQUE, nome TEXT NOT NULL,
     ruolo TEXT NOT NULL DEFAULT 'persona', creata INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS schede (id INTEGER PRIMARY KEY, dati TEXT NOT NULL, aggiornato INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS possessi (persona TEXT NOT NULL, scheda INTEGER NOT NULL, posto INTEGER NOT NULL,
     tipo_possesso, formato_ml, num_flaconi, residuo_pct, note_personali, aggiunto, attivo, nuovo,
     aggiornato INTEGER NOT NULL, PRIMARY KEY (persona, scheda))`,
  `CREATE TABLE IF NOT EXISTS voci (persona TEXT NOT NULL, t TEXT NOT NULL, data TEXT NOT NULL, id INTEGER NOT NULL,
     nota TEXT NOT NULL DEFAULT '', voto INTEGER, occasione TEXT NOT NULL DEFAULT '', momento TEXT NOT NULL DEFAULT '',
     aggiornato INTEGER NOT NULL, PRIMARY KEY (persona, t))`,
  `CREATE TABLE IF NOT EXISTS tab_persona (persona TEXT NOT NULL, tab TEXT NOT NULL, colonne TEXT NOT NULL,
     righe TEXT NOT NULL, aggiornato INTEGER, PRIMARY KEY (persona, tab))`
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

// ── L'ACCESSO CON L'ACCOUNT (tappa 3) ─────────────────────────────────────
/* Si entra con l'account di CheMetto (Supabase Auth del suo progetto, SUPABASE_URL in wrangler.jsonc):
   l'app manda nel corpo della richiesta `accesso=<token>`, il ponte ne controlla la firma con le chiavi
   pubbliche del progetto (ES256, nessun segreto da custodire), la scadenza e il progetto che l'ha dato.
   Il token dice solo quale account è: a quale persona di Sillage corrisponde lo dice la tabella persone. */
let chiaviAccesso = null, chiaviPrese = 0, chiaviRichieste = 0;
async function chiaviPubbliche(env, forza) {
  const ora = Date.now();
  if (chiaviAccesso && (!forza || ora - chiaviRichieste < 60000) && ora - chiaviPrese < 3600000) return chiaviAccesso;
  chiaviRichieste = ora;
  const r = await fetch(env.SUPABASE_URL + "/auth/v1/.well-known/jwks.json");
  if (!r.ok) throw new Error("HTTP " + r.status);
  const m = new Map();
  for (const k of (await r.json()).keys || []) {
    if (k.kty !== "EC" || k.crv !== "P-256") continue;
    m.set(k.kid, await crypto.subtle.importKey("jwk", { kty: k.kty, crv: k.crv, x: k.x, y: k.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]));
  }
  chiaviAccesso = m; chiaviPrese = ora;
  return m;
}
const daBase64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const leggiParte = s => JSON.parse(new TextDecoder().decode(daBase64url(s)));

/** { account, email } se il token è buono; { errore } se no ("scaduto", "non valido", "non verificabile ora"). */
async function verificaAccesso(env, token) {
  if (!env.SUPABASE_URL) return { errore: "non verificabile ora" };
  const parti = String(token).split(".");
  if (parti.length !== 3) return { errore: "non valido" };
  let testa, dati;
  try { testa = leggiParte(parti[0]); dati = leggiParte(parti[1]); } catch (e) { return { errore: "non valido" }; }
  if (testa.alg !== "ES256") return { errore: "non valido" };
  let chiave;
  try {
    chiave = (await chiaviPubbliche(env)).get(testa.kid) || (await chiaviPubbliche(env, true)).get(testa.kid);
  } catch (e) { return { errore: "non verificabile ora" }; }
  if (!chiave) return { errore: "non valido" };
  let firma = false;
  try {
    firma = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, chiave, daBase64url(parti[2]),
      new TextEncoder().encode(parti[0] + "." + parti[1]));
  } catch (e) { firma = false; }
  if (!firma) return { errore: "non valido" };
  const pubblico = [].concat(dati.aud || []);
  if (dati.iss !== env.SUPABASE_URL + "/auth/v1" || !pubblico.includes("authenticated") || !dati.sub) return { errore: "non valido" };
  if (!(Number(dati.exp) > Date.now() / 1000)) return { errore: "scaduto" };
  return { account: String(dati.sub), email: String(dati.email || "") };
}

/* Chi sta facendo la richiesta:
   - un accesso buono collegato a una persona → quella persona;
   - altrimenti la chiave giusta → Danilo (fino alla tappa 5);
   - un accesso buono ma non ancora collegato, senza chiave → nessuna persona, daCollegare;
   - niente di buono → nessuna persona, con l'errore da dare all'app. */
async function chiE(env, db, p) {
  const token = String(p.get("accesso") || "").trim();
  const conChiave = chiaveGiusta(env, p);
  const chi = {};
  if (token) {
    const a = await verificaAccesso(env, token);
    if (a.account) {
      chi.account = a.account; chi.email = a.email;
      const persona = await db.prepare("SELECT id, nome FROM persone WHERE account = ?").bind(a.account).first();
      if (persona) return { ...chi, persona: persona.id, nome: persona.nome, da: "accesso" };
      chi.daCollegare = true;
    } else chi.accessoNonValido = a.errore;
  }
  if (conChiave) return { ...chi, persona: PRIMA_PERSONA.id, nome: PRIMA_PERSONA.nome, da: "chiave" };
  return chi;
}
// L'errore per chi non è nessuno: l'app tiene in coda le voci rifiutate con «chiave…» o «accesso…»
function senzaPersona(chi) {
  if (chi.accessoNonValido) return { errore: "accesso " + chi.accessoNonValido + ": rientra nell'account" };
  if (chi.daCollegare) return { errore: "accesso non ancora collegato a una persona di Sillage" };
  return SENZA_CHIAVE;
}

/* Collega l'account a Danilo: servono insieme la chiave giusta e un accesso buono, così solo chi ha già la
   chiave può dire «questo account sono io». Con scollega=si (solo la chiave) il collegamento si toglie. */
async function collega(env, db, p) {
  const P = PRIMA_PERSONA.id;
  if (!chiaveGiusta(env, p)) return SENZA_CHIAVE;
  if (p.get("scollega") === "si") {
    await db.prepare("UPDATE persone SET account = NULL WHERE id = ?").bind(P).run();
    return { ok: true, scollegato: true };
  }
  const a = await verificaAccesso(env, String(p.get("accesso") || ""));
  if (!a.account) return { errore: "accesso " + (a.errore || "mancante") + ": rientra nell'account" };
  const gia = await db.prepare("SELECT id, account FROM persone WHERE account = ? OR id = ?").bind(a.account, P).all();
  const altra = gia.results.find(r => r.account === a.account && r.id !== P);
  if (altra) return { errore: "questo account è già di un'altra persona di Sillage" };
  const io = gia.results.find(r => r.id === P);
  if (io && io.account && io.account !== a.account && p.get("sostituisci") !== "si")
    return { errore: "Danilo è già collegato a un altro account: per cambiarlo aggiungi sostituisci=si" };
  await db.prepare("UPDATE persone SET account = ? WHERE id = ?").bind(a.account, P).run();
  return { ok: true, collegato: true, persona: P, email: a.email };
}

// ── LE PERSONE (tappa 4) ──────────────────────────────────────────────────
/* Registrazione libera, come CheMetto: un account buono che non è ancora nessuno diventa una persona nuova,
   con il nome che sceglie e la vetrina vuota. Una persona per account; rifarlo non ne crea un'altra. */
const nomePulito = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 30);
async function registrati(env, db, p) {
  const a = await verificaAccesso(env, String(p.get("accesso") || ""));
  if (!a.account) return { errore: "accesso " + (a.errore || "mancante") + ": rientra nell'account" };
  const gia = await db.prepare("SELECT id, nome FROM persone WHERE account = ?").bind(a.account).first();
  if (gia) return { ok: true, gia: true, persona: gia.id, nome: gia.nome };
  const nome = nomePulito(p.get("nome"));
  if (!nome) return { errore: "manca il nome con cui comparire in Sillage" };
  const id = "p" + [...crypto.getRandomValues(new Uint8Array(6))].map(b => (b % 36).toString(36)).join("");
  const ora = Date.now(), t = await leggiTabsPersona(db, id);   // vuota: nessun possesso, nessuna tab
  await db.batch([
    db.prepare("INSERT INTO persone (id, account, nome, ruolo, creata) VALUES (?, ?, ?, 'persona', ?)").bind(id, a.account, nome, ora),
    ...passiVista(db, id, t, ora)
  ]);
  return { ok: true, persona: id, nome };
}

/* Il catalogo comune: tutte le schede, con quello che serve per sceglierle («Aggiungi profumo»). Non dice chi le ha. */
async function catalogo(db) {
  const colonne = JSON.parse((await leggiStato(db, "colonne-profumi")) || "[]");
  const schede = (await db.prepare("SELECT id, dati FROM schede ORDER BY id").all()).results
    .map(r => ({ id: r.id, dati: JSON.parse(r.dati) }));
  const righe = ricomponiProfumi(colonne, schede, schede.map((s, posto) => ({ scheda: s.id, posto, attivo: "si" }))).righe;
  const profumi = profumiPerApp(righe).map(x => ({ id: x.id, brand: x.brand, name: x.name, conc: x.conc, famiglia: x.famiglia,
    colore: x.colore, img: x.img, accordi: (x.accordi || []).slice(0, 3), stagioni: x.stagioni, rating: x.rating }));
  return { ok: true, profumi };
}

/* Aggiungere una scheda già in Sillage («Aggiungi profumo») e «Togli dalla vetrina» sulla propria collezione. Togliere non cancella: il possesso resta con
   attivo=no, così le voci del diario che lo nominano restano leggibili, e aggiungerlo di nuovo lo riaccende. */
const oggi = () => new Date().toISOString().slice(0, 10);
async function possesso(db, persona, p) {
  const id = Number(p.get("id")), op = p.get("op");
  if (!Number.isInteger(id) || id <= 0 || !["aggiungi", "togli"].includes(op)) return { errore: "richiesta non valida" };
  const [scheda, mio] = await db.batch([
    db.prepare("SELECT id FROM schede WHERE id = ?").bind(id),
    db.prepare("SELECT attivo FROM possessi WHERE persona = ? AND scheda = ?").bind(persona, id)
  ]);
  if (!scheda.results.length) return { errore: "profumo sconosciuto: " + id };
  const ce = mio.results[0], ora = Date.now();
  let passo;
  if (op === "aggiungi") {
    const tipo = p.get("tipo") === "campione" ? "campione" : "full";
    const ml = Number(p.get("ml")), formato = ml > 0 && ml <= 1000 ? String(Math.round(ml * 10) / 10) : "";
    if (ce && String(ce.attivo).toLowerCase() !== "no") return { ok: true, gia: true };
    passo = ce
      ? db.prepare("UPDATE possessi SET attivo = 'si', tipo_possesso = ?, formato_ml = ?, aggiornato = ? WHERE persona = ? AND scheda = ?")
          .bind(tipo, formato, ora, persona, id)
      : db.prepare(`INSERT INTO possessi (persona, scheda, posto, tipo_possesso, formato_ml, num_flaconi, residuo_pct, note_personali,
           aggiunto, attivo, nuovo, aggiornato)
         SELECT ?, ?, COALESCE((SELECT MAX(posto) FROM possessi WHERE persona = ?), -1) + 1, ?, ?, '1', '', '', ?, 'si', '', ?`)
          .bind(persona, id, persona, tipo, formato, oggi(), ora);
  } else {
    if (!ce || String(ce.attivo).toLowerCase() === "no") return { ok: true, assente: true };
    passo = db.prepare("UPDATE possessi SET attivo = 'no', aggiornato = ? WHERE persona = ? AND scheda = ?").bind(ora, persona, id);
  }
  await passo.run();
  const t = await leggiTabsPersona(db, persona);
  await db.batch(passiVista(db, persona, t, ora));
  return { ok: true, [op === "aggiungi" ? "aggiunto" : "tolto"]: true };
}

/* Le vetrine degli altri (decisione dell'utente: agli altri si mostra solo la collezione). Le vede solo chi è
   entrato. Mai il diario, le note personali, il residuo, le ricette di layering o i consigli. */
const PRIVATI = ["notePersonali", "residuoPct"];
async function vetrine(db) {
  const r = await db.prepare(`SELECT p.id, p.nome, (SELECT COUNT(*) FROM possessi x WHERE x.persona = p.id AND x.attivo <> 'no') AS profumi
    FROM persone p ORDER BY p.creata`).all();
  return { ok: true, persone: r.results };
}
async function vetrina(db, di) {
  const [persona, pezzo] = await Promise.all([
    db.prepare("SELECT id, nome FROM persone WHERE id = ?").bind(String(di || "")).first(),
    leggiStato(db, "vista:" + String(di || ""))
  ]);
  if (!persona || !pezzo) return { errore: "vetrina sconosciuta" };
  const v = JSON.parse("{" + pezzo + "}");
  return { ok: true, di: persona.id, nome: persona.nome, note: v.note, layering: [], consigli: [],
           profumi: v.profumi.map(x => Object.fromEntries(Object.entries(x).filter(([k]) => !PRIVATI.includes(k)))) };
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
   com'è, colonna per colonna, e diventa quello di Danilo. Il diario no: quello il database l'ha già. */
async function importa(env) {
  const d = await alFoglio(env, { azione: "grezzo" });
  if (!d.tabs || !d.tabs.Profumi || !d.tabs.Profumi.righe.length) throw new Error("il foglio non ha dato il catalogo: " + (d.errore || "risposta vuota"));
  const t = {};
  TABS.forEach(n => { t[n] = d.tabs[n] ? { colonne: d.tabs[n].colonne, righe: d.tabs[n].righe } : { colonne: [], righe: [] }; });
  await salvaCatalogo(env.DB, PRIMA_PERSONA.id, t, TABS);
  await env.DB.batch([scriviStato(env.DB, "importato", new Date().toISOString()), scriviStato(env.DB, "da-copiare", "")]);
  return { profumi: t.Profumi.righe.length };
}
/* Pronto quando c'è la vista di Danilo nelle tabelle per persona. Se no: un database di prima della
   tappa 2 fa il passaggio, uno vuoto prende il catalogo dal foglio.
   Le anteprime dei branch su Cloudflare usano lo stesso database: il passaggio lo fa solo il ponte
   pubblicato (o quello locale delle prove), mai un'anteprima, così nessuna scrittura resta indietro.
   Il giro ogni 5 minuti (senza indirizzo) gira solo sul ponte pubblicato. */
const PUO_FARE_IL_PASSAGGIO = /^(sillage\.danilo-moro96\.workers\.dev|127\.0\.0\.1|localhost)$/;
async function pronto(env, host) {
  await schema(env);
  if (await leggiStato(env.DB, "vista:" + PRIMA_PERSONA.id)) return true;
  if (await leggiStato(env.DB, "vista")) {
    if (host && !PUO_FARE_IL_PASSAGGIO.test(host)) throw new Error("questa è un'anteprima: il passaggio alle tabelle per persona lo fa solo il ponte pubblicato");
    await passaggio(env.DB);
  } else await importa(env);
  return true;
}

// ── LETTURA ───────────────────────────────────────────────────────────────
const vocePerApp = r => ({ data: r.data, id: r.id, t: r.t, nota: r.nota, voto: r.voto, occasione: r.occasione, momento: r.momento });
/* `chi` (solo per azione=leggi) dice all'app chi ha riconosciuto: persona, nome, se dalla chiave o
   dall'accesso, l'email dell'account, e se l'accesso è da collegare o non valido. */
async function corpo(db, persona, conDiario, chi) {
  const pezzo = await leggiStato(db, "vista:" + persona);
  if (!pezzo) return null;
  let s = "{" + pezzo;
  if (conDiario) {
    const voci = (await db.prepare("SELECT * FROM voci WHERE persona = ? ORDER BY t").bind(persona).all()).results;
    s += ',"diario":' + JSON.stringify(voci.map(vocePerApp));
  } else s += ',"diarioChiuso":true';
  if (chi) s += ',"chi":' + JSON.stringify(chi);
  return s + ',"aggiornato":' + JSON.stringify(new Date().toISOString()) + "}";
}

// ── SCRITTURE DALL'APP ────────────────────────────────────────────────────
async function idValidi(db, persona) {
  const s = await leggiStato(db, "ids:" + persona);
  return new Set(s ? JSON.parse(s) : []);
}

/* Le stesse regole del Web App (Diario.gs), con le stesse risposte, sul diario di una persona. */
async function scriviDiario(db, persona, p) {
  const id = Number(p.get("id")), data = String(p.get("data") || ""), t = String(p.get("t") || ""), op = p.get("op");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{10,16}$/.test(t)) return { errore: "voce non valida" };
  if (!(await idValidi(db, persona)).has(id)) return { errore: "profumo sconosciuto: " + id };
  const ora = Date.now();
  const v = await db.prepare("SELECT * FROM voci WHERE persona = ? AND t = ?").bind(persona, t).first();
  const segna = scriviStato(db, "da-copiare", ora);

  if (op === "togli") {
    if (!v) return { ok: true, assente: true };
    await db.batch([db.prepare("DELETE FROM voci WHERE persona = ? AND t = ?").bind(persona, t), segna]);
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
    await db.batch([db.prepare("UPDATE voci SET nota = ?, voto = ?, occasione = ?, momento = ?, aggiornato = ? WHERE persona = ? AND t = ?")
      .bind(nota, vv, uso.occasione, uso.momento, ora, persona, t), segna]);
    return { ok: true, nota: true, uso: true };
  }
  if (v) return { ok: true, gia: true };
  const nelGiorno = await db.prepare("SELECT COUNT(*) AS n FROM voci WHERE persona = ? AND data = ?").bind(persona, data).first("n");
  if (nelGiorno >= MAX_GIORNO) return { errore: "troppe voci per il " + data };
  await db.batch([db.prepare("INSERT INTO voci (persona, t, data, id, occasione, momento, aggiornato) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(persona, t, data, id, uso.occasione, uso.momento, ora), segna]);
  return { ok: true, uso: true };
}

/* Il residuo cambia una cella del possesso; la vista della persona si ricalcola nello stesso colpo. */
async function segnaResiduo(db, persona, p) {
  const id = Number(p.get("id")), v = Number(p.get("valore"));
  if (!id || !RESIDUI.includes(v)) return { errore: "valore non valido" };
  const t = await leggiTabsPersona(db, persona);
  const r = t.Profumi.righe.find(x => Number(x.id) === id);
  if (!r) return { errore: "profumo sconosciuto: " + id };
  if (!t.Profumi.colonne.includes("residuo_pct")) return { errore: "manca la colonna residuo_pct" };
  r.residuo_pct = String(v);
  const ora = Date.now();
  await db.batch([
    db.prepare("UPDATE possessi SET residuo_pct = ?, aggiornato = ? WHERE persona = ? AND scheda = ?").bind(String(v), ora, persona, id),
    ...passiVista(db, persona, t, ora)
  ]);
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

// ── LE TABELLE PER PERSONA (account, tappa 1) ─────────────────────────────
/* Dalla tappa 2 queste sono l'originale. Ogni riga di Profumi è divisa nella scheda (i dati del profumo,
   uguali per tutti) e nel possesso (boccetta o campione, ml, residuo, note personali di chi lo ha).
   Diario (voci), layering e consigli sono di ciascuno; le note olfattive restano comuni (tab Note, in
   `tabelle`). Il ponte continua a lavorare con le «tab» del foglio: leggiTabsPersona le ricompone,
   salvaCatalogo le divide di nuovo. Per ora c'è una persona sola, Danilo. */
const PRIMA_PERSONA = { id: "danilo", nome: "Danilo", ruolo: "curatore" };
const COLONNE_POSSESSO = ["tipo_possesso", "formato_ml", "num_flaconi", "residuo_pct", "note_personali", "aggiunto", "attivo", "nuovo"];
const TABS_PERSONA = ["Layering", "Consigli", "ConsigliVoci"];

/** Divide le righe di Profumi in schede e possessi; segnala le righe senza un id valido o con un id ripetuto. */
function dividiProfumi(profumi) {
  const schede = [], possessi = [], problemi = [], visti = new Set();
  piene(profumi.righe).forEach((r, posto) => {
    const id = Number(r.id);
    if (!Number.isInteger(id) || id <= 0) { problemi.push("riga " + (posto + 1) + ": id non valido «" + breve(r.id) + "»"); return; }
    if (visti.has(id)) { problemi.push("id " + id + " ripetuto"); return; }
    visti.add(id);
    const dati = {}, p = { scheda: id, posto };
    for (const [c, v] of Object.entries(r)) (COLONNE_POSSESSO.includes(c) ? p : dati)[c] = v;
    schede.push({ id, dati });
    possessi.push(p);
  });
  return { schede, possessi, problemi };
}

/** Il contrario: dalle schede e dai possessi di una persona, le righe di Profumi come le ha il catalogo di oggi. */
function ricomponiProfumi(colonne, schede, possessi) {
  const perId = new Map(schede.map(s => [Number(s.id), s.dati]));
  const righe = [...possessi].sort((a, b) => a.posto - b.posto).map(p => {
    const dati = perId.get(Number(p.scheda)) || {}, r = {};
    [...colonne, ...Object.keys(dati).filter(c => !colonne.includes(c))].forEach(c => {
      if (COLONNE_POSSESSO.includes(c)) r[c] = p[c] ?? "";
      else if (c in dati) r[c] = dati[c];
    });
    return r;
  });
  return { colonne, righe };
}

// JSON con le chiavi in ordine: due oggetti uguali danno lo stesso testo anche se le chiavi sono in un altro ordine
const canonico = v => JSON.stringify(v, (k, x) =>
  x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(c => [c, x[c]])) : x);

/** Confronta quello che l'app riceve dalle tabelle vecchie e dalle nuove. */
function confrontaViste(vecchia, nuova) {
  const a = JSON.parse("{" + vecchia.pezzo + "}"), b = JSON.parse("{" + nuova.pezzo + "}"), differenze = [];
  ["note", "layering", "consigli"].forEach(k => { if (canonico(a[k]) !== canonico(b[k])) differenze.push(k + ": diverso"); });
  if (a.profumi.map(p => p.id).join(",") !== b.profumi.map(p => p.id).join(",")) differenze.push("profumi: elenco o ordine diverso");
  const perId = new Map(b.profumi.map(p => [p.id, p]));
  a.profumi.forEach(p => {
    const q = perId.get(p.id);
    if (!q) return;
    const campi = [...new Set([...Object.keys(p), ...Object.keys(q)])].filter(c => canonico(p[c]) !== canonico(q[c]));
    if (campi.length) differenze.push("profumo " + p.id + ": " +
      campi.map(c => c + " " + breve(canonico(p[c]) ?? "—") + " → " + breve(canonico(q[c]) ?? "—")).join(", "));
  });
  return { identiche: !differenze.length, stessoTesto: vecchia.pezzo === nuova.pezzo, differenze: differenze.slice(0, 20) };
}

/** Le tab di una persona lette dalle tabelle nuove, nella stessa forma di leggiTabs: le sue schede e i suoi
    possessi ricomposti in Profumi, le sue tab, e la tab Note comune. Cinque letture in un colpo solo. */
async function leggiTabsPersona(db, persona) {
  const [s, p, tp, col, n] = await db.batch([
    db.prepare("SELECT id, dati FROM schede WHERE id IN (SELECT scheda FROM possessi WHERE persona = ?)").bind(persona),
    db.prepare("SELECT * FROM possessi WHERE persona = ? ORDER BY posto").bind(persona),
    db.prepare("SELECT tab, colonne, righe FROM tab_persona WHERE persona = ?").bind(persona),
    db.prepare("SELECT valore FROM stato WHERE chiave = 'colonne-profumi'"),
    db.prepare("SELECT colonne, righe FROM tabelle WHERE tab = 'Note'")
  ]);
  const colonne = JSON.parse((col.results[0] && col.results[0].valore) || "[]");
  const note = n.results[0] ? { colonne: JSON.parse(n.results[0].colonne), righe: JSON.parse(n.results[0].righe) } : { colonne: [], righe: [] };
  const t = { Profumi: ricomponiProfumi(colonne, s.results.map(r => ({ id: r.id, dati: JSON.parse(r.dati) })), p.results), Note: note };
  TABS_PERSONA.forEach(n => { t[n] = { colonne: [], righe: [] }; });
  tp.results.forEach(r => { t[r.tab] = { colonne: JSON.parse(r.colonne), righe: JSON.parse(r.righe) }; });
  return t;
}

/** Confronta le tabelle per persona con quelle di prima: catalogo per l'app e diario, voce per voce. Subito
    dopo il passaggio (o dopo azione=riporta) devono essere identiche; poi le differenze sono le scritture nuove. */
async function confronta(db) {
  const migrato = await leggiStato(db, "migrato");
  if (!migrato) return { errore: "le tabelle per persona sono ancora vuote" };
  const P = PRIMA_PERSONA.id;
  const esito = confrontaViste(vista(await leggiTabs(db)), vista(await leggiTabsPersona(db, P)));
  const COL = "t, data, id, nota, voto, occasione, momento";
  const d = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM (SELECT ${COL} FROM diario EXCEPT SELECT ${COL} FROM voci WHERE persona = ?)) AS mancano,
      (SELECT COUNT(*) FROM (SELECT ${COL} FROM voci WHERE persona = ? EXCEPT SELECT ${COL} FROM diario)) AS inPiu`).bind(P, P).first();
  if (d.mancano || d.inPiu) {
    esito.identiche = false;
    esito.differenze.push("diario: " + d.mancano + " voci mancano nelle tabelle nuove, " + d.inPiu + " ci sono in più");
  }
  return { migrato, ...esito };
}

// ── SCRIVERE LE TABELLE PER PERSONA ───────────────────────────────────────
/* `cond` serve al passaggio: un pezzo di SQL («AND …») che ferma la scrittura se il passaggio è già fatto. */
const conPersona = (db, persona, ora, cond = "") => db.prepare(
  `INSERT INTO persone (id, nome, ruolo, creata) SELECT ?, ?, ?, ? WHERE 1${cond} ON CONFLICT(id) DO NOTHING`)
  .bind(persona, persona === PRIMA_PERSONA.id ? PRIMA_PERSONA.nome : persona, persona === PRIMA_PERSONA.id ? PRIMA_PERSONA.ruolo : "persona", ora);

/** Schede (aggiornate, mai cancellate: altri possono averle) e possessi di una persona (riscritti). Tre operazioni. */
function scritturaProfumi(db, persona, schede, possessi, ora, cond = "") {
  const daPossessi = possessi.map(p => Object.fromEntries(
    [["scheda", p.scheda], ["posto", p.posto], ...COLONNE_POSSESSO.map(c => [c, p[c] ?? null])]));
  return [
    db.prepare(`INSERT INTO schede (id, dati, aggiornato)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.dati'), ? FROM json_each(?) WHERE 1${cond}
      ON CONFLICT(id) DO UPDATE SET dati = excluded.dati, aggiornato = excluded.aggiornato`)
      .bind(ora, JSON.stringify(schede.map(s => ({ id: s.id, dati: JSON.stringify(s.dati) })))),
    db.prepare(`DELETE FROM possessi WHERE persona = ?${cond}`).bind(persona),
    db.prepare(`INSERT INTO possessi (persona, scheda, posto, ${COLONNE_POSSESSO.join(", ")}, aggiornato)
      SELECT ?, json_extract(value, '$.scheda'), json_extract(value, '$.posto'),
             ${COLONNE_POSSESSO.map(c => `json_extract(value, '$.${c}')`).join(", ")}, ? FROM json_each(?) WHERE 1${cond}`)
      .bind(persona, ora, JSON.stringify(daPossessi))
  ];
}
const scritturaTab = (db, persona, n, tab, ora, cond = "") => db.prepare(
  `INSERT INTO tab_persona (persona, tab, colonne, righe, aggiornato) SELECT ?, ?, ?, ?, ? WHERE 1${cond}
   ON CONFLICT(persona, tab) DO UPDATE SET colonne = excluded.colonne, righe = excluded.righe, aggiornato = excluded.aggiornato`)
  .bind(persona, n, JSON.stringify(tab.colonne), JSON.stringify(tab.righe), ora);
const scriviStatoSe = (db, k, v, cond = "") => db.prepare(
  `INSERT INTO stato (chiave, valore) SELECT ?, ? WHERE 1${cond} ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore`)
  .bind(k, String(v));

/** Il catalogo pronto per l'app (vista), gli id validi e il segno che il foglio va ricopiato. */
function passiVista(db, persona, t, ora, cond = "") {
  const v = vista(t);
  return [scriviStatoSe(db, "ids:" + persona, JSON.stringify(v.ids), cond), scriviStatoSe(db, "da-copiare", ora, cond),
          scriviStatoSe(db, "vista:" + persona, v.pezzo, cond)];   // per ultima: il passaggio guarda questa
}

/** Salva le tab cambiate del catalogo di una persona e ricalcola la sua vista: tutto in un colpo solo. */
async function salvaCatalogo(db, persona, t, cambiate) {
  const ora = Date.now(), passi = [conPersona(db, persona, ora)];
  if (cambiate.includes("Profumi")) {
    const { schede, possessi, problemi } = dividiProfumi(t.Profumi);
    if (problemi.length) throw new Error("catalogo non valido: " + problemi.join("; "));
    passi.push(...scritturaProfumi(db, persona, schede, possessi, ora), scriviStato(db, "colonne-profumi", JSON.stringify(t.Profumi.colonne)));
  }
  TABS_PERSONA.filter(n => cambiate.includes(n)).forEach(n => passi.push(scritturaTab(db, persona, n, t[n], ora)));
  if (cambiate.includes("Note")) passi.push(db.prepare(
    `INSERT INTO tabelle (tab, colonne, righe, aggiornato) VALUES ('Note', ?, ?, ?)
     ON CONFLICT(tab) DO UPDATE SET colonne = excluded.colonne, righe = excluded.righe, aggiornato = excluded.aggiornato`)
    .bind(JSON.stringify(t.Note.colonne), JSON.stringify(t.Note.righe), ora));
  passi.push(...passiVista(db, persona, t, ora));
  await db.batch(passi);
}

/* IL PASSAGGIO (tappa 2): la prima richiesta dopo la pubblicazione trova un database con le tabelle di prima
   e senza «vista:danilo». Copia tutto nelle tabelle per persona (diario compreso) in un colpo solo; da lì
   il ponte legge e scrive solo quelle. Ogni scrittura ha la condizione NON_ANCORA: se due richieste
   partono insieme, la seconda non tocca niente, perché la prima ha già scritto «vista:danilo». */
const NON_ANCORA = " AND NOT EXISTS (SELECT 1 FROM stato WHERE chiave = 'vista:" + PRIMA_PERSONA.id + "')";
async function passaggio(db) {
  const vecchie = await leggiTabs(db);
  const { schede, possessi, problemi } = dividiProfumi(vecchie.Profumi);
  if (problemi.length) throw new Error("passaggio alle tabelle per persona fermo, catalogo da sistemare: " + problemi.join("; "));
  const ora = Date.now(), P = PRIMA_PERSONA.id, c = NON_ANCORA;
  const nuove = { ...vecchie, Profumi: ricomponiProfumi(vecchie.Profumi.colonne, schede, possessi) };
  await db.batch([
    conPersona(db, P, ora, c),
    ...scritturaProfumi(db, P, schede, possessi, ora, c),
    db.prepare(`DELETE FROM voci WHERE persona = ?${c}`).bind(P),
    db.prepare(`INSERT INTO voci (persona, t, data, id, nota, voto, occasione, momento, aggiornato)
      SELECT ?, t, data, id, nota, voto, occasione, momento, aggiornato FROM diario WHERE 1${c}`).bind(P),
    ...TABS_PERSONA.map(n => scritturaTab(db, P, n, vecchie[n], ora, c)),
    scriviStatoSe(db, "colonne-profumi", JSON.stringify(vecchie.Profumi.colonne), c),
    scriviStatoSe(db, "migrato", new Date(ora).toISOString(), c),
    ...passiVista(db, P, nuove, ora, c)
  ]);
}

/* LA VIA DI RITORNO: riscrive le tabelle di prima con quello che c'è nelle nuove (catalogo e diario di
   Danilo), così il ponte della tappa 1 riparte senza perdere niente. Da lanciare prima di annullare la tappa 2. */
async function riporta(db) {
  const P = PRIMA_PERSONA.id, t = await leggiTabsPersona(db, P);
  await salvaTabs(db, t, TABS);
  await db.batch([
    db.prepare("DELETE FROM diario"),
    db.prepare(`INSERT INTO diario (t, data, id, nota, voto, occasione, momento, aggiornato)
      SELECT t, data, id, nota, voto, occasione, momento, aggiornato FROM voci WHERE persona = ?`).bind(P)
  ]);
  return { ok: true, riportato: true, ...(await confronta(db)) };
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
  // il foglio è la copia di Danilo: i dati delle altre persone non ci vanno
  const P = PRIMA_PERSONA.id, t = await leggiTabsPersona(db, P);
  if (!t.Profumi.righe.length) throw new Error("catalogo vuoto: non copio niente");
  const nomi = new Map(t.Profumi.righe.map(r => [Number(r.id), (r.marchio + " " + r.profumo).trim()]));
  const voci = (await db.prepare("SELECT * FROM voci WHERE persona = ? ORDER BY t").bind(P).all()).results.map(v => ({
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
  await pronto(env, url.hostname);
  // chi legge senza chiave né accesso vede la vetrina di Danilo, senza diario, come prima degli account
  const P = PRIMA_PERSONA.id;

  if (request.method === "GET") {
    if (url.searchParams.has("stato")) {
      const [ultima, daCopiare, importato, ids, migrato] = await Promise.all(
        ["ultima-copia", "da-copiare", "importato", "ids:" + P, "migrato"].map(k => leggiStato(db, k)));
      return json({ originale: "database", profumi: ids ? JSON.parse(ids).length : 0, catalogoDalFoglio: importato,
                    ultimaCopiaNelFoglio: ultima, copiaInAttesa: !!daCopiare, tabellePerPersonaDal: migrato });
    }
    return testo(await corpo(db, P, false));
  }
  if (request.method !== "POST") return json({ errore: "metodo non previsto" }, 405);

  // i parametri arrivano sia nell'indirizzo sia nel corpo, come per il Web App
  const p = new URLSearchParams(url.search);
  const ct = request.headers.get("Content-Type") || "";
  if (!ct || /x-www-form-urlencoded|text\/plain/.test(ct)) new URLSearchParams(await request.text()).forEach((v, k) => p.set(k, v));
  const azione = p.get("azione");

  if (azione === "leggi") {
    const chi = await chiE(env, db, p);
    return testo(await corpo(db, chi.persona || P, !!chi.persona, chi));
  }
  if (azione === "collega") return json(await collega(env, db, p));
  if (azione === "registrati") return json(await registrati(env, db, p));
  if (["diario", "residuo", "possesso", "catalogo", "vetrine", "vetrina"].includes(azione)) {
    // tutto di chi scrive (o guarda): l'accesso collegato o, fino alla tappa 5, la chiave
    const chi = await chiE(env, db, p);
    if (!chi.persona) return json(senzaPersona(chi));
    if (azione === "catalogo") return json(await catalogo(db));
    if (azione === "vetrine") return json(await vetrine(db));
    if (azione === "vetrina") return json(await vetrina(db, p.get("di")));
    const esito = azione === "diario" ? await scriviDiario(db, chi.persona, p)
      : azione === "residuo" ? await segnaResiduo(db, chi.persona, p) : await possesso(db, chi.persona, p);
    if (esito.ok && !esito.gia && !esito.assente) copiaDopo(env, ctx);
    return json(esito);
  }
  // il resto (catalogo, copia nel foglio, passaggio) solo con la chiave: sono lavori di Claude, non dell'app
  if (!["modifica", "sincronizza", "importa", "confronta", "riporta"].includes(azione)) return json({ errore: "azione sconosciuta: " + azione });
  if (!chiaveGiusta(env, p)) return json(SENZA_CHIAVE);

  if (azione === "confronta") return json(await confronta(db));
  if (azione === "riporta") {
    if (p.get("conferma") !== "si") return json({ errore: "riporta riscrive le tabelle di prima con quelle per persona: aggiungi conferma=si" });
    return json(await riporta(db));
  }

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
    const t = await leggiTabsPersona(db, P), prova = p.get("prova") === "1";
    const esito = applicaModifiche(t, m, prova);
    if (!prova && esito.cambiate.length) { await salvaCatalogo(db, P, t, esito.cambiate); copiaDopo(env, ctx); }
    return json(esito);
  }
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
