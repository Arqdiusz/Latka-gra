# Audyt gry „Mój mały jamniczek” — 27.11.2026 (v0.8.243)

Audyt tylko opisuje stan i rekomendacje — **nic w grze nie zostało zmienione**.
Pomiary: Chromium (Playwright), lokalny serwer, sieć ograniczona narzędziem przeglądarki
(„4G” = 9 Mb/s i 170 ms opóźnienia, „wolne 4G” = 1,6 Mb/s i 150 ms). Rozmiary tekstu
liczone bez kompresji; GitHub Pages kompresuje tekst (gzip), więc prawdziwe wartości
tekstu są ok. 3,7× mniejsze (661 KB → 180 KB). Czasy z throttlingu są orientacyjne.

## 1. Podsumowanie

| | Dziś | Po poprawkach (szacunek) |
|---|---|---|
| Pierwsze wejście: pobrane dane | **7,36 MB**, 67 żądań | ok. 4,7 MB (bez duplikatów), ok. 3,5 MB z WebP |
| Kolejne wejście | **3,1 MB** pobierane od nowa | ok. 0 MB grafik (z pamięci przeglądarki) |
| Przycisk „Graj” gotowy, „4G” | 8,4 s | ok. 4–5 s (pierwsze), ok. 1–2 s (kolejne) |
| Przycisk „Graj” gotowy, „wolne 4G” | 34 s | ok. 16–22 s (pierwsze) |
| Bez limitu sieci | 3,4 s | — |

Procesor i płynność **nie są problemem**: w grze 60 klatek/s także przy procesorze 4× wolniejszym
(najgorsza klatka 17 ms), sterta JS 17 MB, start (`boot`) to jedno zadanie ok. 130 ms
(ok. 500 ms przy 4× wolniejszym telefonie). Cały problem to **sieć i bajty grafik**.

## 2. Ładowanie — znaleziska (od najważniejszego)

1. **Cache-bust `?t=` w `loadImage()` (game.js:3715).** Każda grafika z `loadImage` dostaje
   `?t=<czas>`, więc przeglądarka nigdy nie używa zapisanej kopii: przy każdej wizycie pobiera
   ok. 3,1 MB od nowa. To ten sam mechanizm co `fresh()` dla JSON-ów, ale dla ciężkich PNG
   jest zbyt kosztowny.
2. **Te same arkusze pobierane dwa razy.** Ekran wczytywania (`loader.js`) pobiera `a01`, `a02-X`,
   `a03` i motylki bez `?t=`, a gra potem te same pliki z `?t=` (inny adres = osobne pobranie):
   703 + 774 + 334 + 24 = **1,8 MB zmarnowane**. Dodatkowo loader ładuje
   `motyle-001-animacje.png`, które jest **bajt w bajt tym samym plikiem** co `motyle-new.png`.
3. **Pobierane tła, które nigdy nie są pokazywane.** `boot()` ładuje z góry `tla/001–006.png`
   (`config.json → assets.rooms`, razem **847 KB**), ale pokoje wyświetlają `tla/wysokie/*.png`
   (`roomSVG()`). Za to prawdziwe tła (2,4 MB, 6 × ok. 400 KB) nie są ładowane z góry, więc
   sąsiednie pokoje mogą „doskakiwać” przy pierwszym przejściu.
4. **Łańcuch sekwencyjny na starcie:** HTML → CSS → game.js (166 KB) → `config.json` → 8 plików
   JSON → dopiero wtedy grafiki. `a03`, `naczynia`, `star-check`, `szmatka` ładują się jeszcze
   później i po kolei. Lista grafik jest stała, więc większość można zacząć pobierać zaraz po
   starcie skryptu, równolegle z JSON-ami.
5. **Google Fonts (Baloo 2 + Quicksand)** blokują pierwsze wyświetlenie (arkusz stylów z
   zewnętrznego serwera), dokładają dwa połączenia (`googleapis`, `gstatic`), nie działają
   offline, a każde wejście wysyła adres IP dziecka do Google. `Ranchers` jest już u nas — warto
   tak samo zrobić z pozostałymi (potrzebne pliki `.woff2`; z tego środowiska nie mam do nich
   dostępu, trzeba je wgrać).
