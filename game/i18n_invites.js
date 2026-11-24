/* i18n_invites.js: Polish for the invite cards (invites.js) and the Accept / Decline answers in parties, co-op runs,
   clans, the Arena and trades. Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    Accept: "Przyjmij", Decline: "Odrzuć", Invites: "Zaproszenia", "Hide for now": "Ukryj na razie",
    "That invite is gone.": "To zaproszenie już wygasło.", "That invitation is gone.": "To zaproszenie już wygasło.",
    "You can't accept that right now.": "Nie możesz teraz tego przyjąć.",
    "That party is gone.": "Tej drużyny już nie ma.", "That run is over.": "Ta wyprawa już się skończyła.",
    "You declined the party invite.": "Odrzucasz zaproszenie do drużyny.", "You declined the dungeon invite.": "Odrzucasz zaproszenie na wyprawę.",
    "That party is full (8 heroes at most).": "Ta drużyna jest pełna (najwyżej 8 bohaterów).",
    "That run is full (8 heroes at most).": "Ta wyprawa jest pełna (najwyżej 8 bohaterów).",
    "the leader makes the choices": "decyzje podejmuje przywódca", "already inside": "już w środku", "waiting at the door": "czeka u wejścia",
    "A friendly bout, no bet": "Przyjacielski pojedynek, bez zakładu", "as a gift": "w prezencie",
    "Joining means leaving your clan": "Dołączenie oznacza odejście z twojego klanu",
    "Clan chat, a tag by your name, a banner over your houses": "Czat klanu, znak przy imieniu, sztandar nad twoimi domami",
    "Someone wants you in their party. Tap Accept on the card at the top to join, or Decline. The leader picks where to go and you travel together; gold is split evenly.":
      "Ktoś chce cię w swojej drużynie. Dotknij Przyjmij na karcie u góry, żeby dołączyć, albo Odrzuć. Przywódca wybiera, dokąd iść, a wy podróżujecie razem; złoto dzieli się po równo.",
    "A party invite": "Zaproszenie do drużyny",
    // patch note
    "Invites you can answer right away": "Zaproszenia, na które odpowiadasz od razu",
    "Every invite now pops up as a card at the top of the screen with Accept and Decline: party invites, co-op dungeon runs, clan invites, Arena challenges and trade offers. No more digging through menus.":
      "Każde zaproszenie wyskakuje teraz jako karta u góry ekranu z przyciskami Przyjmij i Odrzuć: zaproszenia do drużyny, wspólne wyprawy do lochów, zaproszenia do klanu, wyzwania na Arenie i oferty wymiany. Koniec z szukaniem po menu.",
    "When you decline, the other player is told plainly, for example \"Kacper declined your party invite.\" You can now decline a clan invite too.":
      "Gdy odrzucisz zaproszenie, drugi gracz dostaje jasną wiadomość, np. „Kacper odrzucił twoje zaproszenie do drużyny”. Zaproszenie do klanu też można teraz odrzucić.",
    "A full party or run tells you it's full instead of pulling you out of your own party first.":
      "Pełna drużyna albo wyprawa mówi, że jest pełna, zamiast najpierw wyciągać cię z twojej drużyny.",
    "On the phone, an invite that arrives while the game is in the background shows a notification with Accept and Decline buttons.":
      "Na telefonie zaproszenie, które przyjdzie, gdy gra działa w tle, pokazuje powiadomienie z przyciskami Przyjmij i Odrzuć.",
  });
  const what = { party: "do drużyny", dungeon: "na wyprawę", clan: "do klanu" };
  I18N_EXTRA.pat.push(
    [/^(.+) invites you to their party$/, (m) => `${m[1]} zaprasza cię do swojej drużyny`],
    [/^(.+) asks you to raid (.+) together$/, (m) => `${m[1]} zaprasza cię na wspólną wyprawę: ${m[2]}`],
    [/^(.+) invites you to the clan (.+)$/, (m) => `${m[1]} zaprasza cię do klanu ${m[2]}`],
    [/^(.+) challenges you in the Windhelm Arena$/, (m) => `${m[1]} wyzywa cię na pojedynek na Arenie w Windhelmie`],
    [/^(.+) offers you a trade$/, (m) => `${m[1]} proponuje ci wymianę`],
    [/^The (party|run) is full \((\d+)\/(\d+)\)$/, (m) => `${m[1] === "party" ? "Drużyna" : "Wyprawa"} jest pełna (${m[2]}/${m[3]})`],
    [/^(\d+)\/(\d+) heroes$/, (m) => `${m[1]}/${m[2]} bohaterów`],
    [/^Stake (\d+) gold each$/, (m) => `Stawka: ${m[1]} złota od każdego`],
    [/^winner takes (\d+)$/, (m) => `zwycięzca bierze ${m[1]}`],
    [/^You need (\d+) gold$/, (m) => `Potrzebujesz ${m[1]} złota`],
    [/^Offer: (.+)$/, (m) => `Oferta: ${m[1]}`],
    [/^for (\d+) gold$/, (m) => `za ${m[1]} złota`],
    [/^\+(\d+) more invites? in \uE106 Social$/, (m) => `+${m[1]} kolejnych zaproszeń w \uE106 Społeczność`],
    [/^((?:\uE106|\uE101|\uE13E) )?(.+) declined your (party|dungeon|clan) invite\.$/, (m) => `${m[1] || ""}${m[2]} odrzuca twoje zaproszenie ${what[m[3]]}.`],
    [/^You declined (.+)'s (party|dungeon) invite\.$/, (m) => `Odrzucasz zaproszenie ${what[m[2]]} od: ${m[1]}.`],
    [/^You declined the invite to (.+)\.$/, (m) => `Odrzucasz zaproszenie do klanu ${m[1]}.`],
    [/^You joined (.+)'s party\. The leader makes the choices\.$/, (m) => `Dołączasz do drużyny gracza ${m[1]}. Decyzje podejmuje przywódca.`],
  );
})();
