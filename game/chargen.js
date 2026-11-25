/* chargen.js: character creation, Skyrim RaceMenu style. [OURS]
   A big live preview (left on a PC, on top on a phone) drawn with the painted fight rig (chargenrig.js; the ink FIGART
   figure until its parts load); it idles,
   turns (drag it, or the arrow keys) and zooms to the face. Tabs: Race · Body · Head · Face · Hair · Scars & Paint · Start,
   with Back/Next, Randomise and Undo. The Race tab also has the portrait picker ([avatars], avatar.js). A Male / Female switch sits above the tabs ([chargensex]). The look is plain data (appear.js) saved in s.app and sent on your player card,
   so everyone sees the same face. Race abilities: racefx.js.
   The same screen without the Race and Start tabs is the barber at an inn (small fee) and the mirror in your house (free).
     CHARGEN.create(host, { onBegin({ name, race, app, stone }), onBack(), startExtra(), afterRender(root), toast(text) })
     CHARGEN.open({ mode: "barber" | "mirror", save, cost, onDone(app), onCancel(), toast(text) })
     CHARGEN.open({ mode: "remake", save, onDone({ name, race, app }), onKeep(), toast(text) }): [remake] "Make your hero anew" (remake.js):
       Race + every look tab, your name (editable), "Keep as is" / "Done"; no Cancel, no Escape: it's shown once per hero
     CHARGEN.barberRow(s) · CHARGEN.mirrorRow(s) → HTML rows for the inn / house panels (data-act="barber" / "mirror") */
