"""One overlay at a time (overlays.js + the fight hints in onboard.js), on a phone (390x844) and a PC (1920x1080).
  node serve.js 8765 &   then   python overlays_ui.py 8765 [outdir]   — prints RESULT OK.
Checks: the first fight shows short hints pinned to the turn order and the moves (no tip card), none of them covers a
button, a move swaps them for the End turn hint, the VICTORY card shows with no tip or hint on top, a tip that comes up
while a window is open waits under it and shows once the window closes, and the courier's letter waits while a PC menu
is open. Screenshots go to outdir (default: overlays_shots in the temp folder)."""
import asyncio, os, sys, tempfile, time
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "overlays_shots")
os.makedirs(OUT, exist_ok=True)
START = """()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S=window.__dbg.save(); S.level=20; for (const k of ['One-Handed','Destruction','Restoration']) S.skills[k].lvl=45;
  G.give(S,'potion_health',2); S.dungeon=null; S.trip=null; S.sideAsked=true; S.onb={seen:{welcome:1},hid:{}};
  [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
  const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }"""
MYTURN = "(()=>{const b=document.querySelector('#tbf [data-tba=end]'); return !!b && !b.disabled && !(typeof FIGHTART!=='undefined' && FIGHTART.playing && FIGHTART.playing()) && !TB.session?.done})()"
HINTS = "[...document.querySelectorAll('#fhints .fhint:not([hidden])')].map(e=>e.dataset.h).join(',')"
SHOWN = "(q)=>{ const e=document.querySelector(q); return !!e && e.getClientRects().length>0 && getComputedStyle(e).display!=='none'; }"
COVER = """(()=>{ const out=[]; const hit=(a,b)=>a.bottom>b.top && a.top<b.bottom && a.right>b.left && a.left<b.right;
  for (const t of document.querySelectorAll('#fhints .fhint:not([hidden])')) { const r=t.getBoundingClientRect();
    for (const b of document.querySelectorAll('#tbf button, #tbf .tbu, #tbf .tbap')) { const q=b.getBoundingClientRect(); if (q.width && hit(r,q)) out.push((b.innerText||b.className).split('\\n')[0].slice(0,24)); }
    if (r.left < 0 || r.right > innerWidth + 1 || r.top < 0 || r.bottom > innerHeight) out.push('off screen'); }
  return out; })()"""
fails = []


