"""Phone layout pass for Area, Company and Items (areaui.js, longhouse.js + Social tabs, menus2.js, tooltip.js).
At 360 and 390 wide, with Normal and Huge text:
  - Area: full-width rows (two columns only when every name fits), open places first, shut ones folded under "Closed",
    12px edges, 44px taps, 15-16px names, nothing clipped or sticking out.
  - Company: the longhouse hero sits right under the Party / Company / Friends / Realm row; the More row is folded.
  - Items: one Sort button (a picker) plus the direction toggle; picking a sort works.
  - Holding a finger on an item: the tooltip is a bottom sheet 35-45% of the screen high, the list keeps its place.
Usage: python tests/phonelayout_ui.py [port]   (0 or nothing: serves game/ itself; shots go to $SHOTS or the temp folder)"""
import asyncio, os, re, socket, sys, tempfile, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots"), "phonelayout"); os.makedirs(OUT, exist_ok=True)
LNG = re.search(r'SETUP = """(.*?)"""', open(os.path.join(ROOT, "tests", "longhouse_ui.py"), encoding="utf-8").read(), re.S).group(1)

def free_port():
    for p in range(9700, 9800):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9700-9799")

ARG = sys.argv[1] if len(sys.argv) > 1 else "0"
PORT = int(ARG) if ARG != "0" else free_port()
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# things wider than the screen (outside a scroller), and words cut off
OVER = """(sel)=>{const W=innerWidth,o=[];for(const e of document.querySelectorAll(sel+' *')){const r=e.getBoundingClientRect();
  if(!r.width||getComputedStyle(e).position==='fixed')continue; let p=e.parentElement,clip=false; while(p&&p!==document.body){const s=getComputedStyle(p); if(/auto|scroll|hidden/.test(s.overflowX)){clip=true;break} p=p.parentElement}
  if(!clip&&(r.right>W+1||r.left<-1))o.push((e.className||e.tagName)+'@'+Math.round(r.left)+'-'+Math.round(r.right));} return o.slice(0,5)}"""
CLIP = """(sel)=>[...document.querySelectorAll(sel)].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.trim()).slice(0,5)"""
ZOOM = "parseFloat(getComputedStyle(document.documentElement).zoom)||1"

