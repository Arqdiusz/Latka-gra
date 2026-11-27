"use strict";
// Czyszczenie łapek szmatką w łazience.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// ── Czyszczenie łapek szmatką (łazienka) ──────────────────────────
// Wybór „Łapki” w menu kołowym → piesek idzie do łazienki, staje w miejscu, a
// dziecko przeciąga palcem po jego łapkach. Brud jest podzielony na pasy wzdłuż
// łap (pawLvl) — szmatka zciera te pasy, nad którymi przesuwasz palec, całymi
// grupami grudek (nie piksel po pikselu). Gdy znika ostatnia grudka: fanfary.
let pawsPtr = null, // poprzedni punkt przeciągania (do liczenia drogi)
    pawsCloth = null, // gdzie jest palec
    pawsClothVis = null, // wygładzona pozycja rysowanej szmatki
    pawLvl = null, // poziom brudu (0–1) każdego pasa podczas czyszczenia
    pawsRate = 0, // ile brudu schodzi na piksel drogi szmatki (ustalane na starcie)
    pawsDone = new Set(); // które łapki są już czyste (każda dostaje iskierki)
// Pasek postępu czyszczenia łapek (jak przy kąpieli): ile grudek już wytarte.
let pawsTotal = 0, // ile grudek było na starcie
    pawsProg = 0; // 0–1, tylko rośnie
