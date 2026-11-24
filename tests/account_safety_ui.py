"""Nobody loses a character when characters are swapped on a device (account.js). Usage: python account_safety_ui.py GAME_PORT SERVER_PORT
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
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
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
    user = "Safe" + TAG
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915})
        errs = []
        A = await ctx.new_page(); A.on("pageerror", lambda e: errs.append(str(e)))
        # Hrolf on the account, from device A
        await new_char(A, "sA" + TAG, "Hrolf", 7)
        await sign_in(A, user, create=True)
        await A.click("[data-acct=upload]"); await A.wait_for_selector(".acchar.here", timeout=8000)

        # ---- 1. device C has Bjorn, never uploaded; playing Hrolf there uploads Bjorn first
        C = await ctx.new_page(); C.on("pageerror", lambda e: errs.append(str(e)))
        await new_char(C, "sC" + TAG, "Bjorn", 4)
        await sign_in(C, user)
        ok(not any(c["name"] == "Bjorn" for c in await chars(C)), "Bjorn starts out only on device C")
        await C.click("[data-acct=play]"); await C.wait_for_timeout(2500); await menu(C)
        ok("Hrolf" in await C.inner_text(".mi[data-t=continue]"), "device C now plays Hrolf")
        await account(C); await C.wait_for_selector(".acchar", timeout=8000)
        names = [c["name"] for c in await chars(C)]
        ok("Bjorn" in names and "Hrolf" in names, f"Bjorn was saved to the account before he left the device ({names})")

        # ---- 2. device C signs out, Hrolf gets offline progress, then C signs in and picks Bjorn
        await C.click("[data-acct=signout]"); await C.wait_for_timeout(500)
        await C.click(".page [data-t=menu]"); await C.click(".mi[data-t=continue]"); await C.wait_for_timeout(1200)
        await C.evaluate("()=>{ const S=__dbg.save(); S.level=20; Store.save(S); }"); await C.wait_for_timeout(200)
        await C.goto(url("sC" + TAG)); await menu(C)
        await sign_in(C, user)
        bj = [c for c in await chars(C) if c["name"] == "Bjorn"]
        await C.click(f"[data-acct=play][data-id='{bj[0]['id']}']")
        await C.wait_for_selector("[data-acct=usehere]", timeout=8000)
        txt = await C.text_content("#acctwall")
        ok("isn't the same" in txt and "Level 7" in txt and "Level 20" in txt, "the two different Hrolfs are shown before anything is swapped (account 7, device 20)")
        await C.click("[data-acct=usehere]"); await C.wait_for_timeout(2500); await menu(C)
        ok("Bjorn" in await C.inner_text(".mi[data-t=continue]"), "after choosing, it carries on to Bjorn")
        bk = await backups(C.evaluate)
        ok(any(x["name"] == "Hrolf" and x["level"] == 7 for x in bk), f"the account's old Hrolf (level 7) is in the device's backups ({bk})")
        await account(C); await C.wait_for_selector(".acchar", timeout=8000)
        hr = [c for c in await chars(C) if c["name"] == "Hrolf"]
        ok(hr and hr[0]["level"] == 20, "the account now holds the device's Hrolf (level 20)")

        # ---- 3. uploading a character that's on the account with different progress asks instead of getting stuck
        D = await ctx.new_page(); D.on("pageerror", lambda e: errs.append(str(e)))
        await D.goto(url("sD" + TAG)); await menu(D)
        # copy Hrolf (an older level) onto device D as a plain local character with the same id
        hid = hr[0]["id"]
        await D.goto(url("sD" + TAG)); await menu(D)
        await D.click(".mi[data-t=new]"); await D.fill("#nm", "Hrolf"); await D.click("#begin"); await D.wait_for_timeout(1200)
        await D.evaluate(f"()=>{{ localStorage.setItem('sD{TAG}sk.uid', JSON.stringify('{hid}')); const S=__dbg.save(); S.id='{hid}'; S.level=9; localStorage.setItem('sD{TAG}sk.save', JSON.stringify(S)); }}")
        await D.goto(url("sD" + TAG)); await menu(D)
        await sign_in(D, user)
        before = await backups(D.evaluate)
        ok(await D.text_content(f"[data-acct=play][data-id='{hid}']") == "Play here", "a device's own copy isn't shown as already playing")
        await D.click(f"[data-acct=play][data-id='{hid}']")
        await D.wait_for_selector("[data-acct=usecloud]", timeout=8000)
        ok("Two copies" in await D.text_content("#acctwall"), "tapping it shows the two different copies instead of replacing the device's one")
        await D.click("[data-acct=usecloud]"); await D.wait_for_timeout(2500); await menu(D)
        ok("Level 20" in await D.inner_text(".mi[data-t=continue]"), "Use the account copy: device D plays the account's Hrolf (level 20)")
        bk2 = await backups(D.evaluate)
        ok(any(x["name"] == "Hrolf" and x["level"] == 9 for x in bk2), "and D's own Hrolf (level 9) is in its backups")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")

asyncio.run(main())
