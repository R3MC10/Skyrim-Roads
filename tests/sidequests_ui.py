"""NPC tasks in the Journal (npctasks.js) on a phone (412x915) and a PC (1280x800):
take notice-board jobs, a rumour and a legendary hunt -> the "Quest added" card with Track shows, the Journal lists
them with giver, progress and buttons, Track drives the compass bar and the What to do next card, Abandon needs two
taps, a finished job lands in Completed.   python3 sidequests_ui.py PORT   (node serve.js PORT first)"""
import asyncio, sys, os, tempfile
from playwright.async_api import async_playwright
SHOTS = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
os.makedirs(SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL") + " " + m)
    if not c: fails.append(m)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        for tag, vp in [("phone", {"width": 412, "height": 915}), ("pc", {"width": 1280, "height": 800})]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == "phone" else 1)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=sq{tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tasha"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=15; S.gold=3000; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; QUESTS.ensure(S); NPCTASKS.poll(S);}""")
            async def closeall():
                for _ in range(6):
                    if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(150)
                await pg.evaluate("()=>{document.querySelectorAll('.toast,.pbanner,#banner,#modal').forEach(e=>e.remove())}")   # the game's closeModal also just removes #modal
            async def go(t):
                await closeall(); await pg.evaluate(f"()=>window.__ui.go('{t}')"); await pg.wait_for_timeout(400)
            # take three jobs, a rumour and a hunt the way the town screens do
            took = await pg.evaluate("""()=>{const S=window.__dbg.save(); const out=[];
              for (const j of TOWNS.jobsAt(S,'Whiterun')) { TOWNS.takeJob(S,j.id); out.push('job:'+j.id); }
              const r=RUMOURS.hear(S,'street',G.now(),()=>0.3); if (r && r.lead) out.push('lead:'+r.lead.id);
              const c=LEGHUNT.L.find(x=>x.lvl<=S.level&&x.town==='Whiterun')||LEGHUNT.L.find(x=>x.lvl<=S.level); if (c) { const tw=S.location; S.location=c.town; LEGHUNT.accept(S,c.id); S.location=tw; out.push('hunt:'+c.id); }
              return out;}""")
            ok(len(took) >= 4, f"[{tag}] took {len(took)} tasks")
            await pg.wait_for_timeout(2600)   # the ui tick polls every 2 s
            card = await pg.evaluate("document.querySelector('#tkadd.show')?.innerText || ''")
            ok("quest added" in card.lower() and "track" in card.lower(), f"[{tag}] 'Quest added' card with Track: {card[:60]!r}")
            await pg.screenshot(path=f"{SHOTS}sidequests_added_{tag}.png")
            # Track straight from the card
            await closeall(); await pg.click("#tkadd [data-tk=track]"); await pg.wait_for_timeout(300)
            tq = await pg.evaluate("window.__dbg.save().trackQ || ''")
            ok(tq.startswith("task:"), f"[{tag}] Track on the card tracks the task ({tq})")
            await go("log")
            t = (await pg.evaluate("document.querySelector('#side').innerText")).lower()
            ok("jobs from the notice boards" in t, f"[{tag}] Journal lists notice-board jobs")
            ok("rumours to check" in t or not any(k.startswith('lead:') for k in took), f"[{tag}] Journal lists rumours")
            ok("hunt:" in t, f"[{tag}] Journal lists the hunt")
            ok(await pg.query_selector("#side .tkcard [data-act=tasktrack]") is not None and await pg.query_selector("#side .tkcard [data-act=taskdrop]") is not None, f"[{tag}] Track and Abandon buttons")
            ok(await pg.query_selector("#side .tkcard .tkprog") is not None, f"[{tag}] progress shown (gather / clues)")
            await pg.screenshot(path=f"{SHOTS}sidequests_journal_{tag}.png", full_page=True)
            # tap sizes on phone
            if tag == "phone":
                small = await pg.evaluate("[...document.querySelectorAll('#side .tkcard .qbtns .btn')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>r.height<40).length")
                ok(small == 0, f"[{tag}] task buttons are thumb-sized ({small} small)")
            # track a hunt from the Journal: the compass task and What to do next follow it
            hk = next((k for k in took if k.startswith("hunt:")), None)
            if hk:
                if (await pg.evaluate("window.__dbg.save().trackQ || ''")) != "task:" + hk:   # the Quest added card may already have tracked it (Track toggles)
                    await closeall(); await pg.click(f"[data-act=tasktrack][data-id='{hk}']"); await pg.wait_for_timeout(300)
                await closeall()
                ok((await pg.evaluate("window.__dbg.save().trackQ || ''")) == "task:" + hk, f"[{tag}] the hunt is tracked")
                task = await pg.evaluate("TABMENU.task ? JSON.stringify(TABMENU.task(window.__dbg.save())) : ''")
                ok("hunt" in task.lower(), f"[{tag}] compass bar shows the tracked task: {task[:80]}")
                await go("map")
                nx = await pg.evaluate("document.querySelector('.nextcard')?.innerText || ''")
                ok("hunt" in nx.lower(), f"[{tag}] What to do next follows the tracked task: {nx[:120]!r}")
                await go("log")
                # Abandon needs two taps
                await closeall(); await pg.click(f"[data-act=taskdrop][data-id='{hk}']"); await pg.wait_for_timeout(250)
                still = await pg.evaluate(f"!!NPCTASKS.find(window.__dbg.save(), '{hk}')")
                ok(still, f"[{tag}] first Abandon tap only asks")
                await closeall(); await pg.click(f"[data-act=taskdrop][data-id='{hk}']"); await pg.wait_for_timeout(300)
                gone = await pg.evaluate(f"!NPCTASKS.find(window.__dbg.save(), '{hk}') && !LEGHUNT.cur(window.__dbg.save())")
                ok(gone, f"[{tag}] second tap gives the hunt up")
            # finish a delivery job -> Completed
            dk = await pg.evaluate("""()=>{const S=window.__dbg.save(); const j=(S.jobs||[]).find(x=>x.type==='deliver'); if(!j) return ''; S.location=j.target; [S.x,S.y]=WORLD.places[j.target]; TOWNS.checkJobs(S); NPCTASKS.poll(S); return j.target;}""")
            if dk:
                await go("log"); await closeall(); await pg.click("[data-act=jtab][data-id=done]"); await pg.wait_for_timeout(300)
                t = (await pg.evaluate("document.querySelector('#side').innerText")).lower()
                ok("finished tasks" in t and dk.lower() in t, f"[{tag}] the delivered job is in Completed")
                await pg.screenshot(path=f"{SHOTS}sidequests_done_{tag}.png", full_page=True)
                await pg.click("[data-act=jtab][data-id=active]"); await pg.wait_for_timeout(200)
            await ctx.close()
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
