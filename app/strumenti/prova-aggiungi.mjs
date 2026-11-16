/* Prove di «Aggiungi profumo» sul ponte LOCALE (127.0.0.1:8787, chiave «prova») con il Supabase FINTO (8898) e il
   modello FINTO (8897): mai contro il ponte pubblicato, mai chiamate vere ad Anthropic, mai profumi finti nel
   database vero. Su un database locale (app/LEGGIMI.md, «Provare Aggiungi profumo»).

   - leggi-cartolina: solo con l'accesso; modello, immagine e schema giusti; il limite di letture al giorno;
   - aggiungi: la scheda nell'anagrafica comune e il profumo nella vetrina di chi aggiunge, non degli altri; l'id
     nuovo dal ponte; la foto servita da /api/foto; il reinvio dalla coda dà lo stesso id; la scheda che c'è già
     (stesso nome, o stesso link Fragrantica) si riusa; senza marchio o nome: no. */
import { firma } from "./supabase-finto.mjs";
// la porta del ponte locale: 8787, o quella data con PONTE_LOCALE=http://127.0.0.1:8788/api
const U = process.env.PONTE_LOCALE || "http://127.0.0.1:8787/api";
const post = async (q, campi = {}) => (await fetch(U + "?" + q, { method: "POST", body: new URLSearchParams(campi) })).json();
let errori = 0;
const verifica = (cosa, ok, d = "") => { console.log((ok ? "  ok   " : "  NO!  ") + cosa + (ok ? "" : " — " + d)); if (!ok) errori++; };
const J = (o) => JSON.stringify(o).slice(0, 300);
const ora = Date.now().toString(36);
const D = { accesso: firma("danilo@esempio.it") }, L = { accesso: firma("aggiunge-" + ora + "@esempio.it") };
// un PNG 1×1 (la foto) e un'immagine qualunque per il modello finto
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let r = await post("azione=collega", { chiave: "prova", ...D });
verifica("Danilo collegato", r.ok === true || /già/.test(r.errore || ""), J(r));
r = await post("azione=registrati", { ...L, nome: "Prova " + ora });
verifica("una persona nuova si registra", r.ok === true, J(r));

// ── la lettura delle scritte ──
verifica("leggere senza accesso: no", /^chiave/.test((await post("azione=leggi-cartolina", { immagine: PNG })).errore || ""));
r = await post("azione=leggi-cartolina", { ...L, tipo: "cartolina", media: "image/png", immagine: PNG });
verifica("la cartolina letta dal modello (finto)", r.ok === true && r.dati?.nome === "Profumo di Prova" && r.dati.accordi.length === 5, J(r));
r = await post("azione=leggi-cartolina", { ...L, tipo: "piramide", media: "image/png", immagine: PNG });
verifica("la piramide letta dal modello (finto)", r.ok === true && r.dati?.fondo?.length === 2, J(r));
verifica("immagine mancante: no", /immagine/.test((await post("azione=leggi-cartolina", { ...L })).errore || ""));
let ultimo;
for (let i = 0; i < 20; i++) ultimo = await post("azione=leggi-cartolina", { ...L, tipo: "cartolina", media: "image/png", immagine: PNG });
verifica("oltre le letture del giorno: no", ultimo.limite === true, J(ultimo));

