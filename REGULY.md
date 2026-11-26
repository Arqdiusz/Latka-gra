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

## 24. Iskierki po sprzątaniu (v0.8.195)
- Grafika `animacje/star-check.png` (arkusz 2×2 po 64 px). `sparkleBurst(cx, cy, pts)` w `game.js`: w miejscu sprzątnięcia zapalają się po kolei 5 gwiazdek (~1,1 s), unoszą się i gasną; rysowane nad pieskiem (`sparklesDraw`).
- Wywołują je: `cleanPoop`, `cleanMoleDirt`, `cleanDish` (duży wariant) i `cleanLump` (mały). Przy czystych łapkach (`pawsEnd(true)`) każda łapa dostaje małe iskierki po kolei (punkty łap ze szkieletu: `pawScreenPoints`).
- Uwaga: `clamp` w tej grze wymaga 3 argumentów (`clamp(v, min, max)`), bez domyślnych.
- Czyszczenie łapek (v0.8.196): każda łapka, która zrobi się czysta, dostaje iskierki od razu (pierwsza, druga, …) i „plink”. Blobs brudu mają numer łapy (`paw`), `pawsDone` pilnuje, które już świeciły.
- Karta „Brawo!” po łapkach pojawia się po ~0,9 s (żeby było widać ostatnie iskierki), z fanfarami i konfetti. Zamiast pucharu jest wesoły piesek („Radość z powrotem” a01, klatki wyrównane stopami), a przy jego łapkach mrugają iskierki (`pawsWinDogStart`).

## 25. Motylek do złapania — nowy przebieg (v0.8.197)
- Start: piesek spokojnie odchodzi pod bliższą ścianę (28% szerokości, jak przy krecie z kostką) i odwraca się do środka. Dopiero wtedy z przeciwnej strony nadlatuje motylek (przelot 9 s). Do tego czasu motylek czeka niewidoczny (`pending`), a scena jest zajęta. Jeśli piesek nie dojdzie pod ścianę w 8 s, motylek i tak leci.
- Okno klikania: pulsująca ramka tylko wtedy, gdy pościg jest wykonalny (`butterflyPlan`): motylek musi być jeszcze przed pieskiem (≥ 40 px), a złapanie musi wypaść w ciągu 2,5 s. W praktyce ok. 2,5 s.
- Po kliknięciu motylek zawraca i ucieka tam, skąd przyleciał (0,075 px/ms, spłoszony zygzak, „frrr”), a piesek biegnie za nim i łapie go w skoku (a02 „15”), potem motylek siada na nosie (a02 „18”) i odlatuje dalej w stronę ucieczki.
- Niekliknięty motylek przelatuje nad pieskiem i znika za ekranem.
- Poprawki (v0.8.198): piesek pod ścianą stoi jak zwykle, przodem do ściany (nie odwraca się do motylka), i w czasie przelotu nie spaceruje sam (`autonomous` wstrzymane). Po kliknięciu obraca się i biegnie za motylkiem (300 px/s). Ramka pojawia się wcześniej (~1 s): gdy motylek jest jeszcze daleko, ucieka wolniej (0,075 → 0,055 → 0,035 → 0,02 px/ms), żeby piesek zdążył; okno klikania ok. 3,4 s.

## 26. Brud na łapkach — okruchy zamiast siatki (v0.8.199)
- `pawDirtMake()`: każda łapa ma własny, stały wzorzec 34 okruchów (ziarno losowania zależne od numeru łapy). Okruchy leżą bez siatki, mają 2–4 px, czasem są podłużne i mają doklejony drobny okruszek innego koloru. Gęściej leżą przy samej łapie, rzadziej dalej, a ok. 25% „wspina się” w górę nóżki.
- Kolejność pojawiania się: od środka łapy na zewnątrz z dużą domieszką losowości, więc brud rozchodzi się nierówno, plamami. Progi (`thr`) są nadal rozłożone równo, więc każda łapa brudzi się w tym samym tempie.
- Okruch, który wypada poza pieska, jest przysuwany do łapy, a gdy i to nie trafia w psa, pomijany.

