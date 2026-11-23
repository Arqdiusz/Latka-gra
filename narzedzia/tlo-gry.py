#!/usr/bin/env python3
"""Generuje tla/001-gry.png: tło Łąki (768x1024) wydłużone do 768x1536 (pełna wysokość
planszy gier). Jednolity dół zastępuje powtórzony pas trawy z przesunięciem + kwiatki."""
from PIL import Image
import random
random.seed(11)
im = Image.open('tla/001.png').convert('RGBA')
W, H = im.size
TOP = 704
strip = im.crop((0, TOP, W, H)); SH = strip.size[1]
OUT_H = 1536
out = Image.new('RGBA', (W, OUT_H))
out.paste(im.crop((0, 0, W, TOP)), (0, 0))
y = TOP; i = 0
while y < OUT_H:
    s = strip.transpose(Image.FLIP_LEFT_RIGHT) if i % 2 else strip
    off = random.randrange(40, W - 40)
    s2 = Image.new('RGBA', s.size)
    s2.paste(s.crop((off, 0, W, SH)), (0, 0)); s2.paste(s.crop((0, 0, off, SH)), (W - off, 0))
    out.paste(s2, (0, y)); y += SH; i += 1
def sprite(box, bgpt):
    c = im.crop(box); bg = im.getpixel(bgpt); px = c.load()
    for xx in range(c.size[0]):
        for yy in range(c.size[1]):
            if sum(abs(a - b) for a, b in zip(px[xx, yy][:3], bg[:3])) < 64: px[xx, yy] = (0, 0, 0, 0)
    return c
S = [sprite((160, 590, 208, 645), (165, 600)), sprite((580, 590, 630, 640), (585, 600)), sprite((636, 590, 680, 640), (640, 600))]
placed = []
for n in range(11):
    sp = random.choice(S)
    for _ in range(30):
        px = random.randrange(10, W - 70); py = random.randrange(TOP + 330, OUT_H - 90)
        if all(abs(px - a) > 110 or abs(py - b) > 90 for a, b in placed): break
    placed.append((px, py))
    if random.random() < 0.5: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
    out.alpha_composite(sp, (px, py))
out.convert('RGB').quantize(colors=64, dither=Image.NONE).save('tla/001-gry.png', optimize=True)
