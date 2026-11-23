"use strict";
// ═══════════════════════════════════════════════════════════════
// KRETY NA ŁĄCE — druga wersja gry z kretem. Bez siatki: na trawie Łąki w
// losowych miejscach wyrastają kopce, z nich wychodzą krety, chowają się,
// a kopce znikają. Stuknij kreta, gdy jest widoczny: +1. Cel: 10.
// Tło to ta sama grafika Łąki co w grze z jeżykiem (hedgeBg()).
// Zasady trafień jak w Kretowisku: −1 tylko za stuknięcie w kopiec, z
// którego kret jeszcze nie wyszedł; zmyłki (kret do połowy) bez kary.
// Wczytywany PO minigame-mole.js i minigame-hedge.js.
// ═══════════════════════════════════════════════════════════════

let mole2Game = null;

const m2ctx = $(".mole2Canvas").getContext("2d"),
    mole2Canvas = $(".mole2Canvas"),
    MOLE2_NEED = 10,
    MOLE2_SIZE = 124,
    MOLE2_ZONE = { x0: 64, x1: W - 64, y0: 400, y1: H - 86 }, // trawa
    MOLE2_MIN_DIST = 118,
    MOLE2_FRAME_MS = 62,
    MOLE2_APPEAR_MS = 260, // kopiec wyrasta
    MOLE2_MOUND_WAIT = [150, 450], // sam kopiec przed wyjściem kreta
    MOLE2_HOLD = [950, 480], // liczy się tylko kret w pełni wyjęty // czas na wierzchu: start → koniec gry
    MOLE2_VANISH_MS = 380, // kopiec znika
    MOLE2_PEEK_CHANCE = 0.2,
    MOLE2_DECOYS = [1, 3], // ile atrap (pustych kopców) naraz: start → koniec gry
    MOLE2_DECOY_LIFE = [1100, 2000], // jak długo stoi atrapa
    MOLE2_NEXT_GAP = [180, 520]; // przerwa po zniknięciu prawdziwego kopca

function mole2Seq(i) {
    return numbers(CFG.kret.presets[i].seq);
}

// ── Pop-up z instrukcją ──────────────────────────────────────────
let mole2IntroResume = null;
function mole2TryStart() {
    if (sadBlocks("games")) return sadRefuse(); // smutny piesek nie chce się bawić
    if (!gameEntryOk()) return;
    // potrzeby pilnuje smutek (≤10%) — gameEntryOk() / sadBlocks("games")
    mole2IntroResume = mole2Start;
    $("#mole2Popup .moleIntroIcon").src = icons.mole;
    $("#mole2Popup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "mole2-intro";
                stage = "mole2-intro";
                locks();
            },
        },
    ]);
}
$("#mole2Popup .moleOk").onclick = () => {
    $("#mole2Popup").hidden = true;
    const r = mole2IntroResume;
    mole2IntroResume = null;
    r?.();
};
$("#mole2Popup .moleCancel").onclick = () => {
    $("#mole2Popup").hidden = true;
    mole2IntroResume = null;
    idle(16);
};

// ── Start / koniec ───────────────────────────────────────────────
function mole2Start() {
    mole2Game = { need: MOLE2_NEED, caught: 0, mounds: [], effects: [], nextSpawn: clock + 600, nextDecoy: clock + 3000, spawned: 0, won: false };
    say("fun", 1500);
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000, // bezpiecznik 30 min
            onStart: () => {
                phase = "mole2-game";
                stage = "mole2-game";
                locks();
            },
            onEnd: () => mole2Finish(false),
        },
    ]);
    $(".mole2Full").hidden = false;
    save();
}

$(".mole2Close").onclick = () => {
    if (phase === "mole2-game") mole2Finish(false);
};

function mole2Finish(rewarded) {
    const got = rewarded && mole2Game && mole2Game.caught > 0;
    mole2Game = null;
    $(".mole2Full").hidden = true;
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    if (got) {
        changeNeeds(ACTION_EFFECTS.mole);
        save();
    }
    idle(16);
}

