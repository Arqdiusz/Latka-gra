"use strict";
// ═══════════════════════════════════════════════════════════════
// LICZYMY KOSTKI — dodawanie i odejmowanie w zakresie 10 (dla 6+).
// 1) Wybór: dodawanie / odejmowanie i poziom (do 5, do 10, do 10 z zakryciem).
// 2) Kostki spadają na dwa dywaniki, a piesek w tym czasie kopie dołek
//    (arkusz a03), wykopuje kostkę i się nią bawi.
// 3) Dziecko dotyka dywanik i wpisuje liczbę kostek na klawiaturze
//    (piesek się rozgląda). Dobrze → uszy/mrugnięcie, źle → „NIE”.
// 4) Po obu liczbach pojawia się działanie (np. 5 + 2 = ?) — wpisanie wyniku
//    to skok i radość. 5 działań = wygrana i nagroda (ACTION_EFFECTS.bones).
// Piesek to zwykły pies silnika (łąka w tle), podniesiony nad dywaniki przez
// dogLift. Nakładka (.bonesFull) zasłania tylko górny pasek i dół ekranu.
// ═══════════════════════════════════════════════════════════════

const BONES_LEVELS = [
        { name: "Łatwy", info: "liczby do 5", max: 5, hide: false },
        { name: "Średni", info: "liczby do 10", max: 10, hide: false },
        { name: "Trudny", info: "do 10, kostki znikają po 3 s", max: 10, hide: true },
    ],
    BONES_ROUNDS = 5,
    BONES_LIFT = -209, // stopy pieska tuż nad dywanikami
    BONES_FOREVER = 600000,
    // animacje (indeksy presetów z animacje-ustawienia/*.json)
    BONES_ANIM = {
        dig: ["a03", 0], // 01. Kopanie dołka
        unearth: ["a03", 1], // 02. Wykopuje kostkę
        play: ["a03", 2], // 03. Zabawa kostką
        look: ["a01", 3], // 04. Rozglądanie się (w czasie wpisywania)
        ears: ["a01", 7], // 08. Uszy / mrugnięcie (dobra liczba)
        joyBack: ["a01", 21], // Radość z powrotem
        jump: ["a01", 0], // 01. Skok / podskok (dobry wynik)
        no: ["a02", 19], // 20. „NIE” — próba z powrotem (pomyłka)
    };

let bonesGame = null,
    bonesOp = "+",
    bonesLevel = 0;

// ── Animacje pieska ───────────────────────────────────────────────
function bonesPart(key, opts = {}) {
    const [sheet, anim] = BONES_ANIM[key];
    return { sheet, anim, facing: false, time: opts.times ? duration(sheet, anim) * opts.times : opts.time || BONES_FOREVER, onStart: opts.onStart };
}
function bonesAnim(...parts) {
    startQueue(parts);
    phase = "bones-game";
    stage = "bones-game";
    locks();
}
// pętla „czekania” zależna od chwili gry: przy otwartej klawiaturze piesek
// się rozgląda, a poza nią bawi się kostką
const bonesWait = () => bonesPart(bonesGame && !$(".bonesPad").hidden ? "look" : "play");

