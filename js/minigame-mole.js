"use strict";
// ═══════════════════════════════════════════════════════════════
// KRET W OGRODZIE — mini-gra typu "uderz kreta" (whack-a-mole).
// Wydzielone z game-*.js dla czytelności (patrz też minigame-fetch.js,
// minigame-bubbles.js). Korzysta ze wspólnego stanu/funkcji
// zadeklarowanych w game-*.js (musi być wczytany PO game-*.js w
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
    if (g.won) return "Brawo! Złapałeś wszystkie krety! 🎉";
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
    // menu), tak samo jak przy myciu/baniekach. Gdy pokazuje się popup
    // wygranej (.moleWinPopup), gra jest już skończona — przycisk cofania
    // (schowany pod popupem) nie powinien nic robić.
    if (phase !== "mole-game" || !$("#moleWinPopup").hidden) return;
    moleGameFinish(false);
};

/* ── Pop-up z instrukcją przed startem — wzorzec jak .ballPopup ─── */
// dwa kafelki instrukcji dla obu gier z kretem: cały kret = dobrze, w połowie schowany = źle
function moleTutDraw(popup) {
    const put = (sel, f) => {
        const cv = $(popup + " " + sel),
            c = cv.getContext("2d");
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        if (cells.kret[f - 1]) c.drawImage(cells.kret[f - 1], 0, 0, cv.width, cv.height);
    };
    const em = numbers(CFG.kret.presets[1].seq);
    put(".moleTutFull", numbers(CFG.kret.presets[2].seq)[0]);
    put(".moleTutHalf", em[Math.round((em.length - 1) * 0.5)]);
}
let moleIntroResume = null;
function moleIntroShow(onOk) {
    moleIntroResume = onOk;
    moleTutDraw("#molePopup");
    $("#molePopup .moleIntroIcon").src = icons.mole;
    $("#molePopup").hidden = false;
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
$("#molePopup .moleOk").onclick = () => {
    $("#molePopup").hidden = true;
    const resume = moleIntroResume;
    moleIntroResume = null;
    resume?.();
};
$("#molePopup .moleCancel").onclick = () => {
    $("#molePopup").hidden = true;
    moleIntroResume = null;
    idle(16);
};

/* ── Siatka dziur — 3 kolumny × 4 rzędy = 12 kopczyków ───────────── */
const MOLE_NEED = 10,
    // Duże — grafika kreta ma dużo przezroczystego marginesu w komórce
    // arkusza (realna treść to ok. 87% szerokości/80% wysokości komórki),
    // więc nawet przy tym rozmiarze sąsiednie kopczyki wizualnie się nie
    // dotykają (patrz buildMoleHoles).
    MOLE_HOLE_SIZE = 104,
    MOLE_HIT_PAD = 14,
    MOLE_GIVE_UP = 1800000, // bezpiecznik: gra kończy się sama dopiero po 30 min
    MOLE_FRAME_MS = 70, // bazowe tempo klatki wyłaniania/chowania (przed trudnością)
    MOLE_HOLD_BASE = 780, // bazowy czas "czujności" (ile kret stoi w pełni na wierzchu)
    MOLE_EMERGE_CATCH_FROM = 0.35, // od jakiej części wychodzenia kret już się liczy
    MOLE_RETREAT_CATCH_UNTIL = 0.5, // do jakiej części chowania jeszcze się liczy
    MOLE_PEEK_CHANCE = 0.22, // jak często kret tylko wygląda do połowy i się chowa
    MOLE_SPAWN_GAP_MIN = 200,
    MOLE_SPAWN_GAP_MAX = 520,
    MOLE_COLS = 3,
    MOLE_ROWS = 4,
    MOLE_MARGIN_X = 0, // 348/3 = 116 i 464/4 = 116 → komórki są kwadratami 116×116
    MOLE_MARGIN_Y = 0;

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

// Podłoże planszy: nieregularne "linie ziemi i piasku" między kopcami —
// łamane o losowych zygzakach (ciemniejsza linia + jasny piasek tuż pod nią)
// i garść kamyków. Rysowane raz na grę do osobnego canvasu.
let moleGround = null;
function moleGroundBuild() {
    const cv = document.createElement("canvas");
    cv.width = MOLE_W;
    cv.height = MOLE_H;
    const c = cv.getContext("2d"),
        colGap = (MOLE_W - MOLE_MARGIN_X * 2) / MOLE_COLS,
        rowGap = (MOLE_H - MOLE_MARGIN_Y * 2) / MOLE_ROWS,
        rnd = (a, b) => a + Math.random() * (b - a);
    c.lineCap = "square";
    c.lineJoin = "miter";
    // jedna nieregularna linia od (x0,y0) do (x1,y1); wiggle = wychylenie w bok
    const crack = (x0, y0, x1, y1, wiggle) => {
        const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0),
            pts = [[x0, y0]];
        let t = 0;
        while (t < 1) {
            t = Math.min(1, t + rnd(0.05, 0.12));
            const off = t < 1 ? rnd(-wiggle, wiggle) : 0;
            pts.push(horiz ? [x0 + (x1 - x0) * t, y0 + off] : [x0 + off, y0 + (y1 - y0) * t]);
        }
        const draw = (dx, dy, col, w) => {
            c.strokeStyle = col;
            c.lineWidth = w;
            c.beginPath();
            pts.forEach(([x, y], i) => (i ? c.lineTo(Math.round(x + dx), Math.round(y + dy)) : c.moveTo(Math.round(x + dx), Math.round(y + dy))));
            c.stroke();
        };
        draw(0, 3, "rgba(236,214,150,0.55)", 3); // piasek pod/obok linii
        draw(0, 0, "rgba(58,102,38,0.55)", 3); // ciemniejsza szczelina w ziemi
        // krótkie odnogi
        for (let i = 1; i < pts.length - 1; i++) {
            if (Math.random() > 0.28) continue;
            const [x, y] = pts[i],
                len = rnd(8, 18),
                side = Math.random() < 0.5 ? -1 : 1;
            c.strokeStyle = "rgba(58,102,38,0.45)";
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(Math.round(x), Math.round(y));
            if (horiz) c.lineTo(Math.round(x + rnd(-6, 6)), Math.round(y + side * len));
            else c.lineTo(Math.round(x + side * len), Math.round(y + rnd(-6, 6)));
            c.stroke();
        }
    };
    for (let k = 1; k < MOLE_ROWS; k++) {
        const y = MOLE_MARGIN_Y + rowGap * k;
        crack(2, y, MOLE_W - 2, y, 5);
    }
    for (let k = 1; k < MOLE_COLS; k++) {
        const x = MOLE_MARGIN_X + colGap * k;
        crack(x, 2, x, MOLE_H - 2, 5);
    }
    // kamyki i ziarenka piasku
    for (let i = 0; i < 26; i++) {
        const x = Math.round(rnd(8, MOLE_W - 8)),
            y = Math.round(rnd(8, MOLE_H - 8)),
            r = Math.random() < 0.5 ? 3 : 5;
        c.fillStyle = Math.random() < 0.5 ? "rgba(236,214,150,0.6)" : "rgba(58,102,38,0.4)";
        c.fillRect(x, y, r, Math.max(2, r - 2));
    }
    return cv;
}