// ── Karta końcowa (kret wychodzi i chowa się w pętli) ────────────
let mole2WinT0 = 0;
const mole2WinCtx = $("#mole2WinPopup .moleWinMole").getContext("2d");
function mole2WinShow() {
    const g = mole2Game;
    if (!g || g.won) return;
    g.won = true;
    g.mounds.length = 0;
    phase = "mole2-win";
    stage = "mole2-win";
    mole2WinT0 = clock;
    locks();
    moleWinSpawnConfetti("#mole2WinPopup .moleWinConfetti");
    $("#mole2WinPopup").hidden = false;
}
$("#mole2WinPopup .moleWinOk").onclick = () => {
    $("#mole2WinPopup").hidden = true;
    mole2Finish(true);
};
$("#mole2WinPopup .winAgain").onclick = () => {
    $("#mole2WinPopup").hidden = true;
    mole2Finish(true);
    mole2Start();
};
function mole2WinDraw() {
    if ($("#mole2WinPopup").hidden || !cells.kret.length) return;
    const e = mole2Seq(1),
        l = mole2Seq(2),
        b = mole2Seq(3),
        eMs = e.length * 110,
        lMs = 1700,
        bMs = b.length * 110,
        t = (clock - mole2WinT0) % (eMs + lMs + bMs + 1100);
    let fn = mole2Seq(0)[0];
    if (t < eMs) fn = e[Math.min(e.length - 1, Math.floor(t / 110))];
    else if (t < eMs + lMs) fn = l[Math.floor((t - eMs) / 160) % l.length];
    else if (t < eMs + lMs + bMs) fn = b[Math.min(b.length - 1, Math.floor((t - eMs - lMs) / 110))];
    mole2WinCtx.clearRect(0, 0, 200, 200);
    mole2WinCtx.imageSmoothingEnabled = false;
    if (cells.kret[fn - 1]) mole2WinCtx.drawImage(cells.kret[fn - 1], 0, 0, 200, 200);
}

// ── Przebieg gry ─────────────────────────────────────────────────
function mole2Progress(g) {
    return g.caught / g.need;
}

function mole2Spawn(decoy = false) {
    const g = mole2Game,
        pr = mole2Progress(g);
    let x = 0,
        y = 0;
    for (let i = 0; i < 20; i++) {
        x = MOLE2_ZONE.x0 + Math.random() * (MOLE2_ZONE.x1 - MOLE2_ZONE.x0);
        y = MOLE2_ZONE.y0 + Math.random() * (MOLE2_ZONE.y1 - MOLE2_ZONE.y0);
        if (g.mounds.every((m) => Math.hypot(m.x - x, m.y - y) >= MOLE2_MIN_DIST)) break;
    }
    if (!decoy) g.spawned++;
    const flash = !decoy && g.spawned > 1 && Math.random() < 0.28, // błyskawiczny: ledwo stoi i znika
        hold = MOLE2_HOLD[0] + (MOLE2_HOLD[1] - MOLE2_HOLD[0]) * pr;
    g.mounds.push({
        x,
        y,
        state: "appear",
        stateStart: clock,
        decoy,
        wait: decoy
            ? MOLE2_DECOY_LIFE[0] + Math.random() * (MOLE2_DECOY_LIFE[1] - MOLE2_DECOY_LIFE[0])
            : MOLE2_MOUND_WAIT[0] + Math.random() * (MOLE2_MOUND_WAIT[1] - MOLE2_MOUND_WAIT[0]),
        hold: Math.max(260, hold * (flash ? 0.35 : 0.7 + Math.random() * 0.6)),
        peek: decoy ? Math.random() < 0.55 : g.spawned > 2 && Math.random() < MOLE2_PEEK_CHANCE, // atrapy też często "wyglądają" do połowy
        emergeDur: mole2Seq(1).length * MOLE2_FRAME_MS * (Math.random() < 0.3 ? 1.6 : 1), // czasem wolniej
        retreatDur: mole2Seq(3).length * MOLE2_FRAME_MS * (flash ? 0.5 : 0.8 + Math.random() * 0.8),
        caught: false,
    });
}

