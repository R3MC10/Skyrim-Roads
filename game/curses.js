/* Werewolf and vampire paths. Both are optional and curable.
   Werewolf: the Circle of the Companions offers the beast blood once you finish their quest line.
     Beast Form once a day in a fight (a power in your tactics): hits much harder and shrugs off blows
     for a while, but you can't drink potions while transformed. Like Skyrim, beds no longer make you Rested.
   Vampire: a vampire you fight at night may infect you (Sanguinare Vampiris). Drink a Cure Disease potion
     or pray at a shrine within 3 hours, or you turn. A vampire is stronger at night and with Destruction
     and Illusion, but the sun slows your healing by day, worse the longer you go without feeding.
   Numbers are [OURS] unless marked. */
const CURSE = (() => {
  const nowS = () => Date.now() / 1000;
  const HOUR = 3600, TURN_AFTER = 3 * HOUR, DAY = 2 * 3600;   // one game day = 2 real hours (like powers.js)
  const BEAST_TURNS = 10, INFECT_CHANCE = 0.25;
  const CURE_WEREWOLF = 1000, CURE_VAMPIRE_GOLD = 500;
  // Cure Disease potion ([Skyrim] cures Sanguinare Vampiris, not full vampirism)
  function addItems() {
    if (!D.ITEMS.potion_cure_disease) D.ITEMS.potion_cure_disease = { name: "Potion of Cure Disease", slot: "potion", value: 80, weight: 0.5, cures: "disease" };
    for (const k of ["general", "wizard"]) if (D.SHOP_STOCK[k] && !D.SHOP_STOCK[k].includes("potion_cure_disease")) D.SHOP_STOCK[k].push("potion_cure_disease");
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
  function cureWolf(s) {
    if (!s.werewolf) return "You're not a werewolf.";
    if (s.gold < CURE_WEREWOLF) return `The Circle's cleansing needs ${CURE_WEREWOLF} gold for the witches' heads and the fire.`;
    s.gold -= CURE_WEREWOLF; s.werewolf = null; s.wolfDeclined = true;
    return "At Ysgramor's tomb the flames take the wolf out of you. You're only yourself again.";
  }
  const beastReady = (s, t = nowS()) => isWolf(s) && (s._test || (s.beastAt || 0) + DAY <= t);

  // ---- vampire
  const infected = (s, t = nowS()) => !!s.sanguinare && !s.vampire;
  function maybeInfect(s, enemy, t = nowS()) {   // after any fight with a vampire
    if (!enemy || !/vampire/i.test(enemy.name || "") || s.vampire || s.sanguinare || s.werewolf) return null;
    if (typeof PRIESTS !== "undefined" && PRIESTS.immune(s)) return null;   // [Skyrim] Hevnoraak: immune to disease   // [Skyrim] werewolves are immune to disease
    if (Math.random() >= INFECT_CHANCE) return null;
    s.sanguinare = { at: t };
    return "You feel a strange chill where the vampire's claws caught you. (Sanguinare Vampiris: cure it within 3 hours with a Cure Disease potion or at a shrine, or you'll turn.)";
  }
  /* called every few seconds: the disease runs its course */
  function update(s, t = nowS()) {
    if (s.sanguinare && !s.vampire && t - s.sanguinare.at >= TURN_AFTER) {
      s.sanguinare = null; s.vampire = { since: t, fedAt: t };
      return "🩸 You wake up hungry for something that isn't food. You are a vampire now. See the Hero tab.";
    }
    return null;
  }
  function cureDisease(s) {
    if (!s.sanguinare) return null;
    s.sanguinare = null; return "The chill fades. The disease is gone.";
  }
  const hoursUnfed = (s, t = nowS()) => (s.vampire ? (t - (s.vampire.fedAt || t)) / HOUR : 0);
  const stage = (s, t = nowS()) => (s.vampire ? Math.min(4, 1 + Math.floor(hoursUnfed(s, t) / 6)) : 0);   // 1-4, one step every 6 real hours
  function feed(s, t = nowS()) {
    if (!s.vampire) return "You're not a vampire.";
    if (!s.location || !TOWNS.INNS[s.location]) return "Find an inn where travellers sleep.";
    s.vampire.fedAt = t;
    const seen = Math.random() < 0.15;
    if (seen && typeof TOWNS !== "undefined") TOWNS.addBounty(s, G.holdAt(WORLD.places[s.location]), "assault");
    return seen ? "You feed on a sleeping traveller, but someone wakes and screams. The guards will want a word (bounty)." : "You feed on a sleeping traveller. They'll wake up tired and none the wiser. Your hunger fades.";
  }
  function cureVampire(s) {
    if (!s.vampire) return "You're not a vampire.";
    const gem = s.inv.find((r) => r.item === "soul_gem_common");
    if (!gem || s.gold < CURE_VAMPIRE_GOLD) return `The court wizard's ritual needs a filled Common Soul Gem and ${CURE_VAMPIRE_GOLD} gold.`;
    G.take(s, gem.id, 1); s.gold -= CURE_VAMPIRE_GOLD; s.vampire = null;
    return "At dawn the wizard's ritual draws the darkness into the soul gem. Sunlight feels warm again.";
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
    if (p.beast > 0) m *= 1.8;
    if (s.vampire && G.isNight(f.t)) m *= 1 + 0.05 * stage(s, f.t);
    return m;
  }
  const dmgInMult = (f) => (f.pw?.beast > 0 ? 0.55 : 1);
  const noPotions = (f) => (f.pw?.beast || 0) > 0;
  /* Beast Form from tactics */
  function transform(f) {
    const s = f.s;
    if (!s._test) s.beastAt = f.t;
    f.pw.beast = BEAST_TURNS;
    f.hp = Math.min(G.maxHealth(s) * 1.5, f.hp + G.maxHealth(s) * 0.4);
    return "You throw your head back and howl: Beast Form!";
  }
  addItems();
  return { isWolf, offered, acceptWolf, declineWolf, cureWolf, beastReady, infected, maybeInfect, update, cureDisease, hoursUnfed, stage, feed, cureVampire,
    fx, dmgMult, dmgInMult, noPotions, transform, CURE_WEREWOLF, CURE_VAMPIRE_GOLD, BEAST_TURNS, TURN_AFTER };
})();
