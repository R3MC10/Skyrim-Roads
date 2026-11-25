/* reactions.js: combat combos and reactions in turn-based fights. [OURS]
   Owner (design list, item 7): "frost + heavy = Shatter, oil + fire = burning ground, shield bash + power attack =
   Exploit, mark + archer = Precision, Unrelenting Force + attack = stagger exploit, defensive stance = intercept."
   One fighter sets the foe up, then someone (you, a friend in your party, your follower) cashes in. Done by two
   different fighters it is a team combo and hits a little harder.
   - Shatter: a power attack on a chilled foe. Big extra damage and the frost is gone (more chill stacks, more damage).
   - Burning ground: throw an Oil flask (Items, or the quick slots), then any fire (a spell, a fire weapon, Fire Breath)
     sets the oil ablaze: the ground burns the foe for 3 rounds.
   - Exploit: a power attack on a foe someone shield-bashed this round: extra damage, and it reels (loses a move).
   - Precision: Mark target (a cheap move when you or a friend carries a bow) makes the next 3 arrows or bolts at it
     critical hits (for up to 3 rounds).
   - Stagger exploit: after a shout (Unrelenting Force knocks it flat) the next blows find it off balance.
   - Intercept: Cover allies (a defensive stance that ends your turn): blows meant for your friends come to you, and
     you take them 35% softer. A boss's Marked for Death can be intercepted the same way.
   These replace the plain "opening" bonus from strategy.js for that blow (they don't stack on it). Every combo is
   capped by a share of the foe's health (smaller on bosses), and tbfight.js still caps one blow at 40%: no one-shots.
   Perks (perkfx.js): Cold Breaker (Shatter +40%), Tactician (setups last a round longer), Bodyguard (Intercept
   takes 25% more off).
   On screen: a small combo icon on any move that would set one off right now, and a short banner when one lands.
   Party fights: the setups live on the fight (f.rx, one of TB.FOE_KEYS), so one friend's frost or bash is another
   friend's combo. Pure rules work in node (tests/test_combos.js); decorate() needs a page. */
