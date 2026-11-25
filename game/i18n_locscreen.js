/* i18n_locscreen.js: Polish for locscreen.js (a place opens full screen: title, signposts, people) and its patch note.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  // buttons and bits of the scene
  "Leave": "Wyjdź", "List": "Lista", "Scene view": "Widok miejsca", "Show as a list": "Pokaż jako listę", "Close": "Zamknij", "People here": "Ludzie tutaj",
  "Here": "Tutaj", "Player": "Gracz", "In your party": "W twojej drużynie", "Follower": "Towarzysz", "Traveller": "Podróżnik",
  "Caravan here": "Karawana na miejscu", "Arriving soon": "Zaraz przyjedzie",
  // kinds of place
  "City": "Miasto", "Town": "Miasteczko", "Farm": "Farma", "Fort": "Fort", "Camp": "Obóz", "Lair": "Leże", "Standing stone": "Kamień mocy", "Shrine": "Kapliczka", "Landmark": "Ciekawe miejsce", "Dungeon": "Loch",
  "One of the great cities of Skyrim.": "Jedno z wielkich miast Skyrim.", "A small town on the road.": "Małe miasteczko przy drodze.",
  "Fields, a farmhouse and people who work them.": "Pola, dom i ludzie, którzy na nich pracują.", "Old walls, and whoever holds them now.": "Stare mury i ten, kto ich teraz trzyma.",
  "Tents, a fire pit and watchful eyes.": "Namioty, palenisko i czujne oczy.", "Bones on the rocks. Something big lives here.": "Kości na skałach. Mieszka tu coś dużego.",
  "An old standing stone humming with power.": "Stary kamień, który brzęczy mocą.", "A shrine where travellers leave offerings.": "Kapliczka, przy której podróżni zostawiają dary.",
  "A place worth a look.": "Miejsce warte obejrzenia.", "A way down into the dark.": "Droga w dół, w ciemność.",
  // cities' lines
  "Dragonsreach looks down over the plains and the Bannered Mare.": "Smocza Przystań spogląda na równiny i Gospodę pod Chorągwianą Klaczą.",
  "The capital on its stone arch, ships in the bay below.": "Stolica na kamiennym łuku, w zatoce pod nią statki.",
  "Old grey stone, older grudges, snow on every roof.": "Stary szary kamień, jeszcze starsze urazy, śnieg na każdym dachu.",
  "Canals, autumn leaves, and someone's hand in your purse.": "Kanały, jesienne liście i czyjaś ręka w twojej sakiewce.",
  "A city carved into the cliffs by the Dwemer.": "Miasto wykute w skałach przez Dwemerów.",
  "A quiet town among the pines, and a very big graveyard.": "Ciche miasteczko wśród sosen i bardzo duży cmentarz.",
  "Mist off the marsh and stilted houses on the water.": "Mgła znad bagien i domy na palach nad wodą.",
  "Mines, a harbour, and folk who sleep badly.": "Kopalnie, port i ludzie, którzy źle śpią.",
  "What the sea left of a great city, under the College.": "To, co morze zostawiło z wielkiego miasta, pod Kolegium.",
  "A mill, a smithy and the river running past.": "Tartak, kuźnia i płynąca obok rzeka.",
  "A Dunmer port on Solstheim, under the ash.": "Port Dunmerów na Solstheim, pod popiołem.",
  // signposts of places without shops
  "Entrance": "Wejście", "The camp": "Obóz", "The lair": "Leże", "Fort gate": "Brama fortu", "Farmhouse": "Gospodarstwo", "Look around": "Rozejrzyj się",
  "Gathering": "Zbieractwo", "Plants in reach": "Rośliny w zasięgu", "Town crier": "Herold", "News and rumours": "Wieści i plotki", "Campfire": "Ognisko", "Cook, fish, hunt": "Gotuj, łów ryby, poluj",
  "Legendary beast": "Legendarna bestia", "A contract nearby": "Zlecenie w pobliżu", "Cleared for now": "Na razie oczyszczone", "Go inside": "Wejdź do środka",
  "Your stone": "Twój kamień", "Take its blessing": "Przyjmij błogosławieństwo", "Leave an offering": "Zostaw dar", "Work, trade, rest": "Praca, handel, odpoczynek",
  "See who holds it": "Zobacz, kto go trzyma", "What's here": "Co tu jest",
  // patch note b308
  "Every place opens full screen": "Każde miejsce otwiera się na pełnym ekranie",
  "Arriving in a town, a farm, a camp, a cave mouth, a shrine or any other place now opens it full screen: a painted picture of the place, its name in big letters, the hold, a short line about it, the time and the weather.":
    "Przybycie do miasta, na farmę, do obozu, przed wejście do jaskini, do kapliczki czy w inne miejsce otwiera je teraz na pełnym ekranie: malowany obraz miejsca, jego nazwa wielkimi literami, władztwo, krótki opis, godzina i pogoda.",
  "Everything you can do there stands on the picture as a signpost (blacksmith, inn, general goods, the jarl, the notice board, caravans, gathering...) with a few words on what's going on: open or closed, a job to hand in, a caravan in town. Tap one to open it; its back button brings you back to the place.":
    "Wszystko, co możesz tam zrobić, stoi na obrazie jako drogowskaz (kowal, karczma, sklep, jarl, tablica ogłoszeń, karawany, zbieractwo...) z kilkoma słowami o tym, co się dzieje: otwarte czy zamknięte, zlecenie do oddania, karawana w mieście. Stuknij, żeby otworzyć; przycisk wstecz wraca do miejsca.",
  "People here (other players, your follower, the townsfolk you can talk to) sit as small portraits along the bottom. Pictures drift slowly, nights are darker, and snow or rain falls when the weather turns.":
    "Ludzie tutaj (inni gracze, twój towarzysz, mieszkańcy, z którymi możesz pogadać) siedzą jako małe portrety na dole. Obrazy powoli się przesuwają, noce są ciemniejsze, a gdy pogoda się zmienia, pada śnieg albo deszcz.",
  "On a phone the signposts turn into a readable list over the lower half of the picture. On a PC, arrows or WASD walk between them, Enter opens one and Esc leaves to the map.":
    "Na telefonie drogowskazy zamieniają się w czytelną listę na dolnej połowie obrazu. Na PC strzałki albo WASD przechodzą między nimi, Enter otwiera, a Esc wraca na mapę.",
  "Prefer the old plain list? Press List; the game remembers it, and Scene view brings the picture back.":
    "Wolisz starą zwykłą listę? Naciśnij Lista; gra to zapamięta, a Widok miejsca przywróci obraz.",
});
