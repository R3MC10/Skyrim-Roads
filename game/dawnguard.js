/* [Skyrim: Dawnguard] The vampire war: a shared opening, then a choice of side (never both).
   - Dawnguard: Awakening. Isran rebuilds the old vampire hunters at Fort Dawnguard near Riften. Rumours send you to
     Dimhollow Crypt, where a sealed coffin holds Serana, an ancient vampire with an Elder Scroll. You take her home
     to Castle Volkihar, on its rock off the Haafingar coast, and her father Lord Harkon makes you an offer.
   - Refuse, and you hunt with the Dawnguard: hunter's plate, a heavy crossbow and bolts, troll armour for your
     follower (Gunmar's trolls), and at the end you storm Castle Volkihar and face Harkon.
   - Accept, and Harkon's blood makes you a vampire with a stronger Vampire Lord form (curses.js already has the form
     and its perk tree; this file adds to it), and at the end you lead his assault on Fort Dawnguard.
   Each path is 10 stages counting the opening. Side perks live in perkfx.js (dg_*, volk_*) and only that side can take
   them. In a party only the leader picks the side; members follow the leader's pick. Dungeon stages are ordinary
   clears, so a party clears them as a co-op run and votes on the loot (coop.js, lootvote.js).
   Story beats follow the Dawnguard questline, retold in our own words; [OURS] the places used for each stage, numbers. */
