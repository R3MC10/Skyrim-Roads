/* Combat effects: blood, finishing moves, deaths and enchanted-weapon glows. [OURS]
   Remigiusz: "We need gore in the game too. Decapitations for last hit blows. Unique death animations. Enchanted weapons
   should have nice particle glows that are colour coded. We also need cinematic combat camera that follows blows,
   critical hits etc."
   - fightart.js draws the fight; this file decides WHAT happens (which death, what bleeds, what colour a weapon glows,
     which sound) so the rules stay small and testable in node. The camera is fightcam.js.
   - Blood can be turned off in Settings → Fights ("Blood"). With it off, nobody bleeds and nobody loses their head.
   - Things without blood don't bleed: skeletons drop bone chips, dwarven machines leak oil and sparks, spirits fade. */
const COMBATFX = (() => {
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const gore = () => (typeof GORE !== "undefined" ? GORE.full() : prefs().gore !== false && prefs().gore !== "low");   // [OURS] gore.js: beheadings and wet hits only on Full
  // what comes out when something is hit: [main colour, dark colour, kind]   kind: blood · bone · oil · ash · none
  const BLEED = {
    skeleton: ["#e8e0c8", "#b8ae94", "bone"], draugr: ["#6a5a3a", "#3a3020", "ash"], lich: ["#6a5a3a", "#3a3020", "ash"],
    sphere: ["#2a2a22", "#4a4636", "oil"], centurion: ["#2a2a22", "#4a4636", "oil"], dspider: ["#2a2a22", "#4a4636", "oil"],
    wisp: [null, null, "none"], atronach: [null, null, "none"], spider: ["#9ab03a", "#5a6a1a", "blood"],
  };
  const RED = ["#a01010", "#5a0606", "blood"];
  const bleedOf = (foeK) => BLEED[foeK] || RED;
  const EDGED = new Set(["sword", "greatsword", "axe", "battleaxe", "dagger"]);
  const BLUNT = new Set(["mace", "warhammer", "club"]);
  const HEADLESS = new Set(["wisp", "atronach", "sphere", "centurion", "dspider", "spider", "crab", "skeever", "dragon", "wolves", "mammoth", "giant"]);
  /* how the foe dies, from the killing blow:
     decap (an edged weapon on someone with a neck: always on a crit, power or sneak blow, otherwise now and then),
     ash (fire), shatter (frost), fry (lightning), launch (a blunt weapon or the Voice), fade (spirits), topple */
  function deathOf(b, foeK, opt = {}) {
    if (!b) return "topple";
    if (foeK === "wisp" || foeK === "atronach") return "fade";
    const el = b.el || (["fire", "frost", "shock"].includes(b.fx) ? b.fx : null);
    const melee = !!opt.melee, wt = b.wt || opt.wt;
    const goreOn = opt.gore ?? gore(), rnd = opt.rnd || Math.random;
    if (melee && EDGED.has(wt) && goreOn && !HEADLESS.has(foeK) && opt.person) {   // people (and the walking dead) only: a beast's head isn't on top
      if (b.crit || b.power || b.sneak || rnd() < 0.4) return "decap";
    }
    if (el === "fire" && !melee) return "ash";
    if (el === "frost" && !melee) return "shatter";
    if (el === "shock" && !melee) return "fry";
    if (b.fx === "fus" || (melee && BLUNT.has(wt) && (b.power || b.crit || rnd() < 0.5))) return "launch";
    if (b.enchant === "fire") return "ash";
    if (b.enchant === "frost") return "shatter";
    return "topple";
  }
  // an enchanted weapon's glow, colour coded by what the enchantment does
  const GLOW = {
    fire: ["#ff7a2a", "#ffb347", "#fff2c0"], frost: ["#7fd0ff", "#bfe8ff", "#ffffff"], shock: ["#9a8aff", "#c8b8ff", "#ffffff"],
    drain: ["#ff4060", "#ff9aa0"], absorb: ["#ff4060", "#ff9aa0"], paralyze: ["#9aff6a", "#e0ffb0"], fear: ["#c89aff", "#ff9ae0"],
    turn: ["#fff2a0", "#ffffff"], soul: ["#b07aff", "#ffffff"], silent: ["#d8f0ff", "#ffffff"], banish: ["#e0d0ff", "#a07aff"],
    magicka: ["#6aa8ff", "#b0d8ff"], stamina: ["#7aff8a", "#c0ffc0"], health: ["#ff6a6a", "#ffb0b0"],
  };
  function glowOf(effect) {
    if (!effect) return null;
    const k = String(effect).toLowerCase();
    if (GLOW[k]) return GLOW[k];
    for (const key of Object.keys(GLOW)) if (k.includes(key)) return GLOW[key];
    return GLOW.magicka;
  }
  /* the weapon's enchantment from the fight (engine fight object): main hand first, then off hand */
  function enchantOf(f) {
    const en = f?.weapon?.enchant || f?.off?.enchant || null;
    return en ? en.effect || en.id || "magicka" : null;
  }
  /* the camera lives in fightcam.js now ([fightcam]: one move at a time, by priority) */
  /* which sound goes with an impact (the names fall back: hit-gore → hit) */
  const WSND = { axe: "hit-axe", battleaxe: "hit-axe", mace: "hit-mace", warhammer: "hit-mace", bow: "hit-bow", crossbow: "hit-bow" };
  function soundOf(b, foeK, melee = false, goreOn = gore()) {
    if (!b) return null;
    if (b.miss) return "swing";
    if (b.blocked) return "clang";
    const el = b.el || (["fire", "frost", "shock"].includes(b.fx) ? b.fx : null);
    if (el && !melee) return "spell-" + el;
    if (b.crit || b.sneak || b.final) return "hit-crit";
    const ws = b.who === "me" ? WSND[b.wt] : null;   // [OURS] axes chop, maces thud, arrows thunk ("hit" when there's no recording)
    if (ws) return ws;
    if (goreOn && bleedOf(foeK)[2] === "blood" && b.who === "me") return "hit-gore";
    if (bleedOf(foeK)[2] === "oil") return "clang";
    return "hit";
  }
  return { gore, bleedOf, deathOf, glowOf, enchantOf, soundOf, EDGED, BLUNT, HEADLESS, GLOW };
})();
if (typeof module !== "undefined") module.exports = COMBATFX;
