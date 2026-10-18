# Cut the five Canva pages into animatable layers (PNG with alpha) + a clean background plate.
#   python3 extract.py  ->  layers/*.png, layers/manifest.json
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = 'layers'
os.makedirs(OUT, exist_ok=True)
pages = [np.array(Image.open(f'src/{i}.webp').convert('RGB')).astype(np.float32) for i in range(1, 6)]
H, W, _ = pages[0].shape
ref = pages[1]                     # page 2 is the cleanest reference for the shared elements

# --- background plate ------------------------------------------------------------------------
def blueness(p): return p[..., 2] - p[..., 0]
D = blueness(ref)
fg = (D < 130) | (ref[..., 0] > 40)                    # anything that is not the plain blue
yy, xx = np.mgrid[0:H, 0:W]
fg |= (xx < 460) & (yy > 1540) & (ref[..., 2] < 150)  # navy blob
fg = ndi.binary_dilation(fg, iterations=6)
for p in pages:                                        # union with every page's text
    m = (blueness(p) < 130) | (p[..., 0] > 40)
    fg |= ndi.binary_dilation(m, iterations=6)
keep = (~fg).astype(np.float32)
def nconv(img, s):
    num = np.stack([ndi.gaussian_filter(img[..., c] * keep, s) for c in range(3)], -1)
    den = ndi.gaussian_filter(keep, s)[..., None]
    return num / np.maximum(den, 1e-4)
smooth = nconv(ref, 40)
wide = nconv(ref, 160)
wt = np.clip(ndi.gaussian_filter(keep, 40)[..., None] * 8, 0, 1)
smooth = smooth * wt + wide * (1 - wt)
# fill holes with the smooth estimate plus a little texture borrowed from a clean area
plate = np.where(fg[..., None], smooth, ref)
plate = ndi.gaussian_filter(plate, (1.2, 1.2, 0)) * 0.35 + plate * 0.65
Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).save(f'{OUT}/plate.jpg', quality=95)
bgD = blueness(smooth)

manifest = {'w': W, 'h': H, 'layers': {}}

def unmix(p, box, alpha_fn=None):
    """alpha from 'how far from the blue background', colour un-premultiplied over the plate."""
    x0, y0, x1, y1 = box
    P = p[y0:y1, x0:x1]; B = smooth[y0:y1, x0:x1]
    a = np.clip((bgD[y0:y1, x0:x1] - blueness(P)) / np.maximum(bgD[y0:y1, x0:x1], 1), 0, 1) if alpha_fn is None else alpha_fn(P, B)
    a = np.clip((a - 0.06) / 0.94, 0, 1)
    C = (P - (1 - a[..., None]) * B) / np.maximum(a[..., None], 1e-3)
    C = np.where(a[..., None] > 0.02, C, 255)
    return np.clip(C, 0, 255), a

def save(name, C, a, x, y, extra=None):
    ys, xs = np.nonzero(a > 0.02)
    if len(xs) == 0: return
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.dstack([C, a * 255])[by0:by1, bx0:bx1]
    Image.fromarray(rgba.astype(np.uint8), 'RGBA').save(f'{OUT}/{name}.png')
    manifest['layers'][name] = dict(x=int(x + bx0), y=int(y + by0), w=int(bx1 - bx0), h=int(by1 - by0), **(extra or {}))

def split_cols(a, thr=0.05):
    """split a text line into glyph groups at empty columns"""
    col = (a > thr).sum(0) > 0
    runs, x = [], 0
    while x < len(col):
        if col[x]:
            s = x
            while x < len(col) and col[x]: x += 1
            runs.append([s, x])
        else: x += 1
    return runs

