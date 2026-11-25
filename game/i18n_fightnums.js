/* i18n_fightnums.js: Polish for the readable fight numbers (fightnums.js) and their patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Blocked": "Zablokowane", "Dodged": "Unik",
    "Fight numbers you can read": "Liczby w walce, które da się przeczytać",
    "Damage, heal and crit numbers in fights have a thick dark outline and grow with your screen, so they're easy to read on a phone and on a big PC monitor. Crits are big and gold.":
      "Liczby obrażeń, leczenia i trafień krytycznych mają grubą ciemną obwódkę i rosną razem z ekranem, więc łatwo je przeczytać na telefonie i na dużym monitorze. Trafienia krytyczne są duże i złote.",
    "Each kind has its own look: damage in its element's colour, heals green with a glow, magicka and stamina as small blue and green chips, and Miss, Blocked and Dodged as words.":
      "Każdy rodzaj wygląda inaczej: obrażenia w kolorze żywiołu, leczenie na zielono z poświatą, magia i wytrzymałość jako małe niebieskie i zielone plakietki, a Pudło, Zablokowane i Unik jako słowa.",
    "Several hits in a row no longer pile up on each other: every number finds its own free spot next to whoever it hit, never on the foe's bar, the turn order, the log or your fight buttons, and never off the screen.":
      "Kilka trafień z rzędu nie nakłada się już na siebie: każda liczba znajduje własne wolne miejsce przy tym, kogo trafiła, nigdy na pasku wroga, kolejce tur, dzienniku ani przyciskach walki i nigdy poza ekranem.",
    "Big foes (giants, trolls, spiders, dragons) and groups always fit fully on a phone screen: no more arm or wing cut off at the right edge.":
      "Duzi wrogowie (olbrzymy, trolle, pająki, smoki) i grupy zawsze mieszczą się w całości na ekranie telefonu: koniec z ręką albo skrzydłem uciętym przy prawej krawędzi.",
    "The turn order, your health orb's numbers and your party's bars are a bit bigger on a phone.":
      "Kolejka tur, liczby na kuli zdrowia i paski drużyny są na telefonie trochę większe.",
  });
})();
