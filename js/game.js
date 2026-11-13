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
        color: "#ffd3dd",
    },
    {
        id: "water",
        icon: "water",
        label: "Napój",
        room: "kitchen",
        color: "#cdeafc",
    },
    {
        id: "fun",
        icon: "fun",
        label: "Zabawa",
        room: "garden",
        color: "#d8f0d0",
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
        color: "#ddd2ff",
    },
    {
        id: "clean",
        icon: "clean",
        label: "Mycie",
        room: "bathroom",
        color: "#ffe9bd",
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
    rewardCtx = $(".card canvas").getContext("2d");
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
    nextTrip = 32000,
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
    for (const key of ["food", "water", "fun", "sleep", "clean", "heart"]) {
        const el = document.createElement("div");
        el.className = "stat";
        el.dataset.status = key;
        el.style.setProperty(
            "--c",
            key === "heart" ? "#e88ca6" : items.find((i) => i.id === key)?.color || "#c7b0da"
        );
        const im = new Image();
        im.src = icons[key];
        im.alt = {
            food: "Głód",
            water: "Woda",
            fun: "Zabawa",
            sleep: "Sen",
            clean: "Czystość",
            heart: "Samopoczucie",
        }[key];
        im.width = im.height = 36;
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.innerHTML = "<i></i>";
        el.append(im, bar, document.createElement("small"));
        $(".status").append(el);
    }
    statusUpdate();
}

function statusUpdate() {
    document.querySelectorAll(".stat").forEach((el) => {
        const v = el.dataset.status === "heart" ? heart() : stats[el.dataset.status];
        el.querySelector("i").style.width = v + "%";
        el.querySelector("small").textContent = Math.round(v) + "%";
        el.setAttribute("aria-label", el.querySelector("img").alt + ": " + Math.round(v) + "%");
    });
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
    document.body.classList.toggle("locked", !casual());
    document.querySelectorAll(".arrow").forEach((b) => (b.disabled = !casual()));
    $(".petAccess").disabled = !canPet();
    updateArrows();
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
    phase = "activity";
    locks();
    let parts = [];
    if (id === "food") parts = [repeatPart("a01", 5)];
    else if (id === "water") parts = [repeatPart("a01", 2)];
    else if (id === "clean")
        parts = [
            repeatPart("a01", 14),
            {
                ...repeatPart("a01", 13),
                onStart: () => {
                    $(".popup").hidden = false;
                    $(".reward").src = icons.clean;
                },
            },
        ];
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
    nextTrip = clock + 40000 + Math.random() * 35000;
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
            time: Math.max(320, ((Math.abs(edge - x) * W) / 210) * 1000),
            onStart: () => (stage = "run"),
        },
        {
            sheet: "a01",
            frames: [1, 2, 7, 8],
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
    if (variant === "happy")
        parts.push({
            sheet: "a01",
            anim: 17,
            tempo: 200,
            facing,
            time: 800,
        });
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
        run = mode === "menu" || distance > 1,
        speed = run ? 210 : 65,
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
    const w = 40,
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
        if (phase === "swipe-preview") settleSwipe(1, false);
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
        if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.2) {
            g.kind = g.dog && !g.poop && canPet() ? "pet" : "vertical";
            if (g.kind === "pet") startPetting();
        } else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2 && casual()) {
            g.kind = "swipe";
            interrupt();
            wake();
            phase = "swipe-preview";
            locks();
        }
    }
    if (g.kind === "swipe") previewSwipe(dx);
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
    if (g.kind === "swipe") {
        settleSwipe(dx < 0 ? 1 : -1, !cancel && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2);
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
        flightEnd = {
            x: x * W + dir * 82,
            y: GROUND - 240,
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
                butterfly.x = flightStart.x + (flightEnd.x - flightStart.x) * p;
                butterfly.y =
                    flightStart.y + (flightEnd.y - flightStart.y) * p + Math.sin(p * Math.PI * 4) * 13;
            },
        },
        {
            sheet: "a01",
            anim: 3,
            time: 900,
            onStart: () => (stage = "butterfly-watch"),
            update: (p) => {
                butterfly.x = flightEnd.x + Math.sin(p * 5) * 7;
                butterfly.y = flightEnd.y + Math.cos(p * 6) * 9;
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
    drawDog(ctx);
    if (boneVisible) iconDraw(ctx, "bone", x * W + 20, GROUND - 30, 37);
    if (butterfly?.visible) {
        ctx.save();
        ctx.translate(butterfly.x, butterfly.y);
        if (butterfly.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(images["b" + (Math.floor(clock / 130) % 2)], -22, -22, 44, 44);
        ctx.restore();
    }
    // Dropping is explicitly a foreground layer and below the dog's walking baseline.
    if (poop && Math.abs(order.indexOf(poop.room) - order.indexOf(room)) <= 1) {
        const r = poopRect();
        ctx.drawImage(images.poop, r.x, r.y, r.w, r.h);
    }
    bubbleDraw(dt);
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
    P = await fetch("data/config.json").then((r) => r.json());
    CFG = P.config;
    UI = CFG.ui;
    for (const k of ["a01", "a02", "ui", "poop"]) images[k] = await loadImage(P.assets[k]);
    for (let i = 0; i < 2; i++) images["b" + i] = await loadImage(P.assets.butterflies[i]);
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
        nextTrip = clock + 32000;
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
