"""Perk stars page on a PC keyboard (perkkeys.js): A/D/W/S move through the skill tiles and the stars follow, E goes into
the stars, W A S D jump between stars and show their perk, E takes it, Tab/Esc go back to the tiles, Esc again closes.
Usage: python3 perkkeys_ui.py PORT   (screenshots go to $SHOTS/pk/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SH = (os.environ.get("SHOTS") or os.path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/pk/"
os.makedirs(SH, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def run(b, w, h):
    ctx = await b.new_context(viewport={"width": w, "height": h})
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&hub=0&p=pkk{w}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),150)")
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=20; S.pendingLevels=0; for (const k in S.skills) S.skills[k].lvl=40; S.perks={}; }""")
    await pg.evaluate("TABMENU.closeHub && TABMENU.closeHub(); __ui.go('stars')"); await pg.wait_for_timeout(700)
    await pg.evaluate("document.activeElement?.blur?.()")
    st = lambda: pg.evaluate("""()=>({mode:PERKKEYS.mode, card:document.querySelector('#side .tw-car>button.pkk-f')?.dataset.id||null, on:document.querySelector('#side .tw-card.on')?.dataset.id||null,
        sky:document.querySelector('#side .tw-big svg[data-sky]')?.dataset.sky||null, star:PERKKEYS.star, ring:!!document.querySelector('#side .tw-big circle.pkk-ring'),
        perk:document.querySelector('#side .tw-perk h3')?.textContent||null, hint:document.querySelector('#side .pkk-hint')?(getComputedStyle(document.querySelector('#side .pkk-hint')).display+'|'+document.querySelector('#side .pkk-hint').textContent):null,
        tab:__ui.tab, pts:PERKS.pointsLeft(__dbg.save()), nperks:Object.keys(__dbg.save().perks||{}).length})""")
    s = await st(); ok(s["card"] == s["on"] and s["card"], f"{w}: the chosen skill has the ring {s['card']}")
    ok(s["hint"] and s["hint"].startswith("block"), f"{w}: key hint shows on a PC ({s['hint']})")
    await pg.screenshot(path=SH + f"{w}_0_start.png")
    first = s["card"]
    await pg.keyboard.press("d"); await pg.wait_for_timeout(400); s = await st()
    ok(s["card"] != first and s["on"] == s["card"] and s["sky"] in (s["card"], None), f"{w}: D moves to the next skill and the stars follow ({first} -> {s['card']}, sky {s['sky']})")
    await pg.keyboard.press("ArrowLeft"); await pg.wait_for_timeout(400); s = await st(); ok(s["card"] == first, f"{w}: ArrowLeft goes back ({s['card']})")
    await pg.keyboard.press("s"); await pg.wait_for_timeout(400); s2 = await st()
    ok(s2["card"] != first and s2["on"] == s2["card"], f"{w}: S moves down a row ({first} -> {s2['card']})")
    await pg.keyboard.press("w"); await pg.wait_for_timeout(400); s = await st(); ok(s["card"] == first, f"{w}: W moves back up ({s['card']})")
    ok(s["tab"] == "stars", f"{w}: A/D/W/S never opened another tab or moved the map ({s['tab']})")
    # pick Heavy Armor (as in the owner's picture), go into the stars
    await pg.evaluate("""document.querySelector('#side .tw-card[data-id="Heavy Armor"]').click()"""); await pg.wait_for_timeout(400)
    s = await st(); ok(s["card"] == "Heavy Armor" and s["mode"] == "skill", f"{w}: a mouse click moves the keyboard ring ({s})")
    await pg.screenshot(path=SH + f"{w}_1_skill.png")
    await pg.keyboard.press("e"); await pg.wait_for_timeout(500); s = await st()
    ok(s["mode"] == "star" and s["ring"] and s["perk"], f"{w}: E goes into the stars and shows a perk ({s['perk']})")
    ok("WASD" in (s["hint"] or ""), f"{w}: hint switches to the stars ({s['hint']})")
    await pg.screenshot(path=SH + f"{w}_2_stars.png")
    seen = {s["perk"]}
    for k in ["w", "d", "w", "a", "s", "d"]:
        await pg.keyboard.press(k); await pg.wait_for_timeout(300); s = await st()
        if s["mode"] != "star": break
        seen.add(s["perk"])
    ok(len(seen) >= 3, f"{w}: W A S D move between stars ({len(seen)} perks seen: {sorted(x for x in seen if x)[:5]})")
    # in view: the ringed star sits inside the sky box
    vis = await pg.evaluate("""()=>{const r=document.querySelector('#side .tw-big circle.pkk-ring'), b=document.querySelector('#side .tw-big'); if(!r||!b) return null;
        const a=r.getBoundingClientRect(), c=b.getBoundingClientRect(); return a.top>=c.top-2&&a.bottom<=c.bottom+2&&a.left>=c.left-2&&a.right<=c.right+2;}""")
    ok(vis, f"{w}: the ringed star is in view ({vis})")
    await pg.screenshot(path=SH + f"{w}_3_moved.png")
    # back with Tab, then in again, go to a perk you can take and take it with E
    if s["mode"] == "star":
        await pg.keyboard.press("Tab"); await pg.wait_for_timeout(400); s = await st()
    ok(s["mode"] == "skill" and not s["ring"] and s["tab"] == "stars" and not await pg.evaluate("!!document.querySelector('#tw')"), f"{w}: Tab goes back to the tiles, compass stays shut ({s['mode']})")
    await pg.evaluate("""()=>{ __dbg.save().level=30; }"""); await pg.wait_for_timeout(200)
    await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500); s = await st()
    ok(s["mode"] == "star", f"{w}: Enter goes into the stars")
    can = await pg.evaluate("""()=>{const g=[...document.querySelectorAll('#side .tw-big g.st')]; return g.findIndex(x=>x.classList.contains('can'));}""")
    pts0, n0 = s["pts"], s["nperks"]
    ok(can >= 0 and pts0 > 0, f"{w}: a perk can be taken (star {can}, {pts0} points)")
    if can >= 0:
        if s["star"] != can:   # the sky opens on the lowest perk you can take; else walk to it with the mouse ring
            await pg.hover(f"#side .tw-big g.st[data-sk-perk='{can}'] circle.hit"); await pg.wait_for_timeout(250)
            await pg.keyboard.press("e"); await pg.wait_for_timeout(400)
        s = await st(); ok(s["star"] == can, f"{w}: the ring is on the star that can be taken ({s['star']} vs {can})")
        await pg.keyboard.press("e"); await pg.wait_for_timeout(500); s = await st()
        ok(s["nperks"] == n0 + 1 and s["pts"] == pts0 - 1, f"{w}: E took the perk ({n0}->{s['nperks']} perks, {pts0}->{s['pts']} points)")
        ok(s["mode"] == "star" and s["ring"], f"{w}: still in the stars after taking it")
        await pg.screenshot(path=SH + f"{w}_4_taken.png")
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400); s = await st()
    ok(s["mode"] == "skill" and s["tab"] == "stars", f"{w}: Esc in the stars goes back to the tiles ({s['mode']}, {s['tab']})")
    await pg.keyboard.press("Backspace"); await pg.wait_for_timeout(200)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)   # the mouse-hover tooltip over the star closes first (tooltip.js)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500); s = await st()
    left = await pg.evaluate("!!document.querySelector('#pausem') || !document.querySelector('#side .tw-starp') || __ui.tab!=='stars'")
    ok(left, f"{w}: Esc on the tiles works as before (Esc menu or back to the map; tab {s['tab']})")
    await pg.screenshot(path=SH + f"{w}_5_esc.png")
    ok(not errs, f"{w}: no page errors {errs[:3]}")
    await ctx.close()
async def touch(b):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&hub=0&p=pkkm"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),150)")
    await pg.evaluate("TABMENU.closeHub && TABMENU.closeHub(); __ui.go('stars')"); await pg.wait_for_timeout(700)
    d = await pg.evaluate("(()=>{const h=document.querySelector('#side .pkk-hint'); return h?getComputedStyle(h).display:'none';})()")
    ok(d == "none", f"phone: no key hint ({d})")
    ok(await pg.evaluate("!!document.querySelector('#side .tw-big .skc, #side .skc.tw-big')"), "phone: the zoomable sky is still there")
    await pg.screenshot(path=SH + "phone.png")
    ok(not errs, f"phone: no page errors {errs[:3]}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        for (w, h) in [(1920, 1080), (1440, 900)]: await run(b, w, h)
        await touch(b)
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
    sys.exit(1 if fails else 0)
asyncio.run(main())
