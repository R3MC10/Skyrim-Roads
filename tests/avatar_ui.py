"""Avatars (avatar.js): your round painted portrait follows your race and sex, you can pick another one, and friends show
their real portrait. Three phones in one browser (?net=bc&assets): Beta (a Breton man, the one we look from), Alfa (a
Khajiit man) and Cora (a Nord woman who picked the Imperial portrait). Beta's friends also hold Dag (offline, last seen
with the Redguard portrait) and Eir (never seen: a silhouette).
Checks: Beta's Character sheet shows a man (not the Breton woman), the picker saves the choice and sends it on the card,
the Friends rows show painted portraits (Cora's pick, Alfa's automatic one, Dag's cached one, Eir's silhouette), no
full-body figure squeezed next to the head, the Ask to join card has the asker's portrait.
Usage: py avatar_ui.py PORT [OUTDIR] [before]   ("before" only takes the screenshots, for the old build) -> RESULT OK"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "/tmp"), "rotn_avatar")
BEFORE = len(sys.argv) > 3 and sys.argv[3] == "before"
PRE = "avatar_before_" if BEFORE else "avatar_after_"
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    if BEFORE: return
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(name, race, sex, pick=None):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(name + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&assets&notut&p=av{name}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(500)
            await pg.evaluate(f"document.querySelector('.rpick[data-race={race}]').click()"); await pg.wait_for_timeout(200)
            if sex == "f": await pg.evaluate("document.querySelector('.cgsexb[data-v=f]').click()"); await pg.wait_for_timeout(200)
            if pick and not BEFORE:
                await pg.evaluate("document.querySelector('[data-av-all]')?.click()"); await pg.wait_for_timeout(200)
                await pg.evaluate(f"document.querySelector('.avtile[data-av={pick}]').click()"); await pg.wait_for_timeout(400)
                await pg.evaluate("document.querySelector('.cgavh')?.scrollIntoView()"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=os.path.join(OUT, PRE + "chargen_phone.png"))
            await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1400)
            await pg.evaluate("() => { setInterval(() => document.querySelectorAll('#modal:not(:has(.avsheet)),#wwall,.toast').forEach(m => m.remove()), 200); window.__ui.go('map'); }")
            return pg
        async def until(pg, js, n=60):
            for _ in range(n):
                if await pg.evaluate(js): return True
                await pg.wait_for_timeout(150)
            return False

        A = await phone("Alfa", "khajiit", "m", "orc"); C = await phone("Cora", "nord", "f"); B = await phone("Beta", "breton", "m")
        ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id"); idc = await C.evaluate("window.__dbg.save().id")
        if not BEFORE:
            ok(await A.evaluate("window.__dbg.save().avatar === 'orc'"), "the portrait picked in character creation is saved")
            ok(await B.evaluate("AVATAR.of(window.__dbg.save()) !== 'breton' && BUSTART.SEX[AVATAR.of(window.__dbg.save())] === 'm'"), "a Breton man gets a man's portrait automatically")
            # Cora picks the Imperial woman on her Character sheet
            await C.evaluate("() => window.__ui.go('hero')"); await C.wait_for_timeout(400)
            await C.click("[data-act=avatar]"); await C.wait_for_timeout(300)
            ok(await C.locator("#modal .avtile").count() >= 3, "the picker opens with portraits")
            await C.click("#modal [data-act=avpick][data-id=imperial]"); await C.wait_for_timeout(300)
            ok(await C.evaluate("window.__dbg.save().avatar === 'imperial'"), "the pick is saved on the hero")
            await C.evaluate("() => window.__ui.go('map')")
        await B.evaluate(f"() => {{ const s = window.__dbg.save(); s.friends = {{ '{ida}': {{ name: 'Alfa', t: G.now() }}, '{idc}': {{ name: 'Cora', t: G.now() }}, 'zzdag': {{ name: 'Dag', t: G.now(), pic: 'redguard' }}, 'zzeir': {{ name: 'Eir', t: G.now() }} }}; }}")
        for pg in (A, C): await pg.evaluate("() => window.__dbg.publish()")
        ok(await until(B, f"() => {{ let c=null; Store.watchPlayers(ps => c = ps.find(x => x.id === '{idc}')); return !!(c && c.avatar === 'imperial'); }}"), "Cora's card carries her pick")
        await B.wait_for_timeout(800)
        async def friends(pg):
            await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(300)
            await pg.click("[data-act=soctab][data-id=friends]"); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelector('[data-act=soctab][data-id=friends]')?.scrollIntoView()"); await pg.wait_for_timeout(300)
        await friends(B)
        await B.screenshot(path=os.path.join(OUT, PRE + "friends_phone.png"))
        if not BEFORE:
            pics = await B.evaluate("() => [...document.querySelectorAll('.frow')].map(r => [r.querySelector('.t')?.textContent.slice(0, 6), r.querySelector('.avport')?.dataset.bust || (r.querySelector('.avsil') ? 'sil' : '')])")
            print(pics)
            got = {n.strip()[:3]: v for n, v in pics}
            ok(got.get("Cor") == "imperial", f"Cora shows her pick {got}")
            ok(got.get("Alf") == "orc", f"Alfa shows the portrait he picked when he was made {got}")
            ok(got.get("Dag") == "redguard", f"offline Dag shows his last seen portrait {got}")
            ok(got.get("Eir") == "sil", f"never-seen Eir is a silhouette {got}")
            ok(await B.locator(".frow .pgear").count() == 0, "no tiny full-body figure next to the head")
            ok(await B.evaluate(f"window.__dbg.save().friends['{idc}'].pic === 'imperial'"), "Cora's portrait is remembered for when she's offline")
            ok(await until(B, "() => [...document.querySelectorAll('.frow .avport img.bustimg')].length >= 3", 40), "the paintings load")
        # Character sheet
        await B.evaluate("() => window.__ui.go('hero')"); await B.wait_for_timeout(1500)
        await B.evaluate("document.querySelector('.m2-hero')?.scrollIntoView()"); await B.wait_for_timeout(300)
        await B.screenshot(path=os.path.join(OUT, PRE + "hero_phone.png"))
        if not BEFORE:
            ok(await B.evaluate("BUSTART.SEX[document.querySelector('.m2-hero .bust-av')?.dataset.bust] === 'm'"), "Character sheet shows a man")
            await B.click("[data-act=avatar]"); await B.wait_for_timeout(400)
            await B.screenshot(path=os.path.join(OUT, PRE + "picker_phone.png"))
            await B.click("#modal [data-act=avall]"); await B.wait_for_timeout(300)
            ok(await B.locator("#modal .avtile").count() == await B.evaluate("AVATAR.IDS.length") + 1, "Show all lists every portrait plus Automatic")
            await B.click("#modal [data-act=avpick][data-id=auto]"); await B.wait_for_timeout(300)
            ok(await B.evaluate("!('avatar' in window.__dbg.save())"), "Automatic clears the pick")
            # Ask to join card shows Beta's portrait on Alfa's phone
            await B.evaluate("() => window.__ui.go('social')"); await B.wait_for_timeout(300)
            await B.click("[data-act=soctab][data-id=friends]"); await B.wait_for_timeout(500)
            await B.click(f"[data-act=fjoin][data-id='{ida}']"); await B.wait_for_timeout(300)
            ok(await until(A, "() => !!document.querySelector('#invbar .invcard[data-kind=join] .avport')"), "the Ask to join card has the asker's portrait")
            await A.wait_for_timeout(800)
            await A.screenshot(path=os.path.join(OUT, PRE + "joincard_phone.png"))
        # PC
        await B.set_viewport_size({"width": 1920, "height": 1080}); await B.wait_for_timeout(600)
        await friends(B)
        await B.screenshot(path=os.path.join(OUT, PRE + "friends_pc.png"))
        await B.evaluate("() => window.__ui.go('hero')"); await B.wait_for_timeout(1200)
        await B.evaluate("document.querySelector('.m2-hero')?.scrollIntoView()"); await B.wait_for_timeout(300)
        await B.screenshot(path=os.path.join(OUT, PRE + "hero_pc.png"))
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        await b.close()
    if BEFORE: print("before shots in", OUT); return
    print("FAILS:", len(fails)); print("RESULT OK" if not fails else "RESULT FAIL"); sys.exit(1 if fails else 0)

asyncio.run(main())
