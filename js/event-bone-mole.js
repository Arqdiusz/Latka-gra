"use strict";
// ═══════════════════════════════════════════════════════════════
// KRET Z KOSTKĄ — zdarzenie w pokojach ogrodowych (Łąka, Ogród, Podwórko).
// Losowane na równi z innymi zwierzakami (kret, jeżyk, motylki — wlPick),
// nigdy razem z nimi (wildlifeBusy). Przy boku pokoju, na torze pieska,
// wychyla się kret, chowa się i zostaje pulsujący kopiec. Dotyk kopca:
// piesek podbiega, rozkopuje go (arkusz a03), wykopuje kostkę, chwilę z nią
// stoi — a na środku pojawia się karta z zaproszeniem do „Liczymy kostki”.
// Zwykłe krety-zapowiedzi (moleTeaser) działają dalej bez zmian.
// Silnik woła: boneMoleUpdate() (pętla), boneMoleDraw() (rysowanie),
// boneMoleHit()/boneMoleTap() (dotyk). DEV: przycisk „Kret z kostką”.
// ═══════════════════════════════════════════════════════════════

const BONE_MOLE = {
    y: GROUND - 43, // środek kreta (126 px): spód kopca ≈ GROUND+6, jak ziemia w klatkach kopania
    side: 62, // odległość kopca od ściany pokoju
    peekMs: 1300, // jak długo kret się rozgląda
    reach: 46, // piesek stoi tak, by kopiec z animacji kopania (≈ +46 px przed nim) wypadł na kopcu kreta
    first: [5000, 17500], // po wejściu do pokoju — jak zwykły kret
    next: [7500, 22500], // po zakończeniu — jak zwykły kret po sprzątnięciu piachu
    cardAfter: 900, // ile piesek stoi z kostką, zanim pokaże się karta
};
let boneMole = null, // { x, room, state: emerging|peek|retreating|mound|dig, t }
    nextBoneMole = 0,
    boneMoleRoom = null;

function boneMoleSchedule(first) {
    const [a, b] = first ? BONE_MOLE.first : BONE_MOLE.next;
    nextBoneMole = clock + a + Math.random() * (b - a);
}

function boneMoleSpawn() {
    wildlifeCooldown();
    // przy boku pokoju — dalej od pieska (żeby nie wyszedł mu spod łap)
    const right = x * W < W / 2,
        mx = right ? W - BONE_MOLE.side : BONE_MOLE.side;
    boneMole = { x: mx, room, state: "emerging", t: clock };
}

function boneMoleUpdate() {
    if (!loaded || !cells.kret.length) return;
    if (room !== boneMoleRoom) {
        boneMoleRoom = room;
        boneMoleSchedule(true);
    }
    const m = boneMole;
    if (!m) {
        if (GARDEN_ROOMS.includes(room) && !moleDirts[room] && clock >= nextBoneMole && casual() && !sleeping && !dirty() && !menu.drag && !gesture && !wildlifeBusy("boneMole")) boneMoleSpawn();
        return;
    }
    // piesek wyszedł z ogrodu, zanim kopiec rozkopał — kopiec znika (wróci innym razem)
    if (m.room !== room && m.state !== "dig") {
        boneMole = null;
        boneMoleSchedule(false);
        return;
    }
    const el = clock - m.t,
        to = (s) => {
            m.state = s;
            m.t = clock;
        };
    if (m.state === "emerging" && el >= moleTeaserDuration(1)) to("peek");
    else if (m.state === "peek" && el >= BONE_MOLE.peekMs) to("retreating");
    else if (m.state === "retreating" && el >= moleTeaserDuration(3)) to("mound");
    else if (m.state === "mound" && el >= 120000 && casual()) {
        // nikt nie kliknął przez 2 min — kopiec znika (kret wrócił po kostkę)
        boneMole = null;
        boneMoleSchedule(false);
    }
}

