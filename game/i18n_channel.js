/* i18n_channel.js: Polish for channel.js (teammates preparing a move: the bar over their head) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "preparing a move": "przygotowuje ruch",
    "See your friends get ready": "Widać, jak przyjaciele się szykują",
    "In a party fight, when a friend casts a spell, swings, draws a bow or uses a skill from an item, you now see them get ready for it: their hero raises a hand with embers, gathers frost or sparks, pulls back their weapon or draws the bowstring, and a small bar over their head fills while they play their minigame.":
      "W walce drużynowej, gdy przyjaciel rzuca czar, bierze zamach, napina łuk albo używa umiejętności z przedmiotu, widzisz teraz, jak się do tego szykuje: jego bohater unosi dłoń z iskrami ognia, zbiera mróz albo błyskawice, odciąga broń albo napina cięciwę, a mały pasek nad jego głową wypełnia się, gdy gra w swoją minigrę.",
    "Each kind of move has its own colour: fire orange, frost ice blue, shock violet, healing gold, blows steel grey, bows green.":
      "Każdy rodzaj ruchu ma swój kolor: ogień pomarańczowy, mróz lodowo niebieski, błyskawice fioletowe, leczenie złote, ciosy stalowo szare, łuki zielone.",
    "A great hit flashes gold, a fumble makes them stumble, and if a move gets called off the bar just fades away.":
      "Świetne trafienie błyska złotem, nieudany ruch sprawia, że się potykają, a gdy ruch zostanie odwołany, pasek po prostu znika.",
    "Your own hero takes the same stance behind your minigame, in solo fights too.":
      "Twój bohater przyjmuje tę samą postawę za twoją minigrą, także w walkach w pojedynkę.",
    "A minigame can't hold up the fight any more: after 12 seconds the move is called off and you keep your guard up.":
      "Minigra nie może już wstrzymać walki: po 12 sekundach ruch zostaje odwołany, a ty trzymasz gardę.",
  });
})();
