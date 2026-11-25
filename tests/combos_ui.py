"""Combat combos (reactions.js) on screen: a phone (360x780) and a PC (2000x837).
The foe is chilled and soaked in oil: the power attack and the fire spell glow with a combo icon, the foe shows the
combo chips, the Oil flask / Mark / Cover moves sit in the dock, a power attack Shatters and the banner shows.
Then the same in Polish. Screenshots go to tests/out_combos/ (and SHOTS=<folder> as combo_<size>_<name>.png).
  python -m http.server 8765 --directory ../game &   then   python combos_ui.py 8765"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_combos")
os.makedirs(OUT, exist_ok=True)
SIZES = [(360, 780), (2000, 837)]
ASSETS = "&assets" if os.environ.get("ASSETS") else ""
SHOTS = os.environ.get("SHOTS")
fails = 0
def ok(c, msg):
    global fails
    if not c: fails += 1
    print(("ok   " if c else "FAIL ") + msg)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=25; for (const k of ['Two-Handed','Destruction','Restoration','Archery']) S.skills[k].lvl=45;
  S.mpBonus=80; for (const id of ['flames','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.follower={id:'lydia',hp:TOWNS.followerMax(S,'lydia'),ts:G.now()}; G.give(S,'oil_flask',2); G.give(S,'potion_health',1); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('#tip').forEach(e=>{e.style.transition='none'; e.classList.remove('on');})"
SETUP = """()=>{ const s=TB.session, f=s.f; f.sp=Math.max(f.sp,300); f.mp=Math.max(f.mp||0,200); f.ehp=Math.max(f.ehp, s.ehpMax*0.8);
  f.foeSt=f.foeSt||{}; f.foeSt.chill={turns:3}; f.cmark={...(f.cmark||{}), chill:'al0'}; f.rx={oil:{by:'me',until:(f.turn||0)+3}};
  TB.redraw(s,{turn:'me'}); return true; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ["en", "pl"]:
            for (w, h) in SIZES:
                tag = f"{w}x{h}_{lang}"
                ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900, locale=("pl-PL" if lang == "pl" else "en-US"))
                pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
                async def shot(n):
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_{n}.png"))
                    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f"combo_{tag}_{n}.png"))
                async def my_turn():
                    for _ in range(80):
                        await pg.evaluate(CLEAN)
                        if await pg.evaluate(MYTURN): return True
                        if await pg.evaluate("!!TB.session?.done"): return False
                        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
                            try: await pg.click("#tbf [data-tbx=skip]", timeout=3000)
                            except Exception: pass
                        await pg.wait_for_timeout(250)
                    return False
                for _ in range(3):
                    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=rx{w}{lang}&tb{ASSETS}"); await pg.wait_for_timeout(1500)
                    if await pg.evaluate("typeof ENC!=='undefined' && typeof REACT!=='undefined' && typeof COMBAT2!=='undefined'"): break
                await pg.wait_for_selector(".press"); await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.evaluate(f"localStorage.setItem('rotn_prefs', JSON.stringify({{...JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}'), tips:false}}))")
                for _ in range(3):   # the trip event sometimes opens late
                    await pg.evaluate(START); await pg.wait_for_timeout(500)
                    if await pg.evaluate("!!document.querySelector('#modal [data-act=ev][data-c=fight]')"): break
                await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(600)
                ok(await my_turn(), f"{tag}: the fight starts on your turn")
                await pg.evaluate(SETUP); await pg.wait_for_timeout(500); await pg.evaluate(CLEAN)
                glow = await pg.evaluate("[...document.querySelectorAll('#tbf .tbact.rxon')].map(b=>b.dataset.tba)")
                ok("power_attack" in glow, f"{tag}: the power attack glows for a Shatter {glow}")
                ok(await pg.evaluate("!!document.querySelector('#tbf .tbu.foe .rxchips .rxc')"), f"{tag}: the foe shows combo chips")
                ok(await pg.evaluate("!!document.querySelector('#tbf [data-tba=\"rx:oil\"], #tbf [data-tba=\"rx:cover\"]')"), f"{tag}: the new moves sit in the dock")
                await shot("1_glow")
                seen = False
                for tries in range(4):   # a power attack can miss: then end the turn and try again
                    if tries:
                        await pg.click("#tbf [data-tba=end]"); await pg.mouse.move(2, 2)
                        if not await my_turn(): break
                        await pg.evaluate(SETUP); await pg.wait_for_timeout(400); await pg.evaluate(CLEAN)
                    n0 = await pg.evaluate("TB.session.ev.length")
                    await pg.click("#tbf [data-tba=power_attack]"); await pg.mouse.move(2, 2)
                    for _ in range(40):
                        if await pg.evaluate("!!document.querySelector('.rxban')"): seen = True; break
                        await pg.wait_for_timeout(100)
                    if seen: break
                    await my_turn()
                ok(seen, f"{tag}: the combo banner shows")
                if seen: await pg.wait_for_timeout(350); await shot("2_banner")
                txt = await pg.evaluate(f"TB.session.ev.slice({n0}).map(e=>e.text).join(' / ')")
                ok(("shatter" in txt.lower()) or ("roztrzaskanie" in txt.lower()), f"{tag}: the log says Shatter: {txt[:120]}")
                if lang == "pl": ok(await pg.evaluate("!document.querySelector('.rxban') || /Roztrzaskanie/.test(document.querySelector('.rxban').textContent)"), f"{tag}: the banner is in Polish")
                ok(await pg.evaluate("document.scrollingElement.scrollWidth <= innerWidth + 1"), f"{tag}: nothing pokes out sideways")
                ok(not errs, f"{tag}: no page errors {errs[:3]}")
                await ctx.close()
        await b.close()
    print("ALL OK" if not fails else f"{fails} FAILED"); sys.exit(1 if fails else 0)
asyncio.run(main())
