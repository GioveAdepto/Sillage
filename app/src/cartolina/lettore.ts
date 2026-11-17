/* Il lettore di testo nel telefono: Tesseract (tesseract.js), gratis, senza chiavi, come lo scontorno di CheMetto.
   Si scarica solo la prima volta che si legge una cartolina (il programma da cdn.jsdelivr.net, circa 3 MB, e
   l'italiano, circa 3 MB); poi resta nel telefono (il service worker e Tesseract stesso lo tengono) e funziona
   anche senza rete. Mai nella cache iniziale dell'app.

   Nelle prove automatiche (build con VITE_LETTORE=finto) un lettore finto risponde sempre le stesse scritte:
   niente download nelle prove. La lettura vera si tara in Node con app/strumenti/tara-scritte.mjs. */
import type { Immagine, Misura } from "./misura";
import { capisciPiramide, daTesseract, leggiCartolina, preparaSchermata, type Note, type Riconosci, type Scritte } from "./scritte";

export type Avanza = (cosa: string, quanto?: number) => void;
let pronto: Promise<Riconosci> | null = null;

/** Il lettore vero, preparato una volta sola. */
function lettore(avanza?: Avanza): Promise<Riconosci> {
  pronto ??= (async () => {
    avanza?.("Preparo il lettore");
    const { createWorker, PSM } = await import("tesseract.js");
    const w = await createWorker("ita", 1, {
      logger: (m: { status: string; progress: number }) => {
        if (/loading|download/i.test(m.status)) avanza?.("Scarico il lettore (solo la prima volta)", m.progress);
      }
    });
    let modo = "";
    return async (img: Immagine, m: string) => {
      if (m !== modo) {
        await w.setParameters({
          tessedit_pageseg_mode: m === "riga" ? PSM.SINGLE_LINE : m === "sparso" ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK,
          tessedit_char_whitelist: m === "numeri" ? "0123456789.,()" : ""
        });
        modo = m;
      }
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
      const { data } = await w.recognize(c, {}, { text: true, blocks: true });
      return daTesseract(data as Parameters<typeof daTesseract>[0]);
    };
  })();
  // se non è riuscito (niente rete al primo uso), la volta dopo si riprova
  pronto.catch(() => (pronto = null));
  return pronto;
}

const FINTO = import.meta.env.VITE_LETTORE === "finto";
/** Il lettore finto delle prove: «rotto» se la prova lo chiede (localStorage sillage-prova:lettore). */
const fintoRotto = () => {
  try {
    return localStorage.getItem("sillage-prova:lettore") === "rotto";
  } catch {
    return false;
  }
};

/** Le scritte della cartolina, lette nel telefono. */
export async function scritteDellaCartolina(img: Immagine, misura: Misura, noti: Parameters<typeof leggiCartolina>[3], avanza?: Avanza): Promise<Scritte> {
  if (FINTO) {
    await new Promise((r) => setTimeout(r, 300));
    if (fintoRotto()) throw new Error("lettore finto rotto");
    return {
      nome: "Profumo di Prova",
      conc: "", // la cartolina sintetica non la dice: resta da scegliere
      marchio: "Casa di Prova",
      genere: "unisex",
      voto: 4.1,
      voti: 1234,
      durata: 7,
      scia: "Forte",
      accordi: ["Legnoso", "Aromatico", "Terroso", "Muschiato", "Speziato Fresco"].slice(0, misura.accordi.length || 5),
      note: ["Vetiver", "Cipresso", "Muschio"]
    };
  }
  const riconosci = await lettore(avanza);
  avanza?.("Leggo le scritte");
  return leggiCartolina(img, misura, riconosci as Riconosci, noti);
}

/** Le note di testa, cuore e fondo da una schermata della piramide. */
export async function noteDellaSchermata(img: Immagine, noti: readonly string[], avanza?: Avanza): Promise<Note> {
  if (FINTO) {
    await new Promise((r) => setTimeout(r, 300));
    if (fintoRotto()) throw new Error("lettore finto rotto");
    return { testa: ["Bergamotto", "Limone"], cuore: ["Lavanda"], fondo: ["Vetiver", "Muschio"] };
  }
  const riconosci = await lettore(avanza);
  avanza?.("Leggo la schermata");
  return capisciPiramide(await riconosci(preparaSchermata(img), "sparso"), noti);
}
