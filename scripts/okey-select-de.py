# ΔE76 of a tile's numeral ink and face between highlight states (see cdp-okey-select.mjs). Exit 1 if any ΔE > 2.
import json, sys
import numpy as np
from PIL import Image
def lab(rgb):
    c = rgb / 255.0; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); xyz = c @ M.T / [0.95047, 1, 1.08883]
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def sample(file, r, pitch, dpr):
    # inner 80% of the projected face box (the frame sits outside the face, so it is never sampled unless it spilled in)
    im = np.asarray(Image.open(file).convert('RGB')).astype(float); x0, x1, y0, y1 = (r[k] * dpr for k in ('x0', 'x1', 'y0', 'y1'))
    mx, my = 0.1 * (x1 - x0), 0.1 * (y1 - y0)
    L = lab(im[int(y0 + my):int(y1 - my), int(x0 + mx):int(x1 - mx)].reshape(-1, 3)); med = np.median(L, 0); d = np.linalg.norm(L - med, axis=1)
    ink, face = L[d > 30], L[d < 6]
    return ink.mean(0), face.mean(0), len(ink)
out, worst = [], 0
for s in json.load(open(sys.argv[1])):
    st = {x['tag']: x for x in s['states']}
    for tile, a, b in [('A', 'none', 'selA'), ('A', 'none', 'setA'), ('O', 'noframe', 'none'), ('O', 'noframe', 'selO')]:
        ia, fa, na = sample(st[a]['file'], st[a][tile], s['pitch'], s['dpr']); ib, fb, nb = sample(st[b]['file'], st[b][tile], s['pitch'], s['dpr'])
        di, df = float(np.linalg.norm(ia - ib)), float(np.linalg.norm(fa - fb)); worst = max(worst, di, df)
        label = {'selA': 'selected', 'setA': 'in a set', 'none': 'gold okey frame', 'selO': 'selected okey'}[b]
        print(f"{s['name']:8} tile {s[tile]:3} {'(okey)' if tile == 'O' else '      '} {a:8}→{label:16} ink ΔE {di:4.2f} (px {na}/{nb})  face ΔE {df:4.2f}")
print(f'worst ΔE {worst:.2f}', 'OK' if worst <= 2 else 'FAIL'); sys.exit(0 if worst <= 2 else 1)
