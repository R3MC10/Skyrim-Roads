import asyncio, sys, base64, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8783"
OUT = "/home/claude/tests/vevt"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=evt"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ewa"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await clear()
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            # a real road event, through the game's own modal: start a trip and put an event on it
            for ev in ["{id:'shrine', god:'Talos', text:'A weathered roadside shrine to Talos stands among the stones.'}",
                       "{id:'caravan', stock:['potion_health','soul_gem_common'], text:'A Khajiit caravan rests by the road.'}",
                       "{id:'toll', fee:30, text:'Soldiers have barred the road with a cart.'}"]:
                await clear()
                await pg.evaluate(f"""()=>{{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.startTrip(S,'Windhelm',WORLD.places.Windhelm.slice(0,2));
                    S.trip.status='event'; S.trip.event={ev}; window.__dbg.openEvent(); }}""")
                await pg.wait_for_timeout(400)
                m = await pg.query_selector("#modal .card, #modal")
                ok = await pg.evaluate("!!document.querySelector('#modal img.art.scene.evt')")
                print(style, "event modal picture:", ok)
                if m: await m.screenshot(path=f"{OUT}/modal_{style}_{ev[5:12].strip(chr(39))}.png")
            # pick a choice on the toll: the result keeps its picture
            await pg.evaluate("()=>{ const b=[...document.querySelectorAll('#modal [data-act=ev]')].find(x=>x.dataset.c==='pay'); b&&b.click(); }"); await pg.wait_for_timeout(400)
            print(style, "after choice picture:", await pg.evaluate("!!document.querySelector('#modal img.art.scene.evt')"))
            # story popups through showMessage
            for t, x in [("Quest", "📜 The Dragonborn: “Bleak Falls Barrow” done (100 gold)."), ("Quest", "📜 The Companions: “Proving Honor” done (200 gold)."), ("The dragon falls", "Mirmulnir crashes down. You absorb its soul."), ("The Change", "Your blood burns. You are a vampire now.")]:
                await clear(); await pg.evaluate(f"window.__dbg.message({t!r}, {x!r})"); await pg.wait_for_timeout(300)
                ok = await pg.evaluate("!!document.querySelector('#modal img.art.scene.evt')"); print(style, t, "picture:", ok)
                m = await pg.query_selector("#modal")
                if m: await m.screenshot(path=f"{OUT}/msg_{style}_{t.split()[-1]}_{x[3:9]}.png")
            await clear()
            # a gallery of every picture, saved straight from the image data
            srcs = await pg.evaluate("""()=>{ const out={}; const DIV=['Akatosh','Arkay','Dibella','Julianos','Kynareth','Mara','Stendarr','Zenithar','Talos'];
               const grounds=['Tundra','Pine forest','Snow','Marsh','Autumn forest','Volcanic tundra','Rocky hills','Grassland','Forest','High peaks','Mountains'];
               let i=0; for (const id of Object.keys(EVENTART.ROAD)) { const ev={id, god:DIV[i%9], item:'ing_blue_mountain_flower', tier:i%5}; const h=EVENTART.road(ev,{ground:grounds[i%grounds.length], mood:i%4===3?'night':i%4===2?'dusk':'day', weather:i%5===1?'snow':i%5===2?'rain':'clear'}); out['road_'+id]=(h.match(/src="([^"]+)"/)||[])[1]; i++; }
               for (const k of Object.keys(EVENTART.STORY)) { const h=EVENTART.story('', '', {kind:k, town:'Whiterun'}); out['story_'+k]=(h.match(/src="([^"]+)"/)||[])[1]; }
               out.raid=(EVENTART.raid('Riften', false).match(/src="([^"]+)"/)||[])[1];
               return out; }""")
            n = 0
            for k, u in srcs.items():
                if not u: print("MISSING", k); continue
                open(f"{OUT}/{style}_{k}.png", "wb").write(base64.b64decode(u.split(",")[1])); n += 1
            print(style, "gallery pictures:", n)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
