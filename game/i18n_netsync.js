/* i18n_netsync.js: Polish for the netsync patch note (netsync.js: parties stay in step over the network).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Parties stay in step":
    "Drużyna gra równo",
  "In a party everyone now sees the same thing. When two of you tap at the same moment (a vote, Ready, the next room, the boss chest), nobody's tap gets lost any more.":
    "W drużynie wszyscy widzą teraz to samo. Gdy dwie osoby stukną w tej samej chwili (głosowanie, Gotowe, następna komnata, skrzynia bossa), niczyje stuknięcie już nie ginie.",
  "Every few seconds the phones in a party quietly compare notes. If one missed something (weak signal, screen off, a reconnect), it catches up by itself.":
    "Co kilka sekund telefony w drużynie po cichu się porównują. Jeśli któryś coś przegapił (słaby zasięg, wygaszony ekran, ponowne połączenie), sam to nadrabia.",
  "A dungeon room is the same for the whole party: the same puzzle, the same trap and the same chest lock as the leader's.":
    "Komnata w podziemiach jest taka sama dla całej drużyny: ta sama zagadka, ta sama pułapka i ten sam zamek skrzyni co u przywódcy.",
  "Loot votes: the leader's phone closes the vote for everyone, so a late vote or a phone with a wrong clock can't hand out different loot on different phones.":
    "Głosowanie o łupy: telefon przywódcy zamyka głosowanie dla wszystkich, więc spóźniony głos albo telefon ze złym zegarem nie rozda innych łupów na różnych telefonach.",
  "Anything you did while your connection dropped is sent as soon as you're back online.":
    "Wszystko, co zrobisz bez połączenia, zostanie wysłane, gdy tylko wrócisz do sieci.",
});
