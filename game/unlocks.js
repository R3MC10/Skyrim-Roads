/* Features that open as you level (unlocks.js). [OURS]
   New players were shown every system at once. Now the big systems open one by one as your hero levels up.
   ONE table below says what opens when; everything else in the game asks this file.

   Public API (other modules call these; keep the names):
     UNLOCKS.open(S, id)        → true when feature `id` is open for this hero (unknown ids are always open)
     UNLOCKS.next(S, n = 2)     → the next n features still locked, soonest first (for "Next unlock · Level 4 · Smithing")
     UNLOCKS.justOpened(S)      → ids that opened at the hero's current level (for the level-up moment)
     UNLOCKS.on(fn)             → fn({ s, level, ids, items }) when a level-up opens something; returns an "off" function.
                                  In the browser there is also a window "unlocks" event with the same detail.
   Helpers used by the wiring:
     UNLOCKS.TABLE, UNLOCKS.get(id), UNLOCKS.level(id), UNLOCKS.name(id)
     UNLOCKS.migrate(S)         → called by G.migrate: veterans keep anything they already used (S.unlocks)
     UNLOCKS.sync(S)            → marks features open by level or by use; fires the event for new ones
     UNLOCKS.section(S, id)     → may this Area service show? (forge, stables, enchanter...)
     UNLOCKS.act(S, act)        → null if a button's data-act may run, else the feature that's still locked
     UNLOCKS.tab(S, sub)        → may this sub-tab show? (perks, follower, world news)
     UNLOCKS.dungeon(S, place)  → { ok, guest, id, level, why } for entering a dungeon (easy ones are always open)
     UNLOCKS.encounter(S, id)   → may this road encounter roll? (the elite ones wait)
     UNLOCKS.lockedFor(members, id) → names of party members for whom `id` is still locked
     UNLOCKS.note(id)           → the gentle "unlocks at level X" line for a guest
     UNLOCKS.teaserHTML(S, cls) → the small "Next unlock · Level 4 · Smithing" line
     UNLOCKS.skipTip(S, id)     → true when another character on this account already got that far (skip its tutorial)
     UNLOCKS.applyBody(S)       → sets body classes (ul-lock-<id>) so locked cards, buttons and markers are hidden by CSS
   Rules from the owner:
   - Locked features are HIDDEN, not greyed out. Only the next 1-2 show as a small teaser.
   - Friends, chat, party invites and playing together are never gated.
   - Anything an old character already used stays open (S.unlocks; S.unlocked was taken by shout words long ago).
   - Someone who reaches a locked place another way (a quest, a party, a link) comes in as a guest with a gentle note. */
