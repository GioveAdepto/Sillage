import { Link, useSearchParams } from "react-router";
import { useState, type ReactNode } from "react";
import type { Profumo } from "../tipi";
import { useDati } from "../dati";
import { USO_LABELS, confronto, notePerConfronto, stagLbl } from "../viste/calcoli";
import { eCampione, migliaia, momLbl, nr } from "../profumo";
import Ruota, { COLORI_SERIE } from "../componenti/Ruota";
import { Sezione, Testata } from "../componenti/Righe";
import { vediIn } from "../componenti/Tessera";
import { Mini, useTitolo } from "../componenti/comuni";
import { IconaX } from "../componenti/Icone";

/* Confronta: due o tre profumi fianco a fianco (disegnaConfronto in js/viste.js). In ottone il migliore su rating
   e durata, e quello che hanno in comune. I profumi stanno nell'indirizzo (#/confronta?ids=3,24,7): si arriva dalla
   Collezione («Confronta», poi si toccano le teche) o dalla Scheda («Confronta con…»), e si aggiunge qui. */
const MAX = 3;

export default function Confronta() {
  const { dati, perId, numeri } = useDati();
  const [par, setPar] = useSearchParams();
  const [cerca, setCerca] = useState("");
  useTitolo("Confronta · Sillage");
  const ids = (par.get("ids") || "")
    .split(",")
    .map(Number)
    .filter((id, i, a) => perId.has(id) && a.indexOf(id) === i)
    .slice(0, MAX);
  const lista = ids.map((id) => perId.get(id)!);
  const imposta = (nuovi: number[]) => setPar(nuovi.length ? { ids: nuovi.join(",") } : {}, { replace: true, preventScrollReset: true });

  if (!dati)
    return (
      <section className="segnaposto">
        <p className="incisa">Confronta</p>
        <h1 className="titolo-pagina">Un momento…</h1>
      </section>
    );

  const q = cerca.trim().toLowerCase();
  const scelta =
    lista.length < MAX ? (
      <div className="diario-scelta">
        <p className="incisa">{lista.length ? "Aggiungi un profumo" : "Scegli i profumi da confrontare"}</p>
        <label className="cerca diario-cerca">
          <span className="vh">Cerca per nome o marca</span>
          <input type="search" placeholder="Cerca per nome o marca…" value={cerca} onChange={(e) => setCerca(e.target.value)} autoComplete="off" />
        </label>
        <div className="diario-elenco corto">
          {dati.profumi
            .filter((p) => !ids.includes(p.id) && (!q || (p.name + " " + p.brand).toLowerCase().includes(q)))
            .sort((a, b) => Number(eCampione(a)) - Number(eCampione(b)) || a.name.localeCompare(b.name, "it"))
            .map((p) => (
              <button key={p.id} type="button" className="diario-voce scelta-voce" onClick={() => (imposta([...ids, p.id]), setCerca(""))}>
                <Mini p={p} />
                <span className="diario-voce-testo">
                  <b>{p.name}</b>
                  <small>
                    {p.brand} · {p.conc}
                    {eCampione(p) ? " · campione" : ""}
                  </small>
                </span>
                <span className="diario-azione" aria-hidden="true">
                  +
                </span>
              </button>
            ))}
        </div>
      </div>
    ) : null;

  if (lista.length < 2)
    return (
      <section className="vista confronta">
        <Testata incisa="Confronta" titolo="Fianco a fianco" testo="Due o tre profumi affiancati. Si scelgono qui, dalla Collezione («Confronta») o dalla scheda di un profumo." />
        {lista.length ? <Teste lista={lista} numeri={numeri} togli={(id) => imposta(ids.filter((x) => x !== id))} /> : null}
        {scelta}
      </section>
    );

  const c = confronto(lista);
  const comuneA = new Set(c.accComuni.map((x) => x.toLowerCase())),
    comuneN = new Set(c.noteComuni.map((x) => x.toLowerCase()));
  const riga = (eti: string, fn: (p: Profumo) => ReactNode, meglio?: (p: Profumo) => boolean) => (
    <div className="cf-riga" key={eti}>
      <p className="cf-eti">{eti}</p>
      <div className={"cf-celle col" + lista.length}>
        {lista.map((p) => (
          <div key={p.id} className={"cf-cella" + (meglio?.(p) ? " meglio" : "")}>
            {fn(p)}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <section className="vista confronta">
      <Testata incisa="Confronta" titolo="Fianco a fianco" testo="In ottone il migliore su rating e durata, e quello che hanno in comune." />
      <Teste lista={lista} numeri={numeri} togli={(id) => imposta(ids.filter((x) => x !== id))} />

      <Sezione titolo="In comune">
        {c.accComuni.length || c.noteComuni.length ? (
          <p className="in-comune">
            {c.accComuni.map((a) => (
              <span key={"a" + a} className="targa">
                {a}
              </span>
            ))}
            {c.noteComuni.map((n) => (
              <span key={"n" + n} className="nota-comune">
                {n}
              </span>
            ))}
          </p>
        ) : (
          <p className="testo-piccolo">Niente: sono profumi lontani tra loro.</p>
        )}
      </Sezione>

      <Sezione titolo="Ruota degli accordi">
        <Ruota lista={lista} />
      </Sezione>

      <Sezione titolo="Profilo">
        {riga("Rating", (p) => (p.rating ? <>★ {p.rating.toFixed(1).replace(".", ",")}{p.voti ? <small>{migliaia(p.voti)} voti</small> : null}</> : "n.d."), (p) => !!p.rating && p.rating === c.megR)}
        {riga("Longevità", (p) => (p.longevita ? p.longevita + "h" : "n.d."), (p) => !!p.longevita && p.longevita === c.megL)}
        {riga("Stagione", (p) => stagLbl(p.stagione))}
        {riga("Momento", (p) => momLbl(p.momento))}
        {riga("Famiglia", (p) => p.famiglia)}
        {riga("Copia di", (p) => (p.dupe ? p.dupe.split(" (")[0] : "—"))}
      </Sezione>
      <Sezione titolo="Accordi e note">
        {riga("Top accordi", (p) => (
          <span className="cf-elenco">
            {p.accordi.slice(0, 4).map((a) => (
              <span key={a} className={comuneA.has(a.toLowerCase()) ? "comune" : undefined}>
                {a}
              </span>
            ))}
          </span>
        ))}
        {riga("Note", (p) => (
          <span className="cf-elenco">
            {notePerConfronto(p).map((n) => (
              <span key={n} className={comuneN.has(n.toLowerCase()) ? "comune" : undefined}>
                {n}
              </span>
            ))}
          </span>
        ))}
      </Sezione>
      <Sezione titolo="Quando indossarlo">
        {USO_LABELS.map(([k, l]) =>
          riga(l, (p) => {
            const v = p[k as keyof Profumo];
            return <span className={"cf-uso " + (v === "si" ? "si" : v === "si-mod" ? "forse" : "no")}>{v === "si" ? "Sì" : v === "si-mod" ? "Con moderazione" : "No"}</span>;
          })
        )}
      </Sezione>
      {scelta}
    </section>
  );
}

function Teste({ lista, numeri, togli }: { lista: Profumo[]; numeri: Map<number, number>; togli: (id: number) => void }) {
  return (
    <div className={"cf-teste col" + Math.max(lista.length, 2)}>
      {lista.map((p, j) => (
        <div key={p.id} className="cf-testa">
          <button type="button" className="cf-x" onClick={() => togli(p.id)} aria-label={`Togli ${p.name} dal confronto`}>
            <IconaX />
          </button>
          <Link to={vediIn(p)} className="cf-foto">
            <Mini p={p} />
          </Link>
          <span className="marca">{p.brand}</span>
          <b className="cf-nome">{p.name}</b>
          <span className="cf-grado">
            {p.conc} · {nr(numeri.get(p.id) ?? p.id)}
          </span>
          <i className="cf-serie" style={{ background: COLORI_SERIE[j % 3] }} title="Colore nella ruota degli accordi" />
        </div>
      ))}
    </div>
  );
}
