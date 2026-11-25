/* Turn-based fights with initiative; every move costs stamina, magicka or health. [OURS module]
   [Owner, build 145: "AP points should be gone from the game. now everything costs stamina or mana or health" and
   "now player chooses its turn really"] There are no action points any more. On your turn you pick any mix of moves
   (attack, power attack, guard, bash, spells, shouts, potions, dark moves...) and pay for each one in stamina, magicka or
   health, then press End turn. The same move again in one turn costs 50% more each time, a turn holds at most 4 moves
   and 2 potions, and the fewer moves you make, the more guard you keep (up to 30%). Stamina and magicka come back
   every round. The notes below are the original design, kept for history.
   Remigiusz: "Let's make fights really turn based; turn order should be initiative based. Followers and summons do their
   turns automatically." You play your own turns (with an Auto button); Athletics and Alteration make your moves cheaper,
   initiative comes from Acrobatics + Sneak (heavy armour slows you); balanced so fights don't end quickly; party fights
   harder; in a party each player plays their own turns live.

   How it fits the engine: every fight in the game is still a G.Fight. The old instant `run()` is kept for sims, the arena
   and tests. In the app, TB.call(S, fn, done) runs a game action (road encounter, dungeon room, quest, raid...). When the
   action reaches `fight.run()`, the action is paused, the fight is played turn by turn on screen, and then the action is
   re-run from a snapshot with the same dice up to the fight, which now "finishes" instantly with the played result.
   So loot, death, quests and XP all go through the exact same code as before.

   Each round: everyone rolls initiative (base + d10); you pay stamina, magicka or health for moves (weapon blows, power
   attacks, guard, spells, shouts, potions, flee); moves you don't make become guard. Followers, summons, thralls and party members act on
   their own initiative; real players in your party play their own turn on their own phone (sharedfight.js; 90 s, then guard).
   No one-shots: a single blow can't take more than 40% of a strong target's health, except a finishing blow.
   The AI is reached through one adapter, TB.aiPick(fight, actor), which uses COMBATAI.decide(fight, actor, settings)
   when another module provides it, otherwise the fight's own choice (Smart AI or your custom tactics). */
