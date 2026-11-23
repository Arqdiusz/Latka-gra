"use strict";
// ═══════════════════════════════════════════════════════════════
// APORT — mini-gra w rzucanie piłki.
// Wydzielone z game.js dla czytelności (patrz też minigame-bubbles.js).
// Korzysta ze wspólnego stanu/funkcji zadeklarowanych w game.js
// (musi być wczytany PO game.js w index.html).
// ═══════════════════════════════════════════════════════════════

// Sygnalizacja rzutów (3 piłeczki) + przyciski końca/resetu zabawy —
// tylko podczas aportu, bez tekstu (dzieci 3+ jeszcze nie czytają).
function updateFetchUi() {
    const badge = $(".throwsBadge"),
        endBtn = $(".fetchEnd"),
        restartBtn = $(".fetchRestart");
    if (!badge || !endBtn || !restartBtn) return;
    const active = !!fetchGame,
        ready = active && phase === "ball-ready",
        outOfThrows = active && fetchGame.throws >= BALL_THROWS;
    badge.hidden = !active;
    // X widoczny PRZEZ CAŁĄ zabawę (także gdy piłka leci i piesek biegnie),
    // żeby dało się ją przerwać w dowolnym momencie.
    endBtn.hidden = !active || phase === "ball-intro";
    restartBtn.hidden = !ready || !outOfThrows;
    if (!active) return;
    const src = images.ball0?.src;
    badge.querySelectorAll("img").forEach((img, i) => {
        if (src) img.src = src;
        img.classList.toggle("used", i < fetchGame.throws);
    });
}

// Kołowy "licznik czasu" na zielonym przycisku resetu — ciemna tarcza
// zakrywa go stopniowo (0 = pełny zielony, 100 = w pełni zakryty),
// dokładnie w tempie 8-sekundowego odliczania z ballReadySegment().
function restartRing(pct) {
    const ring = $(".fetchRestart__ring");
    if (ring) ring.style.setProperty("--pct", Math.max(0, Math.min(100, pct)));
}

// Odnowienie rzutów — wspólne dla przycisku i dla samej próby rzutu
// po wyczerpaniu piłek (patrz ballThrow()).
function renewFetch() {
    if (!fetchGame) return;
    fetchGame.throws = 0;
    fetchGame.hinted = false;
    say("fun", 2200);
    startQueue([ballReadySegment()]);
}

$(".fetchEnd").onclick = () => {
    if (!fetchGame || phase === "ball-intro") return;
    // Przerwanie w dowolnym momencie: zatrzymaj bieg/lot piłki i zakończ.
    queue = [];
    segment = null;
    jumpY = 0;
    x = clamp(x, 0.1, 0.9);
    fetchFinish(fetchGame.throws > 0);
};

$(".fetchRestart").onclick = () => {
    if (phase !== "ball-ready" || !fetchGame || fetchGame.throws < BALL_THROWS) return;
    renewFetch();
};

/* ═══════════════════════════════════════════════════════════════
   APORT — zabawa w rzucanie piłki
   Dziecko rzuca piłkę gestem, Łatka biegnie po nią (również do
   sąsiedniego pokoju), podnosi ją i przynosi z powrotem.
   ═══════════════════════════════════════════════════════════════ */
const BALL_THROWS = 3, // ile rzutów do nagrody
    BALL_HINT_AFTER = 7000, // po ilu ms bez rzutu Łatka zachęca
    BALL_GIVE_UP = 30000; // po ilu ms bez rzutu zabawa się kończy
let ball = null, // { room, x, y, spin, carried }
    fetchGame = null; // { throws, hinted, homeRoom, homeX }

// Pozycja piłki na ekranie — uwzględnia sąsiednie pokoje (jak kupka)
function ballScreenX() {
    const diff = order.indexOf(ball.room) - order.indexOf(room);
    return ball.x * W + diff * W + roomOffset;
}

// Świat liczony w sposób ciągły: indeks pokoju + pozycja w pokoju
const worldOf = (r, px) => order.indexOf(r) + px;

