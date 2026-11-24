/* Boss fights that feel like events. [OURS]
   Remigiusz: "Boss fights should feel like events."
   - Who: dragons, dragon priests, Daedric and quest bosses (the elite ones), and the boss at the end of a dungeon.
     Not raid dragons (wevents.js), not other players, and not a party wave of several foes.
   - An intro card when the fight opens (letterbox bars, the boss's name and a title, a slow push-in; a tap skips it,
     and "reduce motion" keeps it still), a big health bar on top with marks where the phases change.
   - Phases: 2 or 3 at health marks. Each one changes what the boss does: it gets angry (hits harder), calls helpers
     (they take some of your blows until you cut them down), switches to a new element, or covers the ground in
     something nasty that hurts every round. One blow can only push it one phase on, and it can't fall before its last.
   - Big attacks are shown a turn ahead (the intent chips show them too) and you can answer: block, a ward, keep AP back
     to dodge, or break it with a shout or a shield bash (a very heavy hit can break it too).
   - A slow-motion finishing blow, and a bigger loot reveal at the end.
   - Perks (perkfx.js): Giant Slayer, Read the Signs, Break Their Focus.
   Balance (tests/test_bossfight.js): bosses last longer than before but stay winnable at levels 10, 25 and 40.
   Hooks: tbfight.js (setup, over, act, autoTurn, foeAct, startRound, render), fightread.js (intent chips),
   fightart.js/combatfx.js (slow finisher), ui.js (loot reveal), quests.js/daedric.js (qboss). */
