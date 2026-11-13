import { useSearchParams } from "react-router";
import { useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { SEZIONI_GUIDA, guida } from "../viste/calcoli";
import { adesso } from "../profumo";
import { occasioneProbabile } from "../consiglio";
import { Testata } from "../componenti/Righe";
import { Tessera, Tessere } from "../componenti/Tessera";
import { useTitolo } from "../componenti/comuni";

/* Guida: cosa mettere, occasione per occasione (disegnaGuida in js/viste.js). Una occasione alla volta, scelta
   dalle pillole; la stagione in corso viene per prima. L'occasione sta nell'indirizzo (#/guida?occ=ufficio):
   ogni apertura riparte da quella più probabile adesso. */
export default function Guida() {
  const { dati } = useDati();
  const { meteo } = useMeteo();
  const [par, setPar] = useSearchParams();
  useTitolo("Guida · Sillage");
  const scelta = SEZIONI_GUIDA.find((x) => x.k === par.get("occ")) ?? SEZIONI_GUIDA.find((x) => x.k === occasioneProbabile("oggi", meteo)) ?? SEZIONI_GUIDA[0];
  if (!dati)
    return (
      <section className="segnaposto">
        <p className="incisa">Guida</p>
        <h1 className="titolo-pagina">Un momento…</h1>
      </section>
    );
  const g = guida(dati.profumi, scelta.k, adesso().stagione);
  return (
    <section className="vista guida">
      <Testata incisa="Guida" titolo="Occasione per occasione" testo="Cosa mettere, a seconda di dove vai. Si aggiorna da sola quando la collezione cambia." />
      <div className="chips occasioni" role="tablist" aria-label="Occasione">
        {SEZIONI_GUIDA.map((x) => (
          <button
            key={x.k}
            type="button"
            role="tab"
            className="chip"
            aria-selected={x.k === scelta.k}
            aria-pressed={x.k === scelta.k}
            onClick={() => setPar({ occ: x.k }, { replace: true, preventScrollReset: true })}
          >
            {x.breve} <small>{g.conta.find((c) => c.k === x.k)?.n}</small>
          </button>
        ))}
      </div>

      <article className="carta-avorio">
        <header className="carta-testa">
          <div>
            <h2>{scelta.t}</h2>
            <p>{scelta.sub}</p>
          </div>
          <p className="conto">
            <b>{g.si}</b>
            {g.si === 1 ? "boccetta" : "boccette"}
          </p>
        </header>
        {g.vuota ? <p className="testo-piccolo">Nessuna boccetta in collezione per questa occasione.</p> : null}
        {g.gruppi.map((gr) => {
          const corpo = (
            <Tessere>
              {gr.lista.map(({ p, nota }) => (
                <Tessera key={p.id} p={p} nota={nota} classe={gr.tipo === "stagione" ? "" : gr.tipo} />
              ))}
            </Tessere>
          );
          const testa = (
            <>
              <span className="incisa">{gr.etichetta}</span>
              {gr.ora ? <span className="targa">Stagione in corso</span> : null}
              <span className="gruppo-q">{gr.lista.length}</span>
            </>
          );
          return gr.tipo === "altri" ? (
            <details key={gr.etichetta} className="gruppo-guida">
              <summary className="gruppo-testa">{testa}</summary>
              {corpo}
            </details>
          ) : (
            <div key={gr.etichetta} className="gruppo-guida">
              <div className="gruppo-testa">{testa}</div>
              {corpo}
            </div>
          );
        })}
        {scelta.nota ? <p className="nota-guida">{scelta.nota}</p> : null}
      </article>
    </section>
  );
}
