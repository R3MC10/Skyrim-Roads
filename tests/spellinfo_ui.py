"""Magic menu shows exact, colour-coded numbers with a dual-cast line; skills and perks show only what you have now.
Usage: python3 spellinfo_ui.py PORT — screenshots in tests/spellinfo/, prints RESULT OK."""
import asyncio, sys, os
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8846"
OUT = _SHOTS + "spellinfo/"; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=si1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=30; for (const k in S.skills) S.skills[k].lvl=60;
          S.spells=["flames","firebolt","ice_spike","lightning_bolt","healing","oakflesh","fear","conjure_familiar","flame_cloak","calm"];
          S.perks={armsman:2,bladesman:1,augmented_flames:1,novice_destruction:1}; }""")
        for style in ["ink"]:
            for sp, name, cls in [("firebolt", "Firebolt", "nv-fire"), ("ice_spike", "Ice Spike", "nv-frost"), ("lightning_bolt", "Lightning Bolt", "nv-shock"), ("healing", "Healing", "nv-heal"), ("oakflesh", "Oakflesh", "nv-buff"), ("fear", "Fear", "nv-debuff")]:
                await pg.evaluate(clear)
                await pg.evaluate("__ui.openMenu('magic')"); await pg.wait_for_timeout(300)
                await pg.evaluate(f"document.querySelector('#sky [data-act=skysel][data-id=\"spell:{sp}\"]')?.click()"); await pg.wait_for_timeout(300)
                txt = await pg.evaluate("document.querySelector('#sky .sky-detail')?.innerText || ''")
                html = await pg.evaluate("document.querySelector('#sky .sky-detail')?.innerHTML || ''")
                want = await pg.evaluate(f"(()=>{{const i=MAGIC.info(window.__dbg.save(),'{sp}'); return {{c:i.cost,d:i.dualCost}};}})()")
                ok(f"{want['c']} magicka" in txt, f"{style} {name}: shows cost {want['c']}")
                if want["d"] is not None: ok("dual cast" in txt.lower() and f"{want['d']} magicka" in txt, f"{style} {name}: dual cast line with {want['d']} magicka")
                ok(cls in html and "nv-mana" in html, f"{style} {name}: colour-coded ({cls})")
                if sp in ("firebolt", "fear") :
                    el = await pg.query_selector("#sky")
                    if el: await el.screenshot(path=OUT + f"magic_{style}_{sp}.png")
                await pg.evaluate("__ui.closeMenu()")
            # skills: no ladders
            await pg.evaluate("__ui.openMenu('skills')"); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('#sky [data-act=skysel][data-id=\"Sneak\"]')?.click()"); await pg.wait_for_timeout(300)
            stxt = await pg.evaluate("document.querySelector('#sky .sky-detail')?.innerText || document.querySelector('#sky')?.innerText || ''")
            ok(" at 100" not in stxt.split("Next level")[0] and "→" not in stxt, f"{style} skill shows only current values")
            el = await pg.query_selector("#sky")
            if el: await el.screenshot(path=OUT + f"skill_{style}.png")
            await pg.evaluate("__ui.closeMenu()")
            # perks list: current rank + next
            await pg.evaluate("__ui.go('hero')"); await pg.wait_for_timeout(400); await pg.evaluate(clear)
            await pg.evaluate("document.querySelector('[data-act=pskill][data-id=\"One-Handed\"]')?.click()"); await pg.wait_for_timeout(400)
            ptxt = await pg.evaluate("document.querySelector('#side')?.innerText || ''")
            ok("40% more damage" in ptxt and "Next: 60%" in ptxt and "20/" not in ptxt and "10/15/20" not in ptxt, f"{style} perks show current rank + next")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL {len(fails)}")
asyncio.run(main())
