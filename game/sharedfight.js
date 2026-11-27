/* Shared party fights: everyone in the party plays the same fight on their own full fight screen. [OURS module]
   Remigiusz: "currently players who follow a leader play combat as some follower. combat should be the same for
   everyone. everyone see the same combat (fully synced) everyone performs full actions. Minions or followers act on
   their own."

   How it works: the leader's phone still runs the fight (tbfight.js Session) and keeps the record tbf/<id> up to date.
   Since v2 that record carries everything a teammate's phone needs: the foe and what's on it (burning, stunned, its
   raised shield...), everyone's health and buffs, the turn order, whose turn it is, and the last events.
   On a teammate's phone this module opens the normal fight screen with a Mirror session: the same foe, the same health
   bars and log, the leader and the others shown as teammates. When the leader's phone says it's your turn, you play it
   with your own moves, spells, potions, shouts, magicka, stamina and health, exactly like your own fights.
   [initiative] Heroes side by side in the turn order share a turn: the record lists every player it waits for
   (turns: [...]), so everyone in the group plays at the same time. No timer: the leader's phone waits for everyone
   (it can skip someone who's gone quiet for 30 s). Your phone tells it you're there (tbf/<id>~<pid>~b) when your turn
   starts and after each move. Until you make your first move
   your screen keeps taking the leader's news (what the others just did to the foe).
   When your turn ends, the foe's new state, your health, guard, buffs you cast on others, your summon and your lines
   go back in one reply record (tbf/<id>~<you>); the leader's phone takes it over (Session.applyRemote) and carries on.
   Followers and summons are played by the AI on the leader's phone; they're only ever knocked down.
   At the end each player's own phone applies its own result: potions used, skill XP, health (knocked down: you get back
   up at 10%). Loot still goes through the party's share as before. No word from the leader for 120 s: the fight breaks
   off. Old phones without this module keep the small "Fighting beside" box (tbfight.js watchTurns). */
