/* i18n_smithgame.js: Polish for the forging mini-game (smithgame.js), the Forge Sense perk and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // the screen
    "At the forge": "Przy kuźni", Heat: "Rozgrzej", Hammer: "Kuj", Quench: "Hartuj", Reheat: "Rozgrzej ponownie",
    "Hold to pump": "Przytrzymaj, by dmuchać", Strike: "Uderz", "Take it": "Zabierz",
    "Hold Pump (or the fire) to work the bellows. Keep the glow inside the gold band.":
      "Przytrzymaj przycisk (albo ogień), żeby poruszać miechem. Trzymaj żar w złotym pasie.",
    "Back in the fire. Pump until the glow sits in the gold band again.": "Z powrotem w ogień. Dmuchaj, aż żar znów wejdzie w złoty pas.",
    "Tap each glowing spot as the shrinking ring meets it. Hot metal takes the blow best.":
      "Stuknij każdy świecący punkt, gdy kurczący się krąg go dotknie. Gorący metal najlepiej przyjmuje cios.",
    "The metal is cooling. Tap Reheat before it goes dark.": "Metal stygnie. Stuknij Rozgrzej ponownie, zanim pociemnieje.",
    "The blade takes its shape. To the water!": "Ostrze nabiera kształtu. Do wody!",
    "Watch the glow cool. Tap Quench when it reaches the cherry-red band.": "Patrz, jak żar stygnie. Stuknij Hartuj, gdy dojdzie do wiśniowego pasa.",
    "Hsss…": "Sssss…", "Get the fire going…": "Rozpalasz ogień…",
    // canvas labels
    "Forging heat": "Żar do kucia", "Quench at cherry red": "Hartuj w wiśniowej czerwieni", Cold: "Zimny", "White hot": "Biały żar",
    // what you hear while you work
    "Glancing blow": "Cios po skosie", "Too cold!": "Za zimny!", "Clean strike!": "Czyste uderzenie!", "Good strike": "Dobre uderzenie",
    "Off the mark": "Obok celu", "Missed!": "Pudło!", "Too slow!": "Za wolno!", "Too cold to shape. Reheat it!": "Za zimny, by go kuć. Rozgrzej go!",
    "Back into the fire": "Z powrotem w ogień", "A perfect quench!": "Idealne hartowanie!", "Good quench": "Dobre hartowanie",
    "Too hot: it warps a little": "Za gorący: trochę się wypaczył", "Too cool: it's brittle": "Za chłodny: jest kruchy",
    // the perk
    "Forge Sense": "Wyczucie kuźni",
    "Forging mini-game: the gold heat and quench bands are 25% wider per rank, the metal cools 20% slower per rank (the rings close slower too), and great work saves material a little more often. [OURS]":
      "Minigra kucia: złote pasy żaru i hartowania są o 25% szersze na stopień, metal stygnie o 20% wolniej na stopień (kręgi też zamykają się wolniej), a świetna robota trochę częściej oszczędza materiał. [NASZE]",
    // patch note
    "A real forge for smithing": "Prawdziwa kuźnia do kowalstwa",
    "Making weapons and armor at a forge is now a small scene at a painted smithy: heat the bar, hammer it into shape, then quench it.":
      "Robienie broni i pancerzy w kuźni to teraz mała scena w malowanej kuźni: rozgrzej sztabę, wykuj ją, a potem zahartuj.",
    "Heat: hold to pump the bellows and keep the glow in the gold band. Too hot and it burns, too cold and it won't move.":
      "Rozgrzewanie: przytrzymaj, by dmuchać miechem, i trzymaj żar w złotym pasie. Za gorący się przepala, za zimny nie chce się kuć.",
    "Hammer: tap the glowing spots as the rings close on them. Sparks fly and the bar turns into a rough blade, then a shaped one. The metal cools while you work, so reheat it when the glow fades.":
      "Kucie: stukaj świecące punkty, gdy kręgi się na nich zamykają. Lecą iskry, a sztaba zmienia się w surowe ostrze, potem w gotowy kształt. Metal stygnie w trakcie, więc rozgrzej go, gdy żar przygaśnie.",
    "Quench: dip the blade in the water barrel when it cools to cherry red. Steam bursts up and you see the finished blade.":
      "Hartowanie: zanurz ostrze w beczce z wodą, gdy ostygnie do wiśniowej czerwieni. Bucha para i widzisz gotowe ostrze.",
    "Good work gives the same small, capped bonus as before (a point or two of damage or armor). Great work can also save one piece of the main material now and then. The forge still uses up everything else.":
      "Dobra robota daje ten sam mały, ograniczony bonus co wcześniej (punkt lub dwa obrażeń albo pancerza). Świetna robota czasem oszczędza też jedną sztukę głównego materiału. Kuźnia dalej zużywa całą resztę.",
    "Quick craft skips it, like the other crafting games. The Smithing contest at festivals uses the new forge too.":
      "Szybkie wytwarzanie pomija grę, jak w innych grach rzemieślniczych. Konkurs kowalski na festiwalach też używa nowej kuźni.",
    "New Smithing perk, Forge Sense: wider gold bands, slower cooling, and a better chance to save material.":
      "Nowy atut Kowalstwa, Wyczucie kuźni: szersze złote pasy, wolniejsze stygnięcie i większa szansa na oszczędzenie materiału.",
  });
  I18N_EXTRA.pat.push(
    [/^Heating… (\d+) s$/, (m) => `Rozgrzewanie… ${m[1]} s`],
    [/^Strike (\d+) of (\d+)$/, (m) => `Uderzenie ${m[1]} z ${m[2]}`],
    [/^Quality (\d+)%$/, (m) => `Jakość ${m[1]}%`],
  );
})();
