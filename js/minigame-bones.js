"use strict";
// ═══════════════════════════════════════════════════════════════
// LICZYMY KOSTKI — dodawanie i odejmowanie w zakresie 10 (dla 6+).
// 1) Wybór: dodawanie / odejmowanie i poziom (do 5, do 10, do 10 z zakryciem).
// 2) Kostki spadają na dwa dywaniki, a piesek w tym czasie kopie dołek
//    (arkusz a03), wykopuje kostkę, chwilę stoi z nią spokojnie i ją odkłada.
// 3) Dziecko dotyka dywanik i wpisuje liczbę kostek na klawiaturze
//    (piesek się rozgląda). Dobrze → uszy/mrugnięcie, źle → „NIE”.
// 4) Po obu liczbach pojawia się działanie (np. 5 + 2 = ?) — wpisanie wyniku
//    to skok i radość. 5 działań = wygrana i nagroda (ACTION_EFFECTS.bones).
// Gra ma własne okno (.bonesFull) z łąką z mini gier. Piesek jest rysowany na
// .bonesCanvas własnym małym odtwarzaczem (klatki i tempo z presetów JSON,
// przesunięcia klatek jak w silniku), a pies z gry czeka pod spodem.
// ═══════════════════════════════════════════════════════════════

const BONES_LEVELS = [
        { name: "Łatwy", info: "liczby do 5", max: 5, hide: false },
        { name: "Średni", info: "liczby do 10", max: 10, hide: false },
        { name: "Trudny", info: "do 10, kostki znikają po 3 s", max: 10, hide: true },
    ],
    BONES_ROUNDS = 5,
    BONES_DOG = { x: 192, y: 332, scale: 1.25 }, // stopy pieska na trawie, tuż nad dywanikami
    BONES_FOREVER = 600000,
    // animacje (indeksy presetów z animacje-ustawienia/*.json)
    BONES_ANIM = {
        dig: ["a03", 0], // 01. Kopanie dołka
        unearth: ["a03", 1], // 02. Wykopuje kostkę
        calmBone: ["a03", 4], // 05. Stoi z kostką, przechyla głowę (spokojnie, nie rozprasza)
        putDown: ["a03", 5], // 06. Odkłada kostkę
        calm: ["a01", 16], // 17. Spokojne stanie (bez kostki)
        look: ["a01", 3], // 04. Rozglądanie się (w czasie wpisywania)
        ears: ["a01", 7], // 08. Uszy / mrugnięcie (dobra liczba)
        no: ["a02", 19], // 20. „NIE” — próba z powrotem (pomyłka)
        run: ["a01", 1], // 02. Bieg / sus (radość po dobrym wyniku)
        roll: ["a01", 4], // 05. Turlanie A — fikołek z radości po dobrym wyniku
    };

let bonesGame = null,
    bonesOp = "+",
    bonesLevel = 0;

// ── Animacje pieska (własny odtwarzacz na .bonesCanvas) ─────────────
// Kolejka części: { sheet, anim, time }. Ostatnia część kręci się bez końca.
// Część może też przesuwać pieska: { to: x w px } (liniowo przez cały czas
// części) i obracać go: { face: 1 w prawo / -1 w lewo }.
let bonesQueue = [],
    bonesCur = null,
    bonesRaf = 0,
    bonesX = BONES_DOG.x,
    bonesFace = 1;
