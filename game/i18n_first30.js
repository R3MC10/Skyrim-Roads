/* i18n_first30.js: Polish for the opening quest line (first30.js: the goal card, the steps, the two fights and their
   rewards), and the patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the steps
    "Trouble at the Mill": "Kłopoty przy młynie",
    "A bandit is shaking down the workers at Riverwood's mill. Chase him off.": "Bandyta nęka robotników przy młynie w Riverwood. Przegoń go.",
    "Chase off the bandit": "Przegoń bandytę",
    "A Better Fit": "Lepiej leży",
    "The bandit dropped leather armour, better than your hide. Put it on.": "Bandyta upuścił skórzany pancerz, lepszy niż twój z surowej skóry. Załóż go.",
    "Put it on": "Załóż",
    "On to Whiterun": "Do Whiterun",
    "Alvor says the Jarl of Whiterun must hear about the dragon. Walk to Whiterun.": "Alvor mówi, że jarl Whiterun musi usłyszeć o smoku. Idź do Whiterun.",
    "The Jarl's Ear": "Ucho jarla",
    "Tell Jarl Balgruuf about the dragon in Dragonsreach.": "Opowiedz jarlowi Balgruufowi o smoku w Smoczej Przystani.",
    "Warn the Jarl": "Ostrzeż jarla",
    "Growing Stronger": "Coraz silniejszy",
    "You reached level 2. Choose what grows, then spend your perk point on a skill you use.": "Masz poziom 2. Wybierz, co rośnie, a potem wydaj punkt atutu na umiejętność, której używasz.",
    "Level up": "Awansuj", "Pick a perk": "Wybierz atut",
    "The Bandit Chief": "Herszt bandytów",
    "The Jarl wants the bandit chief at Chillfurrow Farm gone. He winds up huge blows: guard when he does.": "Jarl chce się pozbyć herszta bandytów z farmy Chillfurrow. Bierze potężne zamachy: kiedy to robi, zasłoń się.",
    "Face the bandit chief": "Stań do walki z hersztem",
    "Word Spreads": "Wieść się niesie",
    "Go back to the Jarl in Whiterun for your reward.": "Wróć do jarla w Whiterun po nagrodę.",
    "See the Jarl": "Idź do jarla",
    "Alvor, Riverwood": "Alvor, Riverwood",
    // the card
    "Skip the tutorial": "Pomiń samouczek", "Your goal": "Twój cel",
    "Tutorial skipped. Your quest goes on in the Journal.": "Samouczek pominięty. Twoje zadanie toczy się dalej w Dzienniku.",
    // the fights
    "Bandit lookout": "Bandycki czujka", "Krev the Skinner": "Krev Obdzieracz",
    "A bandit is shaking down the mill workers.": "Bandyta nęka robotników przy młynie.",
    "\"Whiterun sends a pup?\" The bandit chief hefts a heavy axe.": "„Whiterun przysyła szczeniaka?” Herszt bandytów unosi ciężki topór.",
    "The bandit knocks you down and runs off laughing. Catch your breath and try again: you lose nothing.": "Bandyta powala cię i ucieka ze śmiechem. Złap oddech i spróbuj jeszcze raz: nic nie tracisz.",
    "The bandit drops his gear and runs for the hills.": "Bandyta rzuca swój sprzęt i ucieka w góry.",
    "Krev knocks you flat and laughs. Get your breath back and try again: you lose nothing.": "Krev rozkłada cię na ziemi i się śmieje. Złap oddech i spróbuj jeszcze raz: nic nie tracisz.",
    "Krev the Skinner falls. The farm is safe.": "Krev Obdzieracz pada. Farma jest bezpieczna.",
    // (the fight hints' Polish sits with the others in overlays.js PL)
    // patch note
    "A guided start for new heroes": "Prowadzony start dla nowych bohaterów",
    "New characters no longer get a welcome popup and a pile of tips. Instead there's one short quest line, Before the Storm, with one goal at a time and one button that does it.":
      "Nowe postacie nie dostają już powitalnego okienka i stosu wskazówek. Zamiast tego jest jedna krótka linia zadań, Przed burzą, z jednym celem naraz i jednym przyciskiem, który go wykonuje.",
    "Your first fight starts a minute after you make your hero: a bandit at Riverwood's mill. While you fight, one short hint at a time shows you how to attack, how to read what the foe does next, and how to guard when it winds up a huge blow.":
      "Pierwsza walka zaczyna się minutę po stworzeniu bohatera: bandyta przy młynie w Riverwood. W trakcie walki krótkie wskazówki, jedna naraz, pokazują, jak atakować, jak czytać następny ruch wroga i jak się zasłonić, gdy bierze potężny zamach.",
    "Then you put on the armour he drops, walk to Whiterun, meet the Jarl, reach level 2, pick your first perk, and face a tougher bandit chief. The last step pays well and tells you what comes next.":
      "Potem zakładasz pancerz, który upuścił, idziesz do Whiterun, spotykasz jarla, zdobywasz poziom 2, wybierasz pierwszy atut i stajesz do walki z twardszym hersztem bandytów. Ostatni krok dobrze płaci i mówi, co dalej.",
    "Losing one of these fights costs nothing: you get back up at full health and try again.":
      "Przegrana w tych walkach nic nie kosztuje: wstajesz z pełnym zdrowiem i próbujesz jeszcze raz.",
    "On a PC the goal, its button and Skip sit in the quest tracker at the top right of the map.":
      "Na PC cel, jego przycisk i Pomiń są w śledzeniu zadania w prawym górnym rogu mapy.",
    "Don't need it? Tap Skip the tutorial on the goal card and the main quest carries on as before. Heroes you already have aren't affected.":
      "Nie potrzebujesz? Dotknij Pomiń samouczek na karcie celu, a główne zadanie toczy się jak wcześniej. Bohaterów, których już masz, to nie dotyczy.",
  });
  I18N_EXTRA.pat.push(
    [/^Step (\d+) of (\d+)$/, (m) => `Krok ${m[1]} z ${m[2]}`],
    [/^Go to ([A-Z][\w' -]+)$/, (m) => `Idź do: ${m[1]}`],
    [/^On the way to (.+?)( · about (\d+) min)?$/, (m) => `W drodze do: ${m[1]}${m[3] ? ` · ok. ${m[3]} min` : ""}`],
    [/^about (\d+) min$/, (m) => `ok. ${m[1]} min`],
    [/^Play the opening quest with (.+)$/, (m) => `Zagraj w zadanie na start jako ${m[1]}`],
  );
})();
