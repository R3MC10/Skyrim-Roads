"""Fight screen: the combat wheel (moves in a ring round End turn, costs on each slice), the timing ring after a strike
(tap in the bright zone), the result and what you spent floating up. Phone and small/large screens.
Usage: python radial_ui.py 8765"""
import asyncio, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
from playwright.async_api import async_playwright
START = open(os.path.join(HERE, "tbfight_ui.py"), encoding="utf-8").read().split('START = """')[1].split('"""')[0]
SP = os.path.join(HERE, "tbf") + os.sep
os.makedirs(SP, exist_ok=True)
fails = []
def ok(c, m):
  print(("ok   " if c else "FAIL ") + m)
  if not c: fails.append(m)
async def fight(pg):
  await pg.evaluate(START, "ink"); await pg.wait_for_timeout(400)
  await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(800)
  for _ in range(30):
    if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"): break
    await pg.wait_for_timeout(300)
  await pg.evaluate("document.querySelector('[data-obt=off]')?.click()"); await pg.wait_for_timeout(300)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch()
    for vw, vh, tag in [(412, 915, "phone"), (360, 640, "small"), (1280, 800, "wide")]:
      ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, has_touch=True)
      pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
      await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=rad{tag}&tb&wheel"); await pg.wait_for_timeout(1500)
      await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Wheeler"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
      await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
      await fight(pg)
      ok(await pg.evaluate("!!document.querySelector('#tbf .tbwheel .tbhub [data-tba=end]')"), f"{tag}: the wheel is up with End turn in the middle")
      n = await pg.evaluate("document.querySelectorAll('#tbf .tbwheel .tbsl').length"); ok(n >= 6, f"{tag}: {n} slices")
      ok(await pg.evaluate("/AP · \\d+ SP/.test(document.querySelector('#tbf [data-tba=power_attack] small').textContent)"), f"{tag}: power attack shows AP and stamina")
      # slices don't overlap and stay on screen
      bad = await pg.evaluate("""(()=>{const r=[...document.querySelectorAll('#tbf .tbwheel .tbsl, #tbf .tbwheel .tbhub')].map(e=>e.getBoundingClientRect());let o=0;
        for(let i=0;i<r.length;i++){ if(r[i].left<0||r[i].right>innerWidth+1) o+=10; for(let j=i+1;j<r.length;j++){const a=r[i],c=r[j];const w=Math.min(a.right,c.right)-Math.max(a.left,c.left),h=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);if(w>4&&h>4)o++;}} return o;})()""")
      ok(bad == 0, f"{tag}: slices fit and don't overlap ({bad})")
      ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), f"{tag}: no sideways scroll")
      await pg.screenshot(path=SP + f"wheel_{tag}.png")
      ehp0 = await pg.evaluate("TB.session.f.ehp")
      await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(120)
      ok(await pg.evaluate("!!document.querySelector('.tbtime')"), f"{tag}: the timing ring opens")
      ok(await pg.evaluate("TB.session.f.ehp") == ehp0, f"{tag}: nothing happens until you tap")
      await pg.screenshot(path=SP + f"ring_{tag}.png")
      # wait for the needle to reach the zone's middle, then tap
      await pg.wait_for_timeout(200)
      await pg.locator(".tbtime").click(); await pg.wait_for_timeout(500)
      ok(await pg.evaluate("!document.querySelector('.tbtime')"), f"{tag}: the ring closes after the tap")
      ok(await pg.evaluate("[...document.querySelectorAll('.tbspend')].some(e=>/AP/.test(e.textContent))"), f"{tag}: the AP spent floats up")
      ok(await pg.evaluate("[...document.querySelectorAll('.tbspend.grade')].length>=1"), f"{tag}: the timing result shows")
      ok(await pg.evaluate("TB.session.ev.some(e=>e.a==='attack')"), f"{tag}: the strike happened")
      await pg.screenshot(path=SP + f"after_{tag}.png")
      # no tap: it counts as a miss after a couple of turns
      if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"):
        await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(3200)
        ok(await pg.evaluate("!document.querySelector('.tbtime')"), f"{tag}: no tap closes the ring by itself")
      # the \ue145 button switches back to cards
      if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=wheel]')"):
        await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tbWheel:false}))")
      ok(not errs, f"{tag}: no page errors {errs[:2]}")
      await ctx.close()
    await b.close()
  print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
  if fails: sys.exit(1)
asyncio.run(main())
