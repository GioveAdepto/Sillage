import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dati, Profumo } from "./tipi";
import { numeraCatalogo } from "./profumo";
import { PONTE, diario, leggiChiave } from "./ponte";
import type { Voce } from "./diario/coda";

/* Da dove arrivano i profumi: il ponte verso il database (ponte/ponte.js), con CORS aperto.
   Con la chiave si chiede tutto, diario compreso (POST azione=leggi, chiave nel corpo); senza, il catalogo
   (GET). L'ultima risposta buona resta in localStorage: senza rete l'app riparte da lì. Il diario confermato
   ha la sua copia (src/diario/coda.ts). */
export { PONTE };
const CHIAVE_COPIA = "sillage-app:dati";
const ATTESA_MAX = 8000; // ms oltre i quali si rinuncia al ponte e si resta sulla copia

export type Origine = "ponte" | "copia" | "nessuna";
/** assente: nessuna chiave sul telefono; giusta: il ponte ha dato il diario; sbagliata: il ponte l'ha rifiutata;
    da-provare: c'è, ma il ponte non ha ancora risposto */
export type StatoChiave = "assente" | "giusta" | "sbagliata" | "da-provare";

interface StatoDati {
  dati: Dati | null;
  origine: Origine;
  /** vero mentre si aspetta il ponte */
  carica: boolean;
  /** l'ultimo errore del ponte, se c'è stato */
  errore: string | null;
  numeri: Map<number, number>;
  perId: Map<number, Profumo>;
  statoChiave: StatoChiave;
  riprova: () => void;
  /** cambia un profumo sul telefono (per esempio il residuo appena salvato) */
  aggiornaProfumo: (id: number, campi: Partial<Profumo>) => void;
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
  const [statoChiave, setStatoChiave] = useState<StatoChiave>(() => (leggiChiave() ? "da-provare" : "assente"));

  // una chiave nuova (o tolta) in Impostazioni: si rilegge subito
  useEffect(() => {
    const cambia = () => {
      setStatoChiave(leggiChiave() ? "da-provare" : "assente");
      setGiro((g) => g + 1);
    };
    // tornata la rete: si rilegge, così il diario e lo stato della chiave tornano veri
    const rete = () => setGiro((g) => g + 1);
    window.addEventListener("sillage-chiave", cambia);
    window.addEventListener("online", rete);
    return () => {
      window.removeEventListener("sillage-chiave", cambia);
      window.removeEventListener("online", rete);
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    let vivo = true; // falso quando il componente rinuncia a questa richiesta
    const timer = setTimeout(() => ctrl.abort(), ATTESA_MAX);
    setCarica(true);
    const chiave = leggiChiave();
    fetch(
      PONTE,
      chiave
        ? { method: "POST", signal: ctrl.signal, cache: "no-store", body: new URLSearchParams({ azione: "leggi", chiave }) }
        : { signal: ctrl.signal, cache: "no-store" }
    )
      .then((r) => {
        if (!r.ok) throw new Error("il ponte ha risposto " + r.status);
        return r.json();
      })
      .then((grezzo) => {
        if (!vivo) return;
        const d = pulisci(grezzo);
        const g = grezzo as { diario?: Voce[]; diarioChiuso?: boolean };
        if (Array.isArray(g.diario)) {
          diario.impostaConfermate(g.diario);
          setStatoChiave("giusta");
          void diario.sincronizza(); // con la chiave giusta parte quello che aspettava
        } else if (chiave) {
          diario.segnalaChiave();
          setStatoChiave("sbagliata");
        } else setStatoChiave("assente");
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
  const aggiornaProfumo = useCallback((id: number, campi: Partial<Profumo>) => {
    setDati((d) => {
      if (!d) return d;
      const nuovi = { ...d, profumi: d.profumi.map((p) => (p.id === id ? { ...p, ...campi } : p)) };
      scriviCopia(nuovi);
      return nuovi;
    });
  }, []);
  const valore = useMemo<StatoDati>(() => {
    const profumi = dati?.profumi ?? [];
    return {
      dati,
      origine,
      carica,
      errore,
      numeri: numeraCatalogo(profumi),
      perId: new Map(profumi.map((p) => [p.id, p])),
      statoChiave,
      riprova,
      aggiornaProfumo
    };
  }, [dati, origine, carica, errore, riprova, statoChiave, aggiornaProfumo]);

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useDati() {
  const c = useContext(Contesto);
  if (!c) throw new Error("useDati fuori da DatiProvider");
  return c;
}
