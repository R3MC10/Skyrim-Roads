"""Friends: what they're doing + Ask to join (friendjoin.js). Three phones in one browser (?net=bc): Beta's Friends list shows
Alfa (alone) and Cora (leads a full party); Cora's Ask to join is off; Beta asks Alfa, Alfa gets a join card, Accept puts
Beta in Alfa's party. Phone and PC screenshots. Usage: py friendjoin_ui.py PORT [OUTDIR]  ->  RESULT OK."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "/tmp"), "rotn_friendjoin")
os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + name + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}{name}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1400)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
            return pg
        def ok(c, m):
            if not c: raise AssertionError(m)
            print("ok", m)
        async def until(pg, js, n=60):
            for _ in range(n):
                if await pg.evaluate(js): return True
                await pg.wait_for_timeout(150)
            return False

        A = await phone("f", "Alfa"); B = await phone("f", "Beta"); C = await phone("f", "Cora")
        ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id"); idc = await C.evaluate("window.__dbg.save().id")
        # Cora leads a full party (7 others who aren't online)
        await C.evaluate(f"() => Store.put('parties', 'fullp', {{ leader: '{idc}', leaderName: 'Cora', members: [{{ id: '{idc}', name: 'Cora' }}, ...Array.from({{length: 7}}, (_, i) => ({{ id: 'zz' + i, name: 'Z' + i }}))], invites: [], t: G.now() }})")
        await C.wait_for_timeout(500); await C.evaluate("() => window.__ui.go('map')")
        for pg in (A, C): await pg.evaluate("() => { const s = window.__dbg.save(); s.level = s.level || 1; }")
        await A.evaluate("() => window.__ui.go('map')")
        # Beta's friends
        await B.evaluate(f"() => {{ const s = window.__dbg.save(); s.friends = {{ '{ida}': {{ name: 'Alfa', t: G.now() }}, '{idc}': {{ name: 'Cora', t: G.now() }} }}; }}")
        ok(await until(B, f"() => !!FRIENDJOIN && Store.watch && true"), "module loaded")
        # everyone republishes their card so it carries fj
        for pg in (A, B, C): await pg.evaluate("() => { const s = window.__dbg.save(); s.level += 0; }")
        ok(await until(B, f"() => {{ let c=null; Store.watchPlayers(ps => c = ps.find(x => x.id === '{idc}')); return !!(c && c.fj && c.fj.pn === 8); }}"), "Cora's card says her party is 8/8")
        ok(await until(B, f"() => {{ let c=null; Store.watchPlayers(ps => c = ps.find(x => x.id === '{ida}')); return !!(c && c.fj); }}"), "Alfa's card carries what he's doing")
        await B.evaluate("() => { window.__ui.go('social'); }"); await B.wait_for_timeout(300)
        await B.click("[data-act=soctab][data-id=friends]"); await B.wait_for_timeout(500)
        rows = await B.locator(".fj-t").all_inner_texts()
        print(rows)
        ok(len(rows) == 2, f"two online friends with presence: {rows}")
        cora = [r for r in rows if "Cora" in r][0]; alfa = [r for r in rows if "Alfa" in r][0]
        ok("Leads a party · 8/8" in cora and "full" in cora, "Cora's row: party 8/8 full")
        ok("Level" in alfa and "On their own" in alfa, "Alfa's row: level, place, on his own")
        ok(await B.locator(f"[data-act=fjoin][data-id='{idc}']").is_disabled(), "Ask to join is off for a full party")
        ok(not await B.locator(f"[data-act=fjoin][data-id='{ida}']").is_disabled(), "Ask to join is on for Alfa")
        await B.screenshot(path=os.path.join(OUT, "friendjoin_phone.png"))
        # ask -> Alfa's card -> Accept -> Beta joins
        await B.click(f"[data-act=fjoin][data-id='{ida}']"); await B.wait_for_timeout(300)
        ok(await B.locator(f"[data-act=fjoin][data-id='{ida}']").is_disabled(), "button waits after asking")
        ok(await until(A, "() => document.querySelectorAll('#invbar .invcard[data-kind=join]').length === 1"), "Alfa gets an Ask to join card")
        txt = await A.locator("#invbar .invcard[data-kind=join]").inner_text()
        ok("Beta asks to join your party" in txt, "card text: " + txt)
        await A.screenshot(path=os.path.join(OUT, "friendjoin_card_phone.png"))
        await A.click("#invbar .invcard[data-kind=join] [data-inv=yes]")
        ok(await until(B, f"() => window.__dbg.party()?.leader === '{ida}'", 80), "Beta joined Alfa's party")
        ok(await until(A, "() => document.querySelectorAll('#invbar .invcard[data-kind=join]').length === 0"), "Alfa's card is gone")
        await B.evaluate("() => { window.__ui.go('social'); }"); await B.wait_for_timeout(300)
        await B.click("[data-act=soctab][data-id=friends]"); await B.wait_for_timeout(1200)
        ok(await B.locator(f"[data-act=fjoin][data-id='{ida}']").count() == 0, "no Ask to join for someone already in your party")
        # PC
        await B.set_viewport_size({"width": 1366, "height": 800}); await B.wait_for_timeout(600)
        await B.evaluate("() => { window.__ui.go('social'); }"); await B.wait_for_timeout(300)
        await B.click("[data-act=soctab][data-id=friends]"); await B.wait_for_timeout(600)
        await B.screenshot(path=os.path.join(OUT, "friendjoin_pc.png"))
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        print("RESULT OK")
        await b.close()

asyncio.run(main())
