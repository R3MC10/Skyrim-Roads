/* Polish for the build 316 patch note: the AI & Loadouts tab is gone. Loaded before i18n.js, which merges I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "One set of gear, no fight robot settings": "Jeden zestaw ekwipunku, bez ustawień automatu walki",
  "Character → AI & Loadouts is gone: the fight rules editor, share codes, the AI tester and gear loadouts. You pick every move in a fight yourself, so they had nothing left to do.":
    "Postać → SI i zestawy znika: edytor reguł walki, kody do udostępniania, tester SI i zestawy ekwipunku. W walce każdy ruch wybierasz sam, więc nie miały już nic do roboty.",
  "You wear one set of gear. If you had several loadouts, you keep the gear of the one you had on; nothing leaves your pack.":
    "Nosisz jeden zestaw ekwipunku. Jeśli miałeś kilka zestawów, zostaje ekwipunek tego, który miałeś na sobie; nic nie znika z plecaka.",
  "Old saves load as before. Hint texts that pointed to AI & Loadouts now give a real tip instead.":
    "Stare zapisy wczytują się jak dawniej. Podpowiedzi, które odsyłały do SI i zestawów, dają teraz prawdziwą radę.",
});
