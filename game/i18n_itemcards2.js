/* i18n_itemcards2.js: Polish for the item-card lines about what else changes when you put something on (itemcmp.js notes),
   the with-skill damage in the card header, and the patch note. Loaded before i18n.js; lines with names or numbers go in pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const SK = { "One-Handed": "Broń jednoręczna", "Two-Handed": "Broń dwuręczna", Archery: "Łucznictwo", Spear: "Włócznia", "Hand-to-Hand": "Walka wręcz", Destruction: "Zniszczenie" };
  const sk = (x) => SK[x] || x;
  Object.assign(I18N_EXTRA.words, {
    "Hits for": "Bije za",
    "Item cards say what changes": "Karty przedmiotów mówią, co się zmieni",
    "The damage at the top of a weapon's card is now what it really hits for in your hands, with your skill and perks, the same number as in the comparison below. The weapon's own number is shown next to it as \"base\".":
      "Obrażenia na górze karty broni to teraz to, za ile naprawdę bije w twoich rękach, z twoją umiejętnością i atutami, ta sama liczba co w porównaniu niżej. Liczba samej broni stoi obok jako \"bazowo\".",
    "Item cards now say what else changes when you put something on: a two-handed weapon takes your shield off (and with it its armour and Shield bash), a shield takes a two-handed weapon off, and a bow or crossbow tells you when you have nothing to shoot.":
      "Karty przedmiotów mówią teraz, co jeszcze się zmieni, gdy coś założysz: broń dwuręczna zdejmuje tarczę (a z nią jej pancerz i uderzenie tarczą), tarcza zdejmuje broń dwuręczną, a łuk lub kusza mówi, gdy nie masz czym strzelać.",
    "When a weapon uses a different skill from the one you hold, the card says so, with both of your skill levels.":
      "Gdy broń używa innej umiejętności niż ta, którą trzymasz, karta to mówi i podaje oba twoje poziomy.",
    "This shows on loot and reward cards, in the Items menu, in shops and on the phone's bottom sheet.":
      "Widać to na kartach łupów i nagród, w menu Przedmioty, w sklepach i w dolnym panelu na telefonie.",
    "Putting on a shield while holding a two-handed weapon now takes the weapon off, instead of saying no.":
      "Założenie tarczy, gdy trzymasz broń dwuręczną, teraz zdejmuje tę broń, zamiast odmawiać.",
  });
  I18N_EXTRA.pat.push(
    [/^(\d+) \((\d+) base\)$/, (m) => `${m[1]} (bazowo ${m[2]})`],
    [/^Takes both hands: your (.+) comes off \(−(\d+) armour, no Shield bash\)$/, (m) => `Zajmuje obie ręce: zdejmiesz ${m[1]} (−${m[2]} pancerza, bez uderzenia tarczą)`],
    [/^Takes both hands: your (.+) comes off \(no Shield bash\)$/, (m) => `Zajmuje obie ręce: zdejmiesz ${m[1]} (bez uderzenia tarczą)`],
    [/^Takes both hands: your (.+) in the left hand comes off$/, (m) => `Zajmuje obie ręce: zdejmiesz ${m[1]} z lewej ręki`],
    [/^Your (.+) needs both hands: it comes off$/, (m) => `${m[1]} potrzebuje obu rąk: zdejmiesz ją`],
    [/^Your (.+) in the left hand comes off$/, (m) => `Zdejmiesz ${m[1]} z lewej ręki`],
    [/^You have no arrows: it can only bash until you get some$/, () => "Nie masz strzał: dopóki ich nie zdobędziesz, możesz tylko uderzać"],
    [/^You have no bolts: it can only bash until you get some$/, () => "Nie masz bełtów: dopóki ich nie zdobędziesz, możesz tylko uderzać"],
    [/^Uses (.+) \(yours: (\d+)\) instead of (.+) \((\d+)\)$/, (m) => `Używa: ${sk(m[1])} (twoja: ${m[2]}) zamiast: ${sk(m[3])} (${m[4]})`],
    [/^Your (.+) needs both hands: it comes off if you put on a shield\.$/, (m) => `${m[1]} potrzebuje obu rąk: zdejmiesz ją, gdy założysz tarczę.`],
  );
})();
