"""Road view shows the real world (fpreal.js): pictures from real routes (Whiterun tundra, Riften autumn forest,
Winterhold snow, Markarth canyon, Morthal marsh, Dawnstar coast, Solstheim), alone and with a 3-player party (one
teammate riding her own horse, one on foot), a follower and a dog; riding and on foot; phone and PC size.
Checks: no page errors, the destination / real places are listed in the frame's debug, the skyline comes from the map,
the road bends come from the route, company is drawn (riders keep their horses).
Usage: python3 travelpov_ui.py PORT [OUTDIR]"""
import asyncio, base64, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "out_travelpov")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
ROUTES = [("Whiterun", "Riverwood", "tundra"), ("Riften", "Ivarstead", "autumn"), ("Winterhold", "Dawnstar", "snow"),
          ("Markarth", "Karthwasten", "canyon"), ("Morthal", "Solitude", "marsh"), ("Dawnstar", "Winterhold", "coast"),
          ("Raven Rock", "Skaal Village", "solstheim"), ("Whiterun", "Ivarstead", "throat")]
FRAMES = """([o, d, f, party, riding, w, h, tod, weather]) => {
  const S = window.__dbg.save(), look = HEROART.lookOf(S), A = WORLD.places[o], B = WORLD.places[d];
  const path = Terrain.route([A[0], A[1]], [B[0], B[1]]);
  const i = Math.max(0, Math.min(path.length - 2, Math.floor(path.length * f))), pos = path[i];
  const nx = path.slice(i + 1).find((q) => G.pxDist(pos, q) > 4) || B, brg = (a, b) => (Math.atan2((b[0] - a[0]) * 1000, -(b[1] - a[1]) * 700) * 180 / Math.PI + 360) % 360;
  const company = party ? [
    { name: 'Beta', player: true, riding: true, horse: '#ebe6da', look: { r: 'redguard', eq: { chest: 'steel_armor', head: 'steel_helmet', weapon: 'steel_sword', shield: 'steel_shield' } } },
    { name: 'Gamma', player: true, riding: false, look: { r: 'dunmer', eq: { chest: 'leather_armor', weapon: 'hunting_bow', cloak: 1 } } },
    { name: 'Lydia', follower: true, look: { r: 'nord', eq: { chest: 'steel_plate_armor', weapon: 'steel_sword', shield: 'steel_shield' } } },
  ] : [];
  const pets = party ? [{ name: 'Meeko', pet: true, kind: 'dog' }] : [];
  const sky = SKY.make({ tod, weather, season: 'autumn', north: true });
  const ground = (() => { try { return Terrain.NAMES[Terrain.typeAtPos(pos)]; } catch { return 'Road'; } })();
  const c = FPT.frame({ ground, pos, path, idx: i, look, sky, dest: d, origin: o, riding, horse: { name: 'Plotka', coat: '#9b9b97' }, heading: brg(pos, nx), turn: 0, destBear: brg(pos, B), company, pets, p: f, known: () => true }, { w, h, travel: 40 + f * 100, trip: 'pov' });
  return [c.toDataURL('image/png'), FPT.debug()];
}"""

async def main():
    fails = []
    async with async_playwright() as p:
        opts = {"args": ["--no-sandbox"]}
        if CHROME and os.path.exists(CHROME): opts["executable_path"] = CHROME
        b = await p.chromium.launch(**opts)
        ctx = await b.new_context(viewport={"width": 1000, "height": 700}); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        for (o, d, nm) in ROUTES:
            for (party, riding, size, tod, weather) in [(False, True, (390, 170), "day", "clear"), (True, True, (390, 170), "day", "clear"), (True, False, (960, 300), "dusk", "cloudy")]:
                url, dbg = await pg.evaluate(FRAMES, [o, d, 0.45, party, riding, size[0], size[1], tod, weather])
                tag = f"{nm}_{'party' if party else 'solo'}_{'ride' if riding else 'walk'}_{size[0]}"
                with open(os.path.join(OUT, tag + ".png"), "wb") as f: f.write(base64.b64decode(url.split(",")[1]))
                if not dbg: fails.append((tag, "no debug")); continue
                if not dbg.get("relief"): fails.append((tag, "no real skyline"))
                if not dbg.get("bend"): fails.append((tag, "no real bend"))
                if not (dbg.get("places") or []): fails.append((tag, "no real places round you"))
                if party and not any(m.startswith("+Beta") for m in dbg.get("mates") or []): fails.append((tag, "Beta should be riding", dbg.get("mates")))
                if party and not any("Meeko" in m for m in dbg.get("mates") or []): fails.append((tag, "dog missing", dbg.get("mates")))
                print(tag, "places:", (dbg.get("places") or [])[:6], "near:", (dbg.get("near") or [])[:4], "mates:", dbg.get("mates"))
        await b.close()
    if errs: fails.append(("page errors", errs[:5]))
    print("pictures in", OUT)
    print("RESULT", "OK" if not fails else "FAIL")
    for f in fails: print("FAIL", f)
    sys.exit(1 if fails else 0)
asyncio.run(main())
