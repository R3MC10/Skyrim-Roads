"""Crafting shortcuts screen test (craftqol.js): the forge (make, smelt & tan, improve), alchemy lab, cooking pot,
arcane enchanter and homestead workbench on two phone sizes, both art styles, and the biggest text size at 360 px.
Checks: "Can make now" filter, "Can make N" / "Missing:" lines, pinning a favourite to the top, ×5 / Max with one
confirm and one summary toast, single Make still opens the mini-game, no page errors, nothing sticking out sideways.
Run:  python -m http.server 9650 --directory game   then   python tests/craft_ui.py 9650 [outdir]
(On Windows: set PYTHONIOENCODING=utf-8.) Screenshots land in outdir (default: craft_shots in the temp folder)."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9650"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "craft_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky,#craftgame').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
OVERFLOW = """(()=>{ const W=innerWidth, bad=[];
  for (const e of document.querySelectorAll('#side button,#side .btn,#side .item,#side h3,#side .cqbar,#modal .sheet,#modal button')) {
    const r=e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs=getComputedStyle(e); if (cs.visibility==='hidden' || cs.display==='none') continue;
    let sc=false; for (let a=e.parentElement; a && a!==document.body; a=a.parentElement) { const o=getComputedStyle(a).overflowX; if (o==='auto'||o==='scroll') { sc=true; break; } }
    if (sc) continue;
    if (r.right > W + 1 || r.left < -1) bad.push((e.dataset.act||e.className||e.tagName)+' x '+Math.round(r.left)+'..'+Math.round(r.right));
  }
  return bad; })()"""
SETUP = """()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.gold=20000;
  S.inv=S.inv.filter(r=>!/^(mat_|ore_|ing_|food_|fish_|pelt_)/.test(r.item));
  G.give(S,'mat_iron',23); G.give(S,'mat_strips',12); G.give(S,'ore_iron',9); G.give(S,'pelt_wolf',2); G.give(S,'mat_firewood',4);
  for (const [it,q] of COOK.RECIPES.veg_soup[1]) G.give(S,it,q*3);
  G.give(S,'ing_blue_flower',4); G.give(S,'ing_wheat',3); TOWNS.known(S,'ing_blue_flower')[0]=true; TOWNS.known(S,'ing_wheat')[0]=true; G.give(S,'ing_thistle',1);
  G.give(S,'iron_helmet'); G.give(S,'soul_gem_common'); S.enchants=['health','fire']; S.skills.Smithing.lvl=45; S.cqfav=[]; S.cqonly=false; }"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vw, vh, style, big in [(360, 780, "ink", True), (360, 780, "pixel", False), (412, 915, "ink", False), (412, 915, "pixel", True)]:
            tag = f"{vw}_{style}{'_big' if big else ''}"
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=cq{vw}{style}"); await pg.wait_for_timeout(1200)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Grelka"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(SETUP)
            await pg.evaluate(f"ART.setStyle('{style}')")
            await pg.evaluate(f"ACCESS.pref('a11yText','{3 if big else 0}')")
            for _ in range(3): await pg.evaluate(CLEAR); await pg.wait_for_timeout(250)

            async def shot(name, el="#side"):
                await pg.wait_for_timeout(300)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"), full_page=False)
                if el == "#side":
                    h = await pg.query_selector("#side")
                    if h: await h.screenshot(path=os.path.join(OUT, f"{tag}_{name}_panel.png"))
                bad = await pg.evaluate(OVERFLOW)
                if bad: fails.append(f"{tag} {name}: {bad[:5]}")
            async def tap(sel):   # random events / news popups can open a modal at any moment: clear and retry
                for _ in range(8):
                    await pg.evaluate(CLEAR)
                    try: await pg.click(sel, timeout=2500); return
                    except Exception: await pg.wait_for_timeout(300)
                await pg.click(sel, timeout=3000)
            async def go_town(section):
                await tap("[data-tab=map]"); await tap("[data-tab=town]"); await pg.wait_for_timeout(250)
                await tap(f"[data-id={section}]"); await pg.wait_for_timeout(250)
            async def batch(sel, label):
                await tap(sel); await pg.wait_for_selector("#modal [data-act=cqgo]", timeout=3000)
                await shot(label + "_confirm", el=None)
                await pg.click("#modal [data-act=cqgo]"); await pg.wait_for_timeout(350)
                return await pg.evaluate("document.querySelector('#toast')?.textContent||''")
            S = "window.__dbg.save()"

            # ---- forge: make
            await go_town("forge")
            await pg.evaluate(CLEAR)
            await shot("forge_make")
            if not await pg.query_selector("[data-act=cqonly]"): fails.append(f"{tag} no Can make now chip at the forge")
            txt = await pg.inner_text("#side")
            rows_st = await pg.evaluate("[document.querySelectorAll('[data-act=smake]').length, document.querySelectorAll('.cqrow .cqst').length]")
            if rows_st[0] == 0 or rows_st[0] != rows_st[1]: fails.append(f"{tag} not every forge row has a Can make / Missing line {rows_st}")
            ids = await pg.evaluate("[...document.querySelectorAll('[data-act=smake]')].map(b=>b.dataset.id)")
            last = ids[-1]
            await tap(f"[data-act=cqfav][data-k=smith][data-id={last}]"); await pg.wait_for_timeout(250)
            first = await pg.evaluate("document.querySelector('[data-act=smake]').dataset.id")
            if first != last: fails.append(f"{tag} pinned {last} is not first ({first})")
            await tap("[data-act=cqonly]"); await pg.wait_for_timeout(250)
            shown = await pg.evaluate("[...document.querySelectorAll('[data-act=smake]')].map(b=>b.disabled)")
            if not shown or any(shown): fails.append(f"{tag} filter shows unmakeable rows {shown}")
            await shot("forge_canmake")
            iron0 = await pg.evaluate(f"SMITH.count({S},'mat_iron')")
            n = await pg.evaluate(f"CRAFTQOL.can({S},'smith','iron_dagger').n")
            t = await batch("[data-act=cqask][data-k=smith][data-id=iron_dagger][data-n=max]", "forge_max")
            per = await pg.evaluate("SMITH.RECIPES.iron_dagger.mats[0][1]")
            got = await pg.evaluate(f"[SMITH.count({S},'iron_dagger'), SMITH.count({S},'mat_iron')]")
            if got[0] < n or got[1] != iron0 - per * n: fails.append(f"{tag} Max dagger: made {got} expected {n}")
            if "Iron Dagger" not in t and "Achievement" not in t: fails.append(f"{tag} no summary toast: {t!r}")
            print(tag, "forge max:", n, "→", t[:110])
            await tap("[data-act=cqonly]"); await pg.wait_for_timeout(200)
            # single Make still plays the mini-game when it's switched on
            if vw == 412 and style == "ink":
                await pg.evaluate("history.replaceState(null,'',location.pathname+location.search+'&craftgame')")
                await pg.evaluate(f"G.give({S},'mat_iron',3); G.give({S},'mat_strips',2)"); await pg.evaluate(CLEAR)
                await tap("[data-act=fgroup][data-id=iron]"); await pg.wait_for_timeout(200)
                await tap("[data-act=smake][data-id=iron_dagger]")
                try: await pg.wait_for_selector("#craftgame", timeout=3000); print(tag, "single Make → mini-game opens")
                except Exception: fails.append(f"{tag} single Make did not open the mini-game")
                await pg.evaluate("document.querySelector('#cgquick')?.click()"); await pg.wait_for_timeout(300)
                await pg.evaluate("history.replaceState(null,'',location.href.replace('&craftgame',''))")
            # ---- smelt & tan
            await pg.evaluate(CLEAR); await tap("[data-act=ftab][data-id=refine]"); await pg.wait_for_timeout(250)
            await shot("forge_refine")
            t = await batch("[data-act=cqask][data-k=refine][data-id='0'][data-n=max]", "refine_max")
            ore = await pg.evaluate(f"SMITH.count({S},'ore_iron')")
            if ore != 1: fails.append(f"{tag} smelt max left {ore} ore (want 1)")
            print(tag, "smelt max →", t[:100])
            # ---- improve
            await pg.evaluate(CLEAR); await tap("[data-act=ftab][data-id=improve]"); await pg.wait_for_timeout(250)
            await shot("forge_improve")
            await tap("[data-act=ftab][data-id=make]"); await pg.wait_for_timeout(150)

            # ---- alchemy
            await go_town("alchemy")
            rows = await pg.evaluate("[...document.querySelectorAll('[data-act=alch]')].map(e=>[e.dataset.id,e.innerText.slice(0,30)])")
            pick = [r[0] for r in rows if "Blue Mountain" in r[1] or "Wheat" in r[1]][:2]
            for i in pick: await pg.evaluate(CLEAR); await tap(f"[data-act=alch][data-id='{i}']"); await pg.wait_for_timeout(150)
            await shot("alch_selected")
            await tap("[data-act=cqfav][data-k=alch]"); await pg.wait_for_timeout(200)
            await tap("[data-act=cqonly]"); await pg.wait_for_timeout(200)
            await shot("alch_fav_filter")
            if "Thistle" in await pg.inner_text("#side"): fails.append(f"{tag} alchemy filter kept an ingredient with no known partner")
            t = await batch("[data-act=cqask][data-k=alch][data-n=max]", "alch_max")
            if await pg.evaluate(f"SMITH.count({S},'ing_wheat')") != 0: fails.append(f"{tag} alchemy max left wheat")
            print(tag, "alchemy max →", t[:110])
            await tap("[data-act=cqonly]"); await pg.wait_for_timeout(150)

            # ---- cooking pot
            await go_town("cook")
            await shot("cook")
            t = await batch("[data-act=cqask][data-k=cook][data-id=veg_soup][data-n=max]", "cook_max")
            if await pg.evaluate(f"SMITH.count({S},'dish_veg_soup')") != 3: fails.append(f"{tag} cook max did not make 3 soups")
            print(tag, "cook max →", t[:100])

            # ---- arcane enchanter
            if await pg.evaluate("ENCH.hasEnchanter('Whiterun')"):
                await go_town("enchanter"); await shot("enchanter")
                await pg.evaluate("document.querySelector('[data-act=cqfav][data-k=ench]')?.click()"); await pg.wait_for_timeout(200)
                await tap("[data-act=cqonly]"); await pg.wait_for_timeout(200); await shot("enchanter_filter")
                await tap("[data-act=cqonly]"); await pg.wait_for_timeout(150)

            # ---- homestead workbench (Falkreath plot)
            await pg.evaluate(f"()=>{{const s={S}; const pid=Object.keys(HOMESTEAD.PLOTS)[0]; s.location=HOMESTEAD.PLOTS[pid].town; [s.x,s.y]=WORLD.places[s.location]; HOMESTEAD.act(s,'deed',pid); HOMESTEAD.act(s,'view','bench'); G.give(s,'mat_iron',6);}}")
            await go_town("homestead")
            await shot("bench")
            t = await batch("[data-act=cqask][data-k=bench][data-id=nails][data-n=max]", "bench_max")
            print(tag, "bench max →", t[:100])
            if "nails" not in t: fails.append(f"{tag} bench summary: {t!r}")
            if errs: fails.append(f"{tag} page errors: {errs[:3]}")
            await ctx.close()
        await b.close()
    print("shots in", OUT)
    print("FAILS:", fails if fails else "none")
    if fails: sys.exit(1)

asyncio.run(main())
