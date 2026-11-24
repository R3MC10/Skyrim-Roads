/* i18n_paintedmap.js: Polish for paintedmap.js (the Roads on the map setting) and its patch notes (b172-mapvisuals too).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Roads on the map": "Drogi na mapie",
    // patch note
    "Ready for a painted world map": "Gotowi na malowaną mapę świata",
    "The world map can now show a hand-painted picture of Skyrim instead of the drawn one. Towns, roads, fog, your cone of sight, light, weather and markers all sit on top of it, exactly where they were.":
      "Mapa świata może teraz pokazywać ręcznie malowany obraz Skyrim zamiast rysowanego. Miasta, drogi, mgła, twoje pole widzenia, światło, pogoda i znaczniki leżą na nim dokładnie tam, gdzie były.",
    "Once the painting is in, Settings → Graphics gets a Roads on the map switch, in case the painted roads are enough for you.":
      "Gdy obraz jest w grze, w Ustawienia → Grafika pojawia się przełącznik Drogi na mapie, jeśli namalowane drogi ci wystarczą.",
    "Until the painting arrives, the map looks and works just like before.":
      "Dopóki obrazu nie ma, mapa wygląda i działa tak jak wcześniej.",
    // patch note b172-mapvisuals
    "A sharper, prettier world map":
      "Lepsza, ostrzejsza mapa świata",
    "On a PC the map now fills the whole window, even zoomed all the way out. No more small map in the middle with grey clouds and empty dark space around it.":
      "Na PC mapa wypełnia teraz całe okno, nawet po pełnym oddaleniu. Koniec z małą mapą na środku z szarymi chmurami i pustą ciemną przestrzenią dookoła.",
    "Places you haven't found yet hide under dark, inked parchment mist instead of grey photo clouds.":
      "Miejsca, których jeszcze nie znalazłeś, kryją się pod ciemną, kreskowaną mgłą na pergaminie zamiast szarych chmur jak ze zdjęcia.",
    "Zoom in close and the blurry painting turns into a crisp hand-inked chart: hills, pines, autumn trees, reeds, rocks and snowy peaks drawn sharp at any zoom, on any screen.":
      "Po mocnym przybliżeniu rozmyty obraz zmienia się w ostrą, ręcznie rysowaną tuszem mapę: wzgórza, sosny, jesienne drzewa, trzciny, skały i ośnieżone szczyty, ostre przy każdym przybliżeniu i na każdym ekranie.",
    "Roads are thin, slightly wobbly ink lines now, and small paths to farms and landmarks are dotted. The Roads on the map switch in Settings still works.":
      "Drogi to teraz cienkie, lekko falujące linie tuszu, a małe ścieżki do farm i ciekawych miejsc są kropkowane. Przełącznik Drogi na mapie w Ustawieniach dalej działa.",
    "Hold names are small, quiet capitals that fade as you zoom in and never cover a town's name.":
      "Nazwy ziem to małe, dyskretne kapitaliki, które znikają przy przybliżaniu i nigdy nie zasłaniają nazwy miasta.",
    "Fixed a stray gold line under the world event cards: it was the caravan's progress bar showing through while its card was hidden under the map.":
      "Naprawiono zabłąkaną złotą linię pod kartami wydarzeń świata: to był pasek postępu karawany, widoczny, gdy jego karta chowała się pod mapą.",
    "The compass at the top of the PC map is one centred bar, like in Skyrim.":
      "Kompas na górze mapy na PC to jeden wyśrodkowany pasek, jak w Skyrim.",
  });
})();
