/* Polish for the way back into loadouts and fight rules (the "AI & Loadouts" tab in the Character menu) and for the
   messages that used to say "Add it to your tactics". Loaded before i18n.js, which merges I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // the tab and its screen header (menus.js, ui.js SCREEN_HELP)
  "AI & Loadouts": "SI i zestawy",
  "Gear sets and auto-play rules": "Zestawy ekwipunku i reguły automatycznej gry",
  "Loadouts are gear sets you switch between.": "Zestawy to komplety ekwipunku, między którymi się przełączasz.",
  "The Smart AI or your own rules play your turn when the game plays it for you (in a party, if you take too long).": "Sprytna SI albo twoje własne reguły rozgrywają twoją turę, gdy gra robi to za ciebie (w drużynie, gdy zbyt długo zwlekasz).",
  "Rules are checked from the top every turn, like “health below 40% → drink a potion”.": "Reguły są sprawdzane od góry w każdej turze, np. „zdrowie poniżej 40% → wypij miksturę”.",
  "Test them against a dummy before a real fight.": "Wypróbuj je na manekinie przed prawdziwą walką.",
  "Share code copied. Send it to a friend: they paste it in Character → AI & Loadouts.": "Kod skopiowany. Wyślij go znajomemu: wkleja go w Postać → SI i zestawy.",
  "Send it to a friend: they paste it in Character → AI & Loadouts.": "Wyślij go znajomemu: wkleja go w Postać → SI i zestawy.",
  // where new spells, shouts and powers live now
  "Find it in the Magic menu and use it in your next fight.": "Znajdziesz to w menu Magii; użyj tego w następnej walce.",
  "That spell is for fights. Cast it during a fight.": "To zaklęcie jest do walki. Rzuć je podczas walki.",
  "That spell is for fights.": "To zaklęcie jest do walki.", "Cast it during a fight.": "Rzuć je podczas walki.",
  "That shout is for fights. Use it during a fight.": "Ten okrzyk jest do walki. Użyj go podczas walki.",
  "That shout is for fights.": "Ten okrzyk jest do walki.", "Use it during a fight.": "Użyj go podczas walki.",
  "Shout it in your next fight.": "Krzyknij nim w następnej walce.",
  "You are one of the Circle now: Beast Form is in your Magic menu under Powers, once a day.": "Należysz teraz do Kręgu: Postać Bestii, raz dziennie, znajdziesz w menu Magii, w Mocach.",
  "Once a day, from the Magic menu (Powers).": "Raz dziennie, z menu Magii (Moce).",
  "Your spells, powers and shouts. Tap one to read it or use it.": "Twoje zaklęcia, moce i okrzyki. Dotknij jednego, by o nim przeczytać albo go użyć.",
  "Tap one to read it or use it.": "Dotknij jednego, by o nim przeczytać albo go użyć.",
  // hold crisis boss card (crises.js)
  "Deadly at your level: heroes under level 10 often lose this fight. Bring friends and potions, or add a Run away rule under AI & Loadouts.": "Na twoim poziomie to śmiertelnie groźna walka: bohaterowie poniżej 10. poziomu często ją przegrywają. Weź przyjaciół i mikstury albo dodaj regułę ucieczki w SI i zestawach.",
  "Bring friends and potions, or add a Run away rule under AI & Loadouts.": "Weź przyjaciół i mikstury albo dodaj regułę ucieczki w SI i zestawach.",
  "A hard fight at your level. Bring potions, or add a Run away rule under AI & Loadouts.": "Na twoim poziomie to ciężka walka. Weź mikstury albo dodaj regułę ucieczki w SI i zestawach.",
  "Bring potions, or add a Run away rule under AI & Loadouts.": "Weź mikstury albo dodaj regułę ucieczki w SI i zestawach.",
  // loading tips (immerse.js)
  "You play fights turn by turn. Bring healing potions and use them early.": "Walki rozgrywasz turą po turze. Weź mikstury leczenia i używaj ich wcześnie.",
  "You play fights turn by turn.": "Walki rozgrywasz turą po turze.", "Bring healing potions and use them early.": "Weź mikstury leczenia i używaj ich wcześnie.",
  "Your rules in AI & Loadouts are checked from the top down. The first one that fits is used.": "Twoje reguły w SI i zestawach są sprawdzane od góry do dołu. Używana jest pierwsza, która pasuje.",
  "Your rules in AI & Loadouts are checked from the top down.": "Twoje reguły w SI i zestawach są sprawdzane od góry do dołu.",
  // patch note
  "Loadouts and fight rules are back": "Zestawy i reguły walki wróciły",
  "Your loadouts, the Smart AI / Hybrid / Custom switch and your own fight rules have a home again: Character → AI & Loadouts. On the compass: Skills, then the AI & Loadouts tab.":
    "Twoje zestawy, przełącznik Sprytna SI / Hybryda / Własna i twoje reguły walki znów mają swoje miejsce: Postać → SI i zestawy. Na kompasie: Umiejętności, a potem karta SI i zestawy.",
  "Messages about new spells, shouts and powers no longer tell you to add them to your tactics: they say where to find them (the Magic menu) and to use them in a fight.":
    "Wiadomości o nowych zaklęciach, okrzykach i mocach nie każą już dodawać ich do taktyki: mówią, gdzie je znaleźć (menu Magii), i żeby użyć ich w walce.",
});
