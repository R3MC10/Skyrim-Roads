# Handoff — continuing Roads of the North on Remigiusz's PC

Read `CLAUDE.md` first (project layout, rules, how to work). This file is the current state as of 22 Nov 2026, ~12:10 Warsaw time.

## Working with Remigiusz
- He doesn't code; he tests on his phone. Plain, informal language. Short replies.
- He likes quick **surveys with multi-select options** instead of walls of text.
- Don't stay idle: when a task is done, improve something in the project.
- He runs lots of work in parallel; ship in batches with a player-facing entry in `game/patchnotes.js`.

## How shipping works
- `main` is protected (pull requests); Remigiusz's own account can push directly when he says "put it on main".
- Every push to `main` builds an APK (GitHub Actions `android.yml`) and a `game-shell2.zip`. Phones on build 68+ update themselves in the background (quick update); older ones need one manual install of https://github.com/R3MC10/Skyrim-Roads/releases/latest/download/RoadsOfTheNorth.apk
- If he reports the Android installer still popping up: ask what ⚙ → Main menu → Update says (it now shows whether quick updates are active and the last error).
- A web copy of the game is published as a claude.ai artifact by the cloud session; on the PC you can just test with `python3 -m http.server` in `game/`.

## Branches waiting for you (pushed from the cloud session, 22 Nov ~12:40)
- `claude/gear` — FINISHED: gear visuals for every armour set/weapon, visible to other players; gear preview; idle/walk animations. Tests: tests/test_gearlook.js, gearlook_ui.py. Ready to merge into main (check conflicts with the other branches in fightart.js, fxart.js, heroart.js, ui.js, index.html).
- `claude/wip-party-merge` — UNFINISHED: exact map (map3) + party play (party2) + followers overhaul + enemy perks + end-of-dungeon loot vote (lootvote.js). The patches were applied and hand-merged but the loot vote and full test run were not finished. Next: run all node tests and partyplay_ui/followers2_ui/foeperks_ui/map11_ui, fix, then merge.
- `claude/wip-ai-settings` — UNFINISHED: sneak-attack fix (sneak2.js), adjustable Smart AI settings (aiset.js), better tactics editor. Was in the middle of the full regression.
- `claude/wip-turn-based` — UNFINISHED: turn-based combat (tbfight.js): initiative, action points, manual turns + Auto, live party turns. Stopped mid-work (ui/store/coop/fightart edits not done).
All WIP branches were made from build 74 code, so merge main into them first (art + patch notes changed there).

## Original plan for the work above (for reference)
1. Merge of: exact map from game data (map3), party play (leader leads, ready check, 8 players, dungeon scaling), **end-of-dungeon loot vote with d100 rolls**, follower overhaul (inventory, auto-levelling, archetypes), perks for humanoid enemies.
2. Turn-based combat: initiative order, action points (Athletics/Stamina, spell AP from Magicka/Alteration, initiative from Acrobatics/Sneak), manual turns + Auto button, live party turns with 60 s timer, long tactical fights, good animations.
3. Sneak-attack fix (no more one-shots) + player-adjustable Smart AI (style, preferred attacks, allowed schools, "Spread practice" to level all skills, potions/shouts/sneak settings) + better tactics editor (AND/OR rules, presets, share codes, test-fight preview, hybrid mode).
4. Gear visuals: every armour set/weapon visible to other players; better animations.
5. Realistic art via ChatGPT → branch `art`, folder `art/`. 18 done and shipped (title, loading screens, all towns, tundra, pine forest). Remaining: 12 biomes, 32 enemies (facing right, transparent), 5 UI textures. Converted to WebP and dropped flat into `game/` using names in `game/assets.js`.

**Don't edit** `engine.js`, `ui.js`, `combatai.js`, `fightart.js`, `party.js`, `coop.js`, `world.js` until those land on `main` (pull first), or you'll get conflicts.

## Next up (his requests not started yet)
- **Simplify menus into clear tabs** (Character / Items / Magic / Map / Journal (quests only) / Social / Town); move scattered things (settings, patch notes, library) under them.
- **ElevenLabs sounds and music** (now on the PC, where api.elevenlabs.io is reachable). Key in env var `ELEVENLABS_API_KEY` — never commit it, never print it. Current audio is procedural in `game/sound.js` (`SOUND.fx(name)` for effects, ambient/music layers). Plan: generate SFX (sword hits per weapon, spells per element, footsteps, UI clicks, level up, shouts, creatures) and music loops (exploration per region, town, dungeon, combat, boss, title), save as small `.ogg`/`.mp3` flat in `game/` (e.g. `sfx-sword-hit.ogg`, `mus-tundra.ogg`), and make `sound.js` play files when present with the procedural sounds as fallback. Keep total size reasonable for a phone app.
- Loop backlog in `ROADMAP.md`.

## Standing rules (also in CLAUDE.md)
Perk trees grow with every new system (real effects, keep old ids) · parties up to 8, followers don't count · in a party only the leader makes choices; loot voted at dungeon end, gold split evenly · both art styles · followers/horses never die · no Fallout mentions · balance with sims, fights shouldn't end quickly.
