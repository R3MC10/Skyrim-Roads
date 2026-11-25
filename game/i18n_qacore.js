/* i18n_qacore.js: Polish for the first minutes of play that still showed in English (core-loop QA sweep):
   the guided first trip (ui.js TUT, translated whole through I18N.t because its sentences hold <b> words),
   the first-time tips (onboard.js), the "set off" and "arrived" toasts, and the qa-core patch notes.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, lines with names in I18N_EXTRA.pat; whole sentences for
   I18N.t live in I18N_QACORE.tpl (ui.js adds them once I18N is up). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_QACORE = (() => {
  const TPL = {
    // the guided first trip
    "Your first trip": "Twoja pierwsza podróż", "On the road": "W drodze", "You've arrived": "Jesteś na miejscu", "Quests": "Zadania",
    "{n} of {m}": "{n} z {m}", "Skip the tutorial": "Pomiń samouczek",
    "Welcome to Skyrim, {name}. Everything happens in real time. Tap <b>Whiterun</b> on the map and press <b>Travel</b>, or press <b>Go</b> next to it in the list below.":
      "Witaj w Skyrim, {name}. Wszystko dzieje się na żywo. Dotknij <b>Whiterun</b> na mapie i naciśnij <b>Podróż</b> albo naciśnij <b>Idź</b> obok tej nazwy na liście poniżej.",
    "Welcome to Skyrim, {name}. You're in a party: the leader picks where to go and you travel with them. Watch the map; the next step starts when you set off.":
      "Witaj w Skyrim, {name}. Jesteś w drużynie: przywódca wybiera, dokąd iść, a ty podróżujesz z nim. Patrz na mapę; następny krok zacznie się, gdy wyruszycie.",
    "Your party comes along.": "Twoja drużyna idzie z tobą.",
    "You're walking. Trips keep going even when the app is closed, and something may happen by the road: if it's a fight, you play it turn by turn (or press Auto). You can ride a horse later, or take a carriage between cities.":
      "Idziesz. Podróż trwa, nawet gdy aplikacja jest zamknięta, a przy drodze może się coś wydarzyć: jeśli to walka, grasz ją turami (albo naciśnij Auto). Później możesz jeździć konno albo brać powóz między miastami.",
    "You're walking. Trips keep going even when the app is closed, and something may happen by the road. You can ride a horse later, or take a carriage between cities.":
      "Idziesz. Podróż trwa, nawet gdy aplikacja jest zamknięta, a przy drodze może się coś wydarzyć. Później możesz jeździć konno albo brać powóz między miastami.",
    "Open the <b>Area</b> tab. In towns and cities it has shops, the inn, trainers, the forge, jobs and more.":
      "Otwórz zakładkę <b>Okolica</b>. W miastach i miasteczkach są tam sklepy, karczma, trenerzy, kuźnia, zlecenia i więcej.",
    "Open the <b>Area</b> tab. This spot is out in the wilds, so it shows what you can do here.":
      "Otwórz zakładkę <b>Okolica</b>. To miejsce leży w dziczy, więc zakładka pokazuje, co możesz tu zrobić.",
    "Now open the <b>Journal</b>. Your quests are there, and the gold diamond on the map shows where to go next. Chat and other players are under <b>Social</b>.":
      "Teraz otwórz <b>Dziennik</b>. Są tam twoje zadania, a złoty romb na mapie pokazuje, dokąd iść dalej. Czat i inni gracze są w zakładce <b>Społeczność</b>.",
    // first-time tips (onboard.js)
    "The gold card under the map (<b>Your first trip</b>) shows you what to do, one step at a time. Tips like this one pop up the first time something new happens.":
      "Złota karta pod mapą (<b>Twoja pierwsza podróż</b>) pokazuje, co robić, krok po kroku. Takie wskazówki wyskakują, gdy pierwszy raz dzieje się coś nowego.",
    "Open <b>Hero</b>: pick Health, Magicka or Stamina, then spend your perk point on a skill you use. Skills rise by using them.":
      "Otwórz <b>Bohatera</b>: wybierz Zdrowie, Magię albo Wytrzymałość, potem wydaj punkt atutu na umiejętność, której używasz. Umiejętności rosną, gdy ich używasz.",
    "You're carrying more than you can, so you walk slowly. Sell loot in a town, keep things in a house chest, or let a horse or follower carry them.":
      "Niesiesz więcej, niż dasz radę, więc idziesz wolno. Sprzedaj łupy w mieście, zostaw rzeczy w skrzyni w domu albo daj je nieść koniowi lub towarzyszowi.",
    "Go room by room. Each room may hold foes, a trap or loot; you can leave between rooms and come back later. The boss and the best chest wait at the end.":
      "Idź komnata po komnacie. W każdej mogą być wrogowie, pułapka albo łupy; między komnatami możesz wyjść i wrócić później. Boss i najlepsza skrzynia czekają na końcu.",
    "Someone wants you in their party. Tap Accept on the card at the top to join, or Decline. The leader picks where to go and you travel together; gold is split evenly.":
      "Ktoś chce cię w swojej drużynie. Dotknij Akceptuj na karcie u góry, żeby dołączyć, albo Odrzuć. Przywódca wybiera, dokąd iść, a wy podróżujecie razem; złoto dzieli się po równo.",
    "Rumours are marked on your map and listed in the Journal → Misc. Go there to see if it's true: some are just gossip.":
      "Plotki są zaznaczone na mapie i wypisane w Dzienniku → Różne. Idź tam i sprawdź, czy to prawda: niektóre to tylko gadanie.",
  };
  Object.assign(I18N_EXTRA.words, {
    "Welcome to Skyrim": "Witaj w Skyrim", "Too heavy": "Za ciężko", "Your first dungeon": "Twój pierwszy loch", "A party invite": "Zaproszenie do drużyny",
    // patch note b239
    "Back button and first-trip fixes": "Poprawki przycisku Wstecz i pierwszej podróży",
    "Fixed: the phone's back button did nothing in fishing, hunting, mining, lockpicking and the other mini-games, and pressing it again could close the app. Now it leaves the game, like its Done or Leave button.":
      "Naprawione: przycisk Wstecz w telefonie nic nie robił w łowieniu ryb, polowaniu, kopaniu, otwieraniu zamków i innych minigrach, a kolejne naciśnięcie mogło zamknąć aplikację. Teraz wychodzi z gry, jak jej przycisk Gotowe albo Odejdź.",
    "Fixed: back in the barber's chair or at the rune table closes them instead of opening the compass behind them.":
      "Naprawione: Wstecz u fryzjera albo przy stole run zamyka je, zamiast otwierać kompas pod spodem.",
    "Fixed: back inside a shop, the inn or the forge goes to the town's list of places first, not straight to the compass.":
      "Naprawione: Wstecz w sklepie, karczmie albo kuźni wraca najpierw do listy miejsc w mieście, a nie od razu do kompasu.",
    "Fixed: the first-trip guide said to open the Town tab; it's called Area now.":
      "Naprawione: samouczek pierwszej podróży kazał otworzyć zakładkę Miasto; teraz nazywa się Okolica.",
    "Fixed: in Polish, the first-trip guide, the first-time tips and the \"you set off\" and \"you arrived\" messages were still in English.":
      "Naprawione: po polsku samouczek pierwszej podróży, wskazówki na start i komunikaty o wyruszeniu i dotarciu były jeszcze po angielsku.",
    "You've got a lead": "Masz trop", "Open Hero": "Otwórz Bohatera", "Got it": "Rozumiem", "Don't show tips": "Nie pokazuj wskazówek", "Close tip": "Zamknij wskazówkę",
    // tab tips (ui.js TAB_TIPS)
    "Start with the “What to do next” card. Press Go to travel; tap any place on the map to see how far it is.": "Zacznij od karty „Co dalej”. Naciśnij Idź, żeby ruszyć; dotknij dowolnego miejsca na mapie, żeby zobaczyć, jak daleko jest.",
    "Your level, skills and perks. A dot on this tab means you can level up or spend a perk point.": "Twój poziom, umiejętności i atuty. Kropka na tej zakładce znaczy, że możesz awansować albo wydać punkt atutu.",
    "Everything you carry. Tap an item to wear or use it; search by name at the top of the list.": "Wszystko, co niesiesz. Dotknij przedmiotu, żeby go założyć albo użyć; szukaj po nazwie na górze listy.",
    "Places in town are grouped: Shops, Services, Guilds & jobs. Each town has different ones; shops close at night.": "Miejsca w mieście są pogrupowane: Sklepy, Usługi, Gildie i zlecenia. Każde miasto ma inne; sklepy zamyka się na noc.",
    "Only your quests live here: Active, Misc and Completed. ☆ Track the one you're on and the compass and map follow it.": "Tu są tylko twoje zadania: Aktywne, Różne i Ukończone. ☆ Śledź to, które robisz, a kompas i mapa będą za nim iść.",
  });
  const T = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
  I18N_EXTRA.pat.push(
    [/^You set off (for|into) (.+)\. About (.+)\.$/, (m) => `Wyruszasz ${m[1] === "into" ? "w" : "do"} ${m[2]}. Około ${m[3]}.`],
    [/^Arrived at (.+?)\.( Shops are in the Area tab\.| You can go inside\.)?$/, (m) => `Docierasz do: ${m[1]}.${m[2] ? (/Shops/.test(m[2]) ? " Sklepy są w zakładce Okolica." : " Możesz wejść do środka.") : ""}`],
  );
  return { tpl: TPL, T };
})();