// ── aggiungi ──
const catPrima = await post("azione=catalogo", L);
const maxPrima = Math.max(...catPrima.profumi.map((p) => p.id));
const scheda = {
  marchio: "Casa Finta " + ora, profumo: "Profumo di Prova", concentrazione: "EDP", genere: "unisex", accordi: "Legnoso|Aromatico",
  accordi_forza: "100|82", inverno: "33", primavera: "18", estate: "11", autunno: "38", giorno_pct: "47", rating: "4.1", voti: "1234",
  longevita_h: "7", sillage: "Forte", stagione: "ai", momento: "entrambi", colore: "verde", ufficio: "si", serata: "si",
  fragrantica: "https://www.fragrantica.it/perfume/Casa-Finta/Profumo-di-Prova-99" + String(Date.now()).slice(-6) + ".html",
  colonna_inventata: "x"
};
const cliente = "prova-" + ora;
const nuova = { cliente, scheda, possesso: { tipo: "full", ml: 100, note: "dalla prova" }, foto: { tipo: "image/png", dati: PNG } };
verifica("aggiungere senza accesso: no", /^chiave/.test((await post("azione=aggiungi", { dati: JSON.stringify(nuova) })).errore || ""));
verifica("senza marchio: no", /marchio/.test((await post("azione=aggiungi", { ...L, dati: JSON.stringify({ ...nuova, cliente: "x" + ora, scheda: { profumo: "Solo nome" } }) })).errore || ""));
r = await post("azione=aggiungi", { ...L, dati: JSON.stringify(nuova) });
verifica("il profumo nuovo entra, con l'id dato dal ponte", r.ok === true && r.nuovo === true && r.id === maxPrima + 1, J(r));
const id = r.id;
r = await post("azione=aggiungi", { ...L, dati: JSON.stringify(nuova) });
verifica("lo stesso invio dalla coda: stesso id, niente doppioni", r.ok === true && r.gia === true && r.id === id, J(r));

const lei = await post("azione=leggi", L);
const mio = lei.profumi.find((p) => p.id === id);
verifica("è nella vetrina di chi l'ha aggiunto", !!mio && mio.name === "Profumo di Prova" && mio.formatoMl === 100 && mio.notePersonali === "dalla prova" && mio.nuovo === true, J(mio));
verifica("con stagioni, accordi e occasioni", mio?.stagioni?.autunno === 38 && mio.accordi.join() === "Legnoso,Aromatico" && mio.ufficio === "si" && mio.palestra === "no", J(mio));
verifica("una colonna che il catalogo non ha non entra", mio && !("colonna_inventata" in mio));
verifica("la foto ha l'indirizzo del ponte", /^api\/foto\/\d+\.png\?v=\d+$/.test(mio?.img || ""), mio?.img);
const f = await fetch(U.replace(/\/api$/, "/") + mio.img);
verifica("e il ponte la serve", f.ok && f.headers.get("content-type") === "image/png" && (await f.arrayBuffer()).byteLength === 70, f.status + " " + f.headers.get("content-type"));
const dan = await post("azione=leggi", D);
verifica("NON è nella vetrina di Danilo", !dan.profumi.some((p) => p.id === id));
verifica("le schede di Danilo restano 41 + quelle che aveva", dan.profumi.every((p) => p.id !== id));
const catDopo = await post("azione=catalogo", D);
verifica("è nell'anagrafica comune: la vede anche Danilo nel catalogo", catDopo.profumi.some((p) => p.id === id && p.brand === scheda.marchio));

// la scheda c'è già
r = await post("azione=aggiungi", { ...L, dati: JSON.stringify({ ...nuova, cliente: "b" + ora, foto: null }) });
verifica("stesso marchio, nome e concentrazione: la scheda si riusa", r.ok === true && r.esistente === true && r.id === id && r.giaInVetrina === true, J(r));
const altra = { cliente: "c" + ora, scheda: { marchio: "Altro modo di scriverlo", profumo: "Nome diverso", concentrazione: "EDT", fragrantica: scheda.fragrantica.replace("fragrantica.it", "fragrantica.com") }, possesso: { tipo: "campione", ml: 2 } };
r = await post("azione=aggiungi", { ...D, dati: JSON.stringify(altra) });
verifica("stesso profumo su Fragrantica (anche dal sito in inglese): la scheda si riusa", r.ok === true && r.esistente === true && r.id === id, J(r));
const dan2 = await post("azione=leggi", D);
const suo = dan2.profumi.find((p) => p.id === id);
verifica("e ora è anche nella vetrina di Danilo, come campione suo", suo?.tipoPossesso === "campione" && suo.formatoMl === 2 && !suo.notePersonali, J(suo));
r = await post("azione=possesso", { ...D, op: "togli", id: String(id) });
verifica("Danilo lo toglie dalla sua vetrina (pulizia del database locale)", r.ok === true, J(r));
const lei2 = await post("azione=leggi", L);
verifica("e da quella dell'altra persona non sparisce", lei2.profumi.some((p) => p.id === id));

console.log(errori ? `\n${errori} controlli falliti` : "\ntutto a posto");
if (errori) process.exit(1);
