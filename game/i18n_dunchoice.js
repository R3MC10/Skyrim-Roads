/* i18n_dunchoice.js: Polish for the way cards at a dungeon fork (dunchoice.js), the clearer party vote (partyvote.js)
   and their patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // risk tags
  "Safe": "Bezpiecznie", "Low risk": "Małe ryzyko", "Some risk": "Spore ryzyko", "High risk": "Duże ryzyko", "Deadly": "Śmiertelnie", "Risk unknown": "Ryzyko nieznane",
  // what you'll face
  "A foe blocks the way. You can fight, sneak past or run.": "Wróg zagradza drogę. Możesz walczyć, przekraść się albo uciec.",
  "A strong foe that hits hard.": "Silny wróg, który mocno bije.",
  "It can hurt you. Acrobatics and Sneak help.": "Może cię zranić. Pomaga Akrobatyka i Skradanie.",
  "A locked chest. Lockpicking helps.": "Zamknięta skrzynia. Pomaga Otwieranie zamków.",
  "Solve it and a hidden room opens.": "Rozwiąż ją, a otworzy się ukryta komnata.",
  "A quiet spot. Searching it can wake something.": "Ciche miejsce. Przeszukiwanie może coś obudzić.",
  "Could be anything: a shrine, a book, a body... or an ambush.": "Może tam być wszystko: kapliczka, księga, ciało... albo zasadzka.",
  "The master of this place. No way round it.": "Pan tego miejsca. Nie da się go obejść.",
  "A camp to catch your breath.": "Obóz, by złapać oddech.",
  // what it pays
  "Reward": "Nagroda", "Then": "Potem", "· you need it": "· przyda ci się",
  "Gold, loot and skill": "Złoto, łupy i umiejętności", "Better gold and loot": "Więcej złota i lepsze łupy",
  "Not much: a few coins at best": "Niewiele: najwyżej parę monet", "Gold and gear": "Złoto i sprzęt",
  "Lots of gold and rare finds": "Dużo złota i rzadkie znaleziska", "Heals about half your health": "Leczy około połowy zdrowia",
  "The big chest": "Wielka skrzynia", "Rest, or head deeper": "Odpoczynek albo dalej w głąb",
  "on the left": "po lewej", "in the middle": "pośrodku", "on the right": "po prawej",
  // the party vote
  "Most votes wins. A tie goes the leader's way.": "Wygrywa większość. Przy remisie decyduje przywódca.",
  "Tied right now: the leader's pick wins.": "Teraz jest remis: wygrywa wybór przywódcy.",
  "Tap a choice to vote.": "Dotknij wyboru, aby zagłosować.",
  // patch note
  "Dungeon forks show what's ahead": "Rozwidlenia w podziemiach pokazują, co dalej",
  "At a fork every way is now a card: a picture of the room, its name, how risky it is, what it pays, and which rooms come after it.":
    "Na rozwidleniu każda droga to teraz karta: obraz komnaty, jej nazwa, jak bardzo jest ryzykowna, co daje i jakie komnaty są dalej.",
  "Risk goes from Safe to Deadly and follows how dangerous the dungeon is. A Rest room tells you when you could really use it.":
    "Ryzyko idzie od Bezpiecznie do Śmiertelnie i zależy od tego, jak groźne są podziemia. Komnata odpoczynku mówi, kiedy naprawdę ci się przyda.",
  "In a party the same cards are the vote: each one shows how many votes it has and who picked it, the leading way lights up, and the vote says plainly that a tie goes the leader's way.":
    "W drużynie te same karty są głosowaniem: każda pokazuje, ile ma głosów i kto ją wybrał, prowadząca droga się podświetla, a głosowanie mówi wprost, że przy remisie decyduje przywódca.",
});
I18N_EXTRA.pat.push(
  [/^(\d+) votes?$/, (m) => { const n = +m[1], d = n % 10, t = n % 100; return `${n} ${n === 1 ? "głos" : d >= 2 && d <= 4 && (t < 12 || t > 14) ? "głosy" : "głosów"}`; }],
  [/^way (\d+)$/, (m) => `droga ${m[1]}`],
);
