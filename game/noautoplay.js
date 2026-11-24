/* No auto-play [OURS module]. Remigiusz: "for some reason characters attack automatically at some event, fix that."
   Your character only ever acts when you pick the move (or when you press Auto yourself). Two helpers:
   - NOAUTO.call(fn, done): run a game action that may start a fight. In the app the fight opens on the turn-by-turn
     screen (ui.js tbCall -> TB.call) instead of being played out by the AI in one go. Used by world events, great
     world events, rumours and whispers, which used to run their fights instantly.
   - NOAUTO.carried(fn): a party member's phone replays the leader's dungeon choice. That fight was already played on
     the shared fight screen (sharedfight.js), so it isn't fought a second time by the AI: it ends as the party won it,
     with no blows, potions or skill practice on your side (those came from the shared fight). */
const NOAUTO = (() => {
  const ui = () => (typeof window !== "undefined" ? window.__ui : null);
  function call(fn, done) {
    const u = ui();
    if (u && typeof u.tbCall === "function") return u.tbCall(fn, done);
    return done(fn());
  }
  function carried(fn) {
    const proto = G.Fight.prototype, run0 = proto.run;
    proto.run = function () {
      this.won = true; this.ehp = 0; this.carried = true;
      this.log = this.log || [];
      this.log.push({ turn: 1, rule: null, me: "Your party wins the fight together", them: "", hp: Math.max(0, Math.round(this.hp)), ehp: 0 });
      return true;
    };
    try { return fn(); } finally { proto.run = run0; }
  }
  return { call, carried };
})();