function bonesPart(key, opts = {}) {
    const [sheet, anim] = BONES_ANIM[key];
    return { sheet, anim, time: opts.times ? duration(sheet, anim) * opts.times : opts.time ?? BONES_FOREVER, to: opts.to, face: opts.face };
}
// bieg z miejsca na miejsce (zwrot w stronę celu)
function bonesRunTo(tx, key = "run", speed = 200) {
    return bonesPart(key, { time: Math.max(200, (Math.abs(tx - bonesX) / speed) * 1000), to: tx });
}
function bonesAnim(...parts) {
    bonesQueue = parts;
    bonesNext();
}
function bonesNext() {
    let p = bonesQueue.shift();
    if (p && p.wait) p = bonesWait(); // „czekanie” wybierane dopiero teraz (klawiatura otwarta czy nie)
    bonesCur = p || bonesCur;
    if (!bonesCur) return;
    bonesCur.t0 = performance.now();
    bonesCur.from = bonesX;
    if (bonesCur.face) bonesFace = bonesCur.face;
    else if (bonesCur.to !== undefined && Math.abs(bonesCur.to - bonesX) > 1) bonesFace = bonesCur.to > bonesX ? 1 : -1;
}
function bonesDraw(now) {
    bonesRaf = 0;
    if (!bonesGame || $(".bonesPlay").hidden) return;
    const cv = $(".bonesCanvas"),
        c = cv.getContext("2d");
    c.clearRect(0, 0, cv.width, cv.height);
    const p = bonesCur;
    if (p) {
        if (bonesQueue.length && now - p.t0 >= p.time) bonesNext();
        const q = bonesCur;
        if (q.to !== undefined) bonesX = q.from + (q.to - q.from) * Math.min(1, (now - q.t0) / q.time);
        const pre = getPreset(q.sheet, q.anim),
            fr = numbers(pre.seq),
            f = fr[Math.floor((now - q.t0) / pre.ms) % fr.length],
            cell = cells[q.sheet][f - 1],
            o = { x: 0, y: 0, scale: 100, ...CFG[q.sheet].offsets[String(f)] },
            s = (BONES_DOG.scale * o.scale) / 100;
        if (cell) {
            c.save();
            c.imageSmoothingEnabled = false;
            // przesunięcia klatek w jednostkach silnika (BASE·0.7 = skala psa w grze)
            c.translate(bonesX + (bonesFace * o.x * BONES_DOG.scale) / 0.7, BONES_DOG.y + (o.y * BONES_DOG.scale) / 0.7);
            c.scale(s * bonesFace, s);
            c.drawImage(cell, -cell.width / 2, -CFG[q.sheet].ground);
            c.restore();
        }
    }
    bonesRaf = requestAnimationFrame(bonesDraw);
}
// pętla „czekania” zależna od chwili gry: przy otwartej klawiaturze piesek
// się rozgląda, a poza nią bawi się kostką
const bonesWait = () => bonesPart(bonesGame && !$(".bonesPad").hidden ? "look" : "calm");
// wykopanie kostki: kopie (raz), wyciąga kostkę, stoi z nią w pysku (2 razy
// animacja) i ją odkłada — albo wcześniej, gdy dziecko dotknie pierwszego „?”
// (wtedy bonesReact najpierw ją odkłada/zakopuje)
const bonesDigParts = () => [bonesPart("dig", { times: 1 }), bonesPart("unearth", { times: 1 }), bonesPart("calmBone", { times: 2 }), bonesPart("putDown", { times: 1 }), { wait: true }];
// reakcja pieska; jeśli trzyma kostkę w pysku, najpierw ją odkłada
// (kostka nie znika z pyska nagle)
function bonesReact(...parts) {
    const c = bonesCur,
        holds = c && c.sheet === "a03" && (c.anim === 1 || c.anim === 4);
    bonesAnim(...(holds ? [bonesPart("putDown", { times: 1 })] : []), ...parts);
}

// ── Wejście i ekran wyboru ────────────────────────────────────────
function bonesTryStart() {
    if (sadBlocks("games")) return sadRefuse(); // smutny piesek nie chce się bawić
    if (!gameEntryOk()) return;
    bonesGame = {};
    bonesBuildMenu();
    $(".bonesFull").hidden = false;
    $(".bonesMenu").hidden = false;
    $(".bonesPlay").hidden = true;
    startQueue([
        {
            sheet: "a01",
            anim: 16,
            time: 1800000,
            onStart: () => {
                phase = "bones-menu";
                stage = "bones-menu";
                locks();
            },
        },
    ]);
}

function bonesBuildMenu() {
    const box = $(".bonesLevels");
    box.innerHTML = "";
    BONES_LEVELS.forEach((l, i) => {
        const b = document.createElement("button");
        b.className = "bonesLvl";
        b.setAttribute("aria-pressed", i === bonesLevel);
        b.innerHTML = "<span>" + l.name + "<small>" + l.info + '</small></span><span class="dots">' + [0, 1, 2].map((j) => '<i class="' + (j <= i ? "on" : "") + '"></i>').join("") + "</span>";
        b.onclick = () => {
            bonesLevel = i;
            box.querySelectorAll(".bonesLvl").forEach((c, j) => c.setAttribute("aria-pressed", j === i));
        };
        box.appendChild(b);
    });
    document.querySelectorAll(".bonesOp").forEach((b) => b.setAttribute("aria-pressed", b.dataset.op === bonesOp));
}
document.querySelectorAll(".bonesOp").forEach(
    (b) =>
        (b.onclick = () => {
            bonesOp = b.dataset.op;
            document.querySelectorAll(".bonesOp").forEach((c) => c.setAttribute("aria-pressed", c === b));
        })
);
$(".bonesStart").onclick = () => bonesBegin();
$(".bonesMenuClose").onclick = () => bonesFinish(false);
$(".bonesPlayClose").onclick = () => bonesFinish(false);

