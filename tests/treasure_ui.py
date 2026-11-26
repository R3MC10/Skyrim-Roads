"""Treasure maps and relics (treasure.js) in the browser: phone (390x844) and PC (1280x800), with the painted assets
(?assets). LANG_UI=pl for Polish. Usage: python treasure_ui.py PORT -> RESULT OK
Opens a treasure map from the pack (item details, Look at it: the ink sketch), pins it next to the world map (the
compare), digs at the wrong spot (nothing, a short rest), then at the right one (the find), and shows the Travel tab's
Treasure hunt card with torn pieces and a sealed tomb. Screenshots: tests/out_treasure/ (or OUT=dir)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LANG = os.environ.get("LANG_UI", "en")
WORDS = {"en": ["Treasure hunt", "Nothing here", "Buried treasure"], "pl": ["Poszukiwanie skarbu", "Nic tu nie ma", "Zakopany skarb"]}[LANG]
OUT = os.environ.get("OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_treasure")
OUT = OUT.rstrip("/\\") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

SEED = "inkmap7"
SETUP = """(seed) => { const S = window.__dbg.save(); S.gold = 5000; S.level = 24; S.trip = null; S.dungeon = null;
  S.inv = S.inv.filter((r) => !/^t(map|jour|frag)\\|/.test(r.item));
  G.give(S, 'tmap|' + seed); G.give(S, 'tfrag|piece22|1|3'); G.give(S, 'tfrag|piece22|2|3'); G.give(S, 'relic_nord_frag', 2);
  S.location = 'Rorikstead'; [S.x, S.y] = WORLD.places['Rorikstead']; G.setHealth(S, G.maxHealth(S)); window.__dbg.publish();
  return S.inv.find((r) => r.item === 'tmap|' + seed).id; }"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        errs = []
        for dev in ["phone", "pc"]:
            name = dev + ("" if LANG == "en" else "_" + LANG)
            vp = {"width": 390, "height": 844} if dev == "phone" else {"width": 1280, "height": 800}
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if dev == "phone" else 1, has_touch=dev == "phone")
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{obTips:false,lang:'{LANG}'}}))")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=tm{name}"); await pg.wait_for_timeout(2000)
            try: await pg.wait_for_selector(".press", timeout=60000)
            except Exception: await pg.reload(); await pg.wait_for_selector(".press", timeout=120000)
            await pg.click(".press")
            await pg.wait_for_selector(".mi[data-t=new]", timeout=30000); await pg.click(".mi[data-t=new]")
            await pg.wait_for_selector("#nm", timeout=30000); await pg.fill("#nm", "Digger"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content="#pbanners,.pban,.pburst,.pgold,.toast,#toast{display:none!important}")
            rid = await pg.evaluate(SETUP, SEED)
            ok(rid is not None, f"{name}: a treasure map in the pack")
            async def clean(): await pg.evaluate("() => document.querySelectorAll('#modal,.modal,#xgame,.obtip,.toast,#toast,.pban').forEach(m => m.remove())")
            async def tab(t):
                await clean()
                await pg.evaluate(f"() => {{ const b = document.querySelector('[data-tab={t}]'); if (b) b.click(); }}"); await pg.wait_for_timeout(700)
            async def shot(fn, sel=None):
                await pg.wait_for_timeout(500)
                if sel: await pg.evaluate(f"() => document.querySelector(\"{sel}\")?.scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT + fn)
            # 1. the Travel tab: the Treasure hunt card
            await tab("world")
            await pg.evaluate("() => window.__ui.refresh()"); await pg.wait_for_timeout(400)
            card = await pg.query_selector(".tmcard")
            ok(card is not None, f"{name}: Treasure hunt card on the Travel tab")
            txt = await pg.evaluate("() => document.querySelector('.tmcard')?.textContent || ''")
            vis = await pg.evaluate("() => { const r = document.querySelector('.tmcard')?.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null; }")
            ok(WORDS[0].lower() in txt.lower(), f"{name}: card title ({WORDS[0]}), size {vis}")
            if vis and vis[0] > 0: await shot(f"{name}_1_card.png", ".tmcard")   # on a PC the Travel panel lives behind the full-screen map
            # 2. Look at it: the ink sketch
            for _ in range(3):   # another system's popup can land on top first: clear it and look again
                await clean(); await pg.evaluate(f"() => document.querySelector('.tmcard [data-tm=look][data-id=\"tmap|{SEED}\"]').click()"); await pg.wait_for_timeout(900)
                img = await pg.query_selector("#modal .tm-sheet img")
                if img: break
            ok(img is not None, f"{name}: the sketch opens")
            if img:
                w = await pg.evaluate("() => document.querySelector('#modal .tm-sheet img').naturalWidth")
                ok(w >= 300, f"{name}: the sketch is drawn ({w}px)")
            ok(await pg.query_selector("#modal [data-tm=dig]") is not None, f"{name}: Dig here right from the map window")
            await shot(f"{name}_2_sketch.png")
            try: await pg.locator("#modal .tm-sheet img").screenshot(path=OUT + f"{name}_2_sketch_only.png", timeout=5000)
            except Exception as e: print("  (sketch close-up skipped:", str(e)[:60], ")")
            # 3. pin it next to the world map (the compare)
            await pg.evaluate(f"() => {{ const b = document.querySelector('#modal [data-tm=pin]'); if (b) b.click(); else TREASURE.pin('tmap|{SEED}'); }}"); await pg.wait_for_timeout(900)
            ok(await pg.query_selector("#tmpin img") is not None, f"{name}: the sketch is pinned over the map")
            t = await pg.evaluate(f"() => TREASURE.target('{SEED}')")
            await pg.evaluate(f"() => {{ try {{ window.__ui?.jump?.({{ place: '{t['anchor']}', tab: 'map' }}); }} catch (e) {{}} }}"); await pg.wait_for_timeout(900)
            await pg.evaluate("() => document.querySelectorAll('#modal,.toast').forEach(m => m.remove())")
            pinr = await pg.evaluate("() => { const e = document.querySelector('#tmpin'); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), getComputedStyle(e).zIndex]; }")
            ok(pinr is not None and pinr[2] > 100, f"{name}: the pinned sketch stays on screen while you look at the map {pinr}")
            await shot(f"{name}_3_compare.png")
            await pg.evaluate("() => document.querySelector('#tmpin [data-tm=unpin]').click()"); await pg.wait_for_timeout(300)
            ok(await pg.query_selector("#tmpin") is None, f"{name}: unpinned")
            # 4. dig at the wrong spot
            await tab("world")
            await pg.evaluate("() => { const S = window.__dbg.save(); S.location = null; S.trip = null; S.x = 0.2; S.y = 0.2; window.__dbg.publish(); window.__ui.refresh(); }"); await pg.wait_for_timeout(500)
            await pg.evaluate("() => document.querySelector('.tmcard [data-tm=dig]').click()"); await pg.wait_for_timeout(700)
            txt = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
            ok(WORDS[1].lower() in txt.lower(), f"{name}: wrong spot, nothing here")
            await shot(f"{name}_4_wrong.png")
            # 5. dig at the right spot
            await pg.evaluate(f"""() => {{ const S = window.__dbg.save(); const t = TREASURE.target('{SEED}'); S.x = t.pos[0]; S.y = t.pos[1]; S.tre.rest = 0; window.__dbg.publish(); }}""")
            await tab("world"); await pg.evaluate("() => window.__ui.refresh()"); await pg.wait_for_timeout(400)
            await pg.evaluate("() => document.querySelector('.tmcard [data-tm=dig]').click()"); await pg.wait_for_timeout(800)
            txt = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
            ok(WORDS[2].lower() in txt.lower(), f"{name}: right spot, the find ({txt[:80]!r})")
            await shot(f"{name}_5_found.png")
            # 6. a torn piece in the pack (item details: Look) and the pieces side by side
            await clean()
            await pg.evaluate("() => { const S = window.__dbg.save(); const r = S.inv.find((x) => x.item.startsWith('tfrag|')); window.__dbg.publish(); document.body.insertAdjacentHTML('beforeend', `<button id=tmt data-tm=look data-id='${r.item}' style='display:none'></button>`); document.querySelector('#tmt').click(); }"); await pg.wait_for_timeout(800)
            ok(await pg.query_selector("#modal .tm-pieces img") is not None, f"{name}: torn pieces drawn")
            await shot(f"{name}_6_pieces.png")
            await ctx.close()
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + str(len(fails)))
    sys.exit(1 if fails else 0)

asyncio.run(main())
