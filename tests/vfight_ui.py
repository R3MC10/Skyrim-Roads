import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8773"
FOES = ["Bandit outlaw", "Lone wolf", "Frost troll", "Dragon", "Draugr", "Frostbite spider", "Sabre cat", "Black bear", "Skeleton", "Vampire", "Giant", "Forsworn ambush", "Thalmor patrol", "Skeever", "Mudcrab", "Wolf pack"]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=vf{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fighter"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            # a real road encounter
            await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=8; S.hpBonus=60; G.setHealth(S,G.maxHealth(S));
               G.give(S,'steel_sword'); const r=S.inv.find(x=>x.item==='steel_sword'); G.equip(S,r.id);
               G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); const base=D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw');
               S.trip.status='encounter'; S.trip.encounter={...G.scaleEnemy(base,S.level), hold:'Whiterun', danger:base.danger}; }""")
            await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
            if await pg.query_selector("[data-act=openenc]"): await pg.click("[data-act=openenc]")
            await pg.wait_for_timeout(300)
            await pg.click("[data-act=enc][data-a=fight]"); await pg.wait_for_timeout(900)
            el = await pg.query_selector("#modal .fscene")
            print(style, "encounter scene:", bool(el), "| modal:", (await pg.evaluate("document.querySelector('#modal h2')?.textContent")))
            if el: await el.screenshot(path=f"vf_{style}_enc_mid.png"); await pg.wait_for_timeout(3000); await el.screenshot(path=f"vf_{style}_enc_end.png")
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            # gallery of foes (real fights, final frames)
            await pg.evaluate("""(foes)=>{ const S=window.__dbg.save(); const box=document.createElement('div'); box.id='gal'; box.style.cssText='position:fixed;inset:0;z-index:999;background:#111;overflow:auto;padding:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px';
               for (const n of foes) { const base=D.ENCOUNTERS.find(e=>e.name===n); const f=new G.Fight(S, G.scaleEnemy(base,S.level)); f.run(); const d=document.createElement('div'); d.innerHTML=FIGHTART.placeholder(f,S); box.appendChild(d); }
               document.body.appendChild(box); }""", FOES)
            await pg.wait_for_timeout(3800)
            await pg.screenshot(path=f"vf_{style}_gallery.png")
            t = await pg.evaluate("""()=>{ const S=window.__dbg.save(); const base=D.ENCOUNTERS.find(e=>e.name==='Dragon'); const f=new G.Fight(S,G.scaleEnemy(base,S.level)); f.run(); const d=document.createElement('div'); d.style.width='360px'; d.innerHTML=FIGHTART.placeholder(f,S); document.body.appendChild(d);
               return new Promise(r=>{ setTimeout(()=>{ const c=d.querySelector('canvas'); const t0=performance.now(); let n=0; function go(){ n++; if(n<30) requestAnimationFrame(go); else r((performance.now()-t0)/30);} requestAnimationFrame(go); },50); }); }""")
            print(style, "avg frame interval ms:", round(t, 1))
            await ctx.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
