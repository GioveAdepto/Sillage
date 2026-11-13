import type { Profumo, Ricetta } from "../tipi";
import { aggiuntoIl, chiaveNome, eCampione, eNovita, livelloResiduo, originaleDi } from "../profumo";
import { profiloAccordi } from "../consiglio";

/* I calcoli delle viste di js/viste.js (Numeri, mappa olfattiva, Guida, Layering, Acquisti, Confronto),
   riscritti uno per uno, senza React: strumenti/verifica-viste.mjs li confronta con l'app di oggi.
   Stessi dati, stessi numeri, nessuna regola nuova. */

export interface VoceDiario {
  data: string;
  id: number | string;
  t: string;
}

const boccetteDi = (profumi: Profumo[]) => profumi.filter((p) => !eCampione(p));
const campioniDi = (profumi: Profumo[]) => profumi.filter(eCampione);
const maiuscola = (t: string) => t.replace(/^./, (c) => c.toUpperCase());
const isoDi = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** Le occasioni come le elenca l'app di oggi (usoLabels in js/dati.js: senza «serata»). */
export const USO_LABELS: [string, string][] = [
  ["ufficio", "Ufficio"], ["quotidiano", "Quotidiano"], ["informale", "Informale"], ["formale", "Formale"],
  ["appuntamento", "Appuntamento"], ["palestra", "Palestra"], ["casa", "In casa"], ["festivita", "Festività"]
];
export const VETRO_NOME: Record<string, string> = { blu: "Acquatici e freschi", verde: "Aromatici e legnosi", rosso: "Orientali e intensi" };
export const stagLbl = (s: string) => (s === "pe" ? "Primavera / Estate" : s === "ai" ? "Autunno / Inverno" : "Tutto l'anno");
export const stagBreve = (s: string) => (s === "pe" ? "P/E" : s === "ai" ? "A/I" : "tutto l'anno");

// ── NUMERI ────────────────────────────────────────────────────────────────
export interface Numeri {
  boccette: number;
  campioni: number;
  cloni: number;
  marchi: number;
  mediaRating: string;
  mediaDurata: string;
  giornoESera: number;
  stagioni: { k: string; l: string; n: number; pct: number }[];
  famiglie: { k: string; l: string; n: number; pct: number }[];
  usi: { k: string; l: string; n: number; m: number }[];
  accordi: { a: string; n: number }[];
  perRating: Profumo[];
  perDurata: Profumo[];
  elencoCloni: { p: Profumo; dupe: string; orig: "in casa" | "campione in casa" | null }[];
  storico: { mese: string; lista: Profumo[] }[];
  partenza: number;
  novita: number;
  diario: null | {
    questoMese: number;
    usati: number;
    maiSegnate: number;
    usate: { p: Profumo; n: number }[];
    dimenticate: { p: Profumo; g: number | null }[];
    perStagione: { s: string; tot: number; top: { id: number; n: number }[] }[];
    rotazione: { diverse: number; su: number };
  };
}

/** I giorni da quando un profumo è stato messo l'ultima volta (fino a oggi), come giorniDa in js/collezione.js. */
function giorniDaCon(voci: VoceDiario[], id: number, oggi: string): number | null {
  const v = voci
    .filter((x) => +x.id === id && x.data <= oggi)
    .map((x) => x.data)
    .sort();
  if (!v.length) return null;
  return Math.round((new Date(oggi).getTime() - new Date(v[v.length - 1]).getTime()) / 864e5);
}

