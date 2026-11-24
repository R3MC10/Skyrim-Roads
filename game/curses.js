/* Werewolf and vampire paths. Both are optional and curable.
   Werewolf: the Circle of the Companions offers the beast blood once you finish their quest line.
     Beast Form once a day in a fight (a power in your tactics): hits much harder and shrugs off blows
     for a while, but you can't drink potions while transformed. Like Skyrim, beds no longer make you Rested.
   Vampire: a vampire you fight at night may infect you (Sanguinare Vampiris). Drink a Cure Disease potion
     or pray at a shrine within 3 hours, or you turn. A vampire is stronger at night and with Destruction
     and Illusion, but the sun slows your healing by day, worse the longer you go without feeding.
   [Skyrim] Sanguinare Vampiris turns you after 3 in-game days; hunger rises one stage per in-game day unfed.
   Vampires take more fire damage and less frost damage the hungrier they are, and shrug off poison.
   Vampire Lord: a second once-a-day form for vampires (drain life every turn, wings, its own perk stars).
   Werewolf perks grow by feeding after Beast Form fights; Vampire Lord perks by kills in Lord form.
   Cures are quests: Falion's dawn ritual in Morthal (Rising at Dawn) and a Glenmoril witch's head burned at
   Ysgramor's Tomb (Purity of the Blood).
   Numbers are [OURS] unless marked. */
