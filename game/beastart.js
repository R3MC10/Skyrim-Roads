/* Werewolf and Vampire Lord art [OURS]: the two forms in the fight scene (drawn in the same canvas units as
   fightart.js's people: feet at 0, about 60 tall, facing right), and the perk constellations for both trees
   (the Werewolf's and the Vampire Lord's own skies, like Skyrim's). Works in both art styles: the fight canvas
   is pixelated as a whole in pixel style, and the constellations use the same SkyUI look as the skill trees. */
const BEASTART = (() => {
  const H = ART.H, INK = ART.PAL.ink;
  const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

  // ------------------------------------------------------------ the forms
  /* a werewolf: hunched on two legs, long arms with claws, a wolf's head with a snout and ears */
  function wolf(g, o = {}) {
    const lunge = o.lunge || 0, fur = "#4a4038", furL = "#6a5c50", bob = Math.sin((o.t || 0) * 5) * 0.8;
    g.save(); g.lineJoin = "round"; g.lineCap = "round"; g.scale(1.22, 1.22);
    // legs: digitigrade, bent backwards
    for (const [hx, kx, fx] of [[-4, -12, -6], [4, -2, 8]]) {
      g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(hx, -26); g.lineTo(kx, -13); g.lineTo(fx, 0); g.stroke();
      g.strokeStyle = fur; g.lineWidth = 5.4; g.beginPath(); g.moveTo(hx, -26); g.lineTo(kx, -13); g.lineTo(fx, 0); g.stroke();
    }
    g.rotate(0.28 + lunge * 0.25);
    // tail
    H.poly(g, [[-8, -28], [-24, -22 + bob], [-20, -16], [-8, -22]], furL, INK, 1.2);
    // back arm
    g.strokeStyle = INK; g.lineWidth = 6.5; g.beginPath(); g.moveTo(-4, -46); g.lineTo(-12, -30); g.lineTo(-8, -18); g.stroke();
    g.strokeStyle = fur; g.lineWidth = 4.2; g.beginPath(); g.moveTo(-4, -46); g.lineTo(-12, -30); g.lineTo(-8, -18); g.stroke();
    // torso: a big chest, ribs of shaggy fur
    H.poly(g, [[-10, -24], [-13, -46], [-4, -55], [10, -52], [12, -36], [8, -24]], fur, INK, 1.5);
    g.strokeStyle = furL; g.lineWidth = 1.2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-8 + i * 4, -50 + i); g.lineTo(-6 + i * 4, -44 + i); g.stroke(); }
    // head: snout forward, ears up, glowing eyes
    const hx = 9, hy = -58;
    H.poly(g, [[hx - 7, hy + 5], [hx - 8, hy - 4], [hx - 3, hy - 8], [hx + 4, hy - 6], [hx + 15, hy - 1], [hx + 15, hy + 3], [hx + 4, hy + 6]], fur, INK, 1.4);
    H.poly(g, [[hx - 5, hy - 6], [hx - 6, hy - 15], [hx - 1, hy - 8]], furL, INK, 1.1);
    H.poly(g, [[hx + 1, hy - 7], [hx + 2, hy - 15], [hx + 5, hy - 6]], furL, INK, 1.1);
    g.fillStyle = "#e8e0c8"; for (let i = 0; i < 3; i++) g.fillRect(hx + 7 + i * 2.6, hy + 2.4, 1.4, 2 + lunge * 1.5);   // fangs
    g.fillStyle = "#ffd23a"; g.shadowColor = "#ffb000"; g.shadowBlur = 6; g.fillRect(hx + 2, hy - 4, 3, 2); g.shadowBlur = 0;
    // front arm with claws, reaching on a lunge
    const ang = -0.3 + lunge * 1.3;
    g.save(); g.translate(6, -48); g.rotate(ang);
    g.strokeStyle = INK; g.lineWidth = 6.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 12); g.lineTo(18, 16); g.stroke();
    g.strokeStyle = fur; g.lineWidth = 4.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 12); g.lineTo(18, 16); g.stroke();
    g.strokeStyle = "#e8e0c8"; g.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(18, 16 + i * 2); g.lineTo(24, 17 + i * 3.5); g.stroke(); }
    g.restore();
    g.restore();
  }
  /* a Vampire Lord: tall, grey-skinned, bat wings spread behind, red eyes, a ragged cape */
  function lord(g, o = {}) {
    const lunge = o.lunge || 0, t = o.t || 0, flap = Math.sin(t * 3) * 0.12, skin = "#8e8a92", dark = "#3a2a3a";
    g.save(); g.lineJoin = "round"; g.lineCap = "round"; g.scale(1.25, 1.25);
    // wings
    for (const side of [-1, 1]) {
      g.save(); g.translate(-2, -48); g.rotate(side * (0.15 + flap) - 0.1);
      H.poly(g, [[0, 0], [-10 * 1, -18], [-30, -24], [-40, -10], [-32, -6], [-28, 4], [-18, -2], [-12, 8], [-4, 4]], side < 0 ? "#2e2230" : "#3d2c3f", INK, 1.3);
      g.strokeStyle = "#5a4658"; g.lineWidth = 1; for (const [x, y] of [[-30, -24], [-40, -10], [-28, 4], [-12, 8]]) { g.beginPath(); g.moveTo(-4, -2); g.lineTo(x, y); g.stroke(); }
      g.restore();
    }
    // legs
    g.strokeStyle = INK; g.lineWidth = 7.5; g.beginPath(); g.moveTo(-2, -26); g.lineTo(-9, 0); g.moveTo(2, -26); g.lineTo(9, 0); g.stroke();
    g.strokeStyle = dark; g.lineWidth = 4.8; g.beginPath(); g.moveTo(-2, -26); g.lineTo(-9, 0); g.moveTo(2, -26); g.lineTo(9, 0); g.stroke();
    g.rotate(lunge * 0.2);
    // ragged loincloth / cape
    H.poly(g, [[-10, -30], [10, -30], [12, -14], [6, -18], [2, -10], [-4, -17], [-10, -12]], "#5a1820", INK, 1.2);
    // torso: gaunt ribs
    H.poly(g, [[-9, -28], [-11, -50], [11, -50], [9, -28]], skin, INK, 1.5);
    g.strokeStyle = "#6a6670"; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-7, -44 + i * 5); g.quadraticCurveTo(0, -42 + i * 5, 7, -44 + i * 5); g.stroke(); }
    // head: pointed ears, a bald skull, red eyes
    const hx = 1, hy = -58;
    H.poly(g, [[hx - 7, hy - 1], [hx - 12, hy - 8], [hx - 5, hy - 5]], skin, INK, 1.1);
    H.poly(g, [[hx + 6, hy - 1], [hx + 11, hy - 9], [hx + 4, hy - 5]], skin, INK, 1.1);
    H.circle(g, hx, hy, 7, skin, INK, 1.4);
    g.fillStyle = "#ff2a2a"; g.shadowColor = "#ff0000"; g.shadowBlur = 8; g.fillRect(hx + 1, hy - 2, 3, 2); g.fillRect(hx - 4, hy - 2, 3, 2); g.shadowBlur = 0;
    g.fillStyle = "#e8e0d8"; g.fillRect(hx - 1, hy + 3, 1.2, 2.4); g.fillRect(hx + 2, hy + 3, 1.2, 2.4);
    // arms: long clawed fingers, the front one reaching to drain
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(-6, -46); g.lineTo(-12, -32); g.lineTo(-10, -22); g.stroke();
    g.strokeStyle = skin; g.lineWidth = 3.8; g.beginPath(); g.moveTo(-6, -46); g.lineTo(-12, -32); g.lineTo(-10, -22); g.stroke();
    g.save(); g.translate(7, -46); g.rotate(-0.6 + lunge * 1.2);
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 10); g.lineTo(20, 10); g.stroke();
    g.strokeStyle = skin; g.lineWidth = 3.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 10); g.lineTo(20, 10); g.stroke();
    g.strokeStyle = "#e8e0d8"; g.lineWidth = 1.2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(20, 10 + i * 2); g.lineTo(26, 10 + i * 3.5); g.stroke(); }
    g.restore();
    g.restore();
  }
  /* the red thread of a drain from the Lord's hand to the foe (fight scene, screen coordinates) */
  function drain(g, x0, y0, x1, y1, u, t) {
    g.save(); g.globalAlpha = 0.75 * Math.sin(Math.min(1, u) * Math.PI);
    g.strokeStyle = "#e02a3a"; g.lineWidth = 2.4; g.shadowColor = "#ff2040"; g.shadowBlur = 10;
    g.beginPath(); for (let i = 0; i <= 16; i++) { const k = i / 16, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k + Math.sin(k * 9 + t * 12) * 4 * Math.sin(k * Math.PI); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------ perk constellations
  const W = 360, HT = 300;
  function seeded(str) { let a = 11; for (const ch of str) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pos = (p) => [Math.round(20 + p[4] / 100 * (W - 40)), Math.round(16 + p[5] / 100 * (HT - 32))];
  /* the sky for one tree: stars you have glow white, stars you can take now get a dashed ring */
  function svg(S, tree) {
    const T = CURSE.TREES[tree]; if (!T) return "";
    const r = seeded(tree), tint = tree === "wolf" ? "#cfd8ea" : "#f0c8d0";
    let bg = ""; for (let i = 0; i < 52; i++) bg += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * HT).toFixed(1)}" r="${(0.4 + r() * 0.9).toFixed(2)}" fill="${tint}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`;
    // the beast's outline behind the stars, faint: a wolf's head, or bat wings
    const shape = tree === "wolf"
      ? `<path d="M110 250 L120 150 L150 70 L175 120 L205 120 L230 70 L250 150 L262 250 Z" fill="none" stroke="${tint}" stroke-opacity=".10" stroke-width="2"/>`
      : `<path d="M180 230 L150 150 L40 90 L80 170 L30 200 L120 190 L180 260 L240 190 L330 200 L280 170 L320 90 L210 150 Z" fill="none" stroke="${tint}" stroke-opacity=".10" stroke-width="2"/>`;
    let lines = "", stars = "";
    for (const p of T.perks) for (const n of p[3]) { const q = T.perks.find((x) => x[0] === n); if (!q) continue; const [x1, y1] = pos(q), [x2, y2] = pos(p), on = CURSE.rank(S, tree, p[0]) && CURSE.rank(S, tree, n); lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${on ? "on" : ""}"/>`; }
    for (const p of T.perks) {
      const [x, y] = pos(p), rk = CURSE.rank(S, tree, p[0]), can = !CURSE.canTake(S, tree, p[0]);
      const label = p[1].length > 16 ? p[1].slice(0, 15) + "…" : p[1];
      stars += `<g class="st ${rk ? "on" : ""} ${can ? "can" : ""}" data-act="bpick" data-id="${tree}:${p[0]}" role="button" tabindex="0" aria-label="${esc(p[1])}${rk ? " (taken)" : can ? " (can take)" : ""}">
        <circle class="glow" cx="${x}" cy="${y}" r="14"/><circle cx="${x}" cy="${y}" r="16" fill="transparent"/>
        <circle class="core" cx="${x}" cy="${y}" r="${rk ? 4.2 : 3.2}"/>${can ? `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#cfe3ff" stroke-width="1" stroke-dasharray="2 2"/>` : ""}
        <text class="lbl" x="${x}" y="${y + 17}" text-anchor="middle">${esc(label)}${p[2] > 1 ? ` ${rk}/${p[2]}` : ""}</text></g>`;
    }
    return `<svg viewBox="0 0 ${W} ${HT}" aria-label="${esc(T.name)} perk stars">${bg}${shape}${lines}${stars}</svg>`;
  }
  /* the whole tree block: progress, the sky, and the chosen star's card */
  let pick = null;   // the star tapped last, "tree:id"
  function panel(S, tree, pk = pick) {
    const pickNow = pk;
    const T = CURSE.TREES[tree]; if (!T) return "";
    const pts = CURSE.points(S, tree), nx = CURSE.nextAt(S, tree), have = tree === "wolf" ? (S.beastPerks?.feeds || 0) : (S.beastPerks?.kills || 0);
    const unit = tree === "wolf" ? "feeds" : "Lord kills";
    const p = pickNow && pickNow.startsWith(tree + ":") ? T.perks.find((x) => x[0] === pickNow.split(":")[1]) : null;
    let card = `<p class="sub">Tap a star to read its perk.${tree === "wolf" ? " Werewolf perks grow by feeding: win a fight in Beast Form against a person." : " Vampire Lord perks grow with every fight you win as a Vampire Lord."}</p>`;
    if (p) {
      const rk = CURSE.rank(S, tree, p[0]), err = rk < p[2] ? CURSE.canTake(S, tree, p[0]) : "";
      card = `<div class="tw-perk bperk"><h3>${esc(p[1])} ${p[2] > 1 ? `<span class="num">${rk}/${p[2]}</span>` : rk ? "✓" : ""}</h3><p>${esc(p[6])}</p>
        ${rk < p[2] ? `<button class="btn ${err ? "" : "pri"}" data-act="bperk" data-id="${tree}:${esc(p[0])}" ${err ? "disabled" : ""}>${err ? esc(err) : "Take this perk"}</button>` : `<p class="sub">You have this perk.</p>`}</div>`;
    }
    return `<div class="bstars"><div class="tw-shead"><div><b>${T.icon} ${esc(T.name)}</b> <span class="sub num">${have} ${unit}${nx ? ` · next point at ${nx}` : ""}</span></div><div class="${pts > 0 ? "gold" : "sub"}">${pts} point${pts === 1 ? "" : "s"}</div></div>
      <div class="skc bsky ${tree}">${svg(S, tree)}</div>${card}</div>`;
  }
  /* small card for the compass Skills carousel */
  function mini(S, tree, w = 96, h = 64) {
    const T = CURSE.TREES[tree]; if (!T) return "";
    let lines = "", stars = "";
    const P = (p) => [(8 + p[4] / 100 * (w - 16)).toFixed(1), (6 + p[5] / 100 * (h - 12)).toFixed(1)];
    for (const p of T.perks) for (const n of p[3]) { const q = T.perks.find((x) => x[0] === n); if (q) { const a = P(q), b = P(p); lines += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${CURSE.rank(S, tree, p[0]) && CURSE.rank(S, tree, n) ? "on" : ""}"/>`; } }
    for (const p of T.perks) { const [x, y] = P(p), on = CURSE.rank(S, tree, p[0]); stars += `<circle cx="${x}" cy="${y}" r="${on ? 2.6 : 1.5}" class="${on ? "on" : ""}"/>`; }
    return `<svg class="tw-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines}${stars}</svg>`;
  }
  const NAMES = { wolf: "Werewolf", lord: "Vampire Lord" };
  const treeOf = (name) => Object.keys(NAMES).find((k) => NAMES[k] === name) || null;
  function card(S, tree, on) {
    const taken = CURSE.TREES[tree].perks.filter((p) => CURSE.rank(S, tree, p[0])).length, pts = CURSE.points(S, tree);
    return `<button class="tw-card bcard ${on ? "on" : ""}" data-twa="skill" data-id="${NAMES[tree]}" aria-pressed="${on}">${mini(S, tree)}<b>${NAMES[tree]}</b><span class="num">${CURSE.TREES[tree].icon}${taken ? ` · ★${taken}` : ""}${pts ? ` · +${pts}` : ""}</span></button>`;
  }
  return { wolf, lord, drain, svg, panel, mini, card, NAMES, treeOf, get pick() { return pick; }, set pick(v) { pick = v; } };
})();