function bonesBegin() {
    const g = bonesGame || (bonesGame = {});
    g.round = 0;
    $(".bonesMenu").hidden = true;
    $(".bonesPlay").hidden = false;
    bonesX = BONES_DOG.x;
    bonesFace = 1;
    // pies z gry czeka pod nakładką, bez własnych pomysłów
    startQueue([{ sheet: "a01", anim: 16, time: 1800000 }]);
    phase = "bones-game";
    stage = "bones-game";
    locks();
    if (!bonesRaf) bonesRaf = requestAnimationFrame(bonesDraw);
    bonesRound();
}

// ── Runda ─────────────────────────────────────────────────────────
const bonesRnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    bonesSign = () => (bonesOp === "+" ? "+" : "−"),
    bonesResult = () => (bonesOp === "+" ? bonesGame.A + bonesGame.B : bonesGame.A - bonesGame.B);

function bonesStarsDraw() {
    $(".bonesStars").innerHTML = Array.from({ length: BONES_ROUNDS }, (_, i) => '<i class="' + (i < bonesGame.round ? "on" : "") + '" style="background-image:url(' + icons.star + ')"></i>').join("");
}

function bonesRound() {
    const g = bonesGame,
        lv = BONES_LEVELS[bonesLevel],
        m = lv.max;
    if (bonesOp === "+") {
        g.A = bonesRnd(1, m - 1);
        g.B = bonesRnd(1, m - g.A);
    } else {
        g.A = bonesRnd(2, m);
        g.B = bonesRnd(1, g.A - 1);
    }
    g.okA = g.okB = false;
    g.ready = false;
    clearTimeout(g.coverT);
    clearTimeout(g.readyT);
    clearTimeout(g.dropT);
    $(".bonesTtl").textContent = bonesOp === "+" ? "Dodawanie" : "Odejmowanie";
    bonesStarsDraw();
    $(".bonesEq").innerHTML = "";
    $(".bonesEq").className = "bonesEq";
    $(".bonesNext").hidden = true;
    $(".bonesPad").hidden = true;
    $(".bonesHint").textContent = "Piesek kopie… co wykopie?";
    for (const [sel, n] of [
        [".bonesPile.a", g.A],
        [".bonesPile.b", g.B],
    ]) {
        const p = $(sel);
        p.classList.remove("cover");
        const q = p.querySelector(".bonesQ");
        q.className = "bonesQ";
        q.textContent = "?";
        q.style.visibility = "hidden";
        p.querySelectorAll(".bonesBone").forEach((b) => b.remove());
    }
    // najpierw piesek wykopuje kostkę, dopiero wtedy kostki spadają na dywaniki;
    // „?” dają się kliknąć, gdy spadnie ostatnia kostka
    const back = Math.abs(bonesX - BONES_DOG.x) > 4 ? [bonesRunTo(BONES_DOG.x)] : [],
        dug = (back.length ? back[0].time : 0) + duration("a03", 0) + duration("a03", 1),
        fall = Math.max(g.A, g.B) * 120 + 700;
    bonesAnim(...back, bonesPart("dig", { time: 0, face: 1 }), ...bonesDigParts());
    clearTimeout(g.dropT);
    g.dropT = setTimeout(() => {
        if (bonesGame !== g) return;
        bonesDropBones($(".bonesPile.a"), g.A);
        bonesDropBones($(".bonesPile.b"), g.B);
        $(".bonesHint").textContent = "Patrz, ile kostek spada!";
        sfx("throw");
    }, dug);
    g.readyT = setTimeout(() => {
        if (bonesGame !== g) return;
        g.ready = true;
        document.querySelectorAll(".bonesQ").forEach((q) => (q.style.visibility = "visible"));
        $(".bonesHint").textContent = lv.hide ? "Policz szybko — zaraz przykryje je piasek!" : "Dotknij dywanik i wpisz, ile jest kostek.";
        if (lv.hide)
            g.coverT = setTimeout(() => {
                if (bonesGame !== g) return;
                document.querySelectorAll(".bonesPile").forEach((p) => p.classList.add("cover"));
                $(".bonesHint").textContent = "Pamiętasz? Dotknij dywanik i wpisz.";
            }, 3000);
    }, dug + fall + 150);
}

