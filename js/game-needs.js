"use strict";
// Smutny piesek, dymki życzeń i myślenia, potrzeby (spadek, efekty akcji, zapis), grudki w domu, zapis gry, odmowy.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

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

// Dymek musi mieć sens: potrzeba w dymku tylko wtedy, gdy naprawdę spada
// (żółta, < 40%) — wtedy piesek częściej „mówi”, czego mu brakuje. Kąpiel
// (bańki) tylko gdy czystość < 50%, piłka tylko gdy zabawa < 75%.
let lowNeedWish = null; // potrzeba pokazana w ostatnim dymku (piesek o nią prosi)
const WISH_NEED_AT = 40,
    NEED_WISH_ICON = { food: "food", water: "water", fun: "fun", sleep: "sleep", clean: "bubbles" };
function bubbleWish() {
    let low = null;
    for (const k of ["food", "water", "fun", "sleep", "clean"]) if (stats[k] < WISH_NEED_AT && (!low || stats[k] < stats[low])) low = k;
    lowNeedWish = null;
    if (low && Math.random() < 0.6) return (lowNeedWish = low), (lastWish = NEED_WISH_ICON[low]);
    const ctx = [];
    if (butterfly?.free && !butterfly.lure && butterfly.plan) ctx.push("butterfly");
    if (moleTeaser || moleDirts[room]) ctx.push("mole");
    if (pawDirt >= PAW_DIRTY_AT && INDOOR_ROOMS.includes(room)) ctx.push("cloth"); // "umyj mi łapki"
    // kostka w dymku = piesek zaraz pobiegnie kopać, więc tylko gdy kopanie jest możliwe (odstęp, wolna scena)
    const boneOk = typeof boneWishOk === "function" && boneWishOk();
    const pool =
        ctx.length && Math.random() < 0.6
            ? ctx
            : WISH_ICONS.filter((w) => w !== lastWish && (w !== "bone" || boneOk) && (w !== "bubbles" || stats.clean < 50) && (w !== "fun" || stats.fun < 75));
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
    // przy samej krawędzi dymek przygasa — poczekaj, aż piesek odejdzie od ściany
    const hx = headPosition().x;
    if (hx < 84 || hx > W - 84) return;
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
        const wish = bubbleWish();
        say(wish, R.showMs);
        if (wish === "bone" && typeof boneWishStart === "function") boneWishStart(); // „chcę kopać” — biegnie do ogrodu
        else if (wish === "bark") bark("hau", 2); // „hau, hau!”
        else if (NEED_WISH_ICON[lowNeedWish] === wish) bark("soft"); // grzecznie prosi o to, czego mu brakuje
    }
}

const NEEDS_KEY = "latka-potrzeby-v1";
// Spadek potrzeb na minutę — dobrany do 15-minutowej sesji (js/session.js):
// energia (sleep) równo od 100 do ~5 w 15 min; jedzenie, woda, zabawa i
// czystość tak, żeby w trakcie sesji trzeba było pieska nakarmić, napoić,
// pobawić się z nim i umyć (start nowej sesji: 75–80%).
const NEEDS_DECAY = { food: 4.5, water: 6, fun: 5, sleep: 6.3, clean: 3 };
// Drzemka w trakcie sesji: krótka, piesek sam się budzi (ziewa i przeciąga się),
// energii przybywa tylko symbolicznie — sesja i tak kończy się po 15 min.
const NAP_MS = 25000,
    NAP_GAIN = 4;
let napStart = 0;
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
    Object.assign(stats, { food: 75, water: 75, fun: 75, sleep: 100, clean: 80 });
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
    if (sleeping && !(typeof session !== "undefined" && session.locked)) {
        stats.sleep = clamp(stats.sleep + (NAP_GAIN * seconds * 1000) / NAP_MS, 0, 100);
        if (clock - napStart >= NAP_MS) napEnd();
    }
    if (typeof sessionTick === "function") sessionTick(seconds);
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
    const lb = lumpBox(lumps[i]);
    sparkleBurst(lb.x + lb.w / 2, lb.y + lb.h / 2, SPARKLE_PAW);
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
    // zapis dopiero, gdy gra naprawdę ruszyła (po „Kontynuuj”/„Graj”) — inaczej „Zacznij od nowa”
    // i samo otwarcie ekranu startowego tworzyłyby zapis przy zamknięciu strony
    if (!loaded || !window.gameStarted) return;
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
