/* Fight-screen tooltips through tooltip.js. [OURS]
   A player: "missing tooltips in combat" (hovering a spell in the fight's Magic list showed nothing).
   - Every part of the fight screen gets the same rich tooltip as the rest of the game: spell rows and their Cast / Dual
     buttons (what it does, numbers with your perks, single and dual cast, magicka, stamina, how long, and why a greyed
     button can't be used), potions and scrolls, the big buttons and quick slots, the moves row, your bars, you, the foe,
     its status chips (afraid, calmed, rattled added here), filters and tabs.
   - decorate() runs after every redraw of the fight (tbfight.js) and only adds data-tip-k="fa:..." attributes; the
     "fa" provider below turns a key into the tooltip for the fight that's open (TB.session).
   - Holding a finger shows the tooltip and the lift doesn't cast (tooltip.js swallows the click; tbui.js asks it first
     and drops the drag that the hold started). Dragging a card onto a target still works: move before the hold fires. */
const FIGHTTIPS = (() => {
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r0 = (v) => Math.round(+v || 0);
  const head = (name, cls = "") => `<b class="tt-h ${cls}">${esc(name)}</b>`;
  const sub = (t) => (t ? `<div class="tt-sub">${esc(t)}</div>` : "");
  const stats = (pairs) => { const p = pairs.filter((x) => x && x[1] != null && x[1] !== ""); return p.length ? `<div class="tt-stats">${p.map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join("")}</div>` : ""; };
  const line = (t, cls = "") => (t ? `<p class="${cls}">${esc(t)}</p>` : "");
  const hint = (t) => (t ? `<p class="tt-hint">${esc(t)}</p>` : "");
  // the game's modules are script-level `const`s: look them up by name (missing ones are undefined)
  const MODS = {
    TB: () => (typeof TB !== "undefined" ? TB : undefined), G: () => (typeof G !== "undefined" ? G : undefined), F: () => (typeof F !== "undefined" ? F : undefined),
    MAGIC: () => (typeof MAGIC !== "undefined" ? MAGIC : undefined), TOMES: () => (typeof TOMES !== "undefined" ? TOMES : undefined), TIP: () => (typeof TIP !== "undefined" ? TIP : undefined),
    TBTIPS: () => (typeof TBTIPS !== "undefined" ? TBTIPS : undefined), FIGHTCTL: () => (typeof FIGHTCTL !== "undefined" ? FIGHTCTL : undefined), POWERS: () => (typeof POWERS !== "undefined" ? POWERS : undefined),
    SHIELDFX: () => (typeof SHIELDFX !== "undefined" ? SHIELDFX : undefined), FOEKIT: () => (typeof FOEKIT !== "undefined" ? FOEKIT : undefined),
    POISONFX: () => (typeof POISONFX !== "undefined" ? POISONFX : undefined),
  };
  const mod = (n) => { try { return MODS[n] ? MODS[n]() : undefined; } catch { return undefined; } };
  const safe = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch { return d; } };
  const cap = (t) => String(t || "").charAt(0).toUpperCase() + String(t || "").slice(1);

  const apOf = (f, a, sess) => safe(() => mod("TB").cost(f, a, sess), null);   // build 146: { sp, mp, hp, n }, no AP any more
  const zoneOf = (a) => safe(() => mod("TB").zoneOf(a), "");
  const ZONE = { foe: "Tap it, or drag it onto the foe.", self: "Tap it, or drag it onto yourself or a teammate.", ally: "Tap it, or drag it onto a teammate." };
  /* the magicka a spell needs to be castable right now (the same sum as the greyed-out check) and what it really costs */
  function mana(f, sp, dual) {
    const G_ = mod("G"), M = mod("MAGIC");
    const one = safe(() => G_.spellCost(f.s, sp), sp.cost || 0);
    const need = dual ? one * (M ? M.DUAL_COST : 2.8) : one;
    const pay = dual ? safe(() => G_.dualCost(f.s, sp, f), need) : one;
    return { need: Math.ceil(need), pay: r0(pay) };
  }
  /* why a move is greyed out, with the numbers */
  function whyHTML(sess, a, c) {
    if (safe(() => sess.canAfford(a), true)) return "";
    const f = sess.f, [k, arg] = a.split(":");
    let w = safe(() => mod("FIGHTCTL").reason(sess, a, c), "") || "You can't use this right now";
    if (/stamina$/i.test(w) && c && c.sp > 0 && a !== "power_attack") w += `: you have ${r0(f.sp)}, it needs ${c.sp}`;
    else if (/more magicka$/.test(w) && D.SPELLS[arg]) w += `: you have ${r0(f.mp)}, it needs ${mana(f, D.SPELLS[arg], k === "dual").need}`;
    else if (a === "power_attack" && /stamina/.test(w)) w += `: you have ${r0(f.sp)}, it needs ${r0(f.paCost || 0)}`;
    return `<p class="tt-dn">\uE123 ${esc(w)}</p>`;
  }
  const apStat = (sess, a, c) => ["Costs", (c && c.acts > 0 ? `${c.acts} AP · ` : "") + (safe(() => mod("TB").costTxt(c), "free") || "free") + (c && c.n ? ` (×${c.n + 1} this turn)` : "")];   // [threeap] its AP first
  const stripAp = (t) => String(t || "").replace(/\s*(?:\d+ AP\.|Uses all your AP\.)\s*$/, "");

  // ---------------------------------------------------------------- spells, items, moves
  function spellHTML(sess, id, dual) {
    const f = sess.f, s = f.s, sp = D.SPELLS[id]; if (!sp) return null;
    const M = mod("MAGIC"), a = (dual ? "dual:" : "spell:") + id, c = apOf(f, a, sess), m = mana(f, sp, dual);
    const tier = sp.level || safe(() => mod("TOMES").level(id), "Novice");
    const fail = safe(() => M.failChance(s, id), 0);
    return head(dual ? `${sp.name} (dual cast)` : sp.name, `sch-${String(sp.school).toLowerCase()}`)
      + sub(`${tier} ${sp.school}${sp.element && sp.element !== "none" ? ` · ${sp.element}` : ""}`)
      + line(safe(() => M.describe(sp), ""))
      + (dual ? line(`Both hands: ${M ? M.DUAL_POWER : 2.2}× the effect for more magicka.`) : "")
      + safe(() => M.infoHTML(s, id), "")
      + stats([["Magicka", m.pay], ["You have", r0(f.mp)], apStat(sess, a, c)])
      + (fail ? `<p class="tt-dn">\uE123 Above your ${esc(sp.school)} skill: it fizzles ${r0(fail * 100)}% of the time</p>` : "")
      + whyHTML(sess, a, c) + hint(ZONE[zoneOf(a)] || "");
  }
  function potionHTML(sess, kind) {
    const f = sess.f, a = "potion:" + kind, c = apOf(f, a, sess), T = mod("TIP");
    const r = safe(() => f.findPotion(kind), null);
    let n = 0; safe(() => { for (const x of f.s.inv) if (D.ITEMS[x.item]?.slot === "potion" && D.ITEMS[x.item].restore?.[0] === kind) n += Math.max(0, f.left ? f.left(x.id) : x.qty); });
    const body = r && T?.itemHTML ? T.itemHTML(r.item, f.s, r) : head(`${cap(kind)} potion`) + line(`Drinks your best ${kind} potion.`);
    return body + stats([["Left", n], apStat(sess, a, c)]) + (r ? line("The best one you carry is used first.", "tt-hint") : "") + whyHTML(sess, a, c) + hint(ZONE[zoneOf(a)] || "");
  }
  function scrollHTML(sess, item) {
    const f = sess.f, a = "scroll:" + item, c = apOf(f, a, sess), T = mod("TIP"), it = D.ITEMS[item]; if (!it) return null;
    const sp = D.SPELLS[it.spell];
    return (T?.itemHTML ? T.itemHTML(item, f.s) : head(it.name)) + (sp ? safe(() => mod("MAGIC").infoHTML(f.s, it.spell), "") : "")
      + stats([["Magicka", "none"], apStat(sess, a, c)]) + line("Reading it uses the scroll up.", "tt-hint") + whyHTML(sess, a, c) + hint(ZONE[zoneOf(a)] || "");
  }
  /* [itemgames] a poison: what it is, what the next hit delivers (poisonfight.js) */
  function poisonHTML(sess, a) {
    const f = sess.f, c = apOf(f, a, sess), T = mod("TIP"), PX = mod("POISONFX"), r = PX ? PX.rowOf(f, a) : null; if (!r) return null;
    return (T?.itemHTML ? T.itemHTML(r.item, f.s, r) : head(D.ITEMS[r.item].name)) + line(PX.note(f, a))
      + stats([["Left", Math.max(0, f.left ? f.left(r.id) : r.qty)], apStat(sess, a, c)]) + line("Coating uses the poison up. Bows coat their arrows.", "tt-hint") + whyHTML(sess, a, c) + hint(ZONE[zoneOf(a)] || "");
  }
  const NAMES = { attack: "Attack", power_attack: "Power attack", block: "Guard", bash: "Shield bash", flee: "Flee", end: "End turn" };
  function moveHTML(sess, a) {
    const f = sess.f, c = apOf(f, a, sess), [k, arg] = a.split(":"), TT = mod("TBTIPS"), T = mod("TIP");
    if (k === "spell" || k === "dual") return spellHTML(sess, arg, k === "dual");
    if (k === "potion") return potionHTML(sess, arg);
    if (k === "scroll") return scrollHTML(sess, arg);
    if (k === "poison") { const h = poisonHTML(sess, a); if (h) return h; }
    let body = "";
    if (k === "shout" && T) { const PW = mod("POWERS"), id = PW && Object.keys(PW.SHOUTS).find((x) => PW.SHOUTS[x][1][0] === String(arg).toUpperCase()); body = id ? T.html("shout:" + id, f.s) || "" : ""; }
    if (k === "power" && T) body = T.html("power:race", f.s) || "";
    if (!body) {
      const name = a === "attack" && (f.wt === "bow" || f.wt === "crossbow") ? "Shoot" : NAMES[a] || (k === "shout" ? `Shout ${String(arg).toUpperCase()}` : cap(String(arg || a).replace(/_/g, " ")));
      body = head(name) + line(stripAp(TT ? TT.action(f, a, c) : ""));
    }
    const st = [];
    if (a === "power_attack") st.push(["Stamina", r0(f.paCost || 0)], ["You have", r0(f.sp)]);
    if (a === "block" || a === "bash") st.push(["You have", `${r0(f.sp)} stamina`]);
    if (a !== "end") st.push(apStat(sess, a, c));
    else st.push(["AP spent", `${sess.myActs || 0}/${sess.st?.acts ?? 3}`], ["Guard", `+${Math.round(100 * safe(() => sess.guardLeft(), 0))}%`]);
    return body + stats(st) + whyHTML(sess, a, c) + (a === "end" || a === "flee" ? "" : hint(ZONE[zoneOf(a)] || ""));
  }

  // ---------------------------------------------------------------- you, the foe, the bars, the AP row
  function apHTML(sess) {
    const st = sess.st || {};
    return head("AP") + stats([["Spent", `${sess.myActs || 0}/${st.acts ?? 3}`], ["Stamina", r0(sess.f.sp)], ["Magicka", r0(sess.f.mp)]])
      + line("You have 3 AP a turn. Most moves take 1 AP (the gold diamonds on each button); power attacks, big spells, dual casts and full shouts take 2.")
      + line("Moves also cost stamina or magicka (the coloured numbers), 50% more for the same move again in one turn. AP you don't spend become guard until your next turn: 10% less damage each, up to 30%.") + hint("Stamina and magicka come back a bit every round.");
  }
  const sp0 = (x) => x.cost || 0;
  function barHTML(sess, k) {
    const f = sess.f, s = f.s, G_ = mod("G"), FF = mod("F");
    if (k === "hp") return head("Health", "tt-hp") + stats([["Now", r0(f.hp)], ["Most", safe(() => G_.maxHealth(s), "")]]) + line("At zero you're knocked out and the fight is lost. Healing spells and health potions bring it back.");
    if (k === "mp") {
      const cheap = (s.spells || []).map((id) => D.SPELLS[id]).filter((x) => x && x.kind !== "utility").map((x) => safe(() => G_.spellCost(s, x), sp0(x))).filter((v) => v > 0).sort((a, b) => a - b)[0];
      return head("Magicka", "tt-mp") + stats([["Now", r0(f.mp)], ["Most", safe(() => G_.maxMagicka(s), "")], ["Cheapest spell", cheap ? r0(cheap) : ""]]) + line("Spells cost magicka. It fills up again after the fight; magicka potions help in it.");
    }
    if (k === "sp") return head("Stamina", "tt-sp") + stats([["Now", r0(f.sp)], ["Most", safe(() => G_.maxStamina(s), "")], ["Power attack", r0(f.paCost || 0)], ["Guard", FF ? FF.BLOCK_STAMINA : ""]]) + line("Power attacks, guarding and shield bashes cost stamina.");
    return null;
  }
  function meHTML(sess) {
    const f = sess.f, st = sess.st || {};
    let arm = 0, red = 0; safe(() => { const { rating, pieces } = f.armorRating(); arm = r0(rating); red = r0(100 * mod("F").damageReduction(rating, pieces)); });
    const blk = safe(() => r0(100 * mod("SHIELDFX").passive(f)), 0);
    return head(f.s.name || "You") + sub("You") + stats([["Armour", arm], ["Blows weaker", `${red}%`], blk ? ["Shield block", `${blk}%`] : null, ["AP a turn", st.acts ?? 3], ["Speed", st.speed]])
      + hint("Drop healing spells and potions here to use them on yourself.");
  }
  function foeHTML(sess) {
    const f = sess.f, e = f.e || {};
    const kind = e.boss || f.tags?.has?.("boss") ? "Boss" : f.tags?.has?.("tough") || f.tags?.has?.("elite") ? "Tough foe" : e.player ? "Player" : "Foe";
    const [lo, hi] = safe(() => mod("F").DAMAGE_SPREAD, [0.8, 1.2]);
    const tags = [...(f.tags || [])].filter((t) => !/^(normal|tough|boss|elite)$/.test(t));
    const kit = safe(() => mod("FOEKIT").names(f), []);
    return head(e.name || "Foe", "tt-foe") + sub(`${kind}${e.level ? ` · level ${e.level}` : ""}${tags.length ? ` · ${tags.join(", ")}` : ""}`)
      + stats([["Health", `${r0(Math.max(0, f.ehp))}/${r0(sess.ehpMax || f.ehp)}`], ["Hits for", e.damage ? `${Math.max(1, r0(e.damage * lo))}–${r0(e.damage * hi)}` : ""], ["Armour", e.red ? `${r0(e.red * 100)}% off your blows` : ""]])
      + (kit.length ? line(`Can use: ${kit.join(", ")}.`) : "") + hint("Drag attacks and spells here.");
  }

  /* the tooltip for "fa:<what>" in this fight */
  function html(sess, id) {
    if (!sess || !sess.f || !id) return null;
    try {
      if (id === "ap") return apHTML(sess);
      if (id === "me") return meHTML(sess);
      if (id === "foe") return foeHTML(sess);
      if (id === "hp" || id === "mp" || id === "sp") return barHTML(sess, id);
      if (id === "menu:magic") { const n = (sess.f.s.spells || []).filter((x) => D.SPELLS[x] && D.SPELLS[x].kind !== "utility").length; return head("Magic") + line(`Your ${n} fighting spell${n === 1 ? "" : "s"}: cast one, or ★ it to pin it to the quick slots.`) + hint("Key: M"); }
      if (id === "menu:items") return head("Items") + line("Potions, scrolls and poisons: drink, read or coat your weapon, or ★ one to pin it to the quick slots.") + hint("Key: I");
      if (id === "back") return head("Back") + line("Back to your moves.") + hint("Key: Esc");
      if (id.startsWith("filter:")) { const v = id.slice(7); return line(v === "all" ? "Show all your spells." : v === "fav" ? "Show only the spells you pinned with ★." : `Show only ${v} spells.`); }
      return moveHTML(sess, id);
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- marking the screen after every redraw
  function chip(cls, ic, tip) { return `<i class="st ${cls}" data-tip="${esc(tip)}">${ic}</i>`; }
  function foeChips(f) {
    const out = [], rat = f.fcap?.rattled || 0;
    if (f.fearTurns > 0) out.push(chip("fear", `\uE142${f.fearTurns}`, `Afraid: it cowers and won't fight for ${f.fearTurns} more turn${f.fearTurns === 1 ? "" : "s"}.`));
    if (f.calmTurns > 0) out.push(chip("calm", `\uE160${f.calmTurns}`, `Calmed: it stops fighting for ${f.calmTurns} more turn${f.calmTurns === 1 ? "" : "s"}.`));
    if (rat > 0) out.push(chip("rattled", `\uE135${rat}`, `Rattled: still shaken, its blows land 20% softer for ${rat} more turn${rat === 1 ? "" : "s"}.`));
    return out.join("");
  }
  function decorate(el, sess) {
    if (!el || !sess) return;
    hook();
    const set = (q, k) => el.querySelectorAll(q).forEach((x) => { x.dataset.tipK = typeof k === "function" ? k(x) : k; });
    set(".tbdock [data-tba]", (x) => "fa:" + x.dataset.tba);
    set(".tbdock [data-tbm=magic]", "fa:menu:magic"); set(".tbdock [data-tbm=items]", "fa:menu:items"); set(".tbdock .fc-back,.tbdock .back[data-tbm='']", "fa:back");
    el.querySelectorAll(".tbdock .tbsp").forEach((row) => { const b = row.querySelector("[data-tba]"); if (b) row.dataset.tipK = "fa:" + b.dataset.tba.replace(/^dual:/, "spell:"); });
    set(".tbdock .fc-chip[data-v]", (x) => "fa:filter:" + x.dataset.v);
    el.querySelectorAll(".tbdock .fc-tab").forEach((x) => { x.dataset.tipK = "fa:menu:" + x.dataset.tbm; });
    const ap = el.querySelector(".tbap"); if (ap && ap.querySelector("i.ap")) ap.dataset.tipK = "fa:ap";
    const me = el.querySelector(".tbu.me");
    if (me) { me.dataset.tipK = "fa:me"; [["hp", ".tbbar.hp"], ["mp", ".tbbar.mp"], ["sp", ".tbbar.sp"]].forEach(([k, q]) => { const b = me.querySelector(q); if (b) b.dataset.tipK = "fa:" + k; }); }
    const foe = el.querySelector(".tbu.foe");
    if (foe) {
      foe.dataset.tipK = "fa:foe";
      const extra = foeChips(sess.f);
      if (extra && !foe.querySelector(".st.fear,.st.calm,.st.rattled")) {
        let st = foe.querySelector(".tbst:not(.mine)");
        if (!st) { st = document.createElement("div"); st.className = "tbst"; const nm = foe.querySelector(".tbbar"); if (nm && nm.nextSibling) foe.insertBefore(st, nm.nextSibling); else foe.appendChild(st); }
        st.insertAdjacentHTML("beforeend", extra);
      }
    }
    const log = el.querySelector("button.tblog"); if (log && !log.dataset.tip) log.dataset.tip = "The last things that happened. Tap to read the whole fight.";
  }

  let reg = false;
  function hook() { const T = mod("TIP"); if (reg || !T?.register) return; reg = true; T.register("fa", (id) => { const B = mod("TB"); return B && B.session ? html(B.session, id) : null; }); }
  hook();
  return { html, decorate, foeChips, whyHTML, mana };
})();
if (typeof module !== "undefined") module.exports = FIGHTTIPS;
