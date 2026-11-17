"use strict";
// ═══════════════════════════════════════════════════════════════
// KRET W OGRODZIE — mini-gra typu "uderz kreta" (whack-a-mole).
// Wydzielone z game.js dla czytelności (patrz też minigame-fetch.js,
// minigame-bubbles.js). Korzysta ze wspólnego stanu/funkcji
// zadeklarowanych w game.js (musi być wczytany PO game.js w
// index.html) — w tym z grafiki kreta (cells.kret, CFG.kret)
// wczytanej razem z motylkami w boot().
//
// W przeciwieństwie do mycia/aportu to NIE jest przezroczysta nakładka
// na scenę, tylko osobny, nieprzezroczysty "ekran" (.moleFull — własny
// nagłówek, karta postępu, plansza) — na wzór referencyjnego stylu
// użytkownika z innej jego gry.
// ═══════════════════════════════════════════════════════════════

let moleGame = null; // { need, caught, holes:[...], nextSpawn, effects:[] }
const moleCanvas = $(".moleCanvas"),
    mctx = moleCanvas.getContext("2d"),
    // Wewnętrzna rozdzielczość PLANSZY kreta — niezależna od głównej gry
    // (W/H=384/768), bo plansza to teraz tylko część ekranu (pod
    // nagłówkiem/kartą postępu/komunikatem), nie cały ekran. Proporcja
    // 3∶4 dopasowana do .moleBoard w CSS (aspect-ratio), więc bez
    // rozciągania.
    MOLE_W = 348,
    MOLE_H = 464;

// Komunikat pod kartą postępu — zachęca/informuje, jak w referencyjnym
// "Masz już 1! Szukaj następnego.".
function moleMessage(g) {
    if (!g) return "";
    if (g.caught === 0) return "Znajdź kreta!";
    if (g.caught >= g.need) return "Brawo, wszystkie złapane!";
    return `Masz już ${g.caught}! Szukaj następnego.`;
}

// Karta postępu: duża liczba "X / 10" + pasek 10 główek kreta (ikona
// "mole" z latka-ikony.png, ta sama co ikonka pokoju "Łąka"). Każda
// złapana główka przygasza — nieudane/spóźnione trafienie przywraca
// jedną z powrotem (patrz .caught w CSS).
function updateMoleUi() {
    const badge = $(".moleBadge"),
        full = $(".moleFull");
    if (!badge) return;
    const active = !!moleGame;
    if (full) full.hidden = !active;
    if (!active) {
        mctx.clearRect(0, 0, MOLE_W, MOLE_H);
        return;
    }
    $(".moleCountNow").textContent = moleGame.caught;
    $(".moleCountNeed").textContent = moleGame.need;
    $(".moleMsg").textContent = moleMessage(moleGame);
    badge.querySelectorAll("img").forEach((img, i) => {
        img.src = icons.mole;
        img.classList.toggle("caught", i < moleGame.caught);
    });
}

$(".moleBack").onclick = () => {
    // Wyjście przyciskiem cofania — bez nagrody (jak przerwanie przez
    // menu), tak samo jak przy myciu/baniekach.
    if (phase !== "mole-game") return;
    moleGameFinish(false);
};

/* ── Pop-up z instrukcją przed startem — wzorzec jak .ballPopup ─── */
let moleIntroResume = null;
function moleIntroShow(onOk) {
    moleIntroResume = onOk;
    $(".moleIntroIcon").src = icons.mole;
    $(".molePopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 120000,
            onStart: () => {
                phase = "mole-intro";
                stage = "mole-intro";
                locks();
            },
        },
    ]);
}
$(".moleOk").onclick = () => {
    $(".molePopup").hidden = true;
    const resume = moleIntroResume;
    moleIntroResume = null;
    resume?.();
};
$(".moleCancel").onclick = () => {
    $(".molePopup").hidden = true;
    moleIntroResume = null;
    idle(16);
};

