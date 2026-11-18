"use strict";
// ═══════════════════════════════════════════════════════════════
// PAMIĘĆ MOTYLKÓW — gra pamięciowa na łące.
// 1) Pokazujemy motylki w rzędzie (od lewej do prawej) przez 3 sekundy.
// 2) Znikają, a po łące latają motylki w 5 kolorach. Trzeba klikać te z
//    wzoru — w tej samej kolejności. Pomyłka = jedna z 3 szans.
// Trzy poziomy (⭐, ⭐⭐, ⭐⭐⭐): 3, 4 i 5 motylków do zapamiętania.
// Tło: ta sama Łąka co w grze z jeżykiem (hedgeBg()).
// Ukończone poziomy zapamiętuje localStorage (tylko ozdoba: puchar na
// kafelku poziomu). Wczytywany PO minigame-hedge.js i minigame-mole2.js.
// ═══════════════════════════════════════════════════════════════

let memoGame = null;

const memoCanvas = $(".memoCanvas"),
    memoCtx = memoCanvas.getContext("2d"),
    MEMO_SHOW_MS = 3000, // tyle widać wzór
    MEMO_LIVES = 3,
    MEMO_SIZE = 92, // motylek w locie
    MEMO_HIT_R = 52,
    MEMO_ZONE = { x0: 44, x1: W - 44, y0: 175, y1: H - 150 },
    MEMO_LEVELS = [
        { n: 3, copies: 2, speed: 56 },
        { n: 4, copies: 3, speed: 72 },
        { n: 5, copies: 3, speed: 88 },
    ],
    MEMO_STORE = "memoLevelsDone";

function memoDone() {
    try {
        return JSON.parse(localStorage.getItem(MEMO_STORE) || "[]");
    } catch (_) {
        return [];
    }
}
function memoMarkDone(level) {
    try {
        const d = memoDone();
        if (!d.includes(level)) d.push(level);
        localStorage.setItem(MEMO_STORE, JSON.stringify(d));
    } catch (_) {}
}

// Klatka motylka w danym kolorze (0..4) w chwili t [ms]
function memoCell(color, t, slow = 2) {
    const p = CFG.motyle.presets[color],
        f = numbers(p.seq);
    return cells.motyle[f[Math.floor(t / (p.ms / slow)) % f.length] - 1];
}

// Rysuje rząd motylków (np. do tutoriala i kart końcowych)
function memoRow(c, colors, x0, y, size, gap, t) {
    colors.forEach((col, i) => {
        const cell = memoCell(col, t);
        if (cell) c.drawImage(cell, x0 + i * (size + gap), y, size, size);
    });
}

// ── Tutorial ─────────────────────────────────────────────────────
let memoIntroResume = null;
function memoTryStart() {
    if (!gameEntryOk()) return;
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
    hedgeBg(); // wczytaj tło Łąki z wyprzedzeniem
    memoIntroResume = memoShowLevels;
    if (cells.motyle[0]) $("#memoPopup .moleIntroIcon").src = cells.motyle[0].toDataURL("image/png");
    const drawTut = (cv, fn) => {
        const c = cv.getContext("2d");
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        fn(c);
    };
    drawTut($(".memoTutShow"), (c) => {
        memoRow(c, [0, 2, 4], 14, 4, 46, 12, 0);
        c.font = "800 15px system-ui, sans-serif";
        c.textAlign = "center";
        c.fillStyle = "#59485d";
        [0, 1, 2].forEach((i) => c.fillText(String(i + 1), 14 + i * 58 + 23, 66));
    });
    drawTut($(".memoTutPlay"), (c) => {
        const pos = [[12, 26, 4], [92, 2, 2], [60, 38, 0], [124, 28, 1]];
        pos.forEach(([x, y, col]) => {
            const cell = memoCell(col, 0);
            if (cell) c.drawImage(cell, x, y, 42, 42);
        });
    });
    $("#memoPopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "memo-intro";
                stage = "memo-intro";
                locks();
            },
        },
    ]);
}
$("#memoPopup .moleOk").onclick = () => {
    $("#memoPopup").hidden = true;
    const r = memoIntroResume;
    memoIntroResume = null;
    r?.();
};
$("#memoPopup .moleCancel").onclick = () => {
    $("#memoPopup").hidden = true;
    memoIntroResume = null;
    idle(16);
};

