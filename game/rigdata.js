/* RIGDATA: the measurements and clips behind the painted rig (rig.js). [OURS]
   The painted parts are cut-outs (rig-<who>-<set>-<part>.webp, side view facing right, real alpha), dropped flat in
   the game folder. Each file is twice the size it was measured at (a careful 2x upscale), so every point below is in
   the measured (1x) pixels of the trimmed part: the code multiplies by RES.

   Per part:
     w, h   trimmed size (1x)
     p      the joint it hangs from (shoulder, elbow, wrist, hip, knee, ankle; the waist for the torso, the neck for the head)
     e      the joint at the other end (limbs and hands): the limb is turned so p→e runs along its bone
     plus, for the upright parts:
       torso: s = shoulder socket, n = neck, cut = the row below which the round waist plug is hidden in the pelvis
       pelvis: hip = the point between the hip joints (the thighs hang from here)
       foot: sole = the row the boot stands on
       leg-bent: noBoot = the picture stops at the knee (no shin or boot): the rider's leg is built from thigh, shin and foot
       head: nw = the neck's width (the other races' heads, HEADS below, are scaled to it)
   Per set: ppu = measured pixels per drawing unit (the fight figures are about 61 units tall, feet at 0,0).
   The skeleton (bone lengths, where the shoulder and neck sit) is worked out from these points, so each armour set
   gets its own proportions and nothing floats: limbs meet at the painted joint ends. */
