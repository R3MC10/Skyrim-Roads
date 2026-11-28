"""Pixel check for fight-screen performance work: two builds must draw the same fight screens.
Usage: python fightsame_ui.py PORT_A PORT_B   (serve the build to check on A and a reference build on B)
Dice are seeded and the clock is Playwright's (time only moves when the test moves it), so both builds play the
same fight frame for frame. Views: the fight opening, Magic open, back, Items open, back, after an attack, the foes'
turn played out, and the log opened. Env: SAME_OUT (where the pictures go), SAME_DPR=3 for 412x915@3x,
SAME_MOTION=no-preference to keep the idle animations (then the fighters' poses can differ by a frame between builds).
Fails if any view differs by more than a rounding hair."""
import asyncio, sys, os
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
A, B = sys.argv[1], sys.argv[2]
OUT = os.environ.get("SAME_OUT", "/tmp/fight_same")
DPR = float(os.environ.get("SAME_DPR", "2")); VW, VH = (412, 915) if DPR >= 3 else (360, 800)
SEED = r"""(() => { let s = 0x2f6b3a1d; window.__seed = (n) => { s = n >>> 0 || 1; }; Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; })();"""
async def shots(p, port):
    b = await p.chromium.launch(args=["--no-sandbox"])
    ctx = await b.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=DPR, has_touch=True, reduced_motion=os.environ.get("SAME_MOTION", "reduce"))   # still fighters: only the layout differs
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); await pg.add_init_script(SEED)
    url = f"http://localhost:{port}/index.html?net=bc&notut&tb&p=fsame{port}"
    await pg.goto(url); await pg.wait_for_selector(".press")
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Same"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.level=12; S.gold=900; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
      G.give(S,'iron_sword'); G.give(S,'potion_health',3); Store.save(S); }""")
    await pg.wait_for_timeout(800); await pg.close()
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script(SEED)
    rate = float(os.environ.get(f"SAME_RATE_{port}", os.environ.get("SAME_RATE", "1")))   # a slower phone (CPU slowdown), per port
    if rate != 1: await (await ctx.new_cdp_session(pg)).send("Emulation.setCPUThrottlingRate", {"rate": rate})
    await pg.clock.install(time=1764000000000)
    await pg.goto(url); await pg.clock.run_for(4000); await pg.wait_for_selector(".press")
    await pg.click(".press"); await pg.clock.run_for(800); await pg.click(".mi[data-t=continue]"); await pg.clock.run_for(4000)
    await pg.evaluate("""()=>{ __seed(77); document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
      S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
      const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
    await pg.clock.run_for(800)
    await pg.evaluate("()=>{ __seed(99); if(!document.getElementById('tbf')) document.querySelector('#modal [data-act=ev][data-c=fight]')?.click(); }")
    await pg.clock.run_for(3000)
    out = []
    async def settle(ms):   # the clock and the frames move together (frames run on real time)
        for _ in range(ms // 100): await pg.clock.run_for(100); await pg.wait_for_timeout(60)
    async def snap(name):
        await settle(1500)   # settle (the late layout passes, the scene's first frames)
        # the fight screen's layout can end up in one of two places depending on how fast the phone is (the log row is
        # shown or folded away by the pass that ran last): one more full pass on both builds, so the same rule decides
        for _ in range(2): await pg.evaluate("()=>{ const el=document.getElementById('tbf'); if (el && typeof COMBAT2!=='undefined') COMBAT2.place(el, true); }"); await settle(300)
        await pg.evaluate("document.querySelectorAll('.tip,#tooltip,.toast').forEach(e=>e.remove())")
        path = f"{OUT}/{port}_{name}.png"; await pg.screenshot(path=path); out.append((name, path))
    click = lambda sel: pg.evaluate("(s)=>{ __seed(s.length * 7919); const b=document.querySelector(s); b && b.click(); return !!b; }", sel)
    await snap("open")
    await click("#tbf [data-tbm=magic]"); await snap("magic")
    await click("#tbf .tbact.back"); await snap("back1")
    await click("#tbf [data-tbm=items]"); await snap("items")
    await click("#tbf .tbact.back"); await snap("back2")
    await click("#tbf [data-tba=attack]:not([disabled])"); await settle(4000); await snap("attack")
    await click("#tbf [data-tba=end]"); await settle(9000); await snap("foes")
    await click("#tbf .tbff"); await snap("log")
    await b.close(); return out, errs
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        ra, ea = await shots(p, A); rb, eb = await shots(p, B)
    bad = 0
    for (n, pa), (_, pb) in zip(ra, rb):
        ia, ib = Image.open(pa).convert("RGB"), Image.open(pb).convert("RGB")
        if ia.size != ib.size: print(n, "size differs", ia.size, ib.size); bad += 1; continue
        h = ImageChops.difference(ia, ib).convert("L").histogram(); n_ = sum(h)
        mean = sum(i * v for i, v in enumerate(h)) / n_; big = sum(h[24:]) / n_
        print(f"{n:8s} mean {mean:.3f}  >24/255: {big*100:.3f}%  max {max(i for i, v in enumerate(h) if v)}")
        if big > 0.01: bad += 1
    if ea or eb: print("page errors", ea[:3], eb[:3])
    print("FAIL" if bad else "OK: same picture"); sys.exit(1 if bad else 0)
if __name__ == "__main__":
    asyncio.run(main())
