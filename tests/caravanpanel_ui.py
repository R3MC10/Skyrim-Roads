# A caravan's panel (wagons.js): PC = docked on the right between the top and the bottom bar; phones = a sheet above
# the nav bar. Every button must be reachable (scrolled into view inside the panel, inside the window, not under a bar,
# and actually the thing a tap there hits). Esc and the back button close it. Phones 360x780 / 390x844, PC 1440x900 / 1735x950.
# Serve game/ first:  node serve.js 8765 ../game   then   python3 caravanpanel_ui.py 8765 [outdir]
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_caravanpanel")
os.makedirs(OUT, exist_ok=True)
EXE = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

SETUP = """(z)=>{
  const S = window.__dbg.save(), t = G.now();
  const c = CARAVANS.all(t).filter(x => x.phase === 'road').sort((a, b) => Math.abs(CVROAD.frac(a, t) - 0.5) - Math.abs(CVROAD.frac(b, t) - 0.5))[0];
  if (!c) return null;
  for (const n of Object.keys(WORLD.places)) if (!S.discovered.includes(n)) S.discovered.push(n);
  S.gold = 900; S.trip = null; S.dungeon = null;
  const p = CARAVANS.pos(c, t), home = WORLD.places[c.from], d = G.pxDist(p, home) || 1, k = Math.min(1, 110 / d);
  S.location = null; S.x = p[0] + (home[0] - p[0]) * k; S.y = p[1] + (home[1] - p[1]) * k;
  window.__dbg.setView(z, [p[0], p[1]]);
  return { id: c.id, name: c.line.name, from: c.from, to: c.to };
}"""
SPOT = """(id)=>{
  const v = window.__dbg.view(), c = (v.caravans || []).find(x => x.id === id); if (!c || !v.transform) return null;
  const r = document.querySelector('#map').getBoundingClientRect(), { k, ox, oy } = v.transform;
  return { x: r.left + c.pos[0] * WorldMap.W * k + ox, y: r.top + c.pos[1] * WorldMap.H * k + oy - 8, visible: !!c.visible };
}"""
# every button in the panel: scroll it into view inside the panel, then check it's on screen, above the bottom bar and hit by a tap
CHECK = """async ()=>{
  const el = document.querySelector('#wgcard'); if (!el) return { err: 'no panel' };
  const H = innerHeight, W = innerWidth;
  let navTop = H;
  for (const n of document.querySelectorAll('#tabs, .tabs, .pcbar')) { const r = n.getBoundingClientRect(), cs = getComputedStyle(n); if (r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && r.top > H / 2) navTop = Math.min(navTop, r.top); }
  const pr = el.getBoundingClientRect();
  const bad = [];
  if (pr.bottom > navTop + 0.5) bad.push('panel bottom ' + Math.round(pr.bottom) + ' > nav ' + Math.round(navTop));
  if (pr.top < -0.5 || pr.left < -0.5 || pr.right > W + 0.5) bad.push('panel off screen');
  const btns = [...el.querySelectorAll('button')];
  for (const b of btns) {
    if (!b.isConnected) { bad.push('re-rendered'); break; }
    b.scrollIntoView({ block: 'nearest' }); await new Promise(r => setTimeout(r, 30));
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const name = (b.dataset.wg || '') + ':' + (b.innerText || '').split('\\n')[0].slice(0, 24);
    if (r.top < 0 || r.left < 0 || r.right > W || r.bottom > H) { bad.push(name + ' off screen'); continue; }
    if (r.bottom > navTop + 0.5) { bad.push(name + ' under the nav bar'); continue; }
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !b.contains(hit)) bad.push(name + ' covered by ' + (hit ? (hit.id || hit.className || hit.tagName) : 'nothing'));
  }
  const bd = document.querySelector('#wgcard .wg-body'); if (bd) bd.scrollTop = 0; else bad.push('panel went away while checking');
  return { n: btns.length, bad, panel: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)], navTop: Math.round(navTop), W, H };
}"""

async def start(b, vp, tag, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if vp["width"] < 700 else 1, has_touch=vp["width"] < 700)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag}: {e}"))
    bad = []; pg.on("requestfailed", lambda r: bad.append(r.url) if "127.0.0.1" in r.url else None)
    for attempt in range(8):
        bad.clear(); errs.clear()
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets&p=cvp{tag}"); await pg.wait_for_timeout(2500)
        if not bad and not errs:
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
        print("  reload, missing:", [u.split('/')[-1] for u in bad[:4]], errs[:2])
    errs.clear()
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.add_style_tag(content=".pban{display:none!important}")
    await pg.wait_for_function("typeof G !== 'undefined' && !!window.__dbg && !!window.__dbg.save()")
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    if await pg.evaluate("!!document.querySelector('[data-tab=world]')"):
        try: await pg.click("[data-tab=world]", timeout=3000)
        except Exception: pass
    return pg

