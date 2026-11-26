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
//  3. STARTOWY (może trwać długo): piesek na zmianę łapie motylka, kopie kostkę,
//     ziewa, drapie się, otrząsa, siada… co jakiś czas znów rusza biegiem, a przez
//     ekran przelatują motylki.
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
        SKY = 0.2; // niebo przewija się wolniej niż trawnik
    // przesunięcia klatek [x, y, skala%] z data/config.json (tylko użyte klatki)
    const OFF = {"a01":{"1":[0,0,100],"3":[0,0,100],"4":[0,0,100],"7":[0,0,100],"8":[0,0,100],"9":[0,0,100],"10":[0,0,100],"15":[0,0,100],"16":[0,0,100],"21":[0,0,100],"25":[0,-1,100],"26":[0,0,100],"29":[0,0,100],"32":[0,-1,100],"43":[0,0,100],"49":[0,0,100],"50":[0,0,100],"51":[0,0,100],"52":[0,0,100],"55":[0,0,100],"56":[0,0,100],"57":[0,0,100],"58":[0,0,100],"61":[0,0,100]},"a02":{"1":[0,0,100],"8":[0,0,100],"27":[0,0,100],"28":[0,0,100],"33":[0,0,100],"34":[0,0,100],"53":[0,0,100],"54":[0,0,100],"59":[0,0,100],"63":[0,0,100],"64":[0,0,100],"65":[0,0,100],"66":[0,8,100],"69":[0,0,100],"70":[0,0,100],"71":[0,-4,100],"72":[0,-2,100]},"a03":{"1":[0,0,100],"4":[0,0,100],"5":[0,0,100],"6":[0,0,100],"9":[0,0,100],"10":[0,0,100],"12":[0,0,100],"13":[0,0,100],"14":[0,0,100],"16":[0,0,100],"17":[0,0,100],"18":[0,0,100],"20":[0,0,100],"21":[0,0,100],"22":[0,0,100],"23":[0,0,100],"24":[0,-6,100]}};

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

    // ── animacje pieska: arkusz + klatki + czas klatki (ms) ──
    const A = {
        // bieg i marsz: klatki zależą od przebytej drogi (jak w grze: 36 px / 13 px na klatkę)
        run: { s: "a01", f: [3, 4, 9, 10], stride: 36 / 3.84, boost: 1.04 },
        walk: { s: "a01", f: [25, 26, 32], stride: 13 / 3.84 },
        sit: { s: "a01", f: [29, 29, 29, 61, 29, 29, 29, 49], ms: 650 },
        shake: { s: "a01", f: [51, 52, 57, 52, 57, 58], ms: 280 },
        scratch: { s: "a01", f: [49, 50, 55, 49, 50, 49, 50, 56], ms: 280 },
        stand: { s: "a02", f: [1, 8, 1, 8], ms: 650 },
        yawn: { s: "a02", f: [27, 28, 33, 34], ms: 280 },
        watch: { s: "a02", f: [63, 64, 69, 70], ms: 280 },
        chase: { s: "a02", f: [53, 54, 59, 70], ms: 220 },
        land: { s: "a02", f: [65, 66, 71, 72], ms: 280 },
        dig1: { s: "a03", f: [10, 4, 9, 5, 1], ms: 333 },
        dig2: { s: "a03", f: [14, 6, 13, 20, 12], ms: 220 },
        play: { s: "a03", f: [17, 18, 24, 21, 23, 22, 16], ms: 333 },
    };
    // zabawy na ekranie startowym: [animacja, czas w s]…; waga = jak często
    const ACT = {
        bfly: { w: 3, seg: [["watch", 1.8], ["chase", 2.2], ["land", 2.2]], bf: true },
        dig: { w: 3, seg: [["dig1", 1.7], ["dig2", 1.4], ["play", 2.3]] },
        look: { w: 2, seg: [["stand", 2.6]] },
        yawn: { w: 1, seg: [["stand", 0.6], ["yawn", 1.7]] },
        scratch: { w: 1, seg: [["scratch", 2.3]] },
        shake: { w: 1, seg: [["shake", 1.7]] },
        rest: { w: 1.5, seg: [["sit", 3.2]] },
        run: { w: 1.2, run: true },
    };

    // ── stan ──
    let target = 0,
        shown = 0,
        ready = false,
        resolve = null,
        stopped = false,
        phase = "load", // load → brake → walk → idle
        pt = 0, // czas w bieżącej fazie (s)
        scroll = 0, // przesunięcie trawnika (cqw)
        v = V_RUN, // prędkość pieska względem ogrodu (cqw/s)
        dist = 0, // przebyta droga (cqw) — z niej klatki biegu/marszu
        dogX = 26,
        cur = A.run,
        curT = 0, // czas od początku bieżącej animacji (s)
        act = null, // bieżąca zabawa
        actI = 0,
        actT = 0,
        lastAct = null,
        runPh = 0,
        runT = 0,
        hasSave = false,
        butterflies = [],
        nextBf = 6;
    try {
        hasSave = localStorage.getItem(SAVE_KEY) !== null;
    } catch (_) {}
    go.querySelector("span").textContent = hasSave ? "Kontynuuj" : "Graj";

    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)),
        eo = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3),
        lerp = (a, b, x) => a + (b - a) * x;
    const setAnim = (a) => {
        if (cur !== a) {
            cur = a;
            curT = 0;
        }
    };

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
        act = ACT[pick];
        actI = 0;
        actT = 0;
        runPh = 0;
        runT = 0;
        if (!act.run) setAnim(A[act.seg[0][0]]);
    }

    function idleStep(dt) {
        if (!act) pickAct();
        if (act.run) {
            // znów rusza jak w grze: krok → marsz → bieg (ok. 3,5 s) → marsz → staje
            runT += dt;
            const t = runT;
            if (t < 0.5) v = V_WALK * ease(t / 0.5);
            else if (t < 1.4) v = V_WALK;
            else if (t < 2.1) v = lerp(V_WALK, V_RUN, ease((t - 1.4) / 0.7));
            else if (t < 5.6) v = V_RUN;
            else if (t < 6.6) v = lerp(V_RUN, V_WALK, ease((t - 5.6) / 1));
            else if (t < 7.4) v = V_WALK * (1 - ease((t - 6.6) / 0.8));
            else {
                v = 0;
                pickAct();
            }
            return;
        }
        v = 0;
        actT += dt;
        if (actT >= act.seg[actI][1]) {
            actT = 0;
            actI++;
            if (actI >= act.seg.length) return pickAct();
            setAnim(A[act.seg[actI][0]]);
        }
    }

    function step(dt) {
        pt += dt;
        curT += dt;
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
                bfTimer(4);
            }
        } else {
            if (pt > 0.9) idleStep(dt);
        }
        dist += v * dt;
        // bieg albo marsz zależnie od prędkości
        if (phase === "load" || phase === "brake" || phase === "walk" || (act && act.run)) cur = v >= 34 ? A.run : A.walk;
        const lawnV = phase === "walk" ? 0 : v;
        scroll += lawnV * dt;
        sceneEl.style.backgroundPositionX = -((scroll * SKY) % 200) + "cqw";
        lawnEl.style.backgroundPositionX = -(scroll % 200) + "cqw";
        // motylki przelatujące przez ekran
        if (phase === "idle") {
            nextBf -= dt;
            if (nextBf <= 0) spawnBf();
        }
        for (const b of butterflies) {
            b.t += dt;
            b.x += b.vx * dt;
        }
        butterflies = butterflies.filter((b) => b.x > -14 && b.x < 114);
    }
    function bfTimer(s) {
        nextBf = s;
    }
    function spawnBf() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        butterflies.push({ x: dir > 0 ? -10 : 110, vx: dir * (13 + Math.random() * 8), y: 30 + Math.random() * 62, t: 0, col: Math.floor(Math.random() * 5), ph: Math.random() * 6 });
        nextBf = 7 + Math.random() * 8;
    }

    function butterfly(x, y, col, t, size) {
        const im = IMG.mot;
        if (!im.complete || !im.naturalWidth) return;
        const f = col * 3 + (Math.floor(t * 10) % 3);
        c.drawImage(im, (f % 3) * 64, Math.floor(f / 3) * 64, 64, 64, (x - size / 2) * U, (y - size / 2) * U, size * U, size * U);
    }

    // piesek jak w grze: łapy na FEET, klatka wyrównana linią gruntu i przesunięciem z config.json
    function place(sheet, f, boost) {
        const o = OFF[sheet][f] || [0, 0, 100],
            k = (K * o[2]) / 100 * (boost || 1); // cqw na 1 px klatki
        return { k, left: dogX - (CELL / 2) * k + (o[0] * 2.35) / 3.84, top: FEET - GROUND_PX * k + (o[1] * 2.35) / 3.84 };
    }
    function draw(t) {
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        const fi = cur.stride ? Math.floor(dist / cur.stride) % cur.f.length : Math.floor((curT * 1000) / cur.ms) % cur.f.length,
            f = cur.f[fi],
            cl = cell(cur.s, f),
            g = place(cur.s, f, cur.boost);
        if (cl) c.drawImage(cl.cv, g.left * U, g.top * U, CELL * g.k * U, CELL * g.k * U);
        // motylek „na nosie” według znacznika klatki (jak w grze) albo krążący, gdy klatka go nie ma
        if (phase === "idle" && act && act.bf) {
            if (cl && cl.marker) butterfly(g.left + cl.marker.x * g.k, g.top + cl.marker.y * g.k, 2, t / 1000, 16);
            else butterfly(dogX + 22 + Math.sin((t / 1000) * 1.9) * 9, 70 + Math.cos((t / 1000) * 2.4) * 5, 2, t / 1000, 16);
        }
        for (const b of butterflies) butterfly(b.x, b.y + Math.sin(b.t * 2.6 + b.ph) * 7, b.col, b.t + b.ph, 12);
    }

    let last = 0;
    function frame(t) {
        if (stopped) return;
        const dt = Math.min(0.1, (t - last) / 1000 || 0);
        last = t;
        step(dt);
        draw(t);
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
