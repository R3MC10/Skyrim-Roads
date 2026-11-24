/* i18n_pickaxe.js: Polish for the mining fix (smithing.js: a pickaxe is never used up, clear reasons why you can't mine,
   ⛏ Mine ore on the map card) and its patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "⛏ Mine ore": "⛏ Wydobywaj rudę",
    "You need a pickaxe — the blacksmith in Riverwood sells one (so does any blacksmith or general store, for a few coins).":
      "Potrzebujesz kilofa — kowal w Riverwood go sprzedaje (tak samo każdy kowal i sklep wielobranżowy, za parę monet).",
    "Leave the rooms first, then mine the veins from the place card.": "Najpierw wyjdź z korytarzy, potem wydobywaj żyły z karty miejsca.",
    "There are no ore veins here.": "Nie ma tu żył rudy.",
    "You've mined the veins here bare. They grow back in a day.": "Wybrałeś tu żyły do czysta. Odrosną za dzień.",
    // patch note
    "Mining fixed: one pickaxe is enough": "Naprawione kopanie: wystarczy jeden kilof",
    "A pickaxe never wears out or gets used up. Keep one in your pack and you can mine forever.":
      "Kilof nigdy się nie zużywa ani nie znika. Miej jeden w plecaku i kop, ile chcesz.",
    "Mines that are also dungeons, like Embershard Mine, have a ⛏ Mine ore button on the map card next to Go inside. You can dig their veins before or after clearing the place.":
      "Kopalnie, które są też lochami, jak Embershard Mine, mają na karcie mapy przycisk ⛏ Wydobywaj rudę obok Wejdź do środka. Ich żyły możesz kopać przed oczyszczeniem miejsca i po nim.",
    "If you can't mine, the game now tells you why: no pickaxe (the blacksmith in Riverwood sells one, cheap), your pickaxe is sitting in your house chest, or the veins need a day to grow back.":
      "Jeśli nie możesz kopać, gra mówi teraz dlaczego: brak kilofa (kowal w Riverwood sprzedaje go tanio), kilof leży w skrzyni w twoim domu albo żyły potrzebują dnia, żeby odrosnąć.",
    "Old saves where a pickaxe looked worn out or empty get it working again.":
      "W starych zapisach kilof, który wyglądał na zużyty albo pusty, znów działa.",
  });
  I18N_EXTRA.pat.push(
    [/^Your pickaxe is in your house chest in (.+)\. Take it with you to mine\.$/, (m) => `Twój kilof leży w skrzyni w domu w ${m[1]}. Zabierz go ze sobą, żeby kopać.`],
  );
})();
