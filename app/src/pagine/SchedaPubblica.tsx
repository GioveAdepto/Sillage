import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import type { Profumo } from "../tipi";
import { PONTE, useDati } from "../dati";
import { useTitolo } from "../componenti/comuni";
import { IconaFuori, IconaIndietro } from "../componenti/Icone";
import { DatiComuni, Sezione, Testata } from "./Scheda";

/* La scheda pubblica di un profumo (#/p/24): ci arriva chi tocca il profumo in CheMetto (Bacheca, Oggi, i consigli).
   Scelte dell'utente (17 novembre 2026): chi non ha un account vede la scheda del profumo, senza entrare, con l'invito
   a entrare; chi è entrato e ha il profumo apre la sua scheda; chi è entrato e non ce l'ha vede questa, con «Mettilo
   nella mia vetrina». Solo i dati comuni del catalogo (azione=scheda del ponte, senza credenziali): mai di chi è il
   profumo, note personali, residuo o diario. */

type Esito = { p: Profumo | null; errore: string | null };

/** La scheda comune dal ponte, senza credenziali. */
async function leggiScheda(id: number): Promise<Profumo> {
  const r = await fetch(PONTE + "?azione=scheda", { method: "POST", body: new URLSearchParams({ id: String(id) }) });
  const corpo = (await r.json().catch(() => null)) as { profumo?: Profumo; errore?: string } | null;
  if (!corpo) throw new Error("il database non ha risposto");
  if (corpo.errore) throw new Error(/sconosciuto/.test(corpo.errore) ? "sconosciuto" : corpo.errore);
  return corpo.profumo!;
}

export default function SchedaPubblica({ onEntra }: { onEntra?: (modo: "entra" | "registrati") => void }) {
  const { id } = useParams();
  const n = Number(id);
  const { chi, entrato, dati, perId } = useDati();
  const persona = !!chi?.persona;
  const [esito, setEsito] = useState<Esito>({ p: null, errore: null });
  // chi è entrato: finché non si sa cosa c'è nella sua vetrina non si decide
  const aspetto = entrato && !onEntra && !dati;
  const mio = !onEntra && dati ? perId.get(n) : undefined;

  useEffect(() => {
    if (aspetto || mio || !Number.isInteger(n) || n <= 0) return;
    let vivo = true;
    setEsito({ p: null, errore: null });
    leggiScheda(n)
      .then((p) => vivo && setEsito({ p, errore: null }))
      .catch((e: Error) => vivo && setEsito({ p: null, errore: /fetch|network|load failed/i.test(e.message) || navigator.onLine === false ? "rete" : e.message }));
    return () => {
      vivo = false;
    };
  }, [n, aspetto, mio]);

  const p = esito.p;
  useTitolo(p ? `${p.name} · Sillage` : "Sillage");

  // il profumo è nella propria vetrina: la propria scheda, completa
  if (mio) return <Navigate to={`/profumo/${n}`} replace />;

  if (!p) {
    const testo =
      esito.errore === "rete"
        ? "Serve la rete per aprire la scheda di questo profumo."
        : esito.errore === "sconosciuto" || (!aspetto && (!Number.isInteger(n) || n <= 0))
          ? "In Sillage non c'è un profumo con questo numero."
          : esito.errore
            ? "Non riesco ad aprire la scheda: " + esito.errore
            : null;
    return (
      <section className="segnaposto scheda-pubblica">
        <Barra fuori={!!onEntra} />
        <h1 className="titolo-pagina">{testo ? "Scheda non aperta" : "Apro la scheda…"}</h1>
        <div className="filo-ottone" />
        {testo ? <p className="testo">{testo}</p> : null}
        {onEntra ? <Invito onEntra={onEntra} /> : null}
      </section>
    );
  }

  return (
    <article className={"scheda scheda-pubblica " + p.colore}>
      <div className="scheda-vetrina">
        <Barra fuori={!!onEntra} />
        <Testata p={p} />
      </div>
      <div className="scheda-dati">
        <DatiComuni p={p} />
        {p.desc ? (
          <Sezione titolo="Racconto">
            <p className="racconto">{p.desc}</p>
          </Sezione>
        ) : null}
        <div className="scheda-azioni">
          {persona ? <MettiInVetrina p={p} /> : null}
          {p.fragrantica ? (
            <a className="btn-filo esterno" href={p.fragrantica} target="_blank" rel="noopener noreferrer">
              Apri su Fragrantica
              <IconaFuori />
            </a>
          ) : null}
        </div>
        {onEntra ? <Invito onEntra={onEntra} /> : null}
      </div>
    </article>
  );
}

/** In alto: chi non è entrato vede il nome dell'app; chi è entrato torna alla sua Collezione. */
function Barra({ fuori }: { fuori: boolean }) {
  return (
    <div className="barra">
      {fuori ? (
        <span className="pubblica-marchio">Sillage</span>
      ) : (
        <Link className="torna" to="/">
          <IconaIndietro />
          Collezione
        </Link>
      )}
      <span className="pubblica-cosa">{fuori ? "Scheda del profumo" : "Non è nella tua vetrina"}</span>
    </div>
  );
}

/** Chi è entrato e non ha il profumo: lo prende da «Aggiungi profumo», con boccetta o campione e ml. */
function MettiInVetrina({ p }: { p: Profumo }) {
  const vai = useNavigate();
  return (
    <>
      <button type="button" className="btn-filo pieno largo" onClick={() => vai(`/aggiungi?id=${p.id}`)}>
        Mettilo nella mia vetrina
      </button>
      <p className="nota-piccola centro">Poi scegli boccetta o campione e i ml.</p>
    </>
  );
}

/** Chi non è entrato: l'invito ad avere la propria vetrina, con lo stesso account di CheMetto. */
function Invito({ onEntra }: { onEntra: (modo: "entra" | "registrati") => void }) {
  // entrato con un account di CheMetto che non ha ancora una vetrina: gli manca solo il nome
  const { entrato } = useDati();
  if (entrato)
    return (
      <aside className="pubblica-invito" aria-labelledby="t-invito">
        <h2 id="t-invito">Vuoi la tua vetrina?</h2>
        <p>Il tuo account c'è già: scegli il nome con cui comparire e avrai la tua vetrina.</p>
        <button type="button" className="btn-filo pieno largo" onClick={() => onEntra("entra")}>
          Crea la mia vetrina
        </button>
      </aside>
    );
  return (
    <aside className="pubblica-invito" aria-labelledby="t-invito">
      <h2 id="t-invito">Vuoi la tua vetrina?</h2>
      <p>Sillage tiene i tuoi profumi, ti dice cosa mettere oggi e si ricorda cosa hai messo.</p>
      <button type="button" className="btn-filo pieno largo" onClick={() => onEntra("entra")}>
        Entra con il tuo account di CheMetto
      </button>
      <p className="ingresso-cambio">
        Non hai un account?{" "}
        <button type="button" onClick={() => onEntra("registrati")}>
          Registrati
        </button>
      </p>
    </aside>
  );
}
