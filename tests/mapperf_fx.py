import asyncio, sys, json
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8779"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=perf"+ (("&off="+sys.argv[2]) if len(sys.argv)>2 else "")); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Perf"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n);
          const off=(new URLSearchParams(location.search)).get('off'); if(off==='amb') MAPART.ambient=()=>0; if(off==='night') MAPART.night=()=>{}; if(off==='tok') MAPART.token=()=>{}; if(off==='mk') { const m=MAPART.marker; MAPART.marker=(n,k)=>({c:m('Whiterun','city').c,w:2,h:2}); }
          if (off==='vig' && typeof FXART!=='undefined') FXART.vignette=()=>{}; if (off==='fx' && typeof FXART!=='undefined') { const now=G.now(); S.fx=[{name:'Candlelight',key:'trapdodge',mag:15,until:now+9999},{name:'Detect Life',key:'hide',mag:15,until:now+9999},{name:'Muffle',key:'hide',mag:10,until:now+9999}]; S.mark={x:S.x,y:S.y,place:null,label:'here'}; S.rested=now+9999; S.restBonus=0.1; FXART.cast('clairvoyance',{to:WORLD.places.Riften.slice(0,2)}); }
          window.__mt=[]; const o=WorldMap.draw; WorldMap.draw=(c,v)=>{ const t=performance.now(); o(c,v); window.__mt.push(performance.now()-t); }; }""")
        res = {}
        for label, clicks in [("far", 0), ("zoom", 1)]:
            for _ in range(clicks): await pg.click("#zoomBtn"); await pg.wait_for_timeout(300)
            # start a trip so the map keeps redrawing
            await pg.evaluate("()=>{ const S=window.__dbg.save(); window.__mt=[]; }")
            await pg.evaluate("()=>{ document.querySelector('[data-act=go]')?.click(); }")
            await pg.wait_for_timeout(4000)
            mt = await pg.evaluate("window.__mt.slice(3)")
            mt.sort(); n=len(mt)
            res[label] = {"frames": n, "median": round(mt[n//2],2) if n else None, "p90": round(mt[int(n*0.9)],2) if n else None}
        print(json.dumps(res)); print("errors:", errs)
        await b.close()
asyncio.run(main())