const CURSE = (() => {
  const nowS = () => Date.now() / 1000;
  const HOUR = 3600, DAY = 2 * 3600, TURN_AFTER = 3 * DAY;   // one game day = 2 real hours (like powers.js); [Skyrim] 3 days to turn
  const BEAST_TURNS = 10, LORD_TURNS = 10, INFECT_CHANCE = 0.25;
  const CURE_WEREWOLF = 1000, CURE_VAMPIRE_GOLD = 500;
  // Cure Disease potion ([Skyrim] cures Sanguinare Vampiris, not full vampirism)
  function addItems() {
    if (!D.ITEMS.potion_cure_disease) D.ITEMS.potion_cure_disease = { name: "Potion of Cure Disease", slot: "potion", value: 80, weight: 0.5, cures: "disease" };
    for (const k of ["general", "wizard"]) if (D.SHOP_STOCK[k] && !D.SHOP_STOCK[k].includes("potion_cure_disease")) D.SHOP_STOCK[k].push("potion_cure_disease");
    Object.assign(D.ITEMS, {
      soul_gem_black: { name: "Black Soul Gem", slot: "trophy", weight: 1, value: 300, noTrade: true, desc: "Empty. Falion says it fills when you defeat a person while carrying it." },
      soul_gem_black_full: { name: "Black Soul Gem (filled)", slot: "trophy", weight: 1, value: 600, noTrade: true, desc: "A human soul swirls inside. Falion needs it for the dawn ritual." },
      glenmoril_head: { name: "Glenmoril Witch Head", slot: "trophy", weight: 2, value: 100, noTrade: true, desc: "Burn it in the fire at Ysgramor's Tomb to be free of the beast blood." },
    });
  }

  // ---- werewolf
  const isWolf = (s) => !!s.werewolf;
  const offered = (s) => !!(s.quests?.companions?.done) && !s.werewolf && !s.wolfDeclined;
  function acceptWolf(s) {
    if (!s.quests?.companions?.done) return "Only the Circle can offer the beast blood.";
    if (s.vampire) return "Aela sniffs and steps back. \"You already carry one curse. The blood won't take.\"";
    s.werewolf = { since: nowS() }; s.wolfDeclined = false;
    return "In the Underforge, Aela opens her wrist and you drink. The world goes red. You are one of the Circle now: Beast Form is in your tactics, once a day.";
  }
  const declineWolf = (s) => { s.wolfDeclined = true; return "You tell the Circle no. Farkas shrugs: \"The offer stands, if you change your mind.\""; };
  function cureWolf(s) {   // the end of Purity of the Blood
    if (!s.werewolf) return "You're not a werewolf.";
    s.werewolf = null; s.wolfDeclined = true; s.cured = { ...(s.cured || {}), wolf: (s.cured?.wolf || 0) + 1 };
    return "The witch's head hisses in the Harbinger's fire. The wolf spirit tears free of you and you strike it down. You're only yourself again.";
  }
  const beastReady = (s, t = nowS()) => isWolf(s) && (s._test || (s.beastAt || 0) + DAY <= t);

  // ---- vampire
  const infected = (s, t = nowS()) => !!s.sanguinare && !s.vampire;
  function maybeInfect(s, enemy, t = nowS()) {   // after any fight with a vampire
    if (!enemy || !/vampire/i.test(enemy.name || "") || s.vampire || s.sanguinare || s.werewolf) return null;
    if (typeof PRIESTS !== "undefined" && PRIESTS.immune(s)) return null;   // [Skyrim] Hevnoraak: immune to disease   // [Skyrim] werewolves are immune to disease
    if (Math.random() >= INFECT_CHANCE) return null;
    s.sanguinare = { at: t };
    return "You feel a strange chill where the vampire's claws caught you. (Sanguinare Vampiris: cure it within 3 in-game days with a Cure Disease potion or at a shrine, or you'll turn.)";
  }
  /* called every few seconds: the disease runs its course */
  function update(s, t = nowS()) {
    if (s.sanguinare && !s.vampire && t - s.sanguinare.at >= TURN_AFTER) {
      s.sanguinare = null; s.vampire = { since: t, fedAt: t };
      return " You wake up hungry for something that isn't food. You are a vampire now. See the Character tab.";
    }
    return null;
  }
  function cureDisease(s) {
    if (!s.sanguinare) return null;
    s.sanguinare = null; return "The chill fades. The disease is gone.";
  }
  const hoursUnfed = (s, t = nowS()) => (s.vampire ? (t - (s.vampire.fedAt || t)) / HOUR : 0);
  const daysUnfed = (s, t = nowS()) => (s.vampire ? (t - (s.vampire.fedAt || t)) / DAY : 0);   // in-game days
  const stage = (s, t = nowS()) => (s.vampire ? Math.min(4, 1 + Math.floor(daysUnfed(s, t))) : 0);   // [Skyrim] 1-4, one step per in-game day unfed
  function feed(s, t = nowS()) {
    if (!s.vampire) return "You're not a vampire.";
    if (!s.location || !TOWNS.INNS[s.location]) return "Find an inn where travellers sleep.";
    s.vampire.fedAt = t;
    const seen = Math.random() < 0.15;
    if (seen && typeof TOWNS !== "undefined") TOWNS.addBounty(s, G.holdAt(WORLD.places[s.location]), "assault");
    return seen ? "You feed on a sleeping traveller, but someone wakes and screams. The guards will want a word (bounty)." : "You feed on a sleeping traveller. They'll wake up tired and none the wiser. Your hunger fades.";
  }
  function cureVampire(s) {   // the end of Rising at Dawn
    if (!s.vampire) return "You're not a vampire.";
    s.vampire = null; s.sanguinare = null; s.cured = { ...(s.cured || {}), vamp: (s.cured?.vamp || 0) + 1 };
    return "At dawn Falion's ritual draws the darkness out of you and into the black soul gem. Sunlight feels warm again.";
  }

  // ---- perk stars: [id, name, ranks, needs, x, y, desc]   (x/y: a 0..100 sky for the constellation)
  const TREES = {
    wolf: { name: "Werewolf", icon: "", unit: "feed", perks: [
      ["bestial_strength", "Bestial Strength", 4, [], 50, 92, "Beast Form hits 10% harder per rank."],
      ["totem_terror", "Totem of Terror", 1, ["bestial_strength"], 28, 74, "Your howl as you change makes ordinary foes cower for 2 turns."],
      ["animal_vigor", "Animal Vigor", 1, ["bestial_strength"], 72, 74, "Changing heals you more, and your beast body holds more health."],
      ["totem_predator", "Totem of the Predator", 1, ["totem_terror"], 18, 52, "You change faster than they can react: the foe is staggered."],
      ["gorging", "Gorging", 1, ["animal_vigor"], 82, 52, "Feeding after a fight heals twice as much."],
      ["savage_feeding", "Savage Feeding", 1, ["gorging"], 74, 30, "You can feed on beasts too, not only people."],
      ["totem_ice_brothers", "Totem of Ice Brothers", 1, ["totem_predator"], 26, 30, "Two ice wolves answer your howl and fight with you."],
      ["totem_moon", "Totem of the Moon", 1, ["totem_ice_brothers"], 46, 10, "Werewolf brothers answer instead: much stronger than wolves."],
    ] },
    lord: { name: "Vampire Lord", icon: "", unit: "kill", perks: [
      ["power_grave", "Power of the Grave", 1, [], 50, 92, "As a Vampire Lord you take 15% less damage."],
      ["detect_all", "Detect All Creatures", 1, ["power_grave"], 30, 76, "Nothing hides from you: your drain is 15% stronger."],
      ["vampiric_grip", "Vampiric Grip", 1, ["power_grave"], 70, 76, "You yank the foe off its feet as you change: it's staggered."],
      ["mist_form", "Mist Form", 1, ["detect_all"], 14, 58, "Once per change, when you're nearly dead, you burst into mist: untouchable for 2 turns and healed a little."],
      ["blood_healing", "Blood Healing", 1, ["detect_all"], 38, 52, "Your drain heals you 50% more."],
      ["night_cloak", "Night Cloak", 1, ["vampiric_grip"], 78, 56, "A swarm of bats bites the foe every turn and feeds you."],
      ["supernatural_reflexes", "Supernatural Reflexes", 1, ["mist_form"], 16, 32, "A 20% chance to slip aside from blows as a Vampire Lord."],
      ["unearthly_will", "Unearthly Will", 1, ["blood_healing"], 40, 28, "At night your drain is 25% stronger."],
      ["corpse_curse", "Corpse Curse", 1, ["night_cloak"], 82, 34, "As you change, ordinary foes are paralyzed for 3 turns."],
      ["summon_gargoyle", "Summon Gargoyle", 1, ["corpse_curse"], 64, 12, "A gargoyle tears out of the ground to fight for you."],
    ] },
  };
  const NEED = [2, 4, 7, 10, 14, 18, 23, 28, 34, 40, 47];   // feeds or kills needed for each perk point
  const bp = (s) => (s.beastPerks = s.beastPerks || { wolf: {}, lord: {}, feeds: 0, kills: 0 });
  const rank = (s, tree, id) => (bp(s)[tree][id] || 0);
  const earned = (s, tree) => { const n = tree === "wolf" ? bp(s).feeds : bp(s).kills; return NEED.filter((x) => n >= x).length; };
  const spent = (s, tree) => Object.values(bp(s)[tree]).reduce((a, b) => a + b, 0);
  const points = (s, tree) => Math.max(0, earned(s, tree) - spent(s, tree));
  const nextAt = (s, tree) => NEED.find((x) => x > (tree === "wolf" ? bp(s).feeds : bp(s).kills)) || null;
  const has = (s, tree) => (tree === "wolf" ? !!s.werewolf : !!s.vampire);
  const P = (f, tree, id) => rank(f.s, tree, id);
  const perkOf = (tree, id) => TREES[tree]?.perks.find((p) => p[0] === id);
  function canTake(s, tree, id) {
    const p = perkOf(tree, id); if (!p) return "No such perk.";
    if (!has(s, tree)) return tree === "wolf" ? "Only werewolves can take this." : "Only vampires can take this.";
    if (rank(s, tree, id) >= p[2]) return "You have it.";
    if (p[3].length && !p[3].some((n) => rank(s, tree, n) > 0)) return `Needs ${perkOf(tree, p[3][0])[1]}`;
    if (points(s, tree) < 1) return tree === "wolf" ? "Feed to earn more" : "Kill as a Vampire Lord to earn more";
    return "";
  }
  function takePerk(s, tree, id) {
    const why = canTake(s, tree, id); if (why) return why;
    bp(s)[tree][id] = rank(s, tree, id) + 1;
    return `${TREES[tree].icon} ${perkOf(tree, id)[1]}${perkOf(tree, id)[2] > 1 ? ` (${rank(s, tree, id)}/${perkOf(tree, id)[2]})` : ""}: ${perkOf(tree, id)[6]}`;
  }
  const trees = (s) => [...(s.werewolf ? ["wolf"] : []), ...(s.vampire ? ["lord"] : [])];

  // ---- Vampire Lord: once a day, vampires only
  const lordReady = (s, t = nowS()) => !!s.vampire && (s._test || (s.lordAt || 0) + DAY <= t);

  // ---- what each hit is made of, for vampire weaknesses
  function incomingEl(f) {
    const n = (f.e?.name || "").toLowerCase(), tg = f.tags || new Set();
    if (tg.has("dragon")) return /frost|ice|blood|revered|legendary/.test(n) ? "frost" : "fire";
    if (/fire|flame|pyro|ember|inferno/.test(n)) return "fire";
    if (/frost|ice|wraith|snow|winter/.test(n)) return "frost";
    if (/spider|chaurus|poison|venom|netch|spriggan|lurker/.test(n)) return "poison";
    return null;
  }

  // ---- effects read by the engine and powers.js
  /* extra numbers for fxSum keys */
  function fx(s, key, t = nowS()) {
    if (!s.vampire) return 0;
    const st = stage(s, t), night = G.isNight(t);
    if (key === "spell:Destruction" || key === "spell:Illusion") return 15 + 5 * st;            // [Skyrim-ish] vampires grow stronger with hunger
    if (key === "regen:health" && !night && !s.location) return -20 * st;                      // the sun hurts outside by day
    if (key === "skill:Sneak" && night) return 10;
    return 0;
  }
  function dmgMult(f) {
    const s = f.s, p = f.pw || {};
    let m = 1;
    if (p.beast > 0) m *= 1.8 * (1 + 0.1 * P(f, "wolf", "bestial_strength"));
    if (p.lord > 0) m *= G.isNight(f.t) ? 1.15 : 1;
    if (s.vampire && G.isNight(f.t)) m *= 1 + 0.05 * stage(s, f.t);
    return m;
  }
  function dmgInMult(f) {
    const p = f.pw || {}, s = f.s;
    let m = p.beast > 0 ? 0.55 : 1;
    if (p.lord > 0) m *= P(f, "lord", "power_grave") ? 0.75 : 0.88;
    if (s.vampire) {   // [Skyrim] weak to fire and resistant to frost, more so the hungrier; immune to poison
      const st = stage(s, f.t), el = incomingEl(f);
      if (el === "fire") m *= 1 + 0.25 * st;
      else if (el === "frost") m *= Math.max(0.25, 1 - 0.25 * st);
      else if (el === "poison") m *= 0.5;
    }
    return m;
  }
  const noPotions = (f) => (f.pw?.beast || 0) > 0 || (f.pw?.lord || 0) > 0;
  /* a Vampire Lord slips aside (Supernatural Reflexes) */
  const dodge = (f) => (f.pw?.lord || 0) > 0 && P(f, "lord", "supernatural_reflexes") > 0 && Math.random() < 0.2;
  const calmable = (f) => !f.tags.has("boss") && !f.tags.has("dragon") && !f.tags.has("elite");
  /* Beast Form from tactics */
  function transform(f) {
    const s = f.s, mh = G.maxHealth(s), vig = P(f, "wolf", "animal_vigor");
    if (!s._test) s.beastAt = f.t;
    f.pw.beast = BEAST_TURNS;
    f.hp = Math.min(mh * (vig ? 1.75 : 1.5), f.hp + mh * (vig ? 0.6 : 0.4));
    const extra = [];
    if (P(f, "wolf", "totem_terror") && calmable(f)) { f.calmTurns = Math.max(f.calmTurns || 0, 2); extra.push("it cowers"); }
    if (P(f, "wolf", "totem_predator")) { f.stagger = true; extra.push("staggered"); }
    if (P(f, "wolf", "totem_moon")) { f.allies.push({ name: "Werewolf brother", dmg: 16, kind: "werewolf" }, { name: "Werewolf brother", dmg: 16, kind: "werewolf" }); extra.push("your brothers answer"); }
    else if (P(f, "wolf", "totem_ice_brothers")) { f.allies.push({ name: "Ice wolf", dmg: 8, kind: "icewolf" }, { name: "Ice wolf", dmg: 8, kind: "icewolf" }); extra.push("ice wolves answer"); }
    return `You throw your head back and howl: Beast Form!${extra.length ? ` (${extra.join(", ")})` : ""}`;
  }
  /* Vampire Lord from tactics */
  function lordForm(f) {
    const s = f.s, mh = G.maxHealth(s);
    if (!s._test) s.lordAt = f.t;
    f.pw.lord = LORD_TURNS; f.mistUsed = false;
    f.hp = Math.min(mh * 1.2, f.hp + mh * 0.2);
    const extra = [];
    if (P(f, "lord", "corpse_curse") && calmable(f)) { f.eParalyzed = Math.max(f.eParalyzed || 0, 3); extra.push("paralyzed"); }
    else if (P(f, "lord", "vampiric_grip") && !f.tags.has("dragon")) { f.stagger = true; extra.push("yanked off its feet"); }
    if (P(f, "lord", "summon_gargoyle")) { f.allies.push({ name: "Gargoyle", dmg: 16, kind: "gargoyle" }); extra.push("a gargoyle rises"); }
    return `Your skin splits and great wings unfold: Vampire Lord!${extra.length ? ` (${extra.join(", ")})` : ""}`;
  }
  /* the drain a Vampire Lord does each turn, before it happens */
  function drainOf(f) {
    const s = f.s, night = G.isNight(f.t);
    return (4 + 0.3 * (s.level || 1)) * (1 + 0.15 * P(f, "lord", "detect_all")) * (night && P(f, "lord", "unearthly_will") ? 1.25 : 1) * (1 + 0.05 * stage(s, f.t));
  }
  const drainHeal = (f) => 0.4 * (P(f, "lord", "blood_healing") ? 1.5 : 1);
  /* once a turn (from POWERS.tick, before the counters run down) */
  function tick(f, line) {
    const p = f.pw, s = f.s, mh = G.maxHealth(s);
    if (!(p.lord > 0)) return;
    if (f.ehp > 0) { const d = drainOf(f); f.ehp -= d; f.hp = Math.min(mh * 1.3, f.hp + d * drainHeal(f)); line.me += ` · drain life ${Math.round(d)}`; }
    if (f.ehp > 0 && P(f, "lord", "night_cloak")) { f.ehp -= 6; f.hp = Math.min(mh * 1.3, f.hp + 6); line.me += " · bats 6"; }
    if (P(f, "lord", "mist_form") && !f.mistUsed && f.hp < mh * 0.25) { f.mistUsed = true; p.ether = 3; f.hp = Math.min(mh, f.hp + mh * 0.15); line.me += " · you burst into mist"; }
    if (p.lord === 1) line.me += " · you fold your wings and change back";
  }
  /* after the fight: feeding, Lord kills, a black soul gem filling */
  function after(f) {
    const s = f.s, out = [];
    if (!f.won) return out;
    const tg = f.tags || new Set(), person = tg.has("humanoid") && !tg.has("undead") && !tg.has("construct");
    if (f.usedBeast && s.werewolf && (person || (tg.has("beast") && P(f, "wolf", "savage_feeding")))) {
      const b = bp(s), before = points(s, "wolf"); b.feeds++;
      const h = G.maxHealth(s) * (P(f, "wolf", "gorging") ? 0.4 : 0.2); f.hp = Math.min(G.maxHealth(s), f.hp + h);
      out.push(` You feed on the ${f.e?.name || "body"} (+${Math.round(h)} health)${points(s, "wolf") > before ? ". A new werewolf perk is ready!" : ""}`);
    }
    if (f.usedLord && s.vampire) {
      const b = bp(s), before = points(s, "lord"); b.kills++; s.vampire.fedAt = f.t;   // a Lord's kill is a feed
      out.push(` The Vampire Lord drinks its fill${points(s, "lord") > before ? ". A new Vampire Lord perk is ready!" : ""}`);
    }
    if (person && !tg.has("dragon")) { const r = s.inv.find((x) => x.item === "soul_gem_black"); if (r) { G.take(s, r.id, 1); G.give(s, "soul_gem_black_full"); s.blackGemFull = true; out.push(" The black soul gem drinks a human soul."); } }
    return out;
  }
  /* Smart AI: what a form is worth for the rest of this fight (in "turns of your damage" like other powers) */
  function formValue(f, kind, remT, d, dps) {
    if (kind === "beast") { const out = 1.8 * (1 + 0.1 * P(f, "wolf", "bestial_strength")), T = Math.min(BEAST_TURNS, remT); return T * ((out - 1) + 0.45 * d) + (P(f, "wolf", "totem_ice_brothers") ? T * 16 / Math.max(1, dps) : 0); }
    if (kind === "lord") { const T = Math.min(LORD_TURNS, remT), dr = drainOf(f); return T * (dr / Math.max(1, dps) + dr * drainHeal(f) / Math.max(1, dps) * d * 0.5 + (P(f, "lord", "power_grave") ? 0.25 : 0.12) * d); }
    return 0;
  }

  // ---- cure quests: Rising at Dawn (Falion, Morthal) and Purity of the Blood (Glenmoril witches)
  const W = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 10, danger: "high", gold: [0, 0], text: "", ...extra });
  const dawn = (t = G.now()) => { const h = G.clock(t).hour; return h >= 5 && h < 9; };
  const Q = {
    cure_vamp: { name: "Rising at Dawn", giver: "Falion, the wizard of Morthal", place: "Morthal", cure: "vamp", stages: [
      { title: "Falion's Ritual", rec: 1, text: "Falion, Morthal's court wizard, has studied vampires for years. He may know how to drive the curse out of you. Go to Morthal and ask him.", obj: { talk: "Morthal", label: "Ask Falion for a cure" }, reward: { items: ["soul_gem_black"] } },
      { title: "A Black Soul Gem", rec: 1, text: "Falion gave you an empty black soul gem. Only a human soul will do: defeat a person (a bandit, a necromancer, a Forsworn) while you carry it.", obj: { flag: "blackGemFull" } },
      { title: "Rising at Dawn", rec: 1, text: "Bring the filled gem to Falion's summoning circle outside Morthal at dawn (5:00 to 9:00) and he'll do the rest.", obj: { talk: "Morthal", label: "Begin the ritual at dawn",
        need: (s) => !s.inv.some((r) => r.item === "soul_gem_black_full") ? "You need the filled black soul gem." : !dawn() ? `Falion: "Come back at dawn." It's ${G.clockText(G.now()).split(", ")[1]}; the ritual needs 5:00 to 9:00.` : "" } },
    ] },
    cure_wolf: { name: "Purity of the Blood", giver: "Aela the Huntress, Jorrvaskr", place: "Whiterun", cure: "wolf", stages: [
      { title: "The Glenmoril Witches", rec: 10, text: "Aela says the Glenmoril witches' heads can burn the beast blood out of you. Hunt them at Glenmoril Coven, near Falkreath.", obj: { talk: "Glenmoril Coven", label: "Face the Glenmoril witches",
        fight: W("Glenmoril witch", 170, 17, ["humanoid", "mage"], { text: "Three hags in rags rise from the cave pool, cackling." }) }, reward: { items: ["glenmoril_head"] } },
      { title: "The Wolf Spirit", rec: 12, text: "Throw a witch's head into the Harbinger's fire in Ysgramor's Tomb. The wolf spirit will tear itself out of you, and you'll have to beat it.", obj: { talk: "Ysgramor's Tomb", label: "Burn the witch's head",
        need: (s) => (s.inv.some((r) => r.item === "glenmoril_head") ? "" : "You need a Glenmoril witch's head."), fight: W("Your wolf spirit", 150, 15, ["beast"], { text: "The fire roars and a great black wolf of smoke tears out of your chest." }) } },
    ] },
  };
  const QIDS = Object.keys(Q);
  function questSync(s) {   // start the cure quest when you carry the curse; finish it with the cure
    const q = (s.quests = s.quests || {}), msgs = [];
    for (const id of QIDS) {
      const cursed = Q[id].cure === "vamp" ? !!s.vampire : !!s.werewolf, v = q[id];
      if (cursed && (!v || (v.done && v.cured))) { q[id] = { stage: 0, t: G.now() }; G.note(s, ` New quest: ${Q[id].name} (Journal).`); }
      else if (v && v.done && !v.cured && cursed) {
        v.cured = true;
        if (Q[id].cure === "vamp") { const r = s.inv.find((x) => x.item === "soul_gem_black_full"); if (r) G.take(s, r.id, 1); s.blackGemFull = false; msgs.push(cureVampire(s)); }
        else { const r = s.inv.find((x) => x.item === "glenmoril_head"); if (r) G.take(s, r.id, 1); msgs.push(cureWolf(s)); }
        G.note(s, msgs[msgs.length - 1]);
      }
      else if (v && !v.done && !cursed) { delete q[id]; }   // cured some other way
    }
    return msgs;
  }
  function emblem(g, id) {   // Journal emblem: a red drop or a wolf's eye
    const c = id === "cure_vamp" ? "#a3203a" : "#7a6a5a", ink = "#1a120a";
    const gl = g.createRadialGradient(20, 20, 2, 20, 20, 17); gl.addColorStop(0, c); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40);
    g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 1.3;
    if (id === "cure_vamp") { g.fillStyle = "#c22a3a"; g.beginPath(); g.moveTo(20, 7); g.quadraticCurveTo(31, 22, 27, 28); g.quadraticCurveTo(20, 36, 13, 28); g.quadraticCurveTo(9, 22, 20, 7); g.fill(); g.stroke(); g.fillStyle = "#ffd76a"; g.beginPath(); g.arc(20, 34, 4, Math.PI, 0); g.fill(); }
    else { g.fillStyle = "#e9dcc0"; g.beginPath(); g.ellipse(20, 20, 13, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "#d6a020"; g.beginPath(); g.arc(20, 20, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = ink; g.fillRect(19, 15, 2, 10); }
  }
  if (typeof QUESTS !== "undefined") {
    for (const id of QIDS) { Q[id].emblem = (g) => emblem(g, id); QUESTS.L[id] = Q[id]; QUESTS.REC[id] = Q[id].stages.map((x) => x.rec); }
    const ensure0 = QUESTS.ensure, check0 = QUESTS.check, talk0 = QUESTS.talk;
    QUESTS.ensure = (s) => { ensure0(s); questSync(s); };
    QUESTS.check = (s) => { const m = check0(s); return [...m, ...questSync(s)]; };
    QUESTS.talk = (s, id, t) => { const r = talk0(s, id, t); const m = questSync(s); if (m.length) r.msgs = [...(r.msgs || []), ...m]; return r; };
    QUESTS.visible = ((v0) => (s, id) => (Q[id] ? (Q[id].cure === "vamp" ? !!s.vampire : !!s.werewolf) : true) && (v0 ? v0(s, id) : true))(QUESTS.visible);
  }
  addItems();
  return { isWolf, offered, acceptWolf, declineWolf, cureWolf, beastReady, lordReady, infected, maybeInfect, update, cureDisease, hoursUnfed, daysUnfed, stage, feed, cureVampire,
    fx, dmgMult, dmgInMult, noPotions, dodge, transform, lordForm, tick, after, drainOf, formValue, incomingEl,
    TREES, NEED, rank, points, earned, nextAt, canTake, takePerk, trees, questSync, Q, dawn,
    BEAST_TURNS, LORD_TURNS, TURN_AFTER, DAY };
})();
