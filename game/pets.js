/* pets.js: pet followers. [OURS]
   Remigiusz: "Meeko is an animal, it should count as a pet follower, it can't wear items. Players can have a follower
   and a pet follower." So animals get their own slot beside the follower:
   - s.pet = { id, hp, ts } next to s.follower. Recruiting one never blocks the other; "you already have someone with
     you" only applies within the same slot. Each is dismissed on its own (Character → Follower tab: two sections).
   - Pets wear no equipment: no gear, outfits, trade or loadouts. Old saves where Meeko held or wore things get them
     back in the player's pack (never lost). His bond, loyalty, personal quest and signature move are kept (they live in
     s.folData.meeko, which the bond code reads through view(): a stand-in save whose follower is the pet).
   - A pet carries a little (BASE_CARRY, plus the bond rank bonus) and fights as its own ally: its own turn and health
     bar, knocked down instead of dying, back up after the fight. Pets don't count toward the party's 8 players.
   - Perks: Inspiring / Rally / Thane's Guard / Troll Tamer ("allies") help pets as they help followers; Leadership
     and Troll Tamer's "foltaken" too; the bond perks work through the bond code; Pack Leader (Etiquette) is the pet's own.
   The list holds every animal companion in the game. Summons and thralls are not pets. */
const PETS = (() => {
  // [name, kind for the fight art, base health, base bite, description]
  const LIST = {
    meeko: { name: "Meeko", kind: "dog", hp: 90, dmg: 7, desc: "A loyal stray dog you met on the road. Bites first, asks later." },
  };
  /* [OURS] balance (tests/test_pets.js sim): a pet is a lighter fighter than a follower and draws its share of blows */
  const HP_K = 0.8, DMG_K = 0.5, BASE_CARRY = 50, TAKEN = 0.85;
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const isPet = (id) => !!id && Object.prototype.hasOwnProperty.call(LIST, id);
  const nameOf = (id) => LIST[id]?.name || id;
  const pnum = (s, k) => { try { return typeof PFX !== "undefined" ? PFX.num(s, k) || 0 : 0; } catch (e) { return 0; } };
  const scale = (s) => 1 + 0.05 * ((s?.level || 1) - 1);   // same 5% a level as a plain follower
  const B = () => (typeof BONDS !== "undefined" ? BONDS : null);

  /* the bond code (followerbonds.js, bonds.js) reads s.follower; for a pet it gets this stand-in, where the follower IS
     the pet (and the "what changed in your save" snapshot is the pet's own) */
  function view(s) {
    if (!s || typeof Proxy === "undefined") return s;
    const map = (k) => (k === "follower" ? "pet" : k === "bondSnap" ? "petSnap" : k);
    return new Proxy(s, {
      get: (t, k) => (k === "__petView" ? true : Reflect.get(t, map(k))),
      set: (t, k, v) => { t[map(k)] = v; return true; },
      has: (t, k) => map(k) in t,
      deleteProperty: (t, k) => delete t[map(k)],
    });
  }
  /* a fight seen the same way (signature moves check fight.s.follower) */
  const fightView = (f) => new Proxy(f, { get: (t, k) => (k === "s" ? view(t.s) : Reflect.get(t, k)), set: (t, k, v) => { t[k] = v; return true; } });

  // ---- numbers
  function maxHp(s, id = s?.pet?.id) {
    const p = LIST[id]; if (!p) return 100;
    return Math.round(p.hp * HP_K * scale(s) * (1 + pnum(s, "pethp")));
  }
  function hp(s, t = now()) {
    const p = s?.pet; if (!p || !LIST[p.id]) return 0;
    const max = maxHp(s, p.id), cur = typeof p.hp === "number" ? p.hp : max;
    return Math.min(max, cur + Math.max(0, t - (p.ts || t)) * 0.007 * max);   // [Skyrim] same 0.7%/s as you
  }
  const mood = (s, id) => { try { return B() ? B().moodMult(B().loyalty(view(s), id)) : 1; } catch (e) { return 1; } };
  const dmg = (s, id = s?.pet?.id) => (LIST[id] ? Math.round(LIST[id].dmg * DMG_K * scale(s) * (1 + pnum(s, "petdmg")) * mood(s, id) * 10) / 10 : 0);
  /* share of a blow it still feels: no armour, but Leadership, Troll Tamer and Pack Leader help */
  const taken = (s) => Math.round(TAKEN * (1 - Math.min(0.2, pnum(s, "foltaken"))) * (1 - Math.min(0.3, pnum(s, "pettaken"))) * 100) / 100;
  function carry(s) {
    if (!s?.pet || !LIST[s.pet.id]) return 0;
    let extra = 0; try { if (typeof BONDS2 !== "undefined") extra = BONDS2.carry(view(s)); } catch (e) { extra = 0; }
    return BASE_CARRY + extra;
  }

  // ---- getting and losing one
  function adopt(s, id, t = now()) {
    if (!isPet(id)) return "That's no pet.";
    if (s.pet) return s.pet.id === id ? `${nameOf(id)} is already with you.` : `You already have a pet with you (${nameOf(s.pet.id)}).`;
    s.pet = { id, hp: maxHp(s, id), ts: t };
    try { if (B()) B().bond(view(s), id); } catch (e) { /* bond made later */ }
    return "";
  }
  function dismiss(s) {
    if (!s?.pet) return "No pet is with you.";
    const id = s.pet.id; s.pet = null;
    if (typeof MEEKO !== "undefined" && id === MEEKO.ID && MEEKO.sentAway) return MEEKO.sentAway(s);
    return `${nameOf(id)} trots off.`;
  }

  /* pets wear nothing: anything a pet held or wore goes back into your pack, improvements and all */
  const KEEP = ["temper", "tq", "stolen", "cv", "nm"];
  function returnGear(s, id) {
    const f = s.folData?.[id]; if (!f || !Array.isArray(f.inv) || !f.inv.length || typeof G === "undefined" || typeof D === "undefined") return [];
    const got = [];
    for (const r of f.inv) {
      const it = D.ITEMS[r.item]; if (!it || !(r.qty > 0)) continue;
      const stack = G.STACKABLE ? G.STACKABLE.has(it.slot) : ["potion", "scroll", "soulgem", "tome", "ingredient", "trophy", "poison", "ammo", "food"].includes(it.slot);
      const fix = (rowId) => { const row = G.invRow(s, rowId); if (row) for (const k of KEEP) if (r[k] != null && r[k] !== false) row[k] = r[k]; };
      if (stack) fix(G.give(s, r.item, r.qty, r.charge));
      else for (let i = 0; i < r.qty; i++) fix(G.give(s, r.item, 1, r.charge));
      got.push(it.name + (r.qty > 1 ? ` ×${r.qty}` : ""));
    }
    f.inv = []; f.eq = {};
    return got;
  }
  /* old saves: a pet in the follower slot moves to the pet slot (health, bond, quest kept); its gear comes back to you */
  function migrate(s) {
    if (!s || typeof s !== "object") return s;
    if (s.follower && isPet(s.follower.id)) {
      if (!s.pet) s.pet = { id: s.follower.id, hp: s.follower.hp, ts: s.follower.ts };
      s.follower = null;
    }
    for (const id of Object.keys(LIST)) {
      const got = returnGear(s, id);
      if (got.length && typeof G !== "undefined" && G.note) G.note(s, ` ${nameOf(id)} is a pet now and pets don't wear gear, so what he had went back into your pack: ${got.join(", ")}.`);
    }
    return s;
  }

  // ---- fights
  /* the ally record the fight pushes next to your follower */
  function ally(s, t = now()) {
    const p = s?.pet; if (!p || !LIST[p.id]) return null;
    const L = LIST[p.id];
    return { name: L.name, dmg: dmg(s, p.id), hp: hp(s, t), maxHp: maxHp(s, p.id), pet: true, fid: p.id, kind: L.kind, init: 7 };
  }
  /* its own turn: the signature move once per fight (Pounce after his quest, Snap at Sworn rank), else a bite */
  function turn(fight, al) {
    const s = fight?.s;
    if (s?.pet && al?.fid === s.pet.id && B()) { try { const t = B().signature(fightView(fight), al); if (t) return ` · ${t}`; } catch (e) { /* just bite */ } }
    const d = (al.dmg || 1) * (0.85 + Math.random() * 0.3);
    fight.ehp -= d;
    return ` · ${al.name} ${Math.round(d)}`;
  }
  /* after the fight: health back on the save, up again if knocked down, a little loyalty for a fight won together */
  function after(fight, t = now()) {
    const s = fight?.s; if (!s?.pet || s._test) return [];
    const al = (fight.allies || []).find((a) => a.pet), msgs = [];
    if (fight.petDown) { s.pet.hp = Math.max(1, Math.round(maxHp(s) * Math.min(0.5, 0.1 + pnum(s, "petup")))); s.pet.ts = t; msgs.push(`${fight.petDown} gets back up after the fight, a bit wobbly.`); }
    else if (al) { s.pet.hp = Math.max(1, al.hp); s.pet.ts = t; }
    if (fight.won && (al || fight.petDown) && B()) {
      try {
        const v = view(s), f = B().bond(v, s.pet.id); if (f) f.loyal = Math.min(100, (f.loyal || 50) + 1);
        const l = B().fightLine(v, fight); if (l && Math.random() < 0.5) msgs.push(" " + B().say(v, l, { k: "fight" }));
      } catch (e) { /* keep the result */ }
    }
    return msgs;
  }

  // ---- party: teammates see your pet and fight beside it (it never counts as one of the 8 players)
  function card(s) {
    const p = s?.pet; if (!p || !LIST[p.id]) return null;
    return { id: p.id, n: nameOf(p.id), dmg: dmg(s, p.id), hp: maxHp(s, p.id), cur: Math.round(hp(s)) };
  }
  function cardAllies(c) {
    const p = c?.pet; if (!p || !isPet(p.id)) return [];
    const mx = Math.max(20, +p.hp || 60), cur = Math.max(10, Math.min(mx, +p.cur || mx));
    return [{ name: p.n || nameOf(p.id), dmg: Math.max(1, Math.min(60, +p.dmg || 4)), hp: cur, maxHp: mx, partyPet: true, kind: LIST[p.id].kind, ofUid: c.id }];
  }

  // ---- the Pet section of the Follower tab
  const E = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function panel(s, esc = E) {
    const p = s?.pet;
    if (!p || !LIST[p.id]) {
      const line = typeof MEEKO !== "undefined" && MEEKO.tabLine ? MEEKO.tabLine(s) : "";
      return `<div class="panel pet-panel pet-empty"><h2>Pet</h2><p class="ft-lead">No pet with you.</p>${line ? `<p class="sub ft-meeko">${esc(line)}</p>` : ""}
        <p class="sub">A pet is an animal that travels with you as well as your follower. It fights beside you, carries a little and never dies: when a fight goes badly it's knocked down and gets back up after. Pets don't wear gear.</p>
        <p class="sub">Meeko, a stray dog, turns up on the road now and then.</p></div>`;
    }
    const L = LIST[p.id], mx = maxHp(s, p.id), cur = Math.round(hp(s)), pic = typeof NPCART !== "undefined" ? NPCART.follower(p.id, 44) : "";
    let bond = "";
    try {
      if (B()) {
        const v = view(s);
        bond = `${B().meter(v, esc)}<details class="pet-bond"><summary>Bond with ${esc(L.name)}</summary>${B().tab(v, esc).replace(/data-op="bond"/g, 'data-op="petbond"')}</details>`;
      }
    } catch (e) { bond = ""; }
    return `<div class="panel pet-panel"><h2>Pet</h2>
      <div class="item fol2head pet-head">${pic}<div class="t">${esc(L.name)} <span class="num">${esc(L.kind === "dog" ? "Dog" : L.kind)}</span><span>${cur}/${mx} health · bites ~${Math.round(dmg(s, p.id))} · carries ${carry(s)} for you · goes down instead of dying</span>${bond}</div>
        <button class="btn sm" data-act="fol2" data-op="petdismiss">Dismiss</button></div>
      <p class="sub pet-nogear">${esc(L.desc)} Pets don't wear gear: no weapons, armour or outfits, and you can't trade with them.</p></div>`;
  }
  /* one line on the Character page */
  function summary(s, esc = E) {
    const p = s?.pet; if (!p || !LIST[p.id]) return "";
    return `<button class="item ft-line pet-line" data-act="tabgo" data-id="follower">${typeof NPCART !== "undefined" ? NPCART.follower(p.id, 28) : ""}<div class="t">${esc(nameOf(p.id))} <span class="num">Pet</span><span>${Math.round(hp(s))}/${maxHp(s, p.id)} health · Follower tab ›</span></div></button>`;
  }
  function act(s, d) {
    if (d?.op === "petdismiss") return dismiss(s);
    if (d?.op === "petbond" && B() && s?.pet) return B().act(view(s), d) || "";
    return null;
  }

  // ---- hooks
  let installed = false;
  function install() {
    if (installed) return; installed = true;
    if (typeof G !== "undefined" && G.migrate) { const m0 = G.migrate; G.migrate = (s, ...a) => { const r = m0(s, ...a); try { migrate(r || s); } catch (e) { /* never block a load */ } return r; }; }
    if (typeof G !== "undefined" && G.advance) {   // the bond ticks the follower gets on the road (quest steps, place lines, road loyalty), for the pet
      const adv0 = G.advance;
      G.advance = function (s, t, ...rest) {
        const t0 = s?.trip?.lastTick;
        const out = adv0.call(this, s, t, ...rest);
        try {
          if (s?.follower && isPet(s.follower.id)) migrate(s);
          if (s?.pet && B()) {
            const v = view(s), tt = t ?? now(), dt = t0 != null ? Math.max(0, tt - t0) : 0;
            if (out?.arrived) { const l = B().placeLine(v, out.arrived); if (l && Math.random() < 0.3) B().say(v, l, { k: "place" }); }
            else if (!out?.encounter) B().questTick(v);
            if (typeof BONDS2 !== "undefined" && BONDS2.roadTime && dt > 0 && (s.trip?.status === "travel" || out?.arrived)) BONDS2.roadTime(v, dt, tt);
          }
        } catch (e) { /* never break travel */ }
        return out;
      };
    }
    if (typeof FOL2 !== "undefined") {
      const act0 = FOL2.act;
      FOL2.act = function (s, d) { const r = act(s, d); return r !== null ? r : act0.call(this, s, d); };
      const ca0 = FOL2.cardAllies;
      FOL2.cardAllies = function (c) { return [...(ca0.call(this, c) || []), ...cardAllies(c)]; };
      for (const k of ["give", "equip", "bestEquip"]) {   // belt and braces: nothing is ever handed to or put on a pet
        const f0 = FOL2[k];
        FOL2[k] = function (s, ...rest) { if (s?.follower && isPet(s.follower.id)) return `${nameOf(s.follower.id)} is a pet. Pets don't wear gear.`; return f0.call(this, s, ...rest); };
      }
    }
  }
  install();
  return { LIST, HP_K, DMG_K, BASE_CARRY, TAKEN, isPet, nameOf, view, fightView, maxHp, hp, dmg, taken, carry, adopt, dismiss, returnGear, migrate,
    ally, turn, after, card, cardAllies, panel, summary, act, install };
})();
if (typeof module !== "undefined") module.exports = PETS;