function mole2GameUpdate() {
    const g = mole2Game;
    if (!g || g.won) return;
    const pr = mole2Progress(g),
        realLeft = g.mounds.some((m) => !m.decoy),
        decoys = g.mounds.filter((m) => m.decoy).length,
        maxDecoys = Math.round(MOLE2_DECOYS[0] + (MOLE2_DECOYS[1] - MOLE2_DECOYS[0]) * pr);
    // prawdziwy kopiec: dopiero gdy poprzedni zniknął (złapany albo schowany)
    if (!realLeft && clock >= g.nextSpawn) mole2Spawn();
    // atrapy: puste kopce, z których nic nie wyjdzie — stuknięcie = −1
    // od 3. kreta, często — do 3 atrap naraz pod koniec gry
    if (clock >= g.nextDecoy && g.spawned > 2) {
        if (decoys < maxDecoys && Math.random() < 0.85) mole2Spawn(true);
        g.nextDecoy = clock + 900 + Math.random() * 1500;
    }
    for (let i = g.mounds.length - 1; i >= 0; i--) {
        const m = g.mounds[i],
            el = clock - m.stateStart,
            go = (s) => {
                m.state = s;
                m.stateStart = clock;
            };
        if (m.state === "appear" && el >= MOLE2_APPEAR_MS + m.wait) go(m.peek ? "peek" : m.decoy ? "vanish" : "emerging");
        else if (m.state === "peek" && el >= m.emergeDur * 1.5 + 120) go("vanish");
        else if (m.state === "emerging" && el >= m.emergeDur) go("alert");
        else if (m.state === "alert" && el >= m.hold) go("retreating");
        else if (m.state === "retreating" && el >= m.retreatDur) go("vanish");
        else if (m.state === "vanish" && el >= MOLE2_VANISH_MS) {
            g.mounds.splice(i, 1);
            if (!m.decoy) g.nextSpawn = clock + MOLE2_NEXT_GAP[0] + Math.random() * (MOLE2_NEXT_GAP[1] - MOLE2_NEXT_GAP[0]);
        }
    }
    for (let i = g.effects.length - 1; i >= 0; i--) if (clock - g.effects[i].born > 650) g.effects.splice(i, 1);
}

function mole2Frame(m) {
    const el = clock - m.stateStart;
    if (m.state === "appear" || m.state === "vanish") return mole2Seq(0)[0];
    if (m.state === "emerging") {
        const f = mole2Seq(1);
        return f[Math.min(f.length - 1, Math.floor((el / m.emergeDur) * f.length))];
    }
    if (m.state === "alert") {
        const f = mole2Seq(2);
        return f[Math.floor(el / 160) % f.length];
    }
    if (m.state === "retreating") {
        const f = mole2Seq(3);
        return f[Math.min(f.length - 1, Math.floor((el / m.retreatDur) * f.length))];
    }
    if (m.state === "peek") {
        const f = mole2Seq(1),
            p = clamp(el / (m.emergeDur * 1.5 + 120), 0, 1);
        return f[Math.min(f.length - 1, Math.round(Math.sin(p * Math.PI) * (f.length - 1) * 0.5))];
    }
    return mole2Seq(0)[0];
}

function mole2Hit(px, py) {
    const g = mole2Game;
    if (!g || g.won) return;
    // najbliższy kopiec w zasięgu (od przodu — większe y wyżej w kolejności)
    let best = null,
        bd = 1e9;
    for (const m of g.mounds) {
        const d = Math.hypot(px - m.x, py - (m.y - MOLE2_SIZE * 0.12));
        if (d <= MOLE2_SIZE * 0.58 && d < bd) {
            best = m;
            bd = d;
        }
    }
    if (!best) return;
    const m = best,
        el = clock - m.stateStart,
        // tylko kret w pełni wyjęty (alert) — wychodzący i chowający się nie liczą się
        visible = !m.caught && m.state === "alert";
    if (visible) {
        m.caught = true;
        m.state = "retreating";
        m.stateStart = clock;
        g.caught = Math.min(g.need, g.caught + 1);
        g.effects.push({ x: m.x, y: m.y - 40, born: clock, good: true });
        sfx("whack");
        if (g.caught >= g.need) mole2WinShow();
    } else if (!m.caught && clock - (m.penAt || -1e9) > 350) {
        // pusty kopiec, atrapa (też gasnąca), kopiec po niepewnym krecie albo kret
        // niewyjęty do końca (za wcześnie / za późno) = −1; 350 ms ochrony przed
        // podwójnym naliczeniem przy dwukrotnym stuknięciu
        m.penAt = clock;
        g.caught = Math.max(0, g.caught - 1);
        g.effects.push({ x: m.x, y: m.y - 40, born: clock, good: false });
        sfx("minus");
        if (m.decoy) {
            m.state = "vanish";
            m.stateStart = clock;
        }
    }
}