function worldSplit(w) {
    const lo = 0,
        hi = order.length - 1 + 0.999;
    w = clamp(w, lo, hi);
    let r = Math.floor(w),
        px = w - r;
    if (r > order.length - 1) {
        r = order.length - 1;
        px = 0.999;
    }
    // Uwaga: BEZ dodatkowego clamp(px, 0.12, 0.88) — podczas gładkiej
    // interpolacji lotu piłki między pokojami (ballThrow) takie ograniczenie
    // powodowało "przyklejenie" pozycji tuż przy krawędzi pokoju, a potem
    // skok, gdy world-pozycja przechodziła do sąsiedniego pokoju.
    return {
        room: order[r],
        x: px,
    };
}

// ── Pop-up z instrukcją przed startem zabawy ──────────────────
// Silnik animacji wymaga, żeby poza stanem "idle" zawsze był jakiś
// segment w kolejce — inaczej sam wraca do idle. Dlatego czekanie na
// kliknięcie "OK" to też segment (jak przy czekaniu na rzut).
let ballIntroResume = null;
function ballIntroShow(onOk) {
    ballIntroResume = onOk;
    $(".ballIcon").src = icons.fun;
    $(".ballPopup").hidden = false;
    startQueue([
        {
            sheet: "a01",
            anim: 16, // 17. Spokojne stanie
            time: 120000,
            onStart: () => {
                phase = "ball-intro";
                stage = "ball-intro";
                locks();
            },
        },
    ]);
}
$(".ballOk").onclick = () => {
    $(".ballPopup").hidden = true;
    const resume = ballIntroResume;
    ballIntroResume = null;
    resume?.();
};

// ── Start zabawy ──────────────────────────────────────────────
function fetchStart() {
    phase = "ball-ready";
    stage = "ball-ready";
    queue = [];
    segment = null;
    jumpY = 0;
    fetchGame = {
        throws: 0,
        hinted: false,
        homeRoom: room,
        homeX: 0.5,
    };
    ball = {
        room,
        // 0.19 — wyliczone z pozycji piłki w sprite animacji "25. Aport_002_warowanie"
        x: clamp(x + (left ? -0.19 : 0.19), 0.12, 0.88),
        y: 0,
        spin: 0,
        carried: false,
    };
    say("fun", 2600);
    toast("Złap piłkę palcem i rzuć ją pieskowi!");
    startQueue([ballReadySegment()]);
}

// Łatka czeka na rzut — animacja "25. Aport_002_warowanie" (pies leży, piłka
// przy łapach już w sprite). Osobna piłka rysowana przez ballDraw() z pulsującą
// ramką dokładnie nad tą z animacji — dzięki temu wygląda jak jeden obiekt.
function ballReadySegment() {
    // Gdy piłki się skończyły, nie czekamy pełnych 30s w bezczynności —
    // Łatka po chwili sama kładzie się spokojnie (dziecko może zakończyć
    // szybciej przyciskiem ✓).
    const outOfThrows = !!fetchGame && fetchGame.throws >= BALL_THROWS,
        waitTime = outOfThrows ? 8000 : BALL_GIVE_UP;
    return {
        sheet: "a02",
        anim: 24, // 25. Aport_002_warowanie
        time: waitTime,
        onStart: () => {
            phase = "ball-ready";
            stage = "ball-ready";
            if (fetchGame) fetchGame.hinted = outOfThrows;
            restartRing(0);
            locks();
        },
        update: (p) => {
            if (outOfThrows) restartRing(p * 100);
            if (fetchGame && !fetchGame.hinted && p * waitTime > BALL_HINT_AFTER) {
                fetchGame.hinted = true;
                say("fun", 2600);
                toast("Złap piłkę i rzuć — piesek czeka!");
            }
        },
        onEnd: () => fetchFinish(!!fetchGame && fetchGame.throws > 0),
    };
}

// Zabawa skończona — popup z animacją piłki, potem zwykłe idle
function fetchFinish(rewarded) {
    const got = rewarded && fetchGame && fetchGame.throws > 0;
    fetchGame = null;
    ball = null;
    ballFlight = null;
    if (got) {
        phase = "activity";
        pending = "fun";
        locks();
        // Popup natychmiast po przynesieniu piłki — bez zbędnych animacji przed nim.
        $(".popup").hidden = false;
        $(".reward").src = icons.fun;
        startQueue([
            {
                sheet: "a02", anim: 8, time: 1800,                          // piłka zachęta w popupie
                onEnd: () => ($(".popup").hidden = true),
            },
        ]);
    } else idle(16);
}

