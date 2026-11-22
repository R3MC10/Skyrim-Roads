import asyncio
from playwright.async_api import async_playwright
U = "http://localhost:8765/index.html"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(U + "?net=bc&notut&p=mu"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Newbie"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        print("offer card:", await pg.evaluate("!!document.querySelector('[data-act=guide]')"))
        await pg.click("[data-act=guide]"); await pg.wait_for_timeout(400)
        txt = await pg.inner_text("#modal"); print("guide:", txt[:160].replace("\n"," | "))
        await pg.screenshot(path="guide.png")
        await pg.click("[data-act=guidego][data-id=tactics]"); await pg.wait_for_timeout(400)
        print("show me -> tab:", await pg.evaluate("document.querySelector('.tab.on')?.dataset.tab"))
        # add a rule -> tactics step ticks
        await pg.click("[data-act=radd]"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("#sndBtn"); await pg.wait_for_timeout(300); await pg.click("#modal [data-act=guide]"); await pg.wait_for_timeout(300)
        print("progress:", (await pg.inner_text("#modal p.sub"))[-14:], "| tactics ticked:", await pg.evaluate("[...document.querySelectorAll('.gstep.done')].map(e=>e.innerText.split('\\n')[0])"))
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # tomes at Winterhold
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; S.discovered.push('Winterhold'); S.gold=9000;}")
        await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=shop][data-id=wizard]"); await pg.wait_for_timeout(300)
        side = await pg.inner_text("#side"); print("college sells incinerate:", "Incinerate" in side, "| Expert label:", "Expert" in side)
        el = await pg.query_selector("#side"); await el.screenshot(path="tomes_shop.png")
        await pg.evaluate("()=>{const S=window.__dbg.save(); let t=G.now(); while(!G.shopsOpen(t)) t+=600; G.buy(S,'tome_thunderbolt',1,t);}")
        await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(500)
        rid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='tome_thunderbolt').id)")
        await pg.evaluate("(id)=>{const b=document.createElement('button'); b.dataset.act='read'; b.dataset.id=id; b.id='tmpread'; document.querySelector('#side').appendChild(b);}", rid)
        await pg.evaluate("document.querySelector('#sky')?.remove()")
        await pg.click("#tmpread"); await pg.wait_for_timeout(300)
        print("learned thunderbolt:", await pg.evaluate("window.__dbg.save().spells.includes('thunderbolt')"))
        # bow + arrows
        await pg.evaluate("()=>{const S=window.__dbg.save(); const b=G.give(S,'hunting_bow'); G.equip(S,b);}")
        await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        print("hero no-ammo warning:", await pg.evaluate("document.querySelector('.sub.ammo')?.innerText"))
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.give(S,'arrow_steel',60);}"); await pg.click("[data-tab=tactics]"); await pg.wait_for_timeout(300)
        print("tactics ammo note:", await pg.evaluate("document.querySelector('.sub.ammo')?.innerText"))
        used = await pg.evaluate("()=>{const S=window.__dbg.save(); const e=G.scaleEnemy({name:'Dummy',danger:'low',level:5,tags:['humanoid'],health:300,damage:1,gold:[0,0]},5); const f=new G.Fight(S,e); f.run(); f.apply(G.now()); return 60-S.inv.filter(r=>r.item==='arrow_steel').reduce((a,r)=>a+r.qty,0);}")
        print("arrows used in a real fight:", used)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
