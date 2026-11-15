/* Un Supabase Auth FINTO per le prove degli account (porta 8898): chiavi pubbliche, accesso con password,
   rinnovo, uscita. Nessuna richiesta al progetto vero. Password valida per ogni email: «prova1234».
   Esporta anche firma() per le prove del ponte (token buoni, scaduti, falsi): strumenti/prova-accesso.mjs.

   Si lancia dalla cartella app/:   node strumenti/supabase-finto.mjs
   poi il ponte locale con  --var SUPABASE_URL:http://127.0.0.1:8898  e l'app costruita con
   VITE_SUPABASE_URL=http://127.0.0.1:8898 (app/LEGGIMI.md, «Prove»). Le chiavi finte stanno nella cartella
   temporanea del computer, mai nel repo. */
import { createServer } from "node:http";
import { generateKeyPairSync, createSign, createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const BASE = "http://127.0.0.1:8898";
const FILE = join(tmpdir(), "sillage-supabase-finto-chiavi.json");
function chiavi() {
  if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, "utf8"));
  const nuova = () => { const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" }); return privateKey.export({ format: "jwk" }); };
  const k = { buona: nuova(), estranea: nuova() };
  writeFileSync(FILE, JSON.stringify(k));
  return k;
}
const K = chiavi();
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
export const accountDi = (email) => createHash("sha256").update(email).digest("hex").slice(0, 8) + "-0000-4000-8000-000000000000";

/** Un token come quelli di Supabase. opzioni: chiave ("buona" | "estranea"), kid, scade (secondi da ora), iss, aud. */
export function firma(email, o = {}) {
  const ora = Math.floor(Date.now() / 1000);
  const testa = { alg: "ES256", kid: o.kid || "finta-1", typ: "JWT" };
  const dati = { iss: o.iss || BASE + "/auth/v1", aud: o.aud || "authenticated", sub: accountDi(email), email, role: "authenticated", iat: ora, exp: ora + (o.scade ?? 3600) };
  const firmato = b64(testa) + "." + b64(dati);
  const s = createSign("SHA256"); s.update(firmato);
  const sig = s.sign({ key: K[o.chiave || "buona"], format: "jwk", dsaEncoding: "ieee-p1363" });
  return firmato + "." + sig.toString("base64url");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rinnovi = new Map();
  const sessione = (email, scade) => {
    const refresh = randomUUID(); rinnovi.set(refresh, email);
    return { access_token: firma(email, { scade }), token_type: "bearer", expires_in: scade, expires_at: Math.floor(Date.now() / 1000) + scade,
             refresh_token: refresh, user: { id: accountDi(email), email } };
  };
  const SCADE = Number(process.env.SCADE || 3600);
  createServer(async (req, res) => {
    let corpo = ""; for await (const p of req) corpo += p;
    const u = new URL(req.url, BASE);
    const manda = (stato, o) => { res.writeHead(stato, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" }); res.end(JSON.stringify(o)); };
    if (req.method === "OPTIONS") return manda(200, {});
    if (u.pathname === "/auth/v1/.well-known/jwks.json") {
      const { x, y, crv, kty } = K.buona;
      return manda(200, { keys: [{ alg: "ES256", crv, kty, x, y, kid: "finta-1", use: "sig", key_ops: ["verify"], ext: true }] });
    }
    if (!req.headers.apikey) return manda(401, { message: "No API key found in request" });
    const d = corpo ? JSON.parse(corpo) : {};
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "password") {
      if (d.password !== "prova1234") return manda(400, { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
      console.log("accesso:", d.email);
      return manda(200, sessione(String(d.email).toLowerCase(), SCADE));
    }
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "refresh_token") {
      const email = rinnovi.get(d.refresh_token);
      if (!email) return manda(400, { error: "invalid_grant", error_description: "Invalid Refresh Token: Refresh Token Not Found" });
      rinnovi.delete(d.refresh_token);
      console.log("rinnovo:", email);
      return manda(200, sessione(email, SCADE));
    }
    if (u.pathname === "/auth/v1/logout") return manda(204, {});
    manda(404, { message: "non previsto" });
  }).listen(8898, "127.0.0.1", () => console.log("Supabase finto su " + BASE));
}
