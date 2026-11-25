import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8847"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_gather")
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))

async def rows_layout(b, bad):
    """the Gathering card on the Map side panel: each herb row (and the Auto-pick row) gets its own line, at phone and PC width"""
    os.makedirs(OUT, exist_ok=True)
    for w, h in ((360, 800), (1600, 900)):
        ctx = await b.new_context(viewport={"width": w, "height": h})
        pg = await ctx.new_page()
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=garows{w}"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Herba"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        # stand in the thickest patch cluster; half the patches already picked
        await pg.evaluate("""()=>{const S=window.__dbg.save(); let n=GATHER.nodes()[0],best=0;
           for (const m of GATHER.nodes()){const k=GATHER.around(m.pos,60).length; if(k>best){best=k;n=m;}}
           S.location=null; S.x=n.pos[0]; S.y=n.pos[1]; GATHER.st(S).auto=true;
           let i=0; for (const m of GATHER.around([S.x,S.y],120)){GATHER.st(S).seen[m.id]=1; if(i++%2) GATHER.st(S).picked[m.id]=G.now();}}""")
        for t in ("log", "map"):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(f"document.querySelector('[data-tab={t}]')?.click()"); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""()=>{const c=document.querySelector('.gcard'); if(!c) return null; c.scrollIntoView();
           const els=[...c.querySelectorAll('.gnode'), c.querySelector('.gbtns'), c.querySelector('.gauto')].filter(Boolean);
           const bx=els.map(e=>e.getBoundingClientRect()), cb=c.getBoundingClientRect(); let hits=0;
           for (let i=0;i<bx.length;i++) for (let j=i+1;j<bx.length;j++){const a=bx[i],b=bx[j];
             if (a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1) hits++;}
           const out=bx.filter(a=>a.top<cb.top-1||a.bottom>cb.bottom+1).length;
           return {rows:c.querySelectorAll('.gnode').length, picked:c.querySelectorAll('.gnode.gdone').length, hits, out}}""")
        tag = f"[{w}px]"
        if not r: print(f"FAIL {tag} no Gathering card"); bad.append(f"{tag} no card")
        else:
            c = await pg.query_selector(".gcard"); await c.screenshot(path=os.path.join(OUT, f"gather_{w}.png"))
            good = r["rows"] >= 3 and r["picked"] >= 1 and r["hits"] == 0 and r["out"] == 0
            print(("ok   " if good else "FAIL ") + f"{tag} gathering rows don't overlap {r}")
            if not good: bad.append(f"{tag} rows overlap {r}")
        await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME and os.path.exists(CHROME) else p.chromium.launch())
        bad = []
        await rows_layout(b, bad)
        if "--rows" in sys.argv:
            print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad)); await b.close(); return
        for style in ("ink",):
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            errs = []
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ga{style}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Herba"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            async def clean(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            async def tab(t):
                await clean(); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(500)
            async def click(sel):
                await clean(); await pg.evaluate(f"document.querySelector({sel!r})?.click()"); await pg.wait_for_timeout(400)
            ok = lambda c, m: (print(("ok   " if c else "FAIL ") + f"[{style}] " + m), None if c else bad.append(f"{style}: {m}"))
            # stand in the Reach next to a juniper/canis patch; spot everything around
            await pg.evaluate("""()=>{const S=window.__dbg.save(); const n=GATHER.nodes().find(n=>n.ing==='ing_juniper')||GATHER.nodes()[0]; S.location=null; S.x=n.pos[0]; S.y=n.pos[1];
               for (const m of GATHER.around([S.x,S.y],120)) GATHER.st(S).seen[m.id]=1; window.__n=n.id;}""")
            await tab("tactics"); await tab("map")
            card = await pg.query_selector(".gcard")
            ok(bool(card), "Travel shows the Gathering card")
            if card: await card.screenshot(path=f"ga_card_{style}.png")
            await pg.screenshot(path=f"ga_map_{style}.png")
            n0 = await pg.evaluate("()=>window.__dbg.save().inv.filter(r=>D.ITEMS[r.item].slot==='ingredient').reduce((a,r)=>a+r.qty,0)")
            await click("[data-act=gpick]")
            n1 = await pg.evaluate("()=>window.__dbg.save().inv.filter(r=>D.ITEMS[r.item].slot==='ingredient').reduce((a,r)=>a+r.qty,0)")
            ok(n1 > n0, f"Gather picks ingredients ({n0} -> {n1})")
            picked = await pg.evaluate("document.querySelectorAll('.gcard .gnode.gdone').length")
            ok(picked >= 1, "picked patch shows as picked")
            await click("[data-act=gforage]")
            n2 = await pg.evaluate("()=>window.__dbg.save().gather.forage>0")
            ok(n2, "Forage searched the ground")
            await click("[data-act=gnotes]")
            notes = await pg.evaluate("document.querySelector('#modal .gnotes') ? document.querySelectorAll('#modal .gnotes .item').length : 0")
            ok(notes > 60, f"Herbalist's notes list {notes} ingredients")
            # eat one to colour an effect
            await pg.evaluate("""()=>{const S=window.__dbg.save(); G.give(S,'ing_deathbell',1); G.give(S,'ing_blue_flower',1); TOWNS.known(S,'ing_deathbell')[0]=true; TOWNS.known(S,'ing_blue_flower')[0]=true;}""")
            await click("[data-act=gnotes]")
            colours = await pg.evaluate("[document.querySelectorAll('#modal .fx-good').length, document.querySelectorAll('#modal .fx-bad').length]")
            ok(colours[0] > 0 and colours[1] > 0, f"effects colour-coded (good {colours[0]}, bad {colours[1]})")
            m = await pg.query_selector("#modal")
            if m: await m.screenshot(path=f"ga_notes_{style}.png")
            col = await pg.evaluate("getComputedStyle(document.querySelector('#modal .fx-bad')).color")
            ok("228" in col, f"harmful effects are red: {col}")
            await clean()
            # auto-pick toggle
            await click("[data-act=gauto]")
            ok(await pg.evaluate("window.__dbg.save().gather.auto===true"), "auto-pick toggles on")
            # garden in a home
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.homes={Whiterun:{chest:[],garden:0}}; G.give(S,'ing_lavender',2);}""")
            await tab("town")
            await pg.evaluate("document.querySelector('[data-act=shop][data-id=home]')?.click()"); await pg.wait_for_timeout(400)
            has = await pg.evaluate("!!document.querySelector('[data-act=gplant]')")
            ok(has, "home garden offers planting")
            if has:
                await click("[data-act=gplant]")
                beds = await pg.evaluate("(window.__dbg.save().gather.beds.Whiterun||[]).length")
                ok(beds == 1, "planted a bed")
                g = await pg.query_selector(".gbeds")
                if g: await g.screenshot(path=f"ga_garden_{style}.png")
            # alchemy list shows coloured effects
            ok(len(errs) == 0, f"no page errors {errs[:3]}")
            await ctx.close()
        print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad))
        await b.close()
asyncio.run(main())
