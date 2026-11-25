/* i18n_itemgames.js: Polish for item moves in fights (minigame.js [itemgames]: shield bash, staffs, oil flask) and
   poisons in fights (poisonfight.js): the game hints, the fight lines, the Items menu, the hotbar picker, the
   tooltip and move preview lines and the patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const W = (t) => { if (typeof I18N === "undefined") return t; try { const r = I18N.tr(t); return r == null ? t : r; } catch (e) { return t; } };
  Object.assign(I18N_EXTRA.words, {
    // the minigames
    "Slam as your shield meets the foe": "Uderz, gdy tarcza dosięga wroga",
    "Throw in the bright zone": "Rzuć w jasnej strefie",
    "Shield bash": "Uderzenie tarczą",
    "soaked a round longer": "wróg nasiąka o turę dłużej",
    "most of it splashes on the ground": "większość rozlewa się po ziemi",
    // poisons in a fight
    "Coat": "Pokryj",
    "Needs a weapon": "Potrzebna broń",
    "Already coated": "Broń już pokryta",
    "Slow": "Spowolnienie",
    "rounds": "tur",
    "No potions, scrolls or poisons.": "Brak mikstur, zwojów i trucizn.",
    "Coating uses the poison up. Bows coat their arrows.": "Pokrycie zużywa truciznę. Z łukiem pokrywasz strzały.",
    "Potions, scrolls and poisons: drink, read or coat your weapon, or ★ one to pin it to the quick slots.": "Mikstury, zwoje i trucizny: wypij, przeczytaj albo pokryj broń, lub oznacz ★, by przypiąć do szybkich miejsc.",
    "Coat your weapon with a poison": "Pokryj broń trucizną",
    // patch note
    "Shield bash minigame, poisons in fights": "Minigra uderzenia tarczą, trucizny w walce",
    "Shield bash now has its own quick game in turn-based fights: slam as your shield meets the foe. A Perfect hits harder and gives Might and Haste, a Miss hits softer. Guard had the same problem and works again too.":
      "Uderzenie tarczą ma teraz własną szybką grę w walkach turowych: uderz, gdy tarcza dosięga wroga. Perfekcyjne bije mocniej i daje Moc i Pośpiech, chybione bije słabiej. Garda miała ten sam problem i też znowu działa.",
    "A staff now draws the rune of its spell's school instead of the sword bar, and scrolls draw their spell's rune.":
      "Kostur rysuje teraz runę szkoły swojego czaru zamiast paska miecza, a zwoje runę swojego czaru.",
    "Throwing an oil flask is a quick game too: a Perfect throw keeps the foe soaked a round longer, a miss splashes most of it on the ground (a round shorter).":
      "Rzut flaszką oleju to też szybka gra: perfekcyjny rzut trzyma wroga nasiąkniętego o turę dłużej, chybiony rozlewa większość po ziemi (o turę krócej).",
    "Poisons work in fights: open Items and tap Coat (or put the poison on your hotbar). It takes one move, uses the poison up, and your next hit delivers it. Bows coat their arrows. Not in Beast Form, and not while your weapon is still coated.":
      "Trucizny działają w walce: otwórz Przedmioty i stuknij Pokryj (albo daj truciznę na pasek). Zajmuje to jeden ruch, zużywa truciznę, a następne trafienie ją zadaje. Z łukiem pokrywasz strzały. Nie w postaci bestii i nie, póki broń jest jeszcze pokryta.",
    "Holding or resting on a poison shows what your next hit will carry.": "Przytrzymanie lub najechanie na truciznę pokazuje, co zada następne trafienie.",
    "In party fights a Perfect from the minigame now adds its bonus too.": "W walkach drużyny perfekcyjna minigra też dodaje teraz swój bonus.",
  });
  I18N_EXTRA.pat.push(
    [/^You coat your (weapon|arrows) with (.+?)\. The next hit delivers it$/, (m) => `Pokrywasz ${m[1] === "arrows" ? "strzały" : "broń"}: ${W(m[2])}. Następne trafienie ją zada`],
    [/^You coat your (weapon|arrows) with (.+?)\. The next hits deliver it$/, (m) => `Pokrywasz ${m[1] === "arrows" ? "strzały" : "broń"}: ${W(m[2])}. Dwa następne trafienia ją zadadzą`],
    [/^Poison of (.+?)( \(\+\d+\))?$/, (m) => `Trucizna: ${W(m[1])}${m[2] || ""}`],
    [/^(\d+) left · coats your weapon$/, (m) => `zostało: ${m[1]} · pokrywa broń`],
    [/^Poison · (\d+) left$/, (m) => `Trucizna · zostało: ${m[1]}`],
    [/^Your next hit also delivers: (.+)$/, (m) => `Następne trafienie zada też: ${m[1]}`],
    [/^Your next 2 hits also deliver: (.+)$/, (m) => `Dwa następne trafienia zadadzą też: ${m[1]}`],
  );
})();
