import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { Profumo } from "../tipi";
import { useDati } from "../dati";
import {
  LIVELLI,
  STAGIONI,
  USI,
  accordiConForza,
  adesso,
  concPerEsteso,
  copieDi,
  dataAggiunta,
  eCampione,
  eNovita,
  livelloResiduo,
  migliaia,
  momLbl,
  nr,
  originaleDi,
  piramide,
  rinumera,
  similiA,
  stagLbl,
  valoreUso,
  voto
} from "../profumo";
import { Boccetta, useMenoMovimento, useTitolo } from "../componenti/comuni";
import Piedistallo from "../componenti/Piedistallo";
import { LoMetto, SuDiTe } from "../diario/pezzi";
import { useDiario } from "../diario/uso";
import { useAvviso } from "../componenti/Avvisi";
import { rifiutoChiave, scriviAlPonte } from "../ponte";
import { IconaFuori, IconaIndietro, IconaMezzo, IconaNo, IconaSi } from "../componenti/Icone";

/* La scheda di un profumo, pagina con indirizzo proprio (#/profumo/24).
   Si arriva dalla teca con la boccetta in volo (View Transition): la stessa foto passa
   dalla mensola al piedistallo. In questa tappa è in sola lettura: «Lo metto oggi» e il residuo
   da cambiare arrivano col Diario (tappa 3). */

const NOMI_STAGIONE = { inverno: "Inverno", primavera: "Primavera", estate: "Estate", autunno: "Autunno" };

