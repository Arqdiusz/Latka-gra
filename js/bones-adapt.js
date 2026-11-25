"use strict";
// ═══════════════════════════════════════════════════════════════
// LICZYMY KOSTKI — ADAPTACYJNY DOBÓR ZADAŃ + STATYSTYKI DLA RODZICA
// Dziecko nie wybiera poziomu. Gra zapisuje w telefonie (localStorage), jak
// sobie radzi, i sama dobiera zadania:
//  • trzy umiejętności z osobnymi poziomami (0…): dodawanie, odejmowanie,
//    „czego brakuje” (brakująca liczba). Zadania lecą wymieszane w jednej grze;
//  • odejmowanie odblokowuje się, gdy dodawanie idzie pewnie (poziom ≥ 2),
//    „czego brakuje” dopiero potem (dodawanie ≥ 3 i odejmowanie ≥ 1);
//  • odejmowanie i „czego brakuje” są zawsze o stopień łatwiejsze niż dodawanie
//    (dopóki dodawanie nie dojdzie do końca drabinki);
//  • poziom rośnie po 4 dobrych zadaniach z rzędu, spada po 2 złych w ostatnich 3;
//    „dobre” = najwyżej jedna pomyłka i odpowiedź w rozsądnym czasie;
//  • ok. 20% zadań to „wyzwanie” o stopień wyżej, ok. 25% powtórka pomyłek
//    (np. 7 + 5), które wracają, dopóki dziecko ich nie zrobi dobrze;
//  • dziennik: ile razy gra była proponowana, rozpoczęta, dokończona oraz ile
//    razy dziecko wybrało „Nie teraz”, „Wróć” albo ✕ — to widzi rodzic.
// ═══════════════════════════════════════════════════════════════

const ADAPT_KEY = "latka-liczenie-v1",
    ADAPT_GOOD_MS = 25000, // dłuższa odpowiedź nie liczy się jako „dobra”
    ADAPT_LEVELS = {
        add: [
            { min: 2, max: 4, txt: "sumy 2–4" },
            { min: 2, max: 6, txt: "sumy 2–6" },
            { min: 4, max: 8, txt: "sumy 4–8" },
            { min: 6, max: 10, txt: "sumy 6–10" },
            { min: 6, max: 10, hide: true, txt: "sumy 6–10, kostki znikają" },
        ],
        sub: [
            { min: 2, max: 4, txt: "od 2 do 4" },
            { min: 2, max: 6, txt: "od 2 do 6" },
            { min: 4, max: 8, txt: "od 4 do 8" },
            { min: 6, max: 10, txt: "od 6 do 10" },
            { min: 6, max: 10, hide: true, txt: "od 6 do 10, kostki znikają" },
        ],
        miss: [
            { min: 2, max: 6, test: true, txt: "liczby 2–6" },
            { min: 4, max: 8, test: true, txt: "liczby 4–8" },
            { min: 6, max: 10, test: true, txt: "liczby 6–10" },
        ],
    },
    ADAPT_NAMES = { add: "Dodawanie", sub: "Odejmowanie", miss: "Czego brakuje" },
    adaptRnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function adaptFresh() {
    return {
        v: 1,
        add: { lvl: 0, hist: [], n: 0, ok: 0, ms: 0 },
        sub: { lvl: 0, hist: [], n: 0, ok: 0, ms: 0, on: false },
        miss: { lvl: 0, hist: [], n: 0, ok: 0, ms: 0, on: false },
        seen: { sub: false, miss: false }, // czy dziecko widziało okienko „Nowość”
        err: {}, // „+7,5”: ile razy pomylone (powtórki)
        tasks: 0,
        rounds: 0,
        tot: { offer: 0, start: 0, finish: 0, noThanks: 0, back: 0, exit: 0 },
        log: [], // { t, k } — do liczenia „ostatnie 7 dni”
        last: null, // ostatnia para (żeby się nie powtarzała)
    };
}
let adapt = adaptFresh();
try {
    const s = JSON.parse(localStorage.getItem(ADAPT_KEY) || "null");
    if (s && s.v === 1) adapt = Object.assign(adaptFresh(), s);
} catch (e) {
    console.warn(e);
}
function adaptSave() {
    try {
        localStorage.setItem(ADAPT_KEY, JSON.stringify(adapt));
    } catch (e) {
        console.warn(e);
    }
}

