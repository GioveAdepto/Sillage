/* Prove della seconda persona e dell'isolamento sul ponte LOCALE (127.0.0.1:8787, chiave «prova») con il
   Supabase FINTO (8898): registrazione, vetrina vuota, catalogo comune, «Ce l'ho», diario e residuo propri,
   vetrine degli altri senza i dati privati, e soprattutto che una persona non legga né scriva niente di un'altra.
   Mai contro il ponte pubblicato. Su un database locale nuovo (app/LEGGIMI.md, «Provare gli account»). */
import { firma } from "./supabase-finto.mjs";
const U = "http://127.0.0.1:8787/api";
const post = async (q, campi = {}) => (await fetch(U + "?" + q, { method: "POST", body: new URLSearchParams(campi) })).json();
let errori = 0;
const verifica = (cosa, ok, d = "") => { console.log((ok ? "  ok   " : "  NO!  ") + cosa + (ok ? "" : " — " + d)); if (!ok) errori++; };
const J = (o) => JSON.stringify(o).slice(0, 300);
const io = firma("danilo@esempio.it"), lei = firma("lei@esempio.it");
const D = { accesso: io }, L = { accesso: lei };

// Danilo collega il suo account (come alla tappa 3)
let r = await post("azione=collega", { chiave: "prova", accesso: io });
verifica("Danilo collega il suo account", r.ok === true || /già/.test(r.errore || ""), J(r));
const pubblicoPrima = JSON.stringify({ ...(await (await fetch(U)).json()), aggiornato: 0 });
const danPrima = await post("azione=leggi", D);
verifica("Danilo legge il suo diario", Array.isArray(danPrima.diario) && danPrima.chi?.persona === "danilo", J(danPrima.chi));

// Lei: prima di registrarsi non è nessuno
r = await post("azione=leggi", L);
verifica("lei, prima di registrarsi: niente diario, vede la vetrina di Danilo come chiunque", r.diarioChiuso === true && r.chi?.daCollegare === true, J(r.chi));
verifica("lei, prima di registrarsi: niente catalogo", /^accesso/.test((await post("azione=catalogo", L)).errore || ""));
verifica("registrarsi senza nome: no", /nome/.test((await post("azione=registrati", L)).errore || ""));
verifica("registrarsi senza accesso: no", /^accesso/.test((await post("azione=registrati", { nome: "X" })).errore || ""));
r = await post("azione=registrati", { ...L, nome: "  Giulia   R. " });
verifica("lei si registra", r.ok === true && /^p[0-9a-z]{6}$/.test(r.persona) && r.nome === "Giulia R.", J(r));
const P = r.persona;
r = await post("azione=registrati", { ...L, nome: "Altro nome" });
verifica("registrarsi di nuovo: stessa persona", r.gia === true && r.persona === P, J(r));
verifica("Danilo non può registrarsi una seconda volta", (await post("azione=registrati", { ...D, nome: "Doppio" })).persona === "danilo");

r = await post("azione=leggi", L);
verifica("la sua vetrina è vuota e il suo diario pure", r.chi?.persona === P && r.profumi.length === 0 && Array.isArray(r.diario) && r.diario.length === 0, J({ chi: r.chi, n: r.profumi?.length }));
verifica("niente layering né consigli di Danilo", r.layering.length === 0 && r.consigli.length === 0);
verifica("le note olfattive sono comuni", r.note.length === danPrima.note.length);

const cat = await post("azione=catalogo", L);
verifica("catalogo comune: 41 schede", cat.profumi?.length === 41, J(cat).slice(0, 100));
verifica("il catalogo non ha dati personali", cat.profumi.every((x) => !("notePersonali" in x) && !("residuoPct" in x) && !("tipoPossesso" in x)));

// Ce l'ho
r = await post("azione=possesso&op=aggiungi&id=24&tipo=campione&ml=2", L);
verifica("«Ce l'ho» (campione da 2 ml)", r.aggiunto === true, J(r));
verifica("«Ce l'ho» di nuovo: già", (await post("azione=possesso&op=aggiungi&id=24", L)).gia === true);
verifica("«Ce l'ho» di un profumo che non esiste", /sconosciuto/.test((await post("azione=possesso&op=aggiungi&id=999", L)).errore || ""));
verifica("richiesta non valida", /non valida/.test((await post("azione=possesso&op=ruba&id=24", L)).errore || ""));
r = await post("azione=possesso&op=aggiungi&id=3", L);
verifica("«Ce l'ho» (boccetta)", r.aggiunto === true, J(r));
r = await post("azione=leggi", L);
const suo24 = r.profumi.find((x) => x.id === 24), dan24 = danPrima.profumi.find((x) => x.id === 24);
verifica("ora ne ha due, nell'ordine in cui li ha aggiunti", r.profumi.map((x) => x.id).join(",") === "24,3", r.profumi.map((x) => x.id).join(","));
verifica("il suo 24 è un campione da 2 ml, senza residuo né note di Danilo",
  suo24.tipoPossesso === "campione" && suo24.formatoMl === 2 && suo24.residuoPct === null && suo24.notePersonali === "", J(suo24));
