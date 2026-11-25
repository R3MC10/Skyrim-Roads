/* i18n_gatherarea.js: Polish for the Gathering section of the Area tab (gatherui.js) and its patch note.
   Loaded before i18n.js; lines with numbers go in pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    Gathering: "Zbieractwo",
    "Forage here": "Szukaj tutaj", Forage: "Szukaj",
    "Search the ground for whatever grows here": "Przeszukaj ziemię, czy coś tu rośnie",
    "You can't forage here.": "Tu nie da się niczego szukać.",
    "Herbalist's notes": "Notatki zielarza",
    "Every ingredient, where it grows, what you know": "Każdy składnik, gdzie rośnie, co o nim wiesz",
    "Auto-pick": "Samozbieranie",
    "You'll pick ripe plants as you pass them.": "Będziesz zbierać dojrzałe rośliny, mijając je.",
    "You'll only pick plants when you choose to.": "Zbierasz rośliny tylko wtedy, gdy sam zechcesz.",
    "How gathering works": "Jak działa zbieractwo",
    "Forage searches the ground where you stand for whatever grows there; night brings out moths, torchbugs and glowing Nirnroot. Auto-pick takes ripe plants as you pass them on the road. Patches you've spotted show on the map as leaves.":
      "Szukanie przeczesuje ziemię tam, gdzie stoisz, w poszukiwaniu tego, co tam rośnie; nocą wychodzą ćmy, świetliki i świecący Nirnkorzeń. Samozbieranie zgarnia dojrzałe rośliny, gdy mijasz je na drodze. Kępy, które już wypatrzyłeś, widać na mapie jako liście.",
    "No plants spotted right here. Patches you pass on the road show on the map as leaves.":
      "Nie widać tu żadnych roślin. Kępy, które mijasz na drodze, pokazują się na mapie jako liście.",
    // patch note
    "Gathering moved to the Area tab": "Zbieractwo przeniesione do zakładki Okolica",
    "Gathering no longer floats over the map. It's now its own section in the Area tab: the plants around you, which ones are ripe and when picked ones grow back, Gather or Quick pick for each, Forage here (with how long until you can search again), Herbalist's notes and the Auto-pick switch.":
      "Zbieractwo nie wisi już nad mapą. Ma teraz własną sekcję w zakładce Okolica: rośliny wokół ciebie, które są dojrzałe i kiedy odrosną zebrane, Zbierz albo Szybko zbierz przy każdej, Szukaj tutaj (z tym, ile zostało do kolejnego szukania), Notatki zielarza i przełącznik Samozbierania.",
    "The how-it-works text hides behind a small \"?\" next to the heading.":
      "Opis, jak to działa, chowa się pod małym \"?\" obok nagłówka.",
    "On the map a ripe plant in reach still shows its own Gather button, so you can pick it without leaving the map. In a party everyone still picks their own share.":
      "Na mapie dojrzała roślina w zasięgu wciąż ma własny przycisk Zbierz, więc zbierzesz ją bez opuszczania mapy. W drużynie każdy nadal zbiera swoją część.",
  });
  I18N_EXTRA.pat.push(
    [/^(\d+) ripe$/, (m) => `${m[1]} dojrzałe`],
  );
})();
