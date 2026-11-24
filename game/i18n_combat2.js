/* i18n_combat2.js: Polish for combat2.js (the immersive fight screen): the setting and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Fight screen": "Ekran walki",
    "Immersive": "Wciągający",
    "Classic": "Klasyczny",
    "Round": "Runda",
    // patch note
    "A fight screen that feels like a game": "Ekran walki jak z prawdziwej gry",
    "The fight is now one big scene that fills the screen. Everything you need sits right in it, so nothing scrolls, on phones and on PC.":
      "Walka to teraz jedna duża scena na cały ekran. Wszystko, czego potrzebujesz, jest w niej, więc nic się nie przewija, na telefonie i na PC.",
    "Your health is a glowing orb in the corner with magicka and stamina curving round it; a striped band shows how much the foe is about to take. Slim bars float over your hero's head.":
      "Twoje zdrowie to świecąca kula w rogu, a magia i wytrzymałość biegną łukiem wokół niej; paskowany pas pokazuje, ile zaraz zabierze wróg. Cienkie paski unoszą się nad głową bohatera.",
    "The foe's name, health, statuses and what it plans next hang over its head. Stunned foes wobble with stars, big hits flash and shake the picture.":
      "Imię wroga, zdrowie, stany i to, co planuje, wiszą nad jego głową. Ogłuszeni wrogowie chwieją się w gwiazdkach, mocne ciosy błyskają i trzęsą obrazem.",
    "Moves are round drawn buttons with their AP cost on the rim. Magic and Items open as a drawer of cards over the fight. End Turn glows when you're out of AP and still shows the guard you keep.":
      "Ruchy to okrągłe rysowane przyciski z kosztem AP na brzegu. Magia i Przedmioty otwierają się jako szuflada kart nad walką. Koniec tury świeci, gdy skończą ci się AP, i dalej pokazuje, ile osłony zachowasz.",
    "Turn order is a ribbon of little portraits at the top, followers sit in small cards at the side, and the fight log is a short fading feed (tap it for the whole log).":
      "Kolejność tur to wstęga małych portretów u góry, towarzysze siedzą w małych kartach z boku, a dziennik walki to krótki znikający pasek (dotknij, by zobaczyć całość).",
    "Prefer the old look? Settings → Fight screen → Classic.": "Wolisz stary wygląd? Ustawienia → Ekran walki → Klasyczny.",
    "Every buff and debuff now shows as a little icon on whoever has it: you, followers, party members and foes. Armour spells, wards, healing over time, potions, shouts and powers, poison, burning, frost, bleeding, fear, paralysis and the rest. Each shows the turns left, and tapping or hovering tells you what it does.":
      "Każde wzmocnienie i osłabienie widać teraz jako małą ikonkę na tym, kto je ma: na tobie, towarzyszach, członkach drużyny i wrogach. Czary pancerza, osłony, leczenie w czasie, mikstury, okrzyki i moce, trucizna, podpalenie, mróz, krwawienie, strach, paraliż i cała reszta. Każda pokazuje, ile tur zostało, a dotknięcie lub najechanie mówi, co robi.",
    "When one lands or wears off, a short word floats up over that fighter: \"+Oakflesh\", \"Poisoned\", \"Burning fades\".":
      "Gdy coś zadziała albo minie, nad walczącym unosi się krótki napis: \"+Dębowa skóra\", \"Zatruty\", \"Podpalenie mija\".",
    // buff and debuff icons (fxicons.js)
    "Armour spell": "Czar pancerza", "Ward": "Osłona", "Healing": "Leczenie", "Cloak": "Płaszcz", "Rune": "Runa", "Bound weapon": "Przywołana broń",
    "Invisible": "Niewidzialny", "Sneak attack": "Atak z ukrycia", "Courage": "Odwaga", "Summon": "Przywołaniec", "Reanimate": "Ożywienie", "Guard": "Garda",
    "Berserker Rage": "Szał berserkera", "Adrenaline Rush": "Przypływ adrenaliny", "Highborn": "Wysoko urodzony", "Ancestor's Wrath": "Gniew przodków",
    "Histskin": "Skóra Hista", "Dragonskin": "Smocza skóra", "Ethereal": "Eteryczność", "Dragon Aspect": "Aspekt smoka", "Elemental Fury": "Furia żywiołów",
    "Storm Call": "Wezwanie burzy", "Beast Form": "Postać bestii", "Vampire Lord": "Wampirzy lord", "Poisoned weapon": "Zatruta broń",
    "Fortify": "Wzmocnienie", "Regenerate": "Regeneracja", "Resist": "Odporność", "Blessing": "Błogosławieństwo",
    "Poisoned": "Zatruty", "Burning": "Podpalenie", "Bleeding": "Krwawienie", "Chilled": "Wychłodzenie", "Jolted": "Porażenie", "Dazed": "Oszołomienie",
    "Worn out": "Wyczerpanie", "Sunlight": "Słońce", "Vampirism": "Wampiryzm", "Sanguinare Vampiris": "Sanguinare Vampiris",
    "Paralyzed": "Sparaliżowany", "Stunned": "Ogłuszony", "Staggered": "Zachwiany", "Slowed": "Spowolniony", "Won't fight": "Nie walczy", "Afraid": "Przerażony",
    "Rattled": "Roztrzęsiony", "Shaken": "Wstrząśnięty", "Disarmed": "Rozbrojony", "Marked for Death": "Naznaczony śmiercią", "Dragonrend": "Smoczy rozpruwacz",
    "Burning ground": "Płonąca ziemia", "Soul Trap": "Pułapka dusz", "In the air": "W powietrzu", "Weak": "Słabość", "Resists": "Odporny",
    "Winding up": "Bierze zamach", "Shield raised": "Tarcza w górze", "In the shadows": "W cieniu", "Enraged": "Wściekły",
    "Stoneskin": "Kamienna skóra", "Blessed weapon": "Błogosławiona broń", "Ward of Sparks": "Osłona iskier", "Heroism": "Bohaterstwo", "Knocked down": "Powalony",
    "Oakflesh": "Dębowa skóra", "Stoneflesh": "Kamienna skóra", "Ironflesh": "Żelazna skóra", "Ebonyflesh": "Hebanowa skóra", "Dragonhide": "Smocza łuska",
    "Your next blow is a sneak attack and does extra damage.": "Twój następny cios to atak z ukrycia i zadaje więcej obrażeń.",
    "Stunned by your shield: loses its next turn.": "Ogłuszony tarczą: traci następną turę.",
    "Staggered: loses its next move.": "Zachwiany: traci następny ruch.",
    "Soul Trap: if it dies now, its soul fills one of your empty soul gems.": "Pułapka dusz: jeśli teraz zginie, jego dusza wypełni jeden z twoich pustych kamieni dusz.",
    "Flying: out of reach of most blows. Dragonrend or Unrelenting Force brings it down.": "Lata: poza zasięgiem większości ciosów. Smoczy rozpruwacz albo Nieustępliwa siła ściągnie go na ziemię.",
    "Knocked down: out of this fight, but not dead. A Rescue spell brings them back; they get up after the fight.": "Powalony: wypada z tej walki, ale nie ginie. Czar ratunku go podnosi; wstaje po walce.",
  });
  const tr = (s) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(s) ?? s : s);
  const n = (k, one, few, many) => (+k === 1 ? one : +k % 10 >= 2 && +k % 10 <= 4 && (+k % 100 < 10 || +k % 100 >= 20) ? few : many);
  const tury = (k) => `${k} ${n(k, "tura", "tury", "tur")}`;
  I18N_EXTRA.pat.push(
    [/^(.+) fades$/, (m) => `${tr(m[1])} mija`],
    [/^Poisoned: you lose (\d+) health each time a foe acts, (\d+) more times\. A Cure Poison potion or winning the fight ends it\.$/, (m) => `Zatruty: tracisz ${m[1]} zdrowia za każdym razem, gdy wróg działa, jeszcze ${m[2]} razy. Kończy to mikstura leczenia trucizny albo wygrana walka.`],
    [/^Burning: −(\d+) health (each turn|at the end of the round), (\d+) more\.$/, (m) => `Podpalenie: −${m[1]} zdrowia ${m[2] === "each turn" ? "co turę" : "na koniec rundy"}, jeszcze ${m[3]}.`],
    [/^Bleeding: −(\d+) health (each turn|each time a foe acts), (\d+) more\.$/, (m) => `Krwawienie: −${m[1]} zdrowia ${m[2] === "each turn" ? "co turę" : "za każdym razem, gdy wróg działa"}, jeszcze ${m[3]}.`],
    [/^Paralyzed: can't act for (\d+) more turns?\.$/, (m) => `Sparaliżowany: nie może działać jeszcze przez ${tury(m[1])}.`],
    [/^Slowed: its blows do half damage, (\d+) more turns?\.$/, (m) => `Spowolniony: jego ciosy zadają połowę obrażeń, jeszcze ${tury(m[1])}.`],
    [/^Afraid: it cowers instead of fighting, (\d+) more turns?\.$/, (m) => `Przerażony: kuli się zamiast walczyć, jeszcze ${tury(m[1])}.`],
    [/^Out of the fight: calmed or running scared, it does nothing for (\d+) more turns?\.$/, (m) => `Poza walką: uspokojony albo ucieka w strachu, nic nie robi jeszcze przez ${tury(m[1])}.`],
    [/^(.+): \+(\d+) armour for the rest of the fight, so blows hurt less\.$/, (m) => `${tr(m[1])}: +${m[2]} pancerza do końca walki, więc ciosy bolą mniej.`],
    [/^(.+): \+(\d+) health at the end of each round, (\d+) more\.$/, (m) => `${tr(m[1])}: +${m[2]} zdrowia na koniec każdej rundy, jeszcze ${m[3]}.`],
    [/^Ward: soaks (\d+) more damage from spells(?: \(of (\d+)\))?(.*)$/, (m) => `Osłona: pochłonie jeszcze ${m[1]} obrażeń od czarów${m[2] ? ` (z ${m[2]})` : ""}${m[3] && m[3] !== "." ? m[3] : "."}`],
    [/^Guard up: the next blows do (\d+)% less\.$/, (m) => `Garda: następne ciosy zadają o ${m[1]}% mniej.`],
  );
})();
