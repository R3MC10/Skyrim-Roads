# Roads of the North (Android app)

A multiplayer Skyrim-inspired RPG for friends: real-time travel on a painted map, programmable auto-battles,
dungeons, perks, towns, and a lot of betrayal.

## Get it on your phone
1. On your Android phone, open **Releases** on this repository's GitHub page (the newest one is at the top).
2. Tap **RoadsOfTheNorth.apk** and open the download.
3. The first time, allow your browser to install apps. That's it.

Every change pushed here builds a new version by itself (about 5 minutes). Installing a newer build keeps your save.

## Playing with friends (phone to phone)
- Everyone who has the app plays in **one shared world**. To bring a friend in, send them the APK.
- Phones find each other through free public Nostr relays, then talk directly (WebRTC). No server, no accounts.
- Relay mesh: each phone links straight to up to 6 others and passes messages on for everyone else, so players
  who can't reach each other directly still hear each other through the players in between.
- Every phone keeps a full copy of the world (players, dropped bags, parties, party chests, news) and merges it with
  every phone it meets, so the world lives on as long as anyone plays.
- Only friends who are online right now show up and can be fought, robbed or invited.
- If two phones can't link directly, messages hop through other online players. With only two players online and
  a network that blocks direct links, put one of them on Wi-Fi.

## For whoever edits the code
- `game/` is the game itself (the same files as the online version).
- `src/p2pnet.mjs` is the phone-to-phone transport (bundled into `game/p2pnet.js`).
- `npm run build` copies it into `www/` with bundled fonts; `npm run sync` also updates the Android project.
- `.github/workflows/android.yml` builds a signed APK on GitHub and publishes it as a Release.
- The signing key (`android/app/roads.keystore`) is kept in this private repo so updates install over old versions.
  Keep the repository private.