export default function Scheda() {
  const { id } = useParams();
  const { dati, perId, numeri, carica } = useDati();
  const p = perId.get(Number(id));
  const n = p ? (numeri.get(p.id) ?? p.id) : 0;
  useTitolo(p ? `${p.name} · Sillage` : "Sillage");

  if (!p) {
    return (
      <section className="segnaposto">
        <Torna id={null} />
        <h1 className="titolo-pagina">{!dati && carica ? "Apro la scheda…" : "Profumo non trovato"}</h1>
        <div className="filo-ottone" />
        {!dati && carica ? null : <p className="testo">In collezione non c'è un profumo con questo numero.</p>}
      </section>
    );
  }
  return <SchedaAperta p={p} n={n} tutti={dati!.profumi} numeri={numeri} />;
}

/** Da dove si è arrivati, scritto nello stato della navigazione dai link dell'app. */
type Provenienza = { volo?: boolean; da?: "collezione" | "scheda" | "consigliami" } | null;

/** In alto a sinistra. Dalla vetrina si torna indietro (filtri e scorrimento ritrovati);
    da un'altra scheda si torna a quella; da un link esterno si va alla vetrina, sulla teca di questo profumo. */
function Torna({ id }: { id: number | null }) {
  const navigate = useNavigate();
  const da = (useLocation().state as Provenienza)?.da;
  const riduci = useMenoMovimento();
  return (
    <button
      type="button"
      className="torna"
      onClick={() => {
        if (da) navigate(-1);
        else navigate(id ? `/?vedi=${id}` : "/", { viewTransition: !riduci });
      }}
    >
      <IconaIndietro />
      {da === "scheda" ? "Indietro" : da === "consigliami" ? "Consigliami" : "Collezione"}
    </button>
  );
}

function Sezione({ titolo, scala, children }: { titolo: string; scala?: string; children: ReactNode }) {
  const idT = "t-" + titolo.toLowerCase().replace(/[^a-z]+/g, "-");
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

const larghezza = (v: number) => ({ "--w": Math.max(0, Math.min(100, v)) + "%" }) as CSSProperties;

function SchedaAperta({ p, n, tutti, numeri }: { p: Profumo; n: number; tutti: Profumo[]; numeri: Map<number, number> }) {
  const loc = useLocation();
  const volo = !!(loc.state as Provenienza)?.volo;
  const ora = adesso();
  const pir = piramide(p);
  const acc = accordiConForza(p);
  const conForza = acc.some((a) => a.forza > 0);
  const orig = originaleDi(p, tutti);
  const copie = copieDi(p, tutti);
  const simili = similiA(p, tutti);
  const residuo = livelloResiduo(p);
  const campione = eCampione(p);
  const giorno = p.giornoPct != null && Number.isFinite(+p.giornoPct) ? Math.round(+p.giornoPct) : null;

  return (
    <article className={"scheda " + p.colore}>
      <div className="scheda-vetrina">
        <div className="barra">
          <Torna id={p.id} />
          <span className="nr-grande">
            {campione ? "Campione " : ""}
            {nr(n)}
          </span>
        </div>

        <Piedistallo p={p} inVolo={volo} nomeVolo={"boccetta-" + p.id} />

        <div className="titolo">
          <p className="marca">{p.brand}</p>
          <h1 className="nome-grande">{p.name}</h1>
          <p className="sotto">
            {concPerEsteso(p.conc)} · {p.famiglia}
            {p.genere ? ` · ${p.genere}` : ""}
          </p>
          {eNovita(p) || p.dupe || campione ? (
            <p className="targhe">
              {eNovita(p) ? <span className="targa">Nuovo · dal {dataAggiunta(p)}</span> : null}
              {campione ? <span className="targa">Campione in prova</span> : null}
              {p.dupe ? <span className="targa">Copia di {p.dupe.split(" (")[0]}</span> : null}
            </p>
          ) : null}
        </div>

        <div className="misure">
          <div>
            <span className="k">Voto</span>
            <span className="v">
              {p.rating ? voto(p.rating) : "—"}
              <small> /5</small>
            </span>
            <span className="s">{p.voti ? `${migliaia(p.voti)} voti` : "su Fragrantica"}</span>
          </div>
          <div>
            <span className="k">Durata</span>
            <span className="v">
              {p.longevita ?? "—"}
              <small> ore</small>
            </span>
            <span className="s">longevità</span>
          </div>
          <div>
            <span className="k">Sillage</span>
            <span className="v">{p.sillage || "—"}</span>
            <span className="s">scia</span>
          </div>
        </div>
        <LoMetto p={p} />
      </div>

      <div className="scheda-dati">
        {pir.length ? (
          <Sezione titolo="Piramide">
            <dl className="piramide">
              {pir.map((r, i) =>
                r.livello ? (
                  <div key={i} className="piano">
                    <dt>{r.livello}</dt>
                    <dd>{r.note}</dd>
                  </div>
                ) : (
                  <div key={i} className="piano senza-livello">
                    <dd>{r.note}</dd>
                  </div>
                )
              )}
            </dl>
          </Sezione>
        ) : null}

        {acc.length ? (
          <Sezione titolo="Accordi" scala={conForza ? "forza su 100" : undefined}>
            {conForza ? (
              <>
                <div className="scala-num" aria-hidden="true">
                  <i />
                  <span>
                    <b>0</b>
                    <b>25</b>
                    <b>50</b>
                    <b>75</b>
                    <b>100</b>
                  </span>
                  <i />
                </div>
                <ul className="righe">
                  {acc.map((a) => (
                    <li key={a.nome}>
                      <span className="n">{a.nome}</span>
                      <span className="traccia" role="img" aria-label={`${a.nome} ${a.forza}`}>
                        <i style={larghezza(a.forza)} />
                      </span>
                      <span className="v">{a.forza || "—"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="semplice">{acc.map((a) => a.nome).join(" · ")}</p>
            )}
          </Sezione>
        ) : null}

        <Sezione titolo="Stagioni" scala={p.stagioni ? "% dei voti" : undefined}>
          {p.stagioni ? (
            <ul className="righe">
              {STAGIONI.map((s) => {
                const v = Math.round(Number(p.stagioni![s]) || 0);
                const attuale = s === ora.nome;
                return (
                  <li key={s} className={attuale ? "attuale" : undefined}>
                    <span className="n">
                      {NOMI_STAGIONE[s]}
                      {attuale ? <em>ora</em> : null}
                    </span>
                    <span
                      className="traccia"
                      role="img"
                      aria-label={`${NOMI_STAGIONE[s]} ${v} per cento${attuale ? ", stagione attuale" : ""}`}
                    >
                      <i style={larghezza(v)} />
                    </span>
                    <span className="v">{v}%</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="semplice">{stagLbl(p.stagione)}</p>
          )}
        </Sezione>

        <Sezione titolo="Giorno e sera">
          {giorno != null ? (
            <>
              <div className="asta" role="img" aria-label={`Giorno ${giorno} per cento, sera ${100 - giorno} per cento`}>
                <i style={{ width: giorno + "%" }} />
                <i style={{ width: 100 - giorno + "%" }} />
              </div>
              <div className="asta-leg">
                <span>Giorno {giorno}%</span>
                <span>Sera {100 - giorno}%</span>
              </div>
            </>
          ) : (
            <p className="semplice">{momLbl(p.momento)}</p>
          )}
        </Sezione>

        <Sezione titolo="Uso">
          <ul className="usi">
            {USI.map(({ campo, etichetta }) => {
              const v = valoreUso(p[campo] as never);
              return (
                <li key={campo} className={v}>
                  {v === "si" ? <IconaSi /> : v === "misura" ? <IconaMezzo /> : <IconaNo />}
                  {etichetta}
                  {v === "misura" ? <span className="con-misura">con misura</span> : null}
                  {v === "no" ? <span className="vh">: no</span> : null}
                </li>
              );
            })}
          </ul>
        </Sezione>

        {p.notePersonali ? (
          <Sezione titolo="Note personali">
            <p className="citazione">«{p.notePersonali}»</p>
          </Sezione>
        ) : null}

        <SuDiTeSezione p={p} />

        {p.desc ? (
          <Sezione titolo="Racconto">
            <p className="racconto">{rinumera(p.desc, numeri)}</p>
          </Sezione>
        ) : null}

        {p.dupe || copie.length ? (
          <Sezione titolo="Parentele">
            <ul className="alt">
              {p.dupe ? (
                <RigaAlt
                  q={orig}
                  sopra="Copia di"
                  nome={p.dupe.split(" (")[0]}
                  sotto={
                    (orig ? (eCampione(orig) ? "L'originale è tra i campioni" : "L'originale è in collezione") : "L'originale non è in collezione") +
                    (p.cloneStato ? ` · ${p.cloneStato}` : "")
                  }
                  destra={orig ? nr(numeri.get(orig.id) ?? orig.id) : null}
                />
              ) : null}
              {copie.map((q) => (
                <RigaAlt
                  key={q.id}
                  q={q}
                  sopra={eCampione(q) ? "Il suo clone, tra i campioni" : "Il suo clone, in collezione"}
                  nome={q.name}
                  sotto={q.brand}
                  destra={nr(numeri.get(q.id) ?? q.id)}
                />
              ))}
            </ul>
          </Sezione>
        ) : null}

        {simili.length ? (
          <Sezione titolo="Somiglia a" scala="affinità">
            <ul className="alt">
              {simili.map(({ q, v }) => (
                <RigaAlt
                  key={q.id}
                  q={q}
                  sopra={eCampione(q) ? "Campione · " + q.brand : q.brand}
                  nome={q.name}
                  sotto={q.famiglia}
                  destra={Math.round(v * 100) + "%"}
                />
              ))}
            </ul>
          </Sezione>
        ) : null}

        <Sezione titolo={campione ? "Il campione" : "La boccetta"}>
          <dl className="boccetta-dati">
            <div>
              <dt>Formato</dt>
              <dd>{p.formatoMl ? `${p.formatoMl} ml` : "Non indicato"}</dd>
            </div>
            <div>
              <dt>Quanto ne resta</dt>
              <dd>{residuo ? residuo.l : "Non indicato"}</dd>
            </div>
          </dl>
          <Residuo p={p} />
        </Sezione>

        {p.fragrantica ? (
          <a className="btn-filo esterno" href={p.fragrantica} target="_blank" rel="noopener noreferrer">
            Apri su Fragrantica
            <IconaFuori />
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** Una riga con la boccetta piccola: porta alla scheda di quel profumo, se è in collezione. */
function RigaAlt({ q, sopra, nome, sotto, destra }: { q: Profumo | null; sopra: string; nome: string; sotto: string; destra: string | null }) {
  const dentro = (
    <>
      {q ? (
        <span className="mini">
          <Boccetta p={q} className="" />
        </span>
      ) : (
        <span className="mini vuota" aria-hidden="true" />
      )}
      <span className="alt-testo">
        <span className="marca">{sopra}</span>
        <span className="n">{nome}</span>
        <span className="perche">{sotto}</span>
      </span>
      {destra ? <span className="nr">{destra}</span> : <span />}
    </>
  );
  return <li>{q ? <Link className="alt-riga" to={`/profumo/${q.id}`} state={{ da: "scheda" }}>{dentro}</Link> : <div className="alt-riga">{dentro}</div>}</li>;
}

/** «Su di te», solo se il diario ha qualcosa da dire su questo profumo. */
function SuDiTeSezione({ p }: { p: Profumo }) {
  const { diario } = useDiario();
  const qualcosa = diario.voci().some((v) => +v.id === p.id && (v.voto || v.nota || v.occasione));
  return qualcosa ? (
    <Sezione titolo="Su di te">
      <SuDiTe p={p} />
    </Sezione>
  ) : null;
}

/* Quanto ne resta, scelto a mano a occhio: sette tacche, dalla boccetta finita (sinistra) a quella piena (destra),
   come l'indicatore della benzina. Va subito al database con la chiave (come nell'app di oggi: niente coda);
   se non riesce, torna com'era e lo dice. */
function Residuo({ p }: { p: Profumo }) {
  const { aggiornaProfumo } = useDati();
  const avvisa = useAvviso();
  const [invio, setInvio] = useState(false);
  const r = livelloResiduo(p);
  const segna = async (v: number) => {
    if (invio || (r && r.v === v)) return;
    const prima = p.residuoPct ?? null;
    aggiornaProfumo(p.id, { residuoPct: v });
    setInvio(true);
    try {
      const { stato, corpo } = await scriviAlPonte({ azione: "residuo", id: String(p.id), valore: String(v) });
      if (rifiutoChiave(corpo)) throw new Error("chiave");
      if (stato >= 400 || !corpo || !corpo.ok) throw new Error(String(corpo?.errore || "rifiutato"));
    } catch (e) {
      aggiornaProfumo(p.id, { residuoPct: prima });
      const m = String((e as Error).message);
      avvisa(
        m === "chiave"
          ? "Non salvato: serve la chiave di Sillage, in Altro ▸ Impostazioni"
          : /fetch|network|load failed/i.test(m)
            ? "Non salvato: riprova con la rete"
            : "Non salvato: " + m
      );
    } finally {
      setInvio(false);
    }
  };
  return (
    <>
      <div className="livello" role="radiogroup" aria-label="Quanto ne resta" aria-busy={invio}>
        {[...LIVELLI].reverse().map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={!!r && r.v === v}
            aria-label={l}
            title={l}
            className={(r && v <= r.v && r.v > 0 ? "pieno" : "") + (r && r.v === v ? " on" : "")}
            onClick={() => segna(v)}
          />
        ))}
      </div>
      <div className="livello-eti" aria-hidden="true">
        <span>Finita</span>
        <span>Mezza</span>
        <span>Piena</span>
      </div>
      <p className="nota-piccola">Tocca una tacca per dire quanto ne resta: si salva nel database, con la chiave.</p>
    </>
  );
}
