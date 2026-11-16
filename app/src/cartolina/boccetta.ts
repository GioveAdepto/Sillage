/* La boccetta ritagliata dalla cartolina, senza lo sfondo: la foto di partenza di un profumo nuovo.
   Lo sfondo della cartolina è una sfumatura chiara e liscia; si «allaga» dai bordi del ritaglio tutto quello che
   le somiglia, e resta la boccetta (il pezzo più grande; scritte e stelline sparse vanno via).
   Niente IA e niente scaricamenti: per una foto propria c'è lo scontorno vero (src/cartolina/scontorna.ts). */
import type { Immagine, Riquadro } from "./misura";

const SIMILE = 42; // somma delle differenze dei tre canali entro cui un pixel è ancora sfondo

export function ritagliaBoccetta(img: Immagine, r: Riquadro): Immagine | null {
  const W = img.width,
    d = img.data;
  const x0 = Math.max(0, r.x),
    y0 = Math.max(0, r.y);
  const w = Math.min(r.w, W - x0),
    h = Math.min(r.h, img.height - y0);
  if (w < 20 || h < 20) return null;
  const at = (x: number, y: number) => ((y0 + y) * W + (x0 + x)) * 4;

  // lo sfondo riga per riga: la media dei bordi a sinistra e a destra, e in mezzo una sfumatura lineare
  const sx: number[][] = [],
    dx: number[][] = [];
  for (let y = 0; y < h; y++) {
    const media = (xa: number) => {
      const m = [0, 0, 0];
      for (let x = xa; x < xa + 4; x++) for (let c = 0; c < 3; c++) m[c] += d[at(x, y) + c] / 4;
      return m;
    };
    sx.push(media(0));
    dx.push(media(w - 4));
  }
  const sfondo = new Uint8Array(w * h); // 1 = sfondo raggiunto dai bordi
  const simile = (x: number, y: number) => {
    const t = x / (w - 1),
      i = at(x, y);
    let s = 0;
    for (let c = 0; c < 3; c++) s += Math.abs(d[i + c] - (sx[y][c] * (1 - t) + dx[y][c] * t));
    return s < SIMILE;
  };
  const coda: number[] = [];
  const entra = (x: number, y: number) => {
    const k = y * w + x;
    if (!sfondo[k] && simile(x, y)) {
      sfondo[k] = 1;
      coda.push(k);
    }
  };
  for (let x = 0; x < w; x++) {
    entra(x, 0);
    entra(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    entra(0, y);
    entra(w - 1, y);
  }
  while (coda.length) {
    const k = coda.pop()!,
      x = k % w,
      y = (k - x) / w;
    if (x > 0) entra(x - 1, y);
    if (x < w - 1) entra(x + 1, y);
    if (y > 0) entra(x, y - 1);
    if (y < h - 1) entra(x, y + 1);
  }

  // i pezzi rimasti: si tiene il più grande e quelli grandi almeno un sesto (un tappo staccato)
  const pezzo = new Int32Array(w * h).fill(-1);
  const aree: number[] = [];
  for (let k = 0; k < w * h; k++) {
    if (sfondo[k] || pezzo[k] >= 0) continue;
    const n = aree.length;
    let area = 0;
    const pila = [k];
    pezzo[k] = n;
    while (pila.length) {
      const q = pila.pop()!,
        x = q % w,
        y = (q - x) / w;
      area++;
      for (const v of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1])
        if (v >= 0 && !sfondo[v] && pezzo[v] < 0) {
          pezzo[v] = n;
          pila.push(v);
        }
    }
    aree.push(area);
  }
  if (!aree.length) return null;
  const grande = Math.max(...aree);
  if (grande < w * h * 0.03) return null; // niente che somigli a una boccetta
  const tieni = aree.map((a) => a >= grande / 6);

  // il riquadro di quello che resta, con un filo di margine
  let a = w,
    b = h,
    c = -1,
    e = -1;
  for (let k = 0; k < w * h; k++)
    if (pezzo[k] >= 0 && tieni[pezzo[k]]) {
      const x = k % w,
        y = (k - x) / w;
      a = Math.min(a, x);
      b = Math.min(b, y);
      c = Math.max(c, x);
      e = Math.max(e, y);
    }
  const m = 4;
  a = Math.max(0, a - m);
  b = Math.max(0, b - m);
  c = Math.min(w - 1, c + m);
  e = Math.min(h - 1, e + m);
  const ow = c - a + 1,
    oh = e - b + 1;
  const out = new Uint8ClampedArray(ow * oh * 4);
  const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && pezzo[y * w + x] >= 0 && tieni[pezzo[y * w + x]];
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const X = a + x,
        Y = b + y,
        i = at(X, Y),
        o = (y * ow + x) * 4;
      if (!dentro(X, Y)) continue;
      out[o] = d[i];
      out[o + 1] = d[i + 1];
      out[o + 2] = d[i + 2];
      // sul bordo mezza trasparenza: il contorno non resta seghettato
      const vicini = [dentro(X - 1, Y), dentro(X + 1, Y), dentro(X, Y - 1), dentro(X, Y + 1)].filter(Boolean).length;
      out[o + 3] = vicini === 4 ? 255 : 140;
    }
  return { width: ow, height: oh, data: out };
}
