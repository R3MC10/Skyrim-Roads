/* i18n_shouts.js: Polish for thuum.js (shout cooldowns, Fire Breath on the road), wxmatters.js (the weather chip and card,
   storms keeping ships in harbour, clear nights), the new perks and the patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const WX = { Clear: "Bezchmurnie", Overcast: "Pochmurno", Rain: "Deszcz", Fog: "Mgła", Thunderstorm: "Burza", Snow: "Śnieg", Blizzard: "Zamieć", "Ash storm": "Burza popiołu", "Clear (your shout)": "Bezchmurnie (twój okrzyk)" };
  const LINES = {
    "Indoors: the weather can't reach you here.": "W środku: pogoda cię tu nie dosięgnie.",
    "Shock spells may call down lightning": "Zaklęcia porażenia mogą ściągnąć piorun",
    "Arrows miss more often": "Strzały częściej chybiają",
    "Cold without warm clothes": "Zimno bez ciepłych ubrań",
    "Ships stay in harbour": "Statki zostają w porcie",
    "Deep shadows help you hide": "Głębokie cienie pomagają się ukryć",
    "Shout Clear Skies to clear it around you": "Krzyknij Czyste Niebo, żeby się wokół ciebie przejaśniło",
    "Fine weather: nothing in your way": "Ładna pogoda: nic ci nie przeszkadza",
  };
  const EL = { Fire: "Ogień", Frost: "Mróz", Shock: "Porażenie" };
  const line = (l) => {
    if (LINES[l]) return LINES[l];
    let m;
    if ((m = l.match(/^Travel (\d+)% slower$/))) return `Podróż ${m[1]}% wolniejsza`;
    if ((m = l.match(/^Easier to stay hidden \(\+(\d+)%\)$/))) return `Łatwiej się ukryć (+${m[1]}%)`;
    if ((m = l.match(/^(Fire|Frost|Shock) (\d+)% (stronger|weaker)$/))) return `${EL[m[1]]} ${m[3] === "stronger" ? "silniejsz" : "słabsz"}${m[1] === "Shock" ? "e" : "y"} o ${m[2]}%`;
    if ((m = l.match(/^You see (\d+)% less far on the map$/))) return `Na mapie widzisz o ${m[1]}% bliżej`;
    if ((m = l.match(/^Clear night: magicka comes back (\d+)% faster in fights$/))) return `Pogodna noc: magia wraca w walce o ${m[1]}% szybciej`;
    return null;
  };
  Object.assign(I18N_EXTRA.words, LINES, WX, {
    Weather: "Pogoda",
    // fights
    "Clear night: magicka comes back 50% faster.": "Pogodna noc: magia wraca o 50% szybciej.",
    "Clear night: magicka comes back 100% faster.": "Pogodna noc: magia wraca o 100% szybciej.",
    "Fire for 50/70/90 damage. Outside a fight: breathe a fire to warm up.": "Ogień za 50/70/90 obrażeń. Poza walką: rozpal ogień oddechem, żeby się ogrzać.",
    // perks
    "Thu'um Mastery": "Mistrzostwo Thu'um", "Weathered Traveller": "Zahartowany wędrowiec", "Starlit Mind": "Umysł pod gwiazdami",
    "Your voice comes back sooner: every shout cools down another 10/20% (all cooldown cuts together stop at half). [OURS]":
      "Twój głos wraca szybciej: każdy okrzyk odnawia się o kolejne 10/20% szybciej (wszystkie skrócenia razem najwyżej o połowę). [NASZE]",
    "Snow, rain, fog and storms slow your travel 25/50% less, and the cold creeps in 25/50% slower. [OURS]":
      "Śnieg, deszcz, mgła i burze spowalniają twoją podróż o 25/50% mniej, a zimno narasta o 25/50% wolniej. [NASZE]",
    "Under a clear night sky your magicka comes back twice as fast in fights (instead of 50% faster). [OURS]":
      "Pod pogodnym nocnym niebem magia wraca w walce dwa razy szybciej (zamiast o 50%). [NASZE]",
    // patch note
    "Shouts and weather that matter": "Okrzyki i pogoda, która ma znaczenie",
    "Thu'um Mastery (Speechcraft) makes every shout cool down faster, and Commanding Voice now works on all shouts, not just the first ten. The Shouts list shows your real cooldown.":
      "Mistrzostwo Thu'um (Elokwencja) przyspiesza odnawianie każdego okrzyku, a Rozkazujący głos działa teraz na wszystkie okrzyki, nie tylko pierwsze dziesięć. Lista okrzyków pokazuje twój prawdziwy czas odnowienia.",
    "Fire Breath, Frost Breath and Storm Call follow the sky: rain dulls fire, snow and blizzards feed frost, storms feed lightning. Outside a fight, Fire Breath lights a fire to warm you up.":
      "Ognisty Oddech, Mroźny Oddech i Wezwanie Burzy zależą od nieba: deszcz osłabia ogień, śnieg i zamieć wzmacniają mróz, burze wzmacniają pioruny. Poza walką Ognisty Oddech rozpala ogień, przy którym się ogrzejesz.",
    "A weather chip sits next to your status icons. Tap it (or the clock) to see what the weather does right now: slower travel, hiding, spells, arrows, sight, cold, ships.":
      "Obok ikon stanu jest znaczek pogody. Stuknij go (albo zegar), żeby zobaczyć, co pogoda teraz robi: wolniejsza podróż, ukrywanie się, zaklęcia, strzały, widoczność, zimno, statki.",
    "Storms on the coast keep the Northern Maiden in harbour at Windhelm and Raven Rock until they pass. Shouting Clear Skies at the docks clears it.":
      "Burze na wybrzeżu trzymają Północną Pannę w porcie w Windhelmie i Kruczej Skale, dopóki nie przejdą. Okrzyk Czyste Niebo w porcie je rozgania.",
    "Clear nights: your magicka comes back 50% faster in fights. New perks: Weathered Traveller (Acrobatics) for bad weather and the cold, Starlit Mind (Alteration) for clear nights.":
      "Pogodne noce: magia wraca w walce o 50% szybciej. Nowe atuty: Zahartowany wędrowiec (Akrobatyka) na złą pogodę i zimno, Umysł pod gwiazdami (Przemiana) na pogodne noce.",
  });
  I18N_EXTRA.pat.push(
    // the chip's one-line tooltip: "Rain: Travel 8% slower. Easier to stay hidden (+8%)."
    [/^([A-Z][^:]{1,30}): (.+)\.$/, (m) => { if (!WX[m[1]]) return null; const parts = m[2].split(". ").map((p) => line(p)); return parts.every(Boolean) ? `${WX[m[1]]}: ${parts.join(". ")}.` : null; }],
    [/^(Travel \d+% slower|Easier to stay hidden \(\+\d+%\)|(?:Fire|Frost|Shock) \d+% (?:stronger|weaker)|You see \d+% less far on the map|Clear night: magicka comes back \d+% faster in fights)$/, (m) => line(m[1])],
    [/^A (.+) lashes the coast\. The captain won't cast off until it passes \(the weather changes every half hour\), unless someone shouts the sky clear\.$/,
      (m) => `${(WX[m[1][0].toUpperCase() + m[1].slice(1)] || m[1])} smaga wybrzeże. Kapitan nie odbije, dopóki nie przejdzie (pogoda zmienia się co pół godziny), chyba że ktoś wykrzyczy czyste niebo.`],
    // the weather card's forecast: "Next: Rain in 12 min"
    [/^Next: (.+) in (\d+) min$/, (m) => `Dalej: ${WX[m[1]] || m[1]} za ${m[2]} min`],
    [/^(YOL(?: TOOR)?(?: SHUL)?)! You breathe fire into a heap of deadwood and warm your hands at it\.$/, (m) => `${m[1]}! Ziejesz ogniem w stos suchego drewna i grzejesz przy nim dłonie.`],
  );
})();
