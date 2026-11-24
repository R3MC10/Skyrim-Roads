/* i18n_pcmap.js: Polish for pcmap.js (the PC map home screen), mapfx.js, greet.js (Strangers) and their patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words ({name} is filled in after). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the PC map screen
    "Map quality": "Jakość mapy",
    "Low": "Niska",
    "Medium": "Średnia",
    "High": "Wysoka",
    "Character and menus": "Postać i menu",
    "Quest tracker": "Śledzenie zadania",
    "Show the quest tracker": "Pokaż śledzenie zadania",
    "Hide the quest tracker": "Ukryj śledzenie zadania",
    "Hide": "Ukryj",
    "Quest": "Zadanie",
    "You're there.": "Jesteś na miejscu.",
    "No quest followed. Open the Journal (J) to pick one.": "Nie śledzisz żadnego zadania. Otwórz Dziennik (J) i wybierz jedno.",
    "Back to the map": "Wróć do mapy",
    "Level": "Poziom",
    "Experience": "Doświadczenie",
    "Perk points to spend": "Punkty atutów do wydania",
    "Gold": "Złoto",
    "Carry weight": "Udźwig",
    "Journal": "Dziennik",
    "Items": "Przedmioty",
    "Skills": "Umiejętności",
    "Magic": "Magia",
    "Area": "Okolica",
    "Friends": "Znajomi",
    "Compass": "Kompas",
    "Menu": "Menu",
    "Party": "Drużyna",
    "You": "Ty",
    "Show them on the map": "Pokaż na mapie",
    "on the road": "w drodze",
    "in the wilds": "na pustkowiu",
    "away": "daleko",
    // Strangers and greetings
    "Stranger": "Nieznajomy",
    "level": "poziom",
    "Close": "Zamknij",
    "Greet": "Przywitaj się",
    "Accept": "Przyjmij",
    "Not now": "Nie teraz",
    "A stranger greets you": "Nieznajomy cię wita",
    "Greet them back and you'll both know each other's names.": "Odwzajemnij powitanie, a poznacie swoje imiona.",
    "You and {name} know each other now.": "Ty i {name} znacie się teraz.",
    "You already know each other.": "Już się znacie.",
    "Get to the same place to greet them.": "Musicie być w tym samym miejscu, żeby się przywitać.",
    "You greeted them. Waiting for an answer.": "Przywitałeś się. Czekasz na odpowiedź.",
    "You greet the stranger. Wait for them to answer.": "Witasz nieznajomego. Poczekaj na odpowiedź.",
    "In your party.": "W twojej drużynie.",
    "You know each other.": "Znacie się.",
    // patch note
    "The big map on PC": "Wielka mapa na komputerze",
    "On a PC or laptop the world map is now your home screen: it fills the whole window, and Items, Skills, Magic and the Journal open on top of it over a blurred map. On phones nothing changes.":
      "Na komputerze lub laptopie mapa świata jest teraz twoim ekranem głównym: wypełnia całe okno, a Przedmioty, Umiejętności, Magia i Dziennik otwierają się na niej, nad rozmytą mapą. Na telefonach nic się nie zmienia.",
    "Drag to look around, scroll to zoom smoothly from all of Skyrim down to a single village, and press Space to jump back to your hero. WASD and the arrows move the map too (while the compass is closed).":
      "Przeciągnij, żeby się rozejrzeć, przewiń kółkiem, żeby płynnie przybliżyć od całego Skyrim do jednej wioski, a Spacja wraca do twojego bohatera. WASD i strzałki też przesuwają mapę (gdy kompas jest zamknięty).",
    "Double-click a place to travel there. Click the town you're in to open its places in a panel on the side. Road events pop up as a card in the middle of the map.":
      "Kliknij dwa razy miejsce, żeby tam ruszyć. Kliknij miasto, w którym jesteś, a jego miejsca otworzą się w panelu z boku. Wydarzenia w drodze wyskakują jako karta na środku mapy.",
    "A slim bar along the bottom shows your level, experience, gold and weight, with buttons and keys for the menus: J Journal, I Items, K Skills, M Magic, Tab the compass. Your party sits in cards on the left.":
      "Wąski pasek na dole pokazuje poziom, doświadczenie, złoto i udźwig, z przyciskami i klawiszami do menu: J Dziennik, I Przedmioty, K Umiejętności, M Magia, Tab kompas. Twoja drużyna stoi w kartach po lewej.",
    "The quest you follow sits in the top right corner. Press Q (or the little arrow) and it slides away, leaving a small tab on the edge to bring it back.":
      "Śledzone zadanie jest w prawym górnym rogu. Naciśnij Q (albo małą strzałkę), a schowa się, zostawiając mały uchwyt na krawędzi, żeby je przywrócić.",
    "The map lives: each hold has its own weather, smoke rises from the chimneys of towns you've found, and clouds and birds drift over the land. Settings → Map quality (Low, Medium, High) sets how much of it you get.":
      "Mapa żyje: każde władztwo ma swoją pogodę, z kominów odkrytych miast unosi się dym, a nad ziemią płyną chmury i ptaki. Ustawienia → Jakość mapy (Niska, Średnia, Wysoka) decydują, ile tego widać.",
    "Your hero no longer stands on top of the town picture, and other players' names are never hidden behind town flags.":
      "Twój bohater nie zasłania już obrazka miasta, a imiona innych graczy nigdy nie chowają się za flagami miast.",
    "Everywhere, phones too: players outside your party are Strangers until you greet each other. Be in the same town or the same spot on the road, click their hero and press Greet. Once they accept, you both know each other's names for good.":
      "Wszędzie, także na telefonach: gracze spoza twojej drużyny są Nieznajomymi, dopóki się nie przywitacie. Bądźcie w tym samym mieście albo w tym samym miejscu na drodze, kliknij ich bohatera i naciśnij Przywitaj się. Gdy przyjmą, oboje na zawsze znacie swoje imiona.",
  });
})();
