/* i18n.js: Polish translation (first pass: menus, buttons, tabs, settings, skills, stats).
   Language is picked automatically from the phone/PC language (Polish → Polish, anything else → English),
   and can be changed in Settings → Language. Works by swapping text on screen as it appears, so game code stays English;
   text not in the list (stories, quests, item descriptions) stays English for now. */
const I18N = (() => {
  const KEY = "rotn_prefs";
  const pref = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}").lang || "auto"; } catch { return "auto"; } };
  const auto = () => { try { return [...(navigator.languages || []), navigator.language || ""].some((l) => /^pl\b/i.test(l)) ? "pl" : "en"; } catch { return "en"; } };
  const lang = () => { const p = pref(); return p === "auto" ? auto() : p; };

  /* skills, with official Polish Skyrim names where they exist */
  const SKILLS = { "One-Handed": "Broń jednoręczna", "Two-Handed": "Broń dwuręczna", Archery: "Łucznictwo", Blocking: "Blokowanie", Smithing: "Kowalstwo",
    "Heavy Armor": "Ciężki pancerz", "Light Armor": "Lekki pancerz", "Medium Armor": "Średni pancerz", Pickpocket: "Kieszonkostwo", Lockpicking: "Otwieranie zamków",
    Sneak: "Skradanie się", Alchemy: "Alchemia", Speechcraft: "Elokwencja", Alteration: "Przemiana", Conjuration: "Przywołanie", Destruction: "Zniszczenie",
    Enchanting: "Zaklinanie", Illusion: "Iluzja", Restoration: "Przywrócenie", Athletics: "Atletyka", Acrobatics: "Akrobatyka", Mercantile: "Handel",
    Unarmored: "Bez pancerza", Mysticism: "Mistycyzm", Etiquette: "Etykieta", Streetwise: "Znajomość ulic", "Hand-to-Hand": "Walka wręcz", Spear: "Włócznia" };

  const PL = Object.assign({}, SKILLS, {
    // general
    On: "Wł.", Off: "Wył.", Go: "Idź", Yes: "Tak", No: "Nie", Back: "Wstecz", Menu: "Menu", Open: "Otwórz", Close: "Zamknij", Edit: "Edytuj", Remove: "Usuń",
    Search: "Szukaj", Name: "Nazwa", Auto: "Auto", All: "Wszystko", Other: "Inne", Misc: "Różne", Full: "Pełny", Lite: "Lekki", Fast: "Szybko", Normal: "Normalny",
    Big: "Duży", Bigger: "Większy", Biggest: "Największy", Never: "Nigdy", Always: "Zawsze", Freely: "Swobodnie", Today: "Dziś", Begin: "Zacznij", Look: "Wygląd",
    Style: "Styl", Value: "Wartość", Cost: "Koszt", Buy: "Kup", Sell: "Sprzedaj", Take: "Weź", Share: "Udostępnij", Ready: "Gotowe", ready: "gotowe", Active: "Aktywne",
    Newest: "Najnowsze", Completed: "Ukończone", Tracked: "Śledzone", "★ Tracked": "★ Śledzone", "Not now": "Nie teraz", "Show me": "Pokaż", "Carry on": "Dalej",
    "Close up": "Zbliż", "Move up": "W górę", "Move down": "W dół", "Sort:": "Sortuj:", "Name ▾": "Nazwa ▾", "Main": "Główny", "Main menu": "Menu główne",
    "Back to the main menu": "Wróć do menu głównego", "Close menu": "Zamknij menu", "Tap to begin": "Dotknij, aby zacząć", "Unrolling the map…": "Rozwijanie mapy…",
    "Roads of the North": "Drogi Północy", "Skyrim: Roads of the North": "Skyrim: Drogi Północy", "Continue": "Dalej", "CONTINUE": "DALEJ", "Save and play": "Zapisz i graj",
    // bottom bar and screens
    Character: "Postać", Items: "Przedmioty", Magic: "Magia", Map: "Mapa", Journal: "Dziennik", Social: "Społeczność", Town: "Miasto", Area: "Okolica", Skills: "Umiejętności",
    Perks: "Atuty", Tactics: "Taktyka", Stats: "Statystyki", Diary: "Pamiętnik", Library: "Biblioteka", Achievements: "Osiągnięcia", Settings: "Ustawienia",
    Locations: "Lokacje", "World news": "Wieści ze świata", Quests: "Zadania", Party: "Drużyna", Friends: "Przyjaciele", Messages: "Wiadomości", Chat: "Czat",
    Clans: "Klany", Realm: "Królestwo", Shops: "Sklepy", Services: "Usługi", Trainers: "Trenerzy", Forge: "Kuźnia", Jobs: "Zlecenia", Trades: "Wymiany",
    Compass: "Kompas", Pack: "Plecak", Spells: "Zaklęcia", Powers: "Moce", Shouts: "Okrzyki", Potions: "Mikstury", Weapons: "Broń", weapons: "broń",
    "Powers & shouts": "Moce i okrzyki", "Shouts & powers": "Okrzyki i moce", "Help & tips": "Pomoc i porady", "Help & news": "Pomoc i wieści", "Guilds & jobs": "Gildie i zlecenia",
    "Friends and messages": "Przyjaciele i wiadomości", "👥 Friends & messages": "👥 Przyjaciele i wiadomości", "Settings and menu": "Ustawienia i menu",
    "Open the menu compass": "Otwórz kompas menu", "Favourites wheel": "Koło ulubionych", "Search everything": "Szukaj wszędzie", "Search places": "Szukaj miejsc",
    "Search players by name": "Szukaj graczy po nazwie", "Add a friend": "Dodaj przyjaciela", "📥 Paste a code": "📥 Wklej kod", "📋 Copy share code": "📋 Kopiuj kod",
    "📜 Journal": "📜 Dziennik", "📔 Diary": "📔 Pamiętnik", "📖 Books": "📖 Książki", "🔍 Secrets": "🔍 Sekrety", "✨ Uniques": "✨ Unikaty", "🎣 Fishing": "🎣 Wędkarstwo",
    "🌿 Gathering": "🌿 Zbieractwo", "🗺 Treasure": "🗺 Skarby", "📜 Patch notes": "📜 Zmiany w grze", "Patch Notes": "Zmiany w grze", "How to Play": "Jak grać",
    Updates: "Aktualizacje", Credits: "Twórcy", "Your quests": "Twoje zadania", "Main quest": "Główny wątek", "Quest givers": "Zleceniodawcy", "World events": "Wydarzenia świata",
    "Coming up:": "Wkrótce:", "Coming next": "Już wkrótce", "Coming next is up to date again": "Już wkrótce znów jest aktualne", "The Coming next box at the top of Patch notes now shows what's really being built, and it can't get stuck on an old list any more.": "Okienko Już wkrótce na górze Nowości pokazuje teraz to, co naprawdę powstaje, i nie utknie już na starej liście.", "A new, livelier fight screen that fits on one screen": "Nowy, żywszy ekran walki, który mieści się na jednym ekranie", "On PC, everything fits on one screen without scrolling": "Na PC wszystko mieści się na jednym ekranie, bez przewijania", "New painted dungeon rooms and a painted world map": "Nowe malowane komnaty lochów i malowana mapa świata", "More unique enchantments on gear": "Więcej wyjątkowych zaklęć na sprzęcie", "Being built now": "W budowie", "Market today": "Targ dzisiaj", "Market stalls": "Stragany",
    "General goods": "Towary ogólne", "General goods:": "Towary ogólne:", "Blacksmith": "Kowal", "Merchant": "Kupiec", "Alchemy lab": "Pracownia alchemiczna",
    "🍲 Cooking pot": "🍲 Kociołek", "Skill trainer": "Trener umiejętności", "Hirelings": "Najemnicy", "Show on map": "Pokaż na mapie", "Centre on me": "Wyśrodkuj na mnie",
    "Zoom map": "Przybliż mapę", "Map of Skyrim": "Mapa Skyrim", "Where to?": "Dokąd?", "Pick where to go": "Wybierz, dokąd iść", "Travel": "Podróż", "Gather": "Zbieraj",
    "🔍 Forage here": "🔍 Szukaj tu ziół", "Something nearby": "Coś w pobliżu", "Discoveries": "Odkrycia", "Cleared locations": "Oczyszczone miejsca",
    "📍 Locations: cleared places": "📍 Lokacje: oczyszczone miejsca", "Places discovered": "Odkryte miejsca", "📍 Places discovered:": "📍 Odkryte miejsca:",
    "No leads right now.": "Na razie brak tropów.", "Nobody here knows you yet.": "Nikt tu cię jeszcze nie zna.", "Your name in the holds": "Twoja sława w krainach",
    "What is this screen?": "Co to za ekran?", "Open the guide": "Otwórz poradnik", "📖 Guide for new players": "📖 Poradnik dla nowych graczy", "📖 New to the game?": "📖 Nowy w grze?",
    "What to do next": "Co dalej", "Next step: Travel to a town": "Następny krok: idź do miasta",
    // character
    Level: "Poziom", Health: "Zdrowie", Magicka: "Magia", Stamina: "Wytrzymałość", Gold: "Złoto", gold: "złota", Carry: "Udźwig", Carrying: "Niesiesz", Weight: "Waga",
    Armor: "Pancerz", Damage: "Obrażenia", "⚔ Damage": "⚔ Obrażenia", "🛡 Armor": "🛡 Pancerz", Head: "Głowa", Chest: "Tors", Hands: "Dłonie", Feet: "Stopy", Weapon: "Broń",
    Shield: "Tarcza", "Left hand": "Lewa ręka", "Right hand": "Prawa ręka", "Your perks": "Twoje atuty", "Perk points to spend:": "Punkty atutów do wydania:",
    "You haven't taken any perks yet.": "Nie masz jeszcze atutów.", "Ready to take": "Do wzięcia", "Active effects": "Aktywne efekty", "Your character": "Twoja postać",
    "Level, skills and perks": "Poziom, umiejętności i atuty", "Skill increases": "Wzrosty umiejętności", "Closest to going up": "Najbliżej awansu", "How to raise it": "Jak ją rozwinąć",
    "Dragon souls:": "Smocze dusze:", "Dragon souls held": "Posiadane smocze dusze", "No standing stone": "Brak kamienia przeznaczenia", "Gear you can see": "Widoczny ekwipunek",
    "What you carry and wear": "Co niesiesz i nosisz", "Sort your pack": "Uporządkuj plecak", "Value/wt": "Wartość/waga", Condition: "Stan",
    "Worse than what you wear": "Gorsze niż noszone", "Better than what you wear": "Lepsze niż noszone",
    // races
    Nord: "Nord", Imperial: "Cesarski", Breton: "Bretończyk", Redguard: "Redgard", Altmer: "Altmer", Bosmer: "Bosmer", Dunmer: "Dunmer", Orc: "Ork", Khajiit: "Khajiit", Argonian: "Argonianin",
    "Choose your race": "Wybierz rasę", "Your name": "Twoje imię", "e.g. Remigiusz": "np. Remigiusz", "Choose a nickname": "Wybierz pseudonim", "Your nickname": "Twój pseudonim",
    "Begin in Riverwood": "Zacznij w Riverwood", "Begin in Helgen": "Zacznij w Helgen",
    // stats
    "General stats": "Statystyki ogólne", "Days passed": "Minione dni", "Fish caught": "Złowione ryby", "Gold earned": "Zarobione złoto", "Gold spent": "Wydane złoto",
    "Highest level": "Najwyższy poziom", "Foes defeated": "Pokonani wrogowie", "Dragons slain": "Zabite smoki", "Items crafted": "Wykonane przedmioty", "Locks picked": "Otwarte zamki",
    "Pockets picked": "Okradzione kieszenie", "Potions brewed": "Uwarzone mikstury", "Dungeons cleared": "Oczyszczone lochy", "Quests completed": "Ukończone zadania",
    "Players defeated": "Pokonani gracze", "Questlines completed": "Ukończone wątki", "Arena wins": "Wygrane na arenie", "Jobs done": "Wykonane zlecenia",
    // settings
    Sound: "Dźwięk", Music: "Muzyka", Effects: "Efekty", Ambience: "Otoczenie", "All sound": "Cały dźwięk", "Art style": "Styl grafiki", Graphics: "Grafika", Lighting: "Oświetlenie", Low: "Niskie", High: "Wysokie",
    "Light and weather on the map and in place pictures: golden hours, lit towns at night, mist and moving clouds. Low is lighter on old phones.": "Światło i pogoda na mapie i na obrazkach miejsc: złota godzina, oświetlone miasta nocą, mgły i płynące chmury. Niskie mniej obciąża starsze telefony.", "Hand-drawn": "Rysowany", "Pixel art": "Pikselowy",
    Motion: "Ruch", Fights: "Walki", "Turn by turn": "Turowo", "Instant (auto)": "Od razu (auto)", "Foe turns": "Tury wroga", "Normal speed": "Normalna prędkość",
    "Replay speed": "Prędkość powtórki", Crafting: "Rzemiosło", "When you craft": "Przy wytwarzaniu", "Mini-games": "Minigry", "Quick craft": "Szybkie wytwarzanie",
    Survival: "Przetrwanie", "Cold meter": "Licznik zimna", "On (gentle)": "Wł. (łagodny)", Accessibility: "Dostępność", "Accessibility options": "Opcje dostępności",
    "Text size": "Rozmiar tekstu", "Reduce motion": "Mniej ruchu", "One-hand mode": "Tryb jednej ręki", "High-contrast text": "Tekst o wysokim kontraście",
    "Colour-blind help": "Pomoc dla daltonistów", Small: "Mały", Large: "Duży", Huge: "Ogromny", Red: "Czerwony", Green: "Zielony", Blue: "Niebieski",
    "Easy timing": "Łatwiejsze wyczucie czasu",
    "Pick the colour that's hard for you to see.": "Wybierz kolor, który trudno ci rozróżnić.",
    "For red-blindness (protanopia): health is orange, stamina yellow, safe things blue.": "Dla protanopii (słabe widzenie czerwieni): zdrowie jest pomarańczowe, wytrzymałość żółta, bezpieczne rzeczy niebieskie.",
    "For green-blindness (deuteranopia): health is orange, stamina yellow, safe things blue.": "Dla deuteranopii (słabe widzenie zieleni): zdrowie jest pomarańczowe, wytrzymałość żółta, bezpieczne rzeczy niebieskie.",
    "For blue-blindness (tritanopia): magicka is cyan, stamina pale, safe things teal.": "Dla tritanopii (słabe widzenie niebieskiego): magia jest turkusowa, wytrzymałość blada, bezpieczne rzeczy morskie.",
    "No screen shake, flashes or drifting. Auto follows your phone's setting. A few effects change the next time you open the game.": "Bez trzęsienia ekranu, błysków i dryfowania. Auto słucha ustawień telefonu. Niektóre efekty zmienią się przy następnym uruchomieniu gry.",
    "Moves the main buttons to the bottom, where your thumb is.": "Przenosi główne przyciski na dół, pod kciuk.",
    "Timed mini-games (mining, fishing, locks, dungeon rooms) give you more time and a wider sweet spot.": "Minigry na czas (kopanie, łowienie, zamki, komnaty lochów) dają więcej czasu i szersze pole trafienia.",
"First-time tips": "Porady na start", "Back up": "Kopia zapasowa", Restore: "Przywróć", "Restore from a backup": "Przywróć z kopii",
    "Start over": "Zacznij od nowa", "Deletes this character for good.": "Usuwa tę postać na zawsze.", "Map opens": "Mapa otwiera się", "Switch off": "Wyłącz",
    "After road events": "Po zdarzeniach na drodze", "Wait for me": "Czekaj na mnie", Language: "Język", "Automatic": "Automatycznie",
    // fights and tactics
    Combat: "Walka", Action: "Akcja", "Attack with weapon": "Atak bronią", "Power attack (stamina)": "Potężny atak (wytrzymałość)", "Block (10 stamina)": "Blok (10 wytrzymałości)",
    "Drink a health potion": "Wypij miksturę zdrowia", "How you fight": "Jak walczysz", "⚙ AI settings": "⚙ Ustawienia SI", "🧠 Smart AI": "🧠 Sprytna SI", "⚖ Balanced": "⚖ Zrównoważony",
    "⚔ Aggressive": "⚔ Agresywny", "🛡 Careful": "🛡 Ostrożny", "⚔ Melee": "⚔ Wręcz", "✨ Magic": "✨ Magia", "🏹 Ranged": "🏹 Dystans", "⚖ Hybrid": "⚖ Hybryda",
    Presets: "Gotowe zestawy", Loadouts: "Zestawy", "Add rule": "Dodaj regułę", "Add a rule": "Dodaj regułę", "Test fight": "Walka próbna", "Reset AI settings": "Resetuj ustawienia SI",
    "Save current as": "Zapisz obecne jako", "Drag to reorder": "Przeciągnij, by zmienić kolejność", "New loadout name": "Nazwa nowego zestawu", "📜 Custom tactics": "📜 Własna taktyka",
    Warrior: "Wojownik", Archer: "Łucznik", Healer: "Uzdrowiciel", Mage: "Mag", Thief: "Złodziej", Necromancer: "Nekromanta", Battlemage: "Magiczny wojownik", Barbarian: "Barbarzyńca",
    "Victory": "Zwycięstwo", "VICTORY": "ZWYCIĘSTWO", "Defeated": "Pokonany", "Fight": "Walcz", "Flee": "Uciekaj", "Sneak past": "Przemknij obok", "Fight it": "Walcz",
    "End turn": "Koniec tury", Attack: "Atak", Shoot: "Strzał", "Power attack": "Potężny atak", Guard: "Garda", "Shield up": "Tarcza w górę",
    // skill levels
    Novice: "Nowicjusz", Apprentice: "Uczeń", Adept: "Adept", Expert: "Ekspert", Master: "Mistrz", Healing: "Leczenie", Flames: "Płomienie",
    // potions
    "Potion of Healing": "Mikstura zdrowia", "Potion of Magicka": "Mikstura magii", "Potion of Stamina": "Mikstura wytrzymałości", "Potion of Minor Healing": "Słaba mikstura zdrowia",
    "Potion of Cure Disease": "Mikstura leczenia chorób",
  }, typeof I18N_LIVING !== "undefined" ? I18N_LIVING.pl : {});   // labels from i18n_living.js (the world remembers you)
  if (typeof I18N_BEAST !== "undefined") Object.assign(PL, I18N_BEAST.pl);

  /* patterns for text with numbers in it */
  const PAT = [
    [/^Level (\d+)$/, (m) => `Poziom ${m[1]}`],
    [/^(\d+) gold$/, (m) => `${m[1]} złota`],
    [/^Build (\d+) · (.+)$/, (m) => `Wersja ${m[1]} · ${m[2]}`],
    [/^(.+?) (\d+)$/, (m) => (SKILLS[m[1]] ? `${SKILLS[m[1]]} ${m[2]}` : null)],
    [/^(.+?) (\d+) → (\d+)$/, (m) => (SKILLS[m[1]] ? `${SKILLS[m[1]]} ${m[2]} → ${m[3]}` : null)],
    [/^Health: (.+)$/, (m) => `Zdrowie: ${m[1]}`], [/^Magicka: (.+)$/, (m) => `Magia: ${m[1]}`], [/^Stamina: (.+)$/, (m) => `Wytrzymałość: ${m[1]}`],
    [/^Achievements · (.+)$/, (m) => `Osiągnięcia · ${m[1]}`], [/^Show all (\d+)$/, (m) => `Pokaż wszystkie ${m[1]}`], [/^Show all (\d+) places$/, (m) => `Pokaż wszystkie ${m[1]} miejsc`],
    [/^Your friends · (\d+)$/, (m) => `Twoi przyjaciele · ${m[1]}`], [/^(\d+) perk points?$/, (m) => `Punkty atutów: ${m[1]}`], [/^Delete (.+)$/, (m) => `Usuń: ${m[1]}`],
    [/^You're in (.+)$/, (m) => `Jesteś w: ${m[1]}`], [/^Go to (.+)$/, (m) => `Idź do: ${m[1]}`], [/^Begin in (.+)$/, (m) => `Zacznij w: ${m[1]}`],
    [/^Continue to (.+)$/, (m) => `Dalej do: ${m[1]}`], [/^(\d+) of (\d+)$/, (m) => `${m[1]} z ${m[2]}`], [/^Level (\d+): (\d+)% to the next level$/, (m) => `Poziom ${m[1]}: ${m[2]}% do następnego`],
    [/^(\d+)\/(\d+) toward level (\d+)$/, (m) => `${m[1]}/${m[2]} do poziomu ${m[3]}`], [/^~(\d+) min$/, (m) => `~${m[1]} min`],
    [/^the title (.+)$/, (m) => `tytuł ${PL[m[1]] ?? m[1]}`],
    [/^(\d+) days? (\d+) h$/, (m) => `${m[1]} ${m[1] === "1" ? "dzień" : "dni"} ${m[2]} h`], [/^(\d.*) ago$/, (m) => `${tr(m[1]) ?? m[1]} temu`],
  ];
  /* lines added by feature modules (i18n_hsrooms.js and others): exact lines and number patterns; the lists above win */
  if (typeof I18N_EXTRA !== "undefined") { for (const [k, v] of Object.entries(I18N_EXTRA.words || {})) if (!(k in PL)) PL[k] = v; PAT.push(...(I18N_EXTRA.pat || [])); }
  /* story text: split into sentences, translate each one (exact, or a template whose {markers} are filled from the English) */
  const ST0 = typeof I18N_STORY !== "undefined" ? I18N_STORY : { ex: {}, pats: [] };
  const ST = { ex: ST0.ex || {}, pats: (ST0.pats || []).concat(typeof I18N_BEAST !== "undefined" ? I18N_BEAST.pats : []) };
  const SPLIT = /(?<=[.!?…])(\s+)|(?<=[.!?]["”])(\s+)/;
  let STP = null;
  function storyPats() {
    if (STP) return STP;
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    STP = ST.pats.map(([en, pl]) => {
      const names = [];
      const src = en.split(/(\{\w+\})/).map((part, i) => (i % 2 ? (names.push(part), "(.*?)") : esc(part))).join("");
      return { re: new RegExp("^" + src + "$"), names, pl, lead: en.replace(/\{\w+\}.*$/, "") };
    }).sort((a, b) => b.lead.length - a.lead.length);
    return STP;
  }
  /* a filled-in {marker}: a known word, a number pattern, or (if shorter) a sentence of its own */
  const fillWord = (v, s, d) => PL[v] ?? ST.ex[v] ?? pat(v) ?? (d < 3 && v.length < s.length && /[a-z]{2} [a-z]/i.test(v) ? sentence(v, d + 1) : null) ?? v;
  /* a list of them ("200 gold, Dawnguard Rune Axe"): each piece on its own */
  const fillList = (v, s, d) => (PL[v] == null && ST.ex[v] == null && v.includes(", ")) ? v.split(", ").map((x) => fillWord(x, s, d)).join(", ") : fillWord(v, s, d);
  const QUOTE = /^([“"„«]?)([\s\S]*?)([”"»]?)$/;
  function sentence(s, d = 0) {
    const ex = ST.ex[s] ?? PL[s];
    if (ex != null) return ex;
    for (const p of storyPats()) {
      if (p.lead && !s.startsWith(p.lead)) continue;
      const m = s.match(p.re); if (!m) continue;
      let out = p.pl;
      p.names.forEach((n, i) => { const v = m[i + 1]; out = out.split(n).join(fillList(v, s, d)); });
      return out;
    }
    const ic = s.match(/^([^\p{L}\p{N}\s"“„«(]{1,4}\s+)(.+)$/su);   // an icon in front: translate the rest
    if (ic && d < 3) { const r = sentence(ic[2], d + 1); if (r != null) return ic[1] + r; }
    const q = s.match(QUOTE);   // a sentence that opens or closes a quote: translate what's inside
    if (q && (q[1] || q[3]) && q[2] && d < 3) { const r = sentence(q[2], d + 1); if (r != null) return (q[1] ? "„" : "") + r + (q[3] ? "”" : ""); }
    return null;
  }
  function story(t) {
    const parts = t.split(SPLIT).filter((x) => x !== undefined);
    let hit = false;
    const out = parts.map((p) => { if (!p.trim()) return p; const r = sentence(p); if (r != null) { hit = true; return r; } return p; });
    return hit ? out.join("") : null;
  }
  const pat = (t) => { for (const [re, f] of PAT) { const m = t.match(re); if (m) { const r = f(m); if (r) return r; } } return null; };
  const cache = new Map(), done = new WeakMap();
  function tr(t) {
    if (cache.has(t)) return cache.get(t);
    let out = PL[t] ?? ST.ex[t] ?? null;
    if (out == null) out = pat(t);
    if (out == null && t.includes(" · ")) { const parts = t.split(" · "), tp = parts.map((p) => tr(p) ?? p); if (tp.some((p, i) => p !== parts[i])) out = tp.join(" · "); }
    if (out == null && /[a-z]{2} [a-z\d]/i.test(t)) out = story(t);
    if (cache.size < 5000) cache.set(t, out);
    return out;
  }
  function textNode(n) {
    const v = n.nodeValue; if (!v || done.get(n) === v) return;
    const t = v.trim(); if (t.length < 2) return;
    const r = tr(t); if (r == null) return;
    const nv = v.replace(t, r); done.set(n, nv); n.nodeValue = nv;
  }
  const ATTRS = ["placeholder", "aria-label", "title"];
  function el(e) { for (const a of ATTRS) { const v = e.getAttribute?.(a); if (v) { const r = tr(v.trim()); if (r != null && r !== v) e.setAttribute(a, r); } } }
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 || root.closest?.("script,style")) return;
    el(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else if (n.tagName !== "SCRIPT" && n.tagName !== "STYLE") el(n); }
  }
  function start() {
    if (lang() !== "pl" || typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    document.documentElement.lang = "pl";
    const go = () => {
      walk(document.body);
      new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") textNode(m.target); else if (m.type === "attributes") el(m.target); else m.addedNodes.forEach(walk); } })
        .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.body) go(); else addEventListener("DOMContentLoaded", go);
  }
  /* Settings → Language. seg is the settings screen's button-row helper. */
  const settingRow = (seg) => `<div class="setrow"><span>Language</span>${seg("lang", [["auto", "Automatic"], ["en", "English"], ["pl", "Polski"]], pref())}</div>`;
  function setPref(k, v) {
    if (k !== "lang") return false;
    try { const p = JSON.parse(localStorage.getItem(KEY) || "{}"); p.lang = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
    try { window.__ui?.save?.(); } catch { /* fine */ }
    location.reload();
    return true;
  }
  /* text built in code, translated at the source: t("Siege of {place}", { place }). Needed where the on-screen swap can't
     reach (canvas labels, journal lines) or where names sit inside a sentence. {x:lc} lowercases the value. String values
     under the keys foe, kind, title, phase and game (dragon kinds, titles…) are translated too. Unknown text stays English. */
  const TPL = {};
  const TKEYS = new Set(["foe", "kind", "title", "phase", "game"]);
  let LANG = null;
  const cur = () => LANG || (LANG = lang());
  function t(en, v) {
    const pl = cur() === "pl", src = (pl && TPL[en]) || en;
    if (!v) return src;
    return src.replace(/\{(\w+)(:lc)?\}/g, (m, k, lc) => {
      if (!(k in v)) return m;
      let x = v[k];
      if (pl && typeof x === "string" && TKEYS.has(k)) x = TPL[x] ?? PL[x] ?? x;   // names of things, never player or place names
      x = String(x ?? "");
      return lc ? x.toLowerCase() : x;
    });
  }
  /* other modules' lists: tpl for t(), exact for text that shows up on screen as it is (perk names, titles) */
  function add(tpl, exact) { Object.assign(TPL, tpl || {}); Object.assign(PL, exact || {}); cache.clear(); }

  // ---------------------------------------------------------------- great world events (greatevents.js)
  add({
    // names and kinds
    "{foe} attacks {place}": "{foe} atakuje {place}", "Daedric rift at {place}": "Daedryczna wyrwa: {place}", "Siege of {place}": "Oblężenie: {place}",
    "The great fair in {place}": "Wielki jarmark: {place}", "Dragon assault": "Atak smoka", "Daedric rift": "Daedryczna wyrwa", Siege: "Oblężenie", "Town fair": "Jarmark",
    Dragon: "Smok", "Frost Dragon": "Mroźny smok", "Blood Dragon": "Krwawy smok", "Elder Dragon": "Starszy smok",
    // phases
    "It circles and burns": "Krąży i pali", "It lands in the streets": "Ląduje na ulicach", "Wounded and furious": "Ranny i wściekły",
    "Daedra pour out": "Wylewają się daedry", "The Dremora guard": "Strażnik dremora", "The Rift Lord": "Władca Wyrwy",
    "Raiders at the walls": "Bandyci pod murami", "The battering ram": "Taran", "The warlord": "Herszt",
    "{foe} over {place}": "{foe} nad {place}", "{foe} in the streets": "{foe} na ulicach", "Wounded {foe:lc}": "Ranny {foe:lc}",
    "Scamps and atronachs": "Skampy i atronachy", "Dremora Markynaz, Rift Lord": "Dremora Markynaz, Władca Wyrwy", "Bandit raiders": "Bandyci szturmowi",
    "Ram crew and their guards": "Obsługa tarana i straż", "{foe}, bandit warlord": "{foe}, herszt bandytów",
    "The {foe:lc} sweeps low over the roofs, breathing fire.": "{foe} przelatuje nisko nad dachami, ziejąc ogniem.",
    "The {foe:lc} sweeps low over the roofs, breathing frost.": "{foe} przelatuje nisko nad dachami, ziejąc mrozem.",
    "It crashes down in the market of {place}, tail smashing stalls.": "Spada na targ w {place}, ogonem miażdżąc stragany.",
    "Bleeding and furious, it fights for its life.": "Krwawiący i wściekły, walczy o życie.",
    "Scamps and flame atronachs spill from the crackling rift.": "Z trzeszczącej wyrwy wysypują się skampy i ogniste atronachy.",
    "A Dremora officer steps through and raises a burning blade.": "Oficer dremora przechodzi przez wyrwę i unosi płonące ostrze.",
    "The Rift Lord himself comes to hold the tear open.": "Sam Władca Wyrwy przybywa, by utrzymać ją otwartą.",
    "Bandits with ladders swarm the walls of {place}.": "Bandyci z drabinami obsiadają mury miasta {place}.",
    "A battering ram thunders against the gate. Its guards won't let you near.": "Taran grzmi o bramę. Jego straż nie daje ci podejść.",
    "{foe} rides in to finish the job.": "{foe} nadjeżdża, by dokończyć dzieła.",
    // charges
    "There's nothing to fight right now.": "Teraz nie ma z czym walczyć.", "{kind} at {place} starts in {time}. Get ready.": "{kind} ({place}) zaczyna się za {time}. Przygotuj się.",
    "The fight is at {place}. Get there first.": "Walka toczy się w: {place}. Najpierw tam dotrzyj.",
    "The {foe:lc} is already dead. Claim your share.": "{foe} już nie żyje. Odbierz swoją część.", "The rift is already sealed. Claim your share.": "Wyrwa jest już zamknięta. Odbierz swoją część.",
    "The siege is already broken. Claim your share.": "Oblężenie jest już przełamane. Odbierz swoją część.",
    "In a party only your leader starts each charge. Stay close to them and you fight beside them.": "W drużynie tylko przywódca zaczyna każdą szarżę. Trzymaj się blisko, a walczysz u jego boku.",
    "Catch your breath: you can charge again in {n} s.": "Złap oddech: możesz znów szarżować za {n} s.",
    "You're too badly hurt to charge in. Heal up first (rest, a potion or a spell).": "Jesteś zbyt ciężko ranny, by szarżować. Najpierw się wylecz (odpoczynek, mikstura albo zaklęcie).",
    "({n} of your party beside you)": "({n} z twojej drużyny obok ciebie)", "You land the killing blow! The {foe:lc} crashes down in {place}.": "Zadajesz śmiertelny cios! {foe} pada martwy w {place}.",
    "The Rift Lord falls and the rift snaps shut with a thunderclap!": "Władca Wyrwy pada, a wyrwa zatrzaskuje się z hukiem!",
    "{foe} falls and the bandit army breaks and runs!": "{foe} pada, a armia bandytów rozpierzcha się!", "You're dragged down. Others will have to carry on.": "Powalają cię. Inni muszą walczyć dalej.",
    "+{pts} to the fight{who}.": "+{pts} do walki{who}.", "Charge landed": "Szarża udana", Victory: "Zwycięstwo", "Victory!": "Zwycięstwo!",
    // the fair
    "Archery butts": "Strzelanie do tarczy", "Three arrows at the straw target.": "Trzy strzały do słomianej tarczy.", "Arm wrestling": "Siłowanie na rękę",
    "Best of three against the town's strongest.": "Do dwóch wygranych z najsilniejszym w mieście.", "Drinking contest": "Konkurs picia",
    "Mead, then more mead. Last one standing wins.": "Miód, potem jeszcze więcej miodu. Wygrywa ten, kto ustoi.", "The lucky wheel": "Koło fortuny", "10 gold a spin. Pure luck.": "10 złota za obrót. Czyste szczęście.",
    "The fair opens in {time}.": "Jarmark otwiera się za {time}.", "There's no fair on right now.": "Teraz nie ma jarmarku.", "No such game.": "Nie ma takiej gry.", "The fair is in {place}.": "Jarmark jest w: {place}.",
    "You've had your {n} goes at the {game:lc}. Try another game.": "Wykorzystałeś już {n} podejścia w grze „{game}”. Spróbuj innej.",
    "Three in the gold! The crowd roars.": "Trzy w dziesiątkę! Tłum ryczy.", "{hits} of 3 on the target.": "{hits} z 3 w tarczy.", "All three wide. The children laugh.": "Wszystkie trzy obok. Dzieci się śmieją.",
    "You slam their arm to the table!": "Przygniatasz jego rękę do stołu!", "They pin you, but buy you a drink for trying.": "Przegrywasz, ale stawiają ci kufel za odwagę.",
    "Your rival slides under the table. You're still standing!": "Rywal ląduje pod stołem. Ty wciąż stoisz!", "The room spins. You wake up under a bench.": "Sala wiruje. Budzisz się pod ławą.",
    "A spin costs 10 gold.": "Obrót kosztuje 10 złota.", "Jackpot! 60 gold!": "Główna wygrana! 60 złota!", "A small win: 15 gold.": "Mała wygrana: 15 złota.", "Nothing this time. Still, the wheel is fun.": "Tym razem nic. Ale koło i tak bawi.",
    "{game}: {text} (+{pts} {pt}, {all} in all)": "{game}: {text} (+{pts} {pt}, razem {all})", point: "pkt", points: "pkt",
    "A prize is waiting at the prize stall.": "Na stoisku z nagrodami czeka nagroda.", "The prize stall has packed up.": "Stoisko z nagrodami jest już zwinięte.", "Nothing to collect.": "Nie ma czego odebrać.",
    "You need {n} points for that prize.": "Na tę nagrodę potrzebujesz {n} pkt.", "You've already collected that prize.": "Tę nagrodę już odebrałeś.", "Prize: {list}.": "Nagroda: {list}.",
    "Two healing potions and 60 gold": "Dwie mikstury leczenia i 60 złota", "A sapphire and 120 gold": "Szafir i 120 złota", "A flawless ruby, 250 gold and the title Fair Champion": "Doskonały rubin, 250 złota i tytuł Mistrz Jarmarku",
    // rewards and what's left behind
    "{n} gold": "{n} złota", "the title {title}": "tytuł {title}", "{place} is saved.": "{place} ocalone.", "The rift at {place} is sealed.": "Wyrwa ({place}) zamknięta.",
    "The siege of {place} is broken.": "Oblężenie ({place}) przełamane.", "The {foe:lc} burned {place} and flew off.": "{foe} spalił {place} i odleciał.",
    "The rift at {place} stayed open.": "Wyrwa ({place}) pozostała otwarta.", "The bandits plundered {place}.": "Bandyci splądrowali {place}.",
    "{head} You did {pct}% of a fair share. Your reward: {list}.": "{head} Zrobiłeś {pct}% uczciwej części. Twoja nagroda: {list}.",
    "{place} is clearing the rubble after the dragon ({pct}% rebuilt). Timber is dear: shops 5% dearer.": "{place} uprząta gruzy po smoku (odbudowa {pct}%). Drewno jest drogie: sklepy o 5% droższe.",
    "{place} was burned by a dragon and is rebuilding ({pct}%). Shops there are up to 20% dearer until it's done.": "{place} spalone przez smoka, trwa odbudowa ({pct}%). Sklepy są tam do 20% droższe, dopóki nie skończą.",
    "The rift scar at {place} is fading.": "Blizna po wyrwie ({place}) blednie.", "Daedra still lurk around {place}. Traders in {hold} charge 10% more.": "Wokół {place} wciąż czają się daedry. Kupcy w krainie {hold} biorą 10% więcej.",
    "The Jarl of {hold} thanks the siege breakers: shops in the hold are 5% cheaper (10% if you fought).": "Jarl krainy {hold} dziękuje obrońcom: sklepy w krainie są o 5% tańsze (10%, jeśli walczyłeś).",
    "{place} was plundered by bandits. Shops in {hold} are 15% dearer.": "{place} splądrowane przez bandytów. Sklepy w krainie {hold} są o 15% droższe.",
    "Rebuilding {pct}%": "Odbudowa {pct}%",
    // times
    "Opens in": "Otwarcie za", "Starts in": "Start za", "Closes in": "Zamknięcie za", "Time left": "Pozostało", "{d}d {h}h": "{d} d {h} godz.", "{h}h {m}m": "{h} godz. {m} min", "{n} min": "{n} min",
    // banner and sheet
    Claim: "Odbierz", Go: "Idź", Ready: "Gotowe", Play: "Graj", Open: "Otwórz", "With leader": "Z przywódcą", "⚔️ Fight": "⚔️ Walcz",
    "Games, prizes, shops 25% off": "Gry, nagrody, sklepy 25% taniej", "your points {n}": "twoje punkty: {n}", "Beaten!": "Wygrana!", "{n} fought": "walczyło: {n}",
    "At {where} · gather there": "Miejsce: {where} · zbierzcie się tam", "{phase} · {n} fighting": "{phase} · walczy: {n}",
    "Coming soon": "Wkrótce", "Great world event": "Wielkie wydarzenie", "{name}: over, your reward is waiting": "{name}: koniec, czeka twoja nagroda",
    "Your points: <b>{n}</b>. Shops in {place} are {pct}% off while the fair lasts.": "Twoje punkty: <b>{n}</b>. Sklepy w {place} są o {pct}% tańsze, dopóki trwa jarmark.",
    "{left} of {tries} left": "zostało {left} z {tries}", Done: "Zrobione", "Prize stall": "Stoisko z nagrodami", "{n} points": "{n} pkt", Taken: "Odebrane", Collect: "Odbierz",
    "Travel to {place}": "Idź do: {place}", "{n} hero": "bohaterów: {n}", "{n} heroes": "bohaterów: {n}", "your share {pct}% of a fair share": "twój udział: {pct}% uczciwej części",
    "Victory! Everyone who fought can claim a share.": "Zwycięstwo! Każdy, kto walczył, może odebrać swoją część.", "It begins in {time}. Gather at {place}.": "Zaczyna się za {time}. Zbierzcie się w: {place}.",
    "In a party, your leader starts each charge. Stay close to them and you fight beside them.": "W drużynie każdą szarżę zaczyna przywódca. Trzymaj się blisko, a walczysz u jego boku.",
    "Catch your breath ({n} s)": "Złap oddech ({n} s)", "⚔️ Charge: {phase}": "⚔️ Szarża: {phase}", "Fighting with you: {names}": "Walczą z tobą: {names}",
    "Claim your reward": "Odbierz nagrodę", Over: "Koniec", "everyone in the North sees this": "widzi to cała Północ", "How it works": "Jak to działa", Close: "Zamknij",
    "Nothing to claim yet.": "Na razie nie ma czego odebrać.", "{icon} {name} struck the final blow: {what}!": "{icon} {name} zadał ostatni cios: {what}!",
    "the {foe:lc} over {place} is dead": "{foe} nad {place} nie żyje", "the rift at {place} is sealed": "wyrwa ({place}) zamknięta", "the siege of {place} is broken": "oblężenie ({place}) przełamane",
    "{name}: it starts in {time}.": "{name}: zaczyna się za {time}.", "{name} has opened: games, prizes and cheap shops!": "{name}: otwarte! Gry, nagrody i tanie sklepy!", "{name}! Everyone to {place}!": "{name}! Wszyscy do: {place}!",
    // how it works
    "The dragon attacks in three phases: it circles and burns, lands in the streets, then fights on wounded. Go to the town and charge in: each charge is a short fight, and everything you do wears it down for everyone. The more heroes join, the tougher it gets. In a party, the leader starts each charge and members close by fight beside them. Kill it before time runs out or the town burns and has to rebuild for 3 days. Your reward depends on your share: gold, dragon bones and scales, its soul, and the title Firebreaker if you did at least half a fair share.":
      "Smok atakuje w trzech fazach: krąży i pali, ląduje na ulicach, a potem walczy ranny. Idź do miasta i szarżuj: każda szarża to krótka walka, a wszystko, co zrobisz, osłabia go dla wszystkich. Im więcej bohaterów, tym jest silniejszy. W drużynie każdą szarżę zaczyna przywódca, a członkowie w pobliżu walczą u jego boku. Zabij go, zanim minie czas, inaczej miasto spłonie i będzie się odbudowywać 3 dni. Nagroda zależy od twojego udziału: złoto, smocze kości i łuski, jego dusza oraz tytuł Pogromca Ognia, jeśli zrobiłeś co najmniej połowę uczciwej części.",
    "A rift to Oblivion has torn open. First Daedra spill out, then a Dremora guard holds the tear, then the Rift Lord himself. Each charge is a short fight that counts for everyone. Seal it in time and those who fought share sigil stones, daedra hearts and gold (title Riftsealer). Left open, Daedra scare off traders in the hold for a day.":
      "Otworzyła się wyrwa do Otchłani. Najpierw wysypują się daedry, potem wyrwy pilnuje strażnik dremora, a na końcu sam Władca Wyrwy. Każda szarża to krótka walka, która liczy się dla wszystkich. Zamknij ją na czas, a walczący podzielą się kamieniami pieczęci, sercami daedry i złotem (tytuł Pieczętujący Wyrwy). Jeśli zostanie otwarta, daedry na dzień odstraszą kupców w krainie.",
    "A bandit army is besieging the town: raiders at the walls, then the battering ram, then the warlord. Each charge is a short fight that counts for everyone. Break the siege and the Jarl lowers prices in the hold for a day (more for those who fought) and pays out gems and gold (title Siegebreaker). Fail and the hold is plundered: shops are dearer for two days.":
      "Armia bandytów oblega miasto: najpierw szturm na mury, potem taran, a na końcu herszt. Każda szarża to krótka walka, która liczy się dla wszystkich. Przełam oblężenie, a jarl na dzień obniży ceny w krainie (bardziej dla walczących) i wypłaci klejnoty i złoto (tytuł Pogromca Oblężeń). Jeśli się nie uda, kraina zostanie splądrowana: sklepy będą droższe przez dwa dni.",
    "A great fair: four games (each {tries} goes), points add up to prizes at the prize stall, and every shop in town is 25% off while the fair lasts.":
      "Wielki jarmark: cztery gry (w każdej {tries} podejścia), punkty zamieniasz na nagrody na stoisku, a każdy sklep w mieście jest 25% tańszy, dopóki trwa jarmark.",
  }, {
    // titles (saved in English, shown as they are)
    Firebreaker: "Pogromca Ognia", Riftsealer: "Pieczętujący Wyrwy", Siegebreaker: "Pogromca Oblężeń", "Fair Champion": "Mistrz Jarmarku",
    // perks
    Dragonward: "Smocza Osłona", "Rift Warden": "Strażnik Wyrw", "Siege Breaker": "Łamacz Oblężeń", Fairgoer: "Bywalec Jarmarków", "Hero of the Hour": "Bohater Chwili",
    "You've learned to take a dragon's charge: dragons hit you 10% softer, and your charges against a dragon attacking a town count 20% more.": "Umiesz przyjąć szarżę smoka: smoki biją cię o 10% słabiej, a twoje szarże na smoka atakującego miasto liczą się o 20% bardziej.",
    "After every charge in a great world event you catch your breath and heal 20% of your health, and your charges at a Daedric rift count 20% more.": "Po każdej szarży w wielkim wydarzeniu łapiesz oddech i leczysz 20% zdrowia, a twoje szarże przy daedrycznej wyrwie liczą się o 20% bardziej.",
    "Bandit raiders, ram crews and warlords take 15% more damage from you, and your charges against a siege count 20% more.": "Bandyci szturmowi, obsługa taranów i hersztowie dostają od ciebie o 15% więcej obrażeń, a twoje szarże przeciw oblężeniu liczą się o 20% bardziej.",
    "At a town fair the shops sell to you another 10% cheaper, and every fair game gives you 1 more point.": "Na jarmarku sklepy sprzedają ci o kolejne 10% taniej, a każda gra daje ci 1 punkt więcej.",
    "Rewards from great world events and fair prizes pay you 20% more gold.": "Nagrody z wielkich wydarzeń i jarmarków dają ci o 20% więcej złota.",
  });

  if (typeof window !== "undefined" && typeof document !== "undefined") start();
  return { lang, tr, t, add, settingRow, pref: setPref, PL, SKILLS, story };
})();
