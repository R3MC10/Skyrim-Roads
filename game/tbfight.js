/* Turn-based fights with initiative and action points. [OURS module]
   Remigiusz: "Let's make fights really turn based; turn order should be initiative based. Within combat there should be
   action points that grow with skills we already have; same for initiative. Followers and summons do their turns
   automatically." Survey: you play your own turns (with an Auto button), AP from Athletics + Stamina, extra spell AP from
   Magicka + Alteration, initiative from Acrobatics + Sneak (heavy armour slows you), perks that add AP/initiative;
   balanced so fights don't end quickly; party fights harder; in a party each player plays their own turns live.

   How it fits the engine: every fight in the game is still a G.Fight. The old instant `run()` is kept for sims, the arena
   and tests. In the app, TB.call(S, fn, done) runs a game action (road encounter, dungeon room, quest, raid...). When the
   action reaches `fight.run()`, the action is paused, the fight is played turn by turn on screen, and then the action is
   re-run from a snapshot with the same dice up to the fight, which now "finishes" instantly with the played result.
   So loot, death, quests and XP all go through the exact same code as before.

   Each round: everyone rolls initiative (base + d10); you spend AP on actions (weapon by type, power attacks, guard,
   spells by tier, shouts, potions, flee); leftover AP becomes guard. Followers, summons, thralls and party members act on
   their own initiative; real players in your party pick their own move on their own phone (60 s, then Auto).
   No one-shots: a single blow can't take more than 40% of a strong target's health, except a finishing blow.
   The AI is reached through one adapter, TB.aiPick(fight, actor), which uses COMBATAI.decide(fight, actor, settings)
   when another module provides it, otherwise the fight's own choice (Smart AI or your custom tactics). */
