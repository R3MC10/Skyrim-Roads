/* Guild work: repeatable jobs for the Thieves Guild (Delvin and Vex in the Ragged Flagon) and contracts for the
   Dark Brotherhood (Nazir at the Sanctuary), guild ranks with small perks, Shadowmere, and the Brotherhood's
   other way in: sleeping at an inn after a murder. Story stages live in quests.js. [Skyrim] names and ranks,
   [OURS] numbers. Progress is per player (s.guild). */
const GUILDS = (() => {
  const CITIES = ["Whiterun", "Solitude", "Windhelm", "Markarth", "Riften"];
  const HOLD_OF = { Whiterun: "Whiterun", Solitude: "Haafingar", Windhelm: "Eastmarch", Markarth: "The Reach", Riften: "The Rift" };
  const COOLDOWN = 180;   // real seconds between jobs (about half an in-game day)
  const g = (s) => (s.guild = s.guild || { thieves: { jobs: 0, job: null, next: 0 }, brotherhood: { jobs: 0, job: null, next: 0 } });
  const qv = (s, id) => (s.quests || {})[id];
  const stage = (s, id) => { const v = qv(s, id); return !v ? -1 : v.done ? 99 : v.stage; };

  // ---- ranks
  const RANKS = {
    thieves: [["Member", 0], ["Bandit", 3], ["Thief", 8], ["Captain", 15], ["Guild Master", null]],
    brotherhood: [["Initiate", 0], ["Slayer", 3], ["Assassin", 7], ["Silencer", 12], ["Listener", null]],
  };
  function rank(s, id) {
    if (stage(s, id) < (id === "thieves" ? 3 : 2)) return null;
    if (qv(s, id)?.done && (id !== "thieves" || qv(s, id).v2)) return { i: 4, name: RANKS[id][4][0] };
    const n = g(s)[id].jobs; let i = 0;
    for (let k = 0; k < 4; k++) if (n >= RANKS[id][k][1]) i = k;
    if (id === "thieves" && stage(s, id) >= 8) i = Math.max(i, 3);   // [Skyrim] Trinity Restored makes you a Nightingale
    return { i, name: RANKS[id][i][0], next: i < 3 ? RANKS[id][i + 1] : null };
  }
  /* the fence pays more for stolen goods as you rise in the Thieves Guild: +5% per rank */
  const fenceMult = (s, row) => (row?.stolen ? 1 + 0.05 * ((rank(s, "thieves")?.i ?? -1) + 1) : 1);

  // ---- jobs
  const TJOBS = [
    ["heist", "Heist", (town) => `Steal a valuable from a well-guarded house in ${town}.`, "Lockpicking", 25],
    ["fishing", "Fishing", (town) => `Lift a ring from a rich merchant's pocket in ${town}.`, "Pickpocket", 25],
    ["shill", "Shill", (town) => `Plant a forged ledger in a shop in ${town}.`, "Pickpocket", 20],
    ["sweep", "Sweep", (town) => `Clear out the valuables from three homes in ${town}.`, "Sneak", 30],
  ];
  const TARGETS = ["a smuggler who sold out his crew", "a cruel bandit chief hiding in the city", "a corrupt tax collector", "a slaver posing as a merchant", "a traitor to the Jarl", "a debt-collecting thug", "a poacher who burned a farm", "a skooma dealer's boss"];
  const canTake = (s, id) => id === "thieves" ? stage(s, "thieves") >= 3 : stage(s, "brotherhood") >= 2;
  const takeAt = (id) => id === "thieves" ? ["Riften"] : ["Falkreath", "Dark Brotherhood Sanctuary", "Dawnstar", "Dawnstar Sanctuary"];
  function offer(s, id, t = G.now()) {
    const st = g(s)[id];
    if (!canTake(s, id)) return { err: id === "thieves" ? "Prove yourself to Brynjolf first (Journal)." : "The Family doesn't know you yet." };
    if (st.job) return { err: "Finish the job you have first." };
    if (st.next > t) return { err: `Nothing yet. Come back in about ${Math.ceil((st.next - t) / 60)} min.` };
    if (!takeAt(id).includes(s.location)) return { err: id === "thieves" ? "Delvin and Vex hand out work in the Ragged Flagon, in Riften." : "Nazir hands out contracts at the Sanctuary (Falkreath or Dawnstar)." };
    const town = CITIES.filter((c) => c !== s.location)[Math.floor(Math.random() * 4)], lvl = s.level || 1, r = rank(s, id)?.i || 0;
    if (id === "thieves") {
      const [kind, label, txt, skill, base] = TJOBS[Math.floor(Math.random() * TJOBS.length)];
      st.job = { kind, label, town, text: txt(town), skill, need: base + Math.min(40, lvl * 1.2), pay: Math.round((150 + lvl * 12) * (1 + 0.1 * r)), t };
    } else {
      const who = TARGETS[Math.floor(Math.random() * TARGETS.length)];
      st.job = { kind: "contract", label: "Contract", town, text: `Deal with ${who} in ${town}. A quiet job pays a bonus.`, skill: "Sneak", need: 30 + Math.min(40, lvl * 1.2), pay: Math.round((250 + lvl * 15) * (1 + 0.1 * r)), who, t };
    }
    return { job: st.job, text: `${st.job.label}: ${st.job.text}` };
  }
  const chance = (s, j) => Math.max(0.15, Math.min(0.95, 0.5 + (G.skill(s, j.skill) - j.need) / 60));
  /* do the job you hold, in its town. Returns {text, fight?, died?, bag?, msgs} */
  function work(s, id, t = G.now()) {
    const st = g(s)[id], j = st.job;
    if (!j) return { text: "You have no job." };
    if (s.location !== j.town) return { text: `The job is in ${j.town}.` };
    const msgs = [], before = rank(s, id)?.i ?? -1, ok = Math.random() < chance(s, j);
    const finish = (pay, extra) => {
      s.gold += pay; st.jobs++; st.job = null; st.next = t + COOLDOWN;
      G.useSkill(s, j.skill, 25);
      const r = rank(s, id); if (r && r.i > before) msgs.push(`${id === "thieves" ? "" : ""} You're now ${/^[AEIOU]/.test(r.name) ? "an" : "a"} ${r.name} of the ${id === "thieves" ? "Thieves Guild" : "Dark Brotherhood"}.`);
      G.note(s, `${id === "thieves" ? " Guild job" : " Contract"} done in ${j.town}: +${pay} gold.`);
      return extra;
    };
    if (id === "thieves") {
      if (ok) {
        const loot = Math.random() < 0.5 ? ["gem_garnet", "gem_amethyst", "gem_ruby", "silver_ring", "gold_ring"].filter((i) => D.ITEMS[i])[Math.floor(Math.random() * 3)] : null;
        if (loot) { const rid = G.give(s, loot); const row = G.invRow(s, rid); if (row) row.stolen = true; }
        return { text: finish(j.pay, `Clean work. Delvin's cut is taken; you keep ${j.pay} gold${loot ? ` and a stolen ${D.ITEMS[loot].name}` : ""}.`), msgs };
      }
      st.job = null; st.next = t + COOLDOWN;
      if (typeof TOWNS !== "undefined") TOWNS.addBounty(s, HOLD_OF[j.town] || G.holdAt(WORLD.places[j.town]), "theft", 150);
      return { text: `A guard spots you and you have to run. The job's off, and there's a bounty of +150 gold in ${HOLD_OF[j.town] || j.town}.`, msgs };
    }
    // a contract: quietly (Sneak) for a bonus, or a fight
    if (ok) return { text: finish(Math.round(j.pay * 1.5), `Nobody saw a thing. The contract is fulfilled: ${Math.round(j.pay * 1.5)} gold, with Nazir's bonus.`), msgs };
    const e = G.scaleEnemy({ name: "The mark's bodyguards", health: 120 + (s.level || 1) * 6, damage: 10 + (s.level || 1) * 0.6, tags: ["humanoid"], level: s.level || 1, danger: "medium", gold: [10, 40], text: "" }, s.level || 1);
    const f = new G.Fight(s, e, null, t); f.run({ t }); const skills = f.apply(t);
    if (!f.won) { st.job = null; st.next = t + COOLDOWN; const d = G.die(s, e.name, t, true); return { text: "The contract went wrong.", fight: f, skills, died: d.msg, bag: d.bag, msgs }; }
    return { text: finish(j.pay, `It got loud, but the contract is fulfilled: ${j.pay} gold.`), fight: f, skills, msgs };
  }
  function drop(s, id) { const st = g(s)[id]; if (!st.job) return "No job."; st.job = null; st.next = G.now() + 60; return "You drop the job."; }

  // ---- the Brotherhood's other way in, and Shadowmere
  /* sleeping at an inn after a murder: Astrid comes to you ([Skyrim] the "abandoned shack" start) */
  function innWake(s) {
    if ((s.quests || {}).brotherhood || !(s.murdered || (s.pvpKills || 0) > 0)) return "";
    s.quests = s.quests || {}; s.quests.brotherhood = { stage: 1, t: G.now(), base: { ...(s.stats || {}) } };
    G.note(s, " A stranger waited by your bed: Astrid of the Dark Brotherhood.");
    return " You wake to a woman sitting by your bed. \"I'm Astrid. Someone's been killing,\" she smiles. \"The Family has noticed. Come to the Sanctuary near Falkreath.\" (Journal: The Dark Brotherhood)";
  }
  function giveHorse(s, which, msgs) {
    if (which !== "shadowmere" || typeof HORSES === "undefined") return;
    const old = s.horse?.name, armor = s.horse?.armor || "none";
    s.horse = { name: "Shadowmere", coat: "black", armor, hp: 0, hpT: Date.now() / 1000, mounted: true, shadowmere: true };
    s.horse.hp = HORSES.maxHp(s.horse);
    msgs.push(` Shadowmere rises from the pool: a black horse with red eyes, and yours now.${old && old !== "Shadowmere" ? ` ${old} goes back to the stables in peace.` : ""}`);
  }
  return { RANKS, rank, fenceMult, offer, work, drop, chance, canTake, takeAt, innWake, giveHorse, state: g, COOLDOWN };
})();