function boneMoleFrame() {
    const m = boneMole,
        seq = (i) => numbers(CFG.kret.presets[i].seq);
    if (m.state === "mound") return seq(0)[0];
    if (m.state === "peek") {
        const f = seq(2);
        return f[Math.floor((clock - m.t) / 160) % f.length];
    }
    const i = m.state === "emerging" ? 1 : 3,
        f = seq(i);
    return f[Math.floor(clamp((clock - m.t) / moleTeaserDuration(i), 0, 0.999) * f.length)];
}

function boneMoleDraw() {
    const m = boneMole;
    if (!m || m.room !== room || m.state === "dig" || !cells.kret.length) return;
    const cell = cells.kret[boneMoleFrame() - 1];
    if (!cell) return;
    const S = MOLE_TEASER_SIZE,
        cx = m.x + roomOffset;
    ctx.save();
    if (m.state === "mound") {
        // pulsujący kopiec = „dotknij mnie” (jak motylek do złapania)
        const p = (Math.sin(clock / 260) + 1) / 2,
            k = 1 + 0.07 * p;
        ctx.shadowColor = "rgba(255,226,140,0.95)";
        ctx.shadowBlur = 8 + p * 10;
        ctx.translate(cx, BONE_MOLE.y + S / 2);
        ctx.scale(k, k);
        ctx.drawImage(cell, -S / 2, -S, S, S);
    } else ctx.drawImage(cell, cx - S / 2, BONE_MOLE.y - S / 2, S, S);
    ctx.restore();
}

function boneMoleHit(px, py) {
    const m = boneMole;
    if (!m || m.room !== room || m.state !== "mound") return false;
    return Math.hypot(px - (m.x + roomOffset), py - BONE_MOLE.y) <= MOLE_TEASER_SIZE / 2 + MOLE_TEASER_HIT_PAD;
}

function boneMoleTap() {
    const m = boneMole;
    if (!m || m.state !== "mound" || !casual()) return;
    // strona, z której piesek podchodzi: od swojej strony, chyba że brak miejsca
    // piesek staje od strony środka pokoju, przodem do ściany
    const dir = m.x > W / 2 ? 1 : -1,
        tx = m.x - dir * BONE_MOLE.reach;
    const face = dir < 0, // left = patrzy w lewo
        dig = (anim, time, extra = {}) => ({ sheet: "a03", anim, facing: face, time, ...extra });
    interrupt();
    startQueue([
        ...(Math.abs(tx - x * W) > 4 ? moveParts(room, tx / W, { label: "bonemole-run" }) : []),
        dig(0, duration("a03", 0) * 2, {
            onStart: () => {
                m.state = "dig"; // kopiec przejmuje animacja kopania
                stage = "bonemole-dig";
                changeNeeds({ paws: 10 });
                sfx("wipe");
            },
        }),
        dig(1, duration("a03", 1), { onStart: () => sfx("good") }),
        dig(4, BONE_MOLE.cardAfter, { onEnd: () => boneMoleCard() }),
        dig(4, 600000), // stoi z kostką, póki karta jest otwarta
    ]);
    phase = "bonemole";
    stage = "bonemole-run";
    locks();
}

function boneMoleCard() {
    $("#boneMolePopup .moleIntroIcon").src = icons.bone;
    $("#boneMolePopup").hidden = false;
}

function boneMoleEnd() {
    $("#boneMolePopup").hidden = true;
    boneMole = null;
    boneMoleSchedule(false);
}

$("#boneMolePopup .moleOk").onclick = () => {
    boneMoleEnd();
    idle(16);
    bonesTryStart();
};
$("#boneMolePopup .moleCancel").onclick = () => {
    boneMoleEnd();
    // odkłada kostkę i wraca do swoich spraw
    startQueue([{ sheet: "a03", anim: 5, facing: left, time: duration("a03", 5) }]);
};

// DEV: od razu kret z kostką w ogrodzie
$(".devBoneMole").onclick = () => {
    if (!casual()) return;
    if (!GARDEN_ROOMS.includes(room)) setRoom("garden");
    moleTeaser = null;
    boneMole = null;
    boneMoleSpawn();
};
