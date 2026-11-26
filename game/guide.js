/* The newbie guide: a friendly checklist for your first hour, plus answers to common questions.
   Steps tick off by themselves from your save; "Show me" jumps to the right place. [OURS] */
const GUIDE = (() => {
  const flag = (s, k) => !!(s.guide || {})[k];
  function mark(s, k) { if (!s || flag(s, k)) return false; s.guide = { ...(s.guide || {}), [k]: 1 }; return true; }
  //  id, title, what to do (plain words), done(s), where "Show me" goes: {tab, shop?, soc?}
  const STEPS = [
    ["travel", "Travel to a town", "On the World tab, tap a town on the map or pick one under Where to?. You keep walking even when the app is closed.", (s) => s.discovered.length > D.START_DISCOVERED.length, { tab: "map" }],
    ["trade", "Buy and sell", "In a town, open Area → General goods. Switch between Buy and Sell at the top. Your most valuable things are listed first.", (s) => flag(s, "trade"), { tab: "town", shop: "general" }],
    ["dungeon", "Clear a dungeon", "Travel to a dungeon (the list shows how far) and press Go inside. Pick your way room by room down to the boss. You can leave between rooms.", (s) => Object.keys(s.cleared || {}).length > 0, { tab: "map" }],
    ["level", "Level up and pick a perk", "Skills grow as you use them. When you level up, a dot appears on Hero: choose Health, Magicka or Stamina, then spend your perk point.", (s) => s.level >= 2 && Object.keys(s.perks || {}).length > 0, { tab: "hero" }],
    ["smith", "Mine, smelt and smith", "Buy a pickaxe, mine ore (Area →  Mine in mining towns), smelt it at the Forge, then make or improve your gear.", (s) => flag(s, "smith") || Object.keys(s.mined || {}).length > 0, { tab: "town", shop: "forge" }, "smithing"],
    ["cook", "Cook or fish", "In towns with an inn, use the  Cooking pot for food that heals and buffs. Near water, try  Fishing.", (s) => flag(s, "cook") || flag(s, "fish"), { tab: "town", shop: "cook" }, "cooking"],
    ["friends", "Make a friend", "Tap  at the top. Add other players, send private messages, and trade: face to face in a trade window when you're in the same place, by courier from anywhere.", (s) => Object.keys(s.friends || {}).length > 0, { tab: "social" }],
    ["home", "Buy a house", "Every city has a house for sale (Area → Buy …). Your chest keeps things safe when you die, and you can run a  market stall in that town. The Market board shows every town's stalls.", (s) => Object.keys(s.homes || {}).length > 0, { tab: "town", shop: "home" }, "housing"],
    ["arena", "Fight in the Arena", "In Windhelm, challenge another player to a bout (Area →  The Arena). Nobody dies; the winner takes the stake.", (s) => !!s.arena && (s.arena.w || 0) + (s.arena.l || 0) > 0, { tab: "town", shop: "arena" }],
  ];
  const FAQ = [
    ["What happens when I die?", "You wake up in a nearby town's temple. Your gold and the things you carried lie in a bag where you fell, for a limited time. Go back for it before someone else takes it. Things in your house chest are always safe."],
    ["What's a bounty?", "Crimes like pickpocketing or attacking someone give you a bounty in that hold. Guards there stop you: pay the fine (stolen goods are taken), go to jail (you lose some skill progress), or resist and run."],
    ["Why am I so slow?", "Too heavy. Check Weight under the map. Sell things, store them in your house, or get a horse or a follower to carry more."],
    ["How long is an in-game day?", "One in-game day is 2 real hours. Timers (cleared dungeons, mines) count in-game time; shops are open 08:00–20:00 in-game."],
    ["How do I get around faster?", "Roads are fastest. A horse makes you quicker, and carriages run between cities (Area → Carriage)."],
    ["How do I get to Solstheim?", "Go to Windhelm and open Area →  Docks. The Northern Maiden sails to Raven Rock for 250 gold (about 10 in-game hours at sea, safe). The map switches to the island while you're there, and you only see other players on the same map. The boat back leaves from the Raven Rock docks."],
    ["Do my bows need arrows?", "Yes. Bows shoot arrows and crossbows shoot bolts; the best ones you carry are used automatically. Buy them at blacksmiths and general stores, or make them at the forge."],
    ["Where do I learn new spells?", "Read spell tomes. Every court wizard sells Novice and some Apprentice tomes (and staffs); each court wizard has a few rarer ones (Farengar in Whiterun, Wuunferth in Windhelm, Calcelmo in Markarth…); the College in Winterhold has them all, up to Master, which it only teaches once your skill in that school is 90. Spells above your level cost more magicka and sometimes fizzle. Utility spells like Candlelight, Transmute and Clairvoyance are cast from the Magic menu, outside fights."],
    ["Fights are too hard (or too easy). Can I change that?", "Yes: Settings → Fights → Difficulty. Story makes foes softer, Hard makes them tougher and smarter. XP, gold and loot stay the same on all three. In a party, the leader's setting counts."],   // difficulty.js
  ];
  /* steps whose feature hasn't opened yet (unlocks.js, 6th field) stay out of the guide until it does */
  const avail = (s) => STEPS.filter((st) => !st[5] || typeof UNLOCKS === "undefined" || !s || UNLOCKS.open(s, st[5]));
  const progress = (s) => { const list = avail(s), done = list.filter((st) => st[3](s)).length; return { done, total: list.length }; };
  return { STEPS, FAQ, mark, flag, progress, avail };
})();
