/* Charge bars for enchanted weapons and staffs (CHARGE). [OURS]
   Remigiusz: "weapons with a charge should have a charge bar visible (in any ui thingy (applies globally))".
   How charge works (engine.js / magic.js, unchanged here): an enchanted weapon holds enchant.capacity charge, a staff
   staff.capacity. Every hit that fires the enchantment uses some (stronger enchantments and less Enchanting skill use
   more; Enchanter and Thrifty Runes use less), a staff uses perCast per spell. Below one hit's worth the magic stops
   until you recharge it with a filled soul gem (Items → the weapon → Recharge). New items come full.
   This module:
   - ICONART.item(id, size, row) is wrapped, so EVERY item icon in the game (pack, Items menu, details, tooltips,
     shops, stash and chests, follower gear, loot and loot votes, the paper doll, search, markets, trades...) gets a
     thin purple bar along its bottom edge when the item holds charge. Empty: the bar turns red.
   - CHARGE.tag / CHARGE.text / CHARGE.detail for list rows and detail cards ("no charge" when empty),
     CHARGE.fightBar for the turn-by-turn fight screen (a meter under your health while it's in your hand).
   - CHARGE.migrate(s): old saves whose enchanted rows had no charge number start full (the engine read them as empty).
   - CHARGE.costMult(s): Thrifty Runes (perkfx.js "enchcost") makes every hit and staff cast use less. */
