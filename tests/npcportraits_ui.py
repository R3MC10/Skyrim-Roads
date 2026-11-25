"""Painted NPC portraits (npcart.js): with ?assets the Whiterun forge's talk card shows the painted picture (an img inside
.npcport) in a 64 px box on a phone and 96 px on a PC; without ?assets the drawing shows in the same box.
Run:  node tests/serve.js 9161   then   python tests/npcportraits_ui.py 9161 [shotdir]   -> prints RESULT OK"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "9161"
OUT = sys.argv[2] if len(sys.argv) > 2 else None
fails = []
GAME = os.environ.get("W") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "game")
HAVE = os.path.exists(os.path.join(GAME, "npc-adrianne-avenicci.webp"))
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

async def open_forge(pg, assets, vp, tag):
    q = "&assets" if assets else ""
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=npcp{tag}{q}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Nadia"); await pg.click("#begin"); await pg.wait_for_function("window.__dbg&&window.__dbg.save()", timeout=20000)
    await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=5000;}")
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("()=>window.__ui.go('town')"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("()=>{const e=[...document.querySelectorAll('[data-act=shop][data-id=blacksmith],[data-act=shop][data-id=forge]')].find(x=>x.offsetParent)||document.querySelector('[data-act=shop][data-id=blacksmith],[data-act=shop][data-id=forge]'); e&&e.click()}"); await pg.wait_for_timeout(500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        for vp, want, tag in [({"width": 390, "height": 844}, 64, "ph"), ({"width": 1920, "height": 1080}, 96, "pc")]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == "ph" else 1)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            # without pictures: the drawing in the slot
            await open_forge(pg, False, vp, tag + "0")
            r = await pg.evaluate("(()=>{const s=document.querySelector('.npctalk .npcport'); if(!s) return null; const b=getComputedStyle(s); return {w:parseFloat(b.width),h:parseFloat(b.height),ok:s.classList.contains('ok'),draw:!!(s.querySelector('img.npcdraw')||s.matches('img.npcport')),name:document.querySelector('.npctalk b')?.textContent}})()")
            ok(r and r["draw"] and not r["ok"], f"{tag}: drawing in the slot without ?assets {r}")
            ok(r and abs(r["w"] - want) < 1.5 and abs(r["h"] - want) < 1.5, f"{tag}: talk portrait {want}px box {r}")
            # with pictures (only once npc-adrianne-avenicci.webp is in the game folder and listed in ASSETS.NPC)
            if not HAVE: print("skip painted check: no npc-adrianne-avenicci.webp yet"); await ctx.close(); continue
            await open_forge(pg, True, vp, tag + "1")
            for _ in range(30):
                done = await pg.evaluate("!!document.querySelector('.npctalk .npcport.ok img.npcimg')")
                if done: break
                await pg.wait_for_timeout(200)
            r2 = await pg.evaluate("(()=>{const s=document.querySelector('.npctalk .npcport'); const im=s&&s.querySelector('img'); const b=s&&getComputedStyle(s); return s&&{w:parseFloat(b.width),h:parseFloat(b.height),src:im?.getAttribute('src'),nat:im?.naturalWidth}})()")
            ok(r2 and r2["src"] and "npc-adrianne-avenicci" in r2["src"] and r2["nat"] > 0, f"{tag}: painted picture in .npcport {r2}")
            ok(r2 and abs(r2["w"] - want) < 1.5, f"{tag}: same box with the picture {r2}")
            if OUT:
                os.makedirs(OUT, exist_ok=True)
                el = await pg.query_selector(".npctalk")
                if el: await el.screenshot(path=os.path.join(OUT, f"npcportrait_{tag}.png"))
            ok(not errs, f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
