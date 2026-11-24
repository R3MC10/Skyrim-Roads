/* sidequest.js: "Pick a Side", the level-20 quest that makes you choose Stormcloaks, Imperial Legion or Aldmeri Dominion. [OURS]
   Remigiusz: at level 20 players get a QUEST to pick a side, not just a popup.
   - At level 20 (or on the next load for players already past it) a courier brings three letters, and the quest
     "Pick a Side" lands in the Journal (Civil War section). It sends you to the three recruiters: Galmar Stone-Fist in
     Windhelm, Legate Rikke in Solitude and First Emissary Elenwen at the Thalmor Embassy. The tracked target is the
     nearest recruiter you haven't heard yet.
   - At a recruiter the first tap is their pitch; the Journal button then reads "Swear to …" and joining finishes the quest:
     300 gold and the side's first cloak (cloaks.js), put on at once. Hearing all three is up to you; joining any of them is enough.
   - The quest is the only way in (sideui.js shows the courier's letter and a confirm before the oath). Switching later
     is done at the new side's recruiter from the Faction tab and costs gold, a week and your rank (sides.js).
   - LEVELUP.on / the "levelup" DOM event start it at once when another module fires them (levelup branch); QUESTS.ensure
     (on load, and every few seconds from the ui tick) is the fallback. */
