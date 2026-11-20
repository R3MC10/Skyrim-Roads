/* Quest lines: the main quest and three guilds. Story beats follow Skyrim's quests, retold in our own words.
   Each stage has one objective; most complete by themselves (go somewhere, clear a dungeon, carry an item),
   "talk" objectives need a tap when you're at the right place, and some of those start a fight. */
const QUESTS = (() => {
  const E = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 10, danger: "high", gold: [0, 0], text: "", ...extra });
  Object.assign(D.ITEMS, {                                                           // [Skyrim] quest rewards (stats close to Skyrim's)
    wuuthrad: { name: "Wuuthrad", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 25, weight: 25, value: 2000 },
    horn_jurgen: { name: "Horn of Jurgen Windcaller", slot: "trophy", weight: 2, value: 100 },
    guild_armor: { name: "Thieves Guild Armor", slot: "chest", type: "light", armor: 29, weight: 6, value: 1000, aenchant: { key: "skill:Lockpicking", mag: 15, name: "Fortify Lockpicking" } },
    archmage_robes: { name: "Arch-Mage's Robes", slot: "chest", type: "cloth", armor: 0, weight: 1, value: 2000, magicka_regen: 1.0, aenchant: { key: "max:magicka", mag: 50, name: "Fortify Magicka" } },
  });
  const L = {
    main: { name: "The Dragonborn", giver: "Main quest", stages: [
      { title: "Before the Storm", text: "Riverwood's smith says Whiterun must be warned about the dragon. Go to Whiterun.", obj: { go: "Whiterun" }, reward: { gold: 50 } },
      { title: "Bleak Falls Barrow", text: "The court wizard Farengar wants a Dragonstone from Bleak Falls Barrow. Bring it to him in Whiterun (Town tab, Dragonsreach).", obj: { flag: "thaneWhiterun" }, reward: { gold: 100 } },
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
      { title: "A Chance Arrangement", text: "Brynjolf wants proof you have quick fingers. Pick a pocket in Riften (Town tab, Streets).", obj: { count: "pp", n: 1, at: "Riften" }, reward: { gold: 100 } },
      { title: "Taking Care of Business", text: "Prove you're worth the Guild's time: lift three more purses, anywhere.", obj: { count: "pp", n: 3 }, reward: { gold: 200 } },
      { title: "Loud and Clear", text: "A rival gang squats in Pinewatch. Clear it and take what's theirs.", obj: { clear: "Pinewatch" }, reward: { gold: 300 } },
      { title: "Darkness Returns", text: "Return to the Ragged Flagon in Riften.", obj: { talk: "Riften", label: "Go down to the Ragged Flagon" }, reward: { gold: 500, items: ["guild_armor"], flag: "guildThief", title: "Guild Master of the Thieves Guild" } },
    ] },
    college: { name: "The College of Winterhold", giver: "Faralda, Winterhold", start: "Winterhold", stages: [
      { title: "First Lessons", text: "Show Faralda you can cast at the College bridge.", obj: { talk: "Winterhold", label: "Cast a spell for Faralda", needSpell: true }, reward: { gold: 50, items: ["tome_firebolt"] } },
      { title: "Under Saarthal", text: "Join the expedition to Saarthal and clear it.", obj: { clear: "Saarthal" }, reward: { gold: 200 } },
      { title: "Good Intentions", text: "The Psijic Order warns of danger. Find answers in the Dwemer ruin of Mzulft.", obj: { clear: "Mzulft" }, reward: { gold: 300 } },
      { title: "The Eye of Magnus", text: "Return to the College and stand against what you woke.", obj: { talk: "Winterhold", label: "Face Ancano", fight: E("Ancano", 260, 24, ["humanoid", "mage", "elite"]) }, reward: { gold: 500, items: ["archmage_robes"], title: "Arch-Mage of the College" } },
    ] },
  };
  const q = (s) => (s.quests = s.quests || {});
  function ensure(s) { if (!q(s).main) q(s).main = { stage: 0, t: G.now() }; }   // everyone is on the main quest
  const active = (s) => Object.entries(q(s)).filter(([id, v]) => !v.done && L[id]).map(([id, v]) => ({ id, ...v, def: L[id], st: L[id].stages[v.stage] }));
  const canJoin = (s, id) => L[id].start && !q(s)[id] && s.location === L[id].start;
  function join(s, id) {
    if (!canJoin(s, id)) return "You can only join where they are.";
    q(s)[id] = { stage: 0, t: G.now(), base: { ...(s.stats || {}) } };
    return `${L[id].name}: ${L[id].stages[0].title}. ${L[id].stages[0].text}`;
  }
  function target(st) { const o = st.obj; return o.go || o.clear || o.talk || o.at || (o.flag === "thaneWhiterun" ? "Whiterun" : o.flag === "greybeards" ? "High Hrothgar" : null); }
  function met(s, id, st, v) {
    const o = st.obj;
    if (o.go) return s.location === o.go;
    if (o.clear) return (s.cleared || {})[o.clear] >= v.t;
    if (o.flag) return !!s[o.flag];
    if (o.count) { const have = ((s.stats || {})[o.count] || 0) - ((v.base || {})[o.count] || 0); return have >= o.n && (!o.at || s.location === o.at); }
    return false;   // talk objectives need a tap
  }
  function advance(s, id, msgs) {
    const v = q(s)[id], st = L[id].stages[v.stage], r = st.reward || {};
    if (r.gold) s.gold += r.gold;
    (r.items || []).forEach((i) => G.give(s, i));
    if (r.flag) s[r.flag] = true;
    if (r.title) s.titles = [...(s.titles || []), r.title];
    const got = [r.gold ? `${r.gold} gold` : "", ...(r.items || []).map((i) => D.ITEMS[i].name), r.title ? `the title ${r.title}` : ""].filter(Boolean).join(", ");
    msgs.push(`📜 ${L[id].name}: “${st.title}” done${got ? ` (${got})` : ""}.`);
    G.note(s, msgs[msgs.length - 1]);
    v.stage++; v.t = G.now(); v.base = { ...(s.stats || {}) };
    if (v.stage >= L[id].stages.length) { v.done = true; msgs.push(`🏆 ${L[id].name} complete!`); }
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
    if (o.needSpell && !s.spells.some((sp) => D.SPELLS[sp]?.kind === "damage")) return { text: "You need a destruction spell to show her." };
    const msgs = [];
    if (o.fight) {
      const e = G.scaleEnemy({ ...o.fight }, s.level);
      const f = new G.Fight(s, e, null, t);
      (o.allies || []).forEach(([name, dmg]) => f.allies.push({ name, dmg }));   // [Skyrim] you don't face these alone
      f.run({ t }); const skills = f.apply(t);
      if (!f.won) {
        if (o.nonlethal) { G.setHealth(s, G.maxHealth(s) * 0.25, t); return { text: `${e.name} puts you on your back. "Again, when you're ready."`, fight: f, skills }; }
        const d = G.die(s, e.name, t, true); return { text: `${e.name} was too much for you.`, fight: f, skills, died: d.msg, bag: d.bag };
      }
      advance(s, id, msgs);
      return { text: o.nonlethal ? `You win the bout. Vilkas grunts approval.` : `${e.name} falls.`, fight: f, skills, msgs };
    }
    advance(s, id, msgs);
    return { text: st.title, msgs };
  }
  return { L, ensure, active, canJoin, join, target, check, talk, list: () => Object.keys(L) };
})();
