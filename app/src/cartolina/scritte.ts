/* Le scritte della cartolina di Fragrantica (nome, marchio, genere, voto, voti, durata, scia, nomi degli accordi,
   note), lette NEL TELEFONO con un lettore di testo (Tesseract, src/cartolina/lettore.ts): niente AI a pagamento,
   niente rete dopo il primo uso. Qui c'è solo la parte che non dipende dal lettore: quali zone ritagliare (a
   partire dalle barre che la misura ha già trovato), come prepararle perché il lettore le legga bene, e come
   capire il testo letto, correggendolo con le parole già note (accordi e note del catalogo, scie di Fragrantica).
   Il lettore si passa da fuori: nelle prove ce n'è uno finto (app/LEGGIMI.md, «Prove»).
   Tarata sulle 38 cartoline di Danilo (app/strumenti/tara-scritte.mjs). */
import type { Immagine, Misura } from "./misura";

export interface Parola {
  testo: string;
  conf: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Letto {
  testo: string;
  parole: Parola[];
}
/** «riga»: una sola riga di testo (il nome di un accordo); «blocco»: più righe; «numeri»: più righe di sole cifre,
    punti e parentesi (il voto); «sparso»: scritte sparse per la pagina (una schermata). */
export type Riconosci = (img: Immagine, modo: "riga" | "blocco" | "numeri" | "sparso") => Promise<Letto>;

export interface Scritte {
  nome: string;
  /** la concentrazione, quando il titolo la dice («Eau de Parfum» ▸ EDP) */
  conc: string;
  marchio: string;
  genere: "" | "uomo" | "donna" | "unisex";
  voto: number | null;
  voti: number | null;
  durata: number | null;
  scia: string;
  accordi: string[];
  note: string[];
}
export interface Note {
  testa: string[];
  cuore: string[];
  fondo: string[];
}

/** Gli accordi di Fragrantica in italiano: quelli del catalogo più gli altri che si incontrano. Servono solo a
    correggere una lettura quasi giusta («Speziat0 Fresco»): una parola lontana da tutte resta com'è letta. */
export const ACCORDI_NOTI = [
  "Acquatico", "Agrumato", "Alcolico", "Aldeidato", "Ambra", "Animalico", "Anice", "Aromatico", "Balsamico", "Benzina",
  "Cacao", "Caffè", "Canforato", "Cannabis", "Cannella", "Caramello", "Cera d'api", "Ciliegia", "Cioccolato", "Cocco",
  "Conifere", "Cuoiato", "Dolce", "Erbaceo", "Floreale", "Floreale Bianco", "Floreale Giallo", "Fresco", "Frutta Secca",
  "Fruttato", "Fumoso", "Gommoso", "Iris", "Lattonico", "Lavanda", "Legnoso", "Mandorla", "Marino", "Metallico",
  "Mielato", "Minerale", "Muschiato", "Muschio Vegetale", "Oud", "Ozonico", "Patchouli", "Plastica", "Rosa", "Rum",
  "Sabbia", "Salato", "Saponoso", "Speziato Caldo", "Speziato Fresco", "Speziato Morbido", "Tabacco", "Talcato",
  "Terroso", "Tropicale", "Tuberosa", "Vanigliato", "Verde", "Vetiver", "Vino", "Violetta", "Vodka", "Whisky"
];
/** La scia sulla cartolina (nel catalogo al maschile: «Moderato»). */
export const SCIE = ["Intimo", "Moderato", "Forte", "Enorme", "Intima", "Moderata"];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function distanza(a: string, b: string) {
  if (a === b) return 0;
  const r = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prima = r[0];
    r[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = r[j];
      r[j] = Math.min(r[j] + 1, r[j - 1] + 1, prima + (a[i - 1] === b[j - 1] ? 0 : 1));
      prima = t;
    }
  }
  return r[b.length];
}
/** La parola nota più vicina a quella letta, se è davvero vicina (al più una lettera su `ogni` diversa). */
export function piuVicina(letta: string, note: readonly string[], ogni = 4): string | null {
  const n = norm(letta);
  if (n.length < 2) return null;
  let meglio: string | null = null,
    d = Infinity;
  for (const p of note) {
    const k = distanza(n, norm(p));
    if (k < d) {
      d = k;
      meglio = p;
    }
  }
  return meglio && d <= Math.max(1, Math.floor(n.length / ogni)) ? meglio : null;
}

