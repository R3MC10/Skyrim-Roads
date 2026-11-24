"""Quicker travel and fights (fastqol.js) at phone size, both art styles. Usage: python fast_ui.py PORT [outdir] — prints RESULT OK.
Recent-trip chips on the travel screen (and that they start the trip), the too-heavy loot question, replay speed ×1/×2/×4
and Skip to result, tap-anywhere to finish a replay (result card and the turn-by-turn screen), "Carry on" after road
fights, the new settings rows, and Fight again on the test dummy. 360x780 runs at the Biggest text size.
Screenshots in outdir (default: fast_shots in the temp folder)."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9500"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "fast_shots")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")   # falls back to Playwright's own Chromium when missing
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

CLEAR = "document.querySelectorAll('#modal,#sky,#tbf').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
OVERFLOW = """(sel)=>{ const W=innerWidth, bad=[]; document.querySelectorAll('.pgold,.pban').forEach(e=>e.remove());   /* polish.js gold pops and banners fly in from the edge for a moment */
  for (const e of document.querySelectorAll(sel)) { const r=e.getBoundingClientRect(); if (!r.width) continue;
    if (r.right > W + 1 || r.left < -1) bad.push((e.className||e.tagName)+' '+Math.round(r.left)+'..'+Math.round(r.right)); }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways: '+[...document.querySelectorAll('body *')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width && r.right>W+1; }).slice(0,4).map(e=>e.tagName+'.'+e.className+'#'+e.id).join(' '));
  return bad; }"""
# a road fight you win, with loot named like the game names it
FIGHT = """(o)=>{ const S=window.__dbg.save(); S.level=25; for (const k of Object.keys(S.skills)) S.skills[k].lvl=Math.max(S.skills[k].lvl,50);
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.location=null; [S.x,S.y]=WORLD.places.Whiterun.slice(0,2);
  if (!S.trip) { G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); } S.trip.status='travel';
  const base=D.ENCOUNTERS.find(x=>x.danger==='low' && (x.tags||[]).includes('humanoid')) || D.ENCOUNTERS[0];
  let f=null; for (let i=0;i<30;i++){ const e=G.scaleEnemy(base,S.level); f=new G.Fight(G.clone(S),e); f.run(); if (f.won) break; }
  const loot=[]; if (o.heavy) { const id=o.heavy, w=D.ITEMS[id].weight; while(G.capacity(S)-G.carried(S) > w) G.give(S,Object.keys(D.ITEMS).find(k=>D.ITEMS[k].weight===1),1); G.give(S,id,2); loot.push(D.ITEMS[id].name+' ×2'); }
  window.__ui.fight({ fight:f, text:'You win the fight.', gold:7, loot, skills:[] }); return !!f.won; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        for vw, vh, big in [(360, 780, True), (412, 915, False)]:
            for style in ["ink"]:
                tag = f"{vw}_{style}"
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1, has_touch=True)
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fq{vw}{style}&tb&fightanim"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Quickfoot"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate("typeof ONBOARD !== 'undefined' && ONBOARD.pref('obTips', false)")   # first-time tips (onboard.js) would sit over the fight screen
                try: await pg.wait_for_selector("#side", timeout=10000)
                except Exception: await pg.screenshot(path=os.path.join(OUT, f"{tag}_nostart.png")); print(await pg.evaluate("document.body.innerText.slice(0,300)"))
                await pg.evaluate(CLEAR)
                if big: await pg.evaluate("ACCESS.pref('a11yText','3')")
                await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), fightSpeed:1, fqAutoRoad:false}))")

                async def shot(name):
                    await pg.wait_for_timeout(300)
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"), style="#toast,#hudlog,.pban{display:none!important}")   # toasts and banners cover what we look at

                # ---- recent trips on the travel screen
                await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.trip=null; S.dungeon=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun.slice(0,2);
                  G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); S.trip=null; S.location='Riverwood'; [S.x,S.y]=WORLD.places.Riverwood.slice(0,2);
                  S.fqTrips.recent=['Riverwood','Falkreath','Solitude','Windhelm']; window.__ui.go('map'); }""")
                await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelector('.fqrecent')?.scrollIntoView({block:'center'})")
                chips = await pg.evaluate("[...document.querySelectorAll('.fqrecent .chip')].map(c=>c.textContent)")
                ok(len(chips) >= 2 and any("Back to Whiterun" in c for c in chips) and not any(c == "Riverwood" for c in chips), f"{tag}: recent trips {chips}")
                bad = await pg.evaluate(OVERFLOW, ".fqrecent, .fqrecent .chip")
                ok(not bad, f"{tag}: recent chips fit {bad[:3]}")
                await shot("recent")
                await pg.click(".fqrecent .chip.on"); await pg.wait_for_timeout(400)
                ok(await pg.evaluate("window.__dbg.save().trip?.destName === 'Whiterun'"), f"{tag}: Back to Whiterun starts the trip")

                # ---- too heavy after a won fight + replay controls
                await pg.evaluate(CLEAR)
                heavy = await pg.evaluate("Object.keys(D.ITEMS).filter(k=>D.ITEMS[k].weight>=5 && D.ITEMS[k].name && !D.ITEMS[k].type).sort((a,b)=>D.ITEMS[b].weight-D.ITEMS[a].weight)[0]")
                won = await pg.evaluate(FIGHT, {"heavy": heavy}); await pg.wait_for_timeout(500)
                ok(won, f"{tag}: test fight won")
                ok(await pg.evaluate("!!document.querySelector('#modal .fqloot')"), f"{tag}: too heavy asks what to do")
                ok(await pg.evaluate("FIGHTART.playing()"), f"{tag}: the replay plays")
                sp = []
                for _ in range(3):
                    sp.append(await pg.evaluate("document.querySelector('#modal [data-fsx]')?.textContent"))
                    await pg.click("#modal [data-fsx]"); await pg.wait_for_timeout(120)
                ok(sp == ["⏩ ×1", "⏩ ×2", "⏩ ×4"], f"{tag}: speed cycles {sp}")
                ok(await pg.evaluate("JSON.parse(localStorage.getItem('rotn_prefs')).fightSpeed === 1"), f"{tag}: speed back at ×1 and saved")
                ok(await pg.evaluate("document.querySelector('#modal [data-fss]')?.textContent === 'Skip to result'"), f"{tag}: Skip to result button")
                bad = await pg.evaluate(OVERFLOW, "#modal .fsbtn, #modal .fqloot, #modal .fqloot .btn")
                ok(not bad, f"{tag}: result card fits {bad[:3]}")
                await shot("heavy")
                await pg.click("#modal h2"); await pg.wait_for_timeout(250)
                ok(await pg.evaluate("!FIGHTART.playing()"), f"{tag}: tap on the card finishes the replay")
                await pg.evaluate("document.querySelector('#modal .fqloot')?.scrollIntoView({block:'center'})")
                await pg.click("#modal [data-fq=lootdrop]"); await pg.wait_for_timeout(250)
                txt = await pg.evaluate("document.querySelector('#modal .fqloot')?.innerText || ''")
                ok("You leave" in txt and await pg.evaluate("!G.overweight(window.__dbg.save())"), f"{tag}: left the heavy stuff: {txt[:80]}")
                await shot("heavy_after")

                # ---- carry on by itself after a road fight
                await pg.evaluate(CLEAR)
                await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), fqAutoRoad:true, fightSpeed:4}))")
                await pg.evaluate("()=>{ const S=window.__dbg.save(); S.inv=S.inv.filter(r=>D.ITEMS[r.item]?.weight<5 || D.ITEMS[r.item]?.type); }")
                await pg.evaluate(FIGHT, {}); await pg.wait_for_timeout(300)
                await pg.evaluate("FIGHTART.finishAll()")
                await pg.wait_for_timeout(2300)
                lbl = await pg.evaluate("[...document.querySelectorAll('#modal [data-act=close]')].map(b=>b.textContent).join('|')")
                ok("(" in lbl, f"{tag}: counts down: {lbl}")
                await shot("countdown")
                await pg.wait_for_timeout(5500)
                ok(await pg.evaluate("!document.querySelector('#modal')"), f"{tag}: the card closed by itself")
                # a touch stops it
                await pg.evaluate(FIGHT, {}); await pg.wait_for_timeout(300); await pg.evaluate("FIGHTART.finishAll()")
                await pg.wait_for_timeout(1500)
                await pg.dispatch_event("#modal .sheet", "pointerdown")
                await pg.wait_for_timeout(6500)
                ok(await pg.evaluate("!!document.querySelector('#modal')"), f"{tag}: touching the card stops the countdown")
                await pg.evaluate(CLEAR)
                await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), fqAutoRoad:false, fightSpeed:1}))")

                # ---- settings rows
                await pg.click("#sndBtn"); await pg.wait_for_timeout(400)
                await pg.evaluate("[...document.querySelectorAll('#modal .setrow')].find(r=>/Replay speed/.test(r.textContent))?.scrollIntoView({block:'center'})")
                ok(await pg.evaluate("[...document.querySelectorAll('#modal .setrow')].some(r=>/Replay speed/.test(r.textContent)) && [...document.querySelectorAll('#modal .setrow')].some(r=>/After road events/.test(r.textContent))"), f"{tag}: settings rows")
                await pg.click("#modal [data-k=fightSpeed][data-v='4']"); await pg.wait_for_timeout(300)
                ok(await pg.evaluate("JSON.parse(localStorage.getItem('rotn_prefs')).fightSpeed === 4"), f"{tag}: speed set in Settings")
                await pg.evaluate("[...document.querySelectorAll('#modal .setrow')].find(r=>/Replay speed/.test(r.textContent))?.scrollIntoView({block:'center'})")
                bad = await pg.evaluate(OVERFLOW, "#modal .setrow, #modal .seg, #modal .seg button")
                ok(not bad, f"{tag}: settings fit {bad[:3]}")
                await shot("settings")
                await pg.evaluate(CLEAR)

                # ---- Fight again on the test dummy, remembered foe
                await pg.evaluate("window.__dbg.save().trip=null; window.__ui.go('tactics')"); await pg.wait_for_timeout(400)
                foe = await pg.evaluate("(()=>{ const o=[...document.querySelectorAll('#te option')]; return o[Math.min(2,o.length-1)].textContent; })()")
                await pg.select_option("#te", label=foe)
                await pg.click("[data-act=test]"); await pg.wait_for_timeout(500)
                ok(await pg.evaluate("!!document.querySelector('.fqagain[data-act=test]')"), f"{tag}: Fight again under the test result")
                await pg.evaluate("document.querySelector('.fqagain')?.scrollIntoView({block:'center'})")
                await shot("again")
                await pg.click(".fqagain"); await pg.wait_for_timeout(500)
                ok(await pg.evaluate("!!document.querySelector('.fqagain')"), f"{tag}: fought again")
                await pg.evaluate("window.__ui.go('tactics')"); await pg.wait_for_timeout(300)
                ok(await pg.evaluate(f"document.querySelector('#te').value === {foe!r}"), f"{tag}: remembers the test foe ({foe})")

                # ---- turn by turn: tap anywhere finishes the scene
                await pg.evaluate("""()=>{ const S=window.__dbg.save(); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null; S.location=null; [S.x,S.y]=WORLD.places.Whiterun.slice(0,2);
                  G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
                await pg.wait_for_timeout(400)
                await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(500)
                played = False
                for _ in range(20):
                    if await pg.evaluate("!!document.querySelector('#tbf') && FIGHTART.playing()"): played = True; break
                    if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): await pg.click("#tbf [data-tba=attack]")
                    await pg.wait_for_timeout(150)
                ok(played, f"{tag}: a turn scene is playing")
                if played:
                    await shot("tb_playing")
                    await pg.click("#tbf .tbvit"); await pg.wait_for_timeout(200)
                    ok(await pg.evaluate("!FIGHTART.playing()"), f"{tag}: tap on the fight screen finishes the scene")
                if await pg.evaluate("!!document.querySelector('#tbf .tbgrid')"): await pg.evaluate("(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()")
                for _ in range(60):
                    if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
                    await pg.wait_for_timeout(250)
                if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): await pg.click("#tbf .tbdone"); await pg.wait_for_timeout(500)
                ok(await pg.evaluate("!document.querySelector('#tbf')"), f"{tag}: the fight ends normally")
                ok(not errs, f"{tag}: no page errors {errs[:3]}")
                await ctx.close()
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")
asyncio.run(main())
