/* Party traps [OURS]: in a party dungeon run, a trap is everyone's problem.
   - When the leader picks "dash through" or "look for the trigger", EVERY hero in the run plays that trap game at the same
     time on their own phone or PC: the same seed (same blades, same stones), sized to their own skills and perks.
   - Each hero who fails takes the hit themselves; whoever gets through is fine. What the hit is depends on the trap:
     darts poison you (stacks), blades, spikes and bear traps make you bleed (stacks), fire, steam and runes burn,
     an oil slick spills your purse, rockfalls and logs dent your armour. Two stacks on a bad miss, one on a near miss.
   - There's a time limit (the game's own, plus a few seconds of grace). Anyone who hasn't finished by then (lost the
     connection, put the phone away) counts as caught, and the run moves on.
   - Followers roll by their own stats: caught ones get knocked down and get back up (they never die).
   - A results card shows everyone who got through and who got hit with what.
   How it travels (Store collection "ptrap"): the leader writes the trap ("pt-<gid>"), every hero writes their own result
   ("pr-<gid>-<uid>"), the leader closes it (done + who passed), writes the outcome on the run record too
   (run.ptrap[step]), then makes the party's choice. Members replay the leader's choice in their own copy of the room
   (lootvote.js), and PTRAPS.mine swaps in their OWN result, so each one takes their own consequence.
   Chests stay the leader's: only the leader picks or smashes, the party watches live (dungeongames.js + livecursor.js),
   and the loot goes into the party pile for the end-of-dungeon vote.
   Perks: Trap Tinkerer (Lockpicking: easier trap games, a trap never costs you gold or dents your gear),
   Call Out the Danger (Sneak: get through cleanly and everyone else who's caught takes a quarter less, one stack less).
   Network sync: nothing about the outcome is rolled on one phone alone. The trap is built from the shared seed, the
   pass/fail is each hero's own posted result, the size of the hit is PTRAPS.roll(run|room|hero) (the same on any phone),
   follower rolls hash the trap id, and the lock result travels as "pick@1"/"pick@0". Reconnects: a phone that comes
   back mid-trap gets the same trap again unless its result is already in; a leader who comes back picks up closing
   it (once). (Small helpers here could move to netsync.js later; nothing else depends on them.)
   Pure logic up top (node-testable); PTRAPS.mount(ctx) wires the screens. */
