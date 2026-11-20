# Roads of the North: upgrade loop

Each round: build one batch, test it (Node sims in /home/claude/tests + headless phone screenshots), push here
(GitHub builds the APK), and update the web link. Rules: real Skyrim numbers where they exist ([Skyrim]),
our own marked [OURS]; plain-language UI; phone first.

## Done
- Round 9: chat. World and party channels in the Journal, quick phrases (Need help!, Meet me at..., Dragon at...!), coloured names, unread dot, toast + sound for new messages, tap a name to mute. Messages last a day, newest 60 kept.
- Main menu and auto-update: Skyrim-style title screen (fog, snow, title music) with Continue, New Character, Settings, Updates, How to Play, Credits. The app checks GitHub for new builds, shows what's new, downloads and opens Android's installer. Signing key now stored encrypted; the password lives in GitHub secrets.
- Round 8: sound. Music made live on the phone (day, night, dungeon and fight moods) and effects (hits, gold, level up, quests, arrival, shouts, dragon roars), with a sound button for volume and mute. The app sends a phone notification when you arrive somewhere or a dragon attacks while it's closed.
- Round 7: quest lines. Main quest (Before the Storm → Bleak Falls Barrow → Dragon Rising → The Way of the Voice → Horn of Jurgen Windcaller → A Blade in the Dark), Companions, Thieves Guild, College of Winterhold. Gold diamond on the map, rewards and titles.
- Round 1: standing stones (13), racial powers (10), dragon shouts (10 shouts, 30 words), dragon souls, Greybeards.
- Round 2: carriages (Skyrim fares, safe roads), followers (Lydia via the Dragonstone, 6 hirelings at 500 gold), map labels for players and bags that dodge each other.
- Followers go down (kneel) instead of dying, and get back up after the fight at 10% health.
- Round 6: trading between players (offers held safely until accepted, declined or withdrawn) and a shared leaderboard (level, gold, dragons, dungeons, duels).
- Skyrim/SkyUI-style menu (Items / Magic / Skills tabs, category icons, sortable columns, item details, footer with armor/damage/weight/gold) and a Skyrim look for all panels.
- The forge uses Skyrim materials per improvement (Iron/Steel Ingots, Leather, Firewood, Refined Moonstone, Dwarven Metal) instead of gold.
- Round 5: enchanting at arcane enchanters (court wizards, Winterhold): break enchanted gear to learn 4 weapon and 13 armor effects, enchant with soul gems; enchanted armor in loot and shops.
- Round 4: Skyrim calendar (starts 17 Last Seed) and seasons, weather per hold every 30 min (slows travel, hides you, shown on the map), dragon attacks on towns every 3 hours that all players fight together.
- Round 3: homes (Breezehome, Honeyside, Vlindrel Hall, Hjerim, Proudspire Manor at Skyrim prices): death-proof chest, Well Rested bed (+10%; inns now Rested +5%), daily garden.

## Next rounds (in order)
10. Save backup: export/import your character as a code, and a cloud-free backup to the phone's files.
11. Player homes you can visit and a shared guild hall that the whole world builds up together.
12. Weekly world events: a bounty board with goals for everyone online (kill X wolves, clear Y dungeons) and rewards.
13. Horses you can buy, name and stable, and mounted travel on the map.
