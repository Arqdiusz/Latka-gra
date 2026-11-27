"use strict";
// Samodzielne wędrówki pieska, harmonogram zdarzeń w tle, motylek do złapania.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

function chooseDestination() {
    const a = order.filter((r) => r !== room),
        weights = a.map((r) => (r === "garden" ? 5 : r === "yard" ? 2 : 1));
    let n = Math.random() * weights.reduce((s, v) => s + v, 0);
    for (let i = 0; i < a.length; i++) {
        n -= weights[i];
        if (n <= 0) return a[i];
    }
    return a[0];
}

// Coś dzieje się w świecie (kret, jeżyk, motylek do złapania) — piesek wtedy
// stoi spokojnie, żeby dało się to kliknąć, i nie wybiega sam w drogę.
function worldBusy() {
    return !!(moleTeaser || hedgehog || butterfly || (typeof boneMole !== "undefined" && boneMole) || (typeof boneDig !== "undefined" && boneDig));
}

// Zdarzenie (motylek do złapania, kopiec z kostką) da się kliknąć też wtedy,
// gdy piesek akurat sam gdzieś biegnie — kliknięcie przerywa jego wycieczkę.
function eventTapOk() {
    return casual() || (phase === "travel" && travelMode === "auto" && !sleeping);
}
function stopAutoTrip() {
    if (phase === "travel" && travelMode === "auto") idle(16);
    return false; // dalej w łańcuchu || wykonuje właściwą akcję
}

function autoTrip(target = chooseDestination()) {
    if (!casual() || sleeping || gesture || menu.drag) return false;
    if (worldBusy()) {
        nextTrip = clock + 3000;
        return false;
    }
    if (sadNeed()) return false; // smutny piesek nigdzie sam nie idzie
    trips++;
    route(target, null, "auto");
    return true;
}

function localWalk() {
    if (!casual()) return;
    interrupt();
    phase = "roam";
    const dest = x <= 0.5 ? 0.58 : 0.42,
        dist = Math.abs(dest - x) * W;
    if (dist < 2) {
        idle();
        return;
    }
    locks();
    startQueue([
        {
            sheet: "a01",
            anim: 6,
            motion: "walk",
            to: dest,
            time: (dist / 60) * 1000,
        },
    ]);
}

function autonomous() {
    const r = Math.random();
    if (r < 0.05 && bark("hau", Math.random() < 0.5 ? 2 : 1)) return; // czasem szczeknie sam z siebie
    if (r < 0.55) localWalk();
    else if (r < 0.72) {
        phase = "pause";
        locks();
        startQueue([
            {
                sheet,
                frames: [currentFrame()],
                tempo: 1000,
                time: 1000 + Math.random() * 900,
            },
        ]);
    } else if (r < 0.86) {
        phase = "look";
        locks();
        startQueue([repeatPart("a01", Math.random() < 0.5 ? 3 : 7)]);
    } else idle();
}

/* ═══════════════════════════════════════════════════════════════
   MOTYLEK DO ZŁAPANIA ("Chwytanie motylka")
   Co jakiś czas (garden/yard): piesek odchodzi pod bliższą ścianę i odwraca
   się, a z drugiej strony nadlatuje motylek po linii y≈BUTTERFLY_LINE_Y.
   Pulsująca ramka = można kliknąć (tylko gdy pościg jest wykonalny —
   butterflyPlan). Po kliknięciu motylek zawraca i ucieka tam, skąd
   przyleciał, a piesek biegnie za nim i łapie go w skoku (butterflyCatch).
   Nieklikniętego motylka ramka gaśnie, a on przelatuje nad pieskiem i znika.
   ═══════════════════════════════════════════════════════════════ */
const BUTTERFLY_LINE_Y = 200,
    BUTTERFLY_CROSS_MS = 9000, // przelot przez cały ekran (od strony przeciwnej do pieska)
    BUTTERFLY_HIT_R = 58;

// Zwierzaki ogrodowe (motylek do złapania, motylek-tło, kret, jeżyk): na
// scenie jest NAJWYŻEJ JEDEN naraz — wiele równoczesnych animacji przytłacza.
// Nowy zwierzak startuje dopiero, gdy poprzedni zniknie (wildlifeBusy), a po
// każdym starcie pozostałe dostają jeszcze krótki "oddech".
const WILDLIFE_STAGGER_MS = 3000;
let wlWasBusy = false,
    wlPick = "",
    wlFreeAt = 0;
