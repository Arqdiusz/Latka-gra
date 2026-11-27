"use strict";
// Wczytywanie grafik, boot(), globalne nasłuchiwacze (pełny ekran, widoczność karty).
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// Grafiki wczytują się RÓWNOLEGLE (boot() uruchamia je wszystkie naraz), a
// kolejne wywołania loadImage() dla tego samego adresu dostają ten sam wynik.
const imgCache = new Map();
function loadImage(src) {
    if (!imgCache.has(src)) imgCache.set(src, loadImageNow(src));
    return imgCache.get(src);
}
// Adres grafiki = ścieżka + wersja grafik (window.ART_V, ustawiana w index.html). Dzięki temu
// grafika zostaje w pamięci przeglądarki, a po jej zmianie wystarczy podbić ART_V.
const artUrl = (s) => (window.artUrl ? window.artUrl(s) : s);
async function loadImageNow(src) {
    const url = artUrl(src),
        shared = window.artImgs && window.artImgs[url]; // ten sam plik już pobrał ekran wczytywania
    if (shared) {
        if (!shared.complete)
            await new Promise((ok) => {
                shared.addEventListener("load", ok, { once: true });
                shared.addEventListener("error", ok, { once: true });
            });
        if (shared.naturalWidth) return shared;
    }
    const im = new Image();
    await new Promise((ok, bad) => {
        im.onload = ok;
        im.onerror = () => bad(Error("Nie można odczytać grafiki."));
        im.src = url;
    });
    return im;
}

