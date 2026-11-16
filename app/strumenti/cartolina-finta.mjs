/* Una «cartolina» sintetica, disegnata qui con rettangoli: stessa impaginazione di quelle di Fragrantica (barre
   degli accordi, giorno/notte, stagioni, boccetta), valori noti, un po' di grana nello sfondo e «scritte» scure
   dentro le barre. Nessuna immagine di Fragrantica entra nel repo: le prove usano queste.

   node strumenti/cartolina-finta.mjs        rifà prove/cartoline/sintetica-1092.png (la usa la prova nel browser;
                                             le altre la prova della misura le disegna al volo) */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

/** { width, height, data } RGBA di una cartolina con questi valori. */
export function disegna({ lato = 1092, accordi, stagioni, giorno, seme = 7 }) {
  const k = lato / 1092, W = lato, H = lato;
  const data = new Uint8ClampedArray(W * H * 4);
  let s = seme;
  const caso = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const riempi = (x0, y0, x1, y1, c, grana = 0) => {
    for (let y = Math.round(y0 * k); y < Math.round(y1 * k); y++)
      for (let x = Math.round(x0 * k); x < Math.round(x1 * k); x++) {
        const i = (y * W + x) * 4, g = grana ? Math.round((caso() - 0.5) * 2 * grana) : 0;
        data[i] = c[0] + g; data[i + 1] = c[1] + g; data[i + 2] = c[2] + g; data[i + 3] = 255;
      }
  };
  // sfondo: una sfumatura chiara con un filo di grana
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, t = (x + y) / (W + H), g = Math.round((caso() - 0.5) * 6);
    data[i] = 236 - 6 * t + g; data[i + 1] = 228 + 8 * t + g; data[i + 2] = 226 + 4 * t + g; data[i + 3] = 255;
  }
  riempi(0, 0, 1092, 125, [244, 240, 236], 2); // testata
  riempi(940, 8, 1035, 95, [30, 30, 30]); // il QR
  // la boccetta
  riempi(170, 155, 280, 300, [70, 46, 30]);
  riempi(95, 300, 360, 565, [22, 22, 26]);
  riempi(130, 400, 330, 420, [200, 200, 200]);
  // riquadro degli accordi
  const pannello = [242, 243, 243];
  riempi(437, 143, 1037, 518, pannello, 2);
  const pieno = 564;
  const colori = [[120, 70, 22], [58, 161, 138], [84, 64, 46], [238, 242, 250], [127, 195, 43], [190, 80, 160]];
  accordi.forEach((f, i) => {
    const y = 209 + 59.25 * i, w = Math.round((pieno * f) / 100);
    riempi(455, y + 50, 455 + w + 4, y + 54, [210, 210, 210]); // l'ombra
    riempi(455, y, 455 + w, y + 50, colori[i % colori.length]);
    riempi(473, y + 16, 473 + Math.min(150, w - 40), y + 34, i === 3 ? [40, 40, 40] : [250, 250, 250]); // la scritta
  });
  // giorno e notte
  riempi(437, 690, 1037, 824, pannello, 2);
  const confine = 455 + Math.round((564 * giorno) / 100);
  riempi(455, 755, confine, 809, [175, 216, 246]);
  riempi(confine, 755, 1019, 809, [126, 126, 134]);
  riempi(540, 770, 640, 795, [90, 90, 90]); // «Giorno»
  // stagioni: binari grigi riempiti da sinistra, con l'icona sopra
  riempi(437, 853, 1037, 1073, pannello, 2);
  const tinte = { inverno: [74, 155, 230], primavera: [150, 215, 100], estate: [251, 191, 59], autunno: [226, 112, 44] };
  [["inverno", 455, 919], ["primavera", 743, 919], ["estate", 455, 985], ["autunno", 743, 985]].forEach(([n, x, y]) => {
    riempi(x, y, x + 276, y + 54, [209, 212, 221]);
    riempi(x, y, x + Math.round((276 * stagioni[n]) / 100), y + 54, tinte[n]);
    riempi(x + 6, y + 15, x + 30, y + 39, [255, 240, 120]); // l'icona
    riempi(x + 46, y + 18, x + 120, y + 36, [110, 110, 120]); // il nome
  });
  return { width: W, height: H, data };
}

/** Le cartoline delle prove, con i valori che la misura deve trovare. */
export const ESEMPI = [
  { nome: "sintetica-1092.png", lato: 1092, accordi: [100, 82, 60, 58, 51], stagioni: { inverno: 33, primavera: 18, estate: 11, autunno: 38 }, giorno: 47 },
  { nome: "sintetica-1200.png", lato: 1200, accordi: [100, 97, 90, 84, 80], stagioni: { inverno: 42, primavera: 14, estate: 12, autunno: 32 }, giorno: 66 },
  { nome: "sintetica-chiara.png", lato: 1092, accordi: [100, 74, 67, 65, 57], stagioni: { inverno: 13, primavera: 37, estate: 36, autunno: 14 }, giorno: 70 }
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "prove", "cartoline");
  mkdirSync(dir, { recursive: true });
  for (const e of ESEMPI.slice(0, 1)) {
    const img = disegna(e), png = new PNG({ width: img.width, height: img.height });
    png.data = Buffer.from(img.data);
    writeFileSync(join(dir, e.nome), PNG.sync.write(png, { colorType: 2 }));
    console.log("scritta", e.nome);
  }
}
