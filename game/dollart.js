/* Paper doll: your character in the middle of the Pack tab with the equipment slots around it, a picker sheet per
   slot with stat comparisons, loadout thumbnails, and the race showcase on the character creation screen. Drawing
   goes through ART/HEROART/ICONART/UIART so both art styles work and everything is cached. [OURS] */
const DOLL = (() => {
  const LEFT = ["head", "chest", "hands", "feet"], RIGHT = ["weapon", "shield"];
  const NAMES = { weapon: "Weapon", shield: "Shield", head: "Head", chest: "Chest", hands: "Hands", feet: "Feet", ammo: "Ammo" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* the one number that matters for a piece in its slot: damage for weapons, armor for everything else */
  function statOf(row) {
    if (!row) return 0;
    const it = D.ITEMS[row.item]; if (!it) return 0;
    return it.slot === "weapon" ? (it.damage || 0) + (row.temper || 0) : (it.armor || 0) + (row.temper || 0);
  }
  /* compare a candidate row with what's worn in that slot: { val, cur, diff, dir: "up"|"down"|"same" } */
  function compare(row, curRow) {
    const val = statOf(row), cur = statOf(curRow), diff = val - cur;
    return { val, cur, diff, dir: diff > 0 ? "up" : diff < 0 ? "down" : "same" };
  }
  /* every item you could put in a slot, best first; the worn one is marked */
  function candidates(s, slot) {
    const worn = G.equipment(s)[slot];
    return s.inv.filter((r) => D.ITEMS[r.item]?.slot === slot)
      .map((r) => ({ row: r, worn: !!worn && worn.id === r.id, cmp: compare(r, worn) }))
      .sort((a, b) => b.worn - a.worn || b.cmp.val - a.cmp.val || D.ITEMS[a.row.item].name.localeCompare(D.ITEMS[b.row.item].name));
  }
  /* a faint outline for an empty slot, drawn once per slot and style */
  function emptyIcon(slot, size) {
    return ART.html(size, size, (g, H) => {
      g.fillStyle = "rgba(233,220,192,0.06)"; g.fillRect(0, 0, size, size);
      g.globalAlpha = 0.38; g.strokeStyle = "#cdb98f"; g.lineWidth = 1.6; g.lineJoin = "round"; g.lineCap = "round";
      const k = size / 40, P = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.stroke(); };
      ({
        head: () => { g.beginPath(); g.arc(20 * k, 22 * k, 10 * k, Math.PI, 0); g.stroke(); P([[10, 22], [10, 28], [30, 28], [30, 22]]); },
        chest: () => P([[12, 10], [20, 13], [28, 10], [32, 16], [28, 18], [28, 32], [12, 32], [12, 18], [8, 16], [12, 10]]),
        hands: () => P([[14, 32], [14, 18], [17, 12], [20, 18], [23, 12], [26, 18], [26, 32], [14, 32]]),
        feet: () => { P([[12, 10], [12, 28], [20, 30], [20, 34], [8, 34], [8, 28]]); P([[26, 10], [26, 28], [34, 30], [34, 34], [22, 34]]); },
        weapon: () => { P([[12, 30], [28, 10]]); P([[10, 25], [17, 32]]); P([[11, 31], [8, 34]]); },
        shield: () => P([[12, 10], [28, 10], [28, 22], [20, 32], [12, 22], [12, 10]]),
        ammo: () => { P([[10, 30], [30, 10]]); P([[30, 10], [25, 11]]); P([[30, 10], [29, 15]]); P([[10, 30], [14, 30]]); },
      }[slot] || (() => {}))();
      g.globalAlpha = 1;
    }, { key: "doll-empty:" + slot, cls: "ico" });
  }
  function slotBtn(s, slot, eq, size = 44) {
    const r = eq[slot], it = r && D.ITEMS[r.item];
    const label = it ? `${(r.tq && typeof TOWNS !== "undefined" ? TOWNS.QUALITY[r.tq] + " " : "") + it.name}` : `Nothing (${NAMES[slot].toLowerCase()})`;
    return `<button class="dslot ${r ? "full" : ""}" data-act="dollslot" data-slot="${slot}" aria-label="${esc(NAMES[slot])}: ${esc(label)}">
      ${r ? ICONART.item(r.item, size, r) : emptyIcon(slot, size)}<span class="dsl">${NAMES[slot]}</span>${r ? `<span class="dst num">${statOf(r)}</span>` : ""}</button>`;
  }
  /* the equipment screen: slots | figure | slots, then the numbers */
  function screen(s, stats) {
    const eq = G.equipment(s), am = typeof AMMO !== "undefined" ? AMMO.status(s) : null;
    const ammoRow = am ? (() => { const b = am.best && s.inv.find((x) => D.ITEMS[x.item]?.name === am.best); return `<div class="dammo ${am.best ? "" : "warn"}">${b ? ICONART.item(b.item, 28, b) : emptyIcon("ammo", 28)}<span>${am.best ? `${am.n} ${esc(am.best)}s <i>(best is used)</i>` : "No ammo for your bow"}</span></div>`; })() : "";
    return `<div class="doll">
      <div class="dcol">${LEFT.map((sl) => slotBtn(s, sl, eq)).join("")}</div>
      <div class="dfig">${HEROART.figure(s, 150, 206)}</div>
      <div class="dcol">${RIGHT.map((sl) => slotBtn(s, sl, eq)).join("")}</div>
    </div>${ammoRow}
    <div class="dsum"><span>🛡 Armor <b class="num">${stats.armor}</b></span><span>⚔ Damage <b class="num">${stats.dmg}</b></span><span>⚖ <b class="num">${stats.carried}</b>/${stats.cap}</span></div>`;
  }
  /* the picker sheet for one slot */
  function picker(s, slot) {
    const list = candidates(s, slot), worn = G.equipment(s)[slot];
    const arrow = (c) => c.dir === "up" ? `<b class="dup">▲ ${c.diff}</b>` : c.dir === "down" ? `<b class="ddown">▼ ${-c.diff}</b>` : `<b class="dsame">=</b>`;
    const unit = slot === "weapon" ? "damage" : "armor";
    const twoH = slot === "shield" && worn == null && G.equipment(s).weapon && D.ITEMS[G.equipment(s).weapon.item]?.hands === 2;
    return `<h2>${NAMES[slot]}</h2><p class="sub">${worn ? `Wearing ${esc(D.ITEMS[worn.item].name)} (${statOf(worn)} ${unit}).` : "Nothing in this slot."} Tap one to put it on.${twoH ? " You can't hold a shield with a two-handed weapon." : ""}</p>
      <div class="list dpick">${list.length ? list.map((c) => { const it = D.ITEMS[c.row.item];
        return `<button class="item ${c.worn ? "on" : ""}" data-act="${c.worn ? "dolloff" : "dolleq"}" data-id="${c.row.id}" data-slot="${slot}">${ICONART.item(c.row.item, 36, c.row)}<div class="t">${esc((c.row.tq && typeof TOWNS !== "undefined" ? TOWNS.QUALITY[c.row.tq] + " " : "") + it.name)}${c.worn ? " ✓" : ""}<span>${esc(G.itemStats(c.row.item))}${c.row.temper ? ` · +${c.row.temper}` : ""} · ${it.weight} wt</span></div>
          <span class="dcmp">${c.worn ? `<i>worn</i>` : arrow(c.cmp)}</span></button>`; }).join("") : `<p class="sub">You have nothing for this slot. Blacksmiths and the forge can help.</p>`}</div>
      <div class="evc">${worn ? `<button class="btn" data-act="dolloff" data-slot="${slot}">Take it off</button>` : ""}<button class="btn" data-act="close">Close</button></div>`;
  }
  /* a tiny portrait of how a loadout looks */
  const loadoutThumb = (s, name, size = 22) => HEROART.portrait({ ...s, loadout: name }, size);

  // ---- character creation
  const POWER_DESC = (race) => (typeof POWERS !== "undefined" && POWERS.RACE?.[race]) ? POWERS.RACE[race][1] : "";
  const skillName = (sk) => (sk === "Speech" ? "Speechcraft" : sk);
  const starter = {};
  function starterSave(race) { if (!starter[race]) { try { starter[race] = G.newSave("preview-" + race, "", race); } catch { starter[race] = { race, id: "preview-" + race }; } } return starter[race]; }
  function racePicker(cur) {
    return `<div class="rgrid">${Object.entries(D.RACES).map(([id, r]) => `<button class="rpick ${id === cur ? "on" : ""}" data-race="${id}" aria-pressed="${id === cur}">${HEROART.portrait({ race: id, id: "preview-" + id }, 52)}<span>${esc(r.name)}</span></button>`).join("")}</div>`;
  }
  function showcase(race) {
    const r = D.RACES[race], sk = r.skills.map(skillName);
    return `<div class="rshow"><div class="rfig heroprev">${HEROART.figure(starterSave(race), 150, 206)}</div>
      <div class="rtxt"><h3>${esc(r.name)}</h3><p class="sub">${esc(r.desc)}</p>
        <div class="rsk">${sk.map((k, i) => `<span class="rskill">${UIART.skill(k, 22)}<b>+${i === 0 ? 10 : 5}</b> ${esc(k)}</span>`).join("")}</div>
        <p class="rpow">${UIART.power(race, 24)}<span><b>${esc(r.power)}</b>${POWER_DESC(race) ? ` · ${esc(POWER_DESC(race))}` : ""}</span></p></div></div>`;
  }
  return { SLOTS_LEFT: LEFT, SLOTS_RIGHT: RIGHT, NAMES, statOf, compare, candidates, screen, picker, loadoutThumb, racePicker, showcase, starterSave };
})();