## 27. Brud na sierści i kamera na łapki (v0.8.200)
- Brud na sierści (`furLevel`, `furPixels`, `furOverlay` w `game.js`) liczy się z samej klatki, bez dodatkowych grafik. Zaschnięte błoto narasta od dolnych krawędzi (brzuszek, łapki od spodu, też spód ucha i podbródek) w górę, z plamistym brzegiem (szum na siatce 3 px) i jaśniejszymi okruchami. Obrys zostaje czysty.
- Zależy od czystości: przy 65 brudu nie ma, przy 15 i mniej jest najmocniejszy. 8 poziomów, każdy jako gotowa nakładka (cache). Kąpiel w bańkach (czystość 100) zmywa wszystko.
- (v0.8.209) Tymczasowe przyspieszenie czystości usunięte — tempo wg sekcji 29.
- Czyszczenie łapek: kamera lekko się zbliża (`pawsZoom`, ×1,25 od v0.8.203, wcześniej ×2,1; płynnie 0,6 s), kadr na całego pieska (łapki + głowa). Przybliżana jest cała scena (`.sceneZoom` = tło + canvas), więc dotyk szmatki trafia jak wcześniej (`pointerXY` liczy z przybliżonego prostokąta canvasu). Kamera wraca po zakończeniu lub po ✕.
- Szmatka (v0.8.201): arkusz `animacje/szmatka.png` (4×4 po 64 px, białe tło zdjęte do obrysu, iskierki i kreski ruchu zostały). Spokojnie, mało klatek (v0.8.202): 9 — czeka; 9↔10 — trze (dopóki palec przeciera łapki, 230 ms na klatkę); 14→15 — krótkie wyżymanie raz, gdy któraś łapka zrobi się czysta. Z arkusza usunięte też jasne resztki tła przy rogach obrysu (iskierki i kreski ruchu zostały). Rozmiar 48 px sceny (scena jest przybliżona ×1,25).
- Czyszczenie łapek na grzbiecie (v0.8.203): piesek leży na plecach z łapkami do góry („11. Na grzbiecie”, a01). Spokojnie klatka 39, co jakiś czas wierci się (40) (`PAWS_LIE`, `pawsLie`). Gdy łapka zrobi się czysta — krótkie, gęste wiercenie 39↔40 (130 ms, 0,52 s; klatka 45 odrzucona w v0.8.204), po ostatniej wstaje do „Radość z powrotem” i karty „Brawo!”. Szmatka (v0.8.204) czeka nieruchomo na podłodze pod pieskiem z pulsującą białą ramką (jak przy piłce), po dotknięciu idzie za palcem; rozmiar 72 px sceny. Strefa szmatki sięga wyżej (do GROUND−140).
- Szmatka i czas czyszczenia (v0.8.205): szmatka to jedna klatka (9) bez przeskakiwania klatek. Przy tarciu delikatnie kołysze się ±7° (płynnie narasta i gaśnie), a gdy łapka zrobi się czysta, lekko „podskakuje” (+8% przez 0,3 s). Rozmiar 90 px sceny. Czyszczenie trwa zawsze tyle samo, niezależnie od brudu: tempo ścierania `pawsRate = PAWS_WIPE_RATE × pawDirt/100`, każdy pas schodzi po ~800 px drogi szmatki (ok. 1,5× dłużej niż wcześniej).

## 28. „Czysty piesek” — merdanie i kilka mignięć (v0.8.206)
- Koniec czyszczenia łapek i koniec kąpieli: zamiast „Radość z powrotem” (podskoki) piesek spokojnie stoi i merda ogonem (`WAG` = a01 63/27, 240 ms na klatkę).
- Wokół całego pieska mignie po kolei 10 iskierek (`TWINKLE_PTS`, `twinkleDraw`): każda raz, przez ~2 s, potem nic już nie mruga. W scenie (`bodyTwinkleT`), na karcie „Brawo!” po łapkach i na karcie po kąpieli. Na karcie po łapkach nie ma już ciągle mrugających iskierek przy łapach.
- Kąpiel (`bubbleWinShow` w `minigame-bubbles.js`): otrząśnięcie raz → mignięcia → stanie z merdaniem (zamiast pętli rozglądanie ↔ siad).
- Iskierki przy każdej czyszczonej łapce w trakcie czyszczenia zostały (krótkie, jednorazowe).
- Poprawki (v0.8.207): na karcie piesek jest wyrównany do ramki pierwszej klatki (wcześniej ramka zmieniała się z ogonem i piesek skakał 1–2 px na boki); merdanie wolniej (300 ms). Przy szorowaniu co ~0,2 s pojawia się przy szmatce jedna mała iskierka. Gdy łapka zrobi się czysta: duży błysk (miękkie białe światło 0,35 s + 5 dużych gwiazdek, `sparkleBurst(..., flash = true)`).
- Panel DEV (v0.8.208): wiersze „Brud łapek” (`pawDirt` 0–100) i „Brud sierści” (0–100, przeliczane na czystość: 0% przy czystości ≥ 65, 100% przy 15), ±20 jak inne potrzeby (`devGet`/`devSet`).

