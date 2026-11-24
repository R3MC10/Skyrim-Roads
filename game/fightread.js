/* Reading the fight: see what's coming and what just happened. [OURS]
   Kacper: "It's not easy to see what's going on during a fight." Survey: foe turns played one by one, turn banners,
   a round summary, warnings before big hits, clear statuses that show how much health poison, burning and bleeding
   will take (on you AND on foes, at all times, like Slay the Spire's intents), a low-health warning, and sounds for all
   of it.
   - Intents: at the start of each round every foe action is decided ahead (foekit.js plan), so its frame and a bubble
     over it in the scene show what it will do: ⚔ 18–26, 💥 Huge blow 40–55, ✚ Heal, 🛡 Raise shield...
   - Forecast: your health bar marks what this round's foe blows and your poison / burning will take ("about −46"),
     the foe's bar marks what its burning, bleeding and your cloaks will take at the end of the round.
   - Pacing: tbfight.js shows the events one at a time with these delays (Fast ⏩ keeps the old all-at-once view;
     the Skip button jumps to the end). Banners: "Round 3" with last round's summary, "Bandit's turn", "Your turn".
   - Low health (under 25%): the screen edges pulse red and you hear your heartbeat.
   Pure helpers (plan, intents, forecast, summary, banner, delay, cue) are testable in node; the rest needs a page. */
