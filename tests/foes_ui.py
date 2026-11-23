"""Foe archetypes: a road fight against bandits shows their archetype gear and label. Usage: python3 foes_ui.py PORT"""
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
  const e = { name: 'Bandit ' + ARCH, health: 60, hp: 60, damage: 8, tags: ['humanoid'], red: 0.1, level: 10, danger: 'medium', gold: [5, 10], text: '' };
  TB.call(S, () => { const f = new G.Fight(S, e); f.allies = []; f.run({ t: G.now() }); return { fight: f, text: '' }; }, () => {}); }"""
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        for arch in ["archer", "mage", "brute"]:
          pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
          await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=foe{arch}&tb&fightanim"); await pg.wait_for_timeout(1800)
          await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
          await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
          await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); }")
          await pg.evaluate(START.replace("ARCH", repr(arch))); await pg.wait_for_timeout(900)
          await pg.evaluate("()=>{ const o=document.querySelector('[data-obt=off]'); o&&o.click(); }"); await pg.wait_for_timeout(500)
          nm = await pg.evaluate("document.querySelector('#tbf .tbu.foe .nm')?.innerText || ''")
          ok(arch.upper() in nm.upper(), f"{arch}: label in the foe frame: {nm!r}")
          await pg.locator("#tbf canvas").first.screenshot(path=OUT + f"foe_{arch}.png")
          await pg.close()
        ok(not errs, f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