function bonesDropBones(pile, n) {
    pile.querySelectorAll(".bonesBone").forEach((b) => b.remove());
    const W2 = 70,
        H2 = 44; // środek dywanika
    for (let i = 0; i < n; i++) {
        const b = document.createElement("i"),
            rr = Math.sqrt((i + 0.6) / 10) * 0.82,
            th = i * 2.399 + (n % 3);
        b.className = "bonesBone";
        b.style.backgroundImage = "url(" + icons.bone + ")";
        b.style.left = W2 + rr * Math.cos(th) * 50 - 14 + "px";
        b.style.top = H2 + rr * Math.sin(th) * 25 - 14 + "px";
        b.style.setProperty("--r", bonesRnd(-70, 70) + "deg");
        b.style.animationDelay = i * 0.12 + "s";
        pile.appendChild(b);
    }
}

function bonesPileTap(which) {
    const g = bonesGame;
    if (!g || !g.ready || !$(".bonesPad").hidden) return;
    if ((which === "a" && g.okA) || (which === "b" && g.okB)) return;
    const n = which === "a" ? g.A : g.B;
    const mark = $(".bonesPile." + which + " .bonesQ");
    $(".bonesHint").textContent = which === "a" ? "Ile kostek na lewym dywaniku?" : "Ile kostek na prawym dywaniku?";
    bonesPadOpen(n, () => {
        const q = $(".bonesPile." + which + " .bonesQ");
        q.textContent = n;
        q.className = "bonesQ ok";
        if (which === "a") g.okA = true;
        else g.okB = true;
        // po dobrej liczbie kostki wracają (trudny poziom), żeby było widać działanie
        document.querySelectorAll(".bonesPile").forEach((p) => p.classList.remove("cover"));
        sfx("good");
        if (g.okA && g.okB) bonesShowEq();
        else $(".bonesHint").textContent = "Super! Teraz drugi dywanik.";
        bonesReact(bonesPart("ears", { times: 1 }), { wait: true });
    }, mark);
}
$(".bonesPile.a").onclick = () => bonesPileTap("a");
$(".bonesPile.b").onclick = () => bonesPileTap("b");

function bonesShowEq() {
    const g = bonesGame,
        el = $(".bonesEq");
    clearTimeout(g.coverT);
    $(".bonesHint").textContent = "Ile to razem? Dotknij kratkę.";
    if (bonesOp === "-") $(".bonesHint").textContent = "Ile zostanie? Dotknij kratkę.";
    el.className = "bonesEq in";
    el.innerHTML = '<span class="n">' + g.A + "</span><span>" + bonesSign() + '</span><span class="n">' + g.B + '</span><span>=</span><button class="bonesRes" aria-label="Wpisz wynik">?</button>';
    el.querySelector(".bonesRes").onclick = () => {
        if (!$(".bonesPad").hidden || el.querySelector(".bonesRes.ok")) return;
        bonesPadOpen(bonesResult(), () => {
            const r = el.querySelector(".bonesRes");
            r.textContent = bonesResult();
            r.classList.add("ok");
            g.round++;
            bonesStarsDraw();
            sfx("win"); // fanfary po każdym dobrym wyniku
            $(".bonesHint").textContent = ["Dobrze!", "Super!", "Brawo!", "Świetnie!"][bonesRnd(0, 3)];
            // radość: sam fikołek w miejscu (bez podskoku i „Radości z powrotem”)
            bonesReact(bonesPart("roll", { times: 1 }), { wait: true });
            if (g.round >= BONES_ROUNDS) g.readyT = setTimeout(() => bonesGame === g && bonesWin(), 1600);
            else $(".bonesNext").hidden = false;
        }, el.querySelector(".bonesRes"));
    };
}
$(".bonesNext").onclick = () => bonesGame && bonesRound();

// ── Klawiatura ────────────────────────────────────────────────────
let bonesBuf = "",
    bonesTarget = 0,
    bonesOnOk = null;
