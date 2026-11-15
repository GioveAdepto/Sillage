import { Link, useParams } from "react-router";
import type { Profumo } from "../tipi";
import { useDati } from "../dati";
import { eCampione } from "../profumo";
import { Mini, useTitolo } from "../componenti/comuni";
import { useDalPonte } from "../componenti/dalPonte";
import { IconaAvanti } from "../componenti/Icone";

/* Le vetrine degli altri (decisione dell'utente: agli altri si mostra solo la collezione). Le vede solo chi è
   entrato, in sola lettura; mai diario, note personali, residuo, ricette o consigli. */

interface Persona {
  id: string;
  nome: string;
  profumi: number;
}

function SoloEntrati() {
  return (
    <p className="stato-chiave assente">
      Le vetrine degli altri le vede solo chi è entrato in Sillage: entra con il tuo account in{" "}
      <Link className="collegamento" to="/impostazioni">
        Impostazioni
      </Link>
      .
    </p>
  );
}

export function Vetrine() {
  useTitolo("Le vetrine · Sillage");
  const { chi } = useDati();
  const { dati, errore } = useDalPonte<{ persone: Persona[] }>(chi?.persona ? { azione: "vetrine" } : null);
  const altri = (dati?.persone ?? []).filter((p) => p.id !== chi?.persona);
  return (
    <section className="indice pagina-vetrine">
      <p className="incisa">Sillage</p>
      <h1 className="titolo-pagina">Le vetrine</h1>
      <div className="filo-ottone" />
      <p className="testo">Le collezioni delle altre persone di Sillage. Il loro diario resta loro.</p>
      {!chi?.persona ? (
        <SoloEntrati />
      ) : errore ? (
        <p className="stato-chiave sbagliata">Le vetrine non si leggono: {errore}.</p>
      ) : !dati ? (
        <p className="testo-piccolo">Apro le vetrine…</p>
      ) : !altri.length ? (
        <p className="testo-piccolo">Per ora in Sillage ci sei solo tu.</p>
      ) : (
        <ul className="indice-voci">
          {altri.map((p) => (
            <li key={p.id}>
              <Link to={"/vetrina/" + p.id} className="indice-voce">
                <span className="indice-testo">
                  <b>{p.nome}</b>
                  <span>{p.profumi === 1 ? "1 profumo" : `${p.profumi} profumi`}</span>
                </span>
                <span className="indice-tappa" />
                <IconaAvanti className="indice-freccia" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VetrinaDi() {
  const { di = "" } = useParams();
  const { chi } = useDati();
  const { dati, errore } = useDalPonte<{ nome: string; profumi: Profumo[] }>(chi?.persona ? { azione: "vetrina", di } : null);
  useTitolo((dati?.nome ? "La vetrina di " + dati.nome : "Una vetrina") + " · Sillage");
  const boccette = (dati?.profumi ?? []).filter((p) => !eCampione(p)),
    campioni = (dati?.profumi ?? []).filter((p) => eCampione(p));
  const riga = (p: Profumo) => (
    <li key={p.id} className="cl-riga vetrina-riga">
      <Mini p={p} />
      <span className="cl-mezzo">
        <span className="cl-nome">
          {p.name}
          <small>{p.conc}</small>
        </span>
        <span className="vetrina-marca">{p.brand}</span>
      </span>
    </li>
  );
  return (
    <section className="vetrina-altro">
      <p className="incisa">
        <Link className="collegamento" to="/vetrine">
          Le vetrine
        </Link>
      </p>
      <h1 className="titolo-pagina">{dati?.nome ? "La vetrina di " + dati.nome : "Una vetrina"}</h1>
      <div className="filo-ottone" />
      {!chi?.persona ? (
        <SoloEntrati />
      ) : errore ? (
        <p className="stato-chiave sbagliata">Questa vetrina non si legge: {errore}.</p>
      ) : !dati ? (
        <p className="testo-piccolo">Apro la vetrina…</p>
      ) : !dati.profumi.length ? (
        <p className="testo-piccolo">La sua vetrina per ora è vuota.</p>
      ) : (
        <>
          <p className="testo-piccolo">
            {boccette.length} {boccette.length === 1 ? "boccetta" : "boccette"}
            {campioni.length ? ` e ${campioni.length} ${campioni.length === 1 ? "campione" : "campioni"}` : ""}.
          </p>
          {boccette.length ? (
            <section className="sez" aria-labelledby="t-boccette">
              <div className="sez-testa">
                <h3 id="t-boccette">Boccette</h3>
                <i className="linea" />
              </div>
              <ul className="classifica">{boccette.map(riga)}</ul>
            </section>
          ) : null}
          {campioni.length ? (
            <section className="sez" aria-labelledby="t-campioni">
              <div className="sez-testa">
                <h3 id="t-campioni">Campioni</h3>
                <i className="linea" />
              </div>
              <ul className="classifica">{campioni.map(riga)}</ul>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
