/* pcupdate.js: tells PC players when a newer build is out. [OURS]
   The installed PC version updates itself (desktop/main.js), but the portable .exe can't, and build 100 shipped before
   the updater existed. So on PC the game checks the newest GitHub release itself and, when it's newer, shows a small
   card with a download button. The installed version only shows it if its own updater seems stuck (3+ builds behind).
   main.js adds ?pc=portable|setup&v=1.0.BUILD to the page address. */
const PCUPDATE = (() => {
  const REPO = "R3MC10/Skyrim-Roads", PAGE = `https://github.com/${REPO}/releases/latest`;
  const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams("");   // read at start: the game may tidy the address later
  /* this PC build's number: ?v=1.0.129 from main.js, else the user agent ("Roads of the North/1.0.129 ... Electron/33"), else 0 */
  function buildOf(ua, v) {
    const q = /^\d+\.\d+\.(\d+)$/.exec(String(v || ""));
    if (q) return +q[1];
    if (!/Electron\//.test(String(ua || ""))) return 0;
    const m = /(?:roads-of-the-north-pc|Roads of the North)\/\d+\.\d+\.(\d+)/i.exec(String(ua || ""));
    return m ? +m[1] : 0;
  }
  /* should the card show? kind: "portable" | "setup" | "" (old builds don't say) */
  function shouldShow(cur, latest, kind) {
    if (!(cur > 0) || !(latest > cur)) return false;
    return kind === "setup" ? latest - cur >= 3 : true;
  }
  function text(cur, latest, kind) {
    return kind === "setup"
      ? `Build ${latest} is out, you're on ${cur}, and the game hasn't updated itself. Download the new setup once and run it: your saves stay.`
      : `Build ${latest} is out (you're on ${cur}). The portable version can't update itself: download the new one, or use the setup version, which keeps itself up to date. Your saves stay.`;
  }
  function show(cur, latest, kind) {
    if (typeof document === "undefined" || document.getElementById("pcupd")) return;
    const box = document.createElement("div");
    box.id = "pcupd";
    box.innerHTML = `<div class="t">New version</div><div class="d"></div><div class="b"><button class="btn sm pri" data-k="get">Download</button><button class="btn sm" data-k="no">Later</button></div>`;
    box.querySelector(".d").textContent = text(cur, latest, kind);
    box.addEventListener("click", (e) => {
      const k = e.target?.dataset?.k; if (!k) return;
      if (k === "get") window.open(PAGE, "_blank");   // main.js opens links in the real browser
      try { sessionStorage.setItem("rotn_pcupd", String(latest)); } catch (x) { /* fine */ }
      box.remove();
    });
    document.body.appendChild(box);
  }
  async function check() {
    if (typeof navigator === "undefined" || typeof fetch !== "function") return;
    const q = Q, kind = q.get("pc") || "";
    const cur = buildOf(navigator.userAgent, q.get("v")); if (!cur) return;   // not the PC app
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json(), latest = parseInt(String(j.tag_name).replace(/\D+/g, ""), 10) || 0;
      let seen = ""; try { seen = sessionStorage.getItem("rotn_pcupd") || ""; } catch (x) { /* fine */ }
      if (seen !== String(latest) && shouldShow(cur, latest, kind)) show(cur, latest, kind);
    } catch (e) { /* offline: try next start */ }
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") window.addEventListener("load", () => setTimeout(check, 6000));
  return { buildOf, shouldShow, text, check };
})();
if (typeof module !== "undefined") module.exports = PCUPDATE;
