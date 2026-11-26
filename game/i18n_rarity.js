/* i18n_rarity.js: Polish for rarity.js (the rarity words on items, the Rarity sort in Items, the colour legend)
   and its patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const W = {
    Common: "Zwykły", Fine: "Dobry", Rare: "Rzadki", Epic: "Epicki", Legendary: "Legendarny", Unique: "Unikat", Rarity: "Rzadkość",
    // patch note
    "Item rarity": "Rzadkość przedmiotów",
    "Every item now has a rarity: Common, Fine, Rare, Epic or Legendary. You see it as a colour and as a word, in your Items, on the paper doll, in tooltips, shops, loot, dungeon loot votes and trades.":
      "Każdy przedmiot ma teraz rzadkość: Zwykły, Dobry, Rzadki, Epicki albo Legendarny. Widać ją jako kolor i jako słowo: w Przedmiotach, na postaci, w opisach, sklepach, łupach, głosowaniach o łup w lochach i w wymianach.",
    "Rarity tells you how special an item is. It never changes its numbers: a Rare sword hits just as hard as it did yesterday.":
      "Rzadkość mówi, jak wyjątkowy jest przedmiot. Nigdy nie zmienia jego liczb: Rzadki miecz bije tak samo mocno jak wczoraj.",
    "Plain gear is Common or Fine (better metals and tempered gear are Fine). Enchanted gear is Fine, Rare or Epic, by how strong its enchantment is. Legendary is kept for true artifacts, like Daedric artifacts and dragon priest masks.":
      "Zwykły sprzęt jest Zwykły albo Dobry (lepsze metale i ulepszony sprzęt są Dobre). Zaczarowany sprzęt jest Dobry, Rzadki albo Epicki, zależnie od siły zaklęcia. Legendarne są tylko prawdziwe artefakty, jak artefakty daedryczne i maski smoczych kapłanów.",
    "One-of-a-kind items also say Unique, apart from their rarity.":
      "Przedmioty jedyne w swoim rodzaju mają też dopisek Unikat, niezależnie od rzadkości.",
    "Tougher foes and bosses drop rarer things. Items can be sorted by Rarity.":
      "Silniejsi wrogowie i bossowie zostawiają rzadsze rzeczy. Przedmioty można sortować według Rzadkości.",
    "Item icons get a thin frame in their rarity colour.": "Ikony przedmiotów mają cienką ramkę w kolorze rzadkości.",
  };
  for (const [k, v] of Object.entries(W)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
})();