## 29. Sesja 15 minut, potrzeby i blokada rodzica (v0.8.209)
- Plik `js/session.js`. Sesja = 15 min gry, liczone tylko gdy gra jest otwarta i widoczna (`sessionTick` z `updateNeeds`). Stan w localStorage `latka-sesja-v1` (`played`, `locked`).
- Spadek potrzeb na minutę (`NEEDS_DECAY`): jedzenie 4,5, woda 6, zabawa 5, energia (sen) 6,3, czystość 3. Energia spada równo od 100 do ~5% w 15 min; przy ≤10% (czerwone) piesek jest smutny (siedzi tyłem) i chce spać. Pozostałe potrzeby: w trakcie sesji trzeba pieska nakarmić, napoić, pobawić się i umyć.
- Drzemka w trakcie sesji (`NAP_MS` 25 s, `NAP_GAIN` +4%): piesek sam się budzi — ziewa i przeciąga się (a02 „08”), potem wraca do swoich spraw. Energii przybywa tylko symbolicznie, a czas sesji i tak płynie.
- Koniec sesji: po 15 min albo gdy energia spadnie do 3%. Trwająca zabawa (mini-gra, aport) może się dokończyć, najdłużej 2 min. Piesek zasypia, pokazuje się ekran „Piesek śpi” (śpiący piesek w legowisku, a02 „07”).
- Odblokowuje tylko rodzic: działanie z mnożenia 6–9 × 6–9 (zła odpowiedź = drgnięcie i nowe działanie). Blokada zostaje po odświeżeniu strony.
- Nowa sesja po odblokowaniu: energia 100%, jedzenie/woda/zabawa 75%, czystość 80%, czyste łapki, licznik od zera. Tak samo przy pierwszym uruchomieniu.
- DEV: „Sesja (min)” ±5, przyciski „Blokada rodzica” i „Nowa sesja”.

## 30. Częstsze zdarzenia i sensowne dymki (v0.8.210)
- Zdarzenia w ogrodzie wracają szybciej: motylek po 8–20 s (było 12,5–30), jeżyk 8–18 s (było 12–27), kret 6–15 s (było 7,5–22,5). Kret z kostką i kopanie: pierwsze 30–90 s / 45–110 s po wejściu do pokoju, kolejne po 2–3 min; wspólny odstęp z kostkami 1,5–2,5 min (po starcie 1,5–2 min).
- Dymki z chęciami mają sens: gdy któraś potrzeba spada poniżej 40% (żółta), w 60% dymków piesek pokazuje tę najniższą (jedzenie, woda, piłka, sen, kąpiel). Kąpiel (bańki) pojawia się tylko przy czystości < 50%, piłka tylko przy zabawie < 75%.
- Przy samej ścianie (głowa < 84 px od krawędzi) dymek się nie pojawia — czeka, aż piesek odejdzie (przy krawędzi dymek przygasa).

