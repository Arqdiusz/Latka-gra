"use strict";
// ═══════════════════════════════════════════════════════════════
// ZNAJDŹ PARY — klasyczne memory: odkrywasz po dwie karty, para zostaje
// odkryta. Bez kar, bez czasu — czysta zabawa dla 3+.
// Poziomy: ⭐ 4×3 (6 par), ⭐⭐ 5×4 (10 par), ⭐⭐⭐ 6×5 (15 par).
// (Obsługa karty-jokera dla nieparzystej liczby kart zostaje w kodzie.)
// Karty to zwykłe przyciski DOM z obrotem 3D (CSS). Obrazki: ikony gry,
// owoce i słodycze z gry z jeżykiem, kolorowe motylki, jeżyk. Każda gra
// losuje pary, unikając tych z poprzedniej rozgrywki.
// Wczytywany PO minigame-memory.js (korzysta z memoDone-podobnego zapisu).
// ═══════════════════════════════════════════════════════════════

let pairsGame = null;

const PAIRS_LEVELS = [
        { cols: 3, rows: 4 },
        { cols: 4, rows: 5 },
        { cols: 5, rows: 6 },
    ],
    PAIRS_STORE = "pairsLevelsDone",
    PAIRS_UI_ICONS = ["food", "water", "fun", "sleep", "clean", "bone", "mole", "butterfly", "bubbles", "cup", "star", "lock", "clock", "garden", "living", "kitchen", "bathroom", "den", "heart", "brush", "bark", "cloth", "paw", "bell", "home"],
    PAIRS_FLIP_BACK_MS = 950;

let pairsPool = null, // [{ id, src }]
    pairsRecent = []; // id-y z poprzedniej gry — trafiają na koniec kolejki

function pairsBuildPool() {
    if (pairsPool) return pairsPool;
    const pool = [],
        add = (id, cv) => cv && pool.push({ id, src: cv.toDataURL("image/png") });
    for (const k of PAIRS_UI_ICONS) if (UI.map[k]) add("ui-" + k, cells.ui[UI.map[k] - 1]);
    cells.hedgehogGame.forEach((c, i) => add("food-" + i, c));
    // kolorowe motylki: czerwony, niebieski, żółty (pierwsza klatka koloru)
    for (const col of [2, 4, 1]) add("fly-" + col, cells.motyle[numbers(CFG.motyle.presets[col].seq)[0] - 1]);
    add("hedgehog", cells.hedgehog[0]);
    return (pairsPool = pool);
}

function pairsDone() {
    try {
        return JSON.parse(localStorage.getItem(PAIRS_STORE) || "[]");
    } catch (_) {
        return [];
    }
}
// Rekordy (osobno dla każdego poziomu): najkrótszy czas i najmniej prób.
// „Próba” = jedno odkrycie dwóch kart. Idealnie: tyle prób, ile par.
// Zapis: { bestT, lastT, bestN, lastN } — każde to { poziom: wartość }.
const PAIRS_RECORDS = "pairsRecords";
function pairsRecords() {
    try {
        const r = JSON.parse(localStorage.getItem(PAIRS_RECORDS) || "{}");
        return { bestT: r.bestT || {}, lastT: r.lastT || {}, bestN: r.bestN || {}, lastN: r.lastN || {} };
    } catch (_) {
        return { bestT: {}, lastT: {}, bestN: {}, lastN: {} };
    }
}
function pairsFmt(ms) {
    const s = ms / 1000;
    if (s < 60) return s.toFixed(1).replace(".", ",") + " s";
    const m = Math.floor(s / 60);
    return m + ":" + (s - m * 60).toFixed(1).replace(".", ",").padStart(4, "0");
}
const pairsTriesTxt = (n) => n + (n === 1 ? " próba" : n >= 2 && n <= 4 ? " próby" : " prób");

function pairsMarkDone(level) {
    try {
        const d = pairsDone();
        if (!d.includes(level)) d.push(level);
        localStorage.setItem(PAIRS_STORE, JSON.stringify(d));
    } catch (_) {}
}

function pairsShuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Tutorial ─────────────────────────────────────────────────────
function pairsTryStart() {
    if (sadBlocks("games")) return sadRefuse(); // smutny piesek nie chce się bawić
    if (!gameEntryOk()) return;
    // potrzeby pilnuje smutek (≤10%) — gameEntryOk() / sadBlocks("games")
    const pool = pairsBuildPool(),
        apple = pool.find((p) => p.id === "food-5") || pool[0];
    $("#pairsPopup .moleIntroIcon").src = icons.memory;
    const other = pool.find((p) => p.id === "ui-bone") || pool.find((p) => p !== apple && p.id !== apple.id),
        mini = (s) => '<span class="pairsMini"><img alt="" src="' + s + '"></span>';
    $("#pairsPopup .pairsTutGood").innerHTML = mini(apple.src) + mini(apple.src);
    $("#pairsPopup .pairsTutBad").innerHTML = mini(apple.src) + mini(other.src);
    $("#pairsPopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "pairs-intro";
                stage = "pairs-intro";
                locks();
            },
        },
    ]);
}
$("#pairsPopup .moleOk").onclick = () => {
    $("#pairsPopup").hidden = true;
    pairsShowLevels();
};
$("#pairsPopup .moleCancel").onclick = () => {
    $("#pairsPopup").hidden = true;
    idle(16);
};

// ── Wybór poziomu ────────────────────────────────────────────────
let pairsLevelsShownAt = 0;
function pairsShowLevels() {
    const box = $(".pairsLevelGrid"),
        done = pairsDone();
    box.innerHTML = "";
    PAIRS_LEVELS.forEach((lv, i) => {
        const n = Math.floor((lv.cols * lv.rows) / 2),
            b = document.createElement("button"),
            R = pairsRecords(),
            has = R.bestT[i] !== undefined,
            stats = has
                ? '<span class="memoTileStats col"><span class="memoTileStat"><i>Rekord</i><b>' + pairsFmt(R.bestT[i]) + " · " + R.bestN[i] + ' prób</b></span><span class="memoTileStat"><i>Ostatnio</i><b>' + pairsFmt(R.lastT[i]) + " · " + R.lastN[i] + " prób</b></span></span>"
                : '<span class="memoTileStats memoTileNew">Jeszcze bez wyniku</span>';
        b.className = "memoTile";
        b.innerHTML =
            '<span class="memoStars">' + "★".repeat(i + 1) + '</span><span class="memoTileTxt">' + n + (n < 5 ? " pary" : " par") + "</span>" + stats +
            (done.includes(i) ? '<img class="memoTileCup" alt="Ukończony" src="' + icons.cup + '" />' : "");
        b.onclick = () => {
            if (Date.now() - pairsLevelsShownAt < 700) return; // "przelot" kliknięcia z poprzedniego ekranu
            $(".pairsLevels").hidden = true;
            pairsStart(i);
        };
        box.appendChild(b);
    });
    pairsLevelsShownAt = Date.now();
    $(".pairsLevels").hidden = false;
    levelPickOpen($(".pairsLevels"), "memory", "pairs");
}
$(".pairsLevelsClose").onclick = () => {
    $(".pairsLevels").hidden = true;
    if (phase === "pairs-intro") idle(16);
};

// ── Start / koniec ───────────────────────────────────────────────
function pairsPick(n) {
    const pool = pairsShuffle([...pairsBuildPool()]),
        fresh = pool.filter((p) => !pairsRecent.includes(p.id)),
        old = pool.filter((p) => pairsRecent.includes(p.id)),
        pick = [...fresh, ...old].slice(0, n);
    pairsRecent = pick.map((p) => p.id);
    return pick;
}

