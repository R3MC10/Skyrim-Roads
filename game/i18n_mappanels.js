/* i18n_mappanels.js: Polish for the map panels (mapsheet.js, placepanel.js, greet.js and ui.js hero rows) and their patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // kinds of places
  Farm: "Farma", Dungeon: "Loch", "Dragon lair": "Smocze leże", Landmark: "Punkt orientacyjny", Place: "Miejsce",
  // a place's panel
  Where: "Gdzie", "You are here": "Jesteś tutaj", "{n} away": "{n} stąd", Visited: "Odwiedzone", "Not yet": "Jeszcze nie",
  "Travel time": "Czas podróży", Note: "Uwaga", "The nearest dry land": "Najbliższy suchy ląd", "No way there": "Nie da się tam dojść",
  Rumour: "Plotka", "A lead": "Trop", Cleared: "Oczyszczone", "Fills up again in {n}": "Znów się zaludni za {n}",
  "Something has moved back in": "Coś się tam znów zagnieździło", "{name}: the ringleader is out": "{name}: prowodyr się pokazał",
  "{name} (stage {n})": "{name} (etap {n})", "Your bounty": "Twoja nagroda za głowę", "{g} gold": "{g} złota",
  "About {n}": "Około {n}", "Go inside": "Wejdź do środka", "Fight your way through, room by room": "Przebij się przez nie, komnata po komnacie",
  "Mine ore": "Wydobywaj rudę", "Swing a pick for iron and more": "Machaj kilofem: żelazo i nie tylko", "You're here.": "Jesteś tutaj.",
  "Walk here": "Idź tutaj", "Off the road, into the wilds": "Z dala od drogi, w dzicz", "Drop a pin here to come back later": "Wbij tu pinezkę, żeby wrócić później",
  "Your pin": "Twoja pinezka", "Set off for your pin": "Ruszaj do swojej pinezki", "Your party sees it on their maps": "Twoja drużyna zobaczy ją na swoich mapach",
  "Take the pin off your map": "Zdejmij pinezkę z mapy", "Tap somewhere on land to roam there.": "Dotknij lądu, żeby tam powędrować.",
  // another hero's panel
  "Between you": "Między wami", Strangers: "Obcy", travelling: "w podróży", "in a dungeon": "w lochu",
  "Invite to your party": "Zaproś do drużyny", "Only your party leader can invite": "Zapraszać może tylko przywódca drużyny",
  "They'll see it under Social → Party": "Zobaczą to w Społeczność → Drużyna", "Swap items and gold": "Wymień się przedmiotami i złotem",
  "Get to the same place to trade": "Bądźcie w tym samym miejscu, żeby handlować", "Add as a friend": "Dodaj do przyjaciół",
  "See where they are and send messages": "Widzisz, gdzie są, i możesz pisać wiadomości",
  // the patch note
  "Everything on the map opens in a panel": "Wszystko na mapie otwiera się w panelu",
  "Places, dungeons, caves, forts, camps, shrines, standing stones and landmarks now open in the same panel as caravans: on a PC it sits on the right and the map stays usable beside it; on a phone it slides up above the menu bar.":
    "Miejsca, lochy, jaskinie, forty, obozy, kapliczki, kamienie przeznaczenia i punkty orientacyjne otwierają się teraz w tym samym panelu co karawany: na PC po prawej stronie, a mapa obok dalej działa; na telefonie wysuwa się nad paskiem menu.",
  "The panel shows the place's marker, its hold, how far it is, whether you've been there, and what's going on: a quest or a rumour there, when a cleared dungeon fills up again, a crisis or your bounty in that hold.":
    "Panel pokazuje znacznik miejsca, jego krainę, jak daleko jest, czy już tam byłeś i co się dzieje: zadanie albo plotkę, kiedy oczyszczony loch znów się zaludni, kryzys albo twoją nagrodę za głowę w tej krainie.",
  "Travel, Go inside and Mine ore are big rows with a line under them saying what they do. Your pins and spots in the wilds (Walk here, Pin, Share, Remove) open there too.":
    "Podróżuj, Wejdź do środka i Wydobywaj rudę to duże przyciski z linijką opisu pod spodem. Twoje pinezki i miejsca w dziczy (Idź tutaj, Pinezka, Udostępnij, Usuń) też się tam otwierają.",
  "Tapping another hero opens their panel too: Greet a stranger, Invite them to your party, Trade or Add as a friend right from the map.":
    "Dotknięcie innego bohatera też otwiera jego panel: przywitaj nieznajomego, zaproś do drużyny, handluj albo dodaj do przyjaciół prosto z mapy.",
  "Tap another marker and the panel switches to it. Tap empty map, press X, Esc or your phone's back button to close it.":
    "Dotknij innego znacznika, a panel się na niego przełączy. Dotknij pustej mapy, naciśnij X, Esc albo przycisk wstecz w telefonie, żeby go zamknąć.",
});
