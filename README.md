# Roads of the North (Android app)

A multiplayer Skyrim-inspired RPG for friends: real-time travel on a painted map, programmable auto-battles,
dungeons, perks, towns, and a lot of betrayal.

## Get it on your phone
1. On your Android phone, open **Releases** on this repository's GitHub page (the newest one is at the top).
2. Tap **RoadsOfTheNorth.apk** and open the download.
3. The first time, allow your browser to install apps. That's it.

Every change pushed here builds a new version by itself (about 5 minutes). Installing a newer build keeps your save.

## Playing with friends (phone to phone)
- Everyone with the same **world code** plays in the same world. Find yours in the Journal tab and press **Share**.
- Phones find each other through free public Nostr relays, then talk directly (WebRTC). No server, no accounts.
- Every phone keeps a full copy of the world (players, dropped bags, parties, party chests, news) and merges it with
  every phone it meets, so the world lives on as long as anyone plays.
- Only friends who are online right now show up and can be fought, robbed or invited.
- Some mobile networks block direct connections. If two phones never find each other, put one of them on Wi-Fi.

## For whoever edits the code
- `game/` is the game itself (the same files as the online version).
- `src/p2pnet.mjs` is the phone-to-phone transport (bundled into `game/p2pnet.js`).
- `npm run build` copies it into `www/` with bundled fonts; `npm run sync` also updates the Android project.
- `.github/workflows/android.yml` builds a signed APK on GitHub and publishes it as a Release.
- The signing key (`android/app/roads.keystore`) is kept in this private repo so updates install over old versions.
  Keep the repository private.
