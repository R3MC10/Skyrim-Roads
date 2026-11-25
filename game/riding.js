/* RIDING: getting on and off your horse on the world map. [OURS]
   A round button with the map's zoom / centre / hunt / sneak buttons: tap it to swing up into the saddle or to get
   down and walk beside your horse. The hero on the map plays the move (maphero.js): the horse walks up and you climb
   on, or you slide down and it steps back and follows you. On foot your horse walks just behind you (RIDING.led).
   The button only shows when your horse is with you and can carry you: not downed, not on a carriage or a boat, not in
   a dungeon. In a party each player rides their own horse; the leader still picks the road.
   API: RIDING.button(S) → the button's HTML ("" when there is nothing to ride)
        RIDING.bind(el, getS, after) → wires the button; after(message) runs once the horse state changed
        RIDING.sync(S) → refresh the button (after the trip panel's Ride / Walk, a horse knocked down, ...)
        RIDING.can(S) → true when you can get on or off right now
        RIDING.led(S) → the coat colour of the horse walking beside you on foot, or null */
const RIDING = (() => {
  const H = () => (typeof HORSES !== "undefined" ? HORSES : null);
  const L = (s) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(s) : s);
  const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21"><path d="M7 21v-4.2c0-2 .9-3.4 2.4-4.6L7.6 9.4C6.5 7.7 7 5.3 8.6 4.2L10 3.2l.6 1.6 1.9-.6c2.6-.2 4.8 1.4 5.9 3.7l1.6 3.4c.3.7-.1 1.4-.8 1.6l-1.3.3c-.6.1-1.1-.1-1.4-.6l-.9-1.4-1.4.8c.6 1.3.8 2.6.8 4V21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/><circle cx="13.6" cy="7.4" r=".9" fill="currentColor"/></svg>`;
  const away = (S) => !!(S?.dungeon || S?.trip?.carriage || S?.trip?.boat);
  function can(S) { const h = H(); return !!(h && S && h.present(S) && !h.downed(S) && !away(S)); }
  const riding = (S) => { const h = H(); return !!(h && S && h.riding(S)); };
  function led(S) { const h = H(); return h && S && h.present(S) && !h.riding(S) && !h.downed(S) && !away(S) ? h.coat(S.horse.coat)[2] : null; }
  const label = (S) => (riding(S) ? L("Get down and walk") : L("Ride your horse"));
  function button(S) {
    const on = riding(S);
    return `<button class="iconbtn ridebtn${on ? " on" : ""}${can(S) ? "" : " hide"}" id="rideBtn" aria-label="${label(S)}" aria-pressed="${on}" title="${label(S)}">${ICON}</button>`;
  }
  function sync(S) {
    const b = typeof document !== "undefined" ? document.getElementById("rideBtn") : null; if (!b) return;
    const on = riding(S); b.classList.toggle("on", on); b.classList.toggle("hide", !can(S)); b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", label(S)); b.title = label(S);
  }
  let busy = 0;
  function bind(el, getS, after) {
    if (!el) return;
    el.onclick = () => {
      const S = getS(), h = H(); if (!S || !h) return;
      const t = Date.now(); if (t < busy) return;   // let the move play before the next tap
      if (!can(S)) { sync(S); return; }
      busy = t + (typeof MAPHERO !== "undefined" && MAPHERO.MOUNT_T ? MAPHERO.MOUNT_T * 1000 : 700);
      if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx("click");
      const m = h.toggle(S); sync(S);
      if (after) after(m);
    };
  }
  return { button, bind, sync, can, led };
})();
if (typeof module !== "undefined") module.exports = RIDING;
