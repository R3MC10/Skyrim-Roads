/* Patch notes: what changed in each build, newest first, in plain words. [OURS]
   To add a build: put a new entry at the TOP of LIST with a new id. The newest id is what the
   one-time "What's new" popup keys on. */
const PATCHNOTES = (() => {
  const LIST = [
    { id: "b163-maphero", build: 163, date: "24 Nov 2026", title: "Your hero walks the map", items: [
      "On the world map you're no longer a blue dot: it's a little figure of your own character, with your race, armour, helmet and weapon.",
      "Standing still they breathe and their cloak moves a bit. On the road they walk and turn to face the way they're going, and there's a small puff of dust when you arrive.",
      "On your horse you sit in the saddle, and the horse has your horse's coat colour. Standing, it swishes its tail and nods its head; on the road it walks, and on good roads it gallops.",
      "Other players and your party show up the same way, a bit smaller, with a green ring under party members. Works in both art styles; with Reduce motion on, everyone stands still.",
    ] },
    { id: "b143-followeranim", build: 143, date: "24 Nov 2026", title: "Followers fight with their whole body", items: [
      "Followers and party members now really fight in the fight picture: they swing their weapon or draw their bow, cast their spells, raise their shield and flinch when they get hit.",
      "A follower who is knocked down drops to the ground and lies there until someone pulls them back up, and then you see them get back on their feet.",
      "Summons and other helpers lunge, flinch and fall the same way. Works in both art styles and in the painted battle scenes.",
    ] },
    { id: "b143-spelltactics", build: 143, date: "24 Nov 2026", title: "Cleaner spell cards", items: [
      "Spell, power and shout cards in the Magic menu no longer have the \"Use first in every fight\" button. Set up what you cast in a fight in the Tactics tab instead; your current tactics stay as they are.",
    ] },
    { id: "b143-bleakfalls", build: 143, date: "24 Nov 2026", title: "Farengar's quest can't get stuck any more", items: [
      "Bleak Falls Barrow (main quest): clearing the barrow now moves the quest on by itself. The next step, \"The Dragonstone\", sends you to Farengar in Whiterun.",
      "Farengar doesn't need the Dragonstone in your pack any more. If it got lost, ended up in a chest or went to someone else in a party, just tell him: clearing the barrow is enough. Hand it in under Area tab → Court wizard, or with the button in the Journal.",
      "If your quest was stuck on \"bring him the Dragonstone\", it fixes itself next time you open the game. Clearing the barrow before you got the quest counts too.",
      "Quest items (the Dragonstone, a Glenmoril witch's head, the filled black soul gem) are now bound to you: you keep them when you die. If a quest needs one you don't carry any more, it comes back from your house chest or turns up in your pack.",
    ] },
    { id: "b144-dawnguard", build: 144, date: "24 Nov 2026", title: "The vampire war", items: [
      "New quest line from level 12: Isran at Fort Dawnguard (near Riften) sends you into Dimhollow Crypt, where something sleeps in a sealed coffin. It ends at Castle Volkihar, a black keep on an islet off the coast past Solitude.",
      "Then pick a side. Hunt the night with the Dawnguard (heavy crossbow, hunter's armour, troll armour for your follower) or drink Lord Harkon's blood and become a stronger Vampire Lord. Seven more stages either way, with a big boss fight at the end.",
      "Six new perks, three per side: Vampire Hunter, Sun-Blessed Plate and Troll Tamer for the Dawnguard; Blood of Harkon, Night Lord and Court of Volkihar for Harkon's court. You can only take your own side's perks.",
      "In a party only the leader picks the side, and everyone else follows that choice.",
      "The vampire war fights are long and they hurt: expect to finish them bruised and short on potions, and to lose the odd one. No foe in it can take more than about a third of your health in one blow, though.",
      "The \"quest stage done\" lines in quest pop-ups and the \"find them at...\" hints in the Journal now show in Polish too.",
      "Two new achievements, one for each ending. New pictures for the fort, the castle and the story, in both art styles. All of it is in Polish too.",
    ] },
    { id: "b143-comingnext", build: 143, date: "24 Nov 2026", title: "Coming next is up to date again", items: [
      "The Coming next box at the top of Patch notes now shows what's really being built, and it can't get stuck on an old list any more."] },
    { id: "b143-followertab", build: 143, date: "24 Nov 2026", title: "Your follower gets their own tab", items: [
      "Your follower now has their own Follower tab in the Character menu, next to Skills, Character and Perks. Everything about them lives there: overview, bond, gear, magic, tactics, perks, fighting style and Dismiss.",
      "The Character page only keeps one short line about them; tap it to jump to the tab. With nobody following you, the tab tells you who you can hire and where.",
      "Their gear works like your Items menu: their pack or yours, filters (All, Weapons, Armor, Potions, Other), a list you can sort by name, type, damage or armour, weight and value, and a ◆ on what they wear.",
      "Tap an item to see its stats and how it compares with what they wear now, then Give, Give & equip, Equip, Take off or Take it back.",
    ] },
    { id: "b141-polishsweep", build: 141, date: "24 Nov 2026", title: "More of the game in Polish", items: [
      "Playing in Polish? The fight picture now speaks it too: Ty, Uciekają, Zwycięstwo, Pudło, Blok!, critical hits and sneak attacks.",
      "The fight log is in Polish now: who hits for how much, misses, staggers, paralysis, staves, potions and spells.",
      "Foe and spell names, lots of pop-up messages (party, clan, trades, tutorial), the Sea of Ghosts on the map, the Khajiit market and the dungeon minigames are translated as well.",
    ] },
    { id: "b142-balfear", build: 142, date: "24 Nov 2026", title: "Bosses don't run forever, healers don't heal forever", items: [
      "Battle Cry and every other fear or \"stops fighting\" effect now hold a boss for 2 turns and an elite foe for 3. A boss can lose at most 3 turns a fight to fear, an elite 5. For the turns they shake off they stay rattled and hit 20% softer, so the shout still helps. Normal foes still run for the full time.",
      "Foe mages and healers can't patch themselves back to full any more: their own healing stops at about two thirds of their health, adds up to at most a third of it in a whole fight, and a healing spell needs a few turns to come back. Potions and life drain count too.",
      "Aspect of Terror (Illusion) now also keeps bosses and elite foes afraid a turn longer.",
    ] },
    { id: "b141-areaui", build: 141, date: "24 Nov 2026", title: "Tidier towns and map", items: [
      "The Area tab now opens on a board of small tiles, grouped like a real town: Inn, Market, Services & trainers, Work & jobs, Your home, and Events & fun. Each tile says what's going on there (open or closed, room price, lessons left, jobs taken, garden ripe, your bounty).",
      "Things waiting for you in town (a job to hand in, a ripe garden) sit on top under Right now.",
      "Tap a tile to go in. A back button and a row of the neighbouring places (say, all the shops) keep everything one tap away. Shops no longer dump their whole stock the moment you open the Area tab.",
      "Long how-it-works notes fold up; tap More to read them. You can fold whole groups you never use, and they stay folded.",
      "The Map side panel has one \"What to do next\" list instead of two: no more level-up or perk reminders shown twice. The most urgent things come first, nearest places before far ones; tap Show more for the rest.",
      "The place list has filters: All, Towns, Dungeons, Not visited and Other, each with a count.",
    ] },
    { id: "b141-menus2", build: 141, date: "24 Nov 2026", title: "Tidier menus", items: [
      "Items and Magic work like SkyUI: categories on the left, the list in the middle and the picked thing on the right. On a PC screen they sit side by side; on phones the list stays visible above the details.",
      "One sort row: name, value, weight, damage, armour and more, plus a button that flips the order. Each category shows how many things are in it.",
      "Search your spells by name, and find quests in the Journal with the new search box.",
      "The Character page is much shorter: your hero card comes first, and Powers, Skills and Perks fold away until you open them.",
      "Follower tabs fit on one row, and lots of menu words are now in Polish.",
    ] },
    { id: "b139-beastpaths", build: 139, date: "24 Nov 2026", title: "Werewolves and vampires, for real", items: [
      "Beast Form is now a real change in turn-by-turn fights: you fight with the wolf's own moves. Claws (2 AP), Maul (4 AP, costs stamina), Pounce (can stagger, every 3 rounds), Howl (ordinary foes cower, tough ones are shaken and hit softer) and Feast on a beaten foe to heal.",
      "As a beast you can't drink potions, cast spells, shout or raise a guard. Silver weapons (the Vigilants, the Dawnguard, the Silver Hand) bite harder, and when you change back you're worn out for two rounds.",
      "The Vampire Lord gets Drain Life, Vampiric Grip, Raise Dead and his claws. A vampire who isn't changed can use Seduction, Embrace of Shadows when hungry enough, and a Bite to feed in the middle of a fight.",
      "The sun burns hungry vampires every round when you fight outdoors by day. A starving vampire pays more in shops and gets turned away at the door; townsfolk talk about how pale you look.",
      "New at night on the road: a werewolf on the hunt (its bite can give you Moonblood, which turns you in three days unless you cure it at a shrine or with a cure potion), and the Ashen Court, vampires who offer you their gift.",
      "Changing in town is seen: people scatter and prices go up in that hold for a day.",
      "New perk stars. Werewolf: Rending Claws, Howl of the Pack, Silver Hide, Endless Hunt. Vampire Lord: Blood Magic, Grave Servants, Sun Ward. New skill perks: Bane of the Night (Restoration, hurts vampires) and Wolfsbane (Alchemy, half the chance to catch either curse).",
      "In a party your form shows on everyone's phone, and theirs on yours. Only the leader answers the Ashen Court.",
      "The wild werewolf on the road now looks like the real thing: the same wolf on two legs you turn into, not a hairy man.",
      "All of it is in Polish too: the moves, the night encounters, Moonblood, the vampire's hunger and the new perks.",
      "Fight tooltips close as soon as you tap a move, so they never hang over the log or the buttons.",
    ] },
    { id: "b139-bossfights", build: 139, date: "24 Nov 2026", title: "Boss fights feel like big moments", items: [
      "Dragons, dragon priests, Daedric and quest bosses and the boss at the end of a dungeon now get a proper entrance: black bars, their name and title, and a slow zoom. Tap to skip it.",
      "Bosses have a big health bar at the top with marks for their phases. Knock them past a mark and they change: they get angrier, call for help, set the ground on fire or switch to a new element. A banner tells you what just happened.",
      "Bosses warn you a turn ahead before their big attacks. The warning tells you how to answer: block, a ward or keep AP back to dodge. A shout or a shield bash can break the attack before it lands.",
      "The final blow on a boss plays in slow motion, and the loot gets its own big reveal.",
      "Three new perks: Giant Slayer (One-Handed, more damage to bosses, even more in their last phase), Read the Signs (Block, big boss attacks hurt less) and Break Their Focus (Two-Handed, hard hits always break a big attack and stagger the boss).",
      "Bosses last a bit longer but stay beatable. Followers still only get knocked down. Works in both art styles and in Polish.",
    ] },
    { id: "b141-pnback", build: 141, date: "24 Nov 2026", title: "Easier way out of the patch notes", items: [
      "The patch notes now have a bar at the top that stays put while you scroll: ‹ Back on the title screen, ✕ in the game. No more scrolling all the way down to leave.",
    ] },
    { id: "b139-perf", build: 139, date: "24 Nov 2026", title: "Faster and smoother", items: [
      "The game starts a lot faster: the title screen now shows up in about a second instead of several on older phones.",
      "The world map, the title screen, the road pictures and the fight screen use much less of your phone's power when nothing is moving, so older phones stay smoother and cooler and the battery lasts longer.",
      "Nothing looks or plays differently, it just runs lighter.",
    ] },
    { id: "b139-lightfx", build: 139, date: "24 Nov 2026", title: "Light and weather you can feel", items: [
      "The map now changes with the light: warm gold at sunrise and sunset, a cool blue night, and a flat grey wash when a storm rolls in.",
      "At night towns, farms, camps and forts glow with firelight, and the glow flickers a little.",
      "Beams of sunlight fall across the map at dawn and dusk.",
      "Mist gathers over valleys, lakes and marshes, thickest in the early morning, and drifts slowly.",
      "Big cloud shadows slide across the land, and lakes and rivers sparkle in the sun or the moons. On clear nights the northern lights tint the snow up north green and violet.",
      "Place pictures get the same light: lit windows and fires glow at night, sunbeams at dawn and dusk.",
      "New Settings → Graphics → Lighting: Off, Low or High. Low keeps the colours and glows but nothing moves, for older phones. Works in both art styles; Reduce motion stops the drifting and High contrast keeps the map brighter and clearer.",
    ] },
    { id: "b140accounts", build: 140, date: "24 Nov 2026", title: "Accounts: your characters on every device", items: [
      "New on the title screen: Sign in. Make an account with just a name and a password (no email needed) and your characters are kept safe on our server.",
      "Play the same character on your phone, another phone or the PC: under Account, tap Play here. Upload the character you already have with one tap; nothing is lost.",
      "One device at a time: if you sign in somewhere else, the game asks whether to play there instead. The other device is told right away and stops saving, so your two devices never fight over your progress.",
      "Your progress saves to your account a few seconds after you play, and catches up by itself when you're back online. If a character was played somewhere else in the meantime, you choose which copy to keep.",
      "Signed in, the shared world (other players, parties, chat, trades, the market) comes through our server too, so friends see each other more reliably. Not signed in? Everything works exactly as before.",
      "There's no email on accounts yet, so keep your password safe: it can't be reset for now.",
    ] },
    { id: "b138-hsrooms", build: 138, date: "24 Nov 2026", title: "Homestead rooms, raids and guests", items: [
      "Two new rooms that don't use a wing space: a Garden with six beds (plant herbs or vegetables from your pack, each bed gives 2 a day) and a Cellar under the main hall that keeps 40 things safe and keeps goods waiting a day longer.",
      "Your wings are real stations now: the Armory is a forge (make, smelt and improve gear at home), the Alchemy lab makes potions 10% stronger, the Enchanter's tower is an enchanter that enchants 10% stronger.",
      "Sleeping by the main hall's hearth gives Well Rested +15%, and breakfast from the kitchen makes it last half again as long.",
      "Display cases in the main hall (2) and trophy room (4 more): put weapons, armor and gems on show and visitors pay gold every day.",
      "Followers can move into your homestead (up to 3, once the main hall stands). They chop wood and haul stone every day and fight beside you. Fetch them back any time for free.",
      "Every few days raiders come for the house: bandits, vampires or frost trolls. Fight them at the door, try to talk them down, or leave it to your steward and followers. Lose and they carry off some building materials, but never what's in storage or the cellar.",
      "Party members in the leader's town can visit the leader's homestead: look around inside, sleep in the guest bed and eat at the kitchen table.",
      "New perks: Master Builder (a fourth wing) and Hearth Forge (better improving at home, more arrows) in Smithing; Gracious Host (display cases earn double, guests always sleep well) and Call to Arms (better at talking raiders down, defenders hit harder) in Speech.",
      "Everything about the homestead rooms, raids and guests is in Polish too.",
      "On phones, messages and achievement pop-ups now sit near the bottom and show one at a time, so they no longer cover the homestead tabs and the picture of your house.",
    ] },
    { id: "b139-hud2", build: 139, date: "24 Nov 2026", title: "A cleaner screen", items: [
      "Messages, guard chatter and follower lines now share one spot at the top left, under the compass. Only one person talks at a time; the next one waits their turn instead of piling on top.",
      "Your quest goal is a thin line under the compass. A new goal flashes there instead of a big banner in the middle of the map.",
      "Big banners (skill up, level up, new quest) sit in the middle of the map, under the messages, never on top of them.",
      "Health, magicka and stamina fade away when they're full, like in Skyrim. Carry weight only shows when you're getting heavy. Tap the bars to see everything for a moment.",
      "The ★ favourites button moved to the top bar, next to Search and Menu. The round compass button is the only floating button left: it moves up when there's a button under it, and on big screens it sits in the empty corner of the bottom bar.",
      "The map buttons (zoom, centre, hunt, sneak) are one slim strip now, so the compass has more room.",
      "Bottom bar names fit on small phones (no more cut-off \"Społeczność\").",
    ] },
    { id: "b137-livingworld", build: 137, date: "24 Nov 2026", title: "The world remembers you", items: [
      "What you do is remembered in the hold where you did it: dragons you slay, caravans you guard all the way, caravans you rob, and every crime (even after you pay the bounty, though bad deeds fade over a couple of weeks). It all adds to your name in each hold.",
      "Towns react. Guards and shopkeepers bring up what you did. Do enough good and doors open: the inn's back room (free whispers), the steward's storeroom (a few materials once a day) and a guest room in the Jarl's hall (a free bed once a day). Cause enough trouble and the shutters close: no knocking at night, no whispers, and shops charge you 15% more. Give to the temple in the streets to make amends.",
      "Townsfolk keep their own hours. Area → Streets shows who's about and what they're doing. In the evening the trader, the smith and the stablemaster go for a drink at the inn: find them there and they'll open up for you without the night charge.",
      "Whispers of things to come: listen in an inn (evenings are best) and hear about something that hasn't happened yet: a dragon looking for a roost, a warband gathering, a troll coming down, a vampire nest, a stranded merchant, a forgotten shrine. Most come true about half a day later and become a real place on your map, with a bounty for dealing with it. Some come to nothing.",
      "News of the realm in Map → World news and on every inn's notice board: what you did, what came true, and the talk of each day across Skyrim.",
      "In a party the leader's world is everyone's: you see the leader's whispers, marks and news, and the leader does the asking and deciding.",
      "New perks: Town Crier (Speechcraft: whispers come true more often and sooner, bounties pay more), Low Profile (Streetwise: crimes hurt your name less and are forgotten faster), Well Met (Etiquette: doors open sooner, amends cost less).",
      "All of it is in Polish too, when the game is set to Polish.",
    ] },
    { id: "b138-greatevents", build: 138, date: "24 Nov 2026", title: "Great world events", items: [
      "Every 12 hours something big happens in the North: a dragon attacks a town, a Daedric rift tears open, a bandit army besieges a hold capital, or a town throws a great fair. All your friends see the same event at the same time.",
      "A banner on the map counts down to it 45 minutes ahead, then counts down how long is left. The place glows on the map.",
      "Dragon, rift and siege are big boss fights in three phases. Go to the place and charge in. Every charge from every player wears the boss down, and whole parties of up to 8 can fight together (the leader starts each charge).",
      "When it ends you get gold and loot based on how much you helped, plus a title for doing your fair share: Firebreaker, Riftsealer or Siegebreaker. Even a lost fight pays a little.",
      "Events leave their mark: a burned town is dearer while it rebuilds over a few days, an open rift or a lost siege pushes prices up in that hold, and a saved hold thanks you with cheaper shops.",
      "Fairs have archery, arm wrestling, a drinking contest and a lucky wheel, a prize stall (top prize: the Fair Champion title), and every shop in town is 25% off.",
      "New perks: Dragonward (Blocking), Rift Warden (Restoration), Siege Breaker (One-Handed), Fairgoer (Mercantile) and Hero of the Hour (Etiquette).",
      "Everything about great events is in Polish too: banners, countdowns, fights, fair games, prizes, titles and perks.",
      "A charge that doesn't finish the boss now says \"Charge landed\" instead of \"Victory\", and the event pop-up waits its turn so it never covers the Objective banner.",
    ] },
    { id: "b137-kit", build: 137, date: "24 Nov 2026", title: "Fairer bandit tricks", items: [
      "Poison, burning, bleeding and venom now respect your armour: if your armour soaked most of the blow, it soaks most of the poison too. Heavy armour finally helps against poisoned blades and fire bolts.",
      "Foe healers (bandit mages, priests and the like) can only cast their healing spell twice a fight, and it heals a little less. No more endless self-healing against low-level warriors.",
    ] },
    { id: "b138-followerbonds", build: 138, date: "24 Nov 2026", title: "Followers have opinions now", items: [
      "Your follower notices what you do. Help a stranger, rob a sleeping bandit, run from a giant, pray at a shrine, join the Thieves Guild: each follower likes some things and hates others, and says so.",
      "Their loyalty shows as a meter under their name (Hero tab → Follower). Devoted followers hit 10% harder. Unhappy ones grumble, fight 15% softer, sometimes refuse to change gear, style or tactics, and at 0 they walk out (they're fine, just angry, and won't come back for a few days).",
      "They talk: little lines on the road and in towns, a word when you arrive somewhere, and a comment after big fights.",
      "New Bond tab on the follower screen: what they like and dislike, what they said lately, a Talk button and a daily 100-gold gift.",
      "Every follower has a personal quest that opens at loyalty 80: go somewhere with them, clear a place, and make a last choice. They learn a signature move they use once per fight (a big hit, a volley, a bleeding shot or a heal) and you get a keepsake piece of gear.",
      "New perks: Kindred Spirit (Speechcraft): loyalty grows faster and drops slower. Heart to Heart (Speechcraft): talks count double and they never refuse your orders. Sworn Companion (Etiquette): personal quests open at 65 and signature moves are 25% stronger.",
      "In a party only the leader makes choices, so a personal quest's last choice waits until you lead or travel alone.",
      "All of it is in Polish too: the Bond tab, every line they say, their quests, moves and keepsakes.",
    ] },
    { id: "b138foetarget", build: 138, date: "24 Nov 2026", title: "See who the enemy goes for", items: [
      "Every move a foe plans this round now says who it's aimed at: \"→ you\", \"→ Lydia\", a summon or a party member. Bosses with several moves and groups of foes show a target for each one.",
      "A red crosshair sits on the card of whoever is about to be hit, the next target gets a red outline, and a dashed arrow in the battle picture points from the foe to them.",
      "What it shows is what happens: the blow lands on that target. It only changes for a real reason, and the screen tells you why: the target went down, or a follower or a guard stepped in front.",
      "Wind-ups and aimed shots keep their target for the blow that follows. In shared party fights everyone sees the same targets, and the one aimed at you reads \"you\" on your phone.",
      "How often foes go for you or your companions hasn't changed, they just tell you earlier.",
    ] },
    { id: "b137tt", build: 137, date: "24 Nov 2026", title: "Tooltips on almost everything", items: [
      "Rest the mouse on almost anything to read what it is: items, spells, tomes, perks, skills, places, quests, followers, party members, your health, magicka and stamina bars, carry weight, level and gold.",
      "On a phone, hold your finger on it for a moment instead. Holding doesn't press the button underneath, and a normal tap works just like before.",
      "Item tooltips show damage or armor, weight, value, enchantments and how it compares with what you're wearing. Places you haven't found yet stay secret.",
    ] },
    { id: "b136", build: 136, date: "24 Nov 2026", title: "Rings, amulets and lots more enchantments", items: [
      "You can now wear one amulet and two rings. They have their own slots under your character in the Pack tab: tap one to put something on.",
      "Rings and amulets are real gear now. Iron, silver, gold, moonstone and dwarven pieces, plain or set with a gem. Foes and bosses drop them (often enchanted), general stores sell plain ones, court wizards sell a few weak enchanted ones, and the forge makes them from an ingot and a gem.",
      "Enchant rings and amulets at an arcane enchanter like any other gear. Gem-set and finer pieces hold stronger magic. Break enchanted ones down to learn their effect.",
      "27 new enchantments (44 in all): Paralyze, Fear, Calm, Soul Trap, Turn Undead, Bleeding, Absorb Stamina and Magicka on weapons; Resist Fire, Frost, Shock and Poison, Regenerate Health, Magicka and Stamina, Fortify Block, Critical, Evasion, Heavy and Light Armor, cheaper Alteration, Conjuration and Illusion, and Fortify Smithing, Alchemy, Pickpocket and Speech on worn gear.",
      "Wearing several pieces with the same enchantment adds up, but only to a limit, so stacking can't make fights a walkover. Extra weapon and Destruction damage pieces count for less each (the best one in full, the next half), up to +25%.",
      "Four famous pieces can turn up on the strongest foes: the Gauldur Amulet, the Amulet of Articulation, the Ring of the Erudite and the Ring of the Hunt.",
      "New Enchanting perks: Jeweller (stronger magic on rings and amulets, and you find more of them), Warding Enchanter (stronger resistances) and Hex Enchanter (stronger paralyze, fear, absorb and the like).",
      "Item details now say in plain words what each enchantment does.",
    ] },
    { id: "b136vision", build: 136, date: "24 Nov 2026", title: "A cone of sight on the map", items: [
      "Your marker on the map now looks the way you're walking, with a soft cone of sight in front of it. When you stop, it keeps looking that way.",
      "Inside the cone the fog thins out and you see clearly: other travellers further off than before, caravans, guard patrols, and the foe that blocks your road, standing right ahead of you.",
      "Places inside your cone get spotted from afar and go on your map, so you find them before you walk past them. Big cities show up from far away, a small shrine only when you're close.",
      "How far you see depends on the world: night, fog, storms and blizzards cut it short, hills and mountain passes let you see much further, and riding a horse helps a little. Practised archers have sharper eyes too.",
      "Party members each have their own fainter cone, so you can see where everyone is looking.",
      "New perks: Far Sight (Archery) lets you see further and wider on the map; Owl Eyes (Sneak) makes darkness and bad weather hurt your sight only half as much.",
      "Works in both art styles: soft ink edges in the drawn style, chunky dotted edges in pixel art.",
    ] },
    { id: "b137-ctl", build: 137, date: "24 Nov 2026", title: "New fight controls", items: [
      "Your moves in a fight now sit in a proper action bar at the bottom: three big buttons for Attack, Power attack and Guard (or Shield bash), with Magic, Items, Flee and End turn right under them. Easy to hit with a thumb, even on small phones.",
      "Every move shows its cost as gold pips, and the AP row at the top lights up which pips a move would use before you tap it. The pips you spend burst away.",
      "Moves you can't use right now are greyed out and say why: \"Need 2 more AP\", \"Not enough stamina\", \"Need 12 more magicka\", \"None left\".",
      "Quick slots above the big buttons hold your shouts and your favourite spells, potions and scrolls. Tap the star next to anything in Magic or Items to pin it there. Until you pin something, it suggests your best healing spell, your best attack spell and a health potion.",
      "Magic and Items open as tabs with filters by school, and your spells and potions have their pictures in both art styles.",
      "Healing with a follower or friend beside you? Tap the spell or potion and then tap who gets it (or tap it again for yourself). Dragging onto someone still works.",
      "Buttons react when you press them, and phones give a little buzz.",
      "On a PC: keys 1 to 9 use the numbered moves, Space ends your turn (and skips the foe's turn or presses Continue), M opens Magic, I opens Items, F flees, Esc goes back.",
      "Prefer the old cards or the combat wheel? Settings, Fights, Controls. The target button at the top still switches the timing ring on or off.",
    ] },
    { id: "b137", build: 137, date: "24 Nov 2026", title: "Sharp, never stretched, on every screen", items: [
      "Pictures keep their shape on every phone, tablet and PC: nothing gets squashed or stretched any more, even when you turn your phone sideways or resize the window.",
      "The map redraws straight away when you turn your phone or resize the window, instead of looking stretched until you touched it.",
      "The lockpicking, pickpocketing, forge, alchemy, enchanting and ring mini-games are now sharp on high-resolution phones and tablets (they were blurry before).",
      "The title screen, the travel scene, the dungeon map's torchlight and the fight scene are sharper on big tablets and PC monitors.",
      "Pixel art title screen: every pixel is now the same size, so the picture no longer has uneven rows.",
      "On a big PC monitor, the +gold number, flying loot and fight tips now show up where they should instead of off to the side (they used to push the page sideways).",
      "Phones with a notch or camera cut-out: menus and popups now stay clear of it, also in landscape.",
    ] },
    { id: "b136-5", build: 136, date: "24 Nov 2026", title: "A proper road picture while you travel", items: [
    ] },
    { id: "b135-compass", build: 135, date: "24 Nov 2026", title: "A real 3D compass", items: [
      "The golden compass on the home screen is now a proper 3D piece: drag it and it tilts toward your finger, catching the light and showing its thick bronze edge, then springs back when you let go.",
      "Skills, Magic, Items and Map now sit around the compass instead of on top of it, on phones held upright or sideways.",
    ] },
    { id: "b136-4", build: 136, date: "24 Nov 2026", title: "A proper road picture while you travel", items: [
    ] },
    { id: "b136places", build: 136, date: "24 Nov 2026", title: "Something at every place", items: [
      "Every place on the map now has something to do. 52 spots that used to be just a picture (farms, mills, shrines, cabins, groves, old ruins, the All-Maker Stones) now offer a stall, work, a job, a blessing, a hidden strongbox, herbs or a spot worth searching. Look under \"What's here\" when you arrive.",
      "Farms and mills: buy fresh food from a small stall, lend a hand once a day for a few coins, or take the farmer's job to clear a nearby cave.",
      "Shrines and stones: pray for a blessing that heals you and lasts a day (Talos, Azura, Meridia, Boethiah, Mehrunes Dagon, Stendarr, the All-Maker Stones). One blessing at a time.",
      "Cabins, shacks and lodges hide a strongbox to pick. Ruins and monuments are worth a search every few days: coins, scrolls, sometimes a book. Groves grow rare herbs.",
      "Everything comes back on a timer (a day for work and blessings, two for herbs, three for strongboxes and searches), so it's worth coming back.",
      "Raven Rock Mine on Solstheim now has ore veins to mine.",
      "New perks: Wayfarer's Nose (Lockpicking): strongboxes hold 30% more and refill a day sooner. Pilgrim (Restoration): blessings last two days.",
      "The places list shows what you can do at each spot.",
    ] },
    { id: "b136vote", build: 136, date: "24 Nov 2026", title: "Vote on the road with your party", items: [
      "Travelling together: when the party leader runs into a foe or something by the road, everyone with them now gets the same window with the same choices, not just a \"wait\" note.",
      "Members tap a choice to vote for it. Your little portrait pops up next to the option you picked, on everyone's phone, the leader's too, and moves as people change their minds. Tap it again to take your vote back, or Just watch to close the window.",
      "Only the leader's tap actually happens. When they choose, everyone's window closes and you see what they picked and how it went.",
    ] },
    { id: "b136-3", build: 136, date: "24 Nov 2026", title: "Meet caravans on the road", items: [
    ] },
    { id: "b137-tomeinfo", build: 137, date: "24 Nov 2026", title: "Know the spell before you buy the tome", items: [
      "Spell tomes for sale now tell you what you'd learn: the school, the level (Novice to Master), how much magicka and how many AP it costs, and what it does, with your own numbers.",
      "Each tome also says if you already know the spell and if your skill is high enough. Too low, and it warns you the spell will cost more and sometimes fizzle.",
      "You see this at court wizards, the College, general stores, travelling traders, caravans, the Khajiit caravan, other players' market stalls, in your pack, in fight loot, in the party loot vote and in search.",
    ] },
    { id: "b136-2", build: 136, date: "24 Nov 2026", title: "Followers fight like you do", items: [
      "Your follower is now a full character. They have their own magicka and stamina, take their own turn with action points like yours, and pick from the same moves: attacks, power attacks, guarding, stepping in front of you, spells and potions.",
      "Teach them spells: open the follower screen, go to Magic and hand them a spell tome from your pack. They can learn it if they're good enough in that school (Apprentice 25, Adept 50, Expert 75, Master 90). You can tell them not to use a spell.",
      "Mages throw fire, frost and shock, healers patch you and the party up, conjurers call atronachs and raise the dead, and some cast flesh spells and wards. Their summons fight on their own and fade after a few turns.",
      "They drink potions you give them when they need them. Tick Save potions for emergencies if you'd rather they wait until it's bad.",
      "New Tactics tab: Let them decide, Aggressive, Defensive, Healer or Ranged. Healers and archers stand in the back row and get hit less; defensive followers stand in front and draw blows to themselves.",
      "They can wear everything you can, and hold a second one-handed weapon in the left hand.",
      "Combos: one of you sets the foe up, someone else cashes in. Shatter (hit a foe someone else froze), Overload (shock a foe someone else set burning), Steam (frost on someone else's burn: it all goes off at once), Thermal shock (fire on someone else's chill) and Opening (your follower, summons and friends hit a staggered or paralyzed foe harder). Combos are capped, so no one-shots.",
      "Under the foe's health you can now see what it's weak to or shrugs off (fire, frost, shock).",
      "In a fight, your follower shows magicka and stamina bars and which row they're in. Followers are still only knocked down, never killed.",
      "Two new Speechcraft perks: Battle Tutor (your follower learns tomes 10 points early and pays 20% less magicka) and Shield-Brother (combos hit 25% harder).",
    ] },
    { id: "b136-2-3", build: 136, date: "24 Nov 2026", title: "Party fights: everyone plays the same fight", items: [
      "When you follow a party leader into a fight, your phone now opens the full fight screen: the same foe, the same health bars and the same log as everyone else, live.",
      "On your turn you play as yourself, with your own moves, spells, magicka, stamina, potions and shouts. No more being played as a follower.",
      "The leader's and other players' moves show in your log under their names. Followers and summons still fight on their own.",
      "Each turn has 90 seconds; if time runs out, that player holds back and guards. If you get knocked down, you get back up after the fight, badly hurt.",
      "If the leader's phone goes quiet for two minutes, the fight breaks off.",
    ] },
    { id: "b136-2-2", build: 136, date: "24 Nov 2026", title: "Enemies come alive", items: [
      "Every enemy now moves like your hero does: they breathe while they wait, wind up and swing, bite, claw, stomp, breathe fire or cast, flinch when you hit them, reel from big blows, duck aside when you miss, and crumple to the ground when beaten. Beat you, and they gloat.",
      "Wolves lunge and snap, bears rear up and swipe, spiders rear back and bite, mudcrabs pinch, dragons rear up and spread their wings before they breathe, mammoths stomp, ice wraiths coil and strike.",
      "The painted enemy pictures move too: they bend, lunge into their attacks, recoil when hit and fall over. Works in both the hand-drawn and the pixel art style.",
    ] },
    { id: "b136-2-2-2", build: 136, date: "24 Nov 2026", title: "Your hero, properly drawn", items: [
      "Characters got a big art upgrade: real proportions, shading, faces that match your race (snouts, whiskers, tusks, pointy ears, tails), hair and beards.",
      "Everything you wear shows up: helmet, armour and its colours, cloak, shield, weapon, even an amulet or ring.",
      "Your hero now actually walks on the road, rides the horse properly, sits on the wagon bench, and swings, blocks, casts and gets knocked down in fights. Moves flow smoothly from one into the next.",
      "Party members, followers and other players use the same new look, on the road, in fights, in portraits and on the hero tab. Works in both the hand-drawn and the pixel style.",
    ] },
    { id: "b136-2-2-2-4", build: 136, date: "24 Nov 2026", title: "Meet caravans on the road", items: [
    ] },
    { id: "b136-2-2-2-3", build: 136, date: "24 Nov 2026", title: "Meet caravans on the road", items: [
      "Caravans on the map are now something you can meet while you travel. When you're close, their wagons get a gold ring and say \"tap to meet\": tap them, or just walk up beside them and you'll be asked to stop.",
      "Meeting a caravan pauses your trip. Trade with their merchant (every caravan run carries different goods), ask for news from the road (a rumour or a new place goes on your map), or just wave and carry on.",
      "Guard the wagons: walk the rest of their road with them, at their pace, and get paid when you roll into their stop. Ambushes can still hit the caravan on the way.",
      "Walk with them a while: stay close to the wagons and bandits leave you alone far more often.",
      "Or rob them. You'll fight their guards and get a bounty in that hold, but the gold and goods are yours if you win. They'll remember your face for a day.",
      "In a party, only the leader stops for a caravan; everyone else sees what happens.",
      "Caravan Friend (Speechcraft) now also pays 25% more for guarding caravans you meet on the road.",
    ] },
    { id: "b136dg", build: 136, date: "24 Nov 2026", title: "Dungeon mini-games, and watching your leader", items: [
      "Dungeon rooms are played now, not rolled. Dash through a trap by running between the swinging blades, find the trigger by spotting the stone that sits low and glints, smash a chest with well-timed swings, sneak past a foe by stopping when it turns (and waiting in the shadows), and search a quiet room by rubbing the dust away. Each takes 5 to 15 seconds.",
      "New choice in fight rooms: Run for it. Tap Left and Right in turn as fast as you can to get past the foe. Get caught and it hits first.",
      "Your skills still matter: better Acrobatics, Sneak, Athletics and weapon skills make the games easier, and a near miss hurts less than a bad one. Light Foot shows you the trigger stone.",
      "New perks: Blade Dancer (Acrobatics), Trap Sense and Patient Shadow (Sneak), Lid Breaker (Two-Handed), Sprinter (Athletics) and Keen Searcher (Lockpicking) each make one of these games easier.",
      "In a party, everyone in the dungeon watches the leader play live: the blades, the chest, the lock and the pillar rings, tap by tap, and then sees what happened. The leader's play decides it for the whole party.",
    ] },
    { id: "b136-dungeons", build: 136, date: "24 Nov 2026", title: "Bigger party, longer dungeon", items: [
      "Dungeons now get longer for every friend in your party who goes in: 2 more rooms each for the first three friends, then 1 more each. A full party of 8 walks 10 extra rooms before the boss.",
      "The extra rooms are the usual mix: fights, tough fights, traps, treasure chests, odd finds and the odd spot to rest. There's still a breather room right before the boss.",
      "The party leader rolls the map once when you go in, so everyone in the party walks exactly the same rooms. This now also works for co-op runs started from the dungeon door (not just the party ready check).",
      "Going in alone? Nothing changes.",
    ] },
    { id: "b135-fix", build: 135, date: "24 Nov 2026", title: "Small fix", items: [
      "Fixed: with the Prospector perk, now really every ore vein glints in the mining game (one could stay hidden before).",
    ] },
    { id: "b136-2-2-2-2", build: 136, date: "24 Nov 2026", title: "A proper road picture while you travel", items: [
      "The little picture under your trip is now a real moving landscape: snowy mountains far off, hills and forests that match where you are (pines, the Rift's golden birches, marsh, snowfields, ash wastes, rocky hills), and a road with ruts or old flagstones.",
      "The sky and light follow the real time of day: sun, moons, stars and northern lights at night, warm light at dusk. Snow, rain with lightning, fog, ash and autumn leaves blow through when that's the weather.",
      "Things pass by on the way: signposts, wayshrines, standing stones, ruins, camps and lanterns, and other travellers, guard patrols and Khajiit caravans come the other way. At night you carry a torch and windows light up.",
      "The place you're heading to rises on the horizon and grows as you get closer, and a gold thread along the bottom shows how far you've come.",
      "Runs smoothly on phones and stops when you can't see it, so it doesn't drain the battery. Works in both art styles (pixel art stays crisp).",
    ] },
    { id: "b135", build: 135, date: "24 Nov 2026", title: "No more flickering popups", items: [
      "Fixed: popups (like tapping an equipment slot) flickered for a split second just after they opened. They now open smoothly and stay put.",
    ] },
    { id: "b134", build: 134, date: "24 Nov 2026", title: "The Dragonstone in parties, and PC updates", items: [
      "Fixed: in a party, the Dragonstone and the Golden Claw went into the party's loot pile, so only one player got them and everyone else couldn't finish Farengar's quest. Now every player keeps their own.",
      "If you cleared Bleak Falls Barrow in a party and don't have the Dragonstone, it's back in your pack next time you open the game. Bring it to Farengar in Dragonsreach.",
      "Farengar now also takes the Dragonstone in Whiterun's Court wizard shop (Area tab), not only under Dragonsreach & hirelings.",
      "PC players on build 100 never got updates: that build came out just before the PC version learned to update itself. Download the setup version once from the download page and run it. Your saves stay.",
      "The PC game now tells you when a newer build is out, with a Download button. The portable .exe can't update itself, so it shows this every time there's a new build.",
      "The setup version keeps updating itself in the background; it only shows the card if it falls 3 or more builds behind.",
    ] },
    { id: "b133", build: 133, date: "23 Nov 2026", title: "Painted battle scenes", items: [
      "Fights now happen in front of hand-painted scenes instead of the plain drawn ones: Embershard Mine has its own, and every dungeon, camp and lair uses the one for its kind (burial barrows, Dwemer vaults, Forsworn redoubts, vampire lairs, temples, forts, Thalmor keeps, bandit and giant camps, dragon lairs).",
      "Road fights show the land you're in: snowy passes, pine forest, autumn woods, marsh, the ashlands, rocky highlands or the open tundra. Duels in Windhelm get the arena.",
      "Torches and braziers flicker and glow, lanterns sway, banners and reeds move in the wind and steam rises in Dwemer ruins, even while you're choosing your next move. The background shifts a little with the camera so the scene has depth. With Reduce motion on, it all stays still.",
      "Night, dusk and bad weather still darken and tint the scenes outdoors, and caravans still stand behind the fight. Both art styles work: in pixel art the paintings turn into pixels too.",
    ] },
    { id: "b132", build: 132, date: "23 Nov 2026", title: "See what's coming in a fight", items: [
      "Foes show their next move before they make it. Under the foe's health bar, Next lists what it will do with each of its turns this round, and the first one floats over it in the fight: ⚔ 18–26 for a normal hit, 💥 Huge blow or 🎯 Aimed shot in red when a big one is coming, ✚ when it's about to heal, 🛡 when it raises a shield. The numbers already count your armour and guard. Hold a finger on one to read it.",
      "Health bars show what's about to come off. Striped parts of your bar are the damage this round's blows plus your poison or burning will take, with the numbers under the bar (for example ⚔ −39 ☠ −18 ≈ −57). The foe's bar does the same for its burning, bleeding and your cloaks. Healing shows as a green edge.",
      "Your own poison, burning, bleeding, chill, healing and guard now sit on your own frame as labelled chips (Poisoned −6 ×3 means 6 each time a foe acts, 3 more times).",
      "The foe's turn plays out one step at a time instead of all at once: each blow, its number and the health bars, then the next. A Skip button jumps to the end, and ⏩ Fast keeps the old quick way.",
      "Banners tell you whose turn it is (Bandit's turn, Your turn), and a new round shows what happened in the last one: how much you dealt and how much you took.",
      "Under a quarter of your health, the edges of the screen pulse red and you hear your heartbeat.",
      "New fight sounds: a horn for your turn, war drums for the foe's, a gong for a new round, a grunt when a foe winds up, poison and burning hissing, healing, the heartbeat, and real recorded sword, axe, mace and arrow hits, clangs, swings, victory and defeat.",
    ] },
    { id: "b131", build: 131, date: "23 Nov 2026", title: "The Dragonstone is back", items: [
      "Fixed: the Dragonstone was missing from Bleak Falls Barrow if you picked up the Golden Claw at the door on the way in, so you couldn't finish Farengar's quest. The boss now always leaves it until you've handed it in.",
      "If you already cleared the barrow without it, you'll find the Dragonstone in your pack next time you open the game. Bring it to Farengar in Dragonsreach.",
    ] },
    { id: "b130", build: 130, date: "23 Nov 2026", title: "Smaller updates", items: [
      "Updates now download only the files that changed instead of the whole game: usually a megabyte or two instead of almost 100.",
      "To get this, install the newest app from the download page one more time. After that, every update is a small patch.",
      "If a patch ever doesn't fit your copy of the game, it quietly downloads the full game instead, like before.",
    ] },
    { id: "b129", build: 129, date: "23 Nov 2026", title: "Blood, finishing blows and a fight camera", items: [
      "Fights bleed now. Blades and arrows draw blood, skeletons shed bone chips, dwarven machines leak oil and sparks, and the dead leave a pool behind.",
      "Finishing blows: kill someone with a blade and you might take their head clean off, always on a critical, power or sneak attack.",
      "Every death is different: fire burns a foe to ash, frost freezes it solid until it shatters, lightning leaves it twitching and scorched, a hammer or a Shout sends it flying.",
      "Enchanted weapons glow in their own colour (fire orange, frost blue, shock violet, drain red...) and leave a coloured trail when you swing.",
      "The camera moves with the fight: it leans in as you swing, follows the blow, punches in on criticals and holds on the killing blow.",
      "New sounds for wet hits, heavy criticals, fire, frost, lightning and shattering ice.",
      "New Two-Handed perk, Headsman: more damage to a foe that's nearly finished.",
      "Don't like the blood? Settings → Fights → Blood: Off.",
    ] },
    { id: "b128", build: 128, date: "23 Nov 2026", title: "Hunting", items: [
      "New 🏹 button on the map: turn hunting on and you travel a little slower, but you run into deer, elk, mountain goats (and horkers by the sea) far more often. Every one is a fight you play.",
      "Sometimes something else is hunting too: wolves, bears and sabre cats turn up now and then.",
      "Game gives venison or horker meat and hides you can tan into leather. Predators still give their pelts.",
      "New Archery perk, Hunter's Eye: you find game half again as often, hit animals harder, and get an extra piece of meat at rank 2.",
    ] },
    { id: "b127", build: 127, date: "23 Nov 2026", title: "Mining game", items: [
      "Mining is a mini-game now: a wall of rock with ore hidden in it. Tap a stone while the needle on the strike meter is in the bright band. Perfect blows hit hardest and can split ore into two pieces.",
      "Glinting stones hold ore. The better your Smithing, the more veins you spot and the more swings you get. Blank rock breaks in one hit, but wastes the swing.",
      "Stop any time with Done and keep what you dug. Quick dig skips the game and gives the same ore as before. You can turn the game off with the tick box.",
      "New Smithing perk, Prospector: you spot every vein, gems turn up more often, and you get 2 more swings.",
    ] },
    { id: "b126", build: 126, date: "23 Nov 2026", title: "Horse breeds and stable upgrades", items: [
      "Stables now sell four breeds: the all-round Cyrodilic bay, the big Nord draft (carries most, takes hits), the fast Hammerfell courser (carries little) and the cheap, sturdy Highland pony.",
      "Every horse comes out a little different: its speed, carrying and health can be up to 5% better or worse than its breed's. The stables card shows your horse's numbers.",
      "New stable upgrades: saddlebags (carry 50, 100 or 150 more) and horseshoes (iron, steel or elven, ride 5%, 10% or 15% faster). Horse armor is still there too.",
      "New Speech perk, Horse Trader: horses and stable work cost 10%/20% less, and the horses you buy roll better.",
      "Horses you already own keep going as Cyrodilic bays with their old numbers.",
      "Dual wielding was winning a bit too often: the left-hand follow-up now hits a little softer.",
    ] },
    { id: "b125", build: 125, date: "23 Nov 2026", title: "Traders sell the basics", items: [
      "Town shops, caravans and roadside traders now only sell basic gear: iron, steel, hide, leather, chainmail and the like. Elven, dwarven, glass, ebony and better come from dungeons, bosses, quests and your own forge.",
      "Enchanted gear is still on sale, but only with weak enchantments. Staffs on sale cast novice and apprentice spells only.",
      "Jewellery traders sell plain silver and gold rings and necklaces. Gem-set pieces you make at a forge or find.",
    ] },
    { id: "b124", build: 124, date: "23 Nov 2026", title: "Guards on patrol", items: [
      "Hold guards now walk the roads: a patrol leaves every hold's capital for a nearby village or fort and comes back. You see them on the map near places you've found, in their hold's colours, and everyone sees them in the same spot.",
      "Guards are always your level, so a fight with one is never a pushover.",
      "Fighting guards teaches you nothing and they drop no gold or gear. All you get is a bigger bounty.",
      "New Blocking perk Watch Drills: guards hit you softer and you hit them harder.",
    ] },
    { id: "b123", build: 123, date: "23 Nov 2026", title: "Two blades", items: [
      "You can now fight with a one-handed weapon in each hand. Open a sword, axe, mace or dagger and tap \"Left hand\".",
      "Every attack follows up with a quick left-hand hit, and power attacks swing both blades. Power attacks cost more stamina though.",
      "A left-hand weapon replaces your shield, so you lose its armour and shield bash. Two-handed weapons, bows and staffs need both hands.",
      "New One-Handed perk Twin Blades: harder left-hand hits and cheaper dual power attacks.",
      "Your hero holds the second blade in the fight scene.",
    ] },
    { id: "b122", build: 122, date: "23 Nov 2026", title: "Foes fight back properly", items: [
      "Foes now use everything they come with, not just a plain swing.",
      "Warriors bash you with their shields (you lose stamina and 1 action point) and raise them to block. Brutes wind up huge blows and roar war cries. Archers take aim for a big shot and fire poison arrows.",
      "Mages throw fire, frost or lightning bolts (burning you, draining stamina or magicka), raise wards against your spells and heal themselves. Rogues use poisoned blades and slip into the shadows.",
      "Wolves pounce and howl, bears and trolls maul (you bleed), trolls regenerate, spiders spit venom, draugr shout you back and breathe frost, necromancers drain your life. Many humanoids carry a healing potion or two.",
      "You see slow moves coming: a ⚠ or 🎯 on the foe means a big blow lands next turn. Guard, or hit hard enough to break it.",
      "Chips on the foe show a raised shield, a ward, shadows or rage. Hold a finger on the foe to see everything it can do.",
    ] },
    { id: "b121", build: 121, date: "23 Nov 2026", title: "Wards hold", items: [
      "Ward spells are now a real magic shield. It stays up turn after turn, soaking spells, dragon breath and any magic a foe throws, until it breaks.",
      "Cast the ward again to fill it back up. A weaker ward never shrinks a stronger one.",
      "A blue shield bar under your health shows how much of the ward is left. Plain sword and arrow blows go past it.",
      "New Restoration perk, Ward Mender: wards are 25% stronger and mend a little at the start of each turn.",
    ] },
    { id: "b120", build: 120, date: "23 Nov 2026", title: "Every fight is yours", items: [
      "No more fights that play themselves. Even small scuffles on the road (a wolf, a skeever) now stop your trip so you fight them turn by turn.",
      "Tactics is gone from the Character menu, since you play every fight yourself.",
      "In a party, if someone takes too long on their turn, they keep their guard up instead of the game fighting for them.",
    ] },
    { id: "b119", build: 119, date: "23 Nov 2026", title: "Fits every screen, part 1", items: [
      "Phone held sideways: the compass spreads out so Magic and Items no longer sit on top of it.",
      "Small phones: the Items / Magic / Skills names at the top of the menus no longer run into each other.",
      "Slightly bigger small labels under the top buttons and bottom tabs, and bigger spell-level buttons in Magic, so they're easier to read and tap.",
      "Fixed a rare hiccup when a menu opened before the game screen was ready.",
    ] },
    { id: "b118", build: 118, date: "23 Nov 2026", title: "The combat wheel", items: [
      "Your moves in a fight now sit in a wheel around End turn. Each one shows what it costs: action points, and the stamina or magicka it takes.",
      "Strikes and attack spells now have a timing ring: a needle sweeps round, tap when it's in the bright zone. Right in the middle is Perfect (25% more damage), anywhere in the zone is Good, and a miss (or no tap) does 20% less.",
      "The better your skill with that weapon or school of magic, the wider the zone. Duelist, Brute Force, Steady Hand and Disintegrate make it wider still.",
      "What you spend floats up from your frame (−3 AP, −58 SP, −40 MP), and a Perfect hit lights up the fight.",
      "Fast mode and Auto skip the timing ring. Prefer the old cards? Tap 🎯 at the top of the fight screen.",
    ] },
    { id: "b117", build: 117, date: "23 Nov 2026", title: "Dragons take to the sky", items: [
      "Dragons come in kinds now: Dragon, Frost Dragon, Blood Dragon, Elder, Ancient, Revered and Legendary. Each breathes fire or frost, has its own colour and gets tougher the higher up the list it is. The strongest only show up at high levels.",
      "A dragon starts the fight in the air. Its fire or frost breath rains down, it dives at you with its claws, and sometimes it climbs out of reach for a moment. While it flies, sword and axe blows only graze it and some arrows miss their mark; spells and shouts hit fully.",
      "Once it's badly hurt (or you hit it with Dragonrend) it crashes down and fights on the ground: bites, tail swipes that hit hard, wing buffets that knock the stamina out of you, and short blasts of breath. On the ground every blow lands.",
      "Dragon attacks on towns: the dragon circles for 5 minutes first. Get to the town before the timer runs out and you fight it together with everyone who's there. It dives at you as soon as the timer ends.",
      "The attacking dragon gets tougher for every hero who comes, and tougher for stronger heroes, so it's a fair fight alone, with a few friends or with a crowd. There's no limit on how many can join. If it goes badly, Flee works much better in a town: there's plenty of places to hide.",
      "A dragon that only flew off no longer gives you its soul. You get it when it dies.",
      "Perks: Eagle Eye keeps your arrows on a flying dragon (full damage). Critical Charge and Great Critical Charge let you leap at it, so your blows lose much less while it flies.",
    ] },
    { id: "b116", build: 116, date: "23 Nov 2026", title: "Foes come in kinds and numbers", items: [
      "Bandits, Forsworn, draugr, skeletons, vampires and Falmer now come as warriors (sword and shield, harder to hurt), brutes (big two-handers, hit harder), archers, mages or rogues (quick daggers, easier to drop). You can see it on them in the fight: what they wear and carry, and how they attack.",
      "The foe's box in a fight shows what kind it is.",
      "On your own you'll sometimes face two of them, and at higher levels now and then three, one after another. Each is a bit weaker than a lone foe, so the whole group is only a little tougher. Bosses and named foes still come alone.",
    ] },
    { id: "b115", build: 115, date: "23 Nov 2026", title: "Fighting other players", items: [
      "When you fight another player, they now stand across from you as themselves: their race, armour, helmet, weapon and shield. Same in Arena duels.",
      "Another player fights with their real health in the fight screen, not the extra health monsters get.",
      "Dying to another player is different now: only what you were wearing and holding drops (plus 1% of your gold). You keep the rest of your gold and your backpack, and wake up without your gear.",
      "After a player kills you, choose which temple you wake up in: any city or town you've found.",
    ] },
    { id: "b114", build: 114, date: "23 Nov 2026", title: "Respec", items: [
      "New on the Character screen: Respec. For 10,000 gold every perk you took and every Health, Magicka or Stamina choice goes back to the pool, so you can build your hero again. Your skills and level stay. It asks once more before it takes the gold.",
    ] },
    { id: "b113", build: 113, date: "23 Nov 2026", title: "New fight screen", items: [
      "Fights got a full makeover: a bigger battle scene, health bars that leave a fading trail when you get hit, the screen shakes and flashes red on big hits, and a banner when your turn starts or the fight ends.",
      "Drag to fight: drag an action card from the bottom onto the foe to attack, or onto yourself for Shield up, potions and healing. The target lights up, let go to use it. Tapping still works too.",
      "Everything you press now sits at the bottom of the screen, so you can fight one-handed with your thumb.",
      "The fight log is easier to read: damage numbers stand out, crits and heals get their own colour. Tap it (or the scroll button) to see the whole fight round by round.",
      "On a PC: keys 1-9 use the action cards, L opens the log.",
      "Damage numbers pop up over whoever got hit, coloured by kind: white for weapons, orange fire, blue frost, purple shock, green poison, green + for heals, big gold for crits. Magicka and stamina you spend pop up too.",
      "Health bars now flash, crack and break off a chunk when hit, then the lost part drains away. Magicka and stamina bars show their numbers.",
      "Tooltips: hold your finger on any action, health bar, turn-order name or status icon to see what it does (hover with the mouse on a PC). Holding never presses the button.",
      "Shields reworked: carrying a shield gives you a chance to block blows by itself. Shield up is replaced by Shield bash: big stamina cost, small damage, and the foe loses its next turn. A foe can't be stunned again for 2 rounds, and bosses and dragons sometimes shake it off. Power Bash and Deadly Bash perks now boost the bash.",
      "Party frames: every teammate (players and followers) gets their own health bar with numbers. Drag a healing spell, scroll or health potion onto a teammate to use it on them, and support spells (Healing Hands, Stoneskin Touch...) go to whoever you drop them on.",
    ] },
    { id: "b112", build: 112, date: "23 Nov 2026", title: "Updates on launch", items: [
      "When you open the game it now looks for a new version straight away and installs it before you start playing (a short \"Updating…\" card). No more starting a session on an old version.",
    ] },
    { id: "b110", build: 110, date: "22 Nov 2026", title: "Fix: players not seeing each other", items: [
      "Fixed friends and other players not showing up for some of you. Phones on mobile data or strict Wi-Fi often couldn't link up directly, so they never saw each other.",
      "Now there's a backup line: if your phone can't link straight to someone, your name, where you are, chat and messages still get through, encrypted, over the same servers used to find each other.",
      "Players show up within a few seconds of opening the game.",
    ] },
    { id: "b109", build: 109, date: "22 Nov 2026", title: "Sneak mode and fog of war", items: [
      "New eye button on the map: sneak while you travel. You walk slower, but fewer bandits and beasts find you, fights start with you hidden more often, and you train Sneak as you go.",
      "Fog of war for heroes: you only see other players near you on the map (your party always). A sneaking hero can only be spotted from much closer, and the better their Sneak, the closer you have to be.",
      "The map shows two rings around you: how far you can see, and (while sneaking) how close someone must be to spot you.",
      "New Sneak perks: Silent Roads (sneak faster, harder to spot) and Shadow Paths (even fewer road fights while sneaking).",
    ] },
    { id: "b108", build: 108, date: "22 Nov 2026", title: "Painted shops", items: [
      "The general store, blacksmith, inn and alchemist now have painted pictures at the top of their page. More shops get theirs soon.",
    ] },
    { id: "b107", build: 107, date: "22 Nov 2026", title: "Pickpocketing mini-game, summons fixed, auto updates", items: [
      "Pickpocketing is now a mini-game: your hand sways over the mark's belt, tap Lift while it's over the purse, twice (in, then out). Miss, or take too long while they get suspicious, and you're caught.",
      "Steady hands do better than the old dice roll. Mini-games are part of the game now: the Quick roll button and the off switch are gone, for lockpicking too.",
      "Works on townsfolk (Area → Streets) and on other players.",
      "Updates now install by themselves: once a new version is downloaded, the game saves and restarts on it at the next quiet moment, never mid-fight, in a dungeon, a trade or a menu. It checks every 10 minutes and whenever you come back to the app.",
      "Summons show up in the fight scene for as long as they last, not just on the turn you cast them.",
      "Summon spells now bring the right creature: Flaming Familiar, Spectral Archer, Seeker and Dremora Lord no longer all say \"spectral wolf\".",
    ] },
    { id: "b106", build: 106, date: "22 Nov 2026", title: "Big screens", items: [
      "On a PC the game scales up on big monitors (1440p, 4K) and spreads out on wide and ultrawide screens: a bigger map, wider menus, the tab bar kept in the middle.",
    ] },
    { id: "b105", build: 105, date: "22 Nov 2026", title: "Shop tabs, loot list, new names", items: [
      "Shops and player trades have SkyUI-style tabs (Weapons, Apparel, Potions and so on) for both buying and selling.",
      "Loot after a fight shows as a list with item pictures, weight and value.",
      "Change your name any time in Settings → Your character.",
      "You can only pickpocket the same player once every 10 minutes.",
    ] },
    { id: "b104", build: 104, date: "22 Nov 2026", title: "Party fights together, no free healing, hotkeys", items: [
      "The Town tab is now called Area (shortcut A on a PC).",
      "Party fights: everyone in the fight now sees it live on their own screen (the foe's health, the team, what's happening) and picks their move there when their turn comes.",
      "A party meets more foes: one foe per hero (up to 6), one after another, instead of one big foe with extra health. Bosses still come alone.",
      "Health no longer comes back by itself. Heal with potions, cooked food, healing spells, a bed at an inn or at home, or a healing effect while it lasts.",
      "Your marker on the map shows a little arrow pointing the way you're going.",
      "Keyboard shortcuts on PC: C Character, I Items, P Magic, M Map, J Journal, O Social, A Area, and Tab for the compass menu. The letters show on the tabs.",
    ] },
    { id: "b103", build: 103, date: "22 Nov 2026", title: "Draggable compass, no more Auto fights, quieter sound", items: [
      "The gold compass menu now follows your finger or mouse as you drag it. It tilts toward where you pull, lights up the direction you're heading, gives a little click, and springs back when you let go.",
      "Music, sound effects and background sounds now start at 10% volume for everyone. Turn them up any time in Settings.",
      "Items you have equipped now show a gold diamond and a soft glow in the item list, so you can see at a glance what you're wearing.",
      "Fights are always played by you now, turn by turn. The Auto buttons and the Instant fights setting are gone. In a party, if someone takes too long, their turn is still played for them so the fight keeps going.",
    ] },
    { id: "b102", build: 102, date: "22 Nov 2026", title: "Quiet main menu", items: [
      "The main menu plays only its music now. The howling wind and other background noise there are gone.",
    ] },
    { id: "b101", build: 101, date: "22 Nov 2026", title: "PC version updates itself", items: [
      "The PC version (installed with the setup file) now keeps itself up to date: it grabs new versions in the background and installs them when you close the game, or right away if you pick Restart now.",
      "Install this version once by hand; after that, updates come by themselves. The portable PC file still needs a fresh download for each update.",
    ] },
    { id: "b100", build: 100, date: "22 Nov 2026", title: "A real soundtrack", items: [
      "New music! 16 full pieces replace the old beeping tunes: the main menu, the open road, towns, snowy weather, dungeons, fights and boss fights each have their own.",
      "When one piece ends, another of the same kind starts, so it doesn't loop the same song forever. The music slider and mute in Settings work as before.",
      "The app download is bigger now because the music is inside it, so it plays offline too.",
    ] },
    { id: "b99", build: 99, date: "22 Nov 2026", title: "Stories in Polish too", items: [
      "Quests, road events, dungeons, rumours, town talk, guard chatter, books and tips are now in Polish when the game is set to Polski. About 1,800 lines translated.",
      "Names of places and people stay as they are. A few help boxes and item names are still in English; more coming.",
    ] },
    { id: "b98", build: 98, date: "22 Nov 2026", title: "Gra po polsku! (Polish)", items: [
      "The game now speaks Polish: menus, buttons, tabs, skills, stats and settings. Polish phones and PCs switch to it by themselves.",
      "Change it any time in Settings → Language (Automatic, English, Polski). Stories and quests are still in English for now; they come next.",
    ] },
    { id: "b97", build: 97, date: "22 Nov 2026", title: "PC version, no more stuck fights, real nicknames", items: [
      "Roads of the North now runs on Windows PCs too! Get it from the same download page as the phone app. Same game, same friends.",
      "On a PC (or with a keyboard), Esc works like the phone's Back button: it closes menus one at a time and never quits the game. F11 switches full screen on the PC app.",
      "Every hero needs a nickname now. You can't start with a blank name or as \"Dovahkiin\". If your hero is still called Dovahkiin, the game asks you to pick a nickname before you play.",
      "Fixed: winning a road fight (like the vampire at night) could leave the road \"blocked\" by a dead foe, so you couldn't move on. Wins now clear the road, and anyone already stuck is freed when the game opens (or when you tap Face it).",
      "Fixed: the same bug inside dungeons. After a won fight the room stayed shut with a dead foe and you couldn't go on. Fixed, and stuck players are freed when the game opens.",
      "Bleak Falls Barrow: if you reach the claw door without the Golden Claw (sold it, lost it, never picked it up), a dead thief by the door has it. You take it, and it tells you the three animals in order.",
      "Pillar puzzles in barrows now show their clue right inside the puzzle, instead of hiding it behind the puzzle window.",
      "The round star and compass buttons fade away while you scroll, so they no longer sit on top of cards and buttons.",
      "Pages now end with enough room that nothing at the bottom stays stuck under those round buttons.",
    ] },
    { id: "b96", build: 96, date: "22 Nov 2026", title: "Bug hunt", items: [
      "At the biggest text size, the Items / Magic / Skills names at the top of the item menu no longer pile on top of each other.",
      "World events no longer pop up over a brand-new character. Below level 3 they just go in your Journal.",
      "When two world events start at once you get one pop-up, not two stacked on top of each other. Both are still in your Journal.",
      "First-time tips no longer cover the category buttons in the item and spell menus. They sit lower while a menu is open.",
    ] },
    { id: "b95", build: 95, date: "22 Nov 2026", title: "Tidier pack and safer selling", items: [
      "Mark anything Keep (🔒) from its item card. Kept things and your favourites are never sold in bulk.",
      "Sell all junk: at a shop, one button sells cheap trinkets and loose gear that's worse than what you wear. You see the list and the total first. Kept, favourite, quest, unique, enchanted and handmade things never count as junk.",
      "Green ▲ and red ▼ arrows on gear show if it's better or worse than what you're wearing: in the pack, the Items menu, shops and market stalls.",
      "New sort buttons in the Items menu: by name, value, weight, value per weight or newest first.",
      "You can now drop things from your pack.",
      "A warning before you buy or take something that makes you too heavy, with quick buttons to sell or drop something instead.",
      "The game asks first before you sell, break at the enchanter, or drop something valuable (500+ gold), one of a kind, enchanted or marked Keep.",
      "Buy back: undo your last sale at the price you got, while you're still in that town and within an in-game hour."] },
    { id: "b94", build: 94, date: "22 Nov 2026", title: "Crafting shortcuts", items: [
      "New \"Can make now\" switch at the forge, smelter and tanning rack, improve bench, alchemy lab, cooking pot, enchanter and homestead workbench. Each recipe says how many you can make, or what you're missing (\"Missing: 2 Iron Ingot\").",
      "×5 and Max buttons: one confirm, then one summary of what you made and what it used. You use the same materials and gain the same skill as making them one at a time.",
      "Batches skip the crafting mini-games and give the plain result. A single Make still plays the mini-game.",
      "Tap the ☆ to pin favourite recipes, alchemy mixes and enchantments to the top.",
      "The forge's recipe groups show how many you can make in each.",
      "The old smelt \"All\" and workbench \"×5\" now give the same skill as making them one at a time.",
      "Fix: alchemy and enchanting mini-game bonuses (and botches) now actually count."] },
    { id: "b93", build: 93, date: "22 Nov 2026", title: "Quicker trips and fights", items: [
      "Recent trips: the travel screen shows the places you went to lately as one-tap buttons, plus \"Again\" to repeat your last trip or \"Back to\" to head home where you came from.",
      "New setting (Settings → Fights → After road events): pick \"Carry on\" and the result card after a road event or road fight closes by itself after a few seconds, so you keep walking. Touch the card to stop it.",
      "Fight replays now have ×1, ×2 and ×4 speed (tap the speed button, or pick it in Settings) and a Skip to result button. Tap anywhere on the fight screen or the result card to finish the animation that's playing. With Reduce motion on, replays start at ×2.",
      "Too much loot? If a won fight leaves you too heavy, you can keep it all or leave the heaviest new pieces by the road.",
      "Fight again: one tap to rerun a test fight against the practice dummy (Tactics), and Challenge again after an Arena bout.",
      "The game remembers your last Arena bet and your last test-fight foe. Riding or walking beside your horse was already remembered."] },
    { id: "b92", build: 92, date: "22 Nov 2026", title: "A clearer first hour", items: [
      "“What to do next” on the Travel tab now suggests up to three ideas that fit where you are: road fights near Whiterun while you're new, your first dungeon, the main quest, a horse once you can afford one, teaming up with others, and later rumours, world events and building a homestead. Tap ✕ to hide one, or turn them off in ⚙ Settings → Help & tips. They stop once you reach level 15.",
      "First-time tips: a small card pops up the first time you're too heavy, level up, enter a dungeon, play a turn-by-turn fight (it explains initiative and action points), get a party invite or hear a rumour. One at a time, they never get in the way, and “Don't show tips” switches them off.",
      "New characters get a welcome tip pointing at the “Your first trip” card, which was easy to miss under the map.",
      "The tutorial, the guide and the road encounter sheet now explain turn-by-turn fights (and Auto) instead of saying fights play out by themselves. In a party, the tutorial tells members that the leader picks where to go.",
    ] },
    { id: "b91", build: 91, date: "22 Nov 2026", title: "Tidier menus", items: [
      "The bar along the bottom now has seven tabs, like Skyrim: Character, Items, Magic, Map, Journal, Social and Town. Tabs with more than one page show a row of sub-tabs along the top; slide it sideways to see them all.",
      "Character holds everything about you: Skills (the star skies), Character (your sheet, powers, shouts and follower), Perks, Tactics, Stats, Achievements, Library, Diary and Settings.",
      "Tactics used to have its own tab. It's now under Character → Tactics.",
      "Settings (sound, Accessibility, Fights, Art style and the rest), the guide, patch notes and Main menu are under Character → Settings. The ⚙ Menu button at the top still opens them too.",
      "Achievements and the Library (your discoveries and lore books) each have their own page under Character now, instead of sitting at the bottom of other pages.",
      "Items and Magic open the item and spell menus straight away. The bottom bar stays visible over them, so you can jump to another tab in one tap. A new List button in the item menu shows your pack as a plain list (sell, recharge, eat and so on).",
      "Map has three pages: Travel, Locations (places you've cleared) and World news. World news is the new home of “Word around Skyrim” (rumours and your good name in each hold), world events and festivals, which used to be in the Journal.",
      "The Journal is now just your quests: Active, Misc and Completed.",
      "Friends is now called Social and lives in the bottom bar, with a dot when something's waiting for you. Inside: Friends, Messages, Trades, Party, Chat and Realm (holds, clans and the leaderboard). The separate Friends button at the top is gone.",
      "Town is unchanged: shops, the inn, trainers, your home and homesteads, guilds and jobs.",
      "The compass menu now has a Search button in its row of shortcuts too.",
      "Fixed: after using the compass, opening Items or Magic from the bottom bar and closing it no longer pops the compass back up.",
      "The bottom bar fits on small phones even at the Biggest text size and with one-hand mode on."] },
    { id: "b90", build: 90, date: "22 Nov 2026", title: "Search everything", items: [
      "New 🔍 Search button in the top bar: one box that finds your gear, every item in the game, spells, shouts you know, perks, skills, places you know, your quests, followers, recipes and settings.",
      "Typos are fine: “steal swrod”, “fierball” or “restor helth” still find what you meant. Results come in groups with their pictures, and your last searches are kept for a quick tap.",
      "Tap a result to go straight there: your item opens in the pack, a perk opens its star in the skill's constellation, a place opens on the map with a Travel button, a quest opens in the Journal, a setting lights up its row.",
      "Things you don't have yet get a small card: what an item does and where to get it, a spell's numbers and which shops you know sell its tome right now, what a forge or cooking recipe takes (and how much you have), which ingredients you know make a potion, and where a follower waits to be hired.",
      "Places you haven't found never show their names. If you type one, search only tells you something by that name is still out there.",
    ] },
    { id: "b89", build: 89, date: "22 Nov 2026", title: "Never miss what's ready", items: [
      "A new Today card in the Travel tab lists everything that's ready or running out of time: your house gardens, homestead goods, bounty board and festival rewards, world event rewards, a caravan you signed on with, courier trades from friends, your horse resting at the stables, rumour leads before they go cold, cleared places filling up again, a hall coffer running low, level-ups and perk points.",
      "Each line has a Go button that takes you straight to the right screen, or picks the place on the map when you need to travel there first.",
      "Small number badges on the Hero, Town, Journal and Travel tabs, the Friends button and the compass show how many things are waiting there.",
      "Phone reminders while the game is closed: when your garden or homestead goods are ready, your caravan leaves in 10 minutes, a courier arrives, your horse is rested or a world event starts. Turn each kind on or off in Settings → Phone → Reminders. Never more than 4 a day."] },
    { id: "b88", build: 88, date: "22 Nov 2026", title: "Accessibility options", items: [
      "New in Settings → Accessibility: Text size with four steps (Normal, Big, Bigger, Biggest). Everything grows together, buttons included, so nothing gets cut off.",
      "Colour-blind help for red, green or blue colour-blindness: health, magicka and stamina bars, danger levels, buffs and debuffs, item quality colours, enemy health bars in fights and danger marks on the map switch to colours that stay easy to tell apart.",
      "High-contrast text: brighter grey text, solid dark panels and firmer outlines.",
      "Reduce motion: no screen shake, hit flashes, drifting or sliding effects. It follows your phone's setting by default, and you can switch it on or off yourself.",
      "One-hand mode: the Menu, Friends, map zoom, favourites and compass buttons gather at the bottom of the screen, on the left or right side, where your thumb can reach them.",
      "All of it is saved on your phone like your other settings and works with both art styles."] },
    { id: "b87", build: 87, date: "22 Nov 2026", title: "World events for everyone", items: [
      "World events: the same events run for every player at the same time, on a fixed schedule. A banner and a Journal line tell you when one starts, a strip under the map shows how the North is doing, and the Journal's Misc tab lists what's coming next.",
      "Daedric invasion (about 3 times a day, 2 hours each): three Oblivion gates open in one hold. Travel to a gate and fight the Daedra (scamps, atronachs, dremora) to weaken it. Everyone's wins count, and more fighters means a sturdier gate. Each gate you helped close pays 150 gold. Close all three for a Sigil Stone (a huge reusable soul for enchanting) and the title Gatecloser.",
      "Dragon migration (one day in every four): a flight of dragons circles a hold. Hunt them anywhere in that hold, once every 15 minutes, up to 5 each. Every dragon gives an extra soul and a dragon bone. Bring down enough together for 400 gold, dragon scales and the title Dragonwatcher. Under level 22 you meet the young ones.",
      "Festival week (one week in four, starting Monday): Heart's Day, the Merchants' Festival, Harvest's End or Second Planting. Three skill contests a day in any town; win or lose you earn points. Reach the goal for 300 gold, a festival gift and the title Festival Favourite, plus 150 gold more if the whole North cheers enough.",
      "The Khajiit grand caravan camps outside a different town every 6 hours with five rare wares you won't find in shops. One of each per visit. Buy five things over time to be called Friend of the Caravan.",
      "On the map: burning gates with progress bars, dragons circling their hold, festival lanterns over the cities and the Khajiit wagon.",
      "Three new perks: Gate Breaker (Conjuration 40: hit Daedra harder, take less from them, gate wins count more), Sky Hunter (Archery 50: arrows hit dragons harder, an extra dragon bone per migrating dragon) and Caravan Friend (Speech 40: cheaper caravan prices and one more ware). All your old perks stay."] },
    { id: "b86", build: 86, date: "22 Nov 2026", title: "A living world: rumours, your good name and town hours", items: [
      "Rumours that come true: ask the innkeeper \"What's the word?\" for the price of a drink, or chat with the locals in the Streets for free. You'll hear about bandits with a named leader, a lost shipment, strange lights over a barrow, someone gone missing or a big beast taking sheep. Each puts a glowing ? on your map for about a day and a half of game time. Go there and see: most are real (a named foe, extra loot, a rescue with a reward), some are just tavern talk, and street gossip is wrong more often. Up to 3 leads at once.",
      "Towns know what you did: guards and shopkeepers mention the dragons you killed, places you cleared, quest lines you finished, your guild rank, rumours you saw through and your crimes.",
      "Your name in the holds: each hold rates you from Trouble to Stranger, Familiar face, Friend of the hold and Hero. Friends get 3% off in that hold's shops, heroes 6%. A bounty drags your name down and ends the discount. See it in the Journal under Misc (Word around Skyrim), with your current leads.",
      "Day and night in towns: a line tells you what the town is up to, and the inn has a little crowd picture that fills up in the evening (quiet in the morning, packed at night with the bard playing).",
      "Shops still close at night, but you can knock anyway: they'll let you in and serve you until 08:00 for about 15% more (and 10% less for what you sell). Heroes of the hold pay half that.",
      "Three new perks: Good Ear (Speechcraft: rumours are wrong half as often and last longer), Local Hero (Etiquette: your name spreads faster and hero discounts are doubled) and Night Owl (Streetwise: no extra charge when you knock at night)."] },
    { id: "b85", build: 85, date: "22 Nov 2026", title: "Build your own homestead", items: [
      "Three plots of land to buy and build on: Pinewatch Hollow by the lake near Falkreath, Fenhollow Rise in the marsh near Morthal and Frostcairn Rest on the coast near Dawnstar. Buy the deed (5000 gold) under Your home in that town.",
      "Build in stages: a small house first, then a main hall, then three wings of your choice: armory, library, greenhouse, kitchen, trophy room, enchanter's tower, alchemy tower or storage room. Building uses up the materials, and a wing can't be torn down.",
      "Get materials at the plot: saw logs at the sawmill, dig stone (and sometimes quartz) at the quarry with a pickaxe, and dig clay. Each can be worked once per in-game hour. At the workbench, turn iron ingots into nails, hinges, locks and fittings, and firewood plus quartz into glass.",
      "Wings make something every in-game day: steel arrows, a study session for one of your skills, ingredients, meals, gold from your trophies, soul gems or potions. The storage room is a 30-slot chest you never lose, and it lets goods pile up longer.",
      "Sleep in your own bed for full health and Well Rested. Each plot has its own steward to hire (500 gold): they look after the place so goods pile up longer, deliver logs, stone, clay and quartz for gold, or come along and fight with you.",
      "Every plot gets its own picture that changes as you build, in both art styles.",
      "New perks: Carpenter (Smithing, building takes fewer materials), Woodsman (Athletics, more logs, stone and clay), Landed Thane (Etiquette, cheaper deeds and stewards) and Estate Income (Mercantile, gold from each wing every day)."] },
    { id: "b84f", build: 84, date: "22 Nov 2026", title: "Small fixes", items: [
      "Trying to buy a spell tome that's too advanced for you now tells you which skill level you need, even when no shop here has it this week."] },
    { id: "b84", build: 83, date: "22 Nov 2026", title: "Turn-by-turn fights", items: [
      "Fights are now played turn by turn. Everyone rolls for who goes first each round: Acrobatics and Sneak make you quicker, heavy armor slows you down.",
      "On your turn you spend action points (the gold dots): a dagger swing costs less than a greatsword, power attacks and stronger spells cost more. Athletics and Stamina give you more points; Alteration and Magicka give extra points just for spells. Points you don't use keep your guard up.",
      "Attack, power attack, guard, cast from your Magic list, drink potions, read scrolls, shout or try to run. Tap Auto to let your Smart AI (with your AI settings) play one turn, or Auto ⏩ for the rest of the fight.",
      "Followers and summons take their own turns. In a party, each player picks their own move on their own phone (60 seconds, then Auto), and foes get tougher the more of you there are. Someone who misses two turns in a row is played by Auto.",
      "Fights last longer and no single blow can take more than 40% of a strong foe's health (or yours). Small fry like skeevers can still go down in one hit.",
      "New perks: Battle Rhythm (Athletics, more action points), Quick Start (Acrobatics) and First Move (Sneak) to act sooner, Quickened Casting (Alteration, a spell point) and Drilled in Steel (Heavy Armor, heavy armor slows you half as much).",
      "Works for road encounters, dungeon rooms, quests and guild jobs, dragon raids, resisting arrest and attacking other players. The live fight scene plays each turn in both art styles.",
      "The world waits while you fight. If you close the game mid-fight, you come back just before the fight started.",
      "The Athletics and Acrobatics skill pages now show your action points and initiative.",
      "Prefer the old way? Menu → Settings → Fights → Instant (auto). There's also a Fast setting (or the ⏩ button in a fight) that shows foe turns quicker."] },
    { id: "b82", build: 82, date: "22 Nov 2026", title: "Your AI, your way (and fairer sneak attacks)", items: [
      "Sneak attacks make sense now: heavy armor clanks, daylight gives you away, nights, fog and rain help, and the undead and dragons are hard to fool. The odds show on the encounter card. A sneak blow can't drop a strong foe in one hit any more (weak ones still go down). New Sneak perk: Ambusher.",
      "Smart AI settings on the Tactics tab: pick a style (Careful, Balanced, Aggressive), lean on melee, bow or magic, switch off schools or single spells, choose when to drink potions, shout, sneak up and heal, and how much magicka to keep back.",
      "Spread practice: switch it on and in easy fights the AI rotates your weapon, blocking and every school you know, so all your skills level up, not just your best one. Dangerous fights it still plays to win.",
      "Better tactics: rules can join conditions with AND / OR and NOT, 13 new conditions (enemy weak to fire, burning, staggered, a caster, bad weather and more), a Run away move for road fights (you skip the loot but keep going), and drag a rule's number to reorder.",
      "Hybrid mode: your rules go first, Smart AI fills the gaps. New presets built from your own spells and gear (Warrior, Archer, Battlemage, Healer, Necromancer, Mage, Thief, Skill trainer), share codes to swap tactics with friends, and Run 20 fights to see your win rate before you head out."] },
    { id: "b81", build: 81, date: "22 Nov 2026", title: "Gear you can see", items: [
      "Every armour set and weapon material now looks like itself: hide and fur with shaggy trim, studded leather with rivets, elven gold, see-through glass and stalhrim, chitin plates, dragonscale and bone, Forsworn feathers, guild hoods and more. It shows on your character, in fights and on the road while you travel.",
      "Other players see your real gear too, on the map and when you fight side by side.",
      "Gear preview: tap any armour or weapon and see yourself now next to yourself wearing it.",
      "Characters breathe and shift when standing still and walk properly on the road."] },
    { id: "b79", build: 80, date: "22 Nov 2026", title: "Party play, loot rolls and grown-up followers", items: [
      "The map now follows the real game's layout much more closely: towns, roads and landmarks sit where you remember them.",
      "Parties of up to 8: the leader picks where to go, everyone gets a Ready check first, then the party travels together. If the leader stops for something on the road, the others wait and fight beside them. Gold found on the road is split evenly.",
      "Dungeons with your party: only the leader picks rooms and actions, the rest follow along. Everything found goes into one loot pile, and at the end everyone taps Want or Pass on each item. If more than one of you wants something, you all roll a d100 and the highest wins (ties roll again). Gold is split evenly. Dungeons get longer and busier with a bigger party.",
      "New Lockpicking perk, Lucky Draw: +5/+10 on your loot rolls.",
      "Followers grew up: they carry their own gear (which decides how hard they hit and how much they shrug off), level up from fights, and pick their own perks based on their style (Lydia sword and shield, Jenassa bow, Marcurio fire...). They still never die and never count as party members. New Speech perk: Leadership.",
      "Bandits, mages and other people you fight now have perks of their own, shown on the encounter card and in the fight log."] },
    { id: "b78", build: 78, date: "22 Nov 2026", title: "The whole world, painted", items: [
      "All the new realistic artwork is in: every wilderness and dungeon background (Reach, Rift, marsh, hot springs, coast, ash wastes, caves, Nordic tombs, Dwemer ruins, Falmer caves and more), all 32 enemies in fights, and new textures for panels, parchment, the compass, the night sky and window frames."] },
    { id: "b76", build: 76, date: "22 Nov 2026", title: "Real paintings arrive", items: [
      "New realistic artwork: the title screen, four loading screens, all eleven towns (Whiterun, Solitude, Windhelm, Riften, Markarth and more), and the tundra and pine forest. More backgrounds, enemies and textures are on the way."] },
    { id: "b74", build: 74, date: "22 Nov 2026", title: "Herbs, roads, a big spellbook and colours", items: [
      "Gathering: 36 new ingredients and 500 herb patches across Skyrim and Solstheim. Spot them as you travel, Gather or Forage, grow a garden at home, and keep Herbalist's Notes. New Alchemy perks: Forager and Wildcrafter.",
      "31 new road encounters: Khajiit caravans, couriers, giants with mammoths, Thalmor patrols, assassins, a talking mudcrab and more, each with choices. New perks: Smooth Talker, Road Wise, Pathfinder.",
      "125 spells across all schools, Novice tomes at every general store and alchemist, court wizards and the College sell more as your skill grows, and Master rituals at the College.",
      "Support magic: heal, shield, empower and rescue your allies, with a Support branch of perks in every school. Smart AI uses it too.",
      "Colour coding everywhere: item quality (fine green, superior blue, exquisite purple, legendary gold, unique orange), schools and elements, warrior/mage/thief skills, quest types and prices. ⓘ shows the colour key.",
      "Sharper panels, glowing health/magicka/stamina bars, and slots ready for new painted artwork."] },
    { id: "b73", build: 73, date: "22 Nov 2026", title: "Clearer skills and spells", items: [
      "Skills and perks show only what you have now, plus the next step, instead of long tables.",
      "Every spell shows its real magicka cost and numbers, plus a Dual cast line with its cost and effect. Colours: fire orange, frost blue, shock violet, healing and buffs green, debuffs red, magicka blue.",
      "Pinching or holding the map no longer opens the favourites wheel. Long-press the compass or tap ★ instead.",
      "The update screen now says whether your app updates itself or needs one more full install."] },
    { id: "b70", build: 70, date: "22 Nov 2026", title: "Bigger perk trees, burning and a real quest journal", items: [
      "Every skill tree now has 9 to 14 perks (284 in total): Skyrim's own like Dual Flurry, Quick Shot, Eagle Eye, Shield Charge, Juggernaut, Impact, Twin Souls, Necromage and Assassin's Blade, plus new ones for Spear, Hand-to-Hand, Unarmored, Mysticism and more. Your old perks stay.",
      "Fire sets things burning for 3 turns, frost chills and slows (Deep Freeze can freeze solid), shock drains magicka and interrupts casters. Enemy mages, atronachs and dragons can do it to you too. Look for the 🔥 ❄ ⚡ chips under the health bars.",
      "The Journal is now only quests: Active, Misc and Completed, grouped by questline, with objectives, stages, recommended level and a Track button that drives the compass bar.",
      "Moved, not lost: chat, party, trades, clans and the leaderboard are under 👥 Friends; stats, diary and the lore library are on your Character page; cleared places are under Map → Locations."] },
    { id: "b68", build: 68, date: "22 Nov 2026", title: "Updates without reinstalling", items: [
      "Install this version once more by hand. After that the app downloads new versions by itself in the background and switches to them the next time you open it — no Android installer, no tapping Install.",
      "If an update ever fails to start, the app goes back to the version inside it on its own.",
      "Only rare bigger changes to the app itself still need a normal install; the game tells you when."] },
    { id: "b67", build: 67, date: "22 Nov 2026", title: "A truer map and allies that look the part", items: [
      "Map polish: Solitude now stands at the tip of the Haafingar peninsula over the Karth estuary, the Hjaalmarch coast is jagged marsh, Dawnstar sits on its bay and the College of Winterhold rises on its own islet.",
      "Every ally in a fight has its own look: followers in their own gear with name tags, ice wolves, werewolf brothers, the stone gargoyle, Dremora, flame, frost and storm atronachs, ghostly heroes of Sovngarde, and Odahviing diving in with fire."] },
    { id: "b66", build: 66, date: "22 Nov 2026", title: "Shouts, beasts and weather", items: [
      "Favourites wheel: star weapons, spells, shouts and potions, then tap ★ or long-press the compass or map to pick one in a ring. Readied spells open your next fight.",
      "Dragon Shouts: 45 Word Walls across Skyrim, 11 new shouts including Dragonrend, Slow Time, Storm Call, Marked for Death and Call Dragon. Spend dragon souls to unlock words. The Greybeards and Paarthurnax teach the rest.",
      "Werewolves: Beast Form perks like Bestial Strength and Totem of Ice Brothers; feed after fights to grow stronger.",
      "Vampires: Sanguinare turns you after 3 in-game days, hunger stages, sun and fire weakness, and the Vampire Lord form with its own perk tree.",
      "Cures are quests now: Rising at Dawn with Falion in Morthal, and Purity of the Blood with the Glenmoril witch heads.",
      "Weather matters: rain weakens fire and boosts shock, storms crackle, fog throws off arrows, blizzards drain stamina unless you're dressed warm. A gentle Cold meter up north (Settings → Survival). The compass shows a weather forecast."] },
    { id: "b64", build: 64, date: "22 Nov 2026", title: "The real Skyrim map and parties that fight together", items: [
      "The world map now follows Skyrim's real layout: the coast and Sea of Ghosts, the Throat of the World, the Velothi and Jerall mountains, the White River, Lake Ilinalta and Honrich, and every town and dungeon where it belongs. High Rock, Hammerfell, Cyrodiil and Morrowind show beyond the border.",
      "Roads follow the real roads. Your character moves to the same spot on the new map automatically.",
      "Party members close by now fight beside you in road and dungeon fights, each by their own tactics, and everyone gets their own share of the spoils.",
      "Travelling together: your party and followers walk or ride with you on the road, each in their own armour and weapons, with name tags."] },
    { id: "b63", build: 63, date: "22 Nov 2026", title: "Smart fights, crafting games and motion", items: [
      "Smart AI combat is on by default: your hero picks the best move every turn, uses weaknesses, heals only when it matters and saves potions. Prefer your own rules? Switch to Custom tactics on the Tactics tab — your rules are kept.",
      "Followers fight smarter too and step in front of you when you're in trouble.",
      "Crafting mini-games: time the hammer at the forge, keep the bellows hot, stir potions, trace enchanting runes. Good play gives a small bonus; Quick craft is always there.",
      "Motion everywhere: menus slide in from where you swiped, gold and XP count up, level-ups light a constellation, loot flies into your pack, routes draw on the map. Settings → Motion: Full, Lite or Off."] },
    { id: "b62", build: 62, date: "22 Nov 2026", title: "Solstheim and the Skyrim compass", items: [
      "Solstheim: take the Northern Maiden from Windhelm's docks to Raven Rock. A whole new island with ash wastes, Skaal Village, Tel Mithryn, the All-Maker Stones and Miraak's story.",
      "New creatures (ash hoppers, netch, rieklings, lurkers), ash storms, Stalhrim, Chitin and Bonemold gear, and the Bend Will shout.",
      "The Skyrim compass menu is now your home screen: swipe left for Magic, right for Items, up for Skills and down for the Map. The bottom bar shows your level, gold, carry weight and what you're doing.",
      "Constellation skill trees: tap a star to read and take a perk.",
      "Clearer screens: a 'What to do next' card, town places grouped into Shops, Services, Home and more, a tidier Journal with counters, ⓘ help on every screen and a search box in your pack."] },
    { id: "b61", build: 61, date: "21 Nov 2026", title: "Together on the roads", items: [
      "Co-op dungeons: invite up to 3 friends at a dungeon door, clear the rooms together and each get your own share of the boss chest.",
      "Fight on horseback: charge into road fights from the saddle. If your horse goes down you're thrown clear and fight on foot.",
      "Arena duels are real fights now, using each player's own gear, spells and tactics. Healing loops are fixed too.",
      "The Civil War: join the Imperials in Solitude or the Stormcloaks in Windhelm and win the holds. Jarls and guards change with the war.",
      "Daedric quests: 13 princes, each with a shrine, a quest and an artifact that really works.",
      "A real economy: every town has its own prices, daily shortages and gluts, and what all players buy and sell moves them. Look for the Market today card.",
      "Fairer crafting: repeating the same item gives less XP, crafted things don't sell for more than their materials, and crafting fortify loops are capped. Find recipe scrolls in the world and name your masterworks.",
      "Legendary skills: at 100, make a skill Legendary for a permanent bonus. Every skill now does something on its own, and a Progress card shows what's next.",
      "Exploration: hidden caches, a unique item in every notable dungeon, claw doors and ring puzzles, lore books for your library and treasure maps.",
      "Player halls: buy a plot, build a forge, shrine, trophy room and shop counter, and hire staff. Clans can build guild halls together."] },
    { id: "b60", build: 60, date: "21 Nov 2026", title: "Fights come alive", items: [
      "Every weapon has its own move: dagger double stabs, sword slashes, axe chops, hammer slams with a shockwave, spear thrusts, bows that draw and loose, and more.",
      "Every spell looks different: fire, frost and lightning, wards, runes, summons and shouts all have their own effects and particles.",
      "Fights play at a natural pace, about a second per move. Use ×2 or Skip if you're in a hurry.",
      "Power attacks wind up and shake the screen, critical hits and sneak attacks slow down, and the last blow gets a slow-motion finish.",
      "Enemies fight like themselves: wolves bite, giants slam, dragons breathe fire, draugr shout.",
      "Story quests now scale with you, and the Journal shows a recommended level for each quest.",
      "Patch notes: you're reading them! Find them in the main menu and in Settings."] },
    { id: "b58", build: 58, date: "21 Nov 2026", title: "Lockpicking, sounds of Skyrim and the dragon priests", items: [
      "Skyrim-style lockpicking mini-game (or a quick roll if you'd rather not).",
      "Big banners for new quests and objectives, guards who comment when you arrive, and loading cards with tips.",
      "Ambient sound everywhere: wind, rain and thunder, birds, wolves at night, busy towns, inns, forges, caves and Dwemer ruins. New Ambience slider.",
      "The eight dragon priests wait in their ruins from level 20. Collect their masks and find Konahrik at Bromjunaar."] },
    { id: "b57", build: 57, date: "21 Nov 2026", title: "Looks and feels like Skyrim with SkyUI", items: [
      "A Skyrim compass on the map with your quest marker, nearby places, players and dragon raids.",
      "Slim health, magicka and stamina bars that fade when full, and a message log in the corner.",
      "Smoked-glass menus, SkyUI item lists, town options as Skyrim dialogue, the Journal as a quest book, perk constellations and a proper YOU DIED screen."] },
    { id: "b56", build: 56, date: "21 Nov 2026", title: "Thieves Guild, Dark Brotherhood and magic you can see", items: [
      "Full Thieves Guild questline up to the Twilight Sepulcher, with Nightingale gear and fence bonuses.",
      "Full Dark Brotherhood questline up to Hail Sithis!, with contracts, Shrouded gear, the Blade of Woe and Shadowmere.",
      "Animated title screen with aurora and a dragon, plus a short story intro.",
      "Festival decorations in towns, and spells and shouts now show on the map."] },
    { id: "b55", build: 55, date: "21 Nov 2026", title: "Spell crafting and bard songs", items: [
      "Make your own spells at the College of Winterhold: combine effects you know, set the strength and name it.",
      "Write a verse about your deeds at an inn. The best verses of the week are sung in every inn."] },
    { id: "b54", build: 54, date: "21 Nov 2026", title: "Weather, seasons and homes in every picture", items: [
      "Sun, two moons, stars, aurora, snow, rain, fog, storms and autumn leaves in every picture.",
      "Drawn interiors for all five houses, your neighbours' homes and the Hall of the North.",
      "Dragon raids circle on the map, the Arena has a cheering crowd, and clan banners fly over their holds."] },
    { id: "b53", build: 53, date: "21 Nov 2026", title: "Carts and caravans", items: [
      "Buy a cart at the stables to carry 300 more (slower, roads only, sometimes raided).",
      "Four caravans loop between the big cities. Sign on as a guard, fight off ambushes together, and get paid when you arrive."] },
    { id: "b52", build: 52, date: "21 Nov 2026", title: "Faces and an equipment screen", items: [
      "Portraits for shopkeepers, innkeepers, Jarls, guards, trainers and followers.",
      "Pictures for every road event and story moment.",
      "An equipment screen showing your character with gear slots and stat comparisons."] },
    { id: "b51", build: 51, date: "21 Nov 2026", title: "A living map and drawn dungeon maps", items: [
      "Hand-drawn map markers, your portrait on the map, footprints, birds, cloud shadows and towns that light up at night.",
      "Dungeons get a torch-lit drawn map where you tap rooms to move."] },
    { id: "b50", build: 50, date: "21 Nov 2026", title: "Spell icons and smoother sound", items: [
      "An icon for every spell, skill, perk, stone, shout, quest and achievement.",
      "Sound rewritten: no more pops or crackles, and new Nordic music."] },
    { id: "b49", build: 49, date: "21 Nov 2026", title: "The game gets pictures", items: [
      "Two art styles to choose from in Settings: hand-drawn or pixel art.",
      "Animated fight scenes, pictures for every place, icons for items and enemies, and your character drawn in their gear."] },
    { id: "b48", build: 48, date: "21 Nov 2026", title: "Fights stay exciting at higher levels", items: [
      "Weak enemies now catch up to your level like in Skyrim, so fights at level 20–40 are a real challenge again."] },
    { id: "b47", build: 47, date: "21 Nov 2026", title: "Mysticism gets its own magic", items: [
      "Mysticism is now its own school: Soul Trap, Detect Life, Dispel, Mark and Recall, and Spell Absorption.",
      "Breaking down enchanted gear now only trains Enchanting."] },
    { id: "b46", build: 46, date: "21 Nov 2026", title: "Much more magic", items: [
      "44 new spells: runes, cloaks, walls, storms, wards, bound weapons, raising the dead, fear, invisibility and more.",
      "Dual casting, elemental weaknesses, staffs with charges, and spells you can use outside fights."] },
    { id: "b45", build: 45, date: "21 Nov 2026", title: "Free roam and skills explained", items: [
      "Tap any spot on the map and walk there, off the roads.",
      "Every skill now says what it does, what you get later, and how to raise it."] },
    { id: "b44", build: 44, date: "21 Nov 2026", title: "All of Skyrim to discover", items: [
      "256 places from Skyrim, hidden until you find them.",
      "Spell tomes sold by court wizards and the College.",
      "Bows need arrows, crossbows need bolts, and you can make both at the forge.",
      "A guide for new players with Show-me buttons."] },
    { id: "b43", build: 43, date: "21 Nov 2026", title: "Friends and messages", items: [
      "A friends list, private messages, and trading with friends anywhere by courier.",
      "Ores drop as loot, and cleared places refill after 3 in-game days."] },
    { id: "b42", build: 42, date: "21 Nov 2026", title: "Mining and a proper trade window", items: [
      "Mine ore at Skyrim's mines with a pickaxe (sometimes you find a gem).",
      "Every shop has a Buy and Sell window with Sell all.",
      "Timers now count in-game time."] },
    { id: "b41", build: 41, date: "21 Nov 2026", title: "Smithing, gems and jewellery", items: [
      "Make weapons, armor and jewellery at the forge, and smelt ore and tan pelts.",
      "Valuable gems and jewellery drop from tough enemies and chests.",
      "Tactics fixed: new rules now work, plus bigger cards and more conditions."] },
    { id: "b40", build: 40, date: "21 Nov 2026", title: "Gear bonuses show on your character", items: [
      "Skills boosted by your gear show a green ▲, and Active effects lists your enchantments."] },
    { id: "b39", build: 39, date: "21 Nov 2026", title: "Cleared places show when they open again", items: [
      "A live countdown on cleared dungeons, badges on the map, and a Cleared places list in the Journal."] },
    { id: "b38", build: 38, date: "21 Nov 2026", title: "Market stalls", items: [
      "Own a house and run a stall in that town. Other players can buy from it while you're away."] },
    { id: "b37", build: 37, date: "21 Nov 2026", title: "Werewolves and vampires", items: [
      "Join the Circle for Beast Form, or catch vampirism at night. Both have cures if you change your mind."] },
    { id: "b36", build: 36, date: "21 Nov 2026", title: "Clan wars over the holds", items: [
      "Clans earn points in each hold. The weekly winner rules the hold: their colour on the map and cheaper shops for members."] },
    { id: "b35", build: 35, date: "21 Nov 2026", title: "Smoother, lighter on battery, and a Journal menu", items: [
      "The map uses less battery, and the Journal has a quick-jump menu."] },
    { id: "b34", build: 34, date: "21 Nov 2026", title: "Seasonal events", items: [
      "Real-calendar festivals: Witchingmoon, Frostfall Blizzards, New Life Festival and Midyear Celebration."] },
    { id: "b33", build: 33, date: "21 Nov 2026", title: "Clans", items: [
      "Found a clan with a tag and banner colours, invite players, and chat in your clan channel."] },
    { id: "b32", build: 32, date: "21 Nov 2026", title: "Achievements", items: [
      "18 achievements with progress bars on the Hero tab."] },
    { id: "b31", build: 31, date: "21 Nov 2026", title: "A tutorial for new players", items: [
      "A guided first trip to Whiterun, plus one-time tips on each tab."] },
    { id: "b30", build: 30, date: "21 Nov 2026", title: "Map pins and party routes", items: [
      "Hold a finger on the map to drop a pin, share it with your party, and see party members' routes."] },
    { id: "b28", build: 28, date: "21 Nov 2026", title: "The Arena in Windhelm", items: [
      "Duel other players for gold, with monthly seasons and a ladder. Nobody dies."] },
    { id: "b27", build: 27, date: "21 Nov 2026", title: "Fishing, cooking, horses and visits", items: [
      "Fish in rivers, lakes and the sea, and cook stews and soups.",
      "Buy a horse, name it and pick its coat. Horses never die; they limp back to the stables.",
      "Visit other players' homes and leave gifts."] },
    { id: "early", build: null, date: "20 Nov 2026", title: "The first day", items: [
      "Roads of the North arrives on Android with one shared world for everyone.",
      "Standing stones, racial powers, dragon shouts and dragon souls.",
      "Carriages, followers, homes, enchanting, weather, seasons and dragon attacks on towns.",
      "Quest lines: the main quest, Companions, Thieves Guild and the College.",
      "Trading between players, a leaderboard, chat, backups, music and sound.",
      "The Hall of the North that everyone builds together, and the Jarl's weekly bounty board.",
      "A main menu and in-app updates."] },
  ];
  // Coming next: refresh this list whenever you add a patch note that ships one of its lines (or every few builds).
  // NEXT_AT is the build it was last written for; tests/test_comingnext.js fails once it is 4+ builds behind the newest note.
  const NEXT_AT = 144;
  const NEXT = [
    "A new, livelier fight screen that fits on one screen",
    "On PC, everything fits on one screen without scrolling",
    "New painted dungeon rooms and a painted world map",
    "More unique enchantments on gear",
  ];
  const KEY = "rotn_notes_seen";
  const latest = () => LIST[0];
  function seen() { try { return localStorage.getItem(KEY); } catch { return null; } }
  function markSeen() { try { localStorage.setItem(KEY, latest().id); } catch { /* ignore */ } }
  const unseen = () => seen() !== latest().id;
  const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function entryHTML(n, open) {
    const head = `<span class="pnt">${e(n.title)}</span><span class="pnm">${n.build ? `Build ${n.build} · ` : ""}${e(n.date)}</span>`;
    return `<details class="pn"${open ? " open" : ""}><summary>${head}</summary><ul>${n.items.map((i) => `<li>${e(i)}</li>`).join("")}</ul></details>`;
  }
  /* the full list; the newest entry is open */
  function html() {
    return `<div class="pnotes"><details class="pn pnnext" open><summary><span class="pnt">Coming next</span><span class="pnm">Being built now</span></summary><ul>${NEXT.map((i) => `<li>${e(i)}</li>`).join("")}</ul></details>
      ${LIST.map((n, i) => entryHTML(n, i === 0)).join("")}</div>`;
  }
  /* a header that stays at the top while the list scrolls, so going back never needs a scroll to the end.
     where: "page" (title menu: ‹ Back on the left, like an app bar) or "sheet" (in-game popup: ✕ on the right) */
  function barHTML(where, attr) {
    const btn = where === "sheet"
      ? `<button class="pnback pnx" ${attr} aria-label="Close patch notes">✕</button>`
      : `<button class="pnback" ${attr} aria-label="Back to the menu">‹ Back</button>`;
    return `<div class="pnbar pn-${where}">${where === "sheet" ? "" : btn}<h2>Patch Notes</h2>${where === "sheet" ? btn : ""}</div>`;
  }
  /* the one-time popup after an update: just the newest entry */
  function whatsNewHTML() {
    const n = latest();
    return `<div class="pnotes pnwhat"><div class="pnkick">What's new</div><h2>${e(n.title)}</h2><ul>${n.items.map((i) => `<li>${e(i)}</li>`).join("")}</ul></div>`;
  }
  return { LIST, NEXT, NEXT_AT, latest, seen, markSeen, unseen, html, barHTML, whatsNewHTML, KEY };
})();
if (typeof module !== "undefined") module.exports = PATCHNOTES;
