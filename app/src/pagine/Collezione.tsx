import { Link, useLocation, useNavigate, useSearchParams, useViewTransitionState } from "react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Profumo } from "../tipi";
import { useDati } from "../dati";
import { COLORI, FAMIGLIE, adesso, eCampione, eNovita, immagineAssoluta, migliaia, nr, voto, type Vetrina } from "../profumo";
import { ETICHETTE_FILTRO, FILTRI_VALIDI, GRUPPI_FILTRO, ORDINAMENTI, ORDINE_DI_PARTENZA, quantiCon, selezione, type Scelte } from "../viste/filtri";
import { Boccetta, Mini, useMenoMovimento, useTitolo } from "../componenti/comuni";
import { useAvviso } from "../componenti/Avvisi";
import { IconaCerca, IconaX } from "../componenti/Icone";
import { useMeteo } from "../meteo-contesto";

/* La collezione: due vetrine (boccette e campioni), la ricerca, le scelte rapide, il cassetto dei filtri con gli
   ordinamenti e le mensole. Tutto vive nell'indirizzo (#/?v=campioni&f=verde,ufficio&n=vetiver&o=rating&q=…):
   «indietro» lo ritrova, una nuova apertura riparte pulita. Le regole sono in src/viste/filtri.ts, verificate con
   strumenti/verifica-filtri.mjs. #/?vedi=24 arriva da un'altra pagina: si scorre fino alla teca (chiusa) e la si
   illumina. «Confronta» sceglie fino a tre teche (?scegli=1&sel=3,24). */

// le boccette scendono sulla mensola solo la prima volta che si apre la vetrina
let giaPosate = false;
const lista = (x: string | null) => (x ? x.split(",").filter(Boolean) : []);
const RAPIDI: [string, string][] = [
  ["adesso", "Adesso"], ["ufficio", "Ufficio"], ["appuntamento", "Appuntamento"], ["sera", "Sera"], ["dupe", "Cloni"], ["recenti", "Novità"]
];
const INCLINAZIONE = 16; // gradi ai bordi della nicchia

