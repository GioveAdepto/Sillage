import { useEffect, useSyncExternalStore } from "react";
import { coda, sincronizza } from "../aggiunte";
import { useDati } from "../dati";
import { useAvviso } from "./Avvisi";

/** Le aggiunte in attesa di rete (per l'avviso in Collezione). */
export const useInAttesa = () => useSyncExternalStore(coda.ascolta, coda.leggi, coda.leggi);

/** Manda le aggiunte in coda all'avvio, al ritorno della rete e quando l'app torna in primo piano; poi rilegge. */
export default function AggiunteVive() {
  const { riprova } = useDati();
  const avvisa = useAvviso();
  useEffect(() => {
    const vai = () =>
      void sincronizza().then(({ fatte, rifiutate }) => {
        if (fatte) {
          avvisa(fatte === 1 ? "Il profumo in attesa è entrato nella tua vetrina." : `${fatte} profumi in attesa sono entrati nella tua vetrina.`);
          riprova();
        }
        rifiutate.forEach((r) => avvisa("Il database non ha accettato " + r));
      });
    const visibile = () => document.visibilityState === "visible" && vai();
    if (coda.leggi().length) vai();
    window.addEventListener("online", vai);
    document.addEventListener("visibilitychange", visibile);
    return () => {
      window.removeEventListener("online", vai);
      document.removeEventListener("visibilitychange", visibile);
    };
  }, [avvisa, riprova]);
  return null;
}

/** In Collezione: quello che aspetta la rete per entrare. */
export function InAttesa() {
  const c = useInAttesa();
  if (!c.length) return null;
  return (
    <p className="ag-in-attesa" role="status">
      <i aria-hidden="true" />
      {c.length === 1 ? `${c[0].nome} aspetta la rete per entrare nella tua vetrina.` : `${c.length} profumi aspettano la rete per entrare nella tua vetrina.`}
    </p>
  );
}
