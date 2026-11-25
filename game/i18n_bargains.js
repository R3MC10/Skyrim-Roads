/* i18n_bargains.js: Polish for bargains.js (Daedric bargains: shrine contracts, pact artifacts, their powers and curses),
   its three perks and its patch note. Loaded before i18n.js. bargains.js hands I18N_BARG.tpl to I18N.add at load
   (templates with {n} and exact lines); the exact lines also go to I18N_STORY.ex so the screen translator knows them. */
var I18N_BARG = (() => {
  const TPL = {
    // ---- the panel
    "Daedric bargains": "Daedryczne układy",
    "Dormant": "Uśpiony", "Awakened": "Przebudzony", "Ascendant": "Wyniesiony", "Curse": "Klątwa", "Bound": "Związany", "done": "zrobione",
    "Princes make offers at black shrines along the roads. Finish a contract and its artifact is yours. Bind one artifact at a time: it wakes as you do the deeds its prince likes.":
      "Książęta daedr składają oferty przy czarnych kapliczkach przy drogach. Wypełnij kontrakt, a jego artefakt będzie twój. Wiązać możesz jeden artefakt naraz: budzi się, gdy robisz to, co lubi jego książę.",
    "You swore the Vow of Cleansing: no prince will deal with you, and your artifact has stopped growing.": "Złożyłeś Ślub Oczyszczenia: żaden książę nie będzie z tobą rozmawiał, a twój artefakt przestał rosnąć.",
    "You carry the Daedric Mark: shrines call twice as often and your deeds count a quarter more.": "Nosisz Znamię daedry: kapliczki wołają dwa razy częściej, a twoje czyny liczą się o jedną czwartą bardziej.",
    "No contract yet. Keep an eye out for a black shrine on your travels.": "Nie masz jeszcze kontraktu. Wypatruj czarnej kapliczki w podróży.",
    "Contract with {prince}": "Kontrakt: książę daedr {prince}", "Reward: {art}. {desc}": "Nagroda: {art}. {desc}", "Break the contract": "Zerwij kontrakt",
    "Ascendant. Its curse is on you.": "Wyniesiony. Ciąży na tobie jego klątwa.",
    "You refused its curse. It stays Awakened until you accept.": "Odrzuciłeś jego klątwę. Zostaje przebudzony, dopóki jej nie przyjmiesz.",
    "Ready to ascend, if you accept its curse.": "Gotowy do wyniesienia, jeśli przyjmiesz jego klątwę.",
    "Next stage: {a} of {b} deeds.": "Następny etap: {a} z {b} czynów.",
    "Bind this one": "Zwiąż ten", "Accept the curse and ascend": "Przyjmij klątwę i wynieś go", "Refuse": "Odrzuć", "Let it sleep": "Uśpij go",
    "Only the bound artifact grows and works.": "Rośnie i działa tylko związany artefakt.",
    // ---- the road
    "A Daedric shrine": "Daedryczna kapliczka", "Accept {prince}'s contract": "Przyjmij kontrakt (książę daedr {prince})", "Walk on": "Idź dalej",
    "You leave the shrine and its whispers behind.": "Zostawiasz kapliczkę i jej szepty za sobą.",
    // ---- what you do
    "{prince} is pleased. Next: {what}": "Książę daedr {prince} jest zadowolony. Dalej: {what}",
    "The {art} awakens. A new power stirs in it.": "{art}: artefakt się budzi. Porusza się w nim nowa moc.",
    "The {art} could ascend. Accept or refuse its curse under Character, Daedric bargains.": "{art}: artefakt może zostać wyniesiony. Przyjmij albo odrzuć jego klątwę w Postaci, w Daedrycznych układach.",
    "The contract is done. {prince} keeps the bargain: the {art} is yours (see Character, Daedric bargains).": "Kontrakt wypełniony. Książę daedr {prince} dotrzymuje umowy: {art} jest twój (zobacz Postać, Daedryczne układy).",
    "No prince answers.": "Żaden książę nie odpowiada.",
    "You swore the Vow of Cleansing: the princes have turned away from you.": "Złożyłeś Ślub Oczyszczenia: książęta daedr odwrócili się od ciebie.",
    "You already serve {prince}. Finish or break that contract first.": "Już służysz: książę daedr {prince}. Najpierw wypełnij albo zerwij tamten kontrakt.",
    "{prince} has already paid you.": "Książę daedr {prince} już ci zapłacił.",
    "You accept {prince}'s contract, {name}. First: {what}": "Przyjmujesz kontrakt, {name} (książę daedr {prince}). Najpierw: {what}",
    "You serve no prince.": "Nie służysz żadnemu księciu.",
    "You turn your back on {prince}. The shrines will be silent for a while.": "Odwracasz się od księcia daedr: {prince}. Kapliczki przez jakiś czas będą milczeć.",
    "You don't have that artifact.": "Nie masz tego artefaktu.",
    "You bind the {art} to you. Its powers are yours now, and only its prince's deeds will wake it.": "Wiążesz ze sobą: {art}. Jego moce są teraz twoje i obudzą go tylko czyny miłe jego księciu.",
    "The {art} isn't ready yet.": "{art}: artefakt nie jest jeszcze gotowy.",
    "The Daedric Mark on your skin burns darker.": "Znamię daedry na twojej skórze ciemnieje i pali.",
    "A black sigil burns into your skin: you carry the Daedric Mark now.": "Czarny znak wypala się na twojej skórze: nosisz teraz Znamię daedry.",
    "You accept the curse. The {art} is Ascendant: {power}": "Przyjmujesz klątwę. {art} jest wyniesiony: {power}",
    "Curse: {name}. {what}": "Klątwa: {name}. {what}",
    "You refuse the curse. The {art} stays Awakened. You can change your mind later.": "Odrzucasz klątwę. {art} zostaje przebudzony. Możesz później zmienić zdanie.",
    "It isn't Ascendant.": "On nie jest wyniesiony.",
    "You let the {art} sleep. It is Awakened again and its curse is gone.": "Usypiasz: {art}. Znów jest przebudzony, a jego klątwa zniknęła.",
    // ---- in a fight
    "the Cinder smoulders ({n})": "Żar się tli ({n})", "Twilight's Grace heals you (+{n})": "Łaska Zmierzchu cię leczy (+{n})",
    "blood scent (+{n})": "zapach krwi (+{n})", "Meridia's light burns ({n})": "światło Meridii pali ({n})",
    "The Eye of Nocturnal finds you {n} gold.": "Oko Nocturnal znajduje dla ciebie {n} sztuk złota.",
    // ---- powers
    "Dagon's fire: you hit {n}% harder.": "Ogień Dagona: bijesz o {n}% mocniej.",
    "Smoulder: every round the foe burns for {n}.": "Tlenie: co rundę wróg płonie za {n}.",
    "Ruin: against a foe under a third of its health you hit {n}% harder.": "Ruina: wroga, któremu zostało mniej niż jedna trzecia zdrowia, bijesz o {n}% mocniej.",
    "Moonlight: every round in a fight you get back {n}% of your stamina and magicka.": "Blask księżyca: co rundę walki odzyskujesz {n}% wytrzymałości i magii.",
    "At night foes hit you {n}% softer.": "Nocą wrogowie biją cię o {n}% słabiej.",
    "Twilight's Grace: once a fight, when you drop under a quarter of your health, the moon heals you for {n}% of it.": "Łaska Zmierzchu: raz na walkę, gdy spadniesz poniżej jednej czwartej zdrowia, księżyc leczy cię o {n}% zdrowia.",
    "Your blows in the first round of a fight hit {n}% harder (not against big or dangerous foes).": "Twoje ciosy w pierwszej rundzie walki są o {n}% mocniejsze (nie przeciw dużym i groźnym wrogom).",
    "Shadows cling to you: foes hit you {a}% softer ({b}% at night).": "Cienie lgną do ciebie: wrogowie biją cię o {a}% słabiej (nocą o {b}%).",
    "At night and underground you hit {a}% harder, and every fight you win leaves you {b} more gold.": "Nocą i pod ziemią bijesz o {a}% mocniej, a każda wygrana walka daje ci {b} sztuk złota więcej.",
    "You hit beasts {n}% harder.": "Bijesz zwierzęta o {n}% mocniej.",
    "Blood scent: while the foe is under half its health you heal {n}% every round.": "Zapach krwi: dopóki wróg ma mniej niż połowę zdrowia, co rundę leczysz {n}%.",
    "The Hunt: while you're under half your health you hit {n}% harder.": "Łowy: dopóki masz mniej niż połowę zdrowia, bijesz o {n}% mocniej.",
    "Fighting alone (no follower or friend) you hit {n}% harder.": "Walcząc sam (bez towarzysza i przyjaciela) bijesz o {n}% mocniej.",
    "Every round you get hurt, you get back {n}% of your stamina.": "Za każdą rundę, w której oberwiesz, odzyskujesz {n}% wytrzymałości.",
    "Warriors, bandits and mages take {n}% more from you.": "Wojownicy, bandyci i magowie dostają od ciebie o {n}% więcej.",
    "You hit the undead {n}% harder.": "Bijesz nieumarłych o {n}% mocniej.",
    "Radiance: every round the foe takes {n} light damage, twice that if it's undead.": "Blask: co rundę wróg dostaje {n} obrażeń od światła, dwa razy tyle, jeśli jest nieumarły.",
    "Dawn's Ward: the undead and daedra hit you {n}% softer.": "Osłona Świtu: nieumarli i daedry biją cię o {n}% słabiej.",
    // ---- curses
    "Dagon's Hunger": "Głód Dagona", "Every foe hits you {n}% harder.": "Każdy wróg bije cię o {n}% mocniej.",
    "Sunblind": "Oślepienie słońcem", "Out in daylight you hit {n}% softer.": "Na zewnątrz za dnia bijesz o {n}% słabiej.",
    "The Tithe of Shadows": "Dziesięcina cieni", "Shopkeepers sense it: everything costs you {n}% more.": "Kupcy to wyczuwają: wszystko kosztuje cię o {n}% więcej.",
    "The Beast's Hunger": "Głód bestii", "Potions heal you {n}% less.": "Mikstury leczą cię o {n}% słabiej.",
    "Boethiah's Contempt": "Pogarda Boethii", "With a follower or friend at your side you hit {n}% softer.": "Z towarzyszem albo przyjacielem u boku bijesz o {n}% słabiej.",
    "Blinding Light": "Oślepiające światło", "Its glow gives you away: Sneak is {n} lower.": "Jego blask cię zdradza: skradanie jest niższe o {n}.",
    // ---- princes, contracts, artifacts
    "Mehrunes Dagon": "Mehrunes Dagon", "slaughter": "rzeź", "The Burning Tithe": "Płonąca danina",
    "Embers glow in the black wax and a voice like a forge roars in your head: \"Bring me ruin, mortal, and I will make you a weapon of it.\"": "W czarnym wosku żarzą się węgle, a w twojej głowie ryczy głos jak kuźnia: „Przynieś mi ruinę, śmiertelniku, a zrobię z niej dla ciebie broń”.",
    "Cinder of Dagon": "Żar Dagona", "A coal that never cools, in a cage of black iron.": "Węgiel, który nigdy nie stygnie, w klatce z czarnego żelaza.",
    "Grows with every foe you slay, and faster with dangerous ones.": "Rośnie z każdym zabitym wrogiem, a szybciej z groźnymi.",
    "Azura": "Azura", "the night": "noc", "The Twilight Vigil": "Czuwanie o zmierzchu",
    "The moon comes out from behind a cloud and the altar shines like a star. A woman's voice, calm and cold: \"Walk in my twilight, and I will light your way.\"": "Księżyc wychodzi zza chmury, a ołtarz lśni jak gwiazda. Kobiecy głos, spokojny i zimny: „Chodź w moim zmierzchu, a oświetlę ci drogę”.",
    "Azura's Moonshard": "Odłamek księżyca Azury", "A sliver of pale crystal that glows when the sun goes down.": "Drzazga bladego kryształu, która świeci, gdy zachodzi słońce.",
    "Grows with every fight you win at night.": "Rośnie z każdą walką wygraną nocą.",
    "Nocturnal": "Nocturnal", "theft": "kradzież", "The Shadow Debt": "Dług cienia",
    "A raven lands on the altar and stares at your purse. A whisper from everywhere at once: \"Take what isn't yours, little shadow. I will take my share.\"": "Kruk siada na ołtarzu i wpatruje się w twoją sakiewkę. Szept zewsząd naraz: „Bierz, co nie twoje, mały cieniu. Ja wezmę swoją dolę”.",
    "Eye of Nocturnal": "Oko Nocturnal", "A black glass eye on a cord. It never quite looks where you do.": "Czarne szklane oko na sznurku. Nigdy nie patrzy dokładnie tam, gdzie ty.",
    "Grows with every pocket and lock you pick, and every fight you open from hiding.": "Rośnie z każdą okradzioną kieszenią i otwartym zamkiem, i z każdą walką zaczętą z ukrycia.",
    "Hircine": "Hircyn", "the hunt": "łowy", "The Hunter's Due": "Dola łowcy",
    "Antlers of old bone are piled around the altar. Somewhere close a wolf howls, and then a man laughs: \"Hunt, and be hunted. That is my bargain.\"": "Wokół ołtarza leżą stare poroża. Gdzieś blisko wyje wilk, a potem śmieje się mężczyzna: „Poluj i bądź łowną zwierzyną. Taki jest mój układ”.",
    "Hircine's Bone Totem": "Kościany totem Hircyna", "A carved antler on a sinew cord, warm as something alive.": "Rzeźbione poroże na ścięgnie, ciepłe jak coś żywego.",
    "Grows with every beast you slay, and faster with great ones.": "Rośnie z każdym zabitym zwierzęciem, a szybciej z wielkimi.",
    "Boethiah": "Boethia", "the lone fight": "samotna walka", "The Champion's Price": "Cena czempiona",
    "The altar is scratched with the names of the dead. A woman laughs, sharp as a knife: \"Friends betray. Stand alone, and prove you deserve to.\"": "Ołtarz jest porysowany imionami zmarłych. Kobieta śmieje się, ostro jak nóż: „Przyjaciele zdradzają. Stań sam i udowodnij, że na to zasługujesz”.",
    "Sigil of Boethiah": "Pieczęć Boethii", "A ring of black iron sigils that tightens when blood is spilled.": "Obręcz z czarnych żelaznych znaków, która zaciska się, gdy leje się krew.",
    "Grows with fights you win alone, warriors and mages you beat, and close calls.": "Rośnie z walkami wygranymi w pojedynkę, pokonanymi wojownikami i magami oraz z walkami o włos.",
    "Meridia": "Meridia", "the restless dead": "niespokojni zmarli", "The Cleansing Light": "Oczyszczające światło",
    "A beam of white light falls on the altar from a clear night sky. A bright voice: \"The dead walk where they should sleep. Put them down, champion.\"": "Z czystego nocnego nieba na ołtarz pada snop białego światła. Jasny głos: „Umarli chodzą tam, gdzie powinni spać. Połóż ich, czempionie”.",
    "Meridia's Lantern": "Latarnia Meridii", "A small brass lantern whose flame burns white and never smokes.": "Mała mosiężna latarnia, której płomień pali się na biało i nigdy nie dymi.",
    "Grows with every undead you put down and every barrow you clear.": "Rośnie z każdym położonym nieumarłym i każdym oczyszczonym kurhanem.",
    // ---- the deeds
    "Slay 8 foes.": "Zabij 8 wrogów.",
    "Bring down 2 dangerous foes (a boss, an elite, a dragon or anything high-danger).": "Pokonaj 2 groźnych wrogów (bossa, elitę, smoka albo coś bardzo groźnego).",
    "Clear a dungeon to its boss.": "Oczyść loch aż do bossa.",
    "Win 3 fights at night.": "Wygraj 3 walki nocą.", "Win a fight at night against a dangerous foe.": "Wygraj nocą walkę z groźnym wrogiem.",
    "Slay 2 of the restless dead or daedra.": "Zabij 2 niespokojnych zmarłych albo daedry.",
    "Pick 4 pockets without being caught.": "Okradnij 4 kieszenie tak, by cię nie złapano.", "Pick 3 locks.": "Otwórz wytrychem 3 zamki.",
    "Win a fight you opened from hiding.": "Wygraj walkę, którą zacząłeś z ukrycia.",
    "Slay 5 beasts.": "Zabij 5 zwierząt.", "Bring down a great beast (a troll, a bear, a sabre cat, a mammoth...).": "Powal wielką bestię (trolla, niedźwiedzia, tygrysa szablozębnego, mamuta...).",
    "Slay a beast at night.": "Zabij zwierzę nocą.",
    "Win 3 fights with no follower or friend at your side.": "Wygraj 3 walki bez towarzysza i przyjaciela u boku.",
    "Beat 3 warriors, bandits or mages.": "Pokonaj 3 wojowników, bandytów albo magów.",
    "Win a fight with less than a third of your health left.": "Wygraj walkę, mając mniej niż jedną trzecią zdrowia.",
    "Put 5 of the restless dead to rest (draugr, skeletons, ghosts, vampires).": "Połóż na spoczynek 5 niespokojnych zmarłych (draugry, szkielety, duchy, wampiry).",
    "Clear a Nordic barrow.": "Oczyść nordycki kurhan.",
    "Destroy a powerful undead (a Deathlord, a dragon priest, a vampire lord...).": "Zniszcz potężnego nieumarłego (władcę śmierci, smoczego kapłana, wampirzego lorda...).",
  };
  const words = {
    // ---- perks
    "Princely Favour": "Książęca łaska", "Bound Will": "Związana wola", "Awakened Bond": "Przebudzona więź",
    "Daedric princes see the old arts in you: deeds for their contracts and for your pact artifact count 50% more.": "Książęta daedr widzą w tobie dawną sztukę: czyny do ich kontraktów i do twojego artefaktu paktu liczą się o 50% bardziej.",
    "You keep your own mind: an Ascendant artifact's curse is half as strong.": "Zachowujesz własny rozum: klątwa wyniesionego artefaktu jest o połowę słabsza.",
    "You understand what sleeps in a Daedric artifact: your pact artifact's powers are 25% stronger.": "Rozumiesz, co śpi w daedrycznym artefakcie: moce twojego artefaktu paktu są o 25% silniejsze.",
    // ---- patch note
    "Daedric bargains and artifacts that wake up": "Daedryczne układy i artefakty, które się budzą",
    "Black shrines by the road can now carry an offer from one of six Daedric princes: Mehrunes Dagon, Azura, Nocturnal, Hircine, Boethiah and Meridia (from level 8).":
      "Czarne kapliczki przy drodze mogą teraz nieść ofertę od jednego z sześciu książąt daedr: Mehrunesa Dagona, Azury, Nocturnal, Hircyna, Boethii i Meridii (od 8. poziomu).",
    "Accept a contract and do three things your prince likes, counted from how you really play: slaying foes, winning at night, picking pockets and locks, hunting beasts, fighting alone or putting the dead to rest.":
      "Przyjmij kontrakt i zrób trzy rzeczy, które lubi twój książę, liczone z tego, jak naprawdę grasz: zabijanie wrogów, wygrane nocą, okradanie kieszeni i otwieranie zamków, polowanie na zwierzęta, walka w pojedynkę albo kładzenie zmarłych na spoczynek.",
    "Finish it and the prince's artifact is yours. Bind one at a time: it starts Dormant, wakes up with more of those deeds and can become Ascendant. Every stage adds a new power in every kind of fight.":
      "Wypełnij go, a artefakt księcia jest twój. Wiązać możesz jeden naraz: zaczyna uśpiony, budzi się od kolejnych takich czynów i może zostać wyniesiony. Każdy etap dodaje nową moc w każdym rodzaju walki.",
    "Ascendant comes with a curse, and you choose: accept it, or refuse and stay Awakened. You can let it sleep again later.":
      "Wyniesienie przychodzi z klątwą i to ty wybierasz: przyjmij ją albo odrzuć i zostań przy przebudzonym. Później możesz go znów uśpić.",
    "The Daedric Mark matters here: carrying it, shrines call twice as often and your deeds count more. Accepting a curse brands you with the Mark, and the Vow of Cleansing makes the princes turn away.":
      "Znamię daedry ma tu znaczenie: z nim kapliczki wołają dwa razy częściej, a twoje czyny liczą się bardziej. Przyjęcie klątwy wypala na tobie Znamię, a Ślub Oczyszczenia sprawia, że książęta się odwracają.",
    "Artifacts help, but never more than going from good gear to the best you can forge.":
      "Artefakty pomagają, ale nigdy bardziej niż przejście z dobrego ekwipunku na najlepszy, jaki możesz wykuć.",
    "Find it all on the Character screen under Daedric bargains.": "Wszystko znajdziesz na ekranie postaci w Daedrycznych układach.",
    "New perks: Princely Favour (Mysticism, deeds count more), Bound Will (Restoration, curses half as strong) and Awakened Bond (Enchanting, artifact powers stronger).":
      "Nowe atuty: Książęca łaska (Mistycyzm, czyny liczą się bardziej), Związana wola (Przywracanie, klątwy o połowę słabsze) i Przebudzona więź (Zaklinanie, mocniejsze moce artefaktu).",
    "Daedric bargains are off the Coming next list: they're in the game now.": "Daedryczne układy zniknęły z listy „Wkrótce”: są już w grze.",
  };
  for (const [k, v] of Object.entries(TPL)) if (!k.includes("{")) words[k] = words[k] || v;
  if (typeof I18N_STORY !== "undefined" && I18N_STORY.ex) for (const [k, v] of Object.entries(words)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  return { tpl: TPL, words };
})();
