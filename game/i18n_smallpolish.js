/* i18n_smallpolish.js: Polish for the small polish pass (title, chargen, Magic footer, map labels, Company tabs) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Magicka that comes back each fight round":
      "Magia, która wraca co rundę walki",
    "Your name, e.g. Remigiusz":
      "Twoje imię, np. Remigiusz",
    "Regen a round":
      "Odnowa na rundę",
    "Small polish":
      "Drobne szlify",
    "The title screen's emblem is now the game's own helm under the northern star, inked in gold. The \"Web version · looking for friends\" line moved into Settings.":
      "Godło na ekranie tytułowym to teraz hełm gry pod gwiazdą północy, narysowany złotem. Linijka „Wersja przeglądarkowa · szukam przyjaciół” przeniosła się do Ustawień.",
    "Creating a character on a phone: all the tabs fit or slide into view, the open tab stays in sight, and the bottom bar is slimmer so the race card isn't hidden.":
      "Tworzenie postaci na telefonie: wszystkie zakładki się mieszczą albo wsuwają, otwarta zakładka zostaje na widoku, a dolny pasek jest smuklejszy, więc karta rasy nie jest zasłonięta.",
    "Magic menu: all the tier buttons fit on a phone (Master included), and the bottom line shows your magicka and how much comes back each round instead of armor and damage.":
      "Menu magii: wszystkie przyciski poziomów mieszczą się na telefonie (z Mistrzem), a dolna linia pokazuje magię i ile wraca co rundę zamiast pancerza i obrażeń.",
    "Racial powers like Battle Cry get a proper medallion icon that matches the spells.":
      "Moce rasowe, jak Okrzyk bojowy, mają teraz porządny medalion pasujący do czarów.",
    "Map: labels like \"Rebuilding 97%\" and festival names find a free spot instead of sitting on a hold's or a town's name. On big PC screens the cards and the quest tracker beside the map are a bit larger.":
      "Mapa: napisy jak „Odbudowa 97%” i nazwy festynów szukają wolnego miejsca zamiast leżeć na nazwie krainy czy miasta. Na dużych ekranach PC karty i tropiciel zadań przy mapie są trochę większe.",
    "Company: Rooms, Expeditions, Treasury and Members on one row; Plan, Trophies and Log sit in a small More row under them.":
      "Kompania: Izby, Wyprawy, Skarbiec i Członkowie w jednym rzędzie; Plan, Trofea i Kronika są w małym rzędzie Więcej pod nimi.",
    "A new objective waits until you close menus and windows instead of popping up over them.":
      "Nowy cel czeka, aż zamkniesz menu i okna, zamiast wyskakiwać na nich.",
  });
})();
