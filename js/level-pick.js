"use strict";
// ═══════════════════════════════════════════════════════════════
// WYBÓR POZIOMU (Pamięć motylków, Znajdź pary): ogród z mini gier w tle, u góry
// belka z ikoną i nazwą gry, na środku jasna karta. W karcie piesek robi swoją
// animację (motylki: siedzi i obserwuje motylka, który koło niego fruwa;
// pary: patrzy w górę, jakby się zastanawiał). Jedna pętla rysuje widoczne
// .lvDog i sama się zatrzymuje, gdy ekran poziomów jest zamknięty.
// ═══════════════════════════════════════════════════════════════

let lvRaf = 0,
    lvT0 = 0,
    lvColor = 0;
const LV_DOG = {
    memo: { sheet: "a02", anim: 16, butterfly: true }, // „17. Motyl — obserwowanie na siedząco”
    pairs: { sheet: "a01", anim: 15, butterfly: false }, // „16. Patrzenie w górę / łapa”
};

function levelPickOpen(root, iconKey, kind) {
    root.querySelector(".lvIcon").src = icons[iconKey] || "";
    root.querySelector(".lvDog").dataset.kind = kind;
    lvColor = Math.floor(Math.random() * CFG.motyle.presets.length);
    lvT0 = performance.now();
    if (!lvRaf) lvRaf = requestAnimationFrame(levelPickDraw);
}

function levelPickDraw(now) {
    lvRaf = 0;
    const cvs = [...document.querySelectorAll(".lvDog")].filter((c) => c.offsetParent);
    if (!cvs.length) return;
    for (const cv of cvs) {
        const d = LV_DOG[cv.dataset.kind],
            c = cv.getContext("2d");
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        if (d) {
            const pre = getPreset(d.sheet, d.anim),
                fr = numbers(pre.seq),
                f = fr[Math.floor((now - lvT0) / pre.ms) % fr.length],
                cell = cells[d.sheet][f - 1],
                b = P.meta[d.sheet][fr[0] - 1].box, // stały punkt odniesienia: bez drgania między klatkami
                k = 1.1;
            if (cell) c.drawImage(cell, 80 - ((b[0] + b[2]) / 2) * k, 152 - b[3] * k, cell.width * k, cell.height * k);
            if (d.butterfly) {
                const bp = CFG.motyle.presets[lvColor],
                    bf = numbers(bp.seq),
                    bc = cells.motyle[bf[Math.floor(now / 150) % bf.length] - 1],
                    t = now / 1000,
                    bx = 80 + Math.cos(t * 1.3) * 52 - 15,
                    by = 40 + Math.sin(t * 2.1) * 14;
                if (bc) c.drawImage(bc, bx, by, 30, 30 * (bc.height / bc.width));
            }
        }
    }
    lvRaf = requestAnimationFrame(levelPickDraw);
}