const TB = (() => {
  // ------------------------------------------------------------------ numbers (tuned with tests/sim_tbfight.js)
  const ATK_SP = { dagger: 12, fist: 10, claw: 16, sword: 18, axe: 20, mace: 20, spear: 18, staff: 16, greatsword: 26, battleaxe: 28, warhammer: 28, bow: 36, crossbow: 42 };   // stamina a plain blow takes (a full four-blow turn leaves you winded; about two a round keeps going)
  const SWINGS = { dagger: 3, fist: 3, claw: 2, sword: 2, axe: 2, mace: 2, spear: 2, staff: 2, greatsword: 1.5, battleaxe: 1.5, warhammer: 1.5, bow: 1.5, crossbow: 1.2 };   // a typical turn of plain blows (foe health is sized from it)
  const MAX_ACTS = 4, MAX_POTS = 2, REPEAT = 0.5, SHOUT_SP = 10, DARK_HP = 0.03;
  const HIT_CAP = 0.4;          // max share of a strong target's health one blow can take
  /* foe toughness and actions per round, by kind of foe (tuned with the sim in tests/test_tbfight.js) */
  const T = { hp: { normal: 2.0, tough: 2.6, boss: 3.0 }, acts: { normal: 2.4, tough: 2.5, boss: 2.5 },
    rounds: { normal: 8, tough: 12, boss: 16 },                          // how long a fight should roughly last
    est: { k: 0.7, pool: 1, mk: 0.85, mix: 0.25, sum: 0.8 },   // [post-combat2] share of the damage your stamina / magicka pays for in a round that foe health is sized for
    min: { normal: 1.2, tough: 1.5, boss: 1.8 }, max: { normal: 7, tough: 9, boss: 10 } };   // bounds on the health boost
  const FOE_HP = T.hp.normal;
  const PARTY_HP = 0.45;        // +45% foe health per extra real player in the fight (shared out over the extra foes below)
  const MAX_FOES = 6;           // [OURS] a party meets one foe per hero, one after another (like dungeon rooms), at most 6; bosses stay alone
  const MAX_ROUNDS = 40;
  const MP_REGEN = 3.2, SP_REGEN = 4.4;   // per round about 22% of your stamina and 10% of your magicka come back (moves cost them now)
  const TURN_SECONDS = 90;      // a real player's turn in a party fight (on their own full fight screen, sharedfight.js), then they just guard
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tr0 = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const d10 = () => 1 + Math.floor(Math.random() * 10);

  /* your initiative and how cheap your moves are (what the screen shows; the skill info texts quote these).
     Athletics and Battle Rhythm make weapon moves cheaper; Alteration and Quickened Casting make spells cheaper. */
  function stats(s, f) {
    const ath = G.skill(s, "Athletics"), acro = G.skill(s, "Acrobatics"), snk = G.skill(s, "Sneak"), alt = G.skill(s, "Alteration");
    const spCut = clamp(ath / 1000 + 0.1 * pfx(s, "tbap"), 0, 0.35), mpCut = clamp(alt / 1000 + 0.1 * pfx(s, "tbspap"), 0, 0.35);
    let heavy = 0, medium = 0;
    for (const a of Object.values(f?.armor || {})) { if (a.type === "heavy") heavy++; else if (a.type === "medium") medium++; }
    const init = Math.round(10 + acro / 8 + snk / 16 - (2 * heavy + 0.5 * medium) * (1 - Math.min(1, pfx(s, "tbheavy"))) + pfx(s, "tbinit"));
    return { acts: MAX_ACTS, pots: MAX_POTS, spCut, mpCut, init, heavy };
  }
  const spellOf = (a) => { const [k, arg] = a.split(":"); return k === "spell" || k === "dual" ? D.SPELLS[arg] : k === "scroll" ? D.SPELLS[D.ITEMS[arg]?.spell] : null; };
  const tierOf = (id, sp) => sp?.level || (typeof TOMES !== "undefined" && TOMES.level ? TOMES.level(id) : "Novice");
  /* what a move takes before repeats: { sp, mp, hp, eng } (stamina, magicka, health; eng = the part the engine itself
     takes when the move runs: power attacks, guards, bashes, spells). Potions, scrolls, powers and fleeing are free. */
  function base(f, a) {
    if (typeof BEASTPATH !== "undefined") { const c = BEASTPATH.cost(f, a); if (c) return c; }   // claws and a changed form's own moves (beastpaths.js)
    if (typeof STRAT !== "undefined" && STRAT.owns(a)) return STRAT.cost(f, a);   // Catch your breath (strategy.js)
    if (typeof MOUNTFIGHT !== "undefined" && MOUNTFIGHT.owns(a)) return MOUNTFIGHT.cost(f, a);   // getting on / off your horse (mountfight.js)
    const s = f.s, [k, arg] = a.split(":");
    if (a === "attack") return { sp: ATK_SP[f.wt] || 9 };
    if (a === "power_attack") return { sp: f.paCost || 0, eng: { sp: f.paCost || 0 } };
    if (a === "block") { const c = F.BLOCK_STAMINA * Math.max(0, 1 - (typeof PFX !== "undefined" ? Math.min(1, PFX.sum(s, "blockcost", f, {})) : 0)); return { sp: c, eng: { sp: c } }; }
    if (a === "bash") { const c = typeof SHIELDFX !== "undefined" ? SHIELDFX.cost(f) : 35; return { sp: c, eng: { sp: c } }; }
    if (k === "spell" || k === "dual") {
      const sp = D.SPELLS[arg]; if (!sp) return {};
      const c = G.spellCost(s, sp) * (k === "dual" ? (typeof MAGIC !== "undefined" && MAGIC.DUAL_COST) || 2 : 1);
      const dark = sp.kind === "absorb" || sp.kind === "reanimate";   // dark magic takes a little blood too
      return { mp: c, hp: dark ? DARK_HP * G.maxHealth(s) : 0, eng: { mp: c } };
    }
    if (k === "shout") return { sp: SHOUT_SP };
    return {};
  }
  /* what a move costs you right now: { sp, mp, hp, n } (n: times you already did it this turn, +50% each) */
  function cost(f, a, sess) {
    if (a === "end" || a === "flee") return { sp: 0, mp: 0, hp: 0, n: 0 };
    const b = base(f, a), n = (sess && sess.used && sess.used[a]) || 0, m = 1 + REPEAT * n, st = (sess && sess.st) || {};
    return { sp: Math.round((b.sp || 0) * m * (1 - (st.spCut || 0))), mp: Math.round((b.mp || 0) * m * (1 - (st.mpCut || 0))), hp: Math.round((b.hp || 0) * m), n, eng: b.eng || null };
  }
  /* "9 stamina", "24 magicka · 4 health", "free" */
  function costTxt(c) {
    const out = []; if (!c) return "free";
    if (c.sp > 0) out.push(`${c.sp} stamina`); if (c.mp > 0) out.push(`${c.mp} magicka`); if (c.hp > 0) out.push(`${c.hp} health`);
    return out.length ? out.join(" · ") : "free";
  }
  /* the coloured numbers on a move's button: green stamina, blue magicka, red health */
  const costHTML = (c) => (c && (c.sp > 0 || c.mp > 0 || c.hp > 0) ? [["sp", c.sp], ["mp", c.mp], ["hp", c.hp]].filter(([, v]) => v > 0).map(([k, v]) => `<em class="rc ${k}">${v}</em>`).join("") : `<em class="rc free">✓</em>`);
  const isSpell = (a) => /^(spell|dual|scroll):/.test(a);
  /* [OURS] shared party fights: the foe's state handed over to a player's phone for their turn and back (sharedfight.js) */
  const FOE_KEYS = ["foeSt", "eParalyzed", "tbStunLeft", "tbStunCd", "tbStunRound", "stagger", "calmTurns", "bleed", "kit", "kitDot", "kitLast", "stk", "dStance", "fearTurns", "disarmed", "soulTrap", "eMagic", "fpAvoided", "ehp0", "foeTgts", "fcap"];
  /* what a teammate's spell can leave on someone (spellbook.js): handed back with the turn */
  const BUFF_KEYS = ["ward", "reflect", "armorRed", "armorT", "imbue", "thorns", "heroT", "unseen", "dmg", "_baseDmg"];
  /* "You hit the bandit" from one phone reads "Beta hits the bandit" on the others */
  const IRREG = { are: "is", were: "was", have: "has", do: "does", go: "goes", can: "can", "can't": "can't", will: "will", "don't": "doesn't", may: "may", must: "must", could: "could" };
  const conj = (w) => IRREG[w.toLowerCase()] || (/ed$/.test(w) ? w : /(s|sh|ch|x|z|o)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s");
  function voice(t, name) {
    if (!name) return String(t ?? "");
    let subj = false;
    const out = String(t ?? "").replace(/\byourself\b/gi, "themselves").replace(/(^|[.!?·]\s*|, )[Yy]ou('re)?\s+([A-Za-z']+)/g, (m, pre, re, w) => { subj = true; return re ? `${pre}${name} is ${w}` : `${pre}${name} ${conj(w)}`; })
      .replace(new RegExp(`(\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [a-z']+ [a-z']+ and )([a-z']+)`, "g"), (m, a, w) => a + (/s$/.test(w) ? w : conj(w)));   // "Beta holds back and keeps..."
    // after the name has been said: "their guard", not "Beta's guard" again
    return out.replace(/\b[Yy]ou're\b/g, `${name} is`).replace(/\b[Yy]ou've\b/g, `${name} has`).replace(/\b[Yy]ou are\b/g, `${name} is`)   // "(Beta is poisoned)", not "(Beta're poisoned)"
      .replace(/\b[Yy]ours\b/g, subj ? "theirs" : `${name}'s`).replace(/\b[Yy]our\b/g, subj ? "their" : `${name}'s`).replace(/\b[Yy]ou\b/g, name);
  }

  /* ------------------------------------------------------------------ the AI adapter (one place, so better AIs can plug in) */
  function aiPick(f, actor = "me", settings) {
    if (typeof COMBATAI !== "undefined" && COMBATAI.decide) {
      try { const r = COMBATAI.decide(f, actor, settings || f.aiSettings || null); if (r) return Array.isArray(r) ? r[0] : r.action || r; } catch (e) { /* fall back */ }
    }
    try { const [, a] = f.choose(); return a || "attack"; } catch (e) { return "attack"; }
  }

  /* who to hit first (the "Target first" AI setting in aiset.js). Fights today have one foe (a gang or a pack is one foe),
     so this only picks among several when a fight brings extra foes in f.adds. */
  function targetOrder(f) {
    const foes = [f.e, ...(f.adds || [])].filter(Boolean);
    if (foes.length < 2 || typeof AISET === "undefined" || !AISET.pickTarget) return foes;
    try { return AISET.pickTarget(G.loadout(f.s), foes); } catch (e) { return foes; }
  }
  // ------------------------------------------------------------------ one fight, played round by round
  class Session {
    constructor(f, opts = {}) {
      this.f = f; this.s = f.s; this.opts = opts; this.round = 0; this.order = []; this.idx = 0;
      this.ev = [];             // what happened, for the screen: {who, text, line, kind}
      this.st = stats(f.s, f);
      this.used = {}; this.myActs = 0; this.pots = 0; this.cur = null; this.done = false; this.waiting = null;
      this.lines = { me: [], them: [], a: null };   // this round's log line for the fight log
      this.hitters = 0;
      this.everyone = f.allies.slice();   // who started the fight beside you (party view: knocked-down teammates stay listed)
      this.players = Math.min(7, f.allies.filter((a) => a.player && !a.follower && a.kind !== "follower").length);   // real players with you (a party is up to 8; followers never count)
      // foe archetypes and groups (foegroups.js): a bandit archer, a draugr mage... and on your own, sometimes 2 or 3 of them
      const grp = typeof FOEGROUPS !== "undefined" ? FOEGROUPS.prep(f, this.players) : { n: 1, hpMul: [1] };
      this.grp = grp;
      // turn-based foes are tougher (you act more than once a round); real players make it harder still
      const tg = f.tags; this.kind = f.e.boss ? "boss" : tg.has("elite") || f.e.danger === "high" ? "tough" : "normal";
      // the foe gets enough health for a fight of about T.rounds rounds against what you (and friends) deal a round,
      // within bounds, so fights don't end in two rounds at one level and drag on at another
      const dpr = this.estimate(f);
      const base = Math.max(1, f.ehp), kk = dpr > 0 ? clamp(dpr * T.rounds[this.kind] / base, T.min[this.kind], T.max[this.kind]) : T.hp[this.kind];
      // a party faces more foes, not one sponge: the same total toughness, split over one foe per hero
      this.waves = this.players > 0 && !f.e.boss && !f.e.pool ? Math.min(MAX_FOES, 1 + this.players) : grp.n; this.wave = 1;
      // another player fights with their real health; a raid dragon's health is shared by everyone fighting it (wevents.js)
      const k = f.e.player || f.e.pool ? 1 : this.players > 0 ? kk * (1 + PARTY_HP * this.players) / this.waves : kk;   // another player fights with their real health, no monster boost
      this.ehpBase = f.ehp * k;
      f.ehp = Math.round(this.ehpBase * (grp.hpMul[0] || 1)); f.ehp0 = f.ehp; this.ehpMax = f.ehp;
      f.e.tbHp = this.ehpMax;
      f.regenMp *= MP_REGEN; f.regenSp *= SP_REGEN;   // several actions a round need a bit more breath and magicka per round
      f.tb = true;
      const t = opts.t || G.now();
      f.dark = G.isNight(t) || !!(f.wx && f.wx.aim < 1);
      f.hidden = opts.hidden != null && !opts.enemyFirst ? opts.hidden : opts.trySneak !== false && !opts.enemyFirst && Math.random() < G.hiddenChance(f.s, f.e, t);
      this.foeLevel = f.e.level ?? f.s.level;
      this.trash = f.e.danger === "low" && !f.e.boss;   // skeevers and mudcrabs can still be one-shot
      this.maxRounds = f.e.pool && opts.maxTurns ? opts.maxTurns : MAX_ROUNDS;   // a raid dragon climbs out of reach after a while
      if (typeof DRAGONS !== "undefined") DRAGONS.setup(f, this);   // dragons start in the air (dragons.js)
      if (typeof FOEKIT !== "undefined") FOEKIT.setup(f);   // what the foe can do besides a plain blow (foekit.js)
      if (typeof BOSSFIGHT !== "undefined") BOSSFIGHT.setup(f, this);   // bosses: phases, big attacks you see coming (bossfight.js)
    }
    /* rough damage a round from you and your allies (a typical turn of weapon swings, or your best damage spell) */
    estimate(f) {
      const s = f.s, st = this.st, R = T.rounds[this.kind] || T.rounds.normal;
      let w = 0, m = 0;
      try {
        const ai = typeof COMBATAI !== "undefined" && COMBATAI.swing, sw = ai ? COMBATAI.swing(f, false) : f.weaponDamage();
        if (f.regenSp > 0 && G.maxStamina) {
          /* [post-combat2 balance] a turn holds up to 4 moves paid in stamina, so what you deal a round follows your
             stamina: what comes back each round plus your pool spread over the fight, a power attack first when you can
             afford it. (A flat "two swings a turn" guess let strong heroes end fights in 3-5 rounds.) */
          const cut = 1 - (st.spCut || 0), atk = Math.max(1, (ATK_SP[f.wt] || 9) * cut), pa = (f.paCost || 0) * cut;
          let B = f.regenSp * SP_REGEN + T.est.pool * G.maxStamina(s) / R, n = 0;
          if (ai && pa > 0 && B >= pa) { w = COMBATAI.swing(f, true); B -= pa; n = 1; }
          w = (w + sw * clamp(B / atk, n ? 0 : 1, MAX_ACTS - n)) * T.est.k;
        } else w = sw * (SWINGS[f.wt] || 2) * 0.8;
      } catch (e) { w = 0; }
      for (const id of s.spells || []) {
        const sp = D.SPELLS[id]; if (!sp || sp.kind !== "damage") continue;
        try { const d = G.spellDamage(s, sp), c = Math.max(1, G.spellCost(s, sp)), casts = clamp((f.regenMp * MP_REGEN + T.est.pool * f.mp / R) / c, 1, MAX_ACTS - 1); m = Math.max(m, d * casts * T.est.mk); } catch (e) { /* skip */ }   // casts a round your magicka pays for (like stamina above)
      }
      let sm = 0;   // a summon you can afford fights beside you
      for (const id of s.spells || []) { const sp = D.SPELLS[id]; if (!sp || sp.kind !== "summon" || !G.spellSummon) continue; try { if (G.spellCost(s, sp) <= f.mp) sm = Math.max(sm, G.spellSummon(s, sp, f).dmg || 0); } catch (e) { /* skip */ } }
      const al = f.allies.reduce((a, x) => a + (x.dmg || 0), 0);
      return Math.max(w, m) + T.est.mix * Math.min(w, m) + T.est.sum * sm + al;   // spellswords mix blades and spells
    }
    emit(who, text, kind, extra = {}) {
      const e = { who, text, kind, round: this.round, hp: Math.max(0, Math.round(this.f.hp)), ehp: Math.max(0, Math.round(this.f.ehp)), ...extra };
      if (this.remote && this.players && !this.mirror) { const ph = {}; for (const a of this.everyone) if (a.pid) ph[a.pid] = Math.max(0, Math.round(a.hp || 0)); e.ph = ph; }   // every player's health at this moment, for their own screens
      this.ev.push(e); return e;
    }
    get over() { const f = this.f; if (f.bf && typeof BOSSFIGHT !== "undefined") BOSSFIGHT.check(this); if (f.ehp <= 0 && f.hp > 0 && !f.endWon && this.wave < this.waves) this.nextFoe(); return f.hp <= 0 || f.ehp <= 0 || !!f.endWon || this.round > this.maxRounds; }
    /* a party fight: the foe fell, the next one steps in */
    nextFoe() {
      const f = this.f; this.wave++;
      const a = this.grp?.n > 1 && typeof FOEGROUPS !== "undefined" ? FOEGROUPS.next(f, this.wave - 1) : null;
      if (a) this.ehpMax = Math.round(this.ehpBase * (this.grp.hpMul[this.wave - 1] || 1));
      f.ehp = this.ehpMax; f.fpAvoided = false; f.tbStunLeft = 0; f.tbStunCd = 0;
      if (typeof FOEKIT !== "undefined") { const dt = f.kitDot; FOEKIT.setup(f); f.kitDot = dt; }   // the next one has its own kit
      if (typeof FIGHTREAD !== "undefined") FIGHTREAD.plan(this);
      if (typeof FOEINTENT !== "undefined") FOEINTENT.plan(this);   // and who each move goes for
      const left = this.waves - this.wave;
      const who = a ? `${String(f.e.name).toLowerCase()} ${a.label}` : String(f.e.name).toLowerCase();
      this.emit("foe", `${a ? "A" : "Another"} ${who} steps in! ${left ? `(${left} more behind it)` : "(the last one)"}`, "foe", { wave: this.wave });
      if (typeof SPELLFX !== "undefined") SPELLFX.nextFoe(this);   // area spells already reached it; single-target ones end here
    }
    /* initiative order for a new round */
    rollOrder() {
      const f = this.f, out = [{ id: "me", name: this.s.name || "You", init: this.st.init + d10() + (typeof STACKS !== "undefined" ? STACKS.myInit(f) : 0) }];
      f.allies.forEach((al, i) => { if (!al.down) out.push({ id: "al" + i, al, name: al.name, init: (al.init || (al.player ? 9 : al.follower ? 8 : 6)) + d10() }); });
      if (f.summonTurns > 0) out.push({ id: "sum", name: "Summon", init: 6 + d10() });
      const tg = f.tags, base = 6 + Math.min(12, this.foeLevel / 4) + (tg.has("beast") ? 3 : 0) + (tg.has("big") || tg.has("construct") ? -2 : 0);
      // the foe acts 1–3 times a round (whole actions, the fraction is a chance), more with a big party
      let n = T.acts[this.kind] + Math.floor(this.players / 2); const whole = Math.floor(n); n = whole + (Math.random() < n - whole ? 1 : 0);
      const nb = typeof ENCH2 !== "undefined" ? ENCH2.numb(f) : { init: 0, acts: 0 }; n -= nb.acts;   // Numbing Cold: later in the order, a move lost (enchants2.js)
      for (let i = 0; i < Math.max(1, n); i++) out.push({ id: i ? "foe" + (i + 1) : "foe", name: f.e.name, init: Math.round(base - nb.init) - 4 * i + d10() - (typeof STRAT !== "undefined" ? STRAT.foeInitCut(f) : 0), extra: i > 0 });   // frost slows it (strategy.js)
      out.sort((a, b) => b.init - a.init || (a.id === "me" ? -1 : 1));
      return out;
    }
    startRound() {
      const f = this.f;
      this.round++; f.turn = this.round; this.order = this.rollOrder(); this.idx = 0; this.hitters = 0;
      this.lines = { me: [], them: [], a: null };
      this.emit("round", `Round ${this.round}`, "round", { order: this.order.map((o) => ({ id: o.id, name: o.name, init: o.init })) });
      if (typeof FIGHTREAD !== "undefined") FIGHTREAD.plan(this);   // the foe's intents for this round (fightread.js)
      if (typeof FOEINTENT !== "undefined") FOEINTENT.plan(this);   // and who each one goes for (foeintent.js)
      if (this.f.bf && typeof BOSSFIGHT !== "undefined") BOSSFIGHT.plan(this);   // a boss shows its big attacks a turn ahead
    }
    /* the foe gets a free action first (you were spotted, or fled and got caught) */
    begin() {
      if (this.opts.enemyFirst) { this.round = 0; this.foeAct("Ambush! "); this.f.log.push({ turn: 0, rule: null, me: "", them: this.lines.them.join(" · "), hp: Math.max(0, Math.round(this.f.hp)), ehp: Math.max(0, Math.round(this.f.ehp)) }); }
      this.startRound();
      return this.advance();
    }
    /* run automatic turns until it's a person's turn (yours, or a real party member's) or the fight ends */
    advance() {
      while (!this.over) {
        if (this.idx >= this.order.length) { this.endRound(); if (this.over) break; this.startRound(); continue; }
        const o = this.order[this.idx];
        this.cur = o;
        if (o.id === "me") {
          if (!this.apSet) this.beginTurn();
          if (this.opts.auto || this.autoRest) { this.autoTurn(); continue; }
          return { turn: "me" };
        }
        if (o.al && o.al.player && o.al.pid && this.remote && !o.al.down && (o.al.late || 0) >= 2 && (!this.remote.live || this.remote.live())) { this.allyMove(o.al, "guard", true); this.idx++; continue; }   // missed two turns: they just guard (no auto fighting)
        if (o.al && o.al.player && o.al.pid && this.remote && !o.al.down && (!this.remote.live || this.remote.live())) {   // a real player: their own phone picks
          if (!this.waiting) { this.waiting = { pid: o.al.pid, name: o.al.name, until: Date.now() + TURN_SECONDS * 1000, al: o.al, tid: `${this.round}.${this.idx}` }; this.remote.ask(this, o.al); }
          if (this.waiting.reply) { const rp = this.waiting.reply; this.waiting = null; o.al.late = 0; this.applyRemote(o.al, rp); this.idx++; continue; }   // their whole turn, played on their own fight screen
          if (this.waiting.move) { const m = this.waiting.move; this.waiting = null; o.al.late = 0; this.allyMove(o.al, m); this.idx++; continue; }
          if (Date.now() < this.waiting.until) return { turn: "wait", who: o.al.name, until: this.waiting.until };
          this.waiting = null; o.al.late = (o.al.late || 0) + 1; this.allyMove(o.al, "guard", true); this.idx++; continue;
        }
        this.autoActor(o); this.idx++;
      }
      return this.finish();
    }
    /* ---- your actions */
    /* a new turn of yours: nothing used yet (apSet keeps its old name for the modules that check it) */
    beginTurn() {
      this.used = {}; this.myActs = Math.min(1, this.f.kitApLoss || 0); this.pots = 0; this.apSet = true; this.f.kitApLoss = 0;   // kitApLoss: thrown from the saddle (mountfight.js) = one move fewer this turn
      const w = typeof STACKS !== "undefined" ? STACKS.beginTurn(this.f) : "";   // Winded / Drained stacks bite (stacks.js)
      if (w) this.emit("tick", w.replace(/^ · /, ""), "tick");
    }
    /* why you can't do a move now ("" = you can) */
    why(a) {
      const f = this.f;
      if (a === "end" || a === "flee") return "";
      if (this.myActs >= this.st.acts) return `${this.st.acts} moves a turn`;
      if (/^potion:/.test(a) && this.pots >= this.st.pots) return `${this.st.pots} potions a turn`;
      if (a === "power_attack" && (this.used.power_attack || 0) >= 1) return "Once a turn";   // a power attack puts everything into one blow
      const c = cost(f, a, this);
      if (c.sp > f.sp + 0.01 && !(a === "attack" && this.myActs === 0)) return `Need ${Math.ceil(c.sp - f.sp)} more stamina`;   // out of breath you can still swing once a turn (as in Skyrim)
      if (c.mp > f.mp + 0.01) return `Need ${Math.ceil(c.mp - f.mp)} more magicka`;
      if (c.hp > 0 && c.hp >= f.hp) return "Too hurt";
      return "";
    }
    canAfford(a) {
      if (a === "end" || a === "flee") return true;
      if (this.why(a)) return false;
      if (a === "bash") return typeof SHIELDFX !== "undefined" && SHIELDFX.can(this.f);
      if (typeof STRAT !== "undefined" && STRAT.owns(a)) return STRAT.can(this.f, a);
      return this.f.affordable(a) || a === "attack";
    }
    /* after a move ran: take what the engine didn't (a plain blow, a shout, the repeat surcharge, blood for dark magic)
       and give back what your cheaper-move perks save */
    pay(a, c) {
      const f = this.f, e = c.eng || {};
      f.sp = clamp(f.sp - (c.sp - (e.sp || 0)), 0, G.maxStamina(f.s));
      f.mp = clamp(f.mp - (c.mp - (e.mp || 0)), 0, G.maxMagicka(f.s));
      if (c.hp > 0) f.hp = Math.max(1, f.hp - c.hp);
      this.used[a] = (this.used[a] || 0) + 1; this.myActs++;
      if (/^potion:/.test(a)) this.pots++;
    }
    act(a, tgt, mult, grade) {   // mult: how the minigame went (minigame.js), 1 = normal; grade.cls "perfect" adds a stack
      if (this.cur?.id !== "me" || this.over) return null;
      const f = this.f;
      const al = tgt != null && tgt !== "" ? (+tgt >= 1000 ? (f._downed || [])[+tgt - 1000] : f.allies[+tgt]) : null;
      if (a === "end") return this.endTurn();
      if (a === "flee") return this.flee();
      if (!this.canAfford(a)) return { err: this.why(a) || "You can't do that now" };
      const price = cost(f, a, this);
      const before = f.ehp, myBefore = f.hp;
      let text = null;
      const setup = typeof STRAT !== "undefined" ? STRAT.setup(f) : "";   // staggered, stunned, chilled: an opening (strategy.js)
      if (typeof STRAT !== "undefined" && STRAT.owns(a)) text = STRAT.act(f, a);
      if (text == null && al && zoneOf(a) === "self") text = onAlly(f, a, al);
      if (text == null) { f.tbTarget = al || null; try { text = a === "bash" ? SHIELDFX.bash(f) : f.act(a); } finally { f.tbTarget = null; } }
      if (f.hidden) f.hidden = false;   // only your first strike can be a sneak attack
      if (mult && mult !== 1 && f.ehp < before) { f.ehp = before - (before - f.ehp) * mult; text += mult > 1 ? " (perfect timing!)" : " (mistimed)"; }
      else if (mult && mult !== 1 && f.hp > myBefore) { f.hp = Math.min(G.maxHealth(f.s), myBefore + (f.hp - myBefore) * mult); text += mult > 1 ? " (perfect!)" : " (shaky)"; }
      if (grade && grade.cls === "perfect" && typeof MINIGAME !== "undefined") text += MINIGAME.perfect(f, a, before);   // a Perfect adds a stack
      if (typeof DRAGONS !== "undefined") text += DRAGONS.graze(f, a, before);
      if (typeof FOEKIT !== "undefined") text += FOEKIT.defend(f, a, before);   // its raised shield, ward or dodge
      if (f.bf && typeof BOSSFIGHT !== "undefined") text += BOSSFIGHT.answer(this, a, before);   // its helpers, and breaking a big attack
      if (typeof COMBO !== "undefined" && f.ehp < before) text += COMBO.after(f, a, before);   // followers2: combos
      if (typeof STRAT !== "undefined" && f.ehp < before) text += STRAT.after(f, a, before, setup);
      if (typeof STACKS !== "undefined" && f.ehp < before) text += STACKS.after(f, a, before);   // Vulnerable, Sunder, Might
      text += this.capFoe(before);
      if (f.ehp < before) { text += this.flank(before); this.hitters++; }
      if (typeof DRAGONS !== "undefined") DRAGONS.check(f, this);
      this.pay(a, price);
      if (typeof STACKS !== "undefined") STACKS.sync(f);
      this.lines.me.push(text); this.lines.a = a;
      this.emit("me", text, "me", { a, wt: f.wt, dmg: Math.max(0, Math.round(before - f.ehp)), healed: Math.max(0, Math.round(f.hp - myBefore)) });
      if (this.over) { this.apSet = false; this.idx++; return { turn: "next" }; }
      if (typeof STRAT !== "undefined" && STRAT.ends && STRAT.ends(a)) return this.endTurn(true);   // Breathe is your whole turn
      if (this.myActs >= this.st.acts || !this.anyAffordable()) return this.endTurn(true);
      return { turn: "me" };
    }
    anyAffordable() { return ["attack", "block", "potion:health"].some((a) => this.canAfford(a)) || (this.f.s.spells || []).some((id) => this.canAfford("spell:" + id)); }
    /* moves you didn't make become guard against the next blows: 30% after none, 20% after one, 10% after two */
    guardLeft() { return clamp(0.1 * (3 - this.myActs), 0, 0.3); }
    endTurn(auto) {
      this.f.tbGuard = this.guardLeft();
      if (this.f.tbGuard > 0 && !auto) this.emit("me", `You hold back and keep your guard up (−${Math.round(this.f.tbGuard * 100)}% damage)`, "guard");
      this.apSet = false; this.idx++;
      return { turn: "next" };
    }
    flee() {
      const f = this.f, s = f.s;
      const ch = clamp(0.4 + G.skill(s, "Athletics") / 300 + G.skill(s, "Acrobatics") / 400 - (f.e.boss ? 0.3 : f.e.danger === "high" ? 0.15 : 0) - 0.05 * this.st.heavy + (f.e.pool ? 0.45 : 0), 0.05, 0.9);   // a raid: the town has plenty of places to hide
      if (Math.random() < ch) { f.endWon = true; f.escaped = true; f.ranAway = true; this.lines.me.push("You break away and escape"); this.emit("me", "You break away and escape!", "flee"); this.apSet = false; this.idx++; return { turn: "next" }; }
      this.myActs = this.st.acts; this.lines.me.push("You try to break away, but can't"); this.emit("me", `You try to break away, but the ${f.e.name} cuts you off (${Math.round(ch * 100)}%)`, "flee");
      return this.endTurn(true);
    }
    /* Auto: the AI plays your turn */
    autoTurn() {
      const f = this.f;
      if (this.cur?.id !== "me" || this.over) return { turn: "next" };
      if (!this.apSet) this.beginTurn();
      const idx0 = this.idx;
      let guard = 0;
      while (!this.over && this.idx === idx0 && guard++ < MAX_ACTS + 2) {
        let a = aiPick(f, "me");
        if (!this.canAfford(a)) a = this.canAfford("attack") ? "attack" : null;
        if (typeof STRAT !== "undefined") a = STRAT.ai(this, a);   // cash in openings, catch your breath
        if (f.bf && typeof BOSSFIGHT !== "undefined") a = BOSSFIGHT.ai(this, a);   // answer a big attack that's coming
        if (!a) break;
        if (a === "block" && this.myActs > 0) break;   // keep the guard from moves you don't make instead of a second raise
        if (this.used[a] >= 2 && this.myActs >= 2) break;   // a third of the same move costs double: save the breath, keep some guard
        const r = this.act(a);
        if (!r || r.turn !== "me" || r.err) break;
      }
      if (this.idx === idx0 && !this.over) this.endTurn(true);
      return { turn: "next" };
    }
    /* ---- everyone else */
    autoActor(o) {
      const f = this.f;
      if (o.id.startsWith("foe")) return this.foeAct("");
      if (o.id === "sum") {
        if (f.summonTurns > 0 && f.ehp > 0) { const b = f.ehp; f.summonTurns--; f.ehp -= f.summonDmg; const t = `Your ${f.summonName || "summon"} strikes ${Math.round(f.summonDmg)}` + this.capFoe(b) + this.flank(b); this.hitters++; this.lines.me.push(t); this.emit("sum", t, "ally"); }
        return;
      }
      if (o.al) return o.al.player && o.al.pid && !this.opts.auto ? this.allyMove(o.al, "guard", true) : this.allyMove(o.al, "auto");   // a real player is never played by the AI: no word from their phone, they just guard (noautoplay.js)
    }
    allyMove(al, move, timedOut) {
      const f = this.f;
      if (al.down || f.ehp <= 0) return;
      if (al.fai && typeof FAI !== "undefined" && !(al.player && move && move !== "auto")) return FAI.turn(this, f, al);   // followers2: their own turn
      const b = f.ehp, hpB = f.hp;
      let t;
      if (al.player && move && move !== "auto") t = this.playerMove(al, move);
      else if (al.coop && typeof COOP !== "undefined") t = COOP.allyAct(f, al);
      else if (al.follower && f.ai && typeof COMBATAI !== "undefined") t = COMBATAI.followerAct(f, al);
      else { const d = al.dmg * (0.85 + Math.random() * 0.3); f.ehp -= d; t = ` · ${al.name} ${Math.round(d)}`; if (al.fsum && typeof COMBO !== "undefined") t += COMBO.phys(f, b, "al" + f.allies.indexOf(al)); }   // followers2: summons can shatter too
      t = String(t || "").replace(/^ · /, "");
      if (f.ehp < b) { t += this.capFoe(b) + this.flank(b); this.hitters++; }
      if (timedOut) t = `${al.name} took too long and keeps their guard up. ` + t;
      if (al.left != null && --al.left <= 0) { f.allies = f.allies.filter((x) => x !== al); t += ` · ${al.name} fades away`; }   // a teammate's summon runs out
      this.lines.me.push(t);
      this.emit(al.player ? "mate" : "ally", t, "ally", { name: al.name, healed: Math.max(0, Math.round(f.hp - hpB)) });
    }
    /* a real player's chosen move (their phone sent it) */
    playerMove(al, m) {
      const f = this.f;
      if (m === "power") { const d = al.dmg * 1.6 * (0.85 + Math.random() * 0.3); f.ehp -= d; al.tired = 1; return `${al.name} power attack ${Math.round(d)}`; }
      if (m === "guard") { al.guard = 1; return `${al.name} raises their guard`; }
      if (m === "heal" && al.heals > 0) { al.heals--; const mh = G.maxHealth(f.s), b = f.hp; f.hp = Math.min(mh, f.hp + (al.healAmt || 40)); return `${al.name} heals you +${Math.round(f.hp - b)}`; }
      if (m === "potion" && al.pots > 0 && typeof POTFX !== "undefined") { al.pots--; return `${al.name} drinks a potion: ${POTFX.ally(al, "health", al.potAmt || 50, "Potion of Healing")}`; }
      if (m === "potion" && al.pots > 0) { al.pots--; al.hp = Math.min(al.maxHp || al.hp, al.hp + (al.potAmt || 50)); return `${al.name} drinks a potion`; }
      const d = al.dmg * (al.tired ? 0.8 : 1) * (0.85 + Math.random() * 0.3); al.tired = 0; f.ehp -= d; return `${al.name} attacks ${Math.round(d)}`;
    }
    /* a teammate played their turn on their own phone (sharedfight.js): take over what it did to the foe, to them and to
       the rest of us. r = {wave, e0, ehp, fs, hp0, hp, hpMax, guard, self, allies, summon, hits, fled, ev:[{text,a,dmg}]} */
    applyRemote(al, r) {
      const f = this.f;
      if (!r || !al || al.down) return;
      const name = al.name, b = f.ehp, sameFoe = r.wave == null || r.wave === this.wave;
      if (sameFoe && r.fs) for (const k of FOE_KEYS) if (k in r.fs && k !== "ehp0") f[k] = r.fs[k] && typeof r.fs[k] === "object" ? clone(r.fs[k]) : r.fs[k];
      if (sameFoe && typeof r.e0 === "number" && typeof r.ehp === "number") f.ehp = b - clamp(r.e0 - r.ehp, 0, Math.max(0, b));
      if (typeof r.hp === "number" && typeof r.hp0 === "number") { if (r.hpMax > 0) al.maxHp = r.hpMax; al.hp = clamp((al.hp || 0) + (r.hp - r.hp0), 1, al.maxHp || Math.max(al.hp || 1, r.hp)); }
      al.tbGuard = clamp(+r.guard || 0, 0, 0.3);
      if (typeof MOUNTFIGHT !== "undefined") MOUNTFIGHT.fromMate(al, r.mt);   // they got on / off their horse on their phone
      if (r.self) {
        if (r.self.ward > 0) al.ward = Math.max(al.ward || 0, r.self.ward);
        if (r.self.armorRed > (al.armorRed || 0)) { al.armorRed = Math.min(0.7, r.self.armorRed); al.armorT = Math.max(al.armorT || 0, r.self.armorT || 6); }
      }
      for (const x of r.allies || []) this.remoteBuff(x);
      if (r.summon && r.summon.turns > 0 && r.summon.dmg > 0) {   // their summon fights on its own, beside the rest of us
        let sm = f.allies.find((a) => a.summonOf === al.pid);
        if (!sm) { sm = { name: `${name}'s ${r.summon.name || "summon"}`, summon: true, summonOf: al.pid, init: 6 }; f.allies.push(sm); }
        sm.dmg = r.summon.dmg; sm.left = Math.min(12, r.summon.turns);
      }
      this.hitters += Math.max(0, r.hits | 0);
      for (const e of (r.ev || []).slice(0, 12)) {
        const t = voice(e.text, name);
        this.lines.me.push(t);
        this.emit("mate", t, "ally", { name, a: e.a, wt: r.wt, by: al.pid, dmg: Math.max(0, Math.round(e.dmg || 0)) });
      }
      if (r.fled) {   // they broke away: out of this fight (their summon goes with them)
        al.gone = true; f.allies = f.allies.filter((x) => x !== al && x.summonOf !== al.pid);
        if (!(r.ev || []).length) this.emit("mate", `${name} breaks away and leaves the fight`, "ally", { name, by: al.pid });
      }
      if (typeof DRAGONS !== "undefined") DRAGONS.check(f, this);
    }
    /* a spell a teammate cast on someone else in the fight (heal, ward, stoneskin, rescue...) */
    remoteBuff(x) {
      const f = this.f;
      if (!x || !x.k) return;
      const up = typeof x.hp === "number" && typeof x.hp0 === "number" ? x.hp - x.hp0 : 0;
      if (x.k === "host") {
        if (up > 0) { const b = f.hp; f.hp = Math.min(G.maxHealth(f.s), f.hp + up); if (f.hp > b) this.emit("mate", `It mends you: +${Math.round(f.hp - b)} health`, "ally", { healed: Math.round(f.hp - b), by: "heal" }); }
        if (x.ward > 0 && x.ward > (f.ward || 0)) { f.ward = x.ward; f.wardMax = Math.max(f.wardMax || 0, x.ward); }
        return;
      }
      const all = [...new Set([...this.everyone, ...f.allies, ...(f._downed || [])])], al = all.find((a) => a.tbk === x.k);
      if (!al || al.gone) return;
      for (const k of BUFF_KEYS) if (k in x) al[k] = x[k] && typeof x[k] === "object" ? clone(x[k]) : x[k];
      const isDown = al.down || !f.allies.includes(al);
      if (isDown && x.revive) {   // pulled back from the brink
        al.down = false; al.hp = Math.max(1, x.hp || 1); f._downed = (f._downed || []).filter((a) => a !== al); if (!f.allies.includes(al)) f.allies.push(al);
        if (f.followerDown === al.name) f.followerDown = null;
      } else if (!isDown && up) al.hp = Math.max(1, (al.hp || 0) + up);
    }
    foeAct(prefix) {
      const f = this.f;
      if (f.ehp <= 0 || f.endWon) return;
      if (typeof SHIELDFX !== "undefined" && SHIELDFX.stunned(f, this.round)) {   // shield bash: the foe loses its whole turn
        if (this.stunSaid !== this.round) { this.stunSaid = this.round; const t = `${prefix}${f.e.name} is stunned and can't act`; this.lines.them.push(t); this.emit("foe", t, "foe", { dmg: 0 }); }
        return;
      }
      const hpB = f.hp;
      // foes go after your healers and casters when they can (party fights)
      const FI = typeof FOEINTENT !== "undefined" ? FOEINTENT : null;
      if (FI) FI.next(this);   // foeintent.js: the target its intent showed (healers first is part of that roll)
      else if (f.allies.length && !f.coverAl) { const h = f.allies.find((a) => !a.down && a.player && (a.role === "healer" || a.heals > 0)); if (h && Math.random() < 0.5) f.coverAl = h; }
      let act = null;   // the move it shows, by name (" Venom Spit → Meeko"): the log, the banner and the scene say it as it happens
      try { if (typeof FIGHTREAD !== "undefined" && !this.mirror) act = FIGHTREAD.actName(FIGHTREAD.intents(this)[0], this); } catch (x) { act = null; }
      const guards = f.allies.filter((a) => a.guard || a.tbGuard); guards.forEach((a) => { a._red = a.red; a.red = Math.min(0.85, (a.red || 0) + (a.guard ? 0.4 : 0) + (a.tbGuard || 0)); });   // tbGuard: guard a teammate kept on their own phone
      const pa = this.everyone.filter((a) => a.pid), pb = pa.map((a) => a.hp || 0);
      if (typeof DRAGONS !== "undefined") DRAGONS.check(f, this);   // allies and bleeding may have brought it down
      const go = () => (typeof DRAGONS !== "undefined" && f.dStance ? DRAGONS.turn(f, () => f.enemyTurn()) : typeof FOEKIT !== "undefined" && f.kit ? FOEKIT.turn(f, () => f.enemyTurn()) : f.enemyTurn());
      let t = f.bf && typeof BOSSFIGHT !== "undefined" ? BOSSFIGHT.turn(this, go) : go();   // bosses: phases and big attacks (bossfight.js)
      guards.forEach((a) => { a.red = a._red; a.guard = 0; a.tbGuard = 0; });
      if (FI) { FI.done(this); t = FI.say(this, t); }   // "takes aim at Lydia"
      if (typeof STACKS !== "undefined") {   // Chill and Weak stacks soften its blows (stacks.js)
        const so = STACKS.foeSoften(f), l0 = hpB - f.hp;
        if (so > 0 && l0 > 0) { f.hp += l0 * so; t += ` (−${Math.round(l0 * so)} chilled/weak)`; }
        STACKS.sync(f);
      }
      const loss = hpB - f.hp;
      if (loss > 0 && f.tbGuard) { const back = loss * f.tbGuard; f.hp += back; t += ` (guard −${Math.round(back)})`; }
      const mh = G.maxHealth(f.s), cap = HIT_CAP * mh, loss2 = hpB - f.hp;
      if (loss2 > cap && hpB > cap) { f.hp = hpB - cap; t += " (you stay on your feet)"; }
      f.tbGuard = 0;
      // the plan said a blow but the foe healed or drank instead (its own call in the engine): name what it really did
      if (act && /casts a healing spell|heals itself/i.test(t) && !/heal/i.test(act.name)) act = { ic: "", name: tr0("Heal self"), tgt: "", stk: "", big: false };
      else if (act && /drinks a potion|drinks a/i.test(t) && !/potion/i.test(act.name)) act = { ic: "", name: tr0("Drink potion"), tgt: "", stk: "", big: false };
      const named = act ?`${act.ic} ${act.name}${act.tgt ? ` → ${act.tgt}` : ""}: ` : "";
      this.lines.them.push(prefix + named + t);
      const hits = {}; pa.forEach((a, i) => { const d = Math.round(pb[i] - (a.hp || 0)); if (d > 0) hits[a.pid] = d; });
      this.emit("foe", prefix + named + t, "foe", { dmg: Math.max(0, Math.round(hpB - f.hp)), ...(pa.length ? { hits } : {}), ...(act ? { act } : {}) });
    }
    /* no one-shots on strong foes: one blow takes at most 40% of their health, unless it finishes them */
    capFoe(before) {
      const f = this.f, cap = HIT_CAP * this.ehpMax;
      if (this.trash || before <= cap || before - f.ehp <= cap || f.ehp <= 0 && before <= cap * 1.2) return "";
      f.ehp = before - cap;
      return " (it reels but stays up)";
    }
    /* flanking: every hit after the first one in a round lands 10% harder */
    flank(before) {
      const f = this.f;
      if (this.hitters < 1 || f.ehp <= 0) return "";
      const extra = (before - f.ehp) * 0.1; f.ehp -= extra;
      return " +flank";
    }
    endRound() {
      if (typeof SHIELDFX !== "undefined") SHIELDFX.endRound(this.f, this.round);
      const f = this.f, line = { turn: this.round, rule: null, me: this.lines.me.join(" · "), them: this.lines.them.join(" · "), a: this.lines.a || "attack", wt: f.wt, tb: true };
      if (f.ai) line.ai = true;
      if (f.bleed.length && f.ehp > 0) { const b = f.bleed.reduce((x, y) => x + y.dmg, 0); f.ehp -= b; f.bleed = f.bleed.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); line.me += ` · bleeds ${Math.round(b)}`; }
      const n0 = line.me.length, t0 = line.them.length;
      if (typeof PFX !== "undefined") PFX.tick(f, line);
      if (f.dd && typeof DEEPDELVE !== "undefined") DEEPDELVE.tick(f, line);   // deepdelve.js
      if (typeof MAGIC !== "undefined" && !f.endWon) MAGIC.tick(f, line);
      if (f.pw && typeof POWERS !== "undefined") POWERS.tick(f, line);
      if (typeof STACKS !== "undefined") STACKS.tick(f, line);   // every stack drops by 1
      const extra = (line.me.slice(n0) + line.them.slice(t0)).replace(/^ · /, "");
      if (extra) this.emit("tick", extra, "tick");
      line.hp = Math.max(0, Math.round(f.hp)); line.ehp = Math.max(0, Math.round(f.ehp));
      f.log.push(line);
      f.sp = Math.min(G.maxStamina(f.s), f.sp + f.regenSp * (f.regenSpHold ? 0.5 : 1)); f.regenSpHold = false;
      f.mp = Math.min(G.maxMagicka(f.s), f.mp + f.regenMp);
      f.slowed = Math.max(0, f.slowed - 1);
      if (f.mount && typeof HORSEBACK !== "undefined") HORSEBACK.tick(f);
    }
    finish() {
      const f = this.f;
      if (this.done) return { turn: "done", won: f.won };
      if (this.lines.me.length || this.lines.them.length) { const line = { turn: this.round, rule: null, me: this.lines.me.join(" · "), them: this.lines.them.join(" · "), a: this.lines.a || "attack", wt: f.wt, tb: true, hp: Math.max(0, Math.round(f.hp)), ehp: Math.max(0, Math.round(f.ehp)) }; if (!f.log.length || f.log[f.log.length - 1].turn !== this.round) f.log.push(line); }
      if (this.round > this.maxRounds && f.hp > 0 && f.ehp > 0) { f.endWon = true; f.escaped = true; this.emit("foe", f.e.pool ? `The ${f.e.name} climbs out of reach and circles the town` : `The ${f.e.name} breaks off and withdraws`, "foe"); }
      this.done = true;
      f.won = f.ehp <= 0 || !!f.endWon;
      if (f.endWon) { f.e.fled = true; f.e.gold = [0, 0]; }
      f.e.hp = Math.max(0, Math.round(f.ehp / ((this.ehpMax / (f.e.health || this.ehpMax)) || 1)));
      f.tbRounds = this.round; f.tbPlayed = true;
      this.emit("end", f.won ? (f.escaped ? "You got away." : "Victory!") : "Defeated…", "end");
      return { turn: "done", won: f.won };
    }
  }

  /* play a whole fight with the AI on every side (sims, tests, "Auto" from the start) */
  function simulate(f, opts = {}) {
    const ss = new Session(f, { ...opts, auto: true });
    ss.begin();
    let guard = 0;
    while (!ss.done && guard++ < 500) ss.advance();
    return ss;
  }

  // ------------------------------------------------------------------ pausing a game action at its fight, and resuming it
  const PENDING = { tbPending: true };
  let mode = null, pend = null, fin = null, finalS = null, rec = [], rp = 0;
  const realRandom = Math.random;
  const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  function replaceInPlace(target, src) { for (const k of Object.keys(target)) delete target[k]; Object.assign(target, clone(src)); }
  /* like replaceInPlace, but keeps the same inner objects (the trip, the encounter...) so code that already holds them
     (e.g. `const tr = s.trip` before the fight) updates the real save. Without this a won road fight left the road blocked. */
  const plain = (o) => o && typeof o === "object" && !Array.isArray(o) && Object.prototype.toString.call(o) === "[object Object]";
  function syncInPlace(target, src) {
    for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
    for (const k of Object.keys(src)) {
      const a = target[k], b = src[k];
      if (plain(a) && plain(b)) syncInPlace(a, b);
      else if (Array.isArray(a) && Array.isArray(b)) { a.length = 0; for (const x of b) a.push(clone(x)); }
      else target[k] = b && typeof b === "object" ? clone(b) : b;
    }
  }
  const origRun = G.Fight.prototype.run;
  G.Fight.prototype.run = function (opts = {}) {
    if (mode === "capture") { mode = "captured"; pend = { f: this, opts }; throw PENDING; }
    if (mode === "replay" && fin) {
      const done = fin, eLocal = this.e; fin = null; mode = null;
      for (const k of Object.keys(done)) if (k !== "s" && k !== "e") this[k] = done[k];
      Object.assign(eLocal, { hp: done.e.hp, fled: done.e.fled, gold: done.e.gold });
      this.e = eLocal;
      syncInPlace(this.s, finalS); finalS = null;
      this.tbPlayed = true;
      return this.won;
    }
    return origRun.call(this, opts);
  };
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  /* turn-based is on unless switched off in Settings; under browser automation only with ?tb (keeps the old UI tests as they were) */
  function enabled() {
    if (typeof navigator !== "undefined" && navigator.webdriver && !(typeof location !== "undefined" && /[?&]tb\b/.test(location.search))) return false;
    return typeof document !== "undefined";
  }
  /* Run a game action. If it starts a fight, play the fight on screen, then finish the action with that result.
     done(result) gets the same object the action would have returned. */
  let saveSnap = null, liveS = null;
  /* store.js: while a fight is on screen, a save keeps the game as it was just before it (closing the app mid-fight
     puts you back in front of the fight instead of half-way through the action that started it) */
  function safeSave(st) { return open && saveSnap && st === liveS ? saveSnap : st; }
  function call(S, fn, done, ctx = {}) {
    if (!enabled() || open || mode) return done(fn());
    const snap0 = clone(S);
    rec = []; mode = "capture";
    Math.random = () => { const v = realRandom(); rec.push(v); return v; };
    let r;
    try { r = fn(); }
    catch (x) {
      Math.random = realRandom;
      if (x !== PENDING) { mode = null; throw x; }
      const { f, opts } = pend; pend = null; mode = null;
      const sess = new Session(f, opts);
      saveSnap = snap0; liveS = S;
      return play(sess, ctx, () => {
        saveSnap = null; liveS = null;
        finalS = clone(S);
        replaceInPlace(S, snap0);
        fin = f; mode = "replay"; rp = 0;
        const recd = rec;
        Math.random = () => (rp < recd.length ? recd[rp++] : realRandom());
        let out;
        try { out = fn(); } finally { Math.random = realRandom; mode = null; fin = null; }
        done(out);
      });
    }
    Math.random = realRandom; mode = null;
    return done(r);
  }

  // ------------------------------------------------------------------ the fight screen
  let open = false, ui = null, hooks = {};
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fast = () => false;   // build 146: the Fast button is gone; an old saved tbFast is ignored
  function init(h) { hooks = h || {}; }
  function play(sess, ctx, onDone) {
    open = true;
    ui = { sess, ctx, onDone, shown: 0, menu: null, busy: false, queue: [] };
    if (hooks.remote && !sess.mirror) sess.remote = hooks.remote;   // a teammate's view of the leader's fight never publishes a fight of its own
    let el = document.getElementById("tbf");
    if (!el) { el = document.createElement("div"); el.id = "tbf"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Turn-based fight"); document.body.appendChild(el); }
    el.className = "tbf ink";
    el.addEventListener("click", onClick);
    const r = sess.begin();
    render(r);
    if (sess.done && !ui.paceT) render({ turn: "done" });
    tickWait();
  }
  function pctBar(v, m, cls) { return `<div class="tbbar ${cls}"><i style="width:${Math.max(0, Math.min(100, 100 * v / Math.max(1, m))).toFixed(1)}%"></i></div>`; }
  function icon(o, f) { return o.id === "me" ? "" : o.id.startsWith("foe") ? (f?.e?.player ? "" : "") : o.id === "sum" ? "✦" : "⚑"; }
  /* where an action is dragged: onto the foe, or onto yourself (tbui.js does the dragging; a tap still works) */
  const SELF_KINDS = new Set(["heal", "armor", "ward", "summon", "cloak", "support", "invis", "bound", "light", "circle", "rune", "utility"]);
  function zoneOf(a) {
    if (typeof BEASTPATH !== "undefined" && BEASTPATH.zone(a)) return BEASTPATH.zone(a);
    if (a === "attack" || a === "power_attack" || a === "bash" || /^(shout|power):/.test(a)) return "foe";
    if (a === "block" || /^potion:/.test(a)) return "self";
    const sp = spellOf(a);
    if (sp) return typeof SPELLBOOK !== "undefined" && SPELLBOOK.SUPPORT.has(sp.kind) ? "ally" : SELF_KINDS.has(sp.kind) ? "self" : "foe";
    return "";
  }
  /* a healing spell, potion or scroll you dragged onto a teammate instead of yourself */
  function onAlly(f, a, al) {
    const [k, arg] = a.split(":");
    const mx = al.maxHp || al.hpMax || al._max || Math.max(al.hp, 60), b = al.hp;
    if (k === "potion") {
      const r = f.findPotion(arg); if (!r) return null;
      const it = D.ITEMS[r.item]; f.used[r.id] = (f.used[r.id] || 0) + 1;
      if (arg !== "health") { f.used[r.id]--; return null; }   // only health potions can be given
      if (typeof POTFX !== "undefined") return `You give ${al.name} a ${it.name}: ${POTFX.ally(al, "health", it.restore[1], it.name)}`;   // over a few rounds (potionfx.js)
      al.hp = Math.min(mx, al.hp + it.restore[1]); return `You give ${al.name} a ${it.name}: +${Math.round(al.hp - b)}`;
    }
    const sp = spellOf(a); if (!sp || sp.kind !== "heal") return null;
    const dual = k === "dual", free = k === "scroll";
    if (free) { const r = f.findItem(arg); if (!r) return null; f.used[r.id] = (f.used[r.id] || 0) + 1; }
    else f.mp -= (typeof G.spellCost === "function" ? G.spellCost(f.s, sp) : sp.cost) * (dual ? 2.2 : 1);
    const amt = sp.amount * (1 + (G.fxSum ? G.fxSum(f.s, "spell:Restoration") : 0) / 100) * (dual ? 2.2 : 1) * (1 + (typeof PFX !== "undefined" ? PFX.sum(f.s, "healally", f, {}) : 0));
    if (typeof f.addXp === "function") f.addXp("Restoration", sp.xp || 10);
    al.hp = Math.min(mx, al.hp + amt); return `${sp.name} on ${al.name}: +${Math.round(al.hp - b)}`;
  }
  const ICON = { recover: "", bash: "", attack: "", bow: "", power_attack: "", block: "", magic: "✦", items: "", flee: "", end: "", shout: "", power: "", potion: "", scroll: "", heal: "✚" };
  function iconOf(f, a) {
    if (typeof BEASTPATH !== "undefined") { const ic = BEASTPATH.icon(f, a); if (ic) return ic; }
    if (a === "mount" || a === "dismount") return "\uE12D";
    if (a === "attack") return f.wt === "bow" || f.wt === "crossbow" ? ICON.bow : ICON.attack;
    const k = a.split(":")[0];
    if (k === "spell" || k === "dual") { const sp = spellOf(a); return sp?.kind === "heal" ? ICON.heal : sp?.element === "fire" ? "" : sp?.element === "frost" ? "" : sp?.element === "shock" ? "" : ICON.magic; }
    return ICON[a] || ICON[k] || "•";
  }
  const guardTxt = (sess) => { const g = Math.round(sess.guardLeft() * 100); return g > 0 ? `+${g}% guard` : "ready"; };
  function actionsHTML(sess) {
    if (typeof FIGHTCTL !== "undefined" && FIGHTCTL.on()) return FIGHTCTL.dock(sess, { menu: ui.menu, cost, zoneOf, iconOf, tierOf });   // fightctl.js: the action bar
    const f = sess.f, s = f.s, B = (a, label, extra = "") => { const c = cost(f, a, sess), ok = sess.canAfford(a), z = zoneOf(a);
      const tip = typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, a, c))}"` : "";
      return `<button class="tbact ${extra}" data-tba="${esc(a)}"${z ? ` data-tz="${z}"` : ""}${tip} ${ok ? "" : "disabled"}><span class="ic" aria-hidden="true">${iconOf(f, a)}</span><b>${esc(label)}</b><small>${esc(costTxt(c))}</small><span class="cp" aria-hidden="true">${costHTML(c)}</span></button>`; };
    if (ui.menu === "magic") {
      const rows = (s.spells || []).filter((id) => D.SPELLS[id] && D.SPELLS[id].kind !== "utility").map((id) => {
        const sp = D.SPELLS[id], mc = typeof G.spellCost === "function" ? Math.round(G.spellCost(s, sp)) : sp.cost;
        const dual = typeof MAGIC !== "undefined" && MAGIC.dualable && MAGIC.dualable(sp);
        return `<div class="tbsp"><span class="nm el-${esc(sp.element || "none")}">${esc(sp.name)}<small>${esc(tierOf(id, sp))} · ${mc} magicka</small></span>${B("spell:" + id, "Cast")}${dual ? B("dual:" + id, "Dual") : ""}</div>`;
      }).join("") || `<p class="sub">You don't know any fighting spells yet.</p>`;
      return `<div class="tbmenu"><div class="tbmh"><b>✦ Magic</b><small>Drag a spell onto its target, or tap Cast</small></div>${rows}<button class="tbact back" data-tbm="">‹ Back</button></div>`;
    }
    if (ui.menu === "items") {
      const pots = ["health", "magicka", "stamina"].map((r) => (f.findPotion(r) ? B("potion:" + r, `${r[0].toUpperCase() + r.slice(1)} potion`) : "")).join("");
      const scrolls = [...new Set(s.inv.filter((r) => D.ITEMS[r.item]?.spell && f.left(r.id) > 0).map((r) => r.item))].slice(0, 4).map((it) => B("scroll:" + it, D.ITEMS[it].name)).join("");
      const shouts = typeof POWERS !== "undefined" && f.pw ? (POWERS.known ? [] : []).join("") : "";
      return `<div class="tbmenu"><div class="tbmh"><b> Items</b><small>Drag a potion onto yourself, or tap it</small></div><div class="tbgrid">${pots || scrolls ? pots + scrolls : `<p class="sub">No potions or scrolls.</p>`}${shouts}</div><button class="tbact back" data-tbm="">‹ Back</button></div>`;
    }
    const bx = typeof BEASTPATH !== "undefined" ? BEASTPATH.moves(f) : { form: null, list: [] };   // Beast Form / Vampire Lord moves, vampire powers (beastpaths.js)
    const mv = typeof MOUNTFIGHT !== "undefined" && !bx.form ? MOUNTFIGHT.moves(f) : [];   // Mount / Dismount (mountfight.js)
    const sh = bx.form ? "" : shoutsFor(f).map(([a, n]) => B(a, n, "shout")).join("") + bx.list.map(([a, n]) => B(a, n, "shout beast")).join("") + mv.map(([a, n]) => B(a, n, "mount")).join("");
    if (typeof TBRADIAL !== "undefined" && TBRADIAL.on()) {   // the combat wheel: moves in a ring round End turn
      const W = (a, label, extra = "") => { const c = cost(f, a, sess), ok = sess.canAfford(a), z = zoneOf(a);
        const tip = typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, a, c))}"` : "";
        return `<button class="tbact ${extra}" data-tba="${esc(a)}"${z ? ` data-tz="${z}"` : ""}${tip} ${ok ? "" : "disabled"}><span class="ic" aria-hidden="true">${iconOf(f, a)}</span><b>${esc(label)}</b><small>${esc(TBRADIAL.costLine(f, a, c))}</small></button>`; };
      const sl = bx.form ? [...bx.list.map(([a, n]) => W(a, n, "main beast")), W("flee", "Flee", "flee")] : [W("attack", f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack", "main"), W("power_attack", "Power", "main"),
        f.shield && typeof SHIELDFX !== "undefined" ? W("bash", "Bash", "main") : W("block", "Guard", "main"),
        `<button class="tbact menu" data-tbm="magic"><span class="ic" aria-hidden="true">${ICON.magic}</span><b>Magic ▸</b><small>${(s.spells || []).length} spells</small></button>`,
        `<button class="tbact menu" data-tbm="items"><span class="ic" aria-hidden="true">${ICON.items}</span><b>Items ▸</b><small>potions</small></button>`,
        ...shoutsFor(f).map(([a, n]) => W(a, n.replace("Shout ", ""), "shout")), ...bx.list.map(([a, n]) => W(a, n, "shout beast")), ...mv.map(([a, n]) => W(a, n, "mount")), W("flee", "Flee", "flee")];
      const hub = `<button class="tbact end" data-tba="end"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : ""}><span class="ic" aria-hidden="true">${ICON.end}</span><b>End</b><small>${guardTxt(sess)}</small></button>`;
      return TBRADIAL.wheel(sl, hub);
    }
    const endB = `<button class="tbact end" data-tba="end"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : ""}><span class="ic" aria-hidden="true">${ICON.end}</span><b>End turn</b><small>${guardTxt(sess)}</small></button>`;
    if (bx.form) return `<div class="tbgrid beastgrid ${bx.form}">${bx.list.map(([a, n]) => B(a, n, "main beast")).join("")}${B("flee", "Flee", "flee")}${endB}</div>`;
    return `<div class="tbgrid">${B("attack", f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack", "main")}${B("power_attack", "Power attack", "main")}${f.shield && typeof SHIELDFX !== "undefined" ? B("bash", "Shield bash", "main") : B("block", "Guard", "main")}
      <button class="tbact menu" data-tbm="magic"><span class="ic" aria-hidden="true">${ICON.magic}</span><b>Magic ▸</b><small>${(s.spells || []).length} spells</small></button>
      <button class="tbact menu" data-tbm="items"><span class="ic" aria-hidden="true">${ICON.items}</span><b>Items ▸</b><small>potions</small></button>${sh}
      ${B("flee", "Flee", "flee")}
      <button class="tbact end" data-tba="end"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : ""}><span class="ic" aria-hidden="true">${ICON.end}</span><b>End turn</b><small>${guardTxt(sess)}</small></button></div>`;
  }
  function shoutsFor(f) {
    if (typeof POWERS === "undefined" || !f.pw) return [];
    const out = [];
    for (const a of ["shout:fus", "shout:yol", "shout:fo", "power:racial"]) { try { if (f.affordable(a)) out.push([a, a.startsWith("shout") ? "Shout " + a.split(":")[1].toUpperCase() : "Racial power"]); } catch (e) { /* not known */ } }
    return out.slice(0, 2);
  }
  function render(state) {
    try { if (typeof FOEINTENT !== "undefined" && ui?.sess) FOEINTENT.refresh(ui.sess); } catch (e) { /* never break a fight for a marker */ }
    try { ui?.sess?.remote?.sync?.(ui.sess); } catch (e) { /* the party view never breaks the fight */ }
    const el = document.getElementById("tbf"); if (!el || !ui) return;
    const sess = ui.sess, f = sess.f, s = f.s;
    /* [fightread] play what happened one event at a time (Fast  shows it all at once, Skip jumps to the end) */
    const R = typeof FIGHTREAD !== "undefined" ? FIGHTREAD : null;
    clearTimeout(ui.paceT); ui.paceT = null;
    let cut = sess.ev.length;
    if (R && R.paced() && !ui.skip && !sess.autoRest && cut - ui.shown > 1) { cut = ui.shown + 1; const wait = R.delay(sess.ev[ui.shown]); ui.pendState = state; ui.paceT = setTimeout(() => { if (ui && ui.sess === sess) render(ui.pendState); }, wait); }
    const playing = cut < sess.ev.length;
    if (!playing) { ui.skip = false; ui.pendState = null; }
    const vis = playing ? sess.ev.slice(0, cut) : sess.ev;
    const newEv = vis.slice(ui.shown); ui.shown = cut;
    if (playing) state = { turn: "play" };
    // the turn order: whoever is acting right now is lit, while you choose AND while the others' turns play out one by one
    const pe = playing ? vis[vis.length - 1] : null;
    const acting = (o) => (pe ? (pe.kind === "foe" ? o.id.startsWith("foe") : pe.kind === "me" ? o.id === "me" : pe.kind === "ally" ? o.name === pe.name || (pe.pid && o.pid === pe.pid) : pe.kind === "sum" ? o.id === "sum" : false) : o.id === sess.cur?.id && !sess.done);
    const actIdx = sess.order.findIndex(acting);
    const order = sess.order.map((o, i) => `<span class="tbini ${acting(o) ? "now" : ""} ${(playing ? actIdx >= 0 && i < actIdx : i < sess.idx) ? "gone" : ""} ${o.id.startsWith("foe") ? "foe" : o.id === "me" ? "me" : "ally"}" data-tip="${esc(o.name)}: initiative ${o.init}. Higher initiative acts earlier in the round.">${icon(o, f)} ${esc(o.name.split(" ")[0])}<i>${o.init}</i></span>`).join("");
    const pips = (n, m, cls) => Array.from({ length: m }, (_, i) => `<i class="${i < n ? "on" : ""} ${cls}"></i>`).join("");
    const allies = partyHTML(f);
    const mine = state.turn === "me";
    const wait = state.turn === "wait" ? `<p class="tbwait"> ${esc(state.who)} is choosing their move… <b class="num" id="tbcd">${Math.max(0, Math.ceil((state.until - Date.now()) / 1000))}s</b>, then they guard</p>` : "";
    const scene = (newEv.length || !ui.lastScene) && typeof FIGHTART !== "undefined" ? sceneFor(newEv) : "";
    const fmt = typeof TBUI !== "undefined" ? TBUI.logLine : (e) => `<div class="tbl ${e.kind}">${esc(e.text)}</div>`;
    const recent = vis.filter((e) => e.kind !== "round"), lastE = recent[recent.length - 1];
    const log = recent.slice(-10).map((e) => fmt(e, e === lastE && newEv.includes(e))).join("");
    const atE = playing ? vis[vis.length - 1] : null;   // while playing, the bars show health as of the event on screen
    const hpMax = G.maxHealth(s), hpNow = Math.max(0, Math.round(atE?.hp ?? f.hp)), ehpNow = Math.max(0, Math.round(atE?.ehp ?? f.ehp));
    const prev = ui.prevBars || { hp: hpNow, ehp: ehpNow, mp: Math.max(0, Math.round(f.mp)), sp: Math.max(0, Math.round(f.sp)) };
    const mpNow = playing ? prev.mp : Math.max(0, Math.round(f.mp)), spNow = playing ? prev.sp : Math.max(0, Math.round(f.sp)), mpMax = G.maxMagicka(s), spMax = G.maxStamina(s);
    ui.prevBars = { hp: hpNow, ehp: ehpNow, mp: mpNow, sp: spNow };
    const pops = popsFor(newEv, f, prev, { hp: hpNow, ehp: ehpNow, mp: mpNow, sp: spNow });
    const pc = (v, m) => (100 * Math.max(0, v) / Math.max(1, m)).toFixed(1);
    const uBar = (v, p, m, cls, marks = "") => `<div class="tbbar big ${cls}"><b class="gh" style="width:${pc(Math.max(v, p), m)}%" data-to="${pc(v, m)}"></b><i style="width:${pc(v, m)}%"></i>${marks}<span class="num">${v} / ${m}</span></div>`;
    const rd = R && !playing && !sess.done ? R.panels(sess) : null;   // intents and what's coming off the bars
    const rBar = (v, p, m, cls, lb) => `<div class="tbbar mid ${cls}"><b class="gh" style="width:${pc(Math.max(v, p), m)}%" data-to="${pc(v, m)}"></b><i style="width:${pc(v, m)}%"></i><span class="num"><em>${lb}</em> ${v} / ${Math.round(m)}</span></div>`;
    let banner = "";
    if (playing) { if (R) { const e = newEv[newEv.length - 1], pv = vis[vis.length - 2]; banner = R.bannerHTML(R.banner(e, pv, sess)); } }
    else if (sess.done) banner = `<div class="tbban ${f.won ? "won" : "lost"}">${esc(sess.endLabel || (f.won ? (f.escaped ? "Escaped" : "Victory") : "Defeated"))}</div>`;
    else if (mine && ui.bannerFor !== sess.round) {
      ui.bannerFor = sess.round;
      const rb = R ? R.banner(newEv.filter((e) => e.kind === "round").pop(), null, sess) : null;   // a new round that starts with you: its summary goes under "Your turn"
      banner = rb ? R.bannerHTML({ cls: "round me", t: "Your turn", sub: `Round ${sess.round} · ${rb.sub}` }) : `<div class="tbban me">Your turn</div>`;
      if (R) R.play("turn-me");
    }
    if (R && newEv.length) { const k = Math.max(0, newEv.length - 3); newEv.slice(k).forEach((e, i) => R.play(R.cue(e, vis[vis.indexOf(e) - 1]), i * 0.25)); }
    el.innerHTML = `<div class="tbin">
      <div class="tbtop"><b>Round ${sess.round}</b><span class="tbord">${order}</span><button class="tbff" data-tbx="log" aria-label="Full fight log"></button>${typeof TBRADIAL !== "undefined" ? `<button class="tbff ${TBRADIAL.on() ? "on" : ""}" data-tbx="wheel" aria-label="Combat wheel and timing ring" data-tip="${typeof FIGHTCTL !== "undefined" && FIGHTCTL.on() ? "Timing ring: after a strike or a damage spell, tap when the needle is in the bright zone (Perfect +25%, a miss −20%). Tap to switch it on or off." : "Combat wheel: your moves in a ring, and a timing ring for strikes and spells (Perfect +25%, a miss −20%). Tap to switch to cards."}"></button>` : ""}</div>
      <div class="tbstage" data-tbzone="foe"><div class="tbscene" id="tbscene">${scene || (ui.lastScene || "")}</div>${banner}${rd ? rd.bubble : ""}<div class="tbhint" aria-hidden="true"></div></div>
      <div class="tbvit"><div class="tbu me" data-tbzone="self"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.me(f, sess.st))}"` : ""}><small class="nm">\uE102 ${esc(s.name || "You")}</small>${uBar(hpNow, prev.hp, hpMax, "hp", rd ? rd.meMarks(hpNow, hpMax) : "")}${rd ? rd.meLine : ""}<div class="tbsub">${rBar(mpNow, prev.mp, mpMax, "mp", "MP")}${rBar(spNow, prev.sp, spMax, "sp", "SP")}${typeof CHARGE !== "undefined" ? CHARGE.fightBar(f) : ""}</div>${f.ward > 0 ? `<div class="tbward" title="Ward: soaks magic until it breaks. Cast it again to refill it."><i style="width:${pc(f.ward, f.wardMax || f.ward)}%"></i><span>\uE102 Ward ${Math.round(f.ward)} / ${Math.round(f.wardMax || f.ward)}</span></div>` : ""}${R ? R.myChips(f) : ""}${typeof SPELLFX !== "undefined" ? SPELLFX.meHTML(f) : ""}</div>
        <div class="tbu foe" data-tbzone="foe"${typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.foe(f, sess.ehpMax))}"` : ""}><small class="nm">${f.e.player ? "\uE101" : "\uE12E"} ${esc(f.e.name)}${f.e.archLabel && !String(f.e.name).toLowerCase().includes(f.e.archLabel) ? ` <span class="arch">${esc(f.e.archLabel)}</span>` : ""}${sess.waves > 1 ? ` <span class="arch">${sess.wave}/${sess.waves}</span>` : ""}</small>${uBar(ehpNow, prev.ehp, sess.ehpMax, "hp foe", rd ? rd.foeMarks(ehpNow, sess.ehpMax) : "")}${rd ? rd.foeLine : ""}${statusChips(f)}${rd ? rd.intents : ""}</div></div>
      ${allies}
      <button class="tblog" aria-live="polite" data-tbx="log" aria-label="Fight log, tap for the full log"${log ? "" : " hidden"}>${log}</button>
      ${wait}
      ${playing ? `<button class="tbskip tbhurry" data-tbx="skip" aria-label="Tap the fight to hurry this turn along"></button>` : ""}
      <div class="tbdock">
        <div class="tbap">${playing ? `<em class="them">${esc(R ? R.who(vis[vis.length - 1], sess) : "")}</em>` : mine && typeof FIGHTCTL !== "undefined" && FIGHTCTL.on() ? FIGHTCTL.apHTML(sess) : mine ? `<span>Moves</span>${pips(sess.st.acts - sess.myActs, sess.st.acts, "ap")}<em>Your turn${sess.until ? ` <b class="num" id="tbcd">${Math.max(0, Math.ceil((sess.until - Date.now()) / 1000))}s</b>` : ""}</em>` : sess.done ? "" : `<em class="them">${esc(sess.cur?.name || "")}'s turn…</em>`}</div>
        ${playing ? "" : sess.done ? `<button class="btn pri tbdone" data-tbx="done">${f.won ? (f.escaped ? "Continue" : "Victory — continue") : "Continue"}</button>` : mine ? actionsHTML(sess) : ""}
      </div>
      ${ui.logOpen ? fullLog(sess, fmt) : ""}
    </div>`;
    if (scene) ui.lastScene = scene;
    if (typeof COMBAT2 !== "undefined") { try { COMBAT2.layout(el, sess, { playing, mine, pops, big: prev.hp - hpNow > hpMax * 0.15 }); } catch (e) { console.warn("combat2", e); } }   // combat2.js: the cards go into the scene
    if (typeof TBUI !== "undefined") TBUI.after(el, { hurt: hpNow < prev.hp, hit: ehpNow < prev.ehp, big: prev.hp - hpNow > hpMax * 0.15, mine, pops });
    if (typeof FOEINTENT !== "undefined") { el.classList.toggle("tbplay", playing); try { FOEINTENT.decorate(el, sess); } catch (e) { console.warn("foe targets", e); } }   // crosshairs and the arrow
    if (typeof FIGHTTIPS !== "undefined") { try { FIGHTTIPS.decorate(el, sess); } catch (e) { console.warn("fight tips", e); } }   // tooltips on everything (fighttips.js)
    if (R) { el.classList.toggle("tbplay", playing); R.low(el, hpNow / Math.max(1, hpMax), !sess.done); }
    if (f.bf && typeof BOSSFIGHT !== "undefined") { try { BOSSFIGHT.decorate(el, sess, newEv, ehpNow, playing); } catch (e) { console.warn("boss", e); } }   // boss bar, phases, big attacks
  }
  /* floating numbers for what just happened: damage coloured by element, heals, crits, and what you spent */
  const ELEM = [["fire", /\b(fire|flame|burn|scorch|ember)/i], ["frost", /\b(frost|ice|cold|freez|chill)/i], ["shock", /\b(shock|lightning|spark|thunder)/i], ["poison", /\b(poison|venom|toxic)/i]];
  function elemOf(e) {
    const sp = e.a ? spellOf(e.a) : null;
    if (sp?.element && sp.element !== "none") return sp.element;
    if (/^shout:/.test(e.a || "")) return "shout";
    for (const [k, re] of ELEM) if (re.test(e.text || "")) return k;
    return "phys";
  }
  function popsFor(evs, f, was, now) {
    const out = []; let toFoe = 0, toMe = 0, healMe = 0;
    for (const e of evs) {
      const crit = /\b(critical|sneak attack|finishing blow)\b/i.test(e.text || "");
      if (e.kind === "foe" && e.dmg > 0) { out.push({ at: "me", n: -e.dmg, el: elemOf(e), crit }); toMe += e.dmg; }
      else if ((e.kind === "me" || e.kind === "ally") && e.dmg > 0) { out.push({ at: "foe", n: -e.dmg, el: elemOf(e), crit }); toFoe += e.dmg; }
      if (e.healed > 0) { out.push({ at: "me", n: e.healed, el: "heal" }); healMe += e.healed; }
      if (e.kind === "ally" && e.dmg == null) {   // summons and followers: the line only says the number
        const m = /\b(?:strikes|hits|deals|for)\s+(\d+)/i.exec(e.text || ""); if (m) { out.push({ at: "foe", n: -+m[1], el: elemOf(e) }); toFoe += +m[1]; }
      }
    }
    // whatever the lines didn't name (burning, poison over time, the foe's own regen...) still shows
    const restFoe = was.ehp - now.ehp - toFoe, restMe = was.hp - now.hp - toMe + healMe;
    if (restFoe >= 1) out.push({ at: "foe", n: -Math.round(restFoe), el: f.foeSt?.burn ? "fire" : f.foeSt?.shock ? "shock" : f.foeSt?.chill ? "frost" : "phys" });
    if (restMe >= 1) out.push({ at: "me", n: -Math.round(restMe), el: "phys" });
    for (const e of evs) { if (e.mpUp > 0) out.push({ at: "me", n: e.mpUp, el: "mp", tag: "MP" }); if (e.spUp > 0) out.push({ at: "me", n: e.spUp, el: "sp", tag: "SP" }); }   // a magicka or stamina potion working (potionfx.js)
    if (now.mp < was.mp - 0.5) out.push({ at: "me", n: now.mp - was.mp, el: "mp", tag: "MP" });
    if (now.sp < was.sp - 0.5) out.push({ at: "me", n: now.sp - was.sp, el: "sp", tag: "SP" });
    return out.slice(-8);
  }
  /* your party, readable at a glance: one frame per teammate (players and followers) with health numbers, what's on them,
     and a drop target, so spells, scrolls and potions can be dragged onto a teammate */
  function partyHTML(f) {
    const pc = (v, m) => (100 * Math.max(0, v) / Math.max(1, m)).toFixed(1);
    ui.prevAl = ui.prevAl || new Map();
    const one = (a, i, down) => {
      const mx = Math.round(a.maxHp || a.hpMax || a._max || Math.max(a.hp || 0, 1)), hp = Math.max(0, Math.round(a.hp || 0));
      const was = ui.prevAl.get(a) ?? hp; ui.prevAl.set(a, hp);
      const fx = [a.ward > 0 ? "" : "", a.armorT > 0 ? "" : "", a.imbue?.turns > 0 ? "" : "", a.heroT > 0 ? "⚑" : "", a.unseen > 0 ? "" : "", a.guard ? "" : "", typeof POTFX !== "undefined" ? POTFX.allyIcons(a) : ""].join("");
      const ic = a.player ? "" : a.follower ? "" : a.summon ? "✦" : "";
      const role = a.role ? ` · ${a.role}` : a.follower ? " · follower" : a.player ? " · player" : "";
      const tip = `${a.name}${role}. ${down ? "Knocked down" : `${hp} / ${mx} health`}.${down ? " A Rescue spell can bring them back." : " Drag a healing spell, scroll or potion here to use it on them."}`;
      return `<div class="tbu ally${down ? " down" : ""}" data-tbzone="${down ? "ally" : "self ally"}" data-ally="${down ? 1000 + i : i}" data-tip="${esc(tip)}"><small class="nm">${ic} ${esc(a.name)}${fx ? ` <span class="fx">${fx}</span>` : ""}</small>
        <div class="tbbar mid hp"><b class="gh" style="width:${pc(Math.max(hp, was), mx)}%" data-to="${pc(hp, mx)}"></b><i style="width:${pc(hp, mx)}%"></i><span class="num">${down ? "down" : `${hp} / ${mx}`}</span></div>${!down && typeof FAI !== "undefined" ? FAI.frame(a) : ""}</div>`;
    };
    const live = f.allies.filter((a) => a.hp != null).map((a) => one(a, f.allies.indexOf(a), false));
    const downed = (f._downed || []).map((a, i) => one(a, i, true));
    const all = [...live, ...downed];
    if (!all.length) return "";
    return `<div class="tbparty${all.length > 4 ? " many" : ""}" aria-label="Your party">${all.join("")}</div>`;
  }
  /* the whole fight so far, newest round first */
  function fullLog(sess, fmt) {
    const by = new Map();
    for (const e of sess.ev) { if (e.kind === "round") continue; if (!by.has(e.round)) by.set(e.round, []); by.get(e.round).push(e); }
    const rounds = [...by.entries()].reverse().map(([r, es]) => `<h4>Round ${r}</h4>${es.map((e) => fmt(e, false)).join("")}`).join("");
    return `<div class="tbsheet" role="dialog" aria-label="Fight log"><div class="tbsh-in"><div class="tbsh-top"><b> Fight log</b><button class="tbff" data-tbx="logx" aria-label="Close the log">✕</button></div><div class="tbsh-body">${rounds || `<p class="sub">Nothing yet.</p>`}</div></div></div>`;
  }
  function statusChips(f) {
    const st = f.foeSt || {}, out = [];
    if (st.burn) out.push(`<i class="st burn" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.burn : ""}">${st.burn.turns ?? ""}</i>`);
    if (st.chill) out.push(`<i class="st chill" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.chill : ""}">${st.chill.turns ?? ""}</i>`);
    if (st.shock) out.push(`<i class="st shock" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.shock : ""}">${st.shock.turns ?? ""}</i>`);
    if (f.eParalyzed > 0) out.push(`<i class="st para" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.para : ""}">${f.eParalyzed}</i>`);
    if (f.tbStunLeft > 0) out.push(`<i class="st stun" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.stun : ""}"></i>`);
    if (f.stagger) out.push(`<i class="st stag" data-tip="${typeof TBTIPS !== "undefined" ? TBTIPS.STATUS.stag : ""}"></i>`);
    if (typeof FOEKIT !== "undefined") for (const [c, ic, tip] of FOEKIT.chips(f)) out.push(`<i class="st kit ${c}" data-tip="${esc(tip)}">${ic}</i>`);
    if (typeof COMBO !== "undefined") for (const [c, ic, tip] of COMBO.chips(f)) out.push(`<i class="st ${c}" data-tip="${esc(tip)}">${ic}</i>`);   // followers2: weak/resists
    if (typeof SPELLFX !== "undefined") { const h = SPELLFX.foeHTML(f); if (h) out.push(h); }   // calm, fear, walls, runes, soul trap (spellfx.js)
    return out.length ? `<div class="tbst">${out.join("")}</div>` : "";
  }
  /* animate just what happened since the last screen: a view of the fight with only those lines (the full fight-scene
     animations per weapon, spell, enemy and ally come from fightart.js) */
  function sceneFor(evs) {
    const sess = ui.sess, f = sess.f;
    const lines = evs.filter((e) => ["me", "foe", "ally", "tick"].includes(e.kind)).map((e) => ({ turn: e.round, me: e.kind === "foe" ? "" : e.kind === "ally" ? " · " + e.text : e.text, them: e.kind === "foe" ? e.text : "", a: e.a || "attack", wt: e.wt || f.wt, hp: e.hp, ehp: e.ehp }));
    if (!lines.length && ui.lastScene) return "";
    if (!lines.length) lines.push({ turn: 0, me: "", them: "", a: "attack", wt: f.wt, hp: Math.round(f.hp), ehp: Math.round(f.ehp) });   // the opening stand-off
    const keep = fast() && !sess.done ? lines.filter((l, i) => l.me || i === lines.map((x) => !!x.them).lastIndexOf(true)) : lines;   // Fast: your moves and the foe's last blow
    const v = Object.create(f);
    v.log = keep.length ? keep : lines; v.hp0 = ui.lastHp ?? f.hp0; v.ehp0 = ui.lastEhp ?? f.ehp0; v.won = sess.done ? f.won : undefined;
    v.tbTall = true; v.tbAspect = typeof COMBAT2 !== "undefined" && COMBAT2.aspect ? COMBAT2.aspect() : null; v.tbMid = !sess.done; v.tbHud = typeof COMBAT2 !== "undefined" && COMBAT2.on(); v.tbHpMax = G.maxHealth(f.s); v.tbEhpMax = sess.ehpMax;   // fightart: stay standing between turns, bars against full health
    ui.lastHp = lines[lines.length - 1].hp; ui.lastEhp = lines[lines.length - 1].ehp;
    return FIGHTART.placeholder(v, f.s);
  }
  function step(r) {
    render(r || { turn: ui.sess.done ? "done" : ui.sess.cur?.id === "me" ? "me" : "auto" });
  }
  function onClick(ev) {
    if (!ui || ui.timing) return;   // the timing ring is up
    const b = ev.target.closest("button"); if (!b || b.disabled) return;
    const sess = ui.sess;
    if (b.dataset.tbx === "wheel") { TBRADIAL.toggle(); return step(); }
    if (b.dataset.fc && typeof FIGHTCTL !== "undefined") { FIGHTCTL.click(b); return step(); }   // fightctl.js: ★ pins, spell filters
    if (b.dataset.tbm !== undefined) { ui.menu = b.dataset.tbm || null; return step(); }
    if (b.dataset.tbx === "autoall") { ui.menu = null; sess.autoRest = true; sess.autoTurn(); return step(sess.advance()); }   // no button for players any more; screen tests use it to finish a fight
    if (b.dataset.tbx === "done") return close();
    if (b.dataset.tbx === "skip") { ui.skip = true; try { FIGHTART.finishAll(); } catch (e) { /* nothing playing */ } return render(ui.pendState || { turn: sess.done ? "done" : sess.cur?.id === "me" ? "me" : "auto" }); }
    if (b.dataset.tbx === "log") { ui.logOpen = true; return step(); }
    if (b.dataset.tbx === "logx") { ui.logOpen = false; return step(); }
    if (b.dataset.tba) {
      ui.menu = null;
      const root = document.getElementById("tbf"), tgt = root?.dataset.tbt; if (root) delete root.dataset.tbt;
      const a = b.dataset.tba, f = sess.f;
      const go = (g) => {
        if (!ui || ui.sess !== sess) return;
        const was = { sp: f.sp, mp: f.mp, hp: f.hp };
        let r = sess.act(a, tgt, g ? g.mult : 1, g);
        if (r?.err) { if (hooks.toast) hooks.toast(r.err); return; }
        const d = { sp: was.sp - f.sp, mp: was.mp - f.mp, hp: f.hp - was.hp };
        if (r?.turn === "next") r = sess.advance();
        if (typeof SOUND !== "undefined" && SOUND.fx && (/spell|dual|scroll/.test(a) || typeof COMBATFX === "undefined")) SOUND.fx(/spell|dual|scroll/.test(a) ? "spell" : "hit");   // blows sound on impact (combatfx)
        step(r);
        if (typeof TBRADIAL !== "undefined" && TBRADIAL.on()) TBRADIAL.spent(a === "end" || a === "flee" ? { sp: 0, mp: 0, hp: 0 } : d, g);
      };
      // the minigames (minigame.js): every blow, guard and spell you make yourself; Auto never plays them
      if (typeof MINIGAME !== "undefined" && MINIGAME.on() && MINIGAME.kindFor(f, a) && sess.canAfford(a)) {
        const sp = spellOf(a);
        ui.timing = true;
        return MINIGAME.play(root, f, a, { icon: iconOf(f, a), label: sp ? sp.name : a === "power_attack" ? "Power attack" : a === "bash" ? "Shield bash" : a === "block" ? "Guard" : f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack" })
          .then((g) => { if (ui) ui.timing = false; go(g); }, () => { if (ui) ui.timing = false; go(null); });
      }
      // the old timing ring (wheel only, when the minigames are off)
      if (typeof TBRADIAL !== "undefined" && TBRADIAL.on() && !fast() && TBRADIAL.timed(a, zoneOf(a)) && sess.canAfford(a) && typeof MINIGAME === "undefined") {
        const sp = spellOf(a), perk = typeof PFX !== "undefined" ? PFX.num(f.s, "timing") : 0;
        ui.timing = true;
        return TBRADIAL.ring(root, { z: TBRADIAL.zone(TBRADIAL.skillFor(f, a, sp), perk), icon: iconOf(f, a), label: sp ? sp.name : a === "power_attack" ? "Power attack" : a === "bash" ? "Shield bash" : f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack" })
          .then((g) => { if (ui) ui.timing = false; go(g); });
      }
      return go(null);
    }
  }
  let waitT = null;
  function tickWait() {
    clearInterval(waitT);
    waitT = setInterval(() => {
      if (!ui) return clearInterval(waitT);
      const s = ui.sess;
      if (s.waiting) { const c = document.getElementById("tbcd"); if (c) c.textContent = Math.max(0, Math.ceil((s.waiting.until - Date.now()) / 1000)) + "s"; if (s.waiting.move || s.waiting.reply || Date.now() >= s.waiting.until) step(s.advance()); }
      else if (s.mirror && s.until) { const c = document.getElementById("tbcd"); if (c) c.textContent = Math.max(0, Math.ceil((s.until - Date.now()) / 1000)) + "s"; if (Date.now() >= s.until && !ui.timing) { ui.menu = null; s.timeUp(); step(s.advance()); } }   // your turn in a teammate's fight ran out
    }, 500);
  }
  function close() {
    const el = document.getElementById("tbf");
    if (el) { el.removeEventListener("click", onClick); el.remove(); }
    clearInterval(waitT);
    if (ui) clearTimeout(ui.paceT);
    if (typeof FIGHTREAD !== "undefined") FIGHTREAD.stop();
    const cb = ui?.onDone;
    if (ui?.sess?.remote) ui.sess.remote.end?.();
    ui = null; open = false;
    if (cb) cb();
  }

  // ------------------------------------------------------------------ live party fights (everyone sees the fight; each player picks on their own phone)
  /* The phone that started the fight runs it and owns the record tbf/<id>. It keeps the record up to date (foe, health,
     log, who's in it) so party members in the fight watch it live on their own screen. When a member's turn comes the
     record holds {turn:{pid, until}} and the member's phone writes back {reply:{pid, move}}. Since v2 a whole turn comes back in tbf/<id>~<pid> (sharedfight.js). 90 s, then guard. */
  const players = (sess) => [...new Set([...(sess.everyone || []), ...sess.f.allies, ...(sess.f._downed || [])])].filter((a) => a && a.player && a.pid && !a.gone);
  function fightState(sess) {
    const f = sess.f, w = sess.waiting;
    return { foe: f.e.name, boss: !!f.e.boss, round: sess.round, wave: sess.wave || 1, waves: sess.waves || 1,
      ehp: Math.max(0, Math.round(f.ehp)), ehpMax: sess.ehpMax, ownerName: f.s.name, hp: Math.max(0, Math.round(f.hp)), hpMax: G.maxHealth(f.s),
      pids: players(sess).map((a) => a.pid),   // knocked-down players stay in: they still watch the fight to the end
      allies: f.allies.filter((a) => !a.summon).slice(0, 9).map((a) => ({ name: a.name, pid: a.pid || null, hp: Math.max(0, Math.round(a.hp ?? 0)), hpMax: Math.round(a.hp0 || a.maxHp || a.hp || 1), down: !!a.down })),
      turn: w ? { pid: w.pid, until: w.until, name: w.name, heals: w.al?.heals || 0, pots: w.al?.pots || 0, tid: w.tid || null } : null,
      log: sess.ev.filter((e) => e.kind !== "round").slice(-6).map((e) => e.text),
      done: !!sess.done, won: sess.done ? !!f.won : null, t: Date.now() / 1000, ...shared(sess) };
  }
  /* v2: everything a teammate's phone needs to show the same fight on its full fight screen and play real turns in it
     (sharedfight.js). Older phones read only the fields above and keep the small "Fighting beside" box. */
  let kseq = 0;
  function shared(sess) {
    const f = sess.f;
    const all = [...new Set([...(sess.everyone || []), ...f.allies, ...(f._downed || [])])].filter((a) => a && !a.summon && !a.gone && a.hp != null);
    const fs = {}; for (const k of FOE_KEYS) if (f[k] !== undefined) fs[k] = f[k];
    const e = {}; for (const [k, v] of Object.entries(f.e || {})) if (!["loot", "drops", "group"].includes(k) && typeof v !== "function") e[k] = v;
    const look = typeof HEROART !== "undefined" && HEROART.lookOf ? (() => { try { return HEROART.lookOf(f.s); } catch (x) { return null; } })() : null;
    const roster = [{ k: "host", host: true, player: true, name: f.s.name || "Leader", hp: Math.max(0, Math.round(f.hp)), hpMax: G.maxHealth(f.s), down: f.hp <= 0, look, ward: Math.round(f.ward || 0), form: typeof BEASTPATH !== "undefined" ? BEASTPATH.form(f) : null, ...(f.potOT ? { potOT: f.potOT } : {}) },
      ...all.map((a) => { a.tbk = a.tbk || (a.pid ? "p:" + a.pid : "a" + ++kseq);
        const o = { k: a.tbk, pid: a.pid || null, name: a.name, hp: Math.max(0, Math.round(a.hp || 0)), hpMax: Math.round(a.maxHp || a.hpMax || a._max || a.hp0 || Math.max(1, a.hp || 1)), down: !!a.down || !f.allies.includes(a),
          player: !!a.player, follower: !!(a.follower || a.kind === "follower"), role: a.role || null, look: a.look || null, kind: a.kind || null, fid: a.fid || null };
        for (const k of BUFF_KEYS) if (a[k] != null) o[k] = a[k];
        return o; })];
    if (typeof MOUNTFIGHT !== "undefined") MOUNTFIGHT.roster(f, all, roster);   // who's in the saddle, and their horses' health (mountfight.js)
    const evs = sess.ev.slice(-24).map((x, i, arr) => {
      const o = { n: sess.ev.length - arr.length + i, kind: x.kind, who: x.who, text: x.text, round: x.round, hp: x.hp, ehp: x.ehp };
      for (const k of ["a", "wt", "dmg", "healed", "name", "wave", "by", "hits", "ph"]) if (x[k] != null) o[k] = x[k];
      return o;
    });
    return { v: 2, foeE: e, fs, kind: sess.kind, hitters: sess.hitters || 0, roster,
      order: sess.order.map((o) => ({ id: o.id, name: o.name, init: o.init, pid: o.al?.pid || null })), idx: sess.idx,
      cur: sess.cur ? { id: sess.cur.id, name: sess.cur.name, pid: sess.cur.al?.pid || null } : null, evs,
      escaped: sess.done ? !!f.escaped : null };
  }
  function remoteFor(store, myId) {
    if (!store || typeof store.put !== "function") return null;
    let fid = null, cur = null, watching = false, last = "", lastT = 0, made = false, timer = null, beat = null, pidsSeen = new Set();
    const push = (force) => {
      const sess = cur; if (!sess || !fid) return;
      const st = fightState(sess); if (!st.pids.length) return;
      st.pids.forEach((p) => pidsSeen.add(p));
      const k = JSON.stringify({ ...st, t: 0 });
      if (k === last && Date.now() - lastT < 14000) return;   // nothing new (a heartbeat every ~15 s so teammates know the leader's still there)
      if (!force && Date.now() - lastT < 600) { clearTimeout(timer); timer = setTimeout(() => push(true), 650); return; }
      last = k; lastT = Date.now();
      if (!made) { made = true; store.put("tbf", fid, { owner: myId, ...st }); }
      else store.change("tbf", fid, (x) => ({ ...(x || {}), owner: myId, ...st }));
    };
    const watchReplies = () => {
      if (watching || !store.watch) return; watching = true;
      store.watch("tbf", (docs) => {
        const s2 = cur, w = s2?.waiting; if (!s2 || !fid || !w) return;
        const rp = docs.find((x) => x.id === `${fid}~${w.pid}`);   // a whole turn played on their own fight screen (sharedfight.js)
        if (rp && rp.tid && rp.tid === w.tid && !w.reply) { w.reply = rp; return; }
        const d = docs.find((x) => x.id === fid); if (d?.reply && d.reply.pid === w.pid && d.reply.round === s2.round) w.move = d.reply.move;   // an older phone: one simple move
      });
    };
    const start = (sess) => { cur = sess; fid = fid || `${myId}-${Math.floor(Date.now() / 1000)}`; watchReplies(); if (!beat) beat = setInterval(() => push(), 5000); };
    return {
      /* called whenever the fight screen updates */
      sync(sess) { if (!players(sess).length) return; start(sess); push(sess.done); },
      ask(sess) { start(sess); push(true); },
      live: () => !!store.online,
      end() {
        clearTimeout(timer); clearInterval(beat); beat = null;
        if (cur && fid) { push(true); const id = fid, ps = [...pidsSeen]; setTimeout(() => { store.remove?.("tbf", id); ps.forEach((p) => store.remove?.("tbf", `${id}~${p}`)); }, 12000); }   // members see the ending, then it's tidied away
        fid = null; cur = null; made = false; last = ""; pidsSeen = new Set();
      },
    };
  }
  /* the member's side: a fight I'm standing in shows up on my screen, live; on my turn I pick a move there */
  const watchClosed = {};
  function watchTurns(store, getMe) {
    if (!store?.watch) return;
    const bar = (v, m, cls) => `<span class="tbw-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round(100 * v / Math.max(1, m))))}%"></i></span>`;
    store.watch("tbf", (docs) => {
      const me = getMe(); if (!me) return;
      const nowS = Date.now() / 1000;
      const mine = (x) => !watchClosed[x.id] && !(typeof SHAREDFIGHT !== "undefined" && SHAREDFIGHT.claims(x));   // the full shared fight screen takes these (sharedfight.js)
      const d = docs.find((x) => x.owner !== me && (x.pids || []).includes(me) && nowS - (x.t || 0) < 180 && mine(x))
        || docs.find((x) => x.turn && x.turn.pid === me && !(x.reply && x.reply.round === x.round) && x.turn.until > Date.now() && mine(x));
      let el = document.getElementById("tbwatch");
      if (!d || open) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement("div"); el.id = "tbwatch"; el.className = "tbwatch"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Party fight");
        el.addEventListener("click", (ev) => {
          const b = ev.target.closest("button"); if (!b) return;
          const id = el.dataset.id;
          if (b.dataset.tbwclose) { watchClosed[id] = true; el.remove(); return; }
          if (b.dataset.tbmove) { const rd = +el.dataset.round; store.change("tbf", id, (x) => (x ? { ...x, reply: { pid: getMe(), move: b.dataset.tbmove, round: rd } } : x)); el.querySelector(".tbw-turn")?.classList.add("sent"); }
        });
        document.body.appendChild(el);
      }
      el.dataset.id = d.id; el.dataset.round = d.round;
      const myTurn = d.turn && d.turn.pid === me && !(d.reply && d.reply.round === d.round) && d.turn.until > Date.now();
      const opts = [["attack", " Attack"], ["power", " Power attack"], ["guard", " Guard"], ...(d.turn?.heals ? [["heal", "✚ Heal the leader"]] : []), ...(d.turn?.pots ? [["potion", " Potion"]] : [])];
      const lead = esc(d.ownerName || "your leader");
      const foeN = d.waves > 1 ? ` <small>foe ${d.wave} of ${d.waves}</small>` : "";
      el.innerHTML = `<div class="tbw-in">
        <div class="tbw-head"><b> Fighting beside ${lead}</b><span>Round ${d.round || 1}</span></div>
        <div class="tbw-foe"><b>${esc(d.foe)}${foeN}</b>${bar(d.ehp, d.ehpMax, "foe")}</div>
        <div class="tbw-team"><div class="tbw-m"><span>${lead} ⚑</span>${bar(d.hp, d.hpMax, "hp")}</div>${(d.allies || []).map((a) => `<div class="tbw-m${a.down ? " down" : ""}${a.pid === me ? " me" : ""}"><span>${esc(a.name)}${a.pid === me ? " (you)" : ""}${a.down ? " · down" : ""}</span>${bar(a.hp, a.hpMax, "hp")}</div>`).join("")}</div>
        <div class="tbw-log">${(d.log || []).map((t) => `<p>${esc(t)}</p>`).join("")}</div>
        ${d.done ? `<div class="tbw-end ${d.won ? "won" : "lost"}"><b>${d.won ? "Victory!" : "Defeated…"}</b><button class="btn pri" data-tbwclose="1">Continue</button></div>`
          : myTurn ? `<div class="tbw-turn"><b>Your turn</b> <small class="num">${Math.max(0, Math.ceil((d.turn.until - Date.now()) / 1000))}s</small><div class="tbaskb">${opts.map(([k, l]) => `<button class="btn" data-tbmove="${k}">${l}</button>`).join("")}</div></div>`
          : `<p class="tbw-wait">${d.turn ? ` ${esc(d.turn.name)} is choosing…` : `${lead} is fighting. Your turn comes up in the turn order.`}</p>`}
      </div>`;
    });
  }

  /* sharedfight.js: open a teammate's view of a fight, and redraw it when the leader's phone sends news */
  function redraw(sess, state) { if (ui && ui.sess === sess && open) render(state || sess.advance()); }
  return { T, stats, cost, aiPick, targetOrder, Session, simulate, call, enabled, init, remoteFor, watchTurns, safeSave, zoneOf, play, redraw, fightState, voice, FOE_KEYS, BUFF_KEYS, costTxt, costHTML, base, close: () => { if (open) close(); }, get open() { return open; }, get session() { return open && ui ? ui.sess : null; }, ATK_SP, MAX_ACTS, MAX_POTS, REPEAT, HIT_CAP, FOE_HP, PARTY_HP, TURN_SECONDS, syncInPlace, _origRun: origRun };
})();