(() => {
    const keys = $(".bonesKeys");
    for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]) {
        const b = document.createElement("button");
        b.className = "bonesKey" + (k === "OK" ? " ok" : k === "⌫" ? " del" : "");
        b.textContent = k;
        b.setAttribute("aria-label", k === "⌫" ? "Usuń" : k === "OK" ? "Zatwierdź" : k);
        b.onclick = () => bonesPress(k);
        keys.appendChild(b);
    }
})();

// zaznaczenie, czego dotyczy wpisywanie: większy, mrugający „?”
function bonesMark(el) {
    document.querySelectorAll(".bonesQ.active, .bonesRes.active").forEach((e) => e.classList.remove("active"));
    if (el) el.classList.add("active");
}
// Liczba wpisuje się prosto w zaznaczone pole: „?” nad dywanikiem albo
// kratkę wyniku w działaniu (bez osobnego okienka nad klawiaturą).
let bonesField = null;
function bonesPadOpen(target, onOk, field) {
    bonesMark(field);
    bonesField = field;
    bonesBuf = "";
    bonesTarget = target;
    bonesOnOk = onOk;
    $(".bonesPad").hidden = false;
    bonesReact(bonesPart("look"));
}

function bonesPress(k) {
    const d = bonesField;
    if (!d) return;
    if (k === "⌫") bonesBuf = bonesBuf.slice(0, -1);
    else if (k === "OK") {
        if (bonesBuf === "") return;
        if (+bonesBuf === bonesTarget) {
            $(".bonesPad").hidden = true;
            bonesMark(null);
            bonesField = null;
            const cb = bonesOnOk;
            bonesOnOk = null;
            bonesBuf = "";
            cb && cb();
        } else {
            // pomyłka: czerwona ramka, „NIE” i jeszcze raz (bez kar)
            d.classList.remove("bad");
            void d.offsetWidth;
            d.classList.add("bad");
            sfx("miss");
            bonesBuf = "";
            bonesReact(bonesPart("no", { times: 2 }), { wait: true });
            setTimeout(() => {
                d.classList.remove("bad");
                if (!bonesBuf) d.textContent = "?";
            }, 600);
        }
        return;
    } else if (bonesBuf.length < 2) bonesBuf += k;
    d.textContent = bonesBuf || "?";
}

// ── Koniec ────────────────────────────────────────────────────────
function bonesWin() {
    const lv = BONES_LEVELS[bonesLevel];
    $("#bonesWinPopup .bonesWinTxt").textContent = BONES_ROUNDS + " działań, " + (bonesOp === "+" ? "dodawanie" : "odejmowanie") + ", poziom " + lv.name.toLowerCase() + ".";
    $("#bonesWinPopup .memoWinImg").src = icons.cup;
    moleWinSpawnConfetti("#bonesWinPopup .moleWinConfetti");
    $("#bonesWinPopup").hidden = false;
    if (!bonesGame.rewarded) {
        bonesGame.rewarded = true;
        changeNeeds(ACTION_EFFECTS.bones);
        save();
    }
    sfx("win");
    bonesAnim({ sheet: "a01", anim: 17, time: BONES_FOREVER });
}
$("#bonesWinPopup .winAgain").onclick = () => {
    $("#bonesWinPopup").hidden = true;
    if (bonesGame) bonesGame.rewarded = false;
    bonesBegin();
};
$("#bonesWinPopup .bonesToMenu").onclick = () => {
    $("#bonesWinPopup").hidden = true;
    $(".bonesPlay").hidden = true;
    $(".bonesMenu").hidden = false;
    if (bonesGame) bonesGame.rewarded = false;
    bonesBuildMenu();
};
$("#bonesWinPopup .bonesExit").onclick = () => {
    $("#bonesWinPopup").hidden = true;
    bonesFinish(true);
};

function bonesFinish() {
    const g = bonesGame;
    if (g) {
        clearTimeout(g.coverT);
        clearTimeout(g.readyT);
        clearTimeout(g.dropT);
    }
    bonesGame = null;
    $(".bonesFull").hidden = true;
    $(".bonesPad").hidden = true;
    $("#bonesWinPopup").hidden = true;
    cancelAnimationFrame(bonesRaf);
    bonesRaf = 0;
    bonesCur = null;
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    idle(16);
}
