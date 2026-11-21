/* Visiting other players' homes: everyone publishes a small "homes" record about themselves
   (which houses they own, their trophies, a display case and a motto). Visitors in the same town
   can look around and leave gifts. A gift is its own record addressed to the owner; only the owner
   collects it, and it goes straight into the chest of that house. [OURS] */
const VISITS = (() => {
  const SHOW_MAX = 3, NOTE_MAX = 80, MOTTO_MAX = 60, GOLD_MAX = 100000;
  const clean = (t, n) => String(t || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
  const itemName = (r) => (r.tq ? TOWNS.QUALITY[r.tq] + " " : "") + D.ITEMS[r.item].name;

  /* what other players see about you */
  function record(s) {
    const homes = Object.keys(s.homes || {}).filter((t) => TOWNS.HOMES[t]);
    if (!homes.length) return null;
    const show = [];
    for (const t of homes) for (const r of s.homes[t].chest || []) if (r.shown && show.length < SHOW_MAX && D.ITEMS[r.item]) show.push({ name: itemName(r), town: t });
    return { name: s.name, race: s.race, level: s.level, towns: homes, motto: clean(s.motto, MOTTO_MAX), dragons: s.dragons || 0,
      cleared: Object.keys(s.cleared || {}).length, titles: (s.titles || []).slice(-6), show, souls: s.souls || 0,
      ...(typeof ACH !== "undefined" ? { ach: { n: ACH.count(s), total: ACH.total, latest: ACH.latest(s, 4) } } : {}) };
  }
  /* homes of other players in this town */
  const inTown = (docs, town, meId) => docs.filter((d) => d.id !== meId && Array.isArray(d.towns) && d.towns.includes(town) && typeof d.name === "string");

  function setMotto(s, text) { s.motto = clean(text, MOTTO_MAX); return s.motto ? "Carved over the door." : "You scrape the words off the door."; }
  function toggleShow(s, town, idx) {
    const h = (s.homes || {})[town], r = h?.chest[idx];
    if (!r) return "It's not in the chest.";
    if (!r.shown) {
      const count = Object.values(s.homes).reduce((a, x) => a + (x.chest || []).filter((c) => c.shown).length, 0);
      if (count >= SHOW_MAX) return `Your display case holds ${SHOW_MAX} things. Take one out first.`;
    }
    r.shown = !r.shown;
    return r.shown ? `${itemName(r)} goes in the display case. Visitors can see it.` : `${itemName(r)} goes back in the chest.`;
  }

  /* -> { gift } (a record to publish) or { err } */
  function giftItem(s, owner, town, rowId, note) {
    if (s.location !== town || !owner?.towns?.includes(town)) return { err: "You have to be in their town to leave a gift." };
    const r = G.invRow(s, rowId);
    if (!r) return { err: "You don't have that." };
    if (Object.values(G.loadout(s).equipment || {}).includes(rowId)) return { err: "Take it off first." };
    if (r.stolen) return { err: "You can't give stolen goods. The guards check deliveries." };
    const copy = { item: r.item, qty: r.qty, charge: r.charge ?? null, temper: r.temper, tq: r.tq };
    G.take(s, rowId, r.qty);
    return { gift: { to: owner.id, toName: owner.name, from: s.id, fromName: s.name, town, row: copy, note: clean(note, NOTE_MAX), t: G.now() },
      text: `You leave ${itemName(copy)}${copy.qty > 1 ? ` ×${copy.qty}` : ""} for ${owner.name}.` };
  }
  function giftGold(s, owner, town, n, note) {
    if (s.location !== town || !owner?.towns?.includes(town)) return { err: "You have to be in their town to leave a gift." };
    n = Math.floor(n);
    if (!(n > 0) || n > GOLD_MAX) return { err: "Choose how much gold." };
    if (s.gold < n) return { err: `You only have ${s.gold} gold.` };
    s.gold -= n;
    return { gift: { to: owner.id, toName: owner.name, from: s.id, fromName: s.name, town, gold: n, note: clean(note, NOTE_MAX), t: G.now() }, text: `You leave ${n} gold for ${owner.name}.` };
  }
  function giftNote(s, owner, town, note) {
    note = clean(note, NOTE_MAX);
    if (!note) return { err: "Write something first." };
    if (s.location !== town || !owner?.towns?.includes(town)) return { err: "You have to be in their town." };
    return { gift: { to: owner.id, toName: owner.name, from: s.id, fromName: s.name, town, note, t: G.now() }, text: `You pin a note to ${owner.name}'s door.` };
  }
  /* the owner takes a gift in: items into that house's chest, gold into the purse */
  function receive(s, g) {
    if (!g || g.to !== s.id) return "That gift isn't for you.";
    const h = (s.homes || {})[g.town];
    const bits = [];
    if (g.gold > 0) { const n = Math.min(GOLD_MAX, Math.floor(g.gold)); s.gold += n; bits.push(`${n} gold`); }
    if (g.row && D.ITEMS[g.row.item]) {
      const row = { item: g.row.item, qty: Math.max(1, Math.min(999, Math.floor(g.row.qty) || 1)), charge: g.row.charge ?? null };
      if (g.row.temper) { row.temper = g.row.temper; row.tq = g.row.tq; }
      if (h) h.chest.push(row); else { const id = G.give(s, row.item, row.qty, row.charge); const r = G.invRow(s, id); if (r && row.temper) Object.assign(r, { temper: row.temper, tq: row.tq }); }
      bits.push(`${itemName(row)}${row.qty > 1 ? ` ×${row.qty}` : ""}`);
    }
    return `From ${g.fromName}: ${bits.length ? bits.join(" and ") : "a note"}${g.note ? ` — “${g.note}”` : ""}.${g.row && h ? " It's in your chest." : ""}`;
  }
  return { SHOW_MAX, NOTE_MAX, MOTTO_MAX, record, inTown, setMotto, toggleShow, giftItem, giftGold, giftNote, receive, itemName };
})();
