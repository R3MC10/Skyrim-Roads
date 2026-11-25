/* Daedric bargains and artifact awakening (bargains.js). [OURS, after Skyrim's Daedric shrines]
   Builds on daedric.js (the thirteen Daedric quests and their artifacts stay as they are) and on the Daedric Mark in
   afflictions.js. Hooks only, like afflictions.js: CURSE.dmgMult / dmgInMult / tick / after reach both the instant fight
   (engine.js) and turn-by-turn fights (tbfight.js plays a G.Fight), so every power works in both.

   SHRINE CONTRACTS: from level 8 a black shrine by the road (ROAD_EVENTS, painted gev-black-shrine) carries one prince's
   offer. Six princes, each with a short chain of three deeds counted from real play:
     Mehrunes Dagon  slaughter      foes slain, dangerous foes, a dungeon cleared
     Azura           the night      fights won at night, a dangerous foe at night, the restless dead or daedra
     Nocturnal       theft          pockets picked, locks picked, a fight opened from hiding
     Hircine         the hunt       beasts slain, a great beast, a beast under the moon
     Boethiah        the lone fight fights won alone, warriors and mages beaten, a win with your back to the wall
     Meridia         the dead       undead put to rest, a barrow cleared, a powerful undead destroyed
   One contract at a time; you can break it. The last deed hands you the prince's pact artifact.

   ARTIFACTS: you bind one at a time (Character → Daedric bargains). The bound one grows with the deeds its prince likes:
   Dormant → Awakened → Ascendant. Every stage adds its own power (damage, a burn each round, healing, guard...), and
   Ascendant does not come by itself: you choose to accept its curse, or refuse and stay Awakened (you can change your
   mind later, or let it sleep again). Numbers tuned with tests/test_daedric.js: an Ascendant artifact with its curse is
   worth less than going from good gear to the best crafted gear, and nobody gets one-shot.

   THE DAEDRIC MARK: carrying it, shrines call twice as often and your deeds count a quarter more. Accepting a curse
   brands you with the Mark (or deepens it). Under the Vow of Cleansing the princes turn away: no contracts, and your
   artifact stops growing.
   Perks (perkfx.js): Princely Favour (deeds count 50% more), Bound Will (curses half as strong), Awakened Bond
   (artifact powers 25% stronger). */
