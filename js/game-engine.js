"use strict";
// Bramki i blokady (casual, locks), kolejka animacji (startQueue…), aktywności, podróże między pokojami (arrowTravel, route), akcje i reakcje.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// Wejście do mini-gry z Łąki (kret, jeżyk) działa też, gdy piesek akurat
// reaguje na dotyk / robi coś krótkiego — dotyk dziecka ma pierwszeństwo.
function gameEntryOk() {
    if (sadBlocks("games")) return false;
    return casual() || (loaded && !sleeping && ["reaction"].includes(phase));
}

function casual() {
    // "butterfly" (piesek bawi się ze złapanym motylkiem) celowo NIE jest
    // tu wymieniony — to zdarzenie, raz uruchomione, musi dobiec końca.
    // Dzięki temu wszystkie wejścia bramkowane przez casual()/interrupt()
    // (strzałki, głaskanie, menu, swipe) są podczas niego zablokowane.
    return loaded && ["idle", "roam", "pause", "look", "sad"].includes(phase);
}

function canPet() {
    return casual() || phase === "petting";
}

function locks() {
    // W czasie czekania na rzut / łapania baniek menu zostaje aktywne,
    // żeby dało się wyjść z zabawy
    document.body.classList.toggle("locked", !casual() && phase !== "ball-ready" && phase !== "bubble-game" && phase !== "mole-game");
    document.querySelectorAll(".arrow").forEach((b) => (b.disabled = !casual()));
    $(".petAccess").disabled = !canPet();
    updatePawsUi();
    updateArrows();
    updateFetchUi();
    updateBubbleUi();
    updateMoleUi();
}

function updateArrows() {
    const n = order.indexOf(room);
    $(".arrow.prev").hidden = n === 0;
    $(".arrow.next").hidden = n === order.length - 1;
}

function updatePoopAccess() {
    $(".poopAccess").hidden = !dirty();
}

function interrupt() {
    if (!casual()) return;
    queue = [];
    segment = null;
    if (phase === "butterfly") {
        butterfly = null;
        nextButterfly = clock + 22500;
    }
    phase = "idle";
    jumpY = 0;
    setAnim("a01", 16);
    locks();
}

// Koniec drzemki: piesek sam się budzi — ziewa i przeciąga się (a02 „08”), potem swoje sprawy
function napEnd() {
    if (!sleeping) return;
    sleeping = false;
    queue = [];
    segment = null;
    phase = "activity";
    stage = "nap-wake";
    startQueue([repeatPart("a02", 7, 1)]);
    locks();
    save();
}

function wake() {
    if (!sleeping) return;
    sleeping = false;
    setAnim("a01", 16);
    idleUntil = clock + 4000;
    save();
}

function say(icon, time = 2600, type = UI.bubbleType) {
    if (!bubble || bubble.icon !== icon) sfx(bubble?.sad ? "need" : "bubble");
    bubble = {
        icon,
        until: clock + time,
        type,
    };
}

function idle(which = null) {
    phase = "idle";
    stage = "";
    queue = [];
    segment = null;
    pending = null;
    jumpY = 0;
    boneVisible = false;
    // Swobodnie lecący, klikalny motylek (free) żyje własnym życiem i NIE znika
    // przy każdym powrocie pieska do idle() — dawniej to powodowało, że
    // pojawiał się na ułamek sekundy i od razu znikał.
    if (!butterfly?.free) butterfly = null;
    ball = null;
    fetchGame = null;
    dogHidden = false;
    bubbleGame = null;
    moleGame = null;
    hedgeGame = null;
    mole2Game = null;
    memoGame = null;
    if (typeof pairsGame !== "undefined" && pairsGame) {
        clearTimeout(pairsGame.timer);
        pairsGame = null;
        $(".pairsFull").hidden = true;
    }
    setOffset(0);
    setAnim("a01", which ?? (Math.random() < 0.35 ? 18 : 16));
    idleUntil = clock + Math.max(frames.length * ms, 1800) + Math.random() * 2000;
    locks();
    save();
}

function startQueue(parts) {
    queue = parts;
    nextSegment();
}

