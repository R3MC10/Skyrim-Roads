/* Mystery rooms with real choices (Roads of the North). [OURS]
   Six odd things an "Unknown" dungeon room can hold, next to the old corpse / book / shrine / eggs / coffin / stash:
   Sealed passage, Collapsed tunnel, Wounded traveller, Patrol (draugr in a barrow), Cursed offering, Unstable bridge.
   - Each has three ways to deal with it. A choice that needs a skill names it and the chance ("Lockpicking · 62%") and
     what it can bring. In a party the best hero at that skill rolls (their skills ride on their coop card: COOP card.msk);
     solo, you roll.
   - What you can get: a shortcut (one depth skipped, never the boss's), gold or loot, a blessing or curse for the rest of
     the dungeon, or an ambush (the next fight: the foe is staggered, you act first and it starts at 80% health; never
     below 60%, and the blow cap still holds).
   - Failing is never a dead end: some health lost (never the last of it), the next foe acting first, or a detour fight.
   - Party: the choice goes through the normal party vote (partyvote.js: majority, tie → leader). Only the leader's phone
     rolls; the result rides on the recorded choice ("evlock@1" / "evlock@0", lootvote.js aroundAct), so every phone
     replays the same outcome. Which event a room holds is seeded by the run, so everyone meets the same one.
   - Perk: Patient Shadow (Sneak) makes these checks 10% easier (perkfx.js "dunev").
   Pure logic (node-testable). dungeons.js calls room() / choices() / act() / opening() / clear(). */
