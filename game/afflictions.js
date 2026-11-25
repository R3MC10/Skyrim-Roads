/* Afflictions as progression [OURS]. One shared system for the dark gifts you can carry:
   - Lycanthropy and Vampirism already live in curses.js / beastpaths.js / dawnguard.js. This file does not change them:
     it only reads them (s.werewolf, s.vampire, feeds, hunger) so they show with the others, count as a stage, reach the
     party and the road events. Their ids, perks and cure quests are untouched.
   - Three new ones, each with a real upside, a real downside, a way in and a way out:
       Draugr Curse     (deep barrows: a tier-3 barrow's throne room, levels IV-V of a deep barrow, the Cursed Sanctuary)
                        + frost hurts less, you see in the dark of dungeons (more damage there, better sneaking)
                        - potions heal less, shops charge more.        Cure: a priest of Arkay at a temple, for gold.
       Daedric Mark     (a black shrine by the road; you choose to touch it)
                        + more damage to daedra, a favour from your prince once a week
                        - bad luck: a lost purse, a scamp out of nowhere, a stumble at the start of a fight.
                        Cure: the Vow of Cleansing (taken at a temple): slay three daedra.
       Dwemer Resonance (clearing Dwemer ruins)
                        + shock spells and blows against Dwarven machines hit harder, machines hit you softer
                        - outside the ruins your magicka bleeds away every round (worse under the sun), and comes back slower.
                        Cure: a rare ingredient, two Void Salts (court wizards sell them).
   - Stages 1-3 grow with deeds (undead slain and barrows cleared, daedra slain and favours, machines broken and ruins
     cleared). Werewolves grow with feeds; a vampire's stage is the hunger from curses.js.
   - Fights: everything goes through hooks that both the instant fight (engine.js) and turn-by-turn fights (tbfight.js,
     which plays a G.Fight) call: CURSE.dmgMult / dmgInMult / tick / after, POTFX.drink, MAGIC.elem while you cast.
   - Party: your card carries your afflictions; party mates see them on the Party screen and feel a little of them in a
     shared fight (a werewolf's pack sense, the barrow chill, the Dwemer hum, the mark's pull on daedra).
   - Perks (perkfx.js): Embrace the Curse (upsides 50% stronger), Warding Rites (downsides 40% weaker).
   Numbers tuned with tests/test_afflictions.js (an afflicted hero is not strictly stronger). */