## 31. Szczekanie (v0.8.211)
- Klatki: arkusz 03, klatki 25–30 (z grafik użytkownika: przeniesione na ich siatkę pikseli 10,24 px, ok. 44×41, i przeskalowane ×2,73 do wielkości stojącego pieska; ustawione jak a01 63 — lewy brzeg x=4, stopy y=116). Tułów i nogi zawsze z jednej klatki (F4), z pozostałych tylko głowa — nic nie drga. 25 = zamknięty pysk, 26 = „hau”, 27 = wesołe (pysk otwarty), 28 = uśmiech z zamkniętymi oczami, 29 = mrugnięcie, 30 = mały pysk (grzeczne). Punkty łap w `szkielet.json` (a03, klatki 25–30) — brud na łapkach działa.
- Animacje (a03): „07. Szczeknięcie »Hau!«” (25,25,26,25,25; 150 ms), „08. Wesołe hau” (130 ms), „09. Grzeczne hau — prośba” (140 ms). Podwójne „hau, hau” = dwa razy „07” pod rząd.
- Dźwięki (`audio.js`, synteza): `bark` (zwykłe), `barkHappy` (wyżej, krócej), `barkSoft` (ciche). Grają na klatce, w której pysk się otwiera (`barkParts`).
- Kiedy: dymek „szczekanie” → „hau, hau”; dymek z potrzebą (< 40%) → grzeczne hau (prośba); dotknięcie pieska → w 35% wesołe hau zamiast zwykłej reakcji; samo z siebie ok. 5% samodzielnych zachowań → „hau” lub „hau, hau”. Nie szczeka śpiący, smutny ani schowany (`bark()`).
- Ekran blokady (v0.8.212, wybrany wariant 2): dla dziecka same obrazki, bez tekstu — śpiący piesek w legowisku z małym dymkiem (ikona snu), pod nim w pionie: zegar z zielonym plusem („więcej czasu”) → strzałka w dół → pulsujący obrazek rodziców (bez tła, tylko poświata). Ikony z arkusza ikon: thought, sleep, clock, plus, parents, lock. Mnożenie dla rodzica jest schowane pod kłódką w prawym dolnym rogu (okienko „Dla rodzica”: informacja o 15 minutach, działanie, „Odblokuj”, „Zamknij”).
- Zasada pracy: przed każdym wdrożeniem trzy propozycje do wyboru.

## 32. Nowe menu „Liczymy kostki” (v0.8.213)
- Wygląd jak karta kreta „Piesek znalazł kostkę!”: jasna karta na przyciemnionej grze, u góry piesek z kostką (a03, to samo co na karcie kreta), tytuł „Piesek znalazł kostkę!”. Bez okrągłych przycisków i bez ✕ — wyjście to czerwony „‹ Wróć”.
- Dwa duże kolorowe działania z zapisem, bez kostek: niebieskie „3+2=?” (Dodawanie) i pomarańczowe „5−2=?” (Odejmowanie), kratka „?” przerywana; wybrane ma żółtą obwódkę i ✓, niewybrane jest wyblakłe.
- Poziom: rozwijana belka (nazwa + kropki + duża niebieska strzałka). Dotknięcie rozwija listę czterech poziomów pod belką (bez podpisów), wybór zwija ją z powrotem.
- Pod belką: „Dodajemy i odejmujemy kostki. Policzymy razem?”, potem zielony „▶ Liczymy!” i czerwony „‹ Wróć”. Wszystko blisko siebie (karta ma wysokość zawartości, wyśrodkowana).
- Ochrona przed „przelotem” kliknięć (700 ms) działa jak dotąd.
- v0.8.214: karta wyboru nie ma paska przewijania (`overflow: visible` — wspólna reguła `.moleCard` dawała `overflow-y: auto`); lista poziomów jest niższa (wiersze 38 px), więc w całości mieści się w karcie.

## 33. Liczenie kostek — klawiatura od początku i przełączanie dywaników (v0.8.215)
- Klawiatura jest widoczna od początku rundy (przyciemniona i nieaktywna, gdy żadne pole nie jest wybrane — np. gdy piesek jeszcze kopie). Znika dopiero po poprawnym wyniku, żeby zrobić miejsce na „Dalej”, i wraca z następną rundą.
- Gdy kostki spadną, sam jest wybrany lewy dywanik: jego „?” jest większe i mruga, drugie stoi spokojnie. Dotknięcie drugiego dywanika w dowolnej chwili przełącza pisanie na niego; to, co było wpisane (jeszcze niezatwierdzone), wraca do „?”.
- Po zatwierdzeniu liczby sam wybiera drugi dywanik; po obu liczbach pokazuje działanie i od razu wybiera kratkę wyniku (można ją też dotknąć ponownie).
- Piesek się rozgląda tylko, gdy jakieś pole jest wybrane (nie przez całą rundę).