// ── Rzut: piłka to obiekt do złapania ─────────────────────────
// Dziecko dotyka piłki przy łapach pieska, ciągnie ją palcem i puszcza.
// Piłka leci z prędkością ostatniego ruchu palca po PRAWDZIWYM rzucie
// ukośnym (grawitacja, odbicia od ziemi, toczenie, odbicie od ściany na
// końcach świata). Tor liczymy raz, z góry, w "świecie" (wszystkie pokoje
// obok siebie) — ballSimulate().
//
// Wylot z ekranu klasyfikujemy do 8 stref (BALL_ZONES): po 3 na lewej i
// prawej krawędzi (nisko / środek / wysoko) i 2 u góry (lewa / prawa
// połowa). Strefa mówi, JAK piłka wpada do pokoju, w którym wyląduje:
// z boku nisko — wtacza się, z boku wyżej — wpada łukiem i się odbija,
// z góry — spada z nieba. Ponieważ tor jest ciągły, wejście w drugim
// pokoju to dokładne przedłużenie wylotu (ta sama wysokość i prędkość).
//
// Drugi pokój odgrywamy jak dotąd: piłka wpada dopiero, gdy kamera (pies)
// tam dociera — pies jest wtedy chwilę "za kadrem" (dogHidden).
const BALL_G = 1150, // grawitacja [px/s²] w pikselach sceny
    BALL_THROW_GAIN = 0.65, // prędkość palca → prędkość piłki
    BALL_VMAX = 1150, // maks. prędkość wyrzutu [px/s]
    BALL_BOUNCE = 0.5, // odbicie od ziemi (część prędkości pionowej)
    BALL_BOUNCE_FRICTION = 0.82, // utrata prędkości poziomej przy odbiciu
    BALL_ROLL_DECEL = 380, // hamowanie toczenia [px/s²]
    BALL_WALL_BOUNCE = 0.3, // odbicie od ściany na końcu świata
    BALL_GRAB_R = 52, // promień "chwytu" piłki palcem
    BALL_DROP_SPEED = 90, // poniżej — to nie rzut, tylko upuszczenie (też się liczy)
    BALL_EDGE_MARGIN = 0.14; // piłka nie spoczywa tuż przy granicy pokoju
const BALL_ZONES = ["lewo-nisko", "lewo-środek", "lewo-wysoko", "góra-lewo", "góra-prawo", "prawo-wysoko", "prawo-środek", "prawo-nisko"];
let ballFlight = null; // { path, t0, tRest } — piłka w ruchu, pozycja z toru

function ballSize() {
    const im = images.ball0;
    return { w: im.width * BASE * 0.68, h: im.height * BASE * 0.68 };
}
// Dół piłki leżącej na ziemi (jak w ballDraw)
const BALL_FLOOR = () => GROUND + 10;

// Środek piłki czekającej przy łapach (ball-ready) — jak w ballDraw
function ballReadyCenter() {
    return { x: ballScreenX(), y: GROUND - 18 };
}

function ballGrabHit(px, py) {
    if (phase !== "ball-ready" || !ball || !fetchGame || ball.carried) return false;
    const c = ballReadyCenter();
    return Math.hypot(px - c.x, py - c.y) <= BALL_GRAB_R;
}

// Złapanie piłki: piesek wstaje i z radością patrzy na piłkę
function ballGrab(px, py, ts) {
    if (!ballGrabHit(px, py)) return false;
    if (fetchGame.throws >= BALL_THROWS) {
        // piłki się skończyły — złapanie od razu zaczyna nową serię
        fetchGame.throws = 0;
        fetchGame.hinted = false;
    }
    fetchGame.hold = { samples: [] };
    queue = [];
    segment = null;
    phase = "ball-held";
    bubble = null;
    startQueue([
        {
            sheet: "a01",
            anim: 17, // 18. Radość / podskok
            time: 600000,
            onStart: () => {
                phase = "ball-held";
                stage = "ball-held";
                locks();
            },
        },
    ]);
    ballHoldMove(px, py, ts);
    return true;
}

