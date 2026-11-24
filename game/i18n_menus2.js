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
    "🔍 Find an item by name": "🔍 Szukaj przedmiotu po nazwie", "🔍 Find a spell by name": "🔍 Szukaj zaklęcia po nazwie",
    "Find an item": "Szukaj przedmiotu", "Find a spell": "Szukaj zaklęcia", "🔍 Find a quest": "🔍 Szukaj zadania", "Find a quest": "Szukaj zadania",
    "No quest matches that.": "Żadne zadanie nie pasuje.",
    // item and spell buttons
    "Unequip": "Zdejmij", "Equip": "Załóż", "Take off": "Zdejmij", "Keep": "Zachowaj", "Favourite": "Ulubione", "List": "Lista",
    "Cast now": "Rzuć teraz", "Use first in every fight": "Używaj na początku każdej walki", "Remove from tactics": "Usuń z taktyki",
    // Character
    "Progress": "Postępy", "Level up": "Awans", "Dragon souls": "Smocze dusze",
    "Skills rise as you use them, with Skyrim's own rates.": "Umiejętności rosną, gdy ich używasz, w tempie jak w Skyrim.",
    "One perk point per level, like Skyrim. Pick a skill:": "Jeden punkt atutu na poziom, jak w Skyrim. Wybierz umiejętność:",
    // follower panel
    "Follower": "Towarzysz", "Overview": "Przegląd", "Gear": "Ekwipunek", "Fighting style": "Styl walki",
    "Their pack": "Ich plecak", "Give from yours": "Daj ze swojego", "Best gear": "Najlepszy sprzęt", "Dismiss": "Odpraw", "Give": "Daj",
    "★ = their natural style. Changing it resets and re-picks their perks.": "★ = naturalny styl. Zmiana resetuje i wybiera atuty od nowa.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
})();
