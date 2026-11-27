/* notify.js: one manager for every pop-up message, so they never pile up. [OURS]
   Two places on screen: the message line (top-left lane, hud2.js) and the banner (polish.js banners, the skill-up toast
   in skillup.js, the LEVEL UP notice in levelup.js). At most one of each shows, and two never start less than 400 ms apart.
   Priorities:
     P0  party vote, lost connection: persistent (the vote card itself is the notice); everything else waits under it
     P1  level up, quest completed, trophy           3.5 s, cuts a P2/P3 short
     P2  skill up, achievement, quest started, events 2.5 s
     P3  loot, gold, weather                          2 s
   Blocking screens (perk tree, item details, character creation, a mini-game, a dungeon vote): P1/P2 wait, P3 only goes to
   the history. During a fight everything waits. Nothing runs while the app is in the background.
   Merges: the same item within 1.5 s → "×N"; gold within 2 s adds up; a skill within 3 s → "21 → 24"; achievements within
   2 s → one line; weather keeps only the newest within 60 s; the same id twice is dropped; quests never merge.
   History: the last 200 notices, saved on the device, with filters (All / Rewards / Quests / Party / World), opened with
   the little scroll button at the message lane.
   The scheduling is a plain object (core()) with the clock passed in, so tests/test_notify.js can check it. */