/** Ripulisce una riga letta: via i segni sparsi ai bordi (|, «, punti), spazi singoli. */
export function pulisci(s: string) {
  return s
    .replace(/[|«»“”"_~=*•·§®©°^{}[\]<>\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9.')]+$/g, "");
}

// ── le zone e come prepararle ──

/** Ritaglio in scala di grigi: inchiostro scuro su bianco, contrasto tirato (lo sfondo sfumato diventa bianco),
    ingrandito di «scala» volte. `inchiostro(x, y)` può dire quanto è inchiostro un pixel (0-255), altrimenti si
    usa la luminosità. */
export function ritaglio(img: Immagine, x0: number, y0: number, x1: number, y1: number, scala = 2, inchiostro?: (x: number, y: number) => number): Immagine {
  x0 = Math.max(0, Math.round(x0));
  y0 = Math.max(0, Math.round(y0));
  x1 = Math.min(img.width, Math.round(x1));
  y1 = Math.min(img.height, Math.round(y1));
  const w = Math.max(1, x1 - x0),
    h = Math.max(1, y1 - y0);
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * img.width + x0 + x) * 4;
      g[y * w + x] = inchiostro ? 255 - inchiostro(x0 + x, y0 + y) : 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    }
  let nero = 0,
    bianco = 255;
  if (!inchiostro) {
    /* lo sfondo sfuma (e la cartolina ha la grana della compressione): ogni pixel si divide per lo sfondo
       vicino, il più chiaro in un intorno più largo dei tratti delle lettere; poi il 2° percentile è nero */
    const R = Math.max(6, Math.round(img.width * 0.012));
    const orizz = new Float32Array(w * h),
      fondo = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let k = Math.max(0, x - R); k <= Math.min(w - 1, x + R); k++) m = Math.max(m, g[y * w + k]);
        orizz[y * w + x] = m;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let m = 0;
        for (let k = Math.max(0, y - R); k <= Math.min(h - 1, y + R); k++) m = Math.max(m, orizz[k * w + x]);
        fondo[y * w + x] = m;
      }
    for (let i = 0; i < g.length; i++) g[i] = (255 * g[i]) / Math.max(1, fondo[i]);
    const ord = Array.from(g).sort((a, b) => a - b);
    nero = Math.min(ord[Math.floor(ord.length * 0.02)], 180);
    bianco = 228;
  }
  // un margine bianco attorno: il lettore sbaglia le lettere attaccate al bordo
  const M = 8 * scala;
  const W = w * scala,
    H = h * scala;
  const out = new Uint8ClampedArray((W + 2 * M) * (H + 2 * M) * 4).fill(255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // bilineare
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) / scala - 0.5)),
        fy = Math.min(h - 1, Math.max(0, (y + 0.5) / scala - 0.5));
      const ax = Math.floor(fx),
        ay = Math.floor(fy),
        bx = Math.min(w - 1, ax + 1),
        by = Math.min(h - 1, ay + 1);
      const tx = fx - ax,
        ty = fy - ay;
      const v = (g[ay * w + ax] * (1 - tx) + g[ay * w + bx] * tx) * (1 - ty) + (g[by * w + ax] * (1 - tx) + g[by * w + bx] * tx) * ty;
      const c = Math.max(0, Math.min(255, ((v - nero) / (bianco - nero)) * 255));
      const k = ((y + M) * (W + 2 * M) + x + M) * 4;
      out[k] = out[k + 1] = out[k + 2] = c;
    }
  return { width: W + 2 * M, height: H + 2 * M, data: out };
}