const FIGHTREAD = (() => {
  const DOM = typeof document !== "undefined";
  const r0 = (v) => Math.round(v);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const spread = () => (typeof F !== "undefined" && F.DAMAGE_SPREAD ? F.DAMAGE_SPREAD : [0.8, 1.2]);
  const LOW = 0.25;
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);

  /* what each foe move looks like as an intent. mul: how hard it hits compared to a plain blow */
  const INTENT = {
    blow: { ic: "⚔", label: "Strike", mul: 1 },
    smash: { ic: "💥", label: "Crushing Blow", mul: 1.9, big: true },
    aimed: { ic: "🎯", label: "Aimed Shot", mul: 1.7, big: true },
    shield_bash: { ic: "🛡", label: "Shield Bash", mul: 0.7, note: "and winds you", stk: 1, dot: null, st: "Winded" },
    raise_shield: { ic: "🛡", label: "Brace", buff: true, note: "your next melee blow does half" },
    wind_up: { ic: "⚠", label: "Winds up", tele: true, note: "a Crushing Blow comes after" },
    war_cry: { ic: "📣", label: "War Cry", buff: true, note: "hits 25% harder for 3 turns" },
    take_aim: { ic: "⚠", label: "Takes aim", tele: true, note: "an Aimed Shot comes after" },
    poison_arrow: { ic: "🏹", label: "Poison Arrow", mul: 0.8, dot: "poison", stk: 3 },
    bolt: { ic: "✦", label: "Magic Bolt", mul: 1.15 },
    foe_ward: { ic: "🔰", label: "Ward", buff: true, note: "soaks your spells" },
    mend: { ic: "✨", label: "Heal self", heal: 0.12 },
    poison_blade: { ic: "🗡", label: "Poisoned Blade", mul: 0.9, dot: "poison", stk: 3 },
    shadowstep: { ic: "👤", label: "Shadowstep", buff: true, note: "your next blow may miss" },
    pounce: { ic: "🐾", label: "Pounce", mul: 1.1, note: "and −stamina" },
    maul: { ic: "🐾", label: "Maul", mul: 0.9, dot: "bleeding", stk: 3 },
    howl: { ic: "📣", label: "Howl", buff: true, note: "hits 25% harder for 2 turns" },
    venom: { ic: "🕷", label: "Venom Spit", mul: 0.7, dot: "poison", stk: 3 },
    regen: { ic: "✨", label: "Regenerate", heal: 0.05 },
    force: { ic: "🗣", label: "Unrelenting Force", mul: 0.6, note: "and winds you", stk: 2, st: "Winded" },
    frost_breath: { ic: "❄", label: "Frost Breath", mul: 1.1 },
    life_drain: { ic: "🩸", label: "Drain Life", mul: 0.9, note: "and heals itself" },
    potion: { ic: "🧪", label: "Drink potion", heal: 0.18 },
  };

  /* a plain blow gets a name that fits the foe: a wolf bites, a bear swipes, an archer shoots, a mage casts */
  const BLOWS = [
    [/wolf|hound|dog|skeever|fox|horker|slaughterfish|spider|chaurus|frostbite/i, "🦷", "Bite"],
    [/bear|sabre|cat|troll|werewolf|hagraven|spriggan|lurker|gargoyle/i, "🐾", "Claw Swipe"],
    [/dragon/i, "🐉", "Bite"],
    [/mammoth|giant/i, "🔨", "Stomp"],
    [/atronach|wisp|ghost|wraith|lich|mage|necromancer|conjurer|wizard|witch|warlock|sorcer/i, "✦", "Spell"],
    [/archer|hunter|ranger|scout|marksman|bowman/i, "🏹", "Shoot"],
  ];
  function blowOf(f) {
    const e = f?.e || {}, nm = String(e.name || ""), arch = e.arch;
    if (arch === "archer") return ["🏹", "Shoot"];
    if (arch === "mage") return ["✦", "Spell"];
    for (const [re, ic, l] of BLOWS) if (re.test(nm)) return [ic, l];
    if (f?.tags?.has?.("beast") || f?.tags?.has?.("animal")) return ["🐾", "Claw Swipe"];
    return ["⚔", arch === "brute" ? "Heavy Swing" : "Strike"];
  }

  /* decide the foe's actions for the rest of this round (call at the start of a round, or when a new foe steps in) */
  function foeLeft(sess) {
    const ord = sess.order || [];
    let n = 0;
    for (let i = Math.max(0, sess.idx || 0); i < ord.length; i++) if (ord[i].id.startsWith("foe")) n++;
    return n;
  }
  function plan(sess) {
    const f = sess.f;
    if (typeof FOEKIT === "undefined" || !f.kit || f.dStance) return [];
    return FOEKIT.plan(f, foeLeft(sess));
  }

  /* a plain blow on you: [low, high, mid] after your armour and guard (the same sums as the engine, without dice) */
  function blow(sess) {
    const f = sess.f, e = f.e || {};
    let d = (e.damage || 5) * (f.slowed ? 0.5 : 1) * (f.disarmed > 0 ? 0.6 : 1);
    const fp = f.fp; if (fp) d *= fp.caster ? fp.spell || 1 : fp.dmg || 1;
    try { const { rating, pieces } = f.armorRating(); d *= 1 - F.damageReduction(rating, pieces); } catch (x) { /* no armour info */ }
    if (f.kit?.rage > 0) d *= 1.25;
    if (f.tbGuard) d *= 1 - f.tbGuard;
    const [a, b] = spread();
    return [d * a, d * b, d];
  }
  const capOf = (sess) => { const mh = typeof G !== "undefined" ? G.maxHealth(sess.f.s) : 100; return (typeof TB !== "undefined" ? TB.HIT_CAP : 0.4) * mh; };

  /* what the foe will do with its remaining actions this round: [{ ic, label, lo, hi, mid, big, tele, buff, heal, note }] */
  function intents(sess) {
    const f = sess.f;
    if (sess.done || f.ehp <= 0) return [];
    const n = foeLeft(sess); if (!n) return [];
    const stunned = f.tbStunLeft > 0;   // your shield bash: it loses its turns this round
    const [lo, hi, mid] = blow(sess), cap = capOf(sess), hpNow = f.hp;
    const capd = (v) => (hpNow > cap ? Math.min(v, cap) : v);
    const out = [];
    const pl = f.kit?.plan || [];
    for (let i = 0; i < n; i++) {
      if (stunned || (f.eParalyzed || 0) > i || (i === 0 && f.stagger) || (f.calmTurns || 0) > i) { out.push({ ic: "💫", label: stunned ? "Stunned" : (f.calmTurns || 0) > i ? "Not fighting" : "Can't act", lo: 0, hi: 0, mid: 0, skip: true }); continue; }
      if (f.dStance && !pl[i]?.bf) { out.push({ ic: "🐉", label: "Dragon", lo: capd(lo), hi: capd(hi * 1.3), mid: capd(mid), unknown: true }); continue; }
      const p = pl[i];
      const key = !p ? "blow" : p.id === "land" ? p.wind : p.id;
      const it = INTENT[key] || INTENT.blow;
      const o = { ic: it.ic, label: it.label, big: !!it.big, tele: !!it.tele, buff: !!it.buff, note: it.note || "", dot: it.dot || null, id: key, stk: it.stk || 0, st: it.st || "" };
      if (key === "blow") { const [bi, bl] = blowOf(f); o.ic = bi; o.label = bl; }
      if (it.heal) { o.heal = r0((f.ehp0 || sess.ehpMax || f.ehp) * it.heal); o.lo = o.hi = o.mid = 0; }
      else if (it.mul) { o.lo = capd(lo * it.mul); o.hi = capd(hi * it.mul); o.mid = capd(mid * it.mul); }
      else { o.lo = o.hi = o.mid = 0; }
      if (it.dot && f.e) o.dotDmg = Math.max(1, r0((f.e.damage || 5) * (it.dot === "bleeding" ? 0.2 : 0.35)));
      out.push(o);
    }
    return typeof FOEINTENT !== "undefined" ? FOEINTENT.tag(sess, out) : out;   // foeintent.js: who each one goes for
  }

  /* how much health goes this round, before your next turn: blows on you, your poison/burning, and the foe's own burning */
  function forecast(sess) {
    const f = sess.f, its = intents(sess), n = its.length;
    const allies = (f.allies || []).filter((a) => !a.down && a.hp > 0).length;
    const pMe = allies ? 1 - (allies / (allies + 1)) * 0.7 : 1;   // the engine's odds that a blow comes at you, not a teammate
    const me = { hit: 0, dot: 0, heal: 0, parts: [] }, foe = { dot: 0, heal: 0, parts: [] };
    const known = its.some((it) => it.tgt);   // foeintent.js: the targets are rolled already, so only the blows aimed at you count
    const hitSum = known ? its.reduce((a, it) => a + (it.tgt && it.tgt.me ? it.mid || 0 : 0), 0) : its.reduce((a, it) => a + (it.mid || 0), 0) * pMe;
    const atMe = known ? its.filter((it) => it.tgt && it.tgt.me && it.mid).length : n;
    if (hitSum >= 1) { me.hit = r0(hitSum); me.parts.push({ k: "hit", ic: "⚔", n: me.hit, t: known ? `${atMe} foe ${atMe === 1 ? "blow" : "blows"} aimed at you this round` : `${n} foe ${n === 1 ? "action" : "actions"} left this round${allies ? " (some may go at your teammates)" : ""}` }); }
    if (f.kitDot && n) {   // ticks at the start of each foe action
      const d = Math.min(f.hp - 1, f.kitDot.dmg * Math.min(f.kitDot.turns, n));
      if (d >= 1) { me.dot += d; me.parts.push({ k: f.kitDot.name === "burning" ? "burn" : f.kitDot.name === "bleeding" ? "bleed" : "poison", ic: f.kitDot.name === "burning" ? "🔥" : f.kitDot.name === "bleeding" ? "🩸" : "☠", n: r0(d), t: `${f.kitDot.name}: ${r0(f.kitDot.dmg)} each foe turn, ${f.kitDot.turns} more` }); }
    }
    if (f.meSt?.burn) { me.dot += f.meSt.burn.dmg; me.parts.push({ k: "burn", ic: "🔥", n: r0(f.meSt.burn.dmg), t: `burning: ${r0(f.meSt.burn.dmg)} at the end of the round, ${f.meSt.burn.turns} more` }); }
    if (f.regen) { me.heal += f.regen.amt; me.parts.push({ k: "heal", ic: "✚", n: r0(f.regen.amt), t: "healing at the end of the round" }); }
    me.dot = r0(me.dot);
    if (f.ehp > 0) {
      const el = (x) => (typeof MAGIC !== "undefined" && MAGIC.elem ? MAGIC.elem(f, x) : 1);
      const add = (k, ic, v, t) => { if (v >= 1) { foe.dot += v; foe.parts.push({ k, ic, n: r0(v), t }); } };
      if (f.foeSt?.burn) add("burn", "🔥", f.foeSt.burn.dmg, `burning, ${f.foeSt.burn.turns} more`);
      if (f.bleed?.length) add("bleed", "🩸", f.bleed.reduce((a, y) => a + y.dmg, 0), "bleeding");
      for (const x of f.dots || []) add(x.el === "fire" ? "burn" : "dot", x.el === "fire" ? "🔥" : x.el === "frost" ? "❄" : x.el === "shock" ? "⚡" : "☠", x.dmg * el(x.el), `${x.name}, ${x.turns} more`);
      if (f.cloak) add("cloak", f.cloak.el === "frost" ? "❄" : f.cloak.el === "shock" ? "⚡" : "🔥", f.cloak.dmg * el(f.cloak.el), `${f.cloak.name}, ${f.cloak.turns} more`);
      foe.dot = r0(foe.dot);
      const h = its.reduce((a, it) => a + (it.heal || 0), 0);
      if (h) { foe.heal = h; foe.parts.push({ k: "heal", ic: "✚", n: h, t: "it plans to heal" }); }
    }
    return { me, foe, intents: its };
  }

  /* ------------------------------------------------------------------ what the screen shows */
  const pc = (v, m) => (100 * Math.max(0, Math.min(v, m)) / Math.max(1, m)).toFixed(1);
  /* stripes on a health bar for what's coming off it (and a green edge for what comes back) */
  function barMarks(now, max, loss, gain, kind) {
    let h = "";
    if (loss >= 1) { const l = Math.min(loss, now); h += `<s class="tbfc ${kind}" style="left:${pc(now - l, max)}%;width:${pc(l, max)}%" aria-hidden="true"></s>`; }
    if (gain >= 1 && now < max) h += `<s class="tbfc gain" style="left:${pc(now, max)}%;width:${pc(Math.min(gain, max - now), max)}%" aria-hidden="true"></s>`;
    return h;
  }
  function line(parts, lead, who) {
    if (!parts.length) return "";
    const tip = parts.map((p) => `${p.k === "heal" ? "+" : "−"}${p.n}: ${p.t}`).join(". ");
    const tot = parts.filter((p) => p.k !== "heal").reduce((a, p) => a + p.n, 0);
    return `<div class="tbfcl ${who}" data-tip="${esc(`${lead} ${tip}.`)}">${parts.map((p) => `<span class="fp ${p.k}">${p.ic} ${p.k === "heal" ? "+" : "−"}${p.n}</span>`).join("")}${tot && parts.length > 1 ? `<b>≈ −${tot}</b>` : ""}</div>`;
  }
  /* your own statuses as labelled chips: poison and burning say how much a turn and for how long */
  function myChips(f) {
    const out = [];
    const k = f.kitDot;
    if (k) { const nm = k.name === "burning" ? "Burning" : k.name === "bleeding" ? "Bleeding" : "Poisoned"; out.push(`<i class="st me ${k.name === "burning" ? "burn" : k.name === "bleeding" ? "bleed" : "poison"}" data-tip="${esc(`${nm}: you lose ${r0(k.dmg)} health each time a foe acts, ${k.turns} more times. A Cure Poison potion or winning the fight ends it.`)}">${k.name === "burning" ? "🔥" : k.name === "bleeding" ? "🩸" : "☠"} ${nm} −${r0(k.dmg)}<small>×${k.turns}</small></i>`); }
    const ms = f.meSt || {};
    if (ms.burn) out.push(`<i class="st me burn" data-tip="${esc(`Burning: −${r0(ms.burn.dmg)} health at the end of the round, ${ms.burn.turns} more rounds.`)}">🔥 Burning −${r0(ms.burn.dmg)}<small>×${ms.burn.turns}</small></i>`);
    if (ms.chill) out.push(`<i class="st me chill" data-tip="Chilled: your stamina doesn't come back this round.">❄ Chilled<small>×${ms.chill.turns}</small></i>`);
    if (ms.shock) out.push(`<i class="st me shock" data-tip="Jolted: the shock drained some magicka.">⚡ Jolted<small>×${ms.shock.turns}</small></i>`);
    if (f.regen) out.push(`<i class="st me heal" data-tip="${esc(`Healing: +${r0(f.regen.amt)} health at the end of each round, ${f.regen.turns} more.`)}">✚ +${r0(f.regen.amt)}<small>×${f.regen.turns}</small></i>`);
    if (f.tbGuard > 0) out.push(`<i class="st me guard" data-tip="${esc(`Guard up: the next blows do ${r0(f.tbGuard * 100)}% less.`)}">🛡 −${r0(f.tbGuard * 100)}%</i>`);
    return out.length ? `<div class="tbst mine">${out.join("")}</div>` : "";
  }
  const rng = (it) => (it.lo || it.hi ? (r0(it.lo) === r0(it.hi) ? `${r0(it.hi)}` : `${r0(it.lo)}–${r0(it.hi)}`) : "");
  function intentTip(it, name) {
    if (it.skip) return `${name}: ${it.label.toLowerCase()} this turn.`;
    if (it.unknown) return `${name} attacks: about ${rng(it)} damage (dragons fly, land and breathe as they please).`;
    if (it.heal) return `${name} will heal itself about ${it.heal}.`;
    if (it.buff || it.tele) return `${name}: ${it.label} (${it.note}). No damage this turn.${it.tele ? " Guard, or hit it hard to break it." : ""}`;
    return `${name}: ${it.label} for about ${rng(it)} damage${it.dot ? ` and ${it.stk || ""} ${it.stk ? "stacks of " : ""}${it.dot} (${it.dotDmg} a turn)` : it.stk ? ` and ${it.stk} ${stkName(it)} stacks` : ""}${it.note ? ` ${it.note}` : ""}. ${it.tgt && !it.tgt.me ? "Their" : "Your"} armour and guard are counted.`;
  }
  /* "Poison 3", "Winded 2": the stacks a move puts on its target (stacks.js) */
  const stkName = (it) => (it.st ? it.st : it.dot === "bleeding" ? "Bleed" : it.dot === "burning" ? "Burn" : it.dot ? "Poison" : "");
  const stkTxt = (it) => (it.stk && stkName(it) ? `${tr(stkName(it))} ${it.stk}` : "");
  /* an intent chip: icon, the move's NAME, its numbers, the stacks it puts on and who it goes for */
  function intentHTML(it, name) {
    const cls = it.skip ? "skip" : it.big ? "big" : it.tele ? "tele" : it.heal ? "heal" : it.buff ? "buff" : "hit";
    const n = it.heal ? `+${it.heal}` : rng(it), sk = stkTxt(it);
    const FI = typeof FOEINTENT !== "undefined" ? FOEINTENT : null;   // foeintent.js: "→ Lydia"
    return `<span class="tbint ${cls}${it.tgt ? " tgt" : ""}" data-tip="${esc(intentTip(it, name) + (FI ? FI.tipText(it, name) : ""))}"><i class="ic" aria-hidden="true">${it.ic}</i> <b class="w">${esc(tr(it.label))}</b>${n ? ` <b class="n">${n}</b>` : ""}${sk ? `<em class="sk">${it.dot === "bleeding" ? "🩸" : it.st ? "💫" : "☠"} ${esc(sk)}</em>` : ""}${FI ? FI.chipHTML(it) : ""}</span>`;
  }
  /* "🕷 Venom Spit → Meeko" for the log and the banner while the foe acts */
  function actName(it, sess) {
    if (!it || it.skip) return null;
    const t = it.tgt ? (it.tgt.me ? "you" : it.tgt.n) : "";
    return { ic: it.ic, name: it.label, tgt: t, stk: stkTxt(it), big: !!it.big };
  }
  /* the foe frame: "Next:" and its intents; plus the forecast lines under both bars */
  function panels(sess) {
    const fc = forecast(sess), f = sess.f, nm = f.e?.name || "Foe";
    const intents = fc.intents.length ? `<div class="tbints" aria-label="What the foe will do"><small>Next</small>${fc.intents.map((it) => intentHTML(it, nm)).join("")}</div>` : "";
    return {
      fc,
      intents,
      bubble: fc.intents[0] && !fc.intents[0].skip ? `<div class="tbbub ${fc.intents[0].big ? "big" : fc.intents[0].tele ? "tele" : fc.intents[0].heal ? "heal" : ""}" aria-hidden="true">${intentHTML(fc.intents[0], nm)}</div>` : "",
      meLine: line(fc.me.parts, "This round, before your next turn:", "me"),
      foeLine: line(fc.foe.parts, "At the end of this round:", "foe"),
      meMarks: (now, max) => barMarks(now, max, fc.me.hit + fc.me.dot, fc.me.heal, fc.me.dot > fc.me.hit ? "dot" : "hit"),
      foeMarks: (now, max) => barMarks(now, max, fc.foe.dot, fc.foe.heal, "dot"),
    };
  }

  /* ------------------------------------------------------------------ playing the turn out */
  const paced = () => true;   // build 146: no Fast mode any more
  /* how long one event stays on screen before the next one (ms) */
  function delay(e) {
    if (!e) return 0;
    if (e.kind === "round") return e.round > 1 ? 1500 : 500;
    if (e.kind === "foe") return 1150;
    if (e.kind === "tick") return 950;
    if (e.kind === "end") return 700;
    if (e.kind === "ally") return 800;
    return 650;
  }
  /* last round in numbers: what you dealt, what you took */
  function summary(sess, r) {
    const evs = sess.ev.filter((e) => e.round === r && e.kind !== "round");
    if (!evs.length) return null;
    const start = sess.ev.find((e) => e.round === r && e.kind === "round") || evs[0];
    const endE = evs[evs.length - 1];
    const waveChange = evs.some((e) => e.wave);
    let dealt = evs.filter((e) => e.kind === "me" || e.kind === "ally" || e.kind === "sum").reduce((a, e) => a + (e.dmg || 0), 0);
    if (!waveChange && start.ehp != null && endE.ehp != null) dealt = Math.max(dealt, start.ehp - endE.ehp);
    const took = start.hp != null && endE.hp != null ? Math.max(0, start.hp - endE.hp) : evs.filter((e) => e.kind === "foe").reduce((a, e) => a + (e.dmg || 0), 0);
    const healed = evs.reduce((a, e) => a + (e.healed || 0), 0);
    return { dealt: r0(dealt), took: r0(took), healed: r0(healed) };
  }
  /* a banner for the event that just showed: a new round (with the last one's numbers) or the foe's turn */
  function banner(e, prev, sess) {
    if (!e) return null;
    if (e.kind === "round" && e.round > 1) {
      const s = summary(sess, e.round - 1);
      return { cls: "round", t: `Round ${e.round}`, sub: s ? `Last round: you dealt <b class="d">${s.dealt}</b> · took <b class="t">${s.took}</b>${s.healed ? ` · healed <b class="h">${s.healed}</b>` : ""}` : "" };
    }
    if (e.kind === "foe" && e.act && !e.wave) return { cls: "foe act" + (e.act.big ? " big" : ""), t: `${e.act.ic} ${tr(e.act.name)}${e.act.tgt ? ` → ${e.act.tgt === "you" ? tr("you") : e.act.tgt}` : ""}`, sub: `${esc(sess.f.e?.name || "Foe")}${e.act.stk ? ` · ${esc(e.act.stk)}` : ""}` };
    if (e.kind === "foe" && !(prev && prev.kind === "foe") && !e.wave) return { cls: "foe", t: `${sess.f.e?.name || "Foe"}'s turn` };
    return null;
  }
  /* the dock's line while a turn plays out */
  function who(e, sess) {
    if (!e) return "";
    if (e.kind === "foe") return e.act ? `${sess.f.e?.name || "The foe"}: ${e.act.ic} ${tr(e.act.name)}` : `${sess.f.e?.name || "The foe"}'s turn…`;
    if (e.kind === "round") return `Round ${e.round}`;
    if (e.kind === "tick") return "End of the round…";
    if (e.kind === "ally") return `${e.name || "Your ally"} acts…`;
    if (e.kind === "sum") return "Your summon acts…";
    if (e.kind === "end") return "";
    return "You…";
  }
  const bannerHTML = (b) => (b ? `<div class="tbban ${b.cls}">${esc(b.t)}${b.sub ? `<small>${b.sub}</small>` : ""}</div>` : "");

  /* ------------------------------------------------------------------ sounds */
  /* the sound for one event as it shows (blows themselves sound from the fight scene) */
  function cue(e, prev) {
    if (!e) return null;
    const t = e.text || "";
    if (e.kind === "round" && e.round > 1) return "round";
    if (e.kind === "foe") {
      if (/winding up|takes careful aim/i.test(t)) return "windup";
      if (/healing (spell|potion)|wounds close|: \+\d/i.test(t)) return "heal";
      if (/^you take \d+ from (poison|venom)/i.test(t) && !/hits|strikes|slams|casts|cuts|bites/.test(t.split(" · ")[1] || "")) return "dot-poison";
      if (!(prev && prev.kind === "foe")) return "turn-foe";
      return null;
    }
    if (e.kind === "tick") return /burn/i.test(t) ? "dot-burn" : /poison|venom/i.test(t) ? "dot-poison" : /\+\d+ health|mends/i.test(t) ? "heal" : "dot";
    return null;
  }
  function play(name, delaySec = 0) { try { if (name && typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx(name, delaySec); } catch (x) { /* never break a fight for a sound */ } }

  /* ------------------------------------------------------------------ low health: red pulsing edges and a heartbeat */
  let beatT = null;
  function low(el, frac, on) {
    if (!DOM || !el) return;
    const isLow = on && frac > 0 && frac < LOW;
    el.classList.toggle("tblow", isLow);
    if (isLow && !beatT) { play("heartbeat"); beatT = setInterval(() => { if (!document.getElementById("tbf")) return stop(); if (document.getElementById("tbf").classList.contains("tblow")) play("heartbeat"); }, 1300); }
    else if (!isLow && beatT) stop();
  }
  function stop() { clearInterval(beatT); beatT = null; }

  return { INTENT, BLOWS, blowOf, actName, stkTxt, LOW, plan, foeLeft, blow, intents, forecast, panels, myChips, barMarks, paced, delay, summary, banner, bannerHTML, who, cue, play, low, stop };
})();
if (typeof module !== "undefined") module.exports = FIGHTREAD;