// Piłka podąża za palcem (nie wychodzi poza ekran ani pod ziemię)
function ballHoldMove(px, py, ts) {
    if (phase !== "ball-held" || !fetchGame?.hold) return;
    const { w, h } = ballSize(),
        cx = clamp(px, w / 2, W - w / 2),
        cy = clamp(py, h / 2, BALL_FLOOR() - h / 2);
    ball.room = room;
    ball.x = cx / W;
    ball.y = cy + h / 2 - BALL_FLOOR();
    left = cx < x * W; // piesek patrzy na piłkę
    const S = fetchGame.hold.samples;
    S.push({ t: ts, x: cx, y: cy });
    while (S.length > 2 && ts - S[0].t > 110) S.shift();
}

// Puszczenie piłki — prędkość z ostatnich ~100 ms ruchu palca
function ballRelease(ts, cancel = false) {
    if (phase !== "ball-held" || !fetchGame?.hold) return;
    const S = fetchGame.hold.samples;
    fetchGame.hold = null;
    let vx = 0,
        vy = 0;
    if (!cancel && S.length >= 2) {
        const a = S[0],
            b = S[S.length - 1],
            dt = Math.max(16, b.t - a.t) / 1000;
        // palec stał w miejscu przed puszczeniem → brak rzutu
        if (ts - b.t < 120) {
            vx = (b.x - a.x) / dt;
            vy = (b.y - a.y) / dt;
        }
    }
    ballLaunch(vx * BALL_THROW_GAIN, -vy * BALL_THROW_GAIN);
}

// Symulacja toru w świecie: X — px od lewej krawędzi pierwszego pokoju,
// hb — wysokość DOŁU piłki nad ziemią. Zwraca próbki co 1/120 s.
function ballSimulate(X, hb, vx, vh, rollDecel = BALL_ROLL_DECEL) {
    const { w } = ballSize(),
        minX = w / 2,
        maxX = order.length * W - w / 2,
        dt = 1 / 120,
        path = [];
    let t = 0,
        rolling = false,
        groundHits = 0;
    for (let i = 0; i < 120 * 9; i++) {
        path.push({ t: t * 1000, X, hb, vx, rolling });
        if (rolling) {
            const sgn = Math.sign(vx);
            vx -= sgn * rollDecel * dt;
            if (Math.sign(vx) !== sgn) break; // stanęła
        } else {
            vh -= BALL_G * dt;
        }
        X += vx * dt;
        hb += vh * dt;
        if (X < minX || X > maxX) {
            X = clamp(X, minX, maxX);
            vx = -vx * BALL_WALL_BOUNCE; // ściana na końcu świata
        }
        if (!rolling && hb <= 0) {
            hb = 0;
            groundHits++;
            vh = -vh * BALL_BOUNCE;
            vx *= BALL_BOUNCE_FRICTION;
            if (vh < 70) {
                vh = 0;
                rolling = true;
            }
        }
        if (rolling && Math.abs(vx) < 4) break;
        t += dt;
    }
    path.push({ t: t * 1000, X, hb: 0, vx: 0, rolling: true });
    return path;
}

function pathAt(path, tms) {
    if (tms <= 0) return path[0];
    const i = Math.min(path.length - 1, Math.floor(tms / (1000 / 120)));
    return path[i];
}

// Do której z 8 stref piłka wylatuje z pokoju, z którego ją rzucono
function ballExitZone(path, homeIdx) {
    const { w, h } = ballSize(),
        x0 = homeIdx * W;
    for (const s of path) {
        const lx = s.X - x0,
            cy = BALL_FLOOR() - s.hb - h / 2; // środek piłki na ekranie
        if (cy < -h / 2) return lx < W / 2 ? "góra-lewo" : "góra-prawo";
        if (lx < -w / 2 || lx > W + w / 2) {
            const side = lx < 0 ? "lewo" : "prawo",
                band = cy > (GROUND * 2) / 3 ? "nisko" : cy > GROUND / 3 ? "środek" : "wysoko"; // trzy pasy nieba nad ziemią
            return side + "-" + band;
        }
    }
    return null; // nie wyleciała — ląduje w tym samym pokoju
}

// Czy próbka jest widoczna w kadrze pokoju o indeksie ri
function ballVisibleIn(s, ri) {
    const { w, h } = ballSize(),
        lx = s.X - ri * W,
        cy = BALL_FLOOR() - s.hb - h / 2;
    return lx > -w / 2 && lx < W + w / 2 && cy > -h / 2;
}

