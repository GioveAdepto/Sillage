import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconaX } from "./Icone";

/* La guida con le schermate di «Aggiungi profumo» (scelta dell'utente del 17 novembre 2026): i passi stanno dove
   servono, ognuno con la sua schermata in piccolo; toccandola si apre il cassetto con le schermate grandi, una alla
   volta, da scorrere col dito o con Avanti. Le schermate sono quelle dell'iPhone di Danilo, rimpicciolite, con un
   cerchio d'ottone sul tasto da toccare, in public/img/guida/ (nella cache: la guida si vede anche senza rete). */

export interface Passo {
  /** il testo del passo, nella lista */
  testo: ReactNode;
  /** la schermata (in public/img/guida/), se c'è */
  img?: string;
  /** cosa dice la schermata grande */
  didascalia?: string;
}

const NUMERI = ["I", "II", "III", "IV", "V", "VI"];
const percorso = (img: string) => import.meta.env.BASE_URL + "img/guida/" + img;

export default function GuidaPassi({ passi, titolo }: { passi: Passo[]; titolo: string }) {
  const [aperto, setAperto] = useState<number | null>(null);
  const conImmagine = passi.filter((p) => p.img);
  return (
    <>
      <ol className="ag-guida">
        {passi.map((p, i) => (
          <li key={i} className={p.img ? "con-schermata" : undefined}>
            <span>{p.testo}</span>
            {p.img ? (
              <button type="button" className="ag-mini" onClick={() => setAperto(conImmagine.indexOf(p))} aria-label={`Guarda la schermata del passo ${NUMERI[i]}`}>
                <img src={percorso(p.img)} alt="" loading="lazy" />
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {conImmagine.length ? (
        <button type="button" className="link-piano ag-in-grande" onClick={() => setAperto(0)}>
          Guarda i passi in grande
        </button>
      ) : null}
      {aperto !== null ? (
        <Grande passi={conImmagine} numeri={conImmagine.map((p) => NUMERI[passi.indexOf(p)])} titolo={titolo} da={aperto} chiudi={() => setAperto(null)} />
      ) : null}
    </>
  );
}

function Grande({ passi, numeri, titolo, da, chiudi }: { passi: Passo[]; numeri: string[]; titolo: string; da: number; chiudi: () => void }) {
  const pannello = useRef<HTMLDivElement>(null);
  const nastro = useRef<HTMLDivElement>(null);
  const [qui, setQui] = useState(da);

  useEffect(() => {
    pannello.current?.focus();
    const tasti = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi();
    };
    document.addEventListener("keydown", tasti);
    document.documentElement.classList.add("senza-scorrimento");
    return () => {
      document.removeEventListener("keydown", tasti);
      document.documentElement.classList.remove("senza-scorrimento");
    };
  }, [chiudi]);

  // si apre sul passo toccato
  useEffect(() => {
    const n = nastro.current;
    if (n) n.scrollLeft = da * n.clientWidth;
  }, [da]);

  const vai = (i: number) => {
    const n = nastro.current;
    if (!n) return;
    const j = Math.max(0, Math.min(passi.length - 1, i));
    const meta = j * n.clientWidth;
    n.scrollTo({ left: meta, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setQui(j);
    // se lo scorrimento morbido non parte (pagina in secondo piano, browser che lo ignora), ci si va diretti
    setTimeout(() => {
      if (Math.abs(n.scrollLeft - meta) > 4) n.scrollLeft = meta;
    }, 450);
  };

  return (
    <div className="fondale" onClick={(e) => e.target === e.currentTarget && chiudi()}>
      <div className="cassetto ag-grande" role="dialog" aria-modal="true" aria-labelledby="t-guida" tabIndex={-1} ref={pannello}>
        <header className="cassetto-testa">
          <div>
            <p className="incisa">
              Passo {numeri[qui]} · {qui + 1} di {passi.length}
            </p>
            <h2 id="t-guida">{titolo}</h2>
          </div>
          <button type="button" className="cf-x" onClick={chiudi} aria-label="Chiudi">
            <IconaX />
          </button>
        </header>
        <div
          className="ag-nastro"
          ref={nastro}
          onScroll={(e) => {
            const n = e.currentTarget;
            const i = Math.round(n.scrollLeft / Math.max(1, n.clientWidth));
            if (i !== qui) setQui(i);
          }}
        >
          {passi.map((p, i) => (
            <figure key={i} className="ag-fotogramma" aria-hidden={i !== qui}>
              <img src={percorso(p.img!)} alt={p.didascalia ?? ""} />
              <figcaption>
                <em>{numeri[i]}.</em> {p.didascalia}
              </figcaption>
            </figure>
          ))}
        </div>
        <footer className="cassetto-piede ag-grande-piede">
          <button type="button" className="btn-filo" onClick={() => vai(qui - 1)} disabled={qui === 0}>
            Indietro
          </button>
          <span className="ag-puntini" aria-hidden="true">
            {passi.map((_, i) => (
              <i key={i} className={i === qui ? "si" : undefined} />
            ))}
          </span>
          {qui < passi.length - 1 ? (
            <button type="button" className="btn-filo pieno" onClick={() => vai(qui + 1)}>
              Avanti
            </button>
          ) : (
            <button type="button" className="btn-filo pieno" onClick={chiudi}>
              Ho capito
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
