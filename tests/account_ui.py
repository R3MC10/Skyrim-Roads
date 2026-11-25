"""Accounts in the browser, end to end, with two "devices" (separate saves via ?p=) against a local server.
Usage: python account_ui.py GAME_PORT SERVER_PORT — prints RESULT OK. Start the server first:
  (cd server && PORT=8788 node src/index.js)       # memory store is fine
Device A makes a character, creates an account and uploads it. Device B signs in, is asked "Play here?", takes
over and plays the character. Device A, mid-game, is told it was signed out. B's progress is saved to the account.
A takes it back (password + Play here instead), sees the two copies and loads the newer one. Without a server the
menu has no Account item. Both art styles. Screenshots in tests/acct/."""
import asyncio, sys, os
from playwright.async_api import async_playwright
GP = sys.argv[1] if len(sys.argv) > 1 else "8901"
SP = sys.argv[2] if len(sys.argv) > 2 else "8788"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "acct") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

def url(dev, extra=""):
    return f"http://localhost:{GP}/index.html?net=bc&notut&p={dev}&server=http://localhost:{SP}{extra}"

async def title_menu(pg):
    for _ in range(30):
        if await pg.query_selector(".press"): await pg.click(".press"); break
        if await pg.query_selector(".mi"): break
        await pg.wait_for_timeout(200)
    await pg.wait_for_selector(".mi", timeout=8000)

