"""One notification manager (notify.js), on a phone (390x844) and a PC (1920x1080).
  python -m http.server 8765 --directory ../game &   then   python notify_ui.py 8765 [outdir]   — prints RESULT OK.
Checks: a burst of 10 loot lines never puts more than 2 notices on screen and the same item three times reads "x3";
"First Steps" and "Coin Hoarder" earned together come as one banner; with item details open a level-up banner waits
and loot goes to the history only, then the banner shows once the details close; the history opens from the scroll
button by the messages, filters to Rewards, and the back button closes it. Screenshots go to outdir
(default: notify_shots in the temp folder)."""
import asyncio, os, sys, tempfile, time
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "notify_shots")
os.makedirs(OUT, exist_ok=True)
ONSCREEN = """(()=>{ const v=(e)=>!!e && e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden' && getComputedStyle(e).display!=='none';
  let n=0; const t=document.querySelector('#toast'); if (t && !t.classList.contains('hide') && v(t)) n++;
  n += [...document.querySelectorAll('#pbanners .pban:not(.out)')].filter(v).length;
  const su=document.querySelector('#skillup.on'); if (su && v(su)) n++;
  n += [...document.querySelectorAll('#lvln .lvn:not(.out)')].filter(v).length;
  return n; })()"""
BANS = "[...document.querySelectorAll('#pbanners .pban, #skillup.on, #lvln .lvn')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())"
fails = []