export function numeri(profumi: Profumo[], vociTutte: VoceDiario[], adesso = new Date()): Numeri {
  const B = boccetteDi(profumi),
    tot = B.length,
    C = campioniDi(profumi);
  const votati = B.filter((p) => p.rating).sort((a, b) => b.rating! - a.rating! || (b.voti as number) - (a.voti as number));
  const mediaR = (votati.reduce((a, p) => a + p.rating!, 0) / votati.length).toFixed(2);
  // la media esclude chi la durata non ce l'ha, come già fa quella dei voti
  const durate = B.filter((p) => p.longevita).sort((a, b) => b.longevita! - a.longevita! || (b.rating || 0) - (a.rating || 0));
  const mediaL = (durate.reduce((a, p) => a + p.longevita!, 0) / durate.length).toFixed(1);
  const cloni = B.filter((p) => p.dupe);
  const conta: Record<string, number> = {};
  B.forEach((p) => p.accordi.forEach((a) => (conta[a] = (conta[a] || 0) + 1)));
  const usi = USO_LABELS.map(([k, l]) => ({
    k,
    l,
    n: B.filter((p) => p[k as keyof Profumo] === "si").length,
    m: B.filter((p) => p[k as keyof Profumo] === "si-mod").length
  })).sort((a, b) => b.n + b.m - a.n - a.m);

  // lo storico delle aggiunte, dal più recente, a gruppi di mese
  const datati = profumi.filter((p) => aggiuntoIl(p)).sort((a, b) => aggiuntoIl(b)!.getTime() - aggiuntoIl(a)!.getTime() || a.id - b.id);
  const mesi = new Map<string, Profumo[]>();
  datati.forEach((p) => {
    const k = maiuscola(aggiuntoIl(p)!.toLocaleDateString("it-IT", { month: "long", year: "numeric" }));
    if (!mesi.has(k)) mesi.set(k, []);
    mesi.get(k)!.push(p);
  });

  // il diario: tutto quello che indossi, campioni compresi; «da riprendere» guarda solo le boccette
  const ids = new Set(profumi.map((p) => p.id));
  const D = vociTutte.filter((v) => ids.has(+v.id));
  const oggi = isoDi(adesso);
  let diario: Numeri["diario"] = null;
  if (D.length) {
    const mese = oggi.slice(0, 7),
      n = (id: number) => D.filter((v) => +v.id === id).length,
      g = (id: number) => giorniDaCon(D, id, oggi);
    const usate = profumi
      .filter((p) => n(p.id))
      .sort((a, b) => n(b.id) - n(a.id) || (g(a.id) as number) - (g(b.id) as number));
    const dimenticate = B.map((p) => ({ p, g: g(p.id) }))
      .sort((a, b) => (b.g ?? 1e4) - (a.g ?? 1e4))
      .slice(0, 6);
    // per stagione della data, non del profumo
    const stagioneDi = (iso: string) => {
      const [, m, gg] = iso.split("-").map(Number),
        k = m * 100 + gg;
      return k >= 321 && k < 621 ? "primavera" : k >= 621 && k < 923 ? "estate" : k >= 923 && k < 1221 ? "autunno" : "inverno";
    };
    const per: Record<string, Map<number, number>> = {};
    D.forEach((v) => {
      const s = stagioneDi(v.data);
      (per[s] = per[s] || new Map()).set(+v.id, (per[s].get(+v.id) || 0) + 1);
    });
    const diverse = new Set(D.filter((v) => v.data.startsWith(mese)).map((v) => +v.id).filter((id) => B.some((p) => p.id === id))).size;
    diario = {
      questoMese: D.filter((v) => v.data.startsWith(mese)).length,
      usati: usate.length,
      maiSegnate: B.filter((p) => !n(p.id)).length,
      usate: usate.map((p) => ({ p, n: n(p.id) })),
      dimenticate,
      perStagione: ["inverno", "primavera", "estate", "autunno"]
        .filter((s) => per[s])
        .map((s) => ({
          s,
          tot: [...per[s].values()].reduce((a, b) => a + b, 0),
          top: [...per[s].entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, n }))
        })),
      rotazione: { diverse, su: B.length }
    };
  }

  return {
    boccette: tot,
    campioni: C.length,
    cloni: cloni.length,
    marchi: new Set(B.map((p) => p.brand)).size,
    mediaRating: mediaR.replace(".", ","),
    mediaDurata: mediaL.replace(".", ","),
    giornoESera: B.filter((p) => p.momento === "entrambi").length,
    stagioni: ["pe", "tutto", "ai"].map((k) => {
      const n = B.filter((p) => p.stagione === k).length;
      return { k, l: stagLbl(k), n, pct: Math.round((n / tot) * 100) };
    }),
    famiglie: ["blu", "verde", "rosso"].map((k) => {
      const n = B.filter((p) => p.colore === k).length;
      return { k, l: VETRO_NOME[k], n, pct: Math.round((n / tot) * 100) };
    }),
    usi,
    accordi: Object.entries(conta)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([a, n]) => ({ a, n })),
    perRating: votati,
    perDurata: durate,
    elencoCloni: cloni.map((p) => {
      const o = originaleDi(p, profumi);
      return { p, dupe: p.dupe!.split(" (")[0], orig: o ? (eCampione(o) ? "campione in casa" : "in casa") : null };
    }),
    storico: [...mesi.entries()].map(([mese, lista]) => ({ mese, lista })),
    partenza: profumi.filter((p) => !aggiuntoIl(p)).length,
    novita: profumi.filter((p) => eNovita(p, adesso.getTime())).length,
    diario
  };
}