const BARGAIN = (() => {
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const DAY = 2 * 3600;
  const MIN_LEVEL = 8, SHRINE = 0.05, OFFER_CD = DAY;
  const fill = (en, v) => (v ? en.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : en);
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : fill(en, v));
  const esc = (t) => String(t ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  const pnum = (s, k) => (typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0);
  const pct = (x) => Math.round(x * 100);
  const STAGES = ["Dormant", "Awakened", "Ascendant"];

  // ---------------------------------------------------------------- the princes
  /* steps: [what to do, how many, test(kind, ctx)]; deed(kind, ctx): points for the bound artifact; need: [Awakened, Ascendant] */
  const PR = {
    dagon: { prince: "Mehrunes Dagon", color: "#c8402a", theme: "slaughter", contract: "The Burning Tithe",
      whisper: "Embers glow in the black wax and a voice like a forge roars in your head: \"Bring me ruin, mortal, and I will make you a weapon of it.\"",
      art: "Cinder of Dagon", desc: "A coal that never cools, in a cage of black iron.",
      steps: [["Slay 8 foes.", 8, (k) => k === "win"], ["Bring down 2 dangerous foes (a boss, an elite, a dragon or anything high-danger).", 2, (k, c) => k === "win" && c.tough], ["Clear a dungeon to its boss.", 1, (k) => k === "clear"]],
      deed: (k, c) => (k === "win" ? (c.tough ? 3 : 1) : k === "clear" ? 3 : 0), need: [14, 40], grow: "Grows with every foe you slay, and faster with dangerous ones.",
      curse: ["Dagon's Hunger", "Every foe hits you {n}% harder."] },
    azura: { prince: "Azura", color: "#b98ae0", theme: "the night", contract: "The Twilight Vigil",
      whisper: "The moon comes out from behind a cloud and the altar shines like a star. A woman's voice, calm and cold: \"Walk in my twilight, and I will light your way.\"",
      art: "Azura's Moonshard", desc: "A sliver of pale crystal that glows when the sun goes down.",
      steps: [["Win 3 fights at night.", 3, (k, c) => k === "win" && c.night], ["Win a fight at night against a dangerous foe.", 1, (k, c) => k === "win" && c.night && c.tough], ["Slay 2 of the restless dead or daedra.", 2, (k, c) => k === "win" && (c.undead || c.daedra)]],
      deed: (k, c) => (k === "win" && c.night ? (c.tough ? 3 : 1) : 0), need: [12, 32], grow: "Grows with every fight you win at night.",
      curse: ["Sunblind", "Out in daylight you hit {n}% softer."] },
    nocturnal: { prince: "Nocturnal", color: "#5d6fa8", theme: "theft", contract: "The Shadow Debt",
      whisper: "A raven lands on the altar and stares at your purse. A whisper from everywhere at once: \"Take what isn't yours, little shadow. I will take my share.\"",
      art: "Eye of Nocturnal", desc: "A black glass eye on a cord. It never quite looks where you do.",
      steps: [["Pick 4 pockets without being caught.", 4, (k) => k === "steal"], ["Pick 3 locks.", 3, (k) => k === "lock"], ["Win a fight you opened from hiding.", 1, (k, c) => k === "win" && c.hidden]],
      deed: (k, c) => (k === "steal" ? 2 : k === "lock" ? 1 : k === "win" && c.hidden ? 2 : 0), need: [12, 30], grow: "Grows with every pocket and lock you pick, and every fight you open from hiding.",
      curse: ["The Tithe of Shadows", "Shopkeepers sense it: everything costs you {n}% more."] },
    hircine: { prince: "Hircine", color: "#9a7444", theme: "the hunt", contract: "The Hunter's Due",
      whisper: "Antlers of old bone are piled around the altar. Somewhere close a wolf howls, and then a man laughs: \"Hunt, and be hunted. That is my bargain.\"",
      art: "Hircine's Bone Totem", desc: "A carved antler on a sinew cord, warm as something alive.",
      steps: [["Slay 5 beasts.", 5, (k, c) => k === "win" && c.beast], ["Bring down a great beast (a troll, a bear, a sabre cat, a mammoth...).", 1, (k, c) => k === "win" && c.beast && (c.big || c.tough)], ["Slay a beast at night.", 1, (k, c) => k === "win" && c.beast && c.night]],
      deed: (k, c) => (k === "win" && c.beast ? (c.big || c.tough ? 3 : 1) : 0), need: [12, 32], grow: "Grows with every beast you slay, and faster with great ones.",
      curse: ["The Beast's Hunger", "Potions heal you {n}% less."] },
    boethiah: { prince: "Boethiah", color: "#7a5a9a", theme: "the lone fight", contract: "The Champion's Price",
      whisper: "The altar is scratched with the names of the dead. A woman laughs, sharp as a knife: \"Friends betray. Stand alone, and prove you deserve to.\"",
      art: "Sigil of Boethiah", desc: "A ring of black iron sigils that tightens when blood is spilled.",
      steps: [["Win 3 fights with no follower or friend at your side.", 3, (k, c) => k === "win" && c.alone], ["Beat 3 warriors, bandits or mages.", 3, (k, c) => k === "win" && c.humanoid], ["Win a fight with less than a third of your health left.", 1, (k, c) => k === "win" && c.lowhp]],
      deed: (k, c) => (k === "win" ? (c.alone ? 1 : 0) + (c.humanoid ? 1 : 0) + (c.lowhp ? 3 : 0) : 0), need: [14, 36], grow: "Grows with fights you win alone, warriors and mages you beat, and close calls.",
      curse: ["Boethiah's Contempt", "With a follower or friend at your side you hit {n}% softer."] },
    meridia: { prince: "Meridia", color: "#e6c25a", theme: "the restless dead", contract: "The Cleansing Light",
      whisper: "A beam of white light falls on the altar from a clear night sky. A bright voice: \"The dead walk where they should sleep. Put them down, champion.\"",
      art: "Meridia's Lantern", desc: "A small brass lantern whose flame burns white and never smokes.",
      steps: [["Put 5 of the restless dead to rest (draugr, skeletons, ghosts, vampires).", 5, (k, c) => k === "win" && c.undead], ["Clear a Nordic barrow.", 1, (k, c) => k === "clear" && c.barrow], ["Destroy a powerful undead (a Deathlord, a dragon priest, a vampire lord...).", 1, (k, c) => k === "win" && c.undead && c.tough]],
      deed: (k, c) => (k === "win" && c.undead ? (c.tough ? 3 : 1) : k === "clear" && c.barrow ? 3 : 0), need: [12, 32], grow: "Grows with every undead you put down and every barrow you clear.",
      curse: ["Blinding Light", "Its glow gives you away: Sneak is {n} lower."] },
  };
  const IDS = Object.keys(PR);

  // ---------------------------------------------------------------- state
  const st = (s) => (s.bargain = s.bargain || { c: null, arts: {}, bound: null, done: [], offAt: 0 });
  const peek = (s) => s && s.bargain;
  const owned = (s) => Object.keys(peek(s)?.arts || {}).filter((p) => PR[p]);
  const marked = (s) => typeof AFFL !== "undefined" && AFFL.has && AFFL.has(s, "daedric");
  const vowed = (s) => s?.affl?.daedric?.vow != null;
  const deedMult = (s) => 1 + pnum(s, "dbdeed") + (marked(s) ? 0.25 : 0);
  const powMult = (s) => 1 + pnum(s, "dbpow");
  const curseMult = (s) => Math.max(0, 1 - pnum(s, "dbcurse"));
  function artOf(s, p) { return peek(s)?.arts?.[p] || null; }
  /* 1 Dormant, 2 Awakened, 3 Ascendant (only once you accepted the curse) */
  function stage(s, p) {
    const a = artOf(s, p); if (!a) return 0;
    const n = PR[p].need, d = a.deeds || 0;
    return d >= n[1] && a.asc ? 3 : d >= n[0] ? 2 : 1;
  }
  const ready = (s, p) => { const a = artOf(s, p); return !!a && !a.asc && (a.deeds || 0) >= PR[p].need[1]; };
  const bound = (s) => { const b = peek(s)?.bound; return b && PR[b] && artOf(s, b) ? b : null; };

  // ---------------------------------------------------------------- numbers for each artifact (power and curse)
  function nums(s, p, sg = stage(s, p)) {
    const P = powMult(s), C = curseMult(s), L = s.level || 1;
    const x = { st: sg };
    if (p === "dagon") Object.assign(x, { out: 0.05 * P, burn: Math.round((2 + L / 6) * P), ruin: 0.15 * P, curse: 0.12 * C });
    if (p === "azura") Object.assign(x, { regen: 0.03 * P, night: 0.1 * P, save: 0.3 * P, curse: 0.12 * C });
    if (p === "nocturnal") Object.assign(x, { first: 0.12 * P, guard: 0.06 * P, nguard: 0.12 * P, dark: 0.1 * P, gold: Math.round((10 + L) * P), curse: 0.15 * C });
    if (p === "hircine") Object.assign(x, { beast: 0.1 * P, heal: 0.02 * P, low: 0.15 * P, curse: 0.3 * C });
    if (p === "boethiah") Object.assign(x, { alone: 0.07 * P, steel: 0.06 * P, man: 0.08 * P, curse: 0.15 * C });
    if (p === "meridia") Object.assign(x, { undead: 0.12 * P, light: Math.round((2 + L / 5) * P), ward: 0.15 * P, curse: Math.round(30 * C) });
    return x;
  }
  /* the three powers as plain lines (all three, so you can see what's coming) and the curse */
  function powers(s, p) {
    const n = nums(s, p, 3);
    const L = {
      dagon: [T("Dagon's fire: you hit {n}% harder.", { n: pct(n.out) }), T("Smoulder: every round the foe burns for {n}.", { n: n.burn }), T("Ruin: against a foe under a third of its health you hit {n}% harder.", { n: pct(n.ruin) })],
      azura: [T("Moonlight: every round in a fight you get back {n}% of your stamina and magicka.", { n: pct(n.regen) }), T("At night foes hit you {n}% softer.", { n: pct(n.night) }), T("Twilight's Grace: once a fight, when you drop under a quarter of your health, the moon heals you for {n}% of it.", { n: pct(n.save) })],
      nocturnal: [T("Your blows in the first round of a fight hit {n}% harder (not against big or dangerous foes).", { n: pct(n.first) }), T("Shadows cling to you: foes hit you {a}% softer ({b}% at night).", { a: pct(n.guard), b: pct(n.nguard) }), T("At night and underground you hit {a}% harder, and every fight you win leaves you {b} more gold.", { a: pct(n.dark), b: n.gold })],
      hircine: [T("You hit beasts {n}% harder.", { n: pct(n.beast) }), T("Blood scent: while the foe is under half its health you heal {n}% every round.", { n: pct(n.heal) }), T("The Hunt: while you're under half your health you hit {n}% harder.", { n: pct(n.low) })],
      boethiah: [T("Fighting alone (no follower or friend) you hit {n}% harder.", { n: pct(n.alone) }), T("Every round you get hurt, you get back {n}% of your stamina.", { n: pct(n.steel) }), T("Warriors, bandits and mages take {n}% more from you.", { n: pct(n.man) })],
      meridia: [T("You hit the undead {n}% harder.", { n: pct(n.undead) }), T("Radiance: every round the foe takes {n} light damage, twice that if it's undead.", { n: n.light }), T("Dawn's Ward: the undead and daedra hit you {n}% softer.", { n: pct(n.ward) })],
    }[p];
    const c = PR[p].curse, cv = p === "meridia" ? n.curse : pct(n.curse);
    return { pow: L, curse: [T(c[0]), T(c[1], { n: cv })] };
  }

  // ---------------------------------------------------------------- who and what in a fight
  const tagsOf = (f) => f.tags || new Set(f.e?.tags || []);
  const nameOf = (f) => f.e?.name || "";
  const isUndead = (f) => tagsOf(f).has("undead") || /draugr|skeleton|wight|deathlord|lich|ghost|wraith|vampire|restless|dragon priest|revenant/i.test(nameOf(f));
  const isDaedra = (f) => (typeof AFFL !== "undefined" && AFFL.isDaedra ? AFFL.isDaedra(f) : tagsOf(f).has("daedra"));
  const isBeast = (f) => tagsOf(f).has("beast") || /wolf|bear|troll|sabre|mammoth|spider|skeever|horker|mudcrab|chaurus|slaughterfish|deer|elk|fox|hare/i.test(nameOf(f));
  const isMan = (f) => { const t = tagsOf(f); return t.has("humanoid") || t.has("human") || t.has("mage") || /bandit|outlaw|forsworn|thalmor|necromancer|warlock|mage|soldier|mercenary|thug|hunter|vigilant|cultist|marauder|highwayman|chief/i.test(nameOf(f)); };
  const isTough = (f) => { const t = tagsOf(f); return t.has("elite") || t.has("dragon") || !!f.e?.boss || !!f.e?.qboss || f.e?.danger === "high" || !!f.bf; };
  const isBig = (f) => /troll|bear|sabre|mammoth|giant|spriggan|werewolf|lurker|dragon/i.test(nameOf(f));
  const night = (f) => typeof G !== "undefined" && G.isNight ? G.isNight(f.t ?? nowS()) : false;
  const dark = (f) => night(f) || !!f.s?.dungeon;
  const daylight = (f) => !night(f) && !f.s?.dungeon && !f.e?.indoor && !f.arena;
  const alone = (f) => (f._dbgAl === undefined ? (f._dbgAl = !(f.allies || []).length) : f._dbgAl);
  const maxHp = (s) => (typeof G !== "undefined" ? G.maxHealth(s) : 100);
  const foeMax = (f) => f.ehp0 || f.e?.health || f.ehp || 1;
  function ctxOf(f) {
    return { tough: isTough(f), big: isBig(f), beast: isBeast(f), undead: isUndead(f), daedra: isDaedra(f), humanoid: isMan(f),
      night: night(f), alone: alone(f), lowhp: f.hp > 0 && f.hp < maxHp(f.s) / 3, hidden: !!f._dbgHid };
  }

  // ---------------------------------------------------------------- fight numbers (bound artifact only)
  function outMult(f) {
    const s = f.s, p = s && bound(s); if (!p) return 1;
    if (f.turn <= 1 && f.hidden) f._dbgHid = true;
    alone(f);
    const sg = stage(s, p), n = nums(s, p, sg); let m = 1;
    if (p === "dagon") { m *= 1 + n.out; if (sg >= 3 && f.ehp > 0 && f.ehp < foeMax(f) / 3) m *= 1 + n.ruin; }
    if (p === "azura" && sg >= 3 && daylight(f)) m *= 1 - n.curse;
    if (p === "nocturnal") { if ((f.turn || 0) <= 1) m *= 1 + (isTough(f) || isBig(f) ? 0 : n.first); if (sg >= 3 && dark(f)) m *= 1 + n.dark; }
    if (p === "hircine") { if (isBeast(f)) m *= 1 + n.beast; if (sg >= 3 && f.hp < maxHp(s) / 2) m *= 1 + n.low; }
    if (p === "boethiah") { if (alone(f)) m *= 1 + n.alone; else if (sg >= 3) m *= 1 - n.curse; if (sg >= 3 && isMan(f)) m *= 1 + n.man; }
    if (p === "meridia" && isUndead(f)) m *= 1 + n.undead;
    return m;
  }
  function inMult(f) {
    const s = f.s, p = s && bound(s); if (!p) return 1;
    const sg = stage(s, p), n = nums(s, p, sg); let m = 1;
    if (p === "dagon" && sg >= 3) m *= 1 + n.curse;
    if (p === "azura" && sg >= 2 && night(f)) m *= 1 - n.night;
    if (p === "nocturnal" && sg >= 2) m *= 1 - (night(f) ? n.nguard : n.guard);
    if (p === "meridia" && sg >= 3 && (isUndead(f) || isDaedra(f))) m *= 1 - n.ward;
    return m;
  }
  /* once a round (CURSE.tick, from POWERS.tick) */
  function tick(f, line) {
    const s = f.s, p = s && bound(s); if (!p || f.hp <= 0) return;
    const sg = stage(s, p), n = nums(s, p, sg), add = (t) => { if (line) line.me = (line.me || "") + " · " + t; };
    if (p === "dagon" && sg >= 2 && f.ehp > 0) { f.ehp -= n.burn; add(T("the Cinder smoulders ({n})", { n: n.burn })); }
    if (p === "azura") {
      f.sp = Math.min(G.maxStamina(s), (f.sp || 0) + n.regen * G.maxStamina(s)); f.mp = Math.min(G.maxMagicka(s), (f.mp || 0) + n.regen * G.maxMagicka(s));
      if (sg >= 3 && !f._dbgSaved && f.hp < maxHp(s) / 4) { f._dbgSaved = true; const h = Math.round(n.save * maxHp(s)); f.hp = Math.min(maxHp(s), f.hp + h); add(T("Twilight's Grace heals you (+{n})", { n: h })); }
    }
    if (p === "hircine" && sg >= 2 && f.ehp > 0 && f.ehp < foeMax(f) / 2) { const h = Math.max(1, Math.round(n.heal * maxHp(s))); if (f.hp < maxHp(s)) { f.hp = Math.min(maxHp(s), f.hp + h); add(T("blood scent (+{n})", { n: h })); } }
    if (p === "boethiah" && sg >= 2) { if (f._dbgLast != null && f.hp < f._dbgLast) f.sp = Math.min(G.maxStamina(s), (f.sp || 0) + n.steel * G.maxStamina(s)); f._dbgLast = f.hp; }
    if (p === "meridia" && sg >= 2 && f.ehp > 0) { const d = n.light * (isUndead(f) ? 2 : 1); f.ehp -= d; add(T("Meridia's light burns ({n})", { n: d })); }
  }
  /* after a fight: deeds, the Eye's gold */
  function after(f) {
    const s = f.s, out = []; if (!s || !f.won || f.escaped) return out;
    const c = ctxOf(f);
    deed(s, "win", c, out);
    const p = bound(s);
    if (p === "nocturnal" && stage(s, p) >= 3) { const g = nums(s, p).gold; s.gold = (s.gold || 0) + g; out.push(T("The Eye of Nocturnal finds you {n} gold.", { n: g })); }
    return out;
  }

  // ---------------------------------------------------------------- deeds: contracts and the bound artifact
  function deed(s, kind, c = {}, out = []) {
    const b = peek(s); if (!b) return out;
    if (vowed(s)) return out;
    const m = deedMult(s);
    const k = b.c;
    if (k && PR[k.p]) {
      const step = PR[k.p].steps[k.step];
      if (step && step[2](kind, c)) {
        k.n = (k.n || 0) + m;
        if (k.n + 1e-9 >= step[1]) {
          k.step++; k.n = 0;
          if (k.step >= PR[k.p].steps.length) out.push(finish(s, k.p));
          else out.push(T("{prince} is pleased. Next: {what}", { prince: T(PR[k.p].prince), what: T(PR[k.p].steps[k.step][0]) }));
        }
      }
    }
    const p = bound(s);
    if (p) {
      const pts = PR[p].deed(kind, c);
      if (pts > 0) {
        const a = b.arts[p], s0 = stage(s, p), r0 = ready(s, p);
        a.deeds = (a.deeds || 0) + pts * m;
        if (stage(s, p) > s0) out.push(T("The {art} awakens. A new power stirs in it.", { art: T(PR[p].art) }));
        if (!r0 && ready(s, p)) out.push(T("The {art} could ascend. Accept or refuse its curse under Character, Daedric bargains.", { art: T(PR[p].art) }));
      }
    }
    return out;
  }
  function finish(s, p) {
    const b = st(s);
    b.c = null; b.offAt = nowS();
    if (!b.done.includes(p)) b.done.push(p);
    b.arts[p] = b.arts[p] || { deeds: 0, at: nowS() };
    if (!bound(s)) b.bound = p;
    return T("The contract is done. {prince} keeps the bargain: the {art} is yours (see Character, Daedric bargains).", { prince: T(PR[p].prince), art: T(PR[p].art) });
  }

  // ---------------------------------------------------------------- what you do with them
  function offer(s, p) {   // take a prince's contract
    const b = st(s);
    if (!PR[p]) return T("No prince answers.");
    if (vowed(s)) return T("You swore the Vow of Cleansing: the princes have turned away from you.");
    if (b.c) return T("You already serve {prince}. Finish or break that contract first.", { prince: T(PR[b.c.p].prince) });
    if (artOf(s, p)) return T("{prince} has already paid you.", { prince: T(PR[p].prince) });
    b.c = { p, step: 0, n: 0, at: nowS() };
    return T("You accept {prince}'s contract, {name}. First: {what}", { prince: T(PR[p].prince), name: T(PR[p].contract), what: T(PR[p].steps[0][0]) });
  }
  function breakIt(s) {
    const b = peek(s); if (!b?.c) return T("You serve no prince.");
    const p = b.c.p; b.c = null; b.offAt = nowS();
    return T("You turn your back on {prince}. The shrines will be silent for a while.", { prince: T(PR[p].prince) });
  }
  function bind(s, p) {
    if (!artOf(s, p)) return T("You don't have that artifact.");
    st(s).bound = p;
    return T("You bind the {art} to you. Its powers are yours now, and only its prince's deeds will wake it.", { art: T(PR[p].art) });
  }
  function ascend(s, p) {
    const a = artOf(s, p); if (!a) return T("You don't have that artifact.");
    if (vowed(s)) return T("You swore the Vow of Cleansing: the princes have turned away from you.");
    if (!ready(s, p)) return T("The {art} isn't ready yet.", { art: T(PR[p].art) });
    a.asc = true; a.refused = false;
    let mark = "";
    if (typeof AFFL !== "undefined") {
      if (marked(s)) { s.affl.daedric.deeds = (s.affl.daedric.deeds || 0) + 6; mark = " " + T("The Daedric Mark on your skin burns darker."); }
      else { const m = AFFL.give && AFFL.give(s, "daedric"); if (m) mark = " " + T("A black sigil burns into your skin: you carry the Daedric Mark now."); }
    }
    const c = powers(s, p).curse;
    return T("You accept the curse. The {art} is Ascendant: {power}", { art: T(PR[p].art), power: powers(s, p).pow[2] }) + " " + T("Curse: {name}. {what}", { name: c[0], what: c[1] }) + mark;
  }
  function refuse(s, p) {
    const a = artOf(s, p); if (!a) return T("You don't have that artifact.");
    a.refused = true;
    return T("You refuse the curse. The {art} stays Awakened. You can change your mind later.", { art: T(PR[p].art) });
  }
  function sleep(s, p) {
    const a = artOf(s, p); if (!a || !a.asc) return T("It isn't Ascendant.");
    a.asc = false; a.refused = true;
    return T("You let the {art} sleep. It is Awakened again and its curse is gone.", { art: T(PR[p].art) });
  }

  // ---------------------------------------------------------------- the road: a shrine with an offer
  const candidates = (s) => IDS.filter((p) => !artOf(s, p) && !(peek(s)?.c?.p === p));
  function canOffer(s, t = nowS()) {
    const b = peek(s);
    return (s.level || 1) >= MIN_LEVEL && !vowed(s) && !b?.c && candidates(s).length > 0 && t - (b?.offAt || 0) >= OFFER_CD;
  }
  const EV_ID = "dbg_shrine";
  function makeEvent(s, pick) {
    const c = candidates(s), p = PR[pick] ? pick : c[Math.floor(Math.random() * c.length)];
    return { id: EV_ID, title: T("A Daedric shrine"), p, text: T(PR[p].whisper), dbg: true };
  }
  function rollEvent(s) { return canOffer(s) && Math.random() < SHRINE * (marked(s) ? 2 : 1) ? makeEvent(s) : null; }
  const isOurs = (e) => !!(e && e.id === EV_ID);
  function evChoices(e) { return [["accept", T("Accept {prince}'s contract", { prince: T(PR[e.p]?.prince || "") })], ["leave", T("Walk on")]]; }
  function evChoose(s, e, c) {
    if (c !== "accept" || !PR[e.p]) { st(s).offAt = nowS(); return { text: T("You leave the shrine and its whispers behind.") }; }
    return { text: offer(s, e.p) };
  }

  // ---------------------------------------------------------------- hooks
  function hookSkills() {   // pockets and locks: G.useSkill with real XP (a broken pick gives 0.25)
    if (typeof G === "undefined" || !G.useSkill || G.useSkill.__dbg) return;
    const u0 = G.useSkill;
    G.useSkill = function (s, name, xp) {
      const r = u0.apply(this, arguments);
      try {
        if (s && peek(s) && (xp || 0) >= 1 && (name === "Pickpocket" || name === "Lockpicking")) {
          const m = deed(s, name === "Pickpocket" ? "steal" : "lock", {}, []);
          if (m.length && Array.isArray(r)) r.push(...m);
        }
      } catch (e) { /* never break a skill */ }
      return r;
    };
    G.useSkill.__dbg = true;
  }
  function install() {
    if (typeof CURSE !== "undefined" && !CURSE.__dbg) {
      const dm = CURSE.dmgMult, di = CURSE.dmgInMult, tk = CURSE.tick, af = CURSE.after, fx0 = CURSE.fx;
      CURSE.dmgMult = (f) => dm(f) * outMult(f);
      CURSE.dmgInMult = (f) => di(f) * inMult(f);
      CURSE.tick = (f, line) => { if (tk) tk(f, line); tick(f, line); };
      CURSE.after = (f) => [...(af ? af(f) : []), ...after(f)];
      if (fx0) CURSE.fx = (s, key, t) => { const v = fx0(s, key, t); return key === "skill:Sneak" && bound(s) === "meridia" && stage(s, "meridia") >= 3 ? v - nums(s, "meridia").curse : v; };
      CURSE.__dbg = true;
    }
    if (typeof POTFX !== "undefined" && !POTFX.__dbg) {
      const d0 = POTFX.drink, r0 = POTFX.roadDrink;
      if (d0) POTFX.drink = (f, res, amt, name) => d0(f, res, res === "health" ? amt * potionMult(f.s) : amt, name);
      if (r0) POTFX.roadDrink = (s, res, amt, name, t) => r0(s, res, res === "health" ? amt * potionMult(s) : amt, name, t);
      POTFX.__dbg = true;
    }
    if (typeof BEASTPATH !== "undefined" && BEASTPATH.priceMult && !BEASTPATH.__dbg) {
      const p0 = BEASTPATH.priceMult;
      BEASTPATH.priceMult = (s, town) => p0(s, town) * priceMult(s);
      BEASTPATH.__dbg = true;
    }
    if (typeof DUNGEONS !== "undefined" && DUNGEONS.act && !DUNGEONS.__dbg) {
      const a0 = DUNGEONS.act;
      DUNGEONS.act = function (s, ...rest) {
        const d0 = s && s.dungeon, was = d0 && s.cleared ? s.cleared[d0.place] : undefined, r = a0.call(this, s, ...rest);
        try {
          if (d0 && peek(s) && s.cleared && s.cleared[d0.place] != null && s.cleared[d0.place] !== was) {
            const m = deed(s, "clear", { barrow: d0.theme === "barrow", theme: d0.theme, tier: d0.tier }, []);
            if (m.length && r && typeof r.text === "string") r.text += " " + m.join(" ");
          }
        } catch (e) { /* never break a dungeon */ }
        return r;
      };
      DUNGEONS.__dbg = true;
    }
    if (typeof ROAD_EVENTS !== "undefined" && !ROAD_EVENTS.__dbg) {
      const base = { roll: ROAD_EVENTS.roll, choices: ROAD_EVENTS.choices, choose: ROAD_EVENTS.choose };
      ROAD_EVENTS.roll = (s) => { let e = null; try { e = rollEvent(s); } catch (err) { e = null; } return e || base.roll(s); };
      ROAD_EVENTS.choices = (e, s) => (isOurs(e) ? evChoices(e, s) : base.choices(e, s));
      ROAD_EVENTS.choose = (s, e, c) => (isOurs(e) ? evChoose(s, e, c) : base.choose(s, e, c));
      ROAD_EVENTS.__dbg = true;
    }
    if (typeof EVENTART !== "undefined") {   // the painted black shrine, the drawn shrine as the fallback
      if (EVENTART.PAINTED && !EVENTART.PAINTED.road[EV_ID]) EVENTART.PAINTED.road[EV_ID] = "gev-black-shrine";
      if (EVENTART.ROAD && !EVENTART.ROAD[EV_ID]) EVENTART.ROAD[EV_ID] = (g, H, w, h, ev) => (EVENTART.ROAD.aff_black_shrine || EVENTART.ROAD.shrine || EVENTART.ROAD.daedra || (() => {}))(g, H, w, h, ev || {});
    }
    hookSkills();
    if (typeof I18N !== "undefined" && I18N.add && typeof I18N_BARG !== "undefined") I18N.add(I18N_BARG.tpl, I18N_BARG.words);
  }
  const potionMult = (s) => (bound(s) === "hircine" && stage(s, "hircine") >= 3 ? 1 - nums(s, "hircine").curse : 1);
  const priceMult = (s) => (bound(s) === "nocturnal" && stage(s, "nocturnal") >= 3 ? 1 + nums(s, "nocturnal").curse : 1);

  // ---------------------------------------------------------------- the Character screen (SkyUI-style cards)
  const SV = (d) => `<svg class="dbg-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const GLYPH = {
    dagon: '<path d="M7 8h10l-1 11H8z"/><path d="M9 8V5M12 8V4M15 8V5M8 13h8"/><path d="M12 17c-1.6-1-1.6-2.6 0-4 1.6 1.4 1.6 3 0 4z"/>',
    azura: '<path d="M15.5 4a7.5 7.5 0 1 0 4.5 13.5A6 6 0 0 1 15.5 4z"/><path d="M7 4l.6 1.6L9 6.2l-1.4.6L7 8.4l-.6-1.6L5 6.2l1.4-.6z"/>',
    nocturnal: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/><path d="M12 6V3M8 7 6.5 4.5M16 7l1.5-2.5"/>',
    hircine: '<path d="M12 21v-8M12 13c-3 0-5-2-5-6M7 7 4 4M7 7V3M12 13c3 0 5-2 5-6M17 7l3-3M17 7V3"/><path d="M9.5 21h5"/>',
    boethiah: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    meridia: '<path d="M9 5h6M10 5V3h4v2M8 7h8l-1 11H9z"/><path d="M12 15c-1.4-.8-1.4-2.4 0-3.6 1.4 1.2 1.4 2.8 0 3.6zM9 21h6"/>',
  };
  const glyph = (p) => SV(GLYPH[p] || GLYPH.dagon);
  /* the artifact's painted icon (art-<prince>, assets.js) once it has loaded, else the line glyph */
  const artIcon = (p, cls = "") => { let u = ""; try { u = typeof ASSETS !== "undefined" && PR[p] ? ASSETS.url("art-" + p) : ""; } catch { u = ""; }
    return u ? `<img class="dbg-art${cls ? " " + cls : ""}" src="${u}" alt="${esc(T(PR[p].art))}" loading="lazy">` : glyph(p); };
  function track(sg, rdy) {
    return `<ol class="dbg-track">${STAGES.map((x, i) => `<li class="${i + 1 < sg ? "past" : i + 1 === sg ? "now" : i === 2 && rdy ? "ready" : ""}"><i></i><span>${esc(T(x))}</span></li>`).join("")}</ol>`;
  }
  function contractCard(s) {
    const k = peek(s)?.c; if (!k || !PR[k.p]) return "";
    const d = PR[k.p];
    const rows = d.steps.map(([what, n], i) => {
      const cls = i < k.step ? "done" : i === k.step ? "now" : "";
      const prog = i < k.step ? T("done") : i === k.step ? `${Math.floor(k.n || 0)}/${n}` : `0/${n}`;
      return `<li class="${cls}"><span>${esc(T(what))}</span><b>${esc(prog)}</b></li>`;
    }).join("");
    return `<div class="dbg-card dbg-con" style="--dbc:${d.color}"><div class="dbg-head">${glyph(k.p)}<div class="t">${esc(T(d.contract))}<span>${esc(T("Contract with {prince}", { prince: T(d.prince) }))}</span></div></div>
      <ul class="dbg-steps">${rows}</ul>
      <div class="dbg-reward">${artIcon(k.p, "sm")}<p class="sub">${esc(T("Reward: {art}. {desc}", { art: T(d.art), desc: T(d.desc) }))}</p></div>
      <div class="dbg-btns"><button class="btn sm" data-act="dbgbreak">${esc(T("Break the contract"))}</button></div></div>`;
  }
  function artCard(s, p) {
    const d = PR[p], a = artOf(s, p), sg = stage(s, p), rdy = ready(s, p), isB = bound(s) === p, pw = powers(s, p);
    const dd = a.deeds || 0, need = d.need, prev = sg >= 2 ? need[0] : 0, next = sg === 1 ? need[0] : need[1];
    const bar = sg >= 3 || rdy ? 1 : (dd - prev) / Math.max(1, next - prev);
    const lines = pw.pow.map((x, i) => `<li class="${i < sg ? "on" : "off"}"><em>${esc(T(STAGES[i]))}</em> ${esc(x)}</li>`).join("");
    const curse = `<li class="dbg-curse ${sg >= 3 ? "on" : "off"}"><em>${esc(T("Curse"))}</em> ${esc(pw.curse[0])}: ${esc(pw.curse[1])}</li>`;
    const nextTxt = sg >= 3 ? T("Ascendant. Its curse is on you.") : rdy ? (a.refused ? T("You refused its curse. It stays Awakened until you accept.") : T("Ready to ascend, if you accept its curse."))
      : T("Next stage: {a} of {b} deeds.", { a: Math.floor(dd), b: next });
    let btns = isB ? `<span class="dbg-bound">${esc(T("Bound"))}</span>` : `<button class="btn sm" data-act="dbgbind" data-id="${p}">${esc(T("Bind this one"))}</button>`;
    if (rdy) btns += `<button class="btn sm dbg-asc" data-act="dbgasc" data-id="${p}">${esc(T("Accept the curse and ascend"))}</button>${a.refused ? "" : `<button class="btn sm" data-act="dbgref" data-id="${p}">${esc(T("Refuse"))}</button>`}`;
    if (sg >= 3) btns += `<button class="btn sm" data-act="dbgsleep" data-id="${p}">${esc(T("Let it sleep"))}</button>`;
    return `<div class="dbg-card${isB ? " dbg-on" : ""}${rdy ? " dbg-rdy" : ""}" style="--dbc:${d.color}"><div class="dbg-head">${artIcon(p)}<div class="t">${esc(T(d.art))}<span>${esc(T(d.prince))} · ${esc(T(STAGES[sg - 1]))}</span></div></div>
      ${track(sg, rdy)}<div class="bar dbg-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, bar)))}%"></i></div>
      <ul class="dbg-pow">${lines}${curse}</ul>
      <p class="sub">${esc(T(d.grow))} ${esc(nextTxt)}${isB ? "" : " " + esc(T("Only the bound artifact grows and works."))}</p>
      <div class="dbg-btns">${btns}</div></div>`;
  }
  function princeChips(s) {
    const b = peek(s);
    return `<div class="dbg-chips">${IDS.map((p) => { const have = artOf(s, p), now = b?.c?.p === p; return `<span class="dbg-chip${have ? " have" : now ? " now" : ""}" style="--dbc:${PR[p].color}">${glyph(p)}<b>${esc(T(PR[p].prince))}</b><small>${esc(T(PR[p].theme))}</small></span>`; }).join("")}</div>`;
  }
  function panel(s) {
    if (!s || (s.level || 1) < MIN_LEVEL && !peek(s)) return "";
    const b = peek(s), arts = owned(s), p0 = bound(s);
    const order = arts.sort((x, y) => (x === p0 ? -1 : y === p0 ? 1 : 0));
    const intro = T("Princes make offers at black shrines along the roads. Finish a contract and its artifact is yours. Bind one artifact at a time: it wakes as you do the deeds its prince likes.");
    const mk = marked(s) ? `<p class="sub dbg-mark">${esc(vowed(s) ? T("You swore the Vow of Cleansing: no prince will deal with you, and your artifact has stopped growing.") : T("You carry the Daedric Mark: shrines call twice as often and your deeds count a quarter more."))}</p>` : "";
    const body = `<p class="sub">${esc(intro)}</p>${mk}${princeChips(s)}<div class="dbg-grid">${contractCard(s)}${order.map((p) => artCard(s, p)).join("")}</div>`
      + (!b?.c && !arts.length ? `<p class="sub">${esc(T("No contract yet. Keep an eye out for a black shrine on your travels."))}</p>` : "");
    const fold = typeof MENUS2 !== "undefined" && MENUS2.fold ? MENUS2.fold : (fid, title, html) => `<div class="panel"><h2>${title}</h2>${html}</div>`;
    const note = p0 ? `${T(PR[p0].art)} · ${T(STAGES[stage(s, p0) - 1])}` : b?.c ? T(PR[b.c.p].contract) : "";
    return fold("bargains", esc(T("Daedric bargains")), body, esc(note));
  }
  function act(s, b, c) {
    const a = b.dataset.act, p = b.dataset.id;
    const m = a === "dbgbreak" ? breakIt(s) : a === "dbgbind" ? bind(s, p) : a === "dbgasc" ? ascend(s, p) : a === "dbgref" ? refuse(s, p) : a === "dbgsleep" ? sleep(s, p) : null;
    if (m != null && a === "dbgasc" && c && c.show) c.show(T("Ascendant"), m);
    else if (m != null && c && c.say) c.say(m);
    return m;
  }
  /* the party card: your bound artifact and its stage ("dagon:3") */
  const cardBits = (s) => { const p = bound(s); return p ? { dbg: `${p}:${stage(s, p)}` } : {}; };

  install();
  return { PR, IDS, STAGES, MIN_LEVEL, SHRINE, EV_ID, stage, ready, bound, owned, artOf, nums, powers, deedMult, powMult, curseMult,
    outMult, inMult, tick, after, deed, offer, breakIt, bind, ascend, refuse, sleep, finish, canOffer, makeEvent, rollEvent, evChoices, evChoose,
    potionMult, priceMult, panel, act, cardBits, ctxOf, install, glyph, artIcon };
})();
