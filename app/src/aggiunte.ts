/* «Aggiungi profumo»: le chiamate al ponte e la coda delle aggiunte fatte senza rete (come il diario).
   Un'aggiunta in coda tiene tutto (scheda, possesso, foto) e un codice `cliente`: il ponte, se la riceve due
   volte, dà lo stesso profumo. Si manda al ritorno della rete, all'avvio e quando l'app torna in primo piano. */
import { PONTE, credenziali, rifiutoChiave } from "./ponte";

export interface Aggiunta {
  cliente: string;
  /** colonne del foglio (marchio, profumo, concentrazione, accordi, inverno…) */
  scheda: Record<string, string>;
  possesso: { tipo: "full" | "campione"; ml?: number | null; note?: string };
  foto?: { tipo: string; dati: string } | null;
}
export interface InCoda extends Aggiunta {
  nome: string;
  quando: number;
}
export interface SchedaComune {
  id: number;
  brand: string;
  name: string;
  conc: string;
  famiglia?: string;
  img?: string | null;
  accordi?: string[];
  rating?: number | null;
}

/** Una richiesta al ponte con tutto nel corpo (le immagini non stanno in un indirizzo), credenziali comprese. */
async function alPonte(azione: string, campi: Record<string, string> = {}) {
  const r = await fetch(PONTE + "?azione=" + azione, { method: "POST", body: new URLSearchParams({ ...(await credenziali()), ...campi }) });
  let corpo: Record<string, unknown> = {};
  try {
    corpo = await r.json();
  } catch {
    corpo = { errore: "il ponte ha risposto " + r.status };
  }
  if (!r.ok && !corpo.errore) corpo.errore = "il ponte ha risposto " + r.status;
  return corpo;
}

/** Le schede già in Sillage (tutte, di tutti), per cercare per nome. */
export async function catalogoComune(): Promise<SchedaComune[]> {
  const c = await alPonte("catalogo");
  if (c.errore) throw new Error(String(c.errore));
  return (c.profumi as SchedaComune[]) ?? [];
}

// ── la coda ──
const CODA = "sillage-app:aggiunte-coda";
const ascoltatori = new Set<() => void>();
let istantanea: InCoda[] = leggi();
function leggi(): InCoda[] {
  try {
    const c = JSON.parse(localStorage.getItem(CODA) || "[]");
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
}
function scrivi(c: InCoda[]) {
  istantanea = c;
  try {
    localStorage.setItem(CODA, JSON.stringify(c));
  } catch {
    /* memoria piena: resta finché l'app è aperta */
  }
  ascoltatori.forEach((f) => f());
}
export const coda = {
  leggi: () => istantanea,
  ascolta: (f: () => void) => {
    ascoltatori.add(f);
    return () => ascoltatori.delete(f);
  }
};
export const nuovoCliente = () =>
  (crypto.randomUUID?.() ?? Date.now().toString(36) + "-" + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9-]/g, "");

export type Esito = { ok: true; id: number; esistente?: boolean; giaInVetrina?: boolean } | { ok: false; inCoda: true } | { ok: false; errore: string };

/** Manda un'aggiunta. Senza rete (o se il ponte non ti riconosce ora) resta in coda e lo dice. */
export async function manda(a: Aggiunta, nome: string): Promise<Esito> {
  const r = await prova(a);
  if (r === "coda") {
    if (!istantanea.some((x) => x.cliente === a.cliente)) scrivi([...istantanea, { ...a, nome, quando: Date.now() }]);
    return { ok: false, inCoda: true };
  }
  return r;
}

async function prova(a: Aggiunta): Promise<Esito | "coda"> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "coda";
  let r: Record<string, unknown>;
  try {
    r = await alPonte("aggiungi", { dati: JSON.stringify(a) });
  } catch {
    return "coda";
  }
  if (r.ok) return { ok: true, id: Number(r.id), esistente: !!r.esistente, giaInVetrina: !!r.giaInVetrina };
  if (rifiutoChiave(r) || /^il ponte ha risposto 5/.test(String(r.errore))) return "coda";
  return { ok: false, errore: String(r.errore || "il ponte non l'ha accettato") };
}

let inViaggio: Promise<{ fatte: number; rifiutate: string[] }> | null = null;
/** Manda quello che aspetta. Uno alla volta; quelli che il ponte rifiuta davvero escono, col motivo. */
export function sincronizza() {
  inViaggio ??= (async () => {
    let fatte = 0;
    const rifiutate: string[] = [];
    for (const a of [...istantanea]) {
      const r = await prova(a);
      if (r === "coda") break;
      scrivi(istantanea.filter((x) => x.cliente !== a.cliente));
      if (r.ok) fatte++;
      else if ("errore" in r) rifiutate.push(a.nome + ": " + r.errore);
    }
    return { fatte, rifiutate };
  })().finally(() => {
    inViaggio = null;
  });
  return inViaggio;
}
