# Mój mały jamniczek (Łatka)

Polska gra w stylu tamagotchi z pikselowym jamnikiem — dla małych dzieci (PEGI 3). Działa w przeglądarce (Canvas 2D),
bez bibliotek i bez budowania: zwykłe pliki, publikowane z gałęzi `main` na GitHub Pages.
**https://arqdiusz.github.io/Latka-gra/**

## Uruchomienie lokalnie
```
python3 -m http.server 8793      # w katalogu głównym repozytorium
# otwórz http://localhost:8793/
```

## Układ katalogów
| Katalog | Zawartość |
|---|---|
| `index.html`, `css/style.css` | strona i style (czcionki osadzone, bez Google Fonts) |
| `js/` | kod gry: `game-*.js` (rdzeń gry podzielony tematycznie, wczytywany w tej kolejności co w `index.html`), `loader.js` (ekran startowy), `minigame-*.js` (gry), `event-*.js`, `arc-carousel.js` (koło menu), … |
| `assets/sprites/` | arkusze animacji pieska i zwierząt, piłki, bańki, szmatka, kupka — **WebP** |
| `assets/ui/` | atlas ikon |
| `assets/backgrounds/` | `rooms/` (tła pokoi 768×2136), `games/` (łąka gier), `start-sky/lawn` (ekran startowy) |
| `assets/fonts/` | Ranchers, Baloo 2, Quicksand (+ licencje OFL) |
| `data/config.json` | ścieżki grafik, ikony, ramki animacji (`meta`), środki dymków |
| `data/animations/` | ustawienia animacji z edytora (klatki, presety, `szkielet.json` = punkty łap) |
| `source/` | **źródłowe PNG** (z tych powstają pliki w `assets/`), pełne czcionki |
| `tools/` | edytor animacji, `png-to-webp.py`, `szkielet.py`, `tlo-gry.py` |
| `docs/` | `REGULY.md` (zasady i dziennik zmian), `AUDYT.md` (audyt z 27.11.2026) |
| `archive/` | stare, nieużywane pliki (workflow, prototyp koła, stare arkusze) — zostają jako archiwum |

## Nowa lub zmieniona grafika
1. PNG wrzuć do `source/…` (te same podkatalogi co dotąd).
2. `python3 tools/png-to-webp.py` — bezstratna konwersja do `assets/…` (nowy plik dopisz do `MAP` w skrypcie).
3. Jeśli podmieniasz plik o tej samej nazwie: podbij `window.ART_V` w `index.html` (inaczej przeglądarki zostaną przy starej kopii).

## Wersje
Numer wersji jest w `<title>` w `index.html`, a `?v=NNN` przy skryptach/stylach wymusza pobranie nowego kodu. Zasady pracy,
dziennik zmian i opisy mechanik: `docs/REGULY.md`.
