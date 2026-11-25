"""Items details (itemcmp.js + ui.js skyPreview): on a 1920x1080 PC, resting the mouse on a row fills the side panel
(no floating tooltip over the list), a click pins it, Esc lets go; the compare block says "+1" damage for a steel sword
against a worn iron sword; one category names its Stat column. On a 390x844 phone the held-row sheet is solid, at most
55% of the screen, and carries the compare block. Screenshots go to $SHOTS/out_itemdetail/ (or the temp folder).
Usage: python itemdetail_ui.py PORT"""
import asyncio, sys, os, time, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_itemdetail") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """() => { const S = window.__dbg.save(); S.level = 10;
  const lo = G.loadout(S).equipment; delete lo.weapon; delete lo.offhand; S.inv = S.inv.filter((r) => !['iron_sword', 'steel_sword'].includes(r.item));
  const iron = G.give(S, 'iron_sword'); G.give(S, 'steel_sword'); G.give(S, 'potion_health'); G.equip(S, iron);
  S.skills['One-Handed'].lvl = 15; }"""
TIPON = "() => !!document.querySelector('#tip.on')"
DET = "() => document.querySelector('#sky .sky-in>.sky-detail')?.textContent || ''"

async def start(b, vp, touch, tag, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag} {e}"))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=id{RUN}{tag}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Pinna"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("setInterval(() => document.querySelectorAll('#modal').forEach((m) => { if (!m.querySelector('.dpick,.doll')) m.remove(); }), 300)")
    await pg.evaluate(SETUP)
    await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(400)
    return ctx, pg

async def row_center(pg, item):
    rid = await pg.evaluate(f"window.__dbg.save().inv.find(r => r.item === '{item}').id")
    el = await pg.query_selector(f"#sky .sky-row[data-id='{rid}']")
    bb = await el.bounding_box()
    return rid, bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2

async def desktop(b, errs):
    ctx, pg = await start(b, {"width": 1920, "height": 1080}, False, "d", errs)
    tap = lambda sel: pg.click(sel)
    await tap("#sky [data-act=skycat][data-id=all]"); await pg.wait_for_timeout(300)
    ok("Pick an item" in (await pg.evaluate("() => document.querySelector('#sky .m2-pick')?.innerText || ''")) or await pg.evaluate(DET) == "", "desktop: nothing picked yet")
    sid, x, y = await row_center(pg, "steel_sword")
    await pg.mouse.move(x, y); await pg.wait_for_timeout(700)
    d = await pg.evaluate(DET)
    ok("Steel Sword" in d, "desktop: hovering the Steel Sword fills the side panel " + repr(d[:60]))
    ok(not await pg.evaluate(TIPON), "desktop: no floating tooltip over the list")
    ok("Against what you wear" in d and "Iron Sword" in d, "desktop: compare block names the worn Iron Sword")
    ok("(+1)" in d, "desktop: steel against iron shows +1 damage " + repr([l for l in d.split("\n") if "→" in l][:3]))
    ok("Hits for about" in d, "desktop: the details print the with-skill number")
    await pg.screenshot(path=OUT + "desktop_hover_steel.png")
    # hover another row: it follows
    iid, x2, y2 = await row_center(pg, "iron_sword")
    await pg.mouse.move(x2, y2); await pg.wait_for_timeout(400)
    d = await pg.evaluate(DET)
    ok("Iron Sword" in d and "wearing this" in d, "desktop: hovering the worn Iron Sword follows and says it is worn " + repr(d[:400]))
    # click pins the steel sword; hover no longer changes it
    await pg.mouse.move(x, y); await pg.wait_for_timeout(200); await pg.mouse.click(x, y); await pg.wait_for_timeout(400)
    await pg.mouse.move(x2, y2); await pg.wait_for_timeout(400)
    d = await pg.evaluate(DET)
    ok("Steel Sword" in d and "Against what you wear" in d, "desktop: a click pins the item (hover elsewhere doesn't change it)")
    # Esc lets go, the menu stays open
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
    ok(await pg.query_selector("#sky") is not None, "desktop: Esc keeps the menu open")
    ok(await pg.evaluate("() => !document.querySelector('#sky .sky-row.sel')"), "desktop: Esc lets go of the pinned item")
    await pg.mouse.move(x2, y2 + 3); await pg.wait_for_timeout(400)
    ok("Iron Sword" in await pg.evaluate(DET), "desktop: after Esc hovering works again")
    # one category: the Stat column says what it is
    await tap("#sky [data-act=skycat][data-id=weapons]"); await pg.wait_for_timeout(300)
    hd = await pg.evaluate("() => document.querySelector('#sky .sky-head.sky-cols')?.innerText || ''")
    ok("Damage" in hd, "desktop: Weapons names its column Damage " + repr(hd))
    await tap("#sky [data-act=skycat][data-id=potions]"); await pg.wait_for_timeout(300)
    hd = await pg.evaluate("() => document.querySelector('#sky .sky-head.sky-cols')?.innerText || ''")
    ok("Effect" in hd, "desktop: Potions names its column Effect " + repr(hd))
    await ctx.close()

async def phone(b, errs):
    ctx, pg = await start(b, {"width": 390, "height": 844}, True, "p", errs)
    cdp = await ctx.new_cdp_session(pg)
    async def touch_tap(sel):
        bb = await (await pg.query_selector(sel)).bounding_box()
        pt = [{"x": bb["x"] + bb["width"] / 2, "y": bb["y"] + bb["height"] / 2, "id": 2}]
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt}); await pg.wait_for_timeout(60)
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(400)
    await touch_tap("#sky [data-act=skycat][data-id=all]")
    sid, x, y = await row_center(pg, "steel_sword")
    pt = [{"x": min(x, 120), "y": y, "id": 1, "radiusX": 4, "radiusY": 4, "force": 1}]
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt}); await pg.wait_for_timeout(900)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(400)
    info = await pg.evaluate("""() => { const t = document.querySelector('#tip.on.tt-sheet'); if (!t) return null; const cs = getComputedStyle(t), r = t.getBoundingClientRect();
      const m = cs.backgroundColor.match(/rgba?\\(([^)]+)\\)/), a = m ? (m[1].split(',')[3] === undefined ? 1 : +m[1].split(',')[3]) : 0;
      return { text: t.innerText, alpha: a, img: cs.backgroundImage, h: r.height, vh: innerHeight }; }""")
    ok(info is not None, "phone: holding a row opens the details sheet")
    if info:
        ok(info["alpha"] >= 1 and info["img"] == "none", f"phone: the sheet is fully opaque ({info['alpha']}, {info['img'][:40]})")
        ok(info["h"] <= info["vh"] * 0.55 + 1, f"phone: the sheet is at most 55vh ({info['h']:.0f} of {info['vh']})")
        ok("Against what you wear" in info["text"] and "(+1)" in info["text"], "phone: the sheet has the compare block with +1 damage")
    await pg.screenshot(path=OUT + "phone_sheet_steel.png")
    await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        errs = []
        await desktop(b, errs)
        await phone(b, errs)
        await b.close()
    ok(not errs, "no page errors " + "; ".join(errs[:3]))
    print("screenshots:", OUT)
    print("RESULT", "OK" if not fails else f"{len(fails)} FAILED")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    asyncio.run(main())
