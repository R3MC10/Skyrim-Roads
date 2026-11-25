/* i18n_rewardtips.js: Polish for rewardtips.js (item tooltips on reward and loot screens) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "In a party, gold is split evenly.": "W drużynie złoto dzieli się po równo.",
    "Daedric artifact": "Artefakt daedryczny",
    "Item cards on rewards": "Karty przedmiotów przy nagrodach",
    "Every loot and reward icon now shows the full item card, like in your pack: damage or armour, weight, value, the enchantment and what it does, potion effects, how many you already have, and the same \"against what you wear\" lines as the Items menu (damage, weight and value, better in green, worse in red).":
      "Każda ikona łupu i nagrody pokazuje teraz pełną kartę przedmiotu, jak w plecaku: obrażenia albo pancerz, wagę, wartość, zaklęcie i jego działanie, efekty mikstur, ile już masz, i te same linijki „w porównaniu z tym, co nosisz” co w menu Przedmioty (obrażenia, waga i wartość, lepsze na zielono, gorsze na czerwono).",
    "On a PC rest the mouse on an icon. On a phone tap it: the card slides up from the bottom of the screen, so it never covers the loot or the buttons. Tap anywhere else to close it.":
      "Na PC najedź myszką na ikonę. Na telefonie stuknij ją: karta wysuwa się z dołu ekranu, więc nigdy nie zasłania łupu ani przycisków. Stuknij gdziekolwiek indziej, żeby ją zamknąć.",
    "Gold and stacks get a short card too.": "Złoto i stosy też mają krótką kartę.",
    "Dungeon loot, fight loot, boss loot, the party loot vote, road events, quest and crisis rewards, expeditions, heists, Daedric artifacts, fishing, hunting, mining and market stalls all have it.":
      "Mają to łupy z lochów, walk i bossów, głosowanie drużyny nad łupem, wydarzenia na drodze, nagrody za zadania i kryzysy, wyprawy, skoki, artefakty daedryczne, łowienie, polowanie, kopanie i stragany.",
  });
  I18N_EXTRA.pat.push(
    [/^Already have (\d+)$/, (m) => `Masz już ${m[1]}`],
    [/^Stack of (\d+) · weight ([\d.]+) · value (\d+)$/, (m) => `Stos: ${m[1]} · waga ${m[2]} · wartość ${m[3]}`],
    [/^Into your purse\. You now have (\d+) gold\.$/, (m) => `Do sakiewki. Masz teraz ${m[1]} sztuk złota.`],
    [/^(\d+) gold$/, (m) => `${m[1]} sztuk złota`],
  );
})();
