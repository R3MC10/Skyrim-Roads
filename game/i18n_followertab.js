/* i18n_followertab.js: Polish for the Follower tab (followertab.js): the SkyUI-style gear list, the details box,
   the "where to find one" page and the one-line summary on the Character page. Loaded after i18n_menus2.js and
   before i18n.js; adds to I18N_STORY.ex without overriding lines already translated. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    // gear list
    "Your pack": "Twój plecak", "Their pack": "Ich plecak", "Weapons": "Broń", "Armor": "Pancerz", "Potions": "Mikstury", "Other": "Inne", "All": "Wszystko",
    "Name": "Nazwa", "Type": "Typ", "Dmg/Armor": "Obr./Pancerz", "Weight": "Waga", "Value": "Wartość",
    "1-hand": "1-ręczna", "2-hand": "2-ręczna", "Bow": "Łuk", "Staff": "Kostur", "Arrow": "Strzała", "Bolt": "Bełt", "Potion": "Mikstura", "Poison": "Trucizna",
    "Right hand": "Prawa ręka", "Left hand": "Lewa ręka", "Shield": "Tarcza", "Head": "Głowa", "Body": "Tułów", "Hands": "Dłonie", "Feet": "Stopy", "Neck": "Szyja", "Ring": "Pierścień",
    "Worn": "Noszone", "You wear this": "Nosisz to",
    "Their load: {0}/{1} · potions they carry are drunk when they're badly hurt · archers never run out of arrows":
      "Ich obciążenie: {0}/{1} · mikstury piją, gdy są ciężko ranni · łucznikom nigdy nie kończą się strzały",
    "Nothing in your pack they could use here.": "Nie masz w plecaku nic, czego mogliby tu użyć.",
    "Their pack is empty here. Switch to Your pack to give them something.": "Tu ich plecak jest pusty. Przełącz na Twój plecak, aby coś im dać.",
    // details
    "Damage": "Obrażenia", "Restores": "Przywraca", "Weight class": "Rodzaj pancerza", "Count": "Liczba", "One": "Jedna", "Two": "Dwie",
    "Compared with {0} (worn now)": "W porównaniu z: {0} (noszone teraz)", "{0} has nothing in that slot": "{0} nie ma nic w tym miejscu", "{0} wears this now.": "{0} nosi to teraz.",
    "Give & equip": "Daj i załóż", "Take": "Weź", "Give all ({0})": "Daj wszystko ({0})", "Take all ({0})": "Weź wszystko ({0})",
    "You're wearing this. Take it off in Items first.": "Nosisz to. Najpierw zdejmij to w Przedmiotach.",
    // empty state
    "You're travelling alone for now.": "Na razie podróżujesz sam.",
    "A follower fights beside you, carries some of your things, levels up with you and picks their own perks. They never die: when a fight goes badly they're knocked down and get back up after.":
      "Towarzysz walczy u twego boku, niesie część twoich rzeczy, awansuje razem z tobą i sam wybiera atuty. Nigdy nie ginie: gdy walka idzie źle, zostaje powalony i potem wstaje.",
    "Where to find one": "Gdzie kogoś znaleźć", "Look in the inn or hall of these towns, then hire them from the Area tab.": "Zajrzyj do karczmy lub sali w tych miastach, a potem wynajmij ich w zakładce Okolica.",
    "Here in {0}:": "Tutaj, w {0}:", "Go to the inn (Area)": "Idź do karczmy (Okolica)", "Free": "Za darmo",
    "Becomes yours when you're made Thane of Whiterun (bring Farengar the Dragonstone).": "Będzie twoja, gdy zostaniesz tanem Whiterun (zanieś Farengarowi Smoczy Kamień).",
    "Join the Companions first.": "Najpierw dołącz do Towarzyszy.",
    // Character page line
    "{0}/{1} health · Follower tab ›": "{0}/{1} zdrowia · zakładka Towarzysz ›",
    "(Hero → Follower → Bond) to finish it.": "(Bohater → Towarzysz → Więź), aby to zakończyć.",
    "{0}: done. Talk to {1} (Hero → Follower → Bond) to finish it.": "{0}: zrobione. Porozmawiaj z towarzyszem ({1}: Bohater → Towarzysz → Więź), aby to zakończyć.",
    // patch note
    "Your follower gets their own tab": "Twój towarzysz ma własną zakładkę",
    "Your follower now has their own Follower tab in the Character menu, next to Skills, Character and Perks. Everything about them lives there: overview, bond, gear, magic, tactics, perks, fighting style and Dismiss.":
      "Twój towarzysz ma teraz własną zakładkę Towarzysz w menu Postaci, obok Umiejętności, Postaci i Atutów. Wszystko o nim jest tam: przegląd, więź, ekwipunek, magia, taktyka, atuty, styl walki i Odpraw.",
    "The Character page only keeps one short line about them; tap it to jump to the tab. With nobody following you, the tab tells you who you can hire and where.":
      "Na stronie Postaci zostaje tylko jedna krótka linijka; dotknij jej, aby przejść do zakładki. Gdy nikt z tobą nie idzie, zakładka mówi, kogo i gdzie możesz wynająć.",
    "Their gear works like your Items menu: their pack or yours, filters (All, Weapons, Armor, Potions, Other), a list you can sort by name, type, damage or armour, weight and value, and a ◆ on what they wear.":
      "Ich ekwipunek działa jak twoje menu Przedmiotów: ich plecak albo twój, filtry (Wszystko, Broń, Pancerz, Mikstury, Inne), lista sortowana po nazwie, typie, obrażeniach lub pancerzu, wadze i wartości, oraz ◆ przy tym, co noszą.",
    "Tap an item to see its stats and how it compares with what they wear now, then Give, Give & equip, Equip, Take off or Take it back.":
      "Dotknij przedmiotu, aby zobaczyć jego cechy i porównanie z tym, co noszą teraz, a potem Daj, Daj i załóż, Załóż, Zdejmij lub Weź z powrotem.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
})();
