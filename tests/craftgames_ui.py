import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=False)
        errs = []
        async def clean(pg):
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(pg, sel):
            for _ in range(8):
                await clean(pg)
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&craftgame&p=cg"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hammer"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.inv=S.inv.filter(r=>!/^mat_|^ore_|^ing_/.test(r.item)); G.give(S,'mat_iron',20); G.give(S,'mat_strips',10); G.give(S,'ore_iron',8); G.give(S,'pelt_wolf',2); G.give(S,'mat_gold',2); G.give(S,'gem_ruby',2); G.give(S,'ing_blue_flower',2); G.give(S,'ing_wheat',2);}")
        for _ in range(5):
            await clean(pg); await pg.wait_for_timeout(300)
        res = {}
        async def tap(kind):
            await pg.evaluate("(k)=>{const b=document.querySelector('#cgact'); if(b) b.dispatchEvent(new PointerEvent(k,{bubbles:true}))}", kind)
        async def wait_game(name):
            await pg.wait_for_selector("#craftgame", timeout=5000)
            return await pg.evaluate("CG.state()?.game")
        async def play_hammer(good=True, shot=None):
            await pg.evaluate("CG.state().speed=0.03")   # slow the marker: the test machine is too laggy to aim at full speed
            for i in range(3):
                for _ in range(400):
                    d = await pg.evaluate("(()=>{const s=CG.state(); return s? Math.abs(s.pos-s.center) - s.zone/5 : -1})()")
                    if (d <= 0) == good: break
                    await pg.wait_for_timeout(8)
                if shot and i == 1: await (await pg.query_selector(".cgcard")).screenshot(path=shot)
                if good: await pg.evaluate("(()=>{const s=CG.state(); if(s){ s.pos=s.center; s.speed=0.0; } })()")   # aim exactly (the laggy test machine can't time it), then a real tap
                await tap("pointerdown"); await tap("pointerup")
                await pg.evaluate("CG.state() && (CG.state().speed=0.03)")
                await pg.wait_for_timeout(60)
            await pg.wait_for_selector("#craftgame", state="detached", timeout=20000)
        # ---- smithing: hammer, played well → masterful/perfect and a temper bonus
        await click(pg, "[data-tab=map]"); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(300); await click(pg, "[data-id=forge]"); await pg.wait_for_timeout(300)
        await click(pg, "[data-act=smake][data-id=iron_sword]")
        res["hammer"] = await wait_game("hammer")
        await play_hammer(True, "cg_hammer_ink.png")
        res["sword_msg"] = await pg.evaluate("[...document.querySelectorAll('.toast,#toast,.msg')].map(e=>e.innerText).join('|').slice(0,200)")
        res["sword"] = await pg.evaluate("(()=>{const r=window.__dbg.save().inv.filter(r=>r.item==='iron_sword').pop(); return [r?.mw, r?.temper]})()")
        # quick craft button: plain result
        await clean(pg); await click(pg, "[data-act=smake][data-id=iron_dagger]"); await wait_game("hammer"); await pg.click("#cgquick"); await pg.wait_for_selector("#craftgame", state="detached", timeout=3000)
        res["dagger_quick"] = await pg.evaluate("(()=>{const r=window.__dbg.save().inv.filter(r=>r.item==='iron_dagger').pop(); return [r?.mw||null, r?.temper||0]})()")
        # pixel style screenshot of the hammer
        await pg.evaluate("ART.setStyle('pixel')"); await clean(pg)
        await click(pg, "[data-act=smake][data-id=iron_war_axe]"); await wait_game("hammer"); await play_hammer(False, "cg_hammer_pixel.png")
        res["axe_bad"] = await pg.evaluate("(()=>{const r=window.__dbg.save().inv.filter(r=>r.item==='iron_war_axe').pop(); return [r?.mw||null, r?.temper||0, SMITH.count(window.__dbg.save(),'iron_war_axe')]})()")
        await pg.evaluate("ART.setStyle('ink')")
        # ---- jewellery: precision ring
        await clean(pg); await click(pg, "[data-act=fgroup][data-id=jewel]"); await pg.wait_for_timeout(200)
        await click(pg, "[data-act=smake][data-id=gold_ruby_ring]"); res["ring_game"] = await wait_game("precise")
        for i in range(3):
            for _ in range(500):
                d = await pg.evaluate("(()=>{const s=CG.state(); return s? s.rr-s.R : -99})()")
                if d <= 2: break
                await pg.wait_for_timeout(6)
            if not await pg.evaluate("!!CG.state() && !CG.state().over"): break
            if i == 1: await (await pg.query_selector(".cgcard")).screenshot(path="cg_precise_ink.png")
            await tap("pointerdown"); await pg.wait_for_timeout(40)
        await pg.wait_for_selector("#craftgame", state="detached", timeout=20000)
        res["ring"] = await pg.evaluate("SMITH.count(window.__dbg.save(),'gold_ruby_ring')")
        # ---- smelting: bellows, try to keep inside the band
        await clean(pg); await click(pg, "[data-act=ftab][data-id=refine]"); await pg.wait_for_timeout(200)
        await click(pg, "[data-act=srefine][data-id='0']"); res["smelt_game"] = await wait_game("bellows")
        shot = False
        for _ in range(6000):
            s = await pg.evaluate("(()=>{const s=CG.state(); return s? [s.heat, (s.lo+s.hi)/2, s.dur, s.holding] : null})()")
            if not s: break
            want = s[0] < s[1]
            if want != s[3]: await tap("pointerdown" if want else "pointerup")
            if not shot and s[2] < 3:
                await (await pg.query_selector(".cgcard")).screenshot(path="cg_bellows_ink.png"); shot = True
            await pg.wait_for_timeout(15)
        await pg.wait_for_selector("#craftgame", state="detached", timeout=20000)
        res["smelt"] = await pg.evaluate("[SMITH.count(window.__dbg.save(),'ore_iron'), SMITH.count(window.__dbg.save(),'mat_iron')]")
        # ---- alchemy: mix colour
        await clean(pg); await click(pg, "[data-tab=town]"); await pg.wait_for_timeout(300)
        has_lab = await pg.query_selector("[data-id=alchemy]")
        if has_lab:
            await click(pg, "[data-id=alchemy]"); await pg.wait_for_timeout(300)
            await pg.evaluate("(()=>{})()")
            ids = await pg.evaluate("[...document.querySelectorAll('[data-act=alch]')].map(e=>e.dataset.id).slice(0,2)")
            for i in ids: await click(pg, f"[data-act=alch][data-id='{i}']"); await pg.wait_for_timeout(150)
            await click(pg, "[data-act=brew]"); res["mix_game"] = await wait_game("mix")
            await pg.evaluate("ART.setStyle('pixel')")
            for i in range(2):
                await pg.wait_for_timeout(450)
                await tap("pointerdown")
                for _ in range(600):
                    d = await pg.evaluate("(()=>{const s=CG.state(); return s? s.target-s.mixv : -9})()")
                    if d <= 0.005: break
                    await pg.wait_for_timeout(6)
                if i == 0: await (await pg.query_selector(".cgcard")).screenshot(path="cg_mix_pixel.png")
                await tap("pointerup")
            await pg.wait_for_selector("#craftgame", state="detached", timeout=20000)
            await pg.evaluate("ART.setStyle('ink')")
            res["potion"] = await pg.evaluate("window.__dbg.save().inv.filter(r=>String(r.item).startsWith('brew|')).map(r=>r.item)")
        else:
            res["mix_game"] = "no lab button"
        # ---- enchanting: rune trace, with a direct run of the game (Whiterun has no court wizard in town tab)
        await clean(pg)
        await pg.evaluate("window.__rg=null; CG.run('rune',{skill:30,skillName:'Enchanting',what:'Fortify Health on Iron Helmet'},(g)=>window.__rg=g)")
        await pg.wait_for_function("CG.state()?.phase==='trace'", timeout=8000)
        await (await pg.query_selector(".cgcard")).screenshot(path="cg_rune_ink.png")
        box = await (await pg.query_selector("#cgc")).bounding_box()
        pts = await pg.evaluate("CG.state().order.map(i=>CG.state().pts[i])")
        for (x, y) in pts:
            await pg.mouse.click(box["x"] + x * box["width"] / 300, box["y"] + y * box["height"] / 220); await pg.wait_for_timeout(80)
        await pg.wait_for_function("window.__rg", timeout=4000); res["rune"] = await pg.evaluate("window.__rg")
        # pixel rune shot
        await pg.evaluate("ART.setStyle('pixel'); window.__rg=null; CG.run('rune',{skill:30,skillName:'Enchanting',what:'Fire on Iron Sword'},(g)=>window.__rg=g)")
        await pg.wait_for_function("CG.state()?.phase==='trace'", timeout=8000)
        pts = await pg.evaluate("CG.state().order.map(i=>CG.state().pts[i])")
        box = await (await pg.query_selector("#cgc")).bounding_box()
        for (x, y) in pts[:3]:
            await pg.mouse.click(box["x"] + x * box["width"] / 300, box["y"] + y * box["height"] / 220); await pg.wait_for_timeout(60)
        await (await pg.query_selector(".cgcard")).screenshot(path="cg_rune_pixel.png")
        await pg.click("#cgquick"); await pg.wait_for_function("window.__rg", timeout=4000); res["rune_quick"] = await pg.evaluate("window.__rg")
        await pg.evaluate("ART.setStyle('ink')")
        # ---- "always play" checkbox is remembered in settings
        await pg.evaluate("window.__rg=null; CG.run('hammer',{skill:20},(g)=>window.__rg=g)")
        await pg.click("#cgpref"); await pg.click("#cgquick"); await pg.wait_for_function("window.__rg", timeout=5000)
        res["pref_off"] = [await pg.evaluate("window.__rg"), await pg.evaluate("JSON.parse(localStorage.getItem('rotn_prefs')||'{}').craftGame")]
        await pg.screenshot(path="cg_page.png")
        print("results:", res)
        print("errors:", errs)
        ok = (res["hammer"] == "hammer" and res["sword"][0] in ("great", "masterful", "perfect") and res["sword"][1] >= 1 and res["dagger_quick"] == [None, 0]
              and res["axe_bad"][2] in (0, 1) and res["ring"] == 1 and res["smelt"][1] >= 4 and res["rune"] in ("perfect", "masterful") and res["rune_quick"] == "good"
              and res["pref_off"] == ["good", False] and not errs)
        print("RESULT", "OK" if ok else "FAIL")
        await b.close()
asyncio.run(main())
