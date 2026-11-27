/* Region kits for the diorama road view (dioramakits.js). [OURS]
   Plain data: what grows where. A kit names its ground tint, how thick the forest is beside the road, which painted
   cut-outs grow there and how often, and the distant ridges. Regions are the road view's own (fpscene.js REGIONS):
   tundra, pine, mountain, rocky, marsh, ash, coast, valley (river valleys), autumn (the Rift). A region without a kit keeps the classic road view.
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
  };
  /* trees: chance a 6 m cell beyond the clear verge holds a tree, and which; clutter: the same for small things.
     ground: a tint over the forest-floor painting. far/mid: the distant ridges' tint. */
  const KITS = {
    pine: { trees: 0.62, treeMix: { pine: 0.45, spruce: 0.4, birch: 0.15 }, clutter: 0.55, clutterMix: { fern: 0.3, grass: 0.35, bush: 0.2, rocks: 0.1, stump: 0.05 }, ground: [1, 1, 1], far: [1, 1, 1], fog: 0x8e9fae },
    tundra: { trees: 0.07, treeMix: { pine: 0.6, birch: 0.25, spruce: 0.15 }, clutter: 0.5, clutterMix: { grass: 0.6, rocks: 0.22, bush: 0.12, stump: 0.06 }, ground: [1.12, 1.02, 0.78], far: [1.05, 1.0, 0.92], fog: 0xa6a89a },
    rocky: { trees: 0.14, treeMix: { pine: 0.55, spruce: 0.45 }, clutter: 0.5, clutterMix: { rocks: 0.45, grass: 0.35, bush: 0.15, stump: 0.05 }, ground: [1.02, 0.96, 0.86], far: [1, 0.98, 0.96], fog: 0x9aa0a4 },
    mountain: { trees: 0.18, treeMix: { spruce: 0.7, pine: 0.3 }, clutter: 0.4, clutterMix: { rocks: 0.55, bush: 0.25, grass: 0.2 }, ground: [1.25, 1.28, 1.32], far: [1.05, 1.06, 1.1], fog: 0xb3bec8 },
    coast: { trees: 0.08, treeMix: { pine: 0.7, birch: 0.3 }, clutter: 0.5, clutterMix: { grass: 0.55, rocks: 0.3, bush: 0.15 }, ground: [1.06, 1.04, 0.92], far: [1, 1.02, 1.06], fog: 0x9eaab4 },
    valley: { trees: 0.3, treeMix: { birch: 0.4, pine: 0.35, spruce: 0.25 }, clutter: 0.55, clutterMix: { grass: 0.4, fern: 0.3, bush: 0.2, rocks: 0.1 }, ground: [1, 1.04, 0.95], far: [1, 1, 1], fog: 0x93a3ab },
    autumn: { trees: 0.5, treeMix: { birch: 0.7, pine: 0.2, spruce: 0.1 }, clutter: 0.55, clutterMix: { fern: 0.35, grass: 0.35, bush: 0.2, stump: 0.1 }, ground: [1.05, 1, 0.9], far: [1.04, 0.98, 0.92], fog: 0xa29c94 },
  };
  /* places on the map (WORLD.places kind) → their painted cut-out and height in metres; they stand where they really
     are, pushed back off the road to its far side when they sit on it */
  const PLACES = {
    city: { file: "dio-place-city", h: 34 }, town: { file: "dio-place-town", h: 15 }, fort: { file: "dio-place-fort", h: 20 },
    camp: { file: "dio-place-camp", h: 9 }, farm: { file: "dio-place-farm", h: 10 }, stone: { file: "dio-place-stone", h: 6 },
    shrine: { file: "dio-place-shrine", h: 4.2 }, lair: { file: "dio-place-lair", h: 16 }, landmark: { file: "dio-place-tower", h: 13 },
    dungeon: { file: "dio-place-barrow", h: 10 }, college: { file: "dio-place-city", h: 30 },
  };
  const BRIDGE = { file: "dio-place-bridge", h: 3.8, deck: 0.86 };   // deck: where the road runs, as a share of the height from the bottom
  const FILES = ["dio-sky", "dio-far", "dio-mid", "dio-floor", "dio-road", ...new Set(Object.values(PROPS).map((p) => p.file))];
  return { PROPS, KITS, PLACES, BRIDGE, FILES, of: (r) => KITS[r] || null };
})();
if (typeof module !== "undefined") module.exports = DIOKITS;
