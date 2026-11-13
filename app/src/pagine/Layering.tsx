import { Link, useSearchParams } from "react-router";
import { useEffect, useMemo } from "react";
import type { Profumo, Ricetta } from "../tipi";
import { useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { useDiario } from "../diario/uso";
import { oggiISO } from "../diario/coda";
import { TIPI_STRATO, partiRicetta, spray } from "../viste/calcoli";
import { adesso, rinumera } from "../profumo";
import { occasioneProbabile } from "../consiglio";
import { Testata } from "../componenti/Righe";
import { vediIn } from "../componenti/Tessera";
import { Mini, useTitolo } from "../componenti/comuni";
import { useAvviso } from "../componenti/Avvisi";
import { IconaSi } from "../componenti/Icone";

/* Layering: le ricette a due strati (disegnaLayering in js/viste.js). Il più denso sotto, il più leggero sopra.
   Il filtro e la ricetta aperta stanno nell'indirizzo (#/layering?tipo=app&ricetta=4). */
const REGOLE = [
  ["Prima il più denso", "Legnoso, ambrato o gourmand sotto; acquatico, agrumato o floreale sopra. Il pesante dura di più e regge la struttura."],
  ["Dosi asimmetriche", "Non serve la stessa quantità per entrambi. Due più uno è quasi sempre il punto di equilibrio."],
  ["Aspetta prima di giudicare", "Quello che stona nei primi minuti spesso si armonizza quando le note di testa evaporano."],
  ["Almeno uno monocorda", "Due profumi molto strutturati litigano. Meglio che uno sia centrato su una nota dominante."]
];
const str = (x: unknown) => String(x ?? "");

export default function Layering() {
  const { dati, perId, numeri } = useDati();
  const [par, setPar] = useSearchParams();
  useTitolo("Layering · Sillage");
  const layering = dati?.layering ?? [];
  const conta = (k: string) => (k === "tutte" ? layering.length : layering.filter((l) => l.t === k).length);
  const tipo = TIPI_STRATO.some(([k]) => k === par.get("tipo")) ? par.get("tipo")! : "tutte";
  const aperta = par.has("ricetta") ? Number(par.get("ricetta")) : null;
  useEffect(() => {
    if (aperta == null) return;
    requestAnimationFrame(() => document.getElementById("lay-" + aperta)?.scrollIntoView({ block: "start" }));
  }, [aperta]);
  if (!dati)
    return (
      <section className="segnaposto">
        <p className="incisa">Layering</p>
        <h1 className="titolo-pagina">Un momento…</h1>
      </section>
    );
  let gruppo = "";
  return (
    <section className="vista layering">
      <Testata
        incisa="Layering"
        titolo="Due strati"
        testo={`${layering.length} abbinamenti fra le tue boccette. Il più denso sotto, il più leggero sopra, e dieci minuti prima di giudicare.`}
      />
      <ol className="regole">
        {REGOLE.map(([t, d], i) => (
          <li key={t}>
            <em>{["I", "II", "III", "IV"][i]}.</em>
            <span>
              <b>{t}</b>
              {d}
            </span>
          </li>
        ))}
      </ol>
      <div className="chips">
        {TIPI_STRATO.filter(([k]) => conta(k)).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={k === tipo} onClick={() => setPar(k === "tutte" ? {} : { tipo: k }, { replace: true, preventScrollReset: true })}>
            {l} <small>{conta(k)}</small>
          </button>
        ))}
      </div>
      <div className="ricette">
        {layering.map((l, i) => {
          if (tipo !== "tutte" && l.t !== tipo) return null;
          const testa = str(l.g) !== gruppo ? ((gruppo = str(l.g)), <p className="divisorio incisa">{gruppo}</p>) : null;
          return (
            <div key={i}>
              {testa}
              <RicettaVista l={l} i={i} perId={perId} numeri={numeri} aperta={aperta === i} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Gocce({ n }: { n: number }) {
  return (
    <span className="gocce" aria-hidden="true">
      {Array.from({ length: Math.min(n, 4) }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function RicettaVista({ l, i, perId, numeri, aperta }: { l: Ricetta; i: number; perId: Map<number, Profumo>; numeri: Map<number, number>; aperta: boolean }) {
  const r = useMemo(() => partiRicetta(l, perId), [l, perId]);
  const riga = (ruolo: string, p: Profumo | undefined, d: number) =>
    p ? (
      <Link className="pila-riga" to={vediIn(p)}>
        <span className="incisa">{ruolo}</span>
        <Mini p={p} />
        <span className="riga-testo">
          <b>{p.name}</b>
          <small>
            {p.brand} · {p.conc}
          </small>
        </span>
        <span className="pila-dose">
          <Gocce n={d} />
          {spray(d)}
        </span>
      </Link>
    ) : null;
  return (
    <details className="ricetta" id={"lay-" + i} open={aperta || undefined}>
      <summary className="ricetta-testa">
        <span className="coppia">
          <Mini p={r.sotto} classe="sotto" />
          <Mini p={r.sopra} classe="sopra" />
        </span>
        <span className="riga-testo">
          <b>{str(l.n)}</b>
          <small>{r.desc || rinumera(l.s, numeri)}</small>
          <small className="dosi">
            {spray(r.dSotto)} sotto · {spray(r.dSopra)} sopra
          </small>
        </span>
      </summary>
      <div className="ricetta-corpo">
        <div className="pila">
          {riga("Sopra", r.sopra, r.dSopra)}
          {riga("Sotto", r.sotto, r.dSotto)}
        </div>
        {r.sotto && r.sopra ? <LoFaccio sotto={r.sotto.id} sopra={r.sopra.id} /> : null}
        <dl className="passi">
          {(
            [
              ["Come si fa", l.come],
              ["Risultato", l.ris],
              ["Perché funziona", l.perche],
              ["Quando", l.quando]
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{rinumera(v, numeri)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

/** «Lo faccio oggi»: segna il layering nel diario di oggi; di nuovo, lo toglie (faiLayering nell'app di oggi). */
function LoFaccio({ sotto, sopra }: { sotto: number; sopra: number }) {
  const { diario, ids } = useDiario();
  const { meteo } = useMeteo();
  const { perId } = useDati();
  const avvisa = useAvviso();
  const oggi = oggiISO();
  const l = diario.layeringDel(oggi);
  const fatto = !!l && l.sotto === sotto && l.sopra === sopra;
  return (
    <button
      type="button"
      className={"indossa" + (fatto ? " fatto" : "")}
      aria-pressed={fatto}
      onClick={() => {
        if (fatto) {
          diario.segna(sotto, oggi, undefined, ids);
          return;
        }
        const e = diario.segnaLayering(sotto, sopra, oggi, { occasione: occasioneProbabile("oggi", meteo), momento: adesso(new Date(), meteo).momento }, ids, (id) => perId.get(id)?.name ?? "");
        avvisa(e.ok ? "Layering segnato nel diario di oggi." : e.avviso);
      }}
    >
      {fatto ? (
        <span className="si">
          <IconaSi />
          Fatto oggi
        </span>
      ) : (
        <span className="no">Lo faccio oggi</span>
      )}
    </button>
  );
}