## 34. Poziomy liczenia kostek wg zakresu sumy (v0.8.216)
- Łatwy: sumy 2–6, Średni: 4–8, Trudny: 6–10 (zawsze z kostkami), Sprawdzian: 6–10 bez kostek, brakuje jednej liczby. Chowanie kostek (stary „Trudny”) wypadło.
- Dodawanie: losuje się sumę z zakresu, potem pierwszy składnik (1…suma−1). Odejmowanie: liczba, od której odejmujemy, jest z zakresu poziomu, odjemnik od 1 do tej liczby −1.
- Ta sama para nie wypada dwa razy z rzędu. Sprawdzone 400 losowań na poziom i działanie — wszystko w zakresie.

## 35. Wpisana liczba zostaje po przełączeniu dywanika (v0.8.217)
- Liczba wpisana w „?” zostaje na swoim dywaniku, gdy dziecko przełączy się na drugi (bez zielonego OK). Po powrocie można ją poprawić (⌫) albo zatwierdzić. OK nadal sprawdza tylko aktualnie wybrane pole.
- v0.8.218: jedno zielone OK sprawdza wszystkie dywaniki naraz. Dobre zostają zielone, złe mrugają na czerwono i wracają do „?” (wybrane jest wtedy pierwsze złe). Jeśli obie liczby są dobre — od razu pokazuje się działanie. Wynik działania nadal zatwierdza się własnym OK.

## 36. Nowy wybór poziomu: Pamięć motylków i Znajdź pary (v0.8.219)
- Ekran wyboru poziomu to jasna karta na przyciemnionej grze (jak okienko kreta i menu kostek). W lewym górnym rogu pastylka z ikoną i nazwą gry: „Pamięć motylków” (ikona motylka) i „Znajdź pary” (ikona kart/pamięci).
- U góry karty pas trawy z pościgiem: piesek biegnie (a01 „02. Bieg”, klatki 3,4,9,10) i goni motylka (losowy kolor, klatki z `CFG.motyle`). Rysuje to `js/level-pick.js` (jedna pętla, sama się zatrzymuje, gdy ekran jest zamknięty).
- Poziomy to duże, wyśrodkowane przyciski: gwiazdki, nazwa, rekord i ostatni wynik (w Parach dwa wiersze: rekord i ostatnio — czas · próby); puchar za ukończony poziom w rogu. Na dole czerwony „‹ Wróć” (zamiast kółka ✕).
- Ochrona przed „przelotem” kliknięcia (700 ms) bez zmian.
- v0.8.220: wybór poziomu ma w tle ogród z mini gier (`tla/001-gry.png`), u góry belkę gry (ikona + nazwa, bez ✕ — wychodzi się „Wróć”), a pod nią jasną kartę. Zamiast pasa trawy z pościgiem piesek robi animację w miejscu na jasnym tle: w Pamięci motylków siedzi i obserwuje fruwającego motylka (a02 „17. Motyl — obserwowanie na siedząco”), w Znajdź pary patrzy w górę, jakby się zastanawiał (a01 „16. Patrzenie w górę / łapa”). W Znajdź pary na przyciskach tylko liczba par (6 / 10 / 15 par), bez „4 × 3”.

