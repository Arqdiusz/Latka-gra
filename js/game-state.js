"use strict";
// Stan gry: dane, stałe, obiekty DOM, ustawienia startowe i stan pieska.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

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
