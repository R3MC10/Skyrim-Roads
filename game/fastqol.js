/* Quicker travel and fights. [OURS]
   - Recent trips: the places you set off for lately, as one-tap chips on the travel screen, plus "↻ Again" (the
     last trip once more, when you're back where it started) or "↩ Back to …" (when you're where it ended).
   - Optional "carry on by itself" after road events and road fights: the result card counts down and closes on its
     own (waits for a fight replay to finish; any tap on the card stops the countdown). Off unless switched on.
   - Fight replays (fightart.js): ×1/×2/×4 speed and Skip to result; tap anywhere on a fight screen or result card to
     finish the animation that's playing. Reduce motion starts replays at ×2 and adds no new motion.
   - After a won road fight: if the loot made you too heavy, ask whether to keep it all or leave the heaviest new
     pieces behind (loot is picked up automatically, so "Loot all" is what already happens).
   - "Fight again" on the practice dummy (Tactics → Test fight) and "Challenge again" after an Arena bout.
   - Remembers the last pick in repeated prompts where it's harmless: the Arena bet and the test-fight foe.
   Nothing here changes a fight, its odds or its rewards; it only reads results and presses the game's own buttons. */
const FASTQOL = (() => {
  const KEY = "rotn_prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
  const setPref = (k, v) => { try { const p = prefs(); p[k] = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduce = () => { try { return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const place = (n) => typeof WORLD !== "undefined" && WORLD.places && Object.prototype.hasOwnProperty.call(WORLD.places, n) ? WORLD.places[n] : null;

  // ---------------------------------------------------------------- remembered picks
  const mem = (k, d) => { const m = prefs().fqMem || {}; return m[k] === undefined ? d : m[k]; };
  const setMem = (k, v) => { const m = { ...(prefs().fqMem || {}) }; m[k] = v; setPref("fqMem", m); };

  // ---------------------------------------------------------------- recent trips
  const MAX_RECENT = 6;
  /* after a trip starts: remember where it goes (named places only) and where it came from */
  function record(s, destName) {
    if (!s || !place(destName)) return;
    const from = s.trip && place(s.trip.origin) ? s.trip.origin : null;
    const r = s.fqTrips && typeof s.fqTrips === "object" ? s.fqTrips : {};
    const recent = [destName, ...(Array.isArray(r.recent) ? r.recent : []).filter((n) => n !== destName)].slice(0, MAX_RECENT);
    s.fqTrips = { last: { from, to: destName }, recent };
  }
  function wrapTrips() {
    if (typeof G === "undefined" || typeof G.startTrip !== "function" || G.startTrip.fq) return;
    const orig = G.startTrip;
    const w = function (s, destName) { const err = orig.apply(this, arguments); if (!err) { try { record(s, destName); } catch (e) { /* never block a trip */ } } return err; };
    w.fq = true; w.orig = orig; G.startTrip = w;
  }
  /* what the travel screen can offer: { again: {to, label} | null, recent: [names] } */
  function suggestions(s) {
    const r = s?.fqTrips; if (!r || s.dungeon) return { again: null, recent: [] };
    const here = [s.x, s.y];
    const ok = (n) => !!place(n) && n !== s.location && n !== s.trip?.destName && (!WORLD.same || WORLD.same(here, place(n)));
    let again = null; const L = r.last;
    if (L && !s.trip && L.from) {
      if (s.location === L.from && ok(L.to)) again = { to: L.to, label: `↻ Again: ${L.from} → ${L.to}` };
      else if (s.location === L.to && ok(L.from)) again = { to: L.from, label: `↩ Back to ${L.from}` };
    }
    const recent = (Array.isArray(r.recent) ? r.recent : []).filter((n) => ok(n) && n !== again?.to).slice(0, 4);
    return { again, recent };
  }
  function recentHTML(s) {
    const { again, recent } = suggestions(s);
    if (!again && !recent.length) return "";
    const chip = (n, label, cls = "") => `<button class="chip fqgo ${cls}" data-act="go" data-place="${esc(n)}">${esc(label)}</button>`;
    return `<div class="fqrecent"><small class="sub">Recent trips</small><div class="chips">${again ? chip(again.to, again.label, "on") : ""}${recent.map((n) => chip(n, n)).join("")}</div></div>`;
  }

  // ---------------------------------------------------------------- settings (ui.js settings screen)
  const SPEEDS = [1, 2, 4];
  const speed = () => { const v = prefs().fightSpeed; return SPEEDS.includes(v) ? v : reduce() ? 2 : 1; };
  const autoRoad = () => prefs().fqAutoRoad === true;
  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    return `<div class="setrow"><span>Replay speed</span>${seg("fightSpeed", SPEEDS.map((v) => [v, "×" + v]), speed())}</div>
      <div class="setrow"><span>After road events</span>${seg("fqAutoRoad", [[false, "Wait for me"], [true, "Carry on"]], autoRoad())}</div>`;
  }
  /* a settings button was pressed: true when it was ours */
  function pref(k, v) {
    if (k === "fightSpeed") { const n = +v; if (SPEEDS.includes(n)) setPref("fightSpeed", n); return true; }
    if (k === "fqAutoRoad") { setPref("fqAutoRoad", v === true || v === "true"); return true; }
    return false;
  }

  // ---------------------------------------------------------------- loot that's too heavy
  let nameMap = null;
  function itemsNamed(nm) {
    if (!nameMap) { nameMap = new Map(); for (const [id, it] of Object.entries(D.ITEMS || {})) { if (!it?.name) continue; if (!nameMap.has(it.name)) nameMap.set(it.name, []); nameMap.get(it.name).push(id); } }
    return nameMap.get(nm) || [];
  }
  const worn = (s) => { const out = new Set(); for (const lo of Object.values(s.loadouts || {})) for (const id of Object.values(lo.equipment || {})) out.add(id); return out; };
  /* the rows the loot list added: [{ id, item, qty, w }] heaviest first (never something you have equipped) */
  function newRows(s, loot) {
    const out = [], used = new Set(), eq = worn(s);
    for (const line of loot || []) {
      const m = String(line).match(/^(.*?)(?: ×(\d+))?$/), nm = m[1], q = +(m[2] || 1);
      const ids = itemsNamed(nm); if (!ids.length) continue;
      const rows = s.inv.filter((r) => ids.includes(r.item) && !eq.has(r.id) && !used.has(r.id)).sort((a, b) => b.id - a.id);
      let left = q;
      for (const r of rows) {
        if (left <= 0) break;
        const take = Math.min(left, r.qty), w = (D.ITEMS[r.item]?.weight || 0) * take;
        if (w > 0) out.push({ id: r.id, item: r.item, qty: take, w });
        used.add(r.id); left -= take;
      }
    }
    return out.sort((a, b) => b.w - a.w);
  }
  let pendingLoot = null;
  function lootHTML(s, r) {
    pendingLoot = null;
    if (!s || !r?.fight || r.died || r.fled || !(r.loot || []).length || typeof G === "undefined" || !G.overweight || !G.overweight(s)) return "";
    const rows = newRows(s, r.loot); if (!rows.length) return "";
    pendingLoot = { s, loot: r.loot.slice() };
    return `<div class="card fqloot" role="group" aria-label="Too heavy"><p style="margin:0 0 6px">🎒 <b>Too heavy now</b> · carrying <span class="num">${G.carried(s).toFixed(1)}/${G.capacity(s)}</span>. Keep it all and go slowly, or leave the heaviest new loot here?</p>
      <div class="grid2"><button class="btn" data-fq="lootkeep">Keep it all</button><button class="btn pri" data-fq="lootdrop">Leave the heavy stuff</button></div></div>`;
  }
  /* drop new loot, heaviest first, until you can move freely again -> the names left behind */
  function dropHeavy(s, loot) {
    const left = [];
    for (const r of newRows(s, loot)) {
      if (!G.overweight(s)) break;
      const it = D.ITEMS[r.item]; if (!it) continue;
      const per = it.weight || 0, over = G.carried(s) - G.capacity(s);
      const n = r.qty > 1 && per > 0 ? Math.max(1, Math.min(r.qty, Math.ceil(over / per))) : r.qty;   // a stack: only as many as needed
      if (G.take(s, r.id, n)) left.push(it.name + (n > 1 ? ` ×${n}` : ""));
    }
    return left;
  }

  // ---------------------------------------------------------------- Fight again
  /* kind "test": the practice dummy in Tactics; kind "duel": challenge the same player again */
  function againHTML(kind, id) {
    if (kind === "test") return `<button class="btn fqagain" data-act="test">⟳ Fight again</button>`;
    if (kind === "duel" && id) return `<button class="btn fqagain" data-act="duelgo" data-id="${esc(id)}" data-fqclose>⚔ Challenge again</button>`;
    return "";
  }

  // ---------------------------------------------------------------- the page: taps, countdowns
  let acT = null;
  function stopCountdown(m) { clearInterval(acT); acT = null; const b = m?.querySelector?.("[data-fqcd]"); if (b) { b.textContent = b.dataset.fqcd; delete b.dataset.fqcd; } }
  /* a result card on the road: count down and continue, unless you touch it */
  function armAutoRoad(m) {
    if (!autoRoad() || !m?.isConnected) return;
    const S = typeof window !== "undefined" && window.__dbg?.save ? window.__dbg.save() : null;
    if (!S || S.dungeon || S.trip?.status !== "travel") return;
    if (m.querySelector("[data-fq=lootdrop], [data-act=ev], [data-act=enc], input, select, textarea")) return;   // needs an answer
    const b = [...m.querySelectorAll('button[data-act="close"]')].find((x) => /^Continue to /.test(x.textContent.trim()));
    if (!b) return;
    stopCountdown(m);
    b.dataset.fqcd = b.textContent; let left = 6;
    const stop = () => stopCountdown(m);
    for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) m.addEventListener(ev, stop, { once: true, passive: true });
    acT = setInterval(() => {
      if (!m.isConnected || !b.isConnected) return stopCountdown(null);
      if (document.hidden || (typeof FIGHTART !== "undefined" && FIGHTART.playing && FIGHTART.playing())) { b.textContent = b.dataset.fqcd; return; }
      left--;
      if (left <= 0) { stopCountdown(m); b.click(); return; }
      b.textContent = `${b.dataset.fqcd} (${left})`;
    }, 1000);
  }
  function onClick(e) {
    const t = e.target; if (!t || !t.closest) return;
    const fq = t.closest("[data-fq]");
    if (fq) {
      const card = fq.closest(".fqloot");
      if (fq.dataset.fq === "lootkeep") { card?.remove(); pendingLoot = null; return; }
      if (fq.dataset.fq === "lootdrop" && pendingLoot) {
        const { s, loot } = pendingLoot; pendingLoot = null;
        const left = dropHeavy(s, loot);
        try { Store.save(s); } catch (x) { /* saved on the next tick */ }
        if (card) card.innerHTML = `<p class="sub" style="margin:0">${left.length ? `You leave ${esc(left.join(", "))} by the road.` : "Nothing new to leave."} Carrying <span class="num">${G.carried(s).toFixed(1)}/${G.capacity(s)}</span>${G.overweight(s) ? " · still too heavy" : ""}.</p>`;
        return;
      }
      return;
    }
    if (t.closest("[data-fqclose]")) { const m = t.closest("#modal"); if (m && m.isConnected && m.contains(t)) m.remove(); return; }
    // tap anywhere on a fight screen or result card: finish the animation that's playing
    if (typeof FIGHTART === "undefined" || !FIGHTART.playing || !FIGHTART.playing()) return;
    if (!t.closest("#tbf, #modal .sheet, #dun")) return;
    if (t.closest("button, a, input, select, textarea, summary, label, [data-act], [data-tba], [data-tbx], [data-tbm]")) return;
    FIGHTART.finishAll();
  }
  function init() {
    wrapTrips();
    if (typeof document === "undefined" || !document.addEventListener) return;
    document.addEventListener("click", onClick);
    if (typeof MutationObserver !== "undefined" && document.body) {
      new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.id === "modal") setTimeout(() => armAutoRoad(n), 60); }).observe(document.body, { childList: true });
    }
  }
  init();

  return { record, suggestions, recentHTML, settingsHTML, pref, speed, autoRoad, lootHTML, newRows, dropHeavy, againHTML, mem, setMem, armAutoRoad, wrapTrips };
})();
