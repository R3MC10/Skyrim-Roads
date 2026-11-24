/* Followers learn like you do, and their build follows their gear. [OURS module]
   Owner: "followers should adapt to the gear, followers can freely change builds for equipment given, and they even
   manage perks over those trees, so a follower is always nice, a follower must also level up skills like player does."

   - Skills: every follower keeps the same skill list as you (s.folData[id].skills). They rise with use, with the very
     same Skyrim numbers as yours (formulas.js F.skillXpGained / F.skillXpNeeded / F.charXpNeeded): swinging a sword
     raises One-Handed, shooting raises Archery, a spell raises its school, a blow on a raised shield raises Blocking,
     blows on their armour raise Heavy or Light Armor, a sneak-attack opener raises Sneak.
   - Levels: each skill increase gives character XP equal to the new skill level (like yours). Enough XP is a level-up;
     they pick +10 Health, Magicka or Stamina themselves to suit their build, and get a perk point. They never go past
     your level or their Skyrim level cap; XP beyond that waits.
   - Builds follow gear: whatever they wear decides how they fight (bow = archer, staff or bare hands with spells = mage,
     two-hander = two-hander, sword and shield = warrior/tank, dagger = thief). Change their gear and they change build at
     once, free, as often as you like.
   - Perks: they spend their points by themselves in the trees of their current build (followers2.js spend, the same trees
     and perk effects as yours, perkfx.js included). A new build = a free respec into the new trees.
   - Old saves: a follower without skills gets them from their level and current build (the numbers the old follower
     screen showed), and Health/Magicka/Stamina picks that keep their health where it was.
   Followers still get knocked down, never killed, and never count toward the 8-player party limit. */
