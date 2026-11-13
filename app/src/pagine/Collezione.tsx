import { Link, useSearchParams, useViewTransitionState } from "react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Colore, Profumo } from "../tipi";
import { useDati } from "../dati";
import {
  COLORI,
  FAMIGLIE,
  adesso,
  corrisponde,
  eCampione,
  eColore,
  eNovita,
  migliaia,
  nr,
  vaBeneAdesso,
  vetrinaDi,
  voto,
  type Vetrina
} from "../profumo";
import { Boccetta, Mini, useMenoMovimento, useTitolo } from "../componenti/comuni";
import { useAvviso } from "../componenti/Avvisi";
import { IconaCerca, IconaX } from "../componenti/Icone";
import { useMeteo } from "../meteo-contesto";

/* La collezione: due vetrine (boccette e campioni), la ricerca, i filtri rapidi e le mensole.
   I filtri vivono nell'indirizzo (#/?v=campioni&f=verde&ora=1&q=vetiver): «indietro» li ritrova,
   una nuova apertura riparte pulita. #/?vedi=24 arriva da un'altra pagina: si scorre fino alla teca
   (chiusa) e la si illumina. */

// le boccette scendono sulla mensola solo la prima volta che si apre la vetrina
let giaPosate = false;

export default function Collezione() {
  const { dati, numeri, perId, carica, errore, riprova } = useDati();
  const [par, setPar] = useSearchParams();
  const vetrina: Vetrina = par.get("v") === "campioni" ? "campioni" : "boccette";
  const famiglia = eColore(par.get("f")) ? (par.get("f") as Colore) : null;
  const ora = par.get("ora") === "1";
  const cerca = par.get("q") ?? "";
  const vedi = Number(par.get("vedi")) || null;
  const riduci = useMenoMovimento();
  const [illuminata, setIlluminata] = useState<number | null>(null);
  const prima = useRef(!giaPosate);
  useEffect(() => {
    giaPosate = true;
  }, []);
  useTitolo("Sillage · Collezione");

  // la scelta per il confronto: anche lei nell'indirizzo, niente memoria tra un'apertura e l'altra
  const scegli = par.get("scegli") === "1";
  const sel = (par.get("sel") || "")
    .split(",")
    .map(Number)
    .filter((x) => x > 0)
    .slice(0, 3);
  const avvisa = useAvviso();
  const scegliTeca = (id: number) => {
    if (sel.includes(id)) imposta({ sel: sel.filter((x) => x !== id).join(",") || null });
    else if (sel.length >= 3) avvisa("Al massimo tre profumi: togline uno dal vassoio.");
    else imposta({ sel: [...sel, id].join(",") });
  };

  /** Cambia i parametri dell'indirizzo senza aggiungere passi alla cronologia e senza scorrere. */
  const imposta = (cambi: Record<string, string | null>) => {
    const n = new URLSearchParams(par);
    for (const [k, v] of Object.entries(cambi)) {
      if (v == null || v === "") n.delete(k);
      else n.set(k, v);
    }
    setPar(n, { replace: true, preventScrollReset: true });
  };

  const profumi = dati?.profumi ?? [];
  const { meteo, ora: orologio } = useMeteo();
  const momento = useMemo(() => adesso(new Date(orologio), meteo), [orologio, meteo]);
  const inVetrina = useMemo(() => profumi.filter((p) => vetrinaDi(p) === vetrina), [profumi, vetrina]);
  const quanti = useMemo(
    () => ({ boccette: profumi.filter((p) => !eCampione(p)).length, campioni: profumi.filter(eCampione).length }),
    [profumi]
  );
  // conta per famiglia con tutti gli altri filtri già applicati: il numero dice cosa si vedrà
  const primaDellaFamiglia = inVetrina.filter((p) => corrisponde(p, cerca) && (!ora || vaBeneAdesso(p, momento)));
  const visibili = primaDellaFamiglia
    .filter((p) => !famiglia || p.colore === famiglia)
    .sort((a, b) => (numeri.get(a.id) ?? a.id) - (numeri.get(b.id) ?? b.id));

  /* Arrivo da un'altra pagina, in due tempi: prima l'indirizzo si pulisce (vetrina giusta,
     filtri tolti), poi, quando la teca è davvero sulla mensola, si scorre fino a lei e si illumina. */
  const daVedere = useRef<number | null>(null);
  useEffect(() => {
    if (!vedi || !perId.size) return;
    const p = perId.get(vedi);
    daVedere.current = p ? p.id : null;
    const n = new URLSearchParams();
    if (p && eCampione(p)) n.set("v", "campioni");
    setPar(n, { replace: true, preventScrollReset: true });
  }, [vedi, perId, setPar]);
  const chiaveVista = `${vetrina}|${famiglia}|${ora}|${cerca}|${visibili.length}|${vedi}`;
  useEffect(() => {
    const id = daVedere.current;
    if (vedi || id == null) return;
    const el = document.getElementById("teca-" + id);
    if (!el) return;
    daVedere.current = null;
    setIlluminata(id);
    requestAnimationFrame(() => el.scrollIntoView({ block: "center", behavior: riduci ? "auto" : "smooth" }));
  }, [chiaveVista, vedi, riduci]);
  useEffect(() => {
    if (illuminata == null) return;
    const t = setTimeout(() => setIlluminata(null), 2800);
    return () => clearTimeout(t);
  }, [illuminata]);

  if (!dati) {
    return (
      <section className="attesa">
        <p className="incisa">Collezione privata</p>
        <h1 className="marchio">Sillage</h1>
        <div className="filo-ottone" />
        {carica ? (
          <p className="testo">Apro la vetrina…</p>
        ) : (
          <>
            <p className="testo">
              Non riesco a leggere la collezione: {errore ?? "nessuna risposta"}. Senza rete serve almeno un'apertura con la
              rete, perché il telefono ne tenga una copia.
            </p>
            <button type="button" className="btn-filo" onClick={riprova}>
              Riprova
            </button>
          </>
        )}
      </section>
    );
  }

  const filtrata = !!(famiglia || ora || cerca);
  return (
    <section className="collezione">
      <header className="maison">
        <div className="riga">
          <div>
            <p className="incisa">Collezione privata</p>
            <h1 className="marchio">Sillage</h1>
          </div>
          <p className="conta">
            <b>{profumi.length}</b>fragranze
          </p>
        </div>
        <div className="filo-ottone" />

        <div className="vetrine" role="group" aria-label="Vetrina">
          {(["boccette", "campioni"] as Vetrina[]).map((v) => (
            <button
              key={v}
              type="button"
              className="vetrina-bottone"
              aria-pressed={vetrina === v}
              onClick={() => imposta({ v: v === "campioni" ? "campioni" : null, f: null })}
            >
              {v === "boccette" ? "Boccette" : "Campioni"} <small>{quanti[v]}</small>
            </button>
          ))}
        </div>

        <label className="cerca">
          <IconaCerca />
          <span className="vh">Cerca nella collezione</span>
          <input
            type="search"
            placeholder="Nome, marca o nota"
            autoComplete="off"
            enterKeyHint="search"
            value={cerca}
            onChange={(e) => imposta({ q: e.target.value })}
          />
          {cerca ? (
            <button type="button" className="cerca-via" aria-label="Svuota la ricerca" onClick={() => imposta({ q: null })}>
              <IconaX />
            </button>
          ) : null}
        </label>

        <div className="filtri" role="group" aria-label="Filtri rapidi">
          <button type="button" className="chip" aria-pressed={!famiglia} onClick={() => imposta({ f: null })}>
            Tutte <small>{primaDellaFamiglia.length}</small>
          </button>
          {COLORI.map((c) => {
            const n = primaDellaFamiglia.filter((p) => p.colore === c).length;
            return (
              <button
                key={c}
                type="button"
                className={"chip chip-" + c}
                aria-pressed={famiglia === c}
                title={FAMIGLIE[c].lunga}
                onClick={() => imposta({ f: famiglia === c ? null : c })}
              >
                <i className="gemma" aria-hidden="true" />
                {FAMIGLIE[c].breve} <small>{n}</small>
              </button>
            );
          })}
          <button
            type="button"
            className="chip chip-adesso"
            aria-pressed={ora}
            title={`Adatti a ${momento.nome}, ${momento.momento === "sera" ? "di sera" : "di giorno"}`}
            onClick={() => imposta({ ora: ora ? null : "1" })}
          >
            Adesso
          </button>
        </div>
      </header>

      <div className="registro">
        <span>
          {visibili.length === inVetrina.length
            ? `In vetrina · ${visibili.length}`
            : `${visibili.length} di ${inVetrina.length}`}
          {ora ? ` · ${momento.nome}, ${momento.momento === "sera" ? "sera" : "giorno"}` : ""}
        </span>
        <span>
          {scegli ? (
            "tocca fino a tre teche"
          ) : (
            <button type="button" className="collegamento" onClick={() => imposta({ scegli: "1" })}>
              Confronta
            </button>
          )}
        </span>
      </div>

      {visibili.length ? (
        <div className={"scaffale" + (prima.current && !riduci ? " prima-volta" : "")}>
          {visibili.map((p, i) => (
            <Teca
              key={p.id}
              p={p}
              n={numeri.get(p.id) ?? p.id}
              i={i}
              illuminata={illuminata === p.id}
              riduci={riduci}
              scelta={scegli ? sel.includes(p.id) : undefined}
              onScegli={scegli ? () => scegliTeca(p.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="vuoto">
          <p className="testo">Nessuna fragranza corrisponde{cerca ? ` a «${cerca}»` : ""}.</p>
          {filtrata ? (
            <button type="button" className="btn-filo" onClick={() => imposta({ f: null, ora: null, q: null })}>
              Togli i filtri
            </button>
          ) : null}
        </div>
      )}
      {scegli ? (
        <div className="vassoio" role="region" aria-label="Da confrontare">
          <span className="vassoio-caselle">
            {[0, 1, 2].map((k) => (
              <Mini key={k} p={sel[k] ? perId.get(sel[k]) : null} classe={sel[k] ? "" : "vuota"} />
            ))}
          </span>
          <span className="vassoio-conto">{sel.length} / 3</span>
          <button type="button" className="collegamento" onClick={() => imposta({ scegli: null, sel: null })}>
            Annulla
          </button>
          {sel.length >= 2 ? (
            <Link className="btn-filo pieno" to={`/confronta?ids=${sel.join(",")}`}>
              Confronta
            </Link>
          ) : (
            <span className="btn-filo spento" aria-disabled="true">
              Confronta
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Teca({
  p,
  n,
  i,
  illuminata,
  riduci,
  scelta,
  onScegli
}: {
  p: Profumo;
  n: number;
  i: number;
  illuminata: boolean;
  riduci: boolean;
  /** in modalità confronto: se è nel vassoio */
  scelta?: boolean;
  onScegli?: () => void;
}) {
  const verso = `/profumo/${p.id}`;
  // durante il volo verso la scheda (e al ritorno) la boccetta porta il nome della transizione
  const inVolo = useViewTransitionState(verso);
  return (
    <Link
      to={verso}
      viewTransition={!riduci}
      state={{ volo: !riduci, da: "collezione" }}
      id={"teca-" + p.id}
      className={`voce ${p.colore}${illuminata ? " ancorata" : ""}${scelta ? " nel-vassoio" : ""}`}
      aria-pressed={onScegli ? !!scelta : undefined}
      onClick={
        onScegli
          ? (e) => {
              e.preventDefault();
              onScegli();
            }
          : undefined
      }
      style={{ "--i": Math.min(i, 9) } as CSSProperties}
    >
      <div className="nicchia">
        <Boccetta p={p} pigra={i > 5} nomeVolo={inVolo ? "boccetta-" + p.id : undefined} />
      </div>
      <div className="mensola" />
      <div className="cartellino">
        <p className="c-nr">
          <i aria-hidden="true" />
          {nr(n)}
          {eNovita(p) ? <span className="novita">Nuovo</span> : null}
        </p>
        <p className="marca">{p.brand}</p>
        <h2 className="nome">{p.name}</h2>
        <p className="dati">
          {p.conc} · {p.famiglia}
        </p>
        {p.rating ? (
          <p className="voto">
            <b>{voto(p.rating)}</b>
            {p.voti ? ` · ${migliaia(p.voti)} voti` : ""}
          </p>
        ) : (
          <p className="voto">senza voto</p>
        )}
      </div>
    </Link>
  );
}
