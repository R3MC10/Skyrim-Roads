import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("response", lambda r: errs.append("HTTP " + str(r.status) + " " + r.url) if r.status >= 400 else None)
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "net::" not in m.text else None)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=snd"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.wait_for_timeout(600)
        print("after first tap:", await pg.evaluate("JSON.stringify(SOUND.state)"))
        await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sonja"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        # moods back and forth quickly
        await pg.evaluate("async()=>{ for (const m of ['combat','dungeon','night','title','day','combat','day','combat','night','day']) { SOUND.mood(m); await new Promise(r=>setTimeout(r,120)); } }")
        await pg.wait_for_timeout(800)
        print("after mood storm:", await pg.evaluate("JSON.stringify(SOUND.state)"))
        # effect spam: 60 coins, 30 hits, shouts
        v = await pg.evaluate("async()=>{ for (let i=0;i<60;i++) SOUND.fx('coin'); for (let i=0;i<30;i++) SOUND.fx('hit', i*0.01); SOUND.fx('shout'); SOUND.fx('dragon'); SOUND.fight({fight:{log:[1,2,3,4,5,6]}, died:false}); await new Promise(r=>setTimeout(r,200)); return SOUND.state.voices; }")
        print("voices after spam:", v)
        # sliders and mute through the real settings UI
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("#sndBtn"); await pg.wait_for_timeout(300)
        for vv in ["0", "100", "40"]:
            await pg.fill("#snd_music", vv) if False else await pg.evaluate(f"(()=>{{const e=document.querySelector('#snd_music'); e.value={vv}; e.dispatchEvent(new Event('input',{{bubbles:true}})); e.dispatchEvent(new Event('change',{{bubbles:true}}));}})()")
            await pg.wait_for_timeout(150)
        print("music 40:", await pg.evaluate("JSON.stringify([SOUND.settings.music, SOUND.state.music])"))
        await pg.evaluate("(()=>{const e=document.querySelector('#snd_music'); e.value=0; e.dispatchEvent(new Event('input',{bubbles:true}));})()"); await pg.wait_for_timeout(200)
        print("music 0 → playing?", await pg.evaluate("SOUND.state.music"))
        await pg.evaluate("(()=>{const e=document.querySelector('#snd_music'); e.value=35; e.dispatchEvent(new Event('input',{bubbles:true}));})()"); await pg.wait_for_timeout(200)
        print("music 35 → playing?", await pg.evaluate("SOUND.state.music"))
        for mv in ["true", "false"]:
            b2 = await pg.query_selector(f"[data-act=pref][data-k=mute][data-v='{mv}']")
            if b2: await b2.click(); await pg.wait_for_timeout(200)
            print("mute", mv, "→", await pg.evaluate("JSON.stringify([SOUND.settings.mute, SOUND.state.music])"))
        # background / foreground
        await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(500)
        print("hidden:", await pg.evaluate("SOUND.state.ctx"))
        await pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
        await pg.wait_for_timeout(600)
        print("visible:", await pg.evaluate("JSON.stringify(SOUND.state)"))
        await pg.evaluate("SOUND.fx('coin'); SOUND.fx('levelup')")
        await pg.wait_for_timeout(2500)
        print("still alive:", await pg.evaluate("JSON.stringify(SOUND.state)"))
        print("errors:", [e for e in errs if "favicon" not in e and "404" not in e])
        await b.close()
asyncio.run(main())
