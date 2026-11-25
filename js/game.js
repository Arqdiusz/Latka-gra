"use strict";
const $ = (s) => document.querySelector(s);
let P, CFG, UI;
// P, CFG, UI są inicjalizowane w boot() po załadowaniu data/config.json
const
    images = {},
    cells = {
        a01: [],
        a02: [],
        a03: [],
        ui: [],
        bubbles: [],
        motyle: [],
        kret: [],
        hedgehog: [],
        hedgehogGame: [],
    },
    pixels = {
        a01: [],
        a02: [],
        a03: [],
    },
    // Pozycje zielonych znaczników (#00ff43) wykrytych w klatkach a02 —
    // klucz to numer klatki (1-based), wartość to {x,y} w lokalnych
    // pikselach tej klatki. Wypełniane w boot(), patrz extractMarker().
    catchMarker = {},
    icons = {},
    W = 384,
    H = 768,
    SH = 550,
    GROUND = 425,
    BASE = 2.35,
    KEY = "latkaGame0288",
    order = ["meadow", "garden", "yard", "living", "kitchen", "bathroom"];
// Mapy plenerowe ("ogrodowe") — tylko na nich występują kopce kreta, jeżyk i
// motylki-tło.
const GARDEN_ROOMS = ["meadow", "garden", "yard"];
// Kolory menu = kolory statusów (STAT_FILL) rozjaśnione o 20% (mieszanie z bielą).
const items = [
    {
        id: "food",
        icon: "food",
        label: "Nakarm",
        room: "kitchen",
        color: "#ee8885",
    },
    {
        id: "water",
        icon: "water",
        label: "Napój",
        room: "kitchen",
        color: "#63b2e1",
    },
    {
        id: "fun",
        icon: "fun",
        label: "Zabawa",
        room: "garden",
        color: "#c7d94e",
    },
    {
        id: "sleep",
        icon: "sleep",
        label: "Sen",
        room: "living",
        color: "#ae95f2",
    },
    {
        id: "clean",
        icon: "clean",
        label: "Mycie",
        room: "bathroom",
        color: "#72d3b0",
    },
    {
        // Czyszczenie łapek szmatką (łazienka) — patrz pawsStart()
        id: "paws",
        icon: "cloth",
        label: "Łapki",
        room: "bathroom",
        color: "#72d3b0",
    },
    {
        id: "brush",
        icon: "brush",
        label: "Szczotkowanie",
        room: "living",
        color: "#72d3b0",
    },
    {
        // Wybór mini-gier (js/games-menu.js) — bez pokoju, piesek nigdzie nie idzie.
        id: "games",
        icon: "cup",
        label: "Gry",
        room: null,
        color: "#f6d36b",
    },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    reduced = matchMedia("(prefers-reduced-motion:reduce)").matches,
    canvas = $("#sceneCanvas"),
    ctx = canvas.getContext("2d"),
    rewardCtx = $(".card canvas").getContext("2d"),
    bubbleWinCtx = $(".bubbleWinDog").getContext("2d"),
    bubbleCanvas = $(".bubbleCanvas"),
    bctx = bubbleCanvas.getContext("2d");
let loaded = false,
    room = "living",
    x = 0.5,
    left = false,
    sleeping = false,
    poop = null,
    stats = {
        food: 50,
        water: 50,
        fun: 50,
        sleep: 50,
        clean: 50,
    },
    selected = "sleep",
    phase = "idle",
    sheet = "a01",
    anim = 16,
    frames = [63],
    ms = 380,
    frameIndex = 0,
    animStart = 0,
    clock = 0,
    last = 0,
    queue = [],
    segment = null,
    idleUntil = 6500,
    nextTrip = 15000,
    nextPoop = 45000,
    nextRegularPoop = 240000,
    nextBubble = 9000,
    nextButterfly = 28000,
    stage = "",
    travelMode = "",
    travelTarget = "",
    jumpY = 0,
    pending = null,
    menu = null,
    gesture = null,
    petFinishAt = Infinity,
    petLast = 0,
    butterfly = null,
    ambient = [], // motylki-tło w ogrodzie/podwórku — dekoracyjne, patrz ambientSpawn/ambientUpdate/ambientDraw
    nextAmbientSpawn = 0,
    // Kret-zapowiedź mini-gry "Kret w ogrodzie" — jeden kopiec na raz,
    // wychodzi/rozgląda się/chowa (patrz moleTeaserSpawn/Update/Draw/Hit).
    moleTeaser = null,
    nextMoleSpawn = 0,
    // Piach zostawiony po schowaniu się kreta — trzeba go kliknąć, żeby
    // posprzątać (patrz moleDirtRect/Hit/cleanMoleDirt). Osobny dla każdej
    // mapki ({ pokój: {x, y} }): dopóki leży w danym pokoju, nowy kret nie
    // wychodzi w TYM pokoju — pozostałe mapy nie są blokowane.
    moleDirts = {},
    // Stłuczone naczynie po zbyt mocnym rzucie w aporcie (patrz minigame-fetch.js):
    // { room, x (0..1), idx (0..3), shown } — leży, aż dziecko je posprzątane.
    dishMess = null,
    // Brudne łapki: 0–100. Rośnie w ogrodzie/na łące/podwórku i po grach w ziemi;
    // w domu piesek gubi grudki (lumps: {room,x,seed}) — sprząta się je dotykiem,
    // a łapki czyści minigra "Czyste łapki" (js/minigame-paws.js).
    pawDirt = 0,
    lumps = [],
    lumpTimer = 0,
    // Motylek nakładany na klatki a02 oznaczone zielonym znacznikiem
    // (#00ff43) podczas pogoni/łapania w butterflyEvent() — patrz
    // catchMarker (wykrywane w boot()) i catchMarkerPos().
    catchButterflyColor = 0,
    catchButterflyStart = 0,
    catchLastSpot = null, // ostatnia pozycja nakładki motylka przy pieskowi (start odlotu)
    bubble = null,
    bubblePos = null,
    scale = 1,
    actions = 0,
    trips = 0,
    lastVariant = "",
    forcedVariant = null,
    orientationPaused = false,
    boneVisible = false,
    dogHidden = false, // Łatka niewidoczna, gdy czeka "za kadrem" na lądowanie piłki (patrz js/minigame-fetch.js)
    toastTimer = null,
    debugRoute = [],
    roomOffset = 0,
    blockedActivity = null;
try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s) {
        room = order.includes(s.room) ? s.room : "living";
        sleeping = !!s.sleeping;
        left = !!s.left;
        poop =
            s.poop && order.includes(s.poop.room)
                ? s.poop
                : order.includes(s.poopRoom)
                  ? {
                        room: s.poopRoom,
                        x: 0.3,
                    }
                  : null;
        moleDirts = {};
        if (s.moleDirts) {
            for (const [r, d] of Object.entries(s.moleDirts)) if (GARDEN_ROOMS.includes(r) && d) moleDirts[r] = d;
        } else if (s.moleDirt && GARDEN_ROOMS.includes(s.moleDirt.room)) moleDirts[s.moleDirt.room] = s.moleDirt; // stary zapis
        pawDirt = clamp(+s.pawDirt || 0, 0, 100);
        lumps = Array.isArray(s.lumps) ? s.lumps.filter((l) => order.includes(l.room)).slice(0, 8) : [];
        dishMess = s.dishMess && order.includes(s.dishMess.room) ? { ...s.dishMess, shown: true } : null;
        if (sleeping) room = "living";
        if (poop?.room === room) sleeping = false;
    }
} catch (e) {}
const getPreset = (s, i) => CFG[s].presets[i],
    numbers = (s) =>
        String(s || "")
            .split(",")
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 72),
    duration = (s, i) => numbers(getPreset(s, i).seq).length * getPreset(s, i).ms;

function currentFrame() {
    return frames[frameIndex % frames.length] || 63;
}

function dirty(r = room) {
    return poop?.room === r;
}

/* ═══════════════════════════════════════════════════════════════
   SMUTNY PIESEK (potrzeba ≤ SAD_THRESHOLD)
   Dziecko samo pilnuje potrzeb — piesek o nie nie woła. Dopiero gdy któraś
   spadnie do 10%, piesek jest smutny: stoi w miejscu, losowo zmienia smutne
   animacje (a02: 26/27/28 → indeksy 25, 26, 27), nie biega sam po domu, a
   nad głową ma dymek z potrzebą, w którym PULSUJE ikonka. Zgadza się tylko
   na to, czego mu brak (SAD_ALLOWS); na resztę reaguje smutkiem —
   najczęściej odwraca się tyłem (sadRefuse). „NIE” (a02 #20) zostaje tylko
   dla pełnych potrzeb (fullRefuse).
   ═══════════════════════════════════════════════════════════════ */
const SAD_THRESHOLD = 10;
const SAD_ANIMS = [25, 26, 27]; // a02: siad i westchnienie, głowa w dół, obrażony tyłem
const SAD_NO_ANIM = 19; // a02: „NIE” — kręci głową
// Co pomaga na którą potrzebę (id pozycji menu / "games" = ekran gier)
const SAD_ALLOWS = { food: ["food"], water: ["water"], sleep: ["sleep"], fun: ["fun", "games", "butterfly"], clean: ["clean", "brush", "paws"] };
let sadLast = -1,
    sadBoostUntil = 0; // chwilowo mocniejsze pulsowanie (po odmowie)

// Najniższa potrzeba ≤ 10% albo null
function sadNeed() {
    let worst = null;
    for (const id of ["food", "water", "fun", "sleep", "clean"]) {
        if (stats[id] <= SAD_THRESHOLD && (worst === null || stats[id] < stats[worst])) worst = id;
    }
    return worst;
}

// Czy smutek blokuje czynność id (bez efektów ubocznych)
function sadBlocks(id) {
    if (sleeping) return false;
    for (const n of ["food", "water", "fun", "sleep", "clean"]) {
        if (stats[n] <= SAD_THRESHOLD && SAD_ALLOWS[n].includes(id)) return false;
    }
    return !!sadNeed();
}

const NEED_GENITIVE = { food: "jedzenia", water: "wody", fun: "zabawy", sleep: "snu", clean: "mycia" };
// Odmowa: kręci głową „NIE”, ikonka w dymku mocniej pulsuje, potem znów smutek
function sadRefuse() {
    const id = sadNeed();
    if (!id) return;
    sadBoostUntil = clock + 1800; // bez tekstu — mówi o tym pulsujący dymek
    if (!casual() && phase !== "sad") return;
    // Odmowa smutnego pieska to NIE kręcenie głową, tylko smutek — najczęściej
    // odwraca się tyłem (obrażony), czasem wzdycha albo spuszcza głowę.
    const r = Math.random(),
        anim = r < 0.6 ? SAD_ANIMS[2] : r < 0.8 ? SAD_ANIMS[0] : SAD_ANIMS[1];
    // już się obraził tyłem — nie zaczynamy od nowa, tylko mocniej pulsuje dymek
    if (stage === "sad-refuse" && anim === sadLast) return;
    sadLast = anim;
    sfx("sad");
    queue = [];
    segment = null;
    phase = "sad";
    stage = "sad-refuse";
    locks();
    startQueue([{ ...repeatPart("a02", anim, 1), onEnd: () => sadContinue() }]);
}

function sadStart() {
    phase = "sad";
    stage = "sad";
    locks();
    sadContinue();
}

// Kolejna losowa smutna animacja (inna niż poprzednia), 2 pełne cykle
function sadContinue() {
    if (!sadNeed() || sleeping) {
        idle(16);
        return;
    }
    let i = SAD_ANIMS[Math.floor(Math.random() * SAD_ANIMS.length)];
    if (i === sadLast) i = SAD_ANIMS[(SAD_ANIMS.indexOf(i) + 1 + Math.floor(Math.random() * (SAD_ANIMS.length - 1))) % SAD_ANIMS.length];
    sadLast = i;
    phase = "sad";
    stage = "sad";
    startQueue([{ ...repeatPart("a02", i, 2), onEnd: () => sadContinue() }]);
}

/* ═══════════════════════════════════════════════════════════════
   REGUŁY DYMKÓW (opis w REGULY.md)
   Potrzeb w dymkach NIE pokazujemy — dziecko samo pilnuje statusów.
   Dymki są zabawą i informacją:
   1) smutny piesek (potrzeba ≤ 10%): dymek z potrzebą cały czas, ikonka
      w nim pulsuje (mocniej po odmowie) — najwyższy priorytet,
   2) leży kupka (czyszczenie)                    — co poopEveryMs,
   3) piesek sam biegnie do innego pokoju: ikona pokoju przez całą drogę,
   4) "chęci" co wishEveryMs (+ losowo): piłka, motylek, kret, serduszko,
      kąpiel (bańki), uśmiech (piesek), kostka; motylek/kret częściej,
      gdy akurat są na ekranie.
   Reakcje na dotyk (serce, gwiazdka) to osobna sprawa i zostają jak były.
   ═══════════════════════════════════════════════════════════════ */
const BUBBLE_RULES = {
    checkEveryMs: 2000,
    showMs: 3500,
    poopEveryMs: 20000,
    wishEveryMs: 22000, // + losowo do wishJitterMs
    wishJitterMs: 16000,
};
const bubbleLast = { poop: -1e9 };
let nextWishBubble = 15000;

// Ikona pokoju (ta sama co na plakietce pokoju) — dymek w drodze do niego.
const ROOM_ICON = { yard: "den", garden: "garden", living: "living", kitchen: "kitchen", bathroom: "bathroom", meadow: "mole" };
const WISH_ICONS = ["fun", "butterfly", "mole", "heart", "bubbles", "bark", "bone"];
let lastWish = "";

function bubbleWish() {
    const ctx = [];
    if (butterfly?.free && !butterfly.lure && butterfly.plan) ctx.push("butterfly");
    if (moleTeaser || moleDirts[room]) ctx.push("mole");
    if (pawDirt >= PAW_DIRTY_AT && INDOOR_ROOMS.includes(room)) ctx.push("cloth"); // "umyj mi łapki"
    const pool = ctx.length && Math.random() < 0.6 ? ctx : WISH_ICONS.filter((w) => w !== lastWish);
    return (lastWish = pool[Math.floor(Math.random() * pool.length)]);
}

// Wołane co klatkę; samo pilnuje częstotliwości.
function bubbleThink() {
    if (sleeping) return;
    const R = BUBBLE_RULES,
        sad = sadNeed();
    // (1) smutek: dymek z potrzebą cały czas, z pulsującą ikonką
    if (sad) {
        if (!bubble || !bubble.sad || bubble.icon !== sad || bubble.until < clock + 400) bubble = { icon: sad, until: clock + 1500, type: UI.bubbleType, pulse: true, sad: true };
        return;
    }
    if (bubble?.sad) bubble = null; // smutek minął — dymek znika od razu
    if (gesture || menu.drag) return;
    // (3) w drodze do innego pokoju: "co mu chodzi po głowie"
    if (phase === "travel" && travelMode === "auto") {
        const icon = ROOM_ICON[travelTarget];
        if (icon && (!bubble || bubble.until < clock + 400)) say(icon, 1200);
        return;
    }
    if (!["idle", "roam", "pause", "look"].includes(phase) || clock < nextBubble) return;
    nextBubble = clock + R.checkEveryMs;
    if (bubble && clock < bubble.until) return;
    if (dirty()) {
        if (clock - bubbleLast.poop >= R.poopEveryMs) {
            bubbleLast.poop = clock;
            say("poop", R.showMs + 500);
        }
        return;
    }
    if (clock >= nextWishBubble) {
        nextWishBubble = clock + R.wishEveryMs + Math.random() * R.wishJitterMs;
        say(bubbleWish(), R.showMs);
    }
}

const NEEDS_KEY = "latka-potrzeby-v1";
const NEEDS_DECAY = { food: 1.1, water: 1.3, fun: 1.2, sleep: 0.8, clean: 0.9 };
const ACTION_EFFECTS = {
    food: { food: 100, water: -3 }, // karmienie najada do pełna
    water: { water: 35 },
    fun: { fun: 24, water: -5, sleep: -4, clean: -8 },
    den: { fun: 16, food: -2, water: -2 },
    clean: { clean: 100, paws: -100 }, // udana kąpiel: piesek cały czysty, łapki też
    brush: { clean: 12, fun: 5 },
    // Zabawa w kreta — radość jak przy aporcie/bańkach, ale piesek się przy
    // tym trochę brudzi, głoduje i chce pić (patrz js/minigame-mole.js).
    mole: { fun: 26, clean: -14, food: -5, water: -6, paws: 15 },
    // Jeżyk i owoce (js/minigame-hedge.js) — zdrowa zabawa na trawie.
    hedgehog: { fun: 24, water: -4, clean: -7, paws: 8 },
    memory: { fun: 24, water: -3, clean: -4 },
    pairs: { fun: 20, water: -2, clean: -4 },
    bones: { fun: 22, water: -3, clean: -4, paws: 8 },
    // Złapany motylek — krótka, lekka frajda.
    butterfly: { fun: 6, water: -1, clean: -2 },
    // Pojedynczy rzut piłki w aporcie (minigame-fetch.js).
    throw: { fun: 5, water: -2, sleep: -1, clean: -3 },
    // Posprzątanie kupki / piachu po krecie.
    poop: { clean: 6 },
    moleDirt: { clean: 2 },
    // Czyste łapki (minigame-paws.js)
    paws: { clean: 25, fun: 6 },
};
let needsSaveSeconds = 0;
function changeNeeds(changes) {
    for (const [k, v] of Object.entries(changes)) {
        if (Object.prototype.hasOwnProperty.call(stats, k)) stats[k] = clamp(stats[k] + v, 0, 100);
        else if (k === "paws") pawDirt = clamp(pawDirt + v, 0, 100);
    }
    if (loaded) statusUpdate();
}
function saveNeeds() {
    try {
        localStorage.setItem(NEEDS_KEY, JSON.stringify({ version: 1, stats: { ...stats } }));
    } catch (e) {
        console.warn(e);
    }
}
function loadNeeds() {
    Object.assign(stats, { food: 75, water: 75, fun: 70, sleep: 80, clean: 85 });
    try {
        const a = JSON.parse(localStorage.getItem(NEEDS_KEY) || "null");
        if (a?.version === 1 && a.stats) {
            for (const k of Object.keys(NEEDS_DECAY)) {
                const v = a.stats[k];
                if (typeof v === "number" && Number.isFinite(v)) stats[k] = clamp(v, 0, 100);
            }
        }
    } catch (e) {
        console.warn(e);
    }
}
function updateNeeds(seconds) {
    if (!loaded || seconds <= 0) return;
    const m = seconds / 60;
    for (const [k, r] of Object.entries(NEEDS_DECAY)) {
        if (sleeping && k === "sleep") continue;
        // brudne łapki = piesek brudzi się szybciej (do 2× przy bardzo brudnych)
        const dirt = k === "clean" ? 1 + pawDirt / 100 : 1;
        stats[k] = clamp(stats[k] - r * m * dirt * (sleeping ? 0.5 : 1), 0, 100);
    }
    if (sleeping) {
        stats.sleep = clamp(stats.sleep + 12 * m, 0, 100);
        if (stats.sleep >= 100) {
            wake();
            say("heart", 2200);
        }
    }
    if (poop) stats.clean = clamp(stats.clean - 0.8 * m, 0, 100);
    if (pawDirt >= 35) stats.clean = clamp(stats.clean - 0.4 * m, 0, 100); // brudne łapki trochę brudzą
    lumpUpdate(seconds);
    statusUpdate();
    needsSaveSeconds += seconds;
    if (needsSaveSeconds >= 10) {
        needsSaveSeconds = 0;
        saveNeeds();
    }
}
// ── Brudne łapki i grudki w domu ────────────────────────────────
const OUTDOOR_ROOMS = ["meadow", "garden", "yard"],
    INDOOR_ROOMS = ["living", "kitchen", "bathroom"],
    PAW_DIRTY_AT = 35,
    LUMP_COLORS = ["#5a3a1c", "#7a4f24", "#3e2812", "#946032"];
