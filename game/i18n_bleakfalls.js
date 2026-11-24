/* i18n_bleakfalls.js: Polish for the Bleak Falls Barrow fix (the barrow moves the quest on, Farengar never needs the
   stone, missing quest items come back: quests.js, towns.js, questitems.js) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words (story sentences are in i18n_story.js). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Give Farengar the Dragonstone": "Oddaj Farengarowi Smoczy Kamień",
    "The Dragonstone": "Smoczy Kamień",
    // patch note
    "Farengar's quest can't get stuck any more": "Zadanie Farengara już się nie zatnie",
    "Bleak Falls Barrow (main quest): clearing the barrow now moves the quest on by itself. The next step, \"The Dragonstone\", sends you to Farengar in Whiterun.":
      "Bleak Falls Barrow (główny wątek): oczyszczenie kurhanu samo przesuwa teraz zadanie dalej. Następny krok, „Smoczy Kamień”, wysyła cię do Farengara w Whiterun.",
    "Farengar doesn't need the Dragonstone in your pack any more. If it got lost, ended up in a chest or went to someone else in a party, just tell him: clearing the barrow is enough. Hand it in under Area tab → Court wizard, or with the button in the Journal.":
      "Farengar nie potrzebuje już Smoczego Kamienia w twoim plecaku. Jeśli kamień zginął, trafił do skrzyni albo do kogoś innego w drużynie, po prostu mu powiedz: oczyszczenie kurhanu wystarczy. Oddasz go w zakładce Okolica → Nadworny mag albo przyciskiem w Dzienniku.",
    "If your quest was stuck on \"bring him the Dragonstone\", it fixes itself next time you open the game. Clearing the barrow before you got the quest counts too.":
      "Jeśli twoje zadanie utknęło na „zanieś mu Smoczy Kamień”, naprawi się samo przy następnym uruchomieniu gry. Oczyszczenie kurhanu, zanim dostałeś zadanie, też się liczy.",
    "Quest items (the Dragonstone, a Glenmoril witch's head, the filled black soul gem) are now bound to you: you keep them when you die. If a quest needs one you don't carry any more, it comes back from your house chest or turns up in your pack.":
      "Przedmioty z zadań (Smoczy Kamień, głowa wiedźmy z Glenmoril, wypełniony czarny klejnot duszy) są teraz przypisane do ciebie: zostają przy tobie po śmierci. Jeśli zadanie potrzebuje któregoś, a już go nie masz, wraca ze skrzyni w twoim domu albo znajduje się w plecaku.",
  });
})();
