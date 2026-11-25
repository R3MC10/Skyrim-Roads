/* i18n_perksky.js: Polish for the perksky patch (the perk sky opens on what you can take; skyui.js star states).
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, star aria-labels in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // patch note b266
  "The perk stars open on what you can take": "Gwiazdy atutów otwierają się na tym, co możesz wziąć",
  "Opening a skill's stars now shows the perks you can take right away, instead of the top of the sky. On a phone the first stars at the bottom are no longer cut off.":
    "Po otwarciu gwiazd umiejętności od razu widać atuty, które możesz wziąć, a nie górę nieba. Na telefonie pierwsze gwiazdy na dole nie są już ucięte.",
  "Stars tell you more at a glance: perks you have are gold (with gold lines), ones you can take now shine bright with a slowly pulsing ring, ones that need a higher skill are blue-grey, and ones that need another perk first are dim.":
    "Gwiazdy mówią więcej na pierwszy rzut oka: twoje atuty są złote (ze złotymi liniami), te do wzięcia teraz świecą jasno z wolno pulsującym kręgiem, te wymagające wyższej umiejętności są szaroniebieskie, a te, które wymagają najpierw innego atutu, są przygaszone.",
  "Long lines that jump over a row are now faint dashed curves, so the sky no longer looks like a tangle of wires. They light up when you pick one of their stars.":
    "Długie linie przeskakujące rząd są teraz bladymi przerywanymi łukami, więc niebo nie wygląda już jak plątanina kabli. Rozświetlają się, gdy wybierzesz jedną z ich gwiazd.",
  "On a phone, every star is easier to tap, and the \"Tap a star\" hint sits under the stars instead of covering the bottom row.":
    "Na telefonie każdą gwiazdę łatwiej trafić palcem, a podpowiedź „Dotknij gwiazdy” stoi pod gwiazdami, zamiast zasłaniać dolny rząd.",
  "On a PC, the stars grow to fill the panel.": "Na PC gwiazdy powiększają się, żeby wypełnić panel.",
});
I18N_EXTRA.pat = I18N_EXTRA.pat || [];
I18N_EXTRA.pat.push(
  [/^(.+) \(skill too low\)$/, (m) => `${m[1]} (za niska umiejętność)`],
  [/^(.+) \(needs another perk first\)$/, (m) => `${m[1]} (najpierw potrzebny inny atut)`],
);
