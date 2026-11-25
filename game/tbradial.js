/* The combat wheel and the timing ring. [OURS]
   Remigiusz: "Interactive radial menu for combat actions as a minigame (not click-spam), with FX/VFX and numbers for
               resource use (magicka, stamina, health)."
   - Wheel: your moves sit in a ring around End turn. Each slice shows what it costs (stamina, magicka or health).
     Magic and Items still open their lists. Tap a slice, or drag it onto a target like before.
   - Timing ring: after picking a strike or a damage spell, a needle sweeps round a ring. Tap when it's in the bright
     zone: Perfect does 25% more, Good does normal damage, a miss does 20% less. Higher skill (and some perks) widen
     the zone. Fast mode, Auto and party members' turns skip it (normal damage).
   - Numbers: what you spent floats up from your frame (−25 SP, −40 MP) and the timing result over the scene.
   The wheel can be switched off with the  button (back to cards). Screen tests get cards unless the page has ?wheel. */
const TBRADIAL = (() => {
  const DOM = typeof document !== "undefined";
  const PERFECT = 1.25, GOOD = 1, POOR = 0.8;
  const SPIN = 1250;         // ms per turn of the needle
  const TURNS = 2.2;         // after this many turns it counts as a miss
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  function on() {
    const p = prefs();
    if (p.tbWheel === false) return false;
    if (DOM && typeof location !== "undefined" && /[?&]wheel\b/.test(location.search)) return true;
    if (p.tbWheel === true) return true;
    return !(typeof navigator !== "undefined" && navigator.webdriver);   // old screen tests use the cards
  }
  function toggle() {
    const p = prefs(); p.tbWheel = !on();
    try { localStorage.setItem("rotn_prefs", JSON.stringify(p)); } catch (e) { /* ignore */ }
    return p.tbWheel;
  }
  /* which skill aims this move */
  function skillFor(f, a, spell) {
    const s = f.s, sk = (n) => (typeof G !== "undefined" && G.skill ? G.skill(s, n) : 15);
    if (spell) return sk(spell.school || "Destruction");
    if (a === "bash") return sk("Block");
    return sk(f.weapon?.skill || (f.bound?.skill) || "Hand-to-Hand");
  }
  /* the zone: a quarter-ish of the ring at skill 15, a bit more with skill and perks; the perfect bit sits in the middle */
  function zone(skill, perk, seed) {
    const good = Math.min(0.42, (0.16 + Math.max(0, skill - 15) / 100 * 0.14) * (1 + (perk || 0)));
    const perfect = good * 0.3;
    const start = 0.2 + (seed == null ? Math.random() : seed) * (0.8 - good - 0.2);   // never right under the starting needle
    return { start, good, perfect, mid: start + good / 2 };
  }
  /* how well the tap landed: pos = where the needle is (0..1 of a turn) */
  function grade(z, pos) {
    if (pos == null) return { mult: POOR, label: "Mistimed", cls: "poor" };
    const p = ((pos % 1) + 1) % 1, d = Math.abs(p - z.mid);
    if (d <= z.perfect / 2) return { mult: PERFECT, label: "Perfect!", cls: "perfect" };
    if (d <= z.good / 2) return { mult: GOOD, label: "Good", cls: "good" };
    return { mult: POOR, label: "Mistimed", cls: "poor" };
  }
  /* is this a move the ring is for: a strike, or a spell or scroll aimed at the foe */
  const timed = (a, zoneOfA) => zoneOfA === "foe" && !/^(shout|power):/.test(a);

  // ------------------------------------------------------------------ the ring (returns a Promise of the grade)
  const arc = (r, a0, a1) => {
    const p = (a) => [50 + r * Math.sin(a * 2 * Math.PI), 50 - r * Math.cos(a * 2 * Math.PI)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  function ring(host, o) {
    return new Promise((done) => {
      if (!DOM || !host) return done(grade(o.z, o.z.mid));
      const z = o.z, el = document.createElement("div");
      el.className = "tbtime"; el.setAttribute("role", "button"); el.setAttribute("aria-label", "Tap when the needle is in the bright zone");
      el.innerHTML = `<div class="tbt-in"><svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="tr" cx="50" cy="50" r="40"/>
          <path class="tg" d="${arc(40, z.start, z.start + z.good)}"/>
          <path class="tp" d="${arc(40, z.mid - z.perfect / 2, z.mid + z.perfect / 2)}"/>
          <g class="tn"><line x1="50" y1="50" x2="50" y2="6"/><circle cx="50" cy="8" r="3.2"/></g>
          <circle class="th" cx="50" cy="50" r="5"/></svg>
        <b class="tl">${o.icon || ""} ${o.label || "Strike"}</b><small>Tap in the bright zone</small></div>`;
      host.appendChild(el);
      const needle = el.querySelector(".tn"), t0 = performance.now();
      let raf = 0, fin = false;
      const pos = () => (performance.now() - t0) / SPIN;
      const end = (p) => {
        if (fin) return; fin = true; cancelAnimationFrame(raf);
        const g = grade(z, p);
        el.classList.add("hit", g.cls); el.querySelector(".tl").textContent = g.label;
        if (navigator.vibrate) try { navigator.vibrate(g.cls === "perfect" ? [12, 30, 12] : 10); } catch (e) { /* ignore */ }
        setTimeout(() => { el.remove(); done(g); }, g.cls === "perfect" ? 380 : 240);
      };
      const frame = () => {
        const p = pos();
        needle.setAttribute("transform", `rotate(${((p % 1) * 360).toFixed(1)} 50 50)`);
        if (p >= TURNS) return end(null);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      el.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); end(pos()); });
      el.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); });
      const key = (ev) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); removeEventListener("keydown", key, true); end(pos()); } };
      addEventListener("keydown", key, true);
      setTimeout(() => removeEventListener("keydown", key, true), SPIN * TURNS + 50);
    });
  }

  // ------------------------------------------------------------------ numbers that float up
  function chip(x, y, text, cls, delay) {
    const s = document.createElement("span");
    s.className = "tbspend " + cls; s.textContent = text;
    s.style.left = x + "px"; s.style.top = y + "px"; s.style.animationDelay = (delay || 0) + "ms";
    document.body.appendChild(s); setTimeout(() => s.remove(), 1500 + (delay || 0));
  }
  /* what you spent, from your frame; and how the timing went, over the scene */
  function spent(d, g) {
    if (!DOM) return;
    const me = document.querySelector("#tbf .tbu.me") || document.querySelector("#tbf .tbap"), stage = document.querySelector("#tbf .tbstage");
    if (me) {
      const r = me.getBoundingClientRect(); let i = 0;
      /* [rigpolish] on the immersive screen your name sits at the top of this frame: the numbers start above the name
         and the orb (never on top of them), and line up from the orb's middle to the right */
      const orb = me.querySelector(".c2orb"), nm = me.querySelector(".nm");
      const top = Math.min(r.top, nm ? nm.getBoundingClientRect().top : r.top, orb ? orb.getBoundingClientRect().top : r.top);
      const x0 = orb ? orb.getBoundingClientRect().left + orb.getBoundingClientRect().width / 2 : null;
      const put = (n, tag, cls) => { if (Math.abs(n) >= 1) chip(x0 != null ? Math.min(innerWidth - 50, Math.max(40, x0 + 80 * (i % 4))) : r.left + r.width * (0.2 + 0.2 * (i % 4)), x0 != null ? top - 24 : r.top - 4, `${n > 0 ? "+" : "−"}${Math.abs(Math.round(n))} ${tag}`, cls, 120 * i++); };
      put(-d.sp, "SP", "sp"); put(-d.mp, "MP", "mp"); put(d.hp, "HP", d.hp > 0 ? "hp up" : "hp");
    }
    if (g && stage) {
      const r = stage.getBoundingClientRect();
      chip(r.left + r.width / 2, r.top + r.height * 0.3, g.label + (g.mult > 1 ? " +25%" : g.mult < 1 ? " −20%" : ""), "grade " + g.cls, 0);
      if (g.cls === "perfect") { stage.classList.remove("perfect"); void stage.offsetWidth; stage.classList.add("perfect"); setTimeout(() => stage.classList.remove("perfect"), 700); }
    }
  }

  // ------------------------------------------------------------------ the wheel
  /* slices: [html of a .tbact button] ... laid out round the centre button */
  function wheel(slices, centre) {
    const n = slices.length;
    const size = Math.min(27, 190 / Math.max(n, 1)), R = 50 - size / 2 - 1.5;   // slices shrink a little when there are many
    const at = (i) => { const t = (2 * Math.PI * i) / n; return `left:${(50 + R * Math.sin(t)).toFixed(2)}%;top:${(50 - R * Math.cos(t)).toFixed(2)}%;width:${size.toFixed(1)}%;height:${size.toFixed(1)}%`; };
    return `<div class="tbwheel" style="--n:${n}">${slices.map((b, i) => `<div class="tbsl" style="${at(i)}">${b}</div>`).join("")}<div class="tbhub">${centre}</div></div>`;
  }
  /* the cost line under a slice: c = { sp, mp, hp } from tbfight.js cost() */
  function costLine(f, a, c) {
    if (!c || typeof c !== "object") return "";
    const bits = [];
    if (c.sp > 0) bits.push(Math.round(c.sp) + " SP"); if (c.mp > 0) bits.push(Math.round(c.mp) + " MP"); if (c.hp > 0) bits.push(Math.round(c.hp) + " HP");
    return bits.length ? bits.join(" · ") : "free";
  }
  return { on, toggle, skillFor, zone, grade, timed, ring, spent, wheel, costLine, PERFECT, GOOD, POOR, SPIN, TURNS };
})();
if (typeof module !== "undefined") module.exports = TBRADIAL;
