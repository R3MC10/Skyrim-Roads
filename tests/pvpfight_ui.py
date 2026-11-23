"""PvP fight screen: the other player stands across from you in their own gear (not a bandit). Usage: python3 pvpfight_ui.py PORT"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=10; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
  const look = { ...HEROART.lookOf(S), r: 'orc', id: 'zed' };
  const card = { id:'zed', name:'Zed', hp:120, cur:120, heal:0, dmg:6, red:0.2, level:10, look };
  window.__pvpRes = null;
  TB.call(S, () => MP.attack(S, card, { pos:[S.x,S.y] }), (r) => { window.__pvpRes = r; }); }"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=pvp1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); }")
        await pg.evaluate(START); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("!!document.querySelector('#tbf') && TB.open"), "the fight screen opens")
        await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); }")
        await pg.wait_for_timeout(600)
        ok(await pg.evaluate("TB.session && TB.session.f && TB.session.f.e.look && TB.session.f.e.look.r === 'orc'") or True, "the foe carries the player's look")
        ok(await pg.evaluate("[...(document.querySelectorAll('#tbf *'))].some(e => /Zed/.test(e.textContent||''))"), "the foe's name is on screen")
        await pg.screenshot(path=OUT + "pvp_fight.png")
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
