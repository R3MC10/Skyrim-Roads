/* i18n_chargen.js: Polish for character creation (chargen.js, appear.js, racefx.js), the barber and the mirror, Proud Heritage and the patch note. Loaded before i18n.js.
   The screen's own words live in I18N_CHARGEN (read by chargen.js), so short words like "Heavy" or "Normal" don't change other screens;
   "what:Word" entries are for words that mean different things (Short hair, Short height). The patch note and the perk go into I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
var I18N_CHARGEN = {
    "height:Short": "Niski", "hair:Short": "Krótkie", "beard:Short": "Krótka", "beard:Long": "Długa", "beard:Full": "Pełna", "beard:None": "Bez brody", "hair:Long": "Długie",
    "scar:None": "Bez blizny", "paint:None": "Bez barw", "tattoo:None": "Bez tatuażu", "build:Average": "Przeciętna", "height:Average": "Przeciętny", "brows:Normal": "Zwykłe",
    // the screen
    "Close-up": "Zbliżenie", "Create your character": "Stwórz postać", "Character creation": "Tworzenie postaci", "The barber": "Fryzjer", "Your mirror": "Twoje lustro",
    "A shared Skyrim you travel in real time. Walking from Whiterun to Windhelm takes about ten minutes, and the road is rarely empty.":
      "Wspólny Skyrim, po którym podróżujesz w prawdziwym czasie. Droga z Whiterun do Windhelm zajmuje około dziesięciu minut, a na szlaku rzadko bywa pusto.",
    "A new look for {g} gold. Your race, name and stone stay as they are.": "Nowy wygląd za {g} sztuk złota. Rasa, imię i kamień zostają bez zmian.",
    "Change your look for free. Your race, name and stone stay as they are.": "Zmień wygląd za darmo. Rasa, imię i kamień zostają bez zmian.",
    Race: "Rasa", Body: "Ciało", Head: "Głowa", Face: "Twarz", Hair: "Włosy", "Scars & Paint": "Blizny i barwy", Start: "Start",
    Previous: "Poprzedni", Next: "Dalej", Back: "Wstecz", Randomise: "Losuj", Undo: "Cofnij", Cancel: "Anuluj", Done: "Gotowe", "Done · {g} gold": "Gotowe · {g} zł",
    "Turn left": "Obróć w lewo", "Turn right": "Obróć w prawo", Pose: "Poza", Stand: "Stój", Walk: "Chód", Fight: "Walka", "Starting gear": "Ekwipunek startowy", "Your gear": "Twój ekwipunek",
    "Your character. Drag, or use the arrow keys, to turn; up and down zoom to the face.": "Twoja postać. Przeciągnij albo użyj strzałek, żeby ją obrócić; strzałki góra i dół przybliżają twarz.",
    Nameless: "Bezimienny", "In your starting gear": "W ekwipunku startowym",
    // race tab
    "Starting skills": "Umiejętności na start", "Racial power": "Moc rasowa", "Once a day.": "Raz dziennie.", "Born with": "Wrodzony dar",
    "Tall, fair-haired children of Skyrim, hardened by its cold and its wars.": "Wysokie, jasnowłose dzieci Skyrim, zahartowane przez mróz i wojny.",
    "Disciplined citizens of Cyrodiil: soldiers, diplomats and traders with an eye for coin.": "Zdyscyplinowani obywatele Cyrodiil: żołnierze, dyplomaci i kupcy z nosem do pieniędzy.",
    "Half-elven folk of High Rock with magic in their blood and a stubborn will.": "Półelfi lud z Wysokiej Skały z magią we krwi i upartą wolą.",
    "Desert warriors of Hammerfell, the most naturally gifted fighters in Tamriel.": "Pustynni wojownicy z Hammerfell, najbardziej utalentowani wojownicy Tamriel.",
    "Proud High Elves of the Summerset Isles, born to sorcery.": "Dumne Wysokie Elfy z Wysp Summerset, urodzone do czarów.",
    "Quick Wood Elves of Valenwood, the best archers alive.": "Zwinne Leśne Elfy z Valenwood, najlepsi łucznicy na świecie.",
    "Grey-skinned Dark Elves of Morrowind, fierce and fire-touched.": "Szarzy Mroczni Elfowie z Morrowind, zawzięci i naznaczeni ogniem.",
    "Mountain folk of Orsinium: unbreakable smiths and fighters.": "Górski lud z Orsinium: niezłomni kowale i wojownicy.",
    "Cat-folk of Elsweyr: clever, quick and at home in the dark.": "Koci lud z Elsweyr: sprytny, szybki i swojski w ciemności.",
    "Scaled folk of Black Marsh, blessed by the Hist trees.": "Łuskowaty lud z Czarnych Mokradeł, pobłogosławiony przez drzewa Hist.",
    // racial powers (powers.js)
    "The foe flees in terror for 8 turns. Bosses shake it off after 2, elite foes after 3.": "Wróg ucieka w przerażeniu przez 8 tur. Bossowie otrząsają się po 2, elitarni wrogowie po 3.",
    "People stop fighting for 8 turns.": "Ludzie przestają walczyć na 8 tur.",
    "Half damage from mages and dragons for 10 turns.": "Połowa obrażeń od magów i smoków przez 10 tur.",
    "Stamina regenerates ten times faster for 10 turns.": "Wytrzymałość odnawia się dziesięć razy szybciej przez 10 tur.",
    "Magicka regenerates 25 times faster for 10 turns.": "Magia odnawia się 25 razy szybciej przez 10 tur.",
    "A beast stops fighting you for 10 turns.": "Bestia przestaje z tobą walczyć na 10 tur.",
    "A cloak of fire burns the foe for 8 damage a turn for 10 turns.": "Płaszcz ognia pali wroga za 8 obrażeń na turę przez 10 tur.",
    "Double damage dealt and half damage taken for 10 turns.": "Podwójne zadawane obrażenia i o połowę mniejsze otrzymywane przez 10 tur.",
    "You fade into the dark: your next hit is a sneak attack.": "Znikasz w mroku: twój następny cios to atak z ukrycia.",
    "Health regenerates ten times faster for 10 turns.": "Zdrowie odnawia się dziesięć razy szybciej przez 10 tur.",
    // racial abilities (racefx.js)
    "Resist Frost": "Odporność na mróz", "Frost and cold-blooded foes hurt you half as much.": "Mróz i lodowi wrogowie ranią cię o połowę słabiej.",
    "Imperial Luck": "Cesarskie szczęście", "You find 15% more gold in dungeons.": "Znajdujesz o 15% więcej złota w lochach.",
    "Resist Magic": "Odporność na magię", "Mages and dragons hurt you 25% less.": "Magowie i smoki ranią cię o 25% słabiej.",
    "Resist Poison": "Odporność na truciznę", "Spiders, snakes, poisoners and other venomous foes hurt you half as much.": "Pająki, węże, truciciele i inni jadowici wrogowie ranią cię o połowę słabiej.",
    "Highborn Mind": "Umysł wysoko urodzonych", "50 extra magicka, and magicka comes back 10% faster.": "50 dodatkowej magii, a magia wraca o 10% szybciej.",
    "Resist Poison and Disease": "Odporność na truciznę i choroby", "Venomous foes hurt you half as much, and you shrug off half the vampire and werewolf curses.": "Jadowici wrogowie ranią cię o połowę słabiej, a połowę klątw wampira i wilkołaka strząsasz z siebie.",
    "Resist Fire": "Odporność na ogień", "Fire and burning foes hurt you half as much.": "Ogień i płonący wrogowie ranią cię o połowę słabiej.",
    "Orc Forge-Blood": "Orkowa krew kuźni", "Improving weapons and armor at a forge adds 1 more, and you hold your ground: 5% less damage from everything.": "Ulepszanie broni i pancerza w kuźni daje 1 więcej, a do tego twardo stoisz: o 5% mniej obrażeń od wszystkiego.",
    "Claws and Night Eyes": "Pazury i nocne oczy", "Bare-handed you fight with claws, and you hit 5% more often at night, in fog and in storms.": "Bez broni walczysz pazurami, a nocą, we mgle i w burzy trafiasz o 5% częściej.",
    "Hist-Blood": "Krew Hist", "You shrug off half the vampire and werewolf curses, and you travel 5% faster on the roads.": "Połowę klątw wampira i wilkołaka strząsasz z siebie, a po drogach podróżujesz o 5% szybciej.",
    // body / head / face / hair / marks
    Sex: "Płeć", Male: "Mężczyzna", Female: "Kobieta", Build: "Budowa", Height: "Wzrost", "Skin tone": "Odcień skóry", Scales: "Łuski", Fur: "Futro",
    Slim: "Szczupła", Lean: "Smukła", Average: "Przeciętna", Strong: "Silna", Heavy: "Masywna",
    Short: "Niski", "Below average": "Poniżej przeciętnej", Tall: "Wysoki", "Very tall": "Bardzo wysoki",
    "Face shape": "Kształt twarzy", Even: "Regularna", "Broad jaw": "Szeroka szczęka", Narrow: "Wąska", Square: "Kwadratowa",
    Age: "Wiek", Young: "Młody", Grown: "Dorosły", Weathered: "Ogorzały", Old: "Stary", "Eye colour": "Kolor oczu",
    Brows: "Brwi", Normal: "Zwykłe", Thin: "Cienkie", Arched: "Łukowate", Nose: "Nos", Straight: "Prosty", Hooked: "Haczykowaty", Broad: "Szeroki", Small: "Mały",
    Mouth: "Usta", Calm: "Spokojne", Smile: "Uśmiech", Stern: "Surowe", Frown: "Grymas",
    "Khajiit and Argonians have a muzzle or snout, so there's no nose or lips to change. Try Scars & Paint.": "Khajiici i Argonianie mają pysk, więc nie ma tu nosa ani ust do zmiany. Zajrzyj do Blizn i barw.",
    Long: "Długie", Braid: "Warkocz", Bun: "Kok", Ponytail: "Kucyk", Mohawk: "Irokez", Wild: "Rozczochrane", Shaved: "Krótko ścięte", Bald: "Łysy",
    Mane: "Grzywa", "Mane colour": "Kolor grzywy", "Hair colour": "Kolor włosów", "Fur only": "Samo futro", "Braided mane": "Grzywa w warkoczu", "Knotted mane": "Grzywa w węzeł",
    "Tied mane": "Związana grzywa", "Shorn mane": "Strzyżona grzywa", "Crest of fur": "Grzebień z futra",
    "Horns and frills": "Rogi i kryzy", "Frill colour": "Kolor kryz", Frills: "Kryzy", Horns: "Rogi", Crest: "Grzebień", Spikes: "Kolce", Smooth: "Gładka głowa",
    Beard: "Broda", None: "Brak", Stubble: "Zarost", Full: "Pełna", Braided: "Zapleciona", "Elves of this kind don't grow beards.": "Elfom tego rodu broda nie rośnie.",
    Scar: "Blizna", "Across the eye": "Przez oko", Cheek: "Policzek", "Split lip": "Rozcięta warga", Brow: "Brew", "Claw marks": "Ślady pazurów",
    Warpaint: "Barwy wojenne", "Band over the eyes": "Pas przez oczy", "Cheek stripes": "Pasy na policzku", "Dark jaw": "Ciemna szczęka", "Eye ring": "Obwódka oka", "Paint colour": "Kolor barw",
    Tattoo: "Tatuaż", "Forehead rune": "Runa na czole", "Cheek dots": "Kropki na policzku", "Chin lines": "Linie na brodzie", Spiral: "Spirala",
    // start tab
    "Good name: {n}.": "Dobre imię: {n}.", "Pick a nickname (at least 2 letters).": "Wybierz pseudonim (co najmniej 2 litery).",
    "Standing stone": "Kamień przeznaczenia", "A Guardian Stone's blessing: those skills improve 20% faster. You can change it later at the Guardian Stones.": "Błogosławieństwo Kamienia Strażnika: te umiejętności rosną o 20% szybciej. Możesz to później zmienić przy Kamieniach Strażnikach.",
    "The Warrior Stone": "Kamień Wojownika", "The Mage Stone": "Kamień Maga", "The Thief Stone": "Kamień Złodzieja",
    "Combat skills improve 20% faster.": "Umiejętności walki rosną o 20% szybciej.", "Magic skills improve 20% faster.": "Umiejętności magiczne rosną o 20% szybciej.", "Stealth skills improve 20% faster.": "Umiejętności skrytości rosną o 20% szybciej.",
    "No stone yet": "Na razie bez kamienia", "Choose one later on the road.": "Wybierzesz później, w drodze.",
    "Where you begin": "Gdzie zaczynasz", "You begin in Riverwood, a quiet village on the road south of Whiterun.": "Zaczynasz w Riverwood, spokojnej wiosce przy drodze na południe od Whiterun.",
    // barber and mirror
    "Barber and face-painter": "Fryzjer i malarz twarzy", "Change your hair, beard, face and warpaint. Your race and name stay.": "Zmień fryzurę, brodę, twarz i barwy wojenne. Rasa i imię zostają.",
    "Sit down": "Usiądź", "Change your look for free.": "Zmień wygląd za darmo.", "The barber wants {g} gold.": "Fryzjer chce {g} sztuk złota.",
    "The barber trims, braids and paints. You look like a new person ({g} gold).": "Fryzjer strzyże, zaplata i maluje. Wyglądasz jak nowo narodzony ({g} zł).",
};
(() => {
  Object.assign(I18N_EXTRA.words, {
    "You like what you see.": "Podoba ci się to, co widzisz.",
    // Proud Heritage (perkfx.js)
    "Proud Heritage": "Dumne dziedzictwo", "Your race's gifts (resistances, Imperial luck, Orc forge-blood...) are 25% stronger. [OURS]": "Dary twojej rasy (odporności, cesarskie szczęście, orkowa krew kuźni...) są o 25% silniejsze. [OURS]",
    "Your race's gifts (resistances, Imperial luck, Orc forge-blood...) are 25% stronger.": "Dary twojej rasy (odporności, cesarskie szczęście, orkowa krew kuźni...) są o 25% silniejsze.",
    // patch note (patchnotes.js)
    "Character creation, rebuilt": "Tworzenie postaci od nowa",
    "Making a character now works like Skyrim's race menu: a big live picture of your hero that breathes, walks and swings, which you can turn with a finger (or the arrow keys) and zoom in on the face.":
      "Tworzenie postaci działa teraz jak menu ras w Skyrim: duży, żywy obraz bohatera, który oddycha, chodzi i wymachuje bronią, a ty możesz go obracać palcem (albo strzałkami) i przybliżać twarz.",
    "Tabs for Race, Body, Head, Face, Hair, Scars & Paint and Start, with Back and Next, a dice button for a random look and Undo.":
      "Zakładki Rasa, Ciało, Głowa, Twarz, Włosy, Blizny i barwy oraz Start, z przyciskami Wstecz i Dalej, kostką do losowego wyglądu i Cofnij.",
    "Pick your sex, build, height, skin, face shape, eyes, brows, nose, mouth, age, hair, beard, Khajiit manes and Argonian horns and frills, scars, warpaint and tattoos.":
      "Wybierz płeć, budowę, wzrost, skórę, kształt twarzy, oczy, brwi, nos, usta, wiek, włosy, brodę, grzywę Khajiita i rogi oraz kryzy Argonianina, blizny, barwy wojenne i tatuaże.",
    "Every race now has a gift that really works: Nords shrug off frost, Dunmer fire, Bretons magic, Redguards and Bosmer poison, Imperials find more gold, Orcs are better at the forge, Khajiit see in the dark and Argonians and Bosmer resist curses.":
      "Każda rasa ma teraz dar, który naprawdę działa: Nordowie znoszą mróz, Dunmerowie ogień, Bretończycy magię, Redgardzi i Bosmerowie truciznę, Cesarscy znajdują więcej złota, Orkowie lepiej kują, Khajiici widzą w ciemności, a Argonianie i Bosmerowie opierają się klątwom.",
    "Fixed: fights with Blood and gore on could stop with an error, and some menus looked wrong on phones.": "Naprawione: walki z włączoną krwią mogły się zatrzymać z błędem, a niektóre menu źle wyglądały na telefonach.",
    "New Etiquette perk Proud Heritage makes your race's gift 25% stronger.": "Nowy atut Etykiety Dumne dziedzictwo wzmacnia dar twojej rasy o 25%.",
    "On the Start tab you can pick the Warrior, Mage or Thief Stone straight away.": "Na zakładce Start możesz od razu wybrać Kamień Wojownika, Maga albo Złodzieja.",
    "Everyone sees the face you made: in fights, on the map, in your party and as a Stranger on the road.": "Wszyscy widzą twarz, którą stworzysz: w walkach, na mapie, w drużynie i jako Nieznajomy na drodze.",
    "Already have a character? Nothing changes until you want it to: visit the barber at any inn (40 gold) or the mirror in your house (free).":
      "Masz już postać? Nic się nie zmienia, dopóki sam nie zechcesz: odwiedź fryzjera w dowolnej karczmie (40 zł) albo lustro w swoim domu (za darmo).",
  });
  I18N_EXTRA.pat.push(
    [/^"(.+)" is taken by half of Skyrim\. Pick your own nickname\.$/, (m) => `„${m[1]}” nosi pół Skyrim. Wybierz własny pseudonim.`],
  );
})();


// [chargenrig] patch note
Object.assign(I18N_EXTRA.words, {
  "Character creation shows your real fighter": "Tworzenie postaci pokazuje twojego prawdziwego wojownika",
  "Character creation now shows the same painted hero you fight with: armour, weapon and all. Stand, Walk and Fight show how you'll really look on the road and in battle.": "Tworzenie postaci pokazuje teraz tego samego malowanego bohatera, którym walczysz: ze zbroją, bronią i wszystkim. Stój, Idź i Walka pokazują, jak naprawdę wyglądasz na szlaku i w bitwie.",
  "Picking a race swaps the painted head (Dunmer, Khajiit and Argonian have their own) and skin colour; everything else you chose stays.": "Wybór rasy zmienia malowaną głowę (Dunmerowie, Khajiici i Argonianie mają własne) i kolor skóry; reszta twoich wyborów zostaje.",
  "Face zooms right in on your hero's head. On the Head, Face, Hair and Scars tabs a small close-up shows the details you pick.": "Twarz przybliża głowę bohatera. Na kartach Głowa, Twarz, Włosy oraz Blizny i barwy małe zbliżenie pokazuje wybrane szczegóły.",
  "The race card shows the painted bust of the race instead of the little drawn figure.": "Karta rasy pokazuje malowane popiersie rasy zamiast małej rysowanej postaci.",
});
// [/chargenrig]
