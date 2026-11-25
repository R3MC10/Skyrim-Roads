"""A brand-new character's first ~10 actions (onboard.js + the guided first trip), on two phone sizes and both art styles.
Run:  node tests/serve.js 9700   then   python tests/onboard_ui.py 9700 [outdir]
Screenshots land in outdir (default: onboard_shots in the temp folder). LOOK at them for confusing moments.
Fails on page errors, sideways scrolling, a tip that covers the fight buttons, and missing tips/ideas."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9700"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "onboard_shots")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
SIDEWAYS = "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
TIP = "document.querySelector('#obtip')?.innerText.replace(/\\n/g,' | ') || ''"
TUT = "document.querySelector('.tut')?.innerText.replace(/\\n/g,' | ') || ''"


async def run(b, vw, vh, style, fails):
    tag = f"{vw}_{style}"
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&tb"); await pg.wait_for_timeout(1200)
    n = [0]

    async def shot(name):
        n[0] += 1
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=os.path.join(OUT, f"{tag}_{n[0]:02d}_{name}.png"))
        if await pg.evaluate(SIDEWAYS): fails.append(f"{tag} {name}: page scrolls sideways")

    async def clear():
        for _ in range(6):
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
            elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
            else: break
        await pg.evaluate("typeof TABMENU!=='undefined' && TABMENU.closeHub?.(); document.querySelector('#sky')?.remove()")

    async def tab(t):
        # the tab bar may open the SkyUI menu instead of re-drawing the side panel; a Show-me style tap always re-draws it
        await clear(); await pg.evaluate(f"(()=>{{const b=document.createElement('button'); b.dataset.act='uxtab'; b.dataset.id='{t}'; b.hidden=true; document.querySelector('#side').appendChild(b); b.click();}})()"); await pg.wait_for_timeout(350); await clear()

    def check(cond, msg):
        if not cond: fails.append(f"{tag}: {msg}")

    # 1. create a character
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolf"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await clear(); await pg.evaluate("scrollTo(0,0)")
    await shot("start")
    t = await pg.evaluate(TUT); print(tag, "1 tutorial:", t)
    check("first trip" in t.lower(), "no first-trip tutorial")
    check(await pg.evaluate("document.querySelectorAll('.obrow').length") == 0, "ideas shown during the guided first trip")
    await pg.wait_for_timeout(800)
    tip = await pg.evaluate(TIP); print(tag, "1 welcome tip:", tip[:70]); check("first trip" in tip.lower(), "no welcome tip pointing at the first-trip card")
    if await pg.query_selector("#obtip [data-obt=go]"):
        await pg.click("#obtip [data-obt=go]"); await pg.wait_for_timeout(700); await shot("welcome_showme")
        check(await pg.evaluate("(()=>{const r=document.querySelector('#side .tut').getBoundingClientRect(); return r.top>=0 && r.top<innerHeight-60})()"), "Show me didn't bring the tutorial card into view")
    # 2. go to Whiterun
    await pg.click(".nextcard [data-act=go][data-place=Whiterun]"); await pg.wait_for_timeout(600); await clear()
    await tab("world"); await pg.evaluate("scrollTo(0,0)"); await shot("walking")
    t = await pg.evaluate(TUT); print(tag, "2 tutorial:", t); check("turn by turn" in t, "road step doesn't mention turn-by-turn fights")
    # 3. a wolf on the road
    await pg.evaluate("""(()=>{ const S=__dbg.save(); let e; for(let i=0;i<300;i++){ e=G.rollEncounter(S); if(e.kind!=='event' && e.health && e.danger!=='high') break; } e.hp=e.hp??e.health; e.danger='medium'; S.trip.status='encounter'; S.trip.encounter=e; __dbg.openEncounter(); })()""")
    await shot("encounter")
    enc = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
    check("turn by turn" in enc, "encounter sheet still says fights are automatic")
    # 4. fight it turn by turn: one-line hints pinned to the turn order and the moves, not covering any button (overlays task)
    await pg.click("#modal [data-act=enc][data-a=fight]"); await pg.wait_for_timeout(2500)
    await shot("fight_tip")
    hints = await pg.evaluate("[...document.querySelectorAll('#fhints .fhint:not([hidden])')].map(e=>e.innerText).join(' | ')"); print(tag, "4 fight hints:", hints[:120])
    check("turn order" in hints.lower(), "no turn-order hint in the first fight")
    check(await pg.evaluate("!document.querySelector('#obtip')"), "a tip card over the fight")
    covered = await pg.evaluate("""(()=>{ const out=[]; for (const t of document.querySelectorAll('#fhints .fhint:not([hidden])')) { const r=t.getBoundingClientRect(); for (const b of document.querySelectorAll('#tbf .tbact')) { const q=b.getBoundingClientRect(); if (q.width && q.bottom>r.top && q.top<r.bottom && q.right>r.left && q.left<r.right) out.push(b.innerText.split('\\n')[0]); } } return out; })()""")
    check(not covered, f"fight hints cover buttons {covered}")
    await pg.click("#fhints .fhint"); await pg.wait_for_timeout(400)
    check(await pg.evaluate("document.querySelectorAll('#fhints .fhint').length") <= 1, "a tapped hint didn't go away")
    if await pg.query_selector("#tbf .tbgrid"): await pg.evaluate("(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()")
    for _ in range(80):
        if await pg.query_selector("#tbf [data-tbx=done]"): break
        await pg.wait_for_timeout(250)
    await shot("fight_end")
    if await pg.query_selector("#tbf [data-tbx=done]"): await pg.click("#tbf [data-tbx=done]"); await pg.wait_for_timeout(700)
    await shot("fight_result"); await clear()
    # 5. arrive in Whiterun, then the tutorial's Town / Journal steps
    await pg.evaluate("(()=>{const S=__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.setHealth(S, G.maxHealth(S));})()"); await pg.wait_for_timeout(1500); await clear()
    await tab("world"); await pg.evaluate("scrollTo(0,0)"); await shot("arrived")
    print(tag, "5 tutorial:", await pg.evaluate(TUT))
    await tab("town"); await shot("town")
    await tab("log"); await tab("hero"); await pg.wait_for_timeout(800); await shot("hero_done")
    t = await pg.evaluate(TUT); print(tag, "6 after tutorial:", t)
    # 6. first level-up: tip, then its button opens Hero
    await pg.evaluate("__dbg.save().pendingLevels=1"); await pg.wait_for_timeout(1500)
    await shot("levelup_tip"); tip = await pg.evaluate(TIP); print(tag, "7 level tip:", tip[:80])
    check("level up" in tip.lower(), "no level-up tip")
    if await pg.query_selector("#obtip [data-obt=go]"): await pg.click("#obtip [data-obt=go]"); await pg.wait_for_timeout(500)
    check(await pg.evaluate("!!document.querySelector('[data-tab=hero].on')"), "Open Hero didn't open Hero")
    await shot("hero")
    await pg.evaluate("(()=>{const S=__dbg.save(); G.levelUp(S,'health');})()")
    # 7. over-encumbered
    await pg.evaluate("(()=>{const S=__dbg.save(); G.give(S,'mat_iron',400);})()"); await pg.wait_for_timeout(1500)
    tip = await pg.evaluate(TIP); print(tag, "8 heavy tip:", tip[:60]); check("heavy" in tip.lower(), "no over-encumbered tip")
    await tab("world"); await pg.evaluate("scrollTo(0,0)"); await shot("heavy_tip")
    await pg.click("#obtip [data-obt=ok]")
    # 8. the ideas in What to do next (mappanel.js shows 5 rows; ideas sort last, so open "Show more" when it's there)
    await pg.evaluate("document.querySelector('[data-mp=more][aria-expanded=false]')?.click()"); await pg.wait_for_timeout(300)
    nx = await pg.evaluate("[...document.querySelectorAll('.obrow .t')].map(x=>x.firstChild.textContent.trim())"); print(tag, "9 ideas:", nx)
    check(1 <= len(nx) <= 3, f"expected 1-3 ideas, got {nx}")
    await pg.evaluate("document.querySelector('.nextcard')?.scrollIntoView({block:'start'})"); await shot("ideas")
    await pg.evaluate("(()=>{const S=__dbg.save(); S.inv=S.inv.filter(r=>r.item!=='mat_iron');})()")
    first = nx[0] if nx else ""
    if await pg.query_selector(".obrow .obx"): await pg.click(".obrow .obx"); await pg.wait_for_timeout(400)   # no ideas is already a failed check above: carry on
    nx2 = await pg.evaluate("[...document.querySelectorAll('.obrow .t')].map(x=>x.firstChild.textContent.trim())")
    check(first not in nx2, "hiding an idea didn't hide it")
    # a level 3 with gold: a dungeon and a horse come up
    await pg.evaluate("(()=>{const S=__dbg.save(); S.level=3; S.pendingLevels=0; S.gold=1400; S.lt={...(S.lt||{}), foes:9};})()"); await pg.wait_for_timeout(1200); await tab("world")
    print(tag, "state:", await pg.evaluate("(()=>{const S=__dbg.save(); return [S.level, S.gold, S.lt.foes, JSON.stringify(S.onb.hid)]})()"))
    await pg.evaluate("document.querySelector('[data-mp=more][aria-expanded=false]')?.click()"); await pg.wait_for_timeout(300)
    nx3 = await pg.evaluate("[...document.querySelectorAll('.obrow .t')].map(x=>x.firstChild.textContent.trim())"); print(tag, "10 ideas lvl3:", nx3)
    # the card drops an idea for a place another row already sends you to (mappanel.js), so the dungeon may come as the quest's Go
    dgo = await pg.evaluate("[...document.querySelectorAll('.nextcard [data-act=go][data-place]')].map(b=>b.dataset.place).filter(n=>DUNGEONS.enterable(n))")
    check((any("dungeon" in x.lower() for x in nx3) or dgo) and not any("road fights" in x.lower() for x in nx3), f"level 3 with gold: expected a dungeon to go to, got {nx3} / {dgo}")
    cand = await pg.evaluate("ONBOARD.candidates(__dbg.save(), {}).map(c=>c.id)"); check("horse" in cand and "dungeon" in cand, f"no horse/dungeon among the ideas: {cand}")
    await pg.evaluate("document.querySelector('.nextcard')?.scrollIntoView({block:'start'})"); await shot("ideas_lvl3")
    # 9. first dungeon
    dn = await pg.evaluate("(()=>{const S=__dbg.save(); const n=Object.keys(WORLD.places).filter(x=>DUNGEONS.enterable(x)).sort((a,b)=>G.pxDist([S.x,S.y],WORLD.places[a])-G.pxDist([S.x,S.y],WORLD.places[b]))[0]; S.location=n; [S.x,S.y]=WORLD.places[n]; if(!S.discovered.includes(n)) S.discovered.push(n); return n;})()")
    await tab("world")
    if await pg.query_selector("#side [data-act=enter]"):
        await pg.click("#side [data-act=enter]"); await pg.wait_for_timeout(1800)
        tip = await pg.evaluate(TIP); print(tag, "11 dungeon", dn, "tip:", tip[:60]); check("dungeon" in tip.lower(), "no first-dungeon tip")
        await shot("dungeon_tip")
        cover = await pg.evaluate("""(()=>{ const t=document.querySelector('#obtip'); if(!t || t.classList.contains('obwait')) return 'waiting';
          const a=t.getBoundingClientRect(); return [...document.querySelectorAll('#dun .dstrip button, #dun .dstrip')].filter(e=>{const b=e.getBoundingClientRect();
          return b.height>0 && a.left<b.right && b.left<a.right && a.top<b.bottom && b.top<a.bottom;}).length; })()""")
        check(cover == 0 or cover == "waiting", f"the dungeon tip covers the route strip ({cover})")
        await pg.click("#obtip [data-obt=off]"); await pg.wait_for_timeout(300)
        check(await pg.evaluate("ONBOARD.tipsOn()===false && !document.querySelector('#obtip')"), "Don't show tips didn't stick")
        await pg.evaluate("(()=>{const S=__dbg.save(); S.dungeon=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; document.querySelector('#dun')?.remove();})()")
    else:
        fails.append(f"{tag}: no Go inside at {dn}")
    # 10. switch the ideas off, then back on in Settings (at the biggest text size)
    await tab("world")
    if await pg.query_selector(".obfoot [data-ob=off]"): await pg.click(".obfoot [data-ob=off]"); await pg.wait_for_timeout(300)
    check(await pg.evaluate("document.querySelectorAll('.obrow').length") == 0, "ideas still shown after turning off")
    if await pg.evaluate("typeof ACCESS!=='undefined'"): await pg.evaluate("ACCESS.pref('a11yText','3')")
    await clear(); await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
    await pg.evaluate("[...document.querySelectorAll('#modal h3')].find(h=>/Help/.test(h.textContent))?.scrollIntoView({block:'start'})")
    await shot("settings_biggest")
    over = await pg.evaluate("[...document.querySelectorAll('#modal .setrow .seg button')].filter(b=>b.getBoundingClientRect().right>innerWidth+1).length")
    check(over == 0, "settings buttons stick out at biggest text")
    await pg.click("#modal [data-k=obNext][data-v=true]"); await pg.wait_for_timeout(300)
    check(await pg.evaluate("ONBOARD.ideasOn()"), "turning ideas back on didn't stick")
    await clear(); await tab("world")
    check(await pg.evaluate("document.querySelectorAll('.obrow').length") > 0, "ideas didn't come back")
    await pg.evaluate("document.querySelector('.nextcard')?.scrollIntoView({block:'start'})"); await shot("ideas_biggest")
    if await pg.evaluate("typeof ACCESS!=='undefined'"): await pg.evaluate("ACCESS.pref('a11yText','0')")
    # veterans don't get ideas
    await pg.evaluate("__dbg.save().level=20"); await tab("world")
    check(await pg.evaluate("document.querySelectorAll('.obrow').length") == 0, "a veteran still gets ideas")
    if errs: fails.append(f"{tag} page errors: {errs[:3]}")
    await ctx.close()


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        for vw, vh in [(360, 780), (412, 915)]:
            for style in ["ink"]:
                await run(b, vw, vh, style, fails)
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("OK")

asyncio.run(main())