type Rgb = [number, number, number];
const diff = (a: Rgb, b: Rgb) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** Le zone della cartolina, in frazioni del lato (la cartolina è quadrata; le barre degli accordi dalla misura). */
export function zone(img: Immagine, misura: Misura) {
  const W = img.width,
    H = img.height;
  const X = (f: number) => f * W,
    Y = (f: number) => f * H;
  const px = (x: number, y: number): Rgb => {
    const i = (Math.round(y) * W + Math.round(x)) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  // gli accordi: dentro ogni barra, l'inchiostro è ciò che si stacca dal colore della barra (scritta bianca su
  // una barra scura o scura su una chiara); oltre la fine della barra, ciò che si stacca dallo sfondo
  const tr = (misura.traccia ?? []).filter((t) => t.sx >= 0);
  const inizio = tr.length ? [...tr.map((t) => t.sx)].sort((a, b) => a - b)[Math.floor((tr.length - 1) / 2)] : -1;
  const alte = tr.map((t) => t.giu - t.su).sort((a, b) => a - b);
  const alta = alte.length ? alte[Math.floor((alte.length - 1) / 2)] : 0;
  const accordi = tr.map((t) => {
    // il colore della barra: il più comune su due righe a metà altezza (la scritta ha tratti sottili, fra un
    // tratto e l'altro c'è la barra)
    const conta = new Map<string, { c: Rgb; n: number }>();
    for (const f of [0.3, 0.5, 0.7])
      for (let x = inizio + 4; x < Math.max(inizio + 6, t.dx - 4); x++) {
        const c = px(x, t.su + alta * f);
        const k = c.map((v) => v >> 3).join();
        const e = conta.get(k);
        if (e) e.n++;
        else conta.set(k, { c, n: 1 });
      }
    const barra = [...conta.values()].sort((a, b) => b.n - a.n)[0]?.c ?? px(inizio + 6, t.su + alta / 2);
    const fondo = px(X(0.93), t.su + alta / 2);
    // la grana della compressione e i bordi arrotondati non sono scritta: conta solo ciò che si stacca molto
    const inchiostro = (x: number, y: number) => {
      if (Math.abs(x - t.dx) <= 4) return 0;
      const c = px(x, y);
      const rif = x < t.dx ? barra : fondo;
      return Math.max(0, Math.min(255, (diff(c, rif) - 70) * 2.5));
    };
    return ritaglio(img, inizio + 8, t.su + alta * 0.12, X(0.94), t.su + alta * 0.88, 2, inchiostro);
  });
  /* la cartolina scende quando il nome va a capo: le zone si ancorano alla prima barra degli accordi (che di
     solito sta a 0,19 del lato) */
  const sposta = tr.length ? tr[0].su - Y(0.1905) : 0;
  const Z = (f: number) => Math.min(H, Y(f) + sposta);
  return {
    testata: bande(img, X(0.03), 0, X(0.84), Z(0.112)).map((b) => ({ alta: b.giu - b.su, img: ritaglio(img, X(0.03), b.su - 4, X(0.84), b.giu + 5, 2) })),
    // il voto: solo l'inchiostro scuro e grigio (le stelle sono gialle)
    voto: ritaglio(img, X(0.04), Z(0.535), X(0.4), Z(0.615), 2, (x, y) => {
      const c = px(x, y);
      const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 70 ? 0 : Math.max(0, Math.min(255, (190 - l) * 2.2));
    }),
    // per i voti tra parentesi, la stessa zona così com'è
    voti: ritaglio(img, X(0.04), Z(0.535), X(0.4), Z(0.615), 2),
    profilo: ritaglio(img, X(0.41), Z(0.5), X(0.95), Z(0.62), 2),
    note: ritaglio(img, X(0.05), Z(0.62), X(0.37), Z(0.925), 2),
    accordi
  };
}

/** Le righe di testo di una zona: le file di pixel dove c'è inchiostro (più scuro dello sfondo della fila). */
function bande(img: Immagine, x0: number, y0: number, x1: number, y1: number) {
  x0 = Math.round(x0);
  x1 = Math.round(x1);
  const piene: boolean[] = [];
  for (let y = Math.round(y0); y < Math.round(y1); y++) {
    const l: number[] = [];
    for (let x = x0; x < x1; x += 2) {
      const i = (y * img.width + x) * 4;
      l.push(0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]);
    }
    const fondo = [...l].sort((a, b) => a - b)[Math.floor(l.length * 0.6)];
    piene.push(l.filter((v) => v < fondo - 45).length >= 2);
  }
  const out: { su: number; giu: number }[] = [];
  piene.forEach((p, i) => {
    if (!p) return;
    const y = i + Math.round(y0);
    const u = out[out.length - 1];
    if (u && y - u.giu <= 1) u.giu = y;
    else out.push({ su: y, giu: y });
  });
  return out.filter((b) => b.giu - b.su >= 7);
}

