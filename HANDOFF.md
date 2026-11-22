# Handoff — continuing Roads of the North on Remigiusz's PC

Read `CLAUDE.md` first (project layout, rules, how to work). This file is the current state as of 22 Nov 2026, evening (Warsaw), after build 88.

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

## State after the PC session (22 Nov, builds 78-88)
All earlier branches are merged into `main`: gear visuals, party play (map3, party2, followers overhaul, enemy perks, loot vote), Smart AI settings + tactics editor + sneak fix, turn-by-turn fights (on by default; Settings → Fights), homesteads, living world (rumours), world events, accessibility. Every quick node test passes on `main`.
- Testing on Windows: node tests need `W=C:/.../game/` (forward slashes, trailing slash). Screen tests use the `CHROME` env var or Playwright's Chromium (installed on this PC); run them with `PYTHONIOENCODING=utf-8`.
- `tests/test_perks2.js` now scans every game/*.js for perk effect keys, so new modules don't need adding there.
- `test_guilds.js` has a rare random flake ("low-skill sneak check"); rerun if it fails once.
- Patch notes: entry ids must be unique and newest on top (the What's new popup keys on the newest id). Builds = GitHub Actions run number of android.yml. Turn-based shipped as build 83 with id "b84"; the small fixes entry is "b84f" (build 84).
- Audio: `sound.js` plays `sfx-*/amb-*/mus-*` files listed in `game/audio.json` with procedural fallback; `scripts/gen_audio.mjs` generates them, but the ElevenLabs account is out of credits (music needs a paid plan). Parked; Kacper may take it.
- In flight: a quality-of-life batch on branches `claude/qol-*` (menu tabs cleanup, inventory helpers + undo/confirms, faster travel & fights, reminders & badges, search, crafting shortcuts, new-player flow), each with its own PR.

## Original plan for the work above (for reference)
1. Merge of: exact map from game data (map3), party play (leader leads, ready check, 8 players, dungeon scaling), **end-of-dungeon loot vote with d100 rolls**, follower overhaul (inventory, auto-levelling, archetypes), perks for humanoid enemies.
2. Turn-based combat: initiative order, action points (Athletics/Stamina, spell AP from Magicka/Alteration, initiative from Acrobatics/Sneak), manual turns + Auto button, live party turns with 60 s timer, long tactical fights, good animations.
3. Sneak-attack fix (no more one-shots) + player-adjustable Smart AI (style, preferred attacks, allowed schools, "Spread practice" to level all skills, potions/shouts/sneak settings) + better tactics editor (AND/OR rules, presets, share codes, test-fight preview, hybrid mode).
4. Gear visuals: every armour set/weapon visible to other players; better animations.
5. Realistic art via ChatGPT → branch `art`, folder `art/`. 18 done and shipped (title, loading screens, all towns, tundra, pine forest). Remaining: 12 biomes, 32 enemies (facing right, transparent), 5 UI textures. Converted to WebP and dropped flat into `game/` using names in `game/assets.js`.

## Next up (his requests not started yet)
- ElevenLabs audio: see above (parked, needs credits).
- Loop backlog in `ROADMAP.md`.

## Standing rules (also in CLAUDE.md)
Perk trees grow with every new system (real effects, keep old ids) · parties up to 8, followers don't count · in a party only the leader makes choices; loot voted at dungeon end, gold split evenly · both art styles · followers/horses never die · no Fallout mentions · balance with sims, fights shouldn't end quickly.
