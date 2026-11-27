"use strict";
// Piesek: szczekanie, głaskanie, geometria i rysowanie, brud na sierści i łapkach.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// ── Szczekanie (a03 „07. Szczeknięcie”, „08. Wesołe hau”, „09. Grzeczne hau”) ──
// Dźwięk pada na klatce, w której pysk się otwiera. Podwójne „hau, hau” = dwa
// krótkie szczeknięcia pod rząd. Piesek szczeka sam z siebie (dymek
// „szczekanie”, czasem przy samodzielnym zachowaniu), grzecznie prosi, gdy
// czegoś mu brakuje (dymek z potrzebą), i wesoło po dotknięciu.
const BARK = { hau: [6, "bark"], happy: [7, "barkHappy"], soft: [8, "barkSoft"] },
    BARK_CLOSED = 25;
function barkParts(kind, times = 1) {
    const [anim, snd] = BARK[kind],
        pre = CFG.a03.presets[anim],
        seq = numbers(pre.seq),
        opens = seq.map((f, i) => (f !== BARK_CLOSED && (i === 0 || seq[i - 1] === BARK_CLOSED) ? i : -1)).filter((i) => i >= 0),
        parts = [];
    for (let t = 0; t < times; t++)
        parts.push({
            sheet: "a03",
            anim,
            time: seq.length * pre.ms,
            onStart: () => opens.forEach((i) => setTimeout(() => phase === "bark" && sfx(snd), i * pre.ms)),
        });
    return parts;
}
function bark(kind = "hau", times = 1) {
    if (!casual() || sleeping || sadNeed() || dogHidden) return false;
    interrupt();
    phase = "bark";
    stage = "bark-" + kind;
    locks();
    startQueue(barkParts(kind, times));
    return true;
}

function startPetting() {
    if (!canPet()) return;
    if (sadBlocks("pet")) return sadRefuse();
    if (phase !== "petting") {
        interrupt();
        wake();
        phase = "petting";
        queue = [];
        segment = null;
        setFrames("a01", [39, 40, 39, 40, 45], 280);
        anim = 10;
        locks();
        say("heart", 5000);
    }
    petLast = clock;
    petFinishAt = Infinity;
}

function stopPetting() {
    if (phase !== "petting") return;
    const cycle = frames.length * ms;
    petFinishAt = clock + (cycle - ((clock - animStart) % cycle));
}

function endPetting() {
    phase = "reaction";
    startQueue([
        {
            sheet: "a01",
            frames: [46],
            tempo: 250,
            time: 250,
        },
    ]);
}

function geometry() {
    const f = currentFrame(),
        o = {
            x: 0,
            y: 0,
            scale: 100,
            ...CFG[sheet].offsets[String(f)],
        };
    return {
        f,
        o,
        s:
            ((BASE * o.scale) / 100) *
            (sheet === "a01" && anim === 1 ? 1.04 : 1) *
            (sheet === "a01" && anim === 10 ? 1.05 : 1) *
            (sheet === "a01" && (anim === 5 || anim === 2) ? 1.1 : 1) * // jedzenie i picie: piesek o 10% większy
            0.7,
        w: cells[sheet][f - 1].width,
        h: cells[sheet][f - 1].height,
        g: CFG[sheet].ground,
    };
}

function drawDog(c, cx = x * W, gy = GROUND + jumpY, facing = left, ratio = 1) {
    const g = geometry();
    c.save();
    c.translate(cx, gy);
    if (facing) c.scale(-1, 1);
    c.translate(g.o.x * BASE * ratio, g.o.y * BASE * ratio);
    c.scale(g.s * ratio, g.s * ratio);
    c.imageSmoothingEnabled = false;
    c.drawImage(cells[sheet][g.f - 1], -g.w / 2, -g.g);
    const fl = furLevel();
    if (fl > 0.02) c.drawImage(furOverlay(sheet, g.f, Math.max(1, Math.round((fl / FUR_MAX) * FUR_STEPS))), -g.w / 2, -g.g);
    if (pawDirt >= 4) {
        c.translate(-g.w / 2, -g.g);
        pawDirtDraw(c, sheet, g.f, pawDirt / 100);
    }
    c.restore();
}

// ── Brud na sierści (zależny od czystości) ──────────────────────
// Liczony z samej klatki, bez dodatkowych grafik: zaschnięte błoto narasta od
// dolnych krawędzi (brzuszek, łapki od spodu) w górę, z nierównym, plamistym
// brzegiem (szum) i jaśniejszymi okruchami. Obrys zostaje czysty, cieniowanie
// sierści prześwituje. 8 poziomów, każdy jako gotowa nakładka (cache).
// Czystość 65 → brak brudu, 15 i mniej → najmocniej. Kąpiel (100) zmywa.
const FUR_MUD = [146, 108, 68],
    FUR_DRY = [200, 166, 116],
    FUR_STEPS = 8,
    FUR_MAX = 1.05,
    furPixCache = {},
    furOverCache = {};
