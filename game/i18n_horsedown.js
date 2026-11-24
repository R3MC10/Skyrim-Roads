/* i18n_horsedown.js: Polish for downed horses (horses.js, horseback.js, the stables card, the trip line, reminders,
   the fight picture's "Downed" tag) and their patch note. Loaded before i18n.js: exact lines go in I18N_EXTRA.words,
   sentences with names or numbers in I18N_STORY.pats ({0}, {1} are filled in from the English). The Polish names
   "the horse" (koń) instead of using the horse's name as the subject, so it reads right for any name. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const WORDS = {
    Downed: "Powalony", "\uE12D Downed": "\uE12D Koń powalony", "Horse downed": "Koń powalony", Hurt: "Ranny",
    "Horse back on its feet": "Koń znów na nogach", "Ready to ride again.": "Znów gotowy do jazdy.", "You fight on foot.": "Walczysz pieszo.",
    "Only a stablehand can tend your horse. Find a stables.": "Tylko stajenny może opatrzyć konia. Znajdź stajnię.",
    "Sleep, wait a few hours, or have a stablehand tend them.": "Prześpij się, odczekaj kilka godzin albo poproś stajennego, by go opatrzył.",
    "Horses never die: at 0 health they are downed. A downed horse stays with you and still carries your things, but you can't ride it until it gets back up (a few hours, a night's sleep, or a stablehand's care).":
      "Konie nigdy nie giną: przy 0 zdrowia padają. Powalony koń zostaje z tobą i dalej niesie twoje rzeczy, ale nie pojedziesz na nim, dopóki nie wstanie (kilka godzin, noc snu albo opieka stajennego).",
    "A cart lies on its side, its horse long gone.": "Wóz leży na boku, po koniu ani śladu.",
    // patch note
    "Horses get downed, never lost": "Konie padają, ale nigdy ich nie tracisz",
    "When your horse runs out of health it is now downed instead of limping off to some far-away stables. It stays with you, still carries your things, and shows as Downed on the stables card, on your trip and in the fight picture.":
      "Gdy twojemu koniowi skończy się zdrowie, teraz pada, zamiast kuśtykać do odległej stajni. Zostaje z tobą, dalej niesie twoje rzeczy i jest oznaczony jako Powalony na karcie stajni, w podróży i na obrazku walki.",
    "You can't ride a downed horse, so you travel on foot. It gets back up by itself after about 6 hours (30 real minutes), as soon as you sleep, or straight away if any stablehand tends it for 50 gold.":
      "Na powalonym koniu nie pojedziesz, więc idziesz pieszo. Koń wstaje sam po około 6 godzinach (30 prawdziwych minut), gdy tylko się prześpisz, albo od razu, jeśli dowolny stajenny opatrzy go za 50 sztuk złota.",
    "If your horse goes down in a mounted fight, you're thrown clear and the fight goes on with you on foot. The fall alone never finishes you.":
      "Jeśli koń padnie w walce konnej, zostajesz zrzucony, a walka toczy się dalej, już pieszo. Sam upadek nigdy cię nie dobije.",
    "A horse that was resting at a stables in an old save comes back to you, downed. Every player in a party has their own horse and their own downed state.":
      "Koń, który w starym zapisie odpoczywał w stajni, wraca do ciebie jako powalony. Każdy gracz w drużynie ma własnego konia i jego własny stan.",
  };
  for (const [k, v] of Object.entries(WORDS)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(
    [/^(.+) brings (.+) down! (.+) is downed\. You're thrown clear \((−\d+)\) and fight on foot$/, (m) => `${m[1]} powala konia (${m[2]})! Zostajesz zrzucony (${m[4]}) i walczysz dalej pieszo`],
    [/^Tend \((\d+) gold\)$/, (m) => `Opatrz (${m[1]} zł)`],
    [/^Tend (.+) \((\d+) gold\)$/, (m) => `Opatrz konia (${m[1]}) (${m[2]} zł)`],
    [/^on foot · (.+) is downed and limps beside you$/, (m) => `pieszo · koń (${m[1]}) jest powalony i kuleje obok ciebie`],
    [/^Back up in about (\d+) min · or a stablehand in (.+)$/, (m) => `Wstanie za ok. ${m[1]} min · albo stajenny w: ${m[2]}`],
    [/^(.+) is downed$/, (m) => `Koń powalony: ${m[1]}`],
    [/^\uE12D (.+) is back on their feet$/, (m) => `\uE12D Koń znów na nogach: ${m[1]}`],
  );
  if (typeof I18N_STORY !== "undefined") {
    const PATS = [
      ["\uE12D {0} is downed!", "\uE12D Koń pada ({0})!"],
      ["They limp along beside you but can't be ridden until they're back on their feet (about {0} hours, a night's sleep, or a stablehand's care).",
        "Kuleje obok ciebie, ale nie pojedziesz na nim, dopóki nie wstanie (około {0} godzin, noc snu albo opieka stajennego)."],
      ["{0} is downed and can't carry a rider yet.", "Koń ({0}) jest powalony i nie uniesie jeszcze jeźdźca."],
      ["\uE12D {0} is downed and limps behind you.", "\uE12D Koń ({0}) jest powalony i kuleje za tobą."],
      ["{0} is downed: they limp along beside you but can't be ridden.", "Koń ({0}) jest powalony: kuleje obok ciebie, ale nie da się na nim jechać."],
      ["Back on their feet in about {0} hours ({1} min), or after you sleep.", "Wstanie za około {0} godz. ({1} min) albo gdy się prześpisz."],
      ["Back on their feet in about {0} hour ({1} min), or after you sleep.", "Wstanie za około {0} godz. ({1} min) albo gdy się prześpisz."],
      ["The stablehand gets {0} back on their feet with poultices and a warm mash.", "Stajenny stawia konia ({0}) na nogi okładami i ciepłą paszą."],
      ["Ready to ride.", "Gotowy do jazdy."],
      ["The stablehand patches {0} up.", "Stajenny opatruje konia ({0})."], ["Good as new.", "Jak nowy."],
      ["{0} is fit and well.", "Koń ({0}) jest zdrowy i w formie."],
      ["The stablehand wants {0} gold for the poultices.", "Stajenny chce {0} sztuk złota za okłady."],
      ["\uE12D The {0} hurts {1} ({2}).", "\uE12D {0} rani konia ({1}) ({2})."],
    ];
    for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
  }
})();
