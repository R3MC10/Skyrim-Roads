/* Co-op dungeons [OURS]: go into a dungeon with friends. Skyrim never had this.
   - A "run" record (Store collection "runs") holds the shared map, the path the leader picked, and what each room holds.
   - Everyone walks the same rooms. Fight rooms hold the same foe for everyone (scaled to each player), and members
     standing in the same room fight beside you, acting on their own tactics: healers heal you when you drop low,
     guards draw blows, strikers hit hard, sneaks open with a sneak attack.
   - The boss chest is shared fairly: everyone who kills the boss gets their own roll from the co-op chest, once.
     Claims are made with Store.change (one at a time), so nobody can take two shares or someone else's.
   Pure logic here; COOP.ui(ctx) wires it into the screens. */
const COOP = (() => {
  const RUN_SECONDS = 3 * 3600;          // a run record lives 3 real hours (1.5 in-game days), then it's tidied away
  const MAX_MEMBERS = 8;                 // [OURS] parties of up to 8 go in together
  const FOE_BONUS = 0.35;                // [OURS] foes get +35% health for each extra member in the run
  const WAVE_BONUS = 0.1;                // with more foes per room (partyplay.js waves) each foe only gets +10% per extra member, at most +50%
  const ALLY_DMG = 0.75;                 // [OURS] members fight beside you at 75% of their usual damage
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ---- seeded rolls, so a claim is the same no matter who computes it or how often
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const live = (run, t = G.now()) => !!run && run.status !== "over" && t - (run.t || 0) < RUN_SECONDS;
  const isMember = (run, uid) => !!run?.members?.some((m) => m.id === uid);
  const activeMembers = (run) => (run?.members || []).filter((m) => !m.left);
  /* [dunloop] a deep expedition (deepdelve.js) starts a new map on every level, so a room in the shared path is
     [row, col, level] (no level: the first map). The path only ever goes deeper: a later level, or a later row. */
  const lvOf = (p) => p?.[2] || 0;
  const levelOf = (d) => d?.deep?.level || 0;
  const deeper = (p, q) => lvOf(p) > lvOf(q) || (lvOf(p) === lvOf(q) && p[0] > q[0]);
  const spot = (d) => (levelOf(d) ? [d.row, d.col, levelOf(d)] : [d.row, d.col]);

  /* [party] your party goes in as one: everyone in it is in the run straight away (no invites, no Accept cards).
     Adds party members who aren't in the run yet (up to the cap) and drops any invites still pending for them.
     Returns the same object when nothing changes. */
  const inParty = (party, uid) => !!party?.members?.some((m) => m.id === uid);
  function fromParty(run, party) {
    if (!run || !party?.members?.length) return run;
    const members = run.members.slice();
    let changed = false;
    for (const m of party.members) {
      if (!m?.id || members.some((x) => x.id === m.id)) continue;
      if (members.filter((x) => !x.left).length >= MAX_MEMBERS) break;
      members.push({ id: m.id, name: m.name, level: m.level || null, party: true }); changed = true;
    }
    const invites = (run.invites || []).filter((x) => !inParty(party, x.id));
    if (invites.length !== (run.invites || []).length) changed = true;
    return changed ? { ...run, members, invites } : run;
  }
  /* the leader opens a lobby at a dungeon door. party: your party record; in a party only its leader starts runs */
  function newRun(s, t = G.now(), party = null) {
    const place = s.location, i = DUNGEONS.info(place);
    if (party && (party.members || []).length > 1 && party.leader !== s.id) return { err: `${party.leaderName || "Your party leader"} leads your party, so they start co-op runs. You'll be in it with them.` };
    if (!place || !i) return { err: "Stand at a dungeon door to start a co-op run." };
    if (s.trip) return { err: "Finish your trip first." };
    if (s.dungeon) return { err: "You're already inside." };
    if (DUNGEONS.refillLeft(s, place, t)) return { err: `You cleared ${place} not long ago. Pick somewhere that has filled up again.` };
    const lone = i.theme === "giantcamp" || i.theme === "lair";
    const rows = lone ? [[{ type: "boss", links: [] }]] : DUNGEONS.layout(i.theme, i.tier);
    const id = `run-${s.id}-${Math.floor(t)}`;
    const doc = { place, theme: i.theme, tier: i.tier, rows, boss: lone ? (i.theme === "lair" ? "dragon" : "giant") : null,
      leader: s.id, leaderName: s.name, members: [{ id: s.id, name: s.name, level: s.level }], invites: [], status: "lobby", path: [], rooms: [], claims: {}, chest: null, at: {}, t,
      ...(typeof DEEPDELVE !== "undefined" ? DEEPDELVE.runFields(s, place, t) : {}) };   // the leader's difficulty tier, the same for everyone
    return { id, doc: party && party.leader === s.id ? fromParty(doc, party) : doc };
  }
  /* invites are only for people outside your party (party members are in already) */
  function invite(run, uid, name, party = null) {
    if (!live(run)) return { err: "That run is over." };
    if (inParty(party, uid)) return { err: `${name} is in your party, so they're in the run already.` };
    if (run.members.some((m) => m.id === uid && !m.left)) return { err: `${name} is already in.` };
    if (activeMembers(run).length + (run.invites || []).length >= MAX_MEMBERS) return { err: `A run takes up to ${MAX_MEMBERS} heroes.` };
    if ((run.invites || []).some((x) => x.id === uid)) return { err: `${name} is already invited.` };
    return { run: { ...run, invites: [...(run.invites || []), { id: uid, name }] } };
  }
  function addMember(run, s) {
    if (!live(run)) return null;
    if (isMember(run, s.id)) return { ...run, members: run.members.map((m) => (m.id === s.id ? { ...m, left: false } : m)), invites: (run.invites || []).filter((x) => x.id !== s.id) };
    if (activeMembers(run).length >= MAX_MEMBERS) return null;
    return { ...run, members: [...run.members, { id: s.id, name: s.name, level: s.level }], invites: (run.invites || []).filter((x) => x.id !== s.id) };
  }
  /* say no; with a name, the leader gets a short "declined" note (invites.js shows it to them) */
  function decline(run, uid, name, t = G.now()) {
    const out = { ...run, invites: (run.invites || []).filter((x) => x.id !== uid) };
    if (name) out.nos = [...(run.nos || []).filter((x) => x && x.id !== uid).slice(-7), { id: uid, name, t }];
    return out;
  }
  /* someone walks out (or falls). The lead passes on; an empty run is over. */
  function removeMember(run, uid) {
    const members = run.members.map((m) => (m.id === uid ? { ...m, left: true } : m));
    const act = members.filter((m) => !m.left);
    if (!act.length) return null;
    const lead = act.some((m) => m.id === run.leader) ? run.leader : act[0].id;
    return { ...run, members, leader: lead, leaderName: members.find((m) => m.id === lead).name };
  }

  /* step inside: your own copy of the shared map */
  function join(s, run, t = G.now()) {
    if (!live(run, t)) return "That run is over.";
    if (!isMember(run, s.id)) return "You're not in that run.";
    if (s.trip) return "Finish your trip first.";
    if (s.dungeon) return s.dungeon.run === run.id ? null : "You're inside another dungeon.";
    if (s.location !== run.place) return `Go to ${run.place} first.`;
    if (DUNGEONS.refillLeft(s, run.place, t)) return `You cleared ${run.place} not long ago; there's nothing in there for you yet.`;
    s.dungeon = { place: run.place, theme: run.theme, tier: run.tier, rows: clone(run.rows), row: -1, col: 0, room: null, found: [], gold: 0, t, run: run.id, cstep: 0, path: [] };
    if (run.boss) s.dungeon.boss = run.boss;
    if (typeof PRIESTS !== "undefined") PRIESTS.onEnter(s);   // a dragon priest sleeps there for you, unless you already have its mask
    if (typeof DEEPDELVE !== "undefined") DEEPDELVE.onEnter(s, run, t);   // the run's difficulty tier and modifiers
    G.setHealth(s, G.curHealth(s, t), t);
    G.note(s, ` Entered ${run.place} with ${activeMembers(run).filter((m) => m.id !== s.id).map((m) => m.name).join(", ") || "your party"}`);
    return null;
  }

  // ---- rooms: the leader picks the way; the first to step in decides what lives there
  const keyOf = (name) => Object.keys(DUNGEONS.ENEMY).find((k) => DUNGEONS.ENEMY[k]?.name === name) || null;
  function foe(s, key, tier, members = 1, waves = false) {
    const def = DUNGEONS.ENEMY[key];
    if (!def) return null;
    const bonus = waves ? Math.min(0.5, WAVE_BONUS * (members - 1)) : FOE_BONUS * clamp(members - 1, 0, MAX_MEMBERS - 1);
    const e = G.scaleEnemy({ ...def }, s.level), m = [0, 0.8, 0.95, 1.1][tier] * (1 + bonus);
    e.health = Math.round(e.health * m); e.hp = e.health; e.damage = Math.round(e.damage * [0, 0.8, 0.95, 1.1][tier] * 10) / 10;
    if (typeof DEEPDELVE !== "undefined") { DEEPDELVE.scaleFoe(s, e, false); if (!waves && DEEPDELVE.partyFoe) DEEPDELVE.partyFoe(s, e, members); }   // the run's difficulty tier and depth; tiered foes grow more with a bigger party
    return e;
  }
  const canPick = (s, run) => !!run && run.leader === s.id && !s.dungeon?.room && (s.dungeon?.cstep || 0) >= run.path.length;   // ahead of the record = a pick the store dropped: the next pick is still written
  /* the leader stepped into a room (DUNGEONS.enterRoom already ran on their side): record it for everyone */
  function recordPick(run, d) {
    const step = run.path.length;
    if ((d.cstep || 0) < step) return null;      // someone else moved first; don't fork the path
    if (step && !deeper(spot(d), run.path[step - 1])) return null;   // a late write for a room the record is already past: the path only ever goes deeper
    const spec = { type: d.room.type };
    if (d.room.enemy && d.room.type !== "boss") spec.key = keyOf(d.room.enemy.name);
    return { ...run, status: "in", path: [...run.path, spot(d)], rooms: [...run.rooms, spec] };
  }
  /* make a room match the shared one: same foe for everyone, a little tougher with more of you */
  function shape(s, run, spec) {
    const d = s.dungeon, r = d.room;
    const n = activeMembers(run).length;
    const W = typeof PARTYPLAY !== "undefined" && r?.enemy && r.type !== "boss" ? PARTYPLAY.waves(n) : 1;
    if (r?.enemy && spec?.key && r.type !== "boss") { const e = foe(s, spec.key, d.tier, n, W > 1); if (e) { r.enemy = e; r.text = e.text; } }
    else if (r?.enemy && n > 1) { const b = W > 1 ? Math.min(0.5, WAVE_BONUS * (n - 1)) : FOE_BONUS * clamp(n - 1, 0, MAX_MEMBERS - 1); r.enemy.health = Math.round(r.enemy.health * (1 + b)); r.enemy.hp = r.enemy.health; if (W === 1 && typeof DEEPDELVE !== "undefined" && DEEPDELVE.partyFoe) DEEPDELVE.partyFoe(s, r.enemy, n); }
    if (W > 1 && r?.enemy) {   // [OURS] a bigger party meets more foes: one after another, one per hero (at most 6)
      r.waves = W; r.wave = 1; r.wkey = spec?.key || keyOf(r.enemy.name); r.wn = n;
      r.text = `${r.text} ${W - 1} more ${W - 1 > 1 ? "shapes move" : "shape moves"} in the dark behind it.`;
    }
  }
  /* catch up with the leader, one room at a time. Returns how many rooms you walked into (0 or 1). */
  function follow(s, run) {
    const d = s.dungeon;
    if (!d || d.run !== run?.id || d.done) return 0;
    const i = d.cstep || 0;
    if (i >= run.path.length) return 0;
    const [row, col] = run.path[i], lv = lvOf(run.path[i]);
    if (lv < levelOf(d)) { d.cstep = i + 1; return 0; }   // a room on a level you already left behind
    if (lv > levelOf(d)) {   // the leader went down the stairs: once you're out of your own room, follow them down
      if (d.room) return 0;   // (the camp's choices replay first; lootvote.js steps you out of it once the leader moved on)
      if (!descendTo(s, lv)) { d.cstep = i + 1; return 0; }
    }
    if (d.row >= 0 && d.row === row && d.col === col) {   // you already stand in that room (a fight snapshot undid the count, or the path names it twice): count it, never walk it again
      d.cstep = i + 1;
      if (typeof console !== "undefined") console.warn(`coop: room ${row}:${col} already walked, moving on`);
      return 0;
    }
    if (d.room) return 0;
    d.row = row - 1; d.col = i ? run.path[i - 1][1] : 0;
    if (d.row >= 0 && !(d.rows[d.row]?.[d.col]?.links || []).includes(col)) { const via = (d.rows[d.row] || []).findIndex((n) => n.links.includes(col)); if (via >= 0) d.col = via; else if (!d.rows[d.row]?.[d.col]) d.col = 0; }   // the recorded way skipped a room: step in from one that leads there
    const err = DUNGEONS.enterRoom(s, col);
    if (err) { d.row = row; d.col = col; d.room = null; d.cstep = i + 1; return 0; }   // shouldn't happen; skip rather than get stuck
    d.cstep = i + 1; d.path = d.path || []; d.path.push([d.row, d.col]);
    shape(s, run, run.rooms[i]);
    return 1;
  }
  /* walk down the stairs to the leader's level (a member who missed the "descend" replay, or whose camp was emptied) */
  function descendTo(s, lv) {
    const d = s.dungeon;
    if (typeof DEEPDELVE === "undefined" || !DEEPDELVE.campAct) return false;
    for (let k = 0; k < 6 && levelOf(s.dungeon) < lv; k++) { const r = DEEPDELVE.campAct(s, "descend", G.now(), {}); if (!r?.descended) break; }
    return levelOf(s.dungeon) === lv && s.dungeon === d;
  }
  /* the leader's own room: count the step */
  function picked(s, run) { const d = s.dungeon; d.cstep = Math.max((d.cstep || 0) + 1, run.path?.length || 0); shape(s, run, run.rooms[d.cstep - 1]); }

  // ---- who stands beside you, and how they fight (from their own tactics)
  function profile(s) {
    const speed = typeof INIT !== "undefined" ? INIT.heroSpeed(s).speed : undefined;   // [initiative] your speed in a fight (armour, perks), for the turn order on the leader's phone
    if (typeof COMBATAI !== "undefined" && COMBATAI.isSmart(G.loadout(s))) { const st = MP.stats(s); return { dmg: st.dmg, hp: st.hp, red: st.red, speed, ...COMBATAI.coopProfile(s) }; }   // Smart AI: worked out from your own kit, on your own phone
    const st = MP.stats(s), rules = (G.loadout(s)?.rules || []).filter((r) => r && !r.off);
    const healRule = rules.find((r) => r.do?.startsWith("spell:") && D.SPELLS[r.do.slice(6)]?.kind === "heal" && s.spells.includes(r.do.slice(6)));
    const healSp = healRule ? D.SPELLS[healRule.do.slice(6)] : null;
    const blocks = rules.some((r) => r.do === "block"), power = rules.some((r) => r.do === "power_attack"), sneaky = rules.some((r) => r.if === "sneak_ready");
    const potRule = rules.find((r) => r.do?.startsWith("potion:") && r.if === "hp_below");
    const role = healSp ? "healer" : blocks ? "guard" : power ? "striker" : "fighter";
    return { dmg: st.dmg, hp: st.hp, red: st.red, speed, role, sneaky,
      healAt: healRule?.if === "hp_below" ? healRule.pct || 50 : 50, healAmt: healSp ? Math.round(healSp.amount || 30) : 0, heals: healSp ? 3 : 0,
      potAt: potRule ? potRule.pct || 40 : 0, pots: potRule ? Math.min(2, G.countRestore(s, "health")) : 0, potAmt: 50 };
  }
  const ROLE = { healer: "Healer", guard: "Guard", striker: "Striker", fighter: "Fighter" };
  const card = (s) => (s.dungeon?.run ? { run: s.dungeon.run, step: s.dungeon.cstep || 0, busy: !!s.dungeon.room, prof: profile(s),
    ...(typeof DUNEVENTS !== "undefined" ? { msk: DUNEVENTS.sheet(s) } : {}) } : null);   // msk: the skills a mystery room's check can use (the party's best rolls)
  /* players in your room: same run, same step */
  function allies(s, cards) {
    const d = s.dungeon;
    if (!d?.run) return [];
    return cards.filter((c) => c.id !== s.id && c.coop?.run === d.run && c.coop.step === (d.cstep || 0) && (c.cur ?? 1) > 0).slice(0, MAX_MEMBERS - 1).flatMap((c) => [allyFromCard(c), ...(typeof FOL2 !== "undefined" ? FOL2.cardAllies(c) : [])]);   // their followers fight too, never counted as members
  }
  function allyFromCard(c) {
    const p = c.coop?.prof || { dmg: c.dmg || 5, hp: c.hp || 100, red: c.red || 0, role: "fighter" };
    const hp = Math.max(30, c.cur || p.hp);
    return { name: c.name, dmg: Math.max(2, (p.dmg || 5) * ALLY_DMG), hp, maxHp: p.hp || hp, red: clamp(p.red || 0, 0, 0.8), role: p.role || "fighter", sneaky: !!p.sneaky,
      healAt: p.healAt || 50, healAmt: p.healAmt || 0, heals: p.heals || 0, potAt: p.potAt || 0, pots: p.pots || 0, potAmt: p.potAmt || 50, player: true, coop: true, pid: c.id || null, ...(p.speed ? { speed: p.speed } : {}) };   // pid: their phone picks their moves in turn-based fights
  }
  /* the ally's turn (called from the fight loop) */
  function allyAct(f, al) {
    if (al.down) return "";
    const mh = G.maxHealth(f.s);
    if (al.role === "healer" && al.heals > 0 && f.hp > 0 && f.hp / mh * 100 < al.healAt) {
      al.heals--; const before = f.hp; f.hp = Math.min(mh, f.hp + al.healAmt);
      return ` · ${al.name} heals you +${Math.round(f.hp - before)}`;
    }
    if (al.pots > 0 && al.hp / al.maxHp * 100 < al.potAt && typeof POTFX !== "undefined") { if (POTFX.busy(al, "health")) return ""; al.pots--; return ` · ${al.name} drinks a potion: ${POTFX.ally(al, "health", al.potAmt, "Potion of Healing")}`; }   // over a few rounds (potionfx.js)
    if (al.pots > 0 && al.hp / al.maxHp * 100 < al.potAt) { al.pots--; al.hp = Math.min(al.maxHp, al.hp + al.potAmt); return ` · ${al.name} drinks a potion`; }
    let d = al.dmg * (0.85 + Math.random() * 0.3);
    let tag = "";
    if (al.sneaky && f.turn === 1 && !al.opened) { d *= 2; al.opened = true; tag = " (sneak attack)"; }
    else if (al.role === "striker" && f.turn % 3 === 0) { d *= 1.6; tag = " (power attack)"; }
    f.ehp -= d;
    return ` · ${al.name} ${Math.round(d)}${tag}`;
  }
  /* the foe swings at a member (called from the enemy turn). Guards step in front of blows. */
  function hitAlly(f, al) {
    const n = f.e.name;
    const guard = f.allies.find((a) => a.coop && !a.down && a.role === "guard");
    if (guard && guard !== al && !f.tgtFixed && Math.random() < 0.5) al = guard;   // foeintent.js already rolled this when it showed the target
    if (Math.random() > F.HIT_CHANCE) return `${n} swings at ${al.name} and misses`;
    let d = f.e.damage * (0.85 + Math.random() * 0.3) * (1 - al.red) * (al.role === "guard" ? 0.6 : 1);   // [OURS] a guard blocks
    if (typeof SPELLBOOK !== "undefined") d = SPELLBOOK.allyTakes(f, al, d);   // support spells you cast on them
    al.hp -= d;
    if (al.hp <= 0) { al.down = true; f.allies = f.allies.filter((x) => x !== al); return `${n} knocks ${al.name} down! They'll get back up after the fight`; }
    return `${n} hits ${al.name} ${Math.round(d)}${al.role === "guard" ? " (blocked)" : ""}`;
  }

  // ---- the shared boss chest: one fair roll each, claimed once
  function roll(run, uid, level) {
    const r = rng(hash(run.id + "|" + uid)), n = activeMembers(run).length || 1;
    const gold = Math.round((50 + r() * 70) * run.tier * (1 + 0.15 * Math.min(n - 1, 7)) * (run.factor || 1));   // [OURS] a bonus for going in together, and for the longer way through
    const items = [];
    const elite = D.LOOT.elite || [];
    for (const [item, c] of elite) if (D.ITEMS[item] && r() < c * (0.8 + 0.2 * run.tier)) items.push(item);
    const tl = DUNGEONS.THEMES[run.theme]?.loot || [];
    if (tl.length && r() < 0.6) items.push(tl[Math.floor(r() * tl.length)]);
    if (r() < 0.35) items.push(r() < 0.5 ? "potion_health" : "potion_magicka");
    return { gold, items: items.filter((x) => D.ITEMS[x]).slice(0, 4), level };
  }
  /* inside Store.change: claim your roll, or leave the record alone if you already have one */
  function claim(run, uid, level) {
    if (!run?.chest || !isMember(run, uid) || !run.chest.killers?.includes(uid) || run.claims?.[uid]) return { run, got: null };
    const got = roll(run, uid, level);
    return { run: { ...run, claims: { ...(run.claims || {}), [uid]: { gold: got.gold, items: got.items, t: G.now() } } }, got };
  }
  /* inside Store.change: a member killed the boss. The chest opens for them. */
  function bossDown(run, uid) {
    const chest = run.chest || { t: G.now(), killers: [] };
    if (!chest.killers.includes(uid)) chest.killers = [...chest.killers, uid];
    return { ...run, chest };
  }
  function give(s, run, got) {
    if (!got || (s.coopClaims || {})[run.id]) return false;
    s.coopClaims = { ...(s.coopClaims || {}), [run.id]: G.now() };
    for (const k of Object.keys(s.coopClaims)) if (G.now() - s.coopClaims[k] > RUN_SECONDS * 4) delete s.coopClaims[k];
    s.gold += got.gold; got.items.forEach((i) => G.give(s, i));
    if (s.dungeon?.run === run.id) { s.dungeon.gold += got.gold; got.items.forEach((i) => s.dungeon.found.push(D.ITEMS[i].name)); }
    return true;
  }

  // ------------------------------------------------------------ screens (wired from ui.js)
  function ui(ctx) {
    const { S, toast, esc } = ctx;
    let runs = [], seenInv = new Set(), seenParty = new Set(), filling = false;
    const bootT = G.now();
    const party = () => ctx.party?.() || null;
    const mine = () => runs.filter((r) => live(r) && r.members.some((m) => m.id === S().id && !m.left)).sort((a, b) => (b.t || 0) - (a.t || 0))[0] || null;   // newest first
    const pending = () => runs.filter((r) => live(r) && (r.invites || []).some((x) => x.id === S().id) && !r.members.some((m) => m.id === S().id && !m.left));
    /* invites from someone in your party never show: you're put in their run instead (partyFill) */
    const myInvites = () => pending().filter((r) => !inParty(party(), r.leader));
    /* the run your party is in that you stepped out of (you walk back in without an invite) */
    const partyRun = () => { const p = party(); return p ? runs.find((r) => live(r) && r.leader !== S().id && inParty(p, r.leader) && isMember(r, S().id) && !mine()) || null : null; };
    const cur = () => { const id = S().dungeon?.run; return id ? runs.find((r) => r.id === id) || null : null; };

    /* [party] keep the party in the run: the leader adds anyone in the party who isn't in it yet (and drops their
       old invites); a member whose leader still sent an invite (an older game) steps in by themselves, no card */
    function partyFill() {
      const s = S(), p = party();
      if (!p || filling || !ctx.Store.online) return;
      const own = runs.find((r) => live(r) && r.leader === s.id && p.leader === s.id && fromParty(r, p) !== r);
      const inv = !s.dungeon ? pending().find((r) => inParty(p, r.leader) && !seenParty.has("inv:" + r.id)) : null;
      if (!own && !inv) return;
      filling = true;
      if (inv) seenParty.add("inv:" + inv.id);
      const job = own ? ctx.Store.change("runs", own.id, (r) => fromParty(r, party())) : ctx.Store.change("runs", inv.id, (r) => addMember(r, S()) || r);
      Promise.resolve(job).catch(() => {}).finally(() => { filling = false; });
    }
    function onParty() { partyFill(); ctx.bump(); }

    function onRuns(docs) {
      runs = docs;
      const t = G.now();
      for (const r of docs) if (!live(r, t) && r.leader === S().id) ctx.Store.remove("runs", r.id);   // tidy old runs you led
      for (const r of myInvites()) if (!seenInv.has(r.id)) { seenInv.add(r.id); if (typeof INVITES === "undefined") toast(`\uE101 ${r.leaderName} asks you to raid ${r.place} together. Open \uE106 Social → Party.`); }
      for (const r of runs) if (live(r, t) && r.leader !== S().id && inParty(party(), r.leader) && isMember(r, S().id) && !seenParty.has(r.id)) {   // your party leader opened a run: you're in it
        seenParty.add(r.id);
        if ((r.t || 0) >= bootT - 60 && !S().dungeon) toast(` ${r.leaderName} opened a co-op run of ${r.place}. Your whole party is in.`);
      }
      partyFill();
      const lob = mine(), s = S();
      if (lob && lob.status === "in" && !s.dungeon && s.location === lob.place && !s.trip) {   // the leader went in: follow
        const err = join(s, lob);
        if (!err) { toast(` You follow ${lob.leaderName} into ${lob.place}.`); sync(); ctx.persist(true); ctx.renderDungeon(); return; }
      }
      if (cur()) { if (sync()) ctx.persist(true); if (document.getElementById("dun")) ctx.renderDungeon(); }
      ctx.bump();
    }
    function sync() {
      const s = S(), run = cur();
      if (!run || !s.dungeon) return 0;
      if (!isMember(run, s.id)) return 0;
      if (run.leader === s.id) heal(s, run);
      const n = follow(s, run);
      if (n) report();
      return n;
    }
    /* safety net: rooms the leader walked that never reached the run record (the store dropped the write) are written
       now, so the others can follow all the way to the boss instead of waiting forever */
    let healing = false;
    function heal(s, run) {
      const d = s.dungeon;
      if (healing || !d?.path?.length || d.run !== run.id) return;
      const lv = levelOf(d), mine = d.path.map((p) => (lv ? [p[0], p[1], lv] : [p[0], p[1]]));   // your own path is this level's
      const tail = (path, last) => { const out = []; for (const p of path) if ((!last || deeper(p, last)) && (!out.length || deeper(p, out[out.length - 1]))) out.push(p); return out; };
      const lastRow = (r) => (r.path.length ? r.path[r.path.length - 1] : null);
      if (!tail(mine, lastRow(run)).length) return;
      healing = true;
      ctx.Store.change("runs", run.id, (r) => {
        const add = r.leader === s.id ? tail(mine, lastRow(r)) : [];
        if (!add.length) return r;
        if (typeof console !== "undefined") console.warn(`coop: ${add.length} room(s) missing from the run record, written now`);
        return { ...r, path: [...r.path, ...add], rooms: [...r.rooms, ...add.map((p) => ({ type: d.rows[p[0]]?.[p[1]]?.type || "fight" }))] };
      }).then((res) => { const nd = S().dungeon, p = res?.after?.path; if (nd && p?.length && nd.row === p[p.length - 1][0] && nd.col === p[p.length - 1][1]) nd.cstep = p.length; })
        .catch(() => {}).finally(() => { healing = false; });
    }
    function report() {
      const s = S(), d = s.dungeon, id = d?.run;
      if (!id) return;
      const at = { step: d.cstep || 0, busy: !!d.room, hp: Math.round(G.curHealth(s) / G.maxHealth(s) * 100), done: !!d.done };
      ctx.Store.change("runs", id, (r) => (isMember(r, s.id) ? { ...r, at: { ...(r.at || {}), [s.id]: at } } : r));
      ctx.publishCard();
    }

    // -- lobby, at the dungeon door
    function candidates(place) {
      const s = S(), cards = ctx.others(), seen = new Set(), out = [];
      const add = (id, name, why) => { if (id === s.id || seen.has(id)) return; seen.add(id); const c = cards.find((o) => o.id === id); out.push({ id, name: c?.name || name, why, here: c?.loc === place && !c?.moving, online: !!c && SOCIAL.status(c).online }); };
      (party()?.members || []).forEach((m) => seen.add(m.id));   // your party is in the run already: never a separate invite
      Object.entries(SOCIAL.friends(s)).forEach(([id, f]) => add(id, f.name, "Friend"));
      cards.filter((c) => c.loc === place && !c.moving).forEach((c) => add(c.id, c.name, "Here"));
      return out.sort((a, b) => (b.here - a.here) || (b.online - a.online) || a.name.localeCompare(b.name)).slice(0, 12);
    }
    function lobbyHTML(place) {
      if (!ctx.Store.online) return `<div class="coop"><h3> Go in together</h3><p class="sub">Co-op dungeons need the shared world. Invites show in  Social → Party.</p></div>`;
      const s = S(), run = mine(), inv = myInvites().filter((r) => r.place === place);
      if (run && run.place !== place) return `<div class="coop"><h3> Co-op run</h3><p class="sub">You're in ${esc(run.leaderName)}'s run of ${esc(run.place)}.</p><div class="row"><button class="btn sm pri" data-act="go" data-place="${esc(run.place)}">Travel there</button><button class="btn sm" data-act="coopleave" data-id="${esc(run.id)}">Leave the run</button></div></div>`;
      if (!run) {
        return `<div class="coop"><h3>\uE101 Go in together</h3><p class="sub">Raid ${esc(place)} with friends: same rooms, same foes, you fight side by side on your own tactics, and everyone gets their own roll from the boss chest.</p>
          ${inv.map((r) => `<div class="item on"><div class="t">${esc(r.leaderName)} asks you along<span>${activeMembers(r).length}/${MAX_MEMBERS} heroes · ${r.status === "in" ? "already inside" : "waiting at the door"}</span></div><button class="btn sm pri" data-act="coopjoin" data-id="${esc(r.id)}">Accept</button><button class="btn sm" data-act="coopno" data-id="${esc(r.id)}">Decline</button></div>`).join("")}
          ${(() => {
            const p = party(), pr = partyRun();
            if (pr) return `<div class="item on"><div class="t">Your party's run of ${esc(pr.place)}<span>${activeMembers(pr).length}/${MAX_MEMBERS} heroes \u00B7 you stepped out</span></div><button class="btn sm pri" data-act="coopjoin" data-id="${esc(pr.id)}">Rejoin</button></div>`;
            if (p && (p.members || []).length > 1 && p.leader !== s.id) return `<p class="sub coopparty">${esc(p.leaderName || "Your party leader")} leads your party. When they start a co-op run, your whole party is in it; no invites needed.</p>`;
            return `<button class="btn" data-act="coopnew" style="width:100%;margin-top:6px">\uE101 Start a co-op run</button>${p && (p.members || []).length > 1 ? `<p class="sub coopparty">Your whole party comes along; no invites needed.</p>` : ""}`;
          })()}</div>`;
      }
      const lead = run.leader === s.id;
      const mem = activeMembers(run).map((m) => { const c = ctx.cardOf(m.id); const here = m.id === s.id ? s.location === place : c?.loc === place || c?.coop?.run === run.id;
        const role = m.id === s.id ? profile(s).role : c?.coop?.prof?.role;
        return `<div class="item"><div class="t">${esc(m.name)}${m.id === run.leader ? " ⚑" : ""}${m.id === s.id ? " (you)" : ""}<span>${role ? ROLE[role] + " · " : ""}${c?.coop?.run === run.id ? "inside" : here ? "at the door" : "on the way"}${m.id !== s.id && inParty(party(), m.id) ? ` · <b class="coopinparty">In your party</b>` : ""}</span></div></div>`; }).join("");
      const pend = (run.invites || []).filter((x) => !inParty(party(), x.id)).map((x) => `<span class="chip">${esc(x.name)} · invited</span>`).join("");
      const room = MAX_MEMBERS - activeMembers(run).length - (run.invites || []).filter((x) => !inParty(party(), x.id)).length;   // invites only for people outside the party, up to 8 heroes in all
      const cands = lead && run.status === "lobby" && room > 0 ? candidates(place).filter((c) => !isMember(run, c.id) && !(run.invites || []).some((x) => x.id === c.id)) : [];
      return `<div class="coop on"><h3> Co-op run · ${activeMembers(run).length}/${MAX_MEMBERS}</h3>
        <div class="list">${mem}</div>${pend ? `<div class="chips">${pend}</div>` : ""}
        ${cands.length ? `<p class="sub" style="margin:8px 0 4px">${party() && (party().members || []).length > 1 ? "Your party is in already. Invite friends or anyone here:" : "Invite your friends or anyone here:"}</p><div class="list">${cands.map((c) => `<div class="item"><div class="t">${esc(c.name)}<span>${c.why}${c.here ? " · here" : c.online ? " · online" : " · offline"}</span></div><button class="btn sm" data-act="coopinv" data-id="${esc(c.id)}" data-name="${esc(c.name)}">Invite</button></div>`).join("")}</div>` : ""}
        <div class="row" style="margin-top:8px">${lead ? `<button class="btn danger" data-act="coopgo" ${run.status === "in" && s.dungeon ? "disabled" : ""}> ${run.status === "in" ? "Go back in" : "Go in together"}</button>` : run.status === "in" ? `<button class="btn danger" data-act="coopgo"> Follow them in</button>` : `<span class="sub">Waiting for ${esc(run.leaderName)} to lead the way in.</span>`}<button class="btn sm" data-act="coopleave" data-id="${esc(run.id)}">${lead ? "Call it off" : "Leave"}</button></div></div>`;
    }
    function invitesHTML() {
      const inv = myInvites();
      if (!inv.length) return "";
      return `<div class="panel"><h2>\uE101 Dungeon invites</h2><div class="list">${inv.map((r) => `<div class="item on"><div class="t">${esc(r.leaderName)} · ${esc(r.place)}<span>${activeMembers(r).length}/${MAX_MEMBERS} heroes · ${esc(DUNGEONS.describe(r.place))}</span></div>${S().location === r.place ? `<button class="btn sm pri" data-act="coopjoin" data-id="${esc(r.id)}">Accept</button>` : `<button class="btn sm" data-act="go" data-place="${esc(r.place)}">Travel</button><button class="btn sm pri" data-act="coopjoin" data-id="${esc(r.id)}">Accept</button>`}<button class="btn sm" data-act="coopno" data-id="${esc(r.id)}">Decline</button></div>`).join("")}</div></div>`;
    }

    // -- inside the dungeon
    function bar() {
      const run = cur(), s = S();
      if (!run) return "";
      const step = s.dungeon.cstep || 0;
      const chips = activeMembers(run).filter((m) => m.id !== s.id).map((m) => { const a = run.at?.[m.id], c = ctx.cardOf(m.id), withMe = c?.coop?.run === run.id && c.coop.step === step;
        return `<span class="cm ${withMe ? "with" : ""}">${esc(m.name)}${m.id === run.leader ? " ⚑" : ""}<small>${withMe ? "with you" : a ? `room ${a.step}` : "outside"}${a ? ` · ${a.hp}%` : ""}</small></span>`; }).join("");
      return `<div class="coopbar" aria-label="Your co-op party">${chips || '<span class="sub">The others haven\'t come in yet.</span>'}</div>`;
    }
    function waiting() { const run = cur(), s = S(); return !!run && run.leader !== s.id && !s.dungeon.room && !s.dungeon.done && (s.dungeon.cstep || 0) >= run.path.length; }
    function waitHTML() { const run = cur(); return `<div class="card"><h3> Waiting for ${esc(run.leaderName)}</h3><p class="sub">The leader picks the way. When they step into the next room you'll follow them in.</p></div>`; }
    function behindHTML() {
      const run = cur(), s = S();
      if (!run || run.leader !== s.id) return "";
      const step = s.dungeon.cstep || 0, behind = activeMembers(run).filter((m) => m.id !== s.id && (run.at?.[m.id]?.step ?? -1) < step || (run.at?.[m.id]?.busy && run.at[m.id].step === step));
      return behind.length ? `<p class="sub coopwait">${behind.map((m) => esc(m.name)).join(", ")} ${behind.length > 1 ? "are" : "is"} still catching up. Wait for them so they fight beside you.</p>` : "";
    }
    /* before the leader steps in. Returns an error, or null */
    function beforePick() {
      const run = cur(), s = S();
      if (!run) return null;
      if (run.leader !== s.id) return `${run.leaderName} picks the way.`;
      if (!canPick(s, run)) return "Hold on, the party is still syncing.";
      return null;
    }
    async function afterPick() {
      const run = cur(), s = S(), d = s.dungeon;
      if (!run || !d?.room) return;
      // count the room right away: a fight started before the store answers snapshots the save (tbfight.js), and a late
      // count was undone when it ended, which sent the leader back into the same room
      const step = Math.max(d.cstep || 0, run.path.length), at = [d.row, d.col];
      const pre = { row: d.row, col: d.col, cstep: step, deep: levelOf(d) ? { level: levelOf(d) } : null, room: { type: d.room.type, enemy: d.room.enemy ? { name: d.room.enemy.name } : null } };
      const spec = { type: d.room.type }; if (d.room.enemy && d.room.type !== "boss") spec.key = keyOf(d.room.enemy.name);
      d.cstep = step + 1; shape(s, run, spec);
      const here = () => { const nd = S().dungeon; return !!nd && nd.run === run.id && nd.row === at[0] && nd.col === at[1]; };   // (a fight's snapshot swaps the save object, so look it up fresh)
      let nr = null;
      for (let k = 0; k < 4 && !nr; k++) {   // a busy store (someone else holds the lease) answers null: try again
        if (k) { await new Promise((ok) => setTimeout(ok, 250 * k)); if (!here()) break; }   // already in another room: that pick writes the way on
        nr = (await ctx.Store.change("runs", run.id, (r) => recordPick(r, pre) || r))?.after || null;
      }
      const mine = nr && nr.path.length && nr.path[nr.path.length - 1][0] === at[0] && nr.path[nr.path.length - 1][1] === at[1] && lvOf(nr.path[nr.path.length - 1]) === levelOf(d);
      if (mine) { if (here()) S().dungeon.cstep = nr.path.length; }
      else if (nr && here() && nr.path.length > step) {   // someone else moved first: step back out and follow the shared path instead
        const d = S().dungeon;
        d.room = null; d.cstep = step; d.path?.pop(); const p = d.path?.[d.path.length - 1]; if (p) { d.row = p[0]; d.col = p[1]; } else { d.row = -1; d.col = 0; }
        toast("Someone else moved first."); follow(S(), nr);
      }   // offline, or the store never answered: carry on; the next pick is written all the same (canPick/recordPick allow a leader ahead of the record)
      report(); ctx.persist(true); ctx.renderDungeon();
    }
    async function afterAct(r, runId) {
      const s = S(), id = runId || cur()?.id;
      if (!id) return;
      if (r.died || !s.dungeon) { await ctx.Store.change("runs", id, (x) => removeMember(x, s.id)); ctx.publishCard(); return; }
      if (r.cleared) await ctx.Store.change("runs", id, (x) => bossDown(x, s.id));
      report();
      if (!s.dungeon.room && sync()) { ctx.persist(true); }
    }
    function chestHTML() {
      const run = cur(), s = S();
      if (!run || !s.dungeon?.done) return "";
      const mineClaim = run.claims?.[s.id];
      if (mineClaim || (s.coopClaims || {})[run.id]) return `<div class="card coop"><h3> Co-op chest</h3><p class="sub">You took your share${mineClaim ? `: ${mineClaim.gold} gold${mineClaim.items.length ? ", " + mineClaim.items.map((i) => esc(D.ITEMS[i]?.name || i)).join(", ") : ""}` : ""}. Everyone gets their own roll; nobody can take yours.</p></div>`;
      return `<div class="card coop"><h3> Co-op chest</h3><p class="sub">A second chest for the party. Each of you who beat the boss gets their own fair roll, once.</p><button class="btn pri" data-act="coopclaim" style="width:100%">Take your share</button></div>`;
    }
    async function left() {
      const s = S(), id = s.dungeon?.run;
      if (!id) return;
      await ctx.Store.change("runs", id, (x) => removeMember(x, s.id));
    }

    async function act(b) {
      const a = b.dataset.act, s = S(), id = b.dataset.id;
      if (a === "coopnew") {
        const p = party(), r = newRun(s, G.now(), p);
        if (r.err) return toast(r.err);
        const old = mine(); if (old) await ctx.Store.change("runs", old.id, (x) => removeMember(x, s.id));
        await ctx.Store.put("runs", r.id, r.doc);
        toast(activeMembers(r.doc).length > 1 ? "Run open. Your whole party is in; invite friends if you like, then go in together." : "Run open. Invite your friends, then go in together.");
      } else if (a === "coopinv") {
        const run = mine();
        if (!run) return;
        if (typeof SAMEVER !== "undefined" && SAMEVER.blockWith(ctx.cardOf?.(id), b.dataset.name)) return;   // another build: say why (samever.js)
        let err = null;
        await ctx.Store.change("runs", run.id, (x) => { const o = invite(x, id, b.dataset.name, party()); err = o.err; return o.run || x; });
        if (err) return toast(err);
        toast(`Invited ${b.dataset.name}.`);
        if (typeof SOCIAL !== "undefined" && SOCIAL.isFriend(s, id) && ctx.sendDm) ctx.sendDm(id, b.dataset.name, ` Join my co-op run of ${run.place}! I'm waiting at the door.`);
      } else if (a === "coopjoin") {
        const old = mine(); if (old && old.id !== id) await ctx.Store.change("runs", old.id, (x) => removeMember(x, s.id));
        const pre = runs.find((r) => r.id === id);
        if (pre && typeof SAMEVER !== "undefined" && SAMEVER.blockWith(ctx.cardOf?.(pre.leader), pre.leaderName)) return;   // the leader is on another build: update first
        if (pre && live(pre) && !isMember(pre, s.id) && activeMembers(pre).length >= MAX_MEMBERS) {   // full: say so and drop the invite
          await ctx.Store.change("runs", id, (x) => decline(x, s.id));
          return toast(`That run is full (${MAX_MEMBERS} heroes at most).`);
        }
        const res = await ctx.Store.change("runs", id, (x) => addMember(x, s) || x);
        if (!res?.after || !isMember(res.after, s.id)) return toast(res?.after && live(res.after) ? `That run is full (${MAX_MEMBERS} heroes at most).` : "That run is over.");
        toast(s.location === res.after.place ? `You joined ${res.after.leaderName}'s run.` : `You joined. Travel to ${res.after.place} to go in.`);
        if (res.after.status === "in" && s.location === res.after.place) { const err = join(s, { ...res.after, id }); if (!err) { sync(); ctx.persist(true); ctx.renderDungeon(); } else toast(err); }
      } else if (a === "coopno") {
        const res = await ctx.Store.change("runs", id, (x) => decline(x, s.id, s.name));
        toast(res ? `You declined ${res.before?.leaderName ? res.before.leaderName + "'s" : "the"} dungeon invite.` : "That invite is gone.");
      } else if (a === "coopleave") {
        await ctx.Store.change("runs", id, (x) => removeMember(x, s.id));
        toast("You left the run.");
      } else if (a === "coopgo") {
        const run = mine();
        if (!run) return;
        let go = run;
        if (run.status === "lobby" && run.leader === s.id) {   // the leader sizes the map once for everyone going in (partyplay.js)
          const res = await ctx.Store.change("runs", run.id, (x) => (x.status === "lobby" && typeof PARTYPLAY !== "undefined" ? { ...PARTYPLAY.sizeRun(x, activeMembers(x).length), status: "in" } : { ...x, status: "in" }));
          if (res?.after) go = { ...res.after, id: run.id };
        }
        const err = join(s, { ...go, status: "in" });
        if (err) return toast(err);
        if (typeof IMM !== "undefined") IMM.loading(`Entering ${run.place} together…`);
        sync(); report(); ctx.persist(true); ctx.renderDungeon();
      } else if (a === "coopclaim") {
        const run = cur();
        if (!run) return;
        let got = null;
        await ctx.Store.change("runs", run.id, (x) => { const o = claim(x, s.id, s.level); got = o.got; return o.run; });
        if (!got || !give(s, run, got)) return toast("Nothing left for you in there.");
        ctx.persist(true);
        toast(` Your share: ${got.gold} gold${got.items.length ? ", " + got.items.map((i) => D.ITEMS[i].name).join(", ") : ""}.`);
        ctx.renderDungeon();
      }
      ctx.bump(); ctx.renderPanel?.(true);
    }

    return { onRuns, onParty, sync, myInvites,card: () => card(S()), allies: () => allies(S(), ctx.others()), lobbyHTML, invitesHTML, bar, waiting, waitHTML, behindHTML, beforePick, afterPick, afterAct, chestHTML, left, act, get runs() { return runs; } };
  }

  return { RUN_SECONDS, MAX_MEMBERS, FOE_BONUS, WAVE_BONUS, ROLE, live, isMember, activeMembers, inParty, fromParty, newRun, invite, addMember, decline, removeMember, join, foe, keyOf, canPick, recordPick, shape, follow, picked,
    profile, card, allies, allyFromCard, allyAct, hitAlly, roll, claim, bossDown, give, ui };
})();
