/* Prove della coda del diario (src/diario/coda.ts), senza browser.

   Si lancia dalla cartella app/:
     node strumenti/prova-coda.mjs                  con un ponte finto in memoria (stesse regole di ponte/ponte.js)
     node strumenti/prova-coda.mjs --ponte-locale   in più, le stesse scritture contro il ponte locale
                                                    (wrangler dev su 127.0.0.1:8787 con SILLAGE_CHIAVE=prova)
   Mai contro il ponte pubblicato. Esce con codice 1 se una prova fallisce. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const uscita = await build({ entryPoints: [join(APP, "src", "diario", "coda.ts")], bundle: true, format: "esm", platform: "node", write: false });
const file = join(mkdtempSync(join(tmpdir(), "sillage-coda-")), "coda.mjs");
writeFileSync(file, uscita.outputFiles[0].text);
const { Diario, oggiISO } = await import(pathToFileURL(file).href);

// ── strumenti di prova ──
let passate = 0,
  fallite = 0;
const verifica = (cond, testo) => {
  if (cond) passate++;
  else {
    fallite++;
    console.log("   ✗ " + testo);
  }
};
async function prova(nome, f) {
  const prima = fallite;
  try {
    await f();
  } catch (e) {
    fallite++;
    console.log("   ✗ eccezione: " + (e.stack || e.message));
  }
  console.log((fallite === prima ? "✓ " : "✗ ") + nome);
}
const memoriaFinta = () => {
  const m = new Map();
  return { leggi: (k) => m.get(k) ?? null, scrivi: (k, v) => m.set(k, v), m };
};

/* Il ponte finto: le stesse risposte di scriviDiario in ponte/ponte.js, più tre interruttori
   per simulare la rete che manca, un errore 500 e la chiave sbagliata. */
function ponteFinto() {
  const db = new Map();
  const s = { db, invii: [], rete: true, guasto: false, chiaveGiusta: true, ids: new Set([1, 2, 3, 24, 33]) };
  s.trasporto = async (p) => {
    if (!s.rete) throw new TypeError("Failed to fetch");
    s.invii.push({ ...p });
    if (s.guasto) return { stato: 500, corpo: { errore: "il ponte ha avuto un problema: prova" } };
    if (!s.chiaveGiusta) return { stato: 200, corpo: { errore: "chiave sconosciuta: manca o non e' quella giusta" } };
    const id = Number(p.id), t = String(p.t), v = db.get(t);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(p.data) || !/^\d{10,16}$/.test(t)) return { stato: 200, corpo: { errore: "voce non valida" } };
    if (!s.ids.has(id)) return { stato: 200, corpo: { errore: "profumo sconosciuto: " + id } };
    if (p.op === "togli") {
      if (!v) return { stato: 200, corpo: { ok: true, assente: true } };
      db.delete(t);
      return { stato: 200, corpo: { ok: true, tolta: true } };
    }
    const uso = { occasione: p.occasione || "", momento: p.momento || "" };
    if (p.op === "nota") {
      if (!v) return { stato: 200, corpo: { errore: "voce non trovata" } };
      Object.assign(v, { nota: p.nota || "", voto: Number(p.voto) || null, ...uso });
      return { stato: 200, corpo: { ok: true, nota: true, uso: true } };
    }
    if (v) return { stato: 200, corpo: { ok: true, gia: true } };
    if ([...db.values()].filter((x) => x.data === p.data).length >= 10) return { stato: 200, corpo: { errore: "troppe voci per il " + p.data } };
    db.set(t, { data: p.data, id, t, nota: "", voto: null, ...uso });
    return { stato: 200, corpo: { ok: true, uso: true } };
  };
  return s;
}
const OGGI = oggiISO();
let orologio = Date.now(); // un orologio che avanza di un millisecondo a ogni voce: t sempre diversi
const ora = () => orologio++;
const nuovo = (memoria, ponte) => new Diario(memoria, ponte.trasporto, ora);

// ── le prove ──
await prova("metti senza rete: la voce si vede subito, parte una volta sola quando torna la rete", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  p.rete = false;
  d.segna(24, OGGI, { occasione: "ufficio", momento: "giorno" });
  await d.sincronizza();
  verifica(d.indossatoOggi(24), "la voce non si vede");
  verifica(d.coda().length === 1, "la coda dovrebbe avere una voce");
  verifica(p.invii.length === 0, "senza rete non dovrebbe partire niente");
  p.rete = true;
  await Promise.all([d.sincronizza(), d.sincronizza(), d.sincronizza()]); // tre richiami insieme: un invio solo
  verifica(p.invii.length === 1, `inviata ${p.invii.length} volte invece di una`);
  verifica(d.coda().length === 0, "la coda dovrebbe essere vuota");
  verifica(p.db.size === 1 && [...p.db.values()][0].occasione === "ufficio", "il ponte non ha la voce con l'occasione");
  verifica(d.confermate().length === 1 && d.indossatoOggi(24), "la voce dovrebbe essere confermata e visibile");
  await d.sincronizza();
  verifica(p.invii.length === 1, "un altro giro non deve rimandarla");
});

