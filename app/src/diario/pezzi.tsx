import { Link } from "react-router";
import type { Profumo } from "../tipi";
import { diario } from "../ponte";
import { oggiISO, ruoloStrato, type Voce } from "./coda";
import { useDiario, useSegna } from "./uso";
import { OCCASIONI, occasioneProbabile, type Occasione } from "../consiglio";
import { adesso } from "../profumo";
import { useMeteo } from "../meteo-contesto";
import { IconaSi } from "../componenti/Icone";

/* I pezzi del diario usati da più pagine: «Lo metto oggi», occasione e momento di una voce, «Su di te». */

export const NOME_OCC: Record<string, string> = Object.fromEntries(OCCASIONI);
export const testoUso = (v?: Voce) =>
  v
    ? [NOME_OCC[v.occasione || ""], v.momento === "sera" ? "sera" : v.momento === "giorno" ? "giorno" : ""]
        .filter(Boolean)
        .join(", ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : "";
export const quandoFu = (g: number) =>
  g === 0 ? "oggi" : g === 1 ? "ieri" : g < 45 ? `${g} giorni fa` : g < 365 ? `${Math.round(g / 30)} mesi fa` : "più di un anno fa";

const IconaGoccia = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M9 3h6M10 3v3h4V3M8 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <path d="M8 13h8" />
  </svg>
);
const IconaSole = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
);
const IconaLuna = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);

/** Occasione e momento di una voce (o di tutta la coppia, se è un layering). Si cambiano con un tocco. */
export function SceltaUso({ voci }: { voci: Voce[] }) {
  if (!voci.length) return null;
  const v = voci[0];
  const cambia = (campo: "occasione" | "momento", valore: string) => voci.forEach((x) => diario.aggiornaVoce(String(x.t), { [campo]: valore }));
  return (
    <div className="uso-voce">
      <label className="uso-occ">
        <span className="vh">Occasione</span>
        <select value={v.occasione || ""} onChange={(e) => cambia("occasione", e.target.value)}>
          <option value="">Occasione…</option>
          {OCCASIONI.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <span className="uso-mom" role="group" aria-label="Momento">
        {(
          [
            ["giorno", "Di giorno", <IconaSole key="s" />],
            ["sera", "Di sera", <IconaLuna key="l" />]
          ] as const
        ).map(([k, n, ic]) => (
          <button key={k} type="button" aria-pressed={v.momento === k} aria-label={n} title={n} onClick={() => cambia("momento", v.momento === k ? "" : k)}>
            {ic}
          </button>
        ))}
      </span>
    </div>
  );
}

/** «Lo metto oggi»: nella scheda e in Consigliami. `uso`: occasione e momento (da Consigliami), altrimenti i più probabili. */
export function LoMetto({ p, uso, compatto = false }: { p: Profumo; uso?: { occasione: Occasione; momento: "giorno" | "sera" }; compatto?: boolean }) {
  const { diario: d } = useDiario();
  const { meteo } = useMeteo();
  const segna = useSegna();
  const oggi = oggiISO();
  const indossato = d.indossatoOggi(p.id);
  const lay = indossato ? d.layeringDel(oggi) : null;
  const inLay = !!lay && (lay.sotto === p.id || lay.sopra === p.id);
  const metti = () =>
    segna(p.id, oggi, uso ?? { occasione: occasioneProbabile("oggi", meteo), momento: adesso(new Date(), meteo).momento });
  if (compatto)
    return (
      <button type="button" className={"metto-piccolo" + (indossato ? " fatto" : "")} aria-pressed={indossato} onClick={metti}>
        {indossato ? "Segnato" : "Lo metto"}
      </button>
    );
  const n = d.giorniDi(p.id).length,
    g = d.giorniDa(p.id);
  const voceOggi = d.vociDelGiorno(oggi).find((v) => +v.id === p.id && !ruoloStrato(v));
  return (
    <div className="lo-metto">
      <button type="button" className={"indossa" + (indossato ? " fatto" : "")} aria-pressed={indossato} onClick={metti}>
        {indossato ? (
          <span className="si">
            <IconaSi />
            {inLay ? "In layering oggi" : "Indossato oggi"}
          </span>
        ) : (
          <span className="no">
            <IconaGoccia />
            Lo metto oggi
          </span>
        )}
      </button>
      <p className="lo-metto-nota">
        {n ? `${n} ${n === 1 ? "volta" : "volte"} · l'ultima ${quandoFu(g ?? 0)}` : "Mai segnato nel diario"}
        {voceOggi ? (
          <>
            {" · "}
            <Link className="collegamento" to={`/diario?giorno=${oggi}&appunto=${voceOggi.t}`}>
              {voceOggi.nota || voceOggi.voto ? "Modifica l'appunto" : "Aggiungi un appunto"}
            </Link>
          </>
        ) : null}
      </p>
      {indossato ? <SceltaUso voci={d.vociUso(p.id, oggi)} /> : null}
    </div>
  );
}

export const stelle = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** Nella scheda: com'è andato su di te, dagli appunti, e dove lo porti di solito. Non entra in nessun punteggio. */
export function SuDiTe({ p }: { p: Profumo }) {
  const { diario: d } = useDiario();
  const tutte = d.voci().filter((x) => +x.id === p.id);
  const conAppunto = tutte.filter((x) => x.voto || x.nota).sort((a, b) => (a.data < b.data ? 1 : -1));
  const voti = conAppunto.filter((x) => x.voto).map((x) => +x.voto!);
  const media = voti.length ? voti.reduce((a, b) => a + b, 0) / voti.length : 0;
  const ultima = conAppunto.find((x) => x.nota);
  const conOcc = tutte.filter((x) => x.occasione);
  let abituale = "";
  if (conOcc.length >= 2) {
    const conta: Record<string, number> = {};
    conOcc.forEach((x) => (conta[x.occasione!] = (conta[x.occasione!] || 0) + 1));
    const [occ, n] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
    const sere = conOcc.filter((x) => x.momento === "sera").length,
      giorni = conOcc.filter((x) => x.momento === "giorno").length;
    abituale = `${NOME_OCC[occ]?.toLowerCase() ?? occ}${sere > giorni ? ", di sera" : giorni > sere ? ", di giorno" : ""} · ${n} su ${conOcc.length}`;
  }
  if (!media && !ultima && !abituale) return null;
  return (
    <dl className="su-di-te">
      {media ? (
        <div>
          <dt>Voto tuo</dt>
          <dd>
            <span className="stelle" aria-hidden="true">
              {stelle(Math.round(media))}
            </span>{" "}
            {media.toLocaleString("it-IT", { maximumFractionDigits: 1 })}
            <small>
              {" "}
              · {voti.length} {voti.length === 1 ? "volta" : "volte"}
            </small>
          </dd>
        </div>
      ) : null}
      {ultima ? (
        <div>
          <dt>L'ultimo appunto</dt>
          <dd className="citazione-piccola">«{ultima.nota}»</dd>
        </div>
      ) : null}
      {abituale ? (
        <div>
          <dt>Di solito</dt>
          <dd>{abituale}</dd>
        </div>
      ) : null}
    </dl>
  );
}
