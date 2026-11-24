/* Combat effects: blood, finishing moves, deaths, enchanted-weapon glows and the fight camera. [OURS]
   Remigiusz: "We need gore in the game too. Decapitations for last hit blows. Unique death animations. Enchanted weapons
   should have nice particle glows that are colour coded. We also need cinematic combat camera that follows blows,
   critical hits etc."
   - fightart.js draws the fight; this file decides WHAT happens (which death, what bleeds, what colour a weapon glows,
     where the camera looks) so the rules stay small and testable in node.
   - Blood can be turned off in Settings → Fights ("Blood"). With it off, nobody bleeds and nobody loses their head.
   - Things without blood don't bleed: skeletons drop bone chips, dwarven machines leak oil and sparks, spirits fade. */
const COMBATFX = (() => {
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const gore = () => prefs().gore !== false;
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
  /* the camera: where it looks and how close, for one moment of a beat.
     Returns [focus x 0..1 of the stage width, zoom]. It leans toward whoever is swinging, follows the blow to the target,
     punches in on criticals and heavy blows, and holds on the killing blow. */
  function camFor(b, u, o = {}) {
    const hx = o.hx ?? 0.27, fx = o.fx ?? 0.72, mid = (hx + fx) / 2;
    if (!b) return [0.5, 1];
    const me = b.who === "me", from = me ? hx : fx, to = me ? fx : hx, hitU = o.hitU ?? 0.55;
    if (b.move === "potion" || b.move === "self" || b.move === "wait" || b.move === "block") return [mid + (from - mid) * 0.35, 1.04];
    const before = u < hitU, big = b.final ? (o.boss ? 1.32 : 1.22) : b.crit || b.sneak ? 1.16 : b.power ? 1.1 : 1.05;
    if (before) return [mid + (from - mid) * 0.3, 1.03 + (big - 1) * 0.3 * (u / Math.max(0.01, hitU))];
    const after = Math.min(1, (u - hitU) / 0.25);
    return [mid + (to - mid) * (0.25 + 0.35 * after), big];
  }
  /* keep a zoomed camera from showing past the picture's edges: the pan (in px) for a focus point */
  function pan(focus, z, size, centre) {
    if (z <= 1) return 0;
    const want = -(focus - centre) * z, lo = -(size - centre) * (z - 1), hi = centre * (z - 1);
    return Math.max(lo, Math.min(hi, want));
  }
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
  return { gore, bleedOf, deathOf, glowOf, enchantOf, camFor, pan, soundOf, EDGED, BLUNT, HEADLESS, GLOW };
})();
if (typeof module !== "undefined") module.exports = COMBATFX;
