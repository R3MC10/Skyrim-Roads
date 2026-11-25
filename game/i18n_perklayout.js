/* i18n_perklayout.js: Polish for the perklayout patch note (perk star labels never overlap; skyui.js).
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // patch note b247
  "Tidier perk stars": "Porządniejsze gwiazdy atutów",
  "Perk names in the star trees never sit on top of each other any more, and long names are never cut short with \"…\": they wrap onto a second line instead.":
    "Nazwy atutów w drzewkach gwiazd już nigdy nie nachodzą na siebie, a długie nazwy nie są ucinane trzykropkiem „…”: przechodzą do drugiej linijki.",
  "Each perk now sits right above the perks it needs, with the first ones at the bottom, so the trees read from the ground up.":
    "Każdy atut stoi teraz nad atutami, których wymaga, a pierwsze są na dole, więc drzewka czyta się od ziemi w górę.",
  "On a phone, pinch the stars to zoom in or out and drag to look around. Zoomed far out, only the perks you can take keep their names.":
    "Na telefonie uszczypnij gwiazdy, żeby je przybliżyć albo oddalić, i przeciągnij palcem, żeby się rozejrzeć. Po mocnym oddaleniu nazwy zostają tylko przy atutach, które możesz wziąć.",
  "On a phone, tapping a star shows the perk in a panel at the bottom of the screen instead of a pop-up over the stars.":
    "Na telefonie dotknięcie gwiazdy pokazuje atut w panelu na dole ekranu zamiast okienka nad gwiazdami.",
});
