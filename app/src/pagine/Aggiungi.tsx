import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDati } from "../dati";
import { immagine } from "../profumo";
import type { Profumo } from "../tipi";
import { useTitolo } from "../componenti/comuni";
import GuidaPassi, { type Passo as PassoGuida } from "../componenti/GuidaPassi";
import { IconaAvanti, IconaCerca, IconaIndietro, IconaSi, IconaX } from "../componenti/Icone";
import { catalogoComune, manda, nuovoCliente, type Aggiunta, type SchedaComune } from "../aggiunte";
import { misuraCartolina, type Misura } from "../cartolina/misura";
import { ritagliaBoccetta } from "../cartolina/boccetta";
import { apri, fotoPerIlPonte } from "../cartolina/immagini";
import { noteDellaSchermata, scritteDellaCartolina } from "../cartolina/lettore";
import type { Immagine } from "../cartolina/misura";
import {
  CONCENTRAZIONI, NOMI_OCC, OCCASIONI, STAG, coloreDa, dubbi, moduloVuoto, occasioniDa, scheda, type Colore, type Modulo
} from "../cartolina/proposte";

/* Altro ▸ Aggiungi profumo. Si cerca per nome tra le schede già in Sillage (se c'è, la si prende con i suoi dati e
   si sceglie solo la propria boccetta); se no, la «cartolina» di Fragrantica: le barre le misura il telefono, le
   scritte le legge un lettore di testo nel telefono (Tesseract, gratis, scaricato al primo uso). Poi la foto, la piramide facoltativa, e Salva: la scheda va
   nell'anagrafica comune, il profumo nella vetrina di chi lo aggiunge. Senza rete va in coda.
   Nessuna memoria tra un'apertura e l'altra: si riparte sempre dalla ricerca. */

type Passo = "cerca" | "presente" | "cartolina" | "dati" | "foto" | "piramide" | "salva" | "fatto";
type Lettura = "niente" | "in-corso" | "letta" | "senza-rete" | "errore";
interface Foto {
  tipo: string;
  dati: string;
  anteprima: string;
  da: "cartolina" | "tua";
}

const PASSI: [Passo, string][] = [
  ["cartolina", "Cartolina"],
  ["dati", "Dati"],
  ["foto", "Foto"],
  ["piramide", "Piramide"],
  ["salva", "Salva"]
];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const comeProfumo = (s: SchedaComune) => ({ id: s.id, brand: s.brand, name: s.name, img: s.img }) as Profumo;
const NOMI_COLORE: Record<Colore, string> = { blu: "Fresco", verde: "Aromatico", rosso: "Caldo" };

/* La guida, passo per passo. Le schermate (img) sono quelle dell'iPhone di Danilo, in public/img/guida/: un passo
   senza img resta solo testo. */
const PASSI_CARTOLINA: PassoGuida[] = [
  {
    testo: (
      <>
        Nell'app <b>Fragrantica</b> apri il profumo.
      </>
    ),
    didascalia: "Apri il profumo nell'app Fragrantica."
  },
  {
    testo: (
      <>
        Tocca <b>Condividi</b>.
      </>
    ),
    didascalia: "Tocca Condividi: compare la cartolina."
  },
  {
    testo: (
      <>
        Tocca <b>Salva immagine</b>.
      </>
    ),
    didascalia: "Tocca Salva immagine: la cartolina va nel rullino."
  },
  {
    testo: (
      <>
        Torna qui e <b>sceglila dal rullino</b>.
      </>
    )
  }
];
const PASSI_PIRAMIDE: PassoGuida[] = [
  {
    testo: (
      <>
        Nella scheda di Fragrantica scorri fino alla <b>piramide</b>.
      </>
    ),
    didascalia: "Così: le note di testa, cuore e fondo, intere."
  },
  {
    testo: (
      <>
        Si vedono intere le tre righe: <b>testa, cuore, fondo</b>.
      </>
    )
  },
  {
    testo: (
      <>
        Premi insieme <b>tasto laterale e volume su</b>.
      </>
    )
  }
];

