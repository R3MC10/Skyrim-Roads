/* i18n_qafight.js: Polish for fight, dungeon and party lines the combat bug hunt (claude/qa-fight-*) found still in
   English, plus its patch notes. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // patch note b239
    "Fight fixes": "Poprawki w walkach",
    "Fixed: on phones, casting a heal with a follower along asked you to tap a portrait, but the Magic menu covered every portrait. The bar at the top now has a button for each person you can heal.": "Naprawione: na telefonach leczenie z towarzyszem u boku kazało stuknąć portret, ale menu Magii zasłaniało wszystkie portrety. Pasek na górze ma teraz przycisk dla każdej osoby, którą możesz uleczyć.",
    "Fixed: if the last foe fell between your moves, End turn and every other button could do nothing and the fight never ended. Any tap now finishes the fight.": "Naprawione: gdy ostatni wróg padł pomiędzy twoimi ruchami, Koniec tury i inne przyciski mogły nic nie robić, a walka się nie kończyła. Teraz każde stuknięcie kończy walkę.",
    "Fixed: more of the fight screen is in Polish (choosing who gets a heal, Your turn, Dual, the Magic and Items hints).": "Naprawione: więcej ekranu walki jest po polsku (wybór, kogo uleczyć, Twoja tura, Podwójnie, podpowiedzi w Magii i Przedmiotach).",
    // fightctl.js: choosing who gets a heal or a potion
    "Who gets it? Tap a name or a portrait.": "Kto to dostanie? Stuknij imię albo portret.",
    "Who gets it? Tap a portrait.": "Kto to dostanie? Stuknij portret.",
    "You": "Ty",
    // fightctl.js: the action bar and the Magic / Items sheet
    "Your turn": "Twoja tura",
    "Dual": "Podwójnie",
    "Tap Cast, or drag onto a target · ★ pins to quick slots": "Stuknij Zarzuć albo przeciągnij na cel · ★ przypina do szybkich slotów",
    "Tap to use, or drag onto someone · ★ pins to quick slots": "Stuknij, aby użyć, albo przeciągnij na kogoś · ★ przypina do szybkich slotów",
  });
})();
