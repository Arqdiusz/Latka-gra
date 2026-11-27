#!/usr/bin/env python3
"""Generator trawnika ekranu startowego (`.ldLawn` w css/style.css, kafel zapętlany poziomo).

Rysuje „grube piksele” 192×152 (taki sam rozmiar piksela jak niebo `petla-niebo`) i powiększa
×8 do 1536×1216. Wszystko zapętla się w osi X (torus), a wysokość 158,33 cqw wystarcza na
najwyższy ekran z pasami `--bleed` — kafel NIE powtarza się w pionie. Losowanie jest
zdeterminowane (stałe ziarna), więc ten sam skrypt daje ten sam obraz.

Warianty: A — kwiecista łąka, B — trawnik w pasy, C — piaszczysta ścieżka (WDROŻONY, v0.8.252).
Użycie z katalogu głównego repozytorium:
    python3 tools/make-lawn.py C                 # -> source/tla/petla-trawnik-sciezka.png
    python3 tools/png-to-webp.py                 # -> assets/backgrounds/start-lawn-sciezka.webp
"""
import sys, math, random
import numpy as np
from PIL import Image

W, H, K = 192, 152, 8
A = (152, 202, 80)    # kolor linii horyzontu (ostatni rząd nieba)
B = (165, 211, 94)    # baza trawnika
LB = (176, 221, 106)  # jasna plama
DB = (156, 206, 86)   # ciemna plama
PAL = {
    'D': (42, 142, 74), 'd': (54, 152, 73), 'm': (79, 166, 70), 'g': (99, 177, 70),
    'l': (130, 191, 74), 'h': (190, 230, 120),
    'w': (252, 244, 228), 'y': (252, 215, 51), 'Y': (240, 170, 30),
    'p': (252, 134, 178), 'P': (226, 100, 150), 'r': (242, 64, 53), 'R': (190, 40, 40),
    's': (234, 204, 134), 'S': (220, 184, 112), 'T': (200, 160, 94), 'U': (170, 134, 86), 'V': (246, 226, 170),
}

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def blend_dither(img, y0, y1, c0, c1):
    for y in range(y0, y1):
        p = (y - y0 + 0.5) / (y1 - y0)
        for x in range(W):
            img[y, x] = c1 if BAYER[y % 4, x % 4] < p else c0

def noise_field(rng, nwaves=6):
    waves = []
    for _ in range(nwaves):
        fx = rng.randint(1, 5); fy = rng.randint(1, 6)
        waves.append((fx, fy, rng.uniform(0, 6.283), rng.uniform(0.6, 1.0)))
    ys, xs = np.mgrid[0:H, 0:W]
    v = np.zeros((H, W))
    for fx, fy, ph, a in waves:
        v += a * np.sin(2 * math.pi * (fx * xs / W + fy * ys / H) + ph)
    return v / sum(w[3] for w in waves)

def put(img, x, y, c):
    if 0 <= y < H:
        img[y, x % W] = c

TUFTS = {
    1: [["g.g", "dgd", ".d."], [".g.", "dgd", ".d."]],
    2: [["g...g", "d.g.d", "ddgdd", ".mdm."], [".g.g.", "dgdgd", "ddddd", ".mmm."]],
    3: [["g..g..g", "d.gdg.d", "dggdggd", "ddddddd", ".mmmmm."],
        ["..g.g..", "g.dgd.g", "dgddgdd", "ddddddd", ".mmmmm."]],
}

