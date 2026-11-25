"use strict";
// ═══════════════════════════════════════════════════════════════
// SESJA 15 MINUT I BLOKADA RODZICA
// Liczy czas gry (tylko gdy gra jest otwarta i widoczna). Po 15 minutach albo
// gdy energia spadnie do ~3% piesek zasypia i pokazuje się ekran „Piesek śpi”.
// Odblokować może tylko rodzic: działanie z mnożenia (7 × 8 itp.).
// Po odblokowaniu nowa sesja: energia 100%, reszta potrzeb 75–80%, czyste łapki.
// Stan zapisany w localStorage — po odświeżeniu blokada zostaje.
// Silnik woła sessionTick(sekundy) z updateNeeds(). DEV: minuty sesji, blokada.
// ═══════════════════════════════════════════════════════════════

const SESSION_MS = 15 * 60 * 1000,
    SESSION_GRACE_MS = 2 * 60 * 1000, // trwająca mini-gra może się dokończyć
    SESSION_KEY = "latka-sesja-v1",
    LOCK_SLEEP_AT = 3,
    SESSION_START = { food: 75, water: 75, fun: 75, sleep: 100, clean: 80 };
let session = { played: 0, locked: false },
    sessionSaveT = 0,
    lockQ = null, // { a, b } — działanie dla rodzica
    lockDogT = 0;

try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (s && typeof s.played === "number") session = { played: s.played, locked: !!s.locked };
} catch (e) {
    console.warn(e);
}
function sessionSave() {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        console.warn(e);
    }
}

function sessionTick(seconds) {
    if (session.locked) return;
    session.played += seconds * 1000;
    sessionSaveT += seconds;
    if (sessionSaveT >= 5) {
        sessionSaveT = 0;
        sessionSave();
    }
    const over = session.played >= SESSION_MS || stats.sleep <= LOCK_SLEEP_AT;
    // nie przerywamy w pół zabawy (mini-gry, aport) — chyba że trwa to za długo
    if (over && (casual() || phase === "sad" || sleeping || session.played >= SESSION_MS + SESSION_GRACE_MS)) sessionLock();
}

function sessionLock() {
    session.locked = true;
    sessionSave();
    // piesek zasypia
    queue = [];
    segment = null;
    sleeping = true;
    phase = "idle";
    bubble = null;
    setAnim("a02", 6);
    locks();
    save();
    sessionShowLock();
}

function sessionShowLock() {
    const el = $(".parentLock");
    lockNewQuestion();
    $(".plInput").value = "";
    el.hidden = false;
    // śpiący piesek na ekranie blokady (a02 „07. Sen w legowisku”), stopami w jednym miejscu
    const cv = $(".plDog"),
        c = cv.getContext("2d"),
        seq = [31, 32],
        b = P.meta.a02[seq[0] - 1].box,
        K = 1.6;
    clearInterval(lockDogT);
    let i = 0;
    const draw = () => {
        const f = seq[i++ % seq.length],
            cell = cells.a02[f - 1];
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        if (cell) c.drawImage(cell, cv.width / 2 - ((b[0] + b[2]) / 2) * K, cv.height - 8 - b[3] * K, cell.width * K, cell.height * K);
    };
    draw();
    lockDogT = setInterval(draw, 900);
}

function lockNewQuestion() {
    const r = () => 6 + Math.floor(Math.random() * 4); // 6–9: poza zasięgiem małego dziecka
    lockQ = { a: r(), b: r() };
    $(".plQ").textContent = lockQ.a + " × " + lockQ.b + " =";
}

function sessionNew() {
    Object.assign(stats, SESSION_START);
    pawDirt = 0;
    session = { played: 0, locked: false };
    sessionSave();
    saveNeeds();
    clearInterval(lockDogT);
    $(".parentLock").hidden = true;
    sleeping = false;
    idle(16);
    statusUpdate();
    save();
}

$(".plForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number($(".plInput").value);
    if (lockQ && v === lockQ.a * lockQ.b) return sessionNew();
    const f = $(".plForm");
    f.classList.remove("bad");
    void f.offsetWidth;
    f.classList.add("bad");
    $(".plInput").value = "";
    lockNewQuestion();
});

// Blokada zapisana wcześniej (np. odświeżenie strony) — pokaż po wczytaniu gry
const lockBootT = setInterval(() => {
    if (!loaded) return;
    clearInterval(lockBootT);
    if (session.locked) sessionLock();
}, 300);

// DEV
$(".devLockNow").onclick = () => {
    $(".devPanel").hidden = true;
    sessionLock();
};
$(".devNewSession").onclick = () => {
    sessionNew();
    devRefresh();
};
