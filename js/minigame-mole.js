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
    if (g.won) return "Brawo! Złapałeś wszystkie krety! 🐦";
    if (g.caught === 0) return "Znajdź kreta!";
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
    // Max duże — ledwo mieszczą się między sąsiadami (patrz buildMoleHoles).
    MOLE_HOLE_SIZE = 92,
    MOLE_HIT_PAD = 14,
    MOLE_GIVE_UP = 120000, // bez trafienia ani jednego kreta przez tyle ms -> koniec
    MOLE_FRAME_MS = 85, // bazowe tempo klatki wyłaniania/chowania (przed trudnością)
    MOLE_HOLD_BASE = 1500, // bazowy czas "czujności" (ile kret stoi w pełni na wierzchu)
    MOLE_SPAWN_GAP_MIN = 260,
    MOLE_SPAWN_GAP_MAX = 650,
    MOLE_COLS = 3,
    MOLE_ROWS = 4,
    MOLE_MARGIN_X = 20,
    MOLE_MARGIN_Y = 18,
    // Ile trwa świętowanie w OKNIE gry po złapaniu kompletu (ptaszek +
    // konfetti), zanim dopiero wtedy przechodzimy do wspólnego popupu z
    // nagrodą — żeby gra nie "wyłączała się" nagle.
    MOLE_WIN_CELEBRATE_MS = 1400;

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

// Losuje tempo i "rodzaj" dla kolejnego kreta.
// Tempo: im więcej już złapanych, tym szybciej (trudniej), plus spory
// element losowości (szerszy zakres niż na początku) — żeby kolejne krety
// naprawdę różniły się tempem wychylania/chowania, nie tylko nieznacznie.
// Rodzaj: zwykły kret (najczęściej), "błyskawica" (rzadka, bardzo krótko
// na wierzchu, +2 za trafienie, świeci iskierkami) i "błyskawica x2"
// (bardzo rzadka, jeszcze krócej, +3) — patrz moleDrawSparkle().
function moleSpawnHole() {
    const g = moleGame,
        idleHoles = g.holes.filter((h) => h.state === "idle");
    if (!idleHoles.length) return;
    const h = idleHoles[Math.floor(Math.random() * idleHoles.length)],
        roll = Math.random(),
        kind = roll < 0.04 ? "lightning2" : roll < 0.22 ? "lightning" : "normal",
        kindMul = kind === "lightning2" ? 0.4 : kind === "lightning" ? 0.6 : 1,
        holdBase = kind === "lightning2" ? 360 : kind === "lightning" ? 580 : MOLE_HOLD_BASE,
        difficulty = 1 - (g.caught / g.need) * 0.3,
        mul = clamp(kindMul * difficulty * (0.5 + Math.random() * 1.1), 0.28, 1.6);
    h.kind = kind;
    h.flip = Math.random() < 0.5; // pysk w lewo/prawo — odbite klatki
    h.tempoMul = mul;
    h.emergeDur = numbers(CFG.kret.presets[1].seq).length * MOLE_FRAME_MS * mul;
    h.retreatDur = numbers(CFG.kret.presets[3].seq).length * MOLE_FRAME_MS * mul;
    // Czas "czujności" losowany NIEZALEŻNIE od tempa animacji, żeby krety
    // różniły się od siebie na dwa niezależne sposoby naraz.
    h.holdDur = clamp(holdBase * (0.75 + Math.random() * 0.6), 220, 1900);
    h.alertMs = Math.max(70, 140 * mul);
    h.hitRetreat = false;
    h.state = "emerging";
    h.stateStart = clock;
}

function moleGameUpdate(dt) {
    if (!moleGame) return;
    const g = moleGame;
    if (g.won) {
        // Świętowanie (ptaszek + konfetti w moleGameDraw) — krety
        // zamrożone, dopiero po nim przechodzimy do wspólnego popupu.
        if (clock - g.wonAt >= MOLE_WIN_CELEBRATE_MS) moleGameFinish(true);
        return;
    }
    const active = g.holes.some((h) => h.state !== "idle");
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

// Iskierki wokół "błyskawicy" (i mocniejsze, podkręcone kolorem, wokół
// "błyskawicy x2") — żeby dziecko od razu widziało, że ten kret jest
// wyjątkowy i szybko zniknie. Ponownie wykorzystuje gwiazdkę z baniek
// (images.bubbleStar), bez potrzeby nowej grafiki.
function moleDrawSparkle(h) {
    const im = images.bubbleStar;
    if (!im) return;
    const n = h.kind === "lightning2" ? 6 : 4,
        r = MOLE_HOLE_SIZE / 2 + 10,
        spin = clock / (h.kind === "lightning2" ? 220 : 320);
    mctx.save();
    if (h.kind === "lightning2") mctx.filter = "hue-rotate(210deg) saturate(1.4)";
    for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2,
            px = h.x + Math.cos(a) * r,
            py = h.y + Math.sin(a) * r * 0.7 - MOLE_HOLE_SIZE * 0.12,
            tw = 0.6 + 0.4 * Math.sin(clock / 90 + i * 1.7),
            size = (h.kind === "lightning2" ? 20 : 16) * tw;
        mctx.globalAlpha = 0.65 + 0.35 * tw;
        mctx.drawImage(im, px - size / 2, py - size / 2, size, size);
    }
    mctx.restore();
}

