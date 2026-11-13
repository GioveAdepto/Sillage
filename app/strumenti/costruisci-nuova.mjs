/* Costruisce la nuova app nella cartella nuova/ alla radice del repo, per l'indirizzo di prova /nuova/.
   La lancia wrangler da solo prima di ogni pubblicazione (wrangler.jsonc, "build"), quindi anche Workers Builds
   per l'anteprima del branch. La radice continua a servire l'app di oggi.

   A mano, dalla radice del repo:   node app/strumenti/costruisci-nuova.mjs
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
esegui("npm run build -- --outDir ../nuova --emptyOutDir");
