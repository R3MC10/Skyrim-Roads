/* Rows: a front and a back row on both sides of a fight, and a group's foes on the field all at once. [OURS]
   Owner (26 Nov, combat step 5): rows decide protection and targeting only, never damage.
   - Heroes: your row comes from your gear (sword and shield, two-hander, two blades, dagger: front; bow, staff, a mage
     or healer with no weapon, or one whose Destruction / Restoration is 10+ above their best weapon skill: back). You can set Front / Back / Auto yourself in the Hero panel; it's saved with your
     loadout. Followers stand where their role puts them (followerai.js rowOf), party members send theirs with their
     card (coop.js), summons and pets stand in front. Nobody moves rows mid-fight.
   - Foes: a group (on your own 1-2, a party 2-6) stands on the field together, each with a role (foeroles.js) that
     puts it in the front or the back row. The engine still fights one foe at a time (f.e / f.ehp): the one you aim at
     is "loaded", the rest wait in sess.field with their own health and statuses, and get swapped in to act or to be hit.
     The foe side's moves a round and its total health are the same as before, only spread over the foes.
   - Reach: melee (blows, power attacks, bashes, cleaves) reaches only the front row while anyone stands in it; when
     the last one falls the back row is open. Bows, thrown things and direct spells reach both rows. The same rule
     holds for foes: their melee reaches your back row only when your front row is down (Cutthroats ambush it anyway).
   - Area spells: an Adept or Expert one hits the row of the foe you aim at, a Master one both rows; the foe you aim at
     takes it all, the others SPLASH of it.
   - A lone hero (any build) stands alone: foes reach them and they reach everything their weapon can.
   Pure helpers work in node; decorate() needs a page. Loaded after tbfight.js (index.html). */
