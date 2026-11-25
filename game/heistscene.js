/* The heist screen's painted backdrop [OURS] (heists.js draws the choices on top).
   - Each house has its own night painting: heist-<house id>.webp (2048×1152, see assets.js). Without it a plain night
     gradient stands in.
   - One colour grade per step, laid over the picture only (never over the buttons or text): scouting is cold and quiet,
     sneaking darker at the edges, amber edge light when suspicion is high, red edges when the alarm is up, cold and
     washed out on the escape. Grades cross-fade in about a second; the alarm comes in fast.
   - The alarm: a red edge glow that pulses and one short shake of the picture. The buttons never move.
   - Light ambience: the lit window breathes, lanterns flicker, the picture drifts very slowly, a few snowflakes on phones.
   - Only transform and opacity are animated. Reduced motion turns off the shake, pulses, drift, flicker and snow.
   HEISTSCENE.wrap(run, uiHtml) → the whole screen · HEISTSCENE.patch(el, html) updates an open screen in place ·
   HEISTSCENE.card(id) → the painted header of the house's card on the town page. */
const HEISTSCENE = (() => {
  /* where things are in each painting, in % of the picture: the focus (the lit window, kept in view on phones),
     and the lantern glows */
  const SPOTS = {
    battleborn: { fx: 53, win: [53, 26], lamps: [[37.5, 33]] },
    shattershield: { fx: 58, win: [58.5, 33], lamps: [[52.5, 53], [62, 52], [35, 52]] },
    erikur: { fx: 62, win: [64, 26], lamps: [[7.5, 44], [77, 49.5], [92, 46]] },
    silverblood: { fx: 62, win: [66, 22], lamps: [[39, 45], [70, 42]] },
    blackbriar: { fx: 62, win: [67, 23], lamps: [[13, 37.5], [56, 45], [81, 56]] },
  };
  const FLAKES = 10;
  const key = (id) => `heist-${id}`;
  const picUrl = (id) => (typeof ASSETS !== "undefined" ? ASSETS.url(key(id)) : "");

  /* which grade a step gets */
  function grade(r) {
    if (r.alarm) return "alarm";
    if (r.stage === 4) return "escape";
    if ((r.heat || 0) >= 60) return "susp";
    return r.stage === 0 ? "scout" : "sneak";
  }
  /* tension follows suspicion: 0 calm, 1 darker edges, 2 amber, 3 edges pulse */
  const tension = (r) => { const h = r.alarm ? 0 : r.heat || 0; return h >= 90 ? 3 : h >= 60 ? 2 : h >= 30 ? 1 : 0; };

  function bg(id) {
    const sp = SPOTS[id] || SPOTS.battleborn, u = picUrl(id);
    const pos = ([x, y]) => `left:${x}%;top:${y}%`;
    const lamps = sp.lamps.map((p, i) => `<i class="hz-lamp l${i}" style="${pos(p)}"></i>`).join("");
    const flakes = Array.from({ length: FLAKES }, (_, i) => `<i style="left:${(i * 37 + 11) % 97}%;animation-delay:-${(i * 7.3) % 50}s;animation-duration:${42 + ((i * 13) % 26)}s"></i>`).join("");
    const grades = ["scout", "sneak", "susp", "alarm", "escape"].map((g) => `<i class="hz-tint g-${g}"></i><i class="hz-vig g-${g}"></i>`).join("");
    return `<div class="hz-bg" aria-hidden="true" data-h="${id}"><div class="hz-box" style="--fx:${sp.fx}%"><div class="hz-cam" style="transform-origin:${sp.win[0]}% ${sp.win[1]}%">
      <div class="hz-img${u ? "" : " none"}" data-k="${key(id)}"${u ? ` style="background-image:url('${u}')"` : ""}></div>
      <i class="hz-glow" style="${pos(sp.win)}"></i>${lamps}</div><i class="hz-fade"></i></div>
      ${grades}<i class="hz-tense"></i><i class="hz-red"></i><div class="hz-snow">${flakes}</div></div>`;
  }
  /* the whole heist screen: the picture behind, the choices (uiHtml) on top */
  function wrap(r, uiHtml) {
    return `<div class="hz-modal hz-full" data-g="${grade(r)}" data-t="${tension(r)}">${bg(r.id)}
      <div class="hz-ui"><button class="hz-x" data-act="close" aria-label="Close" title="Close (carry on later from the town)">×</button>${uiHtml}</div></div>`;
  }
  /* the town card's header: the painting when it's here (it covers the drawn night scene underneath) */
  function card(id) {
    const sp = SPOTS[id] || SPOTS.battleborn, u = picUrl(id);
    return `<div class="hz-cardpic hz-img${u ? "" : " none"}" aria-hidden="true" data-k="${key(id)}" style="background-position:${sp.fx}% 40%${u ? `;background-image:url('${u}')` : ""}"></div>`;
  }
  /* update an open screen without rebuilding the picture, so the grade can cross-fade; false = rebuild it */
  function patch(el, html) {
    if (!el || !el.classList.contains("hz-full") || typeof document === "undefined") return false;
    const t = document.createElement("template"); t.innerHTML = html.trim();
    const nu = t.content.firstElementChild;
    if (!nu || !nu.classList.contains("hz-full")) return false;
    const oldBg = el.querySelector(".hz-bg"), newBg = nu.querySelector(".hz-bg");
    if (!oldBg || !newBg || oldBg.dataset.h !== newBg.dataset.h) return false;
    const wasAlarm = el.dataset.g === "alarm";
    el.dataset.g = nu.dataset.g; el.dataset.t = nu.dataset.t;
    el.querySelector(".hz-ui").replaceWith(nu.querySelector(".hz-ui"));
    if (nu.dataset.g === "alarm" && !wasAlarm) shake(oldBg);
    return true;
  }
  function shake(b) {
    b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
    setTimeout(() => b.classList.remove("shake"), 260);
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    /* the painting arrived after the screen opened: put it in */
    if (typeof ASSETS !== "undefined") ASSETS.on(() => {
      for (const el of document.querySelectorAll(".hz-img.none")) { const u = ASSETS.url(el.dataset.k); if (u) { el.style.backgroundImage = `url('${u}')`; el.classList.remove("none"); } }
    });
    /* pause the ambience while the game is in the background */
    document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("hz-paused", document.hidden));
  }
  /* Polish: the close button and the patch note */
  const PL = {
    Close: "Zamknij",
    "Close (carry on later from the town)": "Zamknij (dokończysz później w mieście)",
    "Heists you can see":
      "Skoki, które widać",
    "Every heist now shows a painting of the house you're robbing: Battle-Born's farm, the Shatter-Shield house on the icy docks, Erikur's townhouse, the Silver-Blood stone house and Maven's manor on the canal.":
      "Każdy skok pokazuje teraz obraz domu, który okradasz: farmę Battle-Bornów, dom Shatter-Shieldów na oblodzonych dokach, kamienicę Erikura, kamienny dom Srebrnokrwistych i dwór Maven nad kanałem.",
    "On phones the heist takes the whole screen. The house sits at the top and your choices at the bottom, within thumb reach. The X in the corner closes it, and you carry on later from the town.":
      "Na telefonie skok zajmuje cały ekran. Dom jest na górze, a twoje wybory na dole, w zasięgu kciuka. X w rogu zamyka okno, a skok dokończysz później z poziomu miasta.",
    "The picture changes mood with each step: cold and quiet while you look around, darker while you sneak, amber at the edges when people grow suspicious, and cold and grey on the way out.":
      "Obraz zmienia nastrój z każdym krokiem: zimny i cichy, gdy się rozglądasz, ciemniejszy, gdy się skradasz, bursztynowy na brzegach, gdy ludzie nabierają podejrzeń, i zimny, szary podczas ucieczki.",
    "When the alarm goes up, the edges glow red and pulse, and the picture gives a short jolt. Your buttons stay put.":
      "Gdy podniesie się alarm, brzegi świecą na czerwono i pulsują, a obraz krótko drga. Przyciski zostają na miejscu.",
    "Lanterns flicker, the lit window glows softly and a few snowflakes drift by on phones. If your phone is set to reduce motion, all of that stays still.":
      "Latarnie migoczą, oświetlone okno delikatnie się żarzy, a na telefonie przelatuje kilka płatków śniegu. Jeśli telefon ma ustawione ograniczenie ruchu, wszystko stoi w miejscu.",
    "The heist loot and tools have new painted icons: the signet ring, gold compass, jewelled goblet, torc, ruby brooch, forged papers and the Draught of Shadows.":
      "Łupy i narzędzia ze skoków mają nowe malowane ikony: sygnet, złoty kompas, puchar z klejnotami, naszyjnik, rubinowa brosza, fałszywe dokumenty i Wywar cieni.",
  };
  /* i18n.js loads after this file: add the lines once every script has run */
  const addPL = () => { if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v; };
  addPL();
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") document.addEventListener("DOMContentLoaded", addPL);
  return { SPOTS, PL, grade, tension, bg, card, wrap, patch };
})();
