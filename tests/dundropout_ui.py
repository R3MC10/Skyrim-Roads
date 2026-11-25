"""Someone leaves a co-op dungeon run (dundropout.js). Three phones in one browser (?net=bc): Alfa, Beta and Cora are
inside one run of Bleak Falls Barrow. Cora closes the game: Alfa and Beta are taken out to the map and see
"Cora left the game — the run in Bleak Falls Barrow has ended." with Go back in together / Wait for Cora / OK.
Cora opens the game again: "Your run in Bleak Falls Barrow ended while you were away." with Back to the map /
Ask the group to go again. Wait for Cora shows the waiting bar, then "Cora is back!". Phone and PC screenshots.
Usage: py dundropout_ui.py PORT [OUTDIR]  ->  RESULT OK."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "/tmp"), "rotn_dundropout")
os.makedirs(OUT, exist_ok=True)
PLACE = "Bleak Falls Barrow"

async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        def url(name): return f"http://localhost:{PORT}/index.html?net=bc&notut&p=dd{name}"
        async def phone(name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(name + " " + str(e)))
            await pg.goto(url(name)); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1400)
            await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#wwall').forEach(m => m.remove())")
            await pg.evaluate(f"() => {{ const s = window.__dbg.save(); s.trip = null; s.location = '{PLACE}'; Store.save(s); window.__ui.go('map'); }}")
            return pg
        def ok(c, m):
            if not c: raise AssertionError(m)
            print("ok", m)
        async def until(pg, js, n=60, ms=150):
            for _ in range(n):
                if await pg.evaluate(js): return True
                await pg.wait_for_timeout(ms)
            return False

        A = await phone("Alfa"); B = await phone("Beta"); C = await phone("Cora")
        ids = [await pg.evaluate("window.__dbg.save().id") for pg in (A, B, C)]
        # Alfa opens the run with Beta and Cora in it, everyone steps inside
        rid = await A.evaluate("""() => { const s = window.__dbg.save(); const r = COOP.newRun(s); window.__rid = r.id;
          Store.put('runs', r.id, { ...r.doc, status: 'in', pool: { items: [{ item: 'potion_health', qty: 2 }], gold: 90 } }); return r.id; }""")
        for pg, nm in ((B, "Beta"), (C, "Cora")):
            ok(await until(pg, f"() => !!(window.__dbg.coopRuns() || []).find(r => r.id === '{rid}')"), nm + " hears about the run")
        await A.evaluate(f"""() => Store.change('runs', '{rid}', (x) => {{ let r = x; for (const [id, name] of [['{ids[1]}','Beta'],['{ids[2]}','Cora']]) r = COOP.addMember(r, {{ id, name, level: 1 }}); return r; }})""")
        for pg in (A, B, C):
            ok(await until(pg, f"() => {{ const r = (window.__dbg.coopRuns() || []).find(r => r.id === '{rid}'); if (!r || r.members.length < 3) return false; const s = window.__dbg.save(); if (!s.dungeon) COOP.join(s, {{ ...r, id: '{rid}' }}); Store.save(s); return s.dungeon?.run === '{rid}'; }}"), "inside the run")
        ok(await until(A, f"() => {{ let n = 0; Store.watch('rbeat', (d) => n = d.filter(x => x.run === '{rid}').length); return n === 3; }}", 80), "all three phones beat")
        await A.screenshot(path=os.path.join(OUT, "dundropout_before_phone.png"))
        # Cora closes the game
        await C.close()
        for pg, nm in ((A, "Alfa"), (B, "Beta")):
            ok(await until(pg, "() => !!document.querySelector('#ddnote .ddrop.left')", 240, 150), nm + " sees the notice")
            txt = await pg.locator("#ddnote").inner_text()
            ok("Cora left the game — the run in Bleak Falls Barrow has ended." in txt, "notice text: " + txt.replace("\n", " ")[:160])
            for lab in ("Go back in together", "Wait for Cora", "OK"):
                ok(await pg.locator("#ddnote button", has_text=lab).count() == 1, "button " + lab)
            ok(await pg.evaluate("() => !window.__dbg.save().dungeon && window.__dbg.save().location === 'Bleak Falls Barrow'"), nm + " is at the entrance, out of the dungeon")
        await A.screenshot(path=os.path.join(OUT, "dundropout_left_phone.png"))
        # Alfa waits for Cora
        await A.click("#ddnote button:has-text('Wait for Cora')")
        ok(await until(A, "() => /Waiting for Cora to come back/.test(document.querySelector('#ddwait')?.innerText || '')"), "the waiting bar")
        await A.screenshot(path=os.path.join(OUT, "dundropout_wait_phone.png"))
        # Beta: OK closes it
        await B.click("#ddnote button:has-text('OK')")
        ok(await B.locator("#ddnote").count() == 0, "OK closes the notice")
        # Cora comes back
        C = await ctx.new_page(); C.on("pageerror", lambda e: errs.append("Cora2 " + str(e)))
        await C.goto(url("Cora")); await C.wait_for_timeout(1800)
        if await C.locator(".press").count(): await C.click(".press")
        if await C.locator(".mi[data-t=continue]").count(): await C.click(".mi[data-t=continue]")
        ok(await until(C, "() => !!document.querySelector('#ddnote .ddrop.away')", 200), "Cora sees what happened while she was away")
        txt = await C.locator("#ddnote").inner_text()
        ok("Your run in Bleak Falls Barrow ended while you were away." in txt, "away text: " + txt.replace("\n", " ")[:160])
        for lab in ("Back to the map", "Ask the group to go again"):
            ok(await C.locator("#ddnote button", has_text=lab).count() == 1, "button " + lab)
        ok(await C.evaluate("() => !window.__dbg.save().dungeon"), "Cora's save is out of the dead run")
        await C.screenshot(path=os.path.join(OUT, "dundropout_away_phone.png"))
        await C.click("#ddnote button:has-text('Back to the map')")
        ok(await until(A, "() => /Cora is back!/.test(document.querySelector('#ddwait')?.innerText || '')", 200), "Alfa's bar: Cora is back")
        await A.screenshot(path=os.path.join(OUT, "dundropout_back_phone.png"))
        await A.click("#ddwait button:has-text('Go back in together')")
        ok(await until(A, f"() => (window.__dbg.coopRuns() || []).some(r => r.again === '{rid}')"), "a new run with the old group")
        # PC: both notices again on a big screen
        show = f"""(me) => {{ const r = (window.__dbg.coopRuns() || []).find(r => r.id === '{rid}'); DUNDROP.ui.show(r, DUNDROP.noticeFor(r, me)); return !!document.querySelector('#ddnote'); }}"""
        for pg, who, tag in ((A, ids[0], "left"), (C, ids[2], "away")):
            await pg.set_viewport_size({"width": 1920, "height": 1080}); await pg.wait_for_timeout(400)
            await pg.evaluate("() => document.querySelectorAll('.toast').forEach(t => t.remove())")
            ok(await pg.evaluate(show, who), "PC notice " + tag)
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, f"dundropout_{tag}_pc.png"))
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        print("RESULT OK")
        await b.close()

asyncio.run(main())