export default function Aggiungi() {
  useTitolo("Aggiungi profumo · Sillage");
  const { perId, dati, riprova } = useDati();
  const vai = useNavigate();
  const [passo, setPasso] = useState<Passo>("cerca");
  const [scelta, setScelta] = useState<SchedaComune | null>(null);
  const [m, setM] = useState<Modulo>(moduloVuoto);
  const [misura, setMisura] = useState<Misura | null>(null);
  const [cartolinaUrl, setCartolinaUrl] = useState("");
  const [lettura, setLettura] = useState<Lettura>("niente");
  const [erroreLettura, setErroreLettura] = useState("");
  const [foto, setFoto] = useState<Foto | null>(null);
  const [fotoCartolina, setFotoCartolina] = useState<Foto | null>(null);
  const [possesso, setPossesso] = useState<{ tipo: "full" | "campione"; ml: string; note: string }>({ tipo: "full", ml: "", note: "" });
  const [esito, setEsito] = useState<{ id?: number; inCoda?: boolean; errore?: string; nome: string } | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [avanza, setAvanza] = useState("");
  const cartolina = useRef<{ img: Immagine; misura: Misura } | null>(null);
  const cliente = useRef(nuovoCliente());

  /* Da una scheda pubblica (#/p/24 ▸ «Mettilo nella mia vetrina»): #/aggiungi?id=24 apre subito quel profumo, come
     se lo si fosse trovato cercando. */
  const [cerca] = useSearchParams();
  const daId = Number(cerca.get("id"));
  useEffect(() => {
    if (!Number.isInteger(daId) || daId <= 0) return;
    let vivo = true;
    catalogoComune()
      .then((schede) => {
        const s = schede.find((x) => x.id === daId);
        if (vivo && s && !perId.has(daId)) {
          setScelta(s);
          setPasso("presente");
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daId]);

  // a ogni passo si torna in cima
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [passo]);

  const cambia = (campi: Partial<Modulo>) => setM((x) => ({ ...x, ...campi }));

  /** Le parole che il catalogo conosce già: correggono una lettura quasi giusta. */
  const noti = () => {
    const ps = dati?.profumi ?? [];
    return {
      accordi: [...new Set(ps.flatMap((p) => p.accordi ?? []))],
      note: [...new Set(ps.flatMap((p) => p.noteElenco ?? []))],
      marchi: [...new Set(ps.map((p) => p.brand).filter(Boolean))]
    };
  };

  /** Le scritte lette nel telefono vanno nei campi; le barre restano quelle misurate. */
  async function leggiLeScritte() {
    const c = cartolina.current;
    if (!c) return;
    setLettura("in-corso");
    setAvanza("");
    let d;
    try {
      d = await scritteDellaCartolina(c.img, c.misura, noti(), (cosa, q) => setAvanza(q !== undefined && q < 1 ? `${cosa}: ${Math.round(q * 100)}%` : cosa));
    } catch (e) {
      setErroreLettura((e as Error).message);
      return setLettura(navigator.onLine === false ? "senza-rete" : "errore");
    }
    setM((x) => {
      // un nome di accordo letto riempie la riga; se non si legge resta vuoto (lo scrive chi aggiunge)
      const accordi = x.accordi.map((a, i) => ({ ...a, nome: d.accordi[i] || a.nome }));
      const nomi = accordi.map((a) => a.nome).filter(Boolean);
      const colore = coloreDa(nomi);
      return {
        ...x,
        nome: d.nome || x.nome,
        marchio: d.marchio || x.marchio,
        conc: x.conc || d.conc,
        genere: d.genere || x.genere,
        voto: d.voto ? String(d.voto).replace(".", ",") : x.voto,
        voti: d.voti ? String(d.voti) : x.voti,
        durata: d.durata ? String(d.durata) : x.durata,
        scia: d.scia || x.scia,
        accordi,
        note: d.note.length ? d.note : x.note,
        colore,
        occasioni: occasioniDa(nomi, colore, dati?.profumi ?? [])
      };
    });
    setLettura("letta");
  }

  /** La cartolina scelta dal rullino: misura delle barre e ritaglio della boccetta subito, nel telefono. */
  async function cartolinaScelta(file: File) {
    const img = await apri(file);
    const mi = misuraCartolina(img);
    setMisura(mi);
    setCartolinaUrl(URL.createObjectURL(file));
    const accordi = mi.accordi.map((f) => ({ nome: "", forza: String(f) }));
    while (accordi.length < 5) accordi.push({ nome: "", forza: "" });
    cambia({
      accordi,
      stagioni: mi.stagioni
        ? { inverno: String(mi.stagioni.inverno), primavera: String(mi.stagioni.primavera), estate: String(mi.stagioni.estate), autunno: String(mi.stagioni.autunno) }
        : { inverno: "", primavera: "", estate: "", autunno: "" },
      giorno: mi.giornoPct !== null ? String(mi.giornoPct) : ""
    });
    const ritaglio = ritagliaBoccetta(img, mi.boccetta);
    if (ritaglio) {
      const f = { ...(await fotoPerIlPonte(ritaglio)), da: "cartolina" as const };
      setFotoCartolina(f);
      setFoto(f);
    }
    cartolina.current = { img, misura: mi };
    setPasso("dati");
    void leggiLeScritte();
  }

  async function salva(nuovo: boolean) {
    setSalvo(true);
    const a: Aggiunta = {
      cliente: cliente.current,
      scheda: nuovo ? scheda(m) : { marchio: scelta!.brand, profumo: scelta!.name, concentrazione: scelta!.conc },
      possesso: { tipo: possesso.tipo, ml: Number(possesso.ml.replace(",", ".")) || null, note: possesso.note },
      foto: nuovo && foto ? { tipo: foto.tipo, dati: foto.dati } : null
    };
    const nome = nuovo ? m.nome : scelta!.name;
    const r = await manda(a, nome);
    setSalvo(false);
    if (r.ok) {
      setEsito({ id: r.id, nome });
      riprova();
    } else if ("inCoda" in r) setEsito({ inCoda: true, nome });
    else setEsito({ errore: r.errore, nome });
    setPasso("fatto");
  }

  // ── i passi ──
  if (passo === "cerca") return <Cerca perId={perId} prendi={(s) => (setScelta(s), setPasso("presente"))} nuovo={() => setPasso("cartolina")} />;

  if (passo === "presente" && scelta)
    return (
      <section className="aggiungi">
        <Indietro a={() => setPasso("cerca")}>Cerca</Indietro>
        <p className="incisa">Già in Sillage</p>
        <Scena src={immagine(comeProfumo(scelta))} alt={scelta.name} piccola />
        <div className="ag-nome">
          <p className="incisa">{scelta.brand}</p>
          <h1>{scelta.name}</h1>
          {scelta.conc ? <p className="ag-conc">{scelta.conc}</p> : null}
        </div>
        <p className="ag-avviso">
          <IconaSi />
          <span>
            La scheda c'è già, con voti, stagioni, accordi e piramide. <b>Scegli solo la tua boccetta.</b>
          </span>
        </p>
        <Possesso v={possesso} cambia={setPossesso} />
        <button className="btn-filo pieno largo" type="button" disabled={salvo} onClick={() => salva(false)}>
          {salvo ? "Salvo…" : "Metti in vetrina"}
        </button>
        <p className="nota-piccola centro">Entra subito nella tua vetrina. Nessuna lettura, nessuna attesa.</p>
      </section>
    );

  if (passo === "cartolina")
    return (
      <section className="aggiungi">
        <Indietro a={() => setPasso("cerca")}>Cerca</Indietro>
        <Passi qui="cartolina" />
        <h1 className="ag-titolo">Profumo nuovo</h1>
        <p className="testo ag-testo">Sillage legge tutto dalla cartolina che fa l'app di Fragrantica.</p>
        <GuidaPassi passi={PASSI_CARTOLINA} titolo="Come si salva la cartolina" />
        <label className="ag-rullino">
          <input
            type="file"
            accept="image/*"
            className="vh"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void cartolinaScelta(f);
            }}
          />
          <IconaFoto />
          <b>Scegli la cartolina</b>
          <span>Il telefono misura le barre e legge le scritte. Gratis; la prima volta scarica il lettore (circa 6 MB).</span>
        </label>
        <button className="link-piano" type="button" onClick={() => (setLettura("niente"), setPasso("dati"))}>
          Non ho la cartolina: scrivo io i dati
        </button>
        <dl className="ag-serve">
          <div>
            <dt>Dalla cartolina</dt>
            <dd>nome, marchio, voto, durata, scia, accordi, stagioni, giorno e sera, la boccetta</dd>
          </div>
          <div>
            <dt>Lo scegli tu dopo</dt>
            <dd>concentrazione (EDT, EDP…), boccetta o campione, ml</dd>
          </div>
          <div>
            <dt>Facoltativi</dt>
            <dd>la piramide (da una schermata) e una tua foto</dd>
          </div>
        </dl>
      </section>
    );

  if (passo === "dati") {
    const d = dubbi(m, misura ? misura.accordi.length : undefined);
    const pronto = m.nome.trim() && m.marchio.trim() && m.conc;
    return (
      <section className="aggiungi">
        <Indietro a={() => setPasso("cartolina")}>Cartolina</Indietro>
        <Passi qui="dati" />
        <h1 className="ag-titolo">Controlla i dati</h1>
        <p className="testo ag-testo">Tocca un valore per cambiarlo. In ambra quello che non torna.</p>
        {cartolinaUrl ? (
          <div className="ag-cartolina">
            <img src={cartolinaUrl} alt="La cartolina scelta" />
            <div>
              <b>{lettura === "in-corso" ? (avanza || "Leggo le scritte") + "…" : "Cartolina letta"}</b>
              <span>
                Barre misurate nel telefono
                {lettura === "letta" ? ", scritte lette nel telefono." : "."}
              </span>
              <StatoLettura lettura={lettura} errore={erroreLettura} riprova={leggiLeScritte} />
            </div>
          </div>
        ) : null}
        {misura?.dubbi.length ? (
          <ul className="ag-dubbi">
            {misura.dubbi.map((x) => (
              <li key={x}>
                <IconaAttenzione />
                {x}
              </li>
            ))}
          </ul>
        ) : null}

        <Blocco titolo="Il profumo">
          <div className="ag-campi">
            <Campo et="Nome" largo grande v={m.nome} cambia={(nome) => cambia({ nome })} dubbio={!m.nome.trim() && lettura !== "in-corso" ? "Serve il nome." : ""} />
            <Campo et="Marchio" v={m.marchio} cambia={(marchio) => cambia({ marchio })} />
            <div className="ag-campo">
              <label htmlFor="ag-genere">Genere</label>
              <select id="ag-genere" value={m.genere} onChange={(e) => cambia({ genere: e.target.value })}>
                <option value="">—</option>
                <option value="uomo">da uomo</option>
                <option value="donna">da donna</option>
                <option value="unisex">unisex</option>
              </select>
            </div>
            <div className={"ag-campo largo" + (d.conc ? " dubbio" : "")}>
              <span className="ag-et">Concentrazione</span>
              <div className="chips" role="group" aria-label="Concentrazione">
                {CONCENTRAZIONI.map((c) => (
                  <button key={c} type="button" className={"chip" + (d.conc ? " dubbio" : "")} aria-pressed={m.conc === c} onClick={() => cambia({ conc: c })}>
                    {c}
                  </button>
                ))}
              </div>
              {d.conc ? <Perche>{d.conc}</Perche> : null}
            </div>
            <Campo et="Voto" v={m.voto} cambia={(voto) => cambia({ voto })} dubbio={d.voto} decimale />
            <Campo et="Voti" v={m.voti} cambia={(voti) => cambia({ voti })} numero />
            <Campo et="Durata (ore)" v={m.durata} cambia={(durata) => cambia({ durata })} numero />
            <Campo et="Scia" v={m.scia} cambia={(scia) => cambia({ scia })} />
          </div>
        </Blocco>

        <Blocco titolo="Accordi" scala="forza">
          <ul className="ag-righe">
            {m.accordi.map((a, i) => (
              <li key={i}>
                <input
                  className="ag-n"
                  value={a.nome}
                  placeholder={"Accordo " + (i + 1)}
                  aria-label={"Accordo " + (i + 1)}
                  onChange={(e) => cambia({ accordi: m.accordi.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })}
                />
                <span className="traccia">
                  <i style={{ "--w": Math.min(100, Number(a.forza) || 0) + "%" } as CSSProperties} />
                </span>
                <input
                  className="ag-v"
                  inputMode="numeric"
                  value={a.forza}
                  aria-label={"Forza di " + (a.nome || "accordo " + (i + 1))}
                  onChange={(e) => cambia({ accordi: m.accordi.map((x, j) => (j === i ? { ...x, forza: e.target.value } : x)) })}
                />
              </li>
            ))}
          </ul>
          {d.accordi ? <Perche>{d.accordi}</Perche> : null}
        </Blocco>

        <Blocco titolo="Stagioni" scala="su 100">
          <ul className="ag-righe">
            {STAG.map((k) => (
              <li key={k} className={d.stagioni ? "dubbio" : ""}>
                <span className="ag-n fisso">{k[0].toUpperCase() + k.slice(1)}</span>
                <span className="traccia">
                  <i style={{ "--w": Math.min(100, Number(m.stagioni[k]) || 0) + "%" } as CSSProperties} />
                </span>
                <input
                  className="ag-v"
                  inputMode="numeric"
                  value={m.stagioni[k]}
                  aria-label={k}
                  onChange={(e) => cambia({ stagioni: { ...m.stagioni, [k]: e.target.value } })}
                />
              </li>
            ))}
          </ul>
          {d.stagioni ? <Perche>{d.stagioni}</Perche> : null}
          {!STAG.some((k) => m.stagioni[k]) ? <p className="nota-piccola">Senza stagioni Consigliami non lo propone finché non le aggiungi.</p> : null}
        </Blocco>

        <Blocco titolo="Giorno e notte">
          <div className="ag-giorno">
            <label htmlFor="ag-g">Giorno</label>
            <input id="ag-g" className="ag-v" inputMode="numeric" value={m.giorno} onChange={(e) => cambia({ giorno: e.target.value })} />
            <span className="ag-asta">
              <b style={{ width: Math.min(100, Number(m.giorno) || 0) + "%" }} />
            </span>
            <span>{m.giorno ? 100 - (Number(m.giorno) || 0) + " Notte" : "Notte"}</span>
          </div>
          {d.giorno ? <Perche>{d.giorno}</Perche> : null}
        </Blocco>

        <Blocco titolo="Occasioni" scala="proposte, cambiale">
          <div className="chips">
            {OCCASIONI.map((o) => (
              <button
                key={o}
                type="button"
                className="chip"
                aria-pressed={m.occasioni.includes(o)}
                onClick={() => cambia({ occasioni: m.occasioni.includes(o) ? m.occasioni.filter((x) => x !== o) : [...m.occasioni, o] })}
              >
                {NOMI_OCC[o]}
              </button>
            ))}
          </div>
        </Blocco>

        <Blocco titolo="Carattere" scala="proposto">
          <div className="chips">
            {(["blu", "verde", "rosso"] as Colore[]).map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={m.colore === c} onClick={() => cambia({ colore: c })}>
                <i className={"ag-gemma " + c} aria-hidden="true" />
                {NOMI_COLORE[c]}
              </button>
            ))}
          </div>
          <div className="ag-campi">
            <Campo et="Famiglia (facoltativa)" largo v={m.famiglia} cambia={(famiglia) => cambia({ famiglia })} />
            <Campo et="Link Fragrantica (facoltativo)" largo v={m.fragrantica} cambia={(fragrantica) => cambia({ fragrantica })} />
          </div>
        </Blocco>

        <button className="btn-filo pieno largo" type="button" disabled={!pronto} onClick={() => setPasso("foto")}>
          Avanti: la foto
        </button>
        {!pronto ? <p className="nota-piccola centro">Servono nome, marchio e concentrazione.</p> : null}
      </section>
    );
  }

  if (passo === "foto")
    return (
      <section className="aggiungi">
        <Indietro a={() => setPasso("dati")}>Dati</Indietro>
        <Passi qui="foto" />
        <h1 className="ag-titolo">La foto</h1>
        <SceltaFoto foto={foto} fotoCartolina={fotoCartolina} setFoto={setFoto} nome={m.nome} />
        <button className="btn-filo pieno largo" type="button" onClick={() => setPasso("piramide")}>
          Avanti: la piramide
        </button>
      </section>
    );

  if (passo === "piramide")
    return (
      <section className="aggiungi">
        <Indietro a={() => setPasso("foto")}>Foto</Indietro>
        <Passi qui="piramide" />
        <h1 className="ag-titolo">La piramide</h1>
        <Piramide m={m} cambia={cambia} noti={[...new Set((dati?.profumi ?? []).flatMap((p) => p.noteElenco ?? []))]} />
        <button className="btn-filo pieno largo" type="button" onClick={() => setPasso("salva")}>
          Avanti
        </button>
        <button className="link-piano" type="button" onClick={() => (cambia({ piramide: { testa: [], cuore: [], fondo: [] } }), setPasso("salva"))}>
          Salta: entra senza piramide
        </button>
      </section>
    );

  if (passo === "salva") {
    const piramide = m.piramide.testa.length + m.piramide.cuore.length + m.piramide.fondo.length > 0;
    const stagioni = STAG.some((k) => m.stagioni[k]);
    return (
      <section className="aggiungi">
        <Indietro a={() => setPasso("piramide")}>Piramide</Indietro>
        <Passi qui="salva" />
        <h1 className="ag-titolo">La tua boccetta</h1>
        <div className="ag-riepilogo">
          {foto ? <img src={foto.anteprima} alt="" /> : <span className="senza-foto" aria-hidden="true" />}
          <div>
            <b>{m.nome}</b>
            <span>{[m.marchio, m.conc, m.genere && (m.genere === "unisex" ? "unisex" : "da " + m.genere)].filter(Boolean).join(" · ")}</span>
            <ul className="ag-spunte">
              <Spunta si={stagioni}>{stagioni ? "Voti, accordi e stagioni" : "Senza stagioni: Consigliami lo salta"}</Spunta>
              <Spunta si={!!foto}>{foto ? (foto.da === "cartolina" ? "Foto dalla cartolina" : "La tua foto") : "Senza foto"}</Spunta>
              <Spunta si={piramide}>{piramide ? "Piramide" : "Senza piramide"}</Spunta>
            </ul>
          </div>
        </div>
        <Possesso v={possesso} cambia={setPossesso} />
        <p className="ag-avviso">
          <IconaInfo />
          <span>
            Entra nella <b>tua vetrina</b>, e la scheda resta in Sillage: chi lo cerca dopo lo trova già pronto. Nelle vetrine degli altri non compare.
          </span>
        </p>
        <button className="btn-filo pieno largo" type="button" disabled={salvo} onClick={() => salva(true)}>
          {salvo ? "Salvo…" : "Salva"}
        </button>
      </section>
    );
  }

  // fatto
  return (
    <section className="aggiungi">
      <p className="incisa">Aggiungi profumo</p>
      {esito?.errore ? (
        <>
          <h1 className="ag-titolo">Non è entrato</h1>
          <p className="testo">Il database ha risposto: {esito.errore}</p>
          <button className="btn-filo largo" type="button" onClick={() => setPasso(scelta ? "presente" : "salva")}>
            Torna indietro
          </button>
        </>
      ) : esito?.inCoda ? (
        <>
          <h1 className="ag-titolo">In attesa di rete</h1>
          <p className="testo">
            <b>{esito.nome}</b> è salvato su questo telefono: entra nella tua vetrina appena torna la rete, da solo.
          </p>
          <Link className="btn-filo largo" to="/">
            Alla collezione
          </Link>
        </>
      ) : (
        <>
          <h1 className="ag-titolo">Nella tua vetrina</h1>
          <p className="testo">
            <b>{esito?.nome}</b> è in Sillage.
          </p>
          <button className="btn-filo pieno largo" type="button" onClick={() => vai("/profumo/" + esito?.id)}>
            Vai alla scheda
          </button>
          <button
            className="link-piano"
            type="button"
            onClick={() => {
              cliente.current = nuovoCliente();
              setM(moduloVuoto());
              setMisura(null);
              setFoto(null);
              setFotoCartolina(null);
              setCartolinaUrl("");
              setScelta(null);
              setEsito(null);
              setPossesso({ tipo: "full", ml: "", note: "" });
              setPasso("cerca");
            }}
          >
            Aggiungine un altro
          </button>
        </>
      )}
    </section>
  );
}

