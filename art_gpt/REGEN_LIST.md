# Pictures to paint again bigger (REGEN list)

Shared list: the asset-quality work (claude/assetquality) and the map work (claude/mapvisuals) both add to it.
Measured by `tests/art_quality_ui.py` on phones (360x780@2, 390x844@3, 768x1024@2) and PCs (1366x768@1 up to
5120x1440@1 ultrawide and 3840x2160@2). "Needed" = the pixels the file would need to fill its biggest box on the
sharpest screen tested.

None of these is blown up into a blur today: the game shows a file that is too small at its own pixel size (centred,
or with the fight stage held to ~1100 screen px) instead of stretching it. Painting them bigger lets them fill the
box on big and sharp screens. Re-export to WebP at q85-90 (`method=6, alpha_quality=90`), keep the same shape, and
if a file gets bigger than ~1.5 MB, add a `<name>@2x.webp` and put the name in `ASSETS.HI` (game/assets.js) instead.

## Too small for big screens

| Asset | Now (px) | Needed (px) | Where it shows / worst screen |
|---|---|---|---|
| bs-* fight plates still at the old size (14 files: arena, ash, autumn, banditcamp, forsworn, fort, giantcamp, lair, marsh, mine, rocky, temple, thalmor, vampire) | 1480x680 | 2808x1290 (2200x1010 at least) | fight stage; 3840x2160@2 and 2000x837@2 PC. On a 390@3 phone they need 1581x726. forest, snow, tundra, cave, barrow, dwemer (and the new town) are done at 2808x1290. |
| bsf-* foreground strips (13 files) | 1480x~90 | ~2830x170 | the ground strip in front of the fighters, same screens as bs-* |
| bsp-* props (e.g. bsp-tundra-grass, bsp-tundra-waystone) | 300-320 px | ~2x (e.g. 674x354, 554x601) | props on the fight stage on 3840x2160@2 |
| foe-* | 1254x1254 (dragon 1536x1024) | ~2040x2040 | the foe on the fight stage on 3840x2160@2; already re-exported at the full size of the art branch originals, so this needs new paintings |
| shop-alchemy, shop-forge, shop-general, shop-inn | 1200x375 | 1656x518 | shop banners on 3840x2160@2 (1432x448 on a 768@2 tablet) |
| shop-arena, shop-docks, shop-fence, ... (1200x320) | 1200x320 | ~1656x442 | same banner box |
| biome-nordruin | 1600x900 | 2681x1508 | dungeon header/room on 3840x2160@2 |
| place-* (11 towns) | 1600x900 | ~1660x935 | town picture on the Area screen on 3840x2160@2 |
| gev-*-thumb, wev-*-thumb (e.g. gev-siege-thumb, wev-kc-thumb) | 280-320 px wide | 1200-2400 px wide | the event cards on the Area screen and the map card show the small thumbnail in a big box; draw the full gev-/wev- picture there, or paint thumbs at ~1280x900 |
| bg-loading-1..4, ui-nightsky | 1080x1920 | 1170x2532 | loading cards and the night sky on a 390@3 phone (1.32x today: soft but under the 1.5x limit). The originals are only 941x1672, so they need new paintings. |

## Not on this list (their own branches)

- `title` (title screen): claude/widetitle.
- `map-world` / `map-world-2x` and everything on the world map: claude/mapvisuals (add the map's entries below).

## Allowed blow-ups

`tests/art_quality_ui.py` fails past 1.5x. A file that has to go past that until it is painted again gets a line
`allow: <file key> <limit>` here (limit 1.5-8; `tests/test_assetsize.js` checks the key exists). None is needed now.
