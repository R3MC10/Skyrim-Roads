/* i18n_unlocks.js: Polish for features that open by level (unlocks.js): names, teasers (rewards.js shows them), guest notes,
   the party warning and the patch note. Loaded before i18n.js, which merges I18N_EXTRA. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const tr = (x) => (typeof I18N !== "undefined" && I18N.tr ? I18N.tr(x) : null) ?? x;
  const NAMES = {
    "Perks": "Atuty", "Gathering": "Zbieractwo", "Cooking and recipes": "Gotowanie i przepisy", "Smithing": "Kowalstwo",
    "Followers and hirelings": "Towarzysze i najemnicy", "Alchemy": "Alchemia", "Horses and carriages": "Konie i powozy",
    "Proper dungeons": "Prawdziwe lochy", "Clans": "Klany", "Houses and homesteads": "Domy i zagrody", "Clan wars": "Wojny klanów",
    "Enchanting and spell crafting": "Zaklinanie i tworzenie zaklęć", "Deadly dungeons": "Zabójcze lochy", "Shouts": "Krzyki",
    "World events": "Wydarzenia świata", "World bosses and expeditions": "Bossowie świata i wyprawy", "Elite encounters": "Elitarne spotkania",
    "Legendary hunts": "Legendarne łowy",
  };
  const nm = (x) => NAMES[x] || tr(x);
  Object.assign(I18N_EXTRA.words, NAMES, {
    "Powers": "Moce",
    // teasers (one per feature)
    "Spend a perk point to make a skill stronger.": "Wydaj punkt atutu, żeby wzmocnić umiejętność.",
    "Pick herbs, fish and hunt along the roads.": "Zbieraj zioła, łów ryby i poluj przy drogach.",
    "Cook hot meals at an inn's pot and learn simple recipes.": "Gotuj ciepłe posiłki w kotle w karczmie i ucz się prostych przepisów.",
    "Use the forge: make, improve and refine your own gear.": "Korzystaj z kuźni: twórz, ulepszaj i przetapiaj własny sprzęt.",
    "Hire someone to fight at your side.": "Wynajmij kogoś, kto będzie walczył u twego boku.",
    "Mix ingredients into potions and poisons.": "Mieszaj składniki w mikstury i trucizny.",
    "Buy a horse or take a carriage to travel faster.": "Kup konia albo jedź powozem, żeby podróżować szybciej.",
    "Hard dungeons open, with elite rooms and better loot.": "Otwierają się trudne lochy, z elitarnymi komnatami i lepszymi łupami.",
    "Found a clan or join one, with a banner and a tag.": "Załóż klan albo dołącz do jednego, ze sztandarem i znacznikiem.",
    "Buy a house in town or build a homestead.": "Kup dom w mieście albo zbuduj zagrodę.",
    "Earn points for your clan and fight over the holds.": "Zdobywaj punkty dla klanu i walcz o krainy.",
    "Learn enchantments and put them on your gear.": "Poznawaj zaklęcia i nakładaj je na sprzęt.",
    "The deadliest dungeons, deep delves and difficulty tiers.": "Najgroźniejsze lochy, głębokie zejścia i poziomy trudności.",
    "Spend dragon souls on Words of Power and shout.": "Wydawaj smocze dusze na Słowa Mocy i krzycz.",
    "Invasions, hunts, caravans, blizzards and other world news.": "Najazdy, łowy, karawany, zamiecie i inne wieści ze świata.",
    "Dragons, rifts and sieges for everyone, and long expeditions.": "Smoki, szczeliny i oblężenia dla wszystkich oraz długie wyprawy.",
    "Giants, hagravens, Thalmor and assassins on the road.": "Olbrzymi, wiedźmokruki, Thalmor i zabójcy na drogach.",
    "Hunt legendary beasts across Skyrim.": "Poluj na legendarne bestie w całym Skyrim.",
    // Coming next (patchnotes.js)
    "Mentoring: play side by side with friends of any level": "Mentoring: graj ramię w ramię z przyjaciółmi na każdym poziomie",
    // patch note b346
    "New things open as you level up": "Nowe rzeczy otwierają się z kolejnymi poziomami",
    "A new hero no longer gets every system at once. The big ones open one by one as you level up: perks at level 2, gathering and cooking at 3, the forge at 4, followers and alchemy at 5, horses at 6, hard dungeons at 7, clans and houses at 8, and so on up to legendary hunts at 20.":
      "Nowa postać nie dostaje już wszystkich systemów naraz. Duże systemy otwierają się po kolei wraz z poziomem: atuty na 2. poziomie, zbieractwo i gotowanie na 3., kuźnia na 4., towarzysze i alchemia na 5., konie na 6., trudne lochy na 7., klany i domy na 8. i tak dalej, aż do legendarnych łowów na 20.",
    "Your old characters keep everything they already used: if you have a horse, a house or a follower, they stay.":
      "Twoje stare postacie zachowują wszystko, czego już używały: jeśli masz konia, dom albo towarzysza, zostają.",
    "Friends, chat, parties and playing together are open from the start. In a party, a friend who hasn't reached a hard dungeon yet comes along as your guest, and the leader gets a heads-up first.":
      "Przyjaciele, czat, drużyny i wspólna gra są otwarte od początku. W drużynie przyjaciel, który nie doszedł jeszcze do trudnego lochu, idzie z tobą jako gość, a przywódca najpierw dostaje ostrzeżenie.",
    "A new character on an account that already got far skips the first tips and the guided first trip.":
      "Nowa postać na koncie, które zaszło już daleko, pomija pierwsze porady i prowadzoną pierwszą wyprawę.",
  });
  I18N_EXTRA.pat.push(
    [/^(.+) opens at level (\d+)\.$/, (m) => `${nm(m[1])}: otwiera się na ${m[2]}. poziomie.`],
    [/^You're here as a guest\. (.+) opens for you at level (\d+)\.$/, (m) => `Jesteś tu jako gość. ${nm(m[1])}: otwiera się dla ciebie na ${m[2]}. poziomie.`],
    [/^This place is too dangerous for now\. (.+) open at level (\d+); easy dungeons are open already\.$/,
      (m) => `To miejsce jest na razie zbyt niebezpieczne. ${nm(m[1])}: otwierają się na ${m[2]}. poziomie; łatwe lochy są już otwarte.`],
    [/^(.+) can't go into (.+) on their own yet \((.+) open at level (\d+)\)\. They can still come along as your guests\. Tap again to go\.$/,
      (m) => `${m[1]} nie może jeszcze sam(a) wejść do: ${m[2]} (${nm(m[3])}: od ${m[4]}. poziomu). Może iść z tobą jako gość. Dotknij jeszcze raz, żeby ruszyć.`],
  );
})();
