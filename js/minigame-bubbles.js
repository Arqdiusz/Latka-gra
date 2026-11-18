"use strict";
// ═══════════════════════════════════════════════════════════════
// MYCIE — mini-gra w łapanie baniek.
// Wydzielone z game.js dla czytelności (patrz też minigame-fetch.js).
// Korzysta ze wspólnego stanu/funkcji zadeklarowanych w game.js
// (musi być wczytany PO game.js w index.html).
// ═══════════════════════════════════════════════════════════════

let bubbleGame = null; // { need, caught, bubbles:[], effects:[], nextSpawn, lastCatch }

// Licznik złapanych baniek — ikona + pasek postępu, bez tekstu — oraz
// niebieska "zasłona" na całym ekranie (efekt kąpieli) z przyciskiem X.
function updateBubbleUi() {
    const badge = $(".bubbleBadge"),
        full = $(".bubbleFull");
    if (!badge) return;
    const active = !!bubbleGame;
    badge.hidden = !active;
    if (full) full.hidden = !active;
    if (!active) {
        bctx.clearRect(0, 0, W, H);
        return;
    }
    badge.querySelector("img").src = icons.bubbles;
    badge.querySelector(".bubbleCountNow").textContent = bubbleGame.caught;
    badge.querySelector(".bubbleCountNeed").textContent = bubbleGame.need;
    badge.querySelector(".bar i").style.width = clamp((bubbleGame.caught / bubbleGame.need) * 100, 0, 100) + "%";
}

$(".bubbleClose").onclick = () => {
    // Wyjście z kąpieli przyciskiem X — bez nagrody (jak przerwanie przez menu).
    if (phase !== "bubble-game") return;
    bubbleGameFinish(false);
};

// ── Mini-gra: łapanie baniek podczas mycia ──────────────────────
// Nakładka na CAŁY ekran gry (nagłówek + scenka + dok), własny
// canvas (.bubbleCanvas) rysowany NAD niebieskim, półprzezroczystym
// tłem (.bubbleFull, czysty CSS, bańki są więc w pełni widoczne nad
// "wodą"). Bańki (losowy kształt z dwóch arkuszy — 40 wariantów, żeby
// było "chaotycznie") lecą w górę w różnym tempie, delikatnie
// "pływając" na boki (nie po prostej linii) i oddychając
// (spłaszczanie/rozszerzanie + powolne rośnięcie/malenie), żeby nie
// wyglądały jak sztywne obiekty. Tylko bańki z pulsującą białą
// ramką liczą się do zadania (tak jak przy piłce w aporcie) — reszta
// to "mydlane" fałszywki: złapanie ich nie daje punktu i pokazuje
// czerwony "zły ruch" zamiast gwiazdki.
const BUBBLE_NEED = 16,
    BUBBLE_GIVE_UP = 100000, // bez złapania dobrej bańki przez tyle ms -> koniec
    BUBBLE_MAX_ON_SCREEN = 11, // ekran ma być pełny baniek
    BUBBLE_BAD_CHANCE = 0.62, // dobrych mniej niż złych, ale nie trzeba długo czekać
    BUBBLE_MAX_BAD_STREAK = 3, // po max tylu złych pod rząd następna jest gwarantowanie dobra
    BUBBLE_FAST_CHANCE_GOOD = 0.78, // dobre-i-wolne mają być rzadkością
    BUBBLE_FAST_CHANCE_BAD = 0.45, // ale i złych szybkich jest więcej, dla chaosu
    BUBBLE_SPAWN_MIN = 140,
    BUBBLE_SPAWN_MAX = 380;

function bubbleSpawn() {
    if (!bubbleGame || bubbleGame.bubbles.length >= BUBBLE_MAX_ON_SCREEN || !cells.bubbles.length) return;
    const size = 56 + Math.random() * 78, // duże, różne wielkości
        baseX = 24 + size / 2 + Math.random() * (W - 48 - size),
        // Licznik złych pod rząd — zapobiega długim seriom złych baniek
        // (gracz nie powinien zbyt długo czekać na dobrą).
        forceGood = bubbleGame.badStreak >= BUBBLE_MAX_BAD_STREAK,
        good = forceGood || Math.random() > BUBBLE_BAD_CHANCE,
        fast = Math.random() < (good ? BUBBLE_FAST_CHANCE_GOOD : BUBBLE_FAST_CHANCE_BAD);
    bubbleGame.badStreak = good ? 0 : bubbleGame.badStreak + 1;
    bubbleGame.bubbles.push({
        cell: cells.bubbles[Math.floor(Math.random() * cells.bubbles.length)],
        baseX,
        x: baseX,
        y: H + size,
        size,
        vy: (fast ? 150 + Math.random() * 110 : 44 + Math.random() * 60), // część ucieka szybko
        wobbleAmp: 10 + Math.random() * 34, // żeby nie leciały po równej linii
        wobbleFreq: 1 + Math.random() * 1.7,
        phase: Math.random() * Math.PI * 2,
        squishPhase: Math.random() * Math.PI * 2,
        squishFreq: 2 + Math.random() * 2,
        pulsePhase: Math.random() * Math.PI * 2, // powolne "rośnie/maleje" całej bańki
        pulseFreq: 0.5 + Math.random() * 0.6,
        pulseAmp: 0.2 + Math.random() * 0.18,
        good,
        born: clock,
        popped: false,
    });
}

