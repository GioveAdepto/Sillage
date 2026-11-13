import { Link, useSearchParams } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Profumo } from "../tipi";
import { useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { useDiario, useSegna } from "../diario/uso";
import { MAX_GIORNO, oggiISO, ruoloStrato, type Voce } from "../diario/coda";
import { NOME_OCC, SceltaUso, LoMetto, testoUso } from "../diario/pezzi";
import { OCCASIONI, ORA_PER_OCCASIONE, candidati, maiuscola, type Candidato, type Occasione } from "../consiglio";
import { finestraMeteo, piovosa, type Finestra } from "../meteo";
import { eCampione } from "../profumo";
import { Boccetta, useTitolo } from "../componenti/comuni";
import { useAvviso } from "../componenti/Avvisi";
import { diario as negozio } from "../ponte";
import { IconaAvanti, IconaIndietro, IconaX } from "../componenti/Icone";

/* Il diario: il mese con quello che hai indossato, il giorno scelto (anche a posteriori), la cronologia,
   e la settimana con un suggerimento al giorno. Le scelte stanno nell'indirizzo
   (#/diario?vista=settimana, ?mese=2026-11&giorno=2026-11-12): nessuna memoria tra un'apertura e l'altra.
   Le voci passano dalla stessa coda di «Lo metto oggi» (src/diario/coda.ts). */

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIUDIZI = ["Com'è andata?", "Male", "Così così", "Bene", "Molto bene", "Perfetto"];
const dataDa = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const dataLunga = (iso: string) => maiuscola(dataDa(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));

function Mini({ p, classe = "" }: { p?: Profumo; classe?: string }) {
  return <span className={"mini " + classe}>{p ? <Boccetta p={p} className="" /> : null}</span>;
}

export default function Diario() {
  const { dati, perId, statoChiave } = useDati();
  const { diario, versione } = useDiario();
  const [par, setPar] = useSearchParams();
  useTitolo("Diario · Sillage");
  const oggi = oggiISO();
  const vista = par.get("vista") === "settimana" ? "settimana" : "mese";
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(par.get("giorno") || "") && par.get("giorno")! <= oggi ? par.get("giorno")! : oggi;
  const mese = /^\d{4}-\d{2}$/.test(par.get("mese") || "") && par.get("mese")! <= oggi.slice(0, 7) ? par.get("mese")! : giorno.slice(0, 7);
  const imposta = (cambi: Record<string, string | null>, scorri = false) => {
    const n = new URLSearchParams(par);
    for (const [k, v] of Object.entries(cambi)) {
      if (v == null) n.delete(k);
      else n.set(k, v);
    }
    setPar(n, { replace: true, preventScrollReset: !scorri });
  };

  // le voci per giorno, solo dei profumi in collezione
  const perGiorno = useMemo(() => {
    const m = new Map<string, Voce[]>();
    diario
      .voci()
      .filter((v) => perId.has(+v.id))
      .sort((a, b) => +a.t - +b.t)
      .forEach((v) => {
        if (!m.has(v.data)) m.set(v.data, []);
        m.get(v.data)!.push(v);
      });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versione, perId]);

  if (!dati)
    return (
      <section className="segnaposto">
        <p className="incisa">Diario</p>
        <h1 className="titolo-pagina">Un momento…</h1>
      </section>
    );

  const inCoda = diario.coda().length;
  return (
    <section className="diario">
      <header className="diario-testa">
        <p className="incisa">Diario</p>
        <h1 className="titolo-pagina">Cosa hai indossato</h1>
        <div className="filo-ottone" />
      </header>

      {statoChiave !== "giusta" ? (
        <div className="diario-chiave">
          {statoChiave === "assente" ? (
            <p>
              Il diario è protetto dalla chiave di Sillage: senza, non si può leggere. Inseriscila una volta in{" "}
              <Link className="collegamento" to="/impostazioni">
                Impostazioni
              </Link>
              : resta solo su questo telefono. Finché manca, quello che segni resta qui e parte appena c'è la chiave.
            </p>
          ) : statoChiave === "sbagliata" ? (
            <p>
              La chiave salvata non è quella giusta, e il diario non si può leggere. Correggila in{" "}
              <Link className="collegamento" to="/impostazioni">
                Impostazioni
              </Link>
              ; intanto quello che segni resta su questo telefono.
            </p>
          ) : (
            <p>Il database ora non risponde: vedi l'ultima copia del diario. Quello che segni parte appena torna la rete.</p>
          )}
        </div>
      ) : null}
      {inCoda ? (
        <p className="diario-attesa">
          {inCoda} {inCoda === 1 ? "scrittura aspetta" : "scritture aspettano"} di partire per il database.
        </p>
      ) : null}

      <div className="vetrine diario-viste" role="group" aria-label="Vista">
        {(
          [
            ["mese", "Il mese"],
            ["settimana", "La settimana"]
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className="vetrina-bottone" aria-pressed={vista === k} onClick={() => imposta({ vista: k === "mese" ? null : k })}>
            {l}
          </button>
        ))}
      </div>

      {vista === "settimana" ? (
        <Settimana perGiorno={perGiorno} />
      ) : (
        <div className="diario-griglia">
          <Calendario mese={mese} giorno={giorno} oggi={oggi} perGiorno={perGiorno} imposta={imposta} />
          <Giorno key={giorno} giorno={giorno} oggi={oggi} perGiorno={perGiorno} appunto={par.get("appunto")} chiudiAppunto={() => imposta({ appunto: null })} />
          <Cronologia perGiorno={perGiorno} scegli={(d) => imposta({ giorno: d, mese: d.slice(0, 7), appunto: null }, true)} />
        </div>
      )}
    </section>
  );
}

// ── il mese ──────────────────────────────────────────────────────────────
function Calendario({
  mese,
  giorno,
  oggi,
  perGiorno,
  imposta
}: {
  mese: string;
  giorno: string;
  oggi: string;
  perGiorno: Map<string, Voce[]>;
  imposta: (c: Record<string, string | null>) => void;
}) {
  const { perId } = useDati();
  const { diario } = useDiario();
  const [Y, M] = mese.split("-").map(Number);
  const primo = (new Date(Y, M - 1, 1).getDay() + 6) % 7,
    giorni = new Date(Y, M, 0).getDate();
  const delMese = [...perGiorno.entries()].filter(([d]) => d.startsWith(mese)).flatMap(([, v]) => v);
  const conta = new Map<number, number>();
  delMese.forEach((v) => conta.set(+v.id, (conta.get(+v.id) || 0) + 1));
  const top = [...conta.entries()].sort((a, b) => b[1] - a[1])[0],
    pTop = top && perId.get(top[0]);
  const sposta = (d: number) => {
    const n = new Date(Y, M - 1 + d, 1),
      nuovo = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0");
    if (nuovo <= oggi.slice(0, 7)) imposta({ mese: nuovo });
  };
  return (
    <div className="cal">
      <div className="cal-testa">
        <button type="button" className="cal-freccia" onClick={() => sposta(-1)} aria-label="Mese prima">
          <IconaIndietro />
        </button>
        <h2 className="cal-mese">
          {maiuscola(MESI[M - 1])} <span>{Y}</span>
        </h2>
        <button type="button" className="cal-freccia" onClick={() => sposta(1)} aria-label="Mese dopo" disabled={mese >= oggi.slice(0, 7)}>
          <IconaAvanti />
        </button>
      </div>
      <p className="cal-riassunto">
        <span>
          <b>{delMese.length}</b> {delMese.length === 1 ? "voce" : "voci"}
        </span>
        <span>
          <b>{conta.size}</b> {conta.size === 1 ? "profumo" : "profumi"}
        </span>
        {pTop ? (
          <span>
            il più messo: <b>{pTop.name}</b>
            {top[1] > 1 ? ` · ${top[1]}×` : ""}
          </span>
        ) : null}
      </p>
      <div className="cal-giorni">
        {["lun", "mar", "mer", "gio", "ven", "sab", "dom"].map((x) => (
          <span key={x} className="cal-sett" aria-hidden="true">
            {x}
          </span>
        ))}
        {Array.from({ length: primo }, (_, i) => (
          <span key={"v" + i} />
        ))}
        {Array.from({ length: giorni }, (_, i) => {
          const iso = mese + "-" + String(i + 1).padStart(2, "0"),
            v = perGiorno.get(iso) || [],
            fut = iso > oggi;
          const ps = v.map((x) => perId.get(+x.id)).filter(Boolean) as Profumo[];
          const lay = diario.layeringDel(iso);
          return (
            <button
              key={iso}
              type="button"
              className={"cal-g" + (iso === oggi ? " oggi" : "") + (iso === giorno ? " scelto" : "") + (v.length ? " pieno" : "")}
              disabled={fut}
              aria-pressed={iso === giorno}
              aria-label={dataLunga(iso) + (ps.length ? ": " + ps.map((p) => p.name).join(", ") : "")}
              onClick={() => imposta({ giorno: iso, appunto: null })}
            >
              <span className="cal-n">{i + 1}</span>
              {lay ? (
                <span className="cal-foto coppia">
                  <Mini p={perId.get(lay.sotto)} classe="sotto" />
                  <Mini p={perId.get(lay.sopra)} classe="sopra" />
                </span>
              ) : ps.length ? (
                <span className="cal-foto">
                  <Mini p={ps[0]} />
                  {ps.length > 1 ? <i>+{ps.length - 1}</i> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── il giorno scelto ─────────────────────────────────────────────────────
function Giorno({
  giorno,
  oggi,
  perGiorno,
  appunto,
  chiudiAppunto
}: {
  giorno: string;
  oggi: string;
  perGiorno: Map<string, Voce[]>;
  appunto: string | null;
  chiudiAppunto: () => void;
}) {
  const { perId, dati } = useDati();
  const { diario, ids } = useDiario();
  const segna = useSegna();
  const avvisa = useAvviso();
  const [scelta, setScelta] = useState<false | "uno" | "strati">(false);
  const [cerca, setCerca] = useState("");
  const [strato, setStrato] = useState<{ sotto: number | null; sopra: number | null; slot: "sotto" | "sopra" }>({ sotto: null, sopra: null, slot: "sotto" });
  const v = (perGiorno.get(giorno) || []).map((x) => ({ x, p: perId.get(+x.id)! })).filter((o) => o.p);
  const layG = diario.layeringDel(giorno),
    singoli = v.filter((o) => !ruoloStrato(o.x)),
    pieno = v.length >= MAX_GIORNO;
  const ieri = oggiISO(new Date(Date.now() - 864e5));

  const apri = (modo: "uno" | "strati") => {
    const nuovo = scelta === modo ? false : modo;
    setScelta(nuovo);
    setCerca("");
    if (nuovo === "strati") setStrato({ sotto: v.length === 1 ? +v[0].x.id : null, sopra: null, slot: v.length === 1 ? "sopra" : "sotto" });
  };
  const aggiungi = (id: number) => {
    if (scelta === "strati") {
      const s = { ...strato, [strato.slot]: id };
      if (s.sotto === s.sopra) s[strato.slot === "sotto" ? "sopra" : "sotto"] = null;
      s.slot = s.sotto && !s.sopra ? "sopra" : !s.sotto ? "sotto" : s.slot;
      setStrato(s);
      return;
    }
    if (segna(id, giorno) && diario.vociDelGiorno(giorno, ids).length >= MAX_GIORNO) setScelta(false);
  };
  const confermaStrato = () => {
    const e = diario.segnaLayering(strato.sotto!, strato.sopra!, giorno, undefined, ids, (id) => perId.get(id)?.name ?? "");
    if (!e.ok) avvisa(e.avviso);
    else setScelta(false);
  };
  const gia = new Set(scelta === "strati" ? ([strato.sotto, strato.sopra].filter(Boolean) as number[]) : v.map((o) => +o.x.id));
  const q = cerca.trim().toLowerCase();
  const lista = (dati?.profumi ?? [])
    .filter((p) => !q || (p.name + " " + p.brand).toLowerCase().includes(q))
    .sort((a, b) => Number(eCampione(a)) - Number(eCampione(b)) || a.name.localeCompare(b.name, "it"));
  // le ricette di layering che contengono il profumo già scelto (sommario «№ 3 sotto · № 2 sopra — …»)
  const ricette = (dati?.layering ?? [])
    .map((l) => {
      const [sotto, sopra] = [...String(l.s ?? "").matchAll(/№\s*(\d+)/g)].map((x) => perId.get(+x[1]));
      return { sotto, sopra, nome: String(l.n ?? "") };
    })
    .filter((r) => r.sotto && r.sopra && (!strato.sotto || strato.sopra || r.sotto.id === strato.sotto || r.sopra.id === strato.sotto))
    .slice(0, 12);

  const Togli = ({ p, testo }: { p: Profumo; testo: string }) => (
    <button type="button" className="diario-togli" onClick={() => segna(p.id, giorno)} aria-label={testo}>
      <IconaX />
    </button>
  );
  return (
    <div className="diario-giorno" id="diario-giorno">
      <div className="diario-giorno-t">
        <span className="incisa">{giorno === oggi ? "Oggi" : giorno === ieri ? "Ieri" : "Giorno"}</span>
        <h2>{dataLunga(giorno)}</h2>
      </div>

      {layG ? (
        <div className="diario-blocco">
          <div className="diario-voce">
            <span className="coppia">
              <Mini p={perId.get(layG.sotto)} classe="sotto" />
              <Mini p={perId.get(layG.sopra)} classe="sopra" />
            </span>
            <span className="diario-voce-testo">
              <span className="incisa">Layering</span>
              <Link to={`/?vedi=${layG.sopra}`}>
                <small>sopra</small> {perId.get(layG.sopra)?.name}
              </Link>
              <Link to={`/?vedi=${layG.sotto}`}>
                <small>sotto</small> {perId.get(layG.sotto)?.name}
              </Link>
            </span>
            <Togli p={perId.get(layG.sotto)!} testo="Togli il layering da questo giorno" />
          </div>
          <SceltaUso voci={diario.vociUso(layG.sotto, giorno)} />
        </div>
      ) : null}

      {singoli.map(({ x, p }) => (
        <div className="diario-blocco" key={x.t}>
          <div className="diario-voce">
            <Link className="diario-voce-apri" to={`/?vedi=${p.id}`}>
              <Mini p={p} />
              <span className="diario-voce-testo">
                <b>{p.name}</b>
                <small>{p.brand}</small>
              </span>
            </Link>
            <Togli p={p} testo={`Togli ${p.name} da questo giorno`} />
          </div>
          <SceltaUso voci={[x]} />
          <Appunto v={x} aperto={appunto === String(x.t)} chiudi={chiudiAppunto} />
        </div>
      ))}

      {!v.length ? <p className="diario-vuoto">{giorno === oggi ? "Oggi non hai ancora segnato niente." : "Niente segnato in questo giorno."}</p> : null}

      {pieno && !scelta ? (
        <p className="diario-vuoto">Due profumi al giorno al massimo: per cambiarli, togline uno.</p>
      ) : (
        <div className="diario-pulsanti">
          <button type="button" className="chip" aria-pressed={scelta === "uno"} onClick={() => apri("uno")} disabled={pieno && scelta !== "uno"}>
            {scelta === "uno" ? "Chiudi" : "+ Un profumo"}
          </button>
          <button type="button" className="chip" aria-pressed={scelta === "strati"} onClick={() => apri("strati")} disabled={!!layG || singoli.length > 1}>
            {scelta === "strati" ? "Chiudi" : "+ Un layering"}
          </button>
        </div>
      )}

      {scelta ? (
        <div className="diario-scelta">
          {scelta === "strati" ? (
            <>
              <div className="strato-slot-coppia">
                {(["sotto", "sopra"] as const).map((k) => {
                  const p = strato[k] ? perId.get(strato[k]!) : undefined;
                  return (
                    <button key={k} type="button" className="strato-slot" aria-pressed={strato.slot === k} onClick={() => setStrato({ ...strato, slot: k })}>
                      <Mini p={p} classe={p ? "" : "vuota"} />
                      <span className="diario-voce-testo">
                        <span className="incisa">{k === "sotto" ? "Sotto · il più denso" : "Sopra · il più leggero"}</span>
                        <b>{p ? p.name : "Scegli dall'elenco"}</b>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="strato-inverti"
                  aria-label="Inverti sotto e sopra"
                  disabled={!strato.sotto && !strato.sopra}
                  onClick={() => setStrato({ sotto: strato.sopra, sopra: strato.sotto, slot: strato.slot })}
                >
                  ⇅
                </button>
              </div>
              {ricette.length ? (
                <>
                  <p className="incisa diario-ricette-t">Dalle tue ricette</p>
                  <div className="chips">
                    {ricette.map((r, i) => (
                      <button key={i} type="button" className="chip" onClick={() => setStrato({ sotto: r.sotto!.id, sopra: r.sopra!.id, slot: "sotto" })}>
                        {r.sotto!.name} → {r.sopra!.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          <label className="cerca diario-cerca">
            <span className="vh">Cerca per nome o marca</span>
            <input type="search" placeholder="Cerca per nome o marca…" value={cerca} onChange={(e) => setCerca(e.target.value)} autoComplete="off" autoFocus />
          </label>
          <div className="diario-elenco">
            {lista.length ? (
              lista.map((p) => (
                <button key={p.id} type="button" className="diario-voce scelta-voce" onClick={() => aggiungi(p.id)} disabled={gia.has(p.id)}>
                  <Mini p={p} />
                  <span className="diario-voce-testo">
                    <b>{p.name}</b>
                    <small>
                      {p.brand} · {p.conc}
                      {eCampione(p) ? " · campione" : ""}
                    </small>
                  </span>
                  <span className="diario-azione" aria-hidden="true">
                    {gia.has(p.id) ? "✓" : "+"}
                  </span>
                </button>
              ))
            ) : (
              <p className="diario-vuoto">Nessun profumo con questo nome.</p>
            )}
          </div>
          {scelta === "strati" ? (
            <button type="button" className="btn-filo pieno" onClick={confermaStrato} disabled={!strato.sotto || !strato.sopra}>
              Segna il layering
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A ogni voce si può aggiungere una riga e un voto da 1 a 5: quanto è durato, se ha funzionato.
    Il voto non entra in nessuna classifica: resta un ricordo tuo, mostrato nella scheda. */
function Appunto({ v, aperto, chiudi }: { v: Voce; aperto: boolean; chiudi: () => void }) {
  const [modifica, setModifica] = useState(aperto);
  const [voto, setVoto] = useState(+(v.voto || 0));
  const [testo, setTesto] = useState(v.nota || "");
  const rif = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (aperto) rif.current?.scrollIntoView({ block: "center" });
  }, [aperto]);
  if (!modifica)
    return v.nota || v.voto ? (
      <button type="button" className="appunto" onClick={() => setModifica(true)}>
        {v.voto ? (
          <span className="stelle" aria-label={`${v.voto} su 5`}>
            {"★".repeat(+v.voto)}
          </span>
        ) : null}
        {v.nota ? <span>{v.nota}</span> : null}
      </button>
    ) : (
      <button type="button" className="appunto vuoto" onClick={() => setModifica(true)}>
        + Aggiungi un appunto
      </button>
    );
  const salva = () => {
    negozio.aggiornaVoce(String(v.t), { nota: testo.trim().slice(0, 200), voto: voto || "" });
    setModifica(false);
    chiudi();
  };
  return (
    <div className="appunto-editor" ref={rif}>
      <div className="appunto-stelle" role="radiogroup" aria-label="Voto">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={voto === i} className={i <= voto ? "on" : ""} aria-label={`${i} su 5`} onClick={() => setVoto(voto === i ? 0 : i)}>
            ★
          </button>
        ))}
        <span>{GIUDIZI[voto]}</span>
      </div>
      <label className="cerca">
        <span className="vh">Appunto</span>
        <input maxLength={200} placeholder="Una riga: quanto è durato, se ha funzionato…" value={testo} onChange={(e) => setTesto(e.target.value)} autoFocus={aperto} />
      </label>
      <div className="appunto-azioni">
        <button
          type="button"
          className="btn-filo"
          onClick={() => {
            setModifica(false);
            chiudi();
          }}
        >
          Annulla
        </button>
        <button type="button" className="btn-filo pieno" onClick={salva}>
          Salva
        </button>
      </div>
    </div>
  );
}

// ── la cronologia ────────────────────────────────────────────────────────
function Cronologia({ perGiorno, scegli }: { perGiorno: Map<string, Voce[]>; scegli: (d: string) => void }) {
  const { perId } = useDati();
  const { diario } = useDiario();
  const tutte = [...perGiorno.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .flatMap(([d, vs]) => {
      const lay = diario.layeringDel(d);
      const fuori = vs
        .filter((x) => !ruoloStrato(x))
        .slice()
        .reverse()
        .map((x) => ({ d, x, p: perId.get(+x.id), lay: null as null | { sotto: number; sopra: number } }));
      type Riga = { d: string; x: Voce; p: Profumo | undefined; lay: { sotto: number; sopra: number } | null };
      const testa: Riga[] = lay ? [{ d, x: vs.find(ruoloStrato)!, p: undefined, lay }] : [];
      return testa.concat(fuori);
    })
    .filter((o) => o.p || o.lay);
  let mese = "";
  return (
    <section className="sez cronologia" aria-labelledby="t-cron">
      <div className="sez-testa">
        <h3 id="t-cron">Cronologia</h3>
        <i className="linea" />
      </div>
      {!tutte.length ? (
        <p className="diario-vuoto">
          Ancora nessuna voce. Segna quello che indossi con «Lo metto oggi» nella scheda di un profumo, da Consigliami o qui sopra, scegliendo un
          giorno.
        </p>
      ) : (
        <div className="diario-storia">
          {tutte.slice(0, 90).map(({ d, p, lay, x }) => {
            const [y, m, gg] = d.split("-").map(Number);
            const testa = d.slice(0, 7) !== mese ? ((mese = d.slice(0, 7)), `${maiuscola(MESI[m - 1])} ${y}`) : null;
            const uso = testoUso(x);
            return (
              <div key={String(x.t)}>
                {testa ? <p className="diario-storia-mese">{testa}</p> : null}
                <button type="button" className="diario-riga" onClick={() => scegli(d)}>
                  <span className="diario-data">
                    <b>{gg}</b>
                    <small>{new Date(y, m - 1, gg).toLocaleDateString("it-IT", { weekday: "short" })}</small>
                  </span>
                  {lay ? (
                    <>
                      <span className="coppia">
                        <Mini p={perId.get(lay.sotto)} classe="sotto" />
                        <Mini p={perId.get(lay.sopra)} classe="sopra" />
                      </span>
                      <span className="diario-voce-testo">
                        <b>
                          {perId.get(lay.sotto)?.name} + {perId.get(lay.sopra)?.name}
                        </b>
                        <small>layering{uso ? " · " + uso : ""}</small>
                      </span>
                    </>
                  ) : (
                    <>
                      <Mini p={p} />
                      <span className="diario-voce-testo">
                        <b>{p!.name}</b>
                        <small>
                          {p!.brand}
                          {uso ? " · " + uso : ""}
                        </small>
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {tutte.length > 90 ? <p className="diario-vuoto">Le voci più vecchie restano nel database (e nella copia del foglio, tab Diario).</p> : null}
    </section>
  );
}

// ── la settimana ─────────────────────────────────────────────────────────
/* Un suggerimento al giorno, da lunedì a domenica, con gli stessi criteri di Consigliami. I giorni passati
   mostrano quello che hai messo davvero. Il piano distribuisce: un profumo già proposto o indossato in
   settimana non torna, finché c'è un'alternativa che sta in piedi. Non è il diario che pesa sulla classifica,
   è il piano che evita sette volte lo stesso. Si ricalcola a ogni apertura con l'ultima previsione. */
const NOMI_G = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
function iconaCielo(f: Finestra | null) {
  if (!f) return "";
  const h = f.ore.filter((o) => {
    const x = new Date(o.t).getHours();
    return x >= 8 && x <= 21;
  });
  if (h.some(piovosa)) return h.some((o) => o.c >= 71 && o.c <= 77) ? "❄︎" : "☂︎";
  const c = h.map((o) => o.c).sort((a, b) => a - b)[Math.floor(h.length / 2)] ?? 0;
  return c <= 1 ? "☀︎" : c <= 3 ? "☁︎" : "☁︎";
}
interface GiornoPiano {
  d: Date;
  iso: string;
  eOggi: boolean;
  passato: boolean;
  fine: boolean;
  occ: Occasione;
  indossati: Profumo[];
  cielo: Finestra | null;
  prop: Candidato | null;
  sera: Candidato | null;
  incerto: boolean;
}

function Settimana({ perGiorno }: { perGiorno: Map<string, Voce[]> }) {
  const { dati, perId } = useDati();
  const { meteo, ora } = useMeteo();
  const [occSettimana, setOccSettimana] = useState<Record<string, Occasione>>({}); // solo finché resta aperta
  const [scelto, setScelto] = useState(oggiISO());
  const giorni = useMemo<GiornoPiano[]>(() => {
    const profumi = dati?.profumi ?? [];
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const lun = new Date(oggi);
    lun.setDate(oggi.getDate() - ((oggi.getDay() + 6) % 7));
    const usati = new Set<number>(),
      fuori: GiornoPiano[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lun);
      d.setDate(lun.getDate() + i);
      (perGiorno.get(oggiISO(d)) || []).forEach((v) => usati.add(+v.id));
    }
    const scegli = (occ: Occasione, quando: Date) => {
      const c = candidati(profumi, occ, quando, { meteo });
      const x = c.find((y) => !usati.has(y.p.id) && y.s > c[0].s - 4) || c[0]; // un'alternativa, ma non una cattiva
      if (x) usati.add(x.p.id);
      return x || null;
    };
    for (let i = 0; i < 7; i++) {
      const d = new Date(lun);
      d.setDate(lun.getDate() + i);
      const iso = oggiISO(d),
        eOggi = iso === oggiISO(),
        passato = d < oggi,
        fine = d.getDay() === 0 || d.getDay() === 6;
      const occ = occSettimana[iso] || (fine ? "quotidiano" : "ufficio");
      const indossati = (perGiorno.get(iso) || []).map((v) => perId.get(+v.id)).filter(Boolean) as Profumo[];
      const cielo = finestraMeteo(meteo, new Date(new Date(d).setHours(7, 0, 0, 0)), 16);
      let prop: Candidato | null = null,
        sera: Candidato | null = null;
      if (!passato) {
        const o = new Date(d);
        o.setHours(ORA_PER_OCCASIONE[occ] ?? 9, 0, 0, 0);
        prop = scegli(occ, eOggi && o < new Date() ? new Date() : o);
        if (fine) {
          const s = new Date(d);
          s.setHours(19, 0, 0, 0);
          if (!eOggi || s > new Date()) sera = scegli("appuntamento", s);
        }
      }
      fuori.push({ d, iso, eOggi, passato, fine, occ, indossati, cielo, prop, sera, incerto: (d.getTime() - oggi.getTime()) / 864e5 >= 4 });
    }
    return fuori;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, perGiorno, meteo, occSettimana, ora]);
  const x = giorni.find((g) => g.iso === scelto) ?? giorni.find((g) => g.eOggi)!;

  return (
    <section className="settimana">
      <p className="settimana-nota">{meteo ? "Con il meteo ora per ora." : "Senza meteo: solo la stagione. Il meteo si attiva da Consigliami."}</p>
      <div className="settimana-giorni">
        {giorni.map((g) => {
          const p = g.passato ? g.indossati[0] : g.prop?.p;
          return (
            <button
              key={g.iso}
              type="button"
              className={"sett-giorno" + (g.eOggi ? " oggi" : "") + (g.passato ? " passato" : "")}
              aria-pressed={g.iso === x.iso}
              onClick={() => setScelto(g.iso)}
            >
              <span className="sett-data">
                <b>{NOMI_G[g.d.getDay()]}</b> {g.d.getDate()}
              </span>
              <span className="sett-cielo">{g.cielo ? `${iconaCielo(g.cielo)} ${g.cielo.min}–${g.cielo.max}°` : " "}</span>
              <Mini p={p} classe={p ? "" : "vuota"} />
              <span className="sett-nome">{p ? p.name : g.passato ? "niente" : "—"}</span>
              <span className="sett-occ">
                {g.passato ? (g.indossati.length > 1 ? `+${g.indossati.length - 1}` : " ") : NOME_OCC[g.occ]}
                {g.sera ? " · sera" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sett-dettaglio">
        <div className="sett-dettaglio-t">
          <h2>{maiuscola(x.d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }))}</h2>
          {x.cielo ? (
            <span>
              {x.cielo.min}–{x.cielo.max}° percepiti{x.cielo.pioggia !== null ? `, pioggia dalle ${x.cielo.pioggia}` : ""}
              {x.incerto ? " · previsione incerta" : ""}
            </span>
          ) : null}
        </div>
        {x.passato ? (
          <p className="diario-vuoto">
            {x.indossati.length ? (
              <>
                Hai indossato{" "}
                {x.indossati.map((p, i) => (
                  <span key={p.id}>
                    {i ? " e " : ""}
                    <Link className="collegamento" to={`/?vedi=${p.id}`}>
                      {p.name}
                    </Link>
                  </span>
                ))}
                .
              </>
            ) : (
              "Niente segnato in questo giorno."
            )}
          </p>
        ) : (
          <>
            <div className="chips">
              {OCCASIONI.map(([k, l]) => (
                <button key={k} type="button" className="chip" aria-pressed={k === x.occ} onClick={() => setOccSettimana({ ...occSettimana, [x.iso]: k })}>
                  {l}
                </button>
              ))}
            </div>
            {x.prop ? <Proposta c={x.prop} titolo={NOME_OCC[x.occ]} oggi={x.eOggi} occ={x.occ} momento={(ORA_PER_OCCASIONE[x.occ] || 9) >= 17 ? "sera" : "giorno"} /> : null}
            {x.sera ? <Proposta c={x.sera} titolo="La sera" oggi={x.eOggi} occ="appuntamento" momento="sera" /> : null}
          </>
        )}
      </div>
    </section>
  );
}

function Proposta({ c, titolo, oggi, occ, momento }: { c: Candidato; titolo: string; oggi: boolean; occ: Occasione; momento: "giorno" | "sera" }) {
  return (
    <div className="sett-proposta">
      <Link className="alt-riga" to={`/?vedi=${c.p.id}`}>
        <Mini p={c.p} />
        <span className="alt-testo">
          <span className="marca">{titolo}</span>
          <span className="n">{c.p.name}</span>
          <span className="perche">
            {c.p.brand} · {c.p.conc}
            {eCampione(c.p) ? " · campione" : ""}
          </span>
        </span>
        <span />
      </Link>
      <ol className="motivi">
        {c.pro.slice(0, 4).map((m, i) => (
          <li key={"p" + i}>
            <em>{["I", "II", "III", "IV"][i]}.</em>
            <span>{maiuscola(m)}</span>
          </li>
        ))}
        {c.contro.slice(0, 2).map((m, i) => (
          <li key={"c" + i} className="ma">
            <em>ma</em>
            <span>{maiuscola(m)}</span>
          </li>
        ))}
      </ol>
      {oggi ? <LoMetto p={c.p} uso={{ occasione: occ, momento }} compatto /> : null}
    </div>
  );
}