let furGrid = null;
function furLevel() {
    return clamp((65 - stats.clean) / 50, 0, FUR_MAX);
}
function furNoise(x, y) {
    if (!furGrid) {
        let seed = 777;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        furGrid = Array.from({ length: 64 * 64 }, rnd);
    }
    const G = 6,
        gx = x / G,
        gy = y / G,
        i = Math.floor(gx),
        j = Math.floor(gy),
        s = (t) => t * t * (3 - 2 * t),
        fx = s(gx - i),
        fy = s(gy - j),
        v = (a, b) => furGrid[(((b + 64) % 64) * 64 + ((a + 64) % 64)) | 0],
        a = v(i, j) * (1 - fx) + v(i + 1, j) * fx,
        b = v(i, j + 1) * (1 - fx) + v(i + 1, j + 1) * fx;
    return a * (1 - fy) + b * fy;
}
function furPixels(sh, f) {
    const key = sh + f;
    if (furPixCache[key]) return furPixCache[key];
    const cell = cells[sh][f - 1],
        w = cell.width,
        h = cell.height,
        src = cell.getContext("2d").getImageData(0, 0, w, h).data,
        op = (x, y) => y < h && src[(y * w + x) * 4 + 3] > 128,
        out = [];
    let x0 = w;
    for (let x = 0; x < w && x0 === w; x++) for (let y = 0; y < h; y++) if (op(x, y)) { x0 = x; break; }
    for (let x = 0; x < w; x++) {
        let below = 0; // ile pikseli psa ciągnie się pod spodem (od dołu kolumny w górę)
        for (let y = h - 1; y >= 0; y--) {
            if (!op(x, y)) { below = 0; continue; }
            const i = (y * w + x) * 4,
                r = src[i], g = src[i + 1], b = src[i + 2];
            const d = below;
            below++;
            if (r + g + b < 90) continue; // obrys zostaje czysty
            const qx = Math.floor((x - x0) / 3) * 3,
                qy = Math.floor(y / 3) * 3,
                score = d / 13 + furNoise(qx, qy) * 0.9 - 0.25;
            if (score >= FUR_MAX * 1.25) continue;
            const sp = furGrid[((qx / 3) * 7 + (qy / 3) * 13) % furGrid.length];
            out.push({ i, score, r, g, b, dry: sp < 0.07 });
        }
    }
    return (furPixCache[key] = { w, h, px: out });
}
function furOverlay(sh, f, step) {
    const key = sh + f + "_" + step;
    if (furOverCache[key]) return furOverCache[key];
    const { w, h, px } = furPixels(sh, f),
        L = (step / FUR_STEPS) * FUR_MAX,
        cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d"),
        im = c.createImageData(w, h),
        d = im.data;
    for (const p of px) {
        if (p.score >= L * 1.25) continue;
        const k = p.score < L * 1.25 - 0.22 ? 0.72 : 0.45,
            col = p.dry && p.score < L ? FUR_DRY : [p.r + (FUR_MUD[0] - p.r) * k, p.g + (FUR_MUD[1] - p.g) * k, p.b + (FUR_MUD[2] - p.b) * k];
        d[p.i] = col[0];
        d[p.i + 1] = col[1];
        d[p.i + 2] = col[2];
        d[p.i + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    return (furOverCache[key] = cv);
}

// Grudki ziemi na łapkach — liczone z każdej klatki (najniższe piksele sierści
// w kolumnach, więc podążają za łapą także w biegu), bez osobnego arkusza.
// Kolejność grudek jest stała dla klatki: mniej brudu = mniej grudek (znikają
// grupami, nie piksel po pikselu). Rysowane w układzie komórki arkusza.
const PAW_BUCKET = 14, // szerokość „pasa” brudu w pikselach komórki arkusza (czyszczony osobno)
    PAW_DIRT_COLORS = ["#c9a066", "#6a4524", "#a56a3a", "#d9b87f", "#4a2e17"],
    pawDirtCache = {};
// Brud sypie się wokół punktów łap z ręcznie narysowanych siatek
// (source/animacje/latka-animacje-0N-lapki-nos-ogon.png → data/animations/szkielet.json,
// patrz tools/szkielet.py). W animacjach, w których łapy się nie ruszają, punkty są
// wspólne dla wszystkich klatek, więc brud stoi w miejscu; w fikołku i przy
// uniesionej łapie jedzie razem z punktem. Klatki bez punktów łap — bez brudu.
// Wzorzec grudek (przesunięcia, kolory, kolejność znikania) jest stały dla łapy.
let skeleton = null,
    pawDirtTemplate = null;
// Okruchy brudu: bez siatki, różnej wielkości (1–3 px, czasem podłużne), gęściej
// przy samej łapie, rzadziej dalej, część „wspina się” w górę nóżki. Każda łapa
// ma własny, stały wzorzec. Próg pojawiania się (thr) rośnie od środka łapy na
// zewnątrz z dużą domieszką losowości — brud rozchodzi się nierówno, plamami.
const PAW_GRAINS = 34;
function pawDirtMake() {
    const out = [];
    for (let k = 0; k < 6; k++) {
        let seed = 4242 + k * 977;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280),
            gr = [];
        for (let i = 0; i < PAW_GRAINS; i++) {
            const r = Math.pow(rnd(), 1.5) * 12,
                a = rnd() * Math.PI * 2,
                climb = rnd() < 0.25 ? rnd() * 9 : 0, // okruch wyżej na nóżce
                sz = r < 5 ? 3 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2),
                g = {
                    ox: Math.cos(a) * r * 1.15,
                    oy: Math.sin(a) * r * 0.75 - climb,
                    w: sz + (rnd() < 0.3 ? 1 : 0),
                    h: sz + (rnd() < 0.15 ? 1 : 0),
                    col: PAW_DIRT_COLORS[Math.floor(rnd() * PAW_DIRT_COLORS.length)],
                    score: (r + climb) / 14 + rnd() * 0.7,
                    bits: [],
                };
            // czasem przyklejony drobny okruszek innego koloru (nierówny brzeg)
            if (rnd() < 0.4) g.bits.push({ dx: Math.round(rnd() * 6 - 3), dy: Math.round(rnd() * 6 - 3), s: 2, col: PAW_DIRT_COLORS[Math.floor(rnd() * PAW_DIRT_COLORS.length)] });
            gr.push(g);
        }
        // progi rozłożone równo (każda łapa brudzi się tak samo), kolejność wg score
        gr.slice()
            .sort((p, q) => p.score - q.score)
            .forEach((g, i) => (g.thr = (i + 0.5) / PAW_GRAINS));
        out.push(gr);
    }
    return out;
}
function pawDirtBlobs(sh, f) {
    const key = sh + f;
    if (pawDirtCache[key]) return pawDirtCache[key];
    pawDirtTemplate ||= pawDirtMake();
    const paws = skeleton?.[sh]?.[f - 1]?.paws || [],
        blobs = [];
    if (paws.length) {
        const cell = cells[sh][f - 1],
            w = cell.width,
            h = cell.height,
            src = cell.getContext("2d").getImageData(0, 0, w, h).data,
            onDog = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] > 128;
        paws.forEach(([pxx, pyy], k) => {
            for (const g of pawDirtTemplate[k % pawDirtTemplate.length]) {
                // okruch tylko na piesku: gdy wypada poza, przysuwamy go do łapy
                let gx = pxx + g.ox,
                    gy = pyy + g.oy;
                if (!onDog(gx + g.w / 2, gy + g.h / 2)) {
                    gx = pxx + g.ox * 0.4;
                    gy = pyy + g.oy * 0.4;
                    if (!onDog(gx + g.w / 2, gy + g.h / 2)) continue;
                }
                gx = Math.round(gx);
                gy = Math.round(gy);
                const list = [{ x: gx, y: gy, w: g.w, h: g.h, col: g.col }];
                for (const t of g.bits) if (onDog(gx + t.dx, gy + t.dy)) list.push({ x: gx + t.dx, y: gy + t.dy, w: t.s, h: t.s, col: t.col });
                blobs.push({ list, thr: g.thr, bucket: Math.floor(pxx / PAW_BUCKET), paw: k });
            }
        });
    }
    return (pawDirtCache[key] = blobs);
}
function pawDirtDraw(c, sh, f, amount) {
    for (const bl of pawDirtBlobs(sh, f)) {
        // w trakcie czyszczenia każdy fragment łapek ma własny poziom brudu (pawLvl)
        if (bl.thr >= (pawLvl ? (pawLvl[bl.bucket] ?? 0) : amount)) continue;
        for (const q of bl.list) {
            c.fillStyle = q.col;
            c.fillRect(q.x, q.y, q.w, q.h);
        }
    }
}