function wildlifeBusy(who) {
    // motylek do złapania i motylek-tło (5 kolorów to tylko losowy kolor) to jedna "grupa"
    if (who === "butterfly" || who === "ambient") who = "butterflies";
    // zgubiony przez jeżyka owoc też "zajmuje scenę" — póki leży, nikt nowy nie wychodzi (np. kret na owoc)
    if (moleTeaser || hedgehog || hedgeFruit || butterfly || ambient.length || (typeof boneMole !== "undefined" && boneMole) || (typeof boneDig !== "undefined" && boneDig)) {
        wlWasBusy = true;
        return true;
    }
    // Scena właśnie się zwolniła: przez 5 s pierwszeństwo ma losowo wybrany
    // zwierzak — inaczej zawsze wygrywałby ten sprawdzany w pętli jako pierwszy.
    if (wlWasBusy) {
        wlWasBusy = false;
        wlPick = ["mole", "boneMole", "boneDig", "hedgehog", "butterflies"][Math.floor(Math.random() * 5)];
        wlFreeAt = clock;
    }
    return !!wlPick && who !== wlPick && clock - wlFreeAt < 5000;
}
function wildlifeCooldown() {
    const t = clock + WILDLIFE_STAGGER_MS + Math.random() * 1000;
    nextAmbientSpawn = Math.max(nextAmbientSpawn, t);
    nextMoleSpawn = Math.max(nextMoleSpawn, t);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, t);
    nextButterfly = Math.max(nextButterfly, t);
    if (typeof nextBoneMole !== "undefined") nextBoneMole = Math.max(nextBoneMole, t);
    if (typeof nextBoneDig !== "undefined") nextBoneDig = Math.max(nextBoneDig, t);
}

// Start: piesek najpierw spokojnie odchodzi pod bliższą ścianę (jak przy krecie
// z kostką), odwraca się — a z drugiej strony nadlatuje motylek. Do tego czasu
// motylek „czeka” (pending, niewidoczny), a scena jest zajęta.
const BUTTERFLY_DOG_EDGE = 0.28;
function butterflySpawn() {
    if (butterfly || phase === "butterfly") return false;
    wildlifeCooldown();
    catchButterflyColor = Math.floor(Math.random() * CFG.motyle.presets.length);
    catchButterflyStart = clock;
    const toLeft = x < 0.5,
        ex = toLeft ? BUTTERFLY_DOG_EDGE : 1 - BUTTERFLY_DOG_EDGE,
        dist = Math.abs(ex - x) * W;
    butterfly = { visible: false, free: true, pending: true, start: clock, x: -100, y: BUTTERFLY_LINE_Y, dir: toLeft ? -1 : 1, p: 0 };
    if (dist < 4 || !casual()) return butterflyEmerge(), true;
    interrupt();
    phase = "roam";
    locks();
    startQueue([{ sheet: "a01", anim: 6, motion: "walk", to: ex, time: (dist / 60) * 1000, onEnd: () => butterflyEmerge() }]);
    return true;
}
function butterflyEmerge() {
    const b = butterfly;
    if (!b?.pending) return;
    b.pending = false;
    b.visible = true;
    b.dir = x < 0.5 ? -1 : 1; // leci w stronę pieska (piesek stoi przy ścianie)
    b.x = b.dir > 0 ? -25 : W + 25;
    b.start = catchButterflyStart = clock;
    b.p = 0;
}

// Lot przed kliknięciem i ucieczka po kliknięciu — wołane co klatkę z loopFrame().
const BUTTERFLY_FLEE_SPEED = 0.075; // px/ms — spłoszony ucieka trochę szybciej
const CATCH_MIN_WAIT = 150; // ms patrzenia na motylka tuż przed skokiem

