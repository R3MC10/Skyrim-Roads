"""Item moves in a turn-based fight (minigame.js [itemgames], poisonfight.js), on a phone (390x844, touch) and a PC (1440x900).
With a shield on, the Shield bash slot on the hotbar opens its minigame (it used to go straight through: the game asked
for a skill called "Block" and quietly fell back to a plain move). A press lands it and the log says Shield bash.
Then a poison in the pack shows in the fight's Items menu with a Coat button; coating uses a move, the weapon is coated.
Screenshots go to SHOTS=folder (or the system temp folder), never into tests/.
  node serve.js 8765 ../game &   then   python itemgames_ui.py 8765"""
import asyncio, sys, os, tempfile
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_itemgames")
os.makedirs(OUT, exist_ok=True)
SIZES = [(390, 844), (1440, 900)]
fails = 0
def ok(c, msg):
    global fails
    if not c: fails += 1
    print(("ok   " if c else "FAIL ") + msg)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; S.skills['One-Handed'].lvl=45; S.skills.Blocking.lvl=30;
  G.give(S,'iron_shield'); G.equip(S, S.inv.find(r=>r.item==='iron_shield').id);
  G.give(S,'brew|Damage Health:30:0',2); S.poison=null;
  delete S.hotbar; S.dungeon=null; S.trip=null; S.follower=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip,#fhints').forEach(e=>e.remove()); document.querySelectorAll('#tip,.tip').forEach(e=>{e.style.transition='none'; e.classList.remove('on');})"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for (w, h) in SIZES:
            tag = f"{w}x{h}"; phone = w < 900
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=phone)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            cons = []; pg.on("console", lambda m: cons.append(m.text) if m.type == "error" and "minigame" in m.text else None)
            async def tap(sel):
                if phone: await pg.tap(sel)
                else: await pg.click(sel)
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
            for _ in range(5):
                await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&hub=0&p=ig{w}&tb&games"); await pg.wait_for_timeout(1500)
                try: await pg.wait_for_selector(".press", timeout=15000); break
                except Exception: pass
            await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
            for _ in range(3):
                await pg.evaluate(START); await pg.wait_for_timeout(500)
                for _ in range(6):
                    if await pg.evaluate("!!document.querySelector('#tbf')"): break
                    await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()"); await pg.wait_for_timeout(400)
                if await pg.evaluate("!!document.querySelector('#tbf')"): break
            ok(await my_turn(), f"{tag}: the fight starts on your turn")
            ok(await pg.evaluate("!!TB.session.f.shield && MINIGAME.on()"), f"{tag}: shield on, minigames on")
            # ---- shield bash
            ok(await pg.evaluate("!!document.querySelector('#tbf .hb-bar [data-tba=bash]:not([disabled])')"), f"{tag}: Shield bash sits on the hotbar")
            n0 = await pg.evaluate("TB.session.ev.length")
            await tap("#tbf .hb-bar [data-tba=bash]"); await pg.wait_for_timeout(350)
            mg = await pg.evaluate("(()=>{const e=document.querySelector('#tbf .mg'); return e ? {cls:e.className, hint:e.querySelector('.mg-hint')?.textContent, label:e.querySelector('.tl')?.textContent} : null})()")
            ok(bool(mg) and "mg-parry" in mg["cls"], f"{tag}: Shield bash opens its minigame {mg}")
            ok(bool(mg) and "shield meets the foe" in (mg["hint"] or ""), f"{tag}: it says to slam as your shield meets the foe")
            await pg.screenshot(path=os.path.join(OUT, f"itemgames_bash_{tag}.png"))
            await pg.wait_for_timeout(250)
            await tap("#tbf .mg"); await pg.wait_for_timeout(900)
            log = await pg.evaluate(f"TB.session.ev.slice({n0}).map(e=>e.text).join(' | ')")
            ok("Shield bash" in log, f"{tag}: the bash lands after the game ({log[:120]})")
            ok(not cons, f"{tag}: no minigame errors {cons[:2]}")
            # ---- poison from the Items menu
            await my_turn()
            await pg.evaluate("TB.session.f.sp = 999")
            await tap("#tbf [data-tbm=items]"); await pg.wait_for_timeout(400)
            btn = await pg.evaluate("(()=>{const b=document.querySelector('#tbf [data-tba^=\"poison:\"]'); return b ? {a:b.dataset.tba, txt:b.textContent.trim().slice(0,40), off:b.disabled} : null})()")
            ok(bool(btn) and not btn["off"] and "Coat" in btn["txt"], f"{tag}: the poison shows in Items with a Coat button {btn}")
            await pg.screenshot(path=os.path.join(OUT, f"itemgames_poison_{tag}.png"))
            if btn:
                n1 = await pg.evaluate("TB.session.ev.length")
                await tap(f"#tbf [data-tba='{btn['a']}']"); await pg.wait_for_timeout(700)
                st = await pg.evaluate(f"({{coated: !!TB.session.f.s.poison, log: TB.session.ev.slice({n1}).map(e=>e.text).join(' | '), mg: !!document.querySelector('#tbf .mg')}})")
                ok(st["coated"] and "coat" in st["log"].lower(), f"{tag}: coating works mid-fight ({st['log'][:100]})")
                ok(not st["mg"], f"{tag}: coating has no minigame")
            ok(not errs, f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("ALL OK" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)
asyncio.run(main())