// Losuje tempo i "rodzaj" dla kolejnego kreta.
// Tempo: im więcej już złapanych, tym szybciej (trudniej), plus spory
// element losowości (szerszy zakres niż na początku) — żeby kolejne krety
// naprawdę różniły się tempem wychylania/chowania, nie tylko nieznacznie.
// Rodzaj: zwykły kret oraz szybsze ("lightning", "lightning2") — krócej na
// wierzchu. Nie są wyróżniane ani lepiej punktowane (każdy kret = +1),
// szybkość jest tylko utrudnieniem.
function moleSpawnHole() {
    const g = moleGame,
        idleHoles = g.holes.filter((h) => h.state === "idle");
    if (!idleHoles.length) return;
    const h = idleHoles[Math.floor(Math.random() * idleHoles.length)],
        roll = Math.random(),
        kind = roll < 0.04 ? "lightning2" : roll < 0.22 ? "lightning" : "normal",
        kindMul = kind === "lightning2" ? 0.4 : kind === "lightning" ? 0.6 : 1,
        holdBase = kind === "lightning2" ? 280 : kind === "lightning" ? 440 : MOLE_HOLD_BASE,
        difficulty = 1 - (g.caught / g.need) * 0.5,
        mul = clamp(kindMul * difficulty * (0.5 + Math.random() * 1.1), 0.26, 1.25);
    h.kind = kind;
    h.flip = Math.random() < 0.5; // pysk w lewo/prawo — odbite klatki
    h.tempoMul = mul;
    h.emergeDur = numbers(CFG.kret.presets[1].seq).length * MOLE_FRAME_MS * mul;
    h.retreatDur = numbers(CFG.kret.presets[3].seq).length * MOLE_FRAME_MS * mul;
    // Czas "czujności" losowany NIEZALEŻNIE od tempa animacji, żeby krety
    // różniły się od siebie na dwa niezależne sposoby naraz.
    h.holdDur = clamp(holdBase * (0.7 + Math.random() * 0.6), 220, 1400);
    h.alertMs = Math.max(70, 140 * mul);
    h.hitRetreat = false;
    // Zmyłka: kret wychodzi tylko do połowy i od razu się chowa — nie da się
    // go złapać (i nie karzemy za dotknięcie). Nie na samym początku gry.
    g.spawnCount = (g.spawnCount || 0) + 1;
    if (g.spawnCount > 2 && Math.random() < MOLE_PEEK_CHANCE) {
        h.kind = "normal";
        h.peekDur = h.emergeDur * 1.5 + 120;
        h.state = "peek";
        h.stateStart = clock;
        return;
    }
    h.state = "emerging";
    h.stateStart = clock;
}