export default function Collezione() {
  const { dati, numeri, perId, carica, errore, riprova } = useDati();
  const [par, setPar] = useSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  const vetrina: Vetrina = par.get("v") === "campioni" ? "campioni" : "boccette";
  const filtri = useMemo(() => new Set(lista(par.get("f")).filter((f) => FILTRI_VALIDI.has(f))), [par]);
  const note = useMemo(() => new Set(lista(par.get("n")).map((x) => x.toLowerCase())), [par]);
  const cerca = par.get("q") ?? "";
  const ordine = ORDINAMENTI.some((o) => o.k === par.get("o")) ? par.get("o")! : ORDINE_DI_PARTENZA;
  const cassetto = par.get("cassetto") === "1";
  const vedi = Number(par.get("vedi")) || null;
  const riduci = useMenoMovimento();
  const [illuminata, setIlluminata] = useState<number | null>(null);
  const prima = useRef(!giaPosate);
  useEffect(() => {
    giaPosate = true;
  }, []);
  useTitolo("Sillage · Collezione");

  /** Cambia i parametri dell'indirizzo senza aggiungere passi alla cronologia e senza scorrere. */
  const imposta = (cambi: Record<string, string | null>) => {
    const n = new URLSearchParams(par);
    for (const [k, v] of Object.entries(cambi)) {
      if (v == null || v === "") n.delete(k);
      else n.set(k, v);
    }
    setPar(n, { replace: true, preventScrollReset: true });
  };
  const commuta = (f: string) => {
    const s = new Set(filtri);
    if (s.has(f)) s.delete(f);
    else s.add(f);
    imposta({ f: [...s].join(",") || null });
  };
  const commutaNota = (n: string) => {
    const s = new Set(note);
    if (s.has(n)) s.delete(n);
    else s.add(n);
    imposta({ n: [...s].join(",") || null });
  };
  const azzera = () => imposta({ f: null, n: null, q: null });
  // il cassetto si apre con un passo nella cronologia: «indietro» lo chiude
  const apriCassetto = () => {
    const n = new URLSearchParams(par);
    n.set("cassetto", "1");
    setPar(n, { preventScrollReset: true });
  };
  const chiudiCassetto = () => (loc.key !== "default" ? navigate(-1) : imposta({ cassetto: null }));
  /* Le scelte fatte nel cassetto cambiano l'indirizzo sul posto; chiudendolo con «indietro» si tornerebbe a
     quello di prima dell'apertura. Si ricordano finché è aperto e, chiuso, si rimettono nell'indirizzo. */
  const sceltaNelCassetto = useRef<string | null>(null);
  useEffect(() => {
    if (cassetto) {
      const n = new URLSearchParams(par);
      n.delete("cassetto");
      sceltaNelCassetto.current = n.toString();
      return;
    }
    const s = sceltaNelCassetto.current;
    sceltaNelCassetto.current = null;
    if (s != null && s !== par.toString()) setPar(new URLSearchParams(s), { replace: true, preventScrollReset: true });
  }, [cassetto, par, setPar]);

  // la scelta per il confronto
  const scegli = par.get("scegli") === "1";
  const sel = lista(par.get("sel")).map(Number).filter((x) => x > 0).slice(0, 3);
  const avvisa = useAvviso();
  const scegliTeca = (id: number) => {
    if (sel.includes(id)) imposta({ sel: sel.filter((x) => x !== id).join(",") || null });
    else if (sel.length >= 3) avvisa("Al massimo tre profumi: togline uno dal vassoio.");
    else imposta({ sel: [...sel, id].join(",") });
  };

  const profumi = dati?.profumi ?? [];
  const { meteo, ora: orologio } = useMeteo();
  const momento = useMemo(() => adesso(new Date(orologio), meteo), [orologio, meteo]);
  const scelte: Scelte = { filtri, note, cerca };
  const r = useMemo(() => selezione(profumi, vetrina, { filtri, note, cerca }, ordine, momento), [profumi, vetrina, filtri, note, cerca, ordine, momento]);
  const quanti = (f?: string, n?: string) => quantiCon(profumi, vetrina, scelte, momento, f, n);
  const nVetrine = useMemo(() => ({ boccette: profumi.filter((p) => !eCampione(p)).length, campioni: profumi.filter(eCampione).length }), [profumi]);
  const ciSonoNovita = profumi.some((p) => eNovita(p));
  const famiglieAttive = COLORI.filter((c) => filtri.has(c));

  /* Arrivo da un'altra pagina, in due tempi: prima l'indirizzo si pulisce (vetrina giusta, filtri tolti), poi,
     quando la teca è davvero sulla mensola, si scorre fino a lei e si illumina. */
  const daVedere = useRef<number | null>(null);
  useEffect(() => {
    if (!vedi || !perId.size) return;
    const p = perId.get(vedi);
    daVedere.current = p ? p.id : null;
    const n = new URLSearchParams();
    if (p && eCampione(p)) n.set("v", "campioni");
    setPar(n, { replace: true, preventScrollReset: true });
  }, [vedi, perId, setPar]);
  const chiaveVista = `${vetrina}|${[...filtri]}|${[...note]}|${cerca}|${r.lista.length}|${vedi}`;
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

  /* La luce sul vetro: col mouse la nicchia si inclina verso il puntatore e un riflesso la segue. Un solo
     ascoltatore per la pagina; il dito non inclina niente (lo scorrimento resta suo), ma toccando una teca
     un riflesso attraversa il vetro una volta. */
  useEffect(() => {
    if (riduci) return;
    let inclinata: HTMLElement | null = null;
    const raddrizza = (n: HTMLElement) => {
      n.classList.remove("inclinata");
      n.style.removeProperty("--rx");
      n.style.removeProperty("--ry");
    };
    const muovi = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const n = (e.target as HTMLElement).closest?.(".scaffale .nicchia") as HTMLElement | null;
      if (n !== inclinata) {
        if (inclinata) raddrizza(inclinata);
        inclinata = n;
      }
      if (!n) return;
      const b = n.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
        py = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
      n.classList.add("inclinata");
      n.style.setProperty("--ry", ((px - 0.5) * INCLINAZIONE).toFixed(2) + "deg");
      n.style.setProperty("--rx", ((0.5 - py) * INCLINAZIONE).toFixed(2) + "deg");
      n.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
      n.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    };
    const via = () => {
      if (inclinata) raddrizza(inclinata);
      inclinata = null;
    };
    const tocco = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const v = (e.target as HTMLElement).closest?.(".scaffale .voce")?.querySelector(".riflesso");
      if (!v) return;
      v.classList.remove("passa");
      void (v as HTMLElement).offsetWidth;
      v.classList.add("passa");
    };
    document.addEventListener("pointermove", muovi, { passive: true });
    document.addEventListener("pointerleave", via);
    document.addEventListener("pointerdown", tocco, { passive: true });
    return () => {
      document.removeEventListener("pointermove", muovi);
      document.removeEventListener("pointerleave", via);
      document.removeEventListener("pointerdown", tocco);
    };
  }, [riduci]);

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
              Non riesco a leggere la collezione: {errore ?? "nessuna risposta"}. Senza rete serve almeno un'apertura con la rete, perché il
              telefono ne tenga una copia.
            </p>
            <button type="button" className="btn-filo" onClick={riprova}>
              Riprova
            </button>
          </>
        )}
      </section>
    );
  }

  const nAttivi = filtri.size + note.size;
  const filtrata = !!(nAttivi || cerca.trim());
  const teca = (p: Profumo, i: number) => (
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
  );
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
              // le scelte rapide cambiano con la vetrina, come nell'app di oggi
              onClick={() => v !== vetrina && imposta({ v: v === "campioni" ? "campioni" : null, f: null, n: null, scegli: null, sel: null })}
            >
              {v === "boccette" ? "Boccette" : "Campioni"} <small>{nVetrine[v]}</small>
            </button>
          ))}
        </div>

        <label className="cerca">
          <IconaCerca />
          <span className="vh">Cerca nella collezione</span>
          <input type="search" placeholder="Nome, marca o nota" autoComplete="off" enterKeyHint="search" value={cerca} onChange={(e) => imposta({ q: e.target.value })} />
          {cerca ? (
            <button type="button" className="cerca-via" aria-label="Svuota la ricerca" onClick={() => imposta({ q: null })}>
              <IconaX />
            </button>
          ) : null}
        </label>

        <div className="filtri" role="group" aria-label="Scelte rapide">
          <button type="button" className={"chip chip-cassetto" + (nAttivi ? " acceso" : "")} onClick={apriCassetto} aria-haspopup="dialog">
            Filtri{nAttivi ? <small>{nAttivi}</small> : null}
          </button>
          <button type="button" className="chip" aria-pressed={!famiglieAttive.length} onClick={() => imposta({ f: [...filtri].filter((f) => !COLORI.includes(f as never)).join(",") || null })}>
            Tutte
          </button>
          {COLORI.map((c) => {
            const on = filtri.has(c),
              n = quanti(c);
            return (
              <button key={c} type="button" className={"chip chip-" + c + (!on && !n ? " zero" : "")} aria-pressed={on} title={FAMIGLIE[c].lunga} onClick={() => commuta(c)}>
                <i className="gemma" aria-hidden="true" />
                {FAMIGLIE[c].breve} <small>{n}</small>
              </button>
            );
          })}
          {RAPIDI.filter(([k]) => k !== "recenti" || ciSonoNovita).map(([k, l]) => {
            const on = filtri.has(k),
              n = quanti(k);
            return (
              <button
                key={k}
                type="button"
                className={"chip chip-rapido" + (!on && !n ? " zero" : "")}
                aria-pressed={on}
                title={k === "adesso" ? `Adatti a ${momento.nome}, ${momento.momento === "sera" ? "di sera" : "di giorno"}` : ETICHETTE_FILTRO[k]}
                onClick={() => commuta(k)}
              >
                {k === "adesso" ? `Adesso · ${momento.nome}, ${momento.momento}${momento.meteo ? ` · ${momento.meteo.temperatura}°` : ""}` : l} <small>{n}</small>
              </button>
            );
          })}
        </div>

        {nAttivi ? (
          <div className="attivi" aria-label="Filtri attivi">
            {[...filtri].map((f) => (
              <button key={f} type="button" className="tolgo" onClick={() => commuta(f)}>
                {ETICHETTE_FILTRO[f] || f}
                <IconaX />
              </button>
            ))}
            {[...note].map((n) => (
              <button key={"n" + n} type="button" className="tolgo nota" onClick={() => commutaNota(n)}>
                {n}
                <IconaX />
              </button>
            ))}
            <button type="button" className="collegamento" onClick={azzera}>
              Azzera tutto
            </button>
          </div>
        ) : null}
      </header>

      <div className="registro">
        <span>
          {r.lista.length === r.tot ? `In vetrina · ${r.lista.length}` : `${r.lista.length} di ${r.tot}`}
          {" · "}
          {ORDINAMENTI.find((o) => o.k === ordine)!.lbl.toLowerCase()}
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

      {r.lista.length ? (
        <div className={"scaffale" + (prima.current && !riduci ? " prima-volta" : "")}>{r.lista.map(teca)}</div>
      ) : (
        <div className="vuoto">
          <p className="testo">
            {vetrina === "campioni" ? "Nessun campione" : "Nessuna boccetta"} con questi filtri{cerca ? ` per «${cerca}»` : ""}.
            {r.extra.length ? " Ma qualcosa c'è tra i campioni, qui sotto." : " Togli un filtro per allargare la ricerca."}
          </p>
          {filtrata ? (
            <button type="button" className="btn-filo" onClick={azzera}>
              Togli i filtri
            </button>
          ) : null}
        </div>
      )}
      {r.extra.length ? (
        <>
          <p className="divisorio incisa tra-campioni">Anche tra i campioni · {r.extra.length}</p>
          <div className="scaffale">{r.extra.map((p, i) => teca(p, r.lista.length + i))}</div>
        </>
      ) : null}

      {cassetto ? (
        <Cassetto
          profumi={profumi}
          vetrina={vetrina}
          scelte={scelte}
          momento={momento}
          ordine={ordine}
          noteChips={dati.note}
          commuta={commuta}
          commutaNota={commutaNota}
          ordina={(o) => imposta({ o: o === ORDINE_DI_PARTENZA ? null : o })}
          azzera={azzera}
          chiudi={chiudiCassetto}
          nMostra={r.lista.length}
          tot={r.tot}
        />
      ) : null}

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

