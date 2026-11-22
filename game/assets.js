/* ASSETS: hand-made pictures dropped into the game folder replace the drawn-by-code art.
   Every file is optional: when it's missing the game keeps its own procedural art.
   Files sit flat next to index.html. For each key the game tries <name>.webp, then .png, then .jpg.

   Manifest (name — size — notes):
     title                    1080×1920  portrait key art for the title screen
     bg-loading-1 … 4         1080×1920  loading / travel cards
     place-<slug>             1600×900   16:9 city & town backdrops
       slugs: whiterun solitude windhelm riften markarth falkreath morthal dawnstar winterhold riverwood ravenrock
     biome-<slug>             1600×900   16:9 backdrops for any other place / road scene of that kind
       slugs: tundra pineforest snowfield marsh reach rift hotsprings mountain coast ashlands cave nordruin dwemerruin falmercave
     foe-<slug>               1024×1024  transparent PNG, full body, feet at the bottom, facing right
       slugs: bandit banditchief draugr deathlord wolf bear sabrecat troll frosttroll giant mammoth spider skeever falmer
              centurion dwarvenspider spriggan hagraven vampire necromancer thalmor dragon icewraith flameatronach
              frostatronach stormatronach dremora chaurus mudcrab horker riekling ashspawn
     ui-panel                 1024×1024  tileable dark panel texture
     ui-parchment             1024×1024  tileable parchment texture
     ui-compass               1024×1024  transparent compass rose
     ui-nightsky              1080×1920  night sky for the skills (constellation) page
     ui-frame                 1024×1024  transparent 9-slice frame, 96px corners
     icon-<item-id>           256×256    optional painted item icons, transparent PNG, item id with - instead of _
       (e.g. icon-steel-sword, icon-iron-armor). Any missing icon keeps the drawn one. Worth painting first:
       armour sets (helmet/armor/gauntlets/boots/shield) hide leather iron steel chainmail elven dwarven ancient-nord
       stalhrim chitin bonemold forsworn guild nightingale shrouded; weapons iron/steel/elven/dwarven/ancient-nord/
       stalhrim/skyforge-steel swords, war axes, greatswords, battleaxes, daggers, maces, bows, crossbows, staffs.

   API: ASSETS.img(key) → a loaded HTMLImageElement or null (asks for the file the first time).
        ASSETS.url(key) → its URL or "" · ASSETS.placeKey(name) · ASSETS.biomeKey(name) · ASSETS.foeKey(name, kind)
        ASSETS.cover(g, img, w, h) draws an image to fill w×h. ASSETS.on(fn) runs fn when any picture arrives.
   Under browser automation nothing is fetched unless the URL has ?assets (keeps tests quiet). */
