"""Scontorna le foto delle boccette: dal fondo (bianco o a sfumatura) a webp con trasparenza.

Uso:  python scontorna.py <cartella-originali> <cartella-uscita> [nome ...]
      (senza nomi le rifà tutte; i nomi sono senza .webp)
Serve: Python 3 con numpy, Pillow e opencv-python.

Due modi, scelti foto per foto in FINI qui sotto:
- «netto» (quasi tutte): è boccetta ciò che si stacca dal fondo di almeno 20 livelli su 255; il bordo diventa
  semitrasparente in base a quanto si stacca. Bordi puliti sulle boccette scure o colorate, ma perde il vetro
  chiaro, i tappi argento e le etichette bianche che toccano il fondo.
- «fine» (le boccette chiare): soglia appena sopra il rumore del fondo (3 livelli), contorni ricuciti con una
  chiusura morfologica, poi un pixel di bordo rifilato e ammorbidito. Prende il vetro chiaro, ma attorno alle
  boccette scure lascerebbe una riga chiara (i disturbi di compressione dell'originale): per questo non è per tutte.
In entrambi è fondo solo ciò che si raggiunge dai bordi della foto: tutto quello che sta dentro il contorno resta
(niente buchi nelle etichette bianche). Il fondo si stima dai bordi: colore unico o sfumatura.
La foto si ritaglia sulla boccetta senza ridimensionarla.
"""
import sys, os, glob
import numpy as np
import cv2
from PIL import Image

# Foto da scontornare in modo «fine», con le loro eccezioni:
#   soglia   livelli sopra il rumore del fondo (predefinito 3)
#   chiusura pixel per ricucire il contorno (predefinito 5)
#   apertura pixel: toglie dal contorno le sporgenze più sottili di così (predefinito 0, nessuna)
#   rifila   pixel tolti dal bordo (predefinito 1)
#   mano     maschera a mano: poligoni [(x, y), ...] sulle coordinate dell'originale, sempre boccetta; si usa
#            dove il vetro tocca il fondo bianco senza nessun contorno. Con una maschera a mano il resto viene
#            dalla sagoma netta, non da quella fine.
FINI = {
    # vetro trasparente su fondo bianco: l'etichetta bianca esce dal vetro a sinistra senza contorno
    "nasomatto-black-afgano": {"mano": [[(129, 212), (223, 212), (229, 217), (231, 222), (231, 399), (229, 401),
                                         (119, 401), (117, 399), (117, 222), (120, 217)]]},
    "xerjoff-naxos": {"apertura": 5}, "lalique-ombre-noire": {},
    "armaf-cdn-sillage": {"apertura": 5}, "lattafa-atlas": {"soglia": 12, "chiusura": 9, "apertura": 7}, "erbolario-ginepro-nero": {},
    "ysl-muse": {"apertura": 5}, "armani-acqua-di-gio-edp": {},
}
ALTA, T2 = 20, 70


def fondo(a):
    """Il colore del fondo pixel per pixel, stimato dai bordi della foto (strisce di 3 pixel)."""
    h, w, _ = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    bordo = np.zeros((h, w), bool)
    bordo[:3], bordo[-3:], bordo[:, :3], bordo[:, -3:] = True, True, True, True
    c = a[bordo]
    med = np.median(c, axis=0)
    if np.abs(c - med).max(axis=1).mean() < 2.5:
        if med.min() > 247:
            med = np.array([255.0, 255.0, 255.0])
        return np.broadcast_to(med, a.shape).astype(np.float32)
    # sfumatura: parabola in x e y adattata ai bordi, canale per canale
    x, y = xx[bordo] / w, yy[bordo] / h
    A = np.stack([np.ones_like(x), x, y, x * y, x * x, y * y], 1)
    X, Y = xx / w, yy / h
    B = np.stack([np.ones_like(X), X, Y, X * Y, X * X, Y * Y], -1)
    out = np.empty_like(a)
    for k in range(3):
        coef, *_ = np.linalg.lstsq(A, c[:, k], rcond=None)
        out[..., k] = B @ coef
    return out


