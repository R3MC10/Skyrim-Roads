/* Horses: buy one at a stables, name it, pick its breed and coat, ride or walk beside it, armor it.
   Remigiusz: "Horses should have upgrades at the stables and horses should come with different stats. Carry weight
               (when purchased) horse armour, horse shoes, etc."
   - Breeds: a Cyrodilic bay is the all-rounder, a Nord draft carries most and takes hits, a Hammerfell courser is the
     fastest but carries little, a Highland pony is cheap and sturdy. Each horse rolls a little up or down from its breed.
   - Stable upgrades: saddlebags (carry more), horseshoes (ride faster), armor (more health, takes less damage).
   A horse never dies (Remigiusz: "when a horse's health depletes it is downed"): at 0 health it is DOWNED. It stays
   yours and limps along beside you (it still carries your things), but you can't ride it until it's back on its feet:
   after about 6 in-game hours (30 real minutes), after you sleep, or straight away if a stablehand tends it (cheap).
   Old saves where it had limped off to a stables (or was ever marked dead/lost) come back as downed. [OURS] numbers unless marked. */
const HORSES = (() => {
  const COATS = [["bay", "Bay", "#8a5a3b"], ["black", "Black", "#2b2724"], ["grey", "Dapple grey", "#9b9b97"], ["white", "White", "#ebe6da"], ["palomino", "Palomino", "#d6aa5b"], ["paint", "Paint", "#b77d52"]];
  const ARMOR = {
    none: { name: "No armor", price: 0, hp: 0, guard: 0 },
    steel: { name: "Steel horse armor", price: 1200, hp: 100, guard: 0.25 },
    elven: { name: "Elven horse armor", price: 2600, hp: 160, guard: 0.4 },
  };
  const BREEDS = {
    bay: { name: "Cyrodilic bay", price: 1000, speed: 1.8, carry: 100, hp: 200, text: "The all-rounder." },
    draft: { name: "Nord draft", price: 1200, speed: 1.6, carry: 180, hp: 260, text: "Slow and huge. Carries the most and shrugs off hits." },
    courser: { name: "Hammerfell courser", price: 1500, speed: 2.05, carry: 70, hp: 160, text: "The fastest on the road, but carries little." },
    pony: { name: "Highland pony", price: 700, speed: 1.7, carry: 130, hp: 220, text: "Cheap, stubborn and sturdy." },
  };
  const BAGS = [null, { name: "Saddlebags", price: 300, carry: 50 }, { name: "Big saddlebags", price: 700, carry: 100 }, { name: "Pack frame", price: 1400, carry: 150 }];
  const SHOES = {
    none: { name: "Bare hooves", price: 0, speed: 0 },
    iron: { name: "Iron horseshoes", price: 250, speed: 0.05 },
    steel: { name: "Steel horseshoes", price: 600, speed: 0.1 },
    elven: { name: "Elven horseshoes", price: 1500, speed: 0.15 },
  };
  const ROLL = 0.05;   // a horse rolls up to 5% either way on each stat
  const BASE_HP = 200, REST_MIN = 30, TEND_PRICE = 50, REGEN_PER_SEC = 0.2, UP_HP = 0.5;   // downed for 30 real min = 6 in-game hours; gets up at half health
  const NAMES = ["Frost", "Arvak", "Old Bessie", "Lucky", "Thunder", "Mead", "Ember", "Ash", "Juniper", "Snowmane", "Biscuit", "Storm"];
  const MIGRATE = ["away", "dead", "lost", "fled", "gone", "ranAway"];   // old flags that once took a horse from you
  const nowS = () => Date.now() / 1000;
  const coat = (id) => COATS.find((c) => c[0] === id) || COATS[0];
  const breed = (id) => BREEDS[id] || BREEDS.bay;
  const stats = (h) => h?.stats || { speed: breed(h?.breed).speed, carry: breed(h?.breed).carry, hp: breed(h?.breed).hp };
  const maxHp = (h) => Math.round(stats(h).hp) + (ARMOR[h?.armor || "none"]?.hp || 0);
  const disc = (s) => (typeof PFX !== "undefined" ? Math.min(0.3, PFX.num(s, "stable")) : 0);   // Horse Trader
  const cost = (s, n) => Math.round(n * (1 - disc(s)));
  const atStables = (s) => !!s.location && G.shopTypes(s.location).includes("stables");
  /* the horse's numbers: how much faster you ride, and how much it carries, with breed, roll and upgrades */
  function speed(s) { const h = s.horse; if (!h) return 1; return +(stats(h).speed * (1 + (SHOES[h.shoes || "none"]?.speed || 0))).toFixed(3); }
  function carry(s) { const h = s.horse; if (!h) return 0; return Math.round(stats(h).carry + (BAGS[h.bags || 0]?.carry || 0)); }
  /* a new horse of a breed: each stat rolls a little (Horse Trader nudges the roll up) */
  function roll(id, luck = 0, rnd = Math.random) {
    const b = breed(id), r = () => 1 + (Math.min(1, rnd() + luck) * 2 - 1) * ROLL;
    return { speed: +(b.speed * r()).toFixed(3), carry: Math.round(b.carry * r()), hp: Math.round(b.hp * r()) };
  }
  /* how a horse compares with its breed: about -1..1 per stat */
  const grade = (h) => { const b = breed(h.breed), st = stats(h); return { speed: (st.speed / b.speed - 1) / ROLL, carry: (st.carry / b.carry - 1) / ROLL, hp: (st.hp / b.hp - 1) / ROLL }; };
  /* upgrades a horse from older saves ({ name } only) */
  function fix(s) {
    const h = s.horse; if (!h) return null;
    if (!h.coat) h.coat = "bay";
    if (!h.armor) h.armor = "none";
    if (!BREEDS[h.breed]) h.breed = "bay";
    if (!h.stats) h.stats = { speed: breed(h.breed).speed, carry: breed(h.breed).carry, hp: breed(h.breed).hp };   // old horses: plain breed numbers
    if (!SHOES[h.shoes]) h.shoes = "none";
    if (!(h.bags >= 0 && h.bags < BAGS.length)) h.bags = 0;
    if (h.hp == null) { h.hp = maxHp(h); h.hpT = nowS(); }
    if (h.mounted == null) h.mounted = true;
    // old saves: a horse that limped off to a stables, or was ever marked dead, lost or run off, is yours again, downed
    if (MIGRATE.some((k) => h[k])) {
      const t = nowS(), until = Math.min(t + REST_MIN * 60, Math.max(t, +(h.away && h.away.until) || t + REST_MIN * 60));
      for (const k of MIGRATE) delete h[k];
      if (!h.down) h.down = { at: t, until, r: s.rested || 0 };
      h.hp = 0; h.hpT = t;
    }
    if (!h.down && !(h.hp > 0)) knockDown(s, nowS());   // 0 health always means downed
    return h;
  }
  /* 0 health: the horse is downed. It stays with you, you can't ride it, and it gets back up later */
  function knockDown(s, t = nowS()) {
    const h = s.horse; if (!h) return null;
    h.hp = 0; h.hpT = t; h.down = { at: t, until: t + REST_MIN * 60, r: s.rested || 0 };
    return h;
  }
  /* back on its feet once the time is up, or once you've slept since it went down */
  function check(s, t = nowS()) {
    const h = s.horse; if (!h?.down) return false;
    const r = s.rested || 0, slept = r !== (h.down.r || 0) && r > h.down.at;
    if (t < h.down.until && !slept) return false;
    h.down = null; h.hp = Math.max(1, Math.round(maxHp(h) * UP_HP)); h.hpT = t;
    return true;
  }
  const downed = (s, t = nowS()) => { const h = fix(s); if (!h) return false; check(s, t); return !!h.down; };
  const present = (s) => !!s.horse;   // a downed horse still limps along beside you and carries your things
  const riding = (s, t) => !!s.horse && !downed(s, t) && s.horse.mounted !== false;
  function hp(s, t = nowS()) {   // health comes back slowly while the horse is on its feet
    const h = fix(s); if (!h || downed(s, t)) return 0;
    const v = Math.min(maxHp(h), h.hp + Math.max(0, t - (h.hpT || t)) * REGEN_PER_SEC);
    h.hp = v; h.hpT = t; return v;
  }
  const stablesTowns = () => Object.keys(WORLD.places).filter((n) => G.shopTypes(n).includes("stables"));
  function nearestStables(pos) { return stablesTowns().map((n) => [n, G.pxDist(pos, WORLD.places[n])]).sort((a, b) => a[1] - b[1])[0]?.[0] || "Whiterun"; }

  const price = (s, id) => cost(s, breed(id).price);   // [Skyrim] a horse is 1000
  function buy(s, name, coatId, breedId = "bay", rnd) {
    if (!atStables(s)) return "No stables here.";
    if (s.horse) return "You already have a horse.";
    const b = BREEDS[breedId] ? breedId : "bay", p = price(s, b);
    if (s.gold < p) return `A ${breed(b).name} costs ${p} gold.`;
    s.gold -= p;
    name = String(name || "").replace(/[^\p{L}\p{N} '\-]/gu, "").trim().slice(0, 16) || NAMES[Math.floor(Math.random() * NAMES.length)];
    const st = roll(b, disc(s) * 2.5, rnd);   // Horse Trader 2: the worst roll is the plain breed
    s.horse = { name, breed: b, stats: st, coat: coat(coatId)[0], armor: "none", shoes: "none", bags: 0, hp: st.hp, hpT: nowS(), mounted: true };
    G.useSkill(s, "Mercantile", p);
    return `${name} the ${breed(b).name} is yours. Riding, you travel ${speed(s).toFixed(2)}× faster, and ${name} carries ${carry(s)} for you.`;
  }
  function buyShoes(s, id) {
    const sh = SHOES[id];
    if (!sh || id === "none") return "There are no such horseshoes.";
    if (!s.horse) return "You need a horse first.";
    if (!atStables(s)) return "Only stables shoe horses.";
    const h = fix(s);
    if (h.shoes === id) return `${h.name} already wears them.`;
    if (SHOES[h.shoes].speed > sh.speed) return `${h.name} already has better shoes.`;
    const p = cost(s, sh.price); if (s.gold < p) return `${sh.name} cost ${p} gold.`;
    s.gold -= p; h.shoes = id;
    return `The farrier nails ${sh.name.toLowerCase()} onto ${h.name}. You ride ${speed(s).toFixed(2)}× faster now.`;
  }
  function buyBags(s) {
    if (!s.horse) return "You need a horse first.";
    if (!atStables(s)) return "Only stables sell saddlebags.";
    const h = fix(s), next = BAGS[h.bags + 1];
    if (!next) return `${h.name} can't carry any bigger bags.`;
    const p = cost(s, next.price); if (s.gold < p) return `${next.name} cost ${p} gold.`;
    s.gold -= p; h.bags += 1;
    return `${next.name} strapped on. ${h.name} carries ${carry(s)} now.`;
  }
  function rename(s, name) {
    if (!s.horse) return "You don't have a horse.";
    name = String(name || "").replace(/[^\p{L}\p{N} '\-]/gu, "").trim().slice(0, 16);
    if (!name) return "Give your horse a name.";
    const old = s.horse.name; s.horse.name = name; return `${old} is called ${name} now.`;
  }
  function toggle(s) {
    if (!present(s)) return "Your horse isn't with you.";
    if (downed(s)) return `${s.horse.name} is downed and can't carry a rider yet. Sleep, wait a few hours, or have a stablehand tend them.`;
    s.horse.mounted = !riding(s);
    return riding(s) ? `You swing up onto ${s.horse.name}.` : `You get down and walk beside ${s.horse.name}. It still carries your things.`;
  }
  function buyArmor(s, id) {
    const a = ARMOR[id];
    if (!a || id === "none") return "There's no such armor.";
    if (!s.horse) return "You need a horse first.";
    if (!atStables(s)) return "Only stables sell horse armor.";
    fix(s);
    if (s.horse.armor === id) return `${s.horse.name} already wears it.`;
    const p = cost(s, a.price);
    if (s.gold < p) return `${a.name} costs ${p} gold.`;
    s.gold -= p; hp(s); s.horse.armor = id; s.horse.hp = Math.min(maxHp(s.horse), s.horse.hp + a.hp);
    return `The stablehand fits ${s.horse.name} with ${a.name}. It can take more punishment now.`;
  }
  const HOURS = Math.round(REST_MIN / 5);   // one in-game hour = 5 real minutes
  const downLine = (h) => `🐴 ${h.name} is downed! They limp along beside you but can't be ridden until they're back on their feet (about ${HOURS} hours, a night's sleep, or a stablehand's care).`;
  /* a fight on the road can hurt the horse. Returns a line for the trip log, or null. */
  function hurt(s, e, t = nowS(), chance = 0.25) {
    if (!present(s) || downed(s, t) || Math.random() >= chance) return null;
    const h = s.horse, cur = hp(s, t), dmg = Math.round((e.damage || 10) * (3 + Math.random() * 3) * (1 - (ARMOR[h.armor]?.guard || 0)));
    h.hp = cur - dmg; h.hpT = t;
    if (h.hp > 0) return `🐴 The ${e.name} hurts ${h.name} (${Math.round(h.hp)}/${maxHp(h)}).`;
    knockDown(s, t);
    return downLine(h);
  }
  const readyIn = (s, t = nowS()) => (downed(s, t) ? Math.max(0, s.horse.down.until - t) : 0);
  const tendPrice = (s) => cost(s, TEND_PRICE);
  /* a stablehand at any stables gets a downed (or hurt) horse back to full health, cheap */
  function tend(s, t = nowS()) {
    if (!s.horse) return "You don't have a horse.";
    if (!atStables(s)) return "Only a stablehand can tend your horse. Find a stables.";
    const h = fix(s), was = downed(s, t);
    if (!was && hp(s, t) >= maxHp(h)) return `${h.name} is fit and well.`;
    const p = tendPrice(s); if (s.gold < p) return `The stablehand wants ${p} gold for the poultices.`;
    s.gold -= p; h.down = null; h.hp = maxHp(h); h.hpT = t;
    return was ? `The stablehand gets ${h.name} back on their feet with poultices and a warm mash. Ready to ride.` : `The stablehand patches ${h.name} up. Good as new.`;
  }
  /* a status word for screens: "Downed", "Hurt" or "" */
  function state(s, t = nowS()) { if (!s.horse) return ""; if (downed(s, t)) return "Downed"; return hp(s, t) < maxHp(s.horse) * 0.5 ? "Hurt" : ""; }
  return { COATS, ARMOR, BREEDS, BAGS, SHOES, ROLL, breed, stats, speed, carry, roll, grade, price, cost, buyShoes, buyBags, BASE_HP, TEND_PRICE, REST_MIN, HOURS, UP_HP, coat, maxHp, fix, knockDown, check, downed, downLine, present, riding, hp, buy, rename, toggle, buyArmor, hurt, readyIn, tendPrice, tend, state, nearestStables };
})();