// Świętowanie po złapaniu kompletu — ptaszek na środku planszy + konfetti
// z tych samych gwiazdek. Trwa MOLE_WIN_CELEBRATE_MS, patrz
// moleGameUpdate(). Lista konfetti losowana raz (g.confetti), nie co klatkę.
function moleDrawCelebration(g) {
    const im = images.bubbleStar;
    if (!g.confetti) {
        g.confetti = [];
        for (let i = 0; i < 18; i++) {
            g.confetti.push({
                x: Math.random() * MOLE_W,
                y: Math.random() * MOLE_H,
                delay: Math.random() * 300,
                size: 14 + Math.random() * 22,
                drift: (Math.random() * 2 - 1) * 20,
                hue: Math.random() < 0.5,
            });
        }
    }
    const t = clock - g.wonAt;
    mctx.save();
    mctx.fillStyle = "rgba(255,255,255,0.22)";
    mctx.fillRect(0, 0, MOLE_W, MOLE_H);
    if (im) {
        for (const c of g.confetti) {
            const lt = clamp((t - c.delay) / 900, 0, 1);
            if (lt <= 0) continue;
            const alpha = lt < 0.8 ? 1 : 1 - (lt - 0.8) / 0.2,
                y = c.y - lt * 46,
                x = c.x + Math.sin(lt * Math.PI * 2) * c.drift,
                scale = 0.5 + lt * 0.7;
            mctx.save();
            mctx.globalAlpha = Math.max(0, alpha);
            if (c.hue) mctx.filter = "hue-rotate(160deg)";
            mctx.translate(x, y);
            mctx.rotate(lt * 2.2);
            mctx.drawImage(im, (-c.size * scale) / 2, (-c.size * scale) / 2, c.size * scale, c.size * scale);
            mctx.restore();
        }
    }
    mctx.font = "900 46px system-ui, sans-serif";
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";
    mctx.fillText("🐦", MOLE_W / 2, MOLE_H / 2 + Math.sin(clock / 180) * 6);
    mctx.restore();
}

function moleGameDraw() {
    if (!moleGame) return;
    mctx.clearRect(0, 0, MOLE_W, MOLE_H);
    const g = moleGame;
    for (const h of g.holes) {
        const fn = moleFrameFor(h),
            cell = cells.kret[fn - 1];
        if (!cell) continue;
        mctx.save();
        mctx.translate(h.x, h.y);
        if (h.flip) mctx.scale(-1, 1);
        mctx.drawImage(cell, -MOLE_HOLE_SIZE / 2, -MOLE_HOLE_SIZE / 2, MOLE_HOLE_SIZE, MOLE_HOLE_SIZE);
        mctx.restore();
        if ((h.state === "emerging" || h.state === "alert") && h.kind && h.kind !== "normal") moleDrawSparkle(h);
    }
    // Duże, czytelne "+1"/"+2"/"+3"/"−1" wyskakujące nad trafioną/pudłowaną
    // dziurą — żeby dziecko od razu widziało efekt swojego dotknięcia.
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
    if (g.won) moleDrawCelebration(g);
}

// Trafienie gdziekolwiek na .moleCanvas podczas gry. Liczy się tylko
// dotknięcie W OBRĘBIE jednej z 12 dziur — puste miejsce poza nimi nie daje
// ani punktu, ani kary (tak jak bańka, która po prostu uleciała).
function moleGameHit(px, py) {
    if (!moleGame || moleGame.won) return false;
    const g = moleGame;
    for (const h of g.holes) {
        const r = MOLE_HOLE_SIZE / 2 + MOLE_HIT_PAD;
        if (Math.hypot(px - h.x, py - h.y) > r) continue;
        if (h.state === "alert") {
            h.state = "retreating";
            h.stateStart = clock;
            h.hitRetreat = true;
            // "Błyskawica"/"błyskawica x2" warte więcej niż zwykły kret.
            const value = h.kind === "lightning2" ? 3 : h.kind === "lightning" ? 2 : 1;
            g.caught = Math.min(g.need, g.caught + value);
            g.effects.push({ x: h.x, y: h.y, born: clock, good: true, text: "+" + value });
            updateMoleUi();
            if (g.caught >= g.need) {
                g.won = true;
                g.wonAt = clock;
                updateMoleUi();
            }
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
