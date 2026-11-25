import asyncio
from playwright.async_api import async_playwright
INIT = """
(() => { const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a){ super(...a); const an = super.createAnalyser(); an.fftSize = 2048; an.connect(super.destination); this.__an = an; window.__an = an; } get destination(){ return this.__an; } };
 window.__peak = () => { const d = new Float32Array(2048); window.__an.getFloatTimeDomainData(d); let p=0, s=0; for (const x of d){ p=Math.max(p,Math.abs(x)); s+=x*x; } return [p, Math.sqrt(s/d.length)]; }; })();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.add_init_script(INIT)
        await pg.goto("http://localhost:8765/index.html?p=snd9"); await pg.wait_for_timeout(2000)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        async def meas(label, n=12):
            pk=0; rms=0
            for i in range(n):
                v = await pg.evaluate("() => __peak()"); pk=max(pk,v[0]); rms=max(rms,v[1]); await pg.wait_for_timeout(120)
            print(f"{label:10s} peak {pk:.3f} rms {rms:.3f}")
        for m in ["day","night","dungeon","combat"]:
            await pg.evaluate(f"() => SOUND.mood('{m}')"); await pg.wait_for_timeout(2500); await meas(m, 20)
        await pg.evaluate("() => SOUND.mood('day')")
        for f in ["hit","coin","levelup","quest","arrive","victory","death","shout","dragon"]:
            await pg.evaluate(f"() => SOUND.fx('{f}')"); await meas(f, 8)
        await b.close()
asyncio.run(main())
