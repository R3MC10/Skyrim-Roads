/* sideui.js: the screens for picking a side (sides.js, sidequest.js, cloaks.js).
   - the courier's letter when the "Pick a Side" quest starts (level 20, or an older save at 20+ on load)
   - the recruiter's sheet (Windhelm, Solitude, the Thalmor Embassy): hear the pitch, then swear
   - Social -> Faction: your side, rank, rank XP bar, the cloak ladder, the three sides' standings, changing sides
   - a confirm before attacking a soldier of another side, the "+X rank XP" banner, rank XP for world events
   ui.js mounts it with { S, persist, toast, showMessage, openModal, closeModal, render, party, click }. */
const SIDEUI = (() => {
  let api = null;
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = () => (api ? api.S() : null);
  const ok = () => typeof SIDES !== "undefined";
  const Q = () => (typeof SIDEQ !== "undefined" ? SIDEQ : null);
  const C = () => (typeof SIDECLOAK !== "undefined" ? SIDECLOAK : null);
  const L = (id) => SIDES.LIST[id];
  const pct = (x) => Math.round(x * 100);

  // ---------------------------------------------------------------- the Faction tab
  function bar(s) {
    const b = SIDES.xpBar(s); if (!b) return "";
    const r = SIDES.rank(s), wear = !C() || !!C().active(s);
    return `<div class="sxp"><div class="sxp-t"><span>Rank XP</span><span class="num">${b.hi ? `${b.pts} / ${b.hi}` : `${b.pts} · top rank`}</span></div>
      <div class="bar"><i style="width:${pct(b.pct)}%;background:${esc(L(SIDES.mine(s)).colors[1])}"></i></div>
      <p class="sub">${r.next ? `Next rank: ${esc(r.next.name)}.` : "You hold the highest rank."} ${wear ? "Your cloak is on: fights, dungeons, world events and wins over rival soldiers earn rank XP." : "⚠ Put your side's cloak on to earn rank XP."}</p></div>`;
  }
  function cloakRow(c, tag) {
    return `<div class="item scloak${c.have ? "" : " off"}"><span class="sci">${typeof ICONART !== "undefined" ? ICONART.item(c.id, 32) : "🧥"}</span><div class="t">${esc(c.name)}<span>${esc(tag)} · ${esc(c.rankName)}${c.power ? ` · power: ${esc(c.power)}` : ""}</span><span class="sub">${esc(c.desc)}</span></div></div>`;
  }
  function ladder(s) {
    const c = C(); if (!c) return "";
    const lad = c.ladder(s); if (!lad) return "";
    const cur = lad.list[Math.max(0, lad.rank - 1)], nxt = lad.list[lad.rank];   // ladder ranks count from 1
    const pips = lad.list.map((x) => `<i class="${x.have ? "on" : ""}" title="${esc(x.rankName)}"></i>`).join("");
    return `<h3>Cloaks <span class="spips">${pips}</span></h3>
      ${cloakRow(cur, lad.wearing === cur.id ? "Wearing" : "Your rank")}
      ${nxt ? cloakRow(nxt, `At ${nxt.at} rank XP`) : ""}
      ${lad.wearing && lad.wearing !== cur.id ? '<p class="sub">You wear an older cloak. The new one is in your pack.</p>' : ""}
      ${!lad.wearing ? `<button class="btn sm pri" data-sact="wear">Put on ${esc(cur.name)}</button>` : ""}`;
  }
  function standings() {
    const rows = SIDES.standings().map((r) => `<div class="item sstand"><span class="sem">${SIDES.emblem(r.id, 26)}</span><div class="t">${esc(L(r.id).name)}<span>${r.members} soldier${r.members === 1 ? "" : "s"} · ${r.holds} hold${r.holds === 1 ? "" : "s"} · ${r.score} war points this week</span></div></div>`).join("");
    return `<h3>The war</h3><div class="list">${rows}</div>`;
  }
  function switchBox(s) {
    const q = Q(), here = q ? q.recAt(s.location) : null, cur = SIDES.mine(s);
    if (!cur) return "";
    if (!here || here === cur) return `<p class="sub">To change sides, visit another side's recruiter (Windhelm, Solitude or the Thalmor Embassy). It costs ${SIDES.switchCost(s)} gold, you start again at the lowest rank and lose your old side's cloaks and perks.</p>`;
    const wait = SIDES.switchAt(s) - Date.now();
    return `<div class="sswitch"><p>${esc(q.REC[here].who)} is here. Change sides to the ${esc(L(here).name)} for ${SIDES.switchCost(s)} gold?</p>
      <button class="btn sm danger" data-sact="switch" data-side="${here}" ${wait > 0 ? "disabled" : ""}>Change sides</button>${wait > 0 ? `<span class="sub"> You changed sides recently. Wait ${Math.ceil(wait / 864e5)} more day(s).</span>` : ""}</div>`;
  }
  function questBox(s) {
    const q = Q();
    const heard = q ? q.heard(s) : {};
    const list = SIDES.IDS.map((id) => `<div class="item sstand"><span class="sem">${SIDES.emblem(id, 30)}</span><div class="t">${esc(L(id).name)}<span>${esc(q ? q.REC[id].who + ", " + q.REC[id].place : L(id).seat)}${heard[id] ? " · ✓ heard" : ""}</span><span class="sub">${esc(L(id).pitch)}</span></div></div>`).join("");
    return `<p>A courier brought you three letters. Each side wants you. Visit the recruiters, hear them out, then swear to one. Your quest: <b>Pick a Side</b>.</p>
      <div class="list">${list}</div><div class="evc"><button class="btn sm pri" data-act="jgo" data-id="quests" data-sact="track">Open the quest</button></div>`;
  }
  function panel() {
    const s = S(); if (!s || !ok()) return "";
    const head = '<h2>⚔ Faction</h2>';
    if ((s.level || 1) < SIDES.MIN_LEVEL) {
      return `<div class="panel sidep">${head}<p>Skyrim is at war. At level ${SIDES.MIN_LEVEL} a courier will find you with letters from the Stormcloaks, the Imperial Legion and the Aldmeri Dominion, and you'll pick a side.</p>
        <p class="sub">Soldiers of rival sides can fight each other anywhere in the same hold. Anyone under level ${SIDES.MIN_LEVEL}, or without a side, is left in peace.</p>
        <div class="sem3">${SIDES.IDS.map((id) => `<span title="${esc(L(id).name)}">${SIDES.emblem(id, 44)}</span>`).join("")}</div>${standings()}</div>`;
    }
    const id = SIDES.mine(s);
    if (!id) return `<div class="panel sidep">${head}${questBox(s)}${standings()}</div>`;
    const r = SIDES.rank(s), Ls = L(id);
    return `<div class="panel sidep sp-${id}">${head}
      <div class="shead"><span class="sem big">${SIDES.emblem(id, 64)}</span><div><b>${esc(Ls.name)}</b><span class="sub">${esc(r.name)} · rank ${r.i + 1} of ${SIDES.RANK_AT.length}</span><span class="sub">Leader: ${esc(Ls.leader)}</span></div></div>
      ${bar(s)}${ladder(s)}
      <h3>What your side teaches</h3><ul class="sbon">${Ls.bonus.map((b) => `<li>${esc(b)}</li>`).join("")}</ul><p class="sub">Side perks show in your skill trees (only for soldiers of this side).</p>
      ${standings()}
      <h3>Fighting other players</h3><p class="sub">Attack any soldier of a rival side in the same hold (Social → Travellers or the map). Same-side fights keep the old rules. Nobody under level ${SIDES.MIN_LEVEL}, nobody just knocked down, nobody in a dungeon, and never your party. Guards still put a bounty on you if they see it. The loser is knocked down and keeps their gear.</p>
      ${switchBox(s)}</div>`;
  }
  /* a "(!)" on the Faction chip: a side to pick, or your cloak is off */
  function badge() {
    const s = S(); if (!s || !ok()) return false;
    if (SIDES.needsPick(s)) return true;
    return !!SIDES.mine(s) && !!C() && !C().active(s);
  }

  // ---------------------------------------------------------------- the courier's letter
  function letter() {
    const s = S(), q = Q(); if (!s || !q || !SIDES.shouldPrompt(s) || !q.active(s) || document.getElementById("modal")) return;
    s.sideAsked = true; api.persist(true);   // shown once; the quest keeps it in the Journal
    api.openModal(`<div class="sletter"><div class="sem3">${SIDES.IDS.map((id) => SIDES.emblem(id, 46)).join("")}</div>
      <h2>Three letters</h2><p>${esc(q.LETTER)}</p>
      <ul class="sbon">${SIDES.IDS.map((id) => `<li><b>${esc(L(id).name)}</b>: ${esc(q.REC[id].who)}, ${esc(q.REC[id].place)}</li>`).join("")}</ul>
      <div class="evc"><button class="btn pri" data-act="jgo" data-id="quests" data-sact="track">Track the quest</button><button class="btn" data-sact="later">Later</button></div></div>`, "sletter-sheet");
  }

  // ---------------------------------------------------------------- the recruiter
  function recruiter(id) {
    const s = S(), q = Q(); if (!s || !q) return;
    const heard = q.heard(s)[id];
    let pitch = q.REC[id].pitch;
    if (!heard) { const r = q.talk(s); pitch = r.text || pitch; api.persist(true); api.render(); }   // first visit: you hear them out (the quest ticks it)
    else pitch = `${q.REC[id].who}: ${pitch}`;
    const c = C(), first = c ? c.ladder({ ...s, side: { id, pts: 0 } }) : null, cl = first ? first.list[0] : null;
    api.openModal(`<div class="srec sp-${id}"><div class="shead"><span class="sem big">${SIDES.emblem(id, 72)}</span><div><b>${esc(L(id).name)}</b><span class="sub">${esc(q.REC[id].who)} · ${esc(q.REC[id].place)}</span></div></div>
      <p>${esc(pitch)}</p><h3>What they teach</h3><ul class="sbon">${L(id).bonus.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      ${cl ? `<h3>Your first cloak</h3>${cloakRow({ ...cl, have: true }, "Rank 1")}` : ""}
      <p class="sub">Joining is free the first time. Changing sides later costs gold and starts you from the lowest rank.</p>
      <div class="evc"><button class="btn pri" data-sact="swear" data-side="${id}">${esc(q.REC[id].swear || "Swear to the " + L(id).name)}</button><button class="btn" data-act="close">Not yet</button></div></div>`);
  }
  function swear(id) {
    const s = S(), q = Q(); if (!s || !q) return;
    if (q.recAt(s.location) !== id) return api.toast(`Go to ${q.REC[id].place} first.`);
    const r = q.talk(s);
    api.closeModal(); api.persist(true); api.render();
    if (!r.joined) return api.toast(r.text);
    api.showMessage("Quest", [r.text, ...(r.msgs || [])].join(" "));
  }

  // ---------------------------------------------------------------- changing sides (Faction tab, at the new side's recruiter)
  function switchAsk(id) {
    const s = S(); if (!s) return;
    const cur = SIDES.mine(s);
    api.openModal(`<div class="srec sp-${id}"><div class="shead"><span class="sem big">${SIDES.emblem(id, 64)}</span><div><b>Change sides?</b><span class="sub">${esc(L(cur).name)} → ${esc(L(id).name)}</span></div></div>
      <p>It costs ${SIDES.switchCost(s)} gold. You start again as ${esc(L(id).ranks[0])}, your old cloaks are taken back and your old side's perks are refunded. You can't change again for a week.</p>
      <div class="evc"><button class="btn danger" data-sact="switchok" data-side="${id}">Change sides</button><button class="btn" data-act="close">Stay</button></div></div>`);
  }
  function switchGo(id) {
    const s = S(); if (!s) return;
    const r = SIDES.pick(s, id);
    api.closeModal();
    if (r.err) return api.toast(r.err);
    const notes = C() ? C().grant(s) : [];
    if (C()) C().wearBest(s);
    api.persist(true); api.render();
    api.showMessage("Faction", [r.text, ...notes].join(" "));
  }

  // ---------------------------------------------------------------- attack confirm (ui.js doAttack calls this for cross-side fights)
  let pendingAttack = null;
  function confirmAttack(card, go) {
    const s = S(), os = SIDES.of(card.id) || card.side;
    pendingAttack = go;
    const hold = typeof G !== "undefined" && G.holdAt ? G.holdAt([s.x, s.y]) : "";
    api.openModal(`<div class="srec"><div class="shead"><span class="sem big">${os ? SIDES.emblem(os, 56) : ""}</span><div><b>Attack ${esc(card.name)}?</b><span class="sub">Level ${card.level || "?"}${os ? ` · ${esc(L(os).name)}` : ""}</span></div></div>
      <p>A fight between soldiers of rival sides. The loser is knocked down and keeps their gear. If you win, you get gold, a trophy, war points${hold ? ` in ${esc(hold)}` : ""} and rank XP.</p>
      <p class="sub">If anyone sees it, the guards add a bounty for assault.</p>
      <div class="evc"><button class="btn danger" data-sact="atkok">Attack</button><button class="btn" data-sact="atkno">Leave them</button></div></div>`);
  }

  // ---------------------------------------------------------------- clicks (capture: runs before ui.js)
  const claimedCount = (s) => ["wev", "gev"].reduce((n, k) => n + Object.values((s && s[k]) || {}).filter((m) => m && m.claimed).length, 0);
  function onClick(e) {
    const s = S(); if (!s || !ok()) return;
    const b = e.target.closest && e.target.closest("[data-sact],[data-act]"); if (!b || b.disabled) return;
    const q = Q();
    if (b.dataset.act === "qtalk" && q && b.dataset.id === q.ID) {
      const id = q.recAt(s.location);
      if (!id) return;   // not at a recruiter: the normal path tells you where to go
      e.preventDefault(); e.stopImmediatePropagation();
      return recruiter(id);
    }
    if (b.dataset.act === "claim") {   // a world event's reward: rank XP for your side (if your cloak is on)
      const before = claimedCount(s);
      setTimeout(() => { const s2 = S(); if (s2 && claimedCount(s2) > before && SIDES.gainXp(s2, "event")) api.persist(true); }, 0);
      return;
    }
    const a = b.dataset.sact; if (!a) return;
    switch (a) {
      case "track": if (q) { s.trackQ = q.ID; s.sideAsked = true; api.persist(); } api.closeModal(); return;   // data-act="jgo" then opens the Journal
      case "later": api.closeModal(); api.toast(SIDES.later(s)); api.persist(); return;
      case "swear": return swear(b.dataset.side);
      case "switch": return switchAsk(b.dataset.side);
      case "switchok": return switchGo(b.dataset.side);
      case "wear": if (C() && C().wearBest(s)) { api.persist(true); api.render(); api.toast("You put your side's cloak on."); } return;
      case "atkok": { const go = pendingAttack; pendingAttack = null; api.closeModal(); if (go) go(); return; }
      case "atkno": pendingAttack = null; api.closeModal(); return;
    }
  }

  // ---------------------------------------------------------------- mount
  function mount(o) {
    api = o;
    if (!ok()) return;
    if (typeof Store !== "undefined" && Store.watch) Store.watch("sides", (list) => { SIDES.setDocs(list, S()); });
    const s = S();
    const note = s && SIDES.migrate(s);
    if (note) { api.persist(true); setTimeout(() => api.showMessage("Guilds are gone", note), 400); }
    if (s && typeof QUESTS !== "undefined") { QUESTS.ensure(s); if (Q()) Q().sync(s); }
    document.addEventListener("click", onClick, true);
    SIDES.onXp((s2, r) => {
      if (typeof POLISH === "undefined" || s2 !== S()) return;
      const id = SIDES.mine(s2);
      POLISH.banner("skill", "Rank XP", `+${r.xp} rank XP`, SIDES.emblem(id, 30));
      if (r.up) POLISH.banner("level", `Promoted: ${L(id).name}`, r.rank.name, SIDES.emblem(id, 34));
    });
    const lv = () => { const s2 = S(); if (!s2) return; if (typeof QUESTS !== "undefined") QUESTS.ensure(s2); setTimeout(letter, 1500); };
    if (typeof LEVELUP !== "undefined" && typeof LEVELUP.on === "function") { try { LEVELUP.on("level", (e) => { if (!e || (e.level || 0) >= SIDES.MIN_LEVEL) lv(); }); } catch (e) { /* older levelup.js */ } }   // levelup.js (PR #140): LEVELUP.on("level", ({ s, level }) => ...)
    document.addEventListener("levelup", lv);
    setTimeout(letter, 2500);
    setInterval(letter, 8000);   // older saves at 20+ and level-ups from code that fires no event
  }

  return { mount, panel, badge, confirmAttack, letter, recruiter };
})();
