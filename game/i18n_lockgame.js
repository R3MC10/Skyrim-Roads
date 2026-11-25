/* i18n_lockgame.js: Polish for lockgame.js (the painted lockpicking game), its perk, its setting and its patch note.
   Loaded after i18n_story.js and before i18n.js; adds to I18N_STORY.ex (screen text) and I18N_EXTRA (patch notes).
   Keys are the exact English text. Never overwrites an older translation. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    "Lockpicking": "Otwieranie zamków", "Hold to turn": "Przytrzymaj, by przekręcić", "Leave it": "Zostaw", "Pick angle": "Kąt wytrycha",
    "A locked chest": "Zamknięta skrzynia", "The captain's strongbox": "Szkatuła kapitana", "The chest by the road": "Skrzynia przy drodze",
    "Drag on the lock to aim the pick, then hold Turn. If it shakes, let go before the pick snaps.":
      "Przeciągnij po zamku, by ustawić wytrych, potem przytrzymaj Przekręć. Gdy zamek drży, puść, zanim wytrych pęknie.",
    "Click. It's open.": "Klik. Otwarte.", "Your last pick snaps. The lock wins.": "Ostatni wytrych pęka. Zamek wygrywa.",
    "Snap! The pick breaks.": "Trzask! Wytrych pęka.", "Close… it gives a little. Ease off and nudge the pick.": "Blisko… trochę ustępuje. Puść i lekko przesuń wytrych.",
    "It won't budge. Let go and move the pick.": "Ani drgnie. Puść i przesuń wytrych.", "Turning…": "Obracam…", "Picks": "Wytrychy",
    "Unbreakable pick": "Niezniszczalny wytrych", "Steady Pick": "Pewna ręka",
    "When you pick a lock": "Przy otwieraniu zamków", "Mini-game": "Minigra", "Quick pick": "Szybkie otwieranie",
    "In the lockpicking game the sweet spot is 15/30% wider, and a pick bends 25/50% longer before it snaps.":
      "W minigrze otwierania zamków właściwe miejsce jest o 15/30% szersze, a wytrych wygina się o 25/50% dłużej, zanim pęknie.",
  };
  for (const k in PL) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = PL[k];
})();
// the patch note (patchnotes.js b194-lockgame)
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Painted lockpicking": "Malowane otwieranie zamków",
  "Picking a lock is now a painted close-up: a real lock on a chest, your pick and the tension wrench. Drag on the lock to aim the pick (it points at your finger), then hold Turn.":
    "Otwieranie zamka to teraz malowane zbliżenie: prawdziwy zamek na skrzyni, twój wytrych i napinacz. Przeciągnij po zamku, by ustawić wytrych (wskazuje twój palec), potem przytrzymaj Przekręć.",
  "The lock shakes harder the further you are from the sweet spot. Keep forcing it and the pick bends, glows and snaps, with bits of metal flying. Turn it all the way and the shackle clicks open in a little burst of light.":
    "Im dalej od właściwego miejsca, tym mocniej zamek drży. Siłuj się dalej, a wytrych się wygnie, rozgrzeje i pęknie, sypiąc odłamkami. Przekręć do końca, a kabłąk odskoczy z kliknięciem i błyskiem światła.",
  "Every place has its own lock: Nordic knotwork in barrows and temples, Dwemer brass in the ruins, gilded locks in rich places and on master locks, steel on harder chests and plain iron elsewhere.":
    "Każde miejsce ma swój zamek: nordyckie sploty w kurhanach i świątyniach, krasnoludzki mosiądz w ruinach, złocone zamki w bogatych miejscach i na mistrzowskich zamkach, stal na trudniejszych skrzyniach, a zwykłe żelazo gdzie indziej.",
  "Your Lockpicking skill and perks still make the sweet spot wider, just like they made the old roll easier. New perk: Steady Pick (Lockpicking) makes it wider still and your picks last longer.":
    "Umiejętność otwierania zamków i atuty dalej poszerzają właściwe miejsce, tak jak wcześniej ułatwiały rzut. Nowy atut: Pewna ręka (Otwieranie zamków) poszerza je jeszcze bardziej, a wytrychy wytrzymują dłużej.",
  "Works with a finger on phones, and with the mouse or the keyboard on PC (A/D or the arrows to aim, Space to turn). Rather roll the dice? Settings → Crafting → When you pick a lock → Quick pick.":
    "Działa palcem na telefonie oraz myszką lub klawiaturą na PC (A/D albo strzałki, by celować, Spacja, by przekręcić). Wolisz rzut kośćmi? Ustawienia → Rzemiosło → Przy otwieraniu zamków → Szybkie otwieranie.",
});