// ── LA MAPPA OLFATTIVA ────────────────────────────────────────────────────
/* Tutte le boccette su due assi: da fresco a caldo (la forza degli accordi) e da discreto a potente
   (scia, durata, concentrazione). Le zone vuote sono quelle dove un acquisto aggiungerebbe qualcosa. */
export function posizioneOlfattiva(p: Profumo) {
  const q = profiloAccordi(p);
  const caldo = q.dolce + q.fumo + q.spezia + q.cipria * 0.4 - (q.acqua + q.agrume + q.bosco * 0.3);
  const sil = ({ moderato: 0.15, forte: 0.55, enorme: 0.95 } as Record<string, number>)[String(p.sillage || "").toLowerCase()] ?? 0.5;
  const conc =
    ({ cologne: 0.1, edc: 0.1, edt: 0.4, edp: 0.65, parfum: 0.9, extrait: 1, elixir: 0.9 } as Record<string, number>)[String(p.conc || "").toLowerCase()] ?? 0.5;
  const forza = 0.4 * sil + 0.38 * Math.max(0, Math.min(1, ((p.longevita || 6) - 4) / 7)) + 0.22 * conc;
  return { x: Math.max(0, Math.min(1, (caldo + 1) / 2)), y: Math.max(0, Math.min(1, forza)) };
}
export const MAPPA = { W: 360, H: 420, m: 34, R: 12 };
export function mappa(profumi: Profumo[], conCampioni: boolean) {
  const { W, H, m, R } = MAPPA;
  const lista = (conCampioni ? profumi : boccetteDi(profumi)).filter((p) => p.accordi && p.accordi.length);
  const X = (x: number) => m + x * (W - 2 * m),
    Y = (y: number) => H - m - y * (H - 2 * m);
  // ognuno al suo posto, poi un po' di spinta finché non si coprono più
  const pt = lista.map((p) => {
    const o = posizioneOlfattiva(p);
    return { p, x: X(o.x), y: Y(o.y), tx: X(o.x), ty: Y(o.y), o };
  });
  for (let k = 0; k < 160; k++) {
    for (let i = 0; i < pt.length; i++)
      for (let j = i + 1; j < pt.length; j++) {
        const a = pt[i],
          b = pt[j];
        let dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 2 * R + 2) {
          const s = (2 * R + 2 - d) / 2;
          dx /= d;
          dy /= d;
          a.x -= dx * s;
          a.y -= dy * s;
          b.x += dx * s;
          b.y += dy * s;
        }
      }
    pt.forEach((a) => {
      a.x += (a.tx - a.x) * 0.04;
      a.y += (a.ty - a.y) * 0.04;
      a.x = Math.max(m - 6, Math.min(W - m + 6, a.x));
      a.y = Math.max(m - 6, Math.min(H - m + 6, a.y));
    });
  }
  // le nove zone e quante boccette ci cadono
  const zona = (o: { x: number; y: number }) => Math.min(2, Math.floor(o.x * 3)) + 3 * Math.min(2, Math.floor(o.y * 3));
  const conta = Array(9).fill(0) as number[];
  pt.filter((a) => !eCampione(a.p)).forEach((a) => conta[zona(a.o)]++);
  const nomiX = ["fresche", "di mezzo", "calde"],
    nomiY = ["discrete", "medie", "potenti"];
  const vuote: string[] = [];
  for (let i = 0; i < 9; i++) if (!conta[i]) vuote.push(`${nomiX[i % 3]} e ${nomiY[Math.floor(i / 3)]}`);
  return { punti: pt.map((a) => ({ p: a.p, x: a.x, y: a.y })), conta, vuote };
}

