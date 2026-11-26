/* i18n_threeap.js: Polish for build 350's 3 AP turns (tbfight.js, fightctl.js, fighttips.js, tbtips.js, followerai.js,
   the new perks in perkfx.js) and its patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines
   with numbers in I18N_EXTRA.pat. "AP" stays "AP" in Polish. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const tr = (s) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(s) ?? s : s);
  Object.assign(I18N_EXTRA.words, {
    // the fight screen and its tooltips
    "AP spent": "Wydane AP", "Spent": "Wydane", "AP a turn": "AP na turę",
    "You have 3 AP a turn. Most moves take 1 AP (the gold diamonds on each button); power attacks, big spells, dual casts and full shouts take 2.":
      "Masz 3 AP na turę. Większość ruchów zabiera 1 AP (złote romby na każdym przycisku); silne ataki, duże czary, podwójne rzucanie i pełne okrzyki zabierają 2.",
    "Moves also cost stamina or magicka (the coloured numbers), 50% more for the same move again in one turn. AP you don't spend become guard until your next turn: 10% less damage each, up to 30%.":
      "Ruchy kosztują też wytrzymałość albo magię (kolorowe liczby), o 50% więcej za ten sam ruch drugi raz w jednej turze. Niewydane AP stają się gardą do twojej następnej tury: każde to 10% mniej obrażeń, do 30%.",
    "No AP left": "Brak AP", "1 potion a turn": "1 mikstura na turę",
    "End your turn. AP you didn't spend become guard: 10% less damage each, up to 30%, until your next turn.":
      "Kończysz turę. Niewydane AP stają się gardą: każde to 10% mniej obrażeń, do 30%, aż do twojej następnej tury.",
    "Your target is already down: that move cost nothing": "Twój cel już leży: ten ruch nic nie kosztował",
    "No guard left: you spent all your AP": "Brak gardy: wydałeś wszystkie AP",
    "Knocked down: 1 AP goes into getting up": "Powalony: 1 AP idzie na wstanie",
    "You get back on your feet (1 AP)": "Podnosisz się z ziemi (1 AP)",
    "Takes 1 AP and ends your turn.": "Zabiera 1 AP i kończy turę.",
    "1 AP, no stamina": "1 AP, bez wytrzymałości", "2 AP, no magicka": "2 AP, bez magii",
    "They take their own turns: attacks, power attacks, guarding, spells and potions from their pack, 2 AP a turn (yours are 3): attacking, guarding or covering takes 1, a power attack or a big spell 2.":
      "Grają własne tury: ataki, silne ataki, garda, czary i mikstury z plecaka, 2 AP na turę (ty masz 3): atak, garda albo osłona zabiera 1, silny atak albo duży czar 2.",
    // new perks (perkfx.js)
    "Heavy Momentum": "Ciężki rozpęd", "Flowing Strikes": "Płynne ciosy", "Quick Draw": "Szybkie naciągnięcie",
    "Spell Weaving": "Tkanie czarów", "Swift Mending": "Szybkie leczenie", "Steady Guard": "Pewna garda",
    "Once a fight, a power attack costs only 1 AP instead of 2.": "Raz na walkę silny atak kosztuje tylko 1 AP zamiast 2.",
    "Once a fight, a power attack (or a two-blade flurry) costs only 1 AP instead of 2.": "Raz na walkę silny atak (albo grad ciosów dwoma ostrzami) kosztuje tylko 1 AP zamiast 2.",
    "Once a fight, a fully drawn aimed shot costs only 1 AP instead of 2.": "Raz na walkę w pełni naciągnięty celny strzał kosztuje tylko 1 AP zamiast 2.",
    "Once a fight, a big spell (Adept or higher, or a dual cast) costs only 1 AP instead of 2.": "Raz na walkę duży czar (od poziomu Adepta albo podwójnie rzucony) kosztuje tylko 1 AP zamiast 2.",
    "Every AP you don't spend on your turn gives 5% more guard (up to 10% more, so 40% at most).": "Każde AP, którego nie wydasz w swojej turze, daje 5% więcej gardy (do 10% więcej, więc najwyżej 40%).",
    // patch note (build 350)
    "3 AP a turn": "3 AP na turę",
    "Your turn now runs on 3 AP (action points), shown as gold diamonds. Most moves take 1 AP: a blow, a bow shot, guarding, a shield bash, a small spell, a short shout, a potion, catching your breath, a poison or a small scroll.":
      "Twoja tura działa teraz na 3 AP (punktach akcji), pokazanych jako złote romby. Większość ruchów zabiera 1 AP: cios, strzał z łuku, garda, uderzenie tarczą, mały czar, krótki okrzyk, mikstura, złapanie oddechu, trucizna albo mały zwój.",
    "Big moves take 2 AP: power attacks, spells of Adept level and up, dual casts, full three-word shouts, big scrolls and a beast's heavy moves. Every button shows its AP and goes grey when you can't pay for it.":
      "Duże ruchy zabierają 2 AP: silne ataki, czary od poziomu Adepta, podwójne rzucanie, pełne okrzyki z trzech słów, duże zwoje i ciężkie ruchy bestii. Każdy przycisk pokazuje swoje AP i szarzeje, gdy cię na niego nie stać.",
    "AP you don't spend become guard: 10% less damage for each one, up to 30%, and it lasts until your next turn. One potion a turn.":
      "Niewydane AP stają się gardą: każde to 10% mniej obrażeń, do 30%, i trwa to do twojej następnej tury. Jedna mikstura na turę.",
    "With a blade in each hand, one attack is a blow plus a quick left-hand follow-up. Poisons, bleeding and enchantments still land only once.":
      "Z ostrzem w każdej ręce jeden atak to cios i szybka poprawka lewą ręką. Trucizny, krwawienie i zaklęcia broni dalej działają tylko raz.",
    "If your target falls before your move lands, that move costs nothing. Followers get 2 AP a turn.":
      "Jeśli twój cel padnie, zanim twój ruch trafi, ten ruch nic nie kosztuje. Towarzysze mają 2 AP na turę.",
    "Six new perks: Heavy Momentum, Flowing Strikes and Quick Draw (once a fight, a power attack or an aimed shot for 1 AP), Spell Weaving and Swift Mending (once a fight, a big spell for 1 AP) and Steady Guard (more guard from AP you keep).":
      "Sześć nowych atutów: Ciężki rozpęd, Płynne ciosy i Szybkie naciągnięcie (raz na walkę silny atak albo celny strzał za 1 AP), Tkanie czarów i Szybkie leczenie (raz na walkę duży czar za 1 AP) oraz Pewna garda (więcej gardy z zachowanych AP).",
  });
  // perk texts end in " [OURS]" in perkfx.js: same Polish
  for (const k of Object.keys(I18N_EXTRA.words)) if (/^(Once a fight|Every AP you don't)/.test(k)) I18N_EXTRA.words[k + " [OURS]"] = I18N_EXTRA.words[k];
  I18N_EXTRA.pat.push(
    [/^Needs (\d) AP$/, (m) => `Potrzeba ${m[1]} AP`],
    [/^(\d) AP\.$/, (m) => `${m[1]} AP.`],
    [/^(\d+) AP a turn, speed (\d+)\.$/, (m) => `${m[1]} AP na turę, szybkość ${m[2]}.`],
    [/^(\d) AP · (.+)$/, (m) => `${m[1]} AP · ${tr(m[2])}`],
    [/^(.+) keeps their guard up$/, (m) => `${m[1]} trzyma gardę`],
  );
})();
