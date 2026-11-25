import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        await pg.add_init_script(path="/home/claude/tests/fakedb.js")
        pg.on("pageerror", lambda e: errs.append("PAGE " + str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(3000)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        # party led by B, both at Riverwood; B sets a trip to Whiterun
        await pg.evaluate("""() => { const w=WORLD.places.Riverwood, S=window.__dbg.save(); const now=Date.now()/1000;
          window.__fakedb.store.set('players/B', {name:'Bjorn',race:'nord',level:5,x:w[0],y:w[1],t0:now,moving:false,path:null,speed:9,hp:120,cur:120,dmg:7,red:0.2,gold:200,loc:'Riverwood'});
          window.__fakedb.store.set('parties/p1', {leader:'B',leaderName:'Bjorn',members:[{id:'B',name:'Bjorn'},{id:'U1',name:'Remi'}],invites:[],t:now, trip:{destName:'Whiterun',dest:WORLD.places.Whiterun,start:[S.x,S.y],speed:9,t:now}});
          window.__fakedb.emit('players'); window.__fakedb.emit('parties'); }""")
        await pg.wait_for_timeout(2500)
        r = await pg.evaluate("() => { const S=window.__dbg.save(); return JSON.stringify({trip: S.trip && S.trip.destName, speed: S.trip && S.trip.speed}); }")
        print("follow:", r)
        # allies in a fight: start an encounter
        await pg.evaluate("""() => { const S=window.__dbg.save(); const f=new G.Fight(S, G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==='Wolf pack')},1)); window.__al = f.allies.map(a=>a.name).join(','); }""")
        print("allies:", await pg.evaluate("() => window.__al"))
        # ambush: stop in wilds, hide, a stranger walks by
        await pg.evaluate("""() => { const S=window.__dbg.save(); S.trip=null; S.location=null; S.x=0.45; S.y=0.55; S.ambush=true;
          window.__fakedb.store.delete('parties/p1'); window.__fakedb.emit('parties');
          const now=Date.now()/1000; window.__fakedb.store.set('players/C', {name:'Cyra',race:'breton',level:2,x:0.449,y:0.549,t0:now,moving:true,path:[[0.449,0.549],[0.47,0.56]],speed:5,hp:100,cur:100,dmg:5,red:0.1,gold:50,loc:null}); window.__fakedb.emit('players'); }""")
        await pg.wait_for_timeout(4500)
        await pg.screenshot(path="/home/claude/tests/u_ambush.png")
        print("attacks:", await pg.evaluate("() => [...window.__fakedb.store.keys()].filter(k=>k.startsWith('attacks')||k.startsWith('news'))"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
