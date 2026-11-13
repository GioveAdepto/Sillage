import type { Profumo, Ricetta } from "../tipi";
import { adesso } from "../profumo";
import { inizioPer, type Occasione, type Quando } from "../consiglio";
import { indiceStrati, partiRicetta } from "./calcoli";
import type { Meteo } from "../meteo";

/* «Se vuoi osare, con…» (ricettaPer in js/consigliami.js): sotto il primo consiglio, la ricetta di layering
   che lo contiene più adatta all'occasione e alla stagione. Non tocca la classifica; prima-dopo.mjs la confronta. */
const TAG_PER_OCCASIONE: Record<string, string[]> = {
  ufficio: ["uff"], quotidiano: ["casa", "uff"], appuntamento: ["app", "sera"], formale: ["sera"], casa: ["casa"], festivita: ["sera"], palestra: []
};

export function ricettaPer(p: Profumo, occ: Occasione, quando: Quando | Date, layering: Ricetta[], perId: Map<number, Profumo>, meteo: Meteo | null = null) {
  const st = adesso(inizioPer(quando, occ), meteo).stagione,
    adatta = (g: string) => (st === "pe" ? !/autunno|inverno/i.test(g) : !/estate/i.test(g));
  const r = (indiceStrati(layering).get(p.id) || [])
    .map((x) => ({ ...x, l: layering[x.i] }))
    .map((x) => ({ ...x, s: Number((TAG_PER_OCCASIONE[occ] || []).includes(String(x.l.t))) * 2 + Number(adatta(String(x.l.g))) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const scelta = r[0];
  if (!scelta) return null;
  // l'altro profumo della coppia
  const altroId = [...String(scelta.l.s).matchAll(/№\s*(\d+)/g)].map((m) => +m[1]).find((id) => id !== p.id);
  const altro = altroId != null ? perId.get(altroId) ?? null : null;
  return { i: scelta.i, nome: scelta.nome, altro, parti: partiRicetta(scelta.l, perId) };
}
