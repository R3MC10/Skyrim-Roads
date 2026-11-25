/* movefx.js: every spell, shout and fight move has its own painted effect. [OURS]
   Remigiusz: "Each spell should have its own visual effect, same for attack skills".
   - WHAT each move looks like lives in the tables below: one recipe per spell / shout / move id, built from an element
     palette and three parts that play in order: the charge in the caster's hand, the delivery (a stream, a bolt, a lob,
     a strike from the sky, a ground line, a thread to an ally...) and the impact (scorch, shatter, forks, golden motes,
     a hex shield, a rift, a mind ripple...). Each recipe also has a size and a variant, so two fire spells never look
     the same: Flames is a jet, Firebolt a comet, Fireball a lob that bursts, Incinerate a white-hot lance and a pillar.
   - HOW it is drawn is the scene at the bottom: brush stamps cached once per colour (a wisp, a dry-brush grain and a
     cloud puff), a pooled particle store and a pooled list of shapes (arcs, rings, hexes, rifts, ground marks).
     Hot cores and magic are added light; smoke, frost, chips and scorch marks are painted normally.
   - fightart.js asks MOVEFX.scene(...) for a scene per fight stage and calls step / hit / drawGround / drawFront.
     Beats it owns skip the old shared flashes. Without this file the fights look as before.
   - Phones: at most 180 particles (70 with reduced motion or Low fight quality) and 28 shapes, all allocated once. */
