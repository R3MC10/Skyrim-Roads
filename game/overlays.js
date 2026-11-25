/* One overlay at a time (overlays.js). [OURS]
   Players saw a first-time tip sitting on top of the VICTORY card, and a courier's letter popping over a menu they were
   reading. Everything that floats over the game now has a rank, and only the highest one owns the screen:
     result   (4)  the fight's VICTORY / defeat card, a level-up sheet, a result window
     decision (3)  any other window that asks you something (an encounter, a letter, a shop sheet...)
     tip      (2)  first-time tips (onboard.js) and the fight hints pinned to a control
     toast    (1)  messages in the top-left lane (hud2.js)
   - level() / top(): what is on screen now. body[data-ovl] carries its name, so CSS can hold the lower ones back.
   - A tip or hint under a result or a window is held (hidden, not dismissed) and comes back when the screen is clear.
     Fight hints are put away for good when the result card shows.
   - sheet(): the box toasts must keep clear of (hud2.js keeps only the newest message above or below it).
   - when(level, fn): run fn now if nothing at that level or higher is showing, else as soon as the screen clears.
     Uninvited windows (the courier's letter) wait this way, and also wait out a fight and an open menu.
   The ranking is a plain function so node tests can check it (tests/test_overlays.js). */
const OVERLAYS = (() => {
  const LEVEL = { none: 0, toast: 1, tip: 2, decision: 3, result: 4 };
  const NAME = ["none", "toast", "tip", "decision", "result"];
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  // what counts as what (first match wins, highest level first)
  const RESULT = ["#tbf .tbdone", "#tbf .c2rescard", "#modal .sheet.lv", "#modal .sheet.result", "#lvlpick"];
  const DECISION = ["#modal .sheet", "#wgcard"];   // a wagon's card (wagons.js) asks you something too; the party-invite bar is small and the invite tip points at it, so it doesn't count
  const TIP = ["#obtip", "#fhints .fhint"];
  const TOAST = ["#hudlane #hudlog .toast:not(.hide)", "#toast:not(.hide)"];

  /* pure: the highest level among the ones present ({result: true, ...}) */
  function rank(present) {
    let lv = 0;
    for (const k of Object.keys(present || {})) if (present[k] && LEVEL[k] > lv) lv = LEVEL[k];
    return lv;
  }
  /* pure: may something at `want` show while `cur` is on screen? (same level is fine: one replaces the other) */
  const allows = (want, cur) => (LEVEL[want] ?? +want) >= (LEVEL[cur] ?? +cur);

  const vis = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && !el.classList.contains("hide") && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const first = (list) => { for (const q of list) for (const el of document.querySelectorAll(q)) if (vis(el)) return el; return null; };
  /* what is showing now: {level, name, el} */
  function top() {
    if (!DOM) return { level: 0, name: "none", el: null };
    for (const [lv, list] of [[4, RESULT], [3, DECISION], [2, TIP], [1, TOAST]]) {
      const el = first(list); if (el) return { level: lv, name: NAME[lv], el };
    }
    return { level: 0, name: "none", el: null };
  }
  const level = () => top().level;
  const fightOpen = () => typeof TB !== "undefined" && !!TB.open;
  /* a full-screen menu is open (the SkyUI menus, the PC side screens): uninvited windows wait */
  const menuOpen = () => DOM && (!!document.getElementById("sky") || document.body.classList.contains("tw-on") || document.body.classList.contains("tw-char") || vis(document.getElementById("pcclose")));   // #pcclose: "Back to the map" on a PC menu screen
  /* the window or card toasts must keep out of (or null) */
  function sheet() {
    if (!DOM) return null;
    const el = first(RESULT) || first(["#modal .sheet"]);
    if (!el) return null;
    return el.closest(".c2rescard") || el.closest("#tbf .tbdock") || el;
  }

  // ------------------------------------------------------------ waiting for a clear screen
  const queue = [];   // [{lv, fn, quiet}]
  /* run fn when nothing at `lvName` or higher is up. quiet: also wait out a fight and an open menu (uninvited windows). */
  function when(lvName, fn, quiet = false) {
    const lv = LEVEL[lvName] ?? 3;
    if (ready(lv, quiet)) { try { fn(); } catch (e) { console.warn("overlay", e); } return true; }
    if (!queue.some((q) => q.fn === fn)) queue.push({ lv, fn, quiet });
    return false;
  }
  const ready = (lv, quiet) => level() < lv && !(quiet && (fightOpen() || menuOpen()));
  function drain() {
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      if (!ready(q.lv, q.quiet)) continue;
      queue.splice(i, 1);
      try { q.fn(); } catch (e) { console.warn("overlay", e); }
      return;   // one at a time: the next waits for this one
    }
  }

  // ------------------------------------------------------------ the guard
  let last = "";
  function guard() {
    if (!DOM || !document.body) return;
    const t = top(), name = t.name;
    if (name !== last) {
      last = name;
      if (name === "none") delete document.body.dataset.ovl; else document.body.dataset.ovl = name;
      if (t.level >= LEVEL.result) document.getElementById("fhints")?.remove();   // the fight is over: its hints are done
    }
    drain();
  }
  if (DOM) {
    const start = () => {
      guard();
      new MutationObserver(() => guard()).observe(document.body, { childList: true });
      setInterval(guard, 400);
    };
    if (document.body) start(); else addEventListener("DOMContentLoaded", start);
  }

  // ------------------------------------------------------------ Polish
  const PL = {
    "Turn order: the highest number acts first. A foe can act twice a round.": "Kolejność tur: najwyższa liczba działa pierwsza. Wróg może działać dwa razy w rundzie.",
    "Up to 4 moves a turn. Blows cost stamina, spells magicka.": "Do 4 ruchów na turę. Ciosy kosztują wytrzymałość, czary magię.",
    "Done? End turn. Moves you don't make become guard.": "Gotowe? Zakończ turę. Niewykonane ruchy stają się gardą.",
    "Tap to hide": "Dotknij, by ukryć",
    // the patch note
    "One thing on screen at a time": "Jedna rzecz naraz na ekranie",
    "The first-fight tip no longer sits on top of the VICTORY card. Results always come first, then windows that ask you something, then tips, then messages.":
      "Wskazówka z pierwszej walki nie zasłania już karty ZWYCIĘSTWO. Najpierw zawsze wynik, potem okna z pytaniem, potem wskazówki, a na końcu komunikaty.",
    "In your first turn-by-turn fight the big wall of text is gone. Instead you get short one-line hints right next to the turn order, your moves and End turn, and each one goes away as soon as you use it.":
      "W pierwszej walce turowej nie ma już ściany tekstu. Zamiast niej są krótkie, jednolinijkowe podpowiedzi przy kolejności tur, ruchach i przycisku Zakończ turę. Każda znika, gdy tylko z niej skorzystasz.",
    "A tip that pops up while a window is open waits until you close it, instead of covering it.":
      "Wskazówka, która pojawi się przy otwartym oknie, czeka, aż je zamkniesz, zamiast je zasłaniać.",
    "Letters that arrive on their own (like the courier with three letters) wait until you're out of a fight and out of the menus.":
      "Listy, które przychodzą same (jak kurier z trzema listami), czekają, aż skończysz walkę i wyjdziesz z menu.",
    "Messages at the top left get a dark backing over menus, so they don't blur into the titles underneath.":
      "Komunikaty w lewym górnym rogu mają w menu ciemne tło, więc nie zlewają się z tytułami pod spodem.",
  };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v;

  return { LEVEL, rank, allows, top, level, sheet, when, guard, fightOpen, menuOpen, PL, get queued() { return queue.length; } };
})();
if (typeof module !== "undefined") module.exports = OVERLAYS;
