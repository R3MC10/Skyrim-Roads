/* i18n_defeat.js: Polish for defeat.js (the defeat screen: Retry / Adjust gear / Retreat, the party vote, why you lost),
   the no-penalty lines in the game files that call G.die, and the patch note. Loaded before i18n.js; exact lines go in
   I18N_EXTRA.words, lines with names or numbers in I18N_EXTRA.pat. Never overwrites an older translation. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const W = {
    // the defeat screen
    "Defeated": "Pokonany", "Beaten by": "Pokonał cię:", "Retry": "Spróbuj ponownie", "Adjust gear": "Zmień ekwipunek", "Retreat": "Wycofaj się",
    "Fell back": "Wycofałeś się",
    "Difficulty for the next try": "Poziom trudności następnej próby",
    "You lose nothing: gold, items, XP and progress are just as they were before the fight.": "Nic nie tracisz: złoto, przedmioty, doświadczenie i postępy są takie jak przed walką.",
    "The same foe, a fresh start": "Ten sam wróg, czysty start",
    "Change weapons, armour or spells, then come back": "Zmień broń, pancerz albo zaklęcia i wróć",
    "Step back out of this room. Rooms you cleared stay cleared.": "Wyjdź z tej komnaty. Oczyszczone komnaty zostają oczyszczone.",
    "Back on the road, past the fight.": "Z powrotem na drodze, z ominięciem walki.",
    "Walk away for now. It will still be there later.": "Odejdź na razie. Nikąd nie zniknie.",
    "The same fight again, everyone back on their feet": "Ta sama walka jeszcze raz, wszyscy znów na nogach",
    "Fall back and go another way": "Wycofajcie się i idźcie inną drogą",
    "Change weapons, armour or spells while the party votes": "Zmień broń, pancerz albo zaklęcia, póki drużyna głosuje",
    "The party decides together: most votes wins, a tie goes the leader's way.": "Drużyna decyduje razem: wygrywa większość, przy remisie decyduje przywódca.",
    "The party was beaten. What now?": "Drużyna przegrała. Co teraz?",
    "Decide now": "Zdecyduj teraz",
    "The party tries again.": "Drużyna próbuje jeszcze raz.",
    "The party falls back.": "Drużyna się wycofuje.",
    "Change what you need, then:": "Zmień, co trzeba, a potem:",
    "Back to the vote": "Wróć do głosowania", "Back": "Wróć",
    "You still had healing potions: drink one when your health runs low.": "Miałeś jeszcze mikstury leczenia: wypij jedną, gdy zdrowie spada.",
    "You back out of the room and catch your breath. The rooms you cleared stay cleared.": "Wycofujesz się z komnaty i łapiesz oddech. Oczyszczone komnaty zostają oczyszczone.",
    "You fall back, find another way round and you're back on the road.": "Wycofujesz się, znajdujesz obejście i wracasz na drogę.",
    "You walk away for now. You can come back to it any time.": "Na razie odchodzisz. Możesz tu wrócić w każdej chwili.",
    "You lose nothing: the party votes on what to do next.": "Nic nie tracisz: drużyna głosuje, co dalej.",
    // help, tips and the other screens
    "Knocked down": "Powalony",
    "Losing a fight": "Przegrana walka",
    "You lose nothing. Retry the same fight, change your gear first, or retreat and go another way. Only a fight with another player can make you drop your gear in a bag.":
      "Nic nie tracisz. Spróbuj tej samej walki jeszcze raz, najpierw zmień ekwipunek albo wycofaj się i idź inną drogą. Tylko walka z innym graczem może sprawić, że twój ekwipunek wypadnie w sakwie.",
    "Lose a fight and you lose nothing: retry, change your gear or retreat.": "Przegrana walka nic nie kosztuje: spróbuj ponownie, zmień ekwipunek albo się wycofaj.",
    "The contract went wrong. The job is still yours: try again when you're ready.": "Kontrakt poszedł źle. Zlecenie wciąż jest twoje: spróbuj ponownie, gdy będziesz gotów.",
    "The guard knocks you down, but you slip back into the dark before anyone comes. Nothing is lost: try again or pick another way.":
      "Strażnik cię powala, ale wymykasz się w ciemność, zanim ktoś nadejdzie. Nic nie tracisz: spróbuj ponownie albo wybierz inną drogę.",
    "There are too many of them and they knock you down, but you crawl back into hiding. Nothing is lost: try again or pick another way out.":
      "Jest ich za dużo i cię powalają, ale czołgasz się z powrotem do kryjówki. Nic nie tracisz: spróbuj ponownie albo wybierz inną drogę ucieczki.",
    "Knocked down below, you lose nothing: try the fight again. Leave without extracting and the finds stay down here.":
      "Powalony na dole nic nie tracisz: spróbuj walki jeszcze raz. Wyjdź bez wyniesienia łupów, a znaleziska zostaną na dole.",
    "Knocked down below, you lose nothing: try the fight again. Leave without extracting and the finds stay down here. Pathfinder: you can also walk out from any room and keep it all.":
      "Powalony na dole nic nie tracisz: spróbuj walki jeszcze raz. Wyjdź bez wyniesienia łupów, a znaleziska zostaną na dole. Tropiciel: możesz też wyjść z każdej komnaty i zatrzymać wszystko.",
    // patch note
    "Losing a fight costs nothing": "Przegrana walka nic nie kosztuje",
    "Lose a fight and you lose nothing: no gold, no items, no XP, no progress. You're put back just before the fight.":
      "Przegrywasz walkę i nic nie tracisz: ani złota, ani przedmiotów, ani doświadczenia, ani postępów. Wracasz do chwili tuż przed walką.",
    "A new screen shows what beat you and why, then gives you three choices: Retry (the same foes again), Adjust gear (change weapons, armour or spells, then come back) or Retreat.":
      "Nowy ekran pokazuje, co cię pokonało i dlaczego, a potem daje trzy wybory: Spróbuj ponownie (ci sami wrogowie), Zmień ekwipunek (broń, pancerz albo zaklęcia, potem wracasz) albo Wycofaj się.",
    "Retreat on the road takes you past the fight and back on your way. In a dungeon you step back out of the room; rooms you already cleared stay cleared.":
      "Wycofanie się na drodze omija walkę i wracasz na szlak. W lochu wychodzisz z komnaty; oczyszczone komnaty zostają oczyszczone.",
    "You can switch the difficulty on that screen before you try again.": "Na tym ekranie możesz zmienić poziom trudności przed kolejną próbą.",
    "Whatever you picked up or learned during the lost fight goes back too, so a retry is a clean new try.":
      "To, co zdobyłeś albo czego się nauczyłeś w przegranej walce, też wraca, więc kolejna próba to czysty start.",
    "In a party, one beaten player can't reset everyone's fight: the party votes on Retry or Retreat (most votes wins, a tie goes the leader's way). Anyone knocked down just gets back up.":
      "W drużynie jeden pokonany gracz nie cofa walki wszystkim: drużyna głosuje nad ponowną próbą albo odwrotem (wygrywa większość, przy remisie decyduje przywódca). Kto został powalony, po prostu wstaje.",
    "World events and world bosses keep going: you get back up where you are and what you did still counts.":
      "Wydarzenia świata i bossowie świata trwają dalej: wstajesz tam, gdzie jesteś, a to, co zrobiłeś, wciąż się liczy.",
    "Guild jobs, heists, quests and deep dungeon levels work the same way: getting knocked down no longer loses the job, gets you caught or takes the finds you made below.":
      "Zlecenia gildii, skoki, zadania i głębokie poziomy lochów działają tak samo: powalenie nie odbiera już zlecenia, nie kończy się złapaniem i nie zabiera znalezisk z dołu.",
  };
  for (const [k, v] of Object.entries(W)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  const R = (n) => `${n} ${+n === 1 ? "runda" : +n % 10 >= 2 && +n % 10 <= 4 && (+n % 100 < 10 || +n % 100 >= 20) ? "rundy" : "rund"}`;
  const KO = { "everything is as it was before the fight, so try again or go another way": "wszystko jest jak przed walką, więc spróbuj ponownie albo idź inną drogą",
    "you get back up right here and the fight goes on": "wstajesz w tym miejscu, a walka trwa dalej", "get your breath back and carry on": "złap oddech i ruszaj dalej" };
  I18N_EXTRA.pat.push(
    [/^(.+) knocked you down\. You lose nothing: (everything is as it was before the fight, so try again or go another way|you get back up right here and the fight goes on|get your breath back and carry on)\.$/,
      (m) => `Powala cię: ${m[1]}. Nic nie tracisz: ${KO[m[2]]}.`],
    [/^(.+)'s (.+) did most of the damage \((\d+)%\)\.$/, (m) => `Najwięcej obrażeń zadał ruch „${m[2]}” (${m[1]}): ${m[3]}%.`],
    [/^(.+) landed one huge blow: (\d+) damage at once\.$/, (m) => `Jeden potężny cios (${m[1]}): ${m[2]} obrażeń naraz.`],
    [/^(.+) wore you down over (\d+) rounds?; its hardest blow took (\d+) health\.$/, (m) => `${m[1]} wykańczał cię przez ${R(m[2])}; najmocniejszy cios zabrał ${m[3]} zdrowia.`],
    [/^(.+) outlasted you over (\d+) rounds?\.$/, (m) => `${m[1]} wytrzymał dłużej (${R(m[2])}).`],
    [/^(.+) was too strong this time\.$/, (m) => `Tym razem za silny przeciwnik: ${m[1]}.`],
    [/^(.+) was too much for you\. Nothing is lost: try again when you're ready\.$/, (m) => `${m[1]} to dla ciebie za dużo. Nic nie tracisz: spróbuj ponownie, gdy będziesz gotów.`],
    [/^(.+) was too much for you\. You're still where you were: try again when you're ready\.$/, (m) => `${m[1]} to dla ciebie za dużo. Jesteś tam, gdzie byłeś: spróbuj ponownie, gdy będziesz gotów.`],
  );
})();