// ── i pezzi ──

function Cerca({ perId, prendi, nuovo }: { perId: Map<number, Profumo>; prendi: (s: SchedaComune) => void; nuovo: () => void }) {
  const [q, setQ] = useState("");
  const [schede, setSchede] = useState<SchedaComune[] | null>(null);
  const [errore, setErrore] = useState("");
  useEffect(() => {
    catalogoComune()
      .then(setSchede)
      .catch((e: Error) => setErrore(navigator.onLine === false ? "senza rete" : e.message));
  }, []);
  const trovate = useMemo(() => {
    const t = norm(q.trim());
    if (!t || !schede) return [];
    return schede.filter((s) => norm(s.brand + " " + s.name + " " + s.conc).includes(t) || norm(s.name + " " + s.brand).includes(t)).slice(0, 12);
  }, [q, schede]);
  return (
    <section className="aggiungi">
      <Link className="ag-indietro" to="/altro">
        <IconaIndietro />
        Altro
      </Link>
      <p className="incisa">Sillage · la tua vetrina</p>
      <h1 className="titolo-pagina">Aggiungi profumo</h1>
      <div className="filo-ottone" />
      <p className="testo ag-testo">Scrivi il nome: se è già in Sillage lo prendi con tutti i suoi dati.</p>
      <label className="cerca ag-cerca">
        <IconaCerca />
        <span className="vh">Nome o marchio</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome o marchio" autoComplete="off" />
      </label>
      {errore ? (
        <p className="nota-piccola">{errore === "senza rete" ? "Senza rete non posso cercare tra le schede di Sillage." : "Non riesco a leggere le schede: " + errore}</p>
      ) : !schede && q ? (
        <p className="nota-piccola">Cerco…</p>
      ) : q && !trovate.length ? (
        <p className="nota-piccola">Non è ancora in Sillage.</p>
      ) : null}
      <ul className="ag-risultati">
        {trovate.map((s) => {
          const mio = perId.has(s.id);
          const dentro = (
            <>
              <img src={immagine(comeProfumo(s))} alt="" />
              <span>
                <span className="ag-ris-nome">
                  {s.name}
                  <small>{s.conc}</small>
                </span>
                <span className="ag-ris-marca">{s.brand}</span>
              </span>
              {mio ? (
                <span className="ag-ris-stato">Già nella tua vetrina</span>
              ) : (
                <span className="ag-ris-stato prendi">
                  Prendi
                  <IconaAvanti />
                </span>
              )}
            </>
          );
          return (
            <li key={s.id}>
              {mio ? (
                <div className="ag-ris gia">{dentro}</div>
              ) : (
                <button type="button" className="ag-ris" onClick={() => prendi(s)}>
                  {dentro}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="ag-oppure">Non c'è?</p>
      <button className="btn-filo largo" type="button" onClick={nuovo}>
        <span aria-hidden="true">+</span> Profumo nuovo
      </button>
      <p className="nota-piccola centro">Lo aggiungi con la cartolina di Fragrantica.</p>
    </section>
  );
}

function SceltaFoto({
  foto,
  fotoCartolina,
  setFoto,
  nome
}: {
  foto: Foto | null;
  fotoCartolina: Foto | null;
  setFoto: (f: Foto | null) => void;
  nome: string;
}) {
  const [lavoro, setLavoro] = useState<{ testo: string; pct: number | null } | null>(null);
  const [errore, setErrore] = useState("");
  async function tua(file: File) {
    setErrore("");
    setLavoro({ testo: "Preparo lo scontorno", pct: null });
    try {
      const { scontorna } = await import("../cartolina/scontorna");
      const img = await scontorna(file, (testo, pct) => setLavoro({ testo, pct }));
      setFoto({ ...(await fotoPerIlPonte(img)), da: "tua" });
    } catch (e) {
      setErrore(navigator.onLine === false ? "Senza rete non posso scaricare lo scontorno la prima volta." : "Lo scontorno non è riuscito: " + (e as Error).message);
    } finally {
      setLavoro(null);
    }
  }
  return (
    <>
      <Scena src={foto?.anteprima ?? ""} alt={"Boccetta di " + nome} />
      {lavoro ? (
        <p className="ag-lavoro" role="status">
          {lavoro.testo}
          {lavoro.pct !== null ? ` · ${lavoro.pct}%` : "…"}
        </p>
      ) : null}
      {errore ? <Perche>{errore}</Perche> : null}
      <div className="ag-due" role="group" aria-label="Quale foto">
        {fotoCartolina ? (
          <button type="button" className="ag-opzione" aria-pressed={foto?.da === "cartolina"} onClick={() => setFoto(fotoCartolina)}>
            <IconaSi />
            <b>Questa</b>
            <span>Presa dalla cartolina, già scontornata.</span>
          </button>
        ) : (
          <button type="button" className="ag-opzione" aria-pressed={!foto} onClick={() => setFoto(null)}>
            <IconaX />
            <b>Per ora niente</b>
            <span>La boccetta resta disegnata: la foto si può mettere dopo.</span>
          </button>
        )}
        <label className="ag-opzione" data-scelta={foto?.da === "tua"}>
          <input
            type="file"
            accept="image/*"
            className="vh"
            disabled={!!lavoro}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void tua(f);
            }}
          />
          <IconaFoto />
          <b>Una tua foto</b>
          <span>Scattala o sceglila: la scontorno nel telefono.</span>
        </label>
      </div>
      <p className="nota-piccola">La prima volta che usi una tua foto il telefono scarica lo scontorno (circa 44 MB): meglio col Wi-Fi.</p>
    </>
  );
}

function Piramide({ m, cambia, noti }: { m: Modulo; cambia: (c: Partial<Modulo>) => void; noti: string[] }) {
  const [stato, setStato] = useState<"" | "leggo" | string>("");
  const [nuova, setNuova] = useState<{ livello: keyof Modulo["piramide"]; testo: string } | null>(null);
  async function schermata(file: File) {
    setStato("leggo");
    try {
      const d = await noteDellaSchermata(await apri(file), noti);
      if (!d.testa.length && !d.cuore.length && !d.fondo.length) return setStato("Non trovo note in questa schermata: scrivile tu, o prova con un'altra.");
      cambia({ piramide: d });
      setStato("");
    } catch {
      setStato(navigator.onLine === false ? "La prima volta il lettore si scarica: serve la rete. Scrivi tu le note o riprova dopo." : "Non sono riuscito a leggerla: scrivi tu le note.");
    }
  }
  const togli = (l: keyof Modulo["piramide"], i: number) => cambia({ piramide: { ...m.piramide, [l]: m.piramide[l].filter((_, j) => j !== i) } });
  return (
    <>
      <p className="testo ag-testo">Facoltativa. Sillage legge le note da una schermata di Fragrantica.</p>
      <GuidaPassi passi={PASSI_PIRAMIDE} titolo="La schermata della piramide" />
      <p className="nota-piccola">Va bene chiara o scura. Le note che non entrano nella schermata le aggiungi a mano.</p>
      <label className="btn-filo largo">
        <input
          type="file"
          accept="image/*"
          className="vh"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void schermata(f);
          }}
        />
        <IconaFoto />
        Scegli la schermata
      </label>
      {stato === "leggo" ? (
        <p className="ag-lavoro" role="status">
          Leggo la schermata…
        </p>
      ) : stato ? (
        <Perche>{stato}</Perche>
      ) : null}
      <Blocco titolo="Note" scala="cambiale">
        {(["testa", "cuore", "fondo"] as const).map((l) => (
          <div className="ag-livello" key={l}>
            <b>{l[0].toUpperCase() + l.slice(1)}</b>
            <div className="chips">
              {m.piramide[l].map((n, i) => (
                <span className="ag-nota" key={n + i}>
                  {n}
                  <button type="button" aria-label={"Togli " + n} onClick={() => togli(l, i)}>
                    <IconaX />
                  </button>
                </span>
              ))}
              {nuova?.livello === l ? (
                <form
                  className="ag-nuova"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (nuova.testo.trim()) cambia({ piramide: { ...m.piramide, [l]: [...m.piramide[l], nuova.testo.trim()] } });
                    setNuova(null);
                  }}
                >
                  <input autoFocus value={nuova.testo} aria-label={"Nota di " + l} onChange={(e) => setNuova({ livello: l, testo: e.target.value })} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
                </form>
              ) : (
                <button type="button" className="ag-piu" onClick={() => setNuova({ livello: l, testo: "" })}>
                  + nota
                </button>
              )}
            </div>
          </div>
        ))}
      </Blocco>
    </>
  );
}

