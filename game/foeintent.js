/* Foe intents with a target: every foe move shows what it is AND who it goes for. [OURS]
   Remigiusz: "Enemies should show their intent and their target."
   - When a round's intents are rolled (fightread.js plan), each foe action also picks its target right then: you, a
     follower (Lydia), a summon or a thrall, or another player in a shared party fight. The odds are the old ones from
     engine.js enemyTurnInner (you're still the main target; back-row followers draw 0.6x, Defensive ones 1.3x; foes go
     for party healers; a co-op guard steps in), only rolled earlier, so balance doesn't move.
   - When the foe acts, engine.js uses that target (f.tgtNow). It changes only for a real reason, and the screen shows it
     first: the target was knocked down or left (a new roll), or a follower steps in front of you ("cover"). A wind-up or
     a "takes aim" keeps its target for the blow that follows.
   - On screen: "→ Lydia" on each intent chip, a red crosshair on the card of whoever is targeted (the next blow's target
     gets a red outline), a thin ellipse on the ground under them in the battle scene, and a faint dashed arc from the
     foe to them while you aim (fightdeclutter.js; still under reduce motion).
   - Shared party fights: the targets live on the fight (f.foeTgts, one of TB.FOE_KEYS), so every phone shows the same
     ones; "you" is whoever is looking.
   Pure helpers (roll, plan, refresh, next, labels) work in node; decorate() needs a page. */
