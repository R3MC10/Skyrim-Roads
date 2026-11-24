/* HUD: what's always on screen, in Skyrim's style. A compass strip across the top of the map (heading, quest
   target, nearby places, players, dragon raids), slim attribute bars under the map, status icons, small line
   icons for the top bar, and Skyrim's top-left message log. Plain DOM/SVG, redrawn only when something changes. [OURS] */
const HUD = (() => {
  const reduce = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = (inner, vb = "0 0 24 24", cls = "") => `<svg class="hico ${cls}" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

  // ---- line icons (white strokes, like Skyrim's compass and menus)
  const ICON = {
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/><circle cx="12" cy="12" r="6.4"/>',
    mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 13.8c2.6.1 4.4 1.7 4.9 4.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    centre: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    coin: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4.4"/>',
    // status
    eye: '<path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
    fang: '<path d="M5 6h14l-2 5-2-2-3 9-3-9-2 2z"/>',
    paw: '<circle cx="7" cy="9" r="1.9"/><circle cx="11" cy="6.3" r="1.9"/><circle cx="15.5" cy="7" r="1.9"/><circle cx="18" cy="11" r="1.7"/><path d="M8 16c0-3 2.4-5 4.6-5s4.3 2 4.3 4.4-1.8 3.6-4.3 3.6S8 18.6 8 16z"/>',
    bed: '<path d="M3 18V8M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11" r="1.8"/>',
    weight: '<path d="M7 9h10l3 11H4z"/><circle cx="12" cy="6" r="2.4"/>',
    law: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z"/>',
    sick: '<circle cx="12" cy="12" r="8"/><path d="M8.5 10h.01M15.5 10h.01M8 16c2.4-1.6 5.6-1.6 8 0"/>',
    horse: '<path d="M5 20l2-7 3-2 2-5 3 1 2 3 2 1-1 2-3-1-2 3 1 5"/>',
  };
  const icon = (k, cls = "") => svg(ICON[k] || "", "0 0 24 24", cls);

  // ---- compass glyphs by place kind (Skyrim-like white line icons)
  const KIND = {
    city: '<path d="M4 20V9l3-2 3 2v-4l2-2 2 2v4l3-2 3 2v11z"/><path d="M10 20v-4h4v4"/>',
    town: '<path d="M4 20v-8l8-6 8 6v8z"/><path d="M10 20v-5h4v5"/>',
    farm: '<path d="M3 20h18M6 20v-7l6-4 6 4v7"/><path d="M12 9V5M9 7h6"/>',
    fort: '<path d="M4 20V8h3v3h3V8h4v3h3V8h3v12z"/>',
    dungeon: '<path d="M3 20c0-8 4-13 9-13s9 5 9 13"/><path d="M8 20c0-4 2-7 4-7s4 3 4 7"/>',
    camp: '<path d="M3 20l9-14 9 14z"/><path d="M12 6v14"/>',
    lair: '<path d="M2 14c4-1 6-6 10-8 4 2 6 7 10 8-3 0-5 2-6 5-1-2-3-3-4-3s-3 1-4 3c-1-3-3-5-6-5z"/>',
    stone: '<path d="M8 20l1-15 3-2 3 2 1 15z"/><path d="M10.5 10l3 3"/>',
    shrine: '<path d="M7 20h10M9 20V9h6v11M8 9l4-5 4 5"/>',
    landmark: '<path d="M6 21V3M6 4h11l-3 4 3 4H6"/>',
  };
  const DRAGON = '<path d="M2 12c3 0 5-3 7-6 1 2 1 4 3 5 2-1 2-3 3-5 2 3 4 6 7 6-3 1-5 2-6 5-1-1-2-2-4-2s-3 1-4 2c-1-3-3-4-6-5z"/>';

  // ---- the compass strip
  let comp = null, heading = 0, lastKey = "", onPick = null;
  function mount(wrap, pick) {
    if (!wrap) return;
    onPick = pick; comp = document.getElementById("compass");
    if (!comp) {
      comp = document.createElement("div"); comp.id = "compass"; comp.className = "compass"; comp.setAttribute("aria-label", "Compass");
      comp.innerHTML = `<div class="ctape"></div><div class="cmarks"></div><i class="cl"></i><i class="cr"></i>`;
      wrap.appendChild(comp);
      comp.addEventListener("click", (e) => { const b = e.target.closest("[data-place]"); if (b && onPick) { e.stopPropagation(); onPick(b.dataset.place); } });
    }
    lastKey = "";
  }
  const FOV = 200;   // degrees shown across the strip
  const bearing = (from, to, W, H) => { const dx = (to[0] - from[0]) * W, dy = (to[1] - from[1]) * H; return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; };
  const rel = (b) => { let d = b - heading; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  /* d = { pos, target (where you're heading, or null), W, H, quest:{pos,name}, places:[{name,pos,kind,known}], players:[{name,pos}], raid:{town,pos} } */
  function compass(d) {
    if (!comp || !d || !d.pos) return;
    const W = d.W || 1, H = d.H || 1;
    if (d.target) { const dist = Math.hypot((d.target[0] - d.pos[0]) * W, (d.target[1] - d.pos[1]) * H); if (dist > 2) heading = bearing(d.pos, d.target, W, H); }
    // tape: letters and ticks every 15°, positioned for the current heading
    const width = comp.clientWidth || 300, px = width / FOV;
    const marks = [];
    for (let a = 0; a < 360; a += 15) {
      const r = rel(a); if (Math.abs(r) > FOV / 2 + 8) continue;
      const x = Math.round(width / 2 + r * px);
      const lab = { 0: "N", 90: "E", 180: "S", 270: "W" }[a];
      marks.push(lab ? `<b class="cdir ${a === 0 ? "n" : ""}" style="left:${x}px">${lab}</b>` : `<i class="ctick ${a % 45 === 0 ? "mid" : ""}" style="left:${x}px"></i>`);
    }
    // markers
    const items = [];
    const put = (cls, inner, b, extra = "", place = "", title = "") => {
      const r = rel(b); if (Math.abs(r) > FOV / 2) return;
      const x = Math.round(width / 2 + r * px);
      items.push(`<span class="cm ${cls}" style="left:${x}px" ${place ? `data-place="${place.replace(/"/g, "&quot;")}" role="button" tabindex="0"` : ""} ${title ? `title="${title.replace(/"/g, "&quot;")}"` : ""}>${inner}${extra}</span>`);
    };
    for (const p of d.places || []) put(p.known ? "pl" : "unk", p.known ? svg(KIND[p.kind] || KIND.landmark) : "<em>?</em>", bearing(d.pos, p.pos, W, H), "", p.known ? p.name : "", p.known ? p.name : "Something nearby");
    for (const o of d.players || []) put("pp", "<i></i>", bearing(d.pos, o.pos, W, H), "", "", o.name);
    if (d.raid) put("raid", svg(DRAGON), bearing(d.pos, d.raid.pos, W, H), "", d.raid.town, `Dragon at ${d.raid.town}`);
    if (d.quest) put("quest", svg('<path d="M12 21L5 8h14z"/>'), bearing(d.pos, d.quest.pos, W, H), "", d.quest.name || "", d.quest.name || "Quest");
    const key = Math.round(heading) + "|" + width + "|" + marks.join("").length + "|" + items.join("");
    if (key === lastKey) return;
    lastKey = key;
    comp.querySelector(".ctape").innerHTML = marks.join("");
    comp.querySelector(".cmarks").innerHTML = items.join("");
  }

  // ---- attribute bars (Skyrim: magicka left, health centre, stamina right)
  let lastBars = {};
  function bars(el, v) {
    if (!el) return;
    const bar = (k, cur, max, cls) => {
      const p = Math.max(0, Math.min(100, max ? (cur / max) * 100 : 0)), full = p >= 99.5;
      const flash = lastBars[k] != null && Math.round(lastBars[k]) !== Math.round(cur) ? " flash" : "";
      return `<div class="hb ${cls}${full && !v.danger ? " full" : ""}${p < 30 ? " low" : ""}${flash}" title="${k}: ${Math.round(cur)} / ${max}"><span class="cap l"></span><span class="track"><i style="--p:${p.toFixed(1)}%"></i></span><span class="cap r"></span><small class="num">${Math.round(cur)}</small></div>`;
    };
    const html = `<div class="hbars">${bar("Magicka", v.mp, v.mpMax, "mp")}${bar("Health", v.hp, v.hpMax, "hp")}${bar("Stamina", v.sp, v.spMax, "sp")}</div>
      <div class="hline"><span class="hstat">${status(v)}</span><span class="carry ${v.over ? "over" : ""}${!v.over && v.cap && v.w / v.cap < 0.75 ? " light" : ""}">${icon("weight")}Carry <b class="num">${Math.round(v.w)}</b>/${Math.round(v.cap)}${v.over ? " · too heavy" : ""}</span></div>`;
    if (el.dataset.html !== html) {
      el.innerHTML = html; el.dataset.html = html;
      if (!reduce()) setTimeout(() => el.querySelectorAll(".hb.flash").forEach((b) => b.classList.remove("flash")), 700);
    }
    lastBars = { Health: v.hp, Magicka: v.mp, Stamina: v.sp };
  }
  function status(v) {
    const s = [];
    if (v.hidden) s.push(["eye", "Hidden", "Sneaking: you're hidden on the road"]);
    if (v.vampire) s.push(["fang", "vamp", "Vampire"]);
    if (v.werewolf) s.push(["paw", "wolf", "Werewolf"]);
    if (v.rested) s.push(["bed", "rest", v.rested]);
    if (v.sick) s.push(["sick", "sick", "Diseased"]);
    if (v.over) s.push(["weight", "over", "Too heavy: you walk slowly"]);
    if (v.bounty) s.push(["law", "law", `Bounty: ${v.bounty} gold`]);
    if (v.riding) s.push(["horse", "ride", "Riding"]);
    return s.map(([k, c, t]) => `<i class="hs ${c}" title="${t}" aria-label="${t}">${icon(k)}</i>`).join("");
  }

  // ---- Skyrim's top-left message log: the newest line is #toast, older ones fade below it
  function log(el, text) {
    if (!el || typeof document === "undefined") return;
    let stack = document.getElementById("hudlog");
    if (!stack) { stack = document.createElement("div"); stack.id = "hudlog"; stack.setAttribute("aria-hidden", "true"); ((typeof HUD2 !== "undefined" && HUD2.logHost()) || document.body).appendChild(stack); }
    if (el.parentNode !== stack) stack.prepend(el);
    const prev = el.dataset.last;
    if (prev && prev !== text && !el.classList.contains("hide")) {
      const line = document.createElement("div"); line.className = "hlog"; line.textContent = prev;
      el.after(line);
      while (stack.children.length > 3) stack.lastChild.remove();
      setTimeout(() => { line.classList.add("gone"); setTimeout(() => line.remove(), 600); }, 2600);
    }
    el.dataset.last = text;
  }

  return { mount, compass, bars, log, icon, ICON, get heading() { return heading; }, set heading(h) { heading = h; } };
})();
