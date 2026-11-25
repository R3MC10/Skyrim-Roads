/* i18n_expedition.js: Polish for the Expedition Table (expedition.js), its two perks and its patch note.
   Loaded before i18n.js. expedition.js hands I18N_EXPEDITION.tpl to I18N.add at load (templates with {n} and exact lines);
   the exact lines also go to I18N_EXTRA.words so the screen translator knows them. */
var I18N_EXPEDITION = (() => {
  const TPL = {
    // ---- the table
    "Expeditions": "Wyprawy",
    "The Expedition Table": "Stół wypraw",
    "Three expeditions a day for the company. New ones in {h} h {m} min. Missing a day costs nothing.": "Trzy wyprawy dziennie dla kompanii. Nowe za {h} godz. {m} min. Opuszczony dzień nic nie kosztuje.",
    "Tonight": "Dziś wieczorem", "History": "Historia", "Expedition history": "Historia wypraw",
    "Short": "Krótka", "Medium": "Średnia", "Long": "Długa",
    "about 15 minutes": "około 15 minut", "about 25 minutes": "około 25 minut", "40 minutes or more": "40 minut lub więcej",
    "You're on it": "W drodze", "Build the planning table to open this one.": "Zbuduj stół narad, żeby otworzyć tę wyprawę.",
    "Set out": "Wyrusz", "best from level {n}": "najlepiej od poziomu {n}", "gold": "złota", "+{n} renown": "+{n} sławy", "renown": "sławy",
    "Look around": "Rozejrzyj się", "Your leader looks around; you'll vote on what to do.": "Przywódca się rozgląda; zagłosujecie, co robić.",
    "Give it up": "Porzuć", "Giving up costs nothing.": "Porzucenie nic nie kosztuje.",
    "This week's goal": "Cel tygodnia",
    "You took this week's chest.": "Skrzynia z tego tygodnia już jest twoja.",
    "Goal reached! Everyone who went on an expedition this week takes the company chest once.": "Cel osiągnięty! Każdy, kto w tym tygodniu był na wyprawie, raz bierze skrzynię kompanii.",
    "Goal reached. Go on one expedition this week to share the chest.": "Cel osiągnięty. Wybierz się na jedną wyprawę w tym tygodniu, żeby dostać część skrzyni.",
    "Every finished expedition adds renown. Reach the goal and everyone who went out this week takes the company chest.": "Każda ukończona wyprawa dodaje sławy. Osiągnijcie cel, a każdy, kto w tym tygodniu wyruszył, weźmie skrzynię kompanii.",
    "Open the chest": "Otwórz skrzynię", "The company chest": "Skrzynia kompanii",
    "No expeditions yet. The first one goes in the book.": "Jeszcze żadnej wyprawy. Pierwsza trafi do księgi.",
    "{n} min ago": "{n} min temu", "{n} h ago": "{n} godz. temu", "{n} days ago": "{n} dni temu",
    "Your party is voting on tonight's expedition.": "Drużyna głosuje nad dzisiejszą wyprawą.",
    "In a party, the party votes. Most votes win; a tie goes the leader's way.": "W drużynie głosuje cała drużyna. Wygrywa większość; przy remisie decyduje przywódca.",
    "Put it to the party": "Poddaj pod głosowanie",
    "Ask for fresh offers ({n} left today)": "Poproś o nowe propozycje (dziś zostało: {n})",
    "goes well": "pójdzie dobrze", "goes badly": "pójdzie źle",
    "Pick tonight's expedition. Most votes win; a tie goes the leader's way.": "Wybierzcie dzisiejszą wyprawę. Wygrywa większość; przy remisie decyduje przywódca.",
    "Party vote": "Głosowanie drużyny", "Decide now": "Zdecyduj teraz", "Continue": "Dalej",
    "Seasoned Scout: you can tell how each choice will go.": "Doświadczony zwiadowca: wiesz, jak skończy się każdy wybór.",
    "Not tonight": "Nie dziś", "Tonight's expedition": "Dzisiejsza wyprawa", "Put to the party. Everyone votes.": "Poddane pod głosowanie. Każdy głosuje.",
    "The table is cleared and new letters come in.": "Stół zostaje uprzątnięty i przychodzą nowe listy.",
    // ---- going out, coming back
    "You set out: {title}": "Wyruszasz: {title}", "Your party sets out: {title}": "Twoja drużyna wyrusza: {title}",
    "You give up the expedition. No harm done.": "Porzucasz wyprawę. Nic się nie stało.",
    "You've done this one already.": "Tę wyprawę już masz za sobą.",
    "Expedition: step done. {next}": "Wyprawa: krok zrobiony. {next}", "All done!": "Wszystko zrobione!",
    "Expedition: {step} ({n}/{m})": "Wyprawa: {step} ({n}/{m})",
    "The party chose: not tonight.": "Drużyna wybrała: nie dziś.",
    "The party chose: {label} ({n} of {m} votes).": "Drużyna wybrała: {label} ({n} z {m} głosów).",
    "The party chose: {label}": "Drużyna wybrała: {label}",
    "Expedition done: {title}": "Wyprawa ukończona: {title}", "Expedition done: {title}. {g} gold.": "Wyprawa ukończona: {title}. {g} sztuk złota.",
    "You get {g} gold and {items}.": "Dostajesz {g} sztuk złota i: {items}.",
    "+{n} renown for the company.": "+{n} sławy dla kompanii.", "Join a company to earn renown toward its weekly chest.": "Dołącz do kompanii, żeby zdobywać sławę na jej cotygodniową skrzynię.",
    "{who} came back from {title}": "{who} wraca z wyprawy: {title}",
    "It goes well. You find {g} gold on the way.": "Idzie dobrze. Po drodze znajdujesz {g} sztuk złota.",
    "You also find: {item}.": "Znajdujesz też: {item}.",
    "It goes badly. You take some knocks, but you push on.": "Idzie źle. Obrywasz trochę, ale idziesz dalej.",
    "the beast": "bestię",
    // ---- the steps
    "Ride to {place} and see what's on the road": "Jedź do {place} i zobacz, co czeka na drodze",
    "Win {n} fights in {hold}": "Wygraj {n} walki w krainie {hold}",
    "Win {n} fights against bandits or other outlaws in {hold}": "Wygraj {n} walki z bandytami albo innymi wyjętymi spod prawa w krainie {hold}",
    "Win {n} fights against beasts in {hold}": "Wygraj {n} walki z bestiami w krainie {hold}",
    "Clear any dungeon in {hold}": "Oczyść dowolny loch w krainie {hold}",
    "Beat a boss in {hold}: a dungeon's master, a crisis ringleader or a legendary beast": "Pokonaj bossa w krainie {hold}: pana lochu, przywódcę kryzysu albo legendarną bestię",
    "Pull the heist on {house} in {city}": "Dokonaj skoku: {house} w {city}",
    "Find a sign of {beast}: take the Jarl's contract in {place} and look around": "Znajdź ślad: {beast}. Weź kontrakt jarla w {place} i rozejrzyj się",
    "Slay {beast}": "Zabij: {beast}",
    "Go down to the second level below a deadly dungeon, or beat a boss in {hold}": "Zejdź na drugi poziom pod śmiertelnym lochem albo pokonaj bossa w krainie {hold}",
    "Help {hold}: do a crisis contract there, or win {n} fights on its roads": "Pomóż krainie {hold}: wykonaj tam kontrakt kryzysowy albo wygraj {n} walki na jej drogach",
    // ---- the expeditions
    "The missing courier": "Zaginiony goniec",
    "A Jarl's courier never reached {town}. Find out what happened on the road.": "Goniec jarla nigdy nie dotarł do {town}. Dowiedz się, co stało się na drodze.",
    "A satchel in the snow": "Torba w śniegu",
    "Off the road near {town} lies a courier's satchel, torn open. Tracks lead three ways.": "Przy drodze koło {town} leży rozdarta torba gońca. Ślady prowadzą w trzy strony.",
    "Follow the light footprints": "Idź za lekkimi śladami stóp", "Ask at the nearest farm": "Wypytaj w najbliższym gospodarstwie", "Follow the blood on the snow": "Idź za krwią na śniegu",
    "Wolves of {hold}": "Wilki: {hold}",
    "A pack has been taking sheep and travellers around {town}. The farmers will pay to see it gone.": "Wataha porywa owce i podróżnych koło {town}. Rolnicy zapłacą, żeby jej się pozbyć.",
    "Howling at dusk": "Wycie o zmierzchu",
    "The light goes early near {town}. Eyes shine between the trees, and the howling closes in.": "Koło {town} szybko się ściemnia. Między drzewami błyszczą oczy, a wycie jest coraz bliżej.",
    "Light torches and hold them back": "Zapal pochodnie i trzymaj je z dala", "Shoot the pack leader": "Zastrzel przywódcę watahy", "Slip past downwind": "Przemknij się z wiatrem",
    "The buried relic": "Zakopana relikwia",
    "An old map from a {town} trader marks a relic somewhere under {hold}. Others are looking too.": "Stara mapa kupca z {town} wskazuje relikwię gdzieś pod krainą {hold}. Szukają jej też inni.",
    "The old map": "Stara mapa",
    "The trader's map is half rotted. Someone has been at the same cairn before you near {town}.": "Mapa kupca jest w połowie zbutwiała. Ktoś już był przy tym samym kopcu koło {town}.",
    "Read the old runes on the cairn": "Odczytaj stare runy na kopcu", "Dig where the stones are loose": "Kop tam, gdzie kamienie są luźne", "Buy the trader's last notes": "Kup ostatnie notatki kupca",
    "The frozen caravan": "Zamarznięta karawana",
    "A supply caravan for {town} is stuck in the drifts. {hold} needs those wagons.": "Karawana z zapasami dla {town} utknęła w zaspach. Kraina {hold} potrzebuje tych wozów.",
    "Wagons in the drifts": "Wozy w zaspach",
    "Three wagons sit in the snow outside {town}, the oxen cold and the drivers colder.": "Trzy wozy stoją w śniegu pod {town}. Woły zmarznięte, a woźnice jeszcze bardziej.",
    "Dig the wagons out": "Odkop wozy", "Thaw the axles with a spell": "Rozmróź osie zaklęciem", "Calm the drivers and organise them": "Uspokój woźniców i zorganizuj ich",
    "The outlaw chief": "Herszt banitów",
    "An outlaw chief has been taxing the roads of {hold}. Find their hideout and end it.": "Herszt banitów pobiera myto na drogach krainy {hold}. Znajdź kryjówkę i skończ z tym.",
    "The lookout": "Czujka",
    "A bandit lookout sits on a rock above the road to {town}, a horn on his belt.": "Bandycka czujka siedzi na skale nad drogą do {town}, z rogiem u pasa.",
    "Creep up and take him quietly": "Podkradnij się i załatw go po cichu", "Walk up and bluff your way past": "Podejdź i przejdź na blef", "Shoot the horn off his belt": "Zestrzel mu róg od pasa",
    "Hunt {beast}": "Polowanie: {beast}",
    "{beast} has been seen near {town}. The Jarl's steward has a contract for anyone who can bring it down.": "{beast} widziano koło {town}. Zarządca jarla ma kontrakt dla każdego, kto to powali.",
    "Talk in the tavern": "Rozmowy w karczmie",
    "Everyone in {town} has a story about {beast}. Most of them are lies.": "Każdy w {town} ma jakąś opowieść o tym stworze: {beast}. Większość to kłamstwa.",
    "Buy a round and listen": "Postaw kolejkę i słuchaj", "Read the signs on the old trail": "Odczytaj znaki na starym szlaku", "Ask the court wizard about it": "Zapytaj nadwornego maga",
    // ---- names used inside lines
    Sneak: "Skradanie się", Speechcraft: "Elokwencja", Archery: "Łucznictwo", Destruction: "Zniszczenie", Mysticism: "Mistycyzm", Athletics: "Atletyka", Etiquette: "Etykieta",
    Eastmarch: "Wschodnia Marchia", Haafingar: "Haafingar", Hjaalmarch: "Hjaalmarch", "The Pale": "Blada Rubież", "The Reach": "Pogranicze", "The Rift": "Rozpadlina",
    Whiterun: "Whiterun", Winterhold: "Winterhold", Falkreath: "Falkreath",
    "The Mudcrab King": "Król Błotnych Krabów", "The White Ghost, Sabre Cat": "Biały Duch, kot szablozębny", "Old Mother Briar, Spriggan": "Stara Matka Głóg, sprigganka",
    "Vyrthax the Spider Queen": "Vyrthax, Pajęcza Królowa", "Grimfang the Cave Bear": "Ponurokieł, niedźwiedź jaskiniowy", "Whitefang the Frost Troll": "Białokieł, mroźny troll",
    "Ashtusk the Mammoth": "Popielny Kieł, mamut", "The Pale Lady, Wispmother": "Blada Pani, matka błędnych ogników", "Grimscale the Chaurus Reaper": "Ponurołuski, chaurus żniwiarz",
    "Bloodmoon, Werewolf of Hircine": "Krwawy Księżyc, wilkołak Hircyna",
  };
  const words = {
    // perks (shown as they are)
    "Expedition Leader": "Przywódca wypraw", "Seasoned Scout": "Doświadczony zwiadowca",
    "The company listens when you plan: once a day (twice at rank 2) you can ask the Expedition Table for three fresh offers, for the whole company.":
      "Kompania słucha, gdy planujesz: raz dziennie (dwa razy na 2. randze) możesz poprosić Stół wypraw o trzy nowe propozycje dla całej kompanii.",
    "You read the road: an expedition's road event shows you how each choice will turn out, and its choices go 10% better for you.":
      "Czytasz drogę: zdarzenie na drodze podczas wyprawy pokazuje, jak skończy się każdy wybór, a twoje szanse w nim rosną o 10%.",
    // patch note
    "The Expedition Table: tonight's adventure": "Stół wypraw: dzisiejsza przygoda",
    "The company's planning table now lays out three expeditions every day: a short, a medium and a long one. Open Social, then Company, then Expeditions.":
      "Stół narad kompanii co dzień rozkłada trzy wyprawy: krótką, średnią i długą. Otwórz Społeczność, potem Kompania, potem Wyprawy.",
    "Everyone in the company sees the same three, and new ones come every day. Missing a day costs nothing.":
      "Każdy w kompanii widzi te same trzy, a nowe przychodzą codziennie. Opuszczony dzień nic nie kosztuje.",
    "Each one is a short chain of things already in the game: a road event on the way, then a dungeon, a legendary beast's trail, a heist or a hold in trouble, then a fight or a boss.":
      "Każda to krótki łańcuch rzeczy, które już są w grze: zdarzenie na drodze, potem loch, trop legendarnej bestii, skok albo kraina w kłopotach, a na koniec walka albo boss.",
    "In a party, everyone votes on which one to take and what to do on the road. Most votes win, a tie goes to the leader, and Not tonight is always a choice.":
      "W drużynie wszyscy głosują, którą wyprawę wybrać i co zrobić na drodze. Wygrywa większość, przy remisie decyduje przywódca, a Nie dziś zawsze jest do wyboru.",
    "Finish one and you get your own gold and loot, and the company gets renown. Reach the weekly goal and everyone who went out that week opens the company chest.":
      "Ukończ wyprawę, a dostaniesz własne złoto i łupy, a kompania zdobędzie sławę. Osiągnijcie cel tygodnia, a każdy, kto w tym tygodniu wyruszył, otworzy skrzynię kompanii.",
    "Without a planning table only the short expedition is open. Building it opens all three, and every level adds a bit of gold.":
      "Bez stołu narad otwarta jest tylko krótka wyprawa. Zbudowanie go otwiera wszystkie trzy, a każdy poziom dodaje trochę złota.",
    "New perks: Expedition Leader (Etiquette) lets you ask for fresh offers once or twice a day, and Seasoned Scout (Sneak) shows how each road event choice will turn out.":
      "Nowe atuty: Przywódca wypraw (Etykieta) pozwala raz lub dwa razy dziennie poprosić o nowe propozycje, a Doświadczony zwiadowca (Skradanie się) pokazuje, jak skończy się każdy wybór na drodze.",
  };
  for (const [k, v] of Object.entries(TPL)) if (!k.includes("{")) words[k] = words[k] || v;
  if (typeof I18N_EXTRA === "undefined") globalThis.I18N_EXTRA = { words: {}, pat: [] };
  for (const [k, v] of Object.entries(words)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  return { tpl: TPL, words };
})();
