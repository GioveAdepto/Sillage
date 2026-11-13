import { Link } from "react-router";
import { useEffect } from "react";
import { IconaAvanti } from "../componenti/Icone";
import { IN_ARRIVO, OrigineDati } from "./Segnaposto";

/* Altro: l'indice delle pagine che non stanno nella barra in basso. */
const QUI = ["layering", "guida", "acquisti", "confronta", "impostazioni"];

export default function Altro() {
  useEffect(() => {
    document.title = "Altro · Sillage";
  }, []);
  const voci = QUI.map((q) => IN_ARRIVO.find((p) => p.percorso === q)!);
  return (
    <section className="indice">
      <p className="incisa">Sillage</p>
      <h1 className="titolo-pagina">Altro</h1>
      <div className="filo-ottone" />
      <ul className="indice-voci">
        {voci.map((p) => (
          <li key={p.percorso}>
            <Link to={"/" + p.percorso} className="indice-voce">
              <span className="indice-testo">
                <b>{p.titolo}</b>
                <span>{p.breve}</span>
              </span>
              <span className="indice-tappa">{p.pronta ? "" : p.tappa}</span>
              <IconaAvanti className="indice-freccia" />
            </Link>
          </li>
        ))}
      </ul>
      <OrigineDati />
    </section>
  );
}
