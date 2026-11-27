"use strict";
// Mignięcia „czystego pieska”, draw(), pętla klatek loopFrame().
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// ── „Czysty piesek”: kilka mignięć iskierek wokół całego ciała, potem spokój ──
// Po czyszczeniu łapek i po otrząśnięciu w kąpieli. Każda iskierka mignie raz,
// po kolei, w ~2 s — potem nic już nie mruga (oczy odpoczywają).
const WAG = [63, 27, 63, 27, 63, 27, 63, 63], // a01: stanie z merdaniem ogonem
    WAG_TEMPO = 300,
    TWINKLE_PTS = (() => {
        let seed = 99;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280),
            out = [];
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + rnd() * 0.5,
                r = 0.75 + rnd() * 0.4;
            out.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, t: i * 170 + rnd() * 90, k: ["D", "A", "D", "B"][i % 4], s: 1.0 + rnd() * 0.5 });
        }
        return out;
    })(),
    TWINKLE_MS = 520;
let bodyTwinkleT = -1e9; // start mignięć w scenie
function twinkleDraw(c, cx, cy, rx, ry, t0, scale = 1) {
    const t = clock - t0;
    if (t < 0 || t > 2300 || !images.sparkle) return;
    c.save();
    c.imageSmoothingEnabled = false;
    for (const p of TWINKLE_PTS) {
        const u = (t - p.t) / TWINKLE_MS;
        if (u <= 0 || u >= 1) continue;
        const a = Math.sin(Math.PI * u),
            z = p.s * scale * (0.6 + 0.4 * a),
            [sx, sy] = SPARKLE_CELL[p.k];
        c.globalAlpha = a;
        c.drawImage(images.sparkle, sx, sy, 64, 64, Math.round(cx + p.dx * rx - 32 * z), Math.round(cy + p.dy * ry - 32 * z), 64 * z, 64 * z);
    }
    c.restore();
}
function bodyTwinkleDraw() {
    if (dogHidden) return;
    twinkleDraw(ctx, x * W, GROUND - 48, 92, 62, bodyTwinkleT);
}

// Punkty łap na ekranie (ta sama matematyka co headPosition) — dla iskierek przy czystych łapkach
function pawScreenPoints() {
    const g = geometry(),
        paws = skeleton?.[sheet]?.[g.f - 1]?.paws || [];
    return paws.map(([px, py]) => ({
        x: x * W + (left ? -1 : 1) * ((px - g.w / 2) * g.s + g.o.x * BASE),
        y: GROUND + jumpY + (py - g.g) * g.s + g.o.y * BASE,
    }));
}

function draw(dt) {
    ctx.clearRect(0, 0, W, SH);
    ctx.imageSmoothingEnabled = false;
    // Motylki-tło rysowane PRZED pieskiem, więc są wizualnie za nim — i
    // trzymają się wyłącznie górnego pasa "nieba" (patrz AMBIENT_ZONE_BOTTOM),
    // więc nie wchodzą mu na grzbiet ani pod brzuch. Rysowane też podczas
    // interaktywnego butterflyEvent() — tło ma dalej żyć w czasie
    // rzeczywistym, zamiast znikać na czas pogoni za innym motylkiem.
    ambientDraw();
    if (!dogHidden) drawDog(ctx);
    if (phase === "paws-clean") pawsClothDraw();
    // Kret-zapowiedź PRZED pieskiem (na pierwszym planie) — w
    // przeciwieństwie do motylków-tła, które lecą za nim.
    // Kupka: pierwszy plan, tuż pod linią podłogi pieska — ale za kretem
    // (kret rysowany zaraz po niej, więc jest przed kupką).
    if (poop && Math.abs(order.indexOf(poop.room) - order.indexOf(room)) <= 1) {
        const r = poopRect();
        ctx.drawImage(images.poop, r.x, r.y, r.w, r.h);
    }
    moleTeaserDraw();
    if (typeof boneMoleDraw === "function") boneMoleDraw();
    if (typeof boneDigDraw === "function") boneDigDraw();
    sparklesDraw();
    bodyTwinkleDraw();
    hedgePeekDraw();
    // Jeżyk i zgubiony owoc — pierwszy plan, przed pieskiem.
    hedgeFruitDraw();
    hedgehogDraw();
    catchOverlayDraw();
    if (boneVisible) iconDraw(ctx, "bone", x * W + 20, GROUND - 30, 37);
    if (butterfly?.visible) {
        // Ten sam motylek (kolor + zegar trzepotu) co w catchOverlayDraw() —
        // cały event lata jedną, spójną grafiką z motyle-new.png.
        const cell = eventButterflyCell();
        if (butterfly.free && !butterfly.lure?.done) butterflyFrameDraw(butterfly);
        if (cell) {
            ctx.save();
            ctx.translate(butterfly.x, butterfly.y);
            if (butterfly.dir < 0) ctx.scale(-1, 1);
            ctx.drawImage(cell, -EVENT_BUTTERFLY_SIZE / 2, -EVENT_BUTTERFLY_SIZE / 2, EVENT_BUTTERFLY_SIZE, EVENT_BUTTERFLY_SIZE);
            ctx.restore();
        }
    }
    lumpDraw();
    dishDraw(); // skorupy za piłką (piłka leży przed nimi)
    ballDraw();
    moleDirtDraw();
    bubbleDraw(dt);
    bubbleGameDraw();
    moleGameDraw();
    hedgeGameDraw();
    mole2GameDraw();
    memoGameDraw();
    memoEndDraw();
    hedgeWinDraw();
    moleWinDraw();
    mole2WinDraw();
    if (!$(".bubbleWinPopup").hidden) {
        bubbleWinCtx.clearRect(0, 0, 260, 210);
        drawDog(bubbleWinCtx, 130, 196, left, 0.85);
        twinkleDraw(bubbleWinCtx, 130, 196 - 48 * 0.85, 92 * 0.85, 62 * 0.85, bodyTwinkleT, 0.9);
    }
    if (!$(".popup").hidden) {
        rewardCtx.clearRect(0, 0, 300, 300);
        drawDog(rewardCtx, 150, 255, left, 0.72);
    }
    const c = x * W;
    $(".arrow.prev").classList.toggle("near", c - 102 < 66);
    $(".arrow.next").classList.toggle("near", c + 102 > W - 66);
}

