"use strict";
// Układ okna (resize), animacja pieska (setAnim…), pokoje (roomSVG, buildRooms, setRoom), pasek statusu, menu.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

function resize() {
    const v = window.visualViewport,
        vw = v?.width || innerWidth,
        vh = v?.height || innerHeight;
    scale = Math.max(0.03, Math.min(vw / W, vh / H));
    const g = $("#game");
    g.style.transform = `scale(${scale})`;
    g.style.left = (v?.offsetLeft || 0) + (vw - W * scale) / 2 + "px";
    g.style.top = (v?.offsetTop || 0) + (vh - H * scale) / 2 + "px";
    // pas świata widoczny pod układem 768 na wysokich telefonach — koło menu siada na samym dole ekranu
    g.style.setProperty("--bleed", Math.max(0, Math.min(150, (vh / scale - H) / 2)).toFixed(1) + "px");
    try {
        if (menu) {
            menu.measure();
            menu.render();
        }
    } catch (_) {}
    orientationPaused = matchMedia("(orientation:landscape) and (pointer:coarse)").matches;
    if (orientationPaused && gesture) {
        if (gesture.kind === "pet") stopPetting();
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

// Plik tła pokoju (data/config.json → assets.rooms): wysokie tło 768×2136 (świat do krawędzi okna,
// także w pasach nad i pod grą na wysokich telefonach); środek = dawna scena, góra i dół dorysowane.
// Źródła PNG (w tym stare 768×1024) leżą w source/tla/ i nie są pobierane przez grę.
const roomSrc = (r) => (P.assets.rooms && P.assets.rooms[r]) || "assets/backgrounds/rooms/001.webp";
function roomSVG(r) {
    const src = artUrl(roomSrc(r)); // ten sam adres co przy wczytywaniu z góry (boot) → jedno pobranie
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
