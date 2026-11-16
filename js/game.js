"use strict";
const $ = (s) => document.querySelector(s);
let P, CFG, UI;
// P, CFG, UI są inicjalizowane w boot() po załadowaniu data/config.json
const
    images = {},
    cells = {
        a01: [],
        a02: [],
        ui: [],
        bubbles: [],
    },
    pixels = {
        a01: [],
        a02: [],
    },
    icons = {},
    W = 384,
    H = 768,
    SH = 550,
    GROUND = 425,
    BASE = 2.35,
    KEY = "latkaGame0288",
    order = ["attic", "garden", "yard", "living", "kitchen", "bathroom"];
const items = [
    {
        id: "food",
        icon: "food",
        label: "Nakarm",
        room: "kitchen",
        color: "#ec8d8c",
    },
    {
        id: "water",
        icon: "water",
        label: "Napój",
        room: "kitchen",
        color: "#73bcde",
    },
    {
        id: "fun",
        icon: "fun",
        label: "Zabawa",
        room: "garden",
        color: "#d2e146",
    },
    {
        id: "den",
        icon: "den",
        label: "Buda i kość",
        room: "yard",
        color: "#ead1ae",
    },
    {
        id: "sleep",
        icon: "sleep",
        label: "Sen",
        room: "living",
        color: "#c3adfb",
    },
    {
        id: "clean",
        icon: "clean",
        label: "Mycie",
        room: "bathroom",
        color: "#fde598",
    },
    {
        id: "brush",
        icon: "brush",
        label: "Szczotkowanie",
        room: "living",
        color: "#ffdfb5",
    },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    reduced = matchMedia("(prefers-reduced-motion:reduce)").matches,
    canvas = $("#sceneCanvas"),
    ctx = canvas.getContext("2d"),
    rewardCtx = $(".card canvas").getContext("2d"),
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
    nextBubble = 9000,
    nextButterfly = 28000,
    stage = "",
    travelMode = "",
    jumpY = 0,
    pending = null,
    menu = null,
    gesture = null,
    petFinishAt = Infinity,
    petLast = 0,
    butterfly = null,
    bubble = null,
    bubblePos = null,
    scale = 1,
    actions = 0,
    trips = 0,
    lastVariant = "",
    forcedVariant = null,
    orientationPaused = false,
    boneVisible = false,
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

const NEEDS_KEY = "latka-potrzeby-v1";
const NEEDS_DECAY = { food: 0.65, water: 1, fun: 0.8, sleep: 0.55, clean: 0.35 };
const ACTION_EFFECTS = {
    food: { food: 28, water: -3 },
    water: { water: 35 },
    fun: { fun: 24, water: -5, sleep: -4, clean: -3 },
    den: { fun: 16, food: -2, water: -2 },
    clean: { clean: 38 },
    brush: { clean: 12, fun: 5 },
};
let needsSaveSeconds = 0;
function changeNeeds(changes) {
    for (const [k, v] of Object.entries(changes)) {
        if (Object.prototype.hasOwnProperty.call(stats, k)) stats[k] = clamp(stats[k] + v, 0, 100);
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
        stats[k] = clamp(stats[k] - r * m * (sleeping ? 0.5 : 1), 0, 100);
    }
    if (sleeping) {
        stats.sleep = clamp(stats.sleep + 12 * m, 0, 100);
        if (stats.sleep >= 100) {
            wake();
            toast("Łatka się wyspała!");
        }
    }
    if (poop) stats.clean = clamp(stats.clean - 0.8 * m, 0, 100);
    statusUpdate();
    needsSaveSeconds += seconds;
    if (needsSaveSeconds >= 10) {
        needsSaveSeconds = 0;
        saveNeeds();
    }
}
function save() {
    if (!loaded) return;
    try {
        localStorage.setItem(KEY, JSON.stringify({ room, sleeping, left, poop }));
    } catch (e) {}
    saveNeeds();
}

function toast(s) {
    $(".toast").textContent = s;
    $(".toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($(".toast").hidden = true), 4000);
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
    buildRooms();
    setOffset(0);
    const key = {
        yard: "den",
        garden: "garden",
        living: "living",
        kitchen: "kitchen",
        bathroom: "bathroom",
        attic: "home",
    }[r];
    $(".roomBadge img").src = icons[key];
    $(".roomBadge img").alt = {
        yard: "Podwórko z budą",
        garden: "Ogród",
        living: "Salon",
        kitchen: "Kuchnia",
        bathroom: "Łazienka",
        attic: "Poddasze",
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

function statusBuild() {
    const statsRow = document.createElement("div");
    statsRow.className = "status-stats";

    const labels = { food: "Głód", water: "Woda", fun: "Zabawa", sleep: "Sen", clean: "Czystość" };
    for (const key of ["food", "water", "fun", "sleep", "clean"]) {
        const el = document.createElement("div");
        el.className = "stat";
        el.dataset.status = key;
        el.style.setProperty("--c", items.find((i) => i.id === key)?.color || "#c7b0da");
        const im = new Image();
        im.src = icons[key];
        im.alt = labels[key];
        im.width = im.height = 36;
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.innerHTML = "<i></i>";
        el.append(im, bar);
        statsRow.append(el);
    }
    $(".status").append(statsRow);

    // Serduszko — żyje w pasku sceny (HTML już go ma, tu tylko podpinamy ikonę)
    const heartBadge = $(".heartBadge");
    if (heartBadge) heartBadge.querySelector("img").src = icons["heart"];

    statusUpdate();
}

function statusUpdate() {
    // 5 potrzeb z dynamicznym kolorem paska
    document.querySelectorAll(".stat[data-status]").forEach((el) => {
        const v = stats[el.dataset.status];
        if (v === undefined) return;
        const fill = el.querySelector("i");
        fill.style.width = v + "%";
        fill.style.background = v <= 10 ? "#e84b4b" : v <= 40 ? "#f0c535" : "var(--c)";
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
    const score = (i) => stats[i.id === "den" ? "fun" : i.id === "brush" ? "clean" : i.id] ?? 50;
    const min = Math.min(...allowed.map(score)),
        tied = allowed.filter((i) => score(i) === min);
    selected = tied.some((i) => i.id === selected) ? selected : tied[0].id;
    // menu?.select(selected, { animate: false });
}

function casual() {
    return loaded && ["idle", "roam", "pause", "look", "butterfly"].includes(phase);
}

function canPet() {
    return casual() || phase === "petting";
}

function locks() {
    // W czasie czekania na rzut / łapania baniek menu zostaje aktywne,
    // żeby dało się wyjść z zabawy
    document.body.classList.toggle("locked", !casual() && phase !== "ball-ready" && phase !== "bubble-game");
    document.querySelectorAll(".arrow").forEach((b) => (b.disabled = !casual()));
    $(".petAccess").disabled = !canPet();
    updateArrows();
    updateFetchUi();
    updateBubbleUi();
}

// Sygnalizacja rzutów (3 piłeczki) + przyciski końca/resetu zabawy —
// tylko podczas aportu, bez tekstu (dzieci 3+ jeszcze nie czytają).
function updateFetchUi() {
    const badge = $(".throwsBadge"),
        endBtn = $(".fetchEnd"),
        restartBtn = $(".fetchRestart");
    if (!badge || !endBtn || !restartBtn) return;
    const active = !!fetchGame,
        ready = active && phase === "ball-ready",
        outOfThrows = active && fetchGame.throws >= BALL_THROWS;
    badge.hidden = !active;
    endBtn.hidden = !ready;
    restartBtn.hidden = !ready || !outOfThrows;
    if (!active) return;
    const src = images.ball0?.src;
    badge.querySelectorAll("img").forEach((img, i) => {
        if (src) img.src = src;
        img.classList.toggle("used", i < fetchGame.throws);
    });
}

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
    badge.querySelector(".bar i").style.width = clamp((bubbleGame.caught / bubbleGame.need) * 100, 0, 100) + "%";
}

$(".bubbleClose").onclick = () => {
    // Wyjście z kąpieli przyciskiem X — bez nagrody (jak przerwanie przez menu).
    if (phase !== "bubble-game") return;
    bubbleGameFinish(false);
};

// Kołowy "licznik czasu" na zielonym przycisku resetu — ciemna tarcza
// zakrywa go stopniowo (0 = pełny zielony, 100 = w pełni zakryty),
// dokładnie w tempie 8-sekundowego odliczania z ballReadySegment().
function restartRing(pct) {
    const ring = $(".fetchRestart__ring");
    if (ring) ring.style.setProperty("--pct", Math.max(0, Math.min(100, pct)));
}

// Odnowienie rzutów — wspólne dla przycisku i dla samej próby rzutu
// po wyczerpaniu piłek (patrz ballThrow()).
function renewFetch() {
    if (!fetchGame) return;
    fetchGame.throws = 0;
    fetchGame.hinted = false;
    say("fun", 2200);
    startQueue([ballReadySegment()]);
}

$(".fetchEnd").onclick = () => {
    if (phase !== "ball-ready" || !fetchGame) return;
    fetchFinish(fetchGame.throws > 0);
};

$(".fetchRestart").onclick = () => {
    if (phase !== "ball-ready" || !fetchGame || fetchGame.throws < BALL_THROWS) return;
    renewFetch();
};

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
        nextButterfly = clock + 45000;
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
    butterfly = null;
    ball = null;
    fetchGame = null;
    dogHidden = false;
    bubbleGame = null;
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
    say("poop", 4500);
    toast("Najpierw posprzątaj kupkę w tym pomieszczeniu.");
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

// Miski na jedzenie/wodę są namalowane na środku pomieszczenia — jeśli
// pies stoi daleko od środka, niech najpierw podejdzie (obracając się w
// stronę, w którą idzie), zamiast zaczynać stacjonarną animację w miejscu
// (co wyglądało, jakby "cofał się" nienaturalnie w stronę miski).
function walkToSpot(targetX = 0.5, threshold = 0.08) {
    if (Math.abs(x - targetX) < threshold) return [];
    const speed = 150; // px/s — spokojny marsz, nie bieg
    return [
        {
            sheet: "a01",
            anim: 6, // 07. Marsz
            tempo: 200,
            motion: "walk",
            from: x,
            to: targetX,
            time: Math.max(280, (Math.abs(targetX - x) * W) / speed * 1000),
            onStart: () => (stage = "walk-to-spot"),
        },
    ];
}

function activity(id) {
    if (!dirty()) {
        const play = id === "fun" || id === "den";
        if (play && stats.water < 15) {
            idle(16);
            say("water", 3500);
            toast("Najpierw woda — Łatka jest spragniona.");
            return;
        }
        if (play && stats.sleep < 15) {
            idle(16);
            say("sleep", 3500);
            toast("Łatka potrzebuje snu przed zabawą.");
            return;
        }
        if ((id === "food" || id === "water") && stats[id] >= 95) {
            idle(16);
            say(id);
            toast(id === "food" ? "Łatka jest już najedzona." : "Łatka nie potrzebuje więcej wody.");
            return;
        }
    }

    if (blockRoomActivity(id)) return;
    pending = id;
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
        // Mycie = łapanie baniek na całym ekranie.
        bubbleStart();
        return;
    }
    phase = "activity";
    locks();
    let parts = [];
    if (id === "food") parts = [...walkToSpot(), repeatPart("a01", 5)];
    else if (id === "water") parts = [...walkToSpot(), repeatPart("a01", 2)];
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
            time: Math.max(320, ((Math.abs(edge - x) * W) / 350) * 1000),
            onStart: () => (stage = "run"),
        },
        variant === "roll"
            ? {
                  sheet: "a01",
                  anim: 0,
                  tempo: 155,
                  facing,
                  time: reduced ? 200 : 620,
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
                  time: reduced ? 200 : 620,
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
            time: variant === "roll" ? 900 : ((Math.abs(0.5 - land) * W) / 210) * 1000,
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
    pending = id;
    bubble = null;
    locks();
    const from = order.indexOf(room),
        to = order.indexOf(target),
        distance = Math.abs(to - from),
        dir = to >= from ? 1 : -1,
        facing = dir < 0,
        run = true, // zawsze bieg (anim 02. Bieg/sus), spacer usunięty
        speed = mode === "auto" ? 210 : 210,
        parts = [];
    left = facing;

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
    if (!distance) {
        if (Math.abs(x - 0.5) * W > 2) parts.push(movement(x, 0.5));
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
                time: 900,
                onStart: () => (stage = "route-roll"),
            });
        else parts.push(movement(origin, 0.5));
    }
    parts.push({
        sheet: "a01",
        anim: 16,
        facing,
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
    if (!casual()) return;
    const i = items.find((i) => i.id === id);
    if (!i) return;
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
    interrupt();
    wake();
    phase = "reaction";
    locks();
    say("heart");
    startQueue([repeatPart("a01", [10, 12, 7, 15][Math.floor(Math.random() * 4)])]);
}

function startPetting() {
    if (!canPet()) return;
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
    c.restore();
}

function headPosition() {
    const g = geometry(),
        h = P.meta[sheet][g.f - 1].head;
    return {
        x: x * W + (left ? -1 : 1) * ((h[0] - g.w / 2) * g.s + g.o.x * BASE),
        y: GROUND + jumpY + (h[1] - g.g) * g.s + g.o.y * BASE,
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
        y: GROUND + 24 - h,
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
    interrupt();
    wake();
    poop = null;
    blockedActivity = null;
    changeNeeds({ clean: 6 });
    updatePoopAccess();
    say("star");
    save();
    toast("Posprzątane — można znów wybrać czynność.");
}

function spawnPoop() {
    if (!casual() || sleeping || poop) return false;
    interrupt();
    phase = "toilet";
    locks();
    const facing = left;
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
                    x: clamp(x + (left ? 1 : -1) * 0.2, 0.08, 0.92),
                };
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
    nextPoop = clock + 60000;
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
    const time = reduced ? 180 : clamp((Math.abs(end - origin) / W) * 1000 + 180, 260, 1150);
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
        if (gesture.kind === "pet") stopPetting();
        if (phase === "swipe-preview") { phase = "idle"; setOffset(0); }
        gesture = null;
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
    };
    try {
        canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
});
canvas.addEventListener("pointermove", (e) => {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.sx,
        dy = e.clientY - g.sy;
    if (!g.kind) {
        if (phase === "ball-ready") {
            // W trybie aportu każdy ruch palcem to rzut piłką
            if (Math.hypot(dx, dy) > 10) g.kind = "throw";
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
    if (g.kind === "pet") {
        stopPetting();
        return;
    }
    const dx = e.clientX - g.sx,
        dy = e.clientY - g.sy;
    if (g.kind === "throw") {
        if (!cancel) ballThrow(dx, dy);
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
        if (g.poop && poopHit(p.x, p.y)) cleanPoop();
        else if (g.dog && petHit(p.x, p.y)) react();
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

function autoTrip(target = chooseDestination()) {
    if (!casual() || sleeping || gesture || menu.drag) return false;
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

function butterflyEvent() {
    if (!casual() || sleeping || dirty() || !["garden", "yard"].includes(room) || menu.drag || gesture)
        return false;
    interrupt();
    phase = "butterfly";
    bubble = null;
    locks();
    const dir = x < 0.5 ? 1 : -1;
    left = dir < 0;
    const flightStart = {
            x: dir > 0 ? -25 : W + 25,
            y: 200,
        },
        // Koniec ekranu — motylek dolatuje tu i zawraca (patrz niżej).
        flightFar = {
            x: dir > 0 ? W - 15 : 15,
            y: 200,
        },
        // Kawałek bliżej pieska, żeby zawrócenie nie zostawiało motylka za
        // daleko od miejsca, gdzie zaraz zacznie się animacja chwytania.
        flightClose = {
            x: x * W + dir * 70,
            y: 170,
        };
    butterfly = {
        visible: true,
        x: flightStart.x,
        y: flightStart.y,
        dir,
    };
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 2200,
            onStart: () => (stage = "butterfly-flight"),
            update: (p) => {
                butterfly.x = flightStart.x + (flightFar.x - flightStart.x) * p;
                butterfly.y =
                    flightStart.y + (flightFar.y - flightStart.y) * p + Math.sin(p * Math.PI * 4) * 13;
            },
        },
        {
            // Krótkie zawrócenie na końcu ekranu — odbicie sprite'a (zwrócony
            // zgodnie z nowym kierunkiem lotu), tylko na drobny moment, zanim
            // zacznie się animacja chwytania.
            sheet: "a01",
            anim: 3,
            time: 450,
            onStart: () => {
                stage = "butterfly-watch";
                butterfly.dir = -dir;
            },
            update: (p) => {
                butterfly.x = flightFar.x + Math.sin(p * 5) * 7;
                butterfly.y = flightFar.y + Math.cos(p * 6) * 9;
            },
        },
        {
            // Krótki dolot bliżej pieska po zawróceniu — żeby animacja
            // chwytania nie zaczynała się za daleko od tego, gdzie motylek
            // właśnie był.
            sheet: "a01",
            anim: 16,
            time: 500,
            onStart: () => (stage = "butterfly-approach"),
            update: (p) => {
                const e = p * p * (3 - 2 * p); // smoothstep
                butterfly.x = flightFar.x + (flightClose.x - flightFar.x) * e;
                butterfly.y = flightFar.y + (flightClose.y - flightFar.y) * e;
            },
        },
        {
            sheet: "a02",
            anim: 14,
            facing: dir < 0,
            to: clamp(x + dir * 0.1, 0.35, 0.65),
            time: duration("a02", 14) * 2,
            onStart: () => {
                stage = "butterfly-chase";
                butterfly.visible = false;
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
                butterfly.from = {
                    x: x * W + dir * 82,
                    y: GROUND - 240,
                };
            },
            update: (p) => {
                butterfly.x = butterfly.from.x + dir * 190 * p;
                butterfly.y = butterfly.from.y - 90 * p + Math.sin(p * 8) * 6;
            },
            onEnd: () => {
                nextButterfly = clock + 45000 + Math.random() * 40000;
                butterfly = null;
            },
        },
    ]);
    return true;
}

/* ═══════════════════════════════════════════════════════════════
   APORT — zabawa w rzucanie piłki
   Dziecko rzuca piłkę gestem, Łatka biegnie po nią (również do
   sąsiedniego pokoju), podnosi ją i przynosi z powrotem.
   ═══════════════════════════════════════════════════════════════ */
const BALL_THROWS = 3, // ile rzutów do nagrody
    BALL_HINT_AFTER = 7000, // po ilu ms bez rzutu Łatka zachęca
    BALL_GIVE_UP = 30000; // po ilu ms bez rzutu zabawa się kończy
let ball = null, // { room, x, y, spin, carried }
    fetchGame = null, // { throws, hinted, homeRoom, homeX }
    dogHidden = false, // Łatka niewidoczna, gdy czeka "za kadrem" na lądowanie piłki
    bubbleGame = null; // { need, caught, bubbles:[], effects:[], nextSpawn, lastCatch }

// Pozycja piłki na ekranie — uwzględnia sąsiednie pokoje (jak kupka)
function ballScreenX() {
    const diff = order.indexOf(ball.room) - order.indexOf(room);
    return ball.x * W + diff * W + roomOffset;
}

// Świat liczony w sposób ciągły: indeks pokoju + pozycja w pokoju
const worldOf = (r, px) => order.indexOf(r) + px;

function worldSplit(w) {
    const lo = 0,
        hi = order.length - 1 + 0.999;
    w = clamp(w, lo, hi);
    let r = Math.floor(w),
        px = w - r;
    if (r > order.length - 1) {
        r = order.length - 1;
        px = 0.999;
    }
    // Uwaga: BEZ dodatkowego clamp(px, 0.12, 0.88) — podczas gładkiej
    // interpolacji lotu piłki między pokojami (ballThrow) takie ograniczenie
    // powodowało "przyklejenie" pozycji tuż przy krawędzi pokoju, a potem
    // skok, gdy world-pozycja przechodziła do sąsiedniego pokoju.
    return {
        room: order[r],
        x: px,
    };
}

// ── Pop-up z instrukcją przed startem zabawy ──────────────────
// Silnik animacji wymaga, żeby poza stanem "idle" zawsze był jakiś
// segment w kolejce — inaczej sam wraca do idle. Dlatego czekanie na
// kliknięcie "OK" to też segment (jak przy czekaniu na rzut).
let ballIntroResume = null;
function ballIntroShow(onOk) {
    ballIntroResume = onOk;
    $(".ballIcon").src = icons.fun;
    $(".ballPopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16, // 17. Spokojne stanie
            time: 120000,
            onStart: () => {
                phase = "ball-intro";
                stage = "ball-intro";
                locks();
            },
        },
    ]);
}
$(".ballOk").onclick = () => {
    $(".ballPopup").hidden = true;
    const resume = ballIntroResume;
    ballIntroResume = null;
    resume?.();
};

// ── Start zabawy ──────────────────────────────────────────────
function fetchStart() {
    phase = "ball-ready";
    stage = "ball-ready";
    queue = [];
    segment = null;
    jumpY = 0;
    fetchGame = {
        throws: 0,
        hinted: false,
        homeRoom: room,
        homeX: 0.5,
    };
    ball = {
        room,
        // 0.19 — wyliczone z pozycji piłki w sprite animacji "25. Aport_002_warowanie"
        x: clamp(x + (left ? -0.19 : 0.19), 0.12, 0.88),
        y: 0,
        spin: 0,
        carried: false,
    };
    say("fun", 2600);
    toast("Przesuń palcem po ekranie — rzuć piłkę Łatce!");
    startQueue([ballReadySegment()]);
}

// Łatka czeka na rzut — animacja "25. Aport_002_warowanie" (pies leży, piłka
// przy łapach już w sprite). Osobna piłka rysowana przez ballDraw() z pulsującą
// ramką dokładnie nad tą z animacji — dzięki temu wygląda jak jeden obiekt.
function ballReadySegment() {
    // Gdy piłki się skończyły, nie czekamy pełnych 30s w bezczynności —
    // Łatka po chwili sama kładzie się spokojnie (dziecko może zakończyć
    // szybciej przyciskiem ✓).
    const outOfThrows = !!fetchGame && fetchGame.throws >= BALL_THROWS,
        waitTime = outOfThrows ? 8000 : BALL_GIVE_UP;
    return {
        sheet: "a02",
        anim: 24, // 25. Aport_002_warowanie
        time: waitTime,
        onStart: () => {
            phase = "ball-ready";
            stage = "ball-ready";
            if (fetchGame) fetchGame.hinted = outOfThrows;
            restartRing(0);
            locks();
        },
        update: (p) => {
            if (outOfThrows) restartRing(p * 100);
            if (fetchGame && !fetchGame.hinted && p * waitTime > BALL_HINT_AFTER) {
                fetchGame.hinted = true;
                say("fun", 2600);
                toast("Przesuń palcem — Łatka czeka na rzut!");
            }
        },
        onEnd: () => fetchFinish(!!fetchGame && fetchGame.throws > 0),
    };
}

// Zabawa skończona — popup z animacją piłki, potem zwykłe idle
function fetchFinish(rewarded) {
    const got = rewarded && fetchGame && fetchGame.throws > 0;
    fetchGame = null;
    ball = null;
    if (got) {
        phase = "activity";
        pending = "fun";
        locks();
        // Popup natychmiast po przynesieniu piłki — bez zbędnych animacji przed nim.
        $(".popup").hidden = false;
        $(".reward").src = icons.fun;
        startQueue([
            {
                sheet: "a02", anim: 8, time: 1800,                          // piłka zachęta w popupie
                onEnd: () => ($(".popup").hidden = true),
            },
        ]);
    } else idle(16);
}

// ── Rzut ──────────────────────────────────────────────────────
// Piłka leci widocznym łukiem przez pokój Łatki i "wylatuje" przez
// drzwi (staje się niewidoczna, gdy jej światowa pozycja przechodzi
// do sąsiedniego pokoju — kamera tam jeszcze nie jest). Resztę —
// opadnięcie, odbicie i toczenie do właściwego miejsca — odgrywamy
// jako OSOBNĄ scenkę dokładnie w momencie, gdy Łatka faktycznie
// wbiega do pokoju z piłką (patrz fetchChaseParts), tak jak motylek
// w butterflyEvent().
function ballThrow(dx, dy) {
    if (phase !== "ball-ready" || !ball || !fetchGame) return;
    if (fetchGame.throws >= BALL_THROWS) {
        // Piłki się skończyły — ten sam ruch, który byłby rzutem, odnawia
        // licznik I OD RAZU leci jako pierwszy rzut nowej serii (bez
        // dodatkowego, "zgubionego" machnięcia).
        fetchGame.throws = 0;
        fetchGame.hinted = false;
    }
    const swipe = dx / (scale || 1),
        dir = Math.abs(swipe) < 10 ? (left ? -1 : 1) : swipe < 0 ? -1 : 1,
        power = clamp(Math.abs(swipe) / W, 0.18, 1),
        nextIdx = order.indexOf(ball.room) + dir,
        hasNextRoom = nextIdx >= 0 && nextIdx < order.length,
        // Piłka zawsze leci "na drugą planszę" — do sąsiedniego pokoju,
        // lądując przy DALEKIM końcu (żeby pies miał po co biec przez cały pokój).
        // Jeśli to już ostatni pokój w tę stronę — piłka odbija się od ściany.
        land = hasNextRoom
            ? {
                  room: order[nextIdx],
                  // Bliżej krawędzi — animacja chwytu ma pysk wysunięty
                  // trochę dalej do przodu.
                  x: dir > 0
                      ? clamp(0.80 + power * 0.10, 0.80, 0.92)  // daleki koniec, piłka
                      : clamp(0.20 - power * 0.10, 0.08, 0.20), // daleki koniec, piłka
              }
            : { room: ball.room, x: clamp(ball.x + dir * 0.3, 0.1, 0.9) },
        // Punkt, z którego piłka dotacza się do właściwego miejsca (land)
        // podczas scenki upadku — odrobinę bliżej środka pokoju.
        impact = { room: land.room, x: clamp(land.x - dir * 0.06, 0.04, 0.96) },
        start = worldOf(ball.room, ball.x);

    fetchGame.throws++;
    phase = "ball-fly";
    left = dir < 0;
    bubble = null;
    locks();

    // Mocniejszy rzut = szybszy i wyższy łuk — trochę wolniej niż wcześniej,
    // żeby tempo pasowało do opadania w drugim pokoju (FALL w fetchChaseParts).
    const flightTime = clamp(760 - power * 260, 460, 760),
        arc = 130 + power * 120;

    startQueue([
        // Piłka leci widocznym łukiem, Łatka odprowadza ją wzrokiem —
        // widoczna tylko dopóki jest w aktualnym pokoju (potem "wylatuje"
        // przez drzwi i staje się niewidoczna aż Łatka tam dobiegnie).
        {
            sheet: "a01",
            anim: 15, // 16. Patrzenie w górę / łapa
            facing: dir < 0,
            time: flightTime,
            onStart: () => (stage = "ball-fly"),
            update: (p) => {
                const w = start + (worldOf(impact.room, impact.x) - start) * p,
                    pos = worldSplit(w);
                ball.room = pos.room;
                ball.x = pos.x;
                ball.y = -Math.sin(Math.PI * p) * arc;
                ball.spin += dir * 2.2; // widoczne wirowanie w locie
            },
            onEnd: () => {
                // Piłka "jest" już w miejscu lądowania — wysoko w powietrzu,
                // gotowa do opadnięcia w scence odgrywanej w fetchChaseParts().
                ball.room = impact.room;
                ball.x = impact.x;
                ball.y = -140;
            },
        },
        // Pogoń + podniesienie + powrót. Upadek/odbicie/toczenie piłki
        // dogrywane są w segmencie, w którym Łatka wbiega do pokoju z piłką.
        ...fetchChaseParts(land, impact),
    ]);
}

// ── Pogoń, podniesienie i powrót ──────────────────────────────
function moveParts(targetRoom, targetX, opts = {}) {
    const { speed = 235, label = "ball-chase", carry = false } = opts,
        from = order.indexOf(room),
        to = order.indexOf(targetRoom),
        dir = to >= from ? 1 : -1,
        parts = [];
    const seg = (a, b, facing, onEnd) => ({
        // Bieg: a01 „02. Bieg / sus", a z piłką — a02 „12. Aport — ruch z piłką"
        sheet: carry ? "a02" : "a01",
        anim: carry ? 11 : 1,
        tempo: 180,
        motion: "run",
        facing,
        from: a,
        to: b,
        time: Math.max(200, ((Math.abs(b - a) * W) / speed) * 1000),
        onStart: () => (stage = label),
        onEnd,
    });
    let origin = x;
    for (let i = from; i !== to; i += dir) {
        const r = order[i + dir],
            edge = dir > 0 ? 1.08 : -0.08;
        parts.push(
            seg(origin, edge, dir < 0, () => {
                setRoom(r);
                x = dir > 0 ? -0.08 : 1.08;
            })
        );
        origin = dir > 0 ? -0.08 : 1.08;
    }
    parts.push(seg(origin, targetX, targetX < origin));
    return parts;
}

function fetchChaseParts(land, impact) {
    const parts = [];
    // 1. Bieg do piłki — pies wbiega z bliższego końca pokoju i zatrzymuje
    //    się tuż przy piłce (która jest przy dalekim końcu).
    //    Zatrzymujemy się po stronie, z której pies nadbiegł (skąd rzucono).
    // Pies wbiega z bliższej strony pokoju i zatrzymuje się tuż przed piłką.
    // offset: pies staje tak, że piłka jest przy jego przednich łapach.
    // Zwiększone z 0.08 — dog zatrzymuje się trochę dalej od krawędzi,
    // żeby animacja chwytu miała więcej dystansu na "dosięgnięcie" piłki.
    const fromDir = land.x > 0.5 ? -1 : 1; // pies wbiega z lewej (1) lub prawej (-1)
    const approach = clamp(land.x + fromDir * 0.12, 0.06, 0.94);
    const run = moveParts(land.room, approach, { label: "ball-chase" });
    // Piłka opada i odbija się w pokoju lądowania, ZANIM Łatka się tam
    // pojawi — pies jest na ten czas niewidoczny (jeszcze "za kadrem"),
    // a wbiega dopiero, gdy piłka dotknie ziemi (resztkę toczenia piłki
    // dogrywamy już podczas jego dobiegu — tak jak motyl lecący, gdy
    // piesek robi coś innego w butterflyEvent()). Czasy scenek są
    // WŁASNE (oparte na zegarze gry), nie rozciągane/ściskane do
    // długości biegu.
    if (impact) {
        const last = run[run.length - 1],
            fromX = impact.x,
            toX = land.x,
            dir = toX > fromX ? 1 : -1,
            // Opadanie zaczyna się od strony drzwi, z której piłka "wleciała"
            // (ten sam kierunek co w rzucie) — żeby to wyglądało jak ciąg
            // tego samego łuku, a nie nowa, osobna animacja od środka pokoju.
            fallStartX = dir > 0 ? -0.08 : 1.08,
            // Opadanie + dwa gasnące odbicia (jak prawdziwa piłka), potem
            // krótkie, zwalniające dotoczenie podczas dobiegu psa.
            FALL = 460,
            FALL_HEIGHT = 196, // -15%
            BOUNCE1 = 200,
            BOUNCE1_HEIGHT = 60,
            BOUNCE2 = 150,
            BOUNCE2_HEIGHT = 34,
            WAIT_TOTAL = FALL + BOUNCE1 + BOUNCE2,
            ROLL = 380;

        // Etap 1: pies jest niewidoczny (jeszcze nie wbiegł) — piłka opada
        // (przyspieszając, jak w swobodnym spadku), odbija się dwa razy,
        // coraz niżej, a poziomo cały czas płynnie sunie w stronę fromX.
        const wait = {
            sheet: "a01",
            anim: 15,
            facing: last.facing,
            from: last.from,
            to: last.from,
            time: WAIT_TOTAL,
            onStart: () => {
                stage = "ball-land";
                dogHidden = true;
            },
            update: (p) => {
                const t = p * WAIT_TOTAL;
                ball.room = land.room;
                ball.x = fallStartX + (fromX - fallStartX) * p;
                if (t < FALL) {
                    const fp = t / FALL;
                    ball.y = -FALL_HEIGHT * (1 - fp * fp); // przyspieszający spadek
                    ball.spin += dir * 2.2;
                } else if (t < FALL + BOUNCE1) {
                    const bp = (t - FALL) / BOUNCE1;
                    ball.y = -Math.abs(Math.sin(Math.PI * bp)) * BOUNCE1_HEIGHT;
                    ball.spin += dir * 0.5;
                } else {
                    const bp = (t - FALL - BOUNCE1) / BOUNCE2;
                    ball.y = -Math.abs(Math.sin(Math.PI * bp)) * BOUNCE2_HEIGHT;
                    ball.spin += dir * 0.3;
                }
            },
            onEnd: () => {
                ball.x = fromX;
                ball.y = 0;
            },
        };
        run.splice(run.length - 1, 0, wait);

        // Pies staje się widoczny dokładnie w momencie, gdy zaczyna wbiegać.
        const lastOnStart = last.onStart;
        last.onStart = () => {
            dogHidden = false;
            lastOnStart?.();
        };

        // Etap 2: dopiero teraz pies rusza — piłka dotacza się (bez
        // podskakiwania, przy ziemi) do punktu lądowania, ZWALNIAJĄC
        // (ease-out) jak przy wytracaniu pędu przez tarcie o trawę.
        const scale = Math.min(1, last.time / ROLL);
        let rollStart = null;
        last.update = () => {
            if (rollStart === null) rollStart = clock;
            const t = (clock - rollStart) / scale;
            if (t < ROLL) {
                const rp = t / ROLL,
                    eased = 1 - (1 - rp) * (1 - rp);
                ball.x = fromX + (toX - fromX) * eased;
                ball.y = 0;
                ball.spin += dir * 0.25 * (1 - rp);
            } else {
                ball.room = land.room;
                ball.x = toX;
                ball.y = 0;
            }
        };
    }
    parts.push(...run);

    // 2. Chwyt piłki — 24. Aport_001_chwyt_pilki (kończy się pozą z piłką w pysku,
    //    więc od razu można ruszać w drogę powrotną, bez dodatkowego postoju)
    parts.push({
        sheet: "a02",
        anim: 23,
        time: duration("a02", 23),
        facing: fromDir > 0, // pies patrzy w kierunku z którego wbiegł (w stronę piłki)
        onStart: () => {
            stage = "ball-pickup";
            say("heart", 1800);
        },
        onEnd: () => {
            ball.carried = true;
            ball.y = 0;
            // 3. Powrót z piłką — trasę liczymy dopiero teraz, bo Łatka mogła
            //    w międzyczasie przebiec do innego pokoju
            if (!fetchGame) return;
            queue = [
                ...moveParts(fetchGame.homeRoom, fetchGame.homeX, {
                    speed: 215,
                    label: "ball-back",
                    carry: true,
                }),
                ballDropPart(),
            ];
        },
    });
    return parts;
}

// 4. Położenie piłki i gotowość na kolejny rzut
function ballDropPart() {
    return {
        sheet: "a02",
        anim: 13, // 14. Piłka — trzymanie i opuszczanie
        time: duration("a02", 13),
        onStart: () => (stage = "ball-drop"),
        onEnd: () => {
            if (!ball || !fetchGame) return;
            ball.carried = false;
            ball.room = room;
            ball.x = clamp(x + (left ? -0.19 : 0.19), 0.12, 0.88);
            ball.y = 0;
            changeNeeds({ fun: 5, water: -2, sleep: -1 });
            save();
            // Zawsze z powrotem w pozę warowania — nawet po ostatnim rzucie.
            // Zabawa kończy się dopiero przyciskiem końca albo (po dłuższej
            // chwili bez rzutu) automatycznie, w ballReadySegment().
            queue = [ballReadySegment()];
        },
    };
}

// Etapy, w których piłka jest już wrysowana w sprite Łatki —
// wtedy osobnej piłki NIE rysujemy, żeby nie było dwóch naraz
// UWAGA: "ball-ready" jest tu celowo POMINIĘTE, bo wtedy rysujemy
// piłkę osobno (z animowaną ramką zachęcającą do swipe'a).
const SPRITE_HAS_BALL = ["ball-pickup", "ball-back", "ball-drop"];

// Rysowanie piłki — w locie, na ziemi i podczas oczekiwania na rzut
// (z animowaną ramką zachęcającą do swipe'a podczas ball-ready)
function ballDraw() {
    if (!ball || ball.carried || SPRITE_HAS_BALL.includes(stage)) return;
    if (Math.abs(order.indexOf(ball.room) - order.indexOf(room)) > 1) return;
    const n = ((Math.floor(ball.spin) % 4) + 4) % 4,
        im = images["ball" + n];
    if (!im) return;
    const w = im.width * BASE * 0.68, // +5% względem poprzedniego rozmiaru
        h = im.height * BASE * 0.68;
    const bx = ballScreenX() - w / 2,
        // Podczas "ball-ready" celujemy dokładnie w piłkę z animacji "warowanie"
        // (wyliczone z pikseli sprite'a: środek ~18px nad linią chodzenia).
        by =
            stage === "ball-ready"
                ? GROUND - 18 - h / 2 + ball.y
                : GROUND + 10 + ball.y - h; // piłka leży na ziemi (10px poniżej linii chodzenia)

    ctx.drawImage(im, bx, by, w, h);

    // Animowana ramka zachęcająca do rzutu (pulsująca) — tylko podczas oczekiwania
    if (stage === "ball-ready") {
        const pulse = 0.5 + 0.5 * Math.sin(clock / 220),     // 0..1, ~2.8 Hz
            expand = 4 + pulse * 8,                             // 4..12 px poza piłką
            alpha = 0.4 + pulse * 0.55,                         // 0.4..0.95
            r = Math.max(w, h) / 2 + expand,
            cx = bx + w / 2,
            cy = by + h / 2;
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(255,255,255,0.7)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

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

function iconDraw(c, key, x, y, w, h = w) {
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
        target = {
            x: clamp(h.x - size * (left ? 0.36 : 0.64), 6, W - size - 6),
            y: clamp(h.y - size - 12, 6, SH - size - 6),
        };
    if (!bubblePos)
        bubblePos = {
            ...target,
        };
    const blend = 1 - Math.exp(-dt / 110);
    bubblePos.x += (target.x - bubblePos.x) * blend;
    bubblePos.y += (target.y - bubblePos.y) * blend;
    const bx = clamp(bubblePos.x, 6, W - size - 6),
        by = clamp(bubblePos.y, 6, SH - size - 6),
        type = bubble.type || "thought";
    ctx.save();
    if (left) {
        ctx.translate(bx + size, by);
        ctx.scale(-1, 1);
        iconDraw(ctx, type, 0, 0, size);
    } else iconDraw(ctx, type, bx, by, size);
    ctx.restore();
    const center = P.bubbleCenters[type] || [0.5, 0.4],
        symbol = Math.min(UI.bubbleSymbolSize, size * 0.58);
    iconDraw(
        ctx,
        bubble.icon,
        bx + (left ? 1 - center[0] : center[0]) * size - symbol / 2,
        by + center[1] * size - symbol / 2 - 1,
        symbol
    );
}

function draw(dt) {
    ctx.clearRect(0, 0, W, SH);
    ctx.imageSmoothingEnabled = false;
    if (!dogHidden) drawDog(ctx);
    if (boneVisible) iconDraw(ctx, "bone", x * W + 20, GROUND - 30, 37);
    if (butterfly?.visible) {
        // O 33% większy niż bazowe 44px (44 * 1.33 ≈ 58.5).
        const bsz = 58.5;
        ctx.save();
        ctx.translate(butterfly.x, butterfly.y);
        if (butterfly.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(images["b" + (Math.floor(clock / 130) % 2)], -bsz / 2, -bsz / 2, bsz, bsz);
        ctx.restore();
    }
    ballDraw();
    // Dropping is explicitly a foreground layer and below the dog's walking baseline.
    if (poop && Math.abs(order.indexOf(poop.room) - order.indexOf(room)) <= 1) {
        const r = poopRect();
        ctx.drawImage(images.poop, r.x, r.y, r.w, r.h);
    }
    bubbleDraw(dt);
    bubbleGameDraw();
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
            if (clock >= nextPoop && !poop) spawnPoop();
            else if (clock >= nextTrip) autoTrip();
            else if (clock >= nextButterfly && !dirty() && ["garden", "yard"].includes(room))
                butterflyEvent();
            else if (clock >= idleUntil) autonomous();
        }
        if (bubbleGame) bubbleGameUpdate(dt);
        if (clock >= nextBubble && !sleeping && phase === "idle") {
            say(
                dirty() ? "poop" : ["food", "water", "fun", "sleep", "clean"][Math.floor(Math.random() * 5)]
            );
            nextBubble = clock + 14000;
        }
        draw(dt);
    }
    requestAnimationFrame(loopFrame);
}
async function loadImage(src) {
    const im = new Image();
    await new Promise((ok, bad) => {
        im.onload = ok;
        im.onerror = () => bad(Error("Nie można odczytać grafiki."));
        im.src = src;
    });
    return im;
}
async function boot() {
    // Załaduj konfigurację z osobnego pliku
    // cache:"no-cache" — przeglądarka zawsze sprawdza, czy plik się zmienił,
    // więc po wgraniu nowego JSON-a zmiany widać bez czyszczenia cache
    const fresh = (u) => fetch(u, { cache: "no-cache" }).then((r) => r.json());
    P = await fresh("data/config.json");
    // Załaduj animacje z plików edytora (animacje-ustawienia/)
    // — te pliki są źródłem prawdy; config.json trzyma resztę ustawień
    const [anim01, anim02] = await Promise.all([
        fresh("animacje-ustawienia/latka-animacje-01.json"),
        fresh("animacje-ustawienia/latka-animacje-02.json"),
    ]);
    CFG = P.config;
    CFG.a01 = anim01;
    CFG.a02 = anim02;
    UI = CFG.ui;
    for (const k of ["a01", "a02", "ui", "poop"]) images[k] = await loadImage(P.assets[k]);
    for (let i = 0; i < 2; i++) images["b" + i] = await loadImage(P.assets.butterflies[i]);
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
    for (const key of ["a01", "a02", "ui"]) {
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
            cells[key].push(c);
            if (key !== "ui") pixels[key].push(cx.getImageData(0, 0, w, h).data);
        }
    }
    for (const [key, n] of Object.entries(UI.map)) icons[key] = cells.ui[n - 1].toDataURL("image/png");
    loadNeeds();
    statusBuild();
    statusUpdate();
    const root = $(".menu");
    for (const name of ["pointerdown", "keydown", "click"])
        root.addEventListener(
            name,
            (e) => {
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
        selectedId: selected,
    });
    root.addEventListener("arc:change", (e) => (selected = e.detail.id));
    root.addEventListener("arc:activate", (e) => action(e.detail.id));
    loaded = true;
    setRoom(room);
    setAnim(sleeping ? "a02" : "a01", sleeping ? 6 : 16);
    if (dirty()) say("poop", 4000);
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
        else return toast("Pełny ekran jest niedostępny w tej przeglądarce.");
        try {
            if (screen.orientation?.lock) await screen.orientation.lock("portrait");
            else throw Error();
        } catch (e) {
            toast("Brak automatycznej blokady obrotu — trzymaj urządzenie pionowo.");
        }
    } catch (e) {
        toast("Przeglądarka nie pozwoliła uruchomić pełnego ekranu.");
    }
};
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
    last = 0;
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
    $(".load").hidden = false;
    $(".load").textContent = "Błąd wersji testowej: " + e.message;
});
boot().catch((e) => {
    $(".load").hidden = false;
    $(".load").textContent = e.message;
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
    butterfly: butterflyEvent,
    fetchStart,
    throwBall: ballThrow,
    confirmBallIntro: () => $(".ballOk").click(),
    walk: localWalk,
    hit: petHit,
    head: headPosition,
    poopRect,
    clean: cleanPoop,
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
