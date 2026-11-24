"""The follower's own Character tab (followertab.js) at phone size (360x780):
empty state, top tab row fits and scrolls, one-line summary on Character, SkyUI-style gear list (categories, sort,
◆ worn, details with comparison), Give & equip / Take between the two packs.
Usage: python3 followertab_ui.py PORT   (screenshots go to $OUT or tests/out_followertab/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.environ.get("OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_followertab")) + os.sep
os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
SETUP = """()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=500; S.level=12; S.thaneWhiterun=true;
 for(const i of ['steel_greatsword','elven_sword','iron_helmet','leather_boots','potion_health','potion_health']) if(D.ITEMS[i]) G.give(S,i,1); }"""
HIRE = "()=>{const S=window.__dbg.save(); const m=TOWNS.hire(S,'lydia'); window.__ui.refresh(); return m}"
CLEAR = "setInterval(()=>document.querySelectorAll('#modal,.toast,.pbanner,#banner,.pban').forEach(m=>m.remove()),150)"
OVER = """()=>{const W=innerWidth,o=[];for(const e of document.querySelectorAll('#side *')){const r=e.getBoundingClientRect();
  if(!r.width||getComputedStyle(e).position==='fixed')continue; let p=e.parentElement,clip=false; while(p&&p!==document.body){const s=getComputedStyle(p); if(/auto|scroll|hidden/.test(s.overflowX)){clip=true;break} p=p.parentElement}
  if(!clip&&r.right>W+1)o.push((e.className||e.tagName)+'@'+Math.round(r.right));} return o.slice(0,5)}"""
async def run(b, style):
    ctx = await b.new_context(viewport={"width": 360, "height": 780}, device_scale_factor=1)
    await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ft{style}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate(SETUP); await pg.evaluate(CLEAR)
    async def tap(sel):
        try: await pg.click(sel, timeout=4000); await pg.wait_for_timeout(250); return True
        except Exception: return False
    async def snap(sel, fn):
        for _ in range(3):
            try:
                await pg.evaluate("document.querySelectorAll('.pban,.toast').forEach(m=>m.remove())")
                el = await pg.query_selector(sel)
                if el: await el.screenshot(path=OUT + fn, timeout=6000); return True
            except Exception: await pg.wait_for_timeout(300)
        return False
    # ---- no follower: friendly empty state; the tab row fits/scrolls at 360
    await pg.evaluate("window.__ui.go('follower')"); await pg.wait_for_timeout(400)
    txt = await pg.evaluate("document.querySelector('#side').innerText")
    ok("travelling alone" in txt and "Lydia" in txt, f"{style}: empty state says where to hire")
    bar = await pg.evaluate("""()=>{const r=document.querySelector('#side .mn-sub'); if(!r) return null; const on=r.querySelector('button.on'); const b=on.getBoundingClientRect();
      return {sw:r.scrollWidth, cw:r.clientWidth, ox:getComputedStyle(r).overflowX, on:on.dataset.id, vis:b.left>=-1&&b.right<=innerWidth+1, n:r.querySelectorAll('button').length}}""")
    ok(bar and bar["on"] == "follower" and bar["vis"], f"{style}: Follower tab is in the top row and in view {bar}")
    ok(bar and (bar["sw"] <= bar["cw"] or bar["ox"] in ("auto", "scroll")), f"{style}: top tab row scrolls when it doesn't fit {bar}")
    ok(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"{style}: no sideways page scroll")
    await snap("#side .ft-empty", f"empty_{style}.png")
    # ---- hire Lydia: Character keeps one line, the tab has everything
    await pg.evaluate(HIRE)
    await pg.evaluate("window.__ui.go('hero')"); await pg.wait_for_timeout(400)
    ok(await pg.evaluate("!!document.querySelector('#side .ft-line') && !document.querySelector('#side .fol2')"), f"{style}: Character has only the one-line summary")
    await tap("#side .ft-line")
    ok(await pg.evaluate("window.__ui.tab") == "follower", f"{style}: the line opens the Follower tab")
    t2 = await pg.evaluate("document.querySelector('#side .fol2')?.textContent || ''")
    ok("Lydia" in t2 and "Dismiss" in t2 and "Fighting style" in t2, f"{style}: overview with Dismiss and fighting style")
    await snap("#side .fol2", f"overview_{style}.png")
    # ---- gear: SkyUI list
    await tap(".fol2 [data-op=view][data-id=inv]")
    n = await pg.evaluate("document.querySelectorAll('.fol2 .ft-list .sky-row').length")
    ok(n >= 3 and await pg.evaluate("!!document.querySelector('.fol2 .ft-list .sky-row.eq .eqm')"), f"{style}: their pack as a list with ◆ worn ({n})")
    cats = await pg.evaluate("[...document.querySelectorAll('.fol2 .ft-cats .sky-cat')].map(c=>c.dataset.id)")
    ok(cats == ["all", "weapons", "apparel", "potions", "misc"], f"{style}: category filters {cats}")
    await tap(".fol2 .ft-cats [data-id=apparel]")
    ok(await pg.evaluate("[...document.querySelectorAll('.fol2 .ft-list .sky-row')].every(r=>!/Sword/.test(r.innerText))"), f"{style}: Armor filter hides swords")
    await tap(".fol2 .ft-cats [data-id=all]")
    # your pack -> pick the elven sword -> comparison -> Give & equip
    await tap(".fol2 [data-op=ftside][data-id=yours]")
    await tap(".fol2 .ft-sort [data-id=weight]")
    w = await pg.evaluate("[...document.querySelectorAll('.fol2 .ft-list .sky-row:not(.eq)')].map(r=>+r.querySelectorAll('.num')[1].innerText)")
    ok(len(w) >= 3 and w == sorted(w, reverse=True), f"{style}: your pack sorted by weight {w}")
    await tap(".fol2 .ft-sort [data-id=name]")
    await tap(".fol2 .ft-list .sky-row:has-text('Elven Sword')")
    cmp = await pg.evaluate("document.querySelector('.fol2 .ft-cmp')?.innerText || ''")
    ok("Steel Sword" in cmp and "→" in cmp, f"{style}: details compare with what she wears: {cmp!r}")
    await pg.evaluate("document.querySelector('.fol2 .ft-detail')?.scrollIntoView({block:'center'})")
    await snap(".fol2 .ft-gear", f"gear_{style}.png")
    await tap(".fol2 .ft-detail [data-op=ftgiveeq]")
    worn = await pg.evaluate("()=>{const f=FOL2.st(window.__dbg.save()); return f.inv.find(r=>r.id===f.eq.weapon)?.item}")
    ok(worn == "elven_sword", f"{style}: Give & equip: she wields {worn}")
    # their pack -> take the potion... give potions first, then take one back
    await tap(".fol2 .ft-cats [data-id=potions]")
    await tap(".fol2 .ft-list .sky-row:has-text('Potion of Healing')")
    await tap(".fol2 .ft-detail [data-op=give]")
    await tap(".fol2 [data-op=ftside][data-id=theirs]")
    await tap(".fol2 .ft-list .sky-row:has-text('Potion of Healing')")
    before = await pg.evaluate("window.__dbg.save().inv.filter(r=>r.item==='potion_health').reduce((a,r)=>a+r.qty,0)")
    await tap(".fol2 .ft-detail [data-op=take]")
    after = await pg.evaluate("window.__dbg.save().inv.filter(r=>r.item==='potion_health').reduce((a,r)=>a+r.qty,0)")
    ok(after == before + 1, f"{style}: Take gives a potion back ({before}->{after})")
    ok(await pg.evaluate(OVER) == [], f"{style}: gear fits at 360 {await pg.evaluate(OVER)}")
    ok(not errs, f"{style}: no page errors {errs[:3]}")
    await ctx.close()
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        for style in ["ink"]: await run(b, style)
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
    sys.exit(1 if fails else 0)
asyncio.run(main())
