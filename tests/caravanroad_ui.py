# Meeting a caravan while travelling (caravanroad.js): the map ring, tapping the wagons, the meeting, trading, guarding.
# Serve game/ first:  node serve.js 8765   then   python3 caravanroad_ui.py 8765
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_caravans")
os.makedirs(OUT, exist_ok=True)
EXE = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

SETUP = """(off)=>{
  const S = window.__dbg.save(), t = G.now();
  const c = CARAVANS.all(t).filter(x => x.phase === 'road').sort((a, b) => Math.abs(CVROAD.frac(a, t) - 0.45) - Math.abs(CVROAD.frac(b, t) - 0.45))[0];
  if (!c) return null;
  const p = CARAVANS.pos(c, t), q = CARAVANS.pos(c, t - 90);   // a spot behind the wagons on their road
  const d = G.pxDist(p, q) || 1, k = off / d;
  S.location = null; S.dungeon = null; S.x = p[0] + (q[0] - p[0]) * k; S.y = p[1] + (q[1] - p[1]) * k;
  S.gold = 600; S.level = 18; for (const s of Object.keys(S.skills)) S.skills[s].lvl += 15; G.setHealth(S, G.maxHealth(S));
  for (const n of [c.from, c.to]) if (!S.discovered.includes(n)) S.discovered.push(n);
  S.trip = null; G.startTrip(S, c.to, WORLD.places[c.to].slice(0, 2), t);
  return { id: c.id, name: c.line.name, to: c.to, d: G.pxDist([S.x, S.y], CARAVANS.pos(c, t)) };
}"""
TAP = """(id)=>{
  const v = window.__dbg.view(), c = (v.caravans || []).find(x => x.id === id); if (!c || !v.transform) return null;
  const r = document.querySelector('#map').getBoundingClientRect(), { k, ox, oy } = v.transform;
  return { x: r.left + c.pos[0] * WorldMap.W * k + ox, y: r.top + c.pos[1] * WorldMap.H * k + oy - 6, near: !!c.near };
}"""

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=EXE, args=["--no-sandbox"]) if EXE else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        for attempt in range(5):   # a busy local server sometimes drops a script; load again
            await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets&p=cvr")
            try: await pg.wait_for_selector(".press", timeout=20000); break
            except Exception: print("reloading, load errors:", errs[:3]); errs.clear()
        errs.clear()
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.add_style_tag(content=".pban{display:none!important}")   # celebration banners would cover the map
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        for style in ("ink",):
            await pg.wait_for_function("typeof G !== 'undefined' && !!window.__dbg && !!window.__dbg.save()")
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            info = await pg.evaluate(SETUP, 38)
            print(style, "caravan:", info); await pg.wait_for_timeout(7000); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
            if await pg.evaluate("document.querySelector('#zoomBtn')?.textContent.trim() === '＋'"): await pg.click("#zoomBtn")
            await pg.evaluate("document.querySelector('#mapwrap')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=os.path.join(OUT, f"map_near_{style}.png"))
            spot = await pg.evaluate(TAP, info["id"])
            print("  tap at", spot)
            if not spot: print("  no caravan on the map; errors:", errs[:5]); break
            await pg.mouse.click(spot["x"], spot["y"]); await pg.wait_for_timeout(1200)
            ok = await pg.evaluate("!!document.querySelector('#modal [data-act=ev][data-c=trade]')")
            print("  meeting open:", ok, "| choices:", await pg.evaluate("[...document.querySelectorAll('#modal [data-act=ev]')].map(b=>b.textContent).join(' / ')"))
            await pg.screenshot(path=os.path.join(OUT, f"meet_{style}.png"))
            if style == "ink":
                await pg.click("#modal [data-act=ev][data-c=news]"); await pg.wait_for_timeout(700)
                await pg.screenshot(path=os.path.join(OUT, f"news_{style}.png"))
                await pg.click("#modal [data-act=ev][data-c=trade]"); await pg.wait_for_timeout(700)
                await pg.screenshot(path=os.path.join(OUT, f"trade_{style}.png"))
                await pg.click("#modal [data-act=ev][data-c=leave]"); await pg.wait_for_timeout(500)
            else:
                await pg.click("#modal [data-act=ev][data-c=escort]"); await pg.wait_for_timeout(900)
                await pg.screenshot(path=os.path.join(OUT, f"escort_{style}.png"))
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                print("  job:", await pg.evaluate("JSON.stringify(window.__dbg.save().caravanJob)"), "trip.caravan:", await pg.evaluate("window.__dbg.save().trip?.caravan"))
                await pg.wait_for_timeout(800)
                await pg.screenshot(path=os.path.join(OUT, f"escort_map_{style}.png"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
