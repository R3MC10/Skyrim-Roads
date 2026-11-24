/* Hunting mini-game and skinning. [OURS rules; animals, hides and antlers from Skyrim]
   hunting.js already turns animals up on the road as fights (the 🏹 map toggle). This file adds the hunter's way:
   - Stalk: the animal grazes; hold "Creep closer" to close in. It lifts its head now and then: moving while it looks makes it
     nervous fast. The wind matters: blowing from you towards it carries your scent. Your Sneak skill and the Stalker perk
     slow its alarm. When the alarm meter fills, it bolts.
   - Aim: draw your bow or crossbow. Drag (or use the arrow keys) to aim; your aim sways (less with Archery). The wind pushes
     the arrow sideways (less for a crossbow bolt), so aim into it. Hit the heart-and-lungs spot behind the front leg for a
     clean kill; a body hit wounds it and you may track it down (rough hide); a miss sends it running.
   - Skinning: meat, pelts and hides, sometimes a trophy (antlers, horns, tusks). A skinning knife keeps every hide whole,
     a steel one gets more. Hides tan into leather at any forge (the forge uses them up).
   Where: road animals while hunting (a "Stalk it" choice next to Fight), hunting grounds in villages near the wild, and the
   wilds anywhere you stop. Each hunting ground has a few animals a day.
   Perks: Clean Kill, Wind Reader, Skinner (Archery), Stalker (Sneak); Hunter's Eye's extra meat counts here too. */
