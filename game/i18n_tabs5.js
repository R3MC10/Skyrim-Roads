/* i18n_tabs5.js: Polish for the five bottom tabs (menus.js, ui.js, pcmap.js) and their patch note. Loaded before i18n.js. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "World": "Świat",
    "Hero": "Bohater",
    "Places": "Miejsca",
    "Every place you know": "Wszystkie znane ci miejsca",
    "Every place you know · search and filters": "Wszystkie znane ci miejsca · szukaj i filtruj",
    "Your goal and how to get there": "Twój cel i jak tam dojść",
    "Your gear, items, magic, skills and perks": "Twój ekwipunek, przedmioty, magia, umiejętności i atuty",
    "Hero · perks · stats": "Bohater · atuty · statystyki",
    "Map and travel": "Mapa i podróże",
    "Open Hero to choose what grows.": "Otwórz Bohatera i wybierz, co ma rosnąć.",
    "Search or filter the places you know and press Go to travel there. Cleared places show when they fill up again.":
      "Szukaj lub filtruj znane ci miejsca i naciśnij Idź, żeby tam ruszyć. Oczyszczone miejsca pokazują się, gdy znów się zapełnią.",
    "The card under the map is the one thing to do next. Press Go to walk there: trips keep going while the app is closed. The gold ◆ on the map is your current quest; tap empty ground to roam off the road. Places lists every place you know.":
      "Karta pod mapą to jedna rzecz do zrobienia teraz. Naciśnij Idź, żeby tam ruszyć: podróż trwa, nawet gdy aplikacja jest zamknięta. Złoty ◆ na mapie to twoje obecne zadanie; stuknij puste miejsce, żeby zejść z drogi. Miejsca to lista wszystkich znanych ci miejsc.",
    "Your hero and what they wear. The strip on top opens Items, Magic, Skills, Perks, Stats, your follower and Settings. When you level up, choose Health, Magicka or Stamina and spend perk points in a skill's tree.":
      "Twój bohater i to, co nosi. Pasek na górze otwiera Przedmioty, Magię, Umiejętności, Atuty, Statystyki, twojego towarzysza i Ustawienia. Gdy awansujesz, wybierz Zdrowie, Magię lub Wytrzymałość i wydaj punkty atutów w drzewku umiejętności.",
    "Active quests sit on shelves: main story, Solstheim, Civil War, guilds, Daedric and side quests. Misc holds jobs, bounties, cures and treasure maps. ☆ Track a quest to steer the compass, the map and the What to do next card. Discoveries, Achievements and your Diary are in the strip on top; friends, party and clan are under Social.":
      "Aktywne zadania stoją na półkach: główna historia, Solstheim, wojna domowa, gildie, zadania daedryczne i poboczne. W Różnych są prace, nagrody za głowy, lekarstwa i mapy skarbów. ☆ Śledź zadanie, a kompas, mapa i karta Co dalej poprowadzą cię do niego. Odkrycia, Osiągnięcia i twój Pamiętnik są na pasku u góry; znajomi, drużyna i klan są w Społeczności.",
    "On the World tab, tap a town on the map or pick one under Where to?. You keep walking even when the app is closed.":
      "Na karcie Świat stuknij miasto na mapie albo wybierz je pod Dokąd?. Idziesz dalej, nawet gdy aplikacja jest zamknięta.",
    // patch note
    "Five tabs instead of seven": "Pięć kart zamiast siedmiu",
    "The bar at the bottom now has five tabs: World, Area, Hero, Journal and Social.":
      "Pasek na dole ma teraz pięć kart: Świat, Okolica, Bohater, Dziennik i Społeczność.",
    "World is the map: under it you see the one thing to do next and a big Where to? button for every place you know. World news has its own page there once world events are open for you.":
      "Świat to mapa: pod nią widzisz jedną rzecz do zrobienia teraz i duży przycisk Dokąd? ze wszystkimi znanymi ci miejscami. Wieści ze świata mają tam własną stronę, gdy wydarzenia świata się dla ciebie otworzą.",
    "Hero holds everything about your hero in one place: your gear, items, magic, skills, perks, stats, your follower and Settings, in the strip on top.":
      "Bohater trzyma wszystko o twojej postaci w jednym miejscu: ekwipunek, przedmioty, magię, umiejętności, atuty, statystyki, towarzysza i Ustawienia, na pasku u góry.",
    "Journal holds your quests, discoveries, achievements and diary. Social holds your friends, party and clan.":
      "Dziennik trzyma twoje zadania, odkrycia, osiągnięcia i pamiętnik. Społeczność trzyma znajomych, drużynę i klan.",
    "Under the map there's less clutter: the World news drawer and event cards wait on the World news page, and the weather shows only in the line at the top.":
      "Pod mapą jest mniej bałaganu: szuflada Wieści ze świata i karty wydarzeń czekają na stronie Wieści ze świata, a pogoda widnieje tylko w linijce u góry.",
    "Back works the same as before: from a page inside a tab it goes to that tab's first page, then to the map.":
      "Wstecz działa jak dawniej: ze strony w karcie wraca na pierwszą stronę tej karty, a potem na mapę.",
    "On a PC: the bottom bar has the same five tabs, the open one lights up, and keys 1 to 5 open them (or M, A, C, J, O; I and P still open Items and Magic, L opens Where to?). Hover a tab to see its keys.":
      "Na PC: dolny pasek ma te same pięć kart, otwarta jest podświetlona, a klawisze 1–5 je otwierają (albo M, A, C, J, O; I i P nadal otwierają Przedmioty i Magię, L otwiera Dokąd?). Najedź na kartę, żeby zobaczyć jej klawisze.",
    "On a PC, Hero, Journal and Social use the whole screen: the pages of a tab are listed down the left and the cards sit in two columns. Places and World news open beside the map so you can still see it.":
      "Na PC Bohater, Dziennik i Społeczność zajmują cały ekran: strony karty są w liście po lewej, a karty stoją w dwóch kolumnach. Miejsca i Wieści ze świata otwierają się obok mapy, więc nadal ją widzisz.",
  });
  I18N_EXTRA.pat.push(
    [/^(World|Area|Hero|Journal|Social) \(([A-Z]) · (\d)\)$/, (m) => `${({ World: "Świat", Area: "Okolica", Hero: "Bohater", Journal: "Dziennik", Social: "Społeczność" })[m[1]]} (${m[2]} · ${m[3]})`],
  );
})();
