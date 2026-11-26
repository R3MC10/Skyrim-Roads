/* i18n_trading.js: Polish for the live trade window (tradewin.js), the market board and parcels (mktboard.js, market.js),
   the texts around them that changed, and patch note b360. Loaded before i18n.js; exact lines go in I18N_EXTRA.words,
   lines with names or numbers in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    // ---- the trade window
    "Pick someone to trade with.": "Wybierz, z kim chcesz się wymienić.",
    "Finish the trade you're in first.": "Najpierw dokończ wymianę, którą już prowadzisz.",
    "Your last trade is still settling. Wait for the other player to come back.": "Twoja poprzednia wymiana jeszcze się rozlicza. Poczekaj, aż drugi gracz wróci.",
    "That trade invite is gone.": "To zaproszenie do wymiany już zniknęło.",
    "That trade invite ran out.": "To zaproszenie do wymiany wygasło.",
    "You've confirmed. Wait for the other side, or for them to change their offer.": "Potwierdziłeś. Poczekaj na drugą stronę albo aż zmieni swoją ofertę.",
    "The trade window is closed.": "Okno wymiany jest zamknięte.",
    "That's bound to you. It can't be traded.": "To jest z tobą związane. Nie da się tego wymienić.",
    "That's not in your offer.": "Tego nie ma w twojej ofercie.",
    "Waiting for the other player.": "Czekasz na drugiego gracza.",
    "Press Ready first.": "Najpierw naciśnij Gotowe.",
    "Wait until they're Ready too.": "Poczekaj, aż oni też będą gotowi.",
    "They changed their offer. Look again.": "Zmienili swoją ofertę. Spójrz jeszcze raz.",
    "Something in their offer can't be traded.": "Czegoś z ich oferty nie da się wymienić.",
    "The trade was called off. Your things are back in your pack.": "Wymiana została odwołana. Twoje rzeczy wróciły do plecaka.",
    "No trade.": "Brak wymiany.",
    "You've confirmed, so the trade may already be going through. Wait for the other side to finish or change their offer.":
      "Potwierdziłeś, więc wymiana może już trwać. Poczekaj, aż druga strona ją dokończy albo zmieni ofertę.",
    "You called off the trade. Your things are back in your pack.": "Odwołałeś wymianę. Twoje rzeczy wróciły do plecaka.",
    "You get nothing back. That makes it a gift.": "Nic nie dostajesz w zamian. To będzie prezent.",
    "Face to face: you both put things in, check, and confirm": "Twarzą w twarz: oboje dokładacie rzeczy, sprawdzacie i potwierdzacie",
    "Confirmed": "Potwierdzone", "Ready": "Gotowe", "Away": "Nieobecny", "Choosing": "Wybiera",
    "Nothing yet. Add things from your pack.": "Jeszcze nic. Dodaj rzeczy z plecaka.", "Nothing yet.": "Jeszcze nic.",
    "Set": "Ustaw", "Your pack": "Twój plecak", "Done": "Gotowe", "All": "Wszystko", "stolen": "kradzione",
    "Nothing you can trade here. Worn gear has to come off first; bound things can't be traded.":
      "Nie masz tu nic do wymiany. Noszony ekwipunek trzeba najpierw zdjąć; rzeczy związanych z tobą nie da się wymienić.",
    "Hide": "Ukryj", "Cancel": "Anuluj", "Close": "Zamknij", "Confirm trade": "Potwierdź wymianę", "Waiting for them…": "Czekasz na nich…",
    "You give": "Ty dajesz", "＋ Add from your pack": "＋ Dodaj z plecaka",
    "Both press Ready, check both sides, then both Confirm. Any change un-readies you both. Enter = Ready/Confirm, Esc = Cancel.":
      "Oboje naciskacie Gotowe, sprawdzacie obie strony, a potem oboje Potwierdzacie. Każda zmiana cofa gotowość obojga. Enter = Gotowe/Potwierdź, Esc = Anuluj.",
    "Trade": "Wymiana",
    // ---- the market board and parcels
    "Here": "Tutaj", "Market board": "Tablica targowa", "Parcels": "Paczki", "Market parcels": "Paczki z targu",
    "What you buy on the market board waits here, so a full pack never loses a thing. Open it in any town with a market.":
      "To, co kupisz na tablicy targowej, czeka tutaj, więc pełny plecak niczego nie gubi. Otwórz je w dowolnym mieście z targiem.",
    "Take everything into your pack": "Weź wszystko do plecaka",
    "Empty. Buy something on the market board and it comes here.": "Pusto. Kup coś na tablicy targowej, a trafi tutaj.",
    "Search by name or town": "Szukaj po nazwie albo mieście",
    "Everything": "Wszystko", "Weapons": "Broń", "Armour": "Pancerz", "Jewellery": "Biżuteria", "Magic": "Magia", "Potions": "Mikstury", "Materials": "Materiały", "Other": "Inne",
    "Any rarity": "Dowolna rzadkość", "Newest": "Najnowsze", "Cheapest": "Najtańsze", "Dearest": "Najdroższe",
    "Nothing matches. Try fewer filters.": "Nic nie pasuje. Spróbuj mniej filtrów.",
    "No one has anything on a stall right now.": "Nikt nie ma teraz nic na straganie.",
    "Your parcels box is empty.": "Twoja skrzynka z paczkami jest pusta.",
    "Parcels wait at the market. Open them in a town with a market.": "Paczki czekają na targu. Otwórz je w mieście, w którym jest targ.",
    "Players sell their own things here. Buy, browse every town on the Market board, or run your own stall if you own a house in this town.":
      "Tu gracze sprzedają swoje rzeczy. Kupuj, przeglądaj każde miasto na tablicy targowej albo prowadź własny stragan, jeśli masz dom w tym mieście.",
    // ---- texts that now mention face-to-face trades
    "Add players as friends, send them messages, and trade face to face or by courier from anywhere.":
      "Dodawaj graczy do przyjaciół, wysyłaj im wiadomości i wymieniaj się twarzą w twarz albo przez kuriera z dowolnego miejsca.",
    // ---- patch note b360
    "Trade face to face, and one market board for every town": "Wymiana twarzą w twarz i jedna tablica targowa dla każdego miasta",
    "Standing in the same place as another player? Tap Trade (in Travellers, your party list or a friend's row) and, once they say yes, a trade window opens for you both.":
      "Stoisz w tym samym miejscu co inny gracz? Stuknij Wymiana (w Podróżnych, na liście drużyny albo przy przyjacielu), a gdy się zgodzi, otworzy się okno wymiany dla was obojga.",
    "You both put in things and gold, press Ready, check what the other side offers, then both press Confirm and the swap happens at once. Any change un-readies you both, and you'll see a clear warning if they change their offer.":
      "Oboje dokładacie rzeczy i złoto, naciskacie Gotowe, sprawdzacie, co daje druga strona, a potem oboje naciskacie Potwierdź i wymiana dzieje się od razu. Każda zmiana cofa gotowość obojga, a jeśli zmienią ofertę, zobaczysz wyraźne ostrzeżenie.",
    "Every thing shows its real icon, rarity colour, forge level, stats and how many, and the window warns you when you'd get nothing back or a lot less than you give.":
      "Każda rzecz pokazuje prawdziwą ikonę, kolor rzadkości, poziom z kuźni, statystyki i ilość, a okno ostrzega, gdy nic nie dostaniesz w zamian albo dużo mniej, niż dajesz.",
    "What you offer is held safely until the trade ends: you can't wear, sell or craft it meanwhile. Worn gear has to come off first, and bound things can't be traded. If someone drops out before confirming, everything goes back after 30 seconds.":
      "To, co oferujesz, jest bezpiecznie trzymane do końca wymiany: nie możesz tego w tym czasie nosić, sprzedać ani przerobić. Noszony ekwipunek trzeba najpierw zdjąć, a rzeczy związanych z tobą nie da się wymienić. Jeśli ktoś wypadnie przed potwierdzeniem, wszystko wraca po 30 sekundach.",
    "The Market stalls have a new Market board: every player stall in every town in one list, with search, type and rarity filters and sort by price or newest. Buy from any town; what you buy waits in your Market parcels, which you open in any town with a market.":
      "Stragany mają nową tablicę targową: każdy stragan graczy z każdego miasta na jednej liście, z wyszukiwaniem, filtrami typu i rzadkości i sortowaniem po cenie albo od najnowszych. Kupuj z dowolnego miasta; to, co kupisz, czeka w twoich paczkach z targu, które otwierasz w dowolnym mieście z targiem.",
    "Sellers still get their gold the same way, less the market's 5%. Courier offers to friends far away work as before.":
      "Sprzedający dalej dostają złoto tak samo, minus 5% dla targu. Oferty przez kuriera dla dalekich przyjaciół działają jak dotąd.",
  });
  I18N_EXTRA.pat.push(
    [/^You ask (.+) to trade\. The window opens when they say yes\.$/, (m) => `Prosisz o wymianę: ${m[1]}. Okno otworzy się, gdy się zgodzi.`],
    [/^You open a trade with (.+)\.$/, (m) => `Zaczynasz wymianę z: ${m[1]}.`],
    [/^A trade holds up to (\d+) different things\.$/, (m) => `W wymianie mieści się do ${m[1]} różnych rzeczy.`],
    [/^Trade done with (.+)\.$/, (m) => `Wymiana z: ${m[1]} zakończona.`],
    [/^(.+) didn't answer\.$/, (m) => `${m[1]}: brak odpowiedzi.`],
    [/^(.+) went away\. The trade is off and your things are back in your pack\.$/, (m) => `${m[1]} odszedł. Wymiana odwołana, twoje rzeczy wróciły do plecaka.`],
    [/^(.+) never came back to finish the trade, so your things are back in your pack\.$/, (m) => `${m[1]} nie wrócił, żeby dokończyć wymianę, więc twoje rzeczy wróciły do plecaka.`],
    [/^(.+) doesn't want to trade right now\.$/, (m) => `${m[1]} nie chce się teraz wymieniać.`],
    [/^(.+) called off the trade\. Your things are back in your pack\.$/, (m) => `${m[1]} odwołał wymianę. Twoje rzeczy wróciły do plecaka.`],
    [/^You give about (\d+) gold more in value than you get\.$/, (m) => `Dajesz rzeczy warte około ${m[1]} złota więcej, niż dostajesz.`],
    [/^They give about (\d+) gold more in value than you do\.$/, (m) => `Oni dają rzeczy warte około ${m[1]} złota więcej niż ty.`],
    [/^(.+) changed their offer\. Look again before you confirm\.$/, (m) => `${m[1]} zmienił ofertę. Spójrz jeszcze raz, zanim potwierdzisz.`],
    [/^(.+) changed their offer\. Check it again\.$/, (m) => `${m[1]} zmienił ofertę. Sprawdź ją jeszcze raz.`],
    [/^You turn down (.+)'s trade\.$/, (m) => `Odrzucasz wymianę: ${m[1]}.`],
    [/^You have to be in the same place as (.+) to trade face to face\.$/, (m) => `Żeby wymienić się twarzą w twarz, musisz być w tym samym miejscu co ${m[1]}.`],
    [/^(.+) wants to trade with you$/, (m) => `${m[1]} chce się z tobą wymienić`],
    [/^Trading with (.+)$/, (m) => `Wymiana z: ${m[1]}`],
    [/^(.+) gives$/, (m) => `${m[1]} daje`],
    [/^You confirmed\. Waiting for (.+)…$/, (m) => `Potwierdziłeś. Czekasz na: ${m[1]}…`],
    [/^(.+) went quiet\. You've confirmed, so your things stay safely held: the trade finishes or is called off when they're back\.$/,
      (m) => `${m[1]} ucichł. Potwierdziłeś, więc twoje rzeczy są bezpiecznie trzymane: wymiana skończy się albo zostanie odwołana, gdy wróci.`],
    [/^forged \+(\d)$/, (m) => `z kuźni +${m[1]}`],
    [/^worth (\d+)$/, (m) => `warte ${m[1]}`],
    [/^Gold$/, () => "Złoto"],
    // market board
    [/^Every player stall in every town\. Buy from anywhere: it waits in your Parcels\. The seller gets the gold, less the market's (\d+)%\.$/,
      (m) => `Każdy stragan graczy w każdym mieście. Kupuj skądkolwiek: zakup czeka w twoich paczkach. Sprzedający dostaje złoto, minus ${m[1]}% dla targu.`],
    [/^(.+) · (.+?)( \(here\))?( · last sold for ~(\d+)( each)?)?$/, (m) => (m[3] || m[4] ? `${m[1]} · ${m[2]}${m[3] ? " (tutaj)" : ""}${m[4] ? ` · ostatnio sprzedane za ~${m[5]}${m[6] ? " za sztukę" : ""}` : ""}` : null)],
    [/^from (.+) in (.+) · (\d+) gold$/, (m) => `od: ${m[1]}, ${m[2]} · ${m[3]} złota`],
    [/^Show more \((\d+) left\)$/, (m) => `Pokaż więcej (zostało ${m[1]})`],
    [/^You buy (.+) from (.+) in (.+) for (\d+) gold\. It waits in your Market parcels, in any town with a market\.$/,
      (m) => `Kupujesz ${m[1]} od: ${m[2]} (${m[3]}) za ${m[4]} złota. Czeka w twoich paczkach z targu, w każdym mieście z targiem.`],
    [/^You open (\d+) parcels?: (.+)\.$/, (m) => `Otwierasz paczki (${m[1]}): ${m[2]}.`],
    // help and tips that now mention face-to-face trades and the board
    [/^Tap (.*) at the top\. Add other players, send private messages, and trade: face to face in a trade window when you're in the same place, by courier from anywhere\.$/,
      (m) => `Stuknij ${m[1]} na górze. Dodawaj innych graczy, wysyłaj prywatne wiadomości i wymieniaj się: twarzą w twarz w oknie wymiany, gdy jesteście w tym samym miejscu, albo przez kuriera z dowolnego miejsca.`],
    [/^Every city has a house for sale \(Area → Buy …\)\. Your chest keeps things safe when you die, and you can run a (.*) market stall in that town\. The Market board shows every town's stalls\.$/,
      (m) => `W każdym mieście jest dom na sprzedaż (Okolica → Kup …). Twoja skrzynia chroni rzeczy, gdy zginiesz, i możesz prowadzić ${m[1]} stragan w tym mieście. Tablica targowa pokazuje stragany z każdego miasta.`],
    [/^To send an offer, tap (.*) Trade next to a friend\. If you're in the same place, a trade window opens for you both; if not, a courier carries your offer \(about an hour of game time\)\. What you offer leaves your pack at once and comes back if they say no\.$/,
      (m) => `Żeby wysłać ofertę, stuknij ${m[1]} Wymiana przy przyjacielu. Jeśli jesteście w tym samym miejscu, otworzy się okno wymiany dla was obojga; jeśli nie, ofertę zaniesie kurier (około godziny czasu gry). To, co oferujesz, od razu opuszcza plecak i wraca, jeśli odmówią.`],
  );
})();
