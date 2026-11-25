/* i18n_partyinvites.js: Polish for "your party goes in together" (coop.js, friendjoin.js, ui.js): no separate invites
   for people already in your party, an "In your party" tag instead, and the party joining the leader's co-op run.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names or numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "In your party": "W twojej drużynie",
    "Rejoin": "Wróć",
    "Your party is in already. Invite friends or anyone here:": "Twoja drużyna już jest w środku wyprawy. Zaproś przyjaciół albo kogoś stąd:",
    "Invite your friends or anyone here:": "Zaproś przyjaciół albo kogoś stąd:",
    "Your whole party comes along; no invites needed.": "Cała twoja drużyna idzie z tobą; zaproszenia nie są potrzebne.",
    "Run open. Your whole party is in; invite friends if you like, then go in together.": "Wyprawa otwarta. Cała drużyna już jest; zaproś przyjaciół, jeśli chcesz, i wejdźcie razem.",
    "Run open. Invite your friends, then go in together.": "Wyprawa otwarta. Zaproś znajomych i wejdźcie razem.",
    // patch note
    "Your party goes in together": "Drużyna wchodzi razem",
    "When your party leader starts a co-op dungeon run, everyone in the party is in it straight away: no separate invites and no Accept cards for people already in your party.":
      "Gdy przywódca drużyny zaczyna wspólną wyprawę do lochu, cała drużyna od razu w niej jest: bez osobnych zaproszeń i bez kart Przyjmij dla osób, które już są w twojej drużynie.",
    "Invites in the co-op lobby are only for friends and others outside your party, and only while there's room (up to 8 heroes in all; followers don't count).":
      "Zaproszenia w poczekalni wyprawy są tylko dla przyjaciół i innych spoza drużyny, i tylko gdy jest miejsce (najwyżej 8 bohaterów; towarzysze się nie liczą).",
    "In a party, only the leader starts co-op runs. If you step out of your party's run, a Rejoin button takes you back in.":
      "W drużynie tylko przywódca zaczyna wspólne wyprawy. Jeśli wyjdziesz z wyprawy drużyny, przycisk Wróć zabierze cię z powrotem.",
    "Friends and travellers who are already in your party show \"In your party\" instead of an Invite or Ask to join button.":
      "Przyjaciele i podróżni, którzy już są w twojej drużynie, mają napis „W twojej drużynie” zamiast przycisku Zaproś albo Poproś o dołączenie.",
    "Old invites and join requests for someone who has since joined your party are cleared away, with no leftover pop-ups.":
      "Stare zaproszenia i prośby o dołączenie dla kogoś, kto już dołączył do twojej drużyny, znikają, bez zbędnych okienek.",
  });
  I18N_EXTRA.pat.push(
    [/^(.+) leads your party, so they start co-op runs\. You'll be in it with them\.$/, (m) => `${m[1]} prowadzi twoją drużynę, więc to on zaczyna wspólne wyprawy. Będziesz w niej razem z nim.`],
    [/^(.+) leads your party\. When they start a co-op run, your whole party is in it; no invites needed\.$/, (m) => `${m[1]} prowadzi twoją drużynę. Gdy zacznie wspólną wyprawę, cała drużyna w niej będzie; zaproszenia nie są potrzebne.`],
    [/^(.+) is in your party, so they're in the run already\.$/, (m) => `${m[1]} jest w twojej drużynie, więc już jest w wyprawie.`],
    [/^(.+) is already in your party\.$/, (m) => `${m[1]} już jest w twojej drużynie.`],
    [/^(.+) opened a co-op run of (.+)\. Your whole party is in\.$/, (m) => `${m[1]} otworzył wspólną wyprawę: ${m[2]}. Cała drużyna jest w środku.`],
    [/^Your party's run of (.+)$/, (m) => `Wyprawa twojej drużyny: ${m[1]}`],
    [/^(\d+)\/(\d+) heroes · you stepped out$/, (m) => `${m[1]}/${m[2]} bohaterów · wyszedłeś`],
  );
})();
