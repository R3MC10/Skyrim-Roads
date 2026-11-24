/* i18n_levelup.js: Polish for levelup.js (skill notices, the LEVEL UP moment, the three pillars, the prompt) and its
   patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, number lines in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Level up!": "Awans!",
  "Choose what grows": "Wybierz, co rośnie",
  "Decide later": "Zdecyduję później",
  "Choose Health, Magicka or Stamina": "Wybierz Zdrowie, Magię albo Wytrzymałość",
  "Health": "Zdrowie", "Magicka": "Magia", "Stamina": "Wytrzymałość",
  "Levelling up feels like Skyrim": "Awans jak w Skyrim",
  "When a skill goes up you now see it near the top of the screen: \"One-Handed increased to 36\" with a thin bar for the skill, and your level bar under it filling up, so you always know how close the next level is.":
    "Gdy umiejętność rośnie, widzisz to u góry ekranu: „Broń jednoręczna: wzrost do 36” z cienkim paskiem umiejętności, a pod nim napełnia się pasek poziomu, więc zawsze wiesz, jak blisko jest następny poziom.",
  "Reaching a new level is a proper moment: a big LEVEL UP with your new level number, the bar fills to the end and starts again.":
    "Nowy poziom to prawdziwa chwila: wielki napis AWANS z numerem poziomu, pasek napełnia się do końca i zaczyna od nowa.",
  "Open Skills (from the compass or the Character screen) with a level-up waiting and it asks first, like Skyrim: three pillars, Health, Magicka or Stamina, each +10. Stamina also adds +5 carry weight. Every level still gives a perk point too.":
    "Otwórz Umiejętności (z kompasu albo z ekranu Postaci), gdy czeka awans, a najpierw zapyta, jak w Skyrim: trzy filary, Zdrowie, Magia albo Wytrzymałość, każdy +10. Wytrzymałość dodaje też +5 udźwigu. Każdy poziom nadal daje też punkt atutu.",
  "You can choose later. Level-ups wait for you and stack up, and the compass shows a glowing \"Level up\" on Skills and on your level bar until you spend them.":
    "Możesz wybrać później. Awanse czekają i się sumują, a kompas pokazuje świecący napis „Awans” przy Umiejętnościach i na pasku poziomu, dopóki ich nie wydasz.",
  "Skill books and trainers count the same way as using a skill, so every skill point moves your level bar.":
    "Księgi umiejętności i trenerzy liczą się tak samo jak używanie umiejętności, więc każdy punkt umiejętności przesuwa pasek poziomu.",
  "Other players see your Health, Magicka and Stamina next to your level in the list of travellers.":
    "Inni gracze widzą twoje Zdrowie, Magię i Wytrzymałość obok twojego poziomu na liście podróżnych.",
  "Nothing changes for your hero: you keep your level, your perks and every choice you already made.":
    "Dla twojego bohatera nic się nie zmienia: zachowujesz poziom, atuty i każdy wybór, którego już dokonałeś.",
});
(() => {
  const sk = (n) => (typeof I18N !== "undefined" && I18N.SKILLS && I18N.SKILLS[n]) || n;
  const ATTR = { health: "zdrowia", magicka: "magii", stamina: "wytrzymałości" };
  I18N_EXTRA.pat.push(
    [/^(.+?) increased to (\d+)$/, (m) => `${sk(m[1])}: wzrost do ${m[2]}`],
    [/^(\d+) level-ups to spend$/, (m) => `Awanse do wydania: ${m[1]}`],
    [/^(\d+) level-ups waiting$/, (m) => `Czekające awanse: ${m[1]}`],
    [/^Each gives \+(\d+) to one of these$/, (m) => `Każdy daje +${m[1]} do jednego z nich`],
    [/^(\d+) perk points? to spend$/, (m) => `Punkty atutów do wydania: ${m[1]}`],
    [/^Carry weight (\d+) → (\d+)$/, (m) => `Udźwig ${m[1]} → ${m[2]}`],
    [/^Level (\d+)$/, (m) => `Poziom ${m[1]}`],
    [/^\+(\d+) (health|magicka|stamina)(?: and \+(\d+) carry weight)?$/, (m) => `+${m[1]} ${ATTR[m[2]]}${m[3] ? ` i +${m[3]} udźwigu` : ""}`],
    [/^You reached level (\d+)! Open Skills to choose what grows\.$/, (m) => `Osiągasz poziom ${m[1]}! Otwórz Umiejętności i wybierz, co rośnie.`],
  );
})();
