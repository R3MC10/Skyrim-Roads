/* Polish: the little Skyrim-style moments around the interface. Banners that slide in when a skill rises
   ("ONE-HANDED INCREASED TO 26"), a quest is done, a place is discovered, an achievement is earned or you level up;
   floating "+N gold" by your purse; a tiny icon on toasts; a fade when you switch tabs; a dark paper texture
   for panels drawn once with ART. Everything here is decoration: it never blocks taps (pointer-events: none)
   and does nothing when the player prefers reduced motion beyond showing the banner without movement. [OURS] */
const POLISH = (() => {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // the game's modules are top-level consts (not window properties), so look them up by name safely
  const MODS = { UIART: () => typeof UIART !== "undefined", PLACEART: () => typeof PLACEART !== "undefined", ICONART: () => typeof ICONART !== "undefined" };
  const has = (n) => { try { return MODS[n] ? MODS[n]() : false; } catch { return false; } };

  // ---- the panel texture: a dark, faintly grained "leather and smoke" tile, made once
  let texDone = false;
  function texture() {
    if (typeof ART === "undefined" || typeof document === "undefined") return;
    if (texDone) return; texDone = true;
    try {
      const u = ART.url(160, 160, (g, H, w, h) => {
        g.fillStyle = "#16181b"; g.fillRect(0, 0, w, h);
        const r = ART.seeded("tex");
        for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,240,210,0.035)" : "rgba(0,0,0,0.25)"; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
        for (let i = 0; i < 6; i++) { const y = r() * h; g.strokeStyle = "rgba(255,240,210,0.025)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 8 * (r() - 0.5), w * 0.7, y + 8 * (r() - 0.5), w, y); g.stroke(); }
      }, { key: "ui-texture" });
      if (u) document.documentElement.style.setProperty("--tex", `url(${u})`);
    } catch { /* decoration only */ }
  }

  // ---- banners (one at a time, queued; never more than a few waiting)
  const queue = []; let showing = false;
  function host() {
    let el = document.getElementById("pbanners");
    if (!el) { el = document.createElement("div"); el.id = "pbanners"; el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    return el;
  }
  /* [smallpolish] banners wait until the screen is clear: no menu or window (overlays.js ranks them), no fight, and on a
     phone no other tab open (a new objective used to flash over Social) */
  function busy() {
    if (document.querySelector("#sky, #modal .sheet, #favwheel")) return true;
    if (typeof OVERLAYS !== "undefined" && (OVERLAYS.level() >= OVERLAYS.LEVEL.decision || OVERLAYS.menuOpen() || OVERLAYS.fightOpen())) return true;
    const ui = typeof window !== "undefined" ? window.__ui : null;
    if (typeof PCMAP !== "undefined" && PCMAP.on && PCMAP.on()) return document.documentElement.classList.contains("pc-full");   // PC: the map stays in sight beside a side screen
    return !!(ui && ui.tab && ui.tab !== "map");
  }
  function banner(kind, title, big, icon = "") {
    if (typeof document === "undefined") return;
    if (kind === "objective" && typeof HUD2 !== "undefined" && !busy() && HUD2.objFlash(big)) return;
    if (typeof SKILLUP !== "undefined" && SKILLUP.claim(kind, big)) return;   // skillup.js: skill-ups and level-ups get the Skyrim toast with a bar   // hud2.js: a new objective flashes on the line under the compass
    // a burst of skill rises merges into one banner
    const last = queue[queue.length - 1];
    if (last && last.kind === kind && kind === "skill" && queue.length) { last.big += ` · ${big}`; return; }
    if (queue.length >= 4) queue.shift();
    queue.push({ kind, title, big, icon });
    if (!showing) next();
  }
  function next() {
    if (queue.length && busy()) { showing = true; setTimeout(next, 700); return; }   // wait until menus and pop-ups close, like Skyrim
    const b = queue.shift();
    if (!b) { showing = false; return; }
    if (b.kind === "objective" && typeof HUD2 !== "undefined" && HUD2.objFlash(b.big)) { showing = true; setTimeout(next, 5300); return; }   // back on the map: flash it on the objective line
    showing = true;
    const el = document.createElement("div");
    el.className = `pban pban-${b.kind}`;
    el.innerHTML = `<i class="pl"></i>${b.icon ? `<span class="pic">${b.icon}</span>` : ""}<span class="ptx"><small>${esc(b.title)}</small><b>${esc(b.big)}</b></span><i class="pr"></i>`;
    host().appendChild(el);
    const life = b.kind === "level" ? 3200 : 2500;
    setTimeout(() => { el.classList.add("out"); setTimeout(() => { el.remove(); next(); }, reduce ? 0 : 320); }, life);
  }

  // ---- read the game's own messages and celebrate the big ones
  const skillIcon = (sk) => (has("UIART") && UIART.SKILL ? UIART.skill(sk, 36) : "");
  const LINE = { "The Dragonborn": "main", "The Companions": "companions", "The Thieves Guild": "thieves", "The College of Winterhold": "college" };
  function fromText(text) {
    if (!text || typeof text !== "string") return;
    const skills = typeof D !== "undefined" ? D.ALL_SKILLS || [] : [];
    if (!(typeof LEVELUP !== "undefined" && LEVELUP.live)) for (const m of text.matchAll(/([A-Z][A-Za-z'\- ]+?) increased to (\d+)/g)) {   // levelup.js shows skill rises itself
      const sk = skills.find((s) => m[1].endsWith(s)) || m[1].trim();
      banner("skill", "Skill increased", `${sk} ${m[2]}`, skillIcon(sk));
    }
    const q = text.match(/ ([^:]+): “([^”]+)” done/);
    if (q) banner("quest", "Quest completed", q[2], has("UIART") ? UIART.quest(LINE[q[1]] || "jobs", 36) : "");
    // Skyrim: the next quest in the line starts, with its first objective
    const no = text.match(/New objective: ([^.]+)\. ([^]*)$/);
    if (no) { banner("quest", "Quest started", no[1].trim(), q && has("UIART") ? UIART.quest(LINE[q[1]] || "jobs", 36) : ""); const first = no[2].split(/(?<=[.!?])\s/)[0]; if (first) banner("objective", "Objective", first.length > 80 ? first.slice(0, 77) + "…" : first, ""); }
    const lineDone = text.match(/ ([^!]+) complete!/);
    if (lineDone) banner("quest", "Questline completed", lineDone[1], "");
    const job = !q && text.match(/ Job done: ([^.]+)\./);
    if (job) banner("quest", "Job done", job[1], has("UIART") ? UIART.quest("jobs", 36) : "");
    const a = text.match(/ Achievement: (\S+) (.+)$/);
    if (a) banner("ach", "Achievement", a[2], achIcon(a[2]));
    const d = text.match(/ Discovered: ([^·]+?)(?: and \d+ more)? ·/);
    if (d) {
      const first = d[1].split(",")[0].trim();
      const pic = has("PLACEART") && typeof WORLD !== "undefined" && WORLD.places[first] ? miniPlace(first) : "";
      banner("place", "Discovered", d[1].trim(), pic);
    }
  }
  function achIcon(name) {
    if (!has("UIART") || typeof ACH === "undefined") return "";
    const a = (ACH.LIST || []).find((x) => name.includes(x[2]));
    return a ? UIART.ach(a[0], 36) : "";
  }
  function miniPlace(name) {
    // the full scene, shown small (cached by PLACEART/ART)
    const h = PLACEART.scene(name);
    return h.replace('class="art scene"', 'class="art pmini"');
  }
  function levelUp(level) {
    const ic = has("UIART") ? UIART.ach("level", 40) : "";
    banner("level", "Level up", `You reached level ${level}`, ic);
    burst();
  }
  function burst() {
    if (reduce || typeof document === "undefined") return;
    const el = document.createElement("div"); el.className = "pburst";
    for (let i = 0; i < 18; i++) { const s = document.createElement("i"); const a = (i / 18) * Math.PI * 2; s.style.setProperty("--dx", `${Math.cos(a) * (70 + (i % 3) * 30)}px`); s.style.setProperty("--dy", `${Math.sin(a) * (50 + (i % 4) * 22)}px`); s.style.animationDelay = `${(i % 5) * 30}ms`; el.appendChild(s); }
    document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
  }

  // ---- "+N gold" floating up from the purse
  function gold(delta) {
    if (!delta || typeof document === "undefined") return;
    const anchor = document.getElementById("goldv"); if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    if (!r.width) return;
    const el = document.createElement("div");
    el.className = `pgold ${delta > 0 ? "up" : "down"}`;
    el.textContent = `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
    const z = typeof FITCANVAS !== "undefined" ? FITCANVAS.zoom() : 1;   // the page may be zoomed (PC monitors, bigger text): screen px → page px
    el.style.left = `${Math.round((r.left - 4) / z)}px`; el.style.top = `${Math.round((r.top - 4) / z + window.scrollY / z)}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 900 : 1300);
  }

  // ---- toasts: an icon in front, and a little slide each time
  function toastIcon(text) {
    if (!has("UIART")) return "";
    if (/increased to \d+/.test(text)) { const m = text.match(/([A-Z][A-Za-z'\- ]+?) increased to/); const sk = (D.ALL_SKILLS || []).find((s) => m && m[1].endsWith(s)); if (sk) return UIART.skill(sk, 22); }
    if (/^|gold|Sold /.test(text) && has("ICONART")) return coin();
    return "";
  }
  function coin() {
    if (typeof ART === "undefined") return "";
    return ART.html(22, 22, (g, H) => { H.circle(g, 11, 11, 8.5, "#d6b25e", "#3b2c1e", 1.4); H.circle(g, 11, 11, 5.2, null, "#8a6a2a", 1); g.fillStyle = "#fff3c8"; g.fillRect(8, 7, 2, 2); }, { key: "ui-coin", cls: "tico" });
  }
  function toast(el, text) {
    if (!el) return;
    const ic = toastIcon(text);
    if (ic) { el.textContent = ""; el.insertAdjacentHTML("afterbegin", ic); el.appendChild(document.createTextNode(text)); el.classList.add("withic"); } else el.classList.remove("withic");
    fromText(text);
    if (reduce) return;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  }

  // ---- a soft fade-in when a tab's panel is swapped
  function swap(el) {
    if (reduce || !el) return;
    el.classList.remove("pswap"); void el.offsetWidth; el.classList.add("pswap");
  }

  return { banner, fromText, levelUp, gold, toast, swap, texture, burst };
})();
