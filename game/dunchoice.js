/* dunchoice.js: the ways you can go at a dungeon fork, as cards. [OURS] [dunchoices]
   Each way shows the room's painting (DUNROOMS, falling back to its ink medallion), the room's name, how risky it is,
   what it pays, and what that way leads to next. In a party run the same cards are the vote (partyvote.js puts the
   voters' faces and a vote count on each). Only spans inside the buttons, never divs: other screens swap the
   <div class="evc ..."> block out with a simple pattern that stops at the first </div>.
     DUNCHOICE.hint(type, d, s) → { risk: 0..4 or -1 (unknown), riskTxt, what, gain, need }
     DUNCHOICE.listHTML(s)      → the cards for the ways you can take now (solo)
     DUNCHOICE.voteHTML(s, key, mine) → one card as a vote option (key = column)  */
const DUNCHOICE = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const label = (t) => (typeof DUNGEONS !== "undefined" && DUNGEONS.LABEL[t]) || t;
  const icon = (t) => (typeof DUNGEONS !== "undefined" && DUNGEONS.ICON[t]) || "";
  const RISK = ["Safe", "Low risk", "Some risk", "High risk", "Deadly"];
  // base risk (0 safe .. 4 deadly, -1 unknown), what you'll face, what it pays
  const INFO = {
    fight: [2, "A foe blocks the way. You can fight, sneak past or run.", "Gold, loot and skill"],
    elite: [3, "A strong foe that hits hard.", "Better gold and loot"],
    trap: [2, "It can hurt you. Acrobatics and Sneak help.", "Not much: a few coins at best"],
    treasure: [0, "A locked chest. Lockpicking helps.", "Gold and gear"],
    puzzle: [1, "Solve it and a hidden room opens.", "Lots of gold and rare finds"],
    rest: [1, "A quiet spot. Searching it can wake something.", "Heals about half your health"],
    mystery: [-1, "Could be anything: a shrine, a book, a body... or an ambush.", "Unknown"],
    boss: [4, "The master of this place. No way round it.", "The big chest"],
    camp: [0, "A camp to catch your breath.", "Rest, or head deeper"],
  };
  /* the hint for one room type in this dungeon, for this hero */
  function hint(type, d, s) {
    const [base, what, gain] = INFO[type] || [-1, "", ""];
    let risk = base;
    if (["fight", "elite", "trap"].includes(type) && d?.tier >= 3) risk += 1;   // a deadly place hits harder
    if (["fight", "trap"].includes(type) && d?.tier <= 1) risk -= 1;            // an easy one less so (a tough fight stays tough)
    risk = Math.max(-1, Math.min(4, risk));
    let need = false;
    if (type === "rest" && s && typeof G !== "undefined") { try { need = G.curHealth(s) < G.maxHealth(s) * 0.5; } catch { need = false; } }
    return { risk, riskTxt: risk < 0 ? "Risk unknown" : RISK[risk], what, gain, need };
  }
  /* the room types that way leads to next (the row after it), or the boss */
  function beyond(d, col) {
    const node = d?.rows?.[d.row + 1]?.[col], next = d?.rows?.[d.row + 2];
    if (!node || !next) return [];
    return [...new Set((node.links || []).map((j) => next[j]?.type).filter(Boolean))];
  }
  /* the picture: the room's painting when there is one, else its ink medallion. The unknown room never shows a
     painting (it would borrow a fight's and tell a lie). */
  function pic(type, theme) {
    const p = type !== "mystery" && typeof DUNROOMS !== "undefined" ? DUNROOMS.pick(type, theme) : null;
    if (p?.url) return `<span class="dcpic painted"><img src="${esc(p.url)}" alt="" decoding="async"></span>`;
    const m = typeof DUNART !== "undefined" && DUNART.medalHTML ? DUNART.medalHTML(type, theme, 44, "dcmed") : "";
    return `<span class="dcpic ${p?.wait ? "waiting" : "drawn"}" data-type="${esc(type)}">${m}</span>`;
  }
  const sideName = (i, n) => (n === 2 ? ["on the left", "on the right"][i] : n === 3 ? ["on the left", "in the middle", "on the right"][i] : `way ${i + 1}`);
  /* the card's inside: picture, name, risk, what it pays, what comes next */
  function inner(s, col) {
    const d = s.dungeon, row = d.rows[d.row + 1], n = row?.[col];
    if (!n) return "";
    const nx = typeof DUNGEONS !== "undefined" ? DUNGEONS.nextChoices(s) : [], i = nx.indexOf(+col);
    const same = nx.filter((x) => row[x]?.type === n.type).length > 1;   // two rooms that look alike: say which side
    const h = hint(n.type, d, s), then = beyond(d, +col);
    const thenTxt = then.length ? then.map((t) => `<b>${esc(label(t))}</b>`).join(`<i class="dcsep" aria-hidden="true"> · </i>`) : "";
    return `${pic(n.type, d.theme)}<span class="dctx">
      <span class="dchd"><span class="dcname"><span class="dcic" aria-hidden="true">${icon(n.type)}</span> <span>${esc(label(n.type))}</span>${same ? ` <small class="dcside">${esc(sideName(i, nx.length))}</small>` : ""}</span><span class="dcrisk r${h.risk < 0 ? "u" : h.risk}">${esc(h.riskTxt)}</span></span>
      <span class="dcwhat">${esc(h.what)}</span>
      <span class="dcgain${h.need ? " need" : ""}"><span class="dclab">Reward</span> <span>${esc(h.gain)}</span>${h.need ? ` <small>· you need it</small>` : ""}</span>
      ${thenTxt ? `<span class="dcthen"><span class="dclab">Then</span> ${thenTxt}</span>` : ""}
    </span>`;
  }
  const typeAt = (s, col) => s.dungeon?.rows?.[s.dungeon.row + 1]?.[col]?.type || "";
  /* every way you can take now, as tappable cards (the solo fork) */
  function listHTML(s) {
    const d = s?.dungeon;
    if (!d || d.room || typeof DUNGEONS === "undefined") return "";
    const nx = DUNGEONS.nextChoices(s);
    return `<div class="evc dcards">${nx.map((c) => { const t = typeAt(s, c);
      return `<button class="btn dchoice t-${esc(t)}" data-act="droom" data-c="${c}" data-type="${esc(t)}" aria-label="Go to: ${esc(label(t))}, ${esc(hint(t, d, s).riskTxt)}">${inner(s, c)}</button>`; }).join("")}</div>`;
  }
  /* one way as a party vote option: the faces and the count go in the corner */
  function voteHTML(s, key, mine) {
    const t = typeAt(s, +key);
    if (!t) return "";
    return `<button class="btn pvopt dchoice t-${esc(t)}${mine ? " pvmine" : ""}" data-act="pvv" data-k="${esc(key)}" data-type="${esc(t)}" aria-label="Vote: ${esc(label(t))}, ${esc(hint(t, s.dungeon, s).riskTxt)}">${inner(s, +key)}<span class="pvtally"><span class="pvn num"></span><span class="pvchips" data-k="${esc(key)}"></span></span></button>`;
  }
  /* a painting that was still loading when the cards were drawn: put it in once it's there */
  function update() {
    if (typeof document === "undefined" || typeof DUNROOMS === "undefined") return;
    const th = document.querySelector("#dun .dmap")?.dataset.theme || "";   // the theme rides on the dungeon screen's chart
    for (const el of document.querySelectorAll("#dun .dcpic.waiting")) {
      const p = DUNROOMS.pick(el.dataset.type, th);
      if (p?.wait) continue;
      if (p?.url) { el.className = "dcpic painted"; el.innerHTML = `<img src="${esc(p.url)}" alt="" decoding="async">`; }
      else el.classList.replace("waiting", "drawn");
    }
  }
  if (typeof ASSETS !== "undefined" && ASSETS.on) ASSETS.on(update);
  return { RISK, INFO, hint, beyond, listHTML, voteHTML, update };
})();