const SIDEQ = (() => {
  const ID = "cw_choice";
  const GOLD = 300;
  const REC = {
    stormcloak: { place: "Windhelm", who: "Galmar Stone-Fist", gear: "cloak_sc_1",
      hear: "Hear Galmar out", swear: "Swear to the Stormcloaks",
      pitch: "Galmar looks you over. \"Ulfric doesn't need more farmers with pitchforks. He needs fighters who'll stand in the snow and not run. The Empire sold Talos to the elves for a peace that was never peace. Fight with us and Skyrim is ours again.\"",
      vet: "\"You've already bled for Ulfric once. That counts here.\"" },
    imperial: { place: "Solitude", who: "Legate Rikke", gear: "cloak_il_1",
      hear: "Hear Legate Rikke out", swear: "Swear to the Imperial Legion",
      pitch: "Rikke taps a map of Skyrim. \"Ulfric would tear the Empire apart and hand the pieces to the Thalmor. The Legion keeps the roads safe and the law the same in every hold. We pay on time, too. Sign up and you'll have a whole army at your back.\"",
      vet: "\"You've marched with us before. The General hasn't forgotten.\"" },
    thalmor: { place: "Thalmor Embassy", who: "First Emissary Elenwen", gear: "cloak_ad_1",
      hear: "Hear Elenwen out", swear: "Swear to the Aldmeri Dominion",
      pitch: "Elenwen smiles without warmth. \"Humans fight over a frozen rock while the world turns. The Dominion thinks in centuries. Serve us, and you'll learn magic the College only dreams of, and stand with the winners when these little wars are over.\"",
      vet: "" },
  };
  const SIDE_IDS = Object.keys(REC);
  const LETTER = "A courier finds you on the road with three sealed letters: one stamped with Ulfric's bear, one with the Legion's dragon, one with the Thalmor's gold eagle. Each side wants you. Visit their recruiters, hear them out, and pick one.";
  const q = (s) => (s.quests = s.quests || {});
  const v = (s) => q(s)[ID] || null;
  const recAt = (place) => SIDE_IDS.find((id) => REC[id].place === place) || null;
  const heard = (s) => { const x = v(s); return (x && x.heard) || {}; };
  /* the recruiter to show: the one you're standing at, else the nearest you haven't heard, else the nearest */
  function next(s) {
    const here = recAt(s.location); if (here) return here;
    const h = heard(s), pos = [s.x || 0, s.y || 0];
    const dist = (id) => { const p = typeof WORLD !== "undefined" && WORLD.places[REC[id].place]; return p ? Math.hypot(p[0] - pos[0], p[1] - pos[1]) : 1e9; };
    const by = (list) => list.slice().sort((a, b) => dist(a) - dist(b))[0];
    return by(SIDE_IDS.filter((id) => !h[id])) || by(SIDE_IDS);
  }
  const listText = (s) => SIDE_IDS.map((id) => `${heard(s)[id] ? "✓" : "•"} ${REC[id].who} (${REC[id].place})`).join(" · ");
  const STAGE = { title: "Three Letters", text: "", obj: {}, reward: { gold: GOLD } };
  /* the stage as the Journal sees it: target, button label and text follow where you are */
  function stageFor(s) {
    const id = next(s), r = REC[id], h = heard(s)[id];
    return { ...STAGE, text: `${LETTER} ${listText(s)}.`, obj: { talk: r.place, label: h ? r.swear : r.hear, side: id }, reward: { gold: GOLD, items: [r.gear] } };
  }
  const L = { [ID]: { name: "Pick a Side", giver: "A courier with three letters", side: "any", stages: [STAGE] } };
  /* start it (level 20+, no side yet); finish it quietly if you already have a side. Returns a note or null */
  function sync(s) {
    if (typeof SIDES === "undefined" || !s) return null;
    const x = v(s);
    if (SIDES.mine(s)) { if (x && !x.done) { x.done = true; x.stage = 1; } return null; }
    if (x || (s.level || 1) < SIDES.MIN_LEVEL) return null;
    q(s)[ID] = { stage: 0, t: typeof G !== "undefined" ? G.now() : Date.now() / 1000, heard: {} };
    const m = "📜 New quest: Pick a Side. A courier brought letters from the Stormcloaks, the Imperial Legion and the Aldmeri Dominion (Journal).";
    if (typeof G !== "undefined" && G.note && s.journal) G.note(s, m);
    return m;
  }
  /* a tap at a recruiter: first their pitch, then (heard) the oath. Returns { text, msgs?, joined?, side } */
  function talk(s, t) {
    const x = v(s); if (!x || x.done) return { text: "Nothing to do." };
    const id = recAt(s.location);
    if (!id) { const n = next(s); return { text: `Go to ${REC[n].place} first.` }; }
    const r = REC[id];
    const vet = typeof CIVILWAR !== "undefined" && CIVILWAR.side(s) === id && r.vet ? ` ${r.vet}` : "";
    if (!x.heard || !x.heard[id]) { x.heard = { ...(x.heard || {}), [id]: true }; return { text: `${r.who}: ${r.pitch}${vet}`, side: id, pitch: true }; }
    const res = SIDES.pick(s, id, t);
    if (res.err) return { text: res.err, side: id };
    const msgs = [];
    QUESTS.advance(s, ID, msgs);   // 300 gold, "done"
    if (typeof SIDECLOAK !== "undefined") { SIDECLOAK.grant(s); const w = SIDECLOAK.wearBest(s); msgs.splice(1, 0, `You got: ${D.ITEMS[r.gear].name}${w ? " (you put it on)" : ""}. Wear it to earn rank XP for your side.`); }
    return { text: res.text, msgs, joined: true, side: id };
  }
  /* Journal emblem: three little banners ([OURS] art) */
  function emblem(g) {
    if (typeof SIDES === "undefined" || typeof Path2D === "undefined") return;
    [["imperial", 8, 0.62], ["thalmor", 32, 0.62], ["stormcloak", 20, 0.8]].forEach(([id, x, r]) => SIDES.drawEmblem(g, id, x, 22, 15 * r * 0.9));
  }
  if (typeof QUESTS !== "undefined") {
    L[ID].emblem = emblem;
    QUESTS.L[ID] = L[ID]; QUESTS.REC[ID] = [20];
    const ensure0 = QUESTS.ensure, check0 = QUESTS.check, talk0 = QUESTS.talk, active0 = QUESTS.active;
    QUESTS.ensure = (s) => { ensure0(s); sync(s); };
    QUESTS.check = (s) => { const m = check0(s); const n = sync(s); const c = typeof SIDECLOAK !== "undefined" ? SIDECLOAK.grant(s) : []; return [...m, ...(n ? [n] : []), ...c]; };   // + a new cloak at each rank
    QUESTS.talk = (s, id, t) => (id === ID ? talk(s, t) : talk0(s, id, t));
    if (active0) QUESTS.active = (s) => active0(s).map((a) => (a.id === ID ? { ...a, st: stageFor(s) } : a));
  }
  /* a level-up module, if there is one, starts the quest at once (the ui tick catches it within seconds otherwise) */
  const onLevel = (s) => { try { if (s && typeof QUESTS !== "undefined") QUESTS.ensure(s); } catch (e) { /* ignore */ } };
  if (typeof LEVELUP !== "undefined" && LEVELUP && typeof LEVELUP.on === "function") { try { LEVELUP.on("level", (e) => onLevel(e && e.s ? e.s : e)); } catch (e) { /* ignore */ } }   // levelup.js: LEVELUP.on("level", ({ s, level }) => ...)
  return { ID, GOLD, REC, SIDE_IDS, LETTER, L, next, heard, stageFor, sync, talk, recAt, onLevel, active: (s) => { const x = v(s); return !!x && !x.done; } };
})();
if (typeof module !== "undefined") module.exports = SIDEQ;
