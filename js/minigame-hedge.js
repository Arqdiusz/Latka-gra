"use strict";
// ═══════════════════════════════════════════════════════════════
// JEŻYK I OWOCE — mini-gra: jeżyk łapie na kolce spadające owoce (+1) i
// unika słodyczy (−1). Wejście: mordka jeżyka wystająca z rogu Łąki
// (hedgePeekDraw / hedgePeekHit), potem tutorial, pełnoekranowa nakładka
// (.hedgeFull) z własnym canvasem i karta końcowa jak przy kreciku.
// Wczytywany PO game.js (korzysta ze wspólnego stanu i funkcji).
// ═══════════════════════════════════════════════════════════════

let hedgeGame = null; // { need, caught, collected:[], items:[], effects:[], hx, tx, ... }

const hctx = $(".hedgeCanvas").getContext("2d"),
    hedgeCanvas = $(".hedgeCanvas"),
    HEDGE_NEED = 10,
    HEDGE_SIZE = 112, // rozmiar rysowanego jeżyka
    HEDGE_Y = H - 118, // środek jeżyka
    HEDGE_SPEED = 560, // px/s — jak szybko jeżyk biegnie za palcem
    HEDGE_ITEM = 64,
    HEDGE_BAD_STREAK_MAX = 2,
    HEDGE_PAIR_CHANCE = 0.3;

// ── Mordka jeżyka wystająca z rogu Łąki (wejście do mini-gry) ────
// Rysowana w drugim, prawym dolnym rogu sceny pod skosem — reszta jeżyka
// "chowa się" za dołem sceny i kołowym menu. Delikatnie się wysuwa/chowa.
function hedgePeekPose() {
    const t = clock / 1000,
        slide = 0.5 + 0.5 * Math.sin(t * 1.3), // 0..1 wysunięcie
        wiggle = Math.sin(t * 2.6) * 0.04;
    return { x: W - 56, y: SH - 36 - slide * 12, rot: 0.62 + wiggle, size: 150 };
}

function hedgePeekVisible() {
    return room === "meadow" && cells.hedgehog.length && !hedgeGame && !moleGame && !bubbleGame && phase !== "butterfly";
}

function hedgePeekDraw() {
    if (!hedgePeekVisible()) return;
    const p = hedgePeekPose(),
        cell = cells.hedgehog[0];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(-1, 1); // patrzy w górę-lewo, w stronę pieska
    ctx.drawImage(cell, -p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
}

function hedgePeekHit(px, py) {
    if (!hedgePeekVisible()) return false;
    const p = hedgePeekPose();
    return Math.hypot(px - (p.x - 26), py - (p.y - 34)) <= 58;
}

function hedgePeekTap() {
    if (!casual()) return;
    if (dirty()) {
        say("poop", 4500);
        toast("Najpierw posprzątaj kupkę w tym pomieszczeniu.");
        return;
    }
    if (stats.water < 15) {
        say("water", 3500);
        toast("Najpierw woda — pies jest spragniony.");
        return;
    }
    if (stats.sleep < 15) {
        say("sleep", 3500);
        toast("Pies potrzebuje snu przed zabawą.");
        return;
    }
    hedgeIntroShow(hedgeStart);
}

// ── Pop-up z instrukcją ──────────────────────────────────────────
let hedgeIntroResume = null;
function hedgeIntroShow(onOk) {
    hedgeIntroResume = onOk;
    $(".hedgeIntroIcon").src = icons.garden;
    const draw = (cv, idxs) => {
        const c = cv.getContext("2d");
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        const s = 52,
            gap = (cv.width - idxs.length * s) / (idxs.length + 1);
        idxs.forEach((n, i) => cells.hedgehogGame[n] && c.drawImage(cells.hedgehogGame[n], gap + i * (s + gap), 6, s, s));
    };
    draw($(".hedgeTutGood"), [4, 5, 6]);
    draw($(".hedgeTutBad"), [0, 1, 3]);
    $(".hedgePopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 120000,
            onStart: () => {
                phase = "hedge-intro";
                stage = "hedge-intro";
                locks();
            },
        },
    ]);
}
$(".hedgeOk").onclick = () => {
    $(".hedgePopup").hidden = true;
    const resume = hedgeIntroResume;
    hedgeIntroResume = null;
    resume?.();
};
$(".hedgeCancel").onclick = () => {
    $(".hedgePopup").hidden = true;
    hedgeIntroResume = null;
    idle(16);
};

