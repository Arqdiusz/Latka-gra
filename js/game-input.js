"use strict";
// Trafianie w obiekty, kupka, obsługa dotyku (pointer) i gestów.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

function headPosition() {
    const g = geometry(),
        h = P.meta[sheet][g.f - 1].head;
    return {
        x: x * W + (left ? -1 : 1) * ((h[0] - g.w / 2) * g.s + g.o.x * BASE),
        y: GROUND + jumpY + (h[1] - g.g) * g.s + g.o.y * BASE,
    };
}

// Jak headPosition(), ale dla zielonego znacznika (#00ff43) wykrytego na
// aktualnie wyświetlanej klatce a02 — albo null, jeśli ta klatka żadnego
// znacznika nie ma (patrz catchMarker / extractMarker() w boot()). Ta sama
// matematyka transformacji co w drawDog(), więc nakładka zawsze trzyma się
// dokładnie wskazanego miejsca, niezależnie od obrotu/skali danej klatki.
function catchMarkerPos() {
    const g = geometry(),
        m = catchMarker[g.f];
    if (!m) return null;
    return {
        x: x * W + (left ? -1 : 1) * ((m.x - g.w / 2) * g.s + g.o.x * BASE),
        y: GROUND + jumpY + (m.y - g.g) * g.s + g.o.y * BASE,
    };
}

function petHit(px, py) {
    if (!loaded) return false;
    const g = geometry();
    let xx = px - x * W;
    if (left) xx = -xx;
    const sx = (xx - g.o.x * BASE) / g.s + g.w / 2,
        sy = (py - GROUND - jumpY - g.o.y * BASE) / g.s + g.g,
        b = P.meta[sheet][g.f - 1].box,
        bw = b[2] - b[0],
        bh = b[3] - b[1];
    if (sx < b[0] + bw * 0.23 || sx >= b[2] || sy < b[1] + bh * 0.1 || sy > b[1] + bh * 0.86) return false;
    const ix = Math.floor(sx),
        iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= g.w || iy >= g.h) return false;
    return pixels[sheet][g.f - 1][(iy * g.w + ix) * 4 + 3] > 120;
}

function poopRect() {
    const w = 60,
        h = (w * images.poop.height) / images.poop.width;
    let offset = 0;
    if (poop) {
        const diff = order.indexOf(poop.room) - order.indexOf(room);
        offset = diff * W + roomOffset;
    }
    return {
        x: clamp((poop?.x || 0.3) * W, 22, W - 22) - w / 2 + offset,
        y: GROUND + 38 - h, // pierwszy plan: tuż pod linią podłogi pieska
        w,
        h,
    };
}

function poopHit(px, py) {
    if (!dirty()) return false;
    const r = poopRect();
    return px > r.x - 6 && px < r.x + r.w + 6 && py > r.y - 6 && py < r.y + r.h + 6;
}

function cleanPoop() {
    if (!casual() || !dirty()) return;
    const pr = poopRect();
    sparkleBurst(pr.x + pr.w / 2, pr.y + pr.h / 2);
    sfx("wipe");
    interrupt();
    wake();
    poop = null;
    blockedActivity = null;
    if (Math.random() < POOP_GAG_CHANCE) poopGagAt = clock + POOP_GAG_DELAY_MS[0] + Math.random() * (POOP_GAG_DELAY_MS[1] - POOP_GAG_DELAY_MS[0]);
    changeNeeds(ACTION_EFFECTS.poop);
    updatePoopAccess();
    say("heart");
    save();
}

// Kupka z logiki, nie z losu (patrz REGULY.md): przejedzony piesek (jedzenie
// >= POOP_FULL_AT) robi kupkę, a jedzenie mu spada o 10–15; poza tym "zwykłe"
// trawienie co kilka minut. Po każdej kupce przerwa (nextPoop).
const POOP_BEHIND = 0.24, // kupka za ogonem pieska
    POOP_FULL_AT = 85,
    POOP_COOLDOWN_MS = 45000,
    POOP_REGULAR_MS = [120000, 240000],
    POOP_REGULAR_MIN_FOOD = 25,
    // Żart: tuż po posprzątaniu piesek czasem robi następną kupkę.
    POOP_GAG_CHANCE = 0.1,
    POOP_GAG_DELAY_MS = [5000, 10000];
