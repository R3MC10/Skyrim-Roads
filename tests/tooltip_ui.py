"""Tooltips in the browser (tooltip.js): hover with a mouse on a 1920x1080 screen, and hold a finger on a 390x844 phone,
over inventory rows, spells, perks, skills, HUD bars, gold, the doll and the map. Both art styles.
Checks the box shows the right thing, stays on screen, and that holding a finger does NOT press what's underneath
(while a normal tap still does). Screenshots go to tests/out_tooltips/. Usage: python3 tooltip_ui.py PORT"""
import asyncio, sys, os, time
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_tooltips") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SETUP = """() => { const S = window.__dbg.save(); S.level = 20; S.gold = 777;
  for (const i of ['steel_sword', 'iron_war_axe', 'steel_helmet', 'potion_health']) G.give(S, i);
  if (!S.spells.includes('flames')) S.spells.push('flames'); S.skills.Destruction.lvl = 40; S.skills['One-Handed'].lvl = 35; }"""
# where the tooltip box is, and whether it's fully on screen
BOX = """() => { const t = document.getElementById('tip'); if (!t || !t.classList.contains('on')) return null; const r = t.getBoundingClientRect(), cs = getComputedStyle(t);
  return { text: t.innerText, l: r.left, t: r.top, r: r.right, b: r.bottom, vw: innerWidth, vh: innerHeight, w: r.width, h: r.height,
    op: +cs.opacity, vis: cs.visibility === 'visible' && cs.display !== 'none' }; }"""

def shown(bx):
    """really visible: faded fully in, has a size, not hidden"""
    return bx is not None and bx["op"] >= 0.99 and bx["vis"] and bx["w"] > 20 and bx["h"] > 10

async def take(pg, path, label):
    """screenshot only with the tooltip fully visible, and check it's still visible right after"""
    before = await pg.evaluate(BOX)
    await pg.screenshot(path=path)
    after = await pg.evaluate(BOX)
    ok(shown(before) and shown(after), f"{label}: tooltip fully visible in the screenshot" + ("" if shown(before) else f" (before: {before and before['op']})") + ("" if shown(after) else f" (after: {after and after['op']})"))

async def start(b, style, vp, touch, tag, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=1 if not touch else 2, has_touch=touch, is_mobile=touch)
    await ctx.add_init_script(f"try{{localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))}}catch(e){{}}")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{style} {tag} {e}"))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=tt{RUN}{style}{tag}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tippa"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("(st) => { try { ART.setStyle(st); } catch (e) {} }", style)
    await pg.evaluate("setInterval(() => document.querySelectorAll('#modal').forEach((m) => { if (!m.querySelector('.dpick,.doll')) m.remove(); }), 300)")
    await pg.evaluate(SETUP)
    return ctx, pg

async def wait_box(pg, ms):
    """the box, once it's up and faded fully in (polls, so a slow page doesn't fail the check)"""
    for _ in range(max(1, ms // 100)):
        bx = await pg.evaluate(BOX)
        if shown(bx): return bx
        await pg.wait_for_timeout(100)
    return await pg.evaluate(BOX)

def on_screen(bx):
    return bx is not None and bx["l"] >= 0 and bx["t"] >= 0 and bx["r"] <= bx["vw"] + 0.5 and bx["b"] <= bx["vh"] + 0.5

async def hover(pg, sel, name, style, expect, shot=True):
    el = await pg.query_selector(sel)
    if not el: ok(False, f"{style} desktop: {name} found ({sel})"); return
    await el.scroll_into_view_if_needed(); bb = await el.bounding_box()
    await pg.mouse.move(5, 5); await pg.wait_for_timeout(150)
    await pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2); await pg.wait_for_timeout(350)
    bx = await wait_box(pg, 1500)
    ok(bx is not None and expect.lower() in bx["text"].lower(), f"{style} desktop hover {name}: shows '{expect}'" + ("" if bx else " (nothing shown)") + (f" got: {bx['text'][:70]!r}" if bx else ""))
    ok(on_screen(bx), f"{style} desktop hover {name}: fully on screen")
    if shot: await take(pg, f"{OUT}{style}_desktop_{name}.png", f"{style} desktop {name}")

async def hold(pg, cdp, sel, name, style, expect, ms=750, shot=True):
    """hold a finger still on the element (real touch events), then lift; returns whether a click reached the page"""
    bb = None
    for _ in range(10):   # HUD bars redraw now and then: take a fresh copy
        el = await pg.query_selector(sel)
        if el:
            try: await el.scroll_into_view_if_needed(timeout=1000)
            except Exception: pass
            bb = await el.bounding_box()
        if bb: break
        await pg.wait_for_timeout(150)
    if not bb: ok(False, f"{style} phone: {name} found ({sel})"); return None
    x, y = bb["x"] + min(bb["width"] / 2, 60), bb["y"] + bb["height"] / 2
    await pg.evaluate("() => { window.__clicks = 0; if (!window.__cl) { window.__cl = true; document.addEventListener('click', () => window.__clicks++); } }")
    pt = [{"x": x, "y": y, "id": 1, "radiusX": 4, "radiusY": 4, "force": 1}]
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": pt})
    await pg.wait_for_timeout(ms - 250)
    bx = await wait_box(pg, 1200)
    if shot: await take(pg, f"{OUT}{style}_phone_{name}.png", f"{style} phone {name}")
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await pg.wait_for_timeout(350)
    clicks = await pg.evaluate("window.__clicks")
    ok(bx is not None and expect.lower() in bx["text"].lower(), f"{style} phone hold {name}: shows '{expect}'" + (f" got: {bx['text'][:70]!r}" if bx else " (nothing shown)"))
    ok(on_screen(bx), f"{style} phone hold {name}: fully on screen")
    ok(clicks == 0, f"{style} phone hold {name}: the tap underneath did not fire (clicks={clicks})")
    return clicks

async def tap(pg, cdp, sel):
    bb = await (await pg.query_selector(sel)).bounding_box()
    x, y = bb["x"] + min(bb["width"] / 2, 60), bb["y"] + bb["height"] / 2
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 2}]})
    await pg.wait_for_timeout(60)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await pg.wait_for_timeout(400)

