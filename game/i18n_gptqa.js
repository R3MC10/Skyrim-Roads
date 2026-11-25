/* i18n_gptqa.js: Polish for the small QA round (GPT round 1, brief 6): the indoor dungeon lines (dunlines.js), the
   weapon kind in item tooltips (tooltip.js), the foe's 2nd/3rd move in the turn order (tbfight.js) and the patch note.
   Loaded before i18n.js: exact lines go in I18N_EXTRA.words, lines with names in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const I18N_GPTQA = (() => {
  const W = {
    // indoor dungeon lines (dunlines.js)
    "A draugr climbs out of its burial niche, eyes glowing blue.": "Draug wychodzi ze swojej niszy grobowej, oczy świecą mu na niebiesko.",
    "Stone scrapes on stone. A draugr pushes its coffin lid aside and stands up.": "Kamień zgrzyta o kamień. Draug odsuwa wieko trumny i wstaje.",
    "Bones rattle in a side passage. A skeleton steps out, sword in hand.": "W bocznym korytarzu grzechoczą kości. Wychodzi szkielet z mieczem w dłoni.",
    "A heap of bones by the wall pulls itself together into a skeleton.": "Kupka kości pod ścianą składa się w szkielet.",
    "A skeleton stands guard by a cracked altar and turns its skull towards you.": "Szkielet stoi na straży przy pękniętym ołtarzu i odwraca czaszkę w twoją stronę.",
    "Thick webs hang from the ceiling. Something large shifts in the dark above you.": "Z sufitu zwisają grube pajęczyny. Coś dużego porusza się w ciemności nad tobą.",
    "A frostbite spider drops from a web in the corner, fangs dripping.": "Mroźny pająk spuszcza się z pajęczyny w kącie, z kłów kapie mu jad.",
    "Webs choke a broken pipe. A frostbite spider crawls out between the brass gears.": "Pajęczyny zatykają pękniętą rurę. Spomiędzy mosiężnych zębatek wypełza mroźny pająk.",
    "A lone wolf growls from the shadows at the back of the chamber, then lunges.": "Samotny wilk warczy z cienia w głębi komnaty, a potem skacze.",
    "A wolf looks up from a pile of gnawed bones and bares its teeth.": "Wilk podnosi łeb znad sterty ogryzionych kości i szczerzy kły.",
    "A bandits' guard wolf breaks its rope and runs at you.": "Wilk stróżujący bandytów zrywa sznur i biegnie na ciebie.",
    "Eyes glint in the dark of the den. A pack of wolves pours out of the tunnel.": "W mroku legowiska błyszczą oczy. Z tunelu wypada wataha wilków.",
    "This is a bear's den. The bear rises on its hind legs and roars, and the whole cave rings with it.": "To niedźwiedzia gawra. Niedźwiedź staje na tylnych łapach i ryczy, aż dudni cała jaskinia.",
    "A bandit jumps up from a bedroll by the fire. \"We've got company!\"": "Bandyta zrywa się z posłania przy ognisku. „Mamy gościa!”",
    "Bandits have made a camp in this cave. One of them grabs an axe: \"Who let you in?\"": "Bandyci urządzili sobie obóz w tej jaskini. Jeden chwyta topór: „A ciebie kto wpuścił?”",
    "A bandit drops his pickaxe by the ore cart and draws a blade instead.": "Bandyta rzuca kilof przy wózku z rudą i dobywa ostrza.",
    "A bandit on the wall walk shouts down to the yard and comes at you.": "Bandyta na murach krzyczy coś na dziedziniec i rusza na ciebie.",
    "A bandit kicks over a stool by the tents. \"Your money or your life!\"": "Bandyta kopniakiem przewraca stołek przy namiotach. „Pieniądze albo życie!”",
    "A hired sword in the keep's hall puts down his mug. \"The Thalmor pay me to keep people like you out.\"": "Najemnik w sali twierdzy odstawia kufel. „Thalmor płaci mi, żebym nie wpuszczał tu takich jak ty.”",
    "Forsworn in antlered masks rise from behind a wall of bones and briars.": "Wiarołomcy w maskach z rogami wstają zza muru z kości i cierni.",
    "A pale figure turns from a bloodstained altar. \"All this way just to feed me? How kind.\"": "Blada postać odwraca się od zakrwawionego ołtarza. „Tyle drogi, żeby mnie nakarmić? Jakie to miłe.”",
    "The giant by the fire stands up, grabs its club and stomps towards you.": "Olbrzym przy ognisku wstaje, chwyta maczugę i rusza na ciebie ciężkim krokiem.",
    "Thalmor soldiers in gilded armour block the corridor. \"This keep is closed to Talos worshippers.\"": "Żołnierze Thalmoru w złoconych zbrojach zagradzają korytarz. „Ta twierdza jest zamknięta dla czcicieli Talosa.”",
    // weapon kind in item tooltips (tooltip.js)
    "One-handed weapon": "Broń jednoręczna", "Two-handed weapon": "Broń dwuręczna", "Two-handed bow": "Łuk", "One-handed bow": "Łuk",
    // the foe's later moves in the turn order (tbfight.js)
    "2nd": "2.", "3rd": "3.", "4th": "4.", "5th": "5.",
    // patch note b240
    "Dungeon rooms and small fixes": "Komnaty lochów i drobne poprawki",
    "Fixed: foes in dungeons were met with road lines, like webs stretched \"across the road\" deep in a barrow. Bandits, wolves, spiders, draugr and the rest now get their own lines for caves, mines, forts, barrows and other places.":
      "Naprawione: wrogów w lochach witały teksty z drogi, na przykład pajęczyny „w poprzek drogi” głęboko w kurhanie. Bandyci, wilki, pająki, draugi i reszta mają teraz własne teksty do jaskiń, kopalń, fortów, kurhanów i innych miejsc.",
    "Fixed: a weapon's details said \"One-handed weapon · One-Handed\". Now it just says \"One-handed weapon\".":
      "Naprawione: w opisie broni stało „Broń jednoręczna · Jednoręczna”. Teraz jest samo „Broń jednoręczna”.",
    "Fixed: the turn order at the top of a fight could show three bandits when only one was there. A foe that moves 2 or 3 times a round still has a mark for each move, but the later ones now say 2nd and 3rd and look smaller, so you can see it's the same foe.":
      "Naprawione: kolejka tur u góry walki potrafiła pokazać trzech bandytów, gdy był tylko jeden. Wróg, który rusza się 2 albo 3 razy na rundę, nadal ma znaczek na każdy ruch, ale kolejne mają teraz napis 2. i 3. i są mniejsze, więc widać, że to ten sam wróg.",
  };
  Object.assign(I18N_EXTRA.words, W);
  // "Bandit outlaw acts again: its 2nd move this round."
  I18N_EXTRA.pat.push([/^(.+) acts again: its (\d+)\w\w move this round\.$/, (m) => {
    const nm = (typeof I18N !== "undefined" && I18N.tr && I18N.tr(m[1])) || m[1];
    return `${nm} rusza się znowu: to jego ${m[2]}. ruch w tej rundzie.`;
  }]);
  return { W };
})();
if (typeof module !== "undefined") module.exports = I18N_GPTQA;
