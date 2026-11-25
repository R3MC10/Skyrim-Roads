/* i18n_deepdelve.js: Polish for deep expeditions and dungeon difficulty tiers (deepdelve.js) and its patch note.
   Loaded after i18n_story.js and before i18n.js. Exact lines go in I18N_EXTRA.words, lines with names or numbers in
   I18N_EXTRA.pat (whole text) and I18N_STORY.pats (one sentence, {0} gets translated on its own). */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const T = (x) => { if (typeof I18N === "undefined") return x; const r = I18N.tr(x); return r == null ? x : r; };
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  /* a foe or item name, also when the sentence wrote it in lower case */
  const NM = (x) => { const r = T(x); if (r !== x) return r; const c = T(cap(x)); return c !== cap(x) ? (x[0] === x[0].toLowerCase() ? c.charAt(0).toLowerCase() + c.slice(1) : c) : x; };
  const list = (x) => x.split(", ").map(NM).join(", ");
  const LVL = { "Entrance guardians": "Strażnicy wejścia", "Traps and elites": "Pułapki i elita", "The ancient vault": "Starożytny skarbiec",
    "The cursed sanctuary": "Przeklęte sanktuarium", "The legendary lair": "Legendarne leże" };
  const lvl = (x) => LVL[x] || LVL[cap(x)]?.toLowerCase() || x;
  const TIER = { Normal: "Normalny", Veteran: "Weteran", Legendary: "Legendarny", Mythic: "Mityczny" };
  const MOD = {
    "Frozen Depths": ["Zamarznięte głębiny", "Mróz osiada na tobie co turę i wysysa wytrzymałość; przy 5 warstwach kąsa za 5% zdrowia. Zaklęcia ognia cię rozmrażają."],
    "Restless Dead": ["Niespokojni zmarli", "Nieumarli wstają jeszcze raz z jedną trzecią zdrowia, chyba że dobijesz ich ogniem albo magią Przywrócenia."],
    "Dwemer Overcharge": ["Przeciążenie Dwemerów", "Krasnoludzkie maszyny co trzecią turę wyładowują się: wstrząs, który omija pancerz i wysysa magię."],
    "Blood Moon": ["Krwawy księżyc", "Krwawienie jest silniejsze po obu stronach: twoje krwawienia ranią o 50% mocniej, a ciosy, które cię trafią, też otwierają rany."],
    "Arcane Instability": ["Niestabilność magii", "Co czwarte zaklęcie ma skutek uboczny: wzmocnienie, odrzut, utratę magii albo odrobinę leczenia."],
    "Ancient Darkness": ["Pradawna ciemność", "Wrogowie kryją się w mroku: atakują pierwsi, a twoje dwie pierwsze tury trafiają o 30% słabiej. Światło świecy, Wykrycie życia albo Tropiciel ich odsłaniają."],
    "Cursed Sanctuary": ["Przeklęte sanktuarium", "Każde leczenie jest o 40% słabsze: mikstury, zaklęcia, miejsca odpoczynku i kapliczki."],
    "Relentless Hunt": ["Nieustępliwe łowy", "Odpoczynek może ściągnąć zasadzkę (1 na 3): najpierw walczysz, potem odpoczywasz."],
  };
  const CURSE = { "Withering curse": ["Klątwa uwiądu", "Otrzymujesz o 10% więcej obrażeń."], "Sanctuary's mark": ["Piętno sanktuarium", "Leczenie jest o 30% słabsze."] };
  const ICONS = { "Frozen Depths": "", "Restless Dead": "", "Dwemer Overcharge": "", "Blood Moon": "", "Arcane Instability": "", "Ancient Darkness": "", "Cursed Sanctuary": "", "Relentless Hunt": "" };
  const modName = (x) => MOD[x]?.[0] || x;
  const things = (n) => (+n === 1 ? "rzecz" : [2, 3, 4].includes(+n % 10) && ![12, 13, 14].includes(+n % 100) ? "rzeczy" : "rzeczy");
  const inj = (n) => (+n === 1 ? "rana" : [2, 3, 4].includes(+n) ? "rany" : "ran");
  const W = {
    " Difficulty": " Trudność", "Camp": "Obóz", "Deep expedition:": "Głęboka wyprawa:",
    "Veteran, Legendary and Mythic make foes tougher and add modifiers you can see here first. Better gold the harder you go.":
      "Weteran, Legendarny i Mityczny wzmacniają wrogów i dodają modyfikatory, które widzisz tu zawczasu. Im trudniej, tym więcej złota.",
    "Veteran, Legendary and Mythic open at level 30.": "Weteran, Legendarny i Mityczny otwierają się na 30. poziomie.",
    "after its master falls, stairs lead down to five deeper levels. Extract, rest or descend after each big fight. What you find below is yours only once you climb out.":
      "gdy padnie jego pan, schody prowadzą w dół na pięć głębszych poziomów. Po każdej dużej walce: wyjdź, odpocznij albo zejdź niżej. To, co znajdziesz na dole, jest twoje dopiero, gdy wyjdziesz.",
    "That isn't a difficulty.": "To nie jest poziom trudności.",
    " The stairs down": " Schody w dół",
    "Behind the master's throne, worn stairs lead further down. Cold air rises from below.": "Za tronem pana wytarte schody prowadzą dalej w dół. Z dołu ciągnie zimne powietrze.",
    "Unsecured:": "Niezabezpieczone:", "gold,": "złota,", "things": "rzeczy", "Rations:": "Racje:", "Injuries:": "Rany:", "Next:": "Dalej:",
    "You stand at the very bottom. Nothing lies deeper.": "Stoisz na samym dnie. Głębiej nic nie ma.",
    "Head back up with your loot": "Wracaj na górę z łupem", "Extract: climb out with everything": "Wyjdź: wspinaczka na górę ze wszystkim",
    "Rest (eat something from your pack)": "Odpocznij (zjedz coś z plecaka)", "Rest (no rations left)": "Odpocznij (brak racji)",
    "Knocked out below, you lose what you found down here, never your gear or what you brought in.":
      "Powalony na dole tracisz to, co tu znalazłeś, ale nigdy swojego ekwipunku ani tego, co przyniosłeś.",
    "Knocked out below, you lose what you found down here, never your gear or what you brought in. Pathfinder: you can also walk out from any room and keep it all.":
      "Powalony na dole tracisz to, co tu znalazłeś, ale nigdy swojego ekwipunku ani tego, co przyniosłeś. Tropiciel: możesz też wyjść z każdej komnaty i zatrzymać wszystko.",
    "Health, potions and injuries carry down with you. Down there, loot is unsecured until you extract.":
      "Zdrowie, mikstury i rany schodzą z tobą. Na dole łup jest niezabezpieczony, dopóki nie wyjdziesz.",
    "You leave the stairs for another day.": "Zostawiasz schody na inny dzień.",
    "You have nothing left to eat. Resting on an empty stomach does no good.": "Nie masz już nic do jedzenia. Odpoczynek o pustym żołądku nic nie da.",
    "They found your camp.": "Znaleźli twój obóz.", "Curses stay until you climb out.": "Klątwy zostają, dopóki nie wyjdziesz.",
    "There is nothing deeper.": "Głębiej nic nie ma.", "Unsecured until you climb out.": "Niezabezpieczone, dopóki nie wyjdziesz.",
    "You had found nothing down there yet.": "Nie znalazłeś tam jeszcze niczego.",
    "Your gear and everything you brought in are safe.": "Twój ekwipunek i wszystko, co przyniosłeś, są bezpieczne.",
    "Behind the throne, worn stairs lead further down.": "Za tronem wytarte schody prowadzą dalej w dół.",
    "Something found you while you rested.": "Coś cię znalazło podczas odpoczynku.",
    "Pathfinder: you know the way out and bring everything with you.": "Tropiciel: znasz drogę na zewnątrz i wynosisz wszystko.",
    " it rises again!": " wstaje znowu!", " your magicka drains away": " twoja magia ucieka",
    // perks
    "Dungeon Veteran": "Weteran podziemi", "Pathfinder": "Tropiciel", "Deep Delver": "Głębinowy poszukiwacz",
    "On a deep expedition, injuries and curses hurt 30/60% less, and you bring one more ration per rank.":
      "Na głębokiej wyprawie rany i klątwy szkodzą o 30/60% mniej, a na każdą rangę bierzesz jedną rację więcej.",
    "On the road, outrunning trouble, dodging avalanches and taming wild horses is 15% easier. Deep down you always know the way out: leave a deep expedition from any level and keep what you found, and Ancient Darkness can't hide foes from you.":
      "W drodze ucieczka przed kłopotami, unikanie lawin i oswajanie dzikich koni są o 15% łatwiejsze. W głębinach zawsze znasz drogę: opuść głęboką wyprawę z dowolnego poziomu i zatrzymaj znaleziska, a Pradawna ciemność nie ukryje przed tobą wrogów.",
    "Better finds deeper down: +10/20% gold per depth level, and better odds for gear and gems in the camp chest.":
      "Lepsze znaleziska głębiej: +10/20% złota na każdy poziom głębokości i większe szanse na sprzęt i klejnoty w skrzyni przy obozie.",
    // patch note
    "Deep expeditions and harder dungeons": "Głębokie wyprawy i trudniejsze podziemia",
    "Deadly dungeons go deeper. When the master falls, stairs lead down to five more levels: entrance guardians, traps and elites, the ancient vault, the cursed sanctuary and the legendary lair.":
      "Śmiertelne podziemia sięgają głębiej. Gdy padnie ich pan, schody prowadzą na pięć kolejnych poziomów: strażnicy wejścia, pułapki i elita, starożytny skarbiec, przeklęte sanktuarium i legendarne leże.",
    "After each level's big fight you make camp and choose: Extract (climb out with everything), Rest (costs a ration) or Descend. In a party it's a vote, with everyone's face by their pick.":
      "Po dużej walce na każdym poziomie rozbijasz obóz i wybierasz: Wyjdź (na górę ze wszystkim), Odpocznij (kosztuje rację) albo Zejdź niżej. W drużynie to głosowanie, z twarzą każdego przy jego wyborze.",
    "There's no free healing down there: health, potions, injuries and curses come with you to the next level. The gold and loot get much better the deeper you go.":
      "Na dole nie ma darmowego leczenia: zdrowie, mikstury, rany i klątwy idą z tobą na kolejny poziom. Im głębiej, tym dużo lepsze złoto i łupy.",
    "What you find below is only yours once you climb out. Get knocked out down there and the expedition's finds are lost, but never your gear or anything you brought in. Followers just get knocked down, as always.":
      "To, co znajdziesz na dole, jest twoje dopiero po wyjściu. Jeśli padniesz tam nieprzytomny, znaleziska wyprawy przepadają, ale nigdy twój ekwipunek ani to, co przyniosłeś. Towarzysze jak zawsze tylko padają powaleni.",
    "From level 30 every dungeon has Veteran, Legendary and Mythic difficulty: tougher foes, more gold, and 1 to 3 modifiers you can read on the map before you go in (Frozen Depths, Restless Dead, Dwemer Overcharge, Blood Moon, Arcane Instability, Ancient Darkness, Cursed Sanctuary, Relentless Hunt). They change every week.":
      "Od 30. poziomu każde podziemie ma trudność Weteran, Legendarny i Mityczny: twardsi wrogowie, więcej złota i od 1 do 3 modyfikatorów, które przeczytasz na mapie przed wejściem (Zamarznięte głębiny, Niespokojni zmarli, Przeciążenie Dwemerów, Krwawy księżyc, Niestabilność magii, Pradawna ciemność, Przeklęte sanktuarium, Nieustępliwe łowy). Zmieniają się co tydzień.",
    "New perks: Dungeon Veteran (Athletics) and Deep Delver (Lockpicking). Pathfinder (Athletics) now also finds the way out of the depths.":
      "Nowe atuty: Weteran podziemi (Atletyka) i Głębinowy poszukiwacz (Otwieranie zamków). Tropiciel (Atletyka) znajduje teraz też drogę z głębin.",
    // patch note: re-balance (b178)
    "Fairer deep expeditions and difficulty tiers":
      "Uczciwsze głębokie wyprawy i poziomy trudności",
    "Veteran, Legendary and Mythic are fairer when you go alone: a careful hero with a follower now beats the legendary lair about 1 time in 3 on Legendary and now and then even on Mythic.":
      "Weteran, Legendarny i Mityczny są uczciwsze, gdy idziesz sam: rozważny bohater z towarzyszem pokonuje teraz legendarne leże mniej więcej raz na trzy razy na Legendarnym, a od czasu do czasu nawet na Mitycznym.",
    "A full party has it tougher on Legendary and Mythic: the foes grow more for every extra player, so four friends still need to work for the deepest hoard.":
      "Pełna drużyna ma trudniej na Legendarnym i Mitycznym: wrogowie rosną z każdym dodatkowym graczem, więc czwórka przyjaciół wciąż musi się napracować, by zdobyć najgłębszy skarb.",
    "Going higher in level no longer makes the depths harder. A level 40 hero now does better down there than a level 30 one.":
      "Wyższy poziom nie utrudnia już głębin. Bohater na 40. poziomie radzi sobie tam teraz lepiej niż na 30.",
    "The master of the legendary lair at the very bottom has a little less health, so that fight is long but winnable.":
      "Pan legendarnego leża na samym dnie ma trochę mniej zdrowia, więc ta walka jest długa, ale do wygrania.",
  };
  for (const [k, v] of Object.entries(TIER)) W[k] = W[k] || v;
  for (const [k, [n, d]] of Object.entries(MOD)) { W[k] = n; W[`${ICONS[k]} ${k}`] = `${ICONS[k]} ${n}`; W[I18N_DESC_EN(k)] = d; W[`${k}: ${I18N_DESC_EN(k)}`] = `${n}: ${d}`; }
  for (const [k, [n, d]] of Object.entries(CURSE)) { W[k] = n; W[`${k === "Withering curse" ? "" : ""} ${k}`] = `${k === "Withering curse" ? "" : ""} ${n}`; W[{ "Withering curse": "You take 10% more damage.", "Sanctuary's mark": "Healing is 30% weaker." }[k]] = d; }
  for (const [k, v] of Object.entries(LVL)) { W[k] = v; }
  for (const [k, v] of Object.entries(W)) { W[k + " [OURS]"] = v; }
  Object.assign(I18N_EXTRA.words, W);
  /* the English descriptions live in deepdelve.js; read them from there so they never drift */
  function I18N_DESC_EN(name) { if (typeof DEEPDELVE === "undefined") return name + "\u0000"; const m = Object.values(DEEPDELVE.MODS).find((x) => x.name === name); return m ? m.desc : name + "\u0000"; }

  const R = "(I|II|III|IV|V)";
  I18N_EXTRA.pat.push(
    [/^(Veteran|Legendary|Mythic): foes have (\d+)% more health and hit (\d+)% harder; ×([\d.]+) gold\. This week's modifiers:$/,
      (m) => `${TIER[m[1]]}: wrogowie mają o ${m[2]}% więcej zdrowia i biją o ${m[3]}% mocniej; ×${m[4]} złota. Modyfikatory w tym tygodniu:`],
    [new RegExp(`^ Level ${R}$`), (m) => ` Poziom ${m[1]}`],
    [/^ (\d+) injur(?:y|ies)$/, (m) => ` ${m[1]} ${inj(m[1])}`],
    [/^Unsecured: (\d+) gold, (\d+) things$/, (m) => `Niezabezpieczone: ${m[1]} złota, ${m[2]} ${things(m[2])}`],
    [new RegExp(`^ Camp on level ${R}$`), (m) => ` Obóz na poziomie ${m[1]}`],
    [new RegExp(`^You make camp in a quiet corner of level ${R}\\. Stairs lead down into the dark\\.$`), (m) => `Rozbijasz obóz w cichym kącie poziomu ${m[1]}. Schody prowadzą w dół, w ciemność.`],
    [new RegExp(`^level ${R}, (.+)$`), (m) => `poziom ${m[1]}, ${lvl(m[2])}`],
    [/^\. Foes \+(\d+)% health, \+(\d+)% damage; gold ×([\d.]+)\.$/, (m) => `. Wrogowie +${m[1]}% zdrowia, +${m[2]}% obrażeń; złoto ×${m[3]}.`],
    [/^Rest \(1 ration, (\d+) left\)$/, (m) => `Odpocznij (1 racja, zostało ${m[1]})`],
    [new RegExp(`^Descend to level ${R}: (.+)$`), (m) => `Zejdź na poziom ${m[1]}: ${lvl(m[2])}`],
    [/^ (Veteran|Legendary|Mythic): (.+)$/, (m) => ` ${TIER[m[1]]}: ${m[2].split(", ").map(modName).join(", ")}`],
    [new RegExp(`^ Extracted from level ${R} of (.+)$`), (m) => ` Wyjście z poziomu ${m[1]}: ${NM(m[2])}`],
    [new RegExp(`^ Level ${R} of (.+): (.+)$`), (m) => ` Poziom ${m[1]} w ${NM(m[2])}: ${lvl(m[3])}`],
    [new RegExp(`^ Beat the (.+) on level ${R} of (.+)$`), (m) => ` Pokonano: ${NM(m[1])}, poziom ${m[2]} w ${NM(m[3])}`],
    [/^You climb all the way back up and out\. Everything you found down there is yours now(?: \((.+)\))?\.$/,
      (m) => `Wspinasz się aż na samą górę i wychodzisz. Wszystko, co tam znalazłeś, jest teraz twoje${m[1] ? ` (${m[1].replace(/(\d+) gold/, "$1 złota").replace(/(\d+) things/, (x, n) => `${n} ${things(n)}`)})` : ""}.`],
    [new RegExp(`^You go down to level ${R}: (.+?)\\.(?: (|) (Withering curse|Sanctuary's mark): (.+))?$`),
      (m) => `Schodzisz na poziom ${m[1]}: ${lvl(m[2])}.${m[3] ? ` ${m[3]} ${CURSE[m[4]][0]}: ${CURSE[m[4]][1]}` : ""}`],
    [/^(?:They found your camp: a (.+) came out of the dark\. It's dead now\. )?You eat (.+) and rest(?: a while)? \((\d+) → (\d+) health, (\d+) injur(?:y|ies) left\)\.( Curses stay until you climb out\.)?$/,
      (m) => `${m[1] ? `Znaleźli twój obóz: z ciemności wyszedł ${NM(m[1])}. Już nie żyje. ` : ""}Zjadasz ${m[2] === "a ration" ? "rację" : NM(m[2])} i odpoczywasz (${m[3]} → ${m[4]} zdrowia, zostało ran: ${m[5]}).${m[6] ? " Klątwy zostają, dopóki nie wyjdziesz." : ""}`],
    [/^The (.+) falls\. In its hoard: (.+)\. Unsecured until you climb out\.(?: You took an injury in that fight \((\d) of (\d)\): you hit a little softer and take a little more, until you rest or climb out\.)?$/,
      (m) => `${cap(NM(m[1]))} pada. W jego skarbie: ${list(m[2]).replace(/^(\d+) gold/, "$1 złota")}. Niezabezpieczone, dopóki nie wyjdziesz.${m[3] ? ` W tej walce odniosłeś ranę (${m[3]} z ${m[4]}): bijesz trochę słabiej i obrywasz trochę mocniej, dopóki nie odpoczniesz albo nie wyjdziesz.` : ""}`],
    [new RegExp(`^( )?Knocked out by the (.+) on level ${R}\\. You come to at the door of (.+?), dragged out by luck or by friends\\. (?:The expedition's finds \\((.+)\\) are lost in the dark\\.|You had found nothing down there yet\\.) Your gear and everything you brought in are safe\\.$`),
      (m) => `${m[1] || ""}Powalił cię ${NM(m[2])} na poziomie ${m[3]}. Budzisz się przy wejściu do ${NM(m[4])}, wyciągnięty przez szczęście albo przyjaciół. ${m[5] ? `Znaleziska wyprawy (${m[5].replace(/(\d+) gold/, "$1 złota").replace(/(\d+) things?/, (x, n) => `${n} ${things(n)}`).replace(" and ", " i ")}) przepadły w ciemności.` : "Nie znalazłeś tam jeszcze niczego."} Twój ekwipunek i wszystko, co przyniosłeś, są bezpieczne.`],
    [/^You climb back into daylight with (.+?)\.( Pathfinder: you know the way out and bring everything with you\.| You ran for it and dropped the expedition's finds \((.+)\) on the way up\.)$/,
      (m) => `${T(`You climb back into daylight with ${m[1]}.`)}${m[3] ? ` Uciekłeś i po drodze na górę zgubiłeś znaleziska wyprawy (${m[3].replace(/(\d+) gold/, "$1 złota").replace(/(\d+) things/, (x, n) => `${n} ${things(n)}`)}).` : " Tropiciel: znasz drogę na zewnątrz i wynosisz wszystko."}`],
    [/^A (.+) found you before you could sit down\. Once it's dead, you bind your wounds \((\d+) → (\d+) health\)\.$/,
      (m) => `${cap(NM(m[1]))} znalazł cię, zanim zdążyłeś usiąść. Gdy już nie żyje, opatrujesz rany (${m[2]} → ${m[3]} zdrowia).`],
    // the major fights' names and openings
    [/^(.+) guardian$/, (m) => { const b = NM(m[1]); return b !== m[1] ? `${b}, strażnik schodów` : null; }],
    [/^(.+), warden of the vault$/, (m) => `${NM(m[1])}, strażnik skarbca`],
    [/^Cursed (.+)$/, (m) => { const b = NM(m[1]); return b !== m[1] ? `${cap(b)} (przeklęty)` : null; }],
    [/^Legendary (.+)$/, (m) => { const b = NM(m[1]); return b !== m[1] ? `${cap(b)} (legendarny)` : null; }],
    [/^Two braziers flare\. The (.+) that guards the stairs steps out to meet you\.$/, (m) => `Dwa paleniska buchają ogniem. ${cap(NM(m[1]))}, który strzeże schodów, wychodzi ci naprzeciw.`],
    [/^Past the last trap, the (.+) waits with its back to a sealed door\.$/, (m) => `Za ostatnią pułapką czeka ${NM(m[1])}, plecami do zapieczętowanych drzwi.`],
    [/^The vault door stands open\. Its warden, an ancient (.+), rises from the gold\.$/, (m) => `Drzwi skarbca stoją otworem. Jego strażnik, pradawny ${NM(m[1])}, podnosi się ze złota.`],
    [/^Black candles gutter\. Something that was once a (.+) turns its hollow face to you\.$/, (m) => `Czarne świece migoczą. Coś, co kiedyś było ${NM(m[1])}, zwraca ku tobie pustą twarz.`],
    [/^The deepest hall\. The legendary (.+) has waited a thousand years for someone foolish enough to come this far\.$/, (m) => `Najgłębsza sala. Legendarny ${NM(m[1])} czekał tysiąc lat na kogoś dość szalonego, by tu dotrzeć.`],
    // fight lines (one piece of a " · " line each)
    [/^ the cold bites −(\d+)$/, (m) => ` mróz kąsa −${m[1]}`],
    [/^ blood moon \+(\d+)$/, (m) => ` krwawy księżyc +${m[1]}`],
    [/^ you bleed (\d+)$/, (m) => ` krwawisz ${m[1]}`],
    [/^ overcharge −(\d+)$/, (m) => ` przeciążenie −${m[1]}`],
    [/^ surge \+(\d+)$/, (m) => ` wzmocnienie +${m[1]}`],
    [/^ backlash −(\d+)$/, (m) => ` odrzut −${m[1]}`],
    [/^ a warm pulse \+(\d+)$/, (m) => ` ciepły impuls +${m[1]}`],
  );
})();