function nextSegment() {
    segment = queue.shift();
    if (!segment) {
        idle();
        return;
    }
    segment.started = clock;
    segment.onStart?.();
    if (segment.sheet && segment.anim !== undefined) setAnim(segment.sheet, segment.anim, segment.tempo);
    if (segment.frames) setFrames(segment.sheet || "a01", segment.frames, segment.tempo || 200);
    if (segment.from !== undefined) x = segment.from;
    segment.origin = x;
    if (segment.facing !== undefined) left = segment.facing;
    else if (segment.to !== undefined && Math.abs(segment.to - x) > 0.001) left = segment.to < x;
    segment.distance = segment.to === undefined ? 0 : Math.abs(segment.to - x) * W;
}

function blockRoomActivity(id) {
    if (!dirty()) return false;
    idle(16);
    blockedActivity = id;
    refuseWith("poop"); // „NIE” + pulsująca kupka w dymku
    return true;
}

function rewardParts() {
    const id = pending;
    return [
        {
            sheet: "a01",
            anim: 16,
            time: 1000,
            onStart: () => {
                if (ACTION_EFFECTS[id]) {
                    changeNeeds(ACTION_EFFECTS[id]);
                    save();
                }
                $(".popup").hidden = false;
                $(".reward").src = icons.heart;
            },
            onEnd: () => ($(".popup").hidden = true),
        },
    ];
}

function repeatPart(s, i, times = 1) {
    return {
        sheet: s,
        anim: i,
        time: duration(s, i) * times,
    };
}

function activity(id) {
    if (!dirty()) {
        // Najedzony / napojony: bez tekstu — piesek kręci głową „NIE”.
        // (Potrzeb pilnuje smutek przy ≤10%, patrz sadBlocks().)
        if (FULL_NEED[id] && stats[FULL_NEED[id]] >= FULL_AT && !(FULL_NEED[id] === "clean" && pawDirt >= 3)) {
            idle(16);
            fullRefuse(id);
            return;
        }
    }

    if (blockRoomActivity(id)) return;
    pending = id;
    if (id === "paws") {
        pending = null;
        pawsStart();
        return;
    }
    if (id === "sleep") {
        sleeping = true;
        napStart = clock;
        phase = "idle";
        queue = [];
        segment = null;
        setAnim("a02", 6);
        say("sleep", 2600);
        locks();
        save();
        return;
    }
    if (id === "fun") {
        // Zabawa = aport: dziecko rzuca piłkę, Łatka biega po nią.
        // Najpierw krótki pop-up z instrukcją, start dopiero po "OK".
        ballIntroShow(fetchStart);
        return;
    }
    if (id === "clean") {
        // Mycie = łapanie baniek na całym ekranie (najpierw krótki tutorial).
        bubbleIntroShow(bubbleStart);
        return;
    }
    phase = "activity";
    locks();
    let parts = [];
    if (id === "food") parts = [repeatPart("a01", 5)];
    else if (id === "water") parts = [repeatPart("a01", 2)];
    else if (id === "brush") {
        const p = getPreset("a02", 21);
        if (numbers(p.intro).length)
            parts.push({
                sheet: "a02",
                frames: numbers(p.intro),
                tempo: p.ms,
                time: numbers(p.intro).length * p.ms,
            });
        parts.push(repeatPart("a02", 21));
        if (numbers(p.outro).length)
            parts.push({
                sheet: "a02",
                frames: numbers(p.outro),
                tempo: p.ms,
                time: numbers(p.outro).length * p.ms,
            });
    } else if (id === "den")
        parts = [
            {
                sheet: "a01",
                anim: 18,
                time: 3600,
                onStart: () => (boneVisible = true),
                onEnd: () => (boneVisible = false),
            },
        ];
    else parts = [repeatPart("a02", 8 + Math.floor(Math.random() * 6), 2)];
    parts.push(...rewardParts());
    startQueue(parts);
}

function chooseVariant() {
    let v = forcedVariant;
    if (v) {
        forcedVariant = null;
        lastVariant = v;
        return v;
    }
    const r = Math.random();
    v = r < 0.5 ? "roll" : r < 0.85 ? "run" : "happy";
    if (v === lastVariant) v = v === "roll" ? "run" : "roll";
    lastVariant = v;
    return v;
}

