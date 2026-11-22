"""Reminders screen test (remind.js): the Today card, the number badges and the Go buttons, on two phone sizes,
both art styles and the biggest text size.
Run:  python -m http.server 9550 --directory game   then   python tests/remind_ui.py 9550 [outdir]
Screenshots land in outdir (default: remind_shots in the temp folder). Fails on page errors, sideways scrolling,
things sticking out of the screen, a missing card/badge, or a Go button that goes to the wrong place."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9550"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "remind_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
OVERFLOW = """(()=>{ const W=innerWidth, bad=[];
  for (const e of document.querySelectorAll('.rmd-card, .rmd-card .item, .rmd-card button, .tab, .rmd-b, #socBtn')) {
    const r=e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right > W + 1 || r.left < -1) bad.push((e.id||e.className||e.tagName)+' x '+Math.round(r.left)+'..'+Math.round(r.right));
  }
  for (const e of document.querySelectorAll('.rmd-card .btn')) if (e.scrollWidth > e.clientWidth + 2) bad.push('clipped button '+e.textContent);
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways '+document.documentElement.scrollWidth);
  return bad; })()"""
# things waiting: a level-up, a garden far away, homestead goods, a resting horse, a caravan, a rumour lead, a cleared place
SETUP = """(()=>{ const S=__dbg.save(), t=G.now();
  S.pendingLevels=1;
  S.homes={ Whiterun:{ chest:[], garden:0 } };
  S.homestead={ pinewatch:{ small:t-9e4, hall:t-9e4, wings:['kitchen','armory'], col:{ kitchen:t-2*HOMESTEAD.DAY-5, armory:t-HOMESTEAD.DAY-5 }, stock:{} } };
  S.horse={ name:'Frost', coat:'grey', hp:10, away:{ town:'Whiterun', until:t+1200 } };
  S.caravanJob={ id:'cv-x', line:'x', name:'Nord merchant wagons', from:'Solitude', to:'Whiterun', depart:t+1500, arrive:t+4000, status:'signed' };
  S.rw={ list:[{ id:'rwx', kind:'bandits', place:'Bleak Falls Barrow', town:'Riverwood', until:t+2400, say:'x' }] };
  S.cleared={ 'Embershard Mine': t-DUNGEONS.REFILL_SECONDS-60 };
  __ui.go('map'); return REMIND.list(S).length; })()"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vw, vh in [(360, 780), (412, 915)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut"); await pg.wait_for_timeout(1200)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolfdir"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR)
            n = await pg.evaluate(SETUP); await pg.wait_for_timeout(400)
            print(vw, "reminders:", n)

            async def shot(name):
                await pg.wait_for_timeout(350)
                await pg.screenshot(path=os.path.join(OUT, f"{vw}_{name}.png"))
                bad = await pg.evaluate(OVERFLOW)
                if bad: fails.append(f"{vw} {name}: {bad[:6]}")

            for style in ["ink", "pixel"]:
                await pg.evaluate(f"ART.setStyle('{style}'); __ui.go('map')"); await pg.wait_for_timeout(300)
                for size in ["0", "3"]:
                    await pg.evaluate(f"ACCESS.pref('a11yText','{size}'); __ui.go('map')"); await pg.wait_for_timeout(300)
                    await pg.evaluate(CLEAR)
                    if not await pg.evaluate("!!document.querySelector('#rmd-card')"): fails.append(f"{vw} {style} {size}: no Today card")
                    await pg.evaluate("document.querySelector('#rmd-card')?.scrollIntoView({block:'start'})")
                    await shot(f"{style}_text{size}_card")
                    await pg.evaluate("scrollTo(0, document.documentElement.scrollHeight)"); await shot(f"{style}_text{size}_tabs")
            await pg.evaluate("ACCESS.pref('a11yText','0'); ART.setStyle('ink'); __ui.go('map')")

            # badges: Hero has the level-up, Travel has the far-away things
            await pg.evaluate("REMIND.paint()")
            hb = await pg.evaluate("document.querySelector('#tabs [data-tab=hero] .rmd-b')?.textContent || ''")
            mb = await pg.evaluate("document.querySelector('#tabs [data-tab=map] .rmd-b')?.textContent || ''")
            print(vw, "badges hero", repr(hb), "map", repr(mb), "api", await pg.evaluate("REMIND.badge('hero')"))
            if not hb.startswith("1") and not hb.startswith("2"): fails.append(f"{vw}: Hero badge {hb!r}")
            if not mb: fails.append(f"{vw}: Travel badge missing")
            # REMIND.attach adds a badge to any button by selector
            await pg.evaluate("REMIND.attach('#sndBtn','hero')")
            if not await pg.evaluate("!!document.querySelector('#sndBtn .rmd-b')"): fails.append(f"{vw}: attach() didn't badge")

            # Go on the level-up opens Hero
            await pg.evaluate("[...document.querySelectorAll('#rmd-card .rmd-row')].find(r=>/level up/i.test(r.textContent))?.querySelector('[data-rmd=go]').click()"); await pg.wait_for_timeout(400)
            if await pg.evaluate("__ui.tab") != "hero": fails.append(f"{vw}: Go level-up went to {await pg.evaluate('__ui.tab')}")
            await shot("go_hero")
            # Go on the garden (in Whiterun, far away) picks Whiterun on the map
            await pg.evaluate("__ui.go('map')"); await pg.wait_for_timeout(300)
            await pg.evaluate("[...document.querySelectorAll('#rmd-card .rmd-row')].find(r=>/garden/i.test(r.textContent))?.querySelector('[data-rmd=go]').click()"); await pg.wait_for_timeout(500)
            picked = await pg.evaluate("document.querySelector('#picked:not(.hide)')?.textContent || ''")
            print(vw, "picked after garden Go:", picked[:60])
            if "Whiterun" not in picked: fails.append(f"{vw}: garden Go didn't pick Whiterun ({picked[:40]!r})")
            await shot("go_garden")
            # Show all
            await pg.evaluate(CLEAR + "; __ui.go('map')"); await pg.wait_for_timeout(300)
            more = await pg.evaluate("!!document.querySelector('[data-rmd=more]')")
            if more:
                await pg.evaluate("document.querySelector('[data-rmd=more]').click()"); await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelector('#rmd-card')?.scrollIntoView({block:'start'})"); await shot("all")
            # the in-game compass shows the badge too
            await pg.evaluate("typeof TABMENU!=='undefined' && TABMENU.openHub?.()"); await pg.wait_for_timeout(500)
            await pg.evaluate("REMIND.paint()"); await shot("compass")
            if await pg.evaluate("!!document.querySelector('[data-twgo=char]')") and not await pg.evaluate("!!document.querySelector('[data-twgo=char] .rmd-b')"): fails.append(f"{vw}: compass badge missing")
            await pg.evaluate(CLEAR)
            # notifications list (what app.js would schedule)
            notes = await pg.evaluate("__ui.upcoming().map(n=>[n.id,n.title])")
            print(vw, "notifications:", notes)
            if not any(i >= 101 for i, _ in notes): fails.append(f"{vw}: no reminder notifications")
            if errs: fails.append(f"{vw} page errors: {errs[:3]}")
            await ctx.close()
        await b.close()
    print("shots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("remind_ui ok")

asyncio.run(main())