const BOSSFIGHT = (() => {
  const DOM = typeof document !== "undefined";
  const T = (x) => { if (x == null || x === "") return x; try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") { const r = I18N.tr(String(x)); if (r != null) return r; } } catch (e) { /* keep English */ } return x; };
  const fmt = (tpl, ...a) => T(tpl).replace(/\{(\d)\}/g, (m, i) => (a[+i] ?? ""));
  const pl = () => { try { return typeof I18N !== "undefined" && I18N.lang() === "pl"; } catch (e) { return false; } };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const h01 = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
  const cap = (t) => String(t).charAt(0).toUpperCase() + String(t).slice(1);

  // ------------------------------------------------------------------ big attacks you see coming
  //  mul: how hard it hits compared with a plain blow; ans: what softens it (cut = what's left); a shout or a shield bash always breaks it
  const TELE = {
    slam: { ic: "💥", name: "Crushing Blow", mul: 2.1, ans: ["block"], cut: 0.5 },
    sweep: { ic: "🌀", name: "Wide Sweep", mul: 1.8, ans: ["dodge"], cut: 0.3 },
    storm: { ic: "⚡", name: "Spell Storm", mul: 2.0, ans: ["ward", "block"], cut: 0.5, magic: true },
    breath: { ic: "🔥", name: "Great Breath", mul: 2.1, ans: ["ward", "dodge"], cut: 0.45, magic: true },
    tail: { ic: "🐉", name: "Tail Sweep", mul: 1.8, ans: ["dodge"], cut: 0.3 },
    thuum: { ic: "🗣", name: "Unrelenting Force", mul: 1.7, ans: ["block"], cut: 0.5, magic: true, ap: 2 },
    soul: { ic: "💀", name: "Soul Rend", mul: 2.3, ans: [], cut: 1, magic: true },
    steam: { ic: "♨", name: "Steam Blast", mul: 1.9, ans: ["dodge"], cut: 0.3 },
    pounce: { ic: "🐾", name: "Savage Leap", mul: 1.9, ans: ["dodge"], cut: 0.3 },
  };
  const HINT = {
    block: "Block (or keep 1+ AP back) to halve it",
    ward: "A ward soaks most of it",
    dodge: "End your turn with 2+ AP left to dodge most of it",
  };
  const BREAK = "A shout or a shield bash breaks it";
  const hintOf = (d) => [...d.ans.map((a) => T(HINT[a])), T(BREAK)].join(" · ");

  // ------------------------------------------------------------------ what kind of boss, and what each phase brings
  //  each phase: fx (enrage | add | element | hazard), say ({0} = the boss), and which big attacks it uses
  const PROF = {
    dragon: { th: [0.66, 0.35], ep: ["Doom on wings", "Terror of the northern sky", "Devourer of the hold"], tele: [["breath"], ["breath"], ["tail", "breath"]],
      ph: [null, { fx: ["hazard"], say: "{0} climbs higher and rains fire on you", hz: "Fire from above" }, { fx: ["enrage"], say: "{0} crashes down, fighting for its life" }] },
    priest: { ep: ["Masked servant of the dragons", "Keeper of the old tomb", "Voice of a dead age"], tele: [["storm"], ["storm"], ["soul", "storm"]],
      ph: [null, { fx: ["add"], say: "{0} calls its dead servants out of the walls", add: "Risen draugr" }, { fx: ["element", "hazard"], say: "{0}'s mask blazes with a new power", hz: "Soul fire" }] },
    mage: { ep: ["Master of forbidden magic", "The storm-caller", "Reader of black books"], tele: [["storm"], ["storm"], ["storm", "storm"]],
      ph: [null, { fx: ["add"], say: "{0} summons a servant to fight beside them", add: "Summoned atronach" }, { fx: ["element", "hazard"], say: "{0} covers the floor in burning runes", hz: "Burning runes" }] },
    undead: { ep: ["Lord of the barrow", "The restless king", "Who should have stayed dead"], tele: [["thuum"], ["thuum", "slam"], ["slam", "thuum"]],
      ph: [null, { fx: ["add"], say: "The dead rise to {0}'s side", add: "Restless draugr" }, { fx: ["enrage", "hazard"], say: "{0} turns the air to killing frost", hz: "Grave frost" }] },
    construct: { ep: ["Guardian of the deep halls", "Brass colossus", "The machine that never sleeps"], tele: [["steam"], ["steam"], ["steam", "slam"]],
      ph: [null, { fx: ["element"], say: "{0} crackles with lightning", el: "shock" }, { fx: ["enrage", "hazard"], say: "{0} vents scalding steam everywhere", hz: "Scalding steam" }] },
    beast: { ep: ["Terror of the wilds", "The hungry dark", "Eater of hunters"], tele: [["pounce"], ["pounce"], ["pounce", "sweep"]],
      ph: [null, { fx: ["add"], say: "{0}'s brood joins the fight", add: "Its brood" }, { fx: ["enrage"], say: "{0} goes wild with rage" }] },
    warrior: { ep: ["The one they all fear", "Champion of the blade", "Never beaten in this hall"], tele: [["slam"], ["slam"], ["slam", "sweep"]],
      ph: [null, { fx: ["enrage"], say: "{0} gets angry and hits harder" }, { fx: ["add"], say: "{0} calls for help", add: "Loyal guard" }] },
  };
  const ELS = ["fire", "frost", "shock"];
  const EL_IC = { fire: "🔥", frost: "❄", shock: "⚡" };
  const ENRAGE = [1, 1.1, 1.2];   // how much harder it hits in each phase it got angry in
  const HP_UP = 1.06;              // bosses get a little more health (balanced in tests/test_bossfight.js)

  // ------------------------------------------------------------------ who counts
  function isBoss(f, sess) {
    const e = f && f.e; if (!e || e.player || e.ally || e.pool) return false;
    if (sess && (sess.mirror || (sess.waves || 1) > 1)) return false;
    const tags = f.tags || new Set(e.tags || []);
    return !!(e.boss || e.priest || e.qboss || tags.has("dragon"));
  }
  function profileOf(f) {
    const e = f.e, tags = f.tags || new Set(e.tags || []), n = String(e.name || "");
    if (tags.has("dragon")) return "dragon";
    if (e.priest || /dragon priest|lich/i.test(n)) return "priest";
    if (tags.has("mage") || /mage|necromancer|hagraven|wizard|warlock|witch|ancano|justiciar|sorcer/i.test(n)) return "mage";
    if (tags.has("construct")) return "construct";
    if (tags.has("undead")) return "undead";
    if (tags.has("beast")) return "beast";
    return "warrior";
  }
  /* "the dragon" for a plain foe, "Mirmulnir" for a named one */
  function who(f) {
    const n = String(f.e.name || "");
    if (pl()) return T(n) || n;
    return f.e.qboss || /^[A-Z][\w']* [A-Z]/.test(n) || (f.e.priest && !/^dragon priest$/i.test(n)) ? n : "the " + n.toLowerCase();
  }
  const say = (f, tpl, ...a) => cap(fmt(tpl, who(f), ...a));

  // ------------------------------------------------------------------ the fight starts (tbfight.js Session)
  function setup(f, sess) {
    if (!f) return null;
    if (!isBoss(f, sess)) { f.bf = null; return null; }
    const prof = profileOf(f), P = PROF[prof], lv = f.e.level ?? f.s?.level ?? 1;
    const three = prof === "dragon" || prof === "priest" || !!f.e.qboss || lv >= 20;   // weaker bosses get two phases
    const th = three ? (P.th || [0.6, 0.3]).slice() : [0.5];
    if (f.kit && typeof FOEKIT !== "undefined") f.kit.ids = f.kit.ids.filter((id) => !(FOEKIT.MOVES[id] || {}).tele);   // its big blows go through this file instead
    const eps = P.ep;
    f.bf = { prof, th, phase: 0, tele: null, teleCd: 1, teleN: 0, add: null, hazard: null, rage: 1, el: null, round: 0, ep: f.e.epithet || eps[Math.floor(h01(f.e.name || prof) * eps.length)], broke: 0, landed: 0, answered: 0 };
    if (sess && sess.ehpMax && !f.e.pool) { const k = HP_UP; f.ehp = Math.round(f.ehp * k); f.ehp0 = f.ehp; sess.ehpMax = f.ehp; f.e.tbHp = f.ehp; }   // a boss fight lasts a bit longer
    if (sess && typeof sess.emit === "function") sess.emit("foe", say(f, "{0} stands before you. This won't be quick."), "foe", { dmg: 0, bf: true, intro: true });
    return f.bf;
  }
  const phasesOf = (b) => b.th.length + 1;
  const phaseDef = (b) => { const P = PROF[b.prof]; return b.th.length === 1 ? [P.ph[0], P.ph[2]] : P.ph; };

  // ------------------------------------------------------------------ phases (tbfight.js `over`, so after every blow)
  function check(sess) {
    const f = sess.f, b = f.bf; if (!b || b.over) return;
    if (f.hp <= 0 || f.endWon) { b.over = true; return; }
    const mx = Math.max(1, sess.ehpMax || f.ehp0 || 1);
    if (b.phase < b.th.length && f.ehp < mx * b.th[b.phase]) {
      b.phase++;
      // one blow can't skip a phase, and it can't fall before its last phase has had a go
      const lo = b.phase < b.th.length ? b.th[b.phase] + 0.04 : b.th[b.th.length - 1] * 0.5;
      if (f.ehp < mx * lo) f.ehp = mx * lo;
      enter(sess, b.phase);
    }
    if (f.ehp <= 0) b.over = true;
  }
  function enter(sess, n) {
    const f = sess.f, b = f.bf, d = phaseDef(b)[n] || {};
    const base = Math.max(1, f.e.damage || 5), mx = Math.max(1, sess.ehpMax || f.ehp0 || 1);
    const bits = [];
    for (const fx of d.fx || []) {
      if (fx === "enrage") { b.rage = ENRAGE[Math.min(2, n)] || 1.3; bits.push(fmt("it hits {0}% harder", Math.round((b.rage - 1) * 100))); }
      if (fx === "add") { const hp = Math.round(mx * 0.12); b.add = { name: d.add || "Helper", hp, max: hp, dmg: base * 0.3 }; bits.push(fmt("{0} joins in", T(b.add.name))); }
      if (fx === "element") {
        let el = d.el;
        if (!el) { const cur = f.e.element || (typeof FOEKIT !== "undefined" ? FOEKIT.elOf(f) : "fire"); el = ELS[(ELS.indexOf(cur) + 1) % 3]; }
        f.e.element = el; b.el = el; bits.push(fmt("its magic turns to {0}", T(el)));
      }
      if (fx === "hazard") {
        const el = b.el || f.e.element || (b.prof === "dragon" && typeof DRAGONS !== "undefined" ? (DRAGONS.BY[f.e.dKind] || {}).el : null) || "fire";
        const nm = b.prof === "dragon" && el === "frost" ? "Freezing gale" : d.hz || "Hazard";
        b.hazard = { name: nm, el, dmg: base * 0.12 }; bits.push(fmt("{0}: you take damage every round", T(nm)));
      }
    }
    const text = fmt("Phase {0}: {1}", n + 1, say(f, d.say || "{0} changes"));
    sess.emit("foe", text + (bits.length ? ` (${bits.join(", ")})` : ""), "foe", { dmg: 0, bf: true, phase: n + 1, banner: text });
    if (b.phase >= b.th.length) b.teleCd = Math.min(b.teleCd, 0);   // the last phase: big attacks come more often
  }

  // ------------------------------------------------------------------ the plan for this round (after FIGHTREAD.plan and FOEINTENT.plan)
  const teleKey = (b) => { const L = PROF[b.prof].tele[Math.min(b.phase, 2)] || ["slam"]; return L[b.teleN % L.length]; };
  function register() {
    if (typeof FIGHTREAD === "undefined" || !FIGHTREAD.INTENT || FIGHTREAD.INTENT.bf_slam) return;
    for (const [k, d] of Object.entries(TELE)) {
      FIGHTREAD.INTENT["bft_" + k] = { ic: "⚠", label: "Readies " + d.name, tele: true, note: "lands next turn" };
      FIGHTREAD.INTENT["bf_" + k] = { ic: d.ic, label: d.name, mul: d.mul, big: true, note: d.ans.length ? d.ans.join(" / ") : "only a shout or bash stops it" };
    }
  }
  function plan(sess) {
    const f = sess.f, b = f.bf; if (!b || !f.kit || sess.mirror) return [];
    register();
    const k = f.kit, ord = sess.order || [], slots = [];
    for (let i = Math.max(0, sess.idx || 0); i < ord.length; i++) if (String(ord[i].id).startsWith("foe")) slots.push(i);
    if (f.dStance || typeof FIGHTREAD === "undefined" || !Array.isArray(k.plan)) k.plan = slots.map(() => null);   // a flying dragon: its own moves (dragons.js), rolled when it acts
    while (k.plan.length < slots.length) k.plan.push(null);
    const me = ord.findIndex((o) => o.id === "me");
    let landAt = -1, teleAt = -1;
    if (b.tele) {
      for (let j = 0; j < slots.length; j++) {
        const seen = b.tele.meAfter || sess.round > b.tele.round + 1 || (me >= 0 && me < slots[j]);   // you get a turn to answer first
        if (seen) { landAt = j; break; }
      }
      if (landAt >= 0) k.plan[landAt] = { id: "land", wind: "bf_" + b.tele.key, bf: "land" };
    } else if (b.teleCd > 0) b.teleCd--;
    else if (slots.length && f.ehp > 0) {
      teleAt = slots.length - 1;
      k.plan[teleAt] = { id: "bft_" + teleKey(b), bf: "tele", key: teleKey(b) };
    }
    if (Array.isArray(f.foeTgts) && landAt >= 0) f.foeTgts[landAt] = { k: "host", n: String(f.s?.name || "You"), kind: "you" };   // a big attack goes for you
    return k.plan;
  }

  // ------------------------------------------------------------------ the boss acts (tbfight.js foeAct). go() is its normal turn.
  function tickKit(f) {
    const k = f.kit; if (!k) return "";
    let pre = "";
    if (f.kitDot && f.hp > 1) { const d = Math.min(f.kitDot.dmg, f.hp - 1); f.hp -= d; pre = fmt("you take {0} from {1}", Math.round(d), f.kitDot.name) + " · "; if (--f.kitDot.turns <= 0) f.kitDot = null; }
    for (const id in k.cd) if (k.cd[id] > 0) k.cd[id]--;
    if (k.rage > 0) k.rage--;
    return pre;
  }
  /* once a round: its helper strikes, and the ground hurts */
  function roundTick(sess) {
    const f = sess.f, b = f.bf;
    if (b.round === sess.round) return "";
    b.round = sess.round;
    const out = [];
    if (b.add && b.add.hp > 0 && f.hp > 1) {
      let d = b.add.dmg * 0.6;
      try { const { rating, pieces } = f.armorRating(); if (typeof F !== "undefined" && F.damageReduction) d = b.add.dmg * (1 - F.damageReduction(rating, pieces)); } catch (e) { /* rough */ }
      d = Math.max(1, Math.min(d * (1 - (f.tbGuard || 0)), f.hp - 1));
      f.hp -= d; out.push(fmt("{0} hits you {1}", T(b.add.name), Math.round(d)));
    }
    if (b.hazard && f.hp > 1) {
      const d = Math.max(1, Math.min(b.hazard.dmg * (f.ward > 0 ? 0.5 : 1), f.hp - 1));
      f.hp -= d; out.push(fmt("{0} burns you for {1}", T(b.hazard.name), Math.round(d)));
    }
    return out.length ? out.join(" · ") + " · " : "";
  }
  const stuck = (f) => f.calmTurns > 0 || f.eParalyzed > 0 || f.stagger;
  function turn(sess, go) {
    const f = sess.f, b = f.bf;
    if (!b || !f.kit) return go();
    const k = f.kit, head = Array.isArray(k.plan) ? k.plan[0] : null;
    let pre = roundTick(sess);
    if (head && head.bf) {
      k.plan.shift();
      pre += tickKit(f);
      if (head.bf === "tele") {
        if (stuck(f)) return pre + f.enemyTurn();   // stunned: no big attack this time
        const key = head.key || teleKey(b), d = TELE[key];
        const me = (sess.order || []).findIndex((o) => o.id === "me");
        b.tele = { key, round: sess.round, idx: sess.idx, meAfter: me > (sess.idx || 0) };
        b.teleN++;
        return pre + say(f, "{0} readies {1}! It lands next turn.", T(d.name)) + " " + hintOf(d) + ".";
      }
      if (!b.tele) { const hpB = f.hp, t = go(); return pre + scaleRage(f, hpB, t); }
      return pre + land(sess);
    }
    if (f.dStance && Array.isArray(k.plan) && k.plan.length) k.plan.shift();   // a flying dragon doesn't read the plan itself
    const hpB = f.hp, t = go();
    return pre + scaleRage(f, hpB, t);
  }
  function scaleRage(f, hpB, t) {
    const b = f.bf, loss = hpB - f.hp;
    if (loss > 0 && b.rage > 1) f.hp = hpB - loss * b.rage;
    return t;
  }
  /* the big attack lands. Answered (blocked, warded, dodged): it does much less */
  function land(sess) {
    const f = sess.f, b = f.bf, d = TELE[b.tele.key];
    b.tele = null; b.teleCd = b.phase >= b.th.length ? 0 : 1;
    if (stuck(f)) return f.enemyTurn() + " " + T("(the big attack is lost)");
    const blocked = !!f.blocking || (f.tbGuard || 0) >= 0.1, warded = (f.ward || 0) > 0, dodged = (f.tbGuard || 0) >= 0.2;
    const how = d.ans.find((a) => (a === "block" && blocked) || (a === "ward" && warded) || (a === "dodge" && dodged));
    const hpB = f.hp;
    f.tgtNow = null; f.eMagic = !!d.magic;
    let t; try { t = f.enemyTurnInner(); } finally { f.eMagic = false; }
    const loss = hpB - f.hp;
    let note = "";
    if (loss > 0) {
      const sign = typeof PFX !== "undefined" ? clamp(PFX.sum(f.s, "bftele", f, {}), 0, 0.6) : 0;   // Read the Signs
      const m = d.mul * b.rage * (how ? d.cut : 1) * (1 - sign);
      f.hp = hpB - loss * m;
      if (d.ap && !how) { f.kitApLoss = (f.kitApLoss || 0) + d.ap; note += " " + fmt("(−{0} AP next turn)", d.ap); }
    }
    b.landed++;
    if (how) { b.answered++; note = " " + fmt("(you saw it coming: {0})", T({ block: "blocked", ward: "warded", dodge: "dodged" }[how])) + note; }
    return say(f, "{0} unleashes {1}!", T(d.name)) + " " + t + note;
  }

  // ------------------------------------------------------------------ your blow (tbfight.js act, after FOEKIT.defend)
  function answer(sess, a, before) {
    const f = sess.f, b = f.bf; if (!b) return "";
    let t = "";
    const dealt = before - f.ehp, mx = Math.max(1, sess.ehpMax || f.ehp0 || 1);
    if (b.add && b.add.hp > 0 && dealt > 0 && f.ehp > 0) {   // the helper takes some of it
      const part = dealt * 0.3; f.ehp += part; b.add.hp -= part * 2;
      if (b.add.hp <= 0) { t += " " + fmt("(you cut down {0})", T(b.add.name)); b.add = null; }
      else t += " " + fmt("({0} takes {1})", T(b.add.name), Math.round(part));
    }
    if (b.tele) {
      const brk = typeof PFX !== "undefined" ? PFX.num(f.s, "bfbreak") : 0;   // Break Their Focus
      const heavy = dealt >= mx * (brk ? 0.1 : 0.15) && (brk || Math.random() < 0.35);
      if (a === "bash" || /^shout:/.test(a || "") || heavy) {
        const d = TELE[b.tele.key]; b.tele = null; b.teleCd = 1; b.broke++;
        if (Array.isArray(f.kit?.plan)) f.kit.plan = f.kit.plan.map((p) => (p && p.bf === "land" ? null : p));
        if (brk && f.ehp > 0) f.stagger = true;
        t += " " + fmt("(you break its {0}!)", T(d.name)) + (brk && f.ehp > 0 ? " " + T("(it reels and loses its next move)") : "");
      }
    }
    return t;
  }
  /* Auto (and the sim): answer a big attack that's coming */
  function ai(sess, a) {
    const f = sess.f, b = f.bf; if (!b || !b.tele || !a) return a;
    const can = (x) => { try { return sess.canAfford(x); } catch (e) { return false; } };
    if (can("bash")) return "bash";
    const sh = ["shout:fus", "shout:yol", "shout:fo"].find(can);
    if (sh) return sh;
    const d = TELE[b.tele.key];
    if (d.ans.includes("block") && !sess.myActs && can("block")) return "block";
    if ((d.ans.includes("dodge") || d.ans.includes("block")) && sess.myActs > 0 && sess.ap >= 2 && sess.ap <= 3) return "end";
    return a;
  }

  // ------------------------------------------------------------------ on screen
  const still = () => { try { if (typeof ACCESS !== "undefined" && ACCESS.reduceMotion) return ACCESS.reduceMotion(); } catch (e) { /* fall through */ } try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  function overlay(cls, html, ms, el) {
    if (!DOM) return null;
    const o = document.createElement("div");
    o.className = `bfov ${cls} ink${still()
 ? " still" : ""}`;
    o.setAttribute("role", "status"); o.innerHTML = html;
    const kill = () => { if (o.parentNode) o.parentNode.removeChild(o); };
    o.addEventListener("click", kill);
    document.body.appendChild(o);
    if (ms) setTimeout(kill, still() ? Math.min(ms, 1800) : ms);
    return o;
  }
  function intro(el, sess) {
    const f = sess.f, b = f.bf;
    document.querySelectorAll(".bfov.bfintro").forEach((x) => x.remove());
    overlay("bfintro", `<i class="bfl top"></i><i class="bfl bot"></i><div class="bfcard"><small>${esc(T(b.ep))}</small><h2>${esc(pl() ? T(f.e.name) : f.e.name)}</h2><em>${esc(T("Tap to fight"))}</em></div>`, 2800, el);
    if (!still()) { el.classList.add("bfpush"); setTimeout(() => el.classList.remove("bfpush"), 2600); }
  }
  function barHTML(sess, ehpNow) {
    const f = sess.f, b = f.bf, mx = Math.max(1, sess.ehpMax), pc = clamp(100 * ehpNow / mx, 0, 100);
    const ticks = b.th.map((t, i) => `<b class="bftick${b.phase > i ? " past" : ""}" style="left:${(t * 100).toFixed(1)}%"></b>`).join("");
    const ph = fmt("Phase {0}/{1}", b.phase + 1, phasesOf(b));
    const add = b.add && b.add.hp > 0 ? `<div class="bfadd"><span>➕ ${esc(T(b.add.name))}</span><i><b style="width:${(100 * b.add.hp / b.add.max).toFixed(1)}%"></b></i><em>${esc(T("takes some of your blows"))}</em></div>` : "";
    const hz = b.hazard ? `<span class="bfhz">${EL_IC[b.hazard.el] || "☠"} ${esc(fmt("{0}: {1} a round", T(b.hazard.name), Math.round(b.hazard.dmg)))}</span>` : "";
    const rage = b.rage > 1 ? `<span class="bfhz rage">😡 ${esc(fmt("+{0}% damage", Math.round((b.rage - 1) * 100)))}</span>` : "";
    return `<div class="bfbar" data-tip="${esc(T("Boss: the marks on the bar are where it changes how it fights."))}"><div class="bfname"><b>${esc(pl() ? T(f.e.name) : f.e.name)}</b><small>${esc(T(b.ep))}</small><span class="bfph">${esc(ph)}</span></div>
      <div class="bftrack"><i style="width:${pc.toFixed(1)}%"></i>${ticks}</div>${hz || rage ? `<div class="bfchips">${rage}${hz}</div>` : ""}${add}</div>`;
  }
  function teleHTML(sess) {
    const f = sess.f, b = f.bf; if (!b.tele || sess.done) return "";
    const d = TELE[b.tele.key];
    return `<div class="bftele" role="alert"><b>${d.ic} ${esc(say(f, "{0} readies {1}!", T(d.name)))}</b><small>${esc(hintOf(d))}</small></div>`;
  }
  function decorate(el, sess, newEv = [], ehpNow, playing) {
    if (!DOM || !el || !sess?.f?.bf) return;
    const f = sess.f, b = f.bf, tin = el.querySelector(".tbin");
    el.classList.add("bfon");
    if (tin) {
      const top = tin.querySelector(".tbtop");
      const wrap = document.createElement("div"); wrap.className = "bfwrap";
      wrap.innerHTML = barHTML(sess, ehpNow ?? Math.max(0, f.ehp)) + teleHTML(sess);
      if (top && top.nextSibling) tin.insertBefore(wrap, top.nextSibling); else tin.prepend(wrap);
    }
    if (!sess.bfIntro) { sess.bfIntro = true; intro(el, sess); }
    const ph = newEv.filter((e) => e && e.phase).pop();
    if (ph) overlay("bfphase", `<div class="bfpc"><small>${esc(fmt("Phase {0}", ph.phase))}</small><h3>${esc(String(ph.banner || "").replace(/^[^:]*:\s*/, ""))}</h3></div>`, 2400, el);
    if (sess.done && f.won && !f.escaped && f.ehp <= 0 && !sess.bfFin) {
      sess.bfFin = true;
      overlay("bffin", `<i class="bfl top"></i><i class="bfl bot"></i><div class="bfcard"><small>${esc(T("Boss defeated"))}</small><h2>${esc(say(f, "{0} falls"))}</h2></div>`, 3000, el);
    }
  }
  /* the loot at the end of a boss fight (ui.js: after the fight, or the dungeon's boss room) */
  function reveal(r) {
    if (!DOM || !r || r.died || r.fled) return;
    const f = r.fight; if (!f || !f.bf || f.bfShown || !f.won) return;
    f.bfShown = true;
    const name = (x) => { const it = typeof D !== "undefined" && D.ITEMS ? D.ITEMS[x] : null; return it ? it.name : String(x); };
    const items = [...new Set([...(r.stripLoot || r.loot || [])])].map(name);
    const gold = r.stripGold || r.gold || 0;
    if (!items.length && !gold) return;
    const li = items.map((n, i) => `<li style="--i:${i}">${esc(pl() ? T(n) || n : n)}</li>`).join("");
    overlay("bfloot", `<div class="bfcard"><small>${esc(say(f, "{0} is beaten"))}</small><h2>${esc(T("Boss loot"))}</h2>${gold ? `<p class="bfgold">💰 ${esc(fmt("{0} gold", gold))}</p>` : ""}<ul>${li}</ul><em>${esc(T("Tap to close"))}</em></div>`, 0, document.getElementById("tbf"));
  }

  if (typeof TB !== "undefined" && Array.isArray(TB.FOE_KEYS) && !TB.FOE_KEYS.includes("bf")) TB.FOE_KEYS.push("bf");   // party fights: every phone sees the same boss
  return { TELE, PROF, isBoss, profileOf, setup, check, plan, turn, answer, ai, decorate, reveal, hintOf, phasesOf, teleKey };
})();
if (typeof module !== "undefined") module.exports = BOSSFIGHT;
