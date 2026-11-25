# Forging mini-game (smithgame.js) on phones and PCs: every step shows, the bot plays it through, quick craft and the
# real forge button work, no page errors. Saves mgsmith_<phase>_<size>.png into the out folder.
#   python3 smithgame_ui.py 8765 [out_dir]
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_smithgame")
os.makedirs(OUT, exist_ok=True)
SIZES = [("phone360", 360, 780, 3, True), ("phone412", 412, 915, 2.625, True), ("pc1920", 1920, 1080, 1, False), ("pc3440", 3440, 1440, 1, False)]
CHROME = "/usr/bin/google-chrome"
HOST = os.environ.get("HOST", "localhost")

async def main():
    async with async_playwright() as p:
        kw = {"args": ["--no-sandbox"]}
        if os.path.exists(CHROME): kw["executable_path"] = CHROME
        b = await p.chromium.launch(**kw)
        errs, res = [], {}
        for name, w, h, dpr, touch in SIZES:
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, has_touch=touch, is_mobile=touch)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://{HOST}:{PORT}/index.html?net=bc&notut&craftgame&assets&p=sg{name}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Smith"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.give(S,'mat_iron',20); G.give(S,'mat_strips',10);}")
            shot = lambda ph: pg.screenshot(path=os.path.join(OUT, f"mgsmith_{ph}_{name}.png"))
            # the pictures must be in before we look
            await pg.evaluate("window.__r=null; CG.run('hammer',{skill:25,skillName:'Smithing',what:'Iron Sword',id:'iron_sword',s:window.__dbg.save()},(g)=>window.__r=g)")
            await pg.wait_for_selector("#smithgame", timeout=5000)
            await pg.wait_for_function("['mg-smithing-bg','mg-smith-blade1','mg-smith-hammer','mg-smith-tongs'].every(k=>ASSETS.state(k)!=='loading')", timeout=15000)
            # 1. heat: pump, then look while the glow sits in the band
            await pg.evaluate("window.__bot=setInterval(()=>{const S=SMITHGAME.state(); if(S && !window.__hold) SMITHGAME.botStep(S,1)},16)")
            await pg.wait_for_function("SMITHGAME.state()?.phase==='heat' && SMITHGAME.state().pt>2.2", timeout=10000)
            await shot("1heat")
            # 2. hammer: a spot with its ring, then sparks right after a blow
            await pg.wait_for_function("SMITHGAME.state()?.phase==='hammer' && SMITHGAME.state().spot && SMITHGAME.state().spot.t > SMITHGAME.state().spot.T*0.55", timeout=15000)
            await pg.evaluate("window.__hold=1"); await pg.wait_for_timeout(120); await shot("2hammer"); await pg.evaluate("window.__hold=0")
            n0 = await pg.evaluate("SMITHGAME.state().strikes.length")
            await pg.wait_for_function(f"SMITHGAME.state()?.strikes.length>{n0}", timeout=25000); await pg.wait_for_timeout(150)
            await shot("3sparks")
            # 3. cooling: let the metal go cold, the Reheat button lights up
            await pg.wait_for_function("(()=>{const S=SMITHGAME.state(); if(S?.phase!=='hammer') return false; window.__hold=1; S.temp=S.T.lo-0.12; return true})()", timeout=25000)
            await pg.wait_for_timeout(350); await shot("4cold")
            res[name + "_reheat_btn"] = await pg.evaluate("!document.querySelector('#sgreheat').hidden && document.querySelector('#sgreheat').classList.contains('sgwarn')")
            await pg.click("#sgreheat"); await pg.wait_for_timeout(200)
            res[name + "_reheated"] = await pg.evaluate("SMITHGAME.state().phase")
            await pg.evaluate("window.__hold=0")
            # the rough blade after three strikes
            await pg.wait_for_function("SMITHGAME.state()?.phase==='hammer' && SMITHGAME.state().stage===2 && SMITHGAME.state().spot && SMITHGAME.state().spot.t > SMITHGAME.state().spot.T*0.5", timeout=30000)
            await pg.evaluate("window.__hold=1"); await pg.wait_for_timeout(100); await shot("5rough"); await pg.evaluate("window.__hold=0")
            # 4. quench and steam
            await pg.wait_for_function("SMITHGAME.state()?.phase==='quench' && SMITHGAME.state().pt>1", timeout=40000)
            await pg.evaluate("window.__hold=1"); await shot("6quench"); await pg.evaluate("window.__hold=0")
            await pg.wait_for_function("SMITHGAME.state()?.phase==='steam' && SMITHGAME.state().pt>0.45", timeout=15000)
            await shot("7steam")
            # 5. the finished blade
            await pg.wait_for_function("SMITHGAME.state()?.phase==='reveal' && SMITHGAME.state().pt>1.1", timeout=10000)
            await shot("8reveal")
            await pg.wait_for_function("window.__r", timeout=8000)
            res[name + "_grade"] = await pg.evaluate("window.__r")
            # every picture the game used has loaded by the end (the later blade stages load as they're needed)
            res[name + "_art"] = await pg.evaluate("['mg-smithing-bg','mg-smith-blade1','mg-smith-blade2','mg-smith-blade3','mg-smith-blade4','mg-smith-hammer','mg-smith-tongs'].map(k=>ASSETS.state(k))")
            await pg.evaluate("clearInterval(window.__bot)")
            if name == "phone412":
                # quick craft from the real forge button: plain result, no game left on screen
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                for sel in ["[data-tab=map]", "[data-tab=town]", "[data-id=forge]"]:
                    try: await pg.click(sel, timeout=3000)
                    except Exception: pass
                    await pg.wait_for_timeout(300)
                await pg.click("[data-act=smake][data-id=iron_dagger]", timeout=5000)
                await pg.wait_for_selector("#smithgame", timeout=5000)
                await pg.click("#sgquick"); await pg.wait_for_selector("#smithgame", state="detached", timeout=3000)
                res["quick"] = await pg.evaluate("(()=>{const r=window.__dbg.save().inv.filter(r=>r.item==='iron_dagger').pop(); return [!!r, r?.mw||null, r?.temper||0]})()")
            res[name + "_hscroll"] = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            await ctx.close()
        print("results:", res)
        print("errors:", errs)
        ok = (all(res[n + "_grade"] in ("great", "masterful", "perfect") for n, *_ in SIZES) and res.get("quick") == [True, None, 0]
              and all(res[n + "_reheat_btn"] and res[n + "_reheated"] == "heat" for n, *_ in SIZES)
              and all(v == "ok" for n, *_ in SIZES for v in res[n + "_art"]) and not any(res[n + "_hscroll"] for n, *_ in SIZES) and not errs)
        print("RESULT", "OK" if ok else "FAIL")
        await b.close()
asyncio.run(main())
