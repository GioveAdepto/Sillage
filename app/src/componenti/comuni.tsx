import { useEffect, useState } from "react";
import type { Profumo } from "../tipi";
import { immagine } from "../profumo";

/** Chi ha chiesto meno movimento non vede voli né cadute. */
export function useMenoMovimento() {
  const q = "(prefers-reduced-motion: reduce)";
  const [riduci, setRiduci] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const cambia = () => setRiduci(m.matches);
    m.addEventListener("change", cambia);
    return () => m.removeEventListener("change", cambia);
  }, []);
  return riduci;
}

/** La boccetta scontornata: l'ombra vera la fa il CSS (drop-shadow). */
export function Boccetta({
  p,
  className = "bottiglia",
  pigra = true,
  nomeVolo
}: {
  p: Profumo;
  className?: string;
  pigra?: boolean;
  nomeVolo?: string;
}) {
  const src = immagine(p);
  if (!src) return <span className={className + " senza-foto"} aria-hidden="true" />;
  return (
    <img
      className={className}
      src={src}
      alt={`Boccetta di ${p.brand} ${p.name}`}
      loading={pigra ? "lazy" : "eager"}
      decoding="async"
      style={nomeVolo ? { viewTransitionName: nomeVolo } : undefined}
    />
  );
}

/** Titolo della scheda del browser (e del selettore delle app sull'iPhone). */
export function useTitolo(t: string) {
  useEffect(() => {
    document.title = t;
  }, [t]);
}

/** La boccetta in piccolo, sotto il suo faretto (la stessa nicchia della teca, ridotta). */
export function Mini({ p, classe = "" }: { p?: Profumo | null; classe?: string }) {
  return <span className={"mini " + classe}>{p ? <Boccetta p={p} className="" /> : null}</span>;
}
