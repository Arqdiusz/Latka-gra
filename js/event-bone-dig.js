"use strict";
// ═══════════════════════════════════════════════════════════════
// PIESEK KOPIE KOSTKĘ — rzadkie zdarzenie w pokojach ogrodowych.
// Piesek sam z siebie kopie (a03), wykopuje kostkę i stoi z nią w pysku;
// wokół kostki pulsuje okrągła ramka = „dotknij mnie”. Dotyk (kostka albo
// piesek) otwiera wybór „Liczymy kostki”. Bez dotyku po chwili piesek odkłada
// kostkę i wraca do swoich spraw — bez okienek, bez nacisku.
// Losowany na równi z innymi zwierzakami (wildlifeBusy), nigdy razem z nimi,
// a z krecikiem z kostką i grą w kostki dzieli odstęp (boneGapUntil).
// Silnik woła: boneDigUpdate() (pętla), boneDigDraw(), boneDigHit()/boneDigTap().
// DEV: przycisk „Piesek kopie”.
// ═══════════════════════════════════════════════════════════════

const BONE_DIG = {
    first: [45000, 110000], // po wejściu do pokoju ogrodowego
    next: [120000, 180000], // po zakończeniu
    holdMs: 18000, // tyle piesek czeka z kostką na dotyk
    hitR: 58, // promień dotyku wokół kostki
    xMin: 0.25, // nie zaczyna kopać przy samej ścianie (kopiec musi się zmieścić)
    xMax: 0.75,
};
let boneDig = null, // { state: dig|hold|putdown, t }
    nextBoneDig = 0,
    boneDigRoom = null;

function boneDigSchedule(first) {
    const [a, b] = first ? BONE_DIG.first : BONE_DIG.next;
    nextBoneDig = clock + a + Math.random() * (b - a);
}

// ── Chęć z dymka: kostka w dymku → piesek biegnie do (najbliższego) pokoju ogrodowego i kopie ──
let boneWish = null; // { state: wait|go, at, expire }
function boneWishOk() {
    return !boneWish && !boneDig && !boneMole && clock >= boneGapUntil && !sadNeed();
}
function boneWishStart() {
    boneWish = { state: "wait", at: clock + 2200, expire: clock + 45000 }; // chwila na zobaczenie dymku
}
function boneWishUpdate() {
    const w = boneWish;
    if (!w) return;
    if (clock > w.expire || boneDig || sleeping || sadNeed()) {
        boneWish = null;
        return;
    }
    if (!casual() || gesture || menu.drag) return;
    if (w.state === "wait") {
        if (clock < w.at || dirty() || wildlifeBusy("boneDig")) return;
        const here = order.indexOf(room),
            near = GARDEN_ROOMS.slice().sort((a, b) => Math.abs(order.indexOf(a) - here) - Math.abs(order.indexOf(b) - here))[0];
        w.state = "go";
        route(near, null, "auto"); // także w tym samym pokoju: podejdzie na środek
    } else if (GARDEN_ROOMS.includes(room) && x >= BONE_DIG.xMin && x <= BONE_DIG.xMax && !wildlifeBusy("boneDig") && !moleDirts[room]) {
        boneWish = null;
        boneDigSpawn();
    }
}

function boneDigUpdate() {
    if (!loaded) return;
    if (room !== boneDigRoom) {
        boneDigRoom = room;
        boneDigSchedule(true);
    }
    boneWishUpdate();
    if (boneDig) return;
    if (GARDEN_ROOMS.includes(room) && clock >= nextBoneDig && clock >= boneGapUntil && x >= BONE_DIG.xMin && x <= BONE_DIG.xMax && !moleDirts[room] && casual() && !sleeping && !dirty() && !sadNeed() && !menu.drag && !gesture && !wildlifeBusy("boneDig")) boneDigSpawn();
}

function boneDigSpawn() {
    wildlifeCooldown();
    boneGapSet(90000, 120000);
    interrupt();
    const face = left,
        part = (anim, time, extra = {}) => ({ sheet: "a03", anim, facing: face, time, ...extra });
    boneDig = { state: "dig", t: clock };
    startQueue([
        part(0, duration("a03", 0) * 2, {
            onStart: () => {
                stage = "bonedig-dig";
                changeNeeds({ paws: 5 });
                sfx("wipe");
            },
        }),
        part(1, duration("a03", 1), { onStart: () => sfx("good") }),
        // stoi z kostką i czeka na dotyk — pulsuje ramka
        part(4, BONE_DIG.holdMs, {
            onStart: () => {
                if (boneDig) {
                    boneDig.state = "hold";
                    boneDig.t = clock;
                }
            },
        }),
        // nikt nie dotknął: odkłada kostkę i wraca do swoich spraw
        part(5, duration("a03", 5), {
            onStart: () => boneDig && (boneDig.state = "putdown"),
            onEnd: () => boneDigEnd(),
        }),
    ]);
    phase = "bonedig";
    stage = "bonedig-dig";
    locks();
}

function boneDigEnd() {
    boneDig = null;
    boneDigSchedule(false);
    boneGapSet();
    if (phase === "bonedig") idle(16);
}

// Ramka wokół kostki w pysku (przy głowie pieska)
function boneDigPos() {
    const h = headPosition();
    return { x: h.x + (left ? 16 : -16), y: h.y + 78 }; // znacznik głowy jest na czubku — kostka w pysku jest niżej
}

function boneDigDraw() {
    const d = boneDig;
    if (!d || d.state !== "hold" || phase !== "bonedig") return;
    const c = boneDigPos(),
        p = (Math.sin(clock / 260) + 1) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 40 + p * 5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.08 * p})`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * p})`;
    ctx.shadowColor = "rgba(255,190,235,0.95)";
    ctx.shadowBlur = 8 + p * 8;
    ctx.stroke();
    ctx.restore();
}

// Dotyk kostki albo pieska, gdy stoi z kostką (do otwarcia karty)
function boneDigHit(px, py) {
    const d = boneDig;
    if (!d || d.state !== "hold" || phase !== "bonedig") return false;
    const c = boneDigPos();
    return Math.hypot(px - c.x, py - c.y) <= BONE_DIG.hitR || petHit(px, py);
}

// Dotyk: ta sama karta co przy kreciku („Liczymy!” / „Nie teraz”), piesek w tym
// czasie dalej stoi z kostką. Smutnego pieska odsyła sadBlocks (jak przy motylku).
function boneDigTap() {
    if (!boneDig) return;
    if (sadBlocks("butterfly")) return sadRefuse();
    boneDig.state = "popup";
    startQueue([{ sheet: "a03", anim: 4, facing: left, time: 600000 }]);
    boneMoleCard();
}
// Karta zamknięta (któryś z przycisków) — kończy zdarzenie; resztę robi handler karty
function boneDigClose() {
    if (!boneDig) return;
    boneDig = null;
    boneDigSchedule(false);
    boneGapSet();
}

// DEV: od razu piesek kopie kostkę
$(".devBoneDig").onclick = () => {
    if (!casual()) return;
    if (!GARDEN_ROOMS.includes(room)) setRoom("garden");
    if (boneMole) return;
    if (x < BONE_DIG.xMin || x > BONE_DIG.xMax) x = 0.5;
    boneDigSpawn();
};
