/* difficulty.js: Story / Normal / Hard. [OURS]
   Owner decision (25 Nov 2026 survey): each player picks a difficulty (Settings → Fights, and when making a hero);
   in a party the LEADER's setting applies. Difficulty changes the challenge, never the economy:
     Story  : foe health 85%, foe damage 70%, fight minigame sweet spots 140% wider, foes fight plainly
     Normal : everything as it was
     Hard   : foe health 110%, foe damage 125%, fight minigame sweet spots 80%, foes fight smarter
   XP, gold and loot are the same on all three (skill practice from a fight is evened out below, so a longer or shorter
   fight doesn't teach more or less). Foes never cheat: "smarter" only means they use their kit more and go for the most
   hurt hero (and healers) more often.
   Snapshot: the difficulty is read once, when a fight starts (Fight constructor → DIFF.apply), and kept on the fight
   (f.diff). Changing it mid-fight, or the leader changing theirs, can't change a fight that's already on. A shared
   party fight carries the leader's snapshot to every phone (tbfight.js fightState → sharedfight.js Mirror.sync).
   Public world events and world bosses (and other players) are always Normal for everyone.
   One hook per stat: foe damage here (apply), foe health in tbfight.js Session, minigame windows in minigame.js width(),
   tactics in foekit.js (kit use) and foeintent.js (targets), skill practice in engine.js Fight.apply.
   Only the timing games inside fights change; crafting, lockpicking, fishing and dungeon-room games don't (that would
   touch the economy). Accessibility's "Easy timing" (access.js) is separate and still eases those. */