const FBUILD = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const F2 = () => (typeof FOL2 !== "undefined" ? FOL2 : null);
  const itemOf = (r) => (r && typeof D !== "undefined" ? D.ITEMS[r.item] : null);
  const ALL = () => (typeof D !== "undefined" && D.ALL_SKILLS) || (typeof PERKS !== "undefined" ? Object.keys(PERKS.TREES) : []);
  const BASE = () => (typeof D !== "undefined" && D.BASE_SKILL) || 15;
  const nameOf = (id) => (F2() ? F2().nameOf(id) : id);
  /* [OURS] a follower trains all day at your side: their skill XP counts LEARN times (the player also levels from
     crafting, trading and books, they only fight), more when they're far behind you. Tuned with tests/test_folbuild_sim.js. */
  const LEARN = 2.5;
  // Health / Magicka / Stamina picks by build, repeated (0.6 health for a warrior...)
  const PLAN = {
    warrior: ["health", "health", "stamina", "health", "stamina"], twohand: ["health", "stamina", "health", "stamina", "health"],
    archer: ["health", "stamina"], thief: ["stamina", "health"], spellsword: ["health", "magicka", "stamina"],
    mage: ["magicka", "health"], conjurer: ["magicka", "health", "magicka"], healer: ["magicka", "health"],
  };
  const ATTR_NAME = { health: "Health", magicka: "Magicka", stamina: "Stamina" };
  const MAGE_FAMILY = ["mage", "conjurer", "healer"];

  // ------------------------------------------------------------------ the stored character
  /* skills, character XP and attribute picks for a follower that has none yet (new hire or an old save) */
  function seed(f, id) {
    if (!f || f.skills) return f;
    const a = (F2()?.ARCH[f.arch]) || { main: [], sec: [] }, L = f.lvl || 1, skills = {};
    for (const k of ALL()) {   // [OURS] the curve the old follower screen showed for their level and style
      const v = a.main.includes(k) ? 20 + 2.6 * (L - 1) : a.sec.includes(k) ? 15 + 1.5 * (L - 1) : BASE();
      skills[k] = { lvl: Math.round(clamp(v, BASE(), 100)), xp: 0 };
    }
    f.skills = skills;
    f.cxp = 0;
    f.ups = { health: 0, magicka: 0, stamina: 0 };
    for (let i = 0; i < L - 1; i++) f.ups[pickAttr(f)]++;
    return f;
  }
  /* the attribute they want most now: the one furthest behind their build's plan */
  function pickAttr(f) {
    const plan = PLAN[f.arch] || PLAN.warrior, ups = f.ups || {}, n = (ups.health || 0) + (ups.magicka || 0) + (ups.stamina || 0) + 1;
    let best = plan[0], gap = -Infinity;
    for (const k of new Set(plan)) { const want = plan.filter((x) => x === k).length / plan.length * n - (ups[k] || 0); if (want > gap + 1e-9) { gap = want; best = k; } }
    return best;
  }
  const lvlOf = (f, k) => f?.skills?.[k]?.lvl ?? BASE();

  // ------------------------------------------------------------------ builds from gear
  const worn = (f, slot) => (f?.eq?.[slot] != null ? f.inv.find((r) => r.id === f.eq[slot]) : null);
  const wtype = (r) => (r && typeof G !== "undefined" && G.wtype ? G.wtype(r.item) : /dagger/.test(r?.item || "") ? "dagger" : "sword");
  function armorKind(f) {
    const n = { heavy: 0, light: 0, cloth: 0 };
    for (const slot of ["head", "chest", "hands", "feet"]) { const it = itemOf(worn(f, slot)); if (it?.type && n[it.type] != null) n[it.type] += slot === "chest" ? 2 : 1; }
    return n.heavy > n.light && n.heavy > n.cloth ? "heavy" : n.light > n.cloth ? "light" : n.cloth > 0 ? "cloth" : "none";
  }
  const knows = (f, kinds, school) => (f.spells || []).some((id) => { const sp = typeof D !== "undefined" && D.SPELLS[id]; return sp && kinds.includes(sp.kind) && (!school || sp.school === school); });
  /* the build their worn gear says, or null when the gear says nothing (they keep the build they have) */
  function buildOf(f, id) {
    if (!f) return null;
    const nat = F2() ? F2().archOf(id) : "warrior", cur = f.arch || nat;
    const wr = worn(f, "weapon"), w = itemOf(wr), off = itemOf(worn(f, "offhand")), sh = itemOf(worn(f, "shield")), ar = armorKind(f);
    const pick = (fam, def) => (fam.includes(cur) ? cur : fam.includes(nat) ? nat : def);
    if (w?.staff) return w.skill === "Conjuration" ? "conjurer" : w.skill === "Restoration" ? "healer" : w.skill === "Destruction" ? "mage" : pick(MAGE_FAMILY, "mage");
    if (w && w.skill === "Archery") return "archer";
    if (w && w.hands === 2) return "twohand";
    if (w) {
      if (sh) return cur === "healer" && ar !== "heavy" ? "healer" : "warrior";   // sword and shield: they hold the line
      if (wtype(wr) === "dagger") return "thief";
      if (off) return pick(["thief", "warrior", "spellsword"], ar === "heavy" ? "warrior" : "thief");
      if (["spellsword", "healer"].includes(cur) || ["spellsword", "healer"].includes(nat)) return pick(["spellsword", "healer"], "spellsword");
      if (ar !== "heavy" && (knows(f, ["damage", "dot", "cloak"], "Destruction") || MAGE_FAMILY.includes(nat))) return "spellsword";
      return "warrior";
    }
    // empty hands: spells or robes make a mage; otherwise the gear says nothing
    if (ar === "cloth" || knows(f, ["damage", "dot", "summon", "reanimate", "heal", "healally"])) {
      if (MAGE_FAMILY.includes(cur)) return cur;
      if (MAGE_FAMILY.includes(nat)) return nat;
      return knows(f, ["summon", "reanimate"]) && !knows(f, ["damage", "dot"]) ? "conjurer" : "mage";
    }
    return null;
  }
  /* gear changed: switch build if the gear says so, free, and respec into the new trees. Returns a line or "". */
  function refit(s, id = s?.follower?.id) {
    const f2 = F2(); if (!f2 || !id || !s.folData?.[id]) return "";
    const f = s.folData[id], b = buildOf(f, id);
    if (!b || b === f.arch || !f2.ARCH[b]) return "";
    const was = f.arch;
    f.arch = b; f.perks = {};
    f2.spend(s, id);
    if (typeof FAI !== "undefined") {   // a new mage remembers the basic spells of the style, if their skill allows
      FAI.seed(f);
      for (const sp of FAI.START[b] || []) if (!f.spells.includes(sp) && D.SPELLS[sp] && FAI.canLearn(f, sp, s) === true) f.spells.push(sp);
    }
    f.builds = (f.builds || 0) + 1;
    const n = Object.values(f.perks).reduce((a, x) => a + x, 0);
    return `${nameOf(id)} now fights as ${art(f2.ARCH[b].name)} (was ${art(f2.ARCH[was]?.name || was)}) and picks ${n} perk${n === 1 ? "" : "s"} in the new trees.`;
  }
  const art = (n) => (/^[AEIOU]/i.test(n) ? "an " : "a ") + String(n).toLowerCase();

  // ------------------------------------------------------------------ skills rising with use
  /* the same steps as your own skills (engine.js useSkill) on the follower's record. Returns {ups:[skill...], lv:[...]} */
  function rise(s, id, name, baseXp, mult = 1) {
    const f = s.folData?.[id]; if (!f || !f.skills || !(baseXp > 0)) return { ups: [], lv: [] };
    const sk = f.skills[name]; if (!sk || typeof F === "undefined") return { ups: [], lv: [] };
    sk.xp += F.skillXpGained(name, baseXp) * mult;
    const ups = [], lv = [];
    while (sk.lvl < 100 && sk.xp >= F.skillXpNeeded(name, sk.lvl)) {
      sk.xp -= F.skillXpNeeded(name, sk.lvl);
      sk.lvl += 1; ups.push(name);
      f.cxp = (f.cxp || 0) + sk.lvl;   // [Skyrim] character XP = the skill's new level
      lv.push(...levelLoop(s, id));
    }
    if (sk.lvl >= 100) sk.xp = 0;
    lv.push(...levelLoop(s, id));   // XP that waited for you to level up
    return { ups, lv };
  }
  const top = (s, id) => Math.min(F2() ? F2().capOf(id) : 50, Math.max(1, s.level || 1));
  function levelLoop(s, id) {
    const f = s.folData[id], out = [], T = top(s, id);
    while (f.lvl < T && f.cxp >= F.charXpNeeded(f.lvl)) {
      f.cxp -= F.charXpNeeded(f.lvl); f.lvl += 1;
      const at = pickAttr(f); f.ups[at] = (f.ups[at] || 0) + 1;
      const took = F2() ? F2().spend(s, id) : [];
      out.push({ lvl: f.lvl, attr: at, took });
    }
    if (f.lvl >= T) f.cxp = Math.min(f.cxp, F.charXpNeeded(f.lvl));   // a full bar waits until you level up
    return out;
  }
  /* [OURS] how fast they learn: LEARN, Leadership (Speechcraft), and catching up when far behind you */
  function mult(s, f) {
    const behind = Math.max(0, (s.level || 1) - (f.lvl || 1) - 2);
    const lead = typeof PFX !== "undefined" ? Math.min(0.5, PFX.num(s, "folxp") || 0) : 0;
    return LEARN * (1 + Math.min(2, behind * 0.25)) * (1 + lead);
  }

  // ------------------------------------------------------------------ in a fight: what they did, what hit them
  const bag = (fight, al) => { if (!fight || !al?.fid) return null; fight._fsx = fight._fsx || {}; return (fight._fsx[al.fid] = fight._fsx[al.fid] || {}); };
  const add = (b, k, v) => { if (b && k && v > 0) b[k] = (b[k] || 0) + v; };
  /* after one of their actions (followerai.js turn) */
  function acted(fight, al, o, r) {
    const b = bag(fight, al); if (!b || !o || !r) return;
    if (o.k === "attack" || o.k === "power") {
      if (!(r.dmg > 0)) return;
      add(b, al.wsk || "Hand-to-Hand", al.wbase || 4);
      if (al.dual && !al.bow) add(b, "One-Handed", (al.wbase || 4) * 0.5);
      if (/sneak attack/.test(r.text || "")) add(b, "Sneak", 30);
    } else if (o.k === "cast" && o.sp) add(b, o.sp.school, (o.sp.xp || 10) * (/misses/.test(r.text || "") ? 0.25 : 1));
  }
  /* a blow landed on them; d = what got through after their guard */
  function hit(fight, al, raw, d) {
    const b = bag(fight, al); if (!b || !(raw > 0)) return;
    if (al.guard && al.shield) add(b, "Blocking", Math.max(0, raw - d));
    const k = { heavy: "Heavy Armor", light: "Light Armor" }[al.armorKind];
    if (k) add(b, k, d); else add(b, "Unarmored", typeof F !== "undefined" ? F.UNARMORED_XP_PER_HIT : 1);
  }
  /* after the fight (FOL2.gain): turn what they did into skill and level increases; toast lines */
  function after(s, fight) {
    const id = s.follower?.id, f = id && s.folData?.[id]; if (!f || !fight) return [];
    if (!f.skills) seed(f, id);
    const b = fight._fsx?.[id]; if (!b) return [];
    const m = mult(s, f), name = nameOf(id), up = {}, lv = [];
    for (const [k, v] of Object.entries(b)) { const r = rise(s, id, k, v, m); for (const u of r.ups) up[u] = f.skills[u].lvl; lv.push(...r.lv); }
    delete fight._fsx[id];
    const msgs = Object.entries(up).map(([k, l]) => `${name}: ${k} increased to ${l}`);
    for (const x of lv) msgs.push(`⬆ ${name} reaches level ${x.lvl} (+10 ${ATTR_NAME[x.attr].toLowerCase()})${x.took.length ? ` and learns ${x.took.join(", ")}` : ""}.`);
    if (typeof window !== "undefined" && msgs.length) try { window.dispatchEvent(new CustomEvent("folskill", { detail: { id, msgs } })); } catch (e) { /* fine */ }
    return msgs;
  }

  // ------------------------------------------------------------------ real perk effects in their fights (perkfx.js)
  /* their perks read through perkfx.js like yours: a stand-in save with their skills and perks, and a stand-in fight
     that knows what they wear. Only the steady effects count (more damage with their weapon, power attacks, blows taken,
     hit chance, blocking); capped so a follower never one-shots a strong foe. */
  function mods(s, f) {
    const out = { out: 1, pow: 1, inn: 1, hit: 0, block: 0, spell: 1 };
    if (typeof PFX === "undefined" || !f?.perks || !Object.keys(f.perks).length) return out;
    try {
      const view = { level: f.lvl, skills: f.skills || {}, perks: f.perks, fx: [], spells: [], hpBonus: 0, loadouts: null, inv: null, race: "nord" };
      const eq = {}; for (const [slot, rid] of Object.entries(f.eq || {})) { const r = f.inv.find((x) => x.id === rid); if (r) eq[slot === "offhand" ? "offhand" : slot] = r; }
      const w = itemOf(eq.weapon), sk = w ? (w.staff ? null : w.skill) : "Hand-to-Hand";
      const ff = { s: view, eq, tags: new Set(), e: {}, ehp: 0, hp: NaN, weaponSkill: () => sk, wt: eq.weapon ? wtype(eq.weapon) : "fist" };
      const x = { sk, wt: ff.wt };
      out.out = 1 + clamp(PFX.sum(view, "out", ff, x), 0, 0.35);
      out.pow = 1 + clamp(PFX.sum(view, "out", ff, { ...x, power: true }) - (out.out - 1), 0, 0.3);
      out.inn = 1 + clamp(PFX.sum(view, "in", ff, {}), -0.25, 0);
      out.hit = clamp(PFX.sum(view, "hit", ff, x), 0, 0.08);
      out.block = clamp(PFX.sum(view, "block", ff, { blocking: true }), 0, 0.1);
      out.spell = 1 + clamp(PFX.sum(view, "out", ff, { school: "Destruction", kind: "damage" }), 0, 0.3);
    } catch (e) { /* stand-in failed: plain numbers */ }
    return out;
  }
  /* fill in a follower's fight record (FAI.equipAlly calls this) */
  function equip(s, f, rec) {
    const wr = worn(f, "weapon"), w = itemOf(wr);
    rec.wsk = w ? (w.staff ? null : w.skill || "One-Handed") : "Hand-to-Hand";
    rec.wbase = w ? (w.damage || 4) + (wr.temper || 0) : 4;
    rec.armorKind = armorKind(f);
    rec.px = mods(s, f);
    rec.build = f.arch;
    return rec;
  }

  // ------------------------------------------------------------------ the follower screen: Skills view (read-only)
  function view(s, f, esc, id = s.follower?.id) {
    const f2 = F2(); if (!f2 || !f) return "";
    if (!f.skills) seed(f, id);
    const a = f2.ARCH[f.arch] || f2.ARCH.warrior, T = top(s, id), need = F.charXpNeeded(f.lvl);
    const trees = new Set([...a.main, ...a.sec]);
    const list = ALL().filter((k) => f.skills[k]).sort((x, y) => (trees.has(y) - trees.has(x)) || f.skills[y].lvl - f.skills[x].lvl || x.localeCompare(y));
    const row = (k) => { const v = f.skills[k], n = v.lvl >= 100 ? 1 : F.skillXpNeeded(k, v.lvl), pc = v.lvl >= 100 ? 100 : Math.round(100 * v.xp / n);
      return `<div class="fb-sk${trees.has(k) ? " main" : ""}" data-sk="${esc(k)}"><span class="fb-n">${esc(k)}</span><b class="num">${v.lvl}</b><div class="bar"><i style="width:${v.lvl}%"></i></div><div class="fb-prog"><i style="width:${pc}%"></i></div></div>`; };
    const perks = Object.entries(f.perks || {}).filter(([, r]) => r > 0).map(([pid, r]) => ({ pid, r, p: PERKS.BY_ID[pid] })).filter((x) => x.p);
    const byTree = {}; for (const x of perks) (byTree[x.p.skill] = byTree[x.p.skill] || []).push(x);
    const pts = Math.max(0, PERKS.pointsLeft(f2.pseudo(f)));
    const perkHtml = Object.entries(byTree).map(([t, xs]) => `<div class="fb-tree"><h4>${esc(t)} <span class="num">${xs.length}</span></h4><ul>${xs.map((x) => `<li title="${esc(PERKS.rankText ? PERKS.rankText(x.pid, x.r) : x.p.desc)}">${esc(x.p.name)}${x.p.ranks > 1 ? ` <span class="num">${x.r}/${x.p.ranks}</span>` : ""}</li>`).join("")}</ul></div>`).join("")
      || `<p class="sub">No perks yet. They pick one as soon as a skill of their build is high enough.</p>`;
    const ups = f.ups || {};
    return `<div class="fb-build"><div class="fb-badge">${esc(a.name)}</div><div class="t"><b>Level ${f.lvl}</b><span>${f.lvl >= T ? (f.lvl >= f2.capOf(id) ? `Level cap ${f2.capOf(id)}` : "Waits for you to level up") : `${Math.floor(f.cxp || 0)}/${need} toward level ${f.lvl + 1}`}</span>
        <div class="bar fb-cxp"><i style="width:${f.lvl >= T ? 100 : Math.round(100 * (f.cxp || 0) / need)}%"></i></div>
        <span class="sub">Their gear picks the build: bow = archer, staff or spells = mage, two-hander = two-hander, sword and shield = warrior, dagger = thief. Change their gear and they change build and perks for free.</span>
        <span class="sub">Level-ups so far: +${10 * (ups.health || 0)} health · +${10 * (ups.magicka || 0)} magicka · +${10 * (ups.stamina || 0)} stamina (they choose by their build)</span></div></div>
      <h3>Skills</h3><p class="sub">They rise with use, like yours. Bold = their build's skills.</p><div class="fb-skills">${list.map(row).join("")}</div>
      <h3>Perks <span class="num">${perks.reduce((x, y) => x + y.r, 0)}</span></h3><p class="sub">${pts ? `${pts} waiting · ` : ""}They spend points by themselves in their build's trees.</p><div class="fb-perks">${perkHtml}</div>`;
  }

  /* the summary for party members' phones (netsync: rides in your player card) */
  function card(f) {
    if (!f?.skills) return {};
    const top3 = Object.entries(f.skills).sort((x, y) => y[1].lvl - x[1].lvl).slice(0, 3).map(([k, v]) => [k, v.lvl]);
    return { sk: top3, pk: Object.values(f.perks || {}).reduce((a, x) => a + x, 0) };
  }

  /* hook FAI.takes so every blow they take is counted (followerai.js stays as it was for that) */
  function install() {
    if (typeof FAI === "undefined" || FAI.__fb) return;
    FAI.__fb = true;
    const takes0 = FAI.takes;
    FAI.takes = function (fight, al, d) {
      const raw = d * (al?.px?.inn || 1);
      const r = takes0.call(this, fight, al, raw);
      try { hit(fight, al, d, r); } catch (e) { /* never break a fight */ }
      return r;
    };
  }
  install();
  return { LEARN, PLAN, seed, pickAttr, lvlOf, buildOf, refit, rise, mult, acted, hit, after, mods, equip, view, card, armorKind, top, install };
})();
if (typeof module !== "undefined") module.exports = FBUILD;
