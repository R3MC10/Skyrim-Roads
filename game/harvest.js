/* Hands-on harvesting: the rules behind the gathering mini-game (harvestgame.js draws it). [OURS]
   - Every plant has a way it wants to be picked: snip a flower, dig up a root, scrape a fungus, ease a fragile Nirnroot
     out of the mud, pick only the ripe berries, lift an egg from the nest, pry a clam open.
   - How it went sets the yield: rough 1, good 2, perfect 3 (Nirnroot and pearls always give one). Green Thumb still doubles it.
   - After three hand harvests of a plant (two with Sure Hands) you can Quick Gather it: no mini-game, a bit less.
     Gather all and auto-pick are quick picks too. Nirnroot always wants your hands.
   - A hand harvest can turn up a perfect or a glowing specimen (Herbalist's Eye: more often; three a day at most).
     The next potion you brew with it is 15% (perfect) or 25% (glowing) stronger; one bonus per potion.
   - Herb orders: each town's alchemist wants a few of one plant every day, pays well for them, and pays more when the
     hold is in trouble (crises.js). That plant also sells for more in that town today (economy.js).
   - Cooking: Snowberry and Juniper Berry crostatas (cooking.js). Crafting: Tundra Cotton twists into leather strips (smithing.js).
   - Party: patches regrow per player, so everyone nearby picks their own share. No voting, nothing to fight over. */
