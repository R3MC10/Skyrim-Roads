import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8771"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&p=mg"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Magus"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clr = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; S.discovered.push('Winterhold'); S.gold=5000; for (const k of ['Destruction','Alteration','Illusion','Conjuration','Restoration']) S.skills[k].lvl=60; S.mpBonus=300;}")
        # buy a tome and a staff at the College (fake shop hours)
        r = await pg.evaluate("()=>{const S=window.__dbg.save(); let t=G.now(); while(!G.shopsOpen(t)) t+=600; return [G.buy(S,'tome_flame_cloak',1,t), G.buy(S,'tome_candlelight',1,t), G.buy(S,'staff_flames',1,t), G.buy(S,'tome_fire_storm',1,t)];}")
        print("buy:", r)
        r = await pg.evaluate("()=>{const S=window.__dbg.save(); const out=[]; for (const id of ['tome_flame_cloak','tome_candlelight']) { const row=S.inv.find(x=>x.item===id); out.push(G.readTome(S,row.id)); } return out;}")
        print("read:", r)
        await pg.evaluate(clr)
        # College stock in the trade window
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300); await pg.evaluate(clr)
        if await pg.query_selector("[data-act=shop][data-id=wizard]"):
            await pg.click("[data-act=shop][data-id=wizard]"); await pg.wait_for_timeout(300)
            txt = await pg.inner_text("#side"); print("college lists Fire Storm:", "Fire Storm" in txt, "| staffs:", "Staff of" in txt)
        # magic menu
        await pg.evaluate(clr); await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(300)
        await pg.click("[data-act=skytab][data-id=magic]"); await pg.wait_for_timeout(300)
        cats = await pg.evaluate("[...document.querySelectorAll('#sky .sky-cat')].map(b=>b.textContent.trim()).join(',')")
        print("schools:", cats)
        rows = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].map(b=>b.textContent.trim()).slice(0,40)")
        idx = next(i for i, t in enumerate(rows) if "Candlelight" in t)
        await pg.click(f"#sky .sky-row >> nth={idx}"); await pg.wait_for_timeout(200)
        print("detail:", (await pg.inner_text("#sky .sky-detail"))[:200].replace("\n", " | "))
        await pg.screenshot(path=_SHOTS + "magic_menu.png")
        await pg.click("[data-act=castout]"); await pg.wait_for_timeout(400)
        print("candle fx:", await pg.evaluate("G.fxSum(window.__dbg.save(),'trapdodge')"), "| toast:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        idx = next(i for i, t in enumerate(await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].map(b=>b.textContent.trim())")) if "Flame Cloak" in t)
        await pg.click(f"#sky .sky-row >> nth={idx}"); await pg.wait_for_timeout(200)
        print("cloak detail:", (await pg.inner_text("#sky .sky-detail"))[:220].replace("\n", " | "))
        assert not await pg.query_selector("#sky .sky-detail [data-act=skytac]"), "spell card must not have tactics buttons"
        await pg.evaluate("() => { const L=G.loadout(window.__dbg.save()); if(!L.rules.some(r=>r.do==='spell:flame_cloak')) L.rules.unshift({if:'always',do:'spell:flame_cloak'}); }")
        # test fight in tactics
        await pg.evaluate("()=>{ document.querySelector('#sky')?.remove(); }")
        await pg.evaluate(clr); await pg.evaluate("window.__ui.go('tactics')"); await pg.wait_for_timeout(400)   # the Tactics screen (rules, loadouts, test fight) has no menu button since fights went turn-based; open it directly
        opts = await pg.evaluate("[...document.querySelectorAll('select option')].map(o=>o.value).filter(v=>v.startsWith('dual:')).length")
        print("dual options in tactics:", opts)
        await pg.select_option("#te", index=1); await pg.click("[data-act=test]"); await pg.wait_for_timeout(600)
        log = await pg.inner_text("#side")
        print("test fight used cloak:", "Flame Cloak" in log)
        await pg.screenshot(path=_SHOTS + "magic_tactics.png", full_page=False)
        print("errors:", errs)
        print("RESULT", "OK" if not errs and opts and "Flame Cloak" in log else "FAIL")
        await b.close()
asyncio.run(main())
