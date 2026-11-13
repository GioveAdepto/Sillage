import type { Profumo } from "./tipi";
import { STAGIONI, adesso, eCampione, pesoAccordo, voto, type NomeStagione } from "./profumo";
import { finestraMeteo, piove, type Finestra, type Meteo } from "./meteo";

/* Consigliami: il punteggio di js/consigliami.js (candidatiOggi e i suoi aiutanti), riscritto riga per riga.
   Le regole (scelte dell'utente): prima la stagione, poi l'occasione, poi giorno o sera. Il diario e i voti
   personali non entrano nel punteggio; a parità decide il rating di Fragrantica. L'ufficio non esclude: dosa.
   Boccette e campioni insieme. Ogni modifica si verifica con strumenti/prima-dopo.mjs.
   Niente React qui dentro: lo script del prima/dopo lo carica in Node. */

export type Occasione = "ufficio" | "quotidiano" | "appuntamento" | "formale" | "casa" | "festivita" | "palestra";
export type Quando = "oggi" | "stasera" | "domani";

export const OCCASIONI: [Occasione, string][] = [
  ["ufficio", "Ufficio"],
  ["quotidiano", "Quotidiano"],
  ["appuntamento", "Appuntamento"],
  ["formale", "Formale"],
  ["casa", "In casa"],
  ["festivita", "Festività"],
  ["palestra", "Palestra"]
];
export const eOccasione = (x: unknown): x is Occasione => OCCASIONI.some(([k]) => k === x);

/** A che ora, domani, si mette il profumo per quell'occasione. */
export const ORA_PER_OCCASIONE: Record<Occasione, number> = {
  ufficio: 8, quotidiano: 9, casa: 10, palestra: 18, appuntamento: 19, formale: 19, festivita: 19
};

/** Da quando il profumo starà sulla pelle. «Stasera» è una scelta nuova rispetto all'app di oggi:
    oggi alle 19, o adesso se è già più tardi. Il punteggio poi è lo stesso. */
export function inizioPer(quando: Quando | Date, occ: Occasione): Date {
  if (quando instanceof Date) return quando; // un giorno preciso (il piano della settimana, col Diario)
  const d = new Date();
  if (quando === "oggi") return d;
  if (quando === "stasera") {
    if (d.getHours() < 19) d.setHours(19, 0, 0, 0);
    return d;
  }
  d.setDate(d.getDate() + 1);
  d.setHours(ORA_PER_OCCASIONE[occ] ?? 9, 0, 0, 0);
  return d;
}

/** L'occasione più probabile: domani feriale ufficio, altrimenti quotidiano; la sera del venerdì e del
    sabato un appuntamento, le altre sere in casa; di giorno ufficio nei feriali. */
export function occasioneProbabile(quando: Quando, meteo: Meteo | null = null): Occasione {
  if (quando === "domani") {
    const g = (new Date().getDay() + 1) % 7;
    return g >= 1 && g <= 5 ? "ufficio" : "quotidiano";
  }
  const a = adesso(quando === "stasera" ? inizioPer("stasera", "casa") : new Date(), meteo),
    g = a.giorno,
    feriale = g >= 1 && g <= 5;
  if (a.momento === "sera") return g === 5 || g === 6 ? "appuntamento" : "casa";
  return feriale ? "ufficio" : "quotidiano";
}

const durataSullaPelle = (p: Profumo) => Math.min(p.longevita || 6, 12);