// ── Start / koniec ───────────────────────────────────────────────
function hedgeReadySegment() {
    return {
        sheet: "a01",
        anim: 16,
        time: 600000,
        onStart: () => {
            phase = "hedge-game";
            stage = "hedge-game";
            locks();
        },
        onEnd: () => hedgeFinish(false),
    };
}

function hedgeStart() {
    hedgeGame = {
        need: HEDGE_NEED,
        caught: 0,
        collected: [],
        items: [],
        effects: [],
        hx: W / 2,
        tx: W / 2,
        facing: 1,
        moving: false,
        nextSpawn: clock + 700,
        badStreak: 0,
        spawned: 0,
        won: false,
    };
    say("fun", 1500);
    startQueue([hedgeReadySegment()]);
    updateHedgeUi();
    save();
}

function updateHedgeUi() {
    $(".hedgeFull").hidden = !hedgeGame;
    if (!hedgeGame) hctx.clearRect(0, 0, W, H);
}

$(".hedgeClose").onclick = () => {
    if (phase !== "hedge-game") return;
    hedgeFinish(false);
};

function hedgeFinish(rewarded) {
    const got = rewarded && hedgeGame && hedgeGame.caught > 0;
    hedgeGame = null;
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    updateHedgeUi();
    if (got) {
        changeNeeds(ACTION_EFFECTS.hedgehog);
        save();
    }
    idle(16);
}

// ── Karta końcowa ────────────────────────────────────────────────
function hedgeWinShow() {
    const g = hedgeGame;
    if (!g || g.won) return;
    g.won = true;
    g.items.length = 0;
    phase = "hedge-win";
    stage = "hedge-win";
    startQueue([{ sheet: "a01", anim: 13, time: 600000 }]);
    phase = "hedge-win";
    locks();
    moleWinSpawnConfetti(".hedgeWinPopup .moleWinConfetti");
    $(".hedgeWinPopup").hidden = false;
}
$(".hedgeWinOk").onclick = () => {
    $(".hedgeWinPopup").hidden = true;
    hedgeFinish(true);
};
$(".hedgeWinAgain").onclick = () => {
    $(".hedgeWinPopup").hidden = true;
    hedgeFinish(true);
    hedgeStart();
};

// Jeżyk (animowany w miejscu) na karcie końcowej — wołane z draw().
const hedgeWinCtx = $(".hedgeWinPic").getContext("2d");
function hedgeWinDraw() {
    if ($(".hedgeWinPopup").hidden || !cells.hedgehog.length) return;
    const frames = numbers(CFG.hedgehog.presets[0].seq),
        cell = cells.hedgehog[frames[Math.floor(clock / CFG.hedgehog.presets[0].ms) % frames.length] - 1];
    hedgeWinCtx.clearRect(0, 0, 260, 170);
    hedgeWinCtx.imageSmoothingEnabled = false;
    hedgeWinCtx.drawImage(cell, 55, 5, 150, 150);
}

// ── Przebieg gry ─────────────────────────────────────────────────
function hedgeSpeedScale(g) {
    return 1 + 0.9 * (g.caught / g.need);
}

function hedgePickKind(g, forceGood = false) {
    const good = forceGood || g.badStreak >= HEDGE_BAD_STREAK_MAX || Math.random() < 0.58;
    g.badStreak = good ? 0 : g.badStreak + 1;
    return good ? 4 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 4);
}

function hedgeNewItem(x, vy, idx) {
    return { x, y: -HEDGE_ITEM, vy, idx, good: idx >= 4, rot: (Math.random() - 0.5) * 0.4, spin: (Math.random() - 0.5) * 1.2 };
}

