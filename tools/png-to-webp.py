#!/usr/bin/env python3
"""Zamienia grafiki źródłowe PNG (source/) na bezstratny WebP używany w grze (assets/).

Uruchom z katalogu głównego repozytorium:
    python3 tools/png-to-webp.py            # tylko pliki, których PNG jest nowszy niż WebP
    python3 tools/png-to-webp.py --all      # wszystkie
    python3 tools/png-to-webp.py source/animacje/kret.png   # wskazane pliki

Konwersja jest bezstratna (piksele identyczne — skrypt to sprawdza). Po podmianie pliku
o tej samej nazwie podbij `window.ART_V` w index.html (docs/REGULY.md §59).
Nowa grafika: dopisz ją poniżej do MAP i wpisz ścieżkę assets/... w kodzie/konfiguracji.
"""
import os, sys
from PIL import Image, ImageChops

S, A = "source/", "assets/"
MAP = {
    # arkusze animacji pieska i sprite'y
    **{S + f"animacje/{n}.png": A + f"sprites/{n}.webp" for n in (
        "latka-animacje-01", "latka-animacje-02-X", "latka-animacje-03", "motyle-new", "kret",
        "hedgehog", "hedgehog-game", "ball-1", "ball-2", "ball-3", "ball-4", "bubble-001",
        "bubble-002", "star-check", "wrong-check", "naczynia", "szmatka")},
    S + "inne/kupka.png": A + "sprites/kupka.webp",
    S + "ikony/latka-ikony.png": A + "ui/latka-ikony.webp",
    # tła pokoi (wysokie 768×2136) i planszy gier
    **{S + f"tla/wysokie/00{i}.png": A + f"backgrounds/rooms/00{i}.webp" for i in range(1, 7)},
    S + "tla/wysokie/001-gry.png": A + "backgrounds/games/meadow-games-tall.webp",
    S + "tla/001-gry.png": A + "backgrounds/games/meadow-games.webp",
    S + "tla/001.png": A + "backgrounds/games/meadow-room.webp",
    S + "tla/petla-niebo.png": A + "backgrounds/start-sky.webp",
    S + "tla/petla-trawnik.png": A + "backgrounds/start-lawn.webp",
}

args = [a for a in sys.argv[1:] if not a.startswith("--")]
todo = args or [src for src, dst in MAP.items()
                if "--all" in sys.argv or not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst)]
for src in todo:
    if src not in MAP:
        sys.exit(f"{src}: brak w MAP (tools/png-to-webp.py) — dopisz mapowanie")
    dst = MAP[src]
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(src).convert("RGBA")
    # exact=True zachowuje kolor także w całkiem przezroczystych pikselach
    im.save(dst, "WEBP", lossless=True, quality=100, method=6, exact=True)
    same = ImageChops.difference(im, Image.open(dst).convert("RGBA")).getbbox() is None
    print(f"{src} -> {dst}: {os.path.getsize(src)//1024} KB -> {os.path.getsize(dst)//1024} KB, piksele identyczne: {same}")
    if not same:
        sys.exit("BŁĄD: WebP różni się od PNG")
if not todo:
    print("Nic do zrobienia — wszystkie WebP są aktualne.")