// ── GUIDA ─────────────────────────────────────────────────────────────────
export const SEZIONI_GUIDA = [
  { k: "ufficio", breve: "Ufficio", t: "Ufficio e lavoro", sub: "Spazi chiusi condivisi: due spray, sul petto e non sul collo",
    nota: "In ufficio non si esclude: si dosa. Orientali e gourmand con 1 spray sotto i vestiti, mai sul collo." },
  { k: "appuntamento", breve: "Appuntamento", t: "Appuntamento e serata", sub: "Dove la scia è un vantaggio" },
  { k: "quotidiano", breve: "Quotidiano", t: "Quotidiano e casual", sub: "Il guardaroba di tutti i giorni" },
  { k: "formale", breve: "Formale", t: "Formale e cerimonia", sub: "Eleganza misurata, mai dolciastra" },
  { k: "palestra", breve: "Palestra", t: "Palestra e sport", sub: "Leggeri, puliti, senza dolcezza",
    nota: "Da evitare: orientali, gourmand e cuoiati. Con il calore corporeo diventano nauseanti." },
  { k: "festivita", breve: "Festività", t: "Festività e inverno", sub: "Avvolgenti, per le sere più fredde" },
  { k: "casa", breve: "In casa", t: "In casa e relax", sub: "Per il piacere di sentirli addosso" }
] as { k: string; breve: string; t: string; sub: string; nota?: string }[];

export interface GruppoGuida {
  etichetta: string;
  tipo: "stagione" | "moderato" | "altri" | "campioni";
  ora?: boolean;
  lista: { p: Profumo; nota: string }[];
}
/** Una occasione: le boccette adatte divise per stagione (quella in corso prima), con moderazione, in ufficio
    anche le altre (1 spray sotto i vestiti), e i campioni. Il conteggio delle pillole conta solo i «sì». */
export function guida(profumi: Profumo[], k: string, stagioneOra: "pe" | "ai") {
  const B = boccetteDi(profumi);
  const conta = SEZIONI_GUIDA.map((x) => ({ k: x.k, n: B.filter((p) => p[x.k as keyof Profumo] === "si").length }));
  const si = B.filter((p) => p[k as keyof Profumo] === "si"),
    mod = B.filter((p) => p[k as keyof Profumo] === "si-mod");
  const gruppi: GruppoGuida[] = [];
  (stagioneOra === "pe" ? ["pe", "tutto", "ai"] : ["ai", "tutto", "pe"]).forEach((st) => {
    const l = si.filter((p) => p.stagione === st);
    if (l.length) gruppi.push({ etichetta: stagLbl(st), tipo: "stagione", ora: st === stagioneOra, lista: l.map((p) => ({ p, nota: p.conc })) });
  });
  if (mod.length) gruppi.push({ etichetta: "Con moderazione", tipo: "moderato", lista: mod.map((p) => ({ p, nota: `${p.conc} · ${stagBreve(p.stagione)}` })) });
  if (k === "ufficio") {
    const no = B.filter((p) => p.ufficio === "no");
    if (no.length) gruppi.push({ etichetta: "Con 1 spray, sotto i vestiti", tipo: "altri", lista: no.map((p) => ({ p, nota: `${p.conc} · 1 spray` })) });
  }
  const prova = campioniDi(profumi).filter((p) => p[k as keyof Profumo] === "si" || p[k as keyof Profumo] === "si-mod");
  if (prova.length)
    gruppi.push({
      etichetta: "Tra i campioni",
      tipo: "campioni",
      lista: prova.map((p) => ({ p, nota: `${p.conc} · ${p.formatoMl ? p.formatoMl + " ml" : "campione"}` }))
    });
  return { conta, si: si.length, vuota: !si.length && !mod.length, gruppi };
}

// ── LAYERING ──────────────────────────────────────────────────────────────
export const TIPI_STRATO: [string, string][] = [
  ["tutte", "Tutte"], ["uff", "Ufficio"], ["app", "Appuntamento"], ["sera", "Sera"], ["casa", "Casa"], ["lab", "Sperimentali"]
];
const str = (x: unknown) => String(x ?? "");
/** Il sommario dice chi sta sotto e chi sopra («№ 3 sotto · № 2 sopra — …»), la ricetta dice quanti spray. */
export function partiRicetta(l: Ricetta, perId: Map<number, Profumo>) {
  const [sotto, sopra] = [...str(l.s).matchAll(/№\s*(\d+)/g)].map((x) => perId.get(+x[1]));
  const dosi = [...str(l.come).matchAll(/(\d+)\s+(?:solo\s+)?spray/gi)].map((x) => +x[1]);
  let desc = str(l.s).split(" — ").slice(1).join(" — ") || "";
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  return { sotto, sopra, dSotto: dosi[0] || 2, dSopra: dosi[1] || 1, desc };
}
/** Dato un profumo, in quali ricette compare e con che ruolo. */
export function indiceStrati(layering: Ricetta[]) {
  const m = new Map<number, { i: number; nome: string; gruppo: string; ruolo: "sotto" | "sopra" }[]>();
  layering.forEach((r, i) => {
    const ids = [...str(r.s).matchAll(/№\s*(\d+)/g)].map((x) => +x[1]);
    ids.forEach((id, posto) => {
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push({ i, nome: str(r.n), gruppo: str(r.g), ruolo: posto === 0 ? "sotto" : "sopra" });
    });
  });
  return m;
}
export const spray = (n: number) => (n === 1 ? "1 spray" : n + " spray");

