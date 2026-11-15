/* Prove degli account sul ponte LOCALE (127.0.0.1:8787, chiave «prova») con il Supabase FINTO (8898):
   accesso non collegato, collegamento solo con chiave e accesso insieme, diario e residuo col solo accesso,
   token scaduti, falsi, di un altro progetto o con un'altra chiave, catalogo solo con la chiave, scollega.
   Mai contro il ponte pubblicato. Prima: node strumenti/supabase-finto.mjs e il ponte locale (app/LEGGIMI.md).
   Una volta sola su un database locale nuovo (alla fine ricollega l'account di prova a Danilo). */
import { firma } from "./supabase-finto.mjs";
const U = "http://127.0.0.1:8787/api";
const post = async (q, campi = {}) => (await fetch(U + "?" + q, { method: "POST", body: new URLSearchParams(campi) })).json();
let errori = 0;
const verifica = (cosa, ok, d = "") => { console.log((ok ? "  ok   " : "  NO!  ") + cosa + (ok ? "" : " — " + d)); if (!ok) errori++; };
const io = firma("danilo@esempio.it"), altro = firma("altra@esempio.it");
const J = (o) => JSON.stringify(o).slice(0, 300);

let r = await post("azione=leggi", { accesso: io });
verifica("accesso buono non collegato: niente diario, daCollegare", r.diarioChiuso === true && r.chi?.daCollegare === true && r.chi?.email === "danilo@esempio.it", J(r.chi));
r = await post("azione=diario&op=metti&id=24&data=2026-11-15&t=1763200000000", { accesso: io });
verifica("scrivere senza collegamento: rifiutato con «accesso…» (resta in coda)", /^accesso non ancora collegato/.test(r.errore || ""), J(r));
r = await post("azione=collega", { accesso: io });
verifica("collegare senza chiave: rifiutato", /^chiave/.test(r.errore || ""), J(r));
r = await post("azione=collega", { chiave: "prova", accesso: firma("danilo@esempio.it", { scade: -10 }) });
verifica("collegare con accesso scaduto: rifiutato", /scaduto/.test(r.errore || ""), J(r));
r = await post("azione=collega", { chiave: "prova", accesso: io });
verifica("collegare con chiave e accesso", r.ok === true && r.persona === "danilo", J(r));
r = await post("azione=collega", { chiave: "prova", accesso: altro });
verifica("un secondo account non sostituisce Danilo senza conferma", /già collegato/.test(r.errore || ""), J(r));
r = await post("azione=leggi", { accesso: io });
verifica("leggere con solo l'accesso: diario di Danilo", Array.isArray(r.diario) && r.chi?.persona === "danilo" && r.chi?.da === "accesso", J(r.chi));
const voci = r.diario.length;
r = await post("azione=diario&op=metti&id=24&data=2026-11-15&t=1763200000000", { accesso: io });
verifica("scrivere nel diario con solo l'accesso", r.ok === true, J(r));
r = await post("azione=residuo&id=24&valore=75", { accesso: io });
verifica("residuo con solo l'accesso", r.ok === true, J(r));
r = await post("azione=leggi", { chiave: "prova" });
verifica("con la chiave si vede la stessa voce (stessa persona)", r.diario.length === voci + 1 && r.chi?.da === "chiave", J(r.chi));
verifica("e lo stesso residuo", r.profumi.find((p) => p.id === 24).residuoPct === 75);
for (const [nome, t, atteso] of [
  ["scaduto", firma("danilo@esempio.it", { scade: -10 }), /accesso scaduto/],
  ["firmato con un'altra chiave", firma("danilo@esempio.it", { chiave: "estranea" }), /accesso non valido/],
  ["altro progetto (iss)", firma("danilo@esempio.it", { iss: "https://altro.supabase.co/auth/v1" }), /accesso non valido/],
  ["kid sconosciuto", firma("danilo@esempio.it", { kid: "boh" }), /accesso non valido/],
  ["pubblico sbagliato (anon)", firma("danilo@esempio.it", { aud: "anon" }), /accesso non valido/],
  ["spazzatura", "abc.def.ghi", /accesso non valido/]
]) {
  const w = await post("azione=diario&op=metti&id=24&data=2026-11-16&t=1763300000000", { accesso: t });
  verifica("token " + nome + ": scrittura rifiutata", atteso.test(w.errore || ""), J(w));
  const l = await post("azione=leggi", { accesso: t });
  verifica("token " + nome + ": niente diario", l.diarioChiuso === true && !!l.chi?.accessoNonValido, J(l.chi));
}
r = await post("azione=diario&op=metti&id=7&data=2026-11-16&t=1763300000001", { chiave: "prova", accesso: firma("danilo@esempio.it", { scade: -10 }) });
verifica("accesso scaduto ma chiave giusta: scrive (la chiave basta fino alla tappa 5)", r.ok === true, J(r));
r = await post("azione=diario&op=metti&id=7&data=2026-11-16&t=1763300000002", { accesso: altro });
verifica("altro account non collegato: rifiutato", /non ancora collegato/.test(r.errore || ""), J(r));
r = await post("azione=modifica", { accesso: io, dati: "{}" });
verifica("modificare il catalogo con l'accesso: no, solo con la chiave", /^chiave/.test(r.errore || ""), J(r));
r = await post("azione=sincronizza", { accesso: io });
verifica("sincronizza con l'accesso: no", /^chiave/.test(r.errore || ""), J(r));
const g = await (await fetch(U)).json();
verifica("GET senza niente: vetrina di Danilo, senza diario e senza «chi»", g.diarioChiuso === true && !g.chi && g.profumi.length === 41);
r = await post("azione=collega", { chiave: "prova", scollega: "si" });
verifica("scollegare con la chiave", r.scollegato === true, J(r));
r = await post("azione=leggi", { accesso: io });
verifica("dopo lo scollegamento l'accesso è di nuovo da collegare", r.chi?.daCollegare === true && r.diarioChiuso === true, J(r.chi));
r = await post("azione=collega", { chiave: "prova", accesso: io });
verifica("e si ricollega", r.ok === true, J(r));
console.log(errori ? "ERRORI: " + errori : "prove dell'accesso: tutto ok");
process.exitCode = errori ? 1 : 0;
