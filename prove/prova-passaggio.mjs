/* Prova del passaggio dall'app di oggi all'app nuova sullo stesso indirizzo, come succederà sul telefono:
   stesso localStorage, service worker di oggi già al lavoro. Alla radice e in /Sillage/ (GitHub Pages).
   Prima: cd app && VITE_PONTE=http://127.0.0.1:8800/api npm run build
   Poi, dalla radice del repo: node prove/prova-passaggio.mjs

   Per ogni prefisso: si apre l'app di oggi (dalla radice del repo, col ponte finto), si salva una chiave finta e
   si mette una voce che resta in coda; poi la stessa porta passa a servire la build nuova. L'app di oggi ancora
   aperta deve proporre «Aggiorna»; riaprendo deve arrivare l'app nuova con la chiave e la voce riprese, la cache
   di oggi cancellata, la voce inviata una volta sola con la chiave giusta, e la riapertura senza rete. */
import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { avvia } from "./server-finto.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(REPO, "app", "dist");
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));
const errori = [];
const browser = await chromium.launch();

for (const prefisso of ["/", "/Sillage/"]) {
  const dove = prefisso === "/" ? "alla radice" : "in " + prefisso;
  const controlla = (cond, cosa) => {
    if (!cond) errori.push(`manca (${dove}): ${cosa}`);
    else console.log(`ok  ${dove}: ${cosa}`);
  };
  const srv = await avvia({ porta: 8800, cartella: REPO, prefisso, riscriviPonte: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errori.push(`errore (${dove}): ${e.message}`));
  try {
    // 1. l'app di oggi, col suo service worker al lavoro
    await page.goto(srv.url);
    await page.waitForSelector("#vista-collezione .teca", { timeout: 30000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForSelector("#vista-collezione .teca", { timeout: 30000 });
    controlla(await page.evaluate(() => !!navigator.serviceWorker.controller && caches.has("sillage-v3")), "l'app di oggi gira col suo service worker");
    // una chiave (finta: il ponte la rifiuta) e una voce che resta in coda
    await page.evaluate(() => {
      localStorage.setItem("sillage:chiave", "chiave-di-ieri");
      indossa(24);
    });
    await aspetta(1500);
    const vecchiaCoda = await page.evaluate(() => JSON.parse(localStorage.getItem("sillage:diario-coda") || "[]"));
    controlla(vecchiaCoda.length === 1 && +vecchiaCoda[0].id === 24, "una voce aspetta nella coda di oggi");

    // 2. il passaggio: la stessa porta serve la build nuova
    srv.cambiaCartella(DIST, false);
    await page.evaluate(async () => {
      ultimoControllo = 0;
      await controllaVersione();
    });
    await page.waitForSelector("#aggiornamento", { timeout: 10000 }).catch(() => null);
    controlla(await page.$("#aggiornamento"), "l'app di oggi ancora aperta propone «Aggiorna»");

    // 3. si riapre: arriva l'app nuova, senza svuotare niente a mano
    await page.goto(srv.url);
    await page.waitForSelector(".scaffale .voce", { timeout: 30000 });
    controlla((await page.textContent(".conta")).includes("41"), "alla riapertura c'è l'app nuova, con 41 profumi");
    await aspetta(2500);
    const s = await page.evaluate(async () => ({
      chiave: localStorage.getItem("sillage-app:chiave"),
      vecchia: localStorage.getItem("sillage:diario-coda"),
      coda: JSON.parse(localStorage.getItem("sillage-app:diario-coda") || "[]"),
      cache: await caches.keys(),
      sw: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL
    }));
    controlla(s.chiave === "chiave-di-ieri", "la chiave salvata dall'app di oggi è ripresa");
    controlla(s.vecchia === null && s.coda.length === 1 && s.coda[0].op === "metti" && +s.coda[0].id === 24, "la voce in coda è passata nella coda nuova, una volta sola");
    controlla(!s.cache.includes("sillage-v3") && s.cache.some((c) => c.startsWith("workbox-precache")), "la cache di oggi è cancellata, c'è quella nuova");
    controlla(!!s.sw && s.sw.endsWith("/sw.js"), "il service worker nuovo controlla la pagina, allo stesso indirizzo");

    // 4. con la chiave giusta la voce parte, una volta sola
    await page.evaluate(() => localStorage.setItem("sillage-app:chiave", "prova"));
    await page.reload();
    await page.waitForSelector(".scaffale .voce", { timeout: 30000 });
    await aspetta(2500);
    const inviate = srv.stato.invii.filter((x) => x.op === "metti" && x.id === 24);
    controlla(inviate.length === 1 && srv.stato.diario.size === 1, `con la chiave giusta la voce arriva al ponte una volta sola (${inviate.length})`);
    await page.reload();
    await aspetta(1500);
    controlla(srv.stato.invii.filter((x) => x.op === "metti").length === 1, "riaprendo non riparte");

    // 5. senza rete
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector(".scaffale .voce", { timeout: 20000 });
    controlla((await page.$$(".scaffale .voce")).length === 34, "riaperta senza rete, la collezione c'è");
  } catch (e) {
    errori.push(`interrotta (${dove}): ${e.stack || e.message}`);
  } finally {
    await ctx.close();
    await srv.chiudi();
  }
}
await browser.close();
if (errori.length) {
  console.error(errori.join("\n"));
  process.exit(1);
}
console.log("tutto a posto");