const RIGDATA = (() => {
  const RES = 2;
  const PARTS = ["head", "torso", "pelvis", "uparm", "forearm", "hand-open", "hand-fist", "thigh", "shin", "foot", "leg-bent"];
  const SETS = {
    "nordm-leather": { ppu: 23.6, parts: {
      head: { w: 282, h: 372, p: [158, 236], nw: 105 },
      torso: { w: 391, h: 503, p: [225, 452], s: [120, 205], n: [236, 52], cut: 440 },
      pelvis: { w: 423, h: 445, p: [225, 32], hip: [222, 150] },
      uparm: { w: 248, h: 372, p: [131, 84], e: [88, 321] },
      forearm: { w: 156, h: 333, p: [76, 62], e: [73, 297] },
      "hand-open": { w: 145, h: 205, p: [56, 52], e: [84, 190] },
      "hand-fist": { w: 155, h: 141, p: [49, 61], e: [137, 75] },
      thigh: { w: 200, h: 414, p: [102, 63], e: [80, 335] },
      shin: { w: 193, h: 393, p: [98, 63], e: [91, 345] },
      foot: { w: 225, h: 148, p: [58, 40], sole: 140 },
      "leg-bent": { w: 285, h: 473, p: [107, 105], e: [140, 454] },
    } },
    "nordm-iron": { ppu: 23.6, parts: {
      head: { w: 335, h: 507, p: [170, 312], nw: 136 },
      torso: { w: 317, h: 461, p: [160, 420], s: [78, 178], n: [160, 40], cut: 410 },
      pelvis: { w: 436, h: 448, p: [230, 30], hip: [230, 150] },
      uparm: { w: 242, h: 363, p: [123, 79], e: [72, 321] },
      forearm: { w: 160, h: 386, p: [83, 52], e: [81, 352] },
      "hand-open": { w: 270, h: 182, p: [56, 64], e: [248, 104] },
      "hand-fist": { w: 230, h: 153, p: [56, 64], e: [212, 77] },
      thigh: { w: 211, h: 515, p: [111, 45], e: [79, 474] },
      shin: { w: 214, h: 454, p: [112, 87], e: [101, 423] },
      foot: { w: 288, h: 200, p: [70, 45], sole: 190 },
      "leg-bent": { w: 320, h: 497, p: [160, 64], e: [128, 476] },
    } },
    "nordm-steel": { ppu: 23.6, parts: {
      head: { w: 350, h: 535, p: [190, 305], nw: 132 },
      torso: { w: 335, h: 475, p: [165, 430], s: [55, 140], n: [170, 30], cut: 420 },
      pelvis: { w: 419, h: 469, p: [215, 30], hip: [215, 150] },
      uparm: { w: 250, h: 342, p: [125, 73], e: [79, 303] },
      forearm: { w: 139, h: 373, p: [71, 56], e: [71, 339] },
      "hand-open": { w: 271, h: 176, p: [54, 60], e: [247, 98] },
      "hand-fist": { w: 236, h: 153, p: [58, 65], e: [217, 79] },
      thigh: { w: 199, h: 511, p: [102, 44], e: [88, 455] },
      shin: { w: 188, h: 456, p: [100, 80], e: [82, 430] },
      foot: { w: 283, h: 184, p: [70, 40], sole: 176 },
      "leg-bent": { w: 321, h: 492, p: [159, 72], e: [149, 470] },
    } },
    "nordf-leather": { ppu: 21.5, parts: {
      head: { w: 295, h: 494, p: [165, 285], nw: 106 },
      torso: { w: 291, h: 424, p: [150, 390], s: [68, 130], n: [150, 30], cut: 380 },
      pelvis: { w: 398, h: 357, p: [200, 25], hip: [200, 120] },
      uparm: { w: 223, h: 337, p: [109, 76], e: [64, 303] },
      forearm: { w: 139, h: 301, p: [73, 64], e: [83, 273] },
      "hand-open": { w: 205, h: 133, p: [37, 42], e: [180, 72] },
      "hand-fist": { w: 175, h: 113, p: [41, 47], e: [159, 52] },
      thigh: { w: 217, h: 423, p: [117, 47], e: [77, 384] },
      shin: { w: 198, h: 344, p: [103, 75], e: [98, 316] },
      foot: { w: 268, h: 155, p: [60, 40], sole: 148 },
      "leg-bent": { w: 262, h: 431, p: [132, 60], e: [70, 401], noBoot: 1 },   // the thigh only: in the saddle rig.js folds the thigh, shin and boot instead
    } },
    "nordf-iron": { ppu: 23.6, parts: {
      head: { w: 323, h: 553, p: [181, 290], nw: 114 },
      torso: { w: 340, h: 471, p: [190, 425], s: [88, 150], n: [175, 30], cut: 415 },
      pelvis: { w: 441, h: 423, p: [235, 25], hip: [235, 135] },
      uparm: { w: 250, h: 389, p: [130, 84], e: [77, 355] },
      forearm: { w: 169, h: 365, p: [84, 51], e: [95, 332] },
      "hand-open": { w: 283, h: 186, p: [57, 64], e: [252, 104] },
      "hand-fist": { w: 230, h: 159, p: [60, 68], e: [211, 77] },
      thigh: { w: 208, h: 521, p: [106, 49], e: [81, 481] },
      shin: { w: 217, h: 471, p: [112, 95], e: [98, 443] },
      foot: { w: 285, h: 208, p: [75, 50], sole: 196 },
      "leg-bent": { w: 354, h: 516, p: [174, 78], e: [155, 496] },
    } },
    "nordf-steel": { ppu: 23.6, parts: {
      head: { w: 323, h: 558, p: [178, 292], nw: 115 },
      torso: { w: 359, h: 493, p: [200, 445], s: [82, 155], n: [185, 25], cut: 435 },
      pelvis: { w: 460, h: 482, p: [235, 25], hip: [235, 140] },
      uparm: { w: 275, h: 392, p: [139, 85], e: [83, 353] },
      forearm: { w: 162, h: 399, p: [81, 50], e: [87, 371] },
      "hand-open": { w: 293, h: 191, p: [61, 68], e: [265, 103] },
      "hand-fist": { w: 249, h: 166, p: [62, 70], e: [229, 87] },
      thigh: { w: 212, h: 521, p: [107, 44], e: [86, 483] },
      shin: { w: 222, h: 472, p: [115, 95], e: [99, 448] },
      foot: { w: 298, h: 216, p: [80, 45], sole: 205 },
      "leg-bent": { w: 359, h: 499, p: [179, 75], e: [165, 478] },
    } },
  };
  /* heads for the other races (rig-head-<race><m|f>.webp), worn on any set: nw is the neck width (1x px), and the head is
     drawn at set head nw / this nw, so the neck fills the set's collar the way the Nord head does (the pictures were scaled
     so the faces match the Nord faces); p = the neck, set as far below the chin as on the Nord heads; cut = the row below
     which the rest of the painted neck stub is hidden (it would lie over the armour's collar) */
  const HEADS = {
    dunmerm: { w: 295, h: 356, p: [116, 309], nw: 110, cut: 322 }, dunmerf: { w: 354, h: 554, p: [157, 347], nw: 110, cut: 361 },
    khajiitm: { w: 303, h: 373, p: [104, 305], nw: 110, cut: 318 }, khajiitf: { w: 377, h: 597, p: [158, 372], nw: 110, cut: 385 },
    argonianm: { w: 362, h: 374, p: [123, 275], nw: 110, cut: 289 }, argonianf: { w: 407, h: 444, p: [155, 310], nw: 110, cut: 323 },
    imperialm: { w: 254, h: 345, p: [80, 294], nw: 110, cut: 306 }, imperialf: { w: 328, h: 403, p: [144, 299], nw: 110, cut: 312 },
    bretonm: { w: 264, h: 331, p: [93, 280], nw: 110, cut: 294 }, bretonf: { w: 323, h: 480, p: [135, 302], nw: 110, cut: 315 },
    redguardm: { w: 258, h: 326, p: [102, 256], nw: 110, cut: 268 }, redguardf: { w: 307, h: 449, p: [126, 282], nw: 110, cut: 294 },
    altmerm: { w: 299, h: 376, p: [137, 266], nw: 110, cut: 278 }, altmerf: { w: 383, h: 461, p: [195, 313], nw: 110, cut: 326 },
    bosmerm: { w: 280, h: 378, p: [109, 297], nw: 110, cut: 310 }, bosmerf: { w: 334, h: 426, p: [162, 305], nw: 110, cut: 318 },
    orcm: { w: 293, h: 376, p: [115, 280], nw: 110, cut: 292 }, orcf: { w: 279, h: 375, p: [109, 268], nw: 110, cut: 282 },
  };
  const headFile = (k) => `rig-head-${k}`;
  const file = (set, part) => `rig-${set}-${part}`;

  /* ---- clips, in the same controls as figart.js (so the fight replay's numbers drive both):
       aim      weapon-hand angle (the fight scene's number: -0.5 ready, -2 raised behind, +1 cut through)
       back     shield / off hand (0 hanging, -1.5 raised in front)      lean  upper body forward (+) or back (-)
       dy, ox   the body's offset (dy > 0 crouches)                      rot   the whole body turned (knocked down)
       tilt     the head                                                 fn/ff near / far foot on the ground [x, y]
       draw     bow string (0..1)    cast  spell glow (0..1)    hipx  hips pushed forward    hand  "open" | "fist"
       hk/hx/hy the weapon hand on its own path: at hx,hy (units, from the shoulder) with weight hk (0 = follow aim)
       twist    shoulders turned away from the foe (-) or into the blow (+)    loose  the string hand flying back after a shot
       arms: true on a clip = in fights the clip moves the arms too (not just the body), so its own arc plays
     Each key is [t, controls, ease]; ease is how the move arrives at that key ("in" speeds up into a blow,
     "out" brakes after it, "io" both, "back" overshoots a little). hit = the contact moment (0..1): the fight scene
     plays its hit effects (gorefx2, sparks, numbers) then, and the clip is time-warped so its contact lands there. */
  const K = (t, c, e) => [t, c, e || "io"];
  const ST = { fn: [5.5, 0], ff: [-5.5, 0] }, WIDE = { fn: [8, 0], ff: [-7.5, 0] };
  const CLIPS = {
    idle: { len: 2.6, loop: true, keys: [K(0, { aim: -0.55, back: 0.12, lean: 0.02, dy: 0, tilt: 0.02, ...ST }), K(0.5, { aim: -0.5, back: 0.18, lean: 0.035, dy: 0.35, tilt: 0, ...ST }), K(1, { aim: -0.55, back: 0.12, lean: 0.02, dy: 0, tilt: 0.02, ...ST })] },
    ready: { len: 1.6, loop: true, keys: [K(0, { aim: -0.6, back: -0.45, lean: 0.08, dy: 1.2, hipx: 0.6, ...WIDE }), K(0.5, { aim: -0.52, back: -0.4, lean: 0.1, dy: 1.6, hipx: 0.8, ...WIDE }), K(1, { aim: -0.6, back: -0.45, lean: 0.08, dy: 1.2, hipx: 0.6, ...WIDE })] },
    walk: { len: 1.0, loop: true, walk: true, keys: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => { const p = i / 8 * Math.PI * 2, s = Math.sin(p), c = Math.cos(p);
      return K(i / 8, { fn: [1 + 7.2 * s, -Math.max(0, c) * 3], ff: [1 - 7.2 * s, -Math.max(0, -c) * 3], dy: 0.9 * Math.abs(s) - 0.4, lean: 0.06, aim: 0.95 - 0.38 * s, back: -0.35 + 0.42 * s, tilt: 0.02 * c, cape: 0.6 + 0.4 * Math.abs(c) }, "lin"); }) },
    /* one-handed swing, with the arm on its own path (hk/hx/hy: the hand at hx,hy from the shoulder): the hand lifts
       up past the face to above and behind the head while the blade lays back over the shoulder (never across the head),
       the shoulders turn away (twist) and the weight sinks onto the back foot; then the hand goes up over the head and
       down in front, the blade turning through upright to forward-down, the shoulders and hips turning in and the weight
       driving onto the front foot; a short follow-through, then back to guard */
    swing: { len: 0.95, hit: 0.44, arms: true, keys: [K(0, { aim: -0.55, back: 0.1, lean: 0.02, ...ST }),
      K(0.14, { aim: -1.0, hk: 0.9, hx: 6, hy: -20, back: -0.3, lean: -0.04, twist: -0.4, hipx: -0.6, dy: 0.8, tilt: -0.02, fn: [6, 0], ff: [-6, 0] }, "out"),
      K(0.3, { aim: -2.8, hk: 1, hx: -4, hy: -16, back: -0.6, lean: -0.12, twist: -1, hipx: -1.4, dy: 1.4, tilt: -0.06, fn: [7, 0], ff: [-6.5, 0] }, "io"),
      K(0.37, { aim: -0.97, hk: 1, hx: 4, hy: -20, back: -0.3, lean: 0.04, twist: -0.2, hipx: 0.4, dy: 1.5, fn: [9, 0], ff: [-6, 0] }, "in"),
      K(0.41, { aim: 0.19, hk: 1, hx: 15, hy: -10, back: 0.1, lean: 0.18, twist: 0.5, hipx: 1.6, dy: 1.7, tilt: 0.04, fn: [10.5, 0], ff: [-5.5, 0] }, "lin"),
      K(0.44, { aim: 0.95, hk: 1, hx: 14, hy: 5, back: 0.35, lean: 0.24, twist: 0.8, hipx: 2.2, dy: 1.8, tilt: 0.08, fn: [10.5, 0], ff: [-5, 0] }, "lin"),
      K(0.6, { aim: 1.25, hk: 0.6, hx: 10, hy: 10, back: 0.25, lean: 0.2, twist: 0.6, hipx: 2, dy: 1.6, fn: [10.5, 0], ff: [-5, 0] }, "out"), K(1, { aim: -0.55, back: 0.1, lean: 0.02, ...ST }, "io")] },
    /* a thrust (dagger, spear, fists): a short coil, a long step in, back out */
    thrust: { len: 0.85, hit: 0.32, keys: [K(0, { aim: -0.55, back: 0.1, lean: 0.02, ...ST }), K(0.18, { aim: -0.9, back: 0.2, lean: -0.06, dy: 1.4, fn: [5, 0], ff: [-7, 0] }, "out"),
      K(0.32, { aim: 0.2, back: -0.3, lean: 0.26, dy: 2, hipx: 3, tilt: 0.06, fn: [12, 0], ff: [-5, 0] }, "in"), K(0.5, { aim: -0.2, back: -0.2, lean: 0.16, dy: 1.6, hipx: 2.2, fn: [12, 0], ff: [-5, 0] }, "out"),
      K(1, { aim: -0.55, back: 0.1, lean: 0.02, ...ST }, "io")] },
    /* power attack: the same path as the swing but loaded harder: a step back, a deeper coil, a lunging blow with the
       whole body, a heavy recovery */
    power: { len: 1.25, hit: 0.5, arms: true, keys: [K(0, { aim: -0.55, back: 0.1, lean: 0.02, ...ST }),
      K(0.16, { aim: -1.0, hk: 0.85, hx: 6, hy: -17, back: -0.3, lean: -0.08, twist: -0.5, hipx: -0.8, dy: 1.6, fn: [4, 0], ff: [-8, 0] }, "out"),
      K(0.36, { aim: -3.0, hk: 1, hx: -5, hy: -15, back: -0.7, lean: -0.22, twist: -1.1, hipx: -1.8, dy: 2.4, tilt: -0.1, fn: [5, 0], ff: [-9, 0] }, "io"),
      K(0.43, { aim: -0.97, hk: 1, hx: 4, hy: -21, back: -0.3, lean: 0.06, twist: -0.2, hipx: 0.8, dy: 2.4, fn: [9, 0], ff: [-8, 0] }, "in"),
      K(0.47, { aim: 0.2, hk: 1, hx: 15, hy: -10, back: 0.1, lean: 0.26, twist: 0.6, hipx: 2.6, dy: 2.8, tilt: 0.06, fn: [13, 0], ff: [-6.5, 0] }, "lin"),
      K(0.5, { aim: 1.25, hk: 1, hx: 14, hy: 7, back: 0.5, lean: 0.4, twist: 1, hipx: 4, dy: 3.2, tilt: 0.12, fn: [14, 0], ff: [-6, 0] }, "lin"),
      K(0.7, { aim: 1.35, hk: 0.6, hx: 10, hy: 11, back: 0.4, lean: 0.34, twist: 0.7, hipx: 3.6, dy: 3, fn: [14, 0], ff: [-6, 0] }, "out"), K(1, { aim: -0.55, back: 0.1, lean: 0.02, ...ST }, "io")] },
    /* two-handed swing: both hands on the grip, the same overhead path with a wider stance and a falling cut */
    swing2h: { len: 1.15, hit: 0.5, two: true, arms: true, keys: [K(0, { aim: -0.8, lean: 0.02, ...ST }),
      K(0.18, { aim: -1.0, hk: 0.85, hx: 6, hy: -17, lean: -0.06, twist: -0.4, hipx: -0.6, dy: 1, ...WIDE }, "out"),
      K(0.36, { aim: -2.9, hk: 1, hx: -5, hy: -15, lean: -0.2, twist: -1, hipx: -1.6, dy: 1.8, tilt: -0.08, fn: [8, 0], ff: [-8, 0] }, "io"),
      K(0.43, { aim: -0.97, hk: 1, hx: 3, hy: -21, lean: 0.05, twist: -0.2, hipx: 0.6, dy: 2, fn: [10, 0], ff: [-7.5, 0] }, "in"),
      K(0.47, { aim: 0.2, hk: 1, hx: 14, hy: -11, lean: 0.22, twist: 0.5, hipx: 2, dy: 2.6, tilt: 0.05, fn: [12, 0], ff: [-7, 0] }, "lin"),
      K(0.5, { aim: 1.0, hk: 1, hx: 13, hy: 6, lean: 0.36, twist: 0.9, hipx: 3, dy: 3, tilt: 0.1, fn: [12, 0], ff: [-7, 0] }, "lin"),
      K(0.72, { aim: 1.2, hk: 0.6, hx: 9, hy: 11, lean: 0.3, twist: 0.6, hipx: 2.6, dy: 2.6, fn: [12, 0], ff: [-7, 0] }, "out"), K(1, { aim: -0.8, lean: 0.02, ...ST }, "io")] },
    block: { len: 0.6, hit: 0.3, front: true, keys: [K(0, { aim: -0.55, back: 0.1, ...ST }), K(0.3, { aim: -0.6, back: -1.6, lean: -0.08, dy: 1.6, hipx: -0.6, ...WIDE }, "out"), K(1, { aim: -0.6, back: -1.55, lean: -0.06, dy: 1.4, ...WIDE })] },
    /* shield bash: tuck the shield, drive the shoulder in, punch it out */
    bash: { len: 0.85, hit: 0.42, front: true, keys: [K(0, { aim: -0.55, back: 0.1, ...ST }), K(0.25, { aim: -0.5, back: -0.7, lean: -0.1, dy: 1.6, fn: [5, 0], ff: [-8, 0] }, "out"),
      K(0.42, { aim: -0.5, back: -1.75, lean: 0.3, dy: 2, hipx: 3, fn: [12, 0], ff: [-5, 0] }, "in"), K(0.6, { aim: -0.5, back: -1.6, lean: 0.2, dy: 1.6, hipx: 2.4, fn: [12, 0], ff: [-5, 0] }, "out"), K(1, { aim: -0.55, back: 0.1, ...ST })] },
    /* bow: raise the bow on a straight arm, nock, draw the string hand back to the cheek, hold, loose (the string hand
       flies back past the ear), lower. back < -0.25 raises the bow arm (rig.js lines the arrow up with the cheek);
       the times match the fight replay's bow move, so no time-warp (nowarp) */
    bow: { len: 1.05, hit: 0.53, bow: true, arms: true, nowarp: true, keys: [K(0, { aim: 0, back: 0, draw: 0, ...ST }),
      K(0.15, { aim: -0.05, back: -0.9, draw: 0.08, lean: 0, twist: -0.2, ...WIDE }),
      K(0.42, { aim: -0.06, back: -1.0, draw: 1, lean: -0.06, dy: 0.8, tilt: 0.04, twist: -0.6, hipx: -0.4, ...WIDE }), K(0.5, { aim: -0.06, back: -1.0, draw: 1, lean: -0.06, dy: 0.8, tilt: 0.04, twist: -0.6, hipx: -0.4, ...WIDE }),
      K(0.53, { aim: -0.1, back: -1.0, draw: 0, loose: 1, lean: -0.1, dy: 0.7, twist: -0.7, hipx: -0.6, ...WIDE }, "out"),
      K(0.7, { aim: -0.08, back: -0.95, draw: 0, loose: 0.8, lean: -0.06, dy: 0.6, twist: -0.4, ...WIDE }, "out"), K(1, { aim: 0, back: 0, draw: 0, ...ST })] },
    /* spell: gather in both hands, thrust the casting hand out */
    cast: { len: 1.0, hit: 0.64, hand: "open", keys: [K(0, { aim: -0.55, back: 0.1, ...ST }), K(0.3, { aim: -1.5, back: -1.4, lean: -0.1, dy: 1, cast: 0.6, ...WIDE }, "out"),
      K(0.44, { aim: -1.6, back: -1.5, lean: -0.12, dy: 1.2, cast: 1, ...WIDE }), K(0.64, { aim: -0.2, back: -0.3, lean: 0.16, dy: 1.4, hipx: 1.6, cast: 1, fn: [10, 0], ff: [-6, 0] }, "in"),
      K(0.8, { aim: -0.3, back: -0.2, lean: 0.08, dy: 1, cast: 0.3, fn: [10, 0], ff: [-6, 0] }, "out"), K(1, { aim: -0.55, back: 0.1, ...ST })] },
    /* hit (played by real time after the blow, ~0.4 s): [riglayers] the weapon arm is thrown out forward, never the blade across the face; the head snaps back first, the body follows and the near foot
       steps back to catch the weight, the head comes forward a touch past upright (the follow-through), then settles */
    hit: { len: 0.42, hit: 0, keys: [K(0, { aim: -0.55, back: 0.1, ...ST }),
      K(0.1, { aim: -0.4, back: 0.6, lean: -0.16, tilt: -0.5, dy: 0.5, ...ST }, "out"),
      K(0.32, { aim: -0.25, back: 0.95, lean: -0.32, tilt: -0.34, dy: 1.2, hipx: -1.2, fn: [2.5, 0], ff: [-8.5, 0] }, "out"),
      K(0.62, { aim: -0.45, back: 0.4, lean: 0.06, tilt: 0.08, dy: 1, hipx: -0.6, fn: [3, 0], ff: [-8, 0] }, "io"),
      K(1, { aim: -0.55, back: 0.1, lean: 0.02, tilt: 0.02, dy: 0.3, fn: [4.5, 0], ff: [-6.5, 0] }, "io")] },
    /* stagger (a hard blow, ~0.6 s): the head whips, the body is thrown back, two stumbling steps, then it rights itself */
    stagger: { len: 0.6, hit: 0, keys: [K(0, { aim: -0.55, back: 0.1, ...ST }),
      K(0.08, { aim: -0.35, back: 0.8, lean: -0.24, tilt: -0.6, dy: 0.8, ...ST }, "out"),
      K(0.3, { aim: -0.2, back: 1.1, lean: -0.42, tilt: -0.36, ox: -2, dy: 1.8, hipx: -1.6, fn: [2, -2], ff: [-9, 0] }, "out"),
      K(0.55, { aim: -0.3, back: 0.9, lean: -0.26, tilt: -0.2, ox: -4, dy: 2.2, hipx: -1, fn: [-2, 0], ff: [-10, -1.5] }),
      K(0.78, { aim: -0.45, back: 0.4, lean: 0.08, tilt: 0.1, ox: -5, dy: 1.4, fn: [-1, 0], ff: [-11, 0] }),
      K(1, { aim: -0.55, back: 0.1, ox: -5, lean: 0.02, ...ST }, "io")] },
    /* knocked down: buckle at the knees, fall back, lie there (followers, horses and you only ever go down) */
    down: { len: 0.9, hold: true, hand: "open", keys: [K(0, { aim: -0.55, back: 0.1, ...ST }), K(0.25, { aim: -1.4, back: 1, lean: -0.3, tilt: -0.25, dy: 4, ox: -2, fn: [4, 0], ff: [-6, 0] }, "out"),
      K(1, { rot: -Math.PI / 2, aim: 1.4, back: 0.5, fn: [4, -4], ff: [-1, 0], tilt: 0.25 }, "in")] },
    /* getting up: roll onto a knee, push up, stand */
    getup: { len: 1.1, hand: "open", keys: [K(0, { rot: -Math.PI / 2, aim: 1.4, back: 0.5, fn: [4, -4], ff: [-1, 0], tilt: 0.25 }), K(0.3, { rot: -1.1, aim: 1.2, back: 0.6, lean: 0.3, dy: 6, fn: [5, -2], ff: [-2, 0], tilt: 0.2 }, "out"), K(0.5, { aim: 0.4, back: 0.9, lean: 0.55, dy: 13, ox: -1, fn: [8, 0], ff: [-6, 0], tilt: 0.1 }, "io"),
      K(0.7, { aim: -0.2, back: 0.4, lean: 0.25, dy: 5, fn: [7, 0], ff: [-6, 0] }), K(1, { aim: -0.55, back: 0.1, ...ST }, "out")] },
    /* death (foes only): the knees go, a twist, down on the back and still */
    death: { len: 1.4, hold: true, hand: "open", keys: [K(0, { aim: -0.55, back: 0.1, ...ST }), K(0.2, { aim: -1.8, back: 1.2, lean: -0.35, tilt: -0.35, ox: -2, dy: 3, fn: [5, 0], ff: [-6, 0] }, "out"),
      K(0.45, { aim: -0.4, back: 0.8, lean: -0.1, tilt: 0.2, dy: 9, ox: -3, fn: [7, 0], ff: [-3, 0] }, "in"), K(0.8, { rot: -Math.PI / 2, aim: 1.9, back: 1.2, fn: [3, -3], ff: [0, -1], tilt: 0.45 }, "in"),
      K(0.9, { rot: -Math.PI / 2 - 0.06, aim: 2.0, back: 1.3, fn: [3, -3.4], ff: [0, -1], tilt: 0.5 }, "out"), K(1, { rot: -Math.PI / 2, aim: 2.0, back: 1.3, fn: [3, -3], ff: [0, -1], tilt: 0.5 })] },
    /* in the saddle: the bent legs straddle the horse, fists forward on the reins, the body rides the gait */
    ride: { len: 0.6, loop: true, ride: true, hand: "fist", keys: [0, 1, 2, 3, 4].map((i) => { const b = Math.sin(i / 4 * Math.PI * 4); return K(i / 4, { dy: -12 + b * 0.6, ox: -3, lean: 0.1 + b * 0.03, aim: 0.55, back: -0.25, tilt: -b * 0.02 }, "io"); }) },
    sit: { len: 1, hold: true, keys: [K(0, { dy: 15, fn: [11, 0], ff: [9, 0], aim: 0.6, back: -0.3, lean: 0.04 })] },
  };
  /* what the fight replay's moves become: the arms follow the replay's own numbers (so the weapon trail and the hit
     effects stay where the scene puts them); the body, legs, hips and head follow these clips. */
  const MOVE_CLIP = { sword: "swing", dagger: "thrust", axe: "swing", mace: "swing", club: "swing", fist: "thrust", spear: "thrust", greatsword: "swing2h", battleaxe: "swing2h", warhammer: "swing2h",
    bow: "bow", crossbow: "bow", bash: "bash", block: "block", cast: "cast", staff: "cast", self: "cast", drain: "cast", shout: "cast", potion: "idle", wait: "idle" };
  return { RES, PARTS, SETS, HEADS, CLIPS, MOVE_CLIP, file, headFile };
})();
if (typeof module !== "undefined") module.exports = RIGDATA;
