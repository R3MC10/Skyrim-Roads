/* i18n_pcupdate.js: Polish for the PC update card (pcupdate.js) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with build numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "New version": "Nowa wersja",
    "Updating": "Aktualizacja",
    "Update ready": "Aktualizacja gotowa",
    "Restart to update": "Uruchom ponownie",
    "Download": "Pobierz",
    "Later": "Później",
    "Hide": "Ukryj",
    "Unpacking the new files…": "Rozpakowywanie nowych plików…",
    "Restarting on the new version…": "Uruchamianie nowej wersji…",
    "Installing the new app…": "Instalowanie nowej aplikacji…",
    "Downloading the full game": "Pobieranie całej gry",
    "Finish what you're doing first (a fight, a dungeon, a trade or a menu), then press it again.":
      "Najpierw skończ to, co robisz (walkę, loch, handel albo menu), a potem naciśnij jeszcze raz.",
    "This build needs the new app: get it from the page that just opened (your saves stay).":
      "Ta wersja potrzebuje nowej aplikacji: pobierz ją ze strony, która właśnie się otworzyła (zapisy zostają).",
    // patch note
    "The PC game updates itself": "Gra na PC sama się aktualizuje",
    "On Windows the game now updates by itself in the background, the installed and the portable version alike: no more downloading a new setup for every build.":
      "Na Windowsie gra sama aktualizuje się w tle, zarówno zainstalowana, jak i przenośna wersja: koniec z pobieraniem nowego instalatora przy każdej wersji.",
    "Usually only the files that changed get downloaded, so an update is often just a few megabytes. A card in the corner shows how far along it is.":
      "Zwykle pobierają się tylko pliki, które się zmieniły, więc aktualizacja to często kilka megabajtów. Karta w rogu pokazuje postęp.",
    "When it's ready the card says Restart to update. On the title screen it switches over by itself, and otherwise the new version starts the next time you open the game. Your saves stay.":
      "Gdy będzie gotowa, karta pokaże Uruchom ponownie. Na ekranie tytułowym gra przełącza się sama, a w innym wypadku nowa wersja włączy się przy następnym uruchomieniu gry. Zapisy zostają.",
    "If a new version ever fails to start, the game goes back to the one before by itself and skips the broken one.":
      "Jeśli nowa wersja kiedyś się nie uruchomi, gra sama wróci do poprzedniej i pominie tę zepsutą.",
    "The title screen's Update page now works on PC too. The whole app only downloads again when the app itself changes.":
      "Strona Aktualizacja na ekranie tytułowym działa teraz także na PC. Cała aplikacja pobiera się od nowa tylko wtedy, gdy zmienia się sama aplikacja.",
    "Older PC copies need the new version once (from the GitHub page); after that they keep themselves up to date.":
      "Starsze kopie na PC potrzebują nowej wersji jeden raz (ze strony GitHub); potem same dbają o aktualność.",
  });
  I18N_EXTRA.pat.push(
    [/^Downloading build (\d+)… (\d+)%$/, (m) => `Pobieranie wersji ${m[1]}… ${m[2]}%`],
    [/^Downloading build (\d+)…$/, (m) => `Pobieranie wersji ${m[1]}…`],
    [/^Downloading… (\d+)%$/, (m) => `Pobieranie… ${m[1]}%`],
    [/^Build (\d+) is downloaded\. Restart to play it now, or keep playing: it switches over on the title screen or the next time you open the game\.$/,
      (m) => `Wersja ${m[1]} jest pobrana. Uruchom grę ponownie, żeby w nią zagrać, albo graj dalej: przełączy się na ekranie tytułowym albo przy następnym uruchomieniu gry.`],
    [/^The new app \(build (\d+)\) is downloaded\. Restart to install it: your saves stay\. It also installs by itself when you close the game\.$/,
      (m) => `Nowa aplikacja (wersja ${m[1]}) jest pobrana. Uruchom ponownie, żeby ją zainstalować: zapisy zostają. Zainstaluje się też sama, gdy zamkniesz grę.`],
    [/^Build (\d+) needs a new version of the app\. Downloading it in the background… (\d+)%$/,
      (m) => `Wersja ${m[1]} potrzebuje nowej aplikacji. Pobieranie w tle… ${m[2]}%`],
    [/^Build (\d+) needs a new version of the app, and it couldn't download by itself\. Get the new setup once: your saves stay\.$/,
      (m) => `Wersja ${m[1]} potrzebuje nowej aplikacji, a ta nie pobrała się sama. Pobierz nowy instalator jeden raz: zapisy zostają.`],
    [/^Build (\d+) is out, you're on (\d+), and the game hasn't updated itself\. Download the new setup once and run it: your saves stay\.$/,
      (m) => `Wyszła wersja ${m[1]}, masz ${m[2]}, a gra sama się nie zaktualizowała. Pobierz raz nowy instalator i uruchom go: zapisy zostają.`],
    [/^Build (\d+) is out \(you're on (\d+)\)\. This portable version needs the new one: download it once, and from then on it updates the game by itself\. Your saves stay\.$/,
      (m) => `Wyszła wersja ${m[1]} (masz ${m[2]}). Ta przenośna wersja potrzebuje nowej: pobierz ją raz, a od tej pory sama będzie aktualizować grę. Zapisy zostają.`],
    [/^Game build (\d+)( \(portable\))?: new game files download by themselves and switch over on the title screen, no reinstall\.(.*)$/,
      (m) => `Wersja gry ${m[1]}${m[2] ? " (przenośna)" : ""}: nowe pliki gry pobierają się same i przełączają na ekranie tytułowym, bez ponownej instalacji.${m[3] ? m[3].replace(/^ The last download didn't work \((.*)\); it tries again by itself\.$/, " Ostatnie pobieranie się nie udało ($1); gra spróbuje ponownie sama.") : ""}`],
  );
})();
