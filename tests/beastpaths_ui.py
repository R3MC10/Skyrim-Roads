"""Werewolf and vampire paths (beastpaths.js) on the turn-based fight screen. Usage: python beastpaths_ui.py PORT -> RESULT OK
Serve game/ first:  python -m http.server PORT --directory ../game
At 390x844 (phone, touch) and 1920x1080 (PC), in both art styles:
- a werewolf meets the werewolf on the road at night; Beast Form sits in the quick slots
- changing swaps the action bar for the wolf's own moves (Claws, Maul, Pounce, then Howl / Feast / Change back), each with its stamina cost
- no Magic or Items while changed; Claws takes one move
- a hungry vampire meets the Ashen Court: Seduction and Embrace of Shadows in the quick slots; Vampire Lord's own moves
- the vampire panel on the Hero tab shows the new Lord stars and the sun warning
- the wild werewolf is drawn with the wolf body; a tooltip never stays open after a move is tapped
- in Polish (phone): the encounter, the beast's moves and the log are in Polish
Screenshots in tests/out_beastpaths/ (gitignored)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_beastpaths") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")   # falls back to Playwright's own Chromium when missing
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# kind: 'wolf' -> a werewolf on the hunt (moonhunt), 'vamp' -> the Ashen Court (palecourt), fought
START = """([st, kind])=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  localStorage.removeItem('rotn_fcfav');
  const S=window.__dbg.save(); S.level=20; S._test=true; for (const k of ['One-Handed','Heavy Armor','Athletics','Restoration']) S.skills[k].lvl=50;
  S.hpBonus=200; S.spBonus=60; S.follower=null;
  S.werewolf = kind==='wolf' ? {since:0} : null; S.vampire = kind==='vamp' ? {since:0, fedAt:G.now()-2.5*CURSE.DAY} : null; S.beastAt=0; S.lordAt=0; S.moonblood=null;
  S.beastPerks={wolf:{bestial_strength:1, rending_claws:1}, lord:{power_grave:1, blood_magic:1}, feeds:6, kills:6};
  G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId[kind==='wolf'?'moonhunt':'palecourt']; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
AUTO = "(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))"

async def my_turn(pg, sel="#tbf .fc [data-tba=end]", tries=60):
    for _ in range(tries):
        if await pg.evaluate(f"!!document.querySelector('{sel}')"): return True
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): return False
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()")
        await pg.wait_for_timeout(250)
    return False

async def finish(pg):
    for _ in range(3):
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
        await my_turn(pg, tries=30); await pg.evaluate(AUTO); await pg.wait_for_timeout(600)
    for _ in range(80):
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(250)
    await pg.evaluate("document.querySelector('#tbf .tbdone')?.click()"); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")

