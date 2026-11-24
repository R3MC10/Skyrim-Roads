"""Visual pass: asset pipeline (painted pictures replace drawn art, missing files fall back), colour coding.
Usage: python3 vis_ui.py PORT"""
import asyncio, sys, io
from PIL import Image
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL") + " " + m)
    if not c: fails.append(m)

def png(w, h, col, alpha=False):
    im = Image.new("RGBA" if alpha else "RGB", (w, h), col)
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            # --- 1. no picture files: everything falls back to drawn art
            ctx = await b.new_context(viewport={"width": 412, "height": 915})
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&assets&p=vis0{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ves"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            await pg.evaluate("()=>{const S=__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; window.__ui.go('town')}"); await pg.wait_for_timeout(1500)
            st = await pg.evaluate("()=>Object.fromEntries(ASSETS.status())")
            ok(st.get("place-whiterun") == "none" and st.get("ui-panel") == "none", f"[{style}] missing files are noted as missing: {st}")
            ok(await pg.evaluate("()=>!!PLACEART.scene('Whiterun')"), f"[{style}] Whiterun still drawn without a picture")
            ok(await pg.evaluate("()=>!document.documentElement.classList.contains('has-ui-panel')"), f"[{style}] no texture class without the file")
            await ctx.close()

            # --- 2. pictures present: they are used
            ctx = await b.new_context(viewport={"width": 412, "height": 915})
            files = {"place-whiterun.webp": png(160, 90, (200, 30, 160)), "foe-troll.png": png(64, 64, (0, 200, 0), True),
                     "ui-panel.webp": png(64, 64, (40, 60, 90)), "title.webp": png(108, 192, (10, 120, 200)), "biome-cave.webp": png(160, 90, (10, 10, 200))}
            async def handle(route):
                name = route.request.url.split("/")[-1].split("?")[0]
                if name in files: await route.fulfill(status=200, body=files[name], content_type="image/png")
                else: await route.continue_()
            await ctx.route("**/*", handle)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&assets&p=vis1{style}"); await pg.wait_for_timeout(1200)
            await pg.evaluate("()=>{ASSETS.img('title')}"); await pg.wait_for_timeout(800)
            # the title canvas shows the key art (blue-ish centre pixel)
            px = await pg.evaluate("()=>{const c=document.querySelector('#tfog')?.previousElementSibling?.tagName==='CANVAS'?document.querySelector('#tfog').previousElementSibling:document.querySelector('#title canvas'); if(!c) return null; const g=c.getContext('2d'); const d=g.getImageData(c.width/2|0,c.height/3|0,1,1).data; return [d[0],d[1],d[2]]}")
            ok(px is not None and px[2] > 120 and px[0] < 90, f"[{style}] title shows the painted key art {px}")
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ves"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            await pg.evaluate("()=>{const S=__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; ASSETS.img('place-whiterun'); ASSETS.img(ASSETS.foeKey('Frost Troll','troll')); ASSETS.img('foe-troll');}")
            await pg.wait_for_timeout(1200)
            st = await pg.evaluate("()=>Object.fromEntries(ASSETS.status())")
            ok(st.get("place-whiterun") == "ok", f"[{style}] place picture loaded")
            ok(await pg.evaluate("()=>document.documentElement.classList.contains('has-ui-panel')"), f"[{style}] panel texture reaches the CSS")
            # the Whiterun scene now comes from the picture: magenta pixels in the middle
            col = await pg.evaluate("""async()=>{ const h=PLACEART.scene('Whiterun'); const d=document.createElement('div'); d.innerHTML=h; const im=d.querySelector('img'); await new Promise(r=>{ if(im.complete) r(); else im.onload=r; });
              const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const g=c.getContext('2d'); g.drawImage(im,0,0);
              const p=g.getImageData(c.width*0.3|0,c.height*0.3|0,c.width*0.4|0,c.height*0.2|0).data; const seen=new Set(); for(let i=0;i<p.length;i+=4) seen.add(p[i]>>3<<10|p[i+1]>>3<<5|p[i+2]>>3); const m=g.getImageData(c.width/2|0,c.height*0.35|0,1,1).data; return [seen.size,m[0],m[1],m[2]]; }""")
            ok(col[0] < 40, f"[{style}] Whiterun scene uses the painted backdrop (flat test picture: {col[0]} colours, centre {col[1:]})")
            ok(await pg.evaluate("()=>ASSETS.biomeKey('Bleak Falls Barrow')") == "biome-nordruin", f"[{style}] barrows map to the Nordic ruin backdrop")
            ok(await pg.evaluate("()=>ASSETS.foeKey('Draugr Wight','draugr')") == "foe-draugr" and await pg.evaluate("()=>ASSETS.foeKey('Frost Troll','troll')") == "foe-frosttroll", f"[{style}] foe names map to picture slugs")
            # fight scene with the troll picture: green pixels appear on the foe's side
            await pg.evaluate("""()=>{ const S=__dbg.save(); const troll={...D.ENCOUNTERS.find(e=>/troll/i.test(e.name)), name:'Troll'}; const f=new G.Fight(S, G.scaleEnemy(troll, 10)); f.hp=9999; f.run({trySneak:false});
              const b=document.createElement('div'); b.id='vbox'; b.style.cssText='position:fixed;left:0;top:0;width:412px;z-index:9999;background:#111'; document.body.appendChild(b);
              const d=document.createElement('div'); d.style.width='404px'; d.innerHTML=FIGHTART.placeholder(f, S); b.appendChild(d); FIGHTART.manual(true); }""")
            await pg.wait_for_timeout(300); await pg.evaluate("FIGHTART.advance(400)"); await pg.wait_for_timeout(100)
            green = await pg.evaluate("""()=>{ const c=document.querySelector('#vbox canvas'); if(!c) return -1; const g=c.getContext('2d'); const d=g.getImageData(c.width*0.5|0,0,c.width*0.5|0,c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i+1]>150&&d[i]<60&&d[i+2]<60) n++; return n; }""")
            ok(green > 200, f"[{style}] painted foe drawn in the fight ({green} px)")
            await pg.evaluate("FIGHTART.manual(false); document.getElementById('vbox')?.remove()")
            # colour coding
            t = await pg.evaluate("()=>[CC.tier('elven_bow'), CC.tier('steel_sword'), CC.tier('iron_sword'), CC.tier('azuras_star'), CC.school('spell:firebolt'), CC.element('spell:frostbite'), CC.skillCat('Sneak')]")
            ok(t == ["superior", "fine", "common", "unique", "destruction", "frost", "thief"], f"[{style}] colour rules {t}")
            await pg.evaluate("()=>{ const S=__dbg.save(); G.give(S,'elven_bow',1); window.__ui.openMenu('items'); }"); await pg.wait_for_timeout(300)
            await pg.evaluate("()=>document.querySelector('#sky [data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("()=>!!document.querySelector('#sky .nm.q-superior')"), f"[{style}] Elven Bow listed in superior blue")
            await pg.evaluate("()=>document.querySelector('#sky [data-act=uxhelp]')?.click()"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("()=>!!document.querySelector('#sky .cclegend')"), f"[{style}] colour key in the ⓘ help")
            await pg.screenshot(path=f"/home/claude/tests/vis_{style}.png")
            await ctx.close()
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
asyncio.run(main())