async def run(b, w, h):
    tag = f"{w}x{h}"
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, has_touch=w < 900)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    def check(c, m):
        print(("ok   " if c else "FAIL ") + tag + " " + m)
        if not c: fails.append(f"{tag}: {m}")
    shot = lambda n: pg.screenshot(path=os.path.join(OUT, f"{tag}_{n}.png"))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ovl{w}{int(time.time())}&tb"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('#obtip').forEach(e=>e.remove())")
    await pg.evaluate(START); await pg.wait_for_timeout(400)
    await pg.click("#modal [data-act=ev][data-c=fight]")
    for _ in range(80):
        if await pg.evaluate(MYTURN): break
        await pg.wait_for_timeout(250)
    await pg.mouse.move(1, 1); await pg.wait_for_timeout(1200); await shot("1_first_turn")
    check(await pg.evaluate(HINTS) == "order,moves", "first turn: turn-order and moves hints (" + await pg.evaluate(HINTS) + ")")
    check(not await pg.evaluate(f"({SHOWN})('#obtip')"), "no tip card over the fight")
    cov = await pg.evaluate(COVER); check(not cov, f"hints cover nothing {cov}")
    await pg.evaluate("document.querySelector('#tbf [data-tba=attack]').click()")
    for _ in range(40):
        await pg.wait_for_timeout(250)
        if await pg.evaluate(MYTURN): break
    await pg.mouse.move(1, 1); await pg.wait_for_timeout(800); await shot("2_after_move")
    check(await pg.evaluate(HINTS) == "end", "after a move: only the End turn hint (" + await pg.evaluate(HINTS) + ")")
    cov = await pg.evaluate(COVER); check(not cov, f"End turn hint covers nothing {cov}")
    check(await pg.evaluate("!!__dbg.save().onb.seen['tbf-order'] && !!__dbg.save().onb.seen['tbf-moves']"), "used hints are remembered")
    for _ in range(160):
        if await pg.query_selector("#tbf .tbdone"): break
        await pg.evaluate("(()=>{const s=TB.session; if(s){ s.f.ehp=Math.min(s.f.ehp,1); s.f.hp=Math.max(s.f.hp,50); s.f.sp=Math.max(s.f.sp,200); }})()")
        if await pg.evaluate(MYTURN):
            await pg.evaluate("(()=>{const s=TB.session; const a=document.querySelector('#tbf [data-tba=attack]'); if(a && s.canAfford('attack') && s.myActs<s.st.acts) a.click(); else document.querySelector('#tbf [data-tba=end]')?.click();})()")
        await pg.wait_for_timeout(400)
    await pg.wait_for_timeout(1500); await shot("3_result")
    check(await pg.evaluate("document.body.dataset.ovl") == "result", "the result card is the top overlay")
    check(await pg.evaluate("!document.querySelector('#fhints') && !document.querySelector('#obtip')"), "no hint or tip over the result card")
    if await pg.query_selector("#tbf [data-tbx=done]"): await pg.click("#tbf [data-tbx=done]"); await pg.wait_for_timeout(900)
    for _ in range(4):
        if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(300)
        else: await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    # a tip that comes up under an open window waits
    await pg.evaluate("(()=>{const s=__dbg.save(); s.trip=null; s.location='Whiterun'; s.level=3; s.pendingLevels=1; s.onb.seen={welcome:1}; __dbg.message('A courier arrives','A letter for you.');})()")
    await pg.wait_for_timeout(1800); await shot("4_window")
    check(not await pg.evaluate(f"({SHOWN})('#obtip')"), "the level-up tip waits under the window")
    # closing it may open the next window (a quest update); the tip keeps waiting until the screen is clear
    for _ in range(10):
        await pg.evaluate("(()=>{const b=document.querySelector('#modal [data-act=close]')||document.querySelector('#modal .sheet button'); if(b) b.click(); else document.querySelectorAll('#modal').forEach(m=>m.remove());})()")
        await pg.wait_for_timeout(500)
        if not await pg.evaluate("!!document.querySelector('#modal') || (typeof NOTICES!=='undefined' && NOTICES.queued>0)"): break   # notices.js: a waiting message opens a moment after the last one closes
    await pg.wait_for_timeout(1500); await shot("5_after_window")
    check(await pg.evaluate(f"({SHOWN})('#obtip')"), "the tip shows once the window is closed")
    check(not await pg.evaluate("!!__dbg.save().onb.seen.level"), "a held tip isn't marked as read")
    await pg.evaluate("document.querySelector('#obtip [data-obt=ok]')?.click()")
    # the courier's letter waits while a PC menu screen is open
    if w >= 900:
        await pg.evaluate("(()=>{const b=document.createElement('button'); b.dataset.act='uxtab'; b.dataset.id='social'; b.hidden=true; document.querySelector('#side').appendChild(b); b.click();})()")
        await pg.wait_for_timeout(800)
        if await pg.evaluate("OVERLAYS.menuOpen()"):
            await pg.evaluate("(()=>{const s=__dbg.save(); s.level=20; s.sideAsked=false; QUESTS.ensure(s);})()")
            await pg.evaluate("typeof SIDEUI!=='undefined' && SIDEUI.letter()"); await pg.wait_for_timeout(500)
            check(not await pg.query_selector("#modal .sletter-sheet"), "the letter waits while a menu is open")
        else: print("     (no PC menu screen here; letter check skipped)")
    check(not errs, f"no page errors {errs[:2]}")
    await ctx.close()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None)
        await run(b, 390, 844)
        await run(b, 1920, 1080)
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL\n" + "\n".join(fails))
    sys.exit(1 if fails else 0)
asyncio.run(main())