6. **Format grafik.** Arkusze animacji mają 26–35 tys. kolorów (wygładzone krawędzie), więc nie
   ma co ich redukować do 256 kolorów bez straty. Za to **bezstratny WebP** daje:
   arkusze −25…30 %, ikony −36 %, tła −8…41 % (niebo ekranu startowego tylko −8 %) (razem 3,46 MB → 2,56 MB na zbadanej próbce).
   WebP działa na wszystkich aktualnych telefonach (iOS 14+).
7. **Brak PWA/offline.** Nie ma `manifest.json` ani service workera. Dla dziecka na wyjeździe bez
   internetu: po jednym wejściu gra mogłaby działać offline i startować od razu.

## 3. Kod

**Rozmiary:** `game.js` 4234 linii / 170 KB / 169 funkcji (monolit), `style.css` 4291 linii,
22 pliki JS ładowane jako osobne `<script defer>` (razem ok. 480 KB, ok. 120 KB po gzip),
`index.html` 564 linie. Wersja `?v=263` jest wpisana ręcznie w 24 miejscach (podbijana `sed`-em).

**Martwy kod (potwierdzone `grep`-em, brak wywołań):**
- `previewSwipe`, `settleSwipe` (47 linii; gest przeciągania pokoi jest celowo wyłączony),
- `NEED_GENITIVE`, `BUTTERFLY_SPEED` (game.js), `ballExitIndex`, `worldOf` (minigame-fetch.js),
  `memoShuffle` (minigame-memory.js),
- CSS: klasy `ballCard`, `bonesMenuDog`, `loadTitle`, `pairsTileStats` nie występują w HTML/JS,
- `config.json`: `config.a01`, `config.a02` (nadpisywane plikami z `animacje-ustawienia/`),
  `assets.butterflies` (komentarz w kodzie: nieużywane).

**Panel DEV (game.js:4152–4234 + HTML + CSS):** oznaczony „do usunięcia przed publikacją”.
Pokazuje się po **5 stuknięciach w serduszko w ciągu 3 s** — małe dziecko może to zrobić
przypadkiem i zmienić potrzeby pieska. Proponuję usunąć albo włączać tylko przez `?dev=1`.

**Kolejne spostrzeżenia:**
- CSS: 547 reguł, 49 selektorów zdefiniowanych więcej niż raz (57 nadmiarowych bloków —
  efekt kolejnych poprawek nadpisujących starsze), 6 × `!important`, 19 animacji. Do posprzątania
  przy okazji, bez dużego zysku w szybkości.
- Wspólny zasięg globalny (brak modułów): nazw globalnych powtarzających się między plikami
  brak (sprawdzone), ale kolejność `<script defer>` jest istotna.
- Brak testów automatycznych; sprawdzamy ręcznie skryptami Playwright (warto je zapisać w repo).

**Podział `game.js` (bez narzędzi build, zwykłe pliki skryptów):**
1. `game-core.js` — stan, potrzeby, zapis, `save/load`, `locks`, kolejka animacji (linie ok. 1–1330),
2. `game-bubbles.js` — reguły dymków i `bubbleDraw` (310–490, 3300–3480),
3. `game-travel.js` — pokoje, strzałki, `autonomous`, `route` (606–1330, 2211–2290),
4. `game-dirt.js` — brudne łapki, brud na sierści, kupka, szmatka (1439–2020, 3005–3100),
5. `game-wildlife.js` — motylek-event, motylki-tło, kret, jeżyk (2294–3300),
6. `game-draw.js` + `game-boot.js` — `draw`, `loopFrame`, `boot`, `devPanel` (3482–4234).
Ryzyko: kolejność ładowania i zmienne `const/let` na poziomie pliku — każdy krok wymaga przejścia
wszystkich gier. Zysk jest głównie w czytelności i w tym, że każdy plik da się zmieniać osobno.

## 4. Katalogi i pliki