// ── Wejście i ekran wyboru ────────────────────────────────────────
function bonesTryStart() {
    if (sadBlocks("games")) return sadRefuse(); // smutny piesek nie chce się bawić
    if (!gameEntryOk()) return;
    bonesGame = { prevRoom: room };
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
    const g = bonesGame || (bonesGame = { prevRoom: room });
    g.round = 0;
    $(".bonesMenu").hidden = true;
    $(".bonesPlay").hidden = false;
    document.body.classList.add("bonesOn");
    if (room !== "meadow") setRoom("meadow");
    x = 0.5;
    left = false;
    dogLift = BONES_LIFT;
    $(".bonesPadTitle img").src = icons.bark;
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
    $(".bonesTtl").textContent = bonesOp === "+" ? "Dodawanie" : "Odejmowanie";
    bonesStarsDraw();
    $(".bonesEq").innerHTML = "";
    $(".bonesEq").className = "bonesEq";
    $(".bonesNext").hidden = true;
    $(".bonesPad").hidden = true;
    $(".bonesHint").textContent = "Piesek kopie… patrz, ile kostek spada!";
    for (const [sel, n] of [
        [".bonesPile.a", g.A],
        [".bonesPile.b", g.B],
    ]) {
        const p = $(sel);
        p.classList.remove("cover");
        p.style.opacity = 1;
        const q = p.querySelector(".bonesQ");
        q.className = "bonesQ";
        q.textContent = "?";
        q.style.visibility = "hidden";
        bonesDropBones(p, n);
    }
    // kopanie trwa, aż spadnie ostatnia kostka, potem wykopanie i zabawa kostką
    const fall = Math.max(g.A, g.B) * 120 + 700;
    bonesAnim(bonesPart("dig", { time: Math.max(fall, duration("a03", 0)) }), bonesPart("unearth", { times: 1 }), bonesPart("play"));
    sfx("throw");
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
    }, fall + 150);
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
    bonesPadOpen(which === "a" ? "Ile kostek na lewym dywaniku?" : "Ile kostek na prawym dywaniku?", n, () => {
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
        bonesAnim(bonesPart("ears", { times: 1 }), bonesWait());
    });
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
    // przy odejmowaniu kostki z prawego dywanika „odchodzą”
    if (bonesOp === "-") $(".bonesPile.b").style.opacity = 0.45;
    el.querySelector(".bonesRes").onclick = () => {
        if (!$(".bonesPad").hidden || el.querySelector(".bonesRes.ok")) return;
        bonesPadOpen(g.A + " " + bonesSign() + " " + g.B + " = ?", bonesResult(), () => {
            const r = el.querySelector(".bonesRes");
            r.textContent = bonesResult();
            r.classList.add("ok");
            g.round++;
            bonesStarsDraw();
            sfx("pair");
            $(".bonesHint").textContent = ["Dobrze!", "Super!", "Brawo!", "Świetnie!"][bonesRnd(0, 3)];
            bonesAnim(bonesPart("jump", { times: 1 }), bonesPart("joyBack", { times: 1 }), bonesPart("play"));
            if (g.round >= BONES_ROUNDS) g.readyT = setTimeout(() => bonesGame === g && bonesWin(), 1600);
            else $(".bonesNext").hidden = false;
        });
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

function bonesPadOpen(title, target, onOk) {
    bonesBuf = "";
    bonesTarget = target;
    bonesOnOk = onOk;
    const t = $(".bonesPadTitle span");
    t.textContent = title;
    t.className = /\d/.test(title) ? "big" : "";
    $(".bonesDisp").innerHTML = "&nbsp;";
    $(".bonesPad").hidden = false;
    bonesAnim(bonesPart("look"));
}

function bonesPress(k) {
    const d = $(".bonesDisp");
    if (k === "⌫") bonesBuf = bonesBuf.slice(0, -1);
    else if (k === "OK") {
        if (bonesBuf === "") return;
        if (+bonesBuf === bonesTarget) {
            $(".bonesPad").hidden = true;
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
            bonesAnim(bonesPart("no", { times: 2 }), bonesWait());
            setTimeout(() => (d.innerHTML = "&nbsp;"), 500);
        }
        return;
    } else if (bonesBuf.length < 2) bonesBuf += k;
    d.innerHTML = bonesBuf || "&nbsp;";
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
    startQueue([{ sheet: "a01", anim: 17, time: BONES_FOREVER }]);
    phase = "bones-end";
    stage = "bones-end";
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
    }
    bonesGame = null;
    $(".bonesFull").hidden = true;
    $(".bonesPad").hidden = true;
    document.body.classList.remove("bonesOn");
    $("#bonesWinPopup").hidden = true;
    dogLift = 0;
    x = 0.5;
    if (g && g.prevRoom && g.prevRoom !== room) setRoom(g.prevRoom);
    const grace = clock + 4000 + Math.random() * 2500;
    nextMoleSpawn = Math.max(nextMoleSpawn, grace);
    nextAmbientSpawn = Math.max(nextAmbientSpawn, grace);
    nextButterfly = Math.max(nextButterfly, grace);
    nextHedgehogSpawn = Math.max(nextHedgehogSpawn, grace);
    idle(16);
}