// ── ACQUISTI ──────────────────────────────────────────────────────────────
export interface Consiglio {
  g: string;
  n: string;
  gap: string;
  voci: { t: string; d: string }[];
}
/** Una voce dei consigli è già in casa se cita un numero («→ Island № 29») o se il titolo contiene marchio e nome. */
export function giaInCasa(t: string, profumi: Profumo[]): Profumo | null {
  const n = String(t).match(/№\s*(\d+)/);
  if (n) return profumi.find((p) => p.id === +n[1]) || null;
  const k = " " + chiaveNome(t) + " ";
  return profumi.find((p) => k.includes(" " + chiaveNome(p.brand + " " + p.name) + " ")) || null;
}
const eChiuso = (c: Consiglio) => /copert/i.test(c.g);
export function acquisti(consigliGrezzi: Ricetta[], profumi: Profumo[]) {
  const consigli = consigliGrezzi as unknown as Consiglio[];
  const aperte = consigli.filter((c) => !eChiuso(c)),
    chiuse = consigli.filter(eChiuso);
  return {
    aperte,
    chiuse,
    lacune: aperte.filter((c) => /lacun/i.test(c.g)).length || aperte.length,
    idee: aperte.reduce((a, c) => a + c.voci.filter((v) => !giaInCasa(v.t, profumi)).length, 0),
    nChiusi: chiuse.reduce((a, c) => a + c.voci.length, 0),
    finendo: boccetteDi(profumi).filter((p) => {
      const r = livelloResiduo(p);
      return !!r && r.v <= 25;
    })
  };
}

// ── CONFRONTO ─────────────────────────────────────────────────────────────
/** Le note di un profumo per il confronto: l'elenco delle note principali o, senza, le prime sei della piramide. */
export function notePerConfronto(p: Profumo): string[] {
  if (p.noteElenco && p.noteElenco.length) return p.noteElenco;
  const testo = (p.note || "").trim();
  if (!testo) return [];
  return testo
    .split(/\s*·\s*/)
    .map((pezzo) => {
      const m = pezzo.match(/^(testa|cuore|fondo|note)\s*:\s*(.*)$/i);
      return (m ? m[2] : pezzo)
        .split(/\s*,\s*/)
        .map((x) => x.trim())
        .filter(Boolean);
    })
    .filter((l) => l.length)
    .flat()
    .slice(0, 6);
}
/** Cosa hanno in comune (accordi e note presenti in tutti) e chi è il migliore su rating e durata. */
export function confronto(lista: Profumo[]) {
  const tutti = (f: (p: Profumo) => string[]) =>
    lista.map(f).reduce((a, b) => a.filter((x) => b.some((y) => y.toLowerCase() === x.toLowerCase())));
  const votati = lista.filter((p) => p.rating);
  return {
    accComuni: tutti((p) => p.accordi),
    noteComuni: tutti((p) => p.noteElenco || []),
    megR: votati.length ? Math.max(...votati.map((p) => p.rating!)) : null,
    megL: Math.max(...lista.filter((p) => p.longevita).map((p) => p.longevita!), 0)
  };
}
export const RAGGI_RUOTA: [string, string][] = [
  ["acqua", "Marino e acquatico"], ["agrume", "Agrumato e fruttato"], ["bosco", "Aromatico e legnoso"],
  ["spezia", "Speziato e ambrato"], ["fumo", "Cuoio e tabacco"], ["dolce", "Dolce e gourmand"], ["cipria", "Floreale e cipriato"]
];