function bubbleGameUpdate(dt) {
    if (!bubbleGame) return;
    const g = bubbleGame;
    if (clock >= (g.nextSpawn || 0) && g.caught < g.need) {
        bubbleSpawn();
        g.nextSpawn = clock + BUBBLE_SPAWN_MIN + Math.random() * (BUBBLE_SPAWN_MAX - BUBBLE_SPAWN_MIN);
    }
    for (let i = g.bubbles.length - 1; i >= 0; i--) {
        const b = g.bubbles[i];
        const t = (clock - b.born) / 1000;
        b.y -= (b.vy * dt) / 1000;
        b.x = b.baseX + Math.sin(t * b.wobbleFreq + b.phase) * b.wobbleAmp;
        if (b.y < -b.size) g.bubbles.splice(i, 1); // uciekła poza ekran — bez kary
    }
    for (let i = g.effects.length - 1; i >= 0; i--) {
        if (clock - g.effects[i].born > 500) g.effects.splice(i, 1);
    }
}

function bubbleGameDraw() {
    if (!bubbleGame) return;
    bctx.clearRect(0, 0, W, H); // przezroczyste — niebieskie tło .bubbleFull prześwieca pod bańkami
    const g = bubbleGame;
    for (const b of g.bubbles) {
        const t = (clock - b.born) / 1000,
            squish = Math.sin(t * b.squishFreq + b.squishPhase) * 0.015, // bardzo lekkie "oddychanie" kształtu — główny efekt to pulseAmp (rośnie/maleje)
            pulse = 1 + Math.sin(t * b.pulseFreq + b.pulsePhase) * b.pulseAmp; // cała bańka rośnie/maleje
        bctx.save();
        bctx.translate(b.x, b.y);
        bctx.scale(pulse * (1 + squish), pulse * (1 - squish));
        bctx.drawImage(b.cell, -b.size / 2, -b.size / 2, b.size, b.size);
        bctx.restore();
        if (b.good) {
            // Ta sama pulsująca ramka co przy piłce w aporcie — tu to bańki do złapania.
            const ringPulse = 0.5 + 0.5 * Math.sin(clock / 180),
                r = b.size / 2 + 5 + ringPulse * 6,
                alpha = 0.45 + ringPulse * 0.5;
            bctx.save();
            bctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            bctx.lineWidth = 2.5;
            bctx.shadowColor = "rgba(255,255,255,0.7)";
            bctx.shadowBlur = 6;
            bctx.beginPath();
            bctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            bctx.stroke();
            bctx.restore();
        }
    }
    for (const e of g.effects) {
        const im = images[e.good ? "bubbleStar" : "bubbleWrong"];
        if (!im) continue;
        // Mały "pop": szybkie wyskoczenie z lekkim przerzutem (ease-out-back),
        // powolny dokręt obrotu w trakcie, plus losowy obrót/odbicie z
        // momentu trafienia — żeby efekt nie wyglądał identycznie co raz.
        const t = clamp((clock - e.born) / 500, 0, 1),
            ease = 1 - Math.pow(1 - t, 3),
            overshoot = Math.sin(ease * Math.PI) * 0.22,
            size = 70 * (0.55 + ease * 0.7 + overshoot),
            alpha = 1 - t * t,
            rot = e.rot + ease * 0.5 * e.flip;
        bctx.save();
        bctx.globalAlpha = alpha;
        bctx.translate(e.x, e.y);
        bctx.rotate(rot);
        bctx.scale(e.flip, 1);
        bctx.drawImage(im, -size / 2, -size / 2, size, size);
        bctx.restore();
    }
}

