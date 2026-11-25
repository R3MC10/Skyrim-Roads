/* The Commissions board: short orders from the towns for the adventuring company. [OURS]
   The longhouse (longhouse.js) gets a Commissions tab. Every game day (two real hours) the board holds 3 to 5 orders
   from a Jarl's steward, a blacksmith, an innkeeper or a temple:
     - deliver crafted goods (swords, boots, stews, potions...) or gathered ones (ore, firewood, pelts, herbs). What
       you hand in is gone: the town keeps it.
     - clear a camp: win fights against outlaws in a hold (clearing a dungeon there does it at once),
     - escort a caravan: set out from the giver's town and ride with it to another town.
   - The board is picked from the company id and the game day, so every member sees the same orders. Its size and the
     amounts grow with the company level, worked out from the rooms built and the renown earned BEFORE that day (so the
     board never changes under you). An order with progress stays one more game day.
   - Every member can help. Each hand-in or fight is a line in the company ledger (k "cmc"), and the write that fills an
     order also writes its done line (k "cmd": renown, and materials into the stockpile). netsync.js merges the ledger
     key by key, so two members at once never overwrite each other.
   - Gold: each helper takes their share of the order's gold (by how much they put in) the next time the game looks
     (every few seconds). In a party the share is split evenly with the party (pshare, like gold found on the road).
     Sometimes an order also gives an item: it goes to whoever finished it.
   - Balance: deliveries pay a bit under the goods' worth plus a small fee (shops buy at a third, sell at three times),
     camps and caravans pay like a town job. Sim: tests/test_commissions.js.
   Perks (perkfx.js): Commission Broker (Speechcraft: 15/30% more commission gold) and Master's Mark (Smithing: orders
   for crafted goods give the company half again the materials and a better chance of an item). */