const AFFL = (() => {
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const DAY = 2 * 3600, WEEK = 7 * DAY;            // one game day = 2 real hours (curses.js)
  const NEED = [0, 6, 18];                         // deeds for stage 1, 2, 3
  const MAX_NEW = 2;                               // at most two of the new afflictions at once
  const IDS = ["draugr", "daedric", "dwemer"], ALL = ["wolf", "vamp", ...IDS];
  const fill = (en, v) => (v ? en.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : en);
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : fill(en, v));
  const esc = (t) => String(t ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  const pct = (x) => Math.round(x * 100);
  const at = (a, st) => a[Math.max(0, Math.min(a.length - 1, st - 1))];
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);

  const DEF = {
    wolf: { icon: "", name: "Lycanthropy", color: "#8a7a62", grow: "Grows each time you feed after a fight in Beast Form." },
    vamp: { icon: "", name: "Vampirism", color: "#9a2030", grow: "Its stage is your hunger: one step for every in-game day you go unfed." },
    draugr: { icon: "", name: "Draugr Curse", color: "#6f9fb8", how: "The cold of the deepest barrows got into your bones.",
      grow: "Grows as you put the dead back to rest and clear barrows.", cure: "A priest of Arkay can lift it at any temple, for gold." },
    daedric: { icon: "", name: "Daedric Mark", color: "#b0303a", how: "You laid your hand on a black shrine and a prince took notice.",
      grow: "Grows as you slay daedra and take your prince's favours.", cure: "Take the Vow of Cleansing at a temple, then slay three daedra." },
    dwemer: { icon: "", name: "Dwemer Resonance", color: "#c0903e", how: "The hum of the old machines got into your head and stayed.",
      grow: "Grows as you break Dwarven machines and clear Dwemer ruins.", cure: "Grind two Void Salts into water and drink it. Court wizards sell them." },
  };
  const STAGE_NAME = ["Faint", "Deep-rooted", "Consuming"];
  const TEMPLES = { Whiterun: "the Temple of Kynareth", Riften: "the Temple of Mara", Solitude: "the Temple of the Divines", Markarth: "the Temple of Dibella", Windhelm: "the Temple of Talos", Falkreath: "the Hall of the Dead" };
  const CURE_GOLD = [300, 600, 1000];

  // ---------------------------------------------------------------- state
  const A = (s) => (s.affl = s.affl || {});
  const has = (s, id) => (id === "wolf" ? !!s.werewolf : id === "vamp" ? !!s.vampire : !!s.affl?.[id]);
  const list = (s) => ALL.filter((id) => has(s, id));
  const newCount = (s) => IDS.filter((id) => s.affl?.[id]).length;
  const feeds = (s) => s.beastPerks?.feeds || 0;
  const deeds = (s, id) => (id === "wolf" ? feeds(s) : s.affl?.[id]?.deeds || 0);
  const WOLF_NEED = [0, 4, 12];
  function stage(s, id) {
    if (!has(s, id)) return 0;
    if (id === "vamp") return typeof CURSE !== "undefined" ? CURSE.stage(s) : 1;   // hunger 1-4
    const need = id === "wolf" ? WOLF_NEED : NEED, d = deeds(s, id);
    return need.filter((x) => d >= x).length;
  }
  const nextAt = (s, id) => (id === "vamp" ? null : (id === "wolf" ? WOLF_NEED : NEED).find((x) => x > deeds(s, id)) ?? null);
  /* Embrace the Curse / Warding Rites (perkfx.js) */
  const up = (s) => 1 + Math.min(0.5, pfx(s, "affup"));
  const down = (s) => 1 - Math.min(0.6, pfx(s, "affdown"));

  /* every number an affliction has at a stage, after perks */
  function nums(s, id, st = stage(s, id)) {
    const U = up(s), Dn = down(s);
    if (id === "draugr") return { frost: Math.min(0.5, at([0.15, 0.25, 0.35], st) * U), dun: at([0.05, 0.08, 0.12], st) * U, sneak: Math.round(at([5, 10, 15], st) * U),
      potion: at([0.12, 0.2, 0.28], st) * Dn, price: at([0.05, 0.1, 0.15], st) * Dn };
    if (id === "daedric") return { dae: at([0.1, 0.15, 0.2], st) * U, favour: Math.round(at([150, 250, 400], st) * U),
      luck: at([0.1, 0.15, 0.2], st) * Dn, omen: at([0.08, 0.12, 0.16], st) * Dn };
    if (id === "dwemer") return { shock: at([0.1, 0.15, 0.2], st) * U, cOut: at([0.1, 0.15, 0.2], st) * U, cIn: Math.min(0.4, at([0.06, 0.1, 0.14], st) * U),
      sun: at([0.03, 0.04, 0.05], st) * Dn, drain: at([0.015, 0.02, 0.025], st) * Dn, regen: Math.round(at([15, 25, 35], st) * Dn) };
    return {};
  }

  /* what each one does, in plain words, for the Character screen: [[up...], [down...]] */
  function lines(s, id) {
    const st = stage(s, id), n = nums(s, id, st);
    if (id === "draugr") return [[T("Frost hurts you {n}% less.", { n: pct(n.frost) }), T("You see in the dark of dungeons: {n}% more damage there and +{k} Sneak.", { n: pct(n.dun), k: n.sneak })],
      [T("Potions heal you {n}% less.", { n: pct(n.potion) }), T("Shops charge you {n}% more: they don't like the grave smell.", { n: pct(n.price) })]];
    if (id === "daedric") return [[T("Daedra take {n}% more damage from you.", { n: pct(n.dae) }), T("Once a week your prince grants a favour (about {n} gold's worth).", { n: n.favour })],
      [T("Bad luck follows you on the road ({n}% of road events go wrong).", { n: pct(n.luck) }), T("A {n}% chance to stumble at the start of a fight and lose a quarter of your stamina.", { n: pct(n.omen) })]];
    if (id === "dwemer") return [[T("Shock spells hit {n}% harder.", { n: pct(n.shock) }), T("Dwarven machines take {n}% more damage from you and hit you {k}% softer.", { n: pct(n.cOut), k: pct(n.cIn) })],
      [T("Outside Dwemer ruins you lose {n}% of your magicka every round of a fight ({k}% under the open sun).", { n: (n.drain * 100).toFixed(1).replace(/\.0$/, ""), k: pct(n.sun) }), T("Outside the ruins your magicka comes back {n}% slower.", { n: n.regen })]];
    if (id === "wolf") return [[T("Beast Form once a day: you hit much harder and shrug off blows."), T("You can't catch diseases.")],
      [T("Beds no longer make you Rested."), T("No potions while you're changed, and silver bites harder.")]];
    if (id === "vamp") return [[T("Destruction and Illusion grow stronger with your hunger, and so do your night-time blows."), T("Frost and poison barely touch you.")],
      [T("Fire burns you more, and the sun slows your healing outside."), T("Starving, shops bar their doors.")]];
    return [[], []];
  }

  // ---------------------------------------------------------------- catching and curing
  /* give an affliction (no-op if you have it, or already carry two of the new ones) */
  function give(s, id, t = nowS()) {
    if (!IDS.includes(id) || has(s, id) || newCount(s) >= MAX_NEW) return null;
    A(s)[id] = { at: t, deeds: 0 };
    if (typeof G !== "undefined" && G.note) G.note(s, ` ${DEF[id].icon} ${T(DEF[id].name)}`);
    const why = { draugr: "A cold that isn't the barrow's settles in your chest and doesn't leave. You carry the Draugr Curse now (see Character).",
      daedric: "The altar burns cold under your palm. When you pull it away, a black sigil is left on your skin. You carry a Daedric Mark now (see Character).",
      dwemer: "Your teeth start to hum along with the old machines, and the hum doesn't stop when you leave. You carry the Dwemer Resonance now (see Character)." }[id];
    return `${DEF[id].icon} ${T(why)}`;
  }
  /* a chance to catch it; Wolfsbane, Bosmer and Argonian blood and Hevnoraak keep it off */
  function roll(s, id, p) {
    if (has(s, id) || newCount(s) >= MAX_NEW) return null;
    if (id === "draugr" && typeof PRIESTS !== "undefined" && PRIESTS.immune && PRIESTS.immune(s)) return null;
    p *= 1 - Math.min(0.75, pfx(s, "curseres"));
    return Math.random() < p ? give(s, id) : null;
  }
  function cure(s, id) {
    if (!s.affl?.[id]) return null;
    delete s.affl[id];
    s.afflCured = { ...(s.afflCured || {}), [id]: (s.afflCured?.[id] || 0) + 1 };
    return T({ draugr: "The priest's prayer to Arkay is long and the incense is thick. The cold drains out of your bones. The Draugr Curse is gone.",
      daedric: "The third daedra falls and the sigil on your skin flakes away like ash. The Daedric Mark is gone.",
      dwemer: "The salts fizz and taste of lightning. The hum in your skull winds down and stops. The Dwemer Resonance is gone." }[id]);
  }
  const templeAt = (s) => (s.location && TEMPLES[s.location]) || null;
  const cureCost = (s) => at(CURE_GOLD, stage(s, "draugr"));
  const salts = (s) => (s.inv || []).filter((r) => r.item === "ing_void_salts").reduce((a, r) => a + (r.qty || 1), 0);
  function priestCure(s) {
    if (!s.affl?.draugr) return T("You don't carry the Draugr Curse.");
    const tp = templeAt(s); if (!tp) return T("Find a temple first: Whiterun, Riften, Solitude, Markarth, Windhelm or Falkreath.");
    const g = cureCost(s); if ((s.gold || 0) < g) return T("The priest asks for {n} gold for the rites.", { n: g });
    s.gold -= g; return cure(s, "draugr");
  }
  function takeVow(s) {
    const a = s.affl?.daedric; if (!a) return T("You don't carry a Daedric Mark.");
    if (a.vow != null) return T("You've already sworn the vow.");
    if (!templeAt(s)) return T("Find a temple first: Whiterun, Riften, Solitude, Markarth, Windhelm or Falkreath.");
    a.vow = 0; return T("You kneel before the priests and swear to slay three daedra in the Divines' name. Your prince's favours stop until you break free.");
  }
  function drinkSalts(s) {
    if (!s.affl?.dwemer) return T("You don't carry the Dwemer Resonance.");
    if (salts(s) < 2) return T("You need two Void Salts. Court wizards sell them.");
    for (let k = 0; k < 2; k++) { const r = s.inv.find((x) => x.item === "ing_void_salts"); if (r) G.take(s, r.id, 1); }
    return cure(s, "dwemer");
  }
  /* the Daedric Mark's favour: once a week */
  const favourLeft = (s, t = nowS()) => { const a = s.affl?.daedric; return a ? Math.max(0, (a.favourAt || 0) + WEEK - t) : 0; };
  function favour(s, t = nowS()) {
    const a = s.affl?.daedric; if (!a) return T("You don't carry a Daedric Mark.");
    if (a.vow != null) return T("You swore the Vow of Cleansing: your prince has turned away from you.");
    const left = favourLeft(s, t); if (left > 0) return T("Your prince is silent. Ask again in {n} hours.", { n: Math.ceil(left / 3600) });
    a.favourAt = t; a.deeds = (a.deeds || 0) + 1;
    const n = nums(s, "daedric"), r = Math.random();
    if (r < 0.5) { s.gold = (s.gold || 0) + n.favour; return T("A voice like grinding stone: \"Take it, mortal.\" A purse of {n} gold lies at your feet.", { n: n.favour }); }
    if (r < 0.8) { G.give(s, "soul_gem_common", 1); G.give(s, "potion_health", 1); return T("You wake with a full soul gem and a red potion beside you, and no idea how they got there."); }
    s.fx = s.fx || []; s.fx.push({ key: "max:health", mag: 25 + 10 * stage(s, "daedric"), until: t + DAY, name: "Daedric favour" });
    return T("Something dark and strong pours into you. Your health is greater for a day.");
  }

  // ---------------------------------------------------------------- deeds and stages
  function addDeeds(s, id, k, out) {
    const a = s.affl?.[id]; if (!a || !k) return;
    const before = stage(s, id); a.deeds = (a.deeds || 0) + k;
    const st = stage(s, id);
    if (st > before && out) out.push(` ${DEF[id].icon} ${T("Your {name} grows: stage {st} ({label}).", { name: T(DEF[id].name), st, label: T(STAGE_NAME[st - 1]) })}`);
  }

  // ---------------------------------------------------------------- who is who in a fight
  const tagsOf = (f) => f.tags || new Set(f.e?.tags || []);
  const nameOf = (f) => f.e?.name || "";
  const isDaedra = (f) => tagsOf(f).has("daedra") || /atronach|dremora|daedr|scamp|seducer|mazken|aurorans?\b|xivilai|spider daedra/i.test(nameOf(f));
  const isConstruct = (f) => tagsOf(f).has("construct") || /dwarven|dwemer|centurion|sphere|automaton|ballista/i.test(nameOf(f));
  const isBeast = (f) => tagsOf(f).has("beast");
  const isUndead = (f) => tagsOf(f).has("undead") || /draugr|skeleton|wight|deathlord|lich|ghost|wraith/i.test(nameOf(f));
  function frostFoe(f) {
    if (typeof CURSE !== "undefined" && CURSE.incomingEl && CURSE.incomingEl(f) === "frost") return true;
    if (typeof PFX !== "undefined" && PFX.foeElement && f.e) { const x = PFX.foeElement(f.e); return !!(x && x.el === "frost" && x.ch > 0); }
    return false;
  }
  const inRuin = (s) => !!s.dungeon && (s.dungeon.theme === "dwemer" || /blackreach/i.test(s.dungeon.place || ""));
  const sunOut = (f) => typeof G !== "undefined" && !f.s.dungeon && !f.e?.indoor && !f.arena && !G.isNight(f.t ?? nowS());

  // ---------------------------------------------------------------- the party
  let ctx = null, testMates = null;
  function mount(c) { ctx = c; }
  const cardBits = (s) => ({ affl: list(s).map((id) => `${id}:${stage(s, id)}`) });
  const parse = (arr) => (Array.isArray(arr) ? arr.map((x) => String(x).split(":")).filter(([id]) => DEF[id]).map(([id, st]) => [id, +st || 1]) : []);
  /* afflictions your party mates carry: [[name, [[id, stage]...]]...] */
  function mates() {
    if (testMates) return testMates;
    if (!ctx) return [];
    try {
      const p = ctx.party?.(), me = ctx.S?.()?.id; if (!p?.members) return [];
      return p.members.filter((m) => m.id !== me).map((m) => [m.name, parse(ctx.cardOf?.(m.id)?.affl)]).filter(([, a]) => a.length);
    } catch (e) { return []; }
  }
  const setMates = (m) => { testMates = m; };
  /* the light touch on mates: only in a fight where another player stands with you */
  const AURA = { wolf: 0.05, draugr: 0.05, daedric: 0.05, dwemer: 0.05 };
  function aura(f) {
    if (!(f.allies || []).some((a) => a && a.player) && !testMates) return null;
    const set = new Set(); for (const [, a] of mates()) for (const [id] of a) set.add(id);
    return set.size ? set : null;
  }

  // ---------------------------------------------------------------- fight numbers
  function outMult(f) {
    const s = f.s; if (!s) return 1;
    let m = 1; const a = s.affl;
    if (a) {
      if (a.draugr && s.dungeon) m *= 1 + nums(s, "draugr").dun;
      if (a.daedric && isDaedra(f)) m *= 1 + nums(s, "daedric").dae;
      if (a.dwemer && isConstruct(f)) m *= 1 + nums(s, "dwemer").cOut;
    }
    const au = aura(f);
    if (au) { if (au.has("wolf") && isBeast(f)) m *= 1 + AURA.wolf; if (au.has("daedric") && isDaedra(f)) m *= 1 + AURA.daedric; }
    return m;
  }
  function inMult(f) {
    const s = f.s; if (!s) return 1;
    let m = 1; const a = s.affl;
    if (a) {
      if (a.draugr && frostFoe(f)) m *= 1 - nums(s, "draugr").frost;
      if (a.dwemer && isConstruct(f)) m *= 1 - nums(s, "dwemer").cIn;
    }
    const au = aura(f);
    if (au && au.has("draugr") && frostFoe(f)) m *= 1 - AURA.draugr;
    return m;
  }
  function shockMult(f) {
    let m = 1;
    if (f.s?.affl?.dwemer) m *= 1 + nums(f.s, "dwemer").shock;
    const au = aura(f); if (au && au.has("dwemer")) m *= 1 + AURA.dwemer;
    return m;
  }
  const potionMult = (s) => (s?.affl?.draugr ? 1 - nums(s, "draugr").potion : 1);
  /* once a round (CURSE.tick, from POWERS.tick) */
  function tick(f, line) {
    const s = f.s, a = s?.affl; if (!a) return;
    if (!f._afflT) {
      f._afflT = 1;
      if (a.daedric && Math.random() < nums(s, "daedric").omen) {
        const lost = Math.round(0.25 * G.maxStamina(s)); f.sp = Math.max(0, (f.sp || 0) - lost);
        if (line) line.me += T(" · bad omen: you stumble (−{n} stamina)", { n: lost });
      }
    }
    if (a.dwemer && !inRuin(s) && (f.mp || 0) > 0) {
      const n = nums(s, "dwemer"), d = Math.max(1, Math.round((sunOut(f) ? n.sun : n.drain) * G.maxMagicka(s)));
      f.mp = Math.max(0, f.mp - d);
      if (line) line.me += T(" · the hum drains {n} magicka", { n: d });
    }
  }
  /* after a fight you won: deeds, the vow, a barrow's cold */
  function after(f) {
    const out = [], s = f.s; if (!s || !f.won) return out;
    const a = s.affl || {};
    if (isUndead(f)) addDeeds(s, "draugr", 1, out);
    if (isConstruct(f)) addDeeds(s, "dwemer", 1, out);
    if (isDaedra(f)) {
      if (a.daedric && a.vow != null) { a.vow++; if (a.vow >= 3) out.push(" " + cure(s, "daedric")); else out.push(" " + T("The Vow of Cleansing: {n} of 3 daedra slain.", { n: a.vow })); }
      else addDeeds(s, "daedric", 1, out);
    }
    const d = s.dungeon;   // the deepest barrows: levels IV-V or the Cursed Sanctuary
    if (d && d.theme === "barrow" && isUndead(f) && ((d.deep?.level || 0) >= 4 || (d.mods || []).includes("cursed"))) { const m = roll(s, "draugr", 0.1); if (m) out.push(" " + m); }
    return out;
  }
  /* a dungeon's boss is down (DUNGEONS.act) */
  function onClear(s, d) {
    const out = [];
    if (d.theme === "barrow") {
      if (s.affl?.draugr) addDeeds(s, "draugr", 3, out);
      else { const p = (d.tier >= 3 ? 0.2 : 0) + ((d.deep?.level || 0) >= 4 ? 0.3 : 0) + ((d.mods || []).includes("cursed") ? 0.3 : 0); const m = p && roll(s, "draugr", Math.min(0.6, p)); if (m) out.push(m); }
    }
    if (d.theme === "dwemer") {
      if (s.affl?.dwemer) addDeeds(s, "dwemer", 3, out);
      else { const m = roll(s, "dwemer", [0, 0.1, 0.2, 0.3][d.tier || 1] || 0.1); if (m) out.push(m); }
    }
    return out.join(" ").trim();
  }

  // ---------------------------------------------------------------- the road
  const scamp = () => ({ name: "Scamp", health: 70, damage: 9, tags: ["daedra"], level: 6, danger: "medium", gold: [5, 25], text: "A scamp pops out of thin air, cackling, and goes for your purse." });
  const EV = {
    aff_black_shrine: {
      title: "A black shrine",
      make: () => ({ text: "Off the road, in a ring of standing stones, a black altar is crusted with old wax. A whisper you feel more than hear: \"Touch it. Be mine.\"" }),
      choices: () => [["touch", "Lay your hand on the altar"], ["leave", "Walk on"]],
      touch: (s) => { const m = give(s, "daedric"); if (!m) return { text: T("Nothing happens. Whatever lives here wants nothing from you.") }; s.gold = (s.gold || 0) + 100; return { text: `${m} ${T("A pouch of 100 gold lies on the altar now.")}` }; },
    },
    aff_dae_luck: {
      title: "Bad luck",
      make: (s) => { const k = Math.floor(Math.random() * 3); return { k, text: ["Your purse string snaps and coins roll away into the ditch.", "A pop and a smell of sulphur: something small and red has been following you.", "A crow lands on your shoulder, looks you in the eye and screams. Your legs feel like lead."][k] }; },
      choices: (e) => (e.k === 1 ? [["fight", "Fight it off"]] : [["endure", "Curse your luck"]]),
      endure: (s, e, t = nowS()) => {
        if (e.k === 0) { const lost = Math.min(s.gold || 0, Math.round(20 + Math.random() * 60)); s.gold -= lost; return { text: T("You scrabble in the mud but only find some of it (−{n} gold).", { n: lost }) }; }
        s.fx = s.fx || []; s.fx.push({ key: "carry", mag: -40, until: t + DAY / 2, name: "Ill omen" });
        return { text: T("An ill omen: you can carry 40 less for half a day."), delay: 30 };
      },
      fight: () => ({ text: T("The scamp lunges!"), foe: scamp(), enemyFirst: true }),
    },
    aff_dae_cultist: {
      title: "A worshipper",
      make: () => ({ text: "A hooded worshipper kneels in the road as you pass. \"The marked one! Bless me, I beg you.\"" }),
      choices: () => [["bless", "Lay a hand on their head"], ["leave", "Push past"]],
      bless: (s) => { const g = 30 + Math.round(Math.random() * 50); s.gold = (s.gold || 0) + g; const out = []; addDeeds(s, "daedric", 1, out); return { text: `${T("They weep, press {n} gold into your hand and run off into the trees.", { n: g })}${out.join("")}` }; },
    },
    aff_draugr_dogs: {
      title: "Howling dogs",
      make: () => ({ text: "At a farmstead by the road the dogs catch your smell and won't stop howling. The farmer comes out with a pitchfork." }),
      choices: () => [["calm", "Talk to the farmer"], ["leave", "Keep your distance"]],
      calm: (s) => {
        const ch = Math.min(0.9, 0.3 + G.skill(s, "Speechcraft") / 150), skills = G.useSkill(s, "Speechcraft", 4);
        if (Math.random() < ch) { G.give(s, "bread", 1); return { text: T("You keep your voice low and steady. He lowers the fork and even gives you some bread for the road."), skills }; }
        return { text: T("\"Barrow-stink! Get away from my farm!\" You leave with the dogs at your heels."), skills, delay: 40 };
      },
    },
    aff_draugr_crone: {
      title: "An old woman",
      make: () => ({ text: "An old Nord woman by a cairn sees the frost in your eyes. \"Barrow-sick. I can ease it, for a price. It won't cure you, mind.\"" }),
      choices: () => [["pay", "Pay her (150 gold)"], ["leave", "Walk on"]],
      pay: (s) => {
        if ((s.gold || 0) < 150) return { text: T("You can't afford it."), keep: true };
        const a = s.affl?.draugr; if (!a) return { text: T("She squints. \"Hm. You're clean after all.\"") };
        s.gold -= 150; a.deeds = Math.max(0, (a.deeds || 0) - 5);
        return { text: T("She burns juniper and mutters over you. The cold eases a little (the curse is weaker now).") };
      },
    },
    aff_dwemer_hum: {
      title: "A humming in the ground",
      make: () => ({ text: "Your teeth buzz. Somewhere under the road, an old Dwemer pipe is still humming, and you can feel exactly where." }),
      choices: () => [["dig", "Dig it up"], ["leave", "Leave it"]],
      dig: (s) => { const n = 1 + Math.floor(Math.random() * 3); if (D.ITEMS.dwemer_scrap) G.give(s, "dwemer_scrap", n); const out = []; addDeeds(s, "dwemer", 1, out); return { text: `${T("You pry up a length of bronze pipe and some fittings ({n} Dwemer scrap).", { n })}${out.join("")}`, delay: 40 }; },
    },
    aff_wolf_hunters: {
      title: "Silver traps",
      make: () => ({ text: "Hunters are setting silver-chain traps by the road. One sniffs the air near you and frowns." }),
      choices: () => [["slip", "Slip away quietly"], ["help", "Help them set the traps"]],
      slip: (s) => ({ text: T("You melt into the trees before they can ask questions."), skills: G.useSkill(s, "Sneak", 6), skip: 40 }),
      help: (s) => { const g = 25 + Math.round(Math.random() * 25); s.gold = (s.gold || 0) + g; return { text: T("You help them, careful not to touch the silver. They pay you {n} gold and never guess.", { n: g }), skills: G.useSkill(s, "Archery", 4) }; },
    },
  };
  const OF = { draugr: ["aff_draugr_dogs", "aff_draugr_crone"], daedric: ["aff_dae_cultist"], dwemer: ["aff_dwemer_hum"], wolf: ["aff_wolf_hunters"] };
  const isOurs = (e) => !!(e && EV[e.id]);
  const evOf = (id, s) => { const d = EV[id], m = d.make(s); if (m.text) m.text = T(m.text); return { id, title: T(d.title), ...m, aff: true }; };
  const ROLL = 0.16, SHRINE = 0.04;
  function rollEvent(s) {
    if ((s.level || 1) >= 5 && !has(s, "daedric") && newCount(s) < MAX_NEW && Math.random() < SHRINE) return evOf("aff_black_shrine", s);
    const a = s.affl || {};
    if (a.daedric && Math.random() < nums(s, "daedric").luck) return evOf("aff_dae_luck", s);
    const pool = list(s).flatMap((id) => OF[id] || []);
    if (pool.length && Math.random() < ROLL) return evOf(pool[Math.floor(Math.random() * pool.length)], s);
    return null;
  }
  function evChoices(e, s) { return EV[e.id].choices(e, s).map(([k, l]) => [k, T(l)]); }
  function evChoose(s, e, c) {
    if (c === "leave") return { text: T("You carry on down the road.") };
    const f = EV[e.id][c]; if (typeof f !== "function") return { text: "" };
    const r = f(s, e) || { text: "" }; if (r.text) r.text = T(r.text); return r;
  }
  /* an affliction event draws on one of the existing road pictures */
  const ART = { aff_black_shrine: "daedra", aff_dae_luck: "daedra", aff_dae_cultist: "pilgrims", aff_draugr_dogs: "dog", aff_draugr_crone: "stranger", aff_dwemer_hum: "wreck", aff_wolf_hunters: "hunters" };
  function hookArt() {
    if (typeof EVENTART === "undefined" || !EVENTART.ROAD) return;
    for (const [id, k] of Object.entries(ART)) if (!EVENTART.ROAD[id]) EVENTART.ROAD[id] = (...a) => (EVENTART.ROAD[k] || EVENTART.ROAD.road || (() => {}))(...a);
  }

  // ---------------------------------------------------------------- town: barks and prices
  const BARKS = {
    draugr: ["Brr. Did someone leave a door open? It's gone cold.", "You smell like an old tomb, friend.", "My dog won't stop growling at that one."],
    daedric: ["What's that mark on your hand? No, don't tell me.", "Stendarr keep me. Walk on, stranger.", "The priests would want a word with you, I think."],
    dwemer: ["Do you hear that humming? Is it you?", "Your hair's standing on end. Been near a storm?", "Keep away from my lamp, it flickers when you pass."],
    wolf: ["You've got a hungry look about you.", "Wolves were howling all night. Funny, they stopped when you arrived."],
  };
  function hookTown() {
    if (typeof IMM !== "undefined" && IMM.bark && IMM.BARKS && !IMM.__affl) {
      const b0 = IMM.bark, B = IMM.BARKS;
      IMM.bark = (s, place, t) => {
        const n0 = B.any ? B.any.length : 0;
        try { if (B.any && s) for (const id of list(s)) if (BARKS[id]) { const L = BARKS[id].map((x) => T(x)); B.any.push(...L, ...L); } return b0(s, place, t); }
        finally { if (B.any) B.any.length = n0; }
      };
      IMM.__affl = true;
    }
    if (typeof BEASTPATH !== "undefined" && BEASTPATH.priceMult && !BEASTPATH.__affl) {
      const p0 = BEASTPATH.priceMult;
      BEASTPATH.priceMult = (s, town) => p0(s, town) * priceMult(s);
      BEASTPATH.__affl = true;
    }
  }
  const priceMult = (s) => (s?.affl?.draugr ? 1 + nums(s, "draugr").price : 1);

  // ---------------------------------------------------------------- hooks
  function install() {
    if (typeof CURSE !== "undefined" && !CURSE.__affl) {
      const dm = CURSE.dmgMult, di = CURSE.dmgInMult, tk = CURSE.tick, af = CURSE.after, fx0 = CURSE.fx;
      CURSE.dmgMult = (f) => dm(f) * outMult(f);
      CURSE.dmgInMult = (f) => di(f) * inMult(f);
      CURSE.tick = (f, line) => { if (tk) tk(f, line); tick(f, line); };
      CURSE.after = (f) => [...(af ? af(f) : []), ...after(f)];
      CURSE.fx = (s, key, t) => {
        const v = fx0(s, key, t), a = s?.affl; if (!a) return v;
        if (key === "skill:Sneak" && a.draugr && s.dungeon) return v + nums(s, "draugr").sneak;
        if (key === "regen:magicka" && a.dwemer && !inRuin(s)) return v - nums(s, "dwemer").regen;
        return v;
      };
      CURSE.__affl = true;
    }
    if (typeof POTFX !== "undefined" && !POTFX.__affl) {
      const d0 = POTFX.drink, r0 = POTFX.roadDrink;
      if (d0) POTFX.drink = (f, res, amt, name) => d0(f, res, res === "health" ? amt * potionMult(f.s) : amt, name);
      if (r0) POTFX.roadDrink = (s, res, amt, name, t) => r0(s, res, res === "health" ? amt * potionMult(s) : amt, name, t);
      POTFX.__affl = true;
    }
    if (typeof G !== "undefined" && G.Fight && !G.Fight.prototype.__affl) {
      const c0 = G.Fight.prototype.cast;
      if (c0) G.Fight.prototype.cast = function (...args) { this._afflCast = true; try { return c0.apply(this, args); } finally { this._afflCast = false; } };
      G.Fight.prototype.__affl = true;
    }
    if (typeof MAGIC !== "undefined" && MAGIC.elem && !MAGIC.__affl) {
      const e0 = MAGIC.elem;
      MAGIC.elem = (f, el) => { const m = e0(f, el); return f && f._afflCast && el === "shock" ? m * shockMult(f) : m; };
      MAGIC.__affl = true;
    }
    if (typeof DUNGEONS !== "undefined" && !DUNGEONS.__affl) {
      const a0 = DUNGEONS.act;
      DUNGEONS.act = function (s, ...rest) {
        const d0 = s && s.dungeon, was = d0 && s.cleared ? s.cleared[d0.place] : undefined, r = a0.call(this, s, ...rest);
        try {   // the boss is down when the place's "cleared" stamp changes (a deep delve keeps going after that)
          if (d0 && s.cleared && s.cleared[d0.place] != null && s.cleared[d0.place] !== was) { const m = onClear(s, d0); if (m && r && typeof r.text === "string") r.text += " " + m; }
        } catch (e) { /* never break a dungeon */ }
        return r;
      };
      DUNGEONS.__affl = true;
    }
    if (typeof ROAD_EVENTS !== "undefined" && !ROAD_EVENTS.__affl) {
      const base = { roll: ROAD_EVENTS.roll, choices: ROAD_EVENTS.choices, choose: ROAD_EVENTS.choose };
      ROAD_EVENTS.roll = (s) => { let e = null; try { e = rollEvent(s); } catch (err) { e = null; } return e || base.roll(s); };
      ROAD_EVENTS.choices = (e, s) => (isOurs(e) ? evChoices(e, s) : base.choices(e, s));
      ROAD_EVENTS.choose = (s, e, c) => (isOurs(e) ? evChoose(s, e, c) : base.choose(s, e, c));
      ROAD_EVENTS.__affl = true;
    }
    hookTown(); hookArt();
    if (typeof I18N !== "undefined" && I18N.add && typeof I18N_AFFL !== "undefined") I18N.add(I18N_AFFL.tpl, I18N_AFFL.words);
  }

  // ---------------------------------------------------------------- the Character screen
  const badge = (arr) => { const a = parse(arr); return a.length ? ` <span class="affbadge">${a.map(([id, st]) => `<i style="color:${DEF[id].color}" title="${esc(T(DEF[id].name))} ${st}">${DEF[id].icon}</i>`).join("")}</span>` : ""; };
  const hrs = (sec) => Math.max(1, Math.ceil(sec / 3600));
  function cureRow(s, id) {
    const tp = templeAt(s);
    if (id === "draugr") { const g = cureCost(s); return `<button class="btn sm" data-act="afflcure" data-id="draugr" ${tp && (s.gold || 0) >= g ? "" : "disabled"}>${esc(tp ? T("Ask the priests ({n} gold)", { n: g }) : T("Cure at a temple ({n} gold)", { n: g }))}</button>`; }
    if (id === "daedric") {
      const a = s.affl.daedric, left = favourLeft(s);
      const fav = a.vow != null ? "" : `<button class="btn sm" data-act="afflfavour" ${left > 0 ? "disabled" : ""}>${esc(left > 0 ? T("Favour in {n} h", { n: hrs(left) }) : T("Ask for a favour"))}</button>`;
      const vow = a.vow != null ? `<span class="sub">${esc(T("Vow of Cleansing: {n} of 3 daedra slain.", { n: a.vow }))}</span>` : `<button class="btn sm" data-act="afflvow" ${tp ? "" : "disabled"}>${esc(T("Take the Vow of Cleansing"))}</button>`;
      return fav + vow;
    }
    if (id === "dwemer") { const n = salts(s); return `<button class="btn sm" data-act="afflsalts" ${n >= 2 ? "" : "disabled"}>${esc(T("Drink the Void Salts ({n}/2)", { n }))}</button>`; }
    return "";
  }
  function card(s, id) {
    const d = DEF[id], st = stage(s, id), [ups, downs] = lines(s, id), nx = nextAt(s, id), dd = deeds(s, id);
    const label = id === "vamp" ? T("Hunger {st} of 4", { st }) : T("Stage {st} of 3 · {label}", { st, label: T(STAGE_NAME[st - 1]) });
    const prev = id === "vamp" ? 0 : (id === "wolf" ? WOLF_NEED : NEED)[st - 1] || 0;
    const bar = id === "vamp" ? st / 4 : nx == null ? 1 : (dd - prev) / Math.max(1, nx - prev);
    const legacy = id === "wolf" || id === "vamp";
    return `<div class="affcard" style="--affc:${d.color}"><div class="affhead"><span class="afficon">${d.icon}</span><div class="t">${esc(T(d.name))}<span>${esc(label)}</span></div></div>
      <div class="bar affbar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, bar)))}%"></i></div>
      <ul class="afflist">${ups.map((x) => `<li class="affup">${""} ${esc(x)}</li>`).join("")}${downs.map((x) => `<li class="affdown">${""} ${esc(x)}</li>`).join("")}</ul>
      <p class="sub">${esc(T(d.grow))}${nx != null && id !== "vamp" ? " " + esc(T("Next stage: {a} of {b}.", { a: dd, b: nx })) : ""}</p>
      ${legacy ? `<p class="sub">${esc(T(id === "wolf" ? "Cure: Purity of the Blood (Aela, Jorrvaskr). Beast Form and its perks are in the panel below." : "Cure: Rising at Dawn (Falion, Morthal). Feeding and the Vampire Lord are in the panel below."))}</p>`
        : `<p class="sub">${esc(T(d.cure))}</p><div class="affbtns">${cureRow(s, id)}</div>`}</div>`;
  }
  function panel(s) {
    const ids = list(s), ms = mates();
    if (!ids.length && !ms.length) return "";
    const mine = ids.map((id) => card(s, id)).join("");
    const AUTXT = { wolf: "you hit beasts 5% harder (pack sense)", draugr: "frost hurts you 5% less (the barrow chill)", daedric: "daedra take 5% more from you", dwemer: "your shock spells hit 5% harder (the hum)", vamp: "nothing touches you, but they look hungry" };
    const party = ms.length ? `<div class="affparty"><p class="sub"><b>${esc(T("Your party"))}</b> · ${esc(T("in a fight together:"))}</p>${ms.map(([nm, a]) => `<div class="item"><div class="t">${esc(nm)}${badge(a.map(([id, st]) => `${id}:${st}`))}<span>${a.map(([id, st]) => esc(`${T(DEF[id].name)} ${st}: ${T(AUTXT[id])}`)).join(" · ")}</span></div></div>`).join("")}</div>` : "";
    const fold = typeof MENUS2 !== "undefined" && MENUS2.fold ? MENUS2.fold : (fid, title, html) => `<div class="panel"><h2>${title}</h2>${html}</div>`;
    return fold("afflictions", esc(T("Afflictions")), `${ids.length ? `<p class="sub">${esc(T("Dark gifts you carry. Each has an upside and a downside, and grows with what you do."))}</p>` : ""}<div class="affgrid">${mine}</div>${party}`, ids.length ? ids.map((id) => DEF[id].icon).join(" ") : "");
  }
  function act(s, b, c) {
    const a = b.dataset.act;
    const m = a === "afflcure" ? priestCure(s) : a === "afflvow" ? takeVow(s) : a === "afflsalts" ? drinkSalts(s) : a === "afflfavour" ? favour(s) : null;
    if (m != null && c && c.say) c.say(m);
    return m;
  }

  install();
  return { DEF, IDS, ALL, NEED, WEEK, TEMPLES, has, list, stage, deeds, nextAt, nums, lines, give, roll, cure, priestCure, takeVow, drinkSalts, favour, favourLeft,
    outMult, inMult, shockMult, potionMult, priceMult, tick, after, onClear, rollEvent, EV, cardBits, badge, mates, setMates, mount, panel, act, install, isDaedra, isConstruct };
})();
