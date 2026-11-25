/* i18n_travelview.js: Polish for the richer road view's patch note (fpscene.js / fpworld.js draw no words). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "A road worth watching": "Droga, na którą warto patrzeć",
    "The road view on a trip is much richer: hills and bends you can see coming, mountains, ridges and treelines that fade into the haze, and trees, rocks and signs that grow as you ride up to them and slide past.":
      "Widok drogi w podróży jest dużo bogatszy: widać nadchodzące wzgórza i zakręty, góry, grzbiety i linie lasów znikające we mgle, a drzewa, skały i drogowskazy rosną, gdy do nich podjeżdżasz, i przesuwają się obok.",
    "Every land looks like itself, read from the map around you: open tundra, thick pine forest, snowy mountains, rocky hills, misty marsh, ash under a smoking volcano, the coast with the sea on its real side, green river valleys and the Rift's golden birches.":
      "Każda kraina wygląda po swojemu, odczytana z mapy wokół ciebie: otwarta tundra, gęsty las sosnowy, ośnieżone góry, skaliste wzgórza, mglisty bagienny teren, popiół pod dymiącym wulkanem, wybrzeże z morzem po właściwej stronie, zielone doliny rzek i złote brzozy Riftu.",
    "Things happen along the way: deer bolt, a fox darts across, wolves pace you, mammoths roam, horkers lie on the shore, guards in their hold's colours march by, a merchant's cart passes, and now and then a watchtower, a waterfall, an old camp, giants or a dragon in the sky.":
      "Po drodze coś się dzieje: jelenie uciekają, lis przebiega przez drogę, wilki biegną obok, mamuty wędrują, horkery leżą na brzegu, strażnicy w barwach swojego władztwa maszerują, mija cię wóz kupca, a od czasu do czasu wieża strażnicza, wodospad, stary obóz, olbrzymy albo smok na niebie.",
    "The same road shows the same landmarks every time you take it; the animals and travellers are different on each trip.":
      "Ta sama droga za każdym razem pokazuje te same miejsca; zwierzęta i podróżni są inni w każdej podróży.",
    "Your destination grows as you near it, and cities show their gate when you get close. Your horse's mane and reins move as you ride.":
      "Cel podróży rośnie, gdy się zbliżasz, a miasta pokazują bramę, kiedy jesteś blisko. Grzywa konia i wodze ruszają się w czasie jazdy.",
    "Light and weather fit the land: drifting ash, snow blown off the drifts, falling leaves, fireflies on summer nights, salt haze by the sea.":
      "Światło i pogoda pasują do krainy: unoszący się popiół, śnieg zwiewany z zasp, spadające liście, świetliki w letnie noce, słona mgiełka nad morzem.",
  });
})();