let lumpLastX = null,
    lumpLastRoom = null,
    lumpDist = 0;
function lumpUpdate(s) {
    if (!loaded || sleeping) return;
    updatePawsUi();
    // droga przebyta w tym pokoju (px) — grudki zostają tylko za pieskiem W RUCHU
    const moved = lumpLastRoom === room && lumpLastX !== null ? Math.abs(x - lumpLastX) * W : 0;
    lumpLastX = x;
    lumpLastRoom = room;
    if (OUTDOOR_ROOMS.includes(room)) {
        pawDirt = Math.min(100, pawDirt + 0.15 * s); // ~11 min do bardzo brudnych łapek
        return;
    }
    if (pawDirt < 45 || !INDOOR_ROOMS.includes(room) || moved > 80 || phase === "paws-clean") return; // skok pozycji (zmiana pokoju) nie liczy się
    lumpDist += moved;
    if (lumpDist < 320) return;
    lumpDist = 0;
    if (lumps.length >= 4) return;
    lumps.push({ room, x: clamp(x + (left ? 1 : -1) * (0.04 + Math.random() * 0.05), 0.08, 0.92), seed: Math.floor(Math.random() * 1000) });
    pawDirt = Math.max(0, pawDirt - 8);
    save();
}
function lumpBox(l) {
    const offset = (order.indexOf(l.room) - order.indexOf(room)) * W + roomOffset;
    return { x: l.x * W - 18 + offset, y: GROUND + 14 + (l.seed % 3) * 7, w: 36, h: 20 };
}
function lumpHit(px, py) {
    for (let i = lumps.length - 1; i >= 0; i--) {
        if (lumps[i].room !== room) continue;
        const b = lumpBox(lumps[i]);
        if (px > b.x - 14 && px < b.x + b.w + 14 && py > b.y - 16 && py < b.y + b.h + 16) return i;
    }
    return -1;
}
function cleanLump(i) {
    if (!casual() || !lumps[i]) return;
    lumps.splice(i, 1);
    sfx("wipe");
    changeNeeds({ clean: 1.5 });
    save();
}
function lumpDraw() {
    for (const l of lumps) {
        if (Math.abs(order.indexOf(l.room) - order.indexOf(room)) > 1) continue;
        const b = lumpBox(l);
        let r = l.seed + 1;
        ctx.fillStyle = "rgba(0,0,0,0.18)"; // cień pod grudką
        ctx.fillRect(Math.round(b.x) + 2, Math.round(b.y) + 16, 32, 4);
        for (let k = 0; k < 9; k++) {
            r = (r * 9301 + 49297) % 233280;
            const px = Math.floor((r / 233280) * 6) * 6,
                py = Math.floor((((r * 7) % 233280) / 233280) * 3) * 5 + (k % 2) * 2;
            ctx.fillStyle = LUMP_COLORS[(r >> 3) % LUMP_COLORS.length];
            ctx.fillRect(Math.round(b.x + px), Math.round(b.y + py), 6, 6);
        }
    }
}

function save() {
    if (!loaded) return;
    try {
        localStorage.setItem(KEY, JSON.stringify({ room, sleeping, left, poop, moleDirts, dishMess: dishMess?.shown ? dishMess : null, pawDirt: Math.round(pawDirt), lumps }));
    } catch (e) {}
    saveNeeds();
}

// Teksty na dole ekranu są wyłączone — gra mówi do dziecka dymkami
// (sayPulse). Funkcja zostaje, żeby stare wywołania nic nie psuły.
function toast(s) {
    console.info("[toast wyłączony]", s);
}

// Dymek z PULSUJĄCĄ ikonką — "nie mogę / potrzebuję". strong = mocniej
// i szybciej (po odmowie). Dymek smutku (sad) ma pierwszeństwo.
function sayPulse(icon, ms = 3000, strong = true) {
    bubble = { icon, until: clock + ms, type: UI.bubbleType, pulse: true };
    if (strong) sadBoostUntil = clock + Math.min(ms, 1800);
}

// Odmowa z konkretnego powodu (np. kupka): kręci głową „NIE” + pulsująca ikonka
// (bez kręcenia głową — „NIE” jest tylko przy pełnych potrzebach, fullRefuse)
function refuseWith(icon) {
    if (sadNeed()) return sadRefuse();
    sayPulse(icon, 3200, true);
}

// Pełna potrzeba (≥ FULL_AT): piesek kręci głową „NIE”. Nie dotyczy zabawy —
// w gry, aport i motylki można się bawić zawsze.
const FULL_AT = 95;
const FULL_NEED = { food: "food", water: "water", sleep: "sleep", clean: "clean", brush: "clean" };
function fullRefuse(id) {
    const need = FULL_NEED[id];
    if (!need || stats[need] < FULL_AT || sadNeed()) return false;
    if (need === "clean" && pawDirt >= 3) return false; // czysty, ale z brudnymi łapkami — myć wolno
    if (casual()) {
        idle(16);
        phase = "reaction";
        stage = "refuse";
        locks();
        startQueue([repeatPart("a02", SAD_NO_ANIM, 2)]);
    }
    return true;
}