| Miejsce | Stan | Rekomendacja |
|---|---|---|
| `tla/001–006.png` | stare tła 768×1024; nieużywane na ekranie (patrz 2.3); źródło dla skryptów | przenieść do `zrodla/` albo usunąć z preloadu |
| `tla/001-gry.png` | stara łąka gier; nadal używana przez CSS i jeżyka | przepiąć na `tla/wysokie/001-gry.png`, stary skasować |
| `animacje/` | wymieszane: arkusze pieska, sprite’y gier, ikony, siatki źródłowe | rozdzielić (patrz niżej) |
| `animacje/latka-animacje-02.png` | starsza wersja; gra używa `…-02-X.png`, a JSON edytora wskazuje `…-02.png` | zostawić jeden plik (`-02-X` → `-02`) |
| `animacje/motyle-001-ABC.png`, `-XYZ.png` | nieużywane | do `zrodla/` lub usunąć |
| `animacje/motyle-001-animacje.png` | identyczny z `motyle-new.png` (używa go tylko loader) | usunąć, loader na `motyle-new.png` |
| `animacje/*-lapki-nos-ogon.png` | źródło dla `narzedzia/szkielet.py` | do `narzedzia/zrodla/` |
| `animacje-ustawienia/latka-animacje.json` | 32 KB, nieużywany (stary format) | usunąć |
| `ustawienia/Latka-ustawienia.json` | nieużywany | usunąć |
| `inne/kupka.png` | jedyny plik w katalogu | do sprite’ów |
| `proto/` + `kolo.html` | prototyp koła z 26.11 (wyniki wdrożone w grze) | do `dev/` albo usunąć |
| `.github/workflows/latka-menu.yml`, `latka-update-once.yml` | stare skrypty łatające `.dock` w CSS/HTML; Pages publikuje się z gałęzi, nie przez nie; `latka-menu` kopiuje tylko część katalogów (bez `css/`, `js/`, `data/`) | **usunąć** — ręczne uruchomienie mogłoby uszkodzić grę |
| `README.md` | 12 bajtów | krótki opis + odnośniki do `REGULY.md`/`AUDYT.md` |
| `.git` | 37 MB (32 MB luźnych obiektów) | `git gc` zmniejszy; graczy nie dotyczy |

**Proponowany układ po porządkach** (wszystkie ścieżki w `config.json`, CSS, JS i skryptach
`narzedzia/` trzeba zmienić jednym przebiegiem i przetestować):
```
index.html
css/style.css
js/…                         (game-*.js, minigame-*.js, …)
assets/sprites/              arkusze pieska, zwierzęta, kostki, bańki, szmatka, kupka
assets/ui/                   ikony, atlas
assets/backgrounds/          pokoje (wysokie), łąka gier, pętla ekranu startowego
assets/fonts/
data/config.json
data/animations/*.json       (dawne animacje-ustawienia/)
tools/                       edytor, szkielet.py, tlo-gry.py + zrodla/
docs/REGULY.md, docs/AUDYT.md
```

## 5. Proponowana kolejność prac

1. **Ładowanie (duży zysk, małe ryzyko):** usunąć `?t=` z obrazów (zamiast tego jedna stała wersji
   grafik), wspólne obrazy dla loadera i gry, usunąć preload starych teł i dodać preload prawdziwych
   (bieżący pokój najpierw, reszta w tle), wcześniejszy start pobierania, dopisanie `a03`/`naczynia`/
   `szmatka`/`star-check` do wspólnej partii, usunięcie duplikatu motyli.
2. **WebP + czcionki:** konwersja bezstratna wszystkich grafik (z zapasem PNG w `zrodla/`),
   czcionki Baloo 2 / Quicksand lokalnie (po wgraniu plików `.woff2`).
3. **Sprzątanie:** martwy kod, panel DEV, stare workflow, nieużywane pliki, README.
4. **Katalogi + podział `game.js`:** dopiero po 1–3, z pełnym przejściem wszystkich gier po
   każdym kroku.
5. **Opcjonalnie:** PWA (offline, ikona na ekranie głównym).
