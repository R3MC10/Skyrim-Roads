"""Everyone on the same version (samever.js + the title screen's Updates page in ui.js), web version.
GitHub's "latest release" is stubbed, so nothing leaves the machine. On PC 1920x1080 and phone 390x844:
the Updates page shows your build and the newest build, "Check again" really asks again, a failed check shows
the reason and Retry, the downloading and ready states, and a newer build on the title screen reloads the page
onto it (?rv=184). In the game: the small "Update ready" card and the "Update to play together" card.
LANG_UI=pl runs it in Polish.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/samever_ui.py [PORT]   (screenshots in tests/out_samever/ or $OUT)"""
import asyncio, json, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("OUT") or os.path.join(ROOT, "tests", "out_samever"); os.makedirs(OUT, exist_ok=True)
LANG = os.environ.get("LANG_UI", "en")

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else free_port()
GH = {"mode": 183, "asked": 0}   # what the fake GitHub answers: a build number, or "down"

async def github(route):
    GH["asked"] += 1
    if GH["mode"] == "down": await route.fulfill(status=403, content_type="application/json", body='{"message":"rate limited"}'); return
    await route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"},
                        body=json.dumps({"tag_name": f"build-{GH['mode']}", "published_at": "2026-11-25T10:00:00Z"}))

PANEL = """() => { const h = document.querySelector('#title'); const s = document.querySelector('#updst');
  return { txt: h ? h.textContent : '', head: s ? s.innerText : '', err: !!document.querySelector('#title .err'),
    retry: [...document.querySelectorAll('#title [data-t=update]')].map((b) => b.textContent.trim()),
    bar: !!document.querySelector('#title #ubar'), ready: !!document.querySelector('#title [data-t=sameready]') } }"""

