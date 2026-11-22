"""Fight screen: drag action cards onto a target (foe / yourself), a miss slides back. Usage: python tbdrag_ui.py 8765"""
import asyncio, sys
import os
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
START = open(os.path.join(HERE, "tbfight_ui.py"), encoding="utf-8").read().split('START = """')[1].split('"""')[0]
SP = os.path.join(HERE, "tbf") + os.sep
os.makedirs(SP, exist_ok=True)
async def center(pg, sel):
  b = await pg.locator(sel).first.bounding_box(); return b["x"] + b["width"]/2, b["y"] + b["height"]/2
async def drag(pg, src, dst, shot=None):
  x0, y0 = await center(pg, src); x1, y1 = await center(pg, dst)
  await pg.mouse.move(x0, y0); await pg.mouse.down()
  for i in range(1, 13): await pg.mouse.move(x0 + (x1-x0)*i/12, y0 + (y1-y0)*i/12); await pg.wait_for_timeout(16)
  if shot: await pg.screenshot(path=SP + shot)
  hot = await pg.evaluate("!!document.querySelector('.drop-hot')")
  await pg.mouse.up(); await pg.wait_for_timeout(600); return hot
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width":412,"height":915}, device_scale_factor=2)
    pg = await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=drg&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Dragger"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
    await pg.evaluate(START, "ink"); await pg.wait_for_timeout(400)
    await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(800)
    for _ in range(30):
      if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"): break
      await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.tip,.tipbox,#tip').forEach(e=>e.remove())")
    ap = lambda: pg.evaluate("document.querySelectorAll('#tbf .tbap i.on.ap').length")
    await pg.evaluate("document.querySelector('[data-obt=off]')?.click()"); await pg.wait_for_timeout(300)
    a0 = await ap()
    print(await pg.evaluate("(()=>{const s=document.querySelector('#tbf .tbstage');const r=s.getBoundingClientRect();const t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return [r.x,r.y,r.width,r.height,t&&t.outerHTML.slice(0,120),t&&t.closest('[data-tbzone]')&&t.closest('[data-tbzone]').className]})()"))
    miss = await drag(pg, "#tbf [data-tba=attack]", "#tbf .tbu.me")
    a1 = await ap(); print("drop attack on self -> hot", miss, "AP", a0, "->", a1, "(should not change)")
    hot = await drag(pg, "#tbf [data-tba=attack]", "#tbf .tbstage", "drag_mid.png")
    a2 = await ap(); print("drop attack on foe -> hot", hot, "AP", a1, "->", a2)
    if await pg.evaluate("!!document.querySelector('#tbf [data-tba=block]:not([disabled])')"):
      hot = await drag(pg, "#tbf [data-tba=block]", "#tbf .tbu.me"); a3 = await ap(); print("drop guard on self -> hot", hot, "AP", a2, "->", a3)
    print("ghosts left", await pg.evaluate("[...document.querySelectorAll('.tbghost,.tbaim')].map(e=>e.getAttribute('class'))"), "errors", errs[:3])
    await pg.keyboard.press("l"); await pg.wait_for_timeout(400); print("log sheet", await pg.evaluate("!!document.querySelector('.tbsheet')"))
    await pg.screenshot(path=SP + "drag_log.png")
    ok = (a1 == a0 and a2 < a1 and not errs and hot)
    print("RESULT", "OK" if ok else "FAIL")
    await b.close()
    if not ok: sys.exit(1)
asyncio.run(main())