let poopGagAt = 0;
function poopUrge() {
    if (poopGagAt && clock >= poopGagAt) return true;
    if (clock < nextPoop) return false;
    if (stats.food >= POOP_FULL_AT) return true;
    return clock >= nextRegularPoop && stats.food >= POOP_REGULAR_MIN_FOOD;
}

function spawnPoop() {
    if (!casual() || sleeping || poop) return false;
    interrupt();
    phase = "toilet";
    locks();
    const gag = !!poopGagAt && clock >= poopGagAt;
    poopGagAt = 0;
    startQueue([
        {
            sheet: "a01",
            frames: [41, 42, 47],
            tempo: 420,
            time: 1260,
            onStart: () => say("poop", 2600),
            onEnd: () => {
                poop = {
                    room,
                    x: clamp(x + (left ? 1 : -1) * POOP_BEHIND, 0.08, 0.92),
                };
                // Najedzony piesek po kupce jest lżejszy: -10…-15; zwykłe
                // trawienie zabiera mniej.
                changeNeeds({ food: gag ? -3 : stats.food >= POOP_FULL_AT ? -(10 + Math.random() * 5) : -(5 + Math.random() * 3) });
                updatePoopAccess();
                say("poop", 4500);
                save();
            },
        },
        {
            sheet: "a01",
            frames: [48],
            tempo: 350,
            time: 350,
        },
    ]);
    nextPoop = clock + POOP_COOLDOWN_MS;
    nextRegularPoop = clock + POOP_REGULAR_MS[0] + Math.random() * (POOP_REGULAR_MS[1] - POOP_REGULAR_MS[0]);
    return true;
}
$(".poopAccess").onclick = cleanPoop;
$(".petAccess").onclick = react;
$(".arrow.prev").onclick = () => stepRoom(-1);
$(".arrow.next").onclick = () => stepRoom(1);

function pointerXY(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * SH,
    };
}

canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (gesture) {
        // Drugi palec w trakcie gestu — anuluj jak dawniej. Ale jeśli to
        // "wiszący" gest po zgubionym pointerup (inny pointerId, ten sam
        // jeden palec), NIE połykamy nowego dotyku — po prostu zaczynamy od nowa.
        const stale = gesture.id !== e.pointerId && e.isPrimary;
        if (gesture.kind === "pet") stopPetting();
        gesture = null;
        if (!stale) return;
    }
    if (phase === "paws-clean") {
        // czyszczenie łapek: palec = szmatka
        gesture = { id: e.pointerId, sx: e.clientX, sy: e.clientY, kind: "wipe" };
        pawsPtr = null;
        pawsWipe(pointerXY(e));
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
    }
    const p = pointerXY(e);
    gesture = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        kind: null,
        dog: petHit(p.x, p.y),
        poop: poopHit(p.x, p.y),
        moleDirt: moleDirtHit(p.x, p.y),
        dish: dishHit(p.x, p.y),
        lump: lumpHit(p.x, p.y) >= 0,
        catchFly: eventTapOk() ? butterflyHit(p.x, p.y) : false,
        butterfly: phase !== "butterfly" ? ambientHit(p.x, p.y) : null,
        hog: casual() ? hedgehogHit(p.x, p.y) : null,
        fruit: casual() ? hedgeFruitHit(p.x, p.y) : null,
        mole: gameEntryOk() ? moleTeaserHit(p.x, p.y) : null,
        boneMole: eventTapOk() && typeof boneMoleHit === "function" ? boneMoleHit(p.x, p.y) : false,
        boneDig: typeof boneDigHit === "function" ? boneDigHit(p.x, p.y) : false,
        hedge: gameEntryOk() ? hedgePeekHit(p.x, p.y) : false,
    };
    // Aport: dotknięcie piłki przy łapach = złapanie jej (dalej ciągnięcie i rzut)
    if (phase === "ball-ready" && ballGrab(p.x, p.y, e.timeStamp)) gesture.kind = "ball";
    try {
        canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
canvas.addEventListener("pointermove", (e) => {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.sx,
        dy = e.clientY - g.sy;
    if (g.kind === "wipe") {
        pawsWipe(pointerXY(e));
        return;
    }
    if (g.kind === "ball") {
        const p = pointerXY(e);
        ballHoldMove(p.x, p.y, e.timeStamp);
        return;
    }
    if (!g.kind) {
        if (phase === "ball-ready") {
            // Aport: rzuca się tylko złapaną piłką (patrz pointerdown)
        } else if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.2) {
            g.kind = g.dog && !g.poop && canPet() ? "pet" : "vertical";
            if (g.kind === "pet") startPetting();
        } else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2 && casual()) {
            g.kind = "swipe";
        }
    }
    if (g.kind === "pet") {
        e.preventDefault();
        petLast = clock;
        petFinishAt = Infinity;
        if (!bubble || bubble.until < clock + 1000) say("heart", 2500);
    }
});

