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

/** I moduli src/cartolina/misura.ts e scontorno.ts, pronti per Node. */
export async function carica() {
  const dir = mkdtempSync(join(tmpdir(), "cartolina-"));
  const out = join(dir, "cartolina.mjs");
  writeFileSync(join(dir, "ingresso.ts"), ["misura.ts", "boccetta.ts", "proposte.ts"]
    .map((f) => `export * from ${JSON.stringify(join(QUI, "..", "src", "cartolina", f).replace(/\\/g, "/"))};\n`).join(""));
  await build({ entryPoints: [join(dir, "ingresso.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
  return import(pathToFileURL(out).href);
}
