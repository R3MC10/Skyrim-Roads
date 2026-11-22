# Foe perks on the encounter card and at the top of the fight log. python3 foeperks_ui.py [port]  -> RESULT OK
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8853"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs, bad = [], []
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fp{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Perky"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=24; S.hpBonus=200; S.gold=5000;
               for (const k of ['One-Handed','Heavy Armor','Blocking']) S.skills[k].lvl=70; G.give(S,'steel_sword'); const r=S.inv.find(x=>x.item==='steel_sword'); G.equip(S,r.id); G.setHealth(S,G.maxHealth(S));
               for (let i=0;i<4;i++) QUESTS.check(S); G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); const base=Object.values(DUNGEONS.ENEMY).find(e=>/Bandit chief/i.test(e.name))||D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw');
               S.trip.status='encounter'; S.trip.encounter={...G.scaleEnemy({...base, level:26},S.level), hold:'Whiterun', danger:'medium', text:'A big brute blocks the road.'}; }""")
            await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
            if await pg.query_selector("[data-act=openenc]"): await pg.click("[data-act=openenc]")
            await pg.wait_for_timeout(400)
            card = await pg.evaluate("document.querySelector('#modal .foeperks')?.textContent || ''")
            print(style, "card:", card)
            if "·" not in card: bad.append(style + " no perks on card")
            await pg.screenshot(path=f"foeperks_card_{style}.png")
            await pg.click("[data-act=enc][data-a=fight]")
            try: await pg.wait_for_selector("#modal .flog", timeout=8000)
            except Exception: pass
            await pg.wait_for_timeout(300)
            line = await pg.evaluate("document.querySelector('#modal .flog .fpline')?.textContent || ''")
            print(style, "log:", line)
            if "·" not in line: bad.append(style + " no perk line in fight log")
            await pg.evaluate("document.querySelector('#modal details')?.setAttribute('open','')")
            await pg.screenshot(path=f"foeperks_log_{style}.png", full_page=False)
            await ctx.close()
        print("errors", errs)
        print("RESULT OK" if not errs and not bad else "RESULT FAIL " + "; ".join(bad))
        await b.close()
asyncio.run(main())