const HARVEST = (() => {
  const GAME_DAY = 2 * 3600;
  const dayOf = (t) => Math.floor(t / GAME_DAY);
  const pnum = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const name = (id) => D.ITEMS[id]?.name || id;
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263 + 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  /* a line with {markers}, in Polish when the game is (i18n_gather.js holds the Polish) */
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : (v ? en.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : en));
  const strHash = (str) => { let h = 7; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

  // ------------------------------------------------------------------ how each plant is picked
  const KINDS = {
    flower: { verb: "Snip", how: "snip the stem", color: "#a58ad6" },
    root: { verb: "Dig up", how: "dig it up", color: "#c9a46a" },
    fungus: { verb: "Scrape", how: "scrape it off", color: "#d0864a" },
    nirn: { verb: "Ease out", how: "fragile: ease it out", color: "#bfe3ff" },
    berry: { verb: "Pick", how: "pick the ripe ones", color: "#d2453a" },
    egg: { verb: "Lift", how: "lift it out gently", color: "#e3d9bf" },
    clam: { verb: "Pry open", how: "pry the clam open", color: "#8fc3c9" },
  };
  function kindOf(id) {
    id = String(id || "");
    if (/nirnroot/.test(id)) return "nirn";
    if (/pearl/.test(id)) return "clam";
    if (/egg|roe/.test(id)) return "egg";
    if (/snowberr|juniper|jazbay/.test(id)) return "berry";
    if (/root|trama|scathecraw|garlic/.test(id)) return "root";
    if (/stool|crown|white_cap|blisterwort|rot\b|namiras|mushroom|amanita|pholiota|fungal|creep|moss/.test(id)) return "fungus";
    return "flower";
  }
  const single = (id) => /nirnroot|pearl/.test(id);
  const howTo = (id) => KINDS[kindOf(id)].how;

  // ------------------------------------------------------------------ the player's record (inside s.gather)
  function hs(s) {
    const g = typeof GATHER !== "undefined" ? GATHER.st(s) : (s.gather = s.gather || {});
    for (const k of ["done", "prime", "ord"]) if (!g[k] || typeof g[k] !== "object") g[k] = {};
    if (!g.rare || typeof g.rare !== "object") g.rare = { d: -1, n: 0 };
    if (!g.ordDay || typeof g.ordDay !== "object") g.ordDay = { d: -1, n: 0 };
    return g;
  }
  const QUICK_AT = 3;
  const quickAt = (s) => (pnum(s, "hfast") ? 2 : QUICK_AT);
  const handPicked = (s, id) => hs(s).done[id] || 0;
  const canQuick = (s, id) => !single(id) && handPicked(s, id) >= quickAt(s);

  /* how many you get (before Green Thumb) */
  const YIELD = { fail: 1, good: 2, perfect: 3 };
  function amount(s, id, grade, rng = Math.random) {
    if (single(id)) return 1;                                         // [Skyrim] Nirnroot and clams give one
    if (YIELD[grade]) return YIELD[grade];
    return 1 + (rng() < (canQuick(s, id) ? 0.8 : 0.5) ? 1 : 0);      // a quick pick: 1-2
  }

  // ------------------------------------------------------------------ perfect and glowing specimens
  const RARE = { p: { word: "Perfect", mult: 1.15 }, l: { word: "Glowing", mult: 1.25 } };
  const RARE_PER_DAY = 3;
  const GRADE_LUCK = { perfect: 1.6, good: 1, fail: 0.3 };
  function rareChance(s, id, grade, t = G.now()) {
    const luck = GRADE_LUCK[grade] || 0;
    if (!luck) return { p: 0, l: 0 };
    const boost = 1 + Math.min(1, pnum(s, "hrare")) + (pnum(s, "grare") ? 0.25 : 0);   // Herbalist's Eye, Wildcrafter
    const night = typeof G.isNight === "function" ? G.isNight(t) : false;
    return { p: 0.04 * luck * boost, l: 0.015 * luck * boost * (kindOf(id) === "nirn" ? 3 : 1) * (night ? 1.5 : 1) };
  }
  /* after a pick: count hand harvests (Quick Gather), maybe find a specimen. Returns the specimen or null */
  function afterPick(s, id, grade, t = G.now(), rng = Math.random) {
    if (!GRADE_LUCK[grade]) return null;
    const g = hs(s);
    g.done[id] = (g.done[id] || 0) + 1;
    const d = dayOf(t);
    if (g.rare.d !== d) g.rare = { d, n: 0 };
    if (g.rare.n >= RARE_PER_DAY) return null;
    const c = rareChance(s, id, grade, t), r = rng();
    const k = r < c.l ? "l" : r < c.l + c.p ? "p" : null;
    if (!k) return null;
    g.rare.n++;
    const rec = (g.prime[id] = g.prime[id] || { p: 0, l: 0 });
    rec[k] = (rec[k] || 0) + 1;
    return { k, word: RARE[k].word, mult: RARE[k].mult, item: id };
  }
  const have = (s, id) => s.inv.filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);
  /* specimens you still carry (used, sold or eaten ones drop off, ordinary ones go first) */
  function primeOf(s, id) {
    const g = hs(s), rec = g.prime[id];
    if (!rec) return { p: 0, l: 0 };
    let n = have(s, id);
    rec.l = Math.max(0, Math.min(rec.l || 0, n)); n -= rec.l;
    rec.p = Math.max(0, Math.min(rec.p || 0, n));
    if (!rec.p && !rec.l) delete g.prime[id];
    return { p: rec.p || 0, l: rec.l || 0 };
  }
  function tagHTML(s, id) {
    const p = primeOf(s, id);
    return (p.l ? ` <b class="hg-tag hg-l" title="${esc(T("Glowing: your next potion with it is 25% stronger"))}">✦${esc(T("{n} glowing", { n: p.l }))}</b>` : "")
      + (p.p ? ` <b class="hg-tag hg-p" title="${esc(T("Perfect: your next potion with it is 15% stronger"))}">★${esc(T("{n} perfect", { n: p.p }))}</b>` : "");
  }
  /* brewing with a specimen makes that potion stronger (one bonus per potion: the best one) */
  function brewHook() {
    if (typeof TOWNS === "undefined" || TOWNS.__harvest) return;
    TOWNS.__harvest = true;
    const brew0 = TOWNS.brew;
    TOWNS.brew = (s, rowIds, opt = {}) => {
      let best = null;
      try {
        if (!(opt && opt.botch)) for (const id of [...new Set(rowIds || [])].map((x) => G.invRow(s, x)?.item).filter(Boolean)) {
          const p = primeOf(s, id);
          if (p.l && (!best || best.k !== "l")) best = { id, k: "l" };
          else if (p.p && !best) best = { id, k: "p" };
        }
      } catch (e) { best = null; }
      if (!best) return brew0(s, rowIds, opt);
      const mult = RARE[best.k].mult, boost = Math.max(1, (opt && opt.boost) || 1) * mult;
      const r = brew0(s, rowIds, { ...(opt || {}), boost });
      if (r && /^You brew/.test(r.text || "")) {
        const rec = hs(s).prime[best.id];
        if (rec) { rec[best.k] = Math.max(0, (rec[best.k] || 0) - 1); if (!rec.p && !rec.l) delete hs(s).prime[best.id]; }
        r.text += " " + T(best.k === "l" ? "The glowing {item} makes it {n}% stronger." : "The perfect {item} makes it {n}% stronger.", { item: name(best.id), n: Math.round((mult - 1) * 100) });
        r.specimen = best.k;
      }
      return r;
    };
  }

  // ------------------------------------------------------------------ herb orders (a small daily job in every town)
  let COMMON = null;
  const common = () => COMMON || (COMMON = [...new Set(Object.values(GATHER.BIOME).flatMap((l) => l.map(([id]) => id)))].filter((id) => D.ITEMS[id] && !/ash|scathe|trama|spawn/.test(id)).sort());
  const isTown = (town) => typeof TOWNS !== "undefined" && typeof WORLD !== "undefined" && !!WORLD.places[town] && (TOWNS.isTown ? TOWNS.isTown(town) : /city|town/.test(WORLD.places[town][2] || ""));
  const holdOfTown = (town) => { try { return G.holdAt(WORLD.places[town]); } catch (e) { return ""; } };
  const ORDERS_PER_DAY = 3, ORDER_CAP = 150;
  function order(town, t = G.now(), s = null) {
    if (!town || !isTown(town) || typeof GATHER === "undefined") return null;
    const d = dayOf(t), h = strHash(town) % 100000;
    const local = (GATHER.HOLD_EXTRA[holdOfTown(town)] || []).map(([id]) => id).filter((id) => D.ITEMS[id]);
    const pool = common();
    const ing = local.length && hash(h, d) < 0.6 ? local[Math.floor(hash(h + 1, d) * local.length)] : pool[Math.floor(hash(h + 2, d) * pool.length)];
    if (!ing) return null;
    const n = 3 + Math.floor(hash(h + 3, d) * 3);
    let cm = 1;
    if (s && typeof CRISES !== "undefined") { try { cm = Math.max(1, Math.min(1.5, 1 + (CRISES.priceMult(s, town, ing, t) - 1) * 1.5)); } catch (e) { cm = 1; } }
    const reward = Math.round(Math.min(ORDER_CAP, (D.ITEMS[ing].value || 1) * n * 1.8 + 12) * cm);
    return { town, ing, n, reward, day: d, hard: cm > 1.04 };
  }
  const filled = (s, town, t = G.now()) => hs(s).ord[town] === dayOf(t);
  function deliver(s, t = G.now()) {
    const town = s.location, o = order(town, t, s);
    if (!o) return { err: "There's no herb order here." };
    if (filled(s, town, t)) return { err: "You already filled today's order here. Come back tomorrow." };
    const g = hs(s), d = dayOf(t);
    if (g.ordDay.d !== d) g.ordDay = { d, n: 0 };
    if (g.ordDay.n >= ORDERS_PER_DAY) return { err: "The alchemists have all they need from you today. Try again tomorrow." };
    if (have(s, o.ing) < o.n) return { err: T("You need {n} {item} (you have {m}).", { n: o.n, item: name(o.ing), m: have(s, o.ing) }) };
    let left = o.n;
    for (const r of [...s.inv.filter((x) => x.item === o.ing && !x.stolen), ...s.inv.filter((x) => x.item === o.ing && x.stolen)]) { if (left <= 0) break; const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k; }
    s.gold = (s.gold || 0) + o.reward;
    g.ord[town] = d; g.ordDay.n++;
    let sk = []; try { sk = G.useSkill(s, "Alchemy", 6 + o.reward / 6) || []; } catch (e) { sk = []; }
    return { ok: true, text: T("You hand over {n} {item} and get {g} gold.", { n: o.n, item: name(o.ing), g: o.reward }) + (sk.length ? " " + sk.join(". ") : ""), gold: o.reward };
  }
  function orderHTML(s, t = G.now()) {
    const o = order(s.location, t, s);
    if (!o) return "";
    const n = have(s, o.ing), done = filled(s, s.location, t);
    return `<div class="panel hg-order"><h2>Herb order</h2><div class="item">${typeof ICONART !== "undefined" ? ICONART.item(o.ing, 30) : ""}<div class="t">${esc(o.n)} ${esc(name(o.ing))}<span>${done ? "Filled. A new order comes tomorrow." : esc(T(o.hard ? "Pays {g} gold (hard times in the hold: they pay extra) · you have {n}" : "Pays {g} gold · you have {n}", { g: o.reward, n }))}</span></div>${done ? "" : `<button class="btn sm ${n >= o.n ? "pri" : ""}" data-act="hdeliver" ${n >= o.n ? "" : "disabled"}>Deliver</button>`}</div>
      <p class="sub">${esc(T("{item} is wanted here today, so it also sells for more in this town.", { item: name(o.ing) }))}</p></div>`;
  }
  /* the ordered plant is in demand: it sells (and costs) more in that town today */
  function econHook() {
    if (typeof ECON === "undefined" || ECON.__harvest) return;
    ECON.__harvest = true;
    const m0 = ECON.mult;
    ECON.mult = (town, item, side = "buy", extra = 0, t = G.now()) => {
      const m = m0(town, item, side, extra, t);
      try { if (town && D.ITEMS[item]?.slot === "ingredient" && order(town, t)?.ing === item) return m * 1.2; } catch (e) { /* ignore */ }
      return m;
    };
  }

  // ------------------------------------------------------------------ cooking and crafting with what you pick
  function kitchenHooks() {
    if (typeof COOK !== "undefined" && !COOK.RECIPES.snowberry_crostata) {
      const add = { // [Skyrim] Snowberry and Juniper Berry Crostata; buffs [OURS]
        snowberry_crostata: ["Snowberry Crostata", [["ing_snowberries", 2], ["ing_wheat", 1]], [["warmth", 1, 30], ["max:stamina", 15, 30]], "Cold slows you less, +15 stamina"],
        juniper_crostata: ["Juniper Berry Crostata", [["ing_juniper", 2], ["ing_wheat", 1]], [["max:health", 15, 30], ["regen:stamina", 25, 30]], "+15 health, stamina comes back faster"],
      };
      for (const [id, rc] of Object.entries(add)) {
        if (!rc[1].every(([it]) => D.ITEMS[it])) continue;
        COOK.RECIPES[id] = rc;
        D.ITEMS["dish_" + id] = { name: rc[0], slot: "food", value: 20 + rc[2].length * 10, weight: 0.5, dish: id, desc: rc[3] };
      }
    }
    if (typeof SMITH !== "undefined" && D.ITEMS.ing_tundra_cotton && !SMITH.REFINE.some((r) => r[2][0]?.[0] === "ing_tundra_cotton")) SMITH.REFINE.push(["mat_strips", 2, [["ing_tundra_cotton", 3]], "tan"]);   // [OURS] twisted into cord
  }

  // ------------------------------------------------------------------ the road prompt: a ripe patch in reach
  function nearPrompt(s, t = G.now()) {
    if (typeof GATHER === "undefined" || !Number.isFinite(s.x) || s.dungeon) return null;
    const tr = s.trip; if (tr && tr.status && tr.status !== "travel") return null;
    const n = GATHER.nearby(s, t).find((x) => x.ripe && x.d <= GATHER.REACH_PX);
    return n ? { id: n.id, ing: n.ing, kind: kindOf(n.ing), name: name(n.ing), d: n.d, quick: canQuick(s, n.ing), riding: !!(tr && tr.status === "travel") } : null;
  }
  function cardFoot(s) {
    return `<p class="sub hg-foot">${esc(T("Tap Gather to pick by hand: better hands, bigger yield. Picked a plant {n} times? Quick pick skips the mini-game. In a party everyone picks their own share of each patch.", { n: quickAt(s) }))}</p>`;
  }
  function progress(s, id) { return { done: handPicked(s, id), need: quickAt(s), quick: canQuick(s, id), single: single(id) }; }

  /* pure scoring rules the mini-game uses (kept here so the node tests can check them) */
  const tolOf = (s) => (pnum(s, "hfast") ? 1.3 : 1);
  const SCORE = {
    snip: (dy, tol = 1) => (dy <= 8 * tol ? "perfect" : dy <= 22 * tol ? "good" : "fail"),
    pull: (snapped, maxStrain, done) => (snapped || !done ? "fail" : maxStrain < 0.5 ? "perfect" : "good"),
    scrape: (coverage, accuracy) => (coverage >= 0.85 && accuracy >= 0.75 ? "perfect" : coverage >= 0.55 && accuracy >= 0.5 ? "good" : "fail"),
    berries: (ripeGot, ripeAll, mistakes) => (ripeGot >= ripeAll && mistakes === 0 ? "perfect" : ripeGot >= Math.min(3, ripeAll) && mistakes <= 1 ? "good" : "fail"),
    pry: (v, lo, hi) => { const mid = (lo + hi) / 2, w = (hi - lo) / 2; return v >= lo && v <= hi ? (Math.abs(v - mid) <= w * 0.35 ? "perfect" : "good") : "fail"; },
  };

  brewHook(); econHook(); kitchenHooks();
  if (typeof I18N !== "undefined" && I18N.add && typeof I18N_GATHER !== "undefined" && I18N_GATHER.TPL) I18N.add(I18N_GATHER.TPL);   // Polish lines with {markers}
  return { T, KINDS, kindOf, single, howTo, hs, canQuick, handPicked, quickAt, amount, YIELD, RARE, RARE_PER_DAY, rareChance, afterPick, primeOf, tagHTML,
    order, deliver, orderHTML, filled, ORDERS_PER_DAY, ORDER_CAP, nearPrompt, cardFoot, progress, SCORE, tolOf, dayOf };
})();
