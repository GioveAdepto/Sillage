import type { Profumo } from "../tipi";
import { aggiuntoIl, eCampione, eNovita, piega, type Adesso } from "../profumo";

/* Filtri, scelte rapide e ordinamenti della Collezione, portati da js/collezione.js (passa, selezione, quanti),
   js/consigliami.js (gruppiFiltro) e js/dati.js (ordinamenti, etichetteFiltro). Niente React: li usa anche
   strumenti/verifica-filtri.mjs. I filtri si sommano (tutti devono valere); le note olfattive no: ne basta una. */

export const ETICHETTE_FILTRO: Record<string, string> = {
  pe: "Primavera / Estate", ai: "Autunno / Inverno", tutto: "Tutto l'anno", ufficio: "Ufficio", appuntamento: "Appuntamento",
  quotidiano: "Quotidiano", informale: "Informale", formale: "Formale", palestra: "Palestra", casa: "In casa", festivita: "Festività",
  blu: "Acquatici", verde: "Legnosi", rosso: "Orientali", sera: "Solo sera", giorno: "Solo giorno", dupe: "Cloni e dupe",
  adesso: "Adatti adesso", recenti: "Aggiunti di recente"
};
export const GRUPPI_FILTRO: { t: string; v: [string, string][] }[] = [
  { t: "Stagione", v: [["pe", "Primavera / Estate"], ["ai", "Autunno / Inverno"], ["tutto", "Tutto l'anno"]] },
  {
    t: "Occasione",
    v: [["ufficio", "Ufficio"], ["appuntamento", "Appuntamento"], ["quotidiano", "Quotidiano"], ["informale", "Informale"],
      ["formale", "Formale"], ["palestra", "Palestra"], ["casa", "In casa"], ["festivita", "Festività"]]
  },
  { t: "Famiglia", v: [["blu", "Acquatici e freschi"], ["verde", "Aromatici e legnosi"], ["rosso", "Orientali e intensi"]] },
  { t: "Momento", v: [["giorno", "Solo giorno"], ["sera", "Solo sera"], ["adesso", "Adatti adesso"]] },
  { t: "Provenienza", v: [["dupe", "Cloni e dupe"], ["recenti", "Aggiunti di recente"]] }
];
export const FILTRI_VALIDI = new Set(GRUPPI_FILTRO.flatMap((g) => g.v.map(([k]) => k)));

export const ORDINAMENTI: { k: string; lbl: string; fn: (p: Profumo) => string | number }[] = [
  { k: "alpha", lbl: "Nome A → Z", fn: (p) => p.name.toLowerCase() },
  { k: "brand", lbl: "Marchio A → Z", fn: (p) => p.brand.toLowerCase() + p.name },
  { k: "rating", lbl: "Rating più alto", fn: (p) => -(p.rating || 0) },
  { k: "famiglia", lbl: "Famiglia olfattiva", fn: (p) => p.famiglia.toLowerCase() },
  { k: "stagione", lbl: "Stagione", fn: (p) => ({ pe: 0, tutto: 1, ai: 2 } as Record<string, number>)[p.stagione] ?? 3 },
  { k: "longevita", lbl: "Longevità più lunga", fn: (p) => -(p.longevita || 0) },
  { k: "id", lbl: "Numero di catalogo", fn: (p) => p.id },
  { k: "recenti", lbl: "Aggiunti di recente", fn: (p) => -(aggiuntoIl(p)?.getTime() || 0) }
];
/** L'ordine con cui si apre la vetrina: per numero di catalogo, come nella tavola dell'anteprima scelta. */
export const ORDINE_DI_PARTENZA = "id";

export interface Scelte {
  filtri: Set<string>;
  note: Set<string>;
  cerca: string;
}