// Szuka w danych klatki (RGBA, w×h) nasyconego zielonego znacznika #00ff43
// wstawionego ręcznie przez artystę jako miejsce na motylka — wartość ta
// jest bardzo odległa od naturalnej palety pieska (brązy/beże/różowe/biel/
// czerń), więc szeroka tolerancja jest bezpieczna. Zwraca środek
// bounding-boxa w lokalnych pikselach klatki (albo null, jeśli nic nie
// znaleziono) i PO DRODZE czyści dopasowane piksele (alpha=0), żeby
// znacznik nie był widoczny w finalnej grafice.
function extractMarker(data, w, h) {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity,
        found = false;
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            const idx = (py * w + px) * 4,
                r = data[idx],
                g = data[idx + 1],
                b = data[idx + 2],
                a = data[idx + 3];
            if (a > 100 && r < 60 && g > 180 && b < 110) {
                found = true;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
                data[idx + 3] = 0;
            }
        }
    }
    return found ? { x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 } : null;
}
async function boot() {
    // Załaduj konfigurację z osobnego pliku
    // cache:"no-cache" — przeglądarka zawsze sprawdza, czy plik się zmienił,
    // więc po wgraniu nowego JSON-a zmiany widać bez czyszczenia cache
    const fresh = (u) => fetch(u, { cache: "no-cache" }).then((r) => r.json());
    const lp = (v) => window.loadScreen?.progress(v);
    lp(0.04);
    P = await fresh("data/config.json");
    lp(0.1);
    // Załaduj animacje z plików edytora (data/animations/)
    // — te pliki są źródłem prawdy; config.json trzyma resztę ustawień
    const [anim01, anim02, anim03, motyleAnim, kretAnim, hedgehogAnim, hedgehogGameAnim, skel] = await Promise.all([
        fresh("data/animations/latka-animacje-01.json"),
        fresh("data/animations/latka-animacje-02.json"),
        fresh("data/animations/latka-animacje-03.json"), // kopanie kostek (mini gra z liczeniem)
        fresh("data/animations/motyle-001-animacje.json"),
        fresh("data/animations/kret-animacje.json"),
        fresh("data/animations/hedgehog-animacje.json"),
        fresh("data/animations/hedgehog-game-animacje.json"),
        fresh("data/animations/szkielet.json").catch(() => null), // punkty łap/nosa/ogona (brud na łapkach)
    ]);
    skeleton = skel;
    lp(0.16);
    // Wszystkie grafiki naraz (tła pokoi też — żeby nic nie "doskakiwało" w grze);
    // pasek ładowania rośnie z każdą wczytaną grafiką.
    // pokój, w którym zaczynamy, i sąsiednie (widać je przy przejściu) — czekamy na nie; resztę dociągamy w tle
    const nearRooms = () => {
        const i = order.indexOf(room);
        return order.slice(Math.max(0, i - 1), i + 2);
    };
    {
        const a = P.assets,
            urls = ["assets/sprites/latka-animacje-03.webp", "assets/sprites/naczynia.webp", "assets/sprites/star-check.webp", "assets/sprites/szmatka.webp", a.a01, a.a02, a.ui, a.poop, a.motyle, a.kret, a.hedgehog, a.hedgehogGame, a.bubbleStar, a.bubbleWrong, ...(a.balls || []), ...(a.bubbles || []), ...nearRooms().map(roomSrc)].filter(Boolean);
        let done = 0;
        window.bootImages = Promise.all(
            urls.map((u) =>
                loadImage(u).then(() => {
                    done++;
                    lp(0.16 + 0.78 * (done / urls.length));
                })
            )
        );
    }
    CFG = P.config;
    CFG.a01 = anim01;
    CFG.a02 = anim02;
    CFG.a03 = anim03;
    CFG.motyle = motyleAnim;
    CFG.kret = kretAnim;
    CFG.hedgehog = hedgehogAnim;
    CFG.hedgehogGame = hedgehogGameAnim;
    UI = CFG.ui;
    for (const k of ["a01", "a02", "ui", "poop"]) images[k] = await loadImage(P.assets[k]);
    images.a03 = await loadImage("assets/sprites/latka-animacje-03.webp");
    images.dish = await loadImage("assets/sprites/naczynia.webp");
    images.sparkle = await loadImage("assets/sprites/star-check.webp");
    images.cloth = await loadImage("assets/sprites/szmatka.webp");
    // Cały butterflyEvent() lata jedną, spójną grafiką z motyle-new
    // (patrz eventButterflyCell()); dawne motyl-1/motyl-2 zostały w archiwum.
    if (P.assets.motyle) {
        // Arkusz motyle-001.png: siatka cols×rows (patrz CFG.motyle), po
        // jednym wierszu na kolor — tniemy na osobne klatki, tak jak banki
        // niżej. Używane na razie do motylków-tła w ogrodzie/podwórku
        // (ambientDraw/ambientUpdate); później też do nowej mini-gry.
        images.motyle = await loadImage(P.assets.motyle);
        const { cols, rows } = CFG.motyle,
            mw = images.motyle.width / cols,
            mh = images.motyle.height / rows;
        for (let f = 0; f < cols * rows; f++) {
            const c = document.createElement("canvas");
            c.width = mw;
            c.height = mh;
            c.getContext("2d").drawImage(images.motyle, (f % cols) * mw, Math.floor(f / cols) * mh, mw, mh, 0, 0, mw, mh);
            cells.motyle.push(c);
        }
    }
    if (P.assets.kret) {
        // Arkusz kret.png: siatka 4×4 (patrz CFG.kret) — tniemy tak samo jak
        // motyle-new.png. Używane do zapowiedzi "kreta w ogrodzie" (ambient,
        // patrz moleTeaserSpawn/Update/Draw) i do pełnej mini-gry w kreta
        // (js/minigame-mole.js).
        images.kret = await loadImage(P.assets.kret);
        const { cols, rows } = CFG.kret,
            kw = images.kret.width / cols,
            kh = images.kret.height / rows;
        for (let f = 0; f < cols * rows; f++) {
            const c = document.createElement("canvas");
            c.width = kw;
            c.height = kh;
            c.getContext("2d").drawImage(images.kret, (f % cols) * kw, Math.floor(f / cols) * kh, kw, kh, 0, 0, kw, kh);
            cells.kret.push(c);
        }
    }
    // Jeżyk: arkusz spaceru (3×4) i arkusz słodyczy/owoców (4×2) — oba tniemy
    // na osobne klatki. Spacerujący jeżyk: patrz hedgehogUpdate/Draw.
    for (const key of ["hedgehog", "hedgehogGame"]) {
        if (!P.assets[key]) continue;
        images[key] = await loadImage(P.assets[key]);
        const { cols, rows } = CFG[key],
            cw = images[key].width / cols,
            ch = images[key].height / rows;
        for (let f = 0; f < cols * rows; f++) {
            const c = document.createElement("canvas");
            c.width = cw;
            c.height = ch;
            c.getContext("2d").drawImage(images[key], (f % cols) * cw, Math.floor(f / cols) * ch, cw, ch, 0, 0, cw, ch);
            cells[key].push(c);
        }
    }
    if (P.assets.balls)
        for (let i = 0; i < P.assets.balls.length; i++)
            images["ball" + i] = await loadImage(P.assets.balls[i]);
    if (P.assets.bubbles) {
        // Dwa arkusze baniek — każdy to siatka 4x5 (64x64), 20 różnych
        // kształtów/wariantów. Tniemy je na osobne obrazki, żeby losowo
        // wybierać dowolną z 40 baniek (chaos, jak prosił użytkownik).
        for (const src of P.assets.bubbles) {
            const im = await loadImage(src),
                cols = 4,
                rows = 5,
                w = im.width / cols,
                h = im.height / rows;
            for (let f = 0; f < cols * rows; f++) {
                const c = document.createElement("canvas");
                c.width = w;
                c.height = h;
                c.getContext("2d").drawImage(im, (f % cols) * w, Math.floor(f / cols) * h, w, h, 0, 0, w, h);
                cells.bubbles.push(c);
            }
        }
    }
    if (P.assets.bubbleStar) images.bubbleStar = await loadImage(P.assets.bubbleStar);
    if (P.assets.bubbleWrong) images.bubbleWrong = await loadImage(P.assets.bubbleWrong);
    for (const key of ["a01", "a02", "a03", "ui"]) {
        const rows = key === "ui" ? 6 : 12,
            im = images[key],
            w = im.width / 6,
            h = im.height / rows;
        for (let f = 0; f < rows * 6; f++) {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const cx = c.getContext("2d");
            cx.drawImage(im, (f % 6) * w, Math.floor(f / 6) * h, w, h, 0, 0, w, h);
            if (key === "a02") {
                // Klatki biorące udział w butterflyEvent() mają wstawiony
                // zielony znacznik (#00ff43) w miejscu, gdzie ma się
                // pojawić motylek — wykrywamy go, zapamiętujemy środek
                // i usuwamy z finalnej grafiki (patrz catchMarkerPos()).
                const imgData = cx.getImageData(0, 0, w, h),
                    marker = extractMarker(imgData.data, w, h);
                if (marker) {
                    catchMarker[f + 1] = marker;
                    cx.putImageData(imgData, 0, 0);
                }
            }
            cells[key].push(c);
            if (key !== "ui") pixels[key].push(cx.getImageData(0, 0, w, h).data);
        }
    }
    // Arkusz a03 (kopanie kostek) nie ma gotowych „meta” w config.json —
    // liczymy ramkę (box) i miejsce głowy (head) z pikseli, jak dla a01/a02.
    if (!P.meta.a03)
        P.meta.a03 = pixels.a03.map((d, i) => {
            const w = cells.a03[i].width,
                h = cells.a03[i].height;
            let x0 = w,
                y0 = h,
                x1 = 0,
                y1 = 0;
            for (let y = 0; y < h; y++)
                for (let xx = 0; xx < w; xx++)
                    if (d[(y * w + xx) * 4 + 3] > 120) {
                        if (xx < x0) x0 = xx;
                        if (xx > x1) x1 = xx;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
            if (x1 < x0) return { box: [4, 32, 124, 116], head: [95.2, 34] };
            return { box: [x0, y0, x1 + 1, y1 + 1], head: [x0 + 0.76 * (x1 + 1 - x0), y0 + 2] };
        });
    for (const [key, n] of Object.entries(UI.map)) icons[key] = cells.ui[n - 1].toDataURL("image/png");
    loadNeeds();
    statusBuild();
    statusUpdate();
    const root = $(".menu");
    for (const name of ["pointerdown", "keydown", "click"])
        root.addEventListener(
            name,
            (e) => {
                // Dotknięcie menu przerywa AUTONOMICZNY bieg pieska (jego własny
                // pomysł) — inaczej menu, w tym puchar z grami, byłoby martwe.
                if (!casual() && phase === "travel" && travelMode === "auto") idle(16);
                if (!casual()) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                if (name !== "click") {
                    interrupt();
                    wake();
                }
            },
            true
        );
    menu = new ArcCarousel(root, {
        items: items.map((i) => ({
            ...i,
            svg: '<img alt="" src="' + icons[i.icon] + '">',
        })),
        selectedId: items.some((i) => i.id === selected) ? selected : "sleep",
    });
    root.addEventListener("arc:change", (e) => (selected = e.detail.id));
    root.addEventListener("arc:activate", (e) => action(e.detail.id));
    // Szybki dostęp do gier — puchar w górnym pasku sceny.
    $(".gamesAccess img").src = icons.cup;
    $(".gamesAccess").onclick = () => action("games");
    lp(0.98);
    loaded = true;
    setRoom(room);
    setAnim(sleeping ? "a02" : "a01", sleeping ? 6 : 16);
    if (dirty()) say("poop", 4000);
    // Gra gotowa — ekran ładowania pokazuje duży przycisk i czeka na dotknięcie
    // (to też gest potrzebny do pełnego ekranu). Dopiero potem rusza pętla gry.
    if (window.loadScreen) await window.loadScreen.ready();
    // pozostałe pokoje: pobranie w tle po starcie (bez trzymania w pamięci — potem wczyta je cache przeglądarki)
    setTimeout(() => {
        for (const r of order) if (!nearRooms().includes(r)) new Image().src = artUrl(roomSrc(r));
    }, 2500);
    window.gameStarted = true;
    $(".load").hidden = true;
    locks();
    resize();
    save();
    requestAnimationFrame(loopFrame);
}
$(".full").onclick = async () => {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) await document.exitFullscreen();
            else document.webkitExitFullscreen?.();
            return;
        }
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else return; // pełny ekran niedostępny — po cichu
        try {
            if (screen.orientation?.lock) await screen.orientation.lock("portrait");
            else throw Error();
        } catch (e) {
            /* brak blokady obrotu — trudno, gra i tak ma ekran „obróć telefon” */
        }
    } catch (e) {
        /* przeglądarka nie pozwoliła na pełny ekran — po cichu */
    }
};
window.addEventListener("pagehide", save);
// Strona przywrócona z pamięci podręcznej przeglądarki (np. iOS "wstecz"/powrót do karty)
window.addEventListener("pageshow", (e) => {
    if (e.persisted && loaded) location.reload();
});
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
    last = 0;
    if (!document.hidden) {
        // Powrót do okna (np. po zminimalizowaniu na telefonie). Po dłuższej przerwie
        // system mógł zamrozić stronę / zgubić płótno — odświeżamy grę (stan jest zapisany).
        if (loaded && hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) {
            location.reload();
            return;
        }
        // Zabezpieczenie: pies nie może zostać "schowany", gdy nie trwa już żaden aport
        if (loaded && dogHidden && !fetchGame) dogHidden = false;
        if (loaded) {
            x = clamp(x, 0, 1);
            resize();
        }
    } else hiddenAt = Date.now();
    if (document.hidden) {
        save();
        if (gesture?.kind === "pet") stopPetting();
        gesture = null;
    }
});
window.addEventListener("error", (e) => {
    window.loadScreen?.error("Błąd wersji testowej: " + e.message);
});
boot().catch((e) => {
    window.loadScreen?.error(e.message);
});
window.gameTest = {
    state: () => ({
        loaded,
        room,
        x,
        left,
        phase,
        stage,
        travelMode,
        sheet,
        anim,
        frame: currentFrame(),
        actions,
        trips,
        sleeping,
        selected,
        stats,
        heart: heart(),
        poop,
        dirty: !!dirty(),
        moleTeaser,
        moleDirts,
        blockedActivity,
        scale,
        orientationPaused,
        butterfly,
        butterflyVisible: !!butterfly?.visible,
        ball,
        fetchGame,
        bubble,
        bubblePos,
        route: debugRoute,
        roomOffset,
        segmentTime: segment?.time,
        segmentMotion: segment?.motion || null,
        gesture: gesture?.kind || null,
        sceneH: SH,
        ground: GROUND,
        dogBase: BASE,
    }),
    step: stepRoom,
    action,
    touch: react,
    poop: spawnPoop,
    butterfly: butterflySpawn,
    butterflyCatch,
    fetchStart: (...a) => fetchStart(...a),
    throwBall: (...a) => ballThrow(...a),
    confirmBallIntro: () => $(".ballOk").click(),
    walk: localWalk,
    hit: petHit,
    head: headPosition,
    poopRect,
    clean: cleanPoop,
    moleDirtRect,
    cleanMoleDirt,
    moleTeaserSpawn,
    advance: (n) => (clock += n),
    forceVariant: (v) => (forcedVariant = v),
    select: (id, animate = false) =>
        menu.select(id, {
            animate,
        }),
    at: (r, pos = 0.5) => {
        gesture = null;
        queue = [];
        segment = null;
        butterfly = null;
        $(".popup").hidden = true;
        sleeping = false;
        x = pos;
        phase = "idle";
        setRoom(r);
        idle(16);
        nextPoop = clock + 45000;
        nextTrip = clock + 15000;
        nextButterfly = clock + 28000;
    },
    needs: (s) => {
        Object.assign(stats, s);
        statusUpdate();
        syncMenu();
    },
    petStart: startPetting,
    petEnd: stopPetting,
    menu: () => menu,
    putPoop: (r, pos = 0.3) => {
        poop = {
            room: r,
            x: pos,
        };
        updatePoopAccess();
        save();
    },
    clearPoop: () => {
        poop = null;
        updatePoopAccess();
        save();
    },
    putMoleDirt: (r, spotIdx = 0) => {
        const spot = MOLE_TEASER_SPOTS[spotIdx];
        moleDirts[r] = { x: spot.x / W, y: spot.y };
        updateMoleDirtAccess();
        save();
    },
    clearMoleDirt: () => {
        moleDirts = {};
        updateMoleDirtAccess();
        save();
    },
};
