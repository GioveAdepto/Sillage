import { Link, useSearchParams, useViewTransitionState } from "react-router";
import { useMemo } from "react";
import { useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { adesso, concPerEsteso, eCampione, nr } from "../profumo";
import { CIELI, finestraMeteo, piovosa, type Finestra, type OraMeteo } from "../meteo";
import { OCCASIONI, candidati, eOccasione, inizioPer, maiuscola, occasioneProbabile, type Candidato, type Occasione, type Quando } from "../consiglio";
import Piedistallo from "../componenti/Piedistallo";
import { Boccetta, useMenoMovimento, useTitolo } from "../componenti/comuni";

/* Consigliami: oggi, stasera o domani, e l'occasione. La prima scelta sul piedistallo con i suoi motivi,
   quattro alternative, e le ore che il profumo passerà sulla pelle. Il punteggio è in consiglio.ts.
   Le scelte stanno nell'indirizzo (#/consigliami?quando=domani&occ=ufficio): nessuna memoria tra
   un'apertura e l'altra. «Lo metto oggi» arriva col Diario (tappa 3). */

const QUANDO: [Quando, string][] = [
  ["oggi", "Oggi"],
  ["stasera", "Stasera"],
  ["domani", "Domani"]
];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const ROMANI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export default function Consigliami() {
  const { dati, numeri, carica } = useDati();
  const { meteo, conPosto, cercando, ora, chiedi, scorda } = useMeteo();
  const [par, setPar] = useSearchParams();
  useTitolo("Consigliami · Sillage");

  const quando: Quando = par.get("quando") === "domani" ? "domani" : par.get("quando") === "stasera" ? "stasera" : "oggi";
  const occ: Occasione = eOccasione(par.get("occ")) ? (par.get("occ") as Occasione) : occasioneProbabile(quando, meteo);
  const imposta = (cambi: Record<string, string | null>) => {
    const n = new URLSearchParams(par);
    for (const [k, v] of Object.entries(cambi)) {
      if (v == null) n.delete(k);
      else n.set(k, v);
    }
    setPar(n, { replace: true, preventScrollReset: true });
  };

  // «ora» cambia ogni cinque minuti e quando arriva il meteo: la classifica si ricalcola
  const { lista, da, a } = useMemo(() => {
    const da = inizioPer(quando, occ);
    return { lista: dati ? candidati(dati.profumi, occ, quando, { meteo }) : [], da, a: adesso(da, meteo) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, occ, quando, meteo, ora]);

  if (!dati)
    return (
      <section className="segnaposto">
        <p className="incisa">Consigliami</p>
        <h1 className="titolo-pagina">{carica ? "Un momento…" : "Senza collezione"}</h1>
        <div className="filo-ottone" />
        {carica ? null : <p className="testo">Per consigliare serve la collezione: apri l'app una volta con la rete.</p>}
      </section>
    );

  // la giornata intera, per la riga sotto il titolo: il resto di oggi fino a mezzanotte, o domani dalle 7 alle 23
  const domani = quando === "domani";
  const mezzanotte = new Date(da).setHours(24, 0, 0, 0);
  const giornata = finestraMeteo(
    meteo,
    domani ? new Date(new Date(da).setHours(7, 0, 0, 0)) : da,
    domani ? 16 : Math.max(1, (mezzanotte - da.getTime()) / 36e5)
  );
  const fresco = a.meteo; // il meteo di adesso, se ha meno di 3 ore
  const primaOra = giornata?.ore[0];
  const [primo, ...resto] = lista.slice(0, 5);

  return (
    <section className="consigliami">
      <div className="cons-sinistra">
      <header className="cons-testa">
        <p className="incisa">Consigliami{domani ? " per domani" : quando === "stasera" ? " per stasera" : ""}</p>
        <h1>
          {maiuscola(GIORNI[da.getDay()])} {da.getDate()} {da.toLocaleDateString("it-IT", { month: "long" })}
        </h1>
        <p className="cons-sotto">
          {domani
            ? `${a.nome}` + (giornata ? ` · ${giornata.min}–${giornata.max}° percepiti${giornata.pioggia !== null ? `, pioggia dalle ${giornata.pioggia}` : ""}` : "")
            : `${a.momento === "giorno" ? "Di giorno" : "Sera"} · ${a.nome}` +
              (!domani && quando === "oggi" && fresco
                ? ` · ${fresco.temperatura}° ${CIELI[fresco.codice] || ""}`.trimEnd() +
                  (fresco.percepita !== fresco.temperatura ? ` (percepiti ${fresco.percepita}°)` : "")
                : "") +
              (giornata && giornata.ore.length > 1 ? ` · fino a sera ${giornata.min}–${giornata.max}°` : "")}
        </p>
      </header>

      <div className="gruppo">
        <p className="incisa">Quando</p>
        <div className="chips">
          {QUANDO.map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={quando === k} onClick={() => imposta({ quando: k === "oggi" ? null : k, occ: null })}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="strumenti">
        <div>
          <span className="k">Ora</span>
          <span className="v">{`${da.getHours()}:${String(da.getMinutes()).padStart(2, "0")}`}</span>
        </div>
        <div>
          <span className="k">Aria</span>
          <span className="v">{primaOra ? `${primaOra.P} °C` : quando === "oggi" && fresco ? `${fresco.percepita} °C` : "—"}</span>
        </div>
        <div>
          <span className="k">Cielo</span>
          <span className="v">{maiuscola(primaOra ? CIELI[primaOra.c] ?? "—" : quando === "oggi" && fresco ? CIELI[fresco.codice] ?? "—" : "—")}</span>
        </div>
        <div>
          <span className="k">Stagione</span>
          <span className="v">{maiuscola(a.nome)}</span>
        </div>
      </div>

      <div className="gruppo">
        <p className="incisa">Occasione</p>
        <div className="chips">
          {OCCASIONI.map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={occ === k} onClick={() => imposta({ occ: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {primo ? (
        <Scelta c={primo} n={numeri.get(primo.p.id) ?? primo.p.id} totale={lista.length} occ={occ} quando={quando} da={da} />
      ) : (
        <p className="testo">Nessun profumo adatto a questa occasione.</p>
      )}
      </div>

      <div className="cons-destra">
      {primo ? (
        <>
          {resto.length ? (
            <section className="sez" aria-labelledby="t-alt">
              <div className="sez-testa">
                <h3 id="t-alt">In alternativa</h3>
                <i className="linea" />
              </div>
              <ol className="alt alt-cons">
                {resto.map((x, i) => (
                  <li key={x.p.id}>
                    <Link className="alt-riga" to={`/profumo/${x.p.id}`} state={{ da: "consigliami" }}>
                      <span className="mini">
                        <Boccetta p={x.p} className="" />
                      </span>
                      <span className="alt-testo">
                        <span className="marca">
                          {x.p.brand} · {x.p.conc}
                          {eCampione(x.p) ? " · campione" : ""}
                        </span>
                        <span className="n">{x.p.name}</span>
                        <span className="perche">
                          {x.pro.slice(0, 3).map(maiuscola).join(" · ")}
                          {x.contro.length ? <em> · ma {x.contro[0]}</em> : null}
                        </span>
                      </span>
                      <span className="nr">{ROMANI[i + 1]}.</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <Giornata f={primo.f} />
        </>
      ) : null}

      <div className="meteo-nota">
        {meteo && conPosto ? (
          <p>
            Meteo di dove sei, ora per ora, da Open-Meteo ·{" "}
            <button type="button" className="collegamento" onClick={scorda}>
              non usarlo più
            </button>
          </p>
        ) : (
          <>
            <button type="button" className="btn-filo" onClick={chiedi} disabled={cercando}>
              {cercando ? "Cerco la posizione…" : "Usa il meteo di dove sei"}
            </button>
            <p>
              Senza meteo conta il calendario. La posizione serve una volta: resta sul telefono, arrotondata a una decina di chilometri.
            </p>
          </>
        )}
      </div>
      </div>
    </section>
  );
}

function Scelta({ c, n, totale, occ, quando, da }: { c: Candidato; n: number; totale: number; occ: Occasione; quando: Quando; da: Date }) {
  const { p } = c;
  const riduci = useMenoMovimento();
  const verso = `/profumo/${p.id}`;
  const inVolo = useViewTransitionState(verso);
  const quale = quando === "domani" ? "di domani" : quando === "stasera" ? "di stasera" : "di oggi";
  return (
    <article className="scelta" aria-labelledby="t-scelta">
      <div className="scelta-testa">
        <p className="incisa">La scelta {quale}</p>
        <span className="nr-grande">{(eCampione(p) ? "Campione " : "") + nr(n)}</span>
      </div>
      <Piedistallo key={p.id} p={p} nomeVolo={inVolo ? "boccetta-" + p.id : undefined} />
      <div className="titolo">
        <p className="marca">{p.brand}</p>
        <h2 className="nome-grande" id="t-scelta">
          {p.name}
        </h2>
        <p className="sotto">
          {concPerEsteso(p.conc)} · {p.famiglia}
          {quando === "domani" ? ` · domani dalle ${da.getHours()}` : ""}
        </p>
        <p className="cons-conto">
          Il primo consiglio su {totale} {occ === "ufficio" ? "valutati" : "adatti"}
        </p>
      </div>
      <ol className="motivi">
        {c.pro.map((m, i) => (
          <li key={"p" + i}>
            <em>{ROMANI[i] ?? i + 1}.</em>
            <span>{maiuscola(m)}</span>
          </li>
        ))}
        {c.contro.map((m, i) => (
          <li key={"c" + i} className="ma">
            <em>ma</em>
            <span>{maiuscola(m)}</span>
          </li>
        ))}
      </ol>
      <div className="azioni">
        <Link className="btn-filo pieno" to={verso} viewTransition={!riduci} state={{ volo: !riduci, da: "consigliami" }}>
          Apri la scheda
        </Link>
      </div>
    </article>
  );
}

/* Le ore sulla pelle, in fila: al massimo sette tacche, con la curva della temperatura percepita. */
function Giornata({ f }: { f: Finestra | null }) {
  if (!f || f.ore.length < 2) return null;
  const passo = Math.ceil(f.ore.length / 7);
  const tacche = f.ore.filter((_, i) => i % passo === 0);
  const P = tacche.map((o) => o.P),
    alto = Math.max(...P),
    basso = Math.min(...P),
    campo = Math.max(1, alto - basso);
  const x = (i: number) => ((i + 0.5) / tacche.length) * 350;
  const y = (v: number) => 54 - ((v - basso) / campo) * 42;
  return (
    <section className="sez meteo" aria-labelledby="t-met">
      <div className="sez-testa">
        <h3 id="t-met">Sulla pelle</h3>
        <i className="linea" />
        <span className="scala">
          dalle {f.dalle} {f.alle === 0 ? "a mezzanotte" : "alle " + f.alle} · percepiti
        </span>
      </div>
      <svg className="curva" viewBox="0 0 350 64" preserveAspectRatio="none" aria-hidden="true">
        <path className="griglia" d="M0 16H350M0 32H350M0 48H350" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polyline
          points={tacche.map((o, i) => `${x(i).toFixed(1)},${y(o.P).toFixed(1)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path className="adesso-linea" d={`M${x(0).toFixed(1)} 0V64`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="ore" style={{ gridTemplateColumns: `repeat(${tacche.length}, minmax(0, 1fr))` }}>
        {tacche.map((o, i) => (
          <div
            key={o.t}
            className={"fascia-ora" + (i === 0 ? " adesso" : "") + (piovosa(o) ? " pioggia" : "")}
            aria-label={`ore ${new Date(o.t).getHours()}, ${o.P} gradi percepiti, ${CIELI[o.c] ?? ""}`}
          >
            <span>{new Date(o.t).getHours()}</span>
            <Cielo o={o} />
            <b>{o.P}°</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function Cielo({ o }: { o: OraMeteo }) {
  const c = o.c;
  const nuvola = <path d="M7 14.5h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.8 9 2.8 2.8 0 0 0 7 14.5z" />;
  let segno;
  if (c <= 1) segno = (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </>
    );
  else if (c >= 95) segno = (
      <>
        {nuvola}
        <path d="M12.5 16l-2 3h3l-2 3" />
      </>
    );
  else if ((c >= 71 && c <= 77) || c === 85 || c === 86) segno = (
      <>
        {nuvola}
        <path d="M9 18.5h.01M12.5 19.5h.01M16 18.5h.01" strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  else if (piovosa(o)) segno = (
      <>
        {nuvola}
        <path d="M9 17.5l-.8 2M12.5 17.5l-.8 2M16 17.5l-.8 2" />
      </>
    );
  else segno = <path d="M7 17h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.8 11.5 2.8 2.8 0 0 0 7 17z" />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {segno}
    </svg>
  );
}

