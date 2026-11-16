/* La misura delle barre della «cartolina» di Fragrantica (l'immagine quadrata che l'app Fragrantica fa con
   Condividi): accordi con la forza, stagioni, giorno/notte. Nessuna IA: si guardano i pixel, come la misura
   al pixel fatta finora a mano. Funziona su qualunque immagine RGBA (un canvas nel telefono, un PNG nelle prove).

   La cartolina ha sempre la stessa impaginazione (1092 o 1200 px di lato, la seconda è la prima ingrandita):
   le misure qui sono in frazioni del lato. Le barre però si cercano davvero, riga per riga, e si misurano
   confrontando i loro pixel con lo sfondo vicino: se cambia un colore, la misura regge.
   Tarata sulle 38 cartoline di Danilo contro i valori del database (app/strumenti/tara-cartoline.mjs).
   Solo sintassi «cancellabile» (niente enum): Node la usa così com'è nelle prove. */

export interface Immagine {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}
export interface Stagioni {
  inverno: number;
  primavera: number;
  estate: number;
  autunno: number;
}
export interface Riquadro {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Misura {
  /** forza degli accordi, dal primo (100) all'ultimo, nell'ordine della cartolina */
  accordi: number[];
  /** stagioni riportate a 100 (null se non trovate) */
  stagioni: Stagioni | null;
  /** le stagioni come misurate, prima di riportarle a 100 */
  stagioniGrezze: Stagioni | null;
  giornoPct: number | null;
  /** dove sta la boccetta, in pixel dell'immagine */
  boccetta: Riquadro;
  /** quello che non torna, da far guardare a chi aggiunge */
  dubbi: string[];
  /** dove ha trovato le barre degli accordi (per la taratura) */
  traccia?: { su: number; giu: number; sx: number; dx: number }[];
}

const SOGLIA = 18; // differenza minima (somma dei tre canali) fra il bordo di una barra e lo sfondo
const SOGLIA_STRISCE = 24; // per trovare le barre scorrendo una colonna (le ombre restano sotto)
const COLORE = 60; // un riempimento delle stagioni è colorato: max - min dei canali oltre questa soglia

type Rgb = [number, number, number];
const NOMI_STAGIONI: Record<string, string> = { inverno: "l'inverno", primavera: "la primavera", estate: "l'estate", autunno: "l'autunno" };

export function misuraCartolina(img: Immagine): Misura {
  const W = img.width,
    H = img.height,
    d = img.data;
  const dubbi: string[] = [];
  if (Math.abs(W - H) > 4 || W < 500) dubbi.push("Non sembra una cartolina di Fragrantica: dovrebbe essere quadrata.");
  const px = (x: number, y: number): Rgb => {
    const i = (Math.round(y) * W + Math.round(x)) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  const diff = (a: Rgb, b: Rgb) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const tinta = (c: Rgb) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  const X = (f: number) => Math.round(f * W);
  const Y = (f: number) => Math.round(f * H);
  // dentro i riquadri bianchi, a sinistra delle barre: il loro sfondo
  const xFondo = X(0.405);

  /** Le strisce verticali (y da/a) dove la colonna x esce dallo sfondo del riquadro, fra y0 e y1.
      Due pezzi separati da pochi pixel sono una striscia sola (una barra chiarissima si vede a tratti). */
  function strisce(x: number, y0: number, y1: number, min: number, max: number) {
    const profilo: number[] = [];
    for (let y = y0; y <= y1; y++) profilo.push(diff(px(x, y), px(xFondo, y)));
    // i tratti sopra la soglia; dentro un tratto, un'ombra fra due barre scure resta sotto metà del massimo
    const tratti = (da: number, a: number, soglia: number) => {
      const out: { su: number; giu: number }[] = [];
      let su = -1;
      for (let i = da; i <= a + 1; i++) {
        const dentro = i <= a && profilo[i] > soglia;
        if (dentro && su < 0) su = i;
        if (!dentro && su >= 0) {
          out.push({ su, giu: i - 1 });
          su = -1;
        }
      }
      return out;
    };
    const pezzi: { su: number; giu: number }[] = [];
    for (const t of tratti(0, profilo.length - 1, SOGLIA_STRISCE)) {
      const alto = Math.max(...profilo.slice(t.su, t.giu + 1));
      const sotto = t.giu - t.su + 1 > max ? tratti(t.su, t.giu, alto * 0.5) : [t];
      // un pezzo appena staccato (anti-aliasing) si riattacca
      for (const p of sotto) {
        const ultimo = pezzi[pezzi.length - 1];
        if (ultimo && p.su - ultimo.giu <= X(0.003) && p.giu - ultimo.su + 1 <= max) ultimo.giu = p.giu;
        else pezzi.push({ ...p });
      }
    }
    return pezzi
      .filter((p) => p.giu - p.su + 1 >= min && p.giu - p.su + 1 <= max)
      .map((p) => ({ su: p.su + y0, giu: p.giu + y0 }));
  }
  /** Il bordo sinistro di una barra sulla riga y: il primo pixel, da xa verso destra, diverso dallo sfondo. */
  function bordoSinistro(y: number, xa: number, xb: number) {
    const fondo = px(xFondo, y);
    for (let x = xa; x <= xb; x++) if (diff(px(x, y), fondo) > SOGLIA && diff(px(x + 1, y), fondo) > SOGLIA) return x;
    return -1;
  }
  /** Il bordo destro: da xb verso sinistra, sulla stessa riga, il primo scalino netto fra i pixel appena a
      sinistra e quelli appena a destra (medie di tre: lo sfondo ha una grana leggera). Lo sfondo sfuma piano,
      l'ombra della barra pure; il bordo della barra no. */
  function bordoDestro(y: number, xa: number, xb: number) {
    const media = (x0: number): Rgb => {
      const a = px(x0, y),
        b = px(x0 + 1, y),
        c = px(x0 + 2, y);
      return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    };
    const passo = Math.max(3, X(0.003));
    for (let x = xb; x >= xa; x--) if (diff(media(x - 2), media(x + passo)) > SOGLIA && diff(px(x, y), media(x + passo)) > SOGLIA / 2) return x;
    return -1;
  }

  // ── accordi: barre colorate nel riquadro in alto a destra ──
  const trovate = strisce(X(0.425), Y(0.16), Y(0.515), X(0.035), X(0.07));
  /* Una barra chiarissima (Floreale Bianco, Muschiato) quasi non si stacca dallo sfondo: le barre hanno
     tutte la stessa altezza e lo stesso passo, quindi si cerca, con una soglia più bassa, dove dovrebbe stare. */
  const barre: { su: number; giu: number }[] = [];
  if (trovate.length) {
    const alta = trovate[0].giu - trovate[0].su;
    const passi = trovate.slice(1).map((b, i) => b.su - trovate[i].su).filter((p) => p < X(0.07));
    const passo = passi.length ? Math.min(...passi) : X(0.0543);
    // la cartolina mostra al più cinque accordi
    for (let su = trovate[0].su; su + alta <= Y(0.515) && barre.length < 5; su += passo) {
      const vicina = trovate.find((b) => Math.abs(b.su - su) < passo / 3);
      if (vicina) {
        barre.push(vicina);
        su = vicina.su;
        continue;
      }
      const yc = Math.round(su + alta / 2);
      const chiara = [0.425, 0.44, 0.46].every((f) => diff(px(X(f), yc), px(xFondo, yc)) > 10);
      if (chiara) barre.push({ su, giu: su + alta });
      else break;
    }
  }
  // l'altezza di una barra (senza l'ombra, che a volte si attacca sotto): quella più comune
  const altaTipica = barre.length ? [...barre.map((b) => b.giu - b.su)].sort((a, b) => a - b)[Math.floor((barre.length - 1) / 2)] : 0;
  const larghezze: number[] = [];
  const traccia: { su: number; giu: number; sx: number; dx: number }[] = [];
  barre.forEach((b) => {
    const y = Math.round((b.su + b.giu) / 2);
    const sx = bordoSinistro(y, xFondo + 1, X(0.5));
    let dx = bordoDestro(y, X(0.42), X(0.937));
    /* una barra chiarissima: lo scalino si confonde con la grana. Si guarda una riga sotto la scritta e si
       prende l'ultimo tratto che somiglia più al colore della barra che allo sfondo a destra. */
    const y85 = Math.round(b.su + altaTipica * 0.8);
    const media = (x0: number): Rgb => {
      const a = px(x0, y85),
        c = px(x0 + 1, y85),
        e = px(x0 + 2, y85);
      return [(a[0] + c[0] + e[0]) / 3, (a[1] + c[1] + e[1]) / 3, (a[2] + c[2] + e[2]) / 3];
    };
    if (sx >= 0) {
      const colore = media(sx + 8),
        fondo = media(X(0.937));
      if (diff(colore, fondo) < 40) {
        const barra = (x: number) => diff(media(x), colore) < diff(media(x), fondo);
        for (let x = X(0.937); x > sx + 6; x--)
          if (barra(x - 2) && barra(x - 4) && barra(x - 6)) {
            dx = x;
            break;
          }
      }
    }
    // una barra ben colorata: vicino allo scalino, l'ultimo pixel del suo colore (più preciso dello scalino)
    if (sx >= 0 && dx > sx + 12) {
      const colore = px(dx - 8, y),
        fondo = px(dx + 8, y);
      if (diff(colore, fondo) > 60) {
        // della barra: più vicino al suo colore che allo sfondo; un pixel storto (la grana) non ferma
        const barra = (x: number) => diff(px(x, y), colore) < diff(px(x, y), fondo);
        let fine = dx - 8;
        while (fine < dx + 6 && (barra(fine + 1) || barra(fine + 2))) fine++;
        dx = fine;
      }
    }
    traccia.push({ su: b.su, giu: b.giu, sx, dx });
  });
  // le barre partono tutte dallo stesso punto: si prende il bordo che trovano quasi tutte (su una barra
  // chiarissima il bordo si confonde con lo sfondo e si troverebbe la scritta)
  const partenze = traccia.map((t) => t.sx).filter((x) => x >= 0);
  const inizio = partenze.length ? [...partenze].sort((a, b) => a - b)[Math.floor((partenze.length - 1) / 2)] : -1;
  for (const t of traccia) if (inizio >= 0 && t.dx > inizio) larghezze.push(t.dx - inizio + 1);
  const piena = larghezze[0] || 1;
  const accordi = larghezze.map((l) => Math.min(100, Math.round((l / piena) * 100)));
  if (!accordi.length) dubbi.push("Non trovo le barre degli accordi.");
  else if (accordi.some((a, i) => i > 0 && a > accordi[i - 1] + 1)) dubbi.push("Gli accordi non scendono in ordine: controllali sulla cartolina.");

  // ── giorno e notte: una barra divisa in due ──
  let giornoPct: number | null = null;
  const gn = strisce(X(0.425), Y(0.64), Y(0.79), X(0.035), X(0.07));
  if (gn.length) {
    const b = gn[0],
      y = Math.round(b.su + (b.giu - b.su) * 0.2);
    const sx = bordoSinistro(y, xFondo + 1, X(0.5));
    const dx = bordoDestro(y, X(0.42), X(0.937));
    if (sx >= 0 && dx > sx) {
      const giorno = px(sx + 4, y),
        notte = px(dx - 4, y);
      if (diff(giorno, notte) < 40) {
        // una tinta sola: tutto giorno (azzurro) o tutta notte (grigio)
        giornoPct = giorno[2] > giorno[0] + 25 ? 100 : 0;
      } else {
        let confine = dx + 1;
        for (let x = sx; x <= dx; x++)
          if (diff(px(x, y), notte) < diff(px(x, y), giorno) && diff(px(x + 2, y), notte) < diff(px(x + 2, y), giorno)) {
            confine = x;
            break;
          }
        giornoPct = Math.round(((confine - sx) / (dx - sx + 1)) * 100);
      }
    }
  }
  if (giornoPct === null) dubbi.push("Non trovo la barra giorno/notte.");

  // ── stagioni: quattro binari grigi, ognuno riempito da sinistra con un colore ──
  let stagioniGrezze: Stagioni | null = null;
  const righe = strisce(X(0.55), Y(0.78), Y(0.98), X(0.035), X(0.07));
  if (righe.length >= 2) {
    const misure: number[] = [];
    for (const r of righe.slice(0, 2)) {
      const y = Math.round(r.su + (r.giu - r.su) * 0.18);
      const fondo = px(xFondo, y);
      // binario di sinistra e di destra: i bordi esterni e lo stacco nel mezzo
      const l1 = bordoSinistro(y, xFondo + 1, X(0.5));
      let r1 = -1;
      for (let x = X(0.6); x < X(0.72); x++)
        if (diff(px(x, y), fondo) <= SOGLIA && diff(px(x + 1, y), fondo) <= SOGLIA) {
          r1 = x - 1;
          break;
        }
      const l2 = r1 > 0 ? bordoSinistro(y, r1 + 2, X(0.75)) : -1;
      const r2 = bordoDestro(y, X(0.7), X(0.937));
      for (const [a, b] of [
        [l1, r1],
        [l2, r2]
      ]) {
        if (a < 0 || b <= a) {
          misure.push(NaN);
          continue;
        }
        let fine = a - 1;
        for (let x = b; x >= a; x--)
          if (tinta(px(x, y)) > COLORE && tinta(px(x - 1, y)) > COLORE) {
            fine = x;
            break;
          }
        misure.push(((fine - a + 1) / (b - a + 1)) * 100);
      }
    }
    if (misure.every((m) => Number.isFinite(m))) {
      // sulla cartolina: inverno, primavera / estate, autunno
      stagioniGrezze = { inverno: misure[0], primavera: misure[1], estate: misure[2], autunno: misure[3] };
    }
  }
  let stagioni: Stagioni | null = null;
  if (stagioniGrezze) {
    const somma = Object.values(stagioniGrezze).reduce((a, b) => a + b, 0);
    stagioni = aCento(stagioniGrezze);
    if (Math.abs(somma - 100) > 12) dubbi.push(`Le stagioni misurate fanno ${Math.round(somma)} invece di 100: guardale sulla cartolina.`);
    // la cartolina non disegna una stagione più corta della sua icona (circa 10): sotto, non si sa quanto
    for (const [k, v] of Object.entries(stagioniGrezze))
      if (v < 12.5) dubbi.push(`Sulla cartolina ${NOMI_STAGIONI[k]} è al minimo: su Fragrantica potrebbe essere meno di ${v < 11.5 ? 10 : 11}.`);
  } else dubbi.push("Non trovo le barre delle stagioni.");

  const boccetta = { x: X(0.04), y: Y(0.117), w: X(0.34), h: Y(0.428) };
  return {
    accordi,
    stagioni,
    stagioniGrezze: stagioniGrezze && (Object.fromEntries(Object.entries(stagioniGrezze).map(([k, v]) => [k, Math.round(v * 10) / 10])) as unknown as Stagioni),
    giornoPct,
    boccetta,
    dubbi,
    traccia
  };
}

/** Riporta le stagioni a 100 con interi (il resto va a chi ha la parte decimale più grande). */
export function aCento(s: Stagioni): Stagioni {
  const k = ["inverno", "primavera", "estate", "autunno"] as const;
  const somma = k.reduce((a, c) => a + s[c], 0) || 1;
  const esatti = k.map((c) => (s[c] / somma) * 100);
  const interi = esatti.map(Math.floor);
  let resto = 100 - interi.reduce((a, b) => a + b, 0);
  esatti
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (resto > 0) {
        interi[i]++;
        resto--;
      }
    });
  return { inverno: interi[0], primavera: interi[1], estate: interi[2], autunno: interi[3] };
}