function finishTravel(id) {
    nextTrip = clock + 15000 + Math.random() * 15000;
    if (id) activity(id);
    else {
        idle(16);
        if (dirty()) say("poop", 3500);
    }
}
// Arrow timing is calmer; ordinary animations retain the user's configured timing.
function arrowTravel(r, dir) {
    interrupt();
    wake();
    phase = "travel";
    travelMode = "arrow";
    left = dir < 0;
    bubble = null;
    locks();
    const facing = dir < 0,
        edge = dir > 0 ? 0.82 : 0.18,
        exit = dir > 0 ? 1.06 : -0.06,
        entry = dir > 0 ? -0.06 : 1.06,
        land = dir > 0 ? 0.18 : 0.82,
        variant = chooseVariant();
    let changed = false;
    const parts = [
        {
            sheet: "a01",
            anim: 1,
            tempo: 180,
            facing,
            to: edge,
            motion: "run",
            time: Math.max(240, ((Math.abs(edge - x) * W) / 430) * 1000),
            onStart: () => (stage = "run"),
        },
        variant === "roll"
            ? {
                  sheet: "a01",
                  anim: 0,
                  tempo: 155,
                  facing,
                  time: reduced ? 160 : 520,
                  onStart: () => (stage = "jump"),
                  update: (p) => {
                      if (p >= 0.5 && !changed) {
                          setRoom(r);
                          changed = true;
                      }
                      x = p < 0.5 ? edge + (exit - edge) * p * 2 : entry + (land - entry) * (p - 0.5) * 2;
                      jumpY = reduced ? 0 : -Math.sin(Math.PI * p) * 35;
                  },
                  onEnd: () => {
                      if (!changed) setRoom(r);
                      x = land;
                      jumpY = 0;
                  },
              }
            : {
                  sheet: "a01",
                  anim: 1,
                  tempo: 180,
                  facing,
                  time: reduced ? 160 : 520,
                  onStart: () => (stage = "run"),
                  update: (p) => {
                      if (p >= 0.5 && !changed) {
                          setRoom(r);
                          changed = true;
                      }
                      x = p < 0.5 ? edge + (exit - edge) * p * 2 : entry + (land - entry) * (p - 0.5) * 2;
                  },
                  onEnd: () => {
                      if (!changed) setRoom(r);
                      x = land;
                  },
              },
        {
            sheet: "a01",
            anim: variant === "roll" ? 9 : 1,
            tempo: variant === "roll" ? 225 : 180,
            facing,
            from: land,
            to: 0.5,
            motion: variant === "roll" ? null : "run",
            time: variant === "roll" ? 750 : ((Math.abs(0.5 - land) * W) / 300) * 1000,
            onStart: () => (stage = "arrival"),
        },
    ];
    parts.push({
        sheet: "a01",
        anim: 16,
        facing,
        time: 220,
        onEnd: () => finishTravel(null),
    });
    startQueue(parts);
}

function stepRoom(d) {
    if (!casual()) return;
    // smutny piesek (potrzeba ≤10%) nie chodzi strzałkami/przesunięciem —
    // ruszy się dopiero po wybraniu w menu tego, czego mu brak
    if (sadNeed() && !sleeping) return sadRefuse();
    const n = order.indexOf(room) + d;
    if (n < 0 || n >= order.length) return;
    arrowTravel(order[n], d);
}

