/* i18n_runecraft.js: Polish for the Rune table (runecraft.js), its perks and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat.
   Spell names and what each crafted spell does are registered by runecraft.js itself (I18N.add). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const RUNE = {
    Fire: "Ogień", Frost: "Mróz", Shock: "Porażenie", Poison: "Trucizna", Healing: "Leczenie", Ward: "Osłona",
    Bolt: "Pocisk", Touch: "Dotyk", "Rune trap": "Runa-pułapka", Cloak: "Płaszcz", Area: "Obszar", "Over time": "W czasie",
    Chain: "Łańcuch", Lingering: "Trwałość", Slow: "Spowolnienie", Piercing: "Przebicie", Cheap: "Oszczędność", Quick: "Szybkość",
  };
  const low = { fire: "ognia", frost: "mrozu", shock: "porażenia", poison: "trucizny", healing: "leczenia", ward: "osłony",
    bolt: "pocisku", touch: "dotyku", "rune trap": "runy-pułapki", cloak: "płaszcza", area: "obszaru", "over time": "działania w czasie" };
  Object.assign(I18N_EXTRA.words, RUNE, {
    // the screen
    "Rune table": "Stół run", Craft: "Twórz", Runes: "Runy", "Your spells": "Twoje zaklęcia", Element: "Żywioł", Delivery: "Forma", Modifier: "Modyfikator",
    "(one at most)": "(najwyżej jeden)", "(two at most)": "(najwyżej dwa)",
    "Not found yet": "Jeszcze nieznaleziona", Learned: "Poznana", Forget: "Zapomnij", "Where:": "Gdzie:",
    "Power budget": "Budżet mocy", "Next tier at": "Następny poziom przy", "Never stronger than the best bought spell of your tier.": "Nigdy silniejsze niż najlepsze kupne zaklęcie twojego poziomu.",
    Power: "Moc", Magicka: "Magia", Gold: "Złoto", magicka: "magii", gold: "złota", runes: "run",
    "Less power, less magicka.": "Mniej mocy, mniej magii.", "Spell list full": "Lista zaklęć pełna", "Spell name": "Nazwa zaklęcia",
    "College of Winterhold": "Kolegium Zimowej Twierdzy", "Arcane enchanter": "Stół zaklinacza", Close: "Zamknij",
    "No rune spells yet. Craft one on the first page.": "Nie masz jeszcze zaklęć z run. Stwórz jedno na pierwszej stronie.",
    "Pick an element.": "Wybierz żywioł.", "Pick a delivery.": "Wybierz formę.", "You haven't found that rune yet.": "Nie znalazłeś jeszcze tej runy.",
    "One modifier (the Spellwright perk allows two).": "Jeden modyfikator (atut Twórca zaklęć pozwala na dwa).", "Two modifiers at most.": "Najwyżej dwa modyfikatory.",
    "You need the Rune table: at the College of Winterhold or an arcane enchanter.": "Potrzebujesz stołu run: w Kolegium Zimowej Twierdzy albo przy stole zaklinacza.",
    "You can keep 10 rune spells. Forget one first.": "Możesz mieć 10 zaklęć z run. Najpierw zapomnij jedno.",
    "You don't have that spell.": "Nie masz tego zaklęcia.",
    "Cast it from the Magic menu.": "Rzucaj je z menu Magii.",
    // what the runes do
    "Burns. Sets foes burning and lights oil into burning ground.": "Pali. Podpala wrogów i zamienia olej w płonącą ziemię.",
    "Chills and slows. A power attack on a chilled foe Shatters it.": "Mrozi i spowalnia. Potężny cios w zmrożonego wroga go Roztrzaskuje.",
    "Jolts. Drains mages and can interrupt their spells.": "Razi. Wysysa magów i może przerwać ich zaklęcia.",
    "Eats at the living. Undead, machines and atronachs barely feel it.": "Zżera żywych. Nieumarli, maszyny i atronachy ledwie to czują.",
    "Mends your wounds.": "Leczy twoje rany.", "A shield against spells, breath and enchanted blows.": "Tarcza przed zaklęciami, smoczym oddechem i zaklętymi ciosami.",
    "One hit at range.": "Jedno trafienie z daleka.", "A hit up close. Costs a little less magicka than a bolt.": "Trafienie z bliska. Kosztuje trochę mniej magii niż pocisk.",
    "A trap on the ground. Goes off when the foe moves onto it, before it can strike.": "Pułapka na ziemi. Wybucha, gdy wróg na nią wejdzie, zanim zdąży uderzyć.",
    "Wraps around you and works every round.": "Otula cię i działa co rundę.", "A burst that also hits the other foes in that row (both rows at Master).": "Wybuch, który trafia też innych wrogów w tym szeregu (na poziomie Mistrza oba szeregi).",
    "Works every round for a few rounds.": "Działa co rundę przez kilka rund.",
    "Arcs again for half, and jumps to the other foes in that row. Healing jumps to your allies.": "Przeskakuje drugi raz za połowę i sięga innych wrogów w tym szeregu. Leczenie przeskakuje na sojuszników.",
    "Leaves a burn for 3 rounds. Fire leaves burning ground. Healing leaves a glow, wards mend.": "Zostawia piekący ślad na 3 rundy. Ogień zostawia płonącą ziemię. Leczenie zostawia poświatę, osłony same się odnawiają.",
    "Numbs the foe so it acts later. Frost adds another chill (Shatter).": "Otępia wroga, więc działa później. Mróz dokłada kolejne zmrożenie (Roztrzaskanie).",
    "Ignores resistances and the foe's own wards.": "Omija odporności i osłony wroga.", "Much less magicka, a little weaker.": "Dużo mniej magii, trochę słabsze.",
    "Never misses, and staggers now and then.": "Nigdy nie chybia i od czasu do czasu zachwiewa wrogiem.",
    // where to find them
    "Read a fire spell tome.": "Przeczytaj księgę zaklęcia ognia.", "Read a frost spell tome.": "Przeczytaj księgę zaklęcia mrozu.", "Read a shock spell tome.": "Przeczytaj księgę zaklęcia porażenia.",
    "Clear a Dwemer ruin (Falmer venom), or reach Alchemy 40.": "Oczyść ruiny Dwemerów (jad Falmerów) albo osiągnij Alchemię 40.",
    "Read a healing spell tome.": "Przeczytaj księgę zaklęcia leczenia.", "Read a ward spell tome.": "Przeczytaj księgę zaklęcia osłony.", "Everyone knows this one.": "Tę zna każdy.",
    "Read a rune spell tome, or do the College's first lesson.": "Przeczytaj księgę zaklęcia runy albo odbądź pierwszą lekcję w Kolegium.",
    "Read a cloak spell tome, or learn 2 Words of Power at word walls.": "Przeczytaj księgę zaklęcia płaszcza albo poznaj 2 Słowa Mocy przy ścianach słów.",
    "Read a tome for a spell that hits a group (Fireball, Chain Lightning…), or clear a Dwemer ruin.": "Przeczytaj księgę zaklęcia na grupę (Kula ognia, Łańcuch błyskawic…) albo oczyść ruiny Dwemerów.",
    "Read a tome for a wall or a healing circle, or join the College's dig at Saarthal.": "Przeczytaj księgę ściany albo kręgu leczenia, albo dołącz do wykopalisk Kolegium w Saarthal.",
    "Clear 2 Dwemer ruins (their arc coils), or read Chain Lightning.": "Oczyść 2 ruiny Dwemerów (ich cewki łukowe) albo przeczytaj Łańcuch błyskawic.",
    "Join the College's dig at Saarthal, or read a wall spell tome.": "Dołącz do wykopalisk Kolegium w Saarthal albo przeczytaj księgę zaklęcia ściany.",
    "Learn 3 Words of Power at word walls.": "Poznaj 3 Słowa Mocy przy ścianach słów.", "Clear a Dwemer ruin (their focusing lenses).": "Oczyść ruiny Dwemerów (ich soczewki skupiające).",
    "Do the College's first lesson for Faralda.": "Odbądź pierwszą lekcję Faraldy w Kolegium.", "Learn a Word of Power at a word wall.": "Poznaj Słowo Mocy przy ścianie słów.",
    // in fights
    "burning ground": "płonąca ziemia", "the ground burns": "ziemia płonie", "it lingers": "obrażenia trwają", "chilled deeper": "mróz wnika głębiej", numbed: "otępiony",
    staggers: "zachwiał się", "the light jumps to an ally": "światło przeskakuje na sojusznika", "a healing glow stays": "zostaje lecząca poświata", "it mends itself": "sama się odnawia",
    "Burning ground": "Płonąca ziemia", "Lingering frost": "Trwały mróz", "Lingering shock": "Trwałe porażenie", "Lingering poison": "Trwała trucizna",
    // perks
    "Rune Scholar": "Uczony run", Spellwright: "Twórca zaklęć", "Runic Echo": "Runiczne echo",
    "Spells you craft at the Rune table get a 5/10% bigger power budget. [OURS]": "Zaklęcia tworzone przy stole run mają o 5/10% większy budżet mocy. [NASZE]",
    "Spells you craft at the Rune table can carry two modifiers. [OURS]": "Zaklęcia tworzone przy stole run mogą mieć dwa modyfikatory. [NASZE]",
    "Your crafted cloaks, walls and healing circles last a round longer, and a crafted rune trap re-arms once at half strength. [OURS]": "Twoje stworzone płaszcze, ściany i kręgi leczenia trwają rundę dłużej, a stworzona runa-pułapka raz odnawia się z połową mocy. [NASZE]",
    // patch note
    "Rune crafting: make your own spells": "Runy: twórz własne zaklęcia",
    "A new Rune table at the College of Winterhold and at every arcane enchanter: build your own spell from an element, a delivery and a modifier.": "Nowy stół run w Kolegium Zimowej Twierdzy i przy każdym stole zaklinacza: zbuduj własne zaklęcie z żywiołu, formy i modyfikatora.",
    "Elements: fire, frost, shock, poison, healing and ward. Deliveries: bolt, touch, rune trap, cloak, area and over time. Modifiers: chain, lingering, slow, piercing, cheap and quick.": "Żywioły: ogień, mróz, porażenie, trucizna, leczenie i osłona. Formy: pocisk, dotyk, runa-pułapka, płaszcz, obszar i działanie w czasie. Modyfikatory: łańcuch, trwałość, spowolnienie, przebicie, oszczędność i szybkość.",
    "You find runes as you play: reading spell tomes, learning Words of Power at word walls, clearing Dwemer ruins and doing the College's tasks. The Runes page tells you where to look for the ones you're missing.": "Runy znajdujesz w trakcie gry: czytając księgi zaklęć, poznając Słowa Mocy przy ścianach słów, oczyszczając ruiny Dwemerów i wykonując zadania Kolegium. Strona Runy podpowiada, gdzie szukać brakujących.",
    "How strong your spell can be depends on your Destruction or Restoration skill. A crafted spell is never stronger than the best spell you can buy at your level, it's just made your way. Turn the power down to save magicka.": "To, jak silne może być twoje zaklęcie, zależy od umiejętności Zniszczenia albo Przywrócenia. Stworzone zaklęcie nigdy nie jest silniejsze niż najlepsze zaklęcie do kupienia na twoim poziomie, jest po prostu zrobione po twojemu. Zmniejsz moc, żeby oszczędzać magię.",
    "Every spell gets its own name (or name it yourself) and its own drawn icon. It shows in the Magic tab and works in both kinds of fight.": "Każde zaklęcie dostaje własną nazwę (albo nazwij je sam) i własną rysowaną ikonę. Widać je w zakładce Magia i działa w obu rodzajach walki.",
    "Frost spells chill, so a power attack Shatters the foe. Lingering fire leaves burning ground. Poison barely touches undead and machines.": "Zaklęcia mrozu mrożą, więc potężny cios Roztrzaskuje wroga. Trwały ogień zostawia płonącą ziemię. Trucizna ledwie rusza nieumarłych i maszyny.",
    "New perks: Rune Scholar (a bigger power budget), Spellwright (two modifiers on one spell) and Runic Echo (crafted cloaks and walls last longer, rune traps re-arm once).": "Nowe atuty: Uczony run (większy budżet mocy), Twórca zaklęć (dwa modyfikatory w jednym zaklęciu) i Runiczne echo (stworzone płaszcze i ściany trwają dłużej, runy-pułapki raz się odnawiają).",
    "Heists in the big cities": "Skoki w wielkich miastach",
    "The Coming next list is up to date: painted backdrops, hold crises, bonds and spell crafting are in the game now.": "Lista „Wkrótce” jest aktualna: malowane tła, kryzysy w regionach, więzi i tworzenie zaklęć są już w grze.",
    "The old spell combining at the College is still there.": "Stare łączenie zaklęć w Kolegium wciąż jest dostępne.",
  });
  const runeNames = Object.keys(RUNE).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const tr = (t) => { try { return (typeof I18N !== "undefined" && I18N.tr(t)) || t; } catch (e) { return t; } };
  const list = (s) => s.split(", ").map((k) => RUNE[k] || k).join(", ");
  I18N_EXTRA.pat.push(
    [/^(\S+ )?chilled: (\d+)$/, (m) => `${m[1] || ""}zmrożony: ${m[2]}`],   // the frost hit line (perkfx.js), bought spells too
    [/^You trace the runes and bind them: "(.+)" \((\d+) gold\)\. Cast it from the Magic menu\.(.*)$/,
      (m) => `Kreślisz runy i wiążesz je: „${tr(m[1])}” (${m[2]} złota). Rzucaj je z menu Magii.${m[3] ? " " + tr(m[3].trim()) : ""}`],
    [/^New runes? for the Rune table: (.+)\.$/, (m) => `${m[1].includes(", ") ? "Nowe runy" : "Nowa runa"} do stołu run: ${list(m[1])}.`],
    [/^(.+?) New runes? for the Rune table: (.+)\.$/, (m) => `${tr(m[1])} ${m[2].includes(", ") ? "Nowe runy" : "Nowa runa"} do stołu run: ${list(m[2])}.`],
    [/^You let "(.+)" fade from memory\.$/, (m) => `Pozwalasz, by „${tr(m[1])}” uleciało z pamięci.`],
    [/^The work takes (\d+) gold\. You have (\d+)\.$/, (m) => `Ta praca kosztuje ${m[1]} złota. Masz ${m[2]}.`],
    [/^(Fire|Frost|Shock|Poison|Healing|Ward) can't be cast as (.+)\.$/, (m) => `${RUNE[m[1]]} nie da się rzucić w formie ${low[m[2]] || m[2]}.`],
    [/^(Chain|Lingering|Slow|Piercing|Cheap|Quick) doesn't fit (fire|frost|shock|poison|healing|ward) (.+)\.$/, (m) => `${RUNE[m[1]]} nie pasuje do ${low[m[2]]} w formie ${low[m[3]] || m[3]}.`],
    [new RegExp(`^(${runeNames}): (.+)$`), (m) => `${RUNE[m[1]]}: ${tr(m[2])}`],
    [/^arcs again (\d+)$/, (m) => `przeskakuje drugi raz: ${m[1]}`],
    [/^the light jumps to (\d+) allies$/, (m) => `światło przeskakuje na ${m[1]} sojuszników`],
    [/^ward mends \+(\d+)$/, (m) => `osłona odnawia się +${m[1]}`],
    [/^(.+) II$/, (m) => { const r = tr(m[1]); return r !== m[1] ? r + " II" : null; }],
  );
})();
