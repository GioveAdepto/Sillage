import { Diario, type Memoria } from "./diario/coda";

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

/** Una scrittura al ponte: i parametri nell'indirizzo, la chiave nel corpo (come l'app di oggi). */
export async function scriviAlPonte(parametri: Record<string, string>) {
  const r = await fetch(PONTE + "?" + new URLSearchParams(parametri), {
    method: "POST",
    body: new URLSearchParams({ chiave: leggiChiave() })
  });
  let corpo: Record<string, unknown> | null = null;
  try {
    corpo = await r.json();
  } catch {
    corpo = null;
  }
  return { stato: r.status, corpo };
}
export const rifiutoChiave = (e: Record<string, unknown> | null) => !!e && /^chiave/.test(String(e.errore || ""));

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
