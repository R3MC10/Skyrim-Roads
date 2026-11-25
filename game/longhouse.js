/* The adventuring company longhouse: a shared base for a party or a group of friends (up to 8 players; followers
   don't count). [OURS]
   - One record per company in the shared "longhouse" collection (id "lh-" + founder id). Everything money-like lives in
     a ledger (tx: one entry per deposit, withdrawal, build, gift of materials, trophy, join...). The treasury balance,
     the material stockpile, the room levels and the trophy wall are all worked out from the ledger, so two members
     writing at the same time never overwrite each other (netsync.js merges the members / invites / tx maps key by key).
   - Founding costs gold (you must be in a town or village: that's where the longhouse stands). The founder can name
     officers and choose who may withdraw, build and set the plan, and how much a member may take out each day.
   - Rooms (three levels each, paid from the treasury in gold and materials; the forge uses the materials up):
       Forge          Smithing XP +10/20/30%, from level 2 tempering goes one step further, level 3: +5% damage with
                      tempered weapons
       Library        every skill book also gives 25/50/75% of the next level, the Rune table budget +3% a level,
                      level 2 opens the cheap and quick runes, level 3 the rune and lingering ones
       Trophy hall    trophies from legendary beasts and big bosses (4/9/18 on the wall): +4% damage and -4% damage
                      taken against that kind of foe (legendary beasts +6%)
       Stables        horse bond grows 20/40/60% faster, level 3: horses carry 25 more
       Planning table a standing battle plan for dungeons and hold crises (Shield Wall, Spearhead, Ambush, Supply Line,
                      Kill the Leader)
   - Costs scale with company size (bigger companies pay a bit more in total, much less each). Sim: tests/test_longhouse.js.
   Perks (perkfx.js): Company Purse (Mercantile), War Council (Etiquette), Trophy Mounter (Smithing). */
