/* i18n_mountcombat.js: Polish for fights on foot while mounted combat is off (mountcombat.js) and its patch note.
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words, lines with names in I18N_EXTRA.pat. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  Object.assign(I18N_EXTRA.words, {
    "Horses wait at the edge of the fight": "Konie czekają na skraju walki",
    "Horses now wait at the edge of the fight; you always fight on foot. That goes for solo fights, parties and co-op.":
      "Konie czekają teraz na skraju walki; zawsze walczysz pieszo. Dotyczy to walk w pojedynkę, w drużynie i w kooperacji.",
    "Nobody goes for your horse and it never gets knocked down in a fight. If you rode in, you're back in the saddle when it's over.":
      "Nikt nie atakuje twojego konia i nigdy nie zostaje powalony w walce. Jeśli przyjechałeś konno, po walce znów siedzisz w siodle.",
    "Dual casting works in every fight again, since everyone is on foot.":
      "Podwójne rzucanie czarów znów działa w każdej walce, bo wszyscy są pieszo.",
  });
  I18N_EXTRA.pat.push(
    [/^ (.+) waits at the edge of the fight\. You fight on foot\.$/, (m) => ` ${m[1]} czeka na skraju walki. Walczysz pieszo.`],
  );
})();
