/* i18n_spells.js: Polish for every spell: the spellbook.js names, the numbers in the Magic menu and spell tomes
   ("40 fire damage", "burns 6/turn for 3 turns", "+160 armor for the fight"...), the out-of-fight spells, the support
   spells, the new fight lines (Frenzy, area spells) and the spell chips on the fight screen (spellfx.js).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, number lines in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const T = (n) => { n = +n; return `${n} ${n === 1 ? "tura" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "tury" : "tur"}`; };
  const TB = (n) => { n = +n; return `${n} ${n === 1 ? "turę" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "tury" : "tur"}`; };   // "na 3 tury", "przez 5 tur"
  const FG = (n) => { n = +n; return `${n} ${n === 1 ? "walka" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "walki" : "walk"}`; };
  const FGB = (n) => { n = +n; return `${n} ${n === 1 ? "walkę" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "walki" : "walk"}`; };
  const EL = { fire: "od ognia", frost: "od mrozu", shock: "od porażenia", bound: "magicznych", sun: "od słońca" };
  const SK = { "One-Handed": "broń jednoręczna", "Two-Handed": "broń dwuręczna", Archery: "łucznictwo" };
  const WT = { sword: "Miecz", battleaxe: "Topór bojowy", "bow (no arrows needed)": "Łuk (bez strzał)", bow: "Łuk", dagger: "Sztylet", greatsword: "Wielki miecz", mace: "Buzdygan", "war axe": "Topór", warhammer: "Młot bojowy" };
  const N = (t) => { if (typeof I18N === "undefined") return t; const r = I18N.tr(t); return r == null ? t : r; };
  const E = "(fire|frost|shock)";

  Object.assign(I18N_EXTRA.words, {
    // spell names (spellbook.js)
    "Cinder Spray": "Rozprysk żaru", Hailstones: "Grad", "Static Snap": "Trzask wyładowania", "Searing Brand": "Palące piętno",
    Thunderclap: "Grzmot", "Healing Hands": "Lecznicze dłonie", "Heal Other": "Uleczenie innych", "Grand Heal Other": "Wielkie uleczenie innych",
    "Circle of Protection": "Krąg ochrony", "Vampire's Bane": "Zguba wampirów", "Bane of the Undead": "Zguba nieumarłych",
    "Soothing Light": "Kojące światło", Magelight: "Magiczne światło", Telekinesis: "Telekineza", Equilibrium: "Równowaga",
    Waterbreathing: "Oddychanie pod wodą", Featherweight: "Lekkość pióra", "Stone Shell": "Kamienna skorupa",
    "Bound Dagger": "Przywołany sztylet", "Flaming Familiar": "Płonący chowaniec", "Conjure Spectral Archer": "Przyzwanie widmowego łucznika",
    "Conjure Seeker": "Przyzwanie poszukiwacza", "Banish Daedra": "Odesłanie daedry", "Command Daedra": "Władza nad daedrą",
    "Dread Whisper": "Szept grozy", "Soothing Song": "Kojąca pieśń", Rally: "Zryw", Frenzy: "Szał", Mayhem: "Chaos",
    "Flame Blade": "Płonące ostrze", "Frost Blade": "Mroźne ostrze", "Spark Blade": "Iskrzące ostrze", "Ward of Sparks": "Osłona iskier",
    Shelter: "Schronienie", "Stoneskin Touch": "Dotyk kamiennej skóry", "Ironskin Touch": "Dotyk żelaznej skóry", Heroism: "Bohaterstwo",
    "Veil Other": "Zasłona dla innych", "Bound Arms": "Przywołany oręż", "Guardian Spirit": "Duch opiekuńczy", "Soul Shield": "Tarcza duszy",
    Rescue: "Ratunek", "Detect Dead": "Wykrycie umarłych", "Absorb Magicka": "Pochłonięcie magii", "Reflect Spell": "Odbicie zaklęcia",
    "Divine Intervention": "Boska interwencja", "Mystic Bulwark": "Mistyczny bastion",
    // pieces of the Magic menu numbers
    jolts: "poraża", slows: "spowalnia", "not dragons": "nie na smoki", "next blow is a sneak attack": "następny cios to atak z ukrycia",
    "fills an empty soul gem if it dies": "napełnia pusty kamień dusz, jeśli zginie",
    "If the foe dies, its soul fills an empty soul gem": "Jeśli wróg zginie, jego dusza napełni pusty kamień dusz",
    // out-of-fight spells
    "Out of fights: better odds against dungeon traps for 6 in-game hours": "Poza walką: większa szansa na uniknięcie pułapek w lochach przez 6 godzin w grze",
    "Out of fights: +15% to stay hidden for 3 in-game hours": "Poza walką: +15% do pozostania w ukryciu przez 3 godziny w grze",
    "Out of fights: +10% to stay hidden for 6 in-game hours": "Poza walką: +10% do pozostania w ukryciu przez 6 godzin w grze",
    "Out of fights: up to 3 iron ore → silver, or silver ore → gold": "Poza walką: do 3 rud żelaza → srebro albo ruda srebra → złoto",
    "Out of fights: shows the way to your quest": "Poza walką: pokazuje drogę do twojego zadania",
    "Out of fights: cures diseases and removes harmful effects": "Poza walką: leczy choroby i usuwa szkodliwe efekty",
    "Out of fights: remember this spot": "Poza walką: zapamiętuje to miejsce",
    "Out of fights: return to your Mark from anywhere (every 6 in-game hours)": "Poza walką: wracasz do swojego Znaku z dowolnego miejsca (co 6 godzin w grze)",
    "Out of fights: a bright orb, much better odds against dungeon traps for 6 in-game hours": "Poza walką: jasna kula, dużo większa szansa na uniknięcie pułapek w lochach przez 6 godzin w grze",
    "Out of fights: breathe underwater; cold water won't chill you (+warmth for 3 in-game hours)": "Poza walką: oddychasz pod wodą; zimna woda cię nie wychłodzi (+ciepło przez 3 godziny w grze)",
    "Out of fights: sense the undead around you: +10% to stay hidden and better odds against traps for 3 in-game hours": "Poza walką: wyczuwasz nieumarłych wokół: +10% do pozostania w ukryciu i większa szansa na uniknięcie pułapek przez 3 godziny w grze",
    "Out of fights: the gods carry you to the nearest temple city": "Poza walką: bogowie przenoszą cię do najbliższego miasta ze świątynią",
    // spell chips on the fight screen (spellfx.js)
    "Soul Trap: if it dies, its soul fills an empty soul gem.": "Pułapka dusz: jeśli zginie, jego dusza napełni pusty kamień dusz.",
    // patch note
    "Every spell checked and fixed": "Każde zaklęcie sprawdzone i naprawione",
    "We cast every spell in the game (all 125, plus scrolls, staves and your follower's spells) in real fights to make sure each one does what it says.":
      "Rzuciliśmy każde zaklęcie w grze (wszystkie 125, do tego zwoje, kostury i zaklęcia twojego towarzysza) w prawdziwych walkach, żeby upewnić się, że każde robi to, co obiecuje.",
    "Fireball, Chain Lightning, Ice Storm, the storms and walls, Mass Paralysis, Hysteria, Harmony and Mayhem now reach the whole group: when foes come two or three at a time, the ones waiting behind take half the damage and stay paralyzed, afraid or calm. A one-target spell like Paralyze ends with the foe you cast it on.":
      "Kula ognia, Łańcuch błyskawic, Burza lodowa, burze i ściany, Masowy paraliż, Histeria, Harmonia i Chaos sięgają teraz całej grupy: gdy wrogowie przychodzą po dwóch lub trzech, ci czekający z tyłu dostają połowę obrażeń i dalej są sparaliżowani, przestraszeni albo spokojni. Zaklęcie na jeden cel, jak Paraliż, kończy się razem z wrogiem, na którego je rzuciłeś.",
    "Frenzy and Mayhem really drive foes mad now: instead of just standing there, they hurt themselves each turn.":
      "Szał i Chaos naprawdę doprowadzają wrogów do szaleństwa: zamiast tylko stać, ranią samych siebie co turę.",
    "Fear and Invisibility work against every foe: foes with special moves (wind-ups, heals) and bosses no longer ignore them.":
      "Strach i Niewidzialność działają na każdego wroga: wrogowie ze specjalnymi ruchami (zamachy, leczenie) i bossowie już ich nie ignorują.",
    "Paralysis holds a boss for 2 turns and an elite foe for 3, like fear and calm. Normal foes still freeze for the full time.":
      "Paraliż trzyma bossa przez 2 tury, a elitarnego wroga przez 3, tak jak strach i uspokojenie. Zwykli wrogowie nadal zastygają na pełny czas.",
    "Your flesh spell, cloak, summon, bound weapon and Invisibility now show as small chips under your bars, and calm, frenzy, fear, burning walls, runes and Soul Trap show under the foe. Hold a chip to see turns left.":
      "Zaklęcie skóry, płaszcz, przyzwanie, przywołana broń i Niewidzialność pokazują się teraz jako małe znaczki pod twoimi paskami, a uspokojenie, szał, strach, płonące ściany, runy i Pułapka dusz pod wrogiem. Przytrzymaj znaczek, żeby zobaczyć, ile tur zostało.",
    "Support spells (Heal Other, Flame Blade, Shelter, Banish Daedra, Equilibrium...) show their numbers in the Magic menu again.":
      "Zaklęcia wsparcia (Uleczenie innych, Płonące ostrze, Schronienie, Odesłanie daedry, Równowaga...) znów pokazują swoje liczby w menu Magii.",
    "Casting without enough magicka now says so, instead of talking about action points.":
      "Gdy brakuje magii na zaklęcie, gra mówi teraz właśnie to, a nie coś o punktach akcji.",
    "Playing in Polish? Every spell name and every number line in the Magic menu is translated now.":
      "Grasz po polsku? Każda nazwa zaklęcia i każda linijka z liczbami w menu Magii jest teraz przetłumaczona.",
    // fight lines
    "Not enough magicka": "Za mało magii", "Not enough action points": "Za mało punktów akcji",
    "it goes mad and turns on itself": "wpada w szał i rzuca się na samego siebie",
  });
  I18N_EXTRA.pat.push(
    // ---- Magic menu numbers
    [new RegExp(`^(\\d+) ${E} damage$`), (m) => `${m[1]} obrażeń ${EL[m[2]]}`],
    [/^burns (\d+)\/turn for (\d+) turns?$/, (m) => `podpala: ${m[1]}/turę przez ${TB(m[2])}`],
    [/^(\d+)% to hit$/, (m) => `${m[1]}% szans na trafienie`],
    [/^slows (\d+) turns?$/, (m) => `spowalnia na ${TB(m[1])}`],
    [/^(\d+)% interrupts casters$/, (m) => `${m[1]}% szans na przerwanie czarowania`],
    [/^(\d+)% freeze solid$/, (m) => `${m[1]}% szans na zamrożenie`],
    [/^(\d+)% stagger$/, (m) => `${m[1]}% szans na zachwianie`],
    [/^(\d+) sun damage \(undead only\)$/, (m) => `${m[1]} obrażeń od słońca (tylko nieumarli)`],
    [/^(\d+) sun damage to undead$/, (m) => `${m[1]} obrażeń od słońca dla nieumarłych`],
    [/^Heals (\d+) health \(out of fights too: (\d+)\)$/, (m) => `Leczy ${m[1]} zdrowia (także poza walką: ${m[2]})`],
    [/^\+(\d+) armor for the fight$/, (m) => `+${m[1]} pancerza na całą walkę`],
    [/^an ally: (\d+) damage a turn$/, (m) => `sojusznik: ${m[1]} obrażeń na turę`],
    [/^2 allies: (\d+) damage a turn$/, (m) => `2 sojuszników: ${m[1]} obrażeń na turę`],
    [/^(\d+) turns?$/, (m) => T(m[1])],
    [/^A summoned ally fights for you \((\d+) damage a turn\)$/, (m) => `Przyzwany sojusznik walczy za ciebie (${m[1]} obrażeń na turę)`],
    [/^foes up to level (\d+) stop fighting$/, (m) => `wrogowie do poziomu ${m[1]} przestają walczyć`],
    [/^Stops a foe up to level (\d+) from fighting$/, (m) => `Wróg do poziomu ${m[1]} przestaje walczyć`],
    [new RegExp(`^(\\d+) ${E} damage when the foe steps on it$`), (m) => `${m[1]} obrażeń ${EL[m[2]]}, gdy wróg na nią wejdzie`],
    [new RegExp(`^A trap rune: (\\d+) ${E} damage when the foe attacks you$`), (m) => `Runa-pułapka: ${m[1]} obrażeń ${EL[m[2]]}, gdy wróg cię zaatakuje`],
    [new RegExp(`^(\\d+) ${E} damage a turn$`), (m) => `${m[1]} obrażeń ${EL[m[2]]} na turę`],
    [new RegExp(`^(\\d+) ${E} damage to the foe every turn for (\\d+) turns$`), (m) => `${m[1]} obrażeń ${EL[m[2]]} dla wroga co turę przez ${TB(m[3])}`],
    [new RegExp(`^(\\d+) ${E} damage every turn for (\\d+) turns(, and slows)?$`), (m) => `${m[1]} obrażeń ${EL[m[2]]} co turę przez ${TB(m[3])}${m[4] ? " i spowalnia" : ""}`],
    [/^ward soaks (\d+) spell damage$/, (m) => `osłona pochłania ${m[1]} obrażeń od magii`],
    [/^A magic shield that soaks (\d+) damage from spells, breath and enchanted blows\. It stays up turn after turn until it breaks; cast it again to refill it$/,
      (m) => `Magiczna tarcza, która pochłania ${m[1]} obrażeń od zaklęć, smoczego oddechu i zaklętych ciosów. Trwa turę za turą, dopóki nie pęknie; rzuć ją ponownie, żeby ją odnowić`],
    [/^undead up to level (\d+) flee$/, (m) => `nieumarli do poziomu ${m[1]} uciekają`],
    [/^Undead up to level (\d+) flee: the fight ends, but they leave nothing behind$/, (m) => `Nieumarli do poziomu ${m[1]} uciekają: walka się kończy, ale nic po sobie nie zostawiają`],
    [/^\+(\d+) health a turn$/, (m) => `+${m[1]} zdrowia na turę`],
    [/^Heals (\d+) health every turn for (\d+) turns$/, (m) => `Leczy ${m[1]} zdrowia co turę przez ${TB(m[2])}`],
    [/^paralyzed (\d+) turns?$/, (m) => `paraliż na ${TB(m[1])}`],
    [/^(\d+)% \((\d+)% vs tough foes\)$/, (m) => `${m[1]}% (${m[2]}% na silnych wrogów)`],
    [/^The foe can't act for (\d+) turns \(dragons resist; tough foes sometimes\)$/, (m) => `Wróg nie może działać przez ${TB(m[1])} (smoki się opierają; silni wrogowie czasem)`],
    [/^(\d+) base damage \((One-Handed|Two-Handed|Archery)\)$/, (m) => `${m[1]} obrażeń bazowych (${SK[m[2]]})`],
    [/^An? (.+?) of light: (\d+) base damage, using (One-Handed|Two-Handed|Archery)$/, (m) => `${WT[m[1]] || m[1]} ze światła: ${m[2]} obrażeń bazowych, umiejętność: ${SK[m[3]]}`],
    [/^a slain foe up to level (\d+) rises$/, (m) => `zabity wróg do poziomu ${m[1]} powstaje`],
    [/^(\d+) fights$/, (m) => FG(m[1])],
    [/^A slain foe up to level (\d+) rises to fight beside you for (\d+) fights$/, (m) => `Zabity wróg do poziomu ${m[1]} powstaje i walczy u twego boku przez ${FGB(m[2])}`],
    [/^allies \+(\d+)% damage$/, (m) => `sojusznicy +${m[1]}% obrażeń`],
    [/^you \+(\d+) health$/, (m) => `ty +${m[1]} zdrowia`],
    [/^Your allies hit (\d+)% harder, and you get a little health$/, (m) => `Twoi sojusznicy biją o ${m[1]}% mocniej, a ty dostajesz trochę zdrowia`],
    [/^living foes up to level (\d+) flee$/, (m) => `żywi wrogowie do poziomu ${m[1]} uciekają`],
    [/^A living foe up to level (\d+) cowers for (\d+) turns$/, (m) => `Żywy wróg do poziomu ${m[1]} kuli się ze strachu przez ${TB(m[2])}`],
    [/^unseen (\d+) turns?$/, (m) => `niewidoczny przez ${TB(m[1])}`],
    [/^You vanish for (\d+) turns; your next blow is a sneak attack$/, (m) => `Znikasz na ${TB(m[1])}; twój następny cios to atak z ukrycia`],
    [/^Cast on the most hurt teammate: heals (\d+) health \(alone, it mends you a little or renews your summon\)$/,
      (m) => `Rzuć na najbardziej rannego towarzysza: leczy ${m[1]} zdrowia (gdy jesteś sam, trochę leczy ciebie albo odnawia twoje przyzwanie)`],
    [/^Out of fights: pull things to you: \+(\d+) carry weight for (\d+) in-game hours$/, (m) => `Poza walką: przyciągasz rzeczy do siebie: +${m[1]} udźwigu przez ${m[2]} godz. w grze`],
    [/^Out of fights: \+(\d+) carry weight for (\d+) in-game hours$/, (m) => `Poza walką: +${m[1]} udźwigu przez ${m[2]} godz. w grze`],
    [/^Turns (\d+) health into (\d+) magicka$/, (m) => `Zamienia ${m[1]} zdrowia w ${m[2]} magii`],
    [/^Sends a daedra up to level (\d+) back to Oblivion: the fight ends$/, (m) => `Odsyła daedrę do poziomu ${m[1]} z powrotem do Otchłani: walka się kończy`],
    [/^A daedra up to level (\d+) turns and fights for you for (\d+) turns$/, (m) => `Daedra do poziomu ${m[1]} przechodzi na twoją stronę i walczy za ciebie przez ${TB(m[2])}`],
    [/^Cast on your strongest teammate: their weapon adds (\d+) (fire|frost|shock|bound) damage a turn for (\d+) turns$/,
      (m) => `Rzuć na najsilniejszego towarzysza: jego broń zadaje dodatkowo ${m[1]} obrażeń ${EL[m[2]]} na turę przez ${TB(m[3])}`],
    [/^Cast on a teammate: foes that hit them take (\d+) shock damage, (\d+) turns$/, (m) => `Rzuć na towarzysza: wrogowie, którzy go trafią, dostają ${m[1]} obrażeń od porażenia, ${T(m[2])}`],
    [/^Cast on a teammate: a ward that soaks (\d+) damage$/, (m) => `Rzuć na towarzysza: osłona, która pochłania ${m[1]} obrażeń`],
    [/^Cast on a teammate: a ward that soaks (\d+) damage and throws (\d+)% back$/, (m) => `Rzuć na towarzysza: osłona, która pochłania ${m[1]} obrażeń i odbija ${m[2]}%`],
    [/^Cast on a teammate: they take (\d+)% less damage for (\d+) turns$/, (m) => `Rzuć na towarzysza: dostaje o ${m[1]}% mniej obrażeń przez ${TB(m[2])}`],
    [/^Cast on your strongest teammate: \+(\d+)% damage for (\d+) turns$/, (m) => `Rzuć na najsilniejszego towarzysza: +${m[1]}% obrażeń przez ${TB(m[2])}`],
    [/^Cast on a teammate: blows miss them for (\d+) turns$/, (m) => `Rzuć na towarzysza: ciosy go omijają przez ${TB(m[1])}`],
    [/^Brings a knocked-down teammate back into the fight with (\d+)% health$/, (m) => `Przywraca powalonego towarzysza do walki z ${m[1]}% zdrowia`],
    [/^(\d+) damage that you drink back as magicka \(more against mages\)$/, (m) => `${m[1]} obrażeń, które wypijasz z powrotem jako magię (więcej przeciw magom)`],
    // ---- fight lines
    [/^([^·]+?) lashes out at itself in a frenzy \((\d+)\)$/, (m) => `${N(m[1])} w szale rani sam siebie (${m[2]})`],
    [/^It already took (\d+) from your spells$/, (m) => `Już oberwał ${m[1]} od twoich zaklęć`],
    // ---- spell chips (spellfx.js)
    [/^Flesh spell: \+(\d+) armour for the rest of the fight\.$/, (m) => `Zaklęcie skóry: +${m[1]} pancerza do końca walki.`],
    [new RegExp(`^(.+?): (\\d+) ${E} damage to the foe each round, (\\d+) turns? left\\.$`), (m) => `${N(m[1])}: ${m[2]} obrażeń ${EL[m[3]]} dla wroga co rundę, zostało: ${T(m[4])}.`],
    [/^Your (.+?) fights beside you: (\d+) damage a turn, (\d+) turns? left\. It vanishes when the fight ends\.$/, (m) => `${N(m[1])} walczy u twego boku: ${m[2]} obrażeń na turę, zostało: ${T(m[3])}. Znika po walce.`],
    [/^An? (.+?) of light in your hands: (\d+) base damage\. It fades when the fight ends\.$/, (m) => `${WT[m[1]] || m[1]} ze światła w twoich rękach: ${m[2]} obrażeń bazowych. Znika po walce.`],
    [/^Unseen: the foe can't find you for (\d+) turns?\. Your next blow is a sneak attack\.$/, (m) => `Niewidoczny: wróg nie może cię znaleźć przez ${TB(m[1])}. Twój następny cios to atak z ukrycia.`],
    [/^Frenzied: it hurts itself instead of you, (\d+) turns? left\.$/, (m) => `W szale: rani siebie zamiast ciebie, zostało: ${T(m[1])}.`],
    [/^Calmed: it isn't fighting, (\d+) turns? left\.$/, (m) => `Uspokojony: nie walczy, zostało: ${T(m[1])}.`],
    [/^Afraid: it cowers instead of attacking, (\d+) turns? left\.$/, (m) => `Przestraszony: kuli się zamiast atakować, zostało: ${T(m[1])}.`],
    [new RegExp(`^(.+?): (\\d+) ${E} damage each round, (\\d+) turns? left\\.$`), (m) => `${N(m[1])}: ${m[2]} obrażeń ${EL[m[3]]} co rundę, zostało: ${T(m[4])}.`],
    [new RegExp(`^(.+?): (\\d+) ${E} damage when the foe moves on it\\.$`), (m) => `${N(m[1])}: ${m[2]} obrażeń ${EL[m[3]]}, gdy wróg na nią wejdzie.`],
  );
})();
