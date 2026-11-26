/* i18n_stacks.js: Polish for build 145's fight changes: no more action points (moves cost stamina, magicka or health),
   stacking statuses (stacks.js) and the fight minigames (minigame.js). Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the action bar and costs
    "Moves": "Ruchy", "ready": "gotowe", "free": "za darmo", "Free.": "Za darmo.", "Too hurt": "Zbyt ranny", "Once a turn": "Raz na turę",
    "Minigames": "Minigry", "On": "Wł.", "Off": "Wył.", "Fight minigames": "Minigry w walce",
    "Try to break away from the fight. Ends your turn; the foe may cut you off.": "Spróbuj uciec z walki. Kończy turę; wróg może odciąć ci drogę.",
    "Blows, power attacks, bashes and guards need stamina, spells need magicka.": "Ciosy, potężne ataki, uderzenia tarczą i garda zużywają wytrzymałość, czary magię.",
    // minigames
    "Tap in the bright zone": "Stuknij w jasnej strefie", "Press as the blow meets your shield": "Naciśnij, gdy cios trafia w tarczę",
    "Hold to draw, let go on the gold ring": "Przytrzymaj, by naciągnąć, puść na złotym kręgu", "Tap the glowing points in order": "Stukaj świecące punkty po kolei",
    "Perfect!": "Idealnie!", "Perfect": "Idealnie", "Good": "Dobrze", "Miss": "Pudło", "Fizzled": "Czar zgasł", "Late": "Za późno", "Mistimed": "Nie w porę",
    "Might, +1 Haste": "Siły, +1 Pośpiechu", "Burn": "Podpalenia", "Chill": "Chłodu", "Shock": "Porażenia", "Regen": "Regeneracji", "Ward": "Osłony",
    "Weak": "Osłabienia", "Might": "Siły", "Vulnerable": "Podatności", "Bleed": "Krwawienia", "Sunder": "Skruszenia",
    // status chips
    "Winded": "Zadyszka", "Drained": "Wyczerpanie", "Haste": "Pośpiech", "Sundered": "Skruszony pancerz", "Weakened": "Osłabiony", "Resolve": "Hart",
    "Winded: you start each turn with less stamina.": "Zadyszka: zaczynasz każdą turę z mniejszą wytrzymałością.",
    "Drained: you start each turn with less magicka.": "Wyczerpanie: zaczynasz każdą turę z mniejszą magią.",
    "Might: your blows and spells land harder.": "Siła: twoje ciosy i czary trafiają mocniej.",
    "Haste: you act earlier in the round.": "Pośpiech: działasz wcześniej w rundzie.",
    "Vulnerable: it takes more damage from everything.": "Podatny: dostaje więcej obrażeń od wszystkiego.",
    "Sundered armour: weapons hurt it more.": "Skruszony pancerz: broń rani go mocniej.",
    "Weakened: its blows land softer.": "Osłabiony: jego ciosy są słabsze.",
    "Resolve: it has shaken off stuns, calm and fear before, so the next one is shorter.": "Hart: już strząsał ogłuszenia, uspokojenia i strach, więc następne będzie krótsze.",
    // what each stack does (stacks.js TIP)
    "Each stack burns a little more every turn.": "Każdy stos pali trochę mocniej co turę.", "Each stack slows more.": "Każdy stos spowalnia mocniej.",
    "Each stack makes it take 3% more damage.": "Każdy stos: dostaje 3% więcej obrażeń.", "Each stack bleeds a little more every turn.": "Każdy stos krwawi trochę mocniej co turę.",
    "Each stack poisons a little more every turn.": "Każdy stos truje trochę mocniej co turę.", "Each stack heals a little more every turn.": "Każdy stos leczy trochę mocniej co turę.",
    "Each stack: +3% damage taken.": "Każdy stos: +3% otrzymanych obrażeń.", "Each stack: +3% damage from weapons.": "Każdy stos: +3% obrażeń od broni.",
    "Each stack: its blows land 4% softer.": "Każdy stos: jego ciosy są o 4% słabsze.", "Each stack takes a turn off the next stun, calm or fear.": "Każdy stos skraca o turę następne ogłuszenie, uspokojenie albo strach.",
    "Each stack: −4% stamina at the start of your turn.": "Każdy stos: −4% wytrzymałości na początku twojej tury.", "Each stack: −4% magicka at the start of your turn.": "Każdy stos: −4% magii na początku twojej tury.",
    "Each stack: +4% damage.": "Każdy stos: +4% obrażeń.", "Hasted: +2 speed, you act earlier in the round.": "Przyspieszony: +2 do szybkości, działasz wcześniej w rundzie.", "Each stack makes it stronger.": "Każdy stos go wzmacnia.",
    "Drops by 1 each turn.": "Spada o 1 co turę.",
    // perks
    "In turn-by-turn fights your weapon blows, power attacks and guards cost 10/20% less stamina. [OURS]": "W walkach turowych ciosy bronią, potężne ataki i garda kosztują o 10/20% mniej wytrzymałości.",
    "In turn-by-turn fights your spells cost 10% less magicka. [OURS]": "W walkach turowych czary kosztują o 10% mniej magii.",
    "Burning, chills and shocks put on you have one stack less. [OURS]": "Podpalenia, chłód i porażenia nałożone na ciebie mają o jeden stos mniej.",
    "Burning, chills and shocks put on you have one stack less. [OURS, from Dispel]": "Podpalenia, chłód i porażenia nałożone na ciebie mają o jeden stos mniej.",
    "Elemental statuses from your enchanted weapons put on 1 more stack. [OURS]": "Statusy żywiołów z zaklętej broni nakładają o 1 stos więcej.",
    // bosses, the tutorial
    // foe moves by name (fightread.js intents)
    "Strike": "Cios", "Heavy Swing": "Ciężki zamach", "Bite": "Ugryzienie", "Claw Swipe": "Cios pazurami", "Stomp": "Tupnięcie", "Spell": "Czar", "Shoot": "Strzał",
    "Crushing Blow": "Miażdżący cios", "Aimed Shot": "Celny strzał", "Shield Bash": "Uderzenie tarczą", "Brace": "Zasłona", "Winds up": "Bierze zamach",
    "War Cry": "Okrzyk bojowy", "Takes aim": "Celuje", "Poison Arrow": "Zatruta strzała", "Magic Bolt": "Magiczny pocisk", "Heal self": "Leczy się",
    "Poisoned Blade": "Zatrute ostrze", "Shadowstep": "Krok w cień", "Pounce": "Skok", "Maul": "Szarpanie", "Howl": "Wycie", "Venom Spit": "Plucie jadem",
    "Regenerate": "Regeneracja", "Unrelenting Force": "Nieustępliwa siła", "Frost Breath": "Mroźny oddech", "Drain Life": "Wysysanie życia", "Drink potion": "Pije miksturę",
    "Poison": "Trucizna", "you": "ty",
    "a Crushing Blow comes after": "potem przyjdzie miażdżący cios", "an Aimed Shot comes after": "potem przyjdzie celny strzał",
    // patch notes (build 146)
    "Out of breath? You can always make one plain swing a turn. Frost and shock bite your stamina and magicka a bit less than before, and trolls and hagravens regenerate at most four times a fight.":
      "Brak tchu? Zawsze możesz zrobić jeden zwykły zamach na turę. Mróz i porażenie zabierają trochę mniej wytrzymałości i magii niż wcześniej, a trolle i wiedźmy kruków regenerują się najwyżej cztery razy na walkę.",
    "The fight speed button and the Skip buttons are gone. Tap the fight scene if you want to finish an animation right away.":
      "Przycisk szybkości walki i przyciski Pomiń zniknęły. Stuknij scenę walki, jeśli chcesz od razu dokończyć animację.",
    "Action points are gone. On your turn make up to 4 moves in any order, then press End turn. Blows, power attacks, bashes and guards cost stamina, spells cost magicka, dark magic costs a little health. Doing the same move again in a turn costs more, and a power attack is once a turn.":
      "Punktów akcji już nie ma. W swojej turze zrób do 4 ruchów w dowolnej kolejności i naciśnij Koniec tury. Ciosy, potężne ataki, uderzenia tarczą i garda kosztują wytrzymałość, czary magię, mroczna magia trochę zdrowia. Ten sam ruch drugi raz w turze kosztuje więcej, a potężny atak jest raz na turę.",
    "Moves you don't make turn into guard: end early and you take up to 30% less damage until your next turn.":
      "Ruchy, których nie zrobisz, stają się gardą: skończ wcześniej, a do następnej tury dostaniesz do 30% mniej obrażeń.",
    "You see every foe's next move by name with its icon, numbers, who it's aimed at and what it leaves behind (like Venom Spit → Lydia, Poison 3). When it acts, the banner and the log name the move too.":
      "Widzisz następny ruch każdego wroga z nazwą, ikoną, liczbami, celem i tym, co zostawia (np. Plucie jadem → Lydia, Trucizna 3). Gdy działa, baner i dziennik też podają nazwę ruchu.",
    "The turn order ribbon at the top lights up whoever is acting right now, foes included, so you always know whose go it is.":
      "Wstęga kolejności u góry podświetla tego, kto właśnie działa, także wrogów, więc zawsze wiesz, czyja jest kolej.",
    "Burn, chill, poison, bleed, vulnerable, ward and more now stack. The number on the icon is how many stacks; each one makes it stronger and it drops by 1 every turn. Hold or hover the icon to see what it does.":
      "Podpalenie, chłód, trucizna, krwawienie, podatność, osłona i inne teraz się kumulują. Liczba na ikonie to liczba stosów; każdy wzmacnia efekt, a co turę ubywa jeden. Przytrzymaj lub najedź na ikonę, żeby zobaczyć, co robi.",
    "Bosses can't be stun-locked: every stun, calm or fear gives them Resolve, so the next one is shorter.":
      "Bossów nie da się ogłuszać w kółko: każde ogłuszenie, uspokojenie albo strach daje im Hart, więc następne jest krótsze.",
    "Every attack, guard and spell is a quick minigame: tap in the bright zone, time your block, draw your bow or trace a rune. Perfect adds a stack of something nasty, a miss is weaker. Turn it off in Settings → Minigames if you'd rather not.":
      "Każdy atak, garda i czar to szybka minigra: stuknij w jasnej strefie, wyczuj moment bloku, naciągnij łuk albo narysuj runę. Idealnie dokłada stos czegoś paskudnego, pudło jest słabsze. Możesz to wyłączyć w Ustawieniach → Minigry.",
    "New perk effects for stacks: enchanted weapons add an extra stack, and resist perks take a stack off what's put on you.":
      "Nowe efekty perków dla stosów: zaklęta broń dokłada dodatkowy stos, a perki odporności zdejmują jeden stos z tego, co na ciebie nałożono.",
    // patch note
    "No more action points: you choose your turn": "Koniec z punktami akcji: sam wybierasz swoją turę",
    "Statuses stack, and every move is a minigame": "Statusy się kumulują, a każdy ruch to minigra",
  });
  const RES = { stamina: "wytrzymałości", magicka: "magii", health: "zdrowia" };
  const costPL = (t) => (t === "free" ? "za darmo" : t.replace(/(\d+) (stamina|magicka|health)/g, (m, n, w) => `${n} ${RES[w]}`));
  const stos = (k) => (+k === 1 ? "stos" : +k % 10 >= 2 && +k % 10 <= 4 && (+k % 100 < 10 || +k % 100 >= 20) ? "stosy" : "stosów");
  const tr = (s) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(s) ?? s : s);
  I18N_EXTRA.pat.push(
    [/^((?:\d+ (?:stamina|magicka|health)(?: · )?)+)$/, (m) => costPL(m[1])],
    [/^Costs (.+?)( \(done (\d+)× this turn, so it costs more\))?\.$/, (m) => `Koszt: ${costPL(m[1])}${m[2] ? ` (zrobione ${m[3]}× w tej turze, więc kosztuje więcej)` : ""}.`],
    [/^(\d+) potions a turn$/, (m) => `${m[1]} mikstury na turę`],
    [/^Need (\d+) more health$/, (m) => `Brakuje ${m[1]} zdrowia`],
    [/^\+(\d+)% guard$/, (m) => `+${m[1]}% gardy`],
    [/^ ?(\d+) stacks?\. (.+?) Drops by 1 each turn\.$/, (m) => ` ${m[1]} ${stos(m[1])}. ${tr(m[2])} Spada o 1 co turę.`],
    [/^Winded: you start your turn with (\d+)% less stamina\.$/, (m) => `Zadyszka: zaczynasz turę z ${m[1]}% mniejszą wytrzymałością.`],
    [/^Regen: \+(\d+) health at the end of each round\.$/, (m) => `Regeneracja: +${m[1]} zdrowia na koniec każdej rundy.`],
    [/^Poisoned: −(\d+) health every turn\.$/, (m) => `Zatruty: −${m[1]} zdrowia co turę.`],
    [/^Poisoned: you lose (\d+) health each time a foe acts\. A Cure Poison potion or winning the fight ends it\.$/, (m) => `Zatruty: tracisz ${m[1]} zdrowia za każdym razem, gdy wróg działa. Kończy to mikstura leczenia trucizny albo wygrana walka.`],
    [/^Catch your breath: get back (\d+) stamina and (\d+) magicka\.$/, (m) => `Oddech: odzyskujesz ${m[1]} wytrzymałości i ${m[2]} magii.`],
    [/^winded −(\d+) stamina$/, (m) => `zadyszka −${m[1]} wytrzymałości`],
    [/^drained −(\d+) magicka$/, (m) => `wyczerpanie −${m[1]} magii`],
    [/^\(\+(\d+) from stacks\)$/, (m) => `(+${m[1]} ze stosów)`],
    [/^(Poison|Bleed|Burn|Winded) (\d+)$/, (m) => `${tr(m[1])} ${m[2]}`],  );
})();
