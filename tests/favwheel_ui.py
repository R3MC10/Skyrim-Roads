"""Favourites wheel in the browser: star items and spells in the menus, open the wheel (button and long-press), pick to equip / ready / queue.
python3 favwheel_ui.py <port>  — prints RESULT OK."""
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8837"
async def run(b, style, errs):
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=False)
    await ctx.add_init_script(f"try{{localStorage.setItem('artStyle','{style}')}}catch(e){{}}")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&motion&p=fw{style}"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hulda"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),250)")
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=20; G.give(S,'steel_sword'); G.give(S,'iron_war_axe'); G.give(S,'potion_health',3); if(!S.spells.includes('flames')) S.spells.push('flames'); S.skills.Destruction.lvl=40;}""")
    res = {}
    # Items menu: star the steel sword
    await pg.evaluate("__ui.openMenu('items')"); await pg.wait_for_timeout(500)
    sid = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='steel_sword').id")
    await pg.click("#sky [data-act=skycat][data-id=all]"); await pg.wait_for_timeout(300)
    await pg.click(f"#sky .sky-row[data-id='{sid}']"); await pg.wait_for_timeout(400)
    res["star_in_items"] = await pg.query_selector("#sky .fw-star") is not None
    await pg.click("#sky .fw-star"); await pg.wait_for_timeout(400)
    res["starred"] = await pg.evaluate("(window.__dbg.save().favs||[]).some(f=>f.id==='steel_sword')")
    res["star_on"] = await pg.evaluate("!!document.querySelector('#sky .fw-star.on')")
    if style == "ink": await pg.screenshot(path=f"fw_items_{style}.png")
    pid = await pg.evaluate("window.__dbg.save().inv.find(r=>r.item==='potion_health').id")
    await pg.click(f"#sky [data-act=skycat][data-id=all]") if await pg.query_selector("#sky [data-act=skycat][data-id=all]") else None
    await pg.wait_for_timeout(300)
    if await pg.query_selector(f"#sky .sky-row[data-id='{pid}']"):
        await pg.click(f"#sky .sky-row[data-id='{pid}']"); await pg.wait_for_timeout(300); await pg.click("#sky .fw-star"); await pg.wait_for_timeout(300)
    # Magic menu: star Flames
    await pg.evaluate("__ui.closeMenu(); __ui.openMenu('magic')"); await pg.wait_for_timeout(500)
    await pg.click("#sky .sky-row[data-id='spell:flames']"); await pg.wait_for_timeout(300)
    res["star_in_magic"] = await pg.query_selector("#sky .fw-star") is not None
    await pg.click("#sky .fw-star"); await pg.wait_for_timeout(300)
    await pg.evaluate("__ui.closeMenu()"); await pg.wait_for_timeout(400)
    res["favs"] = await pg.evaluate("(window.__dbg.save().favs||[]).map(f=>f.k+':'+f.id)")
    # open by the ★ button
    await pg.click("#favBtn"); await pg.wait_for_timeout(700)
    res["wheel_open"] = await pg.query_selector("#favwheel .fw-slot") is not None
    res["slots"] = await pg.evaluate("document.querySelectorAll('#favwheel .fw-slot').length")
    await pg.screenshot(path=f"fw_wheel_{style}.png")
    # pick the sword: equipped
    i = await pg.evaluate("(window.__dbg.save().favs||[]).findIndex(f=>f.id==='steel_sword')")
    await pg.click(f"#favwheel [data-fw='{i}']"); await pg.wait_for_timeout(700)
    res["equipped"] = await pg.evaluate("G.equipment(window.__dbg.save()).weapon?.item")
    res["closed_after_pick"] = await pg.query_selector("#favwheel") is None
    # long-press the map: wheel opens, pick Flames → readied
    box = await pg.evaluate("(()=>{const m=document.querySelector('#map'); if(!m) return null; const r=m.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
    if box:
        await pg.mouse.move(box[0], box[1]); await pg.mouse.down(); await pg.wait_for_timeout(800); await pg.mouse.up(); await pg.wait_for_timeout(500)
    res["map_longpress_ignored"] = await pg.query_selector("#favwheel .fw-slot") is None   # map holds/pinches must never open the wheel
    res["no_roam_after_longpress"] = await pg.evaluate("!window.__dbg.save().trip")
    await pg.click("#favBtn"); await pg.wait_for_timeout(500)
    i = await pg.evaluate("(window.__dbg.save().favs||[]).findIndex(f=>f.id==='flames')")
    await pg.click(f"#favwheel [data-fw='{i}']"); await pg.wait_for_timeout(600)
    res["readied"] = await pg.evaluate("window.__dbg.save().favReady")
    i = await pg.evaluate("(window.__dbg.save().favs||[]).findIndex(f=>f.id==='potion_health')")
    if i >= 0:
        await pg.click("#favBtn"); await pg.wait_for_timeout(500); await pg.click(f"#favwheel [data-fw='{i}']"); await pg.wait_for_timeout(500)
    res["queued"] = await pg.evaluate("window.__dbg.save().favPot || null")
    await pg.click("#favBtn"); await pg.wait_for_timeout(600)
    await pg.screenshot(path=f"fw_wheel2_{style}.png")
    # back button closes it
    await pg.evaluate("__ui.back()"); await pg.wait_for_timeout(400)
    res["back_closes"] = await pg.query_selector("#favwheel") is None
    # readied spell opens a test fight
    lg = await pg.evaluate("(()=>{const S=window.__dbg.save(); const e=G.scaleEnemy({...D.ENCOUNTERS.find(x=>x.name==='Bandit outlaw')},20); const f=new G.Fight(S,e); f.run({trySneak:false}); return f.log[0]?.a})()")
    res["opener"] = lg
    await ctx.close()
    return res
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        out = {}
        for st in ("ink",):
            r = await run(b, st, errs); out[st] = r; print(st, r)
        await b.close()
    bad = []
    for st, r in out.items():
        for k in ("star_in_items", "starred", "star_on", "star_in_magic", "wheel_open", "closed_after_pick", "map_longpress_ignored", "no_roam_after_longpress", "back_closes"):
            if not r.get(k): bad.append(f"{st}:{k}")
        if r.get("equipped") != "steel_sword": bad.append(f"{st}:equipped")
        if r.get("readied") != "spell:flames": bad.append(f"{st}:readied")
        if r.get("queued") != "health": bad.append(f"{st}:queued")
        if r.get("opener") != "spell:flames": bad.append(f"{st}:opener")
    print("errors:", errs)
    print("RESULT", "OK" if not bad and not errs else "FAIL " + ", ".join(bad))
asyncio.run(main())
