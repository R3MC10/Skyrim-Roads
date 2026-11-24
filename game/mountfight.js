/* Mounted combat in turn-by-turn fights (and the quick ones). [OURS module]
   A player: "players want mounted combat in combat". horseback.js already lets you open a road fight with a charge
   from the saddle. This module builds the rest on top of it (it takes over HORSEBACK.strike / enemyTurn / upAt and
   wraps engage / after / tick, so horseback.js itself stays as it was):
   - Outdoors only: a road fight (the only place HORSEBACK.engage is called) with your horse beside you. Riding when it
     starts: you start in the saddle. Walking beside it: it stands by and you can get on.
   - Mount / Dismount are moves in the fight: Mount costs 4 AP and 20 stamina (Steady Steed: 3 AP), Dismount 1 AP.
     Getting back on gives you a fresh charge.
   - Charge: your first blow from the saddle is a sure hit, ×1.4 (spear ×1.7), and can knock the foe back (it loses
     its next move). Cavalry Charge: +30% and it always knocks them back.
   - Trample: small foes (wolves, skeevers, mudcrabs...) also take the hooves: +12% (Trample perk: +32% and it can
     knock them down).
   - Up high, foot soldiers with swords and axes have a hard time reaching you (10% of their blows go wide), but
     archers, mages, spearmen and big beasts go for your horse more often and can drag you out of the saddle.
   - No two-handed power attacks, no dual casting and no Master spells in the saddle; a two-hander swings clumsily
     (−15%); arrows go wide 15% of the time unless you have Horse Archer.
   - The horse has its own health bar. At 0 it's knocked down (it never dies): you're thrown clear (5% of your health,
     never the last of it) and staggered (−2 AP on your next turn), you fight on on foot, and afterwards
     it stays with you, downed, until it gets back up (horses.js: a few hours, a night's sleep or a stablehand).
   - Party fights: everyone's mount state and horse health travel in the leader's fight record (roster[].mt). Blows on a
     teammate's horse are rolled once, on the leader's phone; a teammate's own phone plays their charges and
     Mount / Dismount and sends the result back with their turn (reply.mt). Every phone draws the same riders.
   - Perks with real effects: Cavalry Charge (One-Handed), Horse Archer (Archery), Steady Steed and Trample (Athletics).
   Numbers are [OURS], balanced with tests/test_mountfight.js. */
