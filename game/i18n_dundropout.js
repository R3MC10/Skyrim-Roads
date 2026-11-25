/* i18n_dundropout.js: Polish for dundropout.js (someone left a co-op dungeon run: the notice, the waiting bar, toasts).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names or numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "The run is over": "Wyprawa skończona",
    "Everyone was brought safely back to the entrance. You keep everything you found, and the party's loot pile is shared out as usual.":
      "Wszyscy wrócili bezpiecznie do wejścia. Zatrzymujesz wszystko, co znalazłeś, a łupy drużyny są dzielone jak zwykle.",
    "You're back at the entrance with everything you had. Anything the party found is shared out as usual.":
      "Jesteś z powrotem przy wejściu ze wszystkim, co miałeś. To, co znalazła drużyna, jest dzielone jak zwykle.",
    "Go back in together": "Wejdźcie znowu razem", "Wait for them": "Poczekaj na nich", "OK": "OK",
    "Back to the map": "Wróć na mapę", "Ask the group to go again": "Poproś grupę o kolejne wejście",
    "Stop waiting": "Przestań czekać", "Not now": "Nie teraz",
    "Finish where you are first.": "Najpierw skończ to, co robisz.",
    // patch note
    "When someone leaves a dungeon run": "Gdy ktoś opuści wyprawę do lochu",
    "If someone in a co-op dungeon run closes the game or loses their connection for about half a minute, the run now ends for everyone in it, party or not. A short network hiccup or a quick switch to another app doesn't count.":
      "Jeśli ktoś na wspólnej wyprawie do lochu zamknie grę albo straci połączenie na mniej więcej pół minuty, wyprawa kończy się teraz dla wszystkich jej uczestników, w drużynie czy nie. Krótka przerwa w sieci albo szybkie przełączenie na inną aplikację się nie liczy.",
    "Everyone is taken safely back to the dungeon's entrance: a fight that was going on just stops (nobody dies), you keep everything you picked up, and the party's loot pile is shared out by the usual vote, gold split evenly.":
      "Wszyscy wracają bezpiecznie do wejścia lochu: trwająca walka po prostu się kończy (nikt nie ginie), zatrzymujesz wszystko, co podniosłeś, a łupy drużyny są dzielone zwykłym głosowaniem, złoto po równo.",
    "A notice tells you who left, with Go back in together (a new run with the same group), Wait for them (shows when they're back online) and OK.":
      "Komunikat mówi, kto wyszedł, z przyciskami Wejdźcie znowu razem (nowa wyprawa z tą samą grupą), Poczekaj na nich (pokaże, gdy wrócą do gry) i OK.",
    "The one who left sees what happened when they come back, with Back to the map or Ask the group to go again. Their share of the loot waits for them.":
      "Osoba, która wyszła, po powrocie zobaczy, co się stało, z przyciskami Wróć na mapę albo Poproś grupę o kolejne wejście. Jej część łupów na nią czeka.",
  });
  I18N_EXTRA.pat.push(
    [/^(.+) left the game — the run in (.+) has ended\.$/, (m) => `${m[1]} ${/ and /.test(m[1]) ? "wyszli z gry" : "wyszedł(-a) z gry"} — wyprawa do: ${m[2]} się skończyła.`],
    [/^Your run in (.+) ended while you were away\.$/, (m) => `Twoja wyprawa do: ${m[1]} skończyła się, gdy cię nie było.`],
    [/^Wait for (.+)$/, (m) => `Poczekaj na: ${m[1]}`],
    [/^Waiting for (.+) to come back…$/, (m) => `Czekasz, aż ${m[1]} wróci…`],
    [/^(.+) (?:is|are) back!$/, (m) => `${m[1]} wraca!`],
    [/^(.+) (?:is|are) back online\.$/, (m) => `${m[1]} jest znowu w grze.`],
    [/^You're already in the new run of (.+)\.$/, (m) => `Już jesteś w nowej wyprawie do: ${m[1]}.`],
    [/^Go to (.+) first\.$/, (m) => `Najpierw idź do: ${m[1]}.`],
    [/^A new run of (.+) is open\. Everyone from before is invited; (.+) will see it when they're back\.$/, (m) => `Nowa wyprawa do: ${m[1]} otwarta. Wszyscy z poprzedniej są zaproszeni; ${m[2]} zobaczy zaproszenie po powrocie.`],
    [/^A new run of (.+) is open\. Everyone from before is invited\.$/, (m) => `Nowa wyprawa do: ${m[1]} otwarta. Wszyscy z poprzedniej są zaproszeni.`],
  );
})();
