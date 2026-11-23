# Łatka — reguły gry (wersja wyjściowa, do strojenia)

Wszystkie liczby są w kodzie w jednym miejscu (`js/game.js`): `BUBBLE_RULES`,
`NEEDS_DECAY`, `ACTION_EFFECTS`, `SAD_THRESHOLD`, `SAD_ALLOWS`. Zmieniamy je tam.

## 1. Dymki nad głową pieska

Zasada: **potrzeb w dymkach nie pokazujemy** — dziecko samo pilnuje statusów (paski u góry). Dymki to zabawa i informacja.

| # | Kiedy | Co pokazuje | Jak często |
|---|-------|-------------|------------|
| 1 | Smutny piesek (potrzeba ≤ 10%) | ikona najniższej potrzeby; **ikonka pulsuje**, po odmowie mocniej | cały czas, aż potrzeba wzrośnie |
| 2 | Leży kupka | kupka | co 20 s |
| 3 | Piesek sam biegnie do innego pokoju | ikona pokoju, cały czas w drodze | ciągle w czasie biegu |
| 4 | „Chęci” | piłka, motylek, kret, serduszko, bańki (kąpiel), uśmiechnięty piesek, kostka; motylek / kret częściej, gdy są na ekranie | co 22–38 s |

- Priorytet: smutek > kupka > chęć. Jeden dymek naraz.
- **Żadnych tekstów na dole ekranu** — wszystko mówią dymki. Odmowa z powodu kupki (czynność w zabrudzonym pokoju, gry, motylek): w dymku pulsuje kupka (bez „NIE”).
- Smutny piesek nie goni motylka (chyba że brakuje mu zabawy): smutna animacja + pulsująca potrzeba w dymku.
- Aport: po wejściu w zabawę i po dłuższym czekaniu dymek z pulsującą piłką („rzuć mi!”).
- Ikonka jest centrowana w „brzuszku” dymku (bez ogonka), liczonym z grafiki, a nie na środku pola grafiki.
- Serce / gwiazdka (głaskanie, sprzątanie) to reakcje na dotyk, nie podlegają tym regułom.