const DUNEVENTS = (() => {
  const SHARE = 0.55;   // how many Unknown rooms hold one of these (the rest: the old corpse/book/shrine...)
  const HOURS = 6 * 3600;   // blessings and curses fade on their own even if you never leave properly
  const SKILLS = ["Lockpicking", "One-Handed", "Two-Handed", "Athletics", "Sneak", "Restoration", "Speechcraft", "Alteration", "Light Armor", "Archery"];
  const AMBUSH_BLOW = 0.2, AMBUSH_FLOOR = 0.6;
  let ctx = null;   // { mates(): other players' cards } once the screens are wired (ui.js)
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h >>> 0; }
  /* a roll that is the same on every phone of a party run (solo: just a random number) */
  const seeded = (s, tag) => { const d = s.dungeon; return d?.run ? (hash(`${d.run}|${d.row}|${d.col}|${tag}`) % 100000) / 100000 : Math.random(); };
  const pickS = (s, arr, tag) => arr[Math.floor(seeded(s, tag) * arr.length) % arr.length];
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);

  // [key, label, skills (null: no roll), chance modifier, what it can bring]
  const EVENTS = {
    sealed: { title: "Sealed passage", text: "An iron-bound door blocks a side passage. Cold air seeps under it: it leads deeper, past the next stretch of rooms.",
      opts: [["evlock", "Pick the old lock", ["Lockpicking"], 0, "a shortcut and what's stored behind it"],
        ["evforce", "Force it open", ["One-Handed", "Two-Handed"], -0.05, "a shortcut"], ["skip", "Leave it", null]] },
    tunnel: { title: "Collapsed tunnel", text: "Half the ceiling has come down. Over the rubble, or through a narrow gap at the bottom, the tunnel runs on.",
      opts: [["evclimb", "Climb over the rubble", ["Athletics"], 0, "a shortcut"],
        ["evsqueeze", "Squeeze through the gap", ["Sneak"], 0, "you come out behind the next foe"], ["evdetour", "Take the long way round", null]] },
    traveller: { title: "Wounded traveller", text: "A man sits against the wall, pressing a rag to a bloody side. \"Please, they left me here.\"",
      opts: [["evheal", "Tend his wounds", ["Restoration"], 0.05, "his thanks: gold and a potion"],
        ["evtalk", "Talk to him", ["Speechcraft"], 0, "he knows a way past the next rooms"], ["skip", "Leave him", null]] },
    patrol: { title: "Patrol", text: "",
      opts: [["evsneak", "Sneak past", ["Sneak"], 0, "no fight"],
        ["evambush", "Set an ambush", ["Sneak", "Archery"], -0.05, "you strike first"], ["evfight", "Fight them", null]] },
    offering: { title: "Cursed offering", text: "On a stained altar lies a pile of coins and a silver cup, wrapped in a faint, sickly glow.",
      opts: [["evpurify", "Purify it", ["Restoration", "Alteration"], 0, "a blessing for the rest of this dungeon"],
        ["evtake", "Just take it", ["Luck"], 0, "gold, maybe a curse"], ["skip", "Leave it", null]] },
    bridge: { title: "Unstable bridge", text: "A rope bridge sags over a dark drop. Half its planks are missing, but on the far side the way runs on past the next rooms.",
      opts: [["evrun", "Run across", ["Athletics"], 0, "a shortcut"],
        ["evtread", "Tread light", ["Light Armor"], 0, "a shortcut"], ["evround", "Go round", null]] },
  };
  const IDS = Object.keys(EVENTS);
  const optOf = (ev, key) => { const o = EVENTS[ev]?.opts.find((x) => x[0] === key); return o ? { key: o[0], label: o[1], sk: o[2], mod: o[3] || 0, brings: o[4] || "" } : null; };

  /* the skills that count here, from your own save (published on your coop card for the party) */
  function sheet(s) {
    const o = {};
    for (const k of SKILLS) { let v = 15; try { v = G.skill(s, k); } catch { v = s.skills?.[k]?.lvl || 15; } o[k] = Math.round(v); }
    o.b = Math.min(0.2, pfx(s, "dunev"));
    return o;
  }
  /* who can roll: you, plus the heroes in the same party run (at most 8 in all) */
  function team(s) {
    const me = { id: s.id, name: s.name, me: true, sk: sheet(s) }, d = s.dungeon;
    if (!d?.run || !ctx?.mates) return [me];
    let cards = [];
    try { cards = ctx.mates() || []; } catch { cards = []; }
    const mates = cards.filter((c) => c && c.id !== s.id && c.coop?.run === d.run && c.coop.msk).slice(0, 7).map((c) => ({ id: c.id, name: c.name || "?", sk: c.coop.msk }));
    return [me, ...mates];
  }
  const chanceOf = (lvl, bonus, tier, mod) => clamp(0.3 + (lvl || 15) / 150 + (bonus || 0) + (mod || 0) - 0.05 * Math.max(0, (tier || 1) - 1), 0.1, 0.95);
  /* the best roll the party has for a choice: { who, skill, ch } (null: no roll) */
  function best(s, o) {
    if (!o?.sk) return null;
    if (o.sk[0] === "Luck") return { who: null, skill: "Luck", ch: 0.5 };
    const tier = s.dungeon?.tier || 1;
    let b = null;
    for (const m of team(s)) for (const k of o.sk) { const ch = chanceOf(m.sk[k], m.sk.b, tier, o.mod); if (!b || ch > b.ch + 1e-9) b = { who: m, skill: k, ch }; }
    return b;
  }
  const pct = (ch) => Math.round(ch * 100);

  /* a new event for an Unknown room, or null (then the old pool is used) */
  function room(s) {
    const d = s.dungeon;
    if (!d || seeded(s, "share") >= SHARE) return null;
    const id = pickS(s, IDS, "which"), ev = EVENTS[id];
    if (id === "patrol") {
      const T = DUNGEONS.THEMES[d.theme];
      const key = d.theme === "barrow" ? "draugr" : weightedS(s, T?.foes || [["bandit", 1]], "patrol");
      const name = DUNGEONS.ENEMY[key]?.name || "Bandit";
      return { m: "event", ev: id, title: d.theme === "barrow" ? "Draugr patrol" : "Patrol", foeKey: key,
        text: `Torchlight ahead: a ${name.toLowerCase()} on patrol, walking the same loop through the hall. It hasn't seen you yet.` };
    }
    return { m: "event", ev: id, title: ev.title, text: ev.text };
  }
  function weightedS(s, list, tag) { let r = seeded(s, tag) * list.reduce((a, [, w]) => a + w, 0); return (list.find(([, w]) => (r -= w) < 0) || list[0])[0]; }
  /* the old pool's pick, seeded in a party run so every phone finds the same thing */
  const pickOld = (s, pool) => pickS(s, pool, "old");

  function choices(s) {
    const r = s.dungeon?.room;
    if (!r?.ev || !EVENTS[r.ev]) return [];
    return EVENTS[r.ev].opts.map(([key]) => {
      const o = optOf(r.ev, key), b = best(s, o);
      if (!b) return [key, o.label];
      const who = b.who && !b.who.me ? `, ${b.who.name}` : "";
      return [key, `${o.label} (${b.skill} · ${pct(b.ch)}%${who})${o.brings ? ` → ${o.brings}` : ""}`];
    });
  }

  // ------------------------------------------------------------ outcomes
  /* one depth skipped: you stand in a room of the next row without entering it, so the next pick is the row after.
     Never the boss's row (it's always the last one). Returns false when the next row is the boss's. */
  function skip(s) {
    const d = s.dungeon;
    if (!d || !Array.isArray(d.rows) || d.row < 0) return false;
    const next = d.row + 1, last = d.rows.length - 1;
    if (next >= last || d.rows[next]?.some((n) => n.type === "boss")) return false;
    const links = d.rows[d.row]?.[d.col]?.links || [];
    const col = links.find((c) => d.rows[next][c] && d.rows[next][c].links?.length) ?? links[0] ?? 0;
    if (!d.rows[next][col]) return false;
    d.row = next; d.col = col; d.rows[next][col].skipped = true;
    d.skips = (d.skips || 0) + 1;
    return true;
  }
  function shortcut(s, api) {
    if (skip(s)) return "You come out further in, past the next stretch of rooms.";
    const mh = G.maxHealth(s), before = G.curHealth(s);
    G.setHealth(s, Math.min(mh, before + mh * 0.15));
    return `It comes out right by the last chamber's door, and you get a quiet moment to catch your breath (+${Math.round(G.curHealth(s) - before)} health).`;
  }
  /* some health lost, never the last of it */
  function hurt(s, api, lo, hi) {
    const before = G.curHealth(s);
    api.dmg(lo, hi);
    if (G.curHealth(s) < 1) G.setHealth(s, Math.min(before, 1));
    return Math.max(0, Math.round(before - G.curHealth(s)));
  }
  /* a blessing or curse for the rest of this dungeon: max health up or down (an effect on your sheet, gone when you leave) */
  function mark(s, kind, t) {
    const mh = G.maxHealth(s), mag = kind === "bless" ? Math.round(mh * 0.12) : -Math.round(mh * 0.1);
    s.fx = (s.fx || []).filter((f) => !(f.dun && f.src === "dunev-" + kind));
    s.fx.push({ key: "max:health", mag, until: t + HOURS, name: kind === "bless" ? "Blessed offering" : "Cursed offering", src: "dunev-" + kind, dun: s.dungeon?.place || true });
    if (kind === "bless") G.setHealth(s, G.curHealth(s) + mag);
    else if (G.curHealth(s) > G.maxHealth(s)) G.setHealth(s, G.maxHealth(s));
    return Math.abs(mag);
  }
  /* the ambush opener: a fifth of its health gone, never below 60% (the strongest foes stay strong) */
  function ambushHp(e) {
    const H = e.health || e.hp || 1, now_ = e.hp ?? H;
    return Math.max(Math.ceil(H * AMBUSH_FLOOR), Math.min(now_, Math.round(H * (1 - AMBUSH_BLOW))));
  }
  /* the next fight, set up by an event: { stagger } (ambush) or { enemyFirst } (they heard you). Consumed once. */
  function opening(s, e) {
    const d = s.dungeon;
    if (!d?.evNext || !e) return null;
    const k = d.evNext; d.evNext = null;
    if (k === "ambush") { e.hp = ambushHp(e); return { stagger: true, line: `You catch the ${String(e.name).toLowerCase()} off guard.` }; }
    if (k === "alert") return { enemyFirst: true, line: `The ${String(e.name).toLowerCase()} was waiting for you.` };
    return null;
  }
  function foeFight(s, api, key, how, text) {
    const e = api.foe(key);
    const op = {};
    if (how === "ambush") { e.hp = ambushHp(e); op.stagger = true; }
    if (how === "first") op.enemyFirst = true;
    const res = api.fight(e, op);
    if (!res.f.won) return api.lose({ ...res, text, fight: res.f }, e.name);
    return api.done({ ...res, text: `${text} The ${e.name.toLowerCase()} falls.`, fight: res.f });
  }
  const detourFoe = (s) => { const T = DUNGEONS.THEMES[s.dungeon.theme]; return weightedS(s, T?.foes || [["bandit", 1]], "detour"); };

  /* resolve a choice. q: the recorded result on a replay (1 passed, 0 failed), null to roll here.
     api: { done, lose, fight(e, opts), foe(key), goldFound(g), giveFound(item, n), themeLoot(chance), dmg(lo, hi) } */
  function act(s, choice, q, t, api) {
    const d = s.dungeon, r = d.room, o = optOf(r.ev, choice);
    if (!o || choice === "skip") return api.done({ text: r.ev === "traveller" && choice === "skip" ? "You leave him to it and walk on. His voice follows you a while." : "You leave it and move on." });
    const tier = d.tier || 1;
    if (!o.sk) {   // the safe or plain choice: no roll
      if (choice === "evfight") return foeFight(s, api, r.foeKey || detourFoe(s), "", `You step out of the dark to meet the patrol.`);
      if (choice === "evdetour") return api.done({ text: "You take the long way round. It's slow and dusty, but nothing finds you." });
      return api.done({ text: "You find a way round. Slower, but you keep your feet dry and your bones whole." });   // evround
    }
    const b = best(s, o);
    const ok = q != null ? q >= 0.5 : Math.random() < b.ch;
    const rec = `${choice}@${ok ? 1 : 0}`;
    const skills = b.who?.me && b.skill !== "Luck" ? G.useSkill(s, b.skill, ok ? 6 : 2) : [];
    const roll = b.skill === "Luck" ? "" : `${b.who && !b.who.me ? `${b.who.name} tries it. ` : ""}${b.skill} ${pct(b.ch)}%: ${ok ? "it works." : "it doesn't."} `;
    const out = (res) => ({ ...res, text: `${roll}${res.text || ""}`.trim(), rec, skills: [...skills, ...(res.skills || [])] });
    const gold = (lo, hi) => api.goldFound(rint(lo, hi) * tier);
    switch (choice) {
      case "evlock": {
        if (ok) { const g = gold(10, 30), sc = shortcut(s, api); return out(api.done({ text: `The lock gives with a dry click. Someone stored ${g} gold behind the door. ${sc}` })); }
        d.evNext = "alert";
        return out(api.done({ text: "A pick snaps and the lock jams with a clang that echoes down the halls. Whatever is ahead knows you're coming." }));
      }
      case "evforce": {
        if (ok) return out(api.done({ text: `The hinges tear out of the stone. ${shortcut(s, api)}` }));
        const x = hurt(s, api, 0.08, 0.15);
        return out(api.done({ text: `The door doesn't move; your shoulder does (−${x} health). You give up and take the main way.` }));
      }
      case "evclimb": {
        if (ok) return out(api.done({ text: `You scramble over the rubble. ${shortcut(s, api)}` }));
        const x = hurt(s, api, 0.1, 0.18);
        return out(api.done({ text: `Stones slide under your boots and you come down with them (−${x} health). The way over is shut.` }));
      }
      case "evsqueeze": {
        if (ok) { d.evNext = "ambush"; const g = gold(3, 12); return out(api.done({ text: `You wriggle through and come out in the shadows, behind whatever lives here. Your next fight starts with you striking first. On the way you find ${g} gold.` })); }
        return out(foeFight(s, api, detourFoe(s), "first", "You get stuck halfway, and something hears you struggling."));
      }
      case "evheal": {
        if (ok) { const g = gold(12, 30), p = api.giveFound("potion_health_minor"); return out(api.done({ text: `You clean and bind the wound. He presses ${g} gold and a ${p} into your hand.` })); }
        const x = hurt(s, api, 0.04, 0.09);
        return out(api.done({ text: `He thrashes in a fever and catches you with his knife (−${x} health). When he calms down he just stares at the ceiling.` }));
      }
      case "evtalk": {
        if (ok) return out(api.done({ text: `He tells you about a side passage the bandits used. ${shortcut(s, api)}` }));
        return out(foeFight(s, api, detourFoe(s), "first", "He was the bait. Something steps out of the dark behind you."));
      }
      case "evsneak": {
        if (ok) return out(api.done({ text: "You wait for it to turn and slip past along the wall." }));
        return out(foeFight(s, api, r.foeKey || detourFoe(s), "first", "A pebble skitters under your boot. The patrol turns."));
      }
      case "evambush": {
        if (ok) return out(foeFight(s, api, r.foeKey || detourFoe(s), "ambush", "You wait in the dark and hit it as it passes: it staggers, and you get the first move."));
        return out(foeFight(s, api, r.foeKey || detourFoe(s), "first", "It spots you before you're ready."));
      }
      case "evpurify": {
        if (ok) { const g = gold(10, 25), x = mark(s, "bless", t); return out(api.done({ text: `The glow fades to a warm light. You take ${g} gold, and feel stronger for it: +${x} max health while you're in here.` })); }
        const x = mark(s, "curse", t);
        return out(api.done({ text: `The glow sinks into your hands instead. Cursed: −${x} max health while you're in here.` }));
      }
      case "evtake": {
        const g = gold(25, 55);
        if (ok) return out(api.done({ text: `You sweep up ${g} gold. Nothing happens. Lucky.` }));
        const x = mark(s, "curse", t);
        return out(api.done({ text: `You sweep up ${g} gold, and a chill runs up your arm. Cursed: −${x} max health while you're in here.` }));
      }
      case "evrun": {
        if (ok) return out(api.done({ text: `You sprint across as the planks crack behind you. ${shortcut(s, api)}` }));
        const x = hurt(s, api, 0.12, 0.2);
        return out(api.done({ text: `A plank snaps and you hang by a rope until you can pull yourself back (−${x} health). You take the main way.` }));
      }
      case "evtread": {
        if (ok) return out(api.done({ text: `You step only where the ropes hold. ${shortcut(s, api)}` }));
        const x = hurt(s, api, 0.08, 0.15);
        return out(api.done({ text: `Your armour catches on a rope and the bridge bucks (−${x} health). You crawl back and take the main way.` }));
      }
    }
    return api.done({ text: "You leave it and move on." });
  }

  /* blessings and curses end when you leave (or die, or start the next dungeon) */
  function clear(s) { if (s?.fx?.length) s.fx = s.fx.filter((f) => !f.dun); }
  function mount(c) { ctx = c; }
  return { SHARE, EVENTS, IDS, SKILLS, AMBUSH_FLOOR, sheet, team, best, chanceOf, room, pickOld, choices, act, skip, opening, ambushHp, clear, mount };
})();
if (typeof module !== "undefined") module.exports = DUNEVENTS;
