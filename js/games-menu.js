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
        id: "mole2",
        name: "Krety na łące",
        // kret na kawałku trawy
        draw: (c, s) => {
            c.fillStyle = "#9fd672";
            c.beginPath();
            c.ellipse(s / 2, s * 0.8, s * 0.46, s * 0.17, 0, 0, Math.PI * 2);
            c.fill();
            const f = numbers(CFG.kret.presets[2].seq),
                cell = cells.kret[f[2] - 1];
            if (cell) c.drawImage(cell, s * 0.06, s * 0.02, s * 0.88, s * 0.88);
        },
        start: () => mole2TryStart(),
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
    {
        id: "memo",
        name: "Pamięć motylków",
        draw: (c, s) => {
            [0, 3, 4].forEach((col, i) => {
                const cell = memoCell(col, 0);
                if (cell) c.drawImage(cell, s * (0.02 + i * 0.32), s * (0.3 + (i === 1 ? -0.1 : 0.08)), s * 0.4, s * 0.4);
            });
        },
        start: () => memoTryStart(),
    },
    {
        id: "pairs",
        name: "Znajdź pary",
        // dwie odkryte karty z jabłkiem i jedna zakryta
        draw: (c, s) => {
            const card = (x, y, rot, face) => {
                c.save();
                c.translate(x, y);
                c.rotate(rot);
                c.fillStyle = face ? "#fffdf3" : "#f3a64a";
                c.strokeStyle = face ? "#e2d6bb" : "#fff";
                c.lineWidth = 4;
                c.beginPath();
                c.roundRect(-s * 0.2, -s * 0.25, s * 0.4, s * 0.5, 10);
                c.fill();
                c.stroke();
                const im = face ? cells.hedgehogGame[5] : cells.ui[UI.map.paw - 1];
                if (im) c.drawImage(im, -s * 0.15, -s * 0.15, s * 0.3, s * 0.3);
                c.restore();
            };
            card(s * 0.27, s * 0.52, -0.18, true);
            card(s * 0.73, s * 0.52, 0.18, true);
            card(s * 0.5, s * 0.46, 0, false);
        },
        start: () => pairsTryStart(),
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