function pawsBadgeSet(p) {
    pawsProg = clamp(p, 0, 1);
    const i = $(".pawsBadge .bar i");
    if (i) i.style.width = pawsProg * 100 + "%";
}
function updatePawsUi() {
    const e = $(".pawsEnd"),
        bd = $(".pawsBadge");
    if (bd && !bd.hidden !== (phase === "paws-clean")) {
        bd.hidden = phase !== "paws-clean";
        if (!bd.hidden) bd.querySelector("img").src = icons.paw;
    }
    if (e) e.hidden = phase !== "paws-clean";
    if (phase !== "paws-clean") pawsZoom(false);
}
// Kamera na łapki: cała scena (tło + piesek) przybliżona tak, żeby łapki były na
// środku. Dotyk dalej trafia, bo pointerXY liczy z przybliżonego prostokąta canvasu.
const PAWS_ZOOM = 1.25;
let pawsZoomed = false;
function pawsZoom(on) {
    if (on === pawsZoomed) return;
    pawsZoomed = on;
    const el = $(".sceneZoom");
    const world = $(".world");
    if (!on) return (el.style.transform = world.style.transform = "");
    const pts = pawScreenPoints();
    if (!pts.length) return (pawsZoomed = false);
    const hd = headPosition(),
        cx = (pts.reduce((a, p) => a + p.x, 0) / pts.length + hd.x) / 2, // łapki + głowa: cały piesek w kadrze
        cy = pts.reduce((a, p) => a + p.y, 0) / pts.length + 5,
        Z = PAWS_ZOOM,
        tx = clamp((0.5 - (cx / W) * Z) * 100, (1 - Z) * 100, 0),
        ty = clamp((0.58 - (cy / SH) * Z) * 100, (1 - Z) * 100, 0);
    el.style.transform = `translate(${tx}%, ${ty}%) scale(${Z})`;
    // tło sięga dalej niż scena (o 106 px w górę): ten sam ruch kamery we współrzędnych całego okna
    world.style.transform = `translate(${(tx * 384) / 100}px, ${(ty * 550) / 100 + 106 * (1 - Z)}px) scale(${Z})`;
}
function pawsStart() {
    if (room !== "bathroom" || pawDirt < 3) return idle(16);
    bubble = null;
    pawsPtr = pawsCloth = pawsClothVis = null;
    pawLvl = new Array(16).fill(pawDirt / 100);
    pawsRate = PAWS_WIPE_RATE * (pawDirt / 100); // im brudniej, tym szybciej schodzi — czas zawsze ten sam
    pawsDone = new Set();
    pawsTotal = pawDirtBlobs("a01", PAWS_LIE[0]).filter((bl) => bl.thr < pawLvl[bl.bucket]).length;
    pawsBadgeSet(0);
    startQueue(pawsLie());
}
// Czyszczenie trwa zawsze tyle samo: każdy pas łapek schodzi po ~800 px drogi szmatki.
const PAWS_WIPE_RATE = 1 / 800;
// Piesek leży na grzbiecie, łapki do góry („11. Na grzbiecie”, a01): spokojnie
// (39), co jakiś czas lekko się wierci (40). giggle = najpierw krótkie, gęste
// wiercenie (39↔40 szybko) — gdy któraś łapka zrobi się czysta.
const PAWS_LIE = [39, 39, 39, 39, 39, 39, 40, 39, 40, 39, 39, 39, 39, 39, 39, 39];
function pawsLie(giggle = false) {
    const lie = {
        sheet: "a01",
        frames: PAWS_LIE,
        tempo: 260,
        time: 1800000,
        onStart: () => {
            phase = "paws-clean";
            stage = "paws-clean";
            locks();
            setTimeout(() => pawsZoom(true), 0); // po ustawieniu klatek (punkty łap leżącego pieska)
        },
        onEnd: () => phase === "paws-clean" && pawsEnd(false),
    };
    return giggle ? [{ sheet: "a01", frames: [39, 40, 39, 40], tempo: 130, time: 520 }, lie] : [lie];
}
function pawsEnd(done) {
    if (phase !== "paws-clean") return;
    pawsPtr = pawsCloth = pawsClothVis = null;
    if (done) {
        pawsBadgeSet(1);
        pawLvl = null;
        pawDirt = 0;
        changeNeeds(ACTION_EFFECTS.paws);
        save();
        // Brawo, czysty piesek: wstaje i spokojnie merda ogonem, wokół mignie kilka
        // iskierek; po chwili fanfary, konfetti i karta z pieskiem
        say("heart", 2600);
        startQueue([{ sheet: "a01", frames: WAG, tempo: WAG_TEMPO, time: 600000 }]);
        bodyTwinkleT = clock + 150;
        phase = "paws-end";
        stage = "paws-end";
        setTimeout(() => {
            if (phase !== "paws-end") return;
            moleWinSpawnConfetti("#pawsWinPopup .moleWinConfetti"); // fanfary
            $("#pawsWinPopup").hidden = false;
            pawsWinDogStart();
        }, 900);
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
    pawsWinDogStop();
    idle(16);
};
// Piesek na karcie końcowej: stoi i merda ogonem (a01, stopami w jednym miejscu);
// na początku kilka mignięć iskierek wokół całego ciała, potem spokój.
let pawsWinDogT = 0;
function pawsWinDogStop() {
    clearInterval(pawsWinDogT);
}
function pawsWinDogStart() {
    const cv = $("#pawsWinPopup .pawsWinDog"),
        c = cv.getContext("2d"),
        seq = WAG,
        t0 = performance.now(),
        tw0 = clock + 200,
        K = 1.5;
    const draw = () => {
        const t = performance.now() - t0,
            f = seq[Math.floor(t / WAG_TEMPO) % seq.length],
            cell = cells.a01[f - 1],
            b = P.meta.a01[seq[0] - 1].box, // jedna ramka dla wszystkich klatek — piesek nie skacze na boki
            ox = 130 - ((b[0] + b[2]) / 2) * K,
            oy = 190 - b[3] * K;
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        if (cell) c.drawImage(cell, ox, oy, cell.width * K, cell.height * K);
        twinkleDraw(c, 130, 190 - ((b[3] - b[1]) * K) / 2, ((b[2] - b[0]) * K) / 2 + 14, ((b[3] - b[1]) * K) / 2 + 10, tw0, 1.1);
    };
    clearInterval(pawsWinDogT);
    draw();
    pawsWinDogT = setInterval(draw, 70);
}
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
    if (Math.abs(p.x - x * W) > 150 || p.y < GROUND - 140 || p.y > GROUND + 60) return;
    const d = Math.min(25, Math.hypot(p.x - prev.x, p.y - prev.y)), // pojedynczy skok nie zaciera od razu wszystkiego
        cx = pawsCellX(p.x);
    let touched = false;
    pawLvl.forEach((v, b) => {
        if (v <= 0 || Math.abs((b + 0.5) * PAW_BUCKET - cx) > 12) return;
        touched = true;
        pawLvl[b] = Math.max(0, v - d * pawsRate);
        if (pawLvl[b] <= pawsRate * 12) {
            pawLvl[b] = 0;
            sfx("good"); // „plink” za każdy wytarty fragment
        }
    });
    if (touched) {
        sfx("wipe");
        clothRubT = clock;
        // subtelne iskierki przy szmatce: widać, że szorujemy
        if (clock - scrubSparkT > 200) {
            scrubSparkT = clock;
            sparkleBurst(p.x + (Math.random() * 36 - 18), p.y + (Math.random() * 24 - 14), [[0, 0, 0, Math.random() < 0.5 ? "D" : "A", 0.75 + Math.random() * 0.3]]);
        }
    }
    // każda wyczyszczona łapka dostaje iskierki (pierwsza, druga, …)
    const f = geometry().f,
        blobs = pawDirtBlobs(sheet, f),
        pts = pawScreenPoints();
    pts.forEach((pt, k) => {
        if (pawsDone.has(k)) return;
        const mine = blobs.filter((bl) => bl.paw === k);
        if (!mine.length || mine.some((bl) => bl.thr < (pawLvl[bl.bucket] ?? 0))) return;
        pawsDone.add(k);
        clothWringT = clock; // szmatka lekko podskakuje
        if (pawsDone.size < pts.length) startQueue(pawsLie(true)); // piesek chichocze (nie po ostatniej — wtedy wstaje)
        sparkleBurst(pt.x, pt.y, SPARKLE_BIG, 0, true); // duży błysk: łapka czysta!
        sfx("good");
    });
    if (pawsTotal) pawsBadgeSet(Math.max(pawsProg, 1 - blobs.filter((bl) => bl.thr < (pawLvl[bl.bucket] ?? 0)).length / pawsTotal));
    // koniec, gdy na bieżącej klatce nie widać już żadnej grudki
    if (!blobs.some((bl) => bl.thr < (pawLvl[bl.bucket] ?? 0))) pawsEnd(true);
}
// Szmatka: jedna klatka z arkusza assets/sprites/szmatka.webp (9 — 4×4 po 64 px), bez
// przeskakiwania klatek. Przy tarciu tylko delikatnie kołysze się o kilka
// stopni w lewo i w prawo (płynnie narasta i gaśnie); gdy łapka zrobi się
// czysta — małe, miękkie „podskoczenie” (lekkie powiększenie).
let scrubSparkT = 0,
    clothRubT = -1e9,
    clothWringT = -1e9,
    clothSwing = 0; // 0..1 — siła kołysania (płynnie)
