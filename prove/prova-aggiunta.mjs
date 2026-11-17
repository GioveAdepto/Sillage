/* Prova di «Aggiungi profumo» in un browser vero, col ponte finto (prove/server-finto.mjs) e il lettore delle scritte
   FINTO (l'app costruita con VITE_LETTORE=finto): nessuna richiesta al ponte pubblicato, nessun download del lettore,
   nessun profumo finto nel database vero.
   Prima: cd app && VITE_PONTE=http://127.0.0.1:8800/api VITE_LETTORE=finto npm run build
   Poi, dalla radice: node prove/prova-aggiunta.mjs

   - un profumo già in Sillage: la ricerca lo trova e dice «Già nella tua vetrina»;
   - un profumo nuovo dalla cartolina sintetica (prove/cartoline): barre misurate nel telefono, scritte dal lettore
     finto, concentrazione in ambra finché non la si sceglie, foto ritagliata, piramide da una schermata, Salva;
   - il profumo entra nella collezione (42), la sua scheda, Numeri e Consigliami si aprono senza errori;
   - se il lettore non riesce (per esempio senza rete al primo uso): la pagina lo dice e lascia scrivere;
   - senza rete: l'aggiunta va in coda, si vede in Collezione, parte una volta sola al ritorno della rete. */
import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { avvia } from "./server-finto.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(QUI, "..", "app", "dist");
const CARTOLINA = join(QUI, "cartoline", "sintetica-1092.png");
const srv = await avvia({ porta: 8800, cartella: DIST });
const browser = await chromium.launch();
const errori = [];
const controlla = (cond, cosa) => {
  if (!cond) errori.push("manca: " + cosa);
  else console.log("ok  " + cosa);
};
const seguiErrori = (page) => {
  page.on("pageerror", (e) => errori.push("errore: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|net::ERR|Transition was skipped/.test(m.text())) errori.push("console: " + m.text());
  });
};
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));
const valore = (page, sel) => page.$eval(sel, (e) => e.value);

