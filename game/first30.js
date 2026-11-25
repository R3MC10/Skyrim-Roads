/* The first 30 minutes (first30.js). [OURS]
   A new character gets one guided quest line, "Before the Storm", instead of a welcome popup and a wall of tips.
   One goal at a time, shown as the tracked quest (map, HUD, Journal) and as a small goal card on the Travel and Area
   screens with a single button that does the next thing:
     0  Trouble at the Mill   an easy bandit in Riverwood (attack, read his next move, guard his big blow)  ~minute 1-5
     1  A Better Fit          put on the leather armour he dropped and watch the paper doll change          ~5-8
     2  On to Whiterun        the first trip (the main quest's old first stage)                             ~8-13
     3  The Jarl's Ear        meet the Jarl; Irileth spars with you: your best fighting skill rises, level 2 ~13-15
     4  Growing Stronger      spend the level-up and the first perk point                                   ~15-18
     5  The Bandit Chief      a weak elite at Chillfurrow Farm that winds up big blows (bossfight.js shows them) ~18-25
     6  Word Spreads          back to the Jarl: gold, a steel weapon, potions, and what comes next          ~25-30
   When the line ends the main quest picks up at Bleak Falls Barrow. "Skip the tutorial" on the card (or an existing
   character) goes straight to the main quest. ?notut (screen tests) never starts it.
   quests.js runs the stages (obj.test, reward.run, the line's `then`); onboard.js shows the fight hints. */