// Plan pogoni: po kliknięciu motylek zawraca i ucieka tam, skąd przyleciał
// (dir = -b.dir), a piesek biegnie za nim tak, żeby w chwili T motylek był
// dokładnie tam, gdzie grafika pościgu (a02/14) ma zielony znacznik. Piesek
// nigdy nie cofa się tyłem; brak planu = motylka nie da się teraz kliknąć.
function butterflyPlan() {
    const b = butterfly;
    if (!b?.free || b.lure || b.pending) return null;
    const first = numbers(getPreset("a02", 14).seq)[0],
        dir = b.dir > 0 ? -1 : 1,
        A = catchSpotFor("a02", first, 0.5, dir < 0)?.x - 0.5 * W;
    if (!isFinite(A)) return null;
    // motylek musi być jeszcze przed pieskiem (nie przeleciał nad nim)
    if ((b.x - x * W) * dir < 40) return null;
    const [lo, hi] = CATCH_ZONE[dir];
    // najpierw najszybsza ucieczka; gdy motylek jest jeszcze daleko, ucieka wolniej
    for (const v of [BUTTERFLY_FLEE_SPEED, 0.055, 0.035, 0.02])
        for (let T = 500; T <= 2500; T += 100) {
            const sx = b.x + dir * v * T;
            if (sx < 24 || sx > W - 24) break;
            let xd = (sx - A) / W;
            if (xd < lo || xd > hi) continue;
            const dist = Math.abs(xd - x) * W;
            if (dist < 6) xd = x;
            else if ((xd - x) * dir < 0) continue; // motylek za plecami — piesek by się cofał
            const walk = dist < 48,
                m = dist < 6 ? 0 : walk ? (dist / 60) * 1000 : Math.max(300, (dist / 300) * 1000);
            if (m + CATCH_MIN_WAIT > T) continue;
            return { dir, T, v, xd, m, walk, dist, spot: { x: sx, y: catchSpotFor("a02", first, xd, dir < 0)?.y ?? 231 } };
        }
    return null;
}

function butterflyFreeUpdate() {
    const b = butterfly;
    if (!b?.free) return;
    if (!["garden", "yard"].includes(room) || sleeping) {
        butterfly = null;
        nextButterfly = clock + 10000;
        return;
    }
    if (b.pending) {
        // piesek nie doszedł pod ścianę (np. ktoś go pogłaskał) — motylek i tak leci
        if (clock - b.start > 8000 && casual()) butterflyEmerge();
        return;
    }
    if (b.lure?.done) return;
    if (b.lure) {
        // ucieczka: zawraca i leci tam, skąd przyleciał; spłoszony zygzak zerowy
        // na początku i na końcu — kończy dokładnie w punkcie pościgu
        const L = b.lure,
            el = clock - L.t0,
            t = clamp(el / L.T, 0, 1),
            e = t * t * (3 - 2 * t);
        b.x = L.x0 + L.dir * L.v * Math.min(el, L.T) + Math.sin(t * Math.PI * 4 * L.cycles) * 5;
        b.y = L.y0 + (L.spot.y - L.y0) * e + Math.sin(t * Math.PI * 2 * L.cycles) * L.amp;
    } else {
        const p = (clock - b.start) / BUTTERFLY_CROSS_MS;
        if (p >= 1) {
            butterfly = null;
            nextButterfly = clock + 8000 + Math.random() * 12000;
            return;
        }
        const x0 = b.dir > 0 ? -25 : W + 25,
            x1 = b.dir > 0 ? W + 25 : -25;
        b.p = p;
        b.x = x0 + (x1 - x0) * p;
        b.y = BUTTERFLY_LINE_Y + Math.sin(p * Math.PI * 4) * 13;
        b.plan = casual() && !dirty() ? butterflyPlan() : null;
    }
    b.ringA = clamp((b.ringA || 0) + ((b.plan && !b.lure ? 1 : -1) * (clock - (b.lc ?? clock))) / 300, 0, 1);
    b.lc = clock;
}

function butterflyHit(px, py) {
    const b = butterfly;
    return !!(b?.free && !b.pending && !b.lure && b.plan && b.ringA > 0.2 && Math.hypot(px - b.x, py - b.y) <= BUTTERFLY_HIT_R);
}

// Delikatna, okrągła, pulsująca ramka wokół klikalnego motylka.
function butterflyFrameDraw(b) {
    const pulse = 0.5 + 0.5 * Math.sin(clock / 260),
        fade = b.ringA || 0; // gaśnie, gdy chwycenie nie jest już możliwe
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 44 + pulse * 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.08 * pulse})`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * pulse})`;
    ctx.shadowColor = "rgba(255,190,235,0.95)";
    ctx.shadowBlur = 8 + pulse * 8;
    ctx.stroke();
    ctx.restore();
}

// Pozycja zielonego znacznika (miejsca motylka narysowanego w grafice) na
// klatce f arkusza sh dla pieska stojącego w x=xf, zwróconego w lewo (lf) lub
// w prawo — ta sama matematyka co catchMarkerPos(), ale dla dowolnej klatki.
function catchSpotFor(sh, f, xf, lf) {
    const m = catchMarker[f];
    if (!m || !cells[sh][f - 1]) return null;
    const o = { x: 0, y: 0, scale: 100, ...CFG[sh].offsets[String(f)] },
        sc = ((BASE * o.scale) / 100) * 0.7;
    return {
        x: xf * W + (lf ? -1 : 1) * ((m.x - cells[sh][f - 1].width / 2) * sc + o.x * BASE),
        y: GROUND + (m.y - CFG[sh].ground) * sc + o.y * BASE,
    };
}

