/* MOUNTCOMBAT: the switch for fighting from the saddle (horseback.js + mountfight.js). [OURS]
   OFF for now: every fight is on foot, solo, party and co-op alike. Your horse waits at the edge of the fight, nobody
   goes for it, it is never knocked down in a fight and it is not in the fight picture. If you were riding you are back
   in the saddle afterwards (the fight never touches s.horse.mounted).
   Turning it on (MOUNTCOMBAT.enabled = true) brings back the whole mounted system: the charge, Mount / Dismount moves,
   the horse's health bar, teammates' horses. Callers check (typeof MOUNTCOMBAT === "undefined" || MOUNTCOMBAT.enabled),
   so node tests that don't load this file keep testing the mounted system as if it were on. */
const MOUNTCOMBAT = {
  enabled: true,   // on for everyone since build 237 (user decision 25 Nov 2026); set false to send everyone back to fighting on foot
  /* the encounter card's line about your horse while mounted combat is off */
  note(s) {
    if (typeof HORSES === "undefined" || !s || !HORSES.present(s)) return "";
    const n = s.horse.name;
    if (HORSES.downed(s)) return `<p class="sub mountnote hdown"> ${n} is downed and limps behind you. You fight on foot.</p>`;
    return `<p class="sub mountnote"> ${n} waits at the edge of the fight. You fight on foot.</p>`;
  },
};
if (typeof module !== "undefined") module.exports = MOUNTCOMBAT;
