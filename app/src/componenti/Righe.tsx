import { Link } from "react-router";
import type { ReactNode } from "react";
import type { Profumo } from "../tipi";
import { Mini } from "./comuni";
import { vediIn } from "./Tessera";

/* Pezzi comuni alle pagine di Numeri, Guida, Layering, Acquisti. Riusano le righe sottili della Scheda. */

export function Sezione({ titolo, scala, children, id }: { titolo: string; scala?: ReactNode; children: ReactNode; id?: string }) {
  const idT = id ?? "t-" + titolo.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section className="sez" aria-labelledby={idT}>
      <div className="sez-testa">
        <h3 id={idT}>{titolo}</h3>
        <i className="linea" />
        {scala ? <span className="scala">{scala}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Testata({ incisa, titolo, testo }: { incisa: string; titolo: string; testo: ReactNode }) {
  return (
    <header className="testata-pagina">
      <p className="incisa">{incisa}</p>
      <h1 className="titolo-pagina">{titolo}</h1>
      <div className="filo-ottone" />
      <p className="testo">{testo}</p>
    </header>
  );
}

/** Una classifica: i primi, poi «Tutti gli altri» da aprire. La barra è lunga quanto il valore sul massimo. */
export function Classifica({
  lista,
  val,
  fmt,
  max,
  quanti = 5
}: {
  lista: Profumo[];
  val: (p: Profumo) => number;
  fmt: (p: Profumo) => ReactNode;
  max: number;
  quanti?: number;
}) {
  const riga = (p: Profumo, i: number) => (
    <li key={p.id}>
      <Link className={"cl-riga" + (i < 3 ? " podio" : "")} to={vediIn(p)}>
        <span className="cl-pos">{i + 1}</span>
        <Mini p={p} />
        <span className="cl-mezzo">
          <span className="cl-nome">
            {p.name}
            <small>{p.conc}</small>
          </span>
          <span className="cl-barra">
            <i style={{ width: Math.max(4, Math.round((val(p) / max) * 100)) + "%" }} />
          </span>
        </span>
        <span className="cl-val">{fmt(p)}</span>
      </Link>
    </li>
  );
  const resto = lista.slice(quanti);
  return (
    <>
      <ol className="classifica">{lista.slice(0, quanti).map(riga)}</ol>
      {resto.length ? (
        <details className="altri">
          <summary>Tutti gli altri {resto.length}</summary>
          <ol className="classifica" start={quanti + 1}>
            {resto.map((p, i) => riga(p, i + quanti))}
          </ol>
        </details>
      ) : null}
    </>
  );
}

/** Il collegamento al profilo Fragrantica (come nell'app di oggi, in fondo a Numeri e Acquisti). */
export function ProfiloFragrantica() {
  return (
    <a className="btn-filo esterno" href="https://www.fragrantica.it/members/74018" target="_blank" rel="noopener noreferrer">
      Il mio profilo su Fragrantica
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M10 5H5v14h14v-5M14 4h6v6M20 4l-9 9" />
      </svg>
    </a>
  );
}
