"use strict";
// Motylki w tle, kret i kopczyki, naczynia, jeżyk i owoce.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// ── Motylek-tło (ogród/podwórko/łąka) ────────────────────────────────────
// Niezależny od motylka do złapania (butterflySpawn/butterflyCatch powyżej) —
// (ten jest klikany — piesek podbiega i go łapie). Ten tutaj lata jeden naraz, w realnym
// rozmiarze (bez pomniejszania), wlatuje z boku/góry (nigdy nie
// "teleportuje się" na środek), chwilę pofruwa "jak pijany" (kierunek
// dryfuje przez dwie nałożone fale o różnych okresach, z miękkim
// zawracaniem od krawędzi obszaru lotu) i wylatuje tą samą drogą — chyba że
// gracz go spłoszy kliknięciem/dotknięciem: wtedy ucieka od razu, szybciej
// i chaotycznym zygzakiem (patrz ambientFlee()), zamiast spokojnego wylotu.
// Kolor wylosowany na starcie trzyma przez cały lot. Na razie spłoszenie to
// tylko wizualny placeholder — docelowo stąd ma startować osobna mini-gra
// (do zaprojektowania później).
const AMBIENT_MAX = 1,
    // Realny rozmiar — rysujemy klatkę 1:1 (kafelek arkusza motyle-new.png
    // to natywne 64×64). Duży i widoczny, bo to już nie tylko dekoracja w
    // tle, tylko coś do kliknięcia.
    AMBIENT_SIZE = 96,
    // Obszar trafienia trochę większy niż sama grafika — łatwiej trafić
    // palcem na telefonie.
    AMBIENT_HIT_PAD = 12,
    AMBIENT_MARGIN_X = 44,
    // Pas lotu: tuż NAD linią, po której leci motylek z eventu (y≈200, patrz
    // butterflyEvent()), wysoko nad głową pieska.
    AMBIENT_MARGIN_TOP = 104,
    // Pas lotu to wyłącznie górne tło (niebo/dach budy), nad pieskiem —
    // z grubsza wysokość strzałek nawigacji (top:44% z 550px scenki, tu
    // z małym zapasem), żeby nigdy nie wchodziły na psa.
    AMBIENT_ZONE_BOTTOM = 176,
    // Rozmiar motylka w całym evencie butterflyEvent() (lot + pogoń +
    // lądowanie na nosie) — ten sam, jakim dotychczas latał motylek w
    // fazach lotu (stary bsz=58.5), niezależny od AMBIENT_SIZE (to inna
    // skala kompozycji: blisko pyszczka/na scenie eventu, nie "duży akcent
    // w tle").
    EVENT_BUTTERFLY_SIZE = 96.5;

function ambientRandomParams() {
    return {
        heading: Math.random() * Math.PI * 2,
        speed: 34 + Math.random() * 26,
        freq1: 0.5 + Math.random() * 0.7,
        freq2: 1.4 + Math.random() * 1.1,
        amp1: 0.8 + Math.random() * 0.6,
        amp2: 0.35 + Math.random() * 0.4,
        seed1: Math.random() * Math.PI * 2,
        seed2: Math.random() * Math.PI * 2,
    };
}

// Losowy punkt poza kadrem (lewa/prawa/góra) dla danego punktu "wewnątrz" —
// używane niezależnie przy wlocie i przy wylocie, więc strona za każdym
// razem może wyjść inna.
function ambientEdgePoint(nearX, nearY) {
    const side = Math.floor(Math.random() * 3);
    return side === 0
        ? { x: -AMBIENT_SIZE, y: nearY } // z lewej
        : side === 1
          ? { x: W + AMBIENT_SIZE, y: nearY } // z prawej
          : {
                // Z góry — ale nie dokładnie znad celu: punkt startowy (albo
                // docelowy przy wylocie) jest przesunięty losowo w bok, żeby
                // odcinek nie był idealnie pionowy (wtedy nawet z wygięciem
                // prostopadłym z ambientSetupFlight() wyglądał jak sztywna
                // linia prosto w dół — sam ruch nie miał żadnego "na ukos").
                x: clamp(nearX + (Math.random() * 2 - 1) * 90, AMBIENT_MARGIN_X, W - AMBIENT_MARGIN_X),
                y: -AMBIENT_SIZE / 2,
            }; // z góry
}

// Przygotowuje odcinek lotu wlot/wylot (from -> to) tak, by nie był sztywną
// linią prostą: dokłada wygięcie PROSTOPADLE do kierunku odcinka (a nie np.
// zawsze "w pionie", co dla pionowego wlotu z góry w ogóle by nie było
// widoczne). Znika dokładnie w obu końcach (sin(0)=sin(kπ)=0), więc start i
// koniec zostają dokładnie w from/to, a sama krzywizna i strona wygięcia są
// losowe za każdym razem.
function ambientSetupFlight(b, state, from, to, speed, bounceCycles = 1) {
    b.state = state;
    b.phaseStart = clock;
    b.from = from;
    b.to = to;
    const dx = to.x - from.x,
        dy = to.y - from.y,
        len = Math.hypot(dx, dy) || 1;
    b.perpX = -dy / len;
    b.perpY = dx / len;
    b.bounceAmp = 10 + Math.random() * 10; // 10–20px wygięcia
    b.bounceSign = Math.random() < 0.5 ? 1 : -1;
    // Liczba "zygzaków" na całej trasie — 1 dla spokojnego wlotu/wylotu,
    // więcej dla spłoszonej, chaotycznej ucieczki (patrz ambientFlee()).
    b.bounceCycles = bounceCycles;
    b.phaseDuration = Math.max(400, (len / speed) * 1000);
}

