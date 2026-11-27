#!/usr/bin/env python3
"""Składa ikonę gry (główka jamnika z serduszkiem na niebie) z grafik gry i zapisuje
assets/icons/*.png: icon-512, icon-192, icon-maskable-512 (Android), apple-touch-icon (iPhone),
favicon-32. Uruchom z katalogu głównego repozytorium:  python3 tools/make-icons.py
Źródła: source/animacje/latka-animacje-01.png (klatka 20), source/ikony/latka-ikony.png (serce),
assets/backgrounds/start-sky.webp (niebo z chmurkami)."""
import os
from PIL import Image

OUT = "assets/icons"
os.makedirs(OUT, exist_ok=True)
sheet = Image.open("source/animacje/latka-animacje-01.png").convert("RGBA")
atlas = Image.open("source/ikony/latka-ikony.png").convert("RGBA")
sky = Image.open("assets/backgrounds/start-sky.webp").convert("RGBA")


def cell(img, n, cols, size):  # n liczone od 1, wierszami
    r, c = divmod(n - 1, cols)
    return img.crop((c * size, r * size, (c + 1) * size, (r + 1) * size))


def tight(im):
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def up(im, k):  # piksele bez wygładzania
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


dog = tight(cell(sheet, 20, 6, 128))  # pies zwrócony do widza
heart = cell(atlas, 25, 6, atlas.width // 6)


def compose(size, sky_xy, dog_scale, dog_xy, heart_xy, heart_px):
    c = sky.crop((sky_xy[0], sky_xy[1], sky_xy[0] + size, sky_xy[1] + size))
    d = up(dog, dog_scale)
    c.alpha_composite(d, dog_xy)
    c.alpha_composite(heart.resize((heart_px, heart_px), Image.NEAREST), heart_xy)
    return c.convert("RGB")


# zwykła ikona: pełny kadr, główka dużo, ciało ucięte krawędzią
main = compose(512, (260, 40), 6, (512 - 20 - dog.width * 6, 46), (34, 30), 130)
# maskable (Android przycina do koła ⌀80%): mniejszy pies, niebo wokół
mask = compose(640, (200, 0), 5, (-45, 150), (110, 110), 120).resize((512, 512), Image.LANCZOS)

main.save(f"{OUT}/icon-512.png", optimize=True)
main.resize((192, 192), Image.LANCZOS).save(f"{OUT}/icon-192.png", optimize=True)
main.resize((180, 180), Image.LANCZOS).save(f"{OUT}/apple-touch-icon.png", optimize=True)
main.resize((32, 32), Image.LANCZOS).save(f"{OUT}/favicon-32.png", optimize=True)
mask.save(f"{OUT}/icon-maskable-512.png", optimize=True)
print("zapisano:", sorted(os.listdir(OUT)))
