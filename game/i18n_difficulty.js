/* i18n_difficulty.js: Polish for difficulty.js (Story / Normal / Hard: Settings, the fight chip, the Party panel, hero
   creation) and its patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, hero creation's own words in
   I18N_CHARGEN ("diff:" keeps them apart from the brows). Never overwrites an older translation. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const W = {
    "Difficulty": "Poziom trudności", "Story": "Fabularny", "Hard": "Trudny",
    "Foes hit softer and fall sooner, and fight timing is easier. For enjoying the story.": "Wrogowie biją słabiej i padają szybciej, a wyczucie chwili w walce jest łatwiejsze. Dla tych, którzy chcą cieszyć się opowieścią.",
    "The game as it's meant to be played.": "Gra taka, jaka ma być.",
    "Foes hit harder, fight smarter and go for whoever is hurt. Timing is tighter.": "Wrogowie biją mocniej, walczą sprytniej i celują w rannych. Wyczucie chwili jest trudniejsze.",
    "XP, gold and loot are the same on every difficulty.": "Doświadczenie, złoto i łupy są takie same na każdym poziomie trudności.",
    "You can change it any time in Settings.": "Możesz go zmienić w każdej chwili w Ustawieniach.",
    "In your party the leader's setting counts": "W twojej drużynie liczy się ustawienie przywódcy",
    "your party leader's": "przywódcy twojej drużyny",
    "Your setting counts for the whole party.": "Twoje ustawienie obowiązuje całą drużynę.",
    "The leader's setting counts for the whole party.": "Ustawienie przywódcy obowiązuje całą drużynę.",
    // the guide's questions (guide.js)
    "Fights are too hard (or too easy). Can I change that?": "Walki są za trudne (albo za łatwe). Mogę to zmienić?",
    "Yes: Settings → Fights → Difficulty. Story makes foes softer, Hard makes them tougher and smarter. XP, gold and loot stay the same on all three. In a party, the leader's setting counts.":
      "Tak: Ustawienia → Walki → Poziom trudności. Fabularny osłabia wrogów, Trudny czyni ich twardszymi i sprytniejszymi. Doświadczenie, złoto i łupy są takie same na każdym poziomie. W drużynie liczy się ustawienie przywódcy.",
    // patch note
    "Pick your difficulty: Story, Normal or Hard": "Wybierz poziom trudności: Fabularny, Normalny albo Trudny",
    "Choose how tough fights are: Story, Normal or Hard. Pick it when you make a new hero, or change it any time in Settings → Fights → Difficulty.":
      "Wybierz, jak trudne są walki: Fabularny, Normalny albo Trudny. Wybierz go przy tworzeniu bohatera albo zmień w każdej chwili w Ustawienia → Walki → Poziom trudności.",
    "Story: foes hit softer, fall a bit sooner and fight plainly, and the timing games in fights are easier. Hard: foes hit harder, have a bit more health, use their tricks more and go for whoever is hurt; timing is tighter. Normal stays as it was.":
      "Fabularny: wrogowie biją słabiej, padają trochę szybciej i walczą prosto, a mini-gry w walce są łatwiejsze. Trudny: wrogowie biją mocniej, mają trochę więcej zdrowia, częściej używają swoich sztuczek i celują w rannych; wyczucie chwili jest trudniejsze. Normalny zostaje bez zmian.",
    "XP, gold and loot are the same on every difficulty. Hard is about danger, not longer fights.":
      "Doświadczenie, złoto i łupy są takie same na każdym poziomie. Trudny to więcej niebezpieczeństwa, nie dłuższe walki.",
    "In a party the leader's setting counts for everyone. The Party panel shows which one you're on.":
      "W drużynie ustawienie przywódcy obowiązuje wszystkich. Panel drużyny pokazuje, na jakim poziomie gracie.",
    "A fight keeps the difficulty it started with: changing it in the middle of a fight changes the next one. A small tag on the fight screen shows which one is on.":
      "Walka zachowuje poziom trudności, z jakim się zaczęła: zmiana w trakcie walki dotyczy dopiero następnej. Mała plakietka na ekranie walki pokazuje, który poziom jest włączony.",
    "World events, world bosses and fights against other players are the same for everyone (Normal).":
      "Wydarzenia świata, bossowie świata i walki z innymi graczami są takie same dla wszystkich (Normalny).",
  };
  for (const [k, v] of Object.entries(W)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  I18N_EXTRA.pat.push(
    [/^Difficulty: (Story|Normal|Hard)( \(your party leader's\))?\. (.+)$/, (m) => `Poziom trudności: ${{ Story: "Fabularny", Normal: "Normalny", Hard: "Trudny" }[m[1]]}${m[2] ? " (przywódcy twojej drużyny)" : ""}. ${W[m[3]] || m[3]}`],
  );
  if (typeof I18N_CHARGEN !== "undefined") {
    const C = { "diff:Story": "Fabularny", "diff:Normal": "Normalny", "diff:Hard": "Trudny" };
    for (const k of ["Difficulty", "XP, gold and loot are the same on every difficulty.", "You can change it any time in Settings.",
      "Foes hit softer and fall sooner, and fight timing is easier. For enjoying the story.", "The game as it's meant to be played.",
      "Foes hit harder, fight smarter and go for whoever is hurt. Timing is tighter."]) C[k] = W[k];
    for (const [k, v] of Object.entries(C)) if (!(k in I18N_CHARGEN)) I18N_CHARGEN[k] = v;
  }
})();