// Gracz kliknął/dotknął motylka — płoszymy go: zamiast spokojnego wylotu
// rusza od razu w chaotyczną, szybką ucieczkę z kilkoma zygzakami,
// dowolną z trzech krawędzi (jak zwykły wylot, ale bez "wander" pomiędzy).
// Na razie to tylko wizualny placeholder — docelowo stąd ma startować
// osobna mini-gra (do zaprojektowania później).
function ambientFlee(b) {
    if (!b || b.state === "fleeing") return;
    const to = ambientEdgePoint(b.x, b.y),
        // Znacznie szybciej niż spokojny lot — spłoszony motylek.
        speed = (b.speed || 50) * 2.6;
    ambientSetupFlight(b, "fleeing", { x: b.x, y: b.y }, to, speed, 3 + Math.floor(Math.random() * 3));
}

function ambientSpawn() {
    wildlifeCooldown();
    const colorIndex = Math.floor(Math.random() * CFG.motyle.presets.length),
        // Punkt docelowy wlotu — gdzieś w środku pasa lotu.
        settleX = AMBIENT_MARGIN_X + Math.random() * (W - AMBIENT_MARGIN_X * 2),
        settleY = AMBIENT_MARGIN_TOP + Math.random() * (AMBIENT_ZONE_BOTTOM - AMBIENT_MARGIN_TOP),
        // Wlot z boku albo z góry — nigdy "znikąd" na środku ekranu.
        from = ambientEdgePoint(settleX, settleY),
        params = ambientRandomParams(),
        b = { colorIndex, x: from.x, y: from.y, spawnedAt: clock, leaveAt: Infinity, ...params };
    // Wlot leci z tą samą prędkością co późniejszy spokojny "wander"
    // (params.speed) — stały czas niezależny od odległości wyglądał
    // nienaturalnie szybko przy dłuższych dolotach (np. z góry).
    ambientSetupFlight(b, "entering", from, { x: settleX, y: settleY }, params.speed);
    ambient.push(b);
}

