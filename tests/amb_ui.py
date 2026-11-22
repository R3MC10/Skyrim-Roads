import asyncio, sys, json
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
fails = []
def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name, info)
    if not ok: fails.append(name)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "net::" not in m.text else None)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=amb"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.wait_for_timeout(800)
        st = json.loads(await pg.evaluate("JSON.stringify(SOUND.state)"))
        check("title has wind bed", any(k.startswith("wind") for k in st["beds"]), st)
        await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ambra"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        async def closeModals():
            for _ in range(10):
                if not await pg.query_selector("#modal [data-act=close]"): break
                await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
        await closeModals(); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def state(wait=1500):
            await pg.wait_for_timeout(wait)
            return json.loads(await pg.evaluate("JSON.stringify(SOUND.state)"))
        # town
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.shopsOpen=()=>true;}")
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        st = await state(); check("town scene", st["amb"] == "town" and any(k.startswith("crowd") for k in st["beds"]), st)
        print("sections:", await pg.evaluate("[...document.querySelectorAll('[data-act=shop]')].map(e=>e.dataset.id)"))
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('.chip[data-act=shop][data-id=inn]').click()")
        st = await state(); check("inn scene", st["amb"] == "inn" and any(k.startswith("hearth") for k in st["beds"]), st)
        forge = await pg.query_selector(".chip[data-act=shop][data-id=forge], .chip[data-act=shop][data-id=blacksmith]")
        if forge:
            await forge.evaluate("e=>e.click()"); st = await state(); check("forge scene", st["amb"] == "forge", st)
        # weather override
        await pg.evaluate("()=>{ window.__wx=WEVENTS.weather; WEVENTS.weather=()=>({id:'storm'}); }")
        st = await state(); check("storm adds rain bed", any(k.startswith("rain") for k in st["beds"]), st)
        await pg.evaluate("()=>{ WEVENTS.weather=()=>({id:'blizzard'}); }")
        st = await state(); check("blizzard keeps wind", any(k.startswith("wind") for k in st["beds"]), st)
        await pg.evaluate("()=>{ WEVENTS.weather=window.__wx; }")
        # dungeon (direct API) and quick scene thrash
        await pg.evaluate("async()=>{ for (const s of ['dungeon','inn','wild','forge','town','dungeon','wild','inn']) { SOUND.ambience({scene:s,dwemer:true,weather:'storm',tod:'night',moving:true,speed:1.2}); await new Promise(r=>setTimeout(r,60)); } }")
        st = await state(300); check("thrash bounded", len(st["beds"]) <= 12 and st["ambVoices"] <= 16, st)
        # trip with footsteps, then riding
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=go] >> nth=0"); await pg.wait_for_timeout(800)
        await closeModals()
        st = await state(2500)
        moving = await pg.evaluate("window.__dbg.save().trip?.status")
        check("trip wild scene", st["amb"] == "wild", [moving, st])
        peak = 0
        for _ in range(8):
            s2 = json.loads(await pg.evaluate("JSON.stringify(SOUND.state)")); peak = max(peak, s2["ambVoices"]); await pg.wait_for_timeout(250)
        check("footstep voices bounded", peak <= 16, peak)
        rode = await pg.evaluate("()=>{const S=window.__dbg.save(); try{ HORSES.buy(S,'Bess','bay'); }catch(e){} return typeof HORSES!=='undefined' && HORSES.riding ? HORSES.riding(S) : null}")
        st = await state(1200); check("riding ok", st["ambVoices"] <= 16, [rode, st])
        # background / foreground
        await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
        st = await state(600); check("hidden suspends", st["ctx"] in ("suspended", "closed"), st)
        await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
        st = await state(1000); check("visible resumes", st["ctx"] == "running", st)
        # settings: Ambience slider and mute
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
        has = await pg.evaluate("!!document.querySelector('#snd_amb')")
        check("ambience slider present", has)
        for vv in [0, 100, 30]:
            await pg.evaluate(f"(()=>{{const e=document.querySelector('#snd_amb'); e.value={vv}; e.dispatchEvent(new Event('input',{{bubbles:true}})); e.dispatchEvent(new Event('change',{{bubbles:true}}));}})()")
            await pg.wait_for_timeout(200)
        a = await pg.evaluate("SOUND.settings.amb"); check("ambience 30 stored", abs(a - 0.3) < 0.01, a)
        await pg.evaluate("(()=>{const e=document.querySelector('#snd_amb'); e.value=0; e.dispatchEvent(new Event('input',{bubbles:true}));})()")
        await pg.wait_for_timeout(5500); st = json.loads(await pg.evaluate("JSON.stringify(SOUND.state)"))
        check("ambience 0 reaps beds", len(st["beds"]) == 0, st)
        await pg.evaluate("(()=>{const e=document.querySelector('#snd_amb'); e.value=50; e.dispatchEvent(new Event('input',{bubbles:true}));})()")
        st = await state(1500); check("ambience back", len(st["beds"]) > 0, st)
        m = await pg.query_selector("[data-act=pref][data-k=mute][data-v='true']")
        if m:
            await m.click(); await pg.wait_for_timeout(5500); st = json.loads(await pg.evaluate("JSON.stringify(SOUND.state)"))
            check("mute reaps beds", len(st["beds"]) == 0, st)
            m2 = await pg.query_selector("[data-act=pref][data-k=mute][data-v='false']")
            if m2: await m2.click()
            st = await state(1500); check("unmute restores", len(st["beds"]) > 0, st)
        else:
            check("mute button found", False)
        e2 = [e for e in errs if "favicon" not in e and "404" not in e]
        check("no page errors", not e2, e2)
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + ",".join(fails))
asyncio.run(main())