// zdarzenia do podglądu rodzica: offer (karta „Piesek znalazł kostkę”), start, finish,
// noThanks („Nie teraz” na karcie), back („Wróć” na ekranie startowym), exit (✕ w grze)
function adaptLog(k) {
    adapt.tot[k] = (adapt.tot[k] || 0) + 1;
    adapt.log.push({ t: Date.now(), k });
    if (adapt.log.length > 400) adapt.log.splice(0, adapt.log.length - 400);
    adaptSave();
}

// ── Poziomy i odblokowania ───────────────────────────────────────────
const adaptMaxLvl = (sk) => ADAPT_LEVELS[sk].length - 1;
// najwyższy poziom, na jaki wolno awansować umiejętność (odejmowanie i „brakuje” gonią dodawanie)
function adaptCap(sk) {
    if (sk === "add") return adaptMaxLvl("add");
    if (adapt.add.lvl >= adaptMaxLvl("add")) return adaptMaxLvl(sk);
    return Math.min(adaptMaxLvl(sk), Math.max(0, adapt.add.lvl - 1));
}
function adaptUnlock() {
    if (!adapt.seen) adapt.seen = { sub: false, miss: false };
    if (!adapt.sub.on && adapt.add.lvl >= 2) adapt.sub.on = true;
    if (!adapt.miss.on && adapt.add.lvl >= 3 && adapt.sub.lvl >= 1) adapt.miss.on = true;
    // okienko „Nowość” pokazuje się, dopóki dziecko go nie zatwierdzi (raz na umiejętność)
    if (adapt.sub.on && !adapt.seen.sub) return "sub";
    if (adapt.miss.on && !adapt.seen.miss) return "miss";
    return null;
}

function adaptMakeNumbers(op, lvlDef, avoid) {
    let A, B;
    for (let tries = 0; tries < 10; tries++) {
        if (op === "+") {
            const s = adaptRnd(lvlDef.min, lvlDef.max);
            A = adaptRnd(1, s - 1);
            B = s - A;
        } else {
            A = adaptRnd(lvlDef.min, lvlDef.max);
            B = adaptRnd(1, A - 1);
        }
        if (op + A + "," + B !== avoid) break;
    }
    return { A, B };
}

// wybiera następne zadanie; index = które to zadanie w rundzie (0…)
function adaptPick(index) {
    const news = adaptUnlock();
    const skills = ["add"];
    if (adapt.sub.on) skills.push("sub");
    if (adapt.miss.on) skills.push("miss");
    const weight = { add: 1, sub: 0.4 + 0.12 * adapt.sub.lvl, miss: 0.25 + 0.1 * adapt.miss.lvl };
    let r = Math.random() * skills.reduce((s, k) => s + weight[k], 0),
        sk = skills[0];
    for (const k of skills) {
        if ((r -= weight[k]) <= 0) {
            sk = k;
            break;
        }
    }
    if (index === 0 && news) sk = news; // pierwsze zadanie z nową umiejętnością
    let lvl = adapt[sk].lvl,
        challenge = false,
        review = null;
    // powtórka pomyłki z tej umiejętności (dodawanie/odejmowanie według znaku)
    const keys = Object.keys(adapt.err).filter((k) => adapt.err[k] > 0 && (sk === "add" ? k[0] === "+" : sk === "sub" ? k[0] === "−" || k[0] === "-" : true));
    if (keys.length && index > 0 && Math.random() < 0.25) review = keys[adaptRnd(0, keys.length - 1)];
    else if (index > 0 && lvl < adaptCap(sk) + 1 && lvl < adaptMaxLvl(sk) && Math.random() < 0.2) {
        lvl++;
        challenge = true;
    }
    let op = sk === "add" ? "+" : sk === "sub" ? "-" : Math.random() < 0.5 ? "+" : "-",
        A,
        B;
    const def = ADAPT_LEVELS[sk][lvl];
    if (review) {
        const m = review.match(/^(.)(\d+),(\d+)$/);
        op = m[1] === "+" ? "+" : "-";
        A = +m[2];
        B = +m[3];
    } else ({ A, B } = adaptMakeNumbers(op, def, adapt.last));
    adapt.last = op + A + "," + B;
    const C = op === "+" ? A + B : A - B;
    return {
        skill: sk,
        op,
        A,
        B,
        C,
        lvl,
        challenge,
        review: !!review,
        hide: !!def.hide,
        test: !!def.test,
        unk: def.test ? ["a", "b", "c"][adaptRnd(0, 2)] : "c",
        news: index === 0 && news ? news : null,
        key: (op === "+" ? "+" : "−") + A + "," + B,
    };
}

