# Wagons you can tap (wagons.js): tap a caravan far away -> its card, open its packs, stand beside it -> buy;
# on a PC the pointer lights the wagons up and a tap on a group pin zooms in. Phone 390x844 and PC 1440x900.
# Serve game/ first:  node serve.js 8765   then   python3 wagons_ui.py 8765 [outdir]
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_wagons")
os.makedirs(OUT, exist_ok=True)
EXE = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

# a caravan halfway down its road; the hero stands back down that road (in sight, not beside them), the map centred on the wagons
SETUP = """(z)=>{
  const S = window.__dbg.save(), t = G.now();
  const c = CARAVANS.all(t).filter(x => x.phase === 'road').sort((a, b) => Math.abs(CVROAD.frac(a, t) - 0.5) - Math.abs(CVROAD.frac(b, t) - 0.5))[0];
  if (!c) return null;
  for (const n of Object.keys(WORLD.places)) if (!S.discovered.includes(n)) S.discovered.push(n);
  S.gold = 900; S.trip = null; S.dungeon = null;
  const p = CARAVANS.pos(c, t), home = WORLD.places[c.from], d = G.pxDist(p, home) || 1, k = Math.min(1, 110 / d);
  S.location = null; S.x = p[0] + (home[0] - p[0]) * k; S.y = p[1] + (home[1] - p[1]) * k;   // back down their road, in sight but not beside them
  window.__dbg.setView(z, [p[0], p[1]]);
  return { id: c.id, name: c.line.name, from: c.from, to: c.to };
}"""
SPOT = """(id)=>{
  const v = window.__dbg.view(), c = (v.caravans || []).find(x => x.id === id); if (!c || !v.transform) return null;
  const r = document.querySelector('#map').getBoundingClientRect(), { k, ox, oy } = v.transform;
  return { x: r.left + c.pos[0] * WorldMap.W * k + ox, y: r.top + c.pos[1] * WorldMap.H * k + oy - 8, near: !!c.near, visible: !!c.visible };
}"""
# stand right beside the wagons (not travelling)
BESIDE = """(id)=>{
  const S = window.__dbg.save(), t = G.now(), c = CARAVANS.all(t).find(x => x.id === id); if (!c) return false;
  const p = CARAVANS.pos(c, t); S.location = null; S.trip = null; S.x = p[0] + 0.004; S.y = p[1]; return true;
}"""
# a group pin with a wagon in it, at a zoomed-out view
CLUSTER = """()=>{
  const v = window.__dbg.view(); if (!v.transform) return null;
  const cv = document.querySelector('#map'), r = cv.getBoundingClientRect(), { k, ox, oy } = v.transform;
  const UI = Math.max(1, Math.min(1.3, Math.min(cv.clientWidth, cv.clientHeight) / 860));
  const CL = WorldMap.clusterMovers(v, (p) => [p[0] * WorldMap.W * k + ox, p[1] * WorldMap.H * k + oy], UI);
  const pin = CL.pins.find(p => p.items.some(i => i.kind === 'wagon') && document.elementFromPoint(r.left + p.x, r.top + p.y - 8 * UI) === cv);   // not under a panel or button
  return pin ? { x: r.left + pin.x, y: r.top + pin.y - 8 * UI, n: pin.n, zoom: v.zoom } : { pins: CL.pins.length, zoom: v.zoom, at: CL.pins.map(p => { const e = document.elementFromPoint(r.left + p.x, r.top + p.y - 8 * UI); return [Math.round(p.x), Math.round(p.y), p.items.map(i => i.kind).join(','), e ? (e.id || e.className) : null]; }) };
}"""

async def start(b, vp, tag, errs, lang=None):
    ctx = await b.new_context(viewport=vp, device_scale_factor=2 if vp["width"] < 700 else 1)
    if lang: await ctx.add_init_script("try { const p = JSON.parse(localStorage.getItem('rotn_prefs') || '{}'); p.lang = '%s'; localStorage.setItem('rotn_prefs', JSON.stringify(p)); } catch (e) {}" % lang)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(f"{tag}: {e}"))
    bad = []; pg.on("requestfailed", lambda r: bad.append(r.url) if "127.0.0.1" in r.url else None)
    for attempt in range(8):   # a busy local server sometimes drops a script: load again rather than test half a game
        bad.clear(); errs.clear()
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets&p=wg{tag}"); await pg.wait_for_timeout(2500)
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

