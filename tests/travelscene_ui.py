"""Travel strip (travelart.js): screenshots of the real trip panel by day, night and in snow, in both art styles, plus
a gallery of every region. Saves to tests/out_travelscene/. Usage: python3 travelscene_ui.py PORT"""
import asyncio, base64, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_travelscene")
os.makedirs(OUT, exist_ok=True)
CHROME = "/usr/bin/google-chrome"

SKIES = {
    "day": "{tod:'day',season:'summer',weather:'clear'}",
    "night": "{tod:'night',season:'autumn',weather:'clear',north:true,cold:true,moon:4}",
    "snow": "{tod:'day',season:'winter',weather:'snow',cold:true}",
    "dusk_rain": "{tod:'dusk',season:'summer',weather:'rain'}",
}

async def main():
    async with async_playwright() as p:
        opts = {"args": ["--no-sandbox"]}
        if os.path.exists(CHROME): opts["executable_path"] = CHROME
        b = await p.chromium.launch(**opts)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?notut&assets"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # gear up so the hero shows a helmet, armour, shield and sword
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
            S.equipped = Object.assign(S.equipped||{}, {chest:'iron_armor', head:'iron_helmet', shield:'iron_shield', weapon:'iron_sword'});
            G.startTrip(S, 'Riverwood', WORLD.places.Riverwood); S.trip.total = S.trip.total || 60; }""")
        for style in ("ink",):
            for name, sky in SKIES.items():
                await pg.evaluate("(sky)=>{ window.__skyOrig = window.__skyOrig || SKY.state; const fixed = SKY.make(eval('('+sky+')')); SKY.state = () => fixed; }", sky)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate("()=>{ try { window.__ui && window.__ui.refresh && window.__ui.refresh(); } catch(e){} }")
                await pg.wait_for_timeout(1400)   # let it animate a little
                await pg.evaluate("()=>{ document.querySelector('#trip').scrollIntoView({block:'start'}); const t=document.querySelector('#tabs'); if (t) t.style.visibility='hidden'; document.querySelectorAll('.toast').forEach(n=>n.remove()); }")
                el = await pg.query_selector("#trip")
                if el and await el.is_visible():
                    path = os.path.join(OUT, f"panel_{style}_{name}.png"); await el.screenshot(path=path); print("saved", path)
                else: print("trip panel not visible for", style, name)
            # a gallery of every region at 3x, straight from the canvas
            shots = await pg.evaluate("""(style)=>{ const S=window.__dbg.save(), look=HEROART.lookOf(S), out=[];
                const cases=[['Pine forest','day','summer','clear','Falkreath'],['Tundra','dusk','summer','clear','Whiterun'],['Autumn forest','day','autumn','clear','Riften'],
                  ['Marsh','dawn','spring','fog','Morthal'],['Snow','night','winter','blizzard','Winterhold'],['Volcanic tundra','day','summer','ashstorm','Fort Greymoor'],
                  ['Road','night','summer','clear','Whiterun'],['Rocky hills','day','spring','storm','Markarth']];
                const co=[{name:'Lydia',look:{...look,r:'nord',id:'lydia'},follower:true},{name:'Kacper',look:{...look,r:'dunmer',id:'k'},riding:true,horse:'#3a2a20'}];
                for (const [ground,tod,season,weather,dest] of cases) { const sky=SKY.make({tod,season,weather,north:true});
                  const c=TRAVELART.frame({ground,progress:0.65,look,sky,dest,origin:'Whiterun',company:co}, 640, {scale:3,warm:40}); out.push([ground+'_'+tod+'_'+weather, c.toDataURL('image/png')]); }
                return out; }""", style)
            for nm, url in shots:
                path = os.path.join(OUT, f"gallery_{style}_{nm.replace(' ', '').replace('(', '').replace(')', '')}.png")
                with open(path, "wb") as f: f.write(base64.b64decode(url.split(",")[1]))
                print("saved", path)
        print("page errors:", errs[:5] if errs else "none")
        await b.close()
        if errs: sys.exit(1)

asyncio.run(main())
