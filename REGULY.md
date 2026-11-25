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
- **TYMCZASOWO** `NEEDS_DECAY.clean = 8` (normalnie 0.9), żeby szybko zobaczyć brud. Przed oddaniem gry przywrócić 0.9.
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
