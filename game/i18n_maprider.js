/* i18n_maprider.js: Polish for the "Your rider on the map looks like you" patch notes (mapride.js: the moving horse and the painted hero on the map). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Your rider on the map looks like you":
      "Twój jeździec na mapie wygląda jak ty",
    "On the world map your hero now looks like they really do: your race, your helmet, your armour, your shield and weapon, the same as on the hero screen. That goes for walking and standing too.":
      "Na mapie świata twój bohater wygląda teraz tak, jak naprawdę wygląda: twoja rasa, hełm, zbroja, tarcza i broń, tak samo jak na ekranie bohatera. Pieszo i na postoju też.",
    "Your horse on the map has a new body that really moves: it walks, trots and gallops, and it picks the one that fits how fast you're going. On a road you gallop; in deep snow or rough hills you slow down to a trot or a walk.":
      "Twój koń na mapie ma nowe ciało, które naprawdę się rusza: idzie stępem, kłusem i galopem, i sam wybiera to, co pasuje do tempa. Na drodze galopujesz, w głębokim śniegu czy na stromych wzgórzach zwalniasz do kłusa albo stępa.",
    "At the gallop there's a moment with all four hooves off the ground, and you lean forward in the saddle. At the trot you bounce a bit.":
      "W galopie jest chwila, gdy wszystkie cztery kopyta są w powietrzu, a ty pochylasz się w siodle do przodu. W kłusie trochę podskakujesz.",
    "Standing still, your horse breathes, nods, flicks its tail and rests a back hoof now and then. Stopping and turning round are smooth now.":
      "Kiedy stoi, twój koń oddycha, kiwa łbem, macha ogonem i co jakiś czas odciąża tylne kopyto. Zatrzymywanie się i zawracanie są teraz płynne.",
    "Riding in a party, every horse moves in its own rhythm, so a group of eight doesn't march in step, and when the line gets crowded only your name and the leader's stay over the riders.":
      "W drużynie każdy koń ma swój własny rytm, więc ośmioosobowa grupa nie maszeruje krok w krok, a gdy w kolumnie robi się tłoczno, nad jeźdźcami zostaje tylko twoje imię i imię lidera.",
    "Reduce motion in Settings still keeps the horses calm and still.":
      "Ograniczenie ruchu w Ustawieniach nadal trzyma konie spokojnie w miejscu.",
  });
})();
