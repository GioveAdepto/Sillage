import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Profumo } from "../tipi";
import { immagineAssoluta } from "../profumo";
import { Boccetta, useMenoMovimento } from "./comuni";
import { IconaX } from "./Icone";

/** La scena: binario di luce, faretto, fascio, piedistallo di travertino con la boccetta e la sua ombra.
    `inVolo`: la boccetta è appena arrivata con una View Transition e non ricade dall'alto.
    `inMano` (la scheda): la boccetta, posata, ondeggia appena come presa in mano; all'arrivo un riflesso
    attraversa il vetro una volta; toccandola la si guarda da vicino (l'«esame» dell'app di oggi). */
export default function Piedistallo({ p, inVolo = false, nomeVolo, inMano = false }: { p: Profumo; inVolo?: boolean; nomeVolo?: string; inMano?: boolean }) {
  const [esame, setEsame] = useState(false);
  const riduci = useMenoMovimento();
  const maschera = { "--maschera": `url("${immagineAssoluta(p)}")` } as CSSProperties;
  const boccetta = (
    <>
      <Boccetta p={p} pigra={false} nomeVolo={nomeVolo} />
      {inMano && !riduci ? <span className="riflesso passa" style={maschera} aria-hidden="true" /> : null}
    </>
  );
  return (
    <div className={"scena" + (inVolo ? " in-volo" : "") + (inMano ? " in-mano" : "")}>
      <span className="alone" />
      <span className="fascio" />
      <span className="binario" />
      <span className="faretto" />
      <span className="pavimento" />
      <div className="posa">
        <div className="piedistallo" />
        <span className="ombra" />
        <div className="sopra">
          {inMano ? (
            <button type="button" className="vetro tasto-esame" onClick={() => setEsame(true)} aria-label={`Guarda da vicino ${p.name}`}>
              {boccetta}
            </button>
          ) : (
            <span className="vetro">{boccetta}</span>
          )}
        </div>
      </div>
      {/* fuori dalla scena, sopra tutta la pagina: la scena ha un suo livello e taglierebbe il riquadro */}
      {esame ? createPortal(<Esame p={p} chiudi={() => setEsame(false)} />, document.body) : null}
    </div>
  );
}

/** La boccetta da vicino: in grande, sotto il faretto, che ondeggia piano. Si chiude toccando o con Esc. */
function Esame({ p, chiudi }: { p: Profumo; chiudi: () => void }) {
  const rif = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rif.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && chiudi();
    document.addEventListener("keydown", esc);
    document.documentElement.classList.add("senza-scorrimento");
    return () => {
      document.removeEventListener("keydown", esc);
      document.documentElement.classList.remove("senza-scorrimento");
    };
  }, [chiudi]);
  return (
    <div className="esame" role="dialog" aria-modal="true" aria-label={`${p.brand} ${p.name}, da vicino`} tabIndex={-1} ref={rif} onClick={chiudi}>
      <span className="esame-luce" aria-hidden="true" />
      <div className="esame-vetro">
        <Boccetta p={p} className="esame-img" pigra={false} />
      </div>
      <span className="esame-ombra" aria-hidden="true" />
      <p className="esame-nome">
        <span className="marca">{p.brand}</span>
        {p.name}
      </p>
      <button type="button" className="cf-x esame-chiudi" onClick={chiudi} aria-label="Chiudi">
        <IconaX />
      </button>
    </div>
  );
}
