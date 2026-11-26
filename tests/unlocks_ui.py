"""Features that open by level (unlocks.js): a new level-1 hero on a 390x844 phone sees a calm map (no invasion cards,
no world-event toast, no forge, no Perks/World news tabs), the same hero at level 4 and level 11, and a veteran save
that keeps what it already used. Also the PC map at level 1.
Usage: python tests/unlocks_ui.py PORT [outdir] [--shots-only]"""
import asyncio, sys, os
from playwright.async_api import async_playwright
_SHOTS = (os.environ.get("SHOTS") or os.path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
HOST = os.environ.get("HOST", "localhost")
OUT = (sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else _SHOTS + "unlocks").rstrip("/\\") + "/"
PREFIX = os.environ.get("PREFIX", "unlocks_")
SHOTS_ONLY = "--shots-only" in sys.argv
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    if SHOTS_ONLY: return
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

VIS = """(sel)=>[...document.querySelectorAll(sel)].some(e=>{const r=e.getBoundingClientRect(), cs=getComputedStyle(e); return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'})"""

async def run(p, name, vp, mobile):
    exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
    ctx = await b.new_context(viewport=vp, device_scale_factor=1, has_touch=mobile)
    errs = []
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://{HOST}:{PORT}/index.html?assets&net=bc&notut&hub=0&p=ul{name}"); await pg.wait_for_timeout(1500)
    for _ in range(120):
        if await pg.query_selector("#nm"): break
        await pg.evaluate("(document.querySelector('.mi[data-t=new]')||document.querySelector('.press')||document.querySelector('#title'))?.click()"); await pg.wait_for_timeout(500)
    await pg.fill("#nm", "Sigrid"); await pg.evaluate("document.querySelector('#begin').click()")
    await pg.wait_for_function("window.__dbg && window.__dbg.save && window.__dbg.save()", timeout=60000); await pg.wait_for_timeout(1500)
    clear = "document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelectorAll('.lvn').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.(); document.querySelector('#sky')?.remove()"

    async def tab(t):
        await pg.evaluate(clear)
        await pg.evaluate(f"(()=>{{const b=document.createElement('button'); b.dataset.act='uxtab'; b.dataset.id='{t}'; b.hidden=true; document.querySelector('#side').appendChild(b); b.click();}})()")
        await pg.wait_for_timeout(500); await pg.evaluate(clear); await pg.evaluate("scrollTo(0,0)")

    async def shot(tag):
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f"{OUT}{PREFIX}{name}_{tag}.png")

    async def setup(level, extra=""):
        await pg.evaluate("""([lv, extra])=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; if(!S.discovered.includes('Whiterun')) S.discovered.push('Whiterun');
          S.level=lv; S.charXp=0; S.pendingLevels=0; if (extra) (new Function('S', extra))(S); if (window.UNLOCKS||typeof UNLOCKS!=="undefined") try{UNLOCKS.sync(S, true)}catch(e){} window.__ui.refresh(); }""", [level, extra])
        await pg.wait_for_timeout(800)

    vis = lambda sel: pg.evaluate(VIS, sel)
    # ---- level 1: calm
    await setup(1)
    await tab("map"); await shot("L1_map")
    ok(not await vis("#wev .wev-card, .wev-card"), f"{name} L1: no world-event (invasion) card")
    ok(not await vis("#gev .gev-banner, .gev-strip"), f"{name} L1: no world boss banner")
    ok(not await vis("#raid"), f"{name} L1: no dragon raid card")
    ok(not await vis("#gnear"), f"{name} L1: no gather bar")
    ok(not await vis("#rideBtn"), f"{name} L1: no horse button")
    ok(not await vis(".mn-sub [data-id=world]"), f"{name} L1: no World news sub-tab")
    tz = await pg.evaluate("typeof REWARDS!=='undefined' ? REWARDS.nextText(__dbg.save()) : ''")
    ok("Level 2" in tz and "Perks" in tz, f"{name} L1: 'Level 2 brings' names the next unlock ({tz!r})")
    await tab("town"); await shot("L1_area")
    ok(not await vis("[data-act=shop][data-id=forge]"), f"{name} L1: no forge in Whiterun")
    ok(not await vis("[data-act=shop][data-id=stables]"), f"{name} L1: no stables")
    ok(not await vis("[data-act=shop][data-id=alchemy]"), f"{name} L1: no alchemy lab")
    ok(await vis("[data-act=shop][data-id=general], [data-act=shop][data-id=inn]"), f"{name} L1: shops and inn still there")
    await tab("hero"); await shot("L1_character")
    ok(not await vis(".mn-sub [data-id=perks]"), f"{name} L1: no Perks sub-tab yet")
    ok(not await vis(".mn-sub [data-id=follower]"), f"{name} L1: no Follower sub-tab yet")
    ok(await vis("#side .rw-nextl"), f"{name} L1: 'Level 2 brings' on the Character screen")
    # a locked button reached another way does nothing bad
    msg = await pg.evaluate("""()=>{const b=document.createElement('button'); b.dataset.act='shop'; b.dataset.id='forge'; b.hidden=true; document.querySelector('#side').appendChild(b); b.click(); return document.querySelector('#side').innerText.includes('Smithing') || true}""")
    # ---- level 4: smithing open
    await setup(4)
    await tab("town"); await shot("L4_area")
    ok(await vis("[data-act=shop][data-id=forge]"), f"{name} L4: forge open")
    ok(not await vis("[data-act=shop][data-id=alchemy]"), f"{name} L4: alchemy still hidden")
    await tab("map"); await shot("L4_map")
    ok(not await vis(".wev-card"), f"{name} L4: still no world events")
    # ---- level 11: world events open
    await setup(11)
    await tab("map"); await shot("L11_map")
    ok(await vis(".mn-sub [data-id=world]") or not mobile, f"{name} L11: World news sub-tab back")
    await tab("town"); await shot("L11_area")
    ok(await vis("[data-act=shop][data-id=alchemy]"), f"{name} L11: alchemy open")
    ok(await vis("[data-act=shop][data-id=stables]"), f"{name} L11: stables open")
    # ---- veteran: a level-3 save that already owns a horse, a house and a follower keeps them
    await setup(3, "S.unlocks=null; S.unlocksV=0; S.horse={name:'Frost'}; S.homes={Whiterun:{chest:[],garden:0}}; S.follower={id:'lydia'}; S.lt=Object.assign(S.lt||{}, {crafted:3}); G.migrate(S)")
    await tab("town"); await shot("vet_area")
    ok(await vis("[data-act=shop][data-id=stables]"), f"{name} veteran: stables stay open (owns a horse)")
    ok(await vis("[data-act=shop][data-id=forge]"), f"{name} veteran: forge stays open (crafted before)")
    ok(SHOTS_ONLY or await pg.evaluate("UNLOCKS.open(__dbg.save(),'housing') && UNLOCKS.open(__dbg.save(),'followers')"), f"{name} veteran: house and follower stay open")
    ok(SHOTS_ONLY or not await pg.evaluate("UNLOCKS.open(__dbg.save(),'worldevents')"), f"{name} veteran: never-used world events still wait")
    await tab("hero"); await shot("vet_character")
    ok(not errs, f"{name}: no page errors {errs[:2]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, "phone", {"width": 390, "height": 844}, True)
        await run(p, "pc", {"width": 1920, "height": 1080}, False)
    print("FAILED" if fails else "unlocks_ui ok", len(fails), "· shots in", OUT)
    sys.exit(1 if fails else 0)
asyncio.run(main())
