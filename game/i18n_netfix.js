/* i18n_netfix.js: Polish for the "Players can see each other again" patch note (store.js: signed-in phones are on
   the server world and the phone-to-phone world at once). Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Players can see each other again":
    "Gracze znów się widzą",
  "Players can see each other again. Since accounts came in, players who signed in and players who didn't were in two separate worlds, so friends vanished from each other's map, Social tab and parties.":
    "Gracze znów się widzą. Odkąd weszły konta, zalogowani i niezalogowani gracze byli w dwóch osobnych światach, więc znajomi znikali sobie z mapy, z zakładki Społeczność i z drużyn.",
  "Signed in, your phone now joins both: the account world and the phone-to-phone world. Signed in or not, you see each other, chat, trade and team up like before.":
    "Po zalogowaniu telefon dołącza teraz do obu: do świata kont i do świata telefon-telefon. Zalogowani czy nie, widzicie się, piszecie, handlujecie i gracie w drużynie jak wcześniej.",
  "A friend who signed in on an older version still only sees players who signed in. If someone is missing, ask them to update the game.":
    "Znajomy zalogowany na starszej wersji nadal widzi tylko zalogowanych graczy. Jeśli kogoś brakuje, poproś, żeby zaktualizował grę.",
});