function pairsStart(level) {
    const lv = PAIRS_LEVELS[level],
        total = lv.cols * lv.rows,
        n = Math.floor(total / 2),
        faces = pairsPick(n),
        deck = pairsShuffle([...faces, ...faces].map((f) => ({ ...f })));
    // 3×3: piesek-jokier na środku (zawsze odkryty)
    if (lv.joker) deck.splice(Math.floor(total / 2), 0, { id: "joker", src: cells.a01[28]?.toDataURL("image/png") || icons.bark, joker: true });
    pairsGame = { level, lv, deck, open: [], found: 0, need: n, timer: 0, over: false, tries: 0, t0: 0, ms: 0, tick: 0 };
    const board = $(".pairsBoard");
    board.innerHTML = "";
    deck.forEach((card, i) => {
        const b = document.createElement("button");
        b.className = "pairsCard" + (card.joker ? " joker up" : "");
        b.innerHTML = '<span class="pairsInner"><span class="pairsBack"></span><span class="pairsFace"><img alt="" src="' + card.src + '"></span></span>';
        b.onclick = () => pairsFlip(i);
        card.el = b;
        board.appendChild(b);
    });
    pairsLayout();
    pairsCountUpdate();
    say("fun", 1500);
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "pairs-game";
                stage = "pairs-game";
                locks();
            },
            onEnd: () => pairsFinish(false),
        },
    ]);
    $(".pairsFull").hidden = false;
    pairsLayout();
    save();
}

// Rozmiar kart dopasowany do miejsca na ekranie (karty 4:5, odstępy)
function pairsLayout() {
    const g = pairsGame;
    if (!g) return;
    const board = $(".pairsBoard"),
        bw = board.clientWidth,
        bh = board.clientHeight;
    if (!bw || !bh) return;
    const { cols, rows } = g.lv,
        gap = cols >= 5 ? 7 : 12,
        cw = Math.floor(Math.min((bw - gap * (cols - 1)) / cols, ((bh - gap * (rows - 1)) / rows) * 0.8, 130));
    board.style.gridTemplateColumns = `repeat(${cols}, ${cw}px)`;
    board.style.gridAutoRows = Math.floor(cw / 0.8) + "px";
    board.style.gap = gap + "px";
    board.style.setProperty("--pairsRadius", Math.max(8, Math.round(cw * 0.14)) + "px");
}
window.addEventListener("resize", pairsLayout);

function pairsCountUpdate() {
    const g = pairsGame;
    if (!g) return;
    $(".pairsCount b").textContent = g.found + " / " + g.need;
    $(".pairsTries b").textContent = g.tries;
    $(".pairsTime b").textContent = pairsFmt(g.ms);
}
// Czas liczony od pierwszego odkrycia karty do znalezienia ostatniej pary.
function pairsTimerStart(g) {
    g.t0 = performance.now();
    clearInterval(g.tick);
    g.tick = setInterval(() => {
        if (pairsGame !== g || g.over) return clearInterval(g.tick);
        g.ms = performance.now() - g.t0;
        $(".pairsTime b").textContent = pairsFmt(g.ms);
    }, 100);
}

function pairsFlip(i) {
    const g = pairsGame;
    if (!g || g.over || phase !== "pairs-game") return;
    const c = g.deck[i];
    if (c.joker || c.found || g.open.includes(c)) return;
    // dwie niepasujące jeszcze widać — następne dotknięcie od razu je zakrywa
    if (g.open.length === 2) pairsHideOpen();
    c.el.classList.add("up");
    sfx("flip");
    if (!g.t0) pairsTimerStart(g);
    g.open.push(c);
    if (g.open.length < 2) return;
    g.tries++; // dwie karty odkryte = jedna próba
    pairsCountUpdate();
    const [a, b] = g.open;
    if (a.id === b.id) {
        a.found = b.found = true;
        g.open = [];
        g.found++;
        sfx("pair");
        for (const x of [a, b]) {
            x.el.classList.add("found");
            pairsStar(x.el);
        }
        pairsCountUpdate();
        if (g.found >= g.need) {
            g.over = true;
            g.ms = performance.now() - g.t0;
            clearInterval(g.tick);
            pairsCountUpdate();
            setTimeout(pairsWinShow, 700);
        }
    } else {
        clearTimeout(g.timer);
        setTimeout(() => pairsGame === g && sfx("miss"), 250);
        g.timer = setTimeout(() => pairsGame === g && pairsHideOpen(), PAIRS_FLIP_BACK_MS);
    }
}

