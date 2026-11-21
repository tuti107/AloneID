import json, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
from PIL import Image, ImageDraw
tag = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3
items = json.load(open(f'v_{tag}.json'))
w, h = 400, 300
rows = (len(items) + cols - 1) // cols
s = Image.new('RGB', (cols * w, rows * h))
d = ImageDraw.Draw(s)
for i, (f, label) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((w, h))
    s.paste(im, ((i % cols) * w, (i // cols) * h))
    d.rectangle([(i % cols) * w, (i // cols) * h, (i % cols) * w + w, (i // cols) * h + 14], fill=(0, 0, 0))
    d.text(((i % cols) * w + 3, (i // cols) * h + 2), label, fill=(255, 255, 0))
s.save(f'sheet_{tag}.png')