// ── dal testo letto ai campi ──

const lettere = /[A-Za-zÀ-ÿ]/;

/** Nome, marchio e genere dalle righe della testata (dall'alto, con la loro altezza in pixel). Il titolo è fatto
    delle righe alte (va a capo se è lungo); sotto, il marchio e il genere. */
export function capisciTestata(rs: { testo: string; alta: number }[], marchiNoti: readonly string[] = []) {
  rs = rs.map((r) => ({ ...r, testo: pulisci(r.testo) })).filter((r) => lettere.test(r.testo));
  const genereRiga = rs.find((r) => /\b(da\s*uomo|da\s*donna|unisex)\b/i.test(r.testo) || piuVicina(r.testo, ["da uomo", "da donna", "unisex"]));
  const g = norm(genereRiga?.testo ?? "");
  const genere: Scritte["genere"] = /uomo|uom/.test(g) ? "uomo" : /donna|donn/.test(g) ? "donna" : /unisex|unise/.test(g) ? "unisex" : "";
  const altre = rs.filter((r) => r !== genereRiga);
  const max = Math.max(0, ...altre.map((r) => r.alta));
  const titolo = altre.filter((r) => r.alta >= max * 0.7);
  const dopo = altre.filter((r) => r.alta < max * 0.7);
  const letto = dopo[0]?.testo ?? "";
  // un marchio già nel catalogo, scritto uguale o con «Perfumes» in più, si scrive come nel catalogo
  const marchio =
    marchiNoti.find((m) => norm(letto) === norm(m)) ??
    marchiNoti.find((m) => norm(m).length >= 4 && norm(letto).startsWith(norm(m)) && /^(perfumes?|parfums?|fragrances?|paris|milano)$/.test(norm(letto).slice(norm(m).length))) ??
    piuVicina(letto, marchiNoti, 7) ?? // prudente: «Emporio Armani» non è «Giorgio Armani»
    letto;
  return { ...nomeEConcentrazione(titolo.map((r) => r.testo).join(" "), marchio), marchio, genere };
}

const CONC_NEL_NOME: [RegExp, string][] = [
  [/\s+extrait de parfum\b/i, "Extrait"],
  [/\s+eau de parfum\b/i, "EDP"],
  [/\s+eau de toilette\b/i, "EDT"],
  [/\s+eau de cologne\b/i, "EDC"],
  [/\s+parfum$/i, "Parfum"]
];
/** Fragrantica scrive il nome col marchio dentro e la concentrazione («Prada L'Homme Intense», «Gentleman Eau de
    Parfum Reserve Privée»); nel catalogo il nome è senza («L'Homme Intense», «Gentleman Réserve Privée») e la
    concentrazione va a parte. */
export function nomeEConcentrazione(titolo: string, marchio: string) {
  let nome = titolo.replace(/\s+/g, " ").trim(),
    conc = "";
  for (const [re, c] of CONC_NEL_NOME)
    if (re.test(nome)) {
      nome = nome.replace(re, "").replace(/\s+/g, " ").trim();
      conc = c;
      break;
    }
  if (marchio) {
    const parole = nome.split(" "),
      m = marchio.trim().split(/\s+/).map(norm);
    for (let i = 0; i + m.length <= parole.length; i++)
      if (m.every((w, j) => norm(parole[i + j]) === w) && parole.length > m.length) {
        parole.splice(i, m.length);
        nome = parole.join(" ");
        break;
      }
  }
  return { nome, conc };
}