// Trafienie w bańkę (dotyk gdziekolwiek na ekranie podczas gry).
// Zwraca true, jeśli coś trafiono (żeby wywołujący wiedział, że to
// był tap w bańkę, a nie np. w psa/kupkę).
function bubbleGameHit(px, py) {
    if (!bubbleGame) return false;
    const g = bubbleGame;
    for (let i = g.bubbles.length - 1; i >= 0; i--) {
        const b = g.bubbles[i];
        const r = b.size / 2 + 12; // trochę większy obszar trafienia — łatwiej dla małego dziecka
        if (Math.hypot(px - b.x, py - b.y) > r) continue;
        g.bubbles.splice(i, 1);
        // Losowy obrót (15-45°, w obie strony) i czasem odbicie lustrzane —
        // żeby gwiazdka/dymek nie wyglądały identycznie przy każdym trafieniu.
        const rotDeg = (15 + Math.random() * 30) * (Math.random() < 0.5 ? -1 : 1);
        g.effects.push({
            x: b.x,
            y: b.y,
            born: clock,
            good: b.good,
            rot: (rotDeg * Math.PI) / 180,
            flip: Math.random() < 0.5 ? -1 : 1,
        });
        if (b.good) {
            g.caught++;
            updateBubbleUi();
            if (g.caught >= g.need) bubbleGameFinish(true);
        } else {
            // Złapanie złej bańki cofa postęp — trzeba uważać, nie tylko szybko klikać.
            g.caught = Math.max(0, g.caught - 1);
            updateBubbleUi();
        }
        return true;
    }
    return false;
}

function bubbleReadySegment() {
    return {
        sheet: "a01",
        anim: 14, // 15. Mycie / piana — w pętli przez całą mini-grę
        time: BUBBLE_GIVE_UP,
        onStart: () => {
            phase = "bubble-game";
            stage = "bubble-game";
            locks();
        },
        onEnd: () => bubbleGameFinish(!!bubbleGame && bubbleGame.caught > 0),
    };
}

/* ── Pop-up z instrukcją przed myciem — wzorzec jak .molePopup ──── */
let bubbleIntroResume = null;
function bubbleIntroShow(onOk) {
    bubbleIntroResume = onOk;
    $(".bubbleIntroIcon").src = icons.bubbles;
    const cell = cells.bubbles[0];
    document.querySelectorAll(".bubbleTut canvas").forEach((cv) => {
        const c = cv.getContext("2d");
        c.clearRect(0, 0, 72, 72);
        c.imageSmoothingEnabled = false;
        if (cell) c.drawImage(cell, 4, 4, 64, 64);
    });
    document.querySelectorAll(".bubbleTutMark").forEach((im, i) => (im.src = P.assets[i ? "bubbleWrong" : "bubbleStar"]));
    $(".bubblePopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 120000,
            onStart: () => {
                phase = "bubble-intro";
                stage = "bubble-intro";
                locks();
            },
        },
    ]);
}
$(".bubbleOk").onclick = () => {
    $(".bubblePopup").hidden = true;
    const resume = bubbleIntroResume;
    bubbleIntroResume = null;
    resume?.();
};
$(".bubbleCancel").onclick = () => {
    $(".bubblePopup").hidden = true;
    bubbleIntroResume = null;
    idle(16);
};

function bubbleStart() {
    bubbleGame = { need: BUBBLE_NEED, caught: 0, bubbles: [], effects: [], nextSpawn: 0, badStreak: 0 };
    say("clean", 1800);
    startQueue([bubbleReadySegment()]);
    save();
}

// Dotyk/przeciąganie po całym .bubbleCanvas (cały ekran gry) —
// niezależne od gestów głównego canvasu, bo nakładka żyje nad
// nagłówkiem i dokiem, nie tylko nad scenką.
function bubbleCanvasXY(e) {
    const r = bubbleCanvas.getBoundingClientRect();
    return {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * H,
    };
}
let bubblePointerId = null;
bubbleCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || phase !== "bubble-game") return;
    bubblePointerId = e.pointerId;
    const p = bubbleCanvasXY(e);
    bubbleGameHit(p.x, p.y);
    try {
        bubbleCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
bubbleCanvas.addEventListener("pointermove", (e) => {
    if (bubblePointerId !== e.pointerId || phase !== "bubble-game") return;
    const p = bubbleCanvasXY(e);
    bubbleGameHit(p.x, p.y); // przeciąganie łapie kolejne bańki po drodze
});
function bubblePointerEnd(e) {
    if (bubblePointerId !== e.pointerId) return;
    bubblePointerId = null;
    try {
        if (bubbleCanvas.hasPointerCapture(e.pointerId)) bubbleCanvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
}
bubbleCanvas.addEventListener("pointerup", bubblePointerEnd);
bubbleCanvas.addEventListener("pointercancel", bubblePointerEnd);

function bubbleGameFinish(rewarded) {
    const got = rewarded && bubbleGame && bubbleGame.caught > 0;
    bubbleGame = null;
    if (got) {
        phase = "activity";
        pending = "clean";
        locks();
        // Popup z nagrodą od razu po złapaniu kompletu baniek.
        $(".popup").hidden = false;
        $(".reward").src = icons.clean;
        startQueue([
            {
                sheet: "a01",
                anim: 16,
                time: 1800,
                onStart: () => {
                    changeNeeds(ACTION_EFFECTS.clean);
                    save();
                },
                onEnd: () => ($(".popup").hidden = true),
            },
        ]);
    } else idle(16);
}

