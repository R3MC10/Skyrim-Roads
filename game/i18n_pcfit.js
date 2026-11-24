/* i18n_pcfit.js: Polish for the PC-fit patch note (the game fills the whole window on a PC). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "The game fills the whole window on a PC":
      "Gra wypełnia całe okno na komputerze",
    "On a wide PC screen everything now fits on one screen: no more empty bands at the sides and no scrolling the page. The map and the side panel share the full width, and only long lists in the side panel scroll.":
      "Na szerokim ekranie komputera wszystko mieści się teraz na jednym ekranie: koniec z pustymi pasami po bokach i przewijaniem strony. Mapa i panel boczny dzielą całą szerokość, a przewijają się tylko długie listy w panelu bocznym.",
    "The place card on the map (Travel, X) no longer hides behind the bottom bar.":
      "Karta miejsca na mapie (Podróż, X) nie chowa się już pod dolnym paskiem.",
    "Skills: the skill list and its perk stars sit side by side, and the stars grow to fill the space. The side panel gets wider while they're open.":
      "Umiejętności: lista umiejętności i jej gwiazdy atutów stoją obok siebie, a gwiazdy rosną, żeby wypełnić miejsce. Panel boczny poszerza się, gdy są otwarte.",
    "Fights on a PC show a big battle picture on the left, with the fighters and your moves on the right, all without scrolling. Dungeons put the room on the left and the dungeon map on the right.":
      "Walki na komputerze pokazują duży obraz bitwy po lewej, a walczących i twoje ruchy po prawej, bez przewijania. Lochy pokazują komnatę po lewej i mapę lochu po prawej.",
    "Text and buttons are a little bigger on large monitors. Phones look the same as before.":
      "Tekst i przyciski są trochę większe na dużych monitorach. Na telefonach wszystko wygląda jak wcześniej.",
    "Paintings stay sharp: shop banners, town pictures, fight scenes, foes and the title picture are never stretched or blown up into a blur any more. On a very big or sharp screen a painting shows at its own size instead.":
      "Obrazy są ostre: banery sklepów, obrazy miast, sceny walk, przeciwnicy i obraz tytułowy nie są już rozciągane ani powiększane do rozmycia. Na bardzo dużym lub ostrym ekranie obraz pokazuje się w swoim własnym rozmiarze.",
  });
})();
