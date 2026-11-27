"use strict";
// ═══════════════════════════════════════════════════════════════
// JEŻYK I OWOCE — mini-gra: jeżyk łapie na kolce spadające owoce (+1) i
// unika słodyczy (−1). Wejście: mordka jeżyka wystająca z rogu Łąki
// (hedgePeekDraw / hedgePeekHit), potem tutorial, pełnoekranowa nakładka
// (.hedgeFull) z własnym canvasem i karta końcowa jak przy kreciku.
// Wczytywany PO game-*.js (korzysta ze wspólnego stanu i funkcji).
// ═══════════════════════════════════════════════════════════════

let hedgeGame = null; // { need, caught, collected:[], items:[], effects:[], hx, tx, ... }

const hctx = $(".hedgeCanvas").getContext("2d"),
    hedgeCanvas = $(".hedgeCanvas"),
    HEDGE_NEED = 10,
    HEDGE_SIZE = 140, // rozmiar rysowanego jeżyka
    HEDGE_Y = H - 118, // środek jeżyka
    HEDGE_SPEED = 560, // px/s — jak szybko jeżyk biegnie za palcem
    HEDGE_ITEM = 78,
    HEDGE_BAD_STREAK_MAX = 3,
    HEDGE_PAIR_CHANCE = 0.42,
    HEDGE_GOOD_CHANCE = 0.48; // mniej więcej pół na pół — trzeba uważać

// ── Mordka jeżyka wystająca z rogu Łąki (wejście do mini-gry) ────
// Rysowana w drugim, prawym dolnym rogu sceny pod skosem — reszta jeżyka
// "chowa się" za dołem sceny i kołowym menu. Delikatnie się wysuwa/chowa.
function hedgePeekPose() {
    // Nieruchomo — wystaje tylko pyszczek (bez kołysania). Krawędź, zza
    // której wystaje, to GÓRA DOKU z menu (na telefonach dok zachodzi na dół
    // sceny i zasłaniał jeżyka razem z miejscem do kliknięcia).
    return { x: W - 56, y: sceneVisibleBottom() - 42, rot: 0.62, size: 150 };
}

// Dolna widoczna krawędź sceny w jednostkach canvasu (góra doku, jeśli na
// niego zachodzi). Liczone raz na klatkę.
let sceneBottomCache = { t: -1, v: SH };
function sceneVisibleBottom() {
    if (sceneBottomCache.t === clock) return sceneBottomCache.v;
    let v = SH;
    try {
        const r = canvas.getBoundingClientRect(),
            d = $(".dock").getBoundingClientRect();
        if (r.height > 0 && d.top < r.bottom) v = clamp(((d.top - r.top) / r.height) * SH, SH * 0.6, SH);
    } catch (_) {}
    sceneBottomCache = { t: clock, v };
    return v;
}

// Wejście z rogu Łąki wyłączone (gry są w menu "Gry" i pod pucharem).
const HEDGE_PEEK_ENABLED = false;
function hedgePeekVisible() {
    return HEDGE_PEEK_ENABLED && room === "meadow" && cells.hedgehog.length && !hedgeGame && !moleGame && !bubbleGame && phase !== "butterfly";
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
    // Cały widoczny jeżyk (obrócony prostokąt grafiki), nie tylko pyszczek —
    // łatwiej trafić małym palcem; plus spory zapas.
    const p = hedgePeekPose(),
        dx = px - p.x,
        dy = py - p.y,
        lx = dx * Math.cos(-p.rot) - dy * Math.sin(-p.rot),
        ly = dx * Math.sin(-p.rot) + dy * Math.cos(-p.rot);
    return py <= sceneVisibleBottom() && Math.abs(lx) <= p.size * 0.5 && Math.abs(ly) <= p.size * 0.45;
}

function hedgePeekTap() {
    if (sadBlocks("games")) return sadRefuse(); // smutny piesek nie chce się bawić
    if (!gameEntryOk()) return;
    if (dirty()) return refuseWith("poop"); // „NIE” + pulsująca kupka
    // potrzeby pilnuje smutek (≤10%) — gameEntryOk() / sadBlocks("games")
    hedgeIntroShow(hedgeStart);
}

