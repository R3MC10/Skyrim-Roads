"""Fights over painted art look clean (paintclean): a caravan fight in a town street with a follower (Jenassa) and a
helmeted hero holding an enchanted elven bow, at phone size. Usage: python paintclean_ui.py PORT [tag] — prints RESULT OK.
Checks: the painted town scene is on, no drawn wagon is laid over it, the painted fighters wear no drawn-on helmet,
no page errors. Screenshots in tests/out_paintclean/<tag>_*.png (tag defaults to "after")."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
TAG = sys.argv[2] if len(sys.argv) > 2 else "after"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_paintclean") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("C:/Program Files/Google/Chrome/Application/chrome.exe" if os.name == "nt" else "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

MAKE = """(o)=>{ const S=__dbg.save(); S.level=20; G.setHealth(S,G.maxHealth(S)); S.trip=null;
  const lo=G.loadout(S); lo.equipment={};
  for (const id of o.gear) { const r=G.give(S,id); G.equip(S,r); }
  S.follower = { id:'jenassa', hp: TOWNS.followerMax(S,'jenassa'), ts: G.now() };
  [S.x,S.y]=WORLD.places.Whiterun.slice(0,2); S.location='Whiterun'; S.dungeon=null;
  const e=G.scaleEnemy({name:'Caravan Guard',health:140,damage:5,tags:['humanoid'],level:18,danger:'medium',gold:[0,0],text:'',caravan:true,khajiit:false},18);
  const f=new G.Fight(S,e); TB._origRun.call(f,{trySneak:false});
  const d=document.createElement('div'); d.className='bsx'; d.style.cssText='position:fixed;left:0;top:0;width:390px;z-index:9999;background:#000';
  document.querySelectorAll('.bsx').forEach(x=>x.remove());
  d.innerHTML=FIGHTART.placeholder(f,S); document.body.appendChild(d);
  return { art: BSCENE.artOf(S,{}), allies: (f.allies||[]).map(a=>a.name) }; }"""

CASES = [
    ("bow", ["steel_helmet", "leather_armor", "ench|elven_bow|frost|20|800"]),
    ("sword", ["iron_helmet", "iron_armor", "ench|steel_sword|shock|20|800", "iron_shield"]),
]

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&p=pcl1&tb&fightanim&assets"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Painter"); await pg.click(".rpick[data-race=nord]"); await pg.fill("#nm", "Painter"); await pg.click("#begin")
        await pg.wait_for_function("!!(window.__dbg && window.__dbg.save())", timeout=15000)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # count wagon draws and helmet draws on painted rigs
        await pg.evaluate("""()=>{ window.__wag=0; window.__helm=0;
          if (typeof CARAVANS!=='undefined') { const w=CARAVANS.drawWagon; CARAVANS.drawWagon=function(){ window.__wag++; return w.apply(this,arguments); }; }
          if (typeof RIGGEAR!=='undefined') { const h=RIGGEAR.helmet; RIGGEAR.helmet=function(){ window.__helm++; return h.apply(this,arguments); }; } }""")
        for name, gear in CASES:
            info = await pg.evaluate(MAKE, {"gear": gear})
            ok(info["art"] == "town", f"{name}: Whiterun gets the painted town scene ({info['art']})")
            ok("Jenassa" in " ".join(info["allies"]), f"{name}: Jenassa fights beside you {info['allies']}")
            drawn = ""
            for _ in range(60):
                drawn = await pg.evaluate("document.querySelector('.bsx canvas')?.dataset.bs||''")
                if drawn: break
                await pg.wait_for_timeout(100)
            ok(drawn == "town", f"{name}: painted scene drawn ({drawn or 'drawn fallback'})")
            await pg.evaluate("()=>{ window.__wag=0; window.__helm=0; }")   # count from here: before the pictures load, the drawn background may show
            await pg.wait_for_timeout(900)
            await pg.locator(".bsx").screenshot(path=OUT + f"{TAG}_{name}_mid.png")
            await pg.wait_for_timeout(900)
            await pg.locator(".bsx").screenshot(path=OUT + f"{TAG}_{name}_late.png")
            cnt = await pg.evaluate("[window.__wag, window.__helm]")
            ok(cnt[0] == 0, f"{name}: no drawn wagon over the painted scene ({cnt[0]} draws)")
            ok(cnt[1] == 0, f"{name}: no drawn-on helmet on the painted fighters ({cnt[1]} draws)")
            await pg.screenshot(path=OUT + f"{TAG}_{name}_screen.png")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
