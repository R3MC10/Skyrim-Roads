import asyncio, sys
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8796"
OUT = _SHOTS + "imm/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs, res = [], []
        for style in ["ink"]:
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&lockgame&loading&p=imm{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Picker"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            async def clear():
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("(st)=>{ const S=window.__dbg.save(); const n='Bleak Falls Barrow'; S.location=n; [S.x,S.y]=WORLD.places[n]; S.discovered.push(n); S.cleared={}; S.level=20; S.hpBonus=3000; G.setHealth(S,G.maxHealth(S)); S.skills.Lockpicking.lvl=30; }", style)
            await clear(); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300); await clear()
            # loading card on entering
            await pg.click("[data-act=enter]"); await pg.wait_for_timeout(250)
            lc = await pg.query_selector("#loadcard")
            if lc: await pg.screenshot(path=f"{OUT}{style}_loading.png")
            res.append(f"{style} loading card {bool(lc)}")
            await pg.wait_for_timeout(1400)
            res.append(f"{style} loading gone {not await pg.query_selector('#loadcard')}")
            await clear()
            # force a treasure room
            await pg.evaluate("()=>{ const d=window.__dbg.save().dungeon; d.rows=[[{type:'treasure',links:[0]}],[{type:'treasure',links:[0]}],[{type:'treasure',links:[0]}],[{type:'boss',links:[]}]]; }")
            async def treasure():
                await clear(); n = await pg.query_selector("#dun .dnode")
                if n: await n.click(); await pg.wait_for_timeout(400)
                await clear(); btn = await pg.query_selector("#dun [data-act=dact][data-c=pick]")
                if btn: await btn.click(); await pg.wait_for_timeout(300)
                return bool(await pg.query_selector("#lockpick"))
            # 1) open it: aim at the spot, hold Turn
            shown = await treasure(); res.append(f"{style} lock game shown {shown}")
            await pg.screenshot(path=f"{OUT}{style}_lock.png")
            locks0 = await pg.evaluate("window.__dbg.save().lt?.locks||0")
            await pg.evaluate("()=>{ IMM.lock.angle=IMM.lock.spot; document.querySelector('#lpang').value=Math.round(IMM.lock.spot); }")
            t = await pg.query_selector("#lpturn"); bb = await t.bounding_box()
            await pg.mouse.move(bb["x"]+bb["width"]/2, bb["y"]+bb["height"]/2); await pg.mouse.down(); await pg.wait_for_timeout(250)
            await pg.screenshot(path=f"{OUT}{style}_lock_turning.png")
            await pg.wait_for_timeout(700); await pg.mouse.up(); await pg.wait_for_timeout(600)
            locks1 = await pg.evaluate("window.__dbg.save().lt?.locks||0")
            res.append(f"{style} opened: overlay gone {not await pg.query_selector('#lockpick')} locks {locks0}->{locks1} room {await pg.evaluate('window.__dbg.save().dungeon?.room?.type||null')}")
            await clear(); await pg.screenshot(path=f"{OUT}{style}_after_open.png")
            # 2) break a pick: aim far away, hold
            shown = await treasure(); tries0 = await pg.evaluate("window.__dbg.save().dungeon?.room?.tries")
            await pg.evaluate("()=>{ const L=IMM.lock; L.angle = L.spot>90 ? 0 : 180; }")
            t = await pg.query_selector("#lpturn"); bb = await t.bounding_box()
            await pg.mouse.move(bb["x"]+bb["width"]/2, bb["y"]+bb["height"]/2); await pg.mouse.down(); await pg.wait_for_timeout(900); await pg.mouse.up(); await pg.wait_for_timeout(200)
            picks = await pg.evaluate("IMM.lock?.picks"); broken = await pg.evaluate("IMM.lock?.broken")
            res.append(f"{style} break: shown {shown} tries {tries0} picks now {picks} broken {broken}")
            # 3) no quick roll any more (mini-games are always on); leave it
            if await pg.query_selector("#lpauto"): raise SystemExit("Quick roll should be gone")
            await pg.click("#lpleave"); await pg.wait_for_timeout(500)
            room = await pg.evaluate("JSON.stringify(window.__dbg.save().dungeon?.room||null)")
            res.append(f"{style} leave: overlay gone {not await pg.query_selector('#lockpick')} room {room}")
            await clear()
            # quest banner
            await pg.evaluate("()=>{ const S=window.__dbg.save(); IMM.tick(S); const id=Object.keys(QUESTS.L).find(k=>!S.quests[k]); S.quests[id]={stage:0,t:G.now(),base:{}}; IMM.tick(S); }")
            seen, shot = [], False
            for _ in range(40):
                for t in await pg.evaluate("[...document.querySelectorAll('#pbanners .pban')].map(e=>e.innerText.replace(/\\s+/g,' ').trim())"):
                    if t not in seen: seen.append(t)
                if not shot and any(x.lower().startswith("quest started") for x in seen):
                    await pg.wait_for_timeout(350); await pg.screenshot(path=f"{OUT}{style}_quest.png"); shot = True
                if any(x.lower().startswith("objective") for x in seen):
                    await pg.wait_for_timeout(350); await pg.screenshot(path=f"{OUT}{style}_objective.png"); break
                await pg.wait_for_timeout(250)
            res.append(f"{style} banners {seen}")
            # leave dungeon, bark on arrival in Whiterun
            lv = await pg.query_selector("#dun [data-act=dleave]")
            if lv: await lv.click(); await pg.wait_for_timeout(300)
            await clear()
            await pg.evaluate("document.querySelectorAll('#loadcard').forEach(e=>e.remove())")
            await pg.evaluate("()=>{ IMM.bark(window.__dbg.save(),'Whiterun', Date.now()+1e7); }"); await pg.wait_for_timeout(300)
            bk = await pg.evaluate("document.querySelector('#bark')?.textContent||null")
            res.append(f"{style} bark {bk}")
            await pg.screenshot(path=f"{OUT}{style}_bark.png")
            # journal stats
            await clear()
            await pg.evaluate("document.querySelectorAll('#modal,#bark').forEach(m=>m.remove())")
            await pg.click("button.tab[data-tab=log]"); await pg.wait_for_timeout(300); await clear()
            await pg.evaluate("()=>window.__ui.go('stats')"); await pg.wait_for_timeout(300)   # Stats moved: Character → Stats
            pan = await pg.query_selector(".ltstats")
            if pan: await pan.screenshot(path=f"{OUT}{style}_stats.png")
            txt = await pg.evaluate("document.querySelector('.ltstats')?.innerText||''")
            res.append(f"{style} stats {bool(pan)} NaN {'NaN' in txt} locks-line {'Locks picked' in txt}")
            await pg.close()
        print("\n".join(res)); print("errors:", errs)
        await b.close()
asyncio.run(main())