def tuft(img, rng, x, y, size, dark='d', tip='g'):
    """Kępka trawy (wzorzec, losowo odbity) o podstawie w (x,y)."""
    rows = rng.choice(TUFTS[size])
    if rng.random() < 0.5: rows = [r[::-1] for r in rows]
    h = len(rows); w = len(rows[0])
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': put(img, x - w // 2 + i, y - h + 1 + j, PAL[ch])
    return (x - w // 2 - 1, y - h, x - w // 2 + w + 1, y + 2)

FLOWERS = {
    'w': ('w', 'y'), 'p': ('p', 'Y'), 'r': ('r', 'y'), 'y': ('y', 'Y'),
}

def flower(img, rng, x, y, kind, big):
    pc, cc = FLOWERS[kind]
    if big:
        rows = ["..a..", ".aaa.", "aacaa", ".aaa.", "..a.."]
        h = 5
    else:
        rows = [".a.", "aca", ".a."]
        h = 3
    w = len(rows[0])
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == 'a': put(img, x - w // 2 + i, y - h + 1 + j, PAL[pc])
            elif ch == 'c': put(img, x - w // 2 + i, y - h + 1 + j, PAL[cc])
    # listki pod kwiatkiem
    put(img, x - 1, y + 1, PAL['d']); put(img, x + 1, y + 1, PAL['d']); put(img, x, y + 1, PAL['m'])
    if big:
        put(img, x - 2, y + 1, PAL['m']); put(img, x + 2, y + 1, PAL['m'])
    return (x - w // 2 - 1, y - h, x + w // 2 + 2, y + 3)

def clover(img, rng, x, y):
    for dx, dy in [(0, 0), (-1, 1), (1, 1), (0, 2)]:
        put(img, x + dx, y + dy, PAL['m'])
    put(img, x, y + 1, PAL['g'])
    return (x - 2, y - 1, x + 3, y + 4)

def pebble(img, rng, x, y):
    big = rng.random() < 0.4
    c1, c2 = PAL['U'], PAL['T']
    if big:
        for dx in range(3): put(img, x + dx, y, c2)
        for dx in range(4): put(img, x - 1 + dx, y + 1, c1)
        put(img, x, y, PAL['V'])
        return (x - 2, y - 1, x + 4, y + 3)
    put(img, x, y, c2); put(img, x + 1, y, c2); put(img, x, y + 1, c1); put(img, x + 1, y + 1, c1)
    return (x - 1, y - 1, x + 3, y + 3)

class Occ:
    def __init__(self): self.boxes = []
    def free(self, b):
        x0, y0, x1, y1 = b
        for ox0, oy0, ox1, oy1 in self.boxes:
            for sh in (-W, 0, W):
                if x0 < ox1 + sh and ox0 + sh < x1 and y0 < oy1 and oy0 < y1: return False
        return True
    def add(self, b): self.boxes.append(b)

def scatter(rng, occ, n, fn, ymin, ymax, tries=60, margin=1):
    placed = 0
    for _ in range(n * tries):
        if placed >= n: break
        x = rng.randrange(W); y = rng.randrange(ymin, ymax)
        probe = fn(None, x, y)          # bbox bez rysowania
        b = (probe[0] - margin, probe[1] - margin, probe[2] + margin, probe[3] + margin)
        if b[1] < 0 or not occ.free(b): continue
        fn('draw', x, y); occ.add(b); placed += 1

def size_for(y):  # perspektywa: bliżej dołu = większe
    return 1 if y < 38 else (2 if y < 90 else 3)

def base_texture(rng, strength=1.0, tones=(DB, B, LB)):
    img = np.zeros((H, W, 3), np.uint8); img[:] = B
    v = noise_field(rng)
    for y in range(H):
        for x in range(W):
            t = v[y, x] + (BAYER[y % 4, x % 4] - 0.5) * 0.10
            if t > 0.30: img[y, x] = tones[2]
            elif t < -0.30: img[y, x] = tones[0]
    return img

def finish_top(img, base_rows=None):
    """rzędy 0-2 = kolor horyzontu, potem 4 stopnie rozjaśniania (dither 4x4)"""
    target = img.copy()
    img[0:3] = A
    levels = [0.2, 0.45, 0.7, 0.9]
    y = 3
    for p in levels:
        for _ in range(2):
            for x in range(W):
                img[y, x] = target[y, x] if BAYER[y % 4, x % 4] < p else A
            y += 1

def cluster(img, rng, occ, kinds, ymin, ymax, count):
    """Gromadki 2-4 kwiatków obok siebie (jak przy żywopłocie na niebie)."""
    for _ in range(count):
        for attempt in range(40):
            cx = rng.randrange(W); cy = rng.randrange(ymin, ymax)
            big = cy >= 40
            n = rng.choice([2, 3, 3, 4])
            spots = []
            for _i in range(n):
                dx = rng.randint(-7, 7); dy = rng.randint(-3, 3)
                x, y = cx + dx, cy + dy
                b = (x - 4, y - 6, x + 5, y + 4) if big else (x - 3, y - 4, x + 4, y + 4)
                if b[1] < 4 or not occ.free(b) or any(abs(x - sx) < (6 if big else 4) and abs(y - sy) < 5 for sx, sy in spots):
                    continue
                spots.append((x, y))
            if len(spots) >= 2:
                for (x, y) in spots:
                    kind = rng.choice(kinds)
                    bb = flower(img, rng, x, y, kind, big)
                    occ.add((bb[0], bb[1], bb[2], bb[3]))
                break

def tufts_all(img, rng, occ, counts, bands=((6, 38, 1), (38, 90, 2), (90, 152, 3))):
    hs = {1: 3, 2: 4, 3: 5}
    for (a, b, sz), n in zip(bands, counts):
        scatter(rng, occ, n, lambda mode, x, y, sz=sz: (tuft(img, rng, x, y, sz) if mode else (x - 5, y - hs[sz] - 1, x + 6, y + 2)), a, b)

def make(variant):
    rng = random.Random({'A': 11, 'B': 23, 'C': 37}[variant])
    occ = Occ()
    if variant == 'A':
        img = base_texture(rng)
        finish_top(img)
        cluster(img, rng, occ, ['w', 'y', 'p', 'r', 'w', 'y'], 12, 150, 20)
        tufts_all(img, rng, occ, (22, 20, 18))
        scatter(rng, occ, 16, lambda mode, x, y: (clover(img, rng, x, y) if mode else (x - 2, y - 1, x + 3, y + 4)), 10, 150)
    elif variant == 'B':
        # skoszone pasy: poziome, grubsze ku dołowi (perspektywa)
        img = np.zeros((H, W, 3), np.uint8)
        c1, c2 = (157, 206, 86), (173, 218, 104)
        y = 0; k = 0; th = 6
        edges = []
        while y < H:
            c = c1 if k % 2 == 0 else c2
            img[y:min(H, y + th)] = c
            y += th; edges.append(y); k += 1; th = int(th * 1.17 + 0.7)
        # pikselowy „ząbek” na granicy pasów (dither 50 %)
        for i, e in enumerate(edges):
            if e >= H: break
            upper = img[e - 1, 0].copy(); lower = img[e, 0].copy()
            for x in range(W):
                if x % 2 == 0: img[e - 1, x] = lower
                else: img[e, x] = upper
        finish_top(img)
        # krótkie jaśniejsze kreski „ścięcia” trawy
        for _ in range(150):
            x = rng.randrange(W); yy = rng.randrange(14, H); ln = rng.choice([2, 3, 3, 4])
            for i in range(ln): put(img, x + i, yy, LB if tuple(img[yy, x % W]) != LB else B)
        cluster(img, rng, occ, ['w', 'w', 'y', 'w'], 14, 150, 8)
        tufts_all(img, rng, occ, (7, 8, 8))
    else:  # C: ścieżka
        img = base_texture(rng)
        finish_top(img)
        top, bot = 15, 50
        ph1, ph2 = rng.uniform(0, 6.28), rng.uniform(0, 6.28)
        for x in range(W):
            t = top + 2.2 * math.sin(2 * math.pi * 2 * x / W + ph1) + 1.2 * math.sin(2 * math.pi * 5 * x / W + ph2)
            b = bot + 2.5 * math.sin(2 * math.pi * 3 * x / W + ph2) + 1.2 * math.sin(2 * math.pi * 7 * x / W + ph1)
            for y in range(int(t) - 1, int(b) + 2):
                if y < int(t) or y > int(b):
                    if (x + y) % 2 == 0: img[y, x] = PAL['S']
                else:
                    img[y, x] = PAL['s']
        for _ in range(200):
            x = rng.randrange(W); y = rng.randrange(top, bot)
            if tuple(img[y, x]) in (PAL['s'], PAL['S']): img[y, x] = PAL['S'] if rng.random() < 0.6 else PAL['V']
        for _ in range(28):
            x = rng.randrange(W); y = rng.randrange(top + 4, bot - 3)
            pebble(img, rng, x, y)
        occ.boxes.append((-5, top - 3, W + 5, bot + 5))
        cluster(img, rng, occ, ['w', 'y', 'p', 'r', 'w', 'y'], 54, 150, 16)
        cluster(img, rng, occ, ['w', 'y'], 6, 13, 3)
        tufts_all(img, rng, occ, (0, 16, 18), bands=((6, 12, 1), (52, 90, 2), (90, 152, 3)))
        scatter(rng, occ, 10, lambda mode, x, y: (clover(img, rng, x, y) if mode else (x - 2, y - 1, x + 3, y + 4)), 54, 150)
    return img

if __name__ == '__main__':
    v = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else {'C': 'source/tla/petla-trawnik-sciezka.png'}.get(v, f'/tmp/{v}.png')
    img = make(v)
    Image.fromarray(img, 'RGB').resize((W * K, H * K), Image.NEAREST).save(out)
    print(out, W * K, H * K)
