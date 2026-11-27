"use strict";
// Rysowanie dymków i ikon, iskierki.
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

function bubbleDraw(dt) {
    if (!bubble || clock > bubble.until) {
        bubblePos = null;
        return;
    }
    const h = headPosition(),
        size = clamp(UI.bubbleSize, 60, 106),
        // Przy krawędzi pokoju (piesek wchodzi/wychodzi) chmurka gaśnie i znika,
        // zamiast "przyklejać się" do brzegu ekranu i żyć własnym życiem.
        edgeAlpha = clamp((Math.min(h.x, W - h.x) - 26) / 56, 0, 1),
        target = {
            x: clamp(h.x - size * (left ? 0.36 : 0.64), 6, W - size - 6),
            y: clamp(h.y - size - 12, 6, SH - size - 6),
        };
    if (edgeAlpha <= 0) {
        bubblePos = null;
        return;
    }
    if (!bubblePos)
        bubblePos = {
            ...target,
        };
    const blend = 1 - Math.exp(-dt / 70);
    bubblePos.x += (target.x - bubblePos.x) * blend;
    bubblePos.y += (target.y - bubblePos.y) * blend;
    const bx = clamp(bubblePos.x, 6, W - size - 6),
        by = clamp(bubblePos.y, 6, SH - size - 6),
        type = bubble.type || "thought";
    ctx.save();
    ctx.globalAlpha = edgeAlpha;
    if (left) {
        ctx.translate(bx + size, by);
        ctx.scale(-1, 1);
        iconDraw(ctx, type, 0, 0, size);
    } else iconDraw(ctx, type, bx, by, size);
    ctx.restore();
    // Środek "brzuszka" dymku (bez ogonka) — z grafiki, patrz bubbleBodyCenter()
    const center = bubbleBodyCenter(type),
        base = Math.min(UI.bubbleSymbolSize, size * 0.58),
        // smutek: ikonka (nie dymek) pulsuje; po odmowie mocniej i szybciej
        boost = clock < sadBoostUntil,
        pulse = bubble.pulse ? 1 + (boost ? 0.22 : 0.13) * (0.5 + 0.5 * Math.sin((clock / (boost ? 150 : 260)) * Math.PI)) : 1,
        symbol = base * pulse,
        art = iconArtCenter(bubble.icon),
        cx = bx + (left ? 1 - center[0] : center[0]) * size,
        cy = by + center[1] * size;
    ctx.save();
    ctx.globalAlpha = edgeAlpha;
    // rysunek ikonki ustawiony tak, by środek jej WIDOCZNEJ części trafił w środek dymku
    iconDraw(ctx, bubble.icon, cx - art[0] * symbol, cy - art[1] * symbol, symbol);
    ctx.restore();
}

// Środek widocznej części grafiki (ułamki 0..1 pola) — ikonki nie są
// narysowane idealnie na środku swoich pól, więc liczymy to z kanału alfa.
const artCenterCache = {};
function alphaBox(img, sx, sy, sw, sh) {
    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const d = g.getImageData(0, 0, sw, sh).data;
    let x0 = sw,
        y0 = sh,
        x1 = -1,
        y1 = -1;
    for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++)
            if (d[(y * sw + x) * 4 + 3] > 40) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, w: sw, h: sh, data: d };
}
function iconArtCenter(key) {
    if (artCenterCache[key]) return artCenterCache[key];
    let res = [0.5, 0.5];
    try {
        if (key === "poop" || key === "dish") res = [0.5, 0.5]; // rysowana z dopasowaniem proporcji, wyśrodkowana
        else if (UI.map[key]) {
            const cell = cells.ui[UI.map[key] - 1],
                b = alphaBox(cell, 0, 0, cell.width, cell.height);
            if (b) res = [(b.x0 + b.x1) / 2 / b.w, (b.y0 + b.y1) / 2 / b.h];
        }
    } catch (_) {}
    return (artCenterCache[key] = res);
}
// Dymek "myśli" ma pod spodem ogonek z kółeczek — środek liczymy tylko z
// największego, zwartego "brzuszka": wiersze, w których dymek jest szeroki.
function bubbleBodyCenter(type) {
    const k = "bubble:" + type;
    if (artCenterCache[k]) return artCenterCache[k];
    let res = P.bubbleCenters?.[type] || [0.5, 0.4];
    try {
        const cell = cells.ui[UI.map[type] - 1],
            b = alphaBox(cell, 0, 0, cell.width, cell.height);
        if (b) {
            const rows = [];
            for (let y = 0; y < b.h; y++) {
                let a = -1,
                    z = -1;
                for (let x = 0; x < b.w; x++)
                    if (b.data[(y * b.w + x) * 4 + 3] > 40) {
                        if (a < 0) a = x;
                        z = x;
                    }
                rows.push(a < 0 ? 0 : z - a + 1);
            }
            const maxW = Math.max(...rows),
                body = rows.map((w, y) => (w >= maxW * 0.35 ? y : -1)).filter((y) => y >= 0);
            // brzuszek = najdłuższy ciągły pas szerokich wierszy
            let best = [body[0], body[0]],
                cur = [body[0], body[0]];
            for (let i = 1; i < body.length; i++) {
                if (body[i] === body[i - 1] + 1) cur[1] = body[i];
                else cur = [body[i], body[i]];
                if (cur[1] - cur[0] > best[1] - best[0]) best = [...cur];
            }
            let xa = b.w,
                xz = -1;
            for (let y = best[0]; y <= best[1]; y++)
                for (let x = 0; x < b.w; x++)
                    if (b.data[(y * b.w + x) * 4 + 3] > 40) {
                        if (x < xa) xa = x;
                        if (x > xz) xz = x;
                    }
            res = [(xa + xz + 1) / 2 / b.w, (best[0] + best[1] + 1) / 2 / b.h];
        }
    } catch (_) {}
    return (artCenterCache[k] = res);
}

