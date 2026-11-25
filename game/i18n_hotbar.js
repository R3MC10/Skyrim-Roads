/* i18n_hotbar.js: Polish for hotbar.js (the fight's 10-slot hotbar, keys 1-0) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Edit hotbar": "Edytuj pasek",
    "Hotbar": "Pasek skrótów",
    "Hotbar slots": "Miejsca na pasku",
    "Weapons": "Broń",
    "Spells": "Czary",
    "Shouts": "Krzyki",
    "Items": "Przedmioty",
    "Abilities": "Umiejętności",
    "Clear slot": "Wyczyść",
    "Default": "Domyślny",
    "Done": "Gotowe",
    "Not known": "Nieznane",
    "Nothing here yet.": "Na razie nic tu nie ma.",
    "Pick a slot first": "Najpierw wybierz miejsce",
    "Tap a slot, then tap what goes in it. Tap two slots to swap them.": "Stuknij miejsce, potem to, co ma w nim być. Stuknij dwa miejsca, żeby je zamienić.",
    "Drag a move onto a slot. Drag slots to swap, or off the bar to clear. Or click a slot, then a move.": "Przeciągnij ruch na miejsce. Przeciągnij miejsca, żeby je zamienić, albo poza pasek, żeby wyczyścić. Albo kliknij miejsce, potem ruch.",
    "Set up your hotbar: which move sits on which number key.": "Ustaw pasek: który ruch jest pod którym klawiszem.",
    "Both hands": "Obie ręce",
    "Shout": "Krzyk",
    "Scroll": "Zwój",
    "Combo": "Kombinacja",
    "Get your breath back": "Złap oddech",
    "Once a day": "Raz dziennie",
    "Racial power": "Moc rasy",
    "Standing stone": "Kamień",
    // patch note (build 280)
    "Your own hotbar in fights": "Własny pasek skrótów w walce",
    "Your moves in a fight now sit on a hotbar of 10 slots, numbered 1 to 0. Put anything you like on it: blows, power attacks, guard, spells (your own rune spells too), shouts, potions, scrolls and abilities like Breathe or an oil flask.":
      "Twoje ruchy w walce są teraz na pasku z 10 miejscami, ponumerowanymi od 1 do 0. Wstaw tam, co chcesz: ciosy, potężne ataki, gardę, czary (także własne runiczne), krzyki, mikstury, zwoje i umiejętności jak Oddech czy flaszka oleju.",
    "To change it, pick Edit hotbar in the … menu or tap an empty slot. Tap a slot, then tap what goes in it; tap two slots to swap them. With a mouse you can also drag things on, between and off the bar.":
      "Żeby go zmienić, wybierz Edytuj pasek w menu … albo stuknij puste miejsce. Stuknij miejsce, potem to, co ma w nim być; stuknij dwa miejsca, żeby je zamienić. Myszką możesz też przeciągać rzeczy na pasek, między miejscami i poza pasek.",
    "Nobody starts empty: the bar fills itself from your hero until you change it, and Default puts that back. Each hero keeps their own bar, in the cloud too.":
      "Nikt nie zaczyna z pustym paskiem: dopóki go nie zmienisz, sam się wypełnia z twojego bohatera, a Domyślny przywraca to ustawienie. Każdy bohater ma własny pasek, także w chmurze.",
    "On a PC the number keys 1 to 0 use the slots. They do nothing while you type in chat or while a menu is open.":
      "Na komputerze klawisze od 1 do 0 używają miejsc na pasku. Nic nie robią, gdy piszesz na czacie albo gdy jest otwarte menu.",
    "A slot greys out when you can't use it and says why, and a potion slot shows how many you have left.":
      "Miejsce szarzeje, gdy nie możesz go użyć, i mówi dlaczego, a miejsce z miksturą pokazuje, ile ci zostało.",
    "Rest the mouse on a slot, or hold a finger on it, to see what the move will do before you use it.":
      "Najedź myszką na miejsce albo przytrzymaj na nim palec, żeby zobaczyć, co zrobi ruch, zanim go użyjesz.",
  });
})();