const CHARGEN = (() => {
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* Polish from i18n_chargen.js (I18N_CHARGEN; "what:Word" first for words that mean different things, like Short hair and Short height) */
  const L = (en, v, what) => {
    let s = en;
    try {
      if (typeof I18N !== "undefined" && I18N.lang() === "pl") {
        const T = typeof I18N_CHARGEN !== "undefined" ? I18N_CHARGEN : {}, X = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA.words : {};
        s = (what && T[what + ":" + en]) || T[en] || X[en] || en;
      }
    } catch { /* English */ }
    return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : s;
  };
  const motionOn = () => { try { return typeof MOTION !== "undefined" ? MOTION.on() : !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; } };
  const BARBER_COST = 40;
  const TABS = [["race", "Race"], ["body", "Body"], ["head", "Head"], ["face", "Face"], ["hair", "Hair"], ["marks", "Scars & Paint"], ["start", "Start"]];
  const STONE_CHOICES = ["warrior", "mage", "thief", ""];
  const skillName = (sk) => (sk === "Speech" ? "Speechcraft" : sk);
  let st = null;   // the open screen

  // ---------------------------------------------------------------- state
  function fresh(mode, o) {
    const save = o.save || null, race = save ? save.race : o.race || "nord";
    const app = save ? APPEAR.norm(save.app || APPEAR.fromSeed(save.id || save.name || "x", race, save.sex === "f"), race) : APPEAR.fromSeed("cg-" + race, race, false);
    const avatar = save && typeof AVATAR !== "undefined" ? AVATAR.chosen(save) : "";   // [avatars] "" = Automatic
    return { mode, o, save, race, app, app0: JSON.stringify(app), stone: "", avatar, avAll: false, tab: mode === "create" || mode === "remake" ? "race" : "body", name: mode === "remake" && save ? save.name || "" : "", undo: [], touched: false,
      angle: 0, angleTo: 0, zoom: 0, pose: "idle", gear: true, root: null, can: null, buf: null, raf: 0, ver: 1, drawn: "", prevLook: null, drag: null };
  }
  const tabs = () => (st.mode === "create" ? TABS : st.mode === "remake" ? TABS.filter(([id]) => id !== "start") : TABS.filter(([id]) => id !== "race" && id !== "start"));
  const named = () => st.mode === "create" || st.mode === "remake";   // the name box shows
  const raceName = (r) => (D.RACES[r] || {}).name || r;
  const beast = () => APPEAR.beasts(st.race);
  function snapshot() { return JSON.stringify({ race: st.race, app: st.app, stone: st.stone, avatar: st.avatar }); }
  function change(fn) {
    const before = snapshot();
    fn();
    st.app = APPEAR.norm(st.app, st.race);
    if (snapshot() === before) return;
    st.undo.push(before); if (st.undo.length > 60) st.undo.shift();
    st.touched = true; st.ver++;
    update();
  }
  function undo() {
    const s = st.undo.pop(); if (!s) return;
    const o = JSON.parse(s); st.race = o.race; st.app = APPEAR.norm(o.app, o.race); st.stone = o.stone || ""; st.avatar = o.avatar || ""; st.ver++;
    update();
  }
  function setRace(r) {
    if (!D.RACES[r] || r === st.race) return;
    change(() => { const keep = st.touched; st.race = r; st.app = keep ? APPEAR.forRace(st.app, r) : APPEAR.fromSeed("cg-" + r, r, st.app.sx === "f"); });
  }
  function randomise() { change(() => { st.app = APPEAR.random(st.race, st.app.sx === "f" ? "f" : "m"); }); }   // [chargensex] Randomise keeps the sex you picked
  /* [chargensex] Male / Female: an untouched starting look becomes the race's default look for that sex; a look you've
     already shaped keeps everything that carries over (APPEAR.norm drops the beard for a woman) */
  function setSex(sx) {
    sx = sx === "f" ? "f" : "m";
    if ((st.app.sx === "f" ? "f" : "m") === sx) return;
    change(() => {
      if (!st.touched) { st.app = APPEAR.fromSeed("cg-" + st.race, st.race, sx === "f"); return; }
      const a = { ...st.app, sx, bl: undefined };
      if (sx === "f" && a.hair === "bald" && !beast()) a.hair = "long";   // a bald man becomes a long-haired woman, not a bald one
      st.app = a;
    });
  }

  // ---------------------------------------------------------------- the look shown
  function baseLook() {
    try {
      if (st.save) return HEROART.lookOf(st.save);
      return HEROART.lookOf(typeof DOLL !== "undefined" && DOLL.starterSave ? DOLL.starterSave(st.race) : { race: st.race, id: "preview-" + st.race });
    } catch { return { r: st.race, id: "cg", eq: {}, gl: {} }; }
  }
  function lookNow(gear = st.gear) {
    const b = baseLook();
    const Lk = { r: st.race, id: "cg-" + (st.save?.id || "new"), eq: gear ? b.eq || {} : {}, gl: gear ? b.gl || {} : {}, v: st.save && st.save.vampire ? 1 : 0, ww: 0, a: APPEAR.compact(st.app) };
    if (st.app.sx === "f") Lk.sx = "f";
    return Lk;
  }

  // ---------------------------------------------------------------- HTML pieces
  function row(k, label, list, note) {
    const vals = list.map((x, i) => (Array.isArray(x) ? x : [i, x])), cur = vals.findIndex(([v]) => v === st.app[k]), i = cur < 0 ? 0 : cur;
    return `<div class="cgrow"><span class="cglab" id="cgl-${k}">${esc(L(label))}</span>
      <div class="cgstep" role="group" aria-labelledby="cgl-${k}">
        <button class="cgarr" data-cg="dec" data-k="${k}" aria-label="${esc(L("Previous"))}: ${esc(L(label))}">‹</button>
        <span class="cgval" aria-live="polite">${esc(L(vals[i][1], null, k))}</span><span class="cgn">${i + 1}/${vals.length}</span>
        <button class="cgarr" data-cg="inc" data-k="${k}" aria-label="${esc(L("Next"))}: ${esc(L(label))}">›</button>
      </div>${note ? `<span class="cgnote sub">${esc(L(note))}</span>` : ""}</div>`;
  }
  function swatches(k, label, cols) {
    return `<div class="cgrow cgsws"><span class="cglab" id="cgl-${k}">${esc(L(label))}</span>
      <div class="cgsw" role="radiogroup" aria-labelledby="cgl-${k}">${cols.map((c, i) => `<button class="sw ${st.app[k] === i ? "on" : ""}" data-cg="set" data-k="${k}" data-v="${i}" role="radio" aria-checked="${st.app[k] === i}" aria-label="${esc(L(label))} ${i + 1}" style="--c:${c}"></button>`).join("")}</div></div>`;
  }
  /* the painted race bust on a dark panel (bustart.js); the drawn round portrait until it loads */
  const raceFace = (id) => { const f = HEROART.portrait({ race: id, id: "preview-" + id }, 52); return typeof BUSTART !== "undefined" ? BUSTART.pick(id, f) : f; };
  function raceTab() {
    const r = D.RACES[st.race], ab = RACEFX.ability(st.race), pw = typeof POWERS !== "undefined" && POWERS.RACE ? POWERS.RACE[st.race] : null;
    return `<div class="rgrid cgraces bustgrid">${Object.entries(D.RACES).map(([id, x]) => `<button class="rpick ${id === st.race ? "on" : ""}" data-race="${id}" aria-pressed="${id === st.race}">${raceFace(id)}<span>${esc(x.name)}</span></button>`).join("")}</div>
      <div class="rshow cgcard"><div class="rfig heroprev cgbust">${typeof AVATAR !== "undefined" ? AVATAR.hero(heroNow(), HEROART.figure({ look: lookNow(true) }, 120, 165)) : HEROART.figure({ look: lookNow(true) }, 120, 165)}</div>
        <div class="rtxt"><h3>${esc(r.name)}</h3><p class="sub">${esc(L(RACEFX.lore(st.race)))}</p>
          <h4>${esc(L("Starting skills"))}</h4>
          <div class="rsk">${r.skills.map(skillName).map((k, i) => `<span class="rskill">${typeof UIART !== "undefined" ? UIART.skill(k, 22) : ""}<b>+${i === 0 ? 10 : 5}</b> ${esc(k)}</span>`).join("")}</div>
          <h4>${esc(L("Racial power"))}</h4>
          <p class="rpow">${typeof UIART !== "undefined" ? UIART.power(st.race, 24) : ""}<span><b>${esc(r.power)}</b> · ${esc(L(pw ? pw[1] : ""))} <i class="sub">${esc(L("Once a day."))}</i></span></p>
          <h4>${esc(L("Born with"))}</h4>
          <p class="rpow"><span class="cgab" aria-hidden="true">✦</span><span><b>${esc(L(ab.name))}</b> · ${esc(L(ab.desc))}</span></p></div></div>
      ${typeof AVATAR !== "undefined" ? `<h4 class="cgavh">${esc(L("Portrait"))}</h4><p class="sub">${esc(L("The face friends see next to your name. You can change it later on your Character page."))}</p>${AVATAR.grid(heroNow(), st.avatar, st.avAll)}` : ""}`;
  }
  /* [avatars] the hero being made, for the portrait (avatar.js) */
  const heroNow = () => ({ race: st.race, app: st.app, avatar: st.avatar, id: "cg-" + (st.save?.id || "new") });
  function bodyTab() {
    return row("build", "Build", APPEAR.BUILDS) + row("height", "Height", APPEAR.HEIGHTS)
      + swatches("skin", st.race === "argonian" ? "Scales" : st.race === "khajiit" ? "Fur" : "Skin tone", APPEAR.skins(st.race));
  }
  function headTab() {
    return (beast() ? "" : row("face", "Face shape", APPEAR.FACES)) + row("age", "Age", APPEAR.AGES) + swatches("eyes", "Eye colour", APPEAR.eyeCols(st.race));
  }
  function faceTab() {
    if (beast()) return row("brows", "Brows", APPEAR.BROWS) + `<p class="sub cgnote">${esc(L("Khajiit and Argonians have a muzzle or snout, so there's no nose or lips to change. Try Scars & Paint."))}</p>`;
    return row("brows", "Brows", APPEAR.BROWS) + row("nose", "Nose", APPEAR.NOSES) + row("mouth", "Mouth", APPEAR.MOUTHS);
  }
  function hairTab() {
    if (st.race === "argonian") return row("horns", "Horns and frills", APPEAR.HORNS) + swatches("hairC", "Frill colour", APPEAR.hairCols(st.race));
    let h = row("hair", st.race === "khajiit" ? "Mane" : "Hair", APPEAR.hairList(st.race)) + swatches("hairC", st.race === "khajiit" ? "Mane colour" : "Hair colour", APPEAR.hairCols(st.race));
    if (APPEAR.beardOk(st.race, st.app.sx)) h += row("beard", "Beard", APPEAR.BEARDS);
    else if (st.app.sx !== "f" && !beast()) h += `<p class="sub cgnote">${esc(L("Elves of this kind don't grow beards."))}</p>`;
    return h;
  }
  function marksTab() {
    let h = row("scar", "Scar", APPEAR.SCARS) + row("paint", "Warpaint", APPEAR.PAINTS);
    if (st.app.paint !== "none") h += swatches("paintC", "Paint colour", APPEAR.PAINTC);
    return h + row("tattoo", "Tattoo", APPEAR.TATTOOS);
  }
  function startTab() {
    const name = nameNow(), bad = nameProblem(name), S0 = typeof POWERS !== "undefined" ? POWERS.STONES : {};
    const ab = RACEFX.ability(st.race);
    return `<p class="cgnmmsg ${bad ? "bad" : "good"}" id="cgnmmsg" aria-live="polite">${bad ? esc(L(bad)) : esc(L("Good name: {n}.", { n: name }))}</p>
      <h4>${esc(L("Standing stone"))}</h4><p class="sub">${esc(L("A Guardian Stone's blessing: those skills improve 20% faster. You can change it later at the Guardian Stones."))}</p>
      <div class="cgstones" role="radiogroup" aria-label="${esc(L("Standing stone"))}">${STONE_CHOICES.map((id) => `<button class="cgstone ${st.stone === id ? "on" : ""}" data-stone="${id}" role="radio" aria-checked="${st.stone === id}">
        ${id && typeof UIART !== "undefined" ? UIART.stone(id, 40) : `<span class="cgnone" aria-hidden="true">·</span>`}<b>${esc(L(id ? S0[id][0] : "No stone yet"))}</b><span>${esc(L(id ? S0[id][1] : "Choose one later on the road."))}</span></button>`).join("")}</div>
      <h4>${esc(L("Where you begin"))}</h4>
      <p>${esc(L("You begin in Riverwood, a quiet village on the road south of Whiterun."))}</p>
      <ul class="cgsum"><li><b>${esc(raceName(st.race))}</b> · ${esc(L(ab.name))} · ${esc(D.RACES[st.race].power)}</li><li>${APPEAR.describe(st.app, st.race).map(([w, x]) => esc(L(x, null, w))).join(" · ")}</li>${st.stone ? `<li>${esc(L(S0[st.stone][0]))}</li>` : ""}</ul>
      ${st.o.startExtra ? st.o.startExtra() : ""}`;
  }
  const PANES = { race: raceTab, body: bodyTab, head: headTab, face: faceTab, hair: hairTab, marks: marksTab, start: startTab };
  /* [chargensex] the Male / Female switch at the top of the screen, above the tabs (two big segmented buttons) */
  function sexBar() {
    const f = st.app.sx === "f";
    return `<span class="cgsexl" id="cgl-sex">${esc(L("Sex"))}</span>${[["m", "Male"], ["f", "Female"]].map(([v, t]) => { const on = (v === "f") === f;
      return `<button class="cgsexb ${on ? "on" : ""}" data-cg="sex" data-v="${v}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}">${esc(L(t))}</button>`; }).join("")}`;
  }
  const namePh = () => (st.app.sx === "f" ? "Your name, e.g. Brynja" : "Your name, e.g. Remigiusz");
  const nmId = () => (st.mode === "remake" ? "rmknm" : "nm");   // [remake] the top bar already has a #nm
  const nameNow = () => (st.root?.querySelector("#" + nmId())?.value || st.name || "").trim().slice(0, 24);
  const nameProblem = (n) => (typeof NICK !== "undefined" ? NICK.problem(n) : n.length >= 2 ? "" : "Pick a nickname (at least 2 letters).");

  function skeleton() {
    const create = st.mode === "create", remake = st.mode === "remake", cost = st.mode === "barber" ? st.o.cost ?? BARBER_COST : 0;
    const title = create ? L("Create your character") : remake ? L("Make your hero anew") : st.mode === "barber" ? L("The barber") : L("Your mirror");
    const sub = create ? L("A shared Skyrim you travel in real time. Walking from Whiterun to Windhelm takes about ten minutes, and the road is rarely empty.")
      : remake ? L("We've added women heroes and new looks. Pick your race, sex and look again — your level, skills, gear and quests stay.")
      : st.mode === "barber" ? L("A new look for {g} gold. Your race, name and stone stay as they are.", { g: cost }) : L("Change your look for free. Your race, name and stone stay as they are.");
    return `<div class="cg cg-${st.mode}" role="${create ? "main" : "dialog"}" aria-label="${esc(title)}">
      <div class="cgstage cscene">
        ${create && typeof TITLEART !== "undefined" ? TITLEART.createScene(st.race) : `<div class="cgbg" aria-hidden="true"></div>`}
        <canvas class="cgcan" tabindex="0" role="img" aria-label="${esc(L("Your character. Drag, or use the arrow keys, to turn; up and down zoom to the face."))}"></canvas>
        <div class="cgtag" aria-hidden="true"></div>
        <div class="cgdetail" aria-hidden="true"></div>
        <div class="cgctl">
          <button class="cgic" data-cg="turnL" aria-label="${esc(L("Turn left"))}">⟲</button>
          <button class="cgic cgzoom" data-cg="zoom" aria-pressed="false">${esc(L("Face"))}</button>
          <button class="cgic" data-cg="turnR" aria-label="${esc(L("Turn right"))}">⟳</button>
        </div>
        <div class="cgposes" role="group" aria-label="${esc(L("Pose"))}">
          ${[["idle", "Stand"], ["walk", "Walk"], ["attack", "Fight"]].map(([p, t]) => `<button class="cgchip" data-cg="pose" data-pose="${p}" aria-pressed="${p === st.pose}">${esc(L(t))}</button>`).join("")}
          <button class="cgchip" data-cg="gear" aria-pressed="${st.gear}">${esc(L(create ? "Starting gear" : "Your gear"))}</button>
        </div>
      </div>
      <div class="cgside">
        <div class="cghead"><div><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p></div>${create ? `<button class="btn sm" id="toTitle">${esc(L("Back to the main menu"))}</button>` : ""}</div>
        <div class="cgsex" role="radiogroup" aria-labelledby="cgl-sex"></div>
        <div class="cgtabs" role="tablist" aria-label="${esc(L("Character creation"))}"></div>
        <div class="cgpanel" role="tabpanel" tabindex="-1"></div>
        <div class="cgfoot">
          ${named() ? `<div class="cgnm"><label class="sub" for="${nmId()}">${esc(L("Your name"))}</label><input id="${nmId()}" maxlength="24" autocomplete="off" placeholder="${esc(L(namePh()))}" value="${esc(st.name || "")}"></div>` : ""}
          <div class="cgbar">
            <button class="btn" data-cg="rand" title="${esc(L("Randomise"))}"><span aria-hidden="true"></span> <span>${esc(L("Randomise"))}</span></button>
            <button class="btn" data-cg="undo" title="${esc(L("Undo"))}"><span aria-hidden="true">↶</span> <span>${esc(L("Undo"))}</span></button>
            <button class="btn" data-cg="back" title="${esc(L("Back"))}"><span aria-hidden="true">‹</span> <span>${esc(L("Back"))}</span></button>
            <button class="btn" data-cg="next" title="${esc(L("Next"))}"><span>${esc(L("Next"))}</span> <span aria-hidden="true">›</span></button>
          </div>
          ${create ? `<button class="btn pri cgbegin" id="begin">Begin in ${esc(D.START_LOCATION)}</button>`
            : remake ? `<div class="cgbar cgdone"><button class="btn" data-cg="keep">${esc(L("Keep as is"))}</button><button class="btn pri" data-cg="remade">${esc(L("Done"))}</button></div>`
            : `<div class="cgbar cgdone"><button class="btn" data-cg="cancel">${esc(L("Cancel"))}</button><button class="btn pri" data-cg="done">${esc(cost ? L("Done · {g} gold", { g: cost }) : L("Done"))}</button></div>`}
        </div>
      </div></div>`;
  }
  function update() {
    const R = st.root; if (!R) return;
    const T = tabs(), i = T.findIndex(([id]) => id === st.tab);
    // keep keyboard focus on the same control after the panel is redrawn
    const a = document.activeElement, keep = a && R.contains(a) && a.closest(".cgpanel,.cgtabs,.cgsex") ? [a.dataset.cg, a.dataset.k, a.dataset.v, a.dataset.race, a.dataset.stone, a.dataset.tab, a.dataset.av].join("|") : null;
    R.querySelector(".cgtabs").innerHTML = T.map(([id, t], j) => `<button class="cgtab ${id === st.tab ? "on" : ""}" role="tab" id="cgt-${id}" data-cg="tab" data-tab="${id}" aria-selected="${id === st.tab}" tabindex="${id === st.tab ? 0 : -1}"><span class="cgtn">${j + 1}</span> ${esc(L(t))}</button>`).join("");
    { const tb = R.querySelector(".cgtabs"), on = tb.querySelector(".cgtab.on"); if (on && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, on.offsetLeft - (tb.clientWidth - on.offsetWidth) / 2); }   // [smallpolish] the open tab stays in sight on a phone
    { const sb = R.querySelector(".cgsex"); if (sb) sb.innerHTML = sexBar(); const nm = R.querySelector("#" + nmId()); if (nm) nm.placeholder = L(namePh()); }
    const pane = R.querySelector(".cgpanel");
    pane.setAttribute("aria-labelledby", "cgt-" + st.tab);
    pane.innerHTML = PANES[st.tab]();
    R.querySelector("[data-cg=back]").disabled = i <= 0;
    R.querySelector("[data-cg=next]").disabled = i >= T.length - 1;
    R.querySelector("[data-cg=undo]").disabled = !st.undo.length;
    R.querySelector(".cgzoom").setAttribute("aria-pressed", String(st.zoom > 0.5));
    R.querySelector(".cgzoom").textContent = L(st.zoom > 0.5 ? "Body" : "Face");
    R.querySelectorAll("[data-cg=pose]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pose === st.pose)));
    R.querySelector("[data-cg=gear]").setAttribute("aria-pressed", String(st.gear));
    const cf = R.querySelector(".cscene .cfig"); if (cf) cf.dataset.race = st.race;
    tag(); detail();
    if (keep) { const el = [...pane.querySelectorAll("button"), ...R.querySelectorAll(".cgtab,.cgsexb")].find((b) => [b.dataset.cg, b.dataset.k, b.dataset.v, b.dataset.race, b.dataset.stone, b.dataset.tab, b.dataset.av].join("|") === keep); if (el) el.focus(); }
    if (st.o.afterRender) try { st.o.afterRender(R); } catch (e) { console.warn("chargen", e); }
    paint(true);
  }
  function tag() {
    const el = st.root?.querySelector(".cgtag"); if (!el) return;
    const nm = named() ? nameNow() : st.save?.name || "";
    el.innerHTML = `<b>${esc(nm || L("Nameless"))}</b><span>${esc(raceName(st.race))}${st.stone ? " · " + esc(L((POWERS.STONES[st.stone] || [""])[0])) : ""}</span>`;
  }
  /* [chargenrig] the painted figure wears one painted head per race, so on the Head, Face, Hair and Scars tabs a small
     drawn close-up shows the details you pick (shown only while the painted figure is up: .cg-painted) */
  const DETAIL_TABS = new Set(["head", "face", "hair", "marks"]);
  function detail() {
    const el = st.root?.querySelector(".cgdetail"); if (!el) return;
    const on = DETAIL_TABS.has(st.tab);
    el.classList.toggle("on", on);
    el.innerHTML = on ? HEROART.portrait({ look: lookNow(false) }, 84) + `<span>${esc(L("Close-up"))}</span>` : "";
  }
  function setTab(id, focus) {
    if (!tabs().some(([t]) => t === id)) return;
    st.tab = id; update();
    if (focus) st.root.querySelector(`#cgt-${id}`)?.focus();
    st.root.querySelector(".cgpanel").scrollTop = 0;
  }
  function step(d) { const T = tabs(), i = T.findIndex(([id]) => id === st.tab); const n = T[i + d]; if (n) setTab(n[0]); }
  function listFor(k) {
    const m = { sx: [["m"], ["f"]], build: APPEAR.BUILDS, height: APPEAR.HEIGHTS, face: APPEAR.FACES, age: APPEAR.AGES, brows: APPEAR.BROWS, nose: APPEAR.NOSES, mouth: APPEAR.MOUTHS,
      hair: APPEAR.hairList(st.race), horns: APPEAR.HORNS, beard: APPEAR.BEARDS, scar: APPEAR.SCARS, paint: APPEAR.PAINTS, tattoo: APPEAR.TATTOOS };
    return (m[k] || []).map((x, i) => (Array.isArray(x) ? x[0] : i));
  }
  function nudge(k, d) {
    const vals = listFor(k); if (!vals.length) return;
    change(() => { const i = Math.max(0, vals.indexOf(st.app[k])); st.app[k] = vals[(i + d + vals.length) % vals.length]; });
  }

  // ---------------------------------------------------------------- the preview
  function paint(force) {
    const c = st?.can; if (!c || !c.isConnected) return;
    const r = c.getBoundingClientRect(), dpr = Math.min(3, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; force = true; }
    const anim = motionOn(), now = anim ? performance.now() / 1000 : 0;
    const Lk = lookNow(), key = JSON.stringify(Lk);
    if (st.prevLook && st.prevLook !== key) { try { FIGART.drop({ look: JSON.parse(st.prevLook) }); } catch { /* fine */ } }
    st.prevLook = key;
    const face = st.zoom > 0.5, pose = face ? "idle" : st.pose;
    const frame = anim ? Math.floor((now / FIGART.LOOP[pose]) * FIGART.POSES[pose]) % FIGART.POSES[pose] : 0;
    const live = typeof CGRIG !== "undefined" && CGRIG.ok(Lk);   // the painted figure moves every frame
    const sig = [key, W, H, face, pose, live ? Math.round(now * 30) : face ? Math.round(now * 6) : frame, st.angle.toFixed(3), live].join("|");
    if (!force && sig === st.drawn) return;
    st.drawn = sig;
    const g = c.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const sp = FIGART.specOf(Lk), cs = Math.cos(st.angle), sx = (cs < 0 ? -1 : 1) * Math.max(0.18, Math.abs(cs));
    // [chargenrig] the painted fight figure (chargenrig.js) once its parts load; the ink figure below until then
    const chips = st.root?.querySelector(".cgposes")?.getBoundingClientRect(), floor = chips && chips.height ? (chips.top - r.top - 6) * dpr : 0;   // the feet stand just above the pose chips
    const ctl = st.root?.querySelector(".cgctl")?.getBoundingClientRect(), top = ctl && ctl.height ? (ctl.bottom - r.top + 6) * dpr : 0;   // [raceheads] and the head stays below the rotate / Face buttons
    const painted = typeof CGRIG !== "undefined" && CGRIG.paint(g, W, H, Lk, { pose, face, t: anim ? now : 0, sx, floor, top });
    if (st.root) st.root.classList.toggle("cg-painted", !!painted);
    if (painted) { g.setTransform(1, 0, 0, 1, 0, 0); return; }
    try {
      if (!face) {
        const fh = Math.min(H * 0.74 / Math.max(1, sp.bh), W * 0.9), k = fh / 61;
        const spr = FIGART.sprite({ look: Lk }, { pose, frame, k, dpr: 1 });
        g.setTransform(sx, 0, 0, 1, W / 2, H * 0.9); g.drawImage(spr, -spr.ax, -spr.ay);
      } else {
        // the face: drawn live (no huge cached frame), breathing gently
        const k = Math.min(H * 0.42 / 12, W * 0.5 / 12) / Math.max(1, sp.bh);
        g.setTransform(sx * k, 0, 0, k, W / 2 - 2.5 * k * sx * sp.bw, H * 0.52 + 55.4 * k * sp.bh);
        FIGART.fight(g, { look: { ...Lk, eq: {}, gl: {} } }, { t: anim ? now : 0, aim: 0.6 });
      }
    } catch (e) { console.warn("chargen preview", e); }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  function loop() {
    if (!st || !st.can || !st.can.isConnected) { if (st) st.raf = 0; return; }
    const anim = motionOn();
    if (st.angle !== st.angleTo) { st.angle = anim && !st.drag ? st.angle + (st.angleTo - st.angle) * 0.2 : st.angleTo; if (Math.abs(st.angle - st.angleTo) < 0.002) st.angle = st.angleTo; }
    paint(false);
    st.raf = requestAnimationFrame(loop);
  }
  function turn(d) { st.angleTo += d; if (!motionOn()) { st.angle = st.angleTo; paint(true); } }
  function zoom(z) { st.zoom = z == null ? (st.zoom > 0.5 ? 0 : 1) : z; update(); }

  // ---------------------------------------------------------------- input
  function onClick(e) {
    const b = e.target.closest("button"); if (!b || b.disabled || !st) return;
    if (b.dataset.race) return setRace(b.dataset.race);
    if (b.dataset.stone !== undefined && b.classList.contains("cgstone")) return change(() => { st.stone = b.dataset.stone; });
    if (b.dataset.av !== undefined) return change(() => { st.avatar = AVATAR.valid(b.dataset.av) ? b.dataset.av : ""; });   // [avatars]
    if (b.dataset.avAll) { st.avAll = true; return update(); }
    switch (b.dataset.cg) {
      case "tab": return setTab(b.dataset.tab, true);
      case "dec": return nudge(b.dataset.k, -1);
      case "inc": return nudge(b.dataset.k, 1);
      case "set": return change(() => { st.app[b.dataset.k] = +b.dataset.v; });
      case "sex": return setSex(b.dataset.v);
      case "turnL": return turn(-0.7);
      case "turnR": return turn(0.7);
      case "zoom": return zoom();
      case "pose": st.pose = b.dataset.pose; return update();
      case "gear": st.gear = !st.gear; return update();
      case "rand": return randomise();
      case "undo": return undo();
      case "back": return step(-1);
      case "next": return step(1);
      case "cancel": return close(false);
      case "done": return close(true);
      case "keep": return remade(false);
      case "remade": return remade(true);
    }
    if (b.id === "begin") return begin();
    if (b.id === "toTitle") { stop(); st.o.onBack?.(); }
  }
  function onKey(e) {
    if (!st) return;
    const t = e.target;
    if (t.classList?.contains("cgtab") && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      const T = tabs(), i = T.findIndex(([id]) => id === st.tab), n = e.key === "Home" ? 0 : e.key === "End" ? T.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + T.length) % T.length;
      e.preventDefault(); return setTab(T[n][0], true);
    }
    if (t.classList?.contains("cgcan")) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); return turn(e.key === "ArrowLeft" ? -0.4 : 0.4); }
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "+" || e.key === "-") { e.preventDefault(); return zoom(e.key === "ArrowUp" || e.key === "+" ? 1 : 0); }
    }
    if (t.classList?.contains("cgsexb") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); setSex(st.app.sx === "f" ? "m" : "f"); return st.root.querySelector(".cgsexb.on")?.focus(); }
    if (t.classList?.contains("cgarr") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); return nudge(t.dataset.k, e.key === "ArrowLeft" ? -1 : 1); }
    if (t.id === nmId() && e.key === "Enter") { e.preventDefault(); return st.mode === "remake" ? remade(true) : begin(); }
    if (e.key === "Escape" && st.mode !== "create" && st.mode !== "remake") { e.preventDefault(); return close(false); }
  }
  function onInput(e) {
    if (e.target.id !== nmId()) return;
    st.name = e.target.value; e.target.classList.remove("nm-bad"); tag();
    const m = st.root.querySelector("#cgnmmsg");
    if (m) { const bad = nameProblem(nameNow()); m.className = "cgnmmsg " + (bad ? "bad" : "good"); m.textContent = bad ? L(bad) : L("Good name: {n}.", { n: nameNow() }); }
  }
  function onPointer(e) {
    const c = st?.can; if (!c) return;
    if (e.type === "pointerdown") { st.drag = { x: e.clientX, a: st.angleTo }; try { c.setPointerCapture(e.pointerId); } catch { /* old browser */ } }
    else if (e.type === "pointermove" && st.drag) { st.angleTo = st.drag.a + (e.clientX - st.drag.x) * 0.012; st.angle = st.angleTo; }
    else if (e.type === "pointerup" || e.type === "pointercancel") st.drag = null;
  }
  function wire(R) {
    R.addEventListener("click", onClick); R.addEventListener("keydown", onKey); R.addEventListener("input", onInput);
    const c = R.querySelector(".cgcan");
    for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) c.addEventListener(ev, onPointer);
    c.addEventListener("dblclick", () => zoom());
    c.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : 0); }, { passive: false });
    st.can = c;
  }
  function stop() { if (st?.raf) cancelAnimationFrame(st.raf); if (st) st.raf = 0; }
  function mount(R) {
    st.root = R; wire(R); update();
    if (!st.raf) st.raf = requestAnimationFrame(loop);
    if (typeof ResizeObserver !== "undefined") { const ro = new ResizeObserver(() => paint(true)); ro.observe(st.can); }
  }

  // ---------------------------------------------------------------- the two ways in
  /* a new character: fills host (the #app box) with the screen */
  function create(host, o = {}) {
    stop();
    const keepName = host.querySelector?.("#nm")?.value || "";
    st = fresh("create", o); st.name = keepName;
    host.innerHTML = skeleton();
    mount(host.querySelector(".cg"));
    return st;
  }
  function begin() {
    const name = nameNow(), bad = nameProblem(name);
    if (bad) {
      st.o.toast?.(L(bad)); const f = st.root.querySelector("#nm"); if (f) { f.classList.add("nm-bad"); f.focus(); }
      return;
    }
    const out = { name, race: st.race, app: APPEAR.norm(st.app, st.race), stone: st.stone || null, avatar: st.avatar || "" };
    stop(); st.o.onBegin?.(out);
  }
  /* the barber or the mirror: a full-screen layer over the game */
  function open(o = {}) {
    stop(); document.querySelector(".cg-over")?.remove();
    const mode = o.mode === "barber" ? "barber" : o.mode === "remake" ? "remake" : "mirror";
    st = fresh(mode, o);
    const wrap = document.createElement("div"); wrap.className = "cg-over"; wrap.innerHTML = skeleton();
    document.body.appendChild(wrap);
    mount(wrap.querySelector(".cg"));
    wrap.querySelector(".cgtab.on")?.focus();
    return st;
  }
  function close(ok) {
    if (!st || st.mode === "create" || st.mode === "remake") return;
    const o = st.o, app = APPEAR.norm(st.app, st.race), same = JSON.stringify(app) === st.app0;
    stop(); document.querySelector(".cg-over")?.remove(); st = null;
    if (ok && !same) o.onDone?.(app); else o.onCancel?.();
  }
  /* [remake] "Keep as is" (what you had) or "Done" (your new name, race and look); a bad name keeps the screen open */
  function remade(ok) {
    if (!st || st.mode !== "remake") return;
    const o = st.o;
    if (ok) {
      const name = nameNow(), bad = nameProblem(name);
      if (bad) { o.toast?.(L(bad)); const f = st.root.querySelector("#" + nmId()); if (f) { f.classList.add("nm-bad"); f.focus(); } return; }
      const out = { name, race: st.race, app: APPEAR.norm(st.app, st.race), avatar: st.avatar || "" };
      stop(); document.querySelector(".cg-over")?.remove(); st = null;
      return o.onDone?.(out);
    }
    stop(); document.querySelector(".cg-over")?.remove(); st = null;
    o.onKeep?.();
  }
  /* what the barber does to a save; returns a line for the player (or an error) */
  function pay(s, app, cost = BARBER_COST) {
    if ((s.gold || 0) < cost) return { err: L("The barber wants {g} gold.", { g: cost }) };
    s.gold -= cost; APPEAR.apply(s, app);
    return { text: L("The barber trims, braids and paints. You look like a new person ({g} gold).", { g: cost }) };
  }
  const barberRow = (s) => `<div class="item"><div class="t">${esc(L("Barber and face-painter"))}<span>${esc(L("Change your hair, beard, face and warpaint. Your race and name stay."))}</span></div><span class="num gold">${BARBER_COST}</span><button class="btn sm" data-act="barber" ${(s.gold || 0) >= BARBER_COST ? "" : "disabled"}>${esc(L("Sit down"))}</button></div>`;
  const mirrorRow = () => `<div class="item"><div class="t">${esc(L("Your mirror"))}<span>${esc(L("Change your look for free."))}</span></div><button class="btn sm" data-act="mirror">${esc(L("Look"))}</button></div>`;

  return { create, open, close, remade, pay, barberRow, mirrorRow, BARBER_COST, TABS, get state() { return st; } };
})();
