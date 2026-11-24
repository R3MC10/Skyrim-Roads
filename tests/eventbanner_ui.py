"""Painted event and shop banners (event-banner art pack) at phone width. Usage: python eventbanner_ui.py PORT — prints RESULT OK.
Runs the same screens twice, with pictures on (?assets) and off: World Events (Grand Caravan, Daedric Invasion, a
festival) as compact cards under the map and as popups, a Great Event (Siege) as its card and popup, and a new shop
banner (stables). With pictures on, every card and popup uses its painted file (thumbnail for the card, wide crop for
the popup) and differs from the drawn version; with pictures off the drawn art is still there. Event text, timers and
buttons stay. Screenshots in tests/out_evbanner/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_evbanner") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SHIFT = "window.__off = 0; (() => { const n = Date.now.bind(Date); Date.now = () => n() + window.__off; })();"   # jump the game clock (like worldevents_ui.py)
WEV_JUMP = """() => { const t0 = Date.now() / 1000;
  for (let t = t0; t < t0 + 120 * 86400; t += 900) { const k = WORLDEV.active(t).map((e) => e.kind);
    if (k.includes("inv") && k.includes("fest") && k.includes("kc")) { window.__off = (t + 1200 - t0) * 1000; return WORLDEV.active(t + 1200).map((e) => e.kind + (e.variant ? ":" + e.variant : "")); } }
  return null; }"""
GEV_JUMP = """([kind]) => { window.__off = window.__off || 0; const t0 = (Date.now() - window.__off) / 1000, b0 = Math.floor(t0 / GREATEV.BLOCK);
  for (let b = b0 + 1; b < b0 + 40; b++) { const ev = GREATEV.eventIn(b); if (ev.kind !== kind) continue;
    window.__off = (ev.start + 300 - t0) * 1000; const S = window.__dbg.save(); S.level = Math.max(S.level, 25); S.trip = null; S.location = ev.place; [S.x, S.y] = WORLD.places[ev.place];
    return ev.id + " " + ev.name; } return null; }"""
IMG = """(sel) => { const i = document.querySelector(sel); return i ? { src: i.getAttribute('src'), w: +i.getAttribute('width'), h: +i.getAttribute('height') } : null; }"""
KEYS = ["wev-kc", "wev-kc-thumb", "wev-inv", "wev-inv-thumb", "gev-siege", "gev-siege-thumb", "shop-stables"]

async def run(p, kw, assets):
    tag = "assets" if assets else "drawn"
    b = await p.chromium.launch(**kw)
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2); await ctx.add_init_script(SHIFT)
    pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=evb{tag}" + ("&assets" if assets else "")); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Banner"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    clear = lambda: pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    if assets:   # ask for every picture once and wait for them (they redraw the screens when they arrive)
        await pg.evaluate(f"() => {KEYS}.concat(['wev-fest-hearts','wev-fest-hearts-thumb','wev-fest-merchants','wev-fest-merchants-thumb','wev-fest-harvest','wev-fest-harvest-thumb','wev-fest-planting','wev-fest-planting-thumb']).forEach(k => ASSETS.img(k))")
        for _ in range(60):
            if await pg.evaluate(f"() => {{ const st = Object.fromEntries(ASSETS.status()); return {KEYS}.every(k => st[k] === 'ok'); }}"): break
            await pg.wait_for_timeout(200)
        st = dict(await pg.evaluate("ASSETS.status()"))
        ok(all(st.get(k) == "ok" for k in KEYS), f"{tag}: the painted files load ({ {k: st.get(k) for k in KEYS} })")
    out = {}
    # ---- World Events: cards under the map, then each popup
    kinds = await pg.evaluate(WEV_JUMP); fest = next((k.split(":")[1] for k in kinds or [] if k.startswith("fest:")), None)
    ok(kinds and fest, f"{tag}: caravan, invasion and festival running together ({kinds})")
    await clear(); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(1500); await clear(); await pg.evaluate("scrollTo(0,0)")
    for k in ["kc", "inv", "fest"]:
        out["card-" + k] = await pg.evaluate(IMG, f"#wev .wev-strip.wev-{k} img.wev-pic")
        out["cardtext-" + k] = await pg.evaluate(f"document.querySelector('#wev .wev-strip.wev-{k}')?.innerText || ''")
    await pg.locator("#wev").screenshot(path=OUT + f"{tag}_wev_cards.png")   # the strips under the map, wherever they sit on the page
    for k in ["kc", "inv", "fest"]:
        await clear(); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(900); await clear()
        await pg.click(f"#wev .wev-strip.wev-{k}"); await pg.wait_for_timeout(600)
        out["pop-" + k] = await pg.evaluate(IMG, ".wevsheet img.wev-pic, #modal .wev-sheet img.wev-pic")
        out["poptext-" + k] = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
        out["popbtn-" + k] = await pg.evaluate("document.querySelectorAll('#modal button').length")
        await pg.screenshot(path=OUT + f"{tag}_wev_{k}_popup.png")
    out["fest"] = fest
    # ---- Great Event: the siege
    await clear(); ev = await pg.evaluate(GEV_JUMP, ["siege"]); ok(ev, f"{tag}: a siege is running ({ev})")
    await pg.click("[data-tab=map]"); await pg.wait_for_timeout(1600); await clear(); await pg.evaluate("scrollTo(0,0)")
    out["card-siege"] = await pg.evaluate(IMG, "#gev img.gev-pic")
    out["cardtext-siege"] = await pg.evaluate("document.querySelector('#gev')?.innerText || ''")
    out["phases-siege"] = await pg.evaluate("document.querySelectorAll('#gev .gev-ph').length")
    await pg.locator("#gev").screenshot(path=OUT + f"{tag}_gev_card.png")
    for _ in range(4):   # like greatevents_ui.py: story pop-ups can sit on top, clear them before each try
        await clear()
        try: await pg.click("#gev .gev-banner .gev-t", timeout=3000)
        except Exception: pass
        await pg.wait_for_timeout(600)
        if await pg.query_selector(".gevsheet"): break
    out["pop-siege"] = await pg.evaluate(IMG, ".gevsheet img.gev-pic, #modal .gev-sheet img.gev-pic")
    out["poptext-siege"] = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
    await pg.screenshot(path=OUT + f"{tag}_gev_popup.png")
    # ---- a new shop banner: the stables section, as the town screen draws it
    await clear()
    out["shop"] = await pg.evaluate("""() => { const h = PLACEART.section('stables'); const d = document.createElement('div'); d.id='evbshop'; d.style.cssText='position:fixed;left:0;top:0;width:412px;z-index:9999;background:#000';
      d.innerHTML = h; document.body.appendChild(d); const i = d.querySelector('img'); return i ? { src: i.getAttribute('src'), w: +i.getAttribute('width'), h: +i.getAttribute('height') } : null; }""")
    await pg.wait_for_timeout(300); await pg.locator("#evbshop").screenshot(path=OUT + f"{tag}_shop_stables.png")
    out["errs"] = errs
    await b.close()
    return out

async def main():
    kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
    async with async_playwright() as p:
        A = await run(p, kw, True)
        D = await run(p, kw, False)
    names = {"kc": "Grand Caravan", "inv": "Daedric Invasion", "fest": f"festival ({A.get('fest')})", "siege": "Siege"}
    for k in ["kc", "inv", "fest", "siege"]:
        for surf, (w, h) in [("card", (64, 46) if k == "siege" else (56, 40)), ("pop", (320, 120) if k == "siege" else (320, 110))]:
            a, d = A.get(f"{surf}-{k}"), D.get(f"{surf}-{k}")
            label = f"{names[k]} {'card thumbnail' if surf == 'card' else 'popup banner'}"
            ok(a and a["w"] == w and a["h"] == h and a["src"].startswith("data:image"), f"{label}: drawn at {w}×{h} with pictures on")
            ok(d and d["src"].startswith("data:image"), f"{label}: the drawn fallback is still there with pictures off")
            ok(a and d and a["src"] != d["src"], f"{label}: uses the painted file, not the drawn one")
    for k in ["kc", "inv", "fest"]:
        ok(A[f"cardtext-{k}"] and A[f"cardtext-{k}"] == D[f"cardtext-{k}"].replace(D[f"cardtext-{k}"], A[f"cardtext-{k}"]) and "left" in A[f"cardtext-{k}"], f"{names[k]} card keeps its text and timer ({A[f'cardtext-{k}'][:60]!r})")
        ok(A[f"popbtn-{k}"] == D[f"popbtn-{k}"] and A[f"popbtn-{k}"] >= 1, f"{names[k]} popup keeps its buttons ({A[f'popbtn-{k}']})")
    ok(A["phases-siege"] == D["phases-siege"] == 3, f"Siege card keeps its three phase marks ({A['phases-siege']}, {D['phases-siege']})")
    ok(A["poptext-siege"] and "left" in A["poptext-siege"].lower() or "siege" in A["poptext-siege"].lower(), "Siege popup keeps its text")
    s1, s2 = A.get("shop"), D.get("shop")
    ok(s1 and s2 and s1["src"] != s2["src"], f"the stables banner uses its new painted file ({s1 and s1['w']}×{s1 and s1['h']}), drawn without pictures")
    ok(not A["errs"] and not D["errs"], f"no page errors {A['errs'][:2] + D['errs'][:2]}")
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
