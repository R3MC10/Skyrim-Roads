/* i18n_updfix.js: Polish for the phone-update fix patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Phone updates work again": "Aktualizacje na telefonie znowu działają",
    "On phones, tapping Update now could do nothing and say \"Not an update address\". The app misread the build number, so it turned down every small update.": "Na telefonach przycisk Zaktualizuj teraz mógł nic nie robić i pisać \"Not an update address\". Aplikacja źle odczytywała numer wersji, więc odrzucała każdą małą aktualizację.",
    "Fixed in the app itself. If your phone is stuck, install the newest app once (Update now gets it for you); after that, updates download by themselves again.": "Naprawione w samej aplikacji. Jeśli telefon utknął, zainstaluj raz najnowszą aplikację (Zaktualizuj teraz pobierze ją za ciebie); potem aktualizacje znów pobierają się same.",
  });
})();
