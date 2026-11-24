/* i18n_noequip.js: Polish for "worn gear never changes hands" (selling, follower give, player trades, gifts, stalls).
   Loaded before i18n.js; adds to I18N_STORY.ex without overriding lines already translated. */
(() => {
  if (typeof I18N_STORY === "undefined") return;
  const PL = {
    "You're wearing that. Take it off first.": "Masz to na sobie. Najpierw to zdejmij.",
    "That offer held gear someone was wearing, so it went back to them.": "W tej ofercie było coś, co ktoś miał na sobie, więc wróciło do niego.",
    // patch note
    "What you wear stays on you": "To, co nosisz, zostaje przy tobie",
    "Shops no longer list the gear you're wearing when you sell: weapons in either hand, armour, rings and amulets stay off the Sell list, and Sell all junk never touches them.":
      "Sklepy nie pokazują już na liście sprzedaży tego, co masz na sobie: broń w obu rękach, pancerz, pierścienie i amulety nie trafiają na listę, a Sprzedaj wszystkie śmieci ich nie rusza.",
    "The same goes for handing things over: your follower's Your pack list, trades and gifts to other players, market stalls and chests leave out what you wear.":
      "Tak samo przy oddawaniu rzeczy: lista Twój plecak u towarzysza, wymiany i prezenty dla innych graczy, stragany i skrzynie pomijają to, co nosisz.",
    "Got two of the same thing and wear one? Only the spare one shows up. Take something off first if you really want to part with it.":
      "Masz dwie takie same rzeczy i nosisz jedną? Pokaże się tylko ta zapasowa. Jeśli naprawdę chcesz się czegoś pozbyć, najpierw to zdejmij.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
})();
