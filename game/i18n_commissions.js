/* i18n_commissions.js: Polish for the company's Commissions board (commissions.js), its two perks and its patch note.
   Loaded before i18n.js. commissions.js hands I18N_COMMISSIONS.tpl to I18N.add at load (templates with {n} and exact
   lines); the exact lines also go to I18N_EXTRA.words so the screen translator knows them. */
var I18N_COMMISSIONS = (() => {
  const words = {};
  const TPL = {
    // ---- the board
    "Commissions": "Zlecenia",
    "Orders from the towns for the company. New ones in {n} min (a new game day).": "Zamówienia z miast dla kompanii. Nowe za {n} min (nowy dzień w grze).",
    "Company level {n}": "Poziom kompanii {n}", "{n} renown": "{n} sławy", "+{n} renown": "+{n} sławy", "gold": "złota",
    "Everyone in the company can help. Goods you hand in are used up. Each helper gets their share of the gold; in a party it's split evenly. Materials go to the stockpile.":
      "Każdy w kompanii może pomóc. Oddane towary przepadają. Każdy pomocnik dostaje swoją część złota; w drużynie dzieli się je po równo. Materiały trafiają do magazynu.",
    "The Jarl's steward": "Zarządca jarla", "The blacksmith": "Kowal", "The innkeeper": "Karczmarz", "The temple priest": "Kapłan świątyni",
    "Crafted goods": "Wyroby", "Gathered goods": "Zbiory", "Clear a camp": "Rozbij obóz", "Escort a caravan": "Eskortuj karawanę", "Commission": "Zlecenie",
    "The guard of {town} needs {n} {item}, made by someone who knows the work.": "Straż w {town} potrzebuje: {item} ×{n}, zrobione przez kogoś, kto zna się na rzeczy.",
    "The blacksmith in {town} is behind on orders and will pay for {n} {item} from your forge.": "Kowal w {town} nie nadąża z zamówieniami i zapłaci za: {item} ×{n} z twojej kuźni.",
    "Hunters in {town} want {n} {item} before the snows.": "Myśliwi w {town} chcą przed śniegami: {item} ×{n}.",
    "The forge in {town} is running low. Bring {n} {item}.": "W kuźni w {town} zaczyna brakować zapasów. Przynieś: {item} ×{n}.",
    "The innkeeper in {town} wants {n} {item} for the cold nights.": "Karczmarz w {town} chce na zimne noce: {item} ×{n}.",
    "A feast is coming in {town}. The innkeeper needs {n} {item}.": "W {town} szykuje się uczta. Karczmarz potrzebuje: {item} ×{n}.",
    "The temple in {town} is out of herbs. Bring {n} {item}.": "W świątyni w {town} skończyły się zioła. Przynieś: {item} ×{n}.",
    "The priests in {town} tend the sick and need {n} {item}.": "Kapłani w {town} opiekują się chorymi i potrzebują: {item} ×{n}.",
    "Outlaws have made camp on the roads of {hold}. The Jarl in {town} wants them gone.": "Banici rozbili obóz przy drogach krainy {hold}. Jarl w {town} chce się ich pozbyć.",
    "A merchant caravan leaves {town} for {to}. See it there in one piece.": "Karawana kupiecka wyrusza z {town} do {to}. Dopilnuj, żeby dotarła cała.",
    "Last day": "Ostatni dzień", "Done": "Gotowe", "Helped: {who}": "Pomogli: {who}",
    "for the stockpile: {what}": "do magazynu: {what}", "maybe {item}": "może {item}",
    "Hand in ({n})": "Oddaj ({n})", "Hand it in at {town}, or at your longhouse in {site}.": "Oddaj to w {town} albo w swoim długim domu w {site}.",
    "You don't carry any {item}.": "Nie masz przy sobie: {item}.",
    "On the road to {to}": "W drodze do {to}", "Give it up": "Porzuć", "Set out with the caravan": "Wyrusz z karawaną",
    "The caravan waits in {town}.": "Karawana czeka w {town}.",
    "Win fights against outlaws in {hold}, or clear a dungeon there.": "Wygrywaj walki z banitami w krainie {hold} albo oczyść tam loch.",
    "That order is closed.": "To zlecenie jest już zamknięte.", "You're not in a company.": "Nie należysz do kompanii.",
    "The longhouse didn't answer. Try again.": "Długi dom nie odpowiedział. Spróbuj jeszcze raz.",
    "Order filled! The town pays out.": "Zlecenie wypełnione! Miasto płaci.", "Handed in.": "Oddane.",
    "You set out with the caravan. Ride to {to}.": "Wyruszasz z karawaną. Jedź do {to}.", "You leave the caravan. No harm done.": "Zostawiasz karawanę. Nic się nie stało.",
    "Commission done: {title} for {town}.": "Zlecenie wykonane: {title} dla {town}.", "Commission: {title} ({n}/{m})": "Zlecenie: {title} ({n}/{m})",
    "Commission paid: {g} gold{it}.": "Zapłata za zlecenie: {g} złota{it}.",
    "Commission paid: {g} gold{it} (split with your party: {each} each).": "Zapłata za zlecenie: {g} złota{it} (podział z drużyną: po {each}).",
    " and {item}": " i {item}", "a commission": "zleceniu",
    "{who} finished a commission for {town}": "{who} wykonuje zlecenie dla {town}",
    // ---- perks
    "Commission Broker": "Pośrednik zleceń", "Master's Mark": "Znak mistrza",
    "You talk the towns up: your share of commission gold is 15/30% bigger.": "Umiesz rozmawiać z miastami: twoja część złota ze zleceń jest o 15/30% większa.",
    "Towns trust your maker's mark: orders for crafted goods you finish give the company half again the materials, and a better chance of an extra item.":
      "Miasta ufają twojemu znakowi: zlecenia na wyroby, które kończysz, dają kompanii o połowę więcej materiałów i większą szansę na dodatkowy przedmiot.",
    // ---- the patch note (b311)
    "The Commissions board": "Tablica zleceń",
    "Your company's longhouse has a Commissions board: open Social, then Company, then Commissions.": "Długi dom twojej kompanii ma tablicę zleceń: otwórz Społeczność, potem Kompania, potem Zlecenia.",
    "Every game day the towns post 3 to 5 orders for your company: a Jarl's steward, a blacksmith, an innkeeper or a temple priest wants crafted goods (swords, boots, stews, potions), gathered goods (ore, firewood, pelts, herbs), an outlaw camp cleared, or a caravan taken safely to another town.":
      "Każdego dnia w grze miasta wywieszają od 3 do 5 zleceń dla twojej kompanii: zarządca jarla, kowal, karczmarz albo kapłan chce wyrobów (miecze, buty, gulasze, mikstury), zbiorów (ruda, drewno, skóry, zioła), rozbicia obozu banitów albo bezpiecznego odprowadzenia karawany do innego miasta.",
    "The bigger your company grows (rooms built, renown earned), the more orders there are and the more they ask and pay.":
      "Im bardziej rośnie kompania (zbudowane sale, zdobyta sława), tym więcej jest zleceń i tym więcej wymagają i płacą.",
    "Everyone in the company can help. Goods you hand in are used up. When an order is filled, each helper gets their share of the gold (in a party it's split evenly), the company gets renown and materials for its stockpile, and sometimes whoever finished it gets an item too.":
      "Każdy w kompanii może pomóc. Oddane towary przepadają. Gdy zlecenie jest wypełnione, każdy pomocnik dostaje swoją część złota (w drużynie dzieli się po równo), kompania dostaje sławę i materiały do magazynu, a czasem ten, kto je skończył, dostaje też przedmiot.",
    "New perks: Commission Broker (Speech) makes your commission gold 15/30% bigger, and Master's Mark (Smithing) gives the company more materials and a better chance of an item from orders for crafted goods.":
      "Nowe atuty: Pośrednik zleceń (Elokwencja) zwiększa złoto ze zleceń o 15/30%, a Znak mistrza (Kowalstwo) daje kompanii więcej materiałów i większą szansę na przedmiot ze zleceń na wyroby.",
  };
  for (const [k, v] of Object.entries(TPL)) if (!k.includes("{")) words[k] = words[k] || v;
  if (typeof I18N_EXTRA === "undefined") globalThis.I18N_EXTRA = { words: {}, pat: [] };
  for (const [k, v] of Object.entries(words)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  return { tpl: TPL, words };
})();
