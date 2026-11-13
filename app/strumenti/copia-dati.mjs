/* Copia la copia notturna dei dati (data/profumi.json, note, layering, consigli: la scrive
   .github/workflows/copia-notturna.yml) dentro l'app, in public/data/. È il ripiego dell'avvio a freddo:
   senza rete e senza una copia sul telefono l'app legge da lì, come faceva l'app di oggi. Il service worker la
   tiene in cache con il resto. Parte da sola prima di ogni build (npm run build → prebuild). */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const DA = join(APP, "..", "data"),
  A = join(APP, "public", "data");
mkdirSync(A, { recursive: true });
for (const n of ["profumi", "note", "layering", "consigli"]) {
  const f = join(DA, n + ".json");
  if (!existsSync(f)) {
    console.warn("manca " + f + ": l'avvio a freddo senza rete non avrà questo ripiego");
    continue;
  }
  copyFileSync(f, join(A, n + ".json"));
}
console.log("dati copiati in public/data/");
