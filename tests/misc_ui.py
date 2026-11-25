import asyncio
import sys
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
U = "http://127.0.0.1:" + PORT + "/index.html"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []; fails = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(U + "?net=bc&notut&p=mu"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Newbie"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        print("offer card:", await pg.evaluate("!!document.querySelector('[data-act=guide]')"))
        await pg.click("[data-act=guide]"); await pg.wait_for_timeout(400)
        txt = await pg.inner_text("#modal"); print("guide:", txt[:160].replace("\n"," | "))
        await pg.screenshot(path=_SHOTS + "guide.png")
        # the guide's "Show me" (the old Tactics step is gone): Buy and sell -> the Area tab
        await pg.click("[data-act=guidego][data-id=trade]"); await pg.wait_for_timeout(400)
        t = await pg.evaluate("document.querySelector('.tab.on')?.dataset.tab"); print("show me -> tab:", t)
        if t != "town": fails.append("guide Show me did not open the Area tab: " + str(t))
        # finish the trade step -> it ticks in the guide
        await pg.evaluate("()=>GUIDE.mark(window.__dbg.save(),'trade')")
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("#sndBtn"); await pg.wait_for_timeout(300); await pg.click("#modal [data-act=guide]"); await pg.wait_for_timeout(300)
        ticked = await pg.evaluate("[...document.querySelectorAll('.gstep.done')].map(e=>e.innerText.split('\\n')[0])")
        print("progress:", (await pg.inner_text("#modal p.sub"))[-14:], "| ticked:", ticked)
        if not any("Buy and sell" in x for x in ticked): fails.append("trade step not ticked")
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # tomes at Winterhold (Expert tomes show up once the school is at 75)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; S.discovered.push('Winterhold'); S.gold=9000; S.skills.Destruction.lvl=75;}")
        await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=shop][data-id=wizard]"); await pg.wait_for_timeout(300)
        side = await pg.inner_text("#side"); print("college sells incinerate:", "Incinerate" in side, "| Expert label:", "Expert" in side)
        el = await pg.query_selector("#side"); await el.screenshot(path=_SHOTS + "tomes_shop.png")
        print('buy:', await pg.evaluate("()=>{const S=window.__dbg.save(); let t=G.now(); while(!G.shopsOpen(t)) t+=600; return G.buy(S,'tome_thunderbolt',1,t);}"))
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
        # with arrows the Character page names what you shoot (the Tactics page that also showed it is gone)
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.give(S,'arrow_steel',60);}"); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(300)
        am = await pg.evaluate("document.querySelector('.sub.ammo')?.innerText"); print("character ammo note:", am)
        if not am or "arrow" not in am.lower(): fails.append("no ammo note with arrows on the Character page")
        used = await pg.evaluate("()=>{const S=window.__dbg.save(); const e=G.scaleEnemy({name:'Dummy',danger:'low',level:5,tags:['humanoid'],health:300,damage:1,gold:[0,0]},5); const f=new G.Fight(S,e); f.run(); f.apply(G.now()); return 60-S.inv.filter(r=>r.item==='arrow_steel').reduce((a,r)=>a+r.qty,0);}")
        print("arrows used in a real fight:", used)
        if not used: fails.append("no arrows used in a fight")
        print("errors:", errs)
        print("RESULT", "OK" if not errs and not fails else "FAIL " + str(fails))
        await b.close()
asyncio.run(main())
