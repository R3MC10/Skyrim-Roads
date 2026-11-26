/* fxicons.js: every buff and debuff in a fight as a small icon on whoever has it (you, followers, party members, the foe),
   with the turns left and a tooltip that says what it does with numbers. combat2.js puts the icons in the fight scene and
   pops a short "+Oakflesh" / "Poisoned" / "Oakflesh fades" when one lands or runs out. [OURS: Remigiusz "every status
   effect, buffs and debuffs, must show in combat on whoever has it"]
   FXICONS.TYPES: every effect type, with its icon, name, buff or not, and a tooltip maker.
   FXICONS.me(f, sess) / foe(f) / ally(f, a): the effects on that fighter right now: [{k, ic, nm, buff, n, tip}].
   FXICONS.SPELL_KIND: which effect each kind of spell leaves (null: it's instant, nothing lingers). */
const FXICONS = (() => {
  const r0 = (n) => Math.round(+n || 0);
  const pc = (x) => `${Math.round((+x || 0) * 100)}%`;
  const elName = (e) => ({ fire: "fire", frost: "frost", shock: "shock", poison: "poison" }[e] || "magic");
  const t = (s) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(s) ?? s : s);   // Polish via i18n_combat2.js (data-tip isn't translated on the page)
  /* [icon, name, buff?, tip(v)]  v: {n (turns), amt, name, ...} */
  const TYPES = {
    // --- on you: spells and shouts you put on yourself
    armour: ["", "Armour spell", true, (v) => `${v.name || "Flesh spell"}: +${r0(v.amt)} armour for the rest of the fight, so blows hurt less.`],
    ward: ["", "Ward", true, (v) => `Ward: soaks ${r0(v.amt)} more damage from spells${v.max ? ` (of ${r0(v.max)})` : ""}${v.reflect ? `, and throws ${pc(v.reflect)} of what it soaks back at the foe` : ""}. Cast it again to refill it.`],
    healing: ["✚", "Healing", true, (v) => `${v.name || "Healing"}: +${r0(v.amt)} health at the end of each round, ${v.n} more.`],
    cloak: ["", "Cloak", true, (v) => `${v.name || "Cloak"}: the foe takes ${r0(v.amt)} ${elName(v.el)} damage every round, ${v.n} more.`],
    rune: ["◈", "Rune", true, (v) => `${v.name || "Rune"}: ${r0(v.amt)} ${elName(v.el)} damage the moment the foe steps on it.`],
    bound: ["", "Bound weapon", true, (v) => `${v.name || "Bound weapon"}: a weapon of light doing ${r0(v.amt)} damage a blow, until the fight ends.`],
    invisible: ["", "Invisible", true, (v) => `Unseen: blows aimed at ${v.who || "you"} miss for ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    sneak: ["", "Sneak attack", true, () => "Your next blow is a sneak attack and does extra damage."],
    courage: ["", "Courage", true, (v) => `Courage: your allies hit ${r0(v.amt)}% harder this fight.`],
    summon: ["✦", "Summon", true, (v) => `${v.name || "Your summon"} fights beside you for ${v.n} more turn${v.n === 1 ? "" : "s"}, ${r0(v.amt)} damage a blow.`],
    reanimate: ["", "Reanimate", true, (v) => `${v.name || "Reanimate"}: if the foe falls (level ${r0(v.amt)} or lower), it rises to fight for you for ${v.n} fights.`],
    guard: ["", "Guard", true, (v) => `Guard up: the next blows do ${r0(v.amt)}% less.`],
    // racial powers, stones and shouts
    pw_rage: ["", "Berserker Rage", true, (v) => `Berserker Rage: you deal double damage and take half, ${v.n} more turns.`],
    pw_adren: ["", "Adrenaline Rush", true, (v) => `Adrenaline Rush: stamina floods back every turn, ${v.n} more turns.`],
    pw_high: ["", "Highborn", true, (v) => `Highborn: magicka floods back every turn, ${v.n} more turns.`],
    pw_cloak: ["", "Ancestor's Wrath", true, (v) => `Ancestor's Wrath: flames burn the foe for 8 every turn, ${v.n} more turns.`],
    pw_hist: ["", "Histskin", true, (v) => `Histskin: you heal 7% of your health every turn, ${v.n} more turns.`],
    pw_skin: ["", "Dragonskin", true, (v) => `Dragonskin: spells do half damage to you, ${v.n} more turns.`],
    pw_ether: ["", "Ethereal", true, (v) => `Ethereal: nothing can hurt you, ${v.n} more turns.`],
    pw_aspect: ["", "Dragon Aspect", true, (v) => `Dragon Aspect: you hit ${pc(v.amt)} harder and take ${pc(v.red)} less damage this fight.`],
    pw_fury: ["", "Elemental Fury", true, (v) => `Elemental Fury: your blows do ${pc(v.amt)} more, ${v.n} more turns.`],
    pw_storm: ["", "Storm Call", true, (v) => `Storm Call: lightning hits the foe for ${r0(v.amt)} every turn, ${v.n} more turns.`],
    beast: ["", "Beast Form", true, (v) => `Beast Form: claws instead of weapons, you hit much harder and take 45% less damage. No spells or potions. ${v.n} more turns.`],
    lord: ["", "Vampire Lord", true, (v) => `Vampire Lord: drain life with your magic and shrug off blows. No potions. ${v.n} more turns.`],
    poisoned_blade: ["", "Poisoned weapon", true, (v) => `${v.name || "Poison"} on your weapon: it goes into the foe on your next ${v.n} hit${v.n === 1 ? "" : "s"}.`],
    // potions, food and shrines you had before the fight
    fx_max: ["", "Fortify", true, (v) => `${v.name}: +${r0(v.amt)} maximum ${v.what}, ${v.left} left.`],
    fx_dmg: ["", "Fortify", true, (v) => `${v.name}: ${v.what} blows do ${r0(v.amt)}% more, ${v.left} left.`],
    fx_skill: ["", "Fortify", true, (v) => `${v.name}: +${r0(v.amt)} ${v.what}, ${v.left} left.`],
    fx_spell: ["", "Fortify", true, (v) => `${v.name}: ${v.what} spells are ${r0(v.amt)}% stronger, ${v.left} left.`],
    fx_regen: ["", "Regenerate", true, (v) => `${v.name}: ${v.what} comes back ${r0(v.amt)}% faster, ${v.left} left.`],
    fx_resist: ["", "Resist", true, (v) => `${v.name}: ${r0(v.amt)}% less damage of that kind, ${v.left} left.`],
    fx_other: ["", "Blessing", true, (v) => `${v.name}: +${r0(v.amt)} ${v.what}, ${v.left} left.`],
    // --- on you: what the foe (or the world) does to you
    poisoned: ["", "Poisoned", false, (v) => (v.foe ? `Poisoned: −${r0(v.amt)} health every turn.` : `Poisoned: you lose ${r0(v.amt)} health each time a foe acts. A Cure Poison potion or winning the fight ends it.`)],
    burning: ["", "Burning", false, (v) => `Burning: −${r0(v.amt)} health ${v.foe ? "each turn" : "at the end of the round"}, ${v.n} more.`],
    bleeding: ["", "Bleeding", false, (v) => `Bleeding: −${r0(v.amt)} health ${v.foe ? "each turn" : "each time a foe acts"}, ${v.n} more.`],
    chilled: ["", "Chilled", false, (v) => (v.foe ? `Chilled: slower and clumsier, it misses more. ${v.n} more turn${v.n === 1 ? "" : "s"}.` : `Chilled: your stamina doesn't come back, ${v.n} more round${v.n === 1 ? "" : "s"}.`)],
    jolted: ["", "Jolted", false, (v) => (v.foe ? `Shocked: loses magicka and takes shock damage, ${v.n} more turn${v.n === 1 ? "" : "s"}.` : `Jolted: the shock drained some magicka, ${v.n} more round${v.n === 1 ? "" : "s"}.`)],
    dazed: ["", "Winded", false, (v) => `Winded: you start your turn with ${r0(4 * (v.n || 1))}% less stamina.`],
    winded: ["", "Winded", false, (v) => `Winded: you start each turn with less stamina.`],
    drained: ["", "Drained", false, (v) => `Drained: you start each turn with less magicka.`],
    might: ["", "Might", true, (v) => `Might: your blows and spells land harder.`],
    haste: ["", "Haste", true, (v) => `Haste: you act earlier in the round.`],
    vuln: ["", "Vulnerable", false, (v) => `Vulnerable: it takes more damage from everything.`],
    sunder: ["", "Sundered", false, (v) => `Sundered armour: weapons hurt it more.`],
    weakened: ["", "Weakened", false, (v) => `Weakened: its blows land softer.`],
    resolve: ["", "Resolve", true, (v) => `Resolve: it has shaken off stuns, calm and fear before, so the next one is shorter.`],
    regen_stk: ["✚", "Regen", true, (v) => `Regen: +${r0(v.amt)} health at the end of each round.`],
    spent: ["‍", "Worn out", false, (v) => `Worn out after changing back: you hit 25% softer, ${v.n} more round${v.n === 1 ? "" : "s"}.`],
    sunlight: ["", "Sunlight", false, (v) => `The sun burns you: −${r0(v.amt)} health every round you fight outdoors by day. Feed to make it gentler.`],
    vampire: ["", "Vampirism", false, (v) => `Vampire (hunger ${v.n}/4): fire hurts you ${r0(25 * v.n)}% more, frost ${r0(Math.min(75, 25 * v.n))}% less, poison half.`],
    sanguinare: ["", "Sanguinare Vampiris", false, () => "You caught vampirism. Cure it at a shrine or with a Cure Disease potion before it takes hold."],
    // --- on the foe
    paralyzed: ["", "Paralyzed", false, () => "Paralyzed: loses its next turn, then thaws."],
    stunned: ["", "Stunned", false, () => "Stunned by your shield: loses its next turn."],
    staggered: ["", "Staggered", false, () => "Staggered: its next turn moves back 2 places."],
    slowed: ["", "Slowed", false, (v) => `Slowed: its blows do half damage and it acts later, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    calm: ["", "Won't fight", false, (v) => `Out of the fight: calmed or running scared, it does nothing for ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    fear: ["", "Afraid", false, (v) => `Afraid: it cowers instead of fighting, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    rattled: ["", "Rattled", false, (v) => `Rattled: shook off the fear but still hits 20% softer, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    shaken: ["", "Shaken", false, (v) => `Shaken by the howl: hits 20% softer, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    disarmed: ["", "Disarmed", false, (v) => `Weapon knocked aside: its blows do 40% less, ${v.n} more.`],
    disarm_shout: ["", "Disarmed", false, (v) => `Disarm: its weapon is gone, so it does ${pc(v.amt)} less damage this fight.`],
    marked: ["", "Marked for Death", false, (v) => `Marked for Death: takes ${pc(v.amt)} more damage and loses ${r0(v.dot)} health every turn.`],
    rend: ["", "Dragonrend", false, (v) => `Dragonrend: forced to the ground, takes ${pc(v.amt)} more damage.`],
    ground: ["", "Burning ground", false, (v) => `${v.name || "A wall of"} ${elName(v.el)}: ${r0(v.amt)} damage to it each turn, ${v.n} more.`],
    soultrap: ["", "Soul Trap", false, () => "Soul Trap: if it dies now, its soul fills one of your empty soul gems."],
    flying: ["", "In the air", false, () => "Flying: out of reach of most blows. Dragonrend or Unrelenting Force brings it down."],
    weak: ["", "Weak", false, (v) => v.tip],
    resist: ["", "Resists", true, (v) => v.tip],
    kit_windup: ["", "Winding up", true, (v) => v.tip],
    kit_guard: ["", "Shield raised", true, (v) => v.tip],
    kit_ward: ["", "Ward", true, (v) => v.tip],
    kit_evade: ["", "In the shadows", true, (v) => v.tip],
    kit_rage: ["", "Enraged", true, (v) => v.tip],
    // --- on allies (followers, summons, party members)
    stoneskin: ["", "Stoneskin", true, (v) => `Stoneskin: ${pc(v.amt)} less damage, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    imbue: ["", "Blessed weapon", true, (v) => `${v.name || "Blessed weapon"}: +${r0(v.amt)} ${v.el ? elName(v.el) + " " : ""}damage a turn, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    thorns: ["", "Ward of Sparks", true, (v) => `Ward of Sparks: whoever hits ${v.who || "them"} takes ${r0(v.amt)} shock damage, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    heroism: ["⚑", "Heroism", true, (v) => `Heroism: hits ${r0(v.amt)}% harder, ${v.n} more turn${v.n === 1 ? "" : "s"}.`],
    down: ["", "Knocked down", false, () => "Knocked down: out of this fight, but not dead. A Rescue spell brings them back; they get up after the fight."],
  };
  /* what each kind of spell leaves behind (the test checks every kind in the game is listed here) */
  const SPELL_KIND = {
    damage: ["burning", "chilled", "jolted", "slowed", "staggered"], heal: null, armor: ["armour"], summon: ["summon"], calm: ["calm"], event: null,
    rune: ["rune"], cloak: ["cloak"], dot: ["ground", "slowed"], ward: ["ward"], regen: ["healing"], turn: null, paralyze: ["paralyzed"], fear: ["fear", "rattled"],
    courage: ["courage"], invisibility: ["invisible", "sneak"], bound: ["bound"], soultrap: ["soultrap"], reanimate: ["reanimate"], utility: null,
    banish: ["calm", "summon"], equilibrium: null, absorb: null, custom: [],   // a crafted spell leaves whatever its parts leave
    healally: null, allyward: ["ward"], allyarmor: ["stoneskin"], allyimbue: ["imbue"], allythorns: ["thorns"], allycourage: ["heroism"], allyunseen: ["invisible"], allyrescue: null,
  };
  /* racial powers, stones and shouts: what each leaves */
  const POWER_FX = {
    nord: ["calm"], imperial: ["calm"], bosmer: ["calm"], khajiit: ["sneak"], breton: ["pw_skin"], redguard: ["pw_adren"], altmer: ["pw_high"], dunmer: ["pw_cloak"], orc: ["pw_rage"], argonian: ["pw_hist"],
    serpent: ["paralyzed"], ritual: null, shadow: ["sneak", "pw_ether"], beast: ["beast", "spent"], lord: ["lord"],
    unrelenting_force: ["paralyzed"], fire_breath: ["burning"], frost_breath: ["slowed", "chilled"], ice_form: ["paralyzed"], become_ethereal: ["pw_ether"], disarm: ["disarm_shout"],
    kynes_peace: ["calm"], dragon_aspect: ["pw_aspect"], marked_for_death: ["marked"], dragonrend: ["paralyzed", "rend"], storm_call: ["pw_storm"], elemental_fury: ["pw_fury"],
    slow_time: ["slowed"], throw_voice: ["sneak"], animal_allegiance: ["calm"], call_of_valor: null, call_dragon: null, dismay: ["calm", "rattled"], tower: null,
  };
  const item = (k, v = {}, extra = {}) => {
    const T = TYPES[k]; if (!T) return null;
    const nm = extra.nm || T[1];
    const sk = extra.stk && typeof STACKS !== "undefined" ? t(STACKS.tipFor(extra.stk, v.n)) : "";   // stacks.js: how many, what each does, drops by 1
    return { k, ic: extra.ic || T[0], nm, lbl: t(nm), buff: extra.buff ?? T[2], n: v.n > 0 && v.n < 99 ? r0(v.n) : null, left: v.left || null, tip: t(T[3](v)) + sk, id: extra.id || k, stk: !!extra.stk };
  };
  const push = (out, x) => { if (x) out.push(x); };
  const now = (f) => (f && f.t != null ? f.t : typeof G !== "undefined" && G.now ? G.now() : 0);
  const fxWhat = (key) => {
    const [a, b] = String(key).split(":");
    if (a === "max") return ["fx_max", b];
    if (a === "dmg") return ["fx_dmg", b];
    if (a === "skill") return ["fx_skill", b];
    if (a === "spell") return ["fx_spell", b];
    if (a === "regen") return ["fx_regen", b];
    if (a === "resist") return ["fx_resist", b || "elements"];
    return ["fx_other", a === "carry" ? "carry weight" : a === "barter" ? "% better prices" : a];
  };
  const leftTxt = (sec) => { const m = sec / 60; return m >= 90 ? `${Math.round(m / 60)}h` : `${Math.max(1, Math.round(m))}m`; };
  const ARMOR_NAME = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function armourName(f, sess) {
    if (!ARMOR_NAME) return "";
    const ev = sess?.ev || [];
    for (let i = ev.length - 1; i >= Math.max(0, ev.length - 40); i--) {
      const m = /(?:^|· |Scroll: )([A-Z][A-Za-z' ]+?)(?: \(dual\))?: \+\d+ armor/.exec(ev[i]?.text || "");
      if (m) { ARMOR_NAME.set(f, m[1]); break; }
    }
    return ARMOR_NAME.get(f) || "";
  }

  /* everything on you */
  function me(f, sess) {
    const out = []; if (!f) return out;
    const s = f.s || {}, p = f.pw || {};
    const k = f.kitDot;
    if (k && k.turns > 0) push(out, item(k.name === "burning" ? "burning" : k.name === "bleeding" ? "bleeding" : "poisoned", { n: k.turns, amt: k.dmg }, { id: "kit:" + k.name, stk: k.name === "bleeding" ? "bleed" : "poison" }));
    const ms = f.meSt || {};
    if (ms.burn?.turns > 0) push(out, item("burning", { n: ms.burn.turns, amt: ms.burn.dmg }, { stk: "burn" }));
    if (ms.chill?.turns > 0) push(out, item("chilled", { n: ms.chill.turns }, { stk: "chill" }));
    if (ms.shock?.turns > 0) push(out, item("jolted", { n: ms.shock.turns }, { stk: "shock" }));
    const gm = (f.stk && f.stk.me) || {};
    for (const g of ["winded", "drained", "might", "haste"]) if (gm[g] > 0) push(out, item(g, { n: gm[g] }, { stk: g }));
    if (f.bpTired > 0) push(out, item("spent", { n: f.bpTired }));
    if (f.armorSpell > 0) push(out, item("armour", { amt: f.armorSpell, name: armourName(f, sess) }, { nm: armourName(f, sess) || undefined }));
    if (f.ward > 0) push(out, item("ward", { amt: f.ward, max: f.wardMax }));
    if (f.regen?.turns > 0) push(out, item("healing", { n: f.regen.turns, amt: f.regen.amt, name: f.regen.name }, { nm: f.regen.name, stk: "regen" }));
    if (f.cloak?.turns > 0) push(out, item("cloak", { n: f.cloak.turns, amt: f.cloak.dmg, el: f.cloak.el, name: f.cloak.name }, { nm: f.cloak.name }));
    if (f.rune) push(out, item("rune", { amt: f.rune.dmg, el: f.rune.el, name: f.rune.name }, { nm: f.rune.name }));
    if (f.bound) push(out, item("bound", { amt: f.bound.dmg, name: f.bound.name }, { nm: f.bound.name ? f.bound.name[0].toUpperCase() + f.bound.name.slice(1) : undefined }));
    if (f.unseen > 0) push(out, item("invisible", { n: f.unseen }));
    if (f.sneakNext) push(out, item("sneak"));
    if (f.braveHp > 0) push(out, item("courage", { amt: f.braveHp }));
    if (f.summonTurns > 0) push(out, item("summon", { n: f.summonTurns, amt: f.summonDmg, name: f.summonName }, { nm: f.summonName }));
    if (f.reanimate) push(out, item("reanimate", { amt: f.reanimate.max, n: f.reanimate.fights, name: f.reanimate.name }, { nm: f.reanimate.name }));
    if (f.tbGuard > 0) push(out, item("guard", { amt: f.tbGuard * 100 }));
    if (p.rage > 0) push(out, item("pw_rage", { n: p.rage }));
    if (p.adren > 0) push(out, item("pw_adren", { n: p.adren }));
    if (p.high > 0) push(out, item("pw_high", { n: p.high }));
    if (p.cloak > 0) push(out, item("pw_cloak", { n: p.cloak }));
    if (p.hist > 0) push(out, item("pw_hist", { n: p.hist }));
    if (p.skin > 0) push(out, item("pw_skin", { n: p.skin }));
    if (p.ether > 0) push(out, item("pw_ether", { n: p.ether }));
    if (p.aspect > 0) push(out, item("pw_aspect", { amt: p.aspect, red: p.aspectRed }));
    if (p.fury > 0) push(out, item("pw_fury", { n: p.fury, amt: p.furyMult }));
    if (p.storm > 0) push(out, item("pw_storm", { n: p.storm, amt: p.stormDmg }));
    if (p.beast > 0) push(out, item("beast", { n: p.beast }));
    if (p.lord > 0) push(out, item("lord", { n: p.lord }));
    if (s.poison?.hits > 0) push(out, item("poisoned_blade", { n: s.poison.hits, name: s.poison.name }));
    const tm = now(f);
    for (const x of s.fx || []) {
      if (!(x.until > tm) || !x.mag) continue;
      const [ty, what] = fxWhat(x.key);
      push(out, item(ty, { amt: x.mag, name: x.name || "Blessing", what, left: leftTxt(x.until - tm) }, { nm: x.name, id: "fx:" + x.key + ":" + x.name, buff: x.mag > 0 }));
    }
    if (s.vampire) {
      const st = typeof CURSE !== "undefined" && CURSE.stage ? CURSE.stage(s, tm) : 1;
      push(out, item("vampire", { n: st }));
      const sun = typeof G !== "undefined" && G.isNight && !G.isNight(tm) && !s.dungeon && !f.e?.indoor && !f.arena;
      if (sun && typeof G.maxHealth === "function") push(out, item("sunlight", { amt: G.maxHealth(s) * 0.015 * st }));
    } else if (s.sanguinare) push(out, item("sanguinare"));
    return out;
  }
  /* everything on the foe */
  function foe(f) {
    const out = []; if (!f) return out;
    const st = f.foeSt || {}, p = f.pw || {};
    if (st.burn?.turns > 0) push(out, item("burning", { n: st.burn.turns, amt: st.burn.dmg, foe: true }, { id: "f:burn", stk: "burn" }));
    if (st.chill?.turns > 0) push(out, item("chilled", { n: st.chill.turns, foe: true }, { id: "f:chill", stk: "chill" }));
    if (st.shock?.turns > 0) push(out, item("jolted", { n: st.shock.turns, foe: true }, { id: "f:shock", nm: "Shocked", stk: "shock" }));
    if (st.poison?.turns > 0) push(out, item("poisoned", { n: st.poison.turns, amt: st.poison.dmg, foe: true }, { id: "f:poison", stk: "poison", nm: "Poisoned" }));
    const bl = (f.bleed || []).filter((b) => b.turns > 0);
    if (bl.length) push(out, item("bleeding", { n: bl.reduce((a, b) => a + b.turns, 0), amt: bl.reduce((a, b) => a + b.dmg, 0), foe: true }, { id: "f:bleed", stk: "bleed" }));
    const gf = (f.stk && f.stk.foe) || {};
    for (const [g, ty] of [["vuln", "vuln"], ["sunder", "sunder"], ["weak", "weakened"], ["resolve", "resolve"]]) if (gf[g] > 0) push(out, item(ty, { n: gf[g] }, { id: "f:" + g, stk: g }));
    if (f.eParalyzed > 0) push(out, item("paralyzed", { n: f.eParalyzed }));
    if (f.tbStunLeft > 0) push(out, item("stunned"));
    if (f.stagger) push(out, item("staggered"));
    if (f.slowed > 0) push(out, item("slowed", { n: f.slowed }));
    if (f.calmTurns > 0) push(out, item("calm", { n: f.calmTurns }));
    if (f.fearTurns > 0) push(out, item("fear", { n: f.fearTurns }));
    if (f.fcap?.rattled > 0) push(out, item("rattled", { n: f.fcap.rattled }));
    if (f.shaken > 0) push(out, item("shaken", { n: f.shaken }));
    if (f.disarmed > 0) push(out, item("disarmed", { n: f.disarmed }));
    if (p.disarm > 0) push(out, item("disarm_shout", { amt: p.disarm }));
    if (p.mark > 0) push(out, item("marked", { amt: p.mark, dot: p.markDot }));
    if (p.rend > 0 && f.tags?.has?.("dragon")) push(out, item("rend", { amt: p.rend }));
    for (const d of f.dots || []) if (d.turns > 0) push(out, item("ground", { n: d.turns, amt: d.dmg, el: d.el, name: d.name }, { nm: d.name, id: "f:dot:" + d.name }));
    if (f.soulTrap) push(out, item("soultrap"));
    if (f.dStance === "air") push(out, item("flying"));
    if (typeof FOEKIT !== "undefined" && FOEKIT.chips) for (const [c, ic, tip] of FOEKIT.chips(f)) { if (c === "dot") continue; push(out, item("kit_" + c, { tip }, { ic, id: "kit:" + c })); }
    if (typeof COMBO !== "undefined" && COMBO.chips) for (const [c, ic, tip] of COMBO.chips(f)) push(out, item(c === "weak" ? "weak" : "resist", { tip }, { ic, id: "combo:" + ic, nm: tip.split(":")[0] }));
    return out;
  }
  /* everything on a teammate (follower, summon, party member) */
  function ally(f, a, down) {
    const out = []; if (!a) return out;
    if (down || a.down) { push(out, item("down")); return out; }
    const who = a.name || "them";
    if (a.ward > 0) push(out, item("ward", { amt: a.ward, reflect: a.reflect }));
    if (a.armorT > 0) push(out, item("stoneskin", { n: a.armorT, amt: a.armorRed }));
    if (a.imbue?.turns > 0) push(out, item("imbue", { n: a.imbue.turns, amt: a.imbue.dmg, el: a.imbue.el, name: a.imbue.name }, { nm: a.imbue.name }));
    if (a.thorns?.turns > 0) push(out, item("thorns", { n: a.thorns.turns, amt: a.thorns.dmg, who }));
    if (a.heroT > 0) push(out, item("heroism", { n: a.heroT, amt: a._baseDmg ? (a.dmg / a._baseDmg - 1) * 100 : 0 }));
    if (a.unseen > 0) push(out, item("invisible", { n: a.unseen, who }));
    if (a.guard || a.tbGuard > 0) push(out, item("guard", { amt: (a.tbGuard || 0.3) * 100 }));
    return out;
  }
  const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* the icons as a row */
  function html(list, cls = "") {
    if (!list.length) return "";
    return `<div class="c2fx ${cls}">${list.map((x) => `<i class="c2e ${x.buff ? "buff" : "debuff"} fx-${x.k}" data-tip="${esc(x.tip)}" aria-label="${esc(x.lbl || x.nm)}: ${esc(x.tip)}" role="img"><span aria-hidden="true">${x.ic}</span>${x.n != null ? `<small aria-hidden="true">${x.n}</small>` : x.left ? `<small aria-hidden="true">${esc(x.left)}</small>` : ""}</i>`).join("")}</div>`;
  }
  return { TYPES, SPELL_KIND, POWER_FX, me, foe, ally, html, item, tr: t };
})();
if (typeof module !== "undefined") module.exports = FXICONS;