function pairsHideOpen() {
    const g = pairsGame;
    if (!g) return;
    clearTimeout(g.timer);
    for (const c of g.open) c.el.classList.remove("up");
    g.open = [];
}

// gwiazdka nad znalezioną parą
function pairsStar(el) {
    if (!images.bubbleStar) return;
    const s = document.createElement("img");
    s.className = "pairsStar";
    s.alt = "";
    s.src = images.bubbleStar.src;
    el.appendChild(s);
    setTimeout(() => s.remove(), 900);
}

$(".pairsClose").onclick = () => {
    if (phase === "pairs-game") pairsFinish(false);
};

function pairsFinish(rewarded) {
    const got = rewarded && pairsGame;
    if (pairsGame) {
        clearTimeout(pairsGame.timer);
        clearInterval(pairsGame.tick);
    }
    pairsGame = null;
    $(".pairsFull").hidden = true;
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    if (got) {
        changeNeeds(ACTION_EFFECTS.pairs);
        save();
    }
    idle(16);
}

// ── Karta końcowa ────────────────────────────────────────────────
let pairsLastLevel = 0;
function pairsWinShow() {
    const g = pairsGame;
    if (!g) return;
    pairsLastLevel = g.level;
    pairsMarkDone(g.level);
    const R = pairsRecords(),
        L = g.level,
        time = Math.round(g.ms),
        prevT = R.bestT[L],
        prevN = R.bestN[L],
        lastT = R.lastT[L],
        lastN = R.lastN[L],
        recT = prevT !== undefined && time < prevT,
        recN = prevN !== undefined && g.tries < prevN;
    if (prevT === undefined || time < prevT) R.bestT[L] = time;
    if (prevN === undefined || g.tries < prevN) R.bestN[L] = g.tries;
    R.lastT[L] = time;
    R.lastN[L] = g.tries;
    try {
        localStorage.setItem(PAIRS_RECORDS, JSON.stringify(R));
    } catch (_) {}
    $("#pairsWinPopup .pairsRes").textContent = pairsFmt(time) + " · " + pairsTriesTxt(g.tries);
    $("#pairsWinPopup .pairsRec").textContent = "Rekord: " + pairsFmt(R.bestT[L]) + " · " + pairsTriesTxt(R.bestN[L]);
    $("#pairsWinPopup .pairsPrev").textContent = lastT !== undefined ? "Poprzednio: " + pairsFmt(lastT) + " · " + pairsTriesTxt(lastN) : "";
    const st = $("#pairsWinPopup .pairsSticker");
    st.hidden = !(recT || recN);
    st.innerHTML = recT && recN ? "NOWE<br />REKORDY!" : recT ? "REKORD<br />CZASU!" : "REKORD<br />PRÓB!";
    $("#pairsWinPopup .memoWinImg").src = icons.cup;
    moleWinSpawnConfetti("#pairsWinPopup .moleWinConfetti");
    startQueue([{ sheet: "a01", anim: 13, time: 600000 }]);
    phase = "pairs-end";
    stage = "pairs-end";
    locks();
    $("#pairsWinPopup").hidden = false;
}
$("#pairsWinPopup .memoExit").onclick = () => {
    $("#pairsWinPopup").hidden = true;
    pairsFinish(true);
};
$("#pairsWinPopup .memoNext").onclick = () => {
    // "Wybierz poziom": nagroda za wygraną i powrót do ekranu poziomów
    $("#pairsWinPopup").hidden = true;
    pairsFinish(true);
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "pairs-intro";
                stage = "pairs-intro";
                locks();
            },
        },
    ]);
    pairsShowLevels();
};
$("#pairsWinPopup .winAgain").onclick = () => {
    $("#pairsWinPopup").hidden = true;
    const l = pairsLastLevel;
    pairsFinish(true);
    pairsStart(l);
};
