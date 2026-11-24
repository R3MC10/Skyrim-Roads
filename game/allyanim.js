/* Ally animations in the fight scene: followers, party members and summons play their own clips. [OURS]
   The fight log only says what happened in words ("Lydia hits 12", "Bandit hits Lydia 7", "knocks Lydia to their
   knees"), so this reads each line, finds which ally it is about and picks the clip from the shared rig (figart.js):
   attack (melee, or the bow draw when they carry a bow), cast, block, hit, down, and getting back up.
     ALLYANIM.actsOf(text, names)      → [{name, clip}] what allies did in a line of your side ("me" / ally lines)
     ALLYANIM.foeOn(text, names)       → {name, clip} when the foe's line goes for an ally (hit, block, down)
     ALLYANIM.revivedIn(text, names)   → [names] allies pulled back up in this line
     ALLYANIM.downAtStart(f, lines, names) → Set of allies already down before these lines play
     ALLYANIM.anim(beat, name, u, hitU, downEnd) → {clip, u, from, fu, w} | null for one figure at beat time u (0..1)
   fightart.js calls these while it builds the beats and while it draws; figart.js FIGART.fight() takes the result. */
const ALLYANIM = (() => {
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* the ally a piece of text is about: the earliest name in it (the longest one on a tie: "Wolf (Lydia)" over "Lydia") */
  function whoIn(text, names) {
    const t = String(text || "").toLowerCase(); let best = null, at = 1e9;
    for (const n of names || []) {
      if (!n) continue;
      const m = t.match(new RegExp(`(^|[^a-z])${esc(String(n).toLowerCase())}(?![a-z])`)); if (!m) continue;
      const i = m.index + m[1].length;
      if (i < at || (i === at && String(n).length > String(best).length)) { best = n; at = i; }
    }
    return best;
  }
  /* what one ally's line means as a clip */
  function clipOf(seg) {
    const t = String(seg || "").toLowerCase();
    if (/fades away|breaks away|leaves the fight|looks for a potion/.test(t)) return null;
    if (/pulled back from the brink|gets back up|back on (their|his|her) feet/.test(t)) return "getup";
    if (/raises their (shield|guard)|keeps their guard|guard up|steps in front|holds back|blocks/.test(t)) return "block";
    if (/\bcasts\b|conjures|lays a|\bheals\b|raises .*(around|soaks)|channels|\bmends\b/.test(t)) return "cast";
    if (/drinks/.test(t)) return null;
    if (/shoots|aimed shot|arrow|bolt/.test(t)) return "shoot";
    if (/\d|hits|attack|strikes|misses|swings|bites|claws|opening/.test(t)) return "attack";
    return null;
  }
  function actsOf(text, names) {
    const out = [], seen = new Set();
    for (const seg of String(text || "").split(" · ")) {
      const n = whoIn(seg, names); if (!n || seen.has(n)) continue;
      const clip = clipOf(seg.slice(Math.max(0, seg.toLowerCase().indexOf(String(n).toLowerCase())))); if (!clip) continue;
      seen.add(n); out.push({ name: n, clip });
    }
    return out;
  }
  /* the foe's line goes for an ally */
  function foeOn(text, names) {
    const t = String(text || "").toLowerCase();
    if (!/goes for|knocks|hits|misses|destroys|swings at|strikes|bites|claws/.test(t)) return null;
    const n = whoIn(t, names); if (!n) return null;
    if (/knocks .*(to their knees| down)|is down|destroys/.test(t)) return { name: n, clip: "down" };
    if (/goes for|misses|\(blocked/.test(t)) return { name: n, clip: "block" };
    return { name: n, clip: "hit" };
  }
  function revivedIn(text, names) {
    const out = [];
    for (const seg of String(text || "").split(" · ")) if (/pulled back from the brink|gets back up|back on (their|his|her) feet/i.test(seg)) { const n = whoIn(seg, names); if (n) out.push(n); }
    return out;
  }
  /* who is already down before these lines play: down now, minus those knocked down in them, plus those revived in them */
  function downAtStart(f, lines, names) {
    const now = new Set([...(f?._downed || []).map((a) => a && a.name).filter(Boolean), ...(f?.followerDown ? [f.followerDown] : [])]);
    for (const l of lines || []) {
      const fo = foeOn(l.them, names); if (fo && fo.clip === "down") now.delete(fo.name);
      for (const n of revivedIn(l.me, names)) now.add(n);
    }
    return now;
  }
  /* a smooth fade in at the start of the beat and out at its end */
  const ramp = (u, a = 0.12, b = 0.14) => clamp(Math.min(u / a, (1 - u) / b), 0, 1);
  /* the clip for one figure at beat time u. beat.allyActs: [{name, clip}], beat.downs: names down during this beat */
  function anim(beat, name, u, hitU, downEnd) {
    if (!beat) return downEnd && downEnd.has(name) ? { clip: "down", u: 0 } : null;
    const act = (beat.allyActs || []).find((a) => a.name === name);
    const down = (beat.downs || []).includes(name);
    if (!act) return down ? { clip: "down", u: 0 } : null;
    const h = hitU == null ? 0.5 : hitU;
    switch (act.clip) {
      case "attack": case "shoot": return { clip: "attack", u: clamp(u, 0, 0.999), from: "idle", fu: 0, w: ramp(u, 0.1, 0.12), shoot: act.clip === "shoot" };
      case "cast": return { clip: "cast", u: (u * 2.4) % 1, from: "idle", fu: 0, w: ramp(u, 0.15, 0.2) };
      case "block": return beat.who === "them" ? { clip: "block", u: u, from: "idle", fu: 0, w: ramp(u, 0.2, 0.15) } : { clip: "block", u: u, from: "idle", fu: 0, w: ramp(u) };
      case "hit": return u < h ? null : { clip: "hit", u: clamp((u - h) * 2, 0, 0.99), from: "idle", fu: 0, w: clamp(Math.min((u - h) / 0.06, (1 - u) / 0.25), 0, 1) };
      case "down": {   // a blow lands, they buckle, then sink down onto the ground
        if (u < h) return null;
        const k = (u - h) / Math.max(0.05, 1 - h);
        return k < 0.3 ? { clip: "hit", u: 0.2, from: "idle", fu: 0, w: clamp(k / 0.1, 0, 1) } : { clip: "down", u: 0, from: "hit", fu: 0.2, w: clamp((k - 0.3) / 0.6, 0, 1) };
      }
      case "getup": return { clip: "idle", u: 0, from: "down", fu: 0, w: clamp((u - 0.1) / 0.7, 0, 1) };
    }
    return down ? { clip: "down", u: 0 } : null;
  }
  return { whoIn, clipOf, actsOf, foeOn, revivedIn, downAtStart, anim };
})();
