/* Horses: buy one at a stables, name it, pick its coat, ride or walk beside it, armor it.
   A horse never dies: when it's badly hurt it goes down and limps back to the nearest stables,
   where you can fetch it once it has rested. [OURS] numbers unless marked. */
const HORSES = (() => {
  const COATS = [["bay", "Bay", "#8a5a3b"], ["black", "Black", "#2b2724"], ["grey", "Dapple grey", "#9b9b97"], ["white", "White", "#ebe6da"], ["palomino", "Palomino", "#d6aa5b"], ["paint", "Paint", "#b77d52"]];
  const ARMOR = {
    none: { name: "No armor", price: 0, hp: 0, guard: 0 },
    steel: { name: "Steel horse armor", price: 1200, hp: 100, guard: 0.25 },
    elven: { name: "Elven horse armor", price: 2600, hp: 160, guard: 0.4 },
  };
  const BASE_HP = 200, REST_MIN = 30, HURRY_PRICE = 100, REGEN_PER_SEC = 0.2;
  const NAMES = ["Frost", "Arvak", "Old Bessie", "Lucky", "Thunder", "Mead", "Ember", "Ash", "Juniper", "Snowmane", "Biscuit", "Storm"];
  const nowS = () => Date.now() / 1000;
  const coat = (id) => COATS.find((c) => c[0] === id) || COATS[0];
  const maxHp = (h) => BASE_HP + (ARMOR[h?.armor || "none"]?.hp || 0);
  /* upgrades a horse from older saves ({ name } only) */
  function fix(s) {
    const h = s.horse; if (!h) return null;
    if (!h.coat) h.coat = "bay";
    if (!h.armor) h.armor = "none";
    if (h.hp == null) { h.hp = maxHp(h); h.hpT = nowS(); }
    if (h.mounted == null) h.mounted = true;
    return h;
  }
  const away = (s) => !!fix(s)?.away;
  const present = (s) => !!s.horse && !away(s);
  const riding = (s) => present(s) && s.horse.mounted !== false;
  function hp(s, t = nowS()) {   // health comes back slowly while the horse is with you
    const h = fix(s); if (!h || h.away) return 0;
    const v = Math.min(maxHp(h), h.hp + Math.max(0, t - (h.hpT || t)) * REGEN_PER_SEC);
    h.hp = v; h.hpT = t; return v;
  }
  const stablesTowns = () => Object.keys(WORLD.places).filter((n) => G.shopTypes(n).includes("stables"));
  function nearestStables(pos) { return stablesTowns().map((n) => [n, G.pxDist(pos, WORLD.places[n])]).sort((a, b) => a[1] - b[1])[0]?.[0] || "Whiterun"; }

  function buy(s, name, coatId) {
    if (!s.location || !G.shopTypes(s.location).includes("stables")) return "No stables here.";
    if (s.horse) return "You already have a horse.";
    if (s.gold < D.HORSE_PRICE) return `A horse costs ${D.HORSE_PRICE} gold.`;   // [Skyrim] 1000
    s.gold -= D.HORSE_PRICE;
    name = String(name || "").replace(/[^\p{L}\p{N} '\-]/gu, "").trim().slice(0, 16) || NAMES[Math.floor(Math.random() * NAMES.length)];
    s.horse = { name, coat: coat(coatId)[0], armor: "none", hp: BASE_HP, hpT: nowS(), mounted: true };
    G.useSkill(s, "Mercantile", D.HORSE_PRICE);
    return `${name} is yours. Riding, you travel ${D.HORSE_SPEED}× faster, and your horse carries ${D.HORSE_CARRY} for you.`;
  }
  function rename(s, name) {
    if (!s.horse) return "You don't have a horse.";
    name = String(name || "").replace(/[^\p{L}\p{N} '\-]/gu, "").trim().slice(0, 16);
    if (!name) return "Give your horse a name.";
    const old = s.horse.name; s.horse.name = name; return `${old} is called ${name} now.`;
  }
  function toggle(s) {
    if (!present(s)) return "Your horse isn't with you.";
    s.horse.mounted = !riding(s);
    return riding(s) ? `You swing up onto ${s.horse.name}.` : `You get down and walk beside ${s.horse.name}. It still carries your things.`;
  }
  function buyArmor(s, id) {
    const a = ARMOR[id];
    if (!a || id === "none") return "There's no such armor.";
    if (!s.horse) return "You need a horse first.";
    if (!s.location || !G.shopTypes(s.location).includes("stables")) return "Only stables sell horse armor.";
    if (s.horse.armor === id) return `${s.horse.name} already wears it.`;
    if (s.gold < a.price) return `${a.name} costs ${a.price} gold.`;
    s.gold -= a.price; hp(s); s.horse.armor = id; s.horse.hp = Math.min(maxHp(s.horse), s.horse.hp + a.hp);
    return `The stablehand fits ${s.horse.name} with ${a.name}. It can take more punishment now.`;
  }
  /* a fight on the road can hurt the horse. Returns a line for the trip log, or null. */
  function hurt(s, e, t = nowS(), chance = 0.25) {
    if (!present(s) || Math.random() >= chance) return null;
    const h = s.horse, cur = hp(s, t), dmg = Math.round((e.damage || 10) * (3 + Math.random() * 3) * (1 - ARMOR[h.armor].guard));
    h.hp = cur - dmg; h.hpT = t;
    if (h.hp > 0) return `🐴 The ${e.name} hurts ${h.name} (${Math.round(h.hp)}/${maxHp(h)}).`;
    const town = nearestStables([s.x, s.y]);
    h.hp = 0; h.away = { until: t + REST_MIN * 60, town }; h.mounted = true;
    return `🐴 ${h.name} goes down, then limps off toward the stables at ${town}. Fetch them there in about ${REST_MIN} minutes.`;
  }
  const readyIn = (s, t = nowS()) => (away(s) ? Math.max(0, s.horse.away.until - t) : 0);
  function fetch(s, t = nowS()) {
    if (!away(s)) return "Your horse is with you.";
    if (s.location !== s.horse.away.town) return `${s.horse.name} is resting at the stables in ${s.horse.away.town}.`;
    if (readyIn(s, t) > 0) return `${s.horse.name} is still resting. Ready in about ${Math.ceil(readyIn(s, t) / 60)} minutes.`;
    s.horse.away = null; s.horse.hp = maxHp(s.horse); s.horse.hpT = t;
    return `${s.horse.name} nickers when they see you. Rested and ready to ride.`;
  }
  function hurry(s, t = nowS()) {
    if (!away(s) || s.location !== s.horse.away.town) return "Your horse isn't here.";
    if (readyIn(s, t) <= 0) return fetch(s, t);
    if (s.gold < HURRY_PRICE) return `The stablehand wants ${HURRY_PRICE} gold for the poultices.`;
    s.gold -= HURRY_PRICE; s.horse.away.until = t;
    return fetch(s, t);
  }
  return { COATS, ARMOR, BASE_HP, HURRY_PRICE, REST_MIN, coat, maxHp, fix, away, present, riding, hp, buy, rename, toggle, buyArmor, hurt, readyIn, fetch, hurry, nearestStables };
})();