// ── Wybór poziomu ────────────────────────────────────────────────
function memoShowLevels() {
    const box = $(".memoLevels .memoGrid"),
        done = memoDone();
    box.innerHTML = "";
    MEMO_LEVELS.forEach((lv, i) => {
        const b = document.createElement("button");
        b.className = "memoTile";
        b.innerHTML =
            '<span class="memoStars">' + "★".repeat(i + 1) + '</span><span class="memoTileTxt">' + lv.n + " motylki</span>" +
            (done.includes(i) ? '<img class="memoTileCup" alt="Ukończony" src="' + icons.cup + '" />' : "");
        b.onclick = () => {
            $(".memoLevels").hidden = true;
            memoStart(i);
        };
        box.appendChild(b);
    });
    $(".memoLevels").hidden = false;
}
$(".memoLevelsClose").onclick = () => {
    $(".memoLevels").hidden = true;
    if (phase === "memo-intro") idle(16);
};

// ── Start / koniec ───────────────────────────────────────────────
function memoShuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function memoStart(level) {
    const lv = MEMO_LEVELS[level],
        total = CFG.motyle.presets.length,
        seq = Array.from({ length: lv.n }, () => Math.floor(Math.random() * total));
    // wzór z powtórzeniami kolorów, ale nie same takie same
    if (seq.every((c) => c === seq[0])) seq[seq.length - 1] = (seq[0] + 1 + Math.floor(Math.random() * (total - 1))) % total;
    memoGame = { level, lv, seq, step: 0, lives: MEMO_LIVES, state: "show", t0: clock, flies: [], effects: [], over: false, last: clock };
    $(".memoTitle").textContent = "Zapamiętaj!";
    say("fun", 1500);
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "memo-game";
                stage = "memo-game";
                locks();
            },
            onEnd: () => memoFinish(false),
        },
    ]);
    $(".memoFull").hidden = false;
    save();
}

$(".memoClose").onclick = () => {
    if (phase === "memo-game") memoFinish(false);
};

function memoFinish(rewarded) {
    const got = rewarded && memoGame;
    memoGame = null;
    $(".memoFull").hidden = true;
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    if (got) {
        changeNeeds(ACTION_EFFECTS.memory);
        save();
    }
    idle(16);
}

// ── Karty końcowe ────────────────────────────────────────────────
let memoEndT0 = 0,
    memoLastLevel = 0;
function memoEndOpen(sel, level) {
    memoLastLevel = level;
    memoEndT0 = clock;
    phase = "memo-end";
    stage = "memo-end";
    locks();
    $(sel).hidden = false;
}

function memoWinShow() {
    const g = memoGame;
    if (!g || g.over) return;
    g.over = true;
    g.flies.length = 0;
    memoMarkDone(g.level);
    $("#memoWinPopup .memoWinImg").src = icons.cup;
    moleWinSpawnConfetti("#memoWinPopup .moleWinConfetti");
    startQueue([{ sheet: "a01", anim: 13, time: 600000 }]);
    memoEndOpen("#memoWinPopup", g.level);
}
function memoLoseShow() {
    const g = memoGame;
    if (!g || g.over) return;
    g.over = true;
    g.flies.length = 0;
    startQueue([{ sheet: "a01", anim: 16, time: 600000 }]);
    memoEndOpen("#memoLosePopup", g.level);
}