# --- title: one layer per glyph ----------------------------------------------------------------
for key, box in {'progetti': (95, 190, 625, 272), 'anno': (190, 274, 975, 342), 'year': (108, 360, 830, 485)}.items():
    C, a = unmix(ref, box)
    glyphs = []
    runs = split_cols(a, 0.6)
    cuts = [0] + [(runs[i][1] + runs[i + 1][0]) // 2 for i in range(len(runs) - 1)] + [a.shape[1]]
    for i in range(len(runs)):
        s, e = cuts[i], cuts[i + 1]
        m = np.zeros_like(a); m[:, s:e] = a[:, s:e]
        name = f'{key}_{i:02d}'
        save(name, C, m, box[0], box[1]); glyphs.append(name)
    manifest[key] = glyphs

C, a = unmix(ref, (640, 180, 710, 270)); save('stripes', C, a, 640, 180)
for i, p in enumerate(pages):   # bulb sits slightly differently on page 1; keep page 2's for all
    pass
C, a = unmix(ref, (835, 370, 975, 560))
a = ndi.binary_fill_holes(a > 0.3) * 1.0 * np.maximum(a, 0) + 0  # no holes in the sticker
a = np.maximum(a, ndi.binary_erosion(ndi.binary_fill_holes(a > 0.3), iterations=2) * 1.0)
save('bulb', C, a, 835, 370)

# --- halftone stickers bottom right ------------------------------------------------------------
box = (770, 1570, 1080, 1920)
C, a = unmix(ref, box)
solid = ndi.binary_fill_holes(a > 0.3)
lab, n = ndi.label(solid)
sizes = ndi.sum(solid, lab, range(1, n + 1))
order = np.argsort(-sizes)[:2] + 1
for k, li in enumerate(sorted(order, key=lambda l: ndi.center_of_mass(solid, lab, l)[0])):
    m = ndi.binary_dilation(lab == li, iterations=2)
    aa = np.where(m, np.maximum(a, ndi.binary_erosion(lab == li, iterations=2) * 1.0), 0)
    save(f'halftone{k}', C, aa, *box[:2])

# --- logo + navy blob ----------------------------------------------------------------------------
cx, cy, r = 222, 1740, 111
x0, y0, x1, y1 = 0, 1540, 470, 1920
P = ref[y0:y1, x0:x1]; Y, X = np.mgrid[y0:y1, x0:x1]
dist = np.hypot(X - cx, Y - cy)
disk = np.clip(r + 0.5 - dist, 0, 1)
navy = np.array([10, 31, 110], np.float32)
# white lettering that spills outside the disk: alpha from distance to navy
dn = np.linalg.norm(P - navy, axis=-1)
spill = np.clip((dn - 25) / 160, 0, 1) * (dist < r + 60) * (Y > cy - 40) * (Y < cy + 80)
la = np.maximum(disk, spill)
LC = (P - (1 - la[..., None]) * navy) / np.maximum(la[..., None], 1e-3)
save('logo', np.clip(LC, 0, 255), la, x0, y0, dict(cx=cx, cy=cy, r=r))
# blob: darker than the plate in the blue channel
Bp = smooth[y0:y1, x0:x1, 2]
ba = np.clip((Bp - P[..., 2]) / (Bp - 110), 0, 1)
inside = ndi.binary_fill_holes(ndi.binary_opening(ba > 0.5, iterations=3))
lab, n = ndi.label(inside); inside = lab == (np.argmax(ndi.sum(inside, lab, range(1, n + 1))) + 1)
ba = np.clip(ndi.gaussian_filter(inside * 1.0, 1.0), 0, 1)
BC = np.where((la[..., None] > 0.02) | (dist[..., None] < r + 70), navy, (P - (1 - ba[..., None]) * smooth[y0:y1, x0:x1]) / np.maximum(ba[..., None], 1e-3))
save('blob', np.clip(BC, 0, 255), ba, x0, y0)

# --- per-page subtitle + bullet lines ----------------------------------------------------------
def rows(a, thr=0.05, gap=6):
    r = (a > thr).sum(1) > 0
    out, y = [], 0
    while y < len(r):
        if r[y]:
            s = y
            while y < len(r) and (r[y] or (y + gap < len(r) and r[y:y + gap].any())): y += 1
            out.append([s, y])
        else: y += 1
    return out

manifest['pages'] = []
for pi, p in enumerate(pages):
    pg = {'subtitle': [], 'items': []}
    box = (100, 495, 845, 600)
    C, a = unmix(p, box)
    for li, (s, e) in enumerate(rows(a)):
        m = np.zeros_like(a); m[s:e] = a[s:e]
        n = f'p{pi}_sub{li}'; save(n, C, m, *box[:2]); pg['subtitle'].append(n)
    box = (100, 640, 1000, 1500)
    C, a = unmix(p, box)
    for li, (s, e) in enumerate(rows(a, gap=4)):
        seg = a[s:e]
        cols = split_cols(seg)
        first = cols[0]
        is_bullet = first[1] < 70 and len(cols) > 1
        if is_bullet:
            m = np.zeros_like(a); m[s:e, first[0]:first[1]] = seg[:, first[0]:first[1]]
            dn = f'p{pi}_dot{len(pg["items"])}'; save(dn, C, m, *box[:2])
            pg['items'].append({'dot': dn, 'lines': []})
            tx = cols[1][0]
        else:
            tx = 0
        m = np.zeros_like(a); m[s:e, tx:] = seg[:, tx:]
        n = f'p{pi}_l{li}'; save(n, C, m, *box[:2])
        if not pg['items']: pg['items'].append({'dot': None, 'lines': []})
        pg['items'][-1]['lines'].append(n)
    manifest['pages'].append(pg)

json.dump(manifest, open(f'{OUT}/manifest.json', 'w'), indent=1)
print({k: v for k, v in manifest.items() if k not in ('layers',)})
print(len(manifest['layers']), 'layers')
