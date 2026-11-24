/* Tooltips over almost anything. [OURS]
   Remigiusz: "Hover over or tap and hold should pull tooltips over almost anything in the game."
   - Mouse: rest on something for a moment. Finger: hold it for a moment (the tap underneath doesn't fire). Keyboard: tab onto it.
   - One listener on the page. Things opt in with data-tip="plain text" or data-tip-k="kind:id", which a provider turns into
     the tooltip (TIP.register(kind, (id, s, el) => html)). Many things need no markup at all: AUTO below recognises inventory
     rows, shop rows, perk buttons, places, skills, HUD bars and gold by the attributes they already carry, and anything with
     a title="" or an icon-only button's aria-label gets its words shown the same way (so phones see them too).
   - The fight screen uses this too (fighttips.js marks it with data-tip-k="fa:..."; its plain data-tip words show as well).
     Holding a finger on a fight button shows its tooltip and drops the drag that the press started; the lift doesn't cast. */
const TIP = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // the game's modules are script-level `const`s (not window properties): look them up by name, missing ones are undefined
  const MODS = {
    D: () => (typeof D !== "undefined" ? D : undefined), G: () => (typeof G !== "undefined" ? G : undefined), F: () => (typeof F !== "undefined" ? F : undefined),
    CC: () => (typeof CC !== "undefined" ? CC : undefined), TOWNS: () => (typeof TOWNS !== "undefined" ? TOWNS : undefined), MAGIC: () => (typeof MAGIC !== "undefined" ? MAGIC : undefined),
    POWERS: () => (typeof POWERS !== "undefined" ? POWERS : undefined), PERKS: () => (typeof PERKS !== "undefined" ? PERKS : undefined), SKILLINFO: () => (typeof SKILLINFO !== "undefined" ? SKILLINFO : undefined),
    WORLD: () => (typeof WORLD !== "undefined" ? WORLD : undefined), DUNGEONS: () => (typeof DUNGEONS !== "undefined" ? DUNGEONS : undefined), QUESTS: () => (typeof QUESTS !== "undefined" ? QUESTS : undefined),
    WorldMap: () => (typeof WorldMap !== "undefined" ? WorldMap : undefined), TBUI: () => (typeof TBUI !== "undefined" ? TBUI : undefined),
    TOMEINFO: () => (typeof TOMEINFO !== "undefined" ? TOMEINFO : undefined),   // tomeinfo.js: the shop's full spell-tome card
    CHARGE: () => (typeof CHARGE !== "undefined" ? CHARGE : undefined),   // chargebar.js: the charge bar of enchanted weapons and staffs
    COOK: () => (typeof COOK !== "undefined" ? COOK : undefined),
  };
  const g = (n) => { try { return MODS[n] ? MODS[n]() : undefined; } catch { return undefined; } };
  const has = (n) => g(n) !== undefined;
  let stateFn = null;
  const state = () => (stateFn ? stateFn() : DOM && window.__dbg?.save ? window.__dbg.save() : null);
  const P = {};
  function register(kind, fn) { P[kind] = fn; }
  /* the tooltip html for "kind:id" (or null when nobody knows it) */
  function html(key, s = state()) {
    const k = String(key || ""), i = k.indexOf(":"), kind = i < 0 ? k : k.slice(0, i), id = i < 0 ? "" : k.slice(i + 1);
    const fn = P[kind]; if (!fn) return null;
    try { const h = fn(id, s, null); return h || null; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- bits for the providers
  const head = (name, cls = "") => `<b class="tt-h ${cls}">${esc(name)}</b>`;
  const sub = (t) => (t ? `<div class="tt-sub">${esc(t)}</div>` : "");
  const stats = (pairs) => { const p = pairs.filter((x) => x && x[1] != null && x[1] !== ""); return p.length ? `<div class="tt-stats">${p.map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join("")}</div>` : ""; };
  const line = (t, cls = "") => (t ? `<p class="${cls}">${esc(t)}</p>` : "");
  const hint = (t) => (t ? `<p class="tt-hint">${esc(t)}</p>` : "");
  const cleanPerk = (t) => String(t || "").replace(/\s*\[[^\]]*\]\s*$/, "");
  const known = (s, n) => !!s && (s.discovered?.includes(n) || (["city", "town"].includes(g("WORLD")?.places?.[n]?.[2]) && !g("WORLD")?.hidden?.has?.(n)));
  const KIND = { city: "City", town: "Town", farm: "Farm", dungeon: "Dungeon", fort: "Fort", camp: "Camp", lair: "Dragon lair", stone: "Standing stone", shrine: "Shrine", landmark: "Landmark" };

  // ---- items (a bare item id, or one of your pack rows with its temper, charge and name)
  function itemHTML(itemId, s, r = null) {
    const D_ = g("D"), G_ = g("G"); const it = D_?.ITEMS?.[itemId]; if (!it) return null;
    const CC_ = g("CC"), tier = CC_ ? CC_.tier(itemId, r) : "common";
    const name = (r?.tq && g("TOWNS")?.QUALITY ? g("TOWNS").QUALITY[r.tq] + " " : "") + it.name + (r?.nm ? ` “${r.nm}”` : "");
    const kind = it.slot === "weapon" ? `${it.hands === 2 ? "Two-handed" : "One-handed"} ${it.skill === "Archery" ? "bow" : "weapon"} · ${it.skill}`
      : (G_?.ARMOR_SLOTS || []).includes(it.slot) ? `${it.type ? it.type[0].toUpperCase() + it.type.slice(1) + " " : ""}${it.slot === "chest" ? "body armor" : it.slot}`
      : { potion: "Potion", poison: "Poison", food: "Food", ingredient: "Ingredient", tome: "Spell tome", scroll: "Scroll", soulgem: "Soul gem", ammo: "Ammo", material: "Crafting material", valuable: "Valuable", trophy: "Trophy", recipe: "Forge recipe", misc: "Item" }[it.slot] || "Item";
    const q = r?.qty || 1;
    const st = [];
    if (it.slot === "weapon") st.push(["Damage", it.damage + (r?.temper ? ` +${r.temper}` : "")]);
    if ((G_?.ARMOR_SLOTS || []).includes(it.slot)) st.push(["Armor", (it.armor || 0) + (r?.temper ? ` +${r.temper}` : "")]);
    if (it.slot === "ammo") st.push(["Damage", it.damage]);
    st.push(["Weight", +((it.weight || 0) * q).toFixed(2)], ["Value", it.value ?? 0]);
    if (q > 1) st.push(["Count", q]);
    const L = [];
    const enL = typeof ENCH !== "undefined" && ENCH.lines ? ENCH.lines(it) : null;   // plain words for what the enchantment does (enchanting.js)
    const wn = it.enchant && typeof ENCH !== "undefined" ? ENCH.WEAPON?.[it.enchant.effect]?.[0] : null;   // the enchantment's name first
    if (it.enchant) L.push(`✦ ${wn && enL?.[0] ? `${wn} · ` : ""}${enL?.[0] || `${it.enchant.magnitude} ${it.enchant.effect} damage per hit`}${r && !g("CHARGE") ? ` · charge ${Math.round(100 * (r.charge || 0) / it.enchant.capacity)}%` : ""}`);
    if (it.staff && D_.SPELLS[it.staff.spell]) L.push(`✦ Casts ${D_.SPELLS[it.staff.spell].name} instead of swinging`);
    if (it.aenchant && enL?.length) { const ae = [it.aenchant, ...(it.aenchant.more || [])]; L.push(...enL.map((x, i) => `✦ ${ae[i]?.name && !x.startsWith(ae[i].name) ? `${ae[i].name} · ` : ""}${x}`), "While worn."); }   // name · what it does
    else if (it.aenchant) L.push(`✦ ${[it.aenchant, ...(it.aenchant.more || [])].map((e) => (e.key.startsWith("dae:") ? e.name : `${e.name} ${e.mag}`)).join(" · ")} while worn`);
    if (it.desc) L.push(it.desc);
    if (it.effects) L.push(it.effects.map(([e, m, d]) => `${e} ${m}${d * 5 >= 60 ? ` for ${Math.round(d * 5 / 60)} min` : ""}`).join(" · "));
    else if (it.restore) L.push(`Restores ${it.restore[1]} ${it.restore[0]}`);
    else if (it.cures) L.push("Cures diseases");
    let tomeCard = "";
    const TI = g("TOMEINFO");
    if (TI && s && it.slot === "tome") { try { if (!TI.isTome || TI.isTome(itemId)) tomeCard = TI.html(s, itemId, { head: false }) || ""; } catch { tomeCard = ""; } }
    if (tomeCard) { /* the tome card says what it teaches */ }
    else if ((it.slot === "tome" || it.slot === "scroll") && D_.SPELLS[it.spell]) {
      const sp = D_.SPELLS[it.spell], M = g("MAGIC");
      L.push(`${it.slot === "tome" ? "Teaches" : "Casts"} ${sp.name}: ${sp.level || "Novice"} ${sp.school}${M?.describe ? ` · ${M.describe(sp)}` : ""}${s && it.slot === "tome" && s.spells?.includes(it.spell) ? " (you know it)" : ""}`);
    }
    if (it.slot === "scroll" && s && D_.SPELLS[it.spell]) { try { const ps = g("MAGIC").nums(s, it.spell, false); if (ps.length) L.push("For you: " + ps.map((p) => p.t).join(" · ") + " · no magicka"); } catch { /* old magic.js */ } }
    if (it.slot === "weapon" && !it.staff && it.damage) {   // what it really hits for in your hands (skill and perks)
      const F_ = g("F"), dmg = (() => { try {
        const sk = it.skill, lv = G_.skill(s, sk), P = (k) => (G_.P ? G_.P(s, k) : 0);
        const perk = { "One-Handed": 0.2 * P("armsman"), "Two-Handed": 0.2 * P("barbarian"), "Archery": 0.2 * P("overdraw"), "Spear": 0.15 * P("long_reach") }[sk] || 0;
        return Math.round(F_.weaponDamage(it.damage + (r?.temper || 0), lv, sk === "Archery") * (1 + perk));
      } catch { return 0; } })();
      L.push(dmg && s ? `Hits for about ${dmg} with your ${it.skill} skill and perks` : `${it.damage} base damage, more as your ${it.skill} skill grows`);
    }
    if (it.slot === "ammo") L.push(`Shot from a ${/bolt/.test(itemId) ? "crossbow" : "bow"}: ${it.damage} damage added to each shot`);
    if (["potion", "scroll"].includes(it.slot) && (it.restore || D_.SPELLS[it.spell])) st.push(["In a fight", `${it.slot === "scroll" ? 2 : 1} AP`]);
    if (it.slot === "soulgem") L.push(`Holds ${it.charge} charge for recharging enchanted weapons`);
    if (it.slot === "ingredient" && s && g("TOWNS")?.INGREDIENT_FX?.[itemId]) { const T = g("TOWNS"); L.push("Effects: " + T.INGREDIENT_FX[itemId][1].map((e, i) => (T.known(s, itemId)[i] ? e : "?")).join(", ")); }
    if (it.slot === "material") L.push("Used at the forge to improve gear.");
    if (it.dish) L.push("A new meal replaces the last one's effect.");
    if (!L.length && !tomeCard) {   // nothing said yet: at least what it's for
      const CK = g("COOK"), uses = CK?.RECIPES ? Object.values(CK.RECIPES).filter((x) => x[1].some(([i]) => i === itemId || (i === "fish" && itemId.startsWith("fish_")))) : [];
      if (uses.length) L.push(`Cook it into: ${uses.slice(0, 3).map((x) => `${x[0]} (${x[3]})`).join(", ")}`);
      else if (it.slot === "food") L.push("A cooking ingredient: cook it at an inn's pot or your campfire.");
      else if (itemId === "fishing_rod") L.push("Lets you fish where there's water nearby.");
      else if (it.slot === "trophy") L.push(it.quest ? "Someone wants this back: it stays with you until you hand it in." : "Proof of a great deed: keep it, or sell it to a merchant.");
      else if (it.slot === "valuable") L.push(`Worth about ${it.value ?? 0} gold to any merchant.`);
      else L.push(`No use in a fight. A merchant pays about ${it.value ?? 0} gold for it.`);
    }
    if (r?.stolen) L.push("✋ Stolen. Only a fence will buy it.");
    // better or worse than what you wear (the same sums as the ▲/▼ marks in lists)
    let cmp = "";
    if (s && G_?.equipment && (G_.SLOTS || []).includes(it.slot)) {
      const w = G_.equipment(s)[it.slot], wit = w && D_.ITEMS[w.item];
      const stat = (x, rr) => (x.slot === "weapon" ? x.damage : x.armor || 0) + (rr?.temper || 0);
      if (w && r && w.id === r.id) cmp = `<p class="tt-eq">◆ You're wearing this</p>`;
      else if (wit && (it.slot !== "weapon" || wit.skill === it.skill)) { const a = stat(it, r), b = stat(wit, w), word = it.slot === "weapon" ? "damage" : "armor"; cmp = `<p class="${a > b ? "tt-up" : a < b ? "tt-dn" : "tt-hint"}">${a > b ? "▲" : a < b ? "▼" : "="} ${a} ${word} vs ${b} on your ${esc(wit.name)}</p>`; }
      else if (!w) cmp = `<p class="tt-up">Nothing worn there yet</p>`;
    }
    return head(name, "q-" + tier) + sub(kind + (CC_ && tier !== "common" ? ` · ${CC_.TIER_NAME[tier]}` : "")) + stats(st) + L.map((x) => line(x)).join("") + (g("CHARGE") ? g("CHARGE").detail(itemId, r, s) : "") + (tomeCard ? `<div class="tt-tome">${tomeCard}</div>` : "") + cmp;
  }
  register("item", (id, s) => itemHTML(id, s));
  register("inv", (id, s) => { const r = s?.inv?.find((x) => String(x.id) === String(id)); return r ? itemHTML(r.item, s, r) : null; });
  register("slot", (slot, s) => {   // a paper-doll slot: what's in it
    const G_ = g("G"), w = s && G_?.equipment ? G_.equipment(s)[slot] : null;
    if (w) return itemHTML(w.item, s, w);
    const nm = { weapon: "Weapon", shield: "Shield or left hand", head: "Head", chest: "Body", hands: "Hands", feet: "Feet", ammo: "Arrows" }[slot] || slot;
    return head(nm) + line("Nothing here.") + hint("Tap to choose what to wear.");
  });

  // ---- magic: spells, shouts, powers, active effects (ids as in the Magic menu: spell:flames, shout:..., power:race, fx:...)
  register("spell", (id, s) => {
    const sp = g("D")?.SPELLS?.[id]; if (!sp) return null;
    const M = g("MAGIC"), G_ = g("G");
    const fail = s && M?.failChance ? M.failChance(s, id) : 0;
    const cost = sp.kind === "utility" ? null : s && G_?.spellCost ? G_.spellCost(s, sp) : null;
    return head(sp.name, `sch-${String(sp.school).toLowerCase()}`) + sub(`${sp.level || "Novice"} ${sp.school}${sp.element ? ` · ${sp.element}` : ""}`)
      + line(M?.describe ? M.describe(sp) : "") + (s && M?.infoHTML && sp.kind !== "utility" ? M.infoHTML(s, id) : stats([["Magicka", cost]]))
      + (fail ? `<p class="tt-dn">⚠ Above your ${esc(sp.school)} skill: costs more and fizzles ${Math.round(fail * 100)}% of the time</p>` : "")
      + (s && !s.spells?.includes(id) ? hint("You don't know this spell yet.") : "");
  });
  register("shout", (id, s) => {
    const PW = g("POWERS"), sh = PW?.SHOUTS?.[id]; if (!sh) return null;
    const [name, words, cds, desc] = sh, lv = s ? PW.level(s, id) : 0;
    return head(name, "sch-shout") + sub(`Shout · ${words.map((w) => (s && PW.known(s, w) ? (PW.unlocked(s, w) ? w : w + "🔒") : "···")).join(" ")}`) + line(desc)
      + (lv ? stats([["Words", lv], ["Cooldown", `${cds[lv - 1]} s`]]) : hint("Learn its words at word walls; unlock each with a dragon soul."));
  });
  register("power", (id, s) => {
    const PW = g("POWERS"); if (!PW || !s) return null;
    if (id === "race") { const r = PW.RACE[s.race]; return r ? head(r[0], "sch-power") + sub("Racial power · once a day") + line(r[1]) + (PW.powerReady(s, "race") ? hint("Ready") : hint("Used today")) : null; }
    if (id === "stone" && s.stone) { const r = PW.STONES[s.stone]; return head(r[0], "sch-power") + sub("Standing stone") + line(r[1]); }
    if (id === "beast") return head("Beast Form", "sch-power") + sub("Werewolf · once a day") + line("Turn into a werewolf for the next fight: big claws, big health.");
    if (id === "lord") return head("Vampire Lord", "sch-power") + sub("Vampire · once a day") + line("Take your Vampire Lord shape for the next fight.");
    return null;
  });
  register("fx", (id, s) => {   // active effects and blessings
    if (!s) return null;
    const PW = g("POWERS"), t = g("G")?.now ? g("G").now() : 0;
    if (id === "rested") return head((s.restBonus || 0.05) >= 0.1 ? "Well Rested" : "Rested") + line(`Skills grow ${Math.round((s.restBonus || 0.05) * 100)}% faster.`) + stats([["Left", `${Math.max(0, Math.ceil((s.rested - t) / 60))} min`]]);
    if (id === "stone" && s.stone && PW) return head(PW.STONES[s.stone][0]) + sub("Standing stone blessing") + line(PW.STONES[s.stone][1]);
    if (id === "souls") return head(`Dragon souls: ${s.souls || 0}`) + line("Each soul unlocks one Word of Power. Kill dragons to absorb more.");
    if (id.startsWith("gear:")) { const [, from, ...k] = id.split(":"); return head(from) + sub("Worn enchantment") + line(`${k.join(":")} while you wear it.`); }
    const name = id.split(":")[0], f = (s.fx || []).find((x) => x.name === name && x.until > t);
    return f ? head(f.name) + stats([["Strength", f.mag], ["Left", `${Math.max(0, Math.ceil((f.until - t) / 60))} min`]]) + hint("From a potion, food, a shrine or a blessing.") : null;
  });

  // ---- perks and skills
  register("perk", (id, s) => {
    const PK = g("PERKS"), p = PK?.BY_ID?.[id]; if (!p) return null;
    const sk = Object.keys(PK.TREES).find((k) => PK.TREES[k].some(([x]) => x === id)) || "";
    const rk = s ? PK.rank(s, id) : 0, err = s && rk < p.ranks ? PK.canTake(s, id) : "";
    const need = rk < p.ranks ? `Needs ${sk} ${p.req[rk]}${p.needs.length ? ` and ${p.needs.map((x) => PK.BY_ID[x]?.name || x).join(" or ")}` : ""}` : "";
    return head(p.name) + sub(`${sk} perk${p.ranks > 1 ? ` · rank ${rk}/${p.ranks}` : rk ? " · taken" : ""}`)
      + line(s && PK.nowText ? PK.nowText(s, id) : cleanPerk(p.desc)) + (rk >= p.ranks ? `<p class="tt-up">✓ You have this perk</p>` : `<p class="${err ? "tt-dn" : "tt-up"}">${esc(err ? need : "You can take it now")}</p>`);
  });
  register("skill", (sk, s) => {
    const SI = g("SKILLINFO"), F_ = g("F"); if (!s?.skills?.[sk]) return null;
    const i = SI?.get ? SI.get(s, sk) : null, v = s.skills[sk], need = F_ ? F_.skillXpNeeded(sk, v.lvl) : 0;
    const PK = g("PERKS"), taken = PK?.TREES?.[sk] ? PK.TREES[sk].filter(([id]) => PK.rank(s, id)).length : 0;
    const lvl = g("G")?.skill ? g("G").skill(s, sk) : v.lvl;
    return head(sk) + sub(`Skill · level ${lvl}${lvl !== v.lvl ? ` (${v.lvl} + ${lvl - v.lvl} from gear and blessings)` : ""}`)
      + line(i?.what || "") + stats([["Progress", need ? `${Math.round(100 * Math.min(1, v.xp / need))}%` : ""], ["Perks", PK?.TREES?.[sk] ? `${taken}/${PK.TREES[sk].length}` : ""]])
      + (i?.raise?.[0] ? hint("Raise it: " + i.raise[0]) : "");
  });

  // ---- places, quests, people
  register("place", (n, s) => {
    const W_ = g("WORLD"), p = W_?.places?.[n]; if (!p) return null;
    const G_ = g("G"), DG = g("DUNGEONS");
    if (s && !known(s, n)) return head("Something nearby") + line("You haven't found this place yet. Go and look.");
    const bits = [];
    if (s?.location === n) bits.push("You're here.");
    if (s?.cleared?.[n]) bits.push(DG?.enterable?.(n) && DG.refillLeft?.(s, n) > 0 ? "Cleared. It fills up again later." : "Cleared.");
    else if (DG?.enterable?.(n)) bits.push("A dungeon you can go inside.");
    const shops = G_?.shopTypes ? G_.shopTypes(n) : [];
    if (shops.length) bits.push(`Shops: ${shops.join(", ")}`);
    let far = "";
    if (s && G_?.pxDist && s.location !== n) { const d = G_.pxDist([s.x, s.y], p); far = d > 0 ? `${Math.round(d)} paces away` : ""; }
    return head(n) + sub(`${KIND[p[2]] || "Place"}${G_?.holdAt ? ` · ${G_.holdAt(p)}` : ""}`) + bits.map((b) => line(b)).join("") + (far ? hint(far + (s?.location === n ? "" : " · tap to pick it on the map")) : "");
  });
  register("quest", (id, s) => {
    const Q = g("QUESTS"), def = Q?.L?.[id]; if (!def) return null;
    const v = s?.quests?.[id], st = v && def.stages ? def.stages[Math.min(v.stage || 0, def.stages.length - 1)] : null;
    const n = st && Q.target ? Q.target(st) : null, rec = Q.recOf && v ? Q.recOf(id, v.stage || 0) : 0;
    const r = st?.reward, rew = r ? [r.gold ? `${r.gold} gold` : "", ...(r.items || []).map((x) => g("D")?.ITEMS?.[x]?.name || x), r.title ? `the title “${r.title}”` : ""].filter(Boolean).join(", ") : "";
    return head(def.name) + sub(def.giver || "Quest") + (st ? line(`◆ ${st.title}: ${st.text}`) : "") + stats([["Go to", n || ""], ["Recommended level", rec > 1 ? rec : ""], ["Reward", rew]]);
  });
  register("follower", (id, s) => {
    const T = g("TOWNS"), f = T?.FOLLOWERS?.[id]; if (!f) return null;
    const mine = s?.follower?.id === id;
    return head(f[0]) + sub(`Follower${f[1] ? ` · from ${f[1]}` : ""}`) + line(f[5] || "")
      + (mine && T.followerHp ? stats([["Health", `${Math.round(T.followerHp(s))}/${T.followerMax(s, id)}`]]) : f[2] ? stats([["Hire", `${f[2]} gold`]]) : "")
      + hint("Followers fight beside you, carry things for you and get knocked down instead of dying.");
  });
  register("player", (id, s) => {
    const dbg = DOM ? window.__dbg : null;
    const o = s && s.id === id ? { ...s, loc: s.location || "On the road" } : (dbg?.others?.() || []).find((x) => x.id === id) || (dbg?.party?.()?.members || []).find?.((x) => x.id === id);
    if (!o) return null;
    const race = g("D")?.RACES?.[o.race]?.name || "";
    return head(o.name || "Traveller") + sub(`${o.level ? `Level ${o.level} ` : ""}${race}`.trim() || "Player") + line(o.loc || "") + (o.bounty ? `<p class="tt-dn">Wanted: ${esc(o.bounty)} gold bounty</p>` : "");
  });

  // ---- you: bars, level, gold
  register("stat", (k, s) => {
    const G_ = g("G"), F_ = g("F"); if (!s || !G_) return null;
    if (k === "health") return head("Health", "tt-hp") + stats([["Now", Math.round(G_.curHealth(s))], ["Most", G_.maxHealth(s)]]) + line("At zero you're knocked out. Health doesn't come back by itself: potions, food, Healing spells, a bed or a shrine bring it back.");
    if (k === "magicka") return head("Magicka", "tt-mp") + stats([["Most", G_.maxMagicka(s)]]) + line("Spells cost magicka. It fills up again after every fight.");
    if (k === "stamina") return head("Stamina", "tt-sp") + stats([["Most", G_.maxStamina(s)]]) + line("Power attacks and bashes cost stamina. It fills up again after every fight.");
    if (k === "carry") return head("Carry weight") + stats([["Carrying", Math.round(G_.carried(s))], ["Most", G_.capacity(s)]]) + line(G_.overweight(s) ? "Too heavy: you walk slowly. Sell, store or drop something." : "Go over it and you walk slowly.");
    if (k === "level") { const need = F_ ? F_.charXpNeeded(s.level) : 0; return head(`Level ${s.level}`) + stats([["Next level", need ? `${Math.round(100 * Math.min(1, (s.charXp || 0) / need))}%` : ""], ["Perk points", g("PERKS")?.pointsLeft ? g("PERKS").pointsLeft(s) : ""]]) + line("Every skill you raise moves you toward the next level. Each level gives a perk point and +10 health, magicka or stamina."); }
    return null;
  });
  register("cur", (k, s) => {
    if (!s) return null;
    if (k === "gold") return head(`${s.gold} gold`, "tt-gold") + line("Earned from loot, quests, jobs and selling. Spent in shops, on trainers, horses and homes. In a party, gold is split evenly.");
    if (k === "souls") return head(`Dragon souls: ${s.souls || 0}`) + line("Kill dragons to absorb their souls. Each one unlocks a Word of Power.");
    return null;
  });

  // ---------------------------------------------------------------- what an element shows (nearest match wins)
  const AUTO = [   // [css selector, el => key]
    [".sky-row[data-act=skysel][data-id]", (el) => { const id = el.dataset.id, s = state(); if (id.includes(":")) return id; if (s?.skills?.[id]) return "skill:" + id; return "inv:" + id; }],
    ["[data-act=dollslot][data-slot]", (el) => "slot:" + el.dataset.slot],
    ["[data-act=dolleq][data-id],[data-act=dolloff][data-id]", (el) => "inv:" + el.dataset.id],
    ["[data-act=perk][data-id]", (el) => "perk:" + el.dataset.id],
    ["[data-act=skinfo][data-id],[data-twa=skill][data-id],[data-twa=starsof][data-id],[data-act=pskill][data-id]", (el) => "skill:" + el.dataset.id],
    ["[data-act=go][data-place],[data-act=qmap][data-place],.cm[data-place]", (el) => (el.dataset.place && !el.dataset.place.startsWith("__") ? "place:" + el.dataset.place : null)],
    [".qhead", (el) => { const c = el.closest(".qcard[id^='q-']"); return c ? "quest:" + c.id.slice(2) : null; }],
    [".fol2head", () => { const s = state(); return s?.follower ? "follower:" + s.follower.id : null; }],
    [".hb.hp", () => "stat:health"], [".hb.mp", () => "stat:magicka"], [".hb.sp", () => "stat:stamina"], [".carry", () => "stat:carry"],
    ["#lvlb", () => "stat:level"], ["#goldv,.sky-foot .gold", () => "cur:gold"],
    [".item", (el) => {   // a list row: the one thing it's about (buy an item, take a perk, travel somewhere, a player)
      const one = (sel) => { const l = el.querySelectorAll(sel); return l.length === 1 ? l[0] : null; };
      const items = new Set([...el.querySelectorAll("[data-item]")].map((x) => x.dataset.item)); if (items.size === 1) return "item:" + [...items][0];   // a shop row (Buy, ×20)
      let b = one("[data-act=perk][data-id]"); if (b) return "perk:" + b.dataset.id;
      b = one("[data-act=hire][data-id]"); if (b) return "follower:" + b.dataset.id;
      b = el.querySelector("[data-act=trade][data-id],[data-act=attack][data-id],[data-act=pick][data-id]"); if (b) return "player:" + b.dataset.id;
      b = one("[data-act=go][data-place]"); if (b && !b.dataset.place.startsWith("__")) return "place:" + b.dataset.place;
      b = one("[data-act=sell][data-id]"); if (b) return "inv:" + b.dataset.id;
      return null;
    }],
  ];
  const AUTO_SEL = AUTO.map(([sel]) => sel).join(",");
  const SKIP = "input,textarea,select,option,#tip,.tip";
  /* a plain label that is just an item's or a spell's name ("Scroll of Fast Healing", "Potion of Healing, 3 left"):
     the full tooltip for that thing, so icon-only buttons (the favourites wheel...) say what it does, not only its name */
  let byName = null;
  function keyForText(t) {
    const D_ = g("D"); if (!D_?.ITEMS || !t) return null;
    if (!byName) {
      byName = new Map();
      for (const [id, sp] of Object.entries(D_.SPELLS || {})) if (sp?.name && !byName.has(sp.name.toLowerCase())) byName.set(sp.name.toLowerCase(), "spell:" + id);
      for (const [id, it] of Object.entries(D_.ITEMS)) if (it?.name) byName.set(it.name.toLowerCase(), "item:" + id);   // an item wins over a spell of the same name
    }
    const s0 = String(t).trim(), cut = s0.replace(/\s*(?:[,·(].*|×\s*\d+.*|x\d+)$/, "").trim().toLowerCase();
    return byName.get(s0.toLowerCase()) || byName.get(cut) || null;
  }
  const plain = (t) => { const k = keyForText(t); return k && html(k) ? { k } : { t }; };
  /* what to show for this element (or null) */
  function keyOf(el) {
    if (el.dataset?.tipK) return { k: el.dataset.tipK };
    if (el.dataset?.tip != null && el.dataset.tip !== "") return plain(el.dataset.tip);
    if (el.dataset?.tipt) return plain(el.dataset.tipt);
    if (el.matches?.(AUTO_SEL)) for (const [sel, fn] of AUTO) if (el.matches(sel)) { const k = fn(el); if (k && html(k)) return { k }; }
    const ti = el.getAttribute?.("title"); if (ti) { el.dataset.tipt = ti; el.removeAttribute("title"); return plain(ti); }   // the browser's own title box would cover ours
    const al = el.getAttribute?.("aria-label");
    if (al && el.matches?.("button,[role=button],a,.iconbtn,[role=img]")) { const k = keyForText(al); if (k && html(k)) return { k }; }   // a slot labelled with an item or spell name
    const vis = (el.textContent || "").trim();
    if (al && el.matches?.("button,[role=button],a,.iconbtn") && vis.length <= 3 && vis.toLowerCase() !== al.trim().toLowerCase()) return { t: al };   // icon-only buttons
    return null;
  }
  function find(target) {
    let small = null;   // a little badge's words (▲ better than worn, ✦ enchanted...): shown on top of the row's own tooltip when there is one
    for (let el = target, d = 0; el && el.nodeType === 1 && d < 14; el = el.parentElement, d++) {
      if (el === document.body || el === document.documentElement) break;
      if (el.matches?.(SKIP)) return null;
      const k = keyOf(el); if (!k) continue;
      if (k.k) return small ? { el, k: k.k, note: small.t } : { el, ...k };
      if (small) return small;
      if (el.dataset?.tipt || (!el.dataset?.tip && el.getAttribute?.("aria-label"))) small = { el, ...k }; else return { el, ...k };
    }
    return small;
  }

  // ---------------------------------------------------------------- the box
  let box = null, cur = null, showT = 0, hideT = 0, watchT = 0, press = null, swallowUntil = 0, lastKey = false, lastXY = null, areaHit = null;
  const AREAS = [];   // [selector, (el, x, y) => { k, rect } | null]: mouse-only spots inside a canvas (map places)
  function area(sel, fn) { AREAS.push([sel, fn]); }
  let probe = null;
  function insets() {   // the phone's notch and gesture bar (safe areas)
    if (!probe) { probe = document.createElement("div"); probe.className = "tt-probe"; probe.setAttribute("aria-hidden", "true"); }
    if (!probe.isConnected) document.body.appendChild(probe);
    const cs = getComputedStyle(probe), n = (v) => parseFloat(cs[v]) || 0;
    return { t: n("paddingTop"), r: n("paddingRight"), b: n("paddingBottom"), l: n("paddingLeft") };
  }
  function place(rect) {
    const vv = window.visualViewport, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight, ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0;
    const ins = insets(), M = 8, L = ox + ins.l + M, R = ox + vw - ins.r - M, T = oy + ins.t + M, B = oy + vh - ins.b - M;
    box.style.maxWidth = Math.max(160, Math.min(340, R - L)) + "px";
    box.style.left = "0px"; box.style.top = "0px";
    const tw = box.offsetWidth, th = box.offsetHeight, gap = 10;
    const cx = rect.left + rect.width / 2;
    let x = Math.max(L, Math.min(R - tw, cx - tw / 2));
    const above = rect.top - gap - th, below = rect.bottom + gap;
    let y, side;
    if (above >= T) { y = above; side = "above"; }
    else if (below + th <= B) { y = below; side = "below"; }
    else { side = rect.top - T > B - rect.bottom ? "above" : "below"; y = side === "above" ? T : Math.max(T, B - th); }   // no room either way: as far from the finger as fits
    y = Math.max(T, Math.min(B - th, y));
    box.style.left = Math.round(x) + "px"; box.style.top = Math.round(y) + "px";
    box.style.setProperty("--ax", Math.round(Math.max(12, Math.min(tw - 12, cx - x))) + "px");
    box.classList.toggle("tt-above", side === "above"); box.classList.toggle("tt-below", side === "below");
  }
  function show(hit, rect = null) {
    if (!DOM) return;
    const main = hit.k ? html(hit.k) : hit.t ? `<p class="tt-plain">${esc(hit.t)}</p>` : null;
    const body = main && hit.note ? `<p class="tt-note">${esc(hit.note)}</p>` + main : main;
    if (!body) return hide();
    if (!box) { box = document.createElement("div"); box.id = "tip"; box.className = "tip"; box.setAttribute("role", "tooltip"); }
    if (!box.isConnected) document.body.appendChild(box);
    box.innerHTML = body;
    cur = hit; hit.rect = rect;
    place(rect || hit.el.getBoundingClientRect());
    box.classList.add("on");
    if (hit.el?.id) hit.el.setAttribute("aria-describedby", "tip");
    clearInterval(watchT); watchT = setInterval(watch, 300);
  }
  function hide() {
    clearTimeout(showT); clearTimeout(hideT); clearInterval(watchT);
    if (cur?.el?.getAttribute?.("aria-describedby") === "tip") cur.el.removeAttribute("aria-describedby");
    cur = null; areaHit = null; box?.classList.remove("on");
  }
  /* screens redraw often: follow the thing to its new copy, or let go */
  function watch() {
    if (!cur) return clearInterval(watchT);
    if (cur.rect || cur.el.isConnected) return;
    const at = press ? [press.x, press.y] : lastXY;   // the finger still held, or the mouse resting
    if (at) { const t = document.elementFromPoint(at[0], at[1]), h = t && find(t); if (h) { if (press) press.h = h; return show(h); } }
    hide();
  }
  const isTouch = (e) => e.pointerType === "touch" || e.pointerType === "pen";
  function areaAt(e) {
    for (const [sel, fn] of AREAS) { const el = e.target.closest?.(sel); if (el) { try { const r = fn(el, e.clientX, e.clientY); if (r) return r; } catch { /* not ready */ } return null; } }
    return null;
  }
  // mouse
  function over(e) {
    if (isTouch(e) || press) return;
    lastKey = false; lastXY = [e.clientX, e.clientY];
    const h = find(e.target);
    if (h && cur && h.el === cur.el) return;
    clearTimeout(showT);
    if (!h) { if (cur && !cur.rect) hideT = setTimeout(hide, 80); return; }
    clearTimeout(hideT);
    if (cur) show(h); else showT = setTimeout(() => show(h), 350);   // sweeping along a list: no wait after the first
  }
  function moveMouse(e) {
    if (isTouch(e)) return;
    lastXY = [e.clientX, e.clientY];
    if (!AREAS.length || !e.target.closest) return;
    const a = areaAt(e);
    if (!a) { if (areaHit) { areaHit = null; hide(); } return; }
    if (areaHit && areaHit.k === a.k) return;
    areaHit = a; clearTimeout(showT);
    const hit = { el: e.target, k: a.k };
    if (cur) show(hit, a.rect); else showT = setTimeout(() => { if (areaHit === a) show(hit, a.rect); }, 350);
  }
  function out(e) { if (!isTouch(e) && !e.relatedTarget) hide(); }
  // finger: hold
  const HOLD = 450;
  function down(e) {
    if (!isTouch(e)) { clearTimeout(showT); if (cur) hide(); return; }
    if (cur) hide();
    clearTimeout(press?.timer); press = null;
    if (e.isPrimary === false) return;
    const t = e.target;
    if (!t.closest || t.closest("canvas#map, #map")) return;                                               // the map: holding drops a pin
    if (t.closest("#tw") && !t.closest("button, a, [data-act], [data-twgo], [data-twq], [data-twa]")) return;   // the compass: holding opens the favourites wheel
    const h = find(t); if (!h) return;
    press = { h, x: e.clientX, y: e.clientY, id: e.pointerId, shown: false };
    press.timer = setTimeout(() => {
      if (!press) return;
      let hh = h;
      if (!hh.el.isConnected) { const t2 = document.elementFromPoint(press.x, press.y); hh = t2 && find(t2); }   // the screen redrew under the finger (HUD bars do): use the new copy
      if (!hh) { press = null; return; }
      press.shown = true; show(hh);
      if (hh.el?.closest?.("#tbf")) { try { g("TBUI")?.look?.(); } catch { /* older tbui */ } }   // a hold is a look, not a drag
      if (cur) { try { navigator.vibrate?.(8); } catch { /* not allowed */ } }
    }, HOLD);
  }
  function move(e) {
    if (!press || e.pointerId !== press.id || press.shown) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; }
  }
  function up(e) {
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    if (press.shown) { swallowUntil = Date.now() + 700; clearTimeout(hideT); hideT = setTimeout(hide, 1800); }   // the lift doesn't press what's under it; the box stays a moment to finish reading
    press = null;
  }
  function eatClick(e) {
    if (Date.now() < swallowUntil) { e.stopImmediatePropagation(); e.preventDefault(); swallowUntil = 0; return true; }
    return false;
  }
  function noMenu(e) { if (press || Date.now() < swallowUntil) e.preventDefault(); }   // Android's long-press menu / text selection
  // keyboard
  function focusIn(e) {
    if (!lastKey) return;
    const h = find(e.target); clearTimeout(showT);
    if (h) showT = setTimeout(() => show(h), 300); else hide();
  }
  function key(e) { if (e.key === "Escape" && cur) { hide(); return; } if (e.key === "Tab" || e.key.startsWith("Arrow")) lastKey = true; }

  function mount() {
    if (!DOM || mount.done) return; mount.done = true;
    const o = { capture: true, passive: true };
    document.addEventListener("pointerover", over, o);
    document.addEventListener("pointerout", out, o);
    document.addEventListener("pointermove", (e) => { moveMouse(e); move(e); }, o);
    document.addEventListener("pointerdown", down, o);
    document.addEventListener("pointerup", up, o);
    document.addEventListener("pointercancel", (e) => { if (press && e.pointerId === press.id) { clearTimeout(press.timer); if (press.shown) up(e); press = null; } }, o);
    document.addEventListener("click", eatClick, true);
    document.addEventListener("contextmenu", noMenu, true);
    document.addEventListener("selectstart", noMenu, true);
    document.addEventListener("focusin", focusIn, true);
    document.addEventListener("focusout", () => { if (lastKey) hide(); }, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("scroll", (e) => { if (cur && !(box && box.contains(e.target))) hide(); }, o);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    // the map: rest the mouse on a place you know
    area("canvas#map", (el, x, y) => {
      const dbg = window.__dbg, v = dbg?.view?.(), s = state(), WM = g("WorldMap"); if (!v?.transform || !WM || !s) return null;
      const r = el.getBoundingClientRect(), n = WM.placeAt(v, x - r.left, y - r.top, (p) => known(s, p));
      return n ? { k: "place:" + n, rect: { left: x - 6, top: y - 6, right: x + 6, bottom: y + 6, width: 12, height: 12 } } : null;
    });
  }
  if (DOM) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount(); }

  return { register, html, show, hide, find, area, itemHTML, AUTO, eatClick, keyForText, get providers() { return Object.keys(P); }, set state(fn) { stateFn = fn; }, get open() { return !!cur; }, get HOLD() { return HOLD; } };
})();
if (typeof module !== "undefined") module.exports = TIP;
