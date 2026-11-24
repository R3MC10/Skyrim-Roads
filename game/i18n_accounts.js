/* i18n_accounts.js: Polish for accounts (account.js): sign in, your characters, playing on one device at a time, the two
   copies choice, and their patch note. Loaded before i18n.js; exact lines go in I18N_EXTRA.words (merged into I18N.PL). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // title menu and the account page
    "Sign in": "Zaloguj się", "Account": "Konto", "Keep your characters on every device": "Twoje postacie na każdym urządzeniu",
    "Signed out (playing elsewhere)": "Wylogowano (grasz gdzie indziej)",
    "Create account": "Załóż konto", "Your account": "Twoje konto", "Your characters": "Twoje postacie",
    "Username": "Nazwa użytkownika", "Password": "Hasło", "Password again": "Powtórz hasło",
    "3–20 letters or numbers": "3–20 liter lub cyfr", "At least 8 characters": "Co najmniej 8 znaków",
    "I already have an account": "Mam już konto", "New here? Create an account": "Pierwszy raz? Załóż konto",
    "One moment…": "Chwileczkę…", "Play here": "Graj tutaj", "Playing": "Grasz", "Upload": "Wyślij",
    "New character": "Nowa postać", "Sign out": "Wyloguj się", "Loading…": "Wczytywanie…",
    "No characters on your account yet.": "Na koncie nie ma jeszcze postaci.",
    "Play your characters on any device, one at a time.": "Graj swoimi postaciami na dowolnym urządzeniu, na jednym naraz.",
    "Just a name and a password: no email needed. Your characters are kept on the server so you can play them on any device.":
      "Wystarczy nazwa i hasło, bez e-maila. Twoje postacie są przechowywane na serwerze, więc zagrasz nimi na każdym urządzeniu.",
    "There's no email, so keep your password safe: it can't be reset yet.": "Konto nie ma e-maila, więc pilnuj hasła: na razie nie da się go zresetować.",
    "The two passwords don't match.": "Hasła się różnią.",
    "Signed out. The character on this device stays here.": "Wylogowano. Postać z tego urządzenia zostaje tutaj.",
    "Loading your character…": "Wczytywanie postaci…", "Uploading…": "Wysyłanie…",
    // play here? / another device
    "Play here?": "Grać tutaj?", "Keep playing there": "Graj dalej tam",
    "Your account can play on one device at a time.": "Na koncie można grać na jednym urządzeniu naraz.",
    "Playing on another device": "Grasz na innym urządzeniu", "Play here instead": "Przenieś grę tutaj",
    "Keep playing here, offline": "Graj tu dalej, bez sieci",
    "Offline, this device's character stops saving to your account.": "Bez sieci postać na tym urządzeniu przestaje zapisywać się na koncie.",
    // two copies
    "On your account": "Na koncie", "On this device": "Na tym urządzeniu",
    "Use the account copy": "Użyj kopii z konta", "Keep this device's copy": "Zachowaj kopię z tego urządzenia",
    "Nothing is lost: the copy you don't keep goes into this device's automatic backups (Settings → Restore).":
      "Nic nie przepada: kopia, której nie zachowasz, trafia do automatycznych kopii zapasowych tego urządzenia (Ustawienia → Przywróć).",
    // server messages shown as they come
    "Wrong username or password.": "Zła nazwa użytkownika lub hasło.", "That username is taken.": "Ta nazwa jest już zajęta.",
    "Usernames are 3–20 letters, numbers, _ or -.": "Nazwa to 3–20 liter, cyfr, _ lub -.",
    "Use at least 8 characters for your password.": "Hasło musi mieć co najmniej 8 znaków.", "Your password can't be your username.": "Hasło nie może być takie samo jak nazwa.",
    "Too many tries. Wait a few minutes and try again.": "Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.",
    "Can't reach the server. Check your connection and try again.": "Nie można połączyć się z serwerem. Sprawdź połączenie i spróbuj ponownie.",
    "Please sign in again.": "Zaloguj się ponownie.", "Please sign in.": "Zaloguj się.",
    "You were away a long time. Please sign in again.": "Długo cię nie było. Zaloguj się ponownie.",
    "An account holds up to 12 characters.": "Konto mieści do 12 postaci.",
    "Couldn't check your account. Try again.": "Nie udało się sprawdzić konta. Spróbuj ponownie.",
    "No connection: nothing was changed. Try again when you're online.": "Brak połączenia: nic nie zmieniono. Spróbuj ponownie, gdy będziesz w sieci.",
    // the patch note
    "Accounts: your characters on every device": "Konta: twoje postacie na każdym urządzeniu",
    "New on the title screen: Sign in.": "Nowość na ekranie tytułowym: Zaloguj się.",
    "Make an account with just a name and a password (no email needed) and your characters are kept safe on our server.":
      "Załóż konto, podając tylko nazwę i hasło (bez e-maila), a twoje postacie będą bezpieczne na naszym serwerze.",
    "Play the same character on your phone, another phone or the PC: under Account, tap Play here.":
      "Graj tą samą postacią na swoim telefonie, innym telefonie albo na PC: w Koncie dotknij Graj tutaj.",
    "Upload the character you already have with one tap; nothing is lost.": "Wyślij postać, którą już masz, jednym dotknięciem; nic nie przepada.",
    "One device at a time: if you sign in somewhere else, the game asks whether to play there instead.":
      "Jedno urządzenie naraz: jeśli zalogujesz się gdzie indziej, gra zapyta, czy przenieść grę tam.",
    "The other device is told right away and stops saving, so your two devices never fight over your progress.":
      "Drugie urządzenie od razu się o tym dowiaduje i przestaje zapisywać, więc twoje urządzenia nigdy nie pokłócą się o postępy.",
    "Your progress saves to your account a few seconds after you play, and catches up by itself when you're back online.":
      "Postępy zapisują się na koncie kilka sekund po grze i same się nadrabiają, gdy wrócisz do sieci.",
    "If a character was played somewhere else in the meantime, you choose which copy to keep.":
      "Jeśli w międzyczasie postać była używana gdzie indziej, wybierasz, którą kopię zachować.",
    "Signed in, the shared world (other players, parties, chat, trades, the market) comes through our server too, so friends see each other more reliably.":
      "Po zalogowaniu wspólny świat (inni gracze, drużyny, czat, wymiany, targ) też przechodzi przez nasz serwer, więc znajomi widzą się nawzajem pewniej.",
    "Not signed in?": "Nie logujesz się?", "Everything works exactly as before.": "Wszystko działa dokładnie tak jak wcześniej.",
    "There's no email on accounts yet, so keep your password safe: it can't be reset for now.": "Konta nie mają jeszcze e-maila, więc pilnuj hasła: na razie nie da się go zresetować.",
  });
})();
