/* i18n_menus2.js: Polish for the tidied tab menus (menus2.js) and menu words that were still English
   (item categories, sort row, follower tabs, item and spell buttons). Loaded after i18n_bonds.js and before i18n.js;
   adds to I18N_STORY.ex without overriding lines already translated. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // sort row
    "Sort": "Sortuj", "Armour": "Pancerz", "School": "Szkoła", "A–Z": "A–Z", "Z–A": "Z–A", "High first": "Od najwyższych", "Low first": "Od najniższych",
    "Sort direction: A–Z": "Kierunek sortowania: A–Z", "Sort direction: Z–A": "Kierunek sortowania: Z–A",
    "Sort direction: High first": "Kierunek sortowania: od najwyższych", "Sort direction: Low first": "Kierunek sortowania: od najniższych",
    "Dmg": "Obr.", "Stat": "Cecha", "Wt": "Waga", "Power": "Moc",
    // item and spell categories
    "Worn": "Noszone", "Apparel": "Odzież", "Scrolls": "Zwoje", "Food": "Jedzenie", "Ingredients": "Składniki", "Books": "Księgi",
    "Support": "Wsparcie", "All tiers": "Wszystkie poziomy", "Equipped": "Założone",
    // empty detail column, search boxes
    "Pick an item to see it here.": "Wybierz przedmiot, aby go tu zobaczyć.",
    "Pick a spell, power or shout to read it here.": "Wybierz zaklęcie, moc lub okrzyk, aby o nim przeczytać.",
    "Pick a skill to see what it does.": "Wybierz umiejętność, aby zobaczyć, co daje.",
    " Find an item by name": " Szukaj przedmiotu po nazwie", " Find a spell by name": " Szukaj zaklęcia po nazwie",
    "Find an item": "Szukaj przedmiotu", "Find a spell": "Szukaj zaklęcia", " Find a quest": " Szukaj zadania", "Find a quest": "Szukaj zadania",
    "No quest matches that.": "Żadne zadanie nie pasuje.",
    // item and spell buttons
    "Unequip": "Zdejmij", "Equip": "Załóż", "Take off": "Zdejmij", "Keep": "Zachowaj", "Favourite": "Ulubione", "List": "Lista",
    "Cast now": "Rzuć teraz", "Cleaner spell cards": "Czytelniejsze karty zaklęć", "Spell, power and shout cards in the Magic menu no longer have the \"Use first in every fight\" button. Set up what you cast in a fight in the Tactics tab instead; your current tactics stay as they are.": "Karty zaklęć, mocy i okrzyków w menu Magii nie mają już przycisku „Używaj na początku każdej walki”. To, czego używasz w walce, ustawiasz teraz w zakładce Taktyka; twoja obecna taktyka zostaje bez zmian.",
    // Character
    "Progress": "Postępy", "Level up": "Awans", "Dragon souls": "Smocze dusze",
    "Skills rise as you use them, with Skyrim's own rates.": "Umiejętności rosną, gdy ich używasz, w tempie jak w Skyrim.",
    "One perk point per level, like Skyrim. Pick a skill:": "Jeden punkt atutu na poziom, jak w Skyrim. Wybierz umiejętność:",
    // follower panel
    "Follower": "Towarzysz", "Overview": "Przegląd", "Gear": "Ekwipunek", "Fighting style": "Styl walki",
    "Their pack": "Ich plecak", "Give from yours": "Daj ze swojego", "Best gear": "Najlepszy sprzęt", "Dismiss": "Odpraw", "Give": "Daj",
    "★ = their natural style. Changing it resets and re-picks their perks.": "★ = naturalny styl. Zmiana resetuje i wybiera atuty od nowa.",
    // patch note
    "Tidier menus": "Porządniejsze menu",
    "Items and Magic work like SkyUI: categories on the left, the list in the middle and the picked thing on the right.": "Przedmioty i Magia działają jak SkyUI: kategorie po lewej, lista na środku, a wybrana rzecz po prawej.",
    "On a PC screen they sit side by side; on phones the list stays visible above the details.": "Na ekranie komputera stoją obok siebie; na telefonie lista zostaje widoczna nad szczegółami.",
    "One sort row: name, value, weight, damage, armour and more, plus a button that flips the order.": "Jeden pasek sortowania: nazwa, wartość, waga, obrażenia, pancerz i więcej, plus przycisk odwracający kolejność.",
    "Each category shows how many things are in it.": "Każda kategoria pokazuje, ile w niej rzeczy.",
    "Search your spells by name, and find quests in the Journal with the new search box.": "Szukaj zaklęć po nazwie i znajduj zadania w Dzienniku nowym polem wyszukiwania.",
    "The Character page is much shorter: your hero card comes first, and Powers, Skills and Perks fold away until you open them.": "Strona Postaci jest dużo krótsza: najpierw karta bohatera, a Moce, Umiejętności i Atuty są zwinięte, dopóki ich nie otworzysz.",
    "Follower tabs fit on one row, and lots of menu words are now in Polish.": "Zakładki towarzysza mieszczą się w jednym rzędzie, a wiele słów w menu jest teraz po polsku.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
})();