const NOTIFY = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // kind: [priority, ms on screen, history filter]
  const RULE = {
    vote: [0, 0, "party"], disconnect: [0, 0, "party"],
    level: [1, 3500, "rewards"], promoted: [1, 3500, "rewards"], questdone: [1, 3500, "quests"], trophy: [1, 3500, "rewards"],
    skill: [2, 2500, "rewards"], ach: [2, 2500, "rewards"], queststart: [2, 2500, "quests"], objective: [2, 2500, "quests"],
    event: [2, 2500, "world"], place: [2, 2500, "world"], party: [2, 2500, "party"],
    loot: [3, 2000, "rewards"], gold: [3, 2000, "rewards"], weather: [3, 2000, "world"],
    // rewards.js weights: tiny = the quiet stacked line ("+24 gold · +15 One-Handed"), small = a short toast, medium = a short notice
    tiny: [3, 2400, "rewards"], small: [2, 2500, "rewards"], medium: [1, 3500, "rewards"],
  };
  const WINDOW = { loot: 1500, gold: 2000, skill: 3000, ach: 2000, weather: 60000, tiny: 2500 };   // merge windows (ms); quests: never
  const GAP = 400, HIST = 200, P3_WAITING = 2;
  const FILTERS = [["all", "All"], ["rewards", "Rewards"], ["quests", "Quests"], ["party", "Party"], ["world", "World"]];

  // ------------------------------------------------------------ reading a message (pure)
  /* a plain toast line → {kind, key, amt, from, to, name} (kind "info" = an ordinary message: shown at once, not queued) */
  function classify(text) {
    const t = String(text || "").trim(), body = t.replace(/^[^\w“"]+/u, "");
    let m;
    if ((m = body.match(/^Achievements?: (?:\S+ )?(.+)$/))) return { kind: "ach", name: m[1].trim() };
    if ((m = body.match(/^([A-Z][A-Za-z'\- ]+?) increased to (\d+)\.?$/))) return { kind: "skill", key: m[1].trim(), from: +m[2] - 1, to: +m[2] };
    if (/“[^”]+” done|^Quest completed|^Job done:|complete!$/.test(body)) return { kind: "questdone" };
    if (/^(?:Quest started|New objective)\b/.test(body)) return { kind: "queststart" };
    if ((m = body.match(/^(?:You find |You get |You receive |\+)(\d[\d,]*) gold\.?$/))) return { kind: "gold", amt: +m[1].replace(/,/g, "") };
    if ((m = body.match(/^(?:Looted|Picked up|You pick up|Found|You find|You take|You loot)[: ]\s*([^.]{1,60}?)\.?$/)) && !/\bgold\b/.test(m[1])) return { kind: "loot", key: m[1].trim().toLowerCase() };
    if (/^(?:Weather|Now): /.test(body) || /^The weather turns\b/.test(body)) return { kind: "weather" };
    return { kind: "info" };
  }
  /* a polish.js banner (kind, small title) → our kind */
  function bannerKind(kind, title) {
    const t = String(title || "");
    if (kind === "level") return /^Promoted/i.test(t) ? "promoted" : "level";   // a side rank-up: P1, drawn by polish.js
    if (kind === "skill") return "skill";
    if (kind === "ach") return "ach";
    if (kind === "place") return "place";
    if (kind === "objective") return "objective";
    if (kind === "hold") return "event";
    if (kind === "trophy") return "trophy";
    if (kind === "quest") {
      if (/completed|Job done|Crisis over/i.test(t)) return "questdone";
      if (/started/i.test(t)) return "queststart";
      return "event";   // world events, hold crises, coming soon
    }
    return "event";
  }
  /* the line a merged notice shows */
  function render(it) {
    if (it.kind === "loot" && it.n > 1) return `${it.base.replace(/\.\s*$/, "")} ×${it.n}`;
    if (it.kind === "gold" && it.tpl) return it.tpl.replace("{n}", it.amt.toLocaleString("en-US"));
    if (it.kind === "skill" && it.key && it.to > it.from + 1) return `${it.key} ${it.from} → ${it.to}`;
    if (it.kind === "ach" && it.names && it.names.length > 1) return it.names.join(" · ");
    if (it.kind === "tiny" && it.parts && typeof REWARDS !== "undefined") return REWARDS.line(it.parts);
    return it.base;
  }
  /* can `it` be folded into `prev`? (mutates prev and returns true) */
  function fold(prev, it) {
    const w = WINDOW[it.kind];
    if (!w || !prev || prev.kind !== it.kind || prev.slot !== it.slot || it.t - prev.tl > w) return false;
    if (it.kind === "loot") { if (prev.key !== it.key) return false; prev.n += it.n; }
    else if (it.kind === "gold") prev.amt += it.amt;
    else if (it.kind === "skill") { if (prev.key !== it.key) return false; prev.to = Math.max(prev.to, it.to); prev.from = Math.min(prev.from, it.from); }
    else if (it.kind === "ach") { prev.names.push(...it.names); if (prev.title) prev.title = "Achievements"; }
    else if (it.kind === "weather") { prev.base = it.base; prev.title = it.title; }
    else if (it.kind === "tiny") { if (!prev.parts || !it.parts || typeof REWARDS === "undefined") return false; prev.parts = REWARDS.merge(prev.parts, it.parts); }
    prev.tl = it.t; prev.text = render(prev);
    if (prev.rec) { prev.rec.text = prev.text; prev.rec.title = prev.title || ""; prev.rec.t = it.t; }
    return true;
  }

  // ------------------------------------------------------------ the scheduler (pure: the clock and the screen are passed in)
  function core() {
    const queue = [], hist = [], seen = new Set(), showing = { msg: null, ban: null };
    let last = -1e9, pausedAt = 0;
    /* a new notice: {kind, slot: "msg"|"ban", text, title?, icon?, id?, key?, amt?, from?, to?, name?} → "drop" | "merged" | "update" | "queued" */
    function push(o, now) {
      const r = RULE[o.kind] || RULE.event;
      if (o.id) { if (seen.has(o.id)) return "drop"; seen.add(o.id); }
      const it = { ...o, slot: o.slot || "msg", p: r[0], ms: o.ms || r[1], cat: r[2], t: now, tl: now, n: o.n || 1, amt: o.amt || 0, base: String(o.text || "") };
      if (it.kind === "gold" && it.amt) it.tpl = it.base.replace(/\d[\d,]*/, "{n}");
      if (it.kind === "ach") it.names = [o.name || it.base];
      if (it.kind === "skill") { it.from = o.from ?? 0; it.to = o.to ?? 0; }
      it.text = render(it);
      // fold into a waiting one, else into the one on screen (which then gets its text updated)
      for (let i = queue.length - 1; i >= 0; i--) if (fold(queue[i], it)) return "merged";
      const cur = showing[it.slot];
      if (cur && fold(cur, it)) { cur.end = Math.max(cur.end, now + Math.min(1200, cur.ms)); cur.dirty = true; return "update"; }
      if (it.kind !== "tiny") { it.rec = { t: now, kind: it.kind, cat: it.cat, title: it.title || "", text: it.text }; hist.unshift(it.rec); if (hist.length > HIST) hist.length = HIST; }   // the tiny line: each loot/gold line is in the history already (note)
      queue.push(it);
      // a burst of small rewards: only the newest few wait, the rest are in the history
      const small = queue.filter((q) => q.p >= 3 && q.slot === it.slot);
      while (small.length > P3_WAITING) queue.splice(queue.indexOf(small.shift()), 1);
      return "queued";
    }
    /* someone else draws its own notice (skillup.js, levelup.js): may it take the banner now? */
    function lease(o, now, scr = {}) {
      const r = RULE[o.kind] || RULE.event, p = r[0];
      if (pausedAt || scr.p0 || scr.fight || (scr.msg || 0) >= 1) return false;   // its own toast sits in the lane: the lane's blocking screens apply
      const cur = showing.ban;
      if (cur && cur.end > now) { if (!(p <= 1 && cur.p > p)) return false; }   // a level-up cuts a skill toast short
      if (now - last < GAP || queue.some((q) => q.slot === "ban" && q.p < p)) return false;
      const it = { ...o, slot: "ban", p, ms: o.ms || r[1], cat: r[2], t: now, tl: now, n: 1, base: String(o.text || ""), leased: true };
      if (it.kind === "skill") { it.from = o.from ?? 0; it.to = o.to ?? 0; }
      it.text = render(it);
      const h = hist.find((x) => x.kind === it.kind && x.key === it.key && now - x.t <= (WINDOW[it.kind] || 0) && it.kind !== "level");
      if (h && it.kind === "skill") { h.from = Math.min(h.from, it.from); h.to = Math.max(h.to, it.to); h.text = render({ ...h, base: it.base }); h.t = now; }
      else { it.rec = { t: now, kind: it.kind, cat: it.cat, title: it.title || "", text: it.text, key: it.key, from: it.from, to: it.to }; hist.unshift(it.rec); if (hist.length > HIST) hist.length = HIST; }
      it.end = now + it.ms; showing.ban = it; last = now;
      return true;
    }
    /* what to do now. scr = {fight, p0, msg: 0|1|2, ban: 0|1|2} (1 = a blocking screen, 2 = everything waits) */
    function tick(now, scr = {}) {
      const out = [];
      if (pausedAt) return out;
      for (const s of ["ban", "msg"]) {
        const c = showing[s];
        if (c && c.dirty) { c.dirty = false; out.push({ act: "update", slot: s, item: c }); }
        if (c && c.end <= now) { showing[s] = null; out.push({ act: "end", slot: s, item: c }); }
      }
      if (scr.p0) {   // the vote card or a lost connection: nothing else on screen, everything waits
        for (const s of ["ban", "msg"]) if (showing[s]) { out.push({ act: "cut", slot: s, item: showing[s] }); showing[s] = null; }
        return out;
      }
      for (const s of ["ban", "msg"]) {
        const block = scr.fight ? 2 : scr[s] || 0;
        if (block >= 1) for (let i = queue.length - 1; i >= 0; i--) if (queue[i].slot === s && queue[i].p >= 3) { queue[i].dropped = true; queue.splice(i, 1); }   // P3 under a blocking screen: history only
        if (block >= 1) continue;
        let best = null;
        for (const q of queue) if (q.slot === s && (!best || q.p < best.p)) best = q;
        if (!best) continue;
        const cur = showing[s];
        if (cur && best.p <= 1 && best.p < cur.p) { out.push({ act: "cut", slot: s, item: cur }); showing[s] = null; }
        if (showing[s] || now - last < GAP) continue;
        queue.splice(queue.indexOf(best), 1);
        best.end = now + best.ms; showing[s] = best; last = now;
        out.push({ act: "show", slot: s, item: best });
      }
      return out;
    }
    /* the app went to the background / came back: on-screen timers stand still meanwhile */
    function pause(now) { if (!pausedAt) pausedAt = now; }
    function resume(now) {
      if (!pausedAt) return;
      const d = now - pausedAt; pausedAt = 0; last += d;
      for (const s of ["ban", "msg"]) if (showing[s]) showing[s].end += d;
    }
    /* a plain message shown at once (errors, answers): it owns the line for its time */
    function direct(now) { showing.msg = { kind: "info", slot: "msg", p: 3, end: now + 2000 }; }
    /* the history only (a loot or gold line that rewards.js shows on its tiny line instead) */
    function note(o, now) {
      const r = RULE[o.kind] || RULE.event;
      hist.unshift({ t: now, kind: o.kind, cat: r[2], title: o.title || "", text: String(o.text || "") }); if (hist.length > HIST) hist.length = HIST;
    }
    function load(list) { if (Array.isArray(list)) for (const r of list.slice(0, HIST)) if (r && r.text) hist.push({ t: +r.t || 0, kind: String(r.kind || ""), cat: String(r.cat || "world"), title: String(r.title || ""), text: String(r.text) }); }
    const filter = (cat) => (cat && cat !== "all" ? hist.filter((h) => h.cat === cat) : hist.slice());
    const idle = () => !queue.length && !showing.msg && !showing.ban && !pausedAt;   // nothing waits, nothing on screen (notify pump skips its screen reads)
    return { push, note, lease, tick, pause, resume, direct, load, filter, queue, hist, showing, idle, get paused() { return !!pausedAt; } };
  }

  // ------------------------------------------------------------ Polish
  const PL = {
    Messages: "Wiadomości", All: "Wszystko", Rewards: "Nagrody", Quests: "Zadania", Party: "Drużyna", World: "Świat",
    "Nothing yet.": "Na razie nic.", "Message history": "Historia wiadomości", Achievements: "Osiągnięcia", Close: "Zamknij",
    "just now": "przed chwilą", "{0} min ago": "{0} min temu", "{0} h ago": "{0} godz. temu",
    // the patch note
    "Tidier pop-ups": "Porządniejsze powiadomienia",
    "Promotions and tips back in their place": "Awanse i podpowiedzi na swoim miejscu",
    "When you're promoted on a side, the banner shows again (it was quietly swallowed before).": "Gdy awansujesz u jakiejś strony, baner znów się pokazuje (wcześniej znikał bez śladu).",
    "The tips for new players no longer sit on top of the dungeon's route buttons: they move below them, or wait until there's room.": "Podpowiedzi dla nowych graczy nie zasłaniają już przycisków trasy w lochu: przesuwają się pod nie albo czekają, aż będzie miejsce.",
    "All the pop-up messages now take turns: at most one message and one banner at a time, never on top of each other. Level ups and finished quests go first.":
      "Wszystkie wyskakujące komunikaty czekają teraz na swoją kolej: naraz najwyżej jedna wiadomość i jeden baner, nigdy jeden na drugim. Nowy poziom i ukończone zadania mają pierwszeństwo.",
    "Loot and gold that arrive together are added up into one line (\"Iron Dagger ×3\", one gold total), and a skill that rises a few times in a row shows as \"21 → 24\".":
      "Łupy i złoto zdobyte jednocześnie sumują się w jedną linię („Żelazny sztylet ×3”, jedna suma złota), a umiejętność, która rośnie kilka razy z rzędu, pokazuje się jako „21 → 24”.",
    "Achievements earned together share one banner, so \"First Steps\" and \"Coin Hoarder\" no longer pop one after the other when you start.":
      "Osiągnięcia zdobyte razem dzielą jeden baner, więc „Pierwsze kroki” i „Zbieracz monet” nie wyskakują już jedno po drugim na starcie.",
    "Nothing pops up over the perk stars, item details, character creation, mini-games, party votes or your fight buttons any more. Big news waits until you're done; small loot lines go straight to the history.":
      "Nic już nie wyskakuje na gwiazdy perków, szczegóły przedmiotu, tworzenie postaci, minigry, głosowania drużyny ani przyciski walki. Ważne wieści czekają, aż skończysz, a drobne łupy trafiają prosto do historii.",
    "New: a message history. Tap the little scroll next to the messages at the top left to see the last 200, sorted into Rewards, Quests, Party and World.":
      "Nowość: historia wiadomości. Dotknij małego zwoju obok wiadomości w lewym górnym rogu, by zobaczyć ostatnie 200, z podziałem na Nagrody, Zadania, Drużynę i Świat.",
  };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v;
  const L = (s, ...a) => { let t = typeof I18N !== "undefined" && I18N.lang && I18N.lang() === "pl" && PL[s] ? PL[s] : s; a.forEach((v, i) => { t = t.replace(`{${i}}`, v); }); return t; };

  // ------------------------------------------------------------ the live game
  const C = core();
  const KEY = "rotn-notify-hist";
  try { if (DOM) C.load(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* a fresh history */ }
  let saveT = 0;
  const save = () => { if (!DOM) return; clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(C.hist.map((h) => ({ t: h.t, kind: h.kind, cat: h.cat, title: h.title, text: h.text })))); } catch { /* storage full or off */ } }, 800); };
  const shownEl = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const any = (q) => { for (const el of document.querySelectorAll(q)) if (shownEl(el)) return true; return false; };
  const BLOCK = ["#tip.on", ".cgrow", ".cg-over", "#lockpick", "#pickgame", "#smithgame", "#minegame", "#huntgame", "#craftgame", "#fishgame", "#dgame", "#xgame", "#rct", ".tw-big [data-sk-perk]", "#sky svg[aria-label$='perk stars']", "#lvlpick", "#nfhist"];
  let p0 = new Map();   // id → text (lost connection and the like)
  /* what the screen allows right now */
  function screen() {
    if (!DOM || !document.body) return { fight: false, p0: false, msg: 0, ban: 0 };
    const fight = (typeof TB !== "undefined" && !!TB.open) || any("#tbf, #tbwatch");
    const vote = any(".pvote");
    const block = any(BLOCK.join(",")) ? 1 : 0;
    let ban = block;
    if (!ban) {   // banners also wait out menus, windows and the dungeon screen (polish.js rules), so nothing covers a title or the room legend
      const ui = window.__ui;
      if (document.querySelector("#sky, #modal .sheet, #favwheel, #dun")) ban = 1;
      else if (typeof OVERLAYS !== "undefined" && (OVERLAYS.level() >= OVERLAYS.LEVEL.decision || OVERLAYS.menuOpen())) ban = 1;
      else if (typeof PCMAP !== "undefined" && PCMAP.on && PCMAP.on()) ban = document.documentElement.classList.contains("pc-full") ? 1 : 0;
      else if (ui && ui.tab && ui.tab !== "map") ban = 1;
    }
    return { fight, p0: vote || p0.size > 0, msg: block, ban };
  }
  let msgShow = null;   // ui.js's real toast (text, {replace})
  function run(a) {
    const it = a.item;
    if (a.slot === "msg") {
      if (a.act === "show" || a.act === "update") { if (it.show || msgShow) (it.show || msgShow)(it.text, { replace: a.act === "update", item: it }); }
      return;
    }
    if (a.act === "show") {
      if (it.kind === "ach") { try { SOUND.fx("levelup"); } catch { /* sound is optional */ } }
      const big = it.kind === "skill" && it.key ? `${it.key} ${it.to}` : it.text;   // skillup.js reads "Name 24" and draws the bar itself
      if (typeof POLISH !== "undefined" && POLISH.raw) POLISH.raw(it.bkind || "quest", it.title || "", big, it.icon || "", it.ms);
    } else if (a.act === "update" && DOM) {
      const b = document.querySelector("#pbanners .pban:last-child"); if (b) { const big = b.querySelector(".ptx b"), sm = b.querySelector(".ptx small"); if (big) big.textContent = it.text; if (sm && it.title) sm.textContent = it.title; }
    } else if (a.act === "cut" && DOM) {
      document.querySelectorAll("#pbanners .pban").forEach((e) => e.classList.add("out"));
    }
  }
  let ticking = 0;
  /* [perfmap] when nothing waits and nothing shows, only the vote card / lost connection matters: skip the style reads */
  let histN = null;
  function pump() {
    if (!DOM) return;
    if (C.idle && C.idle()) {
      const p0on = p0.size > 0 || !!document.querySelector(".pvote");
      if (document.body && document.body.classList.contains("nf-p0") !== p0on) document.body.classList.toggle("nf-p0", p0on);
      if (!p0on) { if (C.hist[0] !== histN) { histN = C.hist[0]; if (histN) { save(); histBtn(); } } return; }
    }
    const scr = screen();
    document.body?.classList.toggle("nf-p0", !!scr.p0);
    for (const a of C.tick(Date.now(), scr)) { try { run(a); } catch (e) { console.warn("notify", e); } }
    if (C.hist.length && C.hist[0] !== histN) { histN = C.hist[0]; save(); histBtn(); }   // (saving every beat kept pushing the save back for ever)
    else if (C.hist.length && !document.getElementById("nfhbtn")) histBtn();
  }
  const soon = () => { if (DOM && !ticking) ticking = setTimeout(() => { ticking = 0; pump(); }, 0); };

  /* ui.js toast(text): notices go through the queue, ordinary messages show at once */
  function msg(text, show) {
    if (!DOM) { show(text, {}); return; }
    msgShow = show;
    const c = classify(text);
    if (c.kind === "info") { C.direct(Date.now()); show(text, {}); return; }
    if (c.kind === "ach") { ach([{ name: c.name, id: "" }]); return; }   // achievements are banners
    if ((c.kind === "loot" || c.kind === "gold") && typeof REWARDS !== "undefined" && REWARDS.fromToast(c, text)) { C.note({ ...c, text }, Date.now()); save(); return; }   // [rewards] loot and gold join the quiet tiny line (each line still in the history)
    C.push({ ...c, slot: "msg", text, show }, Date.now());
    pump();
  }
  /* polish.js banner(kind, title, big, icon) */
  function banner(kind, title, big, icon = "") {
    const k = bannerKind(kind, title);
    const o = { kind: k, bkind: kind, slot: "ban", title, text: big, icon };
    if (k === "skill") { const m = String(big).match(/^(.+?) (\d+)$/); if (m) Object.assign(o, { key: m[1], from: +m[2] - 1, to: +m[2] }); }
    if (k === "ach") o.name = big;
    C.push(o, Date.now());
    if (DOM) pump();
  }
  /* achievements just earned ([{id, name, icon}]): one banner for those that come together */
  function ach(list) {
    for (const a of list) {
      const icon = typeof UIART !== "undefined" && a.id ? (() => { try { return UIART.ach(a.id, 36); } catch { return ""; } })() : "";
      C.push({ kind: "ach", bkind: "ach", slot: "ban", title: "Achievement", text: a.name, name: a.name, icon, id: a.id ? "ach:" + a.id : undefined }, Date.now());
    }
    if (DOM) pump();
  }
  /* rewards.js: the tiny line (its parts merge into the line on screen or waiting) and the small / medium banners */
  function tiny(parts) {
    if (!DOM) return;
    const base = msgShow || ((t) => { try { if (window.__dbg?.toast) window.__dbg.toast(t); } catch { /* no game yet */ } });
    const show = (t, o) => { base(t, o); try { if (typeof REWARDS !== "undefined") REWARDS.paint(document.getElementById("toast"), (o && o.item && o.item.parts) || parts); } catch { /* colour is a nicety */ } };   // item names in their rarity colour
    C.push({ kind: "tiny", slot: "msg", parts, text: typeof REWARDS !== "undefined" ? REWARDS.line(parts) : "", show }, Date.now());
    pump();
  }
  function reward(kind, title, text, icon = "") {
    C.push({ kind, bkind: kind === "medium" ? "level" : "quest", slot: "ban", title, text, icon }, Date.now());
    if (DOM) pump();
  }
  /* skillup.js / levelup.js: may I show my own notice now? */
  function lease(kind, text, ms, key, from, to) {
    const ok = C.lease({ kind, text, ms, key, from, to }, Date.now(), DOM ? screen() : {});
    if (ok) save();
    return ok;
  }
  /* P0: a lost connection and the like stays until clear(id) */
  function hold(id, text) { if (!p0.has(id)) { p0.set(id, text); C.hist.unshift({ t: Date.now(), kind: "disconnect", cat: "party", title: "", text }); save(); } pump(); }
  function clear(id) { p0.delete(id); pump(); }

  // ------------------------------------------------------------ the history
  let histCat = "all";
  function ago(t) { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? L("just now") : s < 3600 ? L("{0} min ago", Math.floor(s / 60)) : L("{0} h ago", Math.floor(s / 3600)); }
  function histHTML() {
    const rows = C.filter(histCat);
    return `<div class="nf-sheet" role="dialog" aria-label="${esc(L("Message history"))}"><div class="nf-hd"><h3>${esc(L("Messages"))}</h3><button class="btn sm nf-x" data-nf="close" aria-label="${esc(L("Close"))}">✕</button></div>
      <div class="nf-f" role="tablist">${FILTERS.map(([k, l]) => `<button class="btn sm ${k === histCat ? "pri" : ""}" data-nf="f" data-k="${k}" role="tab" aria-selected="${k === histCat}">${esc(L(l))}</button>`).join("")}</div>
      <ol class="nf-l">${rows.length ? rows.map((h) => `<li class="nf-${esc(h.cat)}"><span class="nf-t">${h.title ? `<small>${esc(L(h.title))}</small>` : ""}${esc(h.text)}</span><time>${esc(ago(h.t))}</time></li>`).join("") : `<li class="nf-none">${esc(L("Nothing yet."))}</li>`}</ol></div>`;
  }
  function openHist() {
    if (!DOM) return;
    let el = document.getElementById("nfhist");
    if (!el) {
      el = document.createElement("div"); el.id = "nfhist";
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-nf]");
        if (!b) { if (e.target === el) closeHist(); return; }
        if (b.dataset.nf === "close") closeHist();
        if (b.dataset.nf === "f") { histCat = b.dataset.k; el.innerHTML = histHTML(); }
      });
      document.body.appendChild(el);
    }
    el.innerHTML = histHTML();
  }
  function closeHist() { const el = DOM && document.getElementById("nfhist"); if (!el) return false; el.remove(); return true; }
  function histBtn() {
    const lane = document.getElementById("hudlane"); if (!lane || lane.querySelector("#nfhbtn")) return;
    const b = document.createElement("button"); b.id = "nfhbtn"; b.type = "button"; b.className = "nf-hbtn";
    b.setAttribute("aria-label", "Message history"); b.title = "Message history";
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h10a3 3 0 0 1 0 6H8v8a2 2 0 0 1-4 0V6a2 2 0 0 1 2-2zm4 9h8M10 16h8M8 20h10a2 2 0 0 0 2-2v-8"/></svg>';
    b.onclick = (e) => { e.stopPropagation(); openHist(); };
    lane.prepend(b);
  }

  if (DOM) {
    const start = () => { setInterval(pump, 200); pump(); };
    if (document.body) start(); else addEventListener("DOMContentLoaded", start);
    document.addEventListener("visibilitychange", () => { if (document.hidden) C.pause(Date.now()); else { C.resume(Date.now()); soon(); } });   // Esc / the back button close the history via ui.js back()
  }

  return { RULE, WINDOW, GAP, FILTERS, classify, bannerKind, render, core, msg, banner, ach, tiny, reward, lease, hold, clear, openHist, closeHist, screen, pump, PL, C,
    get history() { return C.hist; }, get queued() { return C.queue.length; } };
})();
if (typeof module !== "undefined") module.exports = NOTIFY;
