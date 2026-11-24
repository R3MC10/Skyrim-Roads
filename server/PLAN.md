# Accounts and a hosted server: plan

Branch: `kacper/accounts` (kept apart from `main` until it's tested end to end).
Owner: Kacper (with Claude). Asked for by Remigiusz: "hook it up to a server and allow users to create accounts;
I have characters on different devices and can't reach them from the others."

## Goals
1. **Accounts**: a username and password, nothing else. No Google, no email (an email can be added to an account later,
   optionally, for password resets). Passwords are stored only as salted scrypt hashes.
2. **Characters in the cloud**: every character on an account can be played from any phone or PC.
3. **One device at a time**: an account plays on one device. Signing in somewhere else asks:
   *"You're playing on Remi's phone (2 min ago). Play here instead?"* → **Play here** (the other device is signed out
   and told so the next time it talks to the server) or **Keep playing there** (nothing changes).
4. **Nothing breaks**: with no server configured, or when signed out, the game works exactly as today (local save,
   phone-to-phone world). Offline play keeps working; the cloud copy catches up when the phone is back online.

## Phases
| Phase | What | Status |
| --- | --- | --- |
| 1 | Server with accounts, sessions (one device), cloud characters; sign-in screen and character picker in the game; upload existing characters | **live on Railway** (`https://skyrim-roads-production.up.railway.app`, Postgres) · next: test on phones, merge |
| 2 | Shared world on the server instead of phone-to-phone (parties, chat, trades, market, clans, events) as a new backend inside `store.js` | **built, tested locally** (`hub.js`, `game/servernet.js`) |
| 3 | Party fights run on the server (host can leave, every player gets the full fight screen); optional economy checks | **parked** (see below) |

## Phase 1 design

### Server (`server/`, Node 22, deployed on Railway)
- Plain Node `http` (no framework) + `pg`. One dependency.
- Storage behind one small interface with two adapters: **Postgres** (Railway, `DATABASE_URL`) and **memory**
  (local runs and the node tests, so CI needs no database).
- Tables
  - `accounts(id, username, username_lc unique, pass_hash, email null, created_at)`
  - `sessions(id, account_id, token_hash, device_id, device_name, created_at, last_seen, revoked_at, revoked_by)`
  - `characters(id, account_id, name, level, race, data jsonb, version, updated_at, deleted_at)`
- Session tokens: 32 random bytes, sent as `Authorization: Bearer …`; only their SHA-256 is stored.
- **One active session per account.** Login when another device's session is still active → `409 session_active`
  with that device's name and last-seen time. Login again with `takeover: true` → the other session is revoked
  (`revoked_by` = the new device). Any request with a revoked token → `401 session_replaced` + who took over.
- Characters carry the world id they already have (`sk.uid`, e.g. `local-ab12cd34`), so a character is the same
  person in the shared world on every device. A character id belongs to one account.
- Saves: `PUT /api/characters/:id {data, baseVersion}`. If the server copy moved on since `baseVersion`
  (played elsewhere) → `409 version_conflict` with the server's summary; the game asks which copy to keep.
- Limits: usernames 3–20 letters/digits/_/-, passwords 8–200 characters, 12 characters per account, saves up to 2 MB,
  login attempts rate-limited per username and per address.

### API
| Method | Path | Body → reply |
| --- | --- | --- |
| GET | `/api/health` | → `{ok, store}` |
| POST | `/api/register` | `{username, password, deviceId, deviceName}` → `{token, account}` |
| POST | `/api/login` | `{username, password, deviceId, deviceName, takeover?}` → `{token, account}` · `409 session_active {device, lastSeen}` |
| POST | `/api/logout` | → `{ok}` |
| GET | `/api/session` | heartbeat → `{account, device}` · `401 session_replaced {by, at}` |
| GET | `/api/characters` | → `{characters:[{id, name, level, race, version, updatedAt}]}` |
| GET | `/api/characters/:id` | → `{character:{…, data}}` |
| PUT | `/api/characters/:id` | `{data, baseVersion}` → `{version}` · `409 version_conflict {server}` |
| DELETE | `/api/characters/:id` | → `{ok}` (soft delete, kept 30 days) |

### Game (`game/account.js`)
- Off unless a server address is set (built-in address once Railway is live; `?server=` for testing).
- Title menu → **Account**: Create account / Sign in; once signed in: your characters (level, race, last played),
  **Play**, **Upload this phone's character**, **New character**, Sign out.
- Playing a cloud character puts it in this phone's save slot (the phone's previous character is kept in the
  automatic backups) and switches the world id to the character's own, then reloads.
