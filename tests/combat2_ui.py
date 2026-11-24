"""Immersive fight screen (combat2.js): plays a real fight on a phone (360x780) and a wide PC screen (2000x837), ink style.
Attack, cast a spell from the Magic drawer, drink a potion from the Items drawer, end the turn; the fight screen never
scrolls, the foe card sits inside the scene, and buff/debuff icons show. Screenshots go to tests/out_combat2/.
  python -m http.server 8765 --directory ../game &   then   python combat2_ui.py 8765"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_combat2")
os.makedirs(OUT, exist_ok=True)
SIZES = [(360, 780), (2000, 837), (1366, 768)]
fails = 0
def ok(c, msg):
    global fails
    if not c: fails += 1
    print(("ok   " if c else "FAIL ") + msg)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=45;
  S.mpBonus=60; for (const id of ['flames','oakflesh','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:TOWNS.followerMax(S,'lydia'),ts:G.now()}; G.give(S,'potion_health',2); G.setHealth(S,Math.round(G.maxHealth(S)*0.6)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
NOSCROLL = """(()=>{ const t=document.querySelector('#tbf'), r=t.getBoundingClientRect();
  return { tbf: t.scrollHeight <= t.clientHeight + 1, inner: [...t.querySelectorAll('*')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight>e.clientHeight+1 && e.getBoundingClientRect().height>0).map(e=>e.className).join(' | ') || true,
    covers: r.top <= 0.5 && r.bottom >= innerHeight - 0.5 && r.left <= 0.5 && r.right >= innerWidth - 0.5,
    wide: document.scrollingElement.scrollWidth <= innerWidth + 1 }; })()"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, h) in SIZES:
            tag = f"{w}x{h}"
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            async def shot(n): await pg.screenshot(path=os.path.join(OUT, f"{tag}_{n}.png"))
            async def my_turn():
                for _ in range(60):
                    await pg.evaluate(CLEAN)
                    if await pg.evaluate(MYTURN): return True
                    if await pg.evaluate("!!TB.session?.done"): return False
                    if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"): await pg.click("#tbf [data-tbx=skip]", timeout=3000)
                    await pg.wait_for_timeout(250)
                return False
            async def noscroll(what):
                r = await pg.evaluate(NOSCROLL)
                ok(all(v is True for v in r.values()), f"{tag}: {what}: one screen, nothing scrolls {r}")
            async def evn(): return await pg.evaluate("TB.session ? TB.session.ev.length : 0")
            bad = []; pg.on("requestfailed", lambda r: bad.append(r.url.split("/")[-1]))
            for _ in range(3):   # a busy local server sometimes drops a script; load again rather than test half a game
                bad.clear(); await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=c2t{w}&tb"); await pg.wait_for_timeout(1500)
                if await pg.evaluate("typeof ENC!=='undefined' && typeof CLANS!=='undefined' && typeof COMBAT2!=='undefined'"): break
                print("   reload, missing scripts:", bad[:5])
            await pg.wait_for_selector(".press"); await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
            await pg.evaluate(START); await pg.wait_for_timeout(300)
            await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(600)
            ok(await my_turn(), f"{tag}: the fight starts on your turn")
            ok(await pg.evaluate("!!document.querySelector('#tbf.c2') && typeof COMBAT2!=='undefined'"), f"{tag}: the immersive screen is on")
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbstage .c2ov .tbu.foe') && !document.querySelector('#tbf .tbvit')"), f"{tag}: the foe card sits inside the scene")
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbu.me')"), f"{tag}: your HUD is there")
            await noscroll("start")
            # attack
            n0 = await evn(); await pg.click("#tbf [data-tba=attack]"); await pg.mouse.move(2, 2)
            ok(await my_turn() and await evn() > n0, f"{tag}: attack plays and comes back to you")
            await shot("1_attack"); await noscroll("after an attack")
            # magic drawer: cast Oakflesh on yourself
            if await pg.evaluate("!!document.querySelector('#tbf [data-tbm=magic]')"):
                await pg.click("#tbf [data-tbm=magic]"); await pg.wait_for_timeout(400)
                ok(await pg.evaluate("!!document.querySelector('#tbf [data-tba^=\"spell:\"]')"), f"{tag}: the Magic drawer shows spells")
                await shot("2_magic"); await noscroll("magic drawer open")
                sel = "#tbf [data-tba='spell:oakflesh']:not([disabled])"
                if not await pg.evaluate(f"!!document.querySelector(\"{sel}\")"): sel = "#tbf [data-tba^='spell:']:not([disabled])"
                n0 = await evn(); await pg.click(sel); await pg.wait_for_timeout(300)
                if await pg.evaluate("!!document.querySelector('#tbf [data-tbzone=foe]') && TB.session.ev.length===" + str(n0)):
                    await pg.click("#tbf [data-tbzone=foe]")   # targeting mode: tap the foe
                cast = await my_turn() and await evn() > n0
                if not cast: print("   cast:", await pg.evaluate("[TB.session.ev.slice(-3).map(e=>e.text), document.querySelector('#tbf .tbhint')?.textContent, Math.round(TB.session.f.mp||0)]"))
                ok(cast, f"{tag}: casting from the drawer works")
                fx = await pg.evaluate("document.querySelectorAll('#tbf .c2fx .c2e[data-tip]').length")
                ok(fx > 0 or await pg.evaluate("!TB.session.f.armorSpell"), f"{tag}: buffs and debuffs show as icons with a tooltip ({fx})")
            else: ok(False, f"{tag}: Magic button")
            # items drawer: drink a health potion
            if await pg.evaluate("!!document.querySelector('#tbf [data-tbm=items]')"):
                await pg.click("#tbf [data-tbm=items]"); await pg.wait_for_timeout(400)
                await shot("3_items"); await noscroll("items drawer open")
                if await pg.evaluate("!!document.querySelector('#tbf [data-tba=\"potion:health\"]:not([disabled])')"):
                    n0 = await evn(); await pg.click("#tbf [data-tba='potion:health']"); await pg.wait_for_timeout(300)
                    if await evn() == n0 and await pg.evaluate("!!document.querySelector('#tbf [data-tba=\"potion:health\"]')"):
                        await pg.click("#tbf [data-tba='potion:health']")   # with a follower it asks who gets it: tap again for yourself
                    ok(await my_turn() and await evn() > n0, f"{tag}: drinking a potion works")
            # strategy.js: Breathe on the skill bar, orders on the follower's card
            if await pg.evaluate("!!document.querySelector('#tbf [data-tbm=\"\"]')"): await pg.click("#tbf [data-tbm='']"); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("!!document.querySelector('#tbf .fc [data-tba=recover]')"), f"{tag}: Breathe is on the skill bar")
            if await pg.evaluate("!!document.querySelector('#tbf [data-strat-ord=hold]:not([disabled])')"):
                await pg.click("#tbf [data-strat-ord=hold]"); await pg.wait_for_timeout(400)
                ok(await pg.evaluate("TB.session.f.allies.some((a)=>a.order==='hold') && !!document.querySelector('#tbf [data-strat-ord=hold].on')"), f"{tag}: ordering the follower to hold back works")
                await shot("3b_orders"); await noscroll("with follower orders")
            else: ok(False, f"{tag}: order buttons on the follower's card")
            # end the turn
            n0 = await evn()
            if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]')"):
                await pg.click("#tbf [data-tba=end]")
                back = await my_turn()
                ok((back or await pg.evaluate("!!TB.session?.done")) and await evn() > n0, f"{tag}: End Turn hands over to the foe and back (or the fight ends)")
            else: ok(False, f"{tag}: End Turn button")
            await shot("4_end"); await noscroll("after End Turn")
            # no speed / skip buttons: a turn is hurried by tapping the scene
            ok(await pg.evaluate("![...document.querySelectorAll('#tbf .tbskip:not(.tbhurry), #tbf [data-fspd]')].some(e=>e.getBoundingClientRect().width>0)"), f"{tag}: no speed or Skip buttons")
            # win: the foes drop to 1 health, attack until it ends; slow finisher, then the result card
            for _ in range(12):
                if await pg.evaluate("!!TB.session?.done"): break
                await pg.evaluate("(()=>{const f=TB.session.f; f.ehp=1; (f.adds||[]).forEach(a=>{a.ehp=1; a.hp=1;});})()")
                if await my_turn():
                    sel = "#tbf [data-tba=attack]:not([disabled])"
                    if await pg.evaluate(f"!!document.querySelector('{sel}')"): await pg.click(sel)
                    else: await pg.click("#tbf [data-tba=end]")
                    await pg.mouse.move(2, 2); await pg.wait_for_timeout(400)
            card = False
            for _ in range(40):
                await pg.evaluate(CLEAN)
                if await pg.evaluate("!!document.querySelector('#tbf .c2res.on')"): card = True; break
                await pg.wait_for_timeout(250)
            ok(card, f"{tag}: the fight ends on a result card")
            if card:
                ok(await pg.evaluate("!!document.querySelector('#tbf .c2res .tbdone')"), f"{tag}: the result card holds the way out")
                await shot("5_result")
            ok(not errs, f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print(f"{fails} FAILED" if fails else "ALL OK")
    sys.exit(1 if fails else 0)
asyncio.run(main())
