import { useEffect, useMemo, useSyncExternalStore } from "react";
import { diario } from "../ponte";
import { useDati } from "../dati";
import { useAvviso } from "../componenti/Avvisi";
import type { Uso } from "./coda";

/** Il diario per le pagine: si ridisegnano a ogni voce messa, tolta o confermata. */
export function useDiario() {
  const versione = useSyncExternalStore(diario.ascolta, diario.istantanea, diario.istantanea);
  const { perId } = useDati();
  const ids = useMemo(() => new Set(perId.keys()), [perId]);
  return { diario, versione, ids };
}

/** Manda la coda quando torna la rete, quando l'app torna in primo piano e all'avvio; dice i rifiuti del ponte. */
export function DiarioVivo() {
  const avvisa = useAvviso();
  const { versione } = useDiario();
  useEffect(() => {
    const vai = () => void diario.sincronizza();
    const visibile = () => document.visibilityState === "visible" && vai();
    vai();
    window.addEventListener("online", vai);
    document.addEventListener("visibilitychange", visibile);
    return () => {
      window.removeEventListener("online", vai);
      document.removeEventListener("visibilitychange", visibile);
    };
  }, []);
  useEffect(() => {
    if (diario.ultimoRifiuto) {
      avvisa("Il database ha rifiutato una voce del diario: " + diario.ultimoRifiuto);
      diario.ultimoRifiuto = null;
    }
  }, [versione, avvisa]);
  return null;
}

/** Segna o toglie un profumo oggi (o in un giorno), con l'avviso se il giorno è pieno. */
export function useSegna() {
  const avvisa = useAvviso();
  const { ids } = useDiario();
  return (id: number, data: string, uso?: Uso) => {
    const e = diario.segna(id, data, uso, ids);
    if (!e.ok) avvisa(e.avviso);
    return e.ok;
  };
}
