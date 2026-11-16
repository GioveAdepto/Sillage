import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dati, Profumo } from "./tipi";
import { numeraCatalogo } from "./profumo";
import { PONTE, credenziali, diario, leggiChiave, scordaChiave } from "./ponte";
import { leggiSessione } from "./accesso";
import type { Voce } from "./diario/coda";

/* Da dove arrivano i profumi: il ponte verso il database (ponte/ponte.js), con CORS aperto.
   Con l'account (o la chiave di prima) si chiede la propria vetrina, diario compreso (POST azione=leggi,
   credenziali nel corpo). Senza, non si chiede niente: chi non è entrato vede solo l'ingresso (Ingresso.tsx), mai
   la vetrina di un altro. L'ultima risposta buona resta in localStorage: senza rete l'app riparte da lì. Il diario
   confermato ha la sua copia (src/diario/coda.ts). */
export { PONTE };
const CHIAVE_COPIA = "sillage-app:dati";
const ATTESA_MAX = 8000; // ms oltre i quali si rinuncia al ponte e si resta sulla copia

export type Origine = "ponte" | "copia" | "repo" | "nessuna";
/** Chi sei per il database: assente: né chiave né account su questo telefono; giusta: il ponte ti ha riconosciuto
    e ha dato il diario; sbagliata: il ponte non ti ha riconosciuto; da-provare: c'è qualcosa, il ponte non ha ancora
    risposto */
export type StatoChiave = "assente" | "giusta" | "sbagliata" | "da-provare";
/** Quello che il ponte dice di chi ha riconosciuto (azione=leggi). */
export interface Chi {
  persona?: string;
  nome?: string;
  da?: "chiave" | "accesso";
  email?: string;
  daCollegare?: boolean;
  accessoNonValido?: string;
}
export const haCredenziali = () => !!(leggiChiave() || leggiSessione());

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
  /** chi ti ha riconosciuto il ponte all'ultima lettura (null: non ancora, o senza rete) */
  chi: Chi | null;
  /** su questo telefono c'è un account (o la chiave di prima): si apre la vetrina, non l'ingresso */
  entrato: boolean;
  riprova: () => void;
  /** cambia un profumo sul telefono (per esempio il residuo appena salvato) */
  aggiornaProfumo: (id: number, campi: Partial<Profumo>) => void;
}

const Contesto = createContext<StatoDati | null>(null);

/* Di chi è la copia sul telefono: la persona che il ponte ha riconosciuto l'ultima volta. Una vetrina vuota è una
   copia buona solo se è di qualcuno (chi è appena entrato); il ripiego della copia notturna del repo vale solo per
   Danilo, perché è la sua collezione. */
const PERSONA_COPIA = "sillage-app:persona";
const personaDellaCopia = () => {
  try {
    return localStorage.getItem(PERSONA_COPIA) || "";
  } catch {
    return "";
  }
};
/** All'uscita dall'account: via le copie di chi c'era, così il telefono non mostra la sua vetrina a un altro. */
export function scordaCopie() {
  try {
    [CHIAVE_COPIA, PERSONA_COPIA, "sillage-app:diario"].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* niente da scordare */
  }
}
/** La copia sul telefono vale solo se è di qualcuno che il ponte ha riconosciuto (prima degli account il telefono
    di chi non era entrato teneva la vetrina di Danilo: quella non si mostra più). */