const MOUNTFIGHT = (() => {
  const HB = typeof HORSEBACK !== "undefined" ? HORSEBACK : null;
  const N = {
    mountAp: 4, mountSp: 20, dismountAp: 1,
    horseP: { base: 0.1, foot: 0.05, reach: 0.18, big: 0.22 },   // a foe goes for your horse instead of you
    shy: 0.2,                                         // ...and the horse shies away
    knock: { reach: 0.06, big: 0.08 },                // a spear, an arrow, a spell or a giant drags you out of the saddle
    dodge: 0.1,                                       // swords and axes on foot can't reach you well
    fall: 0.05, stagAp: 2,
    bowMiss: 0.15, twoH: 0.85, trample: 0.12, trampleStag: 0.25, chargeStag: 0.25,
    getUp: 0.25,                                      // a knocked-down horse gets back up after the fight with this much health
    allyHp: 200,
  };
  const TWO = new Set(["greatsword", "battleaxe", "warhammer"]);
  const BIG = /giant|dragon|mammoth|centurion|lurker|troll|bear|sabre|cat|chaurus|gargoyle|atronach/i;
  const RANGED = /archer|bow|hunter|marksman|ranger|sniper|mage|wizard|necromancer|conjurer|warlock|hagraven|witch|thalmor|justiciar|sorcer|priest|lich|shaman|caster/i;
  const REACH = /spear|pike|lance|halberd|guard|legion|stormcloak|imperial|soldier|dawnguard/i;
  const SMALL = /skeever|wolf|mudcrab|fox|rabbit|hare|goat|dog|hound|rat\b|horker|slaughterfish|elk|deer|spider|wisp/i;
  const pfx = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) : 0);
  const mx = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (m) => m.toFixed(1).replace(/\.0$/, "");
  const hn = (m) => m?.name || "your horse";
  const owns = (a) => a === "mount" || a === "dismount";
  const COST = () => HB?.COST || { charge: 35, attack: 12, power: 20 };
  const SP_MAX = () => HB?.SP_MAX || 100;
  const coatOf = (h) => (typeof HORSES !== "undefined" && h ? HORSES.coat(h.coat)[2] : "#6b4a2e");
  const horseDowned = (s) => typeof HORSES !== "undefined" && typeof HORSES.downed === "function" && HORSES.downed(s);

  // ------------------------------------------------------------------ perks (appended to the trees; old ids untouched)
  const PERKS_ADD = [
    ["One-Handed", "cavalry_charge", "Cavalry Charge", 1, [30], ["armsman"], "A charge from the saddle hits 30% harder and always knocks the foe back (it loses its next move). [OURS]", [["mcharge", 0.3, {}]]],
    ["Archery", "horse_archer", "Horse Archer", 1, [35], ["overdraw"], "Shooting from the saddle: your arrows never go wide from the moving horse, and they do 10% more. [OURS]", [["mbow", 1, {}], ["out", 0.1, { sk: "Archery", mounted: 1 }]]],
    ["Athletics", "steady_steed", "Steady Steed", 2, [25, 55], ["long_strider"], "Your horse takes 20/40% less damage in fights, foes pull you out of the saddle half as often, foot soldiers miss you 5/10% more, and getting on costs 1 AP less. [OURS]", [["msteady", [0.2, 0.4], {}]]],
    ["Athletics", "trample", "Trample", 1, [50], ["steady_steed"], "From the saddle your horse tramples small foes (wolves, skeevers, mudcrabs...): +20% more damage and a 25% chance to knock them down. [OURS]", [["mtrample", 0.2, {}]]],
  ];
  if (typeof PERKS !== "undefined") {
    for (const [sk, id, name, ranks, req, needs, desc, fx] of PERKS_ADD) {
      const tree = PERKS.TREES[sk];
      if (!tree || PERKS.BY_ID[id]) continue;
      tree.push([id, name, ranks, req, needs, desc]);
      PERKS.BY_ID[id] = { id, name, ranks, req, needs, desc, skill: sk };
      if (typeof PFX !== "undefined" && PFX.FX) PFX.FX[id] = fx;
    }
  }

  // ------------------------------------------------------------------ what kind of foe this is, for a rider
  function foeKind(f) {
    const e = f.e || {}, n = e.name || "", tags = f.tags || new Set();
    if (tags.has("dragon") || tags.has("big") || tags.has("giant") || BIG.test(n)) return "big";
    if (e.arch === "archer" || e.arch === "mage" || tags.has("mage") || RANGED.test(n)) return "ranged";
    if (REACH.test(n) || e.wt === "spear") return "reach";
    if (tags.has("humanoid") || e.arch) return "foot";
    return "beast";
  }
  const small = (f) => foeKind(f) !== "big" && (SMALL.test(f.e?.name || "") || (f.e?.danger === "low" && !f.tags?.has?.("humanoid")));

  // ------------------------------------------------------------------ the mount state
  function fresh(hp, max, name, coat, guard = 0) {
    return { up: false, foot: false, hp, hp0: hp, max, sp: SP_MAX(), guard, charged: false, downTurn: 0, winded: false, hits: 0, ok: true, name, coat };
  }
  /* a party member riding their own horse (their card says so) gets a horse in the leader's fight */
  function allyMount(al) {
    const [hp, max, name] = Array.isArray(al.rideHp) ? al.rideHp : [N.allyHp, N.allyHp, null];
    const m = fresh(Math.max(1, +hp || N.allyHp), Math.max(1, +max || N.allyHp), name || `${al.name}'s horse`, al.ride);
    m.up = true; return m;
  }
  const origEngage = HB?.engage;
  /* a road fight starts: riding = in the saddle (horseback.js); walking beside your horse = it stands by */
  function engage(f, t) {
    const up = origEngage ? origEngage(f, t) : false, s = f.s;
    if (!f.mount && typeof HORSES !== "undefined" && HORSES.present(s) && !horseDowned(s) && !s.beastForm && !f.e?.nonlethal && !s.dungeon) {
      const hp = HORSES.hp(s, t);
      if (hp > 0) { f.mount = fresh(hp, HORSES.maxHp(s.horse), s.horse.name, coatOf(s.horse), HORSES.ARMOR[s.horse.armor || "none"]?.guard || 0); f.mount.walk = true; }
    }
    if (f.mount) { f.mount.ok = true; f.mount.name = s.horse?.name || f.mount.name; f.mount.coat = coatOf(s.horse); if (f.mount.up) f.mount.rode = true; }
    for (const al of f.allies || []) if (al.player && al.ride && !al.mt) al.mt = allyMount(al);   // teammates on their own horses
    return up;
  }

  // ------------------------------------------------------------------ your blow from the saddle (engine.js attack)
  /* returns {mult, label, sure, miss} or null when you're on foot */
  function strike(f, power, sneak) {
    const m = f.mount; if (!m?.up) return null;
    const s = f.s, wt = f.wt, bow = wt === "bow" || wt === "crossbow", C = COST();
    const BONUS = HB?.BONUS || {}, CHARGE = HB?.CHARGE || { def: 1.4, spear: 1.7 };
    let r = null;
    if (!m.charged && !sneak && ((f.turn || 0) <= 1 || m.recharge)) {   // the charge: the opening one, or after getting back on
      m.charged = true; m.recharge = false;
      if (m.sp >= C.charge) {
        m.sp -= C.charge;
        const cc = pfx(s, "mcharge"), mult = (CHARGE[wt] || CHARGE.def) * (power ? 1.15 : 1) * (1 + cc);
        const knock = cc > 0 || Math.random() < N.chargeStag; if (knock) f.stagger = true;
        m.charges = (m.charges || 0) + 1;
        return { mult, label: `Mounted charge ×${fmt(mult)}${knock ? ", knocks them back" : ""}`, sure: true };
      }
    }
    m.charged = true; m.recharge = false;
    const cost = power ? C.power : C.attack;
    if (m.sp < cost) { const first = !m.winded; m.winded = true; r = { mult: 1, label: first ? `${power ? "Power attack" : "Attack"} (${hn(m)} is winded)` : null, sure: false }; }
    else { m.sp -= cost; const mult = BONUS[wt] ?? 1; r = { mult, label: mult > 1 ? `${power ? "Power attack" : "Attack"} from the saddle` : null, sure: false }; }
    if (bow && !pfx(s, "mbow") && Math.random() < N.bowMiss) return { mult: 1, miss: "Your shot goes wide (hard to aim from a moving horse)" };
    if (TWO.has(wt)) { r.mult *= N.twoH; r.label = `${power ? "Power attack" : "Attack"} (clumsy from the saddle)`; }
    if (small(f)) {
      const tp = pfx(s, "mtrample"); r.mult *= 1 + N.trample + tp;
      r.label = `${r.label || (power ? "Power attack" : "Attack")}, ${hn(m)} tramples them`;
      if (tp > 0 && Math.random() < N.trampleStag) { f.stagger = true; r.label += " down"; }
    }
    return r;
  }

  // ------------------------------------------------------------------ foes against a rider (you, or a teammate on the leader's phone)
  /* R: { m, s (perks), who ("you" / a name), hurt(d) → damage really taken, stag() } → a log line, or null for a normal blow */
  function riderTurn(f, R) {
    const m = R.m; if (!m?.up) return null;
    const n = f.e?.name || "The foe", k = foeKind(f), steady = pfx(R.s, "msteady"), you = R.who === "you";
    const Who = you ? "You" : R.who, whoO = you ? "you" : R.who;
    const pH = k === "big" ? N.horseP.big : k === "ranged" || k === "reach" ? N.horseP.reach : k === "foot" ? N.horseP.foot : N.horseP.base;
    if (Math.random() < pH) {   // it goes for the horse
      if (Math.random() < N.shy) return `${n} lunges at ${hn(m)}, who shies away`;
      const dmg = Math.max(1, Math.round((f.e?.damage || 10) * (0.85 + Math.random() * 0.3) * 2 * (1 - (m.guard || 0)) * (1 - steady)));
      m.hp -= dmg; m.hits = (m.hits || 0) + 1;
      if (m.hp > 0) return `${n} hits ${hn(m)} ${dmg} (horse ${Math.round(m.hp)}/${m.max})`;
      m.hp = 0; m.up = false; m.down = true; m.downTurn = f.turn || 1; m.offAt = f.turn || 1;
      const fall = R.hurt(R.maxHp * N.fall); R.stag();
      return `${n} brings ${hn(m)} down! ${hn(m)} is knocked down. ${Who}${you ? "'re" : " is"} thrown clear (−${fall}) and fight${you ? "" : "s"} on foot, staggered`;
    }
    const pK = (k === "big" ? N.knock.big : k === "ranged" || k === "reach" ? N.knock.reach : 0) * (steady > 0 ? 0.5 : 1);
    if (pK && Math.random() < pK) {   // dragged or knocked out of the saddle; the horse is fine and waits nearby
      m.up = false; m.offAt = f.turn || 1;
      const fall = R.hurt(R.maxHp * N.fall); R.stag();
      const how = k === "ranged" ? `${n}'s ${f.e?.arch === "mage" || /mage|wizard|necromancer|conjurer|warlock|hagraven|witch|thalmor|justiciar|sorcer|priest|lich|shaman/i.test(n) ? "spell" : "shot"} knocks ${whoO} out of the saddle` : k === "big" ? `${n} swats ${whoO} out of the saddle` : `${n} hooks ${whoO} out of the saddle`;
      return `${how} (−${fall})! ${Who} fight${you ? "" : "s"} on foot, staggered. ${hn(m)} waits nearby`;
    }
    if (k === "foot" && Math.random() < N.dodge + steady / 4) return `${n} swings at ${whoO}, but ${hn(m)} wheels away`;
    return null;
  }
  /* the foe's turn on you (engine.js enemyTurn → HORSEBACK.enemyTurn) */
  function enemyTurn(f) {
    if (!f.mount?.up) return null;
    const mh = typeof G !== "undefined" ? G.maxHealth(f.s) : 100;
    return riderTurn(f, { m: f.mount, s: f.s, who: "you", maxHp: mh,
      hurt: (d) => { const b = f.hp; f.hp = Math.max(1, f.hp - Math.round(d)); return Math.round(b - f.hp); },   // the fall alone never finishes you
      stag: () => stagger(f) });
  }
  /* a blow aimed at a teammate who rides (engine.js, before the co-op blow) */
  function allyTurn(f, al) {
    if (!al?.mt?.up) return null;
    return riderTurn(f, { m: al.mt, s: null, who: al.name, maxHp: al.maxHp || al.hp0 || al.hp || 100,
      hurt: (d) => { const b = al.hp || 0; al.hp = Math.max(1, b - Math.round(d)); return Math.round(b - al.hp); },
      stag: () => { al.mfStag = (f.turn || 0) + 1; } });   // shown on their frame
  }
  /* thrown: −2 AP at the start of your next turn (turn-by-turn), and a chip on your frame */
  function stagger(f) {
    f.kitApLoss = (f.kitApLoss || 0) + N.stagAp;
    f.mfStag = (f.turn || 0) + 1;
    if (typeof STACKS !== "undefined" && STACKS.add) { try { STACKS.add(f, "me", "stagger", 1); } catch (e) { /* older stacks */ } }
  }
  const staggered = (f) => !!f.mfStag && (f.turn || 0) <= f.mfStag;

  // ------------------------------------------------------------------ Mount / Dismount (tbfight.js cost, engine.js affordable / act)
  const why = (f, a) => {
    const m = f?.mount;
    if (owns(a)) {
      if (!m?.ok) return "No horse here";
      if (a === "dismount") return m.up ? "" : "You're on foot";
      if (m.up) return "Already in the saddle";
      if (m.down || m.hp <= 0) return `${hn(m)} is knocked down`;
      if ((f.sp || 0) < N.mountSp) return "Not enough stamina";
      return "";
    }
    if (!m?.up) return "";
    const [k, arg] = String(a).split(":");
    if (a === "power_attack" && TWO.has(f.wt)) return "No room to swing a two-hander that hard in the saddle";
    if (k === "dual") return "You need a hand for the reins";
    if (k === "spell" && typeof D !== "undefined" && (D.SPELLS[arg]?.level === "Master" || (typeof TOMES !== "undefined" && TOMES.level && TOMES.level(arg) === "Master"))) return "Too much to channel from the saddle";
    return "";
  };
  const can = (f, a) => owns(a) && !why(f, a);
  const blocked = (f, a) => !owns(a) && !!why(f, a);
  /* for Fight.affordable: true/false for mounting, false for what you can't do up there, null otherwise */
  function allow(f, a) {
    if (owns(a)) return can(f, a);
    return f.mount?.up && blocked(f, a) ? false : null;
  }
  function cost(f, a) { return a === "mount" ? Math.max(2, N.mountAp - (pfx(f.s, "msteady") > 0 ? 1 : 0)) : N.dismountAp; }
  function act(f, a) {
    const m = f.mount;
    if (!can(f, a)) return a === "mount" ? `You can't get on ${hn(m)} now` : "You're already on foot";
    if (a === "mount") {
      f.sp -= N.mountSp; m.up = true; m.foot = false; m.rode = true; m.recharge = true; m.charged = false; m.mounts = (m.mounts || 0) + 1;
      if (typeof f.addXp === "function") f.addXp("Athletics", 5);
      return `You swing up onto ${hn(m)}${TWO.has(f.wt) ? " (a two-hander is clumsy up here: no power attacks)" : ""}`;
    }
    m.up = false; m.offAt = f.turn || 1;
    return `You slide down from ${hn(m)}; it waits nearby`;
  }
  /* the moves to show: Mount when your horse stands by, Dismount when you're up */
  function moves(f) {
    const m = f?.mount; if (!m?.ok || (typeof BEASTPATH !== "undefined" && BEASTPATH.form && BEASTPATH.form(f))) return [];
    if (m.up) return [["dismount", "Dismount"]];
    if (m.down || m.hp <= 0) return [];
    return [["mount", "Mount"]];
  }
  function tip(f, a) {
    const m = f?.mount;
    if (a === "dismount") return `Get down from ${hn(m)}. On foot you can power attack with a two-hander and dual cast, and foes stop going for your horse.`;
    return `Swing up onto ${hn(m)} (${N.mountSp} stamina). Your next blow is a charge: a sure hit that does more and can knock the foe back. In the saddle swords and axes on foot miss you more, but archers, mages and spears can pull you down.`;
  }

  // ------------------------------------------------------------------ every round, and after the fight
  const origTick = HB?.tick;
  function tick(f) { if (origTick) origTick(f); else if (f.mount?.up) f.mount.sp = Math.min(SP_MAX(), f.mount.sp + 4); for (const al of f.allies || []) if (al.mt?.up) al.mt.sp = Math.min(SP_MAX(), (al.mt.sp || 0) + 4); }
  const origAfter = HB?.after;
  /* the horse's health goes back to your save; a knocked-down horse gets back up after the fight */
  function after(f, t) {
    const m = f.mount, s = f.s, h = s?.horse;
    if (!m || !h || typeof HORSES === "undefined") return origAfter ? origAfter(f, t) : [];
    if (m.walk && !m.rode) return [];   // it stood by and nothing happened to it
    if (m.foot && !m.rode) return origAfter ? origAfter(f, t) : [];   // two-hander: you never got on, you climb back on now
    const wasDown = !!(m.down || m.downTurn || m.hp <= 0), dt = m.downTurn || (wasDown ? 1 : 0);
    if (wasDown && typeof HORSES.knockDown === "function") { m.foot = false; return origAfter ? origAfter(f, t) : []; }   // downed horse (horses.js): it stays with you, downed, until it gets back up
    t = t ?? Date.now() / 1000;
    if (wasDown) { m.hp = Math.max(1, Math.round(m.max * N.getUp)); m.downTurn = 0; m.down = false; }   // horseback.js would send it off to the stables
    m.foot = false;
    const msgs = origAfter ? origAfter(f, t) : [];
    if (wasDown) { m.downTurn = dt; m.down = true; m.gotUp = true; }   // the fight's record still shows it went down
    if (h.away && wasDown) delete h.away;   // never sent off: it's right here
    if (h.down) h.down = false;
    if (wasDown) { h.hp = m.hp; h.hpT = t ?? Date.now() / 1000; }
    h.mounted = true;
    if (wasDown) msgs.push(`\uE12D ${h.name} gets back up after the fight, shaken (${Math.round(m.hp)}/${m.max}). You climb back into the saddle.`);
    return msgs.filter((x) => !/limps off|is downed|Downed/i.test(x));
  }
  const origNote = HB?.note;
  function note(s) {
    const n = origNote ? origNote(s) : "";
    if (!n || typeof HORSES === "undefined" || HORSES.riding(s) || !HORSES.present(s) || horseDowned(s)) return n;
    return `<p class="sub mountnote">\uE12D ${s.horse.name} is with you, but you're on foot. You can get on in the fight (Mount), or ride to open fights with a charge.</p>`;
  }

  // ------------------------------------------------------------------ party fights: the same riders on every phone
  /* what goes in the record for one rider */
  const out = (m) => (m && m.ok !== false ? { up: !!m.up, hp: Math.max(0, Math.round(m.hp || 0)), max: Math.round(m.max || 1), down: !!(m.down || m.hp <= 0), name: m.name || null, coat: m.coat || null } : null);
  /* tbfight.js shared(): the leader's horse on the host entry, each riding teammate's on theirs */
  function roster(f, all, list) {
    if (!list?.length) return;
    if (f.mount?.ok && !f.mount.foot || f.mount?.rode) list[0].mt = out(f.mount);
    for (const r of list.slice(1)) { const a = all.find((x) => x.tbk === r.k); if (a?.mt) r.mt = out(a.mt); }
  }
  /* sharedfight.js Mirror.sync: your own horse as the leader's phone keeps it, and your teammates' for the picture */
  function mirror(sess, d) {
    const f = sess.f, me = sess.me, list = d?.roster || [];
    for (const r of list) {
      const mine = r.k === "p:" + me || (r.pid && r.pid === me);
      if (mine) {
        if (!r.mt) { if (f.mount && f.mount.mate) f.mount = null; continue; }
        if (!f.mount) {
          const h = f.s?.horse, hp0 = typeof HORSES !== "undefined" && h ? HORSES.hp(f.s) : r.mt.hp;
          f.mount = fresh(r.mt.hp, r.mt.max, r.mt.name || h?.name, r.mt.coat || coatOf(h)); f.mount.hp0 = hp0; f.mount.mate = true; f.mount.rode = true; f.mount.up = r.mt.up;
        }
        const m = f.mount, stale = sess.doneTid && d.turn && d.turn.tid === sess.doneTid;   // the leader hasn't taken your last turn yet
        m.hp = r.mt.hp; m.max = r.mt.max; m.down = r.mt.down; if (m.down) { m.up = false; m.downTurn = m.downTurn || d.round || 1; }
        else if (!stale) m.up = r.mt.up;
        if (d.round > (m.lastRound || 0)) { if (m.lastRound) m.sp = Math.min(SP_MAX(), m.sp + 4); m.lastRound = d.round; }
        continue;
      }
      const a = sess.byKey?.get(r.k); if (a) { if (r.mt) a.mt = { ...r.mt, ok: true }; else delete a.mt; }
    }
  }
  /* tbfight.js applyRemote: a teammate's turn came back; their mount choice and their horse's breath come with it */
  function fromMate(al, mt) {
    if (!al || !mt) return;
    if (!al.mt) { if (!mt.up) return; al.mt = fresh(mt.hp, mt.max, mt.name, mt.coat); }
    const m = al.mt;
    if (m.down || m.hp <= 0) { m.up = false; return; }   // the leader's phone knows the horse is down
    m.up = !!mt.up; if (mt.up) m.rode = true;
  }

  // ------------------------------------------------------------------ the fight picture (fightart.js)
  const RX = { charge: /Mounted charge/, mount: /swing up onto/, dismount: /slide down from/, thrown: /thrown clear|out of the saddle/ };
  /* where the rider is at this point of the replay (0..1). {ride, ev, u, lunge, stand}: ride = drawn in the saddle;
     ev = what's playing (charge / mount / thrown); stand = the horse without you ("by" waiting, "down" knocked down) */
  /* the rider's events in the log, in order: {li, side ("me" / "them"), k (mount / dismount / charge / thrown), fell (the horse went down)} */
  function events(lines) {
    const out = [];
    lines.forEach((l, li) => {
      const me = String(l.me || ""), them = String(l.them || ""), mine = [];
      for (const k of ["mount", "dismount", "charge"]) { const i = me.search(RX[k]); if (i >= 0) mine.push([i, k]); }
      mine.sort((a, b) => a[0] - b[0]).forEach(([, k]) => out.push({ li, side: "me", k }));
      if (RX.thrown.test(them)) out.push({ li, side: "them", k: "thrown", fell: /thrown clear/.test(them) });
    });
    return out;
  }
  const flip = (k) => k === "thrown" || k === "dismount" ? false : k === "mount" ? true : null;   // up after this event
  /* where the rider is at this point of the replay: frac 0..1 over the log lines shown; who = the beat's side ("me" or the foe).
     {ride, ev, u, lunge, stand}: ride = drawn on the horse; ev = what's playing (charge / mount / dismount / thrown);
     stand = the horse without you ("by" waiting, "down" knocked down) */
  function pose(f, frac = 1, who) {
    const m = f?.mount; if (!m) return { ride: false, stand: null };
    const lines = f.log || [], n = lines.length, evs = events(lines);
    // walk back from how things are now to how they were before these lines
    let up = !!m.up;
    for (let i = evs.length - 1; i >= 0; i--) { const k = evs[i].k; if (k === "thrown" || k === "dismount") up = true; else if (k === "mount") up = false; }
    const fellAny = evs.some((e) => e.fell), downNow = !!(m.down || m.hp <= 0);
    let down = downNow && !fellAny;   // it was already down before these lines
    const pos = Math.max(0, Math.min(n, frac * n)), at = frac >= 1 ? n : Math.min(n - 1, Math.floor(pos)), u = pos - Math.floor(pos);
    let ev = null;
    for (const e of evs) {
      if (e.li > at) break;
      if (e.li === at) {   // the line playing now
        if (!who || e.side === (who === "me" ? "me" : "them")) { ev = e; break; }
        if (who === "me" || e.side === "them") break;   // the foe's part of a line comes after yours
      }
      const nu = flip(e.k); if (nu != null) up = nu; if (e.fell) down = true;
    }
    if (ev) {
      if (ev.k === "charge") return up ? { ride: true, ev: "charge", u, lunge: Math.sin(Math.PI * u), stand: null } : { ride: false, ev: null, u: 0, lunge: 0, stand: down ? "down" : "by" };
      return { ride: true, ev: ev.k, u, lunge: 0, stand: null, fell: !!ev.fell };
    }
    return { ride: up, ev: null, u: 0, lunge: 0, stand: up ? null : down ? "down" : m.foot && !m.rode ? null : "by" };
  }
  /* is the rider up at this point (the old horseback.js question) */
  const upAt = (f, frac) => { const p = pose(f, frac); return p.ride && p.ev !== "thrown"; };
  /* the rider's seat over the horse for this pose (called inside the hero's transform, feet at y 0) */
  function seat(g, p) {
    if (!p || !p.ev) { g.translate(0, -30); return; }
    const u = Math.max(0, Math.min(1, p.u));
    if (p.ev === "thrown") { const k = Math.min(1, u * 1.3); g.translate(-34 * k, -30 * (1 - k) - 22 * Math.sin(Math.PI * k)); g.rotate(-1.3 * Math.sin(Math.PI * Math.min(1, k * 0.9))); return; }
    if (p.ev === "mount") { g.translate(-18 * (1 - u), -30 * u); return; }
    if (p.ev === "dismount") { g.translate(-18 * u, -30 * (1 - u)); return; }
    g.translate(0, -30);
  }
  /* the horse under the rider, with a gallop for a charge and a rear when you're thrown */
  function drawMount(g, color, p, tt, part) {
    if (!HB?.drawHorse) return;
    const rear = p?.ev === "thrown" ? Math.sin(Math.PI * Math.min(1, p.u)) : 0, lunge = p?.lunge || 0;
    g.save();
    if (rear) { g.translate(-22, 0); g.rotate(-0.4 * rear); g.translate(22, 0); }
    if (lunge) g.translate(10 * lunge, 0);
    HB.drawHorse(g, color, lunge, tt, part);
    g.restore();
  }
  /* the horse beside you when you're on foot: waiting (by), or knocked down (down) */
  function drawStand(g, color, p, tt) {
    if (!p?.stand || !HB?.drawHorse) return;
    g.save(); g.translate(-58, 0);
    if (p.stand === "down") {
      if (HB.drawDowned) { g.restore(); return; }   // horseback.js draws its own lying horse
      g.scale(0.9, 0.9); g.translate(0, -2); g.rotate(-0.08);
      const ink = "#1c2128", br = Math.sin(tt * 1.6) * 0.6; g.strokeStyle = ink; g.lineCap = "round"; g.lineJoin = "round";
      g.lineWidth = 3; g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -2); g.moveTo(22, -7); g.lineTo(34, -3); g.stroke();
      g.fillStyle = color; g.lineWidth = 1.4; g.beginPath(); g.ellipse(14, -12, 22, 9 + br, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-6, -14); g.lineTo(-22, -6); g.lineTo(-30, -4); g.lineTo(-28, 0); g.lineTo(-16, -1); g.lineTo(-2, -6); g.closePath(); g.fill(); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(35, -14); g.quadraticCurveTo(44, -12, 42, -2); g.stroke();
    } else {
      g.scale(0.8, 0.8); g.globalAlpha *= 0.92;
      HB.drawHorse(g, color, 0, tt * 0.5, "back"); HB.drawHorse(g, color, 0, tt * 0.5, "front");
    }
    g.restore();
  }
  /* a teammate's horse for the picture (their colour), or null */
  function allyHorse(f, name) {
    const a = (f?.allies || []).find((x) => x && x.name === name);
    return a?.mt?.up ? a.mt.coat || "#6b4a2e" : null;
  }

  // ------------------------------------------------------------------ your frame: the horse's health bar
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function barHTML(f) {
    const m = f?.mount; if (!m?.ok || (m.foot && !m.rode)) return staggered(f) ? `<div class="mfst"><i class="st stag">\uE10A Staggered</i></div>` : "";
    const st = m.up ? "In the saddle" : m.down || m.hp <= 0 ? "Knocked down" : "Waiting nearby";
    const pc = (100 * Math.max(0, m.hp) / Math.max(1, m.max)).toFixed(1);
    const tipT = m.up ? `${hn(m)}: foes can go for your horse. At 0 it's knocked down (it never dies) and you're thrown.` : m.down || m.hp <= 0 ? `${hn(m)} is knocked down. After the fight it stays downed beside you until it gets back up.` : `${hn(m)} waits nearby. Mount to ride again.`;
    return `<div class="mfhorse ${m.up ? "up" : m.down || m.hp <= 0 ? "down" : "by"}" data-tip="${esc(tipT)}"><i style="width:${pc}%"></i><span>\uE12D ${esc(hn(m))} ${Math.round(Math.max(0, m.hp))} / ${m.max} · ${st}</span></div>${staggered(f) ? `<div class="mfst"><i class="st stag">\uE10A Staggered</i></div>` : ""}`;
  }

  // ------------------------------------------------------------------ take over from horseback.js
  if (HB) Object.assign(HB, { engage, strike, enemyTurn, tick, after, note, upAt });
  return { N, PERKS_ADD, owns, can, why, blocked, allow, cost, act, moves, tip, engage, strike, enemyTurn, allyTurn, riderTurn, foeKind, small, stagger, staggered, tick, after, note,
    out, roster, mirror, fromMate, allyMount, pose, upAt, seat, drawMount, drawStand, allyHorse, barHTML };
})();