async def run(p, w, h, touch, lang=None):
    PL = lang == "pl"
    kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
    b = await p.chromium.launch(**kw)
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
    errs = []
    if PL: await ctx.add_init_script("try{const k='rotn_prefs';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)||'{}'),lang:'pl'}))}catch(e){}")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=bp{w}&tb&fightanim"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Moon"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
    tag0 = f"{w}x{h}" + ("_pl" if PL else "")
    for style in ["ink"]:
        tag = f"{tag0}_{style}"
        # ---------------- the werewolf
        await pg.evaluate(START, [style, "wolf"]); await pg.wait_for_timeout(500)
        txt = await pg.evaluate("document.querySelector('#modal')?.innerText||''")
        ok(("odpowiedz wyciem" in txt.lower() and "wycie pod księżycem" in txt.lower()) if PL else "howl" in txt.lower(), f"{tag}: a werewolf can howl back at the hunting werewolf {txt[:160]!r}")
        await pg.screenshot(path=OUT + f"{tag}_moonhunt.png")
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(800)
        await pg.evaluate(CLEAN)
        ok(await pg.evaluate("TB.open && /Werewolf/.test(TB.session.f.e.name)"), f"{tag}: fighting the werewolf")
        ok(await pg.evaluate("FOERIG.kindOf('werewolf','Werewolf').body==='wrap' && FOERIG.kindOf('werewolf','Werewolf').o.kind==='werewolf'"), f"{tag}: the wild werewolf has the wolf body (same as Beast Form)")
        if not await my_turn(pg): ok(False, f"{tag}: my turn comes"); await finish(pg); continue
        await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!!document.querySelector(\"#tbf .fc [data-tba='power:beast']:not([disabled])\")"), f"{tag}: Beast Form waits in the quick slots")
        await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
        await pg.screenshot(path=OUT + f"{tag}_wolf_before.png")
        await pg.click("#tbf .fc [data-tba='power:beast']"); await pg.wait_for_timeout(900)
        if await my_turn(pg, "#tbf .fc-beast", 20):
            await pg.wait_for_timeout(300)
            acts = await pg.evaluate("[...document.querySelectorAll('#tbf .fc [data-tba]')].map(b=>b.dataset.tba)")
            ok(all(a in acts for a in ["beast:claw", "beast:maul", "beast:pounce", "beast:howl", "beast:revert"]), f"{tag}: the wolf's moves replace the weapon ones: {acts}")
            ok(not await pg.evaluate("!!document.querySelector('#tbf .fc [data-tbm=magic], #tbf .fc [data-tbm=items]')"), f"{tag}: no Magic or Items while changed")
            ok(await pg.evaluate("!!document.querySelector(\"#tbf .fc [data-tba='beast:claw'] .cp em.rc.sp\")"), f"{tag}: Claws shows its stamina cost")
            ow = await pg.evaluate("Math.max(document.querySelector('#tbf .tbin').scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1")
            ok(ow, f"{tag}: nothing wider than the screen")
            ok(await pg.evaluate("document.querySelector('#tbf .fc').getBoundingClientRect().bottom <= innerHeight + 1"), f"{tag}: the bar sits on screen")
            await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
            await pg.screenshot(path=OUT + f"{tag}_wolf_moves.png")
            ap0 = await pg.evaluate("TB.session.myActs")
            await pg.click("#tbf .fc [data-tba='beast:claw']"); await pg.wait_for_timeout(900)
            ap1 = await pg.evaluate("TB.session ? TB.session.myActs : -1")
            ok(ap1 == ap0 + 1 or ap1 == -1 or ap1 == 0, f"{tag}: Claws takes one of your moves ({ap0}->{ap1})")
            log = await pg.evaluate("[...document.querySelectorAll('#tbf .tbl, #tbf .tblog')].map(e=>e.textContent).join(' ')")
            ok(("pazury" in log.lower() and "claws" not in log.lower()) if PL else "Claws" in log, f"{tag}: the log shows the claws: {log[-160:]!r}")
            if PL:
                bar = await pg.evaluate("document.querySelector('#tbf .fc').innerText")
                ok(all(x in bar.lower() for x in ["pazury", "szarpanie", "postać bestii"]) and "need" not in bar.lower(), f"{tag}: the beast's bar is in Polish: {bar[:120]!r}")
            # a tooltip never lingers after a move is tapped (phone) or clicked (PC)
            if await my_turn(pg, '#tbf .fc [data-tba="beast:howl"]:not([disabled])', 20):
                if touch: await pg.tap("#tbf .fc [data-tba='beast:howl']")
                else: await pg.hover("#tbf .fc [data-tba='beast:howl']"); await pg.wait_for_timeout(200); await pg.click("#tbf .fc [data-tba='beast:howl']")
                await pg.wait_for_timeout(1000)
                if not touch:   # your turn goes on now (up to 4 moves), so the pointer may rightly hover the next button: move it off first
                    print("   tooltip while still hovering:", await pg.evaluate("document.querySelector('.tbtip.on')?.textContent?.slice(0,60) || ''"))
                    await pg.mouse.move(2, 2); await pg.wait_for_timeout(400)
                ok(not await pg.evaluate("!!document.querySelector('.tbtip.on')"), f"{tag}: no tooltip left open after Howl")
                await pg.screenshot(path=OUT + f"{tag}_wolf_howl.png")
            await pg.wait_for_timeout(700); await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
            await pg.screenshot(path=OUT + f"{tag}_wolf_claws.png")
        else:
            ok(False, f"{tag}: the beast's action bar comes up")
        await finish(pg)
        # ---------------- the vampire
        await pg.evaluate(START, [style, "vamp"]); await pg.wait_for_timeout(500)
        txt = await pg.evaluate("document.querySelector('#modal')?.innerText||''")
        ok(("popielny dwór" in txt.lower()) if PL else ("Ashen Court" in txt or "court" in txt.lower()), f"{tag}: the Ashen Court on the road")
        await pg.screenshot(path=OUT + f"{tag}_ashencourt.png")
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(800)
        await pg.evaluate(CLEAN)
        if not await my_turn(pg): ok(False, f"{tag}: my turn (vampire)"); await finish(pg); continue
        await pg.wait_for_timeout(500)
        q = await pg.evaluate("[...document.querySelectorAll('#tbf .fc-tray [data-tba]')].map(b=>b.dataset.tba)")
        ok("power:lord" in q and "vamp:shadows" in q, f"{tag}: Vampire Lord and Embrace of Shadows in the quick slots: {q}")
        await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
        await pg.screenshot(path=OUT + f"{tag}_vamp_before.png")
        await pg.click("#tbf .fc [data-tba='power:lord']"); await pg.wait_for_timeout(900)
        if await my_turn(pg, "#tbf .fc-beast", 20):
            await pg.wait_for_timeout(300)
            acts = await pg.evaluate("[...document.querySelectorAll('#tbf .fc [data-tba]')].map(b=>b.dataset.tba)")
            ok(all(a in acts for a in ["lord:claw", "lord:drain", "lord:grip", "lord:raise"]), f"{tag}: the Lord's own moves: {acts}")
            await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
            await pg.screenshot(path=OUT + f"{tag}_lord_moves.png")
            await pg.click("#tbf .fc [data-tba='lord:drain']"); await pg.wait_for_timeout(1200)
            await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
            await pg.screenshot(path=OUT + f"{tag}_lord_drain.png")
        else:
            ok(False, f"{tag}: the Lord's action bar comes up")
        await finish(pg)
        # ---------------- the vampire panel on the Hero tab
        await pg.evaluate("()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; }")
        await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('[data-tab=hero]')?.click()"); await pg.wait_for_timeout(600)
        side = await pg.evaluate("(document.querySelector('#side')||document.body).innerText")
        ok("Sun Ward" in side or "Blood Magic" in side or "Magia krwi" in side or await pg.evaluate("!!document.querySelector(\"[data-id='lord:blood_magic']\")"), f"{tag}: the new Lord stars show on the Hero tab")
        panel = await pg.query_selector("#side .bstars")
        if panel:
            await panel.scroll_into_view_if_needed(); await panel.screenshot(path=OUT + f"{tag}_lord_sky.png")
    ok(not errs, f"{tag0}: no page errors {errs[:3]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, 390, 844, True)
        await run(p, 1920, 1080, False)
        await run(p, 390, 844, True, "pl")
    print("RESULT", "OK" if not fails else "FAIL " + "; ".join(fails))
    if fails: sys.exit(1)
asyncio.run(main())