const DIFF = (() => {
  const LEVELS = {
    story: { id: "story", name: "Story", hp: 0.85, dmg: 0.7, win: 1.4, tac: "basic", kit: 0.8,
      blurb: "Foes hit softer and fall sooner, and fight timing is easier. For enjoying the story." },
    normal: { id: "normal", name: "Normal", hp: 1, dmg: 1, win: 1, tac: "normal", kit: 1,
      blurb: "The game as it's meant to be played." },
    hard: { id: "hard", name: "Hard", hp: 1.1, dmg: 1.25, win: 0.8, tac: "smart", kit: 1.2,
      blurb: "Foes hit harder, fight smarter and go for whoever is hurt. Timing is tighter." },
  };
  const IDS = ["story", "normal", "hard"];
  const SAME = "XP, gold and loot are the same on every difficulty.";
  const DEF_SKILLS = new Set(["Heavy Armor", "Light Armor", "Blocking", "Unarmored", "Restoration"]);   // practice that grows with blows taken
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let ctx = {};   // { party(), cardOf(id) } from ui.js (mount)

  const valid = (id) => (LEVELS[id] ? id : "normal");
  /* your own setting (stored on the hero, so it travels with backups and accounts) */
  const own = (s) => valid(s && s.diff);
  function set(s, id) { if (!s || !LEVELS[id]) return false; s.diff = id; return true; }
  /* in a party with someone else leading: the leader's setting (from their player card), or null */
  function leaderOf(s) {
    const p = ctx.party ? ctx.party() : null;
    if (!s || !p || !p.leader || p.leader === s.id || !(p.members?.length > 1) || !p.members.some((m) => m.id === s.id)) return null;
    const c = ctx.cardOf ? ctx.cardOf(p.leader) : null;
    return c && LEVELS[c.diff] ? c.diff : "normal";   // a leader on an older build plays Normal
  }
  /* what applies to s's fights right now */
  const level = (s) => leaderOf(s) || own(s);
  /* foes that are the same for everyone: other players, shared raid dragons, world events and world bosses */
  const shared = (e) => !!(e && (e.player || e.pool || e.gev || e.wev));
  const snapOf = (id, lead) => { const L = LEVELS[valid(id)]; return { id: L.id, hp: L.hp, dmg: L.dmg, win: L.win, tac: L.tac, kit: L.kit, ...(lead ? { lead: true } : {}) }; };
  function snap(s, e) {
    if (shared(e)) return snapOf("normal");
    const ld = leaderOf(s);
    return snapOf(ld || own(s), !!ld);
  }
  /* the fight starts (engine.js Fight constructor): take the snapshot and set the foe's damage. Idempotent: the foe's
     own number is kept (e.dfDmg), so the same foe met again (a retry, a replayed fight) never stacks. */
  function apply(f, forceId) {
    const e = f && f.e; if (!e) return null;
    const d = forceId && LEVELS[forceId] ? snapOf(forceId, f.diff?.lead) : snap(f.s, e);
    f.diff = d;
    if (typeof e.damage === "number") {
      if (e.dfDmg == null) e.dfDmg = e.baseDamage ?? e.damage;
      e.damage = Math.round(e.dfDmg * d.dmg * 10) / 10;
      if (e.baseDamage != null) e.baseDamage = e.damage;   // foe groups (foegroups.js) build each archetype from this
    }
    return d;
  }
  /* a teammate's phone takes the leader's snapshot (sharedfight.js) */
  function adopt(f, id) { if (f && LEVELS[id] && f.diff?.id !== id) apply(f, id); }
  const hp = (f) => (f && f.diff ? f.diff.hp : 1);
  const window_ = (f) => (f && f.diff ? f.diff.win : 1);
  const tactics = (f) => (f && f.diff ? f.diff.tac : "normal");
  const kitUse = (f) => (f && f.diff ? f.diff.kit : 1);
  /* skill practice from one fight, evened out so every difficulty teaches the same: offence practice grows with the
     foe's health (more blows), defence practice with health × damage (more and harder blows taken) */
  function xp(f, skill) {
    const h = (f && f.diffHp) || 1, dm = (f && f.diff && f.diff.dmg) || 1;
    return 1 / (DEF_SKILLS.has(skill) ? h * dm : h);
  }

  // ---------------------------------------------------------------- screens
  const nameOf = (id) => tr(LEVELS[valid(id)].name);
  /* the small chip on the fight screen */
  function chip(f) {
    const d = f && f.diff; if (!d) return "";
    const tip = `${tr("Difficulty")}: ${nameOf(d.id)}${d.lead ? ` (${tr("your party leader's")})` : ""}. ${tr(LEVELS[d.id].blurb)}`;
    return `<span class="diffchip d-${d.id}" data-tip="${esc(tip)}" title="${esc(tip)}">${esc(nameOf(d.id))}</span>`;
  }
  /* Settings → Fights → Difficulty */
  function settingsHTML(seg, s) {
    if (typeof seg !== "function" || !s) return "";
    const ld = leaderOf(s), cur = own(s);
    return `<div class="setrow diffrow"><span>${tr("Difficulty")}</span>${seg("diff", IDS.map((id) => [id, nameOf(id)]), cur)}</div>
      <p class="sub diffnote">${esc(tr(LEVELS[cur].blurb))} ${esc(tr(SAME))}${ld ? ` <b>${esc(tr("In your party the leader's setting counts"))}: ${esc(nameOf(ld))}.</b>` : ""}</p>`;
  }
  /* returns true when it handled the setting */
  function pref(k, v, s) {
    if (k !== "diff") return false;
    if (s) set(s, v);
    return true;
  }
  /* the Party panel: which difficulty the party plays */
  function partyLine(s, party) {
    if (!party || !s) return "";
    const lead = party.leader === s.id, id = lead ? own(s) : leaderOf(s) || own(s);
    return `<p class="sub diffparty">${tr("Difficulty")}: <span class="diffchip d-${id}">${esc(nameOf(id))}</span> ${esc(lead ? tr("Your setting counts for the whole party.") : tr("The leader's setting counts for the whole party."))}</p>`;
  }
  /* character creation: three cards. L(text, what) is chargen.js's translator ("diff:Normal" keeps it apart from the brows) */
  function chooserHTML(cur, L = tr) {
    cur = valid(cur);
    return `<h4>${esc(L("Difficulty"))}</h4><p class="sub">${esc(L(SAME))} ${esc(L("You can change it any time in Settings."))}</p>
      <div class="cgdiffs" role="radiogroup" aria-label="${esc(L("Difficulty"))}">${IDS.map((id) => `<button class="cgdiff ${cur === id ? "on" : ""}" data-diff="${id}" role="radio" aria-checked="${cur === id}"><b>${esc(L(LEVELS[id].name, "diff"))}</b><span>${esc(L(LEVELS[id].blurb))}</span></button>`).join("")}</div>`;
  }
  /* what my player card carries, so party members know the leader's setting */
  const cardBits = (s) => ({ diff: own(s) });
  function mount(c) {
    ctx = c || {};
    if (typeof PARTY !== "undefined" && !PARTY.cardBits.diffWrapped) {
      const cb0 = PARTY.cardBits;
      PARTY.cardBits = (s, party) => ({ ...cb0(s, party), ...cardBits(s) });
      PARTY.cardBits.diffWrapped = true;
    }
  }
  return { LEVELS, IDS, valid, own, set, level, leaderOf, shared, snap, apply, adopt, hp, window: window_, tactics, kitUse, xp, chip, settingsHTML, pref, partyLine, chooserHTML, cardBits, mount, nameOf };
})();
if (typeof module !== "undefined") module.exports = DIFF;