const FIRST30 = (() => {
  const ID = "opening";
  const DOM = typeof document !== "undefined";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const q = (s) => (s.quests = s.quests || {});
  /* quest foes, tuned with tests/test_first30.js (every race wins, nobody is one-shot either way) */
  const FOE = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 1, danger: "medium", gold: [0, 0], text: "", qboss: tags.includes("elite"), ...extra });
  const LOOKOUT = FOE("Bandit lookout", 85, 6, ["humanoid"], { teach: "windup", noGroup: true, text: "A bandit is shaking down the mill workers." });
  const CHIEF = FOE("Krev the Skinner", 85, 12, ["humanoid", "elite"], { arch: "brute", archLabel: "brute", noGroup: true, text: "\"Whiterun sends a pup?\" The bandit chief hefts a heavy axe." });
  const chestArmor = (s) => { try { const r = G.equipment(s).chest; return r ? (D.ITEMS[r.item]?.armor || 0) : 0; } catch { return 0; } };
  const owns = (s, item) => (s.inv || []).some((r) => r.item === item);
  const FIGHT_SKILLS = ["One-Handed", "Two-Handed", "Archery", "Destruction", "Block"];
  const bestSkill = (s) => FIGHT_SKILLS.filter((k) => s.skills && s.skills[k]).sort((a, b) => s.skills[b].lvl - s.skills[a].lvl)[0] || "One-Handed";
  /* Irileth's sparring: your best fighting skill goes up until you reach level 2 (at least once) */
  function lesson(s) {
    const sk = bestSkill(s), from = s.skills[sk].lvl;
    for (let i = 0; i < 8 && (i === 0 || s.level < 2); i++) G.raiseSkill(s, sk);
    return ` Irileth spars with you: ${sk} ${from} → ${s.skills[sk].lvl}.${s.pendingLevels > 0 ? " Level up!" : ""}`;
  }
  /* the last reward: a steel weapon of the kind you fight with, plus potions */
  function weaponFor(s) {
    let w = null; try { w = G.equipment(s).weapon; } catch { /* no gear */ }
    const it = w && D.ITEMS[w.item];
    if (it && it.skill === "Archery") return "hunting_bow";
    if (it && it.hands === 2) return "steel_battleaxe";
    return "steel_sword";
  }
  function finale(s) {
    const id = weaponFor(s);
    if (D.ITEMS[id]) G.give(s, id);
    if (D.ITEMS.potion_health) G.give(s, "potion_health", 2);
    return ` You also get a ${D.ITEMS[id]?.name || "weapon"} and 2 Potions of Healing.`;
  }
  /* what's next once the line is done: the next thing to open up (unlocks.js), or the main quest */
  function nextUnlock(s) {
    try {
      if (typeof UNLOCKS !== "undefined" && UNLOCKS.next) { const n = UNLOCKS.next(s, 1)[0]; if (n) return { name: n.name || n.id, level: n.level }; }
    } catch { /* not there yet */ }
    return null;
  }
  const LINE = { name: "Before the Storm", giver: "Alvor, Riverwood", opening: true, stages: [
    { title: "Trouble at the Mill", text: "A bandit is shaking down the workers at Riverwood's mill. Chase him off.",
      obj: { talk: "Riverwood", label: "Chase off the bandit", fight: LOOKOUT, nonlethal: "retry", loseText: "The bandit knocks you down and runs off laughing. Catch your breath and try again: you lose nothing.", winText: "The bandit drops his gear and runs for the hills." }, reward: { gold: 15, items: ["leather_armor"] } },
    { title: "A Better Fit", text: "The bandit dropped leather armour, better than your hide. Put it on.",
      obj: { test: (s) => chestArmor(s) >= (D.ITEMS.leather_armor?.armor || 26) || !owns(s, "leather_armor") } },
    { title: "On to Whiterun", text: "Alvor says the Jarl of Whiterun must hear about the dragon. Walk to Whiterun.",
      obj: { go: "Whiterun" }, reward: { gold: 50 } },
    { title: "The Jarl's Ear", text: "Tell Jarl Balgruuf about the dragon in Dragonsreach.",
      obj: { talk: "Whiterun", label: "Warn the Jarl" }, reward: { run: lesson } },
    { title: "Growing Stronger", text: "You reached level 2. Choose what grows, then spend your perk point on a skill you use.",
      obj: { test: (s) => !(s.pendingLevels > 0) && (typeof PERKS === "undefined" || PERKS.pointsLeft(s) <= 0) } },
    { title: "The Bandit Chief", text: "The Jarl wants the bandit chief at Chillfurrow Farm gone. He winds up huge blows: guard when he does.",
      obj: { talk: "Chillfurrow Farm", label: "Face the bandit chief", fight: CHIEF, nonlethal: "retry", loseText: "Krev knocks you flat and laughs. Get your breath back and try again: you lose nothing.", winText: "Krev the Skinner falls. The farm is safe." }, reward: { gold: 40 } },
    { title: "Word Spreads", text: "Go back to the Jarl in Whiterun for your reward.",
      obj: { talk: "Whiterun", label: "See the Jarl" }, reward: { gold: 150, run: finale } },
  ], then: done };
  /* the line is over: the main quest goes on from Bleak Falls Barrow */
  function done(s, msgs) {
    const v = q(s).main;
    if (!v) q(s).main = { stage: 1, t: G.now(), bf: 1 };
    s.trackQ = "main";
    const nx = nextUnlock(s);
    msgs.push(` Next: Bleak Falls Barrow (main quest).${nx ? ` Coming up: ${nx.name}${nx.level ? ` at level ${nx.level}` : ""}.` : ""}`);
  }
  if (typeof QUESTS !== "undefined") { QUESTS.L[ID] = LINE; QUESTS.REC[ID] = [1, 1, 1, 1, 1, 2, 2]; }

  // ------------------------------------------------------------------ state
  const v = (s) => s && s.quests && s.quests[ID];
  const active = (s) => !!(v(s) && !v(s).done);
  const stage = (s) => (active(s) ? v(s).stage : -1);
  /* a new character: the opening instead of the main quest's first stage */
  function start(s) {
    if (!s || q(s)[ID]) return false;
    if (q(s).main && (q(s).main.stage > 0 || q(s).main.done)) return false;
    delete q(s).main;
    q(s)[ID] = { stage: 0, t: G.now() };
    s.trackQ = ID;
    return true;
  }
  /* How to Play can replay it only on a fresh hero */
  const canStart = (s) => !!s && !q(s)[ID] && (s.level || 1) <= 2 && !(q(s).main && (q(s).main.stage > 0 || q(s).main.done));
  /* skip: straight to the main quest (from Bleak Falls Barrow once you've reached Whiterun) */
  function skip(s) {
    const o = v(s); if (!o || o.done) return false;
    const past = o.stage > 2;
    o.done = true; o.skipped = true;
    if (!q(s).main) q(s).main = { stage: past ? 1 : 0, t: G.now(), bf: 1 };
    if (s.trackQ === ID) s.trackQ = "main";
    return true;
  }

  // ------------------------------------------------------------------ the goal card
  let bound = null, sig = "";
  const eta = (s, place) => { try { const d = G.pxDist([s.x, s.y], WORLD.places[place]); return d > 0 ? Math.max(1, Math.round(d / (D.BASE_WALK || 17))) : 0; } catch { return 0; } };
  /* the one button: what to press for this step right now. Pure (node tests call it). {label, act, attrs} or null */
  function action(s) {
    if (!active(s)) return null;
    const st = LINE.stages[stage(s)], o = st.obj;
    const travel = !!(s.trip && s.trip.status === "travel");
    const at = o.talk || o.go;
    if (at && s.location !== at) return travel ? null : { label: `Go to ${at}`, act: "go", attrs: `data-place="${esc(at)}"` };
    if (o.talk) return { label: o.label, act: "qtalk", attrs: `data-id="${ID}"` };
    if (stage(s) === 1) return { label: "Put it on", act: "f30", attrs: `data-f30="gear"` };
    if (stage(s) === 4) return s.pendingLevels > 0 ? { label: "Level up", act: "f30", attrs: `data-f30="level"` } : { label: "Pick a perk", act: "f30", attrs: `data-f30="perks"` };
    return null;
  }
  /* the step's text, the "on the way" line, the one button and Skip: shared by the phone card and the PC tracker */
  function body(s) {
    const i = stage(s), st = LINE.stages[i], a = action(s);
    const travel = !!(s.trip && s.trip.status === "travel");
    const at = st.obj.talk || st.obj.go, mins = travel && at ? eta(s, at) : 0;
    const sub = travel && at && s.location !== at ? `<p class="f30eta">On the way to ${esc(at)}${mins ? ` · about ${mins} min` : ""}</p>` : "";
    return { i, st, html: `<p>${esc(st.text)}</p>${sub}
      <div class="f30b">${a ? `<button class="btn pri" data-act="${a.act}" ${a.attrs}>${esc(a.label)}</button>` : ""}<button class="linkbtn" data-f30="skip">${esc("Skip the tutorial")}</button></div>` };
  }
  function cardHTML(s, tab = "map") {
    if (!active(s) || (tab !== "map" && tab !== "town")) return "";
    const { i, st, html } = body(s);
    return `<div class="tut f30card" id="f30goal" role="region" aria-label="Your goal">
      <div class="tut-h"><b>${esc(st.title)}</b><span class="sub">${esc(`Step ${i + 1} of ${LINE.stages.length}`)}</span></div>
      ${html}</div>`;
  }
  /* PC: the side panel is hidden behind the big map there, so the same goal sits inside the quest tracker (pcmap.js) */
  function pcHTML(s) {
    if (!active(s)) return "";
    const { i, html } = body(s);
    return `<div class="f30pc" id="f30pc" role="region" aria-label="Your goal"><span class="f30step">${esc(`Step ${i + 1} of ${LINE.stages.length}`)}</span>${html}</div>`;
  }
  /* a click in the PC tracker: true when it was ours */
  function pcClick(e) {
    const b = e.target.closest && e.target.closest("#f30pc [data-f30], #f30pc [data-act]"); if (!b || !bound) return false;
    if (b.dataset.f30) onClick(e); else { try { bound.click({ target: b }); } catch (er) { console.warn("first30", er); } }
    return true;
  }
  /* taps on the card that aren't ordinary panel acts */
  function onClick(e) {
    const b = e.target.closest("[data-f30]"); if (!b || !bound) return;
    e.stopPropagation();
    const s = bound.S(); if (!s) return;
    const k = b.dataset.f30, fake = (act, data = {}) => { const x = document.createElement("button"); x.dataset.act = act; Object.assign(x.dataset, data); try { bound.click({ target: x }); } catch (er) { console.warn("first30", er); } };
    if (k === "skip") { skip(s); bound.persist?.(true); bound.toast?.("Tutorial skipped. Your quest goes on in the Journal."); bound.renderPanel?.(true); return; }
    if (k === "gear") {   // the items menu with the paper doll, and the chest slot's picker on top
      bound.openMenu?.("items");
      setTimeout(() => fake("dollslot", { slot: "chest" }), 250);
      return;
    }
    if (k === "level") { if (typeof LEVELUP !== "undefined" && LEVELUP.open(() => { if (s.pendingLevels <= 0 && PERKS.pointsLeft(s) > 0) fake("tabgo", { id: "perks" }); })) return; }
    if (k === "level" || k === "perks") fake("tabgo", { id: "perks" });
  }
  /* the card re-draws when the step changes (a tick, not a hook in every screen) */
  function tick() {
    if (!bound) return;
    const s = bound.S(); if (!s) return;
    const now = active(s) ? `${stage(s)}|${s.location}|${s.trip ? s.trip.status : ""}|${s.pendingLevels || 0}` : "off";
    if (now !== sig) { const was = sig; sig = now; if (was) bound.renderPanel?.(true); }
  }
  function mount(b) {
    bound = b;
    if (!DOM) return;
    const side = document.getElementById("side");
    if (side) side.addEventListener("click", onClick, true);
    setInterval(() => { try { tick(); } catch { /* layout only */ } }, 1000);
  }
  return { ID, LINE, LOOKOUT, CHIEF, active, stage, start, canStart, skip, action, cardHTML, pcHTML, pcClick, mount, bestSkill, weaponFor, chestArmor };
})();