// ── quanto è denso: la parte calda degli accordi (dolce, cuoio-tabacco, spezie e ambra) ──
const FAMIGLIA_ACCORDO: Record<string, string[]> = {
  acqua: ["Marino", "Acquatico", "Minerale", "Salato", "Ozonico", "Fresco"],
  bosco: ["Aromatico", "Legnoso", "Verde", "Terroso", "Lavanda", "Muschiato", "Muschio Vegetale", "Cannabis"],
  agrume: ["Agrumato", "Fruttato"],
  spezia: ["Speziato Fresco", "Speziato Caldo", "Ambra", "Cannella", "Balsamico"],
  cipria: ["Talcato", "Iris", "Violetta", "Rosa", "Floreale Bianco"],
  dolce: ["Vanigliato", "Dolce", "Cocco", "Caffè", "Rum", "Whisky", "Mielato"],
  fumo: ["Cuoiato", "Fumoso", "Animalico", "Tabacco", "Oud"]
};
const RAGGI = ["acqua", "agrume", "bosco", "spezia", "fumo", "dolce", "cipria"];
const famigliaDi = (() => {
  const m: Record<string, string> = {};
  for (const f in FAMIGLIA_ACCORDO) FAMIGLIA_ACCORDO[f].forEach((a) => (m[a.toLowerCase()] = f));
  return (a: string) => m[String(a).toLowerCase()];
})();
export function profiloAccordi(p: Profumo) {
  const q: Record<string, number> = {};
  RAGGI.forEach((k) => (q[k] = 0));
  let tot = 0;
  (p.accordi || []).forEach((a, i) => {
    const f = famigliaDi(a);
    if (!f) return;
    const w = pesoAccordo(p, i);
    q[f] += w;
    tot += w;
  });
  if (tot) for (const k in q) q[k] /= tot;
  return q;
}
const densita = (p: Profumo) => {
  const q = profiloAccordi(p);
  return q.dolce + q.fumo + q.spezia;
};

/* La temperatura entra nella stagione (sotto, stagioneDelMomento). Qui restano le due cose che la
   stagione non dice: il caldo umido, che rende pesante un orientale denso, e la pioggia, con cui legni
   e resine rendono meglio. */
function effettoMeteo(p: Profumo, f: Finestra | null) {
  if (!f) return { s: 0, perche: "", contro: "" };
  const densi = densita(p) >= 0.45;
  let s = 0,
    perche = "",
    contro = "";
  if (f.max >= 24 && f.umid >= 70 && densi) {
    s -= 1.5;
    contro = `con ${f.max}° e aria umida un denso pesa`;
  }
  if (f.pioggia !== null && p.accordi.some((a) => /Legnoso|Terroso|Fumoso|Ambra|Balsamico/.test(a))) {
    s += 1;
    perche = `pioggia dalle ${f.pioggia}: legni e resine rendono bene`;
  }
  return { s, perche, contro };
}

// ── la stagione, criterio principale ──────────────────────────────────────
/* Quanto un profumo è «di stagione»: i voti per stagione di Fragrantica confrontati con la stagione del
   momento, che nasce dal calendario sfumato e dalla temperatura percepita nelle ore in cui sarà addosso.
   Primavera e autunno hanno le stesse temperature: li distingue il calendario. Senza meteo vale il calendario. */