/* ── Siatka dziur — 3 kolumny × 4 rzędy = 12 kopczyków ───────────── */
const MOLE_NEED = 10,
    MOLE_HOLE_SIZE = 78,
    MOLE_HIT_PAD = 16,
    MOLE_GIVE_UP = 120000, // bez trafienia ani jednego kreta przez tyle ms -> koniec
    MOLE_FRAME_MS = 85, // bazowe tempo klatki wyłaniania/chowania (przed trudnością)
    MOLE_HOLD_BASE = 1500, // bazowy czas "czujności" (ile kret stoi w pełni na wierzchu)
    MOLE_SPAWN_GAP_MIN = 260,
    MOLE_SPAWN_GAP_MAX = 650,
    MOLE_COLS = 3,
    MOLE_ROWS = 4,
    MOLE_MARGIN_X = 26,
    MOLE_MARGIN_Y = 22;

function buildMoleHoles() {
    const usableW = MOLE_W - MOLE_MARGIN_X * 2,
        usableH = MOLE_H - MOLE_MARGIN_Y * 2,
        colGap = usableW / MOLE_COLS,
        rowGap = usableH / MOLE_ROWS,
        holes = [];
    for (let r = 0; r < MOLE_ROWS; r++) {
        for (let c = 0; c < MOLE_COLS; c++) {
            holes.push({
                x: MOLE_MARGIN_X + colGap * (c + 0.5),
                y: MOLE_MARGIN_Y + rowGap * (r + 0.5),
                state: "idle",
                stateStart: 0,
            });
        }
    }
    return holes;
}

// Losuje tempo dla kolejnego kreta — im więcej już złapanych, tym szybciej
// (trudniej), plus losowość, żeby nie każdy kret miał to samo tempo (to
// jedyny mechanizm trudności, tak jak chciał użytkownik).
function moleSpawnHole() {
    const g = moleGame,
        idleHoles = g.holes.filter((h) => h.state === "idle");
    if (!idleHoles.length) return;
    const h = idleHoles[Math.floor(Math.random() * idleHoles.length)],
        difficulty = 1 - (g.caught / g.need) * 0.35,
        mul = clamp(difficulty * (0.7 + Math.random() * 0.6), 0.45, 1.3);
    h.tempoMul = mul;
    h.emergeDur = numbers(CFG.kret.presets[1].seq).length * MOLE_FRAME_MS * mul;
    h.retreatDur = numbers(CFG.kret.presets[3].seq).length * MOLE_FRAME_MS * mul;
    h.holdDur = clamp(MOLE_HOLD_BASE * mul, 550, 1700);
    h.alertMs = Math.max(90, 150 * mul);
    h.hitRetreat = false;
    h.state = "emerging";
    h.stateStart = clock;
}

function moleGameUpdate(dt) {
    if (!moleGame) return;
    const g = moleGame,
        active = g.holes.some((h) => h.state !== "idle");
    if (!active && g.caught < g.need && clock >= (g.nextSpawn || 0)) moleSpawnHole();
    for (const h of g.holes) {
        if (h.state === "emerging") {
            if (clock - h.stateStart >= h.emergeDur) {
                h.state = "alert";
                h.stateStart = clock;
            }
        } else if (h.state === "alert") {
            if (clock - h.stateStart >= h.holdDur) {
                h.state = "retreating";
                h.stateStart = clock;
            }
        } else if (h.state === "retreating") {
            const dur = h.hitRetreat ? h.retreatDur * 0.55 : h.retreatDur;
            if (clock - h.stateStart >= dur) {
                h.state = "idle";
                h.hitRetreat = false;
                g.nextSpawn = clock + MOLE_SPAWN_GAP_MIN + Math.random() * (MOLE_SPAWN_GAP_MAX - MOLE_SPAWN_GAP_MIN);
            }
        }
    }
    for (let i = g.effects.length - 1; i >= 0; i--) {
        if (clock - g.effects[i].born > 700) g.effects.splice(i, 1);
    }
}

