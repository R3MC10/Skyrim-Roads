/* i18n_hotbardnd.js: Polish for the hotbar's drag and drop and its 1× / 2× (single / dual cast) switch (hotbar.js, b302).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "This spell can't be dual cast": "Tego czaru nie da się rzucić oburącz",
    "No dual cast": "Nie oburącz",
    "No dual casting": "Brak rzucania oburącz",
    "Dual cast": "Oburącz",
    "Single cast": "Jedną ręką",
    "Single cast (one hand). Tap for dual cast: both hands, stronger, costs more": "Jedną ręką. Stuknij, żeby rzucać oburącz: mocniej, ale drożej",
    "Dual cast (both hands). Tap for single cast": "Oburącz. Stuknij, żeby rzucać jedną ręką",
    "Drag a move onto a slot. Drag slots to swap, or off the bar to clear. 1× / 2× on a spell: single or dual cast.":
      "Przeciągnij ruch na miejsce. Przeciągnij miejsca, żeby je zamienić, albo poza pasek, żeby wyczyścić. 1× / 2× na czarze: jedną ręką albo oburącz.",
    "Hold a move, then drag it onto a slot (or tap a slot, then a move). Drag slots to swap, or off the bar to clear. 1× / 2×: single or dual cast.":
      "Przytrzymaj ruch i przeciągnij go na miejsce (albo stuknij miejsce, potem ruch). Przeciągnij miejsca, żeby je zamienić, albo poza pasek, żeby wyczyścić. 1× / 2×: jedną ręką albo oburącz.",
    // patch note (build 302)
    "Drag and drop on the hotbar, single or dual cast": "Przeciąganie na pasku, czary jedną ręką albo oburącz",
    "In Edit hotbar you can now drag moves, spells, potions and poisons from the list onto a slot, drag one slot onto another to swap them, or drag a slot off the bar to empty it. With a mouse just drag; on a phone hold a row for a moment until it lifts, then drag. Tapping still works too.":
      "W edycji paska możesz teraz przeciągać ruchy, czary, mikstury i trucizny z listy na miejsce, przeciągnąć jedno miejsce na drugie, żeby je zamienić, albo poza pasek, żeby je opróżnić. Myszką po prostu przeciągnij; na telefonie przytrzymaj wiersz, aż się uniesie, i przeciągnij. Stukanie też dalej działa.",
    "Every spell slot has a small 1× / 2× switch: 1× casts with one hand, 2× casts with both hands (stronger, costs more, with your dual casting perks). The same spell can sit in two slots, once each way, and the key or a tap uses the slot's way. The rune game plays for both.":
      "Każde miejsce z czarem ma mały przełącznik 1× / 2×: 1× rzuca jedną ręką, 2× oburącz (mocniej, drożej, z twoimi atutami do rzucania oburącz). Ten sam czar może być w dwóch miejscach, raz tak, raz tak, a klawisz albo stuknięcie używa sposobu z danego miejsca. Gra z runami działa w obu.",
    "A spell that can't be dual cast (like a summon) can't be switched to 2×, and an old 2× slot of one shows greyed out and says why.":
      "Czaru, którego nie da się rzucić oburącz (np. przywołania), nie przełączysz na 2×, a stare miejsce 2× z takim czarem jest wyszarzone i mówi dlaczego.",
    "The list shows each spell once now; your bar keeps what it had (old Dual slots stay 2×).":
      "Lista pokazuje teraz każdy czar raz; twój pasek zostaje, jaki był (stare miejsca Oburącz są teraz 2×).",
  });
})();
