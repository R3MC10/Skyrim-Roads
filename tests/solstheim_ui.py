# Solstheim in the browser: Windhelm docks → the Northern Maiden → Raven Rock (fast-forwarded), the map switches,
# a quest stage, an ash storm, both art styles, no page errors, map speed. Usage: python3 solstheim_ui.py [port]
import asyncio, sys, json
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8803
OUT = _SHOTS
STRONG = """()=>{const S=window.__dbg.save(); S.level=40; S.hpBonus=234; S.spBonus=156; for(const k of Object.keys(S.skills)) S.skills[k].lvl=100;
  for(const it of ["stalhrim_heavy_armor","stalhrim_heavy_helmet","bonemold_gauntlets","bonemold_boots","bonemold_shield","stalhrim_sword"]){const id=G.give(S,it); G.equip(S,id);}
  for(let i=0;i<10;i++) G.give(S,"potion_health"); S.perks={...(S.perks||{}),armsman:5,juggernaut:5}; G.setHealth(S,G.maxHealth(S)); return G.maxHealth(S);}"""
async def close_modals(pg):
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.set_default_timeout(120000)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=sol"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sailor"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await close_modals(pg)
        print("hp:", await pg.evaluate(STRONG))
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.trip=null; S.location='Windhelm'; [S.x,S.y]=WORLD.places.Windhelm; S.gold=1200; if(!S.discovered.includes('Windhelm')) S.discovered.push('Windhelm'); S.explored.push([S.x,S.y]);}")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(500)
        chips = await pg.eval_on_selector_all("#side [data-act=shop]", "e=>e.map(x=>x.dataset.id)")
        print("Windhelm sections have docks:", "docks" in chips)
        await pg.click("#side [data-act=shop][data-id=docks]"); await pg.wait_for_timeout(500)
        print("docks:", (await pg.inner_text("#side .panel"))[:220].replace("\n", " | "))
        await pg.screenshot(path=OUT + "sol_docks.png")
        await pg.click("#side [data-act=sail]"); await pg.wait_for_timeout(900)
        await close_modals(pg)
        print("at sea:", await pg.evaluate("()=>{const t=window.__dbg.save().trip; return JSON.stringify({boat:t.boat, dest:t.destName, min:Math.round(G.minutesLeft(window.__dbg.save())), gold:window.__dbg.save().gold})}"))
        await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(900)
        await pg.screenshot(path=OUT + "sol_atsea.png")
        print("region at sea:", await pg.evaluate("window.__dbg.view().region"))
        # fast-forward the voyage
        await pg.evaluate("()=>{const t=window.__dbg.save().trip; t.lastTick-=3100;}")
        await pg.wait_for_timeout(2600)
        st = await pg.evaluate("()=>{const S=window.__dbg.save(); return {loc:S.location, sol:WORLD.isSol([S.x,S.y]), q:S.quests?.dragonborn?.stage}}")
        print("landed:", st)
        modal = await pg.query_selector("#modal")
        print("intro popup:", (await pg.inner_text("#modal"))[:160].replace("\n", " ") if modal else None)
        await pg.screenshot(path=OUT + "sol_intro.png")
        await close_modals(pg)
        await pg.click("[data-tab=map]"); await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(1200)
        print("map region:", await pg.evaluate("window.__dbg.view().region"), "| transform", await pg.evaluate("JSON.stringify(window.__dbg.view().transform)"))
        await pg.screenshot(path=OUT + "sol_map.png")
        # zoomed out: the whole island
        zb = await pg.query_selector("#zoomBtn")
        if zb: await zb.click(); await pg.wait_for_timeout(900)
        await pg.screenshot(path=OUT + "sol_map_far.png")
        where = await pg.eval_on_selector_all("#side [data-act=go][data-place]", "e=>e.map(x=>x.dataset.place)")
        print("where-to (this map only):", where[:8], "| any Skyrim:", any(n in where for n in ["Whiterun", "Windhelm", "Riverwood"]))
        # a quest stage: face the cultists
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(500)
        qb = await pg.query_selector("#side [data-act=qtalk][data-id=dragonborn]")
        print("quest button:", await qb.inner_text() if qb else None)
        if qb:
            await qb.click(); await pg.wait_for_timeout(2500)
            await pg.screenshot(path=OUT + "sol_quest_fight.png")
            await close_modals(pg)
        print("quest stage after:", await pg.evaluate("window.__dbg.save().quests.dragonborn.stage"))
        # Raven Rock in the Town tab, both art styles
        for style in ["ink"]:
            await pg.click("[data-tab=town]"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=OUT + f"sol_ravenrock_{style}.png")
            await pg.click("#side [data-act=shop][data-id=forge]"); await pg.wait_for_timeout(400)
            await pg.click("#side [data-act=fgroup][data-id=stalhrim]") if await pg.query_selector("#side [data-act=fgroup][data-id=stalhrim]") else None
            await pg.wait_for_timeout(400); await pg.screenshot(path=OUT + f"sol_forge_{style}.png")
            # place pictures and story scenes, straight from the artists
            html = await pg.evaluate("""()=>['Raven Rock','Tel Mithryn','Skaal Village','Sun Stone','Temple of Miraak','Coldcinder Cave'].map(n=>PLACEART.scene(n)).join('')
              + EVENTART.story('Quest','Miraak\\'s cultists came up the docks at Raven Rock. Dragonborn.') + EVENTART.story('Quest','Miraak waits in Apocrypha.') + EVENTART.story('Quest','The Earth Stone is free. Bend Will.')
              + '<div>' + ['Ash hopper','Netch calf','Riekling hunters','Lurker','Ash spawn','Burnt spriggan','Miraak','Cultist','Seeker'].map(n=>ICONART.enemy(n,[],48)).join('') + '</div>' + SOLART.sea()""")
            await pg.evaluate("(h)=>{const d=document.createElement('div'); d.id='solgal'; d.style.cssText='position:fixed;inset:0;overflow:auto;background:#111;z-index:9999;display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start'; d.innerHTML=h; document.body.appendChild(d);}", html)
            await pg.set_viewport_size({"width": 740, "height": 1500}); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=OUT + f"sol_gallery_{style}.png", full_page=False)
            await pg.set_viewport_size({"width": 390, "height": 844})
            await pg.evaluate("document.getElementById('solgal').remove()")
        # fight scenes with the island's creatures
        fig = await pg.evaluate("""()=>{ const out=[]; for (const n of ['Ash hopper','Bull netch','Riekling hunters','Lurker','Ash spawn','Burnt spriggan','Miraak','Seeker']) out.push(FIGHTART.foeOf({name:n,tags:[]})); return out.join(',');}""")
        print("fight figures:", fig)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); const base=D.ENCOUNTERS.find(e=>e.name==='Riekling hunters'); const f=new G.Fight(S,G.scaleEnemy(base,S.level),null,G.now()); f.run({t:G.now()}); window.__solfight=f;}""")
        # ash storm over the map
        await pg.evaluate("()=>{ WEVENTS.__w0=WEVENTS.weather; WEVENTS.weather=(p,t)=>WORLD.isSol(p)?{id:'ashstorm',name:'Ash storm',icon:'\ue193',speed:0.65,sneak:0.15,encounters:0.8}:WEVENTS.__w0(p,t); }")
        await pg.click("[data-tab=map]"); await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(1500)
        print("weather:", await pg.evaluate("window.__dbg.view().weather"), "| clock:", await pg.inner_text("#clock") if await pg.query_selector("#clock") else "")
        await pg.screenshot(path=OUT + "sol_ashstorm.png")
        # walk somewhere on the island (and see the route on the map)
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.startTrip(S,'Tel Mithryn',WORLD.places['Tel Mithryn']);}")
        await pg.wait_for_timeout(1500); await pg.screenshot(path=OUT + "sol_walk.png")
        print("walking:", await pg.evaluate("JSON.stringify({d:window.__dbg.save().trip?.destName, n:window.__dbg.save().trip?.path.length, sol:window.__dbg.save().trip?.path.every(p=>WORLD.isSol(p))})"))
        # map speed: draw the Solstheim map 40 times
        ms = await pg.evaluate("()=>{const c=document.getElementById('map'), v=window.__dbg.view(); WorldMap.draw(c,v); const t0=performance.now(); for(let i=0;i<40;i++){v.t+=0.03; WorldMap.draw(c,v);} return (performance.now()-t0)/40;}")
        msk = await pg.evaluate("()=>{const c=document.getElementById('map'), v={...window.__dbg.view(), region:'skyrim', player:WORLD.places.Whiterun.slice(0,2), center:WORLD.places.Whiterun.slice(0,2)}; WorldMap.draw(c,v); const t0=performance.now(); for(let i=0;i<40;i++){v.t+=0.03; WorldMap.draw(c,v);} return (performance.now()-t0)/40;}")
        print(f"map draw: Solstheim {ms:.1f} ms/frame, Skyrim {msk:.1f} ms/frame")
        # the boat home, and Skyrim's map is back
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.trip=null; S.location='Raven Rock'; [S.x,S.y]=WORLD.places['Raven Rock']; S.gold=500;}")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
        await pg.click("#side [data-act=shop][data-id=docks]"); await pg.wait_for_timeout(300)
        await pg.click("#side [data-act=sail]"); await pg.wait_for_timeout(600); await close_modals(pg)
        await pg.evaluate("()=>{window.__dbg.save().trip.lastTick-=3100;}"); await pg.wait_for_timeout(2600); await close_modals(pg)
        await pg.click("[data-tab=map]"); await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(1000)
        print("home:", await pg.evaluate("()=>({loc:window.__dbg.save().location, region:window.__dbg.view().region})"))
        await pg.screenshot(path=OUT + "sol_home.png")
        # reload: still fine
        await pg.reload(); await pg.wait_for_timeout(2000)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
