# Map panels (mapsheet.js): every marker you can tap on the map opens the same panel as caravans. PC = docked on the
# right between the top and the bottom bar; phones = a sheet above the nav bar. For each kind (city, dungeon, fort, camp,
# shrine, standing stone, landmark, dragon lair, a dungeon you stand at, a spot in the wilds, your pin, another hero, a
# caravan) every button must be reachable: scrolled into view inside the panel, inside the window, above the nav bar and
# actually hit by a tap there. Opening another marker swaps the content (one panel at a time), tapping the empty map
# closes it, Esc and the back button close it. Phones 360x780 / 390x844, PC 1440x900 / 1735x950 / 1920x1080.
# Serve game/ first:  node serve.js 8765 ../game   then   python3 mappanels_ui.py 8765 [outdir]
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_mappanels")
os.makedirs(OUT, exist_ok=True)
EXE = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

SETUP = """()=>{
  const S = window.__dbg.save();
  for (const n of Object.keys(WORLD.places)) if (!S.discovered.includes(n)) S.discovered.push(n);
  S.gold = 900; S.trip = null; S.dungeon = null; S.location = null;
  const w = WORLD.places['Whiterun']; S.x = w[0] + 0.03; S.y = w[1] + 0.02;
  const pick = (k) => Object.entries(WORLD.places).filter(([n, p]) => p[2] === k && !WORLD.hidden?.has(n)).map(([n]) => n)
    .find((n) => { const p = WORLD.places[n]; return !Object.entries(WORLD.places).some(([m, q]) => m !== n && Math.hypot((q[0] - p[0]) * 1000, (q[1] - p[1]) * 700) < 14); });
  const out = {};
  for (const k of ['city', 'dungeon', 'fort', 'camp', 'shrine', 'stone', 'landmark', 'lair']) { const n = pick(k); if (n) out[k] = n; }
  out.inside = Object.keys(WORLD.places).find((n) => DUNGEONS.enterable(n) && n !== out.dungeon);
  return out;
}"""
# where a place is on screen (after centring the map on it)
SPOT = """(n)=>{
  const v = window.__dbg.view(); if (!v.transform) return null;
  const p = WORLD.places[n], r = document.querySelector('#map').getBoundingClientRect(), { k, ox, oy } = v.transform;
  return { x: r.left + p[0] * WorldMap.W * k + ox, y: r.top + p[1] * WorldMap.H * k + oy };
}"""
# an empty bit of map: no place, pin, hero or wagon near it, on land, not under the panel or a bar
EMPTY = """()=>{
  const v = window.__dbg.view(), m = document.querySelector('#map'), r = m.getBoundingClientRect(), { k, ox, oy } = v.transform;
  const pan = document.querySelector('.mpanel'), pr = pan ? pan.getBoundingClientRect() : null;
  for (let gy = 0.15; gy < 0.85; gy += 0.05) for (let gx = 0.1; gx < 0.9; gx += 0.05) {
    const sx = r.width * gx, sy = r.height * gy, cx = r.left + sx, cy = r.top + sy;
    if (cy < 70 || cy > innerHeight - 120) continue;
    if (pr && cx >= pr.left - 10 && cx <= pr.right + 10 && cy >= pr.top - 10 && cy <= pr.bottom + 10) continue;
    const hit = document.elementFromPoint(cx, cy); if (hit !== m) continue;
    if (WorldMap.placeAt(v, sx, sy, () => true)) continue;
    const w = [(sx - ox) / k / WorldMap.W, (sy - oy) / k / WorldMap.H]; if (!WORLD.onMap(w)) continue;
    if ((v.caravans || []).some((c) => c.visible && Math.hypot(c.pos[0] * WorldMap.W * k + ox - sx, c.pos[1] * WorldMap.H * k + oy - sy) < 60)) continue;
    if ((v.others || []).some((o) => Math.hypot(o.pos[0] * WorldMap.W * k + ox - sx, o.pos[1] * WorldMap.H * k + oy - sy) < 60)) continue;
    if ((window.__dbg.save().pins || []).some((p) => Math.hypot(p.x * WorldMap.W * k + ox - sx, p.y * WorldMap.H * k + oy - sy) < 40)) continue;
    return { x: cx, y: cy };
  }
  return null;
}"""
CHECK = """async ()=>{
  const all = document.querySelectorAll('.mpanel'); const el = all[0]; if (!el) return { err: 'no panel' };
  const H = innerHeight, W = innerWidth;
  let navTop = H;
  for (const n of document.querySelectorAll('#tabs, .tabs, .pcbar')) { const r = n.getBoundingClientRect(), cs = getComputedStyle(n); if (r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && r.top > H / 2) navTop = Math.min(navTop, r.top); }
  const pr = el.getBoundingClientRect(), bad = [];
  if (all.length > 1) bad.push(all.length + ' panels');
  if (pr.bottom > navTop + 0.5) bad.push('panel bottom ' + Math.round(pr.bottom) + ' > nav ' + Math.round(navTop));
  if (pr.top < -0.5 || pr.left < -0.5 || pr.right > W + 0.5) bad.push('panel off screen');
  const btns = [...el.querySelectorAll('button')];
  for (const b of btns) {
    if (!b.isConnected) { bad.push('re-rendered'); break; }
    b.scrollIntoView({ block: 'nearest' }); await new Promise(r => setTimeout(r, 30));
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const name = (b.dataset.wg || b.dataset.act || '') + ':' + (b.innerText || '').split('\\n')[0].slice(0, 24);
    if (r.height < 30 || r.width < 30) bad.push(name + ' too small');
    if (r.top < 0 || r.left < 0 || r.right > W || r.bottom > H) { bad.push(name + ' off screen'); continue; }
    if (r.bottom > navTop + 0.5) { bad.push(name + ' under the nav bar'); continue; }
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !b.contains(hit)) bad.push(name + ' covered by ' + (hit ? (hit.id || hit.className || hit.tagName) : 'nothing'));
  }
  const bd = el.querySelector('.wg-body'); if (bd) bd.scrollTop = 0;
  return { id: el.id, title: el.querySelector('.wg-h b')?.textContent || '', acts: [...el.querySelectorAll('.wg-act')].map((b) => (b.dataset.act || b.dataset.wg)), n: btns.length, bad,
    panel: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)], navTop: Math.round(navTop), W, H,
    open: document.documentElement.classList.contains('wg-open') };
}"""