const ASSETS = (() => {
  const EXT = ["webp", "png", "jpg"];
  const state = new Map();   // key -> { st: "loading"|"ok"|"none", img, url }
  const subs = [];
  let auto = true;
  try { auto = !(navigator.webdriver && !/[?&]assets\b/.test(location.search)); } catch { /* ignore */ }
  try { if (/[?&]noassets\b/.test(location.search)) auto = false; } catch { /* ignore */ }
  let missing = {};
  try { missing = JSON.parse(sessionStorage.getItem("rotn_assets_missing") || "{}"); } catch { /* ignore */ }

  let pending = 0, flushT = 0;
  function arrived() {
    clearTimeout(flushT);
    flushT = setTimeout(() => {   // one refresh for a burst of pictures
      try { ART.clear?.(); } catch { /* ignore */ }
      applyCss();
      for (const f of subs) { try { f(); } catch (e) { console.warn("asset hook", e); } }
      try { window.__ui?.refresh?.(); } catch { /* ignore */ }
    }, 120);
  }
  function load(key) {
    if (state.has(key)) return state.get(key);
    const rec = { st: "none", img: null, url: "" };
    state.set(key, rec);
    if (!auto || missing[key]) return rec;
    rec.st = "loading"; pending++;
    const tryExt = (i) => {
      if (i >= EXT.length) {
        rec.st = "none"; pending--;
        missing[key] = 1; try { sessionStorage.setItem("rotn_assets_missing", JSON.stringify(missing)); } catch { /* ignore */ }
        return;
      }
      const im = new Image(), u = `${key}.${EXT[i]}`;
      im.decoding = "async";
      im.onload = () => { rec.st = "ok"; rec.img = im; rec.url = u; pending--; arrived(); };
      im.onerror = () => tryExt(i + 1);
      im.src = u;
    };
    tryExt(0);
    return rec;
  }
  const img = (key) => { if (!key) return null; const r = load(key); return r.st === "ok" ? r.img : null; };
  const url = (key) => { const r = load(key); return r.st === "ok" ? r.url : ""; };
  /* tests and the coordinator can hand pictures in directly */
  function provide(key, src) {
    const rec = { st: "loading", img: null, url: "" }; state.set(key, rec);
    const im = new Image(); im.onload = () => { rec.st = "ok"; rec.img = im; rec.url = src; arrived(); }; im.onerror = () => { rec.st = "none"; }; im.src = src;
  }
  const on = (f) => { subs.push(f); };
  const enable = (v = true) => { auto = v; if (v) { for (const [k, r] of state) if (r.st === "none" && !missing[k]) state.delete(k); } };

  // ---- names
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const PLACES = ["whiterun", "solitude", "windhelm", "riften", "markarth", "falkreath", "morthal", "dawnstar", "winterhold", "riverwood", "ravenrock"];
  function placeKey(name) { const s = slug(name); return PLACES.includes(s) ? "place-" + s : null; }
  /* the biome picture for any place, from its kind, theme, hold and ground */
  function biomeKey(name) {
    const P = (typeof WORLD !== "undefined" && WORLD.places[name]) || null; if (!P) return null;
    let theme = ""; try { theme = (typeof DUNGEONS !== "undefined" && DUNGEONS.info(name)?.theme) || (WORLD.placeThemes?.[name] || [])[0] || ""; } catch { /* ignore */ }
    const n = String(name).toLowerCase(), kind = (P[2] || "") + "";
    if (/^(cave|mine|lair|vampire)$/.test(theme)) return /falmer/.test(n) ? "biome-falmercave" : "biome-cave";
    if (/^(barrow|temple)$/.test(theme)) return "biome-nordruin";
    if (/^dwemer$/.test(theme)) return "biome-dwemerruin";
    const all = (n + " " + kind + " " + theme).toLowerCase();
    if (/falmer|blackreach|chaurus/.test(all)) return "biome-falmercave";
    if (/dwemer|dwarven|nchuand|mzulft|raldbthar|alftand|arkngthamz|kagrenzel|irkngthamz|bthardamz|mzinchaleft|dwem/.test(all)) return "biome-dwemerruin";
    if (/barrow|draugr|ruin|tomb|crypt|hall of|nordic|labyrinthian|dragonsreach|saarthal|volunruud|ustengrav/.test(all)) return "biome-nordruin";
    if (/cave|grotto|mine|den|cavern|hole|lair|pit/.test(all)) return "biome-cave";
    let x = 0.5, y = 0.5; try { x = P[0]; y = P[1]; } catch { /* ignore */ }
    if (typeof WORLD !== "undefined" && WORLD.isSol?.([x, y])) return "biome-ashlands";
    let ground = "";
    try { const T = WORLD.isSol?.([x, y]) ? null : (typeof Terrain !== "undefined" ? Terrain : null); if (T) ground = (T.NAMES[T.typeAtPos([x, y])] || "").toLowerCase(); } catch { /* ignore */ }
    if (/forest/.test(ground) && !/pine/.test(ground)) ground = "";
    if (/marsh|swamp/.test(ground)) return "biome-marsh";
    if (/hot|spring/.test(ground)) return "biome-hotsprings";
    if (/snow|glacier|ice/.test(ground)) return "biome-snowfield";
    if (/mountain|peak/.test(ground)) return "biome-mountain";
    if (/pine/.test(ground)) return "biome-pineforest";
    if (/coast|shore|sea|beach/.test(ground) || /coast|lighthouse|wreck|cove|shore/.test(n)) return "biome-coast";
    let hold = ""; try { hold = (typeof WORLD !== "undefined" && WORLD.holdAt ? WORLD.holdAt([x, y]) : "") + ""; } catch { /* ignore */ }
    hold = hold.toLowerCase();
    if (/reach/.test(hold)) return "biome-reach";
    if (/rift/.test(hold)) return "biome-rift";
    if (/hjaalmarch/.test(hold)) return "biome-marsh";
    if (/eastmarch/.test(hold)) return "biome-hotsprings";
    if (/winterhold|pale/.test(hold)) return "biome-snowfield";
    if (/falkreath|haafingar/.test(hold)) return "biome-pineforest";
    return "biome-tundra";
  }
  /* closest foe picture for a foe's name (preferred) or its drawing kind */
  const FOE_RULES = [
    [/bandit (chief|boss|leader)|chief|marauder|highwayman/, "banditchief"], [/death ?lord|draugr (scourge|deathlord)|dragon priest/, "deathlord"],
    [/draugr|restless|skeleton|wight/, "draugr"], [/ice wraith|wraith/, "icewraith"], [/frost troll/, "frosttroll"], [/troll/, "troll"],
    [/sabre|saber|cat/, "sabrecat"], [/bear/, "bear"], [/wolf|hound|dog|werewolf/, "wolf"], [/mammoth/, "mammoth"], [/giant/, "giant"],
    [/dwarven spider|spider worker|sphere/, "dwarvenspider"], [/centurion/, "centurion"], [/frostbite|spider/, "spider"], [/skeever|rat/, "skeever"],
    [/chaurus/, "chaurus"], [/falmer/, "falmer"], [/spriggan/, "spriggan"], [/hagraven/, "hagraven"], [/vampire|thrall/, "vampire"],
    [/necromancer|conjurer|lich|mage|warlock|witch|cultist|sorcer/, "necromancer"], [/thalmor|justiciar/, "thalmor"], [/dragon|odahviing|alduin|miraak/, "dragon"],
    [/flame atronach/, "flameatronach"], [/frost atronach/, "frostatronach"], [/storm atronach/, "stormatronach"], [/dremora/, "dremora"],
    [/mudcrab|crab/, "mudcrab"], [/horker/, "horker"], [/riekling/, "riekling"], [/ash spawn|ash hopper/, "ashspawn"], [/bandit|forsworn|outlaw|thug|brigand|mercenar|assassin|guard/, "bandit"],
  ];
  const KIND = { bandit: "bandit", forsworn: "bandit", draugr: "draugr", skeleton: "draugr", vampire: "vampire", mage: "necromancer", hagraven: "hagraven", falmer: "falmer",
    lich: "deathlord", troll: "troll", giant: "giant", wolf: "wolf", bear: "bear", cat: "sabrecat", spider: "spider", skeever: "skeever", dragon: "dragon", mammoth: "mammoth",
    centurion: "centurion", sphere: "dwarvenspider", dspider: "dwarvenspider", crab: "mudcrab", wisp: "icewraith", atronach: "flameatronach", flame_atronach: "flameatronach",
    frost_atronach: "frostatronach", storm_atronach: "stormatronach", dremora: "dremora", beast: "bear" };
  function foeKey(name, kind) {
    const n = String(name || "").toLowerCase();
    for (const [re, s] of FOE_RULES) if (re.test(n)) return "foe-" + s;
    return KIND[kind] ? "foe-" + KIND[kind] : null;
  }

  // ---- drawing helpers
  function cover(g, im, w, h, fx = 0.5, fy = 0.5) {
    const r = Math.max(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * r, dh = im.naturalHeight * r;
    g.drawImage(im, (w - dw) * fx, (h - dh) * fy, dw, dh);
  }
  /* UI textures go to CSS variables so the stylesheet picks them up */
  const CSS_KEYS = { "ui-panel": "--asset-panel", "ui-parchment": "--asset-parchment", "ui-compass": "--asset-compass", "ui-nightsky": "--asset-nightsky", "ui-frame": "--asset-frame", title: "--asset-title" };
  function applyCss() {
    try {
      const root = document.documentElement;
      for (const [k, v] of Object.entries(CSS_KEYS)) {
        const r = state.get(k);
        if (r && r.st === "ok") { root.style.setProperty(v, `url("${r.url}")`); root.classList.add("has-" + k); }
      }
    } catch { /* ignore */ }
  }
  function warmUi() { for (const k of Object.keys(CSS_KEYS)) load(k); }
  try { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", warmUi); else setTimeout(warmUi, 0); } catch { /* ignore */ }

  const loading = (i) => img(`bg-loading-${1 + (Math.abs(i | 0) % 4)}`);
  const status = () => [...state].map(([k, r]) => [k, r.st]);
  return { img, url, provide, on, enable, placeKey, biomeKey, foeKey, cover, loading, status, slug, CSS_KEYS, get pending() { return pending; } };
})();
