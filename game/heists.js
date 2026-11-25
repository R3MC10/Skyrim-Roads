/* Heists in the big cities [OURS].
   - One heist per big city, always against a rich NPC household (never a player): Olfrid Battle-Born in Whiterun,
     Torbjorn Shatter-Shield in Windhelm, Erikur in Solitude, Thonar Silver-Blood in Markarth, Maven Black-Briar in Riften.
   - Five steps: prepare (case the house, buy forged papers or a Draught of Shadows), get in, the obstacle inside (the
     strongroom door), grab (only the prize, clean the place out, or leave a false trail) and escape (walk out calmly,
     the rooftops, the sewers, or fight your way out once they're on to you).
   - Every door can be passed five ways, each with its own price: a bribe always works but people may talk, forged papers
     need a silver tongue, going unseen needs Sneak or Illusion (or the draught), the lock is the lockpicking mini-game on
     the door plate (lockgame.js), and force works but the house knows. A failed try raises suspicion; at 100 the alarm
     goes up and it's straight to the escape.
   - What it leads to: a bounty in the hold if you're seen or caught (caught: the loot is taken back), corruption in the
     hold (crises.js: bribes, forged papers, theft, the fence), and the fence's cut of the goods.
   - Party: the leader plans it; every choice is put to the party's vote (partyplay.js halt, majority wins, a tie goes to
     the leader: partyvote.js); gold is split evenly and the prize goes to the party's loot vote (lootvote.js).
   - Perks (perkfx.js): Locksmith (Lockpicking), Infiltrator (Sneak), Escape Artist (Acrobatics); the old Fence perk
     (Mercantile) also cuts the fence's share.
   The rules up top are plain JS (node tests); the screens only run in the browser. */
