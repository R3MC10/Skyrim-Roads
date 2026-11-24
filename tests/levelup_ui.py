"""Levelling like Skyrim (levelup.js): the skill notice with skill + level bars, the LEVEL UP moment, the compass
"Level up" mark and the three pillars from Skills, on a phone and on a PC, in both art styles.
Usage: python3 levelup_ui.py PORT [outdir]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
HOST = os.environ.get("HOST", "localhost")
OUT = (sys.argv[2] if len(sys.argv) > 2 else "/home/claude/tests/levelup") .rstrip("/\\") + "/"
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def run(p, name, vp, mobile, style):
    exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://{HOST}:{PORT}/index.html?assets&net=bc&notut&hub=0&p=lv{name}{style}"); await pg.wait_for_timeout(1500)
    for _ in range(120):
        if await pg.query_selector("#nm"): break
        await pg.evaluate("(document.querySelector('.mi[data-t=new]')||document.querySelector('.press')||document.querySelector('#title'))?.click()"); await pg.wait_for_timeout(500)
    await pg.fill("#nm", "Sigrid"); await pg.evaluate("document.querySelector('#begin').click()")
    await pg.wait_for_function("window.__dbg && window.__dbg.save && window.__dbg.save()", timeout=60000); await pg.wait_for_timeout(1500)
    clear = "document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.lvn').forEach(m=>m.remove())"
    await pg.evaluate(clear)
    await pg.evaluate(f"()=>{{ ART.setStyle('{style}'); if (typeof POLISH!=='undefined') POLISH.texture(); }}")
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.discovered.push('Whiterun');
      S.level=6; S.charXp=60; S.skills['One-Handed'].lvl=35; S.skills['One-Handed'].xp=0; window.__ui.refresh(); }""")
    await pg.wait_for_timeout(600); await pg.evaluate(clear)
    ok(await pg.evaluate("LEVELUP.live"), f"{name}/{style}: levelup.js is mounted")
    # 1) a skill increase: one-handed 35 -> 36, level bar moves
    await pg.evaluate("""()=>{const S=__dbg.save(); const k=S.skills['One-Handed']; k.xp=F.skillXpNeeded('One-Handed',k.lvl)+F.skillXpNeeded('One-Handed',k.lvl+1)*0.4; G.useSkill(S,'One-Handed',0);}""")
    await pg.wait_for_timeout(1400)
    txt = await pg.evaluate("document.querySelector('#lvln .lvn-skill')?.innerText||''")
    ok("increased to 36" in txt or "wzrost do 36" in txt, f"{name}/{style}: skill notice: {txt!r}")
    ok(await pg.evaluate("!!document.querySelector('#lvln .lvn-skill .lvn-sb') && !!document.querySelector('#lvln .lvn-skill .lvn-xb')"), f"{name}/{style}: skill bar and level bar")
    await pg.screenshot(path=f"{OUT}{name}_{style}_1_skill.png")
    await pg.wait_for_timeout(2400)
    # 2) level up
    await pg.evaluate("""()=>{const S=__dbg.save(); S.charXp=F.charXpNeeded(S.level)-5; G.raiseSkill(S,'Smithing');}""")
    await pg.wait_for_timeout(3300)   # the skill line first, then LEVEL UP
    lvtxt = await pg.evaluate("document.querySelector('#lvln .lvn-level')?.innerText||''")
    ok("7" in lvtxt, f"{name}/{style}: LEVEL UP moment shows level 7: {lvtxt!r}")
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f"{OUT}{name}_{style}_2_levelup.png")
    ok(await pg.evaluate("__dbg.save().pendingLevels")==1, f"{name}/{style}: level-up banked")
    await pg.wait_for_timeout(3500); await pg.evaluate(clear)
    # 3) the compass shows Level up
    await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(900); await pg.evaluate(clear)
    ok(await pg.evaluate("!!document.querySelector('#tw .tw-lvlready') && !!document.querySelector('#tw .tw-lvgo')"), f"{name}/{style}: compass marks Skills and the level bar")
    await pg.screenshot(path=f"{OUT}{name}_{style}_3_compass.png")
    # 4) Skills from the compass: the pillars first
    await pg.click("#tw [data-twgo=char]"); await pg.wait_for_timeout(900)
    ok(await pg.evaluate("document.querySelectorAll('#lvlpick .lvk-p').length")==3, f"{name}/{style}: three pillars open from Skills")
    await pg.screenshot(path=f"{OUT}{name}_{style}_4_pillars.png")
    sp0 = await pg.evaluate("[G.maxStamina(__dbg.save()), G.capacity(__dbg.save())]")
    await pg.click("#lvlpick [data-lvk=stamina]"); await pg.wait_for_timeout(700)
    sp1 = await pg.evaluate("[G.maxStamina(__dbg.save()), G.capacity(__dbg.save()), __dbg.save().pendingLevels, !!document.querySelector('#lvlpick')]")
    ok(sp1[0]==sp0[0]+10 and sp1[1]==sp0[1]+5 and sp1[2]==0 and not sp1[3], f"{name}/{style}: stamina +10, carry +5, pillars close: {sp0} -> {sp1}")
    # banked: two waiting, the prompt on the Skills page, decide later keeps them
    await pg.evaluate("()=>{const S=__dbg.save(); S.pendingLevels=2; window.__ui.refresh();}"); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("!!document.querySelector('#side .lvlprompt')"), f"{name}/{style}: Level up prompt on the Skills page")
    await pg.screenshot(path=f"{OUT}{name}_{style}_5_prompt.png")
    await pg.click("#side .lvlprompt"); await pg.wait_for_timeout(500)
    await pg.click("#lvlpick [data-lvk=later]"); await pg.wait_for_timeout(400)
    ok(await pg.evaluate("__dbg.save().pendingLevels")==2 and not await pg.evaluate("!!document.querySelector('#lvlpick')"), f"{name}/{style}: decide later keeps both level-ups")
    ok(not errs, f"{name}/{style}: no page errors {errs[:3]}")
    await b.close()
async def main():
    async with async_playwright() as p:
        only = os.environ.get("ONLY", "")   # e.g. ONLY=pc_ink to rerun one
        for name, vp, mob, style in [("phone", {"width": 412, "height": 915}, True, "ink"), ("pc", {"width": 1440, "height": 900}, False, "ink")]:
            if not only or only == f"{name}_{style}": await run(p, name, vp, mob, style)
    print("FAILED" if fails else "levelup_ui ok", len(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
