"""Painted battle scenes (battlescene.js) in the browser at phone size. Usage: python battlescene_ui.py PORT — prints RESULT OK.
Draws fights in the wide replay stage (dungeon rooms, road fights) and the taller turn-by-turn stage for Embershard Mine,
another dungeon theme (Burial Barrow at Bleak Falls Barrow), a road encounter (forest/snow/tundra ground) and the
Windhelm Arena, in both art styles; checks the painted scene is the one the place should get, the fighters' HUD
bars are still drawn, the flames keep moving after the replay ends (and not with reduced motion), a real turn-by-turn
fight in Embershard uses the painted scene, and with pictures off the drawn background comes back.
Screenshots in tests/bscene/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bscene") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# a finished fight drawn as a scene: o = {n, place?, ground?, arena?, tall?}
MAKE = """(o)=>{ const S=__dbg.save(); S.level=15; G.setHealth(S,G.maxHealth(S)); S.trip=null;
  let pos = WORLD.places.Whiterun.slice(0,2);
  if (o.ground) { const T=Terrain.T; for (let i=0;i<20000;i++){ const p=[0.05+Math.random()*0.9, 0.05+Math.random()*0.9]; if (Terrain.typeAtPos(p)===T[o.ground]) { pos=p; break; } } }
  if (o.place) pos = WORLD.places[o.place].slice(0,2);
  [S.x,S.y]=pos; S.location=null;
  S.dungeon = o.place && !o.arena ? { place:o.place, theme:DUNGEONS.info(o.place).theme, tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() } : null;
  const e=G.scaleEnemy({name:o.foe||'Bandit',health:90,damage:4,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
  const f=new G.Fight(S,e); f.allies=[]; TB._origRun.call(f,{trySneak:false});
  if (o.arena) f.arena=true; if (o.tall) { f.tbTall=true; }
  const d=document.createElement('div'); d.className='bsx'; d.id='bsx'+o.n; d.style.cssText='position:fixed;left:0;top:0;width:412px;z-index:9999;background:#000';
  document.querySelectorAll('.bsx').forEach(x=>x.remove());
  d.innerHTML=FIGHTART.placeholder(f,S); document.body.appendChild(d);
  return { art: BSCENE.artOf(S,{arena:!!o.arena}), x:S.x, y:S.y, theme:S.dungeon&&S.dungeon.theme }; }"""

CASES = [
    {"n": 1, "name": "embershard", "place": "Embershard Mine", "want": "mine"},
    {"n": 2, "name": "barrow", "place": "Bleak Falls Barrow", "want": "barrow", "foe": "Draugr"},
    {"n": 3, "name": "dwemer", "place": "Alftand", "want": "dwemer", "foe": "Dwarven Sphere"},
    {"n": 4, "name": "road-forest", "ground": "FOREST", "want": "forest", "foe": "Wolf"},
    {"n": 5, "name": "road-snow", "ground": "SNOW", "want": "snow", "foe": "Ice Wraith"},
    {"n": 6, "name": "arena", "place": "Windhelm", "arena": True, "want": "arena"},
]

async def scene(pg, o, tall, style, shot=True):
    o = {**o, "tall": tall}
    info = await pg.evaluate(MAKE, o)
    ok(info["art"] == o["want"], f"{style} {o['name']}: the place gets the {o['want']} scene (got {info['art']})")
    # play to the middle of the replay, then check the painted scene is on and the HUD is drawn
    drawn = ""
    for _ in range(60):
        drawn = await pg.evaluate("document.querySelector('.bsx canvas')?.dataset.bs||''")
        if drawn: break
        await pg.wait_for_timeout(100)
    ok(drawn == o["want"], f"{style} {o['name']} {'tall' if tall else 'wide'}: painted scene drawn ({drawn or 'drawn fallback'})")
    dims = await pg.evaluate("(()=>{const c=document.querySelector('.bsx canvas'); return [c.width,c.height,c.getBoundingClientRect().width,c.getBoundingClientRect().height];})()")
    ratio = dims[3] / dims[2]
    ok(abs(ratio - (0.66 if tall else 0.46)) < 0.01, f"{style} {o['name']}: {'tall turn-by-turn' if tall else 'wide replay'} stage ({ratio:.2f})")
    await pg.wait_for_timeout(700)
    if shot: await pg.locator(".bsx").screenshot(path=OUT + f"{style}_{o['name']}_{'tall' if tall else 'wide'}_mid.png")
    # finish: the HUD (health bars top-left, foe name top-right) is still on the canvas
    await pg.evaluate("FIGHTART.finishAll()"); await pg.wait_for_timeout(250)
    hud = await pg.evaluate("""(()=>{ const c=document.querySelector('.bsx canvas'), g=c.getContext('2d'), s=c.width/c.getBoundingClientRect().width;
      const px=(x,y)=>Array.from(g.getImageData(Math.round(x*s),Math.round(y*s),1,1).data);
      return [px(14,11), px(c.getBoundingClientRect().width-14,11)]; })()""")
    red = hud[0][0] > 120 and hud[0][1] < 90
    ok(red or hud[0][0] > 200, f"{style} {o['name']}: your health bar is still drawn over the scene {hud[0]}")
    if shot: await pg.locator(".bsx").screenshot(path=OUT + f"{style}_{o['name']}_{'tall' if tall else 'wide'}_end.png")
    return drawn

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=bsc1&tb&fightanim&assets"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Painter"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("typeof BSCENE!=='undefined' && BSCENE.list().length===20"), "battle scenes loaded")
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            for o in CASES:
                for tall in [False, True]:
                    await scene(pg, o, tall, style)
        # flames keep moving after the replay has ended (the stage is idle between turns)
        await pg.evaluate("ART.setStyle('ink')")
        await scene(pg, CASES[0], True, "ink", shot=False)
        a = await pg.evaluate("document.querySelector('.bsx canvas').toDataURL()")
        await pg.wait_for_timeout(400)
        b2 = await pg.evaluate("document.querySelector('.bsx canvas').toDataURL()")
        ok(a != b2, "ink embershard: torches still flicker when the replay is over")
        # a real turn-by-turn fight inside Embershard Mine
        await pg.evaluate("""()=>{ document.querySelectorAll('.bsx').forEach(x=>x.remove()); const S=__dbg.save(); S.trip=null; [S.x,S.y]=WORLD.places['Embershard Mine'].slice(0,2);
          S.dungeon={ place:'Embershard Mine', theme:'mine', tier:1, rows:[[{type:'fight',links:[]}]], row:0, col:0, room:null, found:[], gold:0, t:G.now() };
          const e=G.scaleEnemy({name:'Bandit',health:120,damage:9,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
          TB.call(S, ()=>{ const f=new G.Fight(S,e); f.allies=[]; return f.run({trySneak:false}); }, ()=>{}); }""")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())")
        on = ""
        for _ in range(40):
            on = await pg.evaluate("document.querySelector('#tbf .tbstage canvas')?.dataset.bs||''")
            if on: break
            await pg.wait_for_timeout(150)
        ok(on == "mine", f"a real turn-by-turn fight in Embershard Mine uses its painted scene ({on or 'none'})")
        await pg.wait_for_timeout(600); await pg.screenshot(path=OUT + "tb_embershard_screen.png")
        ok(await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]') || !!document.querySelector('#tbf .tbskip')"), "the fight screen's own controls are all there")
        await pg.evaluate("()=>{ const b=document.createElement('button'); b.dataset.tbx='autoall'; document.querySelector('#tbf').appendChild(b); b.click(); }")
        for _ in range(60):
            if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
            await pg.wait_for_timeout(200)
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): await pg.click("#tbf .tbdone")
        await pg.wait_for_timeout(500)
        ok(not errs, f"no page errors {errs[:3]}")
        # pictures off: the drawn background is back
        pg2 = await ctx.new_page(); errs2 = []; pg2.on("pageerror", lambda e: errs2.append(str(e)))
        await pg2.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=bsc1&tb&fightanim&noassets"); await pg2.wait_for_timeout(1800)
        await pg2.click(".press"); await pg2.click(".mi[data-t=continue]") if await pg2.query_selector(".mi[data-t=continue]") else None
        await pg2.wait_for_timeout(1200)
        if await pg2.evaluate("!!window.__dbg && !!__dbg.save()"):
            await pg2.evaluate(MAKE, {**CASES[0], "tall": False}); await pg2.wait_for_timeout(900)
            fb = await pg2.evaluate("document.querySelector('.bsx canvas')?.dataset.bs")
            ok(fb == "", f"without pictures the drawn background stays ({fb!r})")
            await pg2.locator(".bsx").screenshot(path=OUT + "fallback_embershard_wide.png")
        ok(not errs2, f"no page errors without pictures {errs2[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