const CLOTH_SIZE = 90, // w pikselach sceny (scena jest przybliżona ×1,25)
    CLOTH_FRAME = 9,
    CLOTH_SWING_DEG = 7;
function clothFrame() {
    return CLOTH_FRAME;
}
function pawsClothDraw() {
    const im = images.cloth;
    if (!im) return;
    // zanim dziecko dotknie: szmatka leży spokojnie na podłodze pod pieskiem
    // i pulsuje wokół niej ramka (jak przy piłce); potem idzie za palcem
    const hint = !pawsCloth,
        tx = pawsCloth ? pawsCloth.x : x * W,
        ty = pawsCloth ? pawsCloth.y : GROUND + 14;
    // wygładzanie: szmatka płynnie dogania palec (bez szarpania)
    pawsClothVis = pawsClothVis && !hint ? { x: pawsClothVis.x + (tx - pawsClothVis.x) * 0.4, y: pawsClothVis.y + (ty - pawsClothVis.y) * 0.4 } : { x: tx, y: ty };
    ctx.save();
    ctx.translate(pawsClothVis.x, pawsClothVis.y);
    ctx.imageSmoothingEnabled = false;
    const i = clothFrame() - 1,
        rubbing = clock - clothRubT < 250;
    clothSwing += ((rubbing ? 1 : 0) - clothSwing) * 0.12;
    const pop = clamp(1 - (clock - clothWringT) / 300, 0, 1); // 1 → 0 przez 0,3 s
    ctx.save();
    ctx.rotate(((Math.sin(clock / 160) * CLOTH_SWING_DEG * clothSwing) * Math.PI) / 180);
    ctx.scale(1 + 0.08 * Math.sin(pop * Math.PI), 1 + 0.08 * Math.sin(pop * Math.PI));
    ctx.drawImage(im, (i % 4) * 64, Math.floor(i / 4) * 64, 64, 64, -CLOTH_SIZE / 2, -CLOTH_SIZE / 2, CLOTH_SIZE, CLOTH_SIZE);
    ctx.restore();
    if (hint) {
        const pulse = 0.5 + 0.5 * Math.sin(clock / 220);
        ctx.strokeStyle = `rgba(255,255,255,${0.4 + pulse * 0.55})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(255,255,255,0.7)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, CLOTH_SIZE * 0.42 + 4 + pulse * 8, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
$(".pawsEnd").onclick = () => pawsEnd(false);
