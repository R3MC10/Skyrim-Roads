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
    "Coming up:": "Wkrótce:", "Coming next": "Już wkrótce", "Being built now": "W budowie", "Market today": "Targ dzisiaj", "Market stalls": "Stragany",
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
    Sound: "Dźwięk", Music: "Muzyka", Effects: "Efekty", Ambience: "Otoczenie", "All sound": "Cały dźwięk", "Art style": "Styl grafiki", "Hand-drawn": "Rysowany", "Pixel art": "Pikselowy",
    Motion: "Ruch", Fights: "Walki", "Turn by turn": "Turowo", "Instant (auto)": "Od razu (auto)", "Foe turns": "Tury wroga", "Normal speed": "Normalna prędkość",
    "Replay speed": "Prędkość powtórki", Crafting: "Rzemiosło", "When you craft": "Przy wytwarzaniu", "Mini-games": "Minigry", "Quick craft": "Szybkie wytwarzanie",
    Survival: "Przetrwanie", "Cold meter": "Licznik zimna", "On (gentle)": "Wł. (łagodny)", Accessibility: "Dostępność", "Accessibility options": "Opcje dostępności",
    "Text size": "Rozmiar tekstu", "Reduce motion": "Mniej ruchu", "One-hand mode": "Tryb jednej ręki", "High-contrast text": "Tekst o wysokim kontraście",
    "Colour-blind help": "Pomoc dla daltonistów", "First-time tips": "Porady na start", "Back up": "Kopia zapasowa", Restore: "Przywróć", "Restore from a backup": "Przywróć z kopii",
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
  });

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
  ];
  /* lines added by feature modules (i18n_hsrooms.js and others): exact lines and number patterns; the lists above win */
  if (typeof I18N_EXTRA !== "undefined") { for (const [k, v] of Object.entries(I18N_EXTRA.words || {})) if (!(k in PL)) PL[k] = v; PAT.push(...(I18N_EXTRA.pat || [])); }
  /* story text: split into sentences, translate each one (exact, or a template whose {markers} are filled from the English) */
  const ST = typeof I18N_STORY !== "undefined" ? I18N_STORY : { ex: {}, pats: [] };
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
  function sentence(s) {
    const ex = ST.ex[s] ?? PL[s];
    if (ex != null) return ex;
    for (const p of storyPats()) {
      if (p.lead && !s.startsWith(p.lead)) continue;
      const m = s.match(p.re); if (!m) continue;
      let out = p.pl;
      p.names.forEach((n, i) => { const v = m[i + 1]; out = out.split(n).join(PL[v] ?? ST.ex[v] ?? v); });
      return out;
    }
    return null;
  }
  function story(t) {
    const parts = t.split(SPLIT).filter((x) => x !== undefined);
    let hit = false;
    const out = parts.map((p) => { if (!p.trim()) return p; const r = sentence(p); if (r != null) { hit = true; return r; } return p; });
    return hit ? out.join("") : null;
  }
  const cache = new Map(), done = new WeakMap();
  function tr(t) {
    if (cache.has(t)) return cache.get(t);
    let out = PL[t] ?? null;
    if (out == null) for (const [re, f] of PAT) { const m = t.match(re); if (m) { const r = f(m); if (r) { out = r; break; } } }
    if (out == null && t.includes(" · ")) { const parts = t.split(" · "), tp = parts.map((p) => PL[p] ?? p); if (tp.some((p, i) => p !== parts[i])) out = tp.join(" · "); }
    if (out == null && /[a-z]{2} [a-z]/i.test(t)) out = story(t);
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
  if (typeof window !== "undefined" && typeof document !== "undefined") start();
  return { lang, tr, settingRow, pref: setPref, PL, SKILLS, story };
})();