function quoteStagioni(p: Profumo): Record<NomeStagione, number> {
  // come nell'app di oggi: un valore che manca vale 0
  const v = STAGIONI.map((k) => Math.max(0, +(p.stagioni ? p.stagioni[k] : 0) || 0)),
    t = v.reduce((a, b) => a + b, 0);
  return Object.fromEntries(STAGIONI.map((k, i) => [k, t ? v[i] / t : 0.25])) as Record<NomeStagione, number>;
}
function stagioneDelMomento(da: Date, f: Finestra | null): { w: Record<NomeStagione, number>; T: number | null } {
  const g = Math.floor((da.getTime() - new Date(da.getFullYear(), 0, 0).getTime()) / 864e5),
    centri = { inverno: 20, primavera: 110, estate: 201, autunno: 293 };
  const cal = {} as Record<NomeStagione, number>;
  STAGIONI.forEach((k) => {
    let d = Math.abs(g - centri[k]);
    d = Math.min(d, 365 - d);
    cal[k] = Math.max(0, 1 - d / 91);
  });
  const norm = (o: Record<NomeStagione, number>) => {
    const t = STAGIONI.reduce((a, k) => a + o[k], 0) || 1;
    STAGIONI.forEach((k) => (o[k] /= t));
    return o;
  };
  norm(cal);
  if (!f) return { w: cal, T: null };
  const T = f.media,
    temp = { inverno: Math.max(0, 1 - Math.abs(T - 4) / 7), estate: Math.max(0, 1 - Math.abs(T - 26) / 7), primavera: 0, autunno: 0 };
  const mite = Math.max(0, 1 - Math.abs(T - 15) / 7);
  // la mezza stagione la decide il calendario: primavera o autunno
  const verso = cal.primavera + cal.estate >= cal.autunno + cal.inverno ? "primavera" : "autunno";
  temp.primavera = verso === "primavera" ? mite : 0;
  temp.autunno = verso === "autunno" ? mite : 0;
  if (T <= -3) temp.inverno = 1;
  if (T >= 33) temp.estate = 1;
  norm(temp);
  const kt = f.incerto ? 0.35 : 0.6,
    w = {} as Record<NomeStagione, number>;
  STAGIONI.forEach((k) => (w[k] = (1 - kt) * cal[k] + kt * temp[k]));
  return { w: norm(w), T };
}
/** Senza previsione oraria (posizione mai data, o rete assente) vale il meteo di adesso, solo per oggi. */
function finestraPer(p: Profumo, da: Date, quando: Quando | Date, meteo: Meteo | null): Finestra | null {
  let f = finestraMeteo(meteo, da, durataSullaPelle(p));
  // oltre i tre giorni e mezzo la previsione è meno affidabile: la temperatura pesa meno del calendario
  if (f && da.getTime() - Date.now() > 3.5 * 864e5) f = { ...f, incerto: true };
  if (f || quando !== "oggi") return f;
  const m = adesso(new Date(), meteo).meteo;
  if (!m) return null;
  return {
    ore: [], max: m.percepita, min: m.percepita, media: m.percepita, umid: m.umidita,
    oraMax: da.getHours(), oraMin: da.getHours(), pioggia: piove(m) ? da.getHours() : null,
    dalle: da.getHours(), alle: da.getHours()
  };
}

export const FRASE_OCCASIONE: Record<Occasione, string> = {
  ufficio: "va bene in ufficio", quotidiano: "è da tutti i giorni", appuntamento: "è fatto per un appuntamento",
  formale: "regge un'occasione formale", casa: "è piacevole da tenere in casa", festivita: "ha il tono giusto per una festa",
  palestra: "è abbastanza leggero per la palestra"
};
const DOSATO_PER: Record<Occasione, string> = {
  ufficio: "in ufficio", quotidiano: "di giorno", appuntamento: "a un appuntamento", formale: "in un'occasione formale",
  casa: "in casa", festivita: "a una festa", palestra: "in palestra"
};

export interface Candidato {
  p: Profumo;
  /** il punteggio: più alto, più consigliato */
  s: number;
  /** le ore sulla pelle, se c'è il meteo */
  f: Finestra | null;
  pro: string[];
  contro: string[];
}

export interface Opzioni {
  meteo?: Meteo | null;
  /** vero se il profumo non è mai stato indossato: arriva col Diario (tappa 3). Senza, la frase sul campione da
      provare non compare. Non cambia mai il punteggio. */
  maiIndossato?: (id: number) => boolean;
}

