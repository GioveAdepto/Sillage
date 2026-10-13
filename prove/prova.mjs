// Prova del sito: apre la pagina, aspetta la collezione e percorre le sezioni.
// Fallisce se la pagina scrive errori o se qualcosa che deve esserci manca.
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8800/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errori = [];
page.on("pageerror", e => errori.push("errore: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errori.push("console: " + m.text()); });

const controlla = (cond, cosa) => { if (!cond) errori.push("manca: " + cosa); else console.log("ok  " + cosa); };

await page.goto(url);
await page.waitForSelector("#vista-collezione .teca", { timeout: 30000 });
const n = await page.$$eval("#vista-collezione .teca", t => t.length);
controlla(n > 10, `la collezione (${n} schede)`);

await page.click("#vista-collezione .teca");
await page.waitForTimeout(800);
controlla(await page.$(".teca.aperta, #pannello-dettaglio"), "una scheda si apre");

for (const v of ["diario", "layering", "guida", "acquisti", "numeri", "confronta", "collezione"]) {
  await page.evaluate(x => cambiaVista(x), v);
  await page.waitForTimeout(300);
  const attiva = await page.$eval(`#vista-${v}`, e => e.classList.contains("attiva"));
  controlla(attiva, `la sezione ${v}`);
}
await page.evaluate(() => apriOggi());
await page.waitForTimeout(500);
controlla(await page.$("#oggi-corpo .oggi-scelta"), "Consigliami propone qualcosa");
controlla(await page.$eval("#vista-diario", e => !!e.querySelector(".settimana")), "il piano della settimana");

await browser.close();
if (errori.length) { console.error(errori.join("\n")); process.exit(1); }
console.log("tutto a posto");
