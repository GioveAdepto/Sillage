import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dati, Profumo } from "./tipi";
import { numeraCatalogo } from "./profumo";

/* Da dove arrivano i profumi: il ponte verso il database (ponte/ponte.js), con CORS aperto.
   L'ultima risposta buona resta in localStorage: senza rete l'app riparte da lì.
   (Anche il service worker tiene una copia della risposta, ma il telefono può buttarla.) */
export const PONTE = "https://sillage.danilo-moro96.workers.dev/api";
const CHIAVE_COPIA = "sillage-app:dati";
const ATTESA_MAX = 8000; // ms oltre i quali si rinuncia al ponte e si resta sulla copia

export type Origine = "ponte" | "copia" | "nessuna";

interface StatoDati {
  dati: Dati | null;
  origine: Origine;
  /** vero mentre si aspetta il ponte */
  carica: boolean;
  /** l'ultimo errore del ponte, se c'è stato */
  errore: string | null;
  numeri: Map<number, number>;
  perId: Map<number, Profumo>;
  riprova: () => void;
}

const Contesto = createContext<StatoDati | null>(null);

function leggiCopia(): Dati | null {
  try {
    const d = JSON.parse(localStorage.getItem(CHIAVE_COPIA) ?? "null");
    return d && Array.isArray(d.profumi) && d.profumi.length ? d : null;
  } catch {
    return null;
  }
}
function scriviCopia(d: Dati) {
  try {
    localStorage.setItem(CHIAVE_COPIA, JSON.stringify(d));
  } catch {
    /* memoria piena o navigazione privata: pazienza, si rilegge dal ponte */
  }
}

/** Solo i profumi in collezione (attivo ≠ «no»), con i campi che possono mancare messi a posto. */
function pulisci(grezzo: unknown): Dati {
  const d = grezzo as Partial<Dati> & Record<string, unknown>;
  if (!d || !Array.isArray(d.profumi) || !d.profumi.length) throw new Error("il ponte ha risposto senza profumi");
  const profumi = (d.profumi as Profumo[])
    .filter((p) => p && typeof p.id === "number" && String(p.attivo ?? "si") !== "no")
    .map((p) => ({ ...p, accordi: Array.isArray(p.accordi) ? p.accordi : [], note: p.note ?? "" }));
  return {
    profumi,
    note: Array.isArray(d.note) ? (d.note as string[]) : [],
    layering: Array.isArray(d.layering) ? d.layering : [],
    consigli: Array.isArray(d.consigli) ? d.consigli : [],
    aggiornato: typeof d.aggiornato === "string" ? d.aggiornato : null
  };
}

export function DatiProvider({ children }: { children: ReactNode }) {
  const [dati, setDati] = useState<Dati | null>(leggiCopia);
  const [origine, setOrigine] = useState<Origine>(() => (leggiCopia() ? "copia" : "nessuna"));
  const [carica, setCarica] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true; // falso quando il componente rinuncia a questa richiesta
    const timer = setTimeout(() => ctrl.abort(), ATTESA_MAX);
    setCarica(true);
    fetch(PONTE, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("il ponte ha risposto " + r.status);
        return r.json();
      })
      .then((grezzo) => {
        if (!vivo) return;
        const d = pulisci(grezzo);
        setDati(d);
        setOrigine("ponte");
        setErrore(null);
        scriviCopia(d);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErrore(ctrl.signal.aborted ? "il ponte non ha risposto in tempo" : String((e as Error)?.message ?? e));
      })
      .finally(() => {
        clearTimeout(timer);
        if (vivo) setCarica(false);
      });
    return () => {
      vivo = false;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [giro]);

  const riprova = useCallback(() => setGiro((g) => g + 1), []);
  const valore = useMemo<StatoDati>(() => {
    const profumi = dati?.profumi ?? [];
    return {
      dati,
      origine,
      carica,
      errore,
      numeri: numeraCatalogo(profumi),
      perId: new Map(profumi.map((p) => [p.id, p])),
      riprova
    };
  }, [dati, origine, carica, errore, riprova]);

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useDati() {
  const c = useContext(Contesto);
  if (!c) throw new Error("useDati fuori da DatiProvider");
  return c;
}