const LONGHOUSE = (() => {
  const COL = "longhouse", MAXM = 8, FOUND = 3000, DAY = 86400, KEEP = 120, OLD = 14 * DAY;
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)(:lc)?\}/g, (m, k, lc) => (k in v ? (lc ? String(v[k]).toLowerCase() : String(v[k] ?? "")) : m)) : en);
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const itemName = (id) => (typeof D !== "undefined" && D.ITEMS && D.ITEMS[id] ? D.ITEMS[id].name : id.replace(/^mat_/, ""));
  /* perk ranks read straight from the save (never through PFX: PFX asks us for our numbers) */
  const perk = (s, key) => {
    if (!s || !s.perks || typeof PFX === "undefined" || !PFX.FX) return 0;
    let t = 0; for (const id in s.perks) { const fx = PFX.FX[id]; if (s.perks[id] && fx) for (const [k, v] of fx) if (k === key) t += Array.isArray(v) ? v[Math.min(v.length, s.perks[id]) - 1] : v; }
    return t;
  };
  const costCut = (s) => 1 - Math.min(0.5, perk(s, "lhcost"));       // Company Purse
  const planBoost = (s) => 1 + Math.min(1, perk(s, "lhplan"));        // War Council
  const trophyBoost = (s) => 1 + Math.min(1, perk(s, "lhtrophy"));    // Trophy Mounter

  // ---------------------------------------------------------------- rooms
  const ROOMS = {
    forge: { name: "Forge", icon: "", lv: [[1000, { mat_iron: 10, mat_firewood: 10 }], [2500, { mat_steel: 10, mat_leather: 6 }], [6000, { mat_steel: 15, mat_dwarven: 5, mat_moonstone: 5 }]],
      fx: ["Smithing XP +10%.", "Smithing XP +20%, and tempering goes one step further.", "Smithing XP +30%, tempering one step further, and tempered weapons hit 5% harder."] },
    library: { name: "Library", icon: "", lv: [[1200, { mat_firewood: 10, mat_leather: 8 }], [3000, { mat_leather: 10, mat_moonstone: 3 }], [7000, { mat_moonstone: 6, mat_dwarven: 4 }]],
      fx: ["Every skill book also gives a quarter of the next level. Rune table budget +3%.", "Skill books give half of the next level as well. Rune budget +6%, and the cheap and quick runes are open to you.", "Skill books give three quarters of the next level as well. Rune budget +9%, and the rune and lingering forms are open too."] },
    trophy: { name: "Trophy hall", icon: "", lv: [[1000, { mat_iron: 6, mat_leather: 6 }], [2500, { mat_steel: 8, mat_leather: 8 }], [6000, { mat_steel: 12, mat_moonstone: 4 }]],
      fx: ["4 trophies on the wall. Each one: +4% damage and 4% less damage taken against that kind of foe (legendary beasts 6%).", "9 trophies on the wall, each one +4% against its kind of foe (legendary beasts 6%).", "18 trophies on the wall: every one the company can earn, each +4% against its kind of foe (legendary beasts 6%)."] },
    stables: { name: "Stables", icon: "", lv: [[800, { mat_firewood: 12, mat_iron: 4 }], [2000, { mat_leather: 10, mat_iron: 8 }], [5000, { mat_steel: 10, mat_leather: 10 }]],
      fx: ["Your horse's bond grows 20% faster.", "Your horse's bond grows 40% faster.", "Your horse's bond grows 60% faster, and horses carry 25 more."] },
    plan: { name: "Planning table", icon: "", lv: [[800, { mat_firewood: 8, mat_iron: 4 }], [2000, { mat_steel: 6, mat_leather: 4 }], [5000, { mat_steel: 10, mat_dwarven: 4 }]],
      fx: ["Opens the Shield Wall and Spearhead plans.", "Opens the Ambush and Supply Line plans.", "Opens the Kill the Leader plan."] },
  };
  const ROOM_IDS = Object.keys(ROOMS);
  const SLOTS = [0, 4, 9, 18];
  const MATS = ["mat_iron", "mat_steel", "mat_leather", "mat_firewood", "mat_moonstone", "mat_dwarven"];
  const sizeMult = (n) => clamp(0.6 + 0.1 * n, 0.7, 1.4);
  function costOf(room, lvl, n, s) {
    const c = ROOMS[room]?.lv[lvl - 1]; if (!c) return null;
    const k = sizeMult(n), cut = s ? costCut(s) : 1, m = {};
    for (const [id, q] of Object.entries(c[1])) m[id] = Math.max(1, Math.round(q * k));
    return { g: Math.round(c[0] * k * cut / 10) * 10, m };
  }
  const foundCost = (s) => Math.round(FOUND * (s ? costCut(s) : 1));

  /* battle plans: they work in dungeon fights and in hold crisis fights */
  const PLANS = {
    wall: { lv: 1, name: "Shield Wall", text: "Everyone takes 6% less damage.", fx: [["in", -0.06]] },
    spear: { lv: 1, name: "Spearhead", text: "Everyone hits 6% harder.", fx: [["out", 0.06]] },
    ambush: { lv: 2, name: "Ambush", text: "The first blow of every fight hits 30% harder.", fx: [["out", 0.3, { first: 1 }]] },
    supply: { lv: 2, name: "Supply Line", text: "Stamina comes back 25% faster.", fx: [["regensp", 0.25]] },
    leader: { lv: 3, name: "Kill the Leader", text: "Against bosses and tough foes: hit 10% harder, take 8% less.", fx: [["out", 0.1, { tough: 1 }], ["in", -0.08, { tough: 1 }]] },
  };

  /* trophies: the eight big-boss families and the ten legendary beasts (leghunt.js) */
  const FAMS = {
    dragon: { name: "Dragon skull", foe: "dragons", re: /dragon|drake|wyrm/i, tag: ["dragon"] },
    daedra: { name: "Daedric horn", foe: "Daedra", re: /daedr|dremora|atronach|seducer|scamp/i, tag: ["daedra"] },
    dwemer: { name: "Dwarven core", foe: "Dwarven machines", re: /dwarven|centurion|sphere|automaton|construct/i, tag: ["construct"] },
    falmer: { name: "Falmer war-mask", foe: "Falmer and chaurus", re: /falmer|chaurus/i, tag: ["falmer"] },
    undead: { name: "Draugr crown", foe: "the undead", re: /draugr|skeleton|lich|wight|vampire|ghost|wraith|revenant|dragon priest|deathlord|overlord/i, tag: ["undead"] },
    giant: { name: "Giant's club", foe: "giants and mammoths", re: /giant|mammoth/i, tag: [] },
    beast: { name: "Beast pelt", foe: "beasts", re: /wolf|bear|sabre|troll|spider|spriggan|mudcrab|skeever|horker/i, tag: ["beast", "animal"] },
    people: { name: "Warlord's banner", foe: "bandits and other people", re: /bandit|forsworn|thalmor|necromancer|warlock|outlaw|marauder|chief|mage|hagraven/i, tag: ["humanoid", "bandit", "forsworn"] },
  };
  const FAM_ORDER = ["dragon", "daedra", "dwemer", "falmer", "undead", "giant", "beast", "people"];
  const LEG = {
    mudking: /mudcrab/i, whiteghost: /sabre|saber/i, briar: /spriggan/i, vyrthax: /spider/i, grimfang: /bear/i,
    whitefang: /troll/i, ashtusk: /mammoth/i, palelady: /wisp|wraith|ghost/i, grimscale: /chaurus/i, hircine: /werewolf|wolf/i,
  };
  function famOf(e) {
    if (!e) return null;
    const tags = new Set(e.tags || []), n = e.name || "";
    for (const k of FAM_ORDER) { const f = FAMS[k]; if (f.tag.some((t) => tags.has(t)) && !(k === "beast" && /dwarven/i.test(n))) return k; if (f.re.test(n)) return k; }
    return null;
  }
  const legName = (id) => (typeof LEGHUNT !== "undefined" && LEGHUNT.BY && LEGHUNT.BY[id] ? LEGHUNT.BY[id].name : id);
  function trophyInfo(tr) {
    if (tr.startsWith("boss-")) { const f = FAMS[tr.slice(5)]; return f ? { name: T(f.name), foe: T(f.foe), v: 0.04, icon: "" } : null; }
    if (tr.startsWith("leg-")) { const id = tr.slice(4); return LEG[id] ? { name: legName(id), foe: legName(id), v: 0.06, icon: "", leg: 1 } : null; }
    return null;
  }
  function trophyHits(tr, e) {
    if (!e) return false;
    if (tr.startsWith("boss-")) return famOf(e) === tr.slice(5);
    const id = tr.slice(4), n = e.name || "";
    if (e.legend === id) return true;
    return !!LEG[id] && LEG[id].test(n) && !(id === "vyrthax" && /dwarven/i.test(n));
  }

  // ---------------------------------------------------------------- the shared records
  let docs = {}, api = null, loopT = null, tab = "rooms", draft = { gold: "", name: "" }, seenInv = new Set();
  const cache = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function setDocs(list) {
    const nx = {};
    for (const d of list || []) if (d && d.id && !d._del) nx[d.id] = d;
    docs = nx;
    const S = me(); if (S) { checkInvites(S); const ae = typeof document !== "undefined" ? document.activeElement : null, typing = !!ae?.closest?.("#lng-root") && /INPUT|SELECT/.test(ae.tagName); if (api && !typing && typeof document !== "undefined" && document.getElementById("lng-root")) api.render?.(); }
  }
  const me = () => (api ? api.S() : null);
  const live = (m) => !!m && !m.gone;
  const membersOf = (d) => Object.entries(d?.members || {}).filter(([, m]) => live(m)).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.t || 0) - (b.t || 0));
  const countOf = (d) => membersOf(d).length;
  const roleOf = (d, uid) => (live(d?.members?.[uid]) ? d.members[uid].role || "member" : null);
  /* the company this player belongs to (remembered in the save as s.lhId) */
  function mine(s) {
    if (!s || !s.id) return null;
    const d = s.lhId && docs[s.lhId];
    if (d && live(d.members?.[s.id])) return d;
    for (const x of Object.values(docs)) if (live(x.members?.[s.id])) { s.lhId = x.id; return x; }
    if (s.lhId && Object.keys(docs).length) delete s.lhId;
    return null;
  }
  const byTime = (a, b) => (a.t || 0) - (b.t || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  /* everything the ledger adds up to */
  function derive(d) {
    if (!d) return null;
    if (cache && cache.has(d)) return cache.get(d);
    const tx = Object.entries(d.tx || {}).map(([id, e]) => ({ id, ...e })).sort(byTime);
    let gold = 0; const mats = {}, built = new Set(), trophies = [];
    for (const e of tx) {
      gold += e.g || 0;
      if (e.m) for (const [k, q] of Object.entries(e.m)) mats[k] = (mats[k] || 0) + q;
      if (e.k === "build") built.add(`${e.room}-${e.lvl}`);
      if (e.k === "trophy" && e.tr && !trophies.includes(e.tr)) trophies.push(e.tr);
    }
    const rooms = {};
    for (const r of ROOM_IDS) { let l = 0; while (l < 3 && built.has(`${r}-${l + 1}`)) l++; rooms[r] = l; }
    for (const k of Object.keys(mats)) if (mats[k] <= 0) delete mats[k];
    const out = { gold: Math.max(0, Math.round(gold)), mats, rooms, trophies, tx, n: countOf(d) };
    if (cache) cache.set(d, out);
    return out;
  }
  const roomLv = (s, r) => { const d = mine(s); return d ? derive(d).rooms[r] || 0 : 0; };
  const rid = (k, uid, t) => `${k}-${String(uid).slice(-6)}-${Math.floor(t).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  /* old gold entries fold into one line a week, so the ledger stays small (builds, trophies and the last weeks stay as they are) */
  function fold(d, t) {
    const ents = Object.entries(d.tx || {});
    if (ents.length <= KEEP) return d;
    const tx = { ...d.tx };
    for (const [id, e] of ents) {
      if (e.k === "build" || e.k === "trophy" || e.k === "sum" || !(t - (e.t || 0) > OLD)) continue;
      const wk = `wk-${Math.floor((e.t || 0) / (7 * DAY))}`, w = tx[wk] ? { ...tx[wk], m: { ...(tx[wk].m || {}) } } : { k: "sum", t: Math.floor((e.t || 0) / (7 * DAY)) * 7 * DAY, g: 0, m: {} };
      w.g = (w.g || 0) + (e.g || 0);
      if (e.m) for (const [k, q] of Object.entries(e.m)) w.m[k] = (w.m[k] || 0) + q;
      tx[wk] = w; delete tx[id];
    }
    return { ...d, tx };
  }
  const can = (d, uid, what) => {
    const r = roleOf(d, uid); if (!r) return false;
    if (r === "founder") return true;
    const p = (d.perms || {})[what] || (what === "invite" ? "officers" : what === "plan" ? "officers" : "founder");
    return p === "all" || (p === "officers" && r === "officer");
  };
  const capOf = (d) => Math.max(0, Math.round((d.perms || {}).cap ?? 500));
  const takenToday = (d, uid, t) => Object.values(d.tx || {}).filter((e) => e.k === "wd" && e.by === uid && t - (e.t || 0) < DAY).reduce((a, e) => a - (e.g || 0), 0);

  /* write to the company record under a short lease. fn(doc) returns the new doc or an error text. */
  async function edit(S, fn) {
    const d = mine(S); if (!d) return T("You're not in a company.");
    if (typeof Store === "undefined") return T("The longhouse didn't answer. Try again.");
    let err = null;
    const r = await Store.change(COL, d.id, (cur) => { const nx = fn(cur); if (typeof nx === "string") { err = nx; return cur; } return fold(nx, nowS()); });
    if (err) return err;
    if (!r) return T("The longhouse didn't answer. Try again.");
    return null;
  }
  const addTx = (d, id, e) => ({ ...d, tx: { ...(d.tx || {}), [id]: e } });

  // ---------------------------------------------------------------- actions
  async function found(S, name) {
    const t = nowS(), cost = foundCost(S);
    name = String(name || "").replace(/[<>]/g, "").trim().slice(0, 28);
    if (mine(S)) return T("You're already in a company.");
    if (!S.location || S.trip?.status || S.dungeon) return T("Found it in a town or village: that's where the longhouse will stand.");
    if (name.length < 3) return T("Give your company a name (3 letters or more).");
    if ((S.gold || 0) < cost) return T("Founding a longhouse costs {n} gold.", { n: cost });
    if (typeof Store === "undefined") return T("The longhouse didn't answer. Try again.");
    const id = `lh-${S.id}`;
    const doc = { name, founder: S.id, founderName: S.name, site: S.location, t: Math.floor(t), plan: null,
      perms: { wd: "founder", build: "officers", plan: "officers", invite: "officers", cap: 500 },
      members: { [S.id]: { name: S.name, role: "founder", t: Math.floor(t) } }, invites: {},
      tx: { [rid("found", S.id, t)]: { k: "found", by: S.id, who: S.name, t: Math.floor(t), g: 0 } } };
    const ok = await Store.put(COL, id, doc);
    if (ok === false) return T("The longhouse didn't answer. Try again.");
    S.gold -= cost; S.lhId = id;
    if (typeof G !== "undefined" && G.note) G.note(S, T("You founded {name}, an adventuring company, in {place}.", { name, place: S.location }));
    return null;
  }
  async function deposit(S, n) {
    n = Math.floor(+n || 0); const t = nowS();
    if (!(n > 0)) return T("How much?");
    if ((S.gold || 0) < n) return T("You don't have that much gold.");
    const err = await edit(S, (d) => (live(d.members?.[S.id]) ? addTx(d, rid("dep", S.id, t), { k: "dep", by: S.id, who: S.name, t: Math.floor(t), g: n }) : T("You're not in a company.")));
    if (!err) S.gold -= n;
    return err;
  }
  async function withdraw(S, n) {
    n = Math.floor(+n || 0); const t = nowS();
    if (!(n > 0)) return T("How much?");
    const err = await edit(S, (d) => {
      if (!can(d, S.id, "wd")) return T("Only the people the founder allows can take gold out.");
      if (derive(d).gold < n) return T("The treasury doesn't have that much.");
      if (roleOf(d, S.id) !== "founder") { const left = capOf(d) - takenToday(d, S.id, t); if (n > left) return T("You can take out {n} more gold today.", { n: Math.max(0, left) }); }
      return addTx(d, rid("wd", S.id, t), { k: "wd", by: S.id, who: S.name, t: Math.floor(t), g: -n });
    });
    if (!err) S.gold = (S.gold || 0) + n;
    return err;
  }
  const rowOf = (S, item) => (S.inv || []).find((r) => r.item === item);
  async function giveMat(S, item, n) {
    n = Math.floor(+n || 0); const t = nowS(), r = rowOf(S, item);
    if (!MATS.includes(item) || !(n > 0)) return T("How much?");
    if (!r || r.qty < n) return T("You don't have that many.");
    const err = await edit(S, (d) => (live(d.members?.[S.id]) ? addTx(d, rid("mat", S.id, t), { k: "mat", by: S.id, who: S.name, t: Math.floor(t), m: { [item]: n } }) : T("You're not in a company.")));
    if (!err && typeof G !== "undefined") G.take(S, r.id, n);
    return err;
  }
  async function build(S, room) {
    const t = nowS();
    return edit(S, (d) => {
      if (!ROOMS[room]) return T("No such room.");
      if (!can(d, S.id, "build")) return T("Only the people the founder allows can build.");
      const x = derive(d), lvl = (x.rooms[room] || 0) + 1;
      if (lvl > 3) return T("That room is finished.");
      const c = costOf(room, lvl, x.n, S);
      if (x.gold < c.g) return T("The treasury needs {n} gold for that.", { n: c.g });
      for (const [k, q] of Object.entries(c.m)) if ((x.mats[k] || 0) < q) return T("The stockpile needs {n} {item}.", { n: q, item: itemName(k) });
      const m = {}; for (const [k, q] of Object.entries(c.m)) m[k] = -q;
      return addTx(d, `b-${room}-${lvl}`, { k: "build", by: S.id, who: S.name, t: Math.floor(t), g: -c.g, m, room, lvl });
    });
  }
  async function setPlan(S, plan) {
    const t = nowS();
    return edit(S, (d) => {
      if (!can(d, S.id, "plan")) return T("Only the people the founder allows can set the plan.");
      if (plan && (!PLANS[plan] || PLANS[plan].lv > (derive(d).rooms.plan || 0))) return T("Build the planning table up first.");
      return addTx({ ...d, plan: plan || null }, rid("plan", S.id, t), { k: "plan", by: S.id, who: S.name, t: Math.floor(t), plan: plan || null });
    });
  }
  async function invite(S, uid, name) {
    const t = nowS();
    return edit(S, (d) => {
      if (!can(d, S.id, "invite")) return T("Only the founder and officers can invite.");
      if (live(d.members?.[uid])) return T("{name} is already one of you.", { name });
      if (countOf(d) >= MAXM) return T("A company holds up to {n} players.", { n: MAXM });
      return { ...d, invites: { ...(d.invites || {}), [uid]: { name: String(name || "Traveller").slice(0, 40), by: S.name, t: Math.floor(t) } } };
    });
  }
  const invitesFor = (s) => Object.values(docs).filter((d) => { const i = d.invites?.[s.id]; return i && !i.gone && !live(d.members?.[s.id]); });
  async function join(S, id) {
    const t = nowS();
    if (mine(S)) return T("Leave your company first.");
    if (typeof Store === "undefined") return T("The longhouse didn't answer. Try again.");
    let err = null;
    const r = await Store.change(COL, id, (d) => {
      const i = d.invites?.[S.id];
      if (!i || i.gone) { err = T("That invitation is gone."); return d; }
      if (countOf(d) >= MAXM) { err = T("A company holds up to {n} players.", { n: MAXM }); return d; }
      const nx = { ...d, members: { ...(d.members || {}), [S.id]: { name: S.name, role: "member", t: Math.floor(t) } }, invites: { ...(d.invites || {}), [S.id]: { ...i, gone: Math.floor(t) } } };
      return addTx(nx, rid("join", S.id, t), { k: "join", by: S.id, who: S.name, t: Math.floor(t) });
    });
    if (err) return err;
    if (!r) return T("The longhouse didn't answer. Try again.");
    S.lhId = id;
    return null;
  }
  async function decline(S, id) {
    if (typeof Store === "undefined") return null;
    await Store.change(COL, id, (d) => (d.invites?.[S.id] ? { ...d, invites: { ...d.invites, [S.id]: { ...d.invites[S.id], gone: Math.floor(nowS()) } } } : d));
    return null;
  }
  async function leave(S) {
    const t = nowS(), d0 = mine(S); if (!d0) return T("You're not in a company.");
    if (roleOf(d0, S.id) === "founder" && countOf(d0) > 1) return T("Hand the company to someone else first (Members).");
    if (roleOf(d0, S.id) === "founder") {   // the last one out closes the doors and takes what's left in the purse
      const g = derive(d0).gold;
      await Store.remove(COL, d0.id);
      S.gold = (S.gold || 0) + g; delete S.lhId;
      return null;
    }
    const err = await edit(S, (d) => addTx({ ...d, members: { ...d.members, [S.id]: { ...d.members[S.id], gone: Math.floor(t) } } }, rid("leave", S.id, t), { k: "leave", by: S.id, who: S.name, t: Math.floor(t) }));
    if (!err) delete S.lhId;
    return err;
  }
  /* founder only: officer / member / out / founder */
  async function setRole(S, uid, role) {
    const t = nowS();
    return edit(S, (d) => {
      if (roleOf(d, S.id) !== "founder") return T("Only the founder can do that.");
      const m = d.members?.[uid]; if (!live(m) || uid === S.id) return T("No such member.");
      const mem = { ...d.members };
      if (role === "out") mem[uid] = { ...m, gone: Math.floor(t) };
      else if (role === "founder") { mem[uid] = { ...m, role: "founder" }; mem[S.id] = { ...mem[S.id], role: "officer" }; }
      else mem[uid] = { ...m, role: role === "officer" ? "officer" : "member" };
      const nx = { ...d, members: mem, ...(role === "founder" ? { founder: uid, founderName: m.name } : {}) };
      return addTx(nx, rid("role", S.id, t), { k: "role", by: S.id, who: S.name, t: Math.floor(t), whom: m.name, role });
    });
  }
  async function setPerm(S, what, val) {
    return edit(S, (d) => {
      if (roleOf(d, S.id) !== "founder") return T("Only the founder can do that.");
      const p = { ...(d.perms || {}) };
      if (what === "cap") p.cap = clamp(Math.round(+val || 0), 0, 100000);
      else if (["wd", "build", "plan", "invite"].includes(what) && ["founder", "officers", "all"].includes(val)) p[what] = val;
      else return T("No such setting.");
      return { ...d, perms: p };
    });
  }
  async function rename(S, name) {
    name = String(name || "").replace(/[<>]/g, "").trim().slice(0, 28);
    if (name.length < 3) return T("Give your company a name (3 letters or more).");
    return edit(S, (d) => (roleOf(d, S.id) === "founder" ? { ...d, name } : T("Only the founder can do that.")));
  }
  /* a trophy for the wall (the same trophy twice is one entry) */
  async function addTrophy(S, tr) {
    const d = mine(S); if (!d || !trophyInfo(tr) || d.tx?.[`tr-${tr}`]) return false;
    const t = nowS();
    const err = await edit(S, (x) => (x.tx?.[`tr-${tr}`] ? x : addTx(x, `tr-${tr}`, { k: "trophy", by: S.id, who: S.name, t: Math.floor(t), tr })));
    if (!err && api?.toast) api.toast(T("A trophy for the longhouse: {name}", { name: trophyInfo(tr).name }));
    return !err;
  }
  function onFight(S, e) {
    if (!S || !e || !mine(S)) return false;
    const big = e.boss || e.priest || e.qboss || (e.tags || []).includes("dragon");
    if (e.legend && LEG[e.legend]) { addTrophy(S, `leg-${e.legend}`); return true; }
    if (!big) return false;
    const f = famOf(e); if (f) { addTrophy(S, `boss-${f}`); return true; }
    return false;
  }
  /* legendary kills made before you joined (or on another phone) still count */
  function pollTrophies(S) {
    const d = mine(S); if (!d || !S.lhunt?.best) return;
    for (const [id, b] of Object.entries(S.lhunt.best)) if (b && b.kills > 0 && LEG[id] && !d.tx?.[`tr-leg-${id}`]) { addTrophy(S, `leg-${id}`); return; }
  }

  // ---------------------------------------------------------------- what the rooms do
  /* perkfx.js: [key, value, condition] lines that count like perks */
  function pfx(s, f) {
    const d = mine(s); if (!d) return [];
    const x = derive(d), out = [];
    if (x.rooms.forge >= 2) out.push(["temper", 1]);
    if (x.rooms.forge >= 3) out.push(["out", 0.05, { tempered: 1 }]);
    if (x.rooms.library) out.push(["rcbudget", 0.03 * x.rooms.library]);
    if (f && f.e && x.rooms.trophy) {
      const k = trophyBoost(s), on = x.trophies.slice(0, SLOTS[x.rooms.trophy]);
      let v = 0;
      for (const tr of on) if (trophyHits(tr, f.e)) v = Math.max(v, trophyInfo(tr).v);
      if (v > 0) out.push(["out", v * k], ["in", -v * k]);
    }
    const p = PLANS[d.plan];
    if (p && p.lv <= x.rooms.plan && (s.dungeon || f?.e?.crisis)) { const k = planBoost(s); for (const [key, v, c] of p.fx) out.push([key, v * k, c]); }
    return out;
  }
  const xpMult = (s, name) => (name === "Smithing" ? 1 + 0.1 * roomLv(s, "forge") : 1);
  const horseMult = (s) => 1 + 0.2 * roomLv(s, "stables");
  const horseCarry = (s) => (roomLv(s, "stables") >= 3 ? 25 : 0);
  /* a skill book: the library adds a share of the next level */
  function onBook(s, skill) {
    const lv = roomLv(s, "library"), sk = s?.skills?.[skill];
    if (!lv || !sk || sk.lvl >= 100 || typeof F === "undefined" || typeof G === "undefined") return [];
    const need = F.skillXpNeeded(skill, sk.lvl);
    sk.xp = (sk.xp || 0) + need * 0.25 * lv;
    return [T("The company library: you take in more ({n}% of the next level).", { n: 25 * lv }), ...G.useSkill(s, skill, 0)];
  }
  const runeOpen = (s, k) => { const lv = roomLv(s, "library"); return (lv >= 2 && (k === "cheap" || k === "quick")) || (lv >= 3 && (k === "rune" || k === "lingering")); };
  function hook() {
    if (typeof HALLS !== "undefined" && HALLS.xpMult && !HALLS.xpMult._lng) { const f0 = HALLS.xpMult; HALLS.xpMult = function (s, n) { return f0.call(this, s, n) * xpMult(s, n); }; HALLS.xpMult._lng = 1; }
    if (typeof HORSES !== "undefined" && HORSES.carry && !HORSES.carry._lng) { const c0 = HORSES.carry; HORSES.carry = function (s, ...a) { const v = c0.call(this, s, ...a); return s?.horse ? v + horseCarry(s) : v; }; HORSES.carry._lng = 1; }
    if (typeof RUNECRAFT !== "undefined" && RUNECRAFT.RUNES) for (const k of ["cheap", "quick", "rune", "lingering"]) { const r = RUNECRAFT.RUNES[k]; if (r && !r._lng) { const t0 = r.test; r.test = (s) => runeOpen(s, k) || t0(s); r._lng = 1; } }
  }
  hook();

  // ---------------------------------------------------------------- screens (Social → Company)
  const ROLE = { founder: "Founder", officer: "Officer", member: "Member" };
  const PERM = { founder: "Founder only", officers: "Founder and officers", all: "Everyone" };
  const pips = (n) => `<span class="lng-pips">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const matLine = (m, have) => Object.entries(m).map(([k, q]) => `<span class="${have && (have[k] || 0) < q ? "lng-short" : ""}">${q} ${esc(itemName(k))}</span>`).join(", ");
  const when = (t) => { const a = Math.max(0, nowS() - t); return a < 3600 ? T("{n} min ago", { n: Math.max(1, Math.round(a / 60)) }) : a < DAY ? T("{n} h ago", { n: Math.round(a / 3600) }) : T("{n} days ago", { n: Math.round(a / DAY) }); };
  function logLine(e) {
    const who = esc(e.who || "?");
    if (e.k === "dep") return T("{who} put in {n} gold", { who, n: e.g });
    if (e.k === "wd") return T("{who} took out {n} gold", { who, n: -e.g });
    if (e.k === "mat") return T("{who} gave {what}", { who, what: matLine(e.m || {}) });
    if (e.k === "build") return T("{who} built {room} (level {n})", { who, room: T(ROOMS[e.room]?.name || e.room), n: e.lvl });
    if (e.k === "trophy") return T("{who} brought home {name}", { who, name: esc(trophyInfo(e.tr)?.name || "") });
    if (e.k === "join") return T("{who} joined the company", { who });
    if (e.k === "leave") return T("{who} left the company", { who });
    if (e.k === "found") return T("{who} founded the company", { who });
    if (e.k === "plan") return e.plan ? T("{who} set the plan: {name}", { who, name: T(PLANS[e.plan]?.name || e.plan) }) : T("{who} cleared the plan", { who });
    if (e.k === "role") return e.role === "out" ? T("{who} sent {whom} away", { who, whom: esc(e.whom) }) : T("{who} made {whom} {role}", { who, whom: esc(e.whom), role: T(ROLE[e.role] || e.role).toLowerCase() });
    if (e.k === "exp" && typeof EXPEDITION !== "undefined") return EXPEDITION.logLine(e);   // expedition.js
    if (e.k === "sum") return T("Older gold and materials, added up ({n} gold)", { n: e.g || 0 });
    return "";
  }
  /* painted art (assets.js): the file's URL once it has loaded, else the older picture */
  const pic = (k, fb) => { try { return (typeof ASSETS !== "undefined" && ASSETS.url(k)) || fb; } catch { return fb; } };
  const bannerImg = () => { const u = pic("longhouse-banner", ""); return `<img src="${u || "shop-hall.webp"}" alt="" loading="lazy"${u ? ' class="lng-paint"' : ""}>`; };
  /* the longhouse itself (longhouse-plate), with light painted over it for every room the company has built.
     Spots are in the plate's own 1024x576 frame: windows, the door, the gable, the fence posts. */
  const WIN = [[587, 343], [676, 343], [747, 343], [866, 343]];
  function hallView(x) {
    const u = pic("longhouse-plate", ""); if (!u) return "";
    const R = x.rooms || {}, f = R.forge || 0, lib = R.library || 0, tr = R.trophy || 0, st = R.stables || 0, pl = R.plan || 0;
    const glow = (cx, cy, rx, ry, o, c = "lngW") => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${c})" opacity="${o.toFixed(2)}"/>`;
    let g = "";
    // library: more windows lit (the rest shuttered), and their light spills out
    const lit = Math.min(4, 1 + lib);
    WIN.forEach(([cx, cy], i) => {
      if (i >= lit) g += `<g class="lng-shut"><rect x="${cx - 13}" y="${cy - 14}" width="26" height="29" rx="2" fill="#17131a" opacity=".9"/><path d="M${cx - 13} ${cy - 5}h26M${cx - 13} ${cy + 5}h26" stroke="#3a2c22" stroke-width="2"/></g>`;
      else if (lib) g += glow(cx, cy + 4, 34 + 6 * lib, 26 + 4 * lib, 0.3 + 0.15 * lib);
    });
    // forge: the doorway burns brighter (cold and dim until it's built), embers above the smoke hole
    g += f ? glow(360, 372, 70 + 25 * f, 46 + 12 * f, 0.25 + 0.17 * f, "lngF") : `<ellipse cx="360" cy="368" rx="44" ry="44" fill="#0c0a10" opacity=".5"/>`;
    if (f >= 2) g += [[505, 178, 3], [520, 160, 2.4], [498, 146, 2], [530, 132, 1.8], [512, 118, 1.5]].slice(0, f === 3 ? 5 : 3).map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffb347" opacity=".85"/>`).join("") + glow(510, 190, 30, 18, 0.35, "lngF");
    // trophy hall: an antlered skull on the gable, then shields on the wall
    if (tr) g += `<g class="lng-trophy" transform="translate(358 270)"><path d="M-6 0c-10-6-14-16-12-26M-12-16l-8-4M-14-24l-6-8M6 0c10-6 14-16 12-26M12-16l8-4M14-24l6-8" stroke="#efe2c4" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-7-2h14l-2 14-5 6-5-6z" fill="#e9dcc0"/><circle cx="-3" cy="4" r="1.6" fill="#2a2018"/><circle cx="3" cy="4" r="1.6" fill="#2a2018"/></g>`;
    const shield = (cx, cy, c) => `<g transform="translate(${cx} ${cy})"><circle r="11" fill="${c}" stroke="#c9a45a" stroke-width="2.2"/><circle r="3" fill="#c9a45a"/></g>`;
    if (tr >= 2) g += shield(632, 352, "#7a2a22") + shield(806, 352, "#22406a");
    if (tr >= 3) g += shield(711, 320, "#2f5a34") + glow(711, 335, 120, 40, 0.18);
    // stables: a lantern by the fence, then a second one, then a horseshoe over the door
    if (st) g += glow(905, 372, 34 + 8 * st, 30 + 6 * st, 0.4 + 0.12 * st) + `<rect x="900" y="364" width="10" height="13" rx="2" fill="#ffd27a"/>`;
    if (st >= 2) g += glow(66, 372, 40, 32, 0.55) + `<rect x="61" y="364" width="10" height="13" rx="2" fill="#ffd27a"/>`;
    if (st >= 3) g += `<path d="M350 300a10 10 0 1 1 20 0" fill="none" stroke="#d8c7a0" stroke-width="4" stroke-linecap="round" transform="rotate(180 360 300)"/>`;
    // planning table: company banners by the door, then a pennant on the dragon head
    const flag = (px) => `<g transform="translate(${px} 300)"><path d="M0 0v112" stroke="#3b2a1c" stroke-width="3"/><path d="M2 4h26v40l-13-8-13 8z" fill="#8e2a22" stroke="#d6b25e" stroke-width="1.5"/><path d="M15 14l5 7-5 7-5-7z" fill="#d6b25e"/></g>`;
    if (pl) g += flag(196);
    if (pl >= 2) g += flag(496);
    if (pl >= 3) g += `<path d="M846 186v-34l28 9-28 9" fill="#8e2a22" stroke="#d6b25e" stroke-width="1.5"/>`;
    return `<div class="lng-view"><img src="${u}" alt="${T("Your longhouse")}" loading="lazy"><svg viewBox="0 0 1024 576" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><radialGradient id="lngW"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".95"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
      <radialGradient id="lngF"><stop offset="0" stop-color="#ffb04a" stop-opacity="1"/><stop offset=".6" stop-color="#ff6a1f" stop-opacity=".35"/><stop offset="1" stop-color="#ff5a10" stop-opacity="0"/></radialGradient></defs>${g}</svg>
      <p class="lng-vcap">${T("Every room you build shows on the hall.")}</p></div>`;
  }
  function banner(d, x) {
    return `<div class="lng-banner">${bannerImg()}<div class="lng-bt"><div class="lng-name">${esc(d.name)}</div>
      <div class="lng-sub">${T("Longhouse in {place}", { place: esc(d.site || "?") })} · ${T("{n} of {m} players", { n: x.n, m: MAXM })}</div>
      <div class="lng-purse"> ${x.gold} ${T("gold in the treasury")}</div></div></div>`;
  }
  function roomsHTML(S, d, x) {
    return `${hallView(x)}<div class="lng-rooms">${ROOM_IDS.map((r) => {
      const R = ROOMS[r], lv = x.rooms[r], c = lv < 3 ? costOf(r, lv + 1, x.n, S) : null;
      const okG = c && x.gold >= c.g, okM = c && Object.entries(c.m).every(([k, q]) => (x.mats[k] || 0) >= q), may = can(d, S.id, "build");
      return `<div class="lng-room${lv ? " built" : ""}"><div class="lng-rh"><span class="lng-ic">${R.icon}</span><b>${T(R.name)}</b>${pips(lv)}</div>
        <p class="lng-fx">${lv ? T(R.fx[lv - 1]) : `<i>${T("Not built yet.")}</i>`}</p>
        ${c ? `<div class="lng-next"><span class="lng-lbl">${T("Next: level {n}", { n: lv + 1 })}</span> ${T(R.fx[lv])}</div>
        <div class="lng-cost"><span class="${okG ? "" : "lng-short"}">${c.g} ${T("gold")}</span>, ${matLine(c.m, x.mats)}</div>
        <button class="btn sm${okG && okM && may ? " pri" : ""}" data-lng="build" data-id="${r}"${okG && okM && may ? "" : " disabled"}>${lv ? T("Upgrade") : T("Build")}</button>`
        : `<div class="lng-done">${T("Finished")}</div>`}</div>`;
    }).join("")}</div>${can(d, S.id, "build") ? "" : `<p class="sub">${T("Only the people the founder allows can build.")}</p>`}`;
  }
  function planHTML(S, d, x) {
    const lv = x.rooms.plan, may = can(d, S.id, "plan");
    if (!lv) return `<p class="sub">${T("Build the planning table to choose a battle plan for dungeons and hold crises.")}</p>`;
    return `<p class="sub">${T("The plan works for every member in dungeon fights and hold crisis fights.")}</p><div class="lng-plans">${Object.entries(PLANS).map(([k, p]) => {
      const open = p.lv <= lv, on = d.plan === k;
      return `<button class="lng-plan${on ? " on" : ""}" data-lng="plan" data-id="${on ? "" : k}"${open && may ? "" : " disabled"}><b>${T(p.name)}</b><span>${open ? T(p.text) : T("Planning table level {n}", { n: p.lv })}</span></button>`;
    }).join("")}</div>`;
  }
  function trophyHTML(S, x) {
    const slots = SLOTS[x.rooms.trophy] || 0;
    const all = x.trophies.map((tr, i) => ({ tr, i, info: trophyInfo(tr) })).filter((o) => o.info);
    const head = x.rooms.trophy ? T("{n} of {m} places on the wall", { n: Math.min(all.length, slots), m: slots }) : T("Build the trophy hall to hang them up.");
    return `<p class="sub">${head} · ${T("Beat a legendary beast or a big boss (dragons, dragon priests, dungeon masters) to bring one home.")}</p>
      <div class="lng-troph">${all.length ? all.map((o) => `<div class="lng-tr${o.i < slots ? " on" : ""}"><span class="lng-ic">${o.info.icon}</span><div><b>${esc(o.info.name)}</b><span>${o.i < slots ? T("+{n}% against {foe}", { n: Math.round(o.info.v * 100 * trophyBoost(S)), foe: esc(o.info.foe) }) : T("No room on the wall")}</span></div></div>`).join("")
      : `<p class="sub">${T("No trophies yet.")}</p>`}</div>`;
  }
  function treasuryHTML(S, d, x) {
    const may = can(d, S.id, "wd"), founder = roleOf(d, S.id) === "founder", left = founder ? null : Math.max(0, capOf(d) - takenToday(d, S.id, nowS()));
    const mats = MATS.map((k) => { const r = rowOf(S, k); return `<div class="lng-mat"><span>${esc(itemName(k))}</span><b>${x.mats[k] || 0}</b><span class="lng-have">${T("you: {n}", { n: r?.qty || 0 })}</span><span class="lng-mb">${r?.qty ? `<button class="btn sm" data-lng="give" data-id="${k}" data-n="1">+1</button><button class="btn sm" data-lng="give" data-id="${k}" data-n="${r.qty}">${T("All")}</button>` : ""}</span></div>`; }).join("");
    return `<div class="lng-gold"><input id="lng-amt" inputmode="numeric" placeholder="${T("Gold")}" value="${esc(draft.gold)}" aria-label="${T("Gold")}">
      <button class="btn pri" data-lng="dep">${T("Put in")}</button><button class="btn" data-lng="wd"${may ? "" : " disabled"}>${T("Take out")}</button></div>
      <p class="sub">${T("You carry {n} gold.", { n: S.gold || 0 })} ${may ? (left == null ? T("You can take out as much as you like.") : T("You can take out {n} more gold today.", { n: left })) : T("Only the people the founder allows can take gold out.")}</p>
      <h3>${T("Stockpile")}</h3><p class="sub">${T("Rooms use materials from here. Give what you carry.")}</p><div class="lng-mats">${mats}</div>`;
  }
  function membersHTML(S, d) {
    const mem = membersOf(d), founder = roleOf(d, S.id) === "founder";
    const rows = mem.map((m) => `<div class="lng-mem"><div class="t"><b style="font-weight:500">${esc(m.name)}${m.id === S.id ? ` <span class="gold">${T("(you)")}</span>` : ""}</b><span>${T(ROLE[m.role] || "Member")}</span></div>
      ${founder && m.id !== S.id ? `<div class="lng-mbtn"><button class="btn sm" data-lng="role" data-id="${esc(m.id)}" data-r="${m.role === "officer" ? "member" : "officer"}">${m.role === "officer" ? T("Make member") : T("Make officer")}</button><button class="btn sm" data-lng="role" data-id="${esc(m.id)}" data-r="founder">${T("Hand over")}</button><button class="btn sm danger" data-lng="role" data-id="${esc(m.id)}" data-r="out">${T("Send away")}</button></div>` : ""}</div>`).join("");
    const inv = can(d, S.id, "invite") && mem.length < MAXM ? inviteList(S, d) : "";
    const pend = Object.entries(d.invites || {}).filter(([id, i]) => !i.gone && !live(d.members?.[id]));
    return `<h3>${T("Members")} · ${mem.length}/${MAXM}</h3>${rows}
      ${pend.length ? `<p class="sub">${T("Invited")}: ${pend.map(([, i]) => esc(i.name)).join(", ")}</p>` : ""}${inv}
      ${founder ? permsHTML(d) : ""}
      <button class="btn sm danger" data-lng="leave" style="margin-top:10px">${founder && mem.length <= 1 ? T("Close the longhouse") : T("Leave the company")}</button>`;
  }
  function inviteList(S, d) {
    const seen = new Set(), out = [];
    const add = (id, name) => { if (!id || id === S.id || seen.has(id) || live(d.members?.[id])) return; seen.add(id); out.push([id, name]); };
    const p = api?.party?.(); if (p && p.members) for (const m of p.members) add(m.id, m.name);
    if (typeof SOCIAL !== "undefined") for (const [id, f] of Object.entries(SOCIAL.friends(S) || {})) add(id, f.name);
    if (!out.length) return `<p class="sub">${T("Invite your party and your friends from here. Add friends in Social → Friends.")}</p>`;
    return `<h3 style="margin-top:10px">${T("Invite")}</h3>${out.slice(0, 16).map(([id, name]) => `<div class="item"><div class="t">${esc(name)}</div>${d.invites?.[id] && !d.invites[id].gone ? `<span class="sub">${T("Invited")}</span>` : `<button class="btn sm" data-lng="invite" data-id="${esc(id)}" data-name="${esc(name)}">${T("Invite")}</button>`}</div>`).join("")}`;
  }
  function permsHTML(d) {
    const p = d.perms || {};
    const sel = (what, label) => `<label class="lng-perm"><span>${label}</span><select data-lngsel="${what}">${Object.entries(PERM).map(([k, v]) => `<option value="${k}"${(p[what] || (what === "wd" ? "founder" : "officers")) === k ? " selected" : ""}>${T(v)}</option>`).join("")}</select></label>`;
    return `<h3 style="margin-top:12px">${T("Who may...")}</h3>${sel("wd", T("Take gold out"))}${sel("build", T("Build rooms"))}${sel("plan", T("Set the plan"))}${sel("invite", T("Invite players"))}
      <label class="lng-perm"><span>${T("Daily limit per member")}</span><select data-lngsel="cap">${[0, 200, 500, 1000, 2500, 10000].map((n) => `<option value="${n}"${capOf(d) === n ? " selected" : ""}>${n} ${T("gold")}</option>`).join("")}</select></label>`;
  }
  function logHTML(x) {
    const ents = x.tx.slice().reverse().slice(0, 60).map((e) => [e, logLine(e)]).filter(([, l]) => l);
    return `<div class="lng-log">${ents.map(([e, l]) => `<div class="lng-le"><span>${l}</span><i>${when(e.t || 0)}</i></div>`).join("")}</div>`;
  }
  function outsideHTML(S) {
    const inv = invitesFor(S), c = foundCost(S);
    return `<div class="lng-banner">${bannerImg()}<div class="lng-bt"><div class="lng-name">${T("Adventuring company")}</div><div class="lng-sub">${T("A longhouse for you and your friends")}</div></div></div>
      ${inv.length ? `<h3>${T("Invitations")}</h3>${inv.map((d) => `<div class="item on"><div class="t">${esc(d.name)}<span>${T("{who} invites you · {n} of {m} players", { who: esc(d.invites[S.id].by), n: countOf(d), m: MAXM })}</span></div><div class="fbtns"><button class="btn sm pri" data-lng="join" data-id="${esc(d.id)}">${T("Join")}</button><button class="btn sm" data-lng="decline" data-id="${esc(d.id)}">${T("No thanks")}</button></div></div>`).join("")}` : ""}
      <p class="sub">${T("Found a company with your party or your friends (up to 8 players). Share a treasury, then build a forge, a library, a trophy hall, stables and a planning table that help every member.")}</p>
      <h3>${T("Found a longhouse")}</h3>
      <div class="lng-gold"><input id="lng-name" maxlength="28" placeholder="${T("Company name")}" value="${esc(draft.name)}" aria-label="${T("Company name")}"><button class="btn pri" data-lng="found"${(S.gold || 0) >= c ? "" : " disabled"}>${T("Found it ({n} gold)", { n: c })}</button></div>
      <p class="sub">${S.location && !S.trip?.status ? T("It will stand in {place}.", { place: esc(S.location) }) : T("Found it in a town or village: that's where the longhouse will stand.")}</p>`;
  }
  function panel() {
    const S = me(); if (!S) return "";
    const d = mine(S);
    const off = typeof Store !== "undefined" && !Store.online ? `<p class="sub">${T("You're playing offline: the longhouse is shared once you go online.")}</p>` : "";
    if (!d) return `<div class="panel lng" id="lng-root"><h2> ${T("Company")}</h2>${off}${typeof EXPEDITION !== "undefined" ? EXPEDITION.trackerHTML(S) : ""}${outsideHTML(S)}</div>`;
    const x = derive(d);
    const tabs = [["rooms", T("Rooms")], ...(typeof EXPEDITION !== "undefined" ? [["exp", T("Expeditions")]] : []), ["plan", T("Plan")], ["trophy", T("Trophies")], ["gold", T("Treasury")], ["members", T("Members")], ["log", T("Log")]];
    const body = tab === "exp" && typeof EXPEDITION !== "undefined" ? EXPEDITION.panelHTML(S, d) : tab === "plan" ? planHTML(S, d, x) : tab === "trophy" ? trophyHTML(S, x) : tab === "gold" ? treasuryHTML(S, d, x) : tab === "members" ? membersHTML(S, d) : tab === "log" ? logHTML(x) : roomsHTML(S, d, x);
    return `<div class="panel lng" id="lng-root"><h2> ${T("Company")}</h2>${off}${banner(d, x)}
      <div class="seg lng-seg">${tabs.map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-lng="tab" data-id="${k}">${l}</button>`).join("")}</div>${body}</div>`;
  }
  /* an invitation pops up once */
  function checkInvites(S) {
    for (const d of invitesFor(S)) { const k = `${d.id}|${d.invites[S.id].t}`; if (seenInv.has(k)) continue; seenInv.add(k); api?.toast?.(T("{who} invites you to the company {name} (Social → Company)", { who: d.invites[S.id].by, name: d.name })); }
  }
  async function onClick(ev) {
    const b = ev.target.closest?.("[data-lng]"); if (!b || b.disabled) return;
    const S = me(); if (!S) return;
    const a = b.dataset.lng, id = b.dataset.id;
    const amt = document.getElementById("lng-amt"); if (amt) draft.gold = amt.value;
    const nm = document.getElementById("lng-name"); if (nm) draft.name = nm.value;
    if (a === "tab") { tab = id; api.render(); return; }
    let err = null, ok = "";
    if (a === "found") { err = await found(S, draft.name); ok = T("Your longhouse is founded."); if (!err) draft.name = ""; }
    else if (a === "dep") { err = await deposit(S, draft.gold); ok = T("Gold put in."); if (!err) draft.gold = ""; }
    else if (a === "wd") { err = await withdraw(S, draft.gold); ok = T("Gold taken out."); if (!err) draft.gold = ""; }
    else if (a === "give") { err = await giveMat(S, id, +b.dataset.n); ok = T("Given to the stockpile."); }
    else if (a === "build") { err = await build(S, id); ok = T("Built!"); }
    else if (a === "plan") { err = await setPlan(S, id || null); ok = id ? T("Plan set.") : T("Plan cleared."); }
    else if (a === "invite") { err = await invite(S, id, b.dataset.name); ok = T("Invitation sent."); }
    else if (a === "join") { err = await join(S, id); ok = T("Welcome to the company!"); tab = "rooms"; }
    else if (a === "decline") { err = await decline(S, id); ok = ""; }
    else if (a === "leave") { err = await leave(S); ok = T("You left the company."); }
    else if (a === "role") { err = await setRole(S, id, b.dataset.r); ok = T("Done."); }
    else return;
    if (err) api.toast(err); else if (a === "found" && api.showMessage) { api.persist(true); api.showMessage(T("Company founded"), ok, false, true); }   // a prestige moment: the gold frame
    else { if (ok) api.toast(ok); api.persist(true); }
    api.render();
  }
  async function onChange(ev) {
    const el = ev.target.closest?.("[data-lngsel]"); if (!el) return;
    const S = me(); if (!S) return;
    const err = await setPerm(S, el.dataset.lngsel, el.dataset.lngsel === "cap" ? +el.value : el.value);
    if (err) api.toast(err); api.render();
  }
  function loop() { const S = me(); if (!S) return; try { hook(); pollTrophies(S); } catch (e) { console.warn("longhouse", e); } }
  /* ui.js calls this once the main screen is up */
  function mount(a) {
    api = a;
    if (typeof Store !== "undefined") Store.watch(COL, (list) => setDocs(list));
    if (!mount.bound && typeof document !== "undefined") { document.addEventListener("click", onClick); document.addEventListener("change", onChange); document.addEventListener("input", (ev) => { const id = ev.target?.id; if (id === "lng-amt") draft.gold = ev.target.value; else if (id === "lng-name") draft.name = ev.target.value; }); mount.bound = true; }
    clearInterval(loopT); loopT = setInterval(loop, 5000); loop();
  }
  if (typeof I18N !== "undefined" && I18N.add && typeof I18N_LONGHOUSE !== "undefined") I18N.add(I18N_LONGHOUSE.tpl, I18N_LONGHOUSE.words);

  return { COL, MAXM, FOUND, ROOMS, ROOM_IDS, PLANS, FAMS, LEG, SLOTS, MATS, sizeMult, costOf, foundCost, famOf, trophyInfo, trophyHits,
    setDocs, mine, derive, can, capOf, takenToday, fold, found, deposit, withdraw, giveMat, build, setPlan, invite, invitesFor, join, decline, leave,
    setRole, setPerm, rename, badge: (s) => (s ? invitesFor(s).length : 0), addTrophy, onFight, pollTrophies, pfx, xpMult, horseMult, horseCarry, onBook, runeOpen, hook, panel, mount,
    hallView, _api: (a) => { api = a; }, _tab: (t) => { tab = t; } };
})();
if (typeof module !== "undefined") module.exports = LONGHOUSE;
