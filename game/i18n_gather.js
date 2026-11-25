/* i18n_gather.js: Polish for gathering (gather.js) and its patch notes. Loaded after i18n.js. [OURS] */
const I18N_GATHER = (() => {
  const PL = {
    "Couldn't gather that. Please try again.": "Nie udało się tego zebrać. Spróbuj jeszcze raz.",
    // patch note b228-gatherfix
    "Picking herbs fixed": "Naprawione zbieranie ziół",
    "On a PC the Gathering card sat in the side panel, which the big map hides, so there was no way to pick plants or forage. It now floats on the left of the map whenever plants are in reach.":
      "Na komputerze karta Zbieranie siedziała w bocznym panelu, który zasłania duża mapa, więc nie dało się zbierać roślin ani szukać ziół. Teraz unosi się po lewej stronie mapy, gdy rośliny są w zasięgu.",
    "Some older saves made the Gather button do nothing. Those heroes pick plants, forage and plant gardens normally again.":
      "Na niektórych starszych zapisach przycisk Zbierz nic nie robił. Ci bohaterowie znowu normalnie zbierają rośliny, szukają ziół i sadzą ogródki.",
    "If picking ever goes wrong, you now get a short message instead of a button that does nothing.":
      "Gdy zbieranie się nie uda, dostajesz krótką wiadomość zamiast przycisku, który nic nie robi.",
  };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v;
  return { PL };
})();
