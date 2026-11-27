"""[offhand] Humanoid foes are drawn by the painted fighter rig (foelook.js + rig.js), not a still painting.
For each kind of person (bandit, chief, draugr, deathlord, forsworn, falmer, vampire, necromancer, mage, thalmor, dremora,
soldier, assassin): start a fight, check the canvas says data-rig="painted" and PAINTRIG drew a "foe" figure whose layer
order keeps the off hand at the back, then play the foe's turn and save frame strips to $SHOTS/out_foelook/.
Beasts (wolf, bear, troll, spider) must NOT get a look. Usage: python3 foelook_ui.py PORT"""
import asyncio, sys, os, tempfile, time
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8884"
RUN = str(int(time.time()) % 100000)
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "out_foelook") + os.sep; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
FOES = (os.environ.get("FOES") or "").split(",") if os.environ.get("FOES") else ["Bandit", "Bandit Chief", "Draugr Wight", "Draugr Deathlord", "Forsworn Briarheart", "Falmer Skulker", "Vampire", "Necromancer", "Thalmor Justiciar", "Dremora", "Imperial Soldier", "Dark Brotherhood Assassin"]
BEASTS = ["Wolf", "Cave Bear", "Troll", "Frostbite Spider", "Dragon", "Flame Atronach", "Skeleton", "Hagraven"]
FIGHT = """(nm)=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); S.level=20; S.trip=null; S.dungeon=null; S.follower=null;
  G.setHealth(S,G.maxHealth(S)*50); const e=G.scaleEnemy({name:nm,health:4000,damage:3,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
  TB.call(S, ()=>{ const f=new G.Fight(S,e); return f.run({trySneak:false}); }, ()=>{}); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
INFO = """()=>{ const cv=[...document.querySelectorAll('#tbf canvas')].find(c=>c.dataset && (c.dataset.rig || c.dataset.painted)); const r=PAINTRIG.last('foe');
  return { rig: cv ? (cv.dataset.painted === '1' ? 'painted' : cv.dataset.rig) : null, order: r ? r.order.join(',') : null }; }"""

async def wait_turn(pg, n=60):
    for _ in range(n):
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        if await pg.evaluate(MYTURN): return True
        if await pg.evaluate("!!document.querySelector('#tbf [data-tbx=skip]')"):
            await pg.evaluate("document.querySelector('#tbf [data-tbx=skip]').click()")
        await pg.wait_for_timeout(400)
    return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        for _ in range(5):
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=flo{RUN}&tb&fightanim&assets"); await pg.wait_for_timeout(1800)
            try: await pg.wait_for_selector(".press", timeout=15000); break
            except Exception: pass
        await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Looker"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        for nm in BEASTS:
            ok(not await pg.evaluate("(n)=>!!FOELOOK.look(n, null, null, 0)", nm), f"{nm}: no person look (keeps its creature rig)")
        for k, nm in enumerate(FOES):
            for _ in range(5):
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=flo{RUN}{k}&tb&fightanim&assets"); await pg.wait_for_timeout(1500)
                try: await pg.wait_for_selector(".press", timeout=15000); break
                except Exception: pass
            await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", "Looker"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            await pg.evaluate(FIGHT, nm); await pg.wait_for_timeout(500)
            got = await wait_turn(pg)
            if not got: ok(False, f"{nm}: my turn comes"); continue
            # the painted parts may need a moment to load
            for _ in range(20):
                inf = await pg.evaluate(INFO)
                if inf["rig"] == "painted" and inf["order"]: break
                await pg.wait_for_timeout(300)
            ok(inf["rig"] == "painted", f"{nm}: drawn by the painted rig ({inf['rig']})")
            o = (inf["order"] or "").split(",")
            if "body" in o:
                back = [x for x in ("shield", "offArm", "offWeapon", "offFist") if x in o]
                ok(all(o.index(x) < o.index("legs") < o.index("body") for x in back), f"{nm}: off hand behind the body ({inf['order']})")
                if "mainArm" in o: ok(o.index("body") < o.index("mainArm"), f"{nm}: weapon arm in front")
            await pg.mouse.move(1, 1); await pg.screenshot(path=f"{OUT}{nm.replace(' ', '_')}_start.png")
            await pg.evaluate("FIGHTART.manual && FIGHTART.manual(true)")
            await pg.evaluate("document.querySelector('#tbf [data-tba=end]').click()")
            for i in range(36):
                await pg.evaluate("FIGHTART.advance && FIGHTART.advance(110)"); await pg.wait_for_timeout(40)
                if i % 3 == 2: await pg.screenshot(path=f"{OUT}{nm.replace(' ', '_')}_foe{i:02d}.png")
            await pg.evaluate("FIGHTART.manual && FIGHTART.manual(false)")
            await pg.evaluate("TB.session && TB.session.flee ? 0 : 0")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else f"{len(fails)} FAILED")
asyncio.run(main())
