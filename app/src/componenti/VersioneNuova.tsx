import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { IconaX } from "./Icone";

/* C'è una versione nuova: il service worker la scarica, ma l'app non si ricarica da sola (un appunto in
   scrittura andrebbe perso). Compare un avviso con «Aggiorna»; «Più tardi» lo chiude, e la versione nuova
   parte alla prossima apertura. Si controlla all'avvio, quando l'app torna in primo piano e ogni mezz'ora. */
export default function VersioneNuova() {
  const {
    needRefresh: [nuova, setNuova],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return;
      const controlla = () => {
        if (navigator.onLine) r.update().catch(() => {});
      };
      setInterval(controlla, 30 * 60e3);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && controlla());
    }
  });
  useEffect(() => {
    if (nuova) document.documentElement.classList.add("con-aggiornamento");
    return () => document.documentElement.classList.remove("con-aggiornamento");
  }, [nuova]);
  if (!nuova) return null;
  return (
    <div className="aggiornamento" role="status">
      <span className="aggiornamento-punto" aria-hidden="true" />
      <span className="aggiornamento-testo">
        <b>Versione nuova di Sillage</b>
        Tocca «Aggiorna» quando hai finito quello che stai scrivendo
      </span>
      <button type="button" className="btn-filo pieno" onClick={() => updateServiceWorker(true)}>
        Aggiorna
      </button>
      <button type="button" className="cf-x" onClick={() => setNuova(false)} aria-label="Più tardi">
        <IconaX />
      </button>
    </div>
  );
}
