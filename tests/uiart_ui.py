import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8777"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(sel):
            for _ in range(8):
                await clear()
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=uia"); await pg.wait_for_timeout(1800)
        await pg.screenshot(path="uia_title.png")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ulfa"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.spells=Object.keys(D.SPELLS); S.pendingLevels=1; S.stone='lord'; S.level=12;
          for (const w of ['FUS','RO','DAH','YOL','TOOR','FO','KRAH']) { try { POWERS.learnWord(S,w); } catch(e){} } S.souls=2;
          const L=G.loadout(S); L.rules=[{if:'hp_below',pct:40,do:'potion:health'},{if:'always',do:'spell:flame_cloak'},{if:'enemy_undead',do:'spell:turn_undead'},{if:'always',do:'power:stone'},{if:'always',do:'attack'}];
          S.follower={id:'lydia'}; S.ach={first_steps:1,explorer:1}; }""")
        await pg.wait_for_timeout(400)
        for st in ["ink"]:
            # Hero tab
            await click("[data-tab=map]"); await click("[data-tab=hero]"); await pg.wait_for_timeout(400)
            t0 = await pg.evaluate("()=>{ const t=performance.now(); document.querySelector('[data-tab=hero]').click(); return performance.now()-t; }")
            print(st, "hero tab render ms:", round(t0, 1))
            await pg.screenshot(path=f"uia_hero_{st}.png", full_page=True)
            # magic menu
            await click("[data-tab=pack]"); await pg.wait_for_timeout(300)
            await click("[data-act=skytab][data-id=magic]"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"uia_magic_{st}.png")
            r = await pg.query_selector(".sky-row"); 
            if r: await clear(); await r.click(); await pg.wait_for_timeout(200); await pg.screenshot(path=f"uia_magic_detail_{st}.png")
            await click("[data-act=skytab][data-id=skills]"); await pg.wait_for_timeout(300)
            r = await pg.query_selector(".sky-row")
            if r: await clear(); await r.click(); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f"uia_skills_{st}.png")
            await pg.evaluate("document.querySelector('#sky')?.remove()")
            # journal: quests, achievements, festival, guide
            await click("[data-tab=log]"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f"uia_journal_{st}.png", full_page=True)
        # an icon gallery of everything, both styles
        for st in ["ink"]:
            u = await pg.evaluate(f"""()=>{{ const d=document.createElement('div'); d.id='gal'; d.style.cssText='position:fixed;inset:0;z-index:99;background:#1c2128;overflow:auto;padding:6px;display:flex;flex-wrap:wrap;gap:3px;align-content:flex-start';
              const h=[...Object.keys(D.SPELLS).map(id=>UIART.spell(id,40)), ...D.ALL_SKILLS.map(s=>UIART.skill(s,40)), ...Object.keys(POWERS.STONES).map(id=>UIART.stone(id,40)), ...Object.keys(POWERS.SHOUTS).map(id=>UIART.shout(id,40)),
                 ...QUESTS.list().map(id=>UIART.quest(id,40)), UIART.quest('bounty',40), ...ACH.LIST.map(a=>UIART.ach(a[0],40)), ...Object.keys(TOWNS.FOLLOWERS).map(id=>UIART.follower(id,40)), ...HORSES.COATS.map(c=>UIART.horse(c[0],40)),
                 ...GUIDE.STEPS.map(s=>UIART.guide(s[0],40)), ...['health','magicka','stamina'].map(a=>UIART.attr(a,40)), ...[800,1000,1200,1400].map(r=>UIART.rank(r,40)), ...['tome_flames','tome_fireball','tome_mark','staff_flames'].filter(i=>D.ITEMS[i]).map(i=>ICONART.item(i,40))].join('')
                 + UIART.fest('frostfall',340,64) + UIART.death(320,120) + UIART.panorama(380,240);
              d.innerHTML=h; document.querySelector('#gal')?.remove(); document.body.appendChild(d); return 1; }}""")
            await pg.wait_for_timeout(600); await pg.screenshot(path=f"uia_gallery_{st}.png", full_page=False)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
