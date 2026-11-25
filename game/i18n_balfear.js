/* i18n_balfear.js: Polish for foecap.js (fear on bosses and elites, foes' own healing capped), the texts it changed
   (Battle Cry, Dismay, Aspect of Terror) and its patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "The foe flees in terror for 8 turns. Bosses shake it off after 2, elite foes after 3.":
      "Wróg ucieka w przerażeniu na 8 tur. Bossowie otrząsają się po 2, elitarni wrogowie po 3.",
    "Terror grips the foe: it stops fighting for 3/5/8 turns (bosses 2, elite foes 3). Dragons and the undead don't feel fear.":
      "Wroga ogarnia strach: przestaje walczyć na 3/5/8 tur (bossowie 2, elitarni wrogowie 3). Smoki i nieumarli nie znają strachu.",
    "Fear spells work on foes 6 levels higher and last a turn longer. Bosses and elite foes stay afraid of any fear or Battle Cry a turn longer too. [Skyrim]":
      "Zaklęcia strachu działają na wrogów o 6 poziomów wyższych i trwają turę dłużej. Bossowie i elitarni wrogowie też boją się każdego strachu i Okrzyku bojowego o turę dłużej. [Skyrim]",
    // patch note
    "Bosses don't run forever, healers don't heal forever": "Bossowie nie uciekają bez końca, uzdrowiciele nie leczą się bez końca",
    "Battle Cry and every other fear or \"stops fighting\" effect now hold a boss for 2 turns and an elite foe for 3. A boss can lose at most 3 turns a fight to fear, an elite 5. For the turns they shake off they stay rattled and hit 20% softer, so the shout still helps. Normal foes still run for the full time.":
      "Okrzyk bojowy i każdy inny strach albo efekt „przestaje walczyć” trzyma teraz bossa przez 2 tury, a elitarnego wroga przez 3. Boss może stracić przez strach najwyżej 3 tury w walce, elitarny wróg 5. Przez tury, z których się otrząsnął, jest wciąż roztrzęsiony i bije o 20% słabiej, więc okrzyk dalej pomaga. Zwykli wrogowie nadal uciekają na pełny czas.",
    "Foe mages and healers can't patch themselves back to full any more: their own healing stops at about two thirds of their health, adds up to at most a third of it in a whole fight, and a healing spell needs a few turns to come back. Potions and life drain count too.":
      "Wrodzy magowie i uzdrowiciele nie wyleczą się już do pełna: ich leczenie zatrzymuje się na mniej więcej dwóch trzecich zdrowia, przez całą walkę daje najwyżej jedną trzecią, a zaklęcie leczące potrzebuje kilku tur, żeby wrócić. Mikstury i wysysanie życia też się liczą.",
    "Aspect of Terror (Illusion) now also keeps bosses and elite foes afraid a turn longer.":
      "Aspekt grozy (Iluzja) sprawia teraz też, że bossowie i elitarni wrogowie boją się o turę dłużej.",
    // patch note b279 (engine.js: one blow takes at most 60% of a strong foe in instant fights)
    "No one-hit wins on strong foes": "Koniec wygranych jednym ciosem z silnymi wrogami",
    "With turn-based fights switched off, a strong foe (a troll, a vampire, a Thalmor patrol, an elite or a boss) can no longer drop to a single blow or spell from full health: one hit takes at most 60% of it. A foe that's already beaten down still falls to the blow that finishes it.":
      "Gdy walki turowe są wyłączone, silny wróg (troll, wampir, patrol Thalmoru, elitarny wróg albo boss) nie padnie już od jednego ciosu ani zaklęcia przy pełnym zdrowiu: jedno trafienie zabiera mu najwyżej 60%. Wróg, który jest już mocno poobijany, nadal pada od ciosu, który go dobija.",
    "The Sigil of Boethiah stays just as strong, it just can't turn a heavy power attack or a sneak blow into a one-hit win on a dangerous foe any more.":
      "Pieczęć Boethii jest tak samo silna, po prostu ciężki silny atak albo cios z ukrycia nie da już wygranej jednym ciosem z groźnym wrogiem.",
  });
  I18N_EXTRA.pat.push(
    [/^(.+) shakes off the fear$/, (m) => `${m[1]} otrząsa się ze strachu`],
    [/^(.+) shakes it off$/, (m) => `${m[1]} otrząsa się`],
  );
})();
