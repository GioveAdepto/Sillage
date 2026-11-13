import { Link } from "react-router";
import { useDati } from "../dati";
import { acquisti, giaInCasa } from "../viste/calcoli";
import { eCampione, livelloResiduo, rinumera } from "../profumo";
import { ProfiloFragrantica, Testata } from "../componenti/Righe";
import { Tessera, Tessere, vediIn } from "../componenti/Tessera";
import { Mini, useTitolo } from "../componenti/comuni";
import { IconaSi } from "../componenti/Icone";

/* Acquisti: dove la collezione è scoperta e con cosa riempirla (disegnaAcquisti in js/viste.js), dai consigli
   del database. Una voce è «già in casa» se cita un numero di catalogo o nomina un profumo della collezione. */
export default function Acquisti() {
  const { dati, numeri } = useDati();
  useTitolo("Acquisti · Sillage");
  if (!dati)
    return (
      <section className="segnaposto">
        <p className="incisa">Acquisti</p>
        <h1 className="titolo-pagina">Un momento…</h1>
      </section>
    );
  const a = acquisti(dati.consigli, dati.profumi);
  const boccette = dati.profumi.filter((p) => !eCampione(p)).length;
  let gruppo = "";
  return (
    <section className="vista acquisti">
      <Testata incisa="Acquisti" titolo="Lacune e idee" testo={`Dove la collezione è scoperta e con cosa riempirla, letta sulle ${boccette} boccette di oggi.`} />

      {a.finendo.length ? (
        <div className="carta-avorio">
          <p className="incisa">Stanno finendo</p>
          <Tessere>
            {a.finendo.map((p) => (
              <Tessera key={p.id} p={p} nota={livelloResiduo(p)!.l.toLowerCase()} />
            ))}
          </Tessere>
        </div>
      ) : null}

      <div className="misure">
        <div>
          <span className="v">{a.lacune}</span>
          <span className="s">{a.lacune === 1 ? "lacuna aperta" : "lacune aperte"}</span>
        </div>
        <div>
          <span className="v">{a.idee}</span>
          <span className="s">idee d'acquisto</span>
        </div>
        <div>
          <span className="v">{a.nChiusi}</span>
          <span className="s">chiuse di recente</span>
        </div>
      </div>

      <div className="ricette">
        {a.aperte.map((c) => {
          const i = dati.consigli.indexOf(c as never);
          const [titolo, ...resto] = c.n.split(" — ");
          const testa = c.g !== gruppo ? ((gruppo = c.g), <p className="divisorio incisa">{gruppo}</p>) : null;
          return (
            <div key={i}>
              {testa}
              <details className="ricetta" id={"acq-" + i}>
                <summary className="ricetta-testa">
                  <span className="bollo" aria-hidden="true">
                    +
                  </span>
                  <span className="riga-testo">
                    <b>{titolo}</b>
                    <small>
                      {resto.length ? resto.join(" — ").replace(/^./, (x) => x.toUpperCase()) + " · " : ""}
                      {c.voci.length} {c.voci.length === 1 ? "idea" : "idee"}
                    </small>
                  </span>
                </summary>
                <div className="ricetta-corpo">
                  <p className="testo-piccolo">{rinumera(c.gap, numeri)}</p>
                  <ol className="candidati">
                    {c.voci.map((v, j) => {
                      const p = giaInCasa(v.t, dati.profumi);
                      return (
                        <li key={j} className={p ? "preso" : undefined}>
                          <span className="candidato-n">{p ? <IconaSi /> : j + 1}</span>
                          <div>
                            <b>{v.t}</b>
                            <p>{rinumera(v.d, numeri)}</p>
                            {p ? (
                              <Link className="collegamento gia" to={vediIn(p)}>
                                {eCampione(p) ? "Ce l'hai come campione" : "Ce l'hai in collezione"} →
                              </Link>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {a.chiuse.map((c, k) => (
        <div key={k}>
          <p className="divisorio incisa">{c.g}</p>
          <ul className="righe-vedi">
            {c.voci.map((v, j) => {
              const p = giaInCasa(v.t, dati.profumi),
                gap = v.t.split("→")[0].trim();
              const dentro = (
                <>
                  <Mini p={p} classe={p ? "" : "vuota"} />
                  <span className="riga-testo">
                    <small className="chiuso-gap">✓ {gap}</small>
                    <b>{p ? p.name : v.t.split("→")[1] || ""}</b>
                    <small>{rinumera(v.d, numeri)}</small>
                  </span>
                </>
              );
              return (
                <li key={j}>
                  {p ? (
                    <Link className="riga-vedi" to={vediIn(p)}>
                      {dentro}
                    </Link>
                  ) : (
                    <div className="riga-vedi">{dentro}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="divisorio incisa">Altrove</p>
      <ProfiloFragrantica />
    </section>
  );
}
