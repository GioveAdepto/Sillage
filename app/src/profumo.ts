import type { Colore, Profumo, SiNo } from "./tipi";

/* Le regole dell'app di oggi (js/collezione.js, js/dati.js), riscritte una per una.
   Se cambia una regola là, va cambiata anche qui (e viceversa) finché le due app convivono. */

/** Un campioncino si prova, non si indossa: sta in una vetrina per conto suo. */
export const eCampione = (p: Profumo) => !!p.tipoPossesso && p.tipoPossesso !== "full";

export type Vetrina = "boccette" | "campioni";
export const vetrinaDi = (p: Profumo): Vetrina => (eCampione(p) ? "campioni" : "boccette");

/** Il numero sul cartellino è la posizione nella sua vetrina, in ordine di arrivo (id):
    le boccette da 1 in su, i campioni da 1 in su. L'id resta la chiave di tutto. */
export function numeraCatalogo(lista: Profumo[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const gruppo of [lista.filter((p) => !eCampione(p)), lista.filter(eCampione)]) {
    [...gruppo].sort((a, b) => a.id - b.id).forEach((p, i) => m.set(p.id, i + 1));
  }
  return m;
}

export const nr = (n: number) => "Nº " + String(n).padStart(3, "0");

/** I testi che citano «№ 27» (l'id) si riscrivono col numero di catalogo. */
export const rinumera = (t: unknown, numeri: Map<number, number>) =>
  String(t ?? "").replace(/№\s*(\d+)/g, (_m, n: string) => "Nº " + (numeri.get(+n) ?? n));

/** «hermes» trova Hermès, «gio» trova Giò: accenti e maiuscole non contano. */
export const piega = (t: unknown) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function corrisponde(p: Profumo, cerca: string): boolean {
  const s = piega(cerca.trim());
  if (!s) return true;
  return [p.brand, p.name, p.note, p.famiglia, p.accordi.join(" "), p.dupe ?? "", (p.noteElenco ?? []).join(" ")].some((t) =>
    piega(t).includes(s)
  );
}

export const COLORI: Colore[] = ["blu", "verde", "rosso"];
export const eColore = (x: unknown): x is Colore => COLORI.includes(x as Colore);

export const FAMIGLIE: Record<Colore, { breve: string; lunga: string }> = {
  blu: { breve: "Freschi", lunga: "Acquatici e freschi" },
  verde: { breve: "Aromatici", lunga: "Aromatici e legnosi" },
  rosso: { breve: "Intensi", lunga: "Orientali e intensi" }
};

export const CONCENTRAZIONI: Record<string, string> = {
  EDT: "Eau de Toilette",
  EDP: "Eau de Parfum",
  EDC: "Eau de Cologne",
  P: "Parfum",
  EXT: "Extrait de Parfum"
};
export const concPerEsteso = (c: string) => CONCENTRAZIONI[c] ?? c;

/** «Testa: rum, limone · Cuore: lavanda · Fondo: vetiver» → tre righe. */
export function piramide(p: Profumo): { livello: string; note: string }[] {
  return String(p.note ?? "")
    .split("·")
    .map((pezzo) => {
      const i = pezzo.indexOf(":");
      return i < 0 ? { livello: "", note: pezzo.trim() } : { livello: pezzo.slice(0, i).trim(), note: pezzo.slice(i + 1).trim() };
    })
    .filter((r) => r.note);
}

const conIniziale = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

/** Accordi con la loro forza (0–100, misurata sulle barre di Fragrantica), nell'ordine di Fragrantica. */
export function accordiConForza(p: Profumo): { nome: string; forza: number }[] {
  const forze = String(p.accordi_forza ?? "")
    .split("|")
    .map(Number);
  return (p.accordi ?? []).map((nome, i) => ({
    nome: conIniziale(nome),
    forza: Number.isFinite(forze[i]) && forze[i] > 0 ? forze[i] : 0
  }));
}

export const USI: { campo: keyof Profumo; etichetta: string }[] = [
  { campo: "ufficio", etichetta: "Ufficio" },
  { campo: "serata", etichetta: "Serata" },
  { campo: "quotidiano", etichetta: "Quotidiano" },
  { campo: "formale", etichetta: "Formale" },
  { campo: "informale", etichetta: "Informale" },
  { campo: "appuntamento", etichetta: "Appuntamento" },
  { campo: "casa", etichetta: "Casa" },
  { campo: "palestra", etichetta: "Palestra" },
  { campo: "festivita", etichetta: "Festività" }
];
export const valoreUso = (v: SiNo) => (v === "si" ? "si" : v === "si-mod" ? "misura" : "no");

export const stagLbl = (s: string) => (s === "pe" ? "Primavera / Estate" : s === "ai" ? "Autunno / Inverno" : "Tutto l'anno");
export const momLbl = (m: string) => (m === "entrambi" ? "Giorno e sera" : m === "sera" ? "Sera" : "Giorno");

/* Adesso: stagioni agli equinozi e ai solstizi. Senza meteo la sera comincia alle 18
   (con il meteo, come in js/dati.js adesso(): mezz'ora dopo il tramonto, al più tardi alle 19;
   il meteo arriva con Consigliami, tappa 2). */
