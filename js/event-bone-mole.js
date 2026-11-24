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
    edge: 0.14, // piesek najpierw odchodzi pod bliższą ścianę (ułamek szerokości)
    moundX: 0.56, // …a kopiec wychodzi bliżej środka, po drugiej stronie (ułamek szerokości od ściany pieska)
    peekMs: 1300, // jak długo kret się rozgląda
    reach: 46, // piesek stoi tak, by kopiec z animacji kopania (≈ +46 px przed nim) wypadł na kopcu kreta
    first: [5000, 17500], // po wejściu do pokoju — jak zwykły kret
    next: [7500, 22500], // po zakończeniu — jak zwykły kret po sprzątnięciu piachu
    cardAfter: 900, // ile piesek stoi z kostką, zanim pokaże się karta
};
let boneMole = null, // { x, room, state: pending|emerging|peek|retreating|mound|dig, t }
    nextBoneMole = 0,
    boneMoleRoom = null;

function boneMoleSchedule(first) {
    const [a, b] = first ? BONE_MOLE.first : BONE_MOLE.next;
    nextBoneMole = clock + a + Math.random() * (b - a);
}

// Start zdarzenia: piesek najpierw spokojnie odchodzi pod bliższą ścianę
// (stan „pending” — scena zajęta, nikt inny nie wychodzi), a kret wychyla się
// bliżej środka, po drugiej stronie — wtedy kopanie dzieje się na środku ekranu.
function boneMoleSpawn() {
    wildlifeCooldown();
    const toLeft = x < 0.5,
        ex = toLeft ? BONE_MOLE.edge : 1 - BONE_MOLE.edge,
        dist = Math.abs(ex - x) * W;
    boneMole = { x: 0, room, state: "pending", t: clock, toLeft };
    if (dist < 4) return boneMoleEmerge();
    interrupt();
    phase = "roam";
    locks();
    startQueue([{ sheet: "a01", anim: 6, motion: "walk", to: ex, time: (dist / 60) * 1000, onEnd: () => boneMoleEmerge() }]);
}
function boneMoleEmerge() {
    const m = boneMole;
    if (!m || m.state !== "pending") return;
    m.x = (m.toLeft ? BONE_MOLE.moundX : 1 - BONE_MOLE.moundX) * W;
    m.state = "emerging";
    m.t = clock;
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
    // piesek nie doszedł pod ścianę (np. dziecko go pogłaskało) — kret i tak wychodzi
    if (m.state === "pending" && el >= 8000 && casual()) {
        m.toLeft = x < 0.5;
        boneMoleEmerge();
    } else if (m.state === "emerging" && el >= moleTeaserDuration(1)) to("peek");
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
    if (!m || m.room !== room || m.state === "dig" || m.state === "pending" || !cells.kret.length) return;
    const cell = cells.kret[boneMoleFrame() - 1];
    if (!cell) return;
    const S = MOLE_TEASER_SIZE,
        cx = m.x + roomOffset;
    ctx.save();
    if (m.state === "mound") {
        // pulsujący kopiec = „dotknij mnie” — ta sama okrągła ramka co przy motylku
        const p = (Math.sin(clock / 260) + 1) / 2,
            k = 1 + 0.05 * p;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, BONE_MOLE.y + 17, 50 + p * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.08 * p})`;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * p})`;
        ctx.shadowColor = "rgba(255,190,235,0.95)";
        ctx.shadowBlur = 8 + p * 8;
        ctx.stroke();
        ctx.restore();
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
    if (sadBlocks("butterfly")) return sadRefuse(); // smutny piesek nie kopie (jak przy motylku)
    // strona, z której piesek podchodzi: od swojej strony, chyba że brak miejsca
    // piesek podchodzi od swojej strony (od ściany) i kopie przodem do kopca
    const dir = x * W <= m.x ? 1 : -1,
        tx = m.x - dir * BONE_MOLE.reach;
    const face = dir < 0, // left = patrzy w lewo
        faceCenter = tx > W / 2, // z kostką staje przodem do środka ekranu
        dig = (anim, time, extra = {}) => ({ sheet: "a03", anim, facing: face, time, ...extra });
    interrupt();
    startQueue([
        ...(Math.abs(tx - x * W) > 4 ? moveParts(room, tx / W, { label: "bonemole-run" }) : []),
        dig(0, duration("a03", 0) * 2, {
            onStart: () => {
                m.state = "dig"; // kopiec przejmuje animacja kopania
                stage = "bonemole-dig";
                changeNeeds({ paws: 5 });
                sfx("wipe");
            },
        }),
        dig(1, duration("a03", 1), { onStart: () => sfx("good") }),
        // z kostką w pysku obraca się przodem do środka ekranu — dobrze go widać
        dig(4, BONE_MOLE.cardAfter, { facing: faceCenter, onEnd: () => boneMoleCard() }),
        dig(4, 600000, { facing: faceCenter }), // stoi z kostką, póki karta jest otwarta
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
    // po kostce długo spokój od zwykłego kreta w tym pokoju (zmiana pokoju losuje od nowa)
    nextMoleSpawn = Math.max(nextMoleSpawn, clock + 60000 + Math.random() * 30000);
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
