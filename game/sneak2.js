/* Sneak openers that make sense ([OURS], after Remigiusz: "Why does every fight start with a sneak attack?
   Everything gets one-shotted.").
   1. Who stays hidden: Sneak skill against the foe's awareness. Heavy and medium armor clank, daylight gives you
      away, nights/fog/rain help, high-level, deadly and boss foes look harder, the undead sense the living and
      dragons see everything. Muffled Movement silences armor.
   2. When you try (AI setting per loadout, "sneak"): "safe" (default) only tries with a good chance and never when a
      party fights beside you; "always" tries every time; "never" walks in openly. Failing a try lets the foe strike
      first (Ambusher: no free strike).
   3. How hard a quiet blow lands: a sneak hit can take at most half of a foe's health (a third-ish for bosses), so
      only minor foes drop to one quiet blow. Ambusher raises the cap. */
const SNEAK2 = (() => {
  const P = (s, id) => (typeof PERKS !== "undefined" ? PERKS.rank(s, id) : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SAFE = 0.5;   // "when safe" only tries at this chance or better
  function pieces(s, type) {
    const eq = G.equipment(s); let n = 0;
    for (const sl of G.ARMOR_SLOTS) { if (sl === "shield") continue; const r = eq[sl]; if (r && D.ITEMS[r.item]?.type === type) n++; }
    return n;
  }
  const heavyPieces = (s) => pieces(s, "heavy");
  const tags = (e) => new Set(e?.tags || []);
  /* chance that the foe doesn't notice you before the first blow */
  function chance(s, e, t) {
    t = t || G.now(); e = e || {};
    const tg = tags(e);
    const quiet = P(s, "muffled_movement") > 0;
    let c = 0.05 + G.skill(s, "Sneak") / 130;
    if (!quiet) c -= 0.06 * heavyPieces(s) + 0.03 * pieces(s, "medium");
    c += G.isNight(t) ? 0.1 : -0.1;
    c += 0.15 * P(s, "detect_life") + G.fxSum(s, "hide", t) / 100 + (typeof PFX !== "undefined" ? Math.min(25, PFX.num(s, "hide")) / 100 : 0);
    if (typeof WEVENTS !== "undefined" && s.x != null) c += WEVENTS.weather([s.x, s.y], t).sneak || 0;
    if (typeof WFX !== "undefined") c += WFX.sneakAdd(s, t) || 0;
    // the foe's awareness
    if (e.level != null) c -= clamp((e.level - (s.level || 1)) * 0.01, -0.08, 0.12);
    if (e.danger === "high") c -= 0.12;
    if (e.boss) c -= 0.15;
    if (tg.has("undead")) c -= 0.12;
    if (tg.has("construct")) c -= 0.06;
    if (tg.has("beast")) c -= 0.04;   // noses
    const seen = (1 - clamp(c, 0, 1)) * (1 - 0.12 * P(s, "stealth"));   // [Skyrim] Stealth: harder to detect per rank (our scale)
    let out = clamp(1 - seen, 0.02, 0.85);
    if (tg.has("dragon")) out = Math.min(out, 0.04);   // dragons see you coming
    return out;
  }
  const settings = (f) => (typeof AISET !== "undefined" && f.L ? AISET.get(f.L) : { sneak: "safe" });
  const inParty = (f) => f.allies.some((a) => a.coop || a.party || a.player);
  /* the opening of a fight: do you try to sneak up, and does it work? */
  function opener(f, t) {
    const mode = settings(f).sneak || "safe";
    const c = chance(f.s, f.e, t), res = { chance: c, mode, tried: false, hidden: false, spotted: false };
    if (mode === "never") return res;
    if (mode === "safe" && (c < SAFE || inParty(f))) return res;
    res.tried = true;
    if (Math.random() < c) res.hidden = true;
    else if (ambusher(f.s)) res.missed = true;   // seen, but ready for it
    else res.spotted = true;
    return res;
  }
  const ambusher = (s) => P(s, "ambusher") > 0 || (typeof PFX !== "undefined" && PFX.num(s, "ambush") > 0);
  /* the most a single sneak blow may take, as a share of the foe's full health (0 = no cap: minor foes) */
  function capFrac(f) {
    const e = f.e;
    if (!e.boss && (e.danger === "low" || (!e.danger && (e.level ?? 99) <= (f.s.level || 1) - 12))) return 0;
    const am = ambusher(f.s);
    return e.boss ? (am ? 0.5 : 0.35) : (am ? 0.7 : 0.5);
  }
  function cap(f) { const fr = capFrac(f); return fr ? fr * (f.e.health || f.ehp0 || f.ehp) : 0; }
  /* one line for the encounter card */
  function noteHTML(s, e, mode, esc = (x) => x) {
    const c = chance(s, e), m = mode || "safe";
    const what = m === "never" ? "you walk in openly" : m === "always" ? "you'll always try to sneak up" : c >= SAFE ? "you'll try to sneak up" : "too risky: you won't try";
    return `<p class="sub sneak2"> Chance to stay hidden: <b>${Math.round(c * 100)}%</b> · ${esc(what)}. A sneak blow can't fell a strong foe outright.</p>`;
  }
  return { chance, opener, capFrac, cap, heavyPieces, ambusher, noteHTML, SAFE };
})();
if (typeof module !== "undefined") module.exports = SNEAK2;
