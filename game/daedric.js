/* [Skyrim] The Daedric Princes: thirteen princes, each with a shrine or a servant somewhere in Skyrim, a quest, and an
   artifact. Story beats follow Skyrim's Daedric quests, retold in our own words and cut down to a few stages.
   Every artifact does something in a fight or out of it ([OURS] numbers sized to the game's quest rewards):
   weapons through DAEDRIC.onHit, armor through worn enchantments (plus DAEDRIC.onEnemy for the Ebony Mail's cloak),
   and the carried ones (Azura's Star, the Sanguine Rose, the Wabbajack) work from your pack. */
const DAEDRIC = (() => {
  const E = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 10, danger: "high", gold: [0, 0], text: "", qboss: tags.includes("elite"), ...extra })   // qboss: a boss fight (bossfight.js);
  // ---- the artifacts ([Skyrim] names and close-to-Skyrim stats; ids keep the weapon type the engine reads from them)
  Object.assign(D.ITEMS, {
    azuras_star: { name: "Azura's Star", slot: "trophy", weight: 1, value: 1500, dae: "star", noTrade: true, desc: "Carried: after a fight you win, it catches the soul and refills a fifth of your weapon's enchantment." },
    ebony_mail: { name: "Ebony Mail", slot: "chest", type: "heavy", armor: 45, weight: 28, value: 5000, desc: "A poison cloak hurts foes every turn, and you move more quietly.", noTrade: true,
      aenchant: { key: "dae:cloak", mag: 1, name: "Poison cloak", more: [{ key: "skill:Sneak", mag: 15, name: "Fortify Sneak" }] } },
    masque_clavicus: { name: "Masque of Clavicus Vile", slot: "head", type: "light", armor: 20, weight: 6, value: 1100, noTrade: true,
      aenchant: { key: "barter", mag: 20, name: "Fortify Barter", more: [{ key: "skill:Speechcraft", mag: 20, name: "Fortify Speechcraft" }, { key: "regen:magicka", mag: 5, name: "Regenerate Magicka" }] } },
    oghma_infinium: { name: "Oghma Infinium", slot: "trophy", weight: 1, value: 2500, noTrade: true, desc: "Read once: five levels in each of three skills of your path." },
    saviors_hide: { name: "Savior's Hide", slot: "chest", type: "light", armor: 26, weight: 6, value: 2700, noTrade: true,
      aenchant: { key: "resist", mag: 25, name: "Resist Magic", more: [{ key: "max:health", mag: 20, name: "Fortify Health" }] } },
    volendrung_warhammer: { name: "Volendrung", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 25, weight: 26, value: 1843, dae: "volendrung", desc: "Each hit drinks 10 of their stamina into yours.", noTrade: true },
    mehrunes_razor_dagger: { name: "Mehrunes' Razor", slot: "weapon", hands: 1, skill: "One-Handed", damage: 11, weight: 3, value: 860, dae: "razor", desc: "Each hit has a small chance to slay the foe outright (tough foes and bosses just take a deep cut).", noTrade: true },
    dawnbreaker: { name: "Dawnbreaker", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 10, value: 1000, dae: "dawn", desc: "Each hit burns with sun fire (+10), more against the undead; sometimes Meridia's light bursts.", noTrade: true },
    molag_bal_mace: { name: "Mace of Molag Bal", slot: "weapon", hands: 1, skill: "One-Handed", damage: 16, weight: 18, value: 1257, dae: "molag", desc: "Each hit drains 10 stamina and 10 magicka from them into you.", noTrade: true },
    spellbreaker: { name: "Spellbreaker", slot: "shield", type: "heavy", armor: 38, weight: 12, value: 500, noTrade: true,
      aenchant: { key: "resist", mag: 30, name: "Resist Magic" } },
    sanguine_rose: { name: "Sanguine Rose", slot: "trophy", weight: 1, value: 2087, dae: "rose", noTrade: true, desc: "Carried: a Dremora answers its call and fights at your side in every fight." },
    wabbajack: { name: "Wabbajack", slot: "trophy", weight: 1, value: 1565, dae: "wabbajack", noTrade: true, desc: "Carried: once a fight, Sheogorath's staff does... something. Usually helpful." },
    ebony_blade_greatsword: { name: "Ebony Blade", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 21, weight: 10, value: 2000, dae: "ebony", desc: "Each hit heals you for a tenth of the damage.", noTrade: true },
  });
  const P = (prince, art, place, minLevel, name, start, giver, stages) => ({ prince, art, minLevel, name, start, giver: `${giver} (from level ${minLevel})`, place, daedric: true, stages });
  const L = {
    dae_azura: P("Azura", "azuras_star", "Shrine of Azura", 10, "Azura's Star", "Shrine of Azura", "Aranea Ienith, Shrine of Azura", [
      { title: "The Black Star", rec: 10, text: "Azura's priestess says her prince's Star was stolen and twisted. A mage in Winterhold knows more. Go to Winterhold.", obj: { go: "Winterhold" }, reward: { gold: 50 } },
      { title: "Ilinalta's Deep", rec: 12, text: "The Star lies with a dead necromancer in Ilinalta's Deep, a sunken fort on the lake. Clear it.", obj: { clear: "Ilinalta's Deep" }, reward: { gold: 150 } },
      { title: "Return to Azura", rec: 13, text: "Bring the Star back to Azura's shrine and let her cleanse it.", obj: { talk: "Shrine of Azura", label: "Give the Star to Azura" }, reward: { gold: 200, items: ["azuras_star"] } },
    ]),
    dae_boethiah: P("Boethiah", "ebony_mail", "Shrine of Boethiah", 30, "Boethiah's Calling", "Shrine of Boethiah", "Boethiah's cultists, Shrine of Boethiah", [
      { title: "The Sacrifice", rec: 30, text: "Boethiah wants proof of betrayal. Her cultists make you fight one of their own to the death on the pillar.", obj: { talk: "Shrine of Boethiah", label: "Fight on the pillar", fight: E("Boethiah's cultist", 200, 18, ["humanoid"]) }, reward: { gold: 100 } },
      { title: "The Champion", rec: 31, text: "Boethiah's old champion has grown weak. Find him at Knifepoint Ridge and kill him.", obj: { talk: "Knifepoint Ridge", label: "Face Boethiah's champion", fight: E("Boethiah's champion", 320, 24, ["humanoid", "elite"]) }, reward: { gold: 300, items: ["ebony_mail"] } },
    ]),
    dae_clavicus: P("Clavicus Vile", "masque_clavicus", "Haemar's Shame", 10, "A Daedra's Best Friend", "Falkreath", "Barbas the dog, Falkreath", [
      { title: "A Talking Dog", rec: 10, text: "A dog in Falkreath talks. Barbas wants to go home to his master, Clavicus Vile, in Haemar's Shame. Clear the way.", obj: { clear: "Haemar's Shame" }, reward: { gold: 100 } },
      { title: "The Rueful Axe", rec: 12, text: "Vile wants the Rueful Axe from Rimerock Burrow. A cursed mage keeps it there.", obj: { talk: "Rimerock Burrow", label: "Take the Rueful Axe", fight: E("Sebastian Lort", 210, 19, ["humanoid", "mage", "elite"]) }, reward: { gold: 150 } },
      { title: "Vile's Bargain", rec: 12, text: "Bring the axe back to the shrine in Haemar's Shame. Keep the dog. Take the Masque.", obj: { talk: "Haemar's Shame", label: "Strike the bargain" }, reward: { gold: 100, items: ["masque_clavicus"] } },
    ]),
    dae_hermaeus: P("Hermaeus Mora", "oghma_infinium", "Winterhold", 15, "Discerning the Transmundane", "Winterhold", "Septimus Signus, north of Winterhold", [
      { title: "The Dwemer Lexicon", rec: 15, text: "Septimus Signus wants a Dwemer lexicon to open a box of old knowledge. Find one in Alftand.", obj: { clear: "Alftand" }, reward: { gold: 150 } },
      { title: "The Seekers", rec: 17, text: "Opening the box draws Hermaeus Mora's Seekers. Survive them at Septimus's outpost.", obj: { talk: "Winterhold", label: "Open the box", fight: E("Seekers of Hermaeus Mora", 260, 20, ["mage", "elite"]) }, reward: { gold: 200, items: ["oghma_infinium"], flag: "daeOghma" } },
    ]),
    dae_hircine: P("Hircine", "saviors_hide", "Falkreath", 10, "Ill Met by Moonlight", "Falkreath", "Mathies, Falkreath", [
      { title: "The Falkreath Jail", rec: 10, text: "A man named Sinding killed a girl in Falkreath and broke out of jail. He fled to Bloated Man's Grotto. Clear it.", obj: { clear: "Bloated Man's Grotto" }, reward: { gold: 100 } },
      { title: "The Great Hunt", rec: 12, text: "Hircine's hunters chase Sinding through the grotto. Hunt the beast down with them.", obj: { talk: "Bloated Man's Grotto", label: "Hunt Sinding", fight: E("Sinding, in beast form", 260, 21, ["beast", "elite"]), allies: [["Hircine's hunter", 7], ["Hircine's hunter", 7]] }, reward: { gold: 250, items: ["saviors_hide"] } },
    ]),
    dae_malacath: P("Malacath", "volendrung_warhammer", "Largashbur", 9, "The Cursed Tribe", "Largashbur", "Atub, Largashbur", [
      { title: "The Giant at the Gate", rec: 9, text: "A giant is beating down Largashbur's gate and the tribe is cursed and weak. Help them drive it off.", obj: { talk: "Largashbur", label: "Fight the giant", fight: E("Giant", 230, 22, ["big"]), allies: [["Yamarz", 6], ["Atub", 5]] }, reward: { gold: 100 } },
      { title: "Shagrol's Hammer", rec: 11, text: "Malacath wants Shagrol's Hammer from Dushnikh Yal. Ask for it there.", obj: { talk: "Dushnikh Yal", label: "Take Shagrol's Hammer" }, reward: { gold: 50 } },
      { title: "Gorgon", rec: 12, text: "Yamarz, the tribe's chief, must kill the giant Gorgon in Bonechill Passage. He won't be much help. Go anyway.", obj: { talk: "Bonechill Passage", label: "Face Gorgon", fight: E("Gorgon the giant", 330, 26, ["big", "elite"]), allies: [["Yamarz", 5]] }, reward: { gold: 300, items: ["volendrung_warhammer"] } },
    ]),
    dae_dagon: P("Mehrunes Dagon", "mehrunes_razor_dagger", "Shrine of Mehrunes Dagon", 20, "Pieces of the Past", "Dawnstar", "Silus Vesuius, Dawnstar", [
      { title: "The Hilt", rec: 20, text: "Silus Vesuius collects the broken pieces of Mehrunes' Razor. A piece is hidden in Cracked Tusk Keep.", obj: { clear: "Cracked Tusk Keep" }, reward: { gold: 150 } },
      { title: "The Blade", rec: 21, text: "The blade itself is with a Forsworn band in Dead Crone Rock ([OURS] where we keep it).", obj: { clear: "Dead Crone Rock" }, reward: { gold: 150 } },
      { title: "The Shrine", rec: 22, text: "Take the pieces to the Shrine of Mehrunes Dagon. Dagon wants Silus dead before he'll mend the Razor.", obj: { talk: "Shrine of Mehrunes Dagon", label: "Do what Dagon asks", fight: E("Silus Vesuius", 150, 12, ["humanoid"]) }, reward: { gold: 250, items: ["mehrunes_razor_dagger"] } },
    ]),
    dae_meridia: P("Meridia", "dawnbreaker", "Statue to Meridia", 12, "The Break of Dawn", "Statue to Meridia", "Meridia's beacon, Statue to Meridia", [
      { title: "Meridia's Beacon", rec: 12, text: "Meridia's light shows you Kilkreath Ruins, her temple, full of the dead. Clear it.", obj: { clear: "Kilkreath Ruins" }, reward: { gold: 150 } },
      { title: "Malkoran", rec: 14, text: "The necromancer Malkoran defiles her temple. Light the way to him and end him.", obj: { talk: "Kilkreath Ruins", label: "Face Malkoran", fight: E("Malkoran", 270, 21, ["humanoid", "mage", "elite"]) }, reward: { gold: 250, items: ["dawnbreaker"] } },
    ]),
    dae_molag: P("Molag Bal", "molag_bal_mace", "Markarth", 15, "The House of Horrors", "Markarth", "Tyranus, Markarth", [
      { title: "The Abandoned House", rec: 15, text: "A Vigilant of Stendarr wants to search an empty house in Markarth. Something in it speaks to you.", obj: { talk: "Markarth", label: "Search the house", fight: E("Molag Bal's thralls", 200, 17, ["humanoid", "undead"]) }, reward: { gold: 100 } },
      { title: "Logrolf the Willful", rec: 17, text: "Molag Bal wants the priest Logrolf brought to him. Find him at Fort Greymoor's old cells ([OURS]) and break his will.", obj: { talk: "Fort Greymoor", label: "Break Logrolf", fight: E("Logrolf the Willful", 230, 19, ["humanoid", "elite"]) }, reward: { gold: 250, items: ["molag_bal_mace"] } },
    ]),
    dae_peryite: P("Peryite", "spellbreaker", "Bthardamz", 12, "The Only Cure", "Clearspring Tarn", "Kesh the Clean, Clearspring Tarn", [
      { title: "The Offering", rec: 12, text: "Kesh can speak to Peryite. Bring him the offering and listen.", obj: { talk: "Clearspring Tarn", label: "Burn the offering" }, reward: { gold: 50 } },
      { title: "Bthardamz", rec: 14, text: "Peryite's mad followers hide in the Dwemer ruin of Bthardamz. Clear it.", obj: { clear: "Bthardamz" }, reward: { gold: 150 } },
      { title: "Orchendor", rec: 15, text: "Their leader Orchendor waits at the bottom. End him for Peryite.", obj: { talk: "Bthardamz", label: "Face Orchendor", fight: E("Orchendor", 260, 21, ["humanoid", "mage", "elite"]) }, reward: { gold: 250, items: ["spellbreaker"] } },
    ]),
    dae_sanguine: P("Sanguine", "sanguine_rose", "Morvunskar", 14, "A Night to Remember", "Whiterun", "Sam Guevenne, the Bannered Mare, Whiterun", [
      { title: "A Drinking Contest", rec: 14, text: "A cheerful stranger in the Bannered Mare bets you a staff you can't outdrink him.", obj: { talk: "Whiterun", label: "Drink with Sam" }, reward: { gold: 20 } },
      { title: "The Morning After", rec: 14, text: "You wake in Markarth's temple with no memory. The priestess wants you to clean up your mess. Start in Markarth.", obj: { go: "Markarth" }, reward: { gold: 30 } },
      { title: "Rorikstead", rec: 15, text: "A farmer in Rorikstead says you stole his goat and sold it to a giant. Go and set it right.", obj: { go: "Rorikstead" }, reward: { gold: 50 } },
      { title: "Morvunskar", rec: 16, text: "The trail ends at Morvunskar, where mages guard the way to Sam. Fight through.", obj: { talk: "Morvunskar", label: "Find Sam", fight: E("Morvunskar's mages", 240, 20, ["humanoid", "mage", "elite"]) }, reward: { gold: 250, items: ["sanguine_rose"] } },
    ]),
    dae_sheogorath: P("Sheogorath", "wabbajack", "Solitude", 8, "The Mind of Madness", "Solitude", "Pelagius Wing, Blue Palace, Solitude", [
      { title: "The Pelagius Wing", rec: 8, text: "A locked wing of Solitude's palace. Step inside and you're somewhere else: the mind of a mad emperor.", obj: { talk: "Solitude", label: "Enter the Pelagius Wing" }, reward: { gold: 20 } },
      { title: "Night Terrors", rec: 10, text: "Sheogorath wants you to fix Pelagius's mind. His nightmares fight back.", obj: { talk: "Solitude", label: "Calm the night terrors", fight: E("Pelagius's night terrors", 180, 15, ["mage"]), nonlethal: true }, reward: { gold: 100 } },
      { title: "Wake Up", rec: 10, text: "Tell Sheogorath the job is done.", obj: { talk: "Solitude", label: "Talk to Sheogorath" }, reward: { gold: 100, items: ["wabbajack"] } },
    ]),
    dae_mephala: P("Mephala", "ebony_blade_greatsword", "Whiterun", 12, "The Whispering Door", "Whiterun", "Dragonsreach, Whiterun", [
      { title: "Whispers", rec: 12, text: "A locked door in Dragonsreach whispers to you. Balgruuf's son says it's haunted.", obj: { talk: "Whiterun", label: "Listen at the door", need: (s) => ((s.quests || {}).main?.stage ?? 0) > QUESTS.L.main.stages.findIndex((x) => x.title === "Dragon Rising") || (s.quests || {}).main?.done ? null : "The Jarl doesn't trust you yet. Deal with the dragon at the Western Watchtower first." }, reward: { gold: 50 } },
      { title: "The Whispering Door", rec: 13, text: "The Jarl's steward holds the key. Pick the lock instead.", obj: { talk: "Whiterun", label: "Pick the lock", check: { skill: "Lockpicking", need: 25, bounty: "Whiterun" } }, reward: { gold: 150, items: ["ebony_blade_greatsword"] } },
    ]),
  };
  const LINES = Object.keys(L);
  const PRINCES = LINES.map((id) => ({ id, prince: L[id].prince, shrine: L[id].place, art: L[id].art }));

  // ---- the Journal: a prince calls once you're strong enough and you know where to look
  const known = (s, n) => (s.discovered || []).includes(n) || (["city", "town"].includes(WORLD.places[n]?.[2]) && !WORLD.hidden?.has(n));
  function gate(s, id) { const d = L[id]; if (!d) return null; return (s.level || 1) < d.minLevel ? `${d.prince} pays you no mind yet. Come back at level ${d.minLevel}.` : null; }
  const visible = (s, id) => !L[id] || known(s, L[id].start) || s.location === L[id].start;
  const has = (s, item) => (s.inv || []).some((r) => r.item === item);
  const count = (s) => LINES.filter((id) => (s.quests || {})[id]?.done).length;

  // ---- one-time rewards
  const OGHMA = { Warrior: "Path of Might", Mage: "Path of Magic", Thief: "Path of Shadow" };
  function readOghma(s) {
    if (!s.daeOghma || s.daeOghmaRead) return [];
    s.daeOghmaRead = true;
    const grp = Object.keys(OGHMA).map((g) => [g, D.SKILL_GROUPS[g].filter((k) => s.skills[k] && s.skills[k].lvl < 100).sort((a, b) => s.skills[b].lvl - s.skills[a].lvl).slice(0, 3)])
      .sort((a, b) => b[1].reduce((t, k) => t + s.skills[k].lvl, 0) - a[1].reduce((t, k) => t + s.skills[k].lvl, 0))[0];
    const msgs = [` You read the Oghma Infinium and walk the ${OGHMA[grp[0]]}.`];
    for (const k of grp[1]) { const sk = s.skills[k]; for (let i = 0; i < 5 && sk.lvl < 100; i++) { const was = sk.lvl; sk.xp = Math.max(sk.xp, F.skillXpNeeded(k, sk.lvl)); msgs.push(...G.useSkill(s, k, 0)); if (sk.lvl === was) break; } }
    G.note(s, msgs[0]);
    return msgs;
  }
  const sync = (s) => readOghma(s);

  // ---- the artifacts in a fight
  const tagged = (f, t) => f.tags?.has ? f.tags.has(t) : (f.e.tags || []).includes(t);
  /* your swing with a Daedric weapon: returns {dmg, label} */
  function onHit(f, dmg) {
    const k = f.weapon?.dae, s = f.s; let label = "";
    if (k === "razor" && Math.random() < 0.03) {   // [Skyrim] a small chance to slay outright
      if (!tagged(f, "elite") && !tagged(f, "dragon") && !f.e.priest) { dmg = Math.max(dmg, f.ehp); label = " · Mehrunes' Razor slays them outright"; }
      else { dmg *= 1.5; label = " · the Razor bites deep"; }
    }
    if (k === "dawn") { dmg += 10; label = " +sun fire"; if (tagged(f, "undead")) { dmg *= 1.5; if (Math.random() < 0.15) { dmg += 25; label = " · Meridia's light bursts"; } } }
    if (k === "volendrung") { f.sp = Math.min(G.maxStamina(s), f.sp + 10); label = " · Volendrung drinks their strength"; }
    if (k === "molag") { f.sp = Math.min(G.maxStamina(s), f.sp + 10); f.mp = Math.min(G.maxMagicka(s), f.mp + 10); label = " · drains them"; }
    if (k === "ebony") { const h = Math.round(dmg * 0.1); f.hp = Math.min(G.maxHealth(s), f.hp + h); label = ` · the Ebony Blade drinks (+${h})`; }
    return { dmg, label };
  }
  /* after the enemy's turn: the Ebony Mail's cloak, the Sanguine Rose's Dremora, the Wabbajack */
  function onEnemy(f) {
    if (f.ehp <= 0 || f.hp <= 0) return null;
    const s = f.s, out = [];
    if (G.fxSum(s, "dae:cloak") > 0) { const d = Math.round(5 + (s.level || 1) / 5); f.ehp -= d; out.push(`poison cloak ${d}`); }
    if (f.turn === 1 && !f.daeRose && has(s, "sanguine_rose") && !(f.summonTurns > 0)) {
      f.daeRose = true; f.summonTurns = 6; f.summonId = "dremora"; f.summonName = "Dremora"; f.summonDmg = Math.round(6 + (s.level || 1) / 3); out.push("the Sanguine Rose calls a Dremora to your side");
    }
    if (f.turn === 2 && !f.daeWabba && has(s, "wabbajack")) { f.daeWabba = true; out.push(wabbajack(f)); }
    return out.length ? out.join(" · ") : null;
  }
  function wabbajack(f, r = Math.random()) {
    const n = f.e.name, tough = tagged(f, "elite") || tagged(f, "dragon") || f.e.priest;
    if (r < 0.15) { if (tough) { f.ehp -= f.e.health * 0.3; return `Wabbajack: ${n} turns into a cheese wheel for a moment (−30%)`; } f.ehp = 0; return `Wabbajack: ${n} turns into a wheel of cheese`; }
    if (r < 0.4) { f.eParalyzed = 3; return `Wabbajack: ${n} stops to think about bees`; }
    if (r < 0.6) { f.ehp -= f.e.health * 0.3; return `Wabbajack: lightning out of a clear sky hits ${n} (−30%)`; }
    if (r < 0.8) { const h = Math.round(G.maxHealth(f.s) * 0.25); f.hp = Math.min(G.maxHealth(f.s), f.hp + h); return `Wabbajack: you feel strangely refreshed (+${h})`; }
    f.ehp = Math.min(f.e.health, f.ehp + f.e.health * 0.15); return `Wabbajack: ${n} looks healthier. Sheogorath laughs`;
  }
  /* at the end of a fight you won: Azura's Star refills a fifth of your weapon's enchantment */
  function after(f) {
    if (!f.won || !f.weaponInv || !f.weapon?.enchant || !has(f.s, "azuras_star")) return [];
    const row = G.invRow(f.s, f.weaponInv), cap = f.weapon.enchant.capacity, cur = f.charges[f.weaponInv] ?? row?.charge ?? 0;
    if (cur >= cap) return [];
    f.charges[f.weaponInv] = Math.min(cap, cur + cap * 0.2);
    return ["Azura's Star catches the soul and feeds your weapon"];
  }

  // ---- Journal emblems: an Oblivion gate in each prince's colour ([OURS] art), registered once the art toolkit is loaded
  const HUE = { dae_azura: "#d9a0ff", dae_boethiah: "#4a3a6a", dae_clavicus: "#c98a3a", dae_hermaeus: "#3a7a5a", dae_hircine: "#7a5a32", dae_malacath: "#5a6a3a", dae_dagon: "#b8352a",
    dae_meridia: "#ffd76a", dae_molag: "#5a2a3a", dae_peryite: "#7aa03a", dae_sanguine: "#a3203a", dae_sheogorath: "#a050c0", dae_mephala: "#2a2a3a" };
  function emblem(g, id) {
    const c = HUE[id] || "#a050c0", ink = "#1a120a";
    const gl = g.createRadialGradient(20, 20, 2, 20, 20, 17); gl.addColorStop(0, c); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40);
    g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 1.2;
    g.fillStyle = "#3a2a22"; g.beginPath(); g.moveTo(9, 34); g.lineTo(9, 16); g.quadraticCurveTo(20, 2, 31, 16); g.lineTo(31, 34); g.closePath(); g.fill(); g.stroke();   // the gate's arch
    g.fillStyle = c; g.beginPath(); g.moveTo(13, 34); g.lineTo(13, 18); g.quadraticCurveTo(20, 8, 27, 18); g.lineTo(27, 34); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,240,220,.55)"; g.beginPath(); g.ellipse(20, 24, 3, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3a2a22"; for (const [x, y] of [[7, 14], [33, 14], [20, 5]]) { g.beginPath(); g.moveTo(x - 2, y + 3); g.lineTo(x, y - 4); g.lineTo(x + 2, y + 3); g.closePath(); g.fill(); g.stroke(); }   // spikes
  }
  for (const id of LINES) L[id].emblem = (g) => emblem(g, id);   // UIART picks these up

  if (typeof QUESTS !== "undefined") {
    Object.assign(QUESTS.L, L);
    for (const id of LINES) QUESTS.REC[id] = L[id].stages.map((st) => st.rec);
    const join0 = QUESTS.join, can0 = QUESTS.canJoin, check0 = QUESTS.check, talk0 = QUESTS.talk;
    QUESTS.join = (s, id) => gate(s, id) || join0(s, id);
    QUESTS.canJoin = (s, id) => !gate(s, id) && can0(s, id);
    QUESTS.check = (s) => { const m = check0(s); return [...m, ...sync(s)]; };
    QUESTS.talk = (s, id, t) => { const r = talk0(s, id, t); const m = sync(s); if (m.length) r.msgs = [...(r.msgs || []), ...m]; return r; };
    QUESTS.visible = ((v0) => (s, id) => visible(s, id) && (v0 ? v0(s, id) : true))(QUESTS.visible);
  }
  return { L, LINES, PRINCES, gate, visible, count, readOghma, sync, onHit, onEnemy, wabbajack, after, OGHMA, emblem };
})();
