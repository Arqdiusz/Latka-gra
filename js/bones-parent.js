"use strict";
// ═══════════════════════════════════════════════════════════════
// LICZYMY KOSTKI — EKRAN DLA RODZICA
// Mała kłódka na ekranie startowym → mnożenie (7 × 8 itp., jak przy blokadzie
// sesji) → postępy: poziom każdej umiejętności, najczęstsze pomyłki oraz
// statystyka „czy dziecko chce grać”: ile razy gra była proponowana, rozpoczęta,
// dokończona i ile razy wybrano „Nie teraz”, „Wróć” albo ✕ w trakcie gry.
// „Zacznij liczenie od nowa” zeruje poziomy (statystyka odmów zostaje).
// ═══════════════════════════════════════════════════════════════

let bpQ = null,
    bpResetArmed = 0;

function bpOpen() {
    const el = $(".bonesParent");
    $(".bonesParentBtn img").src = icons.lock || "";
    bpQ = { a: 6 + Math.floor(Math.random() * 4), b: 6 + Math.floor(Math.random() * 4) };
    $(".bpQ").textContent = "Dla rodzica: ile to " + bpQ.a + " × " + bpQ.b + " ?";
    $(".bpInput").value = "";
    $(".bpGate").hidden = false;
    $(".bpStats").hidden = true;
    el.hidden = false;
    $(".bpInput").focus();
}
function bpClose() {
    $(".bonesParent").hidden = true;
    bpResetArmed = 0;
    $(".bpReset").textContent = "Zacznij liczenie od nowa";
}

function bpRender() {
    const s = adaptSummary(),
        esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])),
        dots = (lvl, max) => Array.from({ length: max + 1 }, (_, i) => '<i class="' + (i <= lvl ? "on" : "") + '"></i>').join(""),
        rows = s.skills
            .map((k) =>
                k.on
                    ? '<div class="bpRow"><b>' + k.name + '</b><span class="bpDots">' + dots(k.lvl, k.max) + "</span><small>poziom " + (k.lvl + 1) + " z " + (k.max + 1) + " (" + k.txt + ")" +
                      (k.n ? " · bez pomyłek " + k.okPct + "% · średnio " + String(k.avgS).replace(".", ",") + " s · " + k.n + " zadań" : " · jeszcze bez zadań") + "</small></div>"
                    : '<div class="bpRow off"><b>' + k.name + '</b><small>jeszcze niedostępne — odblokuje się, gdy dziecko pewnie poradzi sobie z łatwiejszym działaniem</small></div>'
            )
            .join(""),
        mist = s.mistakes.length ? s.mistakes.map((m) => esc(m.txt) + " (" + m.n + "×)").join(", ") : "brak — nic nie wymaga powtórki",
        t = s.tot,
        w = s.week,
        line = (label, k) => "<tr><td>" + label + "</td><td>" + (w[k] || 0) + "</td><td>" + (t[k] || 0) + "</td></tr>";
    $(".bpBody").innerHTML =
        '<div class="bpSec">Poziomy (dobiera gra)</div>' + rows +
        '<div class="bpSec">Do powtórki</div><p class="bpP">' + mist + "</p>" +
        '<div class="bpSec">Czy dziecko chce liczyć?</div>' +
        '<table class="bpTab"><tr><th></th><th>7 dni</th><th>razem</th></tr>' +
        line("Gra zaproponowana (kret z kostką)", "offer") +
        line("Rozpoczęta", "start") +
        line("Dokończona (5 działań)", "finish") +
        line("„Nie teraz” na propozycji", "noThanks") +
        line("„Wróć” na ekranie startowym", "back") +
        line("✕ w trakcie gry", "exit") +
        "</table>" +
        '<p class="bpP">Rundy: ' + s.rounds + " · zadania: " + s.tasks + ".</p>";
}

$(".bonesParentBtn").onclick = bpOpen;
document.querySelectorAll(".bpClose").forEach((b) => (b.onclick = bpClose));
$(".bpGate").addEventListener("submit", (e) => {
    e.preventDefault();
    if (bpQ && Number($(".bpInput").value) === bpQ.a * bpQ.b) {
        bpRender();
        $(".bpGate").hidden = true;
        $(".bpStats").hidden = false;
        return;
    }
    const f = $(".bpGate");
    f.classList.remove("bad");
    void f.offsetWidth;
    f.classList.add("bad");
    $(".bpInput").value = "";
    bpQ = { a: 6 + Math.floor(Math.random() * 4), b: 6 + Math.floor(Math.random() * 4) };
    $(".bpQ").textContent = "Dla rodzica: ile to " + bpQ.a + " × " + bpQ.b + " ?";
});
// dwa dotknięcia, żeby nie wyzerować przez pomyłkę
$(".bpReset").onclick = () => {
    if (!bpResetArmed) {
        bpResetArmed = 1;
        $(".bpReset").textContent = "Na pewno? Dotknij jeszcze raz";
        return;
    }
    adaptReset();
    bpResetArmed = 0;
    $(".bpReset").textContent = "Zacznij liczenie od nowa";
    bpRender();
};
