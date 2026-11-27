"""The diorama road view (diorama.js) on real routes: Whiterun tundra, Riften autumn forest, the Falkreath pine forest,
on foot and riding, day / dusk / night / snow, phone-band and PC-band sizes. It drives DIORAMA.frame into a test box the
size of the travel band for a few seconds of walking.
Checks: no page errors, the diorama drew (three.js loaded lazily, WebGL ok), trees and plants were placed, you moved along
the road, the road never climbs steeper than DIOROUTE.GRADE, the canvas isn't blank; a region without a kit (marsh) and
Road view: Classic both hand back to the classic view.
Usage: python3 diorama_ui.py PORT [OUTDIR]"""
import asyncio, base64, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "out_diorama")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME")

RUN = """async ([o, d, region, riding, w, h, tod, weather, secs]) => {
  const S = window.__dbg.save(), look = HEROART.lookOf(S), A = WORLD.places[o], B = WORLD.places[d];
  const path = Terrain.route([A[0], A[1]], [B[0], B[1]]);
  let box = document.getElementById('diobox'); if (box) box.remove();
  box = document.createElement('div'); box.id = 'diobox'; box.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;z-index:99999;background:#000`;
  document.body.appendChild(box);
  const sky = SKY.make({ tod, weather, season: 'autumn', north: true });
  let i = Math.floor(path.length * 0.3), pos = path[i], t = 0, drew = 0, s0 = null;
  const info = () => ({ pos, path, idx: i, look, sky, dest: d, origin: o, riding, horse: { name: 'Plotka', coat: '#9b9b97' }, id: 'me', reduce: false });
  for (let f = 0; f < secs * 30; f++) {
    // the trip moves on like the game does (≈ 0.5 map px a second on foot, more riding)
    const mv = Terrain.moveAlong(path, i, pos, 1 / 30, riding ? 1.2 : 0.5); pos = mv.pos; i = mv.idx;
    t += 1 / 30;
    if (DIORAMA.frame(box, info(), 1 / 30, t, region)) { drew++; const dbg = DIORAMA.debug(); if (s0 == null) s0 = dbg.s; }
    await new Promise((r) => setTimeout(r, 33));
  }
  const cv = box.querySelector('canvas');
  const dbg = DIORAMA.debug();
  // grade check on the route profile
  const P = DIOROUTE.profile(path, (p) => FPREAL.heightAt(p)); let worst = 0;
  for (let k = 1; k < P.pts.length; k++) { const a = P.pts[k - 1], b = P.pts[k], run = b.s - a.s; if (run > 0.01) worst = Math.max(worst, Math.abs(b.y - a.y) / run); }
  let blank = true, url = null;
  if (cv) { const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 32; const g = c2.getContext('2d'); g.drawImage(cv, 0, 0, 64, 32);
    const px = g.getImageData(0, 0, 64, 32).data; let mn = 255, mx = 0; for (let q = 0; q < px.length; q += 4) { const l = px[q] + px[q + 1] + px[q + 2]; mn = Math.min(mn, l); mx = Math.max(mx, l); } blank = mx - mn < 40; url = cv.toDataURL('image/png'); }
  return { drew, dbg, moved: dbg && s0 != null ? dbg.s - s0 : 0, worst, blank, url };
}"""

async def main():
    fails = []
    async with async_playwright() as p:
        opts = {"args": ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
        if CHROME and os.path.exists(CHROME): opts["executable_path"] = CHROME
        b = await p.chromium.launch(**opts)
        ctx = await b.new_context(viewport={"width": 1000, "height": 700}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?notut&assets&diorama"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("localStorage.removeItem('rotn_roadview')")
        CASES = [("Whiterun", "Riverwood", "tundra", False, 390, 150, "day", "clear"),
                 ("Riften", "Ivarstead", "autumn", True, 390, 150, "dusk", "clear"),
                 ("Falkreath", "Riverwood", "pine", False, 960, 310, "day", "clear"),
                 ("Falkreath", "Riverwood", "pine", True, 960, 310, "night", "clear"),
                 ("Winterhold", "Dawnstar", "mountain", False, 960, 310, "day", "snow")]
        for (o, d, region, riding, w, h, tod, weather) in CASES:
            r = await pg.evaluate(RUN, [o, d, region, riding, w, h, tod, weather, 4])
            tag = f"{region}_{'ride' if riding else 'walk'}_{tod}_{weather}_{w}"
            if r["url"]:
                with open(os.path.join(OUT, tag + ".png"), "wb") as f: f.write(base64.b64decode(r["url"].split(",")[1]))
            dbg = r["dbg"] or {}
            print(tag, "drew", r["drew"], "moved %.1f m" % r["moved"], "props", dbg.get("props"), "worst grade %.3f" % r["worst"], "ms", round(dbg.get("ms") or 0, 1))
            if r["drew"] < 30: fails.append((tag, "diorama hardly drew", r["drew"]))
            if r["blank"]: fails.append((tag, "blank picture"))
            if sum((dbg.get("props") or {}).values()) < 20: fails.append((tag, "nothing grows", dbg.get("props")))
            if r["moved"] <= 0.3: fails.append((tag, "you didn't move along the road", r["moved"]))
            if r["worst"] > 0.1001: fails.append((tag, "road too steep", r["worst"]))
            if dbg.get("riding") != riding: fails.append((tag, "riding flag", dbg.get("riding")))
        # no kit for the marsh, and Road view: Classic → the classic view draws
        r = await pg.evaluate(RUN, ["Morthal", "Solitude", "marsh", False, 390, 150, "day", "clear", 1])
        if r["drew"]: fails.append(("marsh", "should keep the classic view"))
        await pg.evaluate("DIORAMA.setMode('classic')")
        r = await pg.evaluate(RUN, ["Falkreath", "Riverwood", "pine", False, 390, 150, "day", "clear", 1])
        if r["drew"]: fails.append(("classic", "Road view: Classic should keep the classic view"))
        await pg.evaluate("DIORAMA.setMode('diorama')")
        # the setting is in Settings → Look
        html = await pg.evaluate("DIORAMA.settingsHTML((k, opts, cur) => opts.map(o => o[1]).join('|'))")
        if "Diorama" not in html or "Classic" not in html: fails.append(("settings", html))
        await b.close()
    if errs: fails.append(("page errors", errs[:5]))
    print("pictures in", OUT)
    print("RESULT", "OK" if not fails else "FAIL")
    for f in fails: print("FAIL", f)

asyncio.run(main())