const TB = (() => {
  // ------------------------------------------------------------------ numbers (tuned with tests/sim_tbfight.js)
  const WCOST = { dagger: 2, fist: 2, sword: 3, axe: 3, mace: 3, spear: 3, staff: 3, greatsword: 4, battleaxe: 4, warhammer: 4, bow: 4, crossbow: 5 };
  const TIERC = { Novice: 2, Apprentice: 3, Adept: 4, Expert: 5, Master: 6 };
  const HIT_CAP = 0.4;          // max share of a strong target's health one blow can take
  /* foe toughness and actions per round, by kind of foe (tuned with the sim in tests/test_tbfight.js) */
  const T = { hp: { normal: 2.0, tough: 2.6, boss: 3.0 }, acts: { normal: 2.4, tough: 2.5, boss: 2.5 },
    rounds: { normal: 8, tough: 12, boss: 16 },                          // how long a fight should roughly last
    min: { normal: 1.2, tough: 1.5, boss: 1.8 }, max: { normal: 6, tough: 7, boss: 8 } };   // bounds on the health boost
  const FOE_HP = T.hp.normal;
  const PARTY_HP = 0.45;        // +45% foe health per extra real player in the fight
  const MAX_ROUNDS = 40;
  const MP_REGEN = 1.6, SP_REGEN = 1.4;
  const TURN_SECONDS = 60;      // a real player's turn in a party fight, then Auto
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const d10 = () => 1 + Math.floor(Math.random() * 10);

  /* your action points, spell action points and initiative (what the screen shows; the skill info texts quote these) */
  function stats(s, f) {
    const ath = G.skill(s, "Athletics"), acro = G.skill(s, "Acrobatics"), snk = G.skill(s, "Sneak"), alt = G.skill(s, "Alteration");
    const st = G.maxStamina(s), mg = G.maxMagicka(s);
    const ap = clamp(6 + Math.floor(ath / 40) + Math.floor(Math.max(0, st - 150) / 150) + pfx(s, "tbap"), 4, 11);
    const spellAp = clamp(Math.floor(alt / 50) + Math.floor(Math.max(0, mg - 100) / 150) + pfx(s, "tbspap"), 0, 3);
    let heavy = 0, medium = 0;
    for (const a of Object.values(f?.armor || {})) { if (a.type === "heavy") heavy++; else if (a.type === "medium") medium++; }
    const init = Math.round(10 + acro / 8 + snk / 16 - (2 * heavy + 0.5 * medium) * (1 - Math.min(1, pfx(s, "tbheavy"))) + pfx(s, "tbinit"));
    return { ap, spellAp, init, heavy };
  }
  const spellOf = (a) => { const [k, arg] = a.split(":"); return k === "spell" || k === "dual" ? D.SPELLS[arg] : k === "scroll" ? D.SPELLS[D.ITEMS[arg]?.spell] : null; };
  const tierOf = (id, sp) => sp?.level || (typeof TOMES !== "undefined" && TOMES.level ? TOMES.level(id) : "Novice");
  /* AP cost of an action */
  function cost(f, a) {
    if (a === "attack") return WCOST[f.wt] || 3;
    if (a === "power_attack") return (WCOST[f.wt] || 3) + 2;
    if (a === "block") return 2;
    if (a === "flee") return 99;
    const [k, arg] = a.split(":");
    if (k === "spell" || k === "dual") { const c = TIERC[tierOf(arg, D.SPELLS[arg])] || 3; return k === "dual" ? c + 2 : c; }
    if (k === "scroll") return 2;
    if (k === "shout" || k === "power") return 2;
    if (k === "potion") return 1;
    return 3;
  }
  const isSpell = (a) => /^(spell|dual|scroll):/.test(a);

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
      this.ap = 0; this.spAp = 0; this.cur = null; this.done = false; this.waiting = null;
      this.lines = { me: [], them: [], a: null };   // this round's log line for the fight log
      this.hitters = 0;
      this.players = Math.min(7, f.allies.filter((a) => a.player && !a.follower && a.kind !== "follower").length);   // real players with you (a party is up to 8; followers never count)
      // turn-based foes are tougher (you act more than once a round); real players make it harder still
      const tg = f.tags; this.kind = f.e.boss ? "boss" : tg.has("elite") || f.e.danger === "high" ? "tough" : "normal";
      // the foe gets enough health for a fight of about T.rounds rounds against what you (and friends) deal a round,
      // within bounds, so fights don't end in two rounds at one level and drag on at another
      const dpr = this.estimate(f);
      const base = Math.max(1, f.ehp), kk = dpr > 0 ? clamp(dpr * T.rounds[this.kind] / base, T.min[this.kind], T.max[this.kind]) : T.hp[this.kind];
      const k = kk * (1 + PARTY_HP * this.players);
      f.ehp = Math.round(f.ehp * k); f.ehp0 = f.ehp; this.ehpMax = f.ehp;
      f.e.tbHp = this.ehpMax;
      f.regenMp *= MP_REGEN; f.regenSp *= SP_REGEN;   // several actions a round need a bit more breath and magicka per round
      f.tb = true;
      const t = opts.t || G.now();
      f.dark = G.isNight(t) || !!(f.wx && f.wx.aim < 1);
      f.hidden = opts.hidden != null && !opts.enemyFirst ? opts.hidden : opts.trySneak !== false && !opts.enemyFirst && Math.random() < G.hiddenChance(f.s, f.e, t);
      this.foeLevel = f.e.level ?? f.s.level;
      this.trash = f.e.danger === "low" && !f.e.boss;   // skeevers and mudcrabs can still be one-shot
    }
    /* rough damage a round from you and your allies (weapon swings in your AP, or your best damage spell) */
    estimate(f) {
      const s = f.s, st = this.st;
      let w = 0, m = 0;
      try { const sw = typeof COMBATAI !== "undefined" && COMBATAI.swing ? COMBATAI.swing(f, false) : f.weaponDamage(); w = sw * Math.max(1, Math.floor(st.ap / (WCOST[f.wt] || 3))) * 0.8; } catch (e) { w = 0; }
      for (const id of s.spells || []) {
        const sp = D.SPELLS[id]; if (!sp || sp.kind !== "damage") continue;
        try { const d = G.spellDamage(s, sp), c = Math.max(1, G.spellCost(s, sp)), ap = TIERC[tierOf(id, sp)] || 3; const casts = Math.min(Math.max(1, Math.floor((st.ap + st.spellAp) / ap)), Math.max(1, (f.mp / c) / 4)); m = Math.max(m, d * casts * 0.85); } catch (e) { /* skip */ }
      }
      const al = f.allies.reduce((a, x) => a + (x.dmg || 0), 0);
      return Math.max(w, m) + al;
    }
    emit(who, text, kind, extra = {}) { const e = { who, text, kind, round: this.round, hp: Math.max(0, Math.round(this.f.hp)), ehp: Math.max(0, Math.round(this.f.ehp)), ...extra }; this.ev.push(e); return e; }
    get over() { const f = this.f; return f.hp <= 0 || f.ehp <= 0 || !!f.endWon || this.round > MAX_ROUNDS; }
    /* initiative order for a new round */
    rollOrder() {
      const f = this.f, out = [{ id: "me", name: this.s.name || "You", init: this.st.init + d10() }];
      f.allies.forEach((al, i) => { if (!al.down) out.push({ id: "al" + i, al, name: al.name, init: (al.init || (al.player ? 9 : al.follower ? 8 : 6)) + d10() }); });
      if (f.summonTurns > 0) out.push({ id: "sum", name: "Summon", init: 6 + d10() });
      const tg = f.tags, base = 6 + Math.min(12, this.foeLevel / 4) + (tg.has("beast") ? 3 : 0) + (tg.has("big") || tg.has("construct") ? -2 : 0);
      // the foe acts 1–3 times a round (whole actions, the fraction is a chance), more with a big party
      let n = T.acts[this.kind] + Math.floor(this.players / 2); const whole = Math.floor(n); n = whole + (Math.random() < n - whole ? 1 : 0);
      for (let i = 0; i < Math.max(1, n); i++) out.push({ id: i ? "foe" + (i + 1) : "foe", name: f.e.name, init: Math.round(base) - 4 * i + d10(), extra: i > 0 });
      out.sort((a, b) => b.init - a.init || (a.id === "me" ? -1 : 1));
      return out;
    }
    startRound() {
      const f = this.f;
      this.round++; f.turn = this.round; this.order = this.rollOrder(); this.idx = 0; this.hitters = 0;
      this.lines = { me: [], them: [], a: null };
      this.emit("round", `Round ${this.round}`, "round", { order: this.order.map((o) => ({ id: o.id, name: o.name, init: o.init })) });
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
          if (!this.apSet) { this.ap = this.st.ap; this.spAp = this.st.spellAp; this.apSet = true; this.myActs = 0; }
          if (this.opts.auto || this.autoRest) { this.autoTurn(); continue; }
          return { turn: "me" };
        }
        if (o.al && o.al.player && o.al.pid && this.remote && !o.al.down && (o.al.late || 0) < 2 && (!this.remote.live || this.remote.live())) {   // a real player: their own phone picks (Auto after missing two turns)
          if (!this.waiting) { this.waiting = { pid: o.al.pid, name: o.al.name, until: Date.now() + TURN_SECONDS * 1000, al: o.al }; this.remote.ask(this, o.al); }
          if (this.waiting.move) { const m = this.waiting.move; this.waiting = null; o.al.late = 0; this.allyMove(o.al, m); this.idx++; continue; }
          if (Date.now() < this.waiting.until) return { turn: "wait", who: o.al.name, until: this.waiting.until };
          this.waiting = null; o.al.late = (o.al.late || 0) + 1; this.allyMove(o.al, "auto", true); this.idx++; continue;
        }
        this.autoActor(o); this.idx++;
      }
      return this.finish();
    }
    /* ---- your actions */
    canAfford(a) {
      const c = cost(this.f, a), pool = this.ap + (isSpell(a) ? this.spAp : 0);
      return c <= pool && (a === "flee" || this.f.affordable(a) || a === "attack");
    }
    pay(a) {
      let c = cost(this.f, a);
      if (isSpell(a)) { const u = Math.min(this.spAp, c); this.spAp -= u; c -= u; }
      this.ap -= c;
    }
    act(a) {
      if (this.cur?.id !== "me" || this.over) return null;
      const f = this.f;
      if (a === "end") return this.endTurn();
      if (a === "flee") return this.flee();
      if (!this.canAfford(a)) return { err: "Not enough action points" };
      this.pay(a);
      const before = f.ehp, myBefore = f.hp;
      let text = f.act(a);
      if (f.hidden) f.hidden = false;   // only your first strike can be a sneak attack
      text += this.capFoe(before);
      if (f.ehp < before) { text += this.flank(before); this.hitters++; }
      this.myActs++;
      this.lines.me.push(text); this.lines.a = a;
      this.emit("me", text, "me", { a, wt: f.wt, dmg: Math.max(0, Math.round(before - f.ehp)), healed: Math.max(0, Math.round(f.hp - myBefore)) });
      if (this.over) { this.apSet = false; this.idx++; return { turn: "next" }; }
      if ((this.ap <= 0 && this.spAp <= 0) || !this.anyAffordable()) return this.endTurn(true);
      return { turn: "me" };
    }
    anyAffordable() { return ["attack", "block", "potion:health"].some((a) => this.canAfford(a)) || (this.f.s.spells || []).some((id) => this.canAfford("spell:" + id)); }
    /* leftover AP become guard against the next blows (10% per point, at most 30%) */
    endTurn(auto) {
      const left = this.ap;
      this.f.tbGuard = clamp(0.1 * left, 0, 0.3);
      if (left > 0 && !auto) this.emit("me", `You hold back and keep your guard up (−${Math.round(this.f.tbGuard * 100)}% damage)`, "guard");
      this.apSet = false; this.idx++;
      return { turn: "next" };
    }
    flee() {
      const f = this.f, s = f.s;
      const ch = clamp(0.4 + G.skill(s, "Athletics") / 300 + G.skill(s, "Acrobatics") / 400 - (f.e.boss ? 0.3 : f.e.danger === "high" ? 0.15 : 0) - 0.05 * this.st.heavy, 0.05, 0.85);
      if (Math.random() < ch) { f.endWon = true; f.escaped = true; this.lines.me.push("You break away and escape"); this.emit("me", "You break away and escape!", "flee"); this.apSet = false; this.idx++; return { turn: "next" }; }
      this.ap = 0; this.spAp = 0; this.lines.me.push("You try to break away, but can't"); this.emit("me", `You try to break away, but the ${f.e.name} cuts you off (${Math.round(ch * 100)}%)`, "flee");
      return this.endTurn(true);
    }
    /* Auto: the AI plays your turn */
    autoTurn() {
      const f = this.f;
      if (this.cur?.id !== "me" || this.over) return { turn: "next" };
      if (!this.apSet) { this.ap = this.st.ap; this.spAp = this.st.spellAp; this.apSet = true; this.myActs = 0; }
      const idx0 = this.idx;
      let guard = 0;
      while (!this.over && this.idx === idx0 && guard++ < 6) {
        let a = aiPick(f, "me");
        if (!this.canAfford(a)) a = this.canAfford("attack") ? "attack" : null;
        if (!a) break;
        if (a === "block" && this.myActs > 0) break;   // guard with leftover points instead of a second raise
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
        if (f.summonTurns > 0 && f.ehp > 0) { const b = f.ehp; f.summonTurns--; f.ehp -= f.summonDmg; const t = `Your summon strikes ${Math.round(f.summonDmg)}` + this.capFoe(b) + this.flank(b); this.hitters++; this.lines.me.push(t); this.emit("sum", t, "ally"); }
        return;
      }
      if (o.al) return this.allyMove(o.al, "auto");
    }
    allyMove(al, move, timedOut) {
      const f = this.f;
      if (al.down || f.ehp <= 0) return;
      const b = f.ehp, hpB = f.hp;
      let t;
      if (al.player && move && move !== "auto") t = this.playerMove(al, move);
      else if (al.coop && typeof COOP !== "undefined") t = COOP.allyAct(f, al);
      else if (al.follower && f.ai && typeof COMBATAI !== "undefined") t = COMBATAI.followerAct(f, al);
      else { const d = al.dmg * (0.85 + Math.random() * 0.3); f.ehp -= d; t = ` · ${al.name} ${Math.round(d)}`; }
      t = String(t || "").replace(/^ · /, "");
      if (f.ehp < b) { t += this.capFoe(b) + this.flank(b); this.hitters++; }
      if (timedOut) t = `${al.name} took too long: Auto. ` + t;
      this.lines.me.push(t);
      this.emit(al.player ? "mate" : "ally", t, "ally", { name: al.name, healed: Math.max(0, Math.round(f.hp - hpB)) });
    }
    /* a real player's chosen move (their phone sent it) */
    playerMove(al, m) {
      const f = this.f;
      if (m === "power") { const d = al.dmg * 1.6 * (0.85 + Math.random() * 0.3); f.ehp -= d; al.tired = 1; return `${al.name} power attack ${Math.round(d)}`; }
      if (m === "guard") { al.guard = 1; return `${al.name} raises their guard`; }
      if (m === "heal" && al.heals > 0) { al.heals--; const mh = G.maxHealth(f.s), b = f.hp; f.hp = Math.min(mh, f.hp + (al.healAmt || 40)); return `${al.name} heals you +${Math.round(f.hp - b)}`; }
      if (m === "potion" && al.pots > 0) { al.pots--; al.hp = Math.min(al.maxHp || al.hp, al.hp + (al.potAmt || 50)); return `${al.name} drinks a potion`; }
      const d = al.dmg * (al.tired ? 0.8 : 1) * (0.85 + Math.random() * 0.3); al.tired = 0; f.ehp -= d; return `${al.name} attacks ${Math.round(d)}`;
    }
    foeAct(prefix) {
      const f = this.f;
      if (f.ehp <= 0 || f.endWon) return;
      const hpB = f.hp;
      // foes go after your healers and casters when they can (party fights)
      if (f.allies.length && !f.coverAl) { const h = f.allies.find((a) => !a.down && a.player && (a.role === "healer" || a.heals > 0)); if (h && Math.random() < 0.5) f.coverAl = h; }
      const guards = f.allies.filter((a) => a.guard); guards.forEach((a) => { a._red = a.red; a.red = Math.min(0.85, (a.red || 0) + 0.4); });
      let t = f.enemyTurn();
      guards.forEach((a) => { a.red = a._red; a.guard = 0; });
      const loss = hpB - f.hp;
      if (loss > 0 && f.tbGuard) { const back = loss * f.tbGuard; f.hp += back; t += ` (guard −${Math.round(back)})`; }
      const mh = G.maxHealth(f.s), cap = HIT_CAP * mh, loss2 = hpB - f.hp;
      if (loss2 > cap && hpB > cap) { f.hp = hpB - cap; t += " (you stay on your feet)"; }
      f.tbGuard = 0;
      this.lines.them.push(prefix + t);
      this.emit("foe", prefix + t, "foe", { dmg: Math.max(0, Math.round(hpB - f.hp)) });
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
      const f = this.f, line = { turn: this.round, rule: null, me: this.lines.me.join(" · "), them: this.lines.them.join(" · "), a: this.lines.a || "attack", wt: f.wt, tb: true };
      if (f.ai) line.ai = true;
      if (f.bleed.length && f.ehp > 0) { const b = f.bleed.reduce((x, y) => x + y.dmg, 0); f.ehp -= b; f.bleed = f.bleed.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); line.me += ` · bleeds ${Math.round(b)}`; }
      const n0 = line.me.length, t0 = line.them.length;
      if (typeof PFX !== "undefined") PFX.tick(f, line);
      if (typeof MAGIC !== "undefined" && !f.endWon) MAGIC.tick(f, line);
      if (f.pw && typeof POWERS !== "undefined") POWERS.tick(f, line);
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
      if (this.round > MAX_ROUNDS && f.hp > 0 && f.ehp > 0) { f.endWon = true; f.escaped = true; this.emit("foe", `The ${f.e.name} breaks off and withdraws`, "foe"); }
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
    if (prefs().turnBased === false) return false;
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
  const fast = () => !!prefs().tbFast;
  function init(h) { hooks = h || {}; }
  function play(sess, ctx, onDone) {
    open = true;
    ui = { sess, ctx, onDone, shown: 0, menu: null, busy: false, queue: [] };
    if (hooks.remote) sess.remote = hooks.remote;
    let el = document.getElementById("tbf");
    if (!el) { el = document.createElement("div"); el.id = "tbf"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Turn-based fight"); document.body.appendChild(el); }
    el.className = "tbf " + (typeof ART !== "undefined" && ART.style && ART.style() === "pixel" ? "pixel" : "ink");
    el.addEventListener("click", onClick);
    const r = sess.begin();
    render(r);
    if (sess.done) render({ turn: "done" });
    tickWait();
  }
  function pctBar(v, m, cls) { return `<div class="tbbar ${cls}"><i style="width:${Math.max(0, Math.min(100, 100 * v / Math.max(1, m))).toFixed(1)}%"></i></div>`; }
  function icon(o) { return o.id === "me" ? "🛡" : o.id.startsWith("foe") ? "☠" : o.id === "sum" ? "✦" : "⚑"; }
  function actionsHTML(sess) {
    const f = sess.f, s = f.s, B = (a, label, extra = "") => { const c = cost(f, a), ok = sess.canAfford(a); return `<button class="tbact ${extra}" data-tba="${esc(a)}" ${ok ? "" : "disabled"}><b>${esc(label)}</b><small>${c >= 99 ? "all AP" : c + " AP"}</small></button>`; };
    if (ui.menu === "magic") {
      const rows = (s.spells || []).filter((id) => D.SPELLS[id] && D.SPELLS[id].kind !== "utility").map((id) => {
        const sp = D.SPELLS[id], mc = typeof G.spellCost === "function" ? Math.round(G.spellCost(s, sp)) : sp.cost;
        const dual = typeof MAGIC !== "undefined" && MAGIC.dualable && MAGIC.dualable(sp);
        return `<div class="tbsp"><span class="nm el-${esc(sp.element || "none")}">${esc(sp.name)}<small>${esc(tierOf(id, sp))} · ${mc} magicka</small></span>${B("spell:" + id, "Cast")}${dual ? B("dual:" + id, "Dual") : ""}</div>`;
      }).join("") || `<p class="sub">You don't know any fighting spells yet.</p>`;
      return `<div class="tbmenu">${rows}<button class="tbact back" data-tbm="">‹ Back</button></div>`;
    }
    if (ui.menu === "items") {
      const pots = ["health", "magicka", "stamina"].map((r) => (f.findPotion(r) ? B("potion:" + r, `${r[0].toUpperCase() + r.slice(1)} potion`) : "")).join("");
      const scrolls = [...new Set(s.inv.filter((r) => D.ITEMS[r.item]?.spell && f.left(r.id) > 0).map((r) => r.item))].slice(0, 4).map((it) => B("scroll:" + it, D.ITEMS[it].name)).join("");
      const shouts = typeof POWERS !== "undefined" && f.pw ? (POWERS.known ? [] : []).join("") : "";
      return `<div class="tbmenu">${pots || scrolls ? pots + scrolls : `<p class="sub">No potions or scrolls.</p>`}${shouts}<button class="tbact back" data-tbm="">‹ Back</button></div>`;
    }
    const sh = shoutsFor(f).map(([a, n]) => B(a, n, "shout")).join("");
    return `<div class="tbgrid">${B("attack", f.wt === "bow" || f.wt === "crossbow" ? "Shoot" : "Attack")}${B("power_attack", "Power attack")}${B("block", f.shield ? "Shield up" : "Guard")}
      <button class="tbact" data-tbm="magic"><b>Magic ▸</b><small>${(s.spells || []).length} spells</small></button>
      <button class="tbact" data-tbm="items"><b>Items ▸</b><small>potions</small></button>${sh}
      ${B("flee", "Flee")}
      <button class="tbact end" data-tba="end"><b>End turn</b><small>${sess.ap > 0 ? `+${Math.min(30, sess.ap * 10)}% guard` : ""}</small></button>
      <button class="tbact auto" data-tbx="auto1"><b>Auto</b><small>this turn</small></button>
      <button class="tbact auto" data-tbx="autoall"><b>Auto ⏩</b><small>whole fight</small></button></div>`;
  }
  function shoutsFor(f) {
    if (typeof POWERS === "undefined" || !f.pw) return [];
    const out = [];
    for (const a of ["shout:fus", "shout:yol", "shout:fo", "power:racial"]) { try { if (f.affordable(a)) out.push([a, a.startsWith("shout") ? "Shout " + a.split(":")[1].toUpperCase() : "Racial power"]); } catch (e) { /* not known */ } }
    return out.slice(0, 2);
  }
  function render(state) {
    const el = document.getElementById("tbf"); if (!el || !ui) return;
    const sess = ui.sess, f = sess.f, s = f.s;
    const newEv = sess.ev.slice(ui.shown); ui.shown = sess.ev.length;
    const order = sess.order.map((o, i) => `<span class="tbini ${o.id === sess.cur?.id && !sess.done ? "now" : ""} ${i < sess.idx ? "gone" : ""} ${o.id.startsWith("foe") ? "foe" : o.id === "me" ? "me" : "ally"}" title="Initiative ${o.init}">${icon(o)} ${esc(o.name.split(" ")[0])}<i>${o.init}</i></span>`).join("");
    const pips = (n, m, cls) => Array.from({ length: m }, (_, i) => `<i class="${i < n ? "on" : ""} ${cls}"></i>`).join("");
    const allies = f.allies.filter((a) => a.hp != null).map((a) => `<div class="tbal"><small>${esc(a.name)}${a.down ? " · down" : ""}</small>${pctBar(Math.max(0, a.hp), a.maxHp || a.hpMax || Math.max(a.hp, 1), "hp")}</div>`).join("");
    const mine = state.turn === "me";
    const wait = state.turn === "wait" ? `<p class="tbwait">⏳ ${esc(state.who)} is choosing their move… <b class="num" id="tbcd">${Math.max(0, Math.ceil((state.until - Date.now()) / 1000))}s</b>, then Auto</p>` : "";
    const scene = (newEv.length || !ui.lastScene) && typeof FIGHTART !== "undefined" ? sceneFor(newEv) : "";
    const log = sess.ev.slice(-7).filter((e) => e.kind !== "round").map((e) => `<div class="tbl ${e.kind}">${e.kind === "foe" ? "☠" : e.kind === "me" || e.kind === "guard" ? "🛡" : e.kind === "tick" ? "✶" : e.kind === "end" ? "★" : "⚑"} ${esc(e.text)}</div>`).join("");
    el.innerHTML = `<div class="tbin">
      <div class="tbtop"><b>Round ${sess.round}</b><span class="tbord">${order}</span><button class="tbff ${fast() ? "on" : ""}" data-tbx="fast" aria-label="Fast foe turns">⏩</button></div>
      <div class="tbscene" id="tbscene">${scene || (ui.lastScene || "")}</div>
      <div class="tbvit"><div><small>${esc(s.name || "You")} <span class="num">${Math.max(0, Math.round(f.hp))}/${G.maxHealth(s)}</span></small>${pctBar(f.hp, G.maxHealth(s), "hp")}${pctBar(f.mp, G.maxMagicka(s), "mp")}${pctBar(f.sp, G.maxStamina(s), "sp")}</div>
        <div><small>${esc(f.e.name)} <span class="num">${Math.max(0, Math.round(f.ehp))}/${sess.ehpMax}</span></small>${pctBar(f.ehp, sess.ehpMax, "hp foe")}${statusChips(f)}</div></div>
      ${allies ? `<div class="tballies">${allies}</div>` : ""}
      <div class="tbap">${mine ? `<span>AP</span>${pips(sess.ap, sess.st.ap, "ap")}${sess.st.spellAp ? `<span>✦</span>${pips(sess.spAp, sess.st.spellAp, "sap")}` : ""}<em>Your turn</em>` : sess.done ? "" : `<em>${esc(sess.cur?.name || "")}'s turn</em>`}</div>
      ${wait}
      <div class="tblog" aria-live="polite"${log ? "" : " hidden"}>${log}</div>
      ${sess.done ? `<button class="btn pri tbdone" data-tbx="done">${f.won ? (f.escaped ? "Continue" : "Victory — continue") : "Continue"}</button>` : mine ? actionsHTML(sess) : ""}
    </div>`;
    if (scene) ui.lastScene = scene;
  }
  function statusChips(f) {
    const st = f.foeSt || {}, out = [];
    if (st.burn) out.push(`<i class="st burn">🔥${st.burn.turns ?? ""}</i>`);
    if (st.chill) out.push(`<i class="st chill">❄${st.chill.turns ?? ""}</i>`);
    if (st.shock) out.push(`<i class="st shock">⚡${st.shock.turns ?? ""}</i>`);
    if (f.eParalyzed > 0) out.push(`<i class="st para">✋${f.eParalyzed}</i>`);
    if (f.stagger) out.push(`<i class="st stag">💫</i>`);
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
    v.tbMid = !sess.done; v.tbHpMax = G.maxHealth(f.s); v.tbEhpMax = sess.ehpMax;   // fightart: stay standing between turns, bars against full health
    ui.lastHp = lines[lines.length - 1].hp; ui.lastEhp = lines[lines.length - 1].ehp;
    return FIGHTART.placeholder(v, f.s);
  }
  function step(r) {
    render(r || { turn: ui.sess.done ? "done" : ui.sess.cur?.id === "me" ? "me" : "auto" });
  }
  function onClick(ev) {
    if (!ui) return;
    const b = ev.target.closest("button"); if (!b || b.disabled) return;
    const sess = ui.sess;
    if (b.dataset.tbm !== undefined) { ui.menu = b.dataset.tbm || null; return step(); }
    if (b.dataset.tbx === "fast") { const p = prefs(); p.tbFast = !p.tbFast; try { localStorage.setItem("rotn_prefs", JSON.stringify(p)); } catch (e) { /* ignore */ } return step(); }
    if (b.dataset.tbx === "done") return close();
    if (b.dataset.tbx === "auto1") { ui.menu = null; sess.autoTurn(); return step(sess.advance()); }
    if (b.dataset.tbx === "autoall") { ui.menu = null; sess.autoRest = true; sess.autoTurn(); return step(sess.advance()); }
    if (b.dataset.tba) {
      ui.menu = null;
      let r = sess.act(b.dataset.tba);
      if (r?.err) { if (hooks.toast) hooks.toast(r.err); return; }
      if (r?.turn === "next") r = sess.advance();
      if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx(/spell|dual|scroll/.test(b.dataset.tba) ? "spell" : "hit");
      return step(r);
    }
  }
  let waitT = null;
  function tickWait() {
    clearInterval(waitT);
    waitT = setInterval(() => {
      if (!ui) return clearInterval(waitT);
      const s = ui.sess;
      if (s.waiting) { const c = document.getElementById("tbcd"); if (c) c.textContent = Math.max(0, Math.ceil((s.waiting.until - Date.now()) / 1000)) + "s"; if (s.waiting.move || Date.now() >= s.waiting.until) step(s.advance()); }
    }, 500);
  }
  function close() {
    const el = document.getElementById("tbf");
    if (el) { el.removeEventListener("click", onClick); el.remove(); }
    clearInterval(waitT);
    const cb = ui?.onDone;
    if (ui?.sess?.remote) ui.sess.remote.end?.();
    ui = null; open = false;
    if (cb) cb();
  }

  // ------------------------------------------------------------------ live party turns (each player picks on their own phone)
  /* The phone that started the fight runs it and owns the record tbf/<id>; when a party member's turn comes it writes
     {turn:{pid, until}} and waits for that member's phone to write back {reply:{pid, move}}. 60 s, then Auto. */
  function remoteFor(store, myId) {
    if (!store || typeof store.put !== "function") return null;
    let fid = null, cur = null, watching = false;
    return {
      ask(sess, al) {
        cur = sess;
        fid = fid || `${myId}-${Math.floor(Date.now() / 1000)}`;
        const f = sess.f;
        store.put("tbf", fid, { owner: myId, foe: f.e.name, round: sess.round, ehp: Math.round(f.ehp), ehpMax: sess.ehpMax, turn: { pid: al.pid, until: sess.waiting.until, name: al.name, heals: al.heals || 0, pots: al.pots || 0 }, log: sess.ev.slice(-4).map((e) => e.text), t: Date.now() / 1000 });
        if (!watching && store.watch) { watching = true; store.watch("tbf", (docs) => { const s2 = cur, d = fid && docs.find((x) => x.id === fid); if (s2 && d?.reply && s2.waiting && d.reply.pid === s2.waiting.pid && d.reply.round === s2.round) s2.waiting.move = d.reply.move; }); }
      },
      live: () => !!store.online,
      end() { if (fid) store.remove?.("tbf", fid); fid = null; cur = null; },
    };
  }
  /* the member's side: when a fight record asks for my move, show a small picker */
  function watchTurns(store, getMe) {
    if (!store?.watch) return;
    store.watch("tbf", (docs) => {
      const me = getMe(); if (!me) return;
      const d = docs.find((x) => x.turn && x.turn.pid === me && !(x.reply && x.reply.round === x.round) && x.turn.until > Date.now());
      const el = document.getElementById("tbask");
      if (!d) { if (el) el.remove(); return; }
      if (el && el.dataset.k === `${d.id}:${d.round}`) return;
      const box = el || document.createElement("div"); box.id = "tbask"; box.className = "tbask"; box.dataset.k = `${d.id}:${d.round}`;
      const opts = [["attack", "⚔ Attack"], ["power", "💥 Power attack"], ["guard", "🛡 Guard"], ...(d.turn.heals ? [["heal", "✚ Heal the leader"]] : []), ...(d.turn.pots ? [["potion", "🧪 Potion"]] : []), ["auto", "🧠 Auto"]];
      box.innerHTML = `<b>Your turn vs ${esc(d.foe)} (round ${d.round})</b><div class="sub">${esc((d.log || []).slice(-2).join(" · "))}</div><div class="tbaskb">${opts.map(([k, l]) => `<button class="btn" data-tbmove="${k}">${l}</button>`).join("")}</div>`;
      box.onclick = (ev) => { const b = ev.target.closest("[data-tbmove]"); if (!b) return; store.change("tbf", d.id, (x) => ({ ...x, reply: { pid: me, move: b.dataset.tbmove, round: d.round } })); box.remove(); };
      if (!el) document.body.appendChild(box);
    });
  }

  return { T, stats, cost, aiPick, targetOrder, Session, simulate, call, enabled, init, remoteFor, watchTurns, safeSave, get open() { return open; }, WCOST, TIERC, HIT_CAP, FOE_HP, PARTY_HP, TURN_SECONDS, syncInPlace, _origRun: origRun };
})();
