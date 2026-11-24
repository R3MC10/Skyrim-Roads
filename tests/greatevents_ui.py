"""Great world events on screen (greatevents.js): the banner with its countdown, the map markers, the event sheets,
a charge at the dragon, the fair games and a burned town rebuilding. Phone (390x844) and desktop (1920x1080),
ink and pixel art styles.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/greatevents_ui.py   (screenshots land in tests/out_gev/)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "out_gev"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9400, 9500):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9400-9499")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else free_port()
SHIFT = "window.__off = 0; (() => { const n = Date.now.bind(Date); Date.now = () => n() + window.__off; })();"
# jump the clock to the next event of a kind: at = "warn" | "on" | "after"; put the hero at the place
JUMP = """([kind, at]) => {
  const t0 = (Date.now() - window.__off) / 1000, b0 = Math.floor(t0 / GREATEV.BLOCK);
  for (let b = b0 + 1; b < b0 + 20; b++) { const ev = GREATEV.eventIn(b); if (ev.kind !== kind) continue;
    const t = at === "warn" ? ev.warn + 120 : at === "on" ? ev.start + 300 : ev.end + 6 * 3600;
    window.__off = (t - t0) * 1000;
    const S = window.__dbg.save(); S.level = Math.max(S.level, 25); S.trip = null; S.location = ev.place; [S.x, S.y] = WORLD.places[ev.place];
    G.setHealth(S, G.maxHealth(S)); return ev.id + " " + ev.name; }
  return null; }"""

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag in [(390, 844, "phone"), (1920, 1080, "desktop")]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 800 else 1)
                await ctx.add_init_script(SHIFT)
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                async def shot(name, el=None):
                    path = os.path.join(OUT, f"gev_{tag}_{name}.png")
                    if el: await el.screenshot(path=path)
                    else: await pg.screenshot(path=path)
                    shots.append(path)
                async def open_sheet():
                    for _ in range(4):
                        await clear()
                        try: await pg.click("#gev .gev-banner .gev-t", timeout=3000)
                        except Exception: continue
                        await pg.wait_for_timeout(600)
                        if await pg.query_selector(".gevsheet"): return
                async def to_map():
                    await clear(); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(900); await clear()
                await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=gev{tag}"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                for st in ["ink", "pixel"]:
                    await pg.evaluate(f"() => {{ ART.setStyle('{st}'); document.documentElement.classList.toggle('art-pixel', '{st}' === 'pixel'); }}")
                    # 1. warning: banner with a countdown that ticks
                    ev = await pg.evaluate(JUMP, ["dragon", "warn"]); print(tag, st, "warn:", ev)
                    await pg.wait_for_timeout(1600); await to_map(); await pg.wait_for_timeout(1200)
                    ban = await pg.query_selector("#gev .gev-banner")
                    check(ban is not None, f"{tag}/{st}: banner for the coming dragon")
                    if ban:
                        c1 = await pg.evaluate("document.querySelector('#gev .gev-clock b')?.textContent"); await pg.wait_for_timeout(1300)
                        c2 = await pg.evaluate("document.querySelector('#gev .gev-clock b')?.textContent")
                        check(bool(c1) and c1 != c2, f"{tag}/{st}: the countdown ticks ({c1} -> {c2})")
                        await ban.scroll_into_view_if_needed(); await shot(f"{st}_warn_banner", ban)
                    # 2. the dragon attacks: banner with phases, map marker, sheet, a charge
                    ev = await pg.evaluate(JUMP, ["dragon", "on"]); print(tag, st, "on:", ev)
                    await pg.wait_for_timeout(1600); await to_map(); await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(1500)
                    await shot(f"{st}_dragon_map")
                    check(await pg.evaluate("document.querySelectorAll('#gev .gev-ph').length") == 3, f"{tag}/{st}: three phases on the banner")
                    await open_sheet()
                    check(await pg.query_selector(".gevsheet") is not None, f"{tag}/{st}: the dragon sheet opens")
                    await shot(f"{st}_dragon_sheet");
                    if st == "ink":
                        fb = await pg.query_selector(".gevsheet [data-gev=fight]")
                        check(fb is not None, f"{tag}: a Charge button at the town")
                        if fb:
                            await fb.click(); await pg.wait_for_timeout(1800)
                            txt = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
                            check(len(txt) > 20, f"{tag}: a charge plays out")
                            await shot("fight_result")
                            check(await pg.evaluate("(() => { const S = window.__dbg.save(), ev = GREATEV.current(Date.now()/1000); return (S.gev?.[ev.id]?.p || 0) > 0; })()"), f"{tag}: the charge counts for everyone")
                    await clear()
                    # 3. a rift and a siege: their sheets
                    for k in ["rift", "siege"]:
                        ev = await pg.evaluate(JUMP, [k, "on"]); print(tag, st, k + ":", ev)
                        await pg.wait_for_timeout(1400); await to_map()
                        await open_sheet()
                        check(await pg.query_selector(".gevsheet") is not None, f"{tag}/{st}: the {k} sheet opens")
                        await shot(f"{st}_{k}_sheet"); await clear()
                    # 4. the fair: play a game, see the prize stall
                    ev = await pg.evaluate(JUMP, ["fair", "on"]); print(tag, st, "fair:", ev)
                    await pg.wait_for_timeout(1400); await to_map(); await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(1200)
                    await shot(f"{st}_fair_map")
                    await open_sheet()
                    pb = await pg.query_selector(".gevsheet [data-gev=play][data-game=drink]")
                    check(pb is not None and await pb.is_enabled(), f"{tag}/{st}: fair games to play")
                    if pb: await pb.click(); await pg.wait_for_timeout(700)
                    check(await pg.evaluate("(() => { const S = window.__dbg.save(), ev = GREATEV.current(Date.now()/1000); return (S.gev?.[ev.id]?.f || 0) > 0; })()"), f"{tag}/{st}: a fair game scores points")
                    # other events' aftermath (a plundered hold...) also moves prices, so compare with the hour before the fair opened
                    pm = await pg.evaluate("(() => { const S = window.__dbg.save(), t = Date.now() / 1000, ev = GREATEV.current(t); return GREATEV.priceMult(S, S.location, t) / GREATEV.priceMult(S, S.location, ev.warn + 60); })()")
                    check(pm < 0.8, f"{tag}/{st}: shops are a quarter cheaper at the fair (x{pm:.2f})")
                    await shot(f"{st}_fair_sheet"); await clear()
                    # 5. what's left behind: a burned town rebuilding
                    ev = await pg.evaluate("""() => { const t0 = (Date.now() - window.__off) / 1000, b0 = Math.floor(t0 / GREATEV.BLOCK);
                      for (let b = b0 + 2; b < b0 + 30; b++) { const ev = GREATEV.eventIn(b); if (ev.kind !== 'dragon') continue; const nx = GREATEV.eventIn(b + 1);
                        const t = Math.min(ev.end + 8 * 3600, nx.warn - 60); window.__off = (t - t0) * 1000; const S = window.__dbg.save(); S.location = ev.place; [S.x, S.y] = WORLD.places[ev.place]; return ev.name; } }""")
                    await pg.wait_for_timeout(1500); await to_map(); await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(1300)
                    check(await pg.evaluate("document.querySelectorAll('#gev .gev-after').length") >= 1, f"{tag}/{st}: the burned town shows under the map ({ev})")
                    await shot(f"{st}_aftermath")
                    g = await pg.query_selector("#gev")
                    if g: await g.scroll_into_view_if_needed(); await shot(f"{st}_aftermath_card", g)
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    print("screenshots:"); [print("  " + s) for s in shots]
    print("errors:", errs)
    if errs or bad: raise SystemExit(1)
    print("greatevents_ui ok")

asyncio.run(main())
