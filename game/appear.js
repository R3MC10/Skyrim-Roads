/* appear.js: how your character looks, as plain data. [OURS]
   The save keeps it in s.app; HEROART.lookOf copies it onto the shared look (look.a), so fights, the map, portraits,
   party cards and other players' phones all draw the same face. FIGART reads it in specOf.
   app = { v, sx "m"|"f", build 0-4, height 0-4, skin, face 0-3, eyes, brows 0-3, nose 0-3, mouth 0-3, age 0-3,
           hair (style id), hairC, beard (style id), bl (old beard length 1-5, kept for old saves), horns (Argonians),
           scar, paint, paintC, tattoo }
   Colours are indexes into per-race palettes; the first entries of each palette are the old HEROART.RACE colours,
   so an old save mapped with fromSeed() looks exactly as it did before.
   Pure functions, tested in node (tests/test_chargen.js). */
const APPEAR = (() => {
  const RACES = ["nord", "imperial", "breton", "redguard", "altmer", "bosmer", "dunmer", "orc", "khajiit", "argonian"];
  const R0 = { skin: ["#e2b894"], hair: ["#8a5a34"], beard: 0.5, ears: "round" };
  const base = (r) => ((typeof HEROART !== "undefined" && HEROART.RACE && HEROART.RACE[r]) || R0);
  const uniq = (a) => [...new Set(a)];

  // ---- palettes (old colours first, then more)
  const MORE_SKIN = {
    nord: ["#f5dcc4", "#d9a982", "#c99470", "#f0d0b0"], imperial: ["#e6bc96", "#b98a60", "#a77a52", "#cfa27a"],
    breton: ["#f7e0c8", "#d8b08c", "#c69a74", "#efcfae"], redguard: ["#8a5a3c", "#5a3a24", "#4a2e1c", "#9a6a48"],
    altmer: ["#ecdc9c", "#cdb46a", "#e8d6a0", "#d4c486"], bosmer: ["#c4945c", "#94683e", "#80592f", "#b98a58"],
    dunmer: ["#8c98a0", "#5e6a73", "#6a6670", "#9aa2a6"], orc: ["#8fae68", "#5f7a42", "#7a9a6a", "#6a8a56"],
    khajiit: ["#d8b080", "#6e543a", "#e8d8c0", "#a87a48"], argonian: ["#4f6f5a", "#8a9a5a", "#6a7a8a", "#7a5a3a"],
  };
  const MORE_HAIR = ["#1c1714", "#3b2c1e", "#5a3e26", "#8a5a34", "#b27b3c", "#d9b56a", "#e8d9a8", "#a8622e", "#8e2b25", "#9a9690", "#e8e4dc"];
  const FRILLS = ["#4d6a44", "#5e7a50", "#8e2b25", "#c9a75e", "#2f4f8a", "#5a3e26", "#a8622e"];
  const EYES_H = ["#3b4a5a", "#5a7a9a", "#4a6a3a", "#6b4a2e", "#8a8070", "#2a2420", "#a88a3a"];
  const EYES = { dunmer: ["#c4372e", "#e0a040", "#8e2b25", "#d0603a"], khajiit: ["#d6b25e", "#9ac04a", "#e08a3a", "#7ab0d0"],
    argonian: ["#e8c24a", "#d0603a", "#9ac04a", "#c9b6ff"], altmer: ["#c9a75e", "#3b4a5a", "#6b4a2e", "#a88a3a"] };
  const PAINTC = ["#1c2128", "#2f4f8a", "#8e2b25", "#e9dcc0", "#3d5d36", "#c9a75e"];
  const skins = (r) => uniq([...(base(r).skin || []), ...(MORE_SKIN[r] || [])]);
  const hairCols = (r) => (r === "argonian" ? FRILLS : uniq([...(base(r).hair || []), ...MORE_HAIR]));
  const eyeCols = (r) => uniq([base(r).eyes || "#3b4a5a", ...(EYES[r] || EYES_H)]);

  // ---- choices: [id, label]
  const HAIR = [["short", "Short"], ["long", "Long"], ["braid", "Braid"], ["bun", "Bun"], ["ponytail", "Ponytail"], ["mohawk", "Mohawk"], ["wild", "Wild"], ["shaved", "Shaved"], ["bald", "Bald"]];
  const MANES = [["short", "Fur only"], ["long", "Mane"], ["braid", "Braided mane"], ["bun", "Knotted mane"], ["ponytail", "Tied mane"], ["shaved", "Shorn mane"], ["mohawk", "Crest of fur"]];
  const HORNS = [["frills", "Frills"], ["horns", "Horns"], ["crest", "Crest"], ["spikes", "Spikes"], ["none", "Smooth"]];
  const BEARDS = [["none", "None"], ["stubble", "Stubble"], ["short", "Short"], ["full", "Full"], ["braided", "Braided"], ["long", "Long"]];
  const BEARD_LEN = { short: 1, full: 3, braided: 4, long: 5 };
  const FACES = ["Even", "Broad jaw", "Narrow", "Square"];
  const NOSES = ["Straight", "Hooked", "Broad", "Small"];
  const MOUTHS = ["Calm", "Smile", "Stern", "Frown"];
  const BROWS = ["Normal", "Heavy", "Thin", "Arched"];
  const AGES = ["Young", "Grown", "Weathered", "Old"];
  const BUILDS = ["Slim", "Lean", "Average", "Strong", "Heavy"];
  const HEIGHTS = ["Short", "Below average", "Average", "Tall", "Very tall"];
  const SCARS = [["none", "None"], ["eye", "Across the eye"], ["cheek", "Cheek"], ["lip", "Split lip"], ["brow", "Brow"], ["claw", "Claw marks"]];
  const PAINTS = [["none", "None"], ["band", "Band over the eyes"], ["stripes", "Cheek stripes"], ["jaw", "Dark jaw"], ["eye", "Eye ring"]];
  const TATTOOS = [["none", "None"], ["rune", "Forehead rune"], ["dots", "Cheek dots"], ["lines", "Chin lines"], ["spiral", "Spiral"]];
  const BW = [0.9, 0.95, 1, 1.06, 1.12], BH = [0.94, 0.97, 1, 1.03, 1.06];

  const hairList = (r) => (r === "khajiit" ? MANES : r === "argonian" ? [["short", "None"]] : HAIR);
  const beardOk = (r, sx) => sx !== "f" && (base(r).beard || 0) > 0 && r !== "argonian" && r !== "khajiit";
  const beasts = (r) => r === "khajiit" || r === "argonian";
  const ids = (list) => list.map((x) => x[0]);
  const clampI = (v, n, d = 0) => { v = Math.round(Number(v)); return Number.isFinite(v) && v >= 0 && v < n ? v : d; };
  const pick = (v, list, d) => (ids(list).includes(v) ? v : d);

  /* a full, valid appearance for this race (anything missing or out of range is fixed) */
  function norm(a, r) {
    a = a || {}; r = RACES.includes(r) ? r : "nord";
    const sx = a.sx === "f" ? "f" : "m", hl = hairList(r);
    const o = {
      v: 1, sx, build: clampI(a.build, 5, 2), height: clampI(a.height, 5, 2), skin: clampI(a.skin, skins(r).length),
      face: clampI(a.face, 4), eyes: clampI(a.eyes, eyeCols(r).length), brows: clampI(a.brows, 4), nose: clampI(a.nose, 4), mouth: clampI(a.mouth, 4), age: clampI(a.age, 4, 1),
      hair: pick(a.hair, hl, hl[0][0]), hairC: clampI(a.hairC, hairCols(r).length),
      beard: beardOk(r, sx) ? pick(a.beard, BEARDS, "none") : "none",
      scar: pick(a.scar, SCARS, "none"), paint: pick(a.paint, PAINTS, "none"), paintC: clampI(a.paintC, PAINTC.length), tattoo: pick(a.tattoo, TATTOOS, "none"),
    };
    if (r === "argonian") o.horns = pick(a.horns, HORNS, "frills");
    if (o.beard !== "none" && o.beard !== "stubble" && a.bl >= 1 && a.bl <= 5) o.bl = Math.round(a.bl);
    return o;
  }
  /* the look an old save had (the same random draws figart.js makes from the id), as an appearance */
  function fromSeed(id, r, fem) {
    r = RACES.includes(r) ? r : "nord";
    const race = base(r), seeded = typeof ART !== "undefined" ? ART.seeded : null;
    if (!seeded) return norm({ sx: fem ? "f" : "m" }, r);
    const rnd = seeded(String(id) + r);
    const skin = Math.floor(rnd() * (race.skin || [1]).length);
    const hairC = (race.hair || []).length ? Math.floor(rnd() * race.hair.length) : 0;
    const beardRoll = rnd() < (race.beard || 0);
    const hs = String(id).startsWith("preview") ? 0 : [0, 0, 1, 2, 2, 0, 1, 3][Math.floor(rnd() * 8)];
    const paint = rnd() < 0.3 ? Math.floor(rnd() * 3) : -1;
    const bl = 1 + Math.floor(seeded(String(id) + "|fig")() * 5);
    const hair = fem ? ["long", "braid", "long", "bun"][[0, 0, 1, 2, 2, 0, 1, 3].indexOf(hs) % 4] || "long" : ["short", "braid", "long", "shaved"][hs] || "short";
    const a = { sx: fem ? "f" : "m", build: 2, height: 2, skin, hairC, hair, age: 1,
      beard: beardRoll && !fem && (race.hair || []).length ? "full" : "none", bl, paint: paint >= 0 ? "band" : "none", paintC: Math.max(0, paint) };
    if (r === "argonian") a.horns = "frills";
    const o = norm(a, r);
    if (beardRoll && !fem && (race.hair || []).length && !beardOk(r, "m")) { o.beard = "full"; o.bl = bl; }   // an old elf beard stays
    return o;
  }
  /* a random look; rnd() in 0..1 (seeded in tests) */
  function random(r, sx, rnd = Math.random) {
    r = RACES.includes(r) ? r : "nord";
    const R = (n) => Math.floor(rnd() * n), P = (list) => list[R(list.length)][0];
    const fem = sx === "f", hl = hairList(r);
    const a = { sx: fem ? "f" : "m", build: R(5), height: R(5), skin: R(skins(r).length), face: R(4), eyes: rnd() < 0.5 ? 0 : R(eyeCols(r).length), brows: R(4), nose: R(4), mouth: R(4), age: R(4),
      hair: fem && !beasts(r) ? P(hl.filter(([id]) => !["bald", "mohawk"].includes(id) || rnd() < 0.3)) : P(hl), hairC: R(Math.min(hairCols(r).length, rnd() < 0.7 ? (base(r).hair || []).length || 4 : 99)),
      beard: beardOk(r, sx) && rnd() < Math.max(0.35, base(r).beard || 0) ? P(BEARDS.slice(1)) : "none",
      scar: rnd() < 0.3 ? P(SCARS.slice(1)) : "none", paint: rnd() < 0.3 ? P(PAINTS.slice(1)) : "none", paintC: R(PAINTC.length), tattoo: rnd() < 0.2 ? P(TATTOOS.slice(1)) : "none" };
    if (r === "argonian") a.horns = P(HORNS);
    return norm(a, r);
  }
  /* switching race keeps what can carry over (build, face, scars...), colours are clamped to the new palettes */
  function forRace(a, r) { const o = norm({ ...a, bl: undefined }, r); return o; }

  // ---- what the renderer needs
  const skinOf = (r, i) => { const l = skins(r); return l[clampI(i, l.length)]; };
  const hairColOf = (r, i) => { const l = hairCols(r); return l[clampI(i, l.length)]; };
  const eyeOf = (r, i) => { const l = eyeCols(r); return l[clampI(i, l.length)]; };
  const paintOf = (i) => PAINTC[clampI(i, PAINTC.length)];
  const beardLen = (a) => (a.bl >= 1 && a.bl <= 5 ? a.bl : BEARD_LEN[a.beard] || 1);
  const bw = (a) => BW[clampI(a.build, 5, 2)], bh = (a) => BH[clampI(a.height, 5, 2)];

  // ---- the save
  /* put an appearance on a save (s.app, and s.sex for everything that only knows m/f) */
  function apply(s, a) {
    const o = norm(a, s.race);
    s.app = o;
    if (o.sx === "f") s.sex = "f"; else delete s.sex;
    return o;
  }
  /* an old save without s.app gets the face it always had */
  function migrate(s) {
    if (!s || !s.race || typeof ART === "undefined" || typeof HEROART === "undefined" || !HEROART.RACE) return false;   // needs the old palettes to rebuild the old face
    if (s.app && typeof s.app === "object") { s.app = norm(s.app, s.race); if (s.app.sx === "f") s.sex = "f"; return false; }
    s.app = fromSeed(s.id || s.name || "x", s.race, s.sex === "f");
    return true;
  }
  /* the compact copy sent on the player card (defaults left out) */
  function compact(a) {
    if (!a) return null;
    const d = { v: 1, sx: "m", build: 2, height: 2, skin: 0, face: 0, eyes: 0, brows: 0, nose: 0, mouth: 0, age: 1, hairC: 0, beard: "none", scar: "none", paint: "none", paintC: 0, tattoo: "none" };
    const o = { v: 1 };
    for (const [k, v] of Object.entries(a)) if (v !== undefined && d[k] !== v) o[k] = v;
    return o;
  }
  /* short words for a summary line: [[what, word]] (what = the choice the word belongs to, for translation) */
  function describe(a, r) {
    a = norm(a, r);
    const hl = hairList(r), hairName = (hl.find((x) => x[0] === a.hair) || hl[0])[1];
    return [["build", BUILDS[a.build]], ["height", HEIGHTS[a.height]], r === "argonian" ? ["horns", (HORNS.find((x) => x[0] === a.horns) || HORNS[0])[1]] : ["hair", hairName],
      a.beard !== "none" ? ["beard", (BEARDS.find((x) => x[0] === a.beard) || [])[1]] : null].filter(Boolean);
  }

  return { RACES, HAIR, MANES, HORNS, BEARDS, FACES, NOSES, MOUTHS, BROWS, AGES, BUILDS, HEIGHTS, SCARS, PAINTS, TATTOOS, PAINTC, BW, BH,
    skins, hairCols, eyeCols, hairList, beardOk, beasts, norm, fromSeed, random, forRace, skinOf, hairColOf, eyeOf, paintOf, beardLen, bw, bh, apply, migrate, compact, describe };
})();
