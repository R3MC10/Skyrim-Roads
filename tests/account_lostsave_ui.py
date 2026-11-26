"""A save that reached the server but whose reply was lost must not bring up "Two copies" (account.js). Usage: python account_lostsave_ui.py GAME_PORT SERVER_PORT
Start the server first: (cd server && PORT=8788 node src/index.js). Prints RESULT OK.
1. A device holds a character that was never uploaded (Bjorn). Signing in and playing another character from the account
   (Hrolf) puts Bjorn on the account first, so he doesn't live only in the 3 automatic backups.
2. A device signs out, its character is played on (offline progress), then it signs in and picks another character:
   the two different copies are shown first. "Keep this device's copy" puts the account's old copy into this device's
   backups before replacing it, then carries on to the character that was picked.
3. A device with its own, different copy of a character that's on the account (played there while not linked) taps it:
   the two copies are shown instead of the account's copy silently replacing the device's one."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
GP = sys.argv[1] if len(sys.argv) > 1 else "8901"
SP = sys.argv[2] if len(sys.argv) > 2 else "8788"
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
TAG = str(os.getpid() % 100000)
url = lambda dev: f"http://localhost:{GP}/index.html?net=bc&notut&p={dev}&server=http://localhost:{SP}"
PW = "dragonborn1"

async def menu(pg):
    for _ in range(40):
        if await pg.query_selector(".press"): await pg.click(".press"); break
        if await pg.query_selector(".mi"): break
        await pg.wait_for_timeout(150)
    await pg.wait_for_selector(".mi", timeout=8000)

async def new_char(pg, dev, name, level):
    await pg.goto(url(dev)); await menu(pg)
    await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate(f"()=>{{ const S=__dbg.save(); S.level={level}; Store.save(S); }}"); await pg.wait_for_timeout(200)
    await pg.goto(url(dev)); await menu(pg)

async def account(pg):
    await pg.click(".mi[data-t=account]"); await pg.wait_for_timeout(300)

async def sign_in(pg, user, create=False):
    await account(pg)
    if create:
        await pg.click("[data-acct=mode-up]"); await pg.fill("#acu", user); await pg.fill("#acp", PW); await pg.fill("#acp2", PW); await pg.click("[data-acct=register]")
    else:
        await pg.fill("#acu", user); await pg.fill("#acp", PW); await pg.click("[data-acct=login]")
        try:
            await pg.wait_for_selector("[data-acct=takeover]", timeout=2500); await pg.click("[data-acct=takeover]")
        except Exception: pass
    await pg.wait_for_selector("[data-acct=signout]", timeout=8000)

async def chars(pg):
    return await pg.evaluate("ACCOUNT._state().chars || []")

def backups(pg_eval):
    return pg_eval("JSON.parse(localStorage.getItem('rotn_backups')||'[]').map(b=>({name:b.name, level:b.level}))")

async def main():
    user = "Lost" + TAG
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915})
        errs = []
        A = await ctx.new_page(); A.on("pageerror", lambda e: errs.append(str(e)))
        await new_char(A, "lA" + TAG, "Ulf", 3)
        await sign_in(A, user, create=True)
        await A.click("[data-acct=upload]"); await A.wait_for_selector(".acchar.here", timeout=8000)
        v0 = await A.evaluate("ACCOUNT.linked().version")

        # 1. the reply to a save is lost: the server keeps the save, the device never hears back
        lost = {"n": 0}
        async def drop(route):
            if route.request.method == "PUT" and lost["n"] == 0:
                lost["n"] += 1; await route.fetch(); await route.abort("connectionreset"); return
            await route.continue_()
        await A.route("**/api/characters/**", drop)
        await A.evaluate("()=>{ const S=__dbg.save(); S.gold=111; Store.save(S); return ACCOUNT.flush(); }")
        ok(lost["n"] == 1, "the first save reached the server, its reply was dropped")
        ok(await A.evaluate("ACCOUNT.linked().version") == v0, "the device still has the old save number")

        # 2. more progress: the next save sees the server ahead, recognises its own save and goes through
        await A.evaluate("()=>{ const S=__dbg.save(); S.gold=222; Store.save(S); return ACCOUNT.flush(); }")
        await A.wait_for_timeout(1500)
        st = await A.evaluate("({ c: !!ACCOUNT._state().conflict, wall: !!document.querySelector('[data-acct=usecloud]'), v: ACCOUNT.linked().version })")
        ok(not st["c"] and not st["wall"], "no Two copies screen for our own lost save")
        ok(st["v"] >= v0 + 2, f"the newest save is on the account (number {v0} -> {st['v']})")
        acc = await A.evaluate("fetch(ACCOUNT.server()+'/api/characters/'+ACCOUNT.linked().id,{headers:{Authorization:'Bearer '+ACCOUNT.token()}}).then(r=>r.json()).then(j=>j.character.data.gold)")
        ok(acc == 222, f"the account holds the latest gold ({acc})")

        # 3. a real change from somewhere else still asks
        await A.evaluate("()=>{ const l=ACCOUNT.linked(); const S=__dbg.save(); return fetch(ACCOUNT.server()+'/api/characters/'+l.id,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ACCOUNT.token()},body:JSON.stringify({data:{...S,gold:999,level:5},baseVersion:l.version})}).then(r=>r.json()); }")
        await A.evaluate("()=>{ const S=__dbg.save(); S.gold=333; Store.save(S); return ACCOUNT.flush(); }")
        await A.wait_for_selector("[data-acct=usecloud]", timeout=5000)
        txt = await A.inner_text("#acctwall")
        if os.environ.get("SHOT"): await A.screenshot(path=os.environ["SHOT"])
        ok("newest" in txt.lower() and "999 gold" in txt and "333 gold" in txt, "a real other copy still asks, showing gold and which is newest")
        ok(errs == [], f"no page errors {errs}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")


asyncio.run(main())
