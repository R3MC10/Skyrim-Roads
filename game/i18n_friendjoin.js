/* i18n_friendjoin.js: Polish for friendjoin.js (what friends are doing, Ask to join, the leader's accept/decline card).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names or numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const ACT = { fighting: "walczy", "in a dungeon": "w lochu", trading: "handluje", travelling: "w podróży", idle: "odpoczywa" };
  Object.assign(I18N_EXTRA.words, ACT, {
    "Ask to join": "Poproś o dołączenie", "On their own": "Gra w pojedynkę", "In a party": "W drużynie",
    "They're offline.": "Jest offline.", "In a dungeon run. Ask when they're out.": "Jest na wyprawie w lochu. Poproś, gdy wyjdzie.",
    "Asked. Waiting for an answer…": "Wysłano. Czekasz na odpowiedź…", "You're already waiting on another answer.": "Już czekasz na inną odpowiedź.",
    "Already in your party.": "Już jest w twojej drużynie.", "That's your party.": "To twoja drużyna.",
    "Your party is full.": "Twoja drużyna jest pełna.", "That request is gone.": "Tej prośby już nie ma.", "That request ran out.": "Ta prośba wygasła.",
    "Only your party leader can take people in.": "Tylko przywódca drużyny może kogoś przyjąć.",
    // patch note
    "See what your friends are up to": "Zobacz, co robią twoi przyjaciele",
    "Your Friends list now shows what each friend online is doing: where they are (a town, a dungeon or on the road), whether they're fighting, trading or taking it easy, and their level.":
      "Lista przyjaciół pokazuje teraz, co robi każdy przyjaciel online: gdzie jest (miasto, loch albo droga), czy walczy, handluje albo odpoczywa, i jaki ma poziom.",
    "It also shows whether they're in a party and how full it is (up to 8 players; followers don't count).":
      "Widać też, czy jest w drużynie i ile jest w niej miejsca (do 8 graczy; towarzysze się nie liczą).",
    "New Ask to join button: it asks their party leader (or your friend, if they're alone). The leader gets a card with Accept and Decline, and if they accept you join the party straight away.":
      "Nowy przycisk Poproś o dołączenie: pyta przywódcę ich drużyny (albo twojego przyjaciela, jeśli gra sam). Przywódca dostaje kartę z Przyjmij i Odrzuć, a jeśli przyjmie, od razu dołączasz do drużyny.",
    "You can't ask while their party is full or they're inside a dungeon run; ask again when they're out. A request with no answer runs out after a minute.":
      "Nie możesz prosić, gdy ich drużyna jest pełna albo są na wyprawie w lochu; poproś, gdy wyjdą. Prośba bez odpowiedzi wygasa po minucie.",
  });
  const part = (x) => ACT[x] || (x === "on the road" ? "w drodze" : x === "out in the wild" ? "w dziczy" : /^near (.+)$/.test(x) ? x.replace(/^near (.+)$/, "w pobliżu: $1") : x);
  I18N_EXTRA.pat.push(
    [/^Leads a party · (\d+)\/(\d+)( · full)?$/, (m) => `Prowadzi drużynę · ${m[1]}/${m[2]}${m[3] ? " · pełna" : ""}`],
    [/^In (.+)'s party · (\d+)\/(\d+)( · full)?$/, (m) => `W drużynie: ${m[1]} · ${m[2]}/${m[3]}${m[4] ? " · pełna" : ""}`],
    [/^Their party is full \((\d+)\/(\d+)\)\.$/, (m) => `Ich drużyna jest pełna (${m[1]}/${m[2]}).`],
    [/^Your party is full \((\d+)\/(\d+)\)$/, (m) => `Twoja drużyna jest pełna (${m[1]}/${m[2]})`],
    [/^Wait (\d+) s before asking again\.$/, (m) => `Poczekaj ${m[1]} s, zanim poprosisz znowu.`],
    [/^Asked (.+), who leads (.+)'s party, to let you join\.$/, (m) => `Poproszono ${m[1]}, przywódcę drużyny ${m[2]}, o dołączenie.`],
    [/^Asked (.+) to let you join\.$/, (m) => `Poproszono ${m[1]} o dołączenie.`],
    [/^(.+) asks to join your party$/, (m) => `${m[1]} prosi o dołączenie do twojej drużyny`],
    [/^Level (\d+) · friend of (.+) · party (\d+)\/(\d+)$/, (m) => `Poziom ${m[1]} · przyjaciel: ${m[2]} · drużyna ${m[3]}/${m[4]}`],
    [/^Level (\d+) · party (\d+)\/(\d+)$/, (m) => `Poziom ${m[1]} · drużyna ${m[2]}/${m[3]}`],
    [/^(.+) said yes\. Accept their party invite at the top\.$/, (m) => `${m[1]} się zgadza. Przyjmij zaproszenie do drużyny u góry.`],
    [/^(.+) can't take you in right now\.$/, (m) => `${m[1]} nie może cię teraz przyjąć.`],
    [/^(.+)'s party is full\.$/, (m) => `Drużyna ${m[1]} jest pełna.`],
    [/^No answer from (.+)\.$/, (m) => `Brak odpowiedzi od ${m[1]}.`],
    [/^Level (\d+) · (.+)$/, (m) => `Poziom ${m[1]} · ${m[2].split(" · ").map(part).join(" · ")}`],
    [/^You turned down (.+)\.$/, (m) => `Odmawiasz: ${m[1]}.`],
  );
})();
