/* i18n_dungeonphone.js: Polish for the dungeon screen on phones (dunstrip.js route strip, dunfx.js) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Cleared": "Oczyszczone",
    "Your route": "Twoja trasa",
    "Show the full map": "Pokaż całą mapę",
    "Dungeons fit your phone better": "Lochy lepiej mieszczą się na telefonie",
    "A strip above the room shows how deep you are and the rooms you can go to next. Tap one to go there, or tap Map for the whole chart.": "Pasek nad komnatą pokazuje, jak głęboko jesteś i do których komnat możesz pójść dalej. Stuknij jedną, żeby tam iść, albo stuknij Mapa, żeby zobaczyć cały plan.",
    "The room's choices sit two to a row, so Fight, Sneak, Run and your potion fit on the screen without scrolling.": "Wybory w komnacie stoją po dwa w rzędzie, więc Walka, Skradanie, Ucieczka i mikstura mieszczą się na ekranie bez przewijania.",
    "No more snow or rain inside caves and ruins. Instead you see dust in the torchlight in barrows, water dripping in caves, and sparks drifting in Dwemer ruins and by campfires.": "Koniec ze śniegiem i deszczem w jaskiniach i ruinach. Zamiast tego w kurhanach widać kurz w świetle pochodni, w jaskiniach kapie woda, a w ruinach Dwemerów i przy ogniskach unoszą się iskry.",
    "The foe waiting in a room now stands in the painting, so a draugr that opens its eyes is really there.": "Wróg czekający w komnacie stoi teraz na obrazie, więc draugr, który otwiera oczy, naprawdę tam jest.",
  });
})();