function moleGameUpdate(dt) {
    if (!moleGame) return;
    const g = moleGame;
    // Po wygranej krety zamrożone — popup wygranej (.moleWinPopup, patrz
    // moleWinShow()) rządzi dalej; moleGameFinish() woła dopiero jego
    // przycisk "Super!".
    if (g.won) return;
    const active = g.holes.some((h) => h.state !== "idle");
    if (!active && g.caught < g.need && clock >= (g.nextSpawn || 0)) moleSpawnHole();
    for (const h of g.holes) {
        if (h.state === "peek") {
            if (clock - h.stateStart >= h.peekDur) {
                h.state = "idle";
                g.nextSpawn = clock + MOLE_SPAWN_GAP_MIN + Math.random() * (MOLE_SPAWN_GAP_MAX - MOLE_SPAWN_GAP_MIN);
            }
        } else if (h.state === "emerging") {
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
    if (h.state === "peek") {
        // Klatki wychodzenia do ~połowy i z powrotem (sinus po sekwencji).
        const frames = numbers(CFG.kret.presets[1].seq),
            p = clamp((clock - h.stateStart) / h.peekDur, 0, 1),
            fi = Math.min(frames.length - 1, Math.round(Math.sin(p * Math.PI) * (frames.length - 1) * 0.5));
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
    if (moleGround) mctx.drawImage(moleGround, 0, 0);
    for (const h of g.holes) {
        const fn = moleFrameFor(h),
            cell = cells.kret[fn - 1];
        if (!cell) continue;
        mctx.save();
        mctx.translate(h.x, h.y);
        if (h.flip) mctx.scale(-1, 1);
        mctx.drawImage(cell, -MOLE_HOLE_SIZE / 2, -MOLE_HOLE_SIZE / 2, MOLE_HOLE_SIZE, MOLE_HOLE_SIZE);
        mctx.restore();
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
        mctx.font = "900 32px 'Baloo 2', Nunito, system-ui, sans-serif";
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
    if (!moleGame || moleGame.won) return false;
    const g = moleGame;
    for (const h of g.holes) {
        const r = MOLE_HOLE_SIZE / 2 + MOLE_HIT_PAD;
        if (Math.hypot(px - h.x, py - h.y) > r) continue;
        // Czy kret jest WIDOCZNIE na wierzchu? Liczymy nie tylko pełną
        // "czujność", ale też drugą część wychodzenia i pierwszą część
        // chowania — inaczej wolno wychodzący kret, wyraźnie już widoczny,
        // dawał −1 ("za wcześnie").
        const el = clock - h.stateStart,
            visible =
                h.state === "alert" ||
                (h.state === "emerging" && el >= h.emergeDur * MOLE_EMERGE_CATCH_FROM) ||
                (h.state === "retreating" && !h.hitRetreat && el <= h.retreatDur * MOLE_RETREAT_CATCH_UNTIL);
        if (visible) {
            h.state = "retreating";
            h.stateStart = clock;
            h.hitRetreat = true;
            // Każdy kret = +1 (szybkość to tylko utrudnienie).
            const value = 1;
            g.caught = Math.min(g.need, g.caught + value);
            g.effects.push({ x: h.x, y: h.y, born: clock, good: true, text: "+" + value });
            sfx("whack");
            updateMoleUi();
            if (g.caught >= g.need) {
                g.won = true;
                g.wonAt = clock;
                updateMoleUi();
                moleWinShow();
            }
        } else if (h.state === "idle") {
            // −1 tylko za stuknięcie w pusty kopiec (nie ma tam kreta).
            g.caught = Math.max(0, g.caught - 1);
            g.effects.push({ x: h.x, y: h.y, born: clock, good: false, text: "−1" });
            sfx("minus");
            updateMoleUi();
        }
        // Pozostałe: zmyłka (peek), sam początek wychodzenia, koniec chowania
        // albo drugie stuknięcie w już złapanego kreta — bez punktu i bez kary.
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
// Wejście z zapowiedzi na Łące (patrz moleTeaserTap() w game-wildlife.js) — te same
// ograniczenia co przy aporcie/zabawie z budą (fun/den w activity()):
// zbyt spragniony/niewyspany piesek najpierw potrzebuje tamtego, a kupka w
// pokoju blokuje każdą aktywność. Sprawdzane TU, przed pokazaniem pop-upu
// z instrukcją — tak jak przy aporcie te same sprawdzenia robi activity()
// zanim w ogóle pokaże ballIntroShow().
function moleTryStart() {
    if (sadBlocks("games")) return sadRefuse(); // smutny piesek nie chce się bawić
    if (!gameEntryOk()) return;
    if (dirty()) return refuseWith("poop"); // „NIE” + pulsująca kupka
    // potrzeby pilnuje smutek (≤10%) — gameEntryOk() / sadBlocks("games")
    moleIntroShow(moleStart);
}

// Właściwy start — wywoływane jako "resume" z moleIntroShow() PO kliknięciu
// "Zaczynamy!". W tym momencie phase to już celowo "mole-intro" (nie
// "casual"), więc bez ponownego sprawdzania warunków tutaj — tak samo jak
// przy fetchStart()/bubbleStart() (sprawdzenia są wcześniej, w
// moleTryStart()/activity()).
function moleStart() {
    moleGround = moleGroundBuild();
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

// Popup wygranej — puchar (ikonka "cup" z latka-ikony, niewykorzystana
// gdzie indziej) + zielony "ok-check" (NIE ptaszek — patrz dyskusja) +
// konfetti. Zastępuje poprzednie świętowanie rysowane na mctx.
const MOLE_CONFETTI_COLORS = ["#f6c445", "#6f9a52", "#9674ab", "#e98a71", "#4fb3bf"];
function moleWinSpawnConfetti(sel = "#moleWinPopup .moleWinConfetti") {
    sfx("win");
    const box = $(sel);
    if (!box) return;
    box.innerHTML = "";
    for (let i = 0; i < 18; i++) {
        const s = document.createElement("span");
        s.style.left = Math.random() * 100 + "%";
        s.style.background = MOLE_CONFETTI_COLORS[Math.floor(Math.random() * MOLE_CONFETTI_COLORS.length)];
        s.style.animationDelay = Math.random() * 0.4 + "s";
        s.style.animationDuration = 1.1 + Math.random() * 0.8 + "s";
        box.appendChild(s);
    }
}
function moleWinShow() {
    moleWinT0 = clock;
    moleWinSpawnConfetti();
    $("#moleWinPopup").hidden = false;
}
$("#moleWinPopup .moleWinAgain").onclick = () => {
    $("#moleWinPopup").hidden = true;
    moleGameFinish(true);
    moleStart();
};
$("#moleWinPopup .moleWinOk").onclick = () => {
    $("#moleWinPopup").hidden = true;
    moleGameFinish(true);
};

function moleGameFinish(rewarded) {
    const got = rewarded && moleGame && moleGame.caught > 0;
    moleGame = null;
    // Chwila wytchnienia po wyjściu z mini-gry — zanim świat zacznie znowu
    // "żyć" (nowy kret, motylki), żeby nie wyskakiwały natychmiast po
    // powrocie (patrz prośba użytkownika — "daj jakiś czas pauzy").
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    if (got) {
        // Karta wygranej (.moleWinPopup) już była nagrodą — bez drugiego popupu.
        changeNeeds(ACTION_EFFECTS.mole);
        save();
        idle(16);
    } else idle(16);
}

// Karta wygranej: zamiast pucharu — kret wychodzi z kopca, rozgląda się i
// chowa; po chwili przerwy znów (pętla).
let moleWinT0 = 0;
const moleWinCtx = $("#moleWinPopup .moleWinMole").getContext("2d");
function moleWinDraw() {
    if ($("#moleWinPopup").hidden || !cells.kret.length) return;
    const emerge = numbers(CFG.kret.presets[1].seq),
        look = numbers(CFG.kret.presets[2].seq),
        back = numbers(CFG.kret.presets[3].seq),
        eMs = emerge.length * 110,
        lMs = 1700,
        bMs = back.length * 110,
        gap = 1100,
        t = (clock - moleWinT0) % (eMs + lMs + bMs + gap);
    let fn = numbers(CFG.kret.presets[0].seq)[0];
    if (t < eMs) fn = emerge[Math.min(emerge.length - 1, Math.floor(t / 110))];
    else if (t < eMs + lMs) fn = look[Math.floor((t - eMs) / 160) % look.length];
    else if (t < eMs + lMs + bMs) fn = back[Math.min(back.length - 1, Math.floor((t - eMs - lMs) / 110))];
    moleWinCtx.clearRect(0, 0, 200, 200);
    moleWinCtx.imageSmoothingEnabled = false;
    if (cells.kret[fn - 1]) moleWinCtx.drawImage(cells.kret[fn - 1], 0, 0, 200, 200);
}
