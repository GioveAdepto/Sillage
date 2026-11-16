/* Le immagini nel telefono, per «Aggiungi profumo»: aprire la foto scelta dal rullino, rimpicciolirla per il
   modello che legge le scritte, e preparare la foto della boccetta (webp, ~600 px, base64) per il ponte. */
import type { Immagine } from "./misura";

/** I pixel di un'immagine scelta dal rullino (PNG, JPEG, HEIC dove Safari lo apre). */
export async function apri(file: Blob): Promise<Immagine> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  bmp.close?.();
  const d = g.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

/** Disegna un'immagine RGBA su un canvas, rimpicciolita perché il lato più lungo stia in `lato`. */
function suCanvas(img: Immagine, lato: number) {
  const sorgente = document.createElement("canvas");
  sorgente.width = img.width;
  sorgente.height = img.height;
  sorgente.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  const k = Math.min(1, lato / Math.max(img.width, img.height));
  if (k === 1) return sorgente;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(sorgente, 0, 0, c.width, c.height);
  return c;
}

const aBlob = (c: HTMLCanvasElement, tipo: string, q: number) =>
  new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("immagine non creata"))), tipo, q));

export async function base64(b: Blob): Promise<string> {
  const byte = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Per il modello: un JPEG di al più 1200 px, abbastanza per leggere le scritte piccole, leggero da spedire. */
export async function perIlModello(img: Immagine) {
  const b = await aBlob(suCanvas(img, 1200), "image/jpeg", 0.88);
  return { media: "image/jpeg", dati: await base64(b) };
}

/** La foto della boccetta per il ponte: webp (o PNG dove il telefono non sa fare webp), alta al più 600 px. */
export async function fotoPerIlPonte(img: Immagine) {
  const c = suCanvas(img, 600);
  let b = await aBlob(c, "image/webp", 0.86);
  // Safari meno recente non scrive webp: restituisce un PNG, che va bene lo stesso
  if (b.type !== "image/webp") b = await aBlob(c, "image/png", 1);
  return { tipo: b.type, dati: await base64(b), anteprima: URL.createObjectURL(b) };
}
