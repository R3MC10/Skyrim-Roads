/* i18n_initiative.js: Polish for the new turn order (initiative.js, initroster.js, tbfight.js, sharedfight.js) and its
   patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names and numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the roster
    "Turn order": "Kolejność tur",
    "Whole turn order": "Cała kolejność tur",
    "Shared turn": "Wspólna tura",
    "Next round": "Następna runda",
    "Next round, if nothing changes": "Następna runda, jeśli nic się nie zmieni",
    "if nothing changes": "jeśli nic się nie zmieni",
    "initiative": "inicjatywa",
    "roll": "rzut",
    "speed": "szybkość",
    "Next": "Dalej",
    "moves": "ruchy",
    "moves in this turn": "ruchy w tej turze",
    "its 2nd turn this round": "jego 2. tura w tej rundzie",
    "Lost": "Stracona",
    "Out": "Poza walką",
    "Done": "Zrobione",
    "Now": "Teraz",
    "Acts together with the heroes next to it in the order": "Działa razem z bohaterami obok w kolejności",
    "Knocked down: out of the order": "Powalony: wypada z kolejki",
    "Highest initiative acts first. Initiative is rolled once a fight (1-4) plus speed. Stuns and freezes cost a turn, a stagger pushes a turn back, haste and slow move you up or down. Heroes next to each other act together.":
      "Najwyższa inicjatywa działa pierwsza. Inicjatywa to rzut raz na walkę (1-4) plus szybkość. Ogłuszenie i zamrożenie kosztują turę, zachwianie przesuwa turę do tyłu, przyspieszenie i spowolnienie przesuwają cię w górę lub w dół. Bohaterowie obok siebie działają razem.",
    // statuses on the roster
    "Stunned: skips this turn": "Ogłuszony: traci tę turę",
    "Frozen: skips this turn, then thaws": "Zamrożony: traci tę turę, potem taje",
    "Slowed: speed -2": "Spowolniony: szybkość -2",
    "Hasted: speed +2": "Przyspieszony: szybkość +2",
    "Bracing: shrugs off stuns and freezes until the next round ends": "Czujny: otrząsa się z ogłuszeń i zamrożeń do końca następnej rundy",
    "Knocked down": "Powalony",
    // speed parts
    "Base": "Podstawa", "No armour": "Bez pancerza", "Light armour": "Lekki pancerz", "Medium armour": "Średni pancerz", "Heavy armour": "Ciężki pancerz", "Perks and gear": "Atuty i ekwipunek",
    "Slowed": "Spowolniony", "Hasted": "Przyspieszony", "Speed": "Szybkość",
    // the fight log
    // perks
    "Heavy armour no longer slows you in fights.": "Ciężki pancerz nie spowalnia cię już w walce.",
    // patch note
    "A smarter turn order": "Mądrzejsza kolejność tur",
    "Who goes first is rolled once when a fight starts: a roll of 1 to 4 plus your speed. Light armour makes you a bit quicker, heavy armour a bit slower, and some perks help.":
      "Kto zaczyna, losuje się raz na początku walki: rzut od 1 do 4 plus twoja szybkość. Lekki pancerz trochę cię przyspiesza, ciężki trochę spowalnia, a niektóre atuty pomagają.",
    "The turn order now changes during the fight. A stunned or frozen foe loses its next turn, a staggered one is pushed back two places, haste moves you up and slow moves you down. Every change slides into place so you can see it happen, with the reason flashing on the portrait.":
      "Kolejność tur zmienia się teraz w trakcie walki. Ogłuszony albo zamrożony wróg traci następną turę, zachwiany spada o dwa miejsca, przyspieszenie przesuwa cię w górę, a spowolnienie w dół. Każda zmiana płynnie wjeżdża na miejsce, a powód miga na portrecie.",
    "No stun-locking: after losing a turn to a stun or a freeze, a foe shrugs off the next ones until the next round ends. Bosses act twice a round, so they only ever lose one of the two.":
      "Bez zamykania w ogłuszeniu: po stracie tury przez ogłuszenie lub zamrożenie wróg otrząsa się z kolejnych do końca następnej rundy. Bossowie działają dwa razy w rundzie, więc tracą najwyżej jedną z dwóch tur.",
    "Fast foes have two turns a round, marked ① and ②, each with its own next move. Speed decides when you act, never how many moves you get.":
      "Szybcy wrogowie mają dwie tury w rundzie, oznaczone ① i ②, każda z własnym następnym ruchem. Szybkość decyduje, kiedy działasz, nigdy ile masz ruchów.",
    "Heroes next to each other in the order share one turn: in a party everyone in it plays at the same time, and followers act on their orders. There's no timer: the fight waits until everyone is done. If someone goes quiet for 30 seconds, the party leader can skip them, and a player who loses the connection just guards.":
      "Bohaterowie stojący obok siebie w kolejności mają wspólną turę: w drużynie wszyscy grają naraz, a towarzysze działają według rozkazów. Nie ma zegara: walka czeka, aż wszyscy skończą. Jeśli ktoś nic nie robi przez 30 sekund, lider może go pominąć, a gracz, który straci połączenie, po prostu się broni.",
    "The turn strip at the top shows portraits in order, brackets round shared turns and the next round dimmed after a marker. Tap a portrait for its initiative, statuses and next move, or the + button for the whole order.":
      "Pasek tur u góry pokazuje portrety po kolei, nawiasy wokół wspólnych tur i przygaszoną następną rundę za znacznikiem. Dotknij portretu, żeby zobaczyć inicjatywę, stany i następny ruch, albo przycisku +, żeby zobaczyć całą kolejność.",
  });
  const tr = (s) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(s) ?? s : s);
  const miejsc = (k) => (+k === 1 ? "miejsce" : +k >= 2 && +k <= 4 ? "miejsca" : "miejsc");
  I18N_EXTRA.pat.push(
    [/^(.+) is stunned and loses this turn$/, (m) => `${tr(m[1])} jest ogłuszony i traci tę turę`],
    [/^(.+) is frozen solid and loses this turn, then thaws$/, (m) => `${tr(m[1])} zamarza i traci tę turę, potem taje`],
    [/^The (.+) is still bracing from the last one and shrugs it off$/, (m) => `${tr(m[1])} wciąż jest czujny po ostatnim razie i otrząsa się`],
    [/^(.+) is skipped and keeps their guard up\. (.*)$/, (m) => `${m[1]} zostaje pominięty i trzyma gardę. ${tr(m[2])}`],
    [/^(.+) is skipped and keeps their guard up\.$/, (m) => `${m[1]} zostaje pominięty i trzyma gardę.`],
    [/^(.+) lost the connection and keeps their guard up\. (.*)$/, (m) => `${m[1]} stracił połączenie i trzyma gardę. ${tr(m[2])}`],
    [/^(.+) lost the connection and keeps their guard up\.$/, (m) => `${m[1]} stracił połączenie i trzyma gardę.`],
    [/^(.+) (?:is|are) choosing…$/, (m) => `${m[1]} wybiera…`],
    [/^Skip (.+)$/, (m) => `Pomiń: ${m[1]}`],
    [/^No move from (.+) for a while: they keep their guard up this turn\.$/, (m) => `${m[1]} od dłuższej chwili nic nie robi: w tej turze trzyma gardę.`],
    [/^Staggered: moved back (\d+) places?$/, (m) => `Zachwiany: przesunięty o ${m[1]} ${miejsc(m[1])} do tyłu`],
    [/^Round (\d+)$/, (m) => `Runda ${m[1]}`],
  );
})();
