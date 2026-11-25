/* BUSTART: the painted race busts (bust-<race>.webp, 512x512, transparent, 3/4 view facing right, plain linen tunic).
   Used by the race picker in character creation, the Hero page card and the inventory's paper doll.
   The fight rig and the paper-doll figure stay as they are.

   Each race has ONE painted bust, of one sex (SEX below). When your hero is the other sex, the bust is shown as a
   race crest (round medallion, a little muted) instead of as "you": we never claim it is your face.
   Until a picture loads (or when it's missing, or in screen tests without ?assets) the old drawing stays; the picture
   swaps itself in when it arrives (ASSETS.on).

   API: BUSTART.key(race)                  → "bust-<race>" or null
        BUSTART.url(race)                  → the loaded picture's URL or "" (asks for it the first time)
        BUSTART.SEX[race]                  → "m" | "f": the sex of the painted bust
        BUSTART.pick(race, fallbackHtml)   → race-picker face: the bust on a dark panel, or the fallback until it loads
        BUSTART.hero(src, fallbackHtml)    → Hero page portrait: the bust on a dark panel (crest when the sex differs)
        BUSTART.crest(src, size)           → a small round crest (inventory); "" until the picture loads */
const BUSTART = (() => {
  const SEX = { nord: "m", imperial: "f", breton: "f", redguard: "m", altmer: "f", bosmer: "m", dunmer: "f", orc: "m", khajiit: "f", argonian: "m" };
  const key = (r) => (SEX[r] ? "bust-" + r : null);
  const url = (r) => { const k = key(r); return k && typeof ASSETS !== "undefined" ? ASSETS.url(k) : ""; };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const raceName = (r) => { try { return D.RACES[r]?.name || r; } catch { return r; } };
  function raceOf(src) { return src?.race || src?.look?.r || src?.r || "nord"; }
  function sexOf(src) {
    const a = src?.app || src?.look?.a || src?.a;
    if (a && typeof a === "object" && a.sx) return a.sx === "f" ? "f" : "m";
    return src?.sex === "f" || src?.sx === "f" || src?.look?.sx === "f" ? "f" : "m";
  }
  const img = (r, u, cls) => `<img class="${cls}" src="${esc(u)}" alt="${esc(raceName(r))}" draggable="false" decoding="async">`;

  /* a slot that shows the fallback now and the picture once it loads */
  function slot(kind, r, inner, ready, extra = "") {
    return `<span class="bustslot bust-${kind}${ready ? " ok" : ""}${extra}" data-bust="${esc(r)}" data-bk="${kind}">${inner}</span>`;
  }
  function pick(r, fallback = "") {
    const u = url(r);
    return slot("pick", r, u ? img(r, u, "bustimg") : fallback, !!u);
  }
  function hero(src, fallback = "") {
    const r = raceOf(src), u = url(r), other = sexOf(src) !== SEX[r];
    return slot("hero", r, u ? img(r, u, "bustimg") : fallback, !!u, other ? " bust-crest" : "");
  }
  function crest(src, size = 60) {
    const r = raceOf(src), u = url(r);
    return `<span class="bustslot bust-badge${u ? " ok" : ""}" data-bust="${esc(r)}" data-bk="badge" style="--bs:${size | 0}px" aria-hidden="true">${u ? img(r, u, "bustimg") : ""}</span>`;
  }
  /* pictures that arrive later: swap them into the slots still showing the old drawing */
  function fill() {
    try {
      for (const el of document.querySelectorAll(".bustslot:not(.ok)")) {
        const r = el.dataset.bust, u = url(r); if (!u) continue;
        el.innerHTML = img(r, u, "bustimg"); el.classList.add("ok");
      }
    } catch { /* no page */ }
  }
  try { if (typeof ASSETS !== "undefined") ASSETS.on(fill); } catch { /* ignore */ }
  return { SEX, key, url, sexOf, raceOf, pick, hero, crest, fill };
})();
if (typeof module !== "undefined") module.exports = BUSTART;
