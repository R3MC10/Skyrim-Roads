"""Fight-screen tooltips (fighttips.js + tooltip.js): on a PC, hovering a spell row and a Cast button in the fight's Magic
list shows a tooltip with what the spell does, and a greyed Cast says why; on a 360px phone, holding a finger on a Cast
button shows the tooltip and nothing gets cast. One short run. Screenshots: tests/out_fighttips/.
Usage: python3 fight_tips_ui.py PORT"""
import asyncio, sys, os, time
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_fighttips") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=60;
  for (const id of ['greater_ward','flames']) if (!S.spells.includes(id)) S.spells.push(id);
  G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
BOX = """() => { const t = document.getElementById('tip'); if (!t || !t.classList.contains('on')) return null; const r = t.getBoundingClientRect();
  return { text: t.innerText, l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight }; }"""

async def box(pg, ms=1500):
    for _ in range(ms // 100):
        b = await pg.evaluate(BOX)
        if b: return b
        await pg.wait_for_timeout(100)
    return None

async def open_magic(b, vp, touch, tag, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=ft{RUN}{tag}&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tipsy"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
    await pg.evaluate(START); await pg.wait_for_timeout(500)
    for _ in range(30):   # the event window can redraw under a click: press Fight from the page itself
        if await pg.evaluate("()=>{ const b=document.querySelector('#modal [data-act=ev][data-c=fight]'); if (b) { b.click(); return true; } return false; }"): break
        await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(900)
    for _ in range(40):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]')"): break
        await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{ TB.session.f.mp = Math.max(60, Math.ceil(G.spellCost(TB.session.f.s, D.SPELLS.flames)) + 5); TB.redraw && TB.redraw(); }")
    await pg.evaluate("()=>document.querySelector('#tbf [data-tbm=magic]').click()"); await pg.wait_for_timeout(500)
    return ctx, pg

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs = []
        # ---- PC: hover a spell row, a Cast button and a greyed Cast button
        ctx, pg = await open_magic(b, {"width": 1366, "height": 768}, False, "pc", errs)
        ok(await pg.evaluate("TB.open"), "pc: the fight opens")
        row = await pg.query_selector("#tbf .tbsp:has([data-tba='spell:flames']) .fc-nm")
        ok(row is not None, "pc: the Flames row is in the Magic list")
        if row:
            bb = await row.bounding_box(); await pg.mouse.move(5, 5); await pg.mouse.move(bb["x"] + 10, bb["y"] + bb["height"] / 2)
            bx = await box(pg)
            t = bx["text"].lower() if bx else ""
            ok("flames" in t and "destruction" in t and "magicka" in t and "fire damage" in t, "pc: hovering the spell row shows what it does" + (f" got {t[:90]!r}" if bx else " (nothing)"))
            ok("burns" in t and "turns" in t, "pc: with the burn's numbers and how long it lasts")
            await pg.screenshot(path=f"{OUT}pc_spell_row.png")
        cast = await pg.query_selector("#tbf [data-tba='spell:flames']")
        if cast:
            bb = await cast.bounding_box(); await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
            await pg.wait_for_timeout(200); bx = await box(pg)
            ok(bx is not None and "Flames" in bx["text"] and "magicka" in bx["text"] and " AP" not in bx["text"], "pc: hovering Cast shows the spell with its magicka cost, no AP" + (f" got {bx['text'][:90]!r}" if bx else " (nothing)"))
            ok(bx is not None and bx["l"] >= 0 and bx["r"] <= bx["vw"] and bx["t"] >= 0 and bx["b"] <= bx["vh"], "pc: the tooltip is on screen")
            await pg.screenshot(path=f"{OUT}pc_cast.png")
        grey = await pg.query_selector("#tbf [data-tba='dual:greater_ward'][disabled], #tbf [data-tba='spell:greater_ward'][disabled], #tbf [data-tba^='dual:'][disabled]")
        if grey:
            bb = await grey.bounding_box(); await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
            await pg.wait_for_timeout(200); bx = await box(pg)
            ok(bx is not None and "Need" in bx["text"] and "you have" in bx["text"], "pc: a greyed button says why with numbers" + (f" got {bx['text'][-120:]!r}" if bx else " (nothing)"))
            await pg.screenshot(path=f"{OUT}pc_greyed.png")
        await ctx.close()
        # ---- phone 360px: hold a finger on Cast: the tooltip shows, nothing is cast
        ctx, pg = await open_magic(b, {"width": 360, "height": 780}, True, "ph", errs)
        cdp = await ctx.new_cdp_session(pg)
        el = await pg.query_selector("#tbf [data-tba='spell:flames']")
        ok(el is not None, "phone: the Cast button is there")
        if el:
            await el.scroll_into_view_if_needed(); bb = await el.bounding_box()
            x, y = bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2
            before = await pg.evaluate("[TB.session.f.mp, TB.session.ap, TB.session.ev.length]")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1, "radiusX": 4, "radiusY": 4, "force": 1}]})
            await pg.wait_for_timeout(700)
            bx = await box(pg, 1000)
            await pg.screenshot(path=f"{OUT}phone_hold_cast.png")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            await pg.wait_for_timeout(600)
            after = await pg.evaluate("[TB.session.f.mp, TB.session.ap, TB.session.ev.length]")
            ok(bx is not None and "Flames" in bx["text"], "phone: holding Cast shows the tooltip" + (f" got {bx['text'][:80]!r}" if bx else " (nothing)"))
            ok(bx is not None and bx["l"] >= 0 and bx["r"] <= bx["vw"], "phone: the tooltip fits the 360px screen")
            ok(before == after, f"phone: nothing was cast ({before} -> {after})")
            ok(not await pg.evaluate("!!document.querySelector('.fc-aimbar')"), "phone: no target picking started")
            # a plain tap still casts
            el = await pg.query_selector("#tbf [data-tba='spell:flames']"); bb = await el.bounding_box()
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": bb["x"] + bb["width"] / 2, "y": bb["y"] + bb["height"] / 2, "id": 2}]})
            await pg.wait_for_timeout(60); await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(700)
            tapped = await pg.evaluate("[TB.session.f.mp, TB.session.ap, TB.session.ev.length]")
            ok(tapped != after, f"phone: a quick tap still casts ({after} -> {tapped})")
        await ctx.close()
        ok(not errs, "no page errors " + "; ".join(errs[:3]))
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "fight tips ui ok")
    sys.exit(1 if fails else 0)
asyncio.run(main())