await prova("l'app si chiude con la coda piena: alla riapertura la coda c'è ancora e parte", async () => {
  const mem = memoriaFinta(), p = ponteFinto();
  p.rete = false;
  const d1 = nuovo(mem, p);
  d1.segna(1, OGGI);
  d1.segna(2, OGGI);
  const d2 = nuovo(mem, p); // «riapertura»: stessa memoria, oggetto nuovo
  verifica(d2.coda().length === 2 && d2.vociDelGiorno(OGGI).length === 2, "la coda non è sopravvissuta");
  p.rete = true;
  await d2.sincronizza();
  verifica(p.db.size === 2 && d2.coda().length === 0, "la coda ritrovata non è partita");
});

await prova("togli prima dell'invio: sparisce dalla coda e non parte niente", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  p.rete = false;
  d.segna(24, OGGI);
  d.segna(24, OGGI); // di nuovo: lo toglie
  verifica(d.coda().length === 0, "la coda dovrebbe essere vuota");
  verifica(!d.indossatoOggi(24), "la voce non dovrebbe vedersi");
  p.rete = true;
  await d.sincronizza();
  verifica(p.invii.length === 0, "non doveva partire niente");
});

await prova("togli una voce già confermata senza rete: sparisce subito, il ponte lo sa al ritorno", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  d.segna(3, OGGI);
  await d.sincronizza();
  p.rete = false;
  d.segna(3, OGGI);
  verifica(!d.indossatoOggi(3), "la voce tolta si vede ancora");
  verifica(d.coda().length === 1 && d.coda()[0].op === "togli", "in coda dovrebbe esserci un togli");
  p.rete = true;
  await d.sincronizza();
  verifica(p.db.size === 0 && d.coda().length === 0 && d.confermate().length === 0, "il togli non è arrivato");
});

await prova("appunto su una voce ancora in coda: arriva al ponte dopo la voce", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  p.rete = false;
  d.segna(24, OGGI);
  const t = d.coda()[0].t;
  d.aggiornaVoce(t, { nota: "durato tutto il giorno", voto: 5 });
  verifica(d.coda().length === 1, "l'appunto su una voce in coda deve correggere quella voce, non aggiungerne una");
  verifica(d.voci()[0].nota === "durato tutto il giorno", "l'appunto non si vede subito");
  p.rete = true;
  await d.sincronizza();
  const v = p.db.get(String(t));
  verifica(v && v.nota === "durato tutto il giorno" && v.voto === 5, "il ponte non ha l'appunto: " + JSON.stringify(v));
  verifica(d.coda().length === 0, "la coda dovrebbe essere vuota");
  verifica(p.invii.map((x) => x.op).join(",") === "metti,nota", "ordine degli invii: " + p.invii.map((x) => x.op).join(","));
});

await prova("appunto su una voce già confermata: parte un op=nota con tutti i campi", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  d.segna(24, OGGI, { occasione: "appuntamento", momento: "sera" });
  await d.sincronizza();
  const t = d.confermate()[0].t;
  p.rete = false;
  d.aggiornaVoce(t, { nota: "complimenti", voto: 4 });
  verifica(d.coda().length === 1 && d.coda()[0].op === "nota", "dovrebbe esserci un op nota in coda");
  verifica(d.voci()[0].nota === "complimenti" && d.voci()[0].occasione === "appuntamento", "l'appunto in attesa non si vede sopra la voce");
  d.aggiornaVoce(t, { voto: 5 }); // un secondo ritocco sostituisce il primo, non lo duplica
  verifica(d.coda().length === 1 && d.coda()[0].voto === 5 && d.coda()[0].nota === "complimenti", "il secondo ritocco ha perso qualcosa");
  p.rete = true;
  await d.sincronizza();
  const v = p.db.get(String(t));
  verifica(v.nota === "complimenti" && v.voto === 5 && v.occasione === "appuntamento" && v.momento === "sera", "il ponte ha: " + JSON.stringify(v));
  verifica(d.confermate()[0].nota === "complimenti", "la copia confermata non è aggiornata");
});

await prova("errore 500 del ponte: la voce resta in coda e parte al giro dopo", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  p.guasto = true;
  d.segna(24, OGGI);
  await d.sincronizza();
  verifica(d.coda().length === 1 && d.indossatoOggi(24), "dopo il 500 la voce doveva restare in coda e visibile");
  p.guasto = false;
  await d.sincronizza();
  verifica(d.coda().length === 0 && p.db.size === 1, "al giro dopo doveva partire");
});