const DAWNGUARD = (() => {
  const E = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 10, danger: "high", gold: [0, 0], text: "", ...extra });
  // ---- rewards ([Skyrim] names, close-to-Skyrim stats; ids keep the weapon type the engine reads from them)
  Object.assign(D.ITEMS, {
    dawnguard_helmet: { name: "Dawnguard Helmet", slot: "head", type: "heavy", armor: 19, weight: 6, value: 300 },
    dawnguard_armor: { name: "Dawnguard Heavy Armor", slot: "chest", type: "heavy", armor: 35, weight: 30, value: 700, aenchant: { key: "max:health", mag: 20, name: "Fortify Health" } },
    dawnguard_gauntlets: { name: "Dawnguard Gauntlets", slot: "hands", type: "heavy", armor: 14, weight: 5, value: 150 },
    dawnguard_boots: { name: "Dawnguard Boots", slot: "feet", type: "heavy", armor: 14, weight: 8, value: 150 },
    crossbow_dawnguard: { name: "Dawnguard Heavy Crossbow", slot: "weapon", hands: 2, skill: "Archery", damage: 23, weight: 16, value: 500, shoots: "bolt" },
    troll_armor: { name: "Troll Armor", slot: "chest", type: "heavy", armor: 30, weight: 28, value: 400, desc: "Gunmar's plate for an armoured troll, cut down to fit a follower." },
    dawnguard_rune_warhammer: { name: "Dawnguard Rune Hammer", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 24, weight: 24, value: 1500, noTrade: true },
    vampire_royal_armor: { name: "Vampire Royal Armor", slot: "chest", type: "light", armor: 30, weight: 7, value: 1500, noTrade: true,
      aenchant: { key: "max:magicka", mag: 50, name: "Fortify Magicka", more: [{ key: "regen:magicka", mag: 25, name: "Regenerate Magicka" }] } },
    harkons_sword: { name: "Harkon's Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 13, weight: 11, value: 1500, noTrade: true },
  });
  const SIDES = { dawnguard: { name: "the Dawnguard", line: "dg_dawnguard" }, volkihar: { name: "Harkon's court", line: "dg_volkihar" } };
  const L = {
    dg_awakening: { name: "Dawnguard: Awakening", giver: "Isran, Fort Dawnguard near Riften (from level 12)", start: "Fort Dawnguard", stages: [
      { title: "A New Order", rec: 12, text: "Isran is rebuilding the Dawnguard, the old vampire hunters. He hears vampires are digging at Dimhollow Crypt. Go and clear it.", obj: { clear: "Dimhollow Crypt" }, reward: { gold: 150 } },
      { title: "Awakening", rec: 13, text: "Deep in the crypt a sealed coffin stands on a ring of stone. Open it. Whatever sleeps inside has guards.",
        obj: { talk: "Dimhollow Crypt", label: "Open the sealed coffin", fight: E("Crypt guardians", 280, 24, ["undead", "elite"]) }, reward: { gold: 200 } },
      { title: "Bloodline", rec: 14, text: "The coffin held Serana, a vampire who slept for ages with an Elder Scroll on her back. She wants to go home. Wade out to Castle Volkihar with her and meet her father, Lord Harkon.",
        obj: { talk: "Castle Volkihar", label: "Hear Harkon's offer" }, reward: { gold: 250 } },
    ] },
    dg_dawnguard: { name: "Dawnguard: Hunt the Night", giver: "Isran, Fort Dawnguard, or turn Harkon down at Castle Volkihar", start: "Fort Dawnguard", side: "dawnguard", stages: [
      { title: "Hunter's Return", rec: 15, text: "You turned Harkon down and walked out of his castle alive. Tell Isran what you saw at Fort Dawnguard.",
        obj: { talk: "Fort Dawnguard", label: "Report to Isran" }, reward: { gold: 200, items: ["dawnguard_helmet", "dawnguard_armor", "dawnguard_gauntlets", "dawnguard_boots", "crossbow_dawnguard"] } },
      { title: "Old Friends", rec: 16, text: "Isran needs Gunmar, the troll tamer. Gunmar went into Fallowstone Cave after a pack of wild trolls. Clear it with him.",
        obj: { clear: "Fallowstone Cave" }, reward: { gold: 250, items: ["troll_armor"] } },
      { title: "Prophet", rec: 18, text: "Only a Moth Priest can read Serana's Elder Scroll. One is on the road to Dragon Bridge, and vampires are waiting for him. Get there first.",
        obj: { talk: "Dragon Bridge", label: "Break the vampire ambush", fight: E("Vampire ambush", 320, 30, ["undead", "humanoid", "elite"]), allies: [["Dawnguard hunter", 8]] }, reward: { gold: 300 } },
      { title: "Unseen Visions", rec: 20, text: "The Moth Priest says the prophecy needs a second Elder Scroll. The Dwemer hid one deep in Raldbthar. Clear it.",
        obj: { clear: "Raldbthar" }, reward: { gold: 350 } },
      { title: "Chasing Echoes", rec: 22, text: "Serana's mother hid the last Scroll. Her notes are somewhere in Castle Volkihar's old courtyard. Slip in unseen.",
        obj: { talk: "Castle Volkihar", label: "Sneak into the courtyard", check: { skill: "Sneak", need: 40, fight: E("Volkihar thralls", 340, 32, ["undead", "humanoid", "elite"]) } }, reward: { gold: 400 } },
      { title: "The Blood Nest", rec: 24, text: "Harkon feeds his court from a nest of vampires at Bloodlet Throne. Burn it out before the last fight.",
        obj: { clear: "Bloodlet Throne" }, reward: { gold: 450 } },
      { title: "Kindred Judgment", rec: 28, text: "The Scrolls are read. Harkon means to blot out the sun for good. Storm Castle Volkihar with Isran, Serana and the trolls, and end him.",
        obj: { talk: "Castle Volkihar", label: "Storm the castle and face Harkon", fight: E("Lord Harkon", 820, 48, ["undead", "humanoid", "elite"], { boss: true }), allies: [["Isran", 8], ["Serana", 7], ["Armoured troll", 6]] },
        reward: { gold: 2000, items: ["dawnguard_rune_warhammer"], flag: "dgDawnguard", title: "Hero of the Dawnguard" } },
    ] },
    dg_volkihar: { name: "Volkihar: Harkon's Gift", giver: "Lord Harkon, Castle Volkihar", start: "Castle Volkihar", side: "volkihar", stages: [
      { title: "The Gift", rec: 15, text: "Harkon offers you his own blood: you'd be a vampire, and more than that, a Vampire Lord. Drink.",
        obj: { talk: "Castle Volkihar", label: "Drink Harkon's blood", need: (s) => (s.werewolf ? "Harkon won't share his blood with a werewolf. Lose the beast blood first." : null) }, reward: { gold: 200 } },
      { title: "A Thrall Taken", rec: 16, text: "The Thalmor took one of Harkon's thralls to Northwatch Keep. Show the court what its new lord can do. Clear the keep.",
        obj: { clear: "Northwatch Keep" }, reward: { gold: 250 } },
      { title: "Prophet", rec: 18, text: "Only a Moth Priest can read Serana's Elder Scroll. One is on the road to Dragon Bridge with a Dawnguard escort. Take him for Harkon.",
        obj: { talk: "Dragon Bridge", label: "Ambush the Dawnguard escort", fight: E("Dawnguard escort", 320, 30, ["humanoid", "elite"]), allies: [["Vampire thrall", 8]] }, reward: { gold: 300 } },
      { title: "Unseen Visions", rec: 20, text: "The Moth Priest says the prophecy needs a second Elder Scroll. The Dwemer hid one deep in Raldbthar. Clear it.",
        obj: { clear: "Raldbthar" }, reward: { gold: 350 } },
      { title: "Chasing Echoes", rec: 22, text: "Serana's mother hid the last Scroll beyond a gate in the castle's old courtyard. Its keepers don't want it opened.",
        obj: { talk: "Castle Volkihar", label: "Open Valerica's gate", fight: E("Soul Cairn keepers", 340, 32, ["undead", "elite"]), allies: [["Serana", 10]] }, reward: { gold: 400, items: ["vampire_royal_armor"] } },
      { title: "The Hunter Hunted", rec: 24, text: "Gunmar's armoured trolls are the Dawnguard's teeth. They're kept in Fallowstone Cave. Kill them before the assault.",
        obj: { clear: "Fallowstone Cave" }, reward: { gold: 450 } },
      { title: "Destroying the Dawnguard", rec: 28, text: "The Scrolls are read and the sun will fail. Only Fort Dawnguard stands in the way. Lead Harkon's assault and break Isran.",
        obj: { talk: "Fort Dawnguard", label: "Lead the assault on Fort Dawnguard", fight: E("Isran and the Dawnguard", 820, 48, ["humanoid", "elite"], { boss: true }), allies: [["Lord Harkon", 8], ["Serana", 7], ["Gargoyle", 6]] },
        reward: { gold: 2000, items: ["harkons_sword"], flag: "dgVolkihar", title: "Lord of Volkihar" } },
    ] },
  };
  const LINES = Object.keys(L), SIDE_LINES = ["dg_dawnguard", "dg_volkihar"];
  const JOIN_AT = { dg_dawnguard: ["Fort Dawnguard", "Castle Volkihar"], dg_volkihar: ["Castle Volkihar"] };   // the choice is made in Harkon's hall
  const q = (s) => (s.quests = s.quests || {});

  // ---- your side
  const side = (s) => (q(s).dg_dawnguard ? "dawnguard" : q(s).dg_volkihar ? "volkihar" : null);
  const opened = (s) => !!q(s).dg_awakening?.done;   // the opening is over: time to choose
  /* the party leader's pick, from their published card (wired by the screens; null when unknown) */
  let leaderCard = () => null;
  const role = (s) => (typeof PARTYPLAY !== "undefined" ? PARTYPLAY.role(s) : "solo");
  const leaderSide = (s) => { try { return leaderCard(s)?.dg ?? null; } catch { return null; } };

  /* why you can't join this line now (null when you can) */
  function gate(s, id) {
    if (!L[id]) return null;
    if (id === "dg_awakening") return (s.level || 1) < 12 ? "Isran doesn't take green recruits. Come back at level 12." : null;
    if (!opened(s)) return "Finish Dawnguard: Awakening first.";
    const sd = side(s), want = L[id].side;
    if (sd && sd !== want) return sd === "volkihar" ? "You've already drunk Harkon's blood. Isran's hunters would shoot you on sight." : "You turned Harkon down. There's no way back into his court.";
    if (want === "dawnguard" && s.vampire) return "Isran won't let a vampire through his gate. Cure yourself first, then come back.";
    if (role(s) === "member") {
      const ls = leaderSide(s);
      if (!ls) return "Only your party's leader picks a side in the vampire war. Wait for them to choose.";
      if (ls !== want) return ls === "dawnguard" ? "Your party's leader sided with the Dawnguard. In a party you follow the leader's choice." : "Your party's leader sided with Harkon's court. In a party you follow the leader's choice.";
    }
    return null;
  }
  const hidden = (s, id) => SIDE_LINES.includes(id) && (!opened(s) || (!!side(s) && side(s) !== L[id].side));
  const canChoose = (s, id) => SIDE_LINES.includes(id) && !q(s)[id] && !gate(s, id) && JOIN_AT[id].includes(s.location);
  /* pick a side (the Join button on either line, or this directly). Returns the message to show. */
  function choose(s, sideId) {
    const id = SIDES[sideId]?.line; if (!id) return "No such side.";
    if (q(s)[id]) return "You've already chosen.";
    const why = gate(s, id); if (why) return why;
    if (!JOIN_AT[id].includes(s.location)) return id === "dg_volkihar" ? "Harkon makes his offer in his own hall, at Castle Volkihar." : "Give Isran your answer at Fort Dawnguard, or turn Harkon down in his hall.";
    q(s)[id] = { stage: 0, t: G.now(), base: { ...(s.stats || {}) } };
    G.note(s, sideId === "dawnguard" ? "🏹 You turned Harkon down and sided with the Dawnguard." : "🦇 You accepted Harkon's offer and sided with his court.");
    return `${L[id].name}: ${L[id].stages[0].title}. ${L[id].stages[0].text}`;
  }

  // ---- what happens when a stage is done (gifts that need more than the reward list)
  const beast = (s) => (s.beastPerks = s.beastPerks || { wolf: {}, lord: {}, feeds: 0, kills: 0 });
  const dg = (s) => (s.dgWar = s.dgWar || {});
  function sync(s, t = G.now()) {
    const out = [], v = q(s);
    if (v.dg_dawnguard && v.dg_dawnguard.stage >= 1 && !dg(s).bolts) { dg(s).bolts = true; G.give(s, "bolt_steel", 40); out.push("🏹 Isran adds 40 steel bolts for the crossbow."); }
    if (v.dg_dawnguard && v.dg_dawnguard.stage >= 2 && !dg(s).troll) { dg(s).troll = true; out.push(trollArmor(s)); }
    if (v.dg_volkihar && v.dg_volkihar.stage >= 1 && !dg(s).blood) {
      dg(s).blood = true;
      if (!s.vampire) { s.vampire = { since: t, fedAt: t }; s.sanguinare = null; }
      const b = beast(s); b.kills = Math.max(b.kills || 0, 4);   // [OURS] Harkon's blood is old: two Vampire Lord perks right away
      out.push("🦇 Harkon's blood burns through you. You're a vampire now, and once a day in a fight you can take the Vampire Lord's form. Two Vampire Lord perks are ready.");
    }
    if (out.length) for (const m of out) G.note(s, m);
    return out;
  }
  /* Gunmar's troll armour goes straight onto your follower if you have one */
  function trollArmor(s) {
    const row = (s.inv || []).find((r) => r.item === "troll_armor");
    if (!row) return "Gunmar keeps the troll armour for now.";
    if (!s.follower || typeof FOL2 === "undefined" || !FOL2.st(s)) return "Gunmar hands you troll armour for a follower. Give it to one from the Hero tab.";
    const msg = FOL2.give(s, row.id, 1), f = FOL2.st(s), mine = f?.inv?.slice().reverse().find((r) => r.item === "troll_armor");
    if (!mine) return "Gunmar hands you troll armour, but your follower can't carry it. Give it to them later.";
    FOL2.equip(s, mine.id);
    return "Gunmar fits your follower with troll armour. They're wearing it now.";
  }

  // ---- the Vampire Lord, stronger for Harkon's court (perks in perkfx.js: volk_*)
  const pf = (f, key) => (typeof PFX !== "undefined" ? PFX.sum(f.s, key, f, {}) : 0);
  if (typeof CURSE !== "undefined") {
    const lord0 = CURSE.lordForm, mult0 = CURSE.dmgMult, in0 = CURSE.dmgInMult, tick0 = CURSE.tick;
    CURSE.lordForm = (f) => {
      const m = lord0(f), more = Math.round(pf(f, "lordturns")), heal = pf(f, "lordheal");
      if (more > 0) f.pw.lord += more;
      if (heal > 0) { const mh = G.maxHealth(f.s); f.hp = Math.min(mh * 1.2, f.hp + mh * heal); }
      return m;
    };
    CURSE.dmgMult = (f) => mult0(f) * ((f.pw?.lord || 0) > 0 ? 1 + pf(f, "lordout") : 1);
    CURSE.dmgInMult = (f) => in0(f) * ((f.pw?.lord || 0) > 0 ? Math.max(0.5, 1 + pf(f, "lordin")) : 1);
    CURSE.tick = (f, line) => {
      const lord = (f.pw?.lord || 0) > 0;
      tick0(f, line);
      const extra = lord && f.ehp > 0 ? CURSE.drainOf(f) * pf(f, "lorddrain") : 0;
      if (extra > 0) { f.ehp -= extra; f.hp = Math.min(G.maxHealth(f.s) * 1.3, f.hp + extra * 0.4); line.me += ` · Harkon's blood ${Math.round(extra)}`; }
    };
  }

  // ---- side perks: only your side can take them
  const PERK_SIDE = { dg_bolt_hunter: "dawnguard", dg_sun_ward: "dawnguard", dg_troll_tamer: "dawnguard", volk_blood_of_harkon: "volkihar", volk_night_lord: "volkihar", volk_court: "volkihar" };
  const perkGate = (s, id) => (PERK_SIDE[id] && side(s) !== PERK_SIDE[id] ? (PERK_SIDE[id] === "dawnguard" ? "Only for those who hunt with the Dawnguard." : "Only for those of Harkon's blood.") : null);
  if (typeof PERKS !== "undefined") {
    const can0 = PERKS.canTake, take0 = PERKS.take;
    PERKS.canTake = (s, id) => perkGate(s, id) || can0(s, id);
    PERKS.take = (s, id) => perkGate(s, id) || take0(s, id);
  }

  // ---- Fort Dawnguard and Castle Volkihar are strongholds, not dungeons to loot
  const KEEPS = new Set(["Fort Dawnguard", "Castle Volkihar"]);
  if (typeof DUNGEONS !== "undefined") {
    const info0 = DUNGEONS.info, ent0 = DUNGEONS.enterable;
    DUNGEONS.info = (name) => (KEEPS.has(name) ? null : info0(name));
    DUNGEONS.enterable = (name) => !KEEPS.has(name) && ent0(name);
  }

  // ---- party: publish your side with your card, and read the leader's
  if (typeof PARTY !== "undefined") { const cb0 = PARTY.cardBits; PARTY.cardBits = (s, party) => ({ ...cb0(s, party), dg: side(s) }); }
  if (typeof PARTYPLAY !== "undefined") {
    const ui0 = PARTYPLAY.ui;
    PARTYPLAY.ui = (ctx) => { leaderCard = () => { const p = ctx.party(); return p && p.leader !== ctx.S().id ? ctx.cardOf(p.leader) : null; }; return ui0(ctx); };
  }
  const setLeaderCard = (fn) => { leaderCard = fn; };   // tests

  // ---- Journal emblems ([OURS] art): a sun for the hunters, a red moon and bat for Volkihar, a coffin for the opening
  function emblem(g, id) {
    const ink = "#1a120a"; g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 1.2;
    if (id === "dg_dawnguard") {
      g.fillStyle = "#6a5a4a"; g.beginPath(); g.moveTo(8, 6); g.lineTo(32, 6); g.lineTo(32, 22); g.quadraticCurveTo(32, 32, 20, 36); g.quadraticCurveTo(8, 32, 8, 22); g.closePath(); g.fill(); g.stroke();   // a shield
      g.fillStyle = "#f0c050"; g.beginPath(); g.arc(20, 19, 6, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = "#f0c050"; g.lineWidth = 1.6; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(20 + Math.cos(a) * 8, 19 + Math.sin(a) * 8); g.lineTo(20 + Math.cos(a) * 11, 19 + Math.sin(a) * 11); g.stroke(); }
      return;
    }
    if (id === "dg_volkihar") {
      g.fillStyle = "#b8202a"; g.beginPath(); g.arc(20, 18, 12, 0, Math.PI * 2); g.fill(); g.stroke();   // a red moon
      g.fillStyle = "#1c1418"; g.beginPath(); g.moveTo(20, 16); g.quadraticCurveTo(12, 10, 5, 14); g.quadraticCurveTo(9, 17, 8, 21); g.quadraticCurveTo(14, 18, 20, 23); g.quadraticCurveTo(26, 18, 32, 21); g.quadraticCurveTo(31, 17, 35, 14); g.quadraticCurveTo(28, 10, 20, 16); g.closePath(); g.fill();   // a bat
      return;
    }
    g.fillStyle = "#4a3a3a"; g.beginPath(); g.moveTo(15, 4); g.lineTo(25, 4); g.lineTo(31, 13); g.lineTo(27, 37); g.lineTo(13, 37); g.lineTo(9, 13); g.closePath(); g.fill(); g.stroke();   // a coffin
    g.strokeStyle = "#c9a24a"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(20, 10); g.lineTo(20, 28); g.moveTo(14, 16); g.lineTo(26, 16); g.stroke();
  }
  for (const id of LINES) L[id].emblem = (g) => emblem(g, id);   // UIART picks these up

  if (typeof QUESTS !== "undefined") {
    Object.assign(QUESTS.L, L);
    for (const id of LINES) QUESTS.REC[id] = L[id].stages.map((st) => st.rec);
    const join0 = QUESTS.join, can0 = QUESTS.canJoin, check0 = QUESTS.check, talk0 = QUESTS.talk;
    QUESTS.join = (s, id) => (SIDE_LINES.includes(id) ? choose(s, L[id].side) : gate(s, id) || join0(s, id));
    QUESTS.canJoin = (s, id) => (SIDE_LINES.includes(id) ? canChoose(s, id) : !gate(s, id) && can0(s, id));
    QUESTS.check = (s) => { const m = check0(s); return [...m, ...sync(s)]; };
    QUESTS.talk = (s, id, t) => { const r = talk0(s, id, t); const m = sync(s); if (m.length) r.msgs = [...(r.msgs || []), ...m]; return r; };
    QUESTS.visible = ((v0) => (s, id) => !hidden(s, id) && (v0 ? v0(s, id) : true))(QUESTS.visible);
  }
  return { L, LINES, SIDE_LINES, SIDES, ITEMS: Object.keys(D.ITEMS).filter((k) => /^(dawnguard_|crossbow_dawnguard|troll_armor|vampire_royal|harkons_)/.test(k)), PERK_SIDE, KEEPS,
    side, opened, gate, hidden, canChoose, choose, sync, trollArmor, perkGate, leaderSide, setLeaderCard, emblem };
})();
