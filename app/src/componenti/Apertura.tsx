import { useEffect, useState } from "react";
import { useDati } from "../dati";
import { useMenoMovimento } from "./comuni";

/* La vetrina si apre (apriVetrina in js/app.js): all'avvio due ante di travertino coprono lo schermo; quando la
   collezione è pronta si aprono verso l'esterno, come le porte di una vetrina. Sull'iPhone la schermata d'avvio
   dell'app è la stessa vetrina chiusa (public/img/avvio, strumenti/schermate-avvio.py), così il passaggio non si
   vede. Mai meno di mezzo secondo, mai più di due e mezzo anche se i dati tardano. Una volta sola per apertura
   dell'app; con «meno movimento» non c'è. */
const avvioPagina = performance.now();
let giaAperta = false;

export default function Apertura() {
  const { dati } = useDati();
  const riduci = useMenoMovimento();
  const [stato, setStato] = useState<"chiusa" | "apri" | "via">(giaAperta || riduci ? "via" : "chiusa");
  const pronta = !!dati;

  useEffect(() => {
    if (stato !== "chiusa") return;
    const apri = () => {
      giaAperta = true;
      setStato("apri");
    };
    const massimo = setTimeout(apri, Math.max(0, 2500 - (performance.now() - avvioPagina)));
    const minimo = pronta ? setTimeout(apri, Math.max(0, 520 - (performance.now() - avvioPagina))) : undefined;
    return () => {
      clearTimeout(massimo);
      clearTimeout(minimo);
    };
  }, [pronta, stato]);
  useEffect(() => {
    if (stato !== "apri") return;
    const t = setTimeout(() => setStato("via"), 1500);
    return () => clearTimeout(t);
  }, [stato]);

  if (stato === "via") return null;
  return (
    <div className={"apertura" + (stato === "apri" ? " apri" : "")} aria-hidden="true">
      <div className="anta sinistra">
        <i className="maniglia" />
      </div>
      <div className="anta destra">
        <i className="maniglia" />
      </div>
      <div className="apertura-marchio">
        <span className="apertura-s">S</span>
        <span className="apertura-nome">Sillage</span>
        <span className="apertura-sotto">Collezione privata</span>
      </div>
    </div>
  );
}