function ambientUpdate(dt) {
    // "meadow" (dawniej "attic") to wizualnie też ogród/łąka — motylki-tło
    // lecą i tam. Interaktywny butterflyEvent() (łapanie motylka) na razie
    // zostaje ograniczony tylko do garden/yard, osobno od tej listy.
    if (!images.motyle || !GARDEN_ROOMS.includes(room)) {
        if (ambient.length) ambient.length = 0;
        return;
    }
    if (ambient.length < AMBIENT_MAX && clock >= nextAmbientSpawn && !wildlifeBusy("ambient")) ambientSpawn();
    const dtS = dt / 1000;
    for (let i = ambient.length - 1; i >= 0; i--) {
        const b = ambient[i];
        if (b.state === "entering" || b.state === "leaving" || b.state === "fleeing") {
            const p = clamp((clock - b.phaseStart) / b.phaseDuration, 0, 1),
                // Wygięcie prostopadłe do odcinka from->to (działa tak samo
                // dla wlotu z boku jak i z góry) — znika dokładnie w obu
                // końcach, więc start/koniec zostają w from/to. Przy
                // spłoszeniu bounceCycles>1 daje kilka zygzaków zamiast
                // jednego łagodnego łuku.
                bounce = Math.sin(p * Math.PI * 2 * b.bounceCycles) * b.bounceAmp * b.bounceSign;
            b.x = b.from.x + (b.to.x - b.from.x) * p + b.perpX * bounce;
            b.y = b.from.y + (b.to.y - b.from.y) * p + b.perpY * bounce;
            if (p >= 1) {
                if (b.state === "entering") {
                    b.state = "wander";
                    b.heading = Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x);
                    // Czas, po jakim zacznie wylatywać, liczony dopiero od
                    // startu realnego "wander" (nie od wlotu, który trwa
                    // różnie długo zależnie od odległości).
                    b.leaveAt = clock + 5000 + Math.random() * 6000;
                } else {
                    ambient.splice(i, 1);
                    // Po spłoszeniu kolejny motylek wraca szybciej niż po
                    // zwykłym, przypadkowym odlocie — to była reakcja na
                    // interakcję gracza.
                    nextAmbientSpawn =
                        b.state === "fleeing"
                            ? clock + 7500 + Math.random() * 7500
                            : clock + 12500 + Math.random() * 17500;
                }
            }
            continue;
        }
        // state === "wander"
        if (clock >= b.leaveAt) {
            // Strona wylotu losowana od nowa — niezależnie od strony, z
            // której wleciał, i od tego, dokąd akurat dryfował. Ta sama
            // prędkość co "wander" (b.speed), żeby wylot nie przyspieszał
            // nienaturalnie.
            ambientSetupFlight(b, "leaving", { x: b.x, y: b.y }, ambientEdgePoint(b.x, b.y), b.speed);
            continue;
        }
        const t = (clock - b.spawnedAt) / 1000;
        // Bazowe "pijane" dryfowanie kierunku — suma dwóch fal.
        let turn = Math.sin(t * b.freq1 + b.seed1) * b.amp1 + Math.sin(t * b.freq2 + b.seed2) * b.amp2;
        // Miękkie zawracanie, gdy zbliża się do krawędzi obszaru lotu.
        const steerTo = (target) => {
            let d = ((target - b.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            return d * 2.4;
        };
        if (b.x < AMBIENT_MARGIN_X) turn += steerTo(0);
        else if (b.x > W - AMBIENT_MARGIN_X) turn += steerTo(Math.PI);
        if (b.y < AMBIENT_MARGIN_TOP) turn += steerTo(Math.PI / 2);
        else if (b.y > AMBIENT_ZONE_BOTTOM) turn += steerTo(-Math.PI / 2);
        b.heading += turn * dtS;
        b.x += Math.cos(b.heading) * b.speed * dtS;
        b.y += Math.sin(b.heading) * b.speed * dtS;
        // Zawracanie jest miękkie (stopniowe), więc samo w sobie może na
        // moment wyjść poza pas — twardy clamp jako siatka bezpieczeństwa,
        // żeby naprawdę nigdy nie zeszły niżej niż AMBIENT_ZONE_BOTTOM.
        b.x = clamp(b.x, AMBIENT_MARGIN_X - 8, W - AMBIENT_MARGIN_X + 8);
        b.y = clamp(b.y, AMBIENT_MARGIN_TOP - 8, AMBIENT_ZONE_BOTTOM);
    }
}

// Czy (px,py) trafia w widocznego, jeszcze niespłoszonego motylka-tło —
// używane przy tapnięciu/kliknięciu na scenę (patrz pointerdown/pointerEnd).
function ambientHit(px, py) {
    for (const b of ambient) {
        if (b.state === "fleeing") continue;
        if (Math.hypot(px - b.x, py - b.y) <= AMBIENT_SIZE / 2 + AMBIENT_HIT_PAD) return b;
    }
    return null;
}

function ambientDraw() {
    if (!images.motyle || !ambient.length) return;
    for (const b of ambient) {
        const preset = CFG.motyle.presets[b.colorIndex],
            // Zwykły lot trzepocze 2x szybciej niż bazowa wartość z presetu;
            // spłoszony (ucieczka) — 3x szybciej, dla jeszcze większego
            // wrażenia paniki, obok samego zygzakowatego toru lotu.
            ms = b.state === "fleeing" ? preset.ms / 3 : preset.ms / 2,
            seqFrames = numbers(preset.seq),
            fi = Math.floor((clock - b.spawnedAt) / ms) % seqFrames.length,
            frameNum = seqFrames[fi],
            cell = cells.motyle[frameNum - 1];
        if (!cell) continue;
        const dx = b.state === "wander" ? Math.cos(b.heading) : b.to.x - b.from.x;
        ctx.save();
        ctx.translate(b.x, b.y);
        if (dx < 0) ctx.scale(-1, 1);
        ctx.drawImage(cell, -AMBIENT_SIZE / 2, -AMBIENT_SIZE / 2, AMBIENT_SIZE, AMBIENT_SIZE);
        ctx.restore();
    }
}

/* ═══════════════════════════════════════════════════════════════
   KRET W OGRODZIE — zapowiedź (ambient teaser)
   Jeden kopiec na raz, w dolnym pasie sceny (ziemia/trawa, NIE pas
   lotu motylków). Wychodzi z ziemi, czujnie się rozgląda, a potem
   sam się chowa — albo chowa się OD RAZU po kliknięciu. W pokoju
   "meadow" (Łąka) kliknięcie DODATKOWO uruchamia pełną mini-grę
   (patrz moleStart() w js/minigame-mole.js); w pozostałych pokojach
   ogrodu (garden/yard) samo się chowa, bez startu gry.
   ═══════════════════════════════════════════════════════════════ */
const MOLE_TEASER_SIZE = 126, // o 50% większy niż bazowe 84
    MOLE_TEASER_HIT_PAD = 18, // trochę większy obszar trafienia — łatwiej dla małego dziecka
    // Trzy stałe "miejsca" w ziemi, zdecydowanie niżej niż łapy psa
    // (GROUND=425) — kopiec zawsze wychodzi w jednym z nich (nigdy gdzie
    // indziej), mniej więcej tam, gdzie wskazują trzy obszary z referencji.
    // Y podniesione względem samej referencji, żeby przy większym kreciku
    // (MOLE_TEASER_SIZE) dół kopca nie nachodził na powiększoną, zaznaczoną
    // ikonę w doku (ikony wystają nad kartę doku aż do y≈526 w canvasie,
    // sprawdzone przez getBoundingClientRect ikon .menu button).
    MOLE_TEASER_SPOTS = [
        { x: 76, y: 448 }, // lewo
        { x: 196, y: 452 }, // środek — odrobinę niżej, bliżej pieska
        { x: 300, y: 444 }, // prawo
    ],
    MOLE_TEASER_Y = [442, 456], // zakres wysokości (y) wyjścia kreta
    MOLE_TEASER_FRAME_MS = 110, // tempo klatki przy wyłanianiu/chowaniu zapowiedzi
    MOLE_TEASER_HOLD = 1800; // jak długo stoi w pełni na wierzchu, zanim sam się schowa

function moleTeaserDuration(presetIdx) {
    return numbers(CFG.kret.presets[presetIdx].seq).length * MOLE_TEASER_FRAME_MS;
}

const MEADOW_MOLE = { x: 84, y: 450, standMs: 3200, hiddenMs: 1400 }; // stały kret na Łące (lewa strona)
let moleLastX = -999;
function moleTeaserSpawn() {
    wildlifeCooldown();
    // Miejsce losowe na CAŁEJ szerokości (z marginesem na połowę rozmiaru
    // kreta) i w lekko zmiennej wysokości — nie z trzech stałych punktów.
    // Nowy kopiec nie ląduje tuż obok poprzedniego w tym samym miejscu.
    const half = MOLE_TEASER_SIZE / 2 + 4;
    let sx = 0;
    for (let i = 0; i < 6; i++) {
        sx = half + Math.random() * (W - 2 * half);
        if (Math.abs(sx - moleLastX) > 60) break;
    }
    moleLastX = sx;
    moleTeaser = {
        x: sx,
        y: MOLE_TEASER_Y[0] + Math.random() * (MOLE_TEASER_Y[1] - MOLE_TEASER_Y[0]),
        state: "emerging",
        stateStart: clock,
    };
}

function moleTeaserUpdate() {
    // Kret może wychodzić na KAŻDEJ mapce (nie tylko w ogrodzie/na łące) —
    // jedyne co go blokuje to brak grafiki albo trwająca pełna mini-gra.
    if (!cells.kret.length || !GARDEN_ROOMS.includes(room) || phase === "mole-game" || phase.startsWith("hedge") || phase.startsWith("mole2") || phase.startsWith("memo") || phase.startsWith("pairs") || phase.startsWith("bones")) {
        if (moleTeaser) moleTeaser = null;
        return;
    }
    if (!moleTeaser) {
        // Dopóki leży piach po poprzednim krecie, nowy się nie pojawia —
        // najpierw trzeba go posprzątać (patrz cleanMoleDirt()).
        if (!moleDirts[room] && clock >= nextMoleSpawn && !wildlifeBusy("mole") && !(phase === "travel" && travelMode === "auto")) moleTeaserSpawn();
        return;
    }
    const m = moleTeaser;
    if (m.permanent) {
        // Stały kret na Łące: wychodzi, STOI spokojnie (jedna klatka, bez
        // "telepania"), chowa się, chwila przerwy i od nowa — jak na karcie
        // końcowej. Klikalny w każdej fazie (kopiec jest zawsze widoczny).
        const el = clock - m.stateStart,
            next = { emerging: ["stand", moleTeaserDuration(1)], stand: ["retreating", MEADOW_MOLE.standMs], retreating: ["hidden", moleTeaserDuration(3)], hidden: ["emerging", MEADOW_MOLE.hiddenMs] }[m.state];
        if (next && el >= next[1]) {
            m.state = next[0];
            m.stateStart = clock;
        }
        return;
    }
    if (m.state === "emerging") {
        if (clock - m.stateStart >= moleTeaserDuration(1)) {
            m.state = "alert";
            m.stateStart = clock;
        }
    } else if (m.state === "alert") {
        if (!m.permanent && clock - m.stateStart >= MOLE_TEASER_HOLD) {
            m.state = "retreating";
            m.stateStart = clock;
        }
    } else if (m.state === "retreating") {
        // Podmieniamy zapowiedź na piach dokładnie w momencie, gdy animacja
        // chowania ("9,6,3,2,1") i tak pokazuje klatkę nr 3 — tę samą, której
        // używa moleDirtDraw(). Bez tego kopiec najpierw kurczyłby się aż do
        // maleńkiej klatki 1, a potem nagle "skakał" do dużego piachu; tak
        // podmiana jest niewidoczna, bo to ta sama grafika w tym samym
        // miejscu i rozmiarze — po prostu zamraża animację na tej klatce.
        // Gdy trwa popup startowy pełnej gry (faza "mole-intro"), wstrzymujemy
        // tę zamianę — jeśli gracz kliknie "Zaczynamy!", kret został
        // "złapany" do gry, a nie po prostu uciekł, więc piach w ogóle nie
        // powinien zostać (patrz górny warunek wyżej, zerujący moleTeaser
        // przy phase==="mole-game").
        if (phase !== "mole-intro" && clock - m.stateStart >= 2 * MOLE_TEASER_FRAME_MS) {
            moleDirts[room] = { x: m.x / W, y: m.y };
            updateMoleDirtAccess();
            save();
            moleTeaser = null;
        }
    }
}

// Trafienie w zapowiedź kreta — tak jak ambientHit() dla motylków-tła, ale
// to zawsze jeden, konkretny obiekt (bez tablicy). Pomijamy "retreating" —
// kret już się chowa, za późno.
function moleTeaserHit(px, py) {
    if (!moleTeaser || (moleTeaser.state === "retreating" && !moleTeaser.permanent)) return null;
    const r = MOLE_TEASER_SIZE / 2 + MOLE_TEASER_HIT_PAD;
    return Math.hypot(px - moleTeaser.x, py - moleTeaser.y) <= r ? moleTeaser : null;
}

// Kliknięcie zapowiedzi — zawsze chowa kreta (animacją cofania klatek, nie
// znika od razu — patrz state="retreating" niżej, dokańcza ją
// moleTeaserUpdate()); na Łące dodatkowo startuje pełną mini-grę
// (moleTryStart() z js/minigame-mole.js).
function moleTeaserTap(m) {
    if (m.permanent) {
        moleTryStart(); // stały kret na Łące — zostaje na miejscu
        return;
    }
    if (m.state !== "retreating") {
        m.state = "retreating";
        m.stateStart = clock;
    }
}

function moleTeaserFrame() {
    const m = moleTeaser;
    if (!m) return null;
    if (m.state === "stand") {
        const f = numbers(CFG.kret.presets[1].seq);
        return f[f.length - 1]; // ostatnia klatka wyjścia — kret stoi nieruchomo
    }
    if (m.state === "hidden") return numbers(CFG.kret.presets[0].seq)[0]; // sam kopiec
    if (m.state === "alert") {
        const frames = numbers(CFG.kret.presets[2].seq),
            fi = Math.floor((clock - m.stateStart) / 160) % frames.length;
        return frames[fi];
    }
    const presetIdx = m.state === "emerging" ? 1 : 3,
        frames = numbers(CFG.kret.presets[presetIdx].seq),
        dur = moleTeaserDuration(presetIdx),
        p = clamp((clock - m.stateStart) / dur, 0, 0.999),
        fi = Math.floor(p * frames.length);
    return frames[fi];
}

function moleTeaserDraw() {
    if (!moleTeaser || !cells.kret.length) return;
    const fn = moleTeaserFrame(),
        cell = fn ? cells.kret[fn - 1] : null;
    if (!cell) return;
    ctx.drawImage(cell, moleTeaser.x - MOLE_TEASER_SIZE / 2, moleTeaser.y - MOLE_TEASER_SIZE / 2, MOLE_TEASER_SIZE, MOLE_TEASER_SIZE);
}

// Piach po krecie — ten sam mechanizm co kupka (patrz poopRect()/poopHit()/
// cleanPoop() wyżej): leży w świecie gry, trzeba go kliknąć, żeby zniknął.
// Trzyma pozycję względem swojego pokoju (jak kupka), więc widać go też z
// sąsiedniego pokoju podczas przesuwania planszy.
function moleDirtRect(dirtRoom = room) {
    const d = moleDirts[dirtRoom],
        w = MOLE_TEASER_SIZE,
        h = MOLE_TEASER_SIZE,
        offset = (order.indexOf(dirtRoom) - order.indexOf(room)) * W + roomOffset;
    return {
        x: clamp((d?.x || 0.5) * W, 22, W - 22) - w / 2 + offset,
        y: (d?.y || MOLE_TEASER_SPOTS[0].y) - h / 2,
        w,
        h,
    };
}

function moleDirtHit(px, py) {
    if (!moleDirts[room]) return false;
    const r = moleDirtRect();
    return px > r.x - 10 && px < r.x + r.w + 10 && py > r.y - 10 && py < r.y + r.h + 10;
}

function updateMoleDirtAccess() {
    const btn = $(".moleDirtAccess");
    if (btn) btn.hidden = !moleDirts[room];
    updateDishAccess();
    updatePawsUi();
}

function cleanMoleDirt() {
    if (!casual() || !moleDirts[room]) return;
    const mr = moleDirtRect();
    sparkleBurst(mr.x + mr.w / 2, mr.y + mr.h / 2);
    delete moleDirts[room];
    changeNeeds(ACTION_EFFECTS.moleDirt);
    updateMoleDirtAccess();
    say("heart", 1600);
    // Dopiero teraz zaczyna się odliczanie do kolejnego kreta.
    nextMoleSpawn = clock + 6000 + Math.random() * 9000;
    save();
}
$(".moleDirtAccess").onclick = cleanMoleDirt;

// Stłuczone naczynie — leży w świecie jak kupka; dotyk (lub ukryty przycisk
// dostępności) sprząta. Rysowane tylko, gdy piłka już dotknęła ziemi (shown).
let dishBubbleIdx = 0; // wygląd skorup w dymku (ustawia aport)
const DISH_SIZE = 109; // 84 × 1,3
function dishRect(dRoom = dishMess?.room) {
    const offset = (order.indexOf(dRoom) - order.indexOf(room)) * W + roomOffset,
        w = DISH_SIZE;
    return { x: clamp(dishMess?.x ?? 0.5, 0.08, 0.92) * W - w / 2 + offset, y: GROUND + 36 - w, w, h: w }; // podstawa 26 px poniżej linii piłki/pieska
}
function dishHit(px, py) {
    if (!dishMess?.shown || dishMess.room !== room) return false;
    const r = dishRect();
    return px > r.x - 10 && px < r.x + r.w + 10 && py > r.y - 10 && py < r.y + r.h + 10;
}
function updateDishAccess() {
    const btn = $(".dishAccess");
    if (btn) btn.hidden = !(dishMess?.shown && dishMess.room === room);
}
function cleanDish() {
    const waiting = stage === "dish-sad"; // piesek siedzi smutny i czeka na sprzątanie
    if (!(casual() || waiting) || !dishMess?.shown || dishMess.room !== room) return;
    const dr = dishRect();
    sparkleBurst(dr.x + dr.w / 2, dr.y + dr.h / 2);
    dishMess = null;
    updateMoleDirtAccess();
    sfx("wipe");
    say("heart", waiting ? 3200 : 1600);
    changeNeeds({ clean: 2 });
    save();
    if (waiting) dishResume(); // piesek wstaje, łapie piłkę i wraca
}
$(".dishAccess").onclick = cleanDish;
function dishDraw() {
    const im = images.dish;
    if (!im || !dishMess?.shown || Math.abs(order.indexOf(dishMess.room) - order.indexOf(room)) > 1) return;
    const r = dishRect();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, dishMess.idx * 40, 0, 40, 40, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true;
}

function moleDirtDraw() {
    if (!cells.kret.length) return;
    const cell = cells.kret[2]; // klatka nr 3 (3. od lewej w 1. rzędzie arkusza) — piach po krecie
    if (!cell) return;
    for (const r of Object.keys(moleDirts)) {
        if (Math.abs(order.indexOf(r) - order.indexOf(room)) > 1) continue;
        const rc = moleDirtRect(r);
        ctx.drawImage(cell, rc.x, rc.y, rc.w, rc.h);
    }
}

// Zwraca aktualną klatkę (canvas) wybranego koloru motylka z motyle-new.png
// dla danego "zegara" trzepotu — wspólne dla całego butterflyEvent() (lot +
// pogoń + lądowanie na nosie), żeby trzepot był ciągły i spójny przez cały
// event, niezależnie od tego, która faza akurat go rysuje.
function eventButterflyCell() {
    const preset = CFG.motyle.presets[catchButterflyColor],
        // To samo tempo co zwykły lot motylków-tło (2x szybciej niż baza).
        ms = butterfly?.lure && !butterfly.lure.done ? preset.ms / 3 : preset.ms / 2, // spłoszony trzepocze szybciej
        seqFrames = numbers(preset.seq),
        fi = Math.floor((clock - catchButterflyStart) / ms) % seqFrames.length,
        frameNum = seqFrames[fi];
    return cells.motyle[frameNum - 1];
}

// Motylek "przyklejony" do pieska podczas pogoni/łapania (stage
// butterfly-chase / butterfly-nose w butterflyEvent()) — pozycja i aktualna
// klatka a02 same decydują, czy i gdzie go narysować (patrz catchMarkerPos()
// / catchMarker, wypełniane w boot() przez extractMarker()). Jeśli klatka
// nie ma znacznika (np. przejściowa poza nim), nic się nie rysuje — bez
// tego "skakania" nakładki.
function catchOverlayDraw() {
    if ((stage !== "butterfly-chase" && stage !== "butterfly-nose") || !images.motyle) return;
    const pos = catchMarkerPos();
    if (!pos) return;
    catchLastSpot = pos;
    const cell = eventButterflyCell();
    if (!cell) return;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (left) ctx.scale(-1, 1);
    ctx.drawImage(cell, -EVENT_BUTTERFLY_SIZE / 2, -EVENT_BUTTERFLY_SIZE / 2, EVENT_BUTTERFLY_SIZE, EVENT_BUTTERFLY_SIZE);
    ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   JEŻYK — spacerowicz w tle (za pieskiem)
   Od czasu do czasu wchodzi, wolno się przechadza po stałej "linii spaceru"
   (HEDGEHOG_LINE_Y, wyżej niż łapy pieska), co jakiś czas przystaje.
   Czasem niesie na kolcach coś dobrego (owoc z hedgehog-game.webp, dolny
   rząd — słodycze z górnego rzędu są "złe", więc nigdy ich nie niesie).
   Działa w czasie rzeczywistym tylko na mapach plenerowych (GARDEN_ROOMS), niezależnie od pieska;
   nie jest klikalny. Presety: data/animations/hedgehog-animacje.json.
   ═══════════════════════════════════════════════════════════════ */
const HEDGEHOG_LINE_Y = 488, // y stóp jeżyka — pierwszy plan, przed pieskiem
    HEDGEHOG_SIZE = 140, // jak w grze z jeżykiem
    HEDGEHOG_SCALE = HEDGEHOG_SIZE / 64, // względem oryginalnych 64 px
    HEDGEHOG_FEET = 55 / 64, // dół sprite'a w komórce (ułamek wysokości)
    HEDGEHOG_SPEED = 20 * (140 / 64), // px/s (tempo kroków jak dawniej, po skali)
    HEDGEHOG_FLEE_SPEED = 330, // ucieczka po kliknięciu
    HEDGEHOG_MIN_X = 70,
    HEDGEHOG_MAX_X = W - 70,
    HEDGEHOG_FRUIT_SIZE = 70,
    HEDGEHOG_FRUIT_CHANCE = 0.65,
    HEDGEHOG_FRUIT_LIFE = 20000; // ile leży zgubiony owoc
let hedgehog = null,
    hedgeFruit = null, // zgubiony owoc: { x, y, idx, born }
    nextHedgehogSpawn = 0;

function hedgehogHit(px, py) {
    const h = hedgehog;
    if (!h || h.state === "fleeing") return null;
    const top = HEDGEHOG_LINE_Y - HEDGEHOG_SIZE * HEDGEHOG_FEET;
    return Math.abs(px - h.x) <= HEDGEHOG_SIZE * 0.5 && py >= top - 28 && py <= HEDGEHOG_LINE_Y + 18 ? h : null;
}

// Kliknięty jeżyk gubi owoc i najkrótszą drogą ucieka za ekran.
function hedgehogScare(h) {
    if (h.fruit >= 0) {
        hedgeFruit = { x: h.x - h.dir * 10, y: HEDGEHOG_LINE_Y - 6, idx: h.fruit, born: clock };
        h.fruit = -1;
    }
    sfx("scare");
    h.state = "fleeing";
    h.dir = h.x < W / 2 ? -1 : 1;
    h.pauseUntil = 0;
    h.walkStart = clock;
}

function hedgeFruitHit(px, py) {
    const f = hedgeFruit;
    return f && Math.hypot(px - f.x, py - (f.y - HEDGEHOG_FRUIT_SIZE * 0.4)) <= HEDGEHOG_FRUIT_SIZE * 0.75 ? f : null;
}

function hedgeFruitCollect(f) {
    hedgeFruit = null;
    sfx("good");
    // lekki "pyk" w miejscu owocu — na razie bez nagrody w statusach
    fruitPops.push({ x: f.x, y: f.y - 40, born: clock });
}
const fruitPops = [];

function hedgehogPickTarget(h) {
    // Cel w głębi planszy, dość daleko od obecnej pozycji — żeby nie dreptał w miejscu.
    do h.target = HEDGEHOG_MIN_X + Math.random() * (HEDGEHOG_MAX_X - HEDGEHOG_MIN_X);
    while (Math.abs(h.target - h.x) < 80);
    h.dir = h.target >= h.x ? 1 : -1;
}

function hedgehogRollFruit() {
    return Math.random() < HEDGEHOG_FRUIT_CHANCE ? 4 + Math.floor(Math.random() * 4) : -1;
}

// Jak motylki-tło i kret: pojawia się "od czasu do czasu" — wchodzi zza
// krawędzi, przechadza się (1–2 odcinki z postojami), wychodzi za krawędź,
// a kolejny wejdzie dopiero po przerwie. setRoom() zeruje go tak samo jak
// motylki/krecika (świeży odliczany czas w każdym pokoju).
function hedgehogUpdate(dt) {
    if (hedgeFruit && clock - hedgeFruit.born > HEDGEHOG_FRUIT_LIFE) hedgeFruit = null;
    if (!GARDEN_ROOMS.includes(room)) hedgeFruit = null;
    if (!cells.hedgehog.length || !GARDEN_ROOMS.includes(room) || phase === "mole-game" || phase.startsWith("hedge") || phase.startsWith("mole2") || phase.startsWith("memo") || phase.startsWith("pairs") || phase.startsWith("bones")) {
        hedgehog = null;
        return;
    }
    if (!hedgehog) {
        if (clock < nextHedgehogSpawn || wildlifeBusy("hedgehog") || (phase === "travel" && travelMode === "auto")) return;
        const side = Math.random() < 0.5 ? -1 : 1, // -1: z lewej, 1: z prawej
            h = { x: side < 0 ? -HEDGEHOG_SIZE : W + HEDGEHOG_SIZE, dir: -side, target: 0, state: "entering", legs: 1 + Math.floor(Math.random() * 2), pauseUntil: 0, fruit: hedgehogRollFruit(), walkStart: clock };
        // Pierwszy cel w głębi planszy, po stronie przeciwnej do wejścia.
        h.target = side < 0 ? HEDGEHOG_MIN_X + Math.random() * 120 : W - HEDGEHOG_MIN_X - Math.random() * 120;
        hedgehog = h;
        wildlifeCooldown();
        return;
    }
    const h = hedgehog;
    if (clock < h.pauseUntil) return;
    h.x += h.dir * (h.state === "fleeing" ? HEDGEHOG_FLEE_SPEED : HEDGEHOG_SPEED) * (dt / 1000);
    if (h.state === "leaving" || h.state === "fleeing") {
        if (h.x < -HEDGEHOG_SIZE || h.x > W + HEDGEHOG_SIZE) {
            hedgehog = null;
            nextHedgehogSpawn = clock + 8000 + Math.random() * 10000;
        }
        return;
    }
    if ((h.dir > 0 && h.x >= h.target) || (h.dir < 0 && h.x <= h.target)) {
        // Dotarł — postój; potem kolejny odcinek albo wyjście za krawędź.
        h.state = "walking";
        h.pauseUntil = clock + 1500 + Math.random() * 3000;
        h.walkStart = h.pauseUntil;
        h.fruit = hedgehogRollFruit();
        if (--h.legs > 0) hedgehogPickTarget(h);
        else {
            h.state = "leaving";
            h.dir = Math.random() < 0.5 ? -1 : 1;
            h.target = h.dir < 0 ? -HEDGEHOG_SIZE * 2 : W + HEDGEHOG_SIZE * 2;
        }
    }
}

function hedgehogDraw() {
    const h = hedgehog;
    if (!h || !cells.hedgehog.length || !GARDEN_ROOMS.includes(room)) return;
    const walking = clock >= h.pauseUntil,
        frames = numbers(CFG.hedgehog.presets[walking ? 0 : 1].seq),
        ms = CFG.hedgehog.presets[walking ? 0 : 1].ms / (h.state === "fleeing" ? 2.5 : 1),
        fi = walking ? Math.floor((clock - h.walkStart) / ms) % frames.length : 0,
        cell = cells.hedgehog[frames[fi] - 1];
    if (!cell) return;
    const top = HEDGEHOG_LINE_Y - HEDGEHOG_SIZE * HEDGEHOG_FEET;
    ctx.save();
    ctx.translate(h.x, 0);
    if (h.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(cell, -HEDGEHOG_SIZE / 2, top, HEDGEHOG_SIZE, HEDGEHOG_SIZE);
    if (h.fruit >= 0 && cells.hedgehogGame[h.fruit]) {
        // Owoc na grzbiecie (środek kolców ~ lekko za środkiem sprite'a),
        // delikatnie podskakuje w rytm kroków.
        const bob = walking ? Math.abs(Math.sin(((clock - h.walkStart) / (h.state === "fleeing" ? 40 : 95)) * 0.52)) * 2 : 0;
        ctx.drawImage(cells.hedgehogGame[h.fruit], -HEDGEHOG_FRUIT_SIZE / 2 - 4 * HEDGEHOG_SCALE, top + 9 * HEDGEHOG_SCALE - HEDGEHOG_FRUIT_SIZE * 0.45 - bob * HEDGEHOG_SCALE, HEDGEHOG_FRUIT_SIZE, HEDGEHOG_FRUIT_SIZE);
    }
    ctx.restore();
}

function hedgeFruitDraw() {
    const f = hedgeFruit;
    if (f && cells.hedgehogGame[f.idx]) {
        const t = clamp((clock - f.born) / 420, 0, 1),
            // spada z grzbietu i odbija się raz
            drop = t < 1 ? (1 - t) * HEDGEHOG_FRUIT_SIZE * 0.9 + Math.abs(Math.sin(t * Math.PI * 2)) * -8 * (1 - t) : 0,
            fade = clamp((HEDGEHOG_FRUIT_LIFE - (clock - f.born)) / 2500, 0, 1);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.drawImage(cells.hedgehogGame[f.idx], f.x - HEDGEHOG_FRUIT_SIZE / 2, f.y - HEDGEHOG_FRUIT_SIZE * 0.8 - drop, HEDGEHOG_FRUIT_SIZE, HEDGEHOG_FRUIT_SIZE);
        ctx.restore();
    }
    for (let i = fruitPops.length - 1; i >= 0; i--) {
        const e = fruitPops[i],
            t = clamp((clock - e.born) / 550, 0, 1);
        if (t >= 1) {
            fruitPops.splice(i, 1);
            continue;
        }
        const im = images.bubbleStar;
        if (!im) continue;
        const ease = 1 - Math.pow(1 - t, 3),
            size = 70 * (0.55 + ease * 0.7);
        ctx.save();
        ctx.globalAlpha = 1 - t * t;
        ctx.drawImage(im, e.x - size / 2, e.y - ease * 40 - size / 2, size, size);
        ctx.restore();
    }
}

// Skorupy w dymku: wycięte do widocznej części (arkusz ma 4 komórki 40×40)
const dishCrops = {};
function dishCrop(idx) {
    if (dishCrops[idx]) return dishCrops[idx];
    const im = images.dish;
    if (!im) return null;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 40;
    const c2 = cv.getContext("2d");
    c2.drawImage(im, idx * 40, 0, 40, 40, 0, 0, 40, 40);
    const b = alphaBox(cv, 0, 0, 40, 40);
    if (!b) return null;
    const out = document.createElement("canvas");
    out.width = b.x1 - b.x0;
    out.height = b.y1 - b.y0;
    out.getContext("2d").drawImage(cv, b.x0, b.y0, out.width, out.height, 0, 0, out.width, out.height);
    return (dishCrops[idx] = out);
}
function iconDraw(c, key, x, y, w, h = w) {
    if (key === "dish") {
        const cr = dishCrop(dishBubbleIdx);
        if (!cr) return;
        const ratio = cr.width / cr.height;
        let iw = w,
            ih = w / ratio;
        if (ih > h) {
            ih = h;
            iw = h * ratio;
        }
        c.imageSmoothingEnabled = false;
        c.drawImage(cr, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
        c.imageSmoothingEnabled = true;
        return;
    }
    if (key === "poop") {
        const ratio = images.poop.width / images.poop.height;
        let iw = w,
            ih = w / ratio;
        if (ih > h) {
            ih = h;
            iw = h * ratio;
        }
        c.drawImage(images.poop, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
        return;
    }
    const n = UI.map[key];
    if (n && cells.ui[n - 1]) c.drawImage(cells.ui[n - 1], x, y, w, h);
}
