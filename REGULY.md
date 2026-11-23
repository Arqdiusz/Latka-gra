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
- Ikonka jest centrowana w „brzuszku” dymku (bez ogonka), liczonym z grafiki, a nie na środku pola grafiki.
- Serce / gwiazdka (głaskanie, sprzątanie) to reakcje na dotyk, nie podlegają tym regułom.

### Smutny piesek (≤ 10%)
- Stoi w miejscu i losowo zmienia smutne animacje (a02: „26. Smutek — siad i westchnienie”, „27. Smutek — głowa w dół”, „28. Smutek — obrażony tyłem”), po 2 cykle każda.
- Nie biega sam po domu i nie robi kupki.
- Zgadza się tylko na to, czego mu brak: jedzenie / woda / sen; przy nudzie aport i gry; przy brudzie kąpiel i szczotkowanie. Na resztę (inne czynności, gry, głaskanie, dotknięcie) kręci głową „NIE” (a02 #20), ikonka w dymku mocniej pulsuje, a na dole pojawia się podpowiedź.
- Strzałkami i menu można go dalej prowadzić do innych pokoi.

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
- Piłkę trzeba **złapać palcem** (przy łapach pieska), pociągnąć i puścić. Leci z prędkością ostatnich ~0,1 s ruchu palca (×0,65, maks. 1150 px/s) po prawdziwym rzucie ukośnym: grawitacja, odbicia od ziemi, toczenie, odbicie od ściany na końcach świata (lewa krawędź Łąki, prawa łazienki; ściana „zjada” 70% prędkości).
- Wylot z ekranu: 8 stref — lewo/prawo × nisko/środek/wysoko oraz góra-lewo/góra-prawo. W pokoju lądowania piłka wpada dokładnie tak, jak wyleciała (ta sama wysokość i prędkość): z boku nisko — wtacza się, wyżej — wpada łukiem i odbija, z góry — spada z nieba.
- Słaby rzut / samo puszczenie: piłka spada w tym samym pokoju (też liczy się jako rzut).
- Piłka nie zatrzymuje się tuż przy granicy pokoju (margines 14%) ani dalej niż 2 pokoje (korekta samego końca toczenia).
- Stałe `BALL_*` w `js/minigame-fetch.js`.

## 5. Gry
- Dostęp: pozycja „Gry” w menu kołowym albo puchar w górnym pasku sceny → ekran z kafelkami gier.
- Łąka to zwykła plansza świata (kret, jeżyk, motylki jak w ogrodzie i na podwórku).
- **Pamięć motylków**: wzór 3 s (motylki od lewej do prawej) → po łące latają motylki w 5 kolorach (poziom 1: po 2 sztuki, 2–3: po 3), klikamy kolory z wzoru po kolei. 3 poziomy: ⭐ = 3, ⭐⭐ = 4, ⭐⭐⭐ = 5 motylków. 3 serduszka na pomyłki. Wygrana = puchar + konfetti, nagroda jak w grze z jeżykiem (`ACTION_EFFECTS.memory`). Ukończone poziomy oznaczone pucharem na kafelku (localStorage).
- **Znajdź pary** (memory): ⭐ 4×3 (6 par), ⭐⭐ 5×4 (10 par), ⭐⭐⭐ 6×5 (15 par). Bez kar i bez czasu; niepasujące karty same się zakrywają (albo od razu przy następnym dotknięciu). Pula 37 obrazków (ikony gry, owoce/słodycze, motylki, jeżyk); kolejna gra unika par z poprzedniej. Nagroda `ACTION_EFFECTS.pairs`.
