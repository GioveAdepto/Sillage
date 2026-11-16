/* Dal modulo di «Aggiungi profumo» alle colonne del catalogo, e le proposte che chi aggiunge può cambiare:
   stagione e momento dalle percentuali, colore dagli accordi, occasioni dai profumi più simili della vetrina.
   Niente React: lo usano anche le prove. */
import type { Profumo } from "../tipi";

export const OCCASIONI = ["quotidiano", "ufficio", "serata", "appuntamento", "formale", "informale", "palestra", "casa", "festivita"] as const;
export type Occ = (typeof OCCASIONI)[number];
export const NOMI_OCC: Record<Occ, string> = {
  quotidiano: "Quotidiano", ufficio: "Ufficio", serata: "Serata", appuntamento: "Appuntamento", formale: "Formale",
  informale: "Informale", palestra: "Palestra", casa: "Casa", festivita: "Festività"
};
export const CONCENTRAZIONI = ["EDT", "EDP", "Parfum", "Extrait", "EDC", "Altro"];
export const STAG = ["inverno", "primavera", "estate", "autunno"] as const;
export type Colore = "blu" | "verde" | "rosso";

export interface Modulo {
  nome: string;
  marchio: string;
  conc: string;
  genere: string;
  voto: string;
  voti: string;
  durata: string;
  scia: string;
  accordi: { nome: string; forza: string }[];
  stagioni: Record<(typeof STAG)[number], string>;
  giorno: string;
  occasioni: Occ[];
  colore: Colore;
  famiglia: string;
  note: string[];
  piramide: { testa: string[]; cuore: string[]; fondo: string[] };
  fragrantica: string;
}

export const moduloVuoto = (): Modulo => ({
  nome: "", marchio: "", conc: "", genere: "", voto: "", voti: "", durata: "", scia: "",
  accordi: Array.from({ length: 5 }, () => ({ nome: "", forza: "" })),
  stagioni: { inverno: "", primavera: "", estate: "", autunno: "" }, giorno: "",
  occasioni: [], colore: "verde", famiglia: "", note: [], piramide: { testa: [], cuore: [], fondo: [] }, fragrantica: ""
});

const num = (s: string) => {
  const n = Number(String(s).replace(",", ".").replace(/[^\d.]/g, ""));
  return String(s).trim() !== "" && Number.isFinite(n) ? n : null;
};

/** ai / pe / tutto: due stagioni che insieme fanno almeno il 60%. Tarata sui 41 profumi: 41 su 41. */
export function stagioneDa(m: Modulo) {
  const v = (k: (typeof STAG)[number]) => num(m.stagioni[k]) ?? 0;
  if (v("autunno") + v("inverno") >= 60) return "ai";
  if (v("primavera") + v("estate") >= 60) return "pe";
  return "tutto";
}
/** giorno / sera / entrambi dal giorno in %. Tarata sui 41 profumi. */
export function momentoDa(m: Modulo) {
  const g = num(m.giorno);
  if (g === null) return "entrambi";
  return g >= 64 ? "giorno" : g <= 44 ? "sera" : "entrambi";
}
const FRESCHI = /marino|acquatic|ozon|agrumat|fresc|lavanda|verde|menta/i;
const CALDI = /ambra|vanigl|dolce|speziato caldo|cuoi|oud|tabacc|balsam|gourmand|caramell|miele|cannella/i;
/** Il colore della famiglia: caldo (rosso) se fra i primi tre accordi c'è qualcosa di caldo, fresco (blu) se il
    primo è fresco, altrimenti verde. Una proposta: la scheda la mostra e si cambia con un tocco. */
export function coloreDa(accordi: string[]): Colore {
  const tre = accordi.slice(0, 3).join(" ");
  if (CALDI.test(tre)) return "rosso";
  if (accordi[0] && FRESCHI.test(accordi[0])) return "blu";
  return "verde";
}

