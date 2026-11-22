"""Screenshot tour of the main screens. Usage: python3 vis_shots.py PORT OUTPREFIX [ink|pixel]"""
import asyncio, sys
from playwright.async_api import async_playwright
PORT, OUT = sys.argv[1], sys.argv[2]
STYLE = sys.argv[3] if len(sys.argv) > 3 else "ink"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=1)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=vs{STYLE}"); await pg.wait_for_timeout(1500)
        if STYLE == "pixel": await pg.evaluate("()=>{ART.setStyle('pixel')}")
        await pg.screenshot(path=f"{OUT}title_{STYLE}.png")
        await pg.click(".press"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{OUT}menu_{STYLE}.png")
        await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Vera"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{const S=__dbg.save(); S.level=22; S.gold=1840; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
          S.spells=[...new Set([...(S.spells||[]),'firebolt','flames','frostbite','sparks','healing','fast_healing','oakflesh'])];
          for (const id of ['steel_sword','elven_bow','ebony_dagger','daedric_mace','glass_helmet','iron_helmet','potion_health']) { try{G.give(S,id,1)}catch(e){} }
          QUESTS.ensure(S); S.quests.companions={stage:1,t:G.now()}; S.quests.main.stage=2; }""")
        async def clear():
            await pg.evaluate("()=>{document.querySelectorAll('#modal,.toast,.pbanner,#banner,#loadcard').forEach(e=>e.remove())}")
        async def go(t, name):
            await clear(); await pg.evaluate(f"()=>{{window.__ui.closeMenu(); window.__ui.go('{t}')}}"); await pg.wait_for_timeout(500); await clear()
            await pg.screenshot(path=f"{OUT}{name}_{STYLE}.png")
        await go("map", "travel"); await go("town", "town"); await go("hero", "hero"); await go("log", "journal"); await go("social", "social")
        await go("tactics", "tactics")
        for m in ["items", "magic"]:
            await clear(); await pg.evaluate(f"()=>window.__ui.openMenu('{m}')"); await pg.wait_for_timeout(500)
            if m == "items": await pg.evaluate("()=>document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}{m}_{STYLE}.png")
            await pg.evaluate("()=>{const r=document.querySelector('#sky .skrow, #sky [data-act=skysel]'); r&&r.click()}"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}{m}sel_{STYLE}.png")
        await pg.evaluate("()=>{const b=document.querySelector('#sky [data-act=uxhelp]'); b&&b.click()}"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f"{OUT}legend_{STYLE}.png")
        await pg.evaluate("()=>window.__ui.closeMenu()")
        # compass
        await pg.evaluate("()=>{ if (typeof TABMENU!=='undefined') TABMENU.openHub() }"); await pg.wait_for_timeout(500); await clear()
        await pg.screenshot(path=f"{OUT}hub_{STYLE}.png")
        await pg.evaluate("()=>{ try{ TABMENU.closeHub() }catch(e){} }")
        # fight
        await pg.evaluate("""()=>{ const S=__dbg.save(); const troll=D.ENCOUNTERS.find(e=>/troll/i.test(e.name));
              const f=new G.Fight(S, G.scaleEnemy({...troll}, 20)); f.rules=[{if:'always',do:'spell:firebolt'}]; f.ai=false; f.mp=9999; f.hp=9999; f.run({trySneak:false});
              const b=document.createElement('div'); b.id='vsbox'; b.style.cssText='position:fixed;left:0;top:0;width:412px;z-index:9999;background:#111;padding:4px';
              document.body.appendChild(b); const d=document.createElement('div'); d.style.width='404px'; d.innerHTML=FIGHTART.placeholder(f, S); b.appendChild(d); FIGHTART.manual(true); }""")
        await pg.wait_for_timeout(300); await pg.evaluate("FIGHTART.advance(2600)"); await pg.wait_for_timeout(100)
        await pg.screenshot(path=f"{OUT}fight_{STYLE}.png")
        await pg.evaluate("FIGHTART.manual(false); document.getElementById('vsbox')?.remove()")
        print("errors", errs)
        await b.close()
asyncio.run(main())
