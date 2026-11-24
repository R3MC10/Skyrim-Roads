/* spellfx.js: what your spells are doing right now, shown on the fight screen, and spells that hit a whole group. [OURS]
   1. Status chips. Your own buffs (flesh armour, cloak, summon, bound weapon, invisibility) sit under your bars, and what
      your spells put on the foe (calm, frenzy, fear, burning walls, a waiting rune, soul trap) sits under its bar, each
      with a tip and the turns left. The ward bar, healing circle and paralysis already had their own chips and stay.
   2. Area spells. Fireball, Chain Lightning, the storms and walls, Mass Paralysis, Hysteria, Harmony and Mayhem are
      marked "area". When foes come in a group (2 or 3, one after another), the ones waiting behind take half of an
      area spell's damage (they step in already hurt, never below half their health), and area paralysis, fear, calm
      and walls keep working on them. A single-target spell (Paralyze, Fear, a Firebolt's burn) ends with the foe it
      was cast on, so the next one starts fresh.
   Loaded after engine.js, magic.js, spellbook.js, foecap.js and tbfight.js; without it everything works as before. */
const SPELLFX = (() => {
  const AREA = ["fireball", "chain_lightning", "ice_storm", "fire_storm", "lightning_storm", "thunderclap", "stendarrs_aura",
    "wall_of_flames", "wall_of_frost", "wall_of_storms", "blizzard", "mass_paralysis", "hysteria", "harmony", "mayhem"];
  const SPLASH = 0.5, SPLASH_CAP = 0.5;   // the ones behind take half; never more than half their health before they step in
  const HOLD = ["eParalyzed", "calmTurns", "fearTurns"];
  const r0 = (x) => Math.round(x || 0);
  const EL_IC = { fire: "🔥", frost: "❄", shock: "⚡" };
  const turns = (n) => `${n} ${n === 1 ? "turn" : "turns"}`;

  if (typeof D !== "undefined") for (const id of AREA) if (D.SPELLS[id]) D.SPELLS[id].area = true;

  // ---------------------------------------------------------------- area spells: remember what reached the ones behind
  if (typeof G !== "undefined" && G.Fight) {
    const cast0 = G.Fight.prototype.cast;
    G.Fight.prototype.cast = function (id, free, dual) {
      const sp = D.SPELLS[id];
      if (!sp || !sp.area) return cast0.call(this, id, free, dual);
      const b = this.ehp, n0 = (this.dots || []).length;
      const out = cast0.call(this, id, free, dual);
      const d = b - this.ehp;
      if (d > 0) this.splashTot = (this.splashTot || 0) + d * SPLASH;
      for (const x of (this.dots || []).slice(n0)) x.area = true;
      for (const k of HOLD) if ((this[k] || 0) > 0) (this.areaHold || (this.areaHold = {}))[k] = true;
      return out;
    };
  }
  /* tbfight.js nextFoe: the foe fell, the next of the group steps in */
  function nextFoe(sess) {
    const f = sess.f, hold = f.areaHold || {};
    for (const k of HOLD) if (!hold[k]) f[k] = 0;   // single-target holds end with the foe they were cast on
    if (!hold.calmTurns) f.calmFrenzy = false;
    f.dots = (f.dots || []).filter((x) => x.area);
    f.soulTrap = false; f.foeSt = {};   // its own soul, its own burns
    f.areaHold = null;
    const hurt = Math.min(f.splashTot || 0, sess.ehpMax * SPLASH_CAP);
    if (hurt >= 1) { f.ehp -= hurt; sess.emit("me", `It already took ${r0(hurt)} from your spells`, "me"); }
    return hurt;
  }

  // ---------------------------------------------------------------- status chips
  /* your spell buffs: [{ k, ic, n, tip, shown }] (shown: the fight screen already draws it its own way) */
  function me(f) {
    const out = [];
    if (f.armorSpell > 0) out.push({ k: "armor", ic: "🪨", n: `+${r0(f.armorSpell)}`, tip: `Flesh spell: +${r0(f.armorSpell)} armour for the rest of the fight.` });
    if (f.ward > 0) out.push({ k: "ward", ic: "🔰", n: r0(f.ward), tip: "", shown: true });
    if (f.regen) out.push({ k: "regen", ic: "✚", n: r0(f.regen.amt), tip: "", shown: true });
    if (f.cloak) out.push({ k: "cloak", ic: EL_IC[f.cloak.el] || "✦", n: `×${f.cloak.turns}`, tip: `${f.cloak.name}: ${r0(f.cloak.dmg)} ${f.cloak.el} damage to the foe each round, ${turns(f.cloak.turns)} left.` });
    if (f.summonTurns > 0) out.push({ k: "summon", ic: "👻", n: `×${f.summonTurns}`, tip: `Your ${f.summonName || "summon"} fights beside you: ${r0(f.summonDmg)} damage a turn, ${turns(f.summonTurns)} left. It vanishes when the fight ends.` });
    if (f.bound) out.push({ k: "bound", ic: "⚔", n: r0(f.bound.dmg), tip: `A ${f.bound.wt === "bow" ? "bow" : f.bound.wt} of light in your hands: ${r0(f.bound.dmg)} base damage. It fades when the fight ends.` });
    if (f.unseen > 0) out.push({ k: "unseen", ic: "👁", n: `×${f.unseen}`, tip: `Unseen: the foe can't find you for ${turns(f.unseen)}. Your next blow is a sneak attack.` });
    return out;
  }
  /* what your spells are doing to the foe */
  function foe(f) {
    const out = [];
    if (f.calmTurns > 0) out.push(f.calmFrenzy
      ? { k: "calm", ic: "🌀", n: `×${f.calmTurns}`, tip: `Frenzied: it hurts itself instead of you, ${turns(f.calmTurns)} left.` }
      : { k: "calm", ic: "🕊", n: `×${f.calmTurns}`, tip: `Calmed: it isn't fighting, ${turns(f.calmTurns)} left.` });
    if (f.fearTurns > 0) out.push({ k: "fear", ic: "😱", n: `×${f.fearTurns}`, tip: `Afraid: it cowers instead of attacking, ${turns(f.fearTurns)} left.` });
    for (const x of f.dots || []) out.push({ k: "dot", ic: EL_IC[x.el] || "✦", n: `${r0(x.dmg)}×${x.turns}`, tip: `${x.name}: ${r0(x.dmg)} ${x.el} damage each round, ${turns(x.turns)} left.` });
    if (f.rune) out.push({ k: "rune", ic: "ᛝ", n: r0(f.rune.dmg), tip: `${f.rune.name}: ${r0(f.rune.dmg)} ${f.rune.el} damage when the foe moves on it.` });
    if (f.soulTrap) out.push({ k: "soul", ic: "💜", n: "", tip: "Soul Trap: if it dies, its soul fills an empty soul gem." });
    if (f.eParalyzed > 0) out.push({ k: "para", ic: "✋", n: f.eParalyzed, tip: "", shown: true });
    return out;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const chip = (x, mine) => `<i class="st spl ${mine ? "me " : ""}${x.k}" data-tip="${esc(x.tip)}">${x.ic}${x.n !== "" ? `<small>${esc(x.n)}</small>` : ""}</i>`;
  const meHTML = (f) => { const xs = me(f).filter((x) => !x.shown); return xs.length ? `<div class="tbst mine spl">${xs.map((x) => chip(x, true)).join("")}</div>` : ""; };
  const foeHTML = (f) => foe(f).filter((x) => !x.shown).map((x) => chip(x, false)).join("");

  return { AREA, SPLASH, SPLASH_CAP, nextFoe, me, foe, meHTML, foeHTML };
})();