## 37. Liczymy kostki — gra sama dobiera poziom (v0.8.221)
- Koniec z wyborem poziomu i działania. Ekran startowy to karta „Piesek znalazł kostkę!” (piesek, „Liczymy!”, „Wróć”, mała kłódka dla rodzica). Z karty kreta „Liczymy!” startuje od razu grę.
- `js/bones-adapt.js`: trzy umiejętności z osobnymi poziomami — dodawanie (5 poziomów: sumy 2–4, 2–6, 4–8, 6–10, 6–10 z chowaniem kostek), odejmowanie (te same zakresy), „czego brakuje” (3 poziomy: 2–6, 4–8, 6–10). Zadania lecą wymieszane w jednej grze.
- Start: same dodawania. Odejmowanie odblokowuje się, gdy dodawanie ≥ poziom 3 (sumy 4–8); „czego brakuje” gdy dodawanie ≥ 4 i odejmowanie ≥ 2. Odejmowanie i „brakuje” są zawsze o stopień niżej niż dodawanie (do końca drabinki dodawania).
- Poziom rośnie po 4 dobrych zadaniach z rzędu, spada po 2 złych w ostatnich 3. „Dobre” = najwyżej 1 pomyłka i odpowiedź w 25 s. ~20% zadań to wyzwanie o stopień wyżej (nieudane nie karze), ~25% to powtórka pomyłek, które wracają, dopóki nie pójdą dobrze. Ta sama para nie wypada dwa razy z rzędu.
- Rozróżnianie działania: dodawanie niebieskie (tytuł, znak „+”, linia pod belką), odejmowanie pomarańczowe; przy zmianie działania napis „Teraz odejmujemy!” / „Teraz dodajemy!”, przy pierwszym razie „Nowość: odejmowanie!” / „Nowość: czego brakuje?”.
- Stan w localStorage (`latka-liczenie-v1`).
- Ekran dla rodzica (`js/bones-parent.js`): kłódka na ekranie startowym → mnożenie → poziomy umiejętności (kropki, zakres, % bez pomyłek, średni czas), pomyłki do powtórki oraz tabela „Czy dziecko chce liczyć?” (7 dni i razem): gra zaproponowana (kret z kostką), rozpoczęta, dokończona, „Nie teraz”, „Wróć” na ekranie startowym, ✕ w trakcie gry. Przycisk „Zacznij liczenie od nowa” (dwa dotknięcia) zeruje poziomy, statystyka odmów zostaje.

## 38. Liczymy kostki — okienko „Nowość” dla dzieci, które nie czytają (v0.8.222)
- Gdy gra odblokuje nowe działanie, pierwsze zadanie z nim poprzedza okienko na pół ekranu: dymek pieska z trzema przykładami po kolei (zmiana co ~2,3 s, kropki pod spodem), pod pieskiem plakietka z nazwą i znakiem — „Odejmowanie ( − )” (pomarańczowa) albo „Czego brakuje ( ? )” (fioletowa) — i duży zielony przycisk OK. Dźwięk „good” przy pokazaniu.
- Odejmowanie: `5 − 2 = 3` (wynik na zielono). „Czego brakuje”: `3 + [?] = 5` z pustym polem w ramce.
- Okienko pokazuje się tylko raz na umiejętność: po OK zapisuje się `adapt.seen.sub/miss` (localStorage). „Zacznij liczenie od nowa” w widoku rodzica zeruje też to, więc okienko wróci przy ponownym odblokowaniu.
- Po OK startuje normalne zadanie. Zamiast banera „Nowość: odejmowanie!” jest teraz to okienko; baner „Teraz odejmujemy!/Teraz dodajemy!” przy zmianie działania został.
- `.bonesNews` jest w ochronie przed „przelotem” kliknięcia (700 ms); ✕/zakończenie gry zamyka okienko i zatrzymuje animacje.

## 39. Czyste łapki — pasek postępu (v0.8.223)
- Podczas czyszczenia łapek szmatką u góry sceny jest kremowa plakietka jak przy kąpieli: ikonka łapki + zielony pasek (bez tekstu). Plakietka chowa na czas czyszczenia serduszko samopoczucia.
- Pasek idzie za prawdziwym postępem: 1 − (grudki jeszcze widoczne ÷ grudki na starcie), nigdy się nie cofa; po ostatniej grudce 100% i fanfary. Przerwanie ✕ chowa pasek, zostaje tyle brudu, ile nie wytarto (bez zmian).
- Ikona `icons.paw`; stan: `pawsTotal`, `pawsProg`, `pawsBadgeSet()`, widoczność w `updatePawsUi()`.

