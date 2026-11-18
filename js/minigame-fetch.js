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
    toast("Przesuń palcem po ekranie — rzuć piłkę Łatce!");
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
                toast("Przesuń palcem — Łatka czeka na rzut!");
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

// ── Rzut ──────────────────────────────────────────────────────
// Piłka leci widocznym łukiem przez pokój Łatki i "wylatuje" przez
// drzwi (staje się niewidoczna, gdy jej światowa pozycja przechodzi
// do sąsiedniego pokoju — kamera tam jeszcze nie jest). Resztę —
// opadnięcie, odbicie i toczenie do właściwego miejsca — odgrywamy
// jako OSOBNĄ scenkę dokładnie w momencie, gdy Łatka faktycznie
// wbiega do pokoju z piłką (patrz fetchChaseParts), tak jak motylek
// w butterflyEvent().
function ballThrow(dx, dy) {
    if (phase !== "ball-ready" || !ball || !fetchGame) return;
    if (fetchGame.throws >= BALL_THROWS) {
        // Piłki się skończyły — ten sam ruch, który byłby rzutem, odnawia
        // licznik I OD RAZU leci jako pierwszy rzut nowej serii (bez
        // dodatkowego, "zgubionego" machnięcia).
        fetchGame.throws = 0;
        fetchGame.hinted = false;
    }
    const swipe = dx / (scale || 1),
        dir = Math.abs(swipe) < 10 ? (left ? -1 : 1) : swipe < 0 ? -1 : 1,
        power = clamp(Math.abs(swipe) / W, 0.18, 1),
        nextIdx = order.indexOf(ball.room) + dir,
        hasNextRoom = nextIdx >= 0 && nextIdx < order.length,
        // Piłka zawsze leci "na drugą planszę" — do sąsiedniego pokoju,
        // lądując przy DALEKIM końcu (żeby pies miał po co biec przez cały pokój).
        // Jeśli to już ostatni pokój w tę stronę — piłka odbija się od ściany.
        land = hasNextRoom
            ? {
                  room: order[nextIdx],
                  // Bliżej krawędzi — animacja chwytu ma pysk wysunięty
                  // trochę dalej do przodu.
                  x: dir > 0
                      ? clamp(0.80 + power * 0.10, 0.80, 0.92)  // daleki koniec, piłka
                      : clamp(0.20 - power * 0.10, 0.08, 0.20), // daleki koniec, piłka
              }
            : { room: ball.room, x: clamp(ball.x + dir * 0.3, 0.1, 0.9) },
        // Punkt, z którego piłka dotacza się do właściwego miejsca (land)
        // podczas scenki upadku — odrobinę bliżej środka pokoju.
        impact = { room: land.room, x: clamp(land.x - dir * 0.06, 0.04, 0.96) },
        start = worldOf(ball.room, ball.x);

    fetchGame.throws++;
    phase = "ball-fly";
    left = dir < 0;
    bubble = null;
    locks();

    // Mocniejszy rzut = szybszy i wyższy łuk — trochę wolniej niż wcześniej,
    // żeby tempo pasowało do opadania w drugim pokoju (FALL w fetchChaseParts).
    const flightTime = clamp(760 - power * 260, 460, 760),
        arc = 130 + power * 120;

    startQueue([
        // Piłka leci widocznym łukiem, Łatka odprowadza ją wzrokiem —
        // widoczna tylko dopóki jest w aktualnym pokoju (potem "wylatuje"
        // przez drzwi i staje się niewidoczna aż Łatka tam dobiegnie).
        {
            sheet: "a01",
            anim: 15, // 16. Patrzenie w górę / łapa
            facing: dir < 0,
            time: flightTime,
            onStart: () => (stage = "ball-fly"),
            update: (p) => {
                const w = start + (worldOf(impact.room, impact.x) - start) * p,
                    pos = worldSplit(w);
                ball.room = pos.room;
                ball.x = pos.x;
                ball.y = -Math.sin(Math.PI * p) * arc;
                ball.spin += dir * 2.2; // widoczne wirowanie w locie
            },
            onEnd: () => {
                // Piłka "jest" już w miejscu lądowania — wysoko w powietrzu,
                // gotowa do opadnięcia w scence odgrywanej w fetchChaseParts().
                ball.room = impact.room;
                ball.x = impact.x;
                ball.y = -140;
            },
        },
        // Pogoń + podniesienie + powrót. Upadek/odbicie/toczenie piłki
        // dogrywane są w segmencie, w którym Łatka wbiega do pokoju z piłką.
        ...fetchChaseParts(land, impact),
    ]);
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

function fetchChaseParts(land, impact) {
    const parts = [];
    // 1. Bieg do piłki — pies wbiega z bliższego końca pokoju i zatrzymuje
    //    się tuż przy piłce (która jest przy dalekim końcu).
    //    Zatrzymujemy się po stronie, z której pies nadbiegł (skąd rzucono).
    // Pies wbiega z bliższej strony pokoju i zatrzymuje się tuż przed piłką.
    // offset: pies staje tak, że piłka jest przy jego przednich łapach.
    // Zwiększone z 0.08 — dog zatrzymuje się trochę dalej od krawędzi,
    // żeby animacja chwytu miała więcej dystansu na "dosięgnięcie" piłki.
    const fromDir = land.x > 0.5 ? -1 : 1; // pies wbiega z lewej (1) lub prawej (-1)
    const approach = clamp(land.x + fromDir * 0.12, 0.06, 0.94);
    const run = moveParts(land.room, approach, { label: "ball-chase" });
    // Piłka opada i odbija się w pokoju lądowania, ZANIM Łatka się tam
    // pojawi — pies jest na ten czas niewidoczny (jeszcze "za kadrem"),
    // a wbiega dopiero, gdy piłka dotknie ziemi (resztkę toczenia piłki
    // dogrywamy już podczas jego dobiegu — tak jak motyl lecący, gdy
    // piesek robi coś innego w butterflyEvent()). Czasy scenek są
    // WŁASNE (oparte na zegarze gry), nie rozciągane/ściskane do
    // długości biegu.
    if (impact) {
        const last = run[run.length - 1],
            fromX = impact.x,
            toX = land.x,
            dir = toX > fromX ? 1 : -1,
            // Opadanie zaczyna się od strony drzwi, z której piłka "wleciała"
            // (ten sam kierunek co w rzucie) — żeby to wyglądało jak ciąg
            // tego samego łuku, a nie nowa, osobna animacja od środka pokoju.
            fallStartX = dir > 0 ? -0.08 : 1.08,
            // Opadanie + dwa gasnące odbicia (jak prawdziwa piłka), potem
            // krótkie, zwalniające dotoczenie podczas dobiegu psa.
            FALL = 460,
            FALL_HEIGHT = 196, // -15%
            BOUNCE1 = 200,
            BOUNCE1_HEIGHT = 60,
            BOUNCE2 = 150,
            BOUNCE2_HEIGHT = 34,
            WAIT_TOTAL = FALL + BOUNCE1 + BOUNCE2,
            ROLL = 380;

        // Etap 1: pies jest niewidoczny (jeszcze nie wbiegł) — piłka opada
        // (przyspieszając, jak w swobodnym spadku), odbija się dwa razy,
        // coraz niżej, a poziomo cały czas płynnie sunie w stronę fromX.
        const wait = {
            sheet: "a01",
            anim: 15,
            facing: last.facing,
            from: last.from,
            to: last.from,
            time: WAIT_TOTAL,
            onStart: () => {
                stage = "ball-land";
                dogHidden = true;
            },
            update: (p) => {
                const t = p * WAIT_TOTAL;
                ball.room = land.room;
                ball.x = fallStartX + (fromX - fallStartX) * p;
                if (t < FALL) {
                    const fp = t / FALL;
                    ball.y = -FALL_HEIGHT * (1 - fp * fp); // przyspieszający spadek
                    ball.spin += dir * 2.2;
                } else if (t < FALL + BOUNCE1) {
                    const bp = (t - FALL) / BOUNCE1;
                    ball.y = -Math.abs(Math.sin(Math.PI * bp)) * BOUNCE1_HEIGHT;
                    ball.spin += dir * 0.5;
                } else {
                    const bp = (t - FALL - BOUNCE1) / BOUNCE2;
                    ball.y = -Math.abs(Math.sin(Math.PI * bp)) * BOUNCE2_HEIGHT;
                    ball.spin += dir * 0.3;
                }
            },
            onEnd: () => {
                ball.x = fromX;
                ball.y = 0;
            },
        };
        run.splice(run.length - 1, 0, wait);

        // Pies staje się widoczny dokładnie w momencie, gdy zaczyna wbiegać.
        const lastOnStart = last.onStart;
        last.onStart = () => {
            dogHidden = false;
            lastOnStart?.();
        };

        // Etap 2: dopiero teraz pies rusza — piłka dotacza się (bez
        // podskakiwania, przy ziemi) do punktu lądowania, ZWALNIAJĄC
        // (ease-out) jak przy wytracaniu pędu przez tarcie o trawę.
        const scale = Math.min(1, last.time / ROLL);
        let rollStart = null;
        last.update = () => {
            if (rollStart === null) rollStart = clock;
            const t = (clock - rollStart) / scale;
            if (t < ROLL) {
                const rp = t / ROLL,
                    eased = 1 - (1 - rp) * (1 - rp);
                ball.x = fromX + (toX - fromX) * eased;
                ball.y = 0;
                ball.spin += dir * 0.25 * (1 - rp);
            } else {
                ball.room = land.room;
                ball.x = toX;
                ball.y = 0;
            }
        };
    }
    parts.push(...run);

    // 2. Chwyt piłki — 24. Aport_001_chwyt_pilki (kończy się pozą z piłką w pysku,
    //    więc od razu można ruszać w drogę powrotną, bez dodatkowego postoju)
    parts.push({
        sheet: "a02",
        anim: 23,
        time: duration("a02", 23),
        facing: fromDir > 0, // pies patrzy w kierunku z którego wbiegł (w stronę piłki)
        onStart: () => {
            stage = "ball-pickup";
            say("heart", 1800);
        },
        onEnd: () => {
            ball.carried = true;
            ball.y = 0;
            // 3. Powrót z piłką — trasę liczymy dopiero teraz, bo Łatka mogła
            //    w międzyczasie przebiec do innego pokoju
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
    });
    return parts;
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