async def start(b, w, huge):
    ctx = await b.new_context(viewport={"width": w, "height": 800}, device_scale_factor=2, has_touch=True, is_mobile=True)
    await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.a11yText=%d;p.lang='en';localStorage.setItem('rotn_prefs',JSON.stringify(p));}catch(e){}" % (3 if huge else 0))
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    for _ in range(3):
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=pl{w}{int(huge)}{int(time.time()) % 10000}")
        try: await pg.wait_for_selector(".press", timeout=10000); break
        except Exception: print("title screen didn't come up, reloading")
    await pg.wait_for_timeout(500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin")
    await pg.wait_for_function("window.__dbg && window.__dbg.save()", timeout=20000); await pg.wait_for_timeout(1000)
    await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner').forEach(m=>m.remove()),150)")
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=14; S.gold=3000;
      for(const i of ['iron_sword','steel_sword','hunting_bow','iron_armor','potion_health','iron_helmet','leather_boots','apple']) if(D.ITEMS[i]) G.give(S,i,1);}""")
    return ctx, pg, errs

async def area(pg, tag):
    # night: the shops are shut
    await pg.evaluate("()=>{ window.__shops = G.shopsOpen; G.shopsOpen = () => false; localStorage.removeItem('ux_aufold'); }")
    await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(900)
    z = await pg.evaluate(ZOOM)
    ok(await pg.evaluate(OVER, "#side") == [], f"{tag} Area: nothing sticks out {await pg.evaluate(OVER, '#side')}")
    ok(await pg.evaluate(CLIP, "#side .au-tile b") == [], f"{tag} Area: no cut-off place names {await pg.evaluate(CLIP, '#side .au-tile b')}")
    r = await pg.evaluate("""()=>{const t=[...document.querySelectorAll('#side .au-tile')].filter(e=>e.offsetParent); const b=t[0].querySelector('b');
      return {l:Math.min(...t.map(e=>e.getBoundingClientRect().left)), r:innerWidth-Math.max(...t.map(e=>e.getBoundingClientRect().right)), h:Math.min(...t.map(e=>e.getBoundingClientRect().height)),
        fs:parseFloat(getComputedStyle(b).fontSize), cols:[...document.querySelectorAll('#side .au-tiles')].filter(e=>e.offsetParent).map(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)}}""")
    ok(abs(r["l"] - 12 * z) <= 2 and abs(r["r"] - 12 * z) <= 2, f"{tag} Area: 12px edges ({r['l']:.1f} / {r['r']:.1f}, zoom {z})")
    ok(r["h"] >= 44 * z - 0.5, f"{tag} Area: rows at least 44px tall ({r['h']:.1f})")
    ok(15 <= r["fs"] <= 16.5, f"{tag} Area: names 15-16px ({r['fs']})")
    ok(all(c in (1, 2) for c in r["cols"]), f"{tag} Area: one or two columns ({r['cols']})")
    two = await pg.evaluate("[...document.querySelectorAll('#side .au-tiles.au-two')].every(t=>[...t.querySelectorAll('.au-tile b')].every(b=>b.scrollWidth<=b.clientWidth+1))")
    ok(two, f"{tag} Area: two columns only where every name fits")
    mk = await pg.evaluate("""()=>{const g=document.querySelector('#side .au-g[data-g=market]'), c=g&&g.querySelector('.au-closed');
      return {closed:c?[...c.querySelectorAll('.au-tile')].map(e=>e.dataset.id):[], folded:c?!c.open:null, last:c?g.lastElementChild===c:null, n:c?c.querySelector('summary').textContent:''}}""")
    ok(set(["general", "blacksmith"]) <= set(mk["closed"]) and mk["folded"] and mk["last"], f"{tag} Area: shut shops fold under Closed at the end of Market ({mk})")
    await pg.evaluate("document.querySelector('#side .au-g[data-g=market] .au-closed summary').click()"); await pg.wait_for_timeout(300)
    ok(await pg.evaluate(CLIP, "#side .au-tile b") == [], f"{tag} Area: opened Closed list has no cut-off names")
    ok(await pg.evaluate("[...document.querySelectorAll('#side .au-closed summary')].every(s=>s.getBoundingClientRect().height>=44*(%s)-0.5)" % ZOOM), f"{tag} Area: Closed line is a 44px tap")
    await pg.evaluate("document.querySelector('#side').scrollIntoView()"); await pg.screenshot(path=os.path.join(OUT, f"area_{tag}.png"))
    await pg.evaluate("document.querySelector('#side .au-g[data-g=market] .au-closed summary').click()")
    await pg.evaluate("()=>{ G.shopsOpen = window.__shops; }")
    await pg.evaluate("window.__ui.refresh()"); await pg.wait_for_timeout(300)
    ok(await pg.evaluate("!document.querySelector('#side .au-g[data-g=market] .au-closed')") or not await pg.evaluate("window.__shops()"), f"{tag} Area: by day nothing in Market is folded away")

async def company(pg, tag):
    r = await pg.evaluate(LNG); ok(r is None, f"{tag} Company: set up ({r})")
    await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelector('[data-act=soctab][data-id=company]').click()"); await pg.wait_for_timeout(900)
    g = await pg.evaluate("""()=>{const s=document.querySelector('#side .socseg'), m=document.querySelector('#side .socmore-d'), h=document.querySelector('#lng-root .lng-banner');
      return {gap:h.getBoundingClientRect().top-s.getBoundingClientRect().bottom, more:m?m.open:null, moreH:m?m.querySelector('summary').getBoundingClientRect().height:0}}""")
    z = await pg.evaluate(ZOOM)
    ok(g["more"] is False, f"{tag} Company: the More row is folded")
    ok(g["gap"] < 90 * z, f"{tag} Company: the longhouse hero sits right under the tab row ({g['gap']:.0f}px)")
    ok(g["moreH"] >= 44 * z - 0.5, f"{tag} Company: the More line is a 44px tap ({g['moreH']:.1f})")
    ok(await pg.evaluate(OVER, "#side") == [], f"{tag} Company: nothing sticks out {await pg.evaluate(OVER, '#side')}")
    ok(await pg.evaluate(CLIP, "#side .socseg button, #side .socmore-d summary .socmore-l, #lng-root .lng-seg button") == [], f"{tag} Company: tab names not cut off {await pg.evaluate(CLIP, '#side .socseg button, #lng-root .lng-seg button')}")
    await pg.evaluate("document.querySelector('#side').scrollIntoView()"); await pg.screenshot(path=os.path.join(OUT, f"company_{tag}.png"))
    await pg.evaluate("document.querySelector('#side .socmore-d summary').click()"); await pg.wait_for_timeout(200)
    await pg.evaluate("document.querySelector('#side .socmore [data-id=msgs]').click()"); await pg.wait_for_timeout(500)
    ok(await pg.evaluate("document.querySelector('#side .socmore-d')?.open === true"), f"{tag} Social: More stays open on Messages")

async def items(pg, cdp, tag):
    await pg.evaluate("window.__ui.openMenu('items')"); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=all]')?.click()"); await pg.wait_for_timeout(400)
    v = await pg.evaluate("""()=>{const one=document.querySelector('#sky .m2-one'), sc=document.querySelector('#sky .m2-sc'), d=document.querySelector('#sky .m2-dir');
      return {one:!!one&&one.offsetParent!==null, chips:!!sc&&sc.offsetParent!==null, oneH:one?one.getBoundingClientRect().height:0, dirH:d?d.getBoundingClientRect().height:0}}""")
    z = await pg.evaluate(ZOOM)
    ok(v["one"] and not v["chips"], f"{tag} Items: one Sort button instead of a row of chips ({v})")
    ok(v["oneH"] >= 44 * z - 0.5 and v["dirH"] >= 44 * z - 0.5, f"{tag} Items: Sort and direction are 44px taps")
    await pg.select_option("#sky select.m2-pick-s", "value"); await pg.wait_for_timeout(400)
    on = await pg.evaluate("document.querySelector('#sky .m2-sc .chip.on')?.dataset.id")
    lab = await pg.evaluate("document.querySelector('#sky .m2-one b')?.textContent")
    ok(on == "value" and lab == "Value", f"{tag} Items: picking Value sorts by value ({on}, {lab})")
    await pg.evaluate("document.querySelector('#sky .m2-dir').click()"); await pg.wait_for_timeout(300)
    ok("Low first" in (await pg.evaluate("document.querySelector('#sky .m2-dir').getAttribute('aria-label')") or ""), f"{tag} Items: the direction toggle flips")
    ok(await pg.evaluate(OVER, "#sky") == [], f"{tag} Items: nothing sticks out {await pg.evaluate(OVER, '#sky')}")
    ok(await pg.evaluate(CLIP, "#sky .m2-one b, #sky .m2-dir span") == [], f"{tag} Items: sort labels not cut off")
    await pg.screenshot(path=os.path.join(OUT, f"items_{tag}.png"))
    # hold a finger on a row: a bottom sheet, the list stays where it was
    rows = await pg.query_selector_all("#sky .sky-list .sky-row")
    el = rows[min(5, len(rows) - 1)]
    await el.scroll_into_view_if_needed()
    bb = await el.bounding_box(); x, y = bb["x"] + min(bb["width"] / 2, 60), bb["y"] + bb["height"] / 2
    before = await pg.evaluate("[scrollY, ...[...document.querySelectorAll('#sky *')].filter(e=>e.scrollTop>0).map(e=>e.scrollTop)]")
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    await pg.wait_for_timeout(800)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    await pg.wait_for_timeout(400)
    t = await pg.evaluate("""()=>{const t=document.getElementById('tip'); if(!t||!t.classList.contains('on'))return null; const r=t.getBoundingClientRect(), vv=window.visualViewport;
      return {sheet:t.classList.contains('tt-sheet'), h:r.height/(vv?vv.height:innerHeight), b:(vv?vv.height:innerHeight)-r.bottom, l:r.left, w:r.width/innerWidth, text:t.innerText.slice(0,40)}}""")
    after = await pg.evaluate("[scrollY, ...[...document.querySelectorAll('#sky *')].filter(e=>e.scrollTop>0).map(e=>e.scrollTop)]")
    ok(t is not None and t["sheet"], f"{tag} tooltip: a bottom sheet on a phone ({t})")
    if t: ok(0.34 <= t["h"] <= 0.46 and abs(t["b"]) <= 2 and abs(t["l"]) <= 1 and t["w"] > 0.99, f"{tag} tooltip: 35-45% high, at the bottom, full width ({t['h']:.2f}, {t['b']:.1f})")
    same = len(before) == len(after) and all(abs(a - b) <= 2 for a, b in zip(before, after))   # zoomed (Huge) pages round by a pixel
    ok(same, f"{tag} tooltip: the list keeps its place ({before} -> {after})")
    await pg.wait_for_timeout(2200)
    ok(await pg.evaluate("document.getElementById('tip')?.classList.contains('on')"), f"{tag} tooltip: the sheet stays to be read")
    await pg.screenshot(path=os.path.join(OUT, f"tip_{tag}.png"))
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": 20, "y": 200, "id": 3}]})
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); await pg.wait_for_timeout(300)
    ok(not await pg.evaluate("document.getElementById('tip')?.classList.contains('on')"), f"{tag} tooltip: a tap elsewhere closes the sheet")

async def main():
    srv = None
    if ARG == "0":   # our own server, with a deep accept queue (http.server's default of 5 refuses some of the ~1000 files on Windows)
        import functools, http.server, threading
        class Srv(http.server.ThreadingHTTPServer): request_queue_size = 512; daemon_threads = True
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self, *a): pass
        srv = Srv(("127.0.0.1", PORT), functools.partial(Quiet, directory=os.path.join(ROOT, "game")))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
            b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
            for w in (360, 390):
                for huge in (False, True):
                    tag = f"{w}_{'huge' if huge else 'normal'}"
                    ctx, pg, errs = await start(b, w, huge)
                    cdp = await ctx.new_cdp_session(pg)
                    await area(pg, tag)
                    await company(pg, tag)
                    await items(pg, cdp, tag)
                    ok(not errs, f"{tag}: no page errors {errs[:2]}")
                    await ctx.close()
            await b.close()
    finally:
        if srv: srv.shutdown()
    print(f"shots in {OUT}")
    print("PASS" if not fails else f"{len(fails)} FAILED")
    sys.exit(1 if fails else 0)

asyncio.run(main())