const HEISTS = (() => {
  const DOM = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc0 = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pfx = (s, k) => (typeof PFX !== "undefined" && s?.perks ? PFX.num(s, k) : 0);
  const P = (s, id) => (typeof G !== "undefined" && s?.perks ? G.P(s, id) : false);
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const COOLDOWN = 4 * 3600;     // a robbed house locks up for 4 hours (real time)
  const HEAT_ALARM = 100;        // suspicion at which the alarm goes up
  const CUT_BASE = 0.30, CUT_MIN = 0.10;
  const STAGES = [["Prepare", "Przygotowanie"], ["Get in", "Wejście"], ["Obstacle", "Przeszkoda"], ["Grab", "Łup"], ["Escape", "Ucieczka"]];
  const TIER_NAME = [["Easy", "Łatwy"], ["Fair", "Średni"], ["Hard", "Trudny"], ["Very hard", "Bardzo trudny"]];

  // ---------------------------------------------------------------- the houses ([english, polish])
  const HOUSES = {
    Whiterun: { id: "battleborn", tier: 1, minLv: 3,
      name: ["Olfrid Battle-Born's house", "Dom Olfrida Battle-Borna"],
      blurb: ["The Battle-Borns keep their family ring in a strongbox upstairs. Old money, lazy guards.", "Battle-Bornowie trzymają rodowy pierścień w skrzyni na piętrze. Stare pieniądze, leniwi strażnicy."],
      way: ["the kitchen door", "drzwi kuchenne"], wayWho: ["the kitchen maid", "pokojówka z kuchni"],
      vault: ["the strongbox room", "pokój ze skrzynią"], vaultWho: ["the house steward", "zarządca domu"],
      guard: ["Battle-Born house guard", "Strażnik domu Battle-Bornów"], prize: "hs_signet" },
    Windhelm: { id: "shattershield", tier: 2, minLv: 6,
      name: ["The Shatter-Shield counting house", "Kantor Shatter-Shieldów"],
      blurb: ["Torbjorn counts the shipping money here every night, by the light of a gold compass he never lets out of sight.", "Torbjorn co noc liczy tu pieniądze z żeglugi, przy złotym kompasie, którego nigdy nie spuszcza z oka."],
      way: ["the dockside door", "drzwi od strony doków"], wayWho: ["the night clerk", "nocny pisarz"],
      vault: ["the iron counting room", "żelazny pokój rachunkowy"], vaultWho: ["the old bookkeeper", "stary księgowy"],
      guard: ["Shatter-Shield dock guard", "Strażnik doków Shatter-Shieldów"], prize: "hs_compass" },
    Solitude: { id: "erikur", tier: 3, minLv: 10,
      name: ["Thane Erikur's townhouse", "Kamienica tana Erikura"],
      blurb: ["Erikur hosts the finest dinners in Solitude, and drinks from a jewelled goblet he says the Emperor gave him.", "Erikur wydaje najlepsze kolacje w Samotni i pije z wysadzanego klejnotami pucharu, który podobno dostał od Cesarza."],
      way: ["the servants' gate", "brama dla służby"], wayWho: ["the head butler", "kamerdyner"],
      vault: ["the locked gallery", "zamknięta galeria"], vaultWho: ["Erikur's bodyguard", "ochroniarz Erikura"],
      guard: ["Erikur's hired sword", "Najemny miecz Erikura"], prize: "hs_goblet" },
    Markarth: { id: "silverblood", tier: 3, minLv: 10,
      name: ["The Silver-Blood treasury house", "Skarbiec Srebrnokrwistych"],
      blurb: ["Thonar Silver-Blood keeps the family torc behind Dwemer stone and two locks. In Markarth, the Silver-Bloods own the guards too.", "Thonar Srebrnokrwisty trzyma rodowy naszyjnik za dwemerskim kamieniem i dwoma zamkami. W Markarth Srebrnokrwiści mają też straż."],
      way: ["the stone side door", "kamienne boczne drzwi"], wayWho: ["the treasury porter", "odźwierny skarbca"],
      vault: ["the Dwemer vault", "dwemerski skarbiec"], vaultWho: ["the Silver-Blood enforcer", "egzekutor Srebrnokrwistych"],
      guard: ["Silver-Blood enforcer", "Egzekutor Srebrnokrwistych"], prize: "hs_torc" },
    Riften: { id: "blackbriar", tier: 4, minLv: 14,
      name: ["Maven Black-Briar's manor", "Dwór Maven Black-Briar"],
      blurb: ["Nobody robs Maven Black-Briar. That's exactly why her ruby brooch sits in a room with only one guard.", "Nikt nie okrada Maven Black-Briar. Właśnie dlatego jej rubinowa brosza leży w pokoju z jednym strażnikiem."],
      way: ["the garden wall", "mur ogrodu"], wayWho: ["the gardener", "ogrodnik"],
      vault: ["Maven's private study", "prywatny gabinet Maven"], vaultWho: ["Maven's housecarl", "huskarl Maven"],
      guard: ["Black-Briar mercenary", "Najemnik Black-Briarów"], prize: "hs_brooch" },
  };
  const BY_ID = Object.fromEntries(Object.entries(HOUSES).map(([city, h]) => [h.id, { ...h, city }]));
  const PRIZES = {
    hs_signet: { name: "Battle-Born Signet Ring", pl: "Sygnet Battle-Bornów", value: 500, weight: 0.2, desc: "A heavy gold ring with the Battle-Born crest. Only a fence will touch it.", dpl: "Ciężki złoty pierścień z herbem Battle-Bornów. Tylko paser go weźmie." },
    hs_compass: { name: "Shatter-Shield Gold Compass", pl: "Złoty kompas Shatter-Shieldów", value: 650, weight: 0.5, desc: "A ship's compass in solid gold. It still points north, mostly.", dpl: "Okrętowy kompas z litego złota. Wciąż wskazuje północ, przeważnie." },
    hs_goblet: { name: "Erikur's Jewelled Goblet", pl: "Wysadzany klejnotami puchar Erikura", value: 800, weight: 1, desc: "Gold and garnets. The Emperor never gave it to anyone.", dpl: "Złoto i granaty. Cesarz nikomu go nie dał." },
    hs_torc: { name: "Silver-Blood Heirloom Torc", pl: "Rodowy naszyjnik Srebrnokrwistych", value: 900, weight: 1, desc: "A twisted silver neck ring, old as the Reach. The Silver-Bloods will want it back.", dpl: "Skręcony srebrny naszyjnik, stary jak Pogranicze. Srebrnokrwiści będą go chcieli z powrotem." },
    hs_brooch: { name: "Black-Briar Ruby Brooch", pl: "Rubinowa brosza Black-Briarów", value: 1200, weight: 0.2, desc: "A ruby the size of a thumbnail. Wear it in Riften and you won't live long.", dpl: "Rubin wielkości paznokcia. Załóż ją w Riften, a długo nie pożyjesz." },
  };
  const TOOLS = {
    hs_papers: { name: "Forged Papers", pl: "Fałszywe dokumenty", desc: "A letter of passage with a very good fake seal. Shown once, then it's no use.", dpl: "List żelazny z bardzo dobrą fałszywą pieczęcią. Działa raz.", price: (t) => 30 + 20 * t },
    hs_draught: { name: "Draught of Shadows", pl: "Wywar cieni", desc: "A grey drink that makes eyes slide off you for a while. Helps you get past unseen on a heist.", dpl: "Szary napój, po którym wzrok innych się po tobie ześlizguje. Pomaga przejść niezauważonym podczas skoku.", price: (t) => 40 + 25 * t },
  };
  if (typeof D !== "undefined" && D.ITEMS) {
    for (const [id, p] of Object.entries(PRIZES)) if (!D.ITEMS[id]) D.ITEMS[id] = { name: p.name, slot: "valuable", weight: p.weight, value: p.value, desc: p.desc, heist: true };
    for (const [id, p] of Object.entries(TOOLS)) if (!D.ITEMS[id]) D.ITEMS[id] = { name: p.name, slot: "misc", weight: 0.1, value: p.price(1), desc: p.desc, heist: true };
  }

  // ---------------------------------------------------------------- perks (perkfx.js format)
  const PERK_ADD = [
    ["Lockpicking", "heist_locksmith", "Locksmith", 2, [25, 50], ["apprentice_locks"], "On a heist every lock counts one grade easier per rank, and you bring two spare picks. [OURS]", [["hslock", [1, 2], {}], ["hspicks", 2, {}]]],
    ["Sneak", "heist_infiltrator", "Infiltrator", 2, [30, 60], ["stealth"], "On a heist: +10%/+20% to forged papers, slipping past unseen and walking out calmly, and a failed try raises less suspicion. [OURS]", [["hsinfil", [0.1, 0.2], {}]]],
    ["Acrobatics", "heist_escape", "Escape Artist", 1, [40], ["sure_footed"], "+20% to every heist escape, heist bounties are halved, and once per heist a capture turns into a narrow escape. [OURS]", [["hsescape", 0.2, {}], ["hshalf", 1, {}], ["hsslip", 1, {}]]],
  ];
  if (typeof PERKS !== "undefined" && typeof PFX !== "undefined") for (const [sk, id, name, ranks, req, needs, desc, fx] of PERK_ADD) {
    const tree = PERKS.TREES[sk]; if (!tree || PERKS.BY_ID[id] || !needs.every((n) => PERKS.BY_ID[n])) continue;
    tree.push([id, name, ranks, req, needs, desc]); PERKS.BY_ID[id] = { id, name, ranks, req, needs, desc, skill: sk }; PFX.FX[id] = fx;
  }
  const PERK_ADJ = [["fence", " On a heist the fence takes 15% less of the loot.", [["hsfence", 0.15, {}]]]];
  if (typeof PERKS !== "undefined" && typeof PFX !== "undefined") for (const [id, more, fx] of PERK_ADJ) {
    const p = PERKS.BY_ID[id]; if (!p || (PFX.FX[id] || []).some(([k]) => k === fx[0][0])) continue;
    const tag = p.desc.match(/\s*\[[^\]]*\]\s*$/);   // keep the [Skyrim]/[OURS] tag at the end (the perk screens cut it off)
    const desc = p.desc.includes(more.trim()) ? p.desc : tag ? p.desc.slice(0, tag.index) + more + tag[0] : p.desc + more;
    const row = PERKS.TREES[p.skill]?.find((x) => x[0] === id); if (row) row[5] = desc;
    p.desc = desc; PFX.FX[id] = [...(PFX.FX[id] || []), ...fx];
  }

  // ---------------------------------------------------------------- save state
  function st(s) {
    let o = s.heist;
    if (!o || typeof o !== "object") o = {};
    if (!o.cd || typeof o.cd !== "object") o.cd = {};
    if (!o.done || typeof o.done !== "object") o.done = {};
    if (!o.stats || typeof o.stats !== "object") o.stats = { runs: 0, clean: 0, seen: 0, caught: 0, gold: 0 };
    if (o.run && (typeof o.run !== "object" || !BY_ID[o.run.id] || typeof o.run.stage !== "number")) o.run = null;
    o.v = 1; s.heist = o;
    return o;
  }
  function migrate(s) { if (s && typeof s === "object" && s.heist) st(s); return s; }
  if (typeof G !== "undefined" && G.migrate) { const m0 = G.migrate; G.migrate = (s, ...a) => { const r = m0(s, ...a); try { migrate(s); } catch { /* never block a load */ } return r; }; }

  // ---------------------------------------------------------------- numbers
  const lvl = (s) => Math.max(1, s?.level || 1);
  const sk = (s, name) => { try { return G.skill(s, name); } catch { return 15; } };
  const best = (s, ...names) => Math.max(...names.map((n) => sk(s, n)));
  const NEED = (tier) => 20 + 15 * tier;                       // the skill an even chance needs
  const partyBonus = (n) => Math.min(0.15, 0.03 * Math.max(0, (n || 1) - 1));
  /* the goods in the house, before the fence: grows with your level (to 50) and with more hands to carry it */
  const goodsValue = (tier, L, n = 1) => Math.round((150 + 90 * tier) * (1 + Math.min(L, 50) / 20) * (0.5 + 0.5 * clamp(n || 1, 1, 8)));
  function bribeCost(s, r, at) {
    const h = BY_ID[r.id];
    let c = (40 + 30 * h.tier) * (1 + Math.min(lvl(s), 50) / 50) * (at === 2 ? 1.6 : 1);
    c *= P(s, "bribe_master") ? 0.5 : P(s, "bribery") ? 0.75 : 1;
    c *= 1 - Math.min(0.5, pfx(s, "bribe"));
    return Math.max(10, Math.round(c));
  }
  const toolPrice = (s, id, tier) => Math.round(TOOLS[id].price(tier) * (1 + Math.min(lvl(s), 50) / 100));
  /* the fence's share: 30%, less with the Fence perk and Thieves Guild rank, never under 10% */
  function fenceCut(s) {
    let c = CUT_BASE - pfx(s, "hsfence");
    let gr = null; try { gr = typeof GUILDS !== "undefined" ? GUILDS.rank(s, "thieves") : null; } catch { gr = null; }
    if (gr) c -= 0.02 * ((gr.i | 0) + 1);
    return Math.round(clamp(c, CUT_MIN, CUT_BASE) * 100) / 100;
  }
  const lockTier = (s, r, at) => clamp(BY_ID[r.id].tier - (at === 1 ? 1 : 0) - Math.round(pfx(s, "hslock")), 0, 4);
  const picks = (s) => 2 + Math.round(pfx(s, "hspicks"));
  function check(s, r, skill, extra = 0) {
    const h = BY_ID[r.id];
    return clamp(0.5 + (skill - NEED(h.tier)) / 70 + extra + (r.cased ? 0.12 : 0) + partyBonus(r.n) - (r.heat || 0) / 400, 0.08, 0.95);
  }
  const hasItem = (s, id) => (s.inv || []).some((x) => x.item === id && x.qty > 0);
  const takeItem = (s, id) => { const row = (s.inv || []).find((x) => x.item === id && x.qty > 0); if (row) G.take(s, row.id, 1); return !!row; };
  const knowsInvis = (s) => Array.isArray(s.spells) && s.spells.includes("invisibility");
  /* what each try at a door would do: chance (null = always works), cost, can you do it */
  function methodInfo(s, r, key) {
    const at = r.stage, infil = pfx(s, "hsinfil");
    if (key === "bribe") { const c = bribeCost(s, r, at); return { chance: null, cost: c, can: s.gold >= c, why: s.gold >= c ? "" : "Not enough gold." }; }
    if (key === "papers") return { chance: check(s, r, best(s, "Speechcraft", "Etiquette"), infil), can: hasItem(s, "hs_papers"), why: hasItem(s, "hs_papers") ? "" : "You have no forged papers." };
    if (key === "invis") { const dr = hasItem(s, "hs_draught"), sp = knowsInvis(s); return { chance: check(s, r, best(s, "Sneak", "Illusion") + (dr ? 15 : 0), infil), can: dr || sp, draught: dr, why: dr || sp ? "" : "You need a Draught of Shadows or the Invisibility spell." }; }
    if (key === "lockpick") { const lt = lockTier(s, r, at), n = picks(s), p = G.lockChance(s, lt); return { chance: clamp(1 - Math.pow(1 - p, n), 0.05, 0.97), lock: lt, picks: n, can: true }; }
    if (key === "force") return at === 1 ? { chance: null, fight: true, can: true } : { chance: check(s, r, best(s, "Two-Handed", "One-Handed", "Hand-to-Hand", "Blocking")), can: true };
    return { chance: null, can: true };
  }
  const escInfo = (s, r, key) => {
    const ea = pfx(s, "hsescape"), infil = pfx(s, "hsinfil");
    if (key === "calm") return { chance: check(s, r, sk(s, "Speechcraft"), infil + ea - (r.alarm ? 0.25 : 0)), can: true };
    if (key === "roofs") return { chance: check(s, r, best(s, "Acrobatics", "Athletics"), ea), can: true };
    if (key === "sewers") return { chance: check(s, r, sk(s, "Sneak"), ea + 0.15), can: true };
    if (key === "fight") return { chance: null, fight: true, can: !!(r.alarm || r.heat >= 50), why: "Only when the guards are on to you." };
    return { chance: null, can: true };
  };

  // ---------------------------------------------------------------- the run
  const houseAt = (l) => (l && HOUSES[l] ? { ...HOUSES[l], city: l } : null);
  const role = (s) => (typeof PARTYPLAY !== "undefined" ? (() => { try { return PARTYPLAY.role(s); } catch { return "solo"; } })() : "solo");
  const holdOf = (city) => { try { return G.holdAt(WORLD.places[city]); } catch { return city; } };
  const cdLeft = (s, id, t = now()) => Math.max(0, Math.ceil((st(s).cd[id] || 0) - t));
  /* can you start the heist in this town? "" or why not */
  function blocked(s, l, t = now()) {
    const h = houseAt(l); if (!h) return "There's no house worth robbing here.";
    if (s.location !== l) return "You have to be in town.";
    if (s.dungeon || (s.trip && s.trip.status !== "done" && s.trip.dest)) return "Finish what you're doing first.";
    if (role(s) === "member") return "In a party your leader plans the heist. Vote when they ask.";
    const x = st(s);
    if (x.run && x.run.id !== h.id) return "You're already on a heist somewhere else.";
    if (x.run) return "";
    if (typeof TOWNS !== "undefined" && TOWNS.bounty(s, holdOf(l)) > 0) return "The guards know your face here. Clear your bounty first.";
    if (lvl(s) < h.minLv) return `Come back at level ${h.minLv}. This one is out of your league for now.`;
    const left = cdLeft(s, h.id, t); if (left) return `The house is still on its guard. Try again in ${fmtTime(left)}.`;
    return "";
  }
  const fmtTime = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min` : `${Math.max(1, Math.ceil(sec / 60))} min`);
  function start(s, n = 1, t = now()) {
    const why = blocked(s, s.location, t); if (why) return { err: why };
    const x = st(s), h = houseAt(s.location);
    if (x.run) return { ok: true, run: x.run };
    x.run = { id: h.id, stage: 0, heat: 0, cased: false, used: { 1: [], 2: [] }, bribes: 0, papers: 0, forced: false, alarm: false, take: null, n: clamp(n | 0 || 1, 1, 8), slip: false, skills: {}, last: "", t };
    return { ok: true, run: x.run, text: `You watch ${h.name[0]} from across the street.` };
  }
  const run = (s) => st(s).run;
  const used = (r, k) => (r.used[r.stage] || []).includes(k);
  const xp = (r, name, v) => { r.skills[name] = (r.skills[name] || 0) + v; };
  const raise = (s, r, v) => {
    const cut = 1 - Math.min(0.6, pfx(s, "hsinfil") * 1.5);
    r.heat = Math.round(clamp(r.heat + v * (v > 0 ? cut : 1), 0, 150));
  };
  const pct = (c) => Math.round(c * 100);
  /* the buttons for the step you're on: { key, label, sub, chance, can, cls, icon } */
  function options(s) {
    const r = run(s); if (!r) return [];
    const h = BY_ID[r.id], out = [];
    const add = (key, icon, label, sub, info = {}, cls = "") => out.push({ key, icon, label, sub, chance: info.chance ?? null, can: info.can !== false, why: info.why || "", cls });
    if (r.stage === 0) {
      add("case", "", "Case the house first", r.cased ? "Done: you know the guards' rounds" : "Free · every check a little easier", { can: !r.cased });
      const pp = toolPrice(s, "hs_papers", h.tier), dp = toolPrice(s, "hs_draught", h.tier);
      add("buypapers", "", "Buy forged papers", `${pp} gold · you have ${count(s, "hs_papers")}`, { can: s.gold >= pp, why: "Not enough gold." });
      add("buydraught", "", "Buy a Draught of Shadows", `${dp} gold · you have ${count(s, "hs_draught")}`, { can: s.gold >= dp, why: "Not enough gold." });
      add("go", "", "Go in", "Tonight's the night", {}, "pri");
      add("leave", "", "Not tonight", "Walk away, nothing lost");
      return out;
    }
    if (r.stage === 1 || r.stage === 2) {
      const who = r.stage === 1 ? h.wayWho[0] : h.vaultWho[0], at = r.stage;
      const b = methodInfo(s, r, "bribe"), pa = methodInfo(s, r, "papers"), iv = methodInfo(s, r, "invis"), lk = methodInfo(s, r, "lockpick"), fo = methodInfo(s, r, "force");
      const tried = (k, i) => (used(r, k) ? { ...i, can: false, why: "Already tried: they're watching for that now." } : i);
      add("bribe", "", `Bribe ${who}`, `${b.cost} gold · always works, but people may talk`, tried("bribe", b));
      add("papers", "", "Show forged papers", `Speechcraft · uses one set · you have ${count(s, "hs_papers")}`, tried("papers", pa));
      add("invis", "", "Slip past unseen", iv.draught ? "Sneak or Illusion · drinks a Draught of Shadows" : "Sneak or Illusion · needs the draught or the spell", tried("invis", iv));
      add("lockpick", "", "Pick the lock", `${LOCK_NAME[lk.lock][0]} lock · ${lk.picks} picks`, tried("lockpick", lk));
      add("force", "", at === 1 ? "Force your way in" : "Break the door down", at === 1 ? "Fight the house guard · they'll know someone was here" : "Loud · the whole house may hear", tried("force", fo), "danger");
      add("back", "", "Back out", r.heat >= 50 ? "They may already have seen you" : "Slip away now");
      return out;
    }
    if (r.stage === 3) {
      const pz = PRIZES[h.prize];
      add("prize", "", "Take only the prize", `${pz.name} and a little coin`, {}, "pri");
      add("all", "", "Clean the place out", "Much more loot, but it's loud");
      add("trail", "", "Leave a false trail", "Less loot, but the guards will look elsewhere");
      return out;
    }
    if (r.stage === 4) {
      add("calm", "", "Walk out calmly", r.alarm ? "Speechcraft · hard with the alarm up" : "Speechcraft", escInfo(s, r, "calm"));
      add("roofs", "", "Over the rooftops", "Acrobatics or Athletics", escInfo(s, r, "roofs"));
      add("sewers", "", "Down through the sewers", "Sneak · you'll drop some of the loot", escInfo(s, r, "sewers"));
      add("fight", "", "Fight your way out", "Fight the guards · only when they're on to you", escInfo(s, r, "fight"), "danger");
    }
    return out;
  }
  const LOCK_NAME = [["Novice", "Nowicjusza"], ["Apprentice", "Ucznia"], ["Adept", "Adepta"], ["Expert", "Eksperta"], ["Master", "Mistrza"]];
  const count = (s, id) => (s.inv || []).filter((x) => x.item === id).reduce((a, x) => a + (x.qty || 0), 0);

  /* the house guard, scaled to you; never a one-shot either way */
  function guardFoe(s, r, out) {
    const h = BY_ID[r.id], L = typeof G.fightLevel === "function" ? G.fightLevel(s) : lvl(s);
    const e = G.scaleEnemy({ name: h.guard[0], level: L, health: (out ? 120 : 100) + 12 * h.tier, damage: 9 + 1.2 * h.tier, tags: ["humanoid"], danger: h.tier >= 3 ? "high" : "medium", gold: [0, 0], text: "" }, L);
    e.heist = h.id; e.noGroup = true;
    return e;
  }
  function fight(s, r, out, t) {
    const e = guardFoe(s, r, out), f = new G.Fight(s, e, null, t);
    f.run({ t, trySneak: false });
    const skills = f.apply(t);
    const won = !!(f.won && f.hp > 0);
    if (!won) { try { G.setHealth(s, Math.max(1, Math.round(G.maxHealth(s) * 0.2)), t); } catch { /* fine */ } }   // knocked down and dragged out, never killed
    return { f, won, skills };
  }
  const goStage = (r, n) => { r.stage = n; };
  function alarmCheck(r) { if (r.heat >= HEAT_ALARM && !r.alarm) { r.alarm = true; return true; } return false; }

  /* do one thing. o.lock: the lock mini-game already decided (true/false). Returns { text, ok?, fight?, end?, res? } */
  function act(s, key, o = {}, t = now()) {
    const r = run(s); if (!r) return { err: "You're not on a heist." };
    const h = BY_ID[r.id];
    const opt = options(s).find((x) => x.key === key);
    if (!opt) return { err: "You can't do that now." };
    if (!opt.can) return { err: opt.why || "You can't do that now." };
    let text = "", ok = true, fightOut = null;
    if (r.stage === 0) {
      if (key === "case") { r.cased = true; xp(r, "Sneak", 3); text = "You spend an hour watching the house. You know when the guards change and which window sticks."; }
      else if (key === "buypapers" || key === "buydraught") {
        const id = key === "buypapers" ? "hs_papers" : "hs_draught", c = toolPrice(s, id, h.tier);
        s.gold -= c; G.give(s, id, 1);
        text = `A man in a back alley sells you ${TOOLS[id].name} for ${c} gold.`;
      } else if (key === "go") { goStage(r, 1); text = `You reach ${h.way[0]}. ${cap(h.wayWho[0])} is close by.`; }
      else if (key === "leave") { st(s).run = null; return { text: "You walk away. The house will still be there tomorrow.", end: true, quit: true }; }
      r.last = text; return { text, ok };
    }
    if (r.stage === 1 || r.stage === 2) {
      const at = r.stage, who = at === 1 ? h.wayWho[0] : h.vaultWho[0];
      if (key === "back") return quit(s, r, t);
      const info = methodInfo(s, r, key);
      if (key === "bribe") {
        s.gold -= info.cost; r.bribes++; xp(r, "Speechcraft", 6);
        text = `${cap(who)} pockets the coin and looks the other way.`;
      } else if (key === "papers") {
        takeItem(s, "hs_papers"); r.papers++; xp(r, "Speechcraft", 8);
        ok = Math.random() < info.chance;
        if (ok) text = "They read the papers twice and wave you through.";
        else { raise(s, r, 35); text = "They squint at the seal. Something's wrong, and they know it."; }
      } else if (key === "invis") {
        if (info.draught) takeItem(s, "hs_draught");
        xp(r, "Sneak", 10); if (!info.draught) xp(r, "Illusion", 6);
        ok = Math.random() < info.chance;
        if (ok) { raise(s, r, -5); text = "You move through the shadows like smoke."; }
        else { raise(s, r, 30); text = "A floorboard creaks. Someone turns to look."; }
      } else if (key === "lockpick") {
        xp(r, "Lockpicking", 8 + 3 * info.lock);
        ok = typeof o.lock === "boolean" ? o.lock : Math.random() < info.chance;
        if (ok) text = "The lock gives with a soft click.";
        else { raise(s, r, 20); text = "The pick snaps. The noise carries."; }
      } else if (key === "force") {
        r.forced = true;
        if (at === 1) {
          const fo = fight(s, r, false, t); fightOut = fo;
          ok = fo.won;
          if (ok) { raise(s, r, 30); text = "The guard goes down. The way is open, but the house will know someone was here."; }
          else { r.last = "The guard beats you down and calls for the watch."; const res = finish(s, "caught", t); return { text: r.last, ok: false, fight: fo.f, skills: fo.skills, end: true, res }; }
        } else {
          ok = Math.random() < info.chance;
          xp(r, "Two-Handed", 4);
          if (ok) { raise(s, r, 30); text = "The door splinters open. Loud, but you're in."; }
          else { raise(s, r, 50); text = "It takes three blows. Everyone heard that."; }
          ok = true;   // you get through either way; the noise is the price
        }
      }
      if (!ok) (r.used[at] = r.used[at] || []).push(key);
      if (alarmCheck(r)) { goStage(r, 4); text += " The alarm goes up! No time to grab anything: run."; }
      else if (ok) { goStage(r, at + 1); text += at === 1 ? ` You're inside. Ahead is ${h.vault[0]}, and ${h.vaultWho[0]}.` : " You're in. The prize is right there."; }
      r.last = text;
      return { text, ok, fight: fightOut?.f, skills: fightOut?.skills };
    }
    if (r.stage === 3) {
      r.take = key;
      if (key === "prize") text = `You pocket the ${PRIZES[h.prize].name} and leave the rest.`;
      else if (key === "all") { raise(s, r, 20); text = "You fill your bags with everything that shines."; }
      else { raise(s, r, -15); text = "You take the prize and leave a false trail behind you."; }
      if (alarmCheck(r)) text += " Someone wakes up. The alarm goes up!";
      goStage(r, 4); r.last = text;
      return { text, ok };
    }
    if (r.stage === 4) {
      r.route = key;
      if (key === "fight") {
        const fo = fight(s, r, true, t); fightOut = fo; ok = fo.won;
        text = ok ? "You fight your way to the gate and lose them in the streets." : "There are too many of them. They drag you down.";
      } else {
        const info = escInfo(s, r, key);
        xp(r, key === "calm" ? "Speechcraft" : key === "roofs" ? (sk(s, "Acrobatics") >= sk(s, "Athletics") ? "Acrobatics" : "Athletics") : "Sneak", 10);
        ok = Math.random() < info.chance;
        text = ok ? ({ calm: "You nod to the guard at the gate and stroll away.", roofs: "You run along the rooftops and drop into a dark alley.", sewers: "You crawl out of the sewers far from the house, a little lighter." })[key] : "They corner you.";
      }
      let outc = ok ? (r.alarm || r.heat >= 50 || r.forced ? "seen" : "clean") : "caught";
      if (outc === "caught" && pfx(s, "hsslip") > 0 && !r.slip) { r.slip = true; outc = "seen"; text += " Caught, almost! You wriggle free at the last moment."; }
      r.last = text;
      const res = finish(s, outc, t);
      return { text, ok, end: true, res, fight: fightOut?.f, skills: fightOut?.skills };
    }
    return { err: "?" };
  }
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  /* backing out at a door: no loot; if they'd seen you, a small bounty */
  function quit(s, r, t) {
    const h = BY_ID[r.id], hold = holdOf(h.city);
    let bounty = 0;
    if (r.heat >= 50 && typeof TOWNS !== "undefined") { bounty = 30 + 10 * h.tier; TOWNS.addBounty(s, hold, "theft", bounty); }   // trespassing
    const deeds = bribesDeeds(s, r, hold);
    st(s).cd[h.id] = t + COOLDOWN / 2; st(s).run = null;
    grantXp(s, r);
    const text = bounty ? `You get out, but they saw you. Bounty in ${hold}: ${bounty} gold.` : "You slip away before anyone notices.";
    return { text, end: true, res: { outcome: "quit", gold: 0, bounty, hold, deeds, house: h.id, lines: [text] } };
  }
  function bribesDeeds(s, r, hold) {
    const out = [];
    const deed = (k) => { out.push(k); try { if (typeof CRISES !== "undefined") CRISES.deed(s, hold, k); } catch { /* optional */ } };
    for (let i = 0; i < r.bribes; i++) deed("bribe");
    for (let i = 0; i < r.papers; i++) deed("fence");   // forgers are part of the same rot
    return out;
  }
  function grantXp(s, r) {
    const msgs = [];
    for (const [k, v] of Object.entries(r.skills || {})) { try { if (s.skills?.[k]) msgs.push(...(G.useSkill(s, k, v) || [])); } catch { /* fine */ } }
    return msgs;
  }
  const TAKE = { prize: 0.6, all: 1.5, trail: 0.5 };
  /* the end: gold through the fence, the prize, the bounty, the hold's corruption */
  function finish(s, outcome, t = now()) {
    const x = st(s), r = x.run, h = BY_ID[r.id], hold = holdOf(h.city);
    const full = goodsValue(h.tier, lvl(s), r.n);
    let goods = Math.round(full * (TAKE[r.take] ?? 0));
    if (r.route === "sewers") goods = Math.round(goods * 0.7);
    const lines = [];
    let bounty = 0, gold = 0, prize = null, cut = fenceCut(s), talked = false;
    const half = pfx(s, "hshalf") > 0 ? 0.5 : 1;
    if (outcome === "caught") {
      bounty = Math.round(Math.max(100, 0.4 * full) * half);
      goods = 0;
      lines.push("Caught! The guards take the loot back and put a price on your head.");
    } else {
      if (outcome === "seen") { bounty = Math.round((Math.max(50, 0.25 * full) + (r.forced ? 40 : 0)) * half); lines.push("You got away, but someone saw your face."); }
      else if (r.bribes && Math.random() < Math.min(0.5, 0.1 * r.bribes) * (r.take === "trail" ? 0.5 : 1)) { talked = true; bounty = Math.round(Math.max(40, 0.15 * full) * half); lines.push("Clean job, but one of the people you bribed talked."); }
      else lines.push("Clean job. Nobody knows it was you.");
      if (r.take) {
        const first = !x.done[h.id];
        if (first) { const id = G.give(s, h.prize, 1); const row = G.invRow(s, id); if (row) row.stolen = true; prize = h.prize; }
        else goods += Math.round(PRIZES[h.prize].value * 0.35);   // the prize went back to a new hiding place: you take its worth in coin and plate instead
        gold = Math.round(goods * (1 - cut));
        s.gold += gold;
        x.done[h.id] = (x.done[h.id] || 0) + 1;
        if (gold) lines.push(`The fence takes ${pct(cut)}% and pays you ${gold} gold.`);
        if (prize) lines.push(`You keep the ${PRIZES[prize].name}. Only a fence will buy it.`);
      } else lines.push("You got out with nothing.");
    }
    if (bounty && typeof TOWNS !== "undefined") TOWNS.addBounty(s, hold, "theft", bounty);   // crises.js counts a theft bounty as theft in the hold
    const deeds = bribesDeeds(s, r, hold);
    const cor = (k) => { deeds.push(k); try { if (typeof CRISES !== "undefined") CRISES.deed(s, hold, k); } catch { /* optional */ } };
    if (outcome !== "caught" && !bounty && r.take) cor("theft");   // nobody blamed: still a theft in the hold
    if (bounty) deeds.push("theft");
    if (gold) cor("fence");
    if (bounty) lines.push(`Bounty in ${hold}: ${bounty} gold.`);
    if (deeds.length) lines.push(`Corruption in ${hold} goes up.`);
    const msgs = grantXp(s, r);
    x.cd[h.id] = t + COOLDOWN;
    x.stats.runs++; x.stats[outcome === "caught" ? "caught" : bounty ? "seen" : "clean"]++; x.stats.gold += gold;
    x.last = { house: h.id, outcome, gold, bounty, t };
    x.run = null;
    try { G.note(s, ` ${h.name[0]}: ${lines[0]}`); } catch { /* fine */ }
    return { outcome: outcome === "seen" || talked ? "seen" : outcome, talked, gold, goods, cut, prize, bounty, hold, deeds, house: h.id, lines, msgs };
  }

  // ---------------------------------------------------------------- party: every choice is voted
  const SHOP = new Set(["buypapers", "buydraught"]);   // the leader's own shopping isn't put to a vote
  const optsForVote = (s) => options(s).filter((o) => !SHOP.has(o.key)).map((o) => [o.key, o.label, o.cls === "pri" ? "btn pri" : o.cls === "danger" ? "btn danger" : "btn", o.can ? 0 : 1]);
  function openVote(p, leader, s, who, lk, t = now()) {
    if (typeof PARTYPLAY === "undefined") return p;
    const r = run(s), h = r ? BY_ID[r.id] : null;
    const np = PARTYPLAY.halt(p, leader, { kind: "heist", name: "Heist", title: h ? h.name[0] : "Heist", sub: r ? STAGES[r.stage][0] : "", text: r?.last || "What do we do?", opts: optsForVote(s), who, pos: [s.x, s.y] }, t);
    return { ...np, halt: { ...np.halt, lead: lk || null } };
  }
  /* majority wins, a tie goes to the leader's own pick (partyvote.js rule) */
  function winner(h, leader) {
    const votes = { ...(h.votes || {}) }; if (h.lead) votes[leader] = h.lead;
    const live = (h.opts || []).filter((o) => !o[3]).map((o) => [o[0], o[1], ""]);
    const pv = { opts: live, who: [leader, ...(h.who || [])], votes, leader };
    if (typeof PARTYVOTE !== "undefined") { try { const k = PARTYVOTE.winner(pv); if (k) return k; } catch { /* fall back */ } }
    const n = {}; for (const k of Object.values(votes)) if (live.some((o) => o[0] === k)) n[k] = (n[k] || 0) + 1;
    const top = Math.max(0, ...Object.values(n)), tied = Object.keys(n).filter((k) => n[k] === top);
    return tied.length === 1 ? tied[0] : tied.includes(h.lead) ? h.lead : tied[0] || h.lead || null;
  }
  function settle(p, leader, t = now()) {
    if (typeof PARTYPLAY === "undefined" || !p?.halt || p.halt.kind !== "heist") return { p, key: null };
    const key = winner(p.halt, leader);
    const o = p.halt.opts.find((x) => x[0] === key);
    const np = PARTYPLAY.resolve(PARTYPLAY.pick(p, leader, key, t), leader, `Heist: ${o ? o[1] : key}.`, t);
    return { p: np, key, label: o ? o[1] : key };
  }

  // ---------------------------------------------------------------- screens (browser)
  let ctx = null, voteTimer = null;
  function mount(c) { ctx = c; if (DOM && !mount.on) { mount.on = true; document.addEventListener("click", onClick, true); } }
  const S = () => (ctx ? ctx.S() : null);
  const sections = (l) => (houseAt(l) ? ["heist"] : []);
  const names = () => ({ heist: " Heist" });
  const tierTag = (h) => TIER_NAME[clamp(h.tier - 1, 0, 3)][0];
  function townHTML(s, esc = esc0) {
    const h = houseAt(s.location); if (!h) return { note: "", body: "" };
    const x = st(s), why = blocked(s, s.location), pz = PRIZES[h.prize], r = x.run;
    const note = "Rob a rich household: plan it, get in, past the locked door, grab the prize and get out. Every way through has its price: bounty, corruption in the hold, the fence's cut.";
    const done = x.done[h.id] || 0, mem = role(s) === "member";
    const btn = r && r.id === h.id ? `<button class="btn pri" data-hs="open">${esc(" Carry on with the heist")}</button>`
      : `<button class="btn pri" data-hs="start" ${why ? "disabled" : ""}>${esc(" Plan the heist")}</button>`;
    const stats = x.stats.runs ? `<div class="hz-stats"><span>${esc("Heists")} <b>${x.stats.runs}</b></span><span>${esc("Clean")} <b>${x.stats.clean}</b></span><span>${esc("Caught")} <b>${x.stats.caught}</b></span><span>${esc("Gold")} <b class="gold">${x.stats.gold}</b></span></div>` : "";
    const body = `<div class="hz-card hz-${h.id}"><div class="hz-scene" aria-hidden="true"><span class="hz-moon"></span><span class="hz-roofs"></span><span class="hz-win"></span></div>
      <div class="hz-head"><h3>${esc(h.name[0])}</h3><span class="hz-tier t${h.tier}">${esc(tierTag(h))}</span></div>
      <p class="hz-blurb">${esc(h.blurb[0])}</p>
      <div class="item hz-prize">${typeof ICONART !== "undefined" ? ICONART.item(h.prize, 32) : ""}<div class="t">${esc(pz.name)}<span>${esc(done ? "Taken once already. The house hid the rest better." : "The prize. A fence pays well for it.")}</span></div></div>
      ${why && !(r && r.id === h.id) ? `<p class="sub hz-why">${esc(why)}</p>` : ""}${mem ? `<p class="sub">${esc("In a party your leader plans the heist. Vote when they ask.")}</p>` : ""}
      <div class="hz-btns">${btn}</div>${stats}</div>`;
    return { note, body };
  }
  function tracker(r) {
    return `<ol class="hz-track">${STAGES.map(([en], i) => `<li class="${i < r.stage ? "done" : i === r.stage ? "on" : ""}"><span class="d">${i < r.stage ? "" : i + 1}</span><b>${esc0(en)}</b></li>`).join("")}</ol>`;
  }
  function heatBar(r) {
    const v = clamp(r.heat, 0, 100);
    return `<div class="hz-heat${r.alarm ? " alarm" : v >= 50 ? " warm" : ""}"><span class="l">${esc0(r.alarm ? " The house is on alert!" : "Suspicion")}</span><span class="bar"><i style="width:${r.alarm ? 100 : v}%"></i></span><span class="v">${r.alarm ? "!" : v}</span></div>`;
  }
  function optRow(o, vote) {
    const n = vote ? (vote.tally[o.key] || 0) + (vote.lead === o.key ? 1 : 0) : 0;
    const badge = o.chance != null ? `<span class="hz-ch ${o.chance >= 0.7 ? "hi" : o.chance >= 0.4 ? "mid" : "lo"}">${pct(o.chance)}%</span>` : "";
    return `<button class="hz-opt ${o.cls}${vote?.lead === o.key ? " mine" : ""}" data-hs="do" data-k="${o.key}" ${o.can ? "" : "disabled"}><span class="i">${o.icon}</span><span class="t"><b>${esc0(o.label)}</b><small>${esc0(o.can || !o.why ? o.sub : o.why)}</small></span>${badge}${vote ? `<span class="hz-votes">${n}</span>` : ""}</button>`;
  }
  function voteState() {
    const p = ctx?.party?.(), h = p?.halt;
    if (!h || h.kind !== "heist" || h.done) return null;
    const tl = typeof PARTYPLAY !== "undefined" ? PARTYPLAY.tally(h) : {};
    return { tally: Object.fromEntries(Object.entries(tl).map(([k, v]) => [k, v.length])), lead: h.lead, n: Object.values(tl).reduce((a, v) => a + v.length, 0), of: (h.who || []).length };
  }
  function heistHTML(s) {
    const r = run(s); if (!r) return "";
    const h = BY_ID[r.id], vote = voteState();
    const intro = r.stage === 0 && !r.last ? h.blurb[0] : r.last;
    const vbox = vote ? `<div class="hz-vote"><p>${esc0(` Your party is voting: ${vote.n} of ${vote.of} have voted.`)}</p><p class="sub">${esc0("Tap another choice to change your vote. Most votes win; a tie goes to you.")}</p><div class="hz-btns"><button class="btn pri" data-hs="decide">${esc0("Decide now")}</button></div></div>` : "";
    return `<div class="hz-modal"><div class="hz-top"><h2>${esc0(h.name[0])}</h2><p class="sub">${esc0(h.city)} · ${esc0(tierTag(h))}</p></div>${tracker(r)}${heatBar(r)}
      ${intro ? `<p class="hz-say">${esc0(intro)}</p>` : ""}${vbox}<div class="hz-opts">${options(s).map((o) => optRow(o, vote)).join("")}</div></div>`;
  }
  function endHTML(res, extra = "") {
    const h = BY_ID[res.house], cls = res.outcome === "clean" ? "ok" : res.outcome === "caught" ? "bad" : res.outcome === "quit" ? "" : "warn";
    const title = { clean: " Clean getaway", seen: " Away, but seen", caught: " Caught", quit: " Called it off" }[res.outcome];
    const rows = [res.gold ? [` ${"Gold"}`, `${res.gold}`] : null, res.cut && res.gold ? ["Fence's cut", `${pct(res.cut)}%`] : null,
      res.prize ? ["Prize", PRIZES[res.prize].name] : null, res.bounty ? ["Bounty", `${res.bounty} (${res.hold})`] : null,
      res.deeds?.length ? ["Corruption", res.hold] : null].filter(Boolean);
    return `<div class="hz-modal hz-end ${cls}"><h2>${esc0(title)}</h2><p class="sub">${esc0(h ? h.name[0] : "")}</p>
      ${res.lines.map((l) => `<p class="hz-say">${esc0(l)}</p>`).join("")}${rows.length ? `<div class="hz-sum">${rows.map(([a, b]) => `<div><span>${esc0(a)}</span><b>${esc0(b)}</b></div>`).join("")}</div>` : ""}
      ${extra ? `<p class="sub">${esc0(extra)}</p>` : ""}<button class="btn pri" data-act="close" style="width:100%">${esc0("Continue")}</button></div>`;
  }
  function show() {
    const s = S(); if (!s || !ctx) return;
    const html = heistHTML(s); if (!html) return;
    const m = DOM ? document.querySelector("#modal .hz-modal") : null;
    if (m && !m.classList.contains("hz-end")) m.outerHTML = html; else ctx.openModal(html, "hz");
  }
  const mates = () => { try { return ctx?.mates ? ctx.mates() || [] : []; } catch { return []; } };
  const leading = (s) => role(s) === "leader" && mates().length > 0 && ctx?.Store && ctx.party?.();
  function after(res, before) {
    const s = S();
    let extra = "";
    if (res.res && role(s) === "leader") {
      if (res.res.gold && ctx.splitGold) { const sp = ctx.splitGold(res.res.gold, "the heist"); if (sp) extra = sp; }
      if (res.res.prize && before && typeof LOOTVOTE !== "undefined" && ctx.Store) { try { const rv = LOOTVOTE.roadVote(s, before, mates(), "the heist"); if (rv) { ctx.Store.put("lvotes", rv.id, rv.doc); extra = `${extra} ${rv.text}`.trim(); } } catch { /* fine */ } }
    }
    try { if (typeof SOUND !== "undefined") SOUND.fx(res.res ? (res.res.outcome === "caught" ? "hit" : "coin") : res.ok === false ? "hit" : "click"); } catch { /* optional */ }
    ctx.persist(true); ctx.renderPanel?.(true);
    if (res.end) { if (res.res) ctx.openModal(endHTML(res.res, extra), "hz"); else { ctx.closeModal?.(); ctx.toast(res.text); } return; }
    show();
  }
  /* run one choice: the lock mini-game for a lock, the fight screen for a fight */
  function doAct(key) {
    const s = S(); if (!s) return;
    const r = run(s); if (!r) return;
    const before = typeof LOOTVOTE !== "undefined" ? LOOTVOTE.snap(s) : null;
    const info = (r.stage === 1 || r.stage === 2) ? methodInfo(s, r, key) : r.stage === 4 ? escInfo(s, r, key) : {};
    if (key === "lockpick" && typeof LOCKGAME !== "undefined" && LOCKGAME.wants()) {
      const h = BY_ID[r.id], lt = info.lock;
      ctx.closeModal?.();
      return void LOCKGAME.open({ tier: lt, picks: info.picks, chance: G.lockChance(s, lt), unbreakable: G.P(s, "unbreakable"), skill: G.skill(s, "Lockpicking"), title: r.stage === 1 ? cap(h.way[0]) : cap(h.vault[0]), face: LOCKGAME.faceFor({ tier: lt, rich: h.tier >= 3 }), plate: "door", s }, (res) => {
        const S2 = S();
        if (res.auto) return after(act(S2, "lockpick"), before);
        if (res.opened) return after(act(S2, "lockpick", { lock: true }), before);
        if (res.broken) return after(act(S2, "lockpick", { lock: false }), before);
        show();   // left it alone: nothing happened
      });
    }
    if (info.fight) {
      const go = typeof NOAUTO !== "undefined" ? NOAUTO.call : (fn, done) => done(fn());
      return void go(() => act(S(), key), (out) => { if (out.err) return ctx.toast(out.err); after(out, before); });
    }
    const out = act(s, key);
    if (out.err) return ctx.toast(out.err);
    after(out, before);
  }
  async function choose(key) {
    const s = S(); if (!s) return;
    if (!leading(s) || SHOP.has(key)) return doAct(key);
    const p = ctx.party(), who = p.members.map((m) => m.id).filter((id) => id !== s.id);
    const h = p.halt;
    if (h && h.kind === "heist" && !h.done) await ctx.Store.change("parties", p.id, (x) => (x?.halt ? { ...x, halt: { ...x.halt, lead: key } } : x));
    else await ctx.Store.change("parties", p.id, (x) => (x ? openVote(x, s.id, s, who, key) : x));
    show();
    clearInterval(voteTimer);
    voteTimer = setInterval(() => { if (!document.querySelector("#modal .hz-modal:not(.hz-end)")) { clearInterval(voteTimer); return; } show(); }, 1500);
  }
  async function decide() {
    const s = S(), p = ctx.party?.(); clearInterval(voteTimer);
    if (!s || !p) return;
    let out = null;
    await ctx.Store.change("parties", p.id, (x) => { if (!x) return x; const r = settle(x, s.id); out = r; return r.p; });
    if (!out?.key) return show();
    ctx.toast(`The party picked: ${out.label}.`);
    doAct(out.key);
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest("[data-hs]");
    if (!b || !ctx) return;
    e.preventDefault(); e.stopPropagation();
    const s = S(), k = b.dataset.hs; if (!s) return;
    if (k === "start") {
      const r = start(s, 1 + mates().length);
      if (r.err) return void ctx.toast(r.err);
      ctx.persist(true); ctx.renderPanel?.(true); return void show();
    }
    if (k === "open") return void show();
    if (k === "do") return void choose(b.dataset.k);
    if (k === "decide") return void decide();
  }

  /* Polish lines for i18n_heists.js: every fixed line built from the tables above */
  function plPairs() {
    const out = [...STAGES, ...TIER_NAME, ...LOCK_NAME.map(([e, p]) => [`${e} lock`, `Zamek ${p}`])];
    for (const h of Object.values(HOUSES)) out.push(h.name, h.blurb, h.way, h.wayWho, h.vault, h.vaultWho, h.guard, [cap(h.way[0]), cap(h.way[1])], [cap(h.vault[0]), cap(h.vault[1])], [cap(h.wayWho[0]), cap(h.wayWho[1])]);
    for (const p of Object.values(PRIZES)) out.push([p.name, p.pl], [p.desc, p.dpl], ...splitPairs(p.desc, p.dpl));
    for (const p of Object.values(TOOLS)) out.push([p.name, p.pl], [p.desc, p.dpl], ...splitPairs(p.desc, p.dpl));
    for (const h of Object.values(HOUSES)) out.push(...splitPairs(h.blurb[0], h.blurb[1]));
    return out;
  }
  /* two-sentence lines also go in sentence by sentence (the screen translator splits them) */
  function splitPairs(en, pl) {
    const a = en.split(/(?<=[.!?])\s+/), b = pl.split(/(?<=[.!?])\s+/);
    return a.length === b.length && a.length > 1 ? a.map((x, i) => [x, b[i]]) : [];
  }

  return { HOUSES, BY_ID, PRIZES, TOOLS, STAGES, COOLDOWN, HEAT_ALARM, CUT_BASE, CUT_MIN, TAKE, PERK_ADD, PERK_ADJ, NEED,
    st, migrate, houseAt, blocked, start, run, options, methodInfo, escInfo, act, finish, quit, goodsValue, bribeCost, toolPrice, fenceCut, lockTier, picks, check, guardFoe,
    optsForVote, openVote, winner, settle, mount, sections, names, townHTML, heistHTML, endHTML, plPairs, fmtTime };
})();
