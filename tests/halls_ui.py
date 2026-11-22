import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8823"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(pg, sel):
            for _ in range(10):
                await clear(pg)
                if await pg.evaluate("(s)=>{const e=document.querySelector(s); if(!e||e.disabled) return false; e.click(); return true}", sel): await pg.wait_for_timeout(300); return
                await pg.wait_for_timeout(300)
            print("  (no clickable", sel, ")")
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            return pg
        A = await phone("ha", "Alfa"); B = await phone("hb", "Beta")
        for pg in (A, B):
            await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=60000; if(!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun'); for(const [m,n] of [['mat_iron',30],['mat_firewood',60],['mat_steel',20],['mat_leather',10],['mat_moonstone',10],['mat_silver',5],['mat_gold',2],['dragon_bone',1]]) G.give(S,m,n);}")
        async def halls(pg):
            await click(pg, "[data-tab=map]"); await click(pg, "[data-tab=town]"); await click(pg, "[data-act=shop][data-id=halls]")
        await halls(A)
        await clear(A); await A.fill("#hname", "Skyforge Hall"); await click(A, "[data-act=hplot]")
        for r in ["forge", "shrine", "trophy", "storage", "counter"]: await click(A, f"[data-act=hbuild][data-id={r}]")
        await click(A, "[data-act=htab][data-id=decor]")
        for d in ["rug", "banner", "candles", "map"]: await click(A, f"[data-act=hdecor][data-id={d}]")
        await click(A, "[data-act=htab][data-id=staff]")
        for s in ["shopkeeper", "steward", "guard"]: await click(A, f"[data-act=hhire][data-id={s}]")
        await click(A, "[data-act=htab][data-id=store]"); await click(A, "[data-act=hmount]")
        await click(A, "[data-act=htab][data-id=rooms]"); await click(A, "[data-act=hpray]"); await click(A, "[data-act=hrest]")
        st = await A.evaluate("JSON.stringify((s=>({rooms:s.hall.rooms,decor:s.hall.decor,staff:Object.keys(s.hall.staff),tro:s.hall.trophies.length,rest:s.restBonus,fx:s.fx.map(f=>f.name)}))(window.__dbg.save()))")
        print("A hall:", st)
        await A.wait_for_timeout(400)
        el = await A.query_selector("#side"); await el.screenshot(path="halls_own.png")
        # forge tab is there, hall listing at the counter
        print("forge chip:", await A.evaluate("!!document.querySelector('[data-act=shop][data-id=forge]')"))
        await click(A, "[data-act=shop][data-id=market]")
        await click(A, "details summary"); await click(A, "[data-act=mpick]"); await click(A, "[data-act=mlist]"); await A.wait_for_timeout(800)
        print("A listing:", await A.evaluate("document.querySelector('#side').innerText.includes('on your hall counter')"))
        # B sees A's hall, visits
        await halls(B); await B.wait_for_timeout(1500); await click(B, "[data-act=shop][data-id=halls]")
        has = await B.evaluate("!!document.querySelector('[data-act=hvisit]')")
        print("B sees hall:", has)
        if has:
            await click(B, "[data-act=hvisit]"); await B.wait_for_timeout(500)
            el = await B.query_selector("#side"); await el.screenshot(path="halls_visit.png")
            print("B visit:", (await B.inner_text("#side"))[:200].replace("\n", " | "))
        # clan hall: A founds clan, B joins, A buys guild hall, B gives gold
        await A.evaluate("()=>{const S=window.__dbg.save(); const r=CLANS.found(S,'Iron Wolves','IRON',[CLANS.COLORS[0],CLANS.COLORS[1]]); const c={...r.clan, invites:[window.__dbg.save().id==='x'?'':'']}; Store.put('clans',S.id,r.clan); Store.put('clanmem',S.id,{clan:S.id,name:S.name,t:G.now()});}")
        bid = await B.evaluate("window.__dbg.save().id"); aid = await A.evaluate("window.__dbg.save().id")
        await A.evaluate("(bid)=>{const S=window.__dbg.save(); const c=CLANS.byId(S.id); Store.put('clans',S.id,{...c, id:undefined, invites:[bid]});}", bid)
        await A.wait_for_timeout(800)
        await B.evaluate("(aid)=>{const S=window.__dbg.save(); S.clan=aid; Store.put('clanmem',S.id,{clan:aid,name:S.name,t:G.now()});}", aid)
        await A.wait_for_timeout(1200)
        await halls(A); await clear(A); await A.wait_for_selector("#chname", timeout=4000); await A.fill("#chname", "Wolf Hall"); await click(A, "[data-act=hclanplot]"); await A.wait_for_timeout(1200)
        await halls(B); await B.wait_for_timeout(500)
        print("B side tail:", (await B.inner_text("#side"))[-700:].replace("\n", " | "))
        print("B in clan:", await B.evaluate("!!CLANS.of(window.__dbg.save().id, window.__dbg.save())"))
        await click(B, "[data-act=htab][data-id=log]")
        btn = await B.query_selector("[data-act=hdep][data-c='1']")
        print("B donate button:", bool(btn))
        if btn: await click(B, "[data-act=hdep][data-c='1'][data-id='5000']"); await B.wait_for_timeout(1500)
        funds = await A.evaluate("(hallDocs=>0)() || JSON.stringify(Object.values(JSON.parse(localStorage.getItem('hask.w.NORTH')||'{}').halls||{}).map(d=>({n:d.name,f:d.funds})))")
        print("halls in world:", funds)
        await A.wait_for_timeout(600); await halls(A)
        await click(A, "[data-act=htab][data-id=rooms]")
        el = await A.query_selector("#side"); await el.screenshot(path="halls_guild.png")
        print("A guild panel:", (await A.inner_text("#side"))[-900:].replace("\n", " | "))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