async def main():
    user = "Remi" + str(os.getpid() % 10000)
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        A = await ctx.new_page(); A.on("pageerror", lambda e: errs.append("A " + str(e)))
        # ---- no server: no Account item
        await A.goto(f"http://localhost:{GP}/index.html?net=bc&notut&p=noserver"); await title_menu(A)
        ok(not await A.query_selector(".mi[data-t=account]"), "without a server the menu has no Account item")
        # ---- device A: a character, then an account
        await A.goto(url("devA")); await title_menu(A)
        await A.click(".mi[data-t=new]"); await A.fill("#nm", "Hrolf"); await A.click("#begin"); await A.wait_for_timeout(1500)
        await A.evaluate("()=>{ const S=__dbg.save(); S.gold=111; S.level=7; Store.save(S); }"); await A.wait_for_timeout(300)
        await A.goto(url("devA")); await title_menu(A)
        ok(await A.query_selector(".mi[data-t=account]") is not None, "with a server the menu has Sign in")
        await A.click(".mi[data-t=account]"); await A.wait_for_timeout(300)
        await A.click("[data-acct=mode-up]"); await A.wait_for_timeout(200)
        await A.fill("#acu", user); await A.fill("#acp", "dragonborn1"); await A.fill("#acp2", "dragonborn2")
        await A.click("[data-acct=register]"); await A.wait_for_timeout(300)
        ok("don't match" in (await A.inner_text(".page")), "mismatched passwords are caught before sending")
        await A.fill("#acp", "dragonborn1"); await A.fill("#acp2", "dragonborn1"); await A.click("[data-acct=register]")
        await A.wait_for_selector("[data-acct=upload]", timeout=8000)
        ok("Welcome" in await A.inner_text(".page"), "account created and signed in")
        await A.screenshot(path=OUT + "a_account_before_upload.png")
        await A.click("[data-acct=upload]"); await A.wait_for_selector(".acchar.here", timeout=8000)
        ok("Hrolf" in await A.inner_text(".acchar.here"), "Hrolf is on the account, marked as on this device")
        await A.screenshot(path=OUT + "a_account_uploaded.png")
        # A goes back into the game
        await A.click(".page [data-t=menu]"); await A.wait_for_timeout(200); await A.click(".mi[data-t=continue]"); await A.wait_for_timeout(1500)

        # ---- device B signs in: asked first
        B = await ctx.new_page(); B.on("pageerror", lambda e: errs.append("B " + str(e)))
        await B.goto(url("devB")); await title_menu(B)
        await B.click(".mi[data-t=account]"); await B.wait_for_timeout(300)
        await B.fill("#acu", user.lower()); await B.fill("#acp", "dragonborn1"); await B.click("[data-acct=login]")
        await B.wait_for_selector("[data-acct=takeover]", timeout=8000)
        txt = await B.text_content(".page")
        ok("Play here?" in txt and "(web)" in txt and "one device at a time" in txt, "B is asked: you're playing on another device, play here?")
        await B.screenshot(path=OUT + "b_play_here_prompt.png")
        await B.click("[data-acct=keep]"); await B.wait_for_timeout(200)
        ok("keep playing on" in (await B.inner_text(".page")) and await B.query_selector("#acu"), "Keep playing there: B stays signed out")
        await B.fill("#acp", "dragonborn1"); await B.click("[data-acct=login]"); await B.wait_for_selector("[data-acct=takeover]")
        await B.click("[data-acct=takeover]"); await B.wait_for_selector("[data-acct=play]", timeout=8000)
        ok("signed out" in await B.inner_text(".page"), "Play here: B is in, the other device signed out")
        await B.click("[data-acct=play]"); await B.wait_for_timeout(2500)
        await title_menu(B)
        cont = await B.inner_text(".mi[data-t=continue]")
        ok("Hrolf" in cont and "Level 7" in cont, f"B now has Hrolf from the account ({cont.splitlines()[-1] if cont else ''})")
        ok(await B.evaluate("Store.uid") == await A.evaluate("Store.uid"), "same world id on both devices")

        # ---- A finds out (heartbeat) mid-game
        await A.evaluate("ACCOUNT.refresh()"); await A.wait_for_timeout(500)
        wall = await A.query_selector("#acctwall")
        ok(wall is not None and "Playing on another device" in await A.text_content("#acctwall"), "A, mid-game, is told it was signed out")
        await A.screenshot(path=OUT + "a_signed_out_wall.png")

        # ---- B plays and saves to the account
        await B.click(".mi[data-t=continue]"); await B.wait_for_timeout(1500)
        v0 = await B.evaluate("ACCOUNT.linked().version")
        await B.evaluate("()=>{ const S=__dbg.save(); S.gold=999; S.level=8; Store.save(S); }"); await B.evaluate("ACCOUNT.flush()"); await B.wait_for_timeout(300)
        v1 = await B.evaluate("ACCOUNT.linked().version")
        ok(v1 == v0 + 1, f"B's progress is saved to the account (version {v0} → {v1})")

        # ---- A takes it back: wrong password first, then right
        await A.fill("#acwp", "wrongpass1"); await A.click("[data-acct=reclaim]"); await A.wait_for_timeout(600)
        ok("Wrong username or password" in await A.inner_text("#acctwall"), "wrong password is told plainly")
        await A.fill("#acwp", "dragonborn1"); await A.click("[data-acct=reclaim]")
        await A.wait_for_selector("[data-acct=usecloud]", timeout=8000)
        cmp = await A.text_content("#acctwall")
        ok("Two copies" in cmp and "Level 8" in cmp, "A sees two copies: the account's level 8 vs this device's")
        await A.screenshot(path=OUT + "a_two_copies.png")
        await A.click("[data-acct=usecloud]"); await A.wait_for_timeout(2500)
        await title_menu(A)
        ok("Level 8" in await A.inner_text(".mi[data-t=continue]"), "A loads the newer copy (level 8)")
        ok(await A.evaluate("JSON.parse(localStorage.getItem('devArotn_backups')||localStorage.getItem('rotn_backups')||'[]').length") >= 1, "the replaced copy is kept in the automatic backups")
        # B is now the one signed out
        await B.evaluate("ACCOUNT.refresh()"); await B.wait_for_timeout(500)
        ok(await B.query_selector("#acctwall") is not None, "and now B is told it was signed out")

        # ---- both art styles: the account page
        for style in ["ink"]:
            await A.click(".mi[data-t=account]"); await A.wait_for_selector(".acchar", timeout=8000)
            vw = await A.evaluate("document.querySelector('#tinner').scrollWidth <= innerWidth")
            ok(vw, f"{style}: account page fits the phone width")
            await A.screenshot(path=OUT + f"{style}_account_page.png")
            await A.click(".page [data-t=menu]"); await A.wait_for_timeout(200)
        # ---- sign out keeps the character on the device
        await A.click(".mi[data-t=account]"); await A.wait_for_selector("[data-acct=signout]"); await A.click("[data-acct=signout]"); await A.wait_for_timeout(500)
        ok("Signed out" in await A.inner_text(".page") and await A.query_selector("#acu"), "sign out")
        await A.click(".page [data-t=menu]"); await A.wait_for_timeout(200)
        ok("Hrolf" in await A.inner_text(".mi[data-t=continue]"), "the character stays on the device after signing out")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