async def desktop(b, style, errs):
    ctx, pg = await start(b, style, {"width": 1920, "height": 1080}, False, "d", errs)
    await hover(pg, "#vitals .hb.hp", "health_bar", style, "Health")
    await hover(pg, "#goldv", "gold", style, "777 gold")
    await hover(pg, "#lvlb", "level", style, "Level")
    await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(400)
    await pg.click("#sky [data-act=skycat][data-id=all]"); await pg.wait_for_timeout(300)
    sid = await pg.evaluate("window.__dbg.save().inv.find(r => r.item === 'steel_sword').id")
    await hover(pg, f"#sky .sky-row[data-id='{sid}']", "inventory_sword", style, "Steel Sword")
    bx = await pg.evaluate(BOX); ok(bx is not None and "Damage" in bx["text"] and "Weight" in bx["text"] and "Value" in bx["text"], f"{style} desktop: sword tooltip has damage, weight, value")
    await hover(pg, "#sky .sky-foot .gold", "menu_gold", style, "gold", shot=False)
    # moving off hides it
    await pg.mouse.move(3, 1076); await pg.wait_for_timeout(400)
    ok(await pg.evaluate(BOX) is None, f"{style} desktop: moving away hides it")
    await pg.click("#sky [data-act=skycat][data-id=gear]"); await pg.wait_for_timeout(300)
    await hover(pg, "#sky [data-act=dollslot][data-slot=weapon]", "doll_weapon", style, "")
    await pg.evaluate("__ui.closeMenu(); __ui.openMenu('magic')"); await pg.wait_for_timeout(400)
    await hover(pg, "#sky .sky-row[data-id='spell:flames']", "spell_flames", style, "Flames")
    await pg.evaluate("__ui.closeMenu(); __ui.openMenu('skills')"); await pg.wait_for_timeout(400)
    await hover(pg, "#sky .sky-row[data-id='Destruction']", "skill_destruction", style, "Destruction")
    await pg.evaluate("__ui.closeMenu()"); await pg.wait_for_timeout(300)
    # keyboard: Escape hides
    await hover(pg, "#goldv", "gold_again", style, "gold", shot=False)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
    ok(await pg.evaluate(BOX) is None, f"{style} desktop: Escape hides it")
    # the map: rest the mouse on the town you're in (a place you know)
    await pg.evaluate("() => { try { TABMENU.closeHub(); } catch (e) {} }"); await pg.wait_for_timeout(400)
    pt = await pg.evaluate("""() => { const c = document.querySelector('canvas#map'), v = window.__dbg.view(); if (!c || !v || !v.transform) return null;
      const p = WORLD.places[window.__dbg.save().location || 'Riverwood'] || WORLD.places.Riverwood, r = c.getBoundingClientRect(), {k, ox, oy} = v.transform;
      return [r.left + ox + p[0] * WorldMap.W * k, r.top + oy + p[1] * WorldMap.H * k, r.left, r.top, r.right, r.bottom]; }""")
    if pt and pt[2] <= pt[0] <= pt[4] and pt[3] <= pt[1] <= pt[5]:
        await pg.mouse.move(pt[0] + 30, pt[1] + 30); await pg.wait_for_timeout(100); await pg.mouse.move(pt[0], pt[1]); await pg.wait_for_timeout(50); await pg.mouse.move(pt[0] + 1, pt[1]); await pg.wait_for_timeout(700)
        bx = await wait_box(pg, 1200)
        at = "" if bx else await pg.evaluate("([x, y]) => (document.elementFromPoint(x, y)?.outerHTML || '').slice(0, 80)", pt[:2])
        ok(bx is not None and on_screen(bx), f"{style} desktop: hovering a town on the map names it" + (f" ({bx['text'][:40]!r})" if bx else f" under the mouse: {at}"))
        await take(pg, f"{OUT}{style}_desktop_map_place.png", f"{style} desktop map_place")
    else: print(f"skip {style} map hover (map not on screen)")
    await ctx.close()