await prova("chiave sbagliata: la voce resta in coda e l'app sa che serve la chiave", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  p.chiaveGiusta = false;
  d.segna(24, OGGI);
  await d.sincronizza();
  verifica(d.coda().length === 1 && d.serveChiave, "la voce doveva restare e serveChiave essere vero");
  p.chiaveGiusta = true;
  d.impostaConfermate([]); // la chiave giusta: il ponte rilegge il diario
  await d.sincronizza();
  verifica(d.coda().length === 0 && !d.serveChiave && p.db.size === 1, "con la chiave giusta doveva partire");
});

await prova("azione che il ponte non conosce ancora («sconosciuta:»): la voce resta in coda", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  const vero = p.trasporto;
  p.trasporto = async (x) => (p.invii.push(x), { stato: 200, corpo: { errore: "azione sconosciuta: diario" } });
  const d2 = new Diario(mem, (x) => p.trasporto(x), ora);
  d2.segna(24, OGGI);
  await d2.sincronizza();
  verifica(d2.coda().length === 1, "«sconosciuta:» non doveva perdere la voce");
  p.trasporto = vero;
  await d2.sincronizza();
  verifica(d2.coda().length === 0 && p.db.size === 1, "al giro dopo doveva partire");
  void d;
});

await prova("rifiuto definitivo (troppe voci): la voce esce dalla coda e l'app lo dice", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  for (let i = 0; i < 10; i++) p.db.set("17000000000" + String(i).padStart(2, "0"), { data: OGGI, id: 1, t: "x" });
  d.segna(24, OGGI);
  await d.sincronizza();
  verifica(d.coda().length === 0, "un rifiuto definitivo bloccherebbe la coda per sempre");
  verifica(/troppe voci/.test(d.ultimoRifiuto || ""), "l'app deve sapere del rifiuto");
});

await prova("due profumi al giorno al massimo; il layering prende il giorno e si toglie intero", async () => {
  const mem = memoriaFinta(), p = ponteFinto(), d = nuovo(mem, p);
  p.rete = false;
  verifica(d.segna(1, OGGI).ok && d.segna(2, OGGI).ok, "i primi due dovevano entrare");
  const terzo = d.segna(3, OGGI);
  verifica(!terzo.ok && /due profumi/.test(terzo.avviso), "il terzo doveva essere rifiutato con un avviso");
  d.segna(2, OGGI); // toglie il secondo
  verifica(d.segnaLayering(1, 3, OGGI).ok, "il layering con il singolo già segnato doveva entrare");
  const v = d.vociDelGiorno(OGGI);
  verifica(v.length === 2 && v.every((x) => String(x.t).length === 14), "il giorno doveva avere la coppia");
  verifica(JSON.stringify(d.layeringDel(OGGI)) === JSON.stringify({ sotto: 1, sopra: 3 }), "sotto e sopra sbagliati");
  d.segna(3, OGGI); // togliere metà del layering lo toglie tutto
  verifica(d.vociDelGiorno(OGGI).length === 0 && d.coda().length === 0, "il layering doveva sparire tutto, e la coda svuotarsi");
});

// ── le stesse scritture contro il ponte locale ──
if (process.argv.includes("--ponte-locale")) {
  const URL_LOCALE = "http://127.0.0.1:8787/api";
  const trasporto = async (p) => {
    const r = await fetch(URL_LOCALE + "?" + new URLSearchParams(p), { method: "POST", body: new URLSearchParams({ chiave: "prova" }) });
    return { stato: r.status, corpo: await r.json().catch(() => null) };
  };
  const leggiDiario = async () =>
    (await (await fetch(URL_LOCALE, { method: "POST", body: new URLSearchParams({ azione: "leggi", chiave: "prova" }) })).json()).diario;
  await prova("ponte locale: metti, appunto, togli, e il diario riletto coincide", async () => {
    const mem = memoriaFinta();
    let rete = false;
    const d = new Diario(mem, (p) => (rete ? trasporto(p) : Promise.reject(new TypeError("offline"))), () => Date.now());
    const giorno = "2026-01-0" + (1 + (Date.now() % 9)); // un giorno passato qualsiasi, per non toccare oggi
    d.segna(24, giorno, { occasione: "ufficio", momento: "giorno" });
    const t = d.coda()[0].t;
    d.aggiornaVoce(t, { nota: "prova locale", voto: 4 });
    rete = true;
    await d.sincronizza();
    let v = (await leggiDiario()).find((x) => String(x.t) === String(t));
    verifica(v && v.nota === "prova locale" && v.voto === 4 && v.occasione === "ufficio", "il ponte locale ha: " + JSON.stringify(v));
    d.impostaConfermate(await leggiDiario());
    d.segna(24, giorno);
    await d.sincronizza();
    v = (await leggiDiario()).find((x) => String(x.t) === String(t));
    verifica(!v && d.coda().length === 0, "il togli non è arrivato al ponte locale");
  });
}

console.log(`\n${passate} verifiche passate, ${fallite} fallite.`);
process.exit(fallite ? 1 : 0);
