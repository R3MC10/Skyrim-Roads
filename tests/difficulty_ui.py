"""Difficulty (difficulty.js) on a 390x844 phone and a 1920x1080 PC:
- hero creation's Start tab has the three difficulty cards; picking Hard is saved on the new hero;
- Settings has the Difficulty row (Story / Normal / Hard) under Fights, showing your pick; a tap changes it;
- the fight screen shows a small chip with the difficulty, fully on screen;
- changing the setting mid-fight doesn't change the fight that's on (the chip and the foe stay as they were).
Screenshots go to $SHOTS (or the temp folder) as difficulty_<tag>_<size>_<screen>.png.
Usage: python3 difficulty_ui.py PORT [tag]   (tag "before": the old game, screenshots only, no checks)"""
import asyncio, sys, os, time, tempfile
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
TAG = sys.argv[2] if len(sys.argv) > 2 else "after"
BEFORE = TAG == "before"
RUN = str(int(time.time()) % 100000)
OUT = (os.environ.get("SHOTS") or tempfile.gettempdir()) + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

HERO = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=12; S.follower=null; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; return true; }"""
ROAD = """()=>{ const S=window.__dbg.save();
  [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
SOLO = """()=>{ const pp=FOEGROUPS.prep; FOEGROUPS.prep=(f,pl)=>{ FOEGROUPS.prep=pp; pp(f,pl); return {n:1,hpMul:[1]}; }; }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CHIP = """()=>{ const c=document.querySelector('#tbf .tbtop .diffchip'); if (!c) return null; const r=c.getBoundingClientRect(), s=getComputedStyle(c);
  return { cls:c.className, text:c.textContent.trim(), l:r.left, t:r.top, r:r.right, b:r.bottom, vw:innerWidth, vh:innerHeight, shown: s.display!=='none' && s.visibility!=='hidden' && r.width>4 && r.height>4 }; }"""

async def boot(pg, size):
    for _ in range(5):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=df{RUN}{size}&tb"); await pg.wait_for_timeout(1800)
        if await pg.evaluate("typeof ENC!=='undefined' && typeof TB!=='undefined' && typeof FOEGROUPS!=='undefined'"):
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Thumbs")

async def case(b, w, h, errs):
    phone = w < 900
    size = f"{w}x{h}"
    kw = {"viewport": {"width": w, "height": h}, "device_scale_factor": 1}
    if phone: kw.update(has_touch=True, is_mobile=True)
    ctx = await b.new_context(**kw); pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{size} {e}"))
    await boot(pg, size)
    # hero creation: Start tab
    await pg.click("[data-cg=tab][data-tab=start]"); await pg.wait_for_timeout(400)
    if not BEFORE:
        cards = await pg.evaluate("[...document.querySelectorAll('.cgdiff')].map(b=>b.dataset.diff+(b.classList.contains('on')?'*':''))")
        ok(cards == ["story", "normal*", "hard"], f"{size}: three difficulty cards, Normal picked first {cards}")
        await pg.click(".cgdiff[data-diff=hard]"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('.cgdiffs').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
        on = await pg.evaluate("document.querySelector('.cgdiff.on')?.dataset.diff")
        ok(on == "hard", f"{size}: tapping Hard picks it ({on})")
        over = await pg.evaluate("Math.max(...[...document.querySelectorAll('.cgdiff')].map(b=>b.getBoundingClientRect().right))")
        ok(over <= w + 0.5, f"{size}: the cards fit the screen ({over:.0f} of {w})")
    await pg.screenshot(path=f"{OUT}difficulty_{TAG}_{size}_create.png")
    await pg.click("#begin"); await pg.wait_for_timeout(1500)
    if not BEFORE:
        d = await pg.evaluate("__dbg.save().diff")
        ok(d == "hard", f"{size}: the new hero is on Hard ({d})")
    # Settings
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); __ui.settings()"); await pg.wait_for_timeout(500)
    if not BEFORE:
        await pg.evaluate("document.querySelector('#modal .diffrow')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
        on = await pg.evaluate("document.querySelector('#modal .diffrow .seg button.on')?.dataset.v")
        ok(on == "hard", f"{size}: Settings shows Hard ({on})")
        await pg.click("#modal .diffrow [data-v=story]"); await pg.wait_for_timeout(400)
        st = await pg.evaluate("[__dbg.save().diff, document.querySelector('#modal .diffrow .seg button.on')?.dataset.v, document.querySelector('#modal .diffnote')?.textContent||'']")
        ok(st[0] == "story" and st[1] == "story" and "same on every difficulty" in st[2], f"{size}: tapping Story saves it and the note follows {st[:2]}")
        await pg.click("#modal .diffrow [data-v=hard]"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('#modal .diffrow')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    else:
        await pg.evaluate("[...document.querySelectorAll('#modal h3, #modal h4, #modal .setrow')].find(e=>/Fight/i.test(e.textContent))?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f"{OUT}difficulty_{TAG}_{size}_settings.png")
    # a road fight
    await pg.evaluate(HERO); await pg.evaluate(SOLO); await pg.evaluate(ROAD); await pg.wait_for_timeout(600)
    for _ in range(12):
        if await pg.evaluate("!!document.querySelector('#tbf')"): break
        await pg.evaluate("(()=>{ const b=document.querySelector('#modal [data-act=ev][data-c=fight]'); if (b) return b.click(); document.querySelectorAll('#modal').forEach(m=>m.remove()); if (__dbg.save().trip && __dbg.save().trip.event) __dbg.openEvent(); })()"); await pg.wait_for_timeout(500)
    for _ in range(60):
        await pg.evaluate("document.querySelectorAll('#obtip').forEach(e=>e.remove())")
        if await pg.evaluate(MYTURN): break
        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
            try: await pg.click("#tbf [data-tbx=skip]", timeout=3000)
            except Exception: pass
        await pg.wait_for_timeout(250)
    await pg.mouse.move(1, 1); await pg.wait_for_timeout(700)
    await pg.screenshot(path=f"{OUT}difficulty_{TAG}_{size}_fight.png")
    if not BEFORE:
        c = await pg.evaluate(CHIP)
        ok(bool(c) and c["shown"] and "d-hard" in c["cls"], f"{size}: the fight screen shows the Hard chip {c and c['cls']}")
        if c: ok(c["l"] >= 0 and c["t"] >= 0 and c["r"] <= c["vw"] + 0.5 and c["b"] <= c["vh"] + 0.5, f"{size}: the chip is fully on screen {[round(c[k]) for k in 'ltrb']}")
        dmg0 = await pg.evaluate("TB.session && TB.session.f.e.damage")
        # change the setting mid-fight: this fight keeps Hard
        await pg.evaluate("DIFF.set(__dbg.save(),'story'); TB.redraw && TB.redraw(TB.session)"); await pg.wait_for_timeout(400)
        st = await pg.evaluate("[TB.session && TB.session.f.diff.id, TB.session && TB.session.f.e.damage, document.querySelector('#tbf .tbtop .diffchip')?.className]")
        ok(st[0] == "hard" and st[1] == dmg0 and "d-hard" in (st[2] or ""), f"{size}: changing it mid-fight leaves this fight on Hard {st}")
    await ctx.close()

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(390, 844), (1920, 1080)]:
            await case(b, w, h, errs)
        await b.close()
    ok(not errs, f"no page errors {errs[:3]}")
    print("FAILED" if fails else "ALL OK", len(fails))
    sys.exit(1 if fails else 0)

asyncio.run(main())
