import type { Profumo } from "../tipi";
import { STAGIONI, accordiConForza, immagine, piega, voto } from "../profumo";

/* La scheda da condividere (condividiScheda in js/viste.js): un'immagine verticale 1080×1350, il formato dei post,
   nello stile Boutique in penombra: la boccetta sul piedistallo sotto il faretto, nome, accordi con la loro forza,
   stagioni, voto. Dove il telefono lo permette si apre il foglio di condivisione, altrimenti si scarica. */
export async function condividiScheda(p: Profumo) {
  try {
    await document.fonts.load("500 74px 'Cormorant Garamond'");
    await document.fonts.load("500 26px Jost");
  } catch {
    /* i caratteri di ripiego vanno bene lo stesso */
  }
  const W = 1080,
    H = 1350,
    cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  // la parete in penombra, con le venature
  g.fillStyle = "#1a1714";
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 19) {
    g.fillStyle = y % 38 ? "rgba(255,232,190,.022)" : "rgba(255,232,190,.035)";
    g.fillRect(0, y, W, 1);
  }
  // il faretto e il suo fascio
  g.fillStyle = "#b8975a";
  g.fillRect(W * 0.3, 70, W * 0.4, 2);
  g.fillStyle = "#0d0b09";
  g.fillRect(W / 2 - 16, 70, 32, 40);
  const fascio = g.createLinearGradient(0, 110, 0, 600);
  fascio.addColorStop(0, "rgba(255,224,168,.22)");
  fascio.addColorStop(1, "rgba(255,224,168,0)");
  g.fillStyle = fascio;
  g.beginPath();
  g.moveTo(W / 2 - 30, 110);
  g.lineTo(W / 2 + 30, 110);
  g.lineTo(W / 2 + 280, 600);
  g.lineTo(W / 2 - 280, 600);
  g.closePath();
  g.fill();
  // il piedistallo di pietra con il filo d'ottone
  const px = W / 2 - 200,
    py = 470;
  const pietra = g.createLinearGradient(px, 0, px + 400, 0);
  pietra.addColorStop(0, "#26201b");
  pietra.addColorStop(0.3, "#342d26");
  pietra.addColorStop(0.65, "#3a322a");
  pietra.addColorStop(1, "#231e19");
  g.fillStyle = pietra;
  g.fillRect(px, py, 400, 110);
  g.fillStyle = "#4a4137";
  g.fillRect(px, py, 400, 16);
  g.fillStyle = "#b8975a";
  g.fillRect(px, py + 16, 400, 2);
  // la boccetta, con la sua ombra
  if (p.img) {
    const im = new Image();
    im.src = immagine(p);
    try {
      await im.decode();
      const h = 330,
        w = Math.min(320, (im.naturalWidth / im.naturalHeight) * h);
      const ombra = g.createRadialGradient(W / 2, py + 4, 4, W / 2, py + 4, 150);
      ombra.addColorStop(0, "rgba(0,0,0,.7)");
      ombra.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = ombra;
      g.fillRect(W / 2 - 160, py - 12, 320, 28);
      g.drawImage(im, W / 2 - w / 2, py + 2 - h, w, h);
    } catch {
      /* senza foto resta il piedistallo */
    }
  }
  // nome
  g.textAlign = "center";
  g.fillStyle = "#a3978a";
  g.font = "500 24px Jost, sans-serif";
  g.fillText(p.brand.toUpperCase().split("").join(" "), W / 2, 660);
  g.fillStyle = "#efe7d8";
  let fs = 80;
  g.font = `500 ${fs}px 'Cormorant Garamond', Georgia, serif`;
  while (g.measureText(p.name).width > W - 160 && fs > 44) {
    fs -= 4;
    g.font = `500 ${fs}px 'Cormorant Garamond', Georgia, serif`;
  }
  g.fillText(p.name, W / 2, 745);
  g.fillStyle = "#d9bc7e";
  g.font = "400 28px Jost, sans-serif";
  g.fillText([p.conc, p.rating ? `★ ${voto(p.rating)}` : "", p.longevita ? p.longevita + "h" : "", p.sillage || ""].filter(Boolean).join("   ·   "), W / 2, 800);
  // accordi con la loro forza: righe sottili misurate
  const acc = accordiConForza(p).slice(0, 5);
  acc.forEach((a, i) => {
    const y = 870 + i * 52,
      x = 330,
      L = W - 150 - x,
      forza = a.forza || Math.round(100 / (1 + i * 0.35));
    g.textAlign = "right";
    g.fillStyle = "#efe7d8";
    g.font = "400 26px Jost, sans-serif";
    g.fillText(a.nome, x - 24, y + 9);
    g.fillStyle = "rgba(239,231,216,.2)";
    g.fillRect(x, y, L, 1);
    g.fillStyle = "#c9a866";
    g.fillRect(x, y - 3, (L * forza) / 100, 6);
  });
  // stagioni
  const st = p.stagioni;
  if (st) {
    const tot = STAGIONI.reduce((s, k) => s + (Number(st[k]) || 0), 0) || 1;
    STAGIONI.forEach((k, i) => {
      const x = 150 + i * ((W - 300) / 4) + (W - 300) / 8;
      g.textAlign = "center";
      g.fillStyle = "#a3978a";
      g.font = "500 20px Jost, sans-serif";
      g.fillText(k.toUpperCase(), x, 1175);
      g.fillStyle = "#d9bc7e";
      g.font = "500 40px 'Cormorant Garamond', Georgia, serif";
      g.fillText(Math.round(((Number(st[k]) || 0) / tot) * 100) + "%", x, 1222);
    });
  }
  g.textAlign = "center";
  g.fillStyle = "#b8975a";
  g.fillRect(W / 2 - 60, H - 112, 120, 1);
  g.fillStyle = "#efe7d8";
  g.font = "500 34px 'Cormorant Garamond', Georgia, serif";
  g.fillText("S I L L A G E", W / 2, H - 70);

  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
  if (!blob) return;
  const nome = `sillage-${piega(p.brand + "-" + p.name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.png`;
  const file = new File([blob], nome, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: p.name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