$("#memoWinPopup .memoExit").onclick = () => {
    $("#memoWinPopup").hidden = true;
    memoFinish(true);
};
$("#memoWinPopup .memoNext").onclick = () => {
    // "Wybierz poziom": nagroda za wygraną i powrót do ekranu poziomów
    $("#memoWinPopup").hidden = true;
    memoFinish(true);
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "memo-intro";
                stage = "memo-intro";
                locks();
            },
        },
    ]);
    memoShowLevels();
};
$("#memoWinPopup .winAgain").onclick = () => {
    $("#memoWinPopup").hidden = true;
    const l = memoLastLevel;
    memoFinish(true);
    memoStart(l);
};
$("#memoLosePopup .memoExit").onclick = () => {
    $("#memoLosePopup").hidden = true;
    memoFinish(false);
};
$("#memoLosePopup .memoTry").onclick = () => {
    $("#memoLosePopup").hidden = true;
    const l = memoLastLevel;
    memoFinish(false);
    memoStart(l);
};

// Motylki tańczące na karcie "Prawie się udało"
const memoLoseCtx = $("#memoLosePopup .memoLosePic").getContext("2d");
function memoEndDraw() {
    if ($("#memoLosePopup").hidden) return;
    const c = memoLoseCtx,
        t = clock - memoEndT0;
    c.clearRect(0, 0, 260, 110);
    c.imageSmoothingEnabled = false;
    [0, 1, 2, 3, 4].forEach((col, i) => {
        const cell = memoCell(col, t + i * 90),
            y = 22 + Math.sin(t / 380 + i * 1.3) * 10;
        if (cell) c.drawImage(cell, 4 + i * 50, y, 52, 52);
    });
}

// ── Przebieg gry ─────────────────────────────────────────────────
function memoSpawnFlies(g) {
    g.flies.length = 0;
    const total = CFG.motyle.presets.length;
    for (let col = 0; col < total; col++) {
        for (let k = 0; k < g.lv.copies; k++) {
            let x = 0,
                y = 0;
            for (let i = 0; i < 25; i++) {
                x = MEMO_ZONE.x0 + Math.random() * (MEMO_ZONE.x1 - MEMO_ZONE.x0);
                y = MEMO_ZONE.y0 + Math.random() * (MEMO_ZONE.y1 - MEMO_ZONE.y0);
                if (g.flies.every((f) => Math.hypot(f.x - x, f.y - y) > 90)) break;
            }
            g.flies.push({
                x,
                y,
                color: col,
                heading: Math.random() * Math.PI * 2,
                turn: 0,
                speed: g.lv.speed * (0.8 + Math.random() * 0.45),
                born: clock + Math.random() * 400,
                flee: 0,
                gone: 0, // >0: znika (kolor już złapany)
                shake: 0,
            });
        }
    }
}

function memoGameUpdate() {
    const g = memoGame;
    if (!g) return;
    const dt = Math.min(60, clock - g.last);
    g.last = clock;
    if (g.over) return;
    if (g.state === "show" && clock - g.t0 >= MEMO_SHOW_MS) {
        g.state = "play";
        g.t0 = clock;
        memoSpawnFlies(g);
        $(".memoTitle").textContent = "Klikaj po kolei!";
    }
    if (g.state === "play") {
        for (let i = g.flies.length - 1; i >= 0; i--) {
            const f = g.flies[i];
            if (f.gone) {
                if (clock - f.gone > 400) g.flies.splice(i, 1);
                continue;
            }
            // leniwe, płynne skręcanie
            // prędkość kątowa [rad/s] błądzi losowo → płynne, leniwe zakręty
            f.turn = clamp(f.turn + (Math.random() - 0.5) * 4 * (dt / 1000), -1.4, 1.4);
            f.heading += f.turn * (dt / 1000);
            let sp = f.speed;
            if (f.flee && clock < f.flee) sp *= 3.2;
            f.x += Math.cos(f.heading) * sp * (dt / 1000);
            f.y += Math.sin(f.heading) * sp * (dt / 1000) * 0.75 + Math.sin(clock / 260 + i) * 0.25;
            // odbicie od brzegów łąki
            if (f.x < MEMO_ZONE.x0) (f.x = MEMO_ZONE.x0), (f.heading = Math.PI - f.heading);
            if (f.x > MEMO_ZONE.x1) (f.x = MEMO_ZONE.x1), (f.heading = Math.PI - f.heading);
            if (f.y < MEMO_ZONE.y0) (f.y = MEMO_ZONE.y0), (f.heading = -f.heading);
            if (f.y > MEMO_ZONE.y1) (f.y = MEMO_ZONE.y1), (f.heading = -f.heading);
        }
    }
    for (let i = g.effects.length - 1; i >= 0; i--) if (clock - g.effects[i].born > 650) g.effects.splice(i, 1);
}

