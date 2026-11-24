/* [OURS] Mounted combat. If you're riding when a road fight starts, you fight from the saddle:
   - you open with a charge (a sure hit for double damage that can stagger; spears hit hardest),
   - one-handed weapons, spears and bows hit harder from up high,
   - two-handers and staffs are too clumsy up there, so you jump down and fight on foot,
   - the horse has its own stamina: charging and swinging tire it, and a winded horse gives no bonus,
   - foes can go for the horse. A horse never dies: at 0 health it is downed, you're thrown clear and fight
     on in the same fight on foot; afterwards it stays with you, downed, until it gets back up (horses.js). */
const HORSEBACK = (() => {
  const SP_MAX = 100, SP_REGEN = 4, COST = { charge: 35, attack: 12, power: 20 };
  const BONUS = { sword: 1.05, axe: 1.05, mace: 1.05, dagger: 1.03, spear: 1.1, bow: 1.05, fist: 1 };
  const CHARGE = { spear: 1.7, def: 1.4 };
  const FALL = 0.05;   // you lose 5% of your max health when you're thrown
  const FOOT = new Set(["greatsword", "battleaxe", "warhammer"]);
  const hn = (f) => f.s.horse?.name || "your horse";

  /* call before Fight.run() for a fight on the road. Returns true when you fight mounted. */
  function engage(f, t) {
    const s = f.s;
    if (typeof HORSES === "undefined" || !HORSES.riding(s) || s.beastForm || f.e?.nonlethal) return false;
    const foot = FOOT.has(f.wt) || !!f.weapon?.staff;
    const hp = HORSES.hp(s, t);
    f.mount = { up: !foot, foot, hp, hp0: hp, max: HORSES.maxHp(s.horse), sp: SP_MAX, guard: HORSES.ARMOR[s.horse.armor || "none"]?.guard || 0, charged: false, downTurn: 0, winded: false, hits: 0 };
    if (foot) f.log.push({ turn: 0, rule: null, me: `You swing down from ${hn(f)} — no room for a ${f.weapon?.staff ? "staff" : "two-hander"} in the saddle`, them: "" });
    return f.mount.up;
  }
  const up = (f) => !!f.mount?.up;

  /* your swing from the saddle. Returns {mult, label, sure} or null (not mounted). */
  function strike(f, power, sneak) {
    const m = f.mount; if (!m?.up) return null;
    if (!m.charged && !sneak && f.turn <= 1) {   // the opening charge
      m.charged = true;
      if (m.sp >= COST.charge) {
        m.sp -= COST.charge;
        const mult = (CHARGE[f.wt] || CHARGE.def) * (power ? 1.15 : 1);
        if (Math.random() < 0.25) f.stagger = true;
        return { mult, label: `Mounted charge ×${mult.toFixed(1).replace(/\.0$/, "")}${f.stagger ? ", knocks them back" : ""}`, sure: true };
      }
    }
    m.charged = true;
    const cost = power ? COST.power : COST.attack;
    if (m.sp < cost) { const first = !m.winded; m.winded = true; return { mult: 1, label: first ? `${power ? "Power attack" : "Attack"} (${hn(f)} is winded)` : null, sure: false }; }
    m.sp -= cost;
    const mult = BONUS[f.wt] ?? 1;
    return { mult, label: mult > 1 ? `${power ? "Power attack" : "Attack"} from the saddle` : null, sure: false };
  }

  /* the foe's turn: sometimes it goes for the horse. Returns a log line, or null to hit you as normal. */
  function enemyTurn(f) {
    const m = f.mount; if (!m?.up) return null;
    const big = f.tags.has("dragon") || f.tags.has("big") || f.tags.has("giant");
    if (Math.random() >= (big ? 0.22 : 0.1)) return null;
    const n = f.e.name;
    if (Math.random() > 0.8) return `${n} lunges at ${hn(f)}, who shies away`;
    const dmg = Math.round((f.e.damage || 10) * (0.85 + Math.random() * 0.3) * 2 * (1 - m.guard));
    m.hp -= dmg; m.hits++;
    if (m.hp > 0) return `${n} hits ${hn(f)} ${dmg} (horse ${Math.round(m.hp)}/${m.max})`;
    m.hp = 0; m.up = false; m.downTurn = f.turn || 1;
    const fall = Math.round(G.maxHealth(f.s) * FALL); f.hp = Math.max(1, f.hp - fall);   // the fall alone never finishes you; the fight goes on
    return `${n} brings ${hn(f)} down! ${hn(f)} is downed. You're thrown clear (−${fall}) and fight on foot`;
  }

  /* each turn: the horse gets its breath back a little */
  function tick(f) { const m = f.mount; if (m?.up) m.sp = Math.min(SP_MAX, m.sp + SP_REGEN); }

  /* after the fight: write the horse's health back; a horse at 0 health is downed (it stays with you) */
  function after(f, t) {
    const m = f.mount, s = f.s, h = s.horse; if (!m || !h || typeof HORSES === "undefined") return [];
    if (m.foot) { h.mounted = true; return []; }   // you climb back on after a fight on foot
    if (m.downTurn || m.hp <= 0) {
      HORSES.knockDown(s, t); h.mounted = true;   // you'll ride again once it's back on its feet
      return [HORSES.downLine(h)];
    }
    if (m.hp < m.hp0) { h.hp = Math.max(1, m.hp); h.hpT = t; return [`🐴 ${h.name} took ${Math.round(m.hp0 - m.hp)} damage (${Math.round(m.hp)}/${m.max}).`]; }
    return [];
  }

  /* a hint on the encounter screen */
  function note(s) {
    if (typeof HORSES === "undefined" || !HORSES.present(s)) return "";
    if (HORSES.downed(s)) return `<p class="sub mountnote hdown">🐴 ${s.horse.name} is downed and limps behind you. You fight on foot.</p>`;
    if (!HORSES.riding(s)) return `<p class="sub mountnote">🐴 ${s.horse.name} is with you, but you're on foot. Ride to open fights with a charge.</p>`;
    return `<p class="sub mountnote">🐴 On horseback: you open with a charge, and one-handers, spears and bows hit harder from the saddle. Foes may go for ${s.horse.name}.</p>`;
  }

  /* fight scene: draw the horse under the rider (FIGHTART calls this with the hero's transform set).
     part "back" = legs, tail, neck and head (behind the rider); part "front" = the barrel and saddle cloth over the rider's legs */
  function drawHorse(g, color, lunge, tt, part = "back") {
    const k = Math.sin(tt * 9) * 2 + lunge * 6, ink = "#1c2128";
    g.save(); g.translate(-4, 0); g.scale(1.5, 1.5);
    g.strokeStyle = ink; g.lineCap = "round";
    if (part === "back") {
      g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(-14, -20); g.lineTo(-16 - k, 0); g.moveTo(-8, -20); g.lineTo(-6 + k * 0.6, 0); g.moveTo(14, -20); g.lineTo(16 + k, 0); g.moveTo(20, -20); g.lineTo(22 - k * 0.6, 0); g.stroke();
      g.fillStyle = color; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(16, -30); g.lineTo(27 + lunge * 4, -46); g.lineTo(35 + lunge * 5, -42); g.lineTo(25, -23); g.closePath(); g.fill(); g.stroke();   // neck and head
      g.fillStyle = ink; g.beginPath(); g.moveTo(18, -32); g.lineTo(27 + lunge * 4, -48); g.lineTo(23, -34); g.fill();   // mane
      g.beginPath(); g.arc(30 + lunge * 4.5, -44, 0.9, 0, 7); g.fill();
      g.lineWidth = 2.2; g.beginPath(); g.moveTo(-18, -28); g.quadraticCurveTo(-28, -24, -25, -10); g.stroke();   // tail
    } else {
      g.fillStyle = color; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(2, -27, 21, 8.5, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#7a2a22"; g.strokeStyle = ink; g.lineWidth = 0.8; g.beginPath(); g.rect(-6, -33, 13, 9); g.fill(); g.stroke();   // saddle cloth
      g.fillStyle = "#d6b25e"; g.fillRect(-6, -26, 13, 1.4);
    }
    g.restore();
  }
  /* is the rider still up at this point of the replay (0..1)? */
  function upAt(f, frac) { const m = f?.mount; if (!m || m.foot) return false; if (!m.downTurn) return true; const n = Math.max(1, f.log.length); return frac < m.downTurn / n; }

  /* has the horse gone down by this point of the replay (0..1)? */
  function downAt(f, frac) { const m = f?.mount; if (!m || m.foot || !m.downTurn) return false; return !upAt(f, frac); }
  /* fight scene: the downed horse lying on its side behind you, ink style, with a "Downed" tag (feet line at y 0) */
  function drawDowned(g, color, tt, label = "Downed") {
    const ink = "#1c2128", br = Math.sin(tt * 1.6) * 0.6;   // slow, heavy breathing
    g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = ink;
    g.lineWidth = 3; g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -2); g.moveTo(0, -8); g.lineTo(12, -6); g.moveTo(22, -7); g.lineTo(34, -3); g.moveTo(26, -9); g.lineTo(38, -8); g.stroke();   // folded legs
    g.fillStyle = color; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(14, -12, 22, 9 + br, 0, 0, 7); g.fill(); g.stroke();   // barrel on its side
    g.beginPath(); g.moveTo(-6, -14); g.lineTo(-22, -6); g.lineTo(-30, -4); g.lineTo(-28, 0); g.lineTo(-16, -1); g.lineTo(-2, -6); g.closePath(); g.fill(); g.stroke();   // neck and head resting on the ground
    g.fillStyle = ink; g.beginPath(); g.moveTo(-6, -15); g.lineTo(-20, -8); g.lineTo(-8, -10); g.fill();   // mane
    g.lineWidth = 1; g.beginPath(); g.moveTo(-25, -3.4); g.lineTo(-22, -3); g.stroke();   // closed eye
    g.lineWidth = 2; g.beginPath(); g.moveTo(35, -14); g.quadraticCurveTo(44, -12, 42, -2); g.stroke();   // tail
    if (label) {
      g.font = "700 9px Cinzel, Georgia, serif"; g.textAlign = "center"; const w = g.measureText(label).width + 10;
      g.fillStyle = "rgba(28,33,40,0.72)"; g.fillRect(8 - w / 2, -36, w, 13); g.fillStyle = "#ff8a7a"; g.fillText(label, 8, -26.5);
    }
    g.restore();
  }

  return { SP_MAX, COST, BONUS, CHARGE, engage, up, strike, enemyTurn, tick, after, note, drawHorse, upAt, downAt, drawDowned };
})();
