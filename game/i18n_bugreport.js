/* i18n_bugreport.js: Polish for bugreport.js (the Report a problem window) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Report a problem": "Zgłoś problem",
    "\uE105 Report a problem": "\uE105 Zgłoś problem",
    "On a PC, F12 opens it from anywhere.": "Na PC otworzysz to zewsząd klawiszem F12.",
    "Tell us what went wrong or what could be better. It goes straight to the people fixing the game.": "Napisz, co poszło nie tak albo co może być lepsze. Trafi to prosto do tych, którzy poprawiają grę.",
    "Short title": "Krótki tytuł",
    "What happened?": "Co się stało?",
    "e.g. Can't sell the iron sword": "np. Nie mogę sprzedać żelaznego miecza",
    "What did you do, what did you expect, what happened instead?": "Co robiłeś, czego się spodziewałeś, co stało się zamiast tego?",
    "We also attach the game build, your device type and screen size, your art style, where you are, your level and the game's recent error log. Nothing personal beyond your player and hero names.":
      "Dołączamy też wersję gry, rodzaj urządzenia i rozmiar ekranu, styl grafiki, miejsce, w którym jesteś, twój poziom i ostatnie błędy gry. Nic osobistego poza nazwą gracza i imieniem bohatera.",
    "We also attach the game build, your device type and screen size, your art style, where you are, your level and the game's recent error log. Nothing personal beyond your hero's name.":
      "Dołączamy też wersję gry, rodzaj urządzenia i rozmiar ekranu, styl grafiki, miejsce, w którym jesteś, twój poziom i ostatnie błędy gry. Nic osobistego poza imieniem bohatera.",
    "Sending…": "Wysyłanie…",
    "Report sent, thanks!": "Zgłoszenie wysłane, dzięki!",
    "Saved, will send when online": "Zapisane, wyślemy, gdy będzie internet",
    "Write a short title or a few words about what happened.": "Wpisz krótki tytuł albo kilka słów o tym, co się stało.",
    "The server didn't take that report. Try writing it a bit differently.": "Serwer nie przyjął zgłoszenia. Spróbuj napisać je trochę inaczej.",
    // patch note
    "Report a problem from inside the game": "Zgłaszaj problemy prosto z gry",
    "Found a bug, a wrong number or a typo? Press F12 on a PC, or open Settings and tap Report a problem on your phone.":
      "Znalazłeś błąd, złą liczbę albo literówkę? Na PC naciśnij F12, a na telefonie otwórz Ustawienia i stuknij Zgłoś problem.",
    "Write a short title and what happened, pick a kind (bug, balance, art, text or idea) and send. It goes straight to the people fixing the game.":
      "Wpisz krótki tytuł i co się stało, wybierz rodzaj (błąd, balans, grafika, tekst albo pomysł) i wyślij. Trafi to prosto do tych, którzy poprawiają grę.",
    "The report brings along what helps find the problem: the game build, your device type, screen size, art style, where you are, your level and the game's recent errors. Nothing personal beyond your hero's name.":
      "Zgłoszenie zabiera ze sobą to, co pomaga znaleźć problem: wersję gry, rodzaj urządzenia, rozmiar ekranu, styl grafiki, miejsce, w którym jesteś, twój poziom i ostatnie błędy gry. Nic osobistego poza imieniem bohatera.",
    "No connection? The report waits on your device and sends itself later.":
      "Brak internetu? Zgłoszenie poczeka na urządzeniu i wyśle się samo później.",
    // patch note: your name goes with reports
    "Reports show who sent them": "Zgłoszenia pokazują, kto je wysłał",
    "When you report a problem, your player name (your account name, or your hero's name if you're not signed in) now goes with it, so we know who to ask if we need more details.":
      "Gdy zgłaszasz problem, dołączamy teraz twoją nazwę gracza (nazwę konta, a bez logowania imię bohatera), żebyśmy wiedzieli, kogo dopytać o szczegóły.",
    "The report window shows the name it's sent as, right above the Send button.": "Okno zgłoszenia pokazuje, pod jaką nazwą je wyślesz, tuż nad przyciskiem Wyślij.",
  });
  I18N_EXTRA.pat = I18N_EXTRA.pat || [];
  I18N_EXTRA.pat.push([/^Sent as (.+)$/, (m) => `Wysyłasz jako ${m[1]}`]);
  // short words: only add them if no other file already translates them (so nothing else changes)
  const SHORT = { "Help": "Pomoc", "Kind": "Rodzaj", "Bug": "Błąd", "Balance": "Balans", "Art": "Grafika", "Text": "Tekst", "Idea": "Pomysł", "Cancel": "Anuluj", "Send": "Wyślij" };
  for (const [en, pl] of Object.entries(SHORT)) if (!(en in I18N_EXTRA.words)) I18N_EXTRA.words[en] = pl;
})();