// ── Pop-up z instrukcją ──────────────────────────────────────────
let hedgeIntroResume = null;
function hedgeIntroShow(onOk) {
    hedgeIntroResume = onOk;
    // Ikona: jeżyk (nie ikona ogrodu — wyglądała jak kret).
    if (cells.hedgehog[0]) $(".hedgeIntroIcon").src = cells.hedgehog[0].toDataURL("image/png");
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
        time: 1800000, // bezpiecznik 30 min
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
    sfx("win");
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
    return 1 + 1.2 * (g.caught / g.need);
}

function hedgePickKind(g, forceGood = false) {
    const good = forceGood || g.badStreak >= HEDGE_BAD_STREAK_MAX || Math.random() < HEDGE_GOOD_CHANCE;
    g.badStreak = good ? 0 : g.badStreak + 1;
    return good ? 4 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 4);
}

function hedgeNewItem(x, vy, idx) {
    return { x, y: -HEDGE_ITEM, vy, idx, good: idx >= 4, rot: (Math.random() - 0.5) * 0.4, spin: (Math.random() - 0.5) * 1.2 };
}

function hedgeSpawn() {
    const g = hedgeGame,
        sc = hedgeSpeedScale(g),
        baseVy = (150 + Math.random() * 90) * sc,
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
    g.nextSpawn = clock + (750 + Math.random() * 600) / Math.sqrt(sc);
}

function hedgeGameUpdate(dt) {
    const g = hedgeGame;
    if (!g) return;
    const dtS = dt / 1000;
    // Jeżyk podąża za celem płynnie (wygładzanie wykładnicze) — dyskretne
    // zdarzenia pointermove nie robią szarpnięć ani "stop-start", a
    // histereza ruchu i kierunku nie pozwala animacji chodu migotać.
    const d = g.tx - g.hx,
        prev = g.hx;
    g.hx += d * (1 - Math.exp(-dt / 70));
    const speed = Math.abs(g.hx - prev) / Math.max(dtS, 0.001);
    g.speed = (g.speed || 0) * 0.8 + speed * 0.2;
    if (g.moving ? g.speed < 12 : g.speed > 40) g.moving = !g.moving;
    if (Math.abs(d) > 8) g.facing = Math.sign(d);
    if (g.moving) g.walkT = (g.walkT || 0) + dt * Math.min(1.8, 0.6 + g.speed / 300); // tempo kroków zależy od szybkości
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
    sfx(it.good ? "good" : "minus");
    if (it.good) {
        g.caught++;
        g.collected.push(it.idx);
        if (g.caught >= g.need) hedgeWinShow();
    } else if (g.caught > 0) {
        g.caught--;
        g.collected.pop();
    }
}

let hedgeBgCache = null;
function hedgeBg() {
    if (hedgeBgCache) return hedgeBgCache;
    const img = new Image(),
        bg = { img, fill: "#a3d45c" };
    img.onload = () => {
        try {
            // Kolor dolnego rzędu grafiki — pas dołożony pod nią ma się zlać.
            const cv = document.createElement("canvas");
            cv.width = img.naturalWidth;
            cv.height = img.naturalHeight;
            const x = cv.getContext("2d");
            x.drawImage(img, 0, 0);
            const d = x.getImageData(img.naturalWidth >> 1, img.naturalHeight - 1, 1, 1).data;
            bg.fill = `rgb(${d[0]},${d[1]},${d[2]})`;
        } catch (_) {}
    };
    // tło gier: Łąka wydłużona o powtórzoną trawę i kwiatki (tools/tlo-gry.py)
    img.src = "assets/backgrounds/games/meadow-games.webp";
    return (hedgeBgCache = bg);
}

function cellsLast(n) {
    return n === undefined ? null : cells.hedgehogGame[n];
}

