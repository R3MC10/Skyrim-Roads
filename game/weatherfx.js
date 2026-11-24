/* Weather that matters ([OURS], built on WEVENTS.weather and SKY): what the sky does to fights, sneaking, travel and the cold.
     WFX.of(id)                 → the effect table for a weather id
     WFX.fight(s, t)            → { id, name, icon, el:{fire,frost,shock}, aim, stam, storm, lines } for a fight starting now
     WFX.warmth(s)              → 0..1: how well your clothes keep the cold out (hide, fur, Stalhrim, Nordic, a fur cloak…)
     WFX.cold(s, t)             → the cold meter 0..100 (updated from the time since the last check; gentle, never hurts health)
     WFX.coldState(s, t)        → { v, tier: 0 warm | 1 chilly | 2 freezing, label }
     WFX.speedMult(s, t)        → extra travel factor (blizzards without warm clothes, freezing)
     WFX.sneakAdd(s, t)         → extra hide chance (clear nights)
     WFX.forecast(pos, t)       → "Now: Rain · next: Clear in 12 min"
     WFX.noteHTML(s, t)         → a short line for the fight screen: what today's weather does
   Survival (the cold meter) can be switched off in Settings; it's on by default but gentle. */
const WFX = (() => {
  const now = () => G.now();
  // fire/frost/shock: spell damage multipliers · aim: hit chance multiplier for bows and crossbows (yours and archer foes')
  // stam: start-of-fight stamina without warm clothes · sneak: extra hide chance on top of WEVENTS' own
  const FX = {
    clear: { el: {}, aim: 1, stam: 1, text: "" },
    cloudy: { el: {}, aim: 1, stam: 1, text: "" },
    rain: { el: { fire: 0.85, shock: 1.15 }, aim: 0.95, stam: 1, text: "Rain: fire spells 15% weaker, shock 15% stronger, arrows a little less sure." },
    storm: { el: { fire: 0.8, shock: 1.25 }, aim: 0.9, stam: 1, storm: true, text: "Thunderstorm: shock spells 25% stronger and may call down lightning, fire 20% weaker, arrows less sure." },
    fog: { el: {}, aim: 0.85, stam: 1, text: "Fog: easier to stay hidden, but arrows miss more often." },
    snow: { el: { frost: 1.1, fire: 0.95 }, aim: 0.95, stam: 0.95, text: "Snow: frost spells 10% stronger. Cold without warm clothes." },
    blizzard: { el: { frost: 1.2, fire: 0.9 }, aim: 0.8, stam: 0.85, text: "Blizzard: frost 20% stronger, fire weaker, arrows fly wild. Without warm clothes you start with less stamina and travel slower." },
    ashstorm: { el: { fire: 1.1 }, aim: 0.85, stam: 0.9, text: "Ash storm: fire burns 10% hotter, arrows miss more, and the ash saps stamina unless you're covered up." },
  };
  const of = (id) => FX[id] || FX.clear;
  const on = (s) => s && s.survival !== false;
  const wxAt = (s, t) => (typeof WEVENTS !== "undefined" && s && s.x != null ? WEVENTS.weather([s.x, s.y], t) : { id: "clear", name: "Clear", icon: "" });

  // ---- warm clothes: hide and fur keep the cold out; a fur cloak in your pack counts as one more piece
  const WARM = /hide|fur|pelt|stalhrim|nordic|ancient_nord|skaal|stormcloak|bear|wolf_armor|forsworn|guard/;
  function warmth(s) {
    let n = 0;
    try { const eq = G.equipment(s); for (const sl of ["chest", "head", "hands", "feet"]) if (eq[sl] && WARM.test(eq[sl].item)) n += sl === "chest" ? 2 : 1; } catch { /* no gear */ }
    if ((s.inv || []).some((r) => r.item === "fur_cloak")) n += 2;
    return Math.min(1, n / 4);
  }
  const souped = (s, t) => G.fxSum(s, "warmth", t) > 0;

  // ---- the cold meter: rises in cold places, at night up north, in snow and storms; falls by a fire, at an inn, in town
  const COLD_HOLDS = ["Winterhold", "The Pale", "Solstheim"];
  function exposure(s, t) {
    if (!s || s.x == null) return 0;
    const pos = [s.x, s.y], wx = wxAt(s, t).id;
    let hold = ""; try { hold = G.holdAt(pos); } catch { /* fine */ }
    let r = 0;
    if (COLD_HOLDS.includes(hold)) r += 1;
    if (pos[1] < 0.42 && G.isNight(t)) r += 0.5;
    if (wx === "snow") r += 0.6; else if (wx === "blizzard") r += 1.6; else if (wx === "ashstorm") r += 0.4; else if (wx === "rain" || wx === "storm") r += 0.2;
    try { const ty = Terrain.typeAtPos(pos); if (ty === Terrain.T.SNOW || ty === Terrain.T.MOUNTAIN || ty === Terrain.T.PEAK) r += 0.6; } catch { /* no terrain in tests */ }
    if (!r) return 0;
    if (souped(s, t)) return 0;
    return r * (1 - 0.7 * warmth(s));   // points per real minute
  }
  const sheltered = (s) => !!(s.location && !s.trip && (G.shopTypes(s.location).length || (typeof TOWNS !== "undefined" && TOWNS.INNS && TOWNS.INNS[s.location])));
  function cold(s, t = now()) {
    if (!on(s)) { s.coldV = 0; return 0; }
    const last = s.coldT || t, mins = Math.max(0, Math.min(600, (t - last) / 60));
    s.coldT = t;
    let v = s.coldV || 0;
    if (mins > 0) {
      if (sheltered(s)) v -= 20 * mins;
      else { const e = exposure(s, t); v += e ? e * 2 * mins : -3 * mins; }
    }
    s.coldV = Math.max(0, Math.min(100, Math.round(v * 10) / 10));
    return s.coldV;
  }
  function warmUp(s, amt = 100, t = now()) { cold(s, t); s.coldV = Math.max(0, (s.coldV || 0) - amt); }
  function coldState(s, t = now()) {
    const v = cold(s, t), tier = v >= 70 ? 2 : v >= 40 ? 1 : 0;
    return { v, tier, label: ["Warm", "Chilly", "Freezing"][tier], icon: ["", "", ""][tier] };
  }

  // ---- what the weather does to a fight starting now
  function fight(s, t = now()) {
    const w = s && s.dungeon ? { id: "clear", name: "Indoors", icon: "" } : wxAt(s, t), e = of(w.id), warm = warmth(s) >= 0.5 || souped(s, t);
    const cs = on(s) ? coldState(s, t) : { tier: 0 };
    let stam = warm ? 1 : e.stam;
    stam *= [1, 0.95, 0.9][cs.tier];
    const aim = e.aim * (cs.tier === 2 ? 0.95 : 1);
    const lines = [];
    if (e.text) lines.push(e.text);
    if (!warm && e.stam < 1) lines.push("Warm clothes (hide, fur, a fur cloak) or hot soup would keep your stamina up.");
    if (cs.tier) lines.push(cs.tier === 2 ? "You're freezing: 10% less stamina and shakier aim. Warm up at an inn or in town." : "You're chilly: 5% less stamina. Warm up at an inn or in town.");
    return { id: w.id, name: w.name, icon: w.icon, el: { ...e.el }, aim, stam, storm: !!e.storm, lines };
  }
  const elem = (f, el) => (f && f.wx && el ? f.wx.el[el] || 1 : 1);
  // storms: a shock spell may call down lightning for half again its damage
  const stormStrike = (f, el) => !!(f && f.wx && f.wx.storm && el === "shock" && Math.random() < 0.2);

  function speedMult(s, t = now()) {
    const w = wxAt(s, t).id, warm = warmth(s) >= 0.5;
    let m = 1;
    if ((w === "blizzard" || w === "ashstorm") && warm) m *= 1.12;   // warm clothes: you push on (WEVENTS already slows everyone)
    if (on(s) && coldState(s, t).tier === 2) m *= 0.95;
    return m;
  }
  function sneakAdd(s, t = now()) {
    const w = wxAt(s, t).id;
    return w === "clear" && G.isNight(t) ? 0.05 : 0;   // clear nights: deep shadows
  }
  function forecast(pos, t = now()) {
    if (typeof WEVENTS === "undefined") return "";
    const hold = G.holdAt(pos), cur = WEVENTS.weatherAt(hold, t), next = Math.floor(t / 1800 + 1) * 1800;
    const nx = WEVENTS.weatherAt(hold, next), mins = Math.max(1, Math.round((next - t) / 60));
    return nx.id === cur.id ? `${cur.icon} ${cur.name}, staying for now` : `${cur.icon} ${cur.name} · ${nx.icon} ${nx.name} in ${mins} min`;
  }
  function noteHTML(s, t = now()) {
    const f = fight(s, t);
    if (!f.lines.length) return "";
    const e = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    return `<p class="sub wxnote"><b>${e(f.icon)} ${e(f.name)}</b> ${f.lines.map(e).join(" ")}</p>`;
  }
  function coldHTML(s, t = now()) {
    if (!on(s)) return "";
    const c = coldState(s, t);
    if (!c.tier && c.v < 15) return "";
    return `<div class="wxcold t${c.tier}" title="Cold: ${Math.round(c.v)}/100"><span>${c.icon || ""} ${c.label}</span><i style="width:${Math.round(c.v)}%"></i></div>`;
  }
  // a fur cloak at general stores
  if (typeof D !== "undefined") {
    D.ITEMS.fur_cloak = D.ITEMS.fur_cloak || { name: "Fur Cloak", slot: "misc", weight: 2, value: 45, desc: "Keeps the cold out (carry it)" };
    if (D.SHOP_STOCK && D.SHOP_STOCK.general && !D.SHOP_STOCK.general.includes("fur_cloak")) D.SHOP_STOCK.general.push("fur_cloak");
  }
  return { FX, of, on, warmth, exposure, cold, warmUp, coldState, fight, elem, stormStrike, speedMult, sneakAdd, forecast, noteHTML, coldHTML };
})();
