import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.add_init_script(path="/home/claude/tests/fakedb.js")
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type in ("error","warning") and "Failed to load" not in m.text else None)
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(3000)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        S = "window.__dbg.save()"
        # put me in Whiterun with gold, level ups, ingredients
        await pg.evaluate(f"""() => {{ const S={S}; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=3000; S.level=6; S.skills['One-Handed'].lvl=40;
           for (const i of ['ing_blue_flower','ing_wheat','ing_deathbell','ing_imp_stool','ing_lavender']) G.give(S,i,4); G.give(S,'steel_sword'); }}""")
        # fake other player standing in Whiterun
        await pg.evaluate("""() => { const w=WORLD.places.Whiterun; window.__fakedb.store.set('players/B', {name:'Bjorn',race:'nord',level:5,x:w[0],y:w[1],t0:0,moving:false,dest:null,path:null,speed:20,party:null,hiding:false,hp:120,cur:120,heal:0,dmg:7,red:0.2,gold:200,sneak:20,bounty:0,loc:'Whiterun',dungeon:null,safeUntil:0}); window.__fakedb.emit('players'); }""")
        await pg.wait_for_timeout(500)
        shots = []
        async def shot(name):
            await pg.screenshot(path=f"/home/claude/tests/u_{name}.png", full_page=True); shots.append(name)
        async def click(sel):
            await pg.click(sel); await pg.wait_for_timeout(250)
        # hero perks
        await click("[data-tab=hero]"); await shot("hero")
        await click("[data-act=perk] >> nth=0")
        # town sections
        await click("[data-tab=town]")
        for sec in ["inn","train","alchemy","forge","jobs","streets"]:
            await click(f"[data-act=shop][data-id={sec}]")
            if sec == "alchemy":
                await click("[data-act=alch] >> nth=0"); await click("[data-act=alch] >> nth=1"); await shot("alch")
                await click("[data-act=brew]"); await shot("brewed"); await click("[data-act=close]")
            if sec == "inn": await click("[data-act=inn][data-c=rumour]")
            if sec == "train": await click("[data-act=train] >> nth=0"); await shot("train")
            if sec == "jobs": await click("[data-act=takejob] >> nth=0"); await shot("jobs")
            if sec == "forge": await shot("forge")
            if sec == "streets": await shot("streets")
        # journal: invite, then attack
        await click("[data-tab=log]"); await shot("journal")
        await click("[data-act=invite] >> nth=0"); await pg.wait_for_timeout(300)
        await click("[data-tab=log]")
        await shot("journal_party")
        await click("[data-act=attack] >> nth=0"); await pg.wait_for_timeout(300); await shot("attack")
        await pg.click("[data-act=close]")
        # someone kills me
        await pg.evaluate("""() => { window.__fakedb.store.set('attacks/x1', {type:'kill',from:'B',fromName:'Bjorn',to:'U1',t:Date.now()/1000}); window.__fakedb.emit('attacks'); }""")
        await pg.wait_for_timeout(600); await shot("killed")
        await click("[data-act=close]")
        # a party chest
        await pg.evaluate("""() => { window.__fakedb.store.set('chests/c1', {gold0:300,items0:['elven_sword','potion_health'],goldLeft:300,itemsLeft:['elven_sword','potion_health'],taken:[],members:[{id:'U1',name:'Remi'},{id:'B',name:'Bjorn'}],place:'Saarthal',byName:'Bjorn',t:Date.now()/1000}); window.__fakedb.emit('chests'); }""")
        await pg.wait_for_timeout(400)
        await click("[data-tab=log]"); await shot("chest")
        await click("[data-act=grab] >> nth=0"); await pg.wait_for_timeout(400); await shot("grabbed"); await click("[data-act=close]")
        # bounty: arrive in Whiterun with bounty -> guard
        await pg.evaluate(f"""() => {{ const S={S}; S.bounty={{Whiterun:120}}; }}""")
        await click("[data-tab=town]"); await click("[data-act=shop][data-id=streets]"); await click("[data-act=guardopen]"); await shot("guard")
        await click("[data-act=guard][data-c=pay]"); await click("[data-act=close]")
        # pack: drink brewed + eat
        await pg.evaluate("__ui.go('items')"); await shot("pack")
        st = await pg.evaluate(f"() => JSON.stringify({{gold:{S}.gold, bounty:{S}.bounty, perks:{S}.perks, jobs:({S}.jobs||[]).length, news: [...window.__fakedb.store.keys()].filter(k=>k.startsWith('news')).length}})")
        print(st)
        print("errors:", errs[:10])
        await b.close()
asyncio.run(main())
