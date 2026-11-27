#!/usr/bin/env python3
"""Wylicza z siatek punktów (source/animacje/latka-animacje-0N-lapki-nos-ogon.png)
pozycje łap/nosa/ogona każdej klatki -> data/animations/szkielet.json.
Magenta #FF00FF = łapy, zieleń #00FF00 = nos, niebieski #0000FF = ogon.
Gdy w animacji piesek nie rusza łapami (punkty różnią się o <= TOL px), wszystkie
klatki dostają pozycję z pierwszej klatki (żeby brud nie drgał o 1–2 px).
Uruchom po każdej zmianie siatek:  python3 tools/szkielet.py   (z katalogu głównego repozytorium)"""
import json
from PIL import Image

CELL, TOL = 128, 5
COL = {"paws": (255, 0, 255), "nose": (0, 255, 0), "tail": (0, 0, 255)}


def clusters(pix, w, h, x0, y0, color):
    seen, out = set(), []
    for y in range(y0, y0 + CELL):
        for x in range(x0, x0 + CELL):
            if (x, y) in seen or pix[x, y][:3] != color or pix[x, y][3] == 0:
                continue
            stack, pts = [(x, y)], []
            seen.add((x, y))
            while stack:
                px, py = stack.pop()
                pts.append((px, py))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (px + dx, py + dy)
                        if q not in seen and x0 <= q[0] < x0 + CELL and y0 <= q[1] < y0 + CELL and pix[q][:3] == color and pix[q][3]:
                            seen.add(q)
                            stack.append(q)
            out.append((round(sum(p[0] for p in pts) / len(pts) - x0 + 0.5, 1), round(sum(p[1] for p in pts) / len(pts) - y0 + 0.5, 1)))
    return sorted(out)


def same(a, b):
    return len(a) == len(b) and all(abs(p[0] - q[0]) <= TOL and abs(p[1] - q[1]) <= TOL for p, q in zip(a, b))


result = {}
for sh, n in (("a01", "01"), ("a02", "02")):
    im = Image.open(f"source/animacje/latka-animacje-{n}-lapki-nos-ogon.png").convert("RGBA")
    cfg = json.load(open(f"data/animations/latka-animacje-{n}.json"))
    cols, rows = cfg["cols"], cfg["rows"]
    pix = im.load()
    frames = []
    for f in range(cols * rows):
        x0, y0 = (f % cols) * CELL, (f // cols) * CELL
        frames.append({k: clusters(pix, im.width, im.height, x0, y0, c) for k, c in COL.items()})
    # animacje bez ruchu łap: pozycje z pierwszej klatki
    fixed = set()
    for p in cfg["presets"]:
        seq = [int(s) - 1 for s in p["seq"].split(",") if s.strip()]
        if len(seq) < 2:
            continue
        base = seq[0]
        for f in seq[1:]:
            if f in fixed or f == base:
                continue
            if frames[base]["paws"] and same(frames[base]["paws"], frames[f]["paws"]):
                for k in ("paws", "nose", "tail"):
                    if k != "paws" and not frames[f][k]:
                        continue
                    frames[f][k] = frames[base][k] if k == "paws" else frames[f][k]
                fixed.add(f)
    result[sh] = frames
    print(sh, "klatek:", len(frames), "z łapami:", sum(1 for f in frames if f["paws"]), "przyklejonych do 1. klatki:", len(fixed))
json.dump(result, open("data/animations/szkielet.json", "w"), separators=(",", ":"))