const HUNTGAME = (() => {
  const DOM = typeof document !== "undefined";
  const perk = (s, k) => (typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const L = (x) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") return I18N.tr(x) ?? x; } catch { /* no translator */ } return x; };
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* no audio */ } };
  const buzz = (p) => { try { if (DOM && navigator.vibrate) navigator.vibrate(p); } catch { /* not allowed */ } };
  const rint = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  /* seeded rolls: the same seed gives the same animal, wind and result on every phone (no local Math.random for what others see) */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = typeof seed === "number" ? seed >>> 0 : hash(String(seed)); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ====================================================================== items
  Object.assign(D.ITEMS, {
    pelt_deer: { name: "Deer Hide", slot: "material", weight: 2, value: 10 },
    pelt_elk: { name: "Elk Hide", slot: "material", weight: 3, value: 15 },
    pelt_goat: { name: "Goat Hide", slot: "material", weight: 2, value: 6 },
    pelt_hare: { name: "Hare Pelt", slot: "material", weight: 0.5, value: 4 },
    pelt_fox: { name: "Fox Pelt", slot: "material", weight: 1, value: 15 },
    pelt_snowfox: { name: "Snow Fox Pelt", slot: "material", weight: 1, value: 35 },
    pelt_boar: { name: "Boar Hide", slot: "material", weight: 2, value: 12 },
    trophy_goathorn: { name: "Goat Horns", slot: "valuable", weight: 1, value: 15 },
    trophy_foxtail: { name: "Fox Tail", slot: "valuable", weight: 0.2, value: 12 },
    trophy_rabbitfoot: { name: "Lucky Rabbit's Foot", slot: "valuable", weight: 0.1, value: 20 },
    trophy_boartusk: { name: "Bristleback Tusk", slot: "valuable", weight: 0.5, value: 18 },
    skin_knife: { name: "Skinning Knife", slot: "misc", weight: 1, value: 25, desc: "Skinning: every hide comes off whole." },
    skin_knife_steel: { name: "Steel Skinning Knife", slot: "misc", weight: 1, value: 90, desc: "Skinning: whole hides, often an extra one, more meat and more trophies." },
  });
  const FOOD = { food_goat: ["Leg of Goat", 3, 0.5], food_rabbit: ["Raw Rabbit Leg", 2, 0.1], food_boar: ["Boar Meat", 5, 0.5] };
  for (const [id, [name, value, weight]] of Object.entries(FOOD)) if (!D.ITEMS[id]) D.ITEMS[id] = { name, slot: "food", value, weight, raw: true };
  // [Skyrim] antlers are alchemy ingredients
  const ING = {
    ing_small_antlers: ["Small Antlers", ["Weakness to Poison", "Fortify Restoration", "Lingering Damage Stamina", "Damage Health"], 2, 0.1],
    ing_large_antlers: ["Large Antlers", ["Restore Stamina", "Fortify Stamina", "Slow", "Damage Stamina"], 2, 0.1],
  };
  if (typeof TOWNS !== "undefined" && TOWNS.INGREDIENT_FX) for (const [id, row] of Object.entries(ING)) {
    if (!TOWNS.INGREDIENT_FX[id]) TOWNS.INGREDIENT_FX[id] = row;
    if (!D.ITEMS[id]) D.ITEMS[id] = { name: row[0], slot: "ingredient", weight: row[3], value: row[2] };
  }
  if (!D.SHOP_STOCK.general.includes("skin_knife")) D.SHOP_STOCK.general.push("skin_knife");
  // cooking the new meat [OURS buffs]
  if (typeof COOK !== "undefined") {
    const R = { goat_roast: ["Roast Leg of Goat", [["food_goat", 1], ["food_salt", 1]], [["max:health", 15, 20], ["regen:stamina", 25, 20]], "+15 health, stamina recovers faster"],
      rabbit_roast: ["Roast Rabbit Leg", [["food_rabbit", 1], ["food_salt", 1]], [["max:stamina", 15, 20]], "+15 stamina"],
      boar_stew: ["Bristleback Stew", [["food_boar", 1], ["food_potato", 1], ["food_salt", 1]], [["max:health", 25, 30]], "+25 health"] };
    for (const [id, rc] of Object.entries(R)) if (!COOK.RECIPES[id]) {
      COOK.RECIPES[id] = rc;
      D.ITEMS["dish_" + id] = { name: rc[0], slot: "food", value: 20 + rc[2].length * 10, weight: 0.5, dish: id, desc: rc[3] };
    }
  }
  // the forge: tan the new hides, make knives and rods (Tools)
  if (typeof SMITH !== "undefined") {
    const tan = [["mat_leather", 1, [["pelt_deer", 1]], "tan"], ["mat_leather", 2, [["pelt_elk", 1]], "tan"], ["mat_leather", 1, [["pelt_goat", 1]], "tan"],
      ["mat_strips", 2, [["pelt_hare", 1]], "tan"], ["mat_leather", 1, [["pelt_fox", 1]], "tan"], ["mat_leather", 1, [["pelt_snowfox", 1]], "tan"], ["mat_leather", 1, [["pelt_boar", 1]], "tan"]];
    for (const r of tan) if (!SMITH.REFINE.some((x) => x[2][0][0] === r[2][0][0])) SMITH.REFINE.push(r);
    if (!SMITH.GROUPS.some(([g]) => g === "tools")) SMITH.GROUPS.push(["tools", "Tools"]);
    Object.assign(SMITH.RECIPES, {
      skin_knife: { group: "tools", mats: [["mat_iron", 1], ["mat_strips", 1]], perk: null },
      skin_knife_steel: { group: "tools", mats: [["mat_steel", 1], ["mat_strips", 1]], perk: "steel_smithing" },
      rod_fine: { group: "tools", mats: [["mat_firewood", 2], ["mat_strips", 2], ["mat_iron", 1]], perk: null },
      rod_master: { group: "tools", mats: [["mat_firewood", 2], ["mat_strips", 3], ["mat_steel", 1], ["mat_moonstone", 1]], perk: "steel_smithing" },
    });
  }
  const knifeTier = (s) => (s.inv || []).some((r) => r.item === "skin_knife_steel") ? 2 : (s.inv || []).some((r) => r.item === "skin_knife") ? 1 : 0;

  // ====================================================================== animals
  // size (how big it looks), skittish (how fast it takes fright), meat [item, min, max], pelt [item, n], trophy [item, chance], xp
  const ANIMALS = {
    deer: { name: "Deer", size: 1, skittish: 1.1, meat: ["food_venison", 1, 2], pelt: ["pelt_deer", 1], trophy: ["ing_small_antlers", 0.4], col: "#9a7550" },
    elk: { name: "Elk", size: 1.3, skittish: 0.8, meat: ["food_venison", 2, 3], pelt: ["pelt_elk", 1], trophy: ["ing_large_antlers", 0.4], col: "#7a5a3c" },
    goat: { name: "Mountain goat", size: 0.85, skittish: 1, meat: ["food_goat", 1, 2], pelt: ["pelt_goat", 1], trophy: ["trophy_goathorn", 0.35], col: "#cfc6b2" },
    hare: { name: "Hare", size: 0.5, skittish: 1.4, meat: ["food_rabbit", 1, 1], pelt: ["pelt_hare", 1], trophy: ["trophy_rabbitfoot", 0.12], col: "#a08a6c" },
    fox: { name: "Fox", size: 0.65, skittish: 1.3, meat: null, pelt: ["pelt_fox", 1], trophy: ["trophy_foxtail", 0.3], col: "#c0662e" },
    snowfox: { name: "Snow fox", size: 0.65, skittish: 1.3, meat: null, pelt: ["pelt_snowfox", 1], trophy: ["trophy_foxtail", 0.3], col: "#eceae2" },
    horker: { name: "Horker", size: 1.4, skittish: 0.55, meat: ["food_horker", 2, 3], pelt: null, trophy: ["ing_horker_tusk", 0.6], col: "#6f6a62" },
    boar: { name: "Bristleback", size: 1, skittish: 0.9, meat: ["food_boar", 1, 2], pelt: ["pelt_boar", 1], trophy: ["trophy_boartusk", 0.35], col: "#5a4a3c" },
  };
  // which animals live where (by hold); the coast adds horkers
  const HABITAT = {
    Falkreath: { deer: 5, elk: 3, hare: 3, fox: 2 }, "The Rift": { deer: 4, elk: 3, hare: 3, fox: 3 }, Whiterun: { deer: 3, elk: 3, hare: 4, fox: 2, goat: 1 },
    "The Reach": { goat: 5, deer: 2, hare: 3, fox: 1 }, Hjaalmarch: { deer: 3, hare: 3, fox: 3 }, Haafingar: { goat: 3, deer: 2, fox: 2, hare: 2 },
    Eastmarch: { deer: 3, goat: 2, hare: 3, fox: 1, elk: 1 }, "The Pale": { snowfox: 4, elk: 3, hare: 3, goat: 1 }, Winterhold: { snowfox: 4, elk: 2, hare: 3, goat: 1 },
    Solstheim: { boar: 4, snowfox: 2, hare: 1 },
  };
  const DEFAULT_HAB = { deer: 3, hare: 3, fox: 2, elk: 1 };
  const ROAD = { Deer: "deer", Elk: "elk", "Mountain goat": "goat", Horker: "horker" };
  const fromEncounter = (e) => (e && e.prey ? ROAD[e.name] || null : null);
  function habitat(s, pos) {
    let hold = ""; try { hold = G.holdAt(pos); } catch { /* no map */ }
    const h = { ...(HABITAT[hold] || DEFAULT_HAB) };
    try { if (typeof COOK !== "undefined" && COOK.waterNear(pos) === "sea") h.horker = (h.horker || 0) + 3; } catch { /* no terrain */ }
    return h;
  }
  function pickAnimal(s, pos, rnd = Math.random) {
    const h = habitat(s, pos), list = Object.entries(h), tot = list.reduce((a, [, w]) => a + w, 0);
    let r = rnd() * tot;
    for (const [id, w] of list) if ((r -= w) < 0) return id;
    return list[0][0];
  }

  // ====================================================================== hunting grounds
  const TOWNS_HG = ["Riverwood", "Falkreath", "Rorikstead", "Ivarstead", "Helgen", "Dragon Bridge", "Morthal", "Dawnstar", "Winterhold", "Kynesgrove", "Karthwasten",
    "Shor's Stone", "Darkwater Crossing", "Old Hroldan", "Stonehills", "Half-Moon Mill", "Raven Rock", "Skaal Village"];
  const PER_DAY = 3;
  const dayLen = () => 24 * 3600 / ((typeof G !== "undefined" && G.GAME_SPEED) || 12);
  const groundKey = (s) => (s.location ? s.location : `w${Math.round(s.x * 50)}_${Math.round(s.y * 50)}`);
  /* what a hunt is seeded from: shared things only. A road hunt: the trip and the beast the leader met (the leader plays it, the
     party hears the result). The hunting grounds: the place, the in-game day and which hunt of the day it is, so party mates
     stalking the same grounds see the same animal, wind and distance. */
  function seedFor(s, opts = {}, t = (typeof G !== "undefined" ? G.now() : 0)) {
    if (opts.seed) return String(opts.seed);
    if (opts.road) { const tr = s.trip || {}, e = tr.encounter || {}; return ["road", tr.destName || "", (tr.start || []).map((v) => Math.round(v * 1000)).join(","), tr.idx || 0, e.name || "", e.lvl || e.level || 0].join("|"); }
    const key = groundKey(s);
    return ["ground", key, Math.floor(t / dayLen()), PER_DAY - groundLeft(s, key, t)].join("|");
  }
  const sections = (town) => (TOWNS_HG.includes(town) ? ["hunt"] : []);
  function groundLeft(s, key = groundKey(s), t = G.now()) {
    const g = (s.hgrounds || {})[key], day = Math.floor(t / dayLen());
    return !g || g.day !== day ? PER_DAY : Math.max(0, PER_DAY - g.n);
  }
  function useGround(s, key = groundKey(s), t = G.now()) {
    const day = Math.floor(t / dayLen()), g = (s.hgrounds || {})[key];
    s.hgrounds = { ...(s.hgrounds || {}), [key]: { day, n: (g && g.day === day ? g.n : 0) + 1 } };
    const keys = Object.keys(s.hgrounds); if (keys.length > 40) for (const k of keys) if (s.hgrounds[k].day < day) delete s.hgrounds[k];   // keep the save small
  }
  /* the bow or crossbow you'd use, and its ammo */
  function weapon(s) {
    const eq = G.equipment(s), w = eq.weapon, it = w && D.ITEMS[w.item];
    let row = it && it.skill === "Archery" ? w : null;
    if (!row) for (const r of s.inv || []) { const i = D.ITEMS[r.item]; if (i?.slot === "weapon" && i.skill === "Archery" && (!row || i.damage > D.ITEMS[row.item].damage)) row = r; }
    if (!row) return null;
    const item = D.ITEMS[row.item], kind = typeof AMMO !== "undefined" ? AMMO.kindFor(item, row.item) : /crossbow/.test(row.item) ? "bolt" : "arrow";
    const ammo = typeof AMMO !== "undefined" ? AMMO.best(s, kind) : null;
    return { row, name: item.name, kind, ammo, n: typeof AMMO !== "undefined" ? AMMO.count(s, kind) : 99 };
  }
  /* why you can't hunt right now ("" = you can) */
  function block(s, road = false) {
    if (!road && (s.trip?.status === "travel" || s.trip?.status === "encounter")) return "Stop walking first.";
    if (s.dungeon) return "There's no game in a dungeon.";
    const w = weapon(s);
    if (!w) return "You need a bow or a crossbow.";
    if (typeof AMMO !== "undefined" && !w.ammo) return `You have no ${w.kind === "bolt" ? "bolts" : "arrows"}. Blacksmiths and general stores sell them.`;
    if (!road && !groundLeft(s)) return "The game here has gone to ground. Try again tomorrow, or somewhere else.";
    return "";
  }

  // ====================================================================== the rules (pure, tested in Node)
  const W = 560, H = 300, HORIZON = 150;
  function plan(s, id, opts = {}, rnd = Math.random) {
    const a = ANIMALS[id] || ANIMALS.deer, w = weapon(s) || { kind: "arrow" };
    return { id, a, dist: opts.road ? 48 + rnd() * 10 : 68 + rnd() * 16, alert: 0, head: "down", headT: 1.5 + rnd() * 2.5, facing: rnd() < 0.5 ? -1 : 1,
      wind: { dir: rnd() < 0.5 ? -1 : 1, str: rint(rnd, 0, 3) }, kind: w.kind, archery: G.skill(s, "Archery"), sneak: G.skill(s, "Sneak"),
      stalk: perk(s, "huntstalk"), sway: perk(s, "huntsway"), windK: perk(s, "huntwind"), vitalK: perk(s, "huntvital"), track: perk(s, "hunttrack"),
      moved: 0, t: 0, over: null, rnd, road: !!opts.road };
  }
  /* the wind carries your scent to it when it blows from you (left) towards the animal (right) */
  const scent = (g) => (g.wind.str === 0 ? 1 : g.wind.dir > 0 ? 1 + 0.2 * g.wind.str : 1 - 0.08 * g.wind.str);
  /* how fast its alarm grows per second right now */
  function alertRate(g, moving) {
    const look = g.head === "up";
    let r = moving ? (look ? 0.6 : 0.085) : (look ? 0.025 : -0.07);
    if (r > 0) r *= g.a.skittish * scent(g) * Math.max(0.45, 1 - g.sneak / 220) / (1 + g.stalk) * (1 + Math.max(0, 50 - g.dist) / 70);
    return r;
  }
  /* one step of the stalk: moving = creeping closer. Sets g.over = "bolted" */
  function stalkStep(g, moving, dt) {
    if (g.over) return g;
    g.t += dt;
    if ((g.headT -= dt) <= 0) { g.head = g.head === "down" ? "up" : "down"; g.headT = g.head === "up" ? 0.9 + g.rnd() * 1.3 : 1.8 + g.rnd() * 2.8; }
    if (moving && g.dist > 18) { const d = Math.min(g.dist - 18, 8 * dt); g.dist -= d; g.moved += d; }
    g.alert = Math.max(0, g.alert + alertRate(g, moving && g.dist > 18) * dt);
    if (g.alert >= 1) g.over = "bolted";
    return g;
  }
  /* where it stands on the picture, and its body, head and heart-and-lungs spot (all in drawing units) */
  function box(g) {
    const rx = g.a.size * 1500 / g.dist / 1.6, ry = rx * 0.5, bx = 330, by = HORIZON + 10 + (95 - g.dist) * 1.05;
    const f = g.facing;
    return { bx, by, rx, ry, hx: bx + f * rx * 1.15, hy: by - ry * (g.head === "up" ? 1.6 : 0.2), hr: ry * 0.55,
      vx: bx + f * rx * 0.42, vy: by + ry * 0.12, vr: rx * 0.26 * (1 + g.vitalK) };
  }
  /* the aim's sway at time t (grows if you hold the draw too long) */
  function swayAt(g, t, held = 0) {
    const amp = (4 + g.dist * 0.1) * Math.max(0.35, 1 - g.archery / 160) * (1 - g.sway) * (1 + Math.max(0, held - 5) * 0.25) * (g.kind === "bolt" ? 0.85 : 1);
    return [amp * (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 3.1 + 1)) / 1.5, amp * (Math.cos(t * 0.9) * 0.8 + 0.4 * Math.sin(t * 2.3)) / 1.2];
  }
  /* how far the wind pushes the shot sideways (drawing units) */
  const drift = (g) => g.wind.dir * g.wind.str * g.dist * 0.055 * (g.kind === "bolt" ? 0.6 : 1) * (1 - g.windK);
  /* loose at (x, y) with this sway: -> {x, y, hit: "vital" | "body" | "miss"} */
  function shoot(g, x, y, sw = [0, 0]) {
    const px = x + sw[0] + drift(g), py = y + sw[1], b = box(g);
    const inE = (cx, cy, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
    const hit = Math.hypot(px - b.vx, py - b.vy) <= b.vr ? "vital" : inE(b.bx, b.by, b.rx, b.ry) || Math.hypot(px - b.hx, py - b.hy) <= b.hr ? "body" : "miss";
    return { x: px, y: py, hit };
  }
  /* after the shot: "clean" kill, "rough" (tracked down), or "fled" */
  function outcome(g, hit, rnd = Math.random) {
    if (hit === "vital") return "clean";
    if (hit === "body") return rnd() < Math.min(0.9, 0.45 + g.track + g.archery / 400) ? "rough" : "fled";
    return "fled";
  }
  /* skinning: what you get from this animal -> {item: n} */
  function skin(s, id, quality, rnd = Math.random) {
    const a = ANIMALS[id]; if (!a) return {};
    const got = {}, knife = knifeTier(s), add = (i, n) => { if (n > 0 && D.ITEMS[i]) got[i] = (got[i] || 0) + n; };
    if (a.meat) add(a.meat[0], Math.max(1, rint(rnd, a.meat[1], a.meat[2]) + (perk(s, "huntmeat") > 0 ? 1 : 0) + (knife >= 2 ? 1 : 0) - (quality === "rough" ? 1 : 0)));
    if (a.pelt) {
      const keep = (knife ? 1 : 0.65) * (quality === "rough" ? 0.6 : 1);
      let n = 0; for (let k = 0; k < a.pelt[1]; k++) if (rnd() < keep) n++;
      if (knife >= 2 && rnd() < 0.5) n++;
      n += Math.round(perk(s, "skinyield"));
      add(a.pelt[0], n);
    }
    if (a.trophy && rnd() < Math.min(0.95, a.trophy[1] * (quality === "clean" ? 1.5 : 0.6) * (1 + perk(s, "trophy")) * (knife >= 2 ? 1.25 : 1))) add(a.trophy[0], 1);
    return got;
  }
  /* settle a hunt for this hero: skin, ammo, skill xp, stats. -> {text, got, kill} */
  function settle(s, g, shot, quality, rnd = Math.random) {
    const lines = [], w = weapon(s);
    if (shot && w?.ammo) { G.take(s, w.ammo.id, 1); if (quality !== "fled" && rnd() < 0.5) G.give(s, w.ammo.item, 1); }
    const skills = [];
    if (g.moved > 10) skills.push(...(G.useSkill(s, "Sneak", Math.min(8, g.moved / 8)) || []));
    let got = {};
    if (quality === "clean" || quality === "rough") {
      got = skin(s, g.id, quality, g.seed ? rng(g.seed + "|skin") : rnd);   // its own stream: the same hide and meat for everyone with this seed
      for (const [i, n] of Object.entries(got)) G.give(s, i, n);
      skills.push(...(G.useSkill(s, "Archery", quality === "clean" ? 14 : 8) || []));
      s.stats = { ...(s.stats || {}), hunted: ((s.stats || {}).hunted || 0) + 1 };
      const list = Object.entries(got).map(([i, n]) => `${n > 1 ? n + " " : ""}${D.ITEMS[i].name}`).join(", ");
      lines.push(quality === "clean" ? `A clean shot. The ${g.a.name.toLowerCase()} drops where it stood.` : `It runs, wounded. You follow the blood trail and find it.`);
      lines.push(list ? `You skin it: ${list}.` : "There's nothing worth taking.");
    } else if (shot) lines.push(shot === "body" ? "It runs, wounded, and you lose the trail." : "Your shot goes wide. It's gone in a heartbeat.");
    else lines.push(`The ${g.a.name.toLowerCase()} catches your scent and bolts.`);
    return { text: lines.join(" "), got, kill: quality === "clean" || quality === "rough", skills };
  }

  // ====================================================================== the screen
  let st = null;
  /* play(s, {id?, road?, pos}, done(result|null)): done(null) = left before anything happened */
  function play(s, opts, done) {
    if (!DOM) return;
    const no = block(s, !!opts.road); if (no) return no;
    close();
    const seed = seedFor(s, opts), rnd = rng(seed);
    const id = opts.id || pickAnimal(s, opts.pos || [s.x, s.y], rnd);
    const g = plan(s, id, opts, rnd), w = weapon(s);
    g.seed = seed;
    st = { s, g, opts, done, phase: "stalk", moving: false, aim: [box(g).bx - 40, box(g).by - 10], drawT: 0, last: performance.now(), raf: 0, keys: {}, arrow: null, res: null };
    const el = document.createElement("div");
    el.id = "huntgame"; el.className = "craftgame fhgame";
    el.innerHTML = `<div class="cgcard fhcard" role="dialog" aria-label="Hunting">
      <h3>🏹 ${esc(g.a.name)}</h3><p class="cgsub">${esc(w.name)} · ${w.n} ${w.kind === "bolt" ? "bolts" : "arrows"} · Archery ${g.archery} · Sneak ${g.sneak}</p>
      <canvas id="hgcv" width="${W}" height="${H}" aria-hidden="true"></canvas>
      <div class="hgbars"><span class="hglab">👁</span><div class="hgalert" id="hgalert"><i></i></div><span class="hgdist" id="hgdist"></span></div>
      <p class="fhmsg" id="hgmsg" aria-live="polite"></p>
      <div class="cgrow" id="hgrow"></div>
      <p class="cghint" id="hghint"></p></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#hgcv");
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); if (st?.phase === "aim") { drag = [e.clientX, e.clientY]; cv.setPointerCapture?.(e.pointerId); } });
    cv.addEventListener("pointermove", (e) => {
      if (!drag || !st || st.phase !== "aim") return;
      const r = cv.getBoundingClientRect(), k = W / (r.width || W);
      st.aim[0] = Math.max(0, Math.min(W, st.aim[0] + (e.clientX - drag[0]) * k)); st.aim[1] = Math.max(0, Math.min(H, st.aim[1] + (e.clientY - drag[1]) * k)); drag = [e.clientX, e.clientY];
    });
    const stop = () => { drag = null; };
    cv.addEventListener("pointerup", stop); cv.addEventListener("pointercancel", stop);
    st.key = (e) => {
      if (!st) return;
      const on = e.type === "keydown";
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) { st.keys[e.code] = on; e.preventDefault(); return; }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (st.phase === "stalk") st.moving = on;
        else if (on && !e.repeat && st.phase === "aim") loose();
        else if (on && !e.repeat && st.phase === "done") again();
      } else if (on && e.code === "KeyF" && st.phase === "stalk") toAim();
      else if (on && e.code === "Escape") finish();
    };
    addEventListener("keydown", st.key); addEventListener("keyup", st.key);
    setPhase("stalk");
    const loop = (ts) => { if (!st) return; tick(Math.min(0.05, (ts - st.last) / 1000)); st.last = ts; draw(ts); st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
    return "";
  }
  function setPhase(p, msg) {
    st.phase = p;
    const el = document.querySelector("#huntgame"); if (!el) return;
    const row = el.querySelector("#hgrow"), hint = el.querySelector("#hghint");
    if (p === "stalk") {
      row.innerHTML = `<button class="btn fhbig" id="hgmove">Creep closer (hold)</button><button class="btn pri" id="hgdraw">Draw</button><button class="btn" id="hgdone">Leave</button>`;
      const mv = row.querySelector("#hgmove");
      mv.addEventListener("pointerdown", (e) => { e.preventDefault(); st.moving = true; });
      for (const ev of ["pointerup", "pointercancel", "pointerleave"]) mv.addEventListener(ev, () => { if (st) st.moving = false; });
      row.querySelector("#hgdraw").onclick = toAim;
      row.querySelector("#hgdone").onclick = () => finish();
      hint.textContent = "Creep closer while its head is down; freeze when it looks up. Watch the wind: scent carries downwind.";
    } else if (p === "aim") {
      row.innerHTML = `<button class="btn pri fhbig" id="hgshoot">Loose</button><button class="btn" id="hglow">Lower</button>`;
      row.querySelector("#hgshoot").onclick = loose;
      row.querySelector("#hglow").onclick = () => { st.moving = false; setPhase("stalk"); };
      hint.textContent = "Drag (or use the arrow keys) to aim. Aim into the wind. The heart sits just behind the front leg.";
    } else if (p === "flight") { row.innerHTML = ""; hint.textContent = ""; }
    else if (p === "done") {
      const more = !st.opts.road && groundLeft(st.s) > 0 && !block(st.s);
      row.innerHTML = `${more ? `<button class="btn pri" id="hgagain">Hunt again</button>` : ""}<button class="btn ${more ? "" : "pri"}" id="hgfin">Done</button>`;
      row.querySelector("#hgagain")?.addEventListener("click", again);
      row.querySelector("#hgfin").onclick = () => finish();
      hint.textContent = st.opts.road ? "" : `${groundLeft(st.s)} more animals around here today.`;
    }
    if (msg != null) el.querySelector("#hgmsg").textContent = msg;
  }
  function toAim() { if (!st || st.phase !== "stalk") return; st.moving = false; st.drawT = 0; sfx("click"); setPhase("aim", "You draw and hold your breath."); }
  function loose() {
    if (!st || st.phase !== "aim") return;
    const g = st.g, sw = swayAt(g, st.drawT * 1.7, st.drawT), r = shoot(g, st.aim[0], st.aim[1], sw);
    st.shot = r; st.arrow = { t: 0, from: [40, H - 20], to: [r.x, r.y] };
    sfx("hit"); buzz(15);
    setPhase("flight", "");
  }
  function tick(dt) {
    const g = st.g;
    if (st.phase === "stalk" || st.phase === "aim") {
      stalkStep(g, st.phase === "stalk" && st.moving, dt);
      if (st.phase === "aim") {
        st.drawT += dt;
        const k = 160 * dt, K = st.keys;
        if (K.ArrowLeft || K.KeyA) st.aim[0] -= k; if (K.ArrowRight || K.KeyD) st.aim[0] += k; if (K.ArrowUp || K.KeyW) st.aim[1] -= k; if (K.ArrowDown || K.KeyS) st.aim[1] += k;
      }
      if (g.over === "bolted") return end(null, null);
      const el = document.querySelector("#huntgame");
      if (el) {
        el.querySelector("#hgalert i").style.width = (Math.min(1, g.alert) * 100).toFixed(1) + "%";
        el.querySelector("#hgalert").classList.toggle("hot", g.alert > 0.66);
        el.querySelector("#hgdist").textContent = `${Math.round(g.dist)} m`;
      }
    } else if (st.phase === "flight") {
      st.arrow.t += dt / 0.35;
      if (st.arrow.t >= 1) { st.resRnd = rng(g.seed + "|res"); const q = outcome(g, st.shot.hit, st.resRnd); end(st.shot.hit, q); }
    }
  }
  function end(shot, quality) {
    const S = st;
    S.g.over = S.g.over || "done";
    if (!S.opts.road) useGround(S.s);
    const r = settle(S.s, S.g, shot, quality || "fled", S.resRnd || rng(S.g.seed + "|res"));
    S.res = { ...r, shot, quality, id: S.g.id };
    sfx(r.kill ? "coin" : "miss"); if (r.kill) buzz([20, 30, 60]);
    S.fleeT = 0;
    setPhase("done", r.text + (r.skills?.length ? " " + r.skills.join(". ") + "." : ""));
    S.opts.onResult?.(S.res);
  }
  function again() {
    if (!st || st.phase !== "done") return;
    const s = st.s, opts = st.opts, done = st.done, err = block(s);
    close();
    if (err) return done?.(null);
    play(s, opts, done);
  }

  // ---- ink drawing
  const INK = "#231d17";
  function draw(ts) {
    const cv = document.querySelector("#hgcv"); if (!cv) return;
    const g = typeof FITCANVAS !== "undefined" ? FITCANVAS.fixed(cv, W, H) : cv.getContext("2d");
    const T = ts / 1000, G2 = st.g;
    let night = false; try { night = G.isNight(); } catch { /* fine */ }
    const sky = g.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, night ? "#1f2633" : "#d6cdb6"); sky.addColorStop(1, night ? "#3b4352" : "#ece4cf");
    g.fillStyle = sky; g.fillRect(0, 0, W, HORIZON);
    // far mountains, ink wash
    g.fillStyle = night ? "#2d3542" : "#b9b39e"; g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, HORIZON); for (let x = 0; x <= W; x += 28) g.lineTo(x, HORIZON - 40 - 30 * Math.abs(Math.sin(x / 90 + 0.6)) - 12 * Math.sin(x / 31)); g.lineTo(W, HORIZON); g.closePath(); g.fill(); g.stroke();
    // tree line: little ink pines
    g.fillStyle = night ? "#1c232a" : "#56604c";
    for (let x = 6; x < W; x += 17) { const h = 18 + ((x * 37) % 13); g.beginPath(); g.moveTo(x, HORIZON - h); g.lineTo(x - 7, HORIZON + 2); g.lineTo(x + 7, HORIZON + 2); g.closePath(); g.fill(); g.stroke(); }
    // the meadow
    const gr = g.createLinearGradient(0, HORIZON, 0, H);
    gr.addColorStop(0, night ? "#2a3028" : "#a9a77f"); gr.addColorStop(1, night ? "#161a15" : "#6f6c4c");
    g.fillStyle = gr; g.fillRect(0, HORIZON, W, H - HORIZON);
    const wd = G2.wind.dir * G2.wind.str;
    g.strokeStyle = "rgba(35,29,23,.35)"; g.lineWidth = 1;
    for (let k = 0; k < 70; k++) { const x = (k * 83) % W, y = HORIZON + 8 + ((k * 47) % (H - HORIZON - 10)), sw = Math.sin(T * 2 + k) * (1 + Math.abs(wd)) + wd * 1.5, h = 4 + (y - HORIZON) / 18; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sw * 0.5, y - h * 0.6, x + sw, y - h); g.stroke(); }
    // the animal
    const b = box(G2), fleeing = st.phase === "done" && (!st.res || !st.res.kill);
    if (fleeing) st.fleeT = (st.fleeT || 0) + 1 / 60;
    if (!(fleeing && st.fleeT > 1.2)) {
      const ox = fleeing ? G2.facing * st.fleeT * 320 * -1 : 0, down = st.phase === "done" && st.res?.kill;
      drawAnimal(g, G2.id, b.bx + ox, b.by, b.rx, b.ry, G2.head === "up" && !down, fleeing ? -G2.facing : G2.facing, T, down, fleeing);
      if (!down && !fleeing && G2.alert > 0.66 && Math.sin(T * 10) > 0) { g.fillStyle = "#8a1e12"; g.font = "700 18px serif"; g.textAlign = "center"; g.fillText("!", b.hx, b.hy - b.hr - 6); }
    }
    // foreground bushes you hide behind
    g.fillStyle = night ? "#11150f" : "#4d5236"; g.strokeStyle = INK; g.lineWidth = 1.6;
    for (const [x, r] of [[30, 46], [95, 34], [520, 40]]) { g.beginPath(); g.arc(x, H + 8, r, Math.PI, 0); g.fill(); g.stroke(); for (let k = 0; k < 6; k++) { g.beginPath(); const a = Math.PI + (k + 0.5) * Math.PI / 6; g.moveTo(x + Math.cos(a) * r * 0.6, H + 8 + Math.sin(a) * r * 0.6); g.lineTo(x + Math.cos(a) * r * 1.05, H + 8 + Math.sin(a) * r * 1.05); g.stroke(); } }
    // wind pennant
    g.save(); g.translate(28, 26); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 34); g.stroke();
    const len = 8 + G2.wind.str * 9, wav = Math.sin(T * (3 + G2.wind.str)) * (1 + G2.wind.str);
    g.fillStyle = "#b6372a"; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(G2.wind.dir * len / 2, wav, G2.wind.dir * len, 4 + (G2.wind.str ? 0 : 10)); g.lineTo(0, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.fillStyle = night ? "#e8e2d0" : INK; g.font = "600 14px 'Barlow Condensed', serif"; g.textAlign = "left";
    g.fillText(G2.wind.str ? `${L("Wind")} ${G2.wind.dir > 0 ? "→" : "←"} ${G2.wind.str}` : L("No wind"), 44, 34);
    // aim
    if (st.phase === "aim") {
      const sw = swayAt(G2, st.drawT * 1.7, st.drawT), x = st.aim[0] + sw[0], y = st.aim[1] + sw[1];
      g.strokeStyle = "rgba(20,14,10,.9)"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 11, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(x - 18, y); g.lineTo(x - 5, y); g.moveTo(x + 5, y); g.lineTo(x + 18, y); g.moveTo(x, y - 18); g.lineTo(x, y - 5); g.moveTo(x, y + 5); g.lineTo(x, y + 18); g.stroke();
      g.fillStyle = "#b6372a"; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill();
      // the bow at the bottom left
      g.strokeStyle = "#3b2a1a"; g.lineWidth = 4; g.beginPath(); g.arc(-10, H + 30, 90, -1.25, -0.2); g.stroke();
    }
    if (st.phase === "flight" && st.arrow) {
      const a = st.arrow, k = Math.min(1, a.t), x = a.from[0] + (a.to[0] - a.from[0]) * k, y = a.from[1] + (a.to[1] - a.from[1]) * k - Math.sin(k * Math.PI) * 20;
      const ang = Math.atan2(a.to[1] - a.from[1], a.to[0] - a.from[0]);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - Math.cos(ang) * 16, y - Math.sin(ang) * 16); g.lineTo(x, y); g.stroke();
    }
    if (st.phase === "done" && st.shot) { g.strokeStyle = st.shot.hit === "vital" ? "#b6372a" : "rgba(35,29,23,.8)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(st.shot.x - 5, st.shot.y - 5); g.lineTo(st.shot.x + 5, st.shot.y + 5); g.moveTo(st.shot.x + 5, st.shot.y - 5); g.lineTo(st.shot.x - 5, st.shot.y + 5); g.stroke(); }
    if (night) { g.fillStyle = "rgba(10,14,24,.25)"; g.fillRect(0, 0, W, H); }
  }
  /* an ink animal; f = facing (1 right, -1 left) */
  function drawAnimal(g, id, x, y, rx, ry, headUp, f, T, down, running) {
    const a = ANIMALS[id] || ANIMALS.deer;
    g.save(); g.translate(x, y);
    if (down) { g.rotate(f * 0.12); g.translate(0, ry * 0.9); g.scale(1, 0.55); }
    g.strokeStyle = INK; g.lineWidth = Math.max(1, rx / 22); g.fillStyle = a.col;
    const legH = id === "horker" ? 0 : id === "hare" ? ry * 0.5 : ry * 1.5, step = running ? Math.sin(T * 18) * ry * 0.5 : 0;
    // legs
    if (legH) for (const [lx, ph] of [[-0.55, 0], [-0.35, 1], [0.4, 1], [0.6, 0]]) { g.beginPath(); g.moveTo(f * lx * rx, ry * 0.4); g.lineTo(f * lx * rx + (ph ? step : -step), ry * 0.4 + legH); g.stroke(); }
    // tail
    g.beginPath();
    if (id === "fox" || id === "snowfox") { g.moveTo(-f * rx * 0.9, -ry * 0.1); g.quadraticCurveTo(-f * rx * 1.7, -ry * 0.1, -f * rx * 1.9, ry * 0.6); g.quadraticCurveTo(-f * rx * 1.4, ry * 0.5, -f * rx * 0.9, ry * 0.2); g.fill(); g.stroke(); }
    else if (id === "horker") { g.moveTo(-f * rx, 0); g.lineTo(-f * rx * 1.4, -ry * 0.4); g.lineTo(-f * rx * 1.4, ry * 0.5); g.closePath(); g.fill(); g.stroke(); }
    else { g.ellipse(-f * rx * 0.98, -ry * 0.25, rx * 0.12, ry * 0.2, 0, 0, 7); g.fill(); g.stroke(); }
    // body
    g.beginPath(); g.ellipse(0, 0, rx, id === "horker" ? ry * 1.15 : ry, 0, 0, 7); g.fill(); g.stroke();
    // neck and head
    const hx = f * rx * 1.15, hy = headUp ? -ry * 1.6 : -ry * 0.2 + ry * 0.9, hr = ry * 0.55;
    if (id !== "horker" && id !== "hare") { g.beginPath(); g.moveTo(f * rx * 0.6, -ry * 0.5); g.quadraticCurveTo(f * rx * 0.95, (hy - ry * 0.5) / 2, hx, hy); g.lineTo(hx, hy + hr * 0.8); g.quadraticCurveTo(f * rx * 0.9, 0, f * rx * 0.7, ry * 0.2); g.closePath(); g.fill(); g.stroke(); }
    g.beginPath(); g.ellipse(hx + f * hr * 0.4, hy, hr * (id === "fox" || id === "snowfox" ? 1.1 : 0.95), hr * 0.62, f * 0.25, 0, 7); g.fill(); g.stroke();
    // features
    g.lineWidth = Math.max(1, rx / 26);
    if (id === "deer" || id === "elk") {
      const big = id === "elk" ? 1.6 : 1;
      for (const s of [-0.15, 0.2]) { g.beginPath(); g.moveTo(hx + s * hr, hy - hr * 0.4); g.lineTo(hx + s * hr - f * hr * 0.3, hy - hr * 1.7 * big); g.moveTo(hx + s * hr - f * hr * 0.12, hy - hr * 1.0 * big); g.lineTo(hx + s * hr + f * hr * 0.4, hy - hr * 1.5 * big); g.moveTo(hx + s * hr - f * hr * 0.22, hy - hr * 1.4 * big); g.lineTo(hx + s * hr - f * hr * 0.75, hy - hr * 1.9 * big); g.stroke(); }
    } else if (id === "goat") {
      g.beginPath(); g.moveTo(hx, hy - hr * 0.4); g.quadraticCurveTo(hx - f * hr * 1.2, hy - hr * 1.6, hx - f * hr * 1.1, hy - hr * 0.2); g.stroke();
      g.beginPath(); g.moveTo(hx + f * hr * 0.7, hy + hr * 0.4); g.lineTo(hx + f * hr * 0.6, hy + hr * 1.1); g.stroke();
    } else if (id === "hare") {
      for (const s of [0, 0.25]) { g.beginPath(); g.ellipse(hx - f * hr * (0.1 + s), hy - hr * 1.3, hr * 0.22, hr * 0.9, -f * 0.3, 0, 7); g.fill(); g.stroke(); }
    } else if (id === "fox" || id === "snowfox") {
      for (const s of [0, 0.3]) { g.beginPath(); g.moveTo(hx - f * hr * s, hy - hr * 0.4); g.lineTo(hx - f * hr * (s + 0.15), hy - hr * 1.2); g.lineTo(hx - f * hr * (s - 0.25), hy - hr * 0.5); g.fill(); g.stroke(); }
    } else if (id === "horker" || id === "boar") {
      g.strokeStyle = "#efe6cf"; g.beginPath(); g.moveTo(hx + f * hr * 0.7, hy + hr * 0.2); g.lineTo(hx + f * hr * 0.9, hy + hr * (id === "horker" ? 1.4 : 0.8)); g.stroke(); g.strokeStyle = INK;
      if (id === "boar") { g.beginPath(); for (let k = -4; k <= 4; k++) { g.moveTo(k * rx / 6, -ry * 0.9); g.lineTo(k * rx / 6 - f * 2, -ry * 1.25); } g.stroke(); }
    }
    // eye
    g.fillStyle = INK; g.beginPath(); g.arc(hx + f * hr * 0.55, hy - hr * 0.12, Math.max(1, hr * 0.12), 0, 7); g.fill();
    // ink hatching on the flank
    g.globalAlpha = 0.35; g.lineWidth = 0.8; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * rx / 4, ry * 0.1); g.lineTo(k * rx / 4 - f * rx * 0.12, ry * 0.75); g.stroke(); } g.globalAlpha = 1;
    g.restore();
  }
  function finish() {
    if (!st) return;
    const S = st; close();
    S.done?.(S.res);
  }
  function close() {
    if (st?.raf) cancelAnimationFrame(st.raf);
    if (st?.key && DOM) { removeEventListener("keydown", st.key); removeEventListener("keyup", st.key); }
    if (DOM) document.querySelector("#huntgame")?.remove();
    st = null;
  }
  /* a hunt that started from a road encounter: the encounter is over either way */
  /* one line the rest of the party hears when the leader finishes a road hunt (same text on every phone) */
  function told(res, name) {
    const list = Object.entries(res?.got || {}).map(([i, n]) => `${n > 1 ? n + " " : ""}${D.ITEMS[i]?.name || i}`).join(", ");
    return res?.kill ? `brought down the ${name}${list ? `: ${list}` : ""}` : `the ${name} got away`;
  }
  function endRoad(s) {
    if (s.trip?.status !== "encounter") return;
    s.trip.status = "travel"; s.trip.encounter = null; s.trip.lastTick = G.now();
  }
  return { hash, rng, seedFor, ANIMALS, HABITAT, TOWNS_HG, PER_DAY, W, H, knifeTier, habitat, pickAnimal, fromEncounter, sections, groundKey, groundLeft, useGround, weapon, block,
    plan, scent, alertRate, stalkStep, box, swayAt, drift, shoot, outcome, skin, settle, play, close, told, endRoad, state: () => st, _toAim: toAim, _loose: loose };
})();
if (typeof module !== "undefined") module.exports = HUNTGAME;
