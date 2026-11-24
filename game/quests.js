/* Quest lines: the main quest and three guilds. Story beats follow Skyrim's quests, retold in our own words.
   Each stage has one objective; most complete by themselves (go somewhere, clear a dungeon, carry an item),
   "talk" objectives need a tap when you're at the right place, and some of those start a fight. */
const QUESTS = (() => {
  const E = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 10, danger: "high", gold: [0, 0], text: "", qboss: tags.includes("elite"), ...extra })   // qboss: a boss fight (bossfight.js);
  Object.assign(D.ITEMS, {                                                           // [Skyrim] quest rewards (stats close to Skyrim's)
    wuuthrad: { name: "Wuuthrad", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 25, weight: 25, value: 2000 },
    horn_jurgen: { name: "Horn of Jurgen Windcaller", slot: "trophy", weight: 2, value: 100 },
    guild_armor: { name: "Thieves Guild Armor", slot: "chest", type: "light", armor: 29, weight: 6, value: 1000, aenchant: { key: "skill:Lockpicking", mag: 15, name: "Fortify Lockpicking" } },
    nightingale_armor: { name: "Nightingale Armor", slot: "chest", type: "light", armor: 34, weight: 12, value: 1800, aenchant: { key: "max:stamina", mag: 30, name: "Fortify Stamina" } },
    nightingale_blade: { name: "Nightingale Blade", slot: "weapon", hands: 1, skill: "One-Handed", damage: 14, weight: 14, value: 1600 },
    shrouded_armor: { name: "Shrouded Armor", slot: "chest", type: "light", armor: 29, weight: 7, value: 1100, aenchant: { key: "skill:Sneak", mag: 10, name: "Fortify Sneak" } },
    blade_of_woe: { name: "Blade of Woe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 7, value: 880 },
    archmage_robes: { name: "Arch-Mage's Robes", slot: "chest", type: "cloth", armor: 0, weight: 1, value: 2000, magicka_regen: 1.0, aenchant: { key: "max:magicka", mag: 50, name: "Fortify Magicka" } },
  });
  const L = {
    main: { name: "The Dragonborn", giver: "Main quest", stages: [
      { title: "Before the Storm", text: "Riverwood's smith says Whiterun must be warned about the dragon. Go to Whiterun.", obj: { go: "Whiterun" }, reward: { gold: 50 } },
      // Bleak Falls Barrow is two stages: clearing the barrow moves the quest on by itself (a clear from before counts too),
      // and Farengar's hand-in never needs the Dragonstone in your pack (it can be lost, stashed, left in a party pile...)
      { title: "Bleak Falls Barrow", text: "The court wizard Farengar wants a Dragonstone that lies at the end of Bleak Falls Barrow. Clear the barrow.", obj: { clear: "Bleak Falls Barrow", ever: true, or: "thaneWhiterun", orItem: "dragonstone" }, reward: { gold: 50 } },
      { title: "The Dragonstone", text: "You found the Dragonstone in Bleak Falls Barrow. Tell Farengar in Whiterun (Area tab, Court wizard).", obj: { flag: "thaneWhiterun", talk: "Whiterun", label: "Give Farengar the Dragonstone", deliver: true }, reward: { gold: 50 } },
      { title: "Dragon Rising", text: "A dragon is attacking the Western Watchtower. Go there and kill it.", obj: { talk: "Western Watchtower", label: "Fight the dragon", fight: E("Mirmulnir", 180, 17, ["big", "dragon", "elite"]), allies: [["Irileth", 9], ["Whiterun guard", 6], ["Whiterun guard", 6]] }, reward: { gold: 200 } },
      { title: "The Way of the Voice", text: "The Greybeards have summoned you. Climb to High Hrothgar and speak with them.", obj: { flag: "greybeards" }, reward: { gold: 100 } },
      { title: "The Horn of Jurgen Windcaller", text: "The Greybeards want the Horn of Jurgen Windcaller from Ustengrav. Clear Ustengrav.", obj: { clear: "Ustengrav" }, reward: { gold: 300, items: ["horn_jurgen"] } },
      { title: "A Blade in the Dark", text: "A dragon is being raised at its burial mound near Kynesgrove. Stop it.", obj: { talk: "Kynesgrove", label: "Climb the burial mound", fight: E("Sahloknir", 420, 30, ["big", "dragon", "elite"]), allies: [["Delphine", 12]] }, reward: { gold: 500 } },
    ] },
    companions: { name: "The Companions", giver: "Jorrvaskr, Whiterun", start: "Whiterun", stages: [
      { title: "Take Up Arms", text: "Kodlak wants to see what you can do. Spar with Vilkas in the yard of Jorrvaskr (nobody dies in a sparring match).", obj: { talk: "Whiterun", label: "Spar with Vilkas", fight: E("Vilkas", 110, 11, ["humanoid"]), nonlethal: true }, reward: { gold: 50 } },
      { title: "Proving Honor", text: "Find the fragment of Wuuthrad in Yngol Barrow and clear it.", obj: { clear: "Yngol Barrow" }, reward: { gold: 200 } },
      { title: "The Silver Hand", text: "The Silver Hand have holed up in Fort Greymoor. Clear them out.", obj: { clear: "Fort Greymoor" }, reward: { gold: 300 } },
      { title: "Glory of the Dead", text: "Return to Jorrvaskr. Kodlak's last wish rests with you.", obj: { talk: "Whiterun", label: "Speak with the Circle" }, reward: { gold: 500, items: ["wuuthrad"], title: "Harbinger of the Companions" } },
    ] },
    thieves: { name: "The Thieves Guild", giver: "Brynjolf, Riften", start: "Riften", stages: [
      { title: "A Chance Arrangement", text: "Brynjolf wants proof you have quick fingers. Pick a pocket in Riften (Area tab, Streets).", obj: { count: "pp", n: 1, at: "Riften" }, reward: { gold: 100 } },
      { title: "Taking Care of Business", text: "Prove you're worth the Guild's time: lift three more purses, anywhere.", obj: { count: "pp", n: 3 }, reward: { gold: 200 } },
      { title: "Loud and Clear", text: "A rival gang squats in Pinewatch. Clear it and take what's theirs.", obj: { clear: "Pinewatch" }, reward: { gold: 300, items: ["guild_armor"] } },
      { title: "Dampened Spirits", text: "Honningbrew Meadery outside Whiterun is stealing the Guild's customers. Slip in and spoil their mead.", obj: { talk: "Honningbrew Meadery", label: "Sneak into the meadery", check: { skill: "Sneak", need: 25, bounty: "Whiterun" } }, reward: { gold: 300 } },
      { title: "Scoundrel's Folly", text: "Something's wrong with Mercer Frey. Search his house in Riften for answers. His guard won't like it.", obj: { talk: "Riften", label: "Pick the lock on Mercer's house", check: { skill: "Lockpicking", need: 35, fight: E("Vald", 150, 14, ["humanoid"]) } }, reward: { gold: 400 } },
      { title: "Speaking With Silence", text: "Mercer has fled. Gallus's journal is in Snow Veil Sanctum. Clear it with Karliah.", obj: { clear: "Snow Veil Sanctum" }, reward: { gold: 400 } },
      { title: "Hard Answers", text: "Gallus wrote in old Falmer. Calcelmo in Markarth can read it. Get into his tower unseen.", obj: { talk: "Markarth", label: "Slip into Calcelmo's tower", check: { skill: "Sneak", need: 40, bounty: "The Reach" } }, reward: { gold: 400 } },
      { title: "Trinity Restored", text: "Karliah waits at Nightingale Hall. Take the oath of the Nightingales.", obj: { talk: "Nightingale Hall", label: "Swear the Nightingale oath" }, reward: { gold: 500, items: ["nightingale_armor"] } },
      { title: "Blindsighted", text: "Mercer is in the Dwemer ruin of Irkngthand, after the Eyes of the Falmer. Face him.", obj: { talk: "Irkngthand", label: "Confront Mercer Frey", fight: E("Mercer Frey", 420, 27, ["humanoid", "elite"]), allies: [["Karliah", 11], ["Brynjolf", 10]] }, reward: { gold: 600 } },
      { title: "Darkness Returns", text: "Return the Skeleton Key to the Twilight Sepulcher and restore the Guild's luck.", obj: { talk: "Twilight Sepulcher", label: "Return the Skeleton Key" }, reward: { gold: 1000, items: ["nightingale_blade"], flag: "guildThief", title: "Guild Master of the Thieves Guild" } },
    ] },
    brotherhood: { name: "The Dark Brotherhood", giver: "Aventus Aretino, Windhelm", start: "Windhelm", stages: [
      { title: "Innocence Lost", text: "A boy in Windhelm asks for Grelod the Kind, who runs the Riften orphanage, to be dealt with. Go to Riften.", obj: { talk: "Riften", label: "Deal with Grelod the Kind", fight: E("Grelod the Kind", 60, 5, ["humanoid"]) }, reward: { gold: 100 } },
      { title: "With Friends Like These…", text: "You wake in an abandoned shack. Astrid gives you a choice, then the way to the Sanctuary near Falkreath.", obj: { talk: "Dark Brotherhood Sanctuary", label: "Answer Astrid and open the Black Door" }, reward: { gold: 200, items: ["shrouded_armor", "blade_of_woe"] } },
      { title: "Bound Until Death", text: "A contract at a wedding in Solitude. Do it quietly if you can.", obj: { talk: "Solitude", label: "Fulfil the wedding contract", check: { skill: "Sneak", need: 30, fight: E("Penitus Oculatus guards", 180, 14, ["humanoid"]) } }, reward: { gold: 400 } },
      { title: "The Silence Has Been Broken", text: "The old Sanctuary in Dawnstar is the Family's new home. Go there.", obj: { talk: "Dawnstar Sanctuary", label: "Open the Dawnstar door" }, reward: { gold: 300 } },
      { title: "Breaching Security", text: "Get the Emperor's itinerary from a courier's lockbox at Dragon Bridge.", obj: { talk: "Dragon Bridge", label: "Open the lockbox", check: { skill: "Lockpicking", need: 40, bounty: "Haafingar" } }, reward: { gold: 400 } },
      { title: "The Cure for Madness", text: "Cicero, the Keeper, has turned on the Family. Stop him in the Dawnstar Sanctuary.", obj: { talk: "Dawnstar Sanctuary", label: "Face Cicero", fight: E("Cicero", 240, 19, ["humanoid", "elite"]) }, reward: { gold: 500 } },
      { title: "To Kill an Empire", text: "The Emperor's ship, the Katariah, is anchored off Solitude. Board it and fulfil the great contract.", obj: { talk: "Solitude", label: "Board the Katariah", fight: E("The Emperor's bodyguards", 265, 18, ["humanoid", "elite"]) }, reward: { gold: 800 } },
      { title: "Hail Sithis!", text: "Return to the Night Mother in the Dawnstar Sanctuary.", obj: { talk: "Dawnstar Sanctuary", label: "Speak with the Night Mother" }, reward: { gold: 2000, horse: "shadowmere", flag: "listener", title: "Listener of the Dark Brotherhood" } },
    ] },
    college: { name: "The College of Winterhold", giver: "Faralda, Winterhold", start: "Winterhold", stages: [
      { title: "First Lessons", text: "Show Faralda you can cast at the College bridge.", obj: { talk: "Winterhold", label: "Cast a spell for Faralda", needSpell: true }, reward: { gold: 50, items: ["tome_firebolt"] } },
      { title: "Under Saarthal", text: "Join the expedition to Saarthal and clear it.", obj: { clear: "Saarthal" }, reward: { gold: 200 } },
      { title: "Good Intentions", text: "The Psijic Order warns of danger. Find answers in the Dwemer ruin of Mzulft.", obj: { clear: "Mzulft" }, reward: { gold: 300 } },
      { title: "The Eye of Magnus", text: "Return to the College and stand against what you woke.", obj: { talk: "Winterhold", label: "Face Ancano", fight: E("Ancano", 210, 19, ["humanoid", "mage", "elite"]) }, reward: { gold: 500, items: ["archmage_robes"], title: "Arch-Mage of the College" } },
    ] },
  };
  /* [OURS] recommended level per stage (shown in the Journal); a stage's fight scales from it (G.scaleQuestFoe) */
  const REC = { main: [1, 3, 3, 6, 10, 14, 18], companions: [3, 6, 10, 14], thieves: [2, 3, 6, 8, 10, 14, 16, 18, 22, 24],
    brotherhood: [3, 5, 10, 12, 14, 18, 22, 24], college: [2, 6, 10, 16], masks: [20, 21, 23, 24, 26, 27, 29, 30, 30] };
  const recOf = (id, i) => (REC[id] || [])[i] ?? (L[id]?.stages[i]?.rec || 0);
  const foeFor = (s, id, i, def) => G.scaleQuestFoe({ ...def }, G.fightLevel ? G.fightLevel(s) : s.level, recOf(id, i));
  const q = (s) => (s.quests = s.quests || {});
  function ensure(s) {
    if (!q(s).main) q(s).main = { stage: 0, t: G.now(), bf: 1 };   // everyone is on the main quest
    const m = q(s).main;   // Bleak Falls Barrow became two stages (clear it, then tell Farengar): later stages of old saves move up one
    if (!m.bf) { m.bf = 1; if (!m.done && m.stage >= 2) m.stage++; }
    const th = q(s).thieves;   // the Thieves Guild line grew from 4 to 10 stages: finished old runs pick up the new chapters
    if (!q(s).masks && L.masks && typeof PRIESTS !== "undefined" && PRIESTS.shouldStart(s)) { q(s).masks = { stage: 0, t: G.now() }; G.note(s, " New quest: Masks of the Dragon Priests (Journal)."); }   // [Skyrim] the dragon priests
    if (th && !th.v2) { th.v2 = true; if (th.done) { th.done = false; th.stage = 3; th.t = G.now(); G.note(s, " Brynjolf has more work for you: the Thieves Guild story goes on (Journal)."); } }
  }
  const stageOf = (s, id, v) => { const st = L[id].stages[v.stage]; return typeof PRIESTS !== "undefined" ? PRIESTS.stageFor(s, st) : st; };   // masks: the next ruin filled in
  const active = (s) => Object.entries(q(s)).filter(([id, v]) => !v.done && L[id]).map(([id, v]) => ({ id, ...v, def: L[id], st: stageOf(s, id, v) }));
  const canJoin = (s, id) => L[id].start && !q(s)[id] && s.location === L[id].start;
  function join(s, id) {
    if (!canJoin(s, id)) return "You can only join where they are.";
    q(s)[id] = { stage: 0, t: G.now(), base: { ...(s.stats || {}) } };
    return `${L[id].name}: ${L[id].stages[0].title}. ${L[id].stages[0].text}`;
  }
  /* the quest you chose to track in the Journal (or the first active one) */
  const tracked = (s) => { const a = active(s); return a.find((x) => x.id === s.trackQ) || a[0] || null; };
  function target(st) { const o = st.obj; return o.go || o.clear || o.talk || o.at || (o.flag === "thaneWhiterun" ? "Whiterun" : o.flag === "greybeards" ? "High Hrothgar" : null); }
  function met(s, id, st, v) {
    const o = st.obj;
    if (o.masks) return typeof PRIESTS !== "undefined" && PRIESTS.count(s) >= o.masks;
    if (o.go) return s.location === o.go;
    if ((o.or && s[o.or]) || (o.orItem && (s.inv || []).some((r) => r.item === o.orItem))) return true;
    if (o.clear) return o.ever ? !!(s.cleared || {})[o.clear] : (s.cleared || {})[o.clear] >= v.t;
    if (o.flag) return !!s[o.flag];
    if (o.count) { const have = ((s.stats || {})[o.count] || 0) - ((v.base || {})[o.count] || 0); return have >= o.n && (!o.at || s.location === o.at); }
    return false;   // talk objectives need a tap
  }
  function advance(s, id, msgs) {
    const v = q(s)[id], st = L[id].stages[v.stage], r = st.reward || {};
    if (r.gold) s.gold += r.gold;
    (r.items || []).forEach((i) => G.give(s, i));
    if (r.flag) s[r.flag] = true;
    if (r.title && !(s.titles || []).includes(r.title)) s.titles = [...(s.titles || []), r.title];
    if (r.horse && typeof GUILDS !== "undefined") GUILDS.giveHorse(s, r.horse, msgs);
    const got = [r.gold ? `${r.gold} gold` : "", ...(r.items || []).map((i) => D.ITEMS[i].name), r.title ? `the title ${r.title}` : ""].filter(Boolean).join(", ");
    msgs.push(` ${L[id].name}: “${st.title}” done${got ? ` (${got})` : ""}.`);
    G.note(s, msgs[msgs.length - 1]);
    v.stage++; v.t = G.now(); v.base = { ...(s.stats || {}) };
    if (v.stage >= L[id].stages.length) { v.done = true; msgs.push(` ${L[id].name} complete!`); }
    else msgs.push(`New objective: ${L[id].stages[v.stage].title}. ${L[id].stages[v.stage].text}`);
  }
  /* run after anything that might finish an objective; returns messages */
  function check(s) {
    ensure(s);
    const msgs = [];
    for (let guard = 0; guard < 8; guard++) {
      const a = active(s).find((x) => met(s, x.id, x.st, q(s)[x.id]));
      if (!a) break;
      advance(s, a.id, msgs);
    }
    return msgs;
  }
  /* the tap for "talk" objectives. Returns {text, fight?, died?, bag?, msgs} */
  function talk(s, id, t = G.now()) {
    const v = q(s)[id]; if (!v || v.done) return { text: "Nothing to do." };
    const st = L[id].stages[v.stage], o = st.obj;
    if (!o.talk) return { text: "Not this way." };
    if (s.location !== o.talk) return { text: `Go to ${o.talk} first.` };
    if (o.need) { const why = o.need(s); if (why) return { text: why }; }
    if (o.deliver && typeof TOWNS !== "undefined") { const text = TOWNS.deliverDragonstone(s); return { text, msgs: QUESTS.check(s) }; }   // the hand-in lives in towns.js (the Area tab uses it too)
    if (o.needSpell && !s.spells.some((sp) => D.SPELLS[sp]?.kind === "damage")) return { text: "You need a destruction spell to show her." };
    const msgs = [];
    let fightDef = o.fight, quiet = "";
    if (o.check) {   // [OURS] a skill check: Sneak, Lockpicking or Pickpocket against the stage's difficulty
      if ((v.retryAt || 0) > t) return { text: `Lie low for a while first (about ${Math.ceil((v.retryAt - t) / 60)} min).` };
      const ch = checkChance(s, o.check);
      if (Math.random() < ch) { quiet = `${o.check.skill} ${G.skill(s, o.check.skill)}: done without a sound. `; G.useSkill(s, o.check.skill, 20); fightDef = null; }
      else if (o.check.fight) { quiet = "You're spotted! "; fightDef = o.check.fight; }
      else {
        v.retryAt = t + 300;
        if (o.check.bounty && typeof TOWNS !== "undefined") TOWNS.addBounty(s, o.check.bounty, "theft", 100);
        return { text: `You're spotted and have to run.${o.check.bounty ? ` Bounty in ${o.check.bounty}: +100 gold.` : ""} Try again later, or train ${o.check.skill} (${Math.round(ch * 100)}% chance now).` };
      }
    }
    if (fightDef) { const o2 = { ...o, fight: fightDef };
      const e = foeFor(s, id, v.stage, o2.fight);
      const f = new G.Fight(s, e, null, t);
      (o.allies || []).forEach(([name, dmg]) => f.allies.push({ name, dmg }));   // [Skyrim] you don't face these alone
      f.run({ t }); const skills = f.apply(t);
      if (!f.won) {
        if (o.nonlethal) { G.setHealth(s, G.maxHealth(s) * 0.25, t); return { text: `${e.name} puts you on your back. "Again, when you're ready."`, fight: f, skills }; }
        const d = G.die(s, e.name, t, true); return { text: `${e.name} was too much for you.`, fight: f, skills, died: d.msg, bag: d.bag };
      }
      advance(s, id, msgs);
      return { text: quiet + (o.nonlethal ? `You win the bout. Vilkas grunts approval.` : `${e.name} falls.`), fight: f, skills, msgs };
    }
    advance(s, id, msgs);
    return { text: quiet + st.title, msgs };
  }
  /* chance to pass a stage's skill check: 50% at the needed level, +/-1% per point ([OURS]) */
  function checkChance(s, c) { return Math.max(0.15, Math.min(0.95, 0.5 + (G.skill(s, c.skill) - c.need) / 60)); }
  return { L, REC, recOf, foeFor, ensure, active, tracked, canJoin, join, target, check, talk, checkChance, advance, list: () => Object.keys(L) };
})();