verifica("i dati del profumo sono quelli della scheda comune", suo24.name === dan24.name && suo24.rating === dan24.rating && JSON.stringify(suo24.stagioni) === JSON.stringify(dan24.stagioni));

// Diario e residuo: solo i suoi
verifica("lei mette il 24 nel suo diario", (await post("azione=diario&op=metti&id=24&data=2026-11-15&t=1763210000000", L)).ok === true);
verifica("lei non può mettere un profumo che non ha", /sconosciuto/.test((await post("azione=diario&op=metti&id=7&data=2026-11-15&t=1763210000001", L)).errore || ""));
verifica("lei segna il residuo del suo 24", (await post("azione=residuo&id=24&valore=50", L)).ok === true);
verifica("lei non può segnare il residuo di un profumo che non ha", /sconosciuto/.test((await post("azione=residuo&id=7&valore=50", L)).errore || ""));
const danDopo = await post("azione=leggi", D), leiDopo = await post("azione=leggi", L);
verifica("il residuo del 24 di Danilo non è cambiato", danDopo.profumi.find((x) => x.id === 24).residuoPct === dan24.residuoPct);
verifica("il diario di Danilo non ha la voce di lei", danDopo.diario.length === danPrima.diario.length && !danDopo.diario.some((v) => v.t === "1763210000000"));
verifica("il diario di lei ha solo la sua voce", leiDopo.diario.length === 1 && leiDopo.diario[0].t === "1763210000000");
// una voce con lo stesso t di una di Danilo: è un'altra voce, di lei
const tDan = danPrima.diario[0]?.t;
if (tDan) {
  r = await post(`azione=diario&op=togli&id=${danPrima.diario[0].id}&data=${danPrima.diario[0].data}&t=${tDan}`, L);
  verifica("lei non può togliere una voce di Danilo (per lei non esiste)", r.assente === true || /sconosciuto/.test(r.errore || ""), J(r));
  verifica("la voce di Danilo c'è ancora", (await post("azione=leggi", D)).diario.some((v) => v.t === tDan));
}

// Vetrine
r = await post("azione=vetrine", L);
verifica("vetrine: Danilo e lei", r.persone?.some((x) => x.id === "danilo" && x.profumi === 41) && r.persone.some((x) => x.id === P && x.profumi === 2), J(r));
r = await post("azione=vetrina&di=danilo", L);
verifica("la vetrina di Danilo: 41 profumi", r.profumi?.length === 41 && r.nome === "Danilo", J(r).slice(0, 120));
verifica("senza note personali né residuo", r.profumi.every((x) => !("notePersonali" in x) && !("residuoPct" in x)));
verifica("senza diario, layering e consigli", !("diario" in r) && r.layering.length === 0 && r.consigli.length === 0);
r = await post("azione=vetrina&di=" + P, D);
verifica("Danilo vede la vetrina di lei, senza il suo residuo", r.profumi?.length === 2 && r.profumi.every((x) => !("residuoPct" in x)), J(r).slice(0, 150));
verifica("vetrina di nessuno", /sconosciuta/.test((await post("azione=vetrina&di=pzzzzzz", L)).errore || ""));
verifica("le vetrine senza essere entrati: no", /^chiave/.test((await post("azione=vetrine")).errore || ""));
verifica("il catalogo senza essere entrati: no", /^chiave/.test((await post("azione=catalogo")).errore || ""));

// Quello che resta solo di Claude (con la chiave)
for (const a of ["modifica", "sincronizza", "importa&conferma=si", "confronta", "riporta&conferma=si"])
  verifica("lei non può: " + a.split("&")[0], /^chiave/.test((await post("azione=" + a, { ...L, dati: "{}" })).errore || ""));
verifica("lei non può collegarsi a Danilo", /^chiave/.test((await post("azione=collega", L)).errore || ""));

// Non ce l'ho più
r = await post("azione=possesso&op=togli&id=24", L);
verifica("«Non ce l'ho più»", r.tolto === true, J(r));
r = await post("azione=leggi", L);
verifica("il 24 sparisce dalla sua vetrina, la sua voce di diario resta", r.profumi.map((x) => x.id).join(",") === "3" && r.diario.length === 1, J(r.profumi.map((x) => x.id)));
verifica("«Ce l'ho» di nuovo lo riaccende", (await post("azione=possesso&op=aggiungi&id=24&tipo=campione", L)).aggiunto === true);

// Danilo e le copie non sono cambiati
const pubblicoDopo = JSON.stringify({ ...(await (await fetch(U)).json()), aggiornato: 0 });
verifica("la vetrina pubblica (di Danilo) è identica a prima", pubblicoDopo === pubblicoPrima);
verifica("con la chiave si è ancora Danilo", (await post("azione=leggi", { chiave: "prova" })).chi?.persona === "danilo");
console.log(errori ? "ERRORI: " + errori : "prove delle persone: tutto ok");
process.exitCode = errori ? 1 : 0;
