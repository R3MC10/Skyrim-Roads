/* gatherui.js: the Gathering section of the Area tab. [OURS]
   It used to float over the map (PC) and sit in the Map side panel; now it is one section of the Area tab, drawn like the
   Area tab's other rows: the plants in reach (icon, ripe or "Picked · grows back in ~N in-game h", Gather and Quick pick
   per ripe one), Gather all, Forage here (with its cooldown under it), Herbalist's notes and the Auto-pick switch. The
   how-it-works words fold into a "?" tip. A ripe patch in reach still gets its own Gather prompt on the map (#gnear).
   Self-contained so any screen can host it:
   - GATHERUI.html(s)            the section as a string ("" when nothing grows near and you can't forage)
   - GATHERUI.render(el, s)      draws it into el and wires its own buttons (only redraws on change, so taps don't get lost)
   - GATHERUI.bind(fn)           ui.js hands over its gather handler fn(what, id) (mini-game, saving, toasts)
   - GATHERUI.focus(root)        scrolls the section into view (Area tab opened to pick plants)
   In a party everyone still picks their own share of each patch (gather.js keeps picks per player). */
const GATHERUI = (() => {
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ACTS = /^(gpick|gquick|gpickall|gforage|gnotes|gauto)$/;
  let handler = null;

  function html(s, t) {
    if (typeof GATHER === "undefined" || !s || !Number.isFinite(s.x) || s.dungeon) return "";
    t = t ?? G.now();
    const list = GATHER.nearby(s, t), f = GATHER.canForage(s, t);
    if (!list.length && !f.ok && !f.left) return "";
    const H = typeof HARVEST !== "undefined" ? HARVEST : null, auto = !!GATHER.st(s).auto, nm = GATHER.name;
    const icon = (id) => (typeof ICONART !== "undefined" ? ICONART.item(id, 30) : "");
    const rows = list.map((n) => `<div class="item gnode ${n.ripe ? "" : "gdone"}">${icon(n.ing)}<div class="t">${esc(nm(n.ing))}<span>${n.ripe ? `${Math.round(n.d)} paces away · ${D.ITEMS[n.ing].weight} wt each${H ? ` · ${esc(H.howTo(n.ing))}` : ""}` : `Picked · grows back in ~${Math.ceil(GATHER.growsIn(s, n, t) / 300)} in-game h`}</span></div>${n.ripe ? `<div class="gact">${H && H.canQuick(s, n.ing) ? `<button class="btn sm" data-act="gquick" data-id="${n.id}" title="Quick Gather: no mini-game, a little less">Quick pick</button>` : ""}<button class="btn sm pri" data-act="gpick" data-id="${n.id}">Gather</button></div>` : ""}</div>`).join("");
    const ripeN = list.filter((n) => n.ripe).length;
    const tip = `${H ? H.cardFoot(s) : ""}<p class="sub hg-foot">Forage searches the ground where you stand for whatever grows there; night brings out moths, torchbugs and glowing Nirnroot. Auto-pick takes ripe plants as you pass them on the road. Patches you've spotted show on the map as leaves.</p>`;
    const row = (cls, ic, title, sub, btn) => `<div class="item grow ${cls}"><span class="au-ic" aria-hidden="true">${ic}</span><div class="t">${title}<span>${sub}</span></div>${btn}</div>`;
    return `<div class="panel au-panel gcard" id="au-gather"><div class="ghead"><h2>Gathering</h2>${ripeN ? `<span class="au-gn">${ripeN} ripe</span>` : ""}<details class="gtip"><summary aria-label="How gathering works" title="How gathering works">?</summary><div class="gtip-in">${tip}</div></details></div>
      <div class="glist">${rows || '<p class="sub">No plants spotted right here. Patches you pass on the road show on the map as leaves.</p>'}</div>
      ${ripeN > 1 ? `<div class="gbtns"><button class="btn pri" data-act="gpickall">Gather all (${ripeN})</button></div>` : ""}
      ${row("gforage", "", "Forage here", esc(f.ok ? "Search the ground for whatever grows here" : f.why || "You can't forage here."), `<button class="btn sm${f.ok ? " pri" : ""}" data-act="gforage" ${f.ok ? "" : "disabled"}>Forage</button>`)}
      ${row("gnotesrow", "", "Herbalist's notes", "Every ingredient, where it grows, what you know", `<button class="btn sm" data-act="gnotes">Open</button>`)}
      ${row("gauto", "", "Auto-pick", auto ? "You'll pick ripe plants as you pass them." : "You'll only pick plants when you choose to.", `<button class="btn sm gsw${auto ? " pri on" : ""}" data-act="gauto" role="switch" aria-checked="${auto}" aria-label="${auto ? "Auto-pick: On" : "Auto-pick: Off"}">${auto ? "On" : "Off"}</button>`)}</div>`;
  }

  function bind(fn) { handler = fn; }
  /* a host screen that isn't the side panel: draw and wire the buttons here (the side panel's own click handler covers the Area tab) */
  function render(el, s) {
    if (!el) return "";
    const h = html(s);
    if (el.dataset.ghtml !== h) { el.innerHTML = h; el.dataset.ghtml = h; }
    if (!el.__gwired) {
      el.__gwired = true;
      el.addEventListener("click", (e) => {
        const b = e.target.closest && e.target.closest("[data-act]");
        if (!b || !el.contains(b) || !ACTS.test(b.dataset.act) || b.disabled) return;
        e.stopPropagation();
        if (handler) handler(b.dataset.act, b.dataset.id);
      });
    }
    return h;
  }
  function focus(root) {
    const el = (root || document).querySelector && (root || document).querySelector("#au-gather");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
    return !!el;
  }

  return { html, render, bind, focus, ACTS };
})();
if (typeof module !== "undefined") module.exports = GATHERUI;