function hedgeGameDraw() {
    const g = hedgeGame;
    if (!g) return;
    const c = hctx;
    c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    // Tło: grafika Łąki dopasowana do szerokości, przyklejona do góry; jeśli
    // ekran jest wyższy — dołożony zielony pas w kolorze dolnej krawędzi.
    const bg = hedgeBg();
    if (bg.img.complete && bg.img.naturalWidth) {
        const bh = (W * bg.img.naturalHeight) / bg.img.naturalWidth;
        c.fillStyle = bg.fill;
        c.fillRect(0, 0, W, H);
        c.drawImage(bg.img, 0, 0, W, bh);
    } else {
        c.fillStyle = bg.fill;
        c.fillRect(0, 0, W, H);
    }
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
        cell = cells.hedgehog[g.moving ? frames[Math.floor((g.walkT || 0) / CFG.hedgehog.presets[0].ms) % frames.length] - 1 : 0];
    c.save();
    c.fillStyle = "rgba(40,80,20,0.25)";
    c.beginPath();
    c.ellipse(g.hx, HEDGE_Y + HEDGE_SIZE * 0.4, HEDGE_SIZE * 0.4, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(g.hx, HEDGE_Y);
    if (g.facing < 0) c.scale(-1, 1);
    c.drawImage(cell, -HEDGE_SIZE / 2, -HEDGE_SIZE / 2, HEDGE_SIZE, HEDGE_SIZE);
    c.restore();
    // Ostatnio złapany owoc "na kolcach" (tylko jeden).
    const last = g.collected[g.collected.length - 1],
        lc = cellsLast(last);
    if (lc) c.drawImage(lc, g.hx - HEDGE_ITEM / 2, HEDGE_Y - HEDGE_SIZE * 0.3 - HEDGE_ITEM * 0.75, HEDGE_ITEM, HEDGE_ITEM); // naturalny rozmiar, osadzony na kolcach
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
        c.rotate(-e.rot);
        c.scale(e.flip, 1);
        c.font = "900 34px 'Baloo 2', Nunito, system-ui, sans-serif";
        c.textAlign = "center";
        c.lineWidth = 6;
        c.strokeStyle = "#fff";
        c.fillStyle = e.good ? "#2f8f3d" : "#d9383a";
        c.strokeText(e.good ? "+1" : "−1", 0, -size / 2 - 4);
        c.fillText(e.good ? "+1" : "−1", 0, -size / 2 - 4);
        c.restore();
    }
    hedgePanelDraw(g);
}

// Panel postępu: 10 okienek; złapane owoce pokazują się w nich.
function hedgePanelDraw(g) {
    const c = hctx,
        x = 14,
        y = 78,
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
// Sterowanie względne: dotyk NIE przenosi jeżyka — liczy się dopiero
// przesunięcie palca od miejsca, w którym go przyłożono.
let hedgeGrab = null; // { px, hx }
function hedgeCanvasX(e) {
    const r = hedgeCanvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
}
function hedgeClampX(x) {
    return clamp(x, HEDGE_SIZE * 0.4, W - HEDGE_SIZE * 0.4);
}
hedgeCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || phase !== "hedge-game" || !hedgeGame) return;
    hedgePointerId = e.pointerId;
    hedgeGrab = { px: hedgeCanvasX(e), hx: hedgeGame.hx };
    hedgeGame.tx = hedgeGame.hx;
    try {
        hedgeCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
hedgeCanvas.addEventListener("pointermove", (e) => {
    if (hedgePointerId !== e.pointerId || phase !== "hedge-game" || !hedgeGame) return;
    if (!hedgeGrab) return;
    hedgeGame.tx = hedgeClampX(hedgeGrab.hx + (hedgeCanvasX(e) - hedgeGrab.px));
});
function hedgePointerEnd(e) {
    if (hedgePointerId !== e.pointerId) return;
    hedgePointerId = null;
    hedgeGrab = null;
    if (hedgeGame) hedgeGame.tx = hedgeGame.hx; // puszczony palec — jeżyk staje
}
hedgeCanvas.addEventListener("pointerup", hedgePointerEnd);
hedgeCanvas.addEventListener("pointercancel", hedgePointerEnd);