## 40. Liczymy kostki — karta startowa z opisem gry zamiast pieska (v0.8.224)
- Karta „Liczymy kostki!” ma dwa kafelki jak Pamięć motylków: (1) dwa talerze z kostkami i znak „+” między nimi — „Policz kostki na talerzach”; (2) przykład `2 + 1 = 3` z zielonym znaczkiem ✓ — „Wpisz wynik i dotknij OK”. Pod spodem: „Raz dodajemy, raz odejmujemy — gra sama dobiera.”, zielone „Liczymy!”, czerwone „Wróć”, kłódka rodzica w rogu.
- Pieska z tej karty usunięto (piesek został w okienku „Nowość” i na karcie kreta). Kostki z `icons.bone`.

## 41. Karty startowe gier — kafelki z obrazkami i większy „start” (v0.8.225)
- Wszystkie gry mają teraz na karcie startowej dwa kafelki z obrazkami (dobrze ✓ / źle ✗ albo dwa kroki):
  - Krety na łące i Znajdź 10 kretów: cały kret (✓ „stukaj”) / w połowie schowany (✗ „nie stukaj”) — klatki z arkusza kreta (preset „alert” i połowa „wychodzenia”).
  - Znajdź pary: dwie takie same karty (✓ „para zostaje”) / jabłko i kostka (✗ „karty się chowają”).
  - Aport: piłka ze strzałką „złap i pociągnij” / piłka w locie „puść — piesek biegnie”.
- Przyciski kart startowych: zielony „Zaczynamy!/Liczymy!” 50% większy (102 px wysokości, 29 px napis; na karcie liczenia 90 px), czerwony „Wróć do pieska/Wróć” o 25% mniejszy (45 px).

## 42. Pamięć motylków — poziomy z motylkami zamiast gwiazdek (v0.8.226)
- Na kafelkach poziomów zamiast gwiazdek są różnokolorowe motylki (tyle, ile ma poziom: 3, 4, 5; zielony, żółty, czerwony, fioletowy, niebieski) — większe niż gwiazdki (~58 px).
- v0.8.227: poprawna polszczyzna na poziomach: „3 motylki”, „4 motylki”, „5 motylków”.
- v0.8.228: puchar ukończonego poziomu stoi w linii z napisem („5 motylków 🏆”), nie w rogu — nie nachodzi na motylki ani wyniki. Sprawdzone z rekordami i pucharami na 440×880 i 360×640.

## 43. Ekrany końcowe — ogród zamiast przyciemnienia (v0.8.229)
- Wszystkie okna końcowe (`.moleWinPopup`: „Brawo!”, „Prawie się udało!” w każdej grze) mają pod sobą nieprzezroczyste tło ogrodu (`tla/001-gry.png`), które zasłania grę razem z jej paskiem i czerwonym ✕. Dzieci nie mają już czego naciskać w rogu — wychodzi się tylko dużymi przyciskami („Zagraj ponownie”, „Powrót”). Zmiana tylko w CSS (jedna reguła).

## 44. Ekran wczytywania i ekran startowy (v0.8.230)
- **Wczytywanie:** piesek biegnie po ogrodzie z gry; tło zapętlone z dwóch obrazów odbitych lustrzanie (`tla/petla-niebo.png`, `tla/petla-trawnik.png`) — niebo przesuwa się wolno, trawnik szybko (efekt głębi). Zielony pasek postępu pod spodem.
- **Logo** „Mój mały / JAMNICZEK” (czcionka Ranchers z Google Fonts, z awaryjną Baloo 2), wycentrowane, litery JAMNICZEK różnej wielkości, kolor #8a7358, biała poświata i cień, bez tła; kołysze się ±1° i lekko unosi. Szerokość „JAMNICZEK” sama dopasowuje się do ekranu.
- **Przejście (gra gotowa):** ogród zwalnia, piesek hamuje (bieg → chód), robi fikołka w łuku i ląduje na środku ekranu; pasek zamienia się w duży przycisk „Kontynuuj” (przy pierwszym uruchomieniu bez zapisu: „Graj”), po lądowaniu pojawia się mały czerwony „Zacznij od nowa” (tylko gdy jest zapis).
- **Ekran startowy** może trwać długo: piesek losowo (bez powtarzania tej samej zabawy z rzędu) łapie motylka, kopie kostkę, rozgląda się, ziewa, drapie się, otrząsa, siada; co jakiś czas znów rusza biegiem (ogród znów się przesuwa, ~3,5 s) i staje. Co 7–15 s przez ekran przelatuje motylek.
- **„Zacznij od nowa”** → ostrzeżenie „Cały postęp w grze zniknie i nie da się go przywrócić” z dużym zielonym „Nie, wracam” i małym czerwonym „Tak, zacznij od nowa”. Kasuje zapis gry, potrzeby, liczenie, poziomy pamięci i par (rekordy też) i odświeża stronę. Blokada czasu dla rodzica (`latka-sesja-v1`) i wyciszenie dźwięku zostają.
- **Pełny ekran:** „Kontynuuj/Graj” od razu włącza pełny ekran (ten sam gest); mały przełącznik w lewym górnym rogu (przekreślony = wyłączony, zapamiętany w `latka-fullscreen`) pozwala to wyłączyć. Dawny przycisk „Graj w oknie” zniknął.
- Zapis gry powstaje dopiero po naciśnięciu „Kontynuuj/Graj” (`window.gameStarted`) — samo otwarcie i zamknięcie ekranu startowego nie tworzy zapisu.