const FOEFIELD = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r0 = (v) => Math.round(v || 0);
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const fmt = (t, ...a) => String(tr(t)).replace(/\{(\d)\}/g, (m, i) => a[+i]);
  const clone = (o) => (o == null || typeof o !== "object" ? o : typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  const SPLASH = { small: 0.4, major: 0.5 };   // what the other foes take from an area spell (tuned with the sims, see the PR)
  const SIDE = new Set(["kitDot", "dStance", "stk", "bf"]);   // these live on the fight, not on one foe
  const EXTRA = ["dots", "calmFrenzy", "areaHold", "_stagUsed", "splashTot", "_shocked"];
  const EKEYS = ["arch", "archLabel", "damage", "red", "element", "role", "row"];
  const HOLD = ["eParalyzed", "calmTurns", "fearTurns"];
  const pkeys = () => [...new Set([...(typeof TB !== "undefined" && TB.FOE_KEYS ? TB.FOE_KEYS : []).filter((k) => !SIDE.has(k)), ...EXTRA])];
  const RO = () => (typeof FOEROLES !== "undefined" ? FOEROLES : null);

  // ------------------------------------------------------------------ how many foes a party meets
  /* party size (you + other players) → foes: 1 → 1-2 (the lone-hero groups of foegroups.js), 2 → 2-3, 3 → 3, 4 → 4,
     5 → 4-5, 6 → 5, 7 → 5-6, 8 → 6. Total foe health and moves don't change with the count (tbfight.js). */
  function count(P, rnd = Math.random) {
    const T = { 2: [2, 3], 3: [3, 3], 4: [4, 4], 5: [4, 5], 6: [5, 5], 7: [5, 6], 8: [6, 6] }[Math.max(2, Math.min(8, P | 0))];
    return T[0] + (T[1] > T[0] && rnd() < 0.5 ? 1 : 0);
  }
  /* who the party meets: front-liners first, then a back row, then the rest (one of each before doubles) */
  const PLAN = ["warrior", "archer", "brute", "mage", "healer", "rogue", "chief", "warrior", "archer", "brute"];
  function compose(kind, n, P) {
    const FG = typeof FOEGROUPS !== "undefined" ? FOEGROUPS : null, list = FG && FG.KINDS[kind] ? FG.KINDS[kind] : null;
    if (!list) return null;
    const ok = (id) => list.includes(id) || (id === "healer" && P >= 5 && ["bandit", "forsworn", "vampire", "falmer"].includes(kind)) || (id === "chief" && P >= 7 && kind !== "skeleton");
    const out = [];
    for (const id of PLAN) { if (out.length >= n) break; if (ok(id)) out.push(id); }
    while (out.length < n) out.push(list[out.length % list.length]);
    return out;
  }

  // ------------------------------------------------------------------ hero rows
  const RANGED_WT = new Set(["bow", "crossbow"]);
  const casts = (s) => (s.spells || []).some((id) => { const sp = typeof D !== "undefined" ? D.SPELLS[id] : null; return sp && (sp.kind === "damage" || sp.kind === "heal"); });
  /* the row your gear puts you in (wt: your weapon type; staff: holding a staff) */
  function gearRow(wt, staff, s) {
    if (RANGED_WT.has(wt) || staff) return "back";
    if ((!wt || wt === "fist") && s && casts(s)) return "back";   // a mage or a healer with empty hands
    if (s && casts(s) && !RANGED_WT.has(wt)) {   // a mage still carrying the starting sword: their spells decide
      const lv = (k) => (s.skills && s.skills[k] ? s.skills[k].lvl || 0 : 0);
      const magic = Math.max(lv("Destruction"), lv("Restoration")), blade = Math.max(lv("One-Handed"), lv("Two-Handed"), lv("Hand-to-Hand"), lv("Spear"));
      if (magic >= blade + 10) return "back";
    }
    return "front";
  }
  const lo = (s) => { try { return s && s.loadouts ? s.loadouts[s.loadout] : null; } catch (e) { return null; } };
  /* your own choice (Hero panel), "auto" when you let your gear decide */
  const choice = (s) => { const r = lo(s)?.row; return r === "front" || r === "back" ? r : "auto"; };
  function setChoice(s, r) { const l = lo(s); if (!l) return false; if (r === "front" || r === "back") l.row = r; else delete l.row; return true; }
  /* your row from your save alone (the party card, the Hero panel) */
  function saveRow(s) {
    const c = choice(s); if (c !== "auto") return c;
    let wt = "fist", staff = false;
    try { const eq = G.loadout(s).equipment || {}, row = (s.inv || []).find((r) => r.id === eq.weapon), it = row && D.ITEMS[row.item]; if (it) { wt = G.wtype ? G.wtype(row.item) : "sword"; staff = !!it.staff; } } catch (e) { /* no gear */ }
    return gearRow(wt, staff, s);
  }
  /* your row in this fight */
  function myRow(f) {
    if (!f || !f.s) return "front";
    if (f._row) return f._row;
    const c = choice(f.s);
    return c !== "auto" ? c : gearRow(f.wt0 || f.wt, !!(f.weapon && f.weapon.staff), f.s);
  }
  /* an ally's row: their own (followers, party cards), else by what they are */
  function allyRow(a) {
    if (!a) return "front";
    if (a.row === "front" || a.row === "back") return a.row;
    if (a.fsum || a.summon || a.summonOf || a.pet || a.partyPet || a.thrall) return "front";
    if (a.bow || RANGED_WT.has(a.wt) || a.wt === "staff") return "back";
    if (a.role === "healer") return "back";
    return "front";
  }
  const rowOf = (f, a) => (a ? allyRow(a) : myRow(f));
  const standing = (f) => [null, ...(f.allies || []).filter((a) => a && !a.down && !(a.hp != null && a.hp <= 0))];
  const frontUp = (f) => standing(f).filter((a) => rowOf(f, a) === "front").length > 0;

  // ------------------------------------------------------------------ foe reach on heroes
  /* how the foe that's acting now reaches heroes: "melee", "ranged" or "assassin" (melee that goes round the front) */
  function foeReach(f) {
    const e = f.e || {}, role = e.role;
    if (f.dStance || e.player || e.pool) return "ranged";
    if (role === "assassin") return "assassin";
    if (role === "archer" || role === "mage" || role === "healer" || role === "commander") return "ranged";
    if (e.arch === "archer" || e.arch === "mage" || e.arch === "healer") return "ranged";
    if (/archer|mage|wizard|witch|warlock|necromancer|sorcer|conjurer|lich|priest|hagraven|wisp|atronach|spriggan/i.test(e.name || "")) return "ranged";
    return "melee";
  }
  /* may the acting foe go for this hero (null = you)? */
  function heroOk(f, a) {
    if (foeReach(f) !== "melee") return true;
    if (!frontUp(f)) return true;
    return rowOf(f, a) === "front";
  }
  /* foeintent.js roll(): the target it rolled, fixed to fit the rows and the foe's role. Cutthroats go round your front
     to your back row; melee that can't reach picks someone in front. */
  function fixTarget(f, al, rnd = Math.random) {
    const all = standing(f), reach = foeReach(f);
    if (all.length < 2) return al;
    if (reach === "assassin" && frontUp(f) && rnd() < 0.6) { const back = all.filter((a) => rowOf(f, a) === "back"); if (back.length) return back[Math.floor(rnd() * back.length)]; }
    if (heroOk(f, al)) return al;
    const ok = all.filter((a) => heroOk(f, a));
    if (!ok.length) return al;
    return ok[Math.floor(rnd() * ok.length)];
  }

  // ------------------------------------------------------------------ the field
  const on = (sess) => !!(sess && sess.field);
  /* the turn-based fight calls this at the end of its constructor (after the foe's health is set) */
  function setup(sess, rnd = Math.random) {
    const f = sess.f, e = f.e;
    sess.field = null;
    if (RO()) RO().assign(e, f);   // a single foe has a role too (a troll regrows, a draugr mage channels)
    const n = sess.waves | 0;
    if (n < 2 || e.boss || e.player || e.pool || e.cart || e.caravan || f.dStance || (e.tags || []).includes("dragon")) return null;
    if (e.baseDamage == null) e.baseDamage = e.damage ?? 5;
    if (e.baseRed == null) e.baseRed = e.red || 0;
    const FG = typeof FOEGROUPS !== "undefined" ? FOEGROUPS : null, kind = e.archKind || (FG ? FG.kindOf(e) : null);
    if (kind) e.archKind = kind;
    let arch = sess.players > 0 ? compose(kind, n, sess.players + 1) : (e.group || []).slice(0, n);
    if (!arch || arch.length < n) arch = arch && arch.length ? Array.from({ length: n }, (_, i) => arch[i % arch.length]) : Array.from({ length: n }, () => e.arch || null);
    // health: the same total as before, shared by archetype (a mage is frailer than a warrior)
    const w = arch.map((id) => (FG && id && FG.ARCH[id] ? FG.ARCH[id].hp : 1));
    let mul;
    if (sess.players > 0) { const avg = w.reduce((a, b) => a + b, 0) / n; mul = w.map((x) => x / avg); }
    else mul = (sess.grp && sess.grp.hpMul && sess.grp.hpMul.length >= n) ? sess.grp.hpMul.slice(0, n) : w;
    const base = {}; for (const k of pkeys()) if (f[k] !== undefined) base[k] = clone(f[k]);
    delete base.kit; delete base.foeTgts;
    const foes = arch.map((id, i) => ({ i, arch: id, max: Math.max(1, Math.round(sess.ehpBase * mul[i])), st: clone(base), down: false }));
    for (const x of foes) {
      x.hp = x.max;
      if (FG && x.arch && FG.ARCH[x.arch]) { FG.setArch(e, x.arch); e.element = FG.ARCH[x.arch].cast ? (({ draugr: "frost", skeleton: "frost", vampire: "frost", falmer: "shock", forsworn: "fire", bandit: "fire" })[kind] || "fire") : null; }
      if (RO()) RO().assign(e, f, x.arch); else { e.role = null; e.row = "front"; }
      x.role = e.role; x.row = e.row || "front";
      x.e = {}; for (const k of EKEYS) x.e[k] = e[k];
      x.nm = String(e.name || "");
    }
    // front row first on the screen and as the first target
    foes.sort((a, b) => (a.row === b.row ? a.i - b.i : a.row === "front" ? -1 : 1)).forEach((x, i) => { x.i = i; });
    // one of each kind gets its name ("Shieldwarden", "Marksman"); doubles get a number
    const seen = {}; for (const x of foes) { const k = x.role || x.arch || "foe"; seen[k] = (seen[k] || 0) + 1; x.n = seen[k]; }
    for (const x of foes) { const k = x.role || x.arch || "foe"; if (seen[k] < 2) x.n = 0; }
    sess.field = { foes, cur: null, tgt: 0, queue: [], rot: Math.floor(rnd() * n), actor: null, cover: null, reach: 0, log: [] };
    try { Object.defineProperty(f, "_tbs", { value: sess, configurable: true, writable: true, enumerable: false }); } catch (x) { f._tbs = sess; }
    for (const x of foes) { put(sess, x.i); if (typeof FOEKIT !== "undefined") { const dt = f.kitDot; FOEKIT.setup(f); f.kitDot = dt; } save(sess); }
    put(sess, 0);
    sess.wave = 1; sess.waves = n;
    sess.ehpMax = foes[0].max;
    return sess.field;
  }
  /* the loaded foe's numbers go back into its slot */
  function save(sess) {
    const fd = sess.field; if (!fd || fd.cur == null) return;
    const f = sess.f, x = fd.foes[fd.cur]; if (!x) return;
    x.hp = f.ehp; x.max = sess.ehpMax; x.st = {};
    for (const k of pkeys()) if (f[k] !== undefined) x.st[k] = f[k];
    if (x.st.rx) { x.st.rx = { ...x.st.rx }; delete x.st.rx.cover; }   // Cover allies is your stance, not the foe's
    x.stkFoe = f.stk && f.stk.foe ? f.stk.foe : null;
    x.e = {}; for (const k of EKEYS) x.e[k] = f.e[k];
  }
  /* a foe's numbers onto the fight (no saving first) */
  function put(sess, i) {
    const fd = sess.field, f = sess.f, x = fd.foes[i];
    const cov = f.rx && f.rx.cover;
    for (const k of pkeys()) delete f[k];
    Object.assign(f, x.st);
    if (cov) f.rx = { ...(f.rx || {}), cover: cov };
    if (f.stk) f.stk.foe = x.stkFoe || {}; else if (x.stkFoe) f.stk = { foe: x.stkFoe, me: {}, cc: {} };
    if (x.e) Object.assign(f.e, x.e);
    f.ehp = x.hp; sess.ehpMax = x.max; f.ehp0 = x.max; f.e.tbHp = x.max;
    if (!f.foeSt) f.foeSt = {};
    if (!Array.isArray(f.bleed)) f.bleed = [];
    if (!Array.isArray(f.dots)) f.dots = [];
    fd.cur = i;
  }
  /* aim at / swap in foe i. A foe that fell while loaded is marked down on the way out. */
  function load(sess, i) {
    const fd = sess.field; if (!fd || i == null || !fd.foes[i]) return;
    if (i === fd.cur) return;
    const f = sess.f, was = fd.cur;
    save(sess);
    if (was != null && f.ehp <= 0) down(sess, was);
    put(sess, i);
  }
  const alive = (sess) => (sess.field ? sess.field.foes.filter((x) => !x.down && !(x.i === sess.field.cur ? sess.f.ehp <= 0 : x.hp <= 0)) : []);
  const hpOf = (sess, x) => (x.i === sess.field.cur ? sess.f.ehp : x.hp);
  const frontFoes = (sess) => alive(sess).filter((x) => x.row === "front");
  /* a foe fell outside the loaded slot (an area spell, a bleed): out of the fight */
  function down(sess, i) {
    const fd = sess.field, x = fd.foes[i]; if (!x || x.down) return;
    x.down = true; x.hp = 0;
    if (fd.cover && (fd.cover.by === i || fd.cover.to === i)) fd.cover = null;
    syncWave(sess);
    fd.queue = fd.queue.filter((j) => j !== i);
    if (i !== fd.cur) sess.emit("foe", fmt("The {0} falls!", label(x)), "foe", { fell: i });
  }
  /* sess.wave counts the fallen (1 + the ones down other than the loaded one): tbfight's "over" and the party view read it */
  function syncWave(sess) {
    const fd = sess.field; if (!fd) return;
    sess.wave = Math.min(sess.waves, 1 + fd.foes.filter((x) => x.down && x.i !== fd.cur).length);
  }
  /* tbfight.js nextFoe(): the loaded foe fell; the next one comes into aim */
  function fell(sess) {
    const fd = sess.field, f = sess.f, i = fd.cur, x = fd.foes[i];
    save(sess); x.down = true; x.hp = 0;
    if (fd.cover && (fd.cover.by === i || fd.cover.to === i)) fd.cover = null;
    fd.queue = fd.queue.filter((j) => j !== i);
    const j = pick(sess, fd.tgt !== i ? fd.tgt : null);
    if (j == null) return false;
    put(sess, j);
    if (fd.tgt === i || fd.tgt == null || fd.foes[fd.tgt].down) fd.tgt = j;
    syncWave(sess);
    const left = alive(sess).length;
    sess.emit("foe", fmt("The {0} falls! {1} left: you turn to the {2}.", label(x), left, label(fd.foes[j])), "foe", { wave: sess.wave, fell: i });
    plan(sess);
    return true;
  }
  /* the best foe to aim at: the one asked for if it still stands, else the front row first, the most hurt */
  function pick(sess, want) {
    const fd = sess.field, a = alive(sess).filter((x) => x.i !== fd.cur || sess.f.ehp > 0);
    if (want != null && a.some((x) => x.i === want)) return want;
    const fr = a.filter((x) => x.row === "front"), list = fr.length ? fr : a;
    if (!list.length) return null;
    return list.slice().sort((p, q) => hpOf(sess, p) / p.max - hpOf(sess, q) / q.max)[0].i;
  }

  // ------------------------------------------------------------------ your reach
  const MELEE = new Set(["attack", "power_attack", "bash", "cleave", "dual_flurry", "flurry"]);
  /* how a move reaches: "melee", "ranged", "area" or "self" */
  function reachOf(f, a) {
    a = String(a || "");
    if (!a || a === "end" || a === "flee" || a === "block" || a === "recover" || /^(potion|poison|oil|food|item):/.test(a) || a === "rx:cover") return "self";
    const sp = /^(spell|dual|scroll):/.test(a) ? spellOf(a) : null;
    if (sp) { if (sp.area) return "area"; if (sp.kind && !["damage", "paralyze", "fear", "calm", "frenzy", "soultrap", "drain", "debuff", "illusion"].includes(sp.kind) && sp.kind !== "control") return "self"; return "ranged"; }
    if (/^(staff|shout|lord|throw|bomb):/.test(a)) return "ranged";
    if (MELEE.has(a) || /^beast:/.test(a) || a === "rx:mark") return RANGED_WT.has(f.wt) || (f.weapon && f.weapon.staff && !f.bound) ? "ranged" : "melee";
    return "ranged";
  }
  function spellOf(a) {
    const [k, arg] = a.split(":"); if (typeof D === "undefined") return null;
    if (k === "scroll") { const it = D.ITEMS[arg]; return it && D.SPELLS[it.spell] ? D.SPELLS[it.spell] : null; }
    return D.SPELLS[arg] || null;
  }
  /* can a move with this reach hit foe i? */
  function canReach(sess, i, reach) {
    const fd = sess.field; if (!fd) return true;
    const x = fd.foes[i]; if (!x || x.down) return false;
    if (reach !== "melee" || x.row === "front") return true;
    return !frontFoes(sess).length;
  }
  /* why it can't (the plate says it): "Behind the Shieldwarden" */
  function why(sess, i) {
    const fr = frontFoes(sess); if (!fr.length) return "";
    const g = fr.find((x) => x.role === "guardian") || fr[0];
    return fmt("Behind the {0}", label(g));
  }
  /* Line Breaker / Sweeping Reach: once a fight, a melee move reaches the back row anyway */
  const breaker = (sess) => sess.field && !sess.field.reach && typeof PFX !== "undefined" && PFX.num(sess.f.s, "rowreach") > 0;
  /* tbfight.js act(), before your move: aim it at a foe it can reach (and let a Shieldwarden step in). Returns the note. */
  function heroPre(sess, a) {
    const fd = sess.field; if (!fd) return "";
    const r = reachOf(sess.f, a); if (r === "self") return "";
    if (fd.view) return viewPre(sess, r);
    let i = fd.tgt != null && !fd.foes[fd.tgt].down ? fd.tgt : fd.cur, note = "";
    if (fd.foes[i] && fd.foes[i].down) i = pick(sess, null);
    if (!canReach(sess, i, r)) {
      if (breaker(sess)) { fd.reach = 1; note = " " + fmt("(you break through their line to the {0})", label(fd.foes[i])); }
      else { const j = pick(sess, null); note = " " + fmt("(the {0} is behind the front row: you hit the {1})", label(fd.foes[i]), label(fd.foes[j])); i = j; }
    }
    if (r !== "area" && RO()) { const g = RO().intercept(sess, i, a); if (g != null) { note += " " + fmt("(the {0} steps in front of the {1})", label(fd.foes[g]), label(fd.foes[i])); i = g; } }
    load(sess, i);
    return note;
  }
  /* a teammate's phone (sharedfight.js) has no other foes' numbers: it only fixes the aim, the leader's phone does the rest */
  function viewPre(sess, r) {
    const fd = sess.field, live = fd.foes.filter((x) => !x.down);
    if (!live.length) return "";
    let i = fd.tgt != null && fd.foes[fd.tgt] && !fd.foes[fd.tgt].down ? fd.tgt : fd.cur;
    const fr = live.filter((x) => x.row === "front");
    if (r === "melee" && fd.foes[i] && fd.foes[i].row === "back" && fr.length) { const j = fr[0].i; const note = " " + fmt("(the {0} is behind the front row: you hit the {1})", fd.foes[i].lb, fd.foes[j].lb); fd.tgt = j; return note; }
    fd.tgt = i;
    return "";
  }
  /* the leader's phone, a teammate's turn came in (tbfight.js applyRemote): aim at the foe they chose, if their move
     could reach it (a blade can't get past the front row), a Shieldwarden's Cover steps in. ok: their numbers apply. */
  function remotePre(sess, r) {
    const fd = sess.field; if (!fd) return null;
    const want = r && r.fi != null ? +r.fi : null;
    if (want == null || !fd.foes[want]) return { ok: r.wave == null || r.wave === sess.wave };
    if (fd.foes[want].down || (want === fd.cur && sess.f.ehp <= 0)) return { ok: false };
    let i = want;
    const melee = !RANGED_WT.has(r.wt) && r.wt !== "staff";
    if (melee && !canReach(sess, i, "melee")) { const j = pick(sess, null); if (j == null) return { ok: false }; i = j; }
    if (RO()) { const g = RO().intercept(sess, i, "attack", r || {}); if (g != null) i = g; }
    load(sess, i);
    return { ok: true, i };
  }
  /* after your move (or a friend's): back to the foe you aim at */
  function restore(sess) {
    const fd = sess.field; if (!fd || fd.view) return;
    const f = sess.f;
    if (f.ehp <= 0 && alive(sess).length === 0) return;   // the last one fell: the fight is over, leave it loaded
    let t = fd.tgt != null && !fd.foes[fd.tgt].down ? fd.tgt : null;
    if (t === fd.cur && f.ehp <= 0) t = null;
    if (t == null) { if (f.ehp > 0) { fd.tgt = fd.cur; return; } t = pick(sess, null); if (t == null) return; fd.tgt = t; }
    if (t !== fd.cur) { const was = fd.cur, dead = f.ehp <= 0; load(sess, t); if (dead) { sess.emit("foe", fmt("The {0} falls!", label(fd.foes[was])), "foe", { fell: was }); plan(sess); } }
  }
  /* tap a foe plate: aim at it */
  function target(sess, i) {
    const fd = sess.field; if (!fd || !fd.foes[i] || fd.foes[i].down) return false;
    if (sess.mirror) { fd.tgt = i; return true; }
    fd.tgt = i; load(sess, i); return true;
  }
  /* Auto plays your turn: the foe to aim at for this move (a channelling Spellcaster you can break first, then the
     most hurt foe in reach; casters and menders before the rest when you can reach them) */
  function aiTarget(sess, a) {
    const fd = sess.field; if (!fd || fd.view) return;
    const f = sess.f, r = a ? reachOf(f, a) : RANGED_WT.has(f.wt) || casts(f.s) && (!f.wt || f.wt === "fist") ? "ranged" : "melee";
    if (r === "self") return;
    const list = alive(sess).filter((x) => canReach(sess, x.i, r));
    if (!list.length) return;
    const chan = list.find((x) => { const k = x.i === fd.cur ? f.kit : x.st.kit; return k && k.windup === "chan"; });
    const pri = (x) => (x.role === "healer" ? 0.75 : x.role === "mage" || x.role === "commander" ? 0.85 : 1);
    const best = chan || list.slice().sort((p, q) => (hpOf(sess, p) / p.max) * pri(p) - (hpOf(sess, q) / q.max) * pri(q))[0];
    fd.tgt = best.i; load(sess, best.i);
  }
  /* a friend's move: melee friends hit the front row while it stands */
  function allyPre(sess, al) {
    const fd = sess.field; if (!fd || fd.view || !al) return;
    const melee = allyRow(al) === "front" && !al.bow && !RANGED_WT.has(al.wt) && !(al.role === "healer");
    let i = fd.tgt != null && !fd.foes[fd.tgt].down ? fd.tgt : pick(sess, null);
    if (i == null) return;
    if (melee && !canReach(sess, i, "melee")) i = pick(sess, null);
    if (RO()) { const g = RO().intercept(sess, i, "attack", al); if (g != null) i = g; }
    load(sess, i);
  }

  // ------------------------------------------------------------------ the foe side's moves
  /* the round's foe moves, spread over the foes still standing (call where FIGHTREAD.plan + FOEINTENT.plan ran) */
  function plan(sess, rnd = Math.random) {
    const fd = sess.field; if (!fd || sess.mirror) return;
    const f = sess.f, n = typeof FIGHTREAD !== "undefined" ? FIGHTREAD.foeLeft(sess) : 0;
    const live = alive(sess); if (!live.length) { fd.queue = []; return; }
    const q = [];
    for (let k = 0; k < n; k++) q.push(live[(fd.rot + k) % live.length].i);
    fd.rot = (fd.rot + Math.max(1, n)) % live.length;
    const keep = fd.tgt != null && !fd.foes[fd.tgt].down ? fd.tgt : fd.cur;
    for (const x of live) {
      const c = q.filter((j) => j === x.i).length;
      load(sess, x.i);
      if (f.kit) { if (c && !f.dStance && typeof FOEKIT !== "undefined") FOEKIT.plan(f, c, rnd); else f.kit.plan = []; }
      if (typeof FOEINTENT !== "undefined") FOEINTENT.plan(sess, rnd, c);
      if (RO()) RO().plan(sess, x.i, rnd);
      if (typeof REACT !== "undefined" && REACT.retarget) REACT.retarget(sess);
    }
    fd.queue = q;
    load(sess, keep != null && !fd.foes[keep].down ? keep : pick(sess, null));
  }
  /* tbfight.js foeAct: the next foe in line acts (run() is the normal foe move on the loaded foe) */
  function foeTurn(sess, run) {
    const fd = sess.field, f = sess.f;
    if (fd.view) return run("");
    let i = null;
    while (fd.queue.length && i == null) { const j = fd.queue.shift(); if (!fd.foes[j].down && (j !== fd.cur || f.ehp > 0)) i = j; }
    if (i == null) { const live = alive(sess); if (!live.length) return; i = live[fd.rot % live.length].i; fd.rot = (fd.rot + 1) % live.length; }
    load(sess, i);
    fd.actor = i;
    if (fd.cover && fd.cover.by === i) fd.cover = null;   // a Shieldwarden's Cover lasts until its own next move
    try { run(label(fd.foes[i])); } finally { fd.actor = null; }
    restore(sess);
  }
  /* initiative.js lost a foe slot (stunned, frozen): the stunned foe's move is the one that goes */
  function skip(sess) {
    const fd = sess.field; if (!fd || fd.view) return;
    const k = fd.queue.indexOf(fd.cur);
    if (k >= 0) fd.queue.splice(k, 1); else fd.queue.shift();
  }
  /* what every foe still to act this round will do, in order (fightread.js intents) */
  function intents(sess, one) {
    const fd = sess.field, f = sess.f, out = [], back = fd.cur, ehp = f.ehp;
    if (fd.actor != null) return one(sess);
    const per = {};
    const qs = fd.queue.filter((j) => !fd.foes[j].down);
    if (!qs.length) return one(sess);   // its moves this round are over: the aimed-at foe's next round
    try {
      for (const j of qs) {
        if (!per[j]) { if (fd.cur !== j) { save(sess); put(sess, j); } per[j] = one(sess, qs.filter((k) => k === j).length).map((o) => ({ ...o, fi: j, by: label(fd.foes[j]) })); }
        const o = per[j].shift(); if (o) out.push(o);
      }
    } finally { if (fd.cur !== back) { save(sess); put(sess, back); } f.ehp = ehp; }
    return out;
  }

  // ------------------------------------------------------------------ area spells and end-of-round ticks
  const tierOf = (id, sp) => sp?.level || (typeof TOMES !== "undefined" && TOMES.level ? TOMES.level(id) : "Novice");
  /* spellfx.js: an area spell just hit the loaded foe for `dealt` (dots0: the dots it had before) */
  function area(sess, id, sp, dealt, dots0) {
    const fd = sess.field; if (!fd || fd.view) return "";
    const f = sess.f, cur = fd.foes[fd.cur], major = tierOf(id, sp) === "Master", k = major ? SPLASH.major : SPLASH.small;
    const hit = [];
    const newDots = (f.dots || []).slice(dots0 || 0);
    for (const x of alive(sess)) {
      if (x.i === fd.cur || (!major && x.row !== cur.row)) continue;
      const d = Math.max(0, dealt) * k * (1 - Math.min(0.8, (x.e && x.e.red) || 0) * 0.5);
      if (d >= 1) { x.hp -= d; hit.push(`${label(x)} ${r0(d)}`); }
      for (const h of HOLD) if ((f[h] || 0) > 0) x.st[h] = Math.max(x.st[h] || 0, f[h]);
      if (newDots.length) x.st.dots = [...(x.st.dots || []), ...newDots.map((y) => ({ ...y, dmg: y.dmg * k, area: true }))];
      if (x.hp <= 0) down(sess, x.i);
    }
    if (!hit.length) return "";
    return " " + fmt("(it also hits {0})", hit.join(", "));
  }
  /* end of round (tbfight.js endRound): bleeding and burning on the foes you're not aiming at */
  function tick(sess, line) {
    const fd = sess.field; if (!fd || fd.view) return;
    for (const x of alive(sess)) {
      if (x.i === fd.cur) continue;
      let d = 0;
      if (Array.isArray(x.st.bleed) && x.st.bleed.length) { d += x.st.bleed.reduce((a, y) => a + y.dmg, 0); x.st.bleed = x.st.bleed.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); }
      if (Array.isArray(x.st.dots) && x.st.dots.length) { d += x.st.dots.reduce((a, y) => a + (y.dmg || 0), 0); for (const y of x.st.dots) y.turns--; x.st.dots = x.st.dots.filter((y) => y.turns > 0); }
      if (d > 0) { x.hp -= d; if (line) line.me += ` · ${label(x)} ${r0(d)}`; if (x.hp <= 0) down(sess, x.i); }
    }
  }

  // ------------------------------------------------------------------ names and the party view
  function label(x) {
    if (!x) return tr("foe");
    const RN = RO() ? RO().name(x.role) : "";
    const base = RN || (x.e && x.e.archLabel) || x.arch || x.nm || tr("foe");
    return x.n ? `${base} ${x.n}` : base;
  }
  /* what other phones need to draw the field (tbfight.js shared()) */
  function view(sess) {
    const fd = sess.field; if (!fd) return null;
    return { cur: fd.cur, tgt: fd.tgt, foes: fd.foes.map((x) => ({ i: x.i, role: x.role, row: x.row, arch: x.arch, n: x.n, hp: r0(Math.max(0, hpOf(sess, x))), max: x.max, down: !!x.down || hpOf(sess, x) <= 0, lb: label(x), nx: nextOf(sess, x) })) };
  }
  /* a teammate's phone: the field as the leader's phone has it (no numbers to swap, just the plates) */
  function mirror(sess, v) {
    if (!v || !Array.isArray(v.foes)) { sess.field = null; return; }
    const was = sess.field;
    sess.field = { foes: v.foes.map((x) => ({ ...x, st: {}, e: null })), cur: v.cur, tgt: was && was.tgt != null && v.foes[was.tgt] && !v.foes[was.tgt].down ? was.tgt : v.cur, queue: [], mirror: true, view: true };
  }
  /* the next thing a foe will do, for its plate (from its own plan) */
  function nextOf(sess, x) {
    const fd = sess.field, k = x.i === fd.cur ? sess.f.kit : x.st && x.st.kit;
    if (!k) return null;
    if (k.windup === "chan") return { id: "chan", row: k.chanRow || "front" };
    if (k.windup) return { id: k.windup };
    const p = (k.plan || [])[0];
    return p ? { id: p.id, to: p.to, row: p.row } : null;
  }

  // ------------------------------------------------------------------ on screen
  const ROLE_SVG = {   // code-drawn role marks (no painted art yet: see the PR)
    guardian: '<path d="M8 1l6 2v4c0 4-3 6.5-6 8-3-1.5-6-4-6-8V3z"/>',
    berserker: '<path d="M3 13L12 4l1 3 2-2-1-2 2-1-3-1-1 2-3-1L2 12z"/>',
    archer: '<path d="M3 13c0-6 4-10 10-10M3 13l10-10M10 3h3v3" fill="none" stroke-width="1.6" stroke="currentColor"/>',
    mage: '<path d="M8 1l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z"/>',
    healer: '<path d="M6 2h4v4h4v4h-4v4H6v-4H2V6h4z"/>',
    assassin: '<path d="M13 1L5 9l2 2 8-8zM4 10l2 2-3 3-2-2z"/>',
    regenerator: '<path d="M8 2a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4V6l4-3-4-3z"/>',
    commander: '<path d="M2 5l3 3 3-5 3 5 3-3-1 8H3z"/>',
  };
  const icon = (role) => (ROLE_SVG[role] ? `<svg class="rficon" viewBox="0 0 16 16" aria-hidden="true">${ROLE_SVG[role]}</svg>` : "");
  function plates(sess) {
    const fd = sess.field, f = sess.f, mine = !sess.done;
    const v = fd.view ? fd.foes : view(sess).foes;
    const r = reachOf(f, "attack"), melee = r === "melee";
    const frontUpFoe = v.some((x) => !x.down && x.row === "front");
    const one = (x) => {
      const out = melee && x.row === "back" && frontUpFoe && !x.down;
      const tip = out ? why(sess, x.i) || tr("Behind the front row") : "";
      const pc = Math.max(0, Math.min(100, (100 * x.hp) / Math.max(1, x.max)));
      const nx = x.nx ? intentTxt(x.nx, fd) : "";
      return `<button class="rfp ${x.row} ${x.down ? "down" : ""} ${out ? "far" : ""} ${x.i === fd.tgt ? "tgt" : ""} ${x.i === fd.cur && !fd.view ? "cur" : ""}" data-rf="${x.i}" ${x.down ? "disabled" : ""} aria-label="${esc(x.lb)}${tip ? ": " + esc(tip) : ""}"${tip ? ` data-tip="${esc(tr("Your melee can't reach it yet") + ": " + tip)}"` : ""}>
        <span class="rfn">${icon(x.role)}<b>${esc(x.lb)}</b></span><span class="rfb"><i style="width:${pc.toFixed(1)}%"></i></span>${out ? `<small class="rfwhy">${esc(tip)}</small>` : nx ? `<small class="rfnx">${esc(nx)}</small>` : ""}</button>`;
    };
    const row = (k) => v.filter((x) => x.row === k).map(one).join("");
    const heroes = standing(f).map((a) => ({ a, row: rowOf(f, a), n: a ? String(a.name || "Ally").split(" ")[0] : tr("You") }));
    const hrow = (k) => heroes.filter((h) => h.row === k).map((h) => `<span class="rfh ${h.a ? "" : "me"}">${esc(h.n)}</span>`).join("") || `<span class="rfh none">—</span>`;
    return `<div class="rowfield" role="group" aria-label="${esc(tr("Rows"))}">
      <div class="rfside foes"><div class="rfrow back"><em>${esc(tr("Back"))}</em>${row("back") || `<span class="rfh none">—</span>`}</div><div class="rfrow front"><em>${esc(tr("Front"))}</em>${row("front") || `<span class="rfh none">—</span>`}</div></div>
      ${f.allies && f.allies.length ? `<div class="rfside heroes"><div class="rfrow front"><em>${esc(tr("Front"))}</em>${hrow("front")}</div><div class="rfrow back"><em>${esc(tr("Back"))}</em>${hrow("back")}</div></div>` : `<div class="rfside heroes solo"><span class="rfh me">${esc(fmt("You: {0} row", tr(myRow(f) === "back" ? "back" : "front")))}</span></div>`}
    </div>`;
  }
  /* "Cover → Spellcaster", "Casting Fireball → Front row", "Regenerate 25 HP · fire stops it" */
  function intentTxt(nx, fd) {
    const nm = (j) => { const x = fd.foes[j]; return x ? x.lb || label(x) : ""; };
    switch (nx.id) {
      case "cover": return nx.to != null ? fmt("Cover → {0}", nm(nx.to)) : tr("Cover");
      case "channel": case "chan": return fmt("Casting {0} → {1}", tr("Fireball"), tr(nx.row === "back" ? "Back row" : "Front row"));
      case "mend_ally": return nx.to != null ? fmt("Mend → {0}", nm(nx.to)) : tr("Mend");
      case "rally": return tr("Rally: all hit harder");
      case "regen": return tr("Regenerate · fire stops it");
      case "wind_up": case "smash": return tr("Winding up a heavy strike");
      case "take_aim": case "aimed": return tr("Taking aim");
      default: return "";
    }
  }
  function decorate(el, sess) {
    if (!DOM || !el || !sess || !sess.field) return;
    let box = el.querySelector(".rowfield"); if (box) box.remove();
    const vit = el.querySelector(".tbvit"), stage = el.querySelector(".tbstage"), tin = el.querySelector(".tbin");
    if (vit) vit.insertAdjacentHTML("afterbegin", plates(sess));   // the old stacked screen
    else if (stage) stage.insertAdjacentHTML("afterend", plates(sess));   // the scene screen (combat2.js moves the cards into the scene)
    else if (tin) tin.insertAdjacentHTML("afterbegin", plates(sess));
    else return;
    if (!vit && stage) {   // over the scene: a slim strip just under the foe's card and the top bar, front row nearest you
      const strip = el.querySelector(".rowfield"); strip.classList.add("c2r");
      const place = () => {
        if (!strip.isConnected) return;
        const tb = tin ? tin.getBoundingClientRect().top : 0, sr = strip.getBoundingClientRect();
        let top = 0;
        for (const n of el.querySelectorAll(".tbtop, .c2ov .tbu.foe, .bfwrap, .c2feed, .tblog")) {
          const r = n.getBoundingClientRect(); if (!r.height || r.top - tb > 200 || r.height > 220) continue;   // only the slim things in the top band
          if (r.right <= sr.left || r.left >= sr.right) continue;   // beside the strip (the foe's card in the PC side column)
          top = Math.max(top, r.bottom - tb);
        }
        strip.style.top = Math.round(top + 4) + "px";
      };
      place();
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(place);   // the phone log folds after this (phonefight.js)
    }
    box = el.querySelector(".rowfield");
    box.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-rf]"); if (!b || b.disabled) return;
      ev.stopPropagation();
      if (target(sess, +b.dataset.rf) && typeof TB !== "undefined") TB.redraw(sess, { turn: sess.cur && sess.cur.id === "me" ? "me" : "next" });
    });
  }
  /* the Hero panel: where you stand in a fight, and your pick (Auto = your gear decides). Saved with your loadout. */
  function heroChip(s) {
    if (!s || !s.loadouts) return "";
    const c = choice(s), r = saveRow(s);
    const b = (k, t) => `<button class="${c === k ? "on" : ""}" data-act="rowpick" data-id="${k}" aria-pressed="${c === k}">${esc(tr(t))}</button>`;
    return `<div class="rowpick" data-tip="${esc(tr("Front row: blades and shields, foes' blades can reach you. Back row: bows, staffs and spells, safe from their blades while your front row stands. It never changes damage."))}">
      <span class="sub">${esc(fmt("Fight row: {0}", tr(r === "back" ? "Back" : "Front")))}${c === "auto" ? ` <small>${esc(tr("(from your gear)"))}</small>` : ""}</span>
      <div class="seg">${b("auto", "Auto")}${b("front", "Front")}${b("back", "Back")}</div></div>`;
  }
  const rowSaid = (s) => fmt("You'll stand in the {0} row in fights{1}", tr(saveRow(s)), choice(s) === "auto" ? tr(" (your gear decides)") : "");
  /* PC keys: [ and ] move the aim along the foes */
  function key(sess, dir) {
    const fd = sess && sess.field; if (!fd) return false;
    const live = (fd.view ? fd.foes.filter((x) => !x.down) : alive(sess)).map((x) => x.i); if (!live.length) return false;
    const k = live.indexOf(fd.tgt);
    return target(sess, live[(k + (dir < 0 ? live.length - 1 : 1)) % live.length]);
  }
  if (DOM && typeof addEventListener === "function") addEventListener("keydown", (ev) => {
    if (ev.key !== "[" && ev.key !== "]") return;   // Tab stays the keyboard's own focus key
    const t = ev.target; if (t && /input|textarea|select/i.test(t.tagName || "")) return;
    const sess = typeof TB !== "undefined" ? TB.session : null; if (!sess || !sess.field || sess.done) return;
    ev.preventDefault();
    if (key(sess, ev.key === "[" ? -1 : 1)) TB.redraw(sess, { turn: sess.cur && sess.cur.id === "me" ? "me" : "next" });
  });

  return { SPLASH, count, compose, gearRow, saveRow, myRow, allyRow, rowOf, choice, setChoice, standing, frontUp, foeReach, heroOk, fixTarget,
    on, setup, save, put, load, alive, frontFoes, down, fell, pick, reachOf, canReach, why, heroPre, remotePre, restore, target, aiTarget, allyPre,
    plan, foeTurn, skip, intents, area, tick, label, view, mirror, nextOf, intentTxt, plates, decorate, key, icon, pkeys, heroChip, rowSaid };
})();
if (typeof module !== "undefined") module.exports = FOEFIELD;
