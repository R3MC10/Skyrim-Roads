"""[offhand] Frame strips of the painted fight rig: every clip x gear x body, for looking at the layers by eye.
Writes $SHOTS/rigstrip_<tag>.png (one row per clip, 8 frames each). Usage: python3 rigstrip_ui.py PORT TAG [looks]"""
import asyncio, sys, os, tempfile, json
from playwright.async_api import async_playwright
_SHOTS = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
os.makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8884"
TAG = sys.argv[2] if len(sys.argv) > 2 else "now"
CLIPS = ["idle", "ready", "walk", "swing", "thrust", "power", "block", "bash", "bow", "cast", "hit", "stagger", "death"]
GEAR = [
    ("sword+shield", {"weapon": "steel_sword", "chest": "steel_armor", "shield": "iron_shield"}, True),
    ("greatsword", {"weapon": "iron_greatsword", "chest": "iron_armor"}, False),
    ("bow", {"weapon": "hunting_bow", "chest": "leather_armor"}, False),
    ("dual", {"weapon": "iron_sword", "offhand": "iron_dagger", "chest": "leather_armor"}, False),
]
JS = """async ([clips, gear]) => {
  const looks = [];
  for (const [name, eq, sh] of gear) for (const sx of ["m", "f"]) looks.push({ name: name + " " + sx, sh, L: { r: sx === "f" ? "imperial" : "nord", id: "strip-" + name + sx, sx: sx === "f" ? "f" : undefined, eq, gl: {} }, off: eq.offhand ? "dagger" : null });
  for (let t = 0; t < 160 && !looks.every((x) => PAINTRIG.can(x.L)); t++) await new Promise((r) => setTimeout(r, 250));
  document.documentElement.style.cssText = document.body.style.cssText = "overflow:visible;height:auto;position:static;margin:0";
  document.body.innerHTML = '<div id=sheet style="background:#1b1712;padding:4px;width:max-content"></div>';
  const sheet = document.getElementById("sheet");
  for (const x of looks) {
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:2px;margin-bottom:6px;align-items:flex-start";
    const lab = document.createElement("div"); lab.textContent = x.name; lab.style.cssText = "color:#e9dcc0;font:12px sans-serif;width:90px"; row.appendChild(lab);
    for (const clip of clips) {
      const c = document.createElement("canvas"); c.width = 8 * 110; c.height = 190; c.style.background = "#3a3128";
      const g = c.getContext("2d");
      for (let i = 0; i < 8; i++) { g.save(); g.translate(i * 110 + 48, 178); g.scale(2.4, 2.4);
        PAINTRIG.draw(g, x.L, { clip, u: i / 7, shield: x.sh, off: x.off, who: "strip" }); g.restore(); }
      g.fillStyle = "#e9dcc0"; g.font = "12px sans-serif"; g.fillText(clip, 4, 13);
      const wrap = document.createElement("div"); wrap.appendChild(c); row.appendChild(wrap);
      if (clip === "walk" || clip === "block" || clip === "cast") { const br = document.createElement("div"); br.style.flexBasis = "100%"; }
    }
    sheet.appendChild(row);
  }
  return looks.map((x) => x.name); }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await (await b.new_context(viewport={"width": 1900, "height": 1000})).new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets"); await pg.wait_for_timeout(1500)
        for clip in CLIPS:
            names = await pg.evaluate(JS, [[clip], GEAR])
            await pg.locator("#sheet").screenshot(path=_SHOTS + f"rigstrip_{TAG}_{clip}.png")
        print("errors:", errs[:3])
        await b.close()
asyncio.run(main())