def sagoma(d, soglia, chiusura=0):
    """Pixel che si staccano dal fondo, con i buchi interni riempiti: è fondo solo ciò che si raggiunge da fuori."""
    cosa = (d > soglia).astype(np.uint8)
    if chiusura:
        cosa = cv2.morphologyEx(cosa, cv2.MORPH_CLOSE,
                                cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (chiusura, chiusura)))
    pad = np.pad(1 - cosa, 1, constant_values=1).astype(np.uint8)
    _, lab = cv2.connectedComponents(pad, connectivity=4)
    obj = (lab != lab[0, 0])[1:-1, 1:-1].astype(np.uint8)
    # togli i puntini staccati: resta tutto ciò che è almeno il 2% del pezzo più grande
    n, lab, st, _ = cv2.connectedComponentsWithStats(obj, connectivity=8)
    if n > 1:
        aree = st[1:, cv2.CC_STAT_AREA]
        tieni = np.zeros(n, bool)
        tieni[1:] = aree >= 0.02 * aree.max()
        obj = tieni[lab].astype(np.uint8)
    return obj


def scontorna(p):
    nome = os.path.splitext(os.path.basename(p))[0]
    a = np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    bgc = fondo(a)
    d = np.abs(a - bgc).max(axis=2)
    bordo = np.concatenate([d[:3].ravel(), d[-3:].ravel(), d[:, :3].ravel(), d[:, -3:].ravel()])
    rumore = np.percentile(bordo, 99.5)
    if nome in FINI:
        r = FINI[nome]
        if "mano" in r:
            obj = sagoma(d, max(ALTA, rumore + 8))
            for poli in r["mano"]:
                cv2.fillPoly(obj, [np.array(poli, np.int32)], 1)
        else:
            obj = sagoma(d, rumore + r.get("soglia", 3), r.get("chiusura", 5))
        ap = r.get("apertura", 0)
        if ap:
            obj = cv2.morphologyEx(obj, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ap, ap)))
        rif = r.get("rifila", 1)
        if rif:
            obj = cv2.erode(obj, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * rif + 1, 2 * rif + 1)))
        # bordo morbido di circa un pixel
        alpha = cv2.GaussianBlur(obj.astype(np.float32), (0, 0), 0.6)
        alpha[cv2.erode(obj, np.ones((3, 3), np.uint8)) > 0] = 1.0
    else:
        obj = sagoma(d, max(ALTA, rumore + 8))
        fuori = obj == 0
        alpha = obj.astype(np.float32)
        # anello di bordo (2 pixel): semitrasparente in base a quanto si stacca dal fondo
        vicino = cv2.dilate(fuori.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        anello = vicino & ~fuori
        alpha[anello] = np.clip(d[anello] / T2, 0.15, 1.0)
    # togli il fondo mescolato nei pixel di bordo
    al = alpha[..., None]
    rgb = np.where(al > 0.01, (a - (1 - al) * bgc) / np.maximum(al, 1e-3), 0)
    rgb = np.clip(rgb, 0, 255)
    out = Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")
    bb = Image.fromarray(((alpha > 0.05) * 255).astype(np.uint8)).getbbox()
    return out.crop(bb), (w, h)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    nomi = sys.argv[3:]
    os.makedirs(dst, exist_ok=True)
    for p in sorted(glob.glob(os.path.join(src, "*.webp"))):
        nome = os.path.basename(p)
        if nomi and nome[:-5] not in nomi:
            continue
        o, dim = scontorna(p)
        o.save(os.path.join(dst, nome), "WEBP", quality=90, method=6)
        print(nome, dim, "->", o.size, "fine" if nome[:-5] in FINI else "netto")


if __name__ == "__main__":
    main()
