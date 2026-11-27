/* i18n_npctasks.js: Polish for npctasks.js (NPC tasks in the Journal). Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Quest added": "Nowe zadanie",
  "Every job you take is in the Journal": "Każde wzięte zlecenie jest w Dzienniku",
  "Every job, rumour and contract you take from someone in the world is in the Journal now: notice-board jobs, odd jobs at farms and camps, rumours from innkeepers and townsfolk, legendary hunts from a Jarl's steward, a Daedric prince's contract, your company's caravan escort and expedition.":
    "Każde zlecenie, plotka i kontrakt, które od kogoś bierzesz, jest teraz w Dzienniku: zlecenia z tablic ogłoszeń, dorywcze prace na farmach i w obozach, plotki od karczmarzy i mieszkańców, legendarne łowy od zarządcy jarla, kontrakt z daedrycznym księciem, eskorta karawany i wyprawa twojej kompanii.",
  "Each one shows who gave it and where, what to do next, how far along you are (like 3/5), how long you have left, and the reward. ☆ Track it to steer the compass, the map and the What to do next card, just like a quest.":
    "Każde pokazuje, kto je dał i gdzie, co dalej zrobić, ile już masz (np. 3/5), ile zostało czasu i jaka jest nagroda. ☆ Śledź je, a kompas, mapa i karta Co dalej poprowadzą cię jak przy zadaniu.",
  "Taking a new task pops up a small \"Quest added\" card with a Track button. Tasks you finish move to Completed, and you can give one up from the Journal (tap Abandon twice).":
    "Gdy weźmiesz nowe zadanie, pojawia się mała karta \"Nowe zadanie\" z przyciskiem Śledź. Ukończone trafiają do Ukończonych, a zadanie możesz porzucić w Dzienniku (dotknij Porzuć dwa razy).",
  "Jobs from the notice boards": "Zlecenia z tablic ogłoszeń",
  "Rumours to check": "Plotki do sprawdzenia",
  "Contracts": "Kontrakty",
  "Finished tasks": "Ukończone zadania",
  "Abandon": "Porzuć",
  "Tap again to give it up": "Dotknij jeszcze raz, by porzucić",
  "Hand it in": "Oddaj",
  "Out of time": "Czas minął",
  "Escort a caravan": "Eskortuj karawanę",
  "The Jarl's steward": "Zarządca jarla",
  "A worried local": "Zmartwiony mieszkaniec",
  "Travellers on the road": "Podróżni na drodze",
  "Townsfolk": "Mieszkańcy",
  "The company's planning table": "Stół planów kompanii",
  "Whatever's there, if it's true": "To, co tam jest, jeśli to prawda",
  "Company pay": "Zapłata kompanii",
  "Company renown and pay": "Sława i zapłata kompanii",
  "You put the rumour out of your mind.": "Wyrzucasz plotkę z głowy.",
  "You leave the caravan to find its own way.": "Zostawiasz karawanę, niech radzi sobie sama.",
  "You step out of tonight's expedition.": "Wycofujesz się z dzisiejszej wyprawy.",
  "Tracking it: the compass and the map show the way.": "Śledzisz je: kompas i mapa pokazują drogę.",
  "Every job, rumour and contract you take from someone in the world is in the Journal now":
    "Każde zlecenie, plotka i kontrakt, które od kogoś bierzesz, jest teraz w Dzienniku",
});
I18N_EXTRA.pat = I18N_EXTRA.pat || [];
I18N_EXTRA.pat.push(
  [/^Clear out (.+)$/, (m) => `Oczyść ${m[1]}`],
  [/^A parcel for (.+)$/, (m) => `Paczka do ${m[1]}`],
  [/^Take the parcel to (.+)\.$/, (m) => `Zanieś paczkę do ${m[1]}.`],
  [/^Go to (.+) and see if it's true\.$/, (m) => `Idź do ${m[1]} i sprawdź, czy to prawda.`],
);
