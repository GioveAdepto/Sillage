/* Costruisce l'app nella cartella sito/ alla radice del repo: è la cartella che Cloudflare serve (wrangler.jsonc,
   "assets"). La lancia wrangler da solo prima di ogni pubblicazione ("build"), quindi anche Workers Builds per
   main e per le anteprime dei branch, e `wrangler dev` in locale. sito/ è fuori da git.

   A mano, dalla radice del repo:   node app/strumenti/costruisci-sito.mjs
   Installa i pacchetti solo se mancano (npm ci), poi controlla i tipi e costruisce (npm run build). */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const esegui = (comando) => {
  console.log("› " + comando);
  const r = spawnSync(comando, { cwd: APP, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (!existsSync(join(APP, "node_modules", ".bin"))) esegui("npm ci --no-audit --no-fund");
esegui("npm run build -- --outDir ../sito --emptyOutDir");