async def run(b, vp, tag, errs, res):
    pg = await start(b, vp, tag, errs)
    info = await pg.evaluate(SETUP, 3.6); print(tag, "caravan:", info)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("document.querySelector('#mapwrap')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(1200)
    opened = False
    for _ in range(4):   # a real tap on the wagons first
        spot = await pg.evaluate(SPOT, info["id"])
        if spot and spot["visible"]:
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.mouse.click(spot["x"], spot["y"]); await pg.wait_for_timeout(600)
            opened = await pg.evaluate("!!document.querySelector('#wgcard')")
            if opened: break
        await pg.wait_for_timeout(500)
    print(f"  {tag} tap opened: {opened}")
    if not opened: await pg.evaluate(f"WAGONS.open({info['id']!r})"); await pg.wait_for_timeout(400)
    pc = await pg.evaluate("document.documentElement.classList.contains('pcmap')")
    c1 = await pg.evaluate(CHECK); print(f"  {tag} card:", c1)
    res[f"{tag} every button reachable ({c1.get('n')})"] = not c1.get("bad") and c1.get("n", 0) >= 4
    if pc:
        pr = c1["panel"]
        res[f"{tag} docked on the right, full height"] = pr[0] + pr[2] >= c1["W"] - 20 and pr[1] <= 20 and pr[3] >= c1["H"] - 120 and pr[2] <= c1["W"] * 0.35
    else:
        res[f"{tag} a sheet above the nav bar"] = abs(c1["panel"][1] + c1["panel"][3] - c1["navTop"]) <= 2
    await pg.screenshot(path=os.path.join(OUT, f"cvp_{tag}_card.png"))
    await pg.click("#wgcard [data-wg=trade]"); await pg.wait_for_timeout(400)
    c2 = await pg.evaluate(CHECK); print(f"  {tag} with packs:", c2)
    res[f"{tag} with packs open every button reachable ({c2.get('n')})"] = not c2.get("bad") and c2.get("n", 0) > c1.get("n", 0)
    await pg.screenshot(path=os.path.join(OUT, f"cvp_{tag}_trade.png"))
    await pg.evaluate("document.querySelector('#wgcard .wg-body').scrollTop = 1e5"); await pg.wait_for_timeout(200)
    await pg.screenshot(path=os.path.join(OUT, f"cvp_{tag}_trade_end.png"))
    res[f"{tag} ranks as a decision"] = await pg.evaluate("OVERLAYS.top().name") == "decision"
    # Esc closes it (and only it: no pause menu)
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    res[f"{tag} Esc closes it"] = await pg.evaluate("!document.querySelector('#wgcard') && !document.documentElement.classList.contains('wg-open') && !(typeof PAUSEM !== 'undefined' && PAUSEM.isOpen())")
    await pg.evaluate(f"WAGONS.open({info['id']!r})"); await pg.wait_for_timeout(300)
    r = await pg.evaluate("window.__ui.back()")
    res[f"{tag} back button closes it"] = r is True and await pg.evaluate("!document.querySelector('#wgcard')")
    await pg.evaluate(f"WAGONS.open({info['id']!r})"); await pg.wait_for_timeout(300)
    await pg.click("#wgcard [data-wg=x]"); await pg.wait_for_timeout(300)
    res[f"{tag} X closes it"] = await pg.evaluate("!document.querySelector('#wgcard')")
    await pg.context.close()

async def main():
    res, errs = {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE) if EXE else await p.chromium.launch()
        for vp, tag in (({"width": 360, "height": 780}, "p360"), ({"width": 390, "height": 844}, "p390"), ({"width": 1440, "height": 900}, "pc1440"), ({"width": 1735, "height": 950}, "pc1735")):
            await run(b, vp, tag, errs, res)
        await b.close()
    res["no page errors"] = not errs
    if errs: print("errors:", errs[:5])
    bad = [k for k, v in res.items() if not v]
    for k, v in res.items(): print(("PASS " if v else "FAIL ") + k)
    print("caravan panel ok" if not bad else f"{len(bad)} failed"); sys.exit(1 if bad else 0)

asyncio.run(main())
