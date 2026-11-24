"use strict";
// ═══════════════════════════════════════════════════════════════
// OCHRONA PRZED "PRZELOTEM" KLIKNIĘĆ. Gdy karta (start, wygrana, przegrana,
// wybór poziomu/gry) pojawia się w trakcie dotyku — np. ostatni motylek
// otwiera ekran wygranej — zakończenie tego samego dotyku trafiało w przycisk
// leżący pod palcem i od razu startowało nową grę. Przez GUARD_MS od
// pokazania karty klik w jej przyciskach jest ignorowany. Działa dla wszystkich
// mini-gier naraz (jeden nasłuch, bez zmian w kodzie gier).
// ═══════════════════════════════════════════════════════════════
(() => {
    const GUARD_MS = 700,
        SEL = ".molePopup, .moleWinPopup, .memoLevels, .pairsLevels, .gamesFull, .bonesMenu",
        shownAt = new WeakMap(),
        mo = new MutationObserver((list) => {
            for (const m of list) if (m.target instanceof Element && !m.target.hidden) shownAt.set(m.target, performance.now());
        });
    for (const el of document.querySelectorAll(SEL)) {
        mo.observe(el, { attributes: true, attributeFilter: ["hidden"] });
        if (!el.hidden) shownAt.set(el, performance.now());
    }
    const block = (e) => {
        const box = e.target.closest && e.target.closest(SEL);
        if (!box || !shownAt.has(box)) return;
        if (performance.now() - shownAt.get(box) < GUARD_MS) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    // capture: zanim kliknięcie dotrze do przycisku
    document.addEventListener("click", block, true);
})();