export type NomeStagione = "inverno" | "primavera" | "estate" | "autunno";
export const STAGIONI: NomeStagione[] = ["inverno", "primavera", "estate", "autunno"];
export function adesso(d = new Date()) {
  const k = (d.getMonth() + 1) * 100 + d.getDate();
  const h = d.getHours();
  const nome: NomeStagione =
    k >= 321 && k < 621 ? "primavera" : k >= 621 && k < 923 ? "estate" : k >= 923 && k < 1221 ? "autunno" : "inverno";
  const sera = h >= 18 || h < 5;
  return {
    nome,
    stagione: (nome === "primavera" || nome === "estate" ? "pe" : "ai") as "pe" | "ai",
    momento: (sera ? "sera" : "giorno") as "giorno" | "sera"
  };
}

/** Il filtro rapido «Adesso»: la stagione giusta (o tutto l'anno) e il momento giusto (o entrambi). */
export function vaBeneAdesso(p: Profumo, a = adesso()) {
  return (p.stagione === a.stagione || p.stagione === "tutto") && (p.momento === a.momento || p.momento === "entrambi");
}

/** Quando un profumo è entrato in Sillage: «aggiunto», ISO o gg/mm/aaaa. Vuota = collezione di partenza. */
export function aggiuntoIl(p: Profumo): Date | null {
  const t = String(p.aggiunto ?? "").trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
/** «Nuovo» dura un mese. */
export function eNovita(p: Profumo, oggi = Date.now()) {
  const d = aggiuntoIl(p);
  return !!d && (oggi - d.getTime()) / 864e5 <= 30;
}
export const dataAggiunta = (p: Profumo) =>
  aggiuntoIl(p)?.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) ?? "";

/** Quanto ne resta, scelto a mano a occhio: sette livelli, niente percentuali finte. */
export const LIVELLI: [number, string][] = [
  [100, "Piena"],
  [90, "Usata poco"],
  [75, "Tre quarti"],
  [50, "Mezza"],
  [25, "Un quarto"],
  [10, "In fine"],
  [0, "Finita"]
];
export function livelloResiduo(p: Profumo): { v: number; l: string } | null {
  if (p.residuoPct == null || (p.residuoPct as unknown) === "") return null;
  const x = +p.residuoPct;
  const [v, l] = LIVELLI.reduce((a, b) => (Math.abs(b[0] - x) < Math.abs(a[0] - x) ? b : a));
  return { v, l };
}

/* Originale e clone si riconoscono dal nome: «dupe» contiene «Marchio Profumo» dell'originale. */
const chiaveNome = (t: string) =>
  piega(String(t).split(" (")[0])
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const originaleDi = (p: Profumo, tutti: Profumo[]) =>
  p.dupe ? tutti.find((q) => q.id !== p.id && chiaveNome(q.brand + " " + q.name) === chiaveNome(p.dupe!)) ?? null : null;
export const copieDi = (p: Profumo, tutti: Profumo[]) =>
  tutti.filter((q) => q.id !== p.id && q.dupe && chiaveNome(q.dupe) === chiaveNome(p.brand + " " + p.name));

/* Quanto si somigliano due profumi (da 0 a 1): soprattutto gli accordi pesati per forza,
   poi le note in comune, e un piccolo bonus se la famiglia è la stessa. Sotto 0,3 non si mostra. */
const forzeAccordi = (p: Profumo) => {
  const f = String(p.accordi_forza ?? "")
    .split("|")
    .map(Number)
    .filter((n) => n > 0);
  return f.length ? f : null;
};
const pesoAccordo = (p: Profumo, i: number) => {
  const f = forzeAccordi(p);
  return f && f[i] ? f[i] / 100 : 1 / (1 + i * 0.35);
};
export function somiglianza(a: Profumo, b: Profumo) {
  const pesi = (p: Profumo) => {
    const m = new Map<string, number>();
    (p.accordi ?? []).forEach((x, i) => m.set(x.toLowerCase(), pesoAccordo(p, i)));
    return m;
  };
  const A = pesi(a),
    B = pesi(b);
  let dentro = 0,
    tutto = 0;
  new Set([...A.keys(), ...B.keys()]).forEach((k) => {
    const x = A.get(k) || 0,
      y = B.get(k) || 0;
    dentro += Math.min(x, y);
    tutto += Math.max(x, y);
  });
  const na = new Set((a.noteElenco ?? []).map((n) => n.toLowerCase())),
    nb = new Set((b.noteElenco ?? []).map((n) => n.toLowerCase()));
  const comuni = [...na].filter((x) => nb.has(x)).length,
    unione = new Set([...na, ...nb]).size;
  return (tutto ? dentro / tutto : 0) * 0.65 + (unione ? comuni / unione : 0) * 0.25 + (a.famiglia === b.famiglia ? 0.1 : 0);
}
export const similiA = (p: Profumo, tutti: Profumo[], quanti = 3) =>
  tutti
    .filter((q) => q.id !== p.id)
    .map((q) => ({ q, v: somiglianza(p, q) }))
    .filter((x) => x.v >= 0.3)
    .sort((a, b) => b.v - a.v)
    .slice(0, quanti);

export const voto = (r: number) => r.toFixed(1).replace(".", ",");
/** 24.246 e anche 5.763: in italiano il browser lascia i numeri di quattro cifre senza punto. */
export const migliaia = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** Le foto stanno in public/img con lo stesso nome dell'app di oggi («img/…webp»). */
export const immagine = (p: Profumo) => (p.img ? import.meta.env.BASE_URL + p.img.replace(/^\.?\//, "") : "");
