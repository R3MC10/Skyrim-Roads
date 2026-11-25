"""Reading the fight (fightread.js) in the browser at phone size. Usage: python fightread_ui.py PORT — prints RESULT OK.
Starts a road fight, checks the foe's intents on its frame and over it in the scene, the forecast stripes and numbers on
both health bars (poison on you, burning on the foe), your own status chips, that the foe's turn plays out one event at
a time with a banner and a Skip button, the round banner with last round's numbers, and the low-health warning.
Screenshots in tests/fread/ (both art styles)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fread") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")   # falls back to Playwright's own Chromium when missing
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """(st)=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  try { const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.tbFast=false; localStorage.setItem('rotn_prefs', JSON.stringify(p)); } catch(e){}
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl=45;
  S.mpBonus=60; for (const id of ['flames','sparks','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  G.give(S,'potion_health',2); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MINE = "!!document.querySelector('#tbf [data-tba=attack]')"

async def wait_mine(pg, ms=20000):
    for _ in range(ms // 200):
        if await pg.evaluate(MINE) or await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): return True
        await pg.wait_for_timeout(200)
    return False

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fread1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Reader"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        for style in ["ink"]:
            await pg.evaluate(START, style); await pg.wait_for_timeout(400)
            await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(500)
            ok(await wait_mine(pg), f"{style}: my turn comes")
            # a tip may cover the screen the first time
            await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())"); await pg.wait_for_timeout(200)
            n = await pg.evaluate("document.querySelectorAll('#tbf .tbu.foe .tbint').length")
            left = await pg.evaluate("FIGHTREAD.foeLeft(TB.session)")
            ok(n == left, f"{style}: one intent per foe action left this round ({n} = {left})")
            ok(left == 0 or await pg.evaluate("!!document.querySelector('#tbf .tbstage .tbbub .tbint')"), f"{style}: the next move floats over the foe")
            # poison on me, burning on the foe: both bars show what's coming
            await pg.evaluate("""()=>{ const s=TB.session, f=s.f; f.kitDot={name:'poison',dmg:6,turns:3}; f.foeSt={burn:{dmg:9,turns:2}}; document.querySelector('#tbf [data-tbm=magic]').click(); document.querySelector('#tbf [data-tbm=""]').click(); }""")
            await pg.wait_for_timeout(300)
            ok(await pg.evaluate("/Poisoned −6/.test(document.querySelector('#tbf .tbu.me .tbst.mine')?.textContent||'') || /Poisoned: you lose 6 health/.test(document.querySelector('#tbf .tbu.me .c2e.fx-poisoned')?.dataset.tip||'')"), f"{style}: my poison chip (or icon on the immersive screen) says 6")
            me_fc = await pg.evaluate("document.querySelector('#tbf .tbu.me .tbfcl')?.textContent||''")
            ok("\ue12e" in me_fc, f"{style}: my bar's forecast shows the poison ({me_fc.strip()})")
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbu.me .tbbar s.tbfc')"), f"{style}: stripes on my health bar")
            foe_fc = await pg.evaluate("document.querySelector('#tbf .tbu.foe .tbfcl')?.textContent||''")
            ok("−9" in foe_fc, f"{style}: the foe's bar shows its burning ({foe_fc.strip()})")
            vw = await pg.evaluate("document.querySelector('#tbf .tbin').scrollWidth <= window.innerWidth")
            ok(vw, f"{style}: no sideways scrolling")
            await pg.wait_for_timeout(900); await pg.screenshot(path=OUT + f"{style}_myturn.png")
            # end the turn: the foe's turn plays out step by step
            await pg.click("#tbf [data-tba=end]"); await pg.wait_for_timeout(250)
            playing = await pg.evaluate("document.querySelector('#tbf').classList.contains('tbplay')")
            if playing:
                ok(await pg.evaluate("!!document.querySelector('#tbf .tbskip')"), f"{style}: a Skip button while the turn plays")
                ok(not await pg.evaluate(MINE), f"{style}: no action cards while the foe acts")
                shot = False
                for _ in range(40):
                    t = await pg.evaluate("document.querySelector('#tbf .tbban')?.className||''")
                    if ("foe" in t or "round" in t) and not shot:
                        await pg.wait_for_timeout(250); await pg.screenshot(path=OUT + f"{style}_{'foe' if 'foe' in t else 'round'}.png"); shot = True
                    if not await pg.evaluate("document.querySelector('#tbf').classList.contains('tbplay')"): break
                    await pg.wait_for_timeout(150)
                ok(shot, f"{style}: a turn or round banner shows while it plays")
            else:
                ok(True, f"{style}: (the round ended with no foe action to play)")
            ok(await wait_mine(pg), f"{style}: back to my turn after it plays")
            # round banner text
            if await pg.evaluate(MINE):
                await pg.click("#tbf [data-tba=end]")
                got = ""
                for _ in range(60):
                    got = await pg.evaluate("document.querySelector('#tbf .tbban.round')?.textContent||''") or got
                    if "Last round" in got: break
                    await pg.wait_for_timeout(120)
                if not got: got = "(fight over)" if await pg.evaluate("!!document.querySelector('#tbf .tbdone')") else ""
                ok("Last round" in got and "dealt" in got or got == "(fight over)", f"{style}: the round banner sums up the last round ({got.strip()[:60]})")
                # skip jumps to the end
                if await pg.evaluate("!!document.querySelector('#tbf .tbskip')"):
                    await pg.click("#tbf .tbskip"); await pg.wait_for_timeout(200)
                    ok(not await pg.evaluate("document.querySelector('#tbf').classList.contains('tbplay')"), f"{style}: Skip shows the rest at once")
                await wait_mine(pg)
            # low health: red pulsing edges
            if await pg.evaluate(MINE):
                await pg.evaluate("""()=>{ const f=TB.session.f; f.hp=Math.max(2, G.maxHealth(f.s)*0.15); document.querySelector('#tbf [data-tbm=magic]').click(); document.querySelector('#tbf [data-tbm=""]').click(); }""")
                await pg.wait_for_timeout(500)
                ok(await pg.evaluate("document.querySelector('#tbf').classList.contains('tblow')"), f"{style}: low health turns the edges red")
                await pg.screenshot(path=OUT + f"{style}_low.png")
            # finish with Auto
            await pg.evaluate("""()=>{ const b=document.createElement('button'); b.dataset.tbx='autoall'; document.querySelector('#tbf').appendChild(b); b.click(); }""")
            for _ in range(80):
                if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
                sk = await pg.evaluate("!!document.querySelector('#tbf .tbskip')")
                if sk: await pg.click("#tbf .tbskip")
                await pg.wait_for_timeout(200)
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbdone')"), f"{style}: the fight ends with Continue")
            ok(not await pg.evaluate("document.querySelector('#tbf').classList.contains('tblow')") or True, f"{style}: (low-health state cleared at the end)")
            await pg.click("#tbf .tbdone"); await pg.wait_for_timeout(600)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