/** Tutti i profumi adatti all'occasione, in ordine: il primo è la scelta. */
export function candidati(profumi: Profumo[], occ: Occasione, quando: Quando | Date, opz: Opzioni = {}): Candidato[] {
  const meteo = opz.meteo ?? null;
  const da = inizioPer(quando, occ),
    mo = adesso(da, meteo).momento;
  return profumi
    .filter((p) => occ === "ufficio" || p[occ] === "si" || p[occ] === "si-mod")
    .map((p) => {
      const f = finestraPer(p, da, quando, meteo),
        mt = effettoMeteo(p, f);
      // il punteggio e i motivi nascono insieme: ogni voce che sposta la classifica lascia una frase
      const pro: string[] = [],
        contro: string[] = [];
      let s = mt.s;
      if (occ === "ufficio") {
        if (p.ufficio === "si") {
          s += 2;
          pro.push("va bene in ufficio: 2–3 spray");
        } else if (p.ufficio === "si-mod") {
          s += 0.5;
          contro.push("in ufficio va dosato: 2 spray sul petto");
        }
        // -3, quanto «fuori stagione»: con -1,5 a 8 gradi un gourmand entrava tra i primi cinque
        else {
          s -= 3;
          contro.push("in ufficio solo 1 spray, sotto i vestiti");
        }
      } else if (p[occ] === "si") {
        s += 2;
        pro.push(FRASE_OCCASIONE[occ]);
      } else {
        s += 0.5;
        contro.push(`${DOSATO_PER[occ]} va dosato: uno spray`);
      }
      // la stagione: il peso più grande della classifica (da circa -4 a +5)
      const q = quoteStagioni(p),
        sm = stagioneDelMomento(da, f);
      const S = STAGIONI.reduce((a, k) => a + sm.w[k] * q[k], 0);
      s += 24 * (S - 0.25);
      const suaTop = STAGIONI.reduce((a, k) => (q[k] > q[a] ? k : a)),
        oraTop = STAGIONI.reduce((a, k) => (sm.w[k] > sm.w[a] ? k : a));
      const clima = sm.T !== null && f ? `con ${f.min === f.max ? f.media : f.min + "–" + f.max}° percepiti` : `in ${oraTop}`;
      const quandoSi = (k: string) => (k === "estate" || k === "inverno" ? "d'" : "in ") + k;
      if (S >= 0.3) pro.push(`${clima} è di stagione: su Fragrantica lo portano soprattutto ${quandoSi(suaTop)} (${Math.round(q[suaTop] * 100)}%)`);
      else if (S < 0.2)
        contro.push(`${clima} è fuori stagione: su Fragrantica lo portano soprattutto ${quandoSi(suaTop)} (${Math.round(q[suaTop] * 100)}%)`);
      // giorno o sera: conta, ma meno (da -1,5 a +1,5)
      const gp = (p.giornoPct ?? 50) / 100,
        dn = mo === "giorno" ? gp - 0.5 : 0.5 - gp;
      s += 3 * dn;
      if (dn >= 0.15) pro.push(mo === "giorno" ? `è da giorno (${Math.round(gp * 100)}% dei voti)` : `è da sera (${Math.round((1 - gp) * 100)}% dei voti)`);
      else if (dn <= -0.15)
        contro.push(mo === "giorno" ? `è più da sera (${Math.round((1 - gp) * 100)}% dei voti)` : `è più da giorno (${Math.round(gp * 100)}% dei voti)`);
      if (mt.perche) pro.push(mt.perche);
      if (mt.contro) contro.push(mt.contro);
      // un campione mai indossato è un'occasione per provarlo: lo si dice, ma la classifica non cambia
      if (eCampione(p) && opz.maiIndossato?.(p.id)) pro.push(`è un campione${p.formatoMl ? ` da ${p.formatoMl} ml` : ""}: buona occasione per provarlo`);
      s += ((p.rating || 3.9) - 3.9) * 1.5;
      if ((p.rating ?? 0) >= 4.3) pro.push(`è tra i più amati su Fragrantica (★ ${voto(p.rating!)})`);
      if ((p.longevita ?? 0) >= 9 && (occ === "appuntamento" || occ === "festivita" || occ === "formale"))
        pro.push(`dura ${p.longevita}h: arriva a fine serata`);
      return { p, s, f, pro, contro };
    })
    .sort((a, b) => b.s - a.s);
}

export const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
