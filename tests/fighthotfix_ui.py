"""Hotfix (build 232): pressing Attack in a fight must always do something. Usage: python fighthotfix_ui.py PORT — prints RESULT OK.
Runs with the minigames on (?games, like real players), PC and phone size, a vampire with Jenassa against bandits:
 1. Attack → the minigame shows → tap it → a move is spent and the foe loses health.
 2. A minigame that breaks (throws) still lets the move through as a normal hit.
 3. A minigame that never finishes and isn't on screen any more doesn't lock the buttons: the next press works."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8901"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration','Athletics','Acrobatics']) S.skills[k].lvl=45;
  S.mpBonus=60; for (const id of ['flames','healing']) if (D.SPELLS[id] && !S.spells.includes(id)) S.spells.push(id);
  S.vampire={since:0, fedAt:G.now()}; S.follower={id:'jenassa',hp:9999,ts:0};
  G.give(S,'potion_health',2); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
  S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
FIGHT = "(()=>{const b=document.querySelector('#modal [data-act=ev][data-c=fight]'); if(b){b.click();return true} if(document.querySelector('#tbf')) return true; document.querySelectorAll('#modal').forEach(m=>m.remove()); window.__dbg.openEvent(); return false})()"
STATE = "(()=>[TB.session?.f?.ehp ?? -1, document.querySelectorAll('#tbf .tbap i.on.ap').length, !!document.querySelector('#tbf [data-tba=attack]:not([disabled])')])()"

async def my_turn(pg):
    for _ in range(60):
        if await pg.evaluate("!!document.querySelector('#tbf .tbdone')"): return False
        if await pg.evaluate("!!document.querySelector('#tbf [data-tba=attack]:not([disabled])')"): return True
        await pg.wait_for_timeout(250)
    return False

async def run(b, w, h, tag):
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=w < 700)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fhx{w}&tb&games"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hotfix"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(START); await pg.wait_for_timeout(400)
    for _ in range(40):
        if await pg.evaluate(FIGHT): break
        await pg.wait_for_timeout(400)
    ok(await my_turn(pg), f"{tag}: my turn comes with Attack ready")
    # 1. normal attack through the minigame
    e0, p0, _ = await pg.evaluate(STATE)
    at = await pg.evaluate("(()=>{const r=document.querySelector('#tbf [data-tba=attack]').getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!e?.closest('[data-tba=attack]')})()")
    ok(at, f"{tag}: nothing covers the Attack button")
    await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(250)
    ok(await pg.evaluate("!!document.querySelector('#tbf .tbtime.mg')"), f"{tag}: the attack minigame shows")
    await pg.mouse.click(w // 2, h // 2); await pg.wait_for_timeout(900)
    e1, p1, _ = await pg.evaluate(STATE)
    ok(p1 < p0, f"{tag}: the attack spent a move ({p0}->{p1})")
    ok(e1 <= e0, f"{tag}: the foe's health went down or held (blocked/missed) ({e0:.0f}->{e1:.0f})")
    # 2. a minigame that throws
    if await my_turn(pg):
        e0, p0, _ = await pg.evaluate(STATE)
        await pg.evaluate("(()=>{window.__mgPlay=MINIGAME.play; MINIGAME.play=()=>{throw new Error('boom')}; return 1})()")
        await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(700)
        e1, p1, _ = await pg.evaluate(STATE)
        ok(p1 < p0 or e1 < e0 or not await pg.evaluate("TB.session?.cur?.id==='me'"), f"{tag}: a broken minigame still lets the attack through ({p0}->{p1})")
        await pg.evaluate("(()=>{MINIGAME.play=window.__mgPlay; return 1})()")
    # 3. a minigame that never finishes and is gone from the screen
    if await my_turn(pg):
        e0, p0, _ = await pg.evaluate(STATE)
        await pg.evaluate("(()=>{MINIGAME.play=()=>new Promise(()=>{}); return 1})()")
        await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{MINIGAME.play=()=>Promise.resolve(null); return 1})()")
        await pg.click("#tbf [data-tba=attack]"); await pg.wait_for_timeout(700)
        e1, p1, _ = await pg.evaluate(STATE)
        ok(p1 < p0 or not await pg.evaluate("TB.session?.cur?.id==='me'"), f"{tag}: a lost minigame doesn't lock the buttons ({p0}->{p1})")
        await pg.evaluate("(()=>{MINIGAME.play=window.__mgPlay; return 1})()")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        await run(b, 1920, 1080, "PC")
        await run(b, 390, 844, "phone")
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL " + "; ".join(fails))
asyncio.run(main())