function memoHit(px, py) {
    const g = memoGame;
    if (!g || g.over || g.state !== "play") return;
    let best = null,
        bd = 1e9;
    for (const f of g.flies) {
        if (f.gone || clock < f.born) continue;
        const d = Math.hypot(px - f.x, py - f.y);
        if (d <= MEMO_HIT_R && d < bd) {
            best = f;
            bd = d;
        }
    }
    if (!best) return;
    if (best.color === g.seq[g.step]) {
        // dobry — motylek zostaje w grze (klony i ten sam kolor mogą wrócić we wzorze)
        g.effects.push({ x: best.x, y: best.y - 30, born: clock, good: true });
        g.step++;
        if (g.step >= g.seq.length) memoWinShow();
    } else {
        g.lives--;
        g.effects.push({ x: best.x, y: best.y - 30, born: clock, good: false });
        best.flee = clock + 700;
        best.heading = Math.atan2(best.y - py, best.x - px);
        if (g.lives <= 0) memoLoseShow();
    }
}

function memoPanel(c, x, y, w, h) {
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
}

function memoHeart(c, cx, cy, s, on) {
    c.save();
    c.translate(cx, cy);
    c.scale(s / 24, s / 24);
    c.beginPath();
    c.moveTo(0, 9);
    c.bezierCurveTo(-14, -1, -9, -13, 0, -5);
    c.bezierCurveTo(9, -13, 14, -1, 0, 9);
    c.closePath();
    c.fillStyle = on ? "#ef5b6b" : "#e3dccb";
    c.strokeStyle = on ? "#b93646" : "#cfc6b0";
    c.lineWidth = 2.5;
    c.fill();
    c.stroke();
    c.restore();
}

function memoGameDraw() {
    const g = memoGame;
    if (!g) return;
    const c = memoCtx;
    c.imageSmoothingEnabled = false;
    const bg = hedgeBg();
    c.fillStyle = bg.fill;
    c.fillRect(0, 0, W, H);
    if (bg.img.complete && bg.img.naturalWidth) c.drawImage(bg.img, 0, 0, W, (W * bg.img.naturalHeight) / bg.img.naturalWidth);
    if (g.state === "show") memoShowDraw(g);
    else memoPlayDraw(g);
}

