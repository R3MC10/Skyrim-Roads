/* Foe roles: one set of rules every species reuses, stats stay per species. [OURS] (combat step 5)
   - Shieldwarden (guardian, front): Covers an ally, usually a back-row caster. The next direct attack on that ally
     (yours or a friend's, never an area spell) hits the Shieldwarden instead. One interception per Cover, and the
     Cover ends at the Shieldwarden's next move, so it never chains or lasts forever.
   - Ravager (berserker, front): winds up a heavy strike you see coming (foekit.js wind_up).
   - Marksman (archer, back): shoots from the back row: it reaches your back row even while your front stands, takes aim.
   - Spellcaster (mage, back): channels a big spell at one of your rows ("Casting Fireball → Front row"). It lands on
     its next move on everyone in that row. A shield bash, a shock spell, a stun, paralysis or a stagger breaks it.
   - Mender (healer, back): heals the most hurt foe, 3 times a fight at most.
   - Cutthroat (assassin, front): goes round your front row for the back row.
   - Regrower (regenerator, front; trolls): regrows unless it's burning: fire stops it.
   - Warleader (commander, back; parties of 7-8): rallies everyone (25% harder for 2 turns).
   Bosses change role by phase (bossfight.js) instead of only hitting harder.
   Names come from names.js (type "role"), so they can be reskinned in one place. */
