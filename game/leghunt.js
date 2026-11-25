/* Legendary monster contracts. [OURS, Skyrim creatures]
   Ten named beasts, each with a home hold, a few haunts it wanders between, one weakness, one resistance and one
   big move of its own. A Jarl posts a contract on the town board; you take it and the hunt starts:
     1. Clues (road events while you travel inside the rough area, or "Search for signs" at a place in it):
        an attacked caravan, tracks (Sneak + Archery, Hunter's Eye helps), a victim, a witness. Each one shrinks the
        area on the map and can tell you its weakness, its resistance or its big move. Three clues and you know where it is.
     2. Near it (a road event, or "Track it down" at a place close by) you choose, party leader only (members vote
        through the event window): set an ambush (chance to start hidden), track it to its lair (it strikes first, but
        the lair pays half again and gives more hide), or prepare with bait and potions (full health, it starts hurt and
        its first big move comes later).
     3. The fight is a boss fight (bossfight.js phases + its own big move). A known weakness hits half again as hard
        and its guard is down; unknown, it has 15% more health. Its resistance always cuts your damage.
     4. The Jarl's gold, a trophy for your house, rare materials (the forge turns them into a unique piece, using them
        up) and a bestiary entry that remembers what you learned, so the next hunt starts smarter.
   Party: the leader's area rides on the party card so members see it; members who fought take a trophy and hide
   from the share record (rolls seeded with NETSYNC, the same on every phone). The beast's wandering is seeded by
   the clock, so every phone agrees where it is.
   Hooks: ROAD_EVENTS (roll/choices/choose), PFX.out + MAGIC.elem (weakness, resistance), BOSSFIGHT (profiles,
   big moves, setup), PARTY (card, shares), FOERIG (looks), SMITH (recipes), ui.js (town section, wild panel,
   event chance), map.js (areas). Perks in perkfx.js: Experienced Tracker, Monster Scholar, Trophy Hunter. */
