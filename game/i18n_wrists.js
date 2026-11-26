/* i18n_wrists.js: Polish for build 359's painted wrists (the patch note only: the change itself shows no text).
   Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Wrists that bend like wrists": "Nadgarstki, które zginają się jak nadgarstki",
    "Painted fighters' wrists look right: the glove or sleeve cuff now follows the forearm and bends smoothly into the hand, instead of a corner of the cuff sticking out past the sleeve.":
      "Nadgarstki malowanych wojowników wyglądają jak trzeba: mankiet rękawicy czy rękawa idzie teraz za przedramieniem i gładko przechodzi w dłoń, zamiast wystawać rogiem poza rękaw.",
    "Hands no longer bend further than a real wrist can, and a hand never snaps from one side to the other between frames.":
      "Dłonie nie zginają się już bardziej, niż pozwala prawdziwy nadgarstek, i nie przeskakują z jednej strony na drugą między klatkami.",
    "An open hand (casting a spell, lying knocked down) now lies straight along the arm instead of twisting toward a weapon it isn't holding.":
      "Otwarta dłoń (przy rzucaniu czaru albo gdy leżysz powalony) układa się prosto wzdłuż ręki, zamiast wykręcać się w stronę broni, której nie trzyma.",
    "A bow or staff at rest eases into its swing instead of jumping when the attack starts.":
      "Opuszczony łuk czy kostur płynnie przechodzi w zamach, zamiast skakać na początku ataku.",
  });
})();
