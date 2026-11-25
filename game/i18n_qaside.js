/* i18n_qaside.js: Polish for side-system lines the side-systems bug hunt (claude/qa-side-*) found still in English,
   plus its patch notes. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // patch note b238
    "Company fixes": "Poprawki w kompanii",
    "Fixed: tapping Found twice quickly could pay for the company twice.": "Naprawione: szybkie dwukrotne stuknięcie w Załóż mogło zapłacić za kompanię dwa razy.",
    "Fixed: tapping Put in twice quickly could put the same gold in the treasury twice and leave your purse below zero.": "Naprawione: szybkie dwukrotne stuknięcie we Wpłać mogło wpłacić to samo złoto dwa razy i zostawić twoją sakiewkę pod kreską.",
    "Fixed: tapping Give twice quickly could hand the same ingots to the stockpile twice.": "Naprawione: szybkie dwukrotne stuknięcie w Oddaj mogło oddać te same sztabki do magazynu dwa razy.",
    "Fixed: an app update no longer restarts the game while you're fishing, mining, hunting, at the forge or in any other mini-game, so you never lose a catch.": "Naprawione: aktualizacja aplikacji nie restartuje już gry w trakcie łowienia, kopania, polowania, kucia ani innej minigry, więc nie stracisz zdobyczy.",
    "Fixed: more of the Social, jobs and fishing screens are in Polish.": "Naprawione: więcej tekstów na ekranach Społeczność, zleceń i łowienia jest po polsku.",
    // patch note b240
    "More Polish in towns": "Więcej polskiego w miastach",
    "Fixed: in Polish, the cooking pot, the forge, the notice board's weekly goals, the Hall of the North, the streets, trainers and hirelings are translated.": "Naprawione: po polsku są już kocioł, kuźnia, tygodniowe cele z tablicy ogłoszeń, Hala Północy, ulice, trenerzy i najemnicy.",
    "Fixed: in Polish, the Social tabs, the bard's song lines and the time left on world events are translated.": "Naprawione: po polsku są już zakładki Społeczności, wersy pieśni barda i czas do końca wydarzeń świata.",
    // town board lines (batch 3)
    "Your house: a safe chest, a bed and a garden.": "Twój dom: bezpieczna skrzynia, łóżko i ogród.",
    "Visit other players' houses here.": "Tu odwiedzisz domy innych graczy.",
    "Land outside town: build your own house, stage by stage.": "Ziemia za miastem: zbuduj własny dom, etap po etapie.",
    "Duel other players for a stake.": "Pojedynkuj się z innymi graczami o stawkę.",
    "Only for someone the Jarl trusts (bring Farengar the Dragonstone)": "Tylko dla kogoś, komu ufa Jarl (przynieś Farengarowi Smoczy Kamień)",
    "For sale": "Na sprzedaż",
    // patch note b241
    "Cleaner perk texts": "Czystsze opisy atutów",
    "Fixed: a few perks (Duelist, Brute Force, Steady Hand, Disintegrate, Intimidation) showed a stray design note like [OURS] in the middle of their description.": "Naprawione: kilka atutów (Duelist, Brute Force, Steady Hand, Disintegrate, Intimidation) pokazywało w środku opisu zabłąkaną notatkę projektową, np. [OURS].",
    "Fixed: in Polish, the house, homestead and arena lines on the town board are translated.": "Naprawione: po polsku są już opisy domu, gospodarstwa i areny na tablicy miasta.",
    // social
    "Word on the road": "Wieści z gościńca",
    "Quiet, for now.": "Na razie cisza.",
    "Looking for other players…": "Szukam innych graczy…",
    "It can take up to a minute to find each other": "Znalezienie się nawzajem może potrwać do minuty",
    "The world": "Świat",
    "Tap a name to mute that player.": "Stuknij imię, aby wyciszyć tego gracza.",
    "Unmute all": "Przywróć wszystkich",
    "You travel alone. Invite someone from the list below.": "Podróżujesz sam. Zaproś kogoś z listy poniżej.",
    "Stop somewhere in the wilds first.": "Najpierw zatrzymaj się gdzieś w dziczy.",
    "Lie in ambush": "Zasadzka",
    "Hide here off the road (you must be standing in the wilds). You're hidden from the map.": "Ukryj się tu z dala od drogi (musisz stać w dziczy). Znikasz z mapy.",
    "Hidden by the road. The next traveller to pass close by gets a sneak attack.": "Ukryty przy drodze. Następny podróżny, który przejdzie blisko, dostanie atak z ukrycia.",
    "Bounties": "Nagrody za głowę",
    "Pay it to a guard in that hold's towns, or to a bounty hunter on the road.": "Zapłać strażnikowi w miastach tego władztwa albo łowcy nagród na drodze.",
    "Nobody rules it": "Nikt nim nie rządzi",
    "Holds": "Władztwa",
    "War points this week": "Punkty wojenne w tym tygodniu",
    // jobs
    "Your jobs": "Twoje zlecenia",
    "New jobs every in-game day (2 real hours). You can hold three at once. Clearing and delivery jobs pay out by themselves when done.": "Nowe zlecenia co dzień w grze (2 prawdziwe godziny). Możesz mieć trzy naraz. Zlecenia oczyszczenia i dostawy płacą same, gdy je skończysz.",
    // fishing
    "Cast a line and catch fish.": "Zarzuć wędkę i łów ryby.",
    // social intros
    "Your party, co-op invites and everyone travelling near you.": "Twoja drużyna, zaproszenia do wspólnej gry i wszyscy podróżujący w pobliżu.",
    "Talk to everyone online, and what's happening in the world.": "Rozmawiaj ze wszystkimi online i zobacz, co dzieje się w świecie.",
    "Who rules the holds for which side, and the leaderboard.": "Kto rządzi władztwami dla której strony oraz ranking.",
    "No one else online right now. Send friends the app and they appear here and on the map.": "Nikogo innego teraz nie ma online. Wyślij znajomym aplikację, a pojawią się tutaj i na mapie.",
    "No one else yet. Share this page and friends appear here and on the map.": "Na razie nikogo innego. Udostępnij tę stronę, a znajomi pojawią się tutaj i na mapie.",
  });
  // "Rare wares, one of each · 1h 42m left" (world event cards)
  const T = (x) => { if (typeof I18N === "undefined" || !x) return x; const r = I18N.tr(x); return r == null ? x : r; };
  const dur = (d) => d.replace(/(\d+)d (\d+)h/, "$1 d $2 godz.").replace(/(\d+)h (\d+)m/, "$1 godz. $2 min");
  I18N_EXTRA.pat.push([/^(.+) · (\d+d \d+h|\d+h \d+m|\d+ min) left$/, (m) => `${T(m[1])} · zostało ${dur(m[2])}`]);
  if (typeof I18N_STORY !== "undefined") {
    const EX = {
      "Clans fight for the nine holds each week.": "Klany co tydzień walczą o dziewięć władztw.",
      "Win fights, clear dungeons and fight dragons inside a hold to earn it points (Arena wins count for Eastmarch).": "Wygrywaj walki, oczyszczaj lochy i walcz ze smokami we władztwie, żeby zdobywać dla niego punkty (zwycięstwa na Arenie liczą się dla Wschodniej Marchii).",
      "Whoever leads when the week ends rules it all next week, and their members shop 10% cheaper there.": "Kto prowadzi na koniec tygodnia, rządzi nim przez cały następny tydzień, a jego członkowie kupują tam 10% taniej.",
      "One world for everyone with the app, shared straight between phones.": "Jeden świat dla wszystkich z aplikacją, dzielony prosto między telefonami.",
      "Only people online right now appear here.": "Widać tu tylko osoby, które są teraz online.",
      "To rob someone you must be in the same place.": "Żeby kogoś okraść, musisz być w tym samym miejscu.",
      "Soldiers of rival sides (level 20+) can attack each other anywhere in the same hold.": "Żołnierze wrogich stron (poziom 20+) mogą atakować się nawzajem w dowolnym miejscu tego samego władztwa.",
      "Fights use their gear and stats.": "Walki używają ich sprzętu i statystyk.",
      "Killing someone in a town is always seen; out in the wilds, sometimes.": "Zabójstwo w mieście zawsze ktoś widzi; w dziczy tylko czasem.",
    };
    for (const [k, v] of Object.entries(EX)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
    const PATS = [["{0}d {1}h left.", "Zostało {0} d {1} godz."], ["To bring a friend in, send them the app: {0}", "Żeby kogoś zaprosić, wyślij mu aplikację: {0}"]];
    for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
  }
  // ---- batch 2: town screens of the side systems (cooking pot, forge, notice board, hall, streets, trainers, hirelings, bard)
  Object.assign(I18N_EXTRA.words, {
    "Shops, the inn, trainers and jobs are in the Area tab.": "Sklepy, karczma, trenerzy i zlecenia są w zakładce Okolica.",
    "Make, smelt and improve gear.": "Wykuwaj, przetapiaj i ulepszaj sprzęt.",
    "Cook meals that heal and buff.": "Gotuj posiłki, które leczą i wzmacniają.",
    "This week's world goals and rewards.": "Cele świata na ten tydzień i nagrody.",
    "Pickpocket, check your bounty, talk to guards.": "Kieszonkostwo, twoja nagroda za głowę, rozmowa ze strażą.",
    "Hire a follower who fights beside you.": "Wynajmij towarzysza, który walczy u twego boku.",
    "Small paid jobs: clear, deliver, gather.": "Małe płatne zlecenia: oczyść, dostarcz, zbierz.",
    "A hall everyone builds together.": "Hala, którą wszyscy budują razem.",
    "Dig ore with a pickaxe.": "Kop rudę kilofem.",
    "The inn's cooking pot. Cooked meals give buffs for a while; a new meal replaces the last one's.": "Kocioł w karczmie. Ugotowane posiłki dają wzmocnienia na jakiś czas; nowy posiłek zastępuje poprzedni.",
    "General stores sell salt, vegetables and meat. Garlic and lavender grow in home gardens and are sold by alchemists.": "Sklepy wielobranżowe sprzedają sól, warzywa i mięso. Czosnek i lawenda rosną w przydomowych ogrodach, sprzedają je też alchemicy.",
    "Stamina and health come back faster": "Wytrzymałość i zdrowie wracają szybciej", "+20 stamina": "+20 wytrzymałości", "+20 health, heals faster": "+20 zdrowia, szybsze leczenie",
    "+30 stamina, recovers faster": "+30 wytrzymałości, szybsza regeneracja", "Carry 50 more": "Udźwig większy o 50", "Snow and blizzards slow you half as much": "Śnieg i zamiecie spowalniają cię o połowę mniej",
    "The same three goals hang in every town this week. Progress counts wherever you are.": "W tym tygodniu w każdym mieście wiszą te same trzy cele. Postęp liczy się, gdziekolwiek jesteś.",
    "Clear the roads": "Oczyść drogi", "Into the deep": "W głąb", "Dragon season": "Sezon na smoki", "The apothecary's order": "Zamówienie aptekarza", "Map the North": "Zbadaj Północ", "Honest work": "Uczciwa praca",
    "Win fights against bandits, beasts and worse": "Wygrywaj walki z bandytami, bestiami i gorszymi", "Clear dungeons to the last room": "Oczyszczaj lochy do ostatniej komnaty",
    "Slay dragons (town attacks count for everyone who fought)": "Zabijaj smoki (ataki na miasta liczą się każdemu, kto walczył)", "Brew potions at any alchemy lab": "Warz mikstury w dowolnej pracowni alchemicznej",
    "Arrive at places across Skyrim": "Docieraj do miejsc w całym Skyrim", "Finish jobs from town notice boards": "Kończ zlecenia z miejskich tablic ogłoszeń",
    "One hall for everyone in the world. Every gold coin and ingot anyone gives makes it bigger, and every size gives all players something.": "Jedna hala dla wszystkich na świecie. Każda moneta i sztabka, którą ktoś odda, powiększa ją, a każdy rozmiar daje coś wszystkim graczom.",
    "Rest by the fire": "Odpocznij przy ognisku", "Sleep in the hall": "Prześpij się w hali", "Free · full health": "Za darmo · pełne zdrowie",
    "Free · full health and Rested (+5%)": "Za darmo · pełne zdrowie i wypoczęcie (+5%)", "Free · full health and Well Rested (+10%)": "Za darmo · pełne zdrowie i pełne wypoczęcie (+10%)",
    "Give materials": "Oddaj materiały", "What the hall gives everyone": "Co hala daje wszystkim", "Trophy wall": "Ściana trofeów", "No names yet. Be the first.": "Jeszcze żadnych imion. Bądź pierwszy.",
    "A fire and a few tents. Rest by the fire to heal for free.": "Ognisko i kilka namiotów. Odpocznij przy ogniu, by wyleczyć się za darmo.",
    "Free beds that make you Rested (skills +5% faster for 40 minutes).": "Darmowe łóżka, po których jesteś wypoczęty (umiejętności +5% szybciej przez 40 minut).",
    "Training costs 10% less everywhere, and the shared chest opens.": "Szkolenie wszędzie kosztuje 10% mniej i otwiera się wspólna skrzynia.",
    "Beds make you Well Rested (+10%), and training costs 20% less.": "Łóżka dają pełne wypoczęcie (+10%), a szkolenie kosztuje 20% mniej.",
    "Everyone carries 25 more, and training costs 25% less.": "Każdy unosi o 25 więcej, a szkolenie kosztuje 25% mniej.",
    "Opens when the hall becomes a Mead Hall.": "Otworzy się, gdy hala stanie się Miodosytnią.",
    "Ingots, leather, firewood and the like count for more than their price. Blacksmiths sell them, mines and forts hide them.": "Sztabki, skóra, drewno na opał i podobne liczą się bardziej niż ich cena. Sprzedają je kowale, kryją je kopalnie i forty.",
    "Build your own hall here, or a guild hall for your clan. Staff are paid every in-game day.": "Zbuduj tu własną halę albo halę gildii dla swojego klanu. Obsłudze płaci się co dzień w grze.",
    "Your own hall: build a forge, a shrine, a trophy room, storage and a shop counter; decorate it; hire a shopkeeper, a steward and a guard.": "Własna hala: zbuduj kuźnię, kapliczkę, salę trofeów, magazyn i ladę sklepową; udekoruj ją; zatrudnij sklepikarza, zarządcę i strażnika.",
    "Crime has a price: Skyrim bounties are 25 gold for pickpocketing, 40 for assault and 1000 for murder, per hold. Guards stop you when you come into a town where you're wanted.": "Przestępstwo ma swoją cenę: w Skyrim nagroda za głowę to 25 złota za kradzież kieszonkową, 40 za napaść i 1000 za morderstwo, w każdym władztwie osobno. Straż zatrzyma cię, gdy wejdziesz do miasta, w którym jesteś poszukiwany.",
    "Chat with the locals": "Pogadaj z miejscowymi", "Free, but street talk is wrong more often than the innkeeper.": "Za darmo, ale uliczne plotki mylą się częściej niż karczmarz.",
    "Clean. For now.": "Czysto. Na razie.", "Stolen goods only sell to a fence: the Ragged Flagon in Riften, or anywhere with the Fence perk.": "Kradzione towary sprzeda się tylko paserowi: w Ragged Flagon w Riften albo wszędzie z atutem Paser.",
    "One follower at a time. They fight beside you, carry 100 for you and heal between fights. Badly hurt, they go down and get back up after the fight; they never die. Hirelings cost 500 gold.": "Jeden towarzysz naraz. Walczy u twego boku, niesie za ciebie 100 i leczy się między walkami. Ciężko ranny pada i wstaje po walce; nigdy nie ginie. Najemnicy kosztują 500 złota.",
  });
  I18N_EXTRA.pat.push(
    [/^(\d+ h \d+ min|\d+ min) left$/, (m) => `zostało ${m[1]}`],
    [/^Your bounty in (.+)$/, (m) => `Twoja nagroda za głowę w: ${m[1]}`],
    [/^(.+) · reward (\d+) gold \+ (\d+) (.+?)( · most: .+)?$/, (m) => `${T(m[1])} · nagroda ${m[2]} złota + ${m[3]} ${m[4]}${m[5] ? m[5].replace(" · most: ", " · najwięcej: ") : ""}`],
    [/^(.+) · (\d+) (?:health|zdrowia) · hits for ~(\d+)$/, (m) => `${T(m[1])} · ${m[2]} zdrowia · trafia za ~${m[3]}`],
    [/^([\d,]+)(?: of ([\d,]+))? given by (\d+) players? · you gave ([\d,]+)(?: \((\d+) earns the title Hall Builder\))?$/, (m) => `${m[1]}${m[2] ? ` z ${m[2]}` : ""} od graczy: ${m[3]} · twój wkład: ${m[4]}${m[5] ? ` (${m[5]} daje tytuł Budowniczy Hali)` : ""}`],
    [/^Make weapons, armor and jewellery from ingots, leather and gems\. Better metals need Smithing perks\. Smithing (\d+)\.$/, (m) => `Wykuwaj broń, pancerze i biżuterię ze sztabek, skóry i klejnotów. Lepsze metale wymagają atutów Kowalstwa. Kowalstwo ${m[1]}.`],
    [/^Skyrim rules: 5 sessions per level \((\d+) left\), and trainers stop at 50 \(common\), 75 \(expert\) or 90 \(master\)\.$/, (m) => `Zasady Skyrim: 5 lekcji na poziom (zostało ${m[1]}), a trenerzy uczą do 50 (zwykły), 75 (ekspert) lub 90 (mistrz).`],
    [/^(Stamina and health come back faster|\+20 stamina|\+20 health, heals faster|\+30 stamina, recovers faster|Carry 50 more|Snow and blizzards slow you half as much) · (.+)$/, (m) => `${T(m[1])} · ${m[2].replace(/any fish/g, "dowolna ryba")}`],
  );
  if (typeof I18N_STORY !== "undefined") {
    const PATS2 = [
      ["{0} walked the roads of the North and grew strong as the mountains.", "{0} przemierzał drogi Północy i stał się silny jak góry."],
      ["{0} took the long road north, with snow on the boots and a song in the heart.", "{0} ruszył długą drogą na północ, ze śniegiem na butach i pieśnią w sercu."],
      ["Pick one of your deeds, or write your own line (up to {0} letters).", "Wybierz jeden ze swoich czynów albo napisz własny wers (do {0} liter)."],
    ];
    for (const p of PATS2) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
    const EX2 = { "Players who like it can cheer for it; the best lines become next week's song.": "Gracze, którym się spodoba, mogą go wiwatować; najlepsze wersy staną się pieśnią przyszłego tygodnia." };
    Object.assign(EX2, {
      "You can hold three at once.": "Możesz mieć trzy naraz.", "Clearing and delivery jobs pay out by themselves when done.": "Zlecenia oczyszczenia i dostawy płacą same, gdy je skończysz.",
      "One hall for everyone in the world.": "Jedna hala dla wszystkich na świecie.",
      "Every gold coin and ingot anyone gives makes it bigger, and every size gives all players something.": "Każda moneta i sztabka, którą ktoś odda, powiększa ją, a każdy rozmiar daje coś wszystkim graczom.",
      "Crime has a price: Skyrim bounties are 25 gold for pickpocketing, 40 for assault and 1000 for murder, per hold.": "Przestępstwo ma swoją cenę: w Skyrim nagroda za głowę to 25 złota za kradzież kieszonkową, 40 za napaść i 1000 za morderstwo, w każdym władztwie osobno.",
      "Guards stop you when you come into a town where you're wanted.": "Straż zatrzyma cię, gdy wejdziesz do miasta, w którym jesteś poszukiwany.",
      "One follower at a time.": "Jeden towarzysz naraz.",
      "They fight beside you, carry 100 for you and heal between fights.": "Walczą u twego boku, niosą za ciebie 100 i leczą się między walkami.",
      "Badly hurt, they go down and get back up after the fight; they never die.": "Ciężko ranni padają i wstają po walce; nigdy nie giną.",
      "Hirelings cost 500 gold.": "Najemnicy kosztują 500 złota.",
      "Wants the Dragonstone from Bleak Falls Barrow.": "Chce Smoczego Kamienia z Bleak Falls Barrow.", "The Jarl rewards whoever brings it.": "Jarl nagrodzi tego, kto go przyniesie.",
    });
    for (const [k, v] of Object.entries(EX2)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  }
})();
