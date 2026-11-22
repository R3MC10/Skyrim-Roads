"""Road encounters (encounters.js + encart.js) in the browser. Usage: python3 encounters_ui.py PORT — prints RESULT OK.
Screenshots in tests/enc/: the encounter modals in both art styles and a gallery of every encounter picture."""
import asyncio, sys, os, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8849"
OUT = "/home/claude/tests/enc/"; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=enc1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ewa"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        ok(await pg.evaluate("typeof ENC !== 'undefined' && ROAD_EVENTS.__enc && ENC.L.length >= 28"), "encounters loaded and wired")
        ids = await pg.evaluate("ENC.L.map(e=>e.id)")
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            for eid in ["thalmor", "giant", "khajiit", "escort", "wizard", "dog"]:
                await pg.evaluate(clear)
                await pg.evaluate(f"""()=>{{ const S=window.__dbg.save(); S.level=20; S.gold=3000; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
                    const d=ENC.byId['{eid}']; S.trip.status='event'; S.trip.event={{id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}}; window.__dbg.openEvent(); }}""")
                await pg.wait_for_timeout(450)
                pic = await pg.evaluate("!!document.querySelector('#modal img.art.scene.evt')")
                title = await pg.evaluate("document.querySelector('#modal h2')?.textContent||''")
                btns = await pg.evaluate("document.querySelectorAll('#modal [data-act=ev]').length")
                ok(pic, f"{style} {eid}: picture"); ok(title and title != "Something by the road", f"{style} {eid}: titled '{title}'"); ok(btns >= 2, f"{style} {eid}: {btns} choices")
                m = await pg.query_selector("#modal .sheet") or await pg.query_selector("#modal")
                if m: await m.screenshot(path=OUT + f"modal_{style}_{eid}.png")
            # a choice through the real button: Khajiit trade opens the shop, leave closes
            await pg.evaluate(clear)
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
                const d=ENC.byId.khajiit; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
            await pg.wait_for_timeout(300)
            await pg.click("#modal [data-act=ev][data-c=trade]"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("document.querySelectorAll('#modal [data-act=evbuy]').length") >= 3, f"{style}: Khajiit wares listed")
            await pg.click("#modal [data-act=ev][data-c=leave]"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("window.__dbg.save().trip.status") == "travel", f"{style}: leaving resumes the trip")
            # a fight from an encounter: the fight result shows
            await pg.evaluate(clear)
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
                const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
            await pg.wait_for_timeout(300)
            await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(700)
            ok(await pg.evaluate("!!document.querySelector('#modal') && /defeat|Killed|wake|toll|log|fight/i.test(document.querySelector('#modal').innerText)"), f"{style}: encounter fight result shown")
            m = await pg.query_selector("#modal .sheet") or await pg.query_selector("#modal")
            if m: await m.screenshot(path=OUT + f"fight_{style}.png")
            # leader gating: a non-leader gets a toast, the event stays
            await pg.evaluate(clear)
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); G.setHealth(S, G.maxHealth(S)); S.location=null; S.trip=null; S.dungeon=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
                const d=ENC.byId.lost; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; ENC.canDecide=()=>false; window.__dbg.openEvent(); }""")
            await pg.wait_for_timeout(300)
            await pg.click("#modal [data-act=ev][data-c=help]"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("window.__dbg.save().trip?.status") == "event", f"{style}: non-leader can't decide")
            await pg.evaluate("ENC.canDecide=()=>true")
            # gallery of every encounter picture
            srcs = await pg.evaluate("""()=>{ const out={}; const grounds=['Tundra','Pine forest','Snow','Marsh','Autumn forest','Volcanic tundra','Rocky hills','Grassland'];
               ENC.L.forEach((d,i)=>{ const h=EVENTART.road({id:d.id, guards:i%2?'imperial':'stormcloak'},{ground:grounds[i%grounds.length], mood:i%4===3?'night':'day', weather:i%5===1?'snow':'clear'}); out[d.id]=(h.match(/src="([^"]+)"/)||[])[1]; }); return out; }""")
            miss = [k for k, u in srcs.items() if not u]
            ok(not miss, f"{style}: every encounter has a picture (missing {miss})")
            for k, u in srcs.items():
                if u: open(OUT + f"g_{style}_{k}.png", "wb").write(base64.b64decode(u.split(",")[1]))
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")
asyncio.run(main())
