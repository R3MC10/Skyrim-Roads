/* i18n_caravans.js: Polish for the caravans, their wagons and your cart (caravans.js, caravanroad.js, the town's caravan
   board and job panel in ui.js, the reminder and the perk). [OURS]
   Loaded before i18n.js: short labels and whole sentences go in I18N_EXTRA.words, sentences with names, places or numbers
   in them go in I18N_STORY.pats ({0}, {1}… are filled in from the English at runtime; caravan names translate too). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_CARAVANS = (() => {
  const words = {
    // the four caravans and what they are
    "Ri'saad's caravan": "Karawana Ri'saada", "Ma'dran's caravan": "Karawana Ma'drana", "Ahkari's caravan": "Karawana Ahkari",
    "The Gray-Mane wagons": "Wozy Szarej Grzywy", "A Khajiit caravan": "Karawana Khajiitów", "Merchant wagons": "Wozy kupieckie",
    Caravan: "Karawana", Wagon: "Wóz", "Caravan guard": "Strażnik karawany", "Caravan job": "Praca przy karawanie", " Caravan job": " Praca przy karawanie",
    "Khajiit caravan guards": "Strażnicy karawany Khajiitów", "Caravan sellswords": "Najemnicy karawany",
    "Caravan raiders": "Napastnicy na karawany", "Forsworn war party": "Wojenna banda Wiarołomców", "Wolf pack": "Wataha wilków", Highwaymen: "Rozbójnicy", "Cart raiders": "Złodzieje wozów",
    "tap to meet": "dotknij, by ich spotkać", "near the wagons": "przy wozach",
    // the meeting on the road
    "Back off": "Wycofaj się", "Trade with the merchant": "Handluj z kupcem", "Ask for news from the road": "Zapytaj o wieści z drogi",
    "Walk with them a while (safer road)": "Idź z nimi kawałek (bezpieczniejsza droga)", "Rob the wagons": "Obrabuj wozy", " Rob the wagons": " Obrabuj wozy", "Wave and move on": "Pomachaj i idź dalej",
    "That caravan has moved on.": "Ta karawana już pojechała dalej.", "Find them there (Area tab).": "Znajdziesz ich tam (karta Okolica).",
    "You're already guarding a caravan.": "Już pilnujesz karawany.", "You're already guarding another caravan.": "Już pilnujesz innej karawany.",
    "Meet them while you travel.": "Spotkaj ich po drodze.", "Get a little closer.": "Podejdź trochę bliżej.",
    "The guards recognise you and draw steel before you get close.": "Strażnicy cię poznają i dobywają broni, zanim podejdziesz.",
    "Not one step nearer, thief.": "Ani kroku bliżej, złodzieju.",
    "A Khajiit guard with a curved sword watches you come.": "Strażnik Khajiit z zakrzywionym mieczem patrzy, jak podchodzisz.",
    "Walk in the warm sands, friend.": "Chodź po ciepłych piaskach, przyjacielu.", "You are buying, yes?": "Kupujesz, tak?",
    "The wagon master raises a hand.": "Woźnica unosi rękę.", "Well met, traveller.": "Witaj, wędrowcze.", "Need anything before we push on?": "Potrzebujesz czegoś, zanim ruszymy dalej?",
    "You back away from the wagons.": "Odsuwasz się od wozów.",
    "The caravan's trader throws back a flap of canvas.": "Kupiec karawany odchyla płachtę.", "Khajiit has wares, if you have coin.": "Khajiit ma towary, jeśli ty masz monety.",
    "The wagon master drops the tailboard and shows you what they're hauling.": "Woźnica opuszcza burtę i pokazuje ci, co wiozą.",
    "Road's quiet.": "Na drodze spokój.", "It's marked on your map now.": "Teraz jest na twojej mapie.",
    "Quiet roads, thank the Eight.": "Spokojne drogi, dzięki Ośmiorgu.", "Nothing worth telling.": "Nic wartego opowiadania.",
    "The wagons have already rolled on.": "Wozy już odjechały.",
    "Bandits think twice about a road this busy, as long as you stay close to the wagons.": "Bandyci zastanowią się dwa razy na tak ruchliwej drodze, dopóki trzymasz się blisko wozów.",
    "The wagon master looks you over and nods.": "Woźnica mierzy cię wzrokiem i kiwa głową.", "Keep your eyes on the trees.": "Miej oko na drzewa.",
    "The Khajiit guards draw their blades as one.": "Strażnicy Khajiici jak jeden dobywają ostrzy.",
    "The sellswords pull steel and spread out around the wagons.": "Najemnicy dobywają broni i rozstawiają się wokół wozów.",
    "You draw your weapon.": "Dobywasz broni.", "Glad you were with us out there.": "Dobrze, że byłeś z nami w drodze.",
    // ambushes on a caravan
    "Arrows thud into the lead wagon.": "Strzały wbijają się w pierwszy wóz.", "Bandits pour down the slope, after the caravan's goods.": "Bandyci zbiegają ze zbocza po towary karawany.",
    "Painted Forsworn burst from the rocks with briarheart howls.": "Pomalowani Wiarołomcy wypadają zza skał z wyciem serc z ciernia.", "The caravan master yells for the guards.": "Karawaniarz woła straż.",
    "A pack of wolves circles the oxen, snarling.": "Wataha wilków krąży wokół wołów, warcząc.", "The animals panic.": "Zwierzęta wpadają w panikę.",
    "A gang of armoured highwaymen blocks the road.": "Banda opancerzonych rozbójników zagradza drogę.", "Hand over the wagons and nobody bleeds.": "Oddajcie wozy, to nikt nie będzie krwawił.",
    // signing on, leaving, getting paid
    "That caravan isn't taking guards right now.": "Ta karawana teraz nie przyjmuje strażników.", "Finish what you're doing first.": "Najpierw skończ to, co robisz.",
    "Be at the wagons when they leave.": "Bądź przy wozach, gdy ruszą.", "You leave the caravan and go your own way.": "Zostawiasz karawanę i idziesz swoją drogą.", "No pay.": "Bez zapłaty.",
    "You tell the caravan master you won't be coming after all.": "Mówisz karawaniarzowi, że jednak nie pojedziesz.",
    "You lost the caravan.": "Zgubiłeś karawanę.", "No pay this time.": "Tym razem bez zapłaty.", "You ran.": "Uciekłeś.", "The caravan master won't pay deserters.": "Karawaniarz nie płaci dezerterom.",
    "That caravan isn't here.": "Tej karawany tu nie ma.", "They don't sell that.": "Tego nie sprzedają.",
    // the caravan board in town and the job panel
    "No guards yet.": "Na razie bez strażników.", "Leave the caravan": "Opuść karawanę", "You're guarding another caravan": "Pilnujesz innej karawany", "Sign on as a guard": "Zaciągnij się jako strażnik",
    Wares: "Towary", "Gold Ring": "Złoty pierścień", "leaves in": "rusza za", "Expect two ambushes on the road.": "Spodziewaj się dwóch zasadzek w drodze.", "Expect an ambush on the road.": "Spodziewaj się zasadzki w drodze.",
    "Pay: about": "Zapłata: około", "The wagons leave in": "Wozy ruszają za", "— be there.": "— bądź na miejscu.", "Arrives in": "Dojazd za", "Stay sharp.": "Bądź czujny.",
    "Guard a caravan for pay.": "Pilnuj karawany za zapłatę.", "You're not with a caravan.": "Nie jesteś przy żadnej karawanie.",
    "Caravans roll between the holds on a timetable everyone shares.": "Karawany jeżdżą między krainami według rozkładu wspólnego dla wszystkich.",
    "Sign on as a guard while the wagons wait, travel with them, fight off the ambushes, and collect your pay on arrival.": "Zaciągnij się jako strażnik, gdy wozy czekają, jedź z nimi, odpieraj zasadzki i odbierz zapłatę na miejscu.",
    "a caravan brought some": "karawana trochę przywiozła", "guarded a caravan all the way": "pilnował karawany przez całą drogę",
    // what the caravans sell that had no Polish name yet
    "Silver Necklace": "Srebrny naszyjnik", "Silver Ring": "Srebrny pierścień", Garnet: "Granat", Ruby: "Rubin", "Flawless Amethyst": "Nieskazitelny ametyst",
    "Common Soul Gem (filled)": "Zwykły kamień dusz (napełniony)", Firewood: "Drewno na opał", "Refined Moonstone": "Oczyszczony kamień księżycowy",
    "Moonstone Ore": "Ruda kamienia księżycowego", "Corundum Ore": "Ruda korundu", "Leather Strips": "Rzemienie", "Wolf Pelt": "Wilcza skóra", "Steel Ingot": "Sztaba stali",
    // your cart
    "A cart": "Wóz", "Your cart": "Twój wóz", "Buy the cart": "Kup wóz", "You need a horse first": "Najpierw potrzebujesz konia",
    "You go 10% slower, keep to the roads, and bandits sometimes come for the cargo.": "Jedziesz o 10% wolniej, trzymasz się dróg, a bandyci czasem przychodzą po ładunek.",
    "Your horse isn't here to pull it.": "Nie ma tu twojego konia, by go ciągnął.", "Iron-bound wheels.": "Okute żelazem koła.", "Hitch it up": "Zaprzęgnij go", "Leave it here": "Zostaw go tutaj", "Iron wheels fitted": "Żelazne koła założone",
    "Carts are sold at a stables.": "Wozy kupisz w stajni.", "You need a horse to pull a cart.": "Potrzebujesz konia, by ciągnął wóz.", "Buy one first.": "Najpierw go kup.",
    "You already own a cart.": "Masz już wóz.", "The cart is yours.": "Wóz jest twój.", "You don't have a cart.": "Nie masz wozu.", "Your cart already has iron-bound wheels.": "Twój wóz ma już okute koła.",
    "The stablehand can fit them at a stables.": "Stajenny założy je w stajni.",
    "Iron-bound wheels: the cart runs smoother and bandits find it a harder target (half as many raids).": "Okute koła: wóz jedzie równiej, a bandyci mają trudniejszy cel (o połowę mniej napadów).",
    "You need your horse here to pull it.": "Potrzebujesz tu konia, by go ciągnął.", "You hitch the cart up again.": "Znów zaprzęgasz wóz.", "You can leave the cart at any stables.": "Wóz możesz zostawić w dowolnej stajni.",
    "It'll be safe here.": "Tu będzie bezpieczny.", "Your cart can't leave the roads.": "Twój wóz nie zjedzie z dróg.", "Leave it at a stables to roam, or pick a named place.": "Zostaw go w stajni, by chodzić po bezdrożach, albo wybierz nazwane miejsce.",
    "Three bandits step out of the trees and grab your horse's bridle.": "Trzech bandytów wychodzi spomiędzy drzew i chwyta twojego konia za uzdę.", "Nice cart.": "Ładny wóz.", "We'll take what's in it.": "Weźmiemy, co w nim jest.",
    // the perk
    "Caravan Friend": "Przyjaciel karawan",
    "The Khajiit's grand caravan sells to you 15% cheaper and sets aside one more rare item for you. Caravans you meet on the road pay you 25% more to guard their wagons and sell to you 10% cheaper.":
      "Wielka karawana Khajiitów sprzedaje ci 15% taniej i odkłada dla ciebie jeszcze jedną rzadką rzecz. Karawany spotkane w drodze płacą ci 25% więcej za ochronę wozów i sprzedają ci 10% taniej.",
  };
  for (const n of ["Ri'saad's caravan", "Ma'dran's caravan", "Ahkari's caravan", "The Gray-Mane wagons"]) words[n + " again."] = "Znowu " + words[n].charAt(0).toLowerCase() + words[n].slice(1) + ".";   // the robbed caravan meets you again
  words["The Khajiit's grand caravan sells to you 15% cheaper and sets aside one more rare item for you. Caravans you meet on the road pay you 25% more to guard their wagons and sell to you 10% cheaper. [OURS]"] =
    words["The Khajiit's grand caravan sells to you 15% cheaper and sets aside one more rare item for you. Caravans you meet on the road pay you 25% more to guard their wagons and sell to you 10% cheaper."] + " [OURS]";
  const pats = [
    ["{0} is resting in {1}.", "{0} odpoczywa w: {1}."], ["{0}, rolling toward {1}.", "{0}, w drodze do: {1}."], ["{0} is too far off to hail.", "{0} jest za daleko, by ich zawołać."],
    ["{0} creaks along the road toward {1}, striped canvas and bells on the harness.", "{0} skrzypi po drodze do: {1}, pasiaste płótno i dzwonki przy uprzęży."],
    ["{0} rumble along the road toward {1}, a couple of sellswords up front.", "{0} turkoczą po drodze do: {1}, z przodu paru najemników."],
    ["Guard the wagons to {0} ({1} gold)", "Pilnuj wozów do: {0} ({1} złota)"], ["You wave {0} on and carry on your way.", "Machasz na pożegnanie ({0}) i idziesz dalej."],
    ["Heard this in the last town: {0}", "Słyszeliśmy to w ostatnim mieście: {0}"], ["{0} is marked on your map.", "{0} jest teraz na twojej mapie."],
    ["Though there's a place off the road near {0} you might not know: {1}.", "Ale niedaleko {0}, z dala od drogi, jest miejsce, którego możesz nie znać: {1}."],
    ["You fall in beside {0} for a while.", "Idziesz przez chwilę obok: {0}."], ["{0} gold when we roll into {1}.", "{0} złota, gdy wjedziemy do: {1}."],
    ["You help yourself from the wagons: {0} gold{1}.", "Częstujesz się z wozów: {0} złota{1}."], ["Word of this will reach the guards in {0}.", "Wieść o tym dotrze do straży w: {0}."],
    ["This will cost you a bounty in {0}.", "Za to dostaniesz nagrodę za głowę w: {0}."],
    ["{0} rolls safely into {1}.", "{0} bezpiecznie wjeżdża do: {1}."], ["The wagon master counts {0} gold into your hand.", "Woźnica odlicza ci do ręki {0} złota."],
    ["The caravan master counts out your share: {0} gold ({1} guards).", "Karawaniarz odlicza twoją część: {0} złota ({1} strażników)."], ["The caravan master counts out your share: {0} gold.", "Karawaniarz odlicza twoją część: {0} złota."],
    ["Go to {0} to sign on.", "Idź do: {0}, by się zaciągnąć."], ["You sign on with {0} to {1}.", "Zaciągasz się do: {0}, do celu: {1}."], ["{0} left {1} without you.", "{0} wyjechała z: {1} bez ciebie."],
    ["{0} rolls out of {1} with you guarding the wagons.", "{0} wyrusza z: {1}, a ty pilnujesz wozów."],
    ["It costs {0} gold.", "Kosztuje {0} złota."], ["You buy {0} from {1} for {2} gold.", "Kupujesz {0} od: {1} za {2} złota."],
    ["A cart costs {0} gold.", "Wóz kosztuje {0} złota."], ["Iron-bound wheels cost {0} gold.", "Okute koła kosztują {0} złota."],
    ["Hitched to {0}, it carries {1} more, but you go a little slower and must keep to the roads.", "Zaprzęgnięty do: {0} uniesie {1} więcej, ale jedziesz trochę wolniej i musisz trzymać się dróg."],
    ["Your cart is waiting at the stables in {0}.", "Twój wóz czeka w stajni w: {0}."], ["You leave the cart at the stables in {0}.", "Zostawiasz wóz w stajni w: {0}."],
    ["Hitched to your horse it carries +{0}.", "Zaprzęgnięty do konia uniesie +{0}."], ["Waiting at the stables in {0}.", "Czeka w stajni w: {0}."], ["Hitched up: +{0} carry weight, roads only.", "Zaprzęgnięty: +{0} udźwigu, tylko drogi."],
    ["Iron wheels ({0})", "Żelazne koła ({0})"], ["No caravans in {0} right now.", "Teraz nie ma karawan w: {0}."], ["{0} is on the road from {1} and arrives in", "{0} jedzie z: {1} i dojedzie za"],
    ["Waiting in {0}.", "Czekasz w: {0}."], ["On the road to {0}.", "W drodze do: {0}."], ["Ambushes fought off: {0}.", "Odparte zasadzki: {0}."],
    ["Your caravan leaves {0}", "Twoja karawana rusza z: {0}"], ["stay in town", "zostań w mieście"], ["be there or it leaves without you", "bądź na miejscu, bo odjedzie bez ciebie"],
    ["Caravan ambush: {0}", "Zasadzka na karawanę: {0}"], ["The caravan is camped outside {0} for {1} more.", "Karawana obozuje pod: {0} jeszcze przez {1}."],
  ];
  // pieces next to a timer on the caravan board ("To Whiterun · leaves in 3:20", "Arriving from Riften in 4:10")
  const place = (n) => typeof WORLD !== "undefined" && WORLD.places && !!WORLD.places[n];
  const pat = [
    [/^To (.+)$/, (m) => (place(m[1]) ? `Do: ${m[1]}` : null)],
    [/^(.+?) to (.+)$/, (m) => (words[m[1]] && place(m[2]) ? `${words[m[1]]} do: ${m[2]}` : null)],   // the reminder: "Ma'dran's caravan to Windhelm"
    [/^Arriving from (.+) in$/, (m) => (place(m[1]) ? `Przyjeżdża z: ${m[1]}, za` : null)],
    [/^gold each with (\d+) guards? \(more guards, bigger contract\)\.$/, (m) => `złota na głowę przy ${m[1]} strażnikach (więcej strażników, większy kontrakt).`],
  ];
  for (const [k, v] of Object.entries(words)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(...pat);
  if (typeof I18N_STORY !== "undefined") I18N_STORY.pats.push(...pats);
  return { words, pats, pat };
})();
if (typeof module !== "undefined") module.exports = I18N_CARAVANS;
