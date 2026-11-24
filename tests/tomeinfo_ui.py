"""Spell tome info at a merchant (tomeinfo.js): the court wizard's tome rows show school, level, magicka, AP, what the
spell does and whether your skill is enough; the pack's tome card too. Ink and pixel, 390x844.
Usage: python3 tomeinfo_ui.py PORT   (screenshots in tests/out_tomeinfo/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_tomeinfo") + os.sep
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.toast,#toast').forEach(m=>m.remove())"
async def run(b, style):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=tomeinfo-{style}"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Reader"); await pg.click("#begin"); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(st)=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; S.gold=5000;
      for (const k of ['Destruction','Restoration','Alteration','Conjuration','Illusion']) S.skills[k].lvl = 40;
      if(!S.discovered.includes('Winterhold')) S.discovered.push('Winterhold'); G.shopsOpen=()=>true;
      ART.setStyle(st); document.documentElement.classList.toggle('art-pixel', st==='pixel'); }""", style)
    await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
    for _ in range(4):
        await pg.evaluate(CLEAR); await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('[data-act=shop][data-id=wizard]')?.click()"); await pg.wait_for_timeout(900)
    await pg.evaluate(CLEAR)
    rows = await pg.evaluate("[...document.querySelectorAll('.item.ti-row')].map(r=>r.innerText)")
    ok(len(rows) >= 5, f"[{style}] court wizard shows tome rows with info ({len(rows)})")
    ok(all("magicka" in r or "no magicka" in r for r in rows), f"[{style}] every tome row names its magicka cost")
    ok(all(("AP" in r) or ("out of fights" in r) for r in rows), f"[{style}] every tome row names its AP cost")
    ok(all(("✓" in r) or ("\ue123" in r) for r in rows), f"[{style}] every tome row says if your skill is enough")
    await pg.evaluate("document.querySelector('.item.ti-row')?.scrollIntoView({block:'start'}); window.scrollBy(0,-90); document.querySelector('#side')?.scrollBy?.(0,-90)")
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=OUT + f"shop_{style}.png")
    # a tome in the pack: its item card shows the same info (SkyUI stat strip)
    await pg.evaluate("G.give(window.__dbg.save(),'tome_lesser_ward')"); await pg.evaluate(CLEAR)
    await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(400); await pg.evaluate(CLEAR)
    rid = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='tome_lesser_ward').id")
    await pg.evaluate("document.querySelector('[data-act=skycat][data-id=all]')?.click()"); await pg.wait_for_timeout(300)
    await pg.evaluate(f"document.querySelector(\"[data-act=skysel][data-id='{rid}']\")?.click()"); await pg.wait_for_timeout(400)
    card = await pg.evaluate("document.querySelector('.sky-detail .ti-card')?.innerText || ''")
    ok("MAGICKA" in card.upper() and "AP" in card and "Restoration" in card, f"[{style}] pack card shows the tome info: {card[:80]!r}")
    await pg.evaluate("document.querySelector('.sky-detail')?.scrollIntoView({block:'end'})"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=OUT + f"pack_{style}.png")
    ok(not errs, f"[{style}] no page errors {errs}")
    await ctx.close()
async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        for st in ("ink", "pixel"): await run(b, st)
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
