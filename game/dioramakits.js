/* Region kits for the diorama road view (dioramakits.js). [OURS]
   Plain data: what grows where. A kit names its ground tint, how thick the forest is beside the road, which painted
   cut-outs grow there and how often, and the distant ridges. Regions are the road view's own (fpscene.js REGIONS):
   tundra, pine, mountain, rocky, marsh, ash, coast, valley (river valleys), autumn (the Rift). A region without a kit keeps the classic road view.
   DIOKITS.filesFor(kit) → the paintings that region needs before it draws.
   Every kit uses the dio-*.webp paintings; a new region kit only needs its own cut-outs listed here.
     DIOKITS.of(region) → kit or null
     DIOKITS.PROPS      → cut-out → { file, h: [min, max] metres tall, tree, shadow (metres wide) }
     DIOKITS.PLACES     → place kind → { file, h } · DIOKITS.BRIDGE → the bridge cut-out
     DIOKITS.FILES      → the paintings the diorama needs before it draws (places and bridges load as they're needed) */
const DIOKITS = (() => {
  const PROPS = {
    pine: { file: "dio-pine", h: [7, 11], tree: true, shadow: 2.6 },
    spruce: { file: "dio-spruce", h: [6, 10], tree: true, shadow: 2.4 },
    birch: { file: "dio-birch", h: [5.5, 8], tree: true, shadow: 1.8 },
    bush: { file: "dio-bush", h: [0.9, 1.4], shadow: 1.4 },
    fern: { file: "dio-fern", h: [0.55, 0.9], shadow: 0.8 },
    rocks: { file: "dio-rocks", h: [0.7, 1.4], shadow: 1.5 },
    stump: { file: "dio-stump", h: [0.6, 0.9], shadow: 1.2 },
    grass: { file: "dio-grass", h: [0.45, 0.75], shadow: 0 },
    sign: { file: "dio-sign", h: [2.1, 2.1], shadow: 0.7 },
    // region cut-outs (made with ChatGPT from the region-art brief); each kit below names the ones it uses
    marshdead: { file: "dio-marsh-deadtree", h: [6, 9], tree: true, shadow: 1.4 },
    marshsnag: { file: "dio-marsh-snag", h: [3.5, 6], tree: true, shadow: 1.2 },
    marshtree: { file: "dio-marsh-tree", h: [6, 9], tree: true, shadow: 1.6 },
    reeds: { file: "dio-marsh-reeds", h: [1.2, 1.9], shadow: 0 },
    marshgrass: { file: "dio-marsh-grass", h: [0.5, 0.85], shadow: 0 },
    bogstump: { file: "dio-marsh-stump", h: [0.8, 1.3], shadow: 1.2 },
    ashtree: { file: "dio-ash-tree", h: [6, 9], tree: true, shadow: 1.4 },
    ashsnag: { file: "dio-ash-snag", h: [2.5, 4.5], tree: true, shadow: 1.1 },
    ashrocks: { file: "dio-ash-rocks", h: [0.8, 1.6], shadow: 1.6 },
    ashshrub: { file: "dio-ash-shrub", h: [0.8, 1.3], shadow: 1.2 },
    vent: { file: "dio-ash-vent", h: [1.8, 2.6], shadow: 1.4 },
    pinesnow: { file: "dio-pine-snow", h: [7, 11], tree: true, shadow: 2.6 },
    sprucesnow: { file: "dio-spruce-snow", h: [6, 10], tree: true, shadow: 2.4 },
    rockssnow: { file: "dio-rocks-snow", h: [0.7, 1.4], shadow: 1.5 },
    bushsnow: { file: "dio-bush-snow", h: [0.8, 1.2], shadow: 1.3 },
    bushautumn: { file: "dio-bush-autumn", h: [0.9, 1.4], shadow: 1.4 },
    driftwood: { file: "dio-driftwood", h: [0.6, 0.9], shadow: 1.6 },
    dunegrass: { file: "dio-dunegrass", h: [0.6, 1], shadow: 0 },
    coastrocks: { file: "dio-coast-rocks", h: [0.7, 1.3], shadow: 1.5 },
    boulder: { file: "dio-tundra-boulder", h: [1.6, 2.5], shadow: 2.2 },
    tundragrass: { file: "dio-tundra-grass", h: [0.5, 0.85], shadow: 0 },
  };
  const BASE = ["pine", "spruce", "birch", "bush", "fern", "rocks", "stump", "grass", "sign"];   // the set every region can use
  /* trees: chance a 6 m cell beyond the clear verge holds a tree, and which; clutter: the same for small things.
     ground: a tint over the ground painting (floor: the region's own ground, else the forest floor). far/mid: the
     distant ridges' tint (farFile / midFile: the region's own ridges, else the shared ones). */
  const KITS = {
    pine: { trees: 0.62, treeMix: { pine: 0.45, spruce: 0.4, birch: 0.15 }, clutter: 0.55, clutterMix: { fern: 0.3, grass: 0.35, bush: 0.2, rocks: 0.1, stump: 0.05 }, ground: [1, 1, 1], far: [1, 1, 1], fog: 0x8e9fae },
    tundra: { trees: 0.07, treeMix: { pine: 0.6, birch: 0.25, spruce: 0.15 }, clutter: 0.5, clutterMix: { tundragrass: 0.4, grass: 0.2, rocks: 0.15, boulder: 0.08, bush: 0.12, stump: 0.05 }, floor: "dio-floor-tundra", ground: [1.04, 1.0, 0.92], far: [1.05, 1.0, 0.92], fog: 0xa6a89a },
    rocky: { trees: 0.14, treeMix: { pine: 0.55, spruce: 0.45 }, clutter: 0.5, clutterMix: { rocks: 0.45, grass: 0.35, bush: 0.15, stump: 0.05 }, ground: [1.02, 0.96, 0.86], far: [1, 0.98, 0.96], fog: 0x9aa0a4 },
    mountain: { trees: 0.18, treeMix: { sprucesnow: 0.6, pinesnow: 0.3, spruce: 0.1 }, clutter: 0.4, clutterMix: { rockssnow: 0.45, bushsnow: 0.25, rocks: 0.15, grass: 0.15 }, floor: "dio-floor-snow", ground: [1, 1.01, 1.04], far: [1.05, 1.06, 1.1], fog: 0xb3bec8 },
    coast: { trees: 0.08, treeMix: { pine: 0.7, birch: 0.3 }, clutter: 0.5, clutterMix: { dunegrass: 0.35, grass: 0.15, coastrocks: 0.25, driftwood: 0.12, rocks: 0.13 }, ground: [1.06, 1.04, 0.92], far: [1, 1.02, 1.06], fog: 0x9eaab4 },
    valley: { trees: 0.3, treeMix: { birch: 0.4, pine: 0.35, spruce: 0.25 }, clutter: 0.55, clutterMix: { grass: 0.4, fern: 0.3, bush: 0.2, rocks: 0.1 }, ground: [1, 1.04, 0.95], far: [1, 1, 1], fog: 0x93a3ab },
    marsh: { trees: 0.38, treeMix: { marshtree: 0.4, marshdead: 0.35, marshsnag: 0.25 }, clutter: 0.7, clutterMix: { reeds: 0.35, marshgrass: 0.4, bogstump: 0.12, fern: 0.13 }, floor: "dio-floor-marsh", ground: [0.8, 0.88, 0.8], midFile: "dio-mid-marsh", far: [0.95, 0.98, 1], fog: 0x8c9894 },
    ash: { trees: 0.2, treeMix: { ashtree: 0.55, ashsnag: 0.45 }, clutter: 0.5, clutterMix: { ashrocks: 0.35, ashshrub: 0.3, vent: 0.06, rocks: 0.14, stump: 0.15 }, floor: "dio-floor-ash", ground: [0.8, 0.78, 0.76], farFile: "dio-far-ash", midFile: "dio-far-ash", far: [0.92, 0.9, 0.9], fog: 0x9b9792 },
    autumn: { trees: 0.5, treeMix: { birch: 0.7, pine: 0.2, spruce: 0.1 }, clutter: 0.55, clutterMix: { fern: 0.3, grass: 0.3, bushautumn: 0.25, bush: 0.05, stump: 0.1 }, ground: [1.05, 1, 0.9], far: [1.04, 0.98, 0.92], fog: 0xa29c94 },
  };
  /* places on the map (WORLD.places kind) → their painted cut-out and height in metres; they stand where they really
     are, pushed back off the road to its far side when they sit on it */
  const PLACES = {   // h: height in metres; w: the painting's width / height; rank: who keeps its spot when two would overlap
    city: { file: "dio-place-city", h: 34, w: 2.72, rank: 9 }, college: { file: "dio-place-city", h: 30, w: 2.72, rank: 8 },
    town: { file: "dio-place-town", h: 15, w: 2.45, rank: 7 }, fort: { file: "dio-place-fort", h: 20, w: 1.8, rank: 6 },
    camp: { file: "dio-place-camp", h: 9, w: 2.0, rank: 4 }, farm: { file: "dio-place-farm", h: 10, w: 2.08, rank: 5 },
    stone: { file: "dio-place-stone", h: 6, w: 0.66, rank: 3 }, shrine: { file: "dio-place-shrine", h: 4.2, w: 0.87, rank: 3 },
    lair: { file: "dio-place-lair", h: 16, w: 1.79, rank: 4 }, landmark: { file: "dio-place-tower", h: 13, w: 0.66, rank: 3 },
    dungeon: { file: "dio-place-barrow", h: 10, w: 1.78, rank: 2 },
  };
  /* the big places have their own painting (made with ChatGPT from the place-art brief): name → { file, h, w }; every
     other place uses its kind's painting above */
  const NAMED = {
    "Markarth": { file: "dio-city-markarth", h: 36, w: 2.492 },
    "Riften": { file: "dio-city-riften", h: 30, w: 2.899 },
    "Solitude": { file: "dio-city-solitude", h: 38, w: 2.676 },
    "Whiterun": { file: "dio-city-whiterun", h: 34, w: 2.606 },
    "Windhelm": { file: "dio-city-windhelm", h: 34, w: 2.45 },
    "Dawnstar": { file: "dio-town-dawnstar", h: 15, w: 2.963 },
    "Dragon Bridge": { file: "dio-town-dragon-bridge", h: 13, w: 3.125 },
    "Falkreath": { file: "dio-town-falkreath", h: 15, w: 2.419 },
    "Helgen": { file: "dio-town-helgen", h: 15, w: 2.679 },
    "Ivarstead": { file: "dio-town-ivarstead", h: 15, w: 2.733 },
    "Morthal": { file: "dio-town-morthal", h: 15, w: 2.885 },
    "Riverwood": { file: "dio-town-riverwood", h: 15, w: 2.83 },
    "Rorikstead": { file: "dio-town-rorikstead", h: 15, w: 3.209 },
    "Winterhold": { file: "dio-town-winterhold", h: 15, w: 2.83 },
    "High Hrothgar": { file: "dio-landmark-high-hrothgar", h: 26, w: 2.113 },
    "Sky Haven Temple": { file: "dio-landmark-sky-haven-temple", h: 20, w: 1.964 },
    "Darkwater Crossing": { file: "dio-town-darkwater-crossing", h: 15, w: 2.715 },
    "Dushnikh Yal": { file: "dio-town-dushnikh-yal", h: 15, w: 3.191 },
    "Karthwasten": { file: "dio-town-karthwasten", h: 15, w: 2.637 },
    "Kynesgrove": { file: "dio-town-kynesgrove", h: 15, w: 3.023 },
    "Largashbur": { file: "dio-town-largashbur", h: 15, w: 2.715 },
    "Mor Khazgur": { file: "dio-town-mor-khazgur", h: 15, w: 3.085 },
    "Narzulbur": { file: "dio-town-narzulbur", h: 15, w: 2.592 },
    "Old Hroldan": { file: "dio-town-old-hroldan", h: 10, w: 2.243 },
    "Shor's Stone": { file: "dio-town-shors-stone", h: 15, w: 2.892 },
    "Soljund's Sinkhole": { file: "dio-town-soljunds-sinkhole", h: 11, w: 2.358 },
    "Stonehills": { file: "dio-town-stonehills", h: 15, w: 3.008 },
  };
  const BRIDGE = { file: "dio-place-bridge", h: 3.8, deck: 0.86 };   // deck: where the road runs, as a share of the height from the bottom
  const FILES = ["dio-sky", "dio-far", "dio-mid", "dio-floor", "dio-road", ...new Set(BASE.map((k) => PROPS[k].file))];
  // the paintings a region needs before it draws: the shared set, plus its own ground, ridges and cut-outs
  const filesFor = (kit) => !kit ? FILES : [...new Set([...FILES, kit.floor, kit.farFile, kit.midFile, ...Object.keys({ ...kit.treeMix, ...kit.clutterMix }).map((k) => PROPS[k].file)].filter(Boolean))];
  return { PROPS, BASE, KITS, PLACES, NAMED, BRIDGE, FILES, filesFor, of: (r) => KITS[r] || null };
})();
if (typeof module !== "undefined") module.exports = DIOKITS;