/** Voto (il numero accanto alle stelle) e voti (il numero fra parentesi). */
export function capisciVoto(l: Letto) {
  const t = l.testo.replace(/\s+/g, " ");
  const v = t.match(/([1-5])\s?[.,·]\s?(\d{1,2})/);
  const voto = v ? Number(v[1] + "." + v[2]) : null;
  const p = t.match(/\(\s*([\d.,\s]{1,9})\s*\)/) || t.match(/\(\s*([\d.,]{1,9})/) || t.replace(v?.[0] ?? "", " ").match(/(\d[\d.,]{1,8})/);
  const voti = p ? Number(p[1].replace(/[^\d]/g, "")) || null : null;
  return { voto: voto && voto >= 1 && voto <= 5 ? voto : null, voti };
}

/** Durata in ore («7 h Longevità») e scia («Forte Scia»). */
export function capisciProfilo(l: Letto) {
  const t = l.testo.replace(/\s+/g, " ");
  const d = t.match(/(\d{1,2})\s*h\b/i) || t.match(/(\d{1,2})\s*[hn]\s*Long/i);
  const durata = d ? Number(d[1]) : null;
  let scia = "";
  for (const w of t.split(/[^A-Za-zÀ-ÿ]+/)) {
    const v = piuVicina(w, SCIE);
    if (v && norm(w).length >= 4) {
      scia = v === "Intima" ? "Intimo" : v === "Moderata" ? "Moderato" : v; // come nel catalogo
      break;
    }
  }
  return { durata: durata && durata > 0 && durata < 30 ? durata : null, scia };
}

/** Il nome scritto in una barra degli accordi. */
export function capisciAccordo(l: Letto, noti: readonly string[] = ACCORDI_NOTI) {
  const t = pulisci(l.testo.split("\n").sort((a, b) => b.trim().length - a.trim().length)[0] ?? "");
  const parole = t.split(" ").filter((w) => lettere.test(w) && (w.length > 1 || /^[A-Z]/.test(w)));
  const letto = parole.join(" ");
  return piuVicina(letto, noti) ?? (letto.length >= 3 ? letto : "");
}

/** Le note sotto le icone: tre colonne; un nome lungo va a capo nella stessa colonna. */
export function capisciNote(l: Letto, larghezza: number, noti: readonly string[] = []) {
  // un nome troppo lungo la cartolina lo tronca coi puntini («Legno di Agar...»): si tolgono
  const ps = l.parole
    .map((p) => {
      const t = p.testo.trim();
      return { ...p, testo: t.replace(/(\.{2,}|…)$/, ""), tronca: /(\.{2,}|…)$/.test(t) };
    })
    .filter(
      (p) =>
        p.conf >= (p.tronca ? 30 : 45) &&
        (/^[A-Za-zÀ-ÿ'’-]{3,}$/.test(p.testo) ||
          /^(di|de|da|la|le|du|al|of)$/i.test(p.testo) ||
          /^d['’][A-Za-zÀ-ÿ]+$/.test(p.testo)) && // «Olibano (Incenso)»: il secondo nome fra parentesi resta fuori
        !/^fragrantica$/i.test(p.testo)
    );
  if (!ps.length) return [];
  // via la parola «note» in cima al riquadro
  const minY = Math.min(...ps.map((p) => p.y0));
  const parole = ps.filter((p) => !(/^note$/i.test(p.testo) && p.y0 - minY < 10));
  const hs = parole.map((p) => p.y1 - p.y0).sort((a, b) => a - b);
  const h = hs[Math.floor(hs.length / 2)] || 20;
  const col = (p: Parola) => Math.max(0, Math.min(2, Math.floor((((p.x0 + p.x1) / 2) / larghezza) * 3)));
  const etichette: { col: number; y0: number; y1: number; parole: (typeof parole)[number][] }[] = [];
  for (const p of [...parole].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    if (p.y1 - p.y0 > h * 1.8 || p.y1 - p.y0 < h * 0.5) continue; // un pezzo d'icona
    const c = col(p);
    const e = etichette.find((e) => e.col === c && p.y0 - e.y1 < h * 0.9 && p.y0 >= e.y0 - h * 0.5);
    if (e) {
      e.parole.push(p);
      e.y1 = Math.max(e.y1, p.y1);
    } else etichette.push({ col: c, y0: p.y0, y1: p.y1, parole: [p] });
  }
  // in ordine di lettura: per file di icone, poi da sinistra
  const file = [...etichette].sort((a, b) => a.y0 - b.y0);
  const ordinate: typeof etichette = [];
  for (const e of file) if (!ordinate.includes(e)) ordinate.push(...file.filter((f) => !ordinate.includes(f) && Math.abs(f.y0 - e.y0) < h * 1.5).sort((a, b) => a.col - b.col));
  return ordinate
    .map((e) => {
      const testo = e.parole
        .sort((a, b) => (Math.abs(a.y0 - b.y0) < h * 0.5 ? a.x0 - b.x0 : a.y0 - b.y0))
        .map((p) => p.testo)
        .join(" ")
        .replace(/’/g, "'")
        .replace(/\bD'/g, "d'");
      // troncato coi puntini: se una sola nota conosciuta comincia così, è quella
      if (e.parole.some((p) => p.tronca)) {
        const inizio = noti.filter((n) => norm(n).startsWith(norm(testo)));
        if (inizio.length === 1) return inizio[0];
      }
      return piuVicina(testo, noti) ?? testo;
    })
    .filter((t) => t.length >= 3);
}

/** Tutte le scritte della cartolina. */
export async function leggiCartolina(img: Immagine, misura: Misura, riconosci: Riconosci, noti: { accordi?: readonly string[]; note?: readonly string[]; marchi?: readonly string[] } = {}): Promise<Scritte> {
  const z = zone(img, misura);
  const righeTestata: { testo: string; alta: number }[] = [];
  for (const b of z.testata) righeTestata.push({ testo: (await riconosci(b.img, "riga")).testo, alta: b.alta });
  const testata = capisciTestata(righeTestata, noti.marchi ?? []);
  const voto = { voto: capisciVoto(await riconosci(z.voto, "numeri")).voto, voti: capisciVoto(await riconosci(z.voti, "blocco")).voti };
  const profilo = capisciProfilo(await riconosci(z.profilo, "blocco"));
  const accordiNoti = [...new Set([...(noti.accordi ?? []), ...ACCORDI_NOTI])];
  const accordi: string[] = [];
  for (const a of z.accordi) accordi.push(capisciAccordo(await riconosci(a, "riga"), accordiNoti));
  const note = capisciNote(await riconosci(z.note, "blocco"), z.note.width, noti.note ?? []);
  return { ...testata, ...voto, ...profilo, accordi, note };
}

// ── la piramide da una schermata ──

/** Una schermata pronta per il lettore: in grigi, sfondo bianco (anche se la schermata è in tema scuro). */
export function preparaSchermata(img: Immagine): Immagine {
  let somma = 0,
    n = 0;
  for (let i = 0; i < img.data.length; i += 4 * 97) {
    somma += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    n++;
  }
  const scura = somma / Math.max(1, n) < 110;
  const lato = Math.max(img.width, img.height);
  const scala = lato < 1400 ? 2 : 1;
  return ritaglio(img, 0, 0, img.width, img.height, scala, scura
    ? (x, y) => {
        const i = (y * img.width + x) * 4;
        return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; // il testo chiaro è l'inchiostro
      }
    : undefined);
}

const TITOLI: [keyof Note, RegExp][] = [
  ["testa", /^(testa|top|head)$/i],
  ["cuore", /^(cuore|middle|heart)$/i],
  ["fondo", /^(fondo|base)$/i]
];
const NON_NOTE = /^(note|notes|di|piramide|olfattiva|pyramid|perfume|fragrance|vota|voti|mostra|tutte|accordi|principali)$/i;

/** Le note di una schermata della piramide: i titoli «Note di testa / cuore / fondo» (o Top / Middle / Base) dicono
    il livello; sotto, i nomi delle note (sotto le icone, a volte su due righe). Senza titoli, tutte nel cuore. */
export function capisciPiramide(l: Letto, noti: readonly string[] = []): Note {
  const ps = l.parole
    .map((p) => ({ ...p, testo: p.testo.trim().replace(/[.,;:]+$/, "") }))
    .filter((p) => p.conf >= 45 && /^[A-Za-zÀ-ÿ'’()-]{2,}$/.test(p.testo));
  const hs = ps.map((p) => p.y1 - p.y0).sort((a, b) => a - b);
  const h = hs[Math.floor(hs.length / 2)] || 20;
  // i titoli, dall'alto
  const titoli = ps
    .map((p) => ({ p, livello: TITOLI.find(([, re]) => re.test(p.testo))?.[0] }))
    .filter((t): t is { p: Parola; livello: keyof Note } => !!t.livello)
    .sort((a, b) => a.p.y0 - b.p.y0);
  const suUnTitolo = (p: Parola) => titoli.some((t) => Math.abs((t.p.y0 + t.p.y1) / 2 - (p.y0 + p.y1) / 2) < h * 0.6);
  // le parole in righe, le righe in etichette (uno spazio largo separa due note sulla stessa riga)
  const parole = ps.filter((p) => !suUnTitolo(p) && p.y1 - p.y0 < h * 1.8).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const etichette: { x0: number; x1: number; y0: number; y1: number; testo: string }[] = [];
  for (const p of parole) {
    const accanto = etichette.find((e) => Math.abs(e.y0 - p.y0) < h * 0.5 && p.x0 - e.x1 < h * 0.8 && p.x0 >= e.x0);
    if (accanto) {
      accanto.testo += " " + p.testo;
      accanto.x1 = p.x1;
      accanto.y1 = Math.max(accanto.y1, p.y1);
      continue;
    }
    // la seconda riga di un nome lungo: subito sotto, centrata sulla stessa colonna
    const sopra = etichette.find((e) => p.y0 - e.y1 >= -2 && p.y0 - e.y1 < h * 0.7 && Math.abs((p.x0 + p.x1) / 2 - (e.x0 + e.x1) / 2) < Math.max(e.x1 - e.x0, p.x1 - p.x0) * 0.6);
    if (sopra) {
      sopra.testo += " " + p.testo;
      sopra.y1 = p.y1;
      sopra.x0 = Math.min(sopra.x0, p.x0);
      sopra.x1 = Math.max(sopra.x1, p.x1);
      continue;
    }
    etichette.push({ x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1, testo: p.testo });
  }
  const out: Note = { testa: [], cuore: [], fondo: [] };
  for (const e of etichette.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)) {
    const testo = e.testo.replace(/\s*\([^)]*\)?/g, "").replace(/’/g, "'").trim();
    if (testo.length < 3 || testo.split(" ").every((w) => NON_NOTE.test(w))) continue;
    const livello = [...titoli].reverse().find((t) => t.p.y0 < e.y0)?.livello ?? (titoli.length ? null : "cuore");
    if (!livello) continue; // sopra il primo titolo: non è la piramide
    const nota = piuVicina(testo, noti) ?? testo;
    if (!out[livello].includes(nota)) out[livello].push(nota);
  }
  return out;
}

/** Le parole di Tesseract (blocks ▸ paragraphs ▸ lines ▸ words) in un elenco semplice. */
export function daTesseract(data: {
  text?: string;
  blocks?: { paragraphs: { lines: { words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] | null;
}): Letto {
  const parole: Parola[] = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines) for (const w of l.words) parole.push({ testo: w.text, conf: w.confidence, ...w.bbox });
  return { testo: data.text ?? "", parole };
}
