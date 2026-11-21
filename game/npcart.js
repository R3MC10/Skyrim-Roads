/* NPC art: head-and-shoulders portraits of the people you deal with — merchants, smiths, court wizards,
   innkeepers, Jarls and stewards, trainers, followers, guards in their hold's colours, the Greybeards — plus a
   "who you're talking to" card with a one-line greeting at the top of each town section.
   Names are [Skyrim] (the real shopkeepers of each town); a few roles the game invented (the Arena master, the
   Hall-warden) are [OURS]. Looks: race palettes from heroart.js, clothing by role, small seeded differences.
   Both art styles via ART.html (ink / pixel), cached by person + size + style.
   NPCART.portrait(npc, size) · NPCART.who(town, section) · NPCART.talk(town, section, save)
   NPCART.trainer(name, skill, size) · NPCART.follower(id, size) · NPCART.giver(questId, size) · NPCART.steward(hold, size) */
const NPCART = (() => {
  const P = () => ART.PAL;
  const RACES = () => (typeof HEROART !== "undefined" && HEROART.RACE) || {};

  // ---- who stands behind each counter ([Skyrim] names; m/f)
  const T = (name, race, sex, extra = {}) => ({ name, race, sex, ...extra });
  const TOWN = {
    Whiterun: { general: T("Belethor", "breton", "m"), blacksmith: T("Adrianne Avenicci", "imperial", "f"), wizard: T("Farengar Secret-Fire", "nord", "m"),
      inn: T("Hulda", "nord", "f"), alchemy: T("Arcadia", "imperial", "f"), stables: T("Skulvar Sable-Hilt", "nord", "m"), carriage: T("Bjorlam", "nord", "m"),
      jarl: T("Balgruuf the Greater", "nord", "m", { role: "jarl" }), steward: T("Proventus Avenicci", "imperial", "m"), hall: T("Sigrun", "nord", "f", { ours: 1 }) },
    Solitude: { general: T("Sayma", "redguard", "f"), blacksmith: T("Beirand", "nord", "m"), wizard: T("Sybille Stentor", "breton", "f"),
      inn: T("Corpulus Vinius", "imperial", "m"), alchemy: T("Angeline Morrard", "breton", "f"), stables: T("Geimund", "nord", "m"),
      jarl: T("Elisif the Fair", "nord", "f", { role: "jarl" }), steward: T("Falk Firebeard", "nord", "m") },
    Windhelm: { general: T("Revyn Sadri", "dunmer", "m"), blacksmith: T("Oengul War-Anvil", "nord", "m"), wizard: T("Wuunferth the Unliving", "nord", "m"),
      inn: T("Elda Early-Dawn", "nord", "f"), alchemy: T("Nurelion", "altmer", "m"), stables: T("Ulundil", "altmer", "m"),
      jarl: T("Ulfric Stormcloak", "nord", "m", { role: "jarl" }), steward: T("Jorleif", "nord", "m"), arena: T("Torvar Iron-Hand", "nord", "m", { ours: 1 }) },
    "Raven Rock": { general: T("Milore Ienth", "dunmer", "m"), blacksmith: T("Glover Mallory", "breton", "m"), inn: T("Geldis Sadri", "dunmer", "m"),
      docks: T("Gjalund Salt-Sage", "nord", "m", { title: "Captain of the Northern Maiden" }), steward: T("Adril Arano", "dunmer", "m") },
    "Skaal Village": { blacksmith: T("Baldor Iron-Shaper", "nord", "m"), inn: T("Fanari Strong-Voice", "nord", "f") },
    "Tel Mithryn": { wizard: T("Neloth", "dunmer", "m", { title: "Telvanni master wizard" }), alchemy: T("Elynea Mothren", "dunmer", "f") },
    "Thirsk Mead Hall": { inn: T("Hilund", "nord", "m") },
    Riften: { general: T("Bersi Honey-Hand", "nord", "m"), blacksmith: T("Balimund", "nord", "m"), inn: T("Keerava", "argonian", "f"),
      alchemy: T("Elgrim", "nord", "m"), stables: T("Hofgrir Horse-Crusher", "nord", "m"), fence: T("Tonilia", "redguard", "f"),
      jarl: T("Laila Law-Giver", "nord", "f", { role: "jarl" }), steward: T("Anuriel", "altmer", "f") },
    Markarth: { general: T("Lisbet", "nord", "f"), blacksmith: T("Ghorza gra-Bagol", "orc", "f"), wizard: T("Calcelmo", "altmer", "m"),
      inn: T("Kleppr", "nord", "m"), alchemy: T("Bothela", "nord", "f"), stables: T("Cedran", "breton", "m"),
      jarl: T("Igmund", "nord", "m", { role: "jarl" }), steward: T("Raerek", "nord", "m") },
    Dawnstar: { general: T("Frida", "nord", "f"), alchemy: T("Frida", "nord", "f"), blacksmith: T("Rustleif", "nord", "m"), inn: T("Thoring", "nord", "m"),
      jarl: T("Skald the Elder", "nord", "m", { role: "jarl" }) },
    Winterhold: { general: T("Birna", "nord", "f"), wizard: T("Tolfdir", "nord", "m"), inn: T("Dagur", "nord", "m"), jarl: T("Korir", "nord", "m", { role: "jarl" }) },
    Morthal: { wizard: T("Falion", "redguard", "m"), inn: T("Jonna", "nord", "f"), alchemy: T("Lami", "nord", "f"), jarl: T("Idgrod Ravencrone", "nord", "f", { role: "jarl" }) },
    Falkreath: { general: T("Solaf", "nord", "m"), blacksmith: T("Lod", "nord", "m"), inn: T("Valga Vinicia", "imperial", "f"),
      jarl: T("Siddgeir", "nord", "m", { role: "jarl" }), steward: T("Nenya", "altmer", "f") },
    Riverwood: { general: T("Lucan Valerius", "imperial", "m"), blacksmith: T("Alvor", "nord", "m"), inn: T("Orgnar", "nord", "m") },
    Ivarstead: { inn: T("Wilhelm", "nord", "m") }, Rorikstead: { inn: T("Mralki", "nord", "m") }, "Dragon Bridge": { inn: T("Faida", "nord", "f") },
    Kynesgrove: { inn: T("Iddra", "nord", "f") }, "Old Hroldan": { inn: T("Eydis", "nord", "f") },
    "High Hrothgar": { greybeard: T("Arngeir", "nord", "m") },
  };
  const CAPITAL = { Whiterun: "Whiterun", Haafingar: "Solitude", Eastmarch: "Windhelm", "The Rift": "Riften", "The Reach": "Markarth", Falkreath: "Falkreath", Hjaalmarch: "Morthal", "The Pale": "Dawnstar", Winterhold: "Winterhold" };
  // [Skyrim] guard tabard colours by hold
  const HOLD_COLOR = { Whiterun: "#c9a24c", Haafingar: "#8e2b25", Eastmarch: "#3f5f8a", "The Rift": "#6a3f6a", "The Reach": "#9a4a2e", Falkreath: "#3d5d36", Hjaalmarch: "#4f7f7a", "The Pale": "#7a2e3a", Winterhold: "#6f95ad" };
  // [Skyrim] trainers' races and looks (the few [OURS] trainers get Nord looks)
  const TRAINER_RACE = { "Glover Mallory": ["breton", "m"], "Talvas Fathryon": ["dunmer", "m"], Frea: ["nord", "f"], Amren: ["redguard", "m"], Athis: ["dunmer", "m"], "Aela the Huntress": ["nord", "f"], "Njada Stonearm": ["nord", "f"], Farkas: ["nord", "m"], Vilkas: ["nord", "m"],
    "Danica Pure-Spring": ["nord", "f"], "Eorlund Gray-Mane": ["nord", "m"], Arcadia: ["imperial", "f"], "Uthgerd the Unbroken": ["nord", "f"], Faendal: ["bosmer", "m"], "Brina Swift-Foot": ["nord", "f"],
    Runil: ["altmer", "m"], "Wuunferth the Unliving": ["nord", "m"], "Scouts-Many-Marshes": ["argonian", "m"], "Silda the Unseen": ["nord", "f"], "Revyn Sadri": ["dunmer", "m"],
    "Torbjorn Shatter-Shield": ["nord", "m"], "Hilde Chain-Wife": ["nord", "f"], "Sybille Stentor": ["breton", "f"], "Giraud Gemane": ["breton", "m"], "Captain Hrolf": ["nord", "m"], Bryling: ["nord", "f"],
    Hamal: ["nord", "f"], Ghorza: ["orc", "f"], Garvey: ["breton", "m"], "Ogmund the Skald": ["nord", "m"], Grelka: ["nord", "f"], Balimund: ["nord", "m"], Vex: ["imperial", "f"], "Delvin Mallory": ["breton", "m"],
    "Vipir the Fleet": ["nord", "m"], Brynjolf: ["nord", "m"], "Kesh the Leaper": ["khajiit", "m"], Tolfdir: ["nord", "m"], "Phinis Gestor": ["imperial", "m"], Faralda: ["altmer", "f"],
    "Sergius Turrianus": ["imperial", "m"], "Drevis Neloren": ["dunmer", "m"], "Colette Marence": ["breton", "f"], "Urag gro-Shub": ["orc", "m"], Lami: ["nord", "f"], Falion: ["redguard", "m"],
    "Dravynea the Stoneweaver": ["dunmer", "f"], "Brother Tarn": ["nord", "m"], Rustleif: ["nord", "m"] };
  const SCHOOL = { Destruction: "#9a3a24", Restoration: "#c9a75e", Alteration: "#4a5a9a", Conjuration: "#5a3a7a", Illusion: "#2f6f6a", Mysticism: "#3d2a5a", Enchanting: "#3a4a7a" };
  function trainerRole(skill) {
    if (SCHOOL[skill]) return skill === "Restoration" ? { role: "priest" } : { role: "wizard", robe: SCHOOL[skill] };
    if (["Heavy Armor", "Blocking", "Two-Handed", "One-Handed", "Spear"].includes(skill)) return { role: "warrior", mat: skill === "Heavy Armor" || skill === "Blocking" ? "steel" : skill === "Spear" ? "iron" : "chain" };
    if (skill === "Medium Armor") return { role: "warrior", mat: "chain" };
    if (["Light Armor", "Archery"].includes(skill)) return { role: "ranger" };
    if (["Sneak", "Lockpicking", "Pickpocket", "Streetwise"].includes(skill)) return { role: "thief" };
    if (["Speechcraft", "Etiquette", "Mercantile"].includes(skill)) return { role: "noble" };
    if (skill === "Smithing") return { role: "smith" };
    if (skill === "Alchemy") return { role: "alchemist" };
    if (["Unarmored", "Hand-to-Hand"].includes(skill)) return { role: "monk" };
    return { role: "runner" };
  }
  const FOLLOWER_LOOK = { lydia: ["nord", "f", "warrior", "steel"], jenassa: ["dunmer", "f", "ranger"], belrand: ["nord", "m", "warrior", "elven"], marcurio: ["imperial", "m", "wizard"],
    vorstag: ["nord", "m", "warrior", "iron"], stenvar: ["nord", "m", "warrior", "steel"], erik: ["nord", "m", "farmer"] };

  // ---- small helpers
  const hash = (s) => { let a = 7; for (const ch of String(s)) a = (a * 31 + ch.charCodeAt(0)) | 0; return Math.abs(a); };
  const pick = (arr, seed) => arr[seed % arr.length];
  const holdOf = (town) => { try { return G.holdAt(WORLD.places[town]); } catch { return "Whiterun"; } };
  const GEN_M = ["Hrodulf", "Ulfgar", "Brenuin", "Torsten", "Gorm", "Sigurd", "Alfhild", "Hroki", "Bolund", "Jervar"], GEN_F = ["Ingrid", "Sigrid", "Dagny", "Helvard", "Astrid", "Gerda", "Svana", "Ysolda", "Fralia", "Idgrod"];
  const GEN_RACE = ["nord", "nord", "nord", "imperial", "breton", "redguard", "dunmer", "nord"];
  /* a generic townsperson for a role: seeded by town so they stay the same person */
  function generic(town, role, title) {
    const h = hash(town + "|" + role), sex = h % 2 ? "m" : "f", race = pick(GEN_RACE, h >> 3);
    const first = sex === "m" ? pick(GEN_M, h >> 5) : pick(GEN_F, h >> 5);
    return { name: first, race, sex, title, role, generic: 1 };
  }
  const ROLE_OF = { general: "merchant", blacksmith: "smith", forge: "smith", wizard: "wizard", enchanter: "wizard", inn: "innkeeper", cook: "innkeeper", alchemy: "alchemist", stables: "stable",
    carriage: "driver", docks: "sailor", fence: "fence", jarl: "jarl", steward: "steward", notice: "steward", jobs: "steward", hire: "steward", arena: "arena", hall: "keeper", streets: "guard",
    greybeard: "greybeard", mine: "miner", fish: "fisher", market: "steward", home: "steward" };
  const TITLE = { merchant: "Merchant", smith: "Blacksmith", wizard: "Court wizard", innkeeper: "Innkeeper", alchemist: "Alchemist", stable: "Stable master", driver: "Carriage driver", sailor: "Ship's captain",
    fence: "Fence", jarl: "Jarl", steward: "Steward", arena: "Arena master", keeper: "Hall-warden", guard: "Guard", greybeard: "Greybeard", miner: "Mine foreman", fisher: "Fisher", market: "Market steward" };

  /* who you meet in a town section, or null */
  function who(town, section) {
    if (!town) return null;
    const t = TOWN[town] || {}, role = ROLE_OF[section];
    if (!role || section === "homes" || section === "train") return null;
    const hold = holdOf(town), cap = CAPITAL[hold], capT = TOWN[cap] || {};
    let p = null;
    if (section === "general") p = t.general;
    else if (section === "blacksmith" || section === "forge") p = t.blacksmith;
    else if (section === "wizard" || section === "enchanter") p = town === "Winterhold" ? T("Tolfdir", "nord", "m", { title: "College of Winterhold" }) : t.wizard;
    else if (section === "inn" || section === "cook") p = t.inn;
    else if (section === "alchemy") p = t.alchemy;
    else if (section === "stables") p = t.stables;
    else if (section === "carriage") p = t.carriage;
    else if (section === "docks") p = t.docks || TOWN["Raven Rock"].docks;
    else if (section === "fence") p = t.fence;
    else if (section === "arena") p = t.arena;
    else if (section === "hall") p = t.hall;
    else if (section === "hire") p = town === "Whiterun" ? t.jarl : t.inn;
    else if (["notice", "jobs", "market", "home"].includes(section)) p = (town === cap ? t.steward : null) || (town === cap ? null : null);
    else if (section === "greybeard") p = TOWN["High Hrothgar"].greybeard;
    if (section === "streets") return { name: `${hold} guard`, race: "nord", sex: hash(town) % 3 ? "m" : "f", role: "guard", hold, title: `Guard of ${hold}` };
    if (!p && ["notice", "jobs", "home", "market"].includes(section)) p = town === cap ? capT.steward : null;
    const base = p || generic(town, role, TITLE[section === "market" ? "market" : role] || "Townsperson");
    const r2 = base.role || role;
    return { ...base, role: r2, hold, title: base.title || (r2 === "jarl" ? `Jarl of ${hold}` : p && ["notice", "jobs", "home", "market"].includes(section) ? `Steward of ${hold}` : TITLE[r2] || ""), town };
  }
  function steward(hold, size = 34) { const cap = CAPITAL[hold]; const s = (TOWN[cap] || {}).steward || generic(cap || hold, "steward", "Steward"); return portrait({ ...s, role: "steward", hold }, size); }
  function jarlOf(hold) { const cap = CAPITAL[hold]; return (TOWN[cap] || {}).jarl || null; }

  // ---------------------------------------------------------------- drawing
  function outfit(n) {
    const PL = P(), hc = HOLD_COLOR[n.hold] || "#8a5a34";
    switch (n.role) {
      case "merchant": return { body: "#7a5a3a", trim: "#c9a75e", apron: "#cdb98f" };
      case "smith": return { body: "#6b4a2e", trim: "#3b2c1e", apron: "#4a3524", bare: 1, soot: 1 };
      case "wizard": return { body: n.robe || "#4a3a6a", trim: "#d6b25e", collar: 1, hood: hash(n.name) % 3 === 0 };
      case "priest": return { body: "#e8dcc0", trim: "#c9a24c", collar: 1, amulet: 1 };
      case "innkeeper": return { body: n.sex === "f" ? "#8a4a3a" : "#5e6b4a", trim: "#cdb98f", apron: "#e9dcc0" };
      case "alchemist": return { body: "#4f6a42", trim: "#8a5a34", collar: 1, vials: 1 };
      case "stable": return { body: "#8a6a48", trim: "#5e4630", fur: "#b9a07a" };
      case "driver": return { body: "#5a4a3a", trim: "#3b2c1e", hat: 1, fur: "#8f7a66" };
      case "fence": case "thief": return { body: "#2f2a28", trim: "#6b5640", hood: 1 };
      case "jarl": return { body: hc, trim: "#d6b25e", fur: "#efe6d4", circlet: 1, rich: 1 };
      case "steward": return { body: "#4a3a2e", trim: hc, sash: hc };
      case "guard": return { body: "#6f6a64", trim: "#8f8a84", tabard: hc, helmet: 1 };
      case "greybeard": return { body: "#8f8f8a", trim: "#6b6b66", hood: 1, greyBeard: 1 };
      case "arena": return { body: "#a9b0b4", trim: "#d0d5d8", plate: 1, scar: 1 };
      case "bard": return { body: "#6a3a5a", trim: "#d6b25e", collar: 1, fur: "#8f7a66" };
      case "keeper": return { body: "#5e4630", trim: "#d6b25e", fur: "#cdb98f" };
      case "warrior": { const m = (typeof HEROART !== "undefined" && HEROART.MAT[n.mat || "steel"]) || { c: "#a9b0b4", d: "#7d858a", trim: "#d0d5d8" }; return { body: m.c, trim: m.trim, plate: 1, dark: m.d }; }
      case "ranger": return { body: "#7a5232", trim: "#a87a50", strap: 1, hood: hash(n.name) % 2 === 0 };
      case "noble": return { body: "#6a2a3a", trim: "#d6b25e", collar: 1, rich: 1 };
      case "monk": return { body: "#a88a5a", trim: "#6b5640", bare: 1 };
      case "farmer": return { body: "#8c7a5a", trim: "#5e4630" };
      case "miner": return { body: "#6b5a48", trim: "#3b2c1e", soot: 1, hat: 0, lamp: 1 };
      case "fisher": return { body: "#4f6a7a", trim: "#3b2c1e", hat: 1 };
      default: return { body: "#7a6a52", trim: "#3b2c1e" };
    }
  }
  function draw(g, H, n, S) {   // 96×96 box
    const PL = P(), ink = PL.ink, R = RACES()[n.race] || RACES().nord || { skin: ["#e9c6a1"], hair: ["#5a3e26"], beard: 0.4, ears: "round" };
    const h = hash(n.name + (n.seed || "")), o = outfit(n);
    const skin = n.role === "greybeard" ? "#e6cfb4" : R.skin[h % R.skin.length], hair = n.role === "greybeard" ? "#e8e6e0" : (R.hair.length ? R.hair[(h >> 2) % R.hair.length] : null);
    const female = n.sex === "f", cx = 48, hy = 42;
    // background
    if (ART.style() === "pixel") { g.fillStyle = "#ccaa88"; g.fillRect(0, 0, S, S); }
    else { H.parchment(g, S, S, h % 97); }
    g.save(); const k = S / 96; g.scale(k, k);
    // a soft backdrop tinted by role/hold
    g.fillStyle = (o.tabard || o.sash || (o.rich ? o.body : null)) ? "rgba(59,44,30,0.10)" : "rgba(59,44,30,0.06)"; g.fillRect(0, 0, 96, 96);
    // ---- shoulders & torso
    const sw = female ? 34 : 38;
    const torso = [[cx - sw, 96], [cx - sw + 4, 74], [cx - 12, 64], [cx + 12, 64], [cx + sw - 4, 74], [cx + sw, 96]];
    if (o.fur) { g.fillStyle = o.fur; g.beginPath(); for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI, rx = sw + 2, ry = 14; g.lineTo(cx + Math.cos(a) * rx + (i % 2 ? 2 : -2), 76 + Math.sin(a) * ry); } g.lineTo(cx + sw + 2, 96); g.lineTo(cx - sw - 2, 96); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = 1.1; g.stroke(); }
    H.poly(g, torso, o.bare ? skin : o.body, ink, 1.3);
    if (o.bare) H.poly(g, [[cx - 22, 96], [cx - 20, 72], [cx + 20, 72], [cx + 22, 96]], o.body, ink, 1.1);   // smith's / monk's vest over bare arms
    if (o.apron) H.poly(g, [[cx - 14, 96], [cx - 14, 74], [cx + 14, 74], [cx + 14, 96]], o.apron, ink, 1.1);
    if (o.plate) { g.strokeStyle = o.dark || ink; g.lineWidth = 1.2; for (const y of [78, 86]) { g.beginPath(); g.moveTo(cx - sw + 6, y); g.quadraticCurveTo(cx, y + 5, cx + sw - 6, y); g.stroke(); }
      H.poly(g, [[cx - sw, 80], [cx - sw + 2, 70], [cx - sw + 16, 68], [cx - sw + 14, 82]], o.trim, ink, 1); H.poly(g, [[cx + sw, 80], [cx + sw - 2, 70], [cx + sw - 16, 68], [cx + sw - 14, 82]], o.trim, ink, 1); }
    if (o.tabard) { H.poly(g, [[cx - 10, 96], [cx - 10, 70], [cx + 10, 70], [cx + 10, 96]], o.tabard, ink, 1.1); H.circle(g, cx, 82, 4, o.trim, ink, 0.8); }
    if (o.sash) { g.strokeStyle = o.sash; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 22, 70); g.lineTo(cx + 16, 96); g.stroke(); }
    if (o.strap) { g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 20, 68); g.lineTo(cx - 14, 96); g.stroke(); }
    if (o.collar) { H.poly(g, [[cx - 13, 64], [cx, 78], [cx + 13, 64], [cx + 9, 63], [cx, 72], [cx - 9, 63]], o.trim, ink, 1); }
    if (o.amulet) { g.strokeStyle = o.trim; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 8, 66); g.lineTo(cx, 78); g.lineTo(cx + 8, 66); g.stroke(); H.circle(g, cx, 80, 3, "#d6b25e", ink, 0.8); }
    if (o.vials) for (const [x, c] of [[cx - 18, "#c4372e"], [cx - 12, "#4a7ad0"], [cx + 14, "#5fae4a"]]) { H.poly(g, [[x - 2, 90], [x - 2, 84], [x + 2, 84], [x + 2, 90]], c, ink, 0.8); }
    if (o.soot) { g.fillStyle = "rgba(40,30,20,0.25)"; for (let i = 0; i < 6; i++) g.fillRect(cx - 20 + ((h >> i) % 40), 80 + ((h >> (i + 3)) % 12), 3, 2); }
    if (o.rich) { g.strokeStyle = "#d6b25e"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - sw + 6, 92); g.lineTo(cx + sw - 6, 92); g.stroke(); }
    // ---- neck & head
    H.poly(g, [[cx - 6, 66], [cx - 6, 56], [cx + 6, 56], [cx + 6, 66]], skin, ink, 1.1);
    const hw = 14 * (R.w || 1), hh = 17 * (R.h || 1);
    // hair behind the head (long hair)
    const style = n.role === "guard" ? "none" : (female ? ["long", "braid", "bun", "long", "short"] : ["short", "short", "long", "bald", "mohawk", "short"])[(h >> 4) % (female ? 5 : 6)];
    if (hair && (style === "long" || style === "braid") && !o.hood && !o.helmet) {   // hair falling behind the shoulders, at the sides only (never under the chin)
      g.fillStyle = hair; g.strokeStyle = ink; g.lineWidth = 1;
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * (hw - 2), hy - 6); g.quadraticCurveTo(cx + sx * (hw + 7), hy + 4, cx + sx * (hw + 6), hy + 26); g.lineTo(cx + sx * (hw - 1), hy + 26); g.quadraticCurveTo(cx + sx * (hw + 1), hy + 8, cx + sx * (hw - 4), hy); g.closePath(); g.fill(); g.stroke(); }
    }
    if (o.hood) { const hc = n.role === "greybeard" ? "#7a7a74" : o.body; H.poly(g, [[cx - hw - 7, hy + 22], [cx - hw - 6, hy - 6], [cx, hy - hh - 9], [cx + hw + 6, hy - 6], [cx + hw + 7, hy + 22]], hc, ink, 1.3); }
    // ears
    const ears = R.ears || "round";
    if (!o.helmet) {
      if (ears === "elf") for (const s of [-1, 1]) H.poly(g, [[cx + s * (hw - 1), hy - 2], [cx + s * (hw + 9), hy - 10], [cx + s * (hw - 1), hy + 5]], skin, ink, 1);
      else if (ears === "orc") for (const s of [-1, 1]) H.poly(g, [[cx + s * (hw - 1), hy - 3], [cx + s * (hw + 6), hy - 6], [cx + s * (hw - 1), hy + 5]], skin, ink, 1);
      else if (ears === "round") for (const s of [-1, 1]) H.circle(g, cx + s * hw, hy + 1, 3.2, skin, ink, 1);
    }
    // head shape
    if (ears === "lizard") { H.poly(g, [[cx - hw, hy + 4], [cx - hw + 2, hy - hh + 2], [cx + hw - 2, hy - hh + 2], [cx + hw + 7, hy + 4], [cx + hw + 5, hy + 12], [cx - hw + 3, hy + hh - 2]], skin, ink, 1.3); }
    else { g.fillStyle = skin; g.beginPath(); g.ellipse(cx, hy, hw, hh, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke(); }
    if (ears === "cat") { H.poly(g, [[cx - 4, hy + 6], [cx, hy + 14], [cx + 4, hy + 6]], R.skin[0], ink, 1); for (const s of [-1, 1]) H.poly(g, [[cx + s * 6, hy - hh + 3], [cx + s * 13, hy - hh - 9], [cx + s * 14, hy - hh + 7]], skin, ink, 1); g.strokeStyle = ink; g.lineWidth = 0.6; for (const s of [-1, 1]) for (const dy of [0, 3]) { g.beginPath(); g.moveTo(cx + s * 5, hy + 9 + dy); g.lineTo(cx + s * 15, hy + 7 + dy * 1.4); g.stroke(); } }
    if (ears === "lizard" && !o.helmet && !o.hood) for (const s of [-1, 1]) H.poly(g, [[cx + s * 3, hy - hh + 3], [cx + s * 8, hy - hh - 8], [cx + s * 9, hy - hh + 4]], "#d8cfa8", ink, 1);
    // eyes, brows, mouth
    const eyeC = R.eyes || "#2a2420", ey = hy - 1;
    for (const s of [-1, 1]) { H.circle(g, cx + s * 5.5, ey, 2.1, "#f4efe4", null); H.circle(g, cx + s * 5.5, ey, 1.2, eyeC, null); g.strokeStyle = hair || ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + s * 2.5, ey - 4 - (n.role === "guard" ? 1 : 0)); g.lineTo(cx + s * 8.5, ey - 4.5 + (n.role === "arena" ? 1.2 * s * -1 : 0)); g.stroke(); }
    g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, ey + 1); g.lineTo(cx - 1.5, ey + 7); g.lineTo(cx + 1, ey + 7.5); g.stroke();
    const smile = ["innkeeper", "merchant", "driver", "stable", "keeper", "farmer"].includes(n.role) ? 2 : ["guard", "jarl", "arena", "fence"].includes(n.role) ? -0.5 : 0.8;
    g.beginPath(); g.moveTo(cx - 4, ey + 11); g.quadraticCurveTo(cx, ey + 11 + smile, cx + 4, ey + 11); g.stroke();
    if (ears === "orc") for (const s of [-1, 1]) H.poly(g, [[cx + s * 4, ey + 12], [cx + s * 5, ey + 8], [cx + s * 6, ey + 12]], "#f4efe4", ink, 0.7);
    if (female && ears !== "lizard" && ears !== "cat") { g.fillStyle = "rgba(190,90,80,0.25)"; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 8, ey + 6, 2.4, 0, 7); g.fill(); } }
    // war paint ([Skyrim] Nords and Orcs often wear it)
    if ((n.race === "nord" || n.race === "orc") && (h >> 7) % 4 === 0 && !["jarl", "steward", "merchant", "priest", "wizard"].includes(n.role)) { g.strokeStyle = "rgba(40,30,30,0.55)"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 9, ey - 3); g.lineTo(cx - 3, ey + 6); g.moveTo(cx + 9, ey - 3); g.lineTo(cx + 3, ey + 6); g.stroke(); }
    if (o.scar) { g.strokeStyle = "#8e2b25"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 7, ey - 7); g.lineTo(cx + 3, ey + 4); g.stroke(); }
    // beard
    const beardOn = n.role === "greybeard" || (!female && R.beard && ((h >> 9) % 100) / 100 < R.beard + 0.15);
    if (beardOn && hair) { const long = n.role === "greybeard" || n.role === "jarl" || (h >> 11) % 3 === 0; g.fillStyle = hair; g.beginPath(); g.moveTo(cx - hw + 1, ey + 3); g.quadraticCurveTo(cx - hw + 2, ey + (long ? 22 : 15), cx, ey + (long ? 28 : 18)); g.quadraticCurveTo(cx + hw - 2, ey + (long ? 22 : 15), cx + hw - 1, ey + 3); g.quadraticCurveTo(cx, ey + 10, cx - hw + 1, ey + 3); g.fill(); g.strokeStyle = ink; g.lineWidth = 1; g.stroke(); g.strokeStyle = skin; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 4, ey + 11); g.quadraticCurveTo(cx, ey + 12.5, cx + 4, ey + 11); g.stroke(); }
    // hair on top
    if (hair && !o.hood && !o.helmet && ears !== "cat" && ears !== "lizard") {
      g.fillStyle = hair; g.strokeStyle = ink; g.lineWidth = 1;
      if (style === "bald") { /* nothing */ }
      else if (style === "mohawk") { H.poly(g, [[cx - 3, hy - hh + 4], [cx - 2, hy - hh - 5], [cx + 2, hy - hh - 5], [cx + 3, hy - hh + 4]], hair, ink, 1); }
      else { g.beginPath(); g.moveTo(cx - hw - 1, hy - 2); g.quadraticCurveTo(cx - hw, hy - hh - 3, cx, hy - hh - 3); g.quadraticCurveTo(cx + hw, hy - hh - 3, cx + hw + 1, hy - 2); g.quadraticCurveTo(cx + 4, hy - hh + 4, cx - hw - 1, hy - 2); g.fill(); g.stroke(); }
      if (style === "braid") for (const s of [-1, 1]) { g.fillStyle = hair; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(cx + s * (hw + 1), hy + 6 + i * 5, 2.6, 3, 0, 0, 7); g.fill(); g.stroke(); } }
      if (style === "bun") { H.circle(g, cx, hy - hh - 3, 5, hair, ink, 1); }
    }
    // headwear
    if (o.circlet) { g.strokeStyle = "#d6b25e"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx - hw + 1, hy - 8); g.quadraticCurveTo(cx, hy - 12, cx + hw - 1, hy - 8); g.stroke(); H.poly(g, [[cx - 3, hy - 10], [cx, hy - 16], [cx + 3, hy - 10]], "#d6b25e", ink, 0.8); H.circle(g, cx, hy - 11, 1.4, "#8e2b25", null); }
    if (o.helmet) {
      const hc = "#7d858a";
      g.fillStyle = hc; g.beginPath(); g.moveTo(cx - hw - 3, hy + 2); g.quadraticCurveTo(cx - hw - 3, hy - hh - 6, cx, hy - hh - 7); g.quadraticCurveTo(cx + hw + 3, hy - hh - 6, cx + hw + 3, hy + 2); g.lineTo(cx + hw - 3, hy + 2); g.lineTo(cx + hw - 3, hy - 4); g.lineTo(cx - hw + 3, hy - 4); g.lineTo(cx - hw + 3, hy + 2); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
      H.poly(g, [[cx - 1.6, hy - 4], [cx + 1.6, hy - 4], [cx + 1.2, hy + 6], [cx - 1.2, hy + 6]], hc, ink, 0.9);   // nose guard
      g.fillStyle = o.tabard; g.beginPath(); g.moveTo(cx - 2, hy - hh - 6); g.quadraticCurveTo(cx + 10, hy - hh - 16, cx + 16, hy - hh - 4); g.lineTo(cx + 2, hy - hh - 3); g.closePath(); g.fill(); g.stroke();   // plume in hold colour
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(cx - hw + 3, hy + 6, (hw - 3) * 2, 8);   // the face mask's shadow
    }
    if (o.hat) { H.poly(g, [[cx - hw - 6, hy - 9], [cx + hw + 6, hy - 9], [cx + hw - 1, hy - 13], [cx + hw - 3, hy - hh - 6], [cx - hw + 3, hy - hh - 6], [cx - hw + 1, hy - 13]], "#5a4a3a", ink, 1.2); }
    if (o.lamp) { H.circle(g, cx + hw + 2, hy - 12, 3.2, "#e8c24a", ink, 0.8); }
    g.restore();
    // frame
    g.strokeStyle = PL.ink; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, S - 1.5, S - 1.5);
  }
  function keyOf(n) { return [n.name, n.race, n.sex, n.role, n.mat || "", n.robe || "", n.hold || ""].join("|"); }
  function portrait(n, size = 64) {
    if (!n) return "";
    return ART.html(size, size, (g, H, w) => draw(g, H, n, w), { key: "npc|" + keyOf(n) + "|" + size, alt: n.name, cls: "npcport" });
  }
  function trainer(name, skill, size = 36) {
    const [race, sex] = TRAINER_RACE[name] || ["nord", hash(name) % 2 ? "m" : "f"];
    return portrait({ name, race, sex, ...trainerRole(skill) }, size);
  }
  function follower(id, size = 36) {
    const f = (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]) || [id];
    const [race, sex, role, mat] = FOLLOWER_LOOK[id] || ["nord", "f", "warrior", "steel"];
    return portrait({ name: f[0], race, sex, role, mat }, size);
  }
  const GIVERS = { companions: T("Kodlak Whitemane", "nord", "m", { role: "warrior", mat: "nord" }), thieves: T("Brynjolf", "nord", "m", { role: "thief" }),
    college: T("Faralda", "altmer", "f", { role: "wizard", robe: "#9a3a24" }), brotherhood: T("Astrid", "nord", "f", { role: "thief" }), main: T("Balgruuf the Greater", "nord", "m", { role: "jarl", hold: "Whiterun" }),
    dragonborn: T("Frea", "nord", "f", { role: "warrior", mat: "nord" }) };
  function giver(qid, size = 32) { const g = GIVERS[qid]; return g ? portrait(g, size) : ""; }

  // ---- what they say: plain, Skyrim-flavoured, steady for the in-game day
  const LINES = {
    merchant: ["Everything's for sale, my friend. Everything!", "Take a look. Fair prices, mostly.", "Gold first, questions later.", "If you've got coin, I've got wares."],
    smith: ["Need something sharp? Or something to stop something sharp?", "Steel's honest. Bring me ore and I'll show you.", "Mind the forge, it bites.", "A good blade outlives its owner."],
    wizard: ["Mind the books. Some of them bite back.", "Magic isn't a toy, but it is a tool.", "Come to learn, or come to buy?", "The winds of magic are restless today."],
    innkeeper: ["Come in, get warm. Mead's cold, fire's hot.", "Need a room? Bed's soft enough.", "Plenty of stories tonight. Some of them true.", "Sit, eat. You look half frozen."],
    alchemist: ["Careful with that one. It's not for drinking.", "Mushrooms, roots, the odd giant's toe. What do you need?", "A cure for every ache, and an ache for every cure."],
    stable: ["Best horses in the hold. Ask anyone.", "She's a good runner. Feed her and she'll carry you.", "Horses don't lie. People do."],
    sailor: ["The Northern Maiden's the fastest ship on the Sea of Ghosts. Mostly.", "Ash on the wind. We'll be at Raven Rock soon enough.", "Fare first. The sea doesn't take credit."],
    driver: ["Need a ride? Tell me where.", "Climb aboard. Nothing bothers a carriage on the road.", "Fare first, then we go."],
    fence: ["Keep your voice down. What have you got?", "No questions. No names. Just coin.", "If it's hot, I can cool it down. For a price."],
    jarl: ["Speak. The hold is listening.", "What brings you before the Jarl?", "We have dragons to worry about. Be brief."],
    steward: ["The Jarl is busy. Talk to me.", "There's always work for someone with a strong arm.", "Notices are on the board. Read them."],
    guard: ["Keep your nose clean.", "No lollygagging.", "I used to be an adventurer like you.", "Watch the skies, traveller."],
    greybeard: ["The Voice is not a weapon. Remember that.", "Listen to the wind on the mountain.", "Patience, Dragonborn."],
    arena: ["Step into the sand. Glory or a broken nose.", "The crowd loves a good fight. Give them one.", "Bets are open. Who's your champion?"],
    keeper: ["Every name on that wall earned its place.", "Give to the Hall, and the North remembers.", "The mead's free for builders. Mostly."],
    miner: ["Mind your head. The tunnels are low.", "Good ore down there, if you don't mind the dark."], fisher: ["They're biting today. Mostly my fingers."],
  };
  const NIGHT = { innkeeper: "Late one? There's still a bed upstairs.", merchant: "We're closed, friend. Come back in the morning.", smith: "Forge is banked for the night. Come back at dawn.",
    wizard: "It's late. Some spells keep better till morning.", alchemist: "Shop's closed. The good herbs wake up with the sun.", guard: "It's dark. Stay out of trouble.", steward: "The Jarl sleeps. Come back in the morning." };
  function greeting(n, s) {
    try {
      const hr = G.clock().hour, day = G.clock().day, role = n.role;
      const bounty = s && n.hold && typeof TOWNS !== "undefined" ? TOWNS.bounty(s, n.hold) : 0;
      if (bounty && role === "guard") return `Wait. You're wanted in ${n.hold}. ${bounty} gold. Pay up, or come quietly.`;
      if (bounty && ["merchant", "smith", "innkeeper"].includes(role)) return "I've heard about you. Make it quick, and keep your hands where I can see them.";
      const night = hr >= 20 || hr < 6;
      if (night && NIGHT[role] && (role !== "innkeeper" || hr >= 23 || hr < 6)) return NIGHT[role];
      if (s && (s.dragons || 0) > 0 && hash(n.name + day) % 3 === 0) return role === "guard" ? "Dragonborn. The Greybeards called for you, didn't they?" : "You're the one who killed the dragon? By Ysmir, I'm honoured.";
      if (s && s.thaneWhiterun && n.hold === "Whiterun" && hash(n.name + day) % 4 === 0) return "My Thane. It's good to see you in Whiterun.";
      const L = LINES[role] || LINES.merchant;
      const morning = hr >= 6 && hr < 11 && ["innkeeper", "merchant", "smith"].includes(role) && hash(n.name + day) % 3 === 0;
      if (morning) return role === "innkeeper" ? "Morning! Sweetroll and a mug of something warm?" : "Early start? Good. The best stock goes first.";
      return L[hash(n.name + "|" + day) % L.length];
    } catch { return ""; }
  }
  /* the card shown at the top of a town section */
  function talk(town, section, s) {
    const n = who(town, section);
    if (!n) return "";
    const line = greeting(n, s);
    return `<div class="npctalk">${portrait(n, 64)}<div class="npct"><b>${n.name.replace(/[<>&"]/g, "")}</b><span class="npcrole">${(n.title || "").replace(/[<>&"]/g, "")}</span>${line ? `<q>${line.replace(/[<>&"]/g, "")}</q>` : ""}</div></div>`;
  }
  return { TOWN, who, talk, portrait, trainer, follower, giver, steward, jarlOf, greeting, HOLD_COLOR, CAPITAL, FOLLOWER_LOOK, TRAINER_RACE };
})();