/* ═══════════════════════════════════════════════════════════════
   ISKIERKI PO SPRZĄTANIU (grafika assets/sprites/star-check.webp, arkusz 2×2: 64 px)
   Kupka, piach kreta, naczynie, grudka i czyste łapki: w tym miejscu zapalają
   się po kolei gwiazdki, unoszą się i gasną (~1,1 s). Tylko ozdoba.
   ═══════════════════════════════════════════════════════════════ */
const SPARKLE_CELL = { A: [0, 0], B: [64, 0], C: [0, 64], D: [64, 64] },
    SPARKLE_MS = 760,
    SPARKLE_BIG = [[-34, -6, 0, "D", 1.4], [28, -14, 90, "A", 1.6], [-8, -34, 180, "B", 1.2], [38, 8, 270, "D", 1.2], [-30, 14, 360, "A", 1.4]],
    SPARKLE_PAW = [[-9, -4, 0, "D", 1.0], [11, -14, 110, "A", 1.1], [0, -26, 220, "B", 0.9]];
let sparkles = [];
function sparkleBurst(cx, cy, pts = SPARKLE_BIG, delay = 0, flash = false) {
    sparkles.push({ room, cx, cy, t0: clock + delay, pts, flash });
}
function sparklesDraw() {
    if (!sparkles.length || !images.sparkle) return;
    sparkles = sparkles.filter((b) => clock < b.t0 + SPARKLE_MS + 400);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const b of sparkles) {
        if (b.room !== room) continue;
        if (b.flash) {
            // duży, miękki błysk światła pod gwiazdkami (0,35 s)
            const u = clamp((clock - b.t0) / 350, 0, 1);
            if (u > 0 && u < 1) {
                const r = 22 + 30 * u,
                    gr = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r);
                gr.addColorStop(0, `rgba(255,255,235,${0.85 * (1 - u)})`);
                gr.addColorStop(1, "rgba(255,255,235,0)");
                ctx.globalAlpha = 1;
                ctx.fillStyle = gr;
                ctx.beginPath();
                ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        for (const [dx, dy, d, k, sc] of b.pts) {
            const u = clamp((clock - b.t0 - d) / SPARKLE_MS, 0, 1);
            if (u <= 0 || u >= 1) continue;
            const ease = u < 0.3 ? 1 + 2.7 * Math.pow(u / 0.3 - 1, 3) + 1.7 * Math.pow(u / 0.3 - 1, 2) : 1 - (u - 0.3) * 0.5,
                z = sc * ease,
                [sx, sy] = SPARKLE_CELL[k];
            ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
            ctx.drawImage(images.sparkle, sx, sy, 64, 64, Math.round(b.cx + dx - 32 * z), Math.round(b.cy - 6 + dy - u * 16 - 32 * z), 64 * z, 64 * z);
        }
    }
    ctx.restore();
}