function Possesso({
  v,
  cambia
}: {
  v: { tipo: "full" | "campione"; ml: string; note: string };
  cambia: (x: { tipo: "full" | "campione"; ml: string; note: string }) => void;
}) {
  const misure = v.tipo === "campione" ? ["1", "2", "5", "10"] : ["30", "50", "100", "200"];
  const altro = v.ml !== "" && !misure.includes(v.ml);
  return (
    <>
      <Blocco titolo="Cosa hai">
        <div className="chips">
          <button type="button" className="chip" aria-pressed={v.tipo === "full"} onClick={() => cambia({ ...v, tipo: "full", ml: "" })}>
            Boccetta
          </button>
          <button type="button" className="chip" aria-pressed={v.tipo === "campione"} onClick={() => cambia({ ...v, tipo: "campione", ml: "" })}>
            Campione
          </button>
        </div>
      </Blocco>
      <Blocco titolo="Millilitri" scala="facoltativo">
        <div className="chips">
          {misure.map((x) => (
            <button key={x} type="button" className="chip" aria-pressed={v.ml === x} onClick={() => cambia({ ...v, ml: v.ml === x ? "" : x })}>
              {x}
            </button>
          ))}
          <input
            className={"chip ag-altro-ml" + (altro ? " pieno" : "")}
            inputMode="decimal"
            placeholder="Altro"
            aria-label="Altri millilitri"
            value={altro ? v.ml : ""}
            onChange={(e) => cambia({ ...v, ml: e.target.value.replace(/[^\d,.]/g, "") })}
          />
        </div>
      </Blocco>
      <Blocco titolo="Le tue note" scala="facoltativo">
        <div className="ag-campi">
          <Campo et="Note personali" largo v={v.note} cambia={(note) => cambia({ ...v, note })} segnaposto="Come lo porti, a chi piace…" />
        </div>
      </Blocco>
    </>
  );
}

