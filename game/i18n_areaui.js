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
    // map panel
    "What to do next": "Co dalej", "Show less": "Pokaż mniej", "Towns": "Miasta", "Dungeons": "Lochy", "Not visited": "Nieodwiedzone", "Other": "Inne", "All": "Wszystko",
    "No places of this kind yet. Tap All to see every place.": "Na razie brak takich miejsc. Dotknij Wszystko, by zobaczyć wszystkie.",
    "Show places": "Pokaż miejsca", "Area": "Okolica", "Places in this town": "Miejsca w tym mieście",
    "Places are grouped like a town: Inn, Market, Services & trainers, Work & jobs, Your home, and Events & fun.": "Miejsca są ułożone jak w mieście: Karczma, Targ, Usługi i trenerzy, Praca i zlecenia, Twój dom oraz Wydarzenia i rozrywka.",
    "Tap one to open it; the ‹ button brings you back.": "Dotknij jednego, by je otworzyć; przycisk ‹ zabiera cię z powrotem.",
    "Things ready for you show on top under Right now.": "To, co na ciebie czeka, jest na górze w sekcji Teraz.",
    "Shops close at night (20:00–08:00).": "Sklepy są zamknięte w nocy (20:00–08:00).",
  };
  const PATS = [
    ["Room {0} gold", "Pokój: {0} złota"], ["{0} lessons left", "Lekcje: {0}"], ["{0} lesson left", "Lekcje: {0}"],
    ["{0} of 3 taken", "Wzięte: {0} z 3"], ["{0} to hand in", "Do oddania: {0}"], ["For sale · {0} gold", "Na sprzedaż · {0} złota"], ["Bounty {0} gold", "Nagroda: {0} złota"],
    ["Show {0} more", "Pokaż jeszcze {0}"], ["{0} ready", "Gotowe: {0}"], ["Back to all of {0}", "Wróć do: {0}"],
  ];
  // the Open tile status vs the Open button: the board's "Open" button text is a status word; keep the button as "Otwórz"
  delete PL.Open;
  for (const [k, v] of Object.entries(PL)) if (I18N_STORY.ex[k] == null) I18N_STORY.ex[k] = v;
  for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
})();
