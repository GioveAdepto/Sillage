import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { aggiornaMeteo, meteoSalvato, postoSalvato, scordaPosto, type Meteo } from "./meteo";

/* Il meteo per tutta l'app: Consigliami e il filtro «Adesso» della Collezione leggono da qui.
   All'avvio si usa la copia sul telefono e, se la posizione c'è già, si rinfresca (come l'app di oggi);
   la posizione si chiede solo dal pulsante. Ogni cinque minuti «adesso» si ricalcola, e quando l'app
   torna in primo piano il meteo vecchio di mezz'ora si riscarica. */
interface StatoMeteo {
  meteo: Meteo | null;
  /** c'è una posizione salvata */
  conPosto: boolean;
  cercando: boolean;
  /** l'ultima volta che si è chiesto «che ore sono»: cambia ogni cinque minuti */
  ora: number;
  chiedi: () => void;
  scorda: () => void;
}
const Contesto = createContext<StatoMeteo | null>(null);

export function MeteoProvider({ children }: { children: ReactNode }) {
  const [meteo, setMeteo] = useState<Meteo | null>(meteoSalvato);
  const [conPosto, setConPosto] = useState(() => !!postoSalvato());
  const [cercando, setCercando] = useState(false);
  const [ora, setOra] = useState(() => Date.now());

  const rinfresca = useCallback(async (chiedi: boolean) => {
    if (chiedi) setCercando(true);
    const r = await aggiornaMeteo(chiedi);
    setMeteo(r.meteo);
    setConPosto(!!r.posto);
    setCercando(false);
    setOra(Date.now());
  }, []);

  useEffect(() => {
    rinfresca(false);
    const t = setInterval(() => setOra(Date.now()), 5 * 6e4);
    const torna = () => {
      if (document.visibilityState === "visible") rinfresca(false);
    };
    document.addEventListener("visibilitychange", torna);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", torna);
    };
  }, [rinfresca]);

  const valore = useMemo<StatoMeteo>(
    () => ({
      meteo,
      conPosto,
      cercando,
      ora,
      chiedi: () => rinfresca(true),
      scorda: () => {
        scordaPosto();
        setMeteo(null);
        setConPosto(false);
      }
    }),
    [meteo, conPosto, cercando, ora, rinfresca]
  );
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useMeteo() {
  const c = useContext(Contesto);
  if (!c) throw new Error("useMeteo fuori da MeteoProvider");
  return c;
}
