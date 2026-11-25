import asyncio, sys, base64
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8774"
OUT = _SHOTS + "vplace/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=pa"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Painter"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # every drawer runs for every place, section and room, day/night/weather
        res = await pg.evaluate("""()=>{ const bad=[]; let n=0, maxLen=0;
          for (const st of ['ink']) for (const name of Object.keys(WORLD.places)) for (const [m,w] of [['day','clear'],['night','snow']]) { try { const h=PLACEART.scene(name,{style:st,mood:m,weather:w}); n++; maxLen=Math.max(maxLen,h.length); if(!h.includes('data:image/png')) bad.push(name+'|'+st); } catch(e){ bad.push(name+'|'+st+'|'+e.message) } }
          for (const st of ['ink']) { for (const k of Object.keys(PLACEART.SECTION)) { try { if(!PLACEART.section(k,{style:st}).includes('data:')) bad.push('sec:'+k) } catch(e){ bad.push('sec:'+k+e.message) } } for (const k of Object.keys(PLACEART.ROOM)) { try { if(!PLACEART.room(k,{style:st}).includes('data:')) bad.push('room:'+k) } catch(e){ bad.push('room:'+k+e.message) } } }
          return {n, bad, maxLen}; }""")
        print("drawn:", res["n"], "bad:", res["bad"][:10], "biggest img chars:", res["maxLen"])
        # save a gallery of key scenes as PNGs
        names = ["Whiterun","Solitude","Windhelm","Riften","Markarth","Riverwood","Dawnstar","Morthal","Falkreath","Rorikstead","Bleak Falls Barrow","Embershard Mine","Mzinchaleft","Hag Rock Redoubt","Movarth's Lair","Fort Greymoor","Thalmor Embassy","Bonestrewn Crest","Ironback Hideout","High Hrothgar","Guardian Stones","Honningbrew Meadery","Pelagia Farm","Lakeview Manor"]
        for st in ["ink"]:
            for nm in names:
                u = await pg.evaluate(r"""([n,s])=>{ if(!WORLD.places[n]) return ''; const h=PLACEART.scene(n,{style:s}); const m=h.match(/src="([^"]+)"/); return m?m[1]:''; }""", [nm, st])
                if u: open(OUT + f"{st}_{nm.replace(' ','_').replace(chr(39),'')}.png","wb").write(base64.b64decode(u.split(",")[1]))
            for k in ["inn","forge","general","wizard","alchemy","market","arena","hall","stables","home","fence"]:
                u = await pg.evaluate(r"""([k,s])=>{ const h=PLACEART.section(k,{style:s}); return h.match(/src="([^"]+)"/)[1]; }""", [k, st])
                open(OUT + f"{st}_sec_{k}.png","wb").write(base64.b64decode(u.split(",")[1]))
            for k in ["fight","trap","treasure","puzzle","rest","boss","mystery","elite"]:
                u = await pg.evaluate(r"""([k,s])=>{ const h=PLACEART.room(k,{style:s}); return h.match(/src="([^"]+)"/)[1]; }""", [k, st])
                open(OUT + f"{st}_room_{k}.png","wb").write(base64.b64decode(u.split(",")[1]))
        # in the real UI: town tab in Whiterun, a section, travel tab, a dungeon room
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;}")
        await clear(); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400); await clear()
        n = await pg.evaluate("document.querySelectorAll('#side img.art.scene').length"); print("town tab scenes:", n)
        await pg.click("[data-act=shop][data-id=forge]"); await pg.wait_for_timeout(300); await clear()
        print("forge section banner:", await pg.evaluate("!!document.querySelector('#side img.art.sec')"))
        el = await pg.query_selector("#side"); await el.screenshot(path=OUT + "ui_town.png")
        await clear(); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
        print("travel tab scene:", await pg.evaluate("!!document.querySelector('#side img.art.scene')"))
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Bleak Falls Barrow'; [S.x,S.y]=WORLD.places['Bleak Falls Barrow']; S.cleared={};}")
        await clear(); await pg.click("[data-tab=town]"); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300); await clear()
        await pg.click("[data-act=enter]"); await pg.wait_for_timeout(500); await clear()
        print("dungeon entrance scene:", await pg.evaluate("!!document.querySelector('#dun img.art.scene')"))
        await pg.click("#dun [data-act=droom]"); await pg.wait_for_timeout(500); await clear()
        print("room picture:", await pg.evaluate("!!document.querySelector('#dun img.art.sec')"))
        el = await pg.query_selector("#dun"); await el.screenshot(path=OUT + "ui_dungeon.png")
        # timing: how long does a Travel panel render take with the picture?
        t = await pg.evaluate("()=>{ const S=window.__dbg.save(); S.dungeon=null; document.querySelector('#dun')?.remove(); S.location='Whiterun'; const t0=performance.now(); for(let i=0;i<20;i++){ document.querySelector('[data-tab=map]').click(); } return (performance.now()-t0)/20; }")
        print("avg panel render ms:", round(t, 1))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
