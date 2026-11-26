/* Colour coding [OURS]: one place that decides what colour a thing is, so every screen agrees.
   Item rarity is not here: it lives in rarity.js (RARITY.of / .cls / .tag), the one source of truth for item colours.
   CC.school(spellOrId)   → "destruction" | "restoration" | "alteration" | "conjuration" | "illusion" | "mysticism" | "shout" | "power"
   CC.element(spellOrId)  → "fire" | "frost" | "shock" | "poison" | "heal" | "" (none)
   CC.skillCat(skill)     → "warrior" | "mage" | "thief" | "movement" | "social" | "crafting"
   CC.questType(id)       → "main" | "sol" | "war" | "guild" | "daedric" | "side" | "misc"
   CC.paint(root)         → colours log lines, damage numbers and +/- effect text inside root (safe to call often)
   The colours themselves live in CSS (index.html, "colour coding" block): .q-<rarity> .sch-<school> .el-<element> .cat-<cat> .qt-<type> .buff .debuff */
const CC = (() => {
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
      ${typeof RARITY !== "undefined" ? `<p>${RARITY.legend(sw)}</p>` : ""}
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
  return { legend, school, element, skillCat, questType, paint, lineElement };
})();
