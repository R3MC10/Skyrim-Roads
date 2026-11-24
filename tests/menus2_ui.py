"""Tidier tab menus (menus2.js): one sort row with direction, Damage/Armour sorts, counts, search, list stays visible on
phones, 3 columns on wide screens, folding Character sections, one follower tab row, quest search, pixel style.
Usage: python3 menus2_ui.py PORT   (screenshots go to $OUT or /home/claude/tests/menus2/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT", "/home/claude/tests/menus2/")
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
SETUP = """()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=500; S.level=10;
 for(const i of ['iron_sword','steel_greatsword','hunting_bow','iron_armor','iron_helmet','leather_boots','potion_health','apple','iron_ingot'])
   { if(D.ITEMS[i]) G.give(S,i,1); }
 S.spells=[...new Set([...(S.spells||[]),'firebolt','healing','oakflesh','fury','candlelight'].filter(s=>D.SPELLS[s]))];
 QUESTS.ensure(S); S.quests.companions={stage:1,t:G.now()}; S.quests.college={stage:0,t:G.now()};
 try{ S.follower={id:'lydia',hp:TOWNS.followerMax(S,'lydia'),ts:G.now()}; }catch(e){}
}"""
CLEAR = "setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner').forEach(m=>m.remove()),150)"
async def start(b, w, h, tag):
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=m2{tag}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate(SETUP); await pg.evaluate(CLEAR)
    return pg, errs
async def overflow(pg, sel):
    return await pg.evaluate("""(sel)=>{const W=innerWidth,o=[];for(const e of document.querySelectorAll(sel+' *')){const r=e.getBoundingClientRect();
      if(!r.width||getComputedStyle(e).position==='fixed')continue; let p=e.parentElement,clip=false; while(p&&p!==document.body){const s=getComputedStyle(p); if(/auto|scroll|hidden/.test(s.overflowX)){clip=true;break} p=p.parentElement}
      if(!clip&&r.right>W+1)o.push((e.className||e.tagName)+'@'+Math.round(r.right));} return o.slice(0,5)}""", sel)
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        # ---------------- phone 360x780
        pg, errs = await start(b, 360, 780, "ph")
        await pg.evaluate("window.__ui.openMenu('items')"); await pg.wait_for_timeout(400)
        cats = await pg.evaluate("[...document.querySelectorAll('#sky .sky-cat')].map(c=>c.dataset.id)")
        ok(cats[:2] == ["gear", "all"] and "weapons" in cats and "apparel" in cats, f"item categories {cats}")
        await pg.click("#sky .sky-cat[data-id=all]"); await pg.wait_for_timeout(300)
        n = await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=all] .m2-n')?.innerText")
        rows = await pg.evaluate("document.querySelectorAll('#sky .sky-list .sky-row').length")
        ok(n and int(n) == rows, f"All badge {n} = rows {rows}")
        ok(await pg.evaluate("document.querySelectorAll('#sky .m2-sort').length") == 1, "one sort row")
        ok(await pg.evaluate("!!document.querySelector('#sky [data-act=skysort][data-id=dmg]')") and await pg.evaluate("!!document.querySelector('#sky [data-act=skysort][data-id=arm]')"), "Damage and Armour sorts")
        await pg.click("#sky [data-act=skysort][data-id=value]"); await pg.wait_for_timeout(250)
        vals = await pg.evaluate("[...document.querySelectorAll('#sky .sky-list .sky-row:not(.eq)')].map(r=>+r.lastElementChild.innerText.replace(/[^0-9.]/g,''))")
        ok(vals == sorted(vals, reverse=True), f"value high first {vals[:6]}")
        await pg.click("#sky .m2-dir"); await pg.wait_for_timeout(250)
        vals = await pg.evaluate("[...document.querySelectorAll('#sky .sky-list .sky-row:not(.eq)')].map(r=>+r.lastElementChild.innerText.replace(/[^0-9.]/g,''))")
        ok(vals == sorted(vals), f"direction flips to low first {vals[:6]}")
        ok("Low first" in await pg.evaluate("document.querySelector('#sky .m2-dir').getAttribute('aria-label')"), "direction label")
        await pg.click("#sky .sky-list .sky-row"); await pg.wait_for_timeout(300)
        vis = await pg.evaluate("""()=>{const l=document.querySelector('#sky .sky-list').getBoundingClientRect(); return [...document.querySelectorAll('#sky .sky-row')].filter(r=>{const b=r.getBoundingClientRect(); return b.top>=l.top-1&&b.bottom<=l.bottom+1&&b.bottom<=innerHeight}).length}""")
        ok(vis >= 3, f"list keeps {vis} rows visible with a picked item")
        ok(await pg.evaluate("!!document.querySelector('#sky .sky-detail')"), "detail shows")
        await pg.fill("#skysearch", "sword"); await pg.wait_for_timeout(400)
        names = await pg.evaluate("[...document.querySelectorAll('#sky .sky-list .sky-row .nm')].map(e=>e.innerText.toLowerCase())")
        ok(names and all("sword" in x for x in names), f"item search {names}")
        ok(await overflow(pg, "#sky") == [], f"items fit at 360 {await overflow(pg, '#sky')}")
        await pg.screenshot(path=OUT + "items_360.png")
        # magic
        await pg.evaluate("window.__ui.closeMenu(); window.__ui.openMenu('magic')"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("!!document.querySelector('#sky [data-act=skymsort][data-id=school]')"), "magic sort by school")
        await pg.click("#sky [data-act=skymsort][data-id=cost]"); await pg.wait_for_timeout(250)
        await pg.fill("#skysearch", "fire"); await pg.wait_for_timeout(400)
        mn = await pg.evaluate("[...document.querySelectorAll('#sky .sky-list .sky-row')].map(e=>e.innerText.toLowerCase())")
        ok(mn and all("fire" in x for x in mn), f"spell search {mn}")
        ok(await overflow(pg, "#sky") == [], "magic fits at 360")
        await pg.screenshot(path=OUT + "magic_360.png")
        await pg.evaluate("window.__ui.closeMenu()")
        # character
        await pg.evaluate("window.__ui.go('hero')"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("!!document.querySelector('#side .m2-hero')"), "hero card")
        folds = await pg.evaluate("Object.fromEntries([...document.querySelectorAll('#side details[data-m2f]')].map(d=>[d.dataset.m2f,d.open]))")
        ok(folds.get("progress") and folds.get("perks") is False and folds.get("skills") is False and "powers" in folds, f"folds {folds}")
        ok("Powers & shouts" in await pg.evaluate("document.querySelector('#side').textContent"), "Powers & shouts still on Character")
        h = await pg.evaluate("document.querySelector('#side').scrollHeight")
        ok(h < 4200, f"Character page is shorter ({h}px)")
        await pg.click("#side details[data-m2f=perks] summary"); await pg.wait_for_timeout(250)
        ok(await pg.evaluate("document.querySelectorAll('#side [data-act=pskill]').length") > 0, "perks fold opens with skill buttons")
        ok(await overflow(pg, "#side") == [], f"Character fits at 360 {await overflow(pg, '#side')}")
        await pg.screenshot(path=OUT + "hero_360.png", full_page=True)
        await pg.evaluate("window.__ui.go('follower')"); await pg.wait_for_timeout(400)   # followertab.js: the follower has their own tab now
        tabs = await pg.evaluate("""()=>{const t=[...document.querySelectorAll('#side .fol2tabs button')]; return {n:t.length, tops:[...new Set(t.map(b=>Math.round(b.getBoundingClientRect().top)))].length}}""")
        ok(tabs["n"] == 6 and tabs["tops"] == 1, f"follower tabs on one row {tabs}")
        # journal search
        await pg.evaluate("window.__ui.go('log')"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("!!document.querySelector('#m2jq')"), "quest search box")
        await pg.fill("#m2jq", "companions"); await pg.wait_for_timeout(300)
        shown = await pg.evaluate("[...document.querySelectorAll('#j-quests .qcard:not(.m2-hide)')].length")
        ok(shown >= 1 and await pg.evaluate("[...document.querySelectorAll('#j-quests .qcard:not(.m2-hide)')].every(c=>/companions/i.test(c.innerText))"), f"quest search filters ({shown})")
        await pg.fill("#m2jq", "zzqq"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("!!document.querySelector('#j-quests .m2-none')"), "no-match note")
        ok(not errs, f"no page errors {errs[:3]}")
        # ---------------- desktop 1920x1080, pixel style too
        pg, errs = await start(b, 1920, 1080, "dt")
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')"); await pg.wait_for_timeout(300)
            await pg.evaluate("window.__ui.openMenu('items')"); await pg.wait_for_timeout(400)
            await pg.click("#sky .sky-cat[data-id=all]"); await pg.wait_for_timeout(300)
            await pg.click("#sky .sky-list .sky-row"); await pg.wait_for_timeout(300)
            box = await pg.evaluate("""()=>{const g=s=>document.querySelector('#sky '+s)?.getBoundingClientRect(); const c=g('.sky-cats'),m=g('.sky-mid'),d=g('.sky-detail'); return c&&m&&d?[c.left,c.right,m.left,m.right,d.left,d.top,m.top]:null}""")
            ok(box and box[1] <= box[2] + 2 and box[3] <= box[4] + 2 and abs(box[5] - box[6]) < 120, f"{style}: 3 columns at 1920 {box}")
            ok(await overflow(pg, "#sky") == [], f"{style}: nothing cut off at 1920")
            await pg.screenshot(path=OUT + f"items_1920_{style}.png")
            await pg.evaluate("window.__ui.closeMenu()")
        ok(not errs, f"no page errors desktop {errs[:3]}")
        await b.close()
    print("FAILS:", fails if fails else "none")
    sys.exit(1 if fails else 0)
asyncio.run(main())
