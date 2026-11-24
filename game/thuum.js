/* SHOUTS: one small API over the Thu'um ([OURS] façade; load after powers.js, shouts2.js and solstheim.js).
   The shouts themselves live in POWERS.SHOUTS (powers.js: 10 classics) and SHOUTS2 (shouts2.js: 11 more, fixed Word
   Walls, the Greybeards' and Paarthurnax's lessons, Clear Skies). This file adds no new fight code to the engine; it only
   wraps the existing hooks (POWERS.act / POWERS.roadShout / POWERS.tick), so the combat rewrite can keep calling them.
     SHOUTS.list(s)            → every shout: words (known/unlocked), level, cooldown for you, where to learn the rest
     SHOUTS.cd(s, id, lv)      → seconds the voice needs after this shout, after Commanding Voice + Thu'um Mastery (max −50%)
     SHOUTS.mastery(s)         → that cut, 0..0.5
     SHOUTS.left(s, t)         → seconds until your voice is back (0 = ready)
     SHOUTS.outside(id)        → true when the shout does something outside fights (Whirlwind Sprint, Aura Whisper,
                                 Clear Skies, Fire Breath to warm up)
     SHOUTS.use(s, id, t)      → shout it outside a fight; returns the line to show
     SHOUTS.unlock(s, word)    → spend a dragon soul on a word you know
     SHOUTS.ELEM               → which element a shout's damage is (the weather can feed or dull it)
   In fights ([OURS]): every shout's cooldown follows SHOUTS.cd (shouts2's new shouts used to skip Commanding Voice);
   Fire Breath / Frost Breath / Storm Call follow the sky like spells do (WFX.elem: rain dulls fire, storms feed shock,
   snow and blizzards feed frost). The engine's own shout hook is unchanged. */
const SHOUTS = (() => {
  const P = POWERS;
  const now = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const pfx = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) : 0);
  const CD_CAP = 0.5;
  const ELEM = { fire_breath: "fire", frost_breath: "frost", storm_call: "shock" };
  const OUT_EXTRA = ["fire_breath"];   // fight shouts that also do something on the road
  if (P.SHOUTS.fire_breath && !/Outside a fight/.test(P.SHOUTS.fire_breath[3])) P.SHOUTS.fire_breath[3] += " Outside a fight: breathe a fire to warm up.";

  const mastery = (s) => Math.min(CD_CAP, Math.max(0, pfx(s, "shoutcd")));
  function cd(s, id, lv) {
    const sh = P.SHOUTS[id]; if (!sh) return 0;
    lv = lv ?? P.level(s, id); if (!lv) return 0;
    return Math.max(1, Math.round(sh[2][Math.min(3, lv) - 1] * (1 - mastery(s))));
  }
  const left = (s, t = now()) => Math.max(0, Math.ceil((s.voiceAt || 0) - t));
  const outside = (id) => P.ROAD_SHOUTS.includes(id) || OUT_EXTRA.includes(id);
  const fightable = (id) => !!P.SHOUTS[id] && !P.ROAD_SHOUTS.includes(id);
  function list(s) {
    return Object.entries(P.SHOUTS).map(([id, [name, words, cds, desc]]) => {
      const lv = P.level(s, id);
      return {
        id, name, desc, level: lv, cds, cd: lv ? cd(s, id, lv) : 0, outside: outside(id), fight: fightable(id),
        words: words.map((w) => ({ w, known: P.known(s, w), unlocked: P.unlocked(s, w) })),
        hint: typeof SHOUTS2 !== "undefined" && words.some((w) => !P.known(s, w)) ? SHOUTS2.hint(s, id) : "",
      };
    });
  }
  const unlock = (s, word) => P.unlock(s, word);

  // ---- fights: one cooldown rule for every shout, and the sky feeds or dulls breath and storm
  const wxWord = (f) => String(f.wx?.name || "weather").toLowerCase();
  const act0 = P.act;
  P.act = (f, kind, arg) => {
    if (kind !== "shout" || !P.SHOUTS[arg]) return act0(f, kind, arg);
    const s = f.s, lv = P.level(s, arg), e0 = f.ehp;
    let r = act0(f, kind, arg);
    if (lv && !s._test) s.voiceAt = (f.t ?? now()) + cd(s, arg, lv);
    const el = ELEM[arg], m = el && typeof WFX !== "undefined" && f.wx ? WFX.elem(f, el) : 1;
    if (m !== 1 && arg !== "storm_call") {
      const dealt = e0 - f.ehp;
      if (dealt > 0) { f.ehp = e0 - Math.round(dealt * m); r += m > 1 ? ` · the ${wxWord(f)} feeds it` : ` · the ${wxWord(f)} dulls it`; }
    } else if (arg === "storm_call" && m > 1 && f.pw && f.pw.storm > 0) {
      f.pw.stormDmg = Math.round(f.pw.stormDmg * m); r += ` · the ${wxWord(f)} feeds it`;
    }
    return r;
  };

  // ---- outside fights: road shouts keep their own code; their cooldown follows SHOUTS.cd too. Fire Breath warms you up.
  const road0 = P.roadShout;
  P.roadShout = (s, id, t = now()) => {
    if (id === "fire_breath") {
      const lv = P.level(s, id);
      if (!lv) return "You can't shout that yet.";
      if (!P.voiceReady(s, t)) return `Your voice needs ${left(s, t)} more seconds.`;
      s.voiceAt = t + cd(s, id, lv);
      if (typeof WFX !== "undefined" && WFX.warmUp) WFX.warmUp(s, [30, 50, 70][lv - 1], t);
      return `YOL${lv > 1 ? " TOOR" : ""}${lv > 2 ? " SHUL" : ""}! You breathe fire into a heap of deadwood and warm your hands at it.`;
    }
    const v0 = s.voiceAt, lv = P.level(s, id);
    const r = road0(s, id, t);
    if (lv && s.voiceAt !== v0 && !s._test) s.voiceAt = t + cd(s, id, lv);
    return r;
  };
  const use = (s, id, t = now()) => (outside(id) ? P.roadShout(s, id, t) : "That shout is for fights. Add it to your tactics.");

  return { CD_CAP, ELEM, OUT_EXTRA, mastery, cd, left, outside, fightable, list, unlock, use };
})();
