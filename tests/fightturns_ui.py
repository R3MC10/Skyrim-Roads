"""Fight turns, build 145: named foe intents, the lit turn order, no action points, and the fight minigames.
Plays a real fight on a phone (360x780) and a PC (1600x837), ink style, with ?games (minigames on under a test browser):
the foe's intent chip shows icon + NAME + numbers + target, the turn order lights whoever acts (also while the foe's turn
plays out, with a banner naming its move), an Attack opens the strike minigame, a Destruction spell opens the rune
minigame, both resolve and come back to you, and no button says AP. Screenshots go to tests/out_combat2/.
  python -m http.server 8765 --directory ../game &   then   python fightturns_ui.py 8765"""
import asyncio, sys, os, re
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_combat2")
os.makedirs(OUT, exist_ok=True)
SIZES = [(360, 780), (1600, 837)]
fails = 0
def ok(c, msg):
    global fails
    if not c: fails += 1
    print(("ok   " if c else "FAIL ") + msg)

START = """()=>{ ART.setStyle('ink'); document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=45;
  S.mpBonus=80; for (const id of ['flames','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:TOWNS.followerMax(S,'lydia'),ts:G.now()}; G.give(S,'potion_health',2); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !document.querySelector('.tbtime.mg') && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove())"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, h) in SIZES:
            tag = f"{w}x{h}"
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            async def shot(n): await pg.screenshot(path=os.path.join(OUT, f"{tag}_{n}.png"))
            async def my_turn(skip=True):
                for _ in range(80):
                    await pg.evaluate(CLEAN)
                    if await pg.evaluate(MYTURN): return True
                    if await pg.evaluate("!!TB.session?.done"): return False
                    if skip and await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"): await pg.click("#tbf [data-tbx=skip]")
                    await pg.wait_for_timeout(250)
                return False
            async def evn(): return await pg.evaluate("TB.session ? TB.session.ev.length : 0")
            for _ in range(3):
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ft{w}&tb&games"); await pg.wait_for_timeout(1500)
                if await pg.evaluate("typeof ENC!=='undefined' && typeof SMITH!=='undefined' && typeof MINIGAME!=='undefined' && typeof STACKS!=='undefined'"): break
            errs.clear()   # a half-loaded first try (slow local server) doesn't count
            await pg.wait_for_selector(".press"); await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false, tbGames:true}))")
            await pg.evaluate(START); await pg.wait_for_timeout(300)
            await pg.click("#modal [data-act=ev][data-c=fight]"); await pg.wait_for_timeout(600)
            ok(await my_turn(), f"{tag}: the fight starts on your turn")
            ok(await pg.evaluate("MINIGAME.on()"), f"{tag}: minigames are on")
            # 1. named intents and the turn order
            chip = await pg.evaluate("(()=>{const c=document.querySelector('#tbf .tbint:not(.skip)'); return c ? c.textContent.replace(/\\s+/g,' ').trim() : ''})()")
            ok(bool(re.search(r"[A-Za-z]{4,}", chip)) and bool(re.search(r"\d", chip)), f"{tag}: the intent chip names the move and its numbers: {chip!r}")
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbint b.w')"), f"{tag}: the move's name is on the chip")
            ok(await pg.evaluate("!!document.querySelector('#tbf .tbord .tbini.now')"), f"{tag}: the turn order lights whose turn it is")
            ok(not await pg.evaluate("/\\bAP\\b/.test(document.querySelector('#tbf').innerText)"), f"{tag}: no action points anywhere on the fight screen")
            await shot("5_intents_order")
            # 2. Attack: the strike minigame
            n0 = await evn(); await pg.click("#tbf [data-tba=attack]")
            try: await pg.wait_for_selector(".tbtime.mg.mg-strike, .tbtime.mg.mg-power, .tbtime.mg.mg-aim", timeout=3000); seen = True
            except Exception: seen = False
            ok(seen, f"{tag}: Attack opens the strike minigame")
            if seen:
                await pg.wait_for_timeout(350); await shot("6_minigame_strike")
                await pg.click(".tbtime.mg"); await pg.wait_for_timeout(900)
            ok(await my_turn(False) and await evn() > n0, f"{tag}: the blow lands after the minigame and it's your move again")
            grade = await pg.evaluate("TB.session.ev.slice(-4).map(e=>e.text).join(' | ')")
            print("   after strike:", grade[:160])
            # 3. a Destruction spell: the rune minigame
            if await pg.evaluate("!!document.querySelector('#tbf [data-tbm=magic]')"): await pg.click("#tbf [data-tbm=magic]"); await pg.wait_for_timeout(400)
            sel = "#tbf [data-tba='spell:flames']:not([disabled])"
            if await pg.evaluate(f"!!document.querySelector(\"{sel}\")"):
                n0 = await evn(); await pg.click(sel); await pg.wait_for_timeout(300)
                if await pg.evaluate("!!document.querySelector('#tbf [data-tbzone=foe]') && !document.querySelector('.tbtime.mg')"): await pg.click("#tbf [data-tbzone=foe]")
                try: await pg.wait_for_selector(".tbtime.mg.mg-rune", timeout=3000); rune = True
                except Exception: rune = False
                ok(rune, f"{tag}: a Destruction spell opens the rune minigame")
                if rune:
                    await pg.wait_for_timeout(250); await shot("7_minigame_rune")
                    for _ in range(6):   # tap the lit points in order
                        if not await pg.evaluate("!!document.querySelector('.tbtime.mg .mg-pt.on')"): break
                        await pg.click(".tbtime.mg .mg-pt.on"); await pg.wait_for_timeout(120)
                    await pg.wait_for_timeout(900)
                ok(await my_turn(False) and await evn() > n0, f"{tag}: the spell is cast after the rune")
            else: ok(False, f"{tag}: Flames in the Magic drawer")
            # 4. end the turn: the foe's move plays out by name with the turn order lit on it
            n0 = await evn(); await pg.click("#tbf [data-tba=end]")
            named = False
            for _ in range(40):
                if await pg.evaluate("!!document.querySelector('#tbf .tbban.foe.act')"):
                    named = True; break
                await pg.wait_for_timeout(120)
            ok(named, f"{tag}: the foe's turn shows its move by name")
            if named:
                lit = await pg.evaluate("(()=>{const n=document.querySelector('#tbf .tbord .tbini.now'); return n ? n.className : ''})()")
                ok("foe" in lit, f"{tag}: the turn order lights the foe while it acts ({lit})")
                await shot("8_foe_acts")
            await my_turn()
            log = await pg.evaluate("TB.session.ev.filter(e=>e.act).map(e=>e.text).slice(-2).join(' | ')")
            ok(bool(log), f"{tag}: the log names the foe's moves: {log[:140]!r}")
            ok(not errs, f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print(f"{fails} FAILED" if fails else "ALL OK")
    sys.exit(1 if fails else 0)
asyncio.run(main())
