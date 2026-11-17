/* Il profumo per l'outfit di CheMetto (ponte/LEGGIMI.md, «CheMetto»).

   Il consiglio è quello di Consigliami: lo stesso codice (app/src/consiglio.ts), sui profumi della persona,
   con stagione, occasione e giorno/sera. L'outfit (i colori dei capi) conta solo a PARI MERITO: dentro un
   gruppo di profumi con punteggi a meno di SOGLIA dal primo del gruppo, uno passa avanti solo se si abbina
   chiaramente meglio (almeno SCARTO in più). Senza colori la classifica è identica a quella di Sillage:
   lo controlla app/strumenti/prova-outfit.mjs.

   L'ORA. Il Worker di Cloudflare vive in UTC, Consigliami legge l'ora con getHours(). Il ponte quindi
   «sposta» l'orologio: un istante la cui ora UTC è l'ora del telefono (fuso in minuti, mandato da CheMetto).
   Il meteo di Open-Meteo arriva già nell'ora del posto («2026-11-17T08:00»), che il Worker legge come UTC:
   tutto torna. Chi lo prova in Node deve girare con TZ=UTC (la prova lo fa da sola). */
import { candidati, maiuscola, profiloAccordi, ORA_PER_OCCASIONE, eOccasione, type Candidato, type Occasione } from "../app/src/consiglio";
import { eCampione } from "../app/src/profumo";
import { scaricaMeteo, type Meteo } from "../app/src/meteo";
import type { Profumo } from "../app/src/tipi";

export const SOGLIA = 0.25; // pari merito: meno di un quarto di punto (circa 0,17 di voto su Fragrantica)
export const SCARTO = 0.1; // quanto meglio deve abbinarsi per passare avanti
export const QUANTI = 3;

type Momento = "giorno" | "sera";

/* «Dove vai?» di CheMetto (src/lib/occasioni.ts) → l'occasione di Sillage e il momento. */
export const DA_CHEMETTO: Record<string, [Occasione, Momento]> = {
  casual: ["quotidiano", "giorno"],
  lavoro: ["ufficio", "giorno"],
  uscita: ["quotidiano", "giorno"],
  elegante: ["formale", "giorno"],
  evento: ["formale", "giorno"],
  aperitivo: ["quotidiano", "sera"],
  ristorante: ["appuntamento", "sera"],
  amici: ["quotidiano", "sera"],
  appuntamento: ["appuntamento", "sera"],
  cinema: ["quotidiano", "sera"],
  concerto: ["quotidiano", "sera"],
  sport: ["palestra", "giorno"],
  trekking: ["palestra", "giorno"]
};

export interface Richiesta {
  /** la situazione di CheMetto («lavoro», «aperitivo»…) oppure direttamente un'occasione di Sillage */
  situazione?: string | null;
  occasione?: string | null;
  momento?: string | null;
  quando?: "oggi" | "domani";
  /** minuti da UTC del telefono (in Italia 60 d'inverno, 120 d'estate) */
  fuso?: number;
  /** i colori dei capi dell'outfit, «#rrggbb» */
  colori?: string[];
}

/** L'ora del telefono, come istante «spostato» (vedi sopra). */
export const oraLocale = (fuso: number, ora = Date.now()) => new Date(ora + fuso * 6e4);
export const dataISO = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** Occasione, momento e da quando starà sulla pelle. */
export function contesto(r: Richiesta, ora = Date.now()) {
  const sit = DA_CHEMETTO[String(r.situazione || "")];
  const occ: Occasione = eOccasione(r.occasione) ? r.occasione : sit ? sit[0] : "quotidiano";
  const mo: Momento = r.momento === "sera" || r.momento === "giorno" ? r.momento : sit ? sit[1] : "giorno";
  const adesso = oraLocale(Number(r.fuso) || 0, ora);
  let da = new Date(adesso);
  if (r.quando === "domani") {
    da.setDate(da.getDate() + 1);
    // l'ora dell'occasione, come «Domani» in Consigliami; per la sera non prima delle 19
    const h = ORA_PER_OCCASIONE[occ] ?? 9;
    da.setHours(mo === "sera" ? Math.max(h, 19) : h, 0, 0, 0);
  } else if (mo === "sera" && da.getHours() < 19 && da.getHours() >= 5) da.setHours(19, 0, 0, 0);
  // di giorno, oggi: adesso, come «Oggi» in Consigliami
  else da = adesso;
  return { occ, mo, da, oggi: dataISO(adesso) };
}

// ── l'abbinamento ai colori dei capi ─────────────────────────────────────
type Raggio = "acqua" | "agrume" | "bosco" | "spezia" | "fumo" | "dolce" | "cipria";
type Tono = "scuro-caldo" | "scuro" | "chiaro-caldo" | "pastello" | "chiaro" | "verde" | "blu" | "caldo" | "viola";
const AFFINI: Record<Tono, Partial<Record<Raggio, number>>> = {
  "scuro-caldo": { spezia: 1, fumo: 1, dolce: 0.6, bosco: 0.6 },
  scuro: { bosco: 1, fumo: 0.7, spezia: 0.4, acqua: 0.3 },
  "chiaro-caldo": { agrume: 1, cipria: 0.7, dolce: 0.5 },
  pastello: { cipria: 1, dolce: 0.5, agrume: 0.3 },
  chiaro: { acqua: 1, agrume: 0.8, bosco: 0.3 },
  verde: { bosco: 1, agrume: 0.4 },
  blu: { acqua: 0.8, bosco: 0.6 },
  caldo: { spezia: 1, dolce: 0.5, fumo: 0.4 },
  viola: { cipria: 0.7, dolce: 0.6 }
};
const FRASE_TONO: Record<Tono, string> = {
  "scuro-caldo": "i toni scuri e caldi", scuro: "i toni scuri", "chiaro-caldo": "i toni chiari e caldi",
  pastello: "i toni pastello", chiaro: "i colori chiari e freschi", verde: "i verdi", blu: "i blu",
  caldo: "i toni caldi", viola: "i viola"
};

function hsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16),
    r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}
/** Il tono di un colore; null per i grigi di mezzo, che stanno con tutto e non dicono niente. */
export function tonoDi(hex: string): Tono | null {
  const c = hsl(hex);
  if (!c) return null;
  const { h, s, l } = c;
  const caldo = s >= 0.15 && (h < 60 || h >= 330);
  if (l < 0.3) return caldo ? "scuro-caldo" : "scuro";
  if (l > 0.7) {
    if (s >= 0.25 && (h >= 280 || h < 15)) return "pastello";
    return caldo ? "chiaro-caldo" : "chiaro";
  }
  if (s < 0.15) return null;
  if (h >= 70 && h < 170) return "verde";
  if (h >= 170 && h < 260) return "blu";
  if (h >= 260 && h < 330) return "viola";
  return "caldo";
}

/** Quello che l'outfit chiede, sui raggi degli accordi (somma 1), e il tono che pesa di più. Null = neutro. */
export function richiestaOutfit(colori: string[] | undefined | null) {
  const o: Record<Raggio, number> = { acqua: 0, agrume: 0, bosco: 0, spezia: 0, fumo: 0, dolce: 0, cipria: 0 };
  const conta: Partial<Record<Tono, number>> = {};
  for (const c of colori || []) {
    const t = tonoDi(c);
    if (!t) continue;
    conta[t] = (conta[t] || 0) + 1;
    for (const [k, w] of Object.entries(AFFINI[t])) o[k as Raggio] += w!;
  }
  const tot = Object.values(o).reduce((a, b) => a + b, 0);
  if (!tot) return null;
  (Object.keys(o) as Raggio[]).forEach((k) => (o[k] /= tot));
  const tono = (Object.keys(conta) as Tono[]).reduce((a, k) => (conta[k]! > conta[a]! ? k : a));
  return { o, tono };
}

/** Quanto un profumo si abbina all'outfit, da 0 a 1. */
export function abbinamento(p: Profumo, o: Record<Raggio, number>) {
  const q = profiloAccordi(p) as Record<Raggio, number>,
    max = Math.max(...Object.values(o));
  return max ? (Object.keys(o) as Raggio[]).reduce((a, k) => a + (q[k] || 0) * o[k], 0) / max : 0;
}

/** La classifica di Sillage, con l'abbinamento solo a pari merito. Senza colori resta quella di Sillage. */
export function ordinaConOutfit(lista: Candidato[], colori?: string[] | null) {
  const ri = richiestaOutfit(colori);
  if (!ri) return { lista: lista.map((c) => ({ c, abb: null as number | null })), tono: null };
  const conAbb = lista.map((c) => ({ c, abb: abbinamento(c.p, ri.o) }));
  const fuori: typeof conAbb = [];
  for (let i = 0; i < conAbb.length; ) {
    // il gruppo dei pari merito: tutti a meno di SOGLIA dal primo del gruppo
    let j = i + 1;
    while (j < conAbb.length && conAbb[i].c.s - conAbb[j].c.s < SOGLIA) j++;
    const gruppo = conAbb.slice(i, j);
    while (gruppo.length) {
      // passa avanti solo chi si abbina chiaramente meglio del primo di Sillage rimasto
      const meglio = gruppo.reduce((a, x) => (x.abb! > a.abb! ? x : a));
      const scelto = meglio.abb! - gruppo[0].abb! >= SCARTO ? meglio : gruppo[0];
      fuori.push(scelto);
      gruppo.splice(gruppo.indexOf(scelto), 1);
    }
    i = j;
  }
  return { lista: fuori, tono: ri.tono };
}

/** Il consiglio per CheMetto, sui profumi di una persona. Puro: niente rete, niente database. */
export function consiglioPerOutfit(profumi: Profumo[], r: Richiesta, meteo: Meteo | null, ora = Date.now()) {
  const cx = contesto(r, ora);
  const lista = candidati(profumi, cx.occ, cx.da, { meteo });
  const { lista: ordinata, tono } = ordinaConOutfit(lista, r.colori);
  const consigli = ordinata.slice(0, QUANTI).map(({ c, abb }) => ({
    id: c.p.id,
    pro: c.pro.map(maiuscola),
    contro: c.contro.map(maiuscola),
    abbinamento: tono && abb !== null && abb >= 0.7 ? `Si sposa con ${FRASE_TONO[tono]} dell'outfit` : null,
    punteggio: Math.round(c.s * 100) / 100
  }));
  return { occasione: cx.occ, momento: cx.mo, oggi: cx.oggi, consigli, classifica: ordinata.map((x) => x.c.p.id) };
}

/** Il meteo per il consiglio: Open-Meteo, come Consigliami, ma con un tempo massimo; senza, vale il calendario. */
export async function meteoPer(lat: number, lon: number, ms = 1500): Promise<Meteo | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const posto = { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 };
  let ferma: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      scaricaMeteo(posto),
      new Promise<null>((r) => (ferma = setTimeout(() => r(null), ms)))
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(ferma);
  }
}

/** Le voci brevi di un profumo per CheMetto: nome, marca, foto (indirizzo intero). */
export const vocePerCheMetto = (p: Profumo, base: string) => ({
  id: p.id,
  marca: p.brand,
  nome: p.name,
  conc: p.conc || "",
  campione: eCampione(p),
  img: p.img ? new URL(p.img, base).href : null
});
