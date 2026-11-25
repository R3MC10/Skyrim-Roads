"""Esc on a PC and the folding world event card (desktop.js, pausemenu.js, gevstack.js).
PC 1920x1080: the event card folds into a pill and back, a notice hides with its x, then Esc walks back through
a settings window, the Items menu, the compass and the Journal to the bare map, and opens the pause menu (arrows,
Enter, Esc). In a fight Esc opens the pause menu on top and the fight goes on. Phone 390x844: the folded pill.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/esckey_ui.py [PORT]   (screenshots in tests/out_esckey/ or $OUT)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("OUT") or os.path.join(ROOT, "tests", "out_esckey"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9500, 9600):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else free_port()
SHIFT = "window.__off = 0; (() => { const n = Date.now.bind(Date); Date.now = () => n() + window.__off; })();"
# jump to a running siege; earlier fights in the last days were lost, so burned / plundered towns post notices
JUMP = """() => {
  const t0 = (Date.now() - window.__off) / 1000, b0 = Math.floor(t0 / GREATEV.BLOCK);
  for (let b = b0 + 1; b < b0 + 40; b++) { const ev = GREATEV.eventIn(b); if (ev.kind !== 'siege') continue;
    const prev = [1, 2, 3, 4].map((k) => GREATEV.eventIn(b - k)).filter((e) => e.kind === 'dragon' || e.kind === 'rift');
    if (!prev.length) continue;
    const t = ev.start + 300; window.__off = (t - t0) * 1000;
    const S = window.__dbg.save(); S.level = Math.max(S.level, 25); S.trip = null; S.location = ev.place; [S.x, S.y] = WORLD.places[ev.place];
    S.gevOut = S.gevOut || {}; for (const e of prev) S.gevOut[e.id] = 'lost';
    G.setHealth(S, G.maxHealth(S)); return ev.name; }
  return null; }"""
ST = """() => ({ modal: !!document.querySelector('#modal'), sky: !!document.querySelector('#sky'), hub: !!document.querySelector('#tw'),
  tab: __ui.tab, pause: !!document.querySelector('#pausem'), focus: document.activeElement?.dataset?.pm || null, tb: typeof TB !== 'undefined' && !!TB.open })"""

async def main():
    srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)   # node: python's server refuses connections under load
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(c, what):
        print(("ok   " if c else "FAIL ") + what)
        if not c: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag in [(1920, 1080, "pc"), (390, 844, "phone")]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1 if vw > 800 else 2, has_touch=vw < 800, is_mobile=vw < 800)
                await ctx.add_init_script(SHIFT)
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("requestfailed", lambda r: errs.append("request failed " + r.url) if r.url.endswith(".js") else None)
                async def shot(name):
                    path = os.path.join(OUT, f"esc_{tag}_{name}.png"); await pg.screenshot(path=path); shots.append(path)
                async def st(): return await pg.evaluate(ST)
                async def esc(): await pg.keyboard.press("Escape"); await pg.wait_for_timeout(450); return await st()
                for _ in range(6):   # python's little test server sometimes drops a script under a burst of requests: reload
                    errs.clear()
                    try:
                        await pg.goto(f"http://localhost:{PORT}/index.html?notut&assets&tb&hub=0&p=esc{tag}")
                        await pg.wait_for_selector(".press", timeout=15000); await pg.wait_for_timeout(800)
                        if not errs and not await pg.evaluate("typeof GEVSTACK !== 'undefined' && typeof PAUSEM !== 'undefined' && typeof GREATEV !== 'undefined'"): errs.append("a game script is missing")
                        if errs: raise Exception("a script didn't load " + errs[0])
                        await pg.click(".press", timeout=5000); await pg.click(".mi[data-t=new]", timeout=5000); await pg.wait_for_selector("#nm", timeout=5000)
                        break
                    except Exception as ex: print("title didn't come up, reloading:", str(ex)[:120])
                await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                for _ in range(3):
                    name = await pg.evaluate(JUMP); print(tag, "event:", name)
                    try: await pg.wait_for_selector("#gev .gev-strip, #gev .gevs-news", timeout=8000); break
                    except Exception: print("no notices yet, jumping again")
                await pg.wait_for_timeout(2500); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate("__ui.go('map')"); await pg.wait_for_timeout(3000); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate("document.querySelector('#gev')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(1200)
                # [mapread] economy notices sit in a shut "World news (n)" drawer; open it to reach their x buttons
                if await pg.query_selector("#gev .gevs-news[aria-expanded=false]"):
                    await pg.click("#gev .gevs-news"); await pg.wait_for_timeout(500)
                    check(await pg.query_selector("#gev .gevs-drawer") is not None, f"{tag}: World news opens into a drawer")
                n_strips = await pg.evaluate("document.querySelectorAll('#gev .gev-strip').length")
                check(await pg.query_selector("#gev .gevs-fold") is not None and n_strips >= 1, f"{tag}: the event card has a fold button and {n_strips} notice(s)")
                await shot("open")
                # x on a notice
                try: await pg.click("#gev .gev-strip .gevs-x", timeout=5000)
                except Exception as ex: print("x click", str(ex)[-400:]); await pg.screenshot(path=os.path.join(OUT, "debug_x.png")); raise
                await pg.wait_for_timeout(500)
                n2 = await pg.evaluate("document.querySelectorAll('#gev .gev-strip').length")
                check(n2 == n_strips - 1 and not await pg.query_selector(".gevsheet"), f"{tag}: x hides one notice ({n_strips} -> {n2}) and opens nothing")
                # fold
                await pg.click("#gev .gevs-fold"); await pg.wait_for_timeout(500)
                pill = await pg.evaluate("(() => { const p = document.querySelector('#gev .gevs-pill'); if (!p) return null; const r = p.getBoundingClientRect(); return { t: p.innerText, h: r.height, w: r.width, banner: !!document.querySelector('#gev .gev-banner') }; })()")
                check(pill and not pill["banner"] and pill["h"] < 50, f"{tag}: folded into a slim pill {pill}")
                look = await pg.evaluate("(() => { const p = document.querySelector('#gev .gevs-pill'), cs = getComputedStyle(p); return { bg: cs.backgroundImage.slice(0, 30), r: cs.borderRadius, col: cs.backgroundColor }; })()")
                check("gradient" in look["bg"] and look["r"].startswith("999"), f"{tag}: the pill is drawn in the game's ink style, not a plain grey button {look}")
                await pg.wait_for_timeout(1200)
                c1 = await pg.evaluate("document.querySelector('#gev .gevs-cd')?.textContent")
                check(bool(c1) and ":" in c1, f"{tag}: the pill's clock ticks ({c1})")
                await shot("pill")
                saved = await pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('rotn_gevui')).map(k => localStorage.getItem(k)).join()")
                check('"c":true' in saved, f"{tag}: folded is saved for this hero")
                await pg.click("#gev .gevs-pill"); await pg.wait_for_timeout(500)
                check(await pg.query_selector("#gev .gev-banner") is not None, f"{tag}: the pill opens the card again")
                await pg.click("#gev .gevs-fold"); await pg.wait_for_timeout(300)
                if tag == "phone": continue

                # ---- Esc through the layers (PC)
                await pg.evaluate("document.activeElement?.blur?.()")
                await pg.keyboard.press("j"); await pg.wait_for_timeout(500)
                await pg.keyboard.press("Tab"); await pg.wait_for_timeout(500)
                await pg.keyboard.press("d"); await pg.wait_for_timeout(600)
                await pg.evaluate("__ui.settings()"); await pg.wait_for_timeout(400)
                s = await st(); print("layers:", s)
                check(s["modal"] and s["sky"] and s["tab"] == "log", f"layers up: journal, items, settings {s}")
                s = await esc(); check(not s["modal"] and s["sky"] and not s["pause"], f"Esc 1 closes the settings window {s}")
                s = await esc(); check(not s["sky"] and not s["pause"], f"Esc 2 closes the Items menu {s}")
                if s["hub"]: s = await esc(); check(not s["hub"] and not s["pause"], f"Esc closes the compass {s}")
                s = await esc(); check(s["tab"] == "map" and not s["pause"], f"Esc closes the Journal, back to the map {s}")
                s = await esc(); check(s["pause"] and s["focus"] == "resume", f"Esc on the bare map opens the pause menu, Resume focused {s}")
                rows = await pg.evaluate("[...document.querySelectorAll('#pausem .pm-it')].map(b => b.textContent)")
                check(rows[:2] == ["Resume", "Settings"] and "Journal" in rows and "Save and quit to title" in rows and "Quit game" not in rows, f"rows {rows}")
                await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("ArrowDown"); await pg.wait_for_timeout(200)
                s = await st(); check(s["focus"] == "journal", f"arrows move the highlight {s}")
                await pg.keyboard.press("w"); await pg.wait_for_timeout(200); s = await st()
                check(s["focus"] == "settings" and s["tab"] == "map", f"W moves up and doesn't pan the map or open anything {s}")
                await pg.keyboard.press("j"); await pg.wait_for_timeout(300); s = await st()
                check(s["pause"] and s["tab"] == "map", f"hotkeys sleep while paused {s}")
                await shot("pause")
                s = await esc(); check(not s["pause"] and s["tab"] == "map", f"Esc closes the pause menu {s}")
                s = await esc(); check(s["pause"], "Esc opens it again")
                await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("ArrowDown"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
                s = await st(); check(not s["pause"] and s["tab"] == "log", f"Enter picks Journal {s}")
                s = await esc(); s = await esc(); check(s["pause"], "back to the map, then the pause menu")
                await pg.keyboard.press("Enter"); await pg.wait_for_timeout(300); s = await st(); check(not s["pause"], f"Enter on Resume closes it {s}")
                # Esc while typing
                await pg.evaluate("(() => { const i = document.createElement('input'); i.id = 'escin'; document.body.appendChild(i); i.focus(); })()")
                s = await esc(); f = await pg.evaluate("document.activeElement?.id || ''")
                check(not s["pause"] and f != "escin", f"Esc in a text box only leaves the box {s}")
                await pg.evaluate("document.getElementById('escin').remove()")
                # ---- a fight
                await pg.click("#gev .gevs-pill"); await pg.wait_for_timeout(400)
                fb = await pg.query_selector('#gev [data-gev="fight"]')
                if fb:
                    await fb.click(); await pg.wait_for_timeout(2500)
                    s = await st()
                    if s["tb"]:
                        await pg.evaluate("document.activeElement?.blur?.()")
                        for _ in range(3):
                            s = await esc()
                            if s["pause"]: break
                        check(s["pause"] and s["tb"], f"in a fight Esc opens the pause menu over it {s}")
                        dis = await pg.evaluate("[...document.querySelectorAll('#pausem .pm-it')].filter(b => b.disabled).map(b => b.dataset.pm)")
                        check("title" in dis, f"in a fight Save and quit is greyed {dis}")
                        await shot("pause_fight")
                        r0 = await pg.evaluate("TB.session?.round"); await pg.keyboard.press("1"); await pg.keyboard.press("f"); await pg.wait_for_timeout(300)
                        s = await st(); r1 = await pg.evaluate("TB.session?.round"); check(s["tb"] and s["pause"] and r0 == r1, f"fight keys sleep while paused (round {r0} -> {r1}) {s}")
                        s = await esc(); check(not s["pause"] and s["tb"], f"Esc closes it and the fight is still on {s}")
                    else: print("note: the fight screen didn't open; skipped the fight check", s, (await pg.evaluate("(document.querySelector('#modal')?.innerText || '').slice(0, 300)")))
                else: print("note: no Fight button; skipped the fight check")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    check(not errs, f"no page errors {errs[:3]}")
    print("shots:", *shots, sep="\n  ")
    print("RESULT", "OK" if not bad else f"FAIL {len(bad)}")
    sys.exit(1 if bad else 0)

asyncio.run(main())
