/* avatar.js: your round painted portrait (the "avatar"), and the picker to choose it. [OURS]
   Automatic uses the hero's own race and sex. A valid portrait chosen by the player always takes priority.
   The original race-only IDs still identify the same paintings in saves and multiplayer player cards.

   API: AVATAR.IDS                       → every portrait id there is
        AVATAR.valid(id)                 → true for a known portrait id
        AVATAR.chosen(card)              → the valid chosen id, or ""  (Automatic)
        AVATAR.auto(card)                → the portrait race + sex picks
        AVATAR.of(card)                  → the portrait to show
        AVATAR.set(s, id)                → saves the choice on s.avatar ("" / "auto" / unknown = Automatic)
        AVATAR.options(card, all)        → [{ id, fit: "own" | "near" | "sex" | "other" }]: race and sex first; all adds the other sex
        AVATAR.missing()                 → [[race, sex]] with no painted portrait yet
        AVATAR.portrait(card, size)      → round painted portrait html (the drawn HEROART portrait until the picture loads)
        AVATAR.hero(card, fallback, tap) → the big round portrait on the Character sheet (a button that opens the picker when tap)
        AVATAR.grid(card, cur, all, attr)→ the SkyUI picker grid: buttons with attr ("data-av" in the creator, "data-act=avpick" in the game)
        AVATAR.cardBits(s)               → { avatar } for the player card
        AVATAR.silhouette(size)          → a plain round head-and-shoulders shape (someone never seen)
        AVATAR.face(card, cached, size)  → a friend's portrait: from their live card, else the one last seen (cached id), else a silhouette
        AVATAR.remember(s, id, card)     → keeps a friend's portrait on s.friends[id].pic for when they're offline (true when it changed)
        AVATAR.badge(s, size)            → the small round portrait in the paper doll's corner
        AVATAR.sheet(s, all)             → the "Your portrait" window on the Character sheet (data-act avpick / avall / close) */
