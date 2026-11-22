/* Sneak mode on the road, and fog of war for other heroes. [OURS]
   - Sneak (toggle on the map): you walk slower, fewer bandits and beasts find you, fights start with you hidden
     more often, and you train Sneak while you move.
   - Fog of war: you only see other heroes within your sight range (party members always).
     A sneaking hero is spotted only from much closer: the better their Sneak, the closer you must be.
   Perks (perkfx.js): Silent Roads (faster sneaking, harder to spot), Shadow Paths (fewer encounters while sneaking). */
const SNEAKMODE = (() => {
  const SIGHT_PX = 150;        // how far you see other heroes on the map
  const MIN_SEEN_PX = 22;      // closer than this nobody stays hidden
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const on = (s) => !!s?.sneak;
  /* travel speed while sneaking: 55% at Sneak 15, up to 75% at 100; Silent Roads +15% */
  const speedMult = (s) => (on(s) ? Math.min(0.92, 0.5 + Math.min(100, G.skill(s, "Sneak")) / 400 + pfx(s, "sneakmove")) : 1);
  /* road encounters while sneaking: about half, fewer with skill; Shadow Paths halves what's left */
  const encounterMult = (s) => (on(s) ? Math.max(0.15, 0.55 - Math.min(100, G.skill(s, "Sneak")) / 400) * (1 - Math.min(0.6, pfx(s, "sneakenc"))) : 1);
  /* fights that find you while sneaking: better odds to start hidden */
  const hideAdd = (s) => (on(s) ? 0.2 : 0);
  /* how close someone must be to see a hero (card: {sneaking, sneak}) */
  function seenWithin(card) {
    if (!card?.sneaking) return SIGHT_PX;
    const sk = Math.min(100, card.sneak || 15), shrink = Math.min(0.5, card.sneakSeen || 0);
    return Math.max(MIN_SEEN_PX, Math.round(SIGHT_PX * (0.5 - sk / 250) * (1 - shrink)));
  }
  /* my own "spotted from" ring, for the map */
  const myRange = (s) => seenWithin({ sneaking: on(s), sneak: G.skill(s, "Sneak"), sneakSeen: pfx(s, "sneakseen") });
  /* can I see this hero? party members always; same town/dungeon counts as close */
  function canSee(myPos, card, theirPos, { party = false } = {}) {
    if (party) return true;
    return G.pxDist(myPos, theirPos) <= seenWithin(card);
  }
  /* Sneak practice while moving sneakily: 0.3 XP a game minute, about one fight's worth per hour on the road */
  function train(s, seconds) {
    if (!on(s) || !(seconds > 0)) return [];
    s._sneakXp = (s._sneakXp || 0) + seconds / 60 * 0.3;
    if (s._sneakXp < 3) return [];
    const xp = s._sneakXp; s._sneakXp = 0;
    return G.useSkill(s, "Sneak", xp);
  }
  /* card fields other phones need */
  const cardBits = (s) => ({ sneaking: on(s), sneakSeen: on(s) ? Math.min(0.5, pfx(s, "sneakseen")) : 0 });
  function toggle(s) { s.sneak = !s.sneak; return s.sneak; }
  return { SIGHT_PX, MIN_SEEN_PX, on, speedMult, encounterMult, hideAdd, seenWithin, myRange, canSee, train, cardBits, toggle };
})();
if (typeof module !== "undefined") module.exports = SNEAKMODE;
