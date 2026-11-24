/* i18n_fishhunt.js: Polish for the fishing and hunting mini-games (fishing.js, huntgame.js), their buttons in the Area tab
   and the wilds, and the patch note. Item and perk names stay in English like everywhere else in the game.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, number patterns in I18N_EXTRA.pat, sentences with names in I18N_STORY.pats. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // ---- fishing
    "Fishing": "Wędkowanie", "🎣 Fishing": "🎣 Wędkowanie", "🎣 Go fishing": "🎣 Na ryby", "A river": "Rzeka", "A lake": "Jezioro", "The Sea of Ghosts": "Morze Duchów", "night": "noc",
    "Cast": "Zarzuć", "Hook!": "Zatnij!", "Reel (hold)": "Zwijaj (przytrzymaj)", "Cast again": "Zarzuć znowu", "Done": "Gotowe", "Cast a line": "Zarzuć wędkę",
    "Tap (or press Space) when the power bar is high for a long cast.": "Stuknij (albo wciśnij Spację), gdy pasek siły jest wysoko, żeby zarzucić daleko.",
    "Wait for the float to go right under, then tap. Twitches are only nibbles.": "Poczekaj, aż spławik całkiem zniknie pod wodą, i wtedy stuknij. Drgnięcia to tylko skubanie.",
    "Hold to reel, let go to ease off. Keep the needle in the pale band: too tight snaps the line, too slack lets it go.":
      "Przytrzymaj, żeby zwijać, puść, żeby popuścić. Trzymaj wskazówkę w jasnym pasku: za mocno i żyłka pęknie, za luźno i ryba ucieknie.",
    "A long cast, out over the deep water.": "Daleki rzut, aż nad głęboką wodę.", "A short cast, close to the bank.": "Krótki rzut, blisko brzegu.", "You cast your line.": "Zarzucasz wędkę.",
    "It's heavy! Something rare is on the line.": "Ciężka! Na haczyku jest coś rzadkiego.", "Hooked! Reel it in.": "Zacięta! Zwijaj.",
    "Too soon. The splash scares it off.": "Za wcześnie. Plusk ją spłoszył.", "Too slow. It stole your bait.": "Za wolno. Ukradła ci przynętę.",
    "Snap! The line breaks.": "Trzask! Żyłka pękła.", "Too tight: the line parts with a crack.": "Za mocno: żyłka puszcza z trzaskiem.",
    "The line goes slack. It threw the hook.": "Żyłka luzuje. Ryba zrzuciła haczyk.", "A flick of the tail and it's gone.": "Machnięcie ogonem i już jej nie ma.",
    "First of its kind for you.": "Pierwsza taka w twojej kolekcji.",
    "No fishing in a dungeon.": "W podziemiach nie powędkujesz.", "There's no water close enough. Try a town by a lake, river or the sea.": "W pobliżu nie ma wody. Spróbuj w mieście nad jeziorem, rzeką albo morzem.",
    "You need a fishing rod. General stores sell them.": "Potrzebujesz wędki. Sprzedają je sklepy wielobranżowe.", "Stop walking first.": "Najpierw się zatrzymaj.",
    "Better rods (general store, forge) make it easier.": "Lepsze wędki (sklep wielobranżowy, kuźnia) ułatwiają sprawę.",
    "Cast, wait for the float to dip, then reel in while keeping the line in the safe band.": "Zarzuć, poczekaj, aż spławik zanurkuje, i zwijaj, trzymając żyłkę w bezpiecznym pasku.",
    "Wind": "Wiatr", "No wind": "Bez wiatru",
    // ---- hunting
    "Hunting": "Polowanie", "🏹 Hunting grounds": "🏹 Tereny łowieckie", "🏹 Go hunting": "🏹 Na polowanie", "Stalk": "Podejdź", "Stalk deer and elk": "Podchodź jelenie i łosie", "🏹 Stalk and shoot": "🏹 Podejdź i strzel",
    "Creep closer (hold)": "Skradaj się (przytrzymaj)", "Draw": "Napnij", "Leave": "Odejdź", "Loose": "Strzał", "Lower": "Opuść", "Hunt again": "Poluj dalej",
    "Creep closer while its head is down; freeze when it looks up. Watch the wind: scent carries downwind.": "Skradaj się, gdy ma łeb przy ziemi; zamrzyj, gdy go podnosi. Uważaj na wiatr: niesie twój zapach.",
    "Drag (or use the arrow keys) to aim. Aim into the wind. The heart sits just behind the front leg.": "Przeciągnij (albo użyj strzałek), żeby celować. Bierz poprawkę na wiatr. Serce jest tuż za przednią nogą.",
    "A clean shot.": "Czysty strzał.", "You draw and hold your breath.": "Napinasz cięciwę i wstrzymujesz oddech.",
    "It runs, wounded. You follow the blood trail and find it.": "Ucieka ranne. Idziesz po śladach krwi i je znajdujesz.", "There's nothing worth taking.": "Nie ma nic wartego zabrania.",
    "It runs, wounded, and you lose the trail.": "Ucieka ranne i gubisz trop.", "Your shot goes wide. It's gone in a heartbeat.": "Pudło. W mgnieniu oka znika.",
    "There's no game in a dungeon.": "W podziemiach nie ma zwierzyny.", "You need a bow or a crossbow.": "Potrzebujesz łuku albo kuszy.",
    "You have no arrows. Blacksmiths and general stores sell them.": "Nie masz strzał. Sprzedają je kowale i sklepy wielobranżowe.",
    "You have no bolts. Blacksmiths and general stores sell them.": "Nie masz bełtów. Sprzedają je kowale i sklepy wielobranżowe.",
    "The game here has gone to ground. Try again tomorrow, or somewhere else.": "Zwierzyna tu się pochowała. Spróbuj jutro albo gdzie indziej.",
    "Deer, elk, foxes and hares come down to the meadows here.": "Jelenie, łosie, lisy i zające schodzą tu na łąki.",
    "Stalk one, shoot it, and skin it for meat, hides and trophies.": "Podejdź jedno, ustrzel i oskóruj, a dostaniesz mięso, skóry i trofea.",
    "A skinning knife keeps the hides whole; hides tan into leather at the forge.": "Nóż do skórowania zachowuje skóry w całości; w kuźni wygarbujesz z nich skórę.",
    "Deer": "Jeleń", "Elk": "Łoś", "Mountain goat": "Kozica", "Hare": "Zając", "Fox": "Lis", "Snow fox": "Lis polarny", "Horker": "Horker", "Bristleback": "Szczeciniak",
    "deer": "jeleń", "elk": "łoś", "mountain goat": "kozica", "hare": "zając", "fox": "lis", "snow fox": "lis polarny", "horker": "horker", "bristleback": "szczeciniak",
    "Tools": "Narzędzia", "river": "rzeka", "lake": "jezioro", "sea": "morze",
    // ---- patch note
    "Gone fishing, gone hunting": "Na ryby i na polowanie",
    "Fishing is a proper little game now: cast (time the power bar for a long cast), wait for the float to go right under, then hold to reel and let go to ease off. Keep the needle in the safe band: too tight and the line snaps, too slack and the fish gets away. Works with a finger or the Space bar.":
      "Wędkowanie to teraz porządna mini-gra: zarzuć (złap moment na pasku siły, żeby rzucić daleko), poczekaj, aż spławik całkiem zniknie, potem przytrzymaj, żeby zwijać, i puść, żeby popuścić. Trzymaj wskazówkę w bezpiecznym pasku: za mocno i żyłka pęknie, za luźno i ryba ucieknie. Działa palcem albo Spacją.",
    "Twelve new fish, and what bites depends on the water, the hold, the time of day and the weather. Arctic char and grayling in the cold north, glass catfish and vampire fish only at night, pogfish love the rain, and a rare goldfish only bites in a storm or a downpour.":
      "Dwanaście nowych ryb, a to, co bierze, zależy od wody, krainy, pory dnia i pogody. Golce i lipienie na zimnej północy, szklane sumy i wampirze ryby tylko nocą, pogryby kochają deszcz, a rzadka złota rybka bierze tylko w burzę albo ulewę.",
    "Cleaning a catch can give salmon roe, slaughterfish eggs and pearls for alchemy. All the new fish count for fish recipes and sell at any general store.":
      "Patroszenie ryby może dać ikrę łososia, jaja rzeźniczek i perły do alchemii. Wszystkie nowe ryby pasują do rybnych przepisów i sprzedasz je w każdym sklepie wielobranżowym.",
    "Rods in three tiers: the old Fishing Rod, a Fine Fishing Rod (general stores, or make one at the forge) and a Master Angler's Rod (forge, needs Steel Smithing). Better rods widen the safe band, have a stronger line and bring more rare fish.":
      "Wędki w trzech klasach: stara Fishing Rod, Fine Fishing Rod (sklepy wielobranżowe albo kuźnia) i Master Angler's Rod (kuźnia, wymaga Steel Smithing). Lepsza wędka to szerszy bezpieczny pasek, mocniejsza żyłka i więcej rzadkich ryb.",
    "Hunting grounds in villages near the wild (Riverwood, Falkreath, Rorikstead, Ivarstead, Morthal, Dawnstar and more) and out in the wilds wherever you stop: creep up on a deer, elk, goat, hare or fox while it grazes, freeze when it looks up, mind the wind, then draw and shoot. Aim into the wind and go for the heart, just behind the front leg.":
      "Tereny łowieckie we wsiach blisko dziczy (Riverwood, Falkreath, Rorikstead, Ivarstead, Morthal, Dawnstar i inne) oraz w dziczy, gdziekolwiek się zatrzymasz: podkradnij się do jelenia, łosia, kozicy, zająca albo lisa, gdy się pasie, zamrzyj, gdy podnosi łeb, uważaj na wiatr, a potem napnij i strzel. Bierz poprawkę na wiatr i celuj w serce, tuż za przednią nogą.",
    "Deer, elk, goats and horkers you meet on the road while hunting now have a \"Stalk and shoot\" choice next to Fight.":
      "Jelenie, łosie, kozice i horkery spotkane na drodze podczas polowania mają teraz wybór „Podejdź i strzel” obok Walki.",
    "Skinning gives meat, hides and sometimes a trophy (antlers, goat horns, a fox tail, a lucky rabbit's foot). A Skinning Knife (general stores) keeps every hide whole; a Steel Skinning Knife (forge) gets extra hides, meat and trophies. Hides tan into leather at any forge, and the forge uses them up.":
      "Skórowanie daje mięso, skóry, a czasem trofeum (poroże, rogi kozicy, lisią kitę, szczęśliwą zajęczą łapkę). Skinning Knife (sklepy wielobranżowe) zachowuje każdą skórę w całości; Steel Skinning Knife (kuźnia) daje dodatkowe skóry, mięso i trofea. Skóry garbujesz w każdej kuźni, a kuźnia je zużywa.",
    "New meals: roast leg of goat, roast rabbit leg and bristleback stew.": "Nowe dania: pieczony udziec z kozicy, pieczony zajęczy udziec i gulasz ze szczeciniaka.",
    "New perks: Clean Kill, Wind Reader and Skinner (Archery), Stalker (Sneak), and Angler, Line Sense and Deep Waters (Alchemy, next to Forager). Each one changes how the games play.":
      "Nowe atuty: Clean Kill, Wind Reader i Skinner (Łucznictwo), Stalker (Skradanie) oraz Angler, Line Sense i Deep Waters (Alchemia, obok Forager). Każdy zmienia to, jak grasz w te mini-gry.",
  });
  I18N_EXTRA.pat.push(
    [/^(\d+) arrows$/, (m) => `${m[1]} strzał`], [/^(\d+) bolts$/, (m) => `${m[1]} bełtów`],
    [/^(\d+) animals around here today$/, (m) => `Zwierząt w okolicy na dziś: ${m[1]}`],
  );
  if (typeof I18N_STORY !== "undefined") I18N_STORY.pats.push(
    ["You land it: {0}!", "Złowione: {0}!"],
    ["Cleaning it gives you {0} and {1}.", "Przy patroszeniu znajdujesz: {0} i {1}."], ["Cleaning it gives you {0}.", "Przy patroszeniu znajdujesz: {0}."],
    ["You've caught {0} fish so far.", "Złowione ryby: {0}."], ["You've brought down {0} so far.", "Upolowane zwierzęta: {0}."],
    ["{0} more animals around here today.", "Zwierząt w okolicy na dziś: jeszcze {0}."],
    ["Water nearby: {0}.", "Woda w pobliżu: {0}."],
    ["The {0} drops where it stood.", "Zwierzę ({0}) pada w miejscu."],
    ["You skin it: {0}.", "Skórujesz zwierzę: {0}."],
    ["The {0} catches your scent and bolts.", "Zwierzę ({0}) wyczuwa twój zapach i ucieka."],
  );
})();