function Scena({ src, alt, piccola = false }: { src: string; alt: string; piccola?: boolean }) {
  return (
    <div className={"ag-scena" + (piccola ? " piccola" : "")}>
      <span className="ag-fascio" />
      {src ? <img className="ag-boccetta" src={src} alt={alt} /> : <span className="ag-boccetta senza-foto" aria-hidden="true" />}
      <span className="ag-piedistallo" />
    </div>
  );
}

function StatoLettura({ lettura, errore, riprova }: { lettura: Lettura; errore: string; riprova: () => void }) {
  if (lettura === "letta") return <span className="ag-ok">Scritte lette: controllale qui sotto.</span>;
  if (lettura === "senza-rete")
    return (
      <span className="ag-ambra">
        La prima volta il lettore si scarica: serve la rete. Scrivi tu nome e numeri, o{" "}
        <button type="button" className="ag-riprova" onClick={riprova}>
          riprova a leggere
        </button>
        .
      </span>
    );
  if (lettura === "errore")
    return (
      <span className="ag-ambra">
        {errore || "La lettura non è riuscita"}.{" "}
        <button type="button" className="ag-riprova" onClick={riprova}>
          Riprova
        </button>
      </span>
    );
  return null;
}

function Passi({ qui }: { qui: Passo }) {
  const i = PASSI.findIndex(([p]) => p === qui);
  return (
    <ol className="ag-passi" aria-label="Passi">
      {PASSI.map(([p, t], j) => (
        <li key={p} className={j < i ? "fatto" : j === i ? "qui" : ""} aria-current={j === i ? "step" : undefined}>
          {t}
        </li>
      ))}
    </ol>
  );
}

