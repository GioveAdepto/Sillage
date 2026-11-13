import { Link } from "react-router";
import { useMemo, useState } from "react";
import { useDati } from "../dati";
import { useDiario } from "../diario/uso";
import { MAPPA, mappa, numeri, type Numeri as DatiNumeri } from "../viste/calcoli";
import { aggiuntoIl, immagine, eCampione, eNovita } from "../profumo";
import { quandoFu } from "../diario/pezzi";
import { Classifica, ProfiloFragrantica, Sezione, Testata } from "../componenti/Righe";
import { Tessera, Tessere, vediIn } from "../componenti/Tessera";
import { Mini, useTitolo } from "../componenti/comuni";

/* Numeri: la collezione in cifre (disegnaNumeri in js/viste.js). Ogni profumo nominato porta alla sua teca,
   chiusa e illuminata. I calcoli sono in src/viste/calcoli.ts, verificati con strumenti/verifica-viste.mjs. */

const TINTA_STAGIONE: Record<string, string> = { pe: "var(--giorno)", tutto: "var(--bosco)", ai: "var(--ambra)" };
const TINTA_VETRO: Record<string, string> = { blu: "var(--acqua)", verde: "var(--bosco)", rosso: "var(--ambra)" };
const maiuscola = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

export default function Numeri() {
  const { dati } = useDati();
  const { diario, versione } = useDiario();
  const [conCampioni, setConCampioni] = useState(false);
  useTitolo("Numeri · Sillage");
  const n = useMemo(() => (dati ? numeri(dati.profumi, diario.voci()) : null), [dati, versione]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!dati || !n)
    return (
      <section className="segnaposto">
        <p className="incisa">Numeri</p>
        <h1 className="titolo-pagina">Un momento…</h1>
      </section>
    );
  const tot = n.boccette;
  return (
    <section className="vista numeri">
      <Testata incisa="Numeri" titolo="La collezione in cifre" testo="Tocca un profumo per trovarlo nella sua teca." />

      <div className="misure">
        <div>
          <span className="k">Boccette</span>
          <span className="v">{n.boccette}</span>
          <span className="s">in collezione</span>
        </div>
        <div>
          <span className="k">Campioni</span>
          <span className="v">{n.campioni}</span>
          <span className="s">in prova</span>
        </div>
        <div>
          <span className="k">Marchi</span>
          <span className="v">{n.marchi}</span>
          <span className="s">{n.cloni} cloni e dupe</span>
        </div>
      </div>
      <div className="misure seconda">
        <div>
          <span className="k">Rating medio</span>
          <span className="v">{n.mediaRating}</span>
          <span className="s">su Fragrantica</span>
        </div>
        <div>
          <span className="k">Durata media</span>
          <span className="v">
            {n.mediaDurata}
            <small> ore</small>
          </span>
          <span className="s">dichiarata</span>
        </div>
        <div>
          <span className="k">Giorno e sera</span>
          <span className="v">{n.giornoESera}</span>
          <span className="s">boccette</span>
        </div>
      </div>

      <div className="vista-colonne">
        <div>
          <Mappa conCampioni={conCampioni} setConCampioni={setConCampioni} />

          <Sezione titolo="Stagione">
            <Segmenti parti={n.stagioni.map((x) => ({ ...x, c: TINTA_STAGIONE[x.k] }))} />
          </Sezione>
          <Sezione titolo="Famiglia olfattiva">
            <Segmenti parti={n.famiglie.map((x) => ({ ...x, c: TINTA_VETRO[x.k] }))} />
          </Sezione>

          <Sezione titolo="Occasione d'uso" scala="sì · con moderazione">
            <ul className="aste">
              {n.usi.map((u) => (
                <li key={u.k}>
                  <span className="asta-nome">{u.l}</span>
                  <span className="asta-barra doppia">
                    <i style={{ width: (u.n / tot) * 100 + "%" }} />
                    <i className="tenue" style={{ width: (u.m / tot) * 100 + "%" }} />
                  </span>
                  <span className="asta-v">
                    {u.n}
                    {u.m ? <em> +{u.m}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Sezione>

          <Sezione titolo="Accordi più presenti">
            <ul className="aste">
              {n.accordi.map((a) => (
                <li key={a.a}>
                  <span className="asta-nome">{a.a}</span>
                  <span className="asta-barra">
                    <i style={{ width: (a.n / n.accordi[0].n) * 100 + "%" }} />
                  </span>
                  <span className="asta-v">{a.n}</span>
                </li>
              ))}
            </ul>
          </Sezione>
        </div>

        <div>
          <Sezione titolo="Rating Fragrantica">
            <Classifica lista={n.perRating} val={(p) => p.rating! - 3} fmt={(p) => "★ " + p.rating!.toFixed(1).replace(".", ",")} max={2} />
          </Sezione>
          <Sezione titolo="Durata dichiarata">
            <Classifica lista={n.perDurata} val={(p) => p.longevita!} fmt={(p) => p.longevita + "h"} max={n.perDurata[0]?.longevita || 1} />
          </Sezione>

          {n.elencoCloni.length ? (
            <Sezione titolo="Cloni e i loro originali">
              <ul className="righe-vedi">
                {n.elencoCloni.map(({ p, dupe, orig }) => (
                  <li key={p.id}>
                    <Link className="riga-vedi" to={vediIn(p)}>
                      <Mini p={p} />
                      <span className="riga-testo">
                        <b>{p.name}</b>
                        <small>
                          → {dupe}
                          {orig ? <em> · {orig}</em> : null}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Sezione>
          ) : null}

          <Storico n={n} />
          <DiarioNumeri n={n} />
        </div>
      </div>
      <ProfiloFragrantica />
    </section>
  );
}

/** Una barra sola divisa in parti: le proporzioni a colpo d'occhio. */
function Segmenti({ parti }: { parti: { k: string; l: string; n: number; pct: number; c: string }[] }) {
  return (
    <>
      <div className="segmenti" aria-hidden="true">
        {parti
          .filter((x) => x.n)
          .map((x) => (
            <span key={x.k} style={{ flex: x.n, background: x.c }} />
          ))}
      </div>
      <ul className="legenda">
        {parti.map((x) => (
          <li key={x.k}>
            <i style={{ background: x.c }} />
            {x.l}
            <b>{x.n}</b>
            <em>{x.pct}%</em>
          </li>
        ))}
      </ul>
    </>
  );
}

function Mappa({ conCampioni, setConCampioni }: { conCampioni: boolean; setConCampioni: (v: boolean) => void }) {
  const { dati } = useDati();
  const m = useMemo(() => mappa(dati!.profumi, conCampioni), [dati, conCampioni]);
  const { W, H, m: mg, R } = MAPPA;
  return (
    <Sezione
      titolo="Mappa olfattiva"
      scala={
        <button type="button" className="collegamento" onClick={() => setConCampioni(!conCampioni)}>
          {conCampioni ? "Solo boccette" : "Anche i campioni"}
        </button>
      }
    >
      <svg className="mappa" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mappa olfattiva della collezione: da fresco a caldo, da discreto a potente">
        {Array.from({ length: 9 }, (_, i) => {
          const cx = i % 3,
            cy = Math.floor(i / 3),
            x0 = mg + (cx * (W - 2 * mg)) / 3,
            y0 = H - mg - ((cy + 1) * (H - 2 * mg)) / 3;
          return (
            <g key={i}>
              <rect className={"mappa-zona" + (m.conta[i] ? "" : " vuota")} x={x0 + 1} y={y0 + 1} width={(W - 2 * mg) / 3 - 2} height={(H - 2 * mg) / 3 - 2} rx="2" />
              {m.conta[i] ? null : (
                <text className="mappa-vuota" x={x0 + (W - 2 * mg) / 6} y={y0 + (H - 2 * mg) / 6 + 3}>
                  vuota
                </text>
              )}
            </g>
          );
        })}
        <text className="mappa-asse" x={mg} y={H - 10}>
          fresco
        </text>
        <text className="mappa-asse" x={W - mg} y={H - 10} textAnchor="end">
          caldo
        </text>
        <text className="mappa-asse" x="16" y={H - mg} transform={`rotate(-90 16 ${H - mg})`}>
          discreto
        </text>
        <text className="mappa-asse" x="16" y={mg} textAnchor="end" transform={`rotate(-90 16 ${mg})`}>
          potente
        </text>
        <defs>
          {m.punti.map((a, i) => (
            <clipPath key={i} id={"mp" + i}>
              <circle cx={a.x.toFixed(1)} cy={a.y.toFixed(1)} r={R} />
            </clipPath>
          ))}
        </defs>
        {m.punti.map((a, i) => (
          <a key={a.p.id} href={"#" + vediIn(a.p)} className={"mappa-punto" + (eCampione(a.p) ? " campione" : "")} aria-label={a.p.name}>
            <title>{a.p.name}</title>
            <circle cx={a.x.toFixed(1)} cy={a.y.toFixed(1)} r={R + 1.5} className="mappa-anello" />
            {a.p.img ? (
              <image
                href={immagine(a.p)}
                x={(a.x - R * 1.25).toFixed(1)}
                y={(a.y - R * 1.5).toFixed(1)}
                width={R * 2.5}
                height={R * 3}
                preserveAspectRatio="xMidYMid meet"
                clipPath={`url(#mp${i})`}
              />
            ) : null}
          </a>
        ))}
      </svg>
      <p className="nota-piccola">
        {m.vuote.length ? `Nessuna boccetta tra le ${m.vuote.join(", tra le ")}.` : "Ogni zona ha almeno una boccetta."} Tocca un profumo per
        trovarlo nella sua teca.
      </p>
    </Sezione>
  );
}

function Storico({ n }: { n: DatiNumeri }) {
  if (!n.storico.length) return null;
  return (
    <Sezione titolo="Storico aggiunte" scala={n.novita ? `${n.novita} novità` : undefined}>
      {n.storico.map(({ mese, lista }) => (
        <div key={mese}>
          <p className="mese-storico">
            {mese}
            <span>{lista.length}</span>
          </p>
          <ul className="righe-vedi">
            {lista.map((p) => {
              const d = aggiuntoIl(p)!;
              return (
                <li key={p.id}>
                  <Link className="riga-vedi" to={vediIn(p)}>
                    <Mini p={p} />
                    <span className="riga-testo">
                      <b>
                        {p.name}
                        {eNovita(p) ? <span className="novita">Nuovo</span> : null}
                      </b>
                      <small>
                        {p.brand} · {eCampione(p) ? `campione${p.formatoMl ? ` ${p.formatoMl} ml` : ""}` : `${p.conc}${p.formatoMl ? ` · ${p.formatoMl} ml` : ""}`}
                        {` · ${d.getDate()} ${d.toLocaleDateString("it-IT", { month: "short" })}`}
                      </small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {n.partenza ? <p className="nota-piccola">Più {n.partenza} dalla collezione di partenza, senza data.</p> : null}
    </Sezione>
  );
}

function DiarioNumeri({ n }: { n: DatiNumeri }) {
  const { perId } = useDati();
  const d = n.diario;
  return (
    <Sezione
      titolo="Diario d'uso"
      scala={
        <Link className="collegamento" to="/diario">
          Apri il diario →
        </Link>
      }
    >
      {!d ? (
        <p className="testo-piccolo">
          Segna quello che indossi con «Lo metto oggi», nella scheda di ogni profumo o da Consigliami. Qui compariranno le più usate e quelle
          dimenticate.
        </p>
      ) : (
        <>
          <div className="misure piccole">
            <div>
              <span className="v">{d.questoMese}</span>
              <span className="s">questo mese</span>
            </div>
            <div>
              <span className="v">{d.usati}</span>
              <span className="s">profumi usati</span>
            </div>
            <div>
              <span className="v">{d.maiSegnate}</span>
              <span className="s">boccette mai segnate</span>
            </div>
          </div>
          <p className="incisa sotto-titolo">Le più indossate</p>
          <Classifica lista={d.usate.map((x) => x.p)} val={(p) => d.usate.find((x) => x.p === p)!.n} fmt={(p) => d.usate.find((x) => x.p === p)!.n + "×"} max={d.usate[0].n} />
          <p className="incisa sotto-titolo">Da riprendere</p>
          <Tessere>
            {d.dimenticate.map(({ p, g }) => (
              <Tessera key={p.id} p={p} nota={g === null ? "mai" : quandoFu(g)} />
            ))}
          </Tessere>
          <p className="incisa sotto-titolo">Per stagione</p>
          {d.perStagione.length ? (
            <ul className="per-stagione">
              {d.perStagione.map((s) => (
                <li key={s.s}>
                  <span className="stag-nome">
                    {maiuscola(s.s)}
                    <small>
                      {s.tot} {s.tot === 1 ? "voce" : "voci"}
                    </small>
                  </span>
                  <span className="stag-top">
                    {s.top.map(({ id, n: q }) => {
                      const p = perId.get(id);
                      return p ? (
                        <Link key={id} to={vediIn(p)} className="stag-p" aria-label={`${p.name}, ${q} volte`}>
                          <Mini p={p} />
                          <small>{q}×</small>
                        </Link>
                      ) : null;
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="testo-piccolo">Ancora poche voci.</p>
          )}
          <p className="incisa sotto-titolo">Rotazione del mese</p>
          <div className="rotazione">
            <span className="asta-barra">
              <i style={{ width: Math.round((d.rotazione.diverse / d.rotazione.su) * 100) + "%" }} />
            </span>
            <span>
              {d.rotazione.diverse} boccette diverse su {d.rotazione.su}
            </span>
          </div>
        </>
      )}
    </Sezione>
  );
}