function mole2GameDraw() {
    const g = mole2Game;
    if (!g) return;
    const c = m2ctx;
    c.imageSmoothingEnabled = false;
    const bg = hedgeBg();
    c.fillStyle = bg.fill;
    c.fillRect(0, 0, W, H);
    if (bg.img.complete && bg.img.naturalWidth) c.drawImage(bg.img, 0, 0, W, (W * bg.img.naturalHeight) / bg.img.naturalWidth);
    // kopce od najdalszych (mniejsze y) do najbliższych
    for (const m of [...g.mounds].sort((a, b) => a.y - b.y)) {
        const cell = cells.kret[mole2Frame(m) - 1];
        if (!cell) continue;
        const el = clock - m.stateStart;
        let s = 1,
            a = 1;
        if (m.state === "appear") {
            const t = clamp(el / MOLE2_APPEAR_MS, 0, 1);
            s = 0.35 + 0.65 * (1 - Math.pow(1 - t, 3));
            a = t;
        } else if (m.state === "vanish") {
            const t = clamp(el / MOLE2_VANISH_MS, 0, 1);
            s = 1 - 0.55 * t;
            a = 1 - t;
        }
        const size = MOLE2_SIZE * s;
        c.save();
        c.globalAlpha = a;
        c.drawImage(cell, m.x - size / 2, m.y - size * 0.62, size, size);
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
        c.font = "900 34px system-ui, sans-serif";
        c.textAlign = "center";
        c.lineJoin = "round";
        c.lineWidth = 6;
        c.strokeStyle = "#fff";
        c.fillStyle = e.good ? "#2f8f3d" : "#d9383a";
        c.strokeText(e.good ? "+1" : "−1", e.x, e.y - ease * 40 - size / 2 - 4);
        c.fillText(e.good ? "+1" : "−1", e.x, e.y - ease * 40 - size / 2 - 4);
        c.restore();
    }
    mole2PanelDraw(g);
}

function mole2PanelDraw(g) {
    const c = m2ctx,
        x = 14,
        y = 62,
        w = W - 28,
        h = 100,
        icon = cells.kret[mole2Seq(1).slice(-1)[0] - 1];
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
    // licznik: "Krety: 3 / 10"
    c.textAlign = "left";
    c.fillStyle = "#59485d";
    c.font = "800 15px system-ui, sans-serif";
    c.fillText("Złapane krety", x + 16, y + 26);
    c.textAlign = "right";
    c.font = "900 28px system-ui, sans-serif";
    c.fillText(g.caught + " / " + g.need, x + w - 16, y + 30);
    const slot = 28,
        gap = (w - 28 - g.need * slot) / (g.need - 1);
    for (let i = 0; i < g.need; i++) {
        const sx = x + 14 + i * (slot + gap),
            sy = y + 50,
            on = i < g.caught;
        c.fillStyle = on ? "#e3f4d3" : "#ece6d8";
        c.strokeStyle = on ? "#6f9a52" : "#cfc6b0";
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(sx, sy, slot, slot, 9);
        c.fill();
        c.stroke();
        if (on && icon) c.drawImage(icon, sx - 4, sy - 6, slot + 8, slot + 8);
    }
}

mole2Canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || phase !== "mole2-game" || !mole2Game) return;
    const r = mole2Canvas.getBoundingClientRect();
    mole2Hit(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
});
