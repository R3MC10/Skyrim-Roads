/* The newbie guide: a friendly checklist for your first hour, plus answers to common questions.
   Steps tick off by themselves from your save; "Show me" jumps to the right place. [OURS] */
const GUIDE = (() => {
  const flag = (s, k) => !!(s.guide || {})[k];
  function mark(s, k) { if (!s || flag(s, k)) return false; s.guide = { ...(s.guide || {}), [k]: 1 }; return true; }
  //  id, title, what to do (plain words), done(s), where "Show me" goes: {tab, shop?, soc?}
  const STEPS = [
    ["travel", "Travel to a town", "Open Travel, tap a town on the map or press Go in the list. You keep walking even when the app is closed.", (s) => s.discovered.length > D.START_DISCOVERED.length, { tab: "map" }],
    ["trade", "Buy and sell", "In a town, open Town → General goods. Switch between Buy and Sell at the top. Your most valuable things are listed first.", (s) => flag(s, "trade"), { tab: "town", shop: "general" }],
    ["tactics", "Set your tactics", "Fights are turn by turn: spend action points on your moves, or press Auto. Auto uses Smart AI, or your own rules if you pick Custom in Tactics: add one like “Health below 40% → drink a health potion”. Rules are checked top to bottom.", (s) => flag(s, "tactics"), { tab: "tactics" }],
    ["dungeon", "Clear a dungeon", "Travel to a dungeon (the list shows how far) and press Go inside. Pick your way room by room down to the boss. You can leave between rooms.", (s) => Object.keys(s.cleared || {}).length > 0, { tab: "map" }],
    ["level", "Level up and pick a perk", "Skills grow as you use them. When you level up, a dot appears on Hero: choose Health, Magicka or Stamina, then spend your perk point.", (s) => s.level >= 2 && Object.keys(s.perks || {}).length > 0, { tab: "hero" }],
    ["smith", "Mine, smelt and smith", "Buy a pickaxe, mine ore (Town → ⛏ Mine in mining towns), smelt it at the Forge, then make or improve your gear.", (s) => flag(s, "smith") || Object.keys(s.mined || {}).length > 0, { tab: "town", shop: "forge" }],
    ["cook", "Cook or fish", "In towns with an inn, use the 🍲 Cooking pot for food that heals and buffs. Near water, try 🎣 Fishing.", (s) => flag(s, "cook") || flag(s, "fish"), { tab: "town", shop: "cook" }],
    ["friends", "Make a friend", "Tap 👥 at the top. Add other players, send private messages, and trade with friends from anywhere by courier.", (s) => Object.keys(s.friends || {}).length > 0, { tab: "social" }],
    ["home", "Buy a house", "Every city has a house for sale (Town → Buy …). Your chest keeps things safe when you die, and you can run a 🛒 market stall in that town.", (s) => Object.keys(s.homes || {}).length > 0, { tab: "town", shop: "home" }],
    ["arena", "Fight in the Arena", "In Windhelm, challenge another player to a bout (Town → ⚔ The Arena). Nobody dies; the winner takes the stake.", (s) => !!s.arena && (s.arena.w || 0) + (s.arena.l || 0) > 0, { tab: "town", shop: "arena" }],
  ];
  const FAQ = [
    ["What happens when I die?", "You wake up in a nearby town's temple. Your gold and the things you carried lie in a bag where you fell, for a limited time. Go back for it before someone else takes it. Things in your house chest are always safe."],
    ["What's a bounty?", "Crimes like pickpocketing or attacking someone give you a bounty in that hold. Guards there stop you: pay the fine (stolen goods are taken), go to jail (you lose some skill progress), or resist and run."],
    ["Why am I so slow?", "Too heavy. Check Weight under the map. Sell things, store them in your house, or get a horse or a follower to carry more."],
    ["How long is an in-game day?", "One in-game day is 2 real hours. Timers (cleared dungeons, mines) count in-game time; shops are open 08:00–20:00 in-game."],
    ["How do I get around faster?", "Roads are fastest. A horse makes you quicker, and carriages run between cities (Town → Carriage)."],
    ["How do I get to Solstheim?", "Go to Windhelm and open Town → ⛵ Docks. The Northern Maiden sails to Raven Rock for 250 gold (about 10 in-game hours at sea, safe). The map switches to the island while you're there, and you only see other players on the same map. The boat back leaves from the Raven Rock docks."],
    ["Do my bows need arrows?", "Yes. Bows shoot arrows and crossbows shoot bolts; the best ones you carry are used automatically. Buy them at blacksmiths and general stores, or make them at the forge."],
    ["Where do I learn new spells?", "Read spell tomes. Every court wizard sells Novice and some Apprentice tomes (and staffs); each court wizard has a few rarer ones (Farengar in Whiterun, Wuunferth in Windhelm, Calcelmo in Markarth…); the College in Winterhold has them all, up to Master, which it only teaches once your skill in that school is 90. Spells above your level cost more magicka and sometimes fizzle. Utility spells like Candlelight, Transmute and Clairvoyance are cast from the Magic menu, outside fights."],
  ];
  const progress = (s) => { const done = STEPS.filter((st) => st[3](s)).length; return { done, total: STEPS.length }; };
  return { STEPS, FAQ, mark, flag, progress };
})();
