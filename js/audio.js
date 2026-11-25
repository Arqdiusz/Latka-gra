"use strict";
// ═══════════════════════════════════════════════════════════════
// DŹWIĘKI — syntezowane w locie (Web Audio), zero plików. Miękkie, ciche,
// w stylu 8-bit (fale sinusoidalne/trójkątne, krótkie obwiednie) — odpowiednie
// dla 3+. Użycie: sfx("pair"). Wyciszenie: przycisk 🔊/🔇 (zapis w localStorage).
// Kontekst audio odblokowuje pierwszy dotyk (wymóg iOS/Safari/Chrome).
// ═══════════════════════════════════════════════════════════════
(() => {
    const STORE = "soundMuted",
        MASTER = 0.5; // ogólna głośność — celowo niska
    let ctx = null,
        master = null,
        muted = false,
        lastAt = {}; // anty-spam: ostatni czas każdego dźwięku
    try {
        muted = localStorage.getItem(STORE) === "1";
    } catch (_) {}

    function ensure() {
        if (ctx) return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = muted ? 0 : MASTER;
            // łagodny kompresor, żeby nakładające się dźwięki nie kłuły w uszy
            const comp = ctx.createDynamicsCompressor();
            master.connect(comp);
            comp.connect(ctx.destination);
        } catch (_) {
            ctx = null;
        }
        return ctx;
    }

    function unlock() {
        const c = ensure();
        if (c && c.state !== "running") c.resume().catch(() => {});
    }
    for (const ev of ["pointerdown", "touchstart", "keydown", "click"]) window.addEventListener(ev, unlock, { passive: true });

    // Pojedyncza nuta: freq (Hz lub [od, do] z płynnym ślizgiem), czas, typ fali
    function tone(t0, freq, dur, { type = "sine", vol = 0.25, slideTo = null, attack = 0.012 } = {}) {
        const o = ctx.createOscillator(),
            g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.03);
    }

    // Ciąg nut: [[freq, offset s, dur s], …]
    function melody(notes, opt = {}) {
        const t0 = ctx.currentTime + 0.01;
        for (const [f, off, dur] of notes) tone(t0 + off, f, dur, opt);
    }

    // szum (do bąbelków, szurania) — krótki, filtrowany
    function noise(t0, dur, { vol = 0.12, freq = 1800 } = {}) {
        const n = Math.floor(ctx.sampleRate * dur),
            buf = ctx.createBuffer(1, n, ctx.sampleRate),
            d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = ctx.createBufferSource(),
            f = ctx.createBiquadFilter(),
            g = ctx.createGain();
        s.buffer = buf;
        f.type = "bandpass";
        f.frequency.value = freq;
        g.gain.value = vol;
        s.connect(f);
        f.connect(g);
        g.connect(master);
        s.start(t0);
    }

    // Szczeknięcie: piłokształtna fala z opadającym tonem przez filtr pasmowy
    // („pysk”) + krótkie chuchnięcie szumu na początku. Mały piesek = wyżej.
    function woof(t0, { f0 = 640, f1 = 330, dur = 0.15, vol = 0.34, form = 1000, q = 1.4 } = {}) {
        const o = ctx.createOscillator(),
            f = ctx.createBiquadFilter(),
            g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        f.type = "bandpass";
        f.frequency.setValueAtTime(form * 1.3, t0);
        f.frequency.exponentialRampToValueAtTime(form * 0.7, t0 + dur);
        f.Q.value = q;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.03);
        noise(t0, 0.04, { vol: vol * 0.35, freq: 1800 });
    }

    const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784, C6: 1047 };

    // nazwa → [minimalny odstęp ms, funkcja(parametr)]
    const SOUNDS = {
        // dotknięcie przycisku / kafelka — mięciutkie "tup"
        tap: [60, () => tone(ctx.currentTime, 520, 0.09, { type: "sine", vol: 0.18, slideTo: 380 })],
        // pojawia się dymek z myślą/potrzebą — dwa miękkie "plip"
        bubble: [250, () => melody([[N.G5, 0, 0.1], [N.C6, 0.08, 0.14]], { vol: 0.1 })],
        // dymek z potrzebą pulsuje — cichy, ciepły dzwonek
        need: [600, () => melody([[N.E5, 0, 0.16], [N.C5, 0.12, 0.22]], { type: "triangle", vol: 0.14 })],
        // złapany motylek / dobra bańka / owoc — wesoły "pling" w górę
        good: [50, () => melody([[N.E5, 0, 0.1], [N.G5, 0.07, 0.12], [N.C6, 0.14, 0.2]], { type: "triangle", vol: 0.2 })],
        // złapany kret — niskie "pac" + pling
        whack: [60, () => {
            const t = ctx.currentTime;
            tone(t, 220, 0.12, { type: "triangle", vol: 0.3, slideTo: 110 });
            tone(t + 0.06, N.G5, 0.16, { type: "triangle", vol: 0.16 });
        }],
        // minus — łagodne "bem" w dół (nie straszne)
        minus: [120, () => tone(ctx.currentTime, 300, 0.22, { type: "triangle", vol: 0.2, slideTo: 170 })],
        // odkryta karta — krótki "klik"
        flip: [50, () => tone(ctx.currentTime, 700, 0.06, { type: "square", vol: 0.06, slideTo: 900 })],
        // znaleziona para — wesoła trójka w górę
        pair: [100, () => melody([[N.C5, 0, 0.12], [N.E5, 0.1, 0.12], [N.G5, 0.2, 0.12], [N.C6, 0.3, 0.3]], { type: "triangle", vol: 0.2 })],
        // karty się nie zgadzają — delikatne "plum"
        miss: [120, () => tone(ctx.currentTime, 330, 0.16, { type: "sine", vol: 0.14, slideTo: 250 })],
        // poprawny motylek we wzorze — dźwięk rośnie z numerem kroku
        step: [30, (i = 0) => tone(ctx.currentTime, N.C5 * Math.pow(1.122, Math.min(i, 8)), 0.18, { type: "triangle", vol: 0.2 })],
        // fanfary na ekranie wygranej
        win: [800, () => melody(
            [[N.C5, 0, 0.14], [N.E5, 0.13, 0.14], [N.G5, 0.26, 0.14], [N.C6, 0.4, 0.5], [N.G5, 0.62, 0.12], [N.C6, 0.74, 0.55]],
            { type: "triangle", vol: 0.22 })],
        // przegrana rundy — łagodne zejście, bez dramatu
        lose: [800, () => melody([[N.G4, 0, 0.2], [N.E4, 0.2, 0.2], [N.C4, 0.4, 0.4]], { type: "sine", vol: 0.2 })],
        // piłka odbija się od ziemi (i = siła 0..1)
        bounce: [70, (i = 1) => tone(ctx.currentTime, 190 + 90 * i, 0.12, { type: "sine", vol: 0.1 + 0.2 * i, slideTo: 90 })],
        // rzut piłką — "fiuuu"
        throw: [200, () => noise(ctx.currentTime, 0.28, { vol: 0.1, freq: 900 })],
        // pęknięcie bańki mydlanej
        pop: [40, () => {
            const t = ctx.currentTime;
            tone(t, 900 + Math.random() * 500, 0.08, { type: "sine", vol: 0.18, slideTo: 1800 });
            noise(t, 0.05, { vol: 0.08, freq: 4000 });
        }],
        // jeżyk ucieka / gubi owoc — drobne "tup-tup"
        scare: [200, () => {
            const t = ctx.currentTime;
            tone(t, 420, 0.07, { vol: 0.2, slideTo: 300 });
            tone(t + 0.09, 360, 0.07, { vol: 0.2, slideTo: 260 });
        }],
        // pierwsze/ostatnie kliknięcie "Graj"
        start: [500, () => melody([[N.C5, 0, 0.1], [N.G5, 0.09, 0.22]], { type: "triangle", vol: 0.2 })],
        // smutne westchnienie pieska — wolne zejście
        sad: [1500, () => tone(ctx.currentTime, 380, 0.7, { type: "sine", vol: 0.14, slideTo: 200, attack: 0.1 })],
        // tłuczone szkło — jasny brzdęk + szum odłamków (głośniejszy, bo to "wydarzenie")
        glass: [400, () => {
            const t = ctx.currentTime;
            noise(t, 0.35, { vol: 0.22, freq: 5200 });
            for (const [f, o] of [[2637, 0], [3136, 0.02], [2093, 0.05], [3951, 0.09], [3322, 0.15]])
                tone(t + o, f, 0.18, { type: "triangle", vol: 0.12, slideTo: f * 0.93 });
            noise(t + 0.18, 0.2, { vol: 0.1, freq: 6500 });
        }],
        // szczekanie (a03 „07–09”): zwykłe „hau”, wesołe (wyżej, krócej), grzeczne (ciche)
        bark: [140, () => woof(ctx.currentTime, { f0: 640, f1: 330, dur: 0.15, vol: 0.34 })],
        barkHappy: [140, () => woof(ctx.currentTime, { f0: 780, f1: 430, dur: 0.12, vol: 0.3, form: 1150 })],
        barkSoft: [140, () => woof(ctx.currentTime, { f0: 860, f1: 560, dur: 0.1, vol: 0.17, form: 1300, q: 1.8 })],
        // kupka / sprzątanie — "szur"
        wipe: [150, () => noise(ctx.currentTime, 0.2, { vol: 0.1, freq: 2500 })],
    };

    window.sfx = (name, arg) => {
        if (muted) return;
        const s = SOUNDS[name];
        if (!s || !ensure()) return;
        const now = performance.now();
        if (now - (lastAt[name] || -1e9) < s[0]) return;
        lastAt[name] = now;
        const play = () => {
            try {
                s[1](arg);
            } catch (_) {}
        };
        // pierwszy dźwięk po dotyku: kontekst dopiero się budzi — gramy po wznowieniu
        if (ctx.state !== "running") ctx.resume().then(play, () => {});
        else play();
    };

    window.sfxMuted = () => muted;
    window.sfxSetMuted = (m) => {
        muted = !!m;
        try {
            localStorage.setItem(STORE, muted ? "1" : "0");
        } catch (_) {}
        if (master) master.gain.value = muted ? 0 : MASTER;
        document.querySelectorAll(".muteBtn").forEach((b) => {
            b.textContent = muted ? "🔇" : "🔊";
            b.setAttribute("aria-pressed", muted ? "true" : "false");
            b.setAttribute("aria-label", muted ? "Włącz dźwięki" : "Wycisz dźwięki");
        });
        if (!muted) setTimeout(() => sfx("tap"), 30);
    };

    // Przyciski wyciszenia (w grze i na ekranie ładowania) + "tap" na każdy przycisk
    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".muteBtn").forEach((b) => {
            b.addEventListener("click", (e) => {
                e.stopPropagation();
                sfxSetMuted(!muted);
            });
        });
        sfxSetMuted(muted);
    });
    // wspólne "tup" przy dotknięciu dowolnego przycisku (poza wyciszeniem i planszami gier)
    document.addEventListener(
        "pointerdown",
        (e) => {
            const b = e.target.closest && e.target.closest("button");
            if (b && !b.classList.contains("muteBtn") && !b.classList.contains("pairsCard") && !b.classList.contains("loadPlay")) sfx("tap");
            else if (b && b.classList.contains("loadPlay")) sfx("start");
        },
        true
    );
})();