/* Il cassetto dei filtri (gruppiFiltro e costruisciFoglio nell'app di oggi): stagione, occasione, famiglia, momento,
   provenienza, le note olfattive e l'ordine. Ogni scelta dice quante ne resterebbero. */
function Cassetto({
  profumi,
  vetrina,
  scelte,
  momento,
  ordine,
  noteChips,
  commuta,
  commutaNota,
  ordina,
  azzera,
  chiudi,
  nMostra,
  tot
}: {
  profumi: Profumo[];
  vetrina: Vetrina;
  scelte: Scelte;
  momento: ReturnType<typeof adesso>;
  ordine: string;
  noteChips: string[];
  commuta: (f: string) => void;
  commutaNota: (n: string) => void;
  ordina: (o: string) => void;
  azzera: () => void;
  chiudi: () => void;
  nMostra: number;
  tot: number;
}) {
  const [tutteLeNote, setTutteLeNote] = useState(false);
  const pannello = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pannello.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && chiudi();
    document.addEventListener("keydown", esc);
    document.documentElement.classList.add("senza-scorrimento");
    return () => {
      document.removeEventListener("keydown", esc);
      document.documentElement.classList.remove("senza-scorrimento");
    };
  }, [chiudi]);
  const nAttivi = scelte.filtri.size + scelte.note.size;
  const voce = (k: string, l: string, on: boolean, n: number, fai: () => void) => (
    <button key={k} type="button" className={"chip" + (!on && !n ? " zero" : "")} aria-pressed={on} onClick={fai}>
      {l} <small>{n}</small>
    </button>
  );
  return (
    <div className="fondale" onClick={(e) => e.target === e.currentTarget && chiudi()}>
      <div className="cassetto" role="dialog" aria-modal="true" aria-labelledby="t-cassetto" tabIndex={-1} ref={pannello}>
        <header className="cassetto-testa">
          <div>
            <p className="incisa">Filtri e ordine</p>
            <h2 id="t-cassetto">{nAttivi === 0 ? "Tutta la collezione" : `${nMostra} di ${tot} ${vetrina === "campioni" ? "campioni" : "boccette"}`}</h2>
          </div>
          <button type="button" className="cf-x" onClick={chiudi} aria-label="Chiudi">
            <IconaX />
          </button>
        </header>
        <div className="cassetto-corpo">
          {GRUPPI_FILTRO.map((g) => (
            <section key={g.t} className="cassetto-gruppo">
              <p className="incisa">{g.t}</p>
              <div className="chips">{g.v.map(([k, l]) => voce(k, l, scelte.filtri.has(k), quantiCon(profumi, vetrina, scelte, momento, k), () => commuta(k)))}</div>
            </section>
          ))}
          <section className="cassetto-gruppo">
            <p className="incisa">Note olfattive</p>
            <div className="chips">
              {noteChips
                .filter((_, i) => tutteLeNote || i < 16)
                .map((n) => voce("n" + n, n.charAt(0).toUpperCase() + n.slice(1), scelte.note.has(n), quantiCon(profumi, vetrina, scelte, momento, undefined, n), () => commutaNota(n)))}
            </div>
            {noteChips.length > 16 ? (
              <button type="button" className="collegamento" onClick={() => setTutteLeNote(!tutteLeNote)}>
                {tutteLeNote ? "Mostra meno note" : `Mostra tutte le ${noteChips.length} note`}
              </button>
            ) : null}
          </section>
          <section className="cassetto-gruppo">
            <p className="incisa">Ordina per</p>
            <div className="chips">
              {ORDINAMENTI.map((o) => (
                <button key={o.k} type="button" className="chip" aria-pressed={o.k === ordine} onClick={() => ordina(o.k)}>
                  {o.lbl}
                </button>
              ))}
            </div>
          </section>
        </div>
        <footer className="cassetto-piede">
          <button type="button" className="btn-filo" onClick={azzera} disabled={!nAttivi}>
            Azzera
          </button>
          <button type="button" className="btn-filo pieno" onClick={chiudi}>
            {nMostra === tot ? "Mostra la collezione" : `Mostra ${nMostra} ${nMostra === 1 ? (vetrina === "campioni" ? "campione" : "boccetta") : vetrina === "campioni" ? "campioni" : "boccette"}`}
          </button>
        </footer>
      </div>
    </div>
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
        <span className="vetro" style={{ "--maschera": `url("${immagineAssoluta(p)}")` } as CSSProperties}>
          <Boccetta p={p} pigra={i > 5} nomeVolo={inVolo ? "boccetta-" + p.id : undefined} />
          <span className="bagliore" aria-hidden="true" />
          <span className="riflesso" aria-hidden="true" />
        </span>
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
