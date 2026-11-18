"use strict";
// ═══════════════════════════════════════════════════════════════
// EKRAN "GRY" — wybór mini-gry z menu kołowego (pozycja "Gry" z pucharem).
// Duże kafelki: Kretowisko i Jeżyk i owoce. Kafelek otwiera ten sam tutorial
// co wejście z Łąki (moleTryStart / hedgePeekTap). Nowa gra = nowy wpis w
// GAMES_LIST. Wczytywany na końcu (po wszystkich mini-grach).
// ═══════════════════════════════════════════════════════════════

const GAMES_LIST = [
    {
        id: "mole",
        name: "Kretowisko",
        // kret wychylony z kopca (ostatnia klatka wychodzenia)
        draw: (c, s) => {
            const f = numbers(CFG.kret.presets[1].seq),
                cell = cells.kret[f[f.length - 1] - 1];
            if (cell) c.drawImage(cell, 0, 0, s, s);
        },
        start: () => moleTryStart(),
    },
    {
        id: "hedge",
        name: "Jeżyk i owoce",
        draw: (c, s) => {
            const cell = cells.hedgehog[0],
                fruit = cells.hedgehogGame[5];
            if (cell) c.drawImage(cell, s * 0.08, s * 0.16, s * 0.84, s * 0.84);
            if (fruit) c.drawImage(fruit, s * 0.32, s * 0.02, s * 0.38, s * 0.38);
        },
        start: () => hedgePeekTap(),
    },
];

function gamesBuild() {
    const box = $(".gamesGrid");
    if (box.childElementCount) return;
    for (const g of GAMES_LIST) {
        const b = document.createElement("button");
        b.className = "gamesTile";
        b.innerHTML = '<canvas width="160" height="160"></canvas><span></span>';
        b.querySelector("span").textContent = g.name;
        b.onclick = () => {
            $(".gamesFull").hidden = true;
            idle(16);
            g.start();
        };
        box.appendChild(b);
    }
}

function gamesShow() {
    gamesBuild();
    $$games(".gamesTile canvas").forEach((cv, i) => {
        const c = cv.getContext("2d");
        c.clearRect(0, 0, 160, 160);
        c.imageSmoothingEnabled = false;
        GAMES_LIST[i].draw(c, 160);
    });
    $(".gamesFull").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "games-menu";
                stage = "games-menu";
                locks();
            },
            onEnd: () => gamesClose(),
        },
    ]);
}

function gamesClose() {
    $(".gamesFull").hidden = true;
    if (phase === "games-menu") idle(16);
}
$(".gamesClose").onclick = gamesClose;

function $$games(sel) {
    return Array.from(document.querySelectorAll(sel));
}
