/* [Skyrim] The Civil War: join the Imperial Legion in Solitude or the Stormcloaks in Windhelm (never both), then
   fight for the holds one by one. Each battle won turns a hold to your side: a new Jarl sits in its hall, and its
   guards talk differently to you. Story beats follow Skyrim's questline, retold in our own words; [OURS] the forts
   chosen for each hold battle and the numbers. */
const CIVILWAR = (() => {
  const E = (name, health, damage, tags, extra = {}) => ({ name, health, damage, tags, level: 10, danger: "high", gold: [0, 0], text: "", ...extra });
  Object.assign(D.ITEMS, {   // [Skyrim] officer gear, worn by the side's best ([OURS] enchantments)
    imperial_officer_helmet: { name: "Imperial Officer's Helmet", slot: "head", type: "heavy", armor: 21, weight: 4, value: 800, aenchant: { key: "max:health", mag: 30, name: "Fortify Health" } },
    stormcloak_officer_armor: { name: "Stormcloak Officer Armor", slot: "chest", type: "heavy", armor: 33, weight: 25, value: 900, aenchant: { key: "max:stamina", mag: 30, name: "Fortify Stamina" } },
  });
  const SIDES = { imperial: { name: "the Empire", army: "Imperial Legion", short: "Imperials", line: "cw_imperial" },
    stormcloak: { name: "the Stormcloaks", army: "Stormcloaks", short: "Stormcloaks", line: "cw_stormcloak" } };
  const enemyOf = (side) => (side === "imperial" ? "stormcloak" : "imperial");
  // [Skyrim] who holds what when the story starts; Whiterun keeps out of it until the battle comes to its gates
  const START = { Haafingar: "imperial", Hjaalmarch: "imperial", "The Reach": "imperial", Falkreath: "imperial", Whiterun: "neutral",
    Eastmarch: "stormcloak", Winterhold: "stormcloak", "The Pale": "stormcloak", "The Rift": "stormcloak" };
  // [Skyrim] the Jarl each side puts in each hall ([OURS] Galmar keeps the Blue Palace for Ulfric)
  const JARLS = {
    Haafingar: { imperial: "Elisif the Fair", stormcloak: "Galmar Stone-Fist" }, Hjaalmarch: { imperial: "Sorli the Builder", stormcloak: "Idgrod Ravencrone" },
    "The Reach": { imperial: "Igmund", stormcloak: "Thongvor Silver-Blood" }, Falkreath: { imperial: "Siddgeir", stormcloak: "Dengeir of Stuhn" },
    Whiterun: { imperial: "Balgruuf the Greater", stormcloak: "Vignar Gray-Mane", neutral: "Balgruuf the Greater" },
    Eastmarch: { imperial: "Brunwulf Free-Winter", stormcloak: "Ulfric Stormcloak" }, Winterhold: { imperial: "Kraldar", stormcloak: "Korir" },
    "The Pale": { imperial: "Brina Merilis", stormcloak: "Skald the Elder" }, "The Rift": { imperial: "Maven Black-Briar", stormcloak: "Laila Law-Giver" },
  };
  const battle = (place, hold, foe, allies, rec, title, text) => ({ title, text, rec, wins: [hold], obj: { talk: place, label: `Join the battle for ${place}`, fight: foe, allies }, reward: { gold: 150 + rec * 15 } });
  const L = {
    cw_imperial: { name: "The Civil War: for the Empire", giver: "Legate Rikke, Castle Dour, Solitude", start: "Solitude", side: "imperial", stages: [
      { title: "Joining the Legion", rec: 6, text: "Legate Rikke wants proof you can fight. Bandits hold Fort Hraggstad: clear it and the Legion will take you.", obj: { clear: "Fort Hraggstad" }, reward: { gold: 100 } },
      { title: "The Jagged Crown", rec: 8, text: "Ulfric wants the crown of the old High Kings to make his claim. Get there first: it rests in the barrow of Volunruud.", obj: { clear: "Volunruud" }, reward: { gold: 200 } },
      { title: "Message to Whiterun", rec: 9, text: "Carry General Tullius's letter to Jarl Balgruuf. Whiterun must choose a side.", obj: { talk: "Whiterun", label: "Give Balgruuf the letter" }, reward: { gold: 100 } },
      battle("Whiterun", "Whiterun", E("Stormcloak assault", 260, 18, ["humanoid", "elite"]), [["Legate Rikke", 10], ["Whiterun guard", 6], ["Legionnaire", 6]], 10,
        "The Battle for Whiterun", "Ulfric's army marches on Whiterun. Hold the walls with the Legion and Balgruuf's guards."),
      battle("Fort Dunstad", "The Pale", E("Stormcloak garrison", 290, 20, ["humanoid", "elite"]), [["Legate Rikke", 11], ["Legionnaire", 7], ["Legionnaire", 7]], 12,
        "Liberation of the Pale", "Take Fort Dunstad from the Stormcloaks and the Pale is ours."),
      battle("Fort Kastav", "Winterhold", E("Stormcloak garrison", 310, 21, ["humanoid", "elite"]), [["Legate Rikke", 12], ["Legionnaire", 7], ["Legionnaire", 7]], 14,
        "Liberation of Winterhold", "Imperial prisoners are held in Fort Kastav. Free them and take the fort."),
      battle("Fort Greenwall", "The Rift", E("Stormcloak garrison", 330, 22, ["humanoid", "elite"]), [["Legate Rikke", 12], ["Legionnaire", 8], ["Legionnaire", 8]], 16,
        "Liberation of the Rift", "The Rift is the last hold Ulfric has besides his own. Storm Fort Greenwall."),
      { title: "The Battle for Windhelm", rec: 18, wins: ["Eastmarch"], text: "Break through the gates of Windhelm, fight to the Palace of the Kings and end the rebellion.",
        obj: { talk: "Windhelm", label: "Storm the Palace of the Kings", fight: E("Ulfric Stormcloak and Galmar", 400, 27, ["humanoid", "elite"]), allies: [["General Tullius", 12], ["Legate Rikke", 12], ["Legionnaire", 8]] },
        reward: { gold: 1500, items: ["imperial_officer_helmet"], flag: "cwImperial", title: "Legate of the Imperial Legion" } },
    ] },
    cw_stormcloak: { name: "The Civil War: for the Stormcloaks", giver: "Galmar Stone-Fist, Palace of the Kings, Windhelm", start: "Windhelm", side: "stormcloak", stages: [
      { title: "The Oath", rec: 6, text: "Galmar won't take you until you've killed an ice wraith on the Serpent's Bluff. Go to the Serpent Stone.", obj: { talk: "The Serpent Stone", label: "Hunt the ice wraith", fight: E("Ice wraith", 150, 13, ["beast"]) }, reward: { gold: 100 } },
      { title: "The Jagged Crown", rec: 8, text: "Ulfric needs the crown of the old High Kings to claim the throne. It rests in the barrow of Volunruud. Clear it.", obj: { clear: "Volunruud" }, reward: { gold: 200 } },
      { title: "Message to Whiterun", rec: 9, text: "Carry Ulfric's axe to Jarl Balgruuf: an offer, or a declaration of war.", obj: { talk: "Whiterun", label: "Give Balgruuf Ulfric's axe" }, reward: { gold: 100 } },
      battle("Whiterun", "Whiterun", E("Whiterun's defenders", 260, 18, ["humanoid", "elite"]), [["Galmar Stone-Fist", 10], ["Stormcloak soldier", 6], ["Stormcloak soldier", 6]], 10,
        "The Battle for Whiterun", "Balgruuf sided with the Empire. Break the barricades and take the city."),
      battle("Fort Sungard", "The Reach", E("Imperial garrison", 290, 20, ["humanoid", "elite"]), [["Galmar Stone-Fist", 11], ["Stormcloak soldier", 7], ["Stormcloak soldier", 7]], 12,
        "Liberation of the Reach", "Take Fort Sungard and Markarth's Jarl falls with it."),
      battle("Fort Neugrad", "Falkreath", E("Imperial garrison", 310, 21, ["humanoid", "elite"]), [["Galmar Stone-Fist", 12], ["Stormcloak soldier", 7], ["Stormcloak soldier", 7]], 14,
        "Liberation of Falkreath", "Fort Neugrad guards the south. Take it."),
      battle("Fort Snowhawk", "Hjaalmarch", E("Imperial garrison", 330, 22, ["humanoid", "elite"]), [["Galmar Stone-Fist", 12], ["Stormcloak soldier", 8], ["Stormcloak soldier", 8]], 16,
        "Liberation of Hjaalmarch", "Fort Snowhawk is the Empire's last stand before Solitude. Take it."),
      { title: "The Battle for Solitude", rec: 18, wins: ["Haafingar"], text: "March on Solitude, fight up to Castle Dour and face General Tullius.",
        obj: { talk: "Solitude", label: "Storm Castle Dour", fight: E("General Tullius and Legate Rikke", 400, 27, ["humanoid", "elite"]), allies: [["Ulfric Stormcloak", 13], ["Galmar Stone-Fist", 12], ["Stormcloak soldier", 8]] },
        reward: { gold: 1500, items: ["stormcloak_officer_armor"], flag: "cwStormcloak", title: "Stormblade" } },
    ] },
  };
  const LINES = Object.keys(L);

  // ---- your side and the holds
  const side = (s) => { const q = s.quests || {}; return q.cw_imperial ? "imperial" : q.cw_stormcloak ? "stormcloak" : null; };
  const line = (s) => { const sd = side(s); return sd ? (s.quests || {})[SIDES[sd].line] : null; };
  /* who holds a hold for this player: the start, plus every hold your battles have won (all of them once the war is won) */
  function control(s, hold) {
    const sd = side(s), v = line(s), base = START[hold] || "neutral";
    if (!sd || !v) return base;
    if (v.done) return sd;
    const st = L[SIDES[sd].line].stages;
    for (let i = 0; i < Math.min(v.stage, st.length); i++) if ((st[i].wins || []).includes(hold)) return sd;
    return base;
  }
  const jarl = (s, hold) => (JARLS[hold] || {})[control(s, hold)] || null;
  const won = (s) => { const v = line(s); return !!v?.done; };
  function townLine(s, place) {
    if (!WORLD.places[place] || !["city", "town"].includes(WORLD.places[place][2])) return "";
    const hold = G.holdAt(WORLD.places[place]), c = control(s, hold), j = JARLS[hold]?.[c], sd = side(s);
    if (!j) return "";
    const who = c === "neutral" ? "keeps out of the war" : `holds ${hold} for ${SIDES[c].name}`;
    const mine = sd && c === sd ? " · your side" : sd && c !== "neutral" ? " · enemy hold" : "";
    return `<p class="sub cw-hold"><span class="cw-flag cw-${c}"></span>Jarl ${esc(j)} ${who}${mine}.</p>`;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // ---- guard talk that follows the war
  const BARKS = {
    imperial: { friend: ["Hail, soldier. The Legion's glad of you.", "For the Empire!", "Keep your sword sharp. The Stormcloaks won't quit easy."],
      foe: ["Imperial dog. You're a long way from Solitude.", "We know who you march with. Watch yourself.", "Skyrim belongs to the Nords, not your Emperor."] },
    stormcloak: { friend: ["Skyrim belongs to the Nords! Good to see you, brother.", "Talos guide you, Stormcloak.", "Ulfric's lucky to have you."],
      foe: ["Rebel scum. Keep walking.", "Another of Ulfric's thugs. Don't start anything here.", "The Legion will have you hanged one day."] },
  };
  /* lines for a guard in this place; replace=true when the town's own line names the old side or Jarl */
  function barks(s, place) {
    const p = WORLD.places[place]; if (!p) return { lines: [], replace: false };
    const hold = G.holdAt(p), c = control(s, hold), sd = side(s), j = JARLS[hold]?.[c], lines = [];
    if (j && c !== "neutral") lines.push(`${hold} stands with ${SIDES[c].name} now. Jarl ${j} rules here.`);
    if (sd && c !== "neutral") lines.push(...(c === sd ? BARKS[sd].friend : BARKS[sd].foe));
    if (won(s)) lines.push(sd === "imperial" ? "The war's over. Ulfric's dead, and the Empire holds Skyrim." : "Ulfric is High King now. Skyrim is free!");
    return { lines, replace: c !== START[hold] };
  }

  // ---- hooks into the Journal: one side only
  function gate(s, id) {
    if (!L[id]) return null;
    const sd = side(s);
    if (sd && sd !== L[id].side) return `You've sworn yourself to the ${SIDES[sd].army}. ${L[id].side === "imperial" ? "Legate Rikke" : "Galmar"} won't talk to you.`;
    if ((s.level || 1) < 4) return "Come back when you've a few more fights behind you (level 4).";
    return null;
  }
  function hidden(s, id) { const sd = side(s); return !!L[id] && !!sd && sd !== L[id].side; }

  // ---- Journal emblems: the side's banner ([OURS] art)
  function emblem(g, id) {
    const imp = id === "cw_imperial", ink = "#1a120a";
    g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 1.2;
    g.fillStyle = "#6a4a2a"; g.fillRect(8, 5, 24, 2.5); g.strokeRect(8, 5, 24, 2.5);   // the pole
    const gr = g.createLinearGradient(0, 8, 0, 36); gr.addColorStop(0, imp ? "#b3242a" : "#3f6fb0"); gr.addColorStop(1, imp ? "#6d1215" : "#1d3963");
    g.fillStyle = gr; g.beginPath(); g.moveTo(10, 7.5); g.lineTo(30, 7.5); g.lineTo(30, 35); g.lineTo(20, 29); g.lineTo(10, 35); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = imp ? "#e2bb64" : "#eef2f6"; g.strokeStyle = imp ? "#7a5a1a" : "#9aa6b4"; g.lineWidth = 0.8;
    if (imp) { g.beginPath(); g.moveTo(20, 11); g.lineTo(26, 15); g.lineTo(23, 16); g.lineTo(26, 21); g.lineTo(20, 18.5); g.lineTo(14, 21); g.lineTo(17, 16); g.lineTo(14, 15); g.closePath(); g.fill(); g.stroke(); }   // a gold dragon's wings
    else { g.beginPath(); g.ellipse(20, 18, 6, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke(); for (const x of [15.5, 20, 24.5]) { g.beginPath(); g.arc(x, 12.5, 1.6, 0, Math.PI * 2); g.fill(); } }   // a bear's head
  }
  for (const id of LINES) L[id].emblem = (g) => emblem(g, id);   // UIART picks these up

  if (typeof QUESTS !== "undefined") {
    Object.assign(QUESTS.L, L);
    for (const id of LINES) QUESTS.REC[id] = L[id].stages.map((st) => st.rec);
    const join0 = QUESTS.join, can0 = QUESTS.canJoin;
    QUESTS.join = (s, id) => gate(s, id) || join0(s, id);
    QUESTS.canJoin = (s, id) => !gate(s, id) && can0(s, id);
    QUESTS.visible = ((v0) => (s, id) => !hidden(s, id) && (v0 ? v0(s, id) : true))(QUESTS.visible);
  }
  return { L, LINES, SIDES, START, JARLS, enemyOf, side, control, jarl, won, townLine, barks, gate, hidden, emblem };
})();