function pointerEnd(e, cancel = false) {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    gesture = null;
    try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (g.kind === "wipe") {
        pawsPtr = null;
        return;
    }
    if (g.kind === "pet") {
        stopPetting();
        return;
    }
    const dx = e.clientX - g.sx,
        dy = e.clientY - g.sy;
    if (g.kind === "ball") {
        if (!cancel) ballHoldMove(pointerXY(e).x, pointerXY(e).y, e.timeStamp);
        ballRelease(e.timeStamp, cancel);
        return;
    }
    if (g.kind === "swipe") {
        if (!cancel && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            setOffset(0);
            stepRoom(dx < 0 ? 1 : -1);
        } else {
            setOffset(0);
        }
        return;
    }
    if (cancel) return;
    if (!g.kind && Math.hypot(dx, dy) <= 12) {
        const p = pointerXY(e);
        // Wejścia do gier (kret, jeżyk) mają pierwszeństwo przed pieskiem —
        // inaczej, gdy piesek stał obok kopca, dotyk szedł w "pogłaskanie".
        if (g.boneDig && boneDigHit(p.x, p.y)) boneDigTap();
        else if (g.hog && hedgehogHit(p.x, p.y) === g.hog) hedgehogScare(g.hog);
        else if (g.fruit && hedgeFruitHit(p.x, p.y)) hedgeFruitCollect(g.fruit);
        else if (g.mole && moleTeaserHit(p.x, p.y) === g.mole) moleTeaserTap(g.mole);
        else if (g.boneMole && boneMoleHit(p.x, p.y)) stopAutoTrip() || boneMoleTap();
        else if (g.hedge && hedgePeekHit(p.x, p.y)) hedgePeekTap();
        else if (g.poop && poopHit(p.x, p.y)) cleanPoop();
        else if (g.moleDirt && moleDirtHit(p.x, p.y)) cleanMoleDirt();
        else if (g.dish && dishHit(p.x, p.y)) cleanDish();
        else if (g.lump && lumpHit(p.x, p.y) >= 0) cleanLump(lumpHit(p.x, p.y));
        else if (g.catchFly && butterflyHit(p.x, p.y)) stopAutoTrip() || butterflyCatch();
        else if (g.dog && petHit(p.x, p.y)) react();
        else if (g.butterfly && ambientHit(p.x, p.y) === g.butterfly) ambientFlee(g.butterfly);
    }
}
canvas.addEventListener("pointerup", (e) => pointerEnd(e));
canvas.addEventListener("pointercancel", (e) => pointerEnd(e, true));
canvas.addEventListener("lostpointercapture", (e) => {
    if (gesture?.id === e.pointerId) pointerEnd(e, true);
});
