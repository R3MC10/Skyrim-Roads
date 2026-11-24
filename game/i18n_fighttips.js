/* i18n_fighttips.js: Polish for fighttips.js (tooltips on the fight screen) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Action points": "Punkty akcji",
    "Moves": "Ruchy", "Made": "Wykonane", "Moves made": "Wykonane ruchy", "Moves a turn": "Ruchów na turę", "Costs": "Kosztuje", "free": "za darmo",
    "Make up to 4 moves a turn. Blows and guards cost stamina, spells magicka: the coloured numbers on each button.": "Wykonaj do 4 ruchów na turę. Ciosy i garda kosztują wytrzymałość, czary magię: kolorowe liczby na każdym przycisku.",
    "The same move again in one turn costs 50% more. Moves you don't make become guard when you end your turn (up to 30% less damage).": "Ten sam ruch drugi raz w jednej turze kosztuje 50% więcej. Ruchy, których nie wykonasz, zamieniają się w gardę, gdy kończysz turę (do 30% mniej obrażeń).",
    "Stamina and magicka come back a bit every round.": "Wytrzymałość i magia wracają trochę co rundę.",
    "Every move costs AP: the gold pips on its button.": "Każdy ruch kosztuje AP: złote kropki na jego przycisku.",
    "Blue ✦ spell AP pays for spells and scrolls first.": "Niebieskie ✦ AP na czary płacą najpierw za czary i zwoje.",
    "AP you don't use becomes guard when you end your turn (up to 30% less damage).": "Niewykorzystane AP zamieniają się w gardę, gdy kończysz turę (do 30% mniej obrażeń).",
    "You get them all back next round.": "W następnej rundzie dostajesz je wszystkie z powrotem.",
    "At zero you're knocked out and the fight is lost. Healing spells and health potions bring it back.": "Przy zerze padasz i walka jest przegrana. Czary leczące i mikstury zdrowia je przywracają.",
    "Spells cost magicka. It fills up again after the fight; magicka potions help in it.": "Czary kosztują magię. Wraca po walce; w walce pomagają mikstury magii.",
    "Power attacks, guarding and shield bashes cost stamina.": "Silne ataki, garda i uderzenia tarczą kosztują wytrzymałość.",
    "Drop healing spells and potions here to use them on yourself.": "Upuść tu czar leczący albo miksturę, żeby użyć ich na sobie.",
    "Drag attacks and spells here.": "Przeciągnij tu ataki i czary.",
    "Tap it, or drag it onto the foe.": "Stuknij albo przeciągnij na wroga.",
    "Tap it, or drag it onto yourself or a teammate.": "Stuknij albo przeciągnij na siebie lub towarzysza.",
    "Tap it, or drag it onto a teammate.": "Stuknij albo przeciągnij na towarzysza.",
    "The best one you carry is used first.": "Najpierw idzie najlepsza, jaką masz.",
    "Reading it uses the scroll up.": "Odczytanie zużywa zwój.",
    "Potions and scrolls: drink or read one, or ★ it to pin it to the quick slots.": "Mikstury i zwoje: wypij albo odczytaj, albo przypnij ★ do szybkich miejsc.",
    "Back to your moves.": "Powrót do ruchów.",
    "Show all your spells.": "Pokaż wszystkie czary.",
    "Show only the spells you pinned with ★.": "Pokaż tylko czary przypięte ★.",
    "The last things that happened. Tap to read the whole fight.": "Ostatnie wydarzenia. Stuknij, żeby przeczytać całą walkę.",
    "You can't use this right now": "Teraz nie możesz tego użyć",
    "Spell AP ✦": "AP na czary ✦", "Left": "Zostało", "You have": "Masz", "Cheapest spell": "Najtańszy czar",
    "Power attack": "Silny atak", "Guard": "Garda", "Blows weaker": "Ciosy słabsze", "Shield block": "Blok tarczą", "AP a turn": "AP na turę",
    "Spell AP": "AP na czary", "Initiative": "Inicjatywa", "Hits for": "Bije za", "AP left": "Zostało AP", "Magic": "Magia", "Items": "Przedmioty",
    "Back": "Wróć", "Key: M": "Klawisz: M", "Key: I": "Klawisz: I", "Key: Esc": "Klawisz: Esc", "Tough foe": "Twardy wróg", "Boss": "Boss", "Foe": "Wróg",
    "In a fight": "W walce",
    "A cooking ingredient: cook it at an inn's pot or your campfire.": "Składnik do gotowania: ugotuj go w kotle w karczmie albo przy ognisku.",
    "Lets you fish where there's water nearby.": "Pozwala łowić ryby, gdy w pobliżu jest woda.",
    "Someone wants this back: it stays with you until you hand it in.": "Ktoś chce to odzyskać: zostaje przy tobie, dopóki tego nie oddasz.",
    "Proof of a great deed: keep it, or sell it to a merchant.": "Dowód wielkiego czynu: zatrzymaj albo sprzedaj kupcowi.",
    "Every item's tooltip now says what it does, in fights and out of them: what a scroll or potion really does for you, how hard a weapon hits with your skill and perks, its AP cost in a fight, what food cooks into, and its value and weight. Favourite slots show the full tooltip, not just the name.":
      "Podpowiedź każdego przedmiotu mówi teraz, co robi, w walce i poza nią: co naprawdę daje ci zwój albo mikstura, jak mocno bije broń przy twojej umiejętności i atutach, ile kosztuje AP w walce, co można z jedzenia ugotować, ile jest warte i ile waży. Ulubione miejsca pokazują pełną podpowiedź, nie samą nazwę.",
    // patch note
    "Tooltips in fights": "Podpowiedzi w walce",
    "Everything on the fight screen now has a tooltip, the same kind as in the menus: rest the mouse on it, or hold a finger on it. Spells show what they do with your perks, single and dual cast, magicka, AP and how long they last; potions, scrolls, the big buttons, quick slots, the AP pips, your bars, you, the foe and every status chip explain themselves too.":
      "Wszystko na ekranie walki ma teraz podpowiedź, taką samą jak w menu: przytrzymaj nad tym myszkę albo palec. Czary pokazują, co robią z twoimi atutami, zwykłe i oburęczne, magię, AP i ile trwają; mikstury, zwoje, duże przyciski, szybkie miejsca, kropki AP, twoje paski, ty, wróg i każdy znaczek stanu też się tłumaczą.",
    "A greyed-out button says why with the numbers, like \"Need 37 more magicka: you have 98, it needs 135\".":
      "Wyszarzony przycisk mówi dlaczego, z liczbami, np. „Brakuje 37 magii: masz 98, potrzeba 135”.",
    "Holding a finger on a button only shows its tooltip: nothing gets cast. Dragging a card onto a target works as before.":
      "Przytrzymanie palca na przycisku tylko pokazuje podpowiedź: nic się nie rzuca. Przeciąganie karty na cel działa jak dawniej.",
    "Foes that are afraid, calmed or still rattled show it with a chip under their health.":
      "Wrogowie przestraszeni, uspokojeni albo wciąż roztrzęsieni mają znaczek pod paskiem zdrowia.",
  });
  I18N_EXTRA.pat.push(
    [/^Need (\d+) more magicka: you have (\d+), it needs (\d+)$/, (m) => `Brakuje ${m[1]} magii: masz ${m[2]}, potrzeba ${m[3]}`],
    [/^Need (\d+) more stamina: you have (\d+), it needs (\d+)$/, (m) => `Brakuje ${m[1]} wytrzymałości: masz ${m[2]}, potrzeba ${m[3]}`],
    [/^⚠ Need (\d+) more stamina: you have (\d+), it needs (\d+)$/, (m) => `⚠ Brakuje ${m[1]} wytrzymałości: masz ${m[2]}, potrzeba ${m[3]}`],
    [/^(\d+) stamina \(×(\d+) this turn\)$/, (m) => `${m[1]} wytrzymałości (×${m[2]} w tej turze)`],
    [/^(\d+) magicka \(×(\d+) this turn\)$/, (m) => `${m[1]} magii (×${m[2]} w tej turze)`],
    [/^Need (\d+) more AP: you have (\d+) left, it costs (\d+)$/, (m) => `Brakuje ${m[1]} AP: zostało ci ${m[2]}, kosztuje ${m[3]}`],
    [/^⚠ Need (\d+) more magicka: you have (\d+), it needs (\d+)$/, (m) => `⚠ Brakuje ${m[1]} magii: masz ${m[2]}, potrzeba ${m[3]}`],
    [/^⚠ Need (\d+) more AP: you have (\d+) left, it costs (\d+)$/, (m) => `⚠ Brakuje ${m[1]} AP: zostało ci ${m[2]}, kosztuje ${m[3]}`],
    [/^Both hands: ([\d.]+)× the effect for more magicka\.$/, (m) => `Obie ręce: ${m[1]}× mocniej za więcej magii.`],
    [/^Afraid: it cowers and won't fight for (\d+) more turns?\.$/, (m) => `Przestraszony: kuli się i nie walczy jeszcze przez ${m[1]} tur.`],
    [/^Calmed: it stops fighting for (\d+) more turns?\.$/, (m) => `Uspokojony: nie walczy jeszcze przez ${m[1]} tur.`],
    [/^Rattled: still shaken, its blows land 20% softer for (\d+) more turns?\.$/, (m) => `Roztrzęsiony: jego ciosy są o 20% słabsze jeszcze przez ${m[1]} tur.`],
    [/^Show only (\w+) spells\.$/, (m) => `Pokaż tylko czary: ${m[1]}.`],
    [/^Your (\d+) fighting spells?: cast one, or ★ it to pin it to the quick slots\.$/, (m) => `Twoje czary bojowe (${m[1]}): rzuć albo przypnij ★ do szybkich miejsc.`],
    [/^(.+) \(dual cast\)$/, (m) => `${m[1]} (oburęcznie)`],
    // item tooltips (tooltip.js): what a thing does
    [/^Hits for about (\d+) with your (.+) skill and perks$/, (m) => `Bije za około ${m[1]} przy twojej umiejętności (${m[2]}) i atutach`],
    [/^(\d+) base damage, more as your (.+) skill grows$/, (m) => `${m[1]} bazowych obrażeń, więcej z rozwojem umiejętności (${m[2]})`],
    [/^Shot from a bow: (\d+) damage added to each shot$/, (m) => `Strzelasz z łuku: +${m[1]} obrażeń do każdego strzału`],
    [/^Shot from a crossbow: (\d+) damage added to each shot$/, (m) => `Strzelasz z kuszy: +${m[1]} obrażeń do każdego strzału`],
    [/^Worth about (\d+) gold to any merchant\.$/, (m) => `Każdy kupiec da za to około ${m[1]} sztuk złota.`],
    [/^No use in a fight\. A merchant pays about (\d+) gold for it\.$/, (m) => `Bez użytku w walce. Kupiec zapłaci około ${m[1]} sztuk złota.`],
    [/^(\d) AP$/, (m) => `${m[1]} AP`],
    [/^For you: (.+) · no magicka$/, (m) => `Dla ciebie: ${m[1]} · bez magii`],
    [/^Cook it into: (.+)$/, (m) => `Ugotuj z tego: ${m[1]}`],
  );
})();
