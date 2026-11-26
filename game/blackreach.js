/* [Skyrim] Blackreach: the great Dwemer cavern under Alftand and Raldbthar, after the lexicon line (dwemer.js) opens the lift.
   Its own little map: eight spots joined by paths across a glowing cavern. Walk from spot to spot; a hostile spot you haven't
   cleared lately starts a fight when you step in. Spots stay clear for the same 6 real hours as a dungeon refill.
   - Great Lift (Alftand) and Raldbthar Lift: the way in and out; a safe place to catch your breath.
   - Glowing Fields: pick glowing mushrooms and crimson nirnroot once a day (sometimes a chaurus objects).
   - Falmer Warren, Silent City guardians, the Debate Hall: fights, with Falmer and Dwarven loot.
   - Silent City vault: a valve puzzle (dwemer.js) once every 3 days, for Dwemer metal and Dwarven gear.
   - Tower of Mzark: read the lexicon in the lens light (the quest's flag dwMzark) - and if you know FUS, shout at the great orb
     hanging from the roof... something old answers from below. [Skyrim] Vulthuryol; here a once-only fight.
   - The Great Dynamo: the Centurion master, the line's big boss (flag dwCenturion), and its dynamo core.
   Dying in Blackreach sends you to the temple as anywhere else; next time you start again at a lift.
   Party: only the leader picks the route and starts fights; members follow (the leader's spot rides on the party card). */
