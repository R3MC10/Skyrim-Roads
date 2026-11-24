/* i18n_assetquality.js: Polish for the "Sharper pictures on every screen" patch note (asset quality pass).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Sharper pictures on every screen": "Ostrzejsze obrazki na każdym ekranie",
    "Foes in fights are painted at full size now, so they stay sharp on big monitors and 3x phone screens instead of going soft.":
      "Wrogowie w walkach są teraz malowani w pełnym rozmiarze, więc zostają ostrzy na dużych monitorach i gęstych ekranach telefonów, zamiast się rozmywać.",
    "The dragon is no longer squashed into a square: it shows with its proper wide wingspan.":
      "Smok nie jest już ściśnięty do kwadratu: widać go z prawdziwą, szeroką rozpiętością skrzydeł.",
    "Paintings (towns, shop banners, fight scenes, event pictures) keep their shape and are never blown up into a blur. On a very big screen a painting shows at its own size instead.":
      "Obrazy (miasta, szyldy sklepów, sceny walk, obrazki wydarzeń) trzymają swój kształt i nigdy nie są rozdmuchiwane do rozmycia. Na bardzo dużym ekranie obraz pokazuje się w swoim własnym rozmiarze.",
    "Fight scenes are drawn at your screen's full sharpness, on phones and on 4K monitors, even when the window grows or the phone turns.":
      "Sceny walk są rysowane w pełnej ostrości twojego ekranu, na telefonach i na monitorach 4K, nawet gdy okno się powiększy albo obrócisz telefon.",
    "The painted compass is a bit sharper too.": "Malowany kompas też jest trochę ostrzejszy.",
  });
})();