const FOEINTENT = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r0 = (v) => Math.round(v);
  const HOST = "host";
  let seq = 0;

  // ------------------------------------------------------------------ who's who
  /* a stable key for someone in the fight: "host" is the phone running the fight; others get the same key as the
     shared-fight roster (tbfight.js shared(): "p:<id>" for players, the ally's tbk otherwise) */
  const keyOf = (a) => (!a ? HOST : a.tbk || (a.tbk = a.pid ? "p:" + a.pid : "i" + ++seq));
  const kindOf = (a) => (!a ? "you" : a.player ? "player" : a.fsum || a.summon || a.summonOf ? "summon" : a.thrall ? "thrall" : a.follower || a.kind === "follower" || a.fai ? "follower" : "ally");
  const ICON = { you: "", player: "", follower: "", summon: "✦", thrall: "", ally: "" };
  const descOf = (a, f) => ({ k: keyOf(a), n: a ? String(a.name || "Ally") : String(f?.s?.name || "You"), kind: kindOf(a) });
  const liveAllies = (f) => (f.allies || []).filter((a) => a && !a.down && !(a.hp != null && a.hp <= 0));
  const findAlly = (f, k) => (k === HOST ? null : liveAllies(f).find((a) => keyOf(a) === k) || undefined);

  /* the engine's odds, rolled now: null = you, or the ally it goes for */
  function roll(f, rnd = Math.random) {
    const all = f.allies || [];
    if (!all.length) return null;
    let al = null;
    const healer = all.find((a) => !a.down && a.player && (a.role === "healer" || a.heals > 0));   // party fights: healers first (tbfight.js foeAct)
    if (healer && rnd() < 0.5) al = healer;
    else {
      const aw = typeof FAI !== "undefined" ? FAI.aggro(f) : all.length;
      if (rnd() < aw / (aw + 1) * 0.7) al = typeof FAI !== "undefined" ? FAI.pickAlly(f) : all[Math.floor(rnd() * all.length)];
    }
    if (al && al.coop) { const g = all.find((a) => a.coop && !a.down && a.role === "guard"); if (g && g !== al && rnd() < 0.5) al = g; }   // coop.js: a guard steps in
    return al;
  }

  // ------------------------------------------------------------------ the plan for this round
  const HEALS = new Set(["mend", "regen", "potion"]);
  /* does this planned move go at someone? (buffs and heals don't; a wind-up or "takes aim" points at its next blow) */
  function hits(p) {
    if (!p || p.id === "blow" || p.id === "land") return true;
    const M = typeof FOEKIT !== "undefined" ? FOEKIT.MOVES[p.id] : null;
    return !!M && !M.buff && !M.tele && !HEALS.has(p.id);
  }
  const aims = (p) => !!p && (p.id === "wind_up" || p.id === "take_aim");
  const foeSlots = (sess) => (typeof FIGHTREAD !== "undefined" ? FIGHTREAD.foeLeft(sess) : (sess.order || []).slice(sess.idx || 0).filter((o) => String(o.id).startsWith("foe")).length);

  /* roll a target for each foe action left this round (call right after FIGHTREAD.plan) */
  function plan(sess, rnd = Math.random) {
    if (!sess || sess.mirror || !sess.f) return [];
    const f = sess.f, n = foeSlots(sess), pl = f.kit?.plan || [], out = [];
    for (const a of f.allies || []) keyOf(a);
    for (let i = 0; i < n; i++) {
      const p = pl[i];
      let d = null;
      if (i === 0 && p && p.id === "land" && sess.windTgt && findAlly(f, sess.windTgt.k) !== undefined) d = { ...sess.windTgt };   // last round's wind-up lands on the same one
      else if (i > 0 && aims(pl[i - 1]) && out[i - 1]) d = { ...out[i - 1], why: null };
      else d = descOf(roll(f, rnd), f);
      out.push(d);
    }
    sess.windTgt = null;
    if (n && aims(pl[n - 1])) sess.windTgt = out[n - 1];
    f.foeTgts = out;
    return out;
  }
  /* keep the shown targets true before anyone looks: someone knocked down gets a new roll, a follower who steps in front
     of you takes the next blow. Returns true when something changed. */
  function refresh(sess, rnd = Math.random) {
    if (!sess || sess.mirror || !sess.f || !Array.isArray(sess.f.foeTgts)) return false;
    const f = sess.f, ts = f.foeTgts, pl = f.kit?.plan || [];
    let changed = false;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i]; if (!t) continue;
      if (findAlly(f, t.k) === undefined) {   // knocked down, faded away or left the fight
        const was = t.n, nt = descOf(roll(f, rnd), f);
        ts[i] = { ...nt, why: "down", from: was }; changed = true;
        if (i + 1 < ts.length && aims(pl[i]) && ts[i + 1] && ts[i + 1].k === t.k) ts[i + 1] = { ...ts[i] };
      }
    }
    const cov = f.coverAl && (f.allies || []).includes(f.coverAl) ? f.coverAl : null;   // followerai.js: "steps in front of you"
    if (cov) {
      const i = ts.findIndex((t, j) => t && hits(pl[j]));
      const k = keyOf(cov);
      if (i >= 0 && ts[i].k !== k) { ts[i] = { ...descOf(cov, f), why: "cover", from: ts[i].n }; changed = true; }
    }
    return changed;
  }
  /* the foe is about to act (tbfight.js foeAct): hand the engine this action's target. Returns its descriptor. */
  function next(sess, rnd = Math.random) {
    const f = sess?.f; if (!f) return null;
    refresh(sess, rnd);
    let d = Array.isArray(f.foeTgts) && f.foeTgts.length ? f.foeTgts.shift() : null;
    let al = d ? findAlly(f, d.k) : undefined;
    if (!d || al === undefined) { al = roll(f, rnd); d = { ...descOf(al, f), why: d ? "down" : null, from: d ? d.n : null }; }   // no plan (an ambush before round 1): roll now
    const cov = f.coverAl && (f.allies || []).includes(f.coverAl) ? f.coverAl : null;   // someone stepped in front (engine.js takes them first)
    if (cov && al !== cov) { d = { ...descOf(cov, f), why: "cover", from: d.n }; al = cov; }
    f.tgtNow = al;   // engine.js enemyTurnInner reads it
    f.tgtHit = undefined;
    sess.tgtLast = d;
    return d;
  }
  /* after the foe's action: nothing left hanging for the next one */
  function done(sess) { const f = sess?.f; if (f) { f.tgtNow = undefined; f.tgtFixed = false; } }
  /* the log line names who a wind-up or a shot is meant for ("takes careful aim at Lydia...") */
  function say(sess, t) {
    const d = sess?.tgtLast; if (!d || d.k === HOST || typeof t !== "string") return t;
    return t.replace(/\b(aim|swings a shield|lunges) at you\b/g, `$1 at ${d.n}`);
  }

  // ------------------------------------------------------------------ what the screen says
  /* the key of whoever is looking at this screen */
  const myKey = (sess) => (sess && sess.mirror ? "p:" + sess.me : HOST);
  /* "you", "Lydia", "Alfa" (first name only, it sits on a small chip) */
  function label(d, sess) {
    if (!d) return "";
    if (d.k === myKey(sess)) return "you";
    return String(d.n || "ally").split(" ")[0];
  }
  /* rough damage a blow does to an ally: the engine's sums for them (engine.js, followerai.js hitSummon, coop.js hitAlly),
     without dice. A foe's special moves hit an ally like a plain blow (foekit.js scales only blows on you). */
  function allyBlow(f, al) {
    const e = f.e || {}, s = f.s;
    let d = e.damage || 5;
    if (al.fsum) d *= 0.8;
    else if (al.coop) d *= (1 - (al.red || 0)) * (al.role === "guard" ? 0.6 : 1);
    else if (al.follower) d *= typeof FOL2 !== "undefined" && s && al.fid === s.follower?.id ? FOL2.taken(s) : 0.8;
    else d *= 1 - (al.red || 0);
    const sp = typeof F !== "undefined" && F.DAMAGE_SPREAD ? F.DAMAGE_SPREAD : [0.8, 1.2];
    return [d * sp[0], d * sp[1], d];
  }
  /* fightread.js intents(): put the target on each intent (and an ally's own numbers when it goes for them) */
  function tag(sess, its) {
    const f = sess?.f; if (!f || !Array.isArray(its)) return its;
    const ts = Array.isArray(f.foeTgts) ? f.foeTgts : [];
    its.forEach((it, i) => {
      const d = ts[i]; if (!d || it.skip || it.heal || (it.buff && !it.tele)) return;
      it.tgt = { ...d, label: label(d, sess), me: d.k === myKey(sess) };
      const al = d.k !== myKey(sess) && d.k !== HOST ? findAlly(f, d.k) : null;
      if (al && (it.lo || it.hi)) { const [lo, hi, mid] = allyBlow(f, al); it.lo = lo; it.hi = hi; it.mid = mid; }   // their own armour, not yours
      if (d.k !== HOST) { it.dot = null; if (it.id !== "force") it.note = ""; }   // poison, lost stamina and winding only land on the leader's own hero (a shout knocks them back anyway)
    });
    return its;
  }
  const WHY = { cover: (d) => `${d.n} stepped in front of ${d.from === d.n ? "the blow" : d.from === "you" ? "you" : d.from || "you"}`, down: (d) => `${d.from || "its target"} is down, so it turns to ${d.n}` };
  /* a few words for the chip and the tooltip */
  const chipHTML = (it) => (it.tgt ? `<span class="fitg${it.tgt.me ? " me" : ""}${it.tgt.why ? " re" : ""}">→ ${esc(it.tgt.label)}</span>` : "");
  function tipText(it, name) {
    const t = it.tgt; if (!t) return "";
    const who = t.me ? "you" : t.n;
    return ` Target: ${who}.${t.why && WHY[t.why] ? ` (${WHY[t.why](t)}.)` : ""}`;
  }
  /* the target of the foe's next action that goes at someone, and every target this round by key */
  function summary(sess) {
    const f = sess?.f; if (!f || !Array.isArray(f.foeTgts) || sess.done || !(f.ehp > 0)) return { next: null, by: new Map() };
    const its = typeof FIGHTREAD !== "undefined" ? FIGHTREAD.intents(sess) : [];
    const by = new Map(); let nxt = null;
    its.forEach((it, i) => {
      if (!it.tgt) return;
      if (!nxt) nxt = { ...it.tgt, it };
      if (!by.has(it.tgt.k)) by.set(it.tgt.k, []);
      by.get(it.tgt.k).push(it);
    });
    return { next: nxt, by };
  }

  // ------------------------------------------------------------------ on the page
  const rangeOf = (it) => (it.heal ? "" : it.lo || it.hi ? (r0(it.lo) === r0(it.hi) ? `${r0(it.hi)}` : `${r0(it.lo)}–${r0(it.hi)}`) : it.label);
  /* after the fight screen draws: crosshairs on the targeted cards and an arrow in the scene */
  function decorate(el, sess) {
    if (!DOM || !el || !sess) return;
    el.querySelectorAll(".fitm,.fitarrow").forEach((x) => x.remove());
    el.querySelectorAll(".fit-on,.fit-next").forEach((x) => x.classList.remove("fit-on", "fit-next"));
    if (el.classList.contains("tbplay") || sess.done) return;
    const { next: nx, by } = summary(sess);
    if (!by.size) return;
    const f = sess.f, foeN = f.e?.name || "The foe", me = myKey(sess);
    const cardOf = (k) => {
      if (k === me) return el.querySelector(".tbu.me");
      const i = (f.allies || []).findIndex((a) => keyOf(a) === k);
      return i >= 0 ? el.querySelector(`.tbu.ally[data-ally="${i}"]`) : null;
    };
    for (const [k, list] of by) {
      const card = cardOf(k); if (!card) continue;
      const isNext = nx && nx.k === k;
      card.classList.add("fit-on"); if (isNext) card.classList.add("fit-next");
      const who = k === me ? "you" : list[0].tgt.n;
      const tip = `${foeN} goes for ${who}: ${list.map((it) => `${it.ic} ${it.label.toLowerCase()} ${rangeOf(it)}`.trim()).join(", ")}.${isNext ? " Its next move comes here first." : ""}`;
      const m = document.createElement("span");
      m.className = "fitm" + (isNext ? " next" : "");
      m.setAttribute("data-tip", tip); m.setAttribute("role", "img"); m.setAttribute("aria-label", tip);
      m.innerHTML = `<i class="xh" aria-hidden="true"></i><b aria-hidden="true">${list.map((it) => it.ic).join("")}</b>${list.length > 1 ? `<small aria-hidden="true">×${list.length}</small>` : ""}`;
      card.appendChild(m);
    }
    if (nx) arrow(el, sess, nx);
  }
  /* the dashed arrow in the battle scene, from the foe to whoever its next blow is for (fightart.js puts you at 27% of the
     width, the foe at 72%, your allies in a line behind you) */
  let arrowTok = 0;
  function arrow(el, sess, nx, tries = 0, tok = ++arrowTok) {
    const stage = el.querySelector(".tbstage"), cv = stage?.querySelector(".tbscene canvas") || stage?.querySelector("canvas");   // .tbscene: combat2.js puts a blurred copy behind it
    const r = cv?.getBoundingClientRect();
    if (!stage || !cv || r.width < 40 || r.height < 30) {   // the scene draws its canvas a moment after the screen: try again shortly
      if (tries < 8 && typeof setTimeout !== "undefined") setTimeout(() => { if (tok === arrowTok && el.isConnected && !el.classList.contains("tbplay") && !sess.done) arrow(el, sess, nx, tries + 1, tok); }, 90);
      return;
    }
    if (stage.querySelector(".fitarrow")) return;
    const sr = stage.getBoundingClientRect();
    const f = sess.f, s = r.height / 150, gy = r.top - sr.top + r.height * 0.8;
    let fx = r.left - sr.left + r.width * 0.72, hx = r.left - sr.left + r.width * 0.27;
    let tx = hx, ty = gy, rk = 1, y0 = gy - 70 * s, y1 = gy - 62 * s;
    const FP = typeof FIGHTPOS !== "undefined" ? FIGHTPOS : null, fo = FP && FP.screenOf(cv, "foe");
    if (fo) {   // [fightpos] the spots fightart.js really drew everyone at (fightpos.js)
      const me = FP.screenOf(cv, "me"); fx = fo.x - sr.left; hx = me.x - sr.left; tx = hx;
      y0 = Math.max(fo.top - sr.top + 10 * s, gy - 70 * s); y1 = me.top - sr.top + 10 * s;
      const who = nx.me ? null : (f.allies || []).find((a) => keyOf(a) === nx.k), tg = who && FP.screenOf(cv, who.name);
      if (tg) { tx = tg.x - sr.left; ty = tg.y - sr.top; rk = tg.sc; y1 = tg.top - sr.top + 8 * s * tg.sc; }
    } else if (!nx.me) {   // someone in the line behind you (on a teammate's phone the leader stands there too)
      const ground = (f.allies || []).filter((a) => !a.down && !a.flyer);
      const i = Math.max(0, ground.findIndex((a) => keyOf(a) === nx.k));
      tx = hx - (26 + Math.min(i, 2) * 22) * s * (ground.length > 3 ? 0.7 : 1);
    }
    const mx = (fx + tx) / 2, my = Math.min(y0, y1) - 34 * s;
    const W = sr.width, H = sr.height;
    const sv = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sv.setAttribute("class", "fitarrow" + (nx.it?.big ? " big" : ""));
    sv.setAttribute("viewBox", `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`); sv.setAttribute("aria-hidden", "true");
    /* [fightdeclutter] a thin ellipse on the ground under the target, and a 2px dashed arc that the CSS only shows
       while you aim a move or rest on the foe's card (no big red crosshair) */
    const lw = 2;
    sv.innerHTML = `<defs><marker id="fitah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah"/></marker></defs>
      <path class="ln" d="M${fx.toFixed(1)},${y0.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${(tx + 10 * s).toFixed(1)},${y1.toFixed(1)}" stroke-width="${lw}" marker-end="url(#fitah)"/>
      <g class="tgt" transform="translate(${tx.toFixed(1)},${(ty - 1.5 * s * rk).toFixed(1)})"><ellipse class="gnd" rx="${(19 * s * rk).toFixed(1)}" ry="${(4.2 * s * rk).toFixed(1)}"/></g>`;
    stage.appendChild(sv);
  }

  // tooltips.js (PR #76): "intent:<n>" explains the foe's n-th move this round and its target
  if (typeof TIP !== "undefined" && TIP.register) {
    TIP.register("intent", (id) => {
      const sess = typeof TB !== "undefined" ? TB.session : null; if (!sess || typeof FIGHTREAD === "undefined") return null;
      const it = FIGHTREAD.intents(sess)[+id || 0]; if (!it) return null;
      return `<b class="tt-h">${esc(it.ic)} ${esc(it.label)}</b><p>${esc(rangeOf(it))}${it.tgt ? ` → ${esc(it.tgt.me ? "you" : it.tgt.n)}` : ""}</p>${it.tgt?.why && WHY[it.tgt.why] ? `<p class="tt-hint">${esc(WHY[it.tgt.why](it.tgt))}</p>` : ""}`;
    });
  }

  return { HOST, keyOf, kindOf, ICON, roll, hits, plan, refresh, next, done, say, myKey, label, allyBlow, tag, chipHTML, tipText, summary, decorate };
})();
if (typeof module !== "undefined") module.exports = FOEINTENT;