function Indietro({ a, children }: { a: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ag-indietro" onClick={a}>
      <IconaIndietro />
      {children}
    </button>
  );
}

function Blocco({ titolo, scala, children }: { titolo: string; scala?: string; children: ReactNode }) {
  return (
    <section className="sez">
      <div className="sez-testa">
        <h3>{titolo}</h3>
        <i className="linea" />
        {scala ? <span className="scala">{scala}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Campo({
  et,
  v,
  cambia,
  largo,
  grande,
  dubbio,
  numero,
  decimale,
  segnaposto
}: {
  et: string;
  v: string;
  cambia: (v: string) => void;
  largo?: boolean;
  grande?: boolean;
  dubbio?: string;
  numero?: boolean;
  decimale?: boolean;
  segnaposto?: string;
}) {
  const id = "ag-" + et.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className={"ag-campo" + (largo ? " largo" : "") + (dubbio ? " dubbio" : "")}>
      <label htmlFor={id}>{et}</label>
      <input
        id={id}
        className={grande ? "grande" : ""}
        value={v}
        placeholder={segnaposto}
        inputMode={decimale ? "decimal" : numero ? "numeric" : undefined}
        onChange={(e) => cambia(e.target.value)}
      />
      {dubbio ? <Perche>{dubbio}</Perche> : null}
    </div>
  );
}

const Perche = ({ children }: { children: ReactNode }) => (
  <p className="ag-perche">
    <IconaAttenzione />
    <span>{children}</span>
  </p>
);
const Spunta = ({ si, children }: { si: boolean; children: ReactNode }) => (
  <li className={si ? "" : "manca"}>
    {si ? <IconaSi /> : <IconaX />}
    {children}
  </li>
);
const IconaFoto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="14" rx="1" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 15.5l-5-5-8 8.5" />
  </svg>
);
const IconaAttenzione = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);
const IconaInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);
