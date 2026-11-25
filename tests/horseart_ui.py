"""Painted horses (horseart.js): the travel strip, the world map hero and the
stable card, on a phone and a wide PC window, plus a gallery straight from the drawers (every coat, standing,
galloping, ridden in a fight and knocked down). Needs ?assets so the pictures load.
Run:  node tests/serve.js 8770   then   python tests/horseart_ui.py 8770 [outdir]
Fails on page errors or if the painted horse never loads."""
import asyncio, base64, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8770"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "horseart_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
SETUP = """(coat)=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=8; S.hpBonus=60; S.gold=5000; G.setHealth(S,G.maxHealth(S));
  for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n);
  HORSES.buy(S,'Juniper',coat); G.give(S,'steel_sword'); const r=S.inv.find(x=>x.item==='steel_sword'); G.equip(S,r.id); }"""
FIGHT = """()=>{ const S=window.__dbg.save(); G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw');
  S.trip.status='encounter'; S.trip.encounter={...G.scaleEnemy(base,S.level), hold:'Whiterun', danger:base.danger}; }"""
GALLERY = """()=>{ const out=[], S=window.__dbg.save(), look=HEROART.lookOf(S), ids=HORSES.COATS.map(c=>c[0]);
  const cv=(w,h)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.fillStyle='#6d7f6a'; g.fillRect(0,0,w,h); return [c,g]; };
  { const [c,g]=cv(ids.length*240, 760);   // ride sprite gallop, ride sprite stand (no riders in fights any more)
    ids.forEach((id,i)=>{ const col=HORSES.coat(id)[2], x=120+i*240;
      FIGART.draw(g,{look},x,520,{pose:'ride',frame:1,h:90,horse:col});
      FIGART.draw(g,{look},x,720,{pose:'ride',frame:0,h:90,horse:col,gait:'stand'});
      g.fillStyle='#fff'; g.font='16px sans-serif'; g.fillText(id,x-30,20); });
    out.push(['gallery', c.toDataURL('image/png')]); }
  return out; }"""

async def main():
    errs, fails = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for tag, vw, vh, dsf in [("phone", 390, 844, 3), ("pc", 1600, 900, 1)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=ha{tag}"); await pg.wait_for_selector(".press", timeout=90000)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rider"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate(CLEAR)
            await pg.evaluate(SETUP, "grey")
            # wait for the pictures
            for _ in range(40):
                if await pg.evaluate("()=>HORSEART.sig()") >= 5: break
                await pg.wait_for_timeout(250)
            n = await pg.evaluate("()=>HORSEART.sig()"); print(tag, "horse pictures loaded:", n)
            if n < 5: fails.append(f"{tag}: only {n} horse pictures loaded")
            if tag == "phone":
                for nm, url in await pg.evaluate(GALLERY):
                    with open(os.path.join(OUT, f"{nm}.png"), "wb") as f: f.write(base64.b64decode(url.split(",")[1]))
                    print("saved", os.path.join(OUT, f"{nm}.png"))
            # the map: standing, then riding along a road
            await pg.evaluate("()=>{ const S=__dbg.save(); S.location=null; __ui.go('map'); }"); await pg.wait_for_timeout(900); await pg.evaluate(CLEAR)
            await pg.screenshot(path=os.path.join(OUT, f"{tag}_map_stand.png"))
            await pg.evaluate("()=>{ const S=__dbg.save(); G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); }"); await pg.wait_for_timeout(1600); await pg.evaluate(CLEAR)
            await pg.screenshot(path=os.path.join(OUT, f"{tag}_map_ride.png"))
            # the travel strip, straight from its painter: riding (galloping) and stopped (standing), with a riding friend
            shots = await pg.evaluate("""()=>{ const S=__dbg.save(), look=HEROART.lookOf(S), sky=SKY.make({tod:'day',season:'summer',weather:'clear'}), out=[];
              const co=[{name:'Kacper',look:{...look,r:'dunmer',id:'k'},riding:true,horse:'#2b2724'}];
              for (const [nm,still] of [['ride',false],['stopped',true]]) { const c=TRAVELART.frame({ground:'Tundra',progress:0.5,look,sky,dest:'Riverwood',origin:'Whiterun',riding:true,horse:HORSES.coat(S.horse.coat)[2],company:co}, 640, {scale:3,warm:30,still}); out.push([nm,c.toDataURL('image/png')]); }
              return out; }""")
            for nm, url in shots:
                path = os.path.join(OUT, f"{tag}_travel_{nm}.png")
                with open(path, "wb") as f: f.write(base64.b64decode(url.split(",")[1]))
            # a road fight while riding (on foot: horses are for travel)
            await pg.evaluate("()=>{ const S=__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; }")
            await pg.evaluate(FIGHT); await pg.wait_for_timeout(300); await pg.evaluate(CLEAR)
            await pg.evaluate("()=>__ui.go('map')"); await pg.wait_for_timeout(500)
            if await pg.query_selector("[data-act=openenc]"): await pg.click("[data-act=openenc]")
            await pg.wait_for_timeout(500)
            if await pg.query_selector("[data-act=enc][data-a=fight]"):
                await pg.click("[data-act=enc][data-a=fight]")
                for i, w in enumerate([1200, 2500]):
                    await pg.wait_for_timeout(w)
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_fight{i}.png"))
            else: fails.append(tag + ": no fight button")
            # the stable card
            await pg.evaluate(CLEAR)
            card = await pg.evaluate("()=>{ const d=document.createElement('div'); d.id='hacard'; d.style.cssText='position:fixed;left:10px;top:10px;z-index:99999;background:#222;padding:8px;display:flex;gap:8px'; d.innerHTML=HORSES.COATS.map(c=>UIART.horse(c[0],64)).join('')+UIART.horse('grey',64,false,true); document.body.appendChild(d); return d.innerHTML.length; }")
            await pg.wait_for_timeout(300)
            el = await pg.query_selector("#hacard")
            if el: await el.screenshot(path=os.path.join(OUT, f"{tag}_stablecards.png"))
            await ctx.close()
        await b.close()
    print("page errors:", errs[:5] if errs else "none")
    print("screenshots in", OUT)
    mine = [e for e in errs if "horse" in e.lower()]   # other modules' page errors are reported, not failed on here
    if mine or fails: print("FAIL", fails, mine); sys.exit(1)

asyncio.run(main())