function hedgeSpawn() {
    const g = hedgeGame,
        sc = hedgeSpeedScale(g),
        baseVy = (120 + Math.random() * 80) * sc,
        margin = HEDGE_ITEM / 2 + 14;
    g.spawned++;
    if (g.spawned > 2 && Math.random() < HEDGE_PAIR_CHANCE) {
        // Dwa obiekty obok siebie w niemal tej samej prędkości — trzeba wybrać.
        const gap = 92 + Math.random() * 40,
            x1 = margin + Math.random() * (W - 2 * margin - gap),
            a = hedgePickKind(g),
            b = Math.random() < 0.7 ? (a >= 4 ? Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 4)) : hedgePickKind(g);
        g.items.push(hedgeNewItem(x1, baseVy, a), hedgeNewItem(x1 + gap, baseVy * (0.96 + Math.random() * 0.08), b));
    } else {
        const idx = hedgePickKind(g, g.spawned === 1);
        g.items.push(hedgeNewItem(margin + Math.random() * (W - 2 * margin), baseVy, idx));
    }
    g.nextSpawn = clock + (900 + Math.random() * 700) / Math.sqrt(sc);
}

function hedgeGameUpdate(dt) {
    const g = hedgeGame;
    if (!g) return;
    const dtS = dt / 1000;
    // Jeżyk biegnie za palcem.
    const d = g.tx - g.hx,
        step = Math.min(Math.abs(d), HEDGE_SPEED * dtS);
    g.moving = Math.abs(d) > 2;
    if (g.moving) {
        g.hx += Math.sign(d) * step;
        g.facing = Math.sign(d);
    }
    if (g.won) return;
    if (clock >= g.nextSpawn) hedgeSpawn();
    const backTop = HEDGE_Y - HEDGE_SIZE * 0.3;
    for (let i = g.items.length - 1; i >= 0; i--) {
        const it = g.items[i];
        it.y += it.vy * dtS;
        it.rot += it.spin * dtS;
        const nearX = Math.abs(it.x - g.hx) <= HEDGE_SIZE * 0.42 + HEDGE_ITEM * 0.2,
            reach = it.y + HEDGE_ITEM * 0.35 >= backTop && it.y < backTop + 46;
        if (nearX && reach) {
            g.items.splice(i, 1);
            hedgeCatch(it);
            if (g.won) return;
            continue;
        }
        if (it.y > H + HEDGE_ITEM) g.items.splice(i, 1);
    }
    for (let i = g.effects.length - 1; i >= 0; i--) if (clock - g.effects[i].born > 550) g.effects.splice(i, 1);
}

function hedgeCatch(it) {
    const g = hedgeGame;
    g.effects.push({ x: it.x, y: HEDGE_Y - HEDGE_SIZE * 0.45, born: clock, good: it.good, rot: (Math.random() - 0.5) * 0.8, flip: Math.random() < 0.5 ? -1 : 1 });
    if (it.good) {
        g.caught++;
        g.collected.push(it.idx);
        if (g.caught >= g.need) hedgeWinShow();
    } else if (g.caught > 0) {
        g.caught--;
        g.collected.pop();
    }
}

