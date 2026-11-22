import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def phone(tag, name, town):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.gold=500; S.discovered.push(t);}", town)
            await pg.wait_for_timeout(800); await clear(pg); return pg
        A = await phone("sa", "Alfa", "Whiterun"); B = await phone("sb", "Beta", "Riften")
        await A.wait_for_timeout(32000)
        await clear(A); await A.click("#socBtn"); await A.wait_for_timeout(300)
        await A.fill("#socsearch", "Be"); await A.wait_for_timeout(300)
        await A.click("[data-act=fadd]"); await A.wait_for_timeout(500)
        print("A friends:", (await A.inner_text("#side"))[:220].replace("\n"," | "))
        await A.screenshot(path="social_A.png")
        await B.wait_for_timeout(800); print("B toast:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        print("B badge:", await B.evaluate("!!document.querySelector('#socBtn .dot')"))
        await clear(B); await B.click("#socBtn"); await B.wait_for_timeout(300); await B.click("[data-act=faddrec]"); await B.wait_for_timeout(300)
        # message
        await clear(A); await A.click("[data-act=fmsg]"); await A.wait_for_timeout(300); await A.fill("#dmin", "Hej Beta, want a ruby?"); await A.press("#dmin", "Enter"); await A.wait_for_timeout(700)
        print("B dm toast:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        await clear(B); await B.click("[data-act=soctab][data-id=msgs]"); await B.wait_for_timeout(300)
        print("B msgs:", (await B.inner_text("#side"))[:200].replace("\n"," | "))
        await B.click("[data-act=fmsg]"); await B.wait_for_timeout(300); await B.fill("#dmin", "Sure!"); await B.click("[data-act=dmsend]"); await B.wait_for_timeout(600)
        await B.screenshot(path="social_B_thread.png")
        print("A thread:", (await A.inner_text("#chatlog")).replace("\n"," | "))
        # courier trade: gift 40 gold + a potion
        print("gold before trade A,B:", await A.evaluate("window.__dbg.save().gold"), await B.evaluate("window.__dbg.save().gold"), await A.evaluate("window.__dbg.save().journal.slice(-6).map(j=>j.text).join(' / ')"))
        await clear(A); await A.click("[data-act=soctab][data-id=friends]"); await A.wait_for_timeout(200); await A.click("[data-act=ftrade]"); await A.wait_for_timeout(300)
        print("modal:", (await A.inner_text("#modal p.sub"))[:120])
        await A.fill("#tgive", "40"); await A.click("[data-act=tradesend]"); await A.wait_for_timeout(700)
        print("A toast:", await A.evaluate("document.querySelector('#toast')?.textContent"), "A gold now", await A.evaluate("window.__dbg.save().gold"))
        await clear(B); await B.click("[data-act=soctab][data-id=trades]"); await B.wait_for_timeout(300)
        print("B trades before:", (await B.inner_text("#side"))[:200].replace("\n"," | "))
        # fast-forward the courier
        await B.evaluate("async()=>{ for (const d of (await new Promise(r=>Store.watch('trades', r)))) {} }")
        await A.evaluate("async()=>{ const id = Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/world/.test(k)))||'{}').trades||{})[0]; }")
        await B.evaluate("()=>{}")
        tid = await B.evaluate("new Promise(r=>Store.watch('trades', ds=>r(ds.find(d=>d.courier&&d.status==='open')?.id)))")
        await B.evaluate("(id)=>Store.change('trades', id, d=>({...d, arrive: Date.now()/1000-1}))", tid); await B.wait_for_timeout(6500)
        await clear(B); await B.click("[data-act=soctab][data-id=trades]"); await B.wait_for_timeout(300)
        await B.click("[data-act=tradeyes]"); await B.wait_for_timeout(900)
        ga, gb = await A.evaluate("window.__dbg.save().gold"), await B.evaluate("window.__dbg.save().gold")
        print("gold A,B:", ga, gb, "sum", ga+gb)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
