/* One search box for everything: your items and every item in the game, spells (known, and where to buy the tomes of
   the rest), perks, skills, places you know, your quests, followers, recipes (forge, alchemy, cooking) and settings.
   Typos are fine ("dragnbone", "restor helth"). Results come grouped with their icons; tapping one opens the right
   screen: the item in your pack, the perk's star, the place on the map with a Travel button, the quest in the Journal,
   the setting's row. Things without a screen of their own (a sword you don't own, a tome you haven't read, a recipe)
   open a small card here with where to get it. Places you haven't found never show their names.
   The index is built the first time you search and kept; only what changes (your pack, quests, places) is read
   fresh. Only reads the save; everything it opens is the game's own screens. [OURS]
   SEARCH.open("query") opens the box from anywhere. SEARCH.query(S, "query") is the pure search (tested in node). */
const SEARCH = (() => {
  const live = typeof document !== "undefined" && typeof document.createElement === "function" && typeof document.addEventListener === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* which other modules are loaded (top-level consts aren't on window, so each needs its own typeof) */
  const LOADED = { QUESTS: () => typeof QUESTS, WORLD: () => typeof WORLD, PERKS: () => typeof PERKS, POWERS: () => typeof POWERS, TOWNS: () => typeof TOWNS, SMITH: () => typeof SMITH,
    COOK: () => typeof COOK, EFFECTS: () => typeof EFFECTS, INGREDIENT_FX: () => typeof INGREDIENT_FX, SKILLINFO: () => typeof SKILLINFO, SPELLBOOK: () => typeof SPELLBOOK, MAGIC: () => typeof MAGIC, GATHER: () => typeof GATHER, TOMEINFO: () => typeof TOMEINFO };
  const has = (n) => { try { return LOADED[n]() !== "undefined"; } catch { return false; } };
  const PER_GROUP = 5, MORE_GROUP = 30, MAX_Q = 60;

  // ------------------------------------------------------------ fuzzy matching (pure)
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const words = (s) => { const n = norm(s); return n ? n.split(" ") : []; };
  /* edit distance with swaps (OSA), giving up past max */
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let p2 = null, p1 = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let lo = i;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + c);
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v; if (v < lo) lo = v;
      }
      if (lo > max) return max + 1;
      p2 = p1; p1 = cur;
    }
    return p1[b.length];
  }
  /* how well one typed word fits one of these words (0 = not at all) */
  function wordScore(t, w) {
    if (w === t) return 100;
    if (w.startsWith(t)) return 86 - Math.min(16, w.length - t.length);
    if (t.length < 3) return 0;
    if (w.includes(t)) return 58;
    if (t[0] !== w[0] && t[0] !== w[1] && t[1] !== w[0]) return 0;   // typos rarely hit the first letter: skip the slow part
    const max = t.length >= 7 ? 2 : 1;
    let d = dist(t, w, max);
    if (d > max && w.length > t.length) d = Math.min(d, dist(t, w.slice(0, t.length), max), dist(t, w.slice(0, t.length + 1), max));   // a typo while still typing
    return d <= max ? 46 - d * 12 : 0;
  }
  /* how well one typed word fits the best of these words (0 = none); cache: word → score for this typed word */
  function tokScore(t, ws, cache) {
    let best = 0;
    for (const w of ws) {
      let s = cache ? cache.get(w) : undefined;
      if (s === undefined) { s = wordScore(t, w); if (cache) cache.set(w, s); }
      if (s > best) { best = s; if (s === 100) break; }
    }
    return best;
  }
  /* an entry's score for the typed words: every word must fit the name or the extra keywords */
  function score(qt, qn, e, caches) {
    let tot = 0;
    for (let i = 0; i < qt.length; i++) {
      const t = qt[i], cc = caches && caches[i];
      const s = Math.max(tokScore(t, e.w, cc), e.kw.length ? tokScore(t, e.kw, cc) * 0.7 : 0);
      if (!s) return 0;
      tot += s;
    }
    tot /= qt.length;
    if (e.n === qn) tot += 40; else if (e.n.startsWith(qn)) tot += 24;
    return tot + (e.boost || 0);
  }

  // ------------------------------------------------------------ the index (built once, lazily)
  const GROUPS = [
    ["mine", "Your items", "🎒"], ["spell", "Spells & shouts", "✨"], ["perk", "Perks", "★"], ["skill", "Skills", "📈"], ["place", "Places", "📍"],
    ["quest", "Quests", "📜"], ["follower", "Followers", "🛡"], ["item", "Items in the game", "📦"], ["recipe", "Recipes", "⚒"], ["setting", "Settings", "⚙"],
  ];
  const KIND = { city: "City", town: "Town", farm: "Farm", dungeon: "Dungeon", fort: "Fort", camp: "Camp", lair: "Dragon lair", stone: "Standing stone", shrine: "Shrine", landmark: "Landmark" };
  const PLACE_ICO = { city: "🏰", town: "🏘", farm: "🌾", dungeon: "🕳", fort: "🏯", camp: "⛺", lair: "🐉", stone: "🗿", shrine: "⛩", landmark: "📍" };
  const SHOP_NAME = { general: "general stores", blacksmith: "blacksmiths", wizard: "court wizards" };
  /* [label, section, how to find the row ("k:" a pref key, "#" an element id, "a:" a button's data-act), extra words] */
  const SETTINGS = [
    ["Music volume", "Sound", "#snd_music", "sound volume"], ["Sound effects volume", "Sound", "#snd_sfx", "sfx volume"], ["Ambience volume", "Sound", "#snd_amb", "ambient sound volume"],
    ["All sound on or off", "Sound", "k:mute", "mute silence quiet"],
    ["Back up your character", "Your character", "a:bk", "save backup export copy"], ["Restore from a backup", "Your character", "a:bk", "load import"],
    ["Art style: hand-drawn or pixel art", "Look", "k:artStyle", "graphics ink pixel retro"], ["Motion and animations", "Look", "k:motion", "animation lite"],
    ["Foe turn speed", "Fights", "k:tbFast", "fast combat speed"],
    ["Text size", "Accessibility", "k:a11yText", "font bigger zoom large"], ["Colour-blind help", "Accessibility", "k:a11yColour", "color blind protan deutan tritan"],
    ["High-contrast text", "Accessibility", "k:a11yContrast", "contrast"], ["Reduce motion", "Accessibility", "k:a11yMotion", "shake flash"],
    ["One-hand mode", "Accessibility", "k:a11yHand", "thumb left right hand"],
    ["Crafting mini-games or quick craft", "Crafting", "k:craftGame", "minigame forge smith"], ["Cold meter", "Survival", "k:survival", "freeze cold survival warmth"],
    ["Map opens close up or all Skyrim", "Map", "k:zoomFar", "zoom"], ["Phone notifications", "Phone", "k:notify", "notification alert"],
    ["Guide for new players", "Help", "a:guide", "help tutorial how"],
    ["Patch notes", "Help", "a:notes", "changes news version"], ["Main menu", "Help", "a:totitle", "title quit exit"],
  ];
  let IDX = null, IDXKEY = "";
  const mk = (k, id, name, kw, extra) => ({ k, id, name, n: norm(name), w: words(name), kw: words(kw || ""), ...extra });
  function idxKey() {
    try { return [Object.keys(D.ITEMS).length, Object.keys(D.SPELLS).length, has("QUESTS") ? Object.keys(QUESTS.L).length : 0, has("WORLD") ? Object.keys(WORLD.places).length : 0].join("|"); } catch { return "x"; }
  }
  function build() {
    const out = [];
    const push = (e) => { if (e.w.length) out.push(e); };
    // items in the game (tomes live under spells, enchanted copies under your items)
    for (const [id, it] of Object.entries(D.ITEMS)) {
      if (!it || !it.name || id.includes("|") || it.slot === "tome" || it.hidden) continue;
      push(mk("item", id, it.name, `${it.slot || ""} ${it.skill || ""} ${it.type || ""}`));
    }
    // spells (custom ones only show when you know them)
    for (const [id, sp] of Object.entries(D.SPELLS)) {
      if (!sp || !sp.name || sp.hidden) continue;
      push(mk("spell", id, sp.name, `${sp.school || ""} ${sp.level || ""} ${sp.element || ""} ${sp.kind || ""} spell tome`, { custom: !!sp.custom }));
    }
    if (has("POWERS")) for (const [id, row] of Object.entries(POWERS.SHOUTS || {})) push(mk("spell", "shout:" + id, row[0], `shout ${(row[1] || []).join(" ")}`, { shout: id }));
    // perks
    if (has("PERKS")) for (const [sk, tree] of Object.entries(PERKS.TREES)) tree.forEach(([id, name], i) => push(mk("perk", id, name, `${sk} perk`, { sk, i })));
    // skills
    for (const sk of D.ALL_SKILLS || []) push(mk("skill", sk, sk, "skill level", { boost: 6 }));
    // places (hidden from results until known)
    if (has("WORLD")) for (const [name, p] of Object.entries(WORLD.places)) push(mk("place", name, name, `${KIND[p[2]] || ""}`, { kind: p[2] }));
    // quests
    if (has("QUESTS")) for (const [id, q] of Object.entries(QUESTS.L)) if (q && q.name) push(mk("quest", id, q.name, `quest ${q.giver || ""}`));
    // followers
    if (has("TOWNS")) for (const [id, f] of Object.entries(TOWNS.FOLLOWERS || {})) push(mk("follower", id, f[0], "follower companion hire housecarl"));
    // recipes: forge, cooking pot, alchemy effects
    if (has("SMITH")) for (const [id, r] of Object.entries(SMITH.RECIPES)) if (D.ITEMS[id]) push(mk("recipe", "smith:" + id, D.ITEMS[id].name, `forge smith smithing make craft ${r.group}`, { rk: "smith", item: id }));
    if (has("COOK")) for (const [id, r] of Object.entries(COOK.RECIPES)) push(mk("recipe", "cook:" + id, r[0], "cook cooking food dish recipe", { rk: "cook", rid: id, item: "dish_" + id }));
    if (has("EFFECTS") && has("INGREDIENT_FX")) for (const [eff, row] of Object.entries(EFFECTS)) push(mk("recipe", "alch:" + eff, `${row[4] ? "Potion" : "Poison"} of ${eff}`, `alchemy potion poison brew mix ${eff}`, { rk: "alch", eff }));
    // settings
    SETTINGS.forEach(([label, sec, find, kw], i) => push(mk("setting", "set:" + i, label, `${sec} setting settings option ${kw}`, { sec, find })));
    return out;
  }
  function index() { const k = idxKey(); if (!IDX || k !== IDXKEY) { IDX = build(); IDXKEY = k; } return IDX; }

  // ------------------------------------------------------------ what the player can see (read fresh each search)
  const knownPlace = (S, n) => (S.discovered || []).includes(n) || (has("WORLD") && WORLD.places[n] && ["city", "town"].includes(WORLD.places[n][2]) && !WORLD.hidden?.has?.(n));
  const qState = (S, id) => { const v = (S.quests || {})[id]; if (!v) return null; return v.done ? "done" : "active"; };
  const countOf = (S, item) => (S.inv || []).filter((r) => r.item === item).reduce((a, r) => a + (r.qty || 1), 0);
  function visible(S, e) {
    if (e.k === "place") return knownPlace(S, e.id);
    if (e.k === "quest") return !!qState(S, e.id);
    if (e.k === "spell" && e.shout) return has("POWERS") && (POWERS.SHOUTS[e.shout][1] || []).some((w) => POWERS.known(S, w));
    if (e.k === "spell" && e.custom) return (S.spells || []).includes(e.id);
    if (e.k === "item") return countOf(S, e.id) === 0;   // what you own shows under "Your items"
    return true;   // followers show everywhere; where they wait only once you know the town
  }
  /* your own pack, one entry per stack */
  function mine(S) {
    return (S.inv || []).filter((r) => D.ITEMS[r.item]).map((r) => {
      const it = D.ITEMS[r.item], q = r.tq && has("TOWNS") ? (TOWNS.QUALITY[r.tq] || "") + " " : "";
      return mk("mine", r.id, q + it.name + (r.nm ? ` ${r.nm}` : ""), `${it.slot || ""} ${it.skill || ""}`, { row: r, item: r.item, boost: 8 });
    });
  }

  /* the search itself: groups in order of their best hit, each sorted by score */
  function query(S, text) {
    const qn = norm(text).slice(0, MAX_Q), qt = qn ? qn.split(" ").filter(Boolean) : [];
    if (!qt.length || !S) return { q: qn, groups: [], hint: null, total: 0 };
    const hits = {}, hidden = [], caches = qt.map(() => new Map());
    const consider = (e) => {
      const s = score(qt, qn, e, caches); if (!s) return;
      if (!visible(S, e)) { if (e.k === "place" && s >= 80) hidden.push(e); return; }
      (hits[e.k] = hits[e.k] || []).push({ e, s });
    };
    for (const e of index()) consider(e);
    for (const e of mine(S)) consider(e);
    const groups = GROUPS.filter(([k]) => hits[k]).map(([k, label, ico]) => {
      const l = hits[k].sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name));
      return { k, label, ico, top: l[0].s, list: l.map((h) => h.e), n: l.length };
    }).sort((a, b) => b.top - a.top);
    const shownPlaces = hits.place?.length || 0;
    // a place you haven't found: say it's out there, never its name (only for a clear match on a longer word)
    const hint = !shownPlaces && hidden.length && qn.length >= 4 ? { k: "hint", kind: hidden[0].kind, n: hidden.length } : null;
    return { q: qn, groups, hint, total: groups.reduce((a, g) => a + g.n, 0) };
  }

  // ------------------------------------------------------------ one-line descriptions under each result
  const safe = (f, d = "") => { try { return f(); } catch { return d; } };
  function sub(S, e) {
    return safe(() => {
      switch (e.k) {
        case "mine": { const r = e.row, eq = new Set(Object.values(G.loadout(S).equipment || {})); return [G.itemStats(r.item), r.qty > 1 ? `×${r.qty}` : "", eq.has(r.id) ? "worn" : "", r.stolen ? "stolen" : ""].filter(Boolean).join(" · "); }
        case "item": return [G.itemStats(e.id), `${D.ITEMS[e.id].value} gold`].filter(Boolean).join(" · ");
        case "spell": {
          if (e.shout) return `Shout · ${(POWERS.SHOUTS[e.shout][1] || []).map((w) => POWERS.known(S, w) ? w : "···").join(" ")}`;
          const sp = D.SPELLS[e.id], kn = (S.spells || []).includes(e.id);
          return `${sp.school} · ${sp.level || "Novice"} · ${kn ? "you know it" : countOf(S, "tome_" + e.id) ? "tome in your pack" : "not learned yet"}`;
        }
        case "perk": {
          const r = PERKS.rank(S, e.id), p = PERKS.BY_ID[e.id], ranks = p.ranks || 1;
          if (r >= ranks) return `${e.sk} tree · ✓ you have it${ranks > 1 ? ` (${r}/${ranks})` : ""}`;
          const skOk = S.skills[p.skill].lvl >= p.req[r], pkOk = !p.needs.length || p.needs.some((x) => PERKS.rank(S, x) > 0);
          const need = [skOk ? "" : `${p.skill} ${p.req[r]}`, pkOk ? "" : p.needs.map((x) => PERKS.BY_ID[x]?.name || x).join(" or ")].filter(Boolean).join(" + ");
          const now = !PERKS.canTake(S, e.id) ? "✦ you can take it now" : need ? `needs ${need}` : "ready when you have a perk point";
          return `${e.sk} tree${r ? ` · rank ${r}/${ranks}` : ""} · ${now}`;
        }
        case "skill": { const s = S.skills[e.id]; return `Level ${s.lvl}${has("SKILLINFO") ? ` · ${SKILLINFO.summary(e.id) || ""}` : ""}`; }
        case "place": { const p = WORLD.places[e.id]; return `${KIND[p[2]] || "Place"} · ${G.holdAt(p)}${(S.discovered || []).includes(e.id) ? "" : " · not visited yet"}${S.location === e.id ? " · you are here" : ""}`; }
        case "quest": { const st = qState(S, e.id), q = QUESTS.L[e.id], a = st === "active" ? QUESTS.active(S).find((x) => x.id === e.id) : null; return st === "done" ? "Completed" : `Active${a?.st?.title ? ` · ${a.st.title}` : ""}${q.giver ? ` · ${q.giver}` : ""}`; }
        case "follower": { const f = TOWNS.FOLLOWERS[e.id]; return S.follower?.id === e.id ? "With you now" : `${f[2] ? `${f[2]} gold` : "Free"} · ${f[1] && knownPlace(S, f[1]) ? `in ${f[1]}` : "somewhere in Skyrim"}`; }
        case "recipe":
          if (e.rk === "smith") { const r = SMITH.RECIPES[e.item]; return `Forge · ${(SMITH.GROUPS.find(([g]) => g === r.group) || [, r.group])[1]}${r.perk ? ` · needs ${PERKS.BY_ID[r.perk]?.name || r.perk}` : ""}`; }
          if (e.rk === "cook") return `Cooking pot · ${COOK.RECIPES[e.rid][3]}`;
          { const n = alchIngredients(S, e.eff); return `Alchemy · ${n.known.length ? `${n.known.length} ingredient${n.known.length === 1 ? "" : "s"} you know` : "no known ingredients yet"}`; }
        case "setting": return `Settings · ${e.sec}`;
      }
      return "";
    });
  }
  function icon(S, e, size = 30) {
    const ic = safe(() => {
      switch (e.k) {
        case "mine": return ICONART.item(e.item, size, e.row);
        case "item": return ICONART.item(e.id, size);
        case "spell": return e.shout ? UIART.shout(e.shout, size) : UIART.spell(e.id, size);
        case "perk": return UIART.skill(e.sk, size);
        case "skill": return UIART.skill(e.id, size);
        case "quest": return UIART.quest(e.id, size);
        case "follower": return UIART.follower(e.id, size);
        case "recipe": return e.rk === "alch" ? ICONART.item(alchIcon(e.eff), size) : ICONART.item(D.ITEMS[e.item] ? e.item : "potion_health", size);
      }
      return "";
    });
    if (ic) return ic;
    const emo = e.k === "place" ? PLACE_ICO[e.kind] || "📍" : (GROUPS.find(([k]) => k === e.k) || [])[2] || "•";
    return `<span class="srch-emo" aria-hidden="true">${emo}</span>`;
  }
  const alchIcon = (eff) => { const r = has("EFFECTS") ? EFFECTS[eff] : null; return r && !r[4] ? (D.ITEMS.poison_weak ? "poison_weak" : "potion_health") : /Magicka/.test(eff) ? "potion_magicka" : /Stamina/.test(eff) ? "potion_stamina" : "potion_health"; };
  function alchIngredients(S, eff) {
    const known = [], unknown = [];
    if (!has("INGREDIENT_FX")) return { known, unknown };
    for (const [id, row] of Object.entries(INGREDIENT_FX)) {
      const i = row[1].indexOf(eff); if (i < 0) continue;
      ((S.known || {})[id] || [])[i] ? known.push(id) : unknown.push(id);
    }
    return { known, unknown };
  }

  // ------------------------------------------------------------ the box (browser only)
  let q = "", res = null, open_ = false, more = {}, timer = 0, detail = null, flat = [];
  const $ = (s) => document.querySelector(s);
  const ui = () => window.__ui || {};
  const save = () => window.__dbg?.save?.();
  const fx = (n) => { try { SOUND.fx(n); } catch { /* sound never breaks the game */ } };
  function recent() { try { return JSON.parse(localStorage.getItem("rotn_search") || "[]").slice(0, 6); } catch { return []; } }
  function remember(text) { const t = String(text || "").trim(); if (t.length < 2) return; try { localStorage.setItem("rotn_search", JSON.stringify([t, ...recent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 6))); } catch { /* private mode */ } }
  /* the HUD button (ui.js puts it in the top bar) */
  const btn = () => `<button class="iconbtn srchb" id="srchBtn" aria-label="Search everything"><svg class="hico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2l5.6 5.6"/></svg><small class="ibl" aria-hidden="true">Search</small></button>`;
  function hilite(name) {
    const t = (q.trim().split(/\s+/)[0] || "").toLowerCase(), i = t.length >= 2 ? name.toLowerCase().indexOf(t) : -1;
    return i < 0 ? esc(name) : `${esc(name.slice(0, i))}<mark>${esc(name.slice(i, i + t.length))}</mark>${esc(name.slice(i + t.length))}`;
  }
  function resultsHTML(S) {
    flat = [];
    if (!q.trim()) {
      const r = recent();
      return `<p class="sub srch-tip">Search your pack, every item, spells, perks, skills, places you know, quests, followers, recipes and settings. Typos are fine.</p>
        ${r.length ? `<h3 class="srch-g">Recent</h3><div class="srch-chips">${r.map((x) => `<button class="chip" data-sr="re" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : ""}
        <h3 class="srch-g">Try</h3><div class="srch-chips">${["healing", "dragonbone", "fireball", "Whiterun", "one-handed", "text size"].map((x) => `<button class="chip" data-sr="re" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</div>`;
    }
    if (!res) return "";
    if (!res.groups.length && !res.hint) return `<p class="sub srch-none">Nothing matches “${esc(q)}”. Try fewer letters, or another word for it.</p>`;
    let h = "";
    for (const g of res.groups) {
      const cap = more[g.k] ? MORE_GROUP : PER_GROUP;
      h += `<h3 class="srch-g"><span aria-hidden="true">${g.ico}</span> ${esc(g.label)} <span class="num">${g.n}</span></h3><div class="srch-list">`;
      for (const e of g.list.slice(0, cap)) { flat.push(e); h += `<button class="srch-r" data-sr="pick" data-i="${flat.length - 1}">${icon(S, e)}<span class="t"><b>${hilite(e.name)}</b><small>${esc(sub(S, e))}</small></span><span class="srch-go" aria-hidden="true">›</span></button>`; }
      h += `</div>${g.n > cap ? `<button class="linkbtn srch-more" data-sr="more" data-k="${g.k}">Show ${Math.min(g.n, MORE_GROUP) - cap} more</button>` : ""}`;
    }
    if (res.hint) h += `<h3 class="srch-g"><span aria-hidden="true">📍</span> Places</h3><div class="srch-list"><div class="srch-r srch-hint"><span class="srch-emo" aria-hidden="true">❔</span><span class="t"><b>??? (not found yet)</b><small>${res.hint.n > 1 ? "Some places" : `A ${(KIND[res.hint.kind] || "place").toLowerCase()}`} by that name ${res.hint.n > 1 ? "are" : "is"} still out there. Explore to find ${res.hint.n > 1 ? "them" : "it"}.</small></span></div></div>`;
    return h;
  }
  function render() {
    const el = $("#srch"); if (!el) return;
    const S = save(); if (!S) return close();
    const body = el.querySelector(".srch-body");
    body.innerHTML = detail ? detailHTML(S, detail) : resultsHTML(S);
    el.querySelector(".srch-q").classList.toggle("hide", !!detail);
    body.scrollTop = 0;
  }
  function run() { const S = save(); res = S ? query(S, q) : null; more = {}; render(); }
  function open(text = "") {
    if (!live) return false;
    const S = save(); if (!S || $("#title")) return false;
    const m0 = $("#modal");
    if (m0 && m0.querySelector("[data-act=enc], [data-act=ev], [data-act=guard]")) return false;   // a fight or a road event is waiting
    m0?.remove();
    if (typeof TB !== "undefined" && TB.open) return false;
    const m = document.createElement("div");
    m.className = "modal srch-m"; m.id = "modal";
    m.innerHTML = `<div class="sheet srch" id="srch" role="dialog" aria-modal="true" aria-label="Search">
      <div class="srch-q"><input id="srchq" type="search" placeholder="🔍 Search everything" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search everything" maxlength="${MAX_Q}"><button class="iconbtn" data-sr="close" aria-label="Close search">✕</button></div>
      <div class="srch-body" aria-live="polite"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", onClick);
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); detail ? (detail = null, render()) : close(); } if (e.key === "Enter" && e.target.id === "srchq") { e.preventDefault(); if (flat[0]) pick(flat[0]); } });
    const inp = m.querySelector("#srchq");
    inp.addEventListener("input", () => { q = inp.value; clearTimeout(timer); timer = setTimeout(run, q.length < 3 ? 140 : 90); });
    q = String(text || ""); inp.value = q; detail = null; open_ = true;
    run();
    fx("page");
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch { /* ignore */ } }, 30);
    return true;
  }
  function close() { clearTimeout(timer); open_ = false; detail = null; const m = $("#modal"); if (m && m.classList.contains("srch-m")) m.remove(); }
  function onClick(e) {
    const m = $("#modal");
    if (e.target === m) return close();   // tap outside the sheet
    const b = e.target.closest("[data-sr]"); if (!b) return;
    const a = b.dataset.sr;
    if (a === "close") return close();
    if (a === "re") { q = b.dataset.q; const inp = $("#srchq"); if (inp) inp.value = q; return run(); }
    if (a === "more") { more[b.dataset.k] = true; fx("click"); const y = $("#srch .srch-body")?.scrollTop || 0; render(); const bd = $("#srch .srch-body"); if (bd) bd.scrollTop = y; return; }
    if (a === "pick") return pick(flat[+b.dataset.i]);
    if (a === "back") { detail = null; fx("click"); return render(); }
    if (a === "go") return detailGo(b);
  }

  // ------------------------------------------------------------ opening the right screen
  /* press one of the game's own buttons (ui.js handles data-act clicks on the side panel) */
  function fire(act, data = {}) {
    const side = document.getElementById("side"); if (!side) return false;
    const b = document.createElement("button"); b.type = "button"; b.hidden = true; b.dataset.act = act;
    for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
    side.appendChild(b); b.click(); b.remove(); return true;
  }
  const later = (f, n = 2) => { const go = () => (n-- > 0 ? requestAnimationFrame(go) : f()); requestAnimationFrame(go); };
  function flash(el) { if (!el) return; try { el.scrollIntoView({ block: "center", behavior: "auto" }); } catch { /* ignore */ } el.classList.remove("srch-flash"); void el.offsetWidth; el.classList.add("srch-flash"); setTimeout(() => el.classList.remove("srch-flash"), 2200); }
  function leave() { if (q.trim()) remember(q); close(); if (typeof TABMENU !== "undefined" && TABMENU.open) TABMENU.closeHub(); }
  function inMenu(page, sel, cat = "all") {
    const u = ui(); if (!u.openMenu) return;
    u.openMenu(page);
    $(`#sky [data-act=skycat][data-id="${cat}"]`)?.click();
    const row = [...document.querySelectorAll("#sky [data-act=skysel]")].find((x) => x.dataset.id === String(sel));
    if (row) { row.click(); later(() => flash($("#sky .sky-row.sel")), 1); }
  }
  function toSkill(sk, perkIdx = null) {
    if (typeof TABMENU !== "undefined" && TABMENU.go) {
      TABMENU.starSkill = sk; TABMENU.go("char", false);
      later(() => {
        document.querySelector(".tw-card.on")?.scrollIntoView({ inline: "center", block: "nearest" });
        if (perkIdx != null) document.querySelector(`.tw-big [data-sk-perk="${perkIdx}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      return;
    }
    if (perkIdx == null) return inMenu("skills", sk);
    fire("skyperks", { id: sk });
    later(() => { const st = document.querySelector(`#side [data-sk-perk="${perkIdx}"]`); st ? st.dispatchEvent(new MouseEvent("click", { bubbles: true })) : null; }, 3);
  }
  function toQuest(id) {
    const u = ui(); u.go?.("log"); window.scrollTo(0, 0);
    let card = document.getElementById("q-" + id);
    for (const t of qState(save(), id) === "done" ? ["done"] : ["active", "misc"]) { if (card) break; fire("jtab", { id: t }); card = document.getElementById("q-" + id); }
    later(() => flash(document.getElementById("q-" + id)));
  }
  function toPlace(n) { fire("qmap", { place: n }); later(() => { document.getElementById("mapwrap")?.scrollIntoView({ block: "start" }); flash(document.getElementById("picked")); }); }
  function toSetting(find) {
    document.getElementById("sndBtn")?.click();
    later(() => {
      const m = $("#modal"); if (!m) return;
      let el = null;
      if (find.startsWith("#")) el = m.querySelector(find)?.closest("label, .setrow");
      else if (find.startsWith("k:")) el = m.querySelector(`[data-k="${find.slice(2)}"]`)?.closest(".setrow");
      else if (find.startsWith("a:")) el = m.querySelector(`[data-act="${find.slice(2)}"]`);
      flash(el || m.querySelector("h2"));
    }, 1);
  }
  function toTown(section) { ui().go?.("town"); if (section) fire("shop", { id: section }); window.scrollTo(0, 0); }
  function toHero(text) {
    ui().go?.("hero");
    later(() => { const el = [...document.querySelectorAll("#side .panel")].find((p) => p.textContent.includes(text)); flash(el); });
  }
  function pick(e) {
    if (!e) return;
    const S = save(); if (!S) return;
    fx("click");
    switch (e.k) {
      case "mine": leave(); return inMenu("items", e.id);
      case "spell":
        if (e.shout) { leave(); return inMenu("magic", "shout:" + e.shout); }
        if ((S.spells || []).includes(e.id)) { leave(); return inMenu("magic", "spell:" + e.id); }
        break;
      case "perk": leave(); return toSkill(e.sk, e.i);
      case "skill": leave(); return toSkill(e.id);
      case "place": leave(); return toPlace(e.id);
      case "quest": leave(); return toQuest(e.id);
      case "follower": if (S.follower?.id === e.id) { leave(); return toHero(TOWNS.FOLLOWERS[e.id][0]); } break;
      case "setting": leave(); return toSetting(e.find);
    }
    if (q.trim()) remember(q);
    detail = e; render();
  }

  // ------------------------------------------------------------ cards for things without a screen of their own
  const row = (k, v) => `<div class="srch-kv"><span>${k}</span><b>${v}</b></div>`;
  const have = (S, item, n) => { const c = item === "fish" && has("COOK") ? COOK.countOf(S, "fish") : countOf(S, item); return `<span class="${c >= n ? "srch-ok" : "srch-no"}">${c}/${n}</span>`; };
  const itemName = (id) => id === "fish" ? "Any fish" : D.ITEMS[id]?.name || (has("COOK") && COOK.FOOD[id]?.name) || id;
  const goBtn = (label, how, val, pri) => `<button class="btn ${pri ? "pri" : ""}" data-sr="go" data-how="${how}" data-v="${esc(val)}">${label}</button>`;
  function whereItem(S, id) {
    const it = D.ITEMS[id], out = [];
    const shops = Object.entries(D.SHOP_STOCK || {}).filter(([, l]) => l.includes(id) && (typeof SHOPCAP === "undefined" || SHOPCAP.ok(id))).map(([t]) => SHOP_NAME[t] || t);
    if (shops.length) out.push(`Sold by ${shops.join(" and ")}.`);
    if (has("SMITH") && SMITH.RECIPES[id]) out.push("You can make it at a forge (see the recipe below).");
    if (/^dish_/.test(id)) out.push("Cooked at an inn's pot or your own campfire.");
    if (has("GATHER") && GATHER.WHERE[id]) out.push(`Found: ${GATHER.WHERE[id]}.`);
    if (it.slot === "ingredient" && !out.length) out.push("Alchemists sell ingredients, and they grow in the wild.");
    if (!out.length) out.push("Found as loot on the road and in dungeons, or bought in towns.");
    return out.join(" ");
  }
  function detailHTML(S, e) {
    const back = `<button class="btn sm srch-back" data-sr="back">‹ Back to results</button>`;
    let h = "";
    if (e.k === "item") {
      const it = D.ITEMS[e.id];
      h = `<div class="srch-dh">${icon(S, e, 56)}<div><h2>${esc(it.name)}</h2><p class="sub">${esc(safe(() => G.itemStats(e.id)))}</p></div></div>
        <div class="srch-kvs">${row("Value", `${it.value ?? 0} gold`)}${row("Weight", it.weight ?? 0)}${it.skill ? row("Skill", esc(it.skill)) : ""}</div>
        <p class="sub">${esc(whereItem(S, e.id))}</p>
        <div class="srch-acts">${has("SMITH") && SMITH.RECIPES[e.id] ? goBtn("⚒ How to forge it", "recipe", "smith:" + e.id) : ""}${/^dish_/.test(e.id) ? goBtn("🍲 The recipe", "recipe", "cook:" + e.id.slice(5)) : ""}</div>`;
    } else if (e.k === "spell") {
      const sp = D.SPELLS[e.id], lv = sp.level || "Novice", tome = "tome_" + e.id, own = countOf(S, tome);
      const gate = has("SPELLBOOK") ? SPELLBOOK.GATE[lv] : 0, skl = safe(() => G.skill(S, sp.school), 0);
      const where = lv === "Master" ? `Master spells are taught at the College after ${sp.school}'s ritual.`
        : lv === "Expert" ? "Expert tomes are sold at the College of Winterhold."
        : lv === "Novice" ? "Every court wizard sells Novice tomes, and general stores keep a few that change every two in-game days."
        : `Court wizards sell ${lv} tomes; their shelves change every two in-game days.`;
      const now = safe(() => has("SPELLBOOK") ? Object.keys(D.SHOPS || {}).filter((t) => knownPlace(S, t) && SPELLBOOK.inStockAnywhere(S, tome, t)) : [], []);
      h = `<div class="srch-dh">${icon(S, e, 56)}<div><h2>${esc(sp.name)}</h2><p class="sub">${esc(sp.school)} · ${esc(lv)} · not learned yet</p></div></div>
        ${has("TOMEINFO") ? `<div class="srch-spl">${safe(() => TOMEINFO.html(S, e.id, { head: false }), "")}</div>` : has("MAGIC") && MAGIC.infoHTML ? `<div class="srch-spl">${safe(() => MAGIC.infoHTML(S, e.id))}</div>` : ""}
        <h3>How to learn it</h3>
        ${own ? `<p class="srch-ok">You have its tome in your pack. Read it to learn the spell.</p>` : ""}
        <p class="sub">${esc(where)}${gate && lv !== "Master" ? ` ${lv} tomes show up once your ${esc(sp.school)} reaches ${gate} (you have ${skl}).` : ""}</p>
        ${lv !== "Master" ? `<p class="sub">${now.length ? `On a shelf for you right now in: <b>${now.map(esc).join(", ")}</b>.` : "No shop you know has it for you right now."}</p>` : ""}
        <div class="srch-acts">${own ? goBtn("Open it in your pack", "mine", (S.inv.find((r) => r.item === tome) || {}).id, true) : ""}${now.slice(0, 3).map((t) => goBtn(`📍 ${esc(t)}`, "place", t)).join("")}</div>`;
    } else if (e.k === "follower") {
      const f = TOWNS.FOLLOWERS[e.id], town = f[1] && knownPlace(S, f[1]) ? f[1] : null;
      h = `<div class="srch-dh">${icon(S, e, 56)}<div><h2>${esc(f[0])}</h2><p class="sub">${esc(f[5] || "")}</p></div></div>
        <div class="srch-kvs">${row("Hire", f[2] ? `${f[2]} gold` : "free (once they trust you)")}${row("Where", town ? esc(town) : "somewhere in Skyrim")}</div>
        <p class="sub">Followers fight beside you, carry things for you and get knocked down instead of dying. Hire them in town (Area tab).</p>
        <div class="srch-acts">${town && S.location === town ? goBtn("Hirelings in town", "town", "hire", true) : town ? goBtn(`📍 Show ${esc(town)} on the map`, "place", town, true) : ""}</div>`;
    } else if (e.k === "recipe" && e.rk === "smith") {
      const r = SMITH.RECIPES[e.item], it = D.ITEMS[e.item], pk = r.perk ? PERKS.BY_ID[r.perk] : null, okPerk = !r.perk || PERKS.rank(S, r.perk) > 0;
      h = `<div class="srch-dh">${icon(S, e, 56)}<div><h2>${esc(it.name)}</h2><p class="sub">${esc(safe(() => G.itemStats(e.item)))}</p></div></div>
        <h3>What it takes</h3><div class="srch-kvs">${r.mats.map(([m, n]) => row(esc(itemName(m)), have(S, m, n))).join("")}${pk ? row(`Perk: ${esc(pk.name)}`, okPerk ? '<span class="srch-ok">✓ taken</span>' : '<span class="srch-no">not yet</span>') : ""}</div>
        <p class="sub">Made at any blacksmith's forge (Area tab → Forge). Ore is smelted into ingots there, pelts tanned into leather.</p>
        <div class="srch-acts">${safe(() => SMITH.atForge(S)) ? goBtn("⚒ Open the forge", "town", "forge", true) : ""}${pk ? goBtn(`★ ${esc(pk.name)}`, "perk", r.perk) : ""}</div>`;
    } else if (e.k === "recipe" && e.rk === "cook") {
      const r = COOK.RECIPES[e.rid];
      h = `<div class="srch-dh">${icon(S, e, 56)}<div><h2>${esc(r[0])}</h2><p class="sub">${esc(r[3])}</p></div></div>
        <h3>What it takes</h3><div class="srch-kvs">${r[1].map(([m, n]) => row(esc(itemName(m)), have(S, m, n))).join("")}</div>
        <p class="sub">Cook at an inn's cooking pot or your own campfire. General stores sell the vegetables and salt; fish with a rod near water.</p>
        <div class="srch-acts">${safe(() => COOK.atInn(S)) ? goBtn("🍲 Cooking pot", "town", "cook", true) : ""}</div>`;
    } else if (e.k === "recipe" && e.rk === "alch") {
      const n = alchIngredients(S, e.eff), poison = !EFFECTS[e.eff][4];
      h = `<div class="srch-dh">${icon(S, e, 56)}<div><h2>${esc(e.name)}</h2><p class="sub">${poison ? "A poison for your weapon" : "A potion"}</p></div></div>
        <h3>Ingredients you know have it</h3>
        ${n.known.length ? `<div class="srch-kvs">${n.known.map((id) => row(esc(itemName(id)), `${countOf(S, id)} in pack`)).join("")}</div>` : `<p class="sub">None yet. Eat an ingredient or mix it to learn its effects.</p>`}
        ${n.unknown.length ? `<p class="sub">${n.unknown.length} more ingredient${n.unknown.length === 1 ? "" : "s"} you haven't found out yet also ${n.unknown.length === 1 ? "has" : "have"} it.</p>` : ""}
        <p class="sub">Mix two ingredients that share ${esc(e.eff)} at an alchemy lab (Area tab → Alchemy lab).</p>
        <div class="srch-acts">${S.location && !S.trip ? goBtn("⚗ Alchemy lab", "town", "alchemy", true) : ""}</div>`;
    } else return back;
    return `${back}<div class="srch-d">${h}</div>`;
  }
  function detailGo(b) {
    const how = b.dataset.how, v = b.dataset.v, S = save();
    if (how === "recipe") { detail = index().find((e) => e.k === "recipe" && e.id === v) || null; fx("click"); return render(); }
    if (how === "perk") { const e = index().find((x) => x.k === "perk" && x.id === v); if (e) { leave(); toSkill(e.sk, e.i); } return; }
    leave();
    if (how === "place") return toPlace(v);
    if (how === "town") return toTown(v);
    if (how === "mine") return inMenu("items", v);
    if (how === "spell" && S) return inMenu("magic", "spell:" + v);
  }

  // the HUD button and the phone's search key
  if (live) document.addEventListener("click", (e) => { if (e.target.closest?.("#srchBtn")) { e.preventDefault(); open(""); } });

  return { norm, dist, tokScore, score, query, sub, index, btn, open, close, SETTINGS, GROUPS, get isOpen() { return open_ && !!(live && $("#srch")); } };
})();
