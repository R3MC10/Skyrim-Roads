# Roads of the North — guide for Claude (and humans)

A Skyrim-style multiplayer RPG for friends: a web game (plain JavaScript, no framework) wrapped as an Android app with Capacitor.
Owners: Remigiusz (R3MC10) and Kacper (Kacper297). Neither writes code by hand — Claude does, they test on phones.

## Layout
- `game/` — **the whole game** (source of truth). Flat folder, no subfolders (the build copies it flat). Plain JS globals, one module per file (`engine.js` fights, `ui.js` screens, `data.js` items/foes, `perks.js` + `perkfx.js` perk trees, `combatai.js` Smart AI, `world.js`/`terrain.js`/`map.js` map, `*art.js` procedural art, etc.).
- `game/index.html` — loads every script in order. It has **two `<style>` blocks**: the first holds only `@font-face`; all other CSS goes at the end of the **second** block.
- `app.js` + `android/` — Android shell: back button, notifications, in-app updater (`UpdaterPlugin.java`).
- `scripts/build.mjs` — copies `game/` into `www/` for the app.
- `tests/` — node tests (`test_*.js`) and Playwright screen tests (`*_ui.py`). Node tests read the game from `game/` (or `W=/path/to/game/`).
- `art/` (branch `art`) — raw generated pictures; they are converted to WebP and dropped flat into `game/` (see `game/assets.js` for names and sizes).
- `ROADMAP.md` — what's done, what's next, **who is working on what**, and standing rules.

## How to work
1. **Never push to `main` directly.** Make a branch: `kacper/<feature>` or `claude/<feature>`.
2. Keep changes small and focused; add a new module file when you can instead of growing `ui.js`/`engine.js`.
3. Run `node --check` on every JS file you touched, the related node tests, and any screen test for screens you changed.
4. Add a player-facing entry at the top of `game/patchnotes.js` (plain words, no code talk).
5. Open a pull request into `main`. CI runs the tests. Remigiusz's Claude merges in its loop (or a human presses Merge once tests pass).
6. Write your name + feature under "In progress" in `ROADMAP.md` before you start, so two people don't rebuild the same thing.

Every merge to `main` builds a new APK release; phones that already have build 68+ update themselves in the background.

## Standing rules (from Remigiusz)
- Plain, informal language for players. No mention of Fallout.
- Followers and horses get knocked down, never die. The forge consumes materials.
- Menus look like Skyrim + SkyUI. Both art styles (hand-drawn ink and pixel) must work.
- **Perk trees grow with the game:** every new system adds or adjusts perks with *real* effects (`perkfx.js`), keeping old perk ids.
- Parties hold up to **8 players**; followers don't count. In a party, dungeon choices are voted by everyone (majority, tie → leader; `partyvote.js`); on the road the leader decides; loot is voted at the end of a dungeon, gold split evenly.
- Balance with sims; fights shouldn't end too quickly; no one-shots on strong foes.
- Never commit secrets (signing password, API keys). The signing key is stored encrypted; its password lives in GitHub secrets.

## Running tests locally
```
cd tests
node test_engine.js            # any node test, uses ../game/
W=/path/to/game/ node test_x.js
python3 -m http.server 8765 --directory ../game &   # for screen tests
python3 tabmenu_ui.py 8765
```
Long balance sims: `test_bal_sim.js`, `test_qscale.js` (skip in quick runs).
