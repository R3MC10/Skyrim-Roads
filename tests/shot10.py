import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.add_init_script(path="/home/claude/tests/fakedb.js")
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("() => { const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=900; G.give(S,'dragonstone'); }")
        # others + bags crowding near me
        await pg.evaluate("""() => { const w=WORLD.places.Whiterun; const mk=(id,n,dx,dy)=>window.__fakedb.store.set('players/'+id,{name:n,race:'nord',level:3,x:w[0]+dx,y:w[1]+dy,t0:0,moving:false,hp:100,cur:100,dmg:6,red:0.1,gold:10,loc:'Whiterun'});
           mk('B','Bjorn',0.002,0.001); mk('C','Cyra',0.003,-0.001); mk('D','Dagny',-0.002,0.002);
           window.__fakedb.store.set('bags/x',{ownerId:'B',ownerName:'Bjorn',x:w[0]+0.004,y:w[1],gold:5,items:[],expires:Date.now()/1000+999});
           window.__fakedb.emit('players'); window.__fakedb.emit('bags'); }""")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path="/home/claude/tests/r2_map.png", clip={"x":0,"y":0,"width":390,"height":480})
        await pg.click("[data-tab=town]"); await pg.click("[data-act=shop][data-id=hire]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=dragonstone]"); await pg.wait_for_timeout(200); await pg.click("[data-act=close]")
        await pg.click("[data-act=hire][data-id=lydia]"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/r2_hire.png", full_page=True)
        await pg.click("[data-act=shop][data-id=carriage]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=carriage][data-id=Riften]"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path="/home/claude/tests/r2_ride.png")
        print(await pg.evaluate("JSON.stringify({f: window.__dbg.save().follower && window.__dbg.save().follower.id, carriage: window.__dbg.save().trip && window.__dbg.save().trip.carriage, gold: window.__dbg.save().gold})"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
