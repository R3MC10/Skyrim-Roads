/* i18n_potionfx.js: Polish for potions that work over a few rounds (potionfx.js): the fight lines, the chips and their tips,
   the item tooltip line, the map lines, the Quick Draught perk and the patch note.
   Loaded before i18n.js and before i18n_sweep.js (its "Drinks X" line would catch ours first). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const PL3 = (n, a, b, c) => { n = +n; return `${n} ${n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c}`; };
  const TUR = (n) => PL3(n, "turę", "tury", "tur");          // "przez 3 tury"
  const SEK = (n) => PL3(n, "sekundę", "sekundy", "sekund");  // "przez 4 sekundy"
  const RES = { health: "zdrowia", magicka: "magii", stamina: "wytrzymałości" };
  const W = (t) => { if (typeof I18N === "undefined") return t; try { const r = I18N.tr(t); return r == null ? t : r; } catch (e) { return t; } };
  const SAME = "Kolejna tego samego rodzaju się nie sumuje.";

  Object.assign(I18N_EXTRA.words, {
    "the last one is still working": "poprzednia jeszcze działa",
    "Potion": "Mikstura",
    // the perk (perkfx.js)
    "Quick Draught": "Szybki łyk",
    "Restore Health, Magicka and Stamina potions work faster: everything comes in one round sooner per rank (a second sooner on the road), never in under two. [OURS]":
      "Mikstury zdrowia, magii i wytrzymałości działają szybciej: wszystko przychodzi o jedną turę wcześniej na poziom (o sekundę wcześniej w drodze), nigdy szybciej niż w dwie. [OURS]",
    "Restore Health, Magicka and Stamina potions work faster: everything comes in one round sooner per rank (a second sooner on the road), never in under two.":
      "Mikstury zdrowia, magii i wytrzymałości działają szybciej: wszystko przychodzi o jedną turę wcześniej na poziom (o sekundę wcześniej w drodze), nigdy szybciej niż w dwie.",
    // the patch note (patchnotes.js)
    "Potions work over time": "Mikstury działają z czasem",
    "Health, magicka and stamina potions no longer refill you all at once. They pour in over a few rounds in a fight, or a few seconds on the map: small potions over 5, ordinary ones over 4, the big brewed ones over 3. Half comes in right after you drink, so one still pulls you out of trouble.":
      "Mikstury zdrowia, magii i wytrzymałości nie napełniają cię już od razu. W walce wlewają się przez kilka tur, na mapie przez kilka sekund: małe przez 5, zwykłe przez 4, duże warzone przez 3. Połowa wchodzi zaraz po wypiciu, więc jedna wciąż wyciąga cię z kłopotów.",
    "Drinking another of the same kind while one is still working doesn't stack: you keep whichever has more left to give. A health and a magicka potion work side by side just fine.":
      "Wypicie kolejnej tego samego rodzaju, gdy poprzednia jeszcze działa, nic nie sumuje: zostaje ta, która ma więcej do oddania. Mikstura zdrowia i magii działają obok siebie bez problemu.",
    "A small potion chip under your bars shows how many rounds are left, and green numbers rise as it works. On the map a chip sits next to your health bar with the seconds left.":
      "Mały znaczek mikstury pod twoimi paskami pokazuje, ile tur zostało, a w trakcie działania unoszą się zielone liczby. Na mapie znaczek z pozostałymi sekundami stoi obok paska zdrowia.",
    "Followers, party members and the Smart AI won't waste a second potion of a kind that is still working. In a party everyone sees each other's potions working.":
      "Towarzysze, członkowie drużyny i Sprytna SI nie zmarnują drugiej mikstury rodzaju, który jeszcze działa. W drużynie każdy widzi działające mikstury pozostałych.",
    "New Alchemy perk, Quick Draught (2 ranks): your potions work one round faster per rank.":
      "Nowy atut Alchemii, Szybki łyk (2 poziomy): twoje mikstury działają o jedną turę szybciej na poziom.",
  });

  I18N_EXTRA.pat.push(
    // you, in a fight (engine.js via potionfx.js)
    [/^Drinks ([^·]+?): \+(\d+) (health|magicka|stamina) over (\d+) rounds?$/, (m) => `Pijesz: ${W(m[1])}: +${m[2]} ${RES[m[3]]} przez ${TUR(m[4])}`],
    [/^Drinks ([^·]+?), but the last one is still working$/, (m) => `Pijesz: ${W(m[1])}, ale poprzednia jeszcze działa`],
    // each round's share
    [/^🧪 \+(\d+) (health|magicka|stamina)$/, (m) => `🧪 +${m[1]} ${RES[m[2]]}`],
    // followers, party members, coop allies
    [/^([^·]+?) drinks an? ([^·]+?): \+(\d+) over (\d+) rounds?$/, (m) => `${W(m[1])} pije: ${W(m[2])}: +${m[3]} przez ${TUR(m[4])}`],
    [/^([^·]+?) drinks an? ([^·]+?): the last one is still working$/, (m) => `${W(m[1])} pije: ${W(m[2])}, ale poprzednia jeszcze działa`],
    [/^You give ([^·]+?) an? ([^·]+?): \+(\d+) over (\d+) rounds?$/, (m) => `Dajesz ${W(m[1])}: ${W(m[2])}: +${m[3]} przez ${TUR(m[4])}`],
    [/^You give ([^·]+?) an? ([^·]+?): the last one is still working$/, (m) => `Dajesz ${W(m[1])}: ${W(m[2])}, ale poprzednia jeszcze działa`],
    // on the map
    [/^You drink the ([^·]+?): \+(\d+) health over (\d+) seconds?\.$/, (m) => `Wypijasz: ${W(m[1])}: +${m[2]} zdrowia przez ${SEK(m[3])}.`],
    [/^You drink the ([^·]+?), but the last one is still working\.$/, (m) => `Wypijasz: ${W(m[1])}, ale poprzednia jeszcze działa.`],
    [/^You drink the ([^·]+?): health \+(\d+) over (\d+) seconds?\.$/, (m) => `Wypijasz: ${W(m[1])}: zdrowie +${m[2]} przez ${SEK(m[3])}.`],
    [/^You drink the ([^·]+?): the last one is still working\.$/, (m) => `Wypijasz: ${W(m[1])}, ale poprzednia jeszcze działa.`],
    [/^health \+(\d+) over (\d+) seconds?$/, (m) => `zdrowie +${m[1]} przez ${SEK(m[2])}`],
    // chip tips
    [/^([^·]+?): \+(\d+) more health over the next (\d+) seconds?\. Another one of the same kind doesn't stack\.$/,
      (m) => `${W(m[1])}: jeszcze +${m[2]} zdrowia przez ${SEK(m[3])}. ${SAME}`],
    [/^([^·]+?): \+(\d+) (health|magicka|stamina) at the end of this round, less after that, (\d+) more \((\d+) left\)\. Another one of the same kind doesn't stack\.$/,
      (m) => `${W(m[1])}: +${m[2]} ${RES[m[3]]} na koniec tej tury, potem mniej, jeszcze ${m[4]} (zostało ${m[5]}). ${SAME}`],
    // item tooltip line
    [/^Works over (\d+) rounds? in a fight \((\d+) seconds on the road\)\. Another of the same kind doesn't stack\.$/,
      (m) => `Działa przez ${TUR(m[1])} w walce (${SEK(m[2])} w drodze). ${SAME}`],
  );
})();