## 45. Czcionka osadzona i ruch pieska na ekranie wczytywania (v0.8.231)
- **Ranchers w grze:** plik `fonts/Ranchers-Regular.ttf` (+ licencja `fonts/OFL.txt`), `@font-face` na początku `css/style.css`, `<link rel="preload">` w `index.html`. Z Google Fonts zostały tylko Baloo 2 i Quicksand — logo nie zależy już od sieci.
- **Piesek na wczytywaniu/starcie rysowany jak w grze** (a nie surową klatką): łapy na linii gruntu klatki (113 z 128 px), skala 2,35×0,7 (bieg ×1,04), przesunięcia klatek z `config.json`. Koniec z podskakiwaniem (bobem) — rytm daje sama animacja.
- **Klatki biegu i marszu zależą od przebytej drogi** (36 px / 13 px na klatkę, jak w grze); trawnik przesuwa się z prędkością pieska względem ziemi (bieg 70 cqw/s, marsz 15,6 cqw/s), niebo 5× wolniej — łapy nie „ślizgają się”.
- **Przejście bez fikołka i skoku:** bieg → hamowanie → marsz (ogród dalej płynie) → ogród staje, a piesek idzie na środek z tą samą prędkością → staje → zabawy. Ponowny bieg na ekranie startowym: krok → marsz → bieg → marsz → stop.
- Motylek na nosie liczony tą samą geometrią co piesek.

## 46. Ekran startowy — animacje wzięte z gry (v0.8.232)
- Zestaw zabaw pieska na ekranie startowym (losowo, bez powtórki z rzędu): **stoi** (a01 „17. Spokojne stanie”), **merda ogonem** (WAG), **kopie kostkę** (a03: kopanie, wykopanie, zabawa), **przechodzi w inne miejsce** (krótko — marsz 60 px/s, dalej — bieg 300 px/s, z obrotem w stronę celu, jak `route()` w grze), **łapie motylka**. Usunięto zabawy spoza gry (siad, ziewanie, drapanie, otrząsanie).
- **Łapanie motylka** to ten sam scenariusz co event w grze, bez klikania: piesek idzie pod ścianę (28%/72% szerokości), odwraca się, z drugiej strony leci motylek (linia y=200, sinus ±13 px, 9 s przez ekran), zawraca i ucieka (0,075 px/ms, 700 ms, zygzak) dokładnie w punkt znacznika pierwszej klatki pogoni, piesek skacze (a02 „15. Motyl — skoki i pogoń”, przesuw o 0,1 szerokości), motylek „przyklejony” do zielonego znacznika klatek (a02 „18. Motyl — ląduje przy nosie”), potem odlatuje (1 s). Rozmiar motylka w evencie 96,5 px, trzepot 180 ms/2 (spłoszony /3).
- **Motylki-tło** jak w grze: wlot z lewej/prawej/góry po łuku, „pijane” dryfowanie w pasie nieba (marginesy 44 px, y 104–176), losowy wylot; rozmiar 96 px; jeden naraz, nowy co 5–12 s (w grze 12–30 s).
- Piesek rysowany odbiciem lustrzanym (jak `drawDog`) z geometrią znaczników liczoną dla obu kierunków.
