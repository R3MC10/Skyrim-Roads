/* The Tab menu, like Skyrim's: a four-way compass over a blurred view of where you are. Swipe or tap a direction:
   left = Magic, right = Items, up = Skills (constellations, character sheet, perks, stats), down = Map.
   Along the bottom: level progress, gold, carry weight and what you're doing right now.
   Inside a menu a sideways swipe flips through its tabs; past the last tab it moves on to the next menu round the
   compass, and a swipe down on the header goes back to the compass. Only reads the save and routes to the game's own
   screens, so nothing here changes game rules. [OURS] */
const TABMENU = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const RING = ["char", "items", "map", "magic"];                 // clockwise from the top
  const DIR = { up: "char", right: "items", down: "map", left: "magic" };
  const NAME = { char: "Skills", items: "Items", map: "Map", magic: "Magic" };
  const SUBT = { char: "Character · perks · stats", items: "Weapons · apparel · potions", map: "Travel the world", magic: "Spells · powers · shouts" };
  const CHAR_TABS = [["stars", "Skills"], ["hero", "Character"], ["perks", "Perks"], ["stats", "Stats"], ["diary", "Diary"]];
  const charTabs = () => typeof MENUS !== "undefined" ? MENUS.charTabs() : CHAR_TABS;   // menus.js owns the Character sub-tabs
  const MIN = 40, RATIO = 1.4;
  let MAXMS = 1500;   // a slow drag isn't a swipe

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* which way a finger moved, or null if it wasn't a clear swipe */
  function swipeDir(dx, dy, ms = 0) {
    if (ms > MAXMS) return null;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < MIN) return null;
    if (ax >= ay * RATIO) return dx < 0 ? "left" : "right";
    if (ay >= ax * RATIO) return dy < 0 ? "up" : "down";
    return null;
  }
  /* the next menu round the compass (+1 clockwise, -1 the other way) */
  const ring = (m, step) => RING[(RING.indexOf(m === "skills" ? "char" : m) + step + RING.length * 4) % RING.length];
  /* flip tabs: the new tab id, or {edge: ±1} when there's nothing past this end */
  function step(ids, cur, st) {
    const i = Math.max(0, ids.indexOf(cur)), j = i + st;
    return j < 0 ? { edge: -1 } : j >= ids.length ? { edge: 1 } : { id: ids[j] };
  }
  const fmtMin = (m) => m < 1 ? "under a minute" : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
  function posOf(S) {
    const tr = S.trip;
    if (tr && tr.status === "travel" && typeof G !== "undefined" && G.posAfter) { try { return G.posAfter(S, Math.max(0, G.now() - tr.lastTick)); } catch { /* fall through */ } }
    return [S.x, S.y];
  }
  /* what's shown along the bottom of the compass */
  function bar(S) {
    const need = (S.level + 3) * 25, xp = Math.max(0, Math.round(S.charXp || 0));
    const w = G.carried(S), cap = G.capacity(S);
    return { level: S.level, xp, need, pct: Math.max(0, Math.min(100, Math.round(xp / need * 100))), gold: S.gold, w: Math.round(w), cap: Math.round(cap), over: w > cap,
      perks: (typeof PERKS !== "undefined" ? PERKS.pointsLeft(S) : 0) + (S.pendingLevels || 0), ready: (S.pendingLevels || 0) > 0, task: task(S) };
  }
  function task(S) {
    if (S.dungeon) return { k: "dun", icon: "", text: `Inside ${S.dungeon.place}`, sub: "Tap to go back in", hot: !!S.dungeon.room?.enemy };
    const tr = S.trip;
    if (tr) {
      if (tr.status === "encounter") return { k: "enc", icon: "", text: tr.encounter?.hunt ? ` ${tr.encounter.name} spotted` : `${tr.encounter?.name || "Trouble"} blocks the road`, sub: "Tap to face it", hot: true };
      if (tr.status === "event") return { k: "ev", icon: "", text: "Something by the road", sub: "Tap to take a look" };
      const left = Math.max(0, G.minutesLeft(S) - (tr.status === "travel" ? (G.now() - tr.lastTick) / 60 : 0)), total = Math.max(left, tr.total || left);
      const how = tr.carriage ? "by carriage" : typeof HORSES !== "undefined" && HORSES.riding(S) ? `riding ${S.horse?.name || "your horse"}` : "on foot";
      return { k: "trip", icon: tr.carriage || (typeof HORSES !== "undefined" && HORSES.riding(S)) ? "" : "", text: `${tr.roam ? "Roaming" : "Travelling"} to ${tr.destName}`, sub: `${fmtMin(left)} left · ${how}`, progress: total ? Math.round((total - left) / total * 100) : 0 };
    }
    const qa = typeof QUESTS !== "undefined" ? QUESTS.tracked(S) : null;
    if (qa) { const tg = QUESTS.target(qa.st); return { k: "quest", icon: "", text: qa.def.name, sub: `${qa.st.title || ""}${tg ? ` · ${tg}` : ""}` }; }
    return { k: "idle", icon: "", text: S.location ? `Resting in ${S.location}` : "Out in the wilds", sub: "No task yet · ask around town or open the Journal" };
  }
  /* small seeded constellation for a skill card (stars from its perk tree, lines from what each perk needs) */
  function seeded(str) { let a = 7; for (const ch of str) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mini(skill, S, w = 96, h = 64) {
    const tree = (typeof PERKS !== "undefined" && PERKS.TREES[skill]) || [], r = seeded(skill);
    const n = Math.max(4, tree.length), pts = [];
    for (let i = 0; i < n; i++) pts.push([10 + r() * (w - 20), h - 8 - (i / Math.max(1, n - 1)) * (h - 18) + (r() - 0.5) * 8]);
    let lines = "", stars = "";
    const idx = Object.fromEntries(tree.map((p, i) => [p[0], i]));
    tree.forEach((p, i) => { for (const nd of p[4] || []) if (idx[nd] != null) { const a = pts[idx[nd]], b = pts[i], on = PERKS.rank(S, p[0]) && PERKS.rank(S, nd); lines += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${on ? "on" : ""}"/>`; } });
    if (!tree.length) for (let i = 1; i < n; i++) lines += `<line x1="${pts[i - 1][0].toFixed(1)}" y1="${pts[i - 1][1].toFixed(1)}" x2="${pts[i][0].toFixed(1)}" y2="${pts[i][1].toFixed(1)}"/>`;
    pts.forEach((p, i) => { const on = tree[i] && PERKS.rank(S, tree[i][0]); stars += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${on ? 2.6 : 1.5}" class="${on ? "on" : ""}"/>`; });
    return `<svg class="tw-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines}${stars}</svg>`;
  }

  // ------------------------------------------------------------ panels drawn inside #side (ui.js calls these)
  let starSkill = null, starPick = null;
  function skillOrder(S) { return D.ALL_SKILLS.slice(); }
  function stars(S) {
    const list = skillOrder(S);
    const beastT = typeof BEASTART !== "undefined" && typeof CURSE !== "undefined" && CURSE.trees ? CURSE.trees(S) : [];   // werewolf / Vampire Lord skies
    if (beastT.length && beastT.map((k) => BEASTART.NAMES[k]).includes(starSkill)) return beastStars(S, list, beastT);
    if (!list.includes(starSkill)) starSkill = list.filter((k) => PERKS.TREES[k]).sort((a, b) => S.skills[b].lvl - S.skills[a].lvl)[0] || list[0];
    const sk = starSkill, s = S.skills[sk], need = F.skillXpNeeded(sk, s.lvl), tree = PERKS.TREES[sk] || [];
    const b = bar(S), pts = PERKS.pointsLeft(S);
    const lvl = S.pendingLevels > 0 && typeof LEVELUP !== "undefined" ? LEVELUP.promptHTML(S) : S.pendingLevels > 0 ? `<div class="tw-lvlup"><b>Level up!</b> Choose what grows by 10:<div class="tw-lvbtns"><button class="btn" data-act="lvl" data-a="health">Health</button><button class="btn" data-act="lvl" data-a="magicka">Magicka</button><button class="btn" data-act="lvl" data-a="stamina">Stamina</button></div></div>` : "";
    const cards = list.map((k) => { const v = S.skills[k], n = F.skillXpNeeded(k, v.lvl), taken = (PERKS.TREES[k] || []).filter(([id]) => PERKS.rank(S, id)).length;
      return `<button class="tw-card ${k === sk ? "on" : ""}" data-twa="skill" data-id="${esc(k)}" aria-pressed="${k === sk}">${mini(k, S)}<b>${esc(k)}</b><span class="num">${v.lvl}${taken ? ` · ★${taken}` : ""}</span><i class="tw-cbar"><i style="width:${Math.round(Math.min(1, v.xp / n) * 100)}%"></i></i></button>`; }).join("");
    let detail = "";
    const pk = starPick != null ? tree[starPick] : null;
    if (pk) {
      const [id, name, ranks] = pk, rk = PERKS.rank(S, id), p = PERKS.BY_ID[id], err = rk < ranks ? PERKS.canTake(S, id) : "";
      detail = `<div class="tw-perk"><h3>${esc(name)} ${ranks > 1 ? `<span class="num">${rk}/${ranks}</span>` : rk ? "✓" : ""}</h3><p>${esc(PERKS.nowText ? PERKS.nowText(S, id) : (p.desc || "").replace(/\s*\[[^\]]*\]\s*$/, ""))}</p>
        ${rk < ranks ? `<p class="sub">Needs ${esc(sk)} ${p.req[rk]}${p.needs.length ? ` and ${p.needs.map((x) => esc(PERKS.BY_ID[x]?.name || x)).join(" or ")}` : ""}</p><button class="btn ${err ? "" : "pri"}" data-act="perk" data-id="${esc(id)}" ${err ? "disabled" : ""}>${err ? esc(err) : "Take this perk"}</button>` : `<p class="sub">You have this perk.</p>`}</div>`;
    } else detail = `<p class="sub tw-hint2">${tree.length ? "Tap a star to read its perk. Bright rings are perks you can take now." : "This skill has no perk stars. It still grows as you use it."}</p>`;
    const info = typeof SKILLINFO !== "undefined" ? SKILLINFO.summary?.(sk) : "";
    return `<div class="panel tw-starp"><div class="tw-sleft">${lvl}
      <div class="tw-shead"><div><b>Level ${b.level}</b> <span class="sub num">${b.xp}/${b.need}</span></div><div class="${pts > 0 ? "gold" : "sub"}">${pts} perk point${pts === 1 ? "" : "s"}</div></div>
      <div class="tw-car" role="list">${cards}${beastT.map((k) => BEASTART.card(S, k, false)).join("")}</div>
      <div class="tw-skt"><span class="tw-skn">${typeof UIART !== "undefined" ? UIART.skill(sk, 30) : ""}<b>${esc(sk)}</b> <span class="num">${s.lvl}</span></span><span class="sub num">${Math.round(s.xp)}/${Math.round(need)}</span></div>
      <div class="bar"><i style="width:${Math.round(Math.min(1, s.xp / need) * 100)}%;background:var(--frost)"></i></div>
      ${info ? `<p class="sub">${esc(info)}</p>` : ""}</div>
      ${tree.length && typeof SKYUI !== "undefined" ? `<div class="tw-bigw"><div class="skc tw-big">${SKYUI.svg(sk, S, { sel: starPick })}</div></div>` : ""}
      <div class="tw-sdet${pk ? "" : " hint"}">${detail}</div></div>`;   // tw-sleft / tw-sdet: plain blocks on a phone, the left column beside the stars on a PC (pcfit)
  }
  /* the werewolf's or the Vampire Lord's own sky, chosen from the same row of cards */
  function beastStars(S, list, beastT) {
    const b = bar(S), pts = PERKS.pointsLeft(S), tree = BEASTART.treeOf(starSkill);
    const cards = list.map((k) => { const v = S.skills[k], n = F.skillXpNeeded(k, v.lvl), taken = (PERKS.TREES[k] || []).filter(([id]) => PERKS.rank(S, id)).length;
      return `<button class="tw-card" data-twa="skill" data-id="${esc(k)}" aria-pressed="false">${mini(k, S)}<b>${esc(k)}</b><span class="num">${v.lvl}${taken ? ` · ★${taken}` : ""}</span><i class="tw-cbar"><i style="width:${Math.round(Math.min(1, v.xp / n) * 100)}%"></i></i></button>`; }).join("")
      + beastT.map((k) => BEASTART.card(S, k, k === tree)).join("");
    return `<div class="panel tw-starp">
      <div class="tw-shead"><div><b>Level ${b.level}</b> <span class="sub num">${b.xp}/${b.need}</span></div><div class="${pts > 0 ? "gold" : "sub"}">${pts} perk point${pts === 1 ? "" : "s"}</div></div>
      <div class="tw-car" role="list">${cards}</div>
      ${BEASTART.panel(S, tree)}</div>`;
  }
  function perks(S) {
    const pts = PERKS.pointsLeft(S), can = [], had = {};
    for (const [sk, tree] of Object.entries(PERKS.TREES)) for (const [id, name, ranks] of tree) {
      const rk = PERKS.rank(S, id);
      if (rk) (had[sk] = had[sk] || []).push([id, name, rk, ranks]);
      if (rk < ranks && !PERKS.canTake(S, id)) can.push([sk, id, name, rk, ranks]);
    }
    const desc = (id) => esc(PERKS.nowText ? PERKS.nowText(S, id) : (PERKS.BY_ID[id]?.desc || "").replace(/\s*\[[^\]]*\]\s*$/, ""));
    const ic = (sk, n) => typeof UIART !== "undefined" ? UIART.skill(sk, n) : "";
    const canHtml = can.length ? can.map(([sk, id, name, rk, ranks]) => `<div class="item">${ic(sk, 26)}<div class="t">${esc(name)}${ranks > 1 ? ` <span class="num">${rk + 1}/${ranks}</span>` : ""}<span>${esc(sk)} · ${desc(id)}</span></div><button class="btn sm pri" data-act="perk" data-id="${esc(id)}">Take</button></div>`).join("")
      : `<p class="sub">${pts > 0 ? "No perk is open yet. Raise a skill to reach the next star." : "No perk points to spend. You get one each level."}</p>`;
    const hadHtml = Object.keys(had).length ? Object.entries(had).map(([sk, l]) => `<h3 style="margin-top:12px">${ic(sk, 20)} ${esc(sk)} <button class="linkbtn" data-twa="starsof" data-id="${esc(sk)}">stars</button></h3><div class="list">${l.map(([id, name, rk, ranks]) => `<div class="item on"><div class="t">${esc(name)}${ranks > 1 ? ` <span class="num">${rk}/${ranks}</span>` : " ✓"}<span>${desc(id)}</span></div></div>`).join("")}</div>`).join("")
      : `<p class="sub">You haven't taken any perks yet.</p>`;
    return `<div class="panel"><h2>Perks ${pts > 0 ? `<span class="gold">· ${pts} to spend</span>` : ""}</h2><h3>Ready to take</h3><div class="list">${canHtml}</div></div><div class="panel"><h2>Your perks</h2>${hadHtml}</div>`;
  }

  // ------------------------------------------------------------ the compass (browser only)
  let hubOpen = false, charMode = false, fromHub = false, bgKey = "", lastBar = "", lastTop = "";
  const $ = (s) => document.querySelector(s);
  const ui = () => window.__ui || {};
  const save = () => window.__dbg?.save?.();
  const ICO = {
    char: '<circle cx="12" cy="7" r="3.6"/><path d="M4.5 21c1-5 4.4-7 7.5-7s6.5 2 7.5 7"/><path d="M18 3l.8 1.6 1.7.3-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.3z"/>',
    items: '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    magic: '<path d="M12 3c2 3 5 5 5 9a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/>',
    gold: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4.4"/>',
    weight: '<path d="M7 9h10l3 11H4z"/><circle cx="12" cy="6" r="2.4"/>',
    town: '<path d="M4 20v-8l8-6 8 6v8z"/><path d="M10 20v-5h4v5"/>',
    log: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 13.8c2.6.1 4.4 1.7 4.9 4.6"/>',
    tactics: '<path d="M5 19L19 5M14 5h5v5"/><path d="M5 5l6 6M14 14l5 5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  };
  const KEYCAP = { up: "W", left: "A", right: "D", down: "S" };   // shown on a PC only (index.html hides them on touch screens)
  const ico = (k) => `<svg class="tw-i" viewBox="0 0 24 24" aria-hidden="true">${ICO[k] || ""}</svg>`;
  function roseSVG() {
    let ticks = "";
    for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, r1 = i % 18 === 0 ? 118 : i % 6 === 0 ? 124 : 128, x1 = 150 + Math.sin(a) * r1, y1 = 150 - Math.cos(a) * r1, x2 = 150 + Math.sin(a) * 134, y2 = 150 - Math.cos(a) * 134; ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }
    const pt = (ang, len, wid) => { const a = ang * Math.PI / 180, b = (ang + 90) * Math.PI / 180, tip = [150 + Math.sin(a) * len, 150 - Math.cos(a) * len], l = [150 + Math.sin(b) * wid, 150 - Math.cos(b) * wid], r = [150 - Math.sin(b) * wid, 150 + Math.cos(b) * wid];
      return [`M150 150L${l[0].toFixed(1)} ${l[1].toFixed(1)}L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Z`, `M150 150L${r[0].toFixed(1)} ${r[1].toFixed(1)}L${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Z`]; };
    let rose = "";
    [[45, 62, 9], [135, 62, 9], [225, 62, 9], [315, 62, 9]].forEach(([a, l, w]) => { const [p1, p2] = pt(a, l, w); rose += `<path class="rs-d1" d="${p1}"/><path class="rs-d2" d="${p2}"/>`; });
    [["up", 0], ["right", 90], ["down", 180], ["left", 270]].forEach(([d, a]) => { const [p1, p2] = pt(a, 104, 15); rose += `<g class="rs-pt rs-${d}"><path class="rs-l" d="${p1}"/><path class="rs-r" d="${p2}"/></g>`; });
    return `<svg class="tw-rosesvg" viewBox="0 0 300 300" aria-hidden="true">
      <defs><radialGradient id="twglow"><stop offset="0" stop-color="#f3dca0" stop-opacity=".35"/><stop offset="1" stop-color="#f3dca0" stop-opacity="0"/></radialGradient></defs>
      <circle cx="150" cy="150" r="146" fill="url(#twglow)" class="tw-halo"/>
      <g class="tw-ring"><circle cx="150" cy="150" r="134" class="rg"/><circle cx="150" cy="150" r="114" class="rg thin"/>${ticks}</g>
      <g class="tw-ring2"><circle cx="150" cy="150" r="88" class="rg thin dash"/></g>
      ${rose}<circle cx="150" cy="150" r="16" class="rs-hub"/><circle cx="150" cy="150" r="6" class="rs-core"/></svg>`;
  }
  function starsBG() {
    const r = seeded("tabsky"); let s = "";
    for (let i = 0; i < 70; i++) s += `<circle cx="${(r() * 100).toFixed(2)}%" cy="${(r() * 62).toFixed(2)}%" r="${(0.4 + r() * 1.1).toFixed(2)}" ${r() < 0.35 ? `class="tw" style="animation-delay:${(r() * 4).toFixed(2)}s"` : ""} opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`;
    return `<svg class="tw-starsvg" width="100%" height="100%" aria-hidden="true">${s}</svg>`;
  }
  function drawBG(el, S) {
    const pos = posOf(S), place = !S.trip && S.location;
    let key = place ? `p|${place}${S.dungeon ? "|in" : ""}` : "w";
    try { if (typeof SKY !== "undefined") key += "|" + SKY.state(pos).key; } catch { /* ignore */ }
    if (key === bgKey && el.firstChild) return;
    bgKey = key;
    let html = "";
    try {
      if (place && typeof PLACEART !== "undefined") html = PLACEART.scene(place, { indoor: !!S.dungeon });   // [dungeonphone] no weather inside
      if (!html && typeof ART !== "undefined") {
        html = ART.html(240, 400, (g, H, w, h) => {
          const st = typeof SKY !== "undefined" ? SKY.state(pos) : null;
          if (st) SKY.backdrop(g, H, w, h, st, { horizon: 0.66, seed: "tab" }); else { g.fillStyle = "#1a2230"; g.fillRect(0, 0, w, h); }
          const r = seeded("tabhills");   // far mountains, near hills, a dark foreground
          [["#2b3340", 0.5, 70], ["#1d232c", 0.6, 46], ["#11151a", 0.74, 30]].forEach(([c, y0, amp]) => {
            g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
            for (let x = 0; x <= w; x += 12) g.lineTo(x, h * y0 + Math.sin(x / 37 + y0 * 9) * amp * 0.4 - r() * amp * 0.6);
            g.lineTo(w, h); g.closePath(); g.fill();
          });
          if (st) SKY.overlay(g, H, w, h, st, { seed: "tab", ground: h * 0.74, cover: false });
        }, { key: `tabbg|${key}`, alt: "" });
      }
    } catch (e) { html = ""; }
    el.innerHTML = html;
  }
  function topText(S) {
    const pos = posOf(S);
    let where = S.location || "";
    try { if (!where) where = `The wilds of ${G.holdAt(pos)}`; } catch { where = "The wilds"; }
    let when = "", skyI = "";
    try { const dt = WEVENTS.date(), wx = WEVENTS.weather(pos); when = `${dt.day} ${dt.month} · ${G.clockText().split(", ")[1] || ""} · ${wx.name}`; } catch { /* ignore */ }
    let fc = ""; try { if (typeof WFX !== "undefined") { fc = WFX.forecast(pos); const cs = WFX.coldState(save()); if (cs.tier) fc += ` · ${cs.icon} ${cs.label}`; } } catch { /* ignore */ }
    try { if (typeof SKY !== "undefined") skyI = SKY.icon(SKY.state(pos), 20); } catch { /* ignore */ }
    return { where, when, skyI, fc };
  }
  function barHTML(b) {
    const t = b.task;
    return `<button class="tw-task ${t.hot ? "hot" : ""}" data-twa="task" data-k="${t.k}"><span class="tw-ti">${t.icon}</span><span class="tw-tt"><b>${esc(t.text)}</b><small>${esc(t.sub)}</small></span>${t.progress != null ? `<i class="tw-tp"><i style="width:${t.progress}%"></i></i>` : ""}</button>
      <div class="tw-stats"><div class="tw-lv${b.ready ? " tw-lvgo" : ""}"><span class="tw-lvn num" aria-label="Level ${b.level}"><span>${b.level}</span></span><span class="tw-xp"><small>Level ${b.level}${b.ready ? ` <em class="tw-lvup">· Level up!</em>` : b.perks ? ` <em class="gold">· ${b.perks} to spend</em>` : ""}<span class="num">${b.xp}/${b.need}</span></small><i class="tw-xpb"><i style="width:${b.pct}%"></i></i></span></div>
      <div class="tw-st gold">${ico("gold")}<b class="num">${b.gold}</b></div><div class="tw-st ${b.over ? "over" : ""}">${ico("weight")}<b class="num">${b.w}/${b.cap}</b></div></div>`;
  }
  function hubHTML(S) {
    const b = bar(S), inTown = S.location && !S.trip && typeof TOWNS !== "undefined" && TOWNS.isTown?.(S.location);
    const dir = (d) => { const m = DIR[d]; return `<button class="tw-dir tw-${d}" data-twgo="${m}" aria-label="${NAME[m]}"><kbd class="tw-k" aria-hidden="true">${KEYCAP[d]}</kbd>${ico(m)}<b>${NAME[m]}</b><small>${SUBT[m]}</small>${m === "char" && b.ready ? '<span class="tw-lvlready">Level up</span>' : m === "char" && b.perks ? '<span class="dot"></span>' : ""}</button>`; };
    const quick = [inTown ? ["town", "Area", "town"] : null, ["log", "Journal", "log"], ["social", "Social", "people"], ["settings", "Settings", "gear"], typeof SEARCH !== "undefined" ? ["search", "Search", "search"] : null].filter(Boolean);
    return `<div class="tw-bg" aria-hidden="true"></div><div class="tw-veil" aria-hidden="true"></div>${starsBG()}
      <div class="tw-top"><b class="tw-where"></b><span class="tw-when"></span><small class="tw-fc"></small></div>
      <div class="tw-rose"><div class="tw-disc" aria-hidden="true"><i class="tw-depth"></i><div class="tw-face">${roseSVG()}</div><i class="tw-shine"></i></div>${dir("up")}${dir("left")}${dir("right")}${dir("down")}</div>
      <p class="tw-hint"><span class="tw-touch">Swipe or tap a direction</span><span class="tw-keys">Press WASD or click a direction · Tab closes the menu</span></p>
      <div class="tw-quick">${quick.map(([id, l, k], i) => `<button class="tw-q" data-twq="${id}" aria-label="${l}">${ico(k)}<span>${l}</span><kbd class="tw-k" aria-hidden="true">${i + 1}</kbd></button>`).join("")}</div>
      <div class="tw-bar"></div>`;
  }
  function refreshHub() {
    const el = $("#tw"), S = save(); if (!el || !S) return;
    drawBG(el.querySelector(".tw-bg"), S);
    const tp = topText(S), tk = JSON.stringify(tp);
    if (tk !== lastTop) { lastTop = tk; el.querySelector(".tw-where").textContent = tp.where; el.querySelector(".tw-when").innerHTML = `${tp.skyI}<span>${esc(tp.when)}</span>`; const fcEl = el.querySelector(".tw-fc"); if (fcEl) fcEl.textContent = tp.fc ? `Forecast: ${tp.fc}` : ""; }
    const bh = barHTML(bar(S));
    if (bh !== lastBar) { lastBar = bh; el.querySelector(".tw-bar").innerHTML = bh; }
  }
  function openHub() {
    const S = save(); if (!live || !S || $("#title") || $("#dun")) return false;
    if (charMode) exitChar();
    ui().closeMenu?.();
    let el = $("#tw");
    if (!el) {
      el = document.createElement("div"); el.id = "tw"; el.className = "tw"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Main menu");
      el.innerHTML = hubHTML(S); lastBar = ""; lastTop = ""; bgKey = "";
      document.body.appendChild(el);
      el.addEventListener("click", onHubClick);
    }
    hubOpen = true; fromHub = false;
    document.body.classList.add("tw-on");
    refreshHub();
    faceFit(el);
    try { SOUND.fx("page"); } catch { /* sound never breaks the game */ }
    return true;
  }
  /* [artfit] each 3D compass render is 320 px: on a big or sharp screen where the face is drawn bigger than that, show the
     flat painted compass (1024 px) instead of a blurry blow-up */
  function faceFit(el) {
    const f = el.querySelector(".tw-face"); if (!f || f.dataset.fit) return;
    f.dataset.fit = "1";
    const fit = () => { const r = f.getBoundingClientRect(), d = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1;
      const px3d = r.width * d * (f.classList.contains("art-flat") ? 1.16 : 1);
      f.classList.toggle("art-flat", px3d > 320 * 1.12); };
    fit();
    if (typeof FITCANVAS !== "undefined") FITCANVAS.watch(f, fit);
  }
  function closeHub() { kb = null; $("#tw")?.remove(); hubOpen = false; document.body.classList.remove("tw-on"); }
  /* go to one of the four menus (from the compass, or swiping round the ring) */
  function go(m, viaHub = true) {
    closeHub(); fromHub = viaHub;
    const u = ui();
    if (m === "char") { u.closeMenu?.(); enterChar("stars"); if (typeof LEVELUP !== "undefined" && LEVELUP.live) LEVELUP.open(); return; }   // like Skyrim: a waiting level-up asks first
    if (charMode) exitChar();
    if (m === "items" || m === "magic") { u.openMenu?.(m); return; }
    u.closeMenu?.(); fromHub = false; u.go?.("map");
    try { document.getElementById("mapwrap")?.scrollIntoView({ block: "start" }); window.scrollTo(0, 0); } catch { /* ignore */ }
  }
  function onHubClick(e) {
    const d = e.target.closest("[data-twgo]"); if (d) { go(d.dataset.twgo); return; }
    const q = e.target.closest("[data-twq]");
    if (q) {
      const id = q.dataset.twq; closeHub();
      if (id === "settings") { document.getElementById("sndBtn")?.click(); return; }
      if (id === "search") { if (typeof SEARCH !== "undefined") SEARCH.open(); return; }
      if (id === "tactics") { enterChar("tactics"); fromHub = true; return; }
      ui().go?.(id); window.scrollTo(0, 0); return;
    }
    const t = e.target.closest("[data-twa=task]");
    if (t) {
      const k = t.dataset.k; closeHub();
      if (k === "dun") return document.querySelector("[data-act=dun]")?.click();
      if (k === "enc") return document.querySelector("[data-act=openenc]")?.click();
      if (k === "ev") return document.querySelector("[data-act=openev]")?.click();
      if (k === "quest" || k === "idle") { ui().go?.("log"); window.scrollTo(0, 0); return; }
      ui().go?.("map"); window.scrollTo(0, 0);
    }
  }
  // ---- the Skills (up) page: #side shown full screen with its own header
  function enterChar(t) {
    charMode = true; document.body.classList.add("tw-char");
    let hb = $("#twbar");
    if (!hb) {
      hb = document.createElement("div"); hb.id = "twbar"; hb.className = "twbar";
      hb.innerHTML = `<button class="iconbtn" data-twb="hub" aria-label="Back to the compass">${ico("back")}</button><div class="twbar-tabs" role="tablist">${charTabs().map(([id, l]) => `<button class="twbar-t" data-twb="${id}" role="tab">${l}</button>`).join("")}</div>`;
      hb.addEventListener("click", (e) => { const b = e.target.closest("[data-twb]"); if (!b) return; if (b.dataset.twb === "hub") return openHub(); setCharTab(b.dataset.twb); });
      document.body.appendChild(hb);
    }
    setCharTab(t);
  }
  function setCharTab(t) {
    if (t === "stars") { starPick = null; typeof SKYUI !== "undefined" && SKYUI.refocus?.(); }   // the Skills page opens on what you can take
    ui().go?.(t);
    const side = document.getElementById("side"); if (side) side.scrollTop = 0;
    markChar(t);
  }
  function markChar(t) { document.querySelectorAll("#twbar .twbar-t").forEach((b) => { const on = b.dataset.twb === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); }); }
  function exitChar() { charMode = false; document.body.classList.remove("tw-char"); $("#twbar")?.remove(); }
  /* ui.js tells us after every panel draw, so we leave full-screen mode when something else changes the tab */
  function afterPanel(tab) {
    if (!charMode) return;
    if (!charTabs().some(([id]) => id === tab)) exitChar(); else markChar(tab);
  }
  /* the phone's back button. true = handled, false = let the app close, null = not ours */
  function back(opts) {
    if (!live || !save()) return null;
    if (charMode) { openHub(); return true; }
    if (opts && opts.esc) { if (hubOpen && $("#tw")) { closeHub(); return true; } return null; }   // PC Esc: the compass closes, the map is home
    if (hubOpen) return false;
    return openHub();
  }
  /* the Items/Magic menu was just closed (✕ or back): return to the compass if we came from it */
  function menuClosed() { if (fromHub) { fromHub = false; openHub(); } }
  /* a bottom tab was tapped: the player left the compass on purpose, so closing a menu shouldn't pop it back up */
  function fromBar() { fromHub = false; if (charMode) exitChar(); }

  // ---- swipes
  let sw = null;
  function scrollerAxis(el, stop) {   // does an ancestor of el scroll? {x, y}
    let x = false, y = false;
    for (let n = el; n && n !== stop && n !== document.body && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (!x && /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 4) x = true;
      if (!y && /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4) y = true;
    }
    return { x, y };
  }
  function context() {
    if ($("#modal") || $("#title") || !save()) return null;
    if (hubOpen && $("#tw")) return "hub";
    if ($("#sky")) return "sky";
    if (charMode) return "char";
    return null;
  }
  function begin(x, y, target) {
    const ctx = context(); sw = null;
    if (!ctx) return;
    if (target.closest?.("input,select,textarea,[contenteditable],canvas#map,.tw-noswipe")) return;
    const ax = scrollerAxis(target, document.body);
    sw = { x, y, t: Date.now(), ctx, target, noX: ax.x, noY: ax.y || (ctx === "char" && !target.closest("#twbar")) };
    if (ctx === "hub") { cancelAnimationFrame(springT); $("#tw").classList.add("drag"); }
  }
  function move(x, y) {
    if (!sw) return;
    const dx = x - sw.x, dy = y - sw.y;
    sw.far = Math.max(sw.far || 0, Math.abs(dx), Math.abs(dy));
    if (sw.ctx !== "hub") return;
    const el = $("#tw"); if (!el) return;
    const ax = Math.abs(dx), ay = Math.abs(dy), d = Math.max(ax, ay) < 18 ? "" : ax > ay ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
    if (el.dataset.glow !== d) { el.dataset.glow = d; if (d) try { SOUND.fx("click"); navigator.vibrate?.(8); } catch { /* sound and buzz never break the game */ } }
    const k = Math.min(1, Math.max(ax, ay) / 90); el.style.setProperty("--pull", k.toFixed(2));
    // the compass follows the finger, with a rubber-band give so it never leaves the screen
    const band = (v) => Math.sign(v) * 70 * (1 - Math.exp(-Math.abs(v) / 110));
    tilt(el, band(dx), band(dy));
  }
  /* the 3D compass is a sheet of 7x7 Blender renders (scripts/compass3d.py): pick the one matching the tilt */
  let tiltNow = [0, 0], springT = 0;
  function tilt(el, tx, ty) {
    tiltNow = [tx, ty];
    const f = (v) => Math.max(0, Math.min(6, Math.round(3 + v / 70 * 3)));
    el.style.setProperty("--tx", tx.toFixed(1)); el.style.setProperty("--ty", ty.toFixed(1));
    el.style.setProperty("--cc", f(tx)); el.style.setProperty("--cr", f(ty));
  }
  function letGo() {
    const el = $("#tw"); if (!el) return;
    el.classList.remove("drag"); el.dataset.glow = "";
    el.style.removeProperty("--pull");
    // springs back to flat with a little wobble past the middle
    cancelAnimationFrame(springT);
    const [x0, y0] = tiltNow, t0 = performance.now();
    if (!x0 && !y0) return;
    const step = (now) => {
      const t = (now - t0) / 1000, k = Math.exp(-t * 6) * Math.cos(t * 14);
      if (t > 0.9 || !el.isConnected) { tiltNow = [0, 0]; for (const v of ["--tx", "--ty", "--cc", "--cr"]) el.style.removeProperty(v); return; }
      tilt(el, x0 * k, y0 * k); springT = requestAnimationFrame(step);
    };
    springT = requestAnimationFrame(step);
  }
  function end(x, y) {
    const s = sw; sw = null; if (!s) return false;
    letGo();
    const dx = x - s.x, dy = y - s.y;
    let d = swipeDir(dx, dy, Date.now() - s.t);
    if (!d) return s.ctx === "hub" && (s.far || 0) > 18;   // dragged on the compass and let go: no swipe, and no tap either
    if ((d === "left" || d === "right") && s.noX) return false;
    if ((d === "up" || d === "down") && s.noY) return false;
    return swiped(s.ctx, d);
  }
  function swiped(ctx, d) {
    if (ctx === "hub") { go(DIR[d]); return true; }
    const st = d === "left" ? 1 : d === "right" ? -1 : 0;
    if (ctx === "sky") {
      if (d === "down") { ui().closeMenu?.(); openHub(); return true; }
      if (!st) return false;
      const cats = [...document.querySelectorAll("#sky .sky-cat")].map((b) => b.dataset.id), cur = document.querySelector("#sky .sky-cat.on")?.dataset.id;
      const r = step(cats, cur, st);
      if (r.id) { document.querySelector(`#sky .sky-cat[data-id="${r.id}"]`)?.click(); return true; }
      const page = document.querySelector("#sky .sky-page.on")?.dataset.id || "items";
      go(ring(page, r.edge), true); return true;
    }
    if (ctx === "char") {
      if (d === "down") { openHub(); return true; }
      if (!st) return false;
      const cur = document.querySelector("#twbar .twbar-t.on")?.dataset.twb, r = step(charTabs().map(([id]) => id), cur, st);
      if (r.id) { setCharTab(r.id); return true; }
      go(ring("char", r.edge), true); return true;
    }
    return false;
  }
  if (live) {
    // mouse and pen through pointer events; fingers through touch events, which still end cleanly while a list scrolls
    document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch" && e.button === 0) begin(e.clientX, e.clientY, e.target); }, true);
    document.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch") move(e.clientX, e.clientY); }, true);
    document.addEventListener("pointerup", (e) => { if (e.pointerType !== "touch" && end(e.clientX, e.clientY)) { swallowClick(); } }, true);
    document.addEventListener("touchstart", (e) => { if (e.touches.length === 1) { const t = e.touches[0]; begin(t.clientX, t.clientY, e.target); } else sw = null; }, { capture: true, passive: true });
    document.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); }, { capture: true, passive: true });
    document.addEventListener("touchend", (e) => { const t = e.changedTouches[0]; if (t && end(t.clientX, t.clientY)) swallowClick(); }, { capture: true, passive: true });
    document.addEventListener("touchcancel", () => { sw = null; letGo(); }, { capture: true, passive: true });
    // the Items/Magic menu's ✕
    document.addEventListener("click", (e) => { if (e.target.closest?.("[data-act=skyclose]")) setTimeout(menuClosed, 0); });
    // the Skills page's own taps (skill cards, stars, links)
    document.addEventListener("click", (e) => {
      const a = e.target.closest?.("[data-twa]");
      if (a && a.dataset.twa === "skill") { starSkill = a.dataset.id; starPick = null; typeof SKYUI !== "undefined" && SKYUI.refocus?.(); ui().refresh?.(); requestAnimationFrame(() => document.querySelector(".tw-card.on")?.scrollIntoView({ inline: "center", block: "nearest" })); return; }
      if (a && a.dataset.twa === "starsof") { starSkill = a.dataset.id; starPick = null; typeof SKYUI !== "undefined" && SKYUI.refocus?.(); if (charMode) setCharTab("stars"); else ui().go?.("stars"); return; }
      const st = e.target.closest?.(".tw-big [data-sk-perk]");
      if (st) { starPick = +st.dataset.skPerk; ui().refresh?.(); requestAnimationFrame(() => document.querySelector(".tw-perk")?.scrollIntoView({ block: "nearest" })); }
    });
  }
  // ---- keys on a PC: W A S D (or the arrows) lean the compass that way while held and open that menu when let go,
  // so a quick tap feels instant but you still see it tilt; Enter or Space opens the one leaning; 1-5 the row of
  // buttons below; Esc closes. Tab itself (open / close) lives in desktop.js.
  const KEYDIR = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
  let kb = null;   // { d, key, t } while a direction key is held
  const MINLEAN = 140;   // ms the compass leans before the menu opens, even on the quickest tap
  function lean(d) {
    const el = $("#tw"); if (!el) return;
    cancelAnimationFrame(springT);
    el.dataset.glow = d || ""; el.style.setProperty("--pull", d ? "1" : "0");
    const v = { up: [0, -60], down: [0, 60], left: [-60, 0], right: [60, 0] }[d] || [0, 0];
    tilt(el, v[0], v[1]);
    if (d) try { SOUND.fx("click"); } catch { /* sound never breaks the game */ }
  }
  function keyGo(d) {
    if (!d || !hubOpen) return;
    const wait = kb ? Math.max(0, MINLEAN - (Date.now() - kb.t)) : 0;
    kb = null;
    setTimeout(() => { if (hubOpen && $("#tw")) go(DIR[d]); }, wait);
  }
  function hubKey(e) {
    if (context() !== "hub" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target, tag = (t && t.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || t?.isContentEditable) return;
    const k = String(e.key || "").toLowerCase(), d = KEYDIR[k];
    if (d) { e.preventDefault(); if (e.repeat && kb) return; if (!kb || kb.d !== d) { kb = { d, key: k, t: Date.now() }; lean(d); } return; }
    if (k === "enter" || k === " " || k === "spacebar") {
      const g = kb?.d || $("#tw")?.dataset.glow;
      if (g) { e.preventDefault(); keyGo(g); }
      return;   // nothing leaning: let Enter press whatever button has focus
    }
    if (k === "escape") { e.preventDefault(); closeHub(); return; }
    if (/^[1-9]$/.test(k)) { const b = document.querySelectorAll("#tw .tw-q")[+k - 1]; if (b) { e.preventDefault(); b.click(); } }
  }
  function hubKeyUp(e) {
    if (!kb) return;
    const k = String(e.key || "").toLowerCase();
    if (k !== kb.key && KEYDIR[k] !== kb.d) return;   // let go of some other key
    e.preventDefault(); keyGo(kb.d);
  }
  if (live) {
    document.addEventListener("keydown", hubKey, true);
    document.addEventListener("keyup", hubKeyUp, true);
    addEventListener("blur", () => { if (kb) { kb = null; letGo(); } });   // the window lost focus mid-press: just spring back
  }
  /* after a swipe, the finger's release shouldn't also tap the button under it */
  function swallowClick() {
    const kill = (e) => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener("click", kill, true);
    setTimeout(() => document.removeEventListener("click", kill, true), 350);
  }
  let timer = null;
  function mount() {
    if (!live) return;
    if (!$("#twBtn")) {
      const b = document.createElement("button"); b.id = "twBtn"; b.className = "twbtn"; b.setAttribute("aria-label", "Open the menu compass");
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 3.5l2.2 8.5L12 20.5 9.8 12z" class="f"/><path d="M3.5 12h17"/></svg>`;
      b.onclick = () => openHub();
      document.body.appendChild(b);
    }
    clearInterval(timer); timer = setInterval(() => { if (hubOpen && $("#tw")) refreshHub(); else if (hubOpen) { hubOpen = false; document.body.classList.remove("tw-on"); } }, 1000);
    const force = /[?&]hub=1\b/.test(location.search), skip = /[?&]hub=0\b/.test(location.search);
    if (!skip && (force || !navigator.webdriver)) setTimeout(openHub, 60);
  }
  return { RING, DIR, CHAR_TABS, swipeDir, ring, step, bar, task, mini, stars, perks, mount, openHub, closeHub, go, back, afterPanel, menuClosed, fromBar, swiped,
    get open() { return hubOpen; }, set maxMs(v) { MAXMS = v; }, get charMode() { return charMode; }, get starSkill() { return starSkill; }, set starSkill(v) { starSkill = v; starPick = null; typeof SKYUI !== "undefined" && SKYUI.refocus?.(); } };
})();