async def run(b, w, h):
    tag = f"{w}x{h}"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    def check(c, m):
        print(("ok   " if c else "FAIL ") + tag + " " + m)
        if not c: fails.append(f"{tag}: {m}")
    shot = lambda n: pg.screenshot(path=os.path.join(OUT, f"notify_{tag}_{n}.png"))
    for attempt in range(3):   # a busy machine sometimes stalls a load or a tap: start over
        try:
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=nf{w}{attempt}{int(time.time())}"); await pg.wait_for_timeout(2000)
            await pg.evaluate("localStorage.removeItem('rotn-notify-hist')")
            await pg.click(".press", timeout=20000); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]", timeout=20000); await pg.fill("#nm", "Sigrid", timeout=20000)
            for _ in range(30):   # the first tap on Begin can land while the screen is still drawing
                if await pg.evaluate("!!window.__dbg && !!__dbg.save() && !document.querySelector('#begin')"): break
                await pg.evaluate("document.querySelector('#begin')?.click()"); await pg.wait_for_timeout(1000)
            if await pg.evaluate("!!window.__dbg && !!__dbg.save()"): break
        except Exception as e:
            print("retry start", tag, str(e).splitlines()[0])
    await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal,#obtip').forEach(e=>e.remove()); NOTIFY.C.hist.length=0; __dbg.save().onb={seen:{welcome:1},hid:{}}")
    await pg.wait_for_timeout(3000)   # let the start-up messages finish

    # 1. a burst of 10 loot lines
    await pg.evaluate("()=>{ for (let i=0;i<3;i++) __dbg.toast('Found: Iron Dagger.'); for (let i=0;i<7;i++) __dbg.toast('Found: Wolf Pelt '+i+'.'); }")
    most, texts = 0, set()
    for _ in range(40):
        most = max(most, await pg.evaluate(ONSCREEN)); texts.add(await pg.evaluate("document.querySelector('#toast')?.textContent||''"))
        await pg.wait_for_timeout(100)
    check(most <= 2, f"a burst of 10 loot lines: at most 2 notices at once ({most})")
    check(any("Iron Dagger ×3" in t for t in texts), "the same item 3 times reads ×3 " + str([t for t in texts if "Dagger" in t]))
    check(await pg.evaluate("NOTIFY.history.filter(h=>h.kind==='loot').length") >= 7, "every loot line is in the history")
    await pg.wait_for_timeout(2500)

    # 2. First Steps + Coin Hoarder earned together: one banner
    await pg.evaluate("()=>{ const S=__dbg.save(); S.ach=S.ach||{}; delete S.ach.first_steps; delete S.ach.rich; S.level=Math.max(S.level,5); S.gold=12000; }")
    seen = []
    for _ in range(90):
        for t in await pg.evaluate(BANS):
            if "Achievement" in t and t not in seen: seen.append(t)
        if seen and "Coin Hoarder" in seen[-1]:
            await shot("1_achievements"); break
        await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(2600)
    for t in await pg.evaluate(BANS):
        if "Achievement" in t and t not in seen: seen.append(t)
    check(len(seen) == 1 and "First Steps" in seen[0] and "Coin Hoarder" in seen[0], f"one banner for both achievements {seen}")
    await pg.wait_for_timeout(1500)

    # 3. item details open: a quest-completed banner (P1) waits, loot only goes to the history
    await pg.evaluate("()=>{ const S=__dbg.save(); TIP.show({ t: 'Iron Dagger: a plain iron blade.', el: document.querySelector('#goldv') || document.body }); }")
    await pg.wait_for_timeout(300)
    if await pg.evaluate("!!document.querySelector('#tip.on')"):
        n0 = await pg.evaluate("NOTIFY.history.length")
        await pg.evaluate("()=>{ POLISH.banner('quest','Quest completed','Bleak Falls Barrow 9'); __dbg.toast('Found: Silver Ring.'); }")
        await pg.wait_for_timeout(1200)
        check(not any("9" in t for t in await pg.evaluate(BANS)), "no banner over the item details")
        check(await pg.evaluate("!(document.querySelector('#toast')?.textContent||'').includes('Silver Ring')"), "loot doesn't pop over the item details")
        check(await pg.evaluate("NOTIFY.history.some(h=>h.text.includes('Silver Ring'))") and await pg.evaluate("NOTIFY.history.length") > n0, "it's in the history")
        await pg.evaluate("TIP.hide()")
        ok = False
        for _ in range(20):
            await pg.wait_for_timeout(100)
            if any("9" in t for t in await pg.evaluate(BANS)): ok = True; break
        if not ok: print("DBG", await pg.evaluate("JSON.stringify([NOTIFY.screen(), NOTIFY.C.queue.map(q=>q.kind+q.text), NOTIFY.C.showing.ban && NOTIFY.C.showing.ban.text, document.querySelector('#tip')?.className, document.querySelector('#pbanners')?.innerHTML.slice(0,200)])"))
        check(ok, "the quest banner shows once the details close")
        await shot("2_quest_after_details")
    else:
        check(False, "item details opened")
    await pg.wait_for_timeout(3800)

    # 4. the history
    btn = await pg.query_selector("#nfhbtn")
    vis = btn and await btn.is_visible()
    check(bool(vis), "the history button sits by the messages")
    if vis:
        await btn.click(); await pg.wait_for_timeout(300)
        check(await pg.evaluate("document.querySelectorAll('#nfhist .nf-l li:not(.nf-none)').length") >= 8, "the history lists the notices")
        await pg.click("#nfhist [data-nf=f][data-k=rewards]"); await pg.wait_for_timeout(200)
        check(await pg.evaluate("[...document.querySelectorAll('#nfhist .nf-l li')].every(l=>l.classList.contains('nf-rewards'))"), "Rewards filter")
        over = await pg.evaluate("(()=>{const r=document.querySelector('#nfhist .nf-sheet').getBoundingClientRect(); return r.left<0||r.right>innerWidth+1||r.bottom>innerHeight+1; })()")
        check(not over, "the history fits the screen")
        await shot("3_history")
        await pg.evaluate("window.__ui.back()"); await pg.wait_for_timeout(200)
        check(not await pg.query_selector("#nfhist"), "back closes the history")
    check(not errs, f"no page errors {errs[:3]}")
    await ctx.close()


async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        for w, h in [(390, 844), (1920, 1080)]: await run(b, w, h)
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL\n" + "\n".join(fails))
    sys.exit(1 if fails else 0)

asyncio.run(main())
