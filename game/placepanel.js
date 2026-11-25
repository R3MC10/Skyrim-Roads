/* placepanel.js: what a tapped place, pin or spot in the wilds shows in the map panel (mapsheet.js). [OURS]
   ui.js renderPicked asks spec(S, selected, ctx) and opens it. Every kind of place gets the same SkyUI look: its map
   marker + name + "kind · hold" on top, info rows (how far, visited, cleared, a quest or a rumour there, a crisis or
   your bounty in the hold), then the big action rows (Travel, Go inside, Mine ore, Walk here, Pin, Share, Remove).
   The buttons carry data-act, so ui.js onPanelClick does the work exactly as before.
   ctx = { fmtMin, KIND, party, roamSpot } */
const PLACEPANEL = (() => {
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : en);
  const safe = (f, d = null) => { try { return f(); } catch (e) { return d; } };
  const pic = (kind) => { const u = typeof WorldMap !== "undefined" && WorldMap.kindIcon ? WorldMap.kindIcon(kind) : ""; return u ? `<img src="${u}" width="40" height="40" alt="">` : ""; };
  const glyph = (g) => `<span class="mp-glyph" aria-hidden="true">${String(g || "").replace(/[&<>"']/g, "")}</span>`;
  const hrs = (sec) => { const m = Math.max(1, Math.round(sec / 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

  /* rows that say what's going on at a place or in its hold */
  function placeRows(S, n, hold) {
    const rows = [];
    const q = safe(() => QUESTS.active(S).filter((a) => QUESTS.target(a.st) === n), []);
    for (const a of q.slice(0, 2)) rows.push([T("Quest"), `${a.def.name}: ${a.st.title}`, "good"]);
    const r = safe(() => RUMOURS.leads(S).filter((x) => x.place === n), []);
    for (const x of r.slice(0, 1)) rows.push([T("Rumour"), T(RUMOURS.KINDS[x.kind]?.title || "A lead"), "warn"]);
    const cl = safe(() => (DUNGEONS.enterable(n) && (S.cleared || {})[n] ? DUNGEONS.refillLeft(S, n) : -1), -1);
    if (cl > 0) rows.push([T("Cleared"), T("Fills up again in {n}", { n: hrs(cl) })]);
    else if (cl === 0) rows.push([T("Cleared"), T("Something has moved back in"), "warn"]);
    const cx = safe(() => { const cr = CRISES.crisisIn(hold); if (!cr) return null; const x = CRISES.status(cr, S); return x.state === "active" || x.state === "boss" ? { name: T(CRISES.CHAINS[cr.chain].name), st: x } : null; });
    if (cx) rows.push([T("Crisis"), cx.st.state === "boss" ? T("{name}: the ringleader is out", { name: cx.name }) : T("{name} (stage {n})", { name: cx.name, n: cx.st.stage }), "bad"]);
    const b = safe(() => TOWNS.bounty(S, hold), 0);
    if (b > 0) rows.push([T("Your bounty"), T("{g} gold", { g: b }), "bad"]);
    return rows;
  }

  function spec(S, sel, ctx) {
    const fm = ctx.fmtMin, base = { owner: "place", domId: "picked" };
    if (sel === "__spot") {
      const spot = ctx.roamSpot; if (!spot) return null;
      const r = ROAM.plan(S, spot);
      if (r.err) return { ...base, id: "spot:" + spot.join(","), icon: glyph("✦"), title: T("No way there"), sub: r.err, rows: [], actions: [], pre: `<p class="wg-note">${T("Tap somewhere on land to roam there.")}</p>` };
      const name = r.name[0].toUpperCase() + r.name.slice(1);
      return { ...base, id: "spot:" + spot.join(","), icon: glyph("✦"), title: name, sub: `${r.ground} · ${G.holdAt(r.pos)}`,
        rows: [[T("Travel time"), fm(G.minutesTo(S, r.pos))], r.snapped ? [T("Note"), T("The nearest dry land")] : null],
        actions: [{ label: T("Walk here"), sub: T("Off the road, into the wilds"), pri: true, data: { act: "go", place: "__spot" } },
          { label: T("Pin"), sub: T("Drop a pin here to come back later"), data: { act: "spotpin" } }] };
    }
    if (sel.startsWith("__pin:")) {
      const p = (S.pins || []).find((x) => "__pin:" + x.id === sel); if (!p) return null;
      return { ...base, id: sel, icon: glyph(p.icon), title: p.label, sub: `${T("Your pin")} · ${G.holdAt([p.x, p.y])}`,
        rows: [[T("Travel time"), fm(G.minutesTo(S, [p.x, p.y]))]],
        actions: [{ label: T("Travel"), sub: T("Set off for your pin"), pri: true, data: { act: "go", place: sel } },
          ctx.party ? { label: T("Share"), sub: T("Your party sees it on their maps"), data: { act: "pinshare", id: p.id } } : null,
          { label: T("Remove"), sub: T("Take the pin off your map"), danger: true, data: { act: "pindel", id: p.id } }] };
    }
    const P = WORLD.places[sel]; if (!P) return null;
    const [x, y, kind] = P, hold = G.holdAt([x, y]), here = S.location === sel;
    const mins = here ? 0 : G.minutesTo(S, [x, y]);
    const visited = (S.discovered || []).includes(sel);
    const acts = [];
    if (here) {
      if (safe(() => DUNGEONS.enterable(sel)) && !S.trip) acts.push({ label: T("Go inside"), sub: T("Fight your way through, room by room"), danger: true, pri: true, data: { act: "enter" } });
      if (safe(() => SMITH.MINES[sel]) && !S.trip) acts.push({ label: T("Mine ore"), sub: T("Swing a pick for iron and more"), data: { act: "mine" } });
    } else acts.push({ label: T("Travel"), sub: T("About {n}", { n: fm(mins) }), pri: true, data: { act: "go", place: sel } });
    return { ...base, id: "place:" + sel, icon: pic(kind), title: sel, sub: `${T(ctx.KIND[kind] || "Place")} · ${hold}`,
      rows: [[T("Where"), here ? T("You are here") : T("{n} away", { n: fm(mins) }), here ? "good" : ""], [T("Visited"), visited ? T("Yes") : T("Not yet")], ...placeRows(S, sel, hold)],
      actions: acts, pre: !acts.length && here ? `<p class="wg-note">${T("You're here.")}</p>` : "" };
  }
  return { spec, placeRows };
})();
if (typeof module !== "undefined") module.exports = PLACEPANEL;
