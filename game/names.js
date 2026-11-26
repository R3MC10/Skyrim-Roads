/* names.js: one table for the names of things (towns and places, holds and lands, factions, races, gods, foes, items),
   so the game can be reskinned later by editing this file and nothing else.

   THE RULE (read this before you store or compare a name)
   - Saves, quests, inventories, network messages and logs store IDS, never display names. Show a name only through
     NAMES (NAMES.get / place / hold / item / foe / race / local / fill), at the moment it goes on screen.
   - An id never changes. Where the game always used the English name as the id (towns and places: s.location,
     s.discovered, WORLD.places, roads, quest obj.go/talk/clear, D.SHOPS, TOWNS.*; holds: WORLD.holds, G.holdAt();
     foes: encounter and dungeon foe names, which dungeons.js looks up by name), that old English name IS the id and
     stays exactly as it is, so old saves keep working with no migration. To rename one, change its display name
     here; never rename the key in world.js, data.js or a save.
   - Items, races and factions already had real ids (D.ITEMS keys, D.RACES keys, SIDES.LIST keys). A new display
     name for them is copied onto the game's own tables at start-up (apply()), so every screen that reads .name follows.
   - Known places that still keep display names in saved data (fine today, worth fixing when touched):
     s.dungeon.found (item names found in a dungeon run, compared by name in dungeons.js), the cleared-dungeon
     and rumour lists (keyed by place id, which is fine), foe names inside fight logs and bestiary lines (text only).

   HOW TO RESKIN: give an entry a new en.name (and pl.name for Polish). For a type that is read from the game's data
   (place, item, foe), add the id to OVERRIDE below. Polish: if pl.name is missing, the Polish screen translator's
   word for the ORIGINAL name is used (the i18n_*.js tables stay the one source for Polish words), so a renamed
   thing needs its pl.name here too. pl.gen / pl.loc are Polish case forms (dopełniacz "do Windhelmu", miejscownik
   "w Windhelmie") for the few places that need them; they fall back to pl.name. Every entry here with a pl.name is
   also handed to the screen translator, so English text that names it turns Polish on screen as well.

   USE: NAMES.get(id, {type, lang, case}) — English by default, because the game writes English and the screen
   translator (i18n.js) swaps it on screen; NAMES.local(id) gives the player's language, for canvas text the
   translator can't reach. NAMES.fill("Go to {town:Whiterun}.") fills {type:id} templates in quest text. Missing ids
   fall back to the id itself, with a console warning when the page runs with ?dev. NAMES.dump() lists every entry. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const NAMES = (() => {
  // ---------------------------------------------------------------- the tables (edit these to reskin)
  /* towns and cities (WORLD.places kinds city/town, plus Solstheim's). Key = id (never change it). */
  const TOWN = {
    Solitude: { en: "Solitude" }, Markarth: { en: "Markarth" }, Whiterun: { en: "Whiterun" }, Windhelm: { en: "Windhelm", pl: { gen: "Windhelmu" } },
    Riften: { en: "Riften" }, Dawnstar: { en: "Dawnstar" }, Winterhold: { en: "Winterhold" }, Morthal: { en: "Morthal" }, Falkreath: { en: "Falkreath" },
    Riverwood: { en: "Riverwood" }, Helgen: { en: "Helgen" }, Ivarstead: { en: "Ivarstead" }, Rorikstead: { en: "Rorikstead" },
    "Dragon Bridge": { en: "Dragon Bridge" }, Karthwasten: { en: "Karthwasten" }, Kynesgrove: { en: "Kynesgrove" }, "Shor's Stone": { en: "Shor's Stone" },
    "Darkwater Crossing": { en: "Darkwater Crossing" }, "Old Hroldan": { en: "Old Hroldan" }, "Soljund's Sinkhole": { en: "Soljund's Sinkhole" },
    Stonehills: { en: "Stonehills" }, "Raven Rock": { en: "Raven Rock" }, "Skaal Village": { en: "Skaal Village" }, "Tel Mithryn": { en: "Tel Mithryn" },
    "Thirsk Mead Hall": { en: "Thirsk Mead Hall" },
  };
  /* the nine holds (WORLD.holds keys, what G.holdAt() returns) */
  const HOLD = {
    Haafingar: { en: "Haafingar" }, Hjaalmarch: { en: "Hjaalmarch" }, "The Pale": { en: "The Pale" }, Winterhold: { en: "Winterhold" },
    Eastmarch: { en: "Eastmarch" }, "The Rift": { en: "The Rift" }, Whiterun: { en: "Whiterun" }, "The Reach": { en: "The Reach" }, Falkreath: { en: "Falkreath" },
  };
  /* lands and seas beyond (map labels: WORLD.beyond, the sea) */
  const REGION = {
    Skyrim: { en: "Skyrim" }, Solstheim: { en: "Solstheim" }, "Sea of Ghosts": { en: "Sea of Ghosts" },
    "HIGH ROCK": { en: "HIGH ROCK" }, HAMMERFELL: { en: "HAMMERFELL" }, CYRODIIL: { en: "CYRODIIL" }, MORROWIND: { en: "MORROWIND" },
  };
  /* factions and guilds. The three sides are SIDES.LIST ids; the rest are named in quests and guild lines. */
  const FACTION = {
    stormcloak: { en: "Stormcloaks" }, imperial: { en: "Imperial Legion" }, thalmor: { en: "Aldmeri Dominion" },
    companions: { en: "Companions" }, college: { en: "College of Winterhold" }, thieves: { en: "Thieves Guild" }, brotherhood: { en: "Dark Brotherhood" },
    dawnguard: { en: "Dawnguard" }, volkihar: { en: "Volkihar" }, greybeards: { en: "Greybeards" }, blades: { en: "Blades" }, bards: { en: "Bards College" },
  };
  /* races: D.RACES ids */
  const RACE = {
    nord: { en: "Nord" }, imperial: { en: "Imperial" }, breton: { en: "Breton" }, redguard: { en: "Redguard" }, altmer: { en: "Altmer" },
    bosmer: { en: "Bosmer" }, dunmer: { en: "Dunmer" }, orc: { en: "Orc" }, khajiit: { en: "Khajiit" }, argonian: { en: "Argonian" },
  };
  /* gods: the Divines (events.js DIVINES) and the Daedric Princes (daedric.js) */
  const GOD = {};
  for (const g of ["Akatosh", "Arkay", "Dibella", "Julianos", "Kynareth", "Mara", "Stendarr", "Zenithar", "Talos",
    "Azura", "Boethiah", "Clavicus Vile", "Hermaeus Mora", "Hircine", "Malacath", "Mehrunes Dagon", "Mephala", "Meridia",
    "Molag Bal", "Namira", "Nocturnal", "Peryite", "Sanguine", "Sheogorath", "Vaermina"]) GOD[g] = { en: g };
  /* new names for things the table reads from the game's own data: place (WORLD.places), item (D.ITEMS), foe (foe
     names), npc. Example: item: { iron_sword: { en: "Iron Blade", pl: { name: "Żelazne ostrze" } } } */
  const OVERRIDE = { town: {}, place: {}, hold: {}, item: {}, foe: {}, npc: {} };

  // ---------------------------------------------------------------- the registry
  const TYPES = ["town", "place", "hold", "region", "faction", "race", "god", "foe", "item", "npc"];
  const CURATED = { town: TOWN, hold: HOLD, region: REGION, faction: FACTION, race: RACE, god: GOD };
  const REG = new Map();   // "type:id" → { type, id, base, en: {name}, pl: {name?, gen?, loc?} }
  const norm = (id, type, def, base) => {
    const en = typeof def.en === "string" ? { name: def.en } : { ...(def.en || {}) };
    if (!en.name) en.name = base;
    return { type, id, base, en, pl: { ...(def.pl || {}) } };
  };
  function put(type, id, def = {}, base = id) {
    const ov = OVERRIDE[type] && OVERRIDE[type][id];
    const e = norm(id, type, ov ? { en: ov.en || def.en, pl: { ...(def.pl || {}), ...(ov.pl || {}) } } : def, base);
    REG.set(type + ":" + id, e); return e;
  }
  for (const [type, tab] of Object.entries(CURATED)) for (const [id, def] of Object.entries(tab)) put(type, id, def);
  /* read the rest from the game's data, once it's all loaded (first call after load, or apply()) */
  let built = false;
  const G0 = typeof globalThis !== "undefined" ? globalThis : {};
  function build() {
    if (built) return; built = true;
    const W = G0.WORLD || (typeof WORLD !== "undefined" ? WORLD : null), D0 = G0.D || (typeof D !== "undefined" ? D : null);
    if (W && W.places) for (const [n, v] of Object.entries(W.places)) if (!REG.has("town:" + n)) {
      if (v && (v[2] === "city" || v[2] === "town")) put("town", n); else put("place", n);
    }
    if (D0 && D0.ITEMS) for (const [id, it] of Object.entries(D0.ITEMS)) if (it && it.name && !id.startsWith("ench|")) put("item", id, {}, baseItem[id] || it.name);
    const foes = new Set();
    if (D0 && D0.ENCOUNTERS) for (const e of D0.ENCOUNTERS) if (e && e.name) foes.add(e.name);
    const FN = G0.I18N_FOES || (typeof I18N_FOES !== "undefined" ? I18N_FOES : null);
    if (FN && FN.NAMES) for (const k of Object.keys(FN.NAMES)) foes.add(k);
    for (const k of Object.keys(OVERRIDE.foe)) foes.add(k);
    for (const f of foes) put("foe", f);
    for (const [id, def] of Object.entries(OVERRIDE.npc)) put("npc", id, def);
    for (const [id, def] of Object.entries(OVERRIDE.place)) if (!REG.has("place:" + id) && !REG.has("town:" + id)) put("place", id, def);
  }
  const baseItem = {};   // items' original English names (before an override was copied onto D.ITEMS)

  // ---------------------------------------------------------------- lookups
  const ORDER = ["town", "place", "hold", "region", "race", "faction", "god", "foe", "item", "npc"];
  function entry(id, type) {
    if (id == null) return null;
    id = String(id);
    let t = type;
    const c = id.indexOf(":");
    if (!t && c > 0 && TYPES.includes(id.slice(0, c))) { t = id.slice(0, c); id = id.slice(c + 1); }
    if (t) return REG.get(t + ":" + id) || (built ? late(id, t) : (build(), REG.get(t + ":" + id) || late(id, t)));
    for (const k of ORDER) { const e = REG.get(k + ":" + id); if (e) return e; }
    if (!built) { build(); return entry(id); }
    return late(id);
  }
  /* a place or item a module added after the table was built (Solstheim, Blackreach, new loot): register it now */
  function late(id, t) {
    const W = G0.WORLD || (typeof WORLD !== "undefined" ? WORLD : null), D0 = G0.D || (typeof D !== "undefined" ? D : null);
    const pl = W && W.places && W.places[id];
    if (pl && (!t || t === "town" || t === "place")) { const k = pl[2] === "city" || pl[2] === "town" ? "town" : "place"; if (!t || t === k) return put(k, id); }
    const it = D0 && D0.ITEMS && D0.ITEMS[id];
    if (it && it.name && !id.startsWith("ench|") && (!t || t === "item")) return put("item", id, {}, baseItem[id] || it.name);
    return null;
  }
  const DEV = (() => { try { return typeof location !== "undefined" && /[?&]dev\b/.test(location.search || ""); } catch (e) { return false; } })();
  const warned = new Set();
  function warn(id, type) {
    if (!DEV || warned.has(type + ":" + id)) return; warned.add(type + ":" + id);
    try { console.warn(`[names] no entry for ${type ? type + ":" : ""}${id}: add it to names.js`); } catch (e) { /* no console */ }
  }
  let LANG = null;
  const lang = () => {
    if (LANG) return LANG;
    const I = G0.I18N || (typeof I18N !== "undefined" ? I18N : null);
    if (!I) return "en";
    try { return (LANG = I.lang() === "pl" ? "pl" : "en"); } catch (e) { return "en"; }
  };
  /* Polish when names.js has none: the translator's word for the original name. Towns and places have always been
     shown as they are in Polish (like the Polish release), so they keep their name. */
  function plOf(e) {
    if (e.type === "town" || e.type === "place") return null;
    const I = G0.I18N || (typeof I18N !== "undefined" ? I18N : null);
    if (!I) return null;
    try { return I.tr ? I.tr(e.base) : I.PL[e.base] ?? null; } catch (err) { return null; }
  }
  /* the resolver: get(id, {type, lang: "en"|"pl", case: "gen"|"loc"}) */
  function get(id, o = {}) {
    const e = entry(id, o.type);
    if (!e) { warn(id, o.type); if (id == null) return ""; const x = String(id), c = x.indexOf(":"); return c > 0 && TYPES.includes(x.slice(0, c)) ? x.slice(c + 1) : x; }
    if ((o.lang || "en") === "pl") {
      const p = e.pl;
      return (o.case && p[o.case]) || p.name || plOf(e) || e.en.name;
    }
    return e.en.name;
  }
  const local = (id, o = {}) => get(id, { ...o, lang: o.lang || lang() });
  const place = (id, o) => get(id, { ...o, type: entry(id, "town") ? "town" : entry(id, "place") ? "place" : undefined });
  const hold = (id, o) => get(id, { ...o, type: "hold" });
  const item = (id, o) => (entry(id, "item") ? get(id, { ...o, type: "item" }) : ((G0.D || {}).ITEMS?.[id]?.name ?? String(id ?? "")));
  /* forge-improved gear: the improvement level (pack row .tq, 0-6) goes after the name as "+N" ("Iron Sword +2"). Rarity words
     (Common / Fine / Rare / Epic / Legendary, rarity.js) are never used for it. Works on any name, English or reskinned. */
  const improved = (name, row) => { const q = +(row && row.tq) || 0; return q > 0 ? `${name} +${q}` : String(name ?? ""); };
  const foe = (name, o) => (entry(name, "foe") ? get(name, { ...o, type: "foe" }) : String(name ?? ""));
  const race = (id, o) => get(id, { ...o, type: "race" });
  /* {type:id} templates: "Go to {town:Whiterun}." → "Go to Whiterun." ({place:…} finds towns too) */
  function fill(text, o) {
    if (typeof text !== "string" || !text.includes("{")) return text;
    return text.replace(/\{(town|place|hold|region|faction|race|god|foe|item|npc):([^{}]+)\}/g, (m, t, id) => (t === "place" ? place(id, o) : get(id, { ...o, type: t })));
  }
  /* copy new display names onto the game's own tables (items, races, the three sides). Safe to call twice. */
  function apply() {
    built = false; build();   // everything is loaded now: read the data again
    const D0 = G0.D || (typeof D !== "undefined" ? D : null);
    if (D0 && D0.ITEMS) for (const [id, ov] of Object.entries(OVERRIDE.item)) { const it = D0.ITEMS[id]; if (!it) continue; if (!(id in baseItem)) baseItem[id] = it.name; it.name = get(id, { type: "item" }); }
    if (D0 && D0.RACES) for (const [id, r] of Object.entries(D0.RACES)) { const e = REG.get("race:" + id); if (e && r) r.name = e.en.name; }
    const SD = G0.SIDES || (typeof SIDES !== "undefined" ? SIDES : null);
    if (SD && SD.LIST) for (const [id, sd] of Object.entries(SD.LIST)) { const e = REG.get("faction:" + id); if (e && sd) sd.name = e.en.name; }
    return true;
  }
  const ids = (type) => { build(); return [...REG.values()].filter((e) => !type || e.type === type).map((e) => e.id); };
  const dump = () => { build(); return [...REG.values()].map((e) => ({ type: e.type, id: e.id, en: e.en.name, pl: e.pl.name || plOf(e) || e.en.name })); };

  // hand our own Polish names to the screen translator (i18n.js reads I18N_EXTRA.words when it loads)
  for (const e of REG.values()) if (e.pl.name && !(e.en.name in I18N_EXTRA.words)) I18N_EXTRA.words[e.en.name] = e.pl.name;
  for (const [type, tab] of Object.entries(OVERRIDE)) for (const [id, ov] of Object.entries(tab)) {
    const en = typeof ov.en === "string" ? ov.en : ov.en?.name, pl = ov.pl?.name;
    if (en && pl && !(en in I18N_EXTRA.words)) I18N_EXTRA.words[en] = pl;
  }
  if (typeof document !== "undefined" && typeof addEventListener === "function") {
    if (document.readyState === "loading") addEventListener("DOMContentLoaded", apply); else apply();
  }
  return { get, local, place, hold, item, improved, foe, race, fill, entry, ids, dump, apply, build, TYPES, TABLES: { TOWN, HOLD, REGION, FACTION, RACE, GOD, OVERRIDE } };
})();
if (typeof globalThis !== "undefined") globalThis.NAMES = NAMES;
