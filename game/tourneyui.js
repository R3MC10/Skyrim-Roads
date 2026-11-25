/* tourneyui.js: the festival and Grand Arena screens (rules in tourney.js). [OURS]
   - Every city and town has a "Festivals" place: what's on now and next, the prizes waiting for you, who you stand for,
     and in the host town the contests themselves, each with its live board, friendly duels with other players, and
     hold and clan glory. Windhelm also has the Grand Arena (the Pit): rounds of monsters, alone or with your party.
   - The contests open the game's own mini-games (crafting games, mining game), a fishing-derby card and a drinking card.
   - Your festival record goes to the shared "fest" collection, so every phone shows the same boards.
   - Ink pictures: festival banners and stalls in the festival's colours, the Pit's sand ring; the map shows a festival
     banner over the host town while it's announced or on. Two columns on a PC, one on a phone. */
const TOURNEYUI = (() => {
  const T = TOURNEY;
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);
  const DOM = typeof document !== "undefined";
  let api = null, pubT = null, docs = [];
  const S = () => api?.S?.() || null;
  const online = () => typeof Store !== "undefined" && Store.online;
  const role = (s) => { try { return typeof PARTYPLAY !== "undefined" && api?.party ? PARTYPLAY.role(s, api.party()) : "solo"; } catch { return "solo"; } };
  function span(ms) {
    ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(1, m)} min`;
  }
  const day = (ms) => { try { return new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch { return ""; } };
  /* send your records (this festival and this Pit week) to everyone */
  function publish(now) {
    const s = S(); if (!s || !online()) return;
    clearTimeout(pubT);
    const go = () => {
      const st = S(); if (!st || !online()) return;
      const keys = [T.current()?.key, T.pitKey()].filter((k) => k && T.entry(st, k, false));
      for (const fk of keys) { const r = T.record(st, fk); if (r) Store.put("fest", `${st.id}|${fk}`, r); }
    };
    if (now) go(); else pubT = setTimeout(go, 1500);
  }
  const isTown = (l) => typeof WORLD !== "undefined" && WORLD.places[l] && ["city", "town"].includes(WORLD.places[l][2]);

  // ---------------------------------------------------------------- ink pictures
  /* the festival field: striped tents, a bunting line, the banner pole in the festival colours */
  function banner(f, w = 320, h = 110, on = true) {
    if (typeof ART === "undefined" || !f) return "";
    const [c1, c2] = f.colors;
    return ART.html(w, h, (g, P) => {
      const ink = P.ink || "#3b2c1e";
      g.fillStyle = P.parch || "#e9dcc0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(59,44,30,.16)"; g.lineWidth = 1; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, 12 + i * 13); g.bezierCurveTo(w * 0.35, 8 + i * 13, w * 0.65, 18 + i * 13, w, 11 + i * 13); g.stroke(); }
      g.fillStyle = "rgba(90,110,70,.30)"; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h - 26); g.quadraticCurveTo(w * 0.5, h - 38, w, h - 24); g.lineTo(w, h); g.fill();   // the field
      g.strokeStyle = ink; g.lineWidth = 1.5; g.lineJoin = "round";
      // tents (stalls)
      const tents = [[0.14, 34], [0.36, 40], [0.64, 38], [0.86, 32]];
      tents.forEach(([fx, tw], i) => {
        const x = w * fx, base = h - 26 - (i % 2) * 4, top = base - tw * 0.9;
        g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(x - tw / 2, base); g.lineTo(x, top); g.lineTo(x + tw / 2, base); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = i % 2 ? c1 : c2; for (let k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(x, top); g.lineTo(x + k * tw * 0.18, base); g.lineTo(x + k * tw * 0.32, base); g.closePath(); g.fill(); }
        g.fillStyle = ink; g.beginPath(); g.moveTo(x - 4, base); g.lineTo(x, base - 9); g.lineTo(x + 4, base); g.fill();   // the door
        g.beginPath(); g.moveTo(x, top); g.lineTo(x, top - 7); g.stroke();
        g.fillStyle = c1; g.beginPath(); g.moveTo(x, top - 7); g.lineTo(x + 7, top - 5); g.lineTo(x, top - 3); g.fill();
      });
      // bunting across the top
      g.beginPath(); g.moveTo(0, 10); g.quadraticCurveTo(w / 2, 30, w, 10); g.stroke();
      for (let i = 1; i < 14; i++) { const t = i / 14, x = w * t, y = 10 + 40 * t * (1 - t); g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x, y + 8); g.closePath(); g.fill(); g.stroke(); }
      // the great banner in the middle
      const bx = w / 2;
      g.beginPath(); g.moveTo(bx, h - 24); g.lineTo(bx, 26); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(bx + 1, 30); g.lineTo(bx + 26, 30); g.lineTo(bx + 26, 64); g.lineTo(bx + 13, 56); g.lineTo(bx + 1, 64); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = c2; g.beginPath(); g.moveTo(bx + 13, 36); g.lineTo(bx + 19, 44); g.lineTo(bx + 13, 52); g.lineTo(bx + 7, 44); g.closePath(); g.fill(); g.stroke();   // the emblem
      if (!on) { g.fillStyle = "rgba(233,220,192,.45)"; g.fillRect(0, 0, w, h); }
    }, { key: `fest|${f.id}|${w}x${h}|${on ? 1 : 0}`, cls: "tn-art", alt: f.name, style: "ink" });
  }
  /* the Pit: a sunken sand ring, the crowd on the terraces, a portcullis */
  function pitArt(w = 320, h = 110) {
    if (typeof ART === "undefined") return "";
    return ART.html(w, h, (g, P) => {
      const ink = P.ink || "#3b2c1e";
      g.fillStyle = P.parch || "#e9dcc0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = ink; g.lineWidth = 1.5;
      for (let r = 0; r < 3; r++) { g.fillStyle = r % 2 ? "#b9a98d" : "#cdb98f"; g.beginPath(); g.ellipse(w / 2, h * 0.62, w * 0.46 - r * 22, h * 0.36 - r * 9, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.fillStyle = "#d9c48f"; g.beginPath(); g.ellipse(w / 2, h * 0.64, w * 0.3, h * 0.2, 0, 0, Math.PI * 2); g.fill(); g.stroke();   // the sand
      g.fillStyle = ink;
      for (let i = 0; i < 26; i++) { const a = Math.PI * (1.05 + 0.9 * i / 25), x = w / 2 + Math.cos(a) * w * 0.41, y = h * 0.62 + Math.sin(a) * h * 0.31; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }   // the crowd
      g.fillStyle = "#6b5a48"; g.fillRect(w / 2 - 14, h * 0.18, 28, 18); g.strokeRect(w / 2 - 14, h * 0.18, 28, 18);
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(w / 2 - 11 + i * 5.5, h * 0.18); g.lineTo(w / 2 - 11 + i * 5.5, h * 0.18 + 18); g.stroke(); }
      // two fighters
      const fx = (x, flip) => { g.beginPath(); g.arc(x, h * 0.56, 3.5, 0, 7); g.fill(); g.beginPath(); g.moveTo(x, h * 0.6); g.lineTo(x, h * 0.72); g.moveTo(x, h * 0.64); g.lineTo(x + 8 * flip, h * 0.58); g.stroke(); };
      fx(w / 2 - 20, 1); g.fillStyle = "#5a3a2a"; g.beginPath(); g.ellipse(w / 2 + 22, h * 0.66, 14, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = ink;
    }, { key: `pit|${w}x${h}`, cls: "tn-art", alt: "The Grand Arena", style: "ink" });
  }
  /* the painted header (fest-<id>.webp, 1600x600; the Grand Arena is fest-arena): shown when the picture has loaded, with the title on a soft dark vignette.
     Returns "" while it's missing or loading, and the ink drawing stands in. */
  function painted(id, titleHTML, on = true) {
    let u = "";
    try { u = typeof ASSETS !== "undefined" ? ASSETS.url("fest-" + id) : ""; } catch { u = ""; }
    if (!u) return "";
    return `<div class="tn-pic${on ? "" : " tn-off"}" role="img" aria-label="${esc(id)}" style="background-image:url('${u}')"><div class="tn-pt">${titleHTML}</div></div>`;
  }
  /* a small banner chip for a festival on the map and in lists */
  const chip = (f) => `<span class="tn-chip" style="background:linear-gradient(180deg,${f.colors[0]} 0 60%,${f.colors[1]} 60%)" aria-hidden="true"></span>`;

  // ---------------------------------------------------------------- the screens
  function repHTML(s) {
    const r = T.st(s).rep || { k: "self" };
    const clan = typeof CLANS !== "undefined" ? CLANS.of(s.id, s) : null;
    const holds = typeof WORLD !== "undefined" ? Object.keys(WORLD.holds) : [];
    return `<div class="tn-rep"><span class="sub">You compete for</span>
      <button class="btn sm${r.k === "self" ? " pri" : ""}" data-tact="rep" data-k="self">Yourself</button>
      ${clan ? `<button class="btn sm${r.k === "clan" ? " pri" : ""}" data-tact="rep" data-k="clan">[${esc(clan.tag)}]</button>` : ""}
      <select class="tn-hold" data-tact-sel="hold" aria-label="Your hold"><option value="">A hold…</option>${holds.map((h) => `<option value="${esc(h)}" ${r.k === "hold" && r.name === h ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></div>`;
  }
  function boardHTML(rows, s, n = 5) {
    const mine = T.rankOf(rows, s.id), top = rows.slice(0, n);
    const row = (r, i) => `<li class="${r.id === s.id ? "me" : ""}${r.npc ? " npc" : ""}"><span class="num">${i + 1}.</span><span class="tn-n">${esc(r.name)}${r.title && !r.npc ? ` <small>· ${esc(r.title)}</small>` : ""}${r.rep && r.rep.k !== "self" ? ` <small class="tn-rp">${esc(T.repName(r.rep))}</small>` : ""}${r.team && r.team.length ? ` <small>+${r.team.length}</small>` : ""}</span><b class="num">${r.score}</b></li>`;
    return `<ol class="tn-board">${top.map(row).join("")}${mine >= n ? `<li class="tn-gap">…</li>${row(rows[mine], mine)}` : ""}</ol>`;
  }
  function contestHTML(s, c, kind) {
    const C = T.CONTESTS[kind], e = T.entry(s, c.key, false), best = e?.sc?.[kind], left = T.triesLeft(s, c.key, kind), no = T.why(s, kind);
    const rows = T.board(c.key, kind, docs, s);
    return `<div class="tn-card" data-kind="${kind}"><div class="tn-ch"><span class="tn-ic" aria-hidden="true">${C.icon}</span><b>${esc(C.name)}</b><span class="sub num">${best != null ? `best ${best}` : "no score yet"} · ${left} ${left === 1 ? "try" : "tries"} left</span></div>
      <p class="sub">${esc(C.what)}</p>${boardHTML(rows, s)}
      <button class="btn pri sm tn-go" data-tact="try" data-k="${kind}" ${no ? "disabled" : ""}>${kind === "duel" ? "Step into the ring" : "Have a go"}</button>${no && T.here(s, c.place) ? `<p class="sub tn-why">${esc(no)}</p>` : ""}</div>`;
  }
  function duelsHTML(s, c) {
    const others = T.docsFor(c.key, docs).filter((d) => d.uid !== s.id && d.snap);
    const rec = T.duelRecord(s, c.key, docs), e = T.entry(s, c.key, false);
    const here = T.here(s, c.place);
    return `<div class="tn-card tn-duels"><div class="tn-ch"><span class="tn-ic" aria-hidden="true">\uE198</span><b>Friendly duels</b><span class="sub num">${rec.w} won · ${rec.l} lost</span></div>
      <p class="sub">Duel any player at the festival, whatever side they're on. No stake, no bounty, no grudges: ${T.PAIR_MAX} bouts per pair, and wins count for your hold or clan.</p>
      ${others.length ? others.map((d) => { const n = (e?.duels || []).filter((x) => x.vs === d.uid).length;
        return `<div class="item"><div class="t">${esc(d.name)}${d.title ? ` <small>· ${esc(d.title)}</small>` : ""}<span>${d.rep && d.rep.k !== "self" ? `for ${esc(T.repName(d.rep))} · ` : ""}${n}/${T.PAIR_MAX} bouts</span></div><button class="btn sm" data-tact="pvp" data-id="${esc(d.uid)}" ${here && n < T.PAIR_MAX ? "" : "disabled"}>Duel</button></div>`; }).join("")
        : `<p class="sub">No other players have entered yet.${online() ? "" : " Play online to meet them."}</p>`}</div>`;
  }
  function gloryHTML(fk, s) {
    const gl = T.glory(fk, docs, s);
    if (!gl.holds.length && !gl.clans.length) return `<p class="sub">Nobody competes for a hold or a clan yet. Pick one above and win glory for them.</p>`;
    const li = (x, n) => `<li><span class="tn-n">${esc(n)}</span><b class="num">${x.pts}</b></li>`;
    return `<div class="tn-glory">${gl.holds.length ? `<div><h4>Holds</h4><ol class="tn-board">${gl.holds.slice(0, 5).map((x) => li(x, x.name)).join("")}</ol></div>` : ""}${gl.clans.length ? `<div><h4>Clans</h4><ol class="tn-board">${gl.clans.slice(0, 5).map((x) => li(x, `${x.name} [${x.tag}]`)).join("")}</ol></div>` : ""}</div>`;
  }
  function prizesHTML(s) {
    const list = T.claimable(s);
    if (!list.length) return "";
    return `<div class="tn-card tn-prize"><div class="tn-ch"><span class="tn-ic" aria-hidden="true">\uE130</span><b>Prizes waiting</b></div>${list.map((fk) => { const f = T.byKey(fk);
      return `<div class="item"><div class="t">${esc(f ? f.name : "The Grand Arena week")}<span>${f ? `${esc(f.place)} · ended ${esc(day(f.end))}` : `ended ${esc(day(T.endsOf(fk)))}`}</span></div><button class="btn sm pri" data-tact="claim" data-id="${esc(fk)}">Collect</button></div>`; }).join("")}</div>`;
  }
  function calendarHTML(t = Date.now()) {
    return `<ul class="tn-cal">${T.upcoming(t, 4).map((o) => `<li>${chip(o)}<span class="tn-n"><b>${esc(o.name)}</b><small>${esc(o.place)} · ${o.contests.map((k) => T.CONTESTS[k].icon).join(" ")}</small></span><span class="sub num">${esc(day(o.start))}<br>in ${span(o.start - t)}</span></li>`).join("")}</ul>`;
  }
  /* the Festivals place in any city or town */
  function festHTML(s, l) {
    const t = Date.now(), c = T.current(t), nx = T.next(t);
    const pic = (f, on) => painted(f.id, `<h3>${chip(f)}${esc(f.name)}</h3>`, on);
    const pc = c ? pic(c, true) : pic(nx, false);
    const head = c ? `<div class="tn-hero${pc ? " tn-hp" : ""}">${pc || banner(c)}<div>${pc ? "" : `<h3>${chip(c)}${esc(c.name)}</h3>`}<p class="sub">${esc(c.place)}${c.hold ? `, ${esc(c.hold)}` : ""} · on now · ends in ${span(c.end - t)}</p><p class="sub">${esc(c.text)}</p></div></div>`
      : `<div class="tn-hero${pc ? " tn-hp" : ""}">${pc || banner(nx, 320, 110, false)}<div>${pc ? "" : `<h3>${chip(nx)}${esc(nx.name)}</h3>`}<p class="sub">${esc(nx.place)} · starts in ${span(nx.start - t)}</p><p class="sub">${esc(nx.text)}</p></div></div>`;
    let main = "";
    if (c && T.here(s, c.place)) {
      main = `${repHTML(s)}<div class="tn-grid">${c.contests.map((k) => contestHTML(s, c, k)).join("")}${duelsHTML(s, c)}</div><h4>Glory</h4>${gloryHTML(c.key, s)}`;
    } else if (c) {
      main = `<p class="sub tn-away">The contests are in ${esc(c.place)}. Travel there to take part: three tries at each contest, your best one counts.</p>${repHTML(s)}<div class="tn-grid">${c.contests.map((k) => `<div class="tn-card"><div class="tn-ch"><span class="tn-ic" aria-hidden="true">${T.CONTESTS[k].icon}</span><b>${esc(T.CONTESTS[k].name)}</b></div>${boardHTML(T.board(c.key, k, docs, s), s, 3)}</div>`).join("")}</div>`;
    } else main = `<p class="sub tn-away">A quiet day between festivals. The next one is being set up in ${esc(nx.place)}.</p>${repHTML(s)}`;
    return `<div class="tn tn-fest">${head}${prizesHTML(s)}${main}<h4>Coming up</h4>${calendarHTML(t)}
      <p class="sub tn-rules">Festivals are peaceful ground: no gear is lost, nobody dies, and there's no bounty. Enemies in the war meet as friends. Prizes are handed out when a festival ends: a title, a trophy and a little gold for the winners, and a ceremonial prize the first time you win each festival.</p></div>`;
  }
  /* the Grand Arena in Windhelm */
  function pitHTML(s) {
    const t = Date.now(), wk = T.pitWeek(t), fk = T.pitKey(t), P = T.pitSt(s, t), run = P.run, rl = role(s), no = T.pitWhy(s, rl);
    const e = T.entry(s, fk, false), best = e?.sc?.pit;
    const allies = partyCards();
    const pc = painted("arena", `<h3>The Grand Arena</h3>`);
    return `<div class="tn tn-pit"><div class="tn-hero${pc ? " tn-hp" : ""}">${pc || pitArt()}<div>${pc ? "" : `<h3>The Grand Arena</h3>`}<p class="sub">${T.PIT_ROUNDS} rounds of monsters, each one harder. Your health carries over; the healers patch you up a little between rounds. Nobody dies in the Pit and nothing you wear is lost.</p>
      <p class="sub">This week's board closes in ${span(T.pitEnds(wk) - t)}.${best != null ? ` Your best: <b class="num">${best}</b>.` : ""}</p></div></div>
      ${prizesHTML(s)}
      <div class="tn-grid"><div class="tn-card"><div class="tn-ch"><span class="tn-ic" aria-hidden="true">\uE11F</span><b>${run ? `Round ${run.r} of ${T.PIT_ROUNDS}` : "A new run"}</b>${run ? `<span class="sub num">${Math.round(run.hp * 100)}% health</span>` : ""}</div>
        ${run ? `<div class="tn-bar" aria-hidden="true"><i style="width:${Math.round(run.hp * 100)}%"></i></div>` : ""}
        <p class="sub">${allies.length ? `Your party fights with you: ${allies.map((a) => esc(a.name)).join(", ")}. The monsters grow to match.` : rl === "member" ? "" : "You fight alone. Bring a party for bigger monsters and a team score."}</p>
        <button class="btn pri tn-go" data-tact="pit" ${no ? "disabled" : ""}>${run ? `Fight round ${run.r}` : "Enter the Pit"}</button>
        ${run ? `<button class="btn sm" data-tact="pitout" ${no ? "disabled" : ""}>Walk out with ${run.r - 1} ${run.r - 1 === 1 ? "round" : "rounds"}</button>` : ""}
        ${no ? `<p class="sub tn-why">${esc(no)}</p>` : ""}</div>
        <div class="tn-card"><div class="tn-ch"><span class="tn-ic" aria-hidden="true">\uE103</span><b>This week's board</b></div>${boardHTML(T.board(fk, "pit", docs, s), s, 8)}</div></div>
      <h4>Glory</h4>${gloryHTML(fk, s)}${repHTML(s)}</div>`;
  }
  /* party members close by (the fight code's own allies list, set by ui.js) */
  function partyCards() { try { return (api?.allies?.() || []).filter((a) => a && (a.party || a.player)); } catch { return []; } }

  // ---------------------------------------------------------------- town hooks
  const sections = (l) => [...(isTown(l) ? ["festival"] : []), ...(l === T.PIT_TOWN ? ["pit"] : [])];
  function names(s, l) {
    const c = T.current();
    return { festival: c && c.place === l ? `\uE175 ${c.name}` : "\uE175 Festivals", pit: "\uE11F Grand Arena" };
  }
  function townHTML(s, shop, l) {
    if (shop === "pit") return { note: "Monster rounds for a weekly board. Alone or with your party; in a party only the leader starts the rounds.", body: pitHTML(s) };
    return { note: "", body: festHTML(s, l) };
  }
  /* the line on top of every town page while a festival is announced or on */
  function townLine(s, l) {
    const a = T.announced(); if (!a) return "";
    const t = Date.now();
    return `<p class="sub tn-town">${chip(a)}${a.on ? (a.place === l ? `${esc(a.name)} is on here! Ends in ${span(a.end - t)}.` : `${esc(a.name)} is on in ${esc(a.place)}. Ends in ${span(a.end - t)}.`) : `${esc(a.name)} starts in ${esc(a.place)} in ${span(a.start - t)}.`}${a.on && a.place === l ? " Festival peace: no fighting other players here." : ""}</p>`;
  }
  /* area-board status for the tiles */
  function status(s, l, id) {
    if (id === "pit") { const P = T.pitSt(s); return P.run ? { text: `Round ${P.run.r} next`, hot: true } : { text: "Monster rounds" }; }
    if (id === "festival") {
      if (T.claimable(s).length) return { text: "Prizes waiting", hot: true };
      const c = T.current(); if (c && c.place === l) return { text: "On now!", hot: true };
      return { text: c ? `On in ${c.place}` : `Next: ${T.next().place}` };
    }
    return null;
  }
  /* reminders (remind.js): a festival on now, prizes to collect */
  function reminders(s, add, goAt) {
    const n = T.claimable(s).length;
    if (n) add({ key: "tourney:prize", kind: "board", icon: "\uE130", title: `Festival prizes waiting`, sub: `${n} to collect at any town's Festivals.`, state: "ready", go: goAt(s.location && isTown(s.location) ? s.location : T.PIT_TOWN, "town", { shop: "festival" }) });
    const c = T.current();
    if (c) { const e = T.entry(s, c.key, false), done = e ? c.contests.every((k) => T.triesLeft(s, c.key, k) <= 0) : false;
      if (!done) add({ key: `tourney:${c.key}`, kind: "board", icon: c.icon, title: `${c.name} is on`, sub: `${c.place} · ends in ${span(c.end - Date.now())}`, state: "ending", place: c.place, go: goAt(c.place, "town", { shop: "festival" }) }); }
  }
  /* a banner over the host town on the map */
  function drawMap(g, P, sc, tt, rm) {
    const a = T.announced(); if (!a || typeof WORLD === "undefined") return;
    const p = WORLD.places[a.place]; if (!p) return;
    const [x, y] = P(p), wave = rm ? 0 : Math.sin((tt || 0) * 3) * 2 * sc, s = sc;
    const bx = x + 12 * s, by = y - 30 * s;
    g.save();
    g.strokeStyle = "rgba(30,22,14,.9)"; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(bx, y - 6 * s); g.lineTo(bx, by); g.stroke();
    g.fillStyle = a.colors[0]; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 16 * s, by + wave); g.lineTo(bx + 16 * s, by + 12 * s + wave); g.lineTo(bx + 8 * s, by + 9 * s + wave * 0.5); g.lineTo(bx, by + 12 * s); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = a.colors[1]; g.fillRect(bx + 2 * s, by + 4 * s + wave * 0.3, 11 * s, 2 * s);
    if (a.on && !rm) { g.strokeStyle = `rgba(255,224,138,${0.35 + 0.3 * (Math.sin((tt || 0) * 4) + 1) / 2})`; g.lineWidth = 2 * s; g.beginPath(); g.arc(x, y, 15 * s, 0, 7); g.stroke(); }
    const txt = LX(a.on ? a.name : `${a.name} (soon)`);
    // the name to the right of the flag, clear of the town's marker (and your own name above it)
    const tx = bx + 20 * s, ty = by + 6 * s + wave * 0.5;
    g.font = `700 ${Math.round(9 * s)}px sans-serif`; g.textAlign = "left"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 3 * s; g.strokeStyle = "rgba(20,14,8,.88)"; g.strokeText(txt, tx, ty); g.fillStyle = "#ffe6a0"; g.fillText(txt, tx, ty);
    g.restore();
  }

  // ---------------------------------------------------------------- the small games
  function sheet(html) { closeSheet(); const el = document.createElement("div"); el.id = "tnsheet"; el.className = "craftgame tn-sheet"; el.innerHTML = `<div class="cgcard" role="dialog">${html}</div>`; document.body.appendChild(el); return el; }
  const closeSheet = () => { if (DOM) document.querySelector("#tnsheet")?.remove(); };
  const automated = () => DOM && (navigator.webdriver || new URLSearchParams(location.search).has("notut"));
  /* the drinking contest: another mug, or stop while you still can */
  function drink(s, done) {
    const d = { mugs: 0 };
    if (automated()) { while (!d.done && d.mugs < 5) T.drinkStep(s, d); return done(d); }
    const el = sheet(`<h3>\uE15A Drinking contest</h3><p class="cgsub">Mug after mug. Stop before you're under the table.</p><div class="tn-mugs" id="tnm"></div><p class="cghint" id="tnh"></p>
      <div class="cgrow"><button class="btn" id="tnstop">Stop here</button><button class="btn pri" id="tnmore">Another mug!</button></div>`);
    const draw = () => {
      el.querySelector("#tnm").innerHTML = "\uE15A".repeat(d.mugs) || "&nbsp;";
      const ch = Math.round(T.steady(s, d.mugs) * 100);
      el.querySelector("#tnh").textContent = d.fell ? `Down you go after ${d.mugs} mugs. The crowd roars anyway.` : `${d.mugs} mugs. The room ${d.mugs < 3 ? "is steady" : d.mugs < 6 ? "sways a little" : "spins"}. About ${ch}% you keep your feet on the next one.`;
      if (d.fell) { el.querySelector("#tnmore").disabled = true; el.querySelector("#tnstop").textContent = "Done"; }
    };
    el.querySelector("#tnmore").onclick = () => { T.drinkStep(s, d); if (typeof SOUND !== "undefined") try { SOUND.fx("potion"); } catch { /* fine */ } draw(); };
    el.querySelector("#tnstop").onclick = () => { closeSheet(); d.done = true; done(d); };
    draw();
  }
  /* the fishing derby: three casts, tap when the needle is in the green */
  function derby(s, water, done) {
    const fish = [];
    if (automated() || typeof COOK === "undefined") { for (let i = 0; i < 3; i++) { const b = typeof COOK !== "undefined" ? COOK.bite(water) : null; fish.push(b && !b.rare ? b.item : null); } return done(fish); }
    let cast = 0, b = null, t0 = 0, raf = 0, needle = 0;
    const el = sheet(`<h3>\uE146 Fishing derby</h3><p class="cgsub">Cast <span id="tnc">1</span> of 3 · rare fish score most</p><div class="tn-reel"><i class="tn-z" id="tnz"></i><i class="tn-nd" id="tnn"></i></div><p class="cghint" id="tnh">Tap when the needle is in the green.</p><div class="tn-mugs" id="tnf"></div>
      <div class="cgrow"><button class="btn pri" id="tnreel">Reel in</button></div>`);
    const next = () => {
      if (cast >= 3) { cancelAnimationFrame(raf); el.querySelector("#tnreel").textContent = "Done"; el.querySelector("#tnreel").onclick = () => { closeSheet(); done(fish); }; return; }
      b = COOK.bite(water); t0 = performance.now(); cast++;
      el.querySelector("#tnc").textContent = cast;
      const z = el.querySelector("#tnz"); z.style.left = `${b.zone[0] * 100}%`; z.style.width = `${(b.zone[1] - b.zone[0]) * 100}%`;
    };
    const tick = (now) => { needle = (Math.sin((now - t0) / 380) + 1) / 2; const n = el.querySelector("#tnn"); if (n) n.style.left = `${needle * 100}%`; raf = requestAnimationFrame(tick); };
    el.querySelector("#tnreel").onclick = () => {
      if (cast > 3 || !b) return;
      const hit = needle >= b.zone[0] && needle <= b.zone[1];
      fish.push(hit ? b.item : null);
      el.querySelector("#tnf").innerHTML = fish.map((f) => (f ? `<span>${esc(D.ITEMS[f]?.name || f)}</span>` : "<span>· got away ·</span>")).join(" ");
      el.querySelector("#tnh").textContent = hit ? `${D.ITEMS[b.item]?.name || b.item}!` : "It got away.";
      next();
    };
    next(); raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- taps
  function after(r, extra) {
    const s = S(); if (!s) return;
    if (r.err) { api.toast(r.err); return; }
    if (r.text) api.toast(r.text);
    if (extra) extra();
    publish(true); api.persist?.(true); api.refresh?.();
  }
  function fight(fn, post) {
    const s = S(); if (!s) return;
    const done = (out) => {
      if (out.err) { api.toast(out.err); return; }
      if (post) post(out);
      publish(true); api.persist?.(true); api.refresh?.();
      api.showFightResult({ ...out });
    };
    if (api.tbCall) api.tbCall(fn, done); else if (typeof TB !== "undefined" && TB.call) TB.call(s, fn, done); else done(fn());
  }
  function tryContest(kind) {
    const s = S(), c = T.current(); if (!s || !c) return;
    const no = T.why(s, kind); if (no) return api.toast(no);
    const C = T.CONTESTS[kind];
    const go = (res) => after(T.submit(s, kind, res));
    switch (kind) {
      case "duel": return fight(() => T.playDuel(S()));
      case "archery": case "joust": case "smith": {
        const sk = Math.round(C.skills.reduce((a, k) => a + G.skill(s, k), 0) / C.skills.length);
        return CG.run(C.game, { skill: sk, skillName: C.skills.join(" / "), what: C.name }, (g) => go({ grade: g }));
      }
      case "hunt": {
        const pr = T.prey(`${c.key}|${s.id}|${T.entry(s, c.key).tries.hunt || 0}`);
        const sk = Math.round(C.skills.reduce((a, k) => a + G.skill(s, k), 0) / C.skills.length);
        api.toast(`The huntsmen drive a ${pr.name.toLowerCase()} past your hide.`);
        return CG.run("precise", { skill: sk, skillName: "Archery / Sneak", what: pr.name }, (g) => go({ grade: g, level: pr.level }));
      }
      case "fish": return derby(s, c.water || (typeof COOK !== "undefined" ? COOK.waterNear(WORLD.places[c.place]) : "lake") || "lake", (fish) => go({ fish }) );
      case "mine": {
        const place = typeof SMITH !== "undefined" && SMITH.MINES[c.place] ? c.place : null;
        if (!place || typeof MINEGAME === "undefined") return go({});
        return MINEGAME.play(s, place, (got) => {
          if (got === "cancel") return;
          if (got) for (const [it, n] of Object.entries(got)) if (D.ITEMS[it] && n > 0) G.give(s, it, n);
          go(got ? { got } : {});
        });
      }
      case "drink": return drink(s, (d) => go(d));
    }
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest("[data-tact]"); if (!b || b.disabled || !S()) return;
    e.preventDefault(); e.stopPropagation();
    const s = S();
    if (typeof SOUND !== "undefined") try { SOUND.fx("click"); } catch { /* fine */ }
    switch (b.dataset.tact) {
      case "try": tryContest(b.dataset.k); break;
      case "rep": after(T.setRep(s, b.dataset.k)); break;
      case "claim": { const r = T.claim(s, b.dataset.id, docs); after(r); if (!r.err && r.titles?.length) api.postNews?.(`\uE130 ${s.name} is ${r.titles.join(" and ")}!`); break; }
      case "pvp": { const d = docs.find((x) => x.uid === b.dataset.id && x.fk === T.current()?.key); fight(() => T.pvp(S(), d)); break; }
      case "pit": {
        let allies = []; try { allies = api?.allies?.() || []; } catch { /* alone */ }
        fight(() => T.pitRound(S(), { role: role(S()), allies }), (out) => { if (out.done && out.score != null && out.round >= 5) api.postNews?.(`\uE11F ${s.name} lasted ${out.won ? T.PIT_ROUNDS : out.round - 1} rounds in the Grand Arena.`); });
        break;
      }
      case "pitout": after(T.pitFinish(s)); break;
    }
  }
  function onChange(e) {
    const el = e.target; if (!el || !el.dataset || el.dataset.tactSel !== "hold" || !S()) return;
    after(el.value ? T.setRep(S(), "hold", el.value) : T.setRep(S(), "self"));
  }
  function mount(a) {
    api = a;
    if (typeof Store !== "undefined") Store.watch("fest", (list) => {
      docs = T.setDocs(list);
      if (DOM && document.querySelector(".tn") && !document.querySelector("#modal, #tnsheet, #craftgame, #minegame")) api.refresh?.();
    });
    if (!mount.bound && DOM) { document.addEventListener("click", onClick, true); document.addEventListener("change", onChange, true); mount.bound = true; }
    setTimeout(() => publish(false), 4000);
  }
  return { mount, publish, sections, names, townHTML, townLine, status, reminders, drawMap, banner, pitArt, festHTML, pitHTML, get docs() { return docs; } };
})();
