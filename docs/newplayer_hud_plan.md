# New players and HUD: plan (talked through with ChatGPT)

**ChatGPT's verdict:** the game should feel simple at level 1 and deep at level 20. Right now it feels complicated at level 1. Gating by level helps, but it isn't enough. The screens need reorganising too.

## What a level 1 player sees today (phone, first 10 seconds)

- A world-event toast overlapping the map labels, plus a welcome popup over the map.
- A red *Daedric invasion* card, caravan cards and many GO buttons.
- A location list with 5 filters.
- A gather bar.
- 7 bottom tabs.
- Every system is open from minute one: invasions, world bosses, clans, crafting, followers, pets, housing and more.

## Top problems (ranked)

1. Too many systems introduced at once.
2. Every system looks equally important on screen.
3. Players don't know what to do next. There is no single clear goal.
4. Rewards compete for attention.
5. Too much is always visible.

## 1. Unlock by level (levels are a first guess; tune them with level-up times)

| Level | Unlocks |
|---|---|
| 1 | Fights, travel, items, equipment, quests, friends and parties (**never gated**) |
| 2 | First perk |
| 3 | Gathering, simple recipes, cooking |
| 4 | Forge and smithing |
| 5 | Followers, hirelings, alchemy |
| 6 | Horses, faster travel |
| 7 | First proper dungeon (deep delves, elite rooms) |
| 8 | Clans, housing |
| 9 | Clan jobs, enchanting |
| 10 | Harder dungeons, shouts |
| 11 | World events (invasions, hunts, caravans, blizzards) |
| 12 | World bosses, expeditions |
| 15 | Elite encounters |
| 20 | Legendary encounters |

- **Locked things are hidden**, not greyed out, so menus aren't full of grey buttons. Only the **next 1–2 unlocks** show as a small teaser: "Next unlock · Level 4 · Smithing".
- **Each unlock comes with a short quest or scene**, not just a new button. Example: "The Blacksmith's Apprentice".
- **Existing characters:** anything they already use stays unlocked.
- **New characters on an old account** can skip tutorials they've already done.

## 2. Friends always play together

- A level 1 player can join a level 15 friend's party right away.
- If the leader heads somewhere a member can't enter yet, the game warns before leaving and names who can't go in.
- A veteran helping a beginner gets fights scaled for the group.
- Unlock scenes wait until a group activity ends.

## 3. Fewer tabs: 5 instead of 7

| Tab | Holds |
|---|---|
| World | Map, travel, region events |
| Area | This location: people, shops, services, activities |
| Hero | Equipment, items, magic, skills, perks, stats |
| Journal | Quests, discoveries, achievements |
| Social | Friends, party, clan |

- Crafting lives in places (forge, alchemy lab).
- World events live on the World tab, and only from level 11.

The always-visible HUD answers just four questions:
- Where am I?
- How is my hero doing?
- What should I do next? One tracked goal.
- How do I get there?

The HUD also changes by situation. In a fight it shows threats, turn order and abilities. In a town it shows people and services. On the map it shows the place, your goal and where you can go.

## 4. The first 30 minutes

| Minute | What happens |
|---|---|
| 0–2 | Make a character, see the location screen, get one clear goal. No wall of tips. |
| 2–5 | First win: a simple fight that teaches attacking, foe intents and blocking. |
| 5–8 | First upgrade: loot a better item, put it on, and see the paper doll change. |
| 8–12 | First journey: travel, find a village, meet someone. |
| 12–18 | First real build choice: level up, pick a perk, feel stronger. |
| 18–25 | First dangerous foe that uses what you've learned. |
| 25–30 | A reason to come back: a small quest chain ends, a good reward, and a preview of the next unlock. |

Teach each thing when it's needed. For example, explain blocking when a foe first winds up a big hit.

## 5. Rewards ("dopamine"), honestly

Rewards feel best when they change what you can do. Avoid constant flashing and pop-up spam.

| Kind | How often | Example | How it's shown |
|---|---|---|---|
| Tiny | every 20–60 s | loot, skill XP, a good move | Quiet: "+24 gold · +15 One-Handed" |
| Small | every 2–5 min | an upgrade, a discovery, a goal done | A short notice |
| Medium | every 5–15 min | a level-up, a perk, a quest done | A short notice |
| Big | every 15–30 min early on | a new feature, a follower, an ability | Full screen: "LEVEL 4 · Smithing unlocked" plus a new quest |
| Milestone | over several sessions | a legendary item, a big boss, a clan achievement | Full screen |

All of these go through the one notice queue we already have. No second pop-up system.

## 6. Build order (one shippable step at a time)

| Step | What | Done when |
|---|---|---|
| 1 | Unlock system: a central list of what's open at which level, with hide/teaser, veterans and the party rules | A new character only sees level-appropriate systems |
| 2 | 5 tabs instead of 7 | Common tasks take 2–3 taps |
| 3 | New first 30 minutes: guided quest chain, tips when needed | First fight within 2 minutes |
| 4 | Rewards: one reward queue, unlock scenes, a "next level brings…" preview | Big rewards never overlap |
| 5 | HUD by situation, plus phone polish | Nothing important overlaps at 360 px |
| 6 | Playtest with new players without helping them | 80% finish the opening quests on their own |

## What to measure

- Time to first fight.
- Share of new players who finish the first quest chain.
- Players reaching levels 3, 5 and 10.
- Tips skipped.
- Taps to reach common screens.
- How often players open the wrong tab.
