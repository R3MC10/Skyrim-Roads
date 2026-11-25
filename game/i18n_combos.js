/* i18n_combos.js: Polish for reactions.js (combat combos and reactions) and the two boss moves it brings (bossfight.js:
   Withering Hex, Marked for Death). Loaded after i18n_story.js and before i18n.js; adds to I18N_STORY.ex, so the screen
   translator and the T/fmt helpers find it. Keys are the exact English text; "{0}" markers are filled in by the code. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // combo names, the banner
    "Shatter": "Roztrzaskanie", "Burning ground": "Płonąca ziemia", "Exploit": "Wykorzystanie", "Precision": "Precyzja",
    "Stagger exploit": "Cios w zachwianego", "Intercept": "Przechwycenie", "Cleansed": "Oczyszczono", "Combo": "Kombinacja", "Reaction": "Reakcja",
    "Shatter!": "Roztrzaskanie!", "Burning ground!": "Płonąca ziemia!", "Exploit!": "Wykorzystanie!", "Precision!": "Precyzja!",
    "Stagger exploit!": "Cios w zachwianego!", "Intercept!": "Przechwycenie!",
    // what a combo does, in the log
    "Shatter! +{0}, the frost breaks": "Roztrzaskanie! +{0}, lód pęka",
    "Team shatter! +{0}, the frost breaks": "Roztrzaskanie drużynowe! +{0}, lód pęka",
    "Exploit! +{0} on the stunned foe, and it keeps reeling": "Wykorzystanie! +{0} w ogłuszonego wroga, a on dalej się zatacza",
    "Exploit! +{0} on the stunned foe": "Wykorzystanie! +{0} w ogłuszonego wroga",
    "Precision! A critical shot at the mark: +{0}": "Precyzja! Krytyczny strzał w oznaczony cel: +{0}",
    "Stagger exploit! +{0} while it's off balance": "Cios w zachwianego! +{0}, póki traci równowagę",
    "Burning ground! The oil catches fire: +{0}": "Płonąca ziemia! Olej zajmuje się ogniem: +{0}",
    "burning ground {0}": "płonąca ziemia {0}",
    "Intercept! You take the blow meant for {0} (−{1})": "Przechwycenie! Przyjmujesz cios wymierzony w: {0} (−{1})",
    // your moves
    "Oil flask": "Flaszka oleju", "Mark target": "Oznacz cel", "Cover allies": "Osłoń sojuszników",
    "You throw an oil flask: the {0} is soaked. Fire will set the ground ablaze.": "Rzucasz flaszkę oleju: {0} ocieka olejem. Ogień podpali ziemię.",
    "You mark the {0}: arrows and bolts at it land as critical hits": "Oznaczasz cel ({0}): strzały i bełty trafiają w niego krytycznie",
    "You stand guard over your friends: blows meant for them come to you": "Stajesz w obronie przyjaciół: ciosy wymierzone w nich spadają na ciebie",
    "You have no oil flask": "Nie masz flaszki oleju",
    "Throw an oil flask ({0} left): the foe is soaked for {1} rounds. Then any fire (a spell, a fire weapon, Fire Breath) sets the ground ablaze and burns it for {2} rounds.":
      "Rzuć flaszkę oleju (zostało: {0}): wróg ocieka olejem przez {1} rundy. Potem każdy ogień (czar, ognista broń, Ognisty Oddech) podpala ziemię i pali go przez {2} rundy.",
    "Mark the foe for {0} rounds: the next {1} arrows or bolts at it, yours or a friend's, land as critical hits.":
      "Oznacz wroga na {0} rundy: następne strzały i bełty w niego ({1}), twoje czy przyjaciela, trafią krytycznie.",
    "Defensive stance, ends your turn: until your next turn, blows meant for your friends come to you, {0}% softer.":
      "Postawa obronna, kończy twoją turę: do twojej następnej tury ciosy wymierzone w przyjaciół spadają na ciebie, o {0}% słabsze.",
    "Already soaked": "Już ocieka olejem", "No oil flasks": "Brak flaszek oleju", "Already marked": "Już oznaczony",
    "No bow in your group": "Nikt w drużynie nie ma łuku", "Not enough stamina": "Za mało wytrzymałości", "No one to cover": "Nie ma kogo osłaniać",
    // the icon on a move that would set a combo off
    "Combo: Shatter. A power attack on a chilled foe breaks the frost for big extra damage.": "Kombinacja: Roztrzaskanie. Silny atak na zmrożonego wroga rozbija lód i zadaje dużo dodatkowych obrażeń.",
    "Combo: Burning ground. Fire sets the oil on the foe ablaze; the ground burns it for a few rounds.": "Kombinacja: Płonąca ziemia. Ogień podpala olej na wrogu, a ziemia pali go przez kilka rund.",
    "Combo: Exploit. A power attack on a foe shield-bashed this round hits harder and keeps it reeling.": "Kombinacja: Wykorzystanie. Silny atak na wroga uderzonego tarczą w tej rundzie bije mocniej i dalej go zatacza.",
    "Combo: Precision. The foe is marked: your arrows land as critical hits.": "Kombinacja: Precyzja. Wróg jest oznaczony: twoje strzały trafiają krytycznie.",
    "Combo: Stagger exploit. The shout knocked it off balance: your blows land harder.": "Kombinacja: Cios w zachwianego. Krzyk wytrącił go z równowagi: twoje ciosy bolą bardziej.",
    "Cleanse: this washes the boss's hex off you.": "Oczyszczenie: to zmywa z ciebie klątwę bossa.",
    // chips under the foe's health
    "Soaked in oil: fire sets the ground ablaze.": "Ocieka olejem: ogień podpali ziemię.",
    "Burning ground: {0} a round for {1} more rounds.": "Płonąca ziemia: {0} na rundę jeszcze przez {1} rundy.",
    "Marked: arrows and bolts at it land as critical hits.": "Oznaczony: strzały i bełty trafiają w niego krytycznie.",
    "Bashed this round: a power attack now is an Exploit.": "Uderzony tarczą w tej rundzie: silny atak teraz to Wykorzystanie.",
    "Off balance: the next blow is a Stagger exploit.": "Traci równowagę: następny cios to Cios w zachwianego.",
    "You cover your friends: blows meant for them come to you.": "Osłaniasz przyjaciół: ciosy wymierzone w nich spadają na ciebie.",
    // the oil flask
    "Oil Flask": "Flaszka oleju",
    "Throw it in a fight to soak the foe in oil. Then any fire sets the ground ablaze (Burning ground).": "Rzuć ją w walce, żeby oblać wroga olejem. Potem każdy ogień podpala ziemię (Płonąca ziemia).",
    // perks (perkfx.js)
    "Cold Breaker": "Łamacz lodu", "Tactician": "Taktyk", "Bodyguard": "Obrońca",
    "Shatter (a power attack on a chilled foe) hits 40% harder, and it can take a bigger bite out of the foe.": "Roztrzaskanie (silny atak na zmrożonego wroga) bije o 40% mocniej i może zabrać wrogowi większy kawał zdrowia.",
    "Combo setups last a round longer: oil, a mark, a bash or a shout leave the foe open one more round, and burning ground burns one round more.": "Przygotowania do kombinacji trwają rundę dłużej: olej, oznaczenie, uderzenie tarczą albo krzyk zostawiają wroga odsłoniętego o rundę dłużej, a płonąca ziemia pali o rundę dłużej.",
    "When you cover your allies, the blows you take for them hit another 25% softer (60% in all).": "Kiedy osłaniasz sojuszników, ciosy, które przyjmujesz za nich, są o kolejne 25% słabsze (razem 60%).",
  };
  for (const k in PL) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = PL[k];   // never overwrite an older translation
})();
// the patch note (patchnotes.js b192) and the Coming next line
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Combat combos and teamwork": "Kombinacje w walce i praca zespołowa",
  "Follower and horse bonds, and spell crafting": "Więzi z towarzyszami i końmi oraz tworzenie zaklęć",
  "Set a foe up, then cash in. Freeze it and hit it with a power attack to Shatter the frost for big extra damage. Shield-bash it and follow with a power attack this round for an Exploit: it hits harder and the foe keeps reeling. Knock it off balance with a shout and your next blows land harder.":
    "Przygotuj wroga, a potem to wykorzystaj. Zamroź go i uderz silnym atakiem, żeby Roztrzaskać lód i zadać dużo dodatkowych obrażeń. Uderz go tarczą i dołóż silny atak w tej samej rundzie, a będzie Wykorzystanie: cios bije mocniej, a wróg dalej się zatacza. Wytrąć go z równowagi krzykiem, a twoje następne ciosy zabolą bardziej.",
  "New in the general store: the Oil Flask. Throw it at a foe, then any fire (a spell, a fire weapon, Fire Breath) sets the ground ablaze and burns it for a few rounds.":
    "Nowość w sklepach ogólnych: Flaszka oleju. Rzuć nią we wroga, a potem każdy ogień (czar, ognista broń, Ognisty Oddech) podpali ziemię i będzie go palić przez kilka rund.",
  "New moves when they fit: Mark target (when you or a friend has a bow, the next three arrows at it are critical hits) and Cover allies (blows meant for your friends come to you, softer).":
    "Nowe ruchy, kiedy pasują: Oznacz cel (gdy ty albo przyjaciel macie łuk, trzy następne strzały w niego trafiają krytycznie) i Osłoń sojuszników (ciosy wymierzone w przyjaciół spadają na ciebie, słabsze).",
  "Combos are made for teamwork: one friend freezes, another shatters, and done by two different fighters a combo hits harder. Your follower and the Smart AI (Auto) look for combos too.":
    "Kombinacje są stworzone do gry zespołowej: jeden przyjaciel zamraża, drugi roztrzaskuje, a kombinacja zrobiona przez dwie różne osoby bije mocniej. Twój towarzysz i Sprytna SI (Auto) też szukają kombinacji.",
  "A move that would set off a combo right now glows and gets a small icon, and a short banner shows when a combo lands.":
    "Ruch, który teraz odpaliłby kombinację, świeci się i ma małą ikonkę, a gdy kombinacja wejdzie, pojawia się krótki napis.",
  "Bosses have two new big moves you see a turn ahead: Withering Hex (wash it off with a potion or a healing spell) and Marked for Death, which goes for a friend unless you cover them.":
    "Bossowie mają dwa nowe wielkie ataki widoczne turę wcześniej: Wyniszczającą klątwę (zmyjesz ją miksturą albo czarem leczenia) i Naznaczenie na śmierć, które spada na przyjaciela, chyba że go osłonisz.",
  "Three new perks: Cold Breaker (Two-Handed: Shatter hits harder), Tactician (Speechcraft: setups last a round longer) and Bodyguard (Blocking: covering friends hurts you less).":
    "Trzy nowe atuty: Łamacz lodu (Broń dwuręczna: Roztrzaskanie bije mocniej), Taktyk (Elokwencja: przygotowania trwają rundę dłużej) i Obrońca (Blokowanie: osłanianie przyjaciół mniej cię boli).",
});