function route(target, id = null, mode = "menu") {
    if (!casual() || !order.includes(target)) return;
    interrupt();
    wake();
    phase = "travel";
    travelMode = mode;
    travelTarget = target;
    pending = id;
    bubble = null;
    locks();
    const from = order.indexOf(room),
        to = order.indexOf(target),
        distance = Math.abs(to - from),
        dir = to >= from ? 1 : -1,
        facing = dir < 0,
        run = true, // zawsze bieg (anim 02. Bieg/sus), spacer usunięty
        speed = 300, // px/s: spokojnie, żeby dziecko widziało, dokąd piesek biegnie
        parts = [];

    function movement(a, b, onEnd) {
        return {
            sheet: "a01",
            anim: run ? 1 : 6,
            tempo: 180,
            motion: run ? "run" : "walk",
            facing,
            from: a,
            to: b,
            time: Math.max(160, ((Math.abs(b - a) * W) / speed) * 1000),
            onStart: () => (stage = run ? "route-run" : "route-walk"),
            onEnd,
        };
    }
    let finalFacing = facing;
    if (!distance) {
        // Piesek już jest w tym pokoju. Jeśli stoi poza środkiem (gdzie są
        // rysowane miski/aktywności), ma się obrócić w stronę środka i podejść
        // tam spokojnym krokiem — kierunek liczony lokalnie (x vs 0.5), a nie
        // z `dir`, który dla tego samego pokoju zawsze wychodzi "w prawo" i
        // powodował nienaturalne cofanie się.
        if (Math.abs(x - 0.5) * W > 2) {
            const localFacing = x > 0.5; // trzeba iść w lewo -> patrzy w lewo
            parts.push({
                sheet: "a01",
                anim: 6, // 07. Marsz
                tempo: 200,
                motion: "walk",
                facing: localFacing,
                from: x,
                to: 0.5,
                // 60px/s — ta sama prędkość co w localWalk() dla tej animacji,
                // bo krok nóg (stride w loopFrame) jest do niej dopasowany;
                // przy wyższej prędkości nogi "migały" nienaturalnie szybko.
                time: Math.max(220, ((Math.abs(x - 0.5) * W) / 60) * 1000),
                onStart: () => (stage = "route-walk"),
            });
            finalFacing = localFacing;
        } else finalFacing = left; // już na miejscu — nie zmieniaj obrotu bez powodu
    } else {
        let origin = x;
        for (let i = from; i !== to; i += dir) {
            const r = order[i + dir];
            parts.push(
                movement(origin, dir > 0 ? 1.08 : -0.08, () => {
                    setRoom(r);
                    x = dir > 0 ? -0.08 : 1.08;
                })
            );
            origin = dir > 0 ? -0.08 : 1.08;
        }
        if (mode === "auto" && target === "garden" && run && Math.random() < 0.3)
            parts.push({
                sheet: "a01",
                anim: 9,
                tempo: 225,
                facing,
                from: origin,
                to: 0.5,
                time: 750,
                onStart: () => (stage = "route-roll"),
            });
        else parts.push(movement(origin, 0.5));
    }
    parts.push({
        sheet: "a01",
        anim: 16,
        facing: finalFacing,
        time: 220,
        onEnd: () => finishTravel(id),
    });
    startQueue(parts);
}

function action(id) {
    // Z czekania na rzut / łapania baniek można wyjść wybierając inną czynność
    if (phase === "ball-ready") {
        fetchGame = null;
        ball = null;
        idle(16);
    }
    if (phase === "bubble-game") {
        bubbleGame = null;
        idle(16);
    }
    if (id === "games") {
        // Puchar działa zawsze: budzi śpiącego pieska i przerywa autonomiczny bieg.
        if (!loaded || phase === "games-menu") return;
        if (sadBlocks("games")) return sadRefuse();
        if (sleeping) wake();
        if (!gameEntryOk() && !(phase === "travel" && travelMode === "auto") && !sleeping) return;
        if (!casual()) idle(16);
        interrupt();
        gamesShow();
        return;
    }
    if (!casual()) return;
    const i = items.find((i) => i.id === id);
    if (!i) return;
    if (sadBlocks(id)) {
        sadRefuse();
        return;
    }
    if (fullRefuse(id)) return; // najedzony / napojony / wyspany / czysty — „NIE”
    if (id === "paws" && pawDirt < 3) return refuseWith("cloth"); // łapki czyste — „NIE” + szmatka w dymku
    if (i.room === room && dirty()) {
        interrupt();
        blockRoomActivity(id);
        return;
    }
    if (id === "sleep" && sleeping) return;
    actions++;
    route(i.room, id, "menu");
}

function react() {
    if (!casual()) return;
    if (sadBlocks("pet")) return sadRefuse();
    interrupt();
    wake();
    say("heart");
    if (Math.random() < 0.35 && bark("happy")) return; // czasem wesoło szczeka
    phase = "reaction";
    locks();
    startQueue([repeatPart("a01", [10, 12, 7, 15][Math.floor(Math.random() * 4)])]);
}
