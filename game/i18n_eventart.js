/* i18n_eventart.js: Polish for the painted event and shop banners' patch note (the art pack: worldevents.js,
   greatevents.js, placeart.js). Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Painted events and shops": "Malowane wydarzenia i sklepy",
    "World events now have painted pictures: the Khajiit's grand caravan, Daedric invasions, dragon migrations and all four festival weeks each get their own.":
      "Wydarzenia świata mają teraz malowane obrazy: wielka karawana Khajiitów, inwazje daedr, wędrówki smoków i wszystkie cztery tygodnie świąt mają własne.",
    "Great world events do too: dragon assaults, Daedric rifts, sieges and town fairs.": "Wielkie wydarzenia świata też: ataki smoków, szczeliny daedr, oblężenia i jarmarki.",
    "You see a small picture on the event's card under the map and a wide one when you open it.":
      "Mały obraz widać na karcie wydarzenia pod mapą, a szeroki po jej otwarciu.",
    "Nine town places have new painted banners: the court wizard and enchanter, the market, stables, your home, the hall, the fence, the arena, the mine and the docks.":
      "Dziewięć miejsc w mieście ma nowe malowane banery: nadworny mag i zaklinacz, targ, stajnie, twój dom, sala, paser, arena, kopalnia i doki.",
  });
})();