### Smutny piesek (≤ 10%)
- Stoi w miejscu i losowo zmienia smutne animacje (a02: „26. Smutek — siad i westchnienie”, „27. Smutek — głowa w dół”, „28. Smutek — obrażony tyłem”), po 2 cykle każda.
- Nie biega sam po domu i nie robi kupki.
- Zgadza się tylko na to, czego mu brak: jedzenie / woda / sen; przy nudzie aport i gry; przy brudzie kąpiel i szczotkowanie. Na resztę (inne czynności, gry, głaskanie, dotknięcie, strzałki) reaguje smutkiem — w 60% odwraca się tyłem (obrażony), w 20% wzdycha, w 20% spuszcza głowę — a ikonka w dymku mocniej pulsuje. **Bez komunikatów tekstowych** (dzieci jeszcze nie czytają).
- **Nie przechodzi do innych pokoi** (strzałki i przesunięcie palcem → smutna odmowa, strzałki przygaszone). Ruszy się dopiero po wybraniu w menu czynności, która zaspokaja jego potrzebę — wtedy sam idzie do właściwego pokoju.
- Ikona tej potrzeby na górze (czerwone kółko) pulsuje.
- Powyżej 10% nic nie jest blokowane (usunięte dawne blokady gier przy wodzie/śnie < 15% z tekstem na dole). **„NIE” (kręcenie głową, a02 #20) tylko przy pełnej potrzebie (≥ 95%)**: jedzenie, woda, sen, kąpiel/szczotkowanie — od razu, bez chodzenia do pokoju. Nie dotyczy zabawy: gry, aport i motylki działają zawsze.

### Samodzielne wycieczki pieska
- W drodze piesek ma dymek z celem: ikona pokoju.
- Gdy na ekranie jest kret, jeżyk lub motylek do złapania, piesek nie rusza w drogę (sprawdza ponownie co 3 s), a w czasie biegu nowe zwierzęta się nie pojawiają.
- Piesek nie biega już sam „po potrzebę” (dawny próg 33% usunięty).

## 2. Potrzeby — spadek w czasie (punktów na minutę)

jedzenie 0,65 · woda 1,0 · zabawa 0,8 · sen 0,55 · czystość 0,35.
Podczas snu wszystko spada o połowę, a sen rośnie o 12 pkt/min.
Przy 10% i niżej piesek jest smutny (patrz pkt 1).

## 2a. Kupka (z logiki, ale dość często — to część zabawy)

- **Najedzony** (jedzenie ≥ 85%): robi kupkę, gdy stoi spokojnie; jedzenie spada o 10–15.
- **Zwykłe trawienie:** co 2–4 min, o ile jedzenie ≥ 25%; jedzenie spada o 5–8.
- Po każdej kupce przerwa minimum 45 s.
- **Żart:** po posprzątaniu w 10% przypadków piesek po 5–10 s robi kolejną (jedzenie −3).
- Kupka leży na pierwszym planie, tuż pod linią podłogi pieska, za ogonem; kret jest przed nią.
- Stałe `POOP_*` w `js/game.js`.

## 3. Wpływ aktywności na statusy

| Aktywność | jedz. | woda | zabawa | sen | czyst. |
|-----------|:----:|:----:|:------:|:---:|:------:|
| Jedzenie | +28 | −3 | | | |
| Woda | | +35 | | | |
| Zabawa (po zakończeniu rzutów) | | −5 | +24 | −4 | −3 |
| Pojedynczy rzut piłki | | −2 | +5 | −1 | |
| Legowisko / kość (den) | −2 | −2 | +16 | | |
| Mycie (bańki) | | | | | +38 |
| Szczotkowanie | | | +5 | | +12 |
| Kretowisko / Krety na łące (minigry) | −4 | −5 | +26 | | −8 |
| Jeżyk i owoce (minigra) | | −3 | +24 | | −2 |
| Złapany motylek | | −1 | +6 | | |
| Sprzątanie kupki | | | | | +6 |
| Sprzątanie piachu po krecie | | | | | +2 |
| Sen | | | | +12/min | |

(Wartości w `ACTION_EFFECTS`.) Wszystkie statusy są ograniczone do 0–100.

## 4. Do rozważenia później
- głaskanie: +zabawa (teraz nic nie zmienia),
- jeżyk: osobna minigra (za jakieś 10 godzin),
- czy brudna łapka po kopcu / kupce ma wpływ na nastrój (serce),
- rzadsze dymki dla „śpiącej" pory dnia.

## 4a. Aport (rzucanie piłki)
- Piłkę trzeba **złapać palcem** (przy łapach pieska), pociągnąć i puścić. Piesek przynosi ją zawsze do punktu startowego.
- **Cały lot to jeden ciągły tor** (grawitacja, odbicia, toczenie po trawie) — w sąsiednim pokoju piłka leci dokładnie z tą samą prędkością co przy wylocie, nic nie jest podmieniane.
- Gra decyduje tylko o parametrach rzutu:
  - **kąt** — z palca, przycięty do maks. kąta progu; jeśli trzeba, zmieniony o kilka stopni (najpierw ±4°, potem dalej), żeby piłka pierwszy raz dotknęła ziemi dopiero w sąsiednim pokoju,
  - **tempo** — z siły (`BALL_TIERS`): mocniejszy rzut odgrywany jest w „szybszym świecie” (grawitacja × s², prędkość × s) — ten sam kształt toru, lot s razy krótszy,
  - **miejsce zatrzymania** w sąsiednim pokoju — z siły (± trochę losowości); prędkość wyrzutu dobiera bisekcja.

| Prędkość palca | Tempo s | Maks. kąt | Gdzie stanie w sąsiednim pokoju |
|---|---|---|---|
| < 330 px/s | lekki rzut — toczy się kawałek w tym pokoju | — | — |
| 330–750 | 1,0 | 60° | ok. 30% pokoju od wejścia |
| 750–1300 | 1,2 | 70° | ok. 42% |
| 1300–2000 | 1,42 | 78° | ok. 54% |
| > 2000 | 1,68 | 80° | ok. 64% |

- Piłka **zawsze ląduje w sąsiednim pokoju**: wylatuje z kadru w powietrzu, w sąsiednim pokoju ląduje (zawsze z widocznym odbiciem), toczy się chwilę i staje. Nigdy dalej, nigdy nie odbija się od ściany, nie staje przy granicy pokoju (margines 14%). Szczyt łuku najwyżej 640 px.
- Strefa wylotu (8 stref: lewo/prawo × nisko/środek/wysoko, góra-lewo/prawo) wynika z kąta, siły i miejsca puszczenia.
- Rzut w stronę, gdzie nie ma pokoju (koniec świata): piłka toczy się kawałek w tym samym pokoju.
- Test: 300 losowych rzutów (różne miejsca puszczenia, kąty, siły) — 0 błędów.
- Stałe `BALL_*` w `js/minigame-fetch.js`.

## 5. Gry
- Dostęp: pozycja „Gry” w menu kołowym albo puchar w górnym pasku sceny → ekran z kafelkami gier.
- Łąka to zwykła plansza świata (kret, jeżyk, motylki jak w ogrodzie i na podwórku).
- **Pamięć motylków**: wzór 3 s (motylki od lewej do prawej) → po łące latają motylki w 5 kolorach (poziom 1: po 2 sztuki, 2–3: po 3), klikamy kolory z wzoru po kolei. 3 poziomy: ⭐ = 3, ⭐⭐ = 4, ⭐⭐⭐ = 5 motylków. 3 serduszka na pomyłki. Wygrana = puchar + konfetti, nagroda jak w grze z jeżykiem (`ACTION_EFFECTS.memory`). Ukończone poziomy oznaczone pucharem na kafelku (localStorage).
- **Znajdź pary** (memory): ⭐ 4×3 (6 par), ⭐⭐ 5×4 (10 par), ⭐⭐⭐ 6×5 (15 par). Bez kar i bez czasu; niepasujące karty same się zakrywają (albo od razu przy następnym dotknięciu). Pula 37 obrazków (ikony gry, owoce/słodycze, motylki, jeżyk); kolejna gra unika par z poprzedniej. Nagroda `ACTION_EFFECTS.pairs`.

## 7. Dźwięki

- `js/audio.js` — dźwięki syntezowane w locie (Web Audio), bez plików; `sfx("nazwa")`. Ciche, miękkie (8-bit), kompresor na wyjściu.
- Kontekst audio odblokowuje pierwszy dotyk. Przycisk 🔊/🔇 (obok pełnego ekranu i na ekranie ładowania) wycisza; stan w `localStorage` (`soundMuted`).
- Dźwięki: tap (każdy przycisk), dymek/potrzeba, złapanie (motylek, owoc, bańka), kret, minus, karty (flip/para/pudło), kroki pamięci, wygrana/przegrana, piłka (rzut, odbicia), jeżyk, smutek, sprzątanie.
- Nowa gra = wołaj `sfx(...)` w miejscach trafień, kar i ekranu wygranej.

## 8. Pamięć motylków — rundy i ochrona przed "przelotem" kliknięć

- Jedna gra na wybranym poziomie = 3 rundy (`MEMO_ROUNDS`), każda z nowym wzorem i od nowa 3 szansami. Między rundami ~1,3 s „Brawo! Runda N z 3”. Puchar/konfetti dopiero po 3. rundzie; przegrana (0 szans) kończy całą grę.
- Kafelki poziomów (Pamięć motylków, Znajdź pary) ignorują kliknięcia przez 700 ms po otwarciu ekranu — dotyk z poprzedniego ekranu nie wybiera poziomu.

## 9. Wspólny wygląd przycisków mini-gier

- Kolor = znaczenie: **zielony** (`btnGreen`) — „Zaczynamy!”, „Zagraj ponownie”, „Jeszcze raz”; **niebieski** (`btnBlue`) — „Wybierz poziom”; **czerwony** (`btnRed`) — „Powrót”, „Wróć do pieska”, a w grze okrągły ✕ (prawy górny róg; w aporcie na dole).
- Wszystkie karty startowe: ikona, tytuł, opis, zielony start, czerwony powrót. Karty końcowe: puchar + konfetti, kolejność zielony → niebieski (jeśli są poziomy) → czerwony.
- Kretowisko ma czerwony ✕ zamiast strzałki; aport ma ekran startowy („Aport!”) i końcowy (puchar) jak pozostałe gry.
- Nowa gra = dodaj klasy `btnGreen/btnBlue/btnRed` do przycisków; reszta (rozmiar, ikony, cień) dzieje się w CSS na końcu `style.css`.

## 10. Czcionki

- Baloo 2 (tytuły, przyciski, liczniki, tekst na canvasie) + Quicksand (opisy, dymki), z Google Fonts (`<link>` w `index.html`, `display=swap`). Bez sieci działa czcionka systemowa.
- Zmienne `--font-head` / `--font-body` w `css/style.css`; canvas: `'Baloo 2', Nunito, system-ui, sans-serif`.

## 11. Pamięć motylków — czas i rekordy

- Licznik czasu (pastylka obok ✕) liczy tylko fazę „klikaj” (bez pokazywania wzoru i pauz), suma 3 rund. Zapis w `localStorage` (`memoTimes`): rekord i ostatni wynik osobno dla każdego poziomu.
- Karta wygranej: „Twój czas”, „Rekord · Poprzednio”. Naklejka „NOWY REKORD!” tylko gdy poprzedni rekord istniał i został pobity (pierwsze ukończenie poziomu ustawia rekord bez naklejki).
- Karta przegranej: „Jeszcze raz” (zielony), „Wybierz poziom” (niebieski), „Powrót” (czerwony).

## 12. Ochrona przed „przelotem” kliknięć

- `js/popup-guard.js`: przez 700 ms od pokazania karty (start, wygrana, przegrana, wybór poziomu/gry) klik w jej przyciskach jest ignorowany. Powód: dotyk, który otworzył kartę (np. ostatni motylek), kończył się kliknięciem w przycisk pod palcem i od razu startował nową grę.
- Działa dla wszystkich kart z klasami `.molePopup`, `.moleWinPopup`, `.memoLevels`, `.pairsLevels`, `.gamesFull`. Nowa karta w tych klasach jest chroniona automatycznie.
