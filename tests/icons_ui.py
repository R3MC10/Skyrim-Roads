import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8775"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ic"); await pg.wait_for_timeout(1500)
        # gallery of every item icon and enemy portrait
        for st in ["ink"]:
            u = await pg.evaluate("""async (st)=>{ const ids=Object.keys(D.ITEMS).concat(["ench|iron_helmet|health|20|0","ench|steel_sword|fire|20|800","brew|Restore Health:23:0","brew|Damage Health:10:0"]);
              const en=[...new Set([...D.ENCOUNTERS, ...Object.values(DUNGEONS.ENEMY)].map(e=>e.name+"|"+(e.tags||[]).join(",")))];
              const all=ids.map(id=>ICONART.item(id,40,{tq:/sword|armor/.test(id)?2:0})).concat(en.map(x=>{const [n,t]=x.split("|"); return ICONART.enemy(n,t?t.split(","):[],40);}));
              const S2=44, cols=16, rows=Math.ceil(all.length/cols); const c=document.createElement("canvas"); c.width=cols*S2; c.height=rows*S2; const g=c.getContext("2d"); g.fillStyle="#1c1a17"; g.fillRect(0,0,c.width,c.height);
              const imgs=ids.map(id=>ICONART.item(id,40,{tq:/sword|armor/.test(id)?2:0})).concat(en.map(x=>{const [n,t]=x.split("|"); return ICONART.enemy(n,t?t.split(","):[],40);}));
              await Promise.all(imgs.map((h,i)=>new Promise(res=>{ const m=/src="([^"]+)"/.exec(h); if(!m) return res(); const im=new Image(); im.onload=()=>{ g.drawImage(im,(i%cols)*S2+2,Math.floor(i/cols)*S2+2,40,40); res(); }; im.onerror=res; im.src=m[1]; })));
              return c.toDataURL(); }""", st)
            open(f"icons_gallery_{st}.png", "wb").write(base64.b64decode(u.split(",")[1]))
        # a character with a big pack
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hoarder"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=99999; const ids=Object.keys(D.ITEMS).filter(i=>!/^dish_|^fish_/.test(i)).slice(0,118); for (const i of ids) G.give(S,i,1); const r=S.inv.find(x=>D.ITEMS[x.item].slot==='weapon'); if(r) r.tq=3; }")
        await pg.wait_for_timeout(400)
        for _ in range(4): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(250)
        n = await pg.evaluate("window.__dbg.save().inv.length"); print("pack rows:", n)
        t = await pg.evaluate("""()=>{ const t0=performance.now(); document.querySelector('[data-tab=pack]').click(); return performance.now()-t0; }""")
        await pg.wait_for_timeout(400)
        t2 = await pg.evaluate("""()=>{ document.querySelector('#sky')?.remove(); const t0=performance.now(); document.querySelector('[data-tab=pack]').click(); return performance.now()-t0; }""")
        print(f"sky menu with {n} items: first open {t:.0f} ms (draws icons), again {t2:.0f} ms (cached)")
        await pg.screenshot(path="icons_menu.png")
        sel = await pg.query_selector(".sky-row"); 
        if sel: await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await sel.click(); await pg.wait_for_timeout(300); await pg.screenshot(path="icons_detail.png")
        await pg.evaluate("document.querySelector('#sky')?.remove()")
        async def jsclick(sel):
            await pg.evaluate("document.querySelectorAll('#modal,#sky').forEach(m=>m.remove())")
            ok = await pg.evaluate("(s)=>{const e=document.querySelector(s); if(!e) return false; e.click(); return true;}", sel)
            if not ok: print("missing", sel)
        async def town(sec):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await jsclick("[data-tab=town]"); await pg.wait_for_timeout(250)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await jsclick(f"[data-id={sec}]"); await pg.wait_for_timeout(300)
        await town("blacksmith"); el = await pg.query_selector("#side"); await el.screenshot(path="icons_shop.png")
        await jsclick("[data-act=smode][data-id=sell]"); await pg.wait_for_timeout(300); el = await pg.query_selector("#side"); await el.screenshot(path="icons_sell.png")
        await town("forge"); el = await pg.query_selector("#side"); await el.screenshot(path="icons_forge.png")
        await jsclick("[data-act=fgroup][data-id=jewel]"); await pg.wait_for_timeout(300); el = await pg.query_selector("#side"); await el.screenshot(path="icons_forge_jewel.png")
        # tactics test fight portrait
        await jsclick("[data-tab=hero]"); await pg.wait_for_timeout(250); await jsclick("[data-act=tabgo][data-id=tactics]"); await pg.wait_for_timeout(300)
        if await pg.query_selector("#te"):
            await pg.evaluate("document.querySelector('#te').value='Frost troll'")
            await jsclick("[data-act=test]"); await pg.wait_for_timeout(400)
            print("test fight portrait:", await pg.evaluate("!!document.querySelector('#side img.eico')"))
        print("icons in shop:", await pg.evaluate("document.querySelectorAll('img.art.ico').length"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