function ballLaunch(vx, vh) {
    if (!ball || !fetchGame) return;
    const sp = Math.hypot(vx, vh);
    if (sp > BALL_VMAX) {
        vx *= BALL_VMAX / sp;
        vh *= BALL_VMAX / sp;
    }
    if (sp < BALL_DROP_SPEED) {
        vx = 0;
        vh = Math.min(vh, 0);
    }
    const homeIdx = order.indexOf(room),
        X0 = homeIdx * W + ball.x * W,
        hb0 = -ball.y;
    // Tor + drobna korekta TOCZENIA (niewidoczna — koniec toru), żeby piłka
    // nie stanęła tuż przy granicy pokoju ani dalej niż 2 pokoje.
    let path = null,
        restIdx = homeIdx,
        decel = BALL_ROLL_DECEL;
    for (let k = 0; k < 14; k++) {
        path = ballSimulate(X0, hb0, vx, vh, decel);
        const end = path[path.length - 1];
        restIdx = clamp(Math.floor(end.X / W), 0, order.length - 1);
        const local = end.X / W - restIdx;
        if (local >= BALL_EDGE_MARGIN && local <= 1 - BALL_EDGE_MARGIN && Math.abs(restIdx - homeIdx) <= 2) break;
        // bardzo daleki lot (> 2 pokoje): delikatnie słabszy wyrzut,
        // w pozostałych przypadkach mocniej hamuje samo toczenie
        if (Math.abs(restIdx - homeIdx) > 2 && k >= 3) vx *= 0.9;
        else decel *= 1.45;
    }
    let end = path[path.length - 1];
    // Nadal przy granicy (np. spadła prosto na nią) — dosuń ostatnie toczenie
    {
        const ri = clamp(Math.floor(end.X / W), 0, order.length - 1),
            local = clamp(end.X / W - ri, BALL_EDGE_MARGIN, 1 - BALL_EDGE_MARGIN),
            target = (ri + local) * W,
            shift = target - end.X;
        if (Math.abs(shift) > 0.5) {
            const n = Math.min(path.length, 60); // ostatnie ~0,5 s
            for (let i = 0; i < n; i++) {
                const s = path[path.length - n + i];
                path[path.length - n + i] = { ...s, X: s.X + (shift * (i + 1)) / n };
            }
        }
        restIdx = ri;
        end = path[path.length - 1];
    }
    const zone = ballExitZone(path, homeIdx),
        tRest = end.t,
        firstGround = path.find((s, i) => i > 0 && s.hb === 0)?.t ?? 0;
    fetchGame.throws++;
    fetchGame.zone = zone;
    fetchGame.restRoom = order[restIdx];
    ballFlight = { path, t0: clock, tRest };
    phase = "ball-fly";
    stage = "ball-fly";
    // piesek odprowadza piłkę wzrokiem w stronę, w którą poleciała
    const dir = Math.sign(vx) || Math.sign(end.X - X0) || (left ? -1 : 1);
    left = dir < 0;
    bubble = null;
    locks();

    const land = { room: order[restIdx], x: end.X / W - restIdx },
        parts = [];
    if (restIdx === homeIdx) {
        // Ten sam pokój: pies odprowadza piłkę wzrokiem do pierwszego
        // kontaktu z ziemią, potem biegnie, a piłka dalej się toczy.
        const look = clamp(firstGround, 250, 2200);
        parts.push({ sheet: "a01", anim: 15, facing: dir < 0, time: look, onStart: () => (stage = "ball-fly") });
        parts.push(...fetchChaseTo(land, { minTime: Math.max(0, tRest - look) }));
    } else {
        // Inny pokój: patrzy, aż piłka zniknie z kadru…
        let tLeave = 0;
        for (const s of path) if (ballVisibleIn(s, homeIdx)) tLeave = s.t;
        parts.push({ sheet: "a01", anim: 15, facing: dir < 0, time: clamp(tLeave + 150, 300, 2500), onStart: () => (stage = "ball-fly") });
        // …a w pokoju lądowania piłka "wpada" od momentu, w którym pojawia
        // się w tamtym kadrze — dokładnie jej dalszy tor.
        const tEnter = path.find((s) => ballVisibleIn(s, restIdx))?.t ?? 0,
            touch = path.find((s) => s.t > tEnter && s.hb === 0)?.t ?? tEnter,
            wait = clamp(touch - tEnter + 260, 250, Math.max(250, tRest - tEnter));
        parts.push(...fetchChaseTo(land, { replay: { tEnter, wait }, minTime: Math.max(0, tRest - tEnter - wait) }));
    }
    startQueue(parts);
}

