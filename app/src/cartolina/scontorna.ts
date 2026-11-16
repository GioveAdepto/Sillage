/* «Una tua foto»: lo scontorno nel telefono con @imgly/background-removal, come CheMetto. La libreria e il suo
   modello (circa 44 MB, dal server di img.ly) si scaricano solo la prima volta che serve: il pezzo di codice è a
   parte (vite.config.ts, «scontorno») e non entra nella cache dell'installazione. Sul processore, qualche secondo. */
import type { Immagine } from "./misura";
import { apri } from "./immagini";

type Avanzamento = (testo: string, percento: number | null) => void;

/** La foto con lo sfondo trasparente, ritagliata attorno alla boccetta. */
export async function scontorna(foto: Blob, avanza?: Avanzamento): Promise<Immagine> {
  avanza?.("Preparo lo scontorno", null);
  const lib = await import("@imgly/background-removal");
  const png = await lib.removeBackground(foto, {
    model: "isnet_quint8",
    device: "cpu",
    output: { format: "image/png" },
    progress: (chiave: string, ora: number, tot: number) => {
      if (chiave.startsWith("fetch:") && tot > 0) avanza?.("Scarico lo scontorno", Math.round((ora / tot) * 100));
      else if (chiave.startsWith("compute")) avanza?.("Scontorno la foto", null);
    }
  });
  return rifila(await apri(png));
}

/** Toglie i bordi trasparenti, lasciando un filo di margine. */
export function rifila(img: Immagine): Immagine {
  const { width: w, height: h, data: d } = img;
  let a = w,
    b = h,
    c = -1,
    e = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < a) a = x;
        if (x > c) c = x;
        if (y < b) b = y;
        if (y > e) e = y;
      }
  if (c < 0) return img;
  const m = Math.round(Math.max(w, h) * 0.01);
  a = Math.max(0, a - m);
  b = Math.max(0, b - m);
  c = Math.min(w - 1, c + m);
  e = Math.min(h - 1, e + m);
  const ow = c - a + 1,
    oh = e - b + 1,
    out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) out.set(d.subarray(((b + y) * w + a) * 4, ((b + y) * w + a + ow) * 4), y * ow * 4);
  return { width: ow, height: oh, data: out };
}
