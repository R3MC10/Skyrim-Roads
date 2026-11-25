/* A calmer fight screen, phone first. [OURS]
   Critique round 1 (25 Nov 2026): "the fight screen is too busy: a big red crosshair and a thick red arc, health,
   magicka and stamina shown three times, the move tooltip over the buttons". tbfight.js still draws the screen and
   combat2.js lays it out; this runs last and only tidies the immersive screen (Settings → Fights → Immersive):
   - The top is one slim strip: the round and the turn order. The small Log and Wheel buttons move into a "…" menu.
   - The foe's card shows its name and kind on one line and only its NEXT move; tap the card (or "+2") for the rest.
   - (foeintent.js) a thin ellipse on the ground under whoever the foe goes for; the faint dashed arc only shows while
     you aim a move, or rest on the foe's card.
   - (combat2.js, fightctl.js) no bars over your hero and no coloured numbers in the Moves row: the orb is the one
     place for health, magicka and stamina, with the stripe for what's about to come off.
   - (tooltip.js) a move's tip is a fixed line just above the buttons, never over them.
   The CSS for all of it sits at the end of index.html ("fight declutter"). */
const FIGHTDC = (() => {
  const DOM = typeof document !== "undefined";
  const T = (t) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(t) : t);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LABEL = { log: "Fight log", wheel: "Combat wheel" };
  let menuOpen = false, intOpen = false, intKey = "";
  const bound = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  /* the "…" menu at the right of the top strip: the small round buttons go into it, with words */
  function moreMenu(el) {
    const top = el.querySelector(".tbtop"); if (!top) return;
    const btns = [...top.querySelectorAll(":scope > .tbff")]; if (!btns.length) return;
    const box = document.createElement("div");
    box.className = "fdc-more" + (menuOpen ? " open" : "");
    box.innerHTML = `<button class="fdc-mb" type="button" data-fdc="menu" aria-haspopup="menu" aria-expanded="${menuOpen}" aria-label="${esc(T("More"))}"><i></i><i></i><i></i></button><div class="fdc-menu" role="menu"></div>`;
    const menu = box.querySelector(".fdc-menu");
    for (const b of btns) {
      b.classList.add("fdc-it"); b.setAttribute("role", "menuitem");
      const w = LABEL[b.dataset.tbx] || b.getAttribute("aria-label") || "";
      b.insertAdjacentHTML("beforeend", `<span class="fdc-lb">${esc(T(w))}</span>`);
      menu.appendChild(b);
    }
    top.appendChild(box);
  }

  /* the foe's card: the first move always shows, the rest fold away behind "+n" */
  function foldIntents(el, sess) {
    const box = el.querySelector(".c2ov .tbu.foe .tbints"); if (!box) return;
    const its = box.querySelectorAll(".tbint"); if (its.length < 2) return;
    const key = `${sess?.round}:${sess?.wave || 0}`;
    if (key !== intKey) { intKey = key; intOpen = false; }
    box.classList.toggle("fdc-fold", !intOpen);
    const b = document.createElement("button");
    b.type = "button"; b.className = "fdc-intx"; b.dataset.fdc = "int";
    b.setAttribute("aria-expanded", String(intOpen));
    b.setAttribute("aria-label", intOpen ? T("Show only the next move") : T("Show all its moves this round"));
    b.textContent = intOpen ? "‹" : `+${its.length - 1}`;
    box.appendChild(b);
  }

  function bind(el) {
    if (!bound || bound.has(el)) return; bound.add(el);
    el.addEventListener("click", (ev) => {
      if (!el.classList.contains("c2")) return;
      const t = ev.target;
      const mb = t.closest?.("[data-fdc=menu]");
      if (mb) { ev.stopPropagation(); menuOpen = !menuOpen; const w = mb.closest(".fdc-more"); w?.classList.toggle("open", menuOpen); mb.setAttribute("aria-expanded", String(menuOpen)); return; }
      if (menuOpen && !t.closest?.(".fdc-menu")) { menuOpen = false; el.querySelector(".fdc-more")?.classList.remove("open"); }
      else if (menuOpen && t.closest?.(".fdc-menu [data-tbx]")) { menuOpen = false; setTimeout(() => document.querySelector("#tbf .fdc-more")?.classList.remove("open"), 0); }   // tbfight.js handles the button and redraws (maybe before this runs)
      // the foe's card: tap to see all its moves (not while picking a target, and not on a button inside it)
      const card = t.closest?.(".c2ov .tbu.foe");
      if (card && !el.classList.contains("fc-aiming") && !el.classList.contains("dragging") && (!t.closest("button") || t.closest("[data-fdc=int]"))) {
        const box = card.querySelector(".tbints"); if (!box || box.querySelectorAll(".tbint").length < 2) return;
        intOpen = !intOpen;
        box.classList.toggle("fdc-fold", !intOpen);
        const x = box.querySelector(".fdc-intx");
        if (x) { x.setAttribute("aria-expanded", String(intOpen)); x.textContent = intOpen ? "‹" : `+${box.querySelectorAll(".tbint").length - 1}`; }
        if (typeof COMBAT2 !== "undefined") requestAnimationFrame(() => COMBAT2.place(el, true));   // the card grew: keep it on screen
      }
    });
    if (typeof addEventListener === "function") addEventListener("keydown", (ev) => { if (ev.key === "Escape" && menuOpen) { menuOpen = false; document.querySelector("#tbf .fdc-more")?.classList.remove("open"); } });
  }

  /* after each redraw (tbfight.js render, after combat2.js and the rest) */
  function decorate(el, sess) {
    if (!DOM || !el || !el.classList.contains("c2")) return;
    bind(el);
    moreMenu(el);
    foldIntents(el, sess);
  }

  return { decorate, get menuOpen() { return menuOpen; } };
})();
if (typeof module !== "undefined") module.exports = FIGHTDC;
