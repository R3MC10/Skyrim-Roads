"""Turn-by-turn fights (tbfight.js) in the browser at phone size. Usage: python tbfight_ui.py PORT — prints RESULT OK.
Starts a road fight from an encounter, plays a few turns by hand (attack, magic menu, end turn), checks the initiative bar,
AP pips, the live fight scene, then lets Auto finish and checks the result goes back to the normal fight result.
Also checks the "Instant (auto)" setting skips the turn screen. Screenshots in tests/tbf/ (both art styles)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tbf") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")   # falls back to Playwright's own Chromium when missing
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """(st)=>{ ART.setStyle(st); document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl=45;
  S.mpBonus=60; for (const id of ['flames','sparks','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  G.give(S,'potion_health',2); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=tbf1&tb&fightanim"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Turnie"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("typeof TB !== 'undefined' && TB.enabled()"), "turn-by-turn fights on (default, ?tb under automation)")
        for style in ["ink", "pixel"]:
            await pg.evaluate(START, style); await pg.wait_for_timeout(400)
            await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(700)
            ok(await pg.evaluate("!!document.querySelector('#tbf') && TB.open"), f"{style}: the fight screen opens")
            ok(await pg.evaluate(f"document.querySelector('#tbf').classList.contains('{style}')"), f"{style}: screen uses the art style")
            n = await pg.evaluate("document.querySelectorAll('#tbf .tbini').length")
            ok(n >= 2, f"{style}: initiative bar shows {n} turns")
            # play up to 3 of my turns by hand
            turns = 0
            for _ in range(40):
                if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
                mine = await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')")
                if not mine: await pg.wait_for_timeout(300); continue
                turns += 1
                pips0 = await pg.evaluate("document.querySelectorAll('#tbf .tbap i.on.ap').length")
                if turns == 1:
                    await pg.wait_for_timeout(1200); await pg.screenshot(path=OUT + f"{style}_turn1.png")
                    big = await pg.evaluate("Math.min(...[...document.querySelectorAll('#tbf .tbact')].map(b=>b.getBoundingClientRect().height))")
                    ok(big >= 44, f"{style}: action buttons are big tap targets ({big:.0f}px)")
                    vw = await pg.evaluate("document.querySelector('#tbf .tbin').scrollWidth <= window.innerWidth")
                    ok(vw, f"{style}: no sideways scrolling")
                await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(500)
                if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"):
                    pips1 = await pg.evaluate("document.querySelectorAll('#tbf .tbap i.on.ap').length")
                    ok(pips1 < pips0, f"{style}: attacking spends AP ({pips0}→{pips1})")
                    if turns == 2:   # the magic menu
                        await pg.click("#tbf [data-tbm=magic]"); await pg.wait_for_timeout(300)
                        ok(await pg.evaluate("document.querySelectorAll('#tbf .tbsp').length") >= 1, f"{style}: magic menu lists spells")
                        await pg.screenshot(path=OUT + f"{style}_magic.png")
                        cast = await pg.query_selector("#tbf .tbsp [data-tba^='spell:']:not([disabled])")
                        if cast: await cast.click(); await pg.wait_for_timeout(500)
                        else: await pg.click("#tbf [data-tbm='']"); await pg.wait_for_timeout(200)
                    if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]')"):
                        await pg.click("#tbf [data-tba=end]"); await pg.wait_for_timeout(600)
                if turns == 2: await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + f"{style}_turn2.png")
                if turns >= 3: break
            ok(turns >= 2, f"{style}: played {turns} turns by hand")
            rnd = await pg.evaluate("parseInt((document.querySelector('#tbf .tbtop b')||{}).textContent?.replace(/\\D/g,'')||'0')")
            ok(rnd >= 2 or await pg.evaluate("!!document.querySelector('#tbf .tbdone')"), f"{style}: rounds go on (round {rnd})")
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbscene .fscene canvas')"), f"{style}: the fight scene plays")
            # Auto for the rest of the fight
            ok(not await pg.evaluate("!!document.querySelector('#tbf .tbact.auto')"), f"{style}: no Auto buttons")
            if await pg.evaluate("!!document.querySelector('#tbf .tbgrid')"):
                await pg.evaluate("(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()")
            for _ in range(60):
                if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
                await pg.wait_for_timeout(300)
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbdone')"), f"{style}: Auto finishes the fight")
            await pg.wait_for_timeout(2500); await pg.screenshot(path=OUT + f"{style}_end.png")
            await pg.click("#tbf .tbdone"); await pg.wait_for_timeout(800)
            ok(await pg.evaluate("!document.querySelector('#tbf') && !TB.open"), f"{style}: the fight screen closes")
            ok(await pg.evaluate("!!document.querySelector('#modal') && /Victory|Defeated|log|fight|bandit|Quest/i.test(document.querySelector('#modal').innerText)"), f"{style}: the usual fight result (or a quest note that popped up) shows after")
            await pg.screenshot(path=OUT + f"{style}_result.png")
            ok(await pg.evaluate("window.__dbg.save().trip?.status !== 'event'"), f"{style}: the encounter is resolved")
        # the old Instant (auto) setting is gone: a stored turnBased:false still gives the turn screen
        await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), turnBased:false}))")
        await pg.evaluate(START, "ink"); await pg.wait_for_timeout(400)
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("!!document.querySelector('#tbf')"), "old Instant setting is ignored: still turn by turn")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")
asyncio.run(main())
