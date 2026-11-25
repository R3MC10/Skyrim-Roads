/* rewards.js: one reward pipeline, five weights, all through the notice queue we already have. [OURS]
   The owner: "a dopamine shot from time to time to keep them hooked", honestly: rewards that change what you can do,
   no flashing spam, nothing to buy.
     tiny      loot, gold, skill XP          a quiet stacked line, "+24 gold · +15 One-Handed · Iron Dagger ×2"
                                             (NOTIFY's message lane; what arrives together is one line, a line still on
                                             screen grows instead of a second one; during a fight or a window it waits
                                             and comes out as one line afterwards)
     small     an upgrade found, a new spell  a short toast (NOTIFY banner, P2); discoveries, achievements and new
               or horse, a goal done          objectives are already small banners there
     medium    a level-up, a quest done       a short notice (levelup.js LEVEL UP, NOTIFY P1 quest banners)
     big       a new feature unlocked, your   a full-screen scene: "LEVEL 4 · Smithing unlocked", one line on what you can
               first follower or horse, a     do now, and a button that starts a short intro quest (introquests.js)
               Word of Power
     milestone a legendary item, your first   full screen too, gold
               dragon, a clan
   Scenes go through NOTICES.scene: one at a time with every other window, never on top of a fight, a mini-game, a party
   vote, the dungeon screen or the level-up pillars; they play afterwards. A level-up that opens something new is the
   scene (the LEVEL UP banner steps aside, no double moment).
   Unlocks come from unlocks.js (UNLOCKS.justOpened / next / UNLOCKS.on, or the window "unlocks" event). Without it, a level-up is the medium
   notice as before and the preview says what every level gives (a perk point and +10).
   "Level N brings …" (nextText) shows under the XP bar on the compass, on the hero card and on the level-up screen.
   Effects are drawn by code (a light burst, rays, a shine on the new button), cheap on phones, still under reduced motion.
   The weights, the tiny line and the scene builder are plain functions for tests/test_rewards.js. */
