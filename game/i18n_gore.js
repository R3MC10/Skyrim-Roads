/* i18n_gore.js: Polish for the Blood and gore setting and its patch note (gore.js).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Blood and gore": "Krew i flaki",
  "Blood on the snow": "Krew na śniegu",
  "Fights get bloody: a blow throws a spray of blood away from whoever struck it, and the drops land and stay on the ground for the whole fight. Big hits and criticals spray more.":
    "Walki robią się krwawe: cios wyrzuca bryzg krwi w stronę przeciwną do atakującego, a krople spadają i zostają na ziemi do końca walki. Mocne ciosy i trafienia krytyczne pryskają mocniej.",
  "Every blow looks different: swords and axes throw arcs of blood, arrows stick in, hammers splat and kick up dust, fire scorches and chars, frost throws ice shards, lightning throws sparks and poison drips green.":
    "Każdy cios wygląda inaczej: miecze i topory wyrzucają łuki krwi, strzały zostają w ciele, młoty rozbryzgują i wzbijają kurz, ogień przypala i zwęgla, mróz sypie odłamkami lodu, błyskawice sypią iskrami, a trucizna kapie na zielono.",
  "Not everything bleeds: skeletons and draugr chip bone and dust, dwarven machines leak oil and lose gears, ghosts lose wisps, daedra bleed black, dragons splash big and dark, and Falmer and chaurus bleed green.":
    "Nie wszystko krwawi: szkieletom i draugrom odpryskują kości i kurz, krasnoludzkim maszynom cieknie olej i lecą zębatki, duchy tracą smugi ektoplazmy, daedra krwawią czernią, smoki chlapią dużo i ciemno, a Falmerowie i chaurusy krwawią na zielono.",
  "Wounds show: red streaks build up on a fighter as their health drops, a bleeding foe keeps dripping, and you get a red flash at the edges of the screen when you take a heavy hit.":
    "Rany widać: im mniej zdrowia, tym więcej czerwonych smug na walczącym, krwawiący wróg ciągle kapie, a gdy mocno oberwiesz, brzegi ekranu błyskają na czerwono.",
  "A killing blow leaves the body in a pool, and a strong finisher now and then knocks a helmet or weapon flying, or takes a limb off a beast or a skeleton.":
    "Po zabójczym ciosie ciało leży w kałuży, a mocne dobicie czasem strąca hełm albo wytrąca broń, albo odcina łapę bestii czy kość szkieletowi.",
  "Followers, party members and horses get hit and bleed too, but they still only get knocked down.":
    "Towarzysze, członkowie drużyny i konie też obrywają i krwawią, ale dalej tylko padają powaleni.",
  "Settings → Fights → Blood and gore: Off, Low or Full. Everyone in a shared fight sees the same spray.":
    "Ustawienia → Walki → Krew i flaki: Wył., Niskie albo Pełne. We wspólnej walce wszyscy widzą te same bryzgi.",
});

/* gorefx2.js: realistic splatter patch note (b173-gorefx) */
Object.assign(I18N_EXTRA.words, {
  "Realistic blood and splatter":
    "Realistyczna krew i rozbryzgi",
  "Blows now throw real-looking blood: a wet burst of drops and fine mist flies away from whoever struck, bigger the harder the hit.":
    "Ciosy wyrzucają teraz krew, która wygląda prawdziwie: mokry bryzg kropel i drobnej mgiełki leci w stronę przeciwną do atakującego, tym większy, im mocniej uderzysz.",
  "Critical hits and finishing blows add a jet of blood and a wide splash, splatter the ground and smear the foe. The stains slowly fade over the fight.":
    "Trafienia krytyczne i dobicia dodają strumień krwi i szeroki rozbryzg, plamią ziemię i brudzą wroga. Plamy powoli bledną w trakcie walki.",
  "Hammers and maces kick up dust and spill less blood. Draugr and skeletons burst into grave dust and bone chips, Dwemer machines spit oil and sparks, Falmer and chaurus bleed green and daedra dark ichor. A blade on armour throws sparks.":
    "Młoty i buzdygany wzbijają kurz i leją mniej krwi. Draugry i szkielety rozsypują się w grobowy pył i odpryski kości, krasnoludzkie maszyny plują olejem i iskrami, Falmerowie i chaurusy krwawią na zielono, a daedra ciemną posoką. Ostrze na zbroi krzesze iskry.",
  "Spells look better too: frost throws ice shards, fire throws embers and smoke, lightning crackles and other magic leaves glowing motes.":
    "Czary też wyglądają lepiej: mróz sypie odłamkami lodu, ogień sypie żarem i dymem, błyskawice trzaskają, a inna magia zostawia świecące drobinki.",
  "Followers and horses bleed a little but are never splattered or cut up, and still only get knocked down.":
    "Towarzysze i konie trochę krwawią, ale nigdy nie są zachlapani ani pocięci i dalej tylko padają powaleni.",
  "Blood and gore on Full shows all of it; Low keeps the dust, sparks and spell effects without the realistic blood; Off shows none.":
    "Krew i flaki na Pełne pokazuje wszystko; Niskie zostawia kurz, iskry i efekty czarów bez realistycznej krwi; Wył. nie pokazuje nic.",
});

