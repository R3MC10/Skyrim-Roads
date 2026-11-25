"""Pet followers (pets.js): the Follower tab with Lydia and Meeko at phone width 390 and on a PC (1280):
two sections (Follower, Pet), each with its own Dismiss, no gear buttons for the pet, no sideways scroll; the Character
page lists both; dismissing the pet keeps the follower.
Usage: python3 pets_ui.py PORT   (screenshots go to $OUT or tests/out_pets/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_pets")) + os.sep
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
SETUP = """()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=500; S.level=12; S.thaneWhiterun=true;
 TOWNS.hire(S,'lydia'); PETS.adopt(S,'meeko'); window.__ui.refresh(); }"""
CLEAR = "setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner,.pban').forEach(m=>m.remove()),150)"
async def run(b, w, h, tag):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=pets{tag}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate(SETUP); await pg.evaluate(CLEAR)
    await pg.evaluate("window.__ui.go('follower')"); await pg.wait_for_timeout(500)
    txt = await pg.evaluate("document.querySelector('#side').innerText")
    ok("Lydia" in txt and "Meeko" in txt and "Pet" in txt, f"{tag}: Follower tab shows Lydia and Meeko")
    ok(await pg.evaluate("document.querySelectorAll('#side [data-op=petdismiss]').length") == 1, f"{tag}: the pet has its own Dismiss")
    ok(await pg.evaluate("!document.querySelector('#side .pet-panel [data-op=give],#side .pet-panel [data-op=equip],#side .pet-panel [data-op=best],#side .pet-panel .ft-gear')"), f"{tag}: no gear buttons for the pet")
    ok("don't wear gear" in txt, f"{tag}: says pets don't wear gear")
    ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"{tag}: no sideways page scroll")
    await pg.screenshot(path=OUT + f"tab_{tag}.png", full_page=False)
    await pg.evaluate("document.querySelector('#side .pet-panel')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    el = await pg.query_selector("#side .pet-panel")
    if el: await el.screenshot(path=OUT + f"pet_{tag}.png")
    await pg.evaluate("window.__ui.go('hero')"); await pg.wait_for_timeout(400)
    ok(await pg.evaluate("!!document.querySelector('#side .pet-line') && !!document.querySelector('#side .ft-line:not(.pet-line)')"), f"{tag}: Character page lists both")
    await pg.evaluate("window.__ui.go('follower')"); await pg.wait_for_timeout(300)
    await pg.click("#side [data-op=petdismiss]"); await pg.wait_for_timeout(400)
    st = await pg.evaluate("()=>{const S=window.__dbg.save(); return [S.follower&&S.follower.id, S.pet&&S.pet.id]}")
    ok(st[0] == "lydia" and not st[1], f"{tag}: dismissing Meeko keeps Lydia {st}")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await run(b, 390, 844, "phone")
        await run(b, 1280, 800, "pc")
        await b.close()
    print("FAILED " + str(len(fails)) if fails else "pets_ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