const FOEROLES = (() => {
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const fmt = (t, ...a) => String(tr(t)).replace(/\{(\d)\}/g, (m, i) => a[+i]);
  const ROLES = {
    guardian: { row: "front", moves: ["cover", "shield_bash"] },
    berserker: { row: "front", moves: ["wind_up"] },
    archer: { row: "back", moves: ["take_aim"] },
    mage: { row: "back", moves: ["channel", "bolt"] },
    healer: { row: "back", moves: ["mend_ally"] },
    assassin: { row: "front", moves: ["poison_blade"] },
    regenerator: { row: "front", moves: ["regen"] },
    commander: { row: "back", moves: ["rally"] },
  };
  const IDS = Object.keys(ROLES);
  const BY_ARCH = { warrior: "guardian", brute: "berserker", archer: "archer", mage: "mage", rogue: "assassin", healer: "healer", chief: "commander" };
  const DEF = { guardian: "Shieldwarden", berserker: "Ravager", archer: "Marksman", mage: "Spellcaster", healer: "Mender", assassin: "Cutthroat", regenerator: "Regrower", commander: "Warleader" };
  const name = (r) => (!r ? "" : typeof NAMES !== "undefined" && NAMES.role ? NAMES.local ? NAMES.local(r, { type: "role" }) : NAMES.role(r) : tr(DEF[r] || r));
  /* the role a foe plays: from its archetype (foegroups.js), else from what it is */
  function roleFor(e, arch) {
    if (!e || e.player || e.ally || e.kind === "event") return null;
    const a = arch || e.arch, n = String(e.name || ""), tg = new Set(e.tags || []);
    if (a && BY_ARCH[a]) return BY_ARCH[a];
    if (tg.has("dragon")) return null;
    if (/troll/i.test(n)) return "regenerator";
    if (/hagraven|necromancer|conjurer|mage|wizard|warlock|witch|sorcer|lich|wisp|shaman/i.test(n)) return "mage";
    if (/archer|hunter|marksman|ranger|bowman/i.test(n)) return "archer";
    if (/assassin|cutpurse|thief|brotherhood|shadow/i.test(n)) return "assassin";
    if (/spriggan|healer|vigilant|acolyte|priest of|monk/i.test(n)) return "healer";
    if (/giant|ogre|berserk|brute|marauder|bear|mammoth|werewolf/i.test(n)) return "berserker";
    if (/guard|soldier|legionnaire|knight|warrior|draugr|skeleton|centurion|sentry/i.test(n)) return "guardian";
    return null;   // beasts and the rest fight plainly, in front
  }
  function assign(e, f, arch) {
    const r = roleFor(e, arch);
    e.role = r; e.row = r ? ROLES[r].row : "front";
    return r;
  }

  // ------------------------------------------------------------------ field helpers
  const sessOf = (f) => (f && f._tbs && f._tbs.field ? f._tbs : null);
  const FF = () => (typeof FOEFIELD !== "undefined" ? FOEFIELD : null);
  const hp = (s, x) => (x.i === s.field.cur ? s.f.ehp : x.hp);
  const me = (s) => (s.field.actor != null ? s.field.actor : s.field.cur);
  /* who a Shieldwarden covers: a back-row caster first, then the most hurt other foe */
  function coverTo(s, by) {
    const fd = s.field, live = FF().alive(s).filter((x) => x.i !== by && !(fd.cover && fd.cover.to === x.i));
    if (!live.length) return null;
    const pri = (x) => (x.role === "mage" || x.role === "healer" || x.role === "commander" ? 0 : x.row === "back" ? 0.3 : 1) + hp(s, x) / Math.max(1, x.max);
    return live.slice().sort((a, b) => pri(a) - pri(b))[0].i;
  }
  /* the most hurt foe under 60% (a Mender's target) */
  function hurt(s) {
    const live = FF().alive(s).filter((x) => hp(s, x) / Math.max(1, x.max) < 0.6);
    if (!live.length) return null;
    return live.slice().sort((a, b) => hp(s, a) / a.max - hp(s, b) / b.max)[0].i;
  }
  /* your row a channelled spell goes for: the one with the most heroes in it (front on a tie) */
  function rowFor(f) {
    const F = FF(); if (!F) return "front";
    const st = F.standing(f), fr = st.filter((a) => F.rowOf(f, a) === "front").length, bk = st.length - fr;
    return bk > fr ? "back" : "front";
  }
  /* a burning troll doesn't regrow */
  const burning = (f) => !!(f.foeSt && f.foeSt.burn) || (f.dots || []).some((d) => d.el === "fire" && d.turns > 0) || !!(f.stk && f.stk.foe && f.stk.foe.burn > 0);

  // ------------------------------------------------------------------ the moves (added to foekit.js)
  function addMoves(K) {
    if (!K || K.MOVES.cover) return;
    K.MOVES.cover = { label: "Cover", cd: 2, w: 5, buff: true,
      when: (f) => { const s = sessOf(f); return !!s && coverTo(s, me(s)) != null; },
      run(f, et, n) {
        const s = sessOf(f); if (!s) return `${n} raises a shield`;
        const fd = s.field, by = me(s), pl = f.kit.cur;
        let to = pl && pl.to != null && fd.foes[pl.to] && !fd.foes[pl.to].down && pl.to !== by ? pl.to : coverTo(s, by);
        if (to == null) return `${n} raises a shield`;
        fd.cover = { by, to };
        return fmt("{0} raises a shield in front of the {1}", n, FF().label(fd.foes[to]));
      } };
    K.MOVES.channel = { label: "Channel", cd: 4, w: 4, tele: true,
      when: (f) => !!FF() && FF().standing(f).length >= 2,
      run(f, et, n) { const k = f.kit; k.windup = "chan"; k.chanRow = (k.cur && k.cur.row) || rowFor(f); return fmt("{0} starts channelling a Fireball at your {1} row. Bash it, shock it or stagger it to break it!", n, tr(k.chanRow)); } };
    K.WIND.chan = { mul: 0.8, text: (n, t) => `${n}'s Fireball lands: ${t}`,
      run(f, et, n) {   // everyone standing in that row takes it (your Cover allies stance doesn't pull a spell like this)
        const F = FF(), k = f.kit, row = k.chanRow || "front"; k.chanRow = null;
        let hs = F ? F.standing(f).filter((a) => F.rowOf(f, a) === row) : [null];
        if (!hs.length && F) hs = F.standing(f);
        const e = f.e, d0 = e.damage, parts = [];
        e.damage = (d0 || 5) * K.WIND.chan.mul; f.eMagic = true;
        try { for (const a of hs.slice(0, 4)) { f.tgtNow = a; f.coverAl = null; let t = et(); const nm = String(e.name || ""); if (t.startsWith(nm + " ")) t = t.slice(nm.length + 1); t = t.replace(/^(?:swings at|claws at|lunges at|strikes at|attacks) (.+?) and misses/, "misses $1").replace(/^(?:swings at|claws at|lunges at|strikes at|attacks) /, "hits "); if (!a) t = t.replace(/^hits (\d)/, "hits you $1").replace(/^misses(?! \S)/, "misses you"); parts.push(t); } }
        finally { e.damage = d0; f.eMagic = false; f.tgtNow = undefined; }
        return fmt("{0}'s Fireball bursts over your {1} row: {2}", n, tr(row), parts.join(" · "));
      } };
    K.MOVES.mend_ally = { label: "Mend", cd: 3, w: 5,
      when: (f) => { const s = sessOf(f); return !!s && (f.kit.used.mend_ally || 0) < 3 && hurt(s) != null; },
      run(f, et, n) {
        const s = sessOf(f); if (!s) return `${n} mutters a prayer`;
        const fd = s.field, pl = f.kit.cur;
        const j = pl && pl.to != null && fd.foes[pl.to] && !fd.foes[pl.to].down ? pl.to : hurt(s);
        if (j == null) return `${n} mutters a prayer`;
        const x = fd.foes[j], h = Math.round(x.max * 0.12);
        if (j === fd.cur) f.ehp = Math.min(x.max, f.ehp + h); else x.hp = Math.min(x.max, x.hp + h);
        return fmt("{0} mends the {1} (+{2})", n, FF().label(x), h);
      } };
    K.MOVES.rally = { label: "Rally", cd: 5, w: 3, buff: true,
      when: (f) => { const s = sessOf(f); return !!s && FF().alive(s).length >= 2; },
      run(f, et, n) {
        const s = sessOf(f), fd = s.field;
        for (const x of FF().alive(s)) { if (x.i === fd.cur) f.kit.rage = Math.max(f.kit.rage || 0, 2); else if (x.st.kit) x.st.kit.rage = Math.max(x.st.kit.rage || 0, 2); }
        return fmt("{0} rallies the others: they all hit 25% harder for 2 turns", n);
      } };
    // Regrower: fire stops it
    const rg = K.MOVES.regen;
    if (rg && !rg._rows) { const w0 = rg.when; rg.when = (f) => (!w0 || w0(f)) && !burning(f); rg._rows = true; }
  }
  if (typeof FOEKIT !== "undefined") addMoves(FOEKIT);
  /* foekit.js setup(): the kit grows with the role */
  function kit(e, out) {
    if (!e || e.player || e.ally || e.kind === "event" || (e.tags || []).includes("dragon") || e.teach) return out;
    const r = e.role; if (!r || !ROLES[r]) return out;
    for (const id of ROLES[r].moves) if (typeof FOEKIT !== "undefined" && FOEKIT.MOVES[id] && !out.includes(id)) out.push(id);
    return out;
  }

  // ------------------------------------------------------------------ the round's plan, Cover, interrupts
  /* foefield.js plan(): give this foe's planned moves their targets ("Cover → Spellcaster", "→ Front row") */
  function plan(s, i) {
    const f = s.f, k = f.kit; if (!k || !Array.isArray(k.plan)) return;
    for (const p of k.plan) {
      if (p.id === "cover") p.to = coverTo(s, i);
      else if (p.id === "mend_ally") p.to = hurt(s);
      else if (p.id === "channel") p.row = rowFor(f);
    }
  }
  /* your direct attack on foe i: a Shieldwarden covering it takes it (once). Returns its index or null. */
  function intercept(s, i, a, al) {
    const fd = s.field, c = fd && fd.cover;
    if (!c || c.to !== i || c.by === i) return null;
    if (!al && typeof PFX !== "undefined" && PFX.num(s.f.s, "nocover") > 0 && FF() && FF().reachOf(s.f, a) !== "melee") return null;   // Through the Gap: your arrows and spells slip past (the Cover stays up)
    const g = fd.foes[c.by];
    fd.cover = null;   // one interception, and it's used
    if (!g || g.down || (c.by === fd.cur && s.f.ehp <= 0)) return null;
    return c.by;
  }
  /* after your move (tbfight.js act): a bash, a shock spell, a stun or a stagger breaks a channelled spell */
  function answer(s, a, before) {
    const f = s.f, k = f.kit; if (!k || k.windup !== "chan") return "";
    let sp = null;
    if (typeof D !== "undefined" && /^(spell|dual):/.test(a || "")) sp = D.SPELLS[a.split(":")[1]];
    else if (typeof D !== "undefined" && /^scroll:/.test(a || "")) sp = D.SPELLS[(D.ITEMS[a.slice(7)] || {}).spell];
    const shock = sp && sp.element === "shock" && f.ehp < before;
    const stop = a === "bash" || shock || f.stagger || f.eParalyzed > 0 || f.tbStunLeft > 0 || (f.foeSt && f.foeSt.shock && f.ehp < before);
    if (!stop) return "";
    k.windup = null; k.chanRow = null;
    let t = " " + fmt("(you break the {0}'s spell!)", s.field ? FF().label(s.field.foes[s.field.cur]) : f.e.name);
    if (typeof PFX !== "undefined" && PFX.num(f.s, "rowint") > 0 && !f.stagger) { f.stagger = true; t += " " + tr("(Spellbreaker: it staggers)"); }
    return t;
  }

  // ------------------------------------------------------------------ bosses: a role per phase
  const BOSS = {
    dragon: [null, "archer", "berserker"], priest: ["mage", "commander", "mage"], mage: ["mage", "guardian", "mage"],
    undead: ["guardian", "commander", "berserker"], construct: ["guardian", "mage", "berserker"], beast: ["berserker", "regenerator", "berserker"],
    warrior: ["guardian", "berserker", "commander"],
  };
  /* bossfight.js enter(): the boss fights as a new role from this phase on (its kit gets that role's moves) */
  function bossPhase(f, prof, n) {
    const L = BOSS[prof]; if (!L) return "";
    const r = L[Math.min(n, L.length - 1)]; if (!r || r === f.e.role) return "";
    f.e.role = r; f.e.row = ROLES[r].row;
    const k = f.kit;
    if (k && typeof FOEKIT !== "undefined") {
      const add = { guardian: ["raise_shield", "shield_bash"], berserker: ["wind_up", "war_cry"], archer: ["take_aim"], mage: ["bolt", "foe_ward", "channel"], commander: ["war_cry"], regenerator: ["regen"] }[r] || [];
      for (const id of add) if (FOEKIT.MOVES[id] && !k.ids.includes(id)) k.ids.push(id);
    }
    return fmt("it fights as a {0} now", name(r));
  }
  return { ROLES, IDS, BY_ARCH, DEF, BOSS, name, roleFor, assign, coverTo, hurt, rowFor, burning, addMoves, kit, plan, intercept, answer, bossPhase };
})();
if (typeof module !== "undefined") module.exports = FOEROLES;
