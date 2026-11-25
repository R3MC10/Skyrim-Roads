/* Poisons in a fight: coat your weapon mid-fight. [OURS, itemgames]
   Owner: "poisons can't be used in combat for some reason." Poisons used to work only from the pack, outside fights.
   - The fight move "poison:<row id>" (the pack row of that poison: brewed poisons have long ids with colons in them).
     It shows in the fight's Items menu, the hotbar picker (Items tab) and the self-filling hotbar.
   - It costs one move and no stamina, like drinking a potion, and uses the poison up (counted like a potion: f.used).
   - The coat is the same as from the pack (TOWNS.coat): your next hit delivers it (two with Concentrated Poison),
     bows and crossbows too (the arrows carry it). It still goes through the 40% blow cap, so no one-hit wins.
   - Not in Beast Form or as a Vampire Lord (like potions), not with a staff or bare hands, not while your weapon
     is still coated. No minigame (like potions); Auto and the AI don't use it. */
const POISONFX = (() => {
  const T = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const owns = (a) => /^poison:/.test(String(a || ""));
  const rowOf = (f, a) => {
    if (!f || !f.s || !owns(a)) return null;
    const id = String(a).slice(7);
    const r = (f.s.inv || []).find((x) => String(x.id) === id);
    return r && typeof D !== "undefined" && D.ITEMS[r.item]?.slot === "poison" ? r : null;
  };
  const left = (f, r) => (r ? Math.max(0, f.left ? f.left(r.id) : r.qty || 0) : 0);
  const formed = (f) => typeof CURSE !== "undefined" && CURSE.noPotions && CURSE.noPotions(f);
  /* why you can't use it now ("" = you can) */
  function why(f, a) {
    const r = rowOf(f, a);
    if (!r || left(f, r) <= 0) return "None left";
    if (formed(f)) return "Not in Beast Form";
    if (!f.weapon || f.weapon.staff) return "Needs a weapon";
    if (f.s.poison) return "Already coated";
    return "";
  }
  const can = (f, a) => !why(f, a);
  /* the move itself: uses one up and coats the weapon */
  function act(f, a) {
    const r = rowOf(f, a); if (!r) return "You have no poison";
    const it = D.ITEMS[r.item];
    f.used[r.id] = (f.used[r.id] || 0) + 1;
    TOWNS.coat(f.s, it);
    const bow = f.wt === "bow" || f.wt === "crossbow";
    return `You coat your ${bow ? "arrows" : "weapon"} with ${it.name}. The next hit${f.s.poison.hits > 1 ? "s deliver" : " delivers"} it`;
  }
  /* what it does, in plain words: "Damage Health 12, Paralysis" (the move preview and the tooltip) */
  function effects(it) {
    return (it?.effects || []).map(([e, m, d]) => e === "Paralysis" ? T("Paralysis") : e === "Slow" ? T("Slow") : `${T(e)} ${Math.round(m)}${d && e === "Lingering Damage Health" ? ` (${Math.max(1, Math.round(d / 2))} ${T("rounds")})` : ""}`).join(", ");
  }
  function note(f, a) {
    const r = rowOf(f, a); if (!r) return "";
    const n = typeof PERKS !== "undefined" && PERKS.rank(f.s, "concentrated_poison") ? 2 : 1;
    return `${T(n > 1 ? "Your next 2 hits also deliver:" : "Your next hit also delivers:")} ${effects(D.ITEMS[r.item])}`;
  }
  /* the poisons you carry, one per stack: [[move, name, left]] */
  function list(f, s) {
    s = s || f?.s; if (!s) return [];
    const out = [];
    try { for (const r of s.inv || []) if (D.ITEMS[r.item]?.slot === "poison") { const n = f && f.left ? f.left(r.id) : r.qty || 0; if (n > 0) out.push(["poison:" + r.id, D.ITEMS[r.item].name, n]); } } catch (e) { /* none */ }
    return out;
  }
  const name = (s, a) => { const r = (s?.inv || []).find((x) => "poison:" + x.id === a); return r ? D.ITEMS[r.item]?.name || "Poison" : "Poison"; };
  return { owns, rowOf, why, can, act, effects, note, list, name };
})();
if (typeof module !== "undefined") module.exports = POISONFX;
