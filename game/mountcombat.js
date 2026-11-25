/* MOUNTCOMBAT: fights are always on foot. [OURS]
   Remigiusz (25 Nov 2026): "remove mounted combat from the game, mounts are only for travelling". The mounted system
   (horseback.js, mountfight.js) is gone; this file stays so old checks of MOUNTCOMBAT.enabled read false.
   If you're riding when a road fight starts you get down; your horse waits at the edge of the fight, nobody goes for it,
   the fight never hurts it and it's not in the fight picture. You're back in the saddle afterwards (the fight never
   touches s.horse.mounted). The old saddle perks now help on the road (horsetravel.js). */
const MOUNTCOMBAT = {
  enabled: false,   // always off: there is no mounted combat any more
  /* the encounter card's line about your horse */
  note(s) {
    if (typeof HORSES === "undefined" || !s || !HORSES.present(s)) return "";
    const n = s.horse.name;
    if (HORSES.downed(s)) return `<p class="sub mountnote hdown"> ${n} is downed and limps behind you. You fight on foot.</p>`;
    return `<p class="sub mountnote"> ${n} waits at the edge of the fight. You fight on foot.</p>`;
  },
};
if (typeof module !== "undefined") module.exports = MOUNTCOMBAT;