/* blood3 (b188-blood3): cleaner blood */
Object.assign(I18N_EXTRA.words, {
  "Cleaner blood": "Czystsza krew",
  "No more grey circles floating over a fallen foe: the dust when a body hits the ground is a low, soft puff that settles fast.":
    "Koniec z szarymi kółkami nad pokonanym wrogiem: kurz, gdy ciało pada na ziemię, to niski, miękki obłoczek, który szybko opada.",
  "A critical hit now throws thin streams of blood that break into drops of all sizes, plus a quick fine spray. No more red pills or pale sticks.":
    "Trafienie krytyczne wyrzuca teraz cienkie strugi krwi, które rwą się na krople różnej wielkości, i krótką drobną mgiełkę. Koniec z czerwonymi pigułkami i bladymi patyczkami.",
  "Sparks only fly when a blade hits metal (plate armour or a machine), and they're small, bright and quick.":
    "Iskry lecą tylko, gdy ostrze trafia w metal (płytową zbroję albo maszynę), i są małe, jasne i krótkie.",
  "The pool under a fallen foe (or under you when you're knocked down) spreads wider over two seconds, with a soft, uneven edge, a darker middle and a wet shine.":
    "Kałuża pod pokonanym wrogiem (albo pod tobą, gdy padniesz) rozlewa się szerzej przez dwie sekundy, z miękkim, nierównym brzegiem, ciemniejszym środkiem i mokrym połyskiem.",
});

/* blood2 (b185-blood2): realistic liquid blood, the Gore setting */
Object.assign(I18N_EXTRA.words, {
  "Gore": "Krew",
  "Reduced": "Mniej",
  "Blood that looks like blood": "Krew, która wygląda jak krew",
  "Blood in fights looks wet and real now: glossy dark red that runs together, see-through and brighter where it's thin, with a shine where the light catches it. No more red pills.":
    "Krew w walkach wygląda teraz na mokrą i prawdziwą: lśniąca ciemna czerwień, która się zlewa, prześwituje i jaśnieje tam, gdzie jest cienka, i błyszczy w świetle. Koniec z czerwonymi pigułkami.",
  "A hit throws blood out of the wound the way the blow went, as ropes that break into drops and a fine mist. The drops fly in an arc, fall, and leave small splats on the ground that slowly fade over the fight.":
    "Cios wyrzuca krew z rany w kierunku uderzenia: strugi rwą się na krople i drobną mgiełkę. Krople lecą łukiem, spadają i zostawiają na ziemi małe plamy, które powoli bledną w trakcie walki.",
  "Critical hits and finishing blows spray much more. Heavy hits leave blood running down the fighter, which fades after a while. A fallen foe lies in a pool that spreads out, and so do you when you're knocked down.":
    "Trafienia krytyczne i dobicia pryskają dużo mocniej. Po mocnych ciosach krew spływa po walczącym i po chwili blednie. Pokonany wróg leży w rozlewającej się kałuży, i ty też, gdy padniesz powalony.",
  "Skeletons and draugr still only throw bone and dust, Dwemer machines spit black oil and sparks, daedra bleed dark ichor, Falmer bleed green, and spriggans now bleed amber sap.":
    "Szkielety i draugry dalej sypią tylko kośćmi i kurzem, krasnoludzkie maszyny plują czarnym olejem i iskrami, daedra krwawią ciemną posoką, Falmerowie na zielono, a sprigganom cieknie teraz bursztynowy sok.",
  "New setting: Settings → Fights → Gore: Off, Reduced (just a mist and small splats) or Full. Full is the default.":
    "Nowe ustawienie: Ustawienia → Walki → Krew: Wył., Mniej (tylko mgiełka i małe plamy) albo Pełne. Domyślnie Pełne.",
  "Phones on Low or Medium fight quality show fewer splashes, so fights stay smooth. Followers and horses still only get knocked down: no pools under them.":
    "Na telefonach z niską lub średnią jakością walki jest mniej rozbryzgów, żeby walka szła płynnie. Towarzysze i konie dalej tylko padają powaleni: bez kałuż pod nimi.",
  "Painted fighters with realistic fight animations": "Malowani wojownicy z realistycznymi animacjami walki",
});
