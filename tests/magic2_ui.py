"""Big spellbook in the browser: Novice tomes at Belethor, court wizard and College stock gated by skill, master rituals,
the Magic menu's Mysticism / Support tabs, tier filter and sort by cost. python3 magic2_ui.py <port> — prints RESULT OK."""
import asyncio, sys, io, re, json
from PIL import Image
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8851"

async def run(b, style, errs):
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
    await ctx.add_init_script(f"try{{localStorage.setItem('artStyle','{style}')}}catch(e){{}}")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0&p=mg2{style}"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Magus"); await pg.click("#begin"); await pg.wait_for_timeout(1300)
    await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),250)")
    # shops open, low skills, in Whiterun
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.gold=99999; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; for (const k of ['Destruction','Alteration','Illusion','Conjuration','Restoration','Mysticism']) S.skills[k].lvl=10;
      const t0=G.now; G.now=()=>{let t=t0(); while(!G.shopsOpen(t)) t+=600; return t;};}""")
    res = {}
    async def open_shop(kind):
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
        btn = await pg.query_selector(f"[data-act=shop][data-id={kind}]")
        if not btn: return None
        await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(500)
        return await pg.inner_text("#side")
    txt = await open_shop("general")
    res["belethor_note"] = bool(txt) and "Belethor" in txt and "spell tome" in txt
    res["belethor_novice"] = (txt or "").count("Spell Tome:") >= 3
    if style == "ink": await pg.screenshot(path="mg2_belethor.png")
    txt = await open_shop("wizard")
    res["farengar_low"] = bool(txt) and "Farengar" in txt and "Spell Tome: Fireball" not in txt and "Spell Tome: Firebolt" not in txt and "Spell Tome:" in txt
    await pg.evaluate("()=>{const S=window.__dbg.save(); for (const k of ['Destruction','Alteration','Illusion','Conjuration','Restoration','Mysticism']) S.skills[k].lvl=60;}")
    txt = await open_shop("wizard")
    res["farengar_adept"] = bool(txt) and txt.count("Spell Tome:") > res.get("_n", 0)
    res["no_expert_at_court"] = not any(n in (txt or "") for n in ("Incinerate", "Thunderbolt", "Icy Spear"))
    if style == "ink": await pg.screenshot(path="mg2_farengar.png", full_page=False)
    # the College: expert tomes and the rituals
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; if(!S.discovered.includes('Winterhold')) S.discovered.push('Winterhold');
      for (const k of ['Destruction','Alteration','Illusion','Conjuration','Restoration','Mysticism']) S.skills[k].lvl=95; window.__ui?.refresh?.();}""")
    txt = await open_shop("wizard")
    res["college_expert"] = bool(txt) and "Incinerate" in txt
    res["rituals_shown"] = bool(txt) and "master rituals" in txt.lower() and "begin ritual" in txt.lower()
    if not res["rituals_shown"]: print("SIDE", (txt or "")[:600])
    btn = await pg.query_selector("[data-act=sbritual][data-id=Destruction]")
    if btn: await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(500)
    res["ritual_started"] = await pg.evaluate("(window.__dbg.save().rituals||{}).Destruction==='active'")
    await pg.screenshot(path=f"mg2_college_{style}.png")
    # learn a pile of spells, then the Magic menu
    await pg.evaluate("()=>{const S=window.__dbg.save(); S.spells=[...new Set([...S.spells,'flames','healing','heal_other','flame_blade','shelter','heroism','stoneskin_touch','bound_arms','soul_shield','rescue','absorb_magicka','detect_dead','magelight','firebolt','fireball','thunderbolt','rally','seeker'])];}")
    await pg.evaluate("__ui.openMenu('magic')"); await pg.wait_for_timeout(500)
    cats = await pg.evaluate("[...document.querySelectorAll('#sky .sky-cat')].map(b=>b.dataset.id)")
    res["cats"] = "mysticism" in cats and "support" in cats
    await pg.click("#sky [data-act=skycat][data-id=support]"); await pg.wait_for_timeout(300)
    names = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].map(b=>b.textContent)")
    res["support_tab"] = len(names) >= 6 and any("Heal Other" in n for n in names) and not any("Firebolt" in n for n in names)
    res["support_colour"] = await pg.evaluate("!!document.querySelector('#sky .sky-row.sb-sup')")
    await pg.screenshot(path=f"mg2_support_{style}.png")
    await pg.click("#sky [data-act=skycat][data-id=all]"); await pg.wait_for_timeout(300)
    await pg.click("#sky [data-act=skytier][data-id=Novice]"); await pg.wait_for_timeout(300)
    subs = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row small')].map(b=>b.textContent)")
    res["tier_filter"] = len(subs) > 0 and all("Novice" in t for t in subs)
    await pg.click("#sky [data-act=skytier][data-id=all]"); await pg.wait_for_timeout(200)
    await pg.click("#sky [data-act=skymsort][data-id=cost]"); await pg.wait_for_timeout(300)
    costs = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row .num')].map(b=>+b.textContent).filter(n=>n>0)")
    res["sorted_by_cost"] = len(costs) > 3 and costs == sorted(costs)
    res["school_colour"] = await pg.evaluate("!!document.querySelector('#sky .sky-row.sch-destruction.el-fire')")
    await pg.screenshot(path=f"mg2_magic_{style}.png")
    await ctx.close()
    return res

JS = re.search(r'JS = r"""(.*?)"""', open(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "fight2_ui.py"), encoding="utf-8").read(), re.S).group(1)
async def beams(b, style, errs):
    """support spells in the fight scene: a coloured beam from you to the ally"""
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
    await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + str(e)))
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&fightanim&p=mgb{style}"); await pg.wait_for_timeout(1500)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Helper"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.evaluate(JS); await pg.evaluate("FIGHTART.manual(true)")
    shots = []
    for sp, me in [("heal_other", "Heal Other → Lydia: +60 health"), ("flame_blade", "Flame Blade → Lydia: their weapon wreathes in fire"), ("heroism", "Heroism → Lydia: they fight like a hero (+50% damage)"), ("soul_shield", "Soul Shield → Lydia: a ward of 60")]:
        await pg.evaluate(f"""()=>{{ const f=__f2.synth('spell:{sp}', {json.dumps(me)}, 'Bandit outlaw', {{ehp:120, end:60, allies:[{{name:'Lydia', follower:true, fid:'lydia', kind:'follower'}}]}}); __f2.mount(f); }}""")
        el = await pg.query_selector("#f2box .fscene")
        await pg.evaluate("FIGHTART.advance(520)")
        shots.append(Image.open(io.BytesIO(await el.screenshot())))
    w, h = shots[0].size; im = Image.new("RGB", (w * 2, h * 2))
    for i, sh in enumerate(shots): im.paste(sh.convert("RGB"), ((i % 2) * w, (i // 2) * h))
    im.save(f"mg2_beams_{style}.png")
    await ctx.close()
async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        out = {}
        for st in ("ink",):
            r = await run(b, st, errs); out[st] = r; print(st, r)
            await beams(b, st, errs)
        await b.close()
    bad = [f"{st}:{k}" for st, r in out.items() for k, v in r.items() if not k.startswith("_") and v is not True]
    print("errors:", errs)
    print("RESULT", "OK" if not bad and not errs else "FAIL " + ", ".join(bad))
asyncio.run(main())
