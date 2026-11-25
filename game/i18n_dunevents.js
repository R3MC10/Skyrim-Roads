/* i18n_dunevents.js: Polish for the mystery room events (dunevents.js) and their patch note.
   Loaded after i18n_story.js and before i18n.js. Exact lines go in I18N_EXTRA.words, choice buttons with a chance in
   I18N_EXTRA.pat (whole text), sentences with numbers or names in I18N_STORY.pats (one sentence, {0} translated on its own). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const LABEL = {
    "Pick the old lock": "Otwórz stary zamek", "Force it open": "Wyważ drzwi", "Climb over the rubble": "Wspinaj się po gruzie",
    "Squeeze through the gap": "Przeciśnij się przez szparę", "Tend his wounds": "Opatrz jego rany", "Talk to him": "Porozmawiaj z nim",
    "Sneak past": "Przemknij obok", "Set an ambush": "Urządź zasadzkę", "Purify it": "Oczyść to", "Just take it": "Po prostu weź",
    "Run across": "Przebiegnij", "Tread light": "Stąpaj lekko",
  };
  const BRINGS = {
    "a shortcut and what's stored behind it": "skrót i to, co leży za drzwiami", "a shortcut": "skrót",
    "you come out behind the next foe": "wychodzisz za plecami następnego wroga", "his thanks: gold and a potion": "jego wdzięczność: złoto i mikstura",
    "he knows a way past the next rooms": "zna drogę obok następnych komnat", "no fight": "bez walki", "you strike first": "uderzasz pierwszy",
    "a blessing for the rest of this dungeon": "błogosławieństwo do końca tych podziemi", "gold, maybe a curse": "złoto, może klątwa",
  };
  const SK = { Lockpicking: "Otwieranie zamków", "One-Handed": "Broń jednoręczna", "Two-Handed": "Broń dwuręczna", Athletics: "Atletyka", Sneak: "Skradanie się",
    Restoration: "Przywrócenie", Speechcraft: "Elokwencja", Alteration: "Przemiana", "Light Armor": "Lekki pancerz", Archery: "Łucznictwo", Luck: "Szczęście" };
  Object.assign(I18N_EXTRA.words, {
    // titles and plain choices
    "Sealed passage": "Zamknięte przejście", "Collapsed tunnel": "Zawalony tunel", "Wounded traveller": "Ranny podróżny", "Patrol": "Patrol",
    "Draugr patrol": "Patrol draugrów", "Cursed offering": "Przeklęta ofiara", "Unstable bridge": "Chwiejny most", "Blessed offering": "Błogosławiona ofiara",
    "Leave it": "Zostaw", "Leave him": "Zostaw go", "Take the long way round": "Idź dookoła", "Fight them": "Walcz z nimi", "Go round": "Obejdź",
    "Luck": "Szczęście",
    // room texts
    "An iron-bound door blocks a side passage.": "Okute żelazem drzwi zamykają boczne przejście.",
    "Cold air seeps under it: it leads deeper, past the next stretch of rooms.": "Spod nich ciągnie zimne powietrze: prowadzą głębiej, obok następnych komnat.",
    "Half the ceiling has come down.": "Połowa stropu runęła.",
    "Over the rubble, or through a narrow gap at the bottom, the tunnel runs on.": "Tunel biegnie dalej: górą po gruzie albo wąską szparą przy ziemi.",
    "A man sits against the wall, pressing a rag to a bloody side.": "Pod ścianą siedzi mężczyzna i przyciska szmatę do zakrwawionego boku.",
    "Please, they left me here.": "Proszę, zostawili mnie tutaj.",
    "On a stained altar lies a pile of coins and a silver cup, wrapped in a faint, sickly glow.": "Na poplamionym ołtarzu leży stos monet i srebrny kielich, otulone słabą, chorobliwą poświatą.",
    "A rope bridge sags over a dark drop.": "Nad ciemną przepaścią zwisa linowy most.",
    "Half its planks are missing, but on the far side the way runs on past the next rooms.": "Brakuje połowy desek, ale po drugiej stronie droga biegnie dalej, obok następnych komnat.",
    "It hasn't seen you yet.": "Jeszcze cię nie zauważył.",
    // results
    "You come out further in, past the next stretch of rooms.": "Wychodzisz głębiej, za następnymi komnatami.",
    "The lock gives with a dry click.": "Zamek ustępuje z suchym kliknięciem.",
    "A pick snaps and the lock jams with a clang that echoes down the halls.": "Wytrych pęka, a zamek zacina się ze szczękiem, który niesie się po korytarzach.",
    "Whatever is ahead knows you're coming.": "Cokolwiek czeka dalej, wie już, że idziesz.",
    "The hinges tear out of the stone.": "Zawiasy wyrywają się z kamienia.",
    "You give up and take the main way.": "Dajesz za wygraną i idziesz główną drogą.",
    "You scramble over the rubble.": "Gramolisz się po gruzie.",
    "The way over is shut.": "Droga górą jest zamknięta.",
    "You wriggle through and come out in the shadows, behind whatever lives here.": "Przeciskasz się i wychodzisz w cieniu, za plecami tego, co tu mieszka.",
    "Your next fight starts with you striking first.": "Następną walkę zaczynasz od własnego ciosu.",
    "You get stuck halfway, and something hears you struggling.": "Utykasz w połowie i coś słyszy, jak się szamoczesz.",
    "You clean and bind the wound.": "Oczyszczasz i opatrujesz ranę.",
    "When he calms down he just stares at the ceiling.": "Gdy się uspokaja, tylko gapi się w sufit.",
    "He tells you about a side passage the bandits used.": "Opowiada ci o bocznym przejściu, którego używali bandyci.",
    "He was the bait.": "To była przynęta.",
    "Something steps out of the dark behind you.": "Coś wychodzi z ciemności za tobą.",
    "You wait for it to turn and slip past along the wall.": "Czekasz, aż się odwróci, i przemykasz wzdłuż ściany.",
    "A pebble skitters under your boot.": "Spod buta wyskakuje kamyk.",
    "The patrol turns.": "Patrol się odwraca.",
    "You wait in the dark and hit it as it passes: it staggers, and you get the first move.": "Czekasz w ciemności i uderzasz, gdy przechodzi: zatacza się, a pierwszy ruch należy do ciebie.",
    "It spots you before you're ready.": "Zauważa cię, zanim jesteś gotów.",
    "You step out of the dark to meet the patrol.": "Wychodzisz z ciemności naprzeciw patrolu.",
    "The glow fades to a warm light.": "Poświata przechodzi w ciepłe światło.",
    "The glow sinks into your hands instead.": "Zamiast tego poświata wsiąka w twoje dłonie.",
    "Nothing happens.": "Nic się nie dzieje.", "Lucky.": "Szczęściarz.",
    "You sprint across as the planks crack behind you.": "Przebiegasz, a deski pękają za tobą.",
    "You take the main way.": "Idziesz główną drogą.",
    "You step only where the ropes hold.": "Stawiasz stopy tylko tam, gdzie liny trzymają.",
    "You crawl back and take the main way.": "Czołgasz się z powrotem i idziesz główną drogą.",
    "You take the long way round.": "Idziesz dookoła.", "It's slow and dusty, but nothing finds you.": "Długo i w kurzu, ale nic cię nie znajduje.",
    "You find a way round.": "Znajdujesz drogę naokoło.", "Slower, but you keep your feet dry and your bones whole.": "Wolniej, ale masz suche stopy i całe kości.",
    "You leave him to it and walk on.": "Zostawiasz go i idziesz dalej.", "His voice follows you a while.": "Jego głos jeszcze chwilę za tobą idzie.",
    // the perk
    "Odd things in Unknown rooms (sealed doors, patrols, rope bridges...) go 10% better for you.": "Dziwne rzeczy w Nieznanych komnatach (zamknięte drzwi, patrole, linowe mosty...) idą ci o 10% lepiej.",
    "Sneaking past a foe in a dungeon: you're noticed a third slower, the shadows are wider and you hear it turn sooner. Odd things in Unknown rooms (sealed doors, patrols, rope bridges...) go 10% better for you.":
      "Przemykanie obok wroga w lochu: zauważa cię o jedną trzecią wolniej, cienie są szersze i wcześniej słyszysz, że się odwraca. Dziwne rzeczy w Nieznanych komnatach (zamknięte drzwi, patrole, linowe mosty...) idą ci o 10% lepiej.",
    // patch note
    "Mystery rooms with real choices": "Tajemnicze komnaty z prawdziwymi wyborami",
    "Unknown rooms in dungeons can now hold six new things: a sealed passage, a collapsed tunnel, a wounded traveller, a patrol (draugr in barrows), a cursed offering and an unstable rope bridge.":
      "Nieznane komnaty w podziemiach mogą teraz skrywać sześć nowych rzeczy: zamknięte przejście, zawalony tunel, rannego podróżnego, patrol (w kurhanach draugrów), przeklętą ofiarę i chwiejny linowy most.",
    "Each choice shows the skill it uses and your chance, like \"Lockpicking · 62%\", and what it can bring: a shortcut past the next rooms (never past the boss), gold and loot, a blessing for the rest of the dungeon, or an ambush where the foe is staggered and you move first.":
      "Każdy wybór pokazuje umiejętność i twoją szansę, np. „Otwieranie zamków · 62%”, oraz co może dać: skrót obok następnych komnat (nigdy obok bossa), złoto i łupy, błogosławieństwo do końca podziemi albo zasadzkę, w której wróg się zatacza, a ty ruszasz pierwszy.",
    "Failing never leaves you stuck: you lose some health, the next foe hears you coming, or you end up in a fight on the way round. A curse fades when you leave.":
      "Porażka nigdy cię nie blokuje: tracisz trochę zdrowia, następny wróg słyszy, że idziesz, albo trafiasz na walkę po drodze. Klątwa znika, gdy wychodzisz.",
    "In a party the whole party votes, and the best of you at that skill makes the attempt. Everyone sees how it went.":
      "W drużynie głosuje cała drużyna, a próbę podejmuje ten, kto jest w tej umiejętności najlepszy. Wszyscy widzą, jak poszło.",
    "Patient Shadow (Sneak) now also makes these checks 10% easier.": "Cierpliwy cień (Skradanie się) ułatwia teraz też te próby o 10%.",
  });
  const LBL = Object.keys(LABEL).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  I18N_EXTRA.pat.push(
    [new RegExp(`^(${LBL}) \\((.+?) · (\\d+)%(?:, (.+?))?\\)(?: → (.+))?$`),
      (m) => `${LABEL[m[1]]} (${SK[m[2]] || m[2]} · ${m[3]}%${m[4] ? `, ${m[4]}` : ""})${m[5] ? ` → ${BRINGS[m[5]] || m[5]}` : ""}`],
  );
  if (typeof I18N_STORY === "undefined") return;
  I18N_STORY.pats.push(
    ["Torchlight ahead: a {0} on patrol, walking the same loop through the hall.", "Przed tobą światło pochodni: {0} na patrolu, krąży w kółko po sali."],
    ["{0} tries it.", "Próbuje {0}."],
    ["{0} {1}%: it works.", "{0} {1}%: udało się."],
    ["{0} {1}%: it doesn't.", "{0} {1}%: nie udało się."],
    ["Someone stored {0} gold behind the door.", "Ktoś schował za drzwiami {0} sztuk złota."],
    ["It comes out right by the last chamber's door, and you get a quiet moment to catch your breath (+{0} health).", "Wychodzi tuż przy drzwiach ostatniej komnaty, a ty masz chwilę spokoju, żeby złapać oddech (+{0} zdrowia)."],
    ["The door doesn't move; your shoulder does (−{0} health).", "Drzwi ani drgną; za to twój bark tak (−{0} zdrowia)."],
    ["Stones slide under your boots and you come down with them (−{0} health).", "Kamienie usuwają ci się spod butów i spadasz razem z nimi (−{0} zdrowia)."],
    ["On the way you find {0} gold.", "Po drodze znajdujesz {0} sztuk złota."],
    ["He presses {0} gold and a {1} into your hand.", "Wciska ci do ręki {0} sztuk złota i {1}."],
    ["He thrashes in a fever and catches you with his knife (−{0} health).", "Rzuca się w gorączce i trafia cię nożem (−{0} zdrowia)."],
    ["You take {0} gold, and feel stronger for it: +{1} max health while you're in here.", "Bierzesz {0} sztuk złota i czujesz się silniejszy: +{1} maks. zdrowia, póki tu jesteś."],
    ["Cursed: −{0} max health while you're in here.", "Klątwa: −{0} maks. zdrowia, póki tu jesteś."],
    ["You sweep up {0} gold.", "Zgarniasz {0} sztuk złota."],
    ["You sweep up {0} gold, and a chill runs up your arm.", "Zgarniasz {0} sztuk złota, a po ręce przebiega ci chłód."],
    ["A plank snaps and you hang by a rope until you can pull yourself back (−{0} health).", "Deska pęka, a ty wisisz na linie, aż zdołasz się podciągnąć (−{0} zdrowia)."],
    ["Your armour catches on a rope and the bridge bucks (−{0} health).", "Pancerz zaczepia o linę i most się szarpie (−{0} zdrowia)."],
    ["You catch the {0} off guard.", "Zaskakujesz: {0}."],
    ["The {0} was waiting for you.", "{0} czekał na ciebie."],
    ["The {0} falls.", "{0} pada."],
  );
})();
