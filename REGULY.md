# Łatka — reguły gry (wersja wyjściowa, do strojenia)

Wszystkie liczby są w kodzie w jednym miejscu (`js/game.js`): `BUBBLE_RULES`,
`NEEDS_DECAY`, `ACTION_EFFECTS`, `CRITICAL_THRESHOLD`. Zmieniamy je tam.

## 1. Dymki nad głową pieska

Zasada: **domyślnie dymka nie ma**. Pojawia się tylko, gdy coś znaczy.

| # | Kiedy | Co pokazuje | Jak często |
|---|-------|-------------|------------|
| 1 | Leży kupka | kupka | co 20 s |
| 2 | Potrzeba ≤ 33% (najniższa z nich) | ikona potrzeby | co 25 s; przy ≤ 15% co 12 s |
| 3 | Piesek sam biegnie do pokoju, w którym czegoś pilnie potrzebuje | ikona potrzeby, cały czas w drodze | ciągle w czasie biegu |
| 4 | Wszystko w porządku — rzadka „chęć" | motylek (gdy da się go złapać), kret / kopiec (gdy jest w pokoju), piłka (gdy zabawa < 60%) | co 60–90 s, losowo jedna |

- Przy pełnych statusach i bez zdarzeń: zero dymków.
- Dymek pokazuje się tylko gdy piesek stoi (nie biega, nie śpi, nie jest głaskany) — wyjątek: pkt 3.
- Priorytet: kupka > pilna potrzeba > chęć. Jedno naraz.
- Serce / gwiazdka (głaskanie, sprzątanie) to reakcje na dotyk, nie podlegają tym regułom.

### Samodzielne wycieczki pieska
- W drodze piesek ma dymek z celem: ikona pokoju (albo pilnej potrzeby).
- Gdy na ekranie jest kret, jeżyk lub motylek do złapania, piesek nie rusza w drogę (sprawdza ponownie co 3 s), a w czasie biegu nowe zwierzęta się nie pojawiają.

## 2. Potrzeby — spadek w czasie (punktów na minutę)

jedzenie 0,65 · woda 1,0 · zabawa 0,8 · sen 0,55 · czystość 0,35.
Podczas snu wszystko spada o połowę, a sen rośnie o 12 pkt/min.
Poniżej 33% piesek sam idzie tam, gdzie go potrzeba, i blokuje inne aktywności (pierwszeństwo ma pilna potrzeba).

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

## 5. Gry
- Dostęp: pozycja „Gry” w menu kołowym albo puchar w górnym pasku sceny → ekran z kafelkami gier.
- Łąka to zwykła plansza świata (kret, jeżyk, motylki jak w ogrodzie i na podwórku).
- **Pamięć motylków**: wzór 3 s (motylki od lewej do prawej) → po łące latają motylki w 5 kolorach (poziom 1: po 1 sztuce, 2–3: po 2), klikamy kolory z wzoru po kolei. 3 poziomy: ⭐ = 3, ⭐⭐ = 4, ⭐⭐⭐ = 5 motylków. 3 serduszka na pomyłki. Wygrana = puchar + konfetti, nagroda jak w grze z jeżykiem (`ACTION_EFFECTS.memory`). Ukończone poziomy oznaczone pucharem na kafelku (localStorage).
