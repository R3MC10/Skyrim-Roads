/* Colour coding [OURS]: one place that decides what colour a thing is, so every screen agrees.
   CC.tier(itemId, row)   → "common" | "fine" | "superior" | "exquisite" | "legendary" | "unique"
   CC.school(spellOrId)   → "destruction" | "restoration" | "alteration" | "conjuration" | "illusion" | "mysticism" | "shout" | "power"
   CC.element(spellOrId)  → "fire" | "frost" | "shock" | "poison" | "heal" | "" (none)
   CC.skillCat(skill)     → "warrior" | "mage" | "thief" | "movement" | "social" | "crafting"
   CC.questType(id)       → "main" | "sol" | "war" | "guild" | "daedric" | "side" | "misc"
   CC.paint(root)         → colours log lines, damage numbers and +/- effect text inside root (safe to call often)
   The colours themselves live in CSS (index.html, "colour coding" block): .q-<tier> .sch-<school> .el-<element> .cat-<cat> .qt-<type> .buff .debuff */
const CC = (() => {
  const TIERS = ["common", "fine", "superior", "exquisite", "legendary", "unique"];
  const TIER_NAME = { common: "Common", fine: "Fine", superior: "Superior", exquisite: "Exquisite", legendary: "Legendary", unique: "Unique" };
  function tier(id, row) {
    const it = (typeof D !== "undefined" && D.ITEMS[id]) || null; if (!it) return "common";
    if (it.unique || it.dae || (it.noTrade && (it.value || 0) >= 1000)) return "unique";
    const n = (it.name || id).toLowerCase();
    let t = 0;
    if (/daedric|dragonbone|dragonscale|dragonplate|stalhrim|dragon /.test(n)) t = 4;
    else if (/ebony|glass|falmer hardened|nightingale|ancient shrouded/.test(n)) t = 3;
    else if (/elven|orcish|dwarven|scaled|steel plate|bonemold|chitin|nordic|ancient nord|imperial officer|stormcloak officer|forsworn|silver/.test(n)) t = 2;
    else if (/steel|imperial|banded|studded|leather/.test(n) && it.slot !== "potion") t = 1;
    const ench = !!(it.enchant || it.aenchant || row?.ench || row?.enchant);
    if (ench) t = Math.max(t + 1, 1);
    if (row?.mw && /perfect|masterful/i.test(String(row.mw))) t += 1;
    if (row?.temper >= 3) t = Math.max(t, 1);
    if (["potion", "food", "ingredient", "misc", "ore", "ingot", "gem"].includes(it.slot)) {
      const v = it.value || 0; t = v >= 400 ? 3 : v >= 150 ? 2 : v >= 60 ? 1 : 0;
    }
    return TIERS[Math.max(0, Math.min(4, t))];
  }
  const spellOf = (x) => {
    if (x && typeof x === "object") return x;
    const s = String(x || ""); const [k, a] = s.includes(":") ? s.split(":") : ["spell", s];
    if (k === "shout") return { school: "shout" };
    if (k === "power" || k === "fx") return { school: "power" };
    return (typeof D !== "undefined" && D.SPELLS[a]) || null;
  };
  function school(x) { const sp = spellOf(x); return sp?.school ? String(sp.school).toLowerCase() : ""; }
  function element(x) {
    const sp = spellOf(x); if (!sp) return "";
    if (sp.element) return String(sp.element).toLowerCase();
    if (/heal|restore|ward/.test(sp.kind || "") || /heal/i.test(sp.name || "")) return "heal";
    if (/poison/i.test(sp.name || "")) return "poison";
    return "";
  }
  function skillCat(skill) {
    const G = (typeof D !== "undefined" && D.SKILL_GROUPS) || {};
    for (const [g, list] of Object.entries(G)) if (list.includes(skill)) return g.toLowerCase() === "warrior" ? "warrior" : g.toLowerCase() === "mage" ? "mage" : g.toLowerCase() === "thief" ? "thief" : g.toLowerCase();
    return "";
  }
  function questType(id) {
    const s = String(id || "");
    if (/^main|dragon/.test(s)) return "main";
    if (/^sol|miraak/.test(s)) return "sol";
    if (/^cw_/.test(s)) return "war";
    if (/^dae|daedric/.test(s)) return "daedric";
    if (/companions|college|thieves|brotherhood|bards|guild/.test(s)) return "guild";
    return "side";
  }

  // ---- painting text
  const EL_RE = [
    [/|\bburn(s|ing)?\b|\bfire\b|flames?\b|firebolt|fireball|incinerate/i, "fire"],
    [/|\bfrost\b|\bchill(ed|s)?\b|\bfreez(e|es|ing)\b|frostbite|ice spike|\bice\b/i, "frost"],
    [/|\bshock(ed|s)?\b|\bsparks\b|lightning|thunder/i, "shock"],
    [/|\bpoison(ed|s)?\b|\bvenom\b/i, "poison"],
    [/|\bheal(s|ed|ing)?\b|\brestore(s|d)?\b|\bregenerat/i, "heal"],
  ];
  function lineElement(t) { for (const [re, el] of EL_RE) if (re.test(t)) return el; return ""; }
  /* + numbers green, - numbers red, inside short effect texts (".fx-text" or elements marked data-cc="fx") */
  function paintFx(el) {
    if (el.dataset.ccDone) return; el.dataset.ccDone = "1";
    el.innerHTML = el.innerHTML.replace(/(^|[\s(>])([+−-]\d+(?:\.\d+)?%?)(?=[\s,.)<]|$)/g, (m, a, n) => `${a}<b class="${/^\+/.test(n) ? "buff" : "debuff"}">${n}</b>`);
  }
  function paint(root) {
    if (!root || !root.querySelectorAll) return;
    // fight log lines and diary lines: tint by element
    root.querySelectorAll(".flog > div:not([data-cc]), .log > div:not([data-cc]), .log p:not([data-cc])").forEach((p) => {
      p.dataset.cc = "1"; const el = lineElement(p.textContent || ""); if (el) p.classList.add("el-" + el, "cc-line");
    });
    root.querySelectorAll("[data-cc=fx]").forEach(paintFx);
  }
  /* the colour key shown in every ⓘ help */
  function legend() {
    const sw = (cls, t) => `<span class="ccsw ${cls}">${t}</span>`;
    return `<div class="cclegend"><b>Colour key</b>
      <p>${TIERS.map((t) => sw("q-" + t, TIER_NAME[t])).join("")}</p>
      <p>${sw("el-fire", " Fire")}${sw("el-frost", " Frost")}${sw("el-shock", " Shock")}${sw("el-poison", " Poison")}${sw("el-heal", "✚ Healing")}</p>
      <p>${["destruction", "restoration", "alteration", "conjuration", "illusion", "mysticism"].map((x) => sw("sch-" + x, x[0].toUpperCase() + x.slice(1))).join("")}</p>
      <p>${sw("cat-warrior", "Warrior skills")}${sw("cat-mage", "Mage skills")}${sw("cat-thief", "Thief skills")}${sw("cat-crafting", "Crafting")}${sw("cat-social", "Social")}${sw("cat-movement", "Movement")}</p>
      <p>${sw("buff", "+ Buff")}${sw("debuff", "− Debuff")}${sw("is-stolen", " Stolen")}${sw("qt-main", "Main quest")}${sw("qt-guild", "Guild")}${sw("qt-daedric", "Daedric")}${sw("qt-war", "Civil War")}${sw("qt-side", "Side")}</p></div>`;
  }
  // repaint whatever the game just drew (one pass per frame at most)
  let queued = false;
  function watch() {
    try {
      const mo = new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; paint(document.body); }); });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch { /* old browser: no colour on log lines */ }
  }
  try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch(); } catch { /* ignore */ }
  return { TIERS, TIER_NAME, legend, tier, school, element, skillCat, questType, paint, lineElement };
})();
