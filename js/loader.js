"use strict";
// ═══════════════════════════════════════════════════════════════
// EKRAN ŁADOWANIA I EKRAN STARTOWY — ładuje się jako pierwszy (przed resztą
// skryptów, które są "defer"), więc widać go od razu.
//
//  1. ŁADOWANIE: piesek biegnie po ogrodzie (tło zapętlone: niebo wolno, trawnik
//     szybko), zielony pasek postępu, logo „Mój mały JAMNICZEK” kołysze się na niebie.
//  2. PRZEJŚCIE (gdy gra gotowa): ogród zwalnia, piesek przechodzi z biegu w marsz
//     (tak jak w grze między pokojami), ogród staje, piesek idzie na środek; pasek zamienia się w duży przycisk „Kontynuuj”/„Graj”,
//     potem pojawia się mały „Zacznij od nowa”.
//  3. STARTOWY (może trwać długo): piesek losowo, animacjami z gry: stoi, merda ogonem,
//     kopie kostkę, przechodzi w inne miejsce (marsz/bieg) albo „łapie motylka” dokładnie
//     jak w evencie w grze (bez klikania); przez niebo lata motylek-tło (też jak w grze).
//
// „Zacznij od nowa” (po ostrzeżeniu) czyści zapis gry i odświeża stronę; blokada
// czasu dla rodzica (latka-sesja-v1) i wyciszenie zostają.
// game.js: loadScreen.progress(0..1), .ready() (obietnica rozwiązuje się po
// dotknięciu „Kontynuuj”/„Graj”), .error(msg).
// ═══════════════════════════════════════════════════════════════
(() => {
    const root = document.querySelector(".load"),
        cv = root.querySelector(".ldCv"),
        c = cv.getContext("2d"),
        sceneEl = root.querySelector(".ldScene"),
        lawnEl = root.querySelector(".ldLawn"),
        bar = root.querySelector(".ldBar"),
        fill = bar.querySelector("i"),
        msg = root.querySelector(".ldMsg"),
        go = root.querySelector(".ldGo"),
        newBtn = root.querySelector(".ldNew"),
        fsBtn = root.querySelector(".ldFs"),
        warn = root.querySelector(".ldWarn"),
        SAVE_KEY = "latkaGame0288",
        FS_KEY = "latka-fullscreen",
        // zapis, który „Zacznij od nowa” kasuje (blokada rodzica i dźwięk zostają)
        RESET_KEYS = [SAVE_KEY, "latka-potrzeby-v1", "latka-liczenie-v1", "memoLevelsDone", "memoTimes", "pairsLevelsDone", "pairsRecords"],
        U = cv.width / 100, // pikseli płótna na 1 cqw
        CELL = 128,
        // rysowanie pieska jak w grze: łapy na linii gruntu klatki (113 px z 128), skala 2,35×0,7
        // (bieg ×1,04), przesunięcia klatek z config.json; 1 px gry = 1/3,84 cqw
        GROUND_PX = 113,
        K = (2.35 * 0.7) / 3.84, // cqw na 1 px klatki
        FEET = 127, // wysokość łap na trawniku (cqw)
        V_RUN = 70, // cqw/s — bieg po ogrodzie (w grze 300 px/s ≈ 78 cqw/s)
        V_WALK = 15.6, // marsz (w grze 60 px/s)
        SKY = 0.2, // niebo przewija się wolniej niż trawnik
        PX = 3.84, // px gry na 1 cqw
        W = 384, // szerokość gry (px)
        GROUND_GAME = 425; // y łap w grze (px)
    // przesunięcia klatek [x, y, skala%] z data/config.json (tylko użyte klatki)
    const OFF = {"a01":{"25":[0,-1,100],"32":[0,-1,100]},"a02":{"66":[0,8,100],"71":[0,-4,100],"72":[0,-2,100]},"a03":{"24":[0,-6,100]}};

    // ── logo: JAMNICZEK literami różnej wielkości ──
    const SIZES = [0.8, 0.84, 1, 1, 0.72, 1.1, 1, 1, 1];
    // dopasuj szerokość „JAMNICZEK” do ekranu niezależnie od czcionki (Ranchers albo zastępcza)
    const fitLogo = () => {
        const l2 = root.querySelector(".ldL2");
        l2.style.fontSize = "";
        const max = root.clientWidth * 0.92,
            w = l2.scrollWidth;
        if (w > max) l2.style.fontSize = (17 * max) / w + "cqw";
    };
    root.querySelector(".ldL2").innerHTML = [...("JAMNICZEK")].map((ch, k) => '<i style="font-size:' + SIZES[k] * 100 + '%">' + ch + "</i>").join("");
    fitLogo();
    try {
        document.fonts.ready.then(fitLogo);
        document.fonts.addEventListener("loadingdone", fitLogo);
    } catch (_) {}

    // ── grafiki ──
    const IMG = {};
    const load = (key, src) => {
        const im = new Image();
        im.src = src;
        IMG[key] = im;
    };
    load("a01", "animacje/latka-animacje-01.png");
    load("a02", "animacje/latka-animacje-02-X.png");
    load("a03", "animacje/latka-animacje-03.png");
    load("mot", "animacje/motyle-001-animacje.png");
    // klatka (z wycięciem zielonego znacznika motylka, jak w grze) — z pamięcią podręczną
    const CELLS = {};
    function cell(sheet, f) {
        const k = sheet + f;
        if (CELLS[k]) return CELLS[k];
        const im = IMG[sheet];
        if (!im.complete || !im.naturalWidth) return null;
        const cc = document.createElement("canvas");
        cc.width = cc.height = CELL;
        const x = cc.getContext("2d");
        x.drawImage(im, ((f - 1) % 6) * CELL, Math.floor((f - 1) / 6) * CELL, CELL, CELL, 0, 0, CELL, CELL);
        let marker = null;
        if (sheet === "a02") {
            const d = x.getImageData(0, 0, CELL, CELL),
                p = d.data;
            let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
            for (let i = 0; i < p.length; i += 4) {
                if (p[i + 3] > 100 && p[i] < 60 && p[i + 1] > 180 && p[i + 2] < 110) {
                    const px = (i / 4) % CELL,
                        py = Math.floor(i / 4 / CELL);
                    x0 = Math.min(x0, px);
                    x1 = Math.max(x1, px);
                    y0 = Math.min(y0, py);
                    y1 = Math.max(y1, py);
                    p[i + 3] = 0;
                }
            }
            if (x1 >= 0) {
                marker = { x: (x0 + x1 + 1) / 2, y: (y0 + y1 + 1) / 2 };
                x.putImageData(d, 0, 0);
            }
        }
        return (CELLS[k] = { cv: cc, marker });
    }

    // ── animacje pieska — te same, co w grze (arkusz, klatki, czas klatki w ms) ──
    const A = {
        // bieg i marsz: klatki zależą od przebytej drogi (jak w grze: 36 px / 13 px na klatkę)
        run: { s: "a01", f: [3, 4, 9, 10], stride: 36 / PX, boost: 1.04 },
        walk: { s: "a01", f: [25, 26, 32], stride: 13 / PX },
        stand: { s: "a01", f: [63, 27, 63, 65, 63, 27, 65], ms: 380 }, // „17. Spokojne stanie”
        wag: { s: "a01", f: [63, 27, 63, 27, 63, 27, 63, 63], ms: 300 }, // stanie z merdaniem ogonem (WAG)
        dig1: { s: "a03", f: [10, 4, 9, 5, 1], ms: 333 }, // kopanie dołka
        dig2: { s: "a03", f: [14, 6, 13, 20, 12], ms: 220 }, // wykopuje kostkę
        play: { s: "a03", f: [17, 18, 24, 21, 23, 22, 16], ms: 333 }, // zabawa kostką
        chase: { s: "a02", f: [53, 54, 59, 60], ms: 220 }, // „15. Motyl — skoki i pogoń”
        nose: { s: "a02", f: [65, 66, 71, 72], ms: 280 }, // „18. Motyl — ląduje przy nosie”
    };
    // kolory motylków (arkusz 3×5, wiersz = kolor) — trzepot jak w grze: 180 ms / 2
    const BF_MS = 180;

    // ── stan ──
    let target = 0,
        shown = 0,
        ready = false,
        resolve = null,
        stopped = false,
        phase = "load", // load → brake → walk → idle
        pt = 0, // czas w bieżącej fazie (s)
        scroll = 0, // przesunięcie trawnika (cqw)
        v = V_RUN, // prędkość pieska względem ogrodu przy przewijaniu (cqw/s)
        dist = 0, // przebyta droga (cqw) — z niej klatki biegu/marszu
        dogX = 26,
        flip = false, // piesek zwrócony w lewo
        cur = A.run,
        curT = 0, // czas od początku bieżącej animacji (s)
        clockMs = 0,
        act = null, // bieżąca zabawa: { name, steps }
        si = 0, // numer kroku
        st = 0, // czas w kroku (s)
        lastAct = null,
        ev = null, // stan motylka do złapania
        hasSave = false,
        ambient = [],
        nextAmb = 3;
    try {
        hasSave = localStorage.getItem(SAVE_KEY) !== null;
    } catch (_) {}
    go.querySelector("span").textContent = hasSave ? "Kontynuuj" : "Graj";

    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)),
        eo = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3),
        lerp = (a, b, x) => a + (b - a) * x,
        clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
        yOf = (yg) => FEET + (yg - GROUND_GAME) / PX; // y z gry (px) → cqw ekranu
    const setAnim = (a) => {
        if (cur !== a) {
            cur = a;
            curT = 0;
        }
    };

    // ── geometria pieska (ta sama matematyka co drawDog/catchMarkerPos w grze) ──
    function geo(sheet, f, boost) {
        const o = OFF[sheet][f] || [0, 0, 100];
        return { k: (K * o[2]) / 100 * (boost || 1), ox: (o[0] * 2.35) / PX, oy: (o[1] * 2.35) / PX };
    }
    // punkt klatki (px klatki) → pozycja na ekranie (cqw)
    function world(sheet, f, boost, px, py) {
        const g = geo(sheet, f, boost);
        return { x: dogX + (flip ? -1 : 1) * ((px - CELL / 2) * g.k + g.ox), y: FEET + (py - GROUND_PX) * g.k + g.oy };
    }

    // ── ZABAWY: lista kroków; krok = animacja przez czas albo ruch / motylek ──
    const stepAnim = (anim, dur) => ({ k: "a", anim, dur });
    const ACT = {
        stand: { w: 2, make: () => [stepAnim(A.stand, 3.4)] },
        wag: { w: 2, make: () => [stepAnim(A.wag, 3.6)] },
        dig: { w: 2.5, make: () => [stepAnim(A.dig1, 1.7), stepAnim(A.dig2, 1.1), stepAnim(A.play, 2.3)] },
        move: {
            w: 3,
            make: () => {
                // przejście w inne miejsce: krótkie — marsz (60 px/s), dalsze — bieg (300 px/s), jak w grze
                let tx = 22 + Math.random() * 56;
                if (Math.abs(tx - dogX) < 12) tx = clamp(dogX + (dogX < 50 ? 1 : -1) * (12 + Math.random() * 20), 22, 78);
                return [{ k: "m", to: tx }];
            },
        },
        bfly: { w: 2.5, make: () => butterflySteps() },
    };

    // „Chwytanie motylka” jak w evencie w grze (bez klikania): piesek idzie pod ścianę, odwraca się,
    // z drugiej strony nadlatuje motylek, zawraca i ucieka, piesek skacze za nim i go łapie
    // na nosie, a motylek odlatuje. Liczby (prędkości, czasy, rozmiar 96,5 px) jak w game.js.
    const EV_SIZE = 96.5 / PX, // rozmiar motylka w evencie (cqw)
        EV_Y = 200, // linia lotu (y gry)
        EV_CROSS = 9000, // przelot przez ekran (ms)
        EV_V = 0.075, // px/ms — ucieczka spłoszonego
        EV_T = 700; // czas ucieczki do punktu pościgu (ms)
    function butterflySteps() {
        const toLeft = dogX < 50,
            dir = toLeft ? 1 : -1, // kierunek ucieczki motylka i pościgu
            ex = toLeft ? 28 : 72;
        ev = { dir, col: Math.floor(Math.random() * 5), b: null, last: null, lure: null, tb: 0 };
        const steps = [];
        if (Math.abs(ex - dogX) > 1) steps.push({ k: "m", to: ex, walk: true });
        steps.push({ k: "w" }, { k: "l" }, { k: "c" }, { k: "n" }, { k: "o" });
        return steps;
    }
    // klatka motylka: preset „ms” / 2 (spłoszony / 3) — jak eventButterflyCell() w grze
    function bfCell(col, t, fast) {
        const ms = fast ? BF_MS / 3 : BF_MS / 2,
            fi = Math.floor(t / ms) % 3;
        return col * 3 + fi;
    }
    function drawBf(xc, yc, col, t, size, mirror, fast) {
        const im = IMG.mot;
        if (!im.complete || !im.naturalWidth) return;
        const f = bfCell(col, t, fast);
        c.save();
        c.translate(xc * U, yc * U);
        if (mirror) c.scale(-1, 1);
        c.drawImage(im, (f % 3) * 64, Math.floor(f / 3) * 64, 64, 64, (-size / 2) * U, (-size / 2) * U, size * U, size * U);
        c.restore();
    }

    function pickAct() {
        const names = Object.keys(ACT).filter((n) => n !== lastAct);
        let r = Math.random() * names.reduce((s, n) => s + ACT[n].w, 0),
            pick = names[0];
        for (const n of names) {
            if ((r -= ACT[n].w) <= 0) {
                pick = n;
                break;
            }
        }
        lastAct = pick;
        ev = null;
        act = { name: pick, steps: ACT[pick].make() };
        si = 0;
        st = 0;
        enterStep();
    }
    function enterStep() {
        const S = act.steps[si];
        st = 0;
        if (S.k === "a") setAnim(S.anim);
        else if (S.k === "w" || S.k === "l" || S.k === "o") {
            flip = ev.dir < 0;
            setAnim(A.stand);
        } else if (S.k === "c") {
            flip = ev.dir < 0;
            setAnim(A.chase);
            ev.chaseX0 = dogX;
            if (ev.b) ev.b.vis = false;
            if (ev.lure) ev.lure.done = true;
        } else if (S.k === "n") setAnim(A.nose);
        else if (S.k === "m") {
            flip = S.to < dogX;
            S.speed = S.walk || Math.abs(S.to - dogX) < 48 / PX ? V_WALK : 300 / PX;
            cur = S.speed > V_WALK ? A.run : A.walk;
        }
    }
    function nextStep() {
        si++;
        if (si >= act.steps.length) {
            if (ev) nextAmb = Math.max(nextAmb, 3);
            return pickAct();
        }
        enterStep();
    }

    function actStep(dt) {
        const S = act.steps[si];
        st += dt;
        if (S.k === "a") {
            if (st >= S.dur) nextStep();
        } else if (S.k === "m") {
            const d = S.to - dogX,
                mv = S.speed * dt;
            if (Math.abs(d) <= mv) {
                dogX = S.to;
                nextStep();
            } else {
                dogX += Math.sign(d) * mv;
                dist += mv;
            }
        } else if (S.k === "w") {
            // piesek stoi zwrócony do motylka, który leci z drugiej strony ekranu
            if (!ev.b) ev.b = { vis: true, t0: clockMs, x: 0, y: EV_Y };
            ev.tb = (clockMs - ev.b.t0) / EV_CROSS;
            const x0 = ev.dir > 0 ? W + 25 : -25,
                x1 = ev.dir > 0 ? -25 : W + 25;
            ev.b.x = x0 + (x1 - x0) * ev.tb;
            ev.b.y = EV_Y + Math.sin(ev.tb * Math.PI * 4) * 13;
            // punkt pościgu = znacznik pierwszej klatki gonitwy; motylek zawraca, gdy jest EV_V·EV_T przed nim
            const sp = world("a02", A.chase.f[0], 1, cell("a02", A.chase.f[0])?.marker?.x ?? 64, cell("a02", A.chase.f[0])?.marker?.y ?? 60);
            ev.spot = { x: sp.x * PX, y: GROUND_GAME + (sp.y - FEET) * PX };
            const xl = ev.spot.x - ev.dir * EV_V * EV_T;
            if (ev.dir > 0 ? ev.b.x <= xl : ev.b.x >= xl) nextStep();
            else if (ev.tb >= 1) (ev = null), pickAct(); // awaryjnie: motylek przeleciał
        } else if (S.k === "l") {
            // ucieczka: zawraca i leci tam, skąd przyleciał, kończy dokładnie w punkcie pościgu
            if (!ev.lure) ev.lure = { x0: ev.b.x, y0: ev.b.y, cycles: clamp(Math.round(EV_T / 450), 2, 6), amp: (10 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1), done: false };
            const L = ev.lure,
                el = st * 1000,
                t = clamp(el / EV_T, 0, 1),
                e = t * t * (3 - 2 * t);
            ev.b.x = L.x0 + ev.dir * EV_V * Math.min(el, EV_T) + Math.sin(t * Math.PI * 4 * L.cycles) * 5;
            ev.b.y = L.y0 + (ev.spot.y - L.y0) * e + Math.sin(t * Math.PI * 2 * L.cycles) * L.amp;
            if (el >= EV_T) nextStep();
        } else if (S.k === "c") {
            // skoki za motylkiem: piesek przesuwa się o 0,1 szerokości ekranu (jak w grze)
            const T = A.chase.f.length * A.chase.ms * 2;
            dogX = ev.chaseX0 + ev.dir * ((0.1 * W) / PX) * clamp((st * 1000) / T, 0, 1);
            if (st * 1000 >= T) nextStep();
        } else if (S.k === "n") {
            if (st * 1000 >= A.nose.f.length * A.nose.ms) nextStep();
        } else if (S.k === "o") {
            // odlot: motylek startuje z ostatniego miejsca nakładki, łagodny rozbieg, zygzak
            const p = clamp(st / 1.0, 0, 1),
                e = p * p * (3 - 2 * p) * 0.6 + p * 0.4,
                from = ev.last || { x: dogX * PX + ev.dir * 84, y: 256 };
            ev.b.vis = true;
            ev.b.x = from.x + ev.dir * 190 * e;
            ev.b.y = from.y - 90 * e + Math.sin(p * 8) * 5 * p;
            if (p >= 1) {
                ev.b.vis = false;
                nextStep();
            }
        }
    }

    function step(dt) {
        pt += dt;
        curT += dt;
        clockMs += dt * 1000;
        if (phase === "load") {
            shown += (target - shown) * Math.min(1, dt * 7);
            if (target - shown < 0.002) shown = target;
            fill.style.width = Math.max(4, shown * 100) + "%";
            v = V_RUN;
            if (ready && shown >= 0.995) {
                phase = "brake";
                pt = 0;
            }
        } else if (phase === "brake") {
            // zwalnia z biegu do marszu (ogród dalej przesuwa się, piesek stoi w miejscu)
            v = lerp(V_RUN, V_WALK, ease(pt / 1.3));
            if (pt >= 1.3) {
                v = V_WALK;
                phase = "walk";
                pt = 0;
                // pasek zamienia się w przycisk
                bar.classList.add("off");
                msg.classList.add("off");
                go.hidden = false;
                fsBtn.hidden = false;
                void go.offsetWidth;
                go.classList.add("on");
            }
        } else if (phase === "walk") {
            // ogród staje, a piesek idzie spokojnie na środek ekranu (ta sama prędkość względem ziemi)
            v = V_WALK;
            dogX += V_WALK * dt;
            if (dogX >= 50) {
                dogX = 50;
                v = 0;
                phase = "idle";
                pt = 0;
                setAnim(A.stand);
                if (hasSave) {
                    // bez zapisu nie ma czego zerować — „Zacznij od nowa” tylko przy istniejącej grze
                    newBtn.hidden = false;
                    void newBtn.offsetWidth;
                    newBtn.classList.add("on");
                }
            }
        } else {
            v = 0;
            if (pt > 1.2) {
                if (!act) pickAct();
                else actStep(dt);
            }
        }
        if (phase !== "idle") {
            dist += v * dt;
            // bieg albo marsz zależnie od prędkości
            cur = v >= 34 ? A.run : A.walk;
        } else if (act && act.steps[si].k === "m") {
            const S = act.steps[si];
            cur = S.speed > V_WALK ? A.run : A.walk;
        }
        const lawnV = phase === "walk" ? 0 : v;
        scroll += lawnV * dt;
        sceneEl.style.backgroundPositionX = -((scroll * SKY) % 200) + "cqw";
        lawnEl.style.backgroundPositionX = -(scroll % 200) + "cqw";
        if (phase === "idle") ambientUpdate(dt);
    }

    // ── motylki-tło: lecą „jak pijane” po pasie nieba (to samo co ambientUpdate() w grze, bez klikania) ──
    const AMB_MARGIN_X = 44,
        AMB_TOP = 104,
        AMB_BOTTOM = 176,
        AMB_SIZE = 96 / PX;
    function ambFlight(b, state, from, to, speed) {
        b.state = state;
        b.ps = clockMs;
        b.from = from;
        b.to = to;
        const dx = to.x - from.x,
            dy = to.y - from.y,
            len = Math.hypot(dx, dy) || 1;
        b.perpX = -dy / len;
        b.perpY = dx / len;
        b.bamp = 10 + Math.random() * 10;
        b.bsign = Math.random() < 0.5 ? 1 : -1;
        b.pd = Math.max(400, (len / speed) * 1000);
    }
    function ambEdge(nx, ny) {
        const side = Math.floor(Math.random() * 3);
        return side === 0 ? { x: -96, y: ny } : side === 1 ? { x: W + 96, y: ny } : { x: clamp(nx + (Math.random() * 2 - 1) * 90, AMB_MARGIN_X, W - AMB_MARGIN_X), y: -48 };
    }
    function ambSpawn() {
        const sx = AMB_MARGIN_X + Math.random() * (W - AMB_MARGIN_X * 2),
            sy = AMB_TOP + Math.random() * (AMB_BOTTOM - AMB_TOP),
            from = ambEdge(sx, sy),
            b = {
                col: Math.floor(Math.random() * 5),
                x: from.x,
                y: from.y,
                born: clockMs,
                leaveAt: Infinity,
                heading: Math.random() * Math.PI * 2,
                speed: 34 + Math.random() * 26,
                f1: 0.5 + Math.random() * 0.7,
                f2: 1.4 + Math.random() * 1.1,
                a1: 0.8 + Math.random() * 0.6,
                a2: 0.35 + Math.random() * 0.4,
                s1: Math.random() * Math.PI * 2,
                s2: Math.random() * Math.PI * 2,
            };
        ambFlight(b, "entering", from, { x: sx, y: sy }, b.speed);
        ambient.push(b);
    }
    function ambientUpdate(dt) {
        if (!ambient.length && nextAmb > 0) nextAmb -= dt;
        if (!ambient.length && nextAmb <= 0 && !ev) ambSpawn();
        for (let i = ambient.length - 1; i >= 0; i--) {
            const b = ambient[i];
            if (b.state !== "wander") {
                const p = clamp((clockMs - b.ps) / b.pd, 0, 1),
                    bounce = Math.sin(p * Math.PI * 2) * b.bamp * b.bsign;
                b.x = b.from.x + (b.to.x - b.from.x) * p + b.perpX * bounce;
                b.y = b.from.y + (b.to.y - b.from.y) * p + b.perpY * bounce;
                if (p >= 1) {
                    if (b.state === "entering") {
                        b.state = "wander";
                        b.heading = Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x);
                        b.leaveAt = clockMs + 5000 + Math.random() * 6000;
                    } else {
                        ambient.splice(i, 1);
                        nextAmb = 5 + Math.random() * 7; // w grze 12–30 s; tu ekran jest pusty, więc częściej
                    }
                }
                continue;
            }
            if (clockMs >= b.leaveAt) {
                ambFlight(b, "leaving", { x: b.x, y: b.y }, ambEdge(b.x, b.y), b.speed);
                continue;
            }
            const t = (clockMs - b.born) / 1000;
            let turn = Math.sin(t * b.f1 + b.s1) * b.a1 + Math.sin(t * b.f2 + b.s2) * b.a2;
            const steer = (tg) => (((tg - b.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 2.4;
            if (b.x < AMB_MARGIN_X) turn += steer(0);
            else if (b.x > W - AMB_MARGIN_X) turn += steer(Math.PI);
            if (b.y < AMB_TOP) turn += steer(Math.PI / 2);
            else if (b.y > AMB_BOTTOM) turn += steer(-Math.PI / 2);
            b.heading += turn * dt;
            b.x += Math.cos(b.heading) * b.speed * dt;
            b.y += Math.sin(b.heading) * b.speed * dt;
            b.x = clamp(b.x, AMB_MARGIN_X - 8, W - AMB_MARGIN_X + 8);
            b.y = clamp(b.y, AMB_TOP - 8, AMB_BOTTOM);
        }
    }

    function draw() {
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        // motylki-tło są za pieskiem
        for (const b of ambient) {
            const dx = b.state === "wander" ? Math.cos(b.heading) : b.to.x - b.from.x;
            drawBf(b.x / PX, yOf(b.y), b.col, clockMs - b.born, AMB_SIZE, dx < 0, false);
        }
        const fi = cur.stride ? Math.floor(dist / cur.stride) % cur.f.length : Math.floor((curT * 1000) / cur.ms) % cur.f.length,
            f = cur.f[fi],
            cl = cell(cur.s, f),
            g = geo(cur.s, f, cur.boost);
        if (cl) {
            // jak drawDog(): translate(stopy) → ewentualne odbicie → przesunięcie klatki → skala → klatka od linii gruntu
            c.save();
            c.translate(dogX * U, FEET * U);
            if (flip) c.scale(-1, 1);
            c.translate(g.ox * U, g.oy * U);
            c.scale(g.k * U, g.k * U);
            c.drawImage(cl.cv, -CELL / 2, -GROUND_PX);
            c.restore();
        }
        if (ev) {
            const S = act && act.steps[si],
                kind = S && S.k;
            if (kind === "c" || kind === "n") {
                // motylek „przyklejony” do znacznika klatki (jak catchOverlayDraw); brak znacznika = nic nie rysuje
                if (cl && cl.marker) {
                    const w = world(cur.s, f, cur.boost, cl.marker.x, cl.marker.y);
                    ev.last = { x: w.x * PX, y: GROUND_GAME + (w.y - FEET) * PX };
                    drawBf(w.x, w.y, ev.col, clockMs - ev.b.t0, EV_SIZE, flip, false);
                }
            } else if (ev.b && ev.b.vis) {
                const fast = kind === "l" && ev.lure && !ev.lure.done;
                // w locie do pieska patrzy w stronę pieska (−dir), po zawróceniu i przy odlocie — w stronę dir
                drawBf(ev.b.x / PX, yOf(ev.b.y), ev.col, clockMs - ev.b.t0, EV_SIZE, kind === "w" ? ev.dir > 0 : ev.dir < 0, fast);
            }
        }
    }

    let last = 0;
    function frame(t) {
        if (stopped) return;
        const dt = Math.min(0.1, (t - last) / 1000 || 0);
        last = t;
        step(dt);
        draw();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ── przyciski ──
    const fsOn = () => {
        try {
            return localStorage.getItem(FS_KEY) !== "0";
        } catch (_) {
            return true;
        }
    };
    fsBtn.setAttribute("aria-pressed", String(fsOn()));
    fsBtn.onclick = () => {
        const on = !fsOn();
        try {
            localStorage.setItem(FS_KEY, on ? "1" : "0");
        } catch (_) {}
        fsBtn.setAttribute("aria-pressed", String(on));
    };
    function start() {
        if (!resolve) return;
        // ten sam gest = pełny ekran (jeśli włączony przełącznikiem i jeszcze nie jest)
        if (fsOn() && !document.fullscreenElement && !document.webkitFullscreenElement) document.querySelector(".full")?.click();
        stopped = true;
        const r = resolve;
        resolve = null;
        r();
    }
    go.onclick = start;
    newBtn.onclick = () => (warn.hidden = false);
    root.querySelector(".ldWarnNo").onclick = () => (warn.hidden = true);
    root.querySelector(".ldWarnYes").onclick = () => {
        try {
            RESET_KEYS.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}
        location.reload();
    };

    window.loadScreen = {
        progress(v) {
            target = Math.max(target, Math.min(0.97, v));
        },
        ready() {
            ready = true;
            target = 1;
            return new Promise((ok) => (resolve = ok));
        },
        error(text) {
            stopped = true;
            root.hidden = false;
            bar.hidden = true;
            msg.textContent = text;
            msg.classList.remove("off");
        },
    };
})();