const LEGHUNT = (() => {
  const DAY = 2 * 3600;          // an in-game day (real seconds)
  const MOVE = 1800;             // it moves on to another haunt every half hour of real time
  const NEED = 3;                // clues before you know where it is
  const R0 = 150, RMIN = 34;     // the rough area's radius on the map (px), and how small it gets
  const COOL = DAY;              // a slain beast is replaced by another of its kind after a day
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (str) => (typeof NETSYNC !== "undefined" ? NETSYNC.hash(str) : [...String(str)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261));
  const rng = (seed) => (typeof NETSYNC !== "undefined" ? NETSYNC.rng(seed) : (() => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })());
  const now = () => G.now();
  const pf = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const pct = (p) => `${Math.round(clamp(p, 0, 1) * 100)}%`;
  const T = (x) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") { const r = I18N.tr(String(x)); if (r != null) return r; } } catch (e) { /* English */ } return x; };
  const hasItem = (id) => !!(id && D.ITEMS[id]);
  const count = (s, id) => (s.inv || []).filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);

  // ================================================================ the beasts
  //  weak/resist: fire | frost | shock (spells, runes, cloaks) or blunt | blade | archery (weapons)
  const L = [
    { id: "mudking", name: "The Mudcrab King", ep: "Lord of the Haafingar shore", hold: "Haafingar", town: "Solitude", lvl: 5, el: null,
      haunts: ["Brinewater Grotto", "Broken Oar Grotto", "Katla's Farm", "Dragon Bridge"], weak: "blunt", resist: "blade", sig: "pinch", tags: ["beast"], hp: 300, dmg: 16, gold: 260,
      desc: "A mudcrab the size of a cart, with a crown of barnacles. Fishermen swear it can talk.",
      meet: "The beach heaves and the Mudcrab King rises from the sand, claws clacking like a smithy.",
      track: "Deep claw drag marks run up from the water, wide as a wagon.", victim: "A fishing boat lies cut clean in half on the shingle.",
      sigLine: "The fishermen say it grabs you in one great claw and squeezes.",
      trophy: ["lh_trophy_mudking", "The Mudcrab King's Crown Shell", "A barnacled shell plate, shaped almost like a crown.", 180],
      mat: ["lh_mat_mudking", "Royal Mudcrab Chitin", "Shell as thick as a shield. A smith can work it.", 60], item: "lh_mudking_shield", look: { color: "#b0563a", scale: 2.3 } },
    { id: "whiteghost", name: "The White Ghost, Sabre Cat", ep: "The cat no hunter has seen twice", hold: "The Reach", town: "Markarth", lvl: 10, el: null,
      haunts: ["Karthwasten", "Bleakwind Bluff", "Dragontooth Crater", "Salvius Farm", "Kolskeggr Mine"], weak: "archery", resist: "frost", sig: "ghost", tags: ["beast"], hp: 420, dmg: 22, gold: 420,
      desc: "A sabre cat white as fresh snow. It takes goats from the Reach and is gone before the dogs wake.",
      meet: "Something white moves against the rocks. Then it isn't there. Then it's right in front of you.",
      track: "Big paw prints, wide apart. It was running, and nothing was chasing it.", victim: "A goat lies across the path, killed with one bite to the neck.",
      sigLine: "The guards say it vanishes, then lands on you from nowhere.",
      trophy: ["lh_trophy_whiteghost", "The White Ghost's Fang", "A sabre fang as long as your forearm, white as bone.", 220],
      mat: ["lh_mat_whiteghost", "Ghost Sabre Pelt", "A white pelt so soft it barely seems to be there.", 80], item: "lh_whiteghost_boots", look: { color: "#f2efe6", scale: 1.3 } },
    { id: "briar", name: "Old Mother Briar, Spriggan", ep: "The oldest tree in the Pale", hold: "The Pale", town: "Dawnstar", lvl: 12, el: null,
      haunts: ["Nightcaller Temple", "Weynon Stones", "Anga's Mill", "Hall of the Vigilant", "Uttering Hills Cave"], weak: "fire", resist: "archery", sig: "thorns", tags: ["beast"], hp: 440, dmg: 22, gold: 460,
      desc: "A spriggan matron older than the Pale's oldest pines. The woods wake when she walks.",
      meet: "The trees go quiet. A shape of bark and moss and green light steps out from between them.",
      track: "The prints are roots. They come up out of the ground, walk, and go back down.", victim: "A woodcutter's axe is grown right into a tree trunk, the handle still sticking out.",
      sigLine: "The caravan guards say the woods themselves threw thorns at them.",
      trophy: ["lh_trophy_briar", "Old Mother Briar's Antler Crown", "A crown of antler-like branches, still faintly glowing.", 240],
      mat: ["lh_mat_briar", "Ancient Taproot", "A living root, hard as iron. It bends but never breaks.", 85], item: "lh_briar_bow", look: { glowC: "#a8e060", scale: 1.3 } },
    { id: "vyrthax", name: "Vyrthax the Spider Queen", ep: "Mother of a thousand frostbite spiders", hold: "Winterhold", town: "Winterhold", lvl: 14, el: "frost",
      haunts: ["Hob's Fall Cave", "Bleakcoast Cave", "Stillborn Cave", "Duskglow Crevice", "Sightless Pit"], weak: "blunt", resist: "frost", sig: "web", tags: ["beast", "big"], hp: 460, dmg: 24, gold: 520,
      desc: "A frostbite spider as big as a house, with a crown of black eyes. Her brood fills every cave around Winterhold.",
      meet: "Webs hang across the road, thick as rope. Something huge and pale climbs down them.",
      track: "Web lines run from rock to rock, thick as a ship's rope.", victim: "A traveller hangs in a web cocoon, frozen stiff.",
      sigLine: "The caravan guards were caught in a web that spat venom.",
      trophy: ["lh_trophy_vyrthax", "Vyrthax's Crown of Eyes", "A ring of black, glassy spider eyes. They still seem to look at you.", 260],
      mat: ["lh_mat_vyrthax", "Queen's Silk", "Spider silk stronger than steel wire.", 90], item: "lh_vyrthax_dagger", look: { body: "#e6eadf", leg: "#f0f2ea", eye: "#7a2ad0", scale: 1.6 } },
    { id: "grimfang", name: "Grimfang the Cave Bear", ep: "The bear that eats bears", hold: "The Rift", town: "Riften", lvl: 16, el: null,
      haunts: ["Honeystrand Cave", "Pinepeak Cavern", "Merryfair Farm", "Snow-Shod Farm", "Clearspring Tarn"], weak: "fire", resist: "blunt", sig: "maul", tags: ["beast", "big"], hp: 520, dmg: 27, gold: 560,
      desc: "A cave bear with a pelt like a black storm. It has eaten three hunters and two other bears.",
      meet: "The ground shakes. Grimfang stands up on its back legs, and keeps standing up.",
      track: "Claw marks on a pine, higher than you can reach.", victim: "A beehive torn open, and the farmer who kept it lying beside it.",
      sigLine: "The guards say one swipe of its paw threw a wagon off the road.",
      trophy: ["lh_trophy_grimfang", "Grimfang's Head", "A huge bear head, the jaws open in a last roar.", 280],
      mat: ["lh_mat_grimfang", "Grimfang Bear Pelt", "Thick, black fur. Nothing bites through it.", 95], item: "lh_grimfang_gauntlets", look: { color: "#231a14", scale: 1.45 } },
    { id: "whitefang", name: "Whitefang the Frost Troll", ep: "The terror of the Dawnstar road", hold: "The Pale", town: "Dawnstar", lvl: 18, el: "frost",
      haunts: ["Blizzard Rest", "Stonehill Bluff", "Fort Dunstad", "Shearpoint", "Loreius Farm", "Red Road Pass"], weak: "fire", resist: "frost", sig: "glacier", tags: ["beast", "troll", "big"], hp: 560, dmg: 29, gold: 640,
      desc: "A frost troll with three eyes and a white mane. It came down from the mountains and won't go back.",
      meet: "A white shape uncurls from the snowdrift. Whitefang stands, roars, and the snow around you starts to blow.",
      track: "Huge three-toed prints in the snow, and a smell like wet dog and old blood.", victim: "A frozen horse lies by the road, half eaten.",
      sigLine: "The caravan guards say it roared and their horses froze where they stood.",
      trophy: ["lh_trophy_whitefang", "Whitefang's Skull", "A troll skull with three eye sockets. Heavy, and still cold.", 300],
      mat: ["lh_mat_whitefang", "White Troll Pelt", "Shaggy white fur that never gets wet.", 100], item: "lh_whitefang_armor", look: { scale: 1.6 } },
    { id: "ashtusk", name: "Ashtusk the Mammoth", ep: "The black mammoth of the plains", hold: "Whiterun", town: "Whiterun", lvl: 20, el: "fire",
      haunts: ["Bleakwind Basin", "Sleeping Tree Camp", "Guldun Rock", "Talking Stone Camp", "Secunda's Kiss"], weak: "shock", resist: "fire", sig: "charge", tags: ["beast", "big"], hp: 620, dmg: 30, gold: 700,
      desc: "A mammoth turned black and mean by something it drank. Even the giants won't herd it.",
      meet: "The ground trembles. Ashtusk comes over the hill, black as soot, and lowers its tusks.",
      track: "Footprints as big as shields, and every bush along the way trampled flat.", victim: "A giant's camp, smashed. The giant didn't get away.",
      sigLine: "The caravan guards say it charged straight through their wagons.",
      trophy: ["lh_trophy_ashtusk", "Ashtusk's Black Tusk", "A mammoth tusk black as charcoal, and twice as long as you are tall.", 320],
      mat: ["lh_mat_ashtusk", "Ash-Grey Mammoth Hide", "Grey hide that won't burn.", 105], item: "lh_ashtusk_warhammer", look: { color: "#2e2a26", scale: 1.25 } },
    { id: "palelady", name: "The Pale Lady, Wispmother", ep: "Who sings in the Morthal fog", hold: "Hjaalmarch", town: "Morthal", lvl: 22, el: "frost",
      haunts: ["Folgunthur", "Kjenstag Ruins", "Robber's Cove", "Movarth's Lair", "Stonehills"], weak: "shock", resist: "frost", sig: "wail", tags: ["undead"], hp: 520, dmg: 30, gold: 760,
      desc: "A Wispmother who sings in the marsh fog. Men who follow the song are found frozen in the reeds.",
      meet: "Blue lights drift out of the fog. A woman's voice sings, and the cold comes with it.",
      track: "Frost in a straight line across the marsh, with no footprints at all.", victim: "A hunter lies frozen in the reeds, smiling.",
      sigLine: "The caravan guards say her scream froze the blood in their veins.",
      trophy: ["lh_trophy_palelady", "The Pale Lady's Veil", "A scrap of mist that never melts. It feels like silk.", 340],
      mat: ["lh_mat_palelady", "Wisp Heart", "A cold blue light you can hold in your hand.", 110], item: "lh_palelady_circlet", look: { scale: 1.3 } },
    { id: "grimscale", name: "Grimscale the Chaurus Reaper", ep: "The Falmer's hunting beast", hold: "Eastmarch", town: "Windhelm", lvl: 25, el: "shock",
      haunts: ["Darkwater Pass", "Mzulft", "Cragslane Cavern", "Steamcrag Camp"], weak: "frost", resist: "fire", sig: "acid", tags: ["beast", "big"], hp: 620, dmg: 32, gold: 820,
      desc: "A chaurus reaper the Falmer bred for war. It got loose, and now it hunts in the hot springs.",
      meet: "Steam hisses out of the springs, and a huge chaurus rises out of it, clicking.",
      track: "Slime trails over the rocks, still warm.", victim: "A Stormcloak patrol, all four of them, eaten through their armor.",
      sigLine: "The caravan guards say it spat something that ate through steel.",
      trophy: ["lh_trophy_grimscale", "Grimscale's Mandible", "A chaurus jaw, sharp enough to shave with.", 360],
      mat: ["lh_mat_grimscale", "Reaper Chitin", "Hard, glossy chitin, light as wood.", 115], item: "lh_grimscale_sword", look: { body: "#4e6a3a", leg: "#3a4e2a", eye: "#f06a2a", scale: 1.5 } },
    { id: "hircine", name: "Bloodmoon, Werewolf of Hircine", ep: "Hircine's chosen hunter", hold: "Falkreath", town: "Falkreath", lvl: 28, el: null,
      haunts: ["Glenmoril Coven", "Bloated Man's Grotto", "Falkreath Watchtower", "Half-Moon Mill"], weak: "frost", resist: "blunt", sig: "howl", tags: ["beast", "nightkin"], hp: 640, dmg: 34, gold: 900,
      desc: "A werewolf Hircine himself picked. It hunts hunters, and it's very good at it.",
      meet: "A howl from every side at once. Bloodmoon steps onto the road, grinning with too many teeth.",
      track: "Wolf prints that turn into bare feet, and back into wolf prints.", victim: "A hunter from the Falkreath lodge, his bow snapped in two.",
      sigLine: "The caravan guards say its howl made their own wolves turn on them.",
      trophy: ["lh_trophy_hircine", "Bloodmoon's Pelt", "A werewolf pelt with a red streak down its back, like spilled blood.", 400],
      mat: ["lh_mat_hircine", "Moonlit Werewolf Claw", "A black claw that glows faintly under the moon.", 120], item: "lh_hircine_helmet", look: { scale: 1.25 } },
  ];
  const BY = Object.fromEntries(L.map((c) => [c.id, c]));

  // what the weaknesses and resistances are called, and what clues say about them
  const KIND = { fire: "Fire", frost: "Frost", shock: "Shock", blunt: "Maces and hammers", blade: "Blades and axes", archery: "Arrows" };
  const KIC = { fire: "\uE104", frost: "\uE125", shock: "\uE129", blunt: "\uE14E", blade: "\uE161", archery: "\uE10C" };
  const WEAK_LINE = {
    fire: "They saw it run from a burning cart. Fire is what it hates.",
    frost: "They saw it slow right down when the frost came. Cold makes it sluggish.",
    shock: "Lightning hit a tree beside it and it screamed. Shock hurts it.",
    blunt: "Someone cracked its hide with a hammer once. Hit it with something heavy.",
    blade: "A woodcutter's axe bit deep into it. Cut it, and it bleeds.",
    archery: "A hunter's arrow hurt it badly. Shoot it before it gets close.",
  };
  const RES_LINE = {
    fire: "The ground around is scorched, yet there's no burn on it anywhere. Fire won't do much.",
    frost: "It sleeps in the snow like a blanket. Frost barely touches it.",
    shock: "A lightning-split tree, and its tracks walking calmly away. Shock won't do much.",
    blunt: "A broken hammer lies in the mud. Heavy blows just bounce off it.",
    blade: "Snapped blades lie by the tracks. Its hide turns an edge.",
    archery: "Arrows stick in everything around, but none of them in it. Arrows won't do much.",
  };

  // ================================================================ its big move and its phases (bossfight.js)
  const SIG = {
    pinch: { ic: "\uE16A", name: "Royal Pinch", mul: 1.9, ans: ["block", "dodge"], cut: 0.4 },
    ghost: { ic: "\uE14D", name: "Ghost Pounce", mul: 2.0, ans: ["block"], cut: 0.45 },
    thorns: { ic: "\uE12B", name: "Thorn Swarm", mul: 1.9, ans: ["dodge"], cut: 0.3 },
    web: { ic: "\uE172", name: "Venom Web", mul: 1.8, ans: ["dodge", "ward"], cut: 0.35, magic: true },
    maul: { ic: "\uE170", name: "Crushing Maul", mul: 2.1, ans: ["block"], cut: 0.5 },
    glacier: { ic: "\uE125", name: "Glacier Roar", mul: 2.0, ans: ["ward", "block"], cut: 0.5, magic: true },
    charge: { ic: "\uE135", name: "Trampling Charge", mul: 2.2, ans: ["dodge"], cut: 0.3 },
    wail: { ic: "\uE192", name: "Wail of the Mist", mul: 1.9, ans: ["ward"], cut: 0.4, magic: true },
    acid: { ic: "\uE15B", name: "Acid Spit", mul: 1.9, ans: ["ward", "dodge"], cut: 0.4, magic: true },
    howl: { ic: "\uE13F", name: "Hunter's Howl", mul: 1.8, ans: ["ward", "block"], cut: 0.5, magic: true },
  };
  const PH = {
    mudking: [{ fx: ["add"], say: "{0} clacks and its royal guard crawls out of the sand", add: "Royal guard crabs" }, { fx: ["enrage"], say: "{0} snaps its claws in a fury" }],
    whiteghost: [{ fx: ["enrage"], say: "{0} melts into the snow and comes back angrier" }, { fx: ["add"], say: "{0}'s mate leaps down from the rocks", add: "Its mate" }],
    briar: [{ fx: ["add"], say: "{0} wakes the woods around you", add: "Briar thralls" }, { fx: ["enrage"], say: "{0} burns with green light" }],
    vyrthax: [{ fx: ["add"], say: "{0}'s brood pours out of the webs", add: "Spiderlings" }, { fx: ["enrage", "hazard"], say: "{0} fills the air with freezing venom", hz: "Freezing venom" }],
    grimfang: [{ fx: ["enrage"], say: "{0} rears up with a roar that shakes the trees" }, { fx: ["add"], say: "{0}'s cubs come running", add: "Its cubs" }],
    whitefang: [{ fx: ["hazard"], say: "{0} roars and a blizzard sweeps in", hz: "Biting blizzard" }, { fx: ["enrage"], say: "{0} goes berserk" }],
    ashtusk: [{ fx: ["enrage"], say: "{0} stamps and snorts black smoke" }, { fx: ["hazard"], say: "{0} sets the grass alight", hz: "Burning grass" }],
    palelady: [{ fx: ["add"], say: "{0} calls her wisps out of the fog", add: "Wisps" }, { fx: ["hazard"], say: "{0} turns the fog to freezing mist", hz: "Freezing mist" }],
    grimscale: [{ fx: ["hazard"], say: "{0} spits acid all over the ground", hz: "Acid pools" }, { fx: ["add"], say: "Falmer chaurus hunters answer {0}'s call", add: "Chaurus hunters" }],
    hircine: [{ fx: ["add"], say: "{0} howls and Hircine's hounds answer", add: "Hircine's hounds" }, { fx: ["enrage"], say: "{0} gives itself to the Hunt" }],
  };
  function registerBoss() {
    if (typeof BOSSFIGHT === "undefined") return;
    for (const [k, d] of Object.entries(SIG)) BOSSFIGHT.TELE["lh_" + k] = d;
    for (const c of L) BOSSFIGHT.PROF["lh_" + c.id] = { th: [0.6, 0.3], ep: [c.ep], tele: [["lh_" + c.sig], ["lh_" + c.sig, "slam"], ["lh_" + c.sig, "sweep"]], ph: [null, ...PH[c.id]] };
    const setup0 = BOSSFIGHT.setup;
    BOSSFIGHT.setup = function (f, sess) {
      const b = setup0.call(this, f, sess);
      const id = f && f.e && f.e.legend;
      if (!b || !BY[id]) return b;
      b.prof = "lh_" + id; b.th = [0.6, 0.3]; b.ep = BY[id].ep;
      if (f.e.lhKnown && BY[id].weak === "fire" && f.kit && f.kit.ids) f.kit.ids = f.kit.ids.filter((m) => m !== "regen");   // you came with fire: its wounds stop closing up
      if (sess && sess.ehpMax) {
        const pl = sess.players || 0;
        let k = (f.e.lhKnown ? 1 : GUARD) * (pl ? (1 + BAL.party * pl) / (1 + 0.45 * pl) : 1);   // its guard is up while you don't know where it's weak; a party hunt grows a little gentler than a dungeon boss
        const top = k;
        if (f.e.lhOpen === "prep") { k *= 0.9; b.teleCd = (b.teleCd || 0) + 2; }   // baited and ready: it starts hurt, its big move comes later
        f.ehp = Math.round(f.ehp * k); f.ehp0 = Math.round(f.ehp0 * top); sess.ehpMax = Math.round(sess.ehpMax * top); f.e.tbHp = sess.ehpMax;
        if (sess.ehpBase) sess.ehpBase *= top;
      }
      return b;
    };
  }
  const GUARD = 1.15;   // how much more health it has while you don't know its weakness
  const BAL = { hp: 0.42, dmg: 0.7, party: 0.03 };   // overall toughness (tuned with tests/test_leghunt.js sims)

  // ================================================================ weakness and resistance in the fight
  const WEAK_K = 1.5, WEAK_UNK = 1.2, RES_K = 0.6;
  function wkind(x, f) {
    const wt = (x && x.wt) || f.wt, sk = x && x.sk;
    if (sk === "Archery" || wt === "bow" || wt === "crossbow") return "archery";
    if (wt === "mace" || wt === "warhammer" || wt === "fist") return "blunt";
    return "blade";
  }
  function mulFor(f, kind) {
    const c = f && f.e && BY[f.e.legend]; if (!c) return 1;
    if (kind === c.weak) return f.e.lhKnown ? WEAK_K : WEAK_UNK;
    if (kind === c.resist) return RES_K;
    return 1;
  }
  function hookDamage() {
    if (typeof PFX !== "undefined" && !PFX.__lh) {
      const out0 = PFX.out;
      PFX.out = (f, x) => { const m = out0(f, x); return f && f.e && f.e.legend ? m * mulFor(f, wkind(x, f)) : m; };
      PFX.__lh = true;
    }
    if (typeof MAGIC !== "undefined" && !MAGIC.__lh) {
      const el0 = MAGIC.elem;
      MAGIC.elem = (f, el) => { const m = el0(f, el); return f && f.e && f.e.legend && KIND[el] ? m * mulFor(f, el) : m; };
      MAGIC.__lh = true;
    }
  }

  // ================================================================ where it is
  function hauntOf(c, t = now()) { return c.haunts[hash(c.id + "|" + Math.floor(t / MOVE)) % c.haunts.length]; }
  const placePos = (n) => (WORLD.places[n] || [0.5, 0.5]).slice(0, 2);
  /* the rough area on the map: around where it is now, never centred on it; smaller with every clue */
  function area(cur, t = now()) {
    const c = BY[cur.id], h = hauntOf(c, t), p = placePos(h);
    const r = Math.max(RMIN, R0 * 0.62 ** Math.min(6, cur.clues || 0));
    const rr = rng(hash(cur.id + "|" + (cur.seed || 0) + "|" + (cur.clues || 0) + "|" + Math.floor(t / MOVE)));
    const a = rr() * Math.PI * 2, d = (0.25 + rr() * 0.4) * r;
    return { x: p[0] + Math.cos(a) * d / G.MAP_W, y: p[1] + Math.sin(a) * d / G.MAP_H, r, haunt: h };
  }
  /* the named place nearest the middle of the area (what the hunt card and the "head there" button use) */
  function nearPlace(a) {
    let best = null, bd = 1e9;
    for (const [n, p] of Object.entries(WORLD.places)) { if (WORLD.isSol && WORLD.isSol(p)) continue; const d = G.pxDist([a.x, a.y], p); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  // ================================================================ the save
  function st(s) { const h = (s.lhunt = s.lhunt || {}); h.best = h.best || {}; h.done = h.done || {}; if (h.cur === undefined) h.cur = null; return h; }
  const cur = (s) => st(s).cur;
  const best = (s, id) => (st(s).best[id] = st(s).best[id] || { seen: 0, kills: 0, weak: 0, resist: 0, sig: 0 });
  const coolLeft = (s, id, t = now()) => Math.max(0, (st(s).done[id] || -1e12) + COOL - t);
  const scholar = (s) => pf(s, "lhscholar") > 0;
  const tracker = (s) => pf(s, "lhclue") > 0;
  const canDecide = (s) => { try { return typeof PARTYPLAY === "undefined" || PARTYPLAY.canDecide(s); } catch (e) { return true; } };
  function known(s, id) {
    const c = cur(s), b = st(s).best[id] || {};
    const k = c && c.id === id ? c.known : {};
    return { weak: !!(k.weak || b.weak), resist: !!(k.resist || b.resist || scholar(s)), sig: !!(k.sig || b.sig) };
  }

  // ================================================================ taking a contract
  function accept(s, id) {
    const c = BY[id]; if (!c) return { err: "No such contract." };
    if (!canDecide(s)) return { err: "In a party only your leader takes contracts." };
    if (cur(s)) return { err: "Finish the hunt you're on first (or give it up)." };
    if ((s.level || 1) < c.lvl) return { err: "The steward shakes his head. Come back when you've a few more scars." };
    if (coolLeft(s, id) > 0) return { err: "It's dead. Another will take its place, but not yet." };
    const b = best(s, id); b.seen = (b.seen || 0) + 1;
    st(s).cur = { id, t: now(), clues: 0, known: { weak: b.weak ? 1 : 0, resist: b.resist || scholar(s) ? 1 : 0, sig: b.sig ? 1 : 0 }, seed: hash((s.id || "me") + "|" + id + "|" + Math.floor(now())), searched: [], kinds: [] };
    const a = area(st(s).cur);
    return { title: "A legendary hunt", text: `The Jarl's steward hands you the contract and points at the map. Last seen around ${nearPlace(a)}. Find signs of it: tracks, people it's attacked, anyone who saw it.` };
  }
  function abandon(s) {
    if (!cur(s)) return { err: "You're not on a hunt." };
    if (!canDecide(s)) return { err: "In a party only your leader can call off the hunt." };
    st(s).cur = null;
    return { text: "You tear up the contract. Someone else can have it." };
  }

  // ================================================================ clues
  const ORDER = ["tracks", "witness", "victim", "caravan"];
  function nextKind(c) {
    const r = rng(hash(c.id + "|" + c.seed)), list = ORDER.slice().sort(() => r() - 0.5);
    const left = list.filter((k) => !c.kinds.includes(k));
    return left.length ? left[0] : list[(c.kinds.length + c.clues) % list.length];
  }
  function reveal(s, what) {
    const c = cur(s); if (!c || c.known[what]) return false;
    c.known[what] = 1; best(s, c.id)[what] = 1; return true;
  }
  function revealLine(s, what) {
    const c = BY[cur(s).id];
    if (what === "weak") return WEAK_LINE[c.weak];
    if (what === "resist") return RES_LINE[c.resist];
    return c.sigLine;
  }
  /* one clue: the area shrinks, and maybe you learn something. Returns the lines to show. */
  function addClue(s, kind, learn) {
    const c = cur(s); if (!c) return [];
    const was = c.clues;
    c.clues += 1 + (tracker(s) ? 1 : 0); c.kinds.push(kind);
    const out = [];
    for (const w of learn) if (reveal(s, w)) out.push(revealLine(s, w));
    if (tracker(s)) { const w = ["weak", "resist", "sig"].find((k) => !c.known[k]); if (w && reveal(s, w)) out.push("Experienced Tracker: you read one more thing from the signs.", revealLine(s, w)); }
    out.push(c.clues >= NEED ? (was < NEED ? "You know where it'll be now. Go and finish this." : "") : "The search area on your map gets smaller.");
    return out.filter(Boolean);
  }
  const trackCh = (s) => clamp((typeof ENC !== "undefined" ? ENC.trackCh(s) : 0.4) + 0.08 * (G.P(s, "hunters_eye") || 0) + (tracker(s) ? 0.15 : 0), 0.1, 0.95);
  function clueEvent(s) {
    const c = cur(s), def = BY[c.id], kind = nextKind(c);
    const text = { caravan: "A caravan lies wrecked across the road, crates smashed and horses gone. The guards are bandaging each other.",
      tracks: def.track, victim: def.victim, witness: "A farmer waves you down, white as a sheet. She saw it this morning, and she wants it dead." }[kind];
    return { id: "lh_clue", title: "Signs of the hunt", lh: c.id, kind, text };
  }
  function clueChoices(e, s) {
    const act = { tracks: ["read", `\uE115 Read the tracks (${pct(trackCh(s))})`], victim: ["look", "\uE105 Look over the body"], witness: ["ask", "\uE110 Ask what they saw"], caravan: ["look", "\uE105 Talk to the guards"] }[e.kind];
    return [act, ["leave", "Not now"]];
  }
  function clueChoose(s, e, ch) {
    const c = cur(s);
    if (ch === "leave" || !c || c.id !== e.lh) return { text: "You note the spot and move on." };
    let learn = [], lines = [], skills = [];
    if (e.kind === "tracks") {
      const win = Math.random() < trackCh(s);
      skills = G.useSkill(s, "Sneak", win ? 20 : 6) || [];
      if (win) { learn = ["resist"]; lines.push("You read the tracks like a book: how it walks, where it rests, what it's afraid of."); }
      else lines.push("You lose the trail on stony ground, but you know which way it went.");
    } else if (e.kind === "victim") { learn = known(s, c.id).resist ? ["weak"] : ["resist"]; lines.push("You look over what's left. It tells you more than you'd like."); }
    else if (e.kind === "witness") { learn = ["weak"]; skills = G.useSkill(s, "Speechcraft", 15) || []; lines.push("You calm them down and listen."); }
    else { learn = ["sig"]; lines.push("The guards tell you what happened."); }
    lines = lines.concat(addClue(s, e.kind, learn));
    return { text: lines.join(" "), skills };
  }
  /* "Search for signs" at a place inside the area (once per place) */
  function search(s) {
    const c = cur(s); if (!c) return { err: "You're not on a hunt." };
    if (!canDecide(s)) return { err: "In a party only your leader searches. Stay close." };
    if (!s.location || s.trip) return { err: "Stop somewhere first." };
    if (c.clues >= NEED) return { err: "You've seen enough signs. Track it down." };
    if (c.searched.includes(s.location)) return { err: "You've already searched here." };
    const a = area(c); if (G.pxDist([s.x, s.y], [a.x, a.y]) > a.r * 1.25 + 20) return { err: "Nothing here. It's not been this way. Search inside the area on your map." };
    c.searched.push(s.location);
    const kind = { farm: "witness", town: "witness", city: "witness", camp: "victim", dungeon: "tracks", lair: "tracks", fort: "victim", landmark: "tracks" }[(WORLD.places[s.location] || [])[2]] || "tracks";
    const ev = { lh: c.id, kind };
    const intro = kind === "witness" ? "Someone here saw it, and is glad to talk about it." : kind === "victim" ? BY[c.id].victim : BY[c.id].track;
    const r = clueChoose(s, ev, kind === "tracks" ? "read" : "look");
    return { title: "Signs of the hunt", text: intro + " " + r.text };
  }

  // ================================================================ the meeting, the choice and the fight
  const ambushCh = (s) => clamp(0.35 + G.skill(s, "Sneak") / 220 + (tracker(s) ? 0.1 : 0) + (G.isNight(now()) ? 0.05 : 0), 0.1, 0.9);
  const BAIT = () => (D.ITEMS ? Object.keys(D.ITEMS).filter((id) => /^food_(venison|horker)|meat|beef|mutton|salmon|chicken|leg_of_goat|_steak/.test(id)) : []);
  const baitIn = (s) => BAIT().find((id) => count(s, id) > 0) || null;
  function near(s, t = now()) {
    const c = cur(s); if (!c || c.clues < NEED) return false;
    const a = area(c, t);
    return G.pxDist([s.x, s.y], placePos(a.haunt)) <= Math.max(80, a.r * 1.3);
  }
  function meetEvent(s) {
    const c = cur(s), def = BY[c.id];
    return { id: "lh_meet", title: "The beast you've been hunting", lh: c.id, text: def.meet + " " + "How do you want to do this?" };
  }
  function meetChoices(e, s) {
    return [["ambush", `\uE10C Set an ambush (${pct(ambushCh(s))})`], ["lair", "\uE115 Track it to its lair"], ["prep", `\uE149 Prepare: bait and potions${baitIn(s) ? "" : " (needs meat)"}`], ["leave", "Not yet"]];
  }
  function foeFor(s, id, open) {
    const c = BY[id], k = known(s, id);
    return { name: c.name, level: c.lvl, danger: "high", tags: [...c.tags, "legend", "elite"], health: Math.round(c.hp * BAL.hp), damage: Math.round(c.dmg * BAL.dmg), gold: [0, 0], text: c.desc,
      boss: true, qboss: true, legend: id, lhKnown: k.weak ? 1 : 0, lhOpen: open, epithet: c.ep, hitCap: 0.34, ...(c.el ? { element: c.el } : {}) };
  }
  function meetChoose(s, e, ch) {
    const c = cur(s);
    if (!c || c.id !== e.lh) return { text: "It's gone. Whatever it was, it's not your hunt any more." };
    if (ch === "leave") return { text: "You hold back. It'll still be out there, somewhere close." };
    let r;
    if (ch === "ambush") {
      const win = Math.random() < ambushCh(s);
      r = { text: win ? "You settle in downwind and wait. It walks right past you." : "A twig snaps under your boot. It turns.", hidden: win, skills: G.useSkill(s, "Sneak", win ? 25 : 8) || [] };
    } else if (ch === "lair") r = { text: "You follow the signs right into its lair. It's waiting for you.", enemyFirst: true };
    else if (ch === "prep") {
      const bait = baitIn(s); if (!bait) return { text: "You've got no meat to bait it with. Venison or any raw meat will do.", keep: true };
      SMITH.use(s, [[bait, 1]]); G.setHealth(s, G.maxHealth(s));
      r = { text: "You leave the meat in the open, drink your potions and wait. It comes for the bait, and you're ready." };
    } else return { text: "" };
    r.foe = foeFor(s, c.id, ch);
    r.afterFn = (ss) => reward(ss, c.id, ch);
    return r;
  }
  /* the Jarl pays, you skin it, the trophy is yours */
  function reward(s, id, open) {
    const c = BY[id], b = best(s, id), first = !(b.kills > 0), th = pf(s, "lhharvest");
    const gold = Math.round(c.gold * (1 + 0.03 * (s.level || 1)) * (open === "lair" ? 1.5 : 1) * (first ? 1 : 0.5));
    s.gold += gold;
    G.give(s, c.trophy[0], 1);
    const mats = 2 + (open === "lair" ? 1 : 0) + th;
    G.give(s, c.mat[0], mats);
    const uniq = Math.random() < (first ? 0.15 : 0.08) + pf(s, "lhuniq");
    if (uniq && hasItem(c.item)) G.give(s, c.item, 1);
    b.kills = (b.kills || 0) + 1; b.first = b.first || now(); b.last = now();
    const k = cur(s) && cur(s).id === id ? cur(s).known : {}; for (const w of ["weak", "resist", "sig"]) if (k[w]) b[w] = 1;
    st(s).done[id] = now(); st(s).cur = null;
    const lines = [`${c.name} is dead.`, `The Jarl's reward: ${gold} gold.`, `Trophy: ${D.ITEMS[c.trophy[0]].name}.`, `You skin it: ${mats}× ${D.ITEMS[c.mat[0]].name}.`];
    if (th) lines.push("Trophy Hunter: you take the best of the hide.");
    if (uniq && hasItem(c.item)) lines.push(`Among its bones you find ${D.ITEMS[c.item].name}!`);
    lines.push("Your bestiary has a new entry.");
    return lines.join(" ");
  }

  // ================================================================ road events
  function roll(s) {
    const c = cur(s); if (!c || !s.trip || s.trip.boat || s.trip.carriage) return null;
    const t = now(), a = area(c, t), pos = [s.x, s.y];
    if (c.clues >= NEED) return near(s, t) ? meetEvent(s) : null;
    if (G.pxDist(pos, [a.x, a.y]) <= a.r * 1.25 + 20 && Math.random() < 0.8) return clueEvent(s);
    return null;
  }
  /* road events come more often while you're inside the area (ui.js multiplies its chance by this) */
  function eventBoost(s) {
    const c = s && cur(s); if (!c || !s.trip) return 1;
    if (near(s)) return 8;
    const a = area(c); return G.pxDist([s.x, s.y], [a.x, a.y]) <= a.r * 1.25 + 20 ? 4 : 1;
  }
  const isOurs = (e) => !!(e && (e.id === "lh_clue" || e.id === "lh_meet"));
  function hookEvents() {
    if (typeof ROAD_EVENTS === "undefined" || ROAD_EVENTS.__lh) return;
    const base = { roll: ROAD_EVENTS.roll, choices: ROAD_EVENTS.choices, choose: ROAD_EVENTS.choose };
    ROAD_EVENTS.roll = (s) => { let e = null; try { e = roll(s); } catch (err) { e = null; } return e || base.roll(s); };
    ROAD_EVENTS.choices = (e, s) => (isOurs(e) ? (e.id === "lh_clue" ? clueChoices(e, s) : meetChoices(e, s)) : base.choices(e, s));
    ROAD_EVENTS.choose = (s, e, ch) => (isOurs(e) ? (e.id === "lh_clue" ? clueChoose(s, e, ch) : meetChoose(s, e, ch)) : base.choose(s, e, ch));
    ROAD_EVENTS.__lh = true;
  }
  /* "Track it down" from where you stand: a short trip to its haunt that opens on the meeting */
  function trackDown(s) {
    const c = cur(s); if (!c) return { err: "You're not on a hunt." };
    if (!canDecide(s)) return { err: "In a party only your leader decides when to strike." };
    if (s.trip || s.dungeon) return { err: "Stop somewhere first." };
    if (c.clues < NEED) return { err: "You don't know where it is yet. Find more signs." };
    if (!near(s)) return { err: "It's not close. Head into the area on your map." };
    const h = area(c).haunt, err = G.startTrip(s, h, placePos(h));
    if (err) return { err };
    s.trip.status = "event"; s.trip.event = meetEvent(s); s.trip.lastTick = now();
    return { event: true, title: "The beast you've been hunting" };
  }
  function act(s, id, arg) {
    if (id === "accept") return accept(s, arg);
    if (id === "abandon") return abandon(s);
    if (id === "search") return search(s);
    if (id === "track") return trackDown(s);
    return { err: "Nothing to do." };
  }

  // ================================================================ items and the forge
  function addItems() {
    const add = {};
    for (const c of L) {
      add[c.trophy[0]] = { name: c.trophy[1], slot: "misc", weight: 3, value: c.trophy[3], trophy: true, desc: c.trophy[2] };
      add[c.mat[0]] = { name: c.mat[1], slot: "material", weight: 1, value: c.mat[3], desc: c.mat[2] };
    }
    Object.assign(add, {
      lh_mudking_shield: { name: "Mudcrab King's Shell Shield", slot: "shield", type: "heavy", armor: 27, weight: 10, value: 520, desc: "A shield cut from the Mudcrab King's own shell." },
      lh_whiteghost_boots: { name: "White Ghost Boots", slot: "feet", type: "light", armor: 12, weight: 2, value: 640, aenchant: { key: "skill:Sneak", mag: 15, name: "Fortify Sneak" }, desc: "Soft white boots. You make no sound in them." },
      lh_briar_bow: { name: "Briarwood Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 17, weight: 9, value: 760, desc: "A bow of living root. It creaks like a tree in the wind." },
      lh_vyrthax_dagger: { name: "Queen's Fang", slot: "weapon", hands: 1, skill: "One-Handed", damage: 10, weight: 3, value: 820,
        enchant: { effect: "frost", magnitude: 12, max_magnitude: 25, base_cost: 12, capacity: 1400 }, desc: "A dagger made from the Spider Queen's fang, wrapped in her silk." },
      lh_grimfang_gauntlets: { name: "Grimfang Gauntlets", slot: "hands", type: "light", armor: 12, weight: 4, value: 700, aenchant: { key: "max:health", mag: 25, name: "Fortify Health" }, desc: "Bear-paw gauntlets, claws and all." },
      lh_whitefang_armor: { name: "Whitefang Pelt Armor", slot: "chest", type: "light", armor: 32, weight: 9, value: 1100, aenchant: { key: "max:health", mag: 30, name: "Fortify Health" }, desc: "White troll fur over leather. It never gets wet." },
      lh_ashtusk_warhammer: { name: "Ashtusk Warhammer", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 25, weight: 24, value: 1200, desc: "A hammer with a black tusk for a head." },
      lh_palelady_circlet: { name: "Pale Lady's Circlet", slot: "head", type: "light", armor: 8, weight: 1, value: 1150, aenchant: { key: "max:magicka", mag: 40, name: "Fortify Magicka" }, desc: "A thin silver circlet with a wisp heart set in it." },
      lh_grimscale_sword: { name: "Grimscale Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 14, weight: 9, value: 1250,
        enchant: { effect: "shock", magnitude: 14, max_magnitude: 30, base_cost: 14, capacity: 1600 }, desc: "A blade of reaper chitin. It hisses when it cuts." },
      lh_hircine_helmet: { name: "Bloodmoon Wolf Helm", slot: "head", type: "light", armor: 17, weight: 3, value: 1400, aenchant: { key: "max:stamina", mag: 40, name: "Fortify Stamina" }, desc: "A werewolf's head, made into a helmet. Hircine approves." },
    });
    for (const [id, it] of Object.entries(add)) if (!D.ITEMS[id]) D.ITEMS[id] = it;
    if (typeof SMITH === "undefined") return;
    if (!SMITH.GROUPS.some((g) => g[0] === "legend")) SMITH.GROUPS.push(["legend", "Legendary hunts"]);
    const extra = { mudking: [["mat_iron", 2]], whiteghost: [["mat_leather", 2]], briar: [["mat_firewood", 2]], vyrthax: [["mat_steel", 1]], grimfang: [["mat_leather", 2]],
      whitefang: [["mat_leather", 3]], ashtusk: [["mat_steel", 3]], palelady: [["mat_silver", 1]], grimscale: [["mat_steel", 2]], hircine: [["mat_leather", 2]] };
    for (const c of L) SMITH.RECIPES[c.item] = { group: "legend", mats: [[c.mat[0], 3], ...extra[c.id].filter(([i]) => D.ITEMS[i]), ["mat_strips", 1]], perk: null };
  }

  // ================================================================ party: the leader's area on the card, shares for members
  let leaderCard = () => null;
  function hookParty() {
    if (typeof PARTY === "undefined" || PARTY.__lh) return;
    const cb0 = PARTY.cardBits;
    PARTY.cardBits = (s, party) => { const b = cb0(s, party); const c = cur(s); if (!c || !party) return b; const a = area(c); return { ...b, lh: { id: c.id, x: +a.x.toFixed(4), y: +a.y.toFixed(4), r: Math.round(a.r), ready: c.clues >= NEED ? 1 : 0 } }; };
    const sd0 = PARTY.shareDoc;
    PARTY.shareDoc = (s, fight, ids, names, t) => { const r = sd0(s, fight, ids, names, t); const id = fight && fight.e && fight.e.legend; if (id && BY[id]) r.doc.lh = id; return r; };
    const give0 = PARTY.give;
    PARTY.give = (s, id, doc, got) => {
      const r = give0(s, id, doc, got);
      if (!r || !doc || !BY[doc.lh]) return r;
      const c = BY[doc.lh], rr = rng(hash(`${id}|${s.id || ""}|lh`)), n = 1 + (rr() < 0.5 ? 1 : 0) + pf(s, "lhharvest");
      G.give(s, c.trophy[0], 1); G.give(s, c.mat[0], n);
      const b = best(s, c.id); b.kills = (b.kills || 0) + 1; b.first = b.first || now(); b.last = now();
      r.text += " " + `Your share of the hunt: ${D.ITEMS[c.trophy[0]].name}, ${n}× ${D.ITEMS[c.mat[0]].name}.`;
      return r;
    };
    PARTY.__lh = true;
    if (typeof PARTYPLAY !== "undefined") {
      const ui0 = PARTYPLAY.ui;
      PARTYPLAY.ui = (cx) => { leaderCard = () => { const p = cx.party(); return p && p.leader !== cx.S().id ? cx.cardOf(p.leader) : null; }; return ui0(cx); };
    }
  }
  const leaderHunt = () => { try { const c = leaderCard(); return c && c.lh && BY[c.lh.id] ? c.lh : null; } catch (e) { return null; } };

  // ================================================================ the look: the same rigs as every other foe, made bigger and stranger
  function look(k, name) {
    const c = L.find((x) => x.name === name); if (!c || !k) return k;
    return { ...k, o: { ...(k.o || {}), ...c.look, scale: ((k.o && k.o.scale) || 1) * (c.look.scale || 1.2) } };
  }
  function hookLook() {
    if (typeof FOERIG === "undefined" || FOERIG.__lh || typeof FOERIG.lookHook !== "function") return;
    FOERIG.lookHook(look); FOERIG.__lh = true;
  }
  /* an ink portrait for the poster: the fight rig, drawn still, cropped to fit */
  const pics = new Map();
  function portrait(id, size = 92) {
    const key = id + "|" + size + "|" + (typeof ART !== "undefined" && ART.style ? ART.style() : "");
    if (pics.has(key)) return pics.get(key);
    let url = "";
    try {
      if (typeof document === "undefined" || typeof FOERIG === "undefined" || typeof FIGHTART === "undefined") throw 0;
      const c = BY[id], e = { name: c.name, tags: c.tags }, W = 420, Hh = 320, cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
      const g = cv.getContext("2d"); g.save(); g.translate(W / 2, Hh - 30); g.scale(-1, 1);
      FOERIG.ctl(FIGHTART.foeOf(e), c.name).draw(g, { t: 0.4 }); g.restore();
      const d = g.getImageData(0, 0, W, Hh).data; let x0 = W, y0 = Hh, x1 = 0, y1 = 0;
      for (let y = 0; y < Hh; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const out = document.createElement("canvas"); out.width = out.height = size; const o = out.getContext("2d");
      if (x1 > x0 && y1 > y0) { const k = Math.min((size - 8) / (x1 - x0), (size - 8) / (y1 - y0)); const w = (x1 - x0) * k, h = (y1 - y0) * k; o.drawImage(cv, x0, y0, x1 - x0, y1 - y0, (size - w) / 2, size - 4 - h, w, h); }
      url = out.toDataURL();
    } catch (err) { url = ""; }
    pics.set(key, url);
    return url;
  }
  const pic = (id, size) => { const u = portrait(id, size); return u ? `<img class="lh-pic" src="${u}" width="${size || 92}" height="${size || 92}" alt="">` : `<span class="lh-pic lh-ph">\uE115</span>`; };

  // ================================================================ the screens
  const tl = (x) => `<b>${T(KIND[x])}</b>`;
  const unknownTxt = () => `<i class="lh-unk">${T("Unknown")}</i>`;
  function traits(s, id) {
    const c = BY[id], k = known(s, id);
    return `<div class="lh-traits"><span>${T("Weak to:")} ${k.weak ? KIC[c.weak] + " " + tl(c.weak) : unknownTxt()}</span><span>${T("Resists:")} ${k.resist ? KIC[c.resist] + " " + tl(c.resist) : unknownTxt()}</span><span>${T("Big move:")} ${k.sig ? `${SIG[c.sig].ic} <b>${T(SIG[c.sig].name)}</b>` : unknownTxt()}</span></div>`;
  }
  const dots = (n) => `<span class="lh-dots">${Array.from({ length: NEED }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
  function huntCard(s, esc, where) {
    const c = cur(s); if (!c) return "";
    const def = BY[c.id], a = area(c), np = nearPlace(a), ready = c.clues >= NEED, inside = G.pxDist([s.x, s.y], [a.x, a.y]) <= a.r * 1.25 + 20;
    const lead = canDecide(s);
    const btns = [];
    if (where === "wild" && s.location && !s.trip && !ready && inside && !c.searched.includes(s.location)) btns.push(`<button class="btn sm pri" data-act="lhact" data-id="search">\uE105 ${T("Search for signs here")}</button>`);
    if (ready && near(s) && !s.trip) btns.push(`<button class="btn sm danger" data-act="lhact" data-id="track">\uE101 ${T("Track it down")}</button>`);
    if (np && s.location !== np && !s.trip) btns.push(`<button class="btn sm" data-act="go" data-place="${esc(np)}">\uE14C ${T("Head for the area")}</button>`);
    if (where === "town") btns.push(`<button class="btn sm" data-act="lhact" data-id="abandon">${T("Give up the hunt")}</button>`);
    return `<div class="lh-card lh-hunt">${pic(c.id, 72)}<div class="t"><b>\uE115 ${esc(T(def.name))}</b>
      <span>${T(ready ? "You know where it is. Get close and track it down." : "Find signs of it inside the area on your map.")}</span>
      <span>${T("Clues:")} ${dots(c.clues)} · ${T("Somewhere around")} <b>${esc(T(np || ""))}</b> (${esc(T(G.holdAt([a.x, a.y]) || ""))})</span>
      ${traits(s, c.id)}${lead ? "" : `<span class="sub">${T("Your party leader leads the hunt.")}</span>`}
      ${btns.length && lead ? `<div class="lh-btns">${btns.join("")}</div>` : ""}</div></div>`;
  }
  function poster(s, c, esc, l) {
    const lvlOk = (s.level || 1) >= c.lvl, cool = coolLeft(s, c.id), b = st(s).best[c.id] || {}, on = cur(s)?.id === c.id, busy = !!cur(s);
    const pay = Math.round(c.gold * (1 + 0.03 * (s.level || 1)) * (b.kills ? 0.5 : 1));
    const state = on ? `<span class="lh-tag on">${T("Your hunt")}</span>` : cool > 0 ? `<span class="lh-tag">${T("Slain")} · ${Math.ceil(cool / 3600)} h</span>` : !lvlOk ? `<span class="lh-tag">${T("Level")} ${c.lvl}+</span>` : "";
    const btn = !on && !busy && lvlOk && cool <= 0 && canDecide(s) ? `<button class="btn sm pri" data-act="lhact" data-id="accept" data-c="${c.id}">${T("Take the contract")}</button>` : "";
    return `<div class="lh-poster${c.town === l ? " here" : ""}">${pic(c.id)}<div class="t"><b>${esc(T(c.name))}</b><small>${esc(T(c.ep))}</small>
      <span>${esc(T(c.desc))}</span>
      <span>\uE122 ${esc(T(c.hold))} · ⚑ ${T("Posted by the Jarl of")} ${esc(T(c.town))} · <b class="gold">${pay}</b> ${T("gold")}</span>
      ${b.seen || scholar(s) ? traits(s, c.id) : ""}${state}${btn}</div></div>`;
  }
  function bestiary(s, esc) {
    const seen = L.filter((c) => (st(s).best[c.id] || {}).seen || (st(s).best[c.id] || {}).kills);
    if (!seen.length) return `<p class="sub">${T("Your bestiary is empty. Take a contract to start it.")}</p>`;
    return seen.map((c) => { const b = st(s).best[c.id]; return `<div class="item lh-best">${pic(c.id, 48)}<div class="t"><b>${esc(T(c.name))}</b><span>${T("Slain:")} ${b.kills || 0} · ${esc(T(c.hold))}</span>${traits(s, c.id)}</div></div>`; }).join("");
  }
  const sections = (l) => (l && typeof TOWNS !== "undefined" && TOWNS.isTown(l) ? ["hunts"] : []);
  const names = () => ({ hunts: "\uE115 Legendary hunts" });
  function townHTML(s, esc) {
    const l = s.location, local = L.filter((c) => c.town === l), rest = L.filter((c) => c.town !== l);
    const note = "Jarls pay well for the beasts that terrorise their holds. Take a contract, find signs of it on the road (the area on your map shrinks with every clue), then choose how to face it. Learn its weakness first: it makes the fight much easier.";
    const body = `${huntCard(s, esc, "town")}
      ${local.length ? `<h3>⚑ ${T("The Jarl's own contracts")}</h3>${local.map((c) => poster(s, c, esc, l)).join("")}` : ""}
      <h3>\uE103 ${T("Contracts from across Skyrim")}</h3>${rest.map((c) => poster(s, c, esc, l)).join("")}
      <h3>\uE108 ${T("Bestiary")}</h3>${bestiary(s, esc)}`;
    return { note, body };
  }
  /* out in the wilds: the hunt card with Search / Track it down (ui.js puts it on top of the place panel) */
  function wildHTML(s, esc) { return cur(s) || leaderHunt() ? `<div class="panel lh-wild">${cur(s) ? huntCard(s, esc, "wild") : `<p class="sub">\uE115 ${T("Your party leader is on a legendary hunt. Stay close.")}</p>`}</div>` : ""; }

  // ================================================================ the map: rough areas, never exact markers
  function drawMap(g, P, sc, s, t, rm) {
    s = s || (ctx && ctx.S && ctx.S()); if (!s) return;
    const list = [];
    const c = cur(s); if (c) list.push({ ...area(c), id: c.id, ready: c.clues >= NEED });
    const lh = !c ? leaderHunt() : null; if (lh) list.push({ x: lh.x, y: lh.y, r: lh.r, id: lh.id, ready: !!lh.ready });
    for (const a of list) {
      const [x, y] = P([a.x, a.y]), [x2] = P([a.x + a.r / G.MAP_W, a.y]), R = Math.max(10, Math.abs(x2 - x));
      const pu = rm ? 0.5 : (Math.sin((t || 0) * 2) + 1) / 2;
      g.save();
      g.fillStyle = a.ready ? `rgba(170,40,30,${0.1 + 0.06 * pu})` : `rgba(150,110,50,${0.1 + 0.05 * pu})`;
      g.strokeStyle = a.ready ? "rgba(170,40,30,0.75)" : "rgba(120,85,40,0.7)"; g.lineWidth = 1.6 * sc;
      if (g.setLineDash) g.setLineDash([5 * sc, 4 * sc]);
      g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.stroke();
      if (g.setLineDash) g.setLineDash([]);
      g.font = `${Math.round(13 * sc)}px serif`; g.textAlign = "center"; g.fillStyle = "#3a2414";
      g.fillText("\uE115", x, y + 4 * sc);
      g.font = `bold ${Math.round(10 * sc)}px serif`; g.fillStyle = "rgba(40,24,12,0.9)";
      g.fillText(T(BY[a.id].name), x, y + R + 12 * sc);
      g.restore();
    }
  }

  // ================================================================ wiring
  let ctx = null;
  function mount(c) { ctx = c; }
  function init() {
    addItems(); registerBoss(); hookDamage(); hookEvents(); hookParty(); hookLook();
  }
  init();

  return { BAL, L, BY, NEED, MOVE, COOL, SIG, KIND, GUARD, WEAK_K, WEAK_UNK, RES_K, hauntOf, area, nearPlace, st, cur, best, known, accept, abandon, search, trackDown, act,
    addClue, clueEvent, meetEvent, foeFor, reward, roll, eventBoost, near, mulFor, look, portrait, sections, names, townHTML, wildHTML, huntCard, drawMap, mount,
    trackCh, ambushCh, baitIn, setLeaderCard: (fn) => { leaderCard = fn; }, get ctx() { return ctx; } };
})();
