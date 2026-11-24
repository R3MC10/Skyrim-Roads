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

/* gorefx2.js: realistic splatter patch note (b171-gorefx) */
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
  "Fixed: blood and gore were not showing in fights at all. They're back.":
    "Poprawka: krew i flaki w ogóle nie pokazywały się w walkach. Już wróciły.",
});
