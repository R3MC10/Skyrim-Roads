/* i18n_longhouse.js: Polish for the adventuring company longhouse (longhouse.js), its three perks and its patch note.
   Loaded before i18n.js. longhouse.js hands I18N_LONGHOUSE.tpl to I18N.add at load (templates with {n} and exact lines);
   the exact lines also go to I18N_EXTRA.words so the screen translator knows them. */
var I18N_LONGHOUSE = (() => {
  const TPL = {
    // ---- errors and replies
    "More": "Więcej",
    "You're not in a company.": "Nie należysz do kompanii.",
    "The longhouse didn't answer. Try again.": "Długi dom nie odpowiada. Spróbuj jeszcze raz.",
    "You're already in a company.": "Już należysz do kompanii.",
    "Found it in a town or village: that's where the longhouse will stand.": "Załóż ją w mieście albo wiosce: tam stanie długi dom.",
    "Give your company a name (3 letters or more).": "Nazwij swoją kompanię (co najmniej 3 litery).",
    "Founding a longhouse costs {n} gold.": "Założenie długiego domu kosztuje {n} sztuk złota.",
    "You founded {name}, an adventuring company, in {place}.": "Założono kompanię poszukiwaczy przygód {name} w {place}.",
    "How much?": "Ile?",
    "You don't have that much gold.": "Nie masz tyle złota.",
    "Only the people the founder allows can take gold out.": "Złoto mogą wypłacać tylko ci, którym pozwala założyciel.",
    "The treasury doesn't have that much.": "W skarbcu nie ma aż tyle.",
    "You can take out {n} more gold today.": "Dziś możesz wypłacić jeszcze {n} sztuk złota.",
    "You don't have that many.": "Nie masz aż tylu.",
    "No such room.": "Nie ma takiej sali.",
    "Only the people the founder allows can build.": "Budować mogą tylko ci, którym pozwala założyciel.",
    "That room is finished.": "Ta sala jest już ukończona.",
    "The treasury needs {n} gold for that.": "Skarbiec potrzebuje na to {n} sztuk złota.",
    "The stockpile needs {n} {item}.": "W magazynie brakuje: {item} ×{n}.",
    "Only the people the founder allows can set the plan.": "Plan mogą ustalać tylko ci, którym pozwala założyciel.",
    "Build the planning table up first.": "Najpierw rozbuduj stół narad.",
    "Only the founder and officers can invite.": "Zapraszać mogą tylko założyciel i oficerowie.",
    "{name} is already one of you.": "{name} już jest jednym z was.",
    "A company holds up to {n} players.": "Kompania mieści do {n} graczy.",
    "Leave your company first.": "Najpierw opuść swoją kompanię.",
    "That invitation is gone.": "To zaproszenie już nie obowiązuje.",
    "Hand the company to someone else first (Members).": "Najpierw przekaż kompanię komuś innemu (Członkowie).",
    "Only the founder can do that.": "Tylko założyciel może to zrobić.",
    "No such member.": "Nie ma takiego członka.",
    "No such setting.": "Nie ma takiego ustawienia.",
    "A trophy for the longhouse: {name}": "Trofeum dla długiego domu: {name}",
    "The company library: you take in more ({n}% of the next level).": "Biblioteka kompanii: uczysz się więcej ({n}% następnego poziomu).",
    "Your longhouse is founded.": "Twój długi dom został założony.", "Company founded": "Kompania założona", "Gold put in.": "Złoto wpłacone.", "Gold taken out.": "Złoto wypłacone.",
    "Given to the stockpile.": "Oddano do magazynu.", "Built!": "Zbudowane!", "Plan set.": "Plan ustalony.", "Plan cleared.": "Plan odwołany.",
    "Invitation sent.": "Zaproszenie wysłane.", "Welcome to the company!": "Witaj w kompanii!", "You left the company.": "Opuszczono kompanię.", "Done.": "Gotowe.",
    "{who} invites you to the company {name} (Social → Company)": "{who} zaprasza cię do kompanii {name} (Społeczność → Kompania)",
    // ---- the log
    "{n} min ago": "{n} min temu", "{n} h ago": "{n} godz. temu", "{n} days ago": "{n} dni temu",
    "{who} put in {n} gold": "{who} wpłaca {n} sztuk złota", "{who} took out {n} gold": "{who} wypłaca {n} sztuk złota",
    "{who} gave {what}": "{who} oddaje: {what}", "{who} built {room} (level {n})": "{who} buduje: {room} (poziom {n})",
    "{who} brought home {name}": "{who} przynosi do domu: {name}", "{who} joined the company": "{who} dołącza do kompanii",
    "{who} left the company": "{who} opuszcza kompanię", "{who} founded the company": "{who} zakłada kompanię",
    "{who} set the plan: {name}": "{who} ustala plan: {name}", "{who} cleared the plan": "{who} odwołuje plan",
    "{who} sent {whom} away": "{who} odprawia: {whom}", "{who} made {whom} {role}": "{who} mianuje: {whom} ({role})",
    "Older gold and materials, added up ({n} gold)": "Starsze złoto i materiały, zsumowane ({n} sztuk złota)",
    // ---- the screen
    "Longhouse in {place}": "Długi dom w {place}", "{n} of {m} players": "{n} z {m} graczy", "gold in the treasury": "sztuk złota w skarbcu",
    "Not built yet.": "Jeszcze nie zbudowano.", "Next: level {n}": "Dalej: poziom {n}", gold: "sztuk złota", Upgrade: "Rozbuduj", Build: "Zbuduj", Finished: "Ukończone",
    "Your longhouse": "Twój długi dom", "Every room you build shows on the hall.": "Każdą zbudowaną salę widać na długim domu.",
    "Build the planning table to choose a battle plan for dungeons and hold crises.": "Zbuduj stół narad, by wybrać plan bitwy na lochy i kryzysy w krainach.",
    "The plan works for every member in dungeon fights and hold crisis fights.": "Plan działa dla każdego członka w walkach w lochach i w kryzysach krain.",
    "Planning table level {n}": "Stół narad, poziom {n}",
    "{n} of {m} places on the wall": "{n} z {m} miejsc na ścianie", "Build the trophy hall to hang them up.": "Zbuduj salę trofeów, by je powiesić.",
    "Beat a legendary beast or a big boss (dragons, dragon priests, dungeon masters) to bring one home.": "Pokonaj legendarną bestię albo wielkiego przeciwnika (smoki, smoczy kapłani, władcy lochów), by przynieść trofeum.",
    "+{n}% against {foe}": "+{n}% przeciw: {foe}", "No room on the wall": "Brak miejsca na ścianie", "No trophies yet.": "Jeszcze brak trofeów.",
    "you: {n}": "ty: {n}", All: "Wszystko", Gold: "Złoto", "Put in": "Wpłać", "Take out": "Wypłać", "You carry {n} gold.": "Masz przy sobie {n} sztuk złota.",
    "You can take out as much as you like.": "Możesz wypłacać, ile chcesz.", Stockpile: "Magazyn",
    "Rooms use materials from here. Give what you carry.": "Sale biorą materiały stąd. Oddaj, co masz przy sobie.",
    "(you)": "(ty)", "Make member": "Zrób członkiem", "Make officer": "Zrób oficerem", "Hand over": "Przekaż", "Send away": "Odpraw",
    Members: "Członkowie", Invited: "Zaproszeni", "Close the longhouse": "Zamknij długi dom", "Leave the company": "Opuść kompanię",
    "Invite your party and your friends from here. Add friends in Social → Friends.": "Stąd zaprosisz drużynę i przyjaciół. Przyjaciół dodasz w Społeczność → Przyjaciele.",
    Invite: "Zaproś", "Who may...": "Kto może...", "Take gold out": "Wypłacać złoto", "Build rooms": "Budować sale", "Set the plan": "Ustalać plan",
    "Invite players": "Zapraszać graczy", "Daily limit per member": "Dzienny limit na członka",
    "Adventuring company": "Kompania poszukiwaczy przygód", "A longhouse for you and your friends": "Długi dom dla ciebie i przyjaciół",
    Invitations: "Zaproszenia", "{who} invites you · {n} of {m} players": "{who} cię zaprasza · {n} z {m} graczy", Join: "Dołącz", "No thanks": "Nie, dziękuję",
    "Found a company with your party or your friends (up to 8 players). Share a treasury, then build a forge, a library, a trophy hall, stables and a planning table that help every member.":
      "Załóż kompanię z drużyną albo przyjaciółmi (do 8 graczy). Dzielcie skarbiec, a potem zbudujcie kuźnię, bibliotekę, salę trofeów, stajnie i stół narad, które pomagają każdemu członkowi.",
    "Found a longhouse": "Załóż długi dom", "Company name": "Nazwa kompanii", "Found it ({n} gold)": "Załóż ({n} sztuk złota)", "It will stand in {place}.": "Stanie w {place}.",
    "You're playing offline: the longhouse is shared once you go online.": "Grasz offline: długi dom będzie wspólny, gdy wejdziesz do sieci.",
    Company: "Kompania", Rooms: "Sale", Plan: "Plan", Trophies: "Trofea", Treasury: "Skarbiec", Log: "Dziennik", Expeditions: "Wyprawy",
    Founder: "Założyciel", Officer: "Oficer", Member: "Członek", "Founder only": "Tylko założyciel", "Founder and officers": "Założyciel i oficerowie", Everyone: "Wszyscy",
    // ---- rooms
    Forge: "Kuźnia", Library: "Biblioteka", "Trophy hall": "Sala trofeów", Stables: "Stajnie", "Planning table": "Stół narad",
    "Smithing XP +10%.": "Doświadczenie Kowalstwa +10%.",
    "Smithing XP +20%, and tempering goes one step further.": "Doświadczenie Kowalstwa +20%, a hartowanie idzie o stopień dalej.",
    "Smithing XP +30%, tempering one step further, and tempered weapons hit 5% harder.": "Doświadczenie Kowalstwa +30%, hartowanie o stopień dalej, a hartowana broń bije o 5% mocniej.",
    "Every skill book also gives a quarter of the next level. Rune table budget +3%.": "Każda księga umiejętności daje też ćwierć następnego poziomu. Budżet stołu run +3%.",
    "Skill books give half of the next level as well. Rune budget +6%, and the cheap and quick runes are open to you.": "Księgi umiejętności dają też połowę następnego poziomu. Budżet run +6%, a runy taniości i szybkości stoją przed tobą otworem.",
    "Skill books give three quarters of the next level as well. Rune budget +9%, and the rune and lingering forms are open too.": "Księgi umiejętności dają też trzy czwarte następnego poziomu. Budżet run +9%, a formy pułapki runicznej i trwania też są dostępne.",
    "4 trophies on the wall. Each one: +4% damage and 4% less damage taken against that kind of foe (legendary beasts 6%).": "4 trofea na ścianie. Każde: +4% obrażeń i 4% mniej otrzymanych obrażeń przeciw takim wrogom (legendarne bestie 6%).",
    "9 trophies on the wall, each one +4% against its kind of foe (legendary beasts 6%).": "9 trofeów na ścianie, każde +4% przeciw swojemu rodzajowi wrogów (legendarne bestie 6%).", "18 trophies on the wall: every one the company can earn, each +4% against its kind of foe (legendary beasts 6%).": "18 trofeów na ścianie: wszystkie, jakie kompania może zdobyć, każde +4% przeciw swojemu rodzajowi wrogów (legendarne bestie 6%).",
    "Your horse's bond grows 20% faster.": "Więź z koniem rośnie o 20% szybciej.", "Your horse's bond grows 40% faster.": "Więź z koniem rośnie o 40% szybciej.",
    "Your horse's bond grows 60% faster, and horses carry 25 more.": "Więź z koniem rośnie o 60% szybciej, a konie niosą o 25 więcej.",
    "Opens the Shield Wall and Spearhead plans.": "Otwiera plany Mur tarcz i Grot włóczni.", "Opens the Ambush and Supply Line plans.": "Otwiera plany Zasadzka i Linia zaopatrzenia.",
    "Opens the Kill the Leader plan.": "Otwiera plan Zabić przywódcę.",
    // ---- plans
    "Shield Wall": "Mur tarcz", "Spearhead": "Grot włóczni", Ambush: "Zasadzka", "Supply Line": "Linia zaopatrzenia", "Kill the Leader": "Zabić przywódcę",
    "Everyone takes 6% less damage.": "Wszyscy otrzymują o 6% mniej obrażeń.", "Everyone hits 6% harder.": "Wszyscy biją o 6% mocniej.",
    "The first blow of every fight hits 30% harder.": "Pierwszy cios każdej walki jest o 30% mocniejszy.", "Stamina comes back 25% faster.": "Wytrzymałość wraca o 25% szybciej.",
    "Against bosses and tough foes: hit 10% harder, take 8% less.": "Przeciw bossom i twardym wrogom: bijesz o 10% mocniej, dostajesz o 8% mniej.",
    // ---- trophies
    "Dragon skull": "Smocza czaszka", "Daedric horn": "Daedryczny róg", "Dwarven core": "Krasnoludzki rdzeń", "Falmer war-mask": "Bojowa maska Falmerów",
    "Draugr crown": "Korona draugra", "Giant's club": "Maczuga olbrzyma", "Beast pelt": "Skóra bestii", "Warlord's banner": "Sztandar watażki",
    dragons: "smoki", Daedra: "daedry", "Dwarven machines": "krasnoludzkie maszyny", "Falmer and chaurus": "Falmerzy i chaurusy", "the undead": "nieumarli",
    "giants and mammoths": "olbrzymy i mamuty", beasts: "bestie", "bandits and other people": "bandyci i inni ludzie",
  };
  const words = {
    // perks (shown as they are)
    "Company Purse": "Sakiewka kompanii", "War Council": "Rada wojenna", "Trophy Mounter": "Wieszacz trofeów",
    "You drive a hard bargain with builders: founding a longhouse and building its rooms cost 20% less when you pay.":
      "Twardo targujesz się z budowniczymi: założenie długiego domu i budowa sal kosztują o 20% mniej, gdy ty płacisz.",
    "You know how to read a plan aloud: the company's battle plan is 50% stronger for you.":
      "Umiesz odczytać plan na głos: plan bitwy kompanii działa na ciebie o 50% mocniej.",
    "You mount the company's trophies properly: their bonuses against each kind of foe count double for you.":
      "Porządnie wieszasz trofea kompanii: ich premie przeciw każdemu rodzajowi wrogów liczą się dla ciebie podwójnie.",
    // patch note
    "Your own adventuring company": "Twoja własna kompania poszukiwaczy przygód",
    "Found an adventuring company with your party or your friends: up to 8 players (followers don't count). Open Social, then Company.":
      "Załóż kompanię poszukiwaczy przygód z drużyną albo przyjaciółmi: do 8 graczy (towarzysze się nie liczą). Otwórz Społeczność, a potem Kompania.",
    "Founding costs 3000 gold in a town or village, and that's where your longhouse stands. Everyone in the company sees the same longhouse, live.":
      "Założenie kosztuje 3000 sztuk złota w mieście albo wiosce i tam stoi twój długi dom. Każdy w kompanii widzi ten sam długi dom, na żywo.",
    "A shared treasury: anyone can put gold in, and the founder chooses who may take it out and how much a day. Every coin and every gift is in the log.":
      "Wspólny skarbiec: każdy może wpłacać złoto, a założyciel wybiera, kto może je wypłacać i ile dziennie. Każda moneta i każdy dar trafia do dziennika.",
    "Build five rooms with gold from the treasury and materials from the stockpile, three levels each. Bigger companies pay a little more in total but much less each.":
      "Zbudujcie pięć sal za złoto ze skarbca i materiały z magazynu, każdą na trzy poziomy. Większe kompanie płacą trochę więcej w sumie, ale dużo mniej na osobę.",
    "Forge: more Smithing practice, better tempering and harder hits with tempered weapons. Library: every skill book teaches more, and it opens Rune table forms early.":
      "Kuźnia: więcej nauki Kowalstwa, lepsze hartowanie i mocniejsze ciosy hartowaną bronią. Biblioteka: każda księga umiejętności uczy więcej i wcześniej otwiera formy przy stole run.",
    "Trophy hall: beat legendary beasts and big bosses to hang their trophies up. Each one makes every member a bit stronger against that kind of foe.":
      "Sala trofeów: pokonujcie legendarne bestie i wielkich przeciwników, by wieszać ich trofea. Każde czyni każdego członka trochę silniejszym przeciw takim wrogom.",
    "Stables: your horse's bond grows faster, and at the top level horses carry more. Planning table: pick a battle plan that helps every member in dungeons and hold crises.":
      "Stajnie: więź z koniem rośnie szybciej, a na najwyższym poziomie konie niosą więcej. Stół narad: wybierzcie plan bitwy, który pomaga każdemu członkowi w lochach i kryzysach krain.",
    "New perks: Company Purse (Mercantile) makes founding and building cheaper, War Council (Etiquette) makes the battle plan stronger for you, and Trophy Mounter (Smithing) doubles your trophy bonuses.":
      "Nowe atuty: Sakiewka kompanii (Handel) obniża koszt założenia i budowy, Rada wojenna (Etykieta) wzmacnia dla ciebie plan bitwy, a Wieszacz trofeów (Kowalstwo) podwaja twoje premie z trofeów.",
  };
  for (const [k, v] of Object.entries(TPL)) if (!k.includes("{")) words[k] = words[k] || v;
  if (typeof I18N_EXTRA === "undefined") globalThis.I18N_EXTRA = { words: {}, pat: [] };
  for (const [k, v] of Object.entries(words)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  return { tpl: TPL, words };
})();