/** Dalla cartolina al salvataggio. */
async function aggiungiDallaCartolina(page, { conLettore = true } = {}) {
  await page.goto(srv.url + "#/altro"); // si riparte sempre dalla ricerca: nessuna memoria fra un'apertura e l'altra
  await page.goto(srv.url + "#/aggiungi");
  await page.waitForSelector(".aggiungi input[type=search]", { timeout: 15000 });
  await page.click("text=Profumo nuovo");
  await page.setInputFiles(".ag-rullino input[type=file]", CARTOLINA);
  await page.waitForSelector(".ag-righe", { timeout: 15000 });
  if (conLettore) await page.waitForFunction(() => document.querySelector("#ag-nome")?.value === "Profumo di Prova", null, { timeout: 10000 });
  else await page.waitForSelector(".ag-ambra .ag-riprova", { timeout: 10000 });
}

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  seguiErrori(page);
  await page.goto(srv.url);
  // si entra (chi non è entrato vede solo l'ingresso): la chiave di prova, poi si riapre
  await page.evaluate(() => localStorage.setItem("sillage-app:chiave", "prova"));
  await page.reload();
  await page.waitForSelector(".scaffale .voce", { timeout: 30000 });
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Altro ▸ Aggiungi profumo
  await page.goto(srv.url + "#/altro");
  await page.click("text=Aggiungi profumo");
  await page.waitForSelector(".aggiungi input[type=search]", { timeout: 10000 });
  await page.fill(".aggiungi input[type=search]", "eros");
  await page.waitForSelector(".ag-ris", { timeout: 10000 });
  const righe = await page.$$eval(".ag-ris", (r) => r.map((x) => x.textContent));
  controlla(righe.length === 3 && righe.every((t) => /Già nella tua vetrina/.test(t)), "la ricerca trova i tre Eros, già nella vetrina di Danilo");

  // un profumo nuovo dalla cartolina sintetica
  await aggiungiDallaCartolina(page);
  const forze = await page.$$eval(".ag-righe .ag-v", (v) => v.map((x) => x.value));
  controlla(forze.slice(0, 5).join(",") === "100,82,60,58,51", "le barre degli accordi misurate nel telefono: " + forze.slice(0, 5).join(","));
  controlla(forze.slice(5, 9).join(",") === "33,18,11,38", "le stagioni misurate: " + forze.slice(5, 9).join(","));
  controlla((await valore(page, "#ag-g")) === "47", "giorno 47");
  controlla((await valore(page, "#ag-marchio")) === "Casa di Prova" && (await valore(page, "#ag-voto")) === "4,1", "le scritte dal lettore finto: marchio e voto");
  controlla(/lette nel telefono/.test(await page.textContent(".ag-cartolina")), "dice che le scritte le ha lette il telefono");
  controlla((await page.$$eval(".ag-righe .ag-n", (v) => v.map((x) => x.value || x.textContent)))[0] === "Legnoso", "i nomi degli accordi");
  controlla(!!(await page.$(".ag-campo.dubbio .chip.dubbio")), "la concentrazione in ambra finché non si sceglie");
  controlla(await page.$eval(".aggiungi .btn-filo.pieno", (b) => b.disabled), "Avanti spento senza concentrazione");
  await page.click(".ag-campo.largo .chip:text('EDP')");
  controlla(!(await page.$(".ag-campo.dubbio .chip.dubbio")), "scelta la concentrazione, niente più ambra");
  await page.click("text=Avanti: la foto");
  await page.waitForSelector(".ag-scena img.ag-boccetta", { timeout: 10000 });
  controlla((await page.getAttribute(".ag-opzione[aria-pressed=true]", "aria-pressed")) === "true", "foto: quella della cartolina, già scelta");
  await page.click("text=Avanti: la piramide");
  await page.setInputFiles(".aggiungi label.btn-filo input[type=file]", CARTOLINA);
  await page.waitForSelector(".ag-nota", { timeout: 10000 });
  const notePiramide = await page.$$eval(".ag-nota", (n) => n.map((x) => x.textContent));
  controlla(notePiramide.length === 5, "piramide letta dalla schermata: 5 note (" + notePiramide.join(", ") + ")");
  await page.click(".ag-nota button[aria-label='Togli Muschio']");
  controlla((await page.$$(".ag-nota")).length === 4, "una nota si toglie");
  await page.click(".aggiungi .btn-filo.pieno:text('Avanti')");
  await page.waitForSelector(".ag-riepilogo", { timeout: 10000 });
  await page.click(".chip:text('100')");
  await page.fill("#ag-note-personali", "Prova automatica");
  await page.click(".aggiungi .btn-filo.pieno:text('Salva')");
  await page.waitForSelector("text=Nella tua vetrina", { timeout: 10000 });
  const a = srv.stato.aggiunte.at(-1);
  controlla(a && a.scheda.profumo === "Profumo di Prova" && a.scheda.concentrazione === "EDP" && a.scheda.accordi_forza === "100|82|60|58|51",
    "al ponte: nome, concentrazione e forza degli accordi");
  controlla(a.scheda.inverno === "33" && a.scheda.giorno_pct === "47" && a.scheda.stagione === "ai" && /^Testa: bergamotto, limone · Cuore: lavanda · Fondo: vetiver$/i.test(a.scheda.piramide),
    "al ponte: stagioni, giorno, stagione proposta e piramide");
  controlla(a.possesso.tipo === "full" && a.possesso.ml === 100 && a.possesso.note === "Prova automatica", "al ponte: boccetta da 100 ml e note");
  controlla(a.foto && /^image\/(webp|png)$/.test(a.foto.tipo) && a.foto.dati.length > 1000, "al ponte: la foto ritagliata");
  const id = srv.stato.nuovi.at(-1).id;

  // il profumo nuovo nell'app
  await page.click("text=Vai alla scheda");
  await page.waitForSelector(".nome-grande", { timeout: 10000 });
  controlla((await page.textContent(".nome-grande")) === "Profumo di Prova", "la scheda del profumo nuovo (id " + id + ")");
  await page.goto(srv.url);
  await page.waitForFunction(() => document.querySelector(".conta")?.textContent.includes("42"), null, { timeout: 10000 });
  controlla(true, "la collezione ha 42 profumi");
  for (const pagina of ["numeri", "consigliami", "guida", "acquisti"]) {
    await page.goto(srv.url + "#/" + pagina);
    await aspetta(800);
  }
  controlla(true, "Numeri, Consigliami, Guida e Acquisti si aprono col profumo nuovo");

  // lo stesso profumo cercato di nuovo: c'è già
  await page.goto(srv.url + "#/aggiungi");
  await page.fill(".aggiungi input[type=search]", "profumo di prova");
  await page.waitForSelector(".ag-ris", { timeout: 10000 });
  controlla(/Già nella tua vetrina/.test(await page.textContent(".ag-ris")), "ora la ricerca lo trova, già in vetrina");

  // il lettore non riesce
  await page.evaluate(() => localStorage.setItem("sillage-prova:lettore", "rotto"));
  await aggiungiDallaCartolina(page, { conLettore: false });
  controlla((await valore(page, "#ag-nome")) === "" && (await page.$$eval(".ag-righe .ag-v", (v) => v[0].value)) === "100", "lettore rotto: barre misurate, nome da scrivere a mano");
  await page.evaluate(() => localStorage.removeItem("sillage-prova:lettore"));
  await page.click(".ag-riprova");
  await page.waitForFunction(() => document.querySelector("#ag-nome")?.value === "Profumo di Prova", null, { timeout: 10000 });
  controlla(true, "«Riprova» rilegge le scritte");

  // senza rete: in coda, poi una volta sola
  await aggiungiDallaCartolina(page);
  await page.fill("#ag-nome", "Profumo in coda");
  await page.click(".ag-campo.largo .chip:text('EDT')");
  await page.click("text=Avanti: la foto");
  await page.click("text=Avanti: la piramide");
  await page.click("text=Salta: entra senza piramide");
  await page.waitForSelector(".ag-riepilogo", { timeout: 10000 });
  const prima = srv.stato.aggiunte.length;
  await ctx.setOffline(true);
  await page.click(".aggiungi .btn-filo.pieno:text('Salva')");
  await page.waitForSelector("text=In attesa di rete", { timeout: 10000 });
  const coda = await page.evaluate(() => JSON.parse(localStorage.getItem("sillage-app:aggiunte-coda") || "[]"));
  controlla(coda.length === 1 && coda[0].nome === "Profumo in coda", "senza rete l'aggiunta aspetta in coda");
  await page.click("text=Alla collezione");
  await page.waitForSelector(".ag-in-attesa", { timeout: 10000 });
  controlla(/Profumo in coda/.test(await page.textContent(".ag-in-attesa")), "in Collezione si vede che aspetta la rete");
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await aspetta(2500);
  const inviate = srv.stato.aggiunte.slice(prima).filter((x) => x.scheda.profumo === "Profumo in coda");
  controlla(inviate.length === 1, `tornata la rete parte una volta sola (${inviate.length})`);
  controlla((await page.evaluate(() => JSON.parse(localStorage.getItem("sillage-app:aggiunte-coda") || "[]"))).length === 0, "la coda si svuota");
  await page.waitForFunction(() => document.querySelector(".conta")?.textContent.includes("43"), null, { timeout: 10000 });
  controlla(!(await page.$(".ag-in-attesa")), "e l'avviso se ne va: 43 profumi");
  await ctx.close();
} catch (e) {
  errori.push("interrotta: " + (e.stack || e.message));
} finally {
  await browser.close();
  await srv.chiudi();
}
if (errori.length) {
  console.error(errori.join("\n"));
  process.exit(1);
}
console.log("tutto a posto");
