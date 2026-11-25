"use strict";
// ═══════════════════════════════════════════════════════════════
// WYBÓR POZIOMU (Pamięć motylków, Znajdź pary): jasna karta na przyciemnionej
// grze, u góry pas trawy, po którym piesek goni motylka (te same klatki biegu
// z arkusza a01 i motylki z gry), niżej duże przyciski poziomów i „Wróć”.
// Jedna pętla rysuje wszystkie widoczne .lvChase i sama się zatrzymuje, gdy
// żaden ekran poziomów nie jest otwarty.
// ═══════════════════════════════════════════════════════════════

let lvRaf = 0,
    lvGrass = null,
    lvColor = 0,
    lvT0 = 0;

// ikona gry w pastylce i start pościgu; wołane przy pokazaniu ekranu poziomów
function levelPickOpen(root, iconKey) {
    root.querySelector(".lvIcon").src = icons[iconKey] || "";
    lvColor = Math.floor(Math.random() * CFG.motyle.presets.length);
    lvT0 = performance.now();
    if (!lvGrass) {
        lvGrass = new Image();
        lvGrass.src = "tla/001-gry.png";
    }
    if (!lvRaf) lvRaf = requestAnimationFrame(levelPickDraw);
}

function levelPickDraw(now) {
    lvRaf = 0;
    const cvs = [...document.querySelectorAll(".lvChase")].filter((c) => c.offsetParent);
    if (!cvs.length) return;
    for (const cv of cvs) {
        const c = cv.getContext("2d"),
            W = cv.width,
            H = cv.height,
            T = 7000,
            u = ((now - lvT0) % T) / T;
        c.imageSmoothingEnabled = false;
        if (lvGrass && lvGrass.complete && lvGrass.naturalWidth) c.drawImage(lvGrass, 168, 1000, 432, 204, 0, 0, W, H);
        else {
            c.fillStyle = "#a3d45c";
            c.fillRect(0, 0, W, H);
        }
        // piesek: klatki biegu (a01 „02. Bieg”), stopy na jednej wysokości
        const pre = getPreset("a01", 1),
            fr = numbers(pre.seq),
            cell = cells.a01[fr[Math.floor(now / 110) % fr.length] - 1],
            k = 1.0,
            dx = -90 + u * (W + 90 + 150);
        if (cell) c.drawImage(cell, dx - 64 * k, H - 8 - CFG.a01.ground * k, cell.width * k, cell.height * k);
        // motylek tuż przed pieskiem, trzepocze i buja się
        const bp = CFG.motyle.presets[lvColor],
            bf = numbers(bp.seq),
            bc = cells.motyle[bf[Math.floor(now / 150) % bf.length] - 1],
            bx = dx + 78 + Math.sin(now / 260) * 14,
            by = H * 0.3 + Math.sin(now / 180) * 10;
        if (bc) c.drawImage(bc, bx, by, 38, 38 * (bc.height / bc.width));
    }
    lvRaf = requestAnimationFrame(levelPickDraw);
}
