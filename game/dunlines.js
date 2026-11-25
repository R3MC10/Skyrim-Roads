/* dunlines.js: what you see when you walk into a dungeon room with a foe in it. [OURS]
   Several dungeon foes are the same records as the road encounters (data.js), so a room used to say "Webs stretch across
   the road" or "A bandit blocks the road" deep inside a barrow. These are indoor lines per foe kind (the dungeons.js ENEMY
   key), with lines of their own for some dungeon themes. Foes made only for dungeons already have indoor text and are not
   listed. Polish for every line is in i18n_gptqa.js. */
const DUNLINES = (() => {
  // key -> { any: [lines], <theme>: [lines] }   (a theme's lines replace the general ones there)
  const L = {
    draugr: {
      any: ["A draugr climbs out of its burial niche, eyes glowing blue.", "Stone scrapes on stone. A draugr pushes its coffin lid aside and stands up."],
    },
    skeleton: {
      any: ["Bones rattle in a side passage. A skeleton steps out, sword in hand.", "A heap of bones by the wall pulls itself together into a skeleton."],
      temple: ["A skeleton stands guard by a cracked altar and turns its skull towards you."],
    },
    spider: {
      any: ["Thick webs hang from the ceiling. Something large shifts in the dark above you.", "A frostbite spider drops from a web in the corner, fangs dripping."],
      dwemer: ["Webs choke a broken pipe. A frostbite spider crawls out between the brass gears."],
    },
    wolf: {
      any: ["A lone wolf growls from the shadows at the back of the chamber, then lunges."],
      cave: ["A wolf looks up from a pile of gnawed bones and bares its teeth."],
      banditcamp: ["A bandits' guard wolf breaks its rope and runs at you."],
    },
    wolves: {
      any: ["Eyes glint in the dark of the den. A pack of wolves pours out of the tunnel."],
    },
    bear: {
      any: ["This is a bear's den. The bear rises on its hind legs and roars, and the whole cave rings with it."],
    },
    bandit: {
      any: ["A bandit jumps up from a bedroll by the fire. \"We've got company!\""],
      cave: ["Bandits have made a camp in this cave. One of them grabs an axe: \"Who let you in?\""],
      mine: ["A bandit drops his pickaxe by the ore cart and draws a blade instead."],
      fort: ["A bandit on the wall walk shouts down to the yard and comes at you."],
      banditcamp: ["A bandit kicks over a stool by the tents. \"Your money or your life!\""],
      thalmor: ["A hired sword in the keep's hall puts down his mug. \"The Thalmor pay me to keep people like you out.\""],
    },
    forsworn: {
      any: ["Forsworn in antlered masks rise from behind a wall of bones and briars."],
    },
    vampire: {
      any: ["A pale figure turns from a bloodstained altar. \"All this way just to feed me? How kind.\""],
    },
    giant: {
      any: ["The giant by the fire stands up, grabs its club and stomps towards you."],
    },
    thalmor: {
      any: ["Thalmor soldiers in gilded armour block the corridor. \"This keep is closed to Talos worshippers.\""],
    },
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  /* an indoor line for this foe in this kind of dungeon, or null (then the foe's own text is used) */
  function line(key, theme) {
    const k = L[key]; if (!k) return null;
    const list = (theme && k[theme]) || k.any;
    return list && list.length ? pick(list) : null;
  }
  /* every line, for tests and the Polish list */
  const all = () => Object.values(L).flatMap((k) => Object.values(k).flat());
  return { L, line, all };
})();
if (typeof module !== "undefined") module.exports = DUNLINES;
