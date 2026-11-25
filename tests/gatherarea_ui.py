"""Gathering lives in the Area tab (gatherui.js), not floating over the map.
At phone 360/390 and PC 1440/1920: the Area tab shows Gathering with plants, Gather one (hand-pick mini-game),
Forage sets the cooldown line, the Auto-pick switch flips, the "?" tip opens, and nothing floats over the map.
usage: python gatherarea_ui.py PORT [OUTDIR]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_gatherarea")
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

async def run(b, w, h, bad):
    tag = f"[{w}px]"
    ok = lambda c, m: (print(("ok   " if c else "FAIL ") + f"{tag} {m}"), None if c else bad.append(f"{tag} {m}"))
    ctx = await b.new_context(viewport={"width": w, "height": h})
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=gat{w}"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Herba"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("""()=>{const S=window.__dbg.save(); let n=GATHER.nodes()[0],best=0;
       for (const m of GATHER.nodes()){const k=GATHER.around(m.pos,40).length; if(k>best){best=k;n=m;}}
       S.location=null; S.trip=null; S.x=n.pos[0]; S.y=n.pos[1]; GATHER.st(S).auto=false;
       let i=0; for (const m of GATHER.around([S.x,S.y],42)){GATHER.st(S).seen[m.id]=1; if(i++%2) GATHER.st(S).picked[m.id]=G.now();}}""")
    async def clean(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    async def tab(t): await clean(); await pg.evaluate(f"document.querySelector('[data-tab={t}]')?.click()"); await pg.wait_for_timeout(600)
    await tab("world"); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("!document.getElementById('gpop') && ![...document.querySelectorAll('.gcard')].some(c=>c.getClientRects().length)"), "no Gathering card floating on the map")
    await tab("town")
    info = await pg.evaluate("""()=>{const c=document.querySelector('#side #au-gather'); if(!c) return null; c.scrollIntoView();
       const r=c.getBoundingClientRect(); return {rows:c.querySelectorAll('.gnode').length, picked:c.querySelectorAll('.gnode.gdone').length,
       grows:/grows back/.test(c.innerText), forage:!!c.querySelector('[data-act=gforage]'), notes:!!c.querySelector('[data-act=gnotes]'),
       auto:!!c.querySelector('[data-act=gauto]'), tip:!!c.querySelector('.gtip summary'), over:document.documentElement.scrollWidth>innerWidth+1, w:r.width}}""")
    ok(bool(info), "Area tab shows the Gathering section")
    if not info: await ctx.close(); return
    ok(info["rows"] >= 2 and info["picked"] >= 1 and info["grows"], f"plants listed with picked/regrow state {info['rows']}/{info['picked']}")
    ok(info["forage"] and info["notes"] and info["auto"] and info["tip"], "Forage, Herbalist's notes, Auto-pick and the ? tip are there")
    ok(not info["over"], "no sideways scroll")
    os.makedirs(OUT, exist_ok=True)
    c = await pg.query_selector("#side #au-gather"); await c.screenshot(path=os.path.join(OUT, f"gather_area_{w}.png"))
    # the ? tip
    await pg.click("#au-gather .gtip summary"); await pg.wait_for_timeout(200)
    ok(await pg.evaluate("document.querySelector('#au-gather .gtip').open && document.querySelector('#au-gather .gtip-in').getClientRects().length>0"), "? opens the how-it-works tip")
    await pg.screenshot(path=os.path.join(OUT, f"gather_tip_{w}.png"))
    await pg.click("#au-gather .gtip summary"); await pg.wait_for_timeout(200)
    # gather one by hand
    n0 = await pg.evaluate("()=>window.__dbg.save().inv.filter(r=>D.ITEMS[r.item].slot==='ingredient').reduce((a,r)=>a+r.qty,0)")
    await pg.click("#au-gather [data-act=gpick]"); await pg.wait_for_timeout(500)
    opened = await pg.evaluate("typeof HARVESTGAME!=='undefined' && HARVESTGAME.isOpen()")
    if opened:
        await pg.screenshot(path=os.path.join(OUT, f"gather_game_{w}.png"))
        await pg.evaluate("HARVESTGAME._finish('good')"); await pg.wait_for_timeout(600)
        await pg.evaluate("HARVESTGAME.isOpen() && HARVESTGAME.close()"); await pg.wait_for_timeout(300)
    n1 = await pg.evaluate("()=>window.__dbg.save().inv.filter(r=>D.ITEMS[r.item].slot==='ingredient').reduce((a,r)=>a+r.qty,0)")
    ok(n1 > n0, f"Gather picks it ({'mini-game' if opened else 'plain'}; {n0} -> {n1})")
    await tab("town")
    # forage, then the cooldown line
    await clean(); await pg.evaluate("document.querySelector('#au-gather [data-act=gforage]')?.click()"); await pg.wait_for_timeout(500)
    await clean(); await tab("town")
    cd = await pg.evaluate("()=>{const r=document.querySelector('#au-gather .gforage'); return r ? {dis:r.querySelector('button').disabled, txt:r.innerText} : null}")
    ok(bool(cd) and cd["dis"] and "lately" in cd["txt"], f"Forage shows its cooldown {cd and cd['txt'][:80]!r}")
    # auto-pick switch
    await pg.evaluate("document.querySelector('#au-gather [data-act=gauto]')?.click()"); await pg.wait_for_timeout(400)
    on = await pg.evaluate("()=>[GATHER.st(window.__dbg.save()).auto, document.querySelector('#au-gather [data-act=gauto]')?.getAttribute('aria-checked')]")
    ok(on[0] is True and on[1] == "true", f"Auto-pick switches on {on}")
    await clean()
    c = await pg.query_selector("#side #au-gather")
    if c: await c.scroll_into_view_if_needed(); await c.screenshot(path=os.path.join(OUT, f"gather_after_{w}.png"))
    await pg.screenshot(path=os.path.join(OUT, f"gather_page_{w}.png"))
    real = [e for e in errs if "net" not in e.lower()]
    ok(not real, f"no page errors {real[:2]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else p.chromium.launch())
        bad = []
        for w, h in ((360, 780), (390, 844), (1440, 900), (1920, 1080)): await run(b, w, h, bad)
        await b.close()
        print("RESULT OK" if not bad else "RESULT FAIL " + "; ".join(bad))
        sys.exit(1 if bad else 0)

asyncio.run(main())