- Saves upload a few seconds after changes and when the app is closed; a heartbeat every minute notices
  a takeover and shows *"Signed out: you're now playing on X"* with **Play here instead**.
- Plain player-facing wording; works in both art styles; one-hand friendly.

### Railway setup (Remigiusz)
1. New project → **Deploy from GitHub repo** → this repo, **Root directory `server`**.
2. Add a **Postgres** database to the project (Railway sets `DATABASE_URL`).
3. Variables: `ALLOWED_ORIGINS` (optional, comma separated; default allows the app and the web copy).
4. The start command and health check come from `server/railway.json`; tables are created on first start.
5. Copy the public URL into `game/account.js` (`DEFAULT_SERVER`) in a pull request.
Secrets live only in Railway, never in the repo.

### Testing
- `tests/test_server.js` (CI, memory store): accounts, hashing, sessions, one-device rule and takeover,
  character saves and version conflicts, limits.
- The same tests against a real local Postgres before release (`PG_TEST_URL=… node tests/test_server.js`).
- `tests/account_ui.py`: sign up, upload, second "device" takes over, first one is told, character picker,
  both art styles.

## Status (phase 1)
- Server: done. `tests/test_server.js` passes on memory (CI) and on a local Postgres 16, including two racing saves.
- Game: done (`game/account.js`, small hooks in `store.js` and `ui.js`). `tests/account_ui.py` passes end to end with
  two "devices" against both stores: sign up, upload, "Play here?", takeover, the signed-out notice mid-game,
  saving to the account, taking it back with the "two copies" choice, sign out.
- Hidden until a server address is set, so merging it changes nothing for players.
- Before switching it on for everyone: deploy on Railway, put the address in `DEFAULT_SERVER`, add a patch note,
  try it on two real phones (Android app and the web copy).

### Local testing
```
cd server && npm install && PORT=8788 node src/index.js          # memory store
python3 -m http.server 8901 --directory game &                    # the game
# open http://localhost:8901/index.html?server=http://localhost:8788  (add &p=devA / &p=devB for two "devices")
python3 tests/account_ui.py 8901 8788
```

## Phase 2: the shared world on the server (built)
- `server/src/hub.js`: a WebSocket at `/ws`. Signed-in players connect with their session and the character they
  play. The hub keeps the whole shared world in Postgres (`world_records`), merges records like the phones do (newer
  `_v` wins), passes messages between players, and forgets old records (chat after a day, deleted markers after two…).
- Checks the phones couldn't do: a player can only write their own public card and only sign records as themselves,
  can't play a character from another account, and one account has one connection: signing in on another device or
  signing out closes the old connection at once (the game shows the notice straight away, no waiting for the heartbeat).
- `game/servernet.js`: the same transport shape as the phone-to-phone network, so `store.js` and all the game code
  above it are unchanged; signed in → the server world, signed out → phone-to-phone as before. Reconnects by itself.
- Mixed groups: signed-in players and signed-out players are in two separate worlds (server vs phone-to-phone).
  Once the server is live, everyone should sign in.
- Still "newest wins" like before: two players grabbing the same thing in the same second can still clash. Making
  those single steps on the server (claims, trades) is part of phase 3.
- Tests: `tests/test_hub.js` (20 checks, memory and Postgres, in CI), `tests/world_ui.py` (two accounts in the
  browser: online, chat, cards, takeover, sign out).

## Phase 3: parked (decided 23 Nov 2026)
Kacper and Remigiusz test phases 1–2 on real phones first. Notes for whoever picks it up:
- **Server-checked claims** (two players can't both take the same chest loot, stall item, gift or share): the hub would
  accept a change only on top of the version the phone last saw. The catch: about 40 `Store.change` calls, and some
  of them already change your character inside the claim (a market buy takes your gold in `MARKET.buy`), so a refused
  claim needs a reliable undo of the save, or those calls must move their side effects after the claim succeeds.
- **Server-run party fights** (the leader can leave, every member gets the full fight screen): fights are woven into
  the action that started them (`TB.call` pauses the action, plays the fight, then replays the action with the same
  dice), and that action only exists on the leader's phone. Moving fights to the server means running the fight
  engine there (it already runs in Node in the tests) and giving the action a way to finish without the leader.
