/* Polish for old patch notes about loadouts and fight rules (the "AI & Loadouts" tab, now removed) and for the
   messages that used to say "Add it to your tactics". Loaded before i18n.js, which merges I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // the old tab name, still in old patch notes
  "AI & Loadouts": "SI i zestawy",
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
  "Deadly at your level: heroes under level 10 often lose this fight. Bring friends and plenty of potions.": "Na twoim poziomie to śmiertelnie groźna walka: bohaterowie poniżej 10. poziomu często ją przegrywają. Weź przyjaciół i dużo mikstur.",
  "Bring friends and plenty of potions.": "Weź przyjaciół i dużo mikstur.",
  "A hard fight at your level. Bring friends and potions.": "Na twoim poziomie to ciężka walka. Weź przyjaciół i mikstury.",
  "Bring friends and potions.": "Weź przyjaciół i mikstury.",
  // loading tips (immerse.js)
  "You play fights turn by turn. Bring healing potions and use them early.": "Walki rozgrywasz turą po turze. Weź mikstury leczenia i używaj ich wcześnie.",
  "You play fights turn by turn.": "Walki rozgrywasz turą po turze.", "Bring healing potions and use them early.": "Weź mikstury leczenia i używaj ich wcześnie.",
  "Hard fight ahead? Bring friends: a party of up to eight fights side by side.": "Ciężka walka przed tobą? Weź przyjaciół: drużyna do ośmiu osób walczy ramię w ramię.",
  // patch note
  "Loadouts and fight rules are back": "Zestawy i reguły walki wróciły",
  "Your loadouts, the Smart AI / Hybrid / Custom switch and your own fight rules have a home again: Character → AI & Loadouts. On the compass: Skills, then the AI & Loadouts tab.":
    "Twoje zestawy, przełącznik Sprytna SI / Hybryda / Własna i twoje reguły walki znów mają swoje miejsce: Postać → SI i zestawy. Na kompasie: Umiejętności, a potem karta SI i zestawy.",
  "Messages about new spells, shouts and powers no longer tell you to add them to your tactics: they say where to find them (the Magic menu) and to use them in a fight.":
    "Wiadomości o nowych zaklęciach, okrzykach i mocach nie każą już dodawać ich do taktyki: mówią, gdzie je znaleźć (menu Magii), i żeby użyć ich w walce.",
});