async def start(b, vp, tag, errs):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if vp["width"] < 700 else 1, has_touch=vp["width"] < 700)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag}: {e}"))
    bad = []; pg.on("requestfailed", lambda r: bad.append(r.url) if "127.0.0.1" in r.url else None)
    for attempt in range(8):
        bad.clear(); errs.clear()
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets&p=mpn{tag}"); await pg.wait_for_timeout(2500)
        if not bad and not errs:
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
        print("  reload, missing:", [u.split('/')[-1] for u in bad[:4]], errs[:2])
    errs.clear()
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.add_style_tag(content=".pban{display:none!important}")
    await pg.wait_for_function("typeof G !== 'undefined' && !!window.__dbg && !!window.__dbg.save()")
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    if await pg.evaluate("!!document.querySelector('[data-tab=map]')"):
        try: await pg.click("[data-tab=map]", timeout=3000)
        except Exception: pass
    return pg

async def tap_place(pg, n):
    await pg.evaluate("(n)=>{ const p = WORLD.places[n]; window.__dbg.setView(3.2, [p[0], p[1]]); }", n)
    await pg.evaluate("document.querySelector('#mapwrap')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(700)
    s = await pg.evaluate(SPOT, n)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.mouse.click(s["x"], s["y"]); await pg.wait_for_timeout(450)
    return await pg.evaluate("document.querySelector('.mpanel .wg-h b')?.textContent || ''")

def judge(res, tag, what, c, pc, need=1):
    res[f"{tag} {what}: every button reachable ({c.get('n')})"] = not c.get("err") and not c.get("bad") and c.get("n", 0) >= need
    if c.get("err"): return
    pr = c["panel"]
    if pc: res[f"{tag} {what}: docked on the right, full height"] = pr[0] + pr[2] >= c["W"] - 20 and pr[1] <= 20 and pr[3] >= c["H"] - 120 and pr[2] <= c["W"] * 0.35
    else: res[f"{tag} {what}: a sheet above the nav bar"] = abs(pr[1] + pr[3] - c["navTop"]) <= 2

async def run(b, vp, tag, errs, res):
    pg = await start(b, vp, tag, errs)
    P = await pg.evaluate(SETUP); print(tag, "places:", P)
    pc = await pg.evaluate("document.documentElement.classList.contains('pcmap')")
    for kind in ("city", "dungeon", "fort", "camp", "shrine", "stone", "landmark", "lair"):
        n = P.get(kind)
        if not n: continue
        title = await tap_place(pg, n)
        res[f"{tag} tapping a {kind} opens its panel"] = title == n
        if title != n: print(f"  {tag} {kind} {n!r}: got {title!r}"); continue
        c = await pg.evaluate(CHECK); print(f"  {tag} {kind}:", c)
        judge(res, tag, kind, c, pc)
        res[f"{tag} {kind}: Travel is a big row"] = "go" in c.get("acts", [])
        if kind in ("city", "dungeon"): await pg.screenshot(path=os.path.join(OUT, f"mpn_{tag}_{kind}.png"))
    if pc:
        res[f"{tag} PC: map buttons move aside"] = await pg.evaluate("(()=>{ const m = document.querySelector('.mapbtns'), p = document.querySelector('.mpanel'); return !m || m.getBoundingClientRect().right <= p.getBoundingClientRect().left + 1; })()")
    # one panel at a time: tap another place and it swaps
    a, z = P.get("city"), P.get("shrine")
    await tap_place(pg, a); t2 = await tap_place(pg, z)
    res[f"{tag} another marker swaps the panel"] = t2 == z and await pg.evaluate("document.querySelectorAll('.mpanel').length") == 1
    # the empty map closes it; tapping empty map again drops a spot in the wilds
    e = await pg.evaluate(EMPTY)
    if e:
        await pg.mouse.click(e["x"], e["y"]); await pg.wait_for_timeout(400)
        res[f"{tag} the empty map closes it"] = await pg.evaluate("!document.querySelector('.mpanel') && !document.documentElement.classList.contains('wg-open')")
        await pg.mouse.click(e["x"], e["y"]); await pg.wait_for_timeout(400)
        c = await pg.evaluate(CHECK); print(f"  {tag} spot:", c)
        judge(res, tag, "spot in the wilds", c, pc)
        res[f"{tag} spot: Walk here"] = "go" in c.get("acts", []) and "spotpin" in c.get("acts", [])
    else: res[f"{tag} found an empty bit of map"] = False
    # a dungeon you're standing at: Go inside
    n = P.get("inside")
    if n:
        await pg.evaluate("(n)=>{ const S = window.__dbg.save(), p = WORLD.places[n]; S.location = n; S.x = p[0]; S.y = p[1]; }", n)
        await pg.evaluate("(n)=>window.__ui && 0", n)
        await tap_place(pg, n)
        c = await pg.evaluate(CHECK); print(f"  {tag} inside:", c)
        if pc and c.get("err"):   # PC: the town you're in opens beside the map instead; a dungeon still gets its panel
            print("   (PC opened the side panel)")
        else:
            judge(res, tag, "the dungeon you're at", c, pc)
            res[f"{tag} the dungeon you're at: Go inside"] = "enter" in c.get("acts", [])
            await pg.screenshot(path=os.path.join(OUT, f"mpn_{tag}_inside.png"))
        await pg.evaluate("()=>{ const S = window.__dbg.save(), w = WORLD.places['Whiterun']; S.location = null; S.x = w[0] + 0.03; S.y = w[1] + 0.02; }")
    # your pin
    await pg.evaluate("()=>{ const S = window.__dbg.save(), w = WORLD.places['Whiterun']; S.pins = [{ id: 'tp1', x: w[0] - 0.05, y: w[1] + 0.04, icon: '★', label: 'Good fishing' }]; window.__dbg.setView(3.2, [w[0] - 0.05, w[1] + 0.04]); }")
    await pg.wait_for_timeout(700)
    s = await pg.evaluate("()=>{ const v = window.__dbg.view(), p = window.__dbg.save().pins[0], r = document.querySelector('#map').getBoundingClientRect(), { k, ox, oy } = v.transform; return { x: r.left + p.x * WorldMap.W * k + ox, y: r.top + p.y * WorldMap.H * k + oy }; }")
    await pg.mouse.click(s["x"], s["y"]); await pg.wait_for_timeout(400)
    c = await pg.evaluate(CHECK); print(f"  {tag} pin:", c)
    judge(res, tag, "your pin", c, pc, 2)
    res[f"{tag} pin: Travel and Remove"] = "go" in c.get("acts", []) and "pindel" in c.get("acts", [])
    # another hero
    ok = await pg.evaluate("""()=>{ const S = window.__dbg.save(), o = { id: 'hero-test', name: 'Lydia Two', race: 'nord', level: 12, x: S.x, y: S.y, look: null, t: G.now() };
      const arr = window.__dbg.others(); arr.push(o); GREET.show('hero-test'); return !!document.querySelector('#greetcard.mpanel'); }"""); await pg.wait_for_timeout(400)
    res[f"{tag} another hero opens a panel"] = ok
    if ok:
        c = await pg.evaluate(CHECK); print(f"  {tag} hero:", c)
        judge(res, tag, "another hero", c, pc)
        await pg.screenshot(path=os.path.join(OUT, f"mpn_{tag}_hero.png"))
    # a caravan swaps in
    cid = await pg.evaluate("(()=>{ const c = CARAVANS.all().find(x => x.phase === 'road') || CARAVANS.all()[0]; if (!c) return null; WAGONS.open(c.id); return c.id; })()")
    await pg.wait_for_timeout(300)
    if cid:
        res[f"{tag} a caravan swaps in"] = await pg.evaluate("document.querySelectorAll('.mpanel').length === 1 && !!document.querySelector('#wgcard')")
        c = await pg.evaluate(CHECK); judge(res, tag, "caravan", c, pc, 4)
    # Esc and back close it
    await tap_place(pg, P["city"])
    await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    res[f"{tag} Esc closes it"] = await pg.evaluate("!document.querySelector('.mpanel') && !document.documentElement.classList.contains('wg-open') && !(typeof PAUSEM !== 'undefined' && PAUSEM.isOpen())")
    await tap_place(pg, P["dungeon"])
    r = await pg.evaluate("window.__ui.back()")
    res[f"{tag} back button closes it"] = r is True and await pg.evaluate("!document.querySelector('.mpanel')")
    await tap_place(pg, P["dungeon"])
    await pg.click(".mpanel [data-wg=x]"); await pg.wait_for_timeout(300)
    res[f"{tag} X closes it"] = await pg.evaluate("!document.querySelector('.mpanel')")
    # Travel from the panel still sets off
    await tap_place(pg, P["city"])
    await pg.click(".mpanel [data-act=go]"); await pg.wait_for_timeout(500)
    res[f"{tag} Travel sets off and closes the panel"] = await pg.evaluate("!!window.__dbg.save().trip && !document.querySelector('.mpanel')")
    await pg.context.close()

async def main():
    res, errs = {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE) if EXE else await p.chromium.launch()
        for vp, tag in (({"width": 360, "height": 780}, "p360"), ({"width": 390, "height": 844}, "p390"), ({"width": 1440, "height": 900}, "pc1440"), ({"width": 1735, "height": 950}, "pc1735"), ({"width": 1920, "height": 1080}, "pc1920")):
            await run(b, vp, tag, errs, res)
        await b.close()
    res["no page errors"] = not errs
    if errs: print("errors:", errs[:5])
    bad = [k for k, v in res.items() if not v]
    for k, v in res.items(): print(("PASS " if v else "FAIL ") + k)
    print("map panels ok" if not bad else f"{len(bad)} failed"); sys.exit(1 if bad else 0)

asyncio.run(main())
