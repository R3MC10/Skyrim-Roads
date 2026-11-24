/* strategy.js: real choices every turn in a turn-based fight. [OURS]
   Owner: "redesign turn-based combat so players can play strategically".
   What was already there and stays: foe intents with their target (foeintent.js), the turn-order ribbon (combat2.js),
   rows (back-row followers draw fewer blows, followerai.js), guard from moves you don't make, combos between teammates (combo.js),
   foe weak spots and resists (foekit.js / combo.js chips). This module adds:
   - Catch your breath: free, but it ends your turn: get back 35% of your stamina and 25% of your magicka. Every blow,
     power attack, bash and guard
     burn stamina, so a heavy hitter has to pace themselves: hit hard now, or breathe and hit hard next turn.
   - Openings: hit a foe that is staggered, stunned or paralyzed and the blow does 30% more (a power attack 45%);
     a chilled foe takes 15% more from a power attack. Bash or stagger first, then cash in. At most 7% of the foe's
     health per blow (half that on a boss), so still no one-shots.
   - Frost slows: a chilled or slowed foe rolls 4 lower initiative, so you and your followers act before it.
   - Orders for your follower in the middle of a fight: Attack (front row, hits hard), Defend me (front row, draws
     blows, steps in front of you), Hold back (back row, only guards, heals and drinks potions). Free, any time on
     your turn; tap the little buttons on their card. They go back to their usual tactic after the fight.
   Perks: Second Wind (Athletics) makes Catch your breath give 50% more; Savage Strike (One-Handed) and Devastating
   Blow (Two-Handed) make a power attack into an opening pay off 50% more (still under the cap).
   - Auto (and the sim in tests/test_strategy.js) uses all of this: it cashes in openings and catches its breath
     when it can't afford its best moves. */
