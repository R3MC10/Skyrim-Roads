/* i18n_crises.js: Polish for regional crises (crises.js), its two perks, the Shield of the Hold title and its patch note.
   Loaded before i18n.js. crises.js hands I18N_CRISES.tpl to I18N.add at load (templates with {n} and exact lines);
   the exact lines also go to I18N_EXTRA.words so the screen translator knows them. */
var I18N_CRISES = (() => {
  const TPL = {
    // ---- the four numbers and their levels
    Security: "Bezpieczeństwo", Food: "Żywność", Prosperity: "Dobrobyt", Corruption: "Korupcja",
    Thriving: "Kwitnie", Steady: "Stabilnie", Strained: "Napięcie", Dire: "Fatalnie",
    "Hold status": "Stan krainy", "How it works": "Jak to działa", "All holds": "Wszystkie krainy", Close: "Zamknij",
    "Shops {n}% dearer": "Sklepy droższe o {n}%", "Shops {n}% cheaper": "Sklepy tańsze o {n}%", "Shops at normal prices": "Ceny w sklepach zwykłe",
    "road trouble +{n}%": "kłopoty na drogach +{n}%", "roads {n}% safer": "drogi bezpieczniejsze o {n}%", "roads as usual": "drogi jak zwykle",
    "No crisis in {hold} right now.": "W krainie {hold} nie ma teraz kryzysu.",
    // ---- crisis card
    Crisis: "Kryzys", "Crisis over": "Kryzys zażegnany", "Crisis burned out": "Kryzys wygasł", "Hold crisis": "Kryzys w krainie", Won: "Wygrany",
    "Stage {n} of {m}": "Etap {n} z {m}", Relief: "Pomoc", "{n} helper": "{n} pomocnik", "{n} helpers": "{n} pomocników",
    "Beaten by {who}. The hold is recovering.": "Pokonany przez: {who}. Kraina dochodzi do siebie.",
    "Nobody stopped it. The hold is licking its wounds.": "Nikt tego nie powstrzymał. Kraina liże rany.",
    "{boss}, {what}: the hideout is found. The fight is in {place}!": "{boss}, {what}: kryjówka odkryta. Walka w {place}!",
    "next stage in {time}": "następny etap za {time}", "burns out in {time}": "wygaśnie za {time}",
    "The Jarl hasn't asked for help yet. Contracts open at stage 2 (in {time}).": "Jarl jeszcze nie prosi o pomoc. Zlecenia pojawią się na 2. etapie (za {time}).",
    "The Jarl hasn't asked for help yet. Contracts open at stage 2.": "Jarl jeszcze nie prosi o pomoc. Zlecenia pojawią się na 2. etapie.",
    "Fight the ringleader": "Walcz z hersztem", "The Jarl's contracts": "Zlecenia jarla", "(deliveries: {n} of {m})": "(dostawy: {n} z {m})", "+{n} relief": "+{n} pomocy",
    "Deadly at your level: heroes under level 10 often lose this fight. Bring friends and potions, or add a Run away rule to your tactics.": "Na twoim poziomie to śmiertelnie groźna walka: bohaterowie poniżej 10. poziomu często ją przegrywają. Weź przyjaciół i mikstury albo dodaj do taktyki regułę ucieczki.",
    "A hard fight at your level. Bring potions, or add a Run away rule to your tactics.": "Na twoim poziomie to ciężka walka. Weź mikstury albo dodaj do taktyki regułę ucieczki.",
    "You break off the fight and get away. Try again when you're ready.": "Zrywasz walkę i uciekasz. Spróbuj znowu, gdy będziesz gotów.",
    "You break off the fight and get away from {boss}. Heal up and try again.": "Zrywasz walkę i uciekasz. {boss} zostaje w tyle. Wylecz się i spróbuj znowu.",
    "Contracts are handed out in {place}.": "Zlecenia rozdają w {place}.", "Travel to {place}": "Jedź do {place}",
    "In a party your leader takes the fight contracts; you fight beside them.": "W drużynie zlecenia z walką bierze przywódca, a ty walczysz u jego boku.",
    "Claim your reward": "Odbierz nagrodę", Claim: "Odbierz", Give: "Oddaj", Try: "Spróbuj", "Take it": "Biorę",
    "the ringleader is out!": "herszt się pokazał!", "{stage} ({n}/{m})": "{stage} ({n}/{m})", "Crisis won: reward waiting": "Kryzys wygrany: czeka nagroda",
    "{name} in {hold}: the ringleader is out!": "{name} w krainie {hold}: herszt się pokazał!",
    "{name} in {hold}: {stage} ({n}/{m})": "{name} w krainie {hold}: {stage} ({n}/{m})",
    "{name} in {hold} is over: your reward is waiting": "{name} w krainie {hold} się skończył: czeka twoja nagroda",
    "Ringleader!": "Herszt!", "Nothing to claim yet.": "Na razie nie ma czego odebrać.",
    "{name} beat {boss} and ended {crisis} in {hold}!": "{name} pokonuje: {boss} i kończy kryzys „{crisis}” w krainie {hold}!",
    "{name} grips {hold}: {what}": "{name} w krainie {hold}: {what}",
    "The Jarl of {hold} posts contracts against {name}.": "Jarl krainy {hold} wywiesza zlecenia: {name}.",
    "{d}d {h}h": "{d} d {h} h", "{h}h {m}m": "{h} h {m} min", "{n} min": "{n} min",
    // ---- contracts and the boss
    "This crisis is over. The hold is recovering.": "Ten kryzys już minął. Kraina dochodzi do siebie.",
    "There's no work posted for this right now.": "Na razie nie ma tu żadnych zleceń.",
    "The steward hands out contracts in {place}. Go there first.": "Zarządca rozdaje zlecenia w {place}. Najpierw tam idź.",
    "No such contract.": "Nie ma takiego zlecenia.",
    "The steward has all the food you can give for now. Thank you!": "Zarządca ma już od ciebie tyle jedzenia, ile może przyjąć. Dziękuje!",
    "You need {n} pieces of food (raw or cooked). You have {have}.": "Potrzebujesz {n} sztuk jedzenia (surowego lub gotowanego). Masz {have}.",
    "Rest a moment: the next one is ready in {n} s.": "Odpocznij chwilę: następne będzie gotowe za {n} s.",
    "In a party only your leader takes fight contracts. Stay close and you fight beside them.": "W drużynie zlecenia z walką bierze tylko przywódca. Trzymaj się blisko, a będziesz walczyć u jego boku.",
    "You're too badly hurt for this. Heal up first.": "Jesteś zbyt ranny. Najpierw się wylecz.",
    "That crisis is over.": "Ten kryzys już minął.",
    "The steward's clerk counts the food into the stores and pays you {g} gold for the trouble. (+{r} relief)": "Pisarz zarządcy wlicza jedzenie do zapasów i płaci ci {g} złota za fatygę. (+{r} pomocy)",
    "You find the ledger under a loose floorboard. Two guards are thrown in their own cells. (+{r} relief)": "Znajdujesz księgę pod luźną deską. Dwóch strażników ląduje we własnych celach. (+{r} pomocy)",
    "The guards close ranks and you leave with only rumours, but people noticed someone is asking. (+{r} relief)": "Strażnicy trzymają się razem i wychodzisz tylko z plotkami, ale ludzie zauważyli, że ktoś zadaje pytania. (+{r} pomocy)",
    "{what}: done. The steward pays {g} gold. (+{r} relief)": "{what}: zrobione. Zarządca płaci {g} złota. (+{r} pomocy)",
    "You're beaten. Someone else will have to finish the job.": "Przegrywasz. Ktoś inny będzie musiał to dokończyć.",
    "They got away this time. Try again in a moment.": "Tym razem uciekli. Spróbuj znowu za chwilę.",
    "{boss} is already beaten.": "{boss} jest już pokonany.",
    "The ringleader is still in hiding. Do contracts to draw them out.": "Herszt wciąż się ukrywa. Wykonuj zlecenia, żeby go wywabić.",
    "The fight is at {place}. Get there first.": "Walka jest w {place}. Najpierw tam dotrzyj.",
    "In a party only your leader starts the boss fight. Stay close and you fight beside them.": "W drużynie walkę z hersztem zaczyna tylko przywódca. Trzymaj się blisko, a będziesz walczyć u jego boku.",
    "Catch your breath: you can try again in {n} s.": "Złap oddech: spróbujesz znowu za {n} s.",
    "You're too badly hurt to face them. Heal up first.": "Jesteś zbyt ranny, by stanąć do walki. Najpierw się wylecz.",
    "{boss} falls! The crisis in {hold} is over and the Jarl's people cheer.": "{boss} pada! Kryzys w krainie {hold} się skończył, a ludzie jarla wiwatują.",
    Victory: "Zwycięstwo",
    "{boss} is too strong this time. Heal up and try again.": "{boss} jest tym razem za silny. Wylecz się i spróbuj znowu.",
    "{boss} slips away into the crowd. Try again in a moment.": "{boss} znika w tłumie. Spróbuj znowu za chwilę.",
    "{n} gold": "{n} złota", "the title Shield of the Hold": "tytuł Tarcza Krainy",
    "The Jarl of {hold} thanks you: {list}.": "Jarl krainy {hold} dziękuje ci: {list}.",
    // ---- the chains
    "The Long Winter": "Długa zima", "Outlaw Roads": "Drogi wyjętych spod prawa", "The Blight": "Zaraza", "Rot in the Court": "Zgnilizna na dworze", "Beasts at the Door": "Bestie u wrót",
    Snowstorm: "Śnieżyca", "Caravans cut": "Karawany odcięte", Shortage: "Niedobory", Bandits: "Bandyci", "The Jarl's call": "Wezwanie jarla",
    "Blizzards bury the passes around {hold}.": "Zamiecie zasypują przełęcze wokół krainy {hold}.",
    "No wagon has got through for days. The shelves are emptying.": "Od dni nie przejechał żaden wóz. Półki pustoszeją.",
    "Bread and firewood are scarce and prices climb.": "Brakuje chleba i drewna, a ceny rosną.",
    "Hungry outlaws prey on anyone who travels the snowbound roads.": "Głodni banici napadają każdego na zasypanych drogach.",
    "The Jarl pays for escorts and puts a price on the bandit chief.": "Jarl płaci za eskorty i wyznacza nagrodę za głowę hersztu bandytów.",
    Robberies: "Rabunki", "Roads unsafe": "Niebezpieczne drogi", "Trade dries up": "Handel zamiera", "Fort taken": "Fort zajęty", "The warlord": "Watażka",
    "Travellers in {hold} are being robbed on the roads.": "Podróżnych w krainie {hold} okradają na drogach.",
    "Farmers stay home. Nobody walks alone.": "Rolnicy siedzą w domach. Nikt nie chodzi sam.",
    "Merchants won't risk the roads. Prices go up.": "Kupcy nie ryzykują drogi. Ceny idą w górę.",
    "The outlaws have taken an old fort and raid from it.": "Banici zajęli stary fort i z niego napadają.",
    "A warlord leads them now. The Jarl wants his head.": "Prowadzi ich teraz watażka. Jarl chce jego głowy.",
    "Crop blight": "Zaraza zbóż", "Granaries low": "Puste spichlerze", Hunger: "Głód", "Food riots": "Zamieszki o chleb", Rationing: "Racjonowanie",
    "Black rot spreads through the fields of {hold}.": "Czarna zgnilizna rozlewa się po polach krainy {hold}.",
    "The stores are half empty before winter.": "Zapasy są w połowie puste jeszcze przed zimą.",
    "Families go hungry. Food costs a fortune.": "Rodziny głodują. Jedzenie kosztuje fortunę.",
    "Crowds storm the market. The guards are stretched thin.": "Tłumy szturmują targ. Straży brakuje rąk.",
    "The Jarl rations bread and hunts for whoever cursed the fields.": "Jarl racjonuje chleb i szuka tego, kto przeklął pola.",
    Bribes: "Łapówki", "Guards look away": "Straż odwraca wzrok", "Thieves rule the streets": "Złodzieje rządzą ulicami", "The steward's racket": "Przekręt zarządcy", Showdown: "Rozprawa",
    "Gold changes hands in the halls of {hold}.": "W salach krainy {hold} złoto przechodzi z rąk do rąk.",
    "Crimes go unpunished if the purse is heavy enough.": "Zbrodnie uchodzą płazem, jeśli sakiewka jest dość ciężka.",
    "Stalls are robbed in broad daylight.": "Stragany okrada się w biały dzień.",
    "The steward skims the taxes. Prices rise.": "Zarządca podbiera podatki. Ceny rosną.",
    "The Jarl finally asks for help to clean out the court.": "Jarl wreszcie prosi o pomoc w oczyszczeniu dworu.",
    Tracks: "Tropy", "Livestock lost": "Znika bydło", "Beasts in the fields": "Bestie na polach", "Attacks on travellers": "Ataki na podróżnych", "The alpha": "Przewodnik stada",
    "Huge tracks circle the farms of {hold}.": "Wielkie tropy krążą wokół gospodarstw krainy {hold}.",
    "Goats and cows vanish at night.": "Kozy i krowy znikają nocą.",
    "Wolves and trolls roam in daylight. Nobody tends the crops.": "Wilki i trolle krążą w biały dzień. Nikt nie dogląda upraw.",
    "The roads are deadly after dark.": "Po zmroku drogi są śmiertelnie groźne.",
    "The Jarl offers a bounty on the beast that leads them.": "Jarl wyznacza nagrodę za bestię, która je prowadzi.",
    "Snowbound bandits": "Bandyci ze śniegów", "Outlaw raiders": "Banici-łupieżcy", "Blighted spriggans": "Zarażone sprigganki", "Hired thugs": "Najemni zbiry", "Hungry wolves": "Głodne wilki",
    "the bandit chief of the passes": "herszt bandytów z przełęczy", "the outlaw warlord": "watażka banitów", "the hagraven who cursed the fields": "wiedźmokruk, który przeklął pola",
    "the bought captain of the guard": "przekupiony kapitan straży", "a monstrous frost troll": "potworny troll śnieżny",
    // ---- contracts
    "Escort the supply wagons": "Eskortuj wozy z zapasami", "Guard the Jarl's wagons to the next village and fight off whoever comes.": "Strzeż wozów jarla do następnej wioski i odeprzyj każdego, kto się pojawi.",
    "Clear out the {foe:lc}": "Rozpędź: {foe:lc}", "Find their camp and drive them off.": "Znajdź ich obóz i przepędź ich.",
    "Ride with the night patrol": "Jedź z nocnym patrolem", "Walk the roads with the hold guard after dark.": "Przemierz drogi ze strażą krainy po zmroku.",
    "Hunt the pack": "Zapoluj na stado", "Track the beasts back to their den.": "Wytrop bestie aż do ich legowiska.",
    "Deliver food": "Dostarcz jedzenie", "Bring the steward {n} pieces of food per delivery.": "Przynieś zarządcy {n} sztuki jedzenia na jedną dostawę.",
    "Expose a crooked guard": "Zdemaskuj skorumpowanego strażnika", "Talk your way into the barracks and find the ledger.": "Wgadaj się do koszar i znajdź księgę.",
    "Every hold has four numbers. Security falls when outlaws and beasts roam and rises when people escort caravans and beat bandits. Food falls with snow and blight and rises when people bring food. Prosperity follows trade. Corruption rises with bribes, theft and fenced goods. Low numbers make shops dearer and the roads more dangerous. When things get bad a crisis starts: it gets worse every 5 hours. From stage 2 the Jarl posts contracts; enough relief from everyone draws out the ringleader. Beat them and everyone who helped shares the reward. Left alone, a crisis burns out after 40 hours. Nothing here is required.":
      "Każda kraina ma cztery liczby. Bezpieczeństwo spada, gdy grasują banici i bestie, a rośnie, gdy ludzie eskortują karawany i biją bandytów. Żywność spada przez śnieg i zarazę, a rośnie, gdy ludzie przynoszą jedzenie. Dobrobyt idzie za handlem. Korupcja rośnie od łapówek, kradzieży i paserki. Niskie liczby to droższe sklepy i groźniejsze drogi. Gdy robi się źle, zaczyna się kryzys: co 5 godzin jest gorzej. Od 2. etapu jarl wywiesza zlecenia; dość pomocy od wszystkich wywabia herszta. Pokonaj go, a każdy, kto pomógł, dostaje część nagrody. Zostawiony sam sobie kryzys wygasa po 40 godzinach. Nic tu nie jest obowiązkowe.",
  };
  const words = {
    // perks and the title (shown as they are)
    "Hard Times Trader": "Kupiec na ciężkie czasy", "Jarl's Agent": "Agent jarla", "Shield of the Hold": "Tarcza Krainy",
    "When a hold runs short of food, trade or honesty, its shops raise their prices on you only half as much.": "Gdy krainie brakuje jedzenia, handlu albo uczciwości, jej sklepy podnoszą ci ceny tylko o połowę tego co innym.",
    "The Jarl trusts you: your contracts in a hold crisis count 25% more, exposing crooked guards is easier, and crisis rewards pay 25% more gold.": "Jarl ci ufa: twoje zlecenia w kryzysie liczą się o 25% bardziej, łatwiej zdemaskować skorumpowanych strażników, a nagrody za kryzysy dają o 25% więcej złota.",
    // patch note
    "Hard times in the holds": "Ciężkie czasy w krainach",
    "Every hold now has four numbers you can see: Security, Food, Prosperity and Corruption. They drift with time and the weather, and they follow what players do.":
      "Każda kraina ma teraz cztery liczby, które widać: Bezpieczeństwo, Żywność, Dobrobyt i Korupcję. Zmieniają się z czasem i pogodą i idą za tym, co robią gracze.",
    "Escorting caravans and beating bandits makes a hold safer, bringing food feeds it, and bribes, pickpocketing and selling stolen goods make it more crooked.":
      "Eskortowanie karawan i bicie bandytów czyni krainę bezpieczniejszą, przynoszenie jedzenia ją karmi, a łapówki, kieszonkostwo i sprzedawanie kradzionego ją psują.",
    "Low numbers make shops dearer (food most of all when food is short) and trouble finds you more often on that hold's roads. Good numbers do the opposite.":
      "Niskie liczby to droższe sklepy (najbardziej jedzenie, gdy go brakuje) i częstsze kłopoty na drogach tej krainy. Dobre liczby działają odwrotnie.",
    "When a hold is under pressure, a crisis starts: The Long Winter, Outlaw Roads, The Blight, Rot in the Court or Beasts at the Door. Each gets worse in five stages, for example snowstorm, caravans cut, shortage, bandits, then the Jarl's call.":
      "Gdy kraina jest pod presją, zaczyna się kryzys: Długa zima, Drogi wyjętych spod prawa, Zaraza, Zgnilizna na dworze albo Bestie u wrót. Każdy pogarsza się w pięciu etapach, na przykład śnieżyca, odcięte karawany, niedobory, bandyci, a potem wezwanie jarla.",
    "From stage 2 the Jarl posts contracts in the hold's capital: escort the supply wagons, clear out bandits, hunt the pack, deliver food or expose a crooked guard. Enough help from everyone draws out the ringleader for a boss fight.":
      "Od 2. etapu jarl wywiesza zlecenia w stolicy krainy: eskorta wozów, rozpędzenie bandytów, polowanie na stado, dostarczenie jedzenia albo zdemaskowanie skorumpowanego strażnika. Dość pomocy od wszystkich wywabia herszta do walki.",
    "Beat the ringleader and the hold recovers with cheaper shops for a day. Everyone who helped can claim a reward, and the one who struck him down earns the title Shield of the Hold.":
      "Pokonaj herszta, a kraina odżyje i przez dzień sklepy będą tańsze. Każdy, kto pomógł, odbiera nagrodę, a ten, kto go powalił, dostaje tytuł Tarcza Krainy.",
    "Nothing is required: a crisis left alone burns out after 40 hours and leaves the hold poorer for a day. Everyone sees the same crises at the same time.":
      "Nic nie jest obowiązkowe: zostawiony kryzys wygasa po 40 godzinach, a kraina jest przez dzień biedniejsza. Wszyscy widzą te same kryzysy w tym samym czasie.",
    "See it on the map (a sign and five pips by the capital), in the notices under the world event card, and on every town page: tap Hold status for the full card.":
      "Widać to na mapie (znak i pięć kropek przy stolicy), w powiadomieniach pod kartą wydarzeń świata i na stronie każdego miasta: stuknij Stan krainy, żeby zobaczyć całą kartę.",
    "New perks: Hard Times Trader (Mercantile) halves crisis price rises, and Jarl's Agent (Etiquette) makes your contracts count more and pays more.":
      "Nowe atuty: Kupiec na ciężkie czasy (Handel) o połowę zmniejsza podwyżki cen w kryzysie, a Agent jarla (Etykieta) sprawia, że twoje zlecenia liczą się bardziej i płacą więcej.",
  };
  for (const [k, v] of Object.entries(TPL)) if (!k.includes("{")) words[k] = words[k] || v;
  if (typeof I18N_EXTRA === "undefined") globalThis.I18N_EXTRA = { words: {}, pat: [] };
  for (const [k, v] of Object.entries(words)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  return { tpl: TPL, words };
})();
