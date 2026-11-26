/* Foe kits: every foe uses everything it comes with, not just a plain swing. [OURS]
   Remigiusz: "Combat should be interesting, currently enemies have basic actions and they should use all what they
               spawn roll with."
   - A foe's kit comes from what it rolled: its archetype (warrior, brute, archer, mage, rogue), its kind (wolf, troll,
     spider, draugr...), its element, its perks (healing, power attacks) and the potions it carries.
   - Each turn it may use a kit move instead of a plain blow. Moves have cooldowns, and moves it hasn't tried yet are
     more likely, so over a fight you see all of it.
   - Some moves are slow and you see them coming ("takes aim", "winds up"): guard or hit it first.
   - Foe guards, wards and dodges soften your next blow; the chips on its frame show what it has up.
   Balanced: kit moves replace plain blows (they're not extra), and buff turns deal no damage. */
const FOEKIT = (() => {
  const h01 = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
  const USE = 0.5;            // chance a turn goes to a kit move when one is ready
  const useOf = (f) => USE * (typeof DIFF !== "undefined" ? DIFF.kitUse(f) : 1);   // Story foes use their kit less, Hard foes more (difficulty.js)
  const NEW_W = 2.2;          // moves not used yet this fight weigh this much more
  const MELEE = new Set(["attack", "power_attack", "bash"]);
  const isSpellA = (a) => /^(spell|dual|scroll|staff):/.test(a || "");
  const elOf = (f) => {
    const e = f.e, n = String(e.name || "");
    if (e.element) return e.element;
    if (/fire|flame|pyro|ember|ash/i.test(n)) return "fire";
    if (/frost|ice|snow|cryo|draugr|wight/i.test(n)) return "frost";
    if (/storm|shock|spark|lightning/i.test(n)) return "shock";
    return ["fire", "frost", "shock"][Math.floor(h01(n) * 3)];
  };
  const EL = { fire: { bolt: "Firebolt", fx: "burns" }, frost: { bolt: "Ice Spike", fx: "chills" }, shock: { bolt: "Lightning Bolt", fx: "jolts" } };

  // ---------------------------------------------------------------- what a move does
  /* a blow through the normal engine (armour, blocks, wards, perks), scaled by `mul` */
  function hit(f, enemyTurn, mul, o = {}) {
    const hpB = f.hp; f.eMagic = !!o.magic;
    let t; try { t = enemyTurn(); } finally { f.eMagic = false; }
    if (!o.keepName) { const nm = String(f.e.name || ""); if (nm && t.startsWith(nm + " ")) t = t.slice(nm.length + 1); }   // "Bandit hits 24" → "hits 24" after the move's own name
    let loss = hpB - f.hp;
    const rage = f.kit?.rage > 0 ? 1.25 : 1;
    if (loss > 0) { f.hp = hpB - loss * mul * rage; loss = hpB - f.hp; }
    return { t, loss };
  }
  /* poison, burning, bleeding on you: stacks (stacks.js), a fresh one adds to what's there */
  const dot = (f, name, dmg, turns, magic) => {
    if (typeof STACKS !== "undefined") STACKS.add(f, "me", name === "bleeding" ? "bleed" : "poison", turns, { per: STACKS.perFor(Math.max(1, dmg), turns), name, magic });
    else f.kitDot = { name, dmg: Math.max(1, dmg), turns, magic: !!magic };
  };
  /* knocked off balance: Winded stacks take stamina at the start of your next turns (no more lost action points) */
  const wind = (f, n) => { if (typeof STACKS !== "undefined") STACKS.add(f, "me", "winded", n); else f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * 0.05 * n); };
  const base = (f) => Math.max(1, f.e.damage || 5);
  /* poison, burning and bleeding follow the blow that caused them: armour that soaked most of the cut soaks most of the poison too */
  const thru = (f, r, mul) => Math.max(0.25, Math.min(1, r.loss / (base(f) * mul)));
  const MOVES = {
    // warriors: shield on the arm
    shield_bash: { label: "Shield bash", cd: 3, w: 3, run(f, et, n) { const r = hit(f, et, 0.7); if (r.loss > 0) { const b = f.sp; f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * 0.1); wind(f, 1); return `${n} slams you with a shield: ${r.t} (−${Math.round(b - f.sp)} stamina, winded)`; } return `${n} swings a shield at you: ${r.t}`; } },
    raise_shield: { label: "Raise shield", cd: 4, w: 2, buff: true, run(f, et, n) { f.kit.guard = 0.5; return `${n} raises a shield and braces (your next melee blow does half)`; } },
    // brutes: big two-handers
    wind_up: { label: "Wind up", cd: 4, w: 3, tele: true, run(f, et, n) { f.kit.windup = "smash"; f.kit.windTurn = f.kit.myTurns || 0; return `${n} lifts the weapon high, winding up a huge blow. Guard or hit them hard!`; } },
    war_cry: { label: "War cry", cd: 5, w: 2, buff: true, run(f, et, n) { f.kit.rage = 3; return `${n} roars a war cry (hits 25% harder for 3 turns)`; } },
    // archers
    take_aim: { label: "Take aim", cd: 4, w: 3, tele: true, run(f, et, n) { f.kit.windup = "aimed"; return `${n} draws and takes careful aim at you...`; } },
    poison_arrow: { label: "Poison arrow", cd: 4, w: 2, run(f, et, n) { const r = hit(f, et, 0.8); if (r.loss > 0) { dot(f, "poison", base(f) * 0.35 * thru(f, r, 0.8), 3); return `${n} looses a poisoned arrow: ${r.t} (you're poisoned)`; } return `${n} looses a poisoned arrow: ${r.t}`; } },
    // mages
    bolt: { label: "Bolt", cd: 2, w: 4, run(f, et, n) {
      const el = elOf(f), r = hit(f, et, 1.15, { magic: true });
      let x = "";
      if (r.loss > 0) {
        if (el === "fire") { dot(f, "burning", base(f) * 0.3 * thru(f, r, 1.15), 2, true); x = " (you're burning)"; }
        else if (el === "frost") { const b = f.sp; f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * 0.15); x = ` (−${Math.round(b - f.sp)} stamina)`; }
        else { const b = f.mp; f.mp = Math.max(0, f.mp - G.maxMagicka(f.s) * 0.15); x = ` (−${Math.round(b - f.mp)} magicka)`; }
      }
      return `${n} casts ${EL[el].bolt}: ${r.t}${x}`;
    } },
    foe_ward: { label: "Ward", cd: 5, w: 2, buff: true, run(f, et, n) { f.kit.ward = Math.round(base(f) * 2.5); return `${n} raises a ward against your spells (${f.kit.ward})`; } },
    mend: { label: "Healing spell", cd: 5, w: 3, when: (f) => f.ehp < (f.ehp0 || f.ehp) * 0.55 && (f.kit.used.mend || 0) < 2 && (typeof FOECAP === "undefined" || FOECAP.canHeal(f)), run(f, et, n) { let h = Math.round((f.ehp0 || f.ehp) * 0.1);   /* a foe's magicka runs dry: two heals a fight (and foecap.js's limits) */ if (typeof FOECAP !== "undefined") h = FOECAP.heal(f, h); else f.ehp = Math.min(f.ehp0 || f.ehp + h, f.ehp + h); return `${n} casts a healing spell: +${h}`; } },
    // rogues
    poison_blade: { label: "Poisoned blade", cd: 3, w: 3, run(f, et, n) { const r = hit(f, et, 0.9); if (r.loss > 0) { dot(f, "poison", base(f) * 0.4 * thru(f, r, 0.9), 3); return `${n} cuts you with a poisoned blade: ${r.t} (you're poisoned)`; } return `${n} slashes with a poisoned blade: ${r.t}`; } },
    shadowstep: { label: "Shadowstep", cd: 4, w: 2, buff: true, run(f, et, n) { f.kit.evade = 0.6; return `${n} slips into the shadows (your next blow may miss)`; } },
    // beasts
    pounce: { label: "Pounce", cd: 3, w: 3, run(f, et, n) { const r = hit(f, et, 1.1); if (r.loss > 0) { const b = f.sp; f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * 0.2); return `${n} pounces on you: ${r.t} (−${Math.round(b - f.sp)} stamina)`; } return `${n} pounces: ${r.t}`; } },
    maul: { label: "Maul", cd: 3, w: 3, run(f, et, n) { const r = hit(f, et, 0.9); if (r.loss > 0) { dot(f, "bleeding", base(f) * 0.1 * thru(f, r, 0.9), 2); return `${n} mauls you: ${r.t} (you're bleeding)`; } return `${n} claws at you: ${r.t}`; } },
    howl: { label: "Howl", cd: 6, w: 1, buff: true, run(f, et, n) { f.kit.rage = 2; return `${n} howls, hackles up (hits 25% harder for 2 turns)`; } },
    venom: { label: "Venom spit", cd: 3, w: 3, run(f, et, n) { const r = hit(f, et, 0.7); if (r.loss > 0) dot(f, "venom", base(f) * 0.3 * thru(f, r, 0.7), 3); else return `${n} spits venom: ${r.t}`; return `${n} spits venom: ${r.t} (you're poisoned)`; } },
    regen: { label: "Regenerate", cd: 5, w: 3, when: (f) => f.ehp < (f.ehp0 || f.ehp) * 0.8 && ((f.kit && f.kit.used && f.kit.used.regen) || 0) < 4, /* at most 4 times a fight (20%) */ run(f, et, n) { const h = Math.round((f.ehp0 || f.ehp) * 0.05); f.ehp = Math.min(f.ehp0 || f.ehp + h, f.ehp + h); return `${n}'s wounds close up: +${h}`; } },
    // undead
    force: { label: "Unrelenting Force", cd: 5, w: 2, run(f, et, n) { const r = hit(f, et, 0.6, { magic: true }); wind(f, 2); const b = f.sp; f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * 0.08); return `${n} shouts FUS RO DAH! ${r.t} (you're knocked back: winded, −${Math.round(b - f.sp)} stamina)`; } },
    frost_breath: { label: "Frost breath", cd: 4, w: 2, run(f, et, n) { const r = hit(f, et, 1.1, { magic: true }); const b = f.sp; f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * 0.15); return `${n} breathes frost: ${r.t} (−${Math.round(b - f.sp)} stamina)`; } },
    life_drain: { label: "Drain life", cd: 3, w: 3, run(f, et, n) { const r = hit(f, et, 0.9, { magic: true }); if (r.loss > 0) { let h = Math.round(r.loss * 0.4); if (typeof FOECAP !== "undefined") h = FOECAP.heal(f, h, { noCd: true }); else f.ehp = Math.min(f.ehp0 || f.ehp + h, f.ehp + h); return h > 0 ? `${n} drains your life: ${r.t} (heals ${h})` : `${n} drains your life: ${r.t}`; } return `${n} reaches for your life: ${r.t}`; } },
    // anyone who carries them
    potion: { label: "Healing potion", cd: 99, w: 5, when: (f) => f.kit.pots > 0 && f.ehp < (f.ehp0 || f.ehp) * 0.4 && (typeof FOECAP === "undefined" || FOECAP.canHeal(f, { noCd: true })), run(f, et, n) { f.kit.pots--; let h = Math.round((f.ehp0 || f.ehp) * 0.18); if (typeof FOECAP !== "undefined") h = FOECAP.heal(f, h, { noCd: true }); else f.ehp = Math.min(f.ehp0 || f.ehp + h, f.ehp + h); return `${n} gulps down a healing potion: +${h}`; } },
  };
  /* the slow ones land next turn */
  const WIND = {
    smash: { mul: 1.9, text: (n, t) => `${n} brings the huge blow down: ${t}` },
    aimed: { mul: 1.7, text: (n, t) => `${n}'s aimed shot flies: ${t}` },
  };

  // ---------------------------------------------------------------- which moves a foe has
  function kitFor(e) {
    if (!e || e.player || e.ally || e.kind === "event") return [];
    const n = String(e.name || ""), tags = new Set(e.tags || []), out = [];
    const add = (...ids) => ids.forEach((id) => { if (!out.includes(id)) out.push(id); });
    if (tags.has("dragon")) return [];   // dragons have their own moves (dragons.js)
    if (e.teach === "windup") return ["wind_up"];   // [first30] the first fight: one move to learn (first30.js)
    const arch = e.arch;
    if (arch === "warrior") add("shield_bash", "raise_shield");
    else if (arch === "brute") add("wind_up", "war_cry");
    else if (arch === "archer") add("take_aim", "poison_arrow");
    else if (arch === "mage") add("bolt", "foe_ward", "mend");
    else if (arch === "rogue") add("poison_blade", "shadowstep");
    if (/mage|wizard|sorcer|warlock|witch|conjurer|necromancer|hagraven|thalmor|justiciar|lich|priest/i.test(n)) add("bolt", "foe_ward");
    if (/necromancer|vampire|lich|bonecaller/i.test(n)) add("life_drain");
    if (/healer|vigilant|acolyte|priest of|monk/i.test(n)) add("mend");
    if (/archer|hunter|marksman|ranger|scout/i.test(n)) add("take_aim");
    if (/assassin|thief|cutpurse|brotherhood|shadow/i.test(n)) add("poison_blade", "shadowstep");
    if (/draugr|wight|scourge|deathlord/i.test(n)) add("force", "frost_breath");
    if (/wolf|sabre|cat|dog|fox|skeever|hound|werewolf/i.test(n)) add("pounce");
    if (/bear|troll|werewolf|sabre|cat/i.test(n)) add("maul");
    if (/wolf|werewolf|hound|dog/i.test(n)) add("howl");
    if (/spider|chaurus|frostbite/i.test(n)) add("venom");
    if (/troll|hagraven|briarheart/i.test(n)) add("regen");
    if (/giant|mammoth|ogre/i.test(n)) add("wind_up");
    if (/bandit|outlaw|thug|marauder|forsworn|soldier|legionnaire|stormcloak|imperial|guard|silver hand|mercenary/i.test(n)) { if (!out.length) add("wind_up"); }
    return out;
  }
  /* humanoids carry 0-2 healing potions (the same foe always has the same number) */
  const potsFor = (e) => (/bandit|outlaw|thug|marauder|forsworn|soldier|legionnaire|stormcloak|imperial|guard|silver hand|mercenary|assassin|thalmor|vampire|mage|necromancer|warlock|hunter/i.test(e.name || "") || (e.tags || []).includes("humanoid")) ? Math.floor(h01("pots" + (e.name || "") + (e.level || 0)) * 3) : 0;

  function setup(f) {
    if (!f || !f.e) return null;
    const ids = kitFor(f.e), pots = potsFor(f.e);
    if (pots && !ids.includes("potion")) ids.push("potion");
    f.kit = { ids, cd: {}, used: {}, pots, guard: 0, ward: 0, evade: 0, rage: 0, windup: null };
    return f.kit;
  }
  const ready = (f) => {
    const k = f.kit;
    return k.ids.filter((id) => !(k.cd[id] > 0) && MOVES[id] && (!MOVES[id].when || MOVES[id].when(f)) && !(MOVES[id].buff && k[{ raise_shield: "guard", foe_ward: "ward", shadowstep: "evade", war_cry: "rage", howl: "rage" }[id]] > 0));
  };
  function pick(f, rnd = Math.random) {
    const list = ready(f); if (!list.length) return null;
    const urgent = list.find((id) => MOVES[id].when && id !== "regen");   // healing when hurt comes first
    if (urgent && rnd() < 0.8) return urgent;
    const w = list.map((id) => MOVES[id].w * (f.kit.used[id] ? 1 : NEW_W)), tot = w.reduce((a, b) => a + b, 0);
    let r = rnd() * tot;
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
    return list[0];
  }
  /* the foe's turn: poison on you ticks, a wound-up blow lands, or it may use a kit move. `enemyTurn` is the normal blow. */
  function turn(f, enemyTurn, rnd = Math.random) {
    if (!f.kit) setup(f);
    const k = f.kit, n = f.e.name;
    let pre = "";
    if (f.kitDot && f.hp > 1) {
      const d = Math.min(f.kitDot.dmg, f.hp - 1); f.hp -= d; pre = `you take ${Math.round(d)} from ${f.kitDot.name} · `;
      if (--f.kitDot.turns <= 0) f.kitDot = null;
    }
    for (const id in k.cd) if (k.cd[id] > 0) k.cd[id]--;
    if (k.rage > 0) k.rage--;
    const pl = k.plan && k.plan.length ? k.plan.shift() : null;   // what its intent said it would do (plan below)
    if (f.calmTurns > 0 || f.eParalyzed > 0 || f.stagger || f.fearTurns > 0 || f.unseen > 0) { if (k.windup) { k.windup = null; return pre + enemyTurn() + " (the wind-up is lost)"; } return pre + enemyTurn(); }
    // [first30] a teaching foe keeps the blow raised until you've had a turn to answer it (first30.js)
    if (k.windup && f.e.teach && k.windTurn === (k.myTurns || 0)) { const r = hit(f, enemyTurn, 1, { keepName: true }); return pre + r.t; }
    if (k.windup) {
      const w = WIND[k.windup]; k.windup = null;
      const r = hit(f, enemyTurn, w.mul);
      return pre + w.text(n, r.t);
    }
    if (pl && (pl.id === "blow" || pl.id === "land")) { const r = hit(f, enemyTurn, 1, { keepName: true }); return pre + r.t; }
    if (!pl && (!k.ids.length || rnd() >= useOf(f))) { const r = hit(f, enemyTurn, 1, { keepName: true }); return pre + r.t; }
    const id = pl && ready(f).includes(pl.id) ? pl.id : pick(f, rnd);
    if (!id) { const r = hit(f, enemyTurn, 1, { keepName: true }); return pre + r.t; }
    const m = MOVES[id]; k.cd[id] = m.cd; k.used[id] = (k.used[id] || 0) + 1; f.kitLast = id;
    return pre + m.run(f, enemyTurn, n);
  }
  /* [OURS] intents (fightread.js shows them): decide now what its next `n` turns will be, so the screen can show it
     before it happens. The same odds as rolling each turn; turn() follows the plan while the move is still possible
     (a stun, a broken wind-up or a heal that's no longer needed falls back to a fresh roll). A new round re-plans. */
  function plan(f, n, rnd = Math.random) {
    if (!f || !f.kit) return [];
    const k = f.kit, sim = { ...k, cd: { ...k.cd }, used: { ...k.used } }, out = [];
    let wind = k.windup;
    // [first30] a teaching foe winds up for sure as its last move of its 2nd round, so the guard hint has its moment (first30.js)
    const teach = f.e && f.e.teach === "windup" && !k.used.wind_up && !wind && (k.plans = (k.plans || 0) + 1) >= 2;
    f.kit = sim;
    try {
      for (let i = 0; i < n; i++) {
        for (const id in sim.cd) if (sim.cd[id] > 0) sim.cd[id]--;
        if (wind) { out.push({ id: "land", wind }); wind = null; continue; }
        if (teach && i === n - 1 && !(sim.cd.wind_up > 0)) { sim.cd.wind_up = MOVES.wind_up.cd; sim.used.wind_up = 1; wind = "smash"; out.push({ id: "wind_up" }); continue; }
        if (!sim.ids.length || rnd() >= useOf(f)) { out.push({ id: "blow" }); continue; }
        const id = pick(f, rnd);
        if (!id) { out.push({ id: "blow" }); continue; }
        sim.cd[id] = MOVES[id].cd; sim.used[id] = (sim.used[id] || 0) + 1;
        if (id === "wind_up") wind = "smash"; else if (id === "take_aim") wind = "aimed";
        out.push({ id });
      }
    } finally { f.kit = k; }
    k.plan = out;
    return out;
  }
  /* your blow just landed (f.ehp went down from `before`): its guard, ward or dodge softens it */
  function defend(f, a, before) {
    const k = f.kit; if (!k || f.ehp >= before) return "";
    const dealt = before - f.ehp;
    if (k.evade > 0 && !isSpellA(a)) { const ch = k.evade; k.evade = 0; if (Math.random() < ch) { f.ehp = before; return ` (${f.e.name} sidesteps it)`; } }
    if (k.guard > 0 && MELEE.has(a)) { const back = dealt * k.guard; f.ehp += back; k.guard = 0; return ` (into the raised shield: −${Math.round(back)})`; }
    if (k.ward > 0 && isSpellA(a)) { const used = Math.min(k.ward, dealt); f.ehp += used; k.ward -= used; return ` (${f.e.name}'s ward soaks ${Math.round(used)}${k.ward <= 0 ? ", and breaks" : ""})`; }
    if (k.windup && dealt >= (f.ehp0 || 1) * 0.12 && (MELEE.has(a) || isSpellA(a)) && Math.random() < 0.5) { k.windup = null; return ` (it breaks ${f.e.name}'s wind-up!)`; }
    return "";
  }
  /* old phones still ask how many action points a bash took: none any more (it winds you instead) */
  const apLoss = (f) => { if (f) f.kitApLoss = 0; return 0; };
  /* chips for the foe frame */
  function chips(f) {
    const k = f.kit; if (!k) return [];
    const out = [];
    if (k.windup) out.push(["windup", k.windup === "aimed" ? "" : "", k.windup === "aimed" ? "Taking aim: a big shot lands next turn. Guard, or hit it hard to throw it off." : "Winding up: a huge blow lands next turn. Guard, or hit it hard to break it."]);
    if (k.guard > 0) out.push(["guard", "", "Shield raised: your next melee blow does half."]);
    if (k.ward > 0) out.push(["ward", "" + k.ward, "Ward up: soaks damage from your spells."]);
    if (k.evade > 0) out.push(["evade", "", "In the shadows: your next blow may miss."]);
    if (k.rage > 0) out.push(["rage", "" + k.rage, "Enraged: hits 25% harder."]);
    if (f.kitDot && typeof FIGHTREAD === "undefined") out.push(["dot", "" + f.kitDot.turns, `You're ${f.kitDot.name === "burning" ? "burning" : f.kitDot.name === "bleeding" ? "bleeding" : "poisoned"}: ${Math.round(f.kitDot.dmg)} a turn.`]);   // with fightread.js it sits on your own frame
    return out;
  }
  /* what it can do, for its tooltip */
  const names = (f) => (f.kit?.ids || []).map((id) => (id === "bolt" ? EL[elOf(f)].bolt : MOVES[id].label) + (id === "potion" ? ` ×${f.kit.pots}` : ""));
  return { MOVES, WIND, USE, kitFor, potsFor, setup, pick, plan, ready, turn, defend, apLoss, wind, chips, names, elOf };
})();
if (typeof module !== "undefined") module.exports = FOEKIT;