const REACT = (() => {
  const DOM = typeof document !== "undefined";
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = (x) => { if (x == null || x === "") return x; try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") { const r = I18N.tr(String(x)); if (r != null) return r; } } catch (e) { /* keep English */ } return x; };
  const fmt = (tpl, ...a) => T(tpl).replace(/\{(\d)\}/g, (m, i) => (a[+i] ?? ""));
  const pfx = (f, k) => (typeof PFX !== "undefined" && f && f.s ? PFX.num(f.s, k) || 0 : 0);
  const R = (v) => Math.round(v);

  // ------------------------------------------------------------------ numbers
  /* bonus: share of the blow added; cap: share of the foe's full health (normal, boss) */
  const C = {
    shatter: { bonus: 0.5, perStack: 0.1, cap: [0.1, 0.06] },
    exploit: { bonus: 0.6, cap: [0.09, 0.045] },
    precision: { bonus: 0.3, cap: [0.04, 0.02], shots: 3 },   // a mark is good for 3 critical shots
    force: { bonus: 0.5, cap: [0.07, 0.035] },
    burn: { share: 0.4, cap: [0.035, 0.018], rounds: 3 },
    team: 1.3,            // done by two different fighters
    cover: 0.35,          // Intercept: you take blows meant for friends this much softer
  };
  const WIN = { bash: 0, force: 1, mark: 2, oil: 3 };   // extra rounds a setup stays open after the round it was made (Tactician +1)
  const SP = { mark: 12, cover: 10 };
  const IC = { shatter: "", burn: "", exploit: "", precision: "", force: "", intercept: "", cleanse: "", oil: "", mark: "", cover: "" };
  const NAME = { shatter: "Shatter", burn: "Burning ground", exploit: "Exploit", precision: "Precision", force: "Stagger exploit", intercept: "Intercept", cleanse: "Cleansed" };
  const TIP = {
    shatter: "Combo: Shatter. A power attack on a chilled foe breaks the frost for big extra damage.",
    burn: "Combo: Burning ground. Fire sets the oil on the foe ablaze; the ground burns it for a few rounds.",
    exploit: "Combo: Exploit. A power attack on a foe shield-bashed this round hits harder and keeps it reeling.",
    precision: "Combo: Precision. The foe is marked: your arrows land as critical hits.",
    force: "Combo: Stagger exploit. The shout knocked it off balance: your blows land harder.",
    cleanse: "Cleanse: this washes the boss's hex off you.",
  };
  let off = false;   // tests compare fights with and without combos

  // ------------------------------------------------------------------ the oil flask
  function items() {
    if (typeof D === "undefined" || !D.ITEMS) return;
    if (!D.ITEMS.oil_flask) D.ITEMS.oil_flask = { name: "Oil Flask", slot: "misc", weight: 0.5, value: 14, oil: true, desc: "Throw it in a fight to soak the foe in oil. Then any fire sets the ground ablaze (Burning ground)." };
    if (D.SHOP_STOCK && Array.isArray(D.SHOP_STOCK.general) && !D.SHOP_STOCK.general.includes("oil_flask")) D.SHOP_STOCK.general.push("oil_flask");
  }
  items();
  function flaskRow(f) {
    try { for (const r of f.s.inv || []) if (r.item === "oil_flask" && (f.left ? f.left(r.id) : r.qty) > 0) return r; } catch (e) { /* none */ }
    return null;
  }
  const flasks = (f) => { let n = 0; try { for (const r of f.s.inv || []) if (r.item === "oil_flask") n += Math.max(0, f.left ? f.left(r.id) : r.qty); } catch (e) { /* none */ } return n; };

  // ------------------------------------------------------------------ state on the fight
  const st = (f) => f.rx || (f.rx = {});
  const rnd = (f) => f.turn || 0;
  const big = (f) => !!(f.e && (f.e.boss || f.e.qboss || f.bf || (f.tags && (f.tags.has("boss") || f.tags.has("dragon")))));
  const full = (f) => Math.max(1, f.ehp0 || f.e?.tbHp || f.ehp || 1);
  const capOf = (f, c) => full(f) * c[big(f) ? 1 : 0];
  const longer = (f) => (pfx(f, "rxlong") > 0 ? 1 : 0);   // Tactician
  const open = (f, k) => { const x = st(f)[k]; return !!x && rnd(f) <= x.until; };
  const isBow = (wt) => wt === "bow" || wt === "crossbow";
  const chillN = (f) => { const c = f.foeSt?.chill; return c ? Math.max(1, c.turns || 1) : 0; };
  /* what the foe is open to right now (taken before a move, so a move can't combo with itself) */
  function pre(f) {
    if (!f || off) return null;
    const x = st(f);
    return { chill: chillN(f), chillBy: f.cmark?.chill ?? null, bash: open(f, "bash"), bashBy: x.bash?.by, force: open(f, "force"), forceBy: x.force?.by, mark: open(f, "mark"), markBy: x.mark?.by, oil: open(f, "oil") };
  }
  function setup(f, k, by, extra) { const x = st(f); x[k] = { by, until: rnd(f) + (WIN[k] || 0) + longer(f), ...(extra || {}) }; }
  /* add the bonus, capped; returns the amount */
  function deal(f, amt, cap, team) {
    if (!(amt > 0) || f.ehp <= 0) return 0;
    const boost = team && typeof PFX !== "undefined" && f.s ? 1 + Math.min(0.5, PFX.num(f.s, "combo") || 0) : 1;   // Shield-Brother
    const d = Math.max(0, Math.min(amt * boost, cap));
    f.ehp -= d; f.combos = (f.combos || 0) + 1; st(f).n = (st(f).n || 0) + 1;
    return d;
  }
  const say = (key, tpl, ...a) => " · " + IC[key] + " " + fmt(tpl, ...a);

  /* a blow landed. who: "me", "al0"..., heavy: a power attack, bow: arrows or bolts. Returns { text, key } */
  function blow(f, who, before, p, heavy, bow) {
    const hit = before - f.ehp, none = { text: "", key: null };
    if (!p || off || !(hit > 0) || f.ehp <= 0) return none;
    if (heavy && p.chill) {
      const team = p.chillBy != null && p.chillBy !== who;
      const k = (C.shatter.bonus + C.shatter.perStack * Math.min(4, p.chill - 1)) * (team ? C.team : 1) * (1 + Math.min(1, pfx(f, "shatter")));   // Cold Breaker
      const d = deal(f, hit * k, capOf(f, C.shatter.cap) * (1 + 0.5 * Math.min(1, pfx(f, "shatter"))), team);
      if (f.foeSt) delete f.foeSt.chill;
      f.slowed = 0;
      return { text: say("shatter", team ? "Team shatter! +{0}, the frost breaks" : "Shatter! +{0}, the frost breaks", R(d)), key: "shatter" };
    }
    if (heavy && p.bash) {
      const team = p.bashBy != null && p.bashBy !== who;
      const d = deal(f, hit * C.exploit.bonus * (team ? C.team : 1), capOf(f, C.exploit.cap), team);
      const reel = !big(f) || Math.random() < 0.5;
      if (reel && f.ehp > 0) f.stagger = true;
      delete st(f).bash;
      return { text: say("exploit", reel ? "Exploit! +{0} on the stunned foe, and it keeps reeling" : "Exploit! +{0} on the stunned foe", R(d)), key: "exploit" };
    }
    if (bow && p.mark) {
      const team = p.markBy != null && p.markBy !== who;
      const d = deal(f, hit * C.precision.bonus * (team ? C.team : 1), capOf(f, C.precision.cap), team);
      const mk = st(f).mark; if (mk && --mk.shots <= 0) delete st(f).mark;
      return { text: say("precision", "Precision! A critical shot at the mark: +{0}", R(d)), key: "precision" };
    }
    if (p.force) {
      const team = p.forceBy != null && p.forceBy !== who;
      const d = deal(f, hit * C.force.bonus * (team ? C.team : 1), capOf(f, C.force.cap), team);
      delete st(f).force;
      return { text: say("force", "Stagger exploit! +{0} while it's off balance", R(d)), key: "force" };
    }
    return none;
  }

  // ------------------------------------------------------------------ your moves (tbfight.js act)
  const MOVES = ["rx:oil", "rx:mark", "rx:cover"];
  const owns = (a) => MOVES.includes(a);
  const liveAllies = (f) => (f.allies || []).filter((a) => a && !a.down && !(a.hp != null && a.hp <= 0) && !a.fsum && !a.summon && !a.summonOf);
  const anyBow = (f) => isBow(f.wt) || (f.allies || []).some((a) => a && !a.down && (a.bow || isBow(a.wt)));
  function cost(f, a) { return a === "rx:mark" ? { sp: SP.mark } : a === "rx:cover" ? { sp: SP.cover } : {}; }
  function can(f, a) {
    if (off || !f || f.ehp <= 0) return false;
    if (a === "rx:oil") return !!flaskRow(f) && !open(f, "oil") && !(st(f).fire?.left > 0);
    if (a === "rx:mark") return anyBow(f) && !open(f, "mark") && f.sp >= SP.mark;
    if (a === "rx:cover") return liveAllies(f).length > 0 && f.sp >= SP.cover;
    return false;
  }
  /* worth a quick slot right now (fightctl.js): Cover only while a foe is going for a friend, so the phone tray stays short */
  function worth(f, a) {
    if (!can(f, a)) return false;
    if (a !== "rx:cover") return true;
    const names = new Set(liveAllies(f).map((x) => x.name));
    return (f.foeTgts || []).some((t) => t && names.has(t.n));
  }
  function why(f, a) {
    if (can(f, a)) return "";
    if (a === "rx:oil") return flaskRow(f) ? "Already soaked" : "No oil flasks";
    if (a === "rx:mark") return open(f, "mark") ? "Already marked" : !anyBow(f) ? "No bow in your group" : "Not enough stamina";
    if (a === "rx:cover") return liveAllies(f).length ? "Not enough stamina" : "No one to cover";
    return "";
  }
  /* the extra moves you have right now: [[action, label]] */
  function moves(f) {
    if (off || !f || (f.pw && (f.pw.beast || f.pw.lord))) return [];
    const out = [];
    if (flasks(f) > 0) out.push(["rx:oil", "Oil flask"]);
    if (anyBow(f)) out.push(["rx:mark", "Mark target"]);
    if (liveAllies(f).length) out.push(["rx:cover", "Cover allies"]);
    return out;
  }
  const ends = (a) => a === "rx:cover";   // a stance: the rest of your turn goes into it
  function tip(f, a) {
    if (a === "rx:oil") return fmt("Throw an oil flask ({0} left): the foe is soaked for {1} rounds. Then any fire (a spell, a fire weapon, Fire Breath) sets the ground ablaze and burns it for {2} rounds.", flasks(f), WIN.oil + 1 + longer(f), C.burn.rounds + longer(f));
    if (a === "rx:mark") return fmt("Mark the foe for {0} rounds: the next {1} arrows or bolts at it, yours or a friend's, land as critical hits.", WIN.mark + 1 + longer(f), C.precision.shots + longer(f));
    if (a === "rx:cover") return fmt("Defensive stance, ends your turn: until your next turn, blows meant for your friends come to you, {0}% softer.", R(coverCut(f) * 100));
    return "";
  }
  const foeName = (f) => { const n = String(f.e?.name || "foe"); try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") return T(n) || n; } catch (e) { /* English */ } return n.toLowerCase(); };
  function act(sess, a) {
    const f = sess.f;
    if (a === "rx:oil") {
      const r = flaskRow(f); if (!r) return "You have no oil flask";
      f.used[r.id] = (f.used[r.id] || 0) + 1;
      setup(f, "oil", who(f));
      return fmt("You throw an oil flask: the {0} is soaked. Fire will set the ground ablaze.", foeName(f));
    }
    if (a === "rx:mark") {
      setup(f, "mark", who(f), { shots: C.precision.shots + longer(f) });
      return fmt("You mark the {0}: arrows and bolts at it land as critical hits", foeName(f));
    }
    if (a === "rx:cover") {
      st(f).cover = { by: who(f), round: rnd(f) };
      retarget(sess);
      return T("You stand guard over your friends: blows meant for them come to you");
    }
    return null;
  }
  const who = (f) => f.cActor || "me";
  /* tbfight.js act, after the move ran: record setups (bash, shout) and check combos. Returns { text, key } */
  function after(sess, a, before, p) {
    const f = sess.f; if (off || !p) return { text: "", key: null };
    if (a === "bash") setup(f, "bash", "me");
    if (/^shout:/.test(a) && f.ehp > 0) setup(f, "force", "me");
    if (!/^(attack|power_attack)$/.test(a)) return { text: "", key: null };
    return blow(f, "me", before, p, a === "power_attack", isBow(f.wt));
  }
  /* a follower or an AI teammate struck (followerai.js / tbfight.js allyMove). k: "attack" | "power" | "cast"... */
  function ally(sess, f, al, k, before, p) {
    if (off || !p || !al) return { text: "", key: null };
    const aid = "al" + Math.max(0, (f.allies || []).indexOf(al));
    if (k !== "attack" && k !== "power") return { text: "", key: null };
    return blow(f, aid, before, p, k === "power", !!(al.bow || isBow(al.wt)));
  }

  // ------------------------------------------------------------------ fire on oil: burning ground (wraps PFX.hitFoe)
  function ignite(f, amt) {
    const x = st(f); if (!open(f, "oil") || f.ehp <= 0) return "";
    delete x.oil;
    const dmg = Math.max(1, Math.min(capOf(f, C.burn.cap), Math.max(amt * C.burn.share, full(f) * 0.015)));
    x.fire = { left: C.burn.rounds + longer(f), dmg: R(dmg) };
    const d = deal(f, dmg, dmg, false);
    f._rxPend = "burn";
    return say("burn", "Burning ground! The oil catches fire: +{0}", R(d));
  }
  function install() {
    if (typeof PFX === "undefined" || PFX.__react) return;
    const orig = PFX.hitFoe;
    PFX.hitFoe = function (f, el, amt, src) {
      const out = orig.call(this, f, el, amt, src);
      if (!off && el === "fire" && f && f.rx && amt > 0) return out + ignite(f, amt);
      return out;
    };
    PFX.__react = true;
  }
  install();
  /* end of a round (tbfight.js endRound): the ground burns */
  function tick(f, line) {
    const x = f && f.rx; if (!x || off) return;
    if (x.fire && x.fire.left > 0 && f.ehp > 0) {
      const d = Math.min(x.fire.dmg, Math.max(0, f.ehp));
      f.ehp -= d; x.fire.left--;
      if (line) line.me += " · " + IC.burn + " " + fmt("burning ground {0}", R(d));
      if (x.fire.left <= 0) delete x.fire;
    }
  }

  // ------------------------------------------------------------------ Intercept
  const coverOn = (f) => !off && !!(f && f.rx && f.rx.cover);
  const coverCut = (f) => C.cover + Math.min(0.4, pfx(f, "rxcover"));   // Bodyguard
  /* blows already aimed at a friend this round now come to you (the "Next:" chips show it) */
  function retarget(sess) {
    const f = sess.f; if (!coverOn(f) || !Array.isArray(f.foeTgts)) return;
    const me = { k: "host", n: String(f.s?.name || "You"), kind: "you" };
    f.foeTgts = f.foeTgts.map((t) => (t && t.k !== "host" && t.kind !== "summon" ? { ...me, why: "rxcover", from: t.n, orig: t } : t));
  }
  /* your turn starts: the stance drops */
  function beginTurn(f) {
    if (!f || !f.rx || !f.rx.cover) return;
    delete f.rx.cover;
    if (Array.isArray(f.foeTgts)) f.foeTgts = f.foeTgts.map((t) => (t && t.why === "rxcover" && t.orig ? t.orig : t));   // its blows go back where they were meant
  }
  /* the foe is about to strike (tbfight.js foeAct, after FOEINTENT.next) */
  function foePre(sess) {
    const f = sess.f; sess._rxCov = null;
    if (!coverOn(f)) return;
    const tg = f.tgtNow, d = sess.tgtLast;
    if (tg && typeof tg === "object" && (f.allies || []).includes(tg) && !tg.fsum && !tg.summon) { sess._rxCov = tg.name || "your friend"; f.tgtNow = null; f.coverAl = null; }
    else if (!tg && d && d.why === "rxcover" && d.from) sess._rxCov = d.from;   // retargeted at the start of the round
  }
  /* after its blow: the intercepted blow lands softer on you */
  function foePost(sess, hpB) {
    const f = sess.f, name = sess._rxCov; sess._rxCov = null;
    if (!name) return "";
    const loss = hpB - f.hp, back = loss > 0 ? loss * coverCut(f) : 0;
    f.hp += back; f._rxPend = "intercept"; st(f).n = (st(f).n || 0) + 1;
    return say("intercept", "Intercept! You take the blow meant for {0} (−{1})", name, R(back));
  }

  // ------------------------------------------------------------------ what a move would set off right now (the icon on its button)
  const spellOf = (a) => { const [k, arg] = String(a).split(":"); return k === "spell" || k === "dual" ? D.SPELLS[arg] : k === "scroll" ? D.SPELLS[D.ITEMS[arg]?.spell] : null; };
  function ready(sess, a) {
    const f = sess?.f; if (!f || off || f.ehp <= 0 || !a) return null;
    const p = pre(f);
    const hex = f.bf && f.bf.hex;
    if (hex) { const sp = spellOf(a); if (/^potion:/.test(a) || (sp && (sp.kind === "heal" || sp.kind === "ward"))) return "cleanse"; }
    if (a === "power_attack" && p.chill) return "shatter";
    if (a === "power_attack" && p.bash) return "exploit";
    if ((a === "attack" || a === "power_attack") && isBow(f.wt) && p.mark) return "precision";
    if ((a === "attack" || a === "power_attack") && p.force) return "force";
    if (p.oil) { const sp = spellOf(a); if (sp && sp.element === "fire" && sp.kind !== "heal") return "burn"; if (/^shout:(yol|fire_breath)/.test(a)) return "burn"; if (a === "attack" && /fire/i.test(f.weapon?.enchant?.effect || "")) return "burn"; }
    return null;
  }

  // ------------------------------------------------------------------ Auto and the Smart AI (tbfight.js autoTurn)
  function bestFire(sess) {
    const f = sess.f; let best = null;
    for (const id of f.s.spells || []) { const sp = D.SPELLS[id]; if (!sp || sp.element !== "fire" || sp.kind !== "damage") continue; const a = "spell:" + id; if (sess.canAfford(a) && (!best || (sp.amount || 0) > best[1])) best = [a, sp.amount || 0]; }
    return best && best[0];
  }
  function ai(sess, a) {
    const f = sess.f; if (off || !f || !a || f.ehp <= 0) return a;
    const can = (x) => { try { return sess.canAfford(x); } catch (e) { return false; } };
    const p = pre(f), plain = a === "attack" || a === "block" || a === "power_attack";
    if (plain && (p.chill || p.bash) && can("power_attack")) return "power_attack";   // Shatter / Exploit
    if (p.oil) { const fire = bestFire(sess); if (fire && (plain || /^spell:/.test(a))) return fire; }   // light the oil
    if (a === "block" && (p.force || (p.mark && isBow(f.wt))) && can("attack")) return "attack";
    const tough = big(f) || (f.tags && f.tags.has("elite")) || f.e?.danger === "high";
    if (sess.myActs === 0 && tough && plain && !p.oil && !(st(f).fire?.left > 0) && can("rx:oil") && bestFire(sess)) return "rx:oil";
    const allyBow = (f.allies || []).some((x) => x && !x.down && x.bow);
    if (sess.myActs === 0 && tough && plain && !p.mark && can("rx:mark") && (allyBow || (isBow(f.wt) && f.sp > SP.mark + 80))) return "rx:mark";
    // a friend is about to be hit hard while low: stand over them
    const hurt = liveAllies(f).some((x) => x.maxHp > 0 && x.hp / x.maxHp < 0.3 && (f.foeTgts || []).some((t) => t && t.n === x.name));
    if (hurt && sess.myActs >= 1 && f.hp / Math.max(1, G.maxHealth(f.s)) > 0.6 && can("rx:cover")) return "rx:cover";
    return a;
  }
  /* followers' Smart AI (followerai.js decide): a move worth more because a combo is waiting */
  function value(f, al, o) {
    if (off || !f || !o) return 1;
    const p = pre(f), bow = !!(al && (al.bow || isBow(al.wt)));
    if (o.k === "power" && p.chill) return 1.5;
    if (o.k === "power" && p.bash) return 1.4;
    if ((o.k === "attack" || o.k === "power") && bow && p.mark) return 1.4;
    if ((o.k === "attack" || o.k === "power") && p.force) return 1.25;
    if (o.k === "cast" && o.sp && o.sp.element === "fire" && p.oil) return 1.6;
    return 1;
  }

  // ------------------------------------------------------------------ on screen
  const still = () => { try { if (typeof ACCESS !== "undefined" && ACCESS.reduceMotion) return ACCESS.reduceMotion(); } catch (e) { /* fall through */ } try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  /* the combo chips under the foe's health (soaked, marked, burning ground, covered) */
  function chips(f) {
    if (off || !f || !f.rx) return [];
    const out = [], x = f.rx;
    if (open(f, "oil")) out.push(["oil", IC.oil, T("Soaked in oil: fire sets the ground ablaze.")]);
    if (x.fire && x.fire.left > 0) out.push(["fire", IC.burn, fmt("Burning ground: {0} a round for {1} more rounds.", x.fire.dmg, x.fire.left)]);
    if (open(f, "mark")) out.push(["mark", IC.mark, T("Marked: arrows and bolts at it land as critical hits.")]);
    if (open(f, "bash")) out.push(["bash", IC.exploit, T("Bashed this round: a power attack now is an Exploit.")]);
    if (open(f, "force")) out.push(["force", IC.force, T("Off balance: the next blow is a Stagger exploit.")]);
    if (x.cover) out.push(["cover", IC.cover, T("You cover your friends: blows meant for them come to you.")]);
    return out;
  }
  function banner(e, sess) {
    if (!DOM || !e || !e.rx || still.__none) return;
    const k = e.rx, stage = document.querySelector("#tbf .tbstage");
    const m = String(e.text || "").match(/\+(\d+)|−(\d+)/), num = m ? (m[1] ? "+" + m[1] : "−" + m[2]) : "";
    document.querySelectorAll(".rxban").forEach((x) => x.remove());
    const o = document.createElement("div");
    o.className = `rxban rx-${k}${still() ? " still" : ""}`;
    o.setAttribute("role", "status");
    o.innerHTML = `<i aria-hidden="true">${IC[k] || "✦"}</i><b>${esc(T(NAME[k] || "Combo") + (k === "cleanse" ? "" : "!"))}</b>${num ? `<small>${esc(num)}</small>` : ""}${e.kind === "ally" || e.kind === "mate" ? `<em>${esc(e.name || "")}</em>` : `<em>${esc(T(k === "intercept" || k === "cleanse" ? "Reaction" : "Combo"))}</em>`}`;
    if (stage) { const r = stage.getBoundingClientRect(); o.style.left = `${r.left + r.width / 2}px`; o.style.top = `${r.top + Math.min(r.height * 0.3, 140)}px`; }
    document.body.appendChild(o);
    setTimeout(() => o.remove(), still() ? 1400 : 1900);
  }
  /* after tbfight.js render: icons on moves that would set off a combo, the chips, and the banner */
  function decorate(el, sess, newEv, playing) {
    if (!DOM || !el || !sess || off) return;
    const mine = !playing && !sess.done && sess.cur?.id === "me";
    if (mine) for (const b of el.querySelectorAll(".tbdock [data-tba]")) {
      const k = ready(sess, b.dataset.tba); if (!k || b.disabled) continue;
      b.classList.add("rxon", "rx-" + k);
      const i = document.createElement("i"); i.className = "rxbadge"; i.setAttribute("aria-hidden", "true"); i.textContent = IC[k];
      b.appendChild(i);
      const t = T(TIP[k] || ""); if (t) { b.dataset.tip = t + (b.dataset.tip ? " " + b.dataset.tip : ""); b.setAttribute("aria-label", `${b.getAttribute("aria-label") || ""} (${T(NAME[k])})`); }
    }
    const foe = el.querySelector(".tbu.foe");
    const cs = chips(sess.f);
    if (foe && cs.length && !foe.querySelector(".rxchips")) {
      const d = document.createElement("div"); d.className = "rxchips";
      d.innerHTML = cs.map(([k, ic, tip]) => `<i class="st rxc rxc-${k}" data-tip="${esc(tip)}">${ic}</i>`).join("");
      foe.appendChild(d);
    }
    const e = (newEv || []).filter((x) => x && x.rx).pop();
    if (e) { if (typeof NOTICES !== "undefined") NOTICES.fightTip("rx", () => banner(e, sess)); else banner(e, sess); }   // [notices] it waits while Items, Magic or a result is open
  }

  if (typeof TB !== "undefined" && Array.isArray(TB.FOE_KEYS) && !TB.FOE_KEYS.includes("rx")) TB.FOE_KEYS.push("rx");   // party fights: every phone sees the same setups
  return {
    C, WIN, IC, NAME, MOVES, owns, cost, can, why, moves, ends, tip, act, pre, after, ally, blow, tick, ignite, install,
    beginTurn, foePre, foePost, retarget, covering: coverOn, coverCut, ready, ai, value, chips, decorate, flasks, items, worth,
    get off() { return off; }, set off(v) { off = !!v; },
  };
})();
if (typeof module !== "undefined") module.exports = REACT;
