"""The shared world through the server (phase 2), in the browser. Usage: python world_ui.py GAME_PORT SERVER_PORT — prints RESULT OK.
Start the server first: (cd server && PORT=8788 node src/index.js)
Two devices on two accounts (Remi, Kacper) sign in: both use the server world, see each other online, and a chat line
and a public card written on one show up on the other. A third device that never signed in stays phone-to-phone and
doesn't see them. Remi takes over on a new device: the old one gets the "playing on another device" notice at once
(the server closes its world connection; no waiting for the heartbeat). Signing out switches back to phone-to-phone."""
import asyncio, sys, os
from playwright.async_api import async_playwright
GP = sys.argv[1] if len(sys.argv) > 1 else "8901"
SP = sys.argv[2] if len(sys.argv) > 2 else "8788"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
url = lambda dev, srv=True: f"http://localhost:{GP}/index.html?net=bc&notut&p={dev}" + (f"&server=http://localhost:{SP}" if srv else "")
TAG = str(os.getpid() % 100000)

async def menu(pg):
    for _ in range(40):
        if await pg.query_selector(".press"): await pg.click(".press"); break
        if await pg.query_selector(".mi"): break
        await pg.wait_for_timeout(150)
    await pg.wait_for_selector(".mi", timeout=8000)

async def make(pg, dev, name, user, srv=True):
    """a fresh device with a character; signed up (and uploaded) when user is given"""
    await pg.goto(url(dev, srv)); await menu(pg)
    await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    if not user: return
    await pg.goto(url(dev)); await menu(pg)
    await pg.click(".mi[data-t=account]"); await pg.click("[data-acct=mode-up]")
    await pg.fill("#acu", user); await pg.fill("#acp", "dragonborn1"); await pg.fill("#acp2", "dragonborn1"); await pg.click("[data-acct=register]")
    await pg.wait_for_selector("[data-acct=upload]", timeout=8000); await pg.click("[data-acct=upload]"); await pg.wait_for_selector(".acchar.here", timeout=8000)
    await pg.click(".page [data-t=menu]"); await pg.click(".mi[data-t=continue]"); await pg.wait_for_timeout(1500)

LIST = """(col)=>{ let out=[]; Store.watch(col, (d)=>{ out=d; }); return out.map(x=>x.name||x.text||x.id); }"""

async def until(pg, js, arg=None, ms=8000):
    for _ in range(ms // 200):
        v = await pg.evaluate(js, arg) if arg is not None else await pg.evaluate(js)
        if v: return v
        await pg.wait_for_timeout(200)
    return None

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915})
        errs = []
        def page():
            async def mk():
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); return pg
            return mk()
        R, K, X = await page(), await page(), await page()
        await make(R, "wR" + TAG, "Hrolf", "Remi" + TAG)
        await make(K, "wK" + TAG, "Kacper", "Kac" + TAG)
        ok(await R.evaluate("SERVERNET.on() && Store.mode==='p2p'"), "signed in: the world goes through the server")
        ok(await until(R, "SERVERNET.status==='connected'"), "Remi's device is connected to the server world")
        ok(await until(K, "Store.peers>=1"), "Kacper sees one player online")
        seen = await until(K, f"(()=>{{ let o=[]; Store.watch('players', d=>o=d); return o.some(x=>x.name==='Hrolf'); }})()")
        ok(seen, "…and it's Hrolf, from Remi's public card")
        await R.evaluate("Store.put('chat', 'c-" + TAG + "', { text: 'Hail from Remi', name: 'Hrolf', t: Date.now() })")
        got = await until(K, f"(()=>{{ let o=[]; Store.watch('chat', d=>o=d); return o.some(x=>x.text==='Hail from Remi'); }})()")
        ok(got, "a chat line from Remi reaches Kacper through the server")
        # a device that never signed in stays phone-to-phone: no server world
        await make(X, "wX" + TAG, "Loner", None, srv=False)
        ok(not await X.evaluate("typeof SERVERNET!=='undefined' && SERVERNET.on()"), "a signed-out device stays phone-to-phone")
        # Remi takes over on a new device: the old one is told at once
        N = await page()
        await N.goto(url("wN" + TAG)); await menu(N)
        await N.click(".mi[data-t=account]"); await N.fill("#acu", "Remi" + TAG); await N.fill("#acp", "dragonborn1"); await N.click("[data-acct=login]")
        await N.wait_for_selector("[data-acct=takeover]", timeout=8000); await N.click("[data-acct=takeover]")
        w = await until(R, "!!document.querySelector('#acctwall')", ms=5000)
        ok(w, "the old device shows 'playing on another device' within seconds (world connection closed)")
        await N.click("[data-acct=play]"); await N.wait_for_timeout(2500); await menu(N); await N.click(".mi[data-t=continue]"); await N.wait_for_timeout(1500)
        ok(await until(N, "SERVERNET.status==='connected'"), "the new device joins the server world")
        ok(await until(K, f"(()=>{{ let o=[]; Store.watch('players', d=>o=d); return o.some(x=>x.name==='Hrolf'); }})()"), "Kacper still sees Hrolf (now on the new device)")
        # signing out goes back to phone-to-phone
        await K.goto(url("wK" + TAG)); await menu(K); await K.click(".mi[data-t=account]"); await K.wait_for_selector("[data-acct=signout]"); await K.click("[data-acct=signout]"); await K.wait_for_timeout(600)
        ok(await K.evaluate("!SERVERNET.on()"), "signed out: back to phone-to-phone")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
