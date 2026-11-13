"""Le schermate d'avvio dell'iPhone per la nuova Sillage: la vetrina chiusa (src/componenti/Apertura.tsx,
stile in src/stile/rifiniture.css), chiara e scura, per le stesse dimensioni dell'app di oggi (img/avvio/).
Così, aprendo l'app dalla schermata Home, l'immagine d'avvio e la vetrina che si apre coincidono.

Si lancia dalla cartella app/ (servono Pillow e numpy, e i caratteri in node_modules/@fontsource):
    python strumenti/schermate-avvio.py
Scrive public/img/avvio/avvio-LxA.png e avvio-LxA-scuro.png. I collegamenti sono in index.html.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

QUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(QUI)
USCITA = os.path.join(APP, "public", "img", "avvio")
FONT = os.path.join(APP, "node_modules", "@fontsource")

# (larghezza, altezza in pixel, densità): le stesse schermate dell'app di oggi
SCHERMI = [(1290, 2796, 3), (1179, 2556, 3), (1206, 2622, 3), (1320, 2868, 3), (1170, 2532, 3),
           (1284, 2778, 3), (1125, 2436, 3), (828, 1792, 2), (1242, 2688, 3), (750, 1334, 2)]

# i colori di src/stile/token.css
TEMI = {
    "": dict(parete="#F1EBE0", plinto_b="#E6DCCB", plinto_c="#EAE1D1", ottone="#A88748", ottone_testo="#6B5226",
             inchiostro="#2A241D", seppia="#55493B", vena=(140, 112, 72, 0.045), vena2=(140, 112, 72, 0.03), ombra=(52, 38, 20, 0.42)),
    "-scuro": dict(parete="#1A1714", plinto_b="#342D26", plinto_c="#3A322A", ottone="#B8975A", ottone_testo="#D9BC7E",
                   inchiostro="#EFE7D8", seppia="#C7BBA8", vena=(255, 232, 190, 0.028), vena2=(255, 232, 190, 0.018), ombra=(0, 0, 0, 0.75)),
}


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def disegna(L, A, d, t):
    s = lambda v: int(round(v * d))  # da pixel CSS a pixel veri
    meta = L // 2
    # l'anta: gradiente orizzontale (plinto-b → plinto-c al 60% → plinto-b), uguale per le due metà
    x = np.linspace(0, 1, meta, dtype=np.float32)[:, None]
    b, c = rgb(t["plinto_b"]), rgb(t["plinto_c"])
    riga = np.where(x < 0.6, b + (c - b) * (x / 0.6), c + (b - c) * ((x - 0.6) / 0.4))
    anta = np.repeat(riga[None, :, :], A, axis=0)
    # le venature orizzontali, ogni 61 px CSS
    y = (np.arange(A) / d) % 61
    for (a0, a1), col in (((7, 8), t["vena"]), ((19, 21), t["vena2"]), ((37, 38), t["vena"])):
        m = ((y >= a0) & (y < a1))[:, None, None]
        anta = np.where(m, anta * (1 - col[3]) + np.array(col[:3], dtype=np.float32) * col[3], anta)
    img = np.concatenate([anta, anta[:, ::-1]], axis=1)
    if img.shape[1] < L:
        img = np.concatenate([img, img[:, -1:]], axis=1)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")
    g = ImageDraw.Draw(im)
    parete, ottone = t["parete"], t["ottone"]
    # la cornice di parete (14 px) e il filo d'ottone (1 px) dentro ogni anta
    for x0 in (0, meta):
        for k in range(s(14)):
            g.rectangle([x0 + k, k, x0 + meta - 1 - k, A - 1 - k], outline=parete)
        g.rectangle([x0 + s(14), s(14), x0 + meta - 1 - s(14), A - 1 - s(14)], outline=ottone, width=max(1, s(1)))
    # la giunta d'ottone e le maniglie
    g.rectangle([meta - max(1, s(0.5)), 0, meta + max(1, s(0.5)) - 1, A], fill=ottone)
    my = int(A * 0.66)
    for xm in (meta - s(28) - s(3), meta + s(28)):
        g.rectangle([xm, my - s(42), xm + s(3), my + s(42)], fill=ottone)
    # il marchio al centro, su un riquadro di parete
    f_s = ImageFont.truetype(os.path.join(FONT, "cormorant-garamond", "files", "cormorant-garamond-latin-500-italic.woff"), s(40))
    f_nome = ImageFont.truetype(os.path.join(FONT, "cormorant-garamond", "files", "cormorant-garamond-latin-500-normal.woff"), s(26))
    f_sotto = ImageFont.truetype(os.path.join(FONT, "jost", "files", "jost-latin-500-normal.woff"), s(9.5))

    def larghezza_spaziata(testo, f, spazio):
        return sum(f.getlength(ch) for ch in testo) + spazio * (len(testo) - 1)

    def scrivi_spaziato(testo, f, spazio, cx, y, col):
        x = cx - larghezza_spaziata(testo, f, spazio) / 2
        for ch in testo:
            g.text((x, y), ch, font=f, fill=col)
            x += f.getlength(ch) + spazio

    nome, sotto = "SILLAGE", "COLLEZIONE PRIVATA"
    w_nome = larghezza_spaziata(nome, f_nome, s(26) * 0.32)
    w_sotto = larghezza_spaziata(sotto, f_sotto, s(9.5) * 0.24)
    cerchio = s(72)
    alt = cerchio + s(10) + s(26) + s(10) + s(10)
    larg = max(cerchio, w_nome, w_sotto) + 2 * s(22)
    cx, cy = L / 2, A * 0.44
    top = cy - (alt + 2 * s(18)) / 2
    g.rectangle([cx - larg / 2, top, cx + larg / 2, top + alt + 2 * s(18)], fill=parete)
    y = top + s(18)
    g.ellipse([cx - cerchio / 2, y, cx + cerchio / 2, y + cerchio], outline=ottone, width=max(1, s(1)))
    bb = f_s.getbbox("S")
    g.text((cx - (bb[0] + bb[2]) / 2, y + cerchio / 2 - (bb[1] + bb[3]) / 2), "S", font=f_s, fill=t["ottone_testo"])
    y += cerchio + s(10)
    scrivi_spaziato(nome, f_nome, s(26) * 0.32, cx, y - s(4), t["inchiostro"])
    y += s(26) + s(10)
    scrivi_spaziato(sotto, f_sotto, s(9.5) * 0.24, cx, y, t["seppia"])
    return im


os.makedirs(USCITA, exist_ok=True)
for L, A, d in SCHERMI:
    for suffisso, t in TEMI.items():
        nome = os.path.join(USCITA, f"avvio-{L}x{A}{suffisso}.png")
        disegna(L, A, d, t).save(nome, optimize=True)
        print(os.path.basename(nome), os.path.getsize(nome) // 1024, "KB")