const COMMISSIONS = (() => {
  const COL = "longhouse", KEEP_GOT = 40, ESC_S = 86400;
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)(:lc)?\}/g, (m, k, lc) => (k in v ? (lc ? String(v[k]).toLowerCase() : String(v[k] ?? "")) : m)) : en);
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hash = (str) => [...String(str)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const pfx = (s, k) => { try { return typeof PFX !== "undefined" && s && s.perks ? PFX.num(s, k) : 0; } catch { return 0; } };
  const ITEMS = () => (typeof D !== "undefined" && D.ITEMS ? D.ITEMS : {});
  const trn = (x) => { try { return typeof I18N !== "undefined" && I18N.lang?.() === "pl" && I18N.tr ? I18N.tr(x) ?? x : x; } catch { return x; } };
  const itemName = (id) => (ITEMS()[id] ? trn(ITEMS()[id].name) : id);
  const LH = () => (typeof LONGHOUSE !== "undefined" ? LONGHOUSE : null);
  const EX = () => (typeof EXPEDITION !== "undefined" ? EXPEDITION : null);

  // ---------------------------------------------------------------- game days
  /* the game's own clock (engine.js: a game day is two real hours) */
  const gday = (t = nowS()) => { try { return G.clock(t).day; } catch { return Math.floor(t / 7200); } };
  const hourOf = (t = nowS()) => { try { return G.clock(t).hour; } catch { return ((t / 300) % 24 + 24) % 24; } };
  const SPEED = () => (typeof G !== "undefined" && G.GAME_SPEED) || 12;
  /* the real time the game day of t started at */
  const dayStart = (t = nowS()) => t - hourOf(t) * 3600 / SPEED();
  /* real seconds until the next game day */
  const leftToday = (t = nowS()) => Math.max(0, (24 - hourOf(t)) * 3600 / SPEED());
  const dayOfKey = (key) => { const m = /^(-?\d+)-/.exec(String(key)); return m ? parseInt(m[1], 10) : 0; };

  // ---------------------------------------------------------------- the orders
  const GIVERS = { jarl: ["The Jarl's steward", ""], smith: ["The blacksmith", ""], inn: ["The innkeeper", ""], temple: ["The temple priest", ""] };
  /* pool: [item, how many at company level 1, lowest company level] */
  const TPL = {
    guard: { giver: "jarl", kind: "craft", text: "The guard of {town} needs {n} {item}, made by someone who knows the work.",
      pool: [["iron_sword", 2, 1], ["iron_helmet", 2, 1], ["iron_shield", 1, 2], ["steel_sword", 2, 3], ["steel_helmet", 1, 4], ["elven_sword", 1, 6]] },
    smithy: { giver: "smith", kind: "craft", text: "The blacksmith in {town} is behind on orders and will pay for {n} {item} from your forge.",
      pool: [["iron_dagger", 3, 1], ["iron_boots", 2, 1], ["iron_gauntlets", 2, 2], ["hunting_bow", 2, 2], ["steel_sword", 2, 3], ["steel_boots", 2, 4]] },
    tanner: { giver: "smith", kind: "craft", text: "Hunters in {town} want {n} {item} before the snows.",
      pool: [["hide_boots", 3, 1], ["hide_bracers", 3, 1], ["leather_boots", 2, 2], ["leather_bracers", 2, 3], ["leather_helmet", 2, 4], ["leather_armor", 1, 5]] },
    ore: { giver: "smith", kind: "gather", text: "The forge in {town} is running low. Bring {n} {item}.",
      pool: [["ore_iron", 8, 1], ["ore_corundum", 4, 2], ["mat_iron", 5, 2], ["mat_leather", 4, 3], ["mat_steel", 4, 4], ["mat_moonstone", 3, 5]] },
    hearth: { giver: "inn", kind: "gather", text: "The innkeeper in {town} wants {n} {item} for the cold nights.",
      pool: [["mat_firewood", 6, 1], ["food_venison", 4, 1], ["pelt_wolf", 3, 2], ["food_horker", 3, 3], ["pelt_sabre", 2, 4]] },
    kitchen: { giver: "inn", kind: "craft", text: "A feast is coming in {town}. The innkeeper needs {n} {item}.",
      pool: [["dish_venison_stew", 3, 1], ["dish_horker_stew", 3, 2], ["dish_fish_stew", 3, 2]] },
    herbs: { giver: "temple", kind: "gather", text: "The temple in {town} is out of herbs. Bring {n} {item}.",
      pool: [["ing_blue_flower", 5, 1], ["ing_lavender", 5, 1], ["ing_snowberries", 5, 2], ["ing_frost_mirriam", 4, 3], ["ing_glowing_mushroom", 3, 4]] },
    healing: { giver: "temple", kind: "craft", text: "The priests in {town} tend the sick and need {n} {item}.",
      pool: [["potion_health", 3, 1], ["potion_stamina", 3, 2], ["potion_magicka", 3, 2]] },
    camp: { giver: "jarl", kind: "camp", text: "Outlaws have made camp on the roads of {hold}. The Jarl in {town} wants them gone." },
    caravan: { giver: "inn", kind: "escort", text: "A merchant caravan leaves {town} for {to}. See it there in one piece." },
  };
  const TPL_IDS = Object.keys(TPL);
  const DELIVER = TPL_IDS.filter((k) => TPL[k].kind === "craft" || TPL[k].kind === "gather");
  const ACTION = TPL_IDS.filter((k) => !DELIVER.includes(k));
  const TITLE = { craft: "Crafted goods", gather: "Gathered goods", camp: "Clear a camp", escort: "Escort a caravan" };
  const KIND_ICON = { camp: "", escort: "" };
  const MATS = ["mat_iron", "mat_steel", "mat_leather", "mat_firewood", "mat_moonstone", "mat_dwarven"];
  const PRIZES = [["potion_health", 1], ["gem_garnet", 2], ["gem_amethyst", 3], ["gem_ruby", 4], ["gem_sapphire", 5], ["gem_emerald", 6]];
  const holds = () => (EX() ? EX().HOLDS : ["Whiterun"]);
  const towns = (h) => { try { return EX() ? EX().towns(h) : ["Whiterun"]; } catch { return ["Whiterun"]; } };
  const holdOf = (town) => { try { return G.holdAt(WORLD.places[town]); } catch { return null; } };

  // ---------------------------------------------------------------- the company's level
  /* rooms built and renown earned before time t (the start of the board's day) */
  function levelOf(d, t = nowS()) {
    let rooms = 0, renown = 0;
    for (const e of Object.values(d?.tx || {})) {
      if (!e || (e.t || 0) >= t) continue;
      if (e.k === "build") rooms++;
      renown += +e.r || 0;
    }
    return { lv: clamp(1 + Math.floor(rooms / 3) + Math.floor(renown / 60), 1, 6), rooms, renown };
  }
  const sizeOf = (lv) => 3 + (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0);
  /* what an order pays (before perks): gold, renown, materials for the stockpile, maybe an item */
  function payOf(c) {
    const lv = c.lv, it = c.item ? ITEMS()[c.item] : null;
    let g;
    if (c.kind === "camp") g = 40 + 25 * lv + 8 * c.need;
    else if (c.kind === "escort") g = 50 + 25 * lv;
    else g = Math.min(0.8 * c.need * (it?.value || 5) + 20 + 15 * lv, 100 + 30 * lv);   // capped: a big order of dear goods isn't a gold mine
    const r = { craft: 4, gather: 4, camp: 6, escort: 5 }[c.kind] + lv;
    return { g: Math.round(g), r };
  }

  /* the board for a company on a game day: the same on every phone */
  function board(d, day = gday()) {
    if (!d || !d.id) return [];
    const t0 = dayStart(nowS()) - (gday() - day) * 86400 / SPEED();
    const { lv } = levelOf(d, t0), n = sizeOf(lv);
    const r = rng(hash(`cm|${d.id}|${day}`)), pick = (a) => a[Math.floor(r() * a.length) % a.length];
    const ids = [pick(ACTION)];
    const rest = [...DELIVER];
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)) % (i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }   // the same shuffle on every phone
    for (const k of rest) { if (ids.length >= n - (n >= 5 ? 1 : 0)) break; ids.push(k); }
    if (ids.length < n) ids.push(ACTION.find((k) => !ids.includes(k)) || pick(DELIVER));
    const H = holds(), out = [];
    ids.forEach((tid, i) => {
      const tp = TPL[tid], home = d.site ? holdOf(d.site) : null, atHome = i === 1 && home && H.includes(home);   // one order comes from the longhouse's own town
      const hold = atHome ? home : pick(H), town = atHome ? d.site : pick(towns(hold));
      const c = { key: `${day}-${i}-${tid}`, tpl: tid, kind: tp.kind, giver: tp.giver, hold, town, day, lv };
      if (tp.pool) {
        const pool = tp.pool.filter(([id, , min]) => ITEMS()[id] && min <= lv);
        const [item, base] = pick(pool.length ? pool : tp.pool.filter(([id]) => ITEMS()[id]));
        c.item = item; c.need = base + Math.floor((lv - 1) / 2);
      } else if (tp.kind === "camp") c.need = clamp(2 + Math.floor(lv / 2), 2, 5);
      else { const oh = H.filter((h) => h !== hold), h2 = pick(oh.length ? oh : H); c.to = pick(towns(h2).filter((x) => x !== town)) || towns(h2)[0]; c.need = 1; }
      const p = payOf(c); c.g = p.g; c.r = p.r;
      const mat = pick(MATS.filter((m) => m !== c.item && ITEMS()[m] && (lv >= 4 || !["mat_moonstone", "mat_dwarven"].includes(m))));
      c.m = mat ? { [mat]: 1 + Math.ceil(lv / 2) } : {};
      const pr = PRIZES.filter(([id, min]) => min <= lv && ITEMS()[id]);
      c.prize = pr.length ? pr[pr.length - 1 - Math.floor(r() * Math.min(2, pr.length))][0] : null;
      c.roll = r();
      out.push(c);
    });
    return out;
  }
  const findIn = (d, key) => board(d, dayOfKey(key)).find((c) => c.key === key) || null;
  const titleOf = (c) => T(TITLE[c.kind] || "Commission");
  const textOf = (c) => T(TPL[c.tpl]?.text || "", { town: c.town, hold: T(c.hold || ""), to: c.to || "", n: c.need, item: itemName(c.item || "") });
  const giverOf = (c) => T(GIVERS[c.giver]?.[0] || "");

  // ---------------------------------------------------------------- progress (from the ledger)
  function progress(d, key) {
    let q = 0; const by = {}, names = {};
    for (const e of Object.values(d?.tx || {})) if (e && e.k === "cmc" && e.key === key) { q += +e.q || 0; by[e.by] = (by[e.by] || 0) + (+e.q || 0); names[e.by] = e.who; }
    const done = d?.tx?.[`cmd-${key}`] || null;
    return { q, by, names, done };
  }
  /* what the board shows today: today's orders, and yesterday's ones that have progress but aren't done */
  function active(d, t = nowS(), S = null) {
    const day = gday(t), out = board(d, day), e = S ? escortOf(S, t) : null;
    for (const c of board(d, day - 1)) { const p = progress(d, c.key); if ((p.q > 0 || (e && e.key === c.key)) && !p.done) out.push({ ...c, last: 1 }); }
    return out;
  }
  const isOpen = (d, c, t = nowS()) => !!c && (c.day === gday(t) || c.day === gday(t) - 1) && !progress(d, c.key).done;

  /* how many more goods of that kind you can hand in: not worn, not stolen */
  function usable(s, item) {
    let eq = {}; try { eq = G.equipment(s) || {}; } catch { eq = {}; }
    const worn = new Set(Object.values(eq).map((r) => r && r.id));
    return (s.inv || []).filter((r) => r.item === item && !worn.has(r.id) && !r.stolen);
  }
  const haveOf = (s, item) => usable(s, item).reduce((a, r) => a + (r.qty || 0), 0);
  function takeGoods(s, item, n) {
    let left = n;
    for (const r of usable(s, item)) { if (left <= 0) break; const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k; }
    return n - left;
  }

  /* the ledger write: q more toward an order; the write that fills it also writes the done line.
     Returns { got, done, err } (got: how much was taken in, maybe less than q when someone else filled it first) */
  async function contribute(S, key, q, t = nowS()) {
    const L = LH(), d0 = L ? L.mine(S) : null;
    if (!d0) return { got: 0, err: T("You're not in a company.") };
    if (typeof Store === "undefined") return { got: 0, err: T("The longhouse didn't answer. Try again.") };
    let got = 0, done = false, err = null;
    const r = await Store.change(COL, d0.id, (d) => {
      got = 0; done = false; err = null;
      if (!d || !d.members?.[S.id] || d.members[S.id].gone) { err = T("You're not in a company."); return d; }
      const c = findIn(d, key);
      if (!c || !isOpen(d, c, t)) { err = T("That order is closed."); return d; }
      const p = progress(d, key), add = Math.min(q, c.need - p.q);
      if (!(add > 0)) { err = T("That order is closed."); return d; }
      got = add;
      const tx = { ...(d.tx || {}) };
      tx[`cmc-${String(S.id).slice(-6)}-${Math.floor(t).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`] = { k: "cmc", key, q: add, by: S.id, who: S.name, t: Math.floor(t), g: 0 };
      if (p.q + add >= c.need) {
        done = true;
        const crafted = c.kind === "craft" ? pfx(S, "cmcraft") : 0, m = {};
        for (const [k, n] of Object.entries(c.m || {})) m[k] = Math.round(n * (1 + crafted));
        const item = c.prize && c.roll < 0.3 + (crafted ? 0.2 : 0) ? c.prize : null;
        tx[`cmd-${key}`] = { k: "cmd", key, by: S.id, who: S.name, t: Math.floor(t), g: 0, gb: c.g, need: c.need, r: c.r, m, it: item, tpl: c.tpl, town: c.town };
      }
      const nx = { ...d, tx };
      return L.fold ? L.fold(nx, t) : nx;
    });
    if (!r && !err) return { got: 0, err: T("The longhouse didn't answer. Try again.") };
    return { got: err ? 0 : got, done: !err && done, err };
  }

  // ---------------------------------------------------------------- actions
  /* hand in goods for a delivery order (in the giver's town, or the longhouse's) */
  async function handIn(S, key) {
    const L = LH(), d = L ? L.mine(S) : null; if (!d) return T("You're not in a company.");
    const c = findIn(d, key); if (!c || !c.item) return T("That order is closed.");
    if (!isOpen(d, c)) return T("That order is closed.");
    if (!S.location || S.trip?.status || S.dungeon || (S.location !== c.town && S.location !== d.site)) return T("Hand it in at {town}, or at your longhouse in {site}.", { town: c.town, site: d.site || "?" });
    const want = Math.min(haveOf(S, c.item), c.need - progress(d, key).q);
    if (!(want > 0)) return T("You don't carry any {item}.", { item: itemName(c.item) });
    const took = takeGoods(S, c.item, want);   // taken first, so a double tap can't hand in the same goods twice
    const res = await contribute(S, key, took);
    if (res.got < took) G.give(S, c.item, took - res.got);   // someone filled it first: the rest comes back
    if (res.err) return res.err;
    last = { key, got: res.got, done: res.done };
    return null;
  }
  /* set off with a caravan (from the giver's town) */
  function escort(S, key) {
    const L = LH(), d = L ? L.mine(S) : null; if (!d) return T("You're not in a company.");
    const c = findIn(d, key); if (!c || c.kind !== "escort" || !isOpen(d, c)) return T("That order is closed.");
    if (S.location !== c.town || S.trip?.status) return T("The caravan waits in {town}.", { town: c.town });
    S.cmEsc = { key, to: c.to, t: Math.floor(nowS()) };
    return null;
  }
  const escortOf = (S, t = nowS()) => { const e = S?.cmEsc; return e && e.key && t - (e.t || 0) < ESC_S ? e : null; };

  /* gold for what you put in, once per order (s.cmGot). In a party it's split evenly. Returns [{c, gold, item}] */
  function claimable(S, d) {
    const out = [];
    for (const e of Object.values(d?.tx || {})) {
      if (!e || e.k !== "cmd" || S.cmGot?.[e.key]) continue;
      const p = progress(d, e.key), mine = p.by[S.id] || 0;
      if (!mine && e.by !== S.id) continue;
      const share = Math.round((e.gb || 0) * Math.min(1, mine / Math.max(1, e.need || 1)) * (1 + Math.min(0.5, pfx(S, "cmgold"))));
      out.push({ key: e.key, gold: share, item: e.by === S.id ? e.it || null : null, e });
    }
    return out;
  }
  function claim(S, d, party = null) {
    const list = claimable(S, d), res = [];
    for (const x of list) {
      S.cmGot = S.cmGot || {}; S.cmGot[x.key] = Math.floor(nowS());
      let gold = x.gold, split = null;
      if (gold > 0 && party && typeof PARTYPLAY !== "undefined" && typeof Store !== "undefined") {
        const others = (party.members || []).filter((m) => m.id !== S.id);
        if (others.length) {
          const { each } = PARTYPLAY.split(gold, others.length + 1);
          if (each > 0) {
            const sh = PARTYPLAY.goldShareDoc(S, others.map((m) => m.id), others.map((m) => m.name), each, T("a commission"));
            try { Store.put("pshare", sh.id, sh.doc); gold -= each * others.length; split = { each, n: others.length }; } catch { /* keep it all */ }
          }
        }
      }
      S.gold = (S.gold || 0) + gold;
      if (x.item && typeof G !== "undefined" && G.give) G.give(S, x.item, 1);
      res.push({ key: x.key, gold, item: x.item, split, e: x.e });
    }
    const ks = Object.keys(S.cmGot || {}); if (ks.length > KEEP_GOT) for (const k of ks.sort((a, b) => S.cmGot[a] - S.cmGot[b]).slice(0, ks.length - KEEP_GOT)) delete S.cmGot[k];
    return res;
  }

  /* old saves: nothing to add; anything odd is cleaned up */
  function migrate(S) {
    if (!S) return S;
    if (S.cmGot != null && (typeof S.cmGot !== "object" || Array.isArray(S.cmGot))) S.cmGot = {};
    if (S.cmGot) for (const [k, v] of Object.entries(S.cmGot)) if (!(+v > 0)) S.cmGot[k] = 1;
    if (S.cmEsc != null && (typeof S.cmEsc !== "object" || !S.cmEsc.key || !S.cmEsc.to)) delete S.cmEsc;
    return S;
  }

  // ---------------------------------------------------------------- noticing what you do
  const people = (e) => { const X = EX(); if (X && X.tagged) return X.tagged(e, "people"); return /bandit|outlaw|forsworn|marauder/i.test(e?.name || ""); };
  const counts = (S, p) => { const X = EX(); try { return X && X.countsFights ? X.countsFights(S, p) : true; } catch { return true; } };
  /* ui.js (through the expedition hook): a fight won, a dungeon cleared, a place reached */
  async function onEvent(kind, info = {}, S = me(), p = party()) {
    const L = LH(), d = S && L ? L.mine(S) : null; if (!d) return [];
    const msgs = [];
    for (const c of active(d, nowS(), S)) {
      const pr = progress(d, c.key); if (pr.done) continue;
      let q = 0;
      if (c.kind === "camp" && info.hold === c.hold) {
        if (kind === "fight" && info.e && people(info.e) && counts(S, p)) q = 1;
        if (kind === "dungeon") q = c.need - pr.q;
      }
      if (c.kind === "escort" && kind === "arrive") { const e = escortOf(S); if (e && e.key === c.key && info.place === c.to) { q = 1; delete S.cmEsc; } }
      if (!(q > 0)) continue;
      const r = await contribute(S, c.key, q);
      if (r.got) msgs.push(r.done ? T("Commission done: {title} for {town}.", { title: titleOf(c), town: c.town }) : T("Commission: {title} ({n}/{m})", { title: titleOf(c), n: pr.q + r.got, m: c.need }));
    }
    return msgs;
  }

  // ================================================================ screen (the Commissions tab of the Company screen)
  let api = null, loopT = null, last = null, busy = false, wrapped = false;
  const me = () => (api ? api.S() : null);
  const party = () => { try { const p = api?.party?.(); const S = me(); return p && (p.members || []).length >= 2 && p.members.some((m) => m.id === S?.id) ? p : null; } catch { return null; } };
  const icon = (id, size = 40) => { try { return typeof RTIP !== "undefined" ? RTIP.icon(id, size) : ""; } catch { return ""; } };
  const tip = (id, q = 1) => { try { return typeof RTIP !== "undefined" ? RTIP.attr(id, q) : ""; } catch { return ""; } };
  function rewardLine(S, c) {
    const g = Math.round(c.g * (1 + Math.min(0.5, pfx(S, "cmgold")))), crafted = c.kind === "craft" ? pfx(S, "cmcraft") : 0;
    const mats = Object.entries(c.m || {}).map(([k, n]) => `<span class="cms-it"${tip(k, Math.round(n * (1 + crafted)))}>${Math.round(n * (1 + crafted))} ${esc(itemName(k))}</span>`).join(", ");
    return `<b class="gold">${g} ${T("gold")}</b> · <span>${T("+{n} renown", { n: c.r })}</span>${mats ? ` · ${T("for the stockpile: {what}", { what: mats })}` : ""}${c.prize ? ` · <span class="cms-maybe"${tip(c.prize)}>${T("maybe {item}", { item: esc(itemName(c.prize)) })}</span>` : ""}`;
  }
  function card(S, d, c) {
    const p = progress(d, c.key), done = !!p.done, pct = Math.round(100 * Math.min(1, p.q / c.need));
    const deliver = !!c.item, have = deliver ? haveOf(S, c.item) : 0;
    const here = !!S.location && !S.trip?.status && !S.dungeon && (S.location === c.town || (deliver && S.location === d.site));
    const esc0 = escortOf(S), onIt = esc0 && esc0.key === c.key;
    const helpers = Object.entries(p.by).map(([id, q]) => `${esc(p.names[id] || "?")} (${q})`).join(", ");
    let act = "";
    if (done) act = `<span class="cms-tag">${T("Done")}${p.done.who ? ` · ${esc(p.done.who)}` : ""}</span>`;
    else if (deliver) act = `<button class="btn${have && here ? " pri" : ""}" data-cms="give" data-k="${esc(c.key)}"${have && here ? "" : " disabled"}>${T("Hand in ({n})", { n: Math.min(have, c.need - p.q) })}</button>${here ? "" : `<span class="cms-why">${T("Hand it in at {town}, or at your longhouse in {site}.", { town: esc(c.town), site: esc(d.site || "?") })}</span>`}${!have && here ? `<span class="cms-why">${T("You don't carry any {item}.", { item: esc(itemName(c.item)) })}</span>` : ""}`;
    else if (c.kind === "escort") act = onIt ? `<span class="cms-tag">${T("On the road to {to}", { to: esc(c.to) })}</span><button class="btn sm" data-cms="drop" data-k="${esc(c.key)}">${T("Give it up")}</button>` : `<button class="btn${here ? " pri" : ""}" data-cms="escort" data-k="${esc(c.key)}"${here ? "" : " disabled"}>${T("Set out with the caravan")}</button>${here ? "" : `<span class="cms-why">${T("The caravan waits in {town}.", { town: esc(c.town) })}</span>`}`;
    else act = `<span class="cms-why">${T("Win fights against outlaws in {hold}, or clear a dungeon there.", { hold: esc(T(c.hold)) })}</span>`;
    const pic = deliver ? icon(c.item, 44) : "";
    const gi = GIVERS[c.giver]?.[1] || "•", ki = KIND_ICON[c.kind];
    return `<article class="cms-card k-${c.kind}${done ? " done" : ""}${c.last ? " last" : ""}" data-key="${esc(c.key)}">
      <div class="cms-hd"><span class="cms-ic" aria-hidden="true">${gi}</span><div class="cms-who"><b>${esc(giverOf(c))}</b><span>${esc(c.town)} · ${esc(T(c.hold))}</span></div>${c.last ? `<span class="cms-last">${T("Last day")}</span>` : ""}</div>
      <div class="cms-body">${pic ? `<span class="cms-pic"${tip(c.item, c.need)}>${pic}</span>` : ki ? `<span class="cms-pic cms-kic" aria-hidden="true">${ki}</span>` : ""}<div class="cms-tx"><h3>${esc(titleOf(c))}</h3><p>${esc(textOf(c))}</p></div></div>
      <div class="cms-prog"><div class="bar"><i style="width:${pct}%"></i></div><span class="num">${Math.min(p.q, c.need)}/${c.need}</span></div>
      ${helpers ? `<p class="cms-help">${T("Helped: {who}", { who: helpers })}</p>` : ""}
      <p class="cms-pay">${rewardLine(S, c)}</p>
      <div class="cms-act">${act}</div></article>`;
  }
  function panelHTML(S, d) {
    if (!S || !d) return "";
    const lvl = levelOf(d, dayStart()), list = active(d, nowS(), S), left = Math.ceil(leftToday() / 60);
    const ren = levelOf(d, Infinity).renown;
    const head = `<div class="cms-head"><div class="cms-ht"><div class="cms-title">${T("Commissions")}</div>
      <div class="sub">${T("Orders from the towns for the company. New ones in {n} min (a new game day).", { n: left })}</div></div>
      <div class="cms-lv"><b>${T("Company level {n}", { n: lvl.lv })}</b><span>${T("{n} renown", { n: ren })}</span></div></div>`;
    const tips = `<p class="sub cms-foot">${T("Everyone in the company can help. Goods you hand in are used up. Each helper gets their share of the gold; in a party it's split evenly. Materials go to the stockpile.")}</p>`;
    return `<div class="cms-root">${head}<div class="cms-list">${list.map((c) => card(S, d, c)).join("")}</div>${tips}</div>`;
  }
  /* the company log (longhouse.js): one line per finished order; single hand-ins and fights stay out of it */
  const logLine = (e) => (e.k === "cmd" ? T("{who} finished a commission for {town}", { who: esc(e.who || "?"), town: esc(e.town || "?") }) : "");

  /* ---- the loop: gold to claim */
  function tick() {
    const S = me(); if (!S || busy) return;
    migrate(S);
    const L = LH(), d = L ? L.mine(S) : null; if (!d) return;
    const got = claim(S, d, party());
    if (!got.length) return;
    for (const x of got) {
      const it = x.item ? T(" and {item}", { item: itemName(x.item) }) : "";
      api.toast?.(x.split ? T("Commission paid: {g} gold{it} (split with your party: {each} each).", { g: x.gold, it, each: x.split.each }) : T("Commission paid: {g} gold{it}.", { g: x.gold, it }));
    }
    try { if (typeof SOUND !== "undefined") SOUND.fx("quest"); } catch { /* fine */ }
    api.persist?.(true); api.render?.();
  }
  async function onClick(evt) {
    const b = evt.target.closest?.("[data-cms]"); if (!b || b.disabled) return;
    const S = me(); if (!S) return;
    evt.preventDefault?.(); evt.stopPropagation?.();
    if (busy) return;
    busy = true;
    try {
      const a = b.dataset.cms, k = b.dataset.k;
      let err = null, ok = "";
      if (a === "give") { last = null; err = await handIn(S, k); if (!err) ok = last?.done ? T("Order filled! The town pays out.") : T("Handed in."); }
      else if (a === "escort") { err = escort(S, k); if (!err) { const c = findIn(LH().mine(S), k); ok = T("You set out with the caravan. Ride to {to}.", { to: c?.to || "?" }); } }
      else if (a === "drop") { delete S.cmEsc; ok = T("You leave the caravan. No harm done."); }
      if (err) api.toast?.(err); else { if (ok) api.toast?.(ok); api.persist?.(true); }
    } finally { busy = false; }
    tick();
    api.render?.();
  }
  /* ui.js already tells the Expedition Table about fights, dungeons and arrivals: we listen in on that */
  function wrapHook() {
    const X = EX(); if (!X || !X.hook || X.hook._cms) return;
    const h0 = X.hook;
    X.hook = function (kind, info = {}) {
      const r = h0.call(this, kind, info);
      try { onEvent(kind, info).then((m) => { if (m && m.length) { for (const t of m) api?.toast?.(t); api?.persist?.(true); tick(); } }).catch(() => {}); } catch { /* fine */ }
      return r;
    };
    X.hook._cms = 1;
  }
  function mount(a) {
    api = a;
    wrapHook(); wrapped = true;
    if (typeof document !== "undefined" && !mount.bound) { document.addEventListener("click", onClick, true); mount.bound = true; }
    clearInterval(loopT); loopT = setInterval(tick, 3000);
  }
  if (typeof I18N !== "undefined" && I18N.add && typeof I18N_COMMISSIONS !== "undefined") I18N.add(I18N_COMMISSIONS.tpl, I18N_COMMISSIONS.words);

  return { COL, TPL, TPL_IDS, GIVERS, MATS, PRIZES, gday, dayStart, leftToday, levelOf, sizeOf, payOf, board, findIn, active, isOpen, progress, titleOf, textOf,
    haveOf, usable, contribute, handIn, escort, escortOf, claimable, claim, migrate, onEvent, panelHTML, logLine, tick, mount, wrapHook,
    _api: (a) => { api = a; }, _wrapped: () => wrapped };
})();
if (typeof module !== "undefined") module.exports = COMMISSIONS;