async def main():
    srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(c, what):
        print(("ok   " if c else "FAIL ") + what)
        if not c: bad.append(what)
    pl = LANG == "pl"
    T = (lambda en, plt: plt if pl else en)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag in [(1920, 1080, "pc"), (390, 844, "phone")]:
                GH.update(mode=183, asked=0)
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1 if vw > 800 else 2, has_touch=vw < 800, is_mobile=vw < 800)
                await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{obTips:false,lang:'{LANG}'}}))")
                await ctx.route("https://api.github.com/**", github)
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                async def shot(name):
                    path = os.path.join(OUT, f"samever_{tag}_{name}{'_pl' if pl else ''}.png"); await pg.screenshot(path=path); shots.append(path)
                async def panel(): return await pg.evaluate(PANEL)
                for _ in range(4):
                    errs.clear()
                    try:
                        await pg.goto(f"http://localhost:{PORT}/index.html?notut&hub=0&vercheck=1&rv=183&p=samever{tag}")
                        await pg.wait_for_selector(".press", timeout=15000); await pg.wait_for_timeout(500)
                        if not errs and not await pg.evaluate("typeof SAMEVER !== 'undefined'"): errs.append("samever.js didn't load")
                        if errs: raise Exception(errs[0])
                        break
                    except Exception as ex: print("title didn't come up, reloading:", str(ex)[:120])
                check(await pg.evaluate("SAMEVER.state.platform") == "web" and await pg.evaluate("SAMEVER.state.mine") == 183, f"{tag}: the web game knows it is on build 183 (from ?rv=183)")
                await pg.click(".press"); await pg.wait_for_timeout(400)
                await pg.click(".mi[data-t=update]"); await pg.wait_for_timeout(1500)
                s = await panel()
                check("183" in s["head"] and s["head"].count("183") >= 2, f"{tag}: the panel shows your build and the newest build ({s['head']!r})")
                check(T("You have the newest version", "Masz najnowszą wersję") in s["txt"] and not s["err"], f"{tag}: up to date")
                await shot("uptodate")
                # Check again really asks again; GitHub down -> reason + Retry
                GH["mode"] = "down"; n0 = GH["asked"]
                await pg.click("#title [data-t=update]"); await pg.wait_for_timeout(1500)
                s = await panel()
                check(GH["asked"] > n0, f"{tag}: Check again really asked GitHub again ({GH['asked'] - n0} request)")
                check(s["err"] and s["retry"] == [T("Retry", "Spróbuj ponownie")], f"{tag}: a failed check shows the reason and a Retry button ({s['retry']})")
                check("403" in s["txt"] or "rate" in s["txt"], f"{tag}: the error says what went wrong")
                await shot("error")
                # Retry works once GitHub is back
                GH["mode"] = 183
                await pg.click("#title [data-t=update]"); await pg.wait_for_timeout(1500)
                s = await panel()
                check(not s["err"] and T("You have the newest version", "Masz najnowszą wersję") in s["txt"], f"{tag}: Retry clears the error")
                # downloading
                await pg.evaluate("SAMEVER.set({ dl: { build: 184, pct: 40 } })"); await pg.wait_for_timeout(400)
                s = await panel()
                check(s["bar"] and "40%" in s["txt"] and "184" in s["txt"], f"{tag}: downloading shows the build and a progress bar")
                await shot("downloading")
                await pg.evaluate("SAMEVER.set({ dl: null })")
                # ready (as the app reports a downloaded build): a Restart now button that switches over
                await pg.evaluate("SAMEVER.ready(184, () => { window.__went = 184; }, { quiet: true })"); await pg.wait_for_timeout(400)
                s = await panel()
                check(s["ready"] and T("Restart now", "Uruchom ponownie") in s["txt"], f"{tag}: a downloaded build shows Restart now")
                await shot("ready")
                await pg.click("#title [data-t=sameready]"); await pg.wait_for_timeout(500)
                check(await pg.evaluate("window.__went") == 184, f"{tag}: Restart now switches over")
                await pg.evaluate("SAMEVER.set({ ready: null })")
                # a newer build out while on the title screen: the web version reloads onto it, no questions
                GH["mode"] = 184
                await pg.click('#title [data-t=update]')
                try: await pg.wait_for_url("**rv=184**", timeout=10000); went = True
                except Exception: went = False; print(await pg.evaluate("JSON.stringify({ st: SAMEVER.state, safe: __ui.safeToUpdate(), page: document.querySelector('#title')?.textContent.slice(-300) })"))
                check(went, f"{tag}: on the title screen a newer build reloads the page onto it ({pg.url.split('?')[-1]})")
                await pg.wait_for_selector("#title", timeout=15000); await pg.wait_for_timeout(1500)
                check(await pg.evaluate("SAMEVER.state.mine") == 184, f"{tag}: after the reload the game is on build 184")
                await shot("reloaded")
                # in the game: start a character, then the cards
                await pg.evaluate("document.querySelector('.press')?.click()"); await pg.wait_for_timeout(300)
                await pg.click(".mi[data-t=new]", timeout=5000); await pg.wait_for_selector("#nm", timeout=5000)
                await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate("SAMEVER.ready(185, () => { window.__went = 185; }, { web: true })"); await pg.wait_for_timeout(500)
                card = await pg.evaluate("(() => { const c = document.querySelector('#samever'); if (!c) return null; const r = c.getBoundingClientRect(); return { t: c.textContent, x: r.left, y: r.top, w: r.width, h: r.height }; })()")
                check(card is not None and T("Reload now", "Odśwież teraz") in card["t"] and card["x"] >= 0 and card["x"] + card["w"] <= vw and card["y"] + card["h"] <= vh,
                      f"{tag}: during play a small Update ready card offers Reload now, on screen ({card and {k: round(v) for k, v in card.items() if k != 't'}})")
                check(not await pg.evaluate("window.__went === 185") and "rv=184" in pg.url, f"{tag}: during play it doesn't reload by itself")
                await shot("ingame_ready")
                await pg.evaluate("SAMEVER.closeCard(); SAMEVER.set({ ready: null })")
                await pg.evaluate("SAMEVER.blockWith({ build: 190, name: 'Kacper' }, 'Kacper')"); await pg.wait_for_timeout(400)
                txt = await pg.evaluate("document.querySelector('#samever')?.textContent || ''")
                check(T("Update to play together", "Zaktualizuj, żeby grać razem") in txt and "190" in txt and T("Update", "Aktualizuj") in txt, f"{tag}: a friend on a newer build -> Update to play together with an Update button")
                await shot("ingame_behind")
                await pg.evaluate("SAMEVER.closeCard(); SAMEVER.blockWith({ build: 170, name: 'Kacper' }, 'Kacper')"); await pg.wait_for_timeout(400)
                txt = await pg.evaluate("document.querySelector('#samever')?.textContent || ''")
                check(T("Different versions", "Różne wersje") in txt and "170" in txt, f"{tag}: a friend on an older build -> the invite says why")
                check(await pg.evaluate("SAMEVER.blockWith({ name: 'Old' }, 'Old')") is False and await pg.evaluate("SAMEVER.blockWith({ build: 184 }, 'Same')") is False,
                      f"{tag}: same build or an old game without a build never blocks")
                await pg.evaluate("SAMEVER.closeCard()")
                if pl:
                    left = await pg.evaluate("[...document.querySelectorAll('#samever, #title')].map(e => e.textContent).join(' ')")
                    check("Update ready" not in left, f"{tag}: Polish has no English left on the cards")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    print(f"page errors: {errs[:3]}" if errs else "no page errors")
    if errs: bad.append("page errors")
    print("shots:", *shots, sep="\n  ")
    print("FAILED: " + "; ".join(bad) if bad else "samever_ui: all ok")
    sys.exit(1 if bad else 0)

asyncio.run(main())
