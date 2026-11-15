import { Diario, type Memoria } from "./diario/coda";
import { tokenAccesso } from "./accesso";

/* Il ponte verso il database (ponte/ponte.js) e la chiave di Sillage.
   Per le prove in locale si costruisce l'app con VITE_PONTE=http://127.0.0.1:8787/api (vedi LEGGIMI):
   mai scritture di prova sul ponte pubblicato. */
export const PONTE: string = import.meta.env.VITE_PONTE || "https://sillage.danilo-moro96.workers.dev/api";

/* La chiave protegge diario, residuo e catalogo. Si inserisce in Altro ▸ Impostazioni e resta solo nel
   localStorage di questo telefono: non è memoria dello stato (l'app non ricorda dove eri, sa solo chi sei).
   Viaggia sempre nel corpo della richiesta, mai nell'indirizzo. */
const CHIAVE = "sillage-app:chiave";
export function leggiChiave(): string {
  try {
    return localStorage.getItem(CHIAVE) || "";
  } catch {
    return "";
  }
}
export function scriviChiave(k: string) {
  try {
    if (k) localStorage.setItem(CHIAVE, k);
    else localStorage.removeItem(CHIAVE);
  } catch {
    /* navigazione privata: la chiave vale finché l'app resta aperta */
  }
  window.dispatchEvent(new Event("sillage-chiave"));
}

/** Chi sei, per il ponte: la chiave (fino alla tappa 5 degli account) e il token dell'account, se sei entrato.
    Viaggiano sempre nel corpo della richiesta, mai nell'indirizzo. */
export async function credenziali(): Promise<Record<string, string>> {
  const c: Record<string, string> = {};
  const chiave = leggiChiave(), accesso = await tokenAccesso();
  if (chiave) c.chiave = chiave;
  if (accesso) c.accesso = accesso;
  return c;
}

/** Una scrittura al ponte: i parametri nell'indirizzo, chiave e accesso nel corpo. */
export async function scriviAlPonte(parametri: Record<string, string>) {
  const r = await fetch(PONTE + "?" + new URLSearchParams(parametri), {
    method: "POST",
    body: new URLSearchParams(await credenziali())
  });
  let corpo: Record<string, unknown> | null = null;
  try {
    corpo = await r.json();
  } catch {
    corpo = null;
  }
  return { stato: r.status, corpo };
}
/** Il ponte non sa chi sei (chiave o accesso mancante, sbagliato o scaduto): si riprova dopo, niente va perso. */
export const rifiutoChiave = (e: Record<string, unknown> | null) => !!e && /^(chiave|accesso)/.test(String(e.errore || ""));

const memoria: Memoria = {
  leggi: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  scrivi: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* memoria piena: la voce resta finché l'app è aperta */
    }
  }
};

/** Il diario dell'app: uno solo, condiviso da tutte le pagine. */
export const diario = new Diario(memoria, scriviAlPonte);