// Pozycja piłki z toru — wołane co klatkę (ballDraw)
function ballFlightUpdate() {
    const f = ballFlight;
    if (!f || !ball || ball.carried) return;
    const s = pathAt(f.path, clock - f.t0),
        pos = worldSplit(s.X / W);
    ball.room = pos.room;
    ball.x = pos.x;
    ball.y = -s.hb;
    const { w } = ballSize();
    ball.spin += (s.vx / (Math.PI * w)) * 4 * (1000 / 60 / 1000); // obrót zgodny z toczeniem
    if (clock - f.t0 >= f.tRest) {
        ball.y = 0;
        ballFlight = null;
    }
}

// Zgodność ze starym API (panel testowy): rzut "machnięciem" dx, dy
function ballThrow(dx, dy) {
    if (phase !== "ball-ready" || !ball || !fetchGame) return;
    const c = ballReadyCenter(),
        { h } = ballSize();
    if (fetchGame.throws >= BALL_THROWS) fetchGame.throws = 0;
    ball.y = c.y + h / 2 - BALL_FLOOR();
    ballLaunch((dx / (scale || 1)) * 3, (-dy / (scale || 1)) * 3);
}

// ── Pogoń, podniesienie i powrót ──────────────────────────────
function moveParts(targetRoom, targetX, opts = {}) {
    const { speed = 235, label = "ball-chase", carry = false } = opts,
        from = order.indexOf(room),
        to = order.indexOf(targetRoom),
        dir = to >= from ? 1 : -1,
        parts = [];
    const seg = (a, b, facing, onEnd) => ({
        // Bieg: a01 „02. Bieg / sus", a z piłką — a02 „12. Aport — ruch z piłką"
        sheet: carry ? "a02" : "a01",
        anim: carry ? 11 : 1,
        tempo: 180,
        motion: "run",
        facing,
        from: a,
        to: b,
        time: Math.max(200, ((Math.abs(b - a) * W) / speed) * 1000),
        onStart: () => (stage = label),
        onEnd,
    });
    let origin = x;
    for (let i = from; i !== to; i += dir) {
        const r = order[i + dir],
            edge = dir > 0 ? 1.08 : -0.08;
        parts.push(
            seg(origin, edge, dir < 0, () => {
                setRoom(r);
                x = dir > 0 ? -0.08 : 1.08;
            })
        );
        origin = dir > 0 ? -0.08 : 1.08;
    }
    parts.push(seg(origin, targetX, targetX < origin));
    return parts;
}

// Bieg do piłki (także przez pokoje), opcjonalnie z odegraniem wpadnięcia
// piłki w pokoju lądowania (replay), potem chwyt i powrót.
function fetchChaseTo(land, opts = {}) {
    // pies wbiega od strony, z której biegnie, i staje tuż przed piłką
    const homeIdx = order.indexOf(room),
        landIdx = order.indexOf(land.room),
        fromDir = landIdx !== homeIdx ? (landIdx > homeIdx ? 1 : -1) : land.x > x ? 1 : -1,
        approach = clamp(land.x - fromDir * 0.12, 0.06, 0.94),
        run = moveParts(land.room, approach, { label: "ball-chase" }),
        last = run[run.length - 1];
    if (opts.replay) {
        // Pies jeszcze "za kadrem" (niewidoczny), piłka wpada do pokoju
        const { tEnter, wait } = opts.replay;
        run.splice(run.length - 1, 0, {
            sheet: "a01",
            anim: 15,
            facing: last.facing,
            from: last.from,
            to: last.from,
            time: wait,
            onStart: () => {
                stage = "ball-land";
                dogHidden = true;
                if (ballFlight) ballFlight.t0 = clock - tEnter; // tor od wejścia w kadr
            },
        });
        const lastOnStart = last.onStart;
        last.onStart = () => {
            dogHidden = false;
            lastOnStart?.();
        };
    }
    // pies dobiega nie wcześniej, niż piłka się zatrzyma
    if (opts.minTime) last.time = Math.max(last.time, opts.minTime + 120);
    return [...run, ballPickupPart(fromDir)];
}