const SHAREDFIGHT = (() => {
  const SILENT = 120;          // seconds without news from the leader before the fight breaks off
  const EARLY = 3000;          // your turn ends itself a moment before the leader's phone stops waiting
  let hooks = {}, store = null, mir = null, watchT = null, watching = false;
  const closed = {};
  const clone = (o) => (o == null ? o : typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  const escRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  /* a teammate's view of the leader's fight. It never runs the foe or anyone else: the leader's phone does. */
  class Mirror extends (typeof TB !== "undefined" ? TB.Session : class {}) {
    constructor(f, d, me, send) {
      super(f, { trySneak: false, hidden: false });
      this.mirror = true; this.me = me; this.fid = d.id; this.send = send;
      this.ev = []; this.seen = -1; this.myTurn = null; this.doneTid = null; this.until = 0;
      this.byKey = new Map(); this.lastRound = 0; this.heard = Date.now(); this.lastT = null;
      f.hidden = false; f.allies = []; f._downed = [];
      this.sync(d);
    }
    get over() { if (this.myTurn) this.aimLive(); return this.done || (!!this.myTurn && (this.f.ehp <= 0 || !!this.f.endWon || this.f.hp <= 0)); }
    /* [fightsync] with foes in rows, the one loaded here may already be down while others still stand (a follower or a
       burn finished it between two records): aim at one still standing, or every move of this turn did nothing and the
       turn hung until the leader skipped it */
    aimLive() {
      const f = this.f, fd = this.field;
      if (!fd || f.ehp > 0 || !Array.isArray(fd.foes)) return;
      const live = fd.foes.filter((x) => !x.down && x.hp > 0); if (!live.length) return;
      const t = live.find((x) => x.i === fd.tgt) || live[0];
      fd.tgt = t.i; fd.cur = t.i; f.ehp = t.hp;
      if (this.t0) this.t0.ehp = t.hp;   // the turn's damage counts from this foe's health, not from the one that fell
    }
    begin() { return this.advance(); }
    advance() {
      if (this.done) return { turn: "done", won: this.f.won };
      if (this.myTurn) return { turn: "me" };
      const w = this.waitOn;
      return w ? { turn: "wait", who: w.name, until: w.until } : { turn: "them" };
    }
    /* [fightsync] the leader's phone still waits for a turn we already sent (the reply got lost on the way): send it
       again. Still hasn't heard we have our turn: say so again. The leader takes a turn once (by its tid), so a repeat
       can never land twice. */
    resend(mineT) {
      const now = Date.now();
      this.lastMineT = mineT;   // tick() keeps trying between records
      if (!mineT || !mineT.tid) return;
      if (this.lastReply && mineT.tid === this.doneTid && now - (this.resentAt || 0) > 2000) {
        this.resentAt = now; this.resends = (this.resends || 0) + 1;
        try { this.send && this.send({ ...this.lastReply, again: this.resends, t: now / 1000 }); } catch (e) { /* offline: the next record tries again */ }
      } else if (this.myTurn && this.myTurn.tid === mineT.tid && !mineT.ack && now - (this.beatAt || 0) > 2000) this.beat();
    }
    /* every second (mount): no record came in, but the last one still waited for our turn: send it again */
    tick() { if (!this.done && this.lastMineT) this.resend(this.lastMineT); }
    /* the leader's phone sent news */
    sync(d) {
      const f = this.f, me = this.me;
      if (!d || this.done) return;
      if (typeof PARTYSPELLS !== "undefined") PARTYSPELLS.learn(d.spells, f.s);   // the crafted spells cast in this fight (partyspells.js)
      if (typeof CHANNEL !== "undefined") CHANNEL.fromHost(this, d);   // [channel] teammates preparing a move: their bars and poses, results from the leader's phone
      if (d.t !== this.lastT) { this.lastT = d.t; this.heard = Date.now(); }
      this.host = d.owner; this.hostName = d.ownerName || "Your leader";
      if (d.diff && typeof DIFF !== "undefined") DIFF.adopt(f, d.diff);   // the leader's difficulty snapshot (difficulty.js)
      const myName = f.s.name || "You";
      // the events since last time, as you see them
      for (const e of d.evs || []) {
        if (e.n <= this.seen) continue;
        this.seen = e.n;
        if (e.by === me || e.kind === "end") continue;   // your own moves are already on your screen
        this.ev.push(this.view(e, myName));
      }
      const ts = d.turns || (d.turn ? [d.turn] : []), mineT = ts.find((t) => t.pid === me) || null, other = ts.find((t) => t.pid !== me) || null;   // a shared turn waits for several players at once
      this.resend(mineT);
      if (this.myTurn && mineT?.tid !== this.myTurn.tid) { this.myTurn = null; this.until = 0; }   // the leader's phone moved on without you (too late)
      const fresh = this.myTurn && !this.moved();   // your turn, no move made yet: the others' moves still show
      if (!this.myTurn || fresh) {
        if (d.round > this.lastRound) {   // a new round: your stamina and magicka come back, like in your own fights
          if (this.lastRound) { f.sp = Math.min(G.maxStamina(f.s), f.sp + f.regenSp); f.mp = Math.min(G.maxMagicka(f.s), f.mp + f.regenMp); f.slowed = Math.max(0, (f.slowed || 0) - 1); }
          this.lastRound = d.round;
        }
        this.round = d.round || 1; f.turn = this.round;
        this.wave = d.wave || 1; this.waves = d.waves || 1; this.ehpMax = d.ehpMax || this.ehpMax; this.kind = d.kind || this.kind;
        if (d.foeE) { if (!f.e || f.e.name !== d.foeE.name || f.e.arch !== d.foeE.arch) this.ehpMax = d.ehpMax || this.ehpMax; TB.syncInPlace(f.e, d.foeE); }
        f.ehp = d.ehp;
        if (d.endWon) f.endWon = d.endWon; else delete f.endWon;   // [fightsync] a foe your own spell turned or banished: the leader's phone has the last word
        for (const k of TB.FOE_KEYS) if (d.fs && k in d.fs) f[k] = clone(d.fs[k]); else if (k !== "ehp0") delete f[k];
        if (!(f.ehp0 > 0)) f.ehp0 = this.ehpMax;
        if (typeof FOEFIELD !== "undefined") FOEFIELD.mirror(this, d.field);   // [rows] the foes' rows as the leader's phone has them
        this.hitters = d.hitters || 0;
        this.roster(d.roster || []);
        if (typeof MOUNTFIGHT !== "undefined") MOUNTFIGHT.mirror(this, d);   // your horse and everyone else's, as the leader's phone has them
        const was = new Map((this.order || []).filter((o) => o.uid).map((o) => [o.uid, o]));   // when a lost turn first showed here (the cross fades in, then folds away)
        this.order = (d.order || []).map((o) => { const p = was.get(o.uid) || {}, now = Date.now();
          return { ...o, id: o.pid === me ? "me" : o.id === "me" ? "host" : o.id, name: o.pid === me ? myName : o.name, skipAt: o.skip && o.done ? p.skipAt || now : undefined, outAt: o.out ? p.outAt || now : undefined }; });   // the shared turns, skips and slots come along (initiative.js)
        this.idx = d.idx || 0; this.gnow = d.gnow || 0; this.next = d.next || [];
        if (fresh && this.t0) { this.t0.ehp = f.ehp; this.t0.hitters = this.hitters; this.t0.snap = this.snap(); this.t0.fs = this.foeSnap(); return d.done ? this.end(d.won ? (d.escaped ? "escaped" : "won") : "lost") : undefined; }
        const c = d.cur;
        this.cur = c ? { id: c.pid === me ? "me-wait" : c.id === "me" ? "host" : c.id, name: c.pid === me ? myName : c.name } : null;
        // the leader's clock may differ from yours: count from when the record was written
        // until 0: no timer (it waits for everyone). An older leader's phone still sends a deadline: count from when the record was written
        const left = (t) => (!t ? 0 : !t.until ? Infinity : Date.now() + Math.min(90000, t.until - (d.t ? d.t * 1000 : Date.now())));
        const uo = left(other), um = left(mineT);
        this.waitOn = other && uo > Date.now() && !mineT ? { ...other, until: uo === Infinity ? 0 : uo, name: ts.filter((t) => t.pid !== me).map((t) => t.name).join(", ") } : null;
        if (mineT && mineT.tid && mineT.tid !== this.doneTid && um > Date.now() + 1000 && !this.meDown) this.startTurn({ ...mineT, until: um === Infinity ? 0 : um });
      }
      else if (d.done) f.ehp = d.ehp;   // it ended while you were mid-turn: the leader's phone has the last word
      if (d.done) this.end(d.won ? (d.escaped ? "escaped" : "won") : "lost");
      else this.check(d);
    }
    /* [fightsync] after taking the leader's record in (and not halfway through a move of ours), our screen should show
       exactly what the leader's does. If it doesn't, take the whole record in again (and say so on screen for a moment) */
    mine(d) {
      const f = this.f, me = this.me;
      const roster = (d.roster || []).map((r) => {
        if (r.k === "p:" + me || (r.pid && r.pid === me)) return { k: r.k, hp: this.meDown ? 0 : f.hp, down: this.meDown };
        const a = this.byKey.get(r.k); return a ? { k: r.k, hp: a.hp, down: !!a.down } : { k: r.k, hp: -1 };
      });
      return TB.fingerprint({ ehp: f.ehp, round: this.round, wave: this.wave, endWon: f.endWon, roster });
    }
    check(d) {
      if (!d.fp || !TB.fingerprint || this.done || (this.myTurn && this.moved())) return true;
      if (this.mine(d) === d.fp) { if (this.resyncing && Date.now() - this.resyncing > 1500) this.resyncing = 0; return true; }
      this.resyncing = Date.now(); this.desyncs = (this.desyncs || 0) + 1;
      const keep = this.myTurn; this.myTurn = null; this.lastRound = 0;   // take everything in, as if new
      try { this.lastT = null; this.sync({ ...d, fp: null }); } finally { if (keep && !this.myTurn && !this.done) this.myTurn = keep; }
      return this.mine(d) === d.fp;
    }
    /* one of the leader's events, as you see it: "You hit" becomes "Alfa hits", blows on you are yours */
    view(e, myName) {
      const host = this.hostName, me = this.me;
      let kind = e.kind, text = TB.voice(e.text, host), dmg = e.dmg, name = e.name;
      if (kind === "foe") { dmg = e.hits?.[me] || 0; if (dmg) text = text.replace(new RegExp(`\\b${escRe(myName)}\\b`), "you"); }
      else if (kind !== "round" && kind !== "tick") { if (e.who === "me" || e.who === "sum" || !name) name = e.who === "sum" ? `${host}'s summon` : host; kind = "ally"; }
      const hp = e.ph && e.ph[me] != null ? e.ph[me] : Math.max(0, Math.round(this.f.hp));
      const o = { who: e.who === "me" ? "host" : e.who, text, kind, round: e.round, hp, ehp: e.ehp, dmg, healed: 0, name };
      for (const k of ["a", "wt", "wave", "order"]) if (e[k] != null) o[k] = e[k];
      return o;
    }
    /* everyone in the fight: the leader and the others as teammates on your screen, you as yourself */
    roster(list) {
      const f = this.f, me = this.me, live = [], down = [];
      for (const r of list) {
        if (r.k === "p:" + me || (r.pid && r.pid === me)) { this.meDown = !!r.down; f.hp = r.down ? 0 : r.hp; continue; }
        let a = this.byKey.get(r.k); if (!a) { a = {}; this.byKey.set(r.k, a); }
        Object.assign(a, { tbk: r.k, name: r.name, hp: r.hp, maxHp: r.hpMax, player: !!r.player, follower: !!r.follower, pid: r.pid || null, look: r.look || null, role: r.role || null, row: r.row || null, host: !!r.host, down: !!r.down, kind: r.kind || null, fid: r.fid || null });   // kind: a dog stays a dog on every phone
        for (const k of TB.BUFF_KEYS) if (r[k] != null) a[k] = clone(r[k]); else if (k !== "dmg") delete a[k];
        if (a.dmg == null) a.dmg = 0;
        (r.down ? down : live).push(a);
      }
      f.allies = live; f._downed = down;
    }
    startTurn(t) {
      const f = this.f;
      this.myTurn = { tid: t.tid, until: t.until }; this.until = t.until ? t.until - EARLY : 0; this.waitOn = null;
      this.cur = { id: "me", name: f.s.name || "You" };
      this.beginTurn();   // 3 AP for this turn, as on the leader's phone (tbfight.js)
      f.summonTurns = 0; f.tbGuard = 0;
      this.t0 = { ehp: f.ehp, hp: f.hp, ev: this.ev.length, hitters: this.hitters, ward: f.ward || 0, armor: f.armorSpell || 0, snap: this.snap(), fs: this.foeSnap() };
      this.beatN = 0; this.beat();   // tell the leader's phone you're here (after t0: a store that answers at once runs apply again)
    }
    /* everyone's health and buffs, and what's on the foe, when your turn started (the reply sends only what you changed) */
    snap() { const f = this.f, m = new Map(); for (const [k, a] of this.byKey) m.set(k, { hp: a.hp, down: !!a.down || !f.allies.includes(a), b: TB.BUFF_KEYS.map((x) => a[x] ?? null) }); return m; }
    foeSnap() { const f = this.f, o = {}; for (const k of TB.FOE_KEYS) if (f[k] !== undefined) o[k] = clone(f[k]); return o; }
    /* made a move this turn yet? */
    moved() { return !!this.t0 && (Object.keys(this.used || {}).length > 0 || this.ev.slice(this.t0.ev).some((e) => e.who === "me" && e.kind !== "tick")); }
    /* your moves: the normal ones; when your turn ends, it goes back to the leader's phone */
    act(a, tgt, mult, grade) {   // grade: how your minigame went (a Perfect adds its stack in party fights too)
      const k0 = this.meTok, r = super.act(a, tgt, mult, grade);
      if (this.myTurn && this.meTok !== k0) this.sendTurn();
      else if (this.myTurn) this.beat();   // a move made: the leader's phone knows you're still there
      return r;
    }
    autoTurn() {
      const k0 = this.meTok, r = super.autoTurn();
      if (this.myTurn && this.meTok !== k0) this.sendTurn();
      return r;
    }
    timeUp() { if (!this.myTurn) return; this.endTurn(true); this.emit("me", "You hold back and keep your guard up (out of time)", "guard"); this.sendTurn(); }
    passMe() { this.apSet = false; this.meTok++; }   // the leader's phone moves the order on
    /* "I'm here": no timer on a shared turn, so the leader's phone counts 30 s from your last move before it offers to skip you */
    beat() { if (!this.myTurn || !this.beatTo) return; this.beatAt = Date.now(); this.beatN = (this.beatN || 0) + 1; try { this.beatTo({ pid: this.me, bt: this.myTurn.tid, n: this.beatN, t: Date.now() / 1000 }); } catch (e) { /* offline: the reply still goes */ } }   // a timeout only guards, and says so (noautoplay.js)
    /* everything your turn did, for the leader's phone */
    reply() {
      const f = this.f, t0 = this.t0 || { ehp: f.ehp, hp: f.hp, ev: 0, hitters: 0, ward: 0, armor: 0, snap: new Map() };
      const fs = {}; for (const k of TB.FOE_KEYS) if (f[k] !== undefined) fs[k] = clone(f[k]);
      const allies = [];
      for (const [k, a] of this.byKey) {
        const s0 = t0.snap.get(k); if (!s0) continue;
        const nowDown = !!a.down || !f.allies.includes(a), b = TB.BUFF_KEYS.map((x) => a[x] ?? null);
        if (a.hp === s0.hp && nowDown === s0.down && same(b, s0.b)) continue;
        const x = { k, hp0: s0.hp, hp: a.hp, ...(s0.down && !nowDown ? { revive: true } : {}) };
        TB.BUFF_KEYS.forEach((key, i) => { if (!same(b[i], s0.b[i]) && b[i] != null) x[key] = clone(b[i]); });
        allies.push(x);
      }
      const armorUp = (f.armorSpell || 0) > t0.armor;
      const mine = this.ev.slice(t0.ev).filter((e) => e.who === "me");
      const spells = typeof PARTYSPELLS !== "undefined" ? PARTYSPELLS.used(f.s, mine) : {};   // your crafted spells, so every phone knows them (partyspells.js)
      return { ...(Object.keys(spells).length ? { spells } : {}), pid: this.me, tid: this.myTurn?.tid || null, round: this.round, wave: this.wave, e0: t0.ehp, ehp: f.ehp, fs, fs0: t0.fs || null, ...(this.field ? { fi: this.field.tgt } : {}),
        hp0: t0.hp, hp: f.hp, hpMax: G.maxHealth(f.s), guard: f.tbGuard || 0, ap: this.myActs || 0,   // ap: what you spent (the leader checks the guard against it)
        self: { ward: (f.ward || 0) > t0.ward ? f.ward : 0, armorRed: armorUp ? Math.min(0.5, f.armorSpell * 0.0012) : 0, armorT: armorUp ? 6 : 0 },   // [Skyrim] 0.12% less damage per armour point
        allies, summon: f.summonTurns > 0 ? { turns: f.summonTurns, dmg: f.summonDmg, name: f.summonName || "summon" } : null,
        hits: this.hitters - t0.hitters, fled: !!f.ranAway, wt: f.wt, ...(f.endWon ? { endWon: f.endWon } : {}),
        ev: this.ev.slice(t0.ev).filter((e) => e.who === "me").map((e) => ({ text: e.text, a: e.a || null, dmg: e.dmg || 0 })).slice(0, 12), t: Date.now() / 1000 };
    }
    sendTurn() {
      if (!this.myTurn) return null;
      const r = this.reply(), f = this.f;
      if (f.mount && typeof MOUNTFIGHT !== "undefined") r.mt = MOUNTFIGHT.out(f.mount);   // you got on / off your horse this turn
      this.doneTid = this.myTurn.tid; this.lastReply = r; this.myTurn = null; this.until = 0; this.apSet = false;
      this.cur = { id: "me-wait", name: f.s.name || "You" };
      f.tbGuard = 0; f.summonTurns = 0;   // your guard and your summon now live on the leader's phone
      try { this.send && this.send(r); } catch (e) { console.warn("shared fight reply", e); }
      if (f.ranAway) this.end("fled");
      return r;
    }
    end(how) {
      if (this.done) return;
      const f = this.f;
      this.done = true; this.myTurn = null; this.until = 0;
      f.won = how === "won" || how === "escaped" || how === "fled"; f.escaped = how !== "won" && how !== "lost";
      if (how === "broke") this.endLabel = "Broke off";
      if (f.hp <= 0 || this.meDown) f.hp = Math.max(1, Math.round(G.maxHealth(f.s) * 0.1));   // knocked down: you get back up after the fight, badly hurt
      f.tbRounds = this.round; f.tbPlayed = true;
      this.how = how;
      const txt = { won: "Victory!", escaped: `${this.hostName} got the party away.`, fled: "You got away.", lost: "Defeated…", broke: `No word from ${this.hostName}: the fight broke off.` }[how] || "The fight is over.";
      this.emit("end", txt, "end");
    }
  }

  /* build a teammate's view of the leader's fight record d (also used by tests/test_tbfight.js) */
  function build(S, d, send) {
    const foe = clone(d.foeE) || { name: d.foe || "Foe", health: d.ehpMax || 100, damage: 8, level: S.level, tags: [] };
    foe.hp = d.ehp;
    const f = new G.Fight(S, foe);
    if (typeof PARTY !== "undefined") PARTY.clear();   // not your fight to share spoils from
    f.thrallFought = false;
    return new Mirror(f, d, S.id, send);
  }
  /* the end: your own phone applies your own result */
  function finish(sess) {
    const S = hooks.S ? hooks.S() : null, f = sess.f;
    closed[sess.fid] = sess.how === "broke" ? { at: Date.now() } : true; if (mir && mir.sess === sess) mir = null;   // [fightsync] broke off (no word for 2 minutes): if the leader's fight is still going when you're back, you join it again
    if (!S || f.s !== S) return;
    f.allies = []; f._downed = []; f.followerDown = null; f.thrallFought = false;
    let msgs = [];
    // a lost party fight costs nothing (defeat.js): your save never takes its results, so you just get back up as you were
    if (sess.how === "broke") msgs = ["You lost touch with your party. Your result comes in when you're back."];   // [fightsync] nothing taken in yet: the real ending, once you hear it, is taken in once
    else if (sess.how !== "lost") { try { msgs = f.apply() || []; } catch (e) { console.warn("shared fight result", e); } }
    else msgs = ["You lose nothing: the party votes on what to do next."];
    if (hooks.persist) hooks.persist(true);
    const head = sess.how === "won" ? "Victory! " : sess.how === "lost" ? "The party was beaten. " : "";
    if (hooks.toast) hooks.toast(head + (msgs.slice(0, 2).join(" ") || (sess.how === "broke" ? "The fight broke off." : "")));
    if (hooks.after) hooks.after();
  }
  function open(d) {
    const S = hooks.S();
    const sess = build(S, d, (r) => store.put("tbf", `${d.id}~${S.id}`, r));
    sess.beatTo = (b) => store.put("tbf", `${d.id}~${S.id}~b`, b);
    mir = { fid: d.id, sess };
    document.getElementById("tbwatch")?.remove();
    TB.play(sess, {}, () => finish(sess));
    if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx("hit");
  }
  /* [fightsync] a small note on the fight screen while this phone catches up with the party (its screen didn't match
     the leader's and was fixed, or a turn of ours went out again because the first one got lost on the way) */
  function showSync(sess) {
    if (typeof document === "undefined") return;
    const root = document.getElementById("tbf"); if (!root) return;
    const now = Date.now(), busy = (sess.resyncing && now - sess.resyncing < 2500) || (sess.resentAt && now - sess.resentAt < 2500);
    let el = document.getElementById("tbresync");
    if (busy && !el) { el = document.createElement("div"); el.id = "tbresync"; el.className = "tbresync"; el.setAttribute("role", "status"); el.textContent = "Catching up with your party…"; root.appendChild(el); }
    else if (!busy && el) el.remove();
  }
  function onDocs(docs) {
    const S = hooks.S ? hooks.S() : null; if (!S) return;
    const me = S.id, nowS = Date.now() / 1000;
    if (mir) {
      const sess = mir.sess, d = docs.find((x) => x.id === mir.fid);
      if (sess.done) return;
      if (!d) { sess.end("broke"); TB.redraw(sess); return; }
      // [fightsync] the leader's phone sends its record again while it waits (a lost one used to hang a turn): an
      // unchanged repeat only refreshes "we heard from the leader" and the repeats; it doesn't redraw the screen under your thumb
      const { t, _v, _by, ...body } = d, key = JSON.stringify(body);
      const same = key === mir.key; mir.key = key;
      sess.sync(d); if (!same || sess.done) TB.redraw(sess); showSync(sess);
      return;
    }
    if (TB.open) return;   // in a fight of your own: the leader's record waits (the heartbeat brings it back)
    const shut = (x) => { const c = closed[x.id]; return c === true || (!!c && !x.done && (x.t || 0) * 1000 <= c.at); };   // broke off: back in when it moves on, or for its ending
    const brokeOff = (x) => !!closed[x.id] && closed[x.id] !== true;   // we broke off this one: we still want its real ending
    const d = docs.find((x) => x.v >= 2 && x.owner !== me && (x.pids || []).includes(me) && (!x.done || brokeOff(x)) && (brokeOff(x) || nowS - (x.t || 0) < SILENT) && !shut(x));
    if (d) open(d);
  }
  function mount(h) {
    hooks = h || {}; store = h.store;
    if (!store?.watch || typeof document === "undefined") return;
    if (!watching) { watching = true; store.watch("tbf", onDocs); }   // once, even if the game mounts again
    clearInterval(watchT);
    watchT = setInterval(() => {   // the leader went quiet (checked every second: the "catching up" note clears in time too)
      if (!mir || mir.sess.done) { document.getElementById("tbresync")?.remove(); return; }
      mir.sess.tick(); showSync(mir.sess);
      if (Date.now() - mir.sess.heard > SILENT * 1000) { mir.sess.end("broke"); TB.redraw(mir.sess); }
    }, 1000);
  }
  /* tbfight.js asks: is this record mine to show? (v2 records open the full fight screen instead of the small box) */
  const claims = (x) => !!store && !!x && x.v >= 2;
  return { Mirror, build, finish, mount, claims, SILENT, _onDocs: (d) => onDocs(d), _closed: closed, get active() { return mir ? mir.sess : null; } };
})();
