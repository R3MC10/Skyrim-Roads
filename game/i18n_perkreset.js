/* i18n_perkreset.js: Polish for perkreset.js (resetting perks at a shrine or a city temple), the temple tile in the
   Area tab and the patch note. Loaded before i18n.js. perkreset.js translates its templates ("{n} gold") before it
   fills them in, so the templates themselves are the keys here. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const W = {
    "Reset perks": "Zresetuj atuty", "Perks reset": "Atuty zresetowane", "Temple": "Świątynia", "Price": "Cena", "You get back": "Odzyskujesz", "After this": "Potem",
    "Close": "Zamknij", "Open perks": "Otwórz atuty", "Keep my perks": "Zostaw moje atuty", "Reset for free": "Zresetuj za darmo", "Reset for {n} gold": "Zresetuj za {n} złota",
    "{n} gold": "{n} złota", "You have {n} gold.": "Masz {n} złota.", "You need {n} gold.": "Potrzebujesz {n} złota.", "You paid {n} gold.": "Zapłacono {n} złota.",
    "Free (your first reset)": "Za darmo (twój pierwszy reset)", "Next reset: {n} gold": "Następny reset: {n} złota",
    " (drops again a week after each reset)": " (cena spada tydzień po każdym resecie)", " and ": " i ",
    "1 perk point": "1 punkt atutu", "{n} perk points": "punkty atutów: {n}", "1 level-up choice": "1 wybór awansu", "{n} level-up choices": "wybory awansu: {n}",
    "Take back {what}.": "Odzyskaj: {what}.", "Skills and level stay.": "Umiejętności i poziom zostają.", "Skills, skill XP and level stay.": "Umiejętności, ich doświadczenie i poziom zostają.",
    "Nothing to take back yet.": "Na razie nie ma czego odzyskać.", "Paid resets open at level {n}.": "Płatne resety od poziomu {n}.",
    "Not in the middle of a fight.": "Nie w trakcie walki.", "Not inside a dungeon. Finish it or leave first.": "Nie w lochu. Najpierw go skończ albo wyjdź.",
    "Not in the middle of a heist.": "Nie w trakcie skoku.", "Deal with what's on the road first.": "Najpierw zajmij się tym, co czeka na drodze.",
    "Pray at a shrine or a city temple to reset your perks.": "Pomódl się przy kapliczce albo w świątyni w mieście, by zresetować atuty.",
    "The shrine stays silent. Nothing changed.": "Kapliczka milczy. Nic się nie zmieniło.",
    "The priests of {p} can lift your old path from you.": "Kapłani ({p}) mogą zdjąć z ciebie dawną ścieżkę.",
    "You kneel at {p} and let your old path go.": "Klękasz przy: {p} i porzucasz dawną ścieżkę.",
    "Your perks are reset: {what} are back to spend.": "Atuty zresetowane, znów do wydania: {what}.", "This one was free.": "Ten był za darmo.",
    "Spend your points again in Character → Perks.": "Wydaj punkty od nowa w Postać → Atuty.",
    "Want a different build? Pray at any shrine or city temple to take your perks back.": "Chcesz inaczej rozwinąć postać? Pomódl się przy dowolnej kapliczce albo w świątyni w mieście, by odzyskać atuty.",
    "Your first reset is free.": "Pierwszy reset jest za darmo.", "Right now it costs {n} gold.": "Teraz kosztuje {n} złota.",
    "First perk reset free": "Pierwszy reset atutów za darmo", "Perk reset {n} gold": "Reset atutów: {n} złota",
    "Priests cure diseases and lift your old path: reset your perks here. Your first reset is free; after that the price rises with your level and with each reset this week.":
      "Kapłani leczą choroby i zdejmują dawną ścieżkę: tu zresetujesz atuty. Pierwszy reset jest za darmo, potem cena rośnie z poziomem i z każdym resetem w tym tygodniu.",
    "Priests, prayers and a fresh start for your perks.": "Kapłani, modlitwy i nowy start dla twoich atutów.", "Reset your perks": "Zresetuj atuty",
    // patch note
    "Reset your perks at a shrine": "Reset atutów przy kapliczce",
    "Want a different build? Kneel at any wayside shrine, or visit the temple in Whiterun, Riften, Solitude, Markarth, Windhelm or Falkreath (Area tab → Services), and reset your perks.":
      "Chcesz inaczej rozwinąć postać? Uklęknij przy dowolnej kapliczce przy drodze albo odwiedź świątynię w Whiterun, Riften, Solitude, Markarth, Windhelm lub Falkreath (zakładka Okolica → Usługi) i zresetuj atuty.",
    "Every perk point comes back, and so does every Health, Magicka or Stamina choice. Your skills and level stay.": "Wraca każdy punkt atutu i każdy wybór Zdrowia, Magii albo Wytrzymałości. Umiejętności i poziom zostają.",
    "Your first reset is free. After that it costs gold from level 5: about one or two jobs' pay, more at higher levels, and a little more each time you reset in the same week (it settles down again after a week).":
      "Pierwszy reset jest za darmo. Potem kosztuje złoto od poziomu 5: tyle, co jedno albo dwa zlecenia, więcej na wyższych poziomach, i trochę więcej za każdy reset w tym samym tygodniu (po tygodniu cena wraca).",
    "The window tells you the price, what you get back and what the next reset will cost before anything happens. Not during fights, dungeons or heists.":
      "Zanim cokolwiek się stanie, okno pokazuje cenę, to, co odzyskasz, i ile będzie kosztował następny reset. Nie w trakcie walki, lochu ani skoku.",
    "The old 10,000 gold Respec button on the Character screen is gone; it now points you to the shrines.": "Stary przycisk Nowy rozwój za 10 000 złota na ekranie postaci zniknął; teraz kieruje do kapliczek.",
  };
  for (const [k, v] of Object.entries(W)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(
    [/^Reset for ([\d,]+) gold$/, (m) => `Zresetuj za ${m[1].replace(/,/g, " ")} złota`],
    [/^Perk reset ([\d,]+) gold$/, (m) => `Reset atutów: ${m[1].replace(/,/g, " ")} złota`],
  );
})();
