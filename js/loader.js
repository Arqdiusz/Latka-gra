"use strict";
// ═══════════════════════════════════════════════════════════════
// EKRAN ŁADOWANIA — ładuje się jako pierwszy (przed resztą skryptów, które są
// "defer"), więc widać go od razu. Biegnący piesek (klatki presetu "02. Bieg"
// z arkusza a01) + pasek postępu. Gdy gra jest gotowa, pasek zmienia się w
// duży przycisk "Graj na pełnym ekranie" (+ mały "Graj w oknie"). Dotknięcie
// uruchamia grę. game.js: loadScreen.progress(0..1), .ready(), .error(msg).
// ═══════════════════════════════════════════════════════════════
(() => {
    const root = document.querySelector(".load"),
        cv = root.querySelector(".loadDog"),
        c = cv.getContext("2d"),
        bar = root.querySelector(".loadBar i"),
        msg = root.querySelector(".loadMsg"),
        ready = root.querySelector(".loadReady"),
        sheet = new Image(),
        CELL = 128,
        COLS = 6,
        RUN = [3, 4, 9, 10], // preset "02. Bieg / sus"
        RUN_MS = 110;
    let target = 0,
        shown = 0,
        isReady = false,
        resolve = null,
        stopped = false;
    sheet.src = "animacje/latka-animacje-01.png";

    function frame(t) {
        if (stopped) return;
        // pasek dąży płynnie do wartości z gry
        shown += (target - shown) * 0.12;
        if (target - shown < 0.002) shown = target;
        bar.style.width = Math.max(4, shown * 100) + "%";
        if (isReady && shown >= 0.995 && ready.hidden) {
            root.querySelector(".loadBar").hidden = true;
            msg.hidden = true;
            ready.hidden = false;
        }
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        if (sheet.complete && sheet.naturalWidth) {
            const f = RUN[Math.floor(t / RUN_MS) % RUN.length] - 1,
                sx = (f % COLS) * CELL,
                sy = Math.floor(f / COLS) * CELL;
            // piesek biegnie w prawo, lekko "podskakuje" w miejscu
            const bob = Math.sin(t / 110) * 2;
            c.drawImage(sheet, sx, sy, CELL, CELL, 0, bob, 192, 192);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function start(full) {
        if (!resolve) return;
        if (full) document.querySelector(".full")?.click(); // ten sam gest = pełny ekran
        stopped = true;
        const r = resolve;
        resolve = null;
        r();
    }
    root.querySelector(".loadFull").onclick = () => start(true);
    root.querySelector(".loadWindow").onclick = () => start(false);

    window.loadScreen = {
        progress(v) {
            target = Math.max(target, Math.min(0.97, v));
        },
        ready() {
            isReady = true;
            target = 1;
            return new Promise((ok) => (resolve = ok));
        },
        error(text) {
            stopped = true;
            root.hidden = false;
            root.querySelector(".loadBar").hidden = true;
            ready.hidden = true;
            msg.hidden = false;
            msg.textContent = text;
        },
    };
})();
