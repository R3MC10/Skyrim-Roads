/* SkyUI touches that need a little script: the perk constellation above each skill's perk list (like Skyrim's
   skill trees: stars joined by lines, growing upward; lit stars are perks you have, bright-outlined ones you can
   take now). Tapping a star brings its perk row into view. Nothing here changes game state. [OURS] */
const SKYUI = (() => {
  const W = 360, ROW = 46;
  function seeded(str) { let a = 0; for (const ch of str) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const esc = (s) => String(s).replace(/[<>&"]/g, "");
  function layout(tree) {
    const depth = {}, byId = Object.fromEntries(tree.map((p) => [p[0], p]));
    const d = (id, seen = new Set()) => {
      if (depth[id] != null) return depth[id];
      if (seen.has(id)) return 0; seen.add(id);
      const needs = (byId[id]?.[4] || []).filter((n) => byId[n]);
      return (depth[id] = needs.length ? 1 + Math.max(...needs.map((n) => d(n, seen))) : 0);
    };
    tree.forEach((p) => d(p[0]));
    const rows = {}; tree.forEach((p) => (rows[depth[p[0]]] = rows[depth[p[0]]] || []).push(p[0]));
    // [OURS] bigger trees: each depth is ordered by where its parents sit (fewer crossing lines), then split into
    // lines of at most 4 stars, kept away from the edges so labels never run off or collide
    const pos = {}, lines = [];
    const depths = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const px = {};   // provisional x of each placed star, for ordering the next depth
    const place = (ids) => { const gap = ids.length > 1 ? Math.min(92, (W - 150) / (ids.length - 1)) : 0; ids.forEach((id, i) => { px[id] = W / 2 + (i - (ids.length - 1) / 2) * gap; }); };
    for (const k of depths) {
      const ids = rows[k].slice();
      const want = (id) => { const ps = (byId[id]?.[4] || []).filter((n) => px[n] != null); return ps.length ? ps.reduce((a, n) => a + px[n], 0) / ps.length : W / 2; };
      ids.sort((a, b) => want(a) - want(b));
      for (let i = 0; i < ids.length; i += 4) { const chunk = ids.slice(i, i + 4); place(chunk); lines.push(chunk); }
    }
    const H = 40 + lines.length * ROW;
    lines.forEach((ids, k) => ids.forEach((id, i) => {
      const jog = ids.length > 2 ? (i % 2 ? -7 : 7) : 0;   // a little zig-zag so long lines read as a constellation
      pos[id] = [Math.round(px[id]), Math.round(H - 26 - k * ROW + jog), 1];
    }));
    return { pos, H, byId };
  }
  function svg(skill, s) {
    const tree = PERKS.TREES[skill]; if (!tree || !tree.length) return "";
    const { pos, H, byId } = layout(tree), r = seeded(skill);
    let bg = ""; for (let i = 0; i < 46; i++) bg += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(0.4 + r() * 0.9).toFixed(2)}" fill="#cfd8ea" opacity="${(0.25 + r() * 0.5).toFixed(2)}" ${r() < 0.3 ? 'class="twinkle"' : ""}/>`;
    let lines = "";
    for (const p of tree) for (const n of p[4] || []) if (pos[n]) { const on = PERKS.rank(s, p[0]) > 0 && PERKS.rank(s, n) > 0; lines += `<line x1="${pos[n][0]}" y1="${pos[n][1]}" x2="${pos[p[0]][0]}" y2="${pos[p[0]][1]}" class="${on ? "on" : ""}"/>`; }
    let stars = "";
    tree.forEach((p, i) => {
      const [x, y, up] = pos[p[0]], rk = PERKS.rank(s, p[0]), can = !PERKS.canTake(s, p[0]) && rk < p[2];
      const label = p[1].length > 14 ? p[1].slice(0, 13) + "…" : p[1];
      stars += `<g class="st ${rk ? "on" : ""} ${can ? "can" : ""}" data-sk-perk="${i}" role="button" tabindex="0" aria-label="${esc(p[1])}${rk ? " (taken)" : can ? " (can take)" : ""}">
        <circle class="glow" cx="${x}" cy="${y}" r="14"/><circle cx="${x}" cy="${y}" r="16" fill="transparent"/>
        <circle class="core" cx="${x}" cy="${y}" r="${rk ? 4.2 : 3.2}"/>${can ? `<circle cx="${x}" cy="${y}" r="7.5" fill="none" stroke="#cfe3ff" stroke-width="1" stroke-dasharray="2 2"/>` : ""}
        <text class="lbl" x="${x}" y="${up < 0 ? y - 11 : y + 17}" text-anchor="middle">${esc(label)}${p[2] > 1 ? ` ${rk}/${p[2]}` : ""}</text></g>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" aria-label="${esc(skill)} perk stars"><defs><radialGradient id="skglow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#bcd6ff" stop-opacity=".35"/><stop offset="1" stop-color="#bcd6ff" stop-opacity="0"/></radialGradient></defs>${bg}${lines}${stars}</svg>`;
  }
  /* after each panel draw: put the stars above the perk list of the chosen skill */
  function decorate(root) {
    const s = window.__dbg?.save?.(); if (!s || typeof PERKS === "undefined") return;
    const chip = root.querySelector('.chip.on[data-act="pskill"]'); if (!chip) return;
    const skill = chip.dataset.id, chips = chip.parentElement;
    if (chips.scrollWidth > chips.clientWidth && !chips.dataset.scrolled) { chips.scrollLeft = Math.max(0, chip.offsetLeft - chips.clientWidth / 2 + chip.offsetWidth / 2); chips.dataset.scrolled = "1"; }
    const key = skill + "|" + JSON.stringify((PERKS.TREES[skill] || []).map((p) => PERKS.rank(s, p[0]))) + "|" + (PERKS.pointsLeft?.(s) ?? "");
    const old = chips.nextElementSibling?.classList.contains("skc") ? chips.nextElementSibling : null;
    if (old && old.dataset.key === key) return;
    const div = document.createElement("div"); div.className = "skc"; div.dataset.key = key; div.innerHTML = svg(skill, s);
    if (old) old.replaceWith(div); else chips.after(div);
  }
  let pending = false;
  function init() {
    const side = document.getElementById("side"); if (!side || side.dataset.skyui) return;
    side.dataset.skyui = "1";
    new MutationObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; try { decorate(side); } catch (e) { /* never break the game for decoration */ } }); }).observe(side, { childList: true, subtree: true });
    decorate(side);
  }
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function" && typeof requestAnimationFrame === "function";
  if (live) document.addEventListener("click", (e) => {
    const st = e.target.closest?.("[data-sk-perk]"); if (!st) return;
    const box = st.closest(".skc"), list = box?.parentElement?.querySelector(".skc ~ .list") || box?.nextElementSibling;
    const row = list?.children?.[+st.dataset.skPerk]; if (!row) return;
    row.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    row.classList.remove("skflash"); void row.offsetWidth; row.classList.add("skflash");
  });
  const boot = () => { init(); if (!document.getElementById("side")) setTimeout(boot, 400); };
  if (live) {
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
    setInterval(() => { const side = document.getElementById("side"); if (side && !side.dataset.skyui) init(); }, 1000);
  }
  return { svg, layout, decorate };
})();