const PTRAPS = (() => {
  const cfg = { grace: 8 };   // seconds on top of the game's own limit before the stragglers count as caught
  const KINDS = ["dash", "trigger"];
  const POISON = 6, BLEED_SP = 10, FX_SECONDS = 600, MAX_STACKS = 3;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DOM = typeof document !== "undefined";
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) || 0 : 0);
  const gnow = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  /* a shared roll in 0..1 (the same on every phone): how hard a trap hits you */
  const roll = (key) => hash(String(key));
  const limit = (kind) => (typeof DGAMES !== "undefined" ? DGAMES.LIMIT[kind] : { dash: 12, trigger: 9 }[kind] || 10);

  // ---- what a trap does to you
  const KIND = {
    poison: { label: "poisoned", icon: "\uE15B" },
    bleed: { label: "cut and bleeding", icon: "\uE11F" },
    burn: { label: "burned", icon: "\uE104" },
    gold: { label: "hurt, and their purse spilled", icon: "\uE111" },
    dent: { label: "hurt, and their armour dented", icon: "\uE102" },
  };
  function kindOf(trap) {
    const t = String(trap || "").toLowerCase();
    const k = /dart/.test(t) ? "poison" : /oil|brazier/.test(t) ? "gold" : /steam|spark|rune|fire/.test(t) ? "burn" : /blade|spike|bear trap/.test(t) ? "bleed" : /rock|ceiling|log|tripwire|cart/.test(t) ? "dent" : "bleed";
    return { k, ...KIND[k] };
  }
  /* how many stacks a miss is worth: a bad miss 2, a near miss or pushing through 1; a warning from a friend takes one off */
  const stacksFor = (q, flags = "") => Math.max(1, (q != null && q < 0.25 ? 2 : 1) - (String(flags).includes("w") ? 1 : 0));
  const hurtSome = (s, frac) => { const x = Math.max(1, Math.round(G.maxHealth(s) * frac)); const before = G.curHealth(s); G.setHealth(s, Math.max(1, before - x)); return Math.round(before - G.curHealth(s)); };   // never the blow that kills
  function addStacks(s, name, key, per, n, t) {
    s.fx = s.fx || [];
    const old = s.fx.find((f) => f.name === name && f.until > t);
    const stk = clamp((old?.stk || 0) + n, 1, MAX_STACKS);
    s.fx = s.fx.filter((f) => f !== old);
    s.fx.push({ key, mag: -per * stk, until: t + FX_SECONDS, name, stk });
    return stk;
  }
  /* the trap's own sting on top of the blow (dungeons.js calls this when a trap catches you). Returns text to add. */
  function sting(s, trap, q, flags = "", t = gnow()) {
    if (!s?.dungeon) return "";
    const { k } = kindOf(trap), n = stacksFor(q, flags), safe = pfx(s, "trapsting") > 0;
    if (k === "poison") { const stk = addStacks(s, "Trap poison", "max:health", POISON, n, t); return ` The darts were poisoned: ×${stk} (−${POISON * stk} max health for 10 minutes).`; }
    if (k === "bleed") { const x = hurtSome(s, 0.03 * n), stk = addStacks(s, "Bleeding", "max:stamina", BLEED_SP, n, t); return ` You're bleeding ×${stk} (−${x} health, −${BLEED_SP * stk} stamina for 10 minutes).`; }
    if (k === "burn") { const x = hurtSome(s, 0.05 * n); return ` The burns sting (−${x} more health).`; }
    if (k === "gold") {
      if (safe) return " You keep a hand on your purse (Trap Tinkerer).";
      const lose = Math.min(s.gold || 0, 300, Math.round(8 * (s.dungeon.tier || 1) * n + (s.gold || 0) * 0.03 * n));
      if (!lose) return "";
      s.gold -= lose; return ` Coins spill into the dark (−${lose} gold).`;
    }
    if (k === "dent") {
      if (safe) return " You roll with it and your gear comes through whole (Trap Tinkerer).";
      const eq = typeof G.equipment === "function" ? G.equipment(s) : {};
      const row = Object.entries(eq).filter(([sl, r]) => sl !== "weapon" && sl !== "offhand" && (r.temper || 0) > 0).map(([, r]) => r)[0];
      if (row) { row.temper = Math.max(0, (row.temper || 0) - n); return ` Your ${D.ITEMS[row.item]?.name || "armour"} takes a dent (−${n} improvement).`; }
      const x = hurtSome(s, 0.03 * n); return ` Your gear takes the blow (−${x} health).`;
    }
    return "";
  }

  // ---- followers roll by their own stats (the same roll on every phone)
  function folRoll(s, gid) {
    const id = s?.follower?.id, row = id && typeof TOWNS !== "undefined" ? TOWNS.FOLLOWERS[id] : null;
    if (!row) return null;
    const ch = clamp(0.5 + ((row[4] || 8) - 8) * 0.03 + Math.min(40, s.level || 1) * 0.006 + (row[6] === "dog" ? 0.1 : 0), 0.3, 0.9);
    return { name: row[0], pass: hash(`${gid}|${s.id}|fol`) < ch };
  }
  /* a caught follower gets knocked down: badly hurt, but back on their feet (never dies) */
  function folApply(s, fr, t = gnow()) {
    if (!fr || fr.pass || !s.follower || typeof TOWNS === "undefined") return "";
    const max = TOWNS.followerMax(s, s.follower.id), cur = TOWNS.followerHp ? TOWNS.followerHp(s, t) : s.follower.hp;
    s.follower.hp = Math.max(1, Math.round(Math.min(cur, max) - max * 0.35)); s.follower.ts = t;
    return `${fr.name} gets knocked down by the trap and climbs back up, hurt.`;
  }

  // ---- the shared records
  function newTrap(o) {
    const t = o.t ?? Date.now();
    return { type: "main", gid: o.gid, run: o.run, step: o.step, place: o.place || "", kind: o.kind, seed: o.seed >>> 0, trap: o.trap || "a trap",
      by: o.leader, byName: o.leaderName || "", members: (o.members || []).slice(0, 8).map((m) => ({ id: m.id, name: m.name })), start: t,
      deadline: t + Math.round((limit(o.kind) + cfg.grace) * 1000), done: false };
  }
  const parseQ = (choice) => { const m = /^([a-z]+)@(\d*\.?\d+)([a-z]*)$/.exec(String(choice)); return m ? { q: clamp(+m[2], 0, 1), fl: m[3] } : { q: 0, fl: "" }; };
  function resultDoc(main, s, choice, t = Date.now()) {
    const { q, fl } = parseQ(choice);
    return { type: "res", gid: main.gid, run: main.run, by: s.id, name: s.name, q, fl, warn: pfx(s, "ptwarn") > 0 ? 1 : 0, fol: folRoll(s, main.gid), at: t };
  }
  const resultsOf = (docs, gid) => (docs || []).filter((d) => d && d.type === "res" && d.gid === gid);
  const counts = (main, r) => !!r && main.members.some((m) => m.id === r.by);   // whatever is in when the leader closes it counts (phone clocks differ)
  /* may the leader close it? everyone in, or the time is up */
  function ready(main, results, t = Date.now()) {
    const ins = new Set(results.filter((r) => counts(main, r)).map((r) => r.by));
    return main.members.every((m) => ins.has(m.id)) || t >= main.deadline;
  }
  /* who passed, who's caught (no result in time = caught), who got a warning shouted to them */
  function resolve(main, results) {
    const out = {}, fol = {}, by = {};
    for (const r of results) if (counts(main, r)) by[r.by] = r;
    const warners = main.members.filter((m) => by[m.id] && by[m.id].warn && by[m.id].q >= 0.8).map((m) => m.id);
    for (const m of main.members) {
      const r = by[m.id], q = r ? clamp(+r.q || 0, 0, 1) : 0;
      const w = q < 0.5 && warners.some((id) => id !== m.id);
      out[m.id] = { q: Math.round(q * 1000) / 1000, ...(r ? {} : { late: 1 }), ...(w ? { w: 1 } : {}) };
      if (r?.fol) fol[m.id] = r.fol;
    }
    return { out, fol, warners };
  }
  const choiceFor = (kind, o) => `${kind}@${(o?.q ?? 0).toFixed(3)}${o?.w ? "w" : ""}`;
  /* a member replays the leader's trap choice: swap in their own result (or "caught" if they never played it) */
  function mine(s, run, c, docs = []) {
    const d = s?.dungeon;
    if (!d?.run || !/^(dash|trigger)(@|$)/.test(String(c)) || d.room?.type !== "trap") return c;
    const step = Math.max(0, (d.cstep || 1) - 1);
    const doc = (docs || []).filter((x) => x && x.type === "main" && x.done && x.run === d.run && x.step === step).sort((a, b) => b.start - a.start)[0];
    const e = doc ? { kind: doc.kind, out: doc.out, trap: doc.trap } : run?.ptrap?.[step];
    if (!e?.out) return c;
    if (e.trap) d.room.trap = e.trap;   // the same trap the results card named, so the sting matches
    return choiceFor(e.kind, e.out[s.id]);
  }

  // ====================================================================== screens
  let ctx = null, docs = [], wait = null, liveGid = null, tickT = null;
  const played = new Set(), shown = new Set(), closed = new Set();   // closed: traps this phone already closed (never twice)
  const S = () => ctx?.S?.();
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const runOf = (id) => (ctx?.runs?.() || []).find((r) => r.id === id) || null;
  const activeOf = (run) => (run?.members || []).filter((m) => !m.left);
  /* should this trap tap go to the whole party? (leader of a party run with 2+ heroes, shared world online) */
  function wants(s, c) {
    if (!ctx || !KINDS.includes(c) || !s?.dungeon?.run || s.dungeon.room?.type !== "trap") return false;
    if (typeof DGAMES === "undefined" || !DGAMES.handles(s, c) || !ctx.Store?.online) return false;
    const run = runOf(s.dungeon.run);
    return !!run && run.leader === s.id && activeOf(run).length >= 2;
  }
  /* the leader springs it: everyone plays */
  function start(s, c, act) {
    const run = runOf(s.dungeon.run), d = s.dungeon, step = Math.max(0, (d.cstep || 1) - 1);
    const gid = `${String(run.id).slice(-10)}-${step}-${Date.now().toString(36)}`;
    const main = newTrap({ gid, run: run.id, step, place: d.place, kind: c, seed: (Math.random() * 2147483647) | 0, trap: d.room.trap, leader: s.id, leaderName: s.name, members: activeOf(run) });
    wait = { gid, main, act, kind: c };
    ctx.Store.put("ptrap", "pt-" + gid, main);
    clearInterval(tickT); tickT = setInterval(tick, 500);
    onDocs(docs);
  }
  function playMine(main) {
    played.add(main.gid);
    if (typeof DGAMES === "undefined" || !DOM) return;
    liveGid = main.gid;
    DGAMES.play(S(), main.kind, (choice) => posted(main, choice), { seed: main.seed, party: { by: main.byName, n: main.members.length, trap: main.trap }, gid: main.gid });
  }
  function posted(main, choice) {
    liveGid = null;
    const s = S(), r = resultDoc(main, s, choice);
    ctx.Store.put("ptrap", `pr-${main.gid}-${s.id}`, r);
    if (!docs.some((x) => x.type === "main" && x.gid === main.gid && x.done)) showWait(main, r);
    clearInterval(tickT); tickT = setInterval(tick, 500);
  }
  function onDocs(list) {
    docs = (list || []).filter(Boolean);
    const s = S(); if (!s) return;
    const now = Date.now();
    for (const m of docs) {
      if (m.type !== "main" || !m.members?.some((x) => x.id === s.id)) continue;
      if (m.done) {
        if (!shown.has(m.gid) && !s.ptFol?.[m.gid] && now - (m.resAt || m.start) < 5 * 60e3) {   // (ptFol: already seen before a reload)
          if (liveGid === m.gid && typeof DGAMES !== "undefined") { DGAMES.close(); liveGid = null; }   // too late: the trap went off without you
          showResults(m);
        }
        continue;
      }
      // still open: play it (not by my clock: phones disagree; the leader closes it). After a reload, not twice.
      const mineIn = docs.some((r) => r.type === "res" && r.gid === m.gid && r.by === s.id);
      if (!played.has(m.gid) && !mineIn && s.dungeon?.run === m.run && now - m.start < 10 * 60e3) playMine(m);
      // the leader came back mid-trap (reload, lost connection): pick up closing it
      if (m.by === s.id && !wait && !closed.has(m.gid) && ctx.act && s.dungeon?.run === m.run) { wait = { gid: m.gid, main: m, act: ctx.act, kind: m.kind }; clearInterval(tickT); tickT = setInterval(tick, 500); }
    }
    if (wait) check();
    refreshWait();
    if (Math.random() < 0.05) for (const d of docs) if ((d.by === s.id) && now - (d.at || d.start || 0) > 3600e3) ctx.Store.remove("ptrap", d.type === "main" ? "pt-" + d.gid : `pr-${d.gid}-${d.by}`);
  }
  let closing = false;
  async function check() {
    if (!wait || closing) return;
    const main = wait.main, res = resultsOf(docs, main.gid), t = Date.now();
    const mineIn = res.some((r) => r.by === S().id);
    if (!ready(main, res, t) || (!mineIn && t < main.deadline)) return;
    closing = true;
    try {
      if (liveGid === main.gid && typeof DGAMES !== "undefined") { DGAMES.close(); liveGid = null; }
      const { out, fol, warners } = resolve(main, res);
      const doneDoc = { ...main, done: true, out, fol, warners, resAt: t };
      const w = wait; wait = null; closed.add(main.gid); clearInterval(tickT);
      await ctx.Store.put("ptrap", "pt-" + main.gid, doneDoc);
      if (!docs.some((x) => x.type === "main" && x.gid === main.gid && x.done)) docs = [...docs.filter((x) => !(x.type === "main" && x.gid === main.gid)), doneDoc];
      await ctx.Store.change("runs", main.run, (x) => ({ ...x, ptrap: { ...(x.ptrap || {}), [main.step]: { gid: main.gid, kind: main.kind, trap: main.trap, out } } }));
      closeWait();
      if (S().dungeon?.room?.type === "trap") w.act(choiceFor(main.kind, out[S().id]));
      if (!shown.has(main.gid)) showResults(doneDoc);
    } finally { closing = false; }
  }
  function tick() { if (wait) check(); refreshWait(); if (!wait && !(DOM && document.querySelector("#ptwait"))) clearInterval(tickT); }

  // -- waiting for the others
  let waitFor = null;
  function showWait(main, r) {
    if (!DOM) return;
    closeWait();
    waitFor = main;
    const el = document.createElement("div");
    el.id = "ptwait"; el.className = "lockpick dgame ptwait";
    el.innerHTML = `<div class="lpcard" role="dialog" aria-label="Waiting for the party"><h3>\uE123 ${esc(r.q >= 0.5 ? "You got through" : "It caught you")}</h3>
      <p class="lpsub">Waiting for the rest of the party…</p><div class="ptlist" id="ptwl"></div><p class="lphint" id="ptwt"></p></div>`;
    document.body.appendChild(el);
    refreshWait();
  }
  function refreshWait() {
    const el = DOM && document.querySelector("#ptwait"); if (!el || !waitFor) return;
    const main = docs.find((x) => x.type === "main" && x.gid === waitFor.gid) || waitFor;
    if (main.done) return closeWait();
    const res = resultsOf(docs, main.gid), me = S()?.id;
    const html = main.members.map((m) => { const r = res.find((x) => x.by === m.id); return `<div class="ptrow ${r ? "in" : ""}"><b>${esc(m.name)}${m.id === me ? " (you)" : ""}${m.id === main.by ? " ⚑" : ""}</b><span>${r ? "\uE120 done" : "… still playing"}</span></div>`; }).join("");
    const l = el.querySelector("#ptwl"); if (l.innerHTML !== html) l.innerHTML = html;
    const left = Math.max(0, Math.ceil((main.deadline - Date.now()) / 1000));
    el.querySelector("#ptwt").textContent = left ? `Anyone not done in ${left}s counts as caught.` : `Time's up. ${main.byName || "The leader"} moves the party on…`;
  }
  function closeWait() { if (DOM) document.querySelector("#ptwait")?.remove(); waitFor = null; }

  // -- who got through, who got hit
  function resultsHTML(doc, me) {
    const k = kindOf(doc.trap), warnBy = (doc.warners || []).map((id) => doc.members.find((m) => m.id === id)?.name).filter(Boolean);
    const rows = doc.members.map((m) => {
      const o = doc.out?.[m.id] || { q: 0, late: 1 }, pass = o.q >= 0.5, f = doc.fol?.[m.id];
      return `<div class="ptrow ${pass ? "ok" : "bad"}${m.id === me ? " me" : ""}"><b>${esc(m.name)}${m.id === me ? " (you)" : ""}</b><span>${pass ? "\uE120 Got through" : `${k.icon} Caught: ${esc(k.label)}`}${o.late ? " · ran out of time" : ""}${o.w ? " · warned, softer" : ""}</span></div>`
        + (f ? `<div class="ptrow fol ${f.pass ? "ok" : "bad"}"><b>${esc(f.name)}</b><span>${f.pass ? "\uE120 Got through" : "Knocked down, gets back up"}</span></div>` : "");
    }).join("");
    const o = doc.out?.[me];
    const line = !o ? "" : o.q >= 0.5 ? "You're through untouched." : `It caught you: ${k.label.replace("their", "your")}. You take the hit yourself.`;
    return `<div class="lpcard ptcard" role="dialog" aria-label="Trap results"><h3>\uE123 Trap results</h3>
      <p class="lpsub">${esc(doc.trap[0]?.toUpperCase() + doc.trap.slice(1))} · ${esc(typeof DGAMES !== "undefined" ? DGAMES.INFO[doc.kind]?.title || "" : "")}</p>
      <div class="ptlist">${rows}</div>
      ${warnBy.length ? `<p class="lpsub ptwarned">\uE156 ${esc(warnBy.join(", "))} called out the danger: the others' hits were softer.</p>` : ""}
      <p class="lphint" id="ptline">${esc(line)}</p><div class="lprow"><button class="btn pri" id="ptok">Continue</button></div></div>`;
  }
  function showResults(doc) {
    shown.add(doc.gid);
    closeWait();
    const s = S(), me = s?.id;
    // your follower's roll (the same one everyone else saw), applied once
    if (s && doc.members.some((m) => m.id === me)) {
      s.ptFol = s.ptFol || {};
      if (!s.ptFol[doc.gid]) { s.ptFol[doc.gid] = 1; const msg = folApply(s, folRoll(s, doc.gid)); if (msg && ctx.toast) setTimeout(() => ctx.toast(msg), 1500); ctx.persist?.(true); }
      const ks = Object.keys(s.ptFol); if (ks.length > 20) ks.slice(0, ks.length - 20).forEach((k) => delete s.ptFol[k]);
    }
    if (!DOM) return;
    document.querySelector("#ptres")?.remove();
    const el = document.createElement("div");
    el.id = "ptres"; el.className = "lockpick dgame ptres";
    el.innerHTML = resultsHTML(doc, me);
    document.body.appendChild(el);
    const close = () => el.remove();
    el.querySelector("#ptok").onclick = close;
    setTimeout(close, 20000);
  }

  /* ctx: { S(), runs(), Store, toast, persist, act(choice) } (act: the room action, so a leader who reloads mid-trap can still close it) */
  function mount(c) { ctx = c; if (c?.Store?.watch) c.Store.watch("ptrap", onDocs); }

  return { cfg, KINDS, roll, KIND, kindOf, stacksFor, sting, folRoll, folApply, newTrap, resultDoc, resultsOf, ready, resolve, choiceFor, mine, parseQ, resultsHTML,
    wants, start, mount, onDocs, get docs() { return docs; }, get waiting() { return wait; }, get played() { return [...played]; } };
})();
if (typeof module !== "undefined") module.exports = PTRAPS;
