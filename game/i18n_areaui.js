/* i18n_areaui.js: Polish for areaui.js (the Area tab's board of places) and mappanel.js (the Map panel's merged card
   and place filters). Loaded after i18n_story.js and before i18n.js; adds to I18N_STORY.ex / .pats (never replaces
   a line that's already translated), so the screen translator finds it. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // groups and the board
    "Inn": "Karczma", "Market": "Targ", "Services & trainers": "Usługi i trenerzy", "Work & jobs": "Praca i zlecenia", "Your home": "Twój dom", "Events & fun": "Wydarzenia i rozrywka",
    "Right now": "Teraz", "Open": "Otwórz", "More": "Więcej", "Back": "Wstecz",
    // tile names
    "General goods": "Sklep wielobranżowy", "Blacksmith": "Kowal", "Court wizard": "Nadworny czarodziej", "Market stalls": "Stragany", "Stables": "Stajnie", "Fence": "Paser",
    "Trainers": "Trenerzy", "Forge": "Kuźnia", "Alchemy lab": "Pracownia alchemiczna", "Arcane enchanter": "Stół zaklinacza", "Spell crafting": "Tworzenie zaklęć", "Carriage": "Powóz",
    "Jobs": "Zlecenia", "Jarl's bounty": "Nagrody jarla", "Caravans": "Karawany", "Mine": "Kopalnia", "Streets": "Ulice", "Neighbours": "Sąsiedzi", "Halls & shops": "Dwory i sklepy",
    "Hall of the North": "Dwór Północy", "Cooking pot": "Kocioł", "Hirelings": "Najemnicy", "Dragonsreach & hirelings": "Smocza Przystań i najemnicy", "The Arena": "Arena", "Fishing": "Łowienie ryb", "Docks": "Przystań",
    // tile lines
    "Sleep, rumours": "Sen, plotki", "Meals that buff": "Posiłki ze wzmocnieniem", "Fight beside you": "Walczy u twego boku", "Food, potions, kit": "Jedzenie, mikstury, sprzęt",
    "Weapons, armor, metal": "Broń, pancerze, metal", "Tomes, staffs, soul gems": "Księgi, kostury, klejnoty dusz", "Players' stalls": "Stragany graczy", "Horses and carts": "Konie i wozy",
    "Buys stolen goods": "Skupuje kradzione", "Raise a skill": "Podnieś umiejętność", "Make, smelt, improve": "Wykuj, przetop, ulepsz", "Brew potions": "Warz mikstury", "Enchant gear": "Zaklinaj sprzęt",
    "Your own spells": "Własne zaklęcia", "Safe, fast rides": "Bezpieczne, szybkie przejazdy", "Boats": "Łodzie", "Small paid work": "Drobna płatna robota", "This week's goals": "Cele na ten tydzień",
    "Guard for pay": "Ochrona za zapłatę", "Dig ore": "Kop rudę", "Pickpocket, bounty": "Kradzież, nagroda", "Your house": "Twój dom", "Build your own": "Zbuduj własny",
    "Players' houses": "Domy graczy", "Build a hall": "Zbuduj dwór", "Everyone builds it": "Budują go wszyscy", "Duel for a stake": "Pojedynek o stawkę", "Cast a line": "Zarzuć wędkę",
    "Open": "Otwarte", "Night prices": "Nocne ceny", "Closed till 08:00": "Zamknięte do 08:00", "You have a follower": "Masz towarzysza", "None left this level": "Brak lekcji na tym poziomie",
    "Garden ripe": "Ogród dojrzał", "Your horse": "Twój koń",
    // phone layout: shut places fold away; Social's More line
    "Closed": "Zamknięte", "Messages, trades, chat": "Wiadomości, wymiany, czat", "Sort by": "Sortuj według",
    // map panel
    "What to do next": "Co dalej", "Show less": "Pokaż mniej", "Towns": "Miasta", "Dungeons": "Lochy", "Not visited": "Nieodwiedzone", "Other": "Inne", "All": "Wszystko",
    "No places of this kind yet. Tap All to see every place.": "Na razie brak takich miejsc. Dotknij Wszystko, by zobaczyć wszystkie.",
    "Show places": "Pokaż miejsca", "Area": "Okolica", "Places in this town": "Miejsca w tym mieście",
    "Places are grouped like a town: Inn, Market, Services & trainers, Work & jobs, Your home, and Events & fun.": "Miejsca są ułożone jak w mieście: Karczma, Targ, Usługi i trenerzy, Praca i zlecenia, Twój dom oraz Wydarzenia i rozrywka.",
    "Tap one to open it; the ‹ button brings you back.": "Dotknij jednego, by je otworzyć; przycisk ‹ zabiera cię z powrotem.",
    "Things ready for you show on top under Right now.": "To, co na ciebie czeka, jest na górze w sekcji Teraz.",
    "Shops close at night (20:00–08:00).": "Sklepy są zamknięte w nocy (20:00–08:00).",
    // reminder rows (remind.js) that now sit in the merged "What to do next" card
    "ready now": "gotowe teraz", "On now": "Trwa teraz", "Starting soon": "Zaraz się zacznie", "You can level up": "Możesz awansować",
    "Pick Health, Magicka or Stamina.": "Wybierz Zdrowie, Magię lub Wytrzymałość.", "Open your perk trees.": "Otwórz drzewka perków.",
    "Claim it in the Journal.": "Odbierz w Dzienniku.", "Fills up again": "Znów się zapełnia", "New foes and new loot.": "Nowi wrogowie i nowe łupy.",
    "Have a look in  Friends.": "Zajrzyj do  Znajomi.", "The gold comes in on its own.": "Złoto wpływa samo.", "With a trade offer for you": "Z ofertą wymiany dla ciebie",
    "Horse rested": "Koń wypoczęty", "Caravan leaving": "Karawana odjeżdża", "Be in town or it goes without you.": "Bądź w mieście, bo odjedzie bez ciebie.",
    "Starting now. Every player can join in.": "Zaczyna się teraz. Każdy gracz może dołączyć.", "This lead goes cold in half an hour.": "Ten trop wystygnie za pół godziny.",
    "Cleared places full again": "Oczyszczone miejsca znów pełne", "Courier trades arriving": "Nadchodzą wymiany kurierem", "Garden and homestead goods": "Ogród i dobra z zagrody",
    "Rumour leads running out": "Tropy z plotek wygasają", "World events starting": "Zaczynają się wydarzenia", "Your hall can't pay its staff": "Twojego dworu nie stać na służbę",
    "Your hall's coffer is nearly empty": "Skarbiec twojego dworu jest prawie pusty", "under a minute": "niecała minuta",
    // patch note
    "Tidier towns and map": "Porządniejsze miasta i mapa",
    "The Area tab now opens on a board of small tiles, grouped like a real town: Inn, Market, Services & trainers, Work & jobs, Your home, and Events & fun.": "Zakładka Okolica otwiera się teraz na tablicy małych kafelków, ułożonych jak w prawdziwym mieście: Karczma, Targ, Usługi i trenerzy, Praca i zlecenia, Twój dom oraz Wydarzenia i rozrywka.",
    "Each tile says what's going on there (open or closed, room price, lessons left, jobs taken, garden ripe, your bounty).": "Każdy kafelek mówi, co się tam dzieje (otwarte czy zamknięte, cena pokoju, ile lekcji zostało, wzięte zlecenia, dojrzały ogród, twoja nagroda za głowę).",
    "Things waiting for you in town (a job to hand in, a ripe garden) sit on top under Right now.": "To, co czeka na ciebie w mieście (zlecenie do oddania, dojrzały ogród), jest na górze w sekcji Teraz.",
    "Tap a tile to go in.": "Dotknij kafelka, by wejść.",
    "A back button and a row of the neighbouring places (say, all the shops) keep everything one tap away.": "Przycisk powrotu i rząd sąsiednich miejsc (na przykład wszystkich sklepów) trzymają wszystko o jedno dotknięcie.",
    "Shops no longer dump their whole stock the moment you open the Area tab.": "Sklepy nie wysypują już całego towaru, gdy tylko otworzysz zakładkę Okolica.",
    "Long how-it-works notes fold up; tap More to read them.": "Długie opisy działania są zwinięte; dotknij Więcej, by je przeczytać.",
    "You can fold whole groups you never use, and they stay folded.": "Możesz zwinąć całe grupy, których nie używasz, i zostaną zwinięte.",
    "The Map side panel has one \"What to do next\" list instead of two: no more level-up or perk reminders shown twice.": "Panel boczny Mapy ma jedną listę „Co dalej” zamiast dwóch: przypomnienia o awansie i perkach nie pokazują się już podwójnie.",
    "The most urgent things come first, nearest places before far ones; tap Show more for the rest.": "Najpilniejsze sprawy są pierwsze, bliskie miejsca przed dalekimi; resztę pokaże Pokaż więcej.",
    "The place list has filters: All, Towns, Dungeons, Not visited and Other, each with a count.": "Lista miejsc ma filtry: Wszystko, Miasta, Lochy, Nieodwiedzone i Inne, każdy z liczbą.",
  };
  const PATS = [
    ["Room {0} gold", "Pokój: {0} złota"], ["{0} lessons left", "Lekcje: {0}"], ["{0} lesson left", "Lekcje: {0}"],
    ["{0} of 3 taken", "Wzięte: {0} z 3"], ["{0} to hand in", "Do oddania: {0}"], ["For sale · {0} gold", "Na sprzedaż · {0} złota"], ["Bounty {0} gold", "Nagroda: {0} złota"],
    ["{0} perk points to spend", "Punkty perków do wydania: {0}"], ["{0} perk point to spend", "Punkty perków do wydania: {0}"], ["ready {0} ago", "gotowe {0} temu"],
    ["{0} of {1} so far", "Na razie {0} z {1}"], ["{0} gold waiting on the board.", "{0} złota czeka na tablicy."], ["Stables in {0}", "Stajnie w {0}"],
    ["Show {0} more", "Pokaż jeszcze {0}"], ["{0} ready", "Gotowe: {0}"], ["Back to all of {0}", "Wróć do: {0}"],
  ];
  // the Open tile status vs the Open button: the board's "Open" button text is a status word; keep the button as "Otwórz"
  delete PL.Open;
  for (const [k, v] of Object.entries(PL)) if (I18N_STORY.ex[k] == null) I18N_STORY.ex[k] = v;
  for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
})();
