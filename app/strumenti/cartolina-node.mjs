/* Per le prove in Node: legge un PNG o un JPEG come immagine RGBA e carica i moduli della cartolina
   (src/cartolina/*.ts) con esbuild, come fanno gli altri confronti. */
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

const QUI = dirname(fileURLToPath(import.meta.url));

/** { width, height, data } con data in RGBA, da un file PNG o JPEG. */
export function leggiImmagine(file) {
  const buf = readFileSync(file);
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return { width: j.width, height: j.height, data: j.data };
}

/** I moduli src/cartolina/ (misura, boccetta, proposte, scritte), pronti per Node. */
export async function carica() {
  const dir = mkdtempSync(join(tmpdir(), "cartolina-"));
  const out = join(dir, "cartolina.mjs");
  writeFileSync(join(dir, "ingresso.ts"), ["misura.ts", "boccetta.ts", "proposte.ts", "scritte.ts"]
    .map((f) => `export * from ${JSON.stringify(join(QUI, "..", "src", "cartolina", f).replace(/\\/g, "/"))};\n`).join(""));
  await build({ entryPoints: [join(dir, "ingresso.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
  return import(pathToFileURL(out).href);
}

/** Un'immagine RGBA come PNG (per darla a Tesseract in Node). */
export function comePng(img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return PNG.sync.write(png);
}

/** Il lettore vero (Tesseract) in Node, per la taratura: scarica la lingua la prima volta in `cache`. */
export async function lettoreNode(cache) {
  const { createWorker } = await import("tesseract.js");
  const { daTesseract } = await carica();
  const w = await createWorker("ita", 1, { cachePath: cache, logger: () => {}, errorHandler: () => {} });
  let modo = "";
  const riconosci = async (img, m) => {
    if (m !== modo) {
      await w.setParameters({ tessedit_pageseg_mode: m === "riga" ? "7" : "6", tessedit_char_whitelist: m === "numeri" ? "0123456789.,()" : "" });
      modo = m;
    }
    const { data } = await w.recognize(comePng(img), {}, { text: true, blocks: true });
    return daTesseract(data);
  };
  return { riconosci, chiudi: () => w.terminate() };
}

/* Il profumo del catalogo (data/profumi.json) che corrisponde al nome di una cartolina (Marchio_NomeProfumo). */
const norm = (s) => String(s).normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const CONC = [[/eaudeparfum|edp/, "EDP"], [/eaudetoilette|edt/, "EDT"], [/parfum$/, "Parfum"]];
/** Il profumo del database che corrisponde al nome del file (Marchio_NomeProfumo). */
// i nomi dei file che non contengono il nome del database (scelti a mano, una volta)
const A_MANO = {
  "AlHaramain_OudGoldEdition.png": 27, "Armaf_ClubDeNuitIntense.png": 17, "DolceGabbana_TheOneEauDeParfum.png": 12,
  "FrenchAvenue_AzzureOud.png": 38, "Gucci_GuiltyEauDeParfum.png": 19, "Lalique_OmbreNoir.png": 32,
  "Rasasi_HawasLaYuqawam.png": 23, "RueBroca_TheoremeEauDeParfum.png": 7
};
export function trovaProfumo(file, profumi) {
  if (A_MANO[file]) return profumi.find((p) => p.id === A_MANO[file]);
  const [marca, ...resto] = file.replace(/\.[a-z]+$/i, "").split("_");
  const m = norm(marca), n = norm(resto.join(""));
  const candidati = profumi
    .filter((p) => m.startsWith(norm(p.brand).slice(0, 5)) || norm(p.brand).startsWith(m.slice(0, 5)))
    .filter((p) => n.startsWith(norm(p.name)) || n.includes(norm(p.name)))
    .sort((a, b) => norm(b.name).length - norm(a.name).length);
  if (candidati.length <= 1) return candidati[0];
  const lunghi = candidati.filter((p) => norm(p.name).length === norm(candidati[0].name).length);
  const conc = CONC.find(([re]) => re.test(n.slice(norm(lunghi[0].name).length)));
  return (conc && lunghi.find((p) => p.conc === conc[1])) || lunghi[0];
}