// wynik zadania: mistakes = ile razy pomylone OK, ms = czas od pojawienia się „?” do dobrej odpowiedzi
function adaptResult(task, mistakes, ms) {
    const s = adapt[task.skill],
        good = mistakes <= 1 && ms <= ADAPT_GOOD_MS;
    adapt.tasks++;
    s.n++;
    s.ms += Math.min(ms, 60000);
    if (mistakes === 0) s.ok++;
    // pomyłki wracają jako powtórki, dopóki nie pójdą dobrze
    if (mistakes >= 1) adapt.err[task.key] = Math.min(4, (adapt.err[task.key] || 0) + 1);
    else if (adapt.err[task.key]) {
        adapt.err[task.key]--;
        if (adapt.err[task.key] <= 0) delete adapt.err[task.key];
    }
    // wyzwanie (poziom wyżej) liczy się tylko, gdy poszło dobrze; nieudane nie karze
    if (!(task.challenge && !good)) {
        s.hist.push(good ? 1 : 0);
        if (s.hist.length > 6) s.hist.shift();
    }
    const last4 = s.hist.slice(-4),
        last3 = s.hist.slice(-3);
    if (last4.length === 4 && last4.every((x) => x === 1) && s.lvl < adaptCap(task.skill)) {
        s.lvl++;
        s.hist = [];
    } else if (last3.length === 3 && last3.filter((x) => !x).length >= 2 && s.lvl > 0) {
        s.lvl--;
        s.hist = [];
    }
    adaptSave();
}
function adaptSeen(k) {
    if (!adapt.seen) adapt.seen = { sub: false, miss: false };
    adapt.seen[k] = true;
    adaptSave();
}
function adaptRoundDone() {
    adapt.rounds++;
    adaptSave();
}
function adaptReset() {
    const tot = adapt.tot,
        log = adapt.log;
    adapt = adaptFresh();
    adapt.tot = tot; // statystyka odmów zostaje
    adapt.log = log;
    adaptSave();
}

// ── Podsumowanie dla rodzica ────────────────────────────────────────
function adaptSummary() {
    const week = Date.now() - 7 * 86400000,
        w = {};
    for (const e of adapt.log) if (e.t >= week) w[e.k] = (w[e.k] || 0) + 1;
    const skills = ["add", "sub", "miss"].map((k) => {
        const s = adapt[k],
            on = k === "add" || s.on;
        return {
            key: k,
            name: ADAPT_NAMES[k],
            on,
            lvl: s.lvl,
            max: adaptMaxLvl(k),
            txt: ADAPT_LEVELS[k][s.lvl].txt,
            n: s.n,
            okPct: s.n ? Math.round((s.ok / s.n) * 100) : null,
            avgS: s.n ? Math.round(s.ms / s.n / 100) / 10 : null,
        };
    });
    const mistakes = Object.entries(adapt.err)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, n]) => ({ txt: k.replace(/^(.)(\d+),(\d+)$/, "$2 $1 $3"), n }));
    return { skills, mistakes, tasks: adapt.tasks, rounds: adapt.rounds, tot: adapt.tot, week: w };
}
