/* More things on the road (Skyrim-style random encounters), on top of events.js's roadside events.
   Region-aware (holds, Solstheim, coast, mountains), weather- and time-aware, level-scaled rewards and foes.
   Every encounter has choices (fight, talk, bribe, sneak, help, trade, leave) that resolve through the same
   path as events.js (G.eventChoice), so fights, skills and trip logs work the same way.
     ENC.roll(s)            → a new encounter for where you are (or null)
     ENC.has(id)            → is this one of ours
     ENC.canDecide(s)       → may this player choose? (party leader logic can replace this)
     ENC.decide(s, choice)  → the single entry point for a choice (UI calls this)
   [OURS] chances and rewards; [Skyrim] for who you meet and what they say. */
const ENC = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pct = (p) => `${Math.round(clamp(p, 0, 1) * 100)}%`;
  const xp = (s, skill, base) => G.useSkill(s, skill, base);
  const lv = (s) => s.level || 1;
  const sc = (s, n) => Math.round(n * (1 + 0.06 * (lv(s) - 1)));                     // rewards grow with you
  const has = (id) => !!(id && D.ITEMS[id]);
  const anyOf = (ids) => { const ok = ids.filter(has); return ok.length ? pick(ok) : null; };
  const give = (s, id, n = 1) => { if (!has(id) || n <= 0) return null; G.give(s, id, n); return `${n > 1 ? n + "× " : ""}${D.ITEMS[id].name}`; };
  const addGold = (s, n) => { n = Math.max(0, Math.round(n)); s.gold += n; return n; };
  const list = (arr) => arr.filter(Boolean).join(", ");
  const flags = (s) => (s.encFlags = s.encFlags || {});
  const nowT = () => G.now();
  const sk = (s, name) => G.skill(s, name);
  const P = (s, id) => G.P(s, id);
  const hurt = (s, n) => { const h = G.curHealth(s); G.setHealth(s, Math.max(1, h - n)); return Math.round(Math.min(n, h - 1)); };
  const healAll = (s) => G.setHealth(s, G.maxHealth(s));
  const foe = (name, level, tags, health, damage, gold, text, danger = "medium") => ({ name, danger, level, tags, health, damage, gold, holds: null, text });
  const enc = (name) => D.ENCOUNTERS.find((e) => e.name === name);

  // ---- skill checks ([OURS]): chance shown on the button, XP for trying
  // perks matter: Persuasion/Intimidation/Smooth Talker for talk, the Sneak tree's hide perks and Road Wise for sneaking,
  // Pathfinder for running, Bribery/Talk Down/Pardon/Road Wise for bribes and tolls, Wax Key/Kingpin for found gold
  const pf = (s, key) => (typeof PFX !== "undefined" ? PFX.num(s, key) : 0);
  const talkCh = (s, diff = 0) => clamp(0.25 + sk(s, "Speechcraft") / 140 - diff + (P(s, "persuasion") ? 0.12 : 0) + (P(s, "intimidation") ? 0.08 : 0) + Math.min(0.2, pf(s, "enctalk")), 0.05, 0.95);
  const sneakCh = (s, diff = 0) => clamp(0.3 + sk(s, "Sneak") / 160 - diff + (G.isNight(nowT()) ? 0.1 : 0) + (typeof WFX !== "undefined" ? WFX.sneakAdd(s) : 0) + Math.min(0.2, pf(s, "hide") / 100) + Math.min(0.15, pf(s, "road")), 0.05, 0.95);
  const athCh = (s, diff = 0) => clamp(0.35 + sk(s, "Athletics") / 170 - diff + Math.min(0.2, pf(s, "roadrun")), 0.05, 0.95);
  const trackCh = (s) => clamp(0.3 + (sk(s, "Sneak") + sk(s, "Archery")) / 300 + Math.min(0.2, pf(s, "road") * 2), 0.1, 0.95);
  const tameCh = (s) => clamp(0.2 + sk(s, "Speechcraft") / 300 + sk(s, "Athletics") / 300 + (P(s, "animal_allegiance") ? 0.3 : 0) + Math.min(0.2, pf(s, "roadrun")), 0.05, 0.9);
  const foundGold = (s) => 1 + Math.min(0.5, pf(s, "gold"));
  const talk = (s, diff) => { const ch = talkCh(s, diff), win = Math.random() < ch; return { win, skills: xp(s, "Speechcraft", win ? 40 + sk(s, "Speechcraft") : 10) }; };
  const sneak = (s, diff) => { const ch = sneakCh(s, diff), win = Math.random() < ch; return { win, skills: xp(s, "Sneak", win ? 12 : 4) }; };
  const bribeCost = (s, base) => Math.max(1, Math.round(sc(s, base) * (P(s, "bribery") ? 0.8 : 1) * (1 - Math.min(0.5, pf(s, "bribe") + pf(s, "roadbribe")))));
  const fightRes = (text, f, more = {}) => ({ text, foe: f, ...more });

  // ---- what's around you
  function ctx(s) {
    const pos = [s.x, s.y];
    let ground = "Tundra"; try { ground = Terrain.NAMES[Terrain.typeAtPos(pos)] || "Tundra"; } catch (e) { /* ignore */ }
    const sol = typeof WORLD !== "undefined" && WORLD.isSol ? WORLD.isSol(pos) : false;
    let hold = ""; try { hold = G.holdAt(pos); } catch (e) { /* ignore */ }
    let wx = "clear"; try { wx = typeof WEVENTS !== "undefined" ? WEVENTS.weather(pos).id : "clear"; } catch (e) { /* ignore */ }
    const night = G.isNight(nowT());
    const coast = !sol && (s.y < 0.2 || ["Haafingar", "Winterhold"].includes(hold) && s.y < 0.3);
    const cold = /Snow|peaks|Mountains/.test(ground) || ["Winterhold", "The Pale", "Eastmarch"].includes(hold) || wx === "snow" || wx === "blizzard";
    return { pos, ground, sol, hold, wx, night, coast, cold };
  }

  // ---- helpers for reveals
  function revealNear(s, kinds) {
    const known = new Set(s.discovered || []);
    const here = [s.x, s.y];
    const c = Object.entries(WORLD.places).filter(([n, p]) => !known.has(n) && (!kinds || kinds.includes(p[2])) && (!WORLD.same || WORLD.same(p, here)))
      .map(([n, p]) => [n, G.pxDist(here, p)]).sort((a, b) => a[1] - b[1])[0];
    if (!c) return null;
    s.discovered.push(c[0]); s.explored = s.explored || []; s.explored.push([WORLD.places[c[0]][0], WORLD.places[c[0]][1]]);
    return c[0];
  }
  const sideName = (k) => (k === "imperial" ? "Imperial" : "Stormcloak");
  const cwSide = (s) => (typeof CIVILWAR !== "undefined" ? CIVILWAR.side(s) : null);
  const bountyHold = (s) => Object.entries(s.bounty || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  const herbsFor = (c) => (typeof HERBS_BY_GROUND !== "undefined" && HERBS_BY_GROUND[c.ground]) || ["ing_lavender", "ing_blue_flower", "ing_thistle"];

  // ================================================================ the encounters
  const L = [];
  const add = (def) => L.push(def);

  add({ id: "thalmor", title: "A Thalmor patrol", weight: 4, minLv: 5,
    when: (s, c) => !c.sol,
    make: (s) => ({ text: "Two Thalmor Justiciars in gilded robes march a bound Nord down the road. \"Talos worship is heresy,\" one sneers. The prisoner catches your eye.", bribe: bribeCost(s, 120) }),
    choices: (e, s) => [["fight", "⚔️ Free the prisoner (fight)"], ["talk", `🗣 Bluff: "He's wanted in Whiterun, I'll take him" (${pct(talkCh(s, 0.25))})`], ["bribe", `💰 Pay them to forget him (${e.bribe} gold)`], ["leave", "Keep your head down"]],
    fight: (s, e) => fightRes("You draw steel. The Justiciars turn, magic crackling.", foe("Thalmor Justiciars", 14, ["humanoid", "elite"], 150, 19, [40, 120], "\"You'll answer to the Dominion!\""), { after: "prisoner" }),
    talk: (s, e) => { const t = talk(s, 0.25); if (!t.win) return fightRes("\"A clumsy lie.\" The elves raise their hands, fire blooming.", foe("Thalmor Justiciars", 14, ["humanoid", "elite"], 150, 19, [40, 120], ""), { enemyFirst: true, skills: t.skills });
      const g = addGold(s, sc(s, 40)); return { text: `They hand him over with a sneer. Out of sight, the Nord thanks you and presses ${g} gold on you. "Talos guide you."`, skills: t.skills }; },
    bribe: (s, e) => { if (s.gold < e.bribe) return { text: "You don't have that much.", keep: true }; s.gold -= e.bribe; return { text: "Gold changes hands. \"This heretic... escaped. Regrettable.\" The Nord runs for the trees." }; },
    prisoner: (s) => { const g = addGold(s, sc(s, 30)); const it = give(s, anyOf(["potion_health", "tome_fast_healing", "soul_gem_common"])); return `The prisoner rubs his wrists. "I owe you my life." He gives you ${g} gold${it ? " and a " + it : ""}.`; } });

  add({ id: "khajiit", title: "Khajiit caravan", weight: 4,
    when: (s, c) => !c.sol,
    make: () => ({ text: "A Khajiit caravan rests by the road, striped tents and painted carts. \"Khajiit has wares, if you have coin.\"" }),
    choices: () => [["trade", "🛒 See their wares"], ["news", "👂 Ask for news"], ["leave", "Walk on"]],
    trade: (s) => ({ text: "\"Many things, friend. Some are even legal.\"", shop: [...new Set([anyOf(["gem_amethyst", "gem_garnet"]), anyOf(["gem_ruby", "gem_sapphire", "gem_emerald"]), "potion_health", anyOf(["ing_fire_salts", "ing_frost_salts", "ing_void_salts"]), anyOf(["tome_calm", "tome_fury", "tome_familiar"]), anyOf(["silver_ring", "gold_ring"]), anyOf(["arrow_elven", "arrow_dwarven"])].filter(has))], keep: true }),
    news: (s) => { const n = revealNear(s); const sk2 = xp(s, "Speechcraft", 15); return { text: n ? `"This one hears there is a place called ${n} not far from here." It's marked on your map now.` : "\"The roads are full of talk, but nothing this one can sell you.\"", skills: sk2 }; } });

  add({ id: "courier", title: "A courier", weight: 3,
    make: (s) => { const f = flags(s); const inherit = !f.inherit && lv(s) >= 4; return { inherit, text: inherit ? "\"Got something for you. Don't ask me how I found you.\" A courier hands you a sealed letter: an inheritance from a relative you barely remember." : "A courier jogs up, out of breath. \"Letter for you. Heard you were on this road.\"" }; },
    choices: () => [["read", "✉️ Open the letter"]],
    read: (s, e) => {
      if (e.inherit) { flags(s).inherit = true; const g = addGold(s, sc(s, 150)); return { text: `The letter names you heir to a small estate. The courier hands you ${g} gold from the executor.` }; }
      const n = revealNear(s, ["dungeon", "lair", "camp", "fort"]); const g = addGold(s, rint(5, 20));
      return { text: n ? `An unsigned note: "Treasure hidden at ${n}. Go before the others do." A few coins are folded inside (${g} gold). ${n} is marked on your map.` : `A thank-you note from someone you helped, with ${g} gold.` }; } });

  add({ id: "bard", title: "A wandering bard", weight: 3,
    make: () => ({ text: `A bard sits on a milestone, lute in hand. "${pick(["Ragnar the Red, perhaps?", "The Age of Aggression?", "Tale of the Tongues?", "The Dragonborn Comes, if you're brave enough"])}"` }),
    choices: (e, s) => [["song", "🎶 Ask for a song (10 gold)"], ["sing", `🎤 Sing along (${pct(talkCh(s, 0.1))})`], ["leave", "Thank them and go"]],
    song: (s) => { if (s.gold < 10) return { text: "You don't have 10 gold.", keep: true }; s.gold -= 10; healAll(s); return { text: "The song carries you. Your aches fade and you walk on lighter. (Health restored.)", skills: xp(s, "Etiquette", 20) }; },
    sing: (s) => { const t = talk(s, 0.1); if (t.win) { const g = addGold(s, rint(10, 30)); return { text: `A passing farmer tosses coins at your duet: ${g} gold. The bard grins and splits it fair.`, skills: t.skills }; } return { text: "You hit a note that startles a horse. The bard winces politely.", skills: t.skills }; } });

  add({ id: "vigilant", title: "Vigilants of Stendarr", weight: 3, minLv: 4,
    when: (s, c) => !c.sol,
    make: (s) => { const cursed = !!(s.vampire || s.werewolf); return { cursed, text: cursed ? "Two Vigilants of Stendarr stop you. One sniffs the air. \"There's a taint on you, traveller.\"" : "Two Vigilants of Stendarr in grey hoods bless travellers on the road. \"Daedra and the walking dead are about. Will you help us hunt?\"" }; },
    choices: (e, s) => e.cursed ? [["talk", `🗣 "You're mistaken." (${pct(talkCh(s, 0.2))})`], ["sneak", `🥷 Slip away (${pct(sneakCh(s, 0.1))})`], ["fight", "⚔️ Fight them"]] : [["hunt", "⚔️ Join the hunt"], ["bless", "🙏 Ask for a blessing"], ["leave", "Decline politely"]],
    talk: (s) => { const t = talk(s, 0.2); return t.win ? { text: "They frown, then let you pass. \"Stendarr watches.\"", skills: t.skills } : fightRes("\"Liar!\" They draw their maces.", foe("Vigilants of Stendarr", 12, ["humanoid"], 120, 15, [10, 40], ""), { enemyFirst: true, skills: t.skills }); },
    sneak: (s) => { const t = sneak(s, 0.1); return t.win ? { text: "You fade into the brush before they decide what you are.", skills: t.skills } : fightRes("They spot you running. \"Stop, creature!\"", foe("Vigilants of Stendarr", 12, ["humanoid"], 120, 15, [10, 40], ""), { enemyFirst: true, skills: t.skills }); },
    fight: () => fightRes("You won't be judged on the road.", foe("Vigilants of Stendarr", 12, ["humanoid"], 120, 15, [10, 40], "")),
    hunt: (s) => fightRes("They lead you to a ruined farmhouse. Something pale waits inside.", enc("Vampire") || foe("Vampire", 12, ["undead", "humanoid", "elite"], 110, 16, [20, 60], ""), { after: "vigReward" }),
    vigReward: (s) => { const g = addGold(s, sc(s, 50)); const it = give(s, anyOf(["potion_health", "scroll_healing", "tome_sun_fire"])); return `"Stendarr's thanks." They give you ${g} gold${it ? " and a " + it : ""}.`; },
    bless: (s) => { healAll(s); const cured = typeof CURSE !== "undefined" && CURSE.cureDisease ? CURSE.cureDisease(s) : ""; return { text: `"Stendarr's mercy upon you." You feel clean and whole.${cured ? " " + cured : ""}`, skills: xp(s, "Mysticism", 8) }; } });

  add({ id: "hunters", title: "Hunters", weight: 3,
    when: (s, c) => !c.sol && /Forest|forest|Tundra|Grassland|hills/.test(c.ground),
    make: () => ({ text: "Two hunters are dressing a deer beside the road. \"Good hunting this season, if you know where to look.\"" }),
    choices: (e, s) => [["buy", "🍖 Buy venison (15 gold)"], ["fire", "🔥 Share their fire"], ["tips", "🏹 Ask about tracking"], ["leave", "Nod and move on"]],
    buy: (s) => { if (s.gold < 15) return { text: "You can't afford it.", keep: true }; const it = anyOf(["food_venison", "dish_venison_stew"]); if (!it) return { text: "They're out of meat.", keep: true }; s.gold -= 15; give(s, it, 2); return { text: `You buy 2 ${D.ITEMS[it].name}.`, skills: xp(s, "Mercantile", 15) }; },
    fire: (s) => { healAll(s); if (typeof WFX !== "undefined" && WFX.warmUp) try { WFX.warmUp(s, 60); } catch (e) { /* ignore */ } return { text: "You warm your hands and trade stories until the fire burns low. (Health restored.)", skills: xp(s, "Etiquette", 10) }; },
    tips: (s) => { const it = give(s, anyOf(["pelt_wolf", "ing_hawk_feathers"])); return { text: `They show you how to read a trail.${it ? " They give you a " + it + " for the road." : ""}`, skills: [...xp(s, "Archery", 30), ...xp(s, "Sneak", 15)] }; } });

  add({ id: "giant", title: "A giant and his mammoths", weight: 2.5, minLv: 3,
    when: (s, c) => !c.sol && /Tundra|Grassland|hills|Snow/.test(c.ground),
    make: () => ({ text: "Off the road, a giant herds three mammoths, club over his shoulder. He hasn't noticed you. Yet." }),
    choices: (e, s) => [["leave", "Give them a wide berth"], ["steal", `🥷 Sneak to his camp for loot (${pct(sneakCh(s, 0.25))})`], ["fight", "⚔️ Challenge the giant"]],
    steal: (s) => { const t = sneak(s, 0.25); if (t.win) { const g = addGold(s, sc(s, 60)); const it = give(s, "ing_giants_toe") || give(s, anyOf(["ing_bone_meal"])); return { text: `You rifle the giant's camp: ${g} gold${it ? " and a " + it : ""}. The mammoths only stare.`, skills: t.skills }; } return fightRes("A mammoth trumpets. The giant turns, roaring.", enc("Giant") || foe("Giant", 32, ["humanoid", "big", "elite"], 300, 40, [50, 150], ""), { enemyFirst: true, skills: t.skills }); },
    fight: () => fightRes("You walk out into the open and raise your weapon. The giant lumbers to meet you.", enc("Giant") || foe("Giant", 32, ["humanoid", "big", "elite"], 300, 40, [50, 150], ""), { after: "giantToe" }),
    giantToe: (s) => { const it = give(s, "ing_giants_toe"); return it ? `You take a ${it} as a trophy.` : ""; } });

  add({ id: "dragonfly", title: "A dragon overhead", weight: 2, minLv: 10,
    when: (s, c) => !c.sol,
    make: () => ({ text: "A roar shakes the sky. A dragon wheels low over the road, scanning the ground." }),
    choices: (e, s) => [["hide", `🥷 Hide (${pct(sneakCh(s, 0.15))})`], ["watch", "👀 Stay still and watch"], ["fight", "⚔️ Call it down and fight"]],
    hide: (s) => { const t = sneak(s, 0.15); return t.win ? { text: "You press flat under an overhang. The dragon passes, its shadow sweeping over you.", skills: t.skills } : fightRes("It sees you. The dragon lands in a storm of snow and earth.", enc("Dragon"), { enemyFirst: true, skills: t.skills }); },
    watch: (s) => Math.random() < 0.6 ? { text: "It circles twice, then beats away towards the mountains." } : fightRes("It banks and dives straight at you!", enc("Dragon"), { enemyFirst: true }),
    fight: () => fightRes("You shout a challenge. The dragon answers.", enc("Dragon")) });

  add({ id: "banditToll", title: "Bandits' toll", weight: 4,
    when: (s, c) => !c.sol,
    make: (s) => ({ fee: bribeCost(s, 40), text: "Bandits have dragged a log across the road. Their leader smiles with too many gaps. \"This is a toll road now.\"" }),
    choices: (e, s) => [["pay", `💰 Pay (${e.fee} gold)`], ["talk", `🗣 Intimidate them (${pct(talkCh(s, 0.15 - Math.min(0.2, lv(s) / 150)))})`], ["sneak", `🥷 Go around through the trees (${pct(sneakCh(s, 0.05))})`], ["fight", "⚔️ Fight"]],
    pay: (s, e) => { if (s.gold < e.fee) return fightRes("\"Not enough? Then we'll take it all.\"", enc("Bandit outlaw"), { enemyFirst: true }); s.gold -= e.fee; return { text: "You pay. They roll the log aside, laughing." }; },
    talk: (s) => { const t = talk(s, 0.15 - Math.min(0.2, lv(s) / 150)); return t.win ? { text: "They look at your gear, then at each other. The log moves. \"Safe travels... friend.\"", skills: t.skills } : fightRes("\"Big words.\" They rush you.", enc("Bandit outlaw"), { enemyFirst: true, skills: t.skills }); },
    sneak: (s) => { const t = sneak(s, 0.05); return t.win ? { text: "You slip around them through the trees and rejoin the road beyond.", skills: t.skills } : fightRes("\"Oi! Where d'you think you're going?\"", enc("Bandit outlaw"), { enemyFirst: true, skills: t.skills }); },
    fight: () => fightRes("You kick the log aside.", foe("Bandit toll gang", 8, ["humanoid"], 95, 15, [25, 70], "")) });

  add({ id: "escort", title: "Prisoner escort", weight: 3, minLv: 3,
    when: (s, c) => !c.sol && typeof CIVILWAR !== "undefined",
    make: (s) => { const guards = Math.random() < 0.5 ? "imperial" : "stormcloak"; return { guards, text: `${sideName(guards)} soldiers march a captured ${guards === "imperial" ? "Stormcloak" : "Imperial"} down the road in chains.` }; },
    choices: (e, s) => { const my = cwSide(s); const out = [];
      if (my === e.guards) out.push(["help", "🛡 Walk with them as escort"]);
      else out.push(["free", "⚔️ Free the prisoner"]);
      out.push(["ask", "❓ Ask what he did"], ["leave", "Not your war, keep going"]); return out; },
    help: (s) => { const g = addGold(s, sc(s, 35)); return { text: `You see them safely to the next fort. The sergeant pays you ${g} gold. "For the cause."`, delay: 20 }; },
    free: (s, e) => fightRes(`You cut in. The ${sideName(e.guards)} soldiers draw swords.`, foe(`${sideName(e.guards)} escort`, 10, ["humanoid"], 120, 16, [20, 60], ""), { after: "freed" }),
    freed: (s) => { const g = addGold(s, sc(s, 25)); return `The prisoner grabs a sword from the dirt. "I won't forget this." He leaves you ${g} gold from the soldiers' purse.`; },
    ask: (s, e) => ({ text: e.guards === "imperial" ? "\"Spoke for Ulfric in a Whiterun tavern,\" the sergeant says. The prisoner spits." : "\"Wore the Emperor's colours in the wrong town,\" a Stormcloak shrugs.", keep: true }) });

  add({ id: "wizard", title: "A fleeing wizard", weight: 2.5, minLv: 5,
    make: () => ({ text: "A wizard in singed robes sprints past you. Behind him, a flame atronach drifts down the road, burning everything it touches. \"Stop it! It won't listen!\"" }),
    choices: (e, s) => [["fight", "⚔️ Fight the atronach"], ...(sk(s, "Conjuration") >= 35 ? [["banish", "✨ Banish it (Conjuration)"]] : []), ["leave", "Let him deal with his mess"]],
    fight: () => fightRes("You step between them.", foe("Flame atronach", 14, ["daedra"], 130, 20, [0, 0], ""), { after: "wizReward" }),
    banish: (s) => { const sk2 = xp(s, "Conjuration", 40); const it = give(s, anyOf(["tome_familiar", "scroll_fireball", "soul_gem_common"])); return { text: `You seize the binding and snap it. The atronach gutters out. The wizard, mortified, hands you a ${it || "small purse"}.`, skills: sk2 }; },
    wizReward: (s) => { const it = give(s, anyOf(["tome_firebolt", "scroll_fireball", "soul_gem_greater", "staff_firebolts"])); return `The wizard bows, sweating. "Take this. And tell no one at the College."${it ? " You get a " + it + "." : ""}`; } });

  add({ id: "necro", title: "A necromancer's ritual", weight: 2.5, minLv: 6,
    when: (s, c) => c.night || /Marsh|hills|Mountains|Snow/.test(c.ground),
    make: () => ({ text: "Green light flickers in a stone circle. A robed necromancer chants over a corpse that is starting to twitch." }),
    choices: (e, s) => [["sneak", `🥷 Sneak up and strike first (${pct(sneakCh(s, 0.1))})`], ["fight", "⚔️ Charge in"], ["leave", "Leave the dead to their business"]],
    sneak: (s) => { const t = sneak(s, 0.1); return fightRes(t.win ? "You creep up behind the chanting figure..." : "Bone crunches under your boot. The necromancer whirls around.", foe("Necromancer", 12, ["humanoid", "mage"], 100, 18, [20, 70], ""), { enemyFirst: !t.win, hidden: t.win, skills: t.skills, after: "necroLoot" }); },
    fight: () => fightRes("You rush the circle.", foe("Necromancer", 12, ["humanoid", "mage"], 100, 18, [20, 70], ""), { after: "necroLoot" }),
    necroLoot: (s) => { const it = list([give(s, anyOf(["soul_gem_common_empty", "soul_gem_common"])), give(s, anyOf(["ing_bone_meal"]), 2)]); return it ? `On the altar: ${it}.` : ""; } });

  add({ id: "pilgrims", title: "Pilgrims", weight: 3,
    when: (s, c) => !c.sol,
    make: () => ({ text: "Pilgrims bound for High Hrothgar huddle by the road. \"Seven thousand steps, and we've run out of bread.\"" }),
    choices: (e, s) => [["feed", "🍞 Share your food"], ["escort", "🛡 Walk with them a while"], ["leave", "Wish them luck"]],
    feed: (s) => { const row = (s.inv || []).find((r) => /^food_|^dish_/.test(r.item)); if (!row) return { text: "You have no food to share.", keep: true }; G.take(s, row.id); healAll(s); return { text: "They bless you by the Nine. A strange calm settles on you. (Health restored.)", skills: [...xp(s, "Etiquette", 25), ...xp(s, "Mysticism", 6)] }; },
    escort: (s) => { const g = addGold(s, rint(10, 30)); return { text: `You walk them to the next crossroads. They pool ${g} gold for you, and pray for your road.`, delay: 15, skills: xp(s, "Etiquette", 15) }; } });

  add({ id: "dog", title: "A stray dog", weight: 1.5, once: true,
    when: (s) => !s.follower && typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS.meeko,
    make: () => ({ text: "A scruffy dog sits by a dead campfire, tail thumping. It follows a few steps when you move." }),
    choices: () => [["take", "🐕 \"Come on, then.\" (take him along)"], ["feed", "🍖 Feed him and go"], ["leave", "Shoo him away"]],
    take: (s) => { if (s.follower) return { text: "You already have someone with you." }; s.follower = { id: "meeko", hp: TOWNS.followerMax(s, "meeko"), ts: G.now() }; flags(s).dog = true; return { text: "The dog barks once and falls in beside you. You call him Meeko. He'll fight with you and carry a little." }; },
    feed: (s) => { const g = addGold(s, rint(5, 25)); flags(s).dog = true; return { text: `He wolfs it down, then trots off and comes back with a muddy purse: ${g} gold. Good dog.` }; } });

  add({ id: "thugs", title: "Hired thugs", weight: 6,
    when: (s) => !!bountyHold(s) && lv(s) >= 3,
    make: (s) => { const [h, b] = bountyHold(s); return { hold: h, owed: b, text: `Three thugs step out. "${pick(["You've made the wrong people angry.", "Someone in " + h + " wants a word. With our fists."])}" Word of your crimes travels.` }; },
    choices: (e, s) => [["pay", `💰 Pay them off (${bribeCost(s, Math.round(e.owed * 0.6) + 20) } gold)`], ["talk", `🗣 Talk them down (${pct(talkCh(s, 0.25))})`], ["fight", "⚔️ Fight"]],
    pay: (s, e) => { const c = bribeCost(s, Math.round(e.owed * 0.6) + 20); if (s.gold < c) return { text: "You can't afford it.", keep: true }; s.gold -= c; return { text: "They count the coins and melt back into the woods." }; },
    talk: (s) => { const t = talk(s, 0.25); return t.win ? { text: "\"Not worth the trouble.\" They let you go.", skills: t.skills } : fightRes("\"Nice speech.\" Fists up.", foe("Hired thugs", 8, ["humanoid"], 100, 14, [10, 40], ""), { enemyFirst: true, skills: t.skills }); },
    fight: () => fightRes("You put your back to a tree.", foe("Hired thugs", 8, ["humanoid"], 100, 14, [10, 40], "")) });

  add({ id: "assassin", title: "A Dark Brotherhood assassin", weight: 3, minLv: 12,
    when: (s) => G.now() - (flags(s).db || 0) > 14 * 7200,
    make: () => ({ text: "A figure in red and black leather drops from a ledge, blade already drawn. \"Someone wants you dead. And the Brotherhood always delivers.\"" }),
    choices: () => [["fight", "⚔️ Defend yourself"], ["flee", "🏃 Run"]],
    fight: (s) => { flags(s).db = G.now(); return fightRes("Steel flashes.", foe("Dark Brotherhood assassin", 18, ["humanoid", "elite"], 170, 26, [60, 160], ""), { enemyFirst: true, after: "dbNote" }); },
    flee: (s) => { flags(s).db = G.now(); const t = athCh(s, 0.2); if (Math.random() < t) return { text: "You run until your lungs burn. When you look back, the road is empty.", skills: xp(s, "Athletics", 20) }; return fightRes("You're too slow. The blade finds you.", foe("Dark Brotherhood assassin", 18, ["humanoid", "elite"], 170, 26, [60, 160], ""), { enemyFirst: true, after: "dbNote" }); },
    dbNote: (s) => { const it = give(s, anyOf(["ebony_dagger", "glass_dagger", "elven_dagger", "potion_health"])); return `On the body: a note. "The Brotherhood has accepted a contract on your life." Someone hates you.${it ? " You take a " + it + "." : ""}`; } });

  add({ id: "hagraven", title: "A Hagraven coven", weight: 2.5, minLv: 7,
    when: (s, c) => !c.sol && (c.hold === "The Reach" || /hills|Mountains|Forest/.test(c.ground)),
    make: () => ({ text: "Feathered totems and bones hang from a dead tree. Shrieking laughter: a Hagraven and her Forsworn are making something terrible." }),
    choices: (e, s) => [["sneak", `🥷 Strike from the shadows (${pct(sneakCh(s, 0.15))})`], ["fight", "⚔️ Attack"], ["leave", "Back away quietly"]],
    sneak: (s) => { const t = sneak(s, 0.15); return fightRes(t.win ? "You creep through the bones..." : "A crow screams. They've seen you.", foe("Hagraven", 16, ["humanoid", "mage", "elite"], 150, 22, [30, 90], ""), { hidden: t.win, enemyFirst: !t.win, skills: t.skills, after: "hagLoot" }); },
    fight: () => fightRes("You charge the coven.", foe("Hagraven", 16, ["humanoid", "mage", "elite"], 150, 22, [30, 90], ""), { after: "hagLoot" }),
    hagLoot: (s) => { const it = list([give(s, anyOf(["ing_hawk_feathers"]), 2), give(s, anyOf(["soul_gem_common", "ing_bone_meal"]))]); return it ? `Among the bones: ${it}.` : ""; } });

  add({ id: "wildhorse", title: "A wild horse", weight: 1.5,
    when: (s, c) => !s.horse && !c.sol && /Tundra|Grassland/.test(c.ground) && typeof HORSES !== "undefined",
    make: () => ({ coat: pick(["bay", "black", "grey", "white", "palomino", "paint"]), text: "A wild horse grazes alone by the road. It lifts its head and watches you, ears forward." }),
    choices: (e, s) => [["calm", `🐎 Approach slowly and calm it (${pct(tameCh(s))})`], ["leave", "Let it be"]],
    calm: (s, e) => { const ch = tameCh(s);
      if (Math.random() < ch) { s.horse = { name: "Wildmane", coat: e.coat, armor: "none", hp: HORSES.BASE_HP, hpT: G.now(), mounted: false }; return { text: "It snorts, then lowers its head into your hand. Wildmane is yours. (Ride it from the Travel tab.)", skills: xp(s, "Athletics", 20) }; }
      const d = hurt(s, rint(8, 20)); return { text: `It rears and kicks, then bolts. (−${d} health)`, skills: xp(s, "Athletics", 6) }; } });

  add({ id: "cart", title: "An abandoned cart", weight: 3.5,
    when: (s, c) => !c.sol,
    make: () => ({ text: "A cart lies on its side, its horse long gone. Crates spill across the road." }),
    choices: (e, s) => [["tracks", `🔎 Check for tracks first (${pct(trackCh(s))})`], ["search", "📦 Search the crates"], ["leave", "Don't touch it"]],
    tracks: (s) => { const ch = trackCh(s); if (Math.random() < ch) return fightRes("Fresh boot prints lead into the trees: an ambush, waiting. You circle round and catch them unawares.", enc("Bandit outlaw"), { hidden: true, after: "cartLoot", skills: xp(s, "Sneak", 15) }); return { text: "You can't make sense of the tracks.", keep: true, skills: xp(s, "Sneak", 3) }; },
    search: (s) => Math.random() < 0.3 ? fightRes("It was bait! Bandits burst from the trees.", enc("Bandit outlaw"), { enemyFirst: true, after: "cartLoot" }) : { text: byIdx.cart.cartLoot(s) || "Mostly broken pottery." },
    cartLoot: (s) => { const g = addGold(s, sc(s, rint(15, 45)) * foundGold(s)); const it = list([give(s, anyOf(["ore_iron", "ore_silver", "pelt_wolf", "food_venison"]), rint(1, 3)), Math.random() < 0.4 ? give(s, anyOf(["potion_health", "potion_stamina"])) : null]); return `In the crates: ${g} gold${it ? ", " + it : ""}.`; } });

  add({ id: "wreck", title: "A shipwreck", weight: 3,
    when: (s, c) => c.coast,
    make: () => { const tier = rint(1, 4); return { tier, tries: 3, text: `A ship's hull lies broken on the rocks below the road. Half-buried in the shingle: a captain's strongbox with a${tier >= 3 ? " daunting" : "n iron"} lock.` }; },
    choices: (e, s) => [["pick", `🗝 Pick the lock (${e.tries} picks, ${pct(G.lockChance(s, e.tier))})`], ["leave", "Leave it to the sea"]],
    pick: (s, e) => {
      if (G.lockRoll(s, G.lockChance(s, e.tier))) { const g = addGold(s, sc(s, rint(40, 90) * e.tier) * foundGold(s)); const it = list([give(s, anyOf(["gem_sapphire", "gem_emerald", "gem_flawless_ruby", "gem_diamond"])), give(s, anyOf(["gold_ring", "silver_necklace", "gold_necklace"]))]);
        return { text: `The lid creaks open: ${g} gold${it ? ", " + it : ""}.`, skills: xp(s, "Lockpicking", [2, 3, 5, 8, 13][e.tier]) }; }
      e.tries -= 1; return { text: e.tries > 0 ? "Snap. Your pick breaks in the salt-rusted lock." : "Your last pick snaps.", keep: e.tries > 0, skills: xp(s, "Lockpicking", 0.25) }; } });

  add({ id: "rare", title: "A merchant with a rare find", weight: 2.5, minLv: 4,
    make: (s) => { const item = anyOf(["gem_flawless_diamond", "gem_flawless_emerald", "gold_diamond_necklace", "staff_firebolts", "soul_gem_greater", "tome_thunderbolt", "tome_dragonhide", "arrow_ebony"]) || "potion_health"; const price = Math.round(D.ITEMS[item].value * (item === "arrow_ebony" ? 10 : 1) * 1.1); return { item, price, qty: item === "arrow_ebony" ? 10 : 1, text: `A well-dressed merchant with an armed guard reins in. "I have something special. ${D.ITEMS[item].name}${item === "arrow_ebony" ? " (10)" : ""}. ${price} gold, and you won't see one cheaper."` }; },
    choices: (e, s) => [["buy", `💰 Buy (${e.price} gold)`], ["haggle", `🗣 Haggle (${pct(talkCh(s, 0.2))})`], ["leave", "Not today"]],
    buy: (s, e) => { if (s.gold < e.price) return { text: "You can't afford it.", keep: true }; s.gold -= e.price; give(s, e.item, e.qty); return { text: `You buy the ${D.ITEMS[e.item].name}.`, skills: xp(s, "Mercantile", e.price) }; },
    haggle: (s, e) => { const t = talk(s, 0.2); if (t.win) e.price = Math.round(e.price * 0.8); return { text: t.win ? `"Fine, fine. ${e.price}, and you're robbing me."` : "\"The price is the price.\"", keep: true, skills: t.skills }; } });

  add({ id: "stranger", title: "A mysterious stranger", weight: 2,
    make: () => ({ lore: pick(["\"The Dragon Break is not over. It never was.\"", "\"Have you heard the Elder Scrolls whisper? They know your name.\"", "\"Sovngarde's hall has room for one more. Not yet, though.\"", "\"Count the stars over the Throat of the World. One is missing.\"", "\"The Dwemer didn't vanish. They were edited out.\""]), text: "A hooded stranger walks beside you for a while, though you never saw them arrive." }),
    choices: () => [["listen", "👂 Listen"], ["ask", "❓ \"Who are you?\""]],
    listen: (s, e) => { const n = Math.random() < 0.6 ? revealNear(s, ["dungeon", "lair", "camp", "fort", "landmark", "shrine", "stone"]) : null; return { text: `${e.lore}${n ? ` They point: "${n}. Go and see." It's on your map now.` : ""} When you look again, they're gone.`, skills: xp(s, "Mysticism", 10) }; },
    ask: () => ({ text: "\"Someone who walked this road before the road was here.\" You blink, and you're alone." }) });

  add({ id: "wordrumour", title: "A word wall rumour", weight: 2, minLv: 3,
    when: (s) => typeof SHOUTS2 !== "undefined" && SHOUTS2.WALLS,
    make: (s) => { const read = new Set(s.walls || []); const here = [s.x, s.y]; const w = Object.keys(SHOUTS2.WALLS).filter((n) => !read.has(n) && WORLD.places[n] && (!WORLD.same || WORLD.same(WORLD.places[n], here))).map((n) => [n, G.pxDist(here, WORLD.places[n])]).sort((a, b) => a[1] - b[1])[0];
      return { wall: w ? w[0] : null, text: "An old Nord leans on his staff. \"You've the look of the Dragonborn. My grandfather saw a wall carved with dragon claws, not far from here.\"" }; },
    choices: () => [["ask", "❓ \"Where?\""], ["leave", "Thank him"]],
    ask: (s, e) => { if (!e.wall) return { text: "\"Ah... my memory's not what it was.\"" }; if (!s.discovered.includes(e.wall)) { s.discovered.push(e.wall); (s.explored = s.explored || []).push([WORLD.places[e.wall][0], WORLD.places[e.wall][1]]); } return { text: `"${e.wall}. The wall's there still, they say." It's marked on your map.` }; } });

  add({ id: "herbpatch", title: "A rich herb patch", weight: 3,
    when: (s, c) => !!(typeof HERBS_BY_GROUND !== "undefined" && HERBS_BY_GROUND[c.ground]) || typeof GATHER !== "undefined",
    make: (s, c) => ({ herbs: herbsFor(c).filter(has), text: "A sheltered hollow off the road is thick with wild plants. An alchemist would kill for this spot." }),
    choices: () => [["gather", "🌿 Gather carefully"], ["leave", "Leave it"]],
    gather: (s, e, c) => {
      if (typeof GATHER !== "undefined" && GATHER.patch) { try { const r = GATHER.patch(s, ctx(s)); if (r) return r; } catch (err) { /* fall back */ } }
      const got = []; for (const id of e.herbs) { const n = rint(1, 3) * (P(s, "green_thumb") ? 2 : 1); const g = give(s, id, n); if (g) got.push(g); }
      return { text: got.length ? `You gather ${list(got)}.` : "Nothing worth picking after all.", skills: xp(s, "Alchemy", 6 * got.length) }; } });

  add({ id: "avalanche", title: "Avalanche!", weight: 4,
    when: (s, c) => !c.sol && (c.wx === "blizzard" || c.wx === "snow") && /Snow|peaks|Mountains|hills/.test(c.ground),
    make: () => ({ text: "A deep crack echoes above. Snow begins to slide down the mountainside towards the road!" }),
    choices: (e, s) => [["run", `🏃 Run for it (${pct(athCh(s))})`], ["shelter", "🪨 Shelter behind a boulder"], ...((s.shouts || s.words || []).length ? [["shout", "🗣 Shout it apart"]] : [])],
    run: (s) => { if (Math.random() < athCh(s)) return { text: "You sprint clear as the snow thunders past behind you.", skills: xp(s, "Athletics", 25) }; const d = hurt(s, rint(15, 35)); return { text: `The edge of it catches you and rolls you down the slope. (−${d} health)`, skills: xp(s, "Athletics", 8) }; },
    shelter: (s) => { const d = Math.random() < 0.7 ? 0 : hurt(s, rint(5, 15)); return { text: d ? `The snow buries you to the chest. You dig out, bruised (−${d} health).` : "The avalanche roars over your boulder. You dig out, unhurt but slower.", delay: 30 }; },
    shout: (s) => ({ text: "Your Voice splits the wall of snow. It pours around you on both sides. Impressive.", skills: xp(s, "Mysticism", 10) }) });

  add({ id: "ashfall", title: "Ashfall", weight: 5,
    when: (s, c) => c.sol,
    make: () => ({ text: "Ash rains thick from Red Mountain. Shapes stir in the grey drifts: ash spawn, rising." }),
    choices: (e, s) => [["fight", "⚔️ Stand and fight"], ["hide", `🥷 Pull your hood up and keep low (${pct(sneakCh(s, 0.1))})`]],
    fight: () => fightRes("Burning eyes open in the ash.", enc("Ash spawn") || foe("Ash spawn", 14, ["undead"], 70, 14, [0, 10], ""), { after: "ashLoot" }),
    hide: (s) => { const t = sneak(s, 0.1); return t.win ? { text: "You crouch in the lee of a rock until they sink back into the ash.", skills: t.skills } : fightRes("One of them sniffs you out.", enc("Ash spawn") || foe("Ash spawn", 14, ["undead"], 70, 14, [0, 10], ""), { enemyFirst: true, skills: t.skills }); },
    ashLoot: (s) => { const it = give(s, anyOf(["ing_bone_meal", "ing_charred_hide"])); return it ? `You find ${it} in the ash.` : ""; } });

  add({ id: "riekraid", title: "Riekling raid", weight: 4,
    when: (s, c) => c.sol,
    make: () => ({ text: "Rieklings on tusked boars are raiding a Skaal sledge. A Skaal hunter fights them off alone." }),
    choices: () => [["help", "⚔️ Help the Skaal"], ["leave", "Not your fight"]],
    help: () => fightRes("You charge into the screeching blue mob.", enc("Riekling hunters") || foe("Riekling hunters", 10, ["humanoid"], 60, 11, [2, 18], ""), { after: "skaal" }),
    skaal: (s) => { const g = addGold(s, sc(s, 40)); const it = give(s, anyOf(["ore_stalhrim", "pelt_bear", "food_venison"])); return `The Skaal clasps your arm. "The All-Maker sent you." She gives you ${g} gold${it ? " and a " + it : ""}.`; } });

  add({ id: "nightvamp", title: "Something in the dark", weight: 3, minLv: 8,
    when: (s, c) => c.night && !c.sol,
    make: () => ({ text: "A pale figure stands in the middle of the road, perfectly still. Its eyes catch your torchlight." }),
    choices: (e, s) => [["fight", "⚔️ Draw your weapon"], ["talk", `🗣 "Move aside." (${pct(talkCh(s, 0.3))})`], ["flee", `🏃 Run (${pct(athCh(s, 0.1))})`]],
    fight: () => fightRes("It smiles, showing fangs.", enc("Vampire")),
    talk: (s) => { const t = talk(s, 0.3); return t.win ? { text: "\"Bold. I like bold.\" It steps aside, and is gone.", skills: t.skills } : fightRes("\"No.\" It lunges.", enc("Vampire"), { enemyFirst: true, skills: t.skills }); },
    flee: (s) => Math.random() < athCh(s, 0.1) ? { text: "You run, and don't stop until dawn's grey.", skills: xp(s, "Athletics", 20) } : fightRes("It's faster than you.", enc("Vampire"), { enemyFirst: true }) });

  add({ id: "wisp", title: "Wisp lights in the fog", weight: 3, minLv: 6,
    when: (s, c) => c.wx === "fog" || (c.night && /Forest|forest|Marsh/.test(c.ground)),
    make: () => ({ text: "Blue lights drift between the trees, and a woman's voice sings without words. A Wispmother." }),
    choices: (e, s) => [["fight", "⚔️ Follow the lights and fight"], ["leave", "Cover your ears and walk on"]],
    fight: () => fightRes("The fog thickens into a shape with long cold hands.", foe("Wispmother", 18, ["undead", "elite"], 150, 22, [10, 40], ""), { after: "wispLoot" }),
    wispLoot: (s) => { const it = give(s, anyOf(["soul_gem_greater", "soul_gem_common"])); return it ? `Where she faded, a ${it} glows.` : ""; } });

  add({ id: "lost", title: "A lost traveller", weight: 2.5,
    make: () => ({ text: "A merchant's apprentice waves you down, map upside down. \"Is this the road to Riverwood? I've been walking for hours.\"" }),
    choices: () => [["help", "🧭 Point the way"], ["walk", "🚶 Walk them to the next crossroads"], ["leave", "Shrug"]],
    help: (s) => ({ text: "You turn the map the right way up. They thank you profusely.", skills: xp(s, "Etiquette", 15) }),
    walk: (s) => { const g = addGold(s, rint(15, 40)); return { text: `You walk together a while. At the crossroads, they insist you take ${g} gold.`, delay: 15, skills: xp(s, "Etiquette", 25) }; } });

  add({ id: "mudcrab", title: "A talking mudcrab", weight: 0.5, once: true,
    when: (s, c) => /Marsh|Lake|River|Sea/.test(c.ground) || c.coast,
    make: () => ({ text: "A mudcrab clicks at you from a rock. \"Hello, outlander! Care to see my wares? Very reasonable prices.\" You're quite sure mudcrabs can't talk." }),
    choices: () => [["trade", "🦀 Browse the mudcrab's wares"], ["leave", "Back away slowly"]],
    trade: (s) => { flags(s).mudcrab = true; return { text: "\"A fine selection, yes?\"", shop: ["potion_health", "potion_magicka", anyOf(["gem_flawless_diamond", "gem_diamond"]), anyOf(["scroll_fireball", "scroll_healing"])].filter(has), keep: true }; } });

  const byIdx = Object.fromEntries(L.map((e) => [e.id, e]));

  // ================================================================ rolling and choosing
  const RECENT = 8;
  function seen(s) { return (s.encSeen = s.encSeen || []); }
  function eligible(s) {
    const c = ctx(s), recent = new Set(seen(s)), f = flags(s);
    return { c, ok: L.filter((e) => !recent.has(e.id) && lv(s) >= (e.minLv || 1) && !(e.once && f["once_" + e.id]) && (!e.when || e.when(s, c))) };
  }
  function roll(s) {
    const { c, ok } = eligible(s);
    if (!ok.length) return null;
    let r = Math.random() * ok.reduce((a, e) => a + e.weight, 0);
    const def = ok.find((e) => (r -= e.weight) < 0) || ok[0];
    const sn = seen(s); sn.push(def.id); while (sn.length > RECENT) sn.shift();
    if (def.once) flags(s)["once_" + def.id] = true;
    return { id: def.id, title: def.title, enc: true, ...def.make(s, c) };
  }
  const has_ = (id) => !!byIdx[id];
  function choices(e, s) { const d = byIdx[e.id]; return d ? d.choices(e, s) : []; }
  function choose(s, e, choice) {
    const d = byIdx[e.id];
    if (choice === "leave") return { text: "You carry on down the road." };
    if (!d || typeof d[choice] !== "function") return { text: "" };
    const r = d[choice](s, e, ctx(s)) || { text: "" };
    if (r.after && d[r.after]) { const key = r.after; r.afterFn = (ss) => d[key](ss, e); }
    return r;
  }

  // the share of new encounters vs events.js's roadside ones (herbs, chests, books, shrines…)
  const SHARE = 0.72;
  function wrap() {
    if (typeof ROAD_EVENTS === "undefined" || ROAD_EVENTS.__enc) return;
    const base = { roll: ROAD_EVENTS.roll, choices: ROAD_EVENTS.choices, choose: ROAD_EVENTS.choose };
    ROAD_EVENTS.roll = (s) => (Math.random() < SHARE && roll(s)) || base.roll(s);
    ROAD_EVENTS.choices = (e, s) => (has_(e.id) ? choices(e, s) : base.choices(e, s));
    ROAD_EVENTS.choose = (s, e, c) => (has_(e.id) ? choose(s, e, c) : base.choose(s, e, c));
    ROAD_EVENTS.__enc = true;
  }
  wrap();

  // Meeko, the stray dog: a follower you can only meet on the road
  if (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS && !TOWNS.FOLLOWERS.meeko) TOWNS.FOLLOWERS.meeko = ["Meeko", null, 0, 90, 7, "A loyal stray dog you met on the road. Bites first, asks later.", "dog"];

  // party-aware: one function makes the choice. Leader logic can replace canDecide.
  let canDecide = () => true;
  function decide(s, choice) {
    if (!canDecide(s)) return { text: "Only your party's leader decides what to do here.", keep: true, blocked: true };
    return G.eventChoice(s, choice);
  }

  return { L, byId: byIdx, bribeCost, athCh, trackCh, tameCh, roll, choices, choose, has: has_, ctx, decide, eligible, get canDecide() { return canDecide; }, set canDecide(f) { canDecide = f; }, SHARE, talkCh, sneakCh };
})();
const decideEncounter = (choice) => (typeof S !== "undefined" && S ? ENC.decide(S, choice) : null);
