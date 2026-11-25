"""A place full screen (locscreen.js): entering Whiterun, a farm and a camp at phone 360 / 390 and PC 1440 / 1920.
   The scene is up with its title and signposts, nothing sticks out or is smaller than 44 px, signposts don't sit on
   top of each other on a PC, a shop opens and its back button comes back to the scene, a place's own card opens and
   closes, the List toggle is remembered, and arrows / Enter / Esc work on a PC.
   usage: python3 locscreen_ui.py [port]   (shots in $SHOTS/loc/, or the temp folder)"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
OUT = os.path.join(os.environ.get("SHOTS") or tempfile.gettempdir(), "loc"); os.makedirs(OUT, exist_ok=True)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

OVER = """()=>{const r=document.querySelector('#locs'); const sc=[...r.querySelectorAll('*')].filter(e=>/auto|scroll|hidden/.test(getComputedStyle(e).overflowX)&&!e.classList.contains('ls-stage')&&!e.classList.contains('ls'));
  return [...r.querySelectorAll('.ls-head *, .ls-spot, .ls-people, .ls-sheet:not([hidden])')].filter(e=>{const q=e.getBoundingClientRect(); return q.width>0 && (q.right>innerWidth+1||q.left<-1) && !sc.some(x=>x!==e&&x.contains(e))}).slice(0,4).map(e=>e.tagName+'.'+e.className)}"""
SMALL = """()=>[...document.querySelectorAll('#locs .ls-spot, #locs .ls-btns .btn, #locs button.ls-who, #locs .ls-x')].filter(e=>e.offsetParent&&e.closest('.ls-sheet:not([hidden]), .ls-head, .ls-spots, .ls-people')).filter(e=>{const q=e.getBoundingClientRect(); return q.width<44||q.height<44}).map(e=>(e.dataset.id||e.className)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)).slice(0,5)"""
CLIP = """()=>[...document.querySelectorAll('#locs .ls-name, #locs .ls-btns .btn')].filter(e=>e.offsetParent && e.scrollWidth>e.clientWidth+2).map(e=>e.textContent).slice(0,4)"""
# PC: signposts inside the window, not on each other, not under the title
PINS = """()=>{const b=[...document.querySelectorAll('#locs .ls-spot')].map(e=>[e.dataset.id,e.getBoundingClientRect()]); const out=[], hd=document.querySelector('#locs .ls-tt').getBoundingClientRect(), ft=document.querySelector('#locs .ls-people')?.getBoundingClientRect();
  const lr=document.querySelector('#locs').getBoundingClientRect();
  for(const [id,q] of b){ if(q.left<lr.left||q.right>lr.right||q.top<lr.top||q.bottom>lr.bottom) out.push('outside:'+id);
    if(q.top<hd.bottom-2&&q.right>hd.left&&q.left<hd.right) out.push('under title:'+id); if(ft&&q.bottom>ft.top+10) out.push('under people:'+id);}
  for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){const p=b[i][1],q=b[j][1]; if(p.left<q.right-2&&q.left<p.right-2&&p.top<q.bottom-2&&q.top<p.bottom-2) out.push(b[i][0]+'/'+b[j][0]);}
  return out.slice(0,6)}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for (w, h) in [(360, 740), (390, 844), (1440, 900), (1920, 1080)]:
            pc = w >= 1000; tag = f"{w}"
            ctx = await b.new_context(viewport={"width": w, "height": h})
            await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='en';localStorage.setItem('rotn_prefs',JSON.stringify(p));}catch(e){}")
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=ls{tag}&notut"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('#sky') && window.__ui.back && window.__ui.back()")
            async def go(place):
                await clear()
                await pg.evaluate("""(pl)=>{const S=window.__dbg.save(); S.trip=null; S.dungeon=null; S.location=pl; [S.x,S.y]=WORLD.places[pl]; S.level=14; S.gold=3000; window.__ui.refresh();}""", place)
                await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(700); await clear()
            async def up(): return await pg.evaluate("!!document.querySelector('#locs:not([hidden]) .ls')")

            # ---- Whiterun
            await go("Whiterun")
            check(await up(), f"{tag}: Whiterun opens full screen")
            r = await pg.evaluate("(()=>{const q=document.querySelector('#locs').getBoundingClientRect(); return [q.width,q.height]})()")
            check(r[0] >= w - 1 and r[1] >= h * 0.8, f"{tag}: the scene fills the screen ({r})")
            n = await pg.evaluate("document.querySelectorAll('#locs .ls-spot').length")
            check(n >= 12, f"{tag}: signposts for the town's places ({n})")
            title = await pg.evaluate("document.querySelector('#locs .ls-name').textContent")
            check(title == "Whiterun", f"{tag}: title is the place's name ({title})")
            bg = await pg.evaluate("document.querySelector('#locs .ls-bg').style.backgroundImage")
            check("place-whiterun" in bg, f"{tag}: Whiterun's own painting ({bg[:60]})")
            check(await pg.evaluate(OVER) == [], f"{tag}: nothing sticks out {await pg.evaluate(OVER)}")
            check(await pg.evaluate(SMALL) == [], f"{tag}: every button at least 44 px {await pg.evaluate(SMALL)}")
            check(await pg.evaluate(CLIP) == [], f"{tag}: title and buttons not clipped {await pg.evaluate(CLIP)}")
            if pc: check(await pg.evaluate(PINS) == [], f"{tag}: signposts apart and in view {await pg.evaluate(PINS)}")
            else:
                lst = await pg.evaluate("getComputedStyle(document.querySelector('#locs .ls-spots')).display")
                check(lst == "grid", f"{tag}: phone shows the signposts as a list ({lst})")
            ppl = await pg.evaluate("document.querySelectorAll('#locs .ls-who').length")
            check(ppl >= 2, f"{tag}: people here along the bottom ({ppl})")
            await pg.wait_for_timeout(600); await pg.screenshot(path=f"{OUT}/whiterun_{tag}.png")

            # open a shop and come back
            await pg.evaluate("document.querySelector('#locs .ls-spot[data-id=general]').click()"); await pg.wait_for_timeout(500)
            check(not await up(), f"{tag}: opening General goods leaves the scene")
            check(await pg.query_selector("#side [data-act=buy]") is not None, f"{tag}: General goods shows its stock")
            await pg.screenshot(path=f"{OUT}/whiterun_shop_{tag}.png")
            await pg.evaluate("document.querySelector('#side .au-back').click()"); await pg.wait_for_timeout(500)
            check(await up(), f"{tag}: the shop's back button returns to the scene")

            # keyboard (PC)
            if pc:
                await clear(); await pg.mouse.move(5, h // 2)
                await pg.keyboard.press("ArrowRight")
                f1 = await pg.evaluate("document.activeElement?.dataset?.id||''")
                await pg.keyboard.press("ArrowRight")
                f2 = await pg.evaluate("document.activeElement?.dataset?.id||''")
                await pg.keyboard.press("s")
                f3 = await pg.evaluate("document.activeElement?.dataset?.id||''")
                check(f1 and f2 and f1 != f2 and f3, f"{tag}: arrows and WASD walk between signposts ({f1} -> {f2} -> {f3})")
                await pg.screenshot(path=f"{OUT}/whiterun_focus_{tag}.png")
                await pg.evaluate("document.activeElement.dataset.act!=='shop' && document.querySelector('#locs .ls-spot[data-act=shop]').focus()")
                await pg.keyboard.press("Enter"); await pg.wait_for_timeout(400)
                check(not await up() and await pg.query_selector("#side .au-back") is not None, f"{tag}: Enter opens the signpost")
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
                check(await up(), f"{tag}: Esc in a shop goes back to the scene")
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
                tb = await pg.evaluate("document.querySelector('#side')?.dataset.tab")
                check(not await up() and tb != "town", f"{tag}: Esc on the scene leaves to the map ({tb})")

            # List toggle, remembered
            await go("Whiterun")
            await pg.evaluate("document.querySelector('#locs .ls-list').click()"); await pg.wait_for_timeout(400)
            check(not await up() and await pg.query_selector("#side .au-tile") is not None, f"{tag}: List shows the old board")
            await go("Riverwood")
            check(not await up(), f"{tag}: List is remembered at the next place")
            await pg.evaluate("document.querySelector('#side .ls-scenebtn').click()"); await pg.wait_for_timeout(400)
            check(await up(), f"{tag}: Scene view brings the picture back")

            # ---- a farm and a camp: the place's own card
            for place, slug in [("Katla's Farm", "farm"), ("Halted Stream Camp", "camp")]:
                await go(place)
                check(await up(), f"{tag}: {place} opens full screen")
                kind = await pg.evaluate("document.querySelector('#locs .ls').className")
                check(f"ls-{slug}" in kind, f"{tag}: {place} is a {slug} ({kind[:40]})")
                check(await pg.evaluate(OVER) == [], f"{tag}: {slug}: nothing sticks out {await pg.evaluate(OVER)}")
                check(await pg.evaluate(SMALL) == [], f"{tag}: {slug}: buttons at least 44 px {await pg.evaluate(SMALL)}")
                await pg.wait_for_timeout(400); await pg.screenshot(path=f"{OUT}/{slug}_{tag}.png")
                await pg.evaluate("document.querySelector('#locs .ls-spot[data-id=main]').click()"); await pg.wait_for_timeout(400)
                vis = await pg.evaluate("!!document.querySelector('#locs .ls-sheet[data-sheet=main]:not([hidden])')")
                check(vis, f"{tag}: {slug}: its own card opens on the scene")
                check(await pg.evaluate(SMALL) == [], f"{tag}: {slug}: card buttons at least 44 px {await pg.evaluate(SMALL)}")
                await pg.screenshot(path=f"{OUT}/{slug}_card_{tag}.png")
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
                gone = await pg.evaluate("!document.querySelector('#locs .ls-sheet:not([hidden])')")
                check(gone and await up(), f"{tag}: {slug}: Esc closes the card, the scene stays")
            check(not errs, f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print(f"\n{len(fails)} failed" if fails else "\nall ok")
    sys.exit(1 if fails else 0)

asyncio.run(main())
