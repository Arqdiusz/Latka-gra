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

## 13. Znajdź pary — czas i próby

- Pasek pod tytułem: **Czas** (od pierwszego odkrycia karty do ostatniej pary), **Próby** (jedno odkrycie dwóch kart = 1 próba; idealnie tyle prób, ile par), **Pary** (znalezione / wszystkie).
- Dwa osobne rekordy na poziom: najkrótszy czas i najmniej prób, plus ostatni wynik (`localStorage`: `pairsRecords`).
- Karta wygranej: wynik, „Rekord”, „Poprzednio”. Naklejka: „REKORD CZASU!”, „REKORD PRÓB!” albo „NOWE REKORDY!” — tylko gdy poprzedni rekord istniał i został pobity.
- Wybór poziomu: tabelka Rekord/Ostatnio × Czas/Próby.

## 14. Tempo biegu między pokojami

- Bieg do wybranego pokoju (menu, autonomiczny): 320–340 px/s do sąsiedniego pokoju, a przy dwóch i więcej pokojach zawsze jedna prędkość 520 px/s. Strzałki i przesunięcie palcem też szybsze. Nogi pieska dopasowują się same (krok liczony z przebytej drogi).

## 15. Stłuczone naczynie (Aport)
- Mocny rzut w PRAWO (próg 3 i 4 z `BALL_TIERS`) ma 20% szansy, że piłka poleci o 1 pokój dalej (40% z tego: próba o 2; gdy nie ma toru → 1 pokój). Jedno naczynie naraz.
- Naczynie rozbija się w LEWEJ połowie pokoju lądowania (x 0,12–0,38), piłka dotacza się ZA nim (x ≥ 0,62). Brzęk `sfx("glass")` w chwili pierwszego kontaktu z ziemią, przed przybiegnięciem pieska. Skorupy: losowe z 4 (`animacje/naczynia.png`, 4×40 px), rysowane 109 px, podstawą 26 px poniżej linii pieska/piłki.
- Skorupy leżą od chwili, gdy pokój wchodzi w kadr; piłka pokazuje się dopiero, gdy toczy się za nimi (nie widać uderzenia w naczynie). Gdy piesek wbiega do tego pokoju: staje na x 0,46, siada tyłem (a02 „28. Smutek — obrażony tyłem”), w dymku pulsują skorupy (`say("dish")`), etap `dish-sad`. Dopiero po posprzątaniu (dotyk skorup lub ukryty `.dishAccess`) cieszy się merdaniem ogona (a01 #22 „Radość z powrotem”, 2 cykle, dymek ⭐ 3,2 s) i od razu biegnie do piłki, podnosi ją i wraca (`dishResume`).
- `dishMess = {room, x, idx, shown}` zapisuje się w `save()` (tylko gdy `shown`). Sprzątanie +2 czystości.
- `window.dishForce = N` wymusza próbę przerzutu o N pokoi (testy).

## 16. Tempo statusów (v0.8.161)
- Spadek na minutę (`NEEDS_DECAY`): jedzenie 1,1 · woda 1,3 · zabawa 1,2 · sen 0,8 · czystość 0,9 (było 0,65 / 1 / 0,8 / 0,55 / 0,35). Przy pełnych 100% piesek dojdzie do ≤ 10% w ok. 1,5–2 h zabawy.
- Karmienie ustawia jedzenie na 100%.
- Brudzenie przy zabawie (czystość za rundę/rzut): kret −14, jeżyk −7, zabawa −8, pary/pamięć −4, rzut piłką −3, motylek −2.

## 17. Brudne łapki (v0.8.162)
- `pawDirt` 0–100 (zapis w `save()`). Rośnie ~0,4/s w ogrodzie, na podwórku i na łące; po Kretowisku +30, po Jeżyku +15. Brudne łapki lekko obniżają czystość (−0,4/min od 35).
- Brud widać na łapkach pieska w każdej klatce (a01 i a02). Łapy: cienkie części sylwetki (sylwetka minus jej „otwarcie”) bez głowy z jasnymi końcówkami + małe jasne plamy (fikołek, leżenie na grzbiecie); grudka siedzi na pikselu łapy najdalszym od środka ciała w danej kolumnie. Poprzednio (tylko a01, najniższe piksele): `pawDirtDraw` rysuje grudki z każdej klatki (najniższe piksele sierści w kolumnach), bez osobnego arkusza. Szablon grudek jest wspólny dla wszystkich klatek (te same x, głębokość, kształt), więc gdy piesek stoi w miejscu, brud stoi w miejscu; rusza się tylko razem z uniesioną łapą. Mniej brudu = mniej grudek, znikają grupami.
- W domu (salon, kuchnia, łazienka) piesek z `pawDirt ≥ 45` gubi grudkę ziemi na podłodze co ok. 320 px PRZEBYTEJ drogi (maks. 4, `lumps`), każda −8 brudu; w staniu w miejscu nic nie zostawia. Dotknięcie grudki sprząta ją (+1,5 czystości).
- Czyszczenie: pozycja „Łapki” (szmatka) w menu kołowym → piesek idzie do łazienki i staje w miejscu (`paws-clean`). Przy czystych łapkach (< 3) piesek kręci głową „NIE” + szmatka w dymku. Brud jest podzielony na pasy wzdłuż łap (`pawLvl`, 14 px komórki arkusza); przeciągnięcie palca zciera pasy pod szmatką (0,0016 na px w zasięgu ±12 px, pojedynczy skok max 25 px), „plink” za każdy wytarty pas. Szmatka płynnie dogania palec; zanim dziecko dotknie, lekko kołysze się przy łapach. Czerwony ✕ przerywa (zostaje niewytarty brud).
- Gdy zniknie ostatnia grudka na bieżącej klatce: fanfary + konfetti + karta „Brawo! Czysty piesek!”, czystość +25, zabawa +6.
- W dymku „chęci” w domu pojawia się szmatka, gdy łapki są brudne.

### 17a. Brud na łapkach — siatka punktów (v0.8.166)
- Pozycje łap bierzemy z ręcznie narysowanych siatek `animacje/latka-animacje-0N-lapki-nos-ogon.png` (magenta = łapy, zielony = nos, niebieski = czubek ogona).
- `python3 narzedzia/szkielet.py` → `animacje-ustawienia/szkielet.json` (72 klatki × arkusz; nos i ogon zapisane na przyszłość).
- Animacje statyczne (łapy się nie ruszają) mają punkty przyklejone do 1. klatki (tolerancja 5 px), więc brud stoi w miejscu; w fikołku i przy uniesionej łapie jedzie za punktem.
- Klatka bez punktów łap = brak brudu. Po zmianie siatki uruchom skrypt ponownie.

## 18. Mini gra „Liczymy kostki” (v0.8.172)
- Plik `js/minigame-bones.js`, kafelek w menu Gry. Dodawanie lub odejmowanie w zakresie 10, cztery poziomy: do 5 / do 10 / trudny (do 10; gdy obie liczby wpisane, kostki znikają i wynik trzeba policzyć w głowie, bez timera; po dobrym wyniku wracają) / sprawdzian (do 10, bez kostek, w działaniu losowo brakuje jednej liczby: „? + 3 = 9”, „8 − ? = 5”). 5 działań = wygrana, nagroda `ACTION_EFFECTS.bones`.
- Przebieg: kostki spadają na dwa dywaniki → dziecko wpisuje liczbę na każdym (klawiatura) → pojawia się działanie (np. 5 + 2 = ?), → wpisuje wynik. Liczby wpisuje się prosto w pole: w „?” nad dywanikiem i w kratkę wyniku (działanie zostaje u góry dolnego panelu, klawiatura wysuwa się pod nim; bez osobnego okienka). Pomyłka = pole trzęsie się na czerwono. Po dobrym wyniku: fanfary (`sfx("win")`), sam fikołek w miejscu (a01 „05. Turlanie A”). Runda: piesek kopie (1×) i wykopuje kostkę, dopiero wtedy kostki spadają na dywaniki; stoi z kostką w pysku („05” 2×) i ją odkłada („06”) — albo wcześniej, gdy dziecko dotknie pierwszego „?”. „?” klikalne po spadnięciu ostatniej kostki. Nowa runda: piesek wraca na środek i kopie.
- Gra ma własne okno z łąką z mini gier (`tla/001-gry.png`); piesek jest rysowany na `.bonesCanvas` małym odtwarzaczem w `minigame-bones.js` (presety z JSON, przesunięcia klatek jak w silniku), pies z gry czeka pod nakładką. Animacje: kopanie → wykopanie → „05. Stoi z kostką, przechyla głowę” → „06. Odkłada kostkę” → a01 „17. Spokojne stanie” (arkusz `latka-animacje-03.png`, presety w `animacje-ustawienia/latka-animacje-03.json`), wpisywanie = a01 „04. Rozglądanie się”, dobra liczba = a01 „08. Uszy / mrugnięcie”, pomyłka = a02 „20. NIE — próba z powrotem”, dobry wynik = a01 „01. Skok” + „Radość z powrotem”, a potem znów wykopuje kostkę. Kostka nigdy nie pojawia się/znika z pyska nagle: jeśli piesek ją trzyma, przed reakcją najpierw ją odkłada. Wpisywane pole („?” dywanika lub kratka wyniku) jest większe i mruga.

## 19. Wspólna belka mini gier (v0.8.175)
- Klasa `.gBar` (css na końcu `style.css`): kremowy pasek 64 px u góry, tytuł po lewej (`.gBarTtl`), dodatki po prawej (np. czas), czerwony ✕ w rogu. Używają jej: Gry, wybór poziomu, Znajdź pary, Pamięć motylków, Kretowisko, Krety na łące, Jeżyk i owoce, Liczymy kostki. Bańki zostają bez belki (decyzja użytkownika).
- Panele rysowane na canvasie zaczynają się od y = 78 (pod belką).

## 20. Kret z kostką — zdarzenie w pokojach ogrodowych (v0.8.177)
- Plik `js/event-bone-mole.js`. Łąka, Ogród, Podwórko. Losowany na równi z innymi zwierzakami (`wlPick`: kret, kret z kostką, jeżyk, motylki), z tym samym tempem co zwykły kret; nigdy razem z innym zwierzakiem ani przy leżącym piachu po krecie (zwierzaki nie nachodzą na siebie).
- Start: piesek najpierw spokojnie odchodzi w stronę bliższej ściany (do 28% szerokości — cały widoczny, jak w zwykłym chodzeniu), a kret wychyla się po drugiej stronie środka (62% szerokości od ściany pieska), na torze pieska; chowa się i zostaje pulsujący kopiec (nieklikany znika po 2 min albo po wyjściu z pokoju). Jeśli piesek nie dojdzie pod ścianę w 8 s, kret i tak wychodzi.
- Dotyk kopca: piesek podchodzi od swojej strony, przodem do kopca, tak by ziemia z animacji kopania wypadła na kopcu; kopie (a03 „01”), wykopuje kostkę („02”), obraca się (kopiec zostaje za nim) i stoi z kostką na środku ekranu („05”), po ok. 1,9 s pojawia się karta „Piesek znalazł kostkę!” ze zmieniającymi się działaniami z pulsującym „?” (np. 2 + 1 = ?; 4 działania co 2,2 s) → „Liczymy!” otwiera „Liczymy kostki”, „Nie teraz” → odkłada kostkę („06”). Kopanie brudzi łapki (+5).
- DEV: przycisk „Kret z kostką”.

## 21. Brud i czystość (v0.8.178)
- Łapki brudzą się na zewnątrz ~0,15/s (ok. 11 min do bardzo brudnych). Gry: Kretowisko +15, Jeżyk +8, Liczymy kostki +8, kret z kostką +5.
- Czystość spada szybciej przy brudnych łapkach: tempo × (1 + brud/100), czyli do 2×.
- Udana kąpiel (bańki) = czystość 100 i czyste łapki (ścierka nie jest jedynym sposobem).

## 22. Zdarzenia a wycieczki pieska (v0.8.180)
- Gdy w pokoju jest zdarzenie (motylek do złapania, kret, jeżyk, kopiec z kostką — także czekający kopiec), piesek sam nigdzie nie wybiega (`worldBusy`).
- Motylka i kopiec z kostką da się kliknąć także w trakcie samodzielnej wycieczki pieska — kliknięcie ją przerywa (`eventTapOk`/`stopAutoTrip`).
- Czekający kopiec z kostką ma tę samą pulsującą, okrągłą ramkę co motylek.
- Po kostce zwykły kret nie wychodzi w tym pokoju przez 60–90 s.
- Bieg między pokojami: zawsze 300 px/s (v0.8.181; wcześniej 520/400 przez kilka pokoi).
- Arkusz a03 dostaje „meta” (ramka, głowa) liczone z pikseli przy starcie (dymki nad pieskiem, głaskanie).

## 23. Piesek kopie kostkę i odstęp między zdarzeniami z kostką (v0.8.192)
- Plik `js/event-bone-dig.js`. Rzadkie zdarzenie w Łące/Ogrodzie/Podwórku, losowane na równi z innymi zwierzakami (`wlPick` ma teraz 5 pozycji). Piesek sam kopie (a03 „01”), wykopuje kostkę (a03 „02”), stoi z nią (a03 „05”) do 18 s. W tym czasie wokół kostki pulsuje okrągła ramka.
- Dotyk kostki albo pieska otwiera tę samą kartę co przy kreciku z kostką („Piesek znalazł kostkę!”, przyciski „Liczymy!” i „Nie teraz”); piesek w tym czasie dalej stoi z kostką. Bez dotyku piesek po 18 s odkłada kostkę (a03 „06”) i wraca do swoich spraw.
- Na karcie (obu: kret i kopanie) stoi piesek z kostką (a03 „05”, klatki wyrównane stopami, bez drgania) zamiast ikony kostki (v0.8.193).
- Startuje tylko, gdy piesek stoi między 25% a 75% szerokości, nie jest smutny ani brudny, nie ma kupki ani piachu kreta; łapki +5 brudu.
- Wspólny odstęp `boneGapUntil` (`boneGapSet()` w `event-bone-mole.js`): kret z kostką, kopanie pieska i zakończona gra w kostki wyznaczają kilka minut bez następnego zdarzenia z kostką (po starcie ~2,5–3,5 min, po końcu ~3–5 min).
- Kret z kostką też jest rzadszy: pierwszy 60–150 s po wejściu do pokoju, kolejny po 4–6 min.
- Kopanie jest „zajętą sceną” (`worldBusy`, `wildlifeBusy`): nikt inny się nie pojawia, piesek nie rusza na wycieczkę.
- DEV: przycisk „Piesek kopie”.
- Dymek z kostką (v0.8.194): ok. 2 s po pokazaniu piesek biegnie do najbliższego pokoju ogrodowego (z innego pokoju lub w tym samym, na środek) i tam kopie (`boneWishStart`/`boneWishUpdate`). Kostka trafia do puli dymków tylko wtedy, gdy kopanie jest możliwe (po wspólnym odstępie, bez smutku). Chęć wygasa po 45 s.
- Po posprzątaniu kupy, piachu kreta, naczyń i po czystych łapkach w dymku jest serduszko (wcześniej gwiazdka).
