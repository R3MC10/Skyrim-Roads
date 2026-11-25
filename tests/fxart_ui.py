import asyncio, sys, base64, time
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = _SHOTS + "vfest/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fx"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fenna"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        async def save_url(u, name):
            open(OUT + name, "wb").write(base64.b64decode(u.split(",")[1]))
        for style in ["ink"]:
            # 1. festivals on a town picture and the inn banner
            for fid in ["newlife", "midyear", "witching", "frostfall"]:
                urls = await pg.evaluate("""(f)=>{ FXART.force(f); const pick=(h)=>(h.match(/src="([^"]+)"/)||[])[1]; return [pick(PLACEART.scene('Whiterun')), pick(PLACEART.scene('Riverwood')), pick(PLACEART.section('inn'))]; }""", fid)
                for i, u in enumerate(urls):
                    if u: await save_url(u, f"fest_{style}_{fid}_{i}.png")
            await pg.evaluate("FXART.force(null)")
        # in the game: Town tab of Whiterun during New Life
        await pg.evaluate("()=>{ FXART.force('newlife'); const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; }")
        await pg.evaluate(clear); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
        await pg.evaluate(clear)
        el = await pg.query_selector("#side"); await el.screenshot(path=OUT + "ui_town_newlife.png")
        await pg.click("[data-act=shop][data-id=inn]") if await pg.query_selector("[data-act=shop][data-id=inn]") else None
        await pg.wait_for_timeout(300); el = await pg.query_selector("#side"); await el.screenshot(path=OUT + "ui_inn_newlife.png")
        await pg.evaluate("FXART.force(null)")
        # 2. map effects: cast utility spells for real, then the one-off ones
        for style in ["ink"]:
            r = await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null;
                for (const id of ['candlelight','detect_life','muffle','mark','clairvoyance','transmute']) if (!S.spells.includes(id)) S.spells.push(id);
                for (const k of Object.keys(S.skills)) S.skills[k].lvl=100; S.castAt={};
                const out=[]; for (const id of ['candlelight','detect_life','muffle','mark']) { S.castAt={}; out.push(MAGIC.castOut(S,id)); }
                S.rested=G.now()+999; S.restBonus=0.1;
                return out.map(x=>x.slice(0,40)); }""")
            print(style, "cast:", r)
            await pg.evaluate(clear); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(200)
            await pg.evaluate("()=>{ FXART.cast('clairvoyance',{to:WORLD.places.Riverwood.slice(0,2)}); FXART.cast('transmute'); }")
            await pg.wait_for_timeout(700); await pg.evaluate(clear)
            el = await pg.query_selector("#mapwrap"); await el.screenshot(path=OUT + f"map_fx_{style}.png")
            # recall: move away, recall back
            await pg.evaluate("()=>{ const S=window.__dbg.save(); const from=WORLD.places.Riverwood.slice(0,2); [S.x,S.y]=from; S.location='Riverwood'; S.castAt={}; if(!S.spells.includes('recall')) S.spells.push('recall'); const m=MAGIC.castOut(S,'recall'); FXART.cast('recall',{from,to:[S.x,S.y]}); return m; }")
            await pg.wait_for_timeout(450); await pg.evaluate(clear)
            el = await pg.query_selector("#mapwrap"); await el.screenshot(path=OUT + f"map_recall_{style}.png")
        # real UI path: cast from the Magic menu (castout action) and a road shout hook
        # vampire at night eyes + werewolf paws: just state check
        st = await pg.evaluate("()=>{ const S=window.__dbg.save(); S.vampire={stage:2}; S.werewolf=true; const s=FXART.state(S); return s?Object.keys(s).filter(k=>s[k]&&k!=='shots'):null; }")
        print("state keys:", st)
        # 3. travel vignette
        for style in ["ink"]:
            await pg.evaluate("()=>{ const S=window.__dbg.save(); S.vampire=null; S.werewolf=false; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; const e=G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); return e; }")
            await pg.evaluate(clear); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(1500); await pg.evaluate(clear)
            has = await pg.evaluate("!!document.querySelector('#fpt .fpt-view canvas')")
            el = await pg.query_selector("#fpt")
            if el: await el.screenshot(path=OUT + f"trip_{style}_a.png")
            await pg.wait_for_timeout(1200)
            if el: await el.screenshot(path=OUT + f"trip_{style}_b.png")
            off = await pg.evaluate("document.querySelector('#fpt .fpt-view canvas') ? 1 : 0")
            print(style, "vignette mounted:", has, off)
        # riding
        await pg.evaluate("()=>{ const S=window.__dbg.save(); HORSES.buy?.(S,'Bess','bay'); S.gold=9999; }")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
