/* i18n_fightsync.js: Polish for the fightsync patch (party fights stay in step: tbfight.js remoteFor, sharedfight.js).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Party fights stay in step":
    "Walki drużyny idą równo",
  "Party fights no longer get stuck on someone's turn when a message gets lost on a bad connection: your phone sends your turn again until the leader has it, and the leader's phone keeps telling you it's your turn until you've seen it. Nothing is ever played twice.":
    "Walki drużyny nie stają już na czyjejś turze, gdy przy słabym zasięgu zginie wiadomość: twój telefon wysyła twoją turę ponownie, aż lider ją dostanie, a telefon lidera powtarza, że to twoja tura, aż ją zobaczysz. Nic nie zostanie rozegrane dwa razy.",
  "A spell that makes the foe flee or vanish (Turn Undead, Banish) now ends the fight for the whole party, not just on your screen. Before, your next turns did nothing.":
    "Czar, który przegania lub odsyła wroga (Odpędzenie nieumarłych, Wygnanie), kończy teraz walkę dla całej drużyny, a nie tylko na twoim ekranie. Wcześniej twoje kolejne tury nic nie robiły.",
  "With foes in two rows, your turn no longer hangs when the foe you were aiming at fell just before it: you aim at one still standing.":
    "Gdy wrogowie stoją w dwóch rzędach, twoja tura już się nie zawiesza, jeśli wróg, w którego celowałeś, padł tuż przed nią: celujesz w tego, który jeszcze stoi.",
  "If your phone loses touch with the party for a while, you join the fight again when you're back, or you see how it ended and get your share. A short \"Catching up with your party…\" note shows while your screen syncs.":
    "Jeśli twój telefon na chwilę straci kontakt z drużyną, po powrocie wracasz do walki albo widzisz, jak się skończyła, i dostajesz swoją część. Gdy ekran się wyrównuje, pokazuje się krótka notka „Doganiasz drużynę…”.",
  "Catching up with your party…":
    "Doganiasz drużynę…",
  "You lost touch with your party. Your result comes in when you're back.":
    "Straciłeś kontakt z drużyną. Twój wynik przyjdzie, gdy wrócisz.",
});