const REWARDS = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ weights (pure)
  const WEIGHTS = ["tiny", "small", "medium", "big", "milestone"];
  const KIND = {
    gold: "tiny", loot: "tiny", xp: "tiny", move: "tiny",
    upgrade: "small", discovery: "small", goal: "small", spell: "small", horse2: "small", word2: "small",
    level: "medium", perk: "medium", quest: "medium",
    unlock: "big", follower: "big", horse: "big", ability: "big",
    legendary: "milestone", boss: "milestone", clan: "milestone",
  };
  const LANE = { tiny: "line", small: "toast", medium: "notice", big: "scene", milestone: "scene" };
  const weigh = (kind, w) => (WEIGHTS.includes(w) ? w : KIND[kind] || "small");
  const lane = (w) => LANE[w] || "toast";

  // ------------------------------------------------------------ the tiny line (pure)
  /* a part: {k, cat, n, one, many?}; one/many carry {n} */
  const part = {
    gold: (n) => ({ k: "gold", cat: "gold", n: +n || 0, one: "+{n} gold" }),
    xp: (skill, n) => ({ k: "xp:" + skill, cat: "xp", n: +n || 0, one: `+{n} ${skill}` }),
    item: (name, n = 1, q = rarity(name)) => ({ k: "item:" + String(name).toLowerCase(), cat: "item", n: +n || 1, one: String(name), many: `${name} ×{n}`, q: q || "" }),
  };
  /* an item's rarity, for its colour (.q-<rarity> in index.html). A rarity field on the item wins (common / fine / rare /
     epic / legendary, coming in another task); until then colorcode.js's tier. "" = no colour. */
  let byName = null;
  function rarity(nameOrId) {
    if (typeof D === "undefined" || !D.ITEMS) return "";
    let id = D.ITEMS[nameOrId] ? nameOrId : null;
    if (!id) { if (!byName) { byName = {}; for (const [k, v] of Object.entries(D.ITEMS)) if (v && v.name && !byName[v.name.toLowerCase()]) byName[v.name.toLowerCase()] = k; } id = byName[String(nameOrId).toLowerCase()]; }
    if (!id) return "";
    const it = D.ITEMS[id];
    const r = it.rarity || it.q;
    if (r) return String(r).toLowerCase();
    try { return typeof CC !== "undefined" ? CC.tier(id) : ""; } catch { return ""; }
  }
  /* colour the item names on the tiny line that's on screen (it is plain text; this wraps the names in .q-<rarity>) */
  function paint(el, parts) {
    if (!el || !parts) return;
    const names = parts.filter((p) => p.cat === "item" && p.q && p.q !== "common");
    if (!names.length) return;
    const tr = (x) => { try { return typeof I18N !== "undefined" && I18N.tr ? I18N.tr(x) : x; } catch { return x; } };
    let h = esc(el.textContent);
    for (const p of names) for (const nm of new Set([p.one, tr(p.one)])) {
      const e = esc(nm); if (!e || !h.includes(e)) continue;
      h = h.split(e).join(`<b class="q-${esc(p.q)} rw-qn">${e}</b>`); break;
    }
    if (h !== esc(el.textContent)) el.innerHTML = `<span class="rw-line">${h}</span>`;   // one span: the toast is a flex row
  }
  function merge(a, b) {
    const out = (a || []).map((p) => ({ ...p }));
    for (const p of b || []) { const q = out.find((x) => x.k === p.k); if (q) q.n += p.n; else out.push({ ...p }); }
    return out;
  }
  const ORDER = { gold: 0, xp: 1, item: 2 };
  function line(parts, max = 4) {
    const ps = (parts || []).filter((p) => Math.round(p.n) >= 1).sort((a, b) => (ORDER[a.cat] ?? 9) - (ORDER[b.cat] ?? 9));
    const txt = (p) => { const n = Math.round(p.n); return (n > 1 && p.many ? p.many : p.one).replace("{n}", n.toLocaleString("en-US")); };
    const out = ps.slice(0, max).map(txt);
    if (ps.length > max) out.push(`+${ps.length - max} more`);
    return out.join(" · ");
  }
  /* what arrives close together is one line: flushed once nothing new came for HOLD ms (or MAX after the first), and
     only when the screen is free (no fight, no blocking window) */
  function tinyCore(HOLD = 700, MAX = 2500) {
    let buf = [], first = 0, last = 0;
    return {
      add(ps, now) { if (!buf.length) first = now; buf = merge(buf, ps); last = now; },
      due(now, scr = {}) {
        if (!buf.length || scr.fight || scr.block) return null;
        if (now - last < HOLD && now - first < MAX) return null;
        const out = buf.filter((p) => Math.round(p.n) >= 1); buf = buf.filter((p) => Math.round(p.n) < 1 && p.cat === "xp");   // XP crumbs wait for more
        return out.length ? out : null;
      },
      get size() { return buf.length; },
    };
  }

  // ------------------------------------------------------------ unlocks and scenes (pure)
  /* what we say about an unlock (unlocks.js may bring its own name / line; ours fill the gaps) */
  const INFO = [
    [/perk/i, "Perks", "Spend perk points in the skill trees for real bonuses."],
    [/gather|harvest|forag/i, "Gathering", "Pick plants and creature parts on the road for potions, food and coin."],
    [/cook/i, "Cooking", "Cook food at a fire or an inn for lasting bonuses."],
    [/recipe/i, "Recipes", "Simple recipes: turn what you gather into something useful."],
    [/smith|forge/i, "Smithing", "Make and improve your own weapons and armour at any forge.", '[data-act="shop"][data-id="forge"]'],
    [/hireling/i, "Hirelings", "Pay a sellsword to travel with you for a while."],
    [/follower|companion/i, "Followers", "Someone fights at your side and carries 100 for you. They get knocked down, never killed.", '[data-act="hire"]'],
    [/alchem/i, "Alchemy", "Mix ingredients into potions and poisons at an alchemy lab.", '[data-act="alch"]'],
    [/horse|stable|mount/i, "Horses", "Buy a horse at the stables: faster trips and more carrying room."],
    [/delve|dungeon/i, "Dungeons", "Proper dungeons: deeper runs, elite rooms and better loot."],
    [/clanjob|clan_job/i, "Clan jobs", "Take on jobs together with your clan."],
    [/clan/i, "Clans", "Found or join a clan with your friends."],
    [/hous|home/i, "Housing", "Buy a house: a bed, a chest and a place to call home."],
    [/enchant/i, "Enchanting", "Learn enchantments by breaking items, then put them on your gear.", '[data-act="enchant"]'],
    [/shout|thu+m|voice/i, "Shouts", "Learn Words of Power and use them in fights."],
    [/worldboss|world_boss/i, "World bosses", "Huge foes that whole parties gather to fight."],
    [/expedition/i, "Expeditions", "Long journeys into the wild with big rewards."],
    [/event|invasion|caravan|hunt|blizzard/i, "World events", "Invasions, hunts, caravans and storms across Skyrim."],
    [/legendar/i, "Legendary encounters", "The hardest foes in Skyrim, and their treasure."],
    [/elite/i, "Elite encounters", "Tougher foes with better loot on the roads."],
  ];
  const cap = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  /* an unlock from unlocks.js (an id or an object) → {id, name, line, level, sel, quest} */
  function info(u) {
    let o = u && typeof u === "object" ? u : { id: u };
    if (typeof o.id === "string" && !o.name && hasUnlocks() && typeof UNLOCKS.get === "function") { try { o = { ...(UNLOCKS.get(o.id) || {}), ...o }; } catch { /* an older unlocks.js */ } }
    const id = String(o.id || o.key || o.name || "");
    const hit = INFO.find(([re]) => re.test(id)) || [];
    const quest = typeof INTROQ !== "undefined" ? INTROQ.forUnlock(id) : null;
    return { id, name: o.name || o.label || o.title || hit[1] || cap(id), line: o.line || hit[2] || o.teaser || o.desc || o.text || "",
      level: +(o.level ?? o.lvl ?? o.at ?? 0) || 0, sel: o.sel || o.selector || hit[3] || "", quest };
  }
  /* one scene for what a level opened (several unlocks at once share it) */
  function levelScene(level, unlocks) {
    const L = (unlocks || []).map(info).filter((x) => x.id);
    if (!L.length) return null;
    const a = L[0], q = L.find((x) => x.quest);
    return { key: `lvl:${level}:${L.map((x) => x.id).join(",")}`, w: "big", kicker: level ? `Level ${level}` : "Unlocked", title: `${a.name} unlocked`,
      line: a.line, more: L.slice(1).map((x) => x.name), quest: q ? q.quest : null, sel: L.map((x) => x.sel).filter(Boolean), ids: L.map((x) => x.id), perk: !!level };
  }
  /* "Level 5 brings: Followers · Alchemy · a perk point" (the next level's unlocks, if unlocks.js knows them) */
  function brings(level, unlocks) {
    const names = (unlocks || []).map(info).filter((x) => x.id && (!x.level || x.level === level)).map((x) => x.name);
    return names.length ? `Level ${level} brings: ${names.join(" · ")} · a perk point` : `Level ${level} brings: a perk point and +10 to Health, Magicka or Stamina`;
  }
  const hasUnlocks = () => typeof UNLOCKS !== "undefined" && !!UNLOCKS;
  function nextUnlocks(s) {
    if (!hasUnlocks() || typeof UNLOCKS.next !== "function") return [];
    try { return [].concat(UNLOCKS.next(s, 2) || []); } catch { return []; }
  }
  const nextText = (s) => (s ? brings((s.level || 1) + 1, nextUnlocks(s).filter((u) => { const x = info(u); return !x.level || x.level === (s.level || 1) + 1; })) : "");
  /* what this level just opened (unlocks.js), or [] */
  function opened(s, level) {
    if (!hasUnlocks() || typeof UNLOCKS.justOpened !== "function") return [];
    let L; try { L = [].concat(UNLOCKS.justOpened(s) || []); } catch { return []; }
    return L.filter((u) => { const x = info(u); return x.id && (!x.level || !level || x.level <= level); });
  }

  // ------------------------------------------------------------ the live game
  const T = tinyCore();
  let S0 = null;
  const me = () => { try { return DOM && window.__dbg?.save ? window.__dbg.save() : S0; } catch { return S0; } };
  const mine = (s) => !!s && (s === me() || !DOM);
  const reduce = () => DOM && ((typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.documentElement.classList.contains("a11y-still"));
  /* the record that stops a scene from playing twice (kept in the save, so a reload never replays one) */
  function rec(s) {
    if (!s.rw || typeof s.rw !== "object") s.rw = { seen: {}, fol: s.follower?.id ? [s.follower.id] : [], horse: s.horse ? 1 : 0, words: (s.words || []).length, spells: (s.spells || []).length, dragons: +s.dragons || 0, clan: s.clan || "" };
    if (!s.rw.seen) s.rw.seen = {};
    return s.rw;
  }
  const seen = (s, k) => !!(s && rec(s).seen[k]);
  const see = (s, k) => { if (s) rec(s).seen[k] = 1; };
  function screen() {
    if (typeof NOTIFY === "undefined" || !NOTIFY.screen) return {};
    const x = NOTIFY.screen(); return { fight: x.fight, block: x.msg >= 1 || x.p0 };
  }

  /* any reward: {kind, w?, ...}. tiny: parts; small/medium: title, text, icon; big/milestone: a scene. → the lane it took */
  function push(r) {
    const w = weigh(r.kind, r.w), ln = lane(w);
    if (ln === "line") { T.add(r.parts || [], Date.now()); flushSoon(); return ln; }
    if (ln === "scene") { scene({ ...r, w }); return ln; }
    if (typeof NOTIFY !== "undefined" && NOTIFY.reward) NOTIFY.reward(w, r.title || "", r.text || "", r.icon || "");
    return ln;
  }
  const tiny = (parts) => push({ kind: "loot", parts });
  /* notify.js: a "You find 24 gold." / "Looted: Iron Dagger" toast joins the tiny line */
  function fromToast(c, text) {
    if (!DOM) return false;
    if (c.kind === "gold" && c.amt) { tiny([part.gold(c.amt)]); return true; }
    if (c.kind === "loot") {
      const body = String(text || "").trim().replace(/^[^\w“"]+/u, "");
      const m = body.match(/^(?:Looted|Picked up|You pick up|Found|You find|You take|You loot)[: ]\s*([^.]{1,60}?)\.?$/);
      if (!m) return false;
      const q = m[1].match(/^(.*?)\s*[×x]\s*(\d+)$/) || m[1].match(/^(\d+)\s*[×x]?\s+(.*)$/);
      const name = q ? (/^\d+$/.test(q[1]) ? q[2] : q[1]) : m[1], n = q ? +(/^\d+$/.test(q[1]) ? q[1] : q[2]) : 1;
      tiny([part.item(name.trim(), n)]); return true;
    }
    return false;
  }
  let flushT = 0;
  function flushSoon() { if (DOM && !flushT) flushT = setTimeout(() => { flushT = 0; flush(); }, 750); }
  function flush() {
    const ps = T.due(Date.now(), screen());
    if (ps && typeof NOTIFY !== "undefined" && NOTIFY.tiny) NOTIFY.tiny(ps);
    if (T.size) flushSoon();
  }

  // ---- scenes
  let queued = new Set();
  function scene(sc) {
    const s = me();
    if (!sc || !sc.key || seen(s, sc.key)) return "seen";
    if (queued.has(sc.key)) return "queued";   // already waiting: a level-up and unlocks.js's event for it stay one moment
    queued.add(sc.key);
    if (!DOM || typeof NOTICES === "undefined") return "queued";
    return NOTICES.scene("rw:" + sc.key, () => draw(sc));
  }
  const ic = (w) => `<svg class="rw-crest" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4l7 17 18 1-14 11 5 18-16-10-16 10 5-18L7 22l18-1z"/>${w === "milestone" ? '<circle cx="32" cy="32" r="29"/>' : ""}</svg>`;
  function html(sc) {
    const s = me(), qn = sc.quest && typeof INTROQ !== "undefined" && !INTROQ.started(s, sc.quest) ? INTROQ.name(sc.quest) : "";
    const more = sc.more && sc.more.length ? `<p class="rw-more">Also new: ${sc.more.map(esc).join(" · ")}</p>` : "";
    const perk = sc.perk ? `<p class="rw-perk">+1 perk point · +10 to Health, Magicka or Stamina</p>` : "";
    const acts = qn
      ? `<button class="btn pri rw-go" data-rw="quest" data-id="${esc(sc.quest)}">Start: ${esc(qn)}</button><button class="btn ghost" data-rw="close">Later</button>`
      : `<button class="btn pri rw-go" data-rw="close">${sc.w === "milestone" ? "Onwards" : "Got it"}</button>`;
    return `<div class="sheet rw-sheet" role="dialog" aria-modal="true" aria-labelledby="rwt"><i class="rw-burst" aria-hidden="true"></i><i class="rw-rays" aria-hidden="true"></i>
      ${ic(sc.w)}<p class="rw-k">${esc(sc.kicker || "")}</p><h2 class="rw-t" id="rwt">${esc(sc.title || "")}</h2>${sc.line ? `<p class="rw-l">${esc(sc.line)}</p>` : ""}${more}${perk}
      ${qn ? `<p class="rw-q">A short first quest shows you how.</p>` : ""}<div class="rw-acts">${acts}</div></div>`;
  }
  let shines = [];
  function draw(sc) {
    if (!DOM) return;
    see(me(), sc.key); queued.delete(sc.key);
    document.getElementById("modal")?.remove();
    const m = document.createElement("div");
    m.id = "modal"; m.className = `modal rw-scene rw-${sc.w}${reduce() ? " rw-still" : ""}`;
    m.innerHTML = html(sc);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rw]"); if (!b) return;
      e.stopPropagation();
      let say = "";
      if (b.dataset.rw === "quest" && typeof INTROQ !== "undefined") { const s = me(); say = INTROQ.start(s, b.dataset.id); try { window.__ui?.save(); } catch { /* saved on the next tick */ } }
      m.remove();
      for (const q of [].concat(sc.sel || [])) if (q) shines.push({ q, until: Date.now() + 180000 });
      if (say && window.__dbg?.toast) window.__dbg.toast(say);
    });
    document.body.appendChild(m);
    m.querySelector(".rw-go")?.focus();
    try { SOUND.fx(sc.w === "milestone" ? "quest" : "levelup", 0.5); } catch { /* sound is optional */ }
    try { if (!reduce() && typeof MOTION !== "undefined" && MOTION.celebrate) MOTION.celebrate()?.classList.add("rw-const"); } catch { /* decoration */ }
  }
  /* the new button glows once you find it (on any screen, for 3 minutes) */
  function shine() {
    if (!shines.length) return;
    const now = Date.now();
    shines = shines.filter((x) => {
      if (now > x.until) return false;
      const el = [...document.querySelectorAll(x.q)].find((e) => e.getClientRects().length);
      if (!el) return true;
      el.classList.add("rw-shine"); setTimeout(() => el.classList.remove("rw-shine"), 4200);
      return false;
    });
  }

  // ---- what to celebrate
  /* levelup.js: a new level. true = it opened something, the scene shows the level (no LEVEL UP banner as well) */
  function onLevel(s, level) {
    if (!mine(s)) return false;
    const sc = levelScene(level, opened(s, level));
    if (!sc) return false;
    sc.ids.forEach((id) => see(s, "u:" + id));   // unlocks.js's own event for these stays quiet
    return scene(sc) !== "seen";
  }
  /* unlocks.js may also fire an event of its own (outside a level-up, e.g. from a quest) */
  function onUnlock(d) {
    const s = (d && d.s) || me(); if (!s || !mine(s)) return;
    const all = [].concat(d && (d.ids || d.list || d.unlocks || d.id || d) || []);
    const lv = +(d && d.level) || 0;
    if (lv && lv === +s.level) { const sc = levelScene(lv, all); if (sc) { sc.ids.forEach((id) => see(s, "u:" + id)); scene(sc); } return; }   // a level-up: the very scene onLevel makes (same key)
    const L = all.filter((u) => !seen(s, "u:" + info(u).id));
    if (!L.length) return;
    L.forEach((u) => see(s, "u:" + info(u).id));
    const sc = levelScene(0, L); if (sc) scene({ ...sc, perk: false, kicker: "Unlocked" });
  }
  /* skill XP (engine.js useSkill → LEVELUP "xp"): the tiny line; a skill rise is levelup.js's own notice */
  function onXp(d) {
    if (!DOM || !d || !(d.xp > 0) || !mine(d.s)) return;
    T.add([part.xp(d.skill, d.xp)], Date.now()); flushSoon();
  }
  /* items: an upgrade over what you wear (small), a legendary piece (milestone) */
  function watchGive() {
    if (typeof G === "undefined" || !G.give || G.give._rw) return;
    const base = G.give;
    const w = function (s, item, ...rest) {
      const r = base.call(this, s, item, ...rest);
      try { if (DOM && mine(s)) setTimeout(() => gained(s, item), 0); } catch { /* fine */ }
      return r;
    };
    Object.assign(w, base); w._rw = true; G.give = w;
  }
  const WEAR = new Set(["weapon", "shield", "head", "chest", "hands", "feet", "ring", "neck", "amulet"]);
  function gained(s, id) {
    const it = typeof D !== "undefined" && D.ITEMS[id]; if (!it || !WEAR.has(it.slot)) return;
    const tier = typeof CC !== "undefined" ? CC.tier(id) : "common";
    if ((tier === "legendary" || tier === "unique") && !seen(s, "i:" + id)) {
      see(s, "i:" + id);
      return push({ kind: "legendary", key: "i:" + id, kicker: tier === "unique" ? "One of a kind" : "Legendary find", title: it.name, line: "Look at it in your Items. Nothing else in Skyrim is quite like it." });
    }
    if (typeof ITEMCMP === "undefined") return;
    const row = [...(s.inv || [])].reverse().find((r) => r.item === id); if (!row) return;
    const d = ITEMCMP.data(s, row); if (!d || d.wearing || !d.rows.length) return;
    const [label, now, next] = d.rows[0];
    if (!(label === "Hits for" || label === "Armor") || !(next > now)) return;
    if (seen(s, "up:" + id)) return; see(s, "up:" + id);
    push({ kind: "upgrade", title: "Upgrade found", text: `${it.name} · ${label === "Armor" ? "Armour" : "Hits for"} ${now} → ${next}` });
  }
  /* things the save shows changed: a follower, a horse, a Word of Power, a spell, a dragon, a clan */
  function watch(s) {
    const r = rec(s);
    const fid = s.follower && s.follower.id;
    if (fid && !r.fol.includes(fid)) {
      const first = !r.fol.length; r.fol.push(fid);
      const nm = (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS?.[fid]?.[0]) || cap(fid);
      if (first) push({ kind: "follower", key: "f:" + fid, kicker: "A companion", title: `${nm} joins you`, line: "Followers fight at your side and carry 100 for you. They get knocked down, never killed." });
      else push({ kind: "goal", title: "Follower", text: `${nm} joins you` });
    }
    if (s.horse && !r.horse) { r.horse = 1; push({ kind: "horse", key: "h:1", kicker: "Your first horse", title: s.horse.name || "A horse", line: "Ride it from the Travel tab: trips are faster and it carries more for you." }); }
    const nw = (s.words || []).length;
    if (nw > r.words) { const first = r.words === 0; r.words = nw; push(first ? { kind: "ability", key: "w:1", kicker: "A Word of Power", title: "Your first shout", line: "Use it in a fight from your Magic: it needs time to cool down after." } : { kind: "word2", title: "Word of Power", text: "A new word for your shouts" }); }
    const ns = (s.spells || []).length;
    if (ns > r.spells) { const sp = typeof D !== "undefined" && D.SPELLS[(s.spells || [])[ns - 1]]; r.spells = ns; push({ kind: "spell", title: "New spell", text: sp?.name || "A new spell" }); }
    const dr = +s.dragons || 0;
    if (dr > r.dragons) { const was = r.dragons; r.dragons = dr; for (const m of [1, 10, 25]) if (was < m && dr >= m) push({ kind: "boss", key: "d:" + m, kicker: m === 1 ? "Your first dragon" : `${m} dragons`, title: m === 1 ? "Dragonslayer" : "Bane of Dragons", line: m === 1 ? "Its soul is yours. Use it to learn a Word of Power." : "Skyrim will sing of this." }); }
    if (s.clan && s.clan !== r.clan) { r.clan = s.clan; const c = typeof CLANS !== "undefined" && CLANS.byId ? CLANS.byId(s.clan) : null; push({ kind: "clan", key: "c:" + s.clan, kicker: "Your clan", title: c?.name || "A clan of your own", line: "Play together, share jobs and grow your hall." }); }
    else if (!s.clan && r.clan) r.clan = "";
  }

  function tick() {
    const s = me(); if (!s || !s.skills) return;
    try { watch(s); } catch (e) { console.warn("rewards", e); }
    try { shine(); } catch { /* decoration */ }
    if (T.size) flushSoon();
  }
  function mount() {
    if (!DOM || mount.done) return; mount.done = true;
    watchGive();
    if (typeof LEVELUP !== "undefined") LEVELUP.on("xp", onXp);
    let sub = false;
    try { if (hasUnlocks() && typeof UNLOCKS.on === "function") { UNLOCKS.on(onUnlock); sub = true; } } catch { /* an older unlocks.js */ }
    if (!sub) addEventListener("unlocks", (e) => onUnlock(e.detail));   // the window event carries {level, ids}
    setInterval(tick, 1000);
  }
  if (DOM) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount(); }

  return { WEIGHTS, KIND, LANE, weigh, lane, part, rarity, paint, merge, line, tinyCore, INFO, info, levelScene, brings, nextText, opened, onLevel, onUnlock, push, tiny, fromToast, scene, html, rec, watch,
    _set(s) { S0 = s; }, get queued() { return queued.size; } };
})();
if (typeof module !== "undefined") module.exports = REWARDS;
