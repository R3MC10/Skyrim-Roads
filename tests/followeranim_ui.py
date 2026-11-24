"""Followers animate in the fight scene: a follower's strike ("Lydia hits 14", a turn-by-turn ally line) plays the
attack clip on her figure. Grabs two frames of her swing and checks the pixels where she stands really change (much
more than her idle breathing does), and that the scene reports her clip. Both art styles, one run.
Usage: python -m http.server 8765 --directory ../game &  then  python followeranim_ui.py 8765
Screenshots in tests/out_followeranim/."""
import asyncio, sys, os, io, re
from playwright.async_api import async_playwright
from PIL import Image, ImageChops
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out_followeranim") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
JS = re.search(r'JS = r"""(.*?)"""', open(os.path.join(HERE, "fight2_ui.py"), encoding="utf-8").read(), re.S).group(1)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

MOUNT = """(me)=>{ const f=__f2.synth('attack', me, 'Bandit outlaw', {ehp:286, end:270, them:'', allies:[{name:'Lydia', follower:true, fid:'lydia', kind:'follower'}]});
  f.tbMid = true; __f2.mount(f); const cv=document.querySelector('#f2box .fscene canvas'); return cv ? 1 : 0; }"""

def changed(a, b):   # share of pixels that changed noticeably
    d = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).convert("L").point(lambda v: 255 if v > 40 else 0)
    return sum(d.histogram()[255:]) / (a.width * a.height)

async def frames(pg, me, t1, t2):
    await pg.evaluate(MOUNT, me); await pg.wait_for_timeout(150)
    el = await pg.query_selector("#f2box .fscene")
    await pg.evaluate(f"FIGHTART.advance({t1})")
    c1 = await pg.evaluate("document.querySelector('#f2box .fscene canvas')?.dataset.allyClips || ''")
    a = Image.open(io.BytesIO(await el.screenshot()))
    await pg.evaluate(f"FIGHTART.advance({t2 - t1})")
    c2 = await pg.evaluate("document.querySelector('#f2box .fscene canvas')?.dataset.allyClips || ''")
    b = Image.open(io.BytesIO(await el.screenshot()))
    W = a.width; crop = (0, 0, int(W * 0.22), a.height)   # where the follower stands, behind you on the left
    return a, b, a.crop(crop), b.crop(crop), c1, c2

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        br = await p.chromium.launch(**kw)
        errs = []
        for style in ["ink", "pixel"]:
            ctx = await br.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, reduced_motion="reduce")   # a still camera, so only the figures move (and the scene plays at x2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, st=style: errs.append(st + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=fa{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Helper"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
            # her swing: wind-up vs the blow
            a, b, ca, cb, c1, c2 = await frames(pg, " · Lydia hits 14", 30, 215)
            ok(c1 == "attack" and c2 == "attack", f"{style}: the scene puts Lydia on her attack clip ({c1!r}, {c2!r})")
            swing = changed(ca, cb)
            # her idle while you swing: the same two moments
            _, _, ia, ib, i1, i2 = await frames(pg, "Attack: 25", 30, 215)
            ok(i1 == "idle", f"{style}: idle while you attack ({i1!r})")
            idle = changed(ia, ib)
            ok(swing > 0.01 and swing > idle * 2, f"{style}: her figure moves when she attacks ({swing:.3f} of pixels changed, idle {idle:.3f})")
            w, h = a.size; sheet = Image.new("RGB", (w * 2 + 6, h), (17, 17, 17)); sheet.paste(a.convert("RGB"), (0, 0)); sheet.paste(b.convert("RGB"), (w + 6, 0))
            sheet.save(f"{OUT}follower_attack_{style}.png")
            await ctx.close()
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await br.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
    sys.exit(1 if fails else 0)

asyncio.run(main())