async def tap_wagon(pg, info, label):
    for _ in range(6):   # the wagons move; aim again just before tapping
        spot = await pg.evaluate(SPOT, info["id"])
        if spot and spot["visible"]: break
        await pg.wait_for_timeout(600)
    print(f"  {label} wagon at", spot)
    if not spot: return False
    up = await pg.evaluate("(() => { const t = OVERLAYS.top(); document.querySelectorAll('#modal').forEach(m=>m.remove()); return t.name + ':' + (t.el?.id || t.el?.className || ''); })()")
    if not up.startswith("none") and not up.startswith("toast"): print("  cleared before tapping:", up)   # a world event's window popped up on its own
    await pg.mouse.click(spot["x"], spot["y"]); await pg.wait_for_timeout(700)
    return await pg.evaluate("!!document.querySelector('#wgcard')")

async def run(b, vp, tag, errs, res):
    pg = await start(b, vp, tag, errs)
    info = await pg.evaluate(SETUP, 3.6); print(tag, "caravan:", info)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate("document.querySelector('#mapwrap')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_before.png"))
    if tag == "pc":
        spot = await pg.evaluate(SPOT, info["id"])
        await pg.mouse.move(spot["x"], spot["y"]); await pg.wait_for_timeout(500)
        cur = await pg.evaluate("document.querySelector('#map').style.cursor")
        hov = await pg.evaluate("WAGONS.hovered()")
        res[f"{tag} hover lights the wagon"] = cur == "pointer" and hov == info["id"]
        await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_hover.png"))
    opened = await tap_wagon(pg, info, "far")
    res[f"{tag} tap opens the card"] = opened
    txt = (await pg.evaluate("document.querySelector('#wgcard')?.innerText || ''")).lower()
    res[f"{tag} card shows route, cargo and state"] = info["to"].lower() in txt and ("cargo" in txt or "ładunek" in txt) and ("state" in txt or "stan" in txt)
    res[f"{tag} far: Catch up offered"] = await pg.evaluate("!!document.querySelector('#wgcard [data-wg=catch]')")
    res[f"{tag} card ranks as a decision"] = await pg.evaluate("OVERLAYS.top().name") == "decision"
    await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_card.png"))
    await pg.click("#wgcard [data-wg=trade]"); await pg.wait_for_timeout(400)
    n = await pg.evaluate("document.querySelectorAll('#wgcard .wg-item').length")
    res[f"{tag} their packs list ({n})"] = n >= 3
    await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_trade_far.png"))
    # walk up beside them and buy
    await pg.click("#wgcard [data-wg=x]"); await pg.wait_for_timeout(300)
    await pg.evaluate(BESIDE, info["id"]); await pg.wait_for_timeout(900)
    opened = await tap_wagon(pg, info, "near")
    if not opened and await pg.evaluate("!!document.querySelector('#modal')"):   # beside them a tap may hail them right away
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    if not opened:
        await pg.evaluate(f"WAGONS.open({info['id']!r})"); await pg.wait_for_timeout(300)
    res[f"{tag} beside: Hail offered"] = await pg.evaluate("!!document.querySelector('#wgcard [data-wg=meet]')")
    await pg.click("#wgcard [data-wg=trade]"); await pg.wait_for_timeout(400)
    g0 = await pg.evaluate("window.__dbg.save().gold")
    buy = await pg.query_selector("#wgcard [data-wg=buy]:not([disabled])")
    if buy: await buy.click(); await pg.wait_for_timeout(500)
    g1 = await pg.evaluate("window.__dbg.save().gold")
    res[f"{tag} buying takes gold ({g0}->{g1})"] = g1 < g0
    await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_after_buy.png"))
    await pg.evaluate("WAGONS.close()")
    if tag == "pc":   # zoomed out: tap a group pin with a wagon in it -> zooms in
        cl = None
        for town in ("Riften", "Whiterun", "Windhelm", "Solitude", "Markarth"):   # stand in a few towns until a group pin with a wagon is in sight
            await pg.evaluate(f"(() => {{ const S = window.__dbg.save(), p = WORLD.places['{town}']; S.location = null; S.trip = null; S.x = p[0]; S.y = p[1]; window.__dbg.setView(1, [p[0], p[1]]); }})()")
            await pg.wait_for_timeout(1000)
            cl = await pg.evaluate(CLUSTER); print("  cluster near", town, cl)
            if cl and "x" in cl: break
        if cl and "x" in cl:
            await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_cluster_before.png"))
            await pg.mouse.click(cl["x"], cl["y"]); await pg.wait_for_timeout(1200)
            z = await pg.evaluate("window.__dbg.view().zoom")
            res[f"{tag} group pin zooms in ({cl['zoom']}->{z})"] = z > cl["zoom"]
            await pg.screenshot(path=os.path.join(OUT, f"wagons_{tag}_cluster_after.png"))
        else: print("  no group pin with a wagon in view (skipped)")
    await pg.context.close()

