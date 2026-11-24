/* i18n_partyvote.js: Polish for party votes in dungeons (partyvote.js) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names or numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Party vote": "Głosowanie drużyny",
  "What does the party do?": "Co robi drużyna?",
  "Which way does the party go?": "Którędy idzie drużyna?",
  "⚑ Decide now": "⚑ Rozstrzygnij teraz",
  "Tap a choice to vote. Most votes wins; a tie goes the leader's way.": "Dotknij wyboru, aby zagłosować. Wygrywa większość; przy remisie decyduje przywódca.",
  "Your face is by your pick. Tap another to change your vote.": "Twoja twarz jest przy twoim wyborze. Dotknij innego, aby zmienić głos.",
  "Time's up: the first vote decides.": "Czas minął: decyduje pierwszy głos.",
  "Nobody has voted yet: tap a choice first.": "Nikt jeszcze nie zagłosował: najpierw dotknij wyboru.",
  "That isn't one of the choices in this vote.": "Tego nie ma wśród wyborów w tym głosowaniu.",
  "Voice of Reason": "Głos rozsądku",
  "In a party dungeon vote, your vote counts twice. [OURS]": "W głosowaniu drużyny w podziemiach twój głos liczy się podwójnie. [NASZE]",
  "In a party dungeon vote, your vote counts twice.": "W głosowaniu drużyny w podziemiach twój głos liczy się podwójnie.",
  "New Speech perk, Voice of Reason (needs Persuasion): in a party dungeon vote, your vote counts twice.":
    "Nowy atut Elokwencji, Głos rozsądku (wymaga Perswazji): w głosowaniu drużyny w podziemiach twój głos liczy się podwójnie.",
  // patch note
  "The whole party votes in dungeons": "Cała drużyna głosuje w podziemiach",
  "In a party dungeon everyone gets a say now: which way to go at a fork, and what to do in each room (fight, sneak past, run, pick the lock, rest, read the book...). Tap a choice to vote.":
    "W podziemiach z drużyną każdy ma teraz głos: którędy iść na rozwidleniu i co zrobić w każdej komnacie (walka, przekradanie się, ucieczka, otwieranie zamka, odpoczynek, czytanie księgi...). Dotknij wyboru, aby zagłosować.",
  "Your face pops up next to the choice you picked, on everyone's phone, as soon as you tap. Changed your mind? Tap another choice before the vote closes.":
    "Twoja twarz pojawia się obok wybranej opcji na telefonie każdego gracza, gdy tylko dotkniesz. Zmieniłeś zdanie? Dotknij innego wyboru, zanim głosowanie się skończy.",
  "Most votes wins. On a tie the leader's vote decides. The vote closes when everyone has voted, or after 20 seconds (watch the ring); anyone who didn't vote just doesn't count, and someone who dropped out never holds the party up.":
    "Wygrywa większość głosów. Przy remisie decyduje głos przywódcy. Głosowanie kończy się, gdy wszyscy zagłosują, albo po 20 sekundach (patrz na pierścień); kto nie zagłosował, ten się nie liczy, a ktoś, kto się rozłączył, nigdy nie wstrzymuje drużyny.",
  "The leader also has a Decide now button. Drinking a healing potion is still your own call, no vote needed. Playing alone works just like before.":
    "Przywódca ma też przycisk Rozstrzygnij teraz. Wypicie mikstury leczenia to wciąż twoja sprawa, bez głosowania. Gra w pojedynkę działa jak dawniej.",
});
I18N_EXTRA.pat.push(
  [/^(.+) \((left|middle|right)\)$/, (m) => `${m[1]} (${{ left: "lewo", middle: "środek", right: "prawo" }[m[2]]})`],
  [/^You vote: (.+)\.$/, (m) => `Głosujesz: ${m[1]}.`],
  [/^⚑ The party chose: (.+) \((\d+) of (\d+) votes?\)\.$/, (m) => `⚑ Drużyna wybrała: ${m[1]} (${m[2]} z ${m[3]} głosów).`],
  [/^(\d+) seconds left$/, (m) => `Zostało ${m[1]} s`],
);