// Strefy, w których piesek może zacząć pościg w danym kierunku (dir=+1 — w
// prawo): pościg przesuwa go o ~0.1 w stronę motylka, a motylek jest ~93 px
// przed nim, więc blisko krawędzi grafika by wychodziła poza ekran.
const CATCH_ZONE = { 1: [0.2, 0.62], "-1": [0.38, 0.8] };

// Start właściwego "Chwytania motylka" po kliknięciu: motylek leci dalej jak
// leciał, a piesek (obrót / krok / bieg) ustawia się tak, żeby w chwili T
// motylek był w miejscu znacznika pościgu. Dopiero wtedy rusza animacja.
function butterflyCatch() {
    const b = butterfly;
    if (!b?.free || b.lure || !casual() || sleeping) return false;
    // smutny piesek (potrzeba ≤10%) nie goni motylka: „NIE” + pulsująca potrzeba
    if (sadBlocks("butterfly")) {
        sadRefuse();
        return false;
    }
    if (dirty()) {
        refuseWith("poop");
        return false;
    }
    const pl = butterflyPlan();
    if (!pl) return false;
    interrupt();
    phase = "butterfly";
    bubble = null;
    locks();
    const { dir, xd, T, walk, dist, m } = pl; // dir = kierunek ucieczki motylka i biegu pieska
    b.lure = {
        t0: clock,
        x0: b.x,
        y0: b.y,
        dir,
        v: pl.v,
        T,
        spot: pl.spot,
        done: false,
        cycles: clamp(Math.round(T / 450), 2, 6), // liczba zygzaków
        amp: (10 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1),
    };
    b.dir = dir; // zawraca: grafika patrzy w stronę ucieczki
    sfx("throw"); // frrr — spłoszony
    const parts = [];
    if (dist >= 6)
        parts.push({
            sheet: "a01",
            anim: walk ? 6 : 1,
            tempo: walk ? undefined : 180,
            facing: xd < x,
            to: xd,
            motion: walk ? "walk" : "run",
            time: Math.max(1, m),
            onStart: () => (stage = "butterfly-run"),
        });
    const moveT = parts.length ? parts[0].time : 0;
    startQueue([
        ...parts,
        {
            // Piesek stoi zwrócony do motylka i czeka na właściwy moment.
            sheet: "a01",
            anim: 16,
            facing: dir < 0,
            time: Math.max(CATCH_MIN_WAIT, T - moveT),
            onStart: () => (stage = "butterfly-approach"),
        },
        {
            sheet: "a02",
            anim: 14,
            facing: dir < 0,
            to: clamp(xd + dir * 0.1, 0.1, 0.9),
            time: duration("a02", 14) * 2,
            onStart: () => {
                stage = "butterfly-chase";
                sfx("good");
                if (butterfly) {
                    butterfly.visible = false;
                    if (butterfly.lure) butterfly.lure.done = true;
                }
            },
        },
        {
            sheet: "a02",
            anim: 17,
            facing: dir < 0,
            time: duration("a02", 17),
            onStart: () => (stage = "butterfly-nose"),
        },
        {
            sheet: "a01",
            anim: 16,
            facing: dir < 0,
            time: 1000,
            onStart: () => {
                stage = "butterfly-leave";
                butterfly.visible = true;
                // Odlot leci w stronę `dir` (ta sama strona, z której motylek
                // pierwotnie wleciał), ale po podejściu do pieska sprite był
                // odwrócony na `-dir` (lot w stronę pieska) i nic go nie
                // zwracało z powrotem — stąd leciał "plecami do przodu".
                butterfly.dir = dir;
                // Start odlotu dokładnie tam, gdzie nakładka motylka była na
                // ostatniej klatce chwytania (catchLastSpot) — bez skoku.
                butterfly.from = catchLastSpot || { x: x * W + dir * 84, y: 256 };
                butterfly.x = butterfly.from.x;
                butterfly.y = butterfly.from.y;
            },
            update: (p) => {
                const e = p * p * (3 - 2 * p) * 0.6 + p * 0.4; // łagodny rozbieg
                butterfly.x = butterfly.from.x + dir * 190 * e;
                butterfly.y = butterfly.from.y - 90 * e + Math.sin(p * 8) * 5 * p;
            },
            onEnd: () => {
                changeNeeds(ACTION_EFFECTS.butterfly);
                nextButterfly = clock + 8000 + Math.random() * 12000;
                butterfly = null;
            },
        },
    ]);
    return true;
}
