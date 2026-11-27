"use strict";
// Panel deweloperski (5 stuknięć w serduszko).
// Część dawnego js/game.js (podział v0.8.249). Pliki game-*.js dzielą jeden zasięg globalny —
// kolejność <script> w index.html jest istotna (ta sama co kolejność kodu w dawnym game.js).

// ── TYMCZASOWY panel deweloperski — do usunięcia przed publikacją ──
// Pozwala ręcznie zmieniać potrzeby (jedzenie/woda/zabawa/sen/czystość),
// budzić Łatkę i usuwać kupkę, żeby łatwo testować dowolny stan gry.
// Brud łapek = pawDirt (0–100). Brud sierści (0–100) to przeliczona czystość:
// 0% przy czystości ≥ 65, 100% przy czystości 15 (jak furLevel).
function devGet(k) {
    if (k === "session") return session.played / 60000; // minuty sesji
    if (k === "paws") return pawDirt;
    if (k === "fur") return (furLevel() / FUR_MAX) * 100;
    return stats[k] ?? 0;
}
function devSet(k, v) {
    v = clamp(v, 0, 100);
    if (k === "session") return (session.played = Math.min(v, 15) * 60000), sessionSave();
    if (k === "paws") {
        pawDirt = v;
        save();
    } else if (k === "fur") stats.clean = clamp(65 - (v / 100) * FUR_MAX * 50, 0, 100);
    else stats[k] = v;
}
function devRefresh() {
    document.querySelectorAll(".devPanel .devRow").forEach((row) => {
        const k = row.dataset.stat,
            out = row.querySelector("output");
        if (out) out.textContent = Math.round(devGet(k));
    });
}
document.querySelectorAll(".devPanel .devRow button").forEach((btn) => {
    btn.onclick = () => {
        const row = btn.closest(".devRow"),
            k = row.dataset.stat,
            d = Number(btn.dataset.d);
        devSet(k, devGet(k) + d);
        if (loaded) {
            statusUpdate();
            syncMenu();
        }
        saveNeeds();
        devRefresh();
    };
});
// Przycisk DEV jest ukryty: 5 kliknięć w serduszko przy pasku samopoczucia
// (w ciągu 3 s) pokazuje go, kolejne 5 — chowa go (razem z panelem).
{
    let taps = [];
    $(".heartBadge").addEventListener("click", () => {
        const now = performance.now();
        taps = taps.filter((t) => now - t < 3000);
        taps.push(now);
        if (taps.length < 5) return;
        taps = [];
        const t = $(".devToggle");
        t.hidden = !t.hidden;
        if (t.hidden) $(".devPanel").hidden = true;
    });
}
$(".devToggle").onclick = () => {
    $(".devPanel").hidden = !$(".devPanel").hidden;
    devRefresh();
};
$(".devMaxAll").onclick = () => {
    Object.assign(stats, { food: 100, water: 100, fun: 100, sleep: 100, clean: 100 });
    if (loaded) {
        statusUpdate();
        syncMenu();
    }
    saveNeeds();
    devRefresh();
};
$(".devWake").onclick = () => {
    wake();
    devRefresh();
};
$(".devClean").onclick = () => {
    poop = null;
    updatePoopAccess();
    save();
};
$(".devCleanMole").onclick = () => {
    delete moleDirts[room];
    updateMoleDirtAccess();
    save();
};