# text nodes inside a box that still read as English
ENGLISH = r"""(sel) => { const out = []; for (const root of document.querySelectorAll(sel)) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.nodeValue.trim().replace(/The (Pale|Rift|Reach)/g, ""); if (t.length > 2 && /\b(the|you|your|they|them|with|wagons?|caravans?|guards?|trade|road|gold|leaves|arrives|cart|news|catch|rob|state|cargo)\b/i.test(t)) out.push(t); } }
  return [...new Set(out)]; }"""

async def run_pl(b, errs, res):
    """Polish: the card, its packs, the meeting on the road and the town's caravan board have no English left"""
    pg = await start(b, {"width": 390, "height": 844}, "pl", errs, lang="pl")
    info = await pg.evaluate(SETUP, 3.6); print("pl caravan:", info)
    await pg.evaluate("document.querySelector('#mapwrap')?.scrollIntoView({block:'start'})"); await pg.wait_for_timeout(1200)
    await pg.evaluate(f"WAGONS.open({info['id']!r})"); await pg.wait_for_timeout(500)
    await pg.click("#wgcard [data-wg=trade]"); await pg.wait_for_timeout(500)
    names = await pg.evaluate("""(() => { const ids = new Set(); for (const c of CARAVANS.all(G.now())) for (const i of WAGONS.stock(window.__dbg.save(), c)) ids.add(i); for (const i of Object.values(WAGONS.RELIEF || {}).flat()) if (D.ITEMS[i]) ids.add(i);
      return [...ids].map(i => D.ITEMS[i].name).filter(n => I18N.tr(n) == null); })()""")
    print("  caravan wares with no Polish name:", names)
    res[f"pl every caravan ware has a Polish name ({len(names)} missing)"] = not names
    left = await pg.evaluate(ENGLISH, "#wgcard"); print("  card english:", left)
    res[f"pl card and packs in Polish ({len(left)} English)"] = not left
    await pg.screenshot(path=os.path.join(OUT, "wagons_pl_card.png"))
    await pg.evaluate("WAGONS.close()"); await pg.evaluate(BESIDE, info["id"]); await pg.wait_for_timeout(600)
    await pg.evaluate(f"WAGONS.open({info['id']!r})"); await pg.wait_for_timeout(300)
    await pg.click("#wgcard [data-wg=meet]"); await pg.wait_for_timeout(1500)
    has = await pg.evaluate("!!document.querySelector('#modal')")
    left = await pg.evaluate(ENGLISH, "#modal") if has else ["(no meeting window)"]
    print("  meeting english:", left)
    res[f"pl meeting on the road in Polish ({len(left)} English)"] = not left
    await pg.screenshot(path=os.path.join(OUT, "wagons_pl_meet.png"))
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    # the town's caravan board: stand in a town where a caravan is resting
    town = await pg.evaluate("""(() => { const S = window.__dbg.save(), c = CARAVANS.all(G.now()).find(x => x.phase !== 'road' && CARAVANS.at(x.from).length); if (!c) return null;
      S.trip = null; S.location = c.from; [S.x, S.y] = WORLD.places[c.from]; return c.from; })()""")
    if town:
        try: await pg.click("[data-tab=town]", timeout=3000)
        except Exception: await pg.evaluate("document.querySelector('[data-tab=town]')?.click()")
        await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelector('[data-act=shop][data-id=caravans]')?.click()"); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.querySelector('.cvcard')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(500)
        if await pg.evaluate("!!document.querySelector('.cvcard')"):
            left = await pg.evaluate(ENGLISH, ".cvcard"); print("  board english:", left)
            res[f"pl caravan board in Polish ({len(left)} English)"] = not left
            await pg.screenshot(path=os.path.join(OUT, "wagons_pl_board.png"))
        else: print("  no caravan board on the Area tab in", town, "(skipped)", await pg.evaluate("[...document.querySelectorAll('[data-act=shop]')].map(b => b.dataset.id).join(',') + ' | ' + (document.querySelector('[data-tab].on,[data-tab][aria-selected=true]')?.dataset.tab)"))
    await pg.context.close()

async def main():
    async with async_playwright() as p:
        b = await (p.chromium.launch(executable_path=EXE, args=["--no-sandbox"]) if EXE else p.chromium.launch(args=["--no-sandbox"]))
        errs, res = [], {}
        if os.environ.get("ONLY") != "pl":   # ONLY=pl: just the Polish pass
            await run(b, {"width": 390, "height": 844}, "phone", errs, res)
            await run(b, {"width": 1440, "height": 900}, "pc", errs, res)
        await run_pl(b, errs, res)
        await b.close()
    for k, v in res.items(): print(("ok  " if v else "FAIL"), k)
    print("errors:", errs[:6])
    bad = [k for k, v in res.items() if not v]
    print("wagons_ui", "FAILED" if bad or errs else "ok")
    sys.exit(1 if bad else 0)
asyncio.run(main())
