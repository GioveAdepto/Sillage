/* Prova dell'app (React) in un browser vero, con il ponte finto di prove/server-finto.mjs.
   Prima: cd app && VITE_PONTE=http://127.0.0.1:8800/api npm run build
   Poi, dalla radice del repo: node prove/prova-nuova.mjs
   Percorre Collezione (41 profumi), Scheda, Consigliami, il Diario con una voce messa senza rete (resta in coda,
   parte una volta sola al ritorno), la riapertura senza rete e l'avvio a freddo col ponte giù (data/*.json). */
import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { avvia } from "./server-finto.mjs";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "dist");
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

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  seguiErrori(page);
  await page.goto(srv.url);
  await page.waitForSelector(".scaffale .voce", { timeout: 30000 });
  controlla((await page.textContent(".conta")).includes("41"), "la collezione con 41 profumi");
  controlla((await page.$$(".scaffale .voce")).length === 34, "34 boccette sulle mensole");
  await page.evaluate(() => navigator.serviceWorker.ready);

  await page.click("#teca-24");
  await page.waitForSelector(".nome-grande", { timeout: 10000 });
  controlla((await page.textContent(".nome-grande")) === "Encre Noire", "la scheda di Encre Noire");

  await page.goto(srv.url + "#/consigliami?occ=ufficio");
  await page.waitForSelector(".scelta .nome-grande", { timeout: 10000 });
  controlla(true, "Consigliami propone un profumo");

  // il diario: chiave di prova, una voce messa senza rete
  await page.evaluate(() => localStorage.setItem("sillage-app:chiave", "prova"));
  await page.goto(srv.url + "#/profumo/24");
  await page.reload();
  await page.waitForSelector(".indossa", { timeout: 10000 });
  await ctx.setOffline(true);
  await page.click(".indossa");
  await aspetta(800);
  const coda = await page.evaluate(() => JSON.parse(localStorage.getItem("sillage-app:diario-coda") || "[]"));
  controlla(coda.length === 1 && coda[0].op === "metti" && coda[0].id === 24, "senza rete la voce aspetta in coda");
  controlla((await page.getAttribute(".indossa", "aria-pressed")) === "true", "e si vede subito: «Indossato oggi»");
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await aspetta(2500);
  const inviate = srv.stato.invii.filter((x) => x.op === "metti" && x.id === 24);
  controlla(inviate.length === 1, `tornata la rete parte una volta sola (${inviate.length})`);
  controlla((await page.evaluate(() => JSON.parse(localStorage.getItem("sillage-app:diario-coda") || "[]"))).length === 0, "la coda si svuota");

  await page.goto(srv.url + "#/diario");
  await page.waitForSelector(".diario-giorno", { timeout: 10000 });
  controlla((await page.textContent(".diario-giorno")).includes("Encre Noire"), "il Diario mostra la voce di oggi");

  // riapertura senza rete: tutto dalla cache del service worker e dalla copia sul telefono
  await ctx.setOffline(true);
  await page.goto(srv.url);
  await page.reload();
  await page.waitForSelector(".scaffale .voce", { timeout: 15000 });
  controlla((await page.$$(".scaffale .voce")).length === 34, "riaperta senza rete, la collezione c'è");
  await ctx.close();

  // avvio a freddo col ponte giù: niente copia sul telefono, ripiego su data/*.json
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const p2 = await ctx2.newPage();
  seguiErrori(p2);
  await p2.route("**/api*", (r) => r.abort());
  await p2.goto(srv.url);
  await p2.waitForSelector(".scaffale .voce", { timeout: 20000 });
  controlla((await p2.textContent(".conta")).includes("41"), "avvio a freddo col ponte giù: 41 profumi da data/*.json");
  await ctx2.close();
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