const CHARGE = (() => {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const item = (id) => (typeof D !== "undefined" && D.ITEMS ? D.ITEMS[id] : null);
  const P = (s, id) => (s && typeof PERKS !== "undefined" ? PERKS.rank(s, id) : 0);

  /* Thrifty Runes and friends: how much of the normal charge each hit / cast uses (never below 30%) */
  function costMult(s) {
    const pfx = s && typeof PFX !== "undefined" && PFX.num ? PFX.num(s, "enchcost") : 0;
    return Math.max(0.3, 1 - (pfx || 0));
  }
  /* what one hit (or one staff cast) uses, for this save's perks and skill */
  function cost(s, it) {
    if (!it) return 0;
    if (it.staff) return it.staff.perCast * (1 - 0.1 * P(s, "enchanter")) * costMult(s);
    const e = it.enchant; if (!e) return 0;
    if (typeof F !== "undefined" && F.enchantCost && s && typeof G !== "undefined" && G.skill) return F.enchantCost(e.base_cost, e.magnitude, e.max_magnitude, G.skill(s, "Enchanting")) * (1 - 0.1 * P(s, "enchanter")) * costMult(s);
    return 3 * ((e.base_cost * e.magnitude) / e.max_magnitude) ** 1.1 * 0.3;   // no save at hand: a middling skill
  }
  /* {cur, cap, pct, per, hits, empty, staff} for an item id and (optionally) its pack row; null for items without charge.
     A row with no charge number is full (new, or kept in a chest/market listing); s (optional) sets the per-hit cost. */
  function info(id, row = null, s = null, cur = null) {
    const it = item(id); if (!it || it.slot !== "weapon") return null;
    const src = it.enchant || it.staff; if (!src || !(src.capacity > 0)) return null;
    const cap = src.capacity;
    const c = Math.max(0, Math.min(cap, cur ?? (row && row.charge != null ? +row.charge || 0 : cap)));
    const per = Math.max(0.01, cost(s, it));
    const hits = Math.floor(c / per + 1e-9);
    return { cur: c, cap, pct: c / cap, per, hits, empty: hits < 1, staff: !!it.staff };
  }
  const pctTxt = (x) => `${Math.round(100 * x.pct)}%`;
  /* the bar itself: thin, purple, SkyUI-style; empty → red track. opts.w = width in px (else fills its box) */
  function bar(id, row = null, s = null, opts = {}) {
    const x = opts.info || info(id, row, s); if (!x) return "";
    const w = (100 * x.pct).toFixed(1);
    const lbl = x.empty ? "No charge" : `Charge ${pctTxt(x)}`;
    return `<span class="cbar${x.empty ? " cb-empty" : ""}${opts.cls ? " " + opts.cls : ""}" role="meter" aria-label="${esc(lbl)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(100 * x.pct)}"${opts.style ? ` style="${opts.style}"` : ""}><i style="width:${w}%"></i></span>`;
  }
  /* short words for a list row: "" when there's charge, "no charge" when it's spent */
  function tag(id, row = null, s = null) {
    const x = info(id, row, s); if (!x || !x.empty) return "";
    return ` <i class="cb-none">no charge</i>`;
  }
  /* a list row's inline bar plus "no charge" when empty (for rows that show text after the name) */
  function inline(id, row = null, s = null) {
    const x = info(id, row, s); if (!x) return "";
    return `<span class="cb-inl">${bar(id, row, s, { info: x })}${x.empty ? `<i class="cb-none">no charge</i>` : `<i class="cb-pct num">${pctTxt(x)}</i>`}</span>`;
  }
  /* plain text for tooltips and stat lines */
  function text(id, row = null, s = null) {
    const x = info(id, row, s); if (!x) return "";
    if (x.empty) return "no charge";
    return x.staff ? `charge ${pctTxt(x)} (${x.hits} ${x.hits === 1 ? "cast" : "casts"})` : `charge ${pctTxt(x)} (about ${x.hits} ${x.hits === 1 ? "hit" : "hits"})`;
  }
  /* a detail card / tooltip block: label, number, bar, and what to do when it's empty */
  function detail(id, row = null, s = null) {
    const x = info(id, row, s); if (!x) return "";
    const n = x.staff ? `${x.hits} ${x.hits === 1 ? "cast" : "casts"} left` : `about ${x.hits} ${x.hits === 1 ? "hit" : "hits"} left`;
    return `<div class="cb-detail${x.empty ? " cb-empty" : ""}"><div class="cb-head"><span>Charge</span><b class="num">${x.empty ? "no charge" : pctTxt(x)}</b></div>${bar(id, row, s, { info: x, cls: "cb-wide" })}<small>${x.empty ? (x.staff ? "The staff is spent. Recharge it with a filled soul gem." : "The enchantment is asleep. Recharge it with a filled soul gem.") : n}</small></div>`;
  }

  /* the fight screen: a meter under your health while an enchanted weapon or staff is in your hand */
  function fightBar(f) {
    if (!f || !f.weapon || !f.weaponInv || !f.s) return "";
    const row = (f.s.inv || []).find((r) => r.id === f.weaponInv); if (!row) return "";
    const it = item(row.item); if (!it || !(it.enchant || it.staff)) return "";
    const cap = (it.enchant || it.staff).capacity;
    const cur = f.charges?.[f.weaponInv] ?? (row.charge ?? cap);
    const x = info(row.item, row, f.s, cur); if (!x) return "";
    return `<div class="tbbar mid ch${x.empty ? " cb-empty" : ""}" role="meter" aria-label="${x.empty ? "No charge" : "Weapon charge " + pctTxt(x)}" aria-valuenow="${Math.round(100 * x.pct)}"><i style="width:${(100 * x.pct).toFixed(1)}%"></i><span class="num"><em>✦</em> ${x.empty ? "no charge" : pctTxt(x)}</span></div>`;
  }

  /* old saves: enchanted weapons with no charge number were read as empty by the fight code. They start full. */
  function migrate(s) {
    let n = 0;
    const fix = (list) => { for (const r of list || []) { const it = item(r?.item); if (r && it?.enchant && r.charge == null) { r.charge = it.enchant.capacity; n++; } } };
    fix(s?.inv);
    if (s?.folData) for (const f of Object.values(s.folData)) fix(f?.inv);   // followers' own packs (followers2.js)
    return n;
  }

  /* every item icon gets the bar (the icon's own size, along its bottom edge) */
  function wrapIcons() {
    if (typeof ICONART === "undefined" || ICONART.item._charge) return;
    const base = ICONART.item;
    const wrapped = function (id, size = 34, row = null) {
      const html = base(id, size, row);
      if (!html) return html;
      let x = null; try { x = info(id, row, typeof window !== "undefined" && window.__dbg ? window.__dbg.save() : null); } catch (e) { x = null; }
      if (!x) return html;
      const pad = Math.max(2, Math.round(size * 0.1)), h = size >= 56 ? 5 : size >= 30 ? 4 : 3;
      return `<span class="cb-ico" style="width:${size}px;height:${size}px">${html}${bar(id, row, null, { info: x, cls: "cb-on", style: `left:${pad}px;right:${pad}px;bottom:${Math.max(1, Math.round(size * 0.04))}px;height:${h}px` })}</span>`;
    };
    wrapped._charge = true;
    ICONART.item = wrapped;
  }
  wrapIcons();

  /* Polish (i18n.js swaps text on screen) */
  if (typeof I18N_EXTRA === "undefined" && typeof globalThis !== "undefined") globalThis.I18N_EXTRA = { words: {}, pat: [] };
  if (typeof I18N_EXTRA !== "undefined") {
    Object.assign(I18N_EXTRA.words, {
      "no charge": "brak ładunku", "No charge": "Brak ładunku", "Charge": "Ładunek",
      "The staff is spent. Recharge it with a filled soul gem.": "Kostur jest wyczerpany. Naładuj go pełnym kamieniem dusz.",
      "The enchantment is asleep. Recharge it with a filled soul gem.": "Zaklęcie śpi. Naładuj broń pełnym kamieniem dusz.",
      "Thrifty Runes": "Oszczędne runy", "Recharge": "Naładuj", "No filled soul gem": "Brak pełnego kamienia dusz",
      "Your enchanted weapons and staffs use 20% less charge per hit or cast, and every kill puts 3% back into your enchanted weapon.": "Zaklęta broń i kostury zużywają o 20% mniej ładunku na cios lub czar, a każde zabójstwo oddaje 3% ładunku zaklętej broni.",
      // patch note
      "Charge bars": "Paski ładunku",
      "Enchanted weapons and staffs now show a thin purple charge bar everywhere they appear: your pack, the Items menu and its details, tooltips, the paper doll, shops, chests and stash, follower gear, loot and loot votes, markets and trades.": "Zaklęta broń i kostury mają teraz cienki fioletowy pasek ładunku wszędzie, gdzie się pojawiają: w plecaku, menu Przedmiotów i ich szczegółach, podpowiedziach, na manekinie, w sklepach, skrzyniach i schowku, w ekwipunku towarzysza, łupach i głosowaniu nad łupem, na targu i w wymianach.",
      "When the charge runs out the bar turns red and the item says \"no charge\": the enchantment stops working until you recharge it with a filled soul gem (Items → the weapon → Recharge).": "Gdy ładunek się skończy, pasek robi się czerwony, a przedmiot pokazuje „brak ładunku”: zaklęcie przestaje działać, dopóki nie naładujesz broni pełnym kamieniem dusz (Przedmioty → broń → Naładuj).",
      "In a turn-by-turn fight a charge meter sits under your health while an enchanted weapon or staff is in your hand.": "W walce turowej pod twoim zdrowiem widać miernik ładunku, gdy trzymasz zaklętą broń lub kostur.",
      "New Enchanting perk, Thrifty Runes: enchanted weapons and staffs use 20% less charge, and every kill puts 3% back.": "Nowy atut Zaklinania, Oszczędne runy: zaklęta broń i kostury zużywają o 20% mniej ładunku, a każde zabójstwo oddaje 3%.",
      "Old saves: enchanted weapons that had lost their charge number start full again.": "Stare zapisy: zaklęta broń, która zgubiła stan ładunku, znów jest pełna.",
    });
    I18N_EXTRA.pat.push(
      [/^Charge (\d+)%$/, (m) => `Ładunek ${m[1]}%`],
      [/^Weapon charge (\d+)%$/, (m) => `Ładunek broni ${m[1]}%`],
      [/^charge (\d+)% \(about (\d+) hits?\)$/, (m) => `ładunek ${m[1]}% (ok. ${m[2]} ciosów)`],
      [/^charge (\d+)% \((\d+) casts?\)$/, (m) => `ładunek ${m[1]}% (${m[2]} czarów)`],
      [/^about (\d+) hits? left$/, (m) => `zostało ok. ${m[1]} ciosów`],
      [/^(\d+) casts? left$/, (m) => `zostało czarów: ${m[1]}`],
    );
  }

  return { info, cost, costMult, bar, tag, inline, text, detail, fightBar, migrate, wrapIcons };
})();
