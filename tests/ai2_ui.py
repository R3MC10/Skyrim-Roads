# AI settings, Hybrid, multi-condition rules, drag reorder, presets, 20-fight preview, share codes, sneak chance on the
# encounter card. python3 ai2_ui.py [port]  -> RESULT OK
import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8854"

async def run(b, style, errs, bad):
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
    await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ai2{style}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Tactician"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    kill = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
    await pg.evaluate(kill)
    await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.level=20; for (const k of ['Destruction','Restoration','Alteration','Illusion','One-Handed','Blocking']) S.skills[k].lvl=50;
       S.spells=Object.keys(D.SPELLS).filter(id=>D.SPELLS[id].kind!=='utility' && MAGIC.failChance(S,id)===0).slice(0,14); G.give(S,'potion_health',3); for (let i=0;i<4;i++) QUESTS.check(S); }""")
    await pg.evaluate(kill)
    async def click(sel):
        for _ in range(4):
            await pg.evaluate(kill)
            try: await pg.click(sel, timeout=3000); return
            except Exception: pass
        await pg.click(sel)
    lo = "window.__dbg.save().loadouts[window.__dbg.save().loadout]"
    await click("[data-tab=tactics]"); await pg.wait_for_timeout(500)
    if not await pg.query_selector("#aisetbox"): bad.append(style + " no AI settings card")
    await click("#aisetbox > summary"); await pg.wait_for_timeout(300)
    await click("[data-act=aiset][data-k=style][data-v=careful]"); await pg.wait_for_timeout(200)
    await click("[data-act=aiset][data-k=prefer][data-v=magic]"); await pg.wait_for_timeout(200)
    await click("[data-act=aiset][data-k=sneak][data-v=never]"); await pg.wait_for_timeout(200)
    await pg.evaluate("""()=>{ const r=document.querySelector('#ai_healAt'); r.value=60; r.dispatchEvent(new Event('input',{bubbles:true})); r.dispatchEvent(new Event('change',{bubbles:true})); }""")
    await click("[data-act=aitrain]")
    await pg.wait_for_timeout(300)
    st = await pg.evaluate(f"{lo}.ai")
    print(style, "settings:", {k: st.get(k) for k in ("style", "prefer", "sneak", "healAt", "train")}, st.get("w"))
    if not (st["style"] == "careful" and st["prefer"] == "magic" and st["sneak"] == "never" and st["healAt"] == 60 and st["train"] and st["w"]["magic"] > 1.5): bad.append(style + " settings not saved")
    tr = await pg.evaluate("document.querySelector('#aisetbox')?.innerText || ''")
    print(style, "training:", tr)
    if "Destruction" not in tr: bad.append(style + " training list")
    el = await pg.query_selector("#aisetbox"); await el.screenshot(path=f"ai2_settings_{style}.png")
    # Hybrid + a rule with two conditions
    await click("[data-act=aimode][data-id=hybrid]"); await pg.wait_for_timeout(300)
    await pg.select_option("#tc", "first_turn"); await pg.wait_for_timeout(300)
    await click("[data-act=rxadd]"); await pg.wait_for_timeout(300)
    await pg.select_option(".tcx[data-ci='1']", "enemy_humanoid"); await pg.wait_for_timeout(300)
    await pg.select_option("#ta", "block"); await pg.wait_for_timeout(100)
    await click("[data-act=radd]"); await pg.wait_for_timeout(300)
    rules = await pg.evaluate(f"{lo}.rules")
    mode = await pg.evaluate(f"{lo}.mode")
    r0 = next((r for r in rules if r.get("do") == "block"), {})
    print(style, "mode", mode, "rule 1:", r0)
    if mode != "hybrid" or r0.get("do") != "block" or len(r0.get("conds", [])) != 2: bad.append(style + " multi-condition rule")
    txt = await pg.evaluate("[...document.querySelectorAll('.rlist .rcard .rtxt')].map(e=>e.innerText).join(' | ')")
    if "AND" not in txt: bad.append(style + " rule card text: " + txt)
    # drag rule 1 below rule 2
    before = [r["do"] for r in rules]
    await pg.evaluate("document.querySelector('.rlist .rcard .rdrag').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    box = await (await pg.query_selector(".rlist .rcard .rdrag")).bounding_box()
    cards = await pg.query_selector_all(".rlist .rcard")
    b2 = await cards[1].bounding_box()
    await pg.mouse.move(box["x"] + 5, box["y"] + 5); await pg.mouse.down()
    await pg.mouse.move(box["x"] + 5, b2["y"] + b2["height"] * 0.8, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(400)
    after = [r["do"] for r in await pg.evaluate(f"{lo}.rules")]
    print(style, "drag:", before, "->", after)
    if after[:2] != [before[1], before[0]]: bad.append(style + " drag reorder")
    el = await pg.query_selector("#side .rulesbox"); await el.screenshot(path=f"ai2_rules_{style}.png")
    # preview 20 fights
    await click("[data-act=preview]"); await pg.wait_for_timeout(1500)
    res = await pg.evaluate("document.querySelector('.aiprev')?.innerText || ''")
    print(style, "preview:", res.replace("\n", " "))
    if "%" not in res: bad.append(style + " preview")
    el = await pg.query_selector(".aiprev"); el = await el.evaluate_handle("e=>e.closest('.panel')"); await el.as_element().screenshot(path=f"ai2_preview_{style}.png")
    # share: copy, change, import back
    code = await pg.evaluate(f"AISET.encode({lo})")
    await click("[data-act=sharecopy]"); await pg.wait_for_timeout(300)
    if not code.startswith("ROTN1-"): bad.append(style + " share code")
    await pg.evaluate(f"(()=>{{ const L={lo}; L.rules=[{{if:'always',do:'attack'}}]; L.mode='custom'; L.ai.style='aggressive'; }})()")
    await click("[data-act=shareopen]"); await pg.wait_for_timeout(200)
    await pg.fill("#sharein", code)
    await click("[data-act=shareimport]"); await pg.wait_for_timeout(300)
    back = await pg.evaluate(f"(()=>({{m:{lo}.mode, s:{lo}.ai.style, n:{lo}.rules.length}}))()")
    print(style, "import:", back)
    if not (back["m"] == "hybrid" and back["s"] == "careful" and back["n"] >= 2): bad.append(style + " import")
    # presets
    await click("[data-act=preset][data-id=trainer]"); await pg.wait_for_timeout(300)
    await click("[data-act=presetyes]"); await pg.wait_for_timeout(300)
    pr = await pg.evaluate(f"(()=>({{m:{lo}.mode, t:{lo}.ai.train}}))()")
    if not (pr["m"] == "hybrid" and pr["t"]): bad.append(style + " trainer preset")
    # sneak chance on the encounter card
    await pg.evaluate(f"(()=>{{ {lo}.ai.sneak='safe'; }})()")
    await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
       S.trip.status='encounter'; S.trip.encounter={...G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==='Bandit outlaw')},S.level), hold:'Whiterun'}; }""")
    for _ in range(3):
        await pg.evaluate(kill); await click("[data-tab=map]"); await pg.wait_for_timeout(500)
        if await pg.query_selector("[data-act=openenc]"): await pg.click("[data-act=openenc]")
        await pg.wait_for_timeout(400)
        if await pg.query_selector("#modal .sneak2"): break
    card = await pg.evaluate("document.querySelector('#modal .sneak2')?.innerText || ''")
    sp = await pg.evaluate("document.querySelector('#modal [data-a=sneak]')?.innerText || ''")
    print(style, "card:", card.replace("\n", " | "), "·", sp)
    if "%" not in card or "%" not in sp: bad.append(style + " sneak chance on card")
    sh = await pg.query_selector("#modal .sheet")
    if sh: await sh.screenshot(path=f"ai2_encounter_{style}.png")
    await pg.click("[data-act=enc][data-a=fight]")
    try: await pg.wait_for_selector("#modal .flog", timeout=8000)
    except Exception:
        info = await pg.evaluate("(()=>({m: document.querySelector('#modal')?.innerText?.slice(0,200), trip: window.__dbg.save().trip?.status}))()")
        print(style, "after fight:", info)
        if not (info.get("trip") in (None, "travel") or "Victory" in (info.get("m") or "") or "defeat" in (info.get("m") or "").lower()): bad.append(style + " fight didn't show")
    await ctx.close()

async def main():
    errs, bad = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=__import__("os").environ.get("CHROME") or None, args=["--no-sandbox"])
        for st in ("ink", "pixel"): await run(b, st, errs, bad)
        await b.close()
    print("errors:", errs)
    print("RESULT", "OK" if not bad and not errs else "FAIL " + "; ".join(bad))
asyncio.run(main())
