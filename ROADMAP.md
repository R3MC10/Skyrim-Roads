# Roads of the North: upgrade loop

Each round: build one batch, test it (Node sims in /home/claude/tests + headless phone screenshots), push here
(GitHub builds the APK), and update the web link. Rules: real Skyrim numbers where they exist ([Skyrim]),
our own marked [OURS]; plain-language UI; phone first.

## Done
- Round 14: visiting homes. Town tab > Neighbours lists other players' houses in that town: their motto, mounted dragon skulls, dungeons cleared, titles and a display case (3 items). Leave gold, an item or a note; the owner gets a toast and takes it in at their house (items go in the chest).
- Round 13: horses. Buy at stables, name it, pick a coat (6), Ride/Walk while travelling (walking beside, it still carries 100), steel and elven horse armor, own health that comes back over time. Horses never die: badly hurt, they limp to the nearest stables; fetch them after 30 min or pay to patch them up. Horseshoe in its colour on your map marker. Also: travel bar buttons no longer miss taps.
- Round 12: the Jarl's bounty board. 3 shared goals for the whole world each week (fights won, dungeons cleared, dragons slain, potions brewed, places reached, jobs done). Everyone who helped claims gold + materials once a goal is met; the top helper earns a title. In the Journal and every town.
- Round 11: the Hall of the North by Whiterun, built by everyone together with gold and materials. 5 sizes (Camp, Longhouse, Mead Hall, Fortified Hall, Jarl's Keep) give every player free rest, cheaper training, more carry weight and a shared chest (take 3 a day). Trophy wall, Hall Builder title, banner on the map, news when it grows.
- Round 10: character backups. Settings > Your character: Back up (one text code: copy or share) and Restore (checks the code, asks before replacing). Automatic copies of the last 3 saves on the phone.
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
11. Visit other players' homes (leave a gift, see their trophies).
14. Fishing and cooking at campfires and inns, with recipes that give buffs.
15. Duel arena in Windhelm: friendly bets between players, a ranked ladder, seasons.
16. Better map: zoom with two fingers, place pins, see party members' routes.
