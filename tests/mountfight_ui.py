"""Mounted combat (mountfight.js) on the turn-by-turn fight screen. Usage: py mountfight_ui.py PORT -> RESULT OK
Serve game/ first:  py -m http.server PORT --directory ../game
At 390x844 (phone, touch) and 1920x1080 (PC), in the ink art style:
- riding into a road fight: you start in the saddle, the rider sits on the horse in the fight picture, your horse's
  health bar is under yours, Dismount is offered with its AP
- the opening blow is a mounted charge; Dismount puts you on foot (the horse waits beside you), Mount puts you back up
- a horse that's brought down: the bar says Knocked down, Mount is gone, and after the fight it stays with you, downed
- walking beside your horse: it waits, Mount is offered
- in Polish (phone): the moves and the horse bar are in Polish
Fails on page errors or sideways scrolling. Screenshots in tests/out_mountfight/ (gitignored)."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_mountfight") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# ride (true/false) into a bandit on the road
START = """([st, ride])=>{ ART.setStyle(st); document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; S._test=true; for (const k of ['One-Handed','Heavy Armor','Athletics']) S.skills[k].lvl=50;
  S.hpBonus=200; S.spBonus=80; S.follower=null; S.gold=5000; S.dungeon=null; S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
  if (!S.horse) HORSES.buy(S,'Frost','bay'); S.horse.mounted=ride; S.horse.hp=HORSES.maxHp(S.horse); S.horse.away=null;
  const id=G.give(S,'steel_sword'); G.equip(S,id); G.give(S,'potion_health',3); G.setHealth(S,G.maxHealth(S));
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const e={...D.ENCOUNTERS.find(x=>x.name==='Bandit outlaw')}; e.hp=e.health*4; e.health=e.hp; e.damage=6; S.trip.status='encounter'; S.trip.encounter=G.scaleEnemy(e,20); __dbg.openEncounter(); }"""
AUTO = "(()=>{const g=document.querySelector('#tbf .tbgrid')||document.querySelector('#tbf');const b=document.createElement('button');b.dataset.tbx='autoall';g.append(b);b.click()})()"
CLEAN = "document.querySelector('[data-obt=off]')?.click(); document.querySelectorAll('#obtip').forEach(e=>e.remove()); document.querySelectorAll('.tbtip').forEach(t=>t.classList.remove('on'))"
BTN = "(a)=>{const b=document.querySelector(`#tbf [data-tba='${a}']`); return b ? (b.disabled ? 'off' : 'on') : 'none'}"

async def my_turn(pg, tries=60):
    for _ in range(tries):
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=end]') && TB.session && TB.session.cur && TB.session.cur.id==='me'"): return True
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): return False
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()")
        await pg.wait_for_timeout(250)
    return False

async def settle(pg):
    for _ in range(30):
        if await pg.evaluate("!document.querySelector('#tbf .tbskip')"): break
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(200)
    await pg.wait_for_timeout(400)

async def tap(pg, a):
    await pg.evaluate("(a)=>document.querySelector(`#tbf [data-tba='${a}']`)?.click()", a); await pg.wait_for_timeout(500)
    await pg.evaluate(CLEAN)

async def finish(pg):
    for _ in range(3):
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
        await my_turn(pg, 30); await pg.evaluate(AUTO); await pg.wait_for_timeout(600)
    for _ in range(120):
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): break
        await pg.evaluate("document.querySelector('#tbf .tbskip')?.click()"); await pg.wait_for_timeout(250)
    await pg.evaluate("document.querySelector('#tbf .tbdone')?.click()"); await pg.wait_for_timeout(800)

async def run(p, w, h, touch, lang=None):
    PL = lang == "pl"
    kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
    b = await p.chromium.launch(**kw)
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
    errs = []
    if PL: await ctx.add_init_script("try{const k='rotn_prefs';localStorage.setItem(k,JSON.stringify({...JSON.parse(localStorage.getItem(k)||'{}'),lang:'pl'}))}catch(e){}")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=mf{w}&tb&fightanim&mountcombat"); await pg.wait_for_timeout(2000)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rider"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify({...JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), tips:false}))")
    tag0 = f"{w}x{h}" + ("_pl" if PL else "")
    for style in ["ink"]:
        tag = f"{tag0}_{style}"
        # ---------------- riding into the fight
        await pg.evaluate(START, [style, True]); await pg.wait_for_timeout(600)
        await pg.click("#modal [data-act=enc][data-a=fight]"); await pg.wait_for_timeout(900); await pg.evaluate(CLEAN)
        ok(await pg.evaluate("TB.open && TB.session.f.mount && TB.session.f.mount.up"), f"{tag}: riding: the fight starts in the saddle")
        if not await my_turn(pg): ok(False, f"{tag}: my turn comes"); await finish(pg); continue
        await settle(pg)
        bar = await pg.evaluate("document.querySelector('#tbf .mfhorse')?.innerText||''")
        ok(("Frost" in bar) and (("W siodle" in bar) if PL else ("In the saddle" in bar)), f"{tag}: the horse's health bar {bar!r}")
        ok(await pg.evaluate(BTN, "dismount") == "on", f"{tag}: Dismount offered")
        lbl = await pg.evaluate("(document.querySelector(\"#tbf [data-tba='dismount'] b\")?.textContent||'')")
        ok(("Zsiądź" in lbl) if PL else ("Dismount" in lbl), f"{tag}: Dismount label {lbl!r}")
        ok(await pg.evaluate("!!document.querySelector('#tbf canvas')"), f"{tag}: the fight picture is there")
        await pg.mouse.move(2, 2); await pg.evaluate(CLEAN)
        await pg.screenshot(path=OUT + f"{tag}_mounted.png")
        # the opening charge, played in the picture
        await tap(pg, "attack"); await pg.wait_for_timeout(350)
        await pg.screenshot(path=OUT + f"{tag}_charge.png")
        await settle(pg)
        log = await pg.evaluate("TB.session.ev.map(e=>e.text).join(' | ')")
        ok(("Szarża z siodła" in log or "Mounted charge" in log) if PL else ("Mounted charge" in log), f"{tag}: the opening blow is a mounted charge {log[:300]!r}")
        if await my_turn(pg, 10) and await pg.evaluate(BTN, "dismount") == "on":
            await tap(pg, "dismount"); await settle(pg)
            ok(await pg.evaluate("!TB.session.f.mount.up") and await pg.evaluate(BTN, "mount") in ("on", "off"), f"{tag}: Dismount: on foot, Mount offered")
            await pg.screenshot(path=OUT + f"{tag}_dismounted.png")
        # the horse is brought down: knocked down, never dead
        await pg.evaluate("(()=>{const f=TB.session.f; f.mount.hp=0; f.mount.up=false; f.mount.down=true; f.mount.downTurn=f.turn||1; TB.redraw(TB.session,{turn:'me'});})()"); await pg.wait_for_timeout(400)
        bar = await pg.evaluate("document.querySelector('#tbf .mfhorse')?.innerText||''")
        ok(await pg.evaluate(BTN, "mount") == "none", f"{tag}: a knocked-down horse can't be ridden ({bar!r})")
        await pg.screenshot(path=OUT + f"{tag}_downed.png")
        await finish(pg)
        res = await pg.evaluate("document.querySelector('#modal')?.innerText||''")
        horse = await pg.evaluate("(()=>{const S=__dbg.save(); return {hp:S.horse&&S.horse.hp, away:!!(S.horse&&S.horse.away), up:HORSES.riding(S), down:HORSES.downed(S)}})()")
        ok(horse["down"] and not horse["away"] and not horse["up"], f"{tag}: after the fight the horse stays with you, downed {horse} {res[:120]!r}")
        await pg.screenshot(path=OUT + f"{tag}_after.png")
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        # ---------------- walking beside your horse
        await pg.evaluate(START, [style, False]); await pg.wait_for_timeout(600)
        await pg.click("#modal [data-act=enc][data-a=fight]"); await pg.wait_for_timeout(900); await pg.evaluate(CLEAN)
        if await my_turn(pg):
            await settle(pg)
            ok(await pg.evaluate("TB.session.f.mount && !TB.session.f.mount.up") and await pg.evaluate(BTN, "mount") == "on", f"{tag}: walking: the horse waits, Mount offered")
            await pg.screenshot(path=OUT + f"{tag}_walking.png")
            await tap(pg, "mount"); await settle(pg)
            ok(await pg.evaluate("TB.session.f.mount.up"), f"{tag}: Mount: back in the saddle")
            await pg.screenshot(path=OUT + f"{tag}_remounted.png")
        else: ok(False, f"{tag}: my turn comes (walking)")
        await finish(pg); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        sw = await pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        ok(sw <= 1, f"{tag}: no sideways scroll ({sw})")
    ok(not errs, f"{tag0}: no page errors {errs[:3]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, 390, 844, True)
        await run(p, 1920, 1080, False)
        await run(p, 390, 844, True, "pl")
    print("RESULT", "OK" if not fails else f"FAIL ({len(fails)})")
    sys.exit(1 if fails else 0)

asyncio.run(main())
