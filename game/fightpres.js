/* What the fight says out loud: one thing at a time. [OURS] (fightscreen)
   Combat overhaul step 1 (with ChatGPT): "one presentation manager: a single boss intro, one banner at a time, a short
   line of events". Before this, "Your turn", a round summary, a foe's move, a combo, a boss's phase card and the boss's
   intro could all be on screen at once, on top of each other and of the fighters.
   - The boss's intro plays once per fight (a party member's phone redrawing the same fight doesn't play it again). While
     it plays, the first-fight tips and combo banners wait; "Your turn" waits and shows right after it.
   - Big banners (tbfight.js .tbban: Your turn / a round / a foe's move / Victory; reactions.js combo; bossfight.js phase
     and finishing cards) go through show(): only one is up at a time. A more important one replaces a smaller one; a
     smaller one that arrives while a bigger one is up is dropped (a foe's move, a round line) or waits its turn (a
     combo). Waiting ones go through NOTICES.fightTip (notices.js), so they also wait while Items, Magic or the result
     card is open. Stale ones (over 4 s old) are dropped.
   - On the zoned screen (fightzones.js) banners show at the top of the battlefield, over the fighters' heads.
   - The event line is the folded fight log (phonefight.js) at the top of the screen: one line, cut short with "…".
   decide() is pure: tests/test_fightzones.js checks it. */
const FIGHTPRES = (() => {
  const DOM = typeof document !== "undefined";
  const PRI = { act: 1, foe: 1, round: 2, turn: 2, combo: 3, phase: 4, end: 4, intro: 5 };
  const LIFE = { act: 1500, foe: 1500, round: 1500, turn: 1300, combo: 1900, phase: 2400, end: 3000, intro: 2800 };
  const STALE = 4000;
  /* a new banner (kind) while cur (kind, still up?) → "show" | "replace" | "wait" | "drop" */
  function decide(kind, curKind, curUp) {
    if (!curUp || !curKind) return "show";
    if (curKind === "intro") return (PRI[kind] || 0) >= 2 ? "wait" : "drop";
    if ((PRI[kind] || 0) >= (PRI[curKind] || 0)) return "replace";
    return (PRI[kind] || 0) >= 3 ? "wait" : "drop";
  }
  /* what kind of banner a tbfight.js .tbban is */
  function kindOf(n) {
    const c = n && n.classList; if (!c) return "turn";
    if (c.contains("won") || c.contains("lost")) return "end";
    if (c.contains("foe")) return c.contains("act") ? "act" : "foe";
    if (c.contains("round")) return c.contains("me") ? "turn" : "round";
    return "turn";
  }

  let cur = null;            // {kind, node, until}
  const held = [];           // waiting for the one on screen: {kind, node, t}
  let timer = 0;
  const now = () => Date.now();
  const up = () => !!cur && !!cur.node && cur.node.isConnected && (cur.kind === "intro" || now() < cur.until);
  const stageOf = () => (DOM ? document.querySelector("#tbf .tbstage") : null);

  /* on the zoned screen: banners at the top of the battlefield */
  function put(node, kind) {
    if (!DOM || !node) return;
    const Z = typeof FIGHTZONES !== "undefined" ? FIGHTZONES.bannerY() : null;
    if (Z && kind === "combo") { node.style.top = Z.y.toFixed(0) + "px"; node.style.left = Z.x.toFixed(0) + "px"; }
  }
  function drop(node) { if (node && node.parentNode) node.parentNode.removeChild(node); }
  function intro(on) { if (DOM && document.body) document.body.classList.toggle("fp-intro", !!on); }

  /* a banner was just put on screen: keep it, or take it off (and maybe show it later) */
  function show(kind, node) {
    if (!DOM || !node) return true;
    kind = PRI[kind] ? kind : "turn";
    const d = decide(kind, cur && cur.kind, up());
    if (d === "drop") { drop(node); return false; }
    if (d === "wait") { drop(node); held.push({ kind, node, t: now() }); arm(); return false; }
    if (d === "replace" && cur && cur.node !== node) {
      if (kind === "intro" && (PRI[cur.kind] || 0) >= 2 && cur.kind !== "end") held.push({ kind: cur.kind, node: cur.node, t: now() });   // "Your turn" shows after the intro
      drop(cur.node);
    }
    cur = { kind, node, until: now() + (LIFE[kind] || 1500) };
    put(node, kind);
    if (kind === "intro") { intro(true); arm(); }
    return true;
  }
  /* the one on screen is done: the most important waiting one (fresh enough) goes up */
  function pump() {
    timer = 0;
    if (cur && cur.kind === "intro" && !up()) intro(false);
    if (up()) { arm(); return; }
    for (let i = held.length - 1; i >= 0; i--) if (now() - held[i].t > STALE) held.splice(i, 1);
    if (!held.length) return;
    let bi = 0; held.forEach((h, i) => { if ((PRI[h.kind] || 0) >= (PRI[held[bi].kind] || 0)) bi = i; });
    const h = held.splice(bi, 1)[0];
    const go = () => {
      const isTb = h.node.classList && h.node.classList.contains("tbban");
      const host = isTb ? stageOf() : document.body;
      if (!host) return;
      host.appendChild(h.node);
      show(h.kind, h.node);
      if (!isTb) setTimeout(() => drop(h.node), LIFE[h.kind] || 1500);   // its own timer ran out while it waited
    };
    if (typeof NOTICES !== "undefined" && NOTICES.fightTip) NOTICES.fightTip("fp-" + h.kind, go); else go();   // [notices] waits while a fight window is open
    if (held.length) arm();
  }
  function arm() { if (DOM && !timer) timer = setTimeout(pump, 140); }

  /* bossfight.js: the intro plays once per fight (not again for the same boss a moment later on a party member's redraw) */
  const seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  let lastKey = "", lastAt = 0;
  function introOnce(sess) {
    const f = sess && sess.f; if (!f) return true;
    if (seen) { if (seen.has(f)) return false; seen.add(f); }
    const key = String(f.e && f.e.name || "") + "|" + (sess.ehpMax || "");
    if (key === lastKey && now() - lastAt < 60000) return false;
    lastKey = key; lastAt = now();
    return true;
  }
  /* tbfight.js after each redraw: the turn / round / foe's move / end banner it just drew */
  function after(el) {
    if (!DOM || !el) return;
    const n = el.querySelector(".tbstage > .tbban");
    if (n && !n.dataset.fp) { n.dataset.fp = "1"; show(kindOf(n), n); }
  }
  /* a fight closed: nothing waits for it */
  function reset() { held.length = 0; cur = null; intro(false); }

  return { PRI, LIFE, decide, kindOf, show, after, introOnce, reset, get current() { return up() ? cur.kind : null; }, get waiting() { return held.length; } };
})();
if (typeof module !== "undefined") module.exports = FIGHTPRES;
