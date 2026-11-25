/* eventcards.js: painted event cards for raids, great events, crises and raids on your house. [OURS]
   Five 8:3 paintings (raid-dragon, raid-bandits, raid-vampire, raid-giant, raid-blizzard; see assets.js) replace
   the flat drawn pictures. GPT's layout notes:
   - the painting is never darkened; the title sits below it, left-aligned, in the Nordic serif
   - a small coloured diamond next to the title says how bad it is (calm / trouble / danger / deadly)
   - the card fades in over 220 ms, scaling from 98% to 100% (once per card and title, not on every redraw)
   - a few faint particles drift over it: embers (dragon, bandits), crimson mist (vampire), light snow (giant),
     wind-driven snow (blizzard). Only with motion on (motion.js html.mo-on); none with reduced motion.
   The particles are plain CSS. Their delays come from the clock, so a card that is redrawn every second
   (the raid box) keeps its particles where they were instead of restarting them.
   EVCARDS.html(event, {title, sev, right, tag}) gives the card's HTML, or "" while the painting is still loading
   or missing, so the caller keeps its old art. title and right must already be escaped HTML. */
const EVCARDS = (() => {
  const CARDS = {
    dragon: ["raid-dragon", "embers"], bandits: ["raid-bandits", "embers"], vampire: ["raid-vampire", "mist"],
    giant: ["raid-giant", "snow"], blizzard: ["raid-blizzard", "wind"],
  };
  /* which card each event gets; anything not listed keeps its own picture */
  const FOR = {
    raid: "dragon",                                   // a dragon over a town (wevents.js, the raid box on the map)
    "gev:dragon": "dragon", "gev:siege": "bandits",   // great world events (greatevents.js); rift and fair keep theirs
    "wev:mig": "dragon",                              // a dragon migration (worldevents.js)
    "cr:snow": "blizzard", "cr:bandit": "bandits", "cr:beasts": "giant",   // hold crises (crises.js); blight and court keep the flat card
    "hs:bandits": "bandits", "hs:vampires": "vampire", "hs:trolls": "giant", // raiders at your house (hsrooms.js)
  };
  const pick = (ev) => (CARDS[ev] ? ev : FOR[ev] || null);
  const SEV = { calm: "Calm now", mid: "Trouble", high: "Danger", dire: "Deadly" };
  const PL = { "Calm now": "Już spokojnie", Trouble: "Kłopoty", Danger: "Niebezpiecznie", Deadly: "Śmiertelnie groźnie" };
  const T = (en) => { try { if (typeof I18N !== "undefined" && I18N.lang && I18N.lang() === "pl") return PL[en] || en; } catch { /* English */ } return en; };

  // ------------------------------------------------------------ particles
  /* how many, and how they move: [count, seconds per trip (min, spread)] */
  const FX = { embers: [11, 5, 4], mist: [4, 16, 8], snow: [16, 8, 5], wind: [20, 2.6, 1.4] };
  const rnd = (seed) => { let a = 0; for (const c of seed) a = (a * 31 + c.charCodeAt(0)) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  function particles(fx, seed, now) {
    const [n, d0, dv] = FX[fx] || FX.embers, r = rnd(fx + seed);
    let out = "";
    for (let i = 0; i < n; i++) {
      const d = d0 + r() * dv, x = r() * 100, y = r() * 100, s = r(), off = r();
      const dl = -(((now / d) + off) % 1) * d;   // the phase follows the clock: redraws don't restart it
      out += `<i style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--s:${s.toFixed(2)};--dx:${(r() * 2 - 1).toFixed(2)};--d:${d.toFixed(2)}s;--dl:${dl.toFixed(2)}s"></i>`;
    }
    return `<span class="evc-fx evc-${fx}" aria-hidden="true">${out}</span>`;
  }

  // ------------------------------------------------------------ the card
  const seen = new Set();
  function html(ev, o = {}) {
    const c = pick(ev); if (!c || typeof ASSETS === "undefined") return "";
    const [asset, fx] = CARDS[c], u = ASSETS.url(asset);
    if (!u) return "";   // still loading (it asks for the file now) or missing: the caller keeps its old picture
    const key = asset + "|" + (o.title || "");
    const fresh = !seen.has(key); seen.add(key);
    if (seen.size > 60) seen.delete(seen.values().next().value);
    const sev = SEV[o.sev] ? o.sev : "", tag = o.tag === "h2" || o.tag === "h3" ? o.tag : "b";
    const mark = sev ? `<i class="evc-sev sev-${sev}" role="img" aria-label="${T(SEV[sev])}" title="${T(SEV[sev])}"></i>` : "";
    const cap = o.title != null ? `<figcaption class="evc-cap">${mark}<${tag} class="evc-t">${o.title}</${tag}>${o.right ? `<span class="evc-r">${o.right}</span>` : ""}</figcaption>` : "";
    const now = typeof performance !== "undefined" && performance.timeOrigin ? (performance.timeOrigin + performance.now()) / 1000 : Date.now() / 1000;
    return `<figure class="evc evc-c-${c}${fresh ? " evc-in" : ""}${o.cls ? " " + o.cls : ""}"><div class="evc-art"><img src="${u}" alt="" decoding="async" draggable="false">${particles(fx, c, now)}</div>${cap}</figure>`;
  }
  const has = (ev) => { const c = pick(ev); return !!c && typeof ASSETS !== "undefined" && ASSETS.stateOf(CARDS[c][0]) === "ok"; };
  /* ask for all five a little after start, so a card is ready the first time an event shows up */
  function preload() { if (typeof ASSETS !== "undefined") for (const c of Object.values(CARDS)) ASSETS.stateOf(c[0]); }
  if (typeof setTimeout !== "undefined" && typeof document !== "undefined") setTimeout(preload, 3000);

  // ------------------------------------------------------------ Polish (the patch note)
  const NOTE = {
    "Painted event cards": "Malowane karty wydarzeń",
    "Dragon attacks on towns now show a hand-painted picture instead of the flat drawing: a dragon breathing fire over the rooftops.":
      "Ataki smoków na miasta mają teraz ręcznie malowany obraz zamiast płaskiego rysunku: smok zionie ogniem nad dachami.",
    "Great events, crises and raids on your house get paintings too: bandits with torches for sieges and outlaws, a vampire lord in the town square, a giant smashing through a farm, and a caravan lost in a blizzard for the Long Winter.":
      "Wielkie wydarzenia, kryzysy i napady na twój dom też dostały obrazy: bandyci z pochodniami przy oblężeniach i banitach, wampirzy lord na rynku, olbrzym rozbijający farmę i karawana zagubiona w zamieci przy Długiej Zimie.",
    "The name of the event sits under the picture, with a small coloured diamond next to it that shows how bad things are: green when it's over, yellow for trouble, orange for danger, red when it's deadly.":
      "Nazwa wydarzenia jest pod obrazem, a obok niej mały kolorowy romb pokazuje, jak jest źle: zielony, gdy już po wszystkim, żółty przy kłopotach, pomarańczowy przy niebezpieczeństwie, czerwony, gdy jest śmiertelnie groźnie.",
    "Cards fade in gently, and a few faint embers, wisps of red mist or snowflakes drift over them. With reduced motion on they stay still.":
      "Karty pojawiają się łagodnie, a nad nimi unosi się kilka słabych iskier, smużek czerwonej mgły albo płatków śniegu. Przy ograniczonym ruchu stoją w miejscu.",
  };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries({ ...NOTE, ...PL })) if (!(k in I18N.PL)) I18N.PL[k] = v;

  return { CARDS, FOR, SEV, PL, NOTE, pick, html, has, preload, particles };
})();
if (typeof module !== "undefined") module.exports = EVCARDS;