const BLACKREACH = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const E = DWEMER.E, REFILL = 3 * 2 * 3600, DAY = 2 * 3600, VAULT = 3 * DAY;   // seconds of game clock (1 in-game day = 2 real hours)
  const NODES = {
    lift: { name: "The Great Lift", x: 0.13, y: 0.22, kind: "lift", exit: "Alftand", links: ["fields", "warren"],
      text: "A brass lift as big as a house, groaning on its chains up to Alftand. The air down here is warm and smells of moss." },
    warren: { name: "Falmer Warren", x: 0.37, y: 0.13, kind: "fight", rec: 20, links: ["lift", "fields", "city"],
      foe: E("Falmer warband", 400, 36, ["humanoid", "falmer", "elite"]), gold: [60, 140], loot: [["dwemer_scrap", 0.7], ["dwarven_dagger", 0.15], ["ing_chaurus_eggs", 0.4]],
      text: "Hide tents and chitin spikes. The Falmer hear you long before they see you." },
    fields: { name: "Glowing Fields", x: 0.31, y: 0.5, kind: "gather", rec: 19, links: ["lift", "warren", "hall", "raldlift"],
      ambush: E("Chaurus reaper", 520, 48, ["beast", "insect"]),
      text: "Giant mushrooms glow blue and green over a field of crimson flowers. Something clicks in the dark between them." },
    city: { name: "The Silent City", x: 0.59, y: 0.28, kind: "fight", rec: 21, vault: true, links: ["warren", "mzark", "hall"],
      foe: E("Silent City guardians", 410, 35, ["construct", "elite"]), gold: [80, 180], loot: [["dwemer_gear", 0.7], ["dwemer_strut", 0.3], ["dwarven_mace", 0.15]],
      text: "Bronze towers, empty streets. The guardians still walk their rounds after four thousand years." },
    mzark: { name: "Tower of Mzark", x: 0.83, y: 0.15, kind: "tower", links: ["city", "dynamo"],
      text: "A lens of gold and glass the size of a barn, aimed at a great glowing orb that hangs from the cavern roof." },
    hall: { name: "The Debate Hall", x: 0.56, y: 0.67, kind: "fight", rec: 22, links: ["fields", "city", "dynamo", "raldlift"],
      foe: E("Debate Hall sentries", 560, 44, ["construct", "elite"]), gold: [90, 200], loot: [["dwemer_gear", 0.6], ["dwemer_strut", 0.4], ["dwarven_shield", 0.12]],
      text: "Stone benches in a ring around a brass speaker's post. Ballistae crouch along the walls." },
    dynamo: { name: "The Great Dynamo", x: 0.85, y: 0.7, kind: "boss", rec: 24, needs: "dwMzark", links: ["hall", "mzark"],
      foe: E("Centurion master", 820, 38, ["construct", "elite", "big"], { boss: true, text: "Twice the size of any centurion you've seen. Steam pours from every joint." }), gold: [300, 500],
      loot: [["dwemer_dynamo", 1], ["dwemer_strut", 1], ["dwemer_gear", 1], ["dwarven_warhammer", 0.3]],
      text: "The heart of Blackreach: a dynamo the size of a temple, still turning. Something huge stands guard." },
    raldlift: { name: "Raldbthar Lift", x: 0.16, y: 0.85, kind: "lift", exit: "Raldbthar", links: ["fields", "hall"],
      text: "A smaller lift, rattling up to Raldbthar." },
  };
  const DRAGON = E("Vulthuryol", 1300, 58, ["big", "dragon", "elite"], { boss: true, text: "Black scales, fire in the throat. It has slept under the world since before men came to Skyrim." });
  const DRAGON_REC = 28, ORDER = Object.keys(NODES);
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const role = (s) => (typeof PARTYPLAY !== "undefined" ? PARTYPLAY.role(s) : "solo");
  const R = (s) => (s.reach = s.reach || { at: null, cleared: {} });
  const open = (s) => DWEMER.reachOpen(s);
  const here = (s) => R(s).at;
  const entryAt = (place) => ORDER.find((k) => NODES[k].exit === place) || null;
  const isClear = (s, k, t = G.now()) => !["fight", "boss"].includes(NODES[k].kind) || (R(s).cleared[k] || -1e12) > t - REFILL;
  const linked = (s, a, b) => !!NODES[a]?.links.includes(b) && (!NODES[b].needs || !!s[NODES[b].needs]);
  /* why you can't go down (null when you can) */
  function canEnter(s, place = s.location) {
    if (!entryAt(place)) return "There's no way down from here.";
    if (!open(s)) return "The great lift is jammed. Calcelmo's quest line (Markarth) opens Blackreach.";
    if (s.trip) return "Finish your journey first.";
    if (s.dungeon) return "Finish the ruin first.";
    if (role(s) === "member") return "In a party your leader takes the lift. Follow once they're down.";
    return null;
  }
  function enter(s, place = s.location) {
    const why = canEnter(s, place); if (why) return why;
    R(s).at = entryAt(place);
    return `You ride the lift down into Blackreach. ${NODES[R(s).at].text}`;
  }
  /* leave by a lift: you come up in that ruin's place */
  function leave(s) {
    const k = here(s); if (!k) return "You aren't in Blackreach.";
    if (NODES[k].kind !== "lift") return "Get back to a lift first.";
    s.location = NODES[k].exit; R(s).at = null;
    return `The lift carries you up into ${NODES[k].exit}.`;
  }
  /* one fight against a Blackreach foe; returns a quest-style result { text, fight, skills, gold, loot, died } */
  function fight(s, def, rec, t, allies = []) {
    const e = G.scaleQuestFoe({ ...def }, G.fightLevel ? G.fightLevel(s) : s.level, rec);
    const f = new G.Fight(s, e, null, t);
    for (const [name, dmg] of allies) f.allies.push({ name, dmg });
    f.run({ t }); const skills = f.apply(t);
    if (!f.won) { const d = G.die(s, e.name, t, true); return { text: `${e.name} was too much for you. You're still where you were: try again when you're ready.`, fight: f, skills: d.rolledBack ? [] : skills, died: d.msg }; }   // no penalty (defeat.js)
    return { text: `${e.name} falls.`, fight: f, skills, won: true };
  }
  function spoils(s, n, res) {
    const g = n.gold ? rint(...n.gold) : 0; if (g) { s.gold += g; res.gold = g; }
    res.loot = [];
    for (const [id, ch] of n.loot || []) if (Math.random() < ch && D.ITEMS[id]) { G.give(s, id); res.loot.push(D.ITEMS[id].name); }
    return res;
  }
  /* walk to a linked spot; a hostile spot you haven't cleared starts a fight */
  function move(s, to, t = G.now()) {
    const at = here(s), n = NODES[to];
    if (!at) return { text: "You aren't in Blackreach." };
    if (role(s) === "member") return { text: "In a party only your leader picks the way. Follow them." };
    if (!n) return { text: "There's nothing there." };
    if (!linked(s, at, to)) return { text: n.needs && !s[n.needs] ? "A sealed brass door. The lexicon's light at the Tower of Mzark would show you how to open it." : "No path leads there from here." };
    if (!isClear(s, to, t)) {
      const res = fight(s, n.foe, n.rec, t);
      if (res.died) return res;
      R(s).at = to; R(s).cleared[to] = t;
      spoils(s, n, res);
      if (n.kind === "boss") {
        const first = !s.dwCenturion; s.dwCenturion = true;
        res.text = `The Centurion master crashes down and the dynamo slows for the first time in four thousand years.${first ? " Calcelmo will want to hear about this." : ""}`;
        if (first) { G.give(s, "tonal_warhammer"); res.loot.push(D.ITEMS.tonal_warhammer.name); }
      }
      res.msgs = QUESTS.check(s);
      return res;
    }
    R(s).at = to;
    const msgs = [];
    if (n.kind === "tower" && !s.dwMzark) { s.dwMzark = true; msgs.push(...QUESTS.check(s)); return { text: "You set the lexicon in the lens frame. Light pours through the brass cube and writes a map across the floor: the way to the Great Dynamo.", msgs }; }
    return { text: n.text, msgs };
  }
  /* party members: step down to wherever your leader is */
  function follow(s, node) {
    if (!NODES[node]) return "Your leader isn't in Blackreach.";
    if (!open(s)) return "The great lift is jammed for you: Calcelmo's quest line (Markarth) opens Blackreach.";
    if (s.trip || s.dungeon) return "Finish what you're doing first.";
    R(s).at = node; return `You catch up with your leader at ${NODES[node].name}.`;
  }
  /* the Glowing Fields: once a day */
  function gather(s, t = G.now()) {
    const r = R(s);
    if (here(s) !== "fields") return { text: "Nothing to pick here." };
    if ((r.gather || -1e12) > t - DAY) return { text: "You've picked the fields clean for today." };
    let res = { text: "" };
    if (Math.random() < 0.25) {
      res = fight(s, NODES.fields.ambush, NODES.fields.rec, t);
      if (res.died) return res;
      res.text = "A chaurus reaper bursts out of the flowers. It won't bother anyone again.";
    }
    r.gather = t;
    const mush = rint(2, 4), root = Math.random() < 0.6 ? rint(1, 2) : 0;
    G.give(s, "ing_glowing_mushroom", mush); if (root) G.give(s, "ing_crimson_nirnroot", root);
    const sk = G.useSkill ? G.useSkill(s, "Alchemy", 4) : [];
    res.skills = [...(res.skills || []), ...sk];
    res.text = `${res.text ? res.text + " " : ""}You pick ${mush} Glowing Mushroom${root ? ` and ${root} Crimson Nirnroot` : ""}.`;
    return res;
  }
  /* the Silent City vault: a valve puzzle every 3 days */
  const vaultLeft = (s, t = G.now()) => Math.max(0, (R(s).vault || -1e12) + VAULT - t);
  function vaultPuzzle(s) { return DWEMER.valves(`vault|${s.id || s.name}|${Math.floor((R(s).vaultN || 0))}`, 3, typeof PFX !== "undefined" ? PFX.num(s, "dwlore") : 0); }
  function vault(s, pz, t = G.now()) {
    if (here(s) !== "city") return "The vault is in the Silent City.";
    if (role(s) === "member") return "In a party only your leader works the vault.";
    if (vaultLeft(s, t)) return "The vault's pipes are still cooling.";
    const r = R(s); r.vault = t; r.vaultN = (r.vaultN || 0) + 1;
    if (!pz || pz.done !== "solved") { const hurt = Math.round(G.maxHealth(s) * 0.15); G.setHealth(s, Math.max(1, G.curHealth(s, t) - hurt), t); return `Steam blasts out of the vault's pipes (−${hurt} health). It seals itself for a few days.`; }
    const q = DWEMER.quality(pz), got = [];
    const g = Math.round(rint(150, 300) * q); s.gold += g;
    const pick = (ids) => ids[Math.floor(Math.random() * ids.length)];
    for (const id of ["dwemer_gear", "dwemer_strut", pick(["dwemer_scrap", "dwemer_gear"]), ...(Math.random() < 0.35 + 0.4 * q ? [pick(DWEMER.NEW_GEAR)] : [])]) { G.give(s, id); got.push(D.ITEMS[id].name); }
    return `The vault door swings open: ${g} gold, ${got.join(", ")}.`;
  }
  /* the secret: shout FUS at the great orb, once */
  const canCall = (s) => here(s) === "mzark" && !R(s).dragon && typeof POWERS !== "undefined" && POWERS.known(s, "FUS");
  function callDragon(s, t = G.now()) {
    if (!canCall(s)) return { text: "Nothing answers." };
    if (role(s) === "member") return { text: "In a party only your leader can do that." };
    const res = fight(s, DRAGON, DRAGON_REC, t, [["Dwarven sphere you woke", 6]]);
    if (res.died) return res;
    R(s).dragon = true; s.dwDragon = true;
    res.loot = [];
    for (const [id, n] of [["dragon_bone", 2], ["dragon_scales", 2]]) if (D.ITEMS[id]) { G.give(s, id, n); res.loot.push(`${D.ITEMS[id].name} ×${n}`); }
    res.gold = 400; s.gold += 400;
    res.text = `You shout at the orb. It shatters, and out of the deep dark Vulthuryol answers. Now it lies still among the mushrooms. ${POWERS.absorb(s)}`;
    return res;
  }
  /* what you can do where you stand (for the screen and tests): [[act, label, extra]] */
  function actions(s, t = G.now()) {
    const k = here(s); if (!k) return [];
    const n = NODES[k], out = [], member = role(s) === "member";
    if (n.kind === "lift") out.push(["up", `\uE137 Ride up to ${n.exit}`]);
    if (n.kind === "gather") out.push(["gather", "\uE12B Pick mushrooms and nirnroot", (R(s).gather || -1e12) > t - DAY ? "picked today" : ""]);
    if (n.vault && isClear(s, k, t) && !member) out.push(["vault", "\uE11E Work the vault's valves", vaultLeft(s, t) ? "cooling" : ""]);
    if (canCall(s) && !member) out.push(["dragon", "\uE156 Shout at the great orb"]);
    return out;
  }

  // ---- party: the leader's spot rides on the party card
  let leaderCard = () => null;
  const leaderAt = () => { try { return leaderCard()?.br ?? null; } catch { return null; } };
  if (typeof PARTY !== "undefined") { const cb0 = PARTY.cardBits; PARTY.cardBits = (s, party) => ({ ...cb0(s, party), br: s.reach?.at || null }); }
  if (typeof PARTYPLAY !== "undefined") {
    const ui0 = PARTYPLAY.ui;
    PARTYPLAY.ui = (c) => { leaderCard = () => { const p = c.party(); return p && p.leader !== c.S().id ? c.cardOf(p.leader) : null; }; return ui0(c); };
  }
  const setLeaderCard = (fn) => { leaderCard = fn; };   // tests

  // ---- the screen
  let ctx = null;
  function mount(c) { ctx = c; }
  const isOpen = () => DOM && !!document.getElementById("breach");
  function close() { if (!DOM) return false; const el = document.getElementById("breach"); if (el) { el.remove(); return true; } return false; }
  /* the card on Alftand's / Raldbthar's place panel */
  function placeCard(s, place) {
    if (!entryAt(place) || !open(s)) return "";
    const member = role(s) === "member", la = member ? leaderAt() : null;
    return `<div class="card br-card"><h3>\uE11E Blackreach</h3><p class="sub" style="margin-top:0">${esc(entryAt(place) === "lift" ? "The great lift hums, ready to take you down to the glowing city below." : "A rattling lift leads down to Blackreach.")}</p>
      ${member ? (la ? `<button class="btn pri" data-act="breach" data-k="follow" style="width:100%">Join your leader (${esc(NODES[la]?.name || "")})</button>` : `<p class="sub">Your leader takes the lift; you follow.</p>`)
        : `<button class="btn pri" data-act="breach" data-k="enter" style="width:100%">${here(s) ? "Back to Blackreach" : "\uE138 Ride down to Blackreach"}</button>`}</div>`;
  }
  function render() {
    const el = DOM && document.getElementById("breach"); if (!el || !ctx) return;
    const s = ctx.S(), k = here(s); if (!k) { close(); return; }
    const t = G.now(), n = NODES[k], member = role(s) === "member";
    const map = typeof DWART !== "undefined" ? DWART.reachMap(s) : "";
    const pins = ORDER.map((id) => { const m = NODES[id], can = !member && linked(s, k, id), cls = [id === k ? "here" : "", can ? "go" : "", isClear(s, id, t) ? "" : "foe", m.needs && !s[m.needs] ? "sealed" : ""].join(" ");
      return `<button class="br-pin ${cls}" style="left:${m.x * 100}%;top:${m.y * 100}%" data-act="breach" data-k="go" data-id="${id}" ${can ? "" : "disabled"} aria-label="${esc(m.name)}"><i></i><span>${esc(m.name)}</span></button>`; }).join("");
    const acts = actions(s, t).map(([a, label, note]) => `<button class="btn ${note ? "" : "pri"}" data-act="breach" data-k="${a}" ${note ? "disabled" : ""}>${esc(label)}${note ? ` (${esc(note)})` : ""}</button>`).join("");
    const la = member ? leaderAt() : null;
    el.innerHTML = `<div class="in"><div class="hd"><h2>\uE11E Blackreach</h2><button class="btn sm" data-act="breach" data-k="close">Close</button></div>
      <div class="br-map">${map}${pins}</div>
      <div class="card"><h3>${esc(n.name)}</h3><p class="sub" style="margin-top:0">${esc(n.text)}</p>
      ${member ? `<p class="sub">In a party your leader picks the way.${la && la !== k ? ` They're at ${esc(NODES[la].name)}.` : ""}</p>${la && la !== k ? `<button class="btn pri" data-act="breach" data-k="follow">Join your leader</button>` : ""}` : `<p class="sub">Tap a glowing spot on the map to walk there. Red spots hold foes.</p>`}
      <div class="br-acts">${acts}</div></div></div>`;
  }
  function show() {
    if (!DOM || !ctx) return;
    let el = document.getElementById("breach");
    if (!el) { el = document.createElement("div"); el.id = "breach"; el.className = "dun breach"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Blackreach"); document.body.appendChild(el); el.addEventListener("click", (e) => { const b = e.target.closest("[data-act=breach]"); if (b) { e.stopPropagation(); onClick(b); } }); }
    render();
  }
  const after = (r) => { ctx.persist(true); render(); ctx.renderPanel?.(true); ctx.showFightResult(r); };
  const withFight = (fn) => { if (ctx.tb) ctx.tb(fn, (r) => after(r)); else after(fn()); };
  function onClick(b) {
    if (!ctx) return;
    const S = ctx.S(), k = b.dataset.k;
    if (k === "close") return void close();
    if (k === "enter") { const m = here(S) ? null : enter(S); if (m && !here(S)) return ctx.toast(m); ctx.persist(true); show(); if (m) ctx.toast(m); return; }
    if (k === "follow") { const m = follow(S, leaderAt()); ctx.persist(true); ctx.toast(m); if (here(S)) show(); return; }
    if (k === "up") { const m = leave(S); close(); ctx.persist(true); ctx.renderPanel?.(true); ctx.toast(m); return; }
    if (k === "go") {
      const id = b.dataset.id;
      if (!isClear(S, id)) return withFight(() => move(S, id));
      const r = move(S, id); ctx.persist(true); render();
      if (r.msgs?.length) ctx.showMessage("Blackreach", [r.text, ...r.msgs].join(" ")); else if (r.text && NODES[id]?.kind === "tower") ctx.showMessage("Blackreach", r.text);
      return;
    }
    if (k === "gather") return withFight(() => gather(S));
    if (k === "dragon") return withFight(() => callDragon(S));
    if (k === "vault") {
      const pz = vaultPuzzle(S);
      DWEMER.openValves(pz, { title: "The vault's valves", clue: "Five valves hold the vault shut. Each one turns its neighbours too. Get every needle to the top before the pressure blows." },
        (p) => { const m = vault(ctx.S(), p); ctx.persist(true); render(); ctx.toast(m); });
    }
  }
  return { NODES, ORDER, DRAGON, DRAGON_REC, REFILL, DAY, VAULT, R, open, here, entryAt, isClear, linked, canEnter, enter, leave, move, follow, gather,
    vaultLeft, vaultPuzzle, vault, canCall, callDragon, actions, fight, setLeaderCard, leaderAt, mount, placeCard, show, render, close, isOpen, onClick };
})();