/** Le occasioni: quelle dei profumi più simili della propria vetrina (per accordi); se la vetrina è vuota, regole semplici. */
export function occasioniDa(accordi: string[], colore: Colore, vetrina: Profumo[]): Occ[] {
  const peso = (lista: string[]) => new Map(lista.map((a, i) => [a.toLowerCase(), 5 - i]));
  const mio = peso(accordi.filter(Boolean));
  const simili = vetrina
    .map((p) => {
      const suo = peso(p.accordi || []);
      let s = 0;
      mio.forEach((w, a) => (s += Math.min(w, suo.get(a) ?? 0)));
      return { p, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  if (simili.length >= 2)
    return OCCASIONI.filter((o) => simili.filter(({ p }) => p[o] === "si" || p[o] === "si-mod").length * 2 > simili.length);
  const base: Occ[] = ["quotidiano", "informale"];
  if (colore !== "rosso") base.push("ufficio");
  if (colore === "blu") base.push("palestra");
  if (colore === "rosso") base.push("serata", "appuntamento");
  return OCCASIONI.filter((o) => base.includes(o));
}

/** «Testa: a, b · Cuore: c · Fondo: d», come nel catalogo. */
export const piramideTesto = (p: Modulo["piramide"]) =>
  (
    [
      ["Testa", p.testa],
      ["Cuore", p.cuore],
      ["Fondo", p.fondo]
    ] as const
  )
    .filter(([, v]) => v.length)
    .map(([k, v]) => k + ": " + v.join(", ").toLowerCase())
    .join(" · ");

/** Le colonne del catalogo (nomi del foglio) per una scheda nuova. Le vuote restano vuote: Consigliami salta un
    profumo senza stagioni, Numeri e filtri reggono i campi vuoti. */
export function scheda(m: Modulo): Record<string, string> {
  const accordi = m.accordi.filter((a) => a.nome.trim());
  const st = STAG.map((k) => num(m.stagioni[k]));
  const s: Record<string, string> = {
    marchio: m.marchio.trim(),
    profumo: m.nome.trim(),
    concentrazione: m.conc,
    genere: m.genere,
    famiglia: m.famiglia.trim(),
    accordi: accordi.map((a) => a.nome.trim()).join("|"),
    accordi_forza: accordi.every((a) => num(a.forza) !== null) ? accordi.map((a) => String(Math.round(num(a.forza)!))).join("|") : "",
    note: m.note.filter(Boolean).join("|"),
    piramide: piramideTesto(m.piramide),
    longevita_h: num(m.durata) !== null ? String(num(m.durata)) : "",
    sillage: m.scia.trim(),
    giorno_pct: num(m.giorno) !== null ? String(Math.round(num(m.giorno)!)) : "",
    rating: num(m.voto) !== null ? String(num(m.voto)) : "",
    voti: num(m.voti) !== null ? String(Math.round(num(m.voti)!)) : "",
    stagione: st.some((v) => v !== null) ? stagioneDa(m) : "",
    momento: momentoDa(m),
    colore: m.colore,
    fragrantica: m.fragrantica.trim()
  };
  STAG.forEach((k, i) => (s[k] = st[i] !== null ? String(Math.round(st[i]!)) : ""));
  OCCASIONI.forEach((o) => (s[o] = m.occasioni.includes(o) ? "si" : "no"));
  return s;
}

/** Quello che non torna, campo per campo (in ambra nella pagina). */
export function dubbi(m: Modulo, accordiMisurati?: number): Record<string, string> {
  const d: Record<string, string> = {};
  if (!m.conc) d.conc = "Non è scritta nella cartolina: sceglila tu.";
  const v = num(m.voto);
  if (m.voto && (v === null || v < 1 || v > 5)) d.voto = "Il voto va da 1 a 5.";
  const g = num(m.giorno);
  if (m.giorno && (g === null || g < 0 || g > 100)) d.giorno = "Fra 0 e 100.";
  const somma = STAG.reduce((a, k) => a + (num(m.stagioni[k]) ?? 0), 0);
  if (STAG.some((k) => m.stagioni[k]) && Math.abs(somma - 100) > 2) d.stagioni = `Fanno ${somma} invece di 100.`;
  const nomi = m.accordi.filter((a) => a.nome.trim()).length;
  if (accordiMisurati !== undefined && nomi && nomi !== accordiMisurati)
    d.accordi = `Ho misurato ${accordiMisurati} barre ma letto ${nomi} nomi: controllali sulla cartolina.`;
  return d;
}
