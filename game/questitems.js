/* Quest items a stage needs in your pack [OURS]. A quest must never get stuck because its item went missing
   (left in a house chest, dropped in a death bag from before quest items were bound to you, lost in a party pile).
   Whenever quests are checked (and when a save loads): if an active stage needs an item you don't carry, it comes
   back from your house chests, or a new one turns up in your pack.
   Stages that only need a dungeon cleared, like Farengar's Dragonstone, never look at the item at all (quests.js).
   Every quest stage whose "need" looks in your pack must be listed here: tests/test_bleakfalls.js checks that. */
const QITEMS = (() => {
  // [quest line, stage index (or a function of the line), items the stage needs (a function of the save)]
  const NEED = [
    ["cure_vamp", 2, () => ["soul_gem_black_full"]],
    ["cure_wolf", 1, () => ["glenmoril_head"]],
    ["masks", (L) => L.stages.length - 1, (s) => typeof PRIESTS === "undefined" ? [] : [...PRIESTS.LIST.filter((p) => PRIESTS.got(s, p.id)).map((p) => PRIESTS.maskId(p.id)), ...(PRIESTS.got(s, "morokei") ? ["mask_wooden"] : [])]],
  ];
  const stageOf = (line, at) => (typeof at === "function" ? (QUESTS.L[line] ? at(QUESTS.L[line]) : -1) : at);
  /* the needs that apply to a stage (used by the audit test) */
  const covers = (line, i) => NEED.some(([l, at]) => l === line && stageOf(l, at) === i);
  const carried = (s, item) => (s.inv || []).some((r) => r.item === item);
  /* put missing quest items back. Returns messages (also written to the journal) */
  function repair(s) {
    const out = [];
    if (typeof QUESTS === "undefined") return out;
    for (const [line, at, items] of NEED) {
      const v = (s.quests || {})[line];
      if (!v || v.done || !QUESTS.L[line] || v.stage !== stageOf(line, at)) continue;
      for (const item of items(s)) {
        if (!D.ITEMS[item] || carried(s, item)) continue;
        const name = D.ITEMS[item].name;
        const home = Object.entries(s.homes || {}).find(([, h]) => (h?.chest || []).some((x) => x.item === item));
        if (home) {
          const ch = home[1].chest, i = ch.findIndex((x) => x.item === item), r = ch[i];
          if (r.qty > 1) r.qty--; else ch.splice(i, 1);
          G.give(s, item, 1, r.charge ?? null);
          out.push(` You'll need the ${name} for your quest, so you took it from your house chest in ${home[0]}.`);
        } else {
          G.give(s, item);
          out.push(` The ${name} you need for your quest turns up in your pack after all.`);
        }
        G.note(s, out[out.length - 1]);
      }
    }
    return out;
  }
  if (typeof QUESTS !== "undefined") {   // run with every quest check, whoever wrapped it before us
    const ensure0 = QUESTS.ensure, check0 = QUESTS.check;
    QUESTS.ensure = (s) => { ensure0(s); repair(s); };
    QUESTS.check = (s) => { const m = check0(s); return [...m, ...repair(s)]; };
  }
  return { NEED, covers, repair };
})();