const STRAT = (() => {
  const REC = { sp: 0.35, mp: 0.25 };
  const OPEN = { hit: 0.3, power: 0.45, chill: 0.15, cap: 0.07 };
  const INIT_CUT = 4;
  const ORDERS = {
    attack: { ic: "⚔", name: "Attack", tip: "Attack: front row, goes all out with power attacks and damage spells." },
    defend: { ic: "🛡", name: "Defend me", tip: "Defend me: front row, draws blows and steps in front of you when you're hurt." },
    hold: { ic: "✋", name: "Hold back", tip: "Hold back: back row, draws fewer blows, only guards, heals and drinks potions." },
  };
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);   // data-tip isn't translated on the page
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const maxSp = (f) => (typeof G !== "undefined" && G.maxStamina ? G.maxStamina(f.s) : f.sp || 100);
  const maxMp = (f) => (typeof G !== "undefined" && G.maxMagicka ? G.maxMagicka(f.s) : f.mp || 100);

  // ------------------------------------------------------------------ Catch your breath
  const owns = (a) => a === "recover";
  const perk = (f, id) => (typeof G !== "undefined" && G.P && f?.s ? G.P(f.s, id) : 0);
  const recMult = (f) => (perk(f, "second_wind") ? 1.5 : 1);   // Athletics: Second Wind
  const cost = (f, a) => (a === "recover" ? { sp: 0, mp: 0, hp: 0 } : null);
  const ends = (a) => a === "recover";   // Breathe is your whole turn
  function can(f, a) {
    if (a !== "recover") return true;
    if (typeof CURSE !== "undefined" && CURSE.noPotions && f.pw && (f.pw.beast || f.pw.lord)) return false;   // a beast doesn't stop to breathe
    return f.sp < maxSp(f) * 0.9 || f.mp < maxMp(f) * 0.9;
  }
  function why(f, a) { return a === "recover" && !can(f, a) ? "Already fresh" : ""; }
  function act(f, a) {
    if (a !== "recover") return null;
    const sp0 = f.sp, mp0 = f.mp, ms = maxSp(f), mm = maxMp(f), k = recMult(f);
    f.sp = Math.min(ms, f.sp + ms * REC.sp * k); f.mp = Math.min(mm, f.mp + mm * REC.mp * k);
    const ds = Math.round(f.sp - sp0), dm = Math.round(f.mp - mp0);
    return `You catch your breath (+${ds} stamina${dm > 0 ? `, +${dm} magicka` : ""})`;
  }
  function tip(f, a) {
    if (a !== "recover") return "";
    const k = recMult(f);
    return `Catch your breath: get back ${Math.round(maxSp(f) * REC.sp * k)} stamina and ${Math.round(maxMp(f) * REC.mp * k)} magicka. Free, but it ends your turn. Blows, power attacks, bashes and guards need stamina, spells need magicka.`;
  }

  // ------------------------------------------------------------------ Openings
  /* what state the foe is in before your blow: "open" (staggered, stunned, paralyzed), "chill" or "" */
  function setup(f) {
    if (!f || f.ehp <= 0) return "";
    if (f.stagger || f.eParalyzed > 0 || f.tbStunLeft > 0) return "open";
    if (f.foeSt?.chill) return "chill";
    return "";
  }
  function after(f, a, before, was) {
    if (!was || f.ehp >= before || f.ehp <= 0) return "";
    const phys = a === "attack" || a === "power_attack" || a === "bash" || /^(beast|lord):/.test(a);
    if (!phys) return "";
    const pw = a === "power_attack";
    const big = pw && was === "open" && (perk(f, "savage_strike") || perk(f, "devastating_blow")) ? 1.5 : 1;   // One-/Two-Handed perks
    const mult = (was === "open" ? (pw ? OPEN.power : OPEN.hit) : pw ? OPEN.chill : 0) * big;
    if (!mult) return "";
    const full = f.ehp0 || f.e?.tbHp || before || 1, boss = f.e?.boss || f.bf;
    const extra = Math.min((before - f.ehp) * mult, full * OPEN.cap * (boss ? 0.5 : 1));
    if (extra < 1) return "";
    f.ehp -= extra;
    return was === "open" ? ` · opening! +${Math.round(extra)}` : ` · shatters the frost! +${Math.round(extra)}`;
  }
  /* chill stacks slow it more (stacks.js: +1 lower per stack, half past 4) */
  const foeInitCut = (f) => (f && (f.foeSt?.chill || f.slowed > 0) ? INIT_CUT + (typeof STACKS !== "undefined" && f.foeSt?.chill ? Math.max(0, STACKS.foeInit(f) - 1) : 0) : 0);

  // ------------------------------------------------------------------ Smart play for Auto
  /* sess: the tbfight Session, a: what the Smart AI picked. Returns the move to make instead (or a). */
  function ai(sess, a) {
    const f = sess.f; if (!f) return a;
    const pa = "power_attack", was = setup(f);
    if (was === "open" && (a === "attack" || a === "block") && sess.canAfford(pa)) return pa;   // cash in the opening
    const hpPct = f.hp / Math.max(1, G.maxHealth(f.s));
    const wantsSp = !f.weapon || f.weapon.skill !== "Archery";
    const low = (wantsSp && f.sp < (f.paCost || 30)) || (f.mp < maxMp(f) * 0.15 && (f.s.spells || []).length > 2 && !f.weapon);
    if (low && hpPct > 0.45 && sess.myActs === 0 && (!a || a === "attack" || a === "block") && can(f, "recover")) return "recover";
    return a;
  }

  // ------------------------------------------------------------------ Follower orders
  function order(f, al, o) {
    if (!al || !al.fai) return false;
    if (al.tactic0 === undefined) { al.tactic0 = al.tactic || "auto"; al.row0 = al.row || "front"; }
    al.order = ORDERS[o] ? o : null;
    al.tactic = o === "attack" ? "aggressive" : o === "defend" ? "defensive" : al.tactic0;
    al.row = o === "hold" ? "back" : o ? "front" : al.row0;
    if (o === "hold" && f.coverAl === al) f.coverAl = null;
    return true;
  }
  /* the Hold back filter, used by followerai.js decide(): guard, potions, heals and wards only */
  const HOLD_KINDS = new Set(["heal", "ward", "armor", "regen", "courage", "invisibility"]);
  function allowed(al, o) {
    if (al.order !== "hold") return true;
    return o.k === "guard" || o.k === "potion" || (o.k === "cast" && o.sp && HOLD_KINDS.has(o.sp.kind));
  }
  function ordersHTML(al, i, live) {
    if (!al || !al.fai || al.down) return "";
    const cur = al.order || "";
    return `<div class="c2ord" role="group" aria-label="Orders for ${esc(al.name)}">${Object.entries(ORDERS).map(([k, v]) =>
      `<button class="c2o${cur === k ? " on" : ""}" data-strat-ord="${k}" data-al="${i}"${live ? "" : " disabled"} data-tip="${esc(tr(v.tip))}" aria-pressed="${cur === k}" aria-label="${esc(tr(v.name))}">${v.ic}</button>`).join("")}</div>`;
  }
  /* clicks on the order buttons: handled before tbfight.js sees them */
  function onClick(ev) {
    const b = ev.target.closest?.("[data-strat-ord]"); if (!b) return;
    ev.stopPropagation(); ev.preventDefault();
    if (b.disabled || typeof TB === "undefined" || !TB.session) return;
    const sess = TB.session, f = sess.f, al = f.allies[+b.dataset.al];
    if (!al || sess.cur?.id !== "me" || sess.done) return;
    const o = al.order === b.dataset.stratOrd ? null : b.dataset.stratOrd;   // tap again: back to their own way
    order(f, al, o);
    sess.emit && sess.emit("me", o ? `${al.name}: ${ORDERS[o].name.toLowerCase()}!` : `${al.name} fights their own way`, "order");
    TB.redraw(sess, { turn: "me" });
  }
  if (typeof document !== "undefined") document.addEventListener("click", onClick, true);

  return { REC, OPEN, ORDERS, INIT_CUT, owns, cost, ends, can, why, act, tip, setup, after, foeInitCut, ai, order, allowed, ordersHTML };
})();