/** Il cuore del filtro, come passa() nell'app di oggi. `a`: adesso() (stagione e momento, col meteo se c'è). */
export function passa(p: Profumo, s: Scelte, a: Pick<Adesso, "stagione" | "momento">, oggi = Date.now()): boolean {
  // «hermes» trova Hermès, «gio» trova Giò: accenti e maiuscole non contano
  const q = piega(s.cerca.trim());
  if (q && ![p.brand, p.name, p.note, p.famiglia, p.accordi.join(" "), p.dupe || "", (p.noteElenco || []).join(" ")].some((t) => piega(t).includes(q)))
    return false;
  for (const f of s.filtri) {
    if (f === "adesso") {
      if (p.stagione !== a.stagione && p.stagione !== "tutto") return false;
      if (p.momento !== a.momento && p.momento !== "entrambi") return false;
      continue;
    }
    if (f === "pe" && p.stagione !== "pe" && p.stagione !== "tutto") return false;
    if (f === "ai" && p.stagione !== "ai" && p.stagione !== "tutto") return false;
    if (f === "tutto" && p.stagione !== "tutto") return false;
    if ((f === "blu" || f === "verde" || f === "rosso") && p.colore !== f) return false;
    for (const occ of ["ufficio", "appuntamento", "quotidiano", "informale", "formale", "palestra", "casa", "festivita"])
      if (f === occ && p[occ as keyof Profumo] !== "si") return false;
    if (f === "sera" && p.momento !== "sera") return false;
    if (f === "giorno" && p.momento !== "giorno") return false;
    if (f === "dupe" && !p.dupe) return false;
    if (f === "recenti" && !eNovita(p, oggi)) return false;
  }
  if (s.note.size) {
    let trovata = false;
    for (const n of s.note) {
      if (p.note.toLowerCase().includes(n) || p.accordi.join(" ").toLowerCase().includes(n)) {
        trovata = true;
        break;
      }
    }
    if (!trovata) return false;
  }
  return true;
}

function ordina(lista: Profumo[], ordine: string) {
  const fn = (ORDINAMENTI.find((o) => o.k === ordine) ?? ORDINAMENTI.find((o) => o.k === ORDINE_DI_PARTENZA)!).fn;
  return lista.sort((x, y) => {
    const va = fn(x),
      vb = fn(y);
    return typeof va === "number" ? va - (vb as number) : va < vb ? -1 : va > vb ? 1 : 0;
  });
}

/** La vetrina filtrata e ordinata; con un filtro o una ricerca attivi, nella vetrina delle boccette anche i
    campioni che rispondono («Anche tra i campioni»): la domanda è «cosa ho per questo». */
export function selezione(profumi: Profumo[], vetrina: "boccette" | "campioni", s: Scelte, ordine: string, a: Pick<Adesso, "stagione" | "momento">, oggi = Date.now()) {
  const inVetrina = profumi.filter((p) => (vetrina === "campioni" ? eCampione(p) : !eCampione(p)));
  const lista = ordina(inVetrina.filter((p) => passa(p, s, a, oggi)), ordine);
  const cercando = s.filtri.size || s.note.size || s.cerca.trim();
  const extra =
    vetrina === "boccette" && cercando ? ordina(profumi.filter(eCampione).filter((p) => passa(p, s, a, oggi)), ordine) : [];
  return { lista, extra, tot: inVetrina.length };
}

/** Quante ne resterebbero aggiungendo un filtro (i contatori delle scelte rapide e del cassetto). */
export function quantiCon(profumi: Profumo[], vetrina: "boccette" | "campioni", s: Scelte, a: Pick<Adesso, "stagione" | "momento">, f?: string, nota?: string, oggi = Date.now()) {
  const filtri = new Set(s.filtri),
    note = new Set(s.note);
  if (f) filtri.add(f);
  if (nota) note.add(nota);
  return profumi.filter((p) => (vetrina === "campioni" ? eCampione(p) : !eCampione(p))).filter((p) => passa(p, { filtri, note, cerca: s.cerca }, a, oggi)).length;
}