function leggiCopia(): Dati | null {
  try {
    const d = JSON.parse(localStorage.getItem(CHIAVE_COPIA) ?? "null");
    return d && Array.isArray(d.profumi) && personaDellaCopia() ? d : null;
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

/** La copia notturna dei dati (data/*.json del repo, copiata nell'app a ogni build): il ripiego dell'avvio a
    freddo senza rete, come nell'app di oggi. Il service worker la tiene in cache. */
async function leggiDalRepo(): Promise<Dati | null> {
  try {
    const nomi = ["profumi", "note", "layering", "consigli"] as const;
    const parti = await Promise.all(nomi.map((n) => fetch(`${import.meta.env.BASE_URL}data/${n}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))));
    return pulisci(Object.fromEntries(nomi.map((n, i) => [n, parti[i]])));
  } catch {
    return null;
  }
}

/** Solo i profumi in collezione (attivo ≠ «no»), con i campi che possono mancare messi a posto. */
function pulisci(grezzo: unknown): Dati {
  const d = grezzo as Partial<Dati> & Record<string, unknown>;
  // una vetrina vuota va bene solo se è di una persona riconosciuta (chi è appena entrato in Sillage)
  const diQualcuno = !!(d && (d.chi as Chi | undefined)?.persona);
  if (!d || !Array.isArray(d.profumi) || (!d.profumi.length && !diQualcuno)) throw new Error("il ponte ha risposto senza profumi");
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
  const [dati, setDati] = useState<Dati | null>(() => (haCredenziali() ? leggiCopia() : null));
  const [origine, setOrigine] = useState<Origine>(() => (haCredenziali() && leggiCopia() ? "copia" : "nessuna"));
  const [entrato, setEntrato] = useState(haCredenziali);
  const [carica, setCarica] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [giro, setGiro] = useState(0);
  const [statoChiave, setStatoChiave] = useState<StatoChiave>(() => (haCredenziali() ? "da-provare" : "assente"));
  const [chi, setChi] = useState<Chi | null>(null);

  // una chiave nuova (o tolta) in Impostazioni, un'entrata o un'uscita dall'account: si rilegge subito
  useEffect(() => {
    const cambia = () => {
      setStatoChiave(haCredenziali() ? "da-provare" : "assente");
      setEntrato(haCredenziali());
      setChi(null); // chi era riconosciuto valeva per le credenziali di prima
      setGiro((g) => g + 1);
    };
    // tornata la rete: si rilegge, così il diario e lo stato della chiave tornano veri
    const rete = () => setGiro((g) => g + 1);
    window.addEventListener("sillage-chiave", cambia);
    window.addEventListener("sillage-accesso", cambia);
    window.addEventListener("online", rete);
    return () => {
      window.removeEventListener("sillage-chiave", cambia);
      window.removeEventListener("sillage-accesso", cambia);
      window.removeEventListener("online", rete);
    };
  }, []);

  useEffect(() => {
    // nessuno è entrato: niente da chiedere, e niente di chi c'era prima (l'ingresso copre tutto)
    if (!haCredenziali()) {
      scordaCopie();
      setDati(null);
      setOrigine("nessuna");
      setChi(null);
      setErrore(null);
      setCarica(false);
      return;
    }
    const ctrl = new AbortController();
    let vivo = true; // falso quando il componente rinuncia a questa richiesta
    const timer = setTimeout(() => ctrl.abort(), ATTESA_MAX);
    setCarica(true);
    const chiave = leggiChiave();
    // con chiave o account si chiede la propria vetrina, diario compreso (POST, credenziali nel corpo)
    credenziali()
      .then((c) => {
        if (!c.chiave && !c.accesso) throw new Error("nessun account su questo telefono");
        return fetch(PONTE, { method: "POST", signal: ctrl.signal, cache: "no-store", body: new URLSearchParams({ azione: "leggi", ...c }) });
      })
      .then((r) => {
        if (!r.ok) throw new Error("il ponte ha risposto " + r.status);
        return r.json();
      })
      .then((grezzo) => {
        if (!vivo) return;
        const g = grezzo as { diario?: Voce[]; diarioChiuso?: boolean; chi?: Chi };
        setChi(g.chi ?? null);
        // il ponte non sa chi sei (account senza vetrina, accesso scaduto, chiave sbagliata): risponde con la vetrina
        // di Danilo, che qui non si mostra; l'ingresso chiede di rientrare o di scegliere il nome
        if (!g.chi?.persona) {
          scordaCopie();
          diario.segnalaChiave();
          setStatoChiave("sbagliata");
          setDati(null);
          setOrigine("nessuna");
          setErrore(null);
          return;
        }
        const d = pulisci(grezzo);
        try {
          if (g.chi?.persona) localStorage.setItem(PERSONA_COPIA, g.chi.persona);
          else localStorage.removeItem(PERSONA_COPIA);
        } catch {
          /* niente */
        }
        if (Array.isArray(g.diario)) {
          diario.impostaConfermate(g.diario);
          setStatoChiave("giusta");
          // riconosciuto: parte quello che aspettava; poi, se l'account basta da solo, la vecchia chiave se ne va
          void diario.sincronizza().then(() => {
            if (g.chi?.da === "accesso" && chiave && !diario.coda().length) scordaChiave();
          });
        } else if (chiave || leggiSessione()) {
          diario.segnalaChiave();
          setStatoChiave("sbagliata");
        } else setStatoChiave("assente");
        setDati(d);
        setOrigine("ponte");
        setErrore(null);
        scriviCopia(d);
      })
      .catch(async (e: unknown) => {
        if (!vivo) return;
        // avvio a freddo senza rete e senza copia sul telefono: la copia notturna del repo (data/*.json), che è
        // la collezione di Danilo: solo per lui (l'ultima volta il ponte ha riconosciuto Danilo, o c'è la sua chiave)
        const diDanilo = personaDellaCopia() === "danilo" || !!leggiChiave();
        if (!leggiCopia() && diDanilo) {
          const d = await leggiDalRepo();
          if (d && vivo) {
            setDati(d);
            setOrigine("repo");
          }
        }
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
      chi,
      entrato,
      riprova,
      aggiornaProfumo
    };
  }, [dati, origine, carica, errore, riprova, statoChiave, chi, entrato, aggiornaProfumo]);

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useDati() {
  const c = useContext(Contesto);
  if (!c) throw new Error("useDati fuori da DatiProvider");
  return c;
}