function memoShowDraw(g) {
    const c = memoCtx,
        n = g.seq.length,
        pw = W - 28,
        ph = 270,
        px = 14,
        py = 240,
        gap = 8,
        size = Math.min(80, (pw - 24 - gap * (n - 1)) / n),
        rowW = n * size + (n - 1) * gap,
        t = clock - g.t0,
        left = clamp(1 - t / MEMO_SHOW_MS, 0, 1);
    memoPanel(c, px, py, pw, ph);
    c.textAlign = "center";
    c.fillStyle = "#59485d";
    c.font = "800 26px system-ui, sans-serif";
    c.fillText("Zapamiętaj kolejność!", W / 2, py + 46);
    const x0 = (W - rowW) / 2,
        y0 = py + 92;
    g.seq.forEach((col, i) => {
        const cell = memoCell(col, t),
            bob = Math.sin(t / 240 + i) * 3;
        if (cell) c.drawImage(cell, x0 + i * (size + gap) - size * 0.25, y0 + bob - size * 0.25, size * 1.5, size * 1.5);
        c.font = "800 22px system-ui, sans-serif";
        c.fillStyle = "#59485d";
        c.fillText(String(i + 1), x0 + i * (size + gap) + size / 2, y0 + size + 40);
    });
    // pasek czasu
    const bw = pw - 60,
        bx = px + 30,
        by = py + ph - 30;
    c.fillStyle = "#ece6d8";
    c.beginPath();
    c.roundRect(bx, by, bw, 12, 6);
    c.fill();
    c.fillStyle = "#f6a93b";
    c.beginPath();
    c.roundRect(bx, by, Math.max(12, bw * left), 12, 6);
    c.fill();
}

function memoPlayDraw(g) {
    const c = memoCtx;
    // motylki — od najdalszych
    for (const f of [...g.flies].sort((a, b) => a.y - b.y)) {
        const cell = memoCell(f.color, clock - f.born, f.flee && clock < f.flee ? 4 : 2);
        if (!cell || clock < f.born) continue;
        let a = clamp((clock - f.born) / 350, 0, 1),
            s = 1;
        if (f.gone) {
            const t = clamp((clock - f.gone) / 400, 0, 1);
            a *= 1 - t;
            s = 1 + t * 0.5;
        }
        c.save();
        c.globalAlpha = a;
        c.translate(f.x, f.y);
        if (Math.cos(f.heading) < 0) c.scale(-1, 1);
        c.drawImage(cell, (-MEMO_SIZE * s) / 2, (-MEMO_SIZE * s) / 2, MEMO_SIZE * s, MEMO_SIZE * s);
        c.restore();
    }
    for (const e of g.effects) {
        const im = images[e.good ? "bubbleStar" : "bubbleWrong"];
        if (!im) continue;
        const t = clamp((clock - e.born) / 650, 0, 1),
            ease = 1 - Math.pow(1 - t, 3),
            size = 74 * (0.55 + ease * 0.7);
        c.save();
        c.globalAlpha = 1 - t * t;
        c.drawImage(im, e.x - size / 2, e.y - ease * 40 - size / 2, size, size);
        c.restore();
    }
    // panel: miejsca na motylki (po lewej) i szanse (po prawej)
    const n = g.seq.length,
        x = 14,
        y = 62,
        w = W - 28,
        h = 66,
        slot = 40,
        sgap = 8;
    memoPanel(c, x, y, w, h);
    for (let i = 0; i < n; i++) {
        const sx = x + 14 + i * (slot + sgap),
            sy = y + (h - slot) / 2,
            on = i < g.step,
            next = i === g.step;
        c.fillStyle = on ? "#e3f4d3" : "#ece6d8";
        c.strokeStyle = on ? "#6f9a52" : next ? "#f6a93b" : "#cfc6b0";
        c.lineWidth = next ? 3 : 2;
        c.beginPath();
        c.roundRect(sx, sy, slot, slot, 10);
        c.fill();
        c.stroke();
        if (on) {
            const cell = memoCell(g.seq[i], clock);
            if (cell) c.drawImage(cell, sx - 11, sy - 11, slot + 22, slot + 22);
        } else {
            c.fillStyle = "#b9b09a";
            c.font = "800 22px system-ui, sans-serif";
            c.textAlign = "center";
            c.fillText("?", sx + slot / 2, sy + slot / 2 + 8);
        }
    }
    for (let i = 0; i < MEMO_LIVES; i++) memoHeart(c, x + w - 24 - (MEMO_LIVES - 1 - i) * 30, y + h / 2, 24, i < g.lives);
}

memoCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || phase !== "memo-game" || !memoGame) return;
    const r = memoCanvas.getBoundingClientRect();
    memoHit(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
});