// Chwyt piłki — 24. Aport_001_chwyt_pilki (kończy się pozą z piłką w pysku,
// więc od razu można ruszać w drogę powrotną)
function ballPickupPart(fromDir) {
    return {
        sheet: "a02",
        anim: 23,
        time: duration("a02", 23),
        facing: fromDir < 0, // pies patrzy w stronę piłki
        onStart: () => {
            stage = "ball-pickup";
            ballFlight = null;
            say("heart", 1800);
        },
        onEnd: () => {
            ball.carried = true;
            ball.y = 0;
            // Powrót z piłką — trasę liczymy dopiero teraz
            if (!fetchGame) return;
            queue = [
                ...moveParts(fetchGame.homeRoom, fetchGame.homeX, {
                    speed: 215,
                    label: "ball-back",
                    carry: true,
                }),
                ballDropPart(),
            ];
        },
    };
}

// 4. Położenie piłki i gotowość na kolejny rzut
function ballDropPart() {
    return {
        sheet: "a02",
        anim: 13, // 14. Piłka — trzymanie i opuszczanie
        time: duration("a02", 13),
        onStart: () => (stage = "ball-drop"),
        onEnd: () => {
            if (!ball || !fetchGame) return;
            ball.carried = false;
            ball.room = room;
            ball.x = clamp(x + (left ? -0.19 : 0.19), 0.12, 0.88);
            ball.y = 0;
            changeNeeds(ACTION_EFFECTS.throw);
            save();
            // Zawsze z powrotem w pozę warowania — nawet po ostatnim rzucie.
            // Zabawa kończy się dopiero przyciskiem końca albo (po dłuższej
            // chwili bez rzutu) automatycznie, w ballReadySegment().
            queue = [ballReadySegment()];
        },
    };
}

// Etapy, w których piłka jest już wrysowana w sprite Łatki —
// wtedy osobnej piłki NIE rysujemy, żeby nie było dwóch naraz
// UWAGA: "ball-ready" jest tu celowo POMINIĘTE, bo wtedy rysujemy
// piłkę osobno (z animowaną ramką zachęcającą do swipe'a).
const SPRITE_HAS_BALL = ["ball-pickup", "ball-back", "ball-drop"];

// Rysowanie piłki — w locie, na ziemi i podczas oczekiwania na rzut
// (z animowaną ramką zachęcającą do swipe'a podczas ball-ready)
function ballDraw() {
    ballFlightUpdate();
    if (!ball || ball.carried || SPRITE_HAS_BALL.includes(stage)) return;
    if (Math.abs(order.indexOf(ball.room) - order.indexOf(room)) > 1) return;
    const n = ((Math.floor(ball.spin) % 4) + 4) % 4,
        im = images["ball" + n];
    if (!im) return;
    const w = im.width * BASE * 0.68, // +5% względem poprzedniego rozmiaru
        h = im.height * BASE * 0.68;
    const bx = ballScreenX() - w / 2,
        // Podczas "ball-ready" celujemy dokładnie w piłkę z animacji "warowanie"
        // (wyliczone z pikseli sprite'a: środek ~18px nad linią chodzenia).
        by =
            stage === "ball-ready"
                ? GROUND - 18 - h / 2 + ball.y
                : GROUND + 10 + ball.y - h; // piłka leży na ziemi (10px poniżej linii chodzenia)

    ctx.drawImage(im, bx, by, w, h);

    // Animowana ramka zachęcająca do rzutu (pulsująca) — tylko podczas oczekiwania
    if (stage === "ball-ready") {
        const pulse = 0.5 + 0.5 * Math.sin(clock / 220),     // 0..1, ~2.8 Hz
            expand = 4 + pulse * 8,                             // 4..12 px poza piłką
            alpha = 0.4 + pulse * 0.55,                         // 0.4..0.95
            r = Math.max(w, h) / 2 + expand,
            cx = bx + w / 2,
            cy = by + h / 2;
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "rgba(255,255,255,0.7)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