function loopFrame(t) {
    const dt = last ? Math.min(60, t - last) : 0;
    last = t;
    if (loaded && !document.hidden && !orientationPaused) {
        clock += dt;
        updateNeeds(dt / 1000);
        frameIndex = Math.floor((clock - animStart) / ms) % frames.length;
        if (segment) {
            const p = clamp((clock - segment.started) / segment.time, 0, 1);
            if (segment.to !== undefined) x = segment.origin + (segment.to - segment.origin) * p;
            if (segment.motion) {
                const travelled = Math.abs(x - segment.origin) * W,
                    stride = segment.motion === "walk" ? 13 : 36;
                frameIndex = segment.distance > 2 ? Math.floor(travelled / stride) % frames.length : 0;
            }
            segment.update?.(p);
            if (p >= 1) {
                const old = segment;
                segment = null;
                old.onEnd?.();
                if (!segment && phase !== "idle") nextSegment();
            }
        } else if (phase === "petting") {
            if (clock >= petFinishAt || (!gesture && clock - petLast > 3000)) endPetting();
        } else if (phase === "idle" && !sleeping && !gesture && !menu.drag) {
            if (sadNeed()) sadStart();
            else if (!poop && poopUrge()) spawnPoop();
            else if (clock >= nextTrip) autoTrip();
            else if (clock >= idleUntil && !(butterfly?.free && !butterfly.lure)) autonomous();
        }
        if (bubbleGame) bubbleGameUpdate(dt);
        if (moleGame) moleGameUpdate(dt);
        if (fetchGame || !$(".fetchEnd").hidden) updateFetchUi();
        if (hedgeGame) hedgeGameUpdate(dt);
        if (mole2Game) mole2GameUpdate(dt);
        if (memoGame) memoGameUpdate();
        // Działają zawsze, też podczas butterflyEvent() (phase==="butterfly") —
        // tło ma dalej żyć w czasie rzeczywistym, niezależnie od scenki
        // pogoni za motylkiem na pierwszym planie.
        if (!butterfly && clock >= nextButterfly && !wildlifeBusy("butterfly") && casual() && !sleeping && !dirty() && !menu.drag && ["garden", "yard"].includes(room)) butterflySpawn();
        butterflyFreeUpdate();
        ambientUpdate(dt);
        hedgehogUpdate(dt);
        moleTeaserUpdate();
        if (typeof boneMoleUpdate === "function") boneMoleUpdate();
        if (typeof boneDigUpdate === "function") boneDigUpdate();
        bubbleThink();
        draw(dt);
    }
    requestAnimationFrame(loopFrame);
}