function resize() {
    const v = window.visualViewport,
        vw = v?.width || innerWidth,
        vh = v?.height || innerHeight;
    scale = Math.max(0.03, Math.min(vw / W, vh / H));
    const g = $("#game");
    g.style.transform = `scale(${scale})`;
    g.style.left = (v?.offsetLeft || 0) + (vw - W * scale) / 2 + "px";
    g.style.top = (v?.offsetTop || 0) + (vh - H * scale) / 2 + "px";
    orientationPaused = matchMedia("(orientation:landscape) and (pointer:coarse)").matches;
    if (orientationPaused && gesture) {
        if (gesture.kind === "pet") stopPetting();
        if (phase === "swipe-preview") {
            phase = "idle";
            setOffset(0);
            locks();
        }
        gesture = null;
    }
    last = 0;
    menu?.measure();
    menu?.render();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
window.visualViewport?.addEventListener("resize", resize);
window.visualViewport?.addEventListener("scroll", resize);
resize();

function setAnim(s, i, tempo) {
    sheet = s;
    anim = i;
    frames = numbers(getPreset(s, i).seq);
    ms = tempo || getPreset(s, i).ms;
    frameIndex = 0;
    animStart = clock;
}

function setFrames(s, a, time) {
    sheet = s;
    anim = -1;
    frames = a;
    ms = time;
    frameIndex = 0;
    animStart = clock;
}

function setOffset(v) {
    roomOffset = v;
    $(".roomTrack").style.transform = `translateX(${v}px)`;
}

function roomSVG(r) {
    const src = (P.assets.rooms && P.assets.rooms[r]) || "tla/001.png";
    return `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;
}

function buildRooms() {
    const root = $(".roomTrack");
    root.innerHTML = "";
    const n = order.indexOf(room);
    for (let i = Math.max(0, n - 1); i <= Math.min(order.length - 1, n + 1); i++) {
        const p = document.createElement("div");
        p.className = "roomPanel";
        p.dataset.room = order[i];
        p.style.left = (i - n) * 100 + "%";
        p.innerHTML = roomSVG(order[i]);
        root.append(p);
    }
}

function setRoom(r) {
    room = r;
    // Motylki-tło generowane od nowa w każdym pokoju (nie mają "przelatywać"
    // ze sobą między planszami) — i własny, świeży odliczany czas do
    // następnego wlotu, niezależny od tego, ile zostało w poprzednim
    // pokoju (inaczej potrafiły długo nie pojawić się w nowym pokoju).
    ambient.length = 0;
    nextAmbientSpawn = clock + 3000 + Math.random() * 7000;
    moleTeaser = null;
    nextMoleSpawn = clock + 5000 + Math.random() * 12500;
    hedgehog = null;
    hedgeFruit = null;
    nextHedgehogSpawn = clock + 6000 + Math.random() * 14000;
    nextButterfly = clock + 4000 + Math.random() * 8500;
    if (butterfly?.free) butterfly = null;
    updateMoleDirtAccess();
    buildRooms();
    setOffset(0);
    const key = {
        yard: "den",
        garden: "garden",
        living: "living",
        kitchen: "kitchen",
        bathroom: "bathroom",
        // Ikona kreta — zapowiedź przyszłej mini-gry "Złap kreta" na łące.
        meadow: "mole",
    }[r];
    $(".roomBadge img").src = icons[key];
    $(".roomBadge img").alt = {
        yard: "Podwórko z budą",
        garden: "Ogród",
        living: "Salon",
        kitchen: "Kuchnia",
        bathroom: "Łazienka",
        meadow: "Łąka",
    }[r];
    syncMenu();
    updateArrows();
    updatePoopAccess();
    debugRoute.push(r);
    save();
}

function heart() {
    return Object.values(stats).reduce((a, b) => a + b, 0) / 5;
}

// Wyraźniejsze kolory wypełnienia kółek potrzeb (czystość — miętowa, żeby
// nie myliła się z żółtym ostrzeżeniem)
const STAT_FILL = { food: "#ea6a66", water: "#3c9fda", fun: "#b9cf22", sleep: "#9a7bef", clean: "#4fc89c" };
const STAT_WARN = "#f0c535", // ≤ 40%
    STAT_CRIT = "#e84b4b"; // ≤ 10%

function statusBuild() {
    const statsRow = document.createElement("div");
    statsRow.className = "status-stats";

    const labels = { food: "Głód", water: "Woda", fun: "Zabawa", sleep: "Sen", clean: "Czystość" };
    for (const key of ["food", "water", "fun", "sleep", "clean"]) {
        const el = document.createElement("div");
        el.className = "stat";
        el.dataset.status = key;
        el.style.setProperty("--c", STAT_FILL[key]);
        // kółko = "naczynie": tło wypełnia się od dołu wg stanu potrzeby
        const ring = document.createElement("div");
        ring.className = "statRing";
        const fill = document.createElement("i");
        fill.className = "statFill";
        const im = new Image();
        im.src = icons[key];
        im.alt = labels[key];
        im.width = im.height = 40;
        ring.append(fill, im);
        el.append(ring);
        statsRow.append(el);
    }
    $(".status").append(statsRow);

    // Serduszko — żyje w pasku sceny (HTML już go ma, tu tylko podpinamy ikonę)
    const heartBadge = $(".heartBadge");
    if (heartBadge) heartBadge.querySelector("img").src = icons["heart"];

    statusUpdate();
}

function statusUpdate() {
    document.body.classList.toggle("sadLock", !!sadNeed() && !sleeping);
    // 5 potrzeb z dynamicznym kolorem paska
    document.querySelectorAll(".stat[data-status]").forEach((el) => {
        const v = stats[el.dataset.status];
        if (v === undefined) return;
        const fill = el.querySelector(".statFill");
        fill.style.height = clamp(v, 0, 100) + "%";
        const col = v <= SAD_THRESHOLD ? STAT_CRIT : v <= 40 ? STAT_WARN : STAT_FILL[el.dataset.status];
        fill.style.background = col;
        el.style.setProperty("--tint", col);
        el.classList.toggle("crit", v <= SAD_THRESHOLD); // czerwony → ikona pulsuje
        el.setAttribute("aria-label", el.querySelector("img").alt + ": " + Math.round(v) + "%");
    });

    // Serduszko
    const heartBadge = $(".heartBadge");
    if (heartBadge) {
        const v = heart();
        const fill = heartBadge.querySelector("i");
        fill.style.width = v + "%";
        fill.style.background = v <= 25 ? "#e84b4b" : v <= 50 ? "#f0a060" : "#f4a0bc";
        heartBadge.setAttribute("aria-label", "Samopoczucie Łatki: " + Math.round(v) + "%");
    }
}

function syncMenu() {
    const allowed = items.filter((i) => i.room === room);
    if (!allowed.length) return;
    const score = (i) => stats[i.id === "den" ? "fun" : i.id === "brush" || i.id === "paws" ? "clean" : i.id] ?? 50;
    const min = Math.min(...allowed.map(score)),
        tied = allowed.filter((i) => score(i) === min);
    selected = tied.some((i) => i.id === selected) ? selected : tied[0].id;
    // menu?.select(selected, { animate: false });
}

// Wejście do mini-gry z Łąki (kret, jeżyk) działa też, gdy piesek akurat
// reaguje na dotyk / robi coś krótkiego — dotyk dziecka ma pierwszeństwo.
function gameEntryOk() {
    if (sadBlocks("games")) return false;
    return casual() || (loaded && !sleeping && ["reaction"].includes(phase));
}

function casual() {
    // "butterfly" (piesek bawi się ze złapanym motylkiem) celowo NIE jest
    // tu wymieniony — to zdarzenie, raz uruchomione, musi dobiec końca.
    // Dzięki temu wszystkie wejścia bramkowane przez casual()/interrupt()
    // (strzałki, głaskanie, menu, swipe) są podczas niego zablokowane.
    return loaded && ["idle", "roam", "pause", "look", "sad"].includes(phase);
}

function canPet() {
    return casual() || phase === "petting";
}

function locks() {
    // W czasie czekania na rzut / łapania baniek menu zostaje aktywne,
    // żeby dało się wyjść z zabawy
    document.body.classList.toggle("locked", !casual() && phase !== "ball-ready" && phase !== "bubble-game" && phase !== "mole-game");
    document.querySelectorAll(".arrow").forEach((b) => (b.disabled = !casual()));
    $(".petAccess").disabled = !canPet();
    updatePawsUi();
    updateArrows();
    updateFetchUi();
    updateBubbleUi();
    updateMoleUi();
}

function updateArrows() {
    const n = order.indexOf(room);
    $(".arrow.prev").hidden = n === 0;
    $(".arrow.next").hidden = n === order.length - 1;
}

function updatePoopAccess() {
    $(".poopAccess").hidden = !dirty();
}

function interrupt() {
    if (!casual()) return;
    queue = [];
    segment = null;
    if (phase === "butterfly") {
        butterfly = null;
        nextButterfly = clock + 22500;
    }
    phase = "idle";
    jumpY = 0;
    setAnim("a01", 16);
    locks();
}

function wake() {
    if (!sleeping) return;
    sleeping = false;
    setAnim("a01", 16);
    idleUntil = clock + 4000;
    save();
}

function say(icon, time = 2600, type = UI.bubbleType) {
    if (!bubble || bubble.icon !== icon) sfx(bubble?.sad ? "need" : "bubble");
    bubble = {
        icon,
        until: clock + time,
        type,
    };
}

function idle(which = null) {
    phase = "idle";
    stage = "";
    queue = [];
    segment = null;
    pending = null;
    jumpY = 0;
    boneVisible = false;
    // Swobodnie lecący, klikalny motylek (free) żyje własnym życiem i NIE znika
    // przy każdym powrocie pieska do idle() — dawniej to powodowało, że
    // pojawiał się na ułamek sekundy i od razu znikał.
    if (!butterfly?.free) butterfly = null;
    ball = null;
    fetchGame = null;
    dogHidden = false;
    bubbleGame = null;
    moleGame = null;
    hedgeGame = null;
    mole2Game = null;
    memoGame = null;
    if (typeof pairsGame !== "undefined" && pairsGame) {
        clearTimeout(pairsGame.timer);
        pairsGame = null;
        $(".pairsFull").hidden = true;
    }
    setOffset(0);
    setAnim("a01", which ?? (Math.random() < 0.35 ? 18 : 16));
    idleUntil = clock + Math.max(frames.length * ms, 1800) + Math.random() * 2000;
    locks();
    save();
}

function startQueue(parts) {
    queue = parts;
    nextSegment();
}

function nextSegment() {
    segment = queue.shift();
    if (!segment) {
        idle();
        return;
    }
    segment.started = clock;
    segment.onStart?.();
    if (segment.sheet && segment.anim !== undefined) setAnim(segment.sheet, segment.anim, segment.tempo);
    if (segment.frames) setFrames(segment.sheet || "a01", segment.frames, segment.tempo || 200);
    if (segment.from !== undefined) x = segment.from;
    segment.origin = x;
    if (segment.facing !== undefined) left = segment.facing;
    else if (segment.to !== undefined && Math.abs(segment.to - x) > 0.001) left = segment.to < x;
    segment.distance = segment.to === undefined ? 0 : Math.abs(segment.to - x) * W;
}

function blockRoomActivity(id) {
    if (!dirty()) return false;
    idle(16);
    blockedActivity = id;
    refuseWith("poop"); // „NIE” + pulsująca kupka w dymku
    return true;
}

function rewardParts() {
    const id = pending;
    return [
        {
            sheet: "a01",
            anim: 16,
            time: 1000,
            onStart: () => {
                if (ACTION_EFFECTS[id]) {
                    changeNeeds(ACTION_EFFECTS[id]);
                    save();
                }
                $(".popup").hidden = false;
                $(".reward").src = icons.heart;
            },
            onEnd: () => ($(".popup").hidden = true),
        },
    ];
}

function repeatPart(s, i, times = 1) {
    return {
        sheet: s,
        anim: i,
        time: duration(s, i) * times,
    };
}

function activity(id) {
    if (!dirty()) {
        // Najedzony / napojony: bez tekstu — piesek kręci głową „NIE”.
        // (Potrzeb pilnuje smutek przy ≤10%, patrz sadBlocks().)
        if (FULL_NEED[id] && stats[FULL_NEED[id]] >= FULL_AT && !(FULL_NEED[id] === "clean" && pawDirt >= 3)) {
            idle(16);
            fullRefuse(id);
            return;
        }
    }

    if (blockRoomActivity(id)) return;
    pending = id;
    if (id === "paws") {
        pending = null;
        pawsStart();
        return;
    }
    if (id === "sleep") {
        sleeping = true;
        phase = "idle";
        queue = [];
        segment = null;
        setAnim("a02", 6);
        say("sleep", 2600);
        locks();
        save();
        return;
    }
    if (id === "fun") {
        // Zabawa = aport: dziecko rzuca piłkę, Łatka biega po nią.
        // Najpierw krótki pop-up z instrukcją, start dopiero po "OK".
        ballIntroShow(fetchStart);
        return;
    }
    if (id === "clean") {
        // Mycie = łapanie baniek na całym ekranie (najpierw krótki tutorial).
        bubbleIntroShow(bubbleStart);
        return;
    }
    phase = "activity";
    locks();
    let parts = [];
    if (id === "food") parts = [repeatPart("a01", 5)];
    else if (id === "water") parts = [repeatPart("a01", 2)];
    else if (id === "brush") {
        const p = getPreset("a02", 21);
        if (numbers(p.intro).length)
            parts.push({
                sheet: "a02",
                frames: numbers(p.intro),
                tempo: p.ms,
                time: numbers(p.intro).length * p.ms,
            });
        parts.push(repeatPart("a02", 21));
        if (numbers(p.outro).length)
            parts.push({
                sheet: "a02",
                frames: numbers(p.outro),
                tempo: p.ms,
                time: numbers(p.outro).length * p.ms,
            });
    } else if (id === "den")
        parts = [
            {
                sheet: "a01",
                anim: 18,
                time: 3600,
                onStart: () => (boneVisible = true),
                onEnd: () => (boneVisible = false),
            },
        ];
    else parts = [repeatPart("a02", 8 + Math.floor(Math.random() * 6), 2)];
    parts.push(...rewardParts());
    startQueue(parts);
}

function chooseVariant() {
    let v = forcedVariant;
    if (v) {
        forcedVariant = null;
        lastVariant = v;
        return v;
    }
    const r = Math.random();
    v = r < 0.5 ? "roll" : r < 0.85 ? "run" : "happy";
    if (v === lastVariant) v = v === "roll" ? "run" : "roll";
    lastVariant = v;
    return v;
}

function finishTravel(id) {
    nextTrip = clock + 15000 + Math.random() * 15000;
    if (id) activity(id);
    else {
        idle(16);
        if (dirty()) say("poop", 3500);
    }
}
// Arrow timing is calmer; ordinary animations retain the user's configured timing.
function arrowTravel(r, dir) {
    interrupt();
    wake();
    phase = "travel";
    travelMode = "arrow";
    left = dir < 0;
    bubble = null;
    locks();
    const facing = dir < 0,
        edge = dir > 0 ? 0.82 : 0.18,
        exit = dir > 0 ? 1.06 : -0.06,
        entry = dir > 0 ? -0.06 : 1.06,
        land = dir > 0 ? 0.18 : 0.82,
        variant = chooseVariant();
    let changed = false;
    const parts = [
        {
            sheet: "a01",
            anim: 1,
            tempo: 180,
            facing,
            to: edge,
            motion: "run",
            time: Math.max(240, ((Math.abs(edge - x) * W) / 430) * 1000),
            onStart: () => (stage = "run"),
        },
        variant === "roll"
            ? {
                  sheet: "a01",
                  anim: 0,
                  tempo: 155,
                  facing,
                  time: reduced ? 160 : 520,
                  onStart: () => (stage = "jump"),
                  update: (p) => {
                      if (p >= 0.5 && !changed) {
                          setRoom(r);
                          changed = true;
                      }
                      x = p < 0.5 ? edge + (exit - edge) * p * 2 : entry + (land - entry) * (p - 0.5) * 2;
                      jumpY = reduced ? 0 : -Math.sin(Math.PI * p) * 35;
                  },
                  onEnd: () => {
                      if (!changed) setRoom(r);
                      x = land;
                      jumpY = 0;
                  },
              }
            : {
                  sheet: "a01",
                  anim: 1,
                  tempo: 180,
                  facing,
                  time: reduced ? 160 : 520,
                  onStart: () => (stage = "run"),
                  update: (p) => {
                      if (p >= 0.5 && !changed) {
                          setRoom(r);
                          changed = true;
                      }
                      x = p < 0.5 ? edge + (exit - edge) * p * 2 : entry + (land - entry) * (p - 0.5) * 2;
                  },
                  onEnd: () => {
                      if (!changed) setRoom(r);
                      x = land;
                  },
              },
        {
            sheet: "a01",
            anim: variant === "roll" ? 9 : 1,
            tempo: variant === "roll" ? 225 : 180,
            facing,
            from: land,
            to: 0.5,
            motion: variant === "roll" ? null : "run",
            time: variant === "roll" ? 750 : ((Math.abs(0.5 - land) * W) / 300) * 1000,
            onStart: () => (stage = "arrival"),
        },
    ];
    parts.push({
        sheet: "a01",
        anim: 16,
        facing,
        time: 220,
        onEnd: () => finishTravel(null),
    });
    startQueue(parts);
}

function stepRoom(d) {
    if (!casual()) return;
    // smutny piesek (potrzeba ≤10%) nie chodzi strzałkami/przesunięciem —
    // ruszy się dopiero po wybraniu w menu tego, czego mu brak
    if (sadNeed() && !sleeping) return sadRefuse();
    const n = order.indexOf(room) + d;
    if (n < 0 || n >= order.length) return;
    arrowTravel(order[n], d);
}

function route(target, id = null, mode = "menu") {
    if (!casual() || !order.includes(target)) return;
    interrupt();
    wake();
    phase = "travel";
    travelMode = mode;
    travelTarget = target;
    pending = id;
    bubble = null;
    locks();
    const from = order.indexOf(room),
        to = order.indexOf(target),
        distance = Math.abs(to - from),
        dir = to >= from ? 1 : -1,
        facing = dir < 0,
        run = true, // zawsze bieg (anim 02. Bieg/sus), spacer usunięty
        speed = 300, // px/s: spokojnie, żeby dziecko widziało, dokąd piesek biegnie
        parts = [];

    function movement(a, b, onEnd) {
        return {
            sheet: "a01",
            anim: run ? 1 : 6,
            tempo: 180,
            motion: run ? "run" : "walk",
            facing,
            from: a,
            to: b,
            time: Math.max(160, ((Math.abs(b - a) * W) / speed) * 1000),
            onStart: () => (stage = run ? "route-run" : "route-walk"),
            onEnd,
        };
    }
    let finalFacing = facing;
    if (!distance) {
        // Piesek już jest w tym pokoju. Jeśli stoi poza środkiem (gdzie są
        // rysowane miski/aktywności), ma się obrócić w stronę środka i podejść
        // tam spokojnym krokiem — kierunek liczony lokalnie (x vs 0.5), a nie
        // z `dir`, który dla tego samego pokoju zawsze wychodzi "w prawo" i
        // powodował nienaturalne cofanie się.
        if (Math.abs(x - 0.5) * W > 2) {
            const localFacing = x > 0.5; // trzeba iść w lewo -> patrzy w lewo
            parts.push({
                sheet: "a01",
                anim: 6, // 07. Marsz
                tempo: 200,
                motion: "walk",
                facing: localFacing,
                from: x,
                to: 0.5,
                // 60px/s — ta sama prędkość co w localWalk() dla tej animacji,
                // bo krok nóg (stride w loopFrame) jest do niej dopasowany;
                // przy wyższej prędkości nogi "migały" nienaturalnie szybko.
                time: Math.max(220, ((Math.abs(x - 0.5) * W) / 60) * 1000),
                onStart: () => (stage = "route-walk"),
            });
            finalFacing = localFacing;
        } else finalFacing = left; // już na miejscu — nie zmieniaj obrotu bez powodu
    } else {
        let origin = x;
        for (let i = from; i !== to; i += dir) {
            const r = order[i + dir];
            parts.push(
                movement(origin, dir > 0 ? 1.08 : -0.08, () => {
                    setRoom(r);
                    x = dir > 0 ? -0.08 : 1.08;
                })
            );
            origin = dir > 0 ? -0.08 : 1.08;
        }
        if (mode === "auto" && target === "garden" && run && Math.random() < 0.3)
            parts.push({
                sheet: "a01",
                anim: 9,
                tempo: 225,
                facing,
                from: origin,
                to: 0.5,
                time: 750,
                onStart: () => (stage = "route-roll"),
            });
        else parts.push(movement(origin, 0.5));
    }
    parts.push({
        sheet: "a01",
        anim: 16,
        facing: finalFacing,
        time: 220,
        onEnd: () => finishTravel(id),
    });
    startQueue(parts);
}

function action(id) {
    // Z czekania na rzut / łapania baniek można wyjść wybierając inną czynność
    if (phase === "ball-ready") {
        fetchGame = null;
        ball = null;
        idle(16);
    }
    if (phase === "bubble-game") {
        bubbleGame = null;
        idle(16);
    }
    if (id === "games") {
        // Puchar działa zawsze: budzi śpiącego pieska i przerywa autonomiczny bieg.
        if (!loaded || phase === "games-menu") return;
        if (sadBlocks("games")) return sadRefuse();
        if (sleeping) wake();
        if (!gameEntryOk() && !(phase === "travel" && travelMode === "auto") && !sleeping) return;
        if (!casual()) idle(16);
        interrupt();
        gamesShow();
        return;
    }
    if (!casual()) return;
    const i = items.find((i) => i.id === id);
    if (!i) return;
    if (sadBlocks(id)) {
        sadRefuse();
        return;
    }
    if (fullRefuse(id)) return; // najedzony / napojony / wyspany / czysty — „NIE”
    if (id === "paws" && pawDirt < 3) return refuseWith("cloth"); // łapki czyste — „NIE” + szmatka w dymku
    if (i.room === room && dirty()) {
        interrupt();
        blockRoomActivity(id);
        return;
    }
    if (id === "sleep" && sleeping) return;
    actions++;
    route(i.room, id, "menu");
}

function react() {
    if (!casual()) return;
    if (sadBlocks("pet")) return sadRefuse();
    interrupt();
    wake();
    phase = "reaction";
    locks();
    say("heart");
    startQueue([repeatPart("a01", [10, 12, 7, 15][Math.floor(Math.random() * 4)])]);
}

function startPetting() {
    if (!canPet()) return;
    if (sadBlocks("pet")) return sadRefuse();
    if (phase !== "petting") {
        interrupt();
        wake();
        phase = "petting";
        queue = [];
        segment = null;
        setFrames("a01", [39, 40, 39, 40, 45], 280);
        anim = 10;
        locks();
        say("heart", 5000);
    }
    petLast = clock;
    petFinishAt = Infinity;
}

function stopPetting() {
    if (phase !== "petting") return;
    const cycle = frames.length * ms;
    petFinishAt = clock + (cycle - ((clock - animStart) % cycle));
}

function endPetting() {
    phase = "reaction";
    startQueue([
        {
            sheet: "a01",
            frames: [46],
            tempo: 250,
            time: 250,
        },
    ]);
}

function geometry() {
    const f = currentFrame(),
        o = {
            x: 0,
            y: 0,
            scale: 100,
            ...CFG[sheet].offsets[String(f)],
        };
    return {
        f,
        o,
        s:
            ((BASE * o.scale) / 100) *
            (sheet === "a01" && anim === 1 ? 1.04 : 1) *
            (sheet === "a01" && anim === 10 ? 1.05 : 1) *
            (sheet === "a01" && (anim === 5 || anim === 2) ? 1.1 : 1) * // jedzenie i picie: piesek o 10% większy
            0.7,
        w: cells[sheet][f - 1].width,
        h: cells[sheet][f - 1].height,
        g: CFG[sheet].ground,
    };
}

function drawDog(c, cx = x * W, gy = GROUND + jumpY, facing = left, ratio = 1) {
    const g = geometry();
    c.save();
    c.translate(cx, gy);
    if (facing) c.scale(-1, 1);
    c.translate(g.o.x * BASE * ratio, g.o.y * BASE * ratio);
    c.scale(g.s * ratio, g.s * ratio);
    c.imageSmoothingEnabled = false;
    c.drawImage(cells[sheet][g.f - 1], -g.w / 2, -g.g);
    if (pawDirt >= 4) {
        c.translate(-g.w / 2, -g.g);
        pawDirtDraw(c, sheet, g.f, pawDirt / 100);
    }
    c.restore();
}

// Grudki ziemi na łapkach — liczone z każdej klatki (najniższe piksele sierści
// w kolumnach, więc podążają za łapą także w biegu), bez osobnego arkusza.
// Kolejność grudek jest stała dla klatki: mniej brudu = mniej grudek (znikają
// grupami, nie piksel po pikselu). Rysowane w układzie komórki arkusza.
const PAW_BUCKET = 14, // szerokość „pasa” brudu w pikselach komórki arkusza (czyszczony osobno)
    PAW_DIRT_COLORS = ["#c9a066", "#6a4524", "#a56a3a", "#d9b87f", "#4a2e17"],
    pawDirtCache = {};
// Brud sypie się wokół punktów łap z ręcznie narysowanych siatek
// (animacje/latka-animacje-0N-lapki-nos-ogon.png → szkielet.json, patrz
// narzedzia/szkielet.py). W animacjach, w których łapy się nie ruszają, punkty są
// wspólne dla wszystkich klatek, więc brud stoi w miejscu; w fikołku i przy
// uniesionej łapie jedzie razem z punktem. Klatki bez punktów łap — bez brudu.
// Wzorzec grudek (przesunięcia, kolory, kolejność znikania) jest stały dla łapy.
let skeleton = null,
    pawDirtTemplate = null;
function pawDirtMake() {
    let seed = 4242;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280),
        out = [];
    for (let i = 0; i < 120; i++) {
        const t = { ox: Math.round(rnd() * 18 - 9), oy: Math.round(rnd() * 12 - 6), thr: rnd(), steps: [] },
            len = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < len; k++) t.steps.push({ col: PAW_DIRT_COLORS[Math.floor(rnd() * PAW_DIRT_COLORS.length)], d: Math.floor(rnd() * 4) });
        out.push(t);
    }
    return out;
}
function pawDirtBlobs(sh, f) {
    const key = sh + f;
    if (pawDirtCache[key]) return pawDirtCache[key];
    pawDirtTemplate ||= pawDirtMake();
    const paws = skeleton?.[sh]?.[f - 1]?.paws || [],
        blobs = [];
    if (paws.length) {
        const cell = cells[sh][f - 1],
            w = cell.width,
            h = cell.height,
            src = cell.getContext("2d").getImageData(0, 0, w, h).data,
            px = 3,
            PER_PAW = 9;
        paws.forEach(([pxx, pyy], k) => {
            for (let j = 0; j < PER_PAW; j++) {
                const t = pawDirtTemplate[(k * PER_PAW + j) % pawDirtTemplate.length],
                    thr = (j + t.thr) / PER_PAW; // równo rozłożone progi: każda łapa brudzi się tak samo
                let gx = Math.floor((pxx + t.ox) / px),
                    gy = Math.floor((pyy + t.oy) / px);
                const mx0 = Math.floor(gx * px + px / 2),
                    my0 = Math.floor(gy * px + px / 2);
                // przesunięcie wypadło poza psa → kładziemy grudkę dokładnie na punkcie łapy
                if (!(mx0 >= 0 && my0 >= 0 && mx0 < w && my0 < h && src[(my0 * w + mx0) * 4 + 3] > 128)) {
                    gx = Math.floor(pxx / px);
                    gy = Math.floor(pyy / px);
                }
                const list = [];
                for (const s of t.steps) {
                    const mx = Math.floor(gx * px + px / 2),
                        my = Math.floor(gy * px + px / 2);
                    // tylko na pieskiem (nie na tle)
                    if (mx >= 0 && my >= 0 && mx < w && my < h && src[(my * w + mx) * 4 + 3] > 128) list.push({ x: gx * px, y: gy * px, col: s.col });
                    gx += [1, -1, 0, 0][s.d];
                    gy += [0, 0, 1, -1][s.d];
                }
                if (list.length) blobs.push({ list, px, thr, bucket: Math.floor(pxx / PAW_BUCKET) });
            }
        });
    }
    return (pawDirtCache[key] = blobs);
}
function pawDirtDraw(c, sh, f, amount) {
    for (const bl of pawDirtBlobs(sh, f)) {
        // w trakcie czyszczenia każdy fragment łapek ma własny poziom brudu (pawLvl)
        if (bl.thr >= (pawLvl ? (pawLvl[bl.bucket] ?? 0) : amount)) continue;
        for (const q of bl.list) {
            c.fillStyle = q.col;
            c.fillRect(q.x, q.y, bl.px, bl.px);
        }
    }
}

// ── Czyszczenie łapek szmatką (łazienka) ──────────────────────────
// Wybór „Łapki” w menu kołowym → piesek idzie do łazienki, staje w miejscu, a
// dziecko przeciąga palcem po jego łapkach. Brud jest podzielony na pasy wzdłuż
// łap (pawLvl) — szmatka zciera te pasy, nad którymi przesuwasz palec, całymi
// grupami grudek (nie piksel po pikselu). Gdy znika ostatnia grudka: fanfary.
let pawsPtr = null, // poprzedni punkt przeciągania (do liczenia drogi)
    pawsCloth = null, // gdzie jest palec
    pawsClothVis = null, // wygładzona pozycja rysowanej szmatki
    pawLvl = null; // poziom brudu (0–1) każdego pasa podczas czyszczenia
function updatePawsUi() {
    const e = $(".pawsEnd");
    if (e) e.hidden = phase !== "paws-clean";
}
function pawsStart() {
    if (room !== "bathroom" || pawDirt < 3) return idle(16);
    bubble = null;
    pawsPtr = pawsCloth = pawsClothVis = null;
    pawLvl = new Array(16).fill(pawDirt / 100);
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "paws-clean";
                stage = "paws-clean";
                locks();
            },
            onEnd: () => phase === "paws-clean" && pawsEnd(false),
        },
    ]);
}
function pawsEnd(done) {
    if (phase !== "paws-clean") return;
    pawsPtr = pawsCloth = pawsClothVis = null;
    if (done) {
        pawLvl = null;
        pawDirt = 0;
        changeNeeds(ACTION_EFFECTS.paws);
        save();
        // Brawo, czysty piesek: fanfary, konfetti i karta końcowa jak w grach
        $("#pawsWinPopup .memoWinImg").src = icons.cup;
        moleWinSpawnConfetti("#pawsWinPopup .moleWinConfetti");
        say("star", 2600);
        startQueue([{ sheet: "a01", anim: 21, time: 600000 }]);
        phase = "paws-end";
        stage = "paws-end";
        $("#pawsWinPopup").hidden = false;
    } else {
        // przerwane: zostaje tyle brudu, ile nie zdążyłeś wytrzeć
        if (pawLvl) pawDirt = (pawLvl.slice(0, 10).reduce((a, v) => a + v, 0) / 10) * 100;
        pawLvl = null;
        save();
        idle(16);
    }
    locks();
}
$("#pawsWinPopup .moleWinOk").onclick = () => {
    $("#pawsWinPopup").hidden = true;
    idle(16);
};
// x w komórce arkusza dla punktu na ekranie (ta sama matematyka co w drawDog)
function pawsCellX(px) {
    const g = geometry();
    let dx = px - x * W;
    if (left) dx = -dx;
    return (dx - g.o.x * BASE) / g.s + g.w / 2;
}
function pawsWipe(p) {
    if (phase !== "paws-clean" || !pawLvl) return;
    pawsCloth = p;
    const prev = pawsPtr;
    pawsPtr = p;
    if (!prev) return;
    // szmatka działa tylko przy łapkach (pasek przy podłodze pod pieskiem)
    if (Math.abs(p.x - x * W) > 150 || p.y < GROUND - 90 || p.y > GROUND + 60) return;
    const d = Math.min(25, Math.hypot(p.x - prev.x, p.y - prev.y)), // pojedynczy skok nie zaciera od razu wszystkiego
        cx = pawsCellX(p.x);
    let touched = false;
    pawLvl.forEach((v, b) => {
        if (v <= 0 || Math.abs((b + 0.5) * PAW_BUCKET - cx) > 12) return;
        touched = true;
        pawLvl[b] = Math.max(0, v - d * 0.0016);
        if (pawLvl[b] <= 0.02) {
            pawLvl[b] = 0;
            sfx("good"); // „plink” za każdy wytarty fragment
        }
    });
    if (touched) sfx("wipe");
    // koniec, gdy na bieżącej klatce nie widać już żadnej grudki
    const f = geometry().f;
    if (!pawDirtBlobs(sheet, f).some((bl) => bl.thr < (pawLvl[bl.bucket] ?? 0))) pawsEnd(true);
}
function pawsClothDraw() {
    const im = cells.ui[UI.map.cloth - 1];
    if (!im) return;
    const hint = !pawsCloth,
        tx = pawsCloth ? pawsCloth.x : x * W + Math.sin(clock / 700) * 40,
        ty = pawsCloth ? pawsCloth.y : GROUND - 4;
    // wygładzanie: szmatka płynnie dogania palec (bez szarpania)
    pawsClothVis = pawsClothVis ? { x: pawsClothVis.x + (tx - pawsClothVis.x) * 0.4, y: pawsClothVis.y + (ty - pawsClothVis.y) * 0.4 } : { x: tx, y: ty };
    ctx.save();
    ctx.translate(pawsClothVis.x, pawsClothVis.y);
    ctx.rotate(-0.35);
    ctx.globalAlpha = hint ? 0.8 : 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, -34, -34, 68, 68);
    ctx.restore();
}
$(".pawsEnd").onclick = () => pawsEnd(false);

function headPosition() {
    const g = geometry(),
        h = P.meta[sheet][g.f - 1].head;
    return {
        x: x * W + (left ? -1 : 1) * ((h[0] - g.w / 2) * g.s + g.o.x * BASE),
        y: GROUND + jumpY + (h[1] - g.g) * g.s + g.o.y * BASE,
    };
}

// Jak headPosition(), ale dla zielonego znacznika (#00ff43) wykrytego na
// aktualnie wyświetlanej klatce a02 — albo null, jeśli ta klatka żadnego
// znacznika nie ma (patrz catchMarker / extractMarker() w boot()). Ta sama
// matematyka transformacji co w drawDog(), więc nakładka zawsze trzyma się
// dokładnie wskazanego miejsca, niezależnie od obrotu/skali danej klatki.
function catchMarkerPos() {
    const g = geometry(),
        m = catchMarker[g.f];
    if (!m) return null;
    return {
        x: x * W + (left ? -1 : 1) * ((m.x - g.w / 2) * g.s + g.o.x * BASE),
        y: GROUND + jumpY + (m.y - g.g) * g.s + g.o.y * BASE,
    };
}

function petHit(px, py) {
    if (!loaded) return false;
    const g = geometry();
    let xx = px - x * W;
    if (left) xx = -xx;
    const sx = (xx - g.o.x * BASE) / g.s + g.w / 2,
        sy = (py - GROUND - jumpY - g.o.y * BASE) / g.s + g.g,
        b = P.meta[sheet][g.f - 1].box,
        bw = b[2] - b[0],
        bh = b[3] - b[1];
    if (sx < b[0] + bw * 0.23 || sx >= b[2] || sy < b[1] + bh * 0.1 || sy > b[1] + bh * 0.86) return false;
    const ix = Math.floor(sx),
        iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= g.w || iy >= g.h) return false;
    return pixels[sheet][g.f - 1][(iy * g.w + ix) * 4 + 3] > 120;
}

function poopRect() {
    const w = 60,
        h = (w * images.poop.height) / images.poop.width;
    let offset = 0;
    if (poop) {
        const diff = order.indexOf(poop.room) - order.indexOf(room);
        offset = diff * W + roomOffset;
    }
    return {
        x: clamp((poop?.x || 0.3) * W, 22, W - 22) - w / 2 + offset,
        y: GROUND + 38 - h, // pierwszy plan: tuż pod linią podłogi pieska
        w,
        h,
    };
}

function poopHit(px, py) {
    if (!dirty()) return false;
    const r = poopRect();
    return px > r.x - 6 && px < r.x + r.w + 6 && py > r.y - 6 && py < r.y + r.h + 6;
}

function cleanPoop() {
    if (!casual() || !dirty()) return;
    sfx("wipe");
    interrupt();
    wake();
    poop = null;
    blockedActivity = null;
    if (Math.random() < POOP_GAG_CHANCE) poopGagAt = clock + POOP_GAG_DELAY_MS[0] + Math.random() * (POOP_GAG_DELAY_MS[1] - POOP_GAG_DELAY_MS[0]);
    changeNeeds(ACTION_EFFECTS.poop);
    updatePoopAccess();
    say("star");
    save();
}

// Kupka z logiki, nie z losu (patrz REGULY.md): przejedzony piesek (jedzenie
// >= POOP_FULL_AT) robi kupkę, a jedzenie mu spada o 10–15; poza tym "zwykłe"
// trawienie co kilka minut. Po każdej kupce przerwa (nextPoop).
const POOP_BEHIND = 0.24, // kupka za ogonem pieska
    POOP_FULL_AT = 85,
    POOP_COOLDOWN_MS = 45000,
    POOP_REGULAR_MS = [120000, 240000],
    POOP_REGULAR_MIN_FOOD = 25,
    // Żart: tuż po posprzątaniu piesek czasem robi następną kupkę.
    POOP_GAG_CHANCE = 0.1,
    POOP_GAG_DELAY_MS = [5000, 10000];
let poopGagAt = 0;
function poopUrge() {
    if (poopGagAt && clock >= poopGagAt) return true;
    if (clock < nextPoop) return false;
    if (stats.food >= POOP_FULL_AT) return true;
    return clock >= nextRegularPoop && stats.food >= POOP_REGULAR_MIN_FOOD;
}

function spawnPoop() {
    if (!casual() || sleeping || poop) return false;
    interrupt();
    phase = "toilet";
    locks();
    const gag = !!poopGagAt && clock >= poopGagAt;
    poopGagAt = 0;
    startQueue([
        {
            sheet: "a01",
            frames: [41, 42, 47],
            tempo: 420,
            time: 1260,
            onStart: () => say("poop", 2600),
            onEnd: () => {
                poop = {
                    room,
                    x: clamp(x + (left ? 1 : -1) * POOP_BEHIND, 0.08, 0.92),
                };
                // Najedzony piesek po kupce jest lżejszy: -10…-15; zwykłe
                // trawienie zabiera mniej.
                changeNeeds({ food: gag ? -3 : stats.food >= POOP_FULL_AT ? -(10 + Math.random() * 5) : -(5 + Math.random() * 3) });
                updatePoopAccess();
                say("poop", 4500);
                save();
            },
        },
        {
            sheet: "a01",
            frames: [48],
            tempo: 350,
            time: 350,
        },
    ]);
    nextPoop = clock + POOP_COOLDOWN_MS;
    nextRegularPoop = clock + POOP_REGULAR_MS[0] + Math.random() * (POOP_REGULAR_MS[1] - POOP_REGULAR_MS[0]);
    return true;
}
$(".poopAccess").onclick = cleanPoop;
$(".petAccess").onclick = react;
$(".arrow.prev").onclick = () => stepRoom(-1);
$(".arrow.next").onclick = () => stepRoom(1);

function pointerXY(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * SH,
    };
}

function previewSwipe(dx) {
    const dir = dx < 0 ? 1 : -1,
        n = order.indexOf(room) + dir,
        valid = n >= 0 && n < order.length;
    setOffset(valid ? clamp(dx / scale, -W * 0.94, W * 0.94) : clamp((dx / scale) * 0.15, -36, 36));
}

function settleSwipe(dir, commit) {
    const n = order.indexOf(room) + dir,
        valid = commit && n >= 0 && n < order.length,
        origin = roomOffset,
        end = valid ? -dir * W : 0,
        target = valid ? order[n] : room;
    phase = "travel";
    travelMode = "swipe";
    stage = valid ? "swipe-slide" : "swipe-cancel";
    locks();
    const time = reduced ? 180 : clamp((Math.abs(end - origin) / W) * 820 + 150, 240, 950);
    if (valid) {
        wake();
        left = dir < 0;
        bubble = null;
    }
    startQueue([
        {
            sheet: "a01",
            anim: valid ? 1 : 16,
            tempo: 180,
            facing: valid ? dir < 0 : left,
            time,
            onStart: () => (stage = valid ? "swipe-slide" : "swipe-cancel"),
            update: (p) => {
                const eased = 1 - Math.pow(1 - p, 3);
                setOffset(origin + (end - origin) * eased);
            },
            onEnd: () => {
                if (valid) setRoom(target);
                else setOffset(0);
            },
        },
        {
            sheet: "a01",
            anim: 16,
            time: 200,
            onEnd: () => finishTravel(null),
        },
    ]);
}
canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (gesture) {
        // Drugi palec w trakcie gestu — anuluj jak dawniej. Ale jeśli to
        // "wiszący" gest po zgubionym pointerup (inny pointerId, ten sam
        // jeden palec), NIE połykamy nowego dotyku — po prostu zaczynamy od nowa.
        const stale = gesture.id !== e.pointerId && e.isPrimary;
        if (gesture.kind === "pet") stopPetting();
        if (phase === "swipe-preview") { phase = "idle"; setOffset(0); }
        gesture = null;
        if (!stale) return;
    }
    if (phase === "paws-clean") {
        // czyszczenie łapek: palec = szmatka
        gesture = { id: e.pointerId, sx: e.clientX, sy: e.clientY, kind: "wipe" };
        pawsPtr = null;
        pawsWipe(pointerXY(e));
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
    }
    const p = pointerXY(e);
    gesture = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        kind: null,
        dog: petHit(p.x, p.y),
        poop: poopHit(p.x, p.y),
        moleDirt: moleDirtHit(p.x, p.y),
        dish: dishHit(p.x, p.y),
        lump: lumpHit(p.x, p.y) >= 0,
        catchFly: eventTapOk() ? butterflyHit(p.x, p.y) : false,
        butterfly: phase !== "butterfly" ? ambientHit(p.x, p.y) : null,
        hog: casual() ? hedgehogHit(p.x, p.y) : null,
        fruit: casual() ? hedgeFruitHit(p.x, p.y) : null,
        mole: gameEntryOk() ? moleTeaserHit(p.x, p.y) : null,
        boneMole: eventTapOk() && typeof boneMoleHit === "function" ? boneMoleHit(p.x, p.y) : false,
        boneDig: typeof boneDigHit === "function" ? boneDigHit(p.x, p.y) : false,
        hedge: gameEntryOk() ? hedgePeekHit(p.x, p.y) : false,
    };
    // Aport: dotknięcie piłki przy łapach = złapanie jej (dalej ciągnięcie i rzut)
    if (phase === "ball-ready" && ballGrab(p.x, p.y, e.timeStamp)) gesture.kind = "ball";
    try {
        canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
canvas.addEventListener("pointermove", (e) => {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.sx,
        dy = e.clientY - g.sy;
    if (g.kind === "wipe") {
        pawsWipe(pointerXY(e));
        return;
    }
    if (g.kind === "ball") {
        const p = pointerXY(e);
        ballHoldMove(p.x, p.y, e.timeStamp);
        return;
    }
    if (!g.kind) {
        if (phase === "ball-ready") {
            // Aport: rzuca się tylko złapaną piłką (patrz pointerdown)
        } else if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.2) {
            g.kind = g.dog && !g.poop && canPet() ? "pet" : "vertical";
            if (g.kind === "pet") startPetting();
        } else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2 && casual()) {
            g.kind = "swipe";
        }
    }
    if (g.kind === "swipe") { /* podgląd wyłączony — używamy animacji strzałek */ }
    if (g.kind === "pet") {
        e.preventDefault();
        petLast = clock;
        petFinishAt = Infinity;
        if (!bubble || bubble.until < clock + 1000) say("heart", 2500);
    }
});

function pointerEnd(e, cancel = false) {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    gesture = null;
    try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (g.kind === "wipe") {
        pawsPtr = null;
        return;
    }
    if (g.kind === "pet") {
        stopPetting();
        return;
    }
    const dx = e.clientX - g.sx,
        dy = e.clientY - g.sy;
    if (g.kind === "ball") {
        if (!cancel) ballHoldMove(pointerXY(e).x, pointerXY(e).y, e.timeStamp);
        ballRelease(e.timeStamp, cancel);
        return;
    }
    if (g.kind === "swipe") {
        if (!cancel && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            setOffset(0);
            stepRoom(dx < 0 ? 1 : -1);
        } else {
            setOffset(0);
        }
        return;
    }
    if (cancel) return;
    if (!g.kind && Math.hypot(dx, dy) <= 12) {
        const p = pointerXY(e);
        // Wejścia do gier (kret, jeżyk) mają pierwszeństwo przed pieskiem —
        // inaczej, gdy piesek stał obok kopca, dotyk szedł w "pogłaskanie".
        if (g.boneDig && boneDigHit(p.x, p.y)) boneDigTap();
        else if (g.hog && hedgehogHit(p.x, p.y) === g.hog) hedgehogScare(g.hog);
        else if (g.fruit && hedgeFruitHit(p.x, p.y)) hedgeFruitCollect(g.fruit);
        else if (g.mole && moleTeaserHit(p.x, p.y) === g.mole) moleTeaserTap(g.mole);
        else if (g.boneMole && boneMoleHit(p.x, p.y)) stopAutoTrip() || boneMoleTap();
        else if (g.hedge && hedgePeekHit(p.x, p.y)) hedgePeekTap();
        else if (g.poop && poopHit(p.x, p.y)) cleanPoop();
        else if (g.moleDirt && moleDirtHit(p.x, p.y)) cleanMoleDirt();
        else if (g.dish && dishHit(p.x, p.y)) cleanDish();
        else if (g.lump && lumpHit(p.x, p.y) >= 0) cleanLump(lumpHit(p.x, p.y));
        else if (g.catchFly && butterflyHit(p.x, p.y)) stopAutoTrip() || butterflyCatch();
        else if (g.dog && petHit(p.x, p.y)) react();
        else if (g.butterfly && ambientHit(p.x, p.y) === g.butterfly) ambientFlee(g.butterfly);
    }
}
canvas.addEventListener("pointerup", (e) => pointerEnd(e));
canvas.addEventListener("pointercancel", (e) => pointerEnd(e, true));
canvas.addEventListener("lostpointercapture", (e) => {
    if (gesture?.id === e.pointerId) pointerEnd(e, true);
});

function chooseDestination() {
    const a = order.filter((r) => r !== room),
        weights = a.map((r) => (r === "garden" ? 5 : r === "yard" ? 2 : 1));
    let n = Math.random() * weights.reduce((s, v) => s + v, 0);
    for (let i = 0; i < a.length; i++) {
        n -= weights[i];
        if (n <= 0) return a[i];
    }
    return a[0];
}

// Coś dzieje się w świecie (kret, jeżyk, motylek do złapania) — piesek wtedy
// stoi spokojnie, żeby dało się to kliknąć, i nie wybiega sam w drogę.
function worldBusy() {
    return !!(moleTeaser || hedgehog || butterfly || (typeof boneMole !== "undefined" && boneMole) || (typeof boneDig !== "undefined" && boneDig));
}

// Zdarzenie (motylek do złapania, kopiec z kostką) da się kliknąć też wtedy,
// gdy piesek akurat sam gdzieś biegnie — kliknięcie przerywa jego wycieczkę.
function eventTapOk() {
    return casual() || (phase === "travel" && travelMode === "auto" && !sleeping);
}
function stopAutoTrip() {
    if (phase === "travel" && travelMode === "auto") idle(16);
    return false; // dalej w łańcuchu || wykonuje właściwą akcję
}

function autoTrip(target = chooseDestination()) {
    if (!casual() || sleeping || gesture || menu.drag) return false;
    if (worldBusy()) {
        nextTrip = clock + 3000;
        return false;
    }
    if (sadNeed()) return false; // smutny piesek nigdzie sam nie idzie
    trips++;
    route(target, null, "auto");
    return true;
}

function localWalk() {
    if (!casual()) return;
    interrupt();
    phase = "roam";
    const dest = x <= 0.5 ? 0.58 : 0.42,
        dist = Math.abs(dest - x) * W;
    if (dist < 2) {
        idle();
        return;
    }
    locks();
    startQueue([
        {
            sheet: "a01",
            anim: 6,
            motion: "walk",
            to: dest,
            time: (dist / 60) * 1000,
        },
    ]);
}

function autonomous() {
    const r = Math.random();
    if (r < 0.55) localWalk();
    else if (r < 0.72) {
        phase = "pause";
        locks();
        startQueue([
            {
                sheet,
                frames: [currentFrame()],
                tempo: 1000,
                time: 1000 + Math.random() * 900,
            },
        ]);
    } else if (r < 0.86) {
        phase = "look";
        locks();
        startQueue([repeatPart("a01", Math.random() < 0.5 ? 3 : 7)]);
    } else idle();
}

/* ═══════════════════════════════════════════════════════════════
   MOTYLEK DO ZŁAPANIA ("Chwytanie motylka")
   Co jakiś czas (garden/yard) przez ekran przelatuje motylek po linii
   y≈BUTTERFLY_LINE_Y, otoczony delikatną, okrągłą, pulsującą ramką.
   Piesek w tym czasie dalej robi swoje (nic go nie blokuje). Gdy gracz
   kliknie motylka (dopóki nie przeleciał BUTTERFLY_CLICKABLE_UNTIL drogi),
   piesek podbiega w odpowiednie miejsce, a potem rusza animacja chwytania
   (butterflyCatch). Nieklikniętego motylka ramka znika i wylatuje za ekran.
   ═══════════════════════════════════════════════════════════════ */
const BUTTERFLY_LINE_Y = 200,
    BUTTERFLY_CROSS_MS = 7000, // przelot przez cały ekran
    BUTTERFLY_CLICKABLE_UNTIL = 0.9, // ułamek drogi, do którego można go kliknąć
    BUTTERFLY_HIT_R = 58;

// Zwierzaki ogrodowe (motylek do złapania, motylek-tło, kret, jeżyk): na
// scenie jest NAJWYŻEJ JEDEN naraz — wiele równoczesnych animacji przytłacza.
// Nowy zwierzak startuje dopiero, gdy poprzedni zniknie (wildlifeBusy), a po
// każdym starcie pozostałe dostają jeszcze krótki "oddech".
const WILDLIFE_STAGGER_MS = 3000;
let wlWasBusy = false,
    wlPick = "",
    wlFreeAt = 0;
function wildlifeBusy(who) {
    // motylek do złapania i motylek-tło (5 kolorów to tylko losowy kolor) to jedna "grupa"
    if (who === "butterfly" || who === "ambient") who = "butterflies";
    // zgubiony przez jeżyka owoc też "zajmuje scenę" — póki leży, nikt nowy nie wychodzi (np. kret na owoc)
    if (moleTeaser || hedgehog || hedgeFruit || butterfly || ambient.length || (typeof boneMole !== "undefined" && boneMole) || (typeof boneDig !== "undefined" && boneDig)) {
        wlWasBusy = true;
        return true;
    }
    // Scena właśnie się zwolniła: przez 5 s pierwszeństwo ma losowo wybrany
    // zwierzak — inaczej zawsze wygrywałby ten sprawdzany w pętli jako pierwszy.
    if (wlWasBusy) {
        wlWasBusy = false;
        wlPick = ["mole", "boneMole", "boneDig", "hedgehog", "butterflies"][Math.floor(Math.random() * 5)];
        wlFreeAt = clock;
    }
    return !!wlPick && who !== wlPick && clock - wlFreeAt < 5000;
}
function wildlifeCooldown() {
    const t = clock + WILDLIFE_STAGGER_MS + Math.random() * 1000;
    nextAmbientSpawn = Math.max(nextAmbientSpawn, t);
    nextMoleSpawn = Math.max(nextMoleSpawn, t);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, t);
    nextButterfly = Math.max(nextButterfly, t);
    if (typeof nextBoneMole !== "undefined") nextBoneMole = Math.max(nextBoneMole, t);
    if (typeof nextBoneDig !== "undefined") nextBoneDig = Math.max(nextBoneDig, t);
}

function butterflySpawn() {
    if (butterfly || phase === "butterfly") return false;
    wildlifeCooldown();
    const dir = Math.random() < 0.5 ? 1 : -1;
    catchButterflyColor = Math.floor(Math.random() * CFG.motyle.presets.length);
    catchButterflyStart = clock;
    butterfly = { visible: true, free: true, x: dir > 0 ? -25 : W + 25, y: BUTTERFLY_LINE_Y, dir, start: clock, p: 0 };
    return true;
}

// Swobodny przelot (zanim gracz go kliknie) — wołane co klatkę z loopFrame().
const BUTTERFLY_SPEED = (W + 50) / BUTTERFLY_CROSS_MS; // px/ms
const LURE_SPEED = 2; // po kliknięciu motylek leci do punktu pościgu 2x szybciej
const CATCH_MIN_WAIT = 250; // ms patrzenia na motylka tuż przed skokiem

// Plan "Chwytania motylka": motylek leci dalej swoim torem, a to PIESEK
// ustawia się tak, żeby w chwili T motylek był dokładnie tam, gdzie grafika
// pościgu (a02/14) ma zielony znacznik. Szukamy kierunku pieska (dir) i czasu
// T (0,9–3,5 s) o najmniejszym koszcie — krótki czas, bez cofania się tyłem.
function butterflyPlan() {
    const b = butterfly;
    if (!b?.free || b.lure) return null;
    const first = numbers(getPreset("a02", 14).seq)[0],
        bd = b.dir > 0 ? 1 : -1;
    let best = null;
    for (const dir of [1, -1]) {
        const A = catchSpotFor("a02", first, 0.5, dir < 0)?.x - 0.5 * W;
        if (!isFinite(A)) return null;
        const [lo, hi] = CATCH_ZONE[dir];
        for (let T = 900; T <= 3500; T += 100) {
            if (b.p + (LURE_SPEED * T) / BUTTERFLY_CROSS_MS > 0.92) break;
            const sx = b.x + bd * BUTTERFLY_SPEED * LURE_SPEED * T;
            let xd = (sx - A) / W;
            if (xd < lo || xd > hi) continue;
            let dist = Math.abs(xd - x) * W;
            if (dist < 6) xd = x;
            const back = dist >= 6 && (xd - x) * dir < 0;
            const walk = dist < 48,
                m = dist < 6 ? 0 : walk ? (dist / 60) * 1000 : Math.max(350, (dist / 260) * 1000);
            if (m + CATCH_MIN_WAIT + (back ? 250 : 0) > T) continue; // back: bieg przodem do celu i dopiero obrót
            const c = T + dist * 2 + (back ? 1500 : 0) + ((dir < 0) !== left && dist < 6 ? 150 : 0);
            if (!best || c < best.cost) best = { dir, T, xd, m, walk, dist, cost: c, spot: { x: sx, y: catchSpotFor("a02", first, xd, dir < 0)?.y ?? 231 } };
        }
    }
    return best;
}

function butterflyFreeUpdate() {
    const b = butterfly;
    if (!b?.free) return;
    if (!["garden", "yard"].includes(room) || sleeping) {
        butterfly = null;
        nextButterfly = clock + 10000;
        return;
    }
    if (b.lure?.done) return;
    const p = b.lure ? b.lure.p0 + (LURE_SPEED * (clock - b.lure.t0)) / BUTTERFLY_CROSS_MS : (clock - b.start) / BUTTERFLY_CROSS_MS;
    if (p >= 1) {
        butterfly = null;
        nextButterfly = clock + 12500 + Math.random() * 17500;
        return;
    }
    const x0 = b.dir > 0 ? -25 : W + 25,
        x1 = b.dir > 0 ? W + 25 : -25;
    b.p = p;
    b.x = x0 + (x1 - x0) * p;
    b.y = BUTTERFLY_LINE_Y + Math.sin(p * Math.PI * 4) * 13;
    if (b.lure) {
        // wysokość łagodnie schodzi do wysokości znacznika pościgu
        const t = clamp((clock - b.lure.t0) / b.lure.T, 0, 1),
            e = t * t * (3 - 2 * t);
        b.y = b.y + (b.lure.spot.y - b.y) * e;
        // Spłoszony zygzak (jak ucieczka motylków-tła): sinusoidalne
        // wygięcia toru, zerowe dokładnie na początku i na końcu, więc motylek
        // startuje z miejsca kliknięcia i kończy dokładnie w punkcie pościgu.
        const z = Math.sin(t * Math.PI * 2 * b.lure.cycles);
        b.y += z * b.lure.amp;
        b.x += Math.sin(t * Math.PI * 4 * b.lure.cycles) * 5;
    } else {
        b.plan = casual() && !dirty() ? butterflyPlan() : null;
    }
    b.ringA = clamp((b.ringA || 0) + ((b.plan && !b.lure ? 1 : -1) * (clock - (b.lc ?? clock))) / 300, 0, 1);
    b.lc = clock;
}

function butterflyHit(px, py) {
    const b = butterfly;
    return !!(b?.free && !b.lure && b.plan && b.ringA > 0.2 && Math.hypot(px - b.x, py - b.y) <= BUTTERFLY_HIT_R);
}

// Delikatna, okrągła, pulsująca ramka wokół klikalnego motylka.
function butterflyFrameDraw(b) {
    const pulse = 0.5 + 0.5 * Math.sin(clock / 260),
        fade = b.ringA || 0; // gaśnie, gdy chwycenie nie jest już możliwe
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 44 + pulse * 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.08 * pulse})`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * pulse})`;
    ctx.shadowColor = "rgba(255,190,235,0.95)";
    ctx.shadowBlur = 8 + pulse * 8;
    ctx.stroke();
    ctx.restore();
}

// Pozycja zielonego znacznika (miejsca motylka narysowanego w grafice) na
// klatce f arkusza sh dla pieska stojącego w x=xf, zwróconego w lewo (lf) lub
// w prawo — ta sama matematyka co catchMarkerPos(), ale dla dowolnej klatki.
function catchSpotFor(sh, f, xf, lf) {
    const m = catchMarker[f];
    if (!m || !cells[sh][f - 1]) return null;
    const o = { x: 0, y: 0, scale: 100, ...CFG[sh].offsets[String(f)] },
        sc = ((BASE * o.scale) / 100) * 0.7;
    return {
        x: xf * W + (lf ? -1 : 1) * ((m.x - cells[sh][f - 1].width / 2) * sc + o.x * BASE),
        y: GROUND + (m.y - CFG[sh].ground) * sc + o.y * BASE,
    };
}

// Strefy, w których piesek może zacząć pościg w danym kierunku (dir=+1 — w
// prawo): pościg przesuwa go o ~0.1 w stronę motylka, a motylek jest ~93 px
// przed nim, więc blisko krawędzi grafika by wychodziła poza ekran.
const CATCH_ZONE = { 1: [0.2, 0.62], "-1": [0.38, 0.8] };

// Start właściwego "Chwytania motylka" po kliknięciu: motylek leci dalej jak
// leciał, a piesek (obrót / krok / bieg) ustawia się tak, żeby w chwili T
// motylek był w miejscu znacznika pościgu. Dopiero wtedy rusza animacja.
function butterflyCatch() {
    const b = butterfly;
    if (!b?.free || b.lure || !casual() || sleeping) return false;
    // smutny piesek (potrzeba ≤10%) nie goni motylka: „NIE” + pulsująca potrzeba
    if (sadBlocks("butterfly")) {
        sadRefuse();
        return false;
    }
    if (dirty()) {
        refuseWith("poop");
        return false;
    }
    const pl = butterflyPlan();
    if (!pl) return false;
    interrupt();
    phase = "butterfly";
    bubble = null;
    locks();
    const { dir, xd, T, walk, dist, m } = pl;
    b.lure = {
        t0: clock,
        p0: b.p,
        T,
        spot: pl.spot,
        done: false,
        cycles: clamp(Math.round(T / 450), 2, 6), // liczba zygzaków
        amp: (10 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1),
    };
    const parts = [];
    if (dist >= 6)
        parts.push({
            sheet: "a01",
            anim: walk ? 6 : 1,
            tempo: walk ? undefined : 180,
            facing: xd < x,
            to: xd,
            motion: walk ? "walk" : "run",
            time: Math.max(1, m),
            onStart: () => (stage = "butterfly-run"),
        });
    const moveT = parts.length ? parts[0].time : 0;
    startQueue([
        ...parts,
        {
            // Piesek stoi zwrócony do motylka i czeka na właściwy moment.
            sheet: "a01",
            anim: 16,
            facing: dir < 0,
            time: Math.max(CATCH_MIN_WAIT, T - moveT),
            onStart: () => (stage = "butterfly-approach"),
        },
        {
            sheet: "a02",
            anim: 14,
            facing: dir < 0,
            to: clamp(xd + dir * 0.1, 0.1, 0.9),
            time: duration("a02", 14) * 2,
            onStart: () => {
                stage = "butterfly-chase";
                sfx("good");
                if (butterfly) {
                    butterfly.visible = false;
                    if (butterfly.lure) butterfly.lure.done = true;
                }
            },
        },
        {
            sheet: "a02",
            anim: 17,
            facing: dir < 0,
            time: duration("a02", 17),
            onStart: () => (stage = "butterfly-nose"),
        },
        {
            sheet: "a01",
            anim: 16,
            facing: dir < 0,
            time: 1000,
            onStart: () => {
                stage = "butterfly-leave";
                butterfly.visible = true;
                // Odlot leci w stronę `dir` (ta sama strona, z której motylek
                // pierwotnie wleciał), ale po podejściu do pieska sprite był
                // odwrócony na `-dir` (lot w stronę pieska) i nic go nie
                // zwracało z powrotem — stąd leciał "plecami do przodu".
                butterfly.dir = dir;
                // Start odlotu dokładnie tam, gdzie nakładka motylka była na
                // ostatniej klatce chwytania (catchLastSpot) — bez skoku.
                butterfly.from = catchLastSpot || { x: x * W + dir * 84, y: 256 };
                butterfly.x = butterfly.from.x;
                butterfly.y = butterfly.from.y;
            },
            update: (p) => {
                const e = p * p * (3 - 2 * p) * 0.6 + p * 0.4; // łagodny rozbieg
                butterfly.x = butterfly.from.x + dir * 190 * e;
                butterfly.y = butterfly.from.y - 90 * e + Math.sin(p * 8) * 5 * p;
            },
            onEnd: () => {
                changeNeeds(ACTION_EFFECTS.butterfly);
                nextButterfly = clock + 12500 + Math.random() * 17500;
                butterfly = null;
            },
        },
    ]);
    return true;
}

// ── Motylek-tło (ogród/podwórko/łąka) ────────────────────────────────────
// Niezależny od motylka do złapania (butterflySpawn/butterflyCatch powyżej) —
// (ten jest klikany — piesek podbiega i go łapie). Ten tutaj lata jeden naraz, w realnym
// rozmiarze (bez pomniejszania), wlatuje z boku/góry (nigdy nie
// "teleportuje się" na środek), chwilę pofruwa "jak pijany" (kierunek
// dryfuje przez dwie nałożone fale o różnych okresach, z miękkim
// zawracaniem od krawędzi obszaru lotu) i wylatuje tą samą drogą — chyba że
// gracz go spłoszy kliknięciem/dotknięciem: wtedy ucieka od razu, szybciej
// i chaotycznym zygzakiem (patrz ambientFlee()), zamiast spokojnego wylotu.
// Kolor wylosowany na starcie trzyma przez cały lot. Na razie spłoszenie to
// tylko wizualny placeholder — docelowo stąd ma startować osobna mini-gra
// (do zaprojektowania później).
const AMBIENT_MAX = 1,
    // Realny rozmiar — rysujemy klatkę 1:1 (kafelek arkusza motyle-new.png
    // to natywne 64×64). Duży i widoczny, bo to już nie tylko dekoracja w
    // tle, tylko coś do kliknięcia.
    AMBIENT_SIZE = 96,
    // Obszar trafienia trochę większy niż sama grafika — łatwiej trafić
    // palcem na telefonie.
    AMBIENT_HIT_PAD = 12,
    AMBIENT_MARGIN_X = 44,
    // Pas lotu: tuż NAD linią, po której leci motylek z eventu (y≈200, patrz
    // butterflyEvent()), wysoko nad głową pieska.
    AMBIENT_MARGIN_TOP = 104,
    // Pas lotu to wyłącznie górne tło (niebo/dach budy), nad pieskiem —
    // z grubsza wysokość strzałek nawigacji (top:44% z 550px scenki, tu
    // z małym zapasem), żeby nigdy nie wchodziły na psa.
    AMBIENT_ZONE_BOTTOM = 176,
    // Rozmiar motylka w całym evencie butterflyEvent() (lot + pogoń +
    // lądowanie na nosie) — ten sam, jakim dotychczas latał motylek w
    // fazach lotu (stary bsz=58.5), niezależny od AMBIENT_SIZE (to inna
    // skala kompozycji: blisko pyszczka/na scenie eventu, nie "duży akcent
    // w tle").
    EVENT_BUTTERFLY_SIZE = 96.5;

function ambientRandomParams() {
    return {
        heading: Math.random() * Math.PI * 2,
        speed: 34 + Math.random() * 26,
        freq1: 0.5 + Math.random() * 0.7,
        freq2: 1.4 + Math.random() * 1.1,
        amp1: 0.8 + Math.random() * 0.6,
        amp2: 0.35 + Math.random() * 0.4,
        seed1: Math.random() * Math.PI * 2,
        seed2: Math.random() * Math.PI * 2,
    };
}

// Losowy punkt poza kadrem (lewa/prawa/góra) dla danego punktu "wewnątrz" —
// używane niezależnie przy wlocie i przy wylocie, więc strona za każdym
// razem może wyjść inna.
function ambientEdgePoint(nearX, nearY) {
    const side = Math.floor(Math.random() * 3);
    return side === 0
        ? { x: -AMBIENT_SIZE, y: nearY } // z lewej
        : side === 1
          ? { x: W + AMBIENT_SIZE, y: nearY } // z prawej
          : {
                // Z góry — ale nie dokładnie znad celu: punkt startowy (albo
                // docelowy przy wylocie) jest przesunięty losowo w bok, żeby
                // odcinek nie był idealnie pionowy (wtedy nawet z wygięciem
                // prostopadłym z ambientSetupFlight() wyglądał jak sztywna
                // linia prosto w dół — sam ruch nie miał żadnego "na ukos").
                x: clamp(nearX + (Math.random() * 2 - 1) * 90, AMBIENT_MARGIN_X, W - AMBIENT_MARGIN_X),
                y: -AMBIENT_SIZE / 2,
            }; // z góry
}

// Przygotowuje odcinek lotu wlot/wylot (from -> to) tak, by nie był sztywną
// linią prostą: dokłada wygięcie PROSTOPADLE do kierunku odcinka (a nie np.
// zawsze "w pionie", co dla pionowego wlotu z góry w ogóle by nie było
// widoczne). Znika dokładnie w obu końcach (sin(0)=sin(kπ)=0), więc start i
// koniec zostają dokładnie w from/to, a sama krzywizna i strona wygięcia są
// losowe za każdym razem.
function ambientSetupFlight(b, state, from, to, speed, bounceCycles = 1) {
    b.state = state;
    b.phaseStart = clock;
    b.from = from;
    b.to = to;
    const dx = to.x - from.x,
        dy = to.y - from.y,
        len = Math.hypot(dx, dy) || 1;
    b.perpX = -dy / len;
    b.perpY = dx / len;
    b.bounceAmp = 10 + Math.random() * 10; // 10–20px wygięcia
    b.bounceSign = Math.random() < 0.5 ? 1 : -1;
    // Liczba "zygzaków" na całej trasie — 1 dla spokojnego wlotu/wylotu,
    // więcej dla spłoszonej, chaotycznej ucieczki (patrz ambientFlee()).
    b.bounceCycles = bounceCycles;
    b.phaseDuration = Math.max(400, (len / speed) * 1000);
}

// Gracz kliknął/dotknął motylka — płoszymy go: zamiast spokojnego wylotu
// rusza od razu w chaotyczną, szybką ucieczkę z kilkoma zygzakami,
// dowolną z trzech krawędzi (jak zwykły wylot, ale bez "wander" pomiędzy).
// Na razie to tylko wizualny placeholder — docelowo stąd ma startować
// osobna mini-gra (do zaprojektowania później).
function ambientFlee(b) {
    if (!b || b.state === "fleeing") return;
    const to = ambientEdgePoint(b.x, b.y),
        // Znacznie szybciej niż spokojny lot — spłoszony motylek.
        speed = (b.speed || 50) * 2.6;
    ambientSetupFlight(b, "fleeing", { x: b.x, y: b.y }, to, speed, 3 + Math.floor(Math.random() * 3));
}

function ambientSpawn() {
    wildlifeCooldown();
    const colorIndex = Math.floor(Math.random() * CFG.motyle.presets.length),
        // Punkt docelowy wlotu — gdzieś w środku pasa lotu.
        settleX = AMBIENT_MARGIN_X + Math.random() * (W - AMBIENT_MARGIN_X * 2),
        settleY = AMBIENT_MARGIN_TOP + Math.random() * (AMBIENT_ZONE_BOTTOM - AMBIENT_MARGIN_TOP),
        // Wlot z boku albo z góry — nigdy "znikąd" na środku ekranu.
        from = ambientEdgePoint(settleX, settleY),
        params = ambientRandomParams(),
        b = { colorIndex, x: from.x, y: from.y, spawnedAt: clock, leaveAt: Infinity, ...params };
    // Wlot leci z tą samą prędkością co późniejszy spokojny "wander"
    // (params.speed) — stały czas niezależny od odległości wyglądał
    // nienaturalnie szybko przy dłuższych dolotach (np. z góry).
    ambientSetupFlight(b, "entering", from, { x: settleX, y: settleY }, params.speed);
    ambient.push(b);
}

function ambientUpdate(dt) {
    // "meadow" (dawniej "attic") to wizualnie też ogród/łąka — motylki-tło
    // lecą i tam. Interaktywny butterflyEvent() (łapanie motylka) na razie
    // zostaje ograniczony tylko do garden/yard, osobno od tej listy.
    if (!images.motyle || !GARDEN_ROOMS.includes(room)) {
        if (ambient.length) ambient.length = 0;
        return;
    }
    if (ambient.length < AMBIENT_MAX && clock >= nextAmbientSpawn && !wildlifeBusy("ambient")) ambientSpawn();
    const dtS = dt / 1000;
    for (let i = ambient.length - 1; i >= 0; i--) {
        const b = ambient[i];
        if (b.state === "entering" || b.state === "leaving" || b.state === "fleeing") {
            const p = clamp((clock - b.phaseStart) / b.phaseDuration, 0, 1),
                // Wygięcie prostopadłe do odcinka from->to (działa tak samo
                // dla wlotu z boku jak i z góry) — znika dokładnie w obu
                // końcach, więc start/koniec zostają w from/to. Przy
                // spłoszeniu bounceCycles>1 daje kilka zygzaków zamiast
                // jednego łagodnego łuku.
                bounce = Math.sin(p * Math.PI * 2 * b.bounceCycles) * b.bounceAmp * b.bounceSign;
            b.x = b.from.x + (b.to.x - b.from.x) * p + b.perpX * bounce;
            b.y = b.from.y + (b.to.y - b.from.y) * p + b.perpY * bounce;
            if (p >= 1) {
                if (b.state === "entering") {
                    b.state = "wander";
                    b.heading = Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x);
                    // Czas, po jakim zacznie wylatywać, liczony dopiero od
                    // startu realnego "wander" (nie od wlotu, który trwa
                    // różnie długo zależnie od odległości).
                    b.leaveAt = clock + 5000 + Math.random() * 6000;
                } else {
                    ambient.splice(i, 1);
                    // Po spłoszeniu kolejny motylek wraca szybciej niż po
                    // zwykłym, przypadkowym odlocie — to była reakcja na
                    // interakcję gracza.
                    nextAmbientSpawn =
                        b.state === "fleeing"
                            ? clock + 7500 + Math.random() * 7500
                            : clock + 12500 + Math.random() * 17500;
                }
            }
            continue;
        }
        // state === "wander"
        if (clock >= b.leaveAt) {
            // Strona wylotu losowana od nowa — niezależnie od strony, z
            // której wleciał, i od tego, dokąd akurat dryfował. Ta sama
            // prędkość co "wander" (b.speed), żeby wylot nie przyspieszał
            // nienaturalnie.
            ambientSetupFlight(b, "leaving", { x: b.x, y: b.y }, ambientEdgePoint(b.x, b.y), b.speed);
            continue;
        }
        const t = (clock - b.spawnedAt) / 1000;
        // Bazowe "pijane" dryfowanie kierunku — suma dwóch fal.
        let turn = Math.sin(t * b.freq1 + b.seed1) * b.amp1 + Math.sin(t * b.freq2 + b.seed2) * b.amp2;
        // Miękkie zawracanie, gdy zbliża się do krawędzi obszaru lotu.
        const steerTo = (target) => {
            let d = ((target - b.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            return d * 2.4;
        };
        if (b.x < AMBIENT_MARGIN_X) turn += steerTo(0);
        else if (b.x > W - AMBIENT_MARGIN_X) turn += steerTo(Math.PI);
        if (b.y < AMBIENT_MARGIN_TOP) turn += steerTo(Math.PI / 2);
        else if (b.y > AMBIENT_ZONE_BOTTOM) turn += steerTo(-Math.PI / 2);
        b.heading += turn * dtS;
        b.x += Math.cos(b.heading) * b.speed * dtS;
        b.y += Math.sin(b.heading) * b.speed * dtS;
        // Zawracanie jest miękkie (stopniowe), więc samo w sobie może na
        // moment wyjść poza pas — twardy clamp jako siatka bezpieczeństwa,
        // żeby naprawdę nigdy nie zeszły niżej niż AMBIENT_ZONE_BOTTOM.
        b.x = clamp(b.x, AMBIENT_MARGIN_X - 8, W - AMBIENT_MARGIN_X + 8);
        b.y = clamp(b.y, AMBIENT_MARGIN_TOP - 8, AMBIENT_ZONE_BOTTOM);
    }
}

// Czy (px,py) trafia w widocznego, jeszcze niespłoszonego motylka-tło —
// używane przy tapnięciu/kliknięciu na scenę (patrz pointerdown/pointerEnd).
function ambientHit(px, py) {
    for (const b of ambient) {
        if (b.state === "fleeing") continue;
        if (Math.hypot(px - b.x, py - b.y) <= AMBIENT_SIZE / 2 + AMBIENT_HIT_PAD) return b;
    }
    return null;
}

function ambientDraw() {
    if (!images.motyle || !ambient.length) return;
    for (const b of ambient) {
        const preset = CFG.motyle.presets[b.colorIndex],
            // Zwykły lot trzepocze 2x szybciej niż bazowa wartość z presetu;
            // spłoszony (ucieczka) — 3x szybciej, dla jeszcze większego
            // wrażenia paniki, obok samego zygzakowatego toru lotu.
            ms = b.state === "fleeing" ? preset.ms / 3 : preset.ms / 2,
            seqFrames = numbers(preset.seq),
            fi = Math.floor((clock - b.spawnedAt) / ms) % seqFrames.length,
            frameNum = seqFrames[fi],
            cell = cells.motyle[frameNum - 1];
        if (!cell) continue;
        const dx = b.state === "wander" ? Math.cos(b.heading) : b.to.x - b.from.x;
        ctx.save();
        ctx.translate(b.x, b.y);
        if (dx < 0) ctx.scale(-1, 1);
        ctx.drawImage(cell, -AMBIENT_SIZE / 2, -AMBIENT_SIZE / 2, AMBIENT_SIZE, AMBIENT_SIZE);
        ctx.restore();
    }
}

/* ═══════════════════════════════════════════════════════════════
   KRET W OGRODZIE — zapowiedź (ambient teaser)
   Jeden kopiec na raz, w dolnym pasie sceny (ziemia/trawa, NIE pas
   lotu motylków). Wychodzi z ziemi, czujnie się rozgląda, a potem
   sam się chowa — albo chowa się OD RAZU po kliknięciu. W pokoju
   "meadow" (Łąka) kliknięcie DODATKOWO uruchamia pełną mini-grę
   (patrz moleStart() w js/minigame-mole.js); w pozostałych pokojach
   ogrodu (garden/yard) samo się chowa, bez startu gry.
   ═══════════════════════════════════════════════════════════════ */
const MOLE_TEASER_SIZE = 126, // o 50% większy niż bazowe 84
    MOLE_TEASER_HIT_PAD = 18, // trochę większy obszar trafienia — łatwiej dla małego dziecka
    // Trzy stałe "miejsca" w ziemi, zdecydowanie niżej niż łapy psa
    // (GROUND=425) — kopiec zawsze wychodzi w jednym z nich (nigdy gdzie
    // indziej), mniej więcej tam, gdzie wskazują trzy obszary z referencji.
    // Y podniesione względem samej referencji, żeby przy większym kreciku
    // (MOLE_TEASER_SIZE) dół kopca nie nachodził na powiększoną, zaznaczoną
    // ikonę w doku (ikony wystają nad kartę doku aż do y≈526 w canvasie,
    // sprawdzone przez getBoundingClientRect ikon .menu button).
    MOLE_TEASER_SPOTS = [
        { x: 76, y: 448 }, // lewo
        { x: 196, y: 452 }, // środek — odrobinę niżej, bliżej pieska
        { x: 300, y: 444 }, // prawo
    ],
    MOLE_TEASER_Y = [442, 456], // zakres wysokości (y) wyjścia kreta
    MOLE_TEASER_FRAME_MS = 110, // tempo klatki przy wyłanianiu/chowaniu zapowiedzi
    MOLE_TEASER_HOLD = 1800; // jak długo stoi w pełni na wierzchu, zanim sam się schowa

function moleTeaserDuration(presetIdx) {
    return numbers(CFG.kret.presets[presetIdx].seq).length * MOLE_TEASER_FRAME_MS;
}

const MEADOW_MOLE = { x: 84, y: 450, standMs: 3200, hiddenMs: 1400 }; // stały kret na Łące (lewa strona)
let moleLastX = -999;
function moleTeaserSpawn() {
    wildlifeCooldown();
    // Miejsce losowe na CAŁEJ szerokości (z marginesem na połowę rozmiaru
    // kreta) i w lekko zmiennej wysokości — nie z trzech stałych punktów.
    // Nowy kopiec nie ląduje tuż obok poprzedniego w tym samym miejscu.
    const half = MOLE_TEASER_SIZE / 2 + 4;
    let sx = 0;
    for (let i = 0; i < 6; i++) {
        sx = half + Math.random() * (W - 2 * half);
        if (Math.abs(sx - moleLastX) > 60) break;
    }
    moleLastX = sx;
    moleTeaser = {
        x: sx,
        y: MOLE_TEASER_Y[0] + Math.random() * (MOLE_TEASER_Y[1] - MOLE_TEASER_Y[0]),
        state: "emerging",
        stateStart: clock,
    };
}

function moleTeaserUpdate() {
    // Kret może wychodzić na KAŻDEJ mapce (nie tylko w ogrodzie/na łące) —
    // jedyne co go blokuje to brak grafiki albo trwająca pełna mini-gra.
    if (!cells.kret.length || !GARDEN_ROOMS.includes(room) || phase === "mole-game" || phase.startsWith("hedge") || phase.startsWith("mole2") || phase.startsWith("memo") || phase.startsWith("pairs") || phase.startsWith("bones")) {
        if (moleTeaser) moleTeaser = null;
        return;
    }
    if (!moleTeaser) {
        // Dopóki leży piach po poprzednim krecie, nowy się nie pojawia —
        // najpierw trzeba go posprzątać (patrz cleanMoleDirt()).
        if (!moleDirts[room] && clock >= nextMoleSpawn && !wildlifeBusy("mole") && !(phase === "travel" && travelMode === "auto")) moleTeaserSpawn();
        return;
    }
    const m = moleTeaser;
    if (m.permanent) {
        // Stały kret na Łące: wychodzi, STOI spokojnie (jedna klatka, bez
        // "telepania"), chowa się, chwila przerwy i od nowa — jak na karcie
        // końcowej. Klikalny w każdej fazie (kopiec jest zawsze widoczny).
        const el = clock - m.stateStart,
            next = { emerging: ["stand", moleTeaserDuration(1)], stand: ["retreating", MEADOW_MOLE.standMs], retreating: ["hidden", moleTeaserDuration(3)], hidden: ["emerging", MEADOW_MOLE.hiddenMs] }[m.state];
        if (next && el >= next[1]) {
            m.state = next[0];
            m.stateStart = clock;
        }
        return;
    }
    if (m.state === "emerging") {
        if (clock - m.stateStart >= moleTeaserDuration(1)) {
            m.state = "alert";
            m.stateStart = clock;
        }
    } else if (m.state === "alert") {
        if (!m.permanent && clock - m.stateStart >= MOLE_TEASER_HOLD) {
            m.state = "retreating";
            m.stateStart = clock;
        }
    } else if (m.state === "retreating") {
        // Podmieniamy zapowiedź na piach dokładnie w momencie, gdy animacja
        // chowania ("9,6,3,2,1") i tak pokazuje klatkę nr 3 — tę samą, której
        // używa moleDirtDraw(). Bez tego kopiec najpierw kurczyłby się aż do
        // maleńkiej klatki 1, a potem nagle "skakał" do dużego piachu; tak
        // podmiana jest niewidoczna, bo to ta sama grafika w tym samym
        // miejscu i rozmiarze — po prostu zamraża animację na tej klatce.
        // Gdy trwa popup startowy pełnej gry (faza "mole-intro"), wstrzymujemy
        // tę zamianę — jeśli gracz kliknie "Zaczynamy!", kret został
        // "złapany" do gry, a nie po prostu uciekł, więc piach w ogóle nie
        // powinien zostać (patrz górny warunek wyżej, zerujący moleTeaser
        // przy phase==="mole-game").
        if (phase !== "mole-intro" && clock - m.stateStart >= 2 * MOLE_TEASER_FRAME_MS) {
            moleDirts[room] = { x: m.x / W, y: m.y };
            updateMoleDirtAccess();
            save();
            moleTeaser = null;
        }
    }
}

// Trafienie w zapowiedź kreta — tak jak ambientHit() dla motylków-tła, ale
// to zawsze jeden, konkretny obiekt (bez tablicy). Pomijamy "retreating" —
// kret już się chowa, za późno.
function moleTeaserHit(px, py) {
    if (!moleTeaser || (moleTeaser.state === "retreating" && !moleTeaser.permanent)) return null;
    const r = MOLE_TEASER_SIZE / 2 + MOLE_TEASER_HIT_PAD;
    return Math.hypot(px - moleTeaser.x, py - moleTeaser.y) <= r ? moleTeaser : null;
}

// Kliknięcie zapowiedzi — zawsze chowa kreta (animacją cofania klatek, nie
// znika od razu — patrz state="retreating" niżej, dokańcza ją
// moleTeaserUpdate()); na Łące dodatkowo startuje pełną mini-grę
// (moleTryStart() z js/minigame-mole.js).
function moleTeaserTap(m) {
    if (m.permanent) {
        moleTryStart(); // stały kret na Łące — zostaje na miejscu
        return;
    }
    if (m.state !== "retreating") {
        m.state = "retreating";
        m.stateStart = clock;
    }
}

function moleTeaserFrame() {
    const m = moleTeaser;
    if (!m) return null;
    if (m.state === "stand") {
        const f = numbers(CFG.kret.presets[1].seq);
        return f[f.length - 1]; // ostatnia klatka wyjścia — kret stoi nieruchomo
    }
    if (m.state === "hidden") return numbers(CFG.kret.presets[0].seq)[0]; // sam kopiec
    if (m.state === "alert") {
        const frames = numbers(CFG.kret.presets[2].seq),
            fi = Math.floor((clock - m.stateStart) / 160) % frames.length;
        return frames[fi];
    }
    const presetIdx = m.state === "emerging" ? 1 : 3,
        frames = numbers(CFG.kret.presets[presetIdx].seq),
        dur = moleTeaserDuration(presetIdx),
        p = clamp((clock - m.stateStart) / dur, 0, 0.999),
        fi = Math.floor(p * frames.length);
    return frames[fi];
}

function moleTeaserDraw() {
    if (!moleTeaser || !cells.kret.length) return;
    const fn = moleTeaserFrame(),
        cell = fn ? cells.kret[fn - 1] : null;
    if (!cell) return;
    ctx.drawImage(cell, moleTeaser.x - MOLE_TEASER_SIZE / 2, moleTeaser.y - MOLE_TEASER_SIZE / 2, MOLE_TEASER_SIZE, MOLE_TEASER_SIZE);
}

// Piach po krecie — ten sam mechanizm co kupka (patrz poopRect()/poopHit()/
// cleanPoop() wyżej): leży w świecie gry, trzeba go kliknąć, żeby zniknął.
// Trzyma pozycję względem swojego pokoju (jak kupka), więc widać go też z
// sąsiedniego pokoju podczas przesuwania planszy.
function moleDirtRect(dirtRoom = room) {
    const d = moleDirts[dirtRoom],
        w = MOLE_TEASER_SIZE,
        h = MOLE_TEASER_SIZE,
        offset = (order.indexOf(dirtRoom) - order.indexOf(room)) * W + roomOffset;
    return {
        x: clamp((d?.x || 0.5) * W, 22, W - 22) - w / 2 + offset,
        y: (d?.y || MOLE_TEASER_SPOTS[0].y) - h / 2,
        w,
        h,
    };
}

function moleDirtHit(px, py) {
    if (!moleDirts[room]) return false;
    const r = moleDirtRect();
    return px > r.x - 10 && px < r.x + r.w + 10 && py > r.y - 10 && py < r.y + r.h + 10;
}

function updateMoleDirtAccess() {
    const btn = $(".moleDirtAccess");
    if (btn) btn.hidden = !moleDirts[room];
    updateDishAccess();
    updatePawsUi();
}

function cleanMoleDirt() {
    if (!casual() || !moleDirts[room]) return;
    delete moleDirts[room];
    changeNeeds(ACTION_EFFECTS.moleDirt);
    updateMoleDirtAccess();
    say("star", 1600);
    // Dopiero teraz zaczyna się odliczanie do kolejnego kreta.
    nextMoleSpawn = clock + 7500 + Math.random() * 15000;
    save();
}
$(".moleDirtAccess").onclick = cleanMoleDirt;

// Stłuczone naczynie — leży w świecie jak kupka; dotyk (lub ukryty przycisk
// dostępności) sprząta. Rysowane tylko, gdy piłka już dotknęła ziemi (shown).
let dishBubbleIdx = 0; // wygląd skorup w dymku (ustawia aport)
const DISH_SIZE = 109; // 84 × 1,3
function dishRect(dRoom = dishMess?.room) {
    const offset = (order.indexOf(dRoom) - order.indexOf(room)) * W + roomOffset,
        w = DISH_SIZE;
    return { x: clamp(dishMess?.x ?? 0.5, 0.08, 0.92) * W - w / 2 + offset, y: GROUND + 36 - w, w, h: w }; // podstawa 26 px poniżej linii piłki/pieska
}
function dishHit(px, py) {
    if (!dishMess?.shown || dishMess.room !== room) return false;
    const r = dishRect();
    return px > r.x - 10 && px < r.x + r.w + 10 && py > r.y - 10 && py < r.y + r.h + 10;
}
function updateDishAccess() {
    const btn = $(".dishAccess");
    if (btn) btn.hidden = !(dishMess?.shown && dishMess.room === room);
}
function cleanDish() {
    const waiting = stage === "dish-sad"; // piesek siedzi smutny i czeka na sprzątanie
    if (!(casual() || waiting) || !dishMess?.shown || dishMess.room !== room) return;
    dishMess = null;
    updateMoleDirtAccess();
    sfx("wipe");
    say("star", waiting ? 3200 : 1600);
    changeNeeds({ clean: 2 });
    save();
    if (waiting) dishResume(); // piesek wstaje, łapie piłkę i wraca
}
$(".dishAccess").onclick = cleanDish;
function dishDraw() {
    const im = images.dish;
    if (!im || !dishMess?.shown || Math.abs(order.indexOf(dishMess.room) - order.indexOf(room)) > 1) return;
    const r = dishRect();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, dishMess.idx * 40, 0, 40, 40, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true;
}

function moleDirtDraw() {
    if (!cells.kret.length) return;
    const cell = cells.kret[2]; // klatka nr 3 (3. od lewej w 1. rzędzie arkusza) — piach po krecie
    if (!cell) return;
    for (const r of Object.keys(moleDirts)) {
        if (Math.abs(order.indexOf(r) - order.indexOf(room)) > 1) continue;
        const rc = moleDirtRect(r);
        ctx.drawImage(cell, rc.x, rc.y, rc.w, rc.h);
    }
}

// Zwraca aktualną klatkę (canvas) wybranego koloru motylka z motyle-new.png
// dla danego "zegara" trzepotu — wspólne dla całego butterflyEvent() (lot +
// pogoń + lądowanie na nosie), żeby trzepot był ciągły i spójny przez cały
// event, niezależnie od tego, która faza akurat go rysuje.
function eventButterflyCell() {
    const preset = CFG.motyle.presets[catchButterflyColor],
        // To samo tempo co zwykły lot motylków-tło (2x szybciej niż baza).
        ms = butterfly?.lure && !butterfly.lure.done ? preset.ms / 3 : preset.ms / 2, // spłoszony trzepocze szybciej
        seqFrames = numbers(preset.seq),
        fi = Math.floor((clock - catchButterflyStart) / ms) % seqFrames.length,
        frameNum = seqFrames[fi];
    return cells.motyle[frameNum - 1];
}

// Motylek "przyklejony" do pieska podczas pogoni/łapania (stage
// butterfly-chase / butterfly-nose w butterflyEvent()) — pozycja i aktualna
// klatka a02 same decydują, czy i gdzie go narysować (patrz catchMarkerPos()
// / catchMarker, wypełniane w boot() przez extractMarker()). Jeśli klatka
// nie ma znacznika (np. przejściowa poza nim), nic się nie rysuje — bez
// tego "skakania" nakładki.
function catchOverlayDraw() {
    if ((stage !== "butterfly-chase" && stage !== "butterfly-nose") || !images.motyle) return;
    const pos = catchMarkerPos();
    if (!pos) return;
    catchLastSpot = pos;
    const cell = eventButterflyCell();
    if (!cell) return;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (left) ctx.scale(-1, 1);
    ctx.drawImage(cell, -EVENT_BUTTERFLY_SIZE / 2, -EVENT_BUTTERFLY_SIZE / 2, EVENT_BUTTERFLY_SIZE, EVENT_BUTTERFLY_SIZE);
    ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   JEŻYK — spacerowicz w tle (za pieskiem)
   Od czasu do czasu wchodzi, wolno się przechadza po stałej "linii spaceru"
   (HEDGEHOG_LINE_Y, wyżej niż łapy pieska), co jakiś czas przystaje.
   Czasem niesie na kolcach coś dobrego (owoc z hedgehog-game.png, dolny
   rząd — słodycze z górnego rzędu są "złe", więc nigdy ich nie niesie).
   Działa w czasie rzeczywistym tylko na mapach plenerowych (GARDEN_ROOMS), niezależnie od pieska;
   nie jest klikalny. Presety: animacje-ustawienia/hedgehog-animacje.json.
   ═══════════════════════════════════════════════════════════════ */
const HEDGEHOG_LINE_Y = 488, // y stóp jeżyka — pierwszy plan, przed pieskiem
    HEDGEHOG_SIZE = 140, // jak w grze z jeżykiem
    HEDGEHOG_SCALE = HEDGEHOG_SIZE / 64, // względem oryginalnych 64 px
    HEDGEHOG_FEET = 55 / 64, // dół sprite'a w komórce (ułamek wysokości)
    HEDGEHOG_SPEED = 20 * (140 / 64), // px/s (tempo kroków jak dawniej, po skali)
    HEDGEHOG_FLEE_SPEED = 330, // ucieczka po kliknięciu
    HEDGEHOG_MIN_X = 70,
    HEDGEHOG_MAX_X = W - 70,
    HEDGEHOG_FRUIT_SIZE = 70,
    HEDGEHOG_FRUIT_CHANCE = 0.65,
    HEDGEHOG_FRUIT_LIFE = 20000; // ile leży zgubiony owoc
let hedgehog = null,
    hedgeFruit = null, // zgubiony owoc: { x, y, idx, born }
    nextHedgehogSpawn = 0;

function hedgehogHit(px, py) {
    const h = hedgehog;
    if (!h || h.state === "fleeing") return null;
    const top = HEDGEHOG_LINE_Y - HEDGEHOG_SIZE * HEDGEHOG_FEET;
    return Math.abs(px - h.x) <= HEDGEHOG_SIZE * 0.5 && py >= top - 28 && py <= HEDGEHOG_LINE_Y + 18 ? h : null;
}

// Kliknięty jeżyk gubi owoc i najkrótszą drogą ucieka za ekran.
function hedgehogScare(h) {
    if (h.fruit >= 0) {
        hedgeFruit = { x: h.x - h.dir * 10, y: HEDGEHOG_LINE_Y - 6, idx: h.fruit, born: clock };
        h.fruit = -1;
    }
    sfx("scare");
    h.state = "fleeing";
    h.dir = h.x < W / 2 ? -1 : 1;
    h.pauseUntil = 0;
    h.walkStart = clock;
}

function hedgeFruitHit(px, py) {
    const f = hedgeFruit;
    return f && Math.hypot(px - f.x, py - (f.y - HEDGEHOG_FRUIT_SIZE * 0.4)) <= HEDGEHOG_FRUIT_SIZE * 0.75 ? f : null;
}

function hedgeFruitCollect(f) {
    hedgeFruit = null;
    sfx("good");
    // lekki "pyk" w miejscu owocu — na razie bez nagrody w statusach
    fruitPops.push({ x: f.x, y: f.y - 40, born: clock });
}
const fruitPops = [];

function hedgehogPickTarget(h) {
    // Cel w głębi planszy, dość daleko od obecnej pozycji — żeby nie dreptał w miejscu.
    do h.target = HEDGEHOG_MIN_X + Math.random() * (HEDGEHOG_MAX_X - HEDGEHOG_MIN_X);
    while (Math.abs(h.target - h.x) < 80);
    h.dir = h.target >= h.x ? 1 : -1;
}

function hedgehogRollFruit() {
    return Math.random() < HEDGEHOG_FRUIT_CHANCE ? 4 + Math.floor(Math.random() * 4) : -1;
}

// Jak motylki-tło i kret: pojawia się "od czasu do czasu" — wchodzi zza
// krawędzi, przechadza się (1–2 odcinki z postojami), wychodzi za krawędź,
// a kolejny wejdzie dopiero po przerwie. setRoom() zeruje go tak samo jak
// motylki/krecika (świeży odliczany czas w każdym pokoju).
function hedgehogUpdate(dt) {
    if (hedgeFruit && clock - hedgeFruit.born > HEDGEHOG_FRUIT_LIFE) hedgeFruit = null;
    if (!GARDEN_ROOMS.includes(room)) hedgeFruit = null;
    if (!cells.hedgehog.length || !GARDEN_ROOMS.includes(room) || phase === "mole-game" || phase.startsWith("hedge") || phase.startsWith("mole2") || phase.startsWith("memo") || phase.startsWith("pairs") || phase.startsWith("bones")) {
        hedgehog = null;
        return;
    }
    if (!hedgehog) {
        if (clock < nextHedgehogSpawn || wildlifeBusy("hedgehog") || (phase === "travel" && travelMode === "auto")) return;
        const side = Math.random() < 0.5 ? -1 : 1, // -1: z lewej, 1: z prawej
            h = { x: side < 0 ? -HEDGEHOG_SIZE : W + HEDGEHOG_SIZE, dir: -side, target: 0, state: "entering", legs: 1 + Math.floor(Math.random() * 2), pauseUntil: 0, fruit: hedgehogRollFruit(), walkStart: clock };
        // Pierwszy cel w głębi planszy, po stronie przeciwnej do wejścia.
        h.target = side < 0 ? HEDGEHOG_MIN_X + Math.random() * 120 : W - HEDGEHOG_MIN_X - Math.random() * 120;
        hedgehog = h;
        wildlifeCooldown();
        return;
    }
    const h = hedgehog;
    if (clock < h.pauseUntil) return;
    h.x += h.dir * (h.state === "fleeing" ? HEDGEHOG_FLEE_SPEED : HEDGEHOG_SPEED) * (dt / 1000);
    if (h.state === "leaving" || h.state === "fleeing") {
        if (h.x < -HEDGEHOG_SIZE || h.x > W + HEDGEHOG_SIZE) {
            hedgehog = null;
            nextHedgehogSpawn = clock + 12000 + Math.random() * 15000;
        }
        return;
    }
    if ((h.dir > 0 && h.x >= h.target) || (h.dir < 0 && h.x <= h.target)) {
        // Dotarł — postój; potem kolejny odcinek albo wyjście za krawędź.
        h.state = "walking";
        h.pauseUntil = clock + 1500 + Math.random() * 3000;
        h.walkStart = h.pauseUntil;
        h.fruit = hedgehogRollFruit();
        if (--h.legs > 0) hedgehogPickTarget(h);
        else {
            h.state = "leaving";
            h.dir = Math.random() < 0.5 ? -1 : 1;
            h.target = h.dir < 0 ? -HEDGEHOG_SIZE * 2 : W + HEDGEHOG_SIZE * 2;
        }
    }
}

function hedgehogDraw() {
    const h = hedgehog;
    if (!h || !cells.hedgehog.length || !GARDEN_ROOMS.includes(room)) return;
    const walking = clock >= h.pauseUntil,
        frames = numbers(CFG.hedgehog.presets[walking ? 0 : 1].seq),
        ms = CFG.hedgehog.presets[walking ? 0 : 1].ms / (h.state === "fleeing" ? 2.5 : 1),
        fi = walking ? Math.floor((clock - h.walkStart) / ms) % frames.length : 0,
        cell = cells.hedgehog[frames[fi] - 1];
    if (!cell) return;
    const top = HEDGEHOG_LINE_Y - HEDGEHOG_SIZE * HEDGEHOG_FEET;
    ctx.save();
    ctx.translate(h.x, 0);
    if (h.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(cell, -HEDGEHOG_SIZE / 2, top, HEDGEHOG_SIZE, HEDGEHOG_SIZE);
    if (h.fruit >= 0 && cells.hedgehogGame[h.fruit]) {
        // Owoc na grzbiecie (środek kolców ~ lekko za środkiem sprite'a),
        // delikatnie podskakuje w rytm kroków.
        const bob = walking ? Math.abs(Math.sin(((clock - h.walkStart) / (h.state === "fleeing" ? 40 : 95)) * 0.52)) * 2 : 0;
        ctx.drawImage(cells.hedgehogGame[h.fruit], -HEDGEHOG_FRUIT_SIZE / 2 - 4 * HEDGEHOG_SCALE, top + 9 * HEDGEHOG_SCALE - HEDGEHOG_FRUIT_SIZE * 0.45 - bob * HEDGEHOG_SCALE, HEDGEHOG_FRUIT_SIZE, HEDGEHOG_FRUIT_SIZE);
    }
    ctx.restore();
}

function hedgeFruitDraw() {
    const f = hedgeFruit;
    if (f && cells.hedgehogGame[f.idx]) {
        const t = clamp((clock - f.born) / 420, 0, 1),
            // spada z grzbietu i odbija się raz
            drop = t < 1 ? (1 - t) * HEDGEHOG_FRUIT_SIZE * 0.9 + Math.abs(Math.sin(t * Math.PI * 2)) * -8 * (1 - t) : 0,
            fade = clamp((HEDGEHOG_FRUIT_LIFE - (clock - f.born)) / 2500, 0, 1);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.drawImage(cells.hedgehogGame[f.idx], f.x - HEDGEHOG_FRUIT_SIZE / 2, f.y - HEDGEHOG_FRUIT_SIZE * 0.8 - drop, HEDGEHOG_FRUIT_SIZE, HEDGEHOG_FRUIT_SIZE);
        ctx.restore();
    }
    for (let i = fruitPops.length - 1; i >= 0; i--) {
        const e = fruitPops[i],
            t = clamp((clock - e.born) / 550, 0, 1);
        if (t >= 1) {
            fruitPops.splice(i, 1);
            continue;
        }
        const im = images.bubbleStar;
        if (!im) continue;
        const ease = 1 - Math.pow(1 - t, 3),
            size = 70 * (0.55 + ease * 0.7);
        ctx.save();
        ctx.globalAlpha = 1 - t * t;
        ctx.drawImage(im, e.x - size / 2, e.y - ease * 40 - size / 2, size, size);
        ctx.restore();
    }
}

// Skorupy w dymku: wycięte do widocznej części (arkusz ma 4 komórki 40×40)
const dishCrops = {};
function dishCrop(idx) {
    if (dishCrops[idx]) return dishCrops[idx];
    const im = images.dish;
    if (!im) return null;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 40;
    const c2 = cv.getContext("2d");
    c2.drawImage(im, idx * 40, 0, 40, 40, 0, 0, 40, 40);
    const b = alphaBox(cv, 0, 0, 40, 40);
    if (!b) return null;
    const out = document.createElement("canvas");
    out.width = b.x1 - b.x0;
    out.height = b.y1 - b.y0;
    out.getContext("2d").drawImage(cv, b.x0, b.y0, out.width, out.height, 0, 0, out.width, out.height);
    return (dishCrops[idx] = out);
}
function iconDraw(c, key, x, y, w, h = w) {
    if (key === "dish") {
        const cr = dishCrop(dishBubbleIdx);
        if (!cr) return;
        const ratio = cr.width / cr.height;
        let iw = w,
            ih = w / ratio;
        if (ih > h) {
            ih = h;
            iw = h * ratio;
        }
        c.imageSmoothingEnabled = false;
        c.drawImage(cr, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
        c.imageSmoothingEnabled = true;
        return;
    }
    if (key === "poop") {
        const ratio = images.poop.width / images.poop.height;
        let iw = w,
            ih = w / ratio;
        if (ih > h) {
            ih = h;
            iw = h * ratio;
        }
        c.drawImage(images.poop, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
        return;
    }
    const n = UI.map[key];
    if (n && cells.ui[n - 1]) c.drawImage(cells.ui[n - 1], x, y, w, h);
}

function bubbleDraw(dt) {
    if (!bubble || clock > bubble.until) {
        bubblePos = null;
        return;
    }
    const h = headPosition(),
        size = clamp(UI.bubbleSize, 60, 106),
        // Przy krawędzi pokoju (piesek wchodzi/wychodzi) chmurka gaśnie i znika,
        // zamiast "przyklejać się" do brzegu ekranu i żyć własnym życiem.
        edgeAlpha = clamp((Math.min(h.x, W - h.x) - 26) / 56, 0, 1),
        target = {
            x: clamp(h.x - size * (left ? 0.36 : 0.64), 6, W - size - 6),
            y: clamp(h.y - size - 12, 6, SH - size - 6),
        };
    if (edgeAlpha <= 0) {
        bubblePos = null;
        return;
    }
    if (!bubblePos)
        bubblePos = {
            ...target,
        };
    const blend = 1 - Math.exp(-dt / 70);
    bubblePos.x += (target.x - bubblePos.x) * blend;
    bubblePos.y += (target.y - bubblePos.y) * blend;
    const bx = clamp(bubblePos.x, 6, W - size - 6),
        by = clamp(bubblePos.y, 6, SH - size - 6),
        type = bubble.type || "thought";
    ctx.save();
    ctx.globalAlpha = edgeAlpha;
    if (left) {
        ctx.translate(bx + size, by);
        ctx.scale(-1, 1);
        iconDraw(ctx, type, 0, 0, size);
    } else iconDraw(ctx, type, bx, by, size);
    ctx.restore();
    // Środek "brzuszka" dymku (bez ogonka) — z grafiki, patrz bubbleBodyCenter()
    const center = bubbleBodyCenter(type),
        base = Math.min(UI.bubbleSymbolSize, size * 0.58),
        // smutek: ikonka (nie dymek) pulsuje; po odmowie mocniej i szybciej
        boost = clock < sadBoostUntil,
        pulse = bubble.pulse ? 1 + (boost ? 0.22 : 0.13) * (0.5 + 0.5 * Math.sin((clock / (boost ? 150 : 260)) * Math.PI)) : 1,
        symbol = base * pulse,
        art = iconArtCenter(bubble.icon),
        cx = bx + (left ? 1 - center[0] : center[0]) * size,
        cy = by + center[1] * size;
    ctx.save();
    ctx.globalAlpha = edgeAlpha;
    // rysunek ikonki ustawiony tak, by środek jej WIDOCZNEJ części trafił w środek dymku
    iconDraw(ctx, bubble.icon, cx - art[0] * symbol, cy - art[1] * symbol, symbol);
    ctx.restore();
}

// Środek widocznej części grafiki (ułamki 0..1 pola) — ikonki nie są
// narysowane idealnie na środku swoich pól, więc liczymy to z kanału alfa.
const artCenterCache = {};
function alphaBox(img, sx, sy, sw, sh) {
    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const d = g.getImageData(0, 0, sw, sh).data;
    let x0 = sw,
        y0 = sh,
        x1 = -1,
        y1 = -1;
    for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++)
            if (d[(y * sw + x) * 4 + 3] > 40) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, w: sw, h: sh, data: d };
}
function iconArtCenter(key) {
    if (artCenterCache[key]) return artCenterCache[key];
    let res = [0.5, 0.5];
    try {
        if (key === "poop" || key === "dish") res = [0.5, 0.5]; // rysowana z dopasowaniem proporcji, wyśrodkowana
        else if (UI.map[key]) {
            const cell = cells.ui[UI.map[key] - 1],
                b = alphaBox(cell, 0, 0, cell.width, cell.height);
            if (b) res = [(b.x0 + b.x1) / 2 / b.w, (b.y0 + b.y1) / 2 / b.h];
        }
    } catch (_) {}
    return (artCenterCache[key] = res);
}
// Dymek "myśli" ma pod spodem ogonek z kółeczek — środek liczymy tylko z
// największego, zwartego "brzuszka": wiersze, w których dymek jest szeroki.
function bubbleBodyCenter(type) {
    const k = "bubble:" + type;
    if (artCenterCache[k]) return artCenterCache[k];
    let res = P.bubbleCenters?.[type] || [0.5, 0.4];
    try {
        const cell = cells.ui[UI.map[type] - 1],
            b = alphaBox(cell, 0, 0, cell.width, cell.height);
        if (b) {
            const rows = [];
            for (let y = 0; y < b.h; y++) {
                let a = -1,
                    z = -1;
                for (let x = 0; x < b.w; x++)
                    if (b.data[(y * b.w + x) * 4 + 3] > 40) {
                        if (a < 0) a = x;
                        z = x;
                    }
                rows.push(a < 0 ? 0 : z - a + 1);
            }
            const maxW = Math.max(...rows),
                body = rows.map((w, y) => (w >= maxW * 0.35 ? y : -1)).filter((y) => y >= 0);
            // brzuszek = najdłuższy ciągły pas szerokich wierszy
            let best = [body[0], body[0]],
                cur = [body[0], body[0]];
            for (let i = 1; i < body.length; i++) {
                if (body[i] === body[i - 1] + 1) cur[1] = body[i];
                else cur = [body[i], body[i]];
                if (cur[1] - cur[0] > best[1] - best[0]) best = [...cur];
            }
            let xa = b.w,
                xz = -1;
            for (let y = best[0]; y <= best[1]; y++)
                for (let x = 0; x < b.w; x++)
                    if (b.data[(y * b.w + x) * 4 + 3] > 40) {
                        if (x < xa) xa = x;
                        if (x > xz) xz = x;
                    }
            res = [(xa + xz + 1) / 2 / b.w, (best[0] + best[1] + 1) / 2 / b.h];
        }
    } catch (_) {}
    return (artCenterCache[k] = res);
}

function draw(dt) {
    ctx.clearRect(0, 0, W, SH);
    ctx.imageSmoothingEnabled = false;
    // Motylki-tło rysowane PRZED pieskiem, więc są wizualnie za nim — i
    // trzymają się wyłącznie górnego pasa "nieba" (patrz AMBIENT_ZONE_BOTTOM),
    // więc nie wchodzą mu na grzbiet ani pod brzuch. Rysowane też podczas
    // interaktywnego butterflyEvent() — tło ma dalej żyć w czasie
    // rzeczywistym, zamiast znikać na czas pogoni za innym motylkiem.
    ambientDraw();
    if (!dogHidden) drawDog(ctx);
    if (phase === "paws-clean") pawsClothDraw();
    // Kret-zapowiedź PRZED pieskiem (na pierwszym planie) — w
    // przeciwieństwie do motylków-tła, które lecą za nim.
    // Kupka: pierwszy plan, tuż pod linią podłogi pieska — ale za kretem
    // (kret rysowany zaraz po niej, więc jest przed kupką).
    if (poop && Math.abs(order.indexOf(poop.room) - order.indexOf(room)) <= 1) {
        const r = poopRect();
        ctx.drawImage(images.poop, r.x, r.y, r.w, r.h);
    }
    moleTeaserDraw();
    if (typeof boneMoleDraw === "function") boneMoleDraw();
    if (typeof boneDigDraw === "function") boneDigDraw();
    hedgePeekDraw();
    // Jeżyk i zgubiony owoc — pierwszy plan, przed pieskiem.
    hedgeFruitDraw();
    hedgehogDraw();
    catchOverlayDraw();
    if (boneVisible) iconDraw(ctx, "bone", x * W + 20, GROUND - 30, 37);
    if (butterfly?.visible) {
        // Ten sam motylek (kolor + zegar trzepotu) co w catchOverlayDraw() —
        // cały event lata jedną, spójną grafiką z motyle-new.png.
        const cell = eventButterflyCell();
        if (butterfly.free && !butterfly.lure?.done) butterflyFrameDraw(butterfly);
        if (cell) {
            ctx.save();
            ctx.translate(butterfly.x, butterfly.y);
            if (butterfly.dir < 0) ctx.scale(-1, 1);
            ctx.drawImage(cell, -EVENT_BUTTERFLY_SIZE / 2, -EVENT_BUTTERFLY_SIZE / 2, EVENT_BUTTERFLY_SIZE, EVENT_BUTTERFLY_SIZE);
            ctx.restore();
        }
    }
    lumpDraw();
    dishDraw(); // skorupy za piłką (piłka leży przed nimi)
    ballDraw();
    moleDirtDraw();
    bubbleDraw(dt);
    bubbleGameDraw();
    moleGameDraw();
    hedgeGameDraw();
    mole2GameDraw();
    memoGameDraw();
    memoEndDraw();
    hedgeWinDraw();
    moleWinDraw();
    mole2WinDraw();
    if (!$(".bubbleWinPopup").hidden) {
        bubbleWinCtx.clearRect(0, 0, 260, 210);
        drawDog(bubbleWinCtx, 130, 196, left, 0.85);
    }
    if (!$(".popup").hidden) {
        rewardCtx.clearRect(0, 0, 300, 300);
        drawDog(rewardCtx, 150, 255, left, 0.72);
    }
    const c = x * W;
    $(".arrow.prev").classList.toggle("near", c - 102 < 66);
    $(".arrow.next").classList.toggle("near", c + 102 > W - 66);
}

function loopFrame(t) {
    const dt = last ? Math.min(60, t - last) : 0;
    last = t;
    if (loaded && !document.hidden && !orientationPaused) {
        clock += dt;
        updateNeeds(dt / 1000);
        if (phase !== "swipe-preview") frameIndex = Math.floor((clock - animStart) / ms) % frames.length;
        if (segment) {
            const p = clamp((clock - segment.started) / segment.time, 0, 1);
            if (segment.to !== undefined) x = segment.origin + (segment.to - segment.origin) * p;
            if (segment.motion) {
                const travelled = Math.abs(x - segment.origin) * W,
                    stride = segment.motion === "walk" ? 13 : 36;
                frameIndex = segment.distance > 2 ? Math.floor(travelled / stride) % frames.length : 0;
            }
            segment.update?.(p);
            if (p >= 1) {
                const old = segment;
                segment = null;
                old.onEnd?.();
                if (!segment && phase !== "idle") nextSegment();
            }
        } else if (phase === "petting") {
            if (clock >= petFinishAt || (!gesture && clock - petLast > 3000)) endPetting();
        } else if (phase === "idle" && !sleeping && !gesture && !menu.drag) {
            if (sadNeed()) sadStart();
            else if (!poop && poopUrge()) spawnPoop();
            else if (clock >= nextTrip) autoTrip();
            else if (clock >= idleUntil) autonomous();
        }
        if (bubbleGame) bubbleGameUpdate(dt);
        if (moleGame) moleGameUpdate(dt);
        if (fetchGame || !$(".fetchEnd").hidden) updateFetchUi();
        if (hedgeGame) hedgeGameUpdate(dt);
        if (mole2Game) mole2GameUpdate(dt);
        if (memoGame) memoGameUpdate();
        // Działają zawsze, też podczas butterflyEvent() (phase==="butterfly") —
        // tło ma dalej żyć w czasie rzeczywistym, niezależnie od scenki
        // pogoni za motylkiem na pierwszym planie.
        if (!butterfly && clock >= nextButterfly && !wildlifeBusy("butterfly") && casual() && !sleeping && !dirty() && !menu.drag && ["garden", "yard"].includes(room)) butterflySpawn();
        butterflyFreeUpdate();
        ambientUpdate(dt);
        hedgehogUpdate(dt);
        moleTeaserUpdate();
        if (typeof boneMoleUpdate === "function") boneMoleUpdate();
        if (typeof boneDigUpdate === "function") boneDigUpdate();
        bubbleThink();
        draw(dt);
    }
    requestAnimationFrame(loopFrame);
}
// Grafiki wczytują się RÓWNOLEGLE (boot() uruchamia je wszystkie naraz), a
// kolejne wywołania loadImage() dla tego samego adresu dostają ten sam wynik.
const imgCache = new Map();
function loadImage(src) {
    if (!imgCache.has(src)) imgCache.set(src, loadImageNow(src));
    return imgCache.get(src);
}
async function loadImageNow(src) {
    const im = new Image();
    await new Promise((ok, bad) => {
        im.onload = ok;
        im.onerror = () => bad(Error("Nie można odczytać grafiki."));
        // Cache-bust — tak samo jak przy JSON-ach z animacjami (fresh()
        // powyżej), żeby podmieniona grafika była widoczna od razu, bez
        // czyszczenia cache przeglądarki.
        im.src = src + (src.includes("?") ? "&" : "?") + "t=" + Date.now();
    });
    return im;
}

// Szuka w danych klatki (RGBA, w×h) nasyconego zielonego znacznika #00ff43
// wstawionego ręcznie przez artystę jako miejsce na motylka — wartość ta
// jest bardzo odległa od naturalnej palety pieska (brązy/beże/różowe/biel/
// czerń), więc szeroka tolerancja jest bezpieczna. Zwraca środek
// bounding-boxa w lokalnych pikselach klatki (albo null, jeśli nic nie
// znaleziono) i PO DRODZE czyści dopasowane piksele (alpha=0), żeby
// znacznik nie był widoczny w finalnej grafice.
function extractMarker(data, w, h) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity,
        found = false;
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            const idx = (py * w + px) * 4,
                r = data[idx],
                g = data[idx + 1],
                b = data[idx + 2],
                a = data[idx + 3];
            if (a > 100 && r < 60 && g > 180 && b < 110) {
                found = true;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
                data[idx + 3] = 0;
            }
        }
    }
    return found ? { x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 } : null;
}
async function boot() {
    // Załaduj konfigurację z osobnego pliku
    // cache:"no-cache" — przeglądarka zawsze sprawdza, czy plik się zmienił,
    // więc po wgraniu nowego JSON-a zmiany widać bez czyszczenia cache
    const fresh = (u) => fetch(u, { cache: "no-cache" }).then((r) => r.json());
    const lp = (v) => window.loadScreen?.progress(v);
    lp(0.04);
    P = await fresh("data/config.json");
    lp(0.1);
    // Załaduj animacje z plików edytora (animacje-ustawienia/)
    // — te pliki są źródłem prawdy; config.json trzyma resztę ustawień
    const [anim01, anim02, anim03, motyleAnim, kretAnim, hedgehogAnim, hedgehogGameAnim, skel] = await Promise.all([
        fresh("animacje-ustawienia/latka-animacje-01.json"),
        fresh("animacje-ustawienia/latka-animacje-02.json"),
        fresh("animacje-ustawienia/latka-animacje-03.json"), // kopanie kostek (mini gra z liczeniem)
        fresh("animacje-ustawienia/motyle-001-animacje.json"),
        fresh("animacje-ustawienia/kret-animacje.json"),
        fresh("animacje-ustawienia/hedgehog-animacje.json"),
        fresh("animacje-ustawienia/hedgehog-game-animacje.json"),
        fresh("animacje-ustawienia/szkielet.json").catch(() => null), // punkty łap/nosa/ogona (brud na łapkach)
    ]);
    skeleton = skel;
    lp(0.16);
    // Wszystkie grafiki naraz (tła pokoi też — żeby nic nie "doskakiwało" w grze);
    // pasek ładowania rośnie z każdą wczytaną grafiką.
    {
        const a = P.assets,
            urls = [a.a01, a.a02, a.ui, a.poop, a.motyle, a.kret, a.hedgehog, a.hedgehogGame, a.bubbleStar, a.bubbleWrong, ...(a.balls || []), ...(a.bubbles || []), ...Object.values(a.rooms || {})].filter(Boolean);
        let done = 0;
        window.bootImages = Promise.all(
            urls.map((u) =>
                loadImage(u).then(() => {
                    done++;
                    lp(0.16 + 0.78 * (done / urls.length));
                })
            )
        );
    }
    CFG = P.config;
    CFG.a01 = anim01;
    CFG.a02 = anim02;
    CFG.a03 = anim03;
    CFG.motyle = motyleAnim;
    CFG.kret = kretAnim;
    CFG.hedgehog = hedgehogAnim;
    CFG.hedgehogGame = hedgehogGameAnim;
    UI = CFG.ui;
    for (const k of ["a01", "a02", "ui", "poop"]) images[k] = await loadImage(P.assets[k]);
    images.a03 = await loadImage("animacje/latka-animacje-03.png");
    images.dish = await loadImage("animacje/naczynia.png");
    // Stary dwuklatkowy motyl-1.png/motyl-2.png (P.assets.butterflies) nie
    // jest już używany — cały butterflyEvent() lata teraz jedną, spójną
    // grafiką z motyle-new.png (patrz eventButterflyCell()).
    if (P.assets.motyle) {
        // Arkusz motyle-001.png: siatka cols×rows (patrz CFG.motyle), po
        // jednym wierszu na kolor — tniemy na osobne klatki, tak jak banki
        // niżej. Używane na razie do motylków-tła w ogrodzie/podwórku
        // (ambientDraw/ambientUpdate); później też do nowej mini-gry.
        images.motyle = await loadImage(P.assets.motyle);
        const { cols, rows } = CFG.motyle,
            mw = images.motyle.width / cols,
            mh = images.motyle.height / rows;
        for (let f = 0; f < cols * rows; f++) {
            const c = document.createElement("canvas");
            c.width = mw;
            c.height = mh;
            c.getContext("2d").drawImage(images.motyle, (f % cols) * mw, Math.floor(f / cols) * mh, mw, mh, 0, 0, mw, mh);
            cells.motyle.push(c);
        }
    }
    if (P.assets.kret) {
        // Arkusz kret.png: siatka 4×4 (patrz CFG.kret) — tniemy tak samo jak
        // motyle-new.png. Używane do zapowiedzi "kreta w ogrodzie" (ambient,
        // patrz moleTeaserSpawn/Update/Draw) i do pełnej mini-gry w kreta
        // (js/minigame-mole.js).
        images.kret = await loadImage(P.assets.kret);
        const { cols, rows } = CFG.kret,
            kw = images.kret.width / cols,
            kh = images.kret.height / rows;
        for (let f = 0; f < cols * rows; f++) {
            const c = document.createElement("canvas");
            c.width = kw;
            c.height = kh;
            c.getContext("2d").drawImage(images.kret, (f % cols) * kw, Math.floor(f / cols) * kh, kw, kh, 0, 0, kw, kh);
            cells.kret.push(c);
        }
    }
    // Jeżyk: arkusz spaceru (3×4) i arkusz słodyczy/owoców (4×2) — oba tniemy
    // na osobne klatki. Spacerujący jeżyk: patrz hedgehogUpdate/Draw.
    for (const key of ["hedgehog", "hedgehogGame"]) {
        if (!P.assets[key]) continue;
        images[key] = await loadImage(P.assets[key]);
        const { cols, rows } = CFG[key],
            cw = images[key].width / cols,
            ch = images[key].height / rows;
        for (let f = 0; f < cols * rows; f++) {
            const c = document.createElement("canvas");
            c.width = cw;
            c.height = ch;
            c.getContext("2d").drawImage(images[key], (f % cols) * cw, Math.floor(f / cols) * ch, cw, ch, 0, 0, cw, ch);
            cells[key].push(c);
        }
    }
    if (P.assets.balls)
        for (let i = 0; i < P.assets.balls.length; i++)
            images["ball" + i] = await loadImage(P.assets.balls[i]);
    if (P.assets.bubbles) {
        // Dwa arkusze baniek — każdy to siatka 4x5 (64x64), 20 różnych
        // kształtów/wariantów. Tniemy je na osobne obrazki, żeby losowo
        // wybierać dowolną z 40 baniek (chaos, jak prosił użytkownik).
        for (const src of P.assets.bubbles) {
            const im = await loadImage(src),
                cols = 4,
                rows = 5,
                w = im.width / cols,
                h = im.height / rows;
            for (let f = 0; f < cols * rows; f++) {
                const c = document.createElement("canvas");
                c.width = w;
                c.height = h;
                c.getContext("2d").drawImage(im, (f % cols) * w, Math.floor(f / cols) * h, w, h, 0, 0, w, h);
                cells.bubbles.push(c);
            }
        }
    }
    if (P.assets.bubbleStar) images.bubbleStar = await loadImage(P.assets.bubbleStar);
    if (P.assets.bubbleWrong) images.bubbleWrong = await loadImage(P.assets.bubbleWrong);
    for (const key of ["a01", "a02", "a03", "ui"]) {
        const rows = key === "ui" ? 6 : 12,
            im = images[key],
            w = im.width / 6,
            h = im.height / rows;
        for (let f = 0; f < rows * 6; f++) {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const cx = c.getContext("2d");
            cx.drawImage(im, (f % 6) * w, Math.floor(f / 6) * h, w, h, 0, 0, w, h);
            if (key === "a02") {
                // Klatki biorące udział w butterflyEvent() mają wstawiony
                // zielony znacznik (#00ff43) w miejscu, gdzie ma się
                // pojawić motylek — wykrywamy go, zapamiętujemy środek
                // i usuwamy z finalnej grafiki (patrz catchMarkerPos()).
                const imgData = cx.getImageData(0, 0, w, h),
                    marker = extractMarker(imgData.data, w, h);
                if (marker) {
                    catchMarker[f + 1] = marker;
                    cx.putImageData(imgData, 0, 0);
                }
            }
            cells[key].push(c);
            if (key !== "ui") pixels[key].push(cx.getImageData(0, 0, w, h).data);
        }
    }
    // Arkusz a03 (kopanie kostek) nie ma gotowych „meta” w config.json —
    // liczymy ramkę (box) i miejsce głowy (head) z pikseli, jak dla a01/a02.
    if (!P.meta.a03)
        P.meta.a03 = pixels.a03.map((d, i) => {
            const w = cells.a03[i].width,
                h = cells.a03[i].height;
            let x0 = w,
                y0 = h,
                x1 = 0,
                y1 = 0;
            for (let y = 0; y < h; y++)
                for (let xx = 0; xx < w; xx++)
                    if (d[(y * w + xx) * 4 + 3] > 120) {
                        if (xx < x0) x0 = xx;
                        if (xx > x1) x1 = xx;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
            if (x1 < x0) return { box: [4, 32, 124, 116], head: [95.2, 34] };
            return { box: [x0, y0, x1 + 1, y1 + 1], head: [x0 + 0.76 * (x1 + 1 - x0), y0 + 2] };
        });
    for (const [key, n] of Object.entries(UI.map)) icons[key] = cells.ui[n - 1].toDataURL("image/png");
    loadNeeds();
    statusBuild();
    statusUpdate();
    const root = $(".menu");
    for (const name of ["pointerdown", "keydown", "click"])
        root.addEventListener(
            name,
            (e) => {
                // Dotknięcie menu przerywa AUTONOMICZNY bieg pieska (jego własny
                // pomysł) — inaczej menu, w tym puchar z grami, byłoby martwe.
                if (!casual() && phase === "travel" && travelMode === "auto") idle(16);
                if (!casual()) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                if (name !== "click") {
                    interrupt();
                    wake();
                }
            },
            true
        );
    menu = new ArcCarousel(root, {
        items: items.map((i) => ({
            ...i,
            svg: '<img alt="" src="' + icons[i.icon] + '">',
        })),
        selectedId: items.some((i) => i.id === selected) ? selected : "sleep",
    });
    root.addEventListener("arc:change", (e) => (selected = e.detail.id));
    root.addEventListener("arc:activate", (e) => action(e.detail.id));
    // Szybki dostęp do gier — puchar w górnym pasku sceny.
    $(".gamesAccess img").src = icons.cup;
    $(".gamesAccess").onclick = () => action("games");
    lp(0.98);
    loaded = true;
    setRoom(room);
    setAnim(sleeping ? "a02" : "a01", sleeping ? 6 : 16);
    if (dirty()) say("poop", 4000);
    // Gra gotowa — ekran ładowania pokazuje duży przycisk i czeka na dotknięcie
    // (to też gest potrzebny do pełnego ekranu). Dopiero potem rusza pętla gry.
    if (window.loadScreen) await window.loadScreen.ready();
    $(".load").hidden = true;
    locks();
    resize();
    save();
    requestAnimationFrame(loopFrame);
}
$(".full").onclick = async () => {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) await document.exitFullscreen();
            else document.webkitExitFullscreen?.();
            return;
        }
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else return; // pełny ekran niedostępny — po cichu
        try {
            if (screen.orientation?.lock) await screen.orientation.lock("portrait");
            else throw Error();
        } catch (e) {
            /* brak blokady obrotu — trudno, gra i tak ma ekran „obróć telefon” */
        }
    } catch (e) {
        /* przeglądarka nie pozwoliła na pełny ekran — po cichu */
    }
};
window.addEventListener("pagehide", save);
// Strona przywrócona z pamięci podręcznej przeglądarki (np. iOS "wstecz"/powrót do karty)
window.addEventListener("pageshow", (e) => {
    if (e.persisted && loaded) location.reload();
});
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
    last = 0;
    if (!document.hidden) {
        // Powrót do okna (np. po zminimalizowaniu na telefonie). Po dłuższej przerwie
        // system mógł zamrozić stronę / zgubić płótno — odświeżamy grę (stan jest zapisany).
        if (loaded && hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) {
            location.reload();
            return;
        }
        // Zabezpieczenie: pies nie może zostać "schowany", gdy nie trwa już żaden aport
        if (loaded && dogHidden && !fetchGame) dogHidden = false;
        if (loaded) {
            x = clamp(x, 0, 1);
            resize();
        }
    } else hiddenAt = Date.now();
    if (document.hidden) {
        save();
        if (gesture?.kind === "pet") stopPetting();
        if (phase === "swipe-preview") {
            phase = "idle";
            setOffset(0);
            locks();
        }
        gesture = null;
    }
});
window.addEventListener("error", (e) => {
    window.loadScreen?.error("Błąd wersji testowej: " + e.message);
});
boot().catch((e) => {
    window.loadScreen?.error(e.message);
});
window.gameTest = {
    state: () => ({
        loaded,
        room,
        x,
        left,
        phase,
        stage,
        travelMode,
        sheet,
        anim,
        frame: currentFrame(),
        actions,
        trips,
        sleeping,
        selected,
        stats,
        heart: heart(),
        poop,
        dirty: !!dirty(),
        moleTeaser,
        moleDirts,
        blockedActivity,
        scale,
        orientationPaused,
        butterfly,
        butterflyVisible: !!butterfly?.visible,
        ball,
        fetchGame,
        bubble,
        bubblePos,
        route: debugRoute,
        roomOffset,
        segmentTime: segment?.time,
        segmentMotion: segment?.motion || null,
        gesture: gesture?.kind || null,
        sceneH: SH,
        ground: GROUND,
        dogBase: BASE,
    }),
    step: stepRoom,
    action,
    touch: react,
    poop: spawnPoop,
    butterfly: butterflySpawn,
    butterflyCatch,
    fetchStart: (...a) => fetchStart(...a),
    throwBall: (...a) => ballThrow(...a),
    confirmBallIntro: () => $(".ballOk").click(),
    walk: localWalk,
    hit: petHit,
    head: headPosition,
    poopRect,
    clean: cleanPoop,
    moleDirtRect,
    cleanMoleDirt,
    moleTeaserSpawn,
    advance: (n) => (clock += n),
    forceVariant: (v) => (forcedVariant = v),
    select: (id, animate = false) =>
        menu.select(id, {
            animate,
        }),
    at: (r, pos = 0.5) => {
        gesture = null;
        queue = [];
        segment = null;
        butterfly = null;
        $(".popup").hidden = true;
        sleeping = false;
        x = pos;
        phase = "idle";
        setRoom(r);
        idle(16);
        nextPoop = clock + 45000;
        nextTrip = clock + 15000;
        nextButterfly = clock + 28000;
    },
    needs: (s) => {
        Object.assign(stats, s);
        statusUpdate();
        syncMenu();
    },
    petStart: startPetting,
    petEnd: stopPetting,
    menu: () => menu,
    putPoop: (r, pos = 0.3) => {
        poop = {
            room: r,
            x: pos,
        };
        updatePoopAccess();
        save();
    },
    clearPoop: () => {
        poop = null;
        updatePoopAccess();
        save();
    },
    putMoleDirt: (r, spotIdx = 0) => {
        const spot = MOLE_TEASER_SPOTS[spotIdx];
        moleDirts[r] = { x: spot.x / W, y: spot.y };
        updateMoleDirtAccess();
        save();
    },
    clearMoleDirt: () => {
        moleDirts = {};
        updateMoleDirtAccess();
        save();
    },
};

// ── TYMCZASOWY panel deweloperski — do usunięcia przed publikacją ──
// Pozwala ręcznie zmieniać potrzeby (jedzenie/woda/zabawa/sen/czystość),
// budzić Łatkę i usuwać kupkę, żeby łatwo testować dowolny stan gry.
function devRefresh() {
    document.querySelectorAll(".devPanel .devRow").forEach((row) => {
        const k = row.dataset.stat,
            out = row.querySelector("output");
        if (out) out.textContent = Math.round(stats[k] ?? 0);
    });
}
document.querySelectorAll(".devPanel .devRow button").forEach((btn) => {
    btn.onclick = () => {
        const row = btn.closest(".devRow"),
            k = row.dataset.stat,
            d = Number(btn.dataset.d);
        stats[k] = clamp((stats[k] ?? 0) + d, 0, 100);
        if (loaded) {
            statusUpdate();
            syncMenu();
        }
        saveNeeds();
        devRefresh();
    };
});
// Przycisk DEV jest ukryty: 5 kliknięć w serduszko przy pasku samopoczucia
// (w ciągu 3 s) pokazuje go, kolejne 5 — chowa go (razem z panelem).
{
    let taps = [];
    $(".heartBadge").addEventListener("click", () => {
        const now = performance.now();
        taps = taps.filter((t) => now - t < 3000);
        taps.push(now);
        if (taps.length < 5) return;
        taps = [];
        const t = $(".devToggle");
        t.hidden = !t.hidden;
        if (t.hidden) $(".devPanel").hidden = true;
    });
}
$(".devToggle").onclick = () => {
    $(".devPanel").hidden = !$(".devPanel").hidden;
    devRefresh();
};
$(".devMaxAll").onclick = () => {
    Object.assign(stats, { food: 100, water: 100, fun: 100, sleep: 100, clean: 100 });
    if (loaded) {
        statusUpdate();
        syncMenu();
    }
    saveNeeds();
    devRefresh();
};
$(".devWake").onclick = () => {
    wake();
    devRefresh();
};
$(".devClean").onclick = () => {
    poop = null;
    updatePoopAccess();
    save();
};
$(".devCleanMole").onclick = () => {
    delete moleDirts[room];
    updateMoleDirtAccess();
    save();
};
