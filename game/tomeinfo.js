/* Spell tome info: what a tome teaches before you buy, loot or read it. One place for the words, so merchant rows,
   the pack, loot votes, caravans, market stalls and search (and the hover/long-press tooltips) all say the same thing:
   the spell's name, school, level, magicka cost, AP cost in turn-by-turn fights, what it does (with your numbers),
   whether you already know it, and whether your skill is high enough.

   TOMEINFO.facts(s, itemOrSpellId) -> plain object (null if it isn't a tome/spell)
   TOMEINFO.line(s, item)           -> one short line of text ("Adept Destruction · 54 magicka · 4 AP · you know it")
   TOMEINFO.box(s, item)            -> compact HTML block for list rows ("" for anything that isn't a tome)
   TOMEINFO.html(s, item, {head})   -> SkyUI-style item card for detail panels / tooltips
   s may be null: then base numbers are used and nothing is said about knowing it. G.itemStats(tome) is wrapped to
   return line() for the player bound with TOMEINFO.bind(() => S) (ui.js does that), so every list that already shows
   item stats picks it up. */
const TOMEINFO = (() => {
  let cur = () => null;
  const bind = (fn) => { if (typeof fn === "function") cur = fn; };
  const current = () => { try { return cur() || null; } catch (e) { return null; } };
  const safe = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
  const M = () => (typeof MAGIC !== "undefined" ? MAGIC : null);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const AP = { Novice: 2, Apprentice: 3, Adept: 4, Expert: 5, Master: 6 };      // same as tbfight.js TIERC (fallback)
  const REQ = { Novice: 0, Apprentice: 25, Adept: 50, Expert: 75, Master: 100 };   // same as magic.js REQ (fallback)
  const NUMERIC = new Set(["damage", "heal", "armor", "summon", "calm", "regen", "cloak", "dot", "rune"]);   // the numbers say it all; other kinds also get plain words

  function spellIdOf(x) {
    if (!x) return null;
    const it = D.ITEMS[x];
    if (it && it.slot === "tome") return D.SPELLS[it.spell] ? it.spell : null;
    return D.SPELLS[x] ? x : null;
  }
  const isTome = (item) => D.ITEMS[item]?.slot === "tome" && !!D.SPELLS[D.ITEMS[item].spell];

  function facts(s, x) {
    const id = spellIdOf(x); if (!id) return null;
    const sp = D.SPELLS[id], mg = M();
    const level = sp.level || safe(() => mg.levelOf(id), "Novice") || "Novice";
    const utility = sp.kind === "utility";
    const support = typeof SPELLBOOK !== "undefined" && SPELLBOOK.SUPPORT ? SPELLBOOK.SUPPORT.has(sp.kind) : false;
    const cost = utility ? null : Math.round(s ? safe(() => G.spellCost(s, sp), sp.cost || 0) : (sp.cost || 0));
    const tierc = typeof TB !== "undefined" && TB.TIERC ? TB.TIERC : AP;
    const ap = utility ? null : (tierc[level] || 3);
    const what = String(safe(() => mg.describe(sp), "") || "");
    const parts = s && !utility ? safe(() => mg.nums(s, id, false), []) : [];
    const known = !!(s && (s.spells || []).includes(id));
    const need = (mg && mg.REQ ? mg.REQ : REQ)[level] ?? 0;
    const have = s ? safe(() => G.skill(s, sp.school), null) : null;
    const buyNeed = level === "Master" ? 90 : null;   // magic.js canBuy: the College only teaches Master spells at 90
    const fail = s ? safe(() => mg.failChance(s, id), 0) : 0;
    const dual = !!safe(() => mg.dualable(sp), false);
    return { id, name: sp.name, school: sp.school, level, kind: sp.kind, element: sp.element || "", cost, ap, dualAp: dual && ap ? ap + 2 : null,
      utility, support, dual, what, parts, known, need, have, enough: have == null ? null : have >= need, buyNeed, fail };
  }

  /* the skill verdict, in plain words: { t, ok } */
  function verdict(f) {
    if (!f || f.have == null) return null;
    if (f.known) return { t: "You already know this spell", ok: true, k: "known" };
    if (f.buyNeed && f.have < f.buyNeed) return { t: `Needs ${f.school} ${f.buyNeed} to learn (you have ${f.have})`, ok: false, k: "low" };
    if (f.enough) return { t: `Your ${f.school} ${f.have} is enough`, ok: true, k: "ok" };
    return { t: `Your ${f.school} ${f.have} is under ${f.need}: it costs more and fizzles ${Math.round(f.fail * 100)}% of the time`, ok: false, k: "low" };
  }

  /* one short line, no HTML */
  function line(s, item) {
    const f = facts(s, item); if (!f) return "";
    const bits = [`${f.level} ${f.school}`];
    if (f.utility) bits.push("no magicka", "out of fights");
    else bits.push(`${f.cost} magicka`, `${f.ap} AP`);
    if (f.support) bits.push("on allies");
    if (f.known) bits.push("you know it");
    else if (f.have != null && f.buyNeed && f.have < f.buyNeed) bits.push(`needs ${f.school} ${f.buyNeed}`);
    else if (f.have != null && !f.enough) bits.push(`needs ${f.school} ${f.need}`);
    return bits.join(" · ");
  }

  const partsHTML = (ps) => ps.map((p) => `<span class="nv nv-${esc(p.c)}">${esc(p.t)}</span>`).join(" · ");
  const whatText = (f) => f.what ? f.what.replace(/\.?$/, ".") : "";

  /* compact block for list rows: what it does (your numbers) + the verdict */
  function box(s, item) {
    if (!isTome(item)) return "";
    const f = facts(s, item); if (!f) return "";
    const v = verdict(f);
    const does = f.parts.length ? partsHTML(f.parts) + (NUMERIC.has(f.kind) ? "" : `<br><i>${esc(whatText(f))}</i>`) : `<i>${esc(whatText(f) || "A spell.")}</i>`;
    return `<div class="ti-box" data-tome="${esc(f.id)}"><div class="ti-does">${does}</div>${v ? `<div class="ti-v ${v.ok ? "ok" : "low"}">${v.ok ? "✓" : "⚠"} ${esc(v.t)}</div>` : ""}</div>`;
  }

  /* SkyUI-style card: name, a strip of stat boxes, the description, exact numbers single/dual, the verdict */
  function html(s, item, opts = {}) {
    const f = facts(s, item); if (!f) return "";
    const v = verdict(f), mg = M();
    const stat = (val, lab, cls = "") => `<div class="ti-stat ${cls}"><b>${esc(val)}</b><small>${esc(lab)}</small></div>`;
    const stats = [stat(f.school, "School"), stat(f.level, "Level"),
      f.utility ? stat("—", "Magicka") : stat(f.cost, "Magicka", "mana"),
      f.utility ? stat("—", "AP") : stat(f.ap + (f.dualAp ? ` / ${f.dualAp}` : ""), f.dualAp ? "AP · dual" : "AP")].join("");
    const nums = s && !f.utility ? safe(() => mg.infoHTML(s, f.id), "") : "";
    const desc = !nums || !NUMERIC.has(f.kind) ? `<p class="ti-what">${esc(whatText(f) || "A spell.")}${f.utility ? " No magicka: a short rest between casts." : ""}${f.support ? " Cast it on a teammate in fights." : ""}</p>` : "";
    return `<div class="ti-card" data-tome="${esc(f.id)}">${opts.head === false ? "" : `<div class="ti-h">${esc(f.name)}</div>`}
      <div class="ti-stats">${stats}</div>${desc}${nums}
      ${v ? `<div class="ti-v ${v.ok ? "ok" : "low"}">${v.ok ? "✓" : "⚠"} ${esc(v.t)}</div>` : ""}</div>`;
  }

  // every list that shows G.itemStats (sell list, pack rows, caravans, market stalls, events) gets the tome line
  if (typeof G !== "undefined" && typeof G.itemStats === "function" && !G.itemStats._tome) {
    const base = G.itemStats;
    G.itemStats = function (item) { return isTome(item) ? safe(() => line(current(), item), base(item)) || base(item) : base(item); };
    G.itemStats._tome = true;
  }

  return { bind, current, facts, verdict, line, box, html, isTome, spellIdOf };
})();