const MOVEFX = (() => {
  // ---------------------------------------------------------------- palettes: core (bright) → edge (dark)
  const PAL = {
    fire: ["#fff3cf", "#ffc45e", "#ff8a2c", "#c8461c", "#3a2a24"],
    hot: ["#ffffff", "#fff1c0", "#ffd27a", "#ff9a3a", "#3a2a24"],
    frost: ["#ffffff", "#dcf3ff", "#a6d8f6", "#5f9cc8", "#5a7488"],
    shock: ["#ffffff", "#e6deff", "#ab98ff", "#6a58e0", "#2a2440"],
    sun: ["#ffffff", "#fff6c0", "#ffdc68", "#e0a030", "#6a5020"],
    heal: ["#fffbe6", "#ffe58e", "#f2c24a", "#c8902a", "#5a4420"],
    ward: ["#f2fbff", "#c2e8ff", "#80c2ec", "#3f86b8", "#1e3a52"],
    earth: ["#f6ead0", "#d8bf94", "#a88a5e", "#6e5638", "#3a2c1e"],
    illu: ["#fff2ff", "#f2c4ff", "#c892ff", "#8a5ad0", "#3a2458"],
    rage: ["#fff0e8", "#ffb0a0", "#ff5a4a", "#b02a2a", "#3a1010"],
    dread: ["#e8e0f4", "#a890c8", "#6a4a98", "#3a2458", "#120c1c"],
    calm: ["#ffffff", "#e0f4ff", "#a8d8f0", "#78a8d0", "#2a4058"],
    conj: ["#f6eeff", "#cbaaff", "#9a6aff", "#5a2ea8", "#1c0e36"],
    necro: ["#ecfff2", "#a8f0c8", "#62c294", "#2e6a5a", "#0e2a22"],
    myst: ["#f4f2ff", "#cad2ff", "#8a9aff", "#4a4aa8", "#1a1a40"],
    blood: ["#ffd8d8", "#ff7070", "#c01a2a", "#6a0814", "#200206"],
    shadow: ["#d0c8de", "#7a6a90", "#3a2e4a", "#1c1424", "#0a0610"],
    voice: ["#ffffff", "#eef4fa", "#c0d0de", "#8098ac", "#3a4a58"],
    steel: ["#ffffff", "#f6f0dc", "#dccca4", "#9a8a6a", "#3a3428"],
    dust: ["#ece0c8", "#c8b89c", "#a08e74", "#6e604c", "#3a3228"],
    nature: ["#f4ffe8", "#c8f0a0", "#8ccc5a", "#4a8a3a", "#1e3a18"],
    para: ["#f4ffe8", "#d0ffb0", "#9aff6a", "#4ab03a", "#1a4010"],
    soul: ["#ffffff", "#e6d4ff", "#b07aff", "#6a3ac8", "#200c40"],
    gold: ["#ffffff", "#fff0b8", "#f0c860", "#b08830", "#4a3810"],
    oak: ["#f0e4c8", "#c8a070", "#8a6438", "#5a3e20", "#2a1c0e"],
    stone: ["#f0ece4", "#c4beb2", "#8e887c", "#5c564c", "#2a2620"],
    iron: ["#ffffff", "#d8dce2", "#9aa2ac", "#5c6470", "#22262c"],
    ebony: ["#e8fff0", "#7ab89a", "#3a5a4a", "#1a2a24", "#060c0a"],
    dragon: ["#fff6d8", "#f0d080", "#c89a40", "#7a5420", "#2a1c08"],
    oil: ["#c8c0a8", "#6a6048", "#3a3426", "#1c1a14", "#0a0806"],
    water: ["#ffffff", "#d8f4ff", "#8ad0ee", "#3a8ab8", "#103048"],
  };

  /* A recipe: { p: palette, c: charge, d: delivery, i: impact, g: ground mark, z: size, k: variant }.
     charge   flame · frost · crackle · motes · hex · swirl · ripple · flakes · wisps · smoke · rays · none
     delivery jet · mist · fizz · comet · shard · spear · arc · chain · lob · sky · meteor · vortex · storm · spray
              · pellets · snap · brand · wave · sunbeam · lance · aura · line · drop · thread · rift · pull · cone · none
     impact   scorch · blast · engulf · embers · sear · shatter · creep · impale · fork · flash · motes · pillar · hex
              · plates · chains · ripple · rift · necro · soul · cloak · sigil · columns · imbue · ring · weapon
              · shimmer · orb · glint · swap · bubbles · feathers · banish · drainin
     ground   scorch · frost · char · sigil · glyph · ring · burn · 0 */
  const R = (p, c, d, i, g = 0, z = 1, k = 0) => ({ p, c, d, i, g, z, k });
  const SPELL = {
    // ---- Destruction: fire
    flames: R("fire", "flame", "jet", "scorch", "scorch", 0.8),
    cinder_spray: R("fire", "flame", "spray", "embers", 0, 0.8, 1),
    firebolt: R("fire", "flame", "comet", "blast", "scorch", 0.9),
    fireball: R("fire", "flame", "lob", "blast", "scorch", 1.5, 1),
    incinerate: R("hot", "flame", "lance", "engulf", "scorch", 1.2),
    fire_storm: R("fire", "flame", "meteor", "blast", "char", 1.6, 2),
    searing_brand: R("fire", "flame", "brand", "sigil", "burn", 0.9),
    wall_of_flames: R("fire", "flame", "line", "columns", "char", 1.2),
    fire_rune: R("fire", "flame", "drop", "sigil", "sigil", 1),
    flame_cloak: R("fire", "flame", "none", "cloak", 0, 1),
    flame_blade: R("fire", "flame", "thread", "imbue", 0, 1),
    // ---- Destruction: frost
    frostbite: R("frost", "frost", "mist", "creep", "frost", 0.8),
    hailstones: R("frost", "frost", "pellets", "shatter", 0, 0.7, 1),
    ice_spike: R("frost", "frost", "shard", "shatter", "frost", 0.9),
    icy_spear: R("frost", "frost", "spear", "impale", "frost", 1.3),
    ice_storm: R("frost", "frost", "vortex", "shatter", "frost", 1.4, 2),
    blizzard: R("frost", "frost", "storm", "creep", "frost", 1.6, 1),
    wall_of_frost: R("frost", "frost", "line", "columns", "frost", 1.2, 1),
    frost_rune: R("frost", "frost", "drop", "sigil", "sigil", 1, 1),
    frost_cloak: R("frost", "frost", "none", "cloak", 0, 1, 1),
    frost_blade: R("frost", "frost", "thread", "imbue", 0, 1, 1),
    // ---- Destruction: shock
    sparks: R("shock", "crackle", "fizz", "flash", 0, 0.7),
    static_snap: R("shock", "crackle", "snap", "flash", 0, 0.8, 1),
    lightning_bolt: R("shock", "crackle", "arc", "fork", "scorch", 1),
    chain_lightning: R("shock", "crackle", "chain", "fork", "scorch", 1.2, 1),
    thunderbolt: R("shock", "crackle", "sky", "fork", "char", 1.4),
    thunderclap: R("shock", "crackle", "wave", "flash", "ring", 1.2, 2),
    lightning_storm: R("shock", "crackle", "storm", "fork", "char", 1.6, 2),
    wall_of_storms: R("shock", "crackle", "line", "columns", "char", 1.2, 2),
    lightning_rune: R("shock", "crackle", "drop", "sigil", "sigil", 1, 2),
    lightning_cloak: R("shock", "crackle", "none", "cloak", 0, 1, 2),
    spark_blade: R("shock", "crackle", "thread", "imbue", 0, 1, 2),
    ward_of_sparks: R("shock", "crackle", "thread", "hex", 0, 0.9, 3),
    // ---- Restoration: sun
    sun_fire: R("sun", "rays", "sunbeam", "sear", "burn", 1),
    vampires_bane: R("sun", "rays", "sunbeam", "sear", "burn", 1.4, 1),
    stendarrs_aura: R("sun", "rays", "aura", "sear", 0, 1.3),
    // ---- Restoration: healing
    healing: R("heal", "motes", "none", "motes", 0, 0.8),
    fast_healing: R("heal", "motes", "none", "motes", "ring", 1, 1),
    close_wounds: R("heal", "motes", "none", "motes", "glyph", 1.2, 2),
    grand_healing: R("heal", "motes", "none", "pillar", "ring", 1.5),
    soothing_light: R("heal", "motes", "none", "orb", 0, 0.8, 1),
    guardian_circle: R("heal", "motes", "none", "pillar", "glyph", 1.4, 1),
    healing_hands: R("heal", "motes", "thread", "motes", 0, 0.8, 3),
    heal_other: R("heal", "motes", "thread", "motes", 0, 1.1, 4),
    grand_heal_other: R("heal", "motes", "thread", "pillar", 0, 1.3, 2),
    // ---- Restoration: wards and the undead
    lesser_ward: R("ward", "hex", "none", "hex", 0, 0.8),
    steadfast_ward: R("ward", "hex", "none", "hex", 0, 1, 1),
    greater_ward: R("ward", "hex", "none", "hex", 0, 1.25, 2),
    shelter: R("ward", "hex", "thread", "hex", 0, 0.9, 1),
    turn_lesser_undead: R("sun", "rays", "aura", "flash", 0, 0.9, 1),
    turn_undead: R("sun", "rays", "aura", "flash", 0, 1.1, 2),
    repel_undead: R("sun", "rays", "aura", "banish", 0, 1.2),
    circle_of_protection: R("sun", "rays", "none", "pillar", "glyph", 1.2, 3),
    bane_of_the_undead: R("sun", "rays", "aura", "sear", "ring", 1.6, 1),
    // ---- Alteration
    oakflesh: R("oak", "flakes", "none", "plates", 0, 0.8),
    stoneflesh: R("stone", "flakes", "none", "plates", 0, 0.9, 1),
    ironflesh: R("iron", "flakes", "none", "plates", 0, 1, 2),
    ebonyflesh: R("ebony", "flakes", "none", "plates", 0, 1.1, 3),
    dragonhide: R("dragon", "flakes", "none", "plates", 0, 1.3, 4),
    stoneskin_touch: R("stone", "flakes", "thread", "plates", 0, 0.8, 1),
    ironskin_touch: R("iron", "flakes", "thread", "plates", 0, 0.9, 2),
    stone_shell: R("stone", "flakes", "none", "hex", 0, 1.1, 4),
    paralyze: R("para", "crackle", "arc", "chains", 0, 1),
    mass_paralysis: R("para", "crackle", "wave", "chains", "ring", 1.4, 1),
    candlelight: R("gold", "motes", "none", "orb", 0, 0.7),
    magelight: R("myst", "wisps", "lob", "orb", 0, 0.8, 2),
    telekinesis: R("myst", "wisps", "pull", "glint", 0, 0.9),
    transmute: R("gold", "flakes", "none", "glint", 0, 0.8, 1),
    equilibrium: R("blood", "wisps", "none", "swap", 0, 1),
    waterbreathing: R("water", "wisps", "none", "bubbles", 0, 0.8),
    featherweight: R("voice", "wisps", "none", "feathers", 0, 0.8),
    // ---- Conjuration
    conjure_familiar: R("conj", "swirl", "rift", "rift", 0, 0.8),
    flaming_familiar: R("fire", "swirl", "rift", "rift", 0, 0.8, 1),
    flame_atronach: R("fire", "swirl", "rift", "rift", "scorch", 1.1, 2),
    frost_atronach: R("frost", "swirl", "rift", "rift", "frost", 1.2, 2),
    storm_atronach: R("shock", "swirl", "rift", "rift", "char", 1.2, 2),
    dremora_lord: R("rage", "swirl", "rift", "rift", "char", 1.4, 3),
    spectral_archer: R("ward", "swirl", "rift", "rift", 0, 1, 4),
    seeker: R("dread", "swirl", "rift", "rift", 0, 1.1, 5),
    bound_dagger: R("myst", "swirl", "none", "weapon", 0, 0.6),
    bound_sword: R("myst", "swirl", "none", "weapon", 0, 0.8, 1),
    bound_battleaxe: R("myst", "swirl", "none", "weapon", 0, 1.1, 2),
    bound_bow: R("myst", "swirl", "none", "weapon", 0, 0.9, 3),
    bound_arms: R("myst", "swirl", "thread", "weapon", 0, 0.8, 4),
    raise_zombie: R("necro", "smoke", "none", "necro", "glyph", 0.8),
    reanimate_corpse: R("necro", "smoke", "none", "necro", "glyph", 0.9, 1),
    revenant: R("necro", "smoke", "none", "necro", "glyph", 1, 2),
    dread_zombie: R("necro", "smoke", "none", "necro", "glyph", 1.2, 3),
    dead_thrall: R("necro", "smoke", "none", "necro", "glyph", 1.4, 4),
    soul_trap: R("soul", "wisps", "pull", "soul", 0, 1),
    banish_daedra: R("conj", "swirl", "none", "banish", "ring", 1.2, 1),
    command_daedra: R("conj", "swirl", "none", "chains", 0, 1.2, 2),
    guardian_spirit: R("ward", "wisps", "thread", "hex", 0, 1, 5),
    // ---- Illusion
    calm: R("calm", "ripple", "wave", "ripple", 0, 0.9),
    soothing_song: R("calm", "ripple", "wave", "ripple", 0, 0.8, 1),
    pacify: R("calm", "ripple", "wave", "ripple", 0, 1.1, 2),
    harmony: R("calm", "ripple", "aura", "ripple", "ring", 1.5, 3),
    fury: R("rage", "ripple", "wave", "ripple", 0, 0.9, 4),
    frenzy: R("rage", "ripple", "wave", "ripple", 0, 1.1, 5),
    mayhem: R("rage", "ripple", "aura", "ripple", "ring", 1.5, 6),
    dread_whisper: R("dread", "smoke", "wave", "ripple", 0, 0.8, 7),
    fear: R("dread", "smoke", "wave", "ripple", 0, 1, 8),
    rout: R("dread", "smoke", "wave", "ripple", 0, 1.2, 9),
    hysteria: R("dread", "smoke", "aura", "ripple", "ring", 1.4, 10),
    courage: R("gold", "ripple", "none", "ring", 0, 0.9),
    rally: R("gold", "ripple", "none", "ring", 0, 1.2, 1),
    call_to_arms: R("gold", "ripple", "none", "ring", "glyph", 1.5, 2),
    heroism: R("gold", "ripple", "thread", "ring", 0, 1, 3),
    invisibility: R("illu", "wisps", "none", "shimmer", 0, 1),
    veil_other: R("illu", "wisps", "thread", "shimmer", 0, 0.9, 1),
    muffle: R("shadow", "wisps", "none", "shimmer", 0, 0.7, 2),
    clairvoyance: R("myst", "wisps", "none", "glint", 0, 0.7, 2),
    // ---- Mysticism
    detect_life: R("blood", "ripple", "none", "ring", 0, 0.8, 4),
    detect_dead: R("necro", "ripple", "none", "ring", 0, 0.8, 5),
    dispel: R("voice", "wisps", "none", "flash", 0, 0.8, 3),
    mark: R("myst", "wisps", "none", "sigil", "sigil", 0.7, 3),
    recall: R("myst", "swirl", "none", "rift", 0, 0.8, 6),
    divine_intervention: R("gold", "rays", "none", "pillar", "ring", 1.2, 4),
    spell_absorb: R("myst", "hex", "none", "hex", 0, 1, 3),
    reflect_spell: R("voice", "hex", "none", "hex", 0, 1.1, 5),
    mystic_bulwark: R("conj", "hex", "none", "hex", 0, 1.5, 6),
    soul_shield: R("soul", "hex", "thread", "hex", 0, 0.9, 7),
    rescue: R("myst", "wisps", "thread", "glint", 0, 1, 3),
    absorb_magicka: R("myst", "wisps", "pull", "drainin", 0, 1),
    soul_rend: R("soul", "wisps", "lance", "drainin", 0, 1.2, 1),
  };

  // ---------------------------------------------------------------- which recipe a beat plays
  const spells = () => (typeof D !== "undefined" && D.SPELLS) || {};
  /* the spell a crafted/custom spell looks like (deliberately shared: its first damage part, else its first part) */
  function baseSpell(id) {
    const sp = spells()[id];
    if (sp && sp.kind === "custom") { const parts = sp.parts || []; return parts.find((p) => spells()[p]?.kind === "damage") || parts[0] || null; }
    return id;
  }
  /* the effect key for a beat: "spell:firebolt", "dual:fireball"; null for anything this file doesn't draw.
     line = the fight log line (line.a says what was done) */
  function keyOf(b, line) {
    if (!b || b.who !== "me" || b.allyOnly) return null;
    const [k, arg0] = String(line?.a || "").split(":"), arg = arg0 || "";
    if (k === "spell" || k === "dual" || k === "scroll") {
      let id = k === "scroll" ? (typeof D !== "undefined" && D.ITEMS?.[arg]?.spell) || arg : arg;
      id = baseSpell(id);
      if (!SPELL[id]) return null;
      return (k === "dual" || b.dual ? "dual:" : "spell:") + id;
    }
    if (b.move === "staff" && line?.a !== "power_attack") return null;   // staffs keep their own bolt for now
    return null;
  }
  /* the recipe for a key: dual casting is the same spell, bigger, from both hands */
  function recipe(key) {
    if (!key) return null;
    const i = key.indexOf(":"), k = key.slice(0, i), id = key.slice(i + 1);
    if (k === "spell") return SPELL[id] || null;
    if (k === "dual") { const r = SPELL[id]; return r ? { ...r, z: r.z * 1.35, dual: 1 } : null; }
    return null;
  }
  /* every key this file knows (tests: each one its own effect) */
  function keys() { const out = []; for (const id of Object.keys(SPELL)) out.push("spell:" + id, "dual:" + id); return out; }
  const sig = (r) => [r.p, r.c, r.d, r.i, r.g, r.z.toFixed(2), r.k, r.dual ? 1 : 0].join("|");

  // ---------------------------------------------------------------- the scene: particles, shapes, ground marks
  const DOM = typeof document !== "undefined";
  const TAU = Math.PI * 2, rnd = Math.random, lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  /* brush stamps, painted once per colour: 0 wisp (a soft stroke with a ragged edge), 1 grain (dry brush), 2 puff (cloud) */
  const STAMPS = new Map();
  function stamp(kind, col) {
    const key = kind + col; let c = STAMPS.get(key);
    if (c || !DOM) return c || null;
    if (STAMPS.size > 160) STAMPS.clear();
    c = document.createElement("canvas"); c.width = c.height = 48; const x = c.getContext("2d");
    let seed = 7 + kind * 13; const r01 = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (kind === 0) {   // wisp: overlapping soft blobs along a short tapered stroke
      for (let i = 0; i < 9; i++) { const t = i / 8, px = 8 + t * 32, py = 24 + Math.sin(t * 3) * 3, rr = 4 + 9 * Math.sin(t * Math.PI);
        const gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, col); gr.addColorStop(0.6, col + "80"); gr.addColorStop(1, col + "00"); x.fillStyle = gr; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill(); }
    } else if (kind === 1) {   // grain: a soft core and scattered flecks
      const gr = x.createRadialGradient(24, 24, 0, 24, 24, 20); gr.addColorStop(0, col + "c0"); gr.addColorStop(1, col + "00"); x.fillStyle = gr; x.fillRect(0, 0, 48, 48);
      x.fillStyle = col; for (let i = 0; i < 40; i++) { const a = r01() * TAU, d = Math.pow(r01(), 0.7) * 20; x.globalAlpha = 0.4 + r01() * 0.6; x.beginPath(); x.arc(24 + Math.cos(a) * d, 24 + Math.sin(a) * d, 0.6 + r01() * 1.6, 0, TAU); x.fill(); }
    } else {   // puff: a lumpy cloud with a soft edge
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, px = 24 + Math.cos(a) * 8 * r01(), py = 24 + Math.sin(a) * 8 * r01(), rr = 9 + r01() * 8;
        const gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, col + "b0"); gr.addColorStop(0.55, col + "60"); gr.addColorStop(1, col + "00"); x.fillStyle = gr; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill(); }
    }
    STAMPS.set(key, c); return c;
  }

  // particle kinds
  const GLOW = 0, EMBER = 1, SPARK = 2, CRYSTAL = 3, PUFF = 4, CHIP = 5, MOTE = 6, WISP = 7, GRAIN = 8;
  const ADD = [true, true, true, false, false, false, true, true, true];

  function scene(o) {
    const s = o.s || 1, W = o.W || 520, H = o.H || 240, gy = o.groundY ?? H * 0.8;
    const lite = !!(o.reduce || o.low), NP = lite ? 70 : 180, pmul = lite ? 0.4 : 1;
    // ---- particles (one store, allocated once)
    const px = new Float32Array(NP), py = new Float32Array(NP), vx = new Float32Array(NP), vy = new Float32Array(NP), life = new Float32Array(NP), max = new Float32Array(NP),
      sz = new Float32Array(NP), grav = new Float32Array(NP), rot = new Float32Array(NP), vr = new Float32Array(NP), drag = new Float32Array(NP), kind = new Uint8Array(NP), col = new Array(NP).fill("#fff");
    let pcur = 0, alive = 0;
    function P(k, c, x, y, svx, svy, l, size, g = 0, dr = 0.985) {
      if (!isFinite(x) || !isFinite(y)) return;
      let i = pcur, n = 0; while (life[i] > 0 && n < NP) { i = (i + 1) % NP; n++; }   // a full store overwrites the oldest slot
      pcur = (i + 1) % NP;
      px[i] = x; py[i] = y; vx[i] = svx; vy[i] = svy; life[i] = max[i] = l; sz[i] = size; grav[i] = g; kind[i] = k; col[i] = c; rot[i] = rnd() * TAU; vr[i] = (rnd() - 0.5) * 8; drag[i] = dr;
    }
    const pick = (pal, a = 0, b = 3) => pal[a + ((rnd() * (b - a + 1)) | 0)];
    function spray(k, pal, x, y, n, speed, l, size, g = 0, ang = null, spread = TAU, a = 0, b = 3) {
      n = Math.max(1, Math.round(n * pmul));
      for (let i = 0; i < n; i++) { const an = ang == null ? rnd() * TAU : ang + (rnd() - 0.5) * spread, v = speed * (0.35 + rnd() * 0.65);
        P(k, pick(pal, a, b), x, y, Math.cos(an) * v * s, Math.sin(an) * v * s, l * (0.6 + rnd() * 0.6), size * (0.6 + rnd() * 0.8), g); }
    }
    // ---- shapes (one list, allocated once): what isn't a particle
    const NS = 28, SH = Array.from({ length: NS }, () => ({ on: false }));
    function S(type, o2) {
      let sh = SH.find((q) => !q.on); if (!sh) { sh = SH.reduce((a, q) => (q.t / q.life > a.t / a.life ? q : a)); }
      for (const k in sh) delete sh[k];
      Object.assign(sh, { on: true, type, t: 0, life: 1, seed: (rnd() * 1e6) | 0, ground: false }, o2); return sh;
    }
    // ---- ground marks (stay for the whole fight, at most 6)
    const MARKS = [];
    function mark(type, x, w, pal, k = 0) { if (MARKS.length >= 6) MARKS.shift(); MARKS.push({ type, x, w, pal, k, a: 0, seed: (rnd() * 1e6) | 0 }); }

    // ---- the beat being played
    let cur = null;   // { key, r, pal, b, m, u, G, launched, hitDone }
    function begin(b, line, m) {
      const key = keyOf(b, line), r = recipe(key);
      cur = r ? { key, r, pal: PAL[r.p] || PAL.fire, b, m, u: 0, launched: false, hits: 0, last: -1 } : null;
      return cur;
    }
    /* one step of a beat. G: positions this frame { hand, hand2, from, to, ally, gy }. Returns true when this file draws the beat */
    function step(dt, b, line, m, u, G) {
      if (!cur || cur.b !== b) begin(b, line, m);
      tick(dt);
      if (!cur) return false;
      cur.u = u; cur.G = G; cur.dt = dt;
      const r = cur.r, pal = cur.pal, z = r.z, ch = m.charge || [0.08, Math.max(0.1, (m.hits?.[0] ?? 0.5) - 0.12)];
      if (u > ch[0] && u < ch[1]) charge(r, pal, z, G, (u - ch[0]) / (ch[1] - ch[0]), dt);
      const pw = m.proj ? [m.proj[0], m.proj[1]] : [Math.max(0, (m.hits?.[0] ?? 0.5) - 0.12), m.hits?.[0] ?? 0.5];
      if (!cur.launched && u >= pw[0]) { cur.launched = true; launch(r, pal, z, G, pw); }
      if (u >= pw[0] && u <= pw[1] + 0.02) fly(r, pal, z, G, clamp((u - pw[0]) / Math.max(0.01, pw[1] - pw[0]), 0, 1), dt);
      return true;
    }
    const owns = (b) => !!cur && cur.b === b;

    // ---------------------------------------------------------------- 1. the charge in the hand(s)
    function charge(r, pal, z, G, p, dt) {
      const hands = r.dual ? [G.hand, G.hand2 || G.hand] : [G.hand], q = dt * 60 * pmul;
      for (const [hx, hy] of hands) {
        const R0 = (6 + 6 * p) * s * Math.min(1.3, z);
        switch (r.c) {
          case "flame": if (rnd() < 0.8 * q) P(EMBER, pick(pal, 0, 3), hx + (rnd() - 0.5) * R0, hy + (rnd() - 0.5) * R0 * 0.6, (rnd() - 0.5) * 10 * s, -(30 + rnd() * 40) * s, 0.45, 2.2 * z, -30); if (rnd() < 0.15 * q) P(PUFF, pal[4], hx, hy - 4 * s, 0, -18 * s, 0.8, 5, -6); break;
          case "frost": if (rnd() < 0.6 * q) { const a = rnd() * TAU; P(CRYSTAL, pick(pal, 0, 2), hx + Math.cos(a) * R0 * 1.4, hy + Math.sin(a) * R0, -Math.cos(a) * 26 * s, -Math.sin(a) * 26 * s, 0.4, 2.2 * z, 0, 0.92); } if (rnd() < 0.2 * q) P(PUFF, pal[1], hx, hy, 0, -6 * s, 0.9, 5, 0); break;
          case "crackle": if (rnd() < 0.35 * q) S("zap", { x: hx, y: hy, r: R0 * 1.6, life: 0.09, pal }); if (rnd() < 0.4 * q) P(SPARK, pick(pal, 0, 2), hx, hy, (rnd() - 0.5) * 160 * s, (rnd() - 0.5) * 160 * s, 0.15, 1.6); break;
          case "motes": if (rnd() < 0.7 * q) P(MOTE, pick(pal, 0, 3), hx + (rnd() - 0.5) * R0 * 2, hy + R0, (rnd() - 0.5) * 8 * s, -(24 + rnd() * 20) * s, 0.8, 2 * z, -6); break;
          case "hex": if (rnd() < 0.25 * q) S("hexdot", { x: hx + (rnd() - 0.5) * R0 * 2, y: hy + (rnd() - 0.5) * R0 * 2, r: (2.5 + rnd() * 2) * s, life: 0.35, pal }); break;
          case "swirl": if (rnd() < 0.8 * q) { const a = rnd() * TAU, d = R0 * 1.8; P(GLOW, pick(pal, 1, 3), hx + Math.cos(a) * d, hy + Math.sin(a) * d * 0.7, (-Math.sin(a) * 60 - Math.cos(a) * 40) * s, (Math.cos(a) * 42 - Math.sin(a) * 28) * s, 0.4, 2, 0, 0.9); } break;
          case "ripple": if (rnd() < 0.12 * q) S("ring", { x: hx, y: hy, r0: 2 * s, r1: R0 * 2.2, life: 0.5, pal, flat: 1, w: 1.4 }); break;
          case "flakes": if (rnd() < 0.6 * q) { const a = rnd() * TAU, d = R0 * 2.4; P(CHIP, pick(pal, 1, 3), hx + Math.cos(a) * d, hy + Math.sin(a) * d, -Math.cos(a) * d * 3, -Math.sin(a) * d * 3, 0.32, 2.2 * z, 0, 0.9); } break;
          case "wisps": if (rnd() < 0.6 * q) P(WISP, pick(pal, 1, 3), hx + (rnd() - 0.5) * R0, hy + (rnd() - 0.5) * R0, (rnd() - 0.5) * 30 * s, -(10 + rnd() * 20) * s, 0.6, 3.2 * z, 0, 0.95); break;
          case "smoke": if (rnd() < 0.5 * q) P(PUFF, pick(pal, 2, 4), hx + (rnd() - 0.5) * R0, hy, (rnd() - 0.5) * 10 * s, -14 * s, 0.9, 4 * z, -4); if (rnd() < 0.3 * q) P(GLOW, pal[1], hx, hy, (rnd() - 0.5) * 20 * s, -20 * s, 0.4, 1.6); break;
          case "rays": if (rnd() < 0.15 * q) S("rays", { x: hx, y: hy, r: R0 * 2.4, life: 0.3, pal, n: 6 }); if (rnd() < 0.5 * q) P(MOTE, pick(pal, 0, 2), hx, hy, (rnd() - 0.5) * 40 * s, (rnd() - 0.5) * 40 * s, 0.4, 1.8); break;
        }
      }
    }

    // ---------------------------------------------------------------- 2. the delivery
    function launch(r, pal, z, G, pw) {
      const [hx, hy] = G.hand, [tx, ty] = G.to, gyy = G.gy ?? gy, mul = cur.b.miss ? 0 : 1;
      switch (r.d) {
        case "arc": S("bolt", { x: hx, y: hy, x2: tx, y2: ty, life: 0.32, pal, w: 3.2 * z, forks: 1, jag: 16 }); if (r.dual) S("bolt", { x: G.hand2[0], y: G.hand2[1], x2: tx, y2: ty - 6 * s, life: 0.32, pal, w: 2.4 * z, forks: 0, jag: 16 }); break;
        case "chain": S("bolt", { x: hx, y: hy, x2: tx, y2: ty, life: 0.45, pal, w: 3 * z, forks: 2, jag: 18 });
          S("bolt", { x: tx, y: ty, x2: tx + 46 * s, y2: gyy - 2 * s, life: 0.4, pal, w: 2 * z, forks: 0, jag: 12, delay: 0.12 });
          S("bolt", { x: tx, y: ty, x2: tx + 30 * s, y2: ty - 40 * s, life: 0.4, pal, w: 1.8 * z, forks: 0, jag: 12, delay: 0.2 }); break;
        case "sky": S("bolt", { x: tx + (rnd() - 0.5) * 20 * s, y: -10, x2: tx, y2: gyy, life: 0.38, pal, w: 6 * z, forks: 3, jag: 26, delay: 0.05 }); S("glowcol", { x: tx, y: 0, y2: gyy, w: 30 * s * z, life: 0.4, pal }); break;
        case "storm": S("beam", { x: hx, y: hy, x2: tx, y2: ty, life: 0.55, pal, w: 9 * z, wob: r.p === "shock" ? 1 : 0, kind: r.p === "frost" ? "snow" : "storm" }); break;
        case "lance": S("beam", { x: hx, y: hy, x2: tx, y2: ty, life: 0.4, pal, w: 6 * z, kind: r.p === "soul" ? "tear" : "lance" }); break;
        case "sunbeam": S("sunbeam", { x: tx, y2: gyy, w: 22 * s * z, life: 0.65, pal, cross: r.k }); break;
        case "aura": case "wave": S("ring", { x: G.from[0], y: r.d === "aura" ? G.from[1] : gyy - 2 * s, r0: 6 * s, r1: (r.d === "aura" ? 120 : Math.abs(tx - G.from[0]) + 30 * s) * Math.min(1.2, z), life: 0.55, pal, flat: r.d === "wave" ? 0.25 : 0.9, w: 3 * z, wavy: r.i === "ripple" ? 1 : 0 }); break;
        case "line": S("line", { x: tx, y: gyy, w: 70 * s * z, life: 0.9, pal, k: r.k }); break;
        case "drop": S("sigil", { x: tx, y: gyy, r: 22 * s * z, life: 0.8, pal, k: r.k, grow: 1 }); break;
        case "thread": S("thread", { x: hx, y: hy, x2: G.ally[0], y2: G.ally[1], life: 0.7, pal, w: 2.2 * z }); break;
        case "rift": S("rift", { x: G.from[0] + 46 * s, y: gyy, h: 60 * s * z, life: 0.95, pal, k: r.k }); break;
        case "pull": S("thread", { x: tx, y: ty, x2: hx, y2: hy, life: 0.6, pal, w: 2 * z, back: 1 }); break;
        case "meteor": for (let i = 0; i < 3; i++) S("meteor", { x: tx + (i - 1) * 26 * s + 60 * s, y: -20, x2: tx + (i - 1) * 22 * s, y2: gyy - 6 * s, life: 0.36, delay: i * 0.1, pal, w: 7 * z }); break;
        case "vortex": S("vortex", { x: hx, y: hy, x2: tx, y2: gyy, h: 80 * s * z, life: 0.75, pal }); break;
      }
      void mul;
    }
    /* things in flight, p = 0 … 1 from the hand to the target */
    function fly(r, pal, z, G, p, dt) {
      const [hx, hy] = G.hand, [tx, ty] = G.to, q = dt * 60 * pmul, miss = cur.b.miss;
      const X = lerp(hx, tx, p), Y = lerp(hy, ty, p) - (miss && p > 0.7 ? (p - 0.7) * 80 * s : 0), dir = Math.sign(tx - hx) || 1;
      cur.proj = null;
      switch (r.d) {
        case "jet": {   // a cone of flame tongues streaming out of the palm
          const reach = lerp(0.25, 1, Math.min(1, p * 2.2));
          for (let i = 0; i < 3; i++) if (rnd() < q) { const a = Math.atan2(ty - hy, tx - hx) + (rnd() - 0.5) * 0.35, v = (260 + rnd() * 120) * reach;
            P(EMBER, pick(pal, 0, 3), hx, hy, Math.cos(a) * v * s, Math.sin(a) * v * s, 0.38 + rnd() * 0.15, 3.4 * z, -40, 0.97); }
          if (rnd() < 0.4 * q) P(PUFF, pal[4], X, Y - 6 * s, dir * 30 * s, -26 * s, 0.9, 6 * z, -8);
          cur.proj = { k: "jet", x: hx, y: hy, x2: lerp(hx, tx, reach), y2: lerp(hy, ty, reach) }; break;
        }
        case "mist": {   // frost breath: a pale cold plume with crystals in it
          for (let i = 0; i < 2; i++) if (rnd() < q) { const a = Math.atan2(ty - hy, tx - hx) + (rnd() - 0.5) * 0.45, v = 180 + rnd() * 90;
            P(PUFF, pick(pal, 1, 2), hx, hy, Math.cos(a) * v * s, Math.sin(a) * v * s, 0.55, 6 * z, 0, 0.95); }
          if (rnd() < 0.8 * q) P(CRYSTAL, pick(pal, 0, 2), hx, hy, dir * (200 + rnd() * 100) * s, (rnd() - 0.5) * 60 * s, 0.5, 2 * z, 40); break;
        }
        case "fizz": {   // sparks: many short crackling arcs reaching out
          if (rnd() < 0.5 * q) { const d = (40 + rnd() * 50) * s * Math.min(1, p * 2 + 0.3), a = Math.atan2(ty - hy, tx - hx) + (rnd() - 0.5) * 0.6; S("bolt", { x: hx, y: hy, x2: hx + Math.cos(a) * Math.min(d, Math.abs(tx - hx)), y2: hy + Math.sin(a) * d, life: 0.08, pal, w: 1.6 * z, forks: 0, jag: 6 }); }
          if (p > 0.6 && rnd() < 0.5 * q) S("bolt", { x: hx, y: hy, x2: tx, y2: ty + (rnd() - 0.5) * 14 * s, life: 0.07, pal, w: 1.8 * z, forks: 0, jag: 12 }); break;
        }
        case "snap": if (p > 0.5 && !cur.snapped) { cur.snapped = true; S("bolt", { x: hx, y: hy, x2: tx, y2: ty, life: 0.12, pal, w: 2.2 * z, forks: 0, jag: 6 }); } break;
        case "comet": cur.proj = { k: "comet", x: X, y: Y }; if (rnd() < 1.2 * q) P(EMBER, pick(pal, 0, 3), X, Y, -dir * (40 + rnd() * 40) * s, (rnd() - 0.5) * 30 * s, 0.35, 3 * z, -60); if (rnd() < 0.35 * q) P(PUFF, pal[4], X, Y, -dir * 20 * s, -10 * s, 0.7, 5, -6); break;
        case "lob": {   // fireball / magelight: a slow ball on an arc
          const Yl = lerp(hy, ty, p) - Math.sin(p * Math.PI) * 26 * s; cur.proj = { k: "orb", x: X, y: Yl };
          if (rnd() < 1.3 * q) P(r.p === "fire" ? EMBER : GLOW, pick(pal, 0, 3), X + (rnd() - 0.5) * 8 * s, Yl + (rnd() - 0.5) * 8 * s, -dir * 30 * s, -20 * s, 0.5, 3.4 * z, r.p === "fire" ? -50 : 0);
          if (r.p === "fire" && rnd() < 0.4 * q) P(PUFF, pal[4], X, Yl, -dir * 16 * s, -12 * s, 0.9, 7, -6); break;
        }
        case "shard": cur.proj = { k: "shard", x: X, y: Y, len: 18 }; if (rnd() < 0.7 * q) P(CRYSTAL, pick(pal, 0, 2), X, Y, -dir * 30 * s, (rnd() - 0.5) * 20 * s, 0.35, 1.6, 60); if (rnd() < 0.3 * q) P(PUFF, pal[1], X, Y, 0, 0, 0.6, 4); break;
        case "spear": cur.proj = { k: "shard", x: X, y: Y, len: 34 }; if (rnd() < 0.9 * q) P(CRYSTAL, pick(pal, 0, 3), X - dir * 20 * s, Y, -dir * 40 * s, (rnd() - 0.5) * 30 * s, 0.45, 2.2, 60); if (rnd() < 0.5 * q) P(PUFF, pal[1], X - dir * 14 * s, Y, 0, -4 * s, 0.8, 6); break;
        case "spray": for (let i = 0; i < 2; i++) if (rnd() < q) { const a = Math.atan2(ty - hy, tx - hx) + (rnd() - 0.5) * 0.7, v = 240 + rnd() * 120; P(rnd() < 0.5 ? CHIP : EMBER, pick(pal, 1, 4), hx, hy, Math.cos(a) * v * s, Math.sin(a) * v * s, 0.45, 2.2 * z, 120, 0.98); } break;
        case "pellets": if (rnd() < 0.5 * q && p < 0.8) { const a = Math.atan2(ty - hy, tx - hx) - 0.25 + (rnd() - 0.5) * 0.3, v = 300 + rnd() * 80; P(CRYSTAL, pick(pal, 0, 2), hx, hy, Math.cos(a) * v * s, Math.sin(a) * v * s, 0.42, 3 * z, 320, 0.995); } break;
        case "brand": cur.proj = { k: "brand", x: X, y: Y }; if (rnd() < 0.8 * q) P(EMBER, pick(pal, 0, 2), X, Y, -dir * 30 * s, -10 * s, 0.3, 2.2, -40); break;
        case "storm": if (r.p === "frost" && rnd() < 2 * q) P(CRYSTAL, pick(pal, 0, 2), tx + (rnd() - 0.2) * 70 * s, ty - 90 * s, -dir * 120 * s, 160 * s, 0.6, 2.2, 0, 1); if (r.p === "frost" && rnd() < 0.6 * q) P(PUFF, pal[1], tx + (rnd() - 0.5) * 60 * s, ty - 30 * s, -dir * 80 * s, 40 * s, 0.8, 9); if (r.p === "shock" && rnd() < 0.4 * q) S("bolt", { x: lerp(hx, tx, rnd()), y: lerp(hy, ty, 0.5) - 6 * s, x2: tx, y2: ty + (rnd() - 0.5) * 20 * s, life: 0.08, pal, w: 1.6, forks: 0, jag: 10 }); break;
        case "vortex": if (rnd() < 1.4 * q) { const cx = lerp(hx, tx, p), a = rnd() * TAU, rr = (10 + rnd() * 18) * s; P(CRYSTAL, pick(pal, 0, 2), cx + Math.cos(a) * rr, gy - rnd() * 80 * s, -Math.sin(a) * 140 * s, -30 * s, 0.4, 2.4, 0); } break;
        case "rift": if (rnd() < 0.6 * q) P(GLOW, pick(pal, 0, 2), G.from[0] + 46 * s + (rnd() - 0.5) * 16 * s, gy - rnd() * 50 * s, (rnd() - 0.5) * 30 * s, -30 * s, 0.6, 2.6, 0); break;
        case "pull": if (rnd() < q) P(r.p === "soul" ? WISP : GLOW, pick(pal, 0, 3), tx, ty, (hx - tx) * 1.6, (hy - ty) * 1.6 - 30 * s, 0.6, 3, 0, 1); break;
        case "thread": if (rnd() < 0.8 * q) P(MOTE, pick(pal, 0, 2), lerp(hx, G.ally[0], rnd()), lerp(hy, G.ally[1], rnd()), 0, -20 * s, 0.6, 2, -4); break;
      }
    }

    // ---------------------------------------------------------------- 3. the impact (fightart calls this on the hit frame)
    function hit(b, last) {
      if (!owns(b)) return false;
      const r = cur.r, pal = cur.pal, z = r.z, G = cur.G; if (!G) return true;
      const [tx, ty] = G.to, [fx, fy] = G.from, gyy = G.gy ?? gy, dir = Math.sign(tx - fx) || 1, miss = b.miss;
      if (!last) return true;
      if (miss && !["none", "thread", "rift"].includes(r.d) && !["hex", "plates", "motes", "pillar", "orb", "cloak", "weapon", "shimmer", "ring", "glint", "swap", "bubbles", "feathers", "rift", "necro"].includes(r.i)) {
        spray(PUFF, pal, tx + dir * 20 * s, ty, 4, 40, 0.6, 5, 0, null, TAU, 2, 4); return true;   // it fizzles past
      }
      const self = r.d === "none" || r.d === "rift", at = r.d === "thread" ? G.ally : self ? [fx, fy] : [tx, ty];
      const [ax, ay] = at;
      switch (r.i) {
        case "scorch": spray(EMBER, pal, ax, ay, 18 * z, 140, 0.6, 3.4, -40); spray(PUFF, pal, ax, ay, 5, 30, 1.2, 7, -10, null, TAU, 3, 4); break;
        case "blast": S("burst", { x: ax, y: ay, r: 40 * s * z, life: 0.45, pal }); spray(EMBER, pal, ax, ay, 26 * z, 230, 0.7, 4, 60); spray(PUFF, pal, ax, ay, 8 * z, 60, 1.4, 9, -14, null, TAU, 3, 4);
          if (z > 1.2) S("ring", { x: ax, y: gyy, r0: 8 * s, r1: 80 * s * z, life: 0.5, pal, flat: 0.22, w: 4 }); break;
        case "engulf": S("pillar", { x: ax, y: gyy, w: 26 * s * z, h: 90 * s * z, life: 0.9, pal, k: 1 }); spray(EMBER, pal, ax, ay, 26, 120, 0.9, 4, -90, -Math.PI / 2, 1.2); spray(PUFF, pal, ax, ay - 30 * s, 6, 30, 1.5, 10, -12, -Math.PI / 2, 1, 3, 4); break;
        case "embers": spray(EMBER, pal, ax, ay, 22 * z, 160, 0.9, 2.4, 90); spray(CHIP, pal, ax, ay, 8, 120, 0.7, 2, 260, null, TAU, 3, 4); break;
        case "sear": spray(MOTE, pal, ax, ay, 18 * z, 80, 0.9, 3, -50, -Math.PI / 2, 2); S("flash", { x: ax, y: ay, r: 50 * s * z, life: 0.3, pal }); spray(PUFF, PAL.shadow, ax, ay, 4, 20, 1, 6, -14, null, TAU, 1, 2); break;
        case "shatter": spray(CRYSTAL, pal, ax, ay, 20 * z, 230, 0.8, 3.2, 360); spray(PUFF, pal, ax, ay, 6, 40, 1.1, 8, 0, null, TAU, 1, 2); S("star", { x: ax, y: ay, r: 26 * s * z, life: 0.25, pal }); break;
        case "creep": S("ice", { x: ax, y: ay, r: 26 * s * z, life: 1.4, pal }); spray(CRYSTAL, pal, ax, ay, 10 * z, 110, 0.8, 2.4, 160); break;
        case "impale": S("ice", { x: ax, y: ay, r: 34 * s * z, life: 1.6, pal, spike: 1 }); spray(CRYSTAL, pal, ax, ay, 26, 260, 0.9, 3.4, 380); S("star", { x: ax, y: ay, r: 36 * s, life: 0.3, pal }); break;
        case "fork": for (let i = 0; i < Math.round(3 * z); i++) { const a = rnd() * TAU, d = (26 + rnd() * 26) * s * z; S("bolt", { x: ax, y: ay, x2: ax + Math.cos(a) * d, y2: ay + Math.sin(a) * d, life: 0.18 + rnd() * 0.12, pal, w: 1.8, forks: 0, jag: 8 }); }
          S("flash", { x: ax, y: ay, r: 60 * s * z, life: 0.22, pal }); spray(SPARK, pal, ax, ay, 14 * z, 280, 0.3, 1.8, 0, null, TAU, 0, 2); break;
        case "flash": S("flash", { x: ax, y: ay, r: (r.d === "wave" ? 50 : 36) * s * z, life: 0.2, pal }); spray(SPARK, pal, ax, ay, 12 * z, 240, 0.3, 1.6, 0, null, TAU, 0, 2); break;
        case "motes": spray(MOTE, pal, ax, gyy - 4 * s, 22 * z, 50, 1.3, 3, -60, -Math.PI / 2, 1.6, 0, 3); S("ring", { x: ax, y: gyy, r0: 4 * s, r1: 34 * s * z, life: 0.7, pal, flat: 0.25, w: 2.4 }); if (r.k === 2) S("glyph", { x: ax, y: gyy - 30 * s, r: 14 * s, life: 0.8, pal, k: 2 }); break;
        case "pillar": S("pillar", { x: ax, y: gyy, w: 24 * s * z, h: 110 * s, life: 1, pal, k: 0 }); spray(MOTE, pal, ax, gyy, 26 * z, 60, 1.5, 3.2, -70, -Math.PI / 2, 1.2, 0, 3); break;
        case "orb": S("orb", { x: ax + (r.d === "lob" ? 0 : 0), y: (r.d === "lob" ? ay : ay - 46 * s), r: 7 * s * z, life: 1.6, pal }); spray(MOTE, pal, ax, ay - 40 * s, 10, 40, 1, 2.4, 0, null, TAU, 0, 2); break;
        case "hex": S("hex", { x: ax + 20 * s * (r.d === "thread" ? 0.4 : 1), y: ay, r: 34 * s * z, life: 1.1, pal, k: r.k }); spray(GLOW, pal, ax + 20 * s, ay, 10, 60, 0.6, 2.4, 0, null, TAU, 0, 2); break;
        case "plates": S("plates", { x: ax, y: ay, r: 22 * s * z, life: 1, pal, k: r.k }); spray(CHIP, pal, ax, ay, 8 * z, 90, 0.5, 2.6, 200, null, TAU, 1, 3); break;
        case "chains": S("chains", { x: tx, y: ty, r: 24 * s * z, life: 1.2, pal, k: r.k }); spray(SPARK, pal, tx, ty, 10, 160, 0.4, 1.6); break;
        case "ripple": S("mind", { x: tx, y: ty - 6 * s, r: 30 * s * z, life: 1, pal, k: r.k }); spray(WISP, pal, tx, ty - 10 * s, 8 * z, 50, 0.9, 4, -10, null, TAU, 1, 3); break;
        case "rift": S("rift", { x: fx + 46 * s, y: gyy, h: 64 * s * z, life: 0.6, pal, k: r.k, open: 1 }); spray(GLOW, pal, fx + 46 * s, gyy - 30 * s, 20 * z, 120, 0.7, 3, 0, null, TAU, 0, 3); break;
        case "necro": S("tendrils", { x: fx + 46 * s, y: gyy, h: 50 * s * z, life: 1, pal, k: r.k }); spray(PUFF, pal, fx + 46 * s, gyy, 6 * z, 30, 1.2, 8, -16, -Math.PI / 2, 1, 2, 4); break;
        case "soul": S("spiral", { x: tx, y: ty, x2: fx, y2: fy, r: 22 * s, life: 1.1, pal }); break;
        case "cloak": S("cloak", { x: fx, y: fy, r: 30 * s * z, life: 1.1, pal, k: r.k }); break;
        case "sigil": S("sigil", { x: r.d === "brand" ? tx : tx, y: r.d === "brand" ? ty : gyy, r: (r.d === "brand" ? 14 : 22) * s * z, life: 0.9, pal, k: r.k, upright: r.d === "brand" ? 1 : 0 }); spray(EMBER, pal, tx, r.d === "brand" ? ty : gyy, 10, 80, 0.6, 2.4, -40, -Math.PI / 2, 1.4); break;
        case "columns": for (let i = 0; i < 4; i++) S("column", { x: tx + (i - 1.5) * 18 * s * z, y: gyy, h: (50 + rnd() * 30) * s * z, w: 10 * s, life: 0.8, delay: i * 0.06, pal, k: r.k }); break;
        case "imbue": S("glint", { x: G.ally[0] + 10 * s, y: G.ally[1] - 14 * s, r: 18 * s * z, life: 0.7, pal, k: r.k }); spray(r.p === "frost" ? CRYSTAL : r.p === "shock" ? SPARK : EMBER, pal, G.ally[0] + 10 * s, G.ally[1] - 14 * s, 12, 90, 0.6, 2.4, 0); break;
        case "weapon": S("weapon", { x: (G.hand?.[0] ?? fx) + 4 * s, y: (G.hand?.[1] ?? fy) - 6 * s, r: 30 * s * z, life: 0.9, pal, k: r.k }); spray(WISP, pal, G.hand?.[0] ?? fx, G.hand?.[1] ?? fy, 10, 70, 0.6, 3, 0, null, TAU, 0, 2); break;
        case "ring": S("ring", { x: ax, y: gyy, r0: 6 * s, r1: 60 * s * z, life: 0.8, pal, flat: 0.25, w: 3, banner: r.k < 4 ? 1 : 0 }); spray(MOTE, pal, ax, ay, 12 * z, 70, 0.9, 2.6, -40, -Math.PI / 2, 2); break;
        case "shimmer": S("shimmer", { x: ax, y: ay, r: 26 * s * z, life: 1, pal }); spray(WISP, pal, ax, ay, 10 * z, 40, 1, 3.6, -10, null, TAU, 0, 2); break;
        case "glint": S("star", { x: ax, y: ay - 10 * s, r: 18 * s * z, life: 0.5, pal }); spray(MOTE, pal, ax, ay - 10 * s, 12, 60, 0.8, 2.2); break;
        case "swap": S("spiral", { x: fx, y: fy - 10 * s, x2: fx, y2: fy - 10 * s, r: 20 * s, life: 0.9, pal, twin: 1 }); break;
        case "bubbles": spray(GLOW, pal, ax, ay, 16 * z, 40, 1.4, 2.6, -50, -Math.PI / 2, 1.8, 0, 2); S("ring", { x: ax, y: ay, r0: 4 * s, r1: 22 * s, life: 0.6, pal, flat: 1, w: 1.6 }); break;
        case "feathers": spray(CHIP, pal, ax, ay - 30 * s, 12 * z, 60, 1.6, 2.6, 25, -Math.PI / 2, 2.4, 0, 2); break;
        case "banish": S("rift", { x: tx, y: gyy, h: 70 * s * z, life: 0.7, pal, k: 1, close: 1 }); S("flash", { x: tx, y: ty, r: 50 * s * z, life: 0.3, pal }); spray(GLOW, pal, tx, ty, 18, 160, 0.6, 3, 0); break;
        case "drainin": spray(GLOW, pal, fx, fy, 14 * z, 60, 0.7, 2.6, 0, null, TAU, 0, 2); S("ring", { x: fx, y: fy, r0: 30 * s, r1: 4 * s, life: 0.5, pal, flat: 1, w: 2 }); break;
      }
      if (r.dual) S("ring", { x: ax, y: ay, r0: 10 * s, r1: 50 * s * z, life: 0.45, pal, flat: 0.8, w: 2.4 });
      if (r.g && !self && !miss) mark(r.g, r.g === "glyph" ? fx + 46 * s : tx, (r.g === "char" ? 60 : 36) * s * z, pal, r.k);
      else if (r.g === "glyph" || r.g === "ring") mark(r.g, ax, 34 * s * z, pal, r.k);
      return true;
    }

    // ---------------------------------------------------------------- time
    function tick(dt) {
      if (!(dt > 0)) return;
      alive = 0;
      for (let i = 0; i < NP; i++) {
        if (life[i] <= 0) continue; alive++;
        life[i] -= dt; vy[i] += grav[i] * s * dt; const d = Math.pow(drag[i], dt * 60); vx[i] *= d; vy[i] *= d;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt; rot[i] += vr[i] * dt;
        if (kind[i] === PUFF) sz[i] += dt * 5; else if (kind[i] === EMBER) px[i] += Math.sin(py[i] * 0.12 + i) * 0.3; else if (kind[i] === MOTE) px[i] += Math.sin(life[i] * 6 + i) * 0.25;
        if ((kind[i] === CRYSTAL || kind[i] === CHIP) && py[i] > gy && vy[i] > 0) { py[i] = gy; vy[i] *= -0.25; vx[i] *= 0.5; vr[i] *= 0.4; }
      }
      for (const q of SH) if (q.on) { if (q.delay > 0) { q.delay -= dt; continue; } q.t += dt; if (q.t >= q.life) q.on = false; }
      for (const mk of MARKS) mk.a = Math.min(1, mk.a + dt * 3);
    }
    function clear() { for (let i = 0; i < NP; i++) life[i] = 0; for (const q of SH) q.on = false; cur = null; }

    // ---------------------------------------------------------------- drawing
    const hexA = (c, a) => c + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, "0");
    let seedS = 1; const sr = () => ((seedS = (seedS * 16807) % 2147483647) / 2147483647);
    function jagPath(g, x0, y0, x1, y1, n, amp, seed) {   // a lightning path, the same between re-jags (seeded by time)
      seedS = seed; g.moveTo(x0, y0); const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let i = 1; i < n; i++) { const t = i / n, o2 = (sr() - 0.5) * amp * Math.sin(t * Math.PI) * 2; g.lineTo(x0 + dx * t + nx * o2, y0 + dy * t + ny * o2); }
      g.lineTo(x1, y1);
    }
    /* a painted stroke: a dark under-stroke so it reads on bright snow, then the colour, then a hot core */
    function strokePath(g, path, pal, w, a, add = true) {
      g.lineCap = "round"; g.lineJoin = "round";
      g.globalCompositeOperation = "source-over"; g.globalAlpha = a * 0.35; g.strokeStyle = pal[4]; g.lineWidth = w * 1.9; g.beginPath(); path(); g.stroke();
      if (add) g.globalCompositeOperation = "lighter";
      g.globalAlpha = a * 0.55; g.strokeStyle = pal[2]; g.lineWidth = w * 1.3; g.beginPath(); path(); g.stroke();
      g.globalAlpha = a; g.strokeStyle = pal[0]; g.lineWidth = Math.max(0.8, w * 0.45); g.beginPath(); path(); g.stroke();
      g.globalCompositeOperation = "source-over";
    }
    function blob(g, kindS, c, x, y, r, a, rotA = 0) {
      const im = stamp(kindS, c); if (!im) return; g.globalAlpha = a;
      if (rotA) { g.save(); g.translate(x, y); g.rotate(rotA); g.drawImage(im, -r, -r, r * 2, r * 2); g.restore(); } else g.drawImage(im, x - r, y - r, r * 2, r * 2);
    }
    function hexPath(g, x, y, R) { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; i ? g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R) : g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } g.closePath(); }

    function drawGround(g) {
      if (!MARKS.length) return;
      g.save();
      for (const mk of MARKS) {
        const p = mk.pal, a = mk.a; seedS = mk.seed;
        if (mk.type === "scorch" || mk.type === "char" || mk.type === "burn") {   // a dark scorch with a glowing rim that cools
          for (let i = 0; i < 6; i++) blob(g, 2, i % 2 ? "#2a1e18" : "#3a2a20", mk.x + (sr() - 0.5) * mk.w, gy + (sr() - 0.4) * 4 * s, mk.w * (0.35 + sr() * 0.25), 0.28 * a);
          if (mk.type !== "burn") { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) blob(g, 1, p[3], mk.x + (sr() - 0.5) * mk.w, gy, 6 * s, 0.25 * a); g.globalCompositeOperation = "source-over"; }
        } else if (mk.type === "frost") {   // frost creep: pale crystal fans spreading over the ground
          g.globalAlpha = 0.55 * a; g.strokeStyle = p[1]; g.lineWidth = Math.max(1, 1.2 * s);
          for (let i = 0; i < 9; i++) { const x0 = mk.x + (sr() - 0.5) * mk.w * 1.2, len = (6 + sr() * 12) * s; g.beginPath(); g.moveTo(x0, gy + 1); g.lineTo(x0 + (sr() - 0.5) * len, gy - len * 0.3); g.moveTo(x0, gy + 1); g.lineTo(x0 + (sr() - 0.5) * len * 1.5, gy + 2 * s); g.stroke(); }
          for (let i = 0; i < 4; i++) blob(g, 2, p[1], mk.x + (sr() - 0.5) * mk.w, gy, mk.w * 0.4, 0.22 * a);
        } else if (mk.type === "sigil" || mk.type === "glyph" || mk.type === "ring") {
          g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.35 * a; g.strokeStyle = p[2]; g.lineWidth = Math.max(1, 1.4 * s);
          g.beginPath(); g.ellipse(mk.x, gy, mk.w * 0.7, mk.w * 0.16, 0, 0, TAU); g.stroke();
          if (mk.type !== "ring") { g.beginPath(); for (let i = 0; i < 6; i++) { const an = i * 2.094 + mk.k; g.moveTo(mk.x + Math.cos(an) * mk.w * 0.55, gy + Math.sin(an) * mk.w * 0.12); g.lineTo(mk.x + Math.cos(an + 2.6) * mk.w * 0.55, gy + Math.sin(an + 2.6) * mk.w * 0.12); } g.stroke(); }
          g.globalCompositeOperation = "source-over";
        }
      }
      g.restore();
    }

    function drawFront(g, now = 0) {
      g.save();
      const t = now / 1000;
      // shapes
      for (const q of SH) {
        if (!q.on || q.delay > 0) continue;
        const u = q.t / q.life, a = u < 0.15 ? u / 0.15 : 1 - Math.max(0, (u - 0.5) / 0.5), p = q.pal || PAL.fire;
        switch (q.type) {
          case "bolt": { const sd = q.seed + ((t * 20) | 0) * 7; const amp = q.jag * s * 0.6; strokePath(g, () => { jagPath(g, q.x, q.y, q.x2, q.y2, 10, amp, sd); for (let f = 0; f < q.forks; f++) { const tt2 = 0.3 + f * 0.2, fx0 = lerp(q.x, q.x2, tt2), fy0 = lerp(q.y, q.y2, tt2); jagPath(g, fx0, fy0, fx0 + (q.x2 - q.x) * 0.25, fy0 + 20 * s * (f % 2 ? -1 : 1), 5, amp * 0.6, sd + f + 3); } }, p, q.w * s, a); break; }
          case "zap": { const sd = q.seed + ((t * 30) | 0); strokePath(g, () => { for (let i = 0; i < 2; i++) { seedS = sd + i; const an = sr() * TAU; jagPath(g, q.x, q.y, q.x + Math.cos(an) * q.r, q.y + Math.sin(an) * q.r, 4, q.r * 0.4, sd + i * 5); } }, p, 1.2 * s, a); break; }
          case "beam": {   // a sustained beam: lightning storm, blizzard wind, incinerate lance, soul rend tear
            const w = q.w * s * (0.7 + 0.3 * Math.sin(t * 40)) * Math.min(1, u * 6), sd = q.seed + ((t * 18) | 0);
            if (q.kind === "storm") strokePath(g, () => { jagPath(g, q.x, q.y, q.x2, q.y2, 14, 10 * s, sd); jagPath(g, q.x, q.y, q.x2, q.y2, 14, 14 * s, sd + 9); }, p, w * 0.5, a);
            else if (q.kind === "snow") { g.globalAlpha = 0.35 * a; g.strokeStyle = p[1]; g.lineWidth = w * 2.2; g.lineCap = "round"; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x2, q.y2); g.stroke(); }
            else strokePath(g, () => { g.moveTo(q.x, q.y); g.quadraticCurveTo((q.x + q.x2) / 2, (q.y + q.y2) / 2 + Math.sin(t * 30) * 3 * s, q.x2, q.y2); }, p, w, a);
            g.globalCompositeOperation = "lighter"; blob(g, 0, p[1], q.x2, q.y2, w * 2.4, a * 0.8); g.globalCompositeOperation = "source-over"; break;
          }
          case "glowcol": { g.globalCompositeOperation = "lighter"; const gr = g.createLinearGradient(q.x - q.w, 0, q.x + q.w, 0); gr.addColorStop(0, hexA(p[2], 0)); gr.addColorStop(0.5, hexA(p[1], 0.55 * a * (1 - u))); gr.addColorStop(1, hexA(p[2], 0)); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(q.x - q.w, 0, q.w * 2, q.y2); g.globalCompositeOperation = "source-over"; break; }
          case "sunbeam": {   // a shaft of sunlight onto the foe, with light motes and (Vampire's Bane) a cross of rays
            const w = q.w * Math.sin(Math.min(1, u * 1.6) * Math.PI) ; g.globalCompositeOperation = "lighter";
            const gr = g.createLinearGradient(q.x - w, 0, q.x + w, 0); gr.addColorStop(0, hexA(p[3], 0)); gr.addColorStop(0.3, hexA(p[2], 0.35)); gr.addColorStop(0.5, hexA(p[0], 0.85)); gr.addColorStop(0.7, hexA(p[2], 0.35)); gr.addColorStop(1, hexA(p[3], 0));
            g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.moveTo(q.x - w * 0.6, 0); g.lineTo(q.x + w * 0.6, 0); g.lineTo(q.x + w, q.y2); g.lineTo(q.x - w, q.y2); g.fill();
            blob(g, 0, p[1], q.x, q.y2 - 4 * s, w * 1.6, a * 0.7);
            if (q.cross) { g.strokeStyle = p[1]; g.lineWidth = 3 * s; g.globalAlpha = a * 0.8; g.beginPath(); g.moveTo(q.x - w * 2, q.y2 - 50 * s); g.lineTo(q.x + w * 2, q.y2 - 50 * s); g.stroke(); }
            g.globalCompositeOperation = "source-over"; break;
          }
          case "ring": {   // an expanding painted ring (flat = squashed onto the ground); wavy for mind waves
            const rr = lerp(q.r0, q.r1, 1 - Math.pow(1 - u, 2.4)), fl = q.flat ?? 1;
            strokePath(g, () => { if (q.wavy) { for (let i = 0; i <= 40; i++) { const an = (i / 40) * TAU, w2 = rr * (1 + 0.08 * Math.sin(an * 7 + t * 10)); const X = q.x + Math.cos(an) * w2, Y = q.y + Math.sin(an) * w2 * fl; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } } else g.ellipse(q.x, q.y, Math.max(0.1, rr), Math.max(0.1, rr * fl), 0, 0, TAU); }, p, q.w * s * (1 - u * 0.6), a * (1 - u));
            if (q.banner) { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * 0.35; blob(g, 0, p[1], q.x + Math.cos(an) * rr * 0.6, q.y - 20 * s - u * 40 * s, 8 * s, a * 0.5, an); } g.globalCompositeOperation = "source-over"; }
            break;
          }
          case "burst": { g.globalCompositeOperation = "lighter"; const rr = q.r * (0.4 + 0.6 * Math.sqrt(u)); blob(g, 2, p[1], q.x, q.y, rr * 1.3, a * 0.9); blob(g, 2, p[0], q.x, q.y, rr * 0.7, a); g.globalCompositeOperation = "source-over"; blob(g, 2, p[4], q.x, q.y - rr * 0.3, rr * (0.8 + u), 0.4 * u * a); break; }
          case "flash": { g.globalCompositeOperation = "lighter"; blob(g, 2, p[0], q.x, q.y, q.r * (0.6 + u * 0.6), a); g.globalCompositeOperation = "source-over"; break; }
          case "star": { g.globalCompositeOperation = "lighter"; strokePath(g, () => { for (let i = 0; i < 4; i++) { const an = i * Math.PI / 4 + 0.2, rr = q.r * (i % 2 ? 0.6 : 1) * (0.5 + u * 0.7); g.moveTo(q.x - Math.cos(an) * rr, q.y - Math.sin(an) * rr); g.lineTo(q.x + Math.cos(an) * rr, q.y + Math.sin(an) * rr); } }, p, 2 * s, a * (1 - u)); break; }
          case "pillar": {   // a column of light (healing) or flame (incinerate) rising off the ground
            const h = q.h * Math.min(1, u * 3), w = q.w * (1 - u * 0.4); g.globalCompositeOperation = "lighter";
            for (let i = 0; i < 5; i++) blob(g, q.k ? 2 : 0, p[i % 3], q.x + Math.sin(t * 6 + i) * 4 * s, q.y - h * (i / 5), w * (1.1 - i * 0.12), a * 0.55, q.k ? 0 : -Math.PI / 2);
            g.globalCompositeOperation = "source-over"; break;
          }
          case "hex": {   // a curved hex shield in front of the caster: more layers, a bigger dome per ward
            const R = q.r * (0.6 + 0.4 * Math.min(1, u * 4)), hr = (q.k >= 6 ? 7 : 5.5) * s, rows = q.k >= 2 ? 3 : 2, cols = q.k === 6 ? 3 : q.k >= 1 ? 2 : 1;
            g.globalCompositeOperation = q.k === 4 ? "source-over" : "lighter"; g.lineWidth = Math.max(1, 1.5 * s); g.strokeStyle = p[1];
            for (let c2 = 0; c2 < cols; c2++) for (let r2 = -rows; r2 <= rows; r2++) {
              const yy = q.y + r2 * hr * 1.6, bow = 1 - Math.pow(r2 / (rows + 1), 2), xx = q.x + c2 * hr * 1.4 * (r2 % 2 ? 1 : 1.2) - (1 - bow) * R * 0.5;
              g.globalAlpha = a * (0.35 + 0.35 * Math.sin(t * 5 + r2 + c2 * 2)); g.fillStyle = q.k === 4 ? p[2] : hexA(p[2], 0.18);
              g.beginPath(); hexPath(g, xx, yy, hr); g.fill(); g.stroke();
            }
            if (q.k === 3) { for (let i = 0; i < 3; i++) blob(g, 0, p[1], q.x + Math.cos(t * 6 + i * 2) * R * 0.5, q.y + Math.sin(t * 6 + i * 2) * R * 0.5, 6 * s, a * 0.6); }   // absorb: light swirling in
            if (q.k === 5 && u < 0.6) { g.strokeStyle = p[0]; g.globalAlpha = a; g.beginPath(); g.moveTo(q.x + 10 * s, q.y - 20 * s); g.lineTo(q.x + 40 * s * u + 14 * s, q.y - 30 * s); g.stroke(); }   // reflect: a glint thrown back
            g.globalCompositeOperation = "source-over"; break;
          }
          case "hexdot": { g.globalCompositeOperation = "lighter"; g.globalAlpha = a; g.strokeStyle = p[1]; g.lineWidth = Math.max(1, s); g.beginPath(); hexPath(g, q.x, q.y, q.r); g.stroke(); g.globalCompositeOperation = "source-over"; break; }
          case "plates": {   // flesh armour: plates fly in and snap round the body (bark, stone, iron, ebony, dragon scales)
            const n = 7 + q.k, snap = Math.min(1, u * 2.5);
            for (let i = 0; i < n; i++) {
              const an = (i / n) * TAU + q.seed, d = q.r * (2.2 - 1.2 * snap), X = q.x + Math.cos(an) * d * 0.7, Y = q.y + Math.sin(an) * d;
              g.save(); g.translate(X, Y); g.rotate(an + Math.PI / 2); g.globalAlpha = a; g.fillStyle = p[2 + (i % 2)]; g.strokeStyle = p[4]; g.lineWidth = Math.max(1, s * 0.8);
              const w = (q.k === 4 ? 6 : 5) * s, h = (q.k === 0 ? 9 : 6) * s; g.beginPath();
              if (q.k === 4) { g.moveTo(-w, -h); g.quadraticCurveTo(0, h * 1.4, w, -h); g.closePath(); } else if (q.k === 1) { g.ellipse(0, 0, w, h * 0.8, 0, 0, TAU); } else { g.moveTo(-w, -h); g.lineTo(w, -h * 0.8); g.lineTo(w * 0.8, h); g.lineTo(-w * 0.9, h * 0.9); g.closePath(); }
              g.fill(); g.stroke(); if (q.k >= 2) { g.globalCompositeOperation = "lighter"; g.globalAlpha = a * 0.6 * (1 - snap * 0.6); g.strokeStyle = p[0]; g.beginPath(); g.moveTo(-w * 0.6, -h * 0.6); g.lineTo(w * 0.5, -h * 0.4); g.stroke(); }
              g.restore();
            }
            if (snap >= 1 && u < 0.6) { g.globalCompositeOperation = "lighter"; g.globalAlpha = (0.6 - u) * 1.5; g.strokeStyle = p[1]; g.lineWidth = 2 * s; g.beginPath(); g.ellipse(q.x, q.y, q.r * 0.8, q.r * 1.3, 0, 0, TAU); g.stroke(); g.globalCompositeOperation = "source-over"; }
            break;
          }
          case "chains": {   // paralysis: rigid bands of green light round the foe
            const n = 3 + (q.k ? 1 : 0); g.globalCompositeOperation = "lighter";
            for (let i = 0; i < n; i++) { const yy = q.y - q.r + (i / (n - 1)) * q.r * 2, wob = Math.sin(t * 8 + i) * 2 * s; strokePath(g, () => g.ellipse(q.x, yy + wob, q.r * 0.9 * Math.min(1, u * 5), q.r * 0.22, 0.15 * (i % 2 ? 1 : -1), 0, TAU), p, 1.6 * s, a); }
            break;
          }
          case "mind": {   // illusion: a ripple of the mind round the foe's head; calm waves inward, fear spikes outward, fury pulses
            const calmK = q.k <= 3, fearK = q.k >= 7, rings = 3;
            for (let i = 0; i < rings; i++) {
              let uu = ((u * 1.6 + i / rings) % 1); if (calmK) uu = 1 - uu; const rr = q.r * (0.3 + uu * 0.9);
              strokePath(g, () => { for (let j = 0; j <= 36; j++) { const an = (j / 36) * TAU, sp = fearK ? (j % 2 ? 1.25 : 0.85) : 1 + (q.k >= 4 && q.k <= 6 ? 0.15 * Math.sin(an * 5 + t * 20) : 0.06 * Math.sin(an * 4)); const X = q.x + Math.cos(an) * rr * sp, Y = q.y + Math.sin(an) * rr * sp * 0.6; j ? g.lineTo(X, Y) : g.moveTo(X, Y); } }, p, 1.6 * s, a * (calmK ? uu : 1 - uu));
            }
            break;
          }
          case "rift": {   // a purple tear standing on the ground: it opens, things step out, it seals
            const op = q.close ? 1 - u : q.open ? Math.min(1, u * 4) * (1 - Math.max(0, (u - 0.7) / 0.3)) : Math.sin(Math.min(1, u * 1.2) * Math.PI), h = q.h * op, w = h * 0.28;
            if (op <= 0.01) break;
            g.globalAlpha = a * 0.85; g.fillStyle = "#0c0614"; g.beginPath(); g.ellipse(q.x, q.y - q.h * 0.5, w * 0.6, h * 0.5, 0, 0, TAU); g.fill();
            g.globalCompositeOperation = "lighter";
            for (let i = 0; i < 3; i++) strokePath(g, () => g.ellipse(q.x, q.y - q.h * 0.5, w * (0.6 + i * 0.25), h * (0.5 + i * 0.05), Math.sin(t * 2 + i) * 0.12, 0, TAU), p, (2.4 - i * 0.6) * s, a * (1 - i * 0.25));
            blob(g, 2, p[2], q.x, q.y - q.h * 0.5, w * 2.2, a * 0.4);
            g.globalCompositeOperation = "source-over"; break;
          }
          case "tendrils": {   // the dead rising: dark green tendrils clawing up out of the ground
            const n = 3 + q.k, hh = q.h * Math.min(1, u * 2);
            for (let i = 0; i < n; i++) { const x0 = q.x + (i - (n - 1) / 2) * 7 * s; strokePath(g, () => { g.moveTo(x0, q.y); g.bezierCurveTo(x0 + Math.sin(t * 3 + i) * 10 * s, q.y - hh * 0.4, x0 - Math.sin(t * 2 + i) * 12 * s, q.y - hh * 0.7, x0 + (i % 2 ? 6 : -6) * s, q.y - hh * (0.7 + (i % 3) * 0.15)); }, p, 2.4 * s, a, false); }
            break;
          }
          case "spiral": {   // soul trap: a violet tether spiralling between foe and caster; equilibrium: two colours trading places
            g.globalCompositeOperation = "lighter";
            for (let i = 0; i < 14; i++) { const f = ((i / 14) + u * 1.4) % 1, an = f * 14 + t * 3, X = lerp(q.x, q.x2, q.twin ? 0 : f) + Math.cos(an) * q.r * (q.twin ? 1 : 1 - f * 0.7), Y = lerp(q.y, q.y2, q.twin ? 0 : f) + Math.sin(an) * q.r * 0.6;
              blob(g, 0, q.twin ? (i % 2 ? "#6aa8ff" : "#ff5a6a") : p[i % 3], X, Y, 6 * s, a * 0.8); }
            g.globalCompositeOperation = "source-over"; break;
          }
          case "cloak": {   // a ring of fire, frost or lightning circling the caster
            const n = 10; g.globalCompositeOperation = "lighter";
            for (let i = 0; i < n; i++) { const an = (i / n) * TAU + t * (q.k === 2 ? 7 : 3), X = q.x + Math.cos(an) * q.r * 0.8, Y = q.y + Math.sin(an) * q.r * 0.35 + 10 * s;
              if (q.k === 2) { if (i % 3 === 0) strokePath(g, () => jagPath(g, X, Y, X + Math.cos(an + 1.6) * 14 * s, Y - 10 * s, 4, 6 * s, q.seed + i + ((t * 20) | 0)), p, 1.2 * s, a); }
              else blob(g, q.k ? 1 : 0, p[i % 3], X, Y - (q.k ? 0 : 6 * s), (q.k ? 7 : 9) * s, a * (Math.sin(an) > 0 ? 0.9 : 0.45), -Math.PI / 2); }
            g.globalCompositeOperation = "source-over"; break;
          }
          case "sigil": {   // a rune circle drawn stroke by stroke (on the ground, or burnt upright on the foe)
            const R = q.r, f = Math.min(1, u * 2.5), ry = q.upright ? R : R * 0.24;
            g.globalCompositeOperation = "lighter";
            strokePath(g, () => { g.ellipse(q.x, q.y, R, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * f); }, p, 1.6 * s, a);
            if (f >= 1) strokePath(g, () => { const m = 5 + (q.k || 0); for (let i = 0; i <= m; i++) { const an = -Math.PI / 2 + i * (TAU * 2 / m); const X = q.x + Math.cos(an) * R * 0.8, Y = q.y + Math.sin(an) * ry * 0.8; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } }, p, 1.3 * s, a);
            g.globalCompositeOperation = "source-over"; break;
          }
          case "glyph": { g.globalCompositeOperation = "lighter"; strokePath(g, () => { g.moveTo(q.x - q.r, q.y); g.lineTo(q.x + q.r, q.y); g.moveTo(q.x, q.y - q.r); g.lineTo(q.x, q.y + q.r); }, p, 2 * s, a * (1 - u)); g.globalCompositeOperation = "source-over"; break; }
          case "line": {   // a wall: a burning, frozen or crackling strip along the ground under the foe
            const w = q.w * Math.min(1, u * 3); g.globalCompositeOperation = "lighter";
            for (let i = 0; i < 6; i++) blob(g, q.k === 1 ? 2 : 1, p[1 + (i % 2)], q.x - w / 2 + (i / 5) * w, q.y - 2 * s, 10 * s, a * 0.7);
            g.globalCompositeOperation = "source-over"; break;
          }
          case "column": {   // one column of a wall: a flame tongue, an ice spike or a lightning post
            const h = q.h * Math.sin(Math.min(1, u * 1.4) * Math.PI);
            if (q.k === 1) { g.globalAlpha = a; g.fillStyle = p[2]; g.strokeStyle = p[0]; g.lineWidth = Math.max(1, s); g.beginPath(); g.moveTo(q.x - q.w * 0.5, q.y); g.lineTo(q.x + 1 * s, q.y - h); g.lineTo(q.x + q.w * 0.5, q.y); g.closePath(); g.fill(); g.stroke(); }
            else if (q.k === 2) strokePath(g, () => jagPath(g, q.x, q.y - q.h, q.x, q.y, 6, 8 * s, q.seed + ((t * 20) | 0)), p, 1.8 * s, a);
            else { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 4; i++) blob(g, 0, p[i % 3], q.x + Math.sin(t * 9 + i) * 2 * s, q.y - h * (i / 4) - 4 * s, q.w * (1.4 - i * 0.25), a * 0.7, -Math.PI / 2); g.globalCompositeOperation = "source-over"; }
            break;
          }
          case "meteor": { const p2 = Math.min(1, u * 1.6), X = lerp(q.x, q.x2, p2), Y = lerp(q.y, q.y2, p2);
            if (p2 < 1) { strokePath(g, () => { g.moveTo(lerp(q.x, X, 0.6), lerp(q.y, Y, 0.6)); g.lineTo(X, Y); }, p, q.w * s * 0.7, a); g.globalCompositeOperation = "lighter"; blob(g, 2, p[0], X, Y, q.w * s * 1.2, a); g.globalCompositeOperation = "source-over"; }
            else if (!q.boom) { q.boom = 1; spray(EMBER, p, X, Y, 14, 200, 0.6, 3.4, 80); spray(PUFF, p, X, Y, 4, 40, 1.2, 9, -10, null, TAU, 3, 4); }
            break; }
          case "vortex": { const cx = lerp(q.x, q.x2, Math.min(1, u * 1.3)); g.globalCompositeOperation = "lighter";
            for (let i = 0; i < 5; i++) { const yy = q.y2 - (i / 5) * q.h, rr = (8 + i * 5) * s; strokePath(g, () => g.ellipse(cx, yy, rr, rr * 0.3, 0, t * 6 + i, t * 6 + i + 4), p, 1.4 * s, a * 0.8); }
            g.globalCompositeOperation = "source-over"; break; }
          case "thread": {   // a ribbon of light from the caster to an ally (or from the foe back to the caster)
            const f = Math.min(1, u * 3); strokePath(g, () => { g.moveTo(q.x, q.y); g.quadraticCurveTo((q.x + q.x2) / 2, Math.min(q.y, q.y2) - 24 * s, lerp(q.x, q.x2, f), lerp(q.y, q.y2, f)); }, p, q.w * s, a * 0.9);
            break; }
          case "ice": {   // frost creeping over the target: crystal fans, a big spike for Icy Spear
            const R = q.r * Math.min(1, u * 3); g.globalAlpha = a * 0.8; g.strokeStyle = p[1]; g.lineWidth = Math.max(1, 1.3 * s); seedS = q.seed;
            g.beginPath(); for (let i = 0; i < 10; i++) { const an = sr() * TAU, l2 = R * (0.4 + sr() * 0.6); g.moveTo(q.x, q.y); g.lineTo(q.x + Math.cos(an) * l2, q.y + Math.sin(an) * l2); g.lineTo(q.x + Math.cos(an + 0.3) * l2 * 0.7, q.y + Math.sin(an + 0.3) * l2 * 0.7); } g.stroke();
            if (q.spike) { g.fillStyle = hexA(p[2], 0.85); g.strokeStyle = p[0]; g.beginPath(); g.moveTo(q.x - 30 * s, q.y - 4 * s); g.lineTo(q.x + 16 * s, q.y - 2 * s); g.lineTo(q.x - 30 * s, q.y + 4 * s); g.closePath(); g.fill(); g.stroke(); }
            break; }
          case "orb": { const bob = Math.sin(t * 3) * 3 * s; g.globalCompositeOperation = "lighter"; blob(g, 2, p[1], q.x, q.y + bob, q.r * 3, a * 0.7); blob(g, 2, p[0], q.x, q.y + bob, q.r * 1.4, a); g.globalCompositeOperation = "source-over"; break; }
          case "shimmer": { g.globalCompositeOperation = "lighter"; for (let i = 0; i < 6; i++) { const yy = q.y - q.r + (i / 5) * q.r * 2; strokePath(g, () => { g.moveTo(q.x - q.r * 0.6, yy); g.quadraticCurveTo(q.x + Math.sin(t * 8 + i) * 8 * s, yy - 4 * s, q.x + q.r * 0.6, yy); }, p, 1 * s, a * 0.6 * (1 - u)); } g.globalCompositeOperation = "source-over"; break; }
          case "weapon": {   // a bound weapon assembling out of wisps in the hand: dagger, sword, battleaxe, bow, a pair
            const f = Math.min(1, u * 2.2), L = q.r * f;
            strokePath(g, () => {
              if (q.k === 3) { g.moveTo(q.x, q.y - L); g.quadraticCurveTo(q.x + L * 0.5, q.y, q.x, q.y + L); g.moveTo(q.x, q.y - L); g.lineTo(q.x, q.y + L); }
              else { g.moveTo(q.x, q.y); g.lineTo(q.x + L * 0.5, q.y - L); if (q.k === 2) { g.moveTo(q.x + L * 0.42, q.y - L * 0.8); g.quadraticCurveTo(q.x + L * 0.75, q.y - L * 0.75, q.x + L * 0.55, q.y - L * 0.5); } if (q.k === 4) { g.moveTo(q.x - 8 * s, q.y); g.lineTo(q.x - 8 * s + L * 0.4, q.y - L * 0.8); } }
            }, p, 2.6 * s, a);
            break; }
          case "glint": { g.globalCompositeOperation = "lighter"; blob(g, 0, p[1], q.x, q.y, q.r, a, t * 4); blob(g, 0, p[0], q.x, q.y, q.r * 0.6, a, -t * 4); g.globalCompositeOperation = "source-over"; break; }
          case "rays": { g.globalCompositeOperation = "lighter"; strokePath(g, () => { for (let i = 0; i < q.n; i++) { const an = i * TAU / q.n + t; g.moveTo(q.x + Math.cos(an) * q.r * 0.3, q.y + Math.sin(an) * q.r * 0.3); g.lineTo(q.x + Math.cos(an) * q.r, q.y + Math.sin(an) * q.r); } }, p, 1 * s, a * 0.6); g.globalCompositeOperation = "source-over"; break; }
        }
      }
      // what's in flight this frame
      const pr = cur?.proj, cp = cur?.pal, z = cur?.r?.z || 1;
      if (pr && cp) {
        g.globalCompositeOperation = "lighter";
        if (pr.k === "jet") { for (let i = 0; i < 4; i++) { const f = i / 3; blob(g, 0, cp[i % 3], lerp(pr.x, pr.x2, f), lerp(pr.y, pr.y2, f), (6 + f * 10) * s * z, 0.6, Math.atan2(pr.y2 - pr.y, pr.x2 - pr.x)); } }
        else if (pr.k === "comet") { const dir = Math.sign(cur.G.to[0] - cur.G.hand[0]) || 1; for (let i = 0; i < 4; i++) blob(g, 0, cp[i % 3], pr.x - dir * i * 7 * s, pr.y, (9 - i * 1.5) * s * z, 0.8 - i * 0.15, dir > 0 ? Math.PI : 0); blob(g, 2, cp[0], pr.x, pr.y, 6 * s * z, 1); }
        else if (pr.k === "orb") { blob(g, 2, cp[2], pr.x, pr.y, 14 * s * z, 0.8); blob(g, 2, cp[1], pr.x, pr.y, 9 * s * z, 1); blob(g, 2, cp[0], pr.x, pr.y, 5 * s * z, 1); }
        else if (pr.k === "brand") { blob(g, 1, cp[1], pr.x, pr.y, 10 * s, 0.9); g.globalCompositeOperation = "source-over"; strokePath(g, () => { g.ellipse(pr.x, pr.y, 6 * s, 6 * s, 0, 0, TAU); g.moveTo(pr.x - 4 * s, pr.y); g.lineTo(pr.x + 4 * s, pr.y); }, cp, 1.2 * s, 1); }
        else if (pr.k === "shard") { g.globalCompositeOperation = "source-over"; const dir = Math.sign(cur.G.to[0] - cur.G.hand[0]) || 1, L = pr.len * s * z * 0.8, hw = (pr.len > 20 ? 4.5 : 3) * s;
          g.globalAlpha = 0.45; g.fillStyle = cp[4]; g.beginPath(); g.moveTo(pr.x + dir * 2 * s, pr.y + 1.5 * s); g.lineTo(pr.x - dir * L, pr.y - hw + 1.5 * s); g.lineTo(pr.x - dir * L, pr.y + hw + 1.5 * s); g.fill();
          g.globalAlpha = 0.95; g.fillStyle = cp[2]; g.strokeStyle = cp[0]; g.lineWidth = Math.max(1, s); g.beginPath(); g.moveTo(pr.x, pr.y); g.lineTo(pr.x - dir * L, pr.y - hw); g.lineTo(pr.x - dir * L * 0.85, pr.y); g.lineTo(pr.x - dir * L, pr.y + hw); g.closePath(); g.fill(); g.stroke();
          g.globalCompositeOperation = "lighter"; blob(g, 2, cp[1], pr.x, pr.y, 8 * s, 0.6); }
        g.globalCompositeOperation = "source-over";
      }
      // particles: painted ones first, then the light
      if (alive) for (let pass = 0; pass < 2; pass++) {
        g.globalCompositeOperation = pass ? "lighter" : "source-over";
        for (let i = 0; i < NP; i++) {
          if (life[i] <= 0 || ADD[kind[i]] !== (pass === 1)) continue;
          const f = life[i] / max[i], r = sz[i] * s, c = col[i];
          switch (kind[i]) {
            case GLOW: blob(g, 2, c, px[i], py[i], r * 2.2, Math.min(1, f * 1.4)); break;
            case EMBER: blob(g, 0, c, px[i], py[i], r * 1.8, Math.min(1, f * 1.6) * (0.7 + 0.3 * Math.sin(i * 7 + life[i] * 30)), Math.atan2(vy[i], vx[i]) + Math.PI); break;
            case MOTE: { const tw = 0.6 + 0.4 * Math.sin(life[i] * 12 + i); blob(g, 2, c, px[i], py[i], r * 1.6, f * tw); if (r > 2 * s && tw > 0.85) { g.globalAlpha = f * 0.8; g.strokeStyle = c; g.lineWidth = Math.max(0.6, s * 0.5); g.beginPath(); g.moveTo(px[i] - r, py[i]); g.lineTo(px[i] + r, py[i]); g.moveTo(px[i], py[i] - r); g.lineTo(px[i], py[i] + r); g.stroke(); } break; }
            case WISP: blob(g, 0, c, px[i], py[i], r * 2, f * 0.7, rot[i]); break;
            case GRAIN: blob(g, 1, c, px[i], py[i], r * 2, f); break;
            case SPARK: g.globalAlpha = Math.min(1, f * 1.5); g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = Math.max(0.8, r * 0.45); g.beginPath(); g.moveTo(px[i], py[i]); g.lineTo(px[i] - vx[i] * 0.03, py[i] - vy[i] * 0.03); g.stroke(); break;
            case PUFF: blob(g, 2, c, px[i], py[i], r * 1.6, f * 0.5); break;
            case CRYSTAL: { g.globalAlpha = Math.min(1, f * 1.6); g.save(); g.translate(px[i], py[i]); g.rotate(rot[i]); g.fillStyle = c; g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(0.6, s * 0.5);
              g.beginPath(); g.moveTo(0, -r * 1.4); g.lineTo(r * 0.6, 0); g.lineTo(0, r * 1.4); g.lineTo(-r * 0.6, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); break; }
            case CHIP: { g.globalAlpha = Math.min(1, f * 1.6); g.save(); g.translate(px[i], py[i]); g.rotate(rot[i]); g.fillStyle = c; g.beginPath(); g.moveTo(-r, -r * 0.6); g.lineTo(r * 0.8, -r * 0.8); g.lineTo(r, r * 0.5); g.lineTo(-r * 0.6, r * 0.8); g.closePath(); g.fill(); g.restore(); break; }
          }
        }
      }
      g.restore();
    }
    return { begin, step, hit, owns, tick, clear, drawGround, drawFront, key: () => cur?.key || null, count: () => alive, cap: NP, shapes: () => SH.filter((q) => q.on).length };
  }

  return { PAL, SPELL, keyOf, recipe, keys, sig, scene, baseSpell };
})();
if (typeof module !== "undefined") module.exports = MOVEFX;
