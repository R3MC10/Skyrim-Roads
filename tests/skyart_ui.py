# SKY across the game: fight scenes, road events, place pictures and the top-bar icon at many times, seasons and weathers, both art styles
import asyncio, sys, base64, io
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8786"
COMBOS = [("day","clear","summer",False),("dawn","fog","spring",False),("dusk","rain","autumn",False),("night","clear","winter",True),
          ("night","snow","winter",False),("day","storm","summer",False),("day","clear","autumn",False),("dusk","clear","spring",False),
          ("day","blizzard","winter",True),("night","clear","summer",False),("day","cloudy","winter",False),("dawn","clear","autumn",True)]
async def main():
    from PIL import Image
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=sky"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Skye"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # top bar icon present
        print("top bar:", await pg.evaluate("document.querySelector('#clock')?.innerText"), "| icon:", await pg.evaluate("!!document.querySelector('#clock img.skyic')"))
        sheets = {}
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            rows = []
            for (tod, wx, season, north) in COMBOS:
                urls = await pg.evaluate("""async ([tod,wx,season,north])=>{
                  const S=window.__dbg.save(); const st=SKY.make({tod,weather:wx,season,north,cold:north,moon:4});
                  const orig=SKY.state; SKY.state=()=>st;
                  const ev={id:'shrine', god:'Talos'};
                  const evt=(EVENTART.road(ev,{tod,weather:wx,season,pos:north?WORLD.places.Winterhold:WORLD.places.Whiterun}).match(/src="([^"]+)"/)||[])[1];
                  const place=(PLACEART.scene('Riverwood',{tod,weather:wx,season}).match(/src="([^"]+)"/)||[])[1];
                  const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw')||D.ENCOUNTERS.find(e=>(e.tags||[]).includes('humanoid'));
                  const f=new G.Fight(S,G.scaleEnemy(base,S.level)); f.run();
                  const d=document.createElement('div'); d.style.width='360px'; d.innerHTML=FIGHTART.placeholder(f,S); document.body.appendChild(d);
                  SKY.state=orig;
                  await new Promise(r=>setTimeout(r,900));
                  const cv=d.querySelector('canvas'); const fight=cv?cv.toDataURL():null; d.remove();
                  const icon=(SKY.icon(st,44).match(/src="([^"]+)"/)||[])[1];
                  return {evt,place,fight,icon};
                }""", [tod, wx, season, north])
                imgs = []
                for k in ["fight","evt","place","icon"]:
                    u = urls.get(k)
                    if not u: imgs.append(None); continue
                    im = Image.open(io.BytesIO(base64.b64decode(u.split(",")[1]))).convert("RGB")
                    tw = 260 if k != "icon" else 60; im = im.resize((tw, max(1, round(im.height * tw / im.width))))
                    imgs.append(im)
                rows.append(((tod, wx, season, north), imgs))
            W = 260*3 + 60 + 50; Hh = sum(max(i.height for i in r[1] if i) + 6 for r in rows)
            sheet = Image.new("RGB", (W, Hh), (20, 22, 26)); y = 0
            for (label, imgs) in rows:
                x = 0; h = max(i.height for i in imgs if i)
                for im in imgs:
                    if im: sheet.paste(im, (x, y))
                    x += (im.width if im else 260) + 10
                y += h + 6
            sheet.save(f"vwx/sheet_{style}.png"); sheets[style] = len(rows)
        # a real fight scene mid-replay with weather particles (snow at night, winter)
        await pg.evaluate("ART.setStyle('ink')")
        shot = await pg.evaluate("""async()=>{ const S=window.__dbg.save(); const st=SKY.make({tod:'night',weather:'snow',season:'winter',north:true,cold:true}); const orig=SKY.state; SKY.state=()=>st;
            const base=D.ENCOUNTERS.find(e=>e.name==='Lone wolf')||D.ENCOUNTERS[0]; const f=new G.Fight(S,G.scaleEnemy(base,S.level)); f.run();
            const d=document.createElement('div'); d.style.width='360px'; d.innerHTML=FIGHTART.placeholder(f,S); document.body.appendChild(d); SKY.state=orig;
            await new Promise(r=>setTimeout(r,450)); const u=d.querySelector('canvas').toDataURL(); await new Promise(r=>setTimeout(r,500)); const u2=d.querySelector('canvas').toDataURL(); d.remove(); return [u,u2]; }""")
        for i, u in enumerate(shot): open(f"vwx/fight_anim_{i}.png", "wb").write(base64.b64decode(u.split(",")[1]))
        print("fight frames differ (snow moving):", shot[0] != shot[1])
        # top bar at different moods (patch SKY.state)
        for tod, wx in [("day","clear"),("night","snow"),("dusk","storm")]:
            await pg.evaluate(f"(()=>{{ const st=SKY.make({{tod:'{tod}',weather:'{wx}'}}); const o=SKY.state; SKY.state=()=>st; window.__dbg && 0; setTimeout(()=>SKY.state=o, 2500); }})()")
            await pg.wait_for_timeout(1300)
            el = await pg.query_selector(".top"); await el.screenshot(path=f"vwx/top_{tod}_{wx}.png")
        print("sheets:", sheets)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
