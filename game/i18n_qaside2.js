/* i18n_qaside2.js: Polish for lines the second side-systems bug hunt (claude/qa-side2-*) found still in English:
   the forge (Make / Smelt & tan / Improve, batch crafting), crafting results, the lockpicking hint, festivals,
   halls and the inn, plus its patch notes. Loaded after i18n_story.js and before i18n.js. Item and place names stay
   English, like everywhere else in the game. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const Q = { Fine: "Dobra", Superior: "Przednia", Exquisite: "Wyśmienita", Flawless: "Bez skazy", Epic: "Epicka", Legendary: "Legendarna", plain: "zwykła", better: "lepsza" };
  const q = (x) => Q[x] || x;
  const dmg = (k) => (k === "damage" ? "obrażeń" : "pancerza");
  Object.assign(I18N_EXTRA.words, {
    // the forge: tabs and groups
    "Make": "Wykuj", "Smelt & tan": "Przetop i garbuj", "Improve": "Ulepsz", "Once": "Raz", "Max": "Maks.",
    "Iron": "Żelazo", "Steel": "Stal", "Elven": "Elfickie", "Dwarven": "Krasnoludzkie", "Hide & leather": "Skóry", "Bows": "Łuki", "Jewellery": "Biżuteria",
    "Found recipes": "Znalezione przepisy", "Nothing to improve.": "Nie ma czego ulepszać.",
    "Smelt ore into ingots and tan pelts into leather. Ores come from mines; pelts from wolves, bears and sabre cats.":
      "Przetapiaj rudę na sztabki i garbuj futra na skórę. Ruda pochodzi z kopalń, futra z wilków, niedźwiedzi i szablozębów.",
    "You need a forge. Every blacksmith has one.": "Potrzebujesz kuźni. Każdy kowal ją ma.",
    "You need a forge. Every blacksmith has a smelter and a tanning rack.": "Potrzebujesz kuźni. Każdy kowal ma piec hutniczy i ramę garbarską.",
    "You need a forge. Blacksmiths have one.": "Potrzebujesz kuźni. Mają ją kowale.",
    "You can't make that.": "Tego nie wykujesz.", "That can't be improved.": "Tego nie da się ulepszyć.", "Nothing to do.": "Nie ma nic do zrobienia.",
    "Enchanted gear needs the Arcane Blacksmith perk.": "Zaklęty sprzęt wymaga atutu Tajemny kowal.",
    // batch crafting (craftqol.js)
    "Can make now": "Do zrobienia teraz", "Pin to the top": "Przypnij na górę", "Pinned to the top": "Przypięte na górze", "Unpin": "Odepnij",
    "Pinned to the top.": "Przypięte na górze.", "Unpinned.": "Odpięte.", "Make 5": "Zrób 5", "Make as many as you can": "Zrób tyle, ile się da",
    "Nothing to make.": "Nie ma czego robić.", "You can't make that now.": "Teraz tego nie zrobisz.", "You've run out of an ingredient.": "Skończył ci się składnik.",
    "Batches skip the mini-game and give the plain Quick craft result. Skill gains are exactly the same as making them one at a time.":
      "Partie pomijają minigrę i dają zwykły wynik szybkiego wytwarzania. Umiejętność rośnie dokładnie tak samo, jak przy robieniu po jednym.",
    "Always play crafting mini-games": "Zawsze graj w minigry rzemiosła",
    "Nothing here you can make from what you carry. Switch off “Can make now” to see what's missing.":
      "Z tego, co niesiesz, nic tu nie zrobisz. Wyłącz „Do zrobienia teraz”, żeby zobaczyć, czego brakuje.",
    // crafting results (single sentences; the whole line is split into sentences)
    "Rough work, but it holds.": "Toporna robota, ale trzyma.", "Great work.": "Świetna robota.", "Masterful work!": "Mistrzowska robota!", "Perfect work!": "Doskonała robota!",
    "The heat runs wild and the ore turns to slag.": "Żar wymyka się spod kontroli i ruda zamienia się w żużel.",
    "Your knife slips and the hide tears.": "Nóż ci się ześlizguje i skóra się rozdziera.",
    // patch note b252
    "Forge and lockpicking fixes": "Poprawki kuźni i otwierania zamków",
    "Fixed: in Polish, the forge was still mostly in English: the Make, Smelt & tan and Improve tabs, batch crafting, what's missing, and the line you get after making something.":
      "Naprawione: po polsku kuźnia była wciąż prawie cała po angielsku: zakładki Wykuj, Przetop i garbuj oraz Ulepsz, robienie partiami, czego brakuje i komunikat po wykuciu czegoś.",
    "Fixed: in Polish, the lockpicking hint under the lock is translated.": "Naprawione: po polsku podpowiedź pod zamkiem przy otwieraniu jest przetłumaczona.",
    "Fixed: after a festival smithing contest, your next forged item could get a free chance to save a material it never earned.":
      "Naprawione: po konkursie kowalskim na festynie następny wykuty przedmiot mógł dostać darmową szansę na odzyskanie materiału, na którą nie zapracował.",
  });
  I18N_EXTRA.pat.push(
    [/^Make as many as you can \((\d+)\)$/, (m) => `Zrób tyle, ile się da (${m[1]})`],
    [/^(Pin to the top|Unpin) (.+)$/, (m) => `${m[1] === "Unpin" ? "Odepnij" : "Przypnij na górę"}: ${m[2]}`],
    [/^from (.+) · you can make (\d+)$/, (m) => `z: ${m[1]} · możesz zrobić ${m[2]}`],
    [/^Missing: (.+)$/, (m) => `Brakuje: ${m[1]}`],
    [/^Can make (\d+)(?: \((\d+) in all\))?$/, (m) => `Możesz zrobić ${m[1]}${m[2] ? ` (razem ${m[2]})` : ""}`],
    [/^(\d+) of (\d+) ready( · ★ pinned first)?$/, (m) => `Gotowe: ${m[1]} z ${m[2]}${m[3] ? " · ★ przypięte na górze" : ""}`],
    [/^→ (\w+) \(\+(\d+) (damage|armor)\) · uses 1 (.+) \(you have (\d+)\)$/, (m) => `→ ${q(m[1])} (+${m[2]} ${dmg(m[3])}) · zużywa 1 ${m[4]} (masz ${m[5]})`],
    [/^Needs 1 (.+) \((blacksmiths sell it|found in dungeons and on tough foes)\)\.$/, (m) => `Wymaga 1 ${m[1]} (${m[2] === "blacksmiths sell it" ? "sprzedają go kowale" : "znajdziesz go w lochach i przy groźnych wrogach"}).`],
    [/^Your Smithing \((\d+)\) can't improve it past (\w+)\.$/, (m) => `Twoje Kowalstwo (${m[1]}) nie ulepszy tego ponad poziom: ${q(m[2])}.`],
    [/^Each improvement uses one piece of the item's material \(ingots, leather, firewood, moonstone or dwarven metal\)\. Blacksmiths sell the common ones; dungeons hide the rest\. Your Smithing \((\d+)\) sets how far: every 20 points allows one more quality level\.$/,
      (m) => `Każde ulepszenie zużywa jedną sztukę materiału przedmiotu (sztabki, skórę, drewno opałowe, kamień księżycowy albo krasnoludzki metal). Kowale sprzedają te zwykłe, resztę skrywają lochy. Twoje Kowalstwo (${m[1]}) wyznacza, jak daleko zajdziesz: co 20 punktów jeden poziom jakości więcej.`],
    // long notes fold into "first sentence + More", so the two halves are translated on their own too
    [/^Each improvement uses one piece of the item's material \(ingots, leather, firewood, moonstone or dwarven metal\)\.$/, () => "Każde ulepszenie zużywa jedną sztukę materiału przedmiotu (sztabki, skórę, drewno opałowe, kamień księżycowy albo krasnoludzki metal)."],
    [/^Blacksmiths sell the common ones; dungeons hide the rest\. Your Smithing \((\d+)\) sets how far: every 20 points allows one more quality level\.$/,
      (m) => `Kowale sprzedają te zwykłe, resztę skrywają lochy. Twoje Kowalstwo (${m[1]}) wyznacza, jak daleko zajdziesz: co 20 punktów jeden poziom jakości więcej.`],
    [/^Make (\d+) × (.+)\?$/, (m) => `Zrobić ${m[1]} × ${m[2]}?`], [/^Improve (.+) (\d+) steps?\?$/, (m) => `Ulepszyć ${m[1]} o ${m[2]}?`],
    [/^(Make|Improve|Cook|Brew) (\d+)$/, (m) => `${{ Make: "Zrób", Improve: "Ulepsz", Cook: "Ugotuj", Brew: "Uwarz" }[m[1]]} ${m[2]}`],
  );
  if (typeof I18N_STORY !== "undefined") {
    const PATS = [
      ["You make an {0} from {1}.", "Wykuwasz: {0} z: {1}."], ["You make a {0} from {1}.", "Wykuwasz: {0} z: {1}."], ["You make {0} from {1}.", "Wykuwasz: {0} z: {1}."],
      ["You smelt {0} into {1}.", "Przetapiasz {0} na {1}."], ["You tan {0} into {1}.", "Garbujesz {0} na {1}."],
      ["+{0} damage.", "+{0} obrażeń."], ["+{0} armor.", "+{0} pancerza."], ["You get {0} extra {1}.", "Dostajesz dodatkowo: {0} {1}."],
      ["Not a scrap wasted: you save 1 {0}.", "Nic się nie marnuje: odzyskujesz 1 {0}."], ["Botched! The {0} cracks on the anvil.", "Zepsute! {0} pęka na kowadle."],
      ["You save {0}.", "Odzyskujesz: {0}."], ["Missing {0}.", "Brakuje: {0}."], ["Needs the {0} perk (Smithing).", "Wymaga atutu {0} (Kowalstwo)."],
      ["Only the forge in {0} can make this.", "To wykuje tylko kuźnia w: {0}."], ["You need {0}.", "Potrzebujesz: {0}."], ["You need 1 {0}.", "Potrzebujesz 1 {0}."],
      ["You work {0} batch, but on the last one: {1}.", "Robisz {0} partię, ale przy ostatniej: {1}."], ["You work {0} batches, but on the last one: {1}.", "Robisz {0} partie, ale przy ostatniej: {1}."],
      ["You improve it {0} time: {1}.", "Ulepszasz to {0} raz: {1}."], ["You improve it {0} times: {1}.", "Ulepszasz to {0} razy: {1}."],
      ["You get {0}.", "Dostajesz: {0}."], ["You get {0} ({1} batches).", "Dostajesz: {0} (partie: {1})."],
      ["You make {0} ({1} batches).", "Robisz: {0} (partie: {1})."], ["Used {0}.", "Zużyto: {0}."],
      ["You stopped after {0}: you ran out of materials.", "Przerwano po {0}: skończyły się materiały."],
    ];
    for (const p of PATS) if (!I18N_STORY.pats.some(([en]) => en === p[0])) I18N_STORY.pats.push(p);
  }
  // halls, the Hall of the North, neighbours, the inn and festivals (ui.js, tourneyui.js)
  const HALLT = { Camp: "Obóz", Longhouse: "Długi dom", "Mead Hall": "Miodosytnia", "Fortified Hall": "Warowny dwór", "Jarl's Keep": "Twierdza jarla" };
  Object.assign(I18N_EXTRA.words, HALLT, {
    "Shared chest": "Wspólna skrzynia", "Empty for now.": "Na razie pusto.", "Put something in": "Włóż coś",
    "Rent a room": "Wynajmij pokój", "You're already rested": "Już jesteś wypoczęty", "Write": "Napisz", "Your verse": "Twoja zwrotka",
    "Hall name": "Nazwa dworu", "None yet.": "Na razie nic.", "None yet (or you're playing offline).": "Na razie nic (albo grasz offline).",
    "Nobody else has a house here yet.": "Nikt inny nie ma tu jeszcze domu.", "Nobody else has a house here yet (or you're playing offline).": "Nikt inny nie ma tu jeszcze domu (albo grasz offline).",
    "Visit": "Odwiedź", "Your hold": "Twoje włości", "Type a name": "Wpisz imię",
    "Your own hall: build a forge, a shrine, a trophy room, storage and a shop counter; decorate it; hire a shopkeeper, a steward and a guard.":
      "Twój własny dwór: zbuduj kuźnię, kapliczkę, salę trofeów, magazyn i ladę sklepu; urządź go; zatrudnij sklepikarza, zarządcę i strażnika.",
  });
  I18N_EXTRA.pat.push(
    [/^Buy ([A-Z][\w' ]+)$/, (m) => `Kup: ${m[1]}`],
    [/^Buy a hall plot in (.+)$/, (m) => `Kup działkę pod dwór w: ${m[1]}`],
    [/^Other halls in (.+)$/, (m) => `Inne dwory w: ${m[1]}`],
    [/^○ (Camp|Longhouse|Mead Hall|Fortified Hall|Jarl's Keep)( · [\d,. ]+)?$/, (m) => `○ ${HALLT[m[1]]}${m[2] || ""}`],
    [/^Other players who own (.+) in their own world\. Drop in to see their trophies, or leave a gift\.$/,
      (m) => `Inni gracze, którzy mają ${m[1]} we własnym świecie. Wpadnij obejrzeć ich trofea albo zostaw prezent.`],
    [/^Guild hall · (.+)$/, (m) => `Dwór gildii · ${m[1]}`],
    [/^(.+) · (\d+) rooms?( · has a shop)?$/, (m) => `${m[1]} · pokoje: ${m[2]}${m[3] ? " · ma sklep" : ""}`],
    [/^Level (\d+) · (\d+) dragon skulls?(.*)$/, (m) => `Poziom ${m[1]} · smocze czaszki: ${m[2]}${m[3]}`],
    [/^(.+) · on now · ends in (.+)$/, (m) => `${m[1]} · trwa · koniec za ${m[2]}`],
    [/^ends in (.+)$/, (m) => `koniec za ${m[1]}`],
    [/^(\d+)% there$/, (m) => `${m[1]}% do następnego poziomu`],
  );
  // "Great Hunt in Falkreath is on in Falkreath." read as "trwa w: Falkreath"; say it plainly
  if (typeof I18N_STORY !== "undefined") {
    const fix = { "{0} is on in {1}.": "{0} trwa teraz ({1})." };
    for (const p of I18N_STORY.pats) if (fix[p[0]]) p[1] = fix[p[0]];
    for (const [en, pl] of Object.entries(fix)) if (!I18N_STORY.pats.some(([e]) => e === en)) I18N_STORY.pats.push([en, pl]);
  }
  // "1 more Leather Strips" inside "Missing ..."
  I18N_EXTRA.pat.push([/^(\d+) more (.+)$/, (m) => `jeszcze ${m[1]} ${m[2]}`]);
  // "Iron Sword is now Fine" (batch improve) and "→ Fine" chips
  I18N_EXTRA.pat.push([/^(.+) is now (Fine|Superior|Exquisite|Flawless|Epic|Legendary|better)$/, (m) => `${m[1]}: teraz ${q(m[2])}`]);
})();