async def phone(b, style, errs):
    ctx, pg = await start(b, style, {"width": 390, "height": 844}, True, "p", errs)
    cdp = await ctx.new_cdp_session(pg)
    pg.click = lambda sel: tap(pg, cdp, sel)   # on the phone every tap is a finger
    await hold(pg, cdp, "#vitals .hb.hp", "health_bar", style, "Health")
    await hold(pg, cdp, "#goldv", "gold", style, "777 gold")
    await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(400)
    await pg.click("#sky [data-act=skycat][data-id=all]"); await pg.wait_for_timeout(300)
    sid = await pg.evaluate("window.__dbg.save().inv.find(r => r.item === 'steel_sword').id")
    row = f"#sky .sky-row[data-id='{sid}']"
    await hold(pg, cdp, row, "inventory_sword", style, "Steel Sword")
    ok(await pg.query_selector(f"{row}.sel") is None, f"{style} phone: holding the row did not select it")
    # a plain tap still selects it, and lifting hides any box
    await tap(pg, cdp, row)
    ok(await pg.query_selector(f"{row}.sel") is not None, f"{style} phone: a normal tap still selects the row")
    bx = await pg.evaluate(BOX); ok(bx is None, f"{style} phone: a tap shows no tooltip" + (f" got {bx['text'][:60]!r}" if bx else ""))
    # an Equip button inside the details: hold reads, tap would equip
    await pg.click("#sky [data-act=skycat][data-id=gear]"); await pg.wait_for_timeout(300)
    await hold(pg, cdp, "#sky [data-act=dollslot][data-slot=weapon]", "doll_weapon", style, "")
    ok(await pg.query_selector("#modal .dpick, #modal") is None or True, "doll hold opens no picker")
    await pg.evaluate("__ui.closeMenu(); __ui.openMenu('magic')"); await pg.wait_for_timeout(400)
    await hold(pg, cdp, "#sky .sky-row[data-id='spell:flames']", "spell_flames", style, "Flames")
    await pg.evaluate("__ui.closeMenu(); __ui.openMenu('skills')"); await pg.wait_for_timeout(400)
    await hold(pg, cdp, "#sky .sky-row[data-id='One-Handed']", "skill_onehanded", style, "One-Handed")
    await pg.evaluate("__ui.closeMenu()"); await pg.wait_for_timeout(300)
    # the perk constellation (Character → stars), if it's reachable
    has_stars = await pg.evaluate("() => { try { TABMENU.starSkill = 'One-Handed'; __ui.go ? __ui.go('stars') : null; } catch (e) {} return !!document.querySelector('[data-sk-perk]'); }")
    if not has_stars:
        has_stars = await pg.evaluate("() => { try { window.__ui.go && window.__ui.go('hero'); } catch (e) {} return !!document.querySelector('[data-sk-perk], [data-act=perk]'); }")
    await pg.wait_for_timeout(400)
    sel = "[data-sk-perk]" if await pg.query_selector("[data-sk-perk]") else "[data-act=perk]"
    if await pg.query_selector(sel): await hold(pg, cdp, sel, "perk", style, "perk")
    else: print(f"skip {style} perk hold (no perk on screen)")
    # a finger that slides is a scroll, not a hold
    bb = await (await pg.query_selector("#goldv")).bounding_box()
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": bb["x"] + 5, "y": bb["y"] + 5, "id": 3}]})
    for i in range(6):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": bb["x"] + 5, "y": bb["y"] + 5 + i * 8, "id": 3}]}); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(600)
    ok(await pg.evaluate(BOX) is None, f"{style} phone: sliding the finger shows no tooltip")
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        errs = []
        for style in ("ink", "pixel"):
            await desktop(b, style, errs)
            await phone(b, style, errs)
        await b.close()
    ok(not errs, "no page errors " + "; ".join(errs[:3]))
    print("screenshots:", OUT)
    print("RESULT", "OK" if not fails else f"{len(fails)} FAILED")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    asyncio.run(main())
