/* Patch notes: what changed in each build, newest first, in plain words. [OURS]
   To add a build: put a new entry at the TOP of LIST with a new id. The newest id is what the
   one-time "What's new" popup keys on. */
const PATCHNOTES = (() => {
  const LIST = [
    { id: "b136-dungeons", build: 136, date: "24 Nov 2026", title: "Bigger party, longer dungeon", items: [
      "Dungeons now get longer for every friend in your party who goes in: 2 more rooms each for the first three friends, then 1 more each. A full party of 8 walks 10 extra rooms before the boss.",
      "The extra rooms are the usual mix: fights, tough fights, traps, treasure chests, odd finds and the odd spot to rest. There's still a breather room right before the boss.",
      "The party leader rolls the map once when you go in, so everyone in the party walks exactly the same rooms. This now also works for co-op runs started from the dungeon door (not just the party ready check).",
      "Going in alone? Nothing changes.",
    ] },
    { id: "b136", build: 136, date: "24 Nov 2026", title: "A proper road picture while you travel", items: [
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
  const NEXT = [
    "A sharper Solitude peninsula and map polish",
    "More quests and characters",
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
  /* the one-time popup after an update: just the newest entry */
  function whatsNewHTML() {
    const n = latest();
    return `<div class="pnotes pnwhat"><div class="pnkick">What's new</div><h2>${e(n.title)}</h2><ul>${n.items.map((i) => `<li>${e(i)}</li>`).join("")}</ul></div>`;
  }
  return { LIST, NEXT, latest, seen, markSeen, unseen, html, whatsNewHTML, KEY };
})();
if (typeof module !== "undefined") module.exports = PATCHNOTES;
