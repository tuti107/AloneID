import json, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
from PIL import Image, ImageDraw
tag = sys.argv[1]
im = Image.open(f'top_{tag}.png').convert('RGB')
W, H = im.size
d = json.load(open(f'top_{tag}.json'))
dr = ImageDraw.Draw(im, 'RGBA')
px = lambda p: ((p[0] + 1) / 2 * W, (1 - p[1]) / 2 * H)
pal = [(255,80,80),(80,200,255),(120,255,120),(255,200,60),(220,120,255),(255,140,200),(160,160,255),(255,255,255),(90,255,220),(255,170,90)]
ids = d['ids']
col = {i: pal[k % len(pal)] for k, i in enumerate(ids)}
for s in d['sp']:
    x, y = px(s[0]); c = col[s[1]]
    if s[5]:
        dr.rectangle([x-3, y-3, x+3, y+3], fill=c + (150,))
    else:
        dr.line([x-4, y-4, x+4, y+4], fill=(255,255,255,255), width=2); dr.line([x-4, y+4, x+4, y-4], fill=(255,255,255,255), width=2)
for s in d['sp']:
    if s[6]:
        x, y = px(s[0]); dr.rectangle([x-3, y-3, x+3, y+3], fill=(255,0,255,255))
for b in d['cols']:
    pts = [px(p) for p in b['c']]
    dr.polygon(pts, outline=(255,60,60,255) if not b['low'] else (255,160,60,255))
for a, b in d['trig']:
    (x0, y0), (x1, y1) = px(a), px(b)
    dr.rectangle([min(x0,x1), min(y0,y1), max(x0,x1), max(y0,y1)], outline=(255,255,0,255), width=2)
for k, p in d['ents']:
    x, y = px(p); dr.ellipse([x-6, y-6, x+6, y+6], outline=(0,255,0,255), width=2); dr.text((x+7, y-6), k, fill=(0,255,0,255))
for k, p, r in d['its']:
    x, y = px(p); dr.ellipse([x-4, y-4, x+4, y+4], fill=(0,255,255,255)); dr.text((x+5, y+2), k, fill=(0,255,255,255))
for k, p, l in d['shots']:
    x, y = px(p); x2, y2 = px(l); dr.line([x, y, x2, y2], fill=col.get(k, (200,200,200)) + (255,), width=2); dr.ellipse([x-5, y-5, x+5, y+5], fill=col.get(k, (200,200,200)) + (255,)); dr.text((x+6, y+6), k, fill=(255,255,255,255))
y = 4
for i in ids:
    dr.rectangle([4, y, 14, y+10], fill=col[i] + (255,)); dr.text((18, y-1), i, fill=(255,255,255,255)); y += 14
im.save(f'map_{tag}.png')