const AVATAR = (() => {
  const FALLBACK_SEX = { nord: "m", imperial: "f", breton: "f", redguard: "m", altmer: "f", bosmer: "m", dunmer: "f", orc: "m", khajiit: "f", argonian: "m" };
  const SEX = () => (typeof BUSTART !== "undefined" ? BUSTART.SEX : FALLBACK_SEX);
  const IDS = Object.keys(SEX());
  /* the closest painted portrait for a race + sex that has none yet (humans to humans, elves to elves, beast folk to beast folk) */
  const NEAR = {
    nord: { f: "breton" }, imperial: { m: "nord" }, breton: { m: "nord" }, redguard: { f: "imperial" },
    altmer: { m: "bosmer" }, bosmer: { f: "altmer" }, dunmer: { m: "bosmer" }, orc: { f: "dunmer" },
    khajiit: { m: "argonian" }, argonian: { f: "khajiit" },
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const raceName = (r) => { try { return D.RACES[r]?.name || r; } catch { return r; } };
  const valid = (id) => typeof id === "string" && IDS.includes(id);
  function raceOf(c) { const r = c?.race || c?.look?.r || c?.r; return Object.hasOwn(FALLBACK_SEX, r) ? r : "nord"; }
  const portraitRace = (id) => id.split("-")[0];
  function sexOf(c) {
    if (typeof BUSTART !== "undefined" && BUSTART.sexOf) return BUSTART.sexOf(c);
    const a = c?.app || c?.look?.a || c?.a;
    if (a && typeof a === "object" && a.sx) return a.sx === "f" ? "f" : "m";
    return c?.sex === "f" || c?.sx === "f" || c?.look?.sx === "f" ? "f" : "m";
  }
  const chosen = (c) => { const a = c?.avatar; return valid(a) ? a : ""; };
  function auto(c) {
    const r = raceOf(c), sx = sexOf(c), S = SEX();
    const exact = typeof BUSTART !== "undefined" ? BUSTART.idFor?.(r, sx) : null;
    if (exact) return exact;
    if (S[r] === sx) return r;
    const n = NEAR[r]?.[sx]; if (n && S[n] === sx) return n;
    return IDS.find((id) => S[id] === sx) || r;
  }
  const of = (c) => chosen(c) || auto(c);
  function set(s, id) {
    if (!s) return false;
    if (valid(id)) s.avatar = id; else delete s.avatar;
    return true;
  }
  function options(c, all) {
    const r = raceOf(c), sx = sexOf(c), S = SEX(), exact = auto(c);
    const fit = (id) => (S[id] !== sx ? "other" : portraitRace(id) === r ? "own" : id === exact ? "near" : "sex");
    const rank = { own: 0, near: 1, sex: 2, other: 3 };
    const out = IDS.map((id, i) => ({ id, fit: fit(id), i })).filter((o) => all || o.fit !== "other");
    return out.sort((a, b) => rank[a.fit] - rank[b.fit] || a.i - b.i).map(({ id, fit }) => ({ id, fit }));
  }
  function missing() {
    const S = SEX(), out = [];
    for (const r of Object.keys(FALLBACK_SEX)) for (const sx of ["m", "f"]) {
      if (S[r] !== sx && S[r + "-" + sx] !== sx) out.push([r, sx]);
    }
    return out;
  }
  const url = (id) => (typeof BUSTART !== "undefined" ? BUSTART.url(id) : "");
  const img = (id, u) => `<img class="bustimg" src="${esc(u)}" alt="" draggable="false" decoding="async">`;
  const drawn = (c, size) => { try { return typeof HEROART !== "undefined" ? HEROART.portrait(c, size) : ""; } catch { return ""; } };
  /* a small round portrait (player lists, party, chat, map panel): the drawn one until the painting loads (bustart.js fill swaps it) */
  function portrait(c, size = 40, fallback) {
    const id = of(c), u = url(id);
    return `<span class="bustslot avport${u ? " ok" : ""}" data-bust="${esc(id)}" data-bk="av" style="--av:${size | 0}px" aria-hidden="true">${u ? img(id, u) : fallback ?? drawn(c, size)}</span>`;
  }
  /* someone we've never seen: a plain shape, no face */
  const SIL = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7.5"/><path d="M6 38c1.5-9 7-13 14-13s12.5 4 14 13z"/></svg>`;
  const silhouette = (size = 40) => `<span class="avsil" style="--av:${size | 0}px" aria-hidden="true">${SIL}</span>`;
  /* a friend: their live card, else the portrait we saw last time, else the silhouette */
  function face(card, cached, size = 40) {
    if (card && (card.race || card.look)) return portrait(card, size);
    if (valid(cached)) return portrait({ avatar: cached }, size, silhouette(size));
    return silhouette(size);
  }
  function remember(s, id, card) {
    const f = s?.friends?.[id];
    if (!f || !card || !(card.race || card.look)) return false;
    const p = of(card); if (f.pic === p) return false;
    s.friends = { ...s.friends, [id]: { ...f, pic: p } };
    return true;
  }
  /* the paper doll's corner: your portrait, shown once the painting is in */
  function badge(s, size = 60) {
    const id = of(s), u = url(id);
    return `<span class="bustslot bust-badge${u ? " ok" : ""}" data-bust="${esc(id)}" data-bk="badge" style="--bs:${size | 0}px" aria-hidden="true">${u ? img(id, u) : ""}</span>`;
  }
  /* the Character sheet: big and round; tap → picker */
  function hero(c, fallback = "", tap = false) {
    const id = of(c), u = url(id);
    const inner = `<span class="bustslot bust-hero bust-av${u ? " ok" : ""}" data-bust="${esc(id)}" data-bk="hero">${u ? img(id, u) : fallback}</span>`;
    return tap ? `<button class="avbtn" data-act="avatar" aria-label="Change your portrait" title="Change your portrait">${inner}<span class="avedit" aria-hidden="true">✎</span></button>` : inner;
  }
  const FIT = { own: "Your race", near: "Closest match", sex: "", other: "" };
  /* the picker grid. cur = "" for Automatic. attr(id) gives each button's data attributes */
  function grid(c, cur = "", all = false, attr = (id) => `data-av="${esc(id)}"`, allAttr = `data-av-all="1"`) {
    cur = valid(cur) ? cur : "";
    const a = auto(c), list = options(c, all);
    const tile = (id, label, line, note, on) => {
      const u = url(id || a);
      return `<button class="avtile${on ? " on" : ""}" ${attr(id || "auto")} role="radio" aria-checked="${on}">
        <span class="bustslot avface${u ? " ok" : ""}" data-bust="${esc(id || a)}" data-bk="avt">${u ? img(id || a, u) : drawn(id ? { race: portraitRace(id), sex: SEX()[id], id: "av-" + id } : c, 64)}</span>
        <b>${esc(label)}</b><span>${esc(line)}</span>${note ? `<i>${esc(note)}</i>` : ""}</button>`;
    };
    const sexWord = (id) => (SEX()[id] === "f" ? "Woman" : "Man");
    return `<div class="avgrid" role="radiogroup" aria-label="Portrait">
      ${tile("", "Automatic", "Follows your race and sex", "", !cur)}
      ${list.map(({ id, fit }) => tile(id, raceName(portraitRace(id)), sexWord(id), FIT[fit], cur === id)).join("")}
      </div>${all ? "" : `<button class="btn sm avall" ${allAttr}>Show all portraits</button>`}`;
  }
  const cardBits = (s) => ({ avatar: chosen(s) || null });
  /* the Character sheet's picker window */
  function sheet(s, all = false) {
    return `<h2>Your portrait</h2><p class="sub">The face friends see next to your name. Automatic follows your race and sex.</p>
      ${grid(s, chosen(s), all, (id) => `data-act="avpick" data-id="${esc(id)}"`, `data-act="avall"`)}
      <button class="btn" data-act="close" style="width:100%;margin-top:10px">Close</button>`;
  }
  return { IDS, NEAR, valid, chosen, auto, of, set, options, missing, portrait, silhouette, face, remember, badge, hero, grid, sheet, cardBits, raceOf, sexOf };
})();
if (typeof module !== "undefined") module.exports = AVATAR;