function moleFrameFor(h) {
    if (h.state === "idle") return numbers(CFG.kret.presets[0].seq)[0];
    if (h.state === "alert") {
        const frames = numbers(CFG.kret.presets[2].seq),
            fi = Math.floor((clock - h.stateStart) / h.alertMs) % frames.length;
        return frames[fi];
    }
    const presetIdx = h.state === "emerging" ? 1 : 3,
        frames = numbers(CFG.kret.presets[presetIdx].seq),
        dur = h.state === "emerging" ? h.emergeDur : h.hitRetreat ? h.retreatDur * 0.55 : h.retreatDur,
        p = clamp((clock - h.stateStart) / dur, 0, 0.999),
        fi = Math.floor(p * frames.length);
    return frames[fi];
}

function moleGameDraw() {
    if (!moleGame) return;
    mctx.clearRect(0, 0, MOLE_W, MOLE_H);
    const g = moleGame;
    for (const h of g.holes) {
        const fn = moleFrameFor(h),
            cell = cells.kret[fn - 1];
        if (!cell) continue;
        mctx.drawImage(cell, h.x - MOLE_HOLE_SIZE / 2, h.y - MOLE_HOLE_SIZE / 2, MOLE_HOLE_SIZE, MOLE_HOLE_SIZE);
    }
    // Duże, czytelne "+1" / "−1" wyskakujące nad trafioną/pudłowaną dziurą
    // — żeby dziecko od razu widziało efekt swojego dotknięcia.
    for (const e of g.effects) {
        const t = clamp((clock - e.born) / 700, 0, 1),
            ease = 1 - Math.pow(1 - t, 3),
            dy = -ease * 36,
            alpha = 1 - t * t,
            scale = 0.6 + Math.min(1, ease * 1.6) * 0.5;
        mctx.save();
        mctx.globalAlpha = alpha;
        mctx.translate(e.x, e.y + dy);
        mctx.scale(scale, scale);
        mctx.font = "900 32px system-ui, sans-serif";
        mctx.textAlign = "center";
        mctx.textBaseline = "middle";
        mctx.lineJoin = "round";
        mctx.lineWidth = 6;
        mctx.strokeStyle = "#fff";
        mctx.strokeText(e.text, 0, 0);
        mctx.fillStyle = e.good ? "#2f8f3f" : "#c0453f";
        mctx.fillText(e.text, 0, 0);
        mctx.restore();
    }
}

// Trafienie gdziekolwiek na .moleCanvas podczas gry. Liczy się tylko
// dotknięcie W OBRĘBIE jednej z 12 dziur — puste miejsce poza nimi nie daje
// ani punktu, ani kary (tak jak bańka, która po prostu uleciała).
function moleGameHit(px, py) {
    if (!moleGame) return false;
    const g = moleGame;
    for (const h of g.holes) {
        const r = MOLE_HOLE_SIZE / 2 + MOLE_HIT_PAD;
        if (Math.hypot(px - h.x, py - h.y) > r) continue;
        if (h.state === "alert") {
            h.state = "retreating";
            h.stateStart = clock;
            h.hitRetreat = true;
            g.caught++;
            g.effects.push({ x: h.x, y: h.y, born: clock, good: true, text: "+1" });
            updateMoleUi();
            if (g.caught >= g.need) moleGameFinish(true);
        } else {
            // Puste miejsce (kopiec bez kreta) albo za wcześnie/za późno —
            // nieumiejętne trafienie cofa jeden już złapany postęp.
            g.caught = Math.max(0, g.caught - 1);
            g.effects.push({ x: h.x, y: h.y, born: clock, good: false, text: "−1" });
            updateMoleUi();
        }
        return true;
    }
    return false;
}