const UNLOCKS = (() => {
  const DOM = typeof document !== "undefined" && typeof document.createElement === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const has = (x) => !!x && (Array.isArray(x) ? x.length > 0 : typeof x === "object" ? Object.keys(x).length > 0 : true);
  const lt = (s, k) => +((s && s.lt && s.lt[k]) || 0);
  const anyItem = (s, re) => Array.isArray(s.inv) && s.inv.some((i) => i && re.test(String(i.item || i.id || "")));

  /* THE table. level = when it opens; acts = buttons (data-act) it owns; sections = Area services; subs = sub-tabs;
     hide = CSS selectors hidden while locked (cards, map buttons); enc = road encounters; used(s) = proof an old save used it. */
  const TABLE = [
    { id: "perks", level: 2, name: "Perks", teaser: "Spend a perk point to make a skill stronger.",
      subs: ["perks"], acts: ["perk", "skyperks", "bperk"], hide: [".ul-perks"],
      used: (s) => has(s.perks) },
    { id: "gathering", level: 3, name: "Gathering", teaser: "Pick herbs, fish and hunt along the roads.",
      sections: ["fish", "hunt"], acts: ["gpick", "gquick", "hdeliver", "gpickall", "gforage", "gauto", "gplant", "gunplant", "gnotes", "fishgo", "huntgo", "huntroad", "castout"],
      hide: ["#gnear", "#huntBtn", ".gath-bar", ".ul-gathering"],
      used: (s) => has(s.gather && s.gather.got) || has(s.gather && s.gather.picked) || has(s.fishLog) || lt(s, "hunts") > 0 },
    { id: "cooking", level: 3, name: "Cooking and recipes", teaser: "Cook hot meals at an inn's pot and learn simple recipes.",
      sections: ["cook"], acts: ["cook", "cfread"], hide: [".ul-cooking"],
      used: (s) => has(s.recipes) || has(s.craftLog) || lt(s, "cooked") > 0 || has(s.camp) },
    { id: "smithing", level: 4, name: "Smithing", teaser: "Use the forge: make, improve and refine your own gear.",
      sections: ["forge", "mine"], acts: ["smake", "srefine", "srefineall", "temper", "mine", "ftab", "fgroup"], hide: [".ul-smithing"],
      used: (s) => lt(s, "crafted") > 0 || has(s.mined) || has(s.cmGot) },
    { id: "followers", level: 5, name: "Followers and hirelings", teaser: "Hire someone to fight at your side.",
      sections: ["hire"], subs: ["follower"], acts: ["hire", "fol2"], hide: [".ul-followers"],
      used: (s) => !!s.follower || has(s.folData) || !!s.hire || !!s.pet },
    { id: "alchemy", level: 5, name: "Alchemy", teaser: "Mix ingredients into potions and poisons.",
      sections: ["alchemy"], acts: ["alch", "brew"], hide: [".ul-alchemy"],
      used: (s) => lt(s, "potions") > 0 },
    { id: "horses", level: 6, name: "Horses and carriages", teaser: "Buy a horse or take a carriage to travel faster.",
      sections: ["stables", "carriage"], acts: ["hbuy", "hbreed", "hbags", "hshoes", "hrename", "harmor", "htend", "hride", "carriage", "cartbuy", "cartwheels", "carttoggle"],
      hide: ["#rideBtn", ".ul-horses"],
      used: (s) => !!s.horse || !!s.cart || lt(s, "carriage") > 0 },
    { id: "dungeons", level: 7, name: "Proper dungeons", teaser: "Hard dungeons open, with elite rooms and better loot.",
      dungeonTier: 2, hide: [".ul-dungeons"],
      used: (s) => clearedTier(s) >= 2 },
    { id: "clans", level: 8, name: "Clans", teaser: "Found a clan or join one, with a banner and a tag.",
      acts: ["clancol", "clanfound", "claninv", "clankick", "clanjoin", "clanno", "hclanplot"], hide: ["#clanbox", ".ul-clans"],
      used: (s) => !!s.clan || !!s.clanOld },
    { id: "housing", level: 8, name: "Houses and homesteads", teaser: "Buy a house in town or build a homestead.",
      sections: ["home", "homes", "market", "homestead", "hall", "halls"],
      acts: ["buyhome", "homebed", "homejump", "harvest", "stash", "unstash", "hstash2", "hsact", "hplot", "htab", "hbuild", "hdecor", "hundecor", "hhire", "hfire", "hdep", "hwd", "hrest", "hpray", "hstash", "hunstash", "hmount", "hunmount", "mlist", "mbuy", "mpull", "bclaim", "hallgold", "hallmat", "hallput", "halltake", "hallrest", "hcoat"],
      hide: [".ul-housing"],
      used: (s) => has(s.homes) || !!s.home || ownsHomestead(s) || !!s.hall || has(s.stash) },
    { id: "clanjobs", level: 9, name: "Clan wars", teaser: "Earn points for your clan and fight over the holds.",
      hide: [".ul-clanjobs", ".clan-war", ".clanwar"],
      used: (s) => !!s.clan && has(s.war && s.war.h) },
    { id: "enchanting", level: 9, name: "Enchanting and spell crafting", teaser: "Learn enchantments and put them on your gear.",
      sections: ["enchanter", "craft"], acts: ["enchant", "disench", "craftgo", "runetable", "craftdel"], hide: [".ul-enchanting"],
      used: (s) => has(s.enchants) || has(s.runeSpells) },   // s.runes fills in by itself (runecraft.js), so it proves nothing
    { id: "harddungeons", level: 10, name: "Deadly dungeons", teaser: "The deadliest dungeons, deep delves and difficulty tiers.",
      dungeonTier: 3, acts: ["ddtier"], hide: [".ul-harddungeons"],
      used: (s) => clearedTier(s) >= 3 },
    { id: "shouts", level: 10, name: "Shouts", teaser: "Spend dragon souls on Words of Power and shout.",
      acts: ["unlock", "roadshout"], hide: [".ul-shouts"],
      used: (s) => has(s.words) || has(s.unlocked) || (s.souls || 0) > 0 || has(s.dragons) },
    { id: "worldevents", level: 11, name: "World events", teaser: "Invasions, hunts, caravans, blizzards and other world news.",
      sections: ["caravans", "festival", "pit"], subs: ["world"], acts: ["raidfight", "cvsign", "cvbuy", "festclaim", "festgift"],
      hide: ["#wev", "#gev", "#raid", ".wev-card", ".wg-card", ".wagons", ".cr-strip", ".tny-card", ".ul-worldevents"],
      used: (s) => has(s.wevStats) || !!s.caravanJob || Object.values(s.fest || {}).some((f) => f && (f.n > 0 || f.claimed)) || has(s.tourney && s.tourney.got) || has(s.tourney && s.tourney.claimed) || lt(s, "raids") > 0 },
    { id: "worldbosses", level: 12, name: "World bosses and expeditions", teaser: "Dragons, rifts and sieges for everyone, and long expeditions.",
      hide: [".gev-banner", ".exp-card", ".ul-worldbosses"],
      used: (s) => has(s.gevStats) || has(s.expDone) || has(s.expHist) || !!(s.exp && s.exp.key) },   // gevOut fills in by itself (events you missed), so it proves nothing
    { id: "elite", level: 15, name: "Elite encounters", teaser: "Giants, hagravens, Thalmor and assassins on the road.",
      enc: ["thalmor", "vigilant", "giant", "assassin", "hagraven", "wisp", "nightvamp"], hide: [".ul-elite"],
      used: (s) => false },
    { id: "legendary", level: 20, name: "Legendary hunts", teaser: "Hunt legendary beasts across Skyrim.",
      sections: ["hunts"], acts: ["lhact"], hide: [".lh-card", ".lh-wild", ".ul-legendary"],
      used: (s) => !!(s.lhunt && (has(s.lhunt.done) || has(s.lhunt.best) || s.lhunt.cur)) },
  ];
  const BY = Object.fromEntries(TABLE.map((f) => [f.id, f]));
  const ACT = {}, SECTION = {}, SUB = {}, ENCOUNTER = {};
  for (const f of TABLE) {
    for (const a of f.acts || []) ACT[a] = f.id;
    for (const x of f.sections || []) SECTION[x] = f.id;
    for (const x of f.subs || []) SUB[x] = f.id;
    for (const x of f.enc || []) ENCOUNTER[x] = f.id;
  }
  function ownsHomestead(s) { try { return typeof HOMESTEAD !== "undefined" ? HOMESTEAD.owned(s).length > 0 : has(s.homestead && s.homestead.plots); } catch { return false; } }
  /* the hardest dungeon tier this hero has cleared (old saves: proof they already go to hard dungeons) */
  function clearedTier(s) {
    let t = 0;
    for (const p of Object.keys((s && s.cleared) || {})) { try { const i = typeof DUNGEONS !== "undefined" && DUNGEONS.info(p); if (i && i.tier > t) t = i.tier; } catch { /* unknown place */ } }
    return t;
  }

  const get = (id) => BY[id] || null;
  const level = (id) => (BY[id] ? BY[id].level : 1);
  const name = (id) => (BY[id] ? BY[id].name : id);
  const lv = (S) => Math.max(1, Math.floor(+(S && S.level) || 1));
  const store = (S) => (S.unlocks && typeof S.unlocks === "object" && !Array.isArray(S.unlocks) ? S.unlocks : (S.unlocks = {}));
  const usedSafe = (f, S) => { try { return !!f.used(S); } catch { return false; } };

  // ------------------------------------------------------------ the core (pure, tested in node)
  function open(S, id) {
    const f = BY[id];
    if (!f || !S) return true;
    if (lv(S) >= f.level) return true;
    return !!(S.unlocks && S.unlocks[id] != null);
  }
  function next(S, n = 2) {
    return TABLE.filter((f) => !open(S, f.id)).sort((a, b) => a.level - b.level).slice(0, Math.max(0, n));
  }
  function justOpened(S) {
    const L = lv(S), u = (S && S.unlocks) || {};
    return TABLE.filter((f) => f.level === L && (u[f.id] == null || u[f.id] === L)).map((f) => f.id);
  }
  /* old saves: open (for good) everything this hero already used, and everything below their level */
  function migrate(S) {
    if (!S || typeof S !== "object") return S;
    const u = store(S);
    if (!S.unlocksV) {
      for (const f of TABLE) if (u[f.id] == null && (lv(S) >= f.level || usedSafe(f, S))) u[f.id] = 0;   // 0 = had it before unlocks existed
      S.unlocksV = 1;
    } else for (const f of TABLE) if (u[f.id] == null && lv(S) < f.level && usedSafe(f, S)) u[f.id] = 0;   // reached by a quest or a party since
    return S;
  }
  /* mark what opened by level since last time; returns the newly opened features (and tells listeners) */
  function sync(S, quiet) {
    if (!S || typeof S !== "object") return [];
    const u = store(S), L = lv(S), fresh = [];
    for (const f of TABLE) if (u[f.id] == null && L >= f.level) { u[f.id] = L; fresh.push(f); }
    rememberLevel(L);
    if (fresh.length && !quiet) emit({ s: S, level: L, ids: fresh.map((f) => f.id), items: fresh });
    return fresh;
  }

  // ------------------------------------------------------------ the wiring helpers
  let cur = null;   // the hero on this screen (set by applyBody) for modules that don't hold S (menus.js)
  const tabNow = (sub) => !cur || tab(cur, sub);
  const openNow = (id) => !cur || open(cur, id);
  const sectionFeature = (sec) => SECTION[sec] || null;
  const section = (S, sec) => !SECTION[sec] || open(S, SECTION[sec]);
  const sections = (S, list) => (list || []).filter((x) => section(S, x));
  const act = (S, a) => (ACT[a] && !open(S, ACT[a]) ? ACT[a] : null);
  const tab = (S, sub) => !SUB[sub] || open(S, SUB[sub]);
  const encounter = (S, encId) => !ENCOUNTER[encId] || open(S, ENCOUNTER[encId]);
  const featureOfAct = (a) => ACT[a] || null;
  /* entering a dungeon: easy ones always; hard from 7, deadly from 10. A quest that leads there, or a party with someone who has it
     open (opt.mates: their cards; opt.party: true when the leader already took you in), lets you in as a guest. */
  function dungeon(S, place, opt = {}) {
    let tier = 1;
    try { const i = typeof DUNGEONS !== "undefined" && DUNGEONS.info(place); if (i) tier = i.tier || 1; } catch { /* unknown */ }
    const id = tier >= 3 ? "harddungeons" : tier >= 2 ? "dungeons" : null;
    if (!id || open(S, id)) return { ok: true, guest: false, id, level: 1, tier };
    const f = BY[id], quest = questLeads(S, place), party = !!opt.party || (Array.isArray(opt.mates) && opt.mates.some((m) => m && !lockedFor([m], id).length));   // a friend who has it open takes you along
    if (quest || party) return { ok: true, guest: true, id, level: f.level, tier, why: party ? "party" : "quest" };
    return { ok: false, guest: false, id, level: f.level, tier, why: "level" };
  }
  function questLeads(S, place) {
    try {
      if (typeof QUESTS === "undefined" || !QUESTS.active) return false;
      return QUESTS.active(S).some((a) => { const o = (a.st && a.st.obj) || {}; return [o.go, o.clear, o.talk, o.at].includes(place); });
    } catch { return false; }
  }
  /* party members (objects with name/level and maybe unlocks) for whom a feature is still locked */
  function lockedFor(members, id) {
    return (members || []).filter((m) => m && !open({ level: m.level || m.lv || 1, unlocks: m.unlocks || (Array.isArray(m.ul) ? Object.fromEntries(m.ul.map((x) => [x, 0])) : null) }, id)).map((m) => m.name || "Someone");
  }
  /* what a solo hero sees at a dungeon door that isn't open yet */
  const dungeonLine = (g) => (g && !g.ok ? `This place is too dangerous for now. ${BY[g.id].name} open at level ${g.level}; easy dungeons are open already.` : "");
  /* what other players need to know (party cards): features this hero opened early (a quest, a party, an old save) */
  function cardBits(S) {
    const u = (S && S.unlocks) || {}, ids = TABLE.filter((f) => u[f.id] != null && lv(S) < f.level).map((f) => f.id);
    return ids.length ? { ul: ids } : {};
  }
  const note = (id) => (BY[id] ? `You're here as a guest. ${BY[id].name} opens for you at level ${BY[id].level}.` : "");
  const lockedLine = (id) => (BY[id] ? `${BY[id].name} opens at level ${BY[id].level}.` : "");
  function teaserHTML(S, cls = "", n = 2) {
    const nx = next(S, n);
    if (!nx.length) return "";
    const one = (f) => `<span class="ul-tz-i"><b>Level ${f.level}</b> · ${esc(f.name)}</span>`;
    return `<div class="ul-tz ${esc(cls)}" title="${esc(nx[0].teaser)}"><span class="ul-tz-k">Next unlock</span>${nx.map(one).join('<span class="ul-tz-s" aria-hidden="true">·</span>')}</div>`;
  }

  // ------------------------------------------------------------ events
  const subs = [];
  function on(fn) { if (typeof fn !== "function") return () => {}; subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
  function emit(d) {
    for (const fn of subs.slice()) { try { fn(d); } catch (e) { /* a listener never breaks levelling */ } }
    if (DOM && typeof window !== "undefined" && typeof CustomEvent === "function") { try { window.dispatchEvent(new CustomEvent("unlocks", { detail: { level: d.level, ids: d.ids } })); } catch { /* old browsers */ } }
  }

  // ------------------------------------------------------------ the account: a new hero on an old account skips tutorials
  const BEST_KEY = "rotn_bestlv";
  function bestLevel() {
    let b = 0;
    try { b = Math.max(b, +localStorage.getItem(BEST_KEY) || 0); } catch { /* storage blocked */ }
    try { if (typeof BACKUP !== "undefined") for (const x of BACKUP.autoList()) b = Math.max(b, +x.level || 0); } catch { /* none */ }
    try { if (typeof ACCOUNT !== "undefined" && ACCOUNT.bestLevel) b = Math.max(b, ACCOUNT.bestLevel() || 0); } catch { /* signed out */ }
    return b;
  }
  function rememberLevel(L) { try { if (typeof localStorage !== "undefined" && L > (+localStorage.getItem(BEST_KEY) || 0)) localStorage.setItem(BEST_KEY, String(L)); } catch { /* storage blocked */ } }
  /* called when a new character is made: remember how far the account already got */
  function newHero(S) { if (S) { S.unlocks = {}; S.unlocksV = 1; const b = bestLevel(); if (b > 1) S.acctLv = b; } return S; }
  /* a new hero on an account that already got past the first trip skips the guided first trip */
  const skipFirstTrip = (S) => !!(S && (S.acctLv || 0) >= 3);
  const skipTip = (S, id) => !!(S && S.acctLv && (S.acctLv >= level(id)));

  // ------------------------------------------------------------ the page: hide what is locked
  let styled = false;
  function css() {
    return TABLE.map((f) => (f.hide || []).length ? `${f.hide.map((h) => `body.ul-lock-${f.id} ${h}`).join(",")}{display:none!important}` : "").join("\n");
  }
  function applyBody(S) {
    cur = S || null;
    if (!DOM || !document.body) return;
    if (!styled) { styled = true; const st = document.createElement("style"); st.id = "unlocks-css"; st.textContent = css(); document.head.appendChild(st); }
    for (const f of TABLE) document.body.classList.toggle("ul-lock-" + f.id, !!S && !open(S, f.id));
  }

  // level-ups (levelup.js) open things: sync right away so the event fires once, at the level-up
  try { if (typeof LEVELUP !== "undefined" && LEVELUP.on) LEVELUP.on("level", (d) => { if (d && d.s) sync(d.s); }); } catch { /* node without levelup.js */ }

  return { TABLE, get, level, name, open, next, justOpened, on, migrate, sync, section, sections, sectionFeature, act, tab, tabNow, openNow, dungeon, encounter, featureOfAct,
    lockedFor, note, lockedLine, dungeonLine, cardBits, teaserHTML, skipTip, skipFirstTrip, newHero, bestLevel, applyBody, css, questLeads };
})();
