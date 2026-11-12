import sys, os, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
T, T2 = 20, 70
sheet = []
for p in sorted(glob.glob(os.path.join(src, "*.webp"))):
    im = Image.open(p).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bgc = np.median(b, axis=0)
    if bgc.min() > 247: bgc = np.array([255., 255., 255.])
    d = np.abs(a - bgc).max(axis=2)
    h, w = d.shape
    m = Image.new("L", (w + 2, h + 2), 255)
    m.paste(Image.fromarray(np.where(d <= T, 255, 0).astype(np.uint8)), (1, 1))
    ImageDraw.floodfill(m, (0, 0), 128)
    bg = np.asarray(m)[1:-1, 1:-1] == 128
    alpha = np.where(bg, 0.0, 1.0).astype(np.float32)
    # anello di bordo: i pixel non di fondo che toccano il fondo diventano semitrasparenti in base a quanto sono chiari
    near = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    ring = near & ~bg
    alpha[ring] = np.clip(d[ring] / T2, 0.15, 1.0)
    # togli il bianco mescolato nel bordo
    al = alpha[..., None]
    rgb = np.where(al > 0, (a - (1 - al) * bgc) / np.maximum(al, 1e-3), 0)
    rgb = np.clip(rgb, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    o = Image.fromarray(out, "RGBA")
    bb = Image.fromarray((alpha > 0.05).astype(np.uint8) * 255).getbbox()
    o = o.crop(bb)
    name = os.path.basename(p)
    o.save(os.path.join(dst, name), "WEBP", quality=90, method=6)
    print(name, im.size, "->", o.size, os.path.getsize(os.path.join(dst, name)))
    sheet.append(o)
# foglio di controllo su fondo pietra e su fondo noce
W = sum(s.width for s in sheet) + 20 * (len(sheet) + 1)
H = max(s.height for s in sheet) + 40
for nome, col in (("pietra", (241, 235, 224)), ("noce", (110, 74, 46))):
    c = Image.new("RGB", (W, H), col)
    x = 20
    for s in sheet:
        c.paste(s, (x, H - 20 - s.height), s)
        x += s.width + 20
    c.save(os.path.join(dst, f"_foglio-{nome}.png"))
