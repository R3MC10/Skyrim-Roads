/* i18n_homestash.js: Polish for the house chest screen (homestash.js) and its messages (TOWNS.stash / unstash).
   Loaded after i18n_followertab.js and before i18n.js; adds to I18N_STORY without overriding lines already translated. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    "Chest": "Skrzynia", "Your pack": "Twój plecak", "Your load": "Twoje obciążenie", "In the chest": "W skrzyni",
    "All": "Wszystko", "Weapons": "Broń", "Apparel": "Ubiór", "Potions": "Mikstury", "Scrolls": "Zwoje", "Food": "Jedzenie", "Ingredients": "Składniki", "Books": "Księgi", "Misc": "Różne",
    "Sort": "Sortuj", "Name": "Nazwa", "Stat": "Cecha", "Weight": "Waga", "Value": "Wartość", "Wt": "Waga", "Dmg": "Obr.", "Armor": "Pancerz", "Power": "Moc",
    "A–Z": "A–Z", "Z–A": "Z–A", "High first": "Najwyższe najpierw", "Low first": "Najniższe najpierw",
    "Damage": "Obrażenia", "Count": "Liczba", "How many": "Ile",
    "Store": "Schowaj", "Take": "Weź", "Store 1": "Schowaj 1", "Take 1": "Weź 1",
    "Show to visitors": "Pokaż gościom", "Hide from visitors": "Ukryj przed gośćmi", "\uE18C In your display case.": "\uE18C W twojej gablocie.",
    "Pick something to move it.": "Wybierz coś, aby to przenieść.",
    "Nothing loose in your pack (worn gear stays on you).": "W plecaku nie ma nic luźnego (noszony ekwipunek zostaje na tobie).",
    "The chest is empty. Switch to Your pack to put things away.": "Skrzynia jest pusta. Przełącz na Twój plecak, aby coś schować.",
    "You're wearing that. Take it off first.": "Masz to na sobie. Najpierw to zdejmij.",
    "You don't have that many.": "Nie masz aż tylu.", "It's not in the chest.": "Tego nie ma w skrzyni.",
    // patch note b144
    "A proper chest in your house": "Porządna skrzynia w twoim domu",
    "Your house chest now works like a Skyrim chest: switch between the Chest and Your pack, filter by Weapons, Apparel, Potions, Scrolls, Food, Ingredients, Books and Misc, and sort by name, stat, weight or value.":
      "Skrzynia w domu działa teraz jak w Skyrim: przełączaj między Skrzynią a Twoim plecakiem, filtruj na Broń, Ubiór, Mikstury, Zwoje, Jedzenie, Składniki, Księgi i Różne, i sortuj po nazwie, cesze, wadze lub wartości.",
    "Every item in the chest and in your pack has its picture again.": "Każdy przedmiot w skrzyni i w plecaku znów ma swój obrazek.",
    "Tap something to move just 1, an amount you pick, or the whole stack, either way. Potions, ingredients, materials and arrows pile up into one stack in the chest.":
      "Dotknij czegoś, aby przenieść 1 sztukę, wybraną liczbę albo cały stos, w obie strony. Mikstury, składniki, materiały i strzały układają się w skrzyni w jeden stos.",
    "Your load and the chest's total weight are shown on top. Gear you wear (in any loadout) stays on you and can't be put away by mistake.":
      "Na górze widać twoje obciążenie i łączną wagę skrzyni. Noszony ekwipunek (w każdym zestawie) zostaje na tobie i nie da się go schować przez pomyłkę.",
    "Improved, named and stolen things keep all that when they go in and come back out.":
      "Ulepszone, nazwane i kradzione rzeczy zachowują to wszystko, gdy trafiają do skrzyni i z niej wracają.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  I18N_STORY.pats = I18N_STORY.pats || [];
  I18N_STORY.pats.push(
    ["Store all ({0})", "Schowaj wszystko ({0})"], ["Take all ({0})", "Weź wszystko ({0})"],
    ["{0} goes in the chest.", "{0} trafia do skrzyni."], ["You take {0}.", "Bierzesz: {0}."],
    ["Sort direction: {0}", "Kierunek sortowania: {0}"],
  );
})();