function moleReadySegment() {
    return {
        sheet: "a01",
        anim: 16, // 17. Spokojne stanie — cała gra toczy się na osobnym "ekranie" (.moleFull)
        time: MOLE_GIVE_UP,
        onStart: () => {
            phase = "mole-game";
            stage = "mole-game";
            locks();
        },
        onEnd: () => moleGameFinish(!!moleGame && moleGame.caught > 0),
    };
}

// ── Start zabawy ──────────────────────────────────────────────
// Wejście z zapowiedzi na Łące (patrz moleTeaserTap() w game.js) — te same
// ograniczenia co przy aporcie/zabawie z budą (fun/den w activity()):
// zbyt spragniony/niewyspany piesek najpierw potrzebuje tamtego, a kupka w
// pokoju blokuje każdą aktywność. Sprawdzane TU, przed pokazaniem pop-upu
// z instrukcją — tak jak przy aporcie te same sprawdzenia robi activity()
// zanim w ogóle pokaże ballIntroShow().
function moleTryStart() {
    if (!casual()) return;
    if (dirty()) {
        say("poop", 4500);
        toast("Najpierw posprzątaj kupkę w tym pomieszczeniu.");
        return;
    }
    if (stats.water < 15) {
        say("water", 3500);
        toast("Najpierw woda — Łatka jest spragniona.");
        return;
    }
    if (stats.sleep < 15) {
        say("sleep", 3500);
        toast("Łatka potrzebuje snu przed zabawą.");
        return;
    }
    moleIntroShow(moleStart);
}

// Właściwy start — wywoływane jako "resume" z moleIntroShow() PO kliknięciu
// "Zaczynamy!". W tym momencie phase to już celowo "mole-intro" (nie
// "casual"), więc bez ponownego sprawdzania warunków tutaj — tak samo jak
// przy fetchStart()/bubbleStart() (sprawdzenia są wcześniej, w
// moleTryStart()/activity()).
function moleStart() {
    moleGame = { need: MOLE_NEED, caught: 0, holes: buildMoleHoles(), nextSpawn: clock + 300, effects: [] };
    updateMoleUi();
    say("fun", 2200);
    startQueue([moleReadySegment()]);
    save();
}

// Dotyk/przeciąganie po całym .moleCanvas, niezależnie od gestów głównego
// canvasu — tak samo jak przy bańkach, ale przeliczone na wewnętrzną
// rozdzielczość PLANSZY (MOLE_W/MOLE_H), nie całej gry (W/H).
function moleCanvasXY(e) {
    const r = moleCanvas.getBoundingClientRect();
    return {
        x: ((e.clientX - r.left) / r.width) * MOLE_W,
        y: ((e.clientY - r.top) / r.height) * MOLE_H,
    };
}
let molePointerId = null;
moleCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || phase !== "mole-game") return;
    molePointerId = e.pointerId;
    const p = moleCanvasXY(e);
    moleGameHit(p.x, p.y);
    try {
        moleCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
function molePointerEnd(e) {
    if (molePointerId !== e.pointerId) return;
    molePointerId = null;
    try {
        if (moleCanvas.hasPointerCapture(e.pointerId)) moleCanvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
}
moleCanvas.addEventListener("pointerup", molePointerEnd);
moleCanvas.addEventListener("pointercancel", molePointerEnd);

function moleGameFinish(rewarded) {
    const got = rewarded && moleGame && moleGame.caught > 0;
    moleGame = null;
    if (got) {
        phase = "activity";
        pending = "fun";
        locks();
        $(".popup").hidden = false;
        $(".reward").src = icons.mole;
        startQueue([
            {
                sheet: "a01",
                anim: 16,
                time: 1800,
                onStart: () => {
                    changeNeeds(ACTION_EFFECTS.mole);
                    save();
                },
                onEnd: () => ($(".popup").hidden = true),
            },
        ]);
    } else idle(16);
}
