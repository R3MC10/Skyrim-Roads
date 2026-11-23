/* Respec: pay 10,000 gold to take back every perk and every Health/Magicka/Stamina level-up choice. [OURS]
   Remigiusz: "There should be a respec option for 10000 gold it returns all your perks and attribute points. Back to the pool."
   - Perks: all ranks cleared, so every point earned by levelling is free to spend again.
   - Attributes: each +10 you put in Health, Magicka or Stamina comes back as a level-up to choose again.
   - Skills, level, spells, shouts and stones are untouched. Two taps (ask, then confirm) so nobody does it by accident. */
const RESPEC = (() => {
  const COST = 10000, LABEL = "10,000";
  const per = () => (typeof F !== "undefined" && F.ATTRIBUTE_PER_LEVEL) || 10;
  const perkCount = (s) => Object.values(s.perks || {}).reduce((a, b) => a + b, 0);
  const attrCount = (s) => Math.floor(((s.hpBonus || 0) + (s.mpBonus || 0) + (s.spBonus || 0)) / per());
  const worth = (s) => perkCount(s) + attrCount(s) > 0;
  function can(s) {
    if (!worth(s)) return "Nothing to take back yet.";
    if ((s.gold || 0) < COST) return `You need ${LABEL} gold.`;
    return null;
  }
  function run(s) {
    const err = can(s); if (err) return err;
    const p = perkCount(s), a = attrCount(s);
    s.gold -= COST;
    s.perks = {};
    s.pendingLevels = (s.pendingLevels || 0) + a;
    s.hpBonus = 0; s.mpBonus = 0; s.spBonus = 0;
    if (typeof G !== "undefined" && G.maxHealth && s.health > G.maxHealth(s)) s.health = G.maxHealth(s);
    s.respecs = (s.respecs || 0) + 1;
    return `Respec done: ${p} perk point${p === 1 ? "" : "s"} and ${a} level-up choice${a === 1 ? "" : "s"} are back to spend.`;
  }
  let armed = false;
  const arm = (on) => { armed = !!on; };
  function panel(s) {
    if (!worth(s)) return "";
    const err = can(s), p = perkCount(s), a = attrCount(s);
    const body = armed && !err
      ? `<p class="sub" style="color:var(--ember)">Sure? This takes back ${p} perk point${p === 1 ? "" : "s"} and ${a} level-up choice${a === 1 ? "" : "s"} for ${LABEL} gold.</p>
         <div class="grid2"><button class="btn" data-act="respecgo">Yes, respec</button><button class="btn ghost" data-act="respec" data-a="off">Keep my build</button></div>`
      : `<p class="sub">Start your build over: every perk and every Health/Magicka/Stamina choice goes back to the pool. Skills and level stay. Costs <b>${LABEL}</b> gold.</p>
         <button class="btn" data-act="respec"${err ? ` disabled title="${err}"` : ""}>Respec · ${LABEL} gold</button>${err ? `<p class="sub">${err}</p>` : ""}`;
    return `<div class="panel respec"><h3>Respec</h3>${body}</div>`;
  }
  return { COST, can, run, arm, panel, perkCount, attrCount };
})();
if (typeof module !== "undefined") module.exports = RESPEC;
