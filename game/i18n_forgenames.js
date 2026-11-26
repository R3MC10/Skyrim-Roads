/* i18n_forgenames.js: Polish for build 353's forge level names (towns.js QUALITY is "+1".."+6", NAMES.improved puts it
   after the item name). The forge lines themselves are in i18n_qaside2.js / i18n_qacore.js; this holds the patch note.
   "+N" needs no translation. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Forge upgrades read +1 to +6": "Ulepszenia w kuźni: od +1 do +6",
    "Gear you improve at the forge now shows its level as a number after the name: Iron Sword +1, +2 ... up to +6. The old words (Fine, Superior, Exquisite, Flawless, Epic, Legendary) are gone, so they no longer get mixed up with item rarity.":
      "Sprzęt ulepszony w kuźni pokazuje teraz poziom jako liczbę po nazwie: Iron Sword +1, +2 ... aż do +6. Stare słowa (Dobra, Przednia, Wyśmienita, Bez skazy, Epicka, Legendarna) zniknęły, więc nie mylą się już z rzadkością przedmiotów.",
    "Nothing about your gear changes: same bonuses, same upgrades, and everything you already improved keeps its level.":
      "Sam sprzęt się nie zmienia: te same premie, te same ulepszenia, a wszystko, co już ulepszyłeś, zachowuje swój poziom.",
  });
})();
