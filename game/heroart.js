/* Hero art: your character drawn from the save — race, the gear you wear, enchantment glow, vampire eyes —
   in the shared ART style (hand-drawn ink, or pixel art). Drawn in a 160×220 box and scaled.
   HEROART.figure(saveOrCard, w, h) → <img> html; HEROART.portrait(saveOrCard, size) → round head-and-shoulders <img>;
   HEROART.lookOf(save) → the small "what you look like" object shared on your player card. [OURS] */
const HEROART = (() => {
  const P = () => ART.PAL;
  // ---- races ([Skyrim] looks): skin, hair choices, head build
  const RACE = {
    nord: { skin: ["#ecc9a8", "#e2b894"], hair: ["#d9b56a", "#b27b3c", "#8a5a34", "#e8d9a8"], beard: 0.6, ears: "round", h: 1.03, w: 1.04 },
    imperial: { skin: ["#d9ab82", "#c99a6e"], hair: ["#3b2c1e", "#5a3e26", "#2a2420"], beard: 0.3, ears: "round", h: 1, w: 1 },
    breton: { skin: ["#f0d2b6", "#e6c3a2"], hair: ["#5a3e26", "#8a5a34", "#2a2420", "#a8622e"], beard: 0.25, ears: "round", h: 0.98, w: 0.97 },
    redguard: { skin: ["#7a4e33", "#6a4129"], hair: ["#1c1714", "#2a2420"], beard: 0.35, ears: "round", h: 1.01, w: 1.02 },
    altmer: { skin: ["#e3cf8a", "#d8c27a"], hair: ["#f0e3b0", "#c9a75e", "#7d6230"], beard: 0, ears: "elf", h: 1.07, w: 0.95 },
    bosmer: { skin: ["#b5864f", "#a7794a"], hair: ["#5a3e26", "#3b2c1e", "#8a5a34"], beard: 0, ears: "elf", h: 0.92, w: 0.95 },
    dunmer: { skin: ["#7d8a92", "#6e7b84"], hair: ["#1c1714", "#8e2b25", "#3b2c1e"], beard: 0.1, ears: "elf", h: 1, w: 0.98, eyes: "#c4372e" },
    orc: { skin: ["#7f9a5c", "#6f8a4f"], hair: ["#1c1714", "#2a2420"], beard: 0.4, ears: "orc", h: 1.03, w: 1.12 },
    khajiit: { skin: ["#c9944e", "#b8a07a", "#8a6a48"], hair: ["#6b4a2e", "#3b2c1e"], beard: 0, ears: "cat", h: 0.99, w: 1, eyes: "#d6b25e", tail: true },
    argonian: { skin: ["#6f8a5a", "#5f7f6a", "#7a8a4a"], hair: [], beard: 0, ears: "lizard", h: 1, w: 1, eyes: "#e8c24a", tail: true },
  };
  // ---- materials ([Skyrim] armour sets, as colours)
  const MAT = {
    hide: { c: "#8a6a48", d: "#5e4630", trim: "#c9b48f" }, leather: { c: "#7a5232", d: "#553823", trim: "#a87a50" },
    iron: { c: "#6f6a64", d: "#4d4945", trim: "#8f8a84" }, steel: { c: "#a9b0b4", d: "#7d858a", trim: "#d0d5d8" },
    chain: { c: "#8d949a", d: "#646a70", trim: "#b5bbc0" }, dwarven: { c: "#c08a3c", d: "#8f6328", trim: "#e0b060" },
    elven: { c: "#c9a75e", d: "#8f7a3c", trim: "#e8d48a" }, nord: { c: "#5e6b5a", d: "#3f4a3d", trim: "#8a9480" },
    forsworn: { c: "#6b4a2e", d: "#4a3220", trim: "#a8442e" }, guild: { c: "#3b3330", d: "#262120", trim: "#6b5640" },
    robe: { c: "#5a4a7a", d: "#3d3256", trim: "#c9a75e" }, arch: { c: "#2f3a6a", d: "#1f274a", trim: "#d6b25e" },
    cloth: { c: "#b9a07a", d: "#8f7a5a", trim: "#d8c6a0" }, wood: { c: "#7a5232", d: "#553823", trim: "#a87a50" },
    ebony: { c: "#3a3138", d: "#221c22", trim: "#6a5a6a" },
  };
  const baseOf = (id) => (id && id.startsWith("ench|") ? id.split("|")[1] : id);
  /* which material an item is made of */
  function matOf(id) {
    id = baseOf(id) || "";
    if (/^archmage/.test(id)) return "arch"; if (/robe/.test(id)) return "robe"; if (/^guild/.test(id)) return "guild";
    if (/^wuuthrad/.test(id)) return "ebony"; if (/^dwarven|crossbow_dwarven/.test(id)) return "dwarven"; if (/^elven/.test(id)) return "elven";
    if (/^ancient_nord/.test(id)) return "nord"; if (/^forsworn/.test(id)) return "forsworn"; if (/^chainmail/.test(id)) return "chain";
    if (/^steel/.test(id)) return "steel"; if (/^hide/.test(id)) return "hide"; if (/^leather/.test(id)) return "leather";
    if (/^(hunting_bow|long_bow|staff_|crossbow)/.test(id)) return "wood"; if (/^iron/.test(id)) return "iron";
    return "iron";
  }
  /* what to draw for a weapon */
  function weaponKind(id) {
    id = baseOf(id) || "";
    if (!id) return null;
    if (/^staff_/.test(id)) return "staff"; if (/crossbow/.test(id)) return "crossbow";
    if (/^wuuthrad/.test(id)) return "battleaxe";
    return G.wtype(id);
  }
  const ELEMENT = { fire: "#e8923a", flames: "#e8923a", frost: "#9fd0f0", shock: "#c9b6ff", sparks: "#c9b6ff", absorb: "#c4372e", sun: "#f3e7a4" };
  function staffColor(id) { const sp = D.SPELLS[D.ITEMS[id]?.staff?.spell]; return ELEMENT[sp?.element] || (sp?.kind === "reanimate" ? "#8fd08a" : sp?.kind === "turn" ? "#f3e7a4" : "#c9b6ff"); }

  /* the little object that says how someone looks (also sent on player cards) */
  function lookOf(s) {
    const eq = {}, gl = {};
    try {
      for (const [slot, id] of Object.entries(G.loadout(s).equipment || {})) {
        const r = G.invRow(s, id); if (!r) continue;
        eq[slot] = baseOf(r.item);
        const it = D.ITEMS[r.item];
        if (it?.enchant) gl.w = it.enchant.effect; if (it?.aenchant) gl.a = 1;
      }
    } catch { /* bare save */ }
    return { r: s.race, id: s.id || s.name || "x", eq, gl, v: s.vampire ? 1 : 0, ww: s.werewolf ? 1 : 0 };
  }
  const lookFrom = (src) => (src?.look ? src.look : src?.loadouts ? lookOf(src) : { r: src?.race || "nord", id: src?.id || src?.name || "x", eq: {}, gl: {} });
  const keyOf = (L) => JSON.stringify([L.r, L.id, L.eq, L.gl, L.v, L.ww]);

  // ---------------------------------------------------------------- drawing (160×220 box)
  function draw(g, H, L) {
    const pal = P(), race = RACE[L.r] || RACE.nord, rnd = ART.seeded(L.id + L.r);
    const skin = L.v ? "#d8d3cc" : race.skin[Math.floor(rnd() * race.skin.length)];
    const hairC = race.hair.length ? race.hair[Math.floor(rnd() * race.hair.length)] : null;
    const beard = rnd() < race.beard, hairStyle = String(L.id).startsWith("preview") ? 0 : [0, 0, 1, 2, 2, 0, 1, 3][Math.floor(rnd() * 8)], paint = rnd() < 0.3 ? ["#1c2128", "#2f4f8a", "#8e2b25"][Math.floor(rnd() * 3)] : null;
    const eq = L.eq || {};
    const chest = eq.chest, head = eq.head, hands = eq.hands, feet = eq.feet, shield = eq.shield, weapon = eq.weapon;
    const cm = chest ? MAT[matOf(chest)] : MAT.cloth, robe = chest && /robe/.test(chest);
    const heavy = chest && D.ITEMS[chest]?.type === "heavy";
    const legC = robe ? cm : heavy ? cm : chest ? MAT[matOf(chest)] : { c: "#6b5640", d: "#4d3c2c", trim: "#8f7a66" };
    const ink = pal.ink;

    // ground shadow
    g.fillStyle = "rgba(59,44,30,0.25)"; g.beginPath(); g.ellipse(80, 208, 38, 6, 0, 0, Math.PI * 2); g.fill();
    // build: scale around the feet
    g.save(); g.translate(80, 206); g.scale(race.w, race.h); g.translate(-80, -206);

    // tail (behind)
    if (race.tail) {
      g.strokeStyle = ink; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(90, 132); g.quadraticCurveTo(122, 150, 116, 186); g.stroke();
      g.strokeStyle = L.r === "khajiit" ? skin : skin; g.lineWidth = 6.5; g.beginPath(); g.moveTo(90, 132); g.quadraticCurveTo(122, 150, 116, 186); g.stroke();
      if (L.r === "khajiit") { g.fillStyle = "#5e4630"; g.beginPath(); g.arc(116, 186, 3.5, 0, 7); g.fill(); }
    }
    // a staff stands behind the body
    const wk = weaponKind(weapon);
    if (wk === "staff") drawStaff(g, H, weapon, L.gl.w);
    if (wk === "bow") drawBow(g, H, weapon, L.gl.w);

    // legs
    H.poly(g, [[66, 126], [79, 126], [78, 192], [66, 192]], legC.c, ink, 1.4);
    H.poly(g, [[81, 126], [94, 126], [94, 192], [82, 192]], legC.c, ink, 1.4);
    if (heavy) { g.strokeStyle = legC.d; g.lineWidth = 1.2; for (const y of [148, 168]) { g.beginPath(); g.moveTo(67, y); g.lineTo(77, y); g.moveTo(83, y); g.lineTo(93, y); g.stroke(); } H.circle(g, 72, 160, 3, legC.trim, ink, 1); H.circle(g, 88, 160, 3, legC.trim, ink, 1); }
    // feet / boots
    const bm = feet ? MAT[matOf(feet)] : null;
    for (const x of [64, 82]) {
      if (bm) { H.poly(g, [[x, 182], [x + 14, 182], [x + 15, 196], [x + 17, 202], [x - 1, 202]], bm.c, ink, 1.4); g.strokeStyle = bm.trim; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 1, 184); g.lineTo(x + 13, 184); g.stroke(); if (/^hide/.test(feet)) { g.fillStyle = MAT.hide.trim; g.fillRect(x, 181, 14, 3); } }
      else H.poly(g, [[x + 1, 192], [x + 13, 192], [x + 15, 202], [x, 202]], L.r === "argonian" || L.r === "khajiit" ? skin : "#6b5640", ink, 1.2);
    }
    // robe skirt over the legs
    if (robe) H.poly(g, [[62, 118], [98, 118], [106, 198], [54, 198]], cm.c, ink, 1.5);

    // arms (behind the torso edges)
    const armC = cm, handC = hands ? MAT[matOf(hands)] : null;
    H.poly(g, [[58, 72], [66, 74], [58, 124], [48, 122]], robe ? cm.c : chest ? armC.c : skin, ink, 1.4);
    H.poly(g, [[102, 72], [94, 74], [102, 124], [112, 122]], robe ? cm.c : chest ? armC.c : skin, ink, 1.4);
    if (!chest) { g.fillStyle = MAT.cloth.c; H.poly(g, [[58, 72], [66, 74], [63, 92], [53, 90]], MAT.cloth.c, ink, 1.2); H.poly(g, [[102, 72], [94, 74], [97, 92], [107, 90]], MAT.cloth.c, ink, 1.2); }
    // forearms / gauntlets
    for (const [x1, x2, x3, x4] of [[50, 59, 56, 46], [110, 101, 104, 114]]) {
      if (handC) { H.poly(g, [[x1, 106], [x2, 108], [x3, 126], [x4, 124]], handC.c, ink, 1.3); g.strokeStyle = handC.trim; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, 108); g.lineTo(x2, 110); g.stroke(); }
    }
    H.circle(g, 50, 128, 5.5, handC ? handC.c : skin, ink, 1.3);
    H.circle(g, 108, 128, 5.5, handC ? handC.c : skin, ink, 1.3);

    // torso
    H.poly(g, [[56, 70], [104, 70], [98, 126], [62, 126]], cm.c, ink, 1.6);
    if (!chest) { // roughspun tunic
      g.strokeStyle = MAT.cloth.d; g.lineWidth = 1; for (let y = 82; y < 124; y += 9) { g.beginPath(); g.moveTo(62, y); g.lineTo(98, y + 1); g.stroke(); }
      H.poly(g, [[61, 114], [99, 114], [98, 122], [62, 122]], "#6b5640", ink, 1);
    } else if (robe) {
      H.poly(g, [[74, 70], [86, 70], [82, 126], [78, 126]], cm.trim, null); g.strokeStyle = cm.trim; g.lineWidth = 3; g.beginPath(); g.moveTo(62, 110); g.lineTo(98, 110); g.stroke();
    } else {
      const m = matOf(chest);
      if (m === "chain") { g.fillStyle = cm.d; for (let y = 76; y < 122; y += 5) for (let x = 60 + ((y / 5) % 2) * 2.5; x < 100; x += 5) { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); } }
      if (m === "hide" || m === "forsworn") { H.poly(g, [[56, 70], [104, 70], [100, 80], [60, 80]], MAT.hide.trim, ink, 1.2); if (m === "forsworn") { g.strokeStyle = cm.trim; g.lineWidth = 2; for (const x of [64, 80, 96]) { g.beginPath(); g.moveTo(x, 80); g.lineTo(x - 3, 96); g.stroke(); } } }
      if (["iron", "steel", "dwarven", "elven", "nord"].includes(m)) {
        H.poly(g, [[62, 76], [98, 76], [94, 104], [66, 104]], cm.trim, ink, 1.2);   // breastplate
        H.poly(g, [[50, 66], [66, 66], [64, 80], [50, 80]], cm.d, ink, 1.2); H.poly(g, [[94, 66], [110, 66], [110, 80], [96, 80]], cm.d, ink, 1.2);   // pauldrons
        if (m === "iron") { g.fillStyle = "#3b2c1e"; for (const [x, y] of [[66, 80], [94, 80], [80, 100]]) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); } }
        if (m === "dwarven") { H.circle(g, 80, 90, 6, cm.c, ink, 1.2); g.strokeStyle = cm.d; g.beginPath(); g.moveTo(80, 84); g.lineTo(80, 96); g.moveTo(74, 90); g.lineTo(86, 90); g.stroke(); }
        if (m === "elven") { H.poly(g, [[80, 78], [90, 92], [80, 102], [70, 92]], "#8fb070", ink, 1); }
        if (m === "nord") { g.strokeStyle = cm.d; g.lineWidth = 1.4; for (const y of [84, 92, 100]) { g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(80, y + 4, 96, y); g.stroke(); } }
      }
      if (m === "leather" || m === "guild") { g.strokeStyle = cm.trim; g.lineWidth = 2; g.beginPath(); g.moveTo(58, 72); g.lineTo(98, 120); g.stroke(); H.circle(g, 72, 88, 2, cm.trim, null); H.circle(g, 86, 104, 2, cm.trim, null); }
      H.poly(g, [[61, 112], [99, 112], [98, 120], [62, 120]], m === "guild" ? "#1c1714" : "#4d3c2c", ink, 1);   // belt
      H.poly(g, [[76, 112], [84, 112], [84, 120], [76, 120]], P().gold, ink, 0.8);
    }
    if (L.gl.a) glow(g, 80, 98, 34, "#9fd0f0", 0.25);

    // neck and head
    H.poly(g, [[74, 58], [86, 58], [86, 71], [74, 71]], skin, ink, 1.3);
    drawHead(g, H, L, race, skin, hairC, beard, hairStyle, paint, head, robe);

    g.restore();
    // weapon in the hand and the shield on the arm (unscaled offsets are fine)
    if (wk && wk !== "staff" && wk !== "bow") drawWeapon(g, H, weapon, wk, L.gl.w, race);
    if (shield) drawShield(g, H, shield, race);
    if (L.ww) { g.fillStyle = "rgba(90,60,30,0.5)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(60 + i * 8, 70 + (i % 2) * 3, 3, 0, 7); g.fill(); } }
  }

  function drawHead(g, H, L, race, skin, hairC, beard, hairStyle, paint, head, robe) {
    const ink = P().ink, cx = 80, cy = 44;
    // ears behind
    if (race.ears === "elf") { H.poly(g, [[66, 42], [56, 30], [67, 50]], skin, ink, 1.2); H.poly(g, [[94, 42], [104, 30], [93, 50]], skin, ink, 1.2); }
    if (race.ears === "orc") { H.poly(g, [[66, 42], [60, 36], [66, 50]], skin, ink, 1.2); H.poly(g, [[94, 42], [100, 36], [94, 50]], skin, ink, 1.2); }
    if (race.ears === "round") { H.circle(g, 66, 45, 3.5, skin, ink, 1.1); H.circle(g, 94, 45, 3.5, skin, ink, 1.1); }
    // long hair behind the head
    if (hairC && !head && !robe && hairStyle === 2 && race.ears !== "cat") H.poly(g, [[64, 36], [96, 36], [100, 66], [60, 66]], hairC, ink, 1.2);
    // the head
    if (race.ears === "lizard") {
      H.poly(g, [[66, 30], [94, 30], [98, 48], [90, 62], [70, 62], [62, 48]], skin, ink, 1.5);
      for (const [x, y] of [[70, 34], [78, 30], [86, 30], [92, 34], [74, 40], [86, 40]]) { g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
      if (!head && !robe) for (const x of [66, 72, 80, 88, 94]) H.poly(g, [[x - 3, 30], [x, 18 + (x % 3) * 2], [x + 3, 30]], "#4d6a44", ink, 1);   // horns and frills
      g.fillStyle = ink; g.beginPath(); g.arc(77, 56, 1, 0, 7); g.arc(83, 56, 1, 0, 7); g.fill();
    } else {
      g.beginPath(); g.ellipse(cx, cy, race.ears === "orc" ? 15.5 : 14, 16, 0, 0, Math.PI * 2); g.fillStyle = skin; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
      if (race.ears === "cat") {
        H.poly(g, [[67, 34], [66, 18], [76, 30]], skin, ink, 1.2); H.poly(g, [[93, 34], [94, 18], [84, 30]], skin, ink, 1.2);
        g.fillStyle = "#e8d6b8"; g.beginPath(); g.ellipse(80, 53, 7, 5, 0, 0, 7); g.fill();
        H.poly(g, [[78, 49], [82, 49], [80, 52]], "#3b2c1e", null);
        g.strokeStyle = ink; g.lineWidth = 0.8; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(80 + s * 4, 53); g.lineTo(80 + s * 13, 51); g.moveTo(80 + s * 4, 55); g.lineTo(80 + s * 13, 56); g.stroke(); }
        g.strokeStyle = "rgba(59,44,30,0.4)"; g.lineWidth = 1.5; for (const x of [74, 80, 86]) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 36); g.stroke(); }
      }
    }
    // eyes
    const eyeC = L.v ? "#e0302a" : race.eyes || "#3b4a5a";
    for (const x of [74, 86]) {
      g.fillStyle = "#f4f0e6"; g.beginPath(); g.ellipse(x, 44, 3, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = eyeC; g.beginPath(); (race.ears === "cat" || race.ears === "lizard") ? g.ellipse(x, 44, 0.9, 2.1, 0, 0, 7) : g.arc(x, 44, 1.5, 0, 7); g.fill();
    }
    if (L.v) { g.fillStyle = "rgba(224,48,42,0.25)"; g.beginPath(); g.arc(74, 44, 4.5, 0, 7); g.arc(86, 44, 4.5, 0, 7); g.fill(); }
    // brows, nose, mouth
    g.strokeStyle = ink; g.lineWidth = 1.2;
    if (race.ears !== "lizard" && race.ears !== "cat") { g.beginPath(); g.moveTo(70, 39); g.lineTo(77, 40); g.moveTo(83, 40); g.lineTo(90, 39); g.moveTo(80, 45); g.lineTo(79, 51); g.lineTo(81, 51); g.stroke(); }
    g.beginPath(); g.moveTo(75, 56); g.quadraticCurveTo(80, race.ears === "orc" ? 57 : 58, 85, 56); g.stroke();
    if (race.ears === "orc") { H.poly(g, [[74, 57], [75, 51], [77, 57]], "#f4f0e6", ink, 0.8); H.poly(g, [[83, 57], [85, 51], [86, 57]], "#f4f0e6", ink, 0.8); }
    if (paint) { g.fillStyle = paint; g.globalAlpha = 0.6; g.fillRect(67, 42, 26, 4); g.globalAlpha = 1; }
    // beard
    if (beard && hairC) H.poly(g, [[68, 50], [72, 58], [80, 68], [88, 58], [92, 50], [90, 62], [80, 72], [70, 62]], hairC, ink, 1.1);
    // hair on top (no helmet)
    if (hairC && !head && !robe && hairStyle !== 3 && race.ears !== "cat") {
      g.beginPath(); g.ellipse(80, 33, 15, 9, 0, Math.PI, Math.PI * 2); g.lineTo(95, 38); g.quadraticCurveTo(80, 30, 65, 38); g.closePath(); g.fillStyle = hairC; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
      if (hairStyle === 1) { g.strokeStyle = hairC; g.lineWidth = 4; g.beginPath(); g.moveTo(94, 40); g.quadraticCurveTo(100, 54, 96, 66); g.stroke(); }   // braid
    }
    // helmet / hood
    if (robe && !head) {
      const rm = MAT[/^archmage/.test(L.eq.chest) ? "arch" : "robe"];
      g.beginPath(); g.moveTo(62, 60); g.quadraticCurveTo(58, 24, 80, 22); g.quadraticCurveTo(102, 24, 98, 60); g.quadraticCurveTo(92, 40, 80, 38); g.quadraticCurveTo(68, 40, 62, 60); g.fillStyle = rm.c; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = rm.trim; g.lineWidth = 1.5; g.beginPath(); g.moveTo(64, 56); g.quadraticCurveTo(80, 34, 96, 56); g.stroke();
    }
    if (head) drawHelmet(g, H, head);
  }

  function drawHelmet(g, H, id) {
    const ink = P().ink, m = matOf(id), c = MAT[m];
    if (/coif/.test(id)) { g.beginPath(); g.moveTo(63, 62); g.quadraticCurveTo(58, 24, 80, 24); g.quadraticCurveTo(102, 24, 97, 62); g.quadraticCurveTo(92, 42, 80, 40); g.quadraticCurveTo(68, 42, 63, 62); g.fillStyle = c.c; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke(); g.fillStyle = c.d; for (let y = 30; y < 60; y += 5) for (let x = 64; x < 97; x += 5) if (Math.abs(x - 80) > 10 || y < 38) { g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill(); } return; }
    if (m === "hide" || m === "leather") {   // fur cap / leather hood-cap
      g.beginPath(); g.ellipse(80, 34, 16, 12, 0, Math.PI, Math.PI * 2); g.lineTo(96, 40); g.lineTo(64, 40); g.closePath(); g.fillStyle = c.c; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = m === "hide" ? MAT.hide.trim : c.trim; g.fillRect(63, 36, 34, 5); g.strokeRect(63, 36, 34, 5); return;
    }
    // metal helmets: dome + brim (+ extras)
    g.beginPath(); g.ellipse(80, 36, 16.5, 15, 0, Math.PI, Math.PI * 2); g.lineTo(96.5, 42); g.lineTo(63.5, 42); g.closePath(); g.fillStyle = c.c; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = c.d; g.fillRect(63, 38, 34, 4); g.strokeRect(63, 38, 34, 4);
    if (m === "iron") { H.poly(g, [[64, 32], [52, 18], [56, 30], [62, 38]], "#e8dcc0", ink, 1.2); H.poly(g, [[96, 32], [108, 18], [104, 30], [98, 38]], "#e8dcc0", ink, 1.2); }   // [Skyrim] the horned iron helmet
    if (m === "steel") { H.poly(g, [[78, 40], [82, 40], [81, 52], [79, 52]], c.d, ink, 1); H.poly(g, [[63, 42], [69, 42], [68, 56], [63, 52]], c.c, ink, 1); H.poly(g, [[97, 42], [91, 42], [92, 56], [97, 52]], c.c, ink, 1); }
    if (m === "nord") { H.poly(g, [[64, 32], [50, 24], [60, 36]], c.trim, ink, 1); H.poly(g, [[96, 32], [110, 24], [100, 36]], c.trim, ink, 1); H.poly(g, [[63, 42], [69, 42], [70, 58], [63, 54]], c.c, ink, 1); H.poly(g, [[97, 42], [91, 42], [90, 58], [97, 54]], c.c, ink, 1); }
    if (m === "dwarven") { H.poly(g, [[76, 22], [84, 22], [82, 12], [78, 12]], c.trim, ink, 1); H.poly(g, [[62, 42], [98, 42], [96, 58], [88, 50], [72, 50], [64, 58]], c.c, ink, 1.2); }
    if (m === "elven") { H.poly(g, [[70, 26], [80, 8], [90, 26]], c.trim, ink, 1.2); H.poly(g, [[63, 42], [68, 42], [66, 56]], c.c, ink, 1); H.poly(g, [[97, 42], [92, 42], [94, 56]], c.c, ink, 1); }
  }

  function glow(g, x, y, r, color, a = 0.45) {
    const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1;
  }
  function drawWeapon(g, H, id, wk, ench, race) {
    const ink = P().ink, m = MAT[matOf(id)], hx = 50, hy = 128;
    const blade = [MAT.wood, MAT.forsworn, MAT.hide, MAT.leather].includes(m) ? { c: "#d8cdb0", d: "#a89a78", trim: "#e8dfc8" } : m;   // wood, bone and stone blades
    if (ench) glow(g, hx - 14, hy - 40, 30, ELEMENT[ench] || "#c9b6ff");
    g.save(); g.translate(hx, hy); g.rotate(-0.35);
    const grip = (len) => { H.poly(g, [[-2.5, 6], [2.5, 6], [2.5, -len], [-2.5, -len]], MAT.leather.c, ink, 1.1); };
    if (wk === "dagger") { grip(6); H.poly(g, [[-7, -6], [7, -6], [7, -9], [-7, -9]], blade.d, ink, 1); H.poly(g, [[-3.5, -9], [3.5, -9], [0, -30]], blade.trim, ink, 1.2); }
    else if (wk === "sword" || wk === "greatsword") {
      const L = wk === "greatsword" ? 78 : 56, w = wk === "greatsword" ? 5 : 4;
      grip(wk === "greatsword" ? 12 : 7); const top = wk === "greatsword" ? -12 : -7;
      H.poly(g, [[-10, top], [10, top], [10, top - 4], [-10, top - 4]], blade.d, ink, 1);
      H.poly(g, [[-w, top - 4], [w, top - 4], [w, top - L + 6], [0, top - L], [-w, top - L + 6]], blade.trim, ink, 1.3);
      g.strokeStyle = blade.d; g.lineWidth = 1; g.beginPath(); g.moveTo(0, top - 6); g.lineTo(0, top - L + 8); g.stroke();
    } else if (wk === "axe" || wk === "battleaxe") {
      const L = wk === "battleaxe" ? 70 : 50; H.poly(g, [[-2.5, 6], [2.5, 6], [2.5, -L], [-2.5, -L]], MAT.wood.c, ink, 1.1);
      const s = wk === "battleaxe" ? 1.4 : 1;
      H.poly(g, [[2, -L + 2], [2 + 18 * s, -L - 8 * s], [2 + 20 * s, -L + 14 * s], [2, -L + 14]], blade.trim, ink, 1.3);
      if (wk === "battleaxe") H.poly(g, [[-2, -L + 2], [-2 - 18 * s, -L - 8 * s], [-2 - 20 * s, -L + 14 * s], [-2, -L + 14]], blade.trim, ink, 1.3);
    } else if (wk === "mace" || wk === "warhammer") {
      H.poly(g, [[-2.5, 6], [2.5, 6], [2.5, -40], [-2.5, -40]], MAT.wood.c, ink, 1.1);
      H.circle(g, 0, -46, 8, blade.trim, ink, 1.3); for (let a = 0; a < 6; a++) H.poly(g, [[Math.cos(a) * 7, -46 + Math.sin(a) * 7], [Math.cos(a) * 12, -46 + Math.sin(a) * 12], [Math.cos(a + 0.4) * 7, -46 + Math.sin(a + 0.4) * 7]], blade.d, ink, 0.8);
    } else if (wk === "spear") {
      H.poly(g, [[-2, 30], [2, 30], [2, -84], [-2, -84]], MAT.wood.c, ink, 1.1); H.poly(g, [[-5, -84], [5, -84], [0, -104]], blade.trim, ink, 1.2);
    } else if (wk === "crossbow") {   // held level, pointing out to the side
      g.rotate(0.35);
      const pc = /dwarven/.test(id) ? MAT.dwarven : MAT.iron;
      H.poly(g, [[6, -4], [-34, -4], [-34, 3], [6, 3]], /dwarven/.test(id) ? MAT.dwarven.d : MAT.wood.c, ink, 1.2);
      g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.moveTo(-30, -20); g.quadraticCurveTo(-40, 0, -30, 20); g.stroke();
      g.strokeStyle = pc.trim; g.lineWidth = 3; g.beginPath(); g.moveTo(-30, -20); g.quadraticCurveTo(-40, 0, -30, 20); g.stroke();
      g.strokeStyle = "#e8dcc0"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-30, -20); g.lineTo(-18, 0); g.lineTo(-30, 20); g.stroke();
      H.poly(g, [[-16, -1.5], [-38, -1.5], [-42, 0], [-38, 1.5], [-16, 1.5]], "#d8cdb0", null);
    } else { grip(7); H.poly(g, [[-4, -7], [4, -7], [4, -50], [0, -56], [-4, -50]], blade.trim, ink, 1.3); }
    g.restore();
  }
  function drawBow(g, H, id, ench) {
    const ink = P().ink, m = MAT[matOf(id)], c = /^(elven)/.test(id) ? MAT.elven.c : /^dwarven/.test(id) ? MAT.dwarven.c : /^ancient_nord/.test(id) ? MAT.nord.c : MAT.wood.c;
    if (ench) glow(g, 40, 128, 34, ELEMENT[ench] || "#c9b6ff");
    g.strokeStyle = ink; g.lineWidth = 5.5; g.beginPath(); g.moveTo(46, 76); g.quadraticCurveTo(24, 128, 46, 180); g.stroke();
    g.strokeStyle = c; g.lineWidth = 3.5; g.beginPath(); g.moveTo(46, 76); g.quadraticCurveTo(24, 128, 46, 180); g.stroke();
    g.strokeStyle = "#e8dcc0"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(46, 76); g.lineTo(46, 180); g.stroke();
    // a quiver on the back
    H.poly(g, [[102, 62], [110, 60], [116, 104], [108, 106]], MAT.leather.c, ink, 1.2); for (const x of [104, 108, 112]) { g.strokeStyle = "#a8442e"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 62); g.lineTo(x + 1, 54); g.stroke(); }
  }
  function drawStaff(g, H, id, ench) {
    const ink = P().ink, c = staffColor(id);
    H.poly(g, [[44, 200], [48, 200], [42, 40], [38, 40]], MAT.wood.c, ink, 1.2);
    glow(g, 40, 32, 18, c, 0.7); H.circle(g, 40, 32, 6, c, ink, 1.2);
    g.strokeStyle = MAT.wood.d; g.lineWidth = 2; g.beginPath(); g.moveTo(36, 44); g.quadraticCurveTo(32, 32, 38, 24); g.moveTo(44, 44); g.quadraticCurveTo(48, 32, 42, 24); g.stroke();
  }
  function drawShield(g, H, id) {
    const ink = P().ink, m = matOf(id), c = MAT[m];
    if (m === "steel" || m === "dwarven" || m === "elven") {   // kite shield
      H.poly(g, [[100, 96], [128, 96], [128, 126], [114, 148], [100, 126]], c.c, ink, 1.6);
      H.poly(g, [[104, 100], [124, 100], [124, 124], [114, 142], [104, 124]], c.trim, null); g.strokeStyle = c.d; g.lineWidth = 2; g.beginPath(); g.moveTo(114, 100); g.lineTo(114, 140); g.moveTo(104, 114); g.lineTo(124, 114); g.stroke();
    } else {   // round shield
      H.circle(g, 114, 120, 18, m === "hide" ? MAT.wood.c : c.c, ink, 1.6);
      if (m === "hide") { g.strokeStyle = MAT.wood.d; g.lineWidth = 1; for (const x of [106, 114, 122]) { g.beginPath(); g.moveTo(x, 103); g.lineTo(x, 137); g.stroke(); } g.strokeStyle = MAT.hide.trim; g.lineWidth = 3; g.beginPath(); g.arc(114, 120, 17, 0, 7); g.stroke(); }
      else { g.strokeStyle = c.d; g.lineWidth = 3; g.beginPath(); g.arc(114, 120, 13, 0, 7); g.stroke(); }
      H.circle(g, 114, 120, 4.5, c.trim || "#8f8a84", ink, 1.1);
    }
  }

  // ---------------------------------------------------------------- public
  function figure(src, w = 160, h = 220, opts = {}) {
    const L = lookFrom(src);
    return ART.html(w, h, (g, H) => {
      if (!opts.bare) {
        if (ART.style() === "pixel") { g.fillStyle = "#eeccaa"; g.fillRect(0, 0, w, h); g.fillStyle = "#ccaa88"; g.fillRect(0, h * 0.86, w, h * 0.14); }   // flat colours the pixel filter keeps as they are
        else { H.parchment(g, w, h, 7); g.fillStyle = "rgba(59,44,30,0.10)"; g.fillRect(0, h * 0.86, w, h * 0.14); }
      }
      const k = Math.min(w / 160, h / 220); g.translate((w - 160 * k) / 2, h - 220 * k); g.scale(k, k);
      draw(g, H, L);
    }, { key: "hero|" + keyOf(L) + (opts.bare ? "|b" : ""), alt: `${D.RACES[L.r]?.name || ""} character`, cls: opts.cls || "herofig" });
  }
  function portrait(src, size = 40) {
    const L = lookFrom(src);
    return ART.html(size, size, (g, H) => {
      g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.clip();
      g.fillStyle = ART.PAL.parchDark; g.fillRect(0, 0, size, size);
      const k = size / 64; g.scale(k, k); g.translate(-48, -12); draw(g, H, L); g.restore();
      g.strokeStyle = ART.PAL.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.stroke();
    }, { key: "port|" + keyOf(L) + "|" + size, alt: "", cls: "heroport" });
  }
  return { figure, portrait, lookOf, matOf, weaponKind, RACE, MAT };
})();
