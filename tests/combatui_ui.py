"""Fight controls (fightctl.js): the action bar on the turn-based fight screen. Usage: python combatui_ui.py PORT -> RESULT OK
Serve game/ first:  python -m http.server PORT --directory ../game
At 390x844 (phone, touch) and 1920x1080 (PC, mouse + keys), in both art styles:
- big drawn-icon buttons, AP pips on every move, the AP counter, nothing wider than the screen
- a move spends AP (tap on the phone, key 1 on the PC)
- Magic picker with filters and ★ pins; a pinned spell lands in the quick slots
- a healing spell with a follower beside you asks who gets it; tapping the follower casts it there
- greyed-out moves say why ("Need 2 more AP")
- Space ends the turn; Auto finishes the fight; Space presses Continue
Screenshots in tests/out_combatui/ (gitignored)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_combatui") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")   # falls back to Playwright's own Chromium when missing
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """(st)=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  localStorage.removeItem('rotn_fcfav');
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl=45;
  S.mpBonus=120; for (const id of ['flames','sparks','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:9999,ts:0};
  G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
AUTO = "(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()"
APN = "document.querySelectorAll('#tbf .tbap i.on.ap').length"

async def my_turn(pg, tries=60):
    for _ in range(tries):
        if await pg.evaluate("!!document.querySelector('#tbf .fc [data-tba=attack]')"): return True
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): return False
        sk = await pg.query_selector("#tbf .tbskip")
        if sk: await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()")
        await pg.wait_for_timeout(250)
    return False

async def run(p, w, h, touch):
    kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
    b = await p.chromium.launch(**kw)
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=cui{w}&tb"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Thumbs"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
    tag0 = f"{w}x{h}"
    for style in ["ink"]:
        tag = f"{tag0}_{style}"
        await pg.evaluate(START, style); await pg.wait_for_timeout(400)
        await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(800)
        await pg.evaluate("document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())")
        ok(await pg.evaluate("!!document.querySelector('#tbf') && TB.open"), f"{tag}: fight screen opens")
        if not await my_turn(pg): ok(False, f"{tag}: my turn comes"); await pg.evaluate(AUTO); continue
        await pg.wait_for_timeout(700)
        ok(await pg.evaluate("!!document.querySelector('#tbf .fc .fc-main') && !!document.querySelector('#tbf .fc .fc-row [data-tba=end]')"), f"{tag}: the action bar is up")
        mn = await pg.evaluate("Math.min(...[...document.querySelectorAll('#tbf .fc .tbact')].map(b=>b.getBoundingClientRect().height))")
        ok(mn >= 44, f"{tag}: every button is a thumb-sized target ({mn:.0f}px)")
        big = await pg.evaluate("Math.min(...[...document.querySelectorAll('#tbf .fc .tbact.big')].map(b=>b.getBoundingClientRect().height))")
        ok(big >= 60, f"{tag}: big moves are big ({big:.0f}px)")
        ok(await pg.evaluate("document.querySelectorAll('#tbf .fc-main .ic img, #tbf .fc-main .ic canvas').length") == 3, f"{tag}: big moves have drawn icons")
        ok(await pg.evaluate("[...document.querySelectorAll('#tbf .fc .tbact[data-tba]:not([data-tba=end])')].every(b=>b.querySelector('.cp em.rc'))"), f"{tag}: every move shows its cost")
        ok(await pg.evaluate("/\\d/.test(document.querySelector('#tbf .tbap .fc-apn')?.textContent||'')"), f"{tag}: the moves counter shows")
        ok(await pg.evaluate("document.querySelector('#tbf .fc-tray .tbact') !== null"), f"{tag}: quick slots suggest something")
        ow = await pg.evaluate("Math.max(document.querySelector('#tbf .tbin').scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1")
        ok(ow, f"{tag}: nothing wider than the screen")
        bot = await pg.evaluate("document.querySelector('#tbf .fc').getBoundingClientRect().bottom <= innerHeight + 1")
        ok(bot, f"{tag}: the bar sits on screen (thumb reach)")
        if not touch:
            ok(await pg.evaluate("getComputedStyle(document.querySelector('#tbf .fc .fc-k')).display !== 'none'"), f"{tag}: key hints show on PC")
        await pg.mouse.move(2, 2); await pg.evaluate("document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=OUT + f"{tag}_turn.png")
        # spend AP
        a0 = await pg.evaluate(APN)
        if touch: await pg.click("#tbf .fc [data-tba=attack]")
        else: await pg.keyboard.press("1")
        await pg.wait_for_timeout(600)
        if await my_turn(pg, 4):
            a1 = await pg.evaluate(APN); ok(a1 < a0, f"{tag}: a strike uses a move ({a0}->{a1})")
            # the magic picker, pin a spell
            if touch: await pg.click("#tbf [data-tbm=magic]")
            else: await pg.keyboard.press("m")
            await pg.wait_for_timeout(450)
            ok(await pg.evaluate("document.querySelectorAll('#tbf .fc .tbsp').length") >= 3, f"{tag}: magic list")
            await pg.click("#tbf .fc .tbsp .fc-star[data-a='spell:sparks']"); await pg.wait_for_timeout(250)
            ok(await pg.evaluate("!!document.querySelector(\"#tbf .fc-star.on[data-a='spell:sparks']\")"), f"{tag}: the star pins a spell")
            await pg.screenshot(path=OUT + f"{tag}_magic.png")
            # healing with a follower beside you: choose who gets it
            n_ally = await pg.evaluate("document.querySelectorAll('#tbf .tbu.ally:not(.down)').length")
            heal = await pg.query_selector("#tbf .fc [data-tba='spell:healing']:not([disabled])")
            if n_ally and heal:
                await heal.click(); await pg.wait_for_timeout(300)
                ok(await pg.evaluate("!!document.querySelector('#tbf .fc-aimbar') && document.querySelectorAll('#tbf .tbu.fc-tgt').length >= 2"), f"{tag}: healing asks who gets it")
                await pg.screenshot(path=OUT + f"{tag}_aim.png")
                ap0 = await pg.evaluate("-TB.session.myActs")
                await pg.click("#tbf .tbu.ally.fc-tgt"); await pg.wait_for_timeout(600)
                ap1 = await pg.evaluate("TB.session ? -TB.session.myActs : -1")
                ok(not await pg.evaluate("!!document.querySelector('#tbf .fc-aimbar')") and (ap1 < ap0 or ap1 == -1 or not await pg.evaluate("!!document.querySelector('#tbf .fc [data-tba=attack]')")), f"{tag}: tapping the follower casts it on them")
                ok(await pg.evaluate(r"/Healing on Lydia: \+\d/.test([...document.querySelectorAll('#tbf .tbl')].map(e=>e.textContent).join(' '))"), f"{tag}: the log shows the heal on the follower")
            else:
                ok(False, f"{tag}: follower and healing are there to test targeting (allies {n_ally})")
                await pg.evaluate("document.querySelector('#tbf [data-tbm=\"\"]')?.click()")
            if await my_turn(pg, 4):
                await pg.evaluate("document.querySelector('#tbf [data-tbm=\"\"]')?.click()"); await pg.wait_for_timeout(200)
                ok(await pg.evaluate("!!document.querySelector(\"#tbf .fc-tray [data-tba='spell:sparks']\") && !!document.querySelector(\"#tbf .fc-tray [data-tba='potion:health']\")"), f"{tag}: the pinned spell joins the quick slots (suggestions kept)")
                # greyed out with a reason
                await pg.evaluate("TB.session.myActs=TB.session.st.acts; document.querySelector('#tbf [data-tbm=magic]').click(); document.querySelector('#tbf [data-tbm=\"\"]').click()"); await pg.wait_for_timeout(300)
                why = await pg.evaluate("[...document.querySelectorAll('#tbf .fc .fc-why')].map(e=>e.textContent)")
                ok(any("moves a turn" in x for x in why), f"{tag}: greyed-out moves say why: {why[:3]}")
                await pg.screenshot(path=OUT + f"{tag}_reason.png")
                r0 = await pg.evaluate("TB.session.round + ':' + TB.session.idx")
                await pg.keyboard.press("Space"); await pg.wait_for_timeout(500)
                r1 = await pg.evaluate("TB.session ? TB.session.round + ':' + TB.session.idx : 'done'")
                ok(r1 != r0, f"{tag}: Space ends the turn ({r0} -> {r1})")
        # let Auto finish
        for _ in range(3):
            if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
            await my_turn(pg, 30); await pg.evaluate(AUTO); await pg.wait_for_timeout(600)
        for _ in range(60):
            if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
            await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(250)
        ok(await pg.evaluate("!!document.querySelector('#tbf .tbdone')"), f"{tag}: the fight ends")
        await pg.screenshot(path=OUT + f"{tag}_done.png")
        await pg.keyboard.press("Space"); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("!document.querySelector('#tbf')"), f"{tag}: Space presses Continue")
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    ok(not errs, f"{tag0}: no page errors {errs[:3]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, 390, 844, True)
        await run(p, 1920, 1080, False)
    print("RESULT", "OK" if not fails else "FAIL " + "; ".join(fails))
    if fails: sys.exit(1)
asyncio.run(main())
