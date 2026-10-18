# usage: python3 scripts/og-kedi.py <desktop-screenshot.png> <subtitle>
import sys
from PIL import Image, ImageDraw, ImageFont
src, sub = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
# crop the 3D scene (left of the side panel), keep 1200:630
cw = int(W * 0.80); ch = int(cw * 630 / 1200)
x0 = int(W * 0.02); y0 = max(0, int(H * 0.06))
if y0 + ch > H: ch = H - y0; cw = int(ch * 1200 / 630)
im = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((1200, 630), Image.LANCZOS)
d = ImageDraw.Draw(im, 'RGBA')
d.rectangle((0, 0, 1200, 118), fill=(10, 10, 14, 200))
def font(sz, bold):
    for p in (['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] if bold else ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']):
        try: return ImageFont.truetype(p, sz)
        except OSError: pass
    return ImageFont.load_default()
d.text((40, 14), 'Kedi-27K', font=font(52, True), fill=(255, 200, 80))
d.text((40, 78), sub, font=font(26, False), fill=(235, 235, 235))
im.save('static/og-kedi.png', optimize=True)
print('ok', im.size)
