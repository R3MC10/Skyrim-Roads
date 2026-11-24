/* holdui.js: the Holds screen for player-run holds (holdrule.js). [OURS]
   Social → Realm → Holds: the nine holds as a SkyUI list beside the holds map, and the picked hold's page: who rules,
   the Jarl and their term, the tax, the treasury, walls and guards, the raid window, and what you can do there
   (challenge the champion, raid, vote, set the tax, spend the treasury). Two columns on a PC, one on a phone.
   A line on every town's page says who rules its hold and what tax you pay. Ink pictures only. */
const HOLDUI = (() => {
  const H = HOLDRULE;
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;
  let api = null, pick = null, pubT = null;
  const S = () => api?.S?.() || null;
  const online = () => typeof Store !== "undefined" && Store.online;
  const role = (s) => { try { return typeof PARTYPLAY !== "undefined" && api?.party ? PARTYPLAY.role(s, api.party()) : "solo"; } catch { return "solo"; } };
  function span(ms) {
    ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m} min`;
  }
  function publish(now) {
    const s = S(); if (!s || !online()) return;
    clearTimeout(pubT);
    const go = () => { const st = S(); if (st && online()) Store.put("holds", st.id, H.record(st)); };
    if (now) go(); else pubT = setTimeout(go, 1500);
  }
  const clanOf = (s) => (s && typeof CLANS !== "undefined" ? CLANS.of(s.id, s) : null);

  // ---------------------------------------------------------------- ink pictures
  /* the hold's keep: walls standing or broken, guards on the walls, the ruling side's banner on the tower */
  function keepArt(seat, fx, w = 300, h = 120) {
    if (typeof ART === "undefined") return "";
    const walls = seat ? seat.walls : H.WALLS, cols = seat ? seat.clan.colors : ["#cdb98f", "#cdb98f"], guards = fx?.guards || 0;
    return ART.html(w, h, (g, P) => {
      const ink = P.ink || "#3b2c1e";
      g.fillStyle = P.parch || "#e9dcc0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(59,44,30,.18)"; g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, 20 + i * 12 + (i % 3)); g.bezierCurveTo(w * 0.3, 14 + i * 12, w * 0.7, 26 + i * 12, w, 18 + i * 12); g.stroke(); }   // paper grain
      g.fillStyle = "rgba(61,93,54,.35)"; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h - 22); g.quadraticCurveTo(w * 0.5, h - 40, w, h - 20); g.lineTo(w, h); g.fill();   // the hill
      g.strokeStyle = ink; g.lineJoin = "round"; g.lineWidth = 1.6;
      // the keep
      const kx = w * 0.5 - 26, ky = 22;
      g.fillStyle = "#b9a98d"; g.fillRect(kx, ky, 52, 64); g.strokeRect(kx, ky, 52, 64);
      for (let i = 0; i < 5; i++) { g.fillRect(kx + i * 11, ky - 7, 8, 7); g.strokeRect(kx + i * 11, ky - 7, 8, 7); }
      g.fillStyle = ink; g.beginPath(); g.arc(kx + 26, ky + 54, 9, Math.PI, 0); g.lineTo(kx + 35, ky + 64); g.lineTo(kx + 17, ky + 64); g.fill();
      g.fillRect(kx + 12, ky + 18, 5, 9); g.fillRect(kx + 35, ky + 18, 5, 9);
      // the banner
      g.beginPath(); g.moveTo(kx + 26, ky - 7); g.lineTo(kx + 26, ky - 22); g.stroke();
      g.fillStyle = cols[0]; g.beginPath(); g.moveTo(kx + 26, ky - 22); g.lineTo(kx + 44, ky - 22); g.lineTo(kx + 40, ky - 17); g.lineTo(kx + 44, ky - 12); g.lineTo(kx + 26, ky - 12); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = cols[1]; g.fillRect(kx + 27, ky - 16, 12, 2);
      // the curtain wall: WALLS_MAX sections either side, standing or rubble
      const sec = H.WALLS_MAX, sw = (w * 0.5 - 40) / sec, wy = h - 46;
      for (let side = 0; side < 2; side++) for (let i = 0; i < sec; i++) {
        const x = side ? w * 0.5 + 32 + i * sw : w * 0.5 - 32 - (i + 1) * sw, up = i < walls;
        if (up) {
          g.fillStyle = "#cdb98f"; g.fillRect(x + 1, wy, sw - 2, 24); g.strokeRect(x + 1, wy, sw - 2, 24);
          g.fillRect(x + 3, wy - 5, (sw - 6) / 2 - 1, 5); g.strokeRect(x + 3, wy - 5, (sw - 6) / 2 - 1, 5);
          g.beginPath(); g.moveTo(x + 2, wy + 12); g.lineTo(x + sw - 2, wy + 12); g.stroke();
        } else {
          g.fillStyle = "#8f7a66"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + 4 + k * (sw - 8) / 3, wy + 20 - (k % 2) * 3, 3 + (k % 2), 0, Math.PI * 2); g.fill(); g.stroke(); }
        }
      }
      // guards: little spears on the walls
      for (let k = 0; k < guards * 2; k++) {
        const gx = k % 2 ? w * 0.5 + 40 + (k >> 1) * 14 : w * 0.5 - 40 - (k >> 1) * 14, gy = wy - 14;
        g.fillStyle = ink; g.beginPath(); g.arc(gx, gy, 2.4, 0, Math.PI * 2); g.fill(); g.fillRect(gx - 2, gy + 2, 4, 7);
        g.beginPath(); g.moveTo(gx + 4, gy - 8); g.lineTo(gx + 4, gy + 9); g.stroke(); g.beginPath(); g.moveTo(gx + 2, gy - 6); g.lineTo(gx + 4, gy - 10); g.lineTo(gx + 6, gy - 6); g.fill();
      }
      g.strokeRect(1, 1, w - 2, h - 2);
    }, { key: `keep|${walls}|${guards}|${cols.join("")}|${w}x${h}`, cls: "hr-keep", alt: seat ? `The keep of ${seat.hold}` : "An unclaimed keep", style: "ink" });
  }
  const bannerOf = (c, w = 34, h = 48) => (c && typeof RAIDART !== "undefined" ? RAIDART.clanBanner(c, w, h) : c ? `<span class="banner" style="background:linear-gradient(180deg,${c.colors[0]} 0 58%,${c.colors[1]} 58% 100%)" aria-hidden="true"></span>` : `<span class="banner hr-none" aria-hidden="true"></span>`);

  // ---------------------------------------------------------------- the screen
  function rowHTML(s, hold, seats, t) {
    const seat = seats[hold], rul = typeof WARS !== "undefined" ? WARS.rulers(s)[hold] : null, here = H.holdHere(s) === hold, mine = seat && clanOf(s)?.id === seat.cid;
    const who = seat ? `${esc(seat.clan.tag)}` : rul ? `${esc(rul.tag)}*` : "—";
    const tax = seat ? pct(H.taxOf(seat, t, s)) : "—";
    return `<button class="hr-row${pick === hold ? " on" : ""}${mine ? " mine" : ""}" data-hact="pick" data-h="${esc(hold)}" aria-pressed="${pick === hold}">
      <span class="hr-chip" style="background:${seat ? seat.clan.colors[0] : rul ? rul.colors[0] : "transparent"}"></span><span class="hr-n">${esc(hold)}${here ? ` <small class="hr-here">· you're here</small>` : ""}</span><span class="hr-who num">${who}</span><span class="hr-tax num">${tax}</span></button>`;
  }
  function statRow(label, value, cls = "") { return `<div class="hr-stat${cls ? " " + cls : ""}"><span>${label}</span><b>${value}</b></div>`; }
  function detailHTML(s, hold, t) {
    const seat = H.seatOf(hold, t, s), c = clanOf(s), fx = H.effects(seat, t, s), win = H.windowAt(t);
    const rul = typeof WARS !== "undefined" ? WARS.rulers(s)[hold] : null;
    const head = `<div class="hr-head">${bannerOf(seat?.clan || null)}<div><h3>${esc(hold)}</h3><span class="sub">${seat ? `Ruled by ${esc(seat.clan.name)} [${esc(seat.clan.tag)}]` : rul ? `Looked after by ${esc(rul.name)} [${esc(rul.tag)}] (top side last week). Nobody holds the Jarl's seat.` : "Nobody holds the Jarl's seat."}</span></div></div>`;
    const stats = [];
    let acts = "";
    if (seat) {
      const j = H.jarlOf(seat, t, s), tr = H.treasury(seat, t, s), mine = c && c.id === seat.cid;
      stats.push(statRow("Jarl", `${esc(j?.name || "—")}${j?.acting ? " (acting)" : j ? ` (${j.votes} vote${j.votes === 1 ? "" : "s"})` : ""}`));
      stats.push(statRow("Term ends in", span(H.termEnds(t) - t)));
      stats.push(statRow("Tax on shop sales", pct(H.taxOf(seat, t, s)) + (mine ? " (not for members)" : H.yourTax(s, seat, t) < H.taxOf(seat, t, s) ? ` (you pay ${pct(H.yourTax(s, seat, t))})` : "")));
      stats.push(statRow("Treasury", `${tr.balance} gold`, "gold"));
      stats.push(statRow("Walls", `${seat.walls} / ${H.WALLS_MAX}`));
      stats.push(statRow("Guards", fx.guards ? `${fx.guards} hire${fx.guards > 1 ? "s" : ""}` : "none"));
      if (fx.market) stats.push(statRow("Market discount", `5% off for ${span(fx.marketEnds - t)}`, "good"));
      stats.push(statRow("Safe from raids", H.locked(seat, t) ? "until next week's window" : win.open ? "no: raids are on now" : `until the window opens in ${span(win.opens - t)}`));
      if (mine) acts += voteHTML(s, seat, t) + (j && j.uid === s.id ? jarlHTML(s, seat, tr, fx, t) : "");
    } else {
      stats.push(statRow("Tax on shop sales", "none"));
      stats.push(statRow("Claim", "Beat the hold's champion"));
    }
    const pts = c && typeof WARS !== "undefined" ? H.warPts(s, hold, c.id) : 0;
    if (c) stats.push(statRow("Your side's war points here", `${pts} / ${WARS.MIN_TO_RULE}`, pts >= WARS.MIN_TO_RULE ? "good" : ""));
    const can = H.canFight(s, hold, t, { role: role(s) });
    if (can.kind) {
      const label = can.kind === "claim" ? "\uE101 Challenge the champion" : "\uE101 Raid the hold";
      acts = `<div class="hr-act"><button class="btn ${can.why ? "" : "danger"}" data-hact="fight" data-h="${esc(hold)}" ${can.why ? "disabled" : ""}>${label}</button><p class="sub">${esc(can.why || (can.kind === "claim" ? `A hard fight. Win and ${c ? `${c.name} rules ${hold}` : "your side rules it"}. ${H.CLAIM_GOLD} gold.` : `Each win knocks down a wall (${seat.walls} left). Win with no walls left to take the hold. ${H.RAID_GOLD} gold a win.`))}</p></div>` + acts;
    }
    return `${head}${keepArt(seat, fx)}<div class="hr-stats">${stats.join("")}</div>${acts}`;
  }
  function voteHTML(s, seat, t) {
    const list = H.nextCount(seat, t), mine = H.st(s).votes[seat.hold]?.c;
    return `<div class="hr-box"><h4>Vote for Jarl</h4><p class="sub">Votes standing when a term starts pick the Jarl for that term (half a week). Next count in ${span(H.termEnds(t) - t)}.</p>
      ${list.map((m) => `<div class="hr-cand${m.id === mine ? " on" : ""}"><span>${esc(m.name)}${m.id === s.id ? " <small>(you)</small>" : ""}</span><span class="num">${m.n}</span><button class="btn sm${m.id === mine ? " pri" : ""}" data-hact="vote" data-h="${esc(seat.hold)}" data-id="${esc(m.id)}" ${m.id === mine ? "disabled" : ""}>${m.id === mine ? "Your vote" : "Vote"}</button></div>`).join("")}</div>`;
  }
  function jarlHTML(s, seat, tr, fx, t) {
    const tax = H.taxOf(seat, t, s), steps = [];
    for (let r = 0; r <= H.TAX_MAX + 1e-9; r += H.TAX_STEP) steps.push(Math.round(r * 100) / 100);
    const sp = Object.entries(H.SPEND).map(([k, v]) => {
      const why = tr.balance < v.cost ? `Needs ${v.cost} gold` : k === "guards" && fx.guards >= v.max ? "As many as the hold can feed" : k === "repair" && seat.walls >= H.WALLS_MAX ? "Walls are at full strength" : "";
      return `<div class="hr-spend"><div><b>${esc(v.name)}</b><span class="sub">${esc(v.what)}</span></div><button class="btn sm" data-hact="spend" data-h="${esc(seat.hold)}" data-id="${k}" ${why ? "disabled" : ""}>${why ? esc(why) : `${v.cost} gold`}</button></div>`;
    }).join("");
    return `<div class="hr-box jarl"><h4>You are the Jarl</h4><p class="sub">Set the tax shoppers who aren't on your side pay here, and spend the treasury.</p>
      <div class="hr-taxrow" role="group" aria-label="Tax">${steps.map((r) => `<button class="chip${Math.abs(r - tax) < 1e-9 ? " on" : ""}" data-hact="tax" data-h="${esc(seat.hold)}" data-id="${r}">${Math.round(r * 100)}%</button>`).join("")}</div>${sp}</div>`;
  }
  function windowLine(t) {
    const w = H.windowAt(t);
    return w.open ? `\uE101 The raid window is open: ${span(w.closes - t)} left.` : `The raid window opens on Saturday at 12:00 UTC (in ${span(w.opens - t)}).`;
  }
  /* Social → Realm: the whole Holds panel */
  function panel(s) {
    if (!s) return "";
    const t = H.now(), seats = H.seats(t, s), holds = Object.keys(WORLD.holds);
    if (!pick || !holds.includes(pick)) pick = holds.includes(H.holdHere(s)) ? H.holdHere(s) : Object.keys(seats)[0] || holds[0];
    const rul = typeof WARS !== "undefined" ? WARS.rulers(s) : {};
    const intro = clanOf(s) ? "Sides claim a hold by beating its champion. Members vote for a Jarl, who sets a small tax on shop sales and spends it on the hold. Other sides can raid once a week." : "Sides rule the holds. You only notice it in the shops: outsiders pay the ruling side's small tax. Pick a side (Social → Faction) to take part.";
    return `<div class="panel hr-panel"><h2>Holds</h2><p class="sub">${intro} ${windowLine(t)}</p>
      <div class="hr-grid"><div class="hr-side">${typeof RAIDART !== "undefined" ? RAIDART.holdsMap(rul) : ""}
        <div class="hr-list" role="list"><div class="hr-lh"><span></span><span>Hold</span><span>Side</span><span>Tax</span></div>${holds.map((h) => rowHTML(s, h, seats, t)).join("")}</div>
        <p class="sub hr-foot">* looked after by last week's top side, no Jarl yet.</p></div>
      <div class="hr-detail" id="hr-detail">${detailHTML(s, pick, t)}</div></div></div>`;
  }
  /* a line on the town page */
  function townLine(s, place) {
    if (!s || !WORLD.places[place] || !["city", "town"].includes(WORLD.places[place][2])) return "";
    const hold = G.holdAt(WORLD.places[place]), t = H.now(), seat = H.seatOf(hold, t, s);
    if (!seat) return "";
    const j = H.jarlOf(seat, t, s), you = H.yourTax(s, seat, t), fx = H.effects(seat, t, s);
    const tax = clanOf(s)?.id === seat.cid ? "your side pays no tax" : you > 0 ? `${pct(you)} tax on what you buy` : "no tax for you";
    return `<p class="sub hr-town"><span class="hr-chip" style="background:${seat.clan.colors[0]}"></span>${esc(hold)} is ruled by ${esc(seat.clan.name)} [${esc(seat.clan.tag)}] · Jarl ${esc(j?.name || "—")} · ${tax}${fx.market ? " · market 5% off" : ""}.</p>`;
  }

  // ---------------------------------------------------------------- taps
  function after(r) {
    const s = S(); if (!s) return;
    if (r.err) { api.toast(r.err); return; }
    if (r.text) api.toast(r.text);
    publish(true); api.persist?.(true); api.refresh?.();
  }
  function doFight(hold) {
    const s = S(); if (!s) return;
    const fn = () => H.fight(s, hold, H.now(), { role: role(s) });
    const done = (out) => {
      if (!out.fight) { api.toast(out.text); return; }
      if (out.bag && typeof Store !== "undefined") Store.addBag(out.bag);
      publish(true);
      const c = clanOf(s);
      if (out.took && c) api.postNews?.(`⚑ ${s.name} won ${hold} for ${c.name} [${c.tag}].`);
      api.persist?.(true); api.refresh?.();
      api.showFightResult({ ...out });
    };
    if (typeof TB !== "undefined" && TB.call) TB.call(s, fn, done); else done(fn());
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest("[data-hact]"); if (!b || b.disabled || !S()) return;
    e.preventDefault(); e.stopPropagation();
    const h = b.dataset.h, s = S();
    if (typeof SOUND !== "undefined") try { SOUND.fx("click"); } catch { /* fine */ }
    switch (b.dataset.hact) {
      case "pick": pick = h; api.refresh?.(); break;
      case "fight": doFight(h); break;
      case "vote": after(H.vote(s, h, b.dataset.id)); break;
      case "tax": after(H.setTax(s, h, +b.dataset.id)); break;
      case "spend": { const r = H.spend(s, h, b.dataset.id); after(r); if (!r.err && b.dataset.id === "market") api.postNews?.(`⚑ Shops in ${h} sell 5% cheaper for 3 days, by order of Jarl ${s.name}.`); break; }
    }
  }
  function mount(a) {
    api = a;
    H.onPaid = () => publish(false);
    if (typeof Store !== "undefined") Store.watch("holds", (docs) => { H.setDocs(docs, S()); });
    if (!mount.bound && typeof document !== "undefined") { document.addEventListener("click", onClick, true); mount.bound = true; }
    const s = S(); if (s && s.holdrule) H.setDocs(null, s);
  }
  return { mount, panel, townLine, detailHTML, keepArt, publish, get pick() { return pick; }, set pick(v) { pick = v; } };
})();