function hedgeGameDraw() {
    const g = hedgeGame;
    if (!g) return;
    const c = hctx;
    c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    // Tło: niebo + trawa
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#9bd8ff");
    sky.addColorStop(0.55, "#d9f2ff");
    sky.addColorStop(0.56, "#9fd672");
    sky.addColorStop(1, "#7cc255");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#8ccc62";
    for (let i = 0; i < 7; i++) c.fillRect(0, H * 0.6 + i * 54, W, 22);
    // Przedmioty
    for (const it of g.items) {
        const cell = cells.hedgehogGame[it.idx];
        if (!cell) continue;
        c.save();
        c.translate(it.x, it.y);
        c.rotate(it.rot);
        c.drawImage(cell, -HEDGE_ITEM / 2, -HEDGE_ITEM / 2, HEDGE_ITEM, HEDGE_ITEM);
        c.restore();
    }
    // Jeżyk
    const frames = numbers(CFG.hedgehog.presets[0].seq),
        cell = cells.hedgehog[g.moving ? frames[Math.floor(clock / CFG.hedgehog.presets[0].ms) % frames.length] - 1 : 0];
    c.save();
    c.fillStyle = "rgba(40,80,20,0.25)";
    c.beginPath();
    c.ellipse(g.hx, HEDGE_Y + HEDGE_SIZE * 0.4, HEDGE_SIZE * 0.4, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(g.hx, HEDGE_Y);
    if (g.facing < 0) c.scale(-1, 1);
    c.drawImage(cell, -HEDGE_SIZE / 2, -HEDGE_SIZE / 2, HEDGE_SIZE, HEDGE_SIZE);
    c.restore();
    // Złapane owoce "na kolcach" (do 3 ostatnich)
    g.collected.slice(-3).forEach((n, i) => {
        const fc = cells.hedgehogGame[n];
        if (fc) c.drawImage(fc, g.hx - 30 + i * 22 - 11, HEDGE_Y - HEDGE_SIZE * 0.5 - 12 + (i % 2) * 6, 30, 30);
    });
    // Efekty +/- (gwiazdka / zły znaczek jak w bańkach)
    for (const e of g.effects) {
        const im = images[e.good ? "bubbleStar" : "bubbleWrong"];
        if (!im) continue;
        const t = clamp((clock - e.born) / 550, 0, 1),
            ease = 1 - Math.pow(1 - t, 3),
            size = 70 * (0.55 + ease * 0.7 + Math.sin(ease * Math.PI) * 0.2);
        c.save();
        c.globalAlpha = 1 - t * t;
        c.translate(e.x, e.y - ease * 40);
        c.rotate(e.rot);
        c.scale(e.flip, 1);
        c.drawImage(im, -size / 2, -size / 2, size, size);
        c.restore();
    }
    hedgePanelDraw(g);
}

// Panel postępu: 10 okienek; złapane owoce pokazują się w nich.
function hedgePanelDraw(g) {
    const c = hctx,
        x = 14,
        y = 62,
        w = W - 28,
        h = 66;
    c.save();
    c.shadowColor = "rgba(0,0,0,0.2)";
    c.shadowBlur = 8;
    c.shadowOffsetY = 3;
    c.fillStyle = "#fffdf3";
    c.strokeStyle = "#fff";
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(x, y, w, h, 20);
    c.fill();
    c.stroke();
    c.restore();
    const slot = 28,
        gap = (w - 2 * 14 - g.need * slot) / (g.need - 1);
    for (let i = 0; i < g.need; i++) {
        const sx = x + 14 + i * (slot + gap),
            sy = y + (h - slot) / 2;
        c.fillStyle = i < g.caught ? "#e3f4d3" : "#ece6d8";
        c.strokeStyle = i < g.caught ? "#6f9a52" : "#cfc6b0";
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(sx, sy, slot, slot, 9);
        c.fill();
        c.stroke();
        const n = g.collected[i];
        if (i < g.caught && cells.hedgehogGame[n]) c.drawImage(cells.hedgehogGame[n], sx - 3, sy - 3, slot + 6, slot + 6);
    }
}

// ── Sterowanie: jeżyk biegnie za palcem (po całym ekranie) ───────
let hedgePointerId = null;
function hedgeCanvasX(e) {
    const r = hedgeCanvas.getBoundingClientRect();
    return clamp(((e.clientX - r.left) / r.width) * W, HEDGE_SIZE * 0.4, W - HEDGE_SIZE * 0.4);
}
hedgeCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || phase !== "hedge-game" || !hedgeGame) return;
    hedgePointerId = e.pointerId;
    hedgeGame.tx = hedgeCanvasX(e);
    try {
        hedgeCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
hedgeCanvas.addEventListener("pointermove", (e) => {
    if (hedgePointerId !== e.pointerId || phase !== "hedge-game" || !hedgeGame) return;
    hedgeGame.tx = hedgeCanvasX(e);
});
function hedgePointerEnd(e) {
    if (hedgePointerId !== e.pointerId) return;
    hedgePointerId = null;
}
hedgeCanvas.addEventListener("pointerup", hedgePointerEnd);
hedgeCanvas.addEventListener("pointercancel", hedgePointerEnd);
